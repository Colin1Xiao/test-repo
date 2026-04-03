/**
 * Incident Data Source
 * Phase 2A-1R′A - 真实事件数据源
 * 
 * 职责：
 * - 提供事件数据读取接口
 * - 支持 active incidents / degraded services 查询
 * - 支持按 ID 查询单个事件
 */

import type { Severity } from '../ux/control_types';

// ============================================================================
// 类型定义
// ============================================================================

export interface IncidentItem {
  /** 事件 ID */
  id: string;
  
  /** 事件类型 */
  type: string;
  
  /** 严重级别 */
  severity: Severity;
  
  /** 描述 */
  description: string;
  
  /** 创建时间 */
  createdAt: number;
  
  /** 更新时间 */
  updatedAt?: number;
  
  /** 是否已确认 */
  acknowledged: boolean;
  
  /** 确认者 */
  acknowledgedBy?: string;
  
  /** 确认时间 */
  acknowledgedAt?: number;
  
  /** 解决者 */
  resolvedBy?: string;
  
  /** 解决时间 */
  resolvedAt?: number;
  
  /** 解决原因 */
  resolution?: string;
  
  /** 关联任务 ID */
  relatedTaskId?: string;
  
  /** 关联 Agent ID */
  relatedAgentId?: string;
}

export interface DegradedService {
  /** Server ID */
  serverId: string;
  
  /** Server 状态 */
  status: 'healthy' | 'degraded' | 'unavailable';
  
  /** 错误率 */
  errorRate: number;
  
  /** 最后检查时间 */
  lastCheck: number;
  
  /** 降级原因 */
  reason?: string;
}

export interface ReplayHotspot {
  /** 任务 ID */
  taskId: string;
  
  /** 重放次数 */
  replayCount: number;
  
  /** 重放原因 */
  reason: string;
}

// ============================================================================
// 数据源接口
// ============================================================================

export interface IncidentDataSource {
  /**
   * 获取活跃事件列表
   */
  getActiveIncidents(limit?: number): Promise<IncidentItem[]>;
  
  /**
   * 获取未确认事件列表
   */
  getUnacknowledgedIncidents(limit?: number): Promise<IncidentItem[]>;
  
  /**
   * 按 ID 获取事件
   */
  getIncidentById(incidentId: string): Promise<IncidentItem | null>;
  
  /**
   * 获取降级服务列表
   */
  getDegradedServices(limit?: number): Promise<DegradedService[]>;
  
  /**
   * 获取重放热点
   */
  getReplayHotspots(limit?: number): Promise<ReplayHotspot[]>;
  
  /**
   * 获取事件统计
   */
  getIncidentSummary(): Promise<{
    total: number;
    active: number;
    acknowledged: number;
    unacknowledged: number;
    resolved: number;
    critical: number;
  }>;
}

// ============================================================================
// 配置
// ============================================================================

export interface IncidentDataSourceConfig {
  /** 默认返回数量限制 */
  defaultLimit?: number;
  
  /** 数据刷新间隔（毫秒） */
  refreshIntervalMs?: number;
}

// ============================================================================
// 内存实现（用于测试/降级）
// ============================================================================

export class InMemoryIncidentDataSource implements IncidentDataSource {
  private config: Required<IncidentDataSourceConfig>;
  private incidents: Map<string, IncidentItem> = new Map();
  private degradedServices: Map<string, DegradedService> = new Map();
  private replayHotspots: Map<string, ReplayHotspot> = new Map();
  
  constructor(config: IncidentDataSourceConfig = {}) {
    this.config = {
      defaultLimit: config.defaultLimit ?? 50,
      refreshIntervalMs: config.refreshIntervalMs ?? 30000,
    };
  }
  
