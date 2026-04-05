/**
 * Intervention Engine - 介入引擎
 * 
 * 职责：
 * 1. 从 6C 的 dashboard / attention items 中识别哪些事项需要人介入
 * 2. 输出 must_confirm / should_review / can_dismiss / can_snooze / should_escalate
 * 3. 这里本质上是把 dashboard attention 转成正式的 intervention items
 * 
 * @version v0.1.0
 * @date 2026-04-04
 */

import type {
  AttentionItem,
  DashboardSnapshot,
} from './dashboard_types';
import type {
  InterventionItem,
  InterventionRule,
  InterventionEngineConfig,
  GuidedAction,
  InterventionContext,
} from './hitl_types';

// ============================================================================
// 内置介入规则
// ============================================================================

/**
 * 超时审批介入规则
 */
export const AGED_APPROVAL_INTERVENTION_RULE: InterventionRule = {
  id: 'aged_approval_intervention',
  name: 'Aged Approval Intervention',
  description: 'Approvals pending for more than 1 hour require guided approval',
  match: (item) => {
    return item.sourceType === 'approval' && (item.ageMs || 0) > 60 * 60 * 1000;
  },
  generateIntervention: (item, dashboard) => {
    const now = Date.now();
    const ageMinutes = Math.round((item.ageMs || 0) / 60000);
    
    return {
      id: `intervention_${item.id}`,
      sourceType: 'approval',
      sourceId: item.sourceId,
      title: `Approval pending for ${ageMinutes} minutes`,
      summary: item.reason,
      severity: ageMinutes > 240 ? 'critical' : 'high',
      reason: `Approval has been pending for ${ageMinutes} minutes`,
      interventionType: 'must_confirm',
      status: 'open',
      requiresHuman: true,
      requiresConfirmation: true,
      createdAt: now,
      updatedAt: now,
      suggestedActions: [
        {
          id: 'approve',
          actionType: 'approve',
          label: 'Approve',
          description: 'Approve this request',
          recommended: true,
          requiresConfirmation: true,
          riskLevel: 'low',
          expectedOutcome: 'Request will be approved and execution will continue',
          params: { approvalId: item.sourceId },
        } as GuidedAction,
        {
          id: 'reject',
          actionType: 'reject',
          label: 'Reject',
          description: 'Reject this request',
          recommended: false,
          requiresConfirmation: true,
          riskLevel: 'medium',
          expectedOutcome: 'Request will be rejected and related tasks may be cancelled',
          params: { approvalId: item.sourceId },
        } as GuidedAction,
        {
          id: 'request_context',
          actionType: 'request_context',
          label: 'Request More Context',
          description: 'Request additional information before deciding',
          recommended: false,
          requiresConfirmation: false,
          riskLevel: 'low',
          params: { approvalId: item.sourceId },
        } as GuidedAction,
      ],
      context: {
        snapshotId: dashboard.dashboardId,
        relatedApprovalId: item.sourceId,
        evidence: [item.reason],
        metrics: { ageMinutes },
        recommendedNextStep: 'Review approval details and decide',
      } as InterventionContext,
    };
  },
};

/**
 * 阻塞任务介入规则
 */
export const BLOCKED_TASK_INTERVENTION_RULE: InterventionRule = {
  id: 'blocked_task_intervention',
  name: 'Blocked Task Intervention',
  description: 'Blocked tasks require operator review',
  match: (item) => {
    return item.sourceType === 'task' && item.reason?.includes('blocked');
  },
  generateIntervention: (item, dashboard) => {
    const now = Date.now();
    
    return {
      id: `intervention_${item.id}`,
      sourceType: 'task',
      sourceId: item.sourceId,
      title: `Task blocked: ${item.title}`,
      summary: item.reason,
      severity: item.severity === 'critical' ? 'critical' : 'high',
      reason: item.reason,
      interventionType: 'should_review',
      status: 'open',
      requiresHuman: true,
      requiresConfirmation: false,
      createdAt: now,
      updatedAt: now,
      suggestedActions: [
        {
          id: 'retry',
          actionType: 'retry_task',
          label: 'Retry Task',
          description: 'Retry the blocked task',
          recommended: true,
          requiresConfirmation: false,
          riskLevel: 'low',
          expectedOutcome: 'Task will be retried and may complete successfully',
          params: { taskId: item.sourceId },
        } as GuidedAction,
        {
          id: 'cancel',
          actionType: 'cancel_task',
          label: 'Cancel Task',
          description: 'Cancel the blocked task',
          recommended: false,
          requiresConfirmation: true,
          riskLevel: 'medium',
          expectedOutcome: 'Task will be cancelled and related workflows may be affected',
          params: { taskId: item.sourceId },
        } as GuidedAction,
        {
          id: 'inspect',
          actionType: 'inspect_task',
          label: 'Inspect Task',
          description: 'Inspect task details and logs',
          recommended: false,
          requiresConfirmation: false,
          riskLevel: 'low',
          params: { taskId: item.sourceId },
        } as GuidedAction,
      ],
      context: {
        snapshotId: dashboard.dashboardId,
        relatedTaskId: item.sourceId,
        evidence: [item.reason],
        recommendedNextStep: 'Review task logs and decide whether to retry or cancel',
      } as InterventionContext,
    };
  },
};

