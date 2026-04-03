/**
 * Operator View Factory
 * Phase 2A-1R - 标准化视图 Payload 构造
 * 
 * 职责：
 * - 统一构造 OperatorViewPayload
 * - 避免每个 view 方法手拼标题、summary、actions
 * - 提供一致的视图结构
 */

import type {
  OperatorViewPayload,
  OperatorViewAction,
  OperatorViewKind,
  OperatorMode,
  OperatorSurface,
} from '../types/surface_types';
import type { DashboardSnapshot } from '../ux/dashboard_types';
import type { ControlSurfaceSnapshot } from '../ux/control_types';
import type { HumanLoopSnapshot } from '../ux/hitl_types';

// ============================================================================
// 输入类型
// ============================================================================

export interface BuildDashboardViewInput {
  controlSnapshot: ControlSurfaceSnapshot;
  dashboardSnapshot: DashboardSnapshot;
  humanLoopSnapshot?: HumanLoopSnapshot;
  mode?: OperatorMode;
  surface?: OperatorSurface;
}

export interface BuildTaskViewInput {
  controlSnapshot: ControlSurfaceSnapshot;
  mode?: OperatorMode;
  surface?: OperatorSurface;
}

export interface BuildApprovalViewInput {
  controlSnapshot: ControlSurfaceSnapshot;
  humanLoopSnapshot?: HumanLoopSnapshot;
  mode?: OperatorMode;
  surface?: OperatorSurface;
}

export interface BuildIncidentViewInput {
  controlSnapshot: ControlSurfaceSnapshot;
  dashboardSnapshot: DashboardSnapshot;
  mode?: OperatorMode;
  surface?: OperatorSurface;
}

export interface BuildAgentViewInput {
  controlSnapshot: ControlSurfaceSnapshot;
  mode?: OperatorMode;
  surface?: OperatorSurface;
}

export interface BuildInboxViewInput {
  controlSnapshot: ControlSurfaceSnapshot;
  humanLoopSnapshot?: HumanLoopSnapshot;
  mode?: OperatorMode;
  surface?: OperatorSurface;
}

export interface BuildInterventionViewInput {
  humanLoopSnapshot: HumanLoopSnapshot;
  mode?: OperatorMode;
  surface?: OperatorSurface;
}

export interface BuildDetailViewInput {
  targetType: string;
  targetId: string;
  data: unknown;
  mode?: OperatorMode;
  surface?: OperatorSurface;
}

// ============================================================================
// View Factory 接口
// ============================================================================

export interface OperatorViewFactory {
  buildDashboardView(input: BuildDashboardViewInput): OperatorViewPayload;
  buildTaskView(input: BuildTaskViewInput): OperatorViewPayload;
  buildApprovalView(input: BuildApprovalViewInput): OperatorViewPayload;
  buildIncidentView(input: BuildIncidentViewInput): OperatorViewPayload;
  buildAgentView(input: BuildAgentViewInput): OperatorViewPayload;
  buildInboxView(input: BuildInboxViewInput): OperatorViewPayload;
  buildInterventionView(input: BuildInterventionViewInput): OperatorViewPayload;
  buildDetailView(input: BuildDetailViewInput): OperatorViewPayload;
}

// ============================================================================
// 默认实现
// ============================================================================

