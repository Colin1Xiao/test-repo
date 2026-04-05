/**
 * Phase 4.x-A2-4: Duplicate Suppression Manager
 * 
 * 多实例协调基础 - 去重抑制：
 * - suppression_key = scope + action + correlation_id + fingerprint
 * - scope 差异化 TTL
 * - replay 安全模式
 * - log + snapshot 混合持久化
 */

import { promises as fs } from 'fs';
import { join } from 'path';

// ==================== Types ====================

export type SuppressionScope =
  | 'alert_ingest'
  | 'webhook_ingest'
  | 'incident_transition'
  | 'work_item_claim'
  | 'recovery_scan'
  | 'replay_run'
  | 'connector_sync'
  | 'global'
  | 'test'  // For testing
  | string; // Allow custom scopes

export type SuppressionDecision = 'ALLOWED' | 'SUPPRESSED' | 'INVALID_SCOPE' | 'ERROR';

export type SuppressionStatus = 'active' | 'expired' | 'released';

export interface SuppressionRecord {
  suppression_key: string;
  suppression_scope: string;
  action_type: string;
  correlation_id?: string;
  fingerprint?: string;
  first_seen_at: number;
  last_seen_at: number;
  expires_at: number;
  hit_count: number;
  status: SuppressionStatus;
  version: number;
  metadata?: Record<string, unknown>;
}

export interface SuppressionEvent {
  type: 'suppression_created' | 'suppression_hit' | 'suppression_expired' | 'suppression_released';
  suppression_key: string;
  timestamp: number;
  data: Partial<SuppressionRecord> & {
    hit_count?: number;
    reason?: string;
  };
}

export interface EvaluateSuppressionInput {
  suppression_scope: string;
  action_type: string;
  correlation_id?: string;
  fingerprint?: string;
  source?: string;
  replay_mode?: boolean;
}

export interface RecordSuppressionInput {
  suppression_key: string;
  suppression_scope: string;
  action_type: string;
  correlation_id?: string;
  fingerprint?: string;
  ttl_ms?: number;
  metadata?: Record<string, unknown>;
}

export interface SuppressionResult {
  decision: SuppressionDecision;
  reason: string;
  record?: SuppressionRecord;
  ttl_ms?: number;
  expires_at?: number;
}

export interface RecordSuppressionResult {
  success: boolean;
  record?: SuppressionRecord;
  error?: string;
}

export interface SuppressionConfig {
  default_ttl_ms: number;
  scope_ttls: Record<string, number>;
  max_ttl_ms: number;
  replay_safe_mode: boolean;
}

const DEFAULT_SUPPRESSION_CONFIG: SuppressionConfig = {
  default_ttl_ms: 24 * 60 * 60 * 1000,        // 24h
  scope_ttls: {
    'alert_ingest': 5 * 60 * 1000,            // 5min
    'webhook_ingest': 1 * 60 * 1000,          // 1min
    'incident_transition': 60 * 60 * 1000,    // 1h
    'work_item_claim': 30 * 60 * 1000,        // 30min
    'recovery_scan': 24 * 60 * 60 * 1000,     // 24h
    'replay_run': 7 * 24 * 60 * 60 * 1000,    // 7d
    'test': 500,                              // 500ms for testing
  },
  max_ttl_ms: 7 * 24 * 60 * 60 * 1000,        // 7d
  replay_safe_mode: true,
};

export interface DuplicateSuppressionManagerConfig {
  dataDir: string;
  config?: Partial<SuppressionConfig>;
  autoCleanup?: boolean;
}

// ==================== DuplicateSuppressionManager Implementation ====================

export class DuplicateSuppressionManager {
  private config: DuplicateSuppressionManagerConfig;
  private suppressionConfig: SuppressionConfig;
  private records: Map<string, SuppressionRecord> = new Map();

  constructor(config: DuplicateSuppressionManagerConfig) {
    this.config = config;
    this.suppressionConfig = {
      ...DEFAULT_SUPPRESSION_CONFIG,
      ...config.config,
    };
  }

  async initialize(): Promise<void> {
    // Ensure data directory
    await fs.mkdir(join(this.config.dataDir, 'suppression'), { recursive: true });

    // Load records from snapshot + log
    await this.loadRecords();
  }

  async shutdown(): Promise<void> {
    // Save final snapshot
    await this.saveSnapshot();
  }

