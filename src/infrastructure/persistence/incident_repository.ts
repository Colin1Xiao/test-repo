/**
 * Incident Repository
 * Phase 2E-1 - 事件持久化存储
 * 
 * 职责：
 * - 事件数据存储/加载
 * - 事件状态管理
 * - 事件历史查询
 */

import { createFilePersistenceStore, type PersistenceRepository } from './persistence_store';
import * as path from 'path';

// ============================================================================
// 类型定义
// ============================================================================

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface IncidentRecord {
  incidentId: string;
  type: string;
  severity: IncidentSeverity;
  description: string;
  status: 'active' | 'acknowledged' | 'resolved' | 'closed';
  metadata: {
    source: string;
    sourceType: string;
    sourceId: string;
    [key: string]: any;
  };
  createdAt: number;
  updatedAt: number;
  acknowledgedAt?: number;
  acknowledgedBy?: string;
  resolvedAt?: number;
  resolvedBy?: string;
  resolution?: string;
}

export interface IncidentQuery {
  status?: 'active' | 'acknowledged' | 'resolved' | 'closed';
  severity?: IncidentSeverity;
  source?: string;
  type?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Incident Repository
// ============================================================================

export class IncidentRepository {
  private repository: PersistenceRepository<IncidentRecord>;

  constructor(dataDir: string) {
    this.repository = createFilePersistenceStore<IncidentRecord>(
      path.join(dataDir, 'incidents'),
      '.incident.json'
    );
  }

  /**
   * 创建事件
   */
  async create(incident: Omit<IncidentRecord, 'createdAt' | 'updatedAt' | 'status'>): Promise<IncidentRecord> {
    const now = Date.now();
    const record: IncidentRecord = {
      ...incident,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    await this.repository.save(record.incidentId, record);
    return record;
  }

  /**
   * 获取事件
   */
  async getById(incidentId: string): Promise<IncidentRecord | null> {
    return await this.repository.load(incidentId);
  }

  /**
   * 更新事件状态
   */
  async updateStatus(
    incidentId: string,
    status: IncidentRecord['status'],
    userId?: string,
    resolution?: string
  ): Promise<IncidentRecord | null> {
    const record = await this.getById(incidentId);
    if (!record) {
      return null;
    }

    record.status = status;
    record.updatedAt = Date.now();

    if (status === 'acknowledged') {
      record.acknowledgedAt = Date.now();
      record.acknowledgedBy = userId;
    } else if (status === 'resolved') {
      record.resolvedAt = Date.now();
      record.resolvedBy = userId;
      record.resolution = resolution;
    }

    await this.repository.save(incidentId, record);
    return record;
  }

  /**
   * 确认事件
   */
  async acknowledge(incidentId: string, userId?: string): Promise<IncidentRecord | null> {
    return this.updateStatus(incidentId, 'acknowledged', userId);
  }

  /**
   * 解决事件
   */
  async resolve(
    incidentId: string,
    userId?: string,
    resolution?: string
  ): Promise<IncidentRecord | null> {
    return this.updateStatus(incidentId, 'resolved', userId, resolution);
  }

  /**
   * 关闭事件
   */
  async close(incidentId: string): Promise<IncidentRecord | null> {
    return this.updateStatus(incidentId, 'closed');
  }

  /**
   * 查询事件
   */
  async query(query: IncidentQuery): Promise<{
    total: number;
    incidents: IncidentRecord[];
  }> {
    const allIncidents = await this.repository.list();

    // 应用过滤器
    let filtered = allIncidents.filter((incident) => {
      if (query.status && incident.status !== query.status) {
        return false;
      }
      if (query.severity && incident.severity !== query.severity) {
        return false;
      }
      if (query.source && incident.metadata.source !== query.source) {
        return false;
      }
      if (query.type && incident.type !== query.type) {
        return false;
      }
      return true;
    });

    // 按创建时间排序（最新的在前）
    filtered.sort((a, b) => b.createdAt - a.createdAt);

    const total = filtered.length;
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    const incidents = filtered.slice(offset, offset + limit);

    return { total, incidents };
  }

  /**
   * 获取活跃事件
   */
  async getActive(limit: number = 50): Promise<IncidentRecord[]> {
    const result = await this.query({ status: 'active', limit });
    return result.incidents;
  }

  /**
   * 获取未确认事件
   */
  async getUnacknowledged(limit: number = 50): Promise<IncidentRecord[]> {
    const result = await this.query({ status: 'active', limit });
    return result.incidents.filter((i) => !i.acknowledgedAt);
  }

  /**
   * 获取严重事件
   */
  async getCritical(limit: number = 50): Promise<IncidentRecord[]> {
    const result = await this.query({ severity: 'critical', limit });
    return result.incidents;
  }

  /**
   * 获取事件统计
   */
  async getStats(): Promise<{
    total: number;
    active: number;
    acknowledged: number;
    resolved: number;
    closed: number;
    critical: number;
  }> {
    const allIncidents = await this.repository.list();
    return {
      total: allIncidents.length,
      active: allIncidents.filter((i) => i.status === 'active').length,
      acknowledged: allIncidents.filter((i) => i.status === 'acknowledged').length,
      resolved: allIncidents.filter((i) => i.status === 'resolved').length,
      closed: allIncidents.filter((i) => i.status === 'closed').length,
      critical: allIncidents.filter((i) => i.severity === 'critical').length,
    };
  }

  /**
   * 删除事件
   */
  async delete(incidentId: string): Promise<void> {
    await this.repository.delete(incidentId);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createIncidentRepository(dataDir: string): IncidentRepository {
  return new IncidentRepository(dataDir);
}
