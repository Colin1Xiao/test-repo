/**
 * Approval Workflow - 审批工作流
 *
 * 职责：
 * 1. 做 guided approvals，不只是 approve/reject 按钮
 * 2. 支持审批摘要/风险说明/建议结论/升级审批/请求更多上下文/暂缓处理/批量审批策略
 *
 * @version v0.1.0
 * @date 2026-04-04
 */
import type { InterventionItem, GuidedAction, WorkflowState } from './hitl_types';
/**
 * 审批工作流状态
 */
export interface ApprovalWorkflowState extends WorkflowState {
    /** 审批 ID */
    approvalId: string;
    /** 审批类型 */
    approvalType: string;
    /** 请求者 */
    requester: string;
    /** 审批摘要 */
    summary: string;
    /** 风险说明 */
    riskSummary: string;
    /** 建议结论 */
    recommendedDecision: 'approve' | 'reject' | 'request_context';
    /** 升级目标（可选） */
    escalateTo?: string;
}
export declare class ApprovalWorkflowBuilder {
    /**
     * 构建审批工作流
     */
    buildApprovalWorkflow(intervention: InterventionItem, approvalId: string, approvalType: string, requester: string): ApprovalWorkflowState;
    /**
     * 更新工作流步骤
     */
    updateWorkflowStep(workflow: ApprovalWorkflowState, stepId: string, completed: boolean, result?: string): ApprovalWorkflowState;
    /**
     * 生成审批引导动作
     */
    generateGuidedActions(workflow: ApprovalWorkflowState): GuidedAction[];
    /**
     * 生成批量审批策略
     */
    generateBatchApprovalStrategy(interventions: InterventionItem[]): {
        canBatch: boolean;
        batchSize: number;
        strategy: 'approve_all' | 'reject_all' | 'review_individual';
        reasoning: string;
    };
    /**
     * 生成风险摘要
     */
    private generateRiskSummary;
    /**
     * 获取推荐决策
     */
    private getRecommendedDecision;
}
/**
 * 创建审批工作流构建器
 */
export declare function createApprovalWorkflowBuilder(): ApprovalWorkflowBuilder;
/**
 * 快速构建审批工作流
 */
export declare function buildApprovalWorkflow(intervention: InterventionItem, approvalId: string, approvalType: string, requester: string): ApprovalWorkflowState;
