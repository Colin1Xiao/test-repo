"use strict";
/**
 * Control Surface - 统一控制面
 *
 * 职责：
 * 1. 统一聚合 task / approval / ops / agent 四类视图
 * 2. 输出单个 ControlSurfaceSnapshot
 * 3. 提供统一动作分发入口
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ControlSurfaceBuilder = void 0;
exports.createControlSurfaceBuilder = createControlSurfaceBuilder;
exports.buildControlSurfaceSnapshot = buildControlSurfaceSnapshot;
// ============================================================================
// 控制面构建器
// ============================================================================
class ControlSurfaceBuilder {
    constructor(taskViewBuilder, approvalViewBuilder, opsViewBuilder, agentViewBuilder, config = {}) {
        this.config = {
            autoRefreshIntervalMs: config.autoRefreshIntervalMs ?? 30000, // 30 秒
            maxTaskViewCount: config.maxTaskViewCount ?? 50,
            maxApprovalViewCount: config.maxApprovalViewCount ?? 50,
            defaultTimeWindowMs: config.defaultTimeWindowMs ?? 24 * 60 * 60 * 1000, // 24 小时
        };
        this.taskViewBuilder = taskViewBuilder;
        this.approvalViewBuilder = approvalViewBuilder;
        this.opsViewBuilder = opsViewBuilder;
        this.agentViewBuilder = agentViewBuilder;
    }
    /**
     * 构建控制面快照
     */
    async buildControlSurfaceSnapshot() {
        const now = Date.now();
        // 并行构建所有视图
        const [taskView, approvalView, opsView, agentView] = await Promise.all([
            this.taskViewBuilder.buildTaskView(),
            this.approvalViewBuilder.buildApprovalView(),
            this.opsViewBuilder.buildOpsView(),
            this.agentViewBuilder.buildAgentView(),
        ]);
        // 计算摘要
        const summary = this.calculateSummary(taskView, approvalView, opsView, agentView);
        // 获取可用动作
        const availableActions = this.getAvailableActions(taskView, approvalView, opsView, agentView);
        return {
            snapshotId: `snapshot_${now}`,
            createdAt: now,
            taskView,
            approvalView,
            opsView,
            agentView,
            availableActions,
            summary,
        };
    }
    /**
     * 分发控制动作
     */
    async dispatchControlAction(action) {
        switch (action.type) {
            // Task 动作
            case 'cancel_task':
                return await this.taskViewBuilder.cancelTask(action.targetId);
            case 'retry_task':
                return await this.taskViewBuilder.retryTask(action.targetId);
            case 'pause_task':
                return await this.taskViewBuilder.pauseTask(action.targetId);
            // Approval 动作
            case 'approve':
                return await this.approvalViewBuilder.approve(action.targetId);
            case 'reject':
                return await this.approvalViewBuilder.reject(action.targetId);
            case 'escalate_approval':
                return await this.approvalViewBuilder.escalate(action.targetId);
            // Ops 动作
            case 'ack_incident':
                return await this.opsViewBuilder.ackIncident(action.targetId);
            case 'request_replay':
                return await this.opsViewBuilder.requestReplay(action.targetId);
            case 'request_recovery':
                return await this.opsViewBuilder.requestRecovery(action.targetId);
            // Agent 动作
            case 'pause_agent':
                return await this.agentViewBuilder.pauseAgent(action.targetId);
            case 'resume_agent':
                return await this.agentViewBuilder.resumeAgent(action.targetId);
            case 'inspect_agent':
                return await this.agentViewBuilder.inspectAgent(action.targetId);
            default:
                return {
                    success: false,
                    actionType: action.type,
                    targetId: action.targetId,
                    error: `Unknown action type: ${action.type}`,
                };
        }
    }
    /**
     * 刷新控制面
     */
    async refreshSurface() {
        return await this.buildControlSurfaceSnapshot();
    }
    /**
     * 获取可用动作
     */
    getAvailableActions(taskView, approvalView, opsView, agentView) {
        const actions = [];
        const now = Date.now();
        // Task 相关动作
        for (const task of taskView.blockedTasks.slice(0, 3)) {
            actions.push({
                type: 'retry_task',
                targetType: 'task',
                targetId: task.taskId,
                requestedBy: 'system',
                requestedAt: now,
            });
        }
        for (const task of taskView.failedTasks.slice(0, 3)) {
            actions.push({
                type: 'retry_task',
                targetType: 'task',
                targetId: task.taskId,
                requestedBy: 'system',
                requestedAt: now,
            });
        }
        // Approval 相关动作
        for (const approval of approvalView.pendingApprovals.slice(0, 3)) {
            actions.push({
                type: 'approve',
                targetType: 'approval',
                targetId: approval.approvalId,
                requestedBy: 'system',
                requestedAt: now,
            });
            actions.push({
                type: 'reject',
                targetType: 'approval',
                targetId: approval.approvalId,
                requestedBy: 'system',
                requestedAt: now,
            });
        }
        // Ops 相关动作
        for (const incident of opsView.activeIncidents.slice(0, 3)) {
            if (!incident.acknowledged) {
                actions.push({
                    type: 'ack_incident',
                    targetType: 'incident',
                    targetId: incident.id,
                    requestedBy: 'system',
                    requestedAt: now,
                });
            }
        }
        // Agent 相关动作
        for (const agent of agentView.blockedAgents.slice(0, 2)) {
            actions.push({
                type: 'inspect_agent',
                targetType: 'agent',
                targetId: agent.agentId,
                requestedBy: 'system',
                requestedAt: now,
            });
        }
        return actions;
    }
    // ============================================================================
    // 内部方法
    // ============================================================================
    /**
     * 计算摘要
     */
    calculateSummary(taskView, approvalView, opsView, agentView) {
        // 计算需要关注的项数
        let attentionItems = 0;
        // 阻塞任务
        attentionItems += taskView.blockedTasks.length;
        // 失败任务
        attentionItems += taskView.failedTasks.length;
        // 待处理审批
        attentionItems += approvalView.pendingApprovals.length;
        // 超时审批
        attentionItems += approvalView.timeoutApprovals.length;
        // 降级 Server
        attentionItems += opsView.degradedServers.length;
        // 被阻塞 Skill
        attentionItems += opsView.blockedSkills.length;
        // 不健康 Agent
        attentionItems += agentView.unhealthyAgents.length;
        // 阻塞 Agent
        attentionItems += agentView.blockedAgents.length;
        return {
            totalTasks: taskView.totalTasks,
            pendingApprovals: approvalView.totalApprovals,
            healthScore: opsView.healthScore,
            activeAgents: agentView.totalAgents - agentView.offlineAgents.length,
            attentionItems,
        };
    }
}
exports.ControlSurfaceBuilder = ControlSurfaceBuilder;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建控制面构建器
 */
