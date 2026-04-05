/**
 * Phase 4.x-A2-1: Instance Registry
 * 
 * 多实例协调基础：
 * - 节点级 instance_id + 会话级 session_id
 * - log + snapshot 混合持久化
 * - 心跳机制 (10s interval, 30s timeout, 10s grace)
 * - graceful vs fault 语义分离
 * - stale cleanup 只负责检测/标记/记录/暴露
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { randomUUID } from 'crypto';
import { hostname } from 'os';

// ==================== Types ====================

export interface InstanceIdentity {
  instance_id: string;      // 节点级 UUID (持久化，重启不变)
  session_id: string;       // 进程级 UUID (每次启动变化)
  instance_name: string;    // 可读名称
  node_info: {
    hostname: string;
    pid: number;
    started_at: number;
  };
  last_heartbeat: number;
  status: 'active' | 'inactive' | 'failed';
  metadata?: Record<string, unknown>;
}

export interface InstanceEvent {
  type: 'registered' | 'unregistered' | 'heartbeat' | 'stale_detected';
  instance_id: string;
  timestamp: number;
  data: Partial<InstanceIdentity> & Record<string, unknown>;
}

export interface HeartbeatConfig {
  interval_ms: number;
  timeout_ms: number;
  grace_period_ms: number;
  max_clock_drift_ms: number;
}

export interface InstanceRegistryConfig {
  dataDir: string;
  instanceIdFile: string;
  heartbeatConfig?: Partial<HeartbeatConfig>;
  autoHeartbeat?: boolean;  // Default: true, set false for testing
}

const DEFAULT_HEARTBEAT_CONFIG: HeartbeatConfig = {
  interval_ms: 10000,      // 10s
  timeout_ms: 30000,       // 30s (3x interval)
  grace_period_ms: 10000,  // 10s
  max_clock_drift_ms: 5000, // 5s
};

// ==================== Registry Implementation ====================

export class InstanceRegistry {
  private config: InstanceRegistryConfig;
  private heartbeatConfig: HeartbeatConfig;
  private autoHeartbeat: boolean;
  private identity: InstanceIdentity | null = null;
  private instances: Map<string, InstanceIdentity> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(config: InstanceRegistryConfig) {
    this.config = config;
    this.heartbeatConfig = {
      ...DEFAULT_HEARTBEAT_CONFIG,
      ...config.heartbeatConfig,
    };
    this.autoHeartbeat = config.autoHeartbeat ?? true;
  }

  async initialize(): Promise<void> {
    // Ensure data directory
    await fs.mkdir(dirname(this.config.instanceIdFile), { recursive: true });
    await fs.mkdir(join(this.config.dataDir, 'registry'), { recursive: true });

    // Load or create instance identity
    await this.loadOrCreateIdentity();

    // Load registry from snapshot + log
    await this.loadRegistry();

    // Register self
    await this.registerSelf();

    // Start heartbeat (if enabled)
    if (this.autoHeartbeat) {
      this.startHeartbeat();
    }
  }

  async shutdown(): Promise<void> {
    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Graceful unregister
    if (this.identity) {
      await this.unregister(this.identity.instance_id, 'shutdown');
    }
  }

  async getIdentity(): Promise<InstanceIdentity> {
    if (!this.identity) {
      throw new Error('InstanceRegistry not initialized');
    }
    return { ...this.identity };
  }

  async getInstance(instance_id: string): Promise<InstanceIdentity | null> {
    return this.instances.get(instance_id) || null;
  }

  async getActiveInstances(): Promise<InstanceIdentity[]> {
    const active: InstanceIdentity[] = [];
    for (const instance of this.instances.values()) {
      if (instance.status === 'active') {
        active.push({ ...instance });
      }
    }
    return active;
  }

  async getFailedInstances(threshold_ms?: number): Promise<InstanceIdentity[]> {
    const failed: InstanceIdentity[] = [];
    for (const instance of this.instances.values()) {
      if (instance.status === 'failed') {
        failed.push({ ...instance });
      }
    }
    return failed;
  }

  async heartbeat(instance_id: string): Promise<void> {
    const instance = this.instances.get(instance_id);
    if (!instance) {
      throw new Error(`Instance ${instance_id} not found`);
    }

    instance.last_heartbeat = Date.now();
    instance.status = 'active';

    // Log heartbeat event
    await this.logEvent({
      type: 'heartbeat',
      instance_id,
      timestamp: Date.now(),
      data: { last_heartbeat: instance.last_heartbeat },
    });
  }

  async unregister(instance_id: string, reason?: string): Promise<void> {
    const instance = this.instances.get(instance_id);
    if (!instance) {
      return;
    }

    instance.status = 'inactive';

    // Log unregistered event
    await this.logEvent({
      type: 'unregistered',
      instance_id,
      timestamp: Date.now(),
      data: { status: 'inactive', reason },
    });
  }

  async markFailed(instance_id: string): Promise<void> {
    const instance = this.instances.get(instance_id);
    if (!instance) {
      return;
    }

    instance.status = 'failed';
    
    // Update in map
    this.instances.set(instance_id, instance);

    // Log stale_detected event
    await this.logEvent({
      type: 'stale_detected',
      instance_id,
      timestamp: Date.now(),
      data: { status: 'failed' },
    });
  }

  async cleanupStaleInstances(): Promise<void> {
    const now = Date.now();
    const threshold = this.heartbeatConfig.timeout_ms + this.heartbeatConfig.grace_period_ms;

    for (const [instance_id, instance] of this.instances.entries()) {
      // Skip non-active instances
      if (instance.status !== 'active') {
        continue;
      }

      const elapsed = now - instance.last_heartbeat;
      if (elapsed > threshold) {
        await this.markFailed(instance_id);
      }
    }
  }

  // ==================== Private Methods ====================

  private async loadOrCreateIdentity(): Promise<void> {
    try {
      const content = await fs.readFile(this.config.instanceIdFile, 'utf-8');
      const saved = JSON.parse(content);

      // Load existing identity
      this.identity = {
        instance_id: saved.instance_id,
        session_id: randomUUID(), // New session
        instance_name: saved.instance_name || `worker-${hostname()}`,
        node_info: {
          hostname: hostname(),
          pid: process.pid,
          started_at: Date.now(),
        },
        last_heartbeat: Date.now(),
        status: 'active',
      };
    } catch (error) {
      // Create new identity
      this.identity = {
        instance_id: randomUUID(),
        session_id: randomUUID(),
        instance_name: `worker-${hostname()}`,
        node_info: {
          hostname: hostname(),
          pid: process.pid,
          started_at: Date.now(),
        },
        last_heartbeat: Date.now(),
        status: 'active',
      };

      // Save to file
      await fs.writeFile(
        this.config.instanceIdFile,
        JSON.stringify(
          {
            instance_id: this.identity.instance_id,
            instance_name: this.identity.instance_name,
            created_at: Date.now(),
          },
          null,
          2
        ),
        'utf-8'
      );
    }
  }

  private async registerSelf(): Promise<void> {
    if (!this.identity) return;

    // Update last_heartbeat on registration
    this.identity.last_heartbeat = Date.now();
    this.instances.set(this.identity.instance_id, { ...this.identity });

    // Log registered event
    await this.logEvent({
      type: 'registered',
      instance_id: this.identity.instance_id,
      timestamp: Date.now(),
      data: { ...this.identity },
    });
  }

  private async loadRegistry(): Promise<void> {
    const snapshotPath = join(this.config.dataDir, 'registry', 'instances_snapshot.json');
    const logPath = join(this.config.dataDir, 'registry', 'instances_log.jsonl');

    // Try load snapshot first
    try {
      const content = await fs.readFile(snapshotPath, 'utf-8');
      const snapshot = JSON.parse(content);

      this.instances.clear();
      for (const [id, instance] of Object.entries(snapshot.instances as any)) {
        this.instances.set(id, instance as InstanceIdentity);
      }
    } catch (error) {
      // Snapshot doesn't exist or corrupted, start fresh
      this.instances.clear();
    }

    // Replay log
    try {
      const content = await fs.readFile(logPath, 'utf-8');
      const lines = content.trim().split('\n').filter(l => l);

      for (const line of lines) {
        try {
          const event: InstanceEvent = JSON.parse(line);
          await this.applyEvent(event);
        } catch (error) {
          // Skip corrupted lines
          console.warn(`[InstanceRegistry] Skipping corrupted log line: ${error}`);
        }
      }
    } catch (error) {
      // Log doesn't exist, skip replay
    }
  }

  private async applyEvent(event: InstanceEvent): Promise<void> {
    const instance = this.instances.get(event.instance_id);

    switch (event.type) {
      case 'registered':
        if (event.data as any) {
          this.instances.set(event.instance_id, event.data as InstanceIdentity);
        }
        break;

      case 'heartbeat':
        if (instance) {
          instance.last_heartbeat = (event.data as any).last_heartbeat || Date.now();
          instance.status = 'active';
        }
        break;

      case 'unregistered':
        if (instance) {
          instance.status = 'inactive';
        }
        break;

      case 'stale_detected':
        if (instance) {
          instance.status = 'failed';
        }
        break;
    }
  }

  private async logEvent(event: InstanceEvent): Promise<void> {
    const logPath = join(this.config.dataDir, 'registry', 'instances_log.jsonl');
    const line = JSON.stringify(event) + '\n';
    await fs.appendFile(logPath, line, 'utf-8');
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      if (this.identity) {
        try {
          await this.heartbeat(this.identity.instance_id);
        } catch (error) {
          console.error(`[InstanceRegistry] Heartbeat failed: ${error}`);
        }
      }
    }, this.heartbeatConfig.interval_ms);
  }
}
