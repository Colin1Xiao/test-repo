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

import type {
  InterventionItem,
  GuidedAction,
  WorkflowState,
  WorkflowStep,
  OperatorSuggestion,
} from './hitl_types';

// ============================================================================
// 类型定义
// ============================================================================

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

// ============================================================================
// 审批工作流构建器
// ============================================================================

export class ApprovalWorkflowBuilder {
  /**
   * 构建审批工作流
   */
  buildApprovalWorkflow(
    intervention: InterventionItem,
    approvalId: string,
    approvalType: string,
    requester: string
  ): ApprovalWorkflowState {
    const now = Date.now();
    
    const steps: WorkflowStep[] = [
      {
        id: 'step_review',
        name: 'Review Request',
        description: 'Review the approval request details',
        completed: false,
      },
      {
        id: 'step_assess_risk',
        name: 'Assess Risk',
        description: 'Assess the risk and impact of this request',
        completed: false,
      },
      {
        id: 'step_decide',
        name: 'Make Decision',
        description: 'Approve, reject, or request more context',
        completed: false,
      },
    ];
    
    return {
      id: `approval_workflow_${approvalId}`,
      type: 'approval',
      currentStepId: 'step_review',
      steps,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      approvalId,
      approvalType,
      requester,
      summary: intervention.summary,
      riskSummary: this.generateRiskSummary(intervention),
      recommendedDecision: this.getRecommendedDecision(intervention),
      escalateTo: intervention.escalateTo,
    };
  }
  
  /**
   * 更新工作流步骤
   */
  updateWorkflowStep(
    workflow: ApprovalWorkflowState,
    stepId: string,
    completed: boolean,
    result?: string
  ): ApprovalWorkflowState {
    const updatedSteps = workflow.steps.map(step => {
      if (step.id === stepId) {
        return {
          ...step,
          completed,
          completedAt: completed ? Date.now() : undefined,
          result,
        };
      }
      return step;
    });
    
    // 确定当前步骤
    let currentStepId = workflow.currentStepId;
    let status = workflow.status;
    
    if (completed) {
      const currentIndex = updatedSteps.findIndex(s => s.id === stepId);
      const nextStep = updatedSteps[currentIndex + 1];
      
      if (nextStep) {
        currentStepId = nextStep.id;
      } else {
        status = 'completed';
      }
    }
    
    return {
      ...workflow,
      steps: updatedSteps,
      currentStepId,
      status,
      updatedAt: Date.now(),
    };
  }
  
  /**
   * 生成审批引导动作
   */
  generateGuidedActions(workflow: ApprovalWorkflowState): GuidedAction[] {
    const actions: GuidedAction[] = [];
    
    // 根据当前步骤生成动作
    if (workflow.currentStepId === 'step_review') {
      actions.push(
        {
          id: 'view_details',
          actionType: 'view_details',
          label: 'View Details',
          description: 'View full approval request details',
          recommended: true,
          requiresConfirmation: false,
          riskLevel: 'low',
          expectedOutcome: 'Full request details will be displayed',
        } as GuidedAction,
        {
          id: 'request_context',
          actionType: 'request_context',
          label: 'Request More Context',
          description: 'Request additional information from requester',
          recommended: false,
          requiresConfirmation: false,
          riskLevel: 'low',
          expectedOutcome: 'Requester will be notified to provide more information',
        } as GuidedAction
      );
    }
    
    if (workflow.currentStepId === 'step_assess_risk' || workflow.currentStepId === 'step_decide') {
      actions.push(
        {
          id: 'approve',
          actionType: 'approve',
          label: 'Approve',
          description: 'Approve this request',
          recommended: workflow.recommendedDecision === 'approve',
          requiresConfirmation: true,
          riskLevel: 'low',
          expectedOutcome: 'Request will be approved and execution will continue',
        } as GuidedAction,
        {
          id: 'reject',
          actionType: 'reject',
          label: 'Reject',
          description: 'Reject this request',
          recommended: workflow.recommendedDecision === 'reject',
          requiresConfirmation: true,
          riskLevel: 'medium',
          expectedOutcome: 'Request will be rejected and related tasks may be cancelled',
        } as GuidedAction,
        {
          id: 'escalate',
          actionType: 'escalate',
          label: 'Escalate',
          description: 'Escalate to higher authority',
          recommended: false,
          requiresConfirmation: true,
          riskLevel: 'medium',
          expectedOutcome: 'Request will be escalated for higher-level review',
        } as GuidedAction
      );
    }
    
    return actions;
  }
  
  /**
   * 生成批量审批策略
   */
  generateBatchApprovalStrategy(
    interventions: InterventionItem[]
  ): {
    canBatch: boolean;
    batchSize: number;
    strategy: 'approve_all' | 'reject_all' | 'review_individual';
    reasoning: string;
  } {
    if (interventions.length === 0) {
      return {
        canBatch: false,
        batchSize: 0,
        strategy: 'review_individual',
        reasoning: 'No interventions to batch',
      };
    }
    
    // 检查是否可以批量处理
    const allSameType = interventions.every(i => i.sourceType === interventions[0].sourceType);
    const allLowRisk = interventions.every(i => i.severity === 'low' || i.severity === 'medium');
    
    if (allSameType && allLowRisk && interventions.length <= 10) {
      return {
        canBatch: true,
        batchSize: interventions.length,
        strategy: 'approve_all',
        reasoning: 'All interventions are same type and low risk, can be batch approved',
      };
    }
    
    return {
      canBatch: false,
      batchSize: 0,
      strategy: 'review_individual',
      reasoning: 'Interventions have mixed types or high risk, require individual review',
    };
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 生成风险摘要
   */
  private generateRiskSummary(intervention: InterventionItem): string {
    const riskMap: Record<string, string> = {
      low: 'Low risk: This approval has minimal impact.',
      medium: 'Medium risk: This approval may affect related tasks.',
      high: 'High risk: This approval may have significant impact.',
      critical: 'Critical risk: This approval requires careful consideration.',
    };
    
    return riskMap[intervention.severity] || 'Unknown risk level.';
  }
  
  /**
   * 获取推荐决策
   */
  private getRecommendedDecision(intervention: InterventionItem): 'approve' | 'reject' | 'request_context' {
    // 根据严重级别和原因生成推荐
    if (intervention.severity === 'critical') {
      return 'request_context';
    }
    
    if (intervention.reason.includes('timeout') || intervention.reason.includes('pending')) {
      return 'approve';
    }
    
    return 'request_context';
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建审批工作流构建器
 */
export function createApprovalWorkflowBuilder(): ApprovalWorkflowBuilder {
  return new ApprovalWorkflowBuilder();
}

/**
 * 快速构建审批工作流
 */
export function buildApprovalWorkflow(
  intervention: InterventionItem,
  approvalId: string,
  approvalType: string,
  requester: string
): ApprovalWorkflowState {
  const builder = new ApprovalWorkflowBuilder();
  return builder.buildApprovalWorkflow(intervention, approvalId, approvalType, requester);
}
