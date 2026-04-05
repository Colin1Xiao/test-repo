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

import type {
  InterventionItem,
  GuidedAction,
  WorkflowState,
  WorkflowStep,
} from './hitl_types';

// ============================================================================
// 类型定义
// ============================================================================

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

// ============================================================================
// 事件工作流构建器
// ============================================================================

export class IncidentWorkflowBuilder {
  /**
   * 构建事件工作流
   */
  buildIncidentWorkflow(
    intervention: InterventionItem,
    incidentId: string,
    incidentType: string
  ): IncidentWorkflowState {
    const now = Date.now();
    
    const steps: WorkflowStep[] = [
      {
        id: 'step_ack',
        name: 'Acknowledge',
        description: 'Acknowledge the incident',
        completed: false,
      },
      {
        id: 'step_inspect',
        name: 'Inspect',
        description: 'Inspect incident details and logs',
        completed: false,
      },
      {
        id: 'step_recovery',
        name: 'Choose Recovery',
        description: 'Choose recovery option',
        completed: false,
      },
      {
        id: 'step_resolve',
        name: 'Resolve',
        description: 'Resolve or keep open',
        completed: false,
      },
    ];
    
    return {
      id: `incident_workflow_${incidentId}`,
      type: 'incident',
      currentStepId: 'step_ack',
      steps,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      incidentId,
      incidentType,
      summary: intervention.summary,
      severity: intervention.severity,
      acknowledged: false,
    };
  }
  
  /**
   * 更新工作流步骤
   */
  updateWorkflowStep(
    workflow: IncidentWorkflowState,
    stepId: string,
    completed: boolean,
    result?: string
  ): IncidentWorkflowState {
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
    let acknowledged = workflow.acknowledged;
    let acknowledgedBy: string | undefined;
    let acknowledgedAt: number | undefined;
    
    if (completed) {
      const currentIndex = updatedSteps.findIndex(s => s.id === stepId);
      const nextStep = updatedSteps[currentIndex + 1];
      
      if (nextStep) {
        currentStepId = nextStep.id;
      } else {
        status = 'completed';
      }
      
      // 如果是确认步骤
      if (stepId === 'step_ack') {
        acknowledged = true;
        acknowledgedBy = 'operator'; // 简化实现
        acknowledgedAt = Date.now();
      }
    }
    
    return {
      ...workflow,
      steps: updatedSteps,
      currentStepId,
      status,
      acknowledged,
      acknowledgedBy,
      acknowledgedAt,
      updatedAt: Date.now(),
    };
  }
  
  /**
   * 生成事件引导动作
   */
  generateGuidedActions(workflow: IncidentWorkflowState): GuidedAction[] {
    const actions: GuidedAction[] = [];
    
    // 根据当前步骤生成动作
    if (workflow.currentStepId === 'step_ack') {
      actions.push({
        id: 'acknowledge',
        actionType: 'ack_incident',
        label: 'Acknowledge Incident',
        description: 'Acknowledge this incident and take ownership',
        recommended: true,
        requiresConfirmation: false,
        riskLevel: 'low',
        expectedOutcome: 'Incident will be assigned to you',
      } as GuidedAction);
    }
    
    if (workflow.currentStepId === 'step_inspect') {
      actions.push(
        {
          id: 'view_details',
          actionType: 'view_details',
          label: 'View Details',
          description: 'View full incident details and logs',
          recommended: true,
          requiresConfirmation: false,
          riskLevel: 'low',
          expectedOutcome: 'Full incident details will be displayed',
        } as GuidedAction,
        {
          id: 'view_logs',
          actionType: 'view_logs',
          label: 'View Logs',
          description: 'View related logs and metrics',
          recommended: false,
          requiresConfirmation: false,
          riskLevel: 'low',
          expectedOutcome: 'Related logs and metrics will be displayed',
        } as GuidedAction
      );
    }
    
    if (workflow.currentStepId === 'step_recovery') {
      actions.push(
        {
          id: 'request_recovery',
          actionType: 'request_recovery',
          label: 'Request Recovery',
          description: 'Request automatic recovery',
          recommended: true,
          requiresConfirmation: true,
          riskLevel: 'low',
          expectedOutcome: 'System will attempt to recover automatically',
        } as GuidedAction,
        {
          id: 'request_replay',
          actionType: 'request_replay',
          label: 'Request Replay',
          description: 'Request task replay',
          recommended: false,
          requiresConfirmation: true,
          riskLevel: 'medium',
          expectedOutcome: 'Affected tasks will be replayed',
        } as GuidedAction,
        {
          id: 'manual_recovery',
          actionType: 'manual_recovery',
          label: 'Manual Recovery',
          description: 'Perform manual recovery steps',
          recommended: false,
          requiresConfirmation: true,
          riskLevel: 'high',
          expectedOutcome: 'Manual recovery steps will be guided',
        } as GuidedAction
      );
    }
    
    if (workflow.currentStepId === 'step_resolve') {
      actions.push(
        {
          id: 'resolve',
          actionType: 'resolve_incident',
          label: 'Resolve',
          description: 'Mark incident as resolved',
          recommended: true,
          requiresConfirmation: false,
          riskLevel: 'low',
          expectedOutcome: 'Incident will be marked as resolved',
        } as GuidedAction,
        {
          id: 'keep_open',
          actionType: 'keep_open',
          label: 'Keep Open',
          description: 'Keep incident open for further investigation',
          recommended: false,
          requiresConfirmation: false,
          riskLevel: 'low',
          expectedOutcome: 'Incident will remain open',
        } as GuidedAction,
        {
          id: 'escalate',
          actionType: 'escalate',
          label: 'Escalate',
          description: 'Escalate to higher level support',
          recommended: false,
          requiresConfirmation: true,
          riskLevel: 'medium',
          expectedOutcome: 'Incident will be escalated',
        } as GuidedAction
      );
    }
    
    return actions;
  }
  
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
  }> {
    const options = [
      {
        id: 'auto_recovery',
        name: 'Automatic Recovery',
        description: 'System will attempt automatic recovery',
        riskLevel: 'low' as const,
        estimatedTime: '1-5 minutes',
        successRate: 0.8,
      },
      {
        id: 'task_replay',
        name: 'Task Replay',
        description: 'Replay affected tasks from last known good state',
        riskLevel: 'medium' as const,
        estimatedTime: '5-15 minutes',
        successRate: 0.7,
      },
      {
        id: 'manual_recovery',
        name: 'Manual Recovery',
        description: 'Perform manual recovery steps with guidance',
        riskLevel: 'high' as const,
        estimatedTime: '15-60 minutes',
        successRate: 0.9,
      },
    ];
    
    // 根据事件类型过滤选项
    if (workflow.incidentType === 'server_degraded') {
      return options;
    }
    
    if (workflow.incidentType === 'task_failure') {
      return options.filter(o => o.id !== 'auto_recovery');
    }
    
    return options;
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建事件工作流构建器
 */
export function createIncidentWorkflowBuilder(): IncidentWorkflowBuilder {
  return new IncidentWorkflowBuilder();
}

/**
 * 快速构建事件工作流
 */
export function buildIncidentWorkflow(
  intervention: InterventionItem,
  incidentId: string,
  incidentType: string
): IncidentWorkflowState {
  const builder = new IncidentWorkflowBuilder();
  return builder.buildIncidentWorkflow(intervention, incidentId, incidentType);
}
