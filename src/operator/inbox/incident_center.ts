/**
 * Incident Center
 * Phase 2A-2B - 事件中心聚合
 * 
 * 职责：
 * - 聚合 active incidents
 * - 聚合 ack-needed incidents
 * - 聚合 degraded services
 * - 输出 InboxItem 列表
 */

import type { InboxItem, InboxSeverity, InboxItemStatus } from '../types/inbox_types';
import type { IncidentDataSource } from '../data/incident_data_source';

// ============================================================================
// 配置
// ============================================================================

export interface IncidentCenterConfig {
  /** 返回数量限制 */
  limit?: number;
}

// ============================================================================
// 事件中心
// ============================================================================

export class IncidentCenter {
  private config: Required<IncidentCenterConfig>;
  private incidentDataSource: IncidentDataSource;
  
  constructor(
    incidentDataSource: IncidentDataSource,
    config: IncidentCenterConfig = {}
  ) {
    this.config = {
      limit: config.limit ?? 50,
    };
    
    this.incidentDataSource = incidentDataSource;
  }
  
  /**
   * 获取事件 Inbox 项
   */
  async getInboxItems(workspaceId?: string): Promise<InboxItem[]> {
    const [activeIncidents, degradedServices] = await Promise.all([
      this.incidentDataSource.getActiveIncidents(this.config.limit),
      this.incidentDataSource.getDegradedServices(10),
    ]);
    
    const now = Date.now();
    const items: InboxItem[] = [];
    
    // 活跃事件
    for (const incident of activeIncidents) {
      const severity = incident.severity as InboxSeverity;
      const ageMs = now - incident.createdAt;
      
      items.push({
        id: `incident_${incident.id}`,
        itemType: 'incident',
        sourceId: incident.id,
        workspaceId,
        title: `事件：${incident.type}`,
        summary: incident.description,
        severity,
        status: incident.acknowledged ? 'acknowledged' : 'active',
        owner: incident.relatedAgentId,
        createdAt: incident.createdAt,
        updatedAt: incident.updatedAt || now,
        ageMs,
        suggestedActions: incident.acknowledged
          ? ['request_recovery', 'request_replay', 'open']
          : ['ack_incident', 'request_recovery', 'open'],
        metadata: {
          type: incident.type,
          acknowledged: incident.acknowledged,
          relatedTaskId: incident.relatedTaskId,
          relatedAgentId: incident.relatedAgentId,
        },
      });
    }
    
    // 降级服务
    for (const service of degradedServices) {
      const ageMs = now - service.lastCheck;
      
      items.push({
        id: `service_${service.serverId}`,
        itemType: 'incident',
        sourceId: service.serverId,
        workspaceId,
        title: `服务降级：${service.serverId}`,
        summary: service.reason || `错误率：${(service.errorRate * 100).toFixed(2)}%`,
        severity: service.status === 'unavailable' ? 'critical' : 'high',
        status: service.status,
        createdAt: service.lastCheck - ageMs,
        updatedAt: service.lastCheck,
        ageMs,
        suggestedActions: ['request_recovery'],
        metadata: {
          serverId: service.serverId,
          status: service.status,
          errorRate: service.errorRate,
        },
      });
    }
    
    // 按严重级别排序
    return items.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      
      return (b.ageMs || 0) - (a.ageMs || 0);
    });
  }
  
  /**
   * 获取摘要
   */
  async getSummary(workspaceId?: string): Promise<{
    activeIncidents: number;
    unacknowledgedIncidents: number;
    degradedServices: number;
    criticalCount: number;
  }> {
    const incidentSummary = await this.incidentDataSource.getIncidentSummary();
    const degradedServices = await this.incidentDataSource.getDegradedServices();
    
    return {
      activeIncidents: incidentSummary.active,
      unacknowledgedIncidents: incidentSummary.unacknowledged,
      degradedServices: degradedServices.length,
      criticalCount: incidentSummary.critical,
    };
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createIncidentCenter(
  incidentDataSource: IncidentDataSource,
  config?: IncidentCenterConfig
): IncidentCenter {
  return new IncidentCenter(incidentDataSource, config);
}
