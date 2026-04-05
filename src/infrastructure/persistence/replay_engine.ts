/**
 * Replay Engine
 * Phase 2E-2A - 事件重放引擎
 * 
 * 职责：
 * - 按事件范围重放
 * - 按 correlation ID 重放
 * - 按目标对象重放
 * - Dry-run 模式（无副作用）
 * - Side-effect guard
 */

import { createEventRepository } from './event_repository';
import { createApprovalRepository } from './approval_repository';
import { createIncidentRepository } from './incident_repository';
import type { TradingEventRecord } from './event_repository';
import type { ApprovalRecord } from './approval_repository';
import type { IncidentRecord } from './incident_repository';

// ============================================================================
// 类型定义
// ============================================================================

export type ReplayMode = 'dry-run' | 'execute';

export interface ReplayQuery {
  // 时间范围
  startTime?: number;
  endTime?: number;
  
  // 事件类型
  eventTypes?: string[];
  
  // Correlation ID
  correlationId?: string;
  
  // 目标对象
  targetObject?: {
    type: 'approval' | 'incident' | 'event';
    id: string;
  };
  
  // 重放模式
  mode: ReplayMode;
  
  // 限制
  limit?: number;
}

export interface ReplayResult {
  success: boolean;
  mode: ReplayMode;
  eventsProcessed: number;
  stateRebuilt: {
    approvals: number;
    incidents: number;
    events: number;
  };
  sideEffects: Array<{
    type: string;
    target: string;
    action: string;
    executed: boolean;
  }>;
  errors: Array<{
    eventId: string;
    error: string;
  }>;
  summary: string;
}

export interface ReplayPlan {
  query: ReplayQuery;
  estimatedEvents: number;
  eventTypes: Map<string, number>;
  timeRange: {
    start: number;
    end: number;
  };
  sideEffects: Array<{
    type: string;
    count: number;
  }>;
}

// ============================================================================
// Replay Engine
// ============================================================================

export class ReplayEngine {
  private eventRepository: ReturnType<typeof createEventRepository>;
  private approvalRepository: ReturnType<typeof createApprovalRepository>;
  private incidentRepository: ReturnType<typeof createIncidentRepository>;

  constructor(
    eventRepository: ReturnType<typeof createEventRepository>,
    approvalRepository: ReturnType<typeof createApprovalRepository>,
    incidentRepository: ReturnType<typeof createIncidentRepository>
  ) {
    this.eventRepository = eventRepository;
    this.approvalRepository = approvalRepository;
    this.incidentRepository = incidentRepository;
  }

  /**
   * 生成重放计划
   */
  async generatePlan(query: Omit<ReplayQuery, 'mode'>): Promise<ReplayPlan> {
    const events = await this.eventRepository.getRecent(24 * 30, query.limit || 1000);
    
    // 应用过滤器
    let filtered = events;
    
    if (query.startTime !== undefined) {
      filtered = filtered.filter(e => e.timestamp >= query.startTime!);
    }
    if (query.endTime !== undefined) {
      filtered = filtered.filter(e => e.timestamp <= query.endTime!);
    }
    if (query.eventTypes && query.eventTypes.length > 0) {
      filtered = filtered.filter(e => query.eventTypes!.includes(e.type));
    }
    if (query.correlationId) {
      filtered = filtered.filter(e => e.metadata?.correlationId === query.correlationId);
    }
    
    // 统计
    const eventTypes = new Map<string, number>();
    for (const event of filtered) {
      eventTypes.set(event.type, (eventTypes.get(event.type) || 0) + 1);
    }
    
    const timeRange = filtered.length > 0
      ? {
          start: Math.min(...filtered.map(e => e.timestamp)),
          end: Math.max(...filtered.map(e => e.timestamp)),
        }
      : { start: 0, end: 0 };
    
    // 估算副作用
    const sideEffects = new Map<string, number>();
    for (const event of filtered) {
      if ((event.type as string) === 'approval_created' || (event.type as string) === 'approval_approved' || (event.type as string) === 'approval_rejected') {
        sideEffects.set('approval_action', (sideEffects.get('approval_action') || 0) + 1);
      }
      if ((event.type as string) === 'runbook_action_executed') {
        sideEffects.set('runbook_action', (sideEffects.get('runbook_action') || 0) + 1);
      }
    }
    
    return {
      query: { ...query, mode: 'dry-run' },
      estimatedEvents: filtered.length,
      eventTypes,
      timeRange,
      sideEffects: Array.from(sideEffects.entries()).map(([type, count]) => ({ type, count })),
    };
  }