function createControlSurfaceBuilder(taskViewBuilder, approvalViewBuilder, opsViewBuilder, agentViewBuilder, config) {
    return new ControlSurfaceBuilder(taskViewBuilder, approvalViewBuilder, opsViewBuilder, agentViewBuilder, config);
}
/**
 * 快速构建控制面快照
 */
async function buildControlSurfaceSnapshot(taskViewBuilder, approvalViewBuilder, opsViewBuilder, agentViewBuilder) {
    const builder = new ControlSurfaceBuilder(taskViewBuilder, approvalViewBuilder, opsViewBuilder, agentViewBuilder);
    return await builder.buildControlSurfaceSnapshot();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udHJvbF9zdXJmYWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3V4L2NvbnRyb2xfc3VyZmFjZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7R0FVRzs7O0FBcVJILGtFQWNDO0FBS0Qsa0VBYUM7QUFwU0QsK0VBQStFO0FBQy9FLFNBQVM7QUFDVCwrRUFBK0U7QUFFL0UsTUFBYSxxQkFBcUI7SUFPaEMsWUFDRSxlQUFnQyxFQUNoQyxtQkFBd0MsRUFDeEMsY0FBOEIsRUFDOUIsZ0JBQWtDLEVBQ2xDLFNBQStCLEVBQUU7UUFFakMsSUFBSSxDQUFDLE1BQU0sR0FBRztZQUNaLHFCQUFxQixFQUFFLE1BQU0sQ0FBQyxxQkFBcUIsSUFBSSxLQUFLLEVBQUUsT0FBTztZQUNyRSxnQkFBZ0IsRUFBRSxNQUFNLENBQUMsZ0JBQWdCLElBQUksRUFBRTtZQUMvQyxvQkFBb0IsRUFBRSxNQUFNLENBQUMsb0JBQW9CLElBQUksRUFBRTtZQUN2RCxtQkFBbUIsRUFBRSxNQUFNLENBQUMsbUJBQW1CLElBQUksRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsSUFBSSxFQUFFLFFBQVE7U0FDakYsQ0FBQztRQUNGLElBQUksQ0FBQyxlQUFlLEdBQUcsZUFBZSxDQUFDO1FBQ3ZDLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxtQkFBbUIsQ0FBQztRQUMvQyxJQUFJLENBQUMsY0FBYyxHQUFHLGNBQWMsQ0FBQztRQUNyQyxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsZ0JBQWdCLENBQUM7SUFDM0MsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLDJCQUEyQjtRQUMvQixNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7UUFFdkIsV0FBVztRQUNYLE1BQU0sQ0FBQyxRQUFRLEVBQUUsWUFBWSxFQUFFLE9BQU8sRUFBRSxTQUFTLENBQUMsR0FBRyxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUM7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QStFO0FBQy9FLE9BQU87QUFDUCwrRUFBK0U7QUFFL0U7O0dBRUc7QUFDSCxTQUFnQiwyQkFBMkIsQ0FDekMsZUFBZ0MsRUFDaEMsbUJBQXdDLEVBQ3hDLGNBQThCLEVBQzlCLGdCQUFrQyxFQUNsQyxNQUE2QjtJQUU3QixPQUFPLElBQUkscUJBQXFCLENBQzlCLGVBQWUsRUFDZixtQkFBbUIsRUFDbkIsY0FBYyxFQUNkLGdCQUFnQixFQUNoQixNQUFNLENBQ1AsQ0FBQztBQUNKLENBQUM7QUFFRDs7R0FFRztBQUNJLEtBQUssVUFBVSwyQkFBMkIsQ0FDL0MsZUFBZ0MsRUFDaEMsbUJBQXdDLEVBQ3hDLGNBQThCLEVBQzlCLGdCQUFrQztJQUVsQyxNQUFNLE9BQU8sR0FBRyxJQUFJLHFCQUFxQixDQUN2QyxlQUFlLEVBQ2YsbUJBQW1CLEVBQ25CLGNBQWMsRUFDZCxnQkFBZ0IsQ0FDakIsQ0FBQztJQUNGLE9BQU8sTUFBTSxPQUFPLENBQUMsMkJBQTJCLEVBQUUsQ0FBQztBQUNyRCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDb250cm9sIFN1cmZhY2UgLSDnu5/kuIDmjqfliLbpnaJcbiAqIFxuICog6IGM6LSj77yaXG4gKiAxLiDnu5/kuIDogZrlkIggdGFzayAvIGFwcHJvdmFsIC8gb3BzIC8gYWdlbnQg5Zub57G76KeG5Zu+XG4gKiAyLiDovpPlh7rljZXkuKogQ29udHJvbFN1cmZhY2VTbmFwc2hvdFxuICogMy4g5o+Q5L6b57uf5LiA5Yqo5L2c5YiG5Y+R5YWl5Y+jXG4gKiBcbiAqIEB2ZXJzaW9uIHYwLjEuMFxuICogQGRhdGUgMjAyNi0wNC0wM1xuICovXG5cbmltcG9ydCB0eXBlIHtcbiAgQ29udHJvbFN1cmZhY2VTbmFwc2hvdCxcbiAgQ29udHJvbEFjdGlvbixcbiAgQ29udHJvbEFjdGlvblJlc3VsdCxcbiAgQ29udHJvbFN1cmZhY2VDb25maWcsXG4gIFRhc2tWaWV3LFxuICBBcHByb3ZhbFZpZXcsXG4gIE9wc1ZpZXdNb2RlbCxcbiAgQWdlbnRWaWV3LFxufSBmcm9tICcuL2NvbnRyb2xfdHlwZXMnO1xuaW1wb3J0IHsgVGFza1ZpZXdCdWlsZGVyIH0gZnJvbSAnLi90YXNrX3ZpZXcnO1xuaW1wb3J0IHsgQXBwcm92YWxWaWV3QnVpbGRlciB9IGZyb20gJy4vYXBwcm92YWxfdmlldyc7XG5pbXBvcnQgeyBPcHNWaWV3QnVpbGRlciB9IGZyb20gJy4vb3BzX3ZpZXcnO1xuaW1wb3J0IHsgQWdlbnRWaWV3QnVpbGRlciB9IGZyb20gJy4vYWdlbnRfdmlldyc7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOaOp+WItumdouaehOW7uuWZqFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgY2xhc3MgQ29udHJvbFN1cmZhY2VCdWlsZGVyIHtcbiAgcHJpdmF0ZSBjb25maWc6IFJlcXVpcmVkPENvbnRyb2xTdXJmYWNlQ29uZmlnPjtcbiAgcHJpdmF0ZSB0YXNrVmlld0J1aWxkZXI6IFRhc2tWaWV3QnVpbGRlcjtcbiAgcHJpdmF0ZSBhcHByb3ZhbFZpZXdCdWlsZGVyOiBBcHByb3ZhbFZpZXdCdWlsZGVyO1xuICBwcml2YXRlIG9wc1ZpZXdCdWlsZGVyOiBPcHNWaWV3QnVpbGRlcjtcbiAgcHJpdmF0ZSBhZ2VudFZpZXdCdWlsZGVyOiBBZ2VudFZpZXdCdWlsZGVyO1xuICBcbiAgY29uc3RydWN0b3IoXG4gICAgdGFza1ZpZXdCdWlsZGVyOiBUYXNrVmlld0J1aWxkZXIsXG4gICAgYXBwcm92YWxWaWV3QnVpbGRlcjogQXBwcm92YWxWaWV3QnVpbGRlcixcbiAgICBvcHNWaWV3QnVpbGRlcjogT3BzVmlld0J1aWxkZXIsXG4gICAgYWdlbnRWaWV3QnVpbGRlcjogQWdlbnRWaWV3QnVpbGRlcixcbiAgICBjb25maWc6IENvbnRyb2xTdXJmYWNlQ29uZmlnID0ge31cbiAgKSB7XG4gICAgdGhpcy5jb25maWcgPSB7XG4gICAgICBhdXRvUmVmcmVzaEludGVydmFsTXM6IGNvbmZpZy5hdXRvUmVmcmVzaEludGVydmFsTXMgPz8gMzAwMDAsIC8vIDMwIOenklxuICAgICAgbWF4VGFza1ZpZXdDb3VudDogY29uZmlnLm1heFRhc2tWaWV3Q291bnQgPz8gNTAsXG4gICAgICBtYXhBcHByb3ZhbFZpZXdDb3VudDogY29uZmlnLm1heEFwcHJvdmFsVmlld0NvdW50ID8/IDUwLFxuICAgICAgZGVmYXVsdFRpbWVXaW5kb3dNczogY29uZmlnLmRlZmF1bHRUaW1lV2luZG93TXMgPz8gMjQgKiA2MCAqIDYwICogMTAwMCwgLy8gMjQg5bCP5pe2XG4gICAgfTtcbiAgICB0aGlzLnRhc2tWaWV3QnVpbGRlciA9IHRhc2tWaWV3QnVpbGRlcjtcbiAgICB0aGlzLmFwcHJvdmFsVmlld0J1aWxkZXIgPSBhcHByb3ZhbFZpZXdCdWlsZGVyO1xuICAgIHRoaXMub3BzVmlld0J1aWxkZXIgPSBvcHNWaWV3QnVpbGRlcjtcbiAgICB0aGlzLmFnZW50Vmlld0J1aWxkZXIgPSBhZ2VudFZpZXdCdWlsZGVyO1xuICB9XG4gIFxuICAvKipcbiAgICog5p6E5bu65o6n5Yi26Z2i5b+r54WnXG4gICAqL1xuICBhc3luYyBidWlsZENvbnRyb2xTdXJmYWNlU25hcHNob3QoKTogUHJvbWlzZTxDb250cm9sU3VyZmFjZVNuYXBzaG90PiB7XG4gICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbiAgICBcbiAgICAvLyDlubbooYzmnoTlu7rmiYDmnInop4blm75cbiAgICBjb25zdCBbdGFza1ZpZXcsIGFwcHJvdmFsVmlldywgb3BzVmlldywgYWdlbnRWaWV3XSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgIHRoaXMudGFza1ZpZXdCdWlsZGVyLmJ1aWxkVGFza1ZpZXcoKSxcbiAgICAgIHRoaXMuYXBwcm92YWxWaWV3QnVpbGRlci5idWlsZEFwcHJvdmFsVmlldygpLFxuICAgICAgdGhpcy5vcHNWaWV3QnVpbGRlci5idWlsZE9wc1ZpZXcoKSxcbiAgICAgIHRoaXMuYWdlbnRWaWV3QnVpbGRlci5idWlsZEFnZW50VmlldygpLFxuICAgIF0pO1xuICAgIFxuICAgIC8vIOiuoeeul+aRmOimgVxuICAgIGNvbnN0IHN1bW1hcnkgPSB0aGlzLmNhbGN1bGF0ZVN1bW1hcnkodGFza1ZpZXcsIGFwcHJvdmFsVmlldywgb3BzVmlldywgYWdlbnRWaWV3KTtcbiAgICBcbiAgICAvLyDojrflj5blj6/nlKjliqjkvZxcbiAgICBjb25zdCBhdmFpbGFibGVBY3Rpb25zID0gdGhpcy5nZXRBdmFpbGFibGVBY3Rpb25zKHRhc2tWaWV3LCBhcHByb3ZhbFZpZXcsIG9wc1ZpZXcsIGFnZW50Vmlldyk7XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIHNuYXBzaG90SWQ6IGBzbmFwc2hvdF8ke25vd31gLFxuICAgICAgY3JlYXRlZEF0OiBub3csXG4gICAgICB0YXNrVmlldyxcbiAgICAgIGFwcHJvdmFsVmlldyxcbiAgICAgIG9wc1ZpZXcsXG4gICAgICBhZ2VudFZpZXcsXG4gICAgICBhdmFpbGFibGVBY3Rpb25zLFxuICAgICAgc3VtbWFyeSxcbiAgICB9O1xuICB9XG4gIFxuICAvKipcbiAgICog5YiG5Y+R5o6n5Yi25Yqo5L2cXG4gICAqL1xuICBhc3luYyBkaXNwYXRjaENvbnRyb2xBY3Rpb24oYWN0aW9uOiBDb250cm9sQWN0aW9uKTogUHJvbWlzZTxDb250cm9sQWN0aW9uUmVzdWx0PiB7XG4gICAgc3dpdGNoIChhY3Rpb24udHlwZSkge1xuICAgICAgLy8gVGFzayDliqjkvZxcbiAgICAgIGNhc2UgJ2NhbmNlbF90YXNrJzpcbiAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMudGFza1ZpZXdCdWlsZGVyLmNhbmNlbFRhc2soYWN0aW9uLnRhcmdldElkKTtcbiAgICAgIFxuICAgICAgY2FzZSAncmV0cnlfdGFzayc6XG4gICAgICAgIHJldHVybiBhd2FpdCB0aGlzLnRhc2tWaWV3QnVpbGRlci5yZXRyeVRhc2soYWN0aW9uLnRhcmdldElkKTtcbiAgICAgIFxuICAgICAgY2FzZSAncGF1c2VfdGFzayc6XG4gICAgICAgIHJldHVybiBhd2FpdCB0aGlzLnRhc2tWaWV3QnVpbGRlci5wYXVzZVRhc2soYWN0aW9uLnRhcmdldElkKTtcbiAgICAgIFxuICAgICAgLy8gQXBwcm92YWwg5Yqo5L2cXG4gICAgICBjYXNlICdhcHByb3ZlJzpcbiAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuYXBwcm92YWxWaWV3QnVpbGRlci5hcHByb3ZlKGFjdGlvbi50YXJnZXRJZCk7XG4gICAgICBcbiAgICAgIGNhc2UgJ3JlamVjdCc6XG4gICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmFwcHJvdmFsVmlld0J1aWxkZXIucmVqZWN0KGFjdGlvbi50YXJnZXRJZCk7XG4gICAgICBcbiAgICAgIGNhc2UgJ2VzY2FsYXRlX2FwcHJvdmFsJzpcbiAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuYXBwcm92YWxWaWV3QnVpbGRlci5lc2NhbGF0ZShhY3Rpb24udGFyZ2V0SWQpO1xuICAgICAgXG4gICAgICAvLyBPcHMg5Yqo5L2cXG4gICAgICBjYXNlICdhY2tfaW5jaWRlbnQnOlxuICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5vcHNWaWV3QnVpbGRlci5hY2tJbmNpZGVudChhY3Rpb24udGFyZ2V0SWQpO1xuICAgICAgXG4gICAgICBjYXNlICdyZXF1ZXN0X3JlcGxheSc6XG4gICAgICAgIHJldHVybiBhd2FpdCB0aGlzLm9wc1ZpZXdCdWlsZGVyLnJlcXVlc3RSZXBsYXkoYWN0aW9uLnRhcmdldElkKTtcbiAgICAgIFxuICAgICAgY2FzZSAncmVxdWVzdF9yZWNvdmVyeSc6XG4gICAgICAgIHJldHVybiBhd2FpdCB0aGlzLm9wc1ZpZXdCdWlsZGVyLnJlcXVlc3RSZWNvdmVyeShhY3Rpb24udGFyZ2V0SWQpO1xuICAgICAgXG4gICAgICAvLyBBZ2VudCDliqjkvZxcbiAgICAgIGNhc2UgJ3BhdXNlX2FnZW50JzpcbiAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuYWdlbnRWaWV3QnVpbGRlci5wYXVzZUFnZW50KGFjdGlvbi50YXJnZXRJZCk7XG4gICAgICBcbiAgICAgIGNhc2UgJ3Jlc3VtZV9hZ2VudCc6XG4gICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmFnZW50Vmlld0J1aWxkZXIucmVzdW1lQWdlbnQoYWN0aW9uLnRhcmdldElkKTtcbiAgICAgIFxuICAgICAgY2FzZSAnaW5zcGVjdF9hZ2VudCc6XG4gICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmFnZW50Vmlld0J1aWxkZXIuaW5zcGVjdEFnZW50KGFjdGlvbi50YXJnZXRJZCk7XG4gICAgICBcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgYWN0aW9uVHlwZTogYWN0aW9uLnR5cGUsXG4gICAgICAgICAgdGFyZ2V0SWQ6IGFjdGlvbi50YXJnZXRJZCxcbiAgICAgICAgICBlcnJvcjogYFVua25vd24gYWN0aW9uIHR5cGU6ICR7YWN0aW9uLnR5cGV9YCxcbiAgICAgICAgfTtcbiAgICB9XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDliLfmlrDmjqfliLbpnaJcbiAgICovXG4gIGFzeW5jIHJlZnJlc2hTdXJmYWNlKCk6IFByb21pc2U8Q29udHJvbFN1cmZhY2VTbmFwc2hvdD4ge1xuICAgIHJldHVybiBhd2FpdCB0aGlzLmJ1aWxkQ29udHJvbFN1cmZhY2VTbmFwc2hvdCgpO1xuICB9XG4gIFxuICAvKipcbiAgICog6I635Y+W5Y+v55So5Yqo5L2cXG4gICAqL1xuICBnZXRBdmFpbGFibGVBY3Rpb25zKFxuICAgIHRhc2tWaWV3OiBUYXNrVmlldyxcbiAgICBhcHByb3ZhbFZpZXc6IEFwcHJvdmFsVmlldyxcbiAgICBvcHNWaWV3OiBPcHNWaWV3TW9kZWwsXG4gICAgYWdlbnRWaWV3OiBBZ2VudFZpZXdcbiAgKTogQ29udHJvbEFjdGlvbltdIHtcbiAgICBjb25zdCBhY3Rpb25zOiBDb250cm9sQWN0aW9uW10gPSBbXTtcbiAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuICAgIFxuICAgIC8vIFRhc2sg55u45YWz5Yqo5L2cXG4gICAgZm9yIChjb25zdCB0YXNrIG9mIHRhc2tWaWV3LmJsb2NrZWRUYXNrcy5zbGljZSgwLCAzKSkge1xuICAgICAgYWN0aW9ucy5wdXNoKHtcbiAgICAgICAgdHlwZTogJ3JldHJ5X3Rhc2snLFxuICAgICAgICB0YXJnZXRUeXBlOiAndGFzaycsXG4gICAgICAgIHRhcmdldElkOiB0YXNrLnRhc2tJZCxcbiAgICAgICAgcmVxdWVzdGVkQnk6ICdzeXN0ZW0nLFxuICAgICAgICByZXF1ZXN0ZWRBdDogbm93LFxuICAgICAgfSk7XG4gICAgfVxuICAgIFxuICAgIGZvciAoY29uc3QgdGFzayBvZiB0YXNrVmlldy5mYWlsZWRUYXNrcy5zbGljZSgwLCAzKSkge1xuICAgICAgYWN0aW9ucy5wdXNoKHtcbiAgICAgICAgdHlwZTogJ3JldHJ5X3Rhc2snLFxuICAgICAgICB0YXJnZXRUeXBlOiAndGFzaycsXG4gICAgICAgIHRhcmdldElkOiB0YXNrLnRhc2tJZCxcbiAgICAgICAgcmVxdWVzdGVkQnk6ICdzeXN0ZW0nLFxuICAgICAgICByZXF1ZXN0ZWRBdDogbm93LFxuICAgICAgfSk7XG4gICAgfVxuICAgIFxuICAgIC8vIEFwcHJvdmFsIOebuOWFs+WKqOS9nFxuICAgIGZvciAoY29uc3QgYXBwcm92YWwgb2YgYXBwcm92YWxWaWV3LnBlbmRpbmdBcHByb3ZhbHMuc2xpY2UoMCwgMykpIHtcbiAgICAgIGFjdGlvbnMucHVzaCh7XG4gICAgICAgIHR5cGU6ICdhcHByb3ZlJyxcbiAgICAgICAgdGFyZ2V0VHlwZTogJ2FwcHJvdmFsJyxcbiAgICAgICAgdGFyZ2V0SWQ6IGFwcHJvdmFsLmFwcHJvdmFsSWQsXG4gICAgICAgIHJlcXVlc3RlZEJ5OiAnc3lzdGVtJyxcbiAgICAgICAgcmVxdWVzdGVkQXQ6IG5vdyxcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBhY3Rpb25zLnB1c2goe1xuICAgICAgICB0eXBlOiAncmVqZWN0JyxcbiAgICAgICAgdGFyZ2V0VHlwZTogJ2FwcHJvdmFsJyxcbiAgICAgICAgdGFyZ2V0SWQ6IGFwcHJvdmFsLmFwcHJvdmFsSWQsXG4gICAgICAgIHJlcXVlc3RlZEJ5OiAnc3lzdGVtJyxcbiAgICAgICAgcmVxdWVzdGVkQXQ6IG5vdyxcbiAgICAgIH0pO1xuICAgIH1cbiAgICBcbiAgICAvLyBPcHMg55u45YWz5Yqo5L2cXG4gICAgZm9yIChjb25zdCBpbmNpZGVudCBvZiBvcHNWaWV3LmFjdGl2ZUluY2lkZW50cy5zbGljZSgwLCAzKSkge1xuICAgICAgaWYgKCFpbmNpZGVudC5hY2tub3dsZWRnZWQpIHtcbiAgICAgICAgYWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICB0eXBlOiAnYWNrX2luY2lkZW50JyxcbiAgICAgICAgICB0YXJnZXRUeXBlOiAnaW5jaWRlbnQnLFxuICAgICAgICAgIHRhcmdldElkOiBpbmNpZGVudC5pZCxcbiAgICAgICAgICByZXF1ZXN0ZWRCeTogJ3N5c3RlbScsXG4gICAgICAgICAgcmVxdWVzdGVkQXQ6IG5vdyxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIEFnZW50IOebuOWFs+WKqOS9nFxuICAgIGZvciAoY29uc3QgYWdlbnQgb2YgYWdlbnRWaWV3LmJsb2NrZWRBZ2VudHMuc2xpY2UoMCwgMikpIHtcbiAgICAgIGFjdGlvbnMucHVzaCh7XG4gICAgICAgIHR5cGU6ICdpbnNwZWN0X2FnZW50JyxcbiAgICAgICAgdGFyZ2V0VHlwZTogJ2FnZW50JyxcbiAgICAgICAgdGFyZ2V0SWQ6IGFnZW50LmFnZW50SWQsXG4gICAgICAgIHJlcXVlc3RlZEJ5OiAnc3lzdGVtJyxcbiAgICAgICAgcmVxdWVzdGVkQXQ6IG5vdyxcbiAgICAgIH0pO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gYWN0aW9ucztcbiAgfVxuICBcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAvLyDlhoXpg6jmlrnms5VcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICBcbiAgLyoqXG4gICAqIOiuoeeul+aRmOimgVxuICAgKi9cbiAgcHJpdmF0ZSBjYWxjdWxhdGVTdW1tYXJ5KFxuICAgIHRhc2tWaWV3OiBUYXNrVmlldyxcbiAgICBhcHByb3ZhbFZpZXc6IEFwcHJvdmFsVmlldyxcbiAgICBvcHNWaWV3OiBPcHNWaWV3TW9kZWwsXG4gICAgYWdlbnRWaWV3OiBBZ2VudFZpZXdcbiAgKTogQ29udHJvbFN1cmZhY2VTbmFwc2hvdFsnc3VtbWFyeSddIHtcbiAgICAvLyDorqHnrpfpnIDopoHlhbPms6jnmoTpobnmlbBcbiAgICBsZXQgYXR0ZW50aW9uSXRlbXMgPSAwO1xuICAgIFxuICAgIC8vIOmYu+WhnuS7u+WKoVxuICAgIGF0dGVudGlvbkl0ZW1zICs9IHRhc2tWaWV3LmJsb2NrZWRUYXNrcy5sZW5ndGg7XG4gICAgXG4gICAgLy8g5aSx6LSl5Lu75YqhXG4gICAgYXR0ZW50aW9uSXRlbXMgKz0gdGFza1ZpZXcuZmFpbGVkVGFza3MubGVuZ3RoO1xuICAgIFxuICAgIC8vIOW+heWkhOeQhuWuoeaJuVxuICAgIGF0dGVudGlvbkl0ZW1zICs9IGFwcHJvdmFsVmlldy5wZW5kaW5nQXBwcm92YWxzLmxlbmd0aDtcbiAgICBcbiAgICAvLyDotoXml7blrqHmiblcbiAgICBhdHRlbnRpb25JdGVtcyArPSBhcHByb3ZhbFZpZXcudGltZW91dEFwcHJvdmFscy5sZW5ndGg7XG4gICAgXG4gICAgLy8g6ZmN57qnIFNlcnZlclxuICAgIGF0dGVudGlvbkl0ZW1zICs9IG9wc1ZpZXcuZGVncmFkZWRTZXJ2ZXJzLmxlbmd0aDtcbiAgICBcbiAgICAvLyDooqvpmLvloZ4gU2tpbGxcbiAgICBhdHRlbnRpb25JdGVtcyArPSBvcHNWaWV3LmJsb2NrZWRTa2lsbHMubGVuZ3RoO1xuICAgIFxuICAgIC8vIOS4jeWBpeW6tyBBZ2VudFxuICAgIGF0dGVudGlvbkl0ZW1zICs9IGFnZW50Vmlldy51bmhlYWx0aHlBZ2VudHMubGVuZ3RoO1xuICAgIFxuICAgIC8vIOmYu+WhniBBZ2VudFxuICAgIGF0dGVudGlvbkl0ZW1zICs9IGFnZW50Vmlldy5ibG9ja2VkQWdlbnRzLmxlbmd0aDtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgdG90YWxUYXNrczogdGFza1ZpZXcudG90YWxUYXNrcyxcbiAgICAgIHBlbmRpbmdBcHByb3ZhbHM6IGFwcHJvdmFsVmlldy50b3RhbEFwcHJvdmFscyxcbiAgICAgIGhlYWx0aFNjb3JlOiBvcHNWaWV3LmhlYWx0aFNjb3JlLFxuICAgICAgYWN0aXZlQWdlbnRzOiBhZ2VudFZpZXcudG90YWxBZ2VudHMgLSBhZ2VudFZpZXcub2ZmbGluZUFnZW50cy5sZW5ndGgsXG4gICAgICBhdHRlbnRpb25JdGVtcyxcbiAgICB9O1xuICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOS+v+aNt+WHveaVsFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIOWIm+W7uuaOp+WItumdouaehOW7uuWZqFxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ29udHJvbFN1cmZhY2VCdWlsZGVyKFxuICB0YXNrVmlld0J1aWxkZXI6IFRhc2tWaWV3QnVpbGRlcixcbiAgYXBwcm92YWxWaWV3QnVpbGRlcjogQXBwcm92YWxWaWV3QnVpbGRlcixcbiAgb3BzVmlld0J1aWxkZXI6IE9wc1ZpZXdCdWlsZGVyLFxuICBhZ2VudFZpZXdCdWlsZGVyOiBBZ2VudFZpZXdCdWlsZGVyLFxuICBjb25maWc/OiBDb250cm9sU3VyZmFjZUNvbmZpZ1xuKTogQ29udHJvbFN1cmZhY2VCdWlsZGVyIHtcbiAgcmV0dXJuIG5ldyBDb250cm9sU3VyZmFjZUJ1aWxkZXIoXG4gICAgdGFza1ZpZXdCdWlsZGVyLFxuICAgIGFwcHJvdmFsVmlld0J1aWxkZXIsXG4gICAgb3BzVmlld0J1aWxkZXIsXG4gICAgYWdlbnRWaWV3QnVpbGRlcixcbiAgICBjb25maWdcbiAgKTtcbn1cblxuLyoqXG4gKiDlv6vpgJ/mnoTlu7rmjqfliLbpnaLlv6vnhadcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGJ1aWxkQ29udHJvbFN1cmZhY2VTbmFwc2hvdChcbiAgdGFza1ZpZXdCdWlsZGVyOiBUYXNrVmlld0J1aWxkZXIsXG4gIGFwcHJvdmFsVmlld0J1aWxkZXI6IEFwcHJvdmFsVmlld0J1aWxkZXIsXG4gIG9wc1ZpZXdCdWlsZGVyOiBPcHNWaWV3QnVpbGRlcixcbiAgYWdlbnRWaWV3QnVpbGRlcjogQWdlbnRWaWV3QnVpbGRlclxuKTogUHJvbWlzZTxDb250cm9sU3VyZmFjZVNuYXBzaG90PiB7XG4gIGNvbnN0IGJ1aWxkZXIgPSBuZXcgQ29udHJvbFN1cmZhY2VCdWlsZGVyKFxuICAgIHRhc2tWaWV3QnVpbGRlcixcbiAgICBhcHByb3ZhbFZpZXdCdWlsZGVyLFxuICAgIG9wc1ZpZXdCdWlsZGVyLFxuICAgIGFnZW50Vmlld0J1aWxkZXJcbiAgKTtcbiAgcmV0dXJuIGF3YWl0IGJ1aWxkZXIuYnVpbGRDb250cm9sU3VyZmFjZVNuYXBzaG90KCk7XG59XG4iXX0=