  async getActiveIncidents(limit?: number): Promise<IncidentItem[]> {
    const allIncidents = Array.from(this.incidents.values());
    return allIncidents
      .filter(i => !i.resolvedAt)
      .sort((a, b) => {
        // 按严重级别和时间排序
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
        if (severityDiff !== 0) return severityDiff;
        return b.createdAt - a.createdAt;
      })
      .slice(0, limit ?? this.config.defaultLimit);
  }
  
  async getUnacknowledgedIncidents(limit?: number): Promise<IncidentItem[]> {
    const allIncidents = Array.from(this.incidents.values());
    return allIncidents
      .filter(i => !i.acknowledged && !i.resolvedAt)
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, limit ?? this.config.defaultLimit);
  }
  
  async getIncidentById(incidentId: string): Promise<IncidentItem | null> {
    return this.incidents.get(incidentId) || null;
  }
  
  async getDegradedServices(limit?: number): Promise<DegradedService[]> {
    const allServices = Array.from(this.degradedServices.values());
    return allServices
      .filter(s => s.status === 'degraded' || s.status === 'unavailable')
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, limit ?? this.config.defaultLimit);
  }
  
  async getReplayHotspots(limit?: number): Promise<ReplayHotspot[]> {
    const allHotspots = Array.from(this.replayHotspots.values());
    return allHotspots
      .sort((a, b) => b.replayCount - a.replayCount)
      .slice(0, limit ?? this.config.defaultLimit);
  }
  
  async getIncidentSummary(): Promise<{
    total: number;
    active: number;
    acknowledged: number;
    unacknowledged: number;
    resolved: number;
    critical: number;
  }> {
    const allIncidents = Array.from(this.incidents.values());
    
    return {
      total: this.incidents.size,
      active: allIncidents.filter(i => !i.resolvedAt).length,
      acknowledged: allIncidents.filter(i => i.acknowledged && !i.resolvedAt).length,
      unacknowledged: allIncidents.filter(i => !i.acknowledged && !i.resolvedAt).length,
      resolved: allIncidents.filter(i => i.resolvedAt).length,
      critical: allIncidents.filter(i => i.severity === 'critical' && !i.resolvedAt).length,
    };
  }
  
  // ============================================================================
  // 测试辅助方法
  // ============================================================================
  
  /**
   * 添加测试事件
   */
  addIncident(incident: IncidentItem): void {
    this.incidents.set(incident.id, incident);
  }
  
  /**
   * 确认事件
   */
  acknowledgeIncident(incidentId: string, actor?: string): boolean {
    const incident = this.incidents.get(incidentId);
    if (!incident) return false;
    
    incident.acknowledged = true;
    incident.acknowledgedBy = actor;
    incident.acknowledgedAt = Date.now();
    incident.updatedAt = Date.now();
    this.incidents.set(incidentId, incident);
    return true;
  }
  
  /**
   * 解决事件
   */
  resolveIncident(incidentId: string, actor?: string, resolution?: string): boolean {
    const incident = this.incidents.get(incidentId);
    if (!incident) return false;
    
    incident.acknowledged = true;
    incident.acknowledgedBy = actor;
    incident.acknowledgedAt = Date.now();
    incident.resolvedBy = actor;
    incident.resolvedAt = Date.now();
    incident.resolution = resolution;
    incident.updatedAt = Date.now();
    this.incidents.set(incidentId, incident);
    return true;
  }
  
  /**
   * 添加降级服务
   */
  addDegradedService(service: DegradedService): void {
    this.degradedServices.set(service.serverId, service);
  }
  
  /**
   * 添加重放热点
   */
  addReplayHotspot(hotspot: ReplayHotspot): void {
    this.replayHotspots.set(hotspot.taskId, hotspot);
  }
  
  /**
   * 清除所有数据
   */
  clear(): void {
    this.incidents.clear();
    this.degradedServices.clear();
    this.replayHotspots.clear();
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createIncidentDataSource(
  config?: IncidentDataSourceConfig
): IncidentDataSource {
  return new InMemoryIncidentDataSource(config);
}
