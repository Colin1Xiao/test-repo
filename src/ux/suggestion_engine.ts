/**
 * Suggestion Engine - 建议引擎
 * 
 * 职责：
 * 1. 为每个 intervention item 生成建议动作与理由
 * 2. 输出推荐动作/备选动作/原因解释/风险提示/预期影响
 * 3. 这是 6D 的"引导性"核心，决定体验是生硬还是智能
 * 
 * @version v0.1.0
 * @date 2026-04-04
 */

import type {
  InterventionItem,
  GuidedAction,
  OperatorSuggestion,
  SuggestionEngineConfig,
} from './hitl_types';

// ============================================================================
// 建议引擎
// ============================================================================

export class SuggestionEngine {
  private config: Required<SuggestionEngineConfig>;
  
  constructor(config: SuggestionEngineConfig = {}) {
    this.config = {
      maxSuggestions: config.maxSuggestions ?? 5,
      minConfidence: config.minConfidence ?? 0.5,
    };
  }
  
  /**
   * 为介入项生成建议
   */
  generateSuggestions(intervention: InterventionItem): OperatorSuggestion[] {
    const suggestions: OperatorSuggestion[] = [];
    
    // 根据介入类型生成建议
    switch (intervention.interventionType) {
      case 'must_confirm':
        suggestions.push(...this.generateMustConfirmSuggestions(intervention));
        break;
      
      case 'should_review':
        suggestions.push(...this.generateShouldReviewSuggestions(intervention));
        break;
      
      case 'can_dismiss':
        suggestions.push(...this.generateCanDismissSuggestions(intervention));
        break;
      
      case 'can_snooze':
        suggestions.push(...this.generateCanSnoozeSuggestions(intervention));
        break;
      
      case 'should_escalate':
        suggestions.push(...this.generateShouldEscalateSuggestions(intervention));
        break;
    }
    
    // 限制数量
    return suggestions.slice(0, this.config.maxSuggestions);
  }
  