/**
 * 降级 Server 介入规则
 */
export const DEGRADED_SERVER_INTERVENTION_RULE: InterventionRule = {
  id: 'degraded_server_intervention',
  name: 'Degraded Server Intervention',
  description: 'Degraded or unavailable servers require recovery confirmation',
  match: (item) => {
    return item.sourceType === 'ops' && item.reason?.includes('Server');
  },
  generateIntervention: (item, dashboard) => {
    const now = Date.now();
    
    return {
      id: `intervention_${item.id}`,
      sourceType: 'ops',
      sourceId: item.sourceId,
      title: item.title,
      summary: item.reason,
      severity: item.severity,
      reason: item.reason,
      interventionType: item.severity === 'critical' ? 'must_confirm' : 'should_review',
      status: 'open',
      requiresHuman: true,
      requiresConfirmation: item.severity === 'critical',
      createdAt: now,
      updatedAt: now,
      suggestedActions: [
        {
          id: 'request_recovery',
          actionType: 'request_recovery',
          label: 'Request Recovery',
          description: 'Request automatic recovery for this server',
          recommended: true,
          requiresConfirmation: true,
          riskLevel: 'low',
          expectedOutcome: 'System will attempt to recover the server',
          params: { targetId: item.sourceId, targetType: 'server' },
        } as GuidedAction,
        {
          id: 'acknowledge',
          actionType: 'ack_incident',
          label: 'Acknowledge',
          description: 'Acknowledge this incident',
          recommended: false,
          requiresConfirmation: false,
          riskLevel: 'low',
          params: { incidentId: `server_${item.sourceId}` },
        } as GuidedAction,
        {
          id: 'escalate',
          actionType: 'escalate',
          label: 'Escalate',
          description: 'Escalate to on-call engineer',
          recommended: false,
          requiresConfirmation: true,
          riskLevel: 'medium',
          params: { targetId: item.sourceId, targetType: 'server' },
        } as GuidedAction,
      ],
      context: {
        snapshotId: dashboard.dashboardId,
        relatedIncidentId: `server_${item.sourceId}`,
        evidence: [item.reason],
        recommendedNextStep: 'Request recovery or escalate if critical',
      } as InterventionContext,
    };
  },
};

/**
 * 不健康 Agent 介入规则
 */
export const UNHEALTHY_AGENT_INTERVENTION_RULE: InterventionRule = {
  id: 'unhealthy_agent_intervention',
  name: 'Unhealthy Agent Intervention',
  description: 'Unhealthy or blocked agents require inspection',
  match: (item) => {
    return item.sourceType === 'agent' && (item.severity === 'high' || item.severity === 'critical');
  },
  generateIntervention: (item, dashboard) => {
    const now = Date.now();
    
    return {
      id: `intervention_${item.id}`,
      sourceType: 'agent',
      sourceId: item.sourceId,
      title: item.title,
      summary: item.reason,
      severity: item.severity,
      reason: item.reason,
      interventionType: 'should_review',
      status: 'open',
      requiresHuman: true,
      requiresConfirmation: false,
      createdAt: now,
      updatedAt: now,
      suggestedActions: [
        {
          id: 'inspect',
          actionType: 'inspect_agent',
          label: 'Inspect Agent',
          description: 'Inspect agent status and logs',
          recommended: true,
          requiresConfirmation: false,
          riskLevel: 'low',
          params: { agentId: item.sourceId },
        } as GuidedAction,
        {
          id: 'pause',
          actionType: 'pause_agent',
          label: 'Pause Agent',
          description: 'Pause the agent to prevent further issues',
          recommended: false,
          requiresConfirmation: true,
          riskLevel: 'medium',
          expectedOutcome: 'Agent will be paused and no new tasks will be assigned',
          params: { agentId: item.sourceId },
        } as GuidedAction,
        {
          id: 'resume',
          actionType: 'resume_agent',
          label: 'Resume Agent',
          description: 'Resume the agent if it was paused',
          recommended: false,
          requiresConfirmation: false,
          riskLevel: 'low',
          params: { agentId: item.sourceId },
        } as GuidedAction,
      ],
      context: {
        snapshotId: dashboard.dashboardId,
        relatedAgentId: item.sourceId,
        evidence: [item.reason],
        recommendedNextStep: 'Inspect agent and decide whether to pause or resume',
      } as InterventionContext,
    };
  },
};

/**
 * 重放热点介入规则
 */
