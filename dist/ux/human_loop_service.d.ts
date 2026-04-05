/**
 * Human Loop Service - 人机协同服务
 *
 * 职责：
 * 1. 统一编排入口
 * 2. 输入：dashboard snapshot + attention items + control surface actions + operator context
 * 3. 输出：intervention items + suggestions + workflow actions + confirmations + trail updates
 *
 * @version v0.1.0
 * @date 2026-04-04
 */
import type { DashboardSnapshot } from './dashboard_types';
import type { ControlSurfaceSnapshot } from './control_types';
import type { InterventionItem, OperatorSuggestion, ActionConfirmation, WorkflowState, InterventionTrailEntry, HumanLoopSnapshot, HumanLoopServiceConfig } from './hitl_types';
export declare class HumanLoopService {
    private config;
    private interventionEngine;
    private suggestionEngine;
    private confirmationManager;
    private approvalWorkflowBuilder;
    private incidentWorkflowBuilder;
    private trailManager;
    private interventions;
    private suggestions;
    private confirmations;
    private workflows;
    constructor(config?: HumanLoopServiceConfig);
    /**
     * 处理仪表盘快照
     */
    processDashboardSnapshot(dashboard: DashboardSnapshot): HumanLoopSnapshot;
    /**
     * 处理控制面快照
     */
    processControlSurfaceSnapshot(controlSnapshot: ControlSurfaceSnapshot): HumanLoopSnapshot;
    /**
     * 确认动作
     */
    confirmAction(actionId: string, actor: string): {
        success: boolean;
        confirmation?: ActionConfirmation;
        error?: string;
    };
    /**
     * 拒绝动作
     */
    rejectAction(actionId: string, actor: string): {
        success: boolean;
        confirmation?: ActionConfirmation;
        error?: string;
    };
    /**
     * 解决介入项
     */
    resolveIntervention(interventionId: string, actor: string, result: 'resolved' | 'dismissed' | 'escalated', note?: string): {
        success: boolean;
        intervention?: InterventionItem;
        error?: string;
    };
    /**
     * 获取介入项
     */
    getIntervention(interventionId: string): InterventionItem | undefined;
    /**
     * 获取所有开放介入项
     */
    getOpenInterventions(): InterventionItem[];
    /**
     * 获取建议
     */
    getSuggestions(): OperatorSuggestion[];
    /**
     * 获取待确认动作
     */
    getPendingConfirmations(): ActionConfirmation[];
    /**
     * 获取工作流
     */
    getWorkflows(): WorkflowState[];
    /**
     * 获取追踪记录
     */
    getTrail(limit?: number): InterventionTrailEntry[];
    /**
     * 构建人机协同快照
     */
    buildSnapshot(now: number): HumanLoopSnapshot;
}
/**
 * 创建人机协同服务
 */
export declare function createHumanLoopService(config?: HumanLoopServiceConfig): HumanLoopService;
/**
 * 快速处理仪表盘快照
 */
export declare function processDashboardSnapshot(dashboard: DashboardSnapshot, config?: HumanLoopServiceConfig): HumanLoopSnapshot;
