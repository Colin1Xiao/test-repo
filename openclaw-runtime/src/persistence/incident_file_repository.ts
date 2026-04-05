/**
 * Phase 3B-2: Incident File Repository
 * 
 * 文件持久化的 Incident 存储：
 * - JSONL 追加日志
 * - 快照加速恢复
 * - 文件锁并发控制
 * - 损坏数据防御
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { Incident, IncidentUpdateRequest, IncidentQuery, IncidentStatus } from '../alerting/incident_repository.js';
import { getTimelineStore } from '../alerting/timeline_integration.js';
import { getFileLock } from './file_lock.js';

// ==================== Types ====================

interface IncidentEvent {
  type: 'incident_created' | 'incident_updated';
  id: string;
  timestamp: number;
  data: Partial<Incident> | IncidentUpdateRequest;
}

interface IncidentSnapshot {
  snapshot_at: number;
  incidents: Record<string, Incident>;
}

// ==================== Configuration ====================

export interface IncidentFileRepositoryConfig {
  dataDir: string;
  snapshotIntervalMs: number;
  backupCount: number;
}

const DEFAULT_CONFIG: IncidentFileRepositoryConfig = {
  dataDir: './data/incidents',
  snapshotIntervalMs: 60 * 1000, // 1 分钟
  backupCount: 3,
};

// ==================== Helpers ====================

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

// ==================== Incident File Repository ====================

export class IncidentFileRepository {
  private readonly config: IncidentFileRepositoryConfig;
  private readonly incidents: Map<string, Incident> = new Map();
  private readonly timelineStore = getTimelineStore();
  
  // File paths
  private readonly jsonlPath: string;
  private readonly snapshotPath: string;
  private readonly backupDir: string;
  private readonly lockDir: string;
  
  // State
  private lastSnapshotAt: number = 0;
  private isLoaded: boolean = false;

  constructor(config: Partial<IncidentFileRepositoryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Resolve paths
    const baseDir = join(process.cwd(), this.config.dataDir);
    this.jsonlPath = join(baseDir, 'incidents.jsonl');
    this.snapshotPath = join(baseDir, 'incidents_snapshot.json');
    this.backupDir = join(baseDir, 'incidents_backup');
    this.lockDir = join(baseDir, 'incidents_lock');
  }

  // ==================== Initialization ====================

  /**
   * Initialize repository
   */
  async initialize(): Promise<void> {
    await ensureDir(dirname(this.jsonlPath));
    await ensureDir(this.backupDir);
    await ensureDir(this.lockDir);
    
    await this.loadFromDisk();
    this.isLoaded = true;
    
    console.log(`[IncidentFileRepository] Initialized with ${this.incidents.size} incidents`);
  }

  /**
   * Load incidents from disk
   */
  async loadFromDisk(): Promise<void> {
    const snapshotExists = await fileExists(this.snapshotPath);
    const jsonlExists = await fileExists(this.jsonlPath);
    
    if (snapshotExists) {
      // Load from snapshot + incremental replay
      await this.loadFromSnapshot();
      if (jsonlExists) {
        await this.replayIncrementalEvents();
      }
    } else if (jsonlExists) {
      // Load from jsonl only
      await this.replayAllEvents();
    }
    
    // Create initial snapshot if needed
    if (this.incidents.size > 0 && !snapshotExists) {
      await this.createSnapshot();
    }
  }

  /**
   * Load from snapshot
   */
  private async loadFromSnapshot(): Promise<void> {
    try {
      const content = await fs.readFile(this.snapshotPath, 'utf-8');
      const snapshot: IncidentSnapshot = JSON.parse(content);
      
      this.incidents.clear();
      for (const [id, incident] of Object.entries(snapshot.incidents)) {
        this.incidents.set(id, incident);
      }
      
      this.lastSnapshotAt = snapshot.snapshot_at;
      console.log(`[IncidentFileRepository] Loaded ${this.incidents.size} incidents from snapshot`);
    } catch (error) {
      console.warn(`[IncidentFileRepository] Snapshot load failed, falling back to jsonl: ${error}`);
      this.incidents.clear();
    }
  }

  /**
   * Replay incremental events since snapshot
   */
  private async replayIncrementalEvents(): Promise<void> {
    const lines = await this.readJsonlLines();
    let replayed = 0;
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      try {
        const event: IncidentEvent = JSON.parse(line);
        
        // Skip events before snapshot
        if (event.timestamp <= this.lastSnapshotAt) continue;
        
        await this.applyEvent(event);
        replayed++;
      } catch (error) {
        console.warn(`[IncidentFileRepository] Failed to parse event line: ${error}`);
      }
    }
    
    if (replayed > 0) {
      console.log(`[IncidentFileRepository] Replayed ${replayed} incremental events`);
    }
  }

  /**
   * Replay all events from jsonl
   */
  private async replayAllEvents(): Promise<void> {
    const lines = await this.readJsonlLines();
    let replayed = 0;
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      try {
        const event: IncidentEvent = JSON.parse(line);
        await this.applyEvent(event);
        replayed++;
      } catch (error) {
        console.warn(`[IncidentFileRepository] Failed to parse event line: ${error}`);
      }
    }
    
    console.log(`[IncidentFileRepository] Replayed ${replayed} events from jsonl`);
  }

  /**
   * Read jsonl lines
   */
  private async readJsonlLines(): Promise<string[]> {
    try {
      const content = await fs.readFile(this.jsonlPath, 'utf-8');
      return content.split('\n');
    } catch {
      return [];
    }
  }

  /**
   * Apply event to in-memory state
   */
  private async applyEvent(event: IncidentEvent): Promise<void> {
    if (event.type === 'incident_created') {
      const incident = event.data as Incident;
      this.incidents.set(event.id, incident);
    } else if (event.type === 'incident_updated') {
      const incident = this.incidents.get(event.id);
      if (incident) {
        const update = event.data as IncidentUpdateRequest;
        Object.assign(incident, update);
        incident.updated_at = event.timestamp;
        this.incidents.set(event.id, incident);
      }
    }
  }

  // ==================== Write Operations ====================

  /**
   * Create incident (with file lock)
   */
  async create(incident: Incident): Promise<void> {
    const fileLock = getFileLock();
    await fileLock.withLock('incidents', async () => {
      const event: IncidentEvent = {
        type: 'incident_created',
        id: incident.id,
        timestamp: incident.created_at,
        data: incident,
      };
      
      await this.appendEvent(event);
      this.incidents.set(incident.id, incident);
      
      // Maybe create snapshot
      await this.maybeCreateSnapshot();
    });
  }

  /**
   * Update incident (with file lock)
   */
  async update(incident_id: string, update: IncidentUpdateRequest): Promise<Incident | undefined> {
    const fileLock = getFileLock();
    return await fileLock.withLock('incidents', async () => {
      const incident = this.incidents.get(incident_id);
      if (!incident) {
        return undefined;
      }
      
      const now = Date.now();
      const event: IncidentEvent = {
        type: 'incident_updated',
        id: incident_id,
        timestamp: now,
        data: { ...update, updated_at: now },
      };
      
      await this.appendEvent(event);
      
      // Apply update
      if (update.status) {
        incident.status = update.status;
        if (update.status === 'resolved' || update.status === 'closed') {
          incident.resolved_at = now;
          incident.resolved_by = update.updated_by;
        }
      }
      if (update.description) incident.description = update.description;
      if (update.related_incidents) incident.related_incidents = update.related_incidents;
      if (update.metadata) incident.metadata = { ...incident.metadata, ...update.metadata };
      
      incident.updated_at = now;
      incident.updated_by = update.updated_by;
      
      this.incidents.set(incident_id, incident);
      
      // Maybe create snapshot
      await this.maybeCreateSnapshot();
      
      return incident;
    });
  }

  /**
   * Append event to jsonl
   */
  private async appendEvent(event: IncidentEvent): Promise<void> {
    const line = JSON.stringify(event) + '\n';
    await fs.appendFile(this.jsonlPath, line, 'utf-8');
  }

  /**
   * Create snapshot
   */
  async createSnapshot(): Promise<void> {
    const snapshot: IncidentSnapshot = {
      snapshot_at: Date.now(),
      incidents: Object.fromEntries(this.incidents.entries()),
    };
    
    // Backup old snapshot
    await this.backupSnapshot();
    
    // Write new snapshot
    const tempPath = this.snapshotPath + '.tmp';
    await fs.writeFile(tempPath, JSON.stringify(snapshot, null, 2), 'utf-8');
    await fs.rename(tempPath, this.snapshotPath);
    
    this.lastSnapshotAt = snapshot.snapshot_at;
    console.log(`[IncidentFileRepository] Created snapshot with ${this.incidents.size} incidents`);
  }

  /**
   * Backup old snapshot
   */
  private async backupSnapshot(): Promise<void> {
    const exists = await fileExists(this.snapshotPath);
    if (!exists) return;
    
    const timestamp = Date.now();
    const backupPath = join(this.backupDir, `incidents_snapshot_${timestamp}.json`);
    await fs.copyFile(this.snapshotPath, backupPath);
    
    // Cleanup old backups
    await this.cleanupBackups();
  }

  /**
   * Cleanup old backups
   */
  private async cleanupBackups(): Promise<void> {
    try {
      const files = await fs.readdir(this.backupDir);
      const snapshots = files
        .filter(f => f.startsWith('incidents_snapshot_') && f.endsWith('.json'))
        .sort()
        .reverse();
      
      // Keep only N most recent
      const toDelete = snapshots.slice(this.config.backupCount);
      for (const file of toDelete) {
        await fs.unlink(join(this.backupDir, file));
      }
    } catch (error) {
      console.warn(`[IncidentFileRepository] Backup cleanup failed: ${error}`);
    }
  }

  /**
   * Maybe create snapshot
   */
  private async maybeCreateSnapshot(): Promise<void> {
    const now = Date.now();
    if (now - this.lastSnapshotAt > this.config.snapshotIntervalMs) {
      await this.createSnapshot();
    }
  }

  // ==================== Read Operations ====================

  /**
   * Get incident by ID
   */
  getById(incident_id: string): Incident | undefined {
    return this.incidents.get(incident_id);
  }

  /**
   * Query incidents
   */
  query(filters: IncidentQuery): Incident[] {
    let results = Array.from(this.incidents.values());
    
    if (filters.status) {
      results = results.filter(i => i.status === filters.status);
    }
    if (filters.type) {
      results = results.filter(i => i.type === filters.type);
    }
    if (filters.severity) {
      results = results.filter(i => i.severity === filters.severity);
    }
    if (filters.correlation_id) {
      results = results.filter(i => i.correlation_id === filters.correlation_id);
    }
    if (filters.limit) {
      results = results.slice(0, filters.limit);
    }
    
    return results;
  }

  /**
   * Get all incidents
   */
  getAll(): Incident[] {
    return Array.from(this.incidents.values());
  }

  // ==================== Maintenance ====================

  /**
   * Repair corrupted data
   */
  async repair(): Promise<number> {
    const lines = await this.readJsonlLines();
    let repaired = 0;
    const validLines: string[] = [];
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      try {
        JSON.parse(line);
        validLines.push(line);
      } catch {
        repaired++;
        console.warn(`[IncidentFileRepository] Skipped corrupted line`);
      }
    }
    
    if (repaired > 0) {
      await fs.writeFile(this.jsonlPath, validLines.join('\n') + '\n', 'utf-8');
      console.log(`[IncidentFileRepository] Repaired ${repaired} corrupted lines`);
    }
    
    return repaired;
  }

  /**
   * Get statistics
   */
  getStats(): { total: number; by_status: Record<string, number> } {
    const by_status: Record<string, number> = {};
    for (const incident of this.incidents.values()) {
      by_status[incident.status] = (by_status[incident.status] || 0) + 1;
    }
    
    return {
      total: this.incidents.size,
      by_status,
    };
  }
}

// ==================== Singleton ====================

let instance: IncidentFileRepository | null = null;

export function getIncidentFileRepository(): IncidentFileRepository {
  if (!instance) {
    instance = new IncidentFileRepository();
  }
  return instance;
}