export class DefaultOperatorViewFactory implements OperatorViewFactory {
  buildDashboardView(input: BuildDashboardViewInput): OperatorViewPayload {
    const { controlSnapshot, dashboardSnapshot, mode = 'summary', surface = 'cli' } = input;
    const now = Date.now();
    
    const summary = controlSnapshot.summary;
    
    // 构建可用动作
    const availableActions: OperatorViewAction[] = [
      {
        actionType: 'view_tasks',
        label: '查看任务',
        targetType: 'task',
        style: 'default',
      },
      {
        actionType: 'view_approvals',
        label: '查看审批',
        targetType: 'approval',
        style: 'default',
      },
      {
        actionType: 'view_incidents',
        label: '查看事件',
        targetType: 'incident',
        style: 'default',
      },
      {
        actionType: 'view_inbox',
        label: '查看收件箱',
        targetType: 'inbox',
        style: 'primary',
      },
    ];
    
    // 如果有待处理审批，添加快速动作
    if (summary.pendingApprovals > 0) {
      availableActions.push({
        actionType: 'view_approvals',
        label: `处理审批 (${summary.pendingApprovals})`,
        targetType: 'approval',
        style: 'primary',
      });
    }
    
    // 如果有事件，添加快速动作
    if (summary.attentionItems > 0) {
      availableActions.push({
        actionType: 'view_incidents',
        label: `查看关注项 (${summary.attentionItems})`,
        targetType: 'incident',
        style: 'warning',
      });
    }
    
    // 构建内容
    const content = {
      overallStatus: controlSnapshot.opsView.overallStatus,
      healthScore: summary.healthScore,
      totalTasks: summary.totalTasks,
      pendingApprovals: summary.pendingApprovals,
      activeAgents: summary.activeAgents,
      attentionItems: summary.attentionItems,
      blockedTasks: controlSnapshot.taskView.blockedTasks.length,
      failedTasks: controlSnapshot.taskView.failedTasks.length,
      timeoutApprovals: controlSnapshot.approvalView.timeoutApprovals.length,
      activeIncidents: controlSnapshot.opsView.activeIncidents.length,
    };
    
    return {
      viewKind: 'dashboard',
      title: '系统概览',
      subtitle: `Workspace: ${input.controlSnapshot.snapshotId}`,
      mode,
      summary: this.buildDashboardSummary(summary),
      content,
      availableActions,
      breadcrumbs: ['Dashboard'],
      generatedAt: now,
      freshnessMs: now - controlSnapshot.createdAt,
    };
  }
  
  buildTaskView(input: BuildTaskViewInput): OperatorViewPayload {
    const { controlSnapshot, mode = 'summary', surface = 'cli' } = input;
    const now = Date.now();
    const taskView = controlSnapshot.taskView;
    
    const availableActions: OperatorViewAction[] = [];
    
    // 为失败任务添加重试动作
    for (const task of taskView.failedTasks.slice(0, 3)) {
      availableActions.push({
        actionType: 'retry_task',
        label: `重试：${task.title || task.taskId}`,
        targetType: 'task',
        targetId: task.taskId,
        style: 'warning',
        requiresConfirmation: false,
      });
    }
    
    // 为阻塞任务添加重试动作
    for (const task of taskView.blockedTasks.slice(0, 3)) {
      availableActions.push({
        actionType: 'retry_task',
        label: `重试：${task.title || task.taskId}`,
        targetType: 'task',
        targetId: task.taskId,
        style: 'primary',
      });
    }
    
    const content = {
      activeTasks: taskView.activeTasks.map(t => ({
        id: t.taskId,
        title: t.title,
        status: t.status,
        priority: t.priority,
      })),
      blockedTasks: taskView.blockedTasks.map(t => ({
        id: t.taskId,
        title: t.title,
        reason: t.blockedReason,
      })),
      failedTasks: taskView.failedTasks.map(t => ({
        id: t.taskId,
        title: t.title,
        retryCount: t.retryCount,
      })),
    };
    
    return {
      viewKind: 'tasks',
      title: '任务视图',
      subtitle: `总计：${taskView.totalTasks} 个任务`,
      mode,
      summary: `活跃 ${taskView.activeTasks.length} | 阻塞 ${taskView.blockedTasks.length} | 失败 ${taskView.failedTasks.length}`,
      content,
      availableActions,
      breadcrumbs: ['Dashboard', 'Tasks'],
      generatedAt: now,
      freshnessMs: now - controlSnapshot.createdAt,
    };
  }
  
