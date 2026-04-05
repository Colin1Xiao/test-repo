/**
 * Audit Log - 审计日志
 * 
 * 职责：
 * 1. 记录结构化审计事件
 * 2. 支持查询、过滤、时间范围检索
 * 3. 支持按 task / agent / server / skill / severity 检索
 * 4. 与 HookBus、TaskStore、ApprovalBridge、Automation runtime 对接
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type {
  AuditEvent,
  AuditQuery,
  AuditEventType,
  AuditEntityType,
  AuditSeverity,
} from './types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 审计日志配置
 */
export interface AuditLogConfig {
  /** 最大保留事件数 */
  maxEvents?: number;
  
  /** 最大保留时间（毫秒） */
  maxAgeMs?: number;
  
  /** 是否持久化 */
  enablePersistence?: boolean;
  
  /** 持久化路径 */
  persistPath?: string;
}

/**
 * 审计日志存储接口
 */
export interface IAuditLogStore {
  /**
   * 追加事件
   */
  append(event: AuditEvent): Promise<void>;
  
  /**
   * 查询事件
   */
  query(query: AuditQuery): Promise<AuditEvent[]>;
  
  /**
   * 获取任务审计轨迹
   */
  getTaskAuditTrail(taskId: string): Promise<AuditEvent[]>;
  
  /**
   * 获取实体审计轨迹
   */
  getEntityAuditTrail(entityType: AuditEntityType, entityId: string): Promise<AuditEvent[]>;
  
  /**
   * 构建审计摘要
   */
  buildAuditSummary(startTime: number, endTime: number): Promise<{
    totalEvents: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  }>;
}

// ============================================================================
// 审计日志实现
// ============================================================================

export class AuditLog implements IAuditLogStore {
  private config: Required<AuditLogConfig>;
  private events: AuditEvent[] = [];
  private eventIndex: Map<string, AuditEvent> = new Map();
  private taskIndex: Map<string, Set<string>> = new Map();
  private entityIndex: Map<string, Map<string, Set<string>>> = new Map();
  
  constructor(config: AuditLogConfig = {}) {
    this.config = {
      maxEvents: config.maxEvents ?? 10000,
      maxAgeMs: config.maxAgeMs ?? 7 * 24 * 60 * 60 * 1000, // 7 天
      enablePersistence: config.enablePersistence ?? false,
      persistPath: config.persistPath ?? './audit-log.json',
    };
    
    // 加载持久化数据
    if (this.config.enablePersistence) {
      this.loadFromPersistence();
    }
  }
  
