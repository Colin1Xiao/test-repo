/**
 * Phase 4.x-A2-3: Work Item Coordinator
 * 
 * 多实例协调基础 - 工作项协议：
 * - item_key + item_type 通用抽象
 * - 与 lease 1:1 绑定
 * - log + snapshot 混合持久化
 * - claim / renew / complete / fail / release
 * - 状态机 (pending/claimed/running/completed/failed/released)
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { randomUUID } from 'crypto';
import { LeaseManager } from './lease_manager.js';
import { InstanceRegistry } from './instance_registry.js';

// ==================== Types ====================

export type WorkItemState = 'pending' | 'claimed' | 'running' | 'completed' | 'failed' | 'released';

export interface WorkItemRecord {
  item_key: string;
  item_type: string;
  state: WorkItemState;
  owner_instance_id?: string;
  owner_session_id?: string;
  lease_key?: string;
  claimed_at?: number;
  updated_at: number;
  completed_at?: number;
  failed_at?: number;
  released_at?: number;
  version: number;
  metadata?: Record<string, unknown>;
}

export interface WorkItemEvent {
  type: 'item_created' | 'item_claimed' | 'item_renewed' | 'item_completed' | 'item_failed' | 'item_released';
  item_key: string;
  timestamp: number;
  data: Partial<WorkItemRecord> & Record<string, unknown>;
}

export interface ClaimWorkItemInput {
  item_key: string;
  item_type: string;
  owner_instance_id: string;
  owner_session_id: string;
  lease_ttl_ms?: number;
  metadata?: Record<string, unknown>;
}

export interface RenewWorkItemInput {
  item_key: string;
  owner_instance_id: string;
  owner_session_id: string;
  lease_ttl_ms?: number;
}

export interface CompleteWorkItemInput {
  item_key: string;
  owner_instance_id: string;
  owner_session_id: string;
  result?: unknown;
}

export interface FailWorkItemInput {
  item_key: string;
  owner_instance_id: string;
  owner_session_id: string;
  error: string;
  retryable?: boolean;
}

export interface ReleaseWorkItemInput {
  item_key: string;
  owner_instance_id: string;
  owner_session_id: string;
  reason?: string;
}

export type ClaimResult =
  | { success: true; item: WorkItemRecord }
  | { success: false; error: 'ALREADY_CLAIMED' | 'LEASE_CONFLICT' | 'INVALID_STATE'; message: string };

export type RenewResult =
  | { success: true; item: WorkItemRecord; lease: any }
  | { success: false; error: 'OWNER_MISMATCH' | 'LEASE_MISSING' | 'INVALID_STATE'; message: string };

export type CompleteResult =
  | { success: true; item: WorkItemRecord }
  | { success: false; error: 'INVALID_STATE' | 'OWNER_MISMATCH'; message: string };

export type FailResult =
  | { success: true; item: WorkItemRecord }
  | { success: false; error: 'INVALID_STATE' | 'OWNER_MISMATCH'; message: string };

export type ReleaseResult =
  | { success: true; item: WorkItemRecord; already_released?: boolean }
  | { success: false; error: 'INVALID_STATE' | 'OWNER_MISMATCH'; message: string };

export interface WorkItemConfig {
  default_lease_ttl_ms: number;
  max_lease_ttl_ms: number;
  auto_release_on_complete: boolean;
  auto_fail_on_lease_loss: boolean;
}

const DEFAULT_WORK_ITEM_CONFIG: WorkItemConfig = {
  default_lease_ttl_ms: 30000,        // 30s
  max_lease_ttl_ms: 300000,           // 5min
  auto_release_on_complete: true,
  auto_fail_on_lease_loss: true,
};

export interface WorkItemCoordinatorConfig {
  dataDir: string;
  leaseManager: LeaseManager;
  registry: InstanceRegistry;
  config?: Partial<WorkItemConfig>;
  autoCleanup?: boolean;
}

// ==================== WorkItemCoordinator Implementation ====================

export class WorkItemCoordinator {
  private config: WorkItemCoordinatorConfig;
  private itemConfig: WorkItemConfig;
  private leaseManager: LeaseManager;
  private registry: InstanceRegistry;
  private items: Map<string, WorkItemRecord> = new Map();

  constructor(config: WorkItemCoordinatorConfig) {
    this.config = config;
    this.itemConfig = {
      ...DEFAULT_WORK_ITEM_CONFIG,
      ...config.config,
    };
    this.leaseManager = config.leaseManager;
    this.registry = config.registry;
  }

  async initialize(): Promise<void> {
    // Ensure data directory
    await fs.mkdir(join(this.config.dataDir, 'work_items'), { recursive: true });

    // Load items from snapshot + log
    await this.loadItems();
  }

  async shutdown(): Promise<void> {
    // No cleanup needed for now
  }

  async claim(input: ClaimWorkItemInput): Promise<ClaimResult> {
    const existing = this.items.get(input.item_key);
    
    // Check state - only pending items can be claimed
    if (existing && existing.state !== 'pending') {
      // Terminal states return INVALID_STATE, active states return ALREADY_CLAIMED
      const isTerminal = existing.state === 'completed' || existing.state === 'failed' || existing.state === 'released';
      return {
        success: false,
        error: isTerminal ? 'INVALID_STATE' : 'ALREADY_CLAIMED',
        message: `Item is ${existing.state}, cannot claim`,
      };
    }

    // Acquire lease (1:1 binding)
    const leaseResult = await this.leaseManager.acquire({
      lease_key: input.item_key,
      lease_type: input.item_type,
      owner_instance_id: input.owner_instance_id,
      owner_session_id: input.owner_session_id,
      ttl_ms: input.lease_ttl_ms ?? this.itemConfig.default_lease_ttl_ms,
    });

    if (!leaseResult.success) {
      return {
        success: false,
        error: 'LEASE_CONFLICT',
        message: 'Failed to acquire lease',
      };
    }

    const now = Date.now();
    
    const item: WorkItemRecord = {
      item_key: input.item_key,
      item_type: input.item_type,
      state: 'claimed',
      owner_instance_id: input.owner_instance_id,
      owner_session_id: input.owner_session_id,
      lease_key: input.item_key,
      claimed_at: now,
      updated_at: now,
      version: 1,
      metadata: input.metadata,
    };

    this.items.set(input.item_key, item);

    // Log event
    await this.logEvent({
      type: 'item_claimed',
      item_key: input.item_key,
      timestamp: now,
      data: { ...item },
    });

    return { success: true, item };
  }

  async renew(input: RenewWorkItemInput): Promise<RenewResult> {
    const item = this.items.get(input.item_key);
    
    if (!item) {
      return {
        success: false,
        error: 'INVALID_STATE',
        message: `Item ${input.item_key} not found`,
      };
    }

    if (item.state !== 'claimed' && item.state !== 'running') {
      return {
        success: false,
        error: 'INVALID_STATE',
        message: `Item is ${item.state}, cannot renew`,
      };
    }

    if (item.owner_instance_id !== input.owner_instance_id || item.owner_session_id !== input.owner_session_id) {
      return {
        success: false,
        error: 'OWNER_MISMATCH',
        message: 'Not the owner of this item',
      };
    }

    // Renew lease
    const leaseResult = await this.leaseManager.renew({
      lease_key: input.item_key,
      owner_instance_id: input.owner_instance_id,
      owner_session_id: input.owner_session_id,
      ttl_ms: input.lease_ttl_ms,
    });

    if (!leaseResult.success) {
      return {
        success: false,
        error: 'LEASE_MISSING',
        message: 'Failed to renew lease',
      };
    }

    item.version++;
    item.updated_at = Date.now();

    // Log event
    await this.logEvent({
      type: 'item_renewed',
      item_key: input.item_key,
      timestamp: Date.now(),
      data: { ...item },
    });

    return { success: true, item, lease: leaseResult.lease };
  }

  async complete(input: CompleteWorkItemInput): Promise<CompleteResult> {
    const item = this.items.get(input.item_key);
    
    if (!item) {
      return {
        success: false,
        error: 'INVALID_STATE',
        message: `Item ${input.item_key} not found`,
      };
    }

    if (item.state !== 'claimed' && item.state !== 'running') {
      return {
        success: false,
        error: 'INVALID_STATE',
        message: `Item is ${item.state}, cannot complete`,
      };
    }

    if (item.owner_instance_id !== input.owner_instance_id || item.owner_session_id !== input.owner_session_id) {
      return {
        success: false,
        error: 'OWNER_MISMATCH',
        message: 'Not the owner of this item',
      };
    }

    item.state = 'completed';
    item.completed_at = Date.now();
    item.updated_at = Date.now();
    item.version++;

    // Release lease
    if (item.lease_key && item.owner_instance_id && item.owner_session_id) {
      await this.leaseManager.release({
        lease_key: item.lease_key,
        owner_instance_id: item.owner_instance_id,
        owner_session_id: item.owner_session_id,
      });
    }

    // Log event
    await this.logEvent({
      type: 'item_completed',
      item_key: input.item_key,
      timestamp: Date.now(),
      data: { ...item },
    });

    return { success: true, item };
  }

  async fail(input: FailWorkItemInput): Promise<FailResult> {
    const item = this.items.get(input.item_key);
    
    if (!item) {
      return {
        success: false,
        error: 'INVALID_STATE',
        message: `Item ${input.item_key} not found`,
      };
    }

    if (item.state !== 'claimed' && item.state !== 'running') {
      return {
        success: false,
        error: 'INVALID_STATE',
        message: `Item is ${item.state}, cannot fail`,
      };
    }

    if (item.owner_instance_id !== input.owner_instance_id || item.owner_session_id !== input.owner_session_id) {
      return {
        success: false,
        error: 'OWNER_MISMATCH',
        message: 'Not the owner of this item',
      };
    }

    item.state = 'failed';
    item.failed_at = Date.now();
    item.updated_at = Date.now();
    item.version++;
    item.metadata = {
      ...item.metadata,
      error: input.error,
      retryable: input.retryable ?? false,
    };

    // Release lease
    if (item.lease_key && item.owner_instance_id && item.owner_session_id) {
      await this.leaseManager.release({
        lease_key: item.lease_key,
        owner_instance_id: item.owner_instance_id,
        owner_session_id: item.owner_session_id,
      });
    }

    // Log event
    await this.logEvent({
      type: 'item_failed',
      item_key: input.item_key,
      timestamp: Date.now(),
      data: { ...item },
    });

    return { success: true, item };
  }

  async release(input: ReleaseWorkItemInput): Promise<ReleaseResult> {
    const item = this.items.get(input.item_key);
    
    if (!item) {
      return {
        success: false,
        error: 'INVALID_STATE',
        message: `Item ${input.item_key} not found`,
      };
    }

    if (item.state === 'completed' || item.state === 'failed') {
      return {
        success: false,
        error: 'INVALID_STATE',
        message: `Item is ${item.state}, cannot release`,
      };
    }

    if (item.owner_instance_id !== input.owner_instance_id || item.owner_session_id !== input.owner_session_id) {
      return {
        success: false,
        error: 'OWNER_MISMATCH',
        message: 'Not the owner of this item',
      };
    }

    if (item.state === 'released') {
      return {
        success: true,
        already_released: true,
        item,
      };
    }

    item.state = 'released';
    item.released_at = Date.now();
    item.updated_at = Date.now();
    item.version++;

    // Release lease
    if (item.lease_key && item.owner_instance_id && item.owner_session_id) {
      await this.leaseManager.release({
        lease_key: item.lease_key,
        owner_instance_id: item.owner_instance_id,
        owner_session_id: item.owner_session_id,
      });
    }

    // Log event
    await this.logEvent({
      type: 'item_released',
      item_key: input.item_key,
      timestamp: Date.now(),
      data: { ...item, reason: input.reason },
    });

    return { success: true, item };
  }

  async getItem(item_key: string): Promise<WorkItemRecord | null> {
    return this.items.get(item_key) || null;
  }

  async getActiveItems(): Promise<WorkItemRecord[]> {
    const active: WorkItemRecord[] = [];
    for (const item of this.items.values()) {
      if (item.state === 'claimed' || item.state === 'running') {
        active.push({ ...item });
      }
    }
    return active;
  }

  async getItemsByType(item_type: string): Promise<WorkItemRecord[]> {
    const items: WorkItemRecord[] = [];
    for (const item of this.items.values()) {
      if (item.item_type === item_type) {
        items.push({ ...item });
      }
    }
    return items;
  }

  async getItemsByOwner(instance_id: string): Promise<WorkItemRecord[]> {
    const items: WorkItemRecord[] = [];
    for (const item of this.items.values()) {
      if (item.owner_instance_id === instance_id) {
        items.push({ ...item });
      }
    }
    return items;
  }

  // ==================== Private Methods ====================

  private async loadItems(): Promise<void> {
    const snapshotPath = join(this.config.dataDir, 'work_items', 'work_items_snapshot.json');
    const logPath = join(this.config.dataDir, 'work_items', 'work_items_log.jsonl');

    // Try load snapshot first
    try {
      const content = await fs.readFile(snapshotPath, 'utf-8');
      const snapshot = JSON.parse(content);

      this.items.clear();
      for (const [key, item] of Object.entries(snapshot.items as any)) {
        this.items.set(key, item as WorkItemRecord);
      }
    } catch (error) {
      // Snapshot doesn't exist or corrupted, start fresh
      this.items.clear();
    }

    // Replay log
    try {
      const content = await fs.readFile(logPath, 'utf-8');
      const lines = content.trim().split('\n').filter(l => l);

      for (const line of lines) {
        try {
          const event: WorkItemEvent = JSON.parse(line);
          await this.applyEvent(event);
        } catch (error) {
          // Skip corrupted lines
          console.warn(`[WorkItemCoordinator] Skipping corrupted log line: ${error}`);
        }
      }
    } catch (error) {
      // Log doesn't exist, skip replay
    }
  }

  private async applyEvent(event: WorkItemEvent): Promise<void> {
    const item = this.items.get(event.item_key);

    switch (event.type) {
      case 'item_created':
      case 'item_claimed':
        if (event.data as any) {
          this.items.set(event.item_key, event.data as WorkItemRecord);
        }
        break;

      case 'item_renewed':
      case 'item_completed':
      case 'item_failed':
      case 'item_released':
        if (item) {
          Object.assign(item, event.data);
          this.items.set(event.item_key, item);
        }
        break;
    }
  }

  private async logEvent(event: WorkItemEvent): Promise<void> {
    const logPath = join(this.config.dataDir, 'work_items', 'work_items_log.jsonl');
    const line = JSON.stringify(event) + '\n';
    await fs.appendFile(logPath, line, 'utf-8');
  }
}