  async evaluate(input: EvaluateSuppressionInput): Promise<SuppressionResult> {
    const now = Date.now();
    
    // Generate suppression key
    const suppressionKey = this.generateSuppressionKey(input);

    // Check if scope is valid (non-empty)
    if (!input.suppression_scope || input.suppression_scope.trim() === '') {
      return {
        decision: 'INVALID_SCOPE',
        reason: 'unknown_scope',
      };
    }

    // Check existing record
    const existing = this.records.get(suppressionKey);

    // Check if expired first (before replay mode check)
    if (existing && existing.status === 'active' && now > existing.expires_at) {
      // Mark as expired
      existing.status = 'expired';
      
      // Log event
      await this.logEvent({
        type: 'suppression_expired',
        suppression_key: suppressionKey,
        timestamp: now,
        data: { ...existing },
      });

      // Allow (window expired)
      const ttl = this.getTTL(input.suppression_scope);
      const newRecord: SuppressionRecord = {
        ...existing,
        status: 'active',
        first_seen_at: now,
        last_seen_at: now,
        expires_at: now + ttl,
        hit_count: 1,
        version: existing.version + 1,
      };

      this.records.set(suppressionKey, newRecord);

      return {
        decision: 'ALLOWED',
        reason: 'window_expired',
        record: newRecord,
        ttl_ms: ttl,
        expires_at: now + ttl,
      };
    }

    // Replay mode bypass (only if not expired)
    if (input.replay_mode && this.suppressionConfig.replay_safe_mode) {
      if (existing && existing.status === 'active') {
        return {
          decision: 'ALLOWED',
          reason: 'replay_safe',
          ttl_ms: this.getTTL(input.suppression_scope),
          expires_at: now + this.getTTL(input.suppression_scope),
        };
      }
    }

    // No existing record - first seen
    if (!existing) {
      const ttl = this.getTTL(input.suppression_scope);
      const expiresAt = now + ttl;

      const record: SuppressionRecord = {
        suppression_key: suppressionKey,
        suppression_scope: input.suppression_scope,
        action_type: input.action_type,
        correlation_id: input.correlation_id,
        fingerprint: input.fingerprint,
        first_seen_at: now,
        last_seen_at: now,
        expires_at: expiresAt,
        hit_count: 1,
        status: 'active',
        version: 1,
      };

      this.records.set(suppressionKey, record);

      // Log event
      await this.logEvent({
        type: 'suppression_created',
        suppression_key: suppressionKey,
        timestamp: now,
        data: { ...record },
      });

      return {
        decision: 'ALLOWED',
        reason: 'first_seen',
        record,
        ttl_ms: ttl,
        expires_at: expiresAt,
      };
    }

    // Check if expired
    if (existing.status === 'active' && now > existing.expires_at) {
      // Mark as expired
      existing.status = 'expired';
      
      // Log event
      await this.logEvent({
        type: 'suppression_expired',
        suppression_key: suppressionKey,
        timestamp: now,
        data: { ...existing },
      });

      // Allow (window expired)
      const ttl = this.getTTL(input.suppression_scope);
      const newRecord: SuppressionRecord = {
        ...existing,
        status: 'active',
        first_seen_at: now,
        last_seen_at: now,
        expires_at: now + ttl,
        hit_count: 1,
        version: existing.version + 1,
      };

      this.records.set(suppressionKey, newRecord);

      return {
        decision: 'ALLOWED',
        reason: 'window_expired',
        record: newRecord,
        ttl_ms: ttl,
        expires_at: now + ttl,
      };
    }

    // Duplicate - suppress
    existing.hit_count++;
    existing.last_seen_at = now;
    existing.version++;

    // Log event
    await this.logEvent({
      type: 'suppression_hit',
      suppression_key: suppressionKey,
      timestamp: now,
      data: { ...existing },
    });

    return {
      decision: 'SUPPRESSED',
      reason: 'duplicate',
      record: { ...existing },
    };
  }

  async record(input: RecordSuppressionInput): Promise<RecordSuppressionResult> {
    const now = Date.now();
    const ttl = input.ttl_ms ?? this.getTTL(input.suppression_scope);

    const record: SuppressionRecord = {
      suppression_key: input.suppression_key,
      suppression_scope: input.suppression_scope,
      action_type: input.action_type,
      correlation_id: input.correlation_id,
      fingerprint: input.fingerprint,
      first_seen_at: now,
      last_seen_at: now,
      expires_at: now + ttl,
      hit_count: 1,
      status: 'active',
      version: 1,
      metadata: input.metadata,
    };

    this.records.set(input.suppression_key, record);

    // Log event
    await this.logEvent({
      type: 'suppression_created',
      suppression_key: input.suppression_key,
      timestamp: now,
      data: { ...record },
    });

    return {
      success: true,
      record,
    };
  }

