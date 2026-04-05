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
export type ReplayMode = 'dry-run' | 'execute';
export interface ReplayQuery {
    startTime?: number;
    endTime?: number;
    eventTypes?: string[];
    correlationId?: string;
    targetObject?: {
        type: 'approval' | 'incident' | 'event';
        id: string;
    };
    mode: ReplayMode;
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
export declare class ReplayEngine {
    private eventRepository;
    private approvalRepository;
    private incidentRepository;
    constructor(eventRepository: ReturnType<typeof createEventRepository>, approvalRepository: ReturnType<typeof createApprovalRepository>, incidentRepository: ReturnType<typeof createIncidentRepository>);
    /**
     * 生成重放计划
     */
    generatePlan(query: Omit<ReplayQuery, 'mode'>): Promise<ReplayPlan>;
    /**
     * 执行重放
     */
    replay(query: ReplayQuery): Promise<ReplayResult>;
    /**
     * 按 Correlation ID 重放
     */
    replayByCorrelationId(correlationId: string, mode?: ReplayMode): Promise<ReplayResult>;
    /**
     * 按目标对象重放
     */
    replayByTargetObject(targetType: 'approval' | 'incident' | 'event', targetId: string, mode?: ReplayMode): Promise<ReplayResult>;
    /**
     * 按时间范围重放
     */
    replayByTimeRange(startTime: number, endTime: number, mode?: ReplayMode): Promise<ReplayResult>;
    /**
     * 过滤事件
     */
    private filterEvents;
    /**
     * 重放单个事件
     */
    private replayEvent;
}
export declare function createReplayEngine(eventRepository: ReturnType<typeof createEventRepository>, approvalRepository: ReturnType<typeof createApprovalRepository>, incidentRepository: ReturnType<typeof createIncidentRepository>): ReplayEngine;
