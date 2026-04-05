/**
 * Phase 4.x-A2-2: Distributed Lease Manager
 * 
 * 多实例协调基础 - 分布式租约：
 * - lease_key + lease_type 通用抽象
 * - instance_id + session_id 双标识 owner 绑定
 * - log + snapshot 混合持久化
 * - acquire / renew / release / reclaim
 * - stale lease 检测与回收
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { randomUUID } from 'crypto';
import { InstanceRegistry } from './instance_registry.js';

// ==================== Types ====================

export interface LeaseRecord {
  lease_key: string;
  lease_type: string;
  owner_instance_id: string;
  owner_session_id: string;
  acquired_at: number;
  renewed_at: number;
  expires_at: number;
  version: number;
  status: 'active' | 'released' | 'expired' | 'reclaimed';
  metadata?: Record<string, unknown>;
}

export interface LeaseEvent {
  type: 'lease_acquired' | 'lease_renewed' | 'lease_released' | 'lease_expired' | 'lease_reclaimed';
  lease_key: string;
  timestamp: number;
  data: Partial<LeaseRecord> & Record<string, unknown>;
}

export interface AcquireLeaseInput {
  lease_key: string;
  lease_type: string;
  owner_instance_id: string;
  owner_session_id: string;
  ttl_ms?: number;
}

export interface RenewLeaseInput {
  lease_key: string;
  owner_instance_id: string;
  owner_session_id: string;
  ttl_ms?: number;
}

export interface ReleaseLeaseInput {
  lease_key: string;
  owner_instance_id: string;
  owner_session_id: string;
}

export interface ReclaimLeaseInput {
  lease_key: string;
  reclaimed_by_instance_id: string;
  reclaimed_by_session_id: string;
  reason?: string;
}

export type AcquireLeaseResult =
  | { success: true; lease: LeaseRecord }
  | { success: false; error: 'ALREADY_LEASED'; message: string; current_owner?: { instance_id: string; session_id: string } };

export type RenewLeaseResult =
  | { success: true; lease: LeaseRecord }
  | { success: false; error: 'NOT_OWNER' | 'EXPIRED' | 'NOT_FOUND'; message: string };

export type ReleaseLeaseResult =
  | { success: true; already_released?: boolean }
  | { success: false; error: 'NOT_OWNER' | 'NOT_FOUND'; message: string };

export type ReclaimLeaseResult =
  | { success: true; lease: LeaseRecord }
  | { success: false; error: 'NOT_STALE' | 'NOT_FOUND' | 'ALREADY_RECLAIMED'; message: string };

export interface LeaseConfig {
  default_ttl_ms: number;
  max_ttl_ms: number;
  renew_grace_period_ms: number;
  stale_cleanup_interval_ms: number;
}

const DEFAULT_LEASE_CONFIG: LeaseConfig = {
  default_ttl_ms: 30000,        // 30s
  max_ttl_ms: 300000,           // 5min
  renew_grace_period_ms: 5000,  // 5s
  stale_cleanup_interval_ms: 60000, // 60s
};

export interface LeaseManagerConfig {
  dataDir: string;
  registry: InstanceRegistry;
  config?: Partial<LeaseConfig>;
  autoCleanup?: boolean;
}

// ==================== LeaseManager Implementation ====================

export class LeaseManager {
  private config: LeaseManagerConfig;
  private leaseConfig: LeaseConfig;
  private registry: InstanceRegistry;
  private leases: Map<string, LeaseRecord> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: LeaseManagerConfig) {
    this.config = config;
    this.leaseConfig = {
      ...DEFAULT_LEASE_CONFIG,
      ...config.config,
    };
    this.registry = config.registry;
  }

  async initialize(): Promise<void> {
    // Ensure data directory
    await fs.mkdir(join(this.config.dataDir, 'leases'), { recursive: true });

    // Load leases from snapshot + log
    await this.loadLeases();

    // Start auto cleanup (if enabled)
    if (this.config.autoCleanup ?? true) {
      this.startAutoCleanup();
    }
  }

  async shutdown(): Promise<void> {
    // Stop cleanup
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  async acquire(input: AcquireLeaseInput): Promise<AcquireLeaseResult> {
    const existing = this.leases.get(input.lease_key);
    
    if (existing && existing.status === 'active') {
      return {
        success: false,
        error: 'ALREADY_LEASED',
        message: `Lease ${input.lease_key} is already leased`,
        current_owner: {
          instance_id: existing.owner_instance_id,
          session_id: existing.owner_session_id,
        },
      };
    }

    const now = Date.now();
    const ttl = input.ttl_ms ?? this.leaseConfig.default_ttl_ms;
    
    const lease: LeaseRecord = {
      lease_key: input.lease_key,
      lease_type: input.lease_type,
      owner_instance_id: input.owner_instance_id,
      owner_session_id: input.owner_session_id,
      acquired_at: now,
      renewed_at: now,
      expires_at: now + ttl,
      version: 1,
      status: 'active',
    };

    this.leases.set(input.lease_key, lease);

    // Log event
    await this.logEvent({
      type: 'lease_acquired',
      lease_key: input.lease_key,
      timestamp: now,
      data: { ...lease },
    });

    return { success: true, lease };
  }

  async renew(input: RenewLeaseInput): Promise<RenewLeaseResult> {
    const lease = this.leases.get(input.lease_key);
    
    if (!lease) {
      return {
        success: false,
        error: 'NOT_FOUND',
        message: `Lease ${input.lease_key} not found`,
      };
    }

    if (lease.owner_instance_id !== input.owner_instance_id || lease.owner_session_id !== input.owner_session_id) {
      return {
        success: false,
        error: 'NOT_OWNER',
        message: 'Not the owner of this lease',
      };
    }

    if (Date.now() > lease.expires_at) {
      return {
        success: false,
        error: 'EXPIRED',
        message: 'Lease has expired',
      };
    }

    const now = Date.now();
    const ttl = input.ttl_ms ?? (lease.expires_at - lease.acquired_at);
    
    lease.renewed_at = now;
    lease.expires_at = now + ttl;
    lease.version++;

    // Log event
    await this.logEvent({
      type: 'lease_renewed',
      lease_key: input.lease_key,
      timestamp: now,
      data: { ...lease },
    });

    return { success: true, lease };
  }

  async release(input: ReleaseLeaseInput): Promise<ReleaseLeaseResult> {
    const lease = this.leases.get(input.lease_key);
    
    if (!lease) {
      return {
        success: false,
        error: 'NOT_FOUND',
        message: `Lease ${input.lease_key} not found`,
      };
    }

    if (lease.owner_instance_id !== input.owner_instance_id || lease.owner_session_id !== input.owner_session_id) {
      return {
        success: false,
        error: 'NOT_OWNER',
        message: 'Not the owner of this lease',
      };
    }

    if (lease.status === 'released') {
      return {
        success: true,
        already_released: true,
      };
    }

    lease.status = 'released';

    // Log event
    await this.logEvent({
      type: 'lease_released',
      lease_key: input.lease_key,
      timestamp: Date.now(),
      data: { status: 'released' },
    });

    return { success: true };
  }

  async getLease(lease_key: string): Promise<LeaseRecord | null> {
    return this.leases.get(lease_key) || null;
  }

  async getActiveLeases(): Promise<LeaseRecord[]> {
    const active: LeaseRecord[] = [];
    for (const lease of this.leases.values()) {
      if (lease.status === 'active') {
        active.push({ ...lease });
      }
    }
    return active;
  }

  async getLeasesByOwner(instance_id: string): Promise<LeaseRecord[]> {
    const owned: LeaseRecord[] = [];
    for (const lease of this.leases.values()) {
      if (lease.owner_instance_id === instance_id) {
        owned.push({ ...lease });
      }
    }
    return owned;
  }

  async detectStaleLeases(now?: number): Promise<LeaseRecord[]> {
    const stale: LeaseRecord[] = [];
    const currentTime = now ?? Date.now();

    for (const lease of this.leases.values()) {
      if (lease.status !== 'active') {
        continue;
      }

      // Check if expired
      if (currentTime > lease.expires_at) {
        stale.push({ ...lease });
        continue;
      }

      // Check if owner is failed/inactive
      const owner = await this.registry.getInstance(lease.owner_instance_id);
      if (!owner || owner.status === 'failed' || owner.status === 'inactive') {
        stale.push({ ...lease });
      }
    }

    return stale;
  }

  async reclaimStaleLease(input: ReclaimLeaseInput): Promise<ReclaimLeaseResult> {
    const lease = this.leases.get(input.lease_key);
    
    if (!lease) {
      return {
        success: false,
        error: 'NOT_FOUND',
        message: `Lease ${input.lease_key} not found`,
      };
    }

    // Check if stale and determine reason
    const now = Date.now();
    let reason = input.reason;
    
    if (!reason) {
      // Auto-detect reason
      if (now > lease.expires_at) {
        reason = 'expired';
      } else {
        const owner = await this.registry.getInstance(lease.owner_instance_id);
        if (!owner || owner.status === 'failed') {
          reason = 'owner_failed';
        } else if (owner && owner.status === 'inactive') {
          reason = 'owner_inactive';
        } else {
          reason = 'stale';
        }
      }
    }

    // Check if stale
    const staleLeases = await this.detectStaleLeases();
    const isStale = staleLeases.some(l => l.lease_key === input.lease_key);
    
    if (!isStale) {
      return {
        success: false,
        error: 'NOT_STALE',
        message: 'Lease is not stale',
      };
    }

    // CAS check: lease status must still be 'active' (not already reclaimed)
    if (lease.status !== 'active') {
      return {
        success: false,
        error: 'ALREADY_RECLAIMED',
        message: 'Lease has already been reclaimed',
      };
    }

    const ttl = lease.expires_at - lease.acquired_at;
    
    const previousOwner = {
      instance_id: lease.owner_instance_id,
      session_id: lease.owner_session_id,
    };

    lease.owner_instance_id = input.reclaimed_by_instance_id;
    lease.owner_session_id = input.reclaimed_by_session_id;
    lease.acquired_at = now;
    lease.renewed_at = now;
    lease.expires_at = now + ttl;
    lease.version++;
    lease.status = 'reclaimed';

    // Log event
    await this.logEvent({
      type: 'lease_reclaimed',
      lease_key: input.lease_key,
      timestamp: now,
      data: {
        ...lease,
        reason,
        previous_owner: previousOwner,
      },
    });

    return { success: true, lease };
  }

  // ==================== Private Methods ====================

  private async loadLeases(): Promise<void> {
    const snapshotPath = join(this.config.dataDir, 'leases', 'leases_snapshot.json');
    const logPath = join(this.config.dataDir, 'leases', 'leases_log.jsonl');

    // Try load snapshot first
    try {
      const content = await fs.readFile(snapshotPath, 'utf-8');
      const snapshot = JSON.parse(content);

      this.leases.clear();
      for (const [key, lease] of Object.entries(snapshot.leases as any)) {
        this.leases.set(key, lease as LeaseRecord);
      }
    } catch (error) {
      // Snapshot doesn't exist or corrupted, start fresh
      this.leases.clear();
    }

    // Replay log
    try {
      const content = await fs.readFile(logPath, 'utf-8');
      const lines = content.trim().split('\n').filter(l => l);

      for (const line of lines) {
        try {
          const event: LeaseEvent = JSON.parse(line);
          await this.applyEvent(event);
        } catch (error) {
          // Skip corrupted lines
          console.warn(`[LeaseManager] Skipping corrupted log line: ${error}`);
        }
      }
    } catch (error) {
      // Log doesn't exist, skip replay
    }
  }

  private async applyEvent(event: LeaseEvent): Promise<void> {
    const lease = this.leases.get(event.lease_key);

    switch (event.type) {
      case 'lease_acquired':
        if (event.data as any) {
          this.leases.set(event.lease_key, event.data as LeaseRecord);
        }
        break;

      case 'lease_renewed':
        if (lease) {
          Object.assign(lease, event.data);
          this.leases.set(event.lease_key, lease);
        }
        break;

      case 'lease_released':
        if (lease) {
          lease.status = 'released';
          this.leases.set(event.lease_key, lease);
        }
        break;

      case 'lease_reclaimed':
        if (lease) {
          Object.assign(lease, event.data);
          this.leases.set(event.lease_key, lease);
        }
        break;
    }
  }

  private async logEvent(event: LeaseEvent): Promise<void> {
    const logPath = join(this.config.dataDir, 'leases', 'leases_log.jsonl');
    const line = JSON.stringify(event) + '\n';
    await fs.appendFile(logPath, line, 'utf-8');
  }

  private startAutoCleanup(): void {
    this.cleanupInterval = setInterval(async () => {
      try {
        const staleLeases = await this.detectStaleLeases();
        for (const lease of staleLeases) {
          console.log(`[LeaseManager] Auto-cleanup stale lease: ${lease.lease_key}`);
        }
      } catch (error) {
        console.error(`[LeaseManager] Auto-cleanup failed: ${error}`);
      }
    }, this.leaseConfig.stale_cleanup_interval_ms);
  }
}