  async getRecord(key: string): Promise<SuppressionRecord | null> {
    return this.records.get(key) || null;
  }

  async getActiveRecords(scope?: string): Promise<SuppressionRecord[]> {
    const active: SuppressionRecord[] = [];
    for (const record of this.records.values()) {
      if (record.status === 'active') {
        if (scope && record.suppression_scope !== scope) {
          continue;
        }
        active.push({ ...record });
      }
    }
    return active;
  }

  async detectExpiredRecords(now?: number): Promise<SuppressionRecord[]> {
    const currentTime = now ?? Date.now();
    const expired: SuppressionRecord[] = [];
    
    for (const record of this.records.values()) {
      if (record.status === 'active' && currentTime > record.expires_at) {
        expired.push({ ...record });
      }
    }
    
    return expired;
  }

  async cleanupExpiredRecords(): Promise<void> {
    const expired = await this.detectExpiredRecords();
    
    for (const record of expired) {
      record.status = 'expired';
      this.records.delete(record.suppression_key);

      // Log event
      await this.logEvent({
        type: 'suppression_released',
        suppression_key: record.suppression_key,
        timestamp: Date.now(),
        data: { ...record },
      });
    }
  }

  async saveSnapshot(): Promise<void> {
    const snapshotPath = join(this.config.dataDir, 'suppression', 'suppression_snapshot.json');
    const snapshot = {
      records: Object.fromEntries(this.records),
      saved_at: Date.now(),
    };

    await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');
  }

  // ==================== Private Methods ====================

  private generateSuppressionKey(input: EvaluateSuppressionInput): string {
    const parts = [
      input.suppression_scope,
      input.action_type,
      input.correlation_id || '',
      input.fingerprint || '',
    ];
    return parts.filter(p => p).join(':');
  }

  private getTTL(scope: string): number {
    const scopeTTL = this.suppressionConfig.scope_ttls[scope];
    if (scopeTTL) {
      return Math.min(scopeTTL, this.suppressionConfig.max_ttl_ms);
    }
    return Math.min(this.suppressionConfig.default_ttl_ms, this.suppressionConfig.max_ttl_ms);
  }

  private async loadRecords(): Promise<void> {
    const snapshotPath = join(this.config.dataDir, 'suppression', 'suppression_snapshot.json');
    const logPath = join(this.config.dataDir, 'suppression', 'suppression_log.jsonl');

    // Try load snapshot first
    try {
      const content = await fs.readFile(snapshotPath, 'utf-8');
      const snapshot = JSON.parse(content);

      this.records.clear();
      for (const [key, record] of Object.entries(snapshot.records as any)) {
        this.records.set(key, record as SuppressionRecord);
      }
    } catch (error) {
      // Snapshot doesn't exist or corrupted, start fresh
      this.records.clear();
    }

    // Replay log
    try {
      const content = await fs.readFile(logPath, 'utf-8');
      const lines = content.trim().split('\n').filter(l => l);

      for (const line of lines) {
        try {
          const event: SuppressionEvent = JSON.parse(line);
          await this.applyEvent(event);
        } catch (error) {
          // Skip corrupted lines
          console.warn(`[DuplicateSuppressionManager] Skipping corrupted log line: ${error}`);
        }
      }
    } catch (error) {
      // Log doesn't exist, skip replay
    }
  }

  private async applyEvent(event: SuppressionEvent): Promise<void> {
    const record = this.records.get(event.suppression_key);

    switch (event.type) {
      case 'suppression_created':
        if (event.data as any) {
          this.records.set(event.suppression_key, event.data as SuppressionRecord);
        }
        break;

      case 'suppression_hit':
      case 'suppression_expired':
      case 'suppression_released':
        if (record) {
          Object.assign(record, event.data);
          this.records.set(event.suppression_key, record);
        }
        break;
    }
  }

  private async logEvent(event: SuppressionEvent): Promise<void> {
    const logPath = join(this.config.dataDir, 'suppression', 'suppression_log.jsonl');
    const line = JSON.stringify(event) + '\n';
    await fs.appendFile(logPath, line, 'utf-8');
  }
}
