"use strict";
/**
 * Operator View Factory
 * Phase 2A-1R - 标准化视图 Payload 构造
 *
 * 职责：
 * - 统一构造 OperatorViewPayload
 * - 避免每个 view 方法手拼标题、summary、actions
 * - 提供一致的视图结构
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultOperatorViewFactory = void 0;
exports.createOperatorViewFactory = createOperatorViewFactory;
// ============================================================================
// 默认实现
// ============================================================================
class DefaultOperatorViewFactory {
    buildDashboardView(input) {
        const { controlSnapshot, dashboardSnapshot, mode = 'summary', surface = 'cli' } = input;
        const now = Date.now();
        const summary = controlSnapshot.summary;
        // 构建可用动作
        const availableActions = [
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
    buildTaskView(input) {
        const { controlSnapshot, mode = 'summary', surface = 'cli' } = input;
        const now = Date.now();
        const taskView = controlSnapshot.taskView;
        const availableActions = [];
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
    buildApprovalView(input) {
        const { controlSnapshot, mode = 'summary', surface = 'cli' } = input;
        const now = Date.now();
        const approvalView = controlSnapshot.approvalView;
        const availableActions = [];
        // 为待处理审批添加批准/拒绝动作
        for (const approval of approvalView.pendingApprovals.slice(0, 5)) {
            availableActions.push({
                actionType: 'approve',
                label: `批准：${approval.approvalId}`,
                targetType: 'approval',
                targetId: approval.approvalId,
                style: 'primary',
                requiresConfirmation: true,
            }, {
                actionType: 'reject',
                label: `拒绝：${approval.approvalId}`,
                targetType: 'approval',
                targetId: approval.approvalId,
                style: 'danger',
                requiresConfirmation: true,
            });
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
    buildIncidentView(input) {
        const { controlSnapshot, dashboardSnapshot, mode = 'summary', surface = 'cli' } = input;
        const now = Date.now();
        const opsView = controlSnapshot.opsView;
        const availableActions = [];
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
    buildAgentView(input) {
        const { controlSnapshot, mode = 'summary', surface = 'cli' } = input;
        const now = Date.now();
        const agentView = controlSnapshot.agentView;
        const availableActions = [];
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
    buildInboxView(input) {
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
        const availableActions = [
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
    buildInterventionView(input) {
        const { humanLoopSnapshot, mode = 'summary', surface = 'cli' } = input;
        const now = Date.now();
        const availableActions = [];
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
    buildDetailView(input) {
        const { targetType, targetId, data, mode = 'detail', surface = 'cli' } = input;
        const now = Date.now();
        const availableActions = [
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
    buildDashboardSummary(summary) {
        const parts = [];
        parts.push(`任务 ${summary.totalTasks}`);
        parts.push(`审批 ${summary.pendingApprovals}`);
        parts.push(`健康 ${summary.healthScore}`);
        if (summary.attentionItems > 0) {
            parts.push(`关注 ${summary.attentionItems}`);
        }
        return parts.join(' | ');
    }
    buildInboxSummary(content) {
        const parts = [];
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
    formatTargetType(targetType) {
        const mapping = {
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
exports.DefaultOperatorViewFactory = DefaultOperatorViewFactory;
// ============================================================================
// 工厂函数
// ============================================================================
function createOperatorViewFactory() {
    return new DefaultOperatorViewFactory();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3BlcmF0b3Jfdmlld19mYWN0b3J5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL29wZXJhdG9yL3NlcnZpY2VzL29wZXJhdG9yX3ZpZXdfZmFjdG9yeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7O0dBUUc7OztBQTJsQkgsOERBRUM7QUF0Z0JELCtFQUErRTtBQUMvRSxPQUFPO0FBQ1AsK0VBQStFO0FBRS9FLE1BQWEsMEJBQTBCO0lBQ3JDLGtCQUFrQixDQUFDLEtBQThCO1FBQy9DLE1BQU0sRUFBRSxlQUFlLEVBQUUsaUJBQWlCLEVBQUUsSUFBSSxHQUFHLFNBQVMsRUFBRSxPQUFPLEdBQUcsS0FBSyxFQUFFLEdBQUcsS0FBSyxDQUFDO1FBQ3hGLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUV2QixNQUFNLE9BQU8sR0FBRyxlQUFlLENBQUMsT0FBTyxDQUFDO1FBRXhDLFNBQVM7UUFDVCxNQUFNLGdCQUFnQixHQUF5QjtZQUM3QztnQkFDRSxVQUFVLEVBQUUsWUFBWTtnQkFDeEIsS0FBSyxFQUFFLE1BQU07Z0JBQ2IsVUFBVSxFQUFFLE1BQU07Z0JBQ2xCLEtBQUssRUFBRSxTQUFTO2FBQ2pCO1lBQ0Q7Z0JBQ0UsVUFBVSxFQUFFLGdCQUFnQjtnQkFDNUIsS0FBSyxFQUFFLE1BQU07Z0JBQ2IsVUFBVSxFQUFFLFVBQVU7Z0JBQ3RCLEtBQUssRUFBRSxTQUFTO2FBQ2pCO1lBQ0Q7Z0JBQ0UsVUFBVSxFQUFFLGdCQUFnQjtnQkFDNUIsS0FBSyxFQUFFLE1BQU07Z0JBQ2IsVUFBVSxFQUFFLFVBQVU7Z0JBQ3RCLEtBQUssRUFBRSxTQUFTO2FBQ2pCO1lBQ0Q7Z0JBQ0UsVUFBVSxFQUFFLFlBQVk7Z0JBQ3hCLEtBQUssRUFBRSxPQUFPO2dCQUNkLFVBQVUsRUFBRSxPQUFPO2dCQUNuQixLQUFLLEVBQUUsU0FBUzthQUNqQjtTQUNGLENBQUM7UUFFRixrQkFBa0I7UUFD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LEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7SUFDeEQsQ0FBQztJQUVPLGdCQUFnQixDQUFDLFVBQWtCO1FBQ3pDLE1BQU0sT0FBTyxHQUEyQjtZQUN0QyxJQUFJLEVBQUUsSUFBSTtZQUNWLFFBQVEsRUFBRSxJQUFJO1lBQ2QsUUFBUSxFQUFFLElBQUk7WUFDZCxLQUFLLEVBQUUsT0FBTztZQUNkLFlBQVksRUFBRSxJQUFJO1lBQ2xCLFNBQVMsRUFBRSxXQUFXO1NBQ3ZCLENBQUM7UUFDRixPQUFPLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxVQUFVLENBQUM7SUFDM0MsQ0FBQztDQUNGO0FBMWZELGdFQTBmQztBQUVELCtFQUErRTtBQUMvRSxPQUFPO0FBQ1AsK0VBQStFO0FBRS9FLFNBQWdCLHlCQUF5QjtJQUN2QyxPQUFPLElBQUksMEJBQTBCLEVBQUUsQ0FBQztBQUMxQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBPcGVyYXRvciBWaWV3IEZhY3RvcnlcbiAqIFBoYXNlIDJBLTFSIC0g5qCH5YeG5YyW6KeG5Zu+IFBheWxvYWQg5p6E6YCgXG4gKiBcbiAqIOiBjOi0o++8mlxuICogLSDnu5/kuIDmnoTpgKAgT3BlcmF0b3JWaWV3UGF5bG9hZFxuICogLSDpgb/lhY3mr4/kuKogdmlldyDmlrnms5XmiYvmi7zmoIfpopjjgIFzdW1tYXJ544CBYWN0aW9uc1xuICogLSDmj5DkvpvkuIDoh7TnmoTop4blm77nu5PmnoRcbiAqL1xuXG5pbXBvcnQgdHlwZSB7XG4gIE9wZXJhdG9yVmlld1BheWxvYWQsXG4gIE9wZXJhdG9yVmlld0FjdGlvbixcbiAgT3BlcmF0b3JWaWV3S2luZCxcbiAgT3BlcmF0b3JNb2RlLFxuICBPcGVyYXRvclN1cmZhY2UsXG59IGZyb20gJy4uL3R5cGVzL3N1cmZhY2VfdHlwZXMnO1xuaW1wb3J0IHR5cGUgeyBEYXNoYm9hcmRTbmFwc2hvdCB9IGZyb20gJy4uL3V4L2Rhc2hib2FyZF90eXBlcyc7XG5pbXBvcnQgdHlwZSB7IENvbnRyb2xTdXJmYWNlU25hcHNob3QgfSBmcm9tICcuLi91eC9jb250cm9sX3R5cGVzJztcbmltcG9ydCB0eXBlIHsgSHVtYW5Mb29wU25hcHNob3QgfSBmcm9tICcuLi91eC9oaXRsX3R5cGVzJztcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g6L6T5YWl57G75Z6LXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBpbnRlcmZhY2UgQnVpbGREYXNoYm9hcmRWaWV3SW5wdXQge1xuICBjb250cm9sU25hcHNob3Q6IENvbnRyb2xTdXJmYWNlU25hcHNob3Q7XG4gIGRhc2hib2FyZFNuYXBzaG90OiBEYXNoYm9hcmRTbmFwc2hvdDtcbiAgaHVtYW5Mb29wU25hcHNob3Q/OiBIdW1hbkxvb3BTbmFwc2hvdDtcbiAgbW9kZT86IE9wZXJhdG9yTW9kZTtcbiAgc3VyZmFjZT86IE9wZXJhdG9yU3VyZmFjZTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBCdWlsZFRhc2tWaWV3SW5wdXQge1xuICBjb250cm9sU25hcHNob3Q6IENvbnRyb2xTdXJmYWNlU25hcHNob3Q7XG4gIG1vZGU/OiBPcGVyYXRvck1vZGU7XG4gIHN1cmZhY2U/OiBPcGVyYXRvclN1cmZhY2U7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQnVpbGRBcHByb3ZhbFZpZXdJbnB1dCB7XG4gIGNvbnRyb2xTbmFwc2hvdDogQ29udHJvbFN1cmZhY2VTbmFwc2hvdDtcbiAgaHVtYW5Mb29wU25hcHNob3Q/OiBIdW1hbkxvb3BTbmFwc2hvdDtcbiAgbW9kZT86IE9wZXJhdG9yTW9kZTtcbiAgc3VyZmFjZT86IE9wZXJhdG9yU3VyZmFjZTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBCdWlsZEluY2lkZW50Vmlld0lucHV0IHtcbiAgY29udHJvbFNuYXBzaG90OiBDb250cm9sU3VyZmFjZVNuYXBzaG90O1xuICBkYXNoYm9hcmRTbmFwc2hvdDogRGFzaGJvYXJkU25hcHNob3Q7XG4gIG1vZGU/OiBPcGVyYXRvck1vZGU7XG4gIHN1cmZhY2U/OiBPcGVyYXRvclN1cmZhY2U7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQnVpbGRBZ2VudFZpZXdJbnB1dCB7XG4gIGNvbnRyb2xTbmFwc2hvdDogQ29udHJvbFN1cmZhY2VTbmFwc2hvdDtcbiAgbW9kZT86IE9wZXJhdG9yTW9kZTtcbiAgc3VyZmFjZT86IE9wZXJhdG9yU3VyZmFjZTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBCdWlsZEluYm94Vmlld0lucHV0IHtcbiAgY29udHJvbFNuYXBzaG90OiBDb250cm9sU3VyZmFjZVNuYXBzaG90O1xuICBodW1hbkxvb3BTbmFwc2hvdD86IEh1bWFuTG9vcFNuYXBzaG90O1xuICBtb2RlPzogT3BlcmF0b3JNb2RlO1xuICBzdXJmYWNlPzogT3BlcmF0b3JTdXJmYWNlO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEJ1aWxkSW50ZXJ2ZW50aW9uVmlld0lucHV0IHtcbiAgaHVtYW5Mb29wU25hcHNob3Q6IEh1bWFuTG9vcFNuYXBzaG90O1xuICBtb2RlPzogT3BlcmF0b3JNb2RlO1xuICBzdXJmYWNlPzogT3BlcmF0b3JTdXJmYWNlO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEJ1aWxkRGV0YWlsVmlld0lucHV0IHtcbiAgdGFyZ2V0VHlwZTogc3RyaW5nO1xuICB0YXJnZXRJZDogc3RyaW5nO1xuICBkYXRhOiB1bmtub3duO1xuICBtb2RlPzogT3BlcmF0b3JNb2RlO1xuICBzdXJmYWNlPzogT3BlcmF0b3JTdXJmYWNlO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBWaWV3IEZhY3Rvcnkg5o6l5Y+jXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBpbnRlcmZhY2UgT3BlcmF0b3JWaWV3RmFjdG9yeSB7XG4gIGJ1aWxkRGFzaGJvYXJkVmlldyhpbnB1dDogQnVpbGREYXNoYm9hcmRWaWV3SW5wdXQpOiBPcGVyYXRvclZpZXdQYXlsb2FkO1xuICBidWlsZFRhc2tWaWV3KGlucHV0OiBCdWlsZFRhc2tWaWV3SW5wdXQpOiBPcGVyYXRvclZpZXdQYXlsb2FkO1xuICBidWlsZEFwcHJvdmFsVmlldyhpbnB1dDogQnVpbGRBcHByb3ZhbFZpZXdJbnB1dCk6IE9wZXJhdG9yVmlld1BheWxvYWQ7XG4gIGJ1aWxkSW5jaWRlbnRWaWV3KGlucHV0OiBCdWlsZEluY2lkZW50Vmlld0lucHV0KTogT3BlcmF0b3JWaWV3UGF5bG9hZDtcbiAgYnVpbGRBZ2VudFZpZXcoaW5wdXQ6IEJ1aWxkQWdlbnRWaWV3SW5wdXQpOiBPcGVyYXRvclZpZXdQYXlsb2FkO1xuICBidWlsZEluYm94VmlldyhpbnB1dDogQnVpbGRJbmJveFZpZXdJbnB1dCk6IE9wZXJhdG9yVmlld1BheWxvYWQ7XG4gIGJ1aWxkSW50ZXJ2ZW50aW9uVmlldyhpbnB1dDogQnVpbGRJbnRlcnZlbnRpb25WaWV3SW5wdXQpOiBPcGVyYXRvclZpZXdQYXlsb2FkO1xuICBidWlsZERldGFpbFZpZXcoaW5wdXQ6IEJ1aWxkRGV0YWlsVmlld0lucHV0KTogT3BlcmF0b3JWaWV3UGF5bG9hZDtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g6buY6K6k5a6e546wXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBjbGFzcyBEZWZhdWx0T3BlcmF0b3JWaWV3RmFjdG9yeSBpbXBsZW1lbnRzIE9wZXJhdG9yVmlld0ZhY3Rvcnkge1xuICBidWlsZERhc2hib2FyZFZpZXcoaW5wdXQ6IEJ1aWxkRGFzaGJvYXJkVmlld0lucHV0KTogT3BlcmF0b3JWaWV3UGF5bG9hZCB7XG4gICAgY29uc3QgeyBjb250cm9sU25hcHNob3QsIGRhc2hib2FyZFNuYXBzaG90LCBtb2RlID0gJ3N1bW1hcnknLCBzdXJmYWNlID0gJ2NsaScgfSA9IGlucHV0O1xuICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4gICAgXG4gICAgY29uc3Qgc3VtbWFyeSA9IGNvbnRyb2xTbmFwc2hvdC5zdW1tYXJ5O1xuICAgIFxuICAgIC8vIOaehOW7uuWPr+eUqOWKqOS9nFxuICAgIGNvbnN0IGF2YWlsYWJsZUFjdGlvbnM6IE9wZXJhdG9yVmlld0FjdGlvbltdID0gW1xuICAgICAge1xuICAgICAgICBhY3Rpb25UeXBlOiAndmlld190YXNrcycsXG4gICAgICAgIGxhYmVsOiAn5p+l55yL5Lu75YqhJyxcbiAgICAgICAgdGFyZ2V0VHlwZTogJ3Rhc2snLFxuICAgICAgICBzdHlsZTogJ2RlZmF1bHQnLFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgYWN0aW9uVHlwZTogJ3ZpZXdfYXBwcm92YWxzJyxcbiAgICAgICAgbGFiZWw6ICfmn6XnnIvlrqHmibknLFxuICAgICAgICB0YXJnZXRUeXBlOiAnYXBwcm92YWwnLFxuICAgICAgICBzdHlsZTogJ2RlZmF1bHQnLFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgYWN0aW9uVHlwZTogJ3ZpZXdfaW5jaWRlbnRzJyxcbiAgICAgICAgbGFiZWw6ICfmn6XnnIvkuovku7YnLFxuICAgICAgICB0YXJnZXRUeXBlOiAnaW5jaWRlbnQnLFxuICAgICAgICBzdHlsZTogJ2RlZmF1bHQnLFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgYWN0aW9uVHlwZTogJ3ZpZXdfaW5ib3gnLFxuICAgICAgICBsYWJlbDogJ+afpeeci+aUtuS7tueusScsXG4gICAgICAgIHRhcmdldFR5cGU6ICdpbmJveCcsXG4gICAgICAgIHN0eWxlOiAncHJpbWFyeScsXG4gICAgICB9LFxuICAgIF07XG4gICAgXG4gICAgLy8g5aaC5p6c5pyJ5b6F5aSE55CG5a6h5om577yM5re75Yqg5b+r6YCf5Yqo5L2cXG4gICAgaWYgKHN1bW1hcnkucGVuZGluZ0FwcHJvdmFscyA+IDApIHtcbiAgICAgIGF2YWlsYWJsZUFjdGlvbnMucHVzaCh7XG4gICAgICAgIGFjdGlvblR5cGU6ICd2aWV3X2FwcHJvdmFscycsXG4gICAgICAgIGxhYmVsOiBg5aSE55CG5a6h5om5ICgke3N1bW1hcnkucGVuZGluZ0FwcHJvdmFsc30pYCxcbiAgICAgICAgdGFyZ2V0VHlwZTogJ2FwcHJvdmFsJyxcbiAgICAgICAgc3R5bGU6ICdwcmltYXJ5JyxcbiAgICAgIH0pO1xuICAgIH1cbiAgICBcbiAgICAvLyDlpoLmnpzmnInkuovku7bvvIzmt7vliqDlv6vpgJ/liqjkvZxcbiAgICBpZiAoc3VtbWFyeS5hdHRlbnRpb25JdGVtcyA+IDApIHtcbiAgICAgIGF2YWlsYWJsZUFjdGlvbnMucHVzaCh7XG4gICAgICAgIGFjdGlvblR5cGU6ICd2aWV3X2luY2lkZW50cycsXG4gICAgICAgIGxhYmVsOiBg5p+l55yL5YWz5rOo6aG5ICgke3N1bW1hcnkuYXR0ZW50aW9uSXRlbXN9KWAsXG4gICAgICAgIHRhcmdldFR5cGU6ICdpbmNpZGVudCcsXG4gICAgICAgIHN0eWxlOiAnd2FybmluZycsXG4gICAgICB9KTtcbiAgICB9XG4gICAgXG4gICAgLy8g5p6E5bu65YaF5a65XG4gICAgY29uc3QgY29udGVudCA9IHtcbiAgICAgIG92ZXJhbGxTdGF0dXM6IGNvbnRyb2xTbmFwc2hvdC5vcHNWaWV3Lm92ZXJhbGxTdGF0dXMsXG4gICAgICBoZWFsdGhTY29yZTogc3VtbWFyeS5oZWFsdGhTY29yZSxcbiAgICAgIHRvdGFsVGFza3M6IHN1bW1hcnkudG90YWxUYXNrcyxcbiAgICAgIHBlbmRpbmdBcHByb3ZhbHM6IHN1bW1hcnkucGVuZGluZ0FwcHJvdmFscyxcbiAgICAgIGFjdGl2ZUFnZW50czogc3VtbWFyeS5hY3RpdmVBZ2VudHMsXG4gICAgICBhdHRlbnRpb25JdGVtczogc3VtbWFyeS5hdHRlbnRpb25JdGVtcyxcbiAgICAgIGJsb2NrZWRUYXNrczogY29udHJvbFNuYXBzaG90LnRhc2tWaWV3LmJsb2NrZWRUYXNrcy5sZW5ndGgsXG4gICAgICBmYWlsZWRUYXNrczogY29udHJvbFNuYXBzaG90LnRhc2tWaWV3LmZhaWxlZFRhc2tzLmxlbmd0aCxcbiAgICAgIHRpbWVvdXRBcHByb3ZhbHM6IGNvbnRyb2xTbmFwc2hvdC5hcHByb3ZhbFZpZXcudGltZW91dEFwcHJvdmFscy5sZW5ndGgsXG4gICAgICBhY3RpdmVJbmNpZGVudHM6IGNvbnRyb2xTbmFwc2hvdC5vcHNWaWV3LmFjdGl2ZUluY2lkZW50cy5sZW5ndGgsXG4gICAgfTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgdmlld0tpbmQ6ICdkYXNoYm9hcmQnLFxuICAgICAgdGl0bGU6ICfns7vnu5/mpoLop4gnLFxuICAgICAgc3VidGl0bGU6IGBXb3Jrc3BhY2U6ICR7aW5wdXQuY29udHJvbFNuYXBzaG90LnNuYXBzaG90SWR9YCxcbiAgICAgIG1vZGUsXG4gICAgICBzdW1tYXJ5OiB0aGlzLmJ1aWxkRGFzaGJvYXJkU3VtbWFyeShzdW1tYXJ5KSxcbiAgICAgIGNvbnRlbnQsXG4gICAgICBhdmFpbGFibGVBY3Rpb25zLFxuICAgICAgYnJlYWRjcnVtYnM6IFsnRGFzaGJvYXJkJ10sXG4gICAgICBnZW5lcmF0ZWRBdDogbm93LFxuICAgICAgZnJlc2huZXNzTXM6IG5vdyAtIGNvbnRyb2xTbmFwc2hvdC5jcmVhdGVkQXQsXG4gICAgfTtcbiAgfVxuICBcbiAgYnVpbGRUYXNrVmlldyhpbnB1dDogQnVpbGRUYXNrVmlld0lucHV0KTogT3BlcmF0b3JWaWV3UGF5bG9hZCB7XG4gICAgY29uc3QgeyBjb250cm9sU25hcHNob3QsIG1vZGUgPSAnc3VtbWFyeScsIHN1cmZhY2UgPSAnY2xpJyB9ID0gaW5wdXQ7XG4gICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbiAgICBjb25zdCB0YXNrVmlldyA9IGNvbnRyb2xTbmFwc2hvdC50YXNrVmlldztcbiAgICBcbiAgICBjb25zdCBhdmFpbGFibGVBY3Rpb25zOiBPcGVyYXRvclZpZXdBY3Rpb25bXSA9IFtdO1xuICAgIFxuICAgIC8vIOS4uuWksei0peS7u+WKoea3u+WKoOmHjeivleWKqOS9nFxuICAgIGZvciAoY29uc3QgdGFzayBvZiB0YXNrVmlldy5mYWlsZWRUYXNrcy5zbGljZSgwLCAzKSkge1xuICAgICAgYXZhaWxhYmxlQWN0aW9ucy5wdXNoKHtcbiAgICAgICAgYWN0aW9uVHlwZTogJ3JldHJ5X3Rhc2snLFxuICAgICAgICBsYWJlbDogYOmHjeivle+8miR7dGFzay50aXRsZSB8fCB0YXNrLnRhc2tJZH1gLFxuICAgICAgICB0YXJnZXRUeXBlOiAndGFzaycsXG4gICAgICAgIHRhcmdldElkOiB0YXNrLnRhc2tJZCxcbiAgICAgICAgc3R5bGU6ICd3YXJuaW5nJyxcbiAgICAgICAgcmVxdWlyZXNDb25maXJtYXRpb246IGZhbHNlLFxuICAgICAgfSk7XG4gICAgfVxuICAgIFxuICAgIC8vIOS4uumYu+WhnuS7u+WKoea3u+WKoOmHjeivleWKqOS9nFxuICAgIGZvciAoY29uc3QgdGFzayBvZiB0YXNrVmlldy5ibG9ja2VkVGFza3Muc2xpY2UoMCwgMykpIHtcbiAgICAgIGF2YWlsYWJsZUFjdGlvbnMucHVzaCh7XG4gICAgICAgIGFjdGlvblR5cGU6ICdyZXRyeV90YXNrJyxcbiAgICAgICAgbGFiZWw6IGDph43or5XvvJoke3Rhc2sudGl0bGUgfHwgdGFzay50YXNrSWR9YCxcbiAgICAgICAgdGFyZ2V0VHlwZTogJ3Rhc2snLFxuICAgICAgICB0YXJnZXRJZDogdGFzay50YXNrSWQsXG4gICAgICAgIHN0eWxlOiAncHJpbWFyeScsXG4gICAgICB9KTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgY29udGVudCA9IHtcbiAgICAgIGFjdGl2ZVRhc2tzOiB0YXNrVmlldy5hY3RpdmVUYXNrcy5tYXAodCA9PiAoe1xuICAgICAgICBpZDogdC50YXNrSWQsXG4gICAgICAgIHRpdGxlOiB0LnRpdGxlLFxuICAgICAgICBzdGF0dXM6IHQuc3RhdHVzLFxuICAgICAgICBwcmlvcml0eTogdC5wcmlvcml0eSxcbiAgICAgIH0pKSxcbiAgICAgIGJsb2NrZWRUYXNrczogdGFza1ZpZXcuYmxvY2tlZFRhc2tzLm1hcCh0ID0+ICh7XG4gICAgICAgIGlkOiB0LnRhc2tJZCxcbiAgICAgICAgdGl0bGU6IHQudGl0bGUsXG4gICAgICAgIHJlYXNvbjogdC5ibG9ja2VkUmVhc29uLFxuICAgICAgfSkpLFxuICAgICAgZmFpbGVkVGFza3M6IHRhc2tWaWV3LmZhaWxlZFRhc2tzLm1hcCh0ID0+ICh7XG4gICAgICAgIGlkOiB0LnRhc2tJZCxcbiAgICAgICAgdGl0bGU6IHQudGl0bGUsXG4gICAgICAgIHJldHJ5Q291bnQ6IHQucmV0cnlDb3VudCxcbiAgICAgIH0pKSxcbiAgICB9O1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICB2aWV3S2luZDogJ3Rhc2tzJyxcbiAgICAgIHRpdGxlOiAn5Lu75Yqh6KeG5Zu+JyxcbiAgICAgIHN1YnRpdGxlOiBg5oC76K6h77yaJHt0YXNrVmlldy50b3RhbFRhc2tzfSDkuKrku7vliqFgLFxuICAgICAgbW9kZSxcbiAgICAgIHN1bW1hcnk6IGDmtLvot4MgJHt0YXNrVmlldy5hY3RpdmVUYXNrcy5sZW5ndGh9IHwg6Zi75aGeICR7dGFza1ZpZXcuYmxvY2tlZFRhc2tzLmxlbmd0aH0gfCDlpLHotKUgJHt0YXNrVmlldy5mYWlsZWRUYXNrcy5sZW5ndGh9YCxcbiAgICAgIGNvbnRlbnQsXG4gICAgICBhdmFpbGFibGVBY3Rpb25zLFxuICAgICAgYnJlYWRjcnVtYnM6IFsnRGFzaGJvYXJkJywgJ1Rhc2tzJ10sXG4gICAgICBnZW5lcmF0ZWRBdDogbm93LFxuICAgICAgZnJlc2huZXNzTXM6IG5vdyAtIGNvbnRyb2xTbmFwc2hvdC5jcmVhdGVkQXQsXG4gICAgfTtcbiAgfVxuICBcbiAgYnVpbGRBcHByb3ZhbFZpZXcoaW5wdXQ6IEJ1aWxkQXBwcm92YWxWaWV3SW5wdXQpOiBPcGVyYXRvclZpZXdQYXlsb2FkIHtcbiAgICBjb25zdCB7IGNvbnRyb2xTbmFwc2hvdCwgbW9kZSA9ICdzdW1tYXJ5Jywgc3VyZmFjZSA9ICdjbGknIH0gPSBpbnB1dDtcbiAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuICAgIGNvbnN0IGFwcHJvdmFsVmlldyA9IGNvbnRyb2xTbmFwc2hvdC5hcHByb3ZhbFZpZXc7XG4gICAgXG4gICAgY29uc3QgYXZhaWxhYmxlQWN0aW9uczogT3BlcmF0b3JWaWV3QWN0aW9uW10gPSBbXTtcbiAgICBcbiAgICAvLyDkuLrlvoXlpITnkIblrqHmibnmt7vliqDmibnlh4Yv5ouS57ud5Yqo5L2cXG4gICAgZm9yIChjb25zdCBhcHByb3ZhbCBvZiBhcHByb3ZhbFZpZXcucGVuZGluZ0FwcHJvdmFscy5zbGljZSgwLCA1KSkge1xuICAgICAgYXZhaWxhYmxlQWN0aW9ucy5wdXNoKFxuICAgICAgICB7XG4gICAgICAgICAgYWN0aW9uVHlwZTogJ2FwcHJvdmUnLFxuICAgICAgICAgIGxhYmVsOiBg5om55YeG77yaJHthcHByb3ZhbC5hcHByb3ZhbElkfWAsXG4gICAgICAgICAgdGFyZ2V0VHlwZTogJ2FwcHJvdmFsJyxcbiAgICAgICAgICB0YXJnZXRJZDogYXBwcm92YWwuYXBwcm92YWxJZCxcbiAgICAgICAgICBzdHlsZTogJ3ByaW1hcnknLFxuICAgICAgICAgIHJlcXVpcmVzQ29uZmlybWF0aW9uOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgYWN0aW9uVHlwZTogJ3JlamVjdCcsXG4gICAgICAgICAgbGFiZWw6IGDmi5Lnu53vvJoke2FwcHJvdmFsLmFwcHJvdmFsSWR9YCxcbiAgICAgICAgICB0YXJnZXRUeXBlOiAnYXBwcm92YWwnLFxuICAgICAgICAgIHRhcmdldElkOiBhcHByb3ZhbC5hcHByb3ZhbElkLFxuICAgICAgICAgIHN0eWxlOiAnZGFuZ2VyJyxcbiAgICAgICAgICByZXF1aXJlc0NvbmZpcm1hdGlvbjogdHJ1ZSxcbiAgICAgICAgfVxuICAgICAgKTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgY29udGVudCA9IHtcbiAgICAgIHBlbmRpbmdBcHByb3ZhbHM6IGFwcHJvdmFsVmlldy5wZW5kaW5nQXBwcm92YWxzLm1hcChhID0+ICh7XG4gICAgICAgIGlkOiBhLmFwcHJvdmFsSWQsXG4gICAgICAgIHNjb3BlOiBhLnNjb3BlLFxuICAgICAgICByZWFzb246IGEucmVhc29uLFxuICAgICAgICBhZ2VNczogYS5hZ2VNcyxcbiAgICAgICAgcmVxdWVzdGluZ0FnZW50OiBhLnJlcXVlc3RpbmdBZ2VudCxcbiAgICAgIH0pKSxcbiAgICAgIGJvdHRsZW5lY2tzOiBhcHByb3ZhbFZpZXcuYm90dGxlbmVja3MsXG4gICAgICB0aW1lb3V0QXBwcm92YWxzOiBhcHByb3ZhbFZpZXcudGltZW91dEFwcHJvdmFscy5tYXAoYSA9PiAoe1xuICAgICAgICBpZDogYS5hcHByb3ZhbElkLFxuICAgICAgICBzY29wZTogYS5zY29wZSxcbiAgICAgICAgYWdlTXM6IGEuYWdlTXMsXG4gICAgICB9KSksXG4gICAgfTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgdmlld0tpbmQ6ICdhcHByb3ZhbHMnLFxuICAgICAgdGl0bGU6ICflrqHmibnop4blm74nLFxuICAgICAgc3VidGl0bGU6IGDmgLvorqHvvJoke2FwcHJvdmFsVmlldy50b3RhbEFwcHJvdmFsc30g5Liq5a6h5om5YCxcbiAgICAgIG1vZGUsXG4gICAgICBzdW1tYXJ5OiBg5b6F5aSE55CGICR7YXBwcm92YWxWaWV3LnBlbmRpbmdBcHByb3ZhbHMubGVuZ3RofSB8IOi2heaXtiAke2FwcHJvdmFsVmlldy50aW1lb3V0QXBwcm92YWxzLmxlbmd0aH1gLFxuICAgICAgY29udGVudCxcbiAgICAgIGF2YWlsYWJsZUFjdGlvbnMsXG4gICAgICBicmVhZGNydW1iczogWydEYXNoYm9hcmQnLCAnQXBwcm92YWxzJ10sXG4gICAgICBnZW5lcmF0ZWRBdDogbm93LFxuICAgICAgZnJlc2huZXNzTXM6IG5vdyAtIGNvbnRyb2xTbmFwc2hvdC5jcmVhdGVkQXQsXG4gICAgfTtcbiAgfVxuICBcbiAgYnVpbGRJbmNpZGVudFZpZXcoaW5wdXQ6IEJ1aWxkSW5jaWRlbnRWaWV3SW5wdXQpOiBPcGVyYXRvclZpZXdQYXlsb2FkIHtcbiAgICBjb25zdCB7IGNvbnRyb2xTbmFwc2hvdCwgZGFzaGJvYXJkU25hcHNob3QsIG1vZGUgPSAnc3VtbWFyeScsIHN1cmZhY2UgPSAnY2xpJyB9ID0gaW5wdXQ7XG4gICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbiAgICBjb25zdCBvcHNWaWV3ID0gY29udHJvbFNuYXBzaG90Lm9wc1ZpZXc7XG4gICAgXG4gICAgY29uc3QgYXZhaWxhYmxlQWN0aW9uczogT3BlcmF0b3JWaWV3QWN0aW9uW10gPSBbXTtcbiAgICBcbiAgICAvLyDkuLrmnKrnoa7orqTkuovku7bmt7vliqDnoa7orqTliqjkvZxcbiAgICBmb3IgKGNvbnN0IGluY2lkZW50IG9mIG9wc1ZpZXcuYWN0aXZlSW5jaWRlbnRzLnNsaWNlKDAsIDUpKSB7XG4gICAgICBpZiAoIWluY2lkZW50LmFja25vd2xlZGdlZCkge1xuICAgICAgICBhdmFpbGFibGVBY3Rpb25zLnB1c2goe1xuICAgICAgICAgIGFjdGlvblR5cGU6ICdhY2tfaW5jaWRlbnQnLFxuICAgICAgICAgIGxhYmVsOiBg56Gu6K6k77yaJHtpbmNpZGVudC5pZH1gLFxuICAgICAgICAgIHRhcmdldFR5cGU6ICdpbmNpZGVudCcsXG4gICAgICAgICAgdGFyZ2V0SWQ6IGluY2lkZW50LmlkLFxuICAgICAgICAgIHN0eWxlOiAncHJpbWFyeScsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICBjb25zdCBjb250ZW50ID0ge1xuICAgICAgb3ZlcmFsbFN0YXR1czogb3BzVmlldy5vdmVyYWxsU3RhdHVzLFxuICAgICAgaGVhbHRoU2NvcmU6IG9wc1ZpZXcuaGVhbHRoU2NvcmUsXG4gICAgICBhY3RpdmVJbmNpZGVudHM6IG9wc1ZpZXcuYWN0aXZlSW5jaWRlbnRzLm1hcChpID0+ICh7XG4gICAgICAgIGlkOiBpLmlkLFxuICAgICAgICB0eXBlOiBpLnR5cGUsXG4gICAgICAgIHNldmVyaXR5OiBpLnNldmVyaXR5LFxuICAgICAgICBkZXNjcmlwdGlvbjogaS5kZXNjcmlwdGlvbixcbiAgICAgICAgYWNrbm93bGVkZ2VkOiBpLmFja25vd2xlZGdlZCxcbiAgICAgIH0pKSxcbiAgICAgIGRlZ3JhZGVkU2VydmVyczogb3BzVmlldy5kZWdyYWRlZFNlcnZlcnMsXG4gICAgICBibG9ja2VkU2tpbGxzOiBvcHNWaWV3LmJsb2NrZWRTa2lsbHMsXG4gICAgICByZXBsYXlIb3RzcG90czogb3BzVmlldy5yZXBsYXlIb3RzcG90cyxcbiAgICB9O1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICB2aWV3S2luZDogJ2luY2lkZW50cycsXG4gICAgICB0aXRsZTogJ+S6i+S7tuinhuWbvicsXG4gICAgICBzdWJ0aXRsZTogYOWBpeW6t+ivhOWIhu+8miR7b3BzVmlldy5oZWFsdGhTY29yZX1gLFxuICAgICAgbW9kZSxcbiAgICAgIHN1bW1hcnk6IGDmtLvot4Pkuovku7YgJHtvcHNWaWV3LmFjdGl2ZUluY2lkZW50cy5sZW5ndGh9IHwg6ZmN57qnIFNlcnZlciAke29wc1ZpZXcuZGVncmFkZWRTZXJ2ZXJzLmxlbmd0aH1gLFxuICAgICAgY29udGVudCxcbiAgICAgIGF2YWlsYWJsZUFjdGlvbnMsXG4gICAgICBicmVhZGNydW1iczogWydEYXNoYm9hcmQnLCAnSW5jaWRlbnRzJ10sXG4gICAgICBnZW5lcmF0ZWRBdDogbm93LFxuICAgICAgZnJlc2huZXNzTXM6IG5vdyAtIGNvbnRyb2xTbmFwc2hvdC5jcmVhdGVkQXQsXG4gICAgfTtcbiAgfVxuICBcbiAgYnVpbGRBZ2VudFZpZXcoaW5wdXQ6IEJ1aWxkQWdlbnRWaWV3SW5wdXQpOiBPcGVyYXRvclZpZXdQYXlsb2FkIHtcbiAgICBjb25zdCB7IGNvbnRyb2xTbmFwc2hvdCwgbW9kZSA9ICdzdW1tYXJ5Jywgc3VyZmFjZSA9ICdjbGknIH0gPSBpbnB1dDtcbiAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuICAgIGNvbnN0IGFnZW50VmlldyA9IGNvbnRyb2xTbmFwc2hvdC5hZ2VudFZpZXc7XG4gICAgXG4gICAgY29uc3QgYXZhaWxhYmxlQWN0aW9uczogT3BlcmF0b3JWaWV3QWN0aW9uW10gPSBbXTtcbiAgICBcbiAgICAvLyDkuLrpmLvloZ4gQWdlbnQg5re75Yqg5qOA5p+l5Yqo5L2cXG4gICAgZm9yIChjb25zdCBhZ2VudCBvZiBhZ2VudFZpZXcuYmxvY2tlZEFnZW50cy5zbGljZSgwLCAzKSkge1xuICAgICAgYXZhaWxhYmxlQWN0aW9ucy5wdXNoKHtcbiAgICAgICAgYWN0aW9uVHlwZTogJ2luc3BlY3RfYWdlbnQnLFxuICAgICAgICBsYWJlbDogYOajgOafpe+8miR7YWdlbnQuYWdlbnRJZH1gLFxuICAgICAgICB0YXJnZXRUeXBlOiAnYWdlbnQnLFxuICAgICAgICB0YXJnZXRJZDogYWdlbnQuYWdlbnRJZCxcbiAgICAgICAgc3R5bGU6ICd3YXJuaW5nJyxcbiAgICAgIH0pO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCBjb250ZW50ID0ge1xuICAgICAgYnVzeUFnZW50czogYWdlbnRWaWV3LmJ1c3lBZ2VudHMubWFwKGEgPT4gKHtcbiAgICAgICAgaWQ6IGEuYWdlbnRJZCxcbiAgICAgICAgcm9sZTogYS5yb2xlLFxuICAgICAgICBhY3RpdmVUYXNrQ291bnQ6IGEuYWN0aXZlVGFza0NvdW50LFxuICAgICAgfSkpLFxuICAgICAgYmxvY2tlZEFnZW50czogYWdlbnRWaWV3LmJsb2NrZWRBZ2VudHMubWFwKGEgPT4gKHtcbiAgICAgICAgaWQ6IGEuYWdlbnRJZCxcbiAgICAgICAgcm9sZTogYS5yb2xlLFxuICAgICAgICBibG9ja2VkVGFza0NvdW50OiBhLmJsb2NrZWRUYXNrQ291bnQsXG4gICAgICB9KSksXG4gICAgICB1bmhlYWx0aHlBZ2VudHM6IGFnZW50Vmlldy51bmhlYWx0aHlBZ2VudHMubWFwKGEgPT4gKHtcbiAgICAgICAgaWQ6IGEuYWdlbnRJZCxcbiAgICAgICAgcm9sZTogYS5yb2xlLFxuICAgICAgICBmYWlsdXJlUmF0ZTogYS5mYWlsdXJlUmF0ZSxcbiAgICAgICAgaGVhbHRoU2NvcmU6IGEuaGVhbHRoU2NvcmUsXG4gICAgICB9KSksXG4gICAgICBvZmZsaW5lQWdlbnRzOiBhZ2VudFZpZXcub2ZmbGluZUFnZW50cy5tYXAoYSA9PiAoe1xuICAgICAgICBpZDogYS5hZ2VudElkLFxuICAgICAgICByb2xlOiBhLnJvbGUsXG4gICAgICAgIGxhc3RTZWVuQXQ6IGEubGFzdFNlZW5BdCxcbiAgICAgIH0pKSxcbiAgICB9O1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICB2aWV3S2luZDogJ2FnZW50cycsXG4gICAgICB0aXRsZTogJ0FnZW50IOinhuWbvicsXG4gICAgICBzdWJ0aXRsZTogYOaAu+iuoe+8miR7YWdlbnRWaWV3LnRvdGFsQWdlbnRzfSDkuKogQWdlbnRgLFxuICAgICAgbW9kZSxcbiAgICAgIHN1bW1hcnk6IGDlv5nnoowgJHthZ2VudFZpZXcuYnVzeUFnZW50cy5sZW5ndGh9IHwg6Zi75aGeICR7YWdlbnRWaWV3LmJsb2NrZWRBZ2VudHMubGVuZ3RofSB8IOS4jeWBpeW6tyAke2FnZW50Vmlldy51bmhlYWx0aHlBZ2VudHMubGVuZ3RofSB8IOemu+e6vyAke2FnZW50Vmlldy5vZmZsaW5lQWdlbnRzLmxlbmd0aH1gLFxuICAgICAgY29udGVudCxcbiAgICAgIGF2YWlsYWJsZUFjdGlvbnMsXG4gICAgICBicmVhZGNydW1iczogWydEYXNoYm9hcmQnLCAnQWdlbnRzJ10sXG4gICAgICBnZW5lcmF0ZWRBdDogbm93LFxuICAgICAgZnJlc2huZXNzTXM6IG5vdyAtIGNvbnRyb2xTbmFwc2hvdC5jcmVhdGVkQXQsXG4gICAgfTtcbiAgfVxuICBcbiAgYnVpbGRJbmJveFZpZXcoaW5wdXQ6IEJ1aWxkSW5ib3hWaWV3SW5wdXQpOiBPcGVyYXRvclZpZXdQYXlsb2FkIHtcbiAgICBjb25zdCB7IGNvbnRyb2xTbmFwc2hvdCwgaHVtYW5Mb29wU25hcHNob3QsIG1vZGUgPSAnc3VtbWFyeScsIHN1cmZhY2UgPSAnY2xpJyB9ID0gaW5wdXQ7XG4gICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbiAgICBcbiAgICAvLyDovbvph4/ogZrlkIjvvJpwZW5kaW5nIGFwcHJvdmFscyArIGFjdGl2ZSBpbmNpZGVudHMgKyBibG9ja2VkIHRhc2tzICsgaW50ZXJ2ZW50aW9uc1xuICAgIGNvbnN0IGNvbnRlbnQgPSB7XG4gICAgICBwZW5kaW5nQXBwcm92YWxzOiBjb250cm9sU25hcHNob3QuYXBwcm92YWxWaWV3LnBlbmRpbmdBcHByb3ZhbHMuc2xpY2UoMCwgNSkubWFwKGEgPT4gKHtcbiAgICAgICAgaWQ6IGEuYXBwcm92YWxJZCxcbiAgICAgICAgc2NvcGU6IGEuc2NvcGUsXG4gICAgICAgIGFnZU1zOiBhLmFnZU1zLFxuICAgICAgfSkpLFxuICAgICAgYWN0aXZlSW5jaWRlbnRzOiBjb250cm9sU25hcHNob3Qub3BzVmlldy5hY3RpdmVJbmNpZGVudHMuc2xpY2UoMCwgNSkubWFwKGkgPT4gKHtcbiAgICAgICAgaWQ6IGkuaWQsXG4gICAgICAgIHR5cGU6IGkudHlwZSxcbiAgICAgICAgc2V2ZXJpdHk6IGkuc2V2ZXJpdHksXG4gICAgICB9KSksXG4gICAgICBibG9ja2VkVGFza3M6IGNvbnRyb2xTbmFwc2hvdC50YXNrVmlldy5ibG9ja2VkVGFza3Muc2xpY2UoMCwgNSkubWFwKHQgPT4gKHtcbiAgICAgICAgaWQ6IHQudGFza0lkLFxuICAgICAgICB0aXRsZTogdC50aXRsZSxcbiAgICAgICAgcmVhc29uOiB0LmJsb2NrZWRSZWFzb24sXG4gICAgICB9KSksXG4gICAgICBvcGVuSW50ZXJ2ZW50aW9uczogaHVtYW5Mb29wU25hcHNob3Q/Lm9wZW5JbnRlcnZlbnRpb25zLnNsaWNlKDAsIDUpLm1hcChpID0+ICh7XG4gICAgICAgIGlkOiBpLmlkLFxuICAgICAgICBzb3VyY2VUeXBlOiBpLnNvdXJjZVR5cGUsXG4gICAgICAgIHNldmVyaXR5OiBpLnNldmVyaXR5LFxuICAgICAgICB0aXRsZTogaS50aXRsZSxcbiAgICAgIH0pKSB8fCBbXSxcbiAgICB9O1xuICAgIFxuICAgIGNvbnN0IGF2YWlsYWJsZUFjdGlvbnM6IE9wZXJhdG9yVmlld0FjdGlvbltdID0gW1xuICAgICAge1xuICAgICAgICBhY3Rpb25UeXBlOiAndmlld19hcHByb3ZhbHMnLFxuICAgICAgICBsYWJlbDogJ+afpeeci+aJgOacieWuoeaJuScsXG4gICAgICAgIHRhcmdldFR5cGU6ICdhcHByb3ZhbCcsXG4gICAgICAgIHN0eWxlOiAnZGVmYXVsdCcsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBhY3Rpb25UeXBlOiAndmlld19pbmNpZGVudHMnLFxuICAgICAgICBsYWJlbDogJ+afpeeci+aJgOacieS6i+S7ticsXG4gICAgICAgIHRhcmdldFR5cGU6ICdpbmNpZGVudCcsXG4gICAgICAgIHN0eWxlOiAnZGVmYXVsdCcsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBhY3Rpb25UeXBlOiAndmlld190YXNrcycsXG4gICAgICAgIGxhYmVsOiAn5p+l55yL5omA5pyJ5Lu75YqhJyxcbiAgICAgICAgdGFyZ2V0VHlwZTogJ3Rhc2snLFxuICAgICAgICBzdHlsZTogJ2RlZmF1bHQnLFxuICAgICAgfSxcbiAgICBdO1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICB2aWV3S2luZDogJ2luYm94JyxcbiAgICAgIHRpdGxlOiAn5pS25Lu2566xJyxcbiAgICAgIHN1YnRpdGxlOiAn6IGa5ZCI5b6F5aSE55CG6aG5JyxcbiAgICAgIG1vZGUsXG4gICAgICBzdW1tYXJ5OiB0aGlzLmJ1aWxkSW5ib3hTdW1tYXJ5KGNvbnRlbnQpLFxuICAgICAgY29udGVudCxcbiAgICAgIGF2YWlsYWJsZUFjdGlvbnMsXG4gICAgICBicmVhZGNydW1iczogWydEYXNoYm9hcmQnLCAnSW5ib3gnXSxcbiAgICAgIGdlbmVyYXRlZEF0OiBub3csXG4gICAgICBmcmVzaG5lc3NNczogbm93IC0gY29udHJvbFNuYXBzaG90LmNyZWF0ZWRBdCxcbiAgICB9O1xuICB9XG4gIFxuICBidWlsZEludGVydmVudGlvblZpZXcoaW5wdXQ6IEJ1aWxkSW50ZXJ2ZW50aW9uVmlld0lucHV0KTogT3BlcmF0b3JWaWV3UGF5bG9hZCB7XG4gICAgY29uc3QgeyBodW1hbkxvb3BTbmFwc2hvdCwgbW9kZSA9ICdzdW1tYXJ5Jywgc3VyZmFjZSA9ICdjbGknIH0gPSBpbnB1dDtcbiAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuICAgIFxuICAgIGNvbnN0IGF2YWlsYWJsZUFjdGlvbnM6IE9wZXJhdG9yVmlld0FjdGlvbltdID0gW107XG4gICAgXG4gICAgLy8g5Li65byA5pS+5LuL5YWl5re75Yqg5Yqo5L2cXG4gICAgZm9yIChjb25zdCBpbnRlcnZlbnRpb24gb2YgaHVtYW5Mb29wU25hcHNob3Qub3BlbkludGVydmVudGlvbnMuc2xpY2UoMCwgNSkpIHtcbiAgICAgIGF2YWlsYWJsZUFjdGlvbnMucHVzaCh7XG4gICAgICAgIGFjdGlvblR5cGU6ICdkaXNtaXNzX2ludGVydmVudGlvbicsXG4gICAgICAgIGxhYmVsOiBg5b+955Wl77yaJHtpbnRlcnZlbnRpb24uaWR9YCxcbiAgICAgICAgdGFyZ2V0VHlwZTogJ2ludGVydmVudGlvbicsXG4gICAgICAgIHRhcmdldElkOiBpbnRlcnZlbnRpb24uaWQsXG4gICAgICAgIHN0eWxlOiAnZGVmYXVsdCcsXG4gICAgICB9KTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgY29udGVudCA9IHtcbiAgICAgIG9wZW5JbnRlcnZlbnRpb25zOiBodW1hbkxvb3BTbmFwc2hvdC5vcGVuSW50ZXJ2ZW50aW9ucy5tYXAoaSA9PiAoe1xuICAgICAgICBpZDogaS5pZCxcbiAgICAgICAgc291cmNlVHlwZTogaS5zb3VyY2VUeXBlLFxuICAgICAgICBzb3VyY2VJZDogaS5zb3VyY2VJZCxcbiAgICAgICAgc2V2ZXJpdHk6IGkuc2V2ZXJpdHksXG4gICAgICAgIHRpdGxlOiBpLnRpdGxlLFxuICAgICAgICByZWFzb246IGkucmVhc29uLFxuICAgICAgICBzdGF0dXM6IGkuc3RhdHVzLFxuICAgICAgfSkpLFxuICAgICAgcXVldWVkQ29uZmlybWF0aW9uczogaHVtYW5Mb29wU25hcHNob3QucXVldWVkQ29uZmlybWF0aW9ucy5tYXAoYyA9PiAoe1xuICAgICAgICBhY3Rpb25JZDogYy5hY3Rpb25JZCxcbiAgICAgICAgYWN0aW9uVHlwZTogYy5hY3Rpb25UeXBlLFxuICAgICAgICBzdGF0dXM6IGMuc3RhdHVzLFxuICAgICAgfSkpLFxuICAgICAgc3VnZ2VzdGlvbnM6IGh1bWFuTG9vcFNuYXBzaG90LnN1Z2dlc3Rpb25zLm1hcChzID0+ICh7XG4gICAgICAgIGlkOiBzLmlkLFxuICAgICAgICBsYWJlbDogcy5sYWJlbCxcbiAgICAgICAgcmVjb21tZW5kZWQ6IHMucmVjb21tZW5kZWQsXG4gICAgICB9KSksXG4gICAgfTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgdmlld0tpbmQ6ICdpbnRlcnZlbnRpb25zJyxcbiAgICAgIHRpdGxlOiAn5LuL5YWl6KeG5Zu+JyxcbiAgICAgIHN1YnRpdGxlOiBg5byA5pS+ICR7aHVtYW5Mb29wU25hcHNob3Quc3VtbWFyeS5vcGVuQ291bnR9IOS4quS7i+WFpWAsXG4gICAgICBtb2RlLFxuICAgICAgc3VtbWFyeTogYOW8gOaUviAke2h1bWFuTG9vcFNuYXBzaG90LnN1bW1hcnkub3BlbkNvdW50fSB8IOe0p+aApSAke2h1bWFuTG9vcFNuYXBzaG90LnN1bW1hcnkuY3JpdGljYWxDb3VudH0gfCDlvoXnoa7orqQgJHtodW1hbkxvb3BTbmFwc2hvdC5zdW1tYXJ5LnBlbmRpbmdDb25maXJtYXRpb25zfWAsXG4gICAgICBjb250ZW50LFxuICAgICAgYXZhaWxhYmxlQWN0aW9ucyxcbiAgICAgIGJyZWFkY3J1bWJzOiBbJ0Rhc2hib2FyZCcsICdJbnRlcnZlbnRpb25zJ10sXG4gICAgICBnZW5lcmF0ZWRBdDogbm93LFxuICAgICAgZnJlc2huZXNzTXM6IDAsXG4gICAgfTtcbiAgfVxuICBcbiAgYnVpbGREZXRhaWxWaWV3KGlucHV0OiBCdWlsZERldGFpbFZpZXdJbnB1dCk6IE9wZXJhdG9yVmlld1BheWxvYWQge1xuICAgIGNvbnN0IHsgdGFyZ2V0VHlwZSwgdGFyZ2V0SWQsIGRhdGEsIG1vZGUgPSAnZGV0YWlsJywgc3VyZmFjZSA9ICdjbGknIH0gPSBpbnB1dDtcbiAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuICAgIFxuICAgIGNvbnN0IGF2YWlsYWJsZUFjdGlvbnM6IE9wZXJhdG9yVmlld0FjdGlvbltdID0gW1xuICAgICAge1xuICAgICAgICBhY3Rpb25UeXBlOiAnZ29fYmFjaycsXG4gICAgICAgIGxhYmVsOiAn6L+U5ZueJyxcbiAgICAgICAgc3R5bGU6ICdkZWZhdWx0JyxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGFjdGlvblR5cGU6ICdyZWZyZXNoJyxcbiAgICAgICAgbGFiZWw6ICfliLfmlrAnLFxuICAgICAgICBzdHlsZTogJ2RlZmF1bHQnLFxuICAgICAgfSxcbiAgICBdO1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICB2aWV3S2luZDogJ2l0ZW1fZGV0YWlsJyxcbiAgICAgIHRpdGxlOiBgJHt0aGlzLmZvcm1hdFRhcmdldFR5cGUodGFyZ2V0VHlwZSl9IOivpuaDhWAsXG4gICAgICBzdWJ0aXRsZTogYElEOiAke3RhcmdldElkfWAsXG4gICAgICBtb2RlLFxuICAgICAgc3VtbWFyeTogdW5kZWZpbmVkLFxuICAgICAgY29udGVudDogZGF0YSxcbiAgICAgIGF2YWlsYWJsZUFjdGlvbnMsXG4gICAgICBicmVhZGNydW1iczogWydEYXNoYm9hcmQnLCB0aGlzLmZvcm1hdFRhcmdldFR5cGUodGFyZ2V0VHlwZSksIHRhcmdldElkXSxcbiAgICAgIGdlbmVyYXRlZEF0OiBub3csXG4gICAgICBmcmVzaG5lc3NNczogMCxcbiAgICB9O1xuICB9XG4gIFxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIC8vIOi+heWKqeaWueazlVxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIFxuICBwcml2YXRlIGJ1aWxkRGFzaGJvYXJkU3VtbWFyeShzdW1tYXJ5OiBDb250cm9sU3VyZmFjZVNuYXBzaG90WydzdW1tYXJ5J10pOiBzdHJpbmcge1xuICAgIGNvbnN0IHBhcnRzOiBzdHJpbmdbXSA9IFtdO1xuICAgIFxuICAgIHBhcnRzLnB1c2goYOS7u+WKoSAke3N1bW1hcnkudG90YWxUYXNrc31gKTtcbiAgICBwYXJ0cy5wdXNoKGDlrqHmibkgJHtzdW1tYXJ5LnBlbmRpbmdBcHByb3ZhbHN9YCk7XG4gICAgcGFydHMucHVzaChg5YGl5bq3ICR7c3VtbWFyeS5oZWFsdGhTY29yZX1gKTtcbiAgICBcbiAgICBpZiAoc3VtbWFyeS5hdHRlbnRpb25JdGVtcyA+IDApIHtcbiAgICAgIHBhcnRzLnB1c2goYOWFs+azqCAke3N1bW1hcnkuYXR0ZW50aW9uSXRlbXN9YCk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBwYXJ0cy5qb2luKCcgfCAnKTtcbiAgfVxuICBcbiAgcHJpdmF0ZSBidWlsZEluYm94U3VtbWFyeShjb250ZW50OiBhbnkpOiBzdHJpbmcge1xuICAgIGNvbnN0IHBhcnRzOiBzdHJpbmdbXSA9IFtdO1xuICAgIFxuICAgIGlmIChjb250ZW50LnBlbmRpbmdBcHByb3ZhbHM/Lmxlbmd0aCkge1xuICAgICAgcGFydHMucHVzaChg5a6h5om5ICR7Y29udGVudC5wZW5kaW5nQXBwcm92YWxzLmxlbmd0aH1gKTtcbiAgICB9XG4gICAgaWYgKGNvbnRlbnQuYWN0aXZlSW5jaWRlbnRzPy5sZW5ndGgpIHtcbiAgICAgIHBhcnRzLnB1c2goYOS6i+S7tiAke2NvbnRlbnQuYWN0aXZlSW5jaWRlbnRzLmxlbmd0aH1gKTtcbiAgICB9XG4gICAgaWYgKGNvbnRlbnQuYmxvY2tlZFRhc2tzPy5sZW5ndGgpIHtcbiAgICAgIHBhcnRzLnB1c2goYOmYu+WhniAke2NvbnRlbnQuYmxvY2tlZFRhc2tzLmxlbmd0aH1gKTtcbiAgICB9XG4gICAgaWYgKGNvbnRlbnQub3BlbkludGVydmVudGlvbnM/Lmxlbmd0aCkge1xuICAgICAgcGFydHMucHVzaChg5LuL5YWlICR7Y29udGVudC5vcGVuSW50ZXJ2ZW50aW9ucy5sZW5ndGh9YCk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBwYXJ0cy5sZW5ndGggPiAwID8gcGFydHMuam9pbignIHwgJykgOiAn5pS25Lu2566x5Li656m6JztcbiAgfVxuICBcbiAgcHJpdmF0ZSBmb3JtYXRUYXJnZXRUeXBlKHRhcmdldFR5cGU6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgbWFwcGluZzogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICAgIHRhc2s6ICfku7vliqEnLFxuICAgICAgYXBwcm92YWw6ICflrqHmibknLFxuICAgICAgaW5jaWRlbnQ6ICfkuovku7YnLFxuICAgICAgYWdlbnQ6ICdBZ2VudCcsXG4gICAgICBpbnRlcnZlbnRpb246ICfku4vlhaUnLFxuICAgICAgd29ya3NwYWNlOiAnV29ya3NwYWNlJyxcbiAgICB9O1xuICAgIHJldHVybiBtYXBwaW5nW3RhcmdldFR5cGVdIHx8IHRhcmdldFR5cGU7XG4gIH1cbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5bel5Y6C5Ye95pWwXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVPcGVyYXRvclZpZXdGYWN0b3J5KCk6IE9wZXJhdG9yVmlld0ZhY3Rvcnkge1xuICByZXR1cm4gbmV3IERlZmF1bHRPcGVyYXRvclZpZXdGYWN0b3J5KCk7XG59XG4iXX0=