  buildApprovalView(input: BuildApprovalViewInput): OperatorViewPayload {
    const { controlSnapshot, mode = 'summary', surface = 'cli' } = input;
    const now = Date.now();
    const approvalView = controlSnapshot.approvalView;
    
    const availableActions: OperatorViewAction[] = [];
    
    // 为待处理审批添加批准/拒绝动作
    for (const approval of approvalView.pendingApprovals.slice(0, 5)) {
      availableActions.push(
        {
          actionType: 'approve',
          label: `批准：${approval.approvalId}`,
          targetType: 'approval',
          targetId: approval.approvalId,
          style: 'primary',
          requiresConfirmation: true,
        },
        {
          actionType: 'reject',
          label: `拒绝：${approval.approvalId}`,
          targetType: 'approval',
          targetId: approval.approvalId,
          style: 'danger',
          requiresConfirmation: true,
        }
      );
    }
    
    const content = {
      pendingApprovals: approvalView.pendingApprovals.map(a => ({
        id: a.approvalId,
        scope: a.scope,
        reason: a.reason,
        ageMs: a.ageMs,
        requestingAgent: a.requestingAgent,
      })),
      bottlenecks: approvalView.bottlenecks,
      timeoutApprovals: approvalView.timeoutApprovals.map(a => ({
        id: a.approvalId,
        scope: a.scope,
        ageMs: a.ageMs,
      })),
    };
    
    return {
      viewKind: 'approvals',
      title: '审批视图',
      subtitle: `总计：${approvalView.totalApprovals} 个审批`,
      mode,
      summary: `待处理 ${approvalView.pendingApprovals.length} | 超时 ${approvalView.timeoutApprovals.length}`,
      content,
      availableActions,
      breadcrumbs: ['Dashboard', 'Approvals'],
      generatedAt: now,
      freshnessMs: now - controlSnapshot.createdAt,
    };
  }
  
  buildIncidentView(input: BuildIncidentViewInput): OperatorViewPayload {
    const { controlSnapshot, dashboardSnapshot, mode = 'summary', surface = 'cli' } = input;
    const now = Date.now();
    const opsView = controlSnapshot.opsView;
    
    const availableActions: OperatorViewAction[] = [];
    
    // 为未确认事件添加确认动作
    for (const incident of opsView.activeIncidents.slice(0, 5)) {
      if (!incident.acknowledged) {
        availableActions.push({
          actionType: 'ack_incident',
          label: `确认：${incident.id}`,
          targetType: 'incident',
          targetId: incident.id,
          style: 'primary',
        });
      }
    }
    
    const content = {
      overallStatus: opsView.overallStatus,
      healthScore: opsView.healthScore,
      activeIncidents: opsView.activeIncidents.map(i => ({
        id: i.id,
        type: i.type,
        severity: i.severity,
        description: i.description,
        acknowledged: i.acknowledged,
      })),
      degradedServers: opsView.degradedServers,
      blockedSkills: opsView.blockedSkills,
      replayHotspots: opsView.replayHotspots,
    };
    
    return {
      viewKind: 'incidents',
      title: '事件视图',
      subtitle: `健康评分：${opsView.healthScore}`,
      mode,
      summary: `活跃事件 ${opsView.activeIncidents.length} | 降级 Server ${opsView.degradedServers.length}`,
      content,
      availableActions,
      breadcrumbs: ['Dashboard', 'Incidents'],
      generatedAt: now,
      freshnessMs: now - controlSnapshot.createdAt,
    };
  }
  
