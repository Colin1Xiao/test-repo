"use strict";
/**
 * Default Operator Surface Service
 * Phase 2A-1R - 视图服务实现
 *
 * 职责：
 * - 实现 OperatorSurfaceService 接口
 * - 从现有系统组装真实视图数据
 * - 依赖：OperatorContextAdapter, OperatorViewFactory
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultOperatorSurfaceService = void 0;
exports.createOperatorSurfaceService = createOperatorSurfaceService;
// ============================================================================
// 默认实现
// ============================================================================
class DefaultOperatorSurfaceService {
    constructor(contextAdapter, viewFactory, inboxService) {
        this.inboxService = null;
        this.contextAdapter = contextAdapter;
        this.viewFactory = viewFactory;
        this.inboxService = inboxService || null;
    }
    async getDashboardView(input) {
        const fullContext = await this.contextAdapter.getFullContext(input.workspaceId);
        return this.viewFactory.buildDashboardView({
            controlSnapshot: fullContext.control,
            dashboardSnapshot: fullContext.dashboard,
            humanLoopSnapshot: fullContext.humanLoop,
            mode: input.mode,
            surface: input.actor.surface,
        });
    }
    async getTaskView(input) {
        const controlSnapshot = await this.contextAdapter.getControlSnapshot(input.workspaceId);
        return this.viewFactory.buildTaskView({
            controlSnapshot,
            mode: input.mode,
            surface: input.actor.surface,
        });
    }
    async getApprovalView(input) {
        const [controlSnapshot, humanLoopSnapshot] = await Promise.all([
            this.contextAdapter.getControlSnapshot(input.workspaceId),
            this.contextAdapter.getHumanLoopSnapshot(input.workspaceId),
        ]);
        return this.viewFactory.buildApprovalView({
            controlSnapshot,
            humanLoopSnapshot,
            mode: input.mode,
            surface: input.actor.surface,
        });
    }
    async getIncidentView(input) {
        const [controlSnapshot, dashboardSnapshot] = await Promise.all([
            this.contextAdapter.getControlSnapshot(input.workspaceId),
            this.contextAdapter.getDashboardSnapshot(input.workspaceId),
        ]);
        return this.viewFactory.buildIncidentView({
            controlSnapshot,
            dashboardSnapshot,
            mode: input.mode,
            surface: input.actor.surface,
        });
    }
    async getAgentView(input) {
        const controlSnapshot = await this.contextAdapter.getControlSnapshot(input.workspaceId);
        return this.viewFactory.buildAgentView({
            controlSnapshot,
            mode: input.mode,
            surface: input.actor.surface,
        });
    }
    async getInboxView(input) {
        const now = Date.now();
        // 优先使用 InboxService（如果已配置）
        if (this.inboxService) {
            const snapshot = await this.inboxService.getInboxSnapshot(input.workspaceId);
            // 构建可用动作
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
            // 为紧急项添加快速动作
            const urgentItems = snapshot.items.filter(i => i.severity === 'critical' || i.severity === 'high').slice(0, 5);
            for (const item of urgentItems) {
                if (item.suggestedActions) {
                    for (const action of item.suggestedActions.slice(0, 2)) {
                        availableActions.push({
                            actionType: action,
                            label: `${item.itemType === 'approval' ? '批准' : item.itemType === 'incident' ? '确认' : '重试'}：${item.sourceId}`,
                            targetType: item.itemType,
                            targetId: item.sourceId,
                            style: item.severity === 'critical' ? 'danger' : 'warning',
                        });
                    }
                }
            }
            return {
                viewKind: 'inbox',
                title: '收件箱',
                subtitle: `总计 ${snapshot.summary.totalCount} 项待处理`,
                mode: input.mode,
                summary: `审批 ${snapshot.summary.pendingApprovals} | 事件 ${snapshot.summary.openIncidents} | 任务 ${snapshot.summary.blockedTasks} | 紧急 ${snapshot.summary.criticalCount}`,
                content: {
                    summary: snapshot.summary,
                    items: snapshot.items.slice(0, 20), // 只显示前 20 项
                    urgentItems: urgentItems,
                },
                availableActions,
                breadcrumbs: ['Dashboard', 'Inbox'],
                generatedAt: now,
                freshnessMs: now - snapshot.generatedAt,
            };
        }
        // 降级：使用轻量聚合
        const [controlSnapshot, humanLoopSnapshot] = await Promise.all([
            this.contextAdapter.getControlSnapshot(input.workspaceId),
            this.contextAdapter.getHumanLoopSnapshot(input.workspaceId),
        ]);
        return this.viewFactory.buildInboxView({
            controlSnapshot,
            humanLoopSnapshot,
            mode: input.mode,
            surface: input.actor.surface,
        });
    }
    async getInterventionView(input) {
        const humanLoopSnapshot = await this.contextAdapter.getHumanLoopSnapshot(input.workspaceId);
        return this.viewFactory.buildInterventionView({
            humanLoopSnapshot,
            mode: input.mode,
            surface: input.actor.surface,
        });
    }
    async getHistoryView(input) {
        // TODO: 实现历史记录视图
        // 目前返回一个占位视图
        return {
            viewKind: 'history',
            title: '历史记录',
            subtitle: '功能开发中',
            mode: input.mode,
            summary: '历史记录功能将在后续版本实现',
            content: {
                message: '历史记录功能开发中，敬请期待',
            },
            availableActions: [
                {
                    actionType: 'go_back',
                    label: '返回',
                    style: 'default',
                },
            ],
            breadcrumbs: ['Dashboard', 'History'],
            generatedAt: Date.now(),
            freshnessMs: 0,
        };
    }
    async getItemDetailView(input) {
        // TODO: 根据 targetId 获取真实数据
        // 目前返回一个占位详情
        const data = {
            targetType: input.targetId ? 'unknown' : 'unknown',
            targetId: input.targetId || 'unknown',
            message: '详情功能开发中',
        };
        return this.viewFactory.buildDetailView({
            targetType: 'unknown',
            targetId: input.targetId || 'unknown',
            data,
            mode: input.mode,
            surface: input.actor.surface,
        });
    }
    async getView(input) {
        // 统一入口 - 按 viewKind 分发
        switch (input.viewKind) {
            case 'dashboard':
                return this.getDashboardView(input);
            case 'tasks':
                return this.getTaskView(input);
            case 'approvals':
                return this.getApprovalView(input);
            case 'incidents':
                return this.getIncidentView(input);
            case 'agents':
                return this.getAgentView(input);
            case 'inbox':
                return this.getInboxView(input);
            case 'interventions':
                return this.getInterventionView(input);
            case 'history':
                return this.getHistoryView(input);
            case 'item_detail':
                return this.getItemDetailView(input);
            default:
                throw new Error(`Unsupported view kind: ${input.viewKind}`);
        }
    }
}
exports.DefaultOperatorSurfaceService = DefaultOperatorSurfaceService;
// ============================================================================
// 工厂函数
// ============================================================================
function createOperatorSurfaceService(contextAdapter, viewFactory) {
    return new DefaultOperatorSurfaceService(contextAdapter, viewFactory);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVmYXVsdF9vcGVyYXRvcl9zdXJmYWNlX3NlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvb3BlcmF0b3Ivc2VydmljZXMvZGVmYXVsdF9vcGVyYXRvcl9zdXJmYWNlX3NlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7OztHQVFHOzs7QUFnUUgsb0VBS0M7QUExUEQsK0VBQStFO0FBQy9FLE9BQU87QUFDUCwrRUFBK0U7QUFFL0UsTUFBYSw2QkFBNkI7SUFLeEMsWUFDRSxjQUFzQyxFQUN0QyxXQUFnQyxFQUNoQyxZQUEyQjtRQUxyQixpQkFBWSxHQUF3QixJQUFJLENBQUM7UUFPL0MsSUFBSSxDQUFDLGNBQWMsR0FBRyxjQUFjLENBQUM7UUFDckMsSUFBSSxDQUFDLFdBQVcsR0FBRyxXQUFXLENBQUM7UUFDL0IsSUFBSSxDQUFDLFlBQVksR0FBRyxZQUFZLElBQUksSUFBSSxDQUFDO0lBQzNDLENBQUM7SUFFRCxLQUFLLENBQUMsZ0JBQWdCLENBQUMsS0FBMEI7UUFDL0MsTUFBTSxXQUFXLEdBQUcsTUFBTSxJQUFJLENBQUMsY0FBYyxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUM7UUFFaEYsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLGtCQUFrQixDQUFDO1lBQ3pDLGVBQWUsRUFBRSxXQUFXLENBQUMsT0FBTztZQUNwQyxpQkFBaUIsRUFBRSxXQUFXLENBQUMsU0FBUztZQUN4QyxpQkFBaUIsRUFBRSxXQUFXLENBQUMsU0FBUztZQUN4QyxJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUk7WUFDaEIsT0FBTyxFQUFFLEtBQUssQ0FBQyxLQUFLLENBQUMsT0FBTztTQUM3QixDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQsS0FBSyxDQUFDLFdBQVcsQ0FBQyxLQUEwQjtRQUMxQyxNQUFNLGVBQWUsR0FBRyxNQUFNLElBQUksQ0FBQyxjQUFjLENBQUMsa0JBQWtCLENB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QUFFRCwrRUFBK0U7QUFDL0UsT0FBTztBQUNQLCtFQUErRTtBQUUvRSxTQUFnQiw0QkFBNEIsQ0FDMUMsY0FBc0MsRUFDdEMsV0FBZ0M7SUFFaEMsT0FBTyxJQUFJLDZCQUE2QixDQUFDLGNBQWMsRUFBRSxXQUFXLENBQUMsQ0FBQztBQUN4RSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBEZWZhdWx0IE9wZXJhdG9yIFN1cmZhY2UgU2VydmljZVxuICogUGhhc2UgMkEtMVIgLSDop4blm77mnI3liqHlrp7njrBcbiAqIFxuICog6IGM6LSj77yaXG4gKiAtIOWunueOsCBPcGVyYXRvclN1cmZhY2VTZXJ2aWNlIOaOpeWPo1xuICogLSDku47njrDmnInns7vnu5/nu4Too4XnnJ/lrp7op4blm77mlbDmja5cbiAqIC0g5L6d6LWW77yaT3BlcmF0b3JDb250ZXh0QWRhcHRlciwgT3BlcmF0b3JWaWV3RmFjdG9yeVxuICovXG5cbmltcG9ydCB0eXBlIHtcbiAgR2V0U3VyZmFjZVZpZXdJbnB1dCxcbiAgT3BlcmF0b3JWaWV3UGF5bG9hZCxcbiAgT3BlcmF0b3JTdXJmYWNlU2VydmljZSxcbn0gZnJvbSAnLi4vdHlwZXMvc3VyZmFjZV90eXBlcyc7XG5pbXBvcnQgdHlwZSB7IE9wZXJhdG9yQ29udGV4dEFkYXB0ZXIgfSBmcm9tICcuL29wZXJhdG9yX2NvbnRleHRfYWRhcHRlcic7XG5pbXBvcnQgdHlwZSB7IE9wZXJhdG9yVmlld0ZhY3RvcnkgfSBmcm9tICcuL29wZXJhdG9yX3ZpZXdfZmFjdG9yeSc7XG5pbXBvcnQgdHlwZSB7IEluYm94U2VydmljZSB9IGZyb20gJy4uL2luYm94L2luYm94X3NlcnZpY2UnO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDpu5jorqTlrp7njrBcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGNsYXNzIERlZmF1bHRPcGVyYXRvclN1cmZhY2VTZXJ2aWNlIGltcGxlbWVudHMgT3BlcmF0b3JTdXJmYWNlU2VydmljZSB7XG4gIHByaXZhdGUgY29udGV4dEFkYXB0ZXI6IE9wZXJhdG9yQ29udGV4dEFkYXB0ZXI7XG4gIHByaXZhdGUgdmlld0ZhY3Rvcnk6IE9wZXJhdG9yVmlld0ZhY3Rvcnk7XG4gIHByaXZhdGUgaW5ib3hTZXJ2aWNlOiBJbmJveFNlcnZpY2UgfCBudWxsID0gbnVsbDtcbiAgXG4gIGNvbnN0cnVjdG9yKFxuICAgIGNvbnRleHRBZGFwdGVyOiBPcGVyYXRvckNvbnRleHRBZGFwdGVyLFxuICAgIHZpZXdGYWN0b3J5OiBPcGVyYXRvclZpZXdGYWN0b3J5LFxuICAgIGluYm94U2VydmljZT86IEluYm94U2VydmljZVxuICApIHtcbiAgICB0aGlzLmNvbnRleHRBZGFwdGVyID0gY29udGV4dEFkYXB0ZXI7XG4gICAgdGhpcy52aWV3RmFjdG9yeSA9IHZpZXdGYWN0b3J5O1xuICAgIHRoaXMuaW5ib3hTZXJ2aWNlID0gaW5ib3hTZXJ2aWNlIHx8IG51bGw7XG4gIH1cbiAgXG4gIGFzeW5jIGdldERhc2hib2FyZFZpZXcoaW5wdXQ6IEdldFN1cmZhY2VWaWV3SW5wdXQpOiBQcm9taXNlPE9wZXJhdG9yVmlld1BheWxvYWQ+IHtcbiAgICBjb25zdCBmdWxsQ29udGV4dCA9IGF3YWl0IHRoaXMuY29udGV4dEFkYXB0ZXIuZ2V0RnVsbENvbnRleHQoaW5wdXQud29ya3NwYWNlSWQpO1xuICAgIFxuICAgIHJldHVybiB0aGlzLnZpZXdGYWN0b3J5LmJ1aWxkRGFzaGJvYXJkVmlldyh7XG4gICAgICBjb250cm9sU25hcHNob3Q6IGZ1bGxDb250ZXh0LmNvbnRyb2wsXG4gICAgICBkYXNoYm9hcmRTbmFwc2hvdDogZnVsbENvbnRleHQuZGFzaGJvYXJkLFxuICAgICAgaHVtYW5Mb29wU25hcHNob3Q6IGZ1bGxDb250ZXh0Lmh1bWFuTG9vcCxcbiAgICAgIG1vZGU6IGlucHV0Lm1vZGUsXG4gICAgICBzdXJmYWNlOiBpbnB1dC5hY3Rvci5zdXJmYWNlLFxuICAgIH0pO1xuICB9XG4gIFxuICBhc3luYyBnZXRUYXNrVmlldyhpbnB1dDogR2V0U3VyZmFjZVZpZXdJbnB1dCk6IFByb21pc2U8T3BlcmF0b3JWaWV3UGF5bG9hZD4ge1xuICAgIGNvbnN0IGNvbnRyb2xTbmFwc2hvdCA9IGF3YWl0IHRoaXMuY29udGV4dEFkYXB0ZXIuZ2V0Q29udHJvbFNuYXBzaG90KGlucHV0LndvcmtzcGFjZUlkKTtcbiAgICBcbiAgICByZXR1cm4gdGhpcy52aWV3RmFjdG9yeS5idWlsZFRhc2tWaWV3KHtcbiAgICAgIGNvbnRyb2xTbmFwc2hvdCxcbiAgICAgIG1vZGU6IGlucHV0Lm1vZGUsXG4gICAgICBzdXJmYWNlOiBpbnB1dC5hY3Rvci5zdXJmYWNlLFxuICAgIH0pO1xuICB9XG4gIFxuICBhc3luYyBnZXRBcHByb3ZhbFZpZXcoaW5wdXQ6IEdldFN1cmZhY2VWaWV3SW5wdXQpOiBQcm9taXNlPE9wZXJhdG9yVmlld1BheWxvYWQ+IHtcbiAgICBjb25zdCBbY29udHJvbFNuYXBzaG90LCBodW1hbkxvb3BTbmFwc2hvdF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICB0aGlzLmNvbnRleHRBZGFwdGVyLmdldENvbnRyb2xTbmFwc2hvdChpbnB1dC53b3Jrc3BhY2VJZCksXG4gICAgICB0aGlzLmNvbnRleHRBZGFwdGVyLmdldEh1bWFuTG9vcFNuYXBzaG90KGlucHV0LndvcmtzcGFjZUlkKSxcbiAgICBdKTtcbiAgICBcbiAgICByZXR1cm4gdGhpcy52aWV3RmFjdG9yeS5idWlsZEFwcHJvdmFsVmlldyh7XG4gICAgICBjb250cm9sU25hcHNob3QsXG4gICAgICBodW1hbkxvb3BTbmFwc2hvdCxcbiAgICAgIG1vZGU6IGlucHV0Lm1vZGUsXG4gICAgICBzdXJmYWNlOiBpbnB1dC5hY3Rvci5zdXJmYWNlLFxuICAgIH0pO1xuICB9XG4gIFxuICBhc3luYyBnZXRJbmNpZGVudFZpZXcoaW5wdXQ6IEdldFN1cmZhY2VWaWV3SW5wdXQpOiBQcm9taXNlPE9wZXJhdG9yVmlld1BheWxvYWQ+IHtcbiAgICBjb25zdCBbY29udHJvbFNuYXBzaG90LCBkYXNoYm9hcmRTbmFwc2hvdF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICB0aGlzLmNvbnRleHRBZGFwdGVyLmdldENvbnRyb2xTbmFwc2hvdChpbnB1dC53b3Jrc3BhY2VJZCksXG4gICAgICB0aGlzLmNvbnRleHRBZGFwdGVyLmdldERhc2hib2FyZFNuYXBzaG90KGlucHV0LndvcmtzcGFjZUlkKSxcbiAgICBdKTtcbiAgICBcbiAgICByZXR1cm4gdGhpcy52aWV3RmFjdG9yeS5idWlsZEluY2lkZW50Vmlldyh7XG4gICAgICBjb250cm9sU25hcHNob3QsXG4gICAgICBkYXNoYm9hcmRTbmFwc2hvdCxcbiAgICAgIG1vZGU6IGlucHV0Lm1vZGUsXG4gICAgICBzdXJmYWNlOiBpbnB1dC5hY3Rvci5zdXJmYWNlLFxuICAgIH0pO1xuICB9XG4gIFxuICBhc3luYyBnZXRBZ2VudFZpZXcoaW5wdXQ6IEdldFN1cmZhY2VWaWV3SW5wdXQpOiBQcm9taXNlPE9wZXJhdG9yVmlld1BheWxvYWQ+IHtcbiAgICBjb25zdCBjb250cm9sU25hcHNob3QgPSBhd2FpdCB0aGlzLmNvbnRleHRBZGFwdGVyLmdldENvbnRyb2xTbmFwc2hvdChpbnB1dC53b3Jrc3BhY2VJZCk7XG4gICAgXG4gICAgcmV0dXJuIHRoaXMudmlld0ZhY3RvcnkuYnVpbGRBZ2VudFZpZXcoe1xuICAgICAgY29udHJvbFNuYXBzaG90LFxuICAgICAgbW9kZTogaW5wdXQubW9kZSxcbiAgICAgIHN1cmZhY2U6IGlucHV0LmFjdG9yLnN1cmZhY2UsXG4gICAgfSk7XG4gIH1cbiAgXG4gIGFzeW5jIGdldEluYm94VmlldyhpbnB1dDogR2V0U3VyZmFjZVZpZXdJbnB1dCk6IFByb21pc2U8T3BlcmF0b3JWaWV3UGF5bG9hZD4ge1xuICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4gICAgXG4gICAgLy8g5LyY5YWI5L2/55SoIEluYm94U2VydmljZe+8iOWmguaenOW3sumFjee9ru+8iVxuICAgIGlmICh0aGlzLmluYm94U2VydmljZSkge1xuICAgICAgY29uc3Qgc25hcHNob3QgPSBhd2FpdCB0aGlzLmluYm94U2VydmljZS5nZXRJbmJveFNuYXBzaG90KGlucHV0LndvcmtzcGFjZUlkKTtcbiAgICAgIFxuICAgICAgLy8g5p6E5bu65Y+v55So5Yqo5L2cXG4gICAgICBjb25zdCBhdmFpbGFibGVBY3Rpb25zID0gW1xuICAgICAgICB7XG4gICAgICAgICAgYWN0aW9uVHlwZTogJ3ZpZXdfYXBwcm92YWxzJyBhcyBjb25zdCxcbiAgICAgICAgICBsYWJlbDogJ+afpeeci+aJgOacieWuoeaJuScsXG4gICAgICAgICAgdGFyZ2V0VHlwZTogJ2FwcHJvdmFsJyBhcyBjb25zdCxcbiAgICAgICAgICBzdHlsZTogJ2RlZmF1bHQnIGFzIGNvbnN0LFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgYWN0aW9uVHlwZTogJ3ZpZXdfaW5jaWRlbnRzJyBhcyBjb25zdCxcbiAgICAgICAgICBsYWJlbDogJ+afpeeci+aJgOacieS6i+S7ticsXG4gICAgICAgICAgdGFyZ2V0VHlwZTogJ2luY2lkZW50JyBhcyBjb25zdCxcbiAgICAgICAgICBzdHlsZTogJ2RlZmF1bHQnIGFzIGNvbnN0LFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgYWN0aW9uVHlwZTogJ3ZpZXdfdGFza3MnIGFzIGNvbnN0LFxuICAgICAgICAgIGxhYmVsOiAn5p+l55yL5omA5pyJ5Lu75YqhJyxcbiAgICAgICAgICB0YXJnZXRUeXBlOiAndGFzaycgYXMgY29uc3QsXG4gICAgICAgICAgc3R5bGU6ICdkZWZhdWx0JyBhcyBjb25zdCxcbiAgICAgICAgfSxcbiAgICAgIF07XG4gICAgICBcbiAgICAgIC8vIOS4uue0p+aApemhuea3u+WKoOW/q+mAn+WKqOS9nFxuICAgICAgY29uc3QgdXJnZW50SXRlbXMgPSBzbmFwc2hvdC5pdGVtcy5maWx0ZXIoXG4gICAgICAgIGkgPT4gaS5zZXZlcml0eSA9PT0gJ2NyaXRpY2FsJyB8fCBpLnNldmVyaXR5ID09PSAnaGlnaCdcbiAgICAgICkuc2xpY2UoMCwgNSk7XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgaXRlbSBvZiB1cmdlbnRJdGVtcykge1xuICAgICAgICBpZiAoaXRlbS5zdWdnZXN0ZWRBY3Rpb25zKSB7XG4gICAgICAgICAgZm9yIChjb25zdCBhY3Rpb24gb2YgaXRlbS5zdWdnZXN0ZWRBY3Rpb25zLnNsaWNlKDAsIDIpKSB7XG4gICAgICAgICAgICBhdmFpbGFibGVBY3Rpb25zLnB1c2goe1xuICAgICAgICAgICAgICBhY3Rpb25UeXBlOiBhY3Rpb24gYXMgYW55LFxuICAgICAgICAgICAgICBsYWJlbDogYCR7aXRlbS5pdGVtVHlwZSA9PT0gJ2FwcHJvdmFsJyA/ICfmibnlh4YnIDogaXRlbS5pdGVtVHlwZSA9PT0gJ2luY2lkZW50JyA/ICfnoa7orqQnIDogJ+mHjeivlSd977yaJHtpdGVtLnNvdXJjZUlkfWAsXG4gICAgICAgICAgICAgIHRhcmdldFR5cGU6IGl0ZW0uaXRlbVR5cGUgYXMgYW55LFxuICAgICAgICAgICAgICB0YXJnZXRJZDogaXRlbS5zb3VyY2VJZCxcbiAgICAgICAgICAgICAgc3R5bGU6IGl0ZW0uc2V2ZXJpdHkgPT09ICdjcml0aWNhbCcgPyAnZGFuZ2VyJyA6ICd3YXJuaW5nJyBhcyBjb25zdCxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4ge1xuICAgICAgICB2aWV3S2luZDogJ2luYm94JyBhcyBjb25zdCxcbiAgICAgICAgdGl0bGU6ICfmlLbku7bnrrEnLFxuICAgICAgICBzdWJ0aXRsZTogYOaAu+iuoSAke3NuYXBzaG90LnN1bW1hcnkudG90YWxDb3VudH0g6aG55b6F5aSE55CGYCxcbiAgICAgICAgbW9kZTogaW5wdXQubW9kZSxcbiAgICAgICAgc3VtbWFyeTogYOWuoeaJuSAke3NuYXBzaG90LnN1bW1hcnkucGVuZGluZ0FwcHJvdmFsc30gfCDkuovku7YgJHtzbmFwc2hvdC5zdW1tYXJ5Lm9wZW5JbmNpZGVudHN9IHwg5Lu75YqhICR7c25hcHNob3Quc3VtbWFyeS5ibG9ja2VkVGFza3N9IHwg57Sn5oClICR7c25hcHNob3Quc3VtbWFyeS5jcml0aWNhbENvdW50fWAsXG4gICAgICAgIGNvbnRlbnQ6IHtcbiAgICAgICAgICBzdW1tYXJ5OiBzbmFwc2hvdC5zdW1tYXJ5LFxuICAgICAgICAgIGl0ZW1zOiBzbmFwc2hvdC5pdGVtcy5zbGljZSgwLCAyMCksIC8vIOWPquaYvuekuuWJjSAyMCDpoblcbiAgICAgICAgICB1cmdlbnRJdGVtczogdXJnZW50SXRlbXMsXG4gICAgICAgIH0sXG4gICAgICAgIGF2YWlsYWJsZUFjdGlvbnMsXG4gICAgICAgIGJyZWFkY3J1bWJzOiBbJ0Rhc2hib2FyZCcsICdJbmJveCddLFxuICAgICAgICBnZW5lcmF0ZWRBdDogbm93LFxuICAgICAgICBmcmVzaG5lc3NNczogbm93IC0gc25hcHNob3QuZ2VuZXJhdGVkQXQsXG4gICAgICB9O1xuICAgIH1cbiAgICBcbiAgICAvLyDpmY3nuqfvvJrkvb/nlKjovbvph4/ogZrlkIhcbiAgICBjb25zdCBbY29udHJvbFNuYXBzaG90LCBodW1hbkxvb3BTbmFwc2hvdF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICB0aGlzLmNvbnRleHRBZGFwdGVyLmdldENvbnRyb2xTbmFwc2hvdChpbnB1dC53b3Jrc3BhY2VJZCksXG4gICAgICB0aGlzLmNvbnRleHRBZGFwdGVyLmdldEh1bWFuTG9vcFNuYXBzaG90KGlucHV0LndvcmtzcGFjZUlkKSxcbiAgICBdKTtcbiAgICBcbiAgICByZXR1cm4gdGhpcy52aWV3RmFjdG9yeS5idWlsZEluYm94Vmlldyh7XG4gICAgICBjb250cm9sU25hcHNob3QsXG4gICAgICBodW1hbkxvb3BTbmFwc2hvdCxcbiAgICAgIG1vZGU6IGlucHV0Lm1vZGUsXG4gICAgICBzdXJmYWNlOiBpbnB1dC5hY3Rvci5zdXJmYWNlLFxuICAgIH0pO1xuICB9XG4gIFxuICBhc3luYyBnZXRJbnRlcnZlbnRpb25WaWV3KGlucHV0OiBHZXRTdXJmYWNlVmlld0lucHV0KTogUHJvbWlzZTxPcGVyYXRvclZpZXdQYXlsb2FkPiB7XG4gICAgY29uc3QgaHVtYW5Mb29wU25hcHNob3QgPSBhd2FpdCB0aGlzLmNvbnRleHRBZGFwdGVyLmdldEh1bWFuTG9vcFNuYXBzaG90KGlucHV0LndvcmtzcGFjZUlkKTtcbiAgICBcbiAgICByZXR1cm4gdGhpcy52aWV3RmFjdG9yeS5idWlsZEludGVydmVudGlvblZpZXcoe1xuICAgICAgaHVtYW5Mb29wU25hcHNob3QsXG4gICAgICBtb2RlOiBpbnB1dC5tb2RlLFxuICAgICAgc3VyZmFjZTogaW5wdXQuYWN0b3Iuc3VyZmFjZSxcbiAgICB9KTtcbiAgfVxuICBcbiAgYXN5bmMgZ2V0SGlzdG9yeVZpZXcoaW5wdXQ6IEdldFN1cmZhY2VWaWV3SW5wdXQpOiBQcm9taXNlPE9wZXJhdG9yVmlld1BheWxvYWQ+IHtcbiAgICAvLyBUT0RPOiDlrp7njrDljoblj7LorrDlvZXop4blm75cbiAgICAvLyDnm67liY3ov5Tlm57kuIDkuKrljaDkvY3op4blm75cbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgdmlld0tpbmQ6ICdoaXN0b3J5JyxcbiAgICAgIHRpdGxlOiAn5Y6G5Y+y6K6w5b2VJyxcbiAgICAgIHN1YnRpdGxlOiAn5Yqf6IO95byA5Y+R5LitJyxcbiAgICAgIG1vZGU6IGlucHV0Lm1vZGUsXG4gICAgICBzdW1tYXJ5OiAn5Y6G5Y+y6K6w5b2V5Yqf6IO95bCG5Zyo5ZCO57ut54mI5pys5a6e546wJyxcbiAgICAgIGNvbnRlbnQ6IHtcbiAgICAgICAgbWVzc2FnZTogJ+WOhuWPsuiusOW9leWKn+iDveW8gOWPkeS4re+8jOaVrOivt+acn+W+hScsXG4gICAgICB9LFxuICAgICAgYXZhaWxhYmxlQWN0aW9uczogW1xuICAgICAgICB7XG4gICAgICAgICAgYWN0aW9uVHlwZTogJ2dvX2JhY2snLFxuICAgICAgICAgIGxhYmVsOiAn6L+U5ZueJyxcbiAgICAgICAgICBzdHlsZTogJ2RlZmF1bHQnLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIGJyZWFkY3J1bWJzOiBbJ0Rhc2hib2FyZCcsICdIaXN0b3J5J10sXG4gICAgICBnZW5lcmF0ZWRBdDogRGF0ZS5ub3coKSxcbiAgICAgIGZyZXNobmVzc01zOiAwLFxuICAgIH07XG4gIH1cbiAgXG4gIGFzeW5jIGdldEl0ZW1EZXRhaWxWaWV3KGlucHV0OiBHZXRTdXJmYWNlVmlld0lucHV0KTogUHJvbWlzZTxPcGVyYXRvclZpZXdQYXlsb2FkPiB7XG4gICAgLy8gVE9ETzog5qC55o2uIHRhcmdldElkIOiOt+WPluecn+WunuaVsOaNrlxuICAgIC8vIOebruWJjei/lOWbnuS4gOS4quWNoOS9jeivpuaDhVxuICAgIFxuICAgIGNvbnN0IGRhdGEgPSB7XG4gICAgICB0YXJnZXRUeXBlOiBpbnB1dC50YXJnZXRJZCA/ICd1bmtub3duJyA6ICd1bmtub3duJyxcbiAgICAgIHRhcmdldElkOiBpbnB1dC50YXJnZXRJZCB8fCAndW5rbm93bicsXG4gICAgICBtZXNzYWdlOiAn6K+m5oOF5Yqf6IO95byA5Y+R5LitJyxcbiAgICB9O1xuICAgIFxuICAgIHJldHVybiB0aGlzLnZpZXdGYWN0b3J5LmJ1aWxkRGV0YWlsVmlldyh7XG4gICAgICB0YXJnZXRUeXBlOiAndW5rbm93bicsXG4gICAgICB0YXJnZXRJZDogaW5wdXQudGFyZ2V0SWQgfHwgJ3Vua25vd24nLFxuICAgICAgZGF0YSxcbiAgICAgIG1vZGU6IGlucHV0Lm1vZGUsXG4gICAgICBzdXJmYWNlOiBpbnB1dC5hY3Rvci5zdXJmYWNlLFxuICAgIH0pO1xuICB9XG4gIFxuICBhc3luYyBnZXRWaWV3KGlucHV0OiBHZXRTdXJmYWNlVmlld0lucHV0KTogUHJvbWlzZTxPcGVyYXRvclZpZXdQYXlsb2FkPiB7XG4gICAgLy8g57uf5LiA5YWl5Y+jIC0g5oyJIHZpZXdLaW5kIOWIhuWPkVxuICAgIHN3aXRjaCAoaW5wdXQudmlld0tpbmQpIHtcbiAgICAgIGNhc2UgJ2Rhc2hib2FyZCc6XG4gICAgICAgIHJldHVybiB0aGlzLmdldERhc2hib2FyZFZpZXcoaW5wdXQpO1xuICAgICAgY2FzZSAndGFza3MnOlxuICAgICAgICByZXR1cm4gdGhpcy5nZXRUYXNrVmlldyhpbnB1dCk7XG4gICAgICBjYXNlICdhcHByb3ZhbHMnOlxuICAgICAgICByZXR1cm4gdGhpcy5nZXRBcHByb3ZhbFZpZXcoaW5wdXQpO1xuICAgICAgY2FzZSAnaW5jaWRlbnRzJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0SW5jaWRlbnRWaWV3KGlucHV0KTtcbiAgICAgIGNhc2UgJ2FnZW50cyc6XG4gICAgICAgIHJldHVybiB0aGlzLmdldEFnZW50VmlldyhpbnB1dCk7XG4gICAgICBjYXNlICdpbmJveCc6XG4gICAgICAgIHJldHVybiB0aGlzLmdldEluYm94VmlldyhpbnB1dCk7XG4gICAgICBjYXNlICdpbnRlcnZlbnRpb25zJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0SW50ZXJ2ZW50aW9uVmlldyhpbnB1dCk7XG4gICAgICBjYXNlICdoaXN0b3J5JzpcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0SGlzdG9yeVZpZXcoaW5wdXQpO1xuICAgICAgY2FzZSAnaXRlbV9kZXRhaWwnOlxuICAgICAgICByZXR1cm4gdGhpcy5nZXRJdGVtRGV0YWlsVmlldyhpbnB1dCk7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIHZpZXcga2luZDogJHtpbnB1dC52aWV3S2luZH1gKTtcbiAgICB9XG4gIH1cbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5bel5Y6C5Ye95pWwXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVPcGVyYXRvclN1cmZhY2VTZXJ2aWNlKFxuICBjb250ZXh0QWRhcHRlcjogT3BlcmF0b3JDb250ZXh0QWRhcHRlcixcbiAgdmlld0ZhY3Rvcnk6IE9wZXJhdG9yVmlld0ZhY3Rvcnlcbik6IE9wZXJhdG9yU3VyZmFjZVNlcnZpY2Uge1xuICByZXR1cm4gbmV3IERlZmF1bHRPcGVyYXRvclN1cmZhY2VTZXJ2aWNlKGNvbnRleHRBZGFwdGVyLCB2aWV3RmFjdG9yeSk7XG59XG4iXX0=