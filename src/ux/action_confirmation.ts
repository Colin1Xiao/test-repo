/**
 * Action Confirmation - 动作确认层
 * 
 * 职责：
 * 1. 统一动作确认层
 * 2. 定义哪些动作无需确认/需一次确认/需强确认
 * 3. 确认文案所需字段/风险说明/影响范围/rollback hint
 * 
 * @version v0.1.0
 * @date 2026-04-04
 */

import type {
  GuidedAction,
  ActionConfirmation,
  ConfirmationLevel,
  RiskLevel,
  ActionConfirmationConfig,
} from './hitl_types';

// ============================================================================
// 动作确认规则
// ============================================================================

/**
 * 无需确认的动作类型
 */
const NO_CONFIRMATION_ACTIONS: string[] = [
  'ack_incident',
  'inspect_agent',
  'inspect_task',
  'request_context',
  'dismiss',
];

/**
 * 需要强确认的动作类型
 */
const STRONG_CONFIRMATION_ACTIONS: string[] = [
  'cancel_task',
  'reject',
  'escalate',
  'pause_agent',
  'request_recovery',
];

// ============================================================================
// 动作确认管理器
// ============================================================================

export class ActionConfirmationManager {
  private config: Required<ActionConfirmationConfig>;
  
  constructor(config: ActionConfirmationConfig = {}) {
    this.config = {
      noConfirmationRequired: config.noConfirmationRequired ?? NO_CONFIRMATION_ACTIONS,
      strongConfirmationRequired: config.strongConfirmationRequired ?? STRONG_CONFIRMATION_ACTIONS,
    };
  }
  
  /**
   * 获取动作确认级别
   */
  getConfirmationLevel(actionType: string): ConfirmationLevel {
    if (this.config.noConfirmationRequired.includes(actionType)) {
      return 'none';
    }
    
    if (this.config.strongConfirmationRequired.includes(actionType)) {
      return 'strong';
    }
    
    return 'standard';
  }
  
  /**
   * 创建动作确认
   */
  createConfirmation(
    action: GuidedAction,
    targetId: string,
    targetType: string
  ): ActionConfirmation | null {
    const confirmationLevel = this.getConfirmationLevel(action.actionType);
    
    if (confirmationLevel === 'none') {
      return null;
    }
    
    const now = Date.now();
    
    return {
      actionId: action.id,
      actionType: action.actionType,
      targetType,
      targetId,
      confirmationLevel,
      title: this.generateConfirmationTitle(action),
      message: this.generateConfirmationMessage(action),
      impactSummary: action.expectedOutcome,
      riskSummary: this.generateRiskSummary(action),
      rollbackHint: this.generateRollbackHint(action),
      createdAt: now,
      status: 'pending',
    };
  }
  
  /**
   * 确认动作
   */
  confirmConfirmation(confirmationId: string): ActionConfirmation | null {
    // 简化实现：实际应该从存储中获取
    return null;
  }
  
  /**
   * 拒绝动作
   */
  rejectConfirmation(confirmationId: string): ActionConfirmation | null {
    // 简化实现：实际应该从存储中获取
    return null;
  }
  