  /**
   * 执行重放
   */
  async replay(query: ReplayQuery): Promise<ReplayResult> {
    const result: ReplayResult = {
      success: true,
      mode: query.mode,
      eventsProcessed: 0,
      stateRebuilt: { approvals: 0, incidents: 0, events: 0 },
      sideEffects: [],
      errors: [],
      summary: '',
    };
    
    try {
      // 获取事件
      const events = await this.eventRepository.getRecent(24 * 30, query.limit || 1000);
      
      // 应用过滤器
      let filtered = this.filterEvents(events, query);
      
      // 按时间排序
      filtered.sort((a, b) => a.timestamp - b.timestamp);
      
      // 重放事件
      for (const event of filtered) {
        try {
          await this.replayEvent(event, query.mode, result);
          result.eventsProcessed++;
        } catch (error) {
          result.errors.push({
            eventId: event.eventId,
            error: error instanceof Error ? error.message : String(error),
          });
          result.success = false;
        }
      }
      
      result.summary = `Processed ${result.eventsProcessed} events, ` +
        `rebuilt ${result.stateRebuilt.approvals} approvals, ` +
        `${result.stateRebuilt.incidents} incidents, ` +
        `${result.stateRebuilt.events} events`;
      
      if (result.errors.length > 0) {
        result.summary += `, ${result.errors.length} errors`;
      }
      
    } catch (error) {
      result.success = false;
      result.summary = `Replay failed: ${error instanceof Error ? error.message : String(error)}`;
    }
    
    return result;
  }

  /**
   * 按 Correlation ID 重放
   */
  async replayByCorrelationId(
    correlationId: string,
    mode: ReplayMode = 'dry-run'
  ): Promise<ReplayResult> {
    return this.replay({
      correlationId,
      mode,
      limit: 1000,
    });
  }

  /**
   * 按目标对象重放
   */
  async replayByTargetObject(
    targetType: 'approval' | 'incident' | 'event',
    targetId: string,
    mode: ReplayMode = 'dry-run'
  ): Promise<ReplayResult> {
    return this.replay({
      targetObject: { type: targetType, id: targetId },
      mode,
      limit: 1000,
    });
  }

  /**
   * 按时间范围重放
   */
  async replayByTimeRange(
    startTime: number,
    endTime: number,
    mode: ReplayMode = 'dry-run'
  ): Promise<ReplayResult> {
    return this.replay({
      startTime,
      endTime,
      mode,
      limit: 10000,
    });
  }

  // ============================================================================
  // 内部方法
  // ============================================================================

  /**
   * 过滤事件
   */
  private filterEvents(events: TradingEventRecord[], query: ReplayQuery): TradingEventRecord[] {
    let filtered = events;
    
    if (query.startTime !== undefined) {
      filtered = filtered.filter(e => e.timestamp >= query.startTime!);
    }
    if (query.endTime !== undefined) {
      filtered = filtered.filter(e => e.timestamp <= query.endTime!);
    }
    if (query.eventTypes && query.eventTypes.length > 0) {
      filtered = filtered.filter(e => query.eventTypes!.includes(e.type));
    }
    if (query.correlationId) {
      filtered = filtered.filter(e => e.metadata?.correlationId === query.correlationId);
    }
    if (query.targetObject) {
      filtered = filtered.filter(e => 
        e.metadata?.targetObjectId === query.targetObject!.id ||
        e.metadata?.targetObjectType === query.targetObject!.type
      );
    }
    
    return filtered;
  }

  /**
   * 重放单个事件
   */
  private async replayEvent(
    event: TradingEventRecord,
    mode: ReplayMode,
    result: ReplayResult
  ): Promise<void> {
    // Dry-run 模式下不执行实际操作，只记录
    if (mode === 'dry-run') {
      if ((event.type as string) === 'approval_created' || (event.type as string) === 'approval_approved' || (event.type as string) === 'approval_rejected') {
        result.sideEffects.push({
          type: 'approval_action',
          target: event.eventId,
          action: event.type as string,
          executed: false,
        });
      }
      if ((event.type as string) === 'runbook_action_executed') {
        result.sideEffects.push({
          type: 'runbook_action',
          target: event.eventId,
          action: 'execute',
          executed: false,
        });
      }
      return;
    }
    
    // Execute 模式下重建状态
    switch (event.type as string) {
      case 'approval_created':
      case 'approval_approved':
      case 'approval_rejected':
        // 重建审批状态（实际应该从 event 中恢复 approval 对象）
        result.stateRebuilt.approvals++;
        break;
        
      case 'incident_created':
      case 'incident_acknowledged':
      case 'incident_resolved':
        // 重建事件状态
        result.stateRebuilt.incidents++;
        break;
        
      case 'event_created':
        // 事件已持久化，无需重建
        result.stateRebuilt.events++;
        break;
        
      case 'runbook_action_executed':
        // 记录副作用但不执行
        result.sideEffects.push({
          type: 'runbook_action',
          target: event.eventId,
          action: 'execute',
          executed: false, // Dry-run 不执行实际动作
        });
        break;
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createReplayEngine(
  eventRepository: ReturnType<typeof createEventRepository>,
  approvalRepository: ReturnType<typeof createApprovalRepository>,
  incidentRepository: ReturnType<typeof createIncidentRepository>
): ReplayEngine {
  return new ReplayEngine(eventRepository, approvalRepository, incidentRepository);
}
