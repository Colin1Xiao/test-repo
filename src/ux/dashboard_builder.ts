/**
 * Dashboard Builder - 仪表盘构建器
 * 
 * 职责：
 * 1. 把 ControlSurfaceSnapshot 转成 DashboardSnapshot
 * 2. 生成 sections / cards
 * 3. 归并 summary
 * 4. 计算 badge / severity / freshness
 * 5. 生成 top attention items
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type {
  ControlSurfaceSnapshot,
  ControlAction,
} from './control_types';
import type {
  DashboardSnapshot,
  DashboardSummary,
  DashboardSection,
  DashboardCard,
  StatusBadge,
  AttentionItem,
  DashboardBuilderConfig,
} from './dashboard_types';
import { AttentionEngine, analyzeAttention } from './attention_engine';

// ============================================================================
// 仪表盘构建器
// ============================================================================

export class DashboardBuilder {
  private config: Required<DashboardBuilderConfig>;
  private attentionEngine: AttentionEngine;
  
  constructor(config: DashboardBuilderConfig = {}) {
    this.config = {
      maxSections: config.maxSections ?? 6,
      maxCardsPerSection: config.maxCardsPerSection ?? 10,
      maxAttentionItems: config.maxAttentionItems ?? 20,
      maxRecommendedActions: config.maxRecommendedActions ?? 10,
      defaultFreshnessThresholdMs: config.defaultFreshnessThresholdMs ?? 60000, // 1 分钟
    };
    this.attentionEngine = new AttentionEngine();
  }
  
  /**
   * 构建仪表盘快照
   */
  buildDashboardSnapshot(
    controlSnapshot: ControlSurfaceSnapshot
  ): DashboardSnapshot {
    const now = Date.now();
    
    // 生成摘要
    const summary = this.buildSummary(controlSnapshot);
    
    // 生成分段
    const sections = this.buildSections(controlSnapshot);
    
    // 生成关注项
    const attentionAnalysis = this.attentionEngine.analyze(controlSnapshot);
    const attentionItems = attentionAnalysis.items.slice(0, this.config.maxAttentionItems);
    
    // 生成建议动作
    const recommendedActions = this.buildRecommendedActions(
      controlSnapshot,
      attentionItems
    );
    
    return {
      dashboardId: `dashboard_${now}`,
      sourceSnapshotId: controlSnapshot.snapshotId,
      createdAt: now,
      updatedAt: now,
      freshnessMs: 0,
      summary,
      sections,
      attentionItems,
      recommendedActions,
    };
  }
  
  /**
   * 刷新仪表盘快照
   */
  refreshDashboardSnapshot(
    oldDashboard: DashboardSnapshot,
    newControlSnapshot: ControlSurfaceSnapshot
  ): {
    dashboard: DashboardSnapshot;
    changes?: any;
  } {
    const now = Date.now();
    const newDashboard = this.buildDashboardSnapshot(newControlSnapshot);
    
    // 计算新鲜度
    newDashboard.freshnessMs = now - oldDashboard.createdAt;
    
    // 检测变化
    const changes = this.detectChanges(oldDashboard, newDashboard);
    
    return {
      dashboard: newDashboard,
      changes,
    };
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 构建摘要
   */
  private buildSummary(
    controlSnapshot: ControlSurfaceSnapshot
  ): DashboardSummary {
    const { summary: controlSummary, opsView } = controlSnapshot;
    
    // 确定总体状态
    const overallStatus = this.determineOverallStatus(controlSnapshot);
    
    // 计算降级 Agent 数
    const degradedAgents =
      controlSnapshot.agentView.unhealthyAgents.length +
      controlSnapshot.agentView.blockedAgents.length;
    
    return {
      overallStatus,
      totalTasks: controlSummary.totalTasks,
      blockedTasks: controlSnapshot.taskView.blockedTasks.length,
      pendingApprovals: controlSummary.pendingApprovals,
      activeIncidents: opsView.activeIncidents.filter(i => !i.acknowledged).length,
      degradedAgents,
      healthScore: controlSummary.healthScore,
      attentionCount: 0, // 会在后面计算
    };
  }
  
  /**
   * 确定总体状态
   */
  private determineOverallStatus(
    controlSnapshot: ControlSurfaceSnapshot
  ): DashboardSummary['overallStatus'] {
    const { opsView, taskView, approvalView, agentView } = controlSnapshot;
    
    // Critical 条件
    if (
      opsView.healthScore < 30 ||
      opsView.degradedServers.some(s => s.status === 'unavailable') ||
      taskView.blockedTasks.length > 10 ||
      approvalView.timeoutApprovals.length > 5
    ) {
      return 'critical';
    }
    
    // Blocked 条件
    if (
      opsView.healthScore < 50 ||
      taskView.blockedTasks.length > 5 ||
      approvalView.pendingApprovals.length > 20
    ) {
      return 'blocked';
    }
    
    // Degraded 条件
    if (
      opsView.healthScore < 70 ||
      opsView.degradedServers.length > 0 ||
      agentView.unhealthyAgents.length > 0
    ) {
      return 'degraded';
    }
    
    return 'healthy';
  }
  
  /**
   * 构建分段
   */
  private buildSections(
    controlSnapshot: ControlSurfaceSnapshot
  ): DashboardSection[] {
    const sections: DashboardSection[] = [];
    
    // 关注项分段（最高优先级）
    const attentionSection = this.buildAttentionSection(controlSnapshot);
    if (attentionSection.cards.length > 0) {
      sections.push(attentionSection);
    }
    
    // 任务分段
    const taskSection = this.buildTaskSection(controlSnapshot.taskView);
    if (taskSection.cards.length > 0) {
      sections.push(taskSection);
    }
    
    // 审批分段
    const approvalSection = this.buildApprovalSection(controlSnapshot.approvalView);
    if (approvalSection.cards.length > 0) {
      sections.push(approvalSection);
    }
    
    // 运维分段
    const opsSection = this.buildOpsSection(controlSnapshot.opsView);
    if (opsSection.cards.length > 0) {
      sections.push(opsSection);
    }
    
    // Agent 分段
    const agentSection = this.buildAgentSection(controlSnapshot.agentView);
    if (agentSection.cards.length > 0) {
      sections.push(agentSection);
    }
    
    // 动作分段
    const actionSection = this.buildActionSection(controlSnapshot.availableActions);
    if (actionSection.cards.length > 0) {
      sections.push(actionSection);
    }
    
    // 限制分段数量
    return sections.slice(0, this.config.maxSections);
  }
  
  /**
   * 构建关注项分段
   */
  private buildAttentionSection(
    controlSnapshot: ControlSurfaceSnapshot
  ): DashboardSection {
    const attentionAnalysis = this.attentionEngine.analyze(controlSnapshot);
    const items = attentionAnalysis.items.slice(0, this.config.maxCardsPerSection);
    
    const cards: DashboardCard[] = items.map(item => ({
      id: item.id,
      kind: 'attention',
      title: item.title,
      subtitle: item.reason,
      status: item.severity,
      severity: item.severity,
      updatedAt: item.ageMs ? Date.now() - item.ageMs : undefined,
      fields: {
        sourceType: item.sourceType,
        sourceId: item.sourceId,
      },
      suggestedActions: item.recommendedAction ? [item.recommendedAction] : undefined,
    }));
    
    return {
      id: 'section_attention',
      type: 'incidents',
      title: 'Attention Required',
      priority: 0,
      collapsed: false,
      badges: [
        {
          type: 'severity',
          value: `${items.length} items`,
          style: items.some(i => i.severity === 'critical') ? 'error' : 'warning',
        },
      ],
      cards,
    };
  }
  
  /**
   * 构建任务分段
   */
  private buildTaskSection(
    taskView: any
  ): DashboardSection {
    const cards: DashboardCard[] = [];
    
    // 阻塞任务
    for (const task of taskView.blockedTasks.slice(0, this.config.maxCardsPerSection)) {
      cards.push({
        id: `task_${task.taskId}`,
        kind: 'task',
        title: task.title,
        subtitle: task.blockedReason,
        status: 'blocked',
        severity: task.risk,
        owner: task.ownerAgent,
        updatedAt: task.updatedAt,
        fields: {
          taskId: task.taskId,
          priority: task.priority,
          progress: task.progress,
        },
        suggestedActions: [
          {
            type: 'retry_task',
            targetType: 'task',
            targetId: task.taskId,
            requestedBy: 'dashboard',
            requestedAt: Date.now(),
          } as ControlAction,
        ],
      });
    }
    
    return {
      id: 'section_tasks',
      type: 'tasks',
      title: 'Tasks',
      priority: 1,
      collapsed: taskView.blockedTasks.length === 0,
      badges: [
        {
          type: 'status',
          value: `${taskView.blockedTasks.length} blocked`,
          style: taskView.blockedTasks.length > 0 ? 'warning' : 'success',
        },
      ],
      cards: cards.slice(0, this.config.maxCardsPerSection),
    };
  }
  
  /**
   * 构建审批分段
   */
  private buildApprovalSection(
    approvalView: any
  ): DashboardSection {
    const cards: DashboardCard[] = [];
    
    // 待处理审批
    for (const approval of approvalView.pendingApprovals.slice(0, this.config.maxCardsPerSection)) {
      const ageMinutes = Math.round(approval.ageMs / 60000);
      
      cards.push({
        id: `approval_${approval.approvalId}`,
        kind: 'approval',
        title: approval.scope,
        subtitle: approval.reason,
        status: 'pending',
        severity: ageMinutes > 60 ? 'high' : 'medium',
        owner: approval.requestingAgent,
        updatedAt: approval.requestedAt,
        fields: {
          approvalId: approval.approvalId,
          ageMinutes,
          taskId: approval.taskId,
        },
        suggestedActions: [
          {
            type: 'approve',
            targetType: 'approval',
            targetId: approval.approvalId,
            requestedBy: 'dashboard',
            requestedAt: Date.now(),
          } as ControlAction,
          {
            type: 'reject',
            targetType: 'approval',
            targetId: approval.approvalId,
            requestedBy: 'dashboard',
            requestedAt: Date.now(),
          } as ControlAction,
        ],
      });
    }
    
    return {
      id: 'section_approvals',
      type: 'approvals',
      title: 'Approvals',
      priority: 2,
      collapsed: approvalView.pendingApprovals.length === 0,
      badges: [
        {
          type: 'status',
          value: `${approvalView.pendingApprovals.length} pending`,
          style: approvalView.pendingApprovals.length > 5 ? 'warning' : 'info',
        },
        {
          type: 'age',
          value: approvalView.bottlenecks.length > 0
            ? `Avg wait: ${Math.round(approvalView.bottlenecks[0].avgWaitTimeMs / 60000)}min`
            : 'No bottlenecks',
        },
      ],
      cards: cards.slice(0, this.config.maxCardsPerSection),
    };
  }
  
  /**
   * 构建运维分段
   */
  private buildOpsSection(
    opsView: any
  ): DashboardSection {
    const cards: DashboardCard[] = [];
    
    // 降级 Server
    for (const server of opsView.degradedServers.slice(0, 5)) {
      cards.push({
        id: `server_${server.serverId}`,
        kind: 'server',
        title: `Server: ${server.serverId}`,
        subtitle: `Error rate: ${(server.errorRate * 100).toFixed(1)}%`,
        status: server.status,
        severity: server.status === 'unavailable' ? 'critical' : 'high',
        updatedAt: server.lastCheck,
        fields: {
          serverId: server.serverId,
          errorRate: server.errorRate,
        },
      });
    }
    
    // 被阻塞 Skill
    for (const skill of opsView.blockedSkills.slice(0, 5)) {
      cards.push({
        id: `skill_${skill.skillName}`,
        kind: 'skill',
        title: `Skill: ${skill.skillName}`,
        subtitle: skill.reason,
        status: skill.status,
        severity: 'medium',
        fields: {
          skillName: skill.skillName,
          count: skill.count,
        },
      });
    }
    
    return {
      id: 'section_ops',
      type: 'ops',
      title: 'Operations',
      priority: 3,
      collapsed: opsView.degradedServers.length === 0 && opsView.blockedSkills.length === 0,
      badges: [
        {
          type: 'status',
          value: `Health: ${opsView.healthScore}/100`,
          style: opsView.healthScore >= 70 ? 'success' : opsView.healthScore >= 50 ? 'warning' : 'error',
        },
      ],
      cards: cards.slice(0, this.config.maxCardsPerSection),
    };
  }
  
  /**
   * 构建 Agent 分段
   */
  private buildAgentSection(
    agentView: any
  ): DashboardSection {
    const cards: DashboardCard[] = [];
    
    // 不健康 Agent
    for (const agent of agentView.unhealthyAgents.slice(0, 5)) {
      cards.push({
        id: `agent_${agent.agentId}`,
        kind: 'agent',
        title: `Agent: ${agent.agentId}`,
        subtitle: `Role: ${agent.role}`,
        status: agent.status,
        severity: 'high',
        owner: agent.agentId,
        updatedAt: agent.lastSeenAt,
        fields: {
          agentId: agent.agentId,
          role: agent.role,
          healthScore: agent.healthScore,
          failureRate: agent.failureRate,
        },
      });
    }
    
    // 阻塞 Agent
    for (const agent of agentView.blockedAgents.slice(0, 5)) {
      cards.push({
        id: `agent_${agent.agentId}`,
        kind: 'agent',
        title: `Agent: ${agent.agentId}`,
        subtitle: `Role: ${agent.role}`,
        status: 'blocked',
        severity: 'medium',
        owner: agent.agentId,
        updatedAt: agent.lastSeenAt,
        fields: {
          agentId: agent.agentId,
          role: agent.role,
          blockedTaskCount: agent.blockedTaskCount,
        },
      });
    }
    
    return {
      id: 'section_agents',
      type: 'agents',
      title: 'Agents',
      priority: 4,
      collapsed: agentView.unhealthyAgents.length === 0 && agentView.blockedAgents.length === 0,
      badges: [
        {
          type: 'status',
          value: `${agentView.totalAgents - agentView.offlineAgents.length} active`,
        },
      ],
      cards: cards.slice(0, this.config.maxCardsPerSection),
    };
  }
  
  /**
   * 构建动作分段
   */
  private buildActionSection(
    availableActions: ControlAction[]
  ): DashboardSection {
    const cards: DashboardCard[] = availableActions.slice(0, this.config.maxCardsPerSection).map(action => ({
      id: `action_${action.type}_${action.targetId}`,
      kind: 'action',
      title: action.type,
      subtitle: `${action.targetType}: ${action.targetId}`,
      status: 'available',
      fields: {
        actionType: action.type,
        targetType: action.targetType,
        targetId: action.targetId,
      },
    }));
    
    return {
      id: 'section_actions',
      type: 'actions',
      title: 'Recommended Actions',
      priority: 5,
      collapsed: availableActions.length === 0,
      badges: [
        {
          type: 'status',
          value: `${availableActions.length} available`,
          style: availableActions.length > 0 ? 'info' : 'success',
        },
      ],
      cards,
    };
  }
  
  /**
   * 构建建议动作
   */
  private buildRecommendedActions(
    controlSnapshot: ControlSurfaceSnapshot,
    attentionItems: AttentionItem[]
  ): ControlAction[] {
    const actions: ControlAction[] = [];
    
    // 从关注项收集动作
    for (const item of attentionItems.slice(0, this.config.maxRecommendedActions)) {
      if (item.recommendedAction) {
        actions.push(item.recommendedAction);
      }
    }
    
    // 添加系统建议动作
    if (controlSnapshot.availableActions) {
      for (const action of controlSnapshot.availableActions.slice(0, 5)) {
        if (!actions.some(a => a.type === action.type && a.targetId === action.targetId)) {
          actions.push(action);
        }
      }
    }
    
    return actions.slice(0, this.config.maxRecommendedActions);
  }
  
  /**
   * 检测变化
   */
  private detectChanges(
    oldDashboard: DashboardSnapshot,
    newDashboard: DashboardSnapshot
  ): any {
    const changes: any = {
      added: [],
      removed: [],
      updated: [],
    };
    
    // 检测状态变化
    if (oldDashboard.summary.overallStatus !== newDashboard.summary.overallStatus) {
      changes.statusChanged = {
        from: oldDashboard.summary.overallStatus,
        to: newDashboard.summary.overallStatus,
      };
    }
    
    // 检测健康评分变化
    if (oldDashboard.summary.healthScore !== newDashboard.summary.healthScore) {
      changes.healthScoreChanged = {
        from: oldDashboard.summary.healthScore,
        to: newDashboard.summary.healthScore,
      };
    }
    
    // 检测关注项变化
    const oldAttentionIds = new Set(oldDashboard.attentionItems.map(i => i.id));
    const newAttentionIds = new Set(newDashboard.attentionItems.map(i => i.id));
    
    for (const item of newDashboard.attentionItems) {
      if (!oldAttentionIds.has(item.id)) {
        changes.added.push(item.id);
      }
    }
    
    for (const item of oldDashboard.attentionItems) {
      if (!newAttentionIds.has(item.id)) {
        changes.removed.push(item.id);
      }
    }
    
    return changes;
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建仪表盘构建器
 */
export function createDashboardBuilder(config?: DashboardBuilderConfig): DashboardBuilder {
  return new DashboardBuilder(config);
}

/**
 * 快速构建仪表盘快照
 */
export function buildDashboardSnapshot(
  controlSnapshot: ControlSurfaceSnapshot,
  config?: DashboardBuilderConfig
): DashboardSnapshot {
  const builder = new DashboardBuilder(config);
  return builder.buildDashboardSnapshot(controlSnapshot);
}
