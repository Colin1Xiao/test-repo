/**
 * Incident Workflow - 事件工作流
 *
 * 职责：
 * 1. 定义 incident 的人工处理工作流
 * 2. 支持 ack / inspect / choose recovery option / request replay or recovery / escalate / resolve or keep open
 * 3. 关键是让 incident 处理成为有步骤、有上下文、有追踪的流程
 *
 * @version v0.1.0
 * @date 2026-04-04
 */
import type { InterventionItem, GuidedAction, WorkflowState } from './hitl_types';
/**
 * 事件工作流状态
 */
export interface IncidentWorkflowState extends WorkflowState {
    /** 事件 ID */
    incidentId: string;
    /** 事件类型 */
    incidentType: string;
    /** 事件摘要 */
    summary: string;
    /** 严重级别 */
    severity: 'low' | 'medium' | 'high' | 'critical';
    /** 已确认 */
    acknowledged: boolean;
    /** 确认者（可选） */
    acknowledgedBy?: string;
    /** 确认时间（可选） */
    acknowledgedAt?: number;
}
export declare class IncidentWorkflowBuilder {
    /**
     * 构建事件工作流
     */
    buildIncidentWorkflow(intervention: InterventionItem, incidentId: string, incidentType: string): IncidentWorkflowState;
    /**
     * 更新工作流步骤
     */
    updateWorkflowStep(workflow: IncidentWorkflowState, stepId: string, completed: boolean, result?: string): IncidentWorkflowState;
    /**
     * 生成事件引导动作
     */
    generateGuidedActions(workflow: IncidentWorkflowState): GuidedAction[];
    /**
     * 生成事件恢复选项
     */
    generateRecoveryOptions(workflow: IncidentWorkflowState): Array<{
        id: string;
        name: string;
        description: string;
        riskLevel: 'low' | 'medium' | 'high';
        estimatedTime: string;
        successRate: number;
    }>;
}
/**
 * 创建事件工作流构建器
 */
export declare function createIncidentWorkflowBuilder(): IncidentWorkflowBuilder;
/**
 * 快速构建事件工作流
 */
export declare function buildIncidentWorkflow(intervention: InterventionItem, incidentId: string, incidentType: string): IncidentWorkflowState;