export const REPLAY_HOTSPOT_INTERVENTION_RULE: InterventionRule = {
  id: 'replay_hotspot_intervention',
  name: 'Replay Hotspot Intervention',
  description: 'Tasks with multiple replays require operator review',
  match: (item) => {
    return item.sourceType === 'task' && item.reason?.includes('replayed');
  },
  generateIntervention: (item, dashboard) => {
    const now = Date.now();
    
    return {
      id: `intervention_${item.id}`,
      sourceType: 'task',
      sourceId: item.sourceId,
      title: item.title,
      summary: item.reason,
      severity: 'medium',
      reason: item.reason,
      interventionType: 'can_dismiss',
      status: 'open',
      requiresHuman: true,
      requiresConfirmation: false,
      createdAt: now,
      updatedAt: now,
      suggestedActions: [
        {
          id: 'request_recovery',
          actionType: 'request_recovery',
          label: 'Request Recovery',
          description: 'Request full recovery for this task',
          recommended: true,
          requiresConfirmation: true,
          riskLevel: 'medium',
          params: { taskId: item.sourceId },
        } as GuidedAction,
        {
          id: 'dismiss',
          actionType: 'dismiss',
          label: 'Dismiss',
          description: 'Dismiss this intervention',
          recommended: false,
          requiresConfirmation: false,
          riskLevel: 'low',
          params: { interventionId: `intervention_${item.id}` },
        } as GuidedAction,
      ],
      context: {
        snapshotId: dashboard.dashboardId,
        relatedTaskId: item.sourceId,
        evidence: [item.reason],
        recommendedNextStep: 'Request recovery or dismiss if expected',
      } as InterventionContext,
    };
  },
};

// ============================================================================
// 所有内置规则
// ============================================================================

/**
 * 所有内置介入规则
 */
export const BUILTIN_INTERVENTION_RULES: InterventionRule[] = [
  AGED_APPROVAL_INTERVENTION_RULE,
  BLOCKED_TASK_INTERVENTION_RULE,
  DEGRADED_SERVER_INTERVENTION_RULE,
  UNHEALTHY_AGENT_INTERVENTION_RULE,
  REPLAY_HOTSPOT_INTERVENTION_RULE,
];

// ============================================================================
// 介入引擎
// ============================================================================

export class InterventionEngine {
  private config: Required<InterventionEngineConfig>;
  private rules: Map<string, InterventionRule> = new Map();
  
  constructor(config: InterventionEngineConfig = {}) {
    this.config = {
      maxOpenInterventions: config.maxOpenInterventions ?? 50,
      autoInterventionThreshold: config.autoInterventionThreshold ?? 0.7,
      defaultSnoozeDurationMs: config.defaultSnoozeDurationMs ?? 60 * 60 * 1000, // 1 小时
    };
    
    // 注册内置规则
    for (const rule of BUILTIN_INTERVENTION_RULES) {
      this.registerRule(rule);
    }
  }
  
  /**
   * 注册介入规则
   */
  registerRule(rule: InterventionRule): void {
    this.rules.set(rule.id, rule);
  }
  
  /**
   * 注销介入规则
   */
  unregisterRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }
  
  /**
   * 从关注项生成介入项
   */
  generateInterventions(
    attentionItems: AttentionItem[],
    dashboard: DashboardSnapshot
  ): InterventionItem[] {
    const interventions: InterventionItem[] = [];
    
    for (const item of attentionItems) {
      // 尝试匹配规则
      for (const [ruleId, rule] of this.rules.entries()) {
        try {
          if (rule.match(item, dashboard)) {
            const intervention = rule.generateIntervention(item, dashboard);
            interventions.push(intervention);
            break; // 每个关注项只匹配一条规则
          }
        } catch (error) {
          console.error(`Rule ${ruleId} error:`, error);
        }
      }
    }
    
    // 限制数量
    return interventions.slice(0, this.config.maxOpenInterventions);
  }
  
  /**
   * 从仪表盘生成介入项
   */
  generateInterventionsFromDashboard(dashboard: DashboardSnapshot): InterventionItem[] {
    return this.generateInterventions(dashboard.attentionItems, dashboard);
  }
  
  /**
   * 获取所有规则
   */
  getAllRules(): InterventionRule[] {
    return Array.from(this.rules.values());
  }
  
  /**
   * 获取规则数量
   */
  getRuleCount(): number {
    return this.rules.size;
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建介入引擎
 */
export function createInterventionEngine(config?: InterventionEngineConfig): InterventionEngine {
  return new InterventionEngine(config);
}

/**
 * 快速生成介入项
 */
export function generateInterventions(
  attentionItems: AttentionItem[],
  dashboard: DashboardSnapshot,
  config?: InterventionEngineConfig
): InterventionItem[] {
  const engine = new InterventionEngine(config);
  return engine.generateInterventions(attentionItems, dashboard);
}