  buildAgentView(input: BuildAgentViewInput): OperatorViewPayload {
    const { controlSnapshot, mode = 'summary', surface = 'cli' } = input;
    const now = Date.now();
    const agentView = controlSnapshot.agentView;
    
    const availableActions: OperatorViewAction[] = [];
    
    // 为阻塞 Agent 添加检查动作
    for (const agent of agentView.blockedAgents.slice(0, 3)) {
      availableActions.push({
        actionType: 'inspect_agent',
        label: `检查：${agent.agentId}`,
        targetType: 'agent',
        targetId: agent.agentId,
        style: 'warning',
      });
    }
    
    const content = {
      busyAgents: agentView.busyAgents.map(a => ({
        id: a.agentId,
        role: a.role,
        activeTaskCount: a.activeTaskCount,
      })),
      blockedAgents: agentView.blockedAgents.map(a => ({
        id: a.agentId,
        role: a.role,
        blockedTaskCount: a.blockedTaskCount,
      })),
      unhealthyAgents: agentView.unhealthyAgents.map(a => ({
        id: a.agentId,
        role: a.role,
        failureRate: a.failureRate,
        healthScore: a.healthScore,
      })),
      offlineAgents: agentView.offlineAgents.map(a => ({
        id: a.agentId,
        role: a.role,
        lastSeenAt: a.lastSeenAt,
      })),
    };
    
    return {
      viewKind: 'agents',
      title: 'Agent 视图',
      subtitle: `总计：${agentView.totalAgents} 个 Agent`,
      mode,
      summary: `忙碌 ${agentView.busyAgents.length} | 阻塞 ${agentView.blockedAgents.length} | 不健康 ${agentView.unhealthyAgents.length} | 离线 ${agentView.offlineAgents.length}`,
      content,
      availableActions,
      breadcrumbs: ['Dashboard', 'Agents'],
      generatedAt: now,
      freshnessMs: now - controlSnapshot.createdAt,
    };
  }
  
  buildInboxView(input: BuildInboxViewInput): OperatorViewPayload {
    const { controlSnapshot, humanLoopSnapshot, mode = 'summary', surface = 'cli' } = input;
    const now = Date.now();
    
    // 轻量聚合：pending approvals + active incidents + blocked tasks + interventions
    const content = {
      pendingApprovals: controlSnapshot.approvalView.pendingApprovals.slice(0, 5).map(a => ({
        id: a.approvalId,
        scope: a.scope,
        ageMs: a.ageMs,
      })),
      activeIncidents: controlSnapshot.opsView.activeIncidents.slice(0, 5).map(i => ({
        id: i.id,
        type: i.type,
        severity: i.severity,
      })),
      blockedTasks: controlSnapshot.taskView.blockedTasks.slice(0, 5).map(t => ({
        id: t.taskId,
        title: t.title,
        reason: t.blockedReason,
      })),
      openInterventions: humanLoopSnapshot?.openInterventions.slice(0, 5).map(i => ({
        id: i.id,
        sourceType: i.sourceType,
        severity: i.severity,
        title: i.title,
      })) || [],
    };
    
    const availableActions: OperatorViewAction[] = [
      {
        actionType: 'view_approvals',
        label: '查看所有审批',
        targetType: 'approval',
        style: 'default',
      },
      {
        actionType: 'view_incidents',
        label: '查看所有事件',
        targetType: 'incident',
        style: 'default',
      },
      {
        actionType: 'view_tasks',
        label: '查看所有任务',
        targetType: 'task',
        style: 'default',
      },
    ];
    
    return {
      viewKind: 'inbox',
      title: '收件箱',
      subtitle: '聚合待处理项',
      mode,
      summary: this.buildInboxSummary(content),
      content,
      availableActions,
      breadcrumbs: ['Dashboard', 'Inbox'],
      generatedAt: now,
      freshnessMs: now - controlSnapshot.createdAt,
    };
  }
  