  /**
   * 追加审计事件
   */
  async append(event: AuditEvent): Promise<void> {
    // 生成 ID
    if (!event.id) {
      event.id = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
    
    // 添加到事件列表
    this.events.push(event);
    this.eventIndex.set(event.id, event);
    
    // 更新索引
    this.updateIndexes(event);
    
    // 清理旧事件
    this.cleanupOldEvents();
    
    // 持久化
    if (this.config.enablePersistence) {
      this.saveToPersistence();
    }
  }
  
  /**
   * 查询审计事件
   */
  async query(query: AuditQuery): Promise<AuditEvent[]> {
    let results = [...this.events];
    
    // 时间范围过滤
    if (query.startTime) {
      results = results.filter(e => e.timestamp >= query.startTime);
    }
    if (query.endTime) {
      results = results.filter(e => e.timestamp <= query.endTime);
    }
    
    // 事件类型过滤
    if (query.eventType) {
      results = results.filter(e => e.eventType === query.eventType);
    }
    
    // 实体类型过滤
    if (query.entityType) {
      results = results.filter(e => e.entityType === query.entityType);
    }
    
    // 实体 ID 过滤
    if (query.entityId) {
      results = results.filter(e => e.entityId === query.entityId);
    }
    
    // 任务 ID 过滤
    if (query.taskId) {
      results = results.filter(e => e.taskId === query.taskId);
    }
    
    // Agent ID 过滤
    if (query.agentId) {
      results = results.filter(e => e.agentId === query.agentId);
    }
    
    // Server ID 过滤
    if (query.serverId) {
      results = results.filter(e => e.serverId === query.serverId);
    }
    
    // Skill 名称过滤
    if (query.skillName) {
      results = results.filter(e => e.skillName === query.skillName);
    }
    
    // 严重级别过滤
    if (query.severity) {
      results = results.filter(e => e.severity === query.severity);
    }
    
    // 分类过滤
    if (query.category) {
      results = results.filter(e => e.category === query.category);
    }
    
    // 排序（按时间倒序）
    results.sort((a, b) => b.timestamp - a.timestamp);
    
    // 限制数量
    if (query.limit) {
      results = results.slice(0, query.limit);
    }
    
    return results;
  }
  
  /**
   * 获取任务审计轨迹
   */
  async getTaskAuditTrail(taskId: string): Promise<AuditEvent[]> {
    const eventIds = this.taskIndex.get(taskId);
    
    if (!eventIds) {
      return [];
    }
    
    const events: AuditEvent[] = [];
    
    for (const eventId of eventIds) {
      const event = this.eventIndex.get(eventId);
      if (event) {
        events.push(event);
      }
    }
    
    // 按时间排序
    events.sort((a, b) => a.timestamp - b.timestamp);
    
    return events;
  }
  
  /**
   * 获取实体审计轨迹
   */
  async getEntityAuditTrail(
    entityType: AuditEntityType,
    entityId: string
  ): Promise<AuditEvent[]> {
    const typeIndex = this.entityIndex.get(entityType);
    
    if (!typeIndex) {
      return [];
    }
    
    const eventIds = typeIndex.get(entityId);
    
    if (!eventIds) {
      return [];
    }
    
    const events: AuditEvent[] = [];
    
    for (const eventId of eventIds) {
      const event = this.eventIndex.get(eventId);
      if (event) {
        events.push(event);
      }
    }
    
    // 按时间排序
    events.sort((a, b) => a.timestamp - b.timestamp);
    
    return events;
  }
  
  /**
   * 构建审计摘要
   */
  async buildAuditSummary(
    startTime?: number,
    endTime?: number
  ): Promise<{
    totalEvents: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  }> {
    const query: AuditQuery = {};
    
    if (startTime) {
      query.startTime = startTime;
    }
    if (endTime) {
      query.endTime = endTime;
    }
    
    const events = await this.query(query);
    
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    
    for (const event of events) {
      byType[event.eventType] = (byType[event.eventType] || 0) + 1;
      bySeverity[event.severity] = (bySeverity[event.severity] || 0) + 1;
    }
    
    return {
      totalEvents: events.length,
      byType,
      bySeverity,
    };
  }
  
  /**
   * 获取所有事件
   */
  getAllEvents(): AuditEvent[] {
    return [...this.events];
  }
  
  /**
   * 清空审计日志
   */
  clear(): void {
    this.events = [];
    this.eventIndex.clear();
    this.taskIndex.clear();
    this.entityIndex.clear();
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 更新索引
   */
  private updateIndexes(event: AuditEvent): void {
    // 任务索引
    if (event.taskId) {
      if (!this.taskIndex.has(event.taskId)) {
        this.taskIndex.set(event.taskId, new Set());
      }
      this.taskIndex.get(event.taskId)!.add(event.id);
    }
    
    // 实体索引
    if (!this.entityIndex.has(event.entityType)) {
      this.entityIndex.set(event.entityType, new Map());
    }
    
    const typeIndex = this.entityIndex.get(event.entityType)!;
    
    if (!typeIndex.has(event.entityId)) {
      typeIndex.set(event.entityId, new Set());
    }
    
    typeIndex.get(event.entityId)!.add(event.id);
  }
  
  /**
   * 清理旧事件
   */
  private cleanupOldEvents(): void {
    const now = Date.now();
    const maxAge = this.config.maxAgeMs;
    const maxEvents = this.config.maxEvents;
    
    // 按时间清理
    if (this.events.length > maxEvents) {
      const toRemove = this.events.slice(0, this.events.length - maxEvents);
      
      for (const event of toRemove) {
        this.eventIndex.delete(event.id);
        this.removeFromIndexes(event);
      }
      
      this.events = this.events.slice(this.events.length - maxEvents);
    }
    
    // 按年龄清理
    const cutoffTime = now - maxAge;
    const initialLength = this.events.length;
    
    this.events = this.events.filter(event => {
      if (event.timestamp < cutoffTime) {
        this.eventIndex.delete(event.id);
        this.removeFromIndexes(event);
        return false;
      }
      return true;
    });
  }
  
  /**
   * 从索引中移除事件
   */
  private removeFromIndexes(event: AuditEvent): void {
    // 任务索引
    if (event.taskId) {
      const taskEvents = this.taskIndex.get(event.taskId);
      if (taskEvents) {
        taskEvents.delete(event.id);
        if (taskEvents.size === 0) {
          this.taskIndex.delete(event.taskId);
        }
      }
    }
    
    // 实体索引
    const typeIndex = this.entityIndex.get(event.entityType);
    if (typeIndex) {
      const entityEvents = typeIndex.get(event.entityId);
      if (entityEvents) {
        entityEvents.delete(event.id);
        if (entityEvents.size === 0) {
          typeIndex.delete(event.entityId);
        }
      }
    }
  }
  
  /**
   * 加载持久化数据
   */
  private loadFromPersistence(): void {
    // 简化实现：实际应该从文件加载
    try {
      // const fs = require('fs');
      // const data = fs.readFileSync(this.config.persistPath, 'utf-8');
      // const events = JSON.parse(data);
      // for (const event of events) {
      //   this.append(event);
      // }
    } catch (error) {
      // 文件不存在或解析失败，忽略
    }
  }
  
  /**
   * 保存持久化数据
   */
  private saveToPersistence(): void {
    // 简化实现：实际应该保存到文件
    try {
      // const fs = require('fs');
      // const data = JSON.stringify(this.events, null, 2);
      // fs.writeFileSync(this.config.persistPath, data);
    } catch (error) {
      // 保存失败，忽略
    }
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建审计日志
 */
export function createAuditLog(config?: AuditLogConfig): AuditLog {
  return new AuditLog(config);
}

/**
 * 快速追加审计事件
 */
export async function appendAuditEvent(
  auditLog: AuditLog,
  event: Omit<AuditEvent, 'id' | 'timestamp'>
): Promise<void> {
  await auditLog.append({
    ...event,
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
  });
}
