/**
 * Event Repository
 * Phase 2E-1 - 事件持久化存储
 * 
 * 职责：
 * - Trading 事件存储/加载
 * - 事件查询
 * - 事件统计
 */

import { createFilePersistenceStore, type PersistenceRepository } from './persistence_store';
import * as path from 'path';

// ============================================================================
// 类型定义
// ============================================================================

export type TradingEventType =
  | 'release_requested'
  | 'deployment_pending'
  | 'deployment_failed'
  | 'system_alert'
  | 'risk_breach'
  | 'execution_anomaly';

export type TradingSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface TradingEventRecord {
  eventId: string;
  type: TradingEventType;
  severity: TradingSeverity;
  source: {
    system: string;
    component: string;
    environment: string;
  };
  actor: {
    userId: string;
    username: string;
  };
  metadata: Record<string, any>;
  timestamp: number;
  processed: boolean;
  processedAt?: number;
  result?: {
    approvalCreated?: boolean;
    incidentCreated?: boolean;
    autoApproved?: boolean;
    ignored?: boolean;
  };
}

export interface EventQuery {
  type?: TradingEventType;
  severity?: TradingSeverity;
  source?: string;
  startTime?: number;
  endTime?: number;
  processed?: boolean;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Event Repository
// ============================================================================

export class EventRepository {
  private repository: PersistenceRepository<TradingEventRecord>;

  constructor(dataDir: string) {
    this.repository = createFilePersistenceStore<TradingEventRecord>(
      path.join(dataDir, 'events'),
      '.event.json'
    );
  }

  /**
   * 存储事件
   */
  async store(event: Omit<TradingEventRecord, 'processed'>): Promise<TradingEventRecord> {
    const record: TradingEventRecord = {
      ...event,
      processed: false,
    };

    await this.repository.save(record.eventId, record);
    return record;
  }

  /**
   * 标记事件已处理
   */
  async markProcessed(
    eventId: string,
    result?: TradingEventRecord['result']
  ): Promise<TradingEventRecord | null> {
    const record = await this.repository.load(eventId);
    if (!record) {
      return null;
    }

    record.processed = true;
    record.processedAt = Date.now();
    record.result = result;

    await this.repository.save(eventId, record);
    return record;
  }

  /**
   * 获取事件
   */
  async getById(eventId: string): Promise<TradingEventRecord | null> {
    return await this.repository.load(eventId);
  }

  /**
   * 查询事件
   */
  async query(query: EventQuery): Promise<{
    total: number;
    events: TradingEventRecord[];
  }> {
    const allEvents = await this.repository.list();

    // 应用过滤器
    let filtered = allEvents.filter((event) => {
      if (query.type && event.type !== query.type) {
        return false;
      }
      if (query.severity && event.severity !== query.severity) {
        return false;
      }
      if (query.source && event.source.system !== query.source) {
        return false;
      }
      if (query.startTime && event.timestamp < query.startTime) {
        return false;
      }
      if (query.endTime && event.timestamp > query.endTime) {
        return false;
      }
      if (query.processed !== undefined && event.processed !== query.processed) {
        return false;
      }
      return true;
    });

    // 按时间排序（最新的在前）
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    const total = filtered.length;
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    const events = filtered.slice(offset, offset + limit);

    return { total, events };
  }

  /**
   * 获取未处理事件
   */
  async getUnprocessed(limit: number = 100): Promise<TradingEventRecord[]> {
    const result = await this.query({ processed: false, limit });
    return result.events;
  }

  /**
   * 获取最近事件
   */
  async getRecent(hours: number = 24, limit: number = 100): Promise<TradingEventRecord[]> {
    const now = Date.now();
    const startTime = now - hours * 60 * 60 * 1000;
    const result = await this.query({ startTime, limit });
    return result.events;
  }

  /**
   * 获取事件统计
   */
  async getStats(timeRangeMs: number = 24 * 60 * 60 * 1000): Promise<{
    total: number;
    byType: Map<string, number>;
    bySeverity: Map<string, number>;
    bySource: Map<string, number>;
    processed: number;
    unprocessed: number;
  }> {
    const now = Date.now();
    const cutoff = now - timeRangeMs;
    const allEvents = await this.repository.list();

    const recentEvents = allEvents.filter((e) => e.timestamp >= cutoff);
    const byType = new Map<string, number>();
    const bySeverity = new Map<string, number>();
    const bySource = new Map<string, number>();
    let processedCount = 0;

    for (const event of recentEvents) {
      byType.set(event.type, (byType.get(event.type) || 0) + 1);
      bySeverity.set(event.severity, (bySeverity.get(event.severity) || 0) + 1);
      bySource.set(event.source.system, (bySource.get(event.source.system) || 0) + 1);
      if (event.processed) {
        processedCount++;
      }
    }

    return {
      total: recentEvents.length,
      byType,
      bySeverity,
      bySource,
      processed: processedCount,
      unprocessed: recentEvents.length - processedCount,
    };
  }

  /**
   * 删除事件
   */
  async delete(eventId: string): Promise<void> {
    await this.repository.delete(eventId);
  }

  /**
   * 清理旧事件
   */
  async cleanup(maxAgeDays: number = 30): Promise<number> {
    const now = Date.now();
    const cutoff = now - maxAgeDays * 24 * 60 * 60 * 1000;
    const allEvents = await this.repository.list();

    let deletedCount = 0;
    for (const event of allEvents) {
      if (event.timestamp < cutoff && event.processed) {
        await this.repository.delete(event.eventId);
        deletedCount++;
      }
    }

    return deletedCount;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createEventRepository(dataDir: string): EventRepository {
  return new EventRepository(dataDir);
}