  buildInterventionView(input: BuildInterventionViewInput): OperatorViewPayload {
    const { humanLoopSnapshot, mode = 'summary', surface = 'cli' } = input;
    const now = Date.now();
    
    const availableActions: OperatorViewAction[] = [];
    
    // 为开放介入添加动作
    for (const intervention of humanLoopSnapshot.openInterventions.slice(0, 5)) {
      availableActions.push({
        actionType: 'dismiss_intervention',
        label: `忽略：${intervention.id}`,
        targetType: 'intervention',
        targetId: intervention.id,
        style: 'default',
      });
    }
    
    const content = {
      openInterventions: humanLoopSnapshot.openInterventions.map(i => ({
        id: i.id,
        sourceType: i.sourceType,
        sourceId: i.sourceId,
        severity: i.severity,
        title: i.title,
        reason: i.reason,
        status: i.status,
      })),
      queuedConfirmations: humanLoopSnapshot.queuedConfirmations.map(c => ({
        actionId: c.actionId,
        actionType: c.actionType,
        status: c.status,
      })),
      suggestions: humanLoopSnapshot.suggestions.map(s => ({
        id: s.id,
        label: s.label,
        recommended: s.recommended,
      })),
    };
    
    return {
      viewKind: 'interventions',
      title: '介入视图',
      subtitle: `开放 ${humanLoopSnapshot.summary.openCount} 个介入`,
      mode,
      summary: `开放 ${humanLoopSnapshot.summary.openCount} | 紧急 ${humanLoopSnapshot.summary.criticalCount} | 待确认 ${humanLoopSnapshot.summary.pendingConfirmations}`,
      content,
      availableActions,
      breadcrumbs: ['Dashboard', 'Interventions'],
      generatedAt: now,
      freshnessMs: 0,
    };
  }
  
  buildDetailView(input: BuildDetailViewInput): OperatorViewPayload {
    const { targetType, targetId, data, mode = 'detail', surface = 'cli' } = input;
    const now = Date.now();
    
    const availableActions: OperatorViewAction[] = [
      {
        actionType: 'go_back',
        label: '返回',
        style: 'default',
      },
      {
        actionType: 'refresh',
        label: '刷新',
        style: 'default',
      },
    ];
    
    return {
      viewKind: 'item_detail',
      title: `${this.formatTargetType(targetType)} 详情`,
      subtitle: `ID: ${targetId}`,
      mode,
      summary: undefined,
      content: data,
      availableActions,
      breadcrumbs: ['Dashboard', this.formatTargetType(targetType), targetId],
      generatedAt: now,
      freshnessMs: 0,
    };
  }
  
  // ============================================================================
  // 辅助方法
  // ============================================================================
  
  private buildDashboardSummary(summary: ControlSurfaceSnapshot['summary']): string {
    const parts: string[] = [];
    
    parts.push(`任务 ${summary.totalTasks}`);
    parts.push(`审批 ${summary.pendingApprovals}`);
    parts.push(`健康 ${summary.healthScore}`);
    
    if (summary.attentionItems > 0) {
      parts.push(`关注 ${summary.attentionItems}`);
    }
    
    return parts.join(' | ');
  }
  
  private buildInboxSummary(content: any): string {
    const parts: string[] = [];
    
    if (content.pendingApprovals?.length) {
      parts.push(`审批 ${content.pendingApprovals.length}`);
    }
    if (content.activeIncidents?.length) {
      parts.push(`事件 ${content.activeIncidents.length}`);
    }
    if (content.blockedTasks?.length) {
      parts.push(`阻塞 ${content.blockedTasks.length}`);
    }
    if (content.openInterventions?.length) {
      parts.push(`介入 ${content.openInterventions.length}`);
    }
    
    return parts.length > 0 ? parts.join(' | ') : '收件箱为空';
  }
  
  private formatTargetType(targetType: string): string {
    const mapping: Record<string, string> = {
      task: '任务',
      approval: '审批',
      incident: '事件',
      agent: 'Agent',
      intervention: '介入',
      workspace: 'Workspace',
    };
    return mapping[targetType] || targetType;
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createOperatorViewFactory(): OperatorViewFactory {
  return new DefaultOperatorViewFactory();
}
