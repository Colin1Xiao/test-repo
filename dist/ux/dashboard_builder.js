"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardBuilder = void 0;
exports.createDashboardBuilder = createDashboardBuilder;
exports.buildDashboardSnapshot = buildDashboardSnapshot;
const attention_engine_1 = require("./attention_engine");
// ============================================================================
// 仪表盘构建器
// ============================================================================
class DashboardBuilder {
    constructor(config = {}) {
        this.config = {
            maxSections: config.maxSections ?? 6,
            maxCardsPerSection: config.maxCardsPerSection ?? 10,
            maxAttentionItems: config.maxAttentionItems ?? 20,
            maxRecommendedActions: config.maxRecommendedActions ?? 10,
            defaultFreshnessThresholdMs: config.defaultFreshnessThresholdMs ?? 60000, // 1 分钟
        };
        this.attentionEngine = new attention_engine_1.AttentionEngine();
    }
    /**
     * 构建仪表盘快照
     */
    buildDashboardSnapshot(controlSnapshot) {
        const now = Date.now();
        // 生成摘要
        const summary = this.buildSummary(controlSnapshot);
        // 生成分段
        const sections = this.buildSections(controlSnapshot);
        // 生成关注项
        const attentionAnalysis = this.attentionEngine.analyze(controlSnapshot);
        const attentionItems = attentionAnalysis.items.slice(0, this.config.maxAttentionItems);
        // 生成建议动作
        const recommendedActions = this.buildRecommendedActions(controlSnapshot, attentionItems);
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
    refreshDashboardSnapshot(oldDashboard, newControlSnapshot) {
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
    buildSummary(controlSnapshot) {
        const { summary: controlSummary, opsView } = controlSnapshot;
        // 确定总体状态
        const overallStatus = this.determineOverallStatus(controlSnapshot);
        // 计算降级 Agent 数
        const degradedAgents = controlSnapshot.agentView.unhealthyAgents.length +
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
    determineOverallStatus(controlSnapshot) {
        const { opsView, taskView, approvalView, agentView } = controlSnapshot;
        // Critical 条件
        if (opsView.healthScore < 30 ||
            opsView.degradedServers.some(s => s.status === 'unavailable') ||
            taskView.blockedTasks.length > 10 ||
            approvalView.timeoutApprovals.length > 5) {
            return 'critical';
        }
        // Blocked 条件
        if (opsView.healthScore < 50 ||
            taskView.blockedTasks.length > 5 ||
            approvalView.pendingApprovals.length > 20) {
            return 'blocked';
        }
        // Degraded 条件
        if (opsView.healthScore < 70 ||
            opsView.degradedServers.length > 0 ||
            agentView.unhealthyAgents.length > 0) {
            return 'degraded';
        }
        return 'healthy';
    }
    /**
     * 构建分段
     */
    buildSections(controlSnapshot) {
        const sections = [];
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
    buildAttentionSection(controlSnapshot) {
        const attentionAnalysis = this.attentionEngine.analyze(controlSnapshot);
        const items = attentionAnalysis.items.slice(0, this.config.maxCardsPerSection);
        const cards = items.map(item => ({
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
    buildTaskSection(taskView) {
        const cards = [];
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
                    },
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
    buildApprovalSection(approvalView) {
        const cards = [];
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
                    },
                    {
                        type: 'reject',
                        targetType: 'approval',
                        targetId: approval.approvalId,
                        requestedBy: 'dashboard',
                        requestedAt: Date.now(),
                    },
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
    buildOpsSection(opsView) {
        const cards = [];
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
    buildAgentSection(agentView) {
        const cards = [];
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
    buildActionSection(availableActions) {
        const cards = availableActions.slice(0, this.config.maxCardsPerSection).map(action => ({
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
    buildRecommendedActions(controlSnapshot, attentionItems) {
        const actions = [];
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
    detectChanges(oldDashboard, newDashboard) {
        const changes = {
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
exports.DashboardBuilder = DashboardBuilder;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建仪表盘构建器
 */
function createDashboardBuilder(config) {
    return new DashboardBuilder(config);
}
/**
 * 快速构建仪表盘快照
 */
function buildDashboardSnapshot(controlSnapshot, config) {
    const builder = new DashboardBuilder(config);
    return builder.buildDashboardSnapshot(controlSnapshot);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGFzaGJvYXJkX2J1aWxkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdXgvZGFzaGJvYXJkX2J1aWxkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7Ozs7R0FZRzs7O0FBNG1CSCx3REFFQztBQUtELHdEQU1DO0FBMW1CRCx5REFBdUU7QUFFdkUsK0VBQStFO0FBQy9FLFNBQVM7QUFDVCwrRUFBK0U7QUFFL0UsTUFBYSxnQkFBZ0I7SUFJM0IsWUFBWSxTQUFpQyxFQUFFO1FBQzdDLElBQUksQ0FBQyxNQUFNLEdBQUc7WUFDWixXQUFXLEVBQUUsTUFBTSxDQUFDLFdBQVcsSUFBSSxDQUFDO1lBQ3BDLGtCQUFrQixFQUFFLE1BQU0sQ0FBQyxrQkFBa0IsSUFBSSxFQUFFO1lBQ25ELGlCQUFpQixFQUFFLE1BQU0sQ0FBQyxpQkFBaUIsSUFBSSxFQUFFO1lBQ2pELHFCQUFxQixFQUFFLE1BQU0sQ0FBQyxxQkFBcUIsSUFBSSxFQUFFO1lBQ3pELDJCQUEyQixFQUFFLE1BQU0sQ0FBQywyQkFBMkIsSUFBSSxLQUFLLEVBQUUsT0FBTztTQUNsRixDQUFDO1FBQ0YsSUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFJLGtDQUFlLEVBQUUsQ0FBQztJQUMvQyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxzQkFBc0IsQ0FDcEIsZUFBdUM7UUFFdkMsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBRXZCLE9BQU87UUFDUCxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBRW5ELE9BQU87UUFDUCxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBRXJELFFBQVE7UUFDUixNQUFNLGlCQUFpQixHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQ3hFLE1BQU0sY0FBYyxH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QkFBc0IsQ0FDcEMsZUFBdUMsRUFDdkMsTUFBK0I7SUFFL0IsTUFBTSxPQUFPLEdBQUcsSUFBSSxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUM3QyxPQUFPLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQyxlQUFlLENBQUMsQ0FBQztBQUN6RCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBEYXNoYm9hcmQgQnVpbGRlciAtIOS7quihqOebmOaehOW7uuWZqFxuICogXG4gKiDogYzotKPvvJpcbiAqIDEuIOaKiiBDb250cm9sU3VyZmFjZVNuYXBzaG90IOi9rOaIkCBEYXNoYm9hcmRTbmFwc2hvdFxuICogMi4g55Sf5oiQIHNlY3Rpb25zIC8gY2FyZHNcbiAqIDMuIOW9kuW5tiBzdW1tYXJ5XG4gKiA0LiDorqHnrpcgYmFkZ2UgLyBzZXZlcml0eSAvIGZyZXNobmVzc1xuICogNS4g55Sf5oiQIHRvcCBhdHRlbnRpb24gaXRlbXNcbiAqIFxuICogQHZlcnNpb24gdjAuMS4wXG4gKiBAZGF0ZSAyMDI2LTA0LTAzXG4gKi9cblxuaW1wb3J0IHR5cGUge1xuICBDb250cm9sU3VyZmFjZVNuYXBzaG90LFxuICBDb250cm9sQWN0aW9uLFxufSBmcm9tICcuL2NvbnRyb2xfdHlwZXMnO1xuaW1wb3J0IHR5cGUge1xuICBEYXNoYm9hcmRTbmFwc2hvdCxcbiAgRGFzaGJvYXJkU3VtbWFyeSxcbiAgRGFzaGJvYXJkU2VjdGlvbixcbiAgRGFzaGJvYXJkQ2FyZCxcbiAgU3RhdHVzQmFkZ2UsXG4gIEF0dGVudGlvbkl0ZW0sXG4gIERhc2hib2FyZEJ1aWxkZXJDb25maWcsXG59IGZyb20gJy4vZGFzaGJvYXJkX3R5cGVzJztcbmltcG9ydCB7IEF0dGVudGlvbkVuZ2luZSwgYW5hbHl6ZUF0dGVudGlvbiB9IGZyb20gJy4vYXR0ZW50aW9uX2VuZ2luZSc7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOS7quihqOebmOaehOW7uuWZqFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgY2xhc3MgRGFzaGJvYXJkQnVpbGRlciB7XG4gIHByaXZhdGUgY29uZmlnOiBSZXF1aXJlZDxEYXNoYm9hcmRCdWlsZGVyQ29uZmlnPjtcbiAgcHJpdmF0ZSBhdHRlbnRpb25FbmdpbmU6IEF0dGVudGlvbkVuZ2luZTtcbiAgXG4gIGNvbnN0cnVjdG9yKGNvbmZpZzogRGFzaGJvYXJkQnVpbGRlckNvbmZpZyA9IHt9KSB7XG4gICAgdGhpcy5jb25maWcgPSB7XG4gICAgICBtYXhTZWN0aW9uczogY29uZmlnLm1heFNlY3Rpb25zID8/IDYsXG4gICAgICBtYXhDYXJkc1BlclNlY3Rpb246IGNvbmZpZy5tYXhDYXJkc1BlclNlY3Rpb24gPz8gMTAsXG4gICAgICBtYXhBdHRlbnRpb25JdGVtczogY29uZmlnLm1heEF0dGVudGlvbkl0ZW1zID8/IDIwLFxuICAgICAgbWF4UmVjb21tZW5kZWRBY3Rpb25zOiBjb25maWcubWF4UmVjb21tZW5kZWRBY3Rpb25zID8/IDEwLFxuICAgICAgZGVmYXVsdEZyZXNobmVzc1RocmVzaG9sZE1zOiBjb25maWcuZGVmYXVsdEZyZXNobmVzc1RocmVzaG9sZE1zID8/IDYwMDAwLCAvLyAxIOWIhumSn1xuICAgIH07XG4gICAgdGhpcy5hdHRlbnRpb25FbmdpbmUgPSBuZXcgQXR0ZW50aW9uRW5naW5lKCk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmnoTlu7rku6rooajnm5jlv6vnhadcbiAgICovXG4gIGJ1aWxkRGFzaGJvYXJkU25hcHNob3QoXG4gICAgY29udHJvbFNuYXBzaG90OiBDb250cm9sU3VyZmFjZVNuYXBzaG90XG4gICk6IERhc2hib2FyZFNuYXBzaG90IHtcbiAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuICAgIFxuICAgIC8vIOeUn+aIkOaRmOimgVxuICAgIGNvbnN0IHN1bW1hcnkgPSB0aGlzLmJ1aWxkU3VtbWFyeShjb250cm9sU25hcHNob3QpO1xuICAgIFxuICAgIC8vIOeUn+aIkOWIhuautVxuICAgIGNvbnN0IHNlY3Rpb25zID0gdGhpcy5idWlsZFNlY3Rpb25zKGNvbnRyb2xTbmFwc2hvdCk7XG4gICAgXG4gICAgLy8g55Sf5oiQ5YWz5rOo6aG5XG4gICAgY29uc3QgYXR0ZW50aW9uQW5hbHlzaXMgPSB0aGlzLmF0dGVudGlvbkVuZ2luZS5hbmFseXplKGNvbnRyb2xTbmFwc2hvdCk7XG4gICAgY29uc3QgYXR0ZW50aW9uSXRlbXMgPSBhdHRlbnRpb25BbmFseXNpcy5pdGVtcy5zbGljZSgwLCB0aGlzLmNvbmZpZy5tYXhBdHRlbnRpb25JdGVtcyk7XG4gICAgXG4gICAgLy8g55Sf5oiQ5bu66K6u5Yqo5L2cXG4gICAgY29uc3QgcmVjb21tZW5kZWRBY3Rpb25zID0gdGhpcy5idWlsZFJlY29tbWVuZGVkQWN0aW9ucyhcbiAgICAgIGNvbnRyb2xTbmFwc2hvdCxcbiAgICAgIGF0dGVudGlvbkl0ZW1zXG4gICAgKTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgZGFzaGJvYXJkSWQ6IGBkYXNoYm9hcmRfJHtub3d9YCxcbiAgICAgIHNvdXJjZVNuYXBzaG90SWQ6IGNvbnRyb2xTbmFwc2hvdC5zbmFwc2hvdElkLFxuICAgICAgY3JlYXRlZEF0OiBub3csXG4gICAgICB1cGRhdGVkQXQ6IG5vdyxcbiAgICAgIGZyZXNobmVzc01zOiAwLFxuICAgICAgc3VtbWFyeSxcbiAgICAgIHNlY3Rpb25zLFxuICAgICAgYXR0ZW50aW9uSXRlbXMsXG4gICAgICByZWNvbW1lbmRlZEFjdGlvbnMsXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOWIt+aWsOS7quihqOebmOW/q+eFp1xuICAgKi9cbiAgcmVmcmVzaERhc2hib2FyZFNuYXBzaG90KFxuICAgIG9sZERhc2hib2FyZDogRGFzaGJvYXJkU25hcHNob3QsXG4gICAgbmV3Q29udHJvbFNuYXBzaG90OiBDb250cm9sU3VyZmFjZVNuYXBzaG90XG4gICk6IHtcbiAgICBkYXNoYm9hcmQ6IERhc2hib2FyZFNuYXBzaG90O1xuICAgIGNoYW5nZXM/OiBhbnk7XG4gIH0ge1xuICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4gICAgY29uc3QgbmV3RGFzaGJvYXJkID0gdGhpcy5idWlsZERhc2hib2FyZFNuYXBzaG90KG5ld0NvbnRyb2xTbmFwc2hvdCk7XG4gICAgXG4gICAgLy8g6K6h566X5paw6bKc5bqmXG4gICAgbmV3RGFzaGJvYXJkLmZyZXNobmVzc01zID0gbm93IC0gb2xkRGFzaGJvYXJkLmNyZWF0ZWRBdDtcbiAgICBcbiAgICAvLyDmo4DmtYvlj5jljJZcbiAgICBjb25zdCBjaGFuZ2VzID0gdGhpcy5kZXRlY3RDaGFuZ2VzKG9sZERhc2hib2FyZCwgbmV3RGFzaGJvYXJkKTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgZGFzaGJvYXJkOiBuZXdEYXNoYm9hcmQsXG4gICAgICBjaGFuZ2VzLFxuICAgIH07XG4gIH1cbiAgXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgLy8g5YaF6YOo5pa55rOVXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgXG4gIC8qKlxuICAgKiDmnoTlu7rmkZjopoFcbiAgICovXG4gIHByaXZhdGUgYnVpbGRTdW1tYXJ5KFxuICAgIGNvbnRyb2xTbmFwc2hvdDogQ29udHJvbFN1cmZhY2VTbmFwc2hvdFxuICApOiBEYXNoYm9hcmRTdW1tYXJ5IHtcbiAgICBjb25zdCB7IHN1bW1hcnk6IGNvbnRyb2xTdW1tYXJ5LCBvcHNWaWV3IH0gPSBjb250cm9sU25hcHNob3Q7XG4gICAgXG4gICAgLy8g56Gu5a6a5oC75L2T54q25oCBXG4gICAgY29uc3Qgb3ZlcmFsbFN0YXR1cyA9IHRoaXMuZGV0ZXJtaW5lT3ZlcmFsbFN0YXR1cyhjb250cm9sU25hcHNob3QpO1xuICAgIFxuICAgIC8vIOiuoeeul+mZjee6pyBBZ2VudCDmlbBcbiAgICBjb25zdCBkZWdyYWRlZEFnZW50cyA9XG4gICAgICBjb250cm9sU25hcHNob3QuYWdlbnRWaWV3LnVuaGVhbHRoeUFnZW50cy5sZW5ndGggK1xuICAgICAgY29udHJvbFNuYXBzaG90LmFnZW50Vmlldy5ibG9ja2VkQWdlbnRzLmxlbmd0aDtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgb3ZlcmFsbFN0YXR1cyxcbiAgICAgIHRvdGFsVGFza3M6IGNvbnRyb2xTdW1tYXJ5LnRvdGFsVGFza3MsXG4gICAgICBibG9ja2VkVGFza3M6IGNvbnRyb2xTbmFwc2hvdC50YXNrVmlldy5ibG9ja2VkVGFza3MubGVuZ3RoLFxuICAgICAgcGVuZGluZ0FwcHJvdmFsczogY29udHJvbFN1bW1hcnkucGVuZGluZ0FwcHJvdmFscyxcbiAgICAgIGFjdGl2ZUluY2lkZW50czogb3BzVmlldy5hY3RpdmVJbmNpZGVudHMuZmlsdGVyKGkgPT4gIWkuYWNrbm93bGVkZ2VkKS5sZW5ndGgsXG4gICAgICBkZWdyYWRlZEFnZW50cyxcbiAgICAgIGhlYWx0aFNjb3JlOiBjb250cm9sU3VtbWFyeS5oZWFsdGhTY29yZSxcbiAgICAgIGF0dGVudGlvbkNvdW50OiAwLCAvLyDkvJrlnKjlkI7pnaLorqHnrpdcbiAgICB9O1xuICB9XG4gIFxuICAvKipcbiAgICog56Gu5a6a5oC75L2T54q25oCBXG4gICAqL1xuICBwcml2YXRlIGRldGVybWluZU92ZXJhbGxTdGF0dXMoXG4gICAgY29udHJvbFNuYXBzaG90OiBDb250cm9sU3VyZmFjZVNuYXBzaG90XG4gICk6IERhc2hib2FyZFN1bW1hcnlbJ292ZXJhbGxTdGF0dXMnXSB7XG4gICAgY29uc3QgeyBvcHNWaWV3LCB0YXNrVmlldywgYXBwcm92YWxWaWV3LCBhZ2VudFZpZXcgfSA9IGNvbnRyb2xTbmFwc2hvdDtcbiAgICBcbiAgICAvLyBDcml0aWNhbCDmnaHku7ZcbiAgICBpZiAoXG4gICAgICBvcHNWaWV3LmhlYWx0aFNjb3JlIDwgMzAgfHxcbiAgICAgIG9wc1ZpZXcuZGVncmFkZWRTZXJ2ZXJzLnNvbWUocyA9PiBzLnN0YXR1cyA9PT0gJ3VuYXZhaWxhYmxlJykgfHxcbiAgICAgIHRhc2tWaWV3LmJsb2NrZWRUYXNrcy5sZW5ndGggPiAxMCB8fFxuICAgICAgYXBwcm92YWxWaWV3LnRpbWVvdXRBcHByb3ZhbHMubGVuZ3RoID4gNVxuICAgICkge1xuICAgICAgcmV0dXJuICdjcml0aWNhbCc7XG4gICAgfVxuICAgIFxuICAgIC8vIEJsb2NrZWQg5p2h5Lu2XG4gICAgaWYgKFxuICAgICAgb3BzVmlldy5oZWFsdGhTY29yZSA8IDUwIHx8XG4gICAgICB0YXNrVmlldy5ibG9ja2VkVGFza3MubGVuZ3RoID4gNSB8fFxuICAgICAgYXBwcm92YWxWaWV3LnBlbmRpbmdBcHByb3ZhbHMubGVuZ3RoID4gMjBcbiAgICApIHtcbiAgICAgIHJldHVybiAnYmxvY2tlZCc7XG4gICAgfVxuICAgIFxuICAgIC8vIERlZ3JhZGVkIOadoeS7tlxuICAgIGlmIChcbiAgICAgIG9wc1ZpZXcuaGVhbHRoU2NvcmUgPCA3MCB8fFxuICAgICAgb3BzVmlldy5kZWdyYWRlZFNlcnZlcnMubGVuZ3RoID4gMCB8fFxuICAgICAgYWdlbnRWaWV3LnVuaGVhbHRoeUFnZW50cy5sZW5ndGggPiAwXG4gICAgKSB7XG4gICAgICByZXR1cm4gJ2RlZ3JhZGVkJztcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuICdoZWFsdGh5JztcbiAgfVxuICBcbiAgLyoqXG4gICAqIOaehOW7uuWIhuautVxuICAgKi9cbiAgcHJpdmF0ZSBidWlsZFNlY3Rpb25zKFxuICAgIGNvbnRyb2xTbmFwc2hvdDogQ29udHJvbFN1cmZhY2VTbmFwc2hvdFxuICApOiBEYXNoYm9hcmRTZWN0aW9uW10ge1xuICAgIGNvbnN0IHNlY3Rpb25zOiBEYXNoYm9hcmRTZWN0aW9uW10gPSBbXTtcbiAgICBcbiAgICAvLyDlhbPms6jpobnliIbmrrXvvIjmnIDpq5jkvJjlhYjnuqfvvIlcbiAgICBjb25zdCBhdHRlbnRpb25TZWN0aW9uID0gdGhpcy5idWlsZEF0dGVudGlvblNlY3Rpb24oY29udHJvbFNuYXBzaG90KTtcbiAgICBpZiAoYXR0ZW50aW9uU2VjdGlvbi5jYXJkcy5sZW5ndGggPiAwKSB7XG4gICAgICBzZWN0aW9ucy5wdXNoKGF0dGVudGlvblNlY3Rpb24pO1xuICAgIH1cbiAgICBcbiAgICAvLyDku7vliqHliIbmrrVcbiAgICBjb25zdCB0YXNrU2VjdGlvbiA9IHRoaXMuYnVpbGRUYXNrU2VjdGlvbihjb250cm9sU25hcHNob3QudGFza1ZpZXcpO1xuICAgIGlmICh0YXNrU2VjdGlvbi5jYXJkcy5sZW5ndGggPiAwKSB7XG4gICAgICBzZWN0aW9ucy5wdXNoKHRhc2tTZWN0aW9uKTtcbiAgICB9XG4gICAgXG4gICAgLy8g5a6h5om55YiG5q61XG4gICAgY29uc3QgYXBwcm92YWxTZWN0aW9uID0gdGhpcy5idWlsZEFwcHJvdmFsU2VjdGlvbihjb250cm9sU25hcHNob3QuYXBwcm92YWxWaWV3KTtcbiAgICBpZiAoYXBwcm92YWxTZWN0aW9uLmNhcmRzLmxlbmd0aCA+IDApIHtcbiAgICAgIHNlY3Rpb25zLnB1c2goYXBwcm92YWxTZWN0aW9uKTtcbiAgICB9XG4gICAgXG4gICAgLy8g6L+Q57u05YiG5q61XG4gICAgY29uc3Qgb3BzU2VjdGlvbiA9IHRoaXMuYnVpbGRPcHNTZWN0aW9uKGNvbnRyb2xTbmFwc2hvdC5vcHNWaWV3KTtcbiAgICBpZiAob3BzU2VjdGlvbi5jYXJkcy5sZW5ndGggPiAwKSB7XG4gICAgICBzZWN0aW9ucy5wdXNoKG9wc1NlY3Rpb24pO1xuICAgIH1cbiAgICBcbiAgICAvLyBBZ2VudCDliIbmrrVcbiAgICBjb25zdCBhZ2VudFNlY3Rpb24gPSB0aGlzLmJ1aWxkQWdlbnRTZWN0aW9uKGNvbnRyb2xTbmFwc2hvdC5hZ2VudFZpZXcpO1xuICAgIGlmIChhZ2VudFNlY3Rpb24uY2FyZHMubGVuZ3RoID4gMCkge1xuICAgICAgc2VjdGlvbnMucHVzaChhZ2VudFNlY3Rpb24pO1xuICAgIH1cbiAgICBcbiAgICAvLyDliqjkvZzliIbmrrVcbiAgICBjb25zdCBhY3Rpb25TZWN0aW9uID0gdGhpcy5idWlsZEFjdGlvblNlY3Rpb24oY29udHJvbFNuYXBzaG90LmF2YWlsYWJsZUFjdGlvbnMpO1xuICAgIGlmIChhY3Rpb25TZWN0aW9uLmNhcmRzLmxlbmd0aCA+IDApIHtcbiAgICAgIHNlY3Rpb25zLnB1c2goYWN0aW9uU2VjdGlvbik7XG4gICAgfVxuICAgIFxuICAgIC8vIOmZkOWItuWIhuauteaVsOmHj1xuICAgIHJldHVybiBzZWN0aW9ucy5zbGljZSgwLCB0aGlzLmNvbmZpZy5tYXhTZWN0aW9ucyk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmnoTlu7rlhbPms6jpobnliIbmrrVcbiAgICovXG4gIHByaXZhdGUgYnVpbGRBdHRlbnRpb25TZWN0aW9uKFxuICAgIGNvbnRyb2xTbmFwc2hvdDogQ29udHJvbFN1cmZhY2VTbmFwc2hvdFxuICApOiBEYXNoYm9hcmRTZWN0aW9uIHtcbiAgICBjb25zdCBhdHRlbnRpb25BbmFseXNpcyA9IHRoaXMuYXR0ZW50aW9uRW5naW5lLmFuYWx5emUoY29udHJvbFNuYXBzaG90KTtcbiAgICBjb25zdCBpdGVtcyA9IGF0dGVudGlvbkFuYWx5c2lzLml0ZW1zLnNsaWNlKDAsIHRoaXMuY29uZmlnLm1heENhcmRzUGVyU2VjdGlvbik7XG4gICAgXG4gICAgY29uc3QgY2FyZHM6IERhc2hib2FyZENhcmRbXSA9IGl0ZW1zLm1hcChpdGVtID0+ICh7XG4gICAgICBpZDogaXRlbS5pZCxcbiAgICAgIGtpbmQ6ICdhdHRlbnRpb24nLFxuICAgICAgdGl0bGU6IGl0ZW0udGl0bGUsXG4gICAgICBzdWJ0aXRsZTogaXRlbS5yZWFzb24sXG4gICAgICBzdGF0dXM6IGl0ZW0uc2V2ZXJpdHksXG4gICAgICBzZXZlcml0eTogaXRlbS5zZXZlcml0eSxcbiAgICAgIHVwZGF0ZWRBdDogaXRlbS5hZ2VNcyA/IERhdGUubm93KCkgLSBpdGVtLmFnZU1zIDogdW5kZWZpbmVkLFxuICAgICAgZmllbGRzOiB7XG4gICAgICAgIHNvdXJjZVR5cGU6IGl0ZW0uc291cmNlVHlwZSxcbiAgICAgICAgc291cmNlSWQ6IGl0ZW0uc291cmNlSWQsXG4gICAgICB9LFxuICAgICAgc3VnZ2VzdGVkQWN0aW9uczogaXRlbS5yZWNvbW1lbmRlZEFjdGlvbiA/IFtpdGVtLnJlY29tbWVuZGVkQWN0aW9uXSA6IHVuZGVmaW5lZCxcbiAgICB9KSk7XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIGlkOiAnc2VjdGlvbl9hdHRlbnRpb24nLFxuICAgICAgdHlwZTogJ2luY2lkZW50cycsXG4gICAgICB0aXRsZTogJ0F0dGVudGlvbiBSZXF1aXJlZCcsXG4gICAgICBwcmlvcml0eTogMCxcbiAgICAgIGNvbGxhcHNlZDogZmFsc2UsXG4gICAgICBiYWRnZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIHR5cGU6ICdzZXZlcml0eScsXG4gICAgICAgICAgdmFsdWU6IGAke2l0ZW1zLmxlbmd0aH0gaXRlbXNgLFxuICAgICAgICAgIHN0eWxlOiBpdGVtcy5zb21lKGkgPT4gaS5zZXZlcml0eSA9PT0gJ2NyaXRpY2FsJykgPyAnZXJyb3InIDogJ3dhcm5pbmcnLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIGNhcmRzLFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmnoTlu7rku7vliqHliIbmrrVcbiAgICovXG4gIHByaXZhdGUgYnVpbGRUYXNrU2VjdGlvbihcbiAgICB0YXNrVmlldzogYW55XG4gICk6IERhc2hib2FyZFNlY3Rpb24ge1xuICAgIGNvbnN0IGNhcmRzOiBEYXNoYm9hcmRDYXJkW10gPSBbXTtcbiAgICBcbiAgICAvLyDpmLvloZ7ku7vliqFcbiAgICBmb3IgKGNvbnN0IHRhc2sgb2YgdGFza1ZpZXcuYmxvY2tlZFRhc2tzLnNsaWNlKDAsIHRoaXMuY29uZmlnLm1heENhcmRzUGVyU2VjdGlvbikpIHtcbiAgICAgIGNhcmRzLnB1c2goe1xuICAgICAgICBpZDogYHRhc2tfJHt0YXNrLnRhc2tJZH1gLFxuICAgICAgICBraW5kOiAndGFzaycsXG4gICAgICAgIHRpdGxlOiB0YXNrLnRpdGxlLFxuICAgICAgICBzdWJ0aXRsZTogdGFzay5ibG9ja2VkUmVhc29uLFxuICAgICAgICBzdGF0dXM6ICdibG9ja2VkJyxcbiAgICAgICAgc2V2ZXJpdHk6IHRhc2sucmlzayxcbiAgICAgICAgb3duZXI6IHRhc2sub3duZXJBZ2VudCxcbiAgICAgICAgdXBkYXRlZEF0OiB0YXNrLnVwZGF0ZWRBdCxcbiAgICAgICAgZmllbGRzOiB7XG4gICAgICAgICAgdGFza0lkOiB0YXNrLnRhc2tJZCxcbiAgICAgICAgICBwcmlvcml0eTogdGFzay5wcmlvcml0eSxcbiAgICAgICAgICBwcm9ncmVzczogdGFzay5wcm9ncmVzcyxcbiAgICAgICAgfSxcbiAgICAgICAgc3VnZ2VzdGVkQWN0aW9uczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHR5cGU6ICdyZXRyeV90YXNrJyxcbiAgICAgICAgICAgIHRhcmdldFR5cGU6ICd0YXNrJyxcbiAgICAgICAgICAgIHRhcmdldElkOiB0YXNrLnRhc2tJZCxcbiAgICAgICAgICAgIHJlcXVlc3RlZEJ5OiAnZGFzaGJvYXJkJyxcbiAgICAgICAgICAgIHJlcXVlc3RlZEF0OiBEYXRlLm5vdygpLFxuICAgICAgICAgIH0gYXMgQ29udHJvbEFjdGlvbixcbiAgICAgICAgXSxcbiAgICAgIH0pO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgaWQ6ICdzZWN0aW9uX3Rhc2tzJyxcbiAgICAgIHR5cGU6ICd0YXNrcycsXG4gICAgICB0aXRsZTogJ1Rhc2tzJyxcbiAgICAgIHByaW9yaXR5OiAxLFxuICAgICAgY29sbGFwc2VkOiB0YXNrVmlldy5ibG9ja2VkVGFza3MubGVuZ3RoID09PSAwLFxuICAgICAgYmFkZ2VzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICB0eXBlOiAnc3RhdHVzJyxcbiAgICAgICAgICB2YWx1ZTogYCR7dGFza1ZpZXcuYmxvY2tlZFRhc2tzLmxlbmd0aH0gYmxvY2tlZGAsXG4gICAgICAgICAgc3R5bGU6IHRhc2tWaWV3LmJsb2NrZWRUYXNrcy5sZW5ndGggPiAwID8gJ3dhcm5pbmcnIDogJ3N1Y2Nlc3MnLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIGNhcmRzOiBjYXJkcy5zbGljZSgwLCB0aGlzLmNvbmZpZy5tYXhDYXJkc1BlclNlY3Rpb24pLFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmnoTlu7rlrqHmibnliIbmrrVcbiAgICovXG4gIHByaXZhdGUgYnVpbGRBcHByb3ZhbFNlY3Rpb24oXG4gICAgYXBwcm92YWxWaWV3OiBhbnlcbiAgKTogRGFzaGJvYXJkU2VjdGlvbiB7XG4gICAgY29uc3QgY2FyZHM6IERhc2hib2FyZENhcmRbXSA9IFtdO1xuICAgIFxuICAgIC8vIOW+heWkhOeQhuWuoeaJuVxuICAgIGZvciAoY29uc3QgYXBwcm92YWwgb2YgYXBwcm92YWxWaWV3LnBlbmRpbmdBcHByb3ZhbHMuc2xpY2UoMCwgdGhpcy5jb25maWcubWF4Q2FyZHNQZXJTZWN0aW9uKSkge1xuICAgICAgY29uc3QgYWdlTWludXRlcyA9IE1hdGgucm91bmQoYXBwcm92YWwuYWdlTXMgLyA2MDAwMCk7XG4gICAgICBcbiAgICAgIGNhcmRzLnB1c2goe1xuICAgICAgICBpZDogYGFwcHJvdmFsXyR7YXBwcm92YWwuYXBwcm92YWxJZH1gLFxuICAgICAgICBraW5kOiAnYXBwcm92YWwnLFxuICAgICAgICB0aXRsZTogYXBwcm92YWwuc2NvcGUsXG4gICAgICAgIHN1YnRpdGxlOiBhcHByb3ZhbC5yZWFzb24sXG4gICAgICAgIHN0YXR1czogJ3BlbmRpbmcnLFxuICAgICAgICBzZXZlcml0eTogYWdlTWludXRlcyA+IDYwID8gJ2hpZ2gnIDogJ21lZGl1bScsXG4gICAgICAgIG93bmVyOiBhcHByb3ZhbC5yZXF1ZXN0aW5nQWdlbnQsXG4gICAgICAgIHVwZGF0ZWRBdDogYXBwcm92YWwucmVxdWVzdGVkQXQsXG4gICAgICAgIGZpZWxkczoge1xuICAgICAgICAgIGFwcHJvdmFsSWQ6IGFwcHJvdmFsLmFwcHJvdmFsSWQsXG4gICAgICAgICAgYWdlTWludXRlcyxcbiAgICAgICAgICB0YXNrSWQ6IGFwcHJvdmFsLnRhc2tJZCxcbiAgICAgICAgfSxcbiAgICAgICAgc3VnZ2VzdGVkQWN0aW9uczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHR5cGU6ICdhcHByb3ZlJyxcbiAgICAgICAgICAgIHRhcmdldFR5cGU6ICdhcHByb3ZhbCcsXG4gICAgICAgICAgICB0YXJnZXRJZDogYXBwcm92YWwuYXBwcm92YWxJZCxcbiAgICAgICAgICAgIHJlcXVlc3RlZEJ5OiAnZGFzaGJvYXJkJyxcbiAgICAgICAgICAgIHJlcXVlc3RlZEF0OiBEYXRlLm5vdygpLFxuICAgICAgICAgIH0gYXMgQ29udHJvbEFjdGlvbixcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAncmVqZWN0JyxcbiAgICAgICAgICAgIHRhcmdldFR5cGU6ICdhcHByb3ZhbCcsXG4gICAgICAgICAgICB0YXJnZXRJZDogYXBwcm92YWwuYXBwcm92YWxJZCxcbiAgICAgICAgICAgIHJlcXVlc3RlZEJ5OiAnZGFzaGJvYXJkJyxcbiAgICAgICAgICAgIHJlcXVlc3RlZEF0OiBEYXRlLm5vdygpLFxuICAgICAgICAgIH0gYXMgQ29udHJvbEFjdGlvbixcbiAgICAgICAgXSxcbiAgICAgIH0pO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgaWQ6ICdzZWN0aW9uX2FwcHJvdmFscycsXG4gICAgICB0eXBlOiAnYXBwcm92YWxzJyxcbiAgICAgIHRpdGxlOiAnQXBwcm92YWxzJyxcbiAgICAgIHByaW9yaXR5OiAyLFxuICAgICAgY29sbGFwc2VkOiBhcHByb3ZhbFZpZXcucGVuZGluZ0FwcHJvdmFscy5sZW5ndGggPT09IDAsXG4gICAgICBiYWRnZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIHR5cGU6ICdzdGF0dXMnLFxuICAgICAgICAgIHZhbHVlOiBgJHthcHByb3ZhbFZpZXcucGVuZGluZ0FwcHJvdmFscy5sZW5ndGh9IHBlbmRpbmdgLFxuICAgICAgICAgIHN0eWxlOiBhcHByb3ZhbFZpZXcucGVuZGluZ0FwcHJvdmFscy5sZW5ndGggPiA1ID8gJ3dhcm5pbmcnIDogJ2luZm8nLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgdHlwZTogJ2FnZScsXG4gICAgICAgICAgdmFsdWU6IGFwcHJvdmFsVmlldy5ib3R0bGVuZWNrcy5sZW5ndGggPiAwXG4gICAgICAgICAgICA/IGBBdmcgd2FpdDogJHtNYXRoLnJvdW5kKGFwcHJvdmFsVmlldy5ib3R0bGVuZWNrc1swXS5hdmdXYWl0VGltZU1zIC8gNjAwMDApfW1pbmBcbiAgICAgICAgICAgIDogJ05vIGJvdHRsZW5lY2tzJyxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgICBjYXJkczogY2FyZHMuc2xpY2UoMCwgdGhpcy5jb25maWcubWF4Q2FyZHNQZXJTZWN0aW9uKSxcbiAgICB9O1xuICB9XG4gIFxuICAvKipcbiAgICog5p6E5bu66L+Q57u05YiG5q61XG4gICAqL1xuICBwcml2YXRlIGJ1aWxkT3BzU2VjdGlvbihcbiAgICBvcHNWaWV3OiBhbnlcbiAgKTogRGFzaGJvYXJkU2VjdGlvbiB7XG4gICAgY29uc3QgY2FyZHM6IERhc2hib2FyZENhcmRbXSA9IFtdO1xuICAgIFxuICAgIC8vIOmZjee6pyBTZXJ2ZXJcbiAgICBmb3IgKGNvbnN0IHNlcnZlciBvZiBvcHNWaWV3LmRlZ3JhZGVkU2VydmVycy5zbGljZSgwLCA1KSkge1xuICAgICAgY2FyZHMucHVzaCh7XG4gICAgICAgIGlkOiBgc2VydmVyXyR7c2VydmVyLnNlcnZlcklkfWAsXG4gICAgICAgIGtpbmQ6ICdzZXJ2ZXInLFxuICAgICAgICB0aXRsZTogYFNlcnZlcjogJHtzZXJ2ZXIuc2VydmVySWR9YCxcbiAgICAgICAgc3VidGl0bGU6IGBFcnJvciByYXRlOiAkeyhzZXJ2ZXIuZXJyb3JSYXRlICogMTAwKS50b0ZpeGVkKDEpfSVgLFxuICAgICAgICBzdGF0dXM6IHNlcnZlci5zdGF0dXMsXG4gICAgICAgIHNldmVyaXR5OiBzZXJ2ZXIuc3RhdHVzID09PSAndW5hdmFpbGFibGUnID8gJ2NyaXRpY2FsJyA6ICdoaWdoJyxcbiAgICAgICAgdXBkYXRlZEF0OiBzZXJ2ZXIubGFzdENoZWNrLFxuICAgICAgICBmaWVsZHM6IHtcbiAgICAgICAgICBzZXJ2ZXJJZDogc2VydmVyLnNlcnZlcklkLFxuICAgICAgICAgIGVycm9yUmF0ZTogc2VydmVyLmVycm9yUmF0ZSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgIH1cbiAgICBcbiAgICAvLyDooqvpmLvloZ4gU2tpbGxcbiAgICBmb3IgKGNvbnN0IHNraWxsIG9mIG9wc1ZpZXcuYmxvY2tlZFNraWxscy5zbGljZSgwLCA1KSkge1xuICAgICAgY2FyZHMucHVzaCh7XG4gICAgICAgIGlkOiBgc2tpbGxfJHtza2lsbC5za2lsbE5hbWV9YCxcbiAgICAgICAga2luZDogJ3NraWxsJyxcbiAgICAgICAgdGl0bGU6IGBTa2lsbDogJHtza2lsbC5za2lsbE5hbWV9YCxcbiAgICAgICAgc3VidGl0bGU6IHNraWxsLnJlYXNvbixcbiAgICAgICAgc3RhdHVzOiBza2lsbC5zdGF0dXMsXG4gICAgICAgIHNldmVyaXR5OiAnbWVkaXVtJyxcbiAgICAgICAgZmllbGRzOiB7XG4gICAgICAgICAgc2tpbGxOYW1lOiBza2lsbC5za2lsbE5hbWUsXG4gICAgICAgICAgY291bnQ6IHNraWxsLmNvdW50LFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBpZDogJ3NlY3Rpb25fb3BzJyxcbiAgICAgIHR5cGU6ICdvcHMnLFxuICAgICAgdGl0bGU6ICdPcGVyYXRpb25zJyxcbiAgICAgIHByaW9yaXR5OiAzLFxuICAgICAgY29sbGFwc2VkOiBvcHNWaWV3LmRlZ3JhZGVkU2VydmVycy5sZW5ndGggPT09IDAgJiYgb3BzVmlldy5ibG9ja2VkU2tpbGxzLmxlbmd0aCA9PT0gMCxcbiAgICAgIGJhZGdlczogW1xuICAgICAgICB7XG4gICAgICAgICAgdHlwZTogJ3N0YXR1cycsXG4gICAgICAgICAgdmFsdWU6IGBIZWFsdGg6ICR7b3BzVmlldy5oZWFsdGhTY29yZX0vMTAwYCxcbiAgICAgICAgICBzdHlsZTogb3BzVmlldy5oZWFsdGhTY29yZSA+PSA3MCA/ICdzdWNjZXNzJyA6IG9wc1ZpZXcuaGVhbHRoU2NvcmUgPj0gNTAgPyAnd2FybmluZycgOiAnZXJyb3InLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIGNhcmRzOiBjYXJkcy5zbGljZSgwLCB0aGlzLmNvbmZpZy5tYXhDYXJkc1BlclNlY3Rpb24pLFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmnoTlu7ogQWdlbnQg5YiG5q61XG4gICAqL1xuICBwcml2YXRlIGJ1aWxkQWdlbnRTZWN0aW9uKFxuICAgIGFnZW50VmlldzogYW55XG4gICk6IERhc2hib2FyZFNlY3Rpb24ge1xuICAgIGNvbnN0IGNhcmRzOiBEYXNoYm9hcmRDYXJkW10gPSBbXTtcbiAgICBcbiAgICAvLyDkuI3lgaXlurcgQWdlbnRcbiAgICBmb3IgKGNvbnN0IGFnZW50IG9mIGFnZW50Vmlldy51bmhlYWx0aHlBZ2VudHMuc2xpY2UoMCwgNSkpIHtcbiAgICAgIGNhcmRzLnB1c2goe1xuICAgICAgICBpZDogYGFnZW50XyR7YWdlbnQuYWdlbnRJZH1gLFxuICAgICAgICBraW5kOiAnYWdlbnQnLFxuICAgICAgICB0aXRsZTogYEFnZW50OiAke2FnZW50LmFnZW50SWR9YCxcbiAgICAgICAgc3VidGl0bGU6IGBSb2xlOiAke2FnZW50LnJvbGV9YCxcbiAgICAgICAgc3RhdHVzOiBhZ2VudC5zdGF0dXMsXG4gICAgICAgIHNldmVyaXR5OiAnaGlnaCcsXG4gICAgICAgIG93bmVyOiBhZ2VudC5hZ2VudElkLFxuICAgICAgICB1cGRhdGVkQXQ6IGFnZW50Lmxhc3RTZWVuQXQsXG4gICAgICAgIGZpZWxkczoge1xuICAgICAgICAgIGFnZW50SWQ6IGFnZW50LmFnZW50SWQsXG4gICAgICAgICAgcm9sZTogYWdlbnQucm9sZSxcbiAgICAgICAgICBoZWFsdGhTY29yZTogYWdlbnQuaGVhbHRoU2NvcmUsXG4gICAgICAgICAgZmFpbHVyZVJhdGU6IGFnZW50LmZhaWx1cmVSYXRlLFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgfVxuICAgIFxuICAgIC8vIOmYu+WhniBBZ2VudFxuICAgIGZvciAoY29uc3QgYWdlbnQgb2YgYWdlbnRWaWV3LmJsb2NrZWRBZ2VudHMuc2xpY2UoMCwgNSkpIHtcbiAgICAgIGNhcmRzLnB1c2goe1xuICAgICAgICBpZDogYGFnZW50XyR7YWdlbnQuYWdlbnRJZH1gLFxuICAgICAgICBraW5kOiAnYWdlbnQnLFxuICAgICAgICB0aXRsZTogYEFnZW50OiAke2FnZW50LmFnZW50SWR9YCxcbiAgICAgICAgc3VidGl0bGU6IGBSb2xlOiAke2FnZW50LnJvbGV9YCxcbiAgICAgICAgc3RhdHVzOiAnYmxvY2tlZCcsXG4gICAgICAgIHNldmVyaXR5OiAnbWVkaXVtJyxcbiAgICAgICAgb3duZXI6IGFnZW50LmFnZW50SWQsXG4gICAgICAgIHVwZGF0ZWRBdDogYWdlbnQubGFzdFNlZW5BdCxcbiAgICAgICAgZmllbGRzOiB7XG4gICAgICAgICAgYWdlbnRJZDogYWdlbnQuYWdlbnRJZCxcbiAgICAgICAgICByb2xlOiBhZ2VudC5yb2xlLFxuICAgICAgICAgIGJsb2NrZWRUYXNrQ291bnQ6IGFnZW50LmJsb2NrZWRUYXNrQ291bnQsXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIGlkOiAnc2VjdGlvbl9hZ2VudHMnLFxuICAgICAgdHlwZTogJ2FnZW50cycsXG4gICAgICB0aXRsZTogJ0FnZW50cycsXG4gICAgICBwcmlvcml0eTogNCxcbiAgICAgIGNvbGxhcHNlZDogYWdlbnRWaWV3LnVuaGVhbHRoeUFnZW50cy5sZW5ndGggPT09IDAgJiYgYWdlbnRWaWV3LmJsb2NrZWRBZ2VudHMubGVuZ3RoID09PSAwLFxuICAgICAgYmFkZ2VzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICB0eXBlOiAnc3RhdHVzJyxcbiAgICAgICAgICB2YWx1ZTogYCR7YWdlbnRWaWV3LnRvdGFsQWdlbnRzIC0gYWdlbnRWaWV3Lm9mZmxpbmVBZ2VudHMubGVuZ3RofSBhY3RpdmVgLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIGNhcmRzOiBjYXJkcy5zbGljZSgwLCB0aGlzLmNvbmZpZy5tYXhDYXJkc1BlclNlY3Rpb24pLFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmnoTlu7rliqjkvZzliIbmrrVcbiAgICovXG4gIHByaXZhdGUgYnVpbGRBY3Rpb25TZWN0aW9uKFxuICAgIGF2YWlsYWJsZUFjdGlvbnM6IENvbnRyb2xBY3Rpb25bXVxuICApOiBEYXNoYm9hcmRTZWN0aW9uIHtcbiAgICBjb25zdCBjYXJkczogRGFzaGJvYXJkQ2FyZFtdID0gYXZhaWxhYmxlQWN0aW9ucy5zbGljZSgwLCB0aGlzLmNvbmZpZy5tYXhDYXJkc1BlclNlY3Rpb24pLm1hcChhY3Rpb24gPT4gKHtcbiAgICAgIGlkOiBgYWN0aW9uXyR7YWN0aW9uLnR5cGV9XyR7YWN0aW9uLnRhcmdldElkfWAsXG4gICAgICBraW5kOiAnYWN0aW9uJyxcbiAgICAgIHRpdGxlOiBhY3Rpb24udHlwZSxcbiAgICAgIHN1YnRpdGxlOiBgJHthY3Rpb24udGFyZ2V0VHlwZX06ICR7YWN0aW9uLnRhcmdldElkfWAsXG4gICAgICBzdGF0dXM6ICdhdmFpbGFibGUnLFxuICAgICAgZmllbGRzOiB7XG4gICAgICAgIGFjdGlvblR5cGU6IGFjdGlvbi50eXBlLFxuICAgICAgICB0YXJnZXRUeXBlOiBhY3Rpb24udGFyZ2V0VHlwZSxcbiAgICAgICAgdGFyZ2V0SWQ6IGFjdGlvbi50YXJnZXRJZCxcbiAgICAgIH0sXG4gICAgfSkpO1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBpZDogJ3NlY3Rpb25fYWN0aW9ucycsXG4gICAgICB0eXBlOiAnYWN0aW9ucycsXG4gICAgICB0aXRsZTogJ1JlY29tbWVuZGVkIEFjdGlvbnMnLFxuICAgICAgcHJpb3JpdHk6IDUsXG4gICAgICBjb2xsYXBzZWQ6IGF2YWlsYWJsZUFjdGlvbnMubGVuZ3RoID09PSAwLFxuICAgICAgYmFkZ2VzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICB0eXBlOiAnc3RhdHVzJyxcbiAgICAgICAgICB2YWx1ZTogYCR7YXZhaWxhYmxlQWN0aW9ucy5sZW5ndGh9IGF2YWlsYWJsZWAsXG4gICAgICAgICAgc3R5bGU6IGF2YWlsYWJsZUFjdGlvbnMubGVuZ3RoID4gMCA/ICdpbmZvJyA6ICdzdWNjZXNzJyxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgICBjYXJkcyxcbiAgICB9O1xuICB9XG4gIFxuICAvKipcbiAgICog5p6E5bu65bu66K6u5Yqo5L2cXG4gICAqL1xuICBwcml2YXRlIGJ1aWxkUmVjb21tZW5kZWRBY3Rpb25zKFxuICAgIGNvbnRyb2xTbmFwc2hvdDogQ29udHJvbFN1cmZhY2VTbmFwc2hvdCxcbiAgICBhdHRlbnRpb25JdGVtczogQXR0ZW50aW9uSXRlbVtdXG4gICk6IENvbnRyb2xBY3Rpb25bXSB7XG4gICAgY29uc3QgYWN0aW9uczogQ29udHJvbEFjdGlvbltdID0gW107XG4gICAgXG4gICAgLy8g5LuO5YWz5rOo6aG55pS26ZuG5Yqo5L2cXG4gICAgZm9yIChjb25zdCBpdGVtIG9mIGF0dGVudGlvbkl0ZW1zLnNsaWNlKDAsIHRoaXMuY29uZmlnLm1heFJlY29tbWVuZGVkQWN0aW9ucykpIHtcbiAgICAgIGlmIChpdGVtLnJlY29tbWVuZGVkQWN0aW9uKSB7XG4gICAgICAgIGFjdGlvbnMucHVzaChpdGVtLnJlY29tbWVuZGVkQWN0aW9uKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8g5re75Yqg57O757uf5bu66K6u5Yqo5L2cXG4gICAgaWYgKGNvbnRyb2xTbmFwc2hvdC5hdmFpbGFibGVBY3Rpb25zKSB7XG4gICAgICBmb3IgKGNvbnN0IGFjdGlvbiBvZiBjb250cm9sU25hcHNob3QuYXZhaWxhYmxlQWN0aW9ucy5zbGljZSgwLCA1KSkge1xuICAgICAgICBpZiAoIWFjdGlvbnMuc29tZShhID0+IGEudHlwZSA9PT0gYWN0aW9uLnR5cGUgJiYgYS50YXJnZXRJZCA9PT0gYWN0aW9uLnRhcmdldElkKSkge1xuICAgICAgICAgIGFjdGlvbnMucHVzaChhY3Rpb24pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBhY3Rpb25zLnNsaWNlKDAsIHRoaXMuY29uZmlnLm1heFJlY29tbWVuZGVkQWN0aW9ucyk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmo4DmtYvlj5jljJZcbiAgICovXG4gIHByaXZhdGUgZGV0ZWN0Q2hhbmdlcyhcbiAgICBvbGREYXNoYm9hcmQ6IERhc2hib2FyZFNuYXBzaG90LFxuICAgIG5ld0Rhc2hib2FyZDogRGFzaGJvYXJkU25hcHNob3RcbiAgKTogYW55IHtcbiAgICBjb25zdCBjaGFuZ2VzOiBhbnkgPSB7XG4gICAgICBhZGRlZDogW10sXG4gICAgICByZW1vdmVkOiBbXSxcbiAgICAgIHVwZGF0ZWQ6IFtdLFxuICAgIH07XG4gICAgXG4gICAgLy8g5qOA5rWL54q25oCB5Y+Y5YyWXG4gICAgaWYgKG9sZERhc2hib2FyZC5zdW1tYXJ5Lm92ZXJhbGxTdGF0dXMgIT09IG5ld0Rhc2hib2FyZC5zdW1tYXJ5Lm92ZXJhbGxTdGF0dXMpIHtcbiAgICAgIGNoYW5nZXMuc3RhdHVzQ2hhbmdlZCA9IHtcbiAgICAgICAgZnJvbTogb2xkRGFzaGJvYXJkLnN1bW1hcnkub3ZlcmFsbFN0YXR1cyxcbiAgICAgICAgdG86IG5ld0Rhc2hib2FyZC5zdW1tYXJ5Lm92ZXJhbGxTdGF0dXMsXG4gICAgICB9O1xuICAgIH1cbiAgICBcbiAgICAvLyDmo4DmtYvlgaXlurfor4TliIblj5jljJZcbiAgICBpZiAob2xkRGFzaGJvYXJkLnN1bW1hcnkuaGVhbHRoU2NvcmUgIT09IG5ld0Rhc2hib2FyZC5zdW1tYXJ5LmhlYWx0aFNjb3JlKSB7XG4gICAgICBjaGFuZ2VzLmhlYWx0aFNjb3JlQ2hhbmdlZCA9IHtcbiAgICAgICAgZnJvbTogb2xkRGFzaGJvYXJkLnN1bW1hcnkuaGVhbHRoU2NvcmUsXG4gICAgICAgIHRvOiBuZXdEYXNoYm9hcmQuc3VtbWFyeS5oZWFsdGhTY29yZSxcbiAgICAgIH07XG4gICAgfVxuICAgIFxuICAgIC8vIOajgOa1i+WFs+azqOmhueWPmOWMllxuICAgIGNvbnN0IG9sZEF0dGVudGlvbklkcyA9IG5ldyBTZXQob2xkRGFzaGJvYXJkLmF0dGVudGlvbkl0ZW1zLm1hcChpID0+IGkuaWQpKTtcbiAgICBjb25zdCBuZXdBdHRlbnRpb25JZHMgPSBuZXcgU2V0KG5ld0Rhc2hib2FyZC5hdHRlbnRpb25JdGVtcy5tYXAoaSA9PiBpLmlkKSk7XG4gICAgXG4gICAgZm9yIChjb25zdCBpdGVtIG9mIG5ld0Rhc2hib2FyZC5hdHRlbnRpb25JdGVtcykge1xuICAgICAgaWYgKCFvbGRBdHRlbnRpb25JZHMuaGFzKGl0ZW0uaWQpKSB7XG4gICAgICAgIGNoYW5nZXMuYWRkZWQucHVzaChpdGVtLmlkKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgZm9yIChjb25zdCBpdGVtIG9mIG9sZERhc2hib2FyZC5hdHRlbnRpb25JdGVtcykge1xuICAgICAgaWYgKCFuZXdBdHRlbnRpb25JZHMuaGFzKGl0ZW0uaWQpKSB7XG4gICAgICAgIGNoYW5nZXMucmVtb3ZlZC5wdXNoKGl0ZW0uaWQpO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gY2hhbmdlcztcbiAgfVxufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDkvr/mjbflh73mlbBcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDliJvlu7rku6rooajnm5jmnoTlu7rlmahcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZURhc2hib2FyZEJ1aWxkZXIoY29uZmlnPzogRGFzaGJvYXJkQnVpbGRlckNvbmZpZyk6IERhc2hib2FyZEJ1aWxkZXIge1xuICByZXR1cm4gbmV3IERhc2hib2FyZEJ1aWxkZXIoY29uZmlnKTtcbn1cblxuLyoqXG4gKiDlv6vpgJ/mnoTlu7rku6rooajnm5jlv6vnhadcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkRGFzaGJvYXJkU25hcHNob3QoXG4gIGNvbnRyb2xTbmFwc2hvdDogQ29udHJvbFN1cmZhY2VTbmFwc2hvdCxcbiAgY29uZmlnPzogRGFzaGJvYXJkQnVpbGRlckNvbmZpZ1xuKTogRGFzaGJvYXJkU25hcHNob3Qge1xuICBjb25zdCBidWlsZGVyID0gbmV3IERhc2hib2FyZEJ1aWxkZXIoY29uZmlnKTtcbiAgcmV0dXJuIGJ1aWxkZXIuYnVpbGREYXNoYm9hcmRTbmFwc2hvdChjb250cm9sU25hcHNob3QpO1xufVxuIl19