  /**
   * 优化引导动作
   */
  refineGuidedActions(
    actions: GuidedAction[],
    intervention: InterventionItem
  ): GuidedAction[] {
    // 根据介入严重级别调整风险级别
    if (intervention.severity === 'critical') {
      for (const action of actions) {
        if (action.riskLevel === 'low') {
          action.riskLevel = 'medium';
        }
      }
    }
    
    // 确保至少有一个推荐动作
    if (!actions.some(a => a.recommended)) {
      if (actions.length > 0) {
        actions[0].recommended = true;
      }
    }
    
    // 添加预期结果（如果缺失）
    for (const action of actions) {
      if (!action.expectedOutcome) {
        action.expectedOutcome = this.generateExpectedOutcome(action, intervention);
      }
    }
    
    return actions;
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 生成必须确认的建议
   */
  private generateMustConfirmSuggestions(
    intervention: InterventionItem
  ): OperatorSuggestion[] {
    const suggestions: OperatorSuggestion[] = [];
    const now = Date.now();
    
    suggestions.push({
      id: `suggestion_confirm_${intervention.id}`,
      interventionId: intervention.id,
      summary: 'Immediate action required',
      rationale: `This ${intervention.sourceType} requires your confirmation due to ${intervention.reason.toLowerCase()}`,
      recommendedActionId: intervention.suggestedActions.find(a => a.recommended)?.id,
      alternatives: intervention.suggestedActions.filter(a => !a.recommended).map(a => a.label),
      createdAt: now,
    });
    
    return suggestions;
  }
  
  /**
   * 生成应该审查的建议
   */
  private generateShouldReviewSuggestions(
    intervention: InterventionItem
  ): OperatorSuggestion[] {
    const suggestions: OperatorSuggestion[] = [];
    const now = Date.now();
    
    suggestions.push({
      id: `suggestion_review_${intervention.id}`,
      interventionId: intervention.id,
      summary: 'Review recommended',
      rationale: `This ${intervention.sourceType} should be reviewed to ensure proper handling`,
      recommendedActionId: intervention.suggestedActions.find(a => a.recommended)?.id,
      alternatives: ['Dismiss', 'Snooze', 'Escalate'],
      createdAt: now,
    });
    
    return suggestions;
  }
  
  /**
   * 生成可以驳回的建议
   */
  private generateCanDismissSuggestions(
    intervention: InterventionItem
  ): OperatorSuggestion[] {
    const suggestions: OperatorSuggestion[] = [];
    const now = Date.now();
    
    suggestions.push({
      id: `suggestion_dismiss_${intervention.id}`,
      interventionId: intervention.id,
      summary: 'Can be dismissed if expected',
      rationale: `This ${intervention.sourceType} can be dismissed if it is expected behavior`,
      recommendedActionId: 'dismiss',
      alternatives: ['Review', 'Take Action'],
      createdAt: now,
    });
    
    return suggestions;
  }
  
  /**
   * 生成可以延后的建议
   */
  private generateCanSnoozeSuggestions(
    intervention: InterventionItem
  ): OperatorSuggestion[] {
    const suggestions: OperatorSuggestion[] = [];
    const now = Date.now();
    
    suggestions.push({
      id: `suggestion_snooze_${intervention.id}`,
      interventionId: intervention.id,
      summary: 'Can be snoozed if not urgent',
      rationale: `This ${intervention.sourceType} can be snoozed if it does not require immediate attention`,
      recommendedActionId: 'snooze',
      alternatives: ['Review Now', 'Dismiss'],
      createdAt: now,
    });
    
    return suggestions;
  }
  
  /**
   * 生成应该升级的建议
   */
  private generateShouldEscalateSuggestions(
    intervention: InterventionItem
  ): OperatorSuggestion[] {
    const suggestions: OperatorSuggestion[] = [];
    const now = Date.now();
    
    suggestions.push({
      id: `suggestion_escalate_${intervention.id}`,
      interventionId: intervention.id,
      summary: 'Escalation recommended',
      rationale: `This ${intervention.sourceType} should be escalated due to severity: ${intervention.severity}`,
      recommendedActionId: 'escalate',
      alternatives: ['Handle Personally', 'Dismiss'],
      createdAt: now,
    });
    
    return suggestions;
  }
  
  /**
   * 生成预期结果
   */
  private generateExpectedOutcome(
    action: GuidedAction,
    intervention: InterventionItem
  ): string {
    switch (action.actionType) {
      case 'approve':
        return 'Request will be approved and execution will continue';
      
      case 'reject':
        return 'Request will be rejected and related tasks may be cancelled';
      
      case 'retry_task':
        return 'Task will be retried and may complete successfully';
      
      case 'cancel_task':
        return 'Task will be cancelled and related workflows may be affected';
      
      case 'request_recovery':
        return 'System will attempt to recover the target';
      
      case 'ack_incident':
        return 'Incident will be acknowledged and assigned to you';
      
      case 'escalate':
        return 'Issue will be escalated to on-call engineer or manager';
      
      case 'pause_agent':
        return 'Agent will be paused and no new tasks will be assigned';
      
      case 'resume_agent':
        return 'Agent will be resumed and can accept new tasks';
      
      case 'inspect_agent':
      case 'inspect_task':
        return 'Detailed information will be provided for review';
      
      case 'dismiss':
        return 'Intervention will be dismissed and removed from queue';
      
      case 'snooze':
        return 'Intervention will be snoozed and reappear later';
      
      default:
        return 'Action will be executed';
    }
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建建议引擎
 */
export function createSuggestionEngine(config?: SuggestionEngineConfig): SuggestionEngine {
  return new SuggestionEngine(config);
}

/**
 * 快速生成建议
 */
export function generateSuggestions(
  intervention: InterventionItem,
  config?: SuggestionEngineConfig
): OperatorSuggestion[] {
  const engine = new SuggestionEngine(config);
  return engine.generateSuggestions(intervention);
}

/**
 * 快速优化引导动作
 */
export function refineGuidedActions(
  actions: GuidedAction[],
  intervention: InterventionItem
): GuidedAction[] {
  const engine = new SuggestionEngine();
  return engine.refineGuidedActions(actions, intervention);
}