  /**
   * 过期动作
   */
  expireConfirmation(confirmationId: string): ActionConfirmation | null {
    // 简化实现：实际应该从存储中获取
    return null;
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 生成确认标题
   */
  private generateConfirmationTitle(action: GuidedAction): string {
    const titleMap: Record<string, string> = {
      approve: 'Confirm Approval',
      reject: 'Confirm Rejection',
      retry_task: 'Confirm Task Retry',
      cancel_task: 'Confirm Task Cancellation',
      request_recovery: 'Confirm Recovery Request',
      pause_agent: 'Confirm Agent Pause',
      resume_agent: 'Confirm Agent Resume',
      escalate: 'Confirm Escalation',
      dismiss: 'Confirm Dismissal',
      snooze: 'Confirm Snooze',
    };
    
    return titleMap[action.actionType] || `Confirm ${action.label}`;
  }
  
  /**
   * 生成确认消息
   */
  private generateConfirmationMessage(action: GuidedAction): string {
    const messageMap: Record<string, string> = {
      approve: 'You are about to approve this request. This action will allow the request to proceed.',
      reject: 'You are about to reject this request. This action may cancel related tasks.',
      retry_task: 'You are about to retry this task. The task will be re-executed from the beginning.',
      cancel_task: 'You are about to cancel this task. This action cannot be undone and may affect related workflows.',
      request_recovery: 'You are about to request recovery. The system will attempt to recover the target automatically.',
      pause_agent: 'You are about to pause this agent. No new tasks will be assigned until the agent is resumed.',
      resume_agent: 'You are about to resume this agent. The agent will be able to accept new tasks.',
      escalate: 'You are about to escalate this issue. It will be assigned to on-call engineer or manager.',
      dismiss: 'You are about to dismiss this intervention. It will be removed from your queue.',
      snooze: 'You are about to snooze this intervention. It will reappear after the snooze period.',
    };
    
    return messageMap[action.actionType] || action.description || 'Please confirm this action.';
  }
  
  /**
   * 生成风险摘要
   */
  private generateRiskSummary(action: GuidedAction): string {
    const riskMap: Record<string, string> = {
      approve: 'Low risk: Request will proceed as expected.',
      reject: 'Medium risk: Related tasks may be cancelled.',
      retry_task: 'Low risk: Task may fail again if underlying issue persists.',
      cancel_task: 'High risk: This action cannot be undone and may affect dependent workflows.',
      request_recovery: 'Low risk: Recovery attempt may fail if issue is not recoverable.',
      pause_agent: 'Medium risk: Agent will not process new tasks until resumed.',
      resume_agent: 'Low risk: Agent may encounter same issues if not resolved.',
      escalate: 'Medium risk: Issue will be assigned to higher level support.',
      dismiss: 'Low risk: Intervention will be removed but underlying issue may persist.',
      snooze: 'Low risk: Issue will reappear after snooze period.',
    };
    
    return riskMap[action.actionType] || `Risk level: ${action.riskLevel || 'unknown'}`;
  }
  
  /**
   * 生成回滚提示
   */
  private generateRollbackHint(action: GuidedAction): string {
    const rollbackMap: Record<string, string> = {
      approve: 'Cannot undo approval. Contact support if reversal is needed.',
      reject: 'Cannot undo rejection. A new request may need to be submitted.',
      retry_task: 'No rollback needed. Task can be cancelled if retry fails.',
      cancel_task: 'Cannot undo cancellation. Task must be recreated if needed.',
      request_recovery: 'No rollback needed. Recovery can be stopped if issues arise.',
      pause_agent: 'Resume the agent to undo this action.',
      resume_agent: 'Pause the agent to undo this action.',
      escalate: 'Cannot undo escalation. Contact the assignee if change is needed.',
      dismiss: 'Intervention can be recreated if issue persists.',
      snooze: 'Intervention can be manually resumed before snooze expires.',
    };
    
    return rollbackMap[action.actionType] || 'No rollback information available.';
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建动作确认管理器
 */
export function createActionConfirmationManager(config?: ActionConfirmationConfig): ActionConfirmationManager {
  return new ActionConfirmationManager(config);
}

/**
 * 快速创建动作确认
 */
export function createConfirmation(
  action: GuidedAction,
  targetId: string,
  targetType: string,
  config?: ActionConfirmationConfig
): ActionConfirmation | null {
  const manager = new ActionConfirmationManager(config);
  return manager.createConfirmation(action, targetId, targetType);
}

/**
 * 快速获取确认级别
 */
export function getConfirmationLevel(
  actionType: string,
  config?: ActionConfirmationConfig
): ConfirmationLevel {
  const manager = new ActionConfirmationManager(config);
  return manager.getConfirmationLevel(actionType);
}
