"use strict";
/**
 * Operator Command Dispatch V2
 * Phase 2A-2A-I - 集成 Session/Workspace
 *
 * 职责：
 * - 继承 DefaultOperatorCommandDispatch
 * - 集成 SessionStore 更新 navigation state
 * - 集成 WorkspaceSwitcher 处理 switch_workspace
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperatorCommandDispatchV2 = void 0;
exports.createOperatorCommandDispatchV2 = createOperatorCommandDispatchV2;
// ============================================================================
// V2 实现
// ============================================================================
class OperatorCommandDispatchV2 {
    constructor(surfaceService, executionBridge, sessionStore, workspaceSwitcher, config = {}) {
        this.surfaceService = surfaceService;
        this.executionBridge = executionBridge;
        this.sessionStore = sessionStore;
        this.workspaceSwitcher = workspaceSwitcher;
        this.config = {
            autoUpdateNavigation: config.autoUpdateNavigation ?? true,
        };
    }
    async dispatch(command, context) {
        try {
            // 按命令类型分发
            switch (command.commandType) {
                // View 类
                case 'view_dashboard':
                    return this.handleView('dashboard', command, context);
                case 'view_tasks':
                    return this.handleView('tasks', command, context);
                case 'view_approvals':
                    return this.handleView('approvals', command, context);
                case 'view_incidents':
                    return this.handleView('incidents', command, context);
                case 'view_agents':
                    return this.handleView('agents', command, context);
                case 'view_inbox':
                    return this.handleView('inbox', command, context);
                case 'view_interventions':
                    return this.handleView('interventions', command, context);
                case 'view_history':
                    return this.handleView('history', command, context);
                case 'open_item':
                    return this.handleOpenItem(command, context);
                case 'refresh':
                    return this.handleRefresh(command, context);
                // Control 类
                case 'approve':
                    return this.handleApprove(command, context);
                case 'reject':
                    return this.handleReject(command, context);
                case 'ack_incident':
                    return this.handleAckIncident(command, context);
                case 'retry_task':
                    return this.handleRetryTask(command, context);
                case 'pause_agent':
                    return this.handlePauseAgent(command, context);
                // Navigation 类
                case 'switch_workspace':
                    return this.handleSwitchWorkspace(command, context);
                case 'go_back':
                    return this.handleGoBack(command, context);
                default:
                    return this.buildUnsupportedResult(command);
            }
        }
        catch (error) {
            return this.buildErrorResult(command, error);
        }
    }
    // ============================================================================
    // View Handler
    // ============================================================================
    async handleView(viewKind, command, context) {
        const updatedView = await this.surfaceService.getView({
            actor: command.actor,
            viewKind: viewKind,
            workspaceId: command.actor.workspaceId,
            mode: context?.navigation?.mode,
        });
        return {
            success: true,
            message: `View ${viewKind} loaded`,
            updatedView,
            navigationState: context?.navigation ? {
                ...context.navigation,
                currentView: viewKind,
                lastCommandAt: Date.now(),
            } : {
                currentView: viewKind,
                lastCommandAt: Date.now(),
            },
            respondedAt: Date.now(),
        };
    }
    async handleOpenItem(command, context) {
        const updatedView = await this.surfaceService.getItemDetailView({
            actor: command.actor,
            viewKind: 'item_detail',
            workspaceId: command.actor.workspaceId,
            targetId: command.targetId,
        });
        return {
            success: true,
            message: `Item ${command.targetId} opened`,
            updatedView,
            navigationState: context?.navigation ? {
                ...context.navigation,
                currentView: 'item_detail',
                selectedItemId: command.targetId,
                selectedTargetType: command.targetType,
                lastCommandAt: Date.now(),
            } : {
                currentView: 'item_detail',
                selectedItemId: command.targetId,
                selectedTargetType: command.targetType,
                lastCommandAt: Date.now(),
            },
            respondedAt: Date.now(),
        };
    }
    async handleRefresh(command, context) {
        const currentView = context?.navigation?.currentView || 'dashboard';
        const updatedView = await this.surfaceService.getView({
            actor: command.actor,
            viewKind: currentView,
            workspaceId: command.actor.workspaceId,
            mode: context?.navigation?.mode,
        });
        return {
            success: true,
            message: 'View refreshed',
            updatedView,
            respondedAt: Date.now(),
        };
    }
    // ============================================================================
    // Control Handler
    // ============================================================================
    async handleApprove(command, context) {
        if (!command.targetId) {
            return this.buildErrorResult(command, new Error('Missing targetId'));
        }
        const execResult = await this.executionBridge.approveApproval(command.targetId, command.actor.actorId);
        const actionResult = {
            success: execResult.success,
            actionType: 'approve',
            targetType: 'approval',
            targetId: command.targetId,
            message: execResult.message,
            executedAt: execResult.executedAt,
        };
        const updatedView = await this.surfaceService.getApprovalView({
            actor: command.actor,
            viewKind: 'approvals',
            workspaceId: command.actor.workspaceId,
        });
        return {
            success: execResult.success,
            message: execResult.message,
            actionResult,
            updatedView,
            respondedAt: Date.now(),
        };
    }
    async handleReject(command, context) {
        if (!command.targetId) {
            return this.buildErrorResult(command, new Error('Missing targetId'));
        }
        const execResult = await this.executionBridge.rejectApproval(command.targetId, command.actor.actorId);
        const actionResult = {
            success: execResult.success,
            actionType: 'reject',
            targetType: 'approval',
            targetId: command.targetId,
            message: execResult.message,
            executedAt: execResult.executedAt,
        };
        const updatedView = await this.surfaceService.getApprovalView({
            actor: command.actor,
            viewKind: 'approvals',
            workspaceId: command.actor.workspaceId,
        });
        return {
            success: execResult.success,
            message: execResult.message,
            actionResult,
            updatedView,
            respondedAt: Date.now(),
        };
    }
    async handleAckIncident(command, context) {
        if (!command.targetId) {
            return this.buildErrorResult(command, new Error('Missing targetId'));
        }
        const execResult = await this.executionBridge.ackIncident(command.targetId, command.actor.actorId);
        const actionResult = {
            success: execResult.success,
            actionType: 'ack_incident',
            targetType: 'incident',
            targetId: command.targetId,
            message: execResult.message,
            executedAt: execResult.executedAt,
        };
        const updatedView = await this.surfaceService.getIncidentView({
            actor: command.actor,
            viewKind: 'incidents',
            workspaceId: command.actor.workspaceId,
        });
        return {
            success: execResult.success,
            message: execResult.message,
            actionResult,
            updatedView,
            respondedAt: Date.now(),
        };
    }
    async handleRetryTask(command, context) {
        if (!command.targetId) {
            return this.buildErrorResult(command, new Error('Missing targetId'));
        }
        const execResult = await this.executionBridge.retryTask(command.targetId, command.actor.actorId);
        const actionResult = {
            success: execResult.success,
            actionType: 'retry_task',
            targetType: 'task',
            targetId: command.targetId,
            message: execResult.message,
            executedAt: execResult.executedAt,
        };
        const updatedView = await this.surfaceService.getTaskView({
            actor: command.actor,
            viewKind: 'tasks',
            workspaceId: command.actor.workspaceId,
        });
        return {
            success: execResult.success,
            message: execResult.message,
            actionResult,
            updatedView,
            respondedAt: Date.now(),
        };
    }
    async handlePauseAgent(command, context) {
        if (!command.targetId) {
            return this.buildErrorResult(command, new Error('Missing targetId'));
        }
        const execResult = await this.executionBridge.pauseAgent(command.targetId, command.actor.actorId);
        const actionResult = {
            success: execResult.success,
            actionType: 'pause_agent',
            targetType: 'agent',
            targetId: command.targetId,
            message: execResult.message,
            executedAt: execResult.executedAt,
        };
        const updatedView = await this.surfaceService.getDashboardView({
            actor: command.actor,
            viewKind: 'dashboard',
            workspaceId: command.actor.workspaceId,
        });
        return {
            success: execResult.success,
            message: execResult.message,
            actionResult,
            updatedView,
            respondedAt: Date.now(),
        };
    }
    // ============================================================================
    // Navigation Handler
    // ============================================================================
    async handleSwitchWorkspace(command, context) {
        if (!command.targetId) {
            return this.buildErrorResult(command, new Error('Missing workspaceId'));
        }
        if (!context?.actor?.sessionId) {
            return this.buildErrorResult(command, new Error('Session required for workspace switch'));
        }
        // 使用 WorkspaceSwitcher 切换
        const switchResult = await this.workspaceSwitcher.switchWorkspace(context.actor.sessionId, command.targetId);
        // 获取新 workspace 的 dashboard
        const updatedView = await this.surfaceService.getDashboardView({
            actor: {
                ...command.actor,
                workspaceId: switchResult.currentWorkspaceId,
            },
            viewKind: 'dashboard',
            workspaceId: switchResult.currentWorkspaceId,
        });
        return {
            success: true,
            message: `Switched to workspace ${command.targetId}`,
            updatedView,
            navigationState: {
                workspaceId: switchResult.currentWorkspaceId,
                currentView: 'dashboard',
                lastCommandAt: Date.now(),
            },
            respondedAt: Date.now(),
        };
    }
    async handleGoBack(command, context) {
        const previousView = context?.navigation?.previousView || 'dashboard';
        const updatedView = await this.surfaceService.getView({
            actor: command.actor,
            viewKind: previousView,
            workspaceId: command.actor.workspaceId,
        });
        return {
            success: true,
            message: 'Navigated back',
            updatedView,
            navigationState: context?.navigation ? {
                ...context.navigation,
                currentView: previousView,
                previousView: context.navigation.currentView,
                lastCommandAt: Date.now(),
            } : undefined,
            respondedAt: Date.now(),
        };
    }
    // ============================================================================
    // 辅助方法
    // ============================================================================
    buildUnsupportedResult(command) {
        return {
            success: false,
            message: `Unsupported command type: ${command.commandType}`,
            errors: [{
                    code: 'UNSUPPORTED_COMMAND',
                    message: `Command ${command.commandType} is not implemented`,
                }],
            respondedAt: Date.now(),
        };
    }
    buildErrorResult(command, error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            success: false,
            message: `Command failed: ${errorMessage}`,
            errors: [{
                    code: 'COMMAND_ERROR',
                    message: errorMessage,
                    details: {
                        commandType: command.commandType,
                        targetId: command.targetId,
                    },
                }],
            respondedAt: Date.now(),
        };
    }
}
exports.OperatorCommandDispatchV2 = OperatorCommandDispatchV2;
// ============================================================================
// 工厂函数
// ============================================================================
function createOperatorCommandDispatchV2(surfaceService, executionBridge, sessionStore, workspaceSwitcher, config) {
    return new OperatorCommandDispatchV2(surfaceService, executionBridge, sessionStore, workspaceSwitcher, config);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3BlcmF0b3JfY29tbWFuZF9kaXNwYXRjaF92Mi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9vcGVyYXRvci9zZXJ2aWNlcy9vcGVyYXRvcl9jb21tYW5kX2Rpc3BhdGNoX3YyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7R0FRRzs7O0FBdWVILDBFQWNDO0FBL2RELCtFQUErRTtBQUMvRSxRQUFRO0FBQ1IsK0VBQStFO0FBRS9FLE1BQWEseUJBQXlCO0lBT3BDLFlBQ0UsY0FBc0MsRUFDdEMsZUFBd0MsRUFDeEMsWUFBMEIsRUFDMUIsaUJBQW9DLEVBQ3BDLFNBQTBDLEVBQUU7UUFFNUMsSUFBSSxDQUFDLGNBQWMsR0FBRyxjQUFjLENBQUM7UUFDckMsSUFBSSxDQUFDLGVBQWUsR0FBRyxlQUFlLENBQUM7UUFDdkMsSUFBSSxDQUFDLFlBQVksR0FBRyxZQUFZLENBQUM7UUFDakMsSUFBSSxDQUFDLGlCQUFpQixHQUFHLGlCQUFpQixDQUFDO1FBQzNDLElBQUksQ0FBQyxNQUFNLEdBQUc7WUFDWixvQkFBb0IsRUFBRSxNQUFNLENBQUMsb0JBQW9CLElBQUksSUFBSTtTQUMxRCxDQUFDO0lBQ0osQ0FBQztJQUVELEtBQUssQ0FBQyxRQUFRLENBQ1osT0FBd0IsRUFDeEIsT0FBeUI7UUFFekIsSUFBSSxDQUFDO1lBQ0gsVUFBVTtZQUNWLFFBQVEsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDO2dCQUM1QixTQUFTO2dCQUNULEtBQUssZ0JBQWdCO29CQUNuQixPQUFPLElBQUksQ0FBQyxVQUFVLENBQUMsV0FBVyxFQUFFLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztnQkFDeEQsS0FBSyxZQUFZO29CQUNmLE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLEVBQUUsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO2dCQUNwRCxLQUFLLGdCQUFnQjtvQkFDbkIsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFD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O0lBRU8sZ0JBQWdCLENBQUMsT0FBd0IsRUFBRSxLQUFjO1FBQy9ELE1BQU0sWUFBWSxHQUFHLEtBQUssWUFBWSxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUU1RSxPQUFPO1lBQ0wsT0FBTyxFQUFFLEtBQUs7WUFDZCxPQUFPLEVBQUUsbUJBQW1CLFlBQVksRUFBRTtZQUMxQyxNQUFNLEVBQUUsQ0FBQztvQkFDUCxJQUFJLEVBQUUsZUFBZTtvQkFDckIsT0FBTyxFQUFFLFlBQVk7b0JBQ3JCLE9BQU8sRUFBRTt3QkFDUCxXQUFXLEVBQUUsT0FBTyxDQUFDLFdBQVc7d0JBQ2hDLFFBQVEsRUFBRSxPQUFPLENBQUMsUUFBUTtxQkFDM0I7aUJBQ0YsQ0FBQztZQUNGLFdBQVcsRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFO1NBQ3hCLENBQUM7SUFDSixDQUFDO0NBQ0Y7QUF2Y0QsOERBdWNDO0FBRUQsK0VBQStFO0FBQy9FLE9BQU87QUFDUCwrRUFBK0U7QUFFL0UsU0FBZ0IsK0JBQStCLENBQzdDLGNBQXNDLEVBQ3RDLGVBQXdDLEVBQ3hDLFlBQTBCLEVBQzFCLGlCQUFvQyxFQUNwQyxNQUF3QztJQUV4QyxPQUFPLElBQUkseUJBQXlCLENBQ2xDLGNBQWMsRUFDZCxlQUFlLEVBQ2YsWUFBWSxFQUNaLGlCQUFpQixFQUNqQixNQUFNLENBQ1AsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIE9wZXJhdG9yIENvbW1hbmQgRGlzcGF0Y2ggVjJcbiAqIFBoYXNlIDJBLTJBLUkgLSDpm4bmiJAgU2Vzc2lvbi9Xb3Jrc3BhY2VcbiAqIFxuICog6IGM6LSj77yaXG4gKiAtIOe7p+aJvyBEZWZhdWx0T3BlcmF0b3JDb21tYW5kRGlzcGF0Y2hcbiAqIC0g6ZuG5oiQIFNlc3Npb25TdG9yZSDmm7TmlrAgbmF2aWdhdGlvbiBzdGF0ZVxuICogLSDpm4bmiJAgV29ya3NwYWNlU3dpdGNoZXIg5aSE55CGIHN3aXRjaF93b3Jrc3BhY2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7XG4gIERpc3BhdGNoQ29udGV4dCxcbiAgT3BlcmF0b3JDb21tYW5kLFxuICBPcGVyYXRvckNvbW1hbmRSZXN1bHQsXG4gIE9wZXJhdG9yQWN0aW9uUmVzdWx0LFxuICBPcGVyYXRvckNvbW1hbmRFcnJvcixcbn0gZnJvbSAnLi4vdHlwZXMvc3VyZmFjZV90eXBlcyc7XG5pbXBvcnQgdHlwZSB7IE9wZXJhdG9yU3VyZmFjZVNlcnZpY2UgfSBmcm9tICcuL29wZXJhdG9yX3N1cmZhY2Vfc2VydmljZSc7XG5pbXBvcnQgdHlwZSB7IE9wZXJhdG9yRXhlY3V0aW9uQnJpZGdlIH0gZnJvbSAnLi9vcGVyYXRvcl9leGVjdXRpb25fYnJpZGdlJztcbmltcG9ydCB0eXBlIHsgU2Vzc2lvblN0b3JlLCBXb3Jrc3BhY2VTd2l0Y2hlciB9IGZyb20gJy4uL3R5cGVzL3Nlc3Npb25fdHlwZXMnO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDphY3nva5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGludGVyZmFjZSBPcGVyYXRvckNvbW1hbmREaXNwYXRjaFYyQ29uZmlnIHtcbiAgLyoqIOaYr+WQpuiHquWKqOabtOaWsCBuYXZpZ2F0aW9uIHN0YXRlICovXG4gIGF1dG9VcGRhdGVOYXZpZ2F0aW9uPzogYm9vbGVhbjtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gVjIg5a6e546wXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBjbGFzcyBPcGVyYXRvckNvbW1hbmREaXNwYXRjaFYyIHtcbiAgcHJpdmF0ZSBzdXJmYWNlU2VydmljZTogT3BlcmF0b3JTdXJmYWNlU2VydmljZTtcbiAgcHJpdmF0ZSBleGVjdXRpb25CcmlkZ2U6IE9wZXJhdG9yRXhlY3V0aW9uQnJpZGdlO1xuICBwcml2YXRlIHNlc3Npb25TdG9yZTogU2Vzc2lvblN0b3JlO1xuICBwcml2YXRlIHdvcmtzcGFjZVN3aXRjaGVyOiBXb3Jrc3BhY2VTd2l0Y2hlcjtcbiAgcHJpdmF0ZSBjb25maWc6IFJlcXVpcmVkPE9wZXJhdG9yQ29tbWFuZERpc3BhdGNoVjJDb25maWc+O1xuICBcbiAgY29uc3RydWN0b3IoXG4gICAgc3VyZmFjZVNlcnZpY2U6IE9wZXJhdG9yU3VyZmFjZVNlcnZpY2UsXG4gICAgZXhlY3V0aW9uQnJpZGdlOiBPcGVyYXRvckV4ZWN1dGlvbkJyaWRnZSxcbiAgICBzZXNzaW9uU3RvcmU6IFNlc3Npb25TdG9yZSxcbiAgICB3b3Jrc3BhY2VTd2l0Y2hlcjogV29ya3NwYWNlU3dpdGNoZXIsXG4gICAgY29uZmlnOiBPcGVyYXRvckNvbW1hbmREaXNwYXRjaFYyQ29uZmlnID0ge31cbiAgKSB7XG4gICAgdGhpcy5zdXJmYWNlU2VydmljZSA9IHN1cmZhY2VTZXJ2aWNlO1xuICAgIHRoaXMuZXhlY3V0aW9uQnJpZGdlID0gZXhlY3V0aW9uQnJpZGdlO1xuICAgIHRoaXMuc2Vzc2lvblN0b3JlID0gc2Vzc2lvblN0b3JlO1xuICAgIHRoaXMud29ya3NwYWNlU3dpdGNoZXIgPSB3b3Jrc3BhY2VTd2l0Y2hlcjtcbiAgICB0aGlzLmNvbmZpZyA9IHtcbiAgICAgIGF1dG9VcGRhdGVOYXZpZ2F0aW9uOiBjb25maWcuYXV0b1VwZGF0ZU5hdmlnYXRpb24gPz8gdHJ1ZSxcbiAgICB9O1xuICB9XG4gIFxuICBhc3luYyBkaXNwYXRjaChcbiAgICBjb21tYW5kOiBPcGVyYXRvckNvbW1hbmQsXG4gICAgY29udGV4dD86IERpc3BhdGNoQ29udGV4dFxuICApOiBQcm9taXNlPE9wZXJhdG9yQ29tbWFuZFJlc3VsdD4ge1xuICAgIHRyeSB7XG4gICAgICAvLyDmjInlkb3ku6TnsbvlnovliIblj5FcbiAgICAgIHN3aXRjaCAoY29tbWFuZC5jb21tYW5kVHlwZSkge1xuICAgICAgICAvLyBWaWV3IOexu1xuICAgICAgICBjYXNlICd2aWV3X2Rhc2hib2FyZCc6XG4gICAgICAgICAgcmV0dXJuIHRoaXMuaGFuZGxlVmlldygnZGFzaGJvYXJkJywgY29tbWFuZCwgY29udGV4dCk7XG4gICAgICAgIGNhc2UgJ3ZpZXdfdGFza3MnOlxuICAgICAgICAgIHJldHVybiB0aGlzLmhhbmRsZVZpZXcoJ3Rhc2tzJywgY29tbWFuZCwgY29udGV4dCk7XG4gICAgICAgIGNhc2UgJ3ZpZXdfYXBwcm92YWxzJzpcbiAgICAgICAgICByZXR1cm4gdGhpcy5oYW5kbGVWaWV3KCdhcHByb3ZhbHMnLCBjb21tYW5kLCBjb250ZXh0KTtcbiAgICAgICAgY2FzZSAndmlld19pbmNpZGVudHMnOlxuICAgICAgICAgIHJldHVybiB0aGlzLmhhbmRsZVZpZXcoJ2luY2lkZW50cycsIGNvbW1hbmQsIGNvbnRleHQpO1xuICAgICAgICBjYXNlICd2aWV3X2FnZW50cyc6XG4gICAgICAgICAgcmV0dXJuIHRoaXMuaGFuZGxlVmlldygnYWdlbnRzJywgY29tbWFuZCwgY29udGV4dCk7XG4gICAgICAgIGNhc2UgJ3ZpZXdfaW5ib3gnOlxuICAgICAgICAgIHJldHVybiB0aGlzLmhhbmRsZVZpZXcoJ2luYm94JywgY29tbWFuZCwgY29udGV4dCk7XG4gICAgICAgIGNhc2UgJ3ZpZXdfaW50ZXJ2ZW50aW9ucyc6XG4gICAgICAgICAgcmV0dXJuIHRoaXMuaGFuZGxlVmlldygnaW50ZXJ2ZW50aW9ucycsIGNvbW1hbmQsIGNvbnRleHQpO1xuICAgICAgICBjYXNlICd2aWV3X2hpc3RvcnknOlxuICAgICAgICAgIHJldHVybiB0aGlzLmhhbmRsZVZpZXcoJ2hpc3RvcnknLCBjb21tYW5kLCBjb250ZXh0KTtcbiAgICAgICAgY2FzZSAnb3Blbl9pdGVtJzpcbiAgICAgICAgICByZXR1cm4gdGhpcy5oYW5kbGVPcGVuSXRlbShjb21tYW5kLCBjb250ZXh0KTtcbiAgICAgICAgY2FzZSAncmVmcmVzaCc6XG4gICAgICAgICAgcmV0dXJuIHRoaXMuaGFuZGxlUmVmcmVzaChjb21tYW5kLCBjb250ZXh0KTtcbiAgICAgICAgXG4gICAgICAgIC8vIENvbnRyb2wg57G7XG4gICAgICAgIGNhc2UgJ2FwcHJvdmUnOlxuICAgICAgICAgIHJldHVybiB0aGlzLmhhbmRsZUFwcHJvdmUoY29tbWFuZCwgY29udGV4dCk7XG4gICAgICAgIGNhc2UgJ3JlamVjdCc6XG4gICAgICAgICAgcmV0dXJuIHRoaXMuaGFuZGxlUmVqZWN0KGNvbW1hbmQsIGNvbnRleHQpO1xuICAgICAgICBjYXNlICdhY2tfaW5jaWRlbnQnOlxuICAgICAgICAgIHJldHVybiB0aGlzLmhhbmRsZUFja0luY2lkZW50KGNvbW1hbmQsIGNvbnRleHQpO1xuICAgICAgICBjYXNlICdyZXRyeV90YXNrJzpcbiAgICAgICAgICByZXR1cm4gdGhpcy5oYW5kbGVSZXRyeVRhc2soY29tbWFuZCwgY29udGV4dCk7XG4gICAgICAgIGNhc2UgJ3BhdXNlX2FnZW50JzpcbiAgICAgICAgICByZXR1cm4gdGhpcy5oYW5kbGVQYXVzZUFnZW50KGNvbW1hbmQsIGNvbnRleHQpO1xuICAgICAgICBcbiAgICAgICAgLy8gTmF2aWdhdGlvbiDnsbtcbiAgICAgICAgY2FzZSAnc3dpdGNoX3dvcmtzcGFjZSc6XG4gICAgICAgICAgcmV0dXJuIHRoaXMuaGFuZGxlU3dpdGNoV29ya3NwYWNlKGNvbW1hbmQsIGNvbnRleHQpO1xuICAgICAgICBjYXNlICdnb19iYWNrJzpcbiAgICAgICAgICByZXR1cm4gdGhpcy5oYW5kbGVHb0JhY2soY29tbWFuZCwgY29udGV4dCk7XG4gICAgICAgIFxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHJldHVybiB0aGlzLmJ1aWxkVW5zdXBwb3J0ZWRSZXN1bHQoY29tbWFuZCk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHJldHVybiB0aGlzLmJ1aWxkRXJyb3JSZXN1bHQoY29tbWFuZCwgZXJyb3IpO1xuICAgIH1cbiAgfVxuICBcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAvLyBWaWV3IEhhbmRsZXJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICBcbiAgcHJpdmF0ZSBhc3luYyBoYW5kbGVWaWV3KFxuICAgIHZpZXdLaW5kOiBzdHJpbmcsXG4gICAgY29tbWFuZDogT3BlcmF0b3JDb21tYW5kLFxuICAgIGNvbnRleHQ/OiBEaXNwYXRjaENvbnRleHRcbiAgKTogUHJvbWlzZTxPcGVyYXRvckNvbW1hbmRSZXN1bHQ+IHtcbiAgICBjb25zdCB1cGRhdGVkVmlldyA9IGF3YWl0IHRoaXMuc3VyZmFjZVNlcnZpY2UuZ2V0Vmlldyh7XG4gICAgICBhY3RvcjogY29tbWFuZC5hY3RvcixcbiAgICAgIHZpZXdLaW5kOiB2aWV3S2luZCBhcyBhbnksXG4gICAgICB3b3Jrc3BhY2VJZDogY29tbWFuZC5hY3Rvci53b3Jrc3BhY2VJZCxcbiAgICAgIG1vZGU6IGNvbnRleHQ/Lm5hdmlnYXRpb24/Lm1vZGUsXG4gICAgfSk7XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBtZXNzYWdlOiBgVmlldyAke3ZpZXdLaW5kfSBsb2FkZWRgLFxuICAgICAgdXBkYXRlZFZpZXcsXG4gICAgICBuYXZpZ2F0aW9uU3RhdGU6IGNvbnRleHQ/Lm5hdmlnYXRpb24gPyB7XG4gICAgICAgIC4uLmNvbnRleHQubmF2aWdhdGlvbixcbiAgICAgICAgY3VycmVudFZpZXc6IHZpZXdLaW5kLFxuICAgICAgICBsYXN0Q29tbWFuZEF0OiBEYXRlLm5vdygpLFxuICAgICAgfSA6IHtcbiAgICAgICAgY3VycmVudFZpZXc6IHZpZXdLaW5kLFxuICAgICAgICBsYXN0Q29tbWFuZEF0OiBEYXRlLm5vdygpLFxuICAgICAgfSxcbiAgICAgIHJlc3BvbmRlZEF0OiBEYXRlLm5vdygpLFxuICAgIH07XG4gIH1cbiAgXG4gIHByaXZhdGUgYXN5bmMgaGFuZGxlT3Blbkl0ZW0oXG4gICAgY29tbWFuZDogT3BlcmF0b3JDb21tYW5kLFxuICAgIGNvbnRleHQ/OiBEaXNwYXRjaENvbnRleHRcbiAgKTogUHJvbWlzZTxPcGVyYXRvckNvbW1hbmRSZXN1bHQ+IHtcbiAgICBjb25zdCB1cGRhdGVkVmlldyA9IGF3YWl0IHRoaXMuc3VyZmFjZVNlcnZpY2UuZ2V0SXRlbURldGFpbFZpZXcoe1xuICAgICAgYWN0b3I6IGNvbW1hbmQuYWN0b3IsXG4gICAgICB2aWV3S2luZDogJ2l0ZW1fZGV0YWlsJyxcbiAgICAgIHdvcmtzcGFjZUlkOiBjb21tYW5kLmFjdG9yLndvcmtzcGFjZUlkLFxuICAgICAgdGFyZ2V0SWQ6IGNvbW1hbmQudGFyZ2V0SWQsXG4gICAgfSk7XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBtZXNzYWdlOiBgSXRlbSAke2NvbW1hbmQudGFyZ2V0SWR9IG9wZW5lZGAsXG4gICAgICB1cGRhdGVkVmlldyxcbiAgICAgIG5hdmlnYXRpb25TdGF0ZTogY29udGV4dD8ubmF2aWdhdGlvbiA/IHtcbiAgICAgICAgLi4uY29udGV4dC5uYXZpZ2F0aW9uLFxuICAgICAgICBjdXJyZW50VmlldzogJ2l0ZW1fZGV0YWlsJyxcbiAgICAgICAgc2VsZWN0ZWRJdGVtSWQ6IGNvbW1hbmQudGFyZ2V0SWQsXG4gICAgICAgIHNlbGVjdGVkVGFyZ2V0VHlwZTogY29tbWFuZC50YXJnZXRUeXBlLFxuICAgICAgICBsYXN0Q29tbWFuZEF0OiBEYXRlLm5vdygpLFxuICAgICAgfSA6IHtcbiAgICAgICAgY3VycmVudFZpZXc6ICdpdGVtX2RldGFpbCcsXG4gICAgICAgIHNlbGVjdGVkSXRlbUlkOiBjb21tYW5kLnRhcmdldElkLFxuICAgICAgICBzZWxlY3RlZFRhcmdldFR5cGU6IGNvbW1hbmQudGFyZ2V0VHlwZSxcbiAgICAgICAgbGFzdENvbW1hbmRBdDogRGF0ZS5ub3coKSxcbiAgICAgIH0sXG4gICAgICByZXNwb25kZWRBdDogRGF0ZS5ub3coKSxcbiAgICB9O1xuICB9XG4gIFxuICBwcml2YXRlIGFzeW5jIGhhbmRsZVJlZnJlc2goXG4gICAgY29tbWFuZDogT3BlcmF0b3JDb21tYW5kLFxuICAgIGNvbnRleHQ/OiBEaXNwYXRjaENvbnRleHRcbiAgKTogUHJvbWlzZTxPcGVyYXRvckNvbW1hbmRSZXN1bHQ+IHtcbiAgICBjb25zdCBjdXJyZW50VmlldyA9IGNvbnRleHQ/Lm5hdmlnYXRpb24/LmN1cnJlbnRWaWV3IHx8ICdkYXNoYm9hcmQnO1xuICAgIFxuICAgIGNvbnN0IHVwZGF0ZWRWaWV3ID0gYXdhaXQgdGhpcy5zdXJmYWNlU2VydmljZS5nZXRWaWV3KHtcbiAgICAgIGFjdG9yOiBjb21tYW5kLmFjdG9yLFxuICAgICAgdmlld0tpbmQ6IGN1cnJlbnRWaWV3LFxuICAgICAgd29ya3NwYWNlSWQ6IGNvbW1hbmQuYWN0b3Iud29ya3NwYWNlSWQsXG4gICAgICBtb2RlOiBjb250ZXh0Py5uYXZpZ2F0aW9uPy5tb2RlLFxuICAgIH0pO1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgbWVzc2FnZTogJ1ZpZXcgcmVmcmVzaGVkJyxcbiAgICAgIHVwZGF0ZWRWaWV3LFxuICAgICAgcmVzcG9uZGVkQXQ6IERhdGUubm93KCksXG4gICAgfTtcbiAgfVxuICBcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAvLyBDb250cm9sIEhhbmRsZXJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICBcbiAgcHJpdmF0ZSBhc3luYyBoYW5kbGVBcHByb3ZlKFxuICAgIGNvbW1hbmQ6IE9wZXJhdG9yQ29tbWFuZCxcbiAgICBjb250ZXh0PzogRGlzcGF0Y2hDb250ZXh0XG4gICk6IFByb21pc2U8T3BlcmF0b3JDb21tYW5kUmVzdWx0PiB7XG4gICAgaWYgKCFjb21tYW5kLnRhcmdldElkKSB7XG4gICAgICByZXR1cm4gdGhpcy5idWlsZEVycm9yUmVzdWx0KGNvbW1hbmQsIG5ldyBFcnJvcignTWlzc2luZyB0YXJnZXRJZCcpKTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgZXhlY1Jlc3VsdCA9IGF3YWl0IHRoaXMuZXhlY3V0aW9uQnJpZGdlLmFwcHJvdmVBcHByb3ZhbChcbiAgICAgIGNvbW1hbmQudGFyZ2V0SWQsXG4gICAgICBjb21tYW5kLmFjdG9yLmFjdG9ySWRcbiAgICApO1xuICAgIFxuICAgIGNvbnN0IGFjdGlvblJlc3VsdDogT3BlcmF0b3JBY3Rpb25SZXN1bHQgPSB7XG4gICAgICBzdWNjZXNzOiBleGVjUmVzdWx0LnN1Y2Nlc3MsXG4gICAgICBhY3Rpb25UeXBlOiAnYXBwcm92ZScsXG4gICAgICB0YXJnZXRUeXBlOiAnYXBwcm92YWwnLFxuICAgICAgdGFyZ2V0SWQ6IGNvbW1hbmQudGFyZ2V0SWQsXG4gICAgICBtZXNzYWdlOiBleGVjUmVzdWx0Lm1lc3NhZ2UsXG4gICAgICBleGVjdXRlZEF0OiBleGVjUmVzdWx0LmV4ZWN1dGVkQXQsXG4gICAgfTtcbiAgICBcbiAgICBjb25zdCB1cGRhdGVkVmlldyA9IGF3YWl0IHRoaXMuc3VyZmFjZVNlcnZpY2UuZ2V0QXBwcm92YWxWaWV3KHtcbiAgICAgIGFjdG9yOiBjb21tYW5kLmFjdG9yLFxuICAgICAgdmlld0tpbmQ6ICdhcHByb3ZhbHMnLFxuICAgICAgd29ya3NwYWNlSWQ6IGNvbW1hbmQuYWN0b3Iud29ya3NwYWNlSWQsXG4gICAgfSk7XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IGV4ZWNSZXN1bHQuc3VjY2VzcyxcbiAgICAgIG1lc3NhZ2U6IGV4ZWNSZXN1bHQubWVzc2FnZSxcbiAgICAgIGFjdGlvblJlc3VsdCxcbiAgICAgIHVwZGF0ZWRWaWV3LFxuICAgICAgcmVzcG9uZGVkQXQ6IERhdGUubm93KCksXG4gICAgfTtcbiAgfVxuICBcbiAgcHJpdmF0ZSBhc3luYyBoYW5kbGVSZWplY3QoXG4gICAgY29tbWFuZDogT3BlcmF0b3JDb21tYW5kLFxuICAgIGNvbnRleHQ/OiBEaXNwYXRjaENvbnRleHRcbiAgKTogUHJvbWlzZTxPcGVyYXRvckNvbW1hbmRSZXN1bHQ+IHtcbiAgICBpZiAoIWNvbW1hbmQudGFyZ2V0SWQpIHtcbiAgICAgIHJldHVybiB0aGlzLmJ1aWxkRXJyb3JSZXN1bHQoY29tbWFuZCwgbmV3IEVycm9yKCdNaXNzaW5nIHRhcmdldElkJykpO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCBleGVjUmVzdWx0ID0gYXdhaXQgdGhpcy5leGVjdXRpb25CcmlkZ2UucmVqZWN0QXBwcm92YWwoXG4gICAgICBjb21tYW5kLnRhcmdldElkLFxuICAgICAgY29tbWFuZC5hY3Rvci5hY3RvcklkXG4gICAgKTtcbiAgICBcbiAgICBjb25zdCBhY3Rpb25SZXN1bHQ6IE9wZXJhdG9yQWN0aW9uUmVzdWx0ID0ge1xuICAgICAgc3VjY2VzczogZXhlY1Jlc3VsdC5zdWNjZXNzLFxuICAgICAgYWN0aW9uVHlwZTogJ3JlamVjdCcsXG4gICAgICB0YXJnZXRUeXBlOiAnYXBwcm92YWwnLFxuICAgICAgdGFyZ2V0SWQ6IGNvbW1hbmQudGFyZ2V0SWQsXG4gICAgICBtZXNzYWdlOiBleGVjUmVzdWx0Lm1lc3NhZ2UsXG4gICAgICBleGVjdXRlZEF0OiBleGVjUmVzdWx0LmV4ZWN1dGVkQXQsXG4gICAgfTtcbiAgICBcbiAgICBjb25zdCB1cGRhdGVkVmlldyA9IGF3YWl0IHRoaXMuc3VyZmFjZVNlcnZpY2UuZ2V0QXBwcm92YWxWaWV3KHtcbiAgICAgIGFjdG9yOiBjb21tYW5kLmFjdG9yLFxuICAgICAgdmlld0tpbmQ6ICdhcHByb3ZhbHMnLFxuICAgICAgd29ya3NwYWNlSWQ6IGNvbW1hbmQuYWN0b3Iud29ya3NwYWNlSWQsXG4gICAgfSk7XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IGV4ZWNSZXN1bHQuc3VjY2VzcyxcbiAgICAgIG1lc3NhZ2U6IGV4ZWNSZXN1bHQubWVzc2FnZSxcbiAgICAgIGFjdGlvblJlc3VsdCxcbiAgICAgIHVwZGF0ZWRWaWV3LFxuICAgICAgcmVzcG9uZGVkQXQ6IERhdGUubm93KCksXG4gICAgfTtcbiAgfVxuICBcbiAgcHJpdmF0ZSBhc3luYyBoYW5kbGVBY2tJbmNpZGVudChcbiAgICBjb21tYW5kOiBPcGVyYXRvckNvbW1hbmQsXG4gICAgY29udGV4dD86IERpc3BhdGNoQ29udGV4dFxuICApOiBQcm9taXNlPE9wZXJhdG9yQ29tbWFuZFJlc3VsdD4ge1xuICAgIGlmICghY29tbWFuZC50YXJnZXRJZCkge1xuICAgICAgcmV0dXJuIHRoaXMuYnVpbGRFcnJvclJlc3VsdChjb21tYW5kLCBuZXcgRXJyb3IoJ01pc3NpbmcgdGFyZ2V0SWQnKSk7XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IGV4ZWNSZXN1bHQgPSBhd2FpdCB0aGlzLmV4ZWN1dGlvbkJyaWRnZS5hY2tJbmNpZGVudChcbiAgICAgIGNvbW1hbmQudGFyZ2V0SWQsXG4gICAgICBjb21tYW5kLmFjdG9yLmFjdG9ySWRcbiAgICApO1xuICAgIFxuICAgIGNvbnN0IGFjdGlvblJlc3VsdDogT3BlcmF0b3JBY3Rpb25SZXN1bHQgPSB7XG4gICAgICBzdWNjZXNzOiBleGVjUmVzdWx0LnN1Y2Nlc3MsXG4gICAgICBhY3Rpb25UeXBlOiAnYWNrX2luY2lkZW50JyxcbiAgICAgIHRhcmdldFR5cGU6ICdpbmNpZGVudCcsXG4gICAgICB0YXJnZXRJZDogY29tbWFuZC50YXJnZXRJZCxcbiAgICAgIG1lc3NhZ2U6IGV4ZWNSZXN1bHQubWVzc2FnZSxcbiAgICAgIGV4ZWN1dGVkQXQ6IGV4ZWNSZXN1bHQuZXhlY3V0ZWRBdCxcbiAgICB9O1xuICAgIFxuICAgIGNvbnN0IHVwZGF0ZWRWaWV3ID0gYXdhaXQgdGhpcy5zdXJmYWNlU2VydmljZS5nZXRJbmNpZGVudFZpZXcoe1xuICAgICAgYWN0b3I6IGNvbW1hbmQuYWN0b3IsXG4gICAgICB2aWV3S2luZDogJ2luY2lkZW50cycsXG4gICAgICB3b3Jrc3BhY2VJZDogY29tbWFuZC5hY3Rvci53b3Jrc3BhY2VJZCxcbiAgICB9KTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogZXhlY1Jlc3VsdC5zdWNjZXNzLFxuICAgICAgbWVzc2FnZTogZXhlY1Jlc3VsdC5tZXNzYWdlLFxuICAgICAgYWN0aW9uUmVzdWx0LFxuICAgICAgdXBkYXRlZFZpZXcsXG4gICAgICByZXNwb25kZWRBdDogRGF0ZS5ub3coKSxcbiAgICB9O1xuICB9XG4gIFxuICBwcml2YXRlIGFzeW5jIGhhbmRsZVJldHJ5VGFzayhcbiAgICBjb21tYW5kOiBPcGVyYXRvckNvbW1hbmQsXG4gICAgY29udGV4dD86IERpc3BhdGNoQ29udGV4dFxuICApOiBQcm9taXNlPE9wZXJhdG9yQ29tbWFuZFJlc3VsdD4ge1xuICAgIGlmICghY29tbWFuZC50YXJnZXRJZCkge1xuICAgICAgcmV0dXJuIHRoaXMuYnVpbGRFcnJvclJlc3VsdChjb21tYW5kLCBuZXcgRXJyb3IoJ01pc3NpbmcgdGFyZ2V0SWQnKSk7XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IGV4ZWNSZXN1bHQgPSBhd2FpdCB0aGlzLmV4ZWN1dGlvbkJyaWRnZS5yZXRyeVRhc2soXG4gICAgICBjb21tYW5kLnRhcmdldElkLFxuICAgICAgY29tbWFuZC5hY3Rvci5hY3RvcklkXG4gICAgKTtcbiAgICBcbiAgICBjb25zdCBhY3Rpb25SZXN1bHQ6IE9wZXJhdG9yQWN0aW9uUmVzdWx0ID0ge1xuICAgICAgc3VjY2VzczogZXhlY1Jlc3VsdC5zdWNjZXNzLFxuICAgICAgYWN0aW9uVHlwZTogJ3JldHJ5X3Rhc2snLFxuICAgICAgdGFyZ2V0VHlwZTogJ3Rhc2snLFxuICAgICAgdGFyZ2V0SWQ6IGNvbW1hbmQudGFyZ2V0SWQsXG4gICAgICBtZXNzYWdlOiBleGVjUmVzdWx0Lm1lc3NhZ2UsXG4gICAgICBleGVjdXRlZEF0OiBleGVjUmVzdWx0LmV4ZWN1dGVkQXQsXG4gICAgfTtcbiAgICBcbiAgICBjb25zdCB1cGRhdGVkVmlldyA9IGF3YWl0IHRoaXMuc3VyZmFjZVNlcnZpY2UuZ2V0VGFza1ZpZXcoe1xuICAgICAgYWN0b3I6IGNvbW1hbmQuYWN0b3IsXG4gICAgICB2aWV3S2luZDogJ3Rhc2tzJyxcbiAgICAgIHdvcmtzcGFjZUlkOiBjb21tYW5kLmFjdG9yLndvcmtzcGFjZUlkLFxuICAgIH0pO1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBzdWNjZXNzOiBleGVjUmVzdWx0LnN1Y2Nlc3MsXG4gICAgICBtZXNzYWdlOiBleGVjUmVzdWx0Lm1lc3NhZ2UsXG4gICAgICBhY3Rpb25SZXN1bHQsXG4gICAgICB1cGRhdGVkVmlldyxcbiAgICAgIHJlc3BvbmRlZEF0OiBEYXRlLm5vdygpLFxuICAgIH07XG4gIH1cbiAgXG4gIHByaXZhdGUgYXN5bmMgaGFuZGxlUGF1c2VBZ2VudChcbiAgICBjb21tYW5kOiBPcGVyYXRvckNvbW1hbmQsXG4gICAgY29udGV4dD86IERpc3BhdGNoQ29udGV4dFxuICApOiBQcm9taXNlPE9wZXJhdG9yQ29tbWFuZFJlc3VsdD4ge1xuICAgIGlmICghY29tbWFuZC50YXJnZXRJZCkge1xuICAgICAgcmV0dXJuIHRoaXMuYnVpbGRFcnJvclJlc3VsdChjb21tYW5kLCBuZXcgRXJyb3IoJ01pc3NpbmcgdGFyZ2V0SWQnKSk7XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IGV4ZWNSZXN1bHQgPSBhd2FpdCB0aGlzLmV4ZWN1dGlvbkJyaWRnZS5wYXVzZUFnZW50KFxuICAgICAgY29tbWFuZC50YXJnZXRJZCxcbiAgICAgIGNvbW1hbmQuYWN0b3IuYWN0b3JJZFxuICAgICk7XG4gICAgXG4gICAgY29uc3QgYWN0aW9uUmVzdWx0OiBPcGVyYXRvckFjdGlvblJlc3VsdCA9IHtcbiAgICAgIHN1Y2Nlc3M6IGV4ZWNSZXN1bHQuc3VjY2VzcyxcbiAgICAgIGFjdGlvblR5cGU6ICdwYXVzZV9hZ2VudCcsXG4gICAgICB0YXJnZXRUeXBlOiAnYWdlbnQnLFxuICAgICAgdGFyZ2V0SWQ6IGNvbW1hbmQudGFyZ2V0SWQsXG4gICAgICBtZXNzYWdlOiBleGVjUmVzdWx0Lm1lc3NhZ2UsXG4gICAgICBleGVjdXRlZEF0OiBleGVjUmVzdWx0LmV4ZWN1dGVkQXQsXG4gICAgfTtcbiAgICBcbiAgICBjb25zdCB1cGRhdGVkVmlldyA9IGF3YWl0IHRoaXMuc3VyZmFjZVNlcnZpY2UuZ2V0RGFzaGJvYXJkVmlldyh7XG4gICAgICBhY3RvcjogY29tbWFuZC5hY3RvcixcbiAgICAgIHZpZXdLaW5kOiAnZGFzaGJvYXJkJyxcbiAgICAgIHdvcmtzcGFjZUlkOiBjb21tYW5kLmFjdG9yLndvcmtzcGFjZUlkLFxuICAgIH0pO1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBzdWNjZXNzOiBleGVjUmVzdWx0LnN1Y2Nlc3MsXG4gICAgICBtZXNzYWdlOiBleGVjUmVzdWx0Lm1lc3NhZ2UsXG4gICAgICBhY3Rpb25SZXN1bHQsXG4gICAgICB1cGRhdGVkVmlldyxcbiAgICAgIHJlc3BvbmRlZEF0OiBEYXRlLm5vdygpLFxuICAgIH07XG4gIH1cbiAgXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgLy8gTmF2aWdhdGlvbiBIYW5kbGVyXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgXG4gIHByaXZhdGUgYXN5bmMgaGFuZGxlU3dpdGNoV29ya3NwYWNlKFxuICAgIGNvbW1hbmQ6IE9wZXJhdG9yQ29tbWFuZCxcbiAgICBjb250ZXh0PzogRGlzcGF0Y2hDb250ZXh0XG4gICk6IFByb21pc2U8T3BlcmF0b3JDb21tYW5kUmVzdWx0PiB7XG4gICAgaWYgKCFjb21tYW5kLnRhcmdldElkKSB7XG4gICAgICByZXR1cm4gdGhpcy5idWlsZEVycm9yUmVzdWx0KGNvbW1hbmQsIG5ldyBFcnJvcignTWlzc2luZyB3b3Jrc3BhY2VJZCcpKTtcbiAgICB9XG4gICAgXG4gICAgaWYgKCFjb250ZXh0Py5hY3Rvcj8uc2Vzc2lvbklkKSB7XG4gICAgICByZXR1cm4gdGhpcy5idWlsZEVycm9yUmVzdWx0KGNvbW1hbmQsIG5ldyBFcnJvcignU2Vzc2lvbiByZXF1aXJlZCBmb3Igd29ya3NwYWNlIHN3aXRjaCcpKTtcbiAgICB9XG4gICAgXG4gICAgLy8g5L2/55SoIFdvcmtzcGFjZVN3aXRjaGVyIOWIh+aNolxuICAgIGNvbnN0IHN3aXRjaFJlc3VsdCA9IGF3YWl0IHRoaXMud29ya3NwYWNlU3dpdGNoZXIuc3dpdGNoV29ya3NwYWNlKFxuICAgICAgY29udGV4dC5hY3Rvci5zZXNzaW9uSWQsXG4gICAgICBjb21tYW5kLnRhcmdldElkXG4gICAgKTtcbiAgICBcbiAgICAvLyDojrflj5bmlrAgd29ya3NwYWNlIOeahCBkYXNoYm9hcmRcbiAgICBjb25zdCB1cGRhdGVkVmlldyA9IGF3YWl0IHRoaXMuc3VyZmFjZVNlcnZpY2UuZ2V0RGFzaGJvYXJkVmlldyh7XG4gICAgICBhY3Rvcjoge1xuICAgICAgICAuLi5jb21tYW5kLmFjdG9yLFxuICAgICAgICB3b3Jrc3BhY2VJZDogc3dpdGNoUmVzdWx0LmN1cnJlbnRXb3Jrc3BhY2VJZCxcbiAgICAgIH0sXG4gICAgICB2aWV3S2luZDogJ2Rhc2hib2FyZCcsXG4gICAgICB3b3Jrc3BhY2VJZDogc3dpdGNoUmVzdWx0LmN1cnJlbnRXb3Jrc3BhY2VJZCxcbiAgICB9KTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIG1lc3NhZ2U6IGBTd2l0Y2hlZCB0byB3b3Jrc3BhY2UgJHtjb21tYW5kLnRhcmdldElkfWAsXG4gICAgICB1cGRhdGVkVmlldyxcbiAgICAgIG5hdmlnYXRpb25TdGF0ZToge1xuICAgICAgICB3b3Jrc3BhY2VJZDogc3dpdGNoUmVzdWx0LmN1cnJlbnRXb3Jrc3BhY2VJZCxcbiAgICAgICAgY3VycmVudFZpZXc6ICdkYXNoYm9hcmQnLFxuICAgICAgICBsYXN0Q29tbWFuZEF0OiBEYXRlLm5vdygpLFxuICAgICAgfSxcbiAgICAgIHJlc3BvbmRlZEF0OiBEYXRlLm5vdygpLFxuICAgIH07XG4gIH1cbiAgXG4gIHByaXZhdGUgYXN5bmMgaGFuZGxlR29CYWNrKFxuICAgIGNvbW1hbmQ6IE9wZXJhdG9yQ29tbWFuZCxcbiAgICBjb250ZXh0PzogRGlzcGF0Y2hDb250ZXh0XG4gICk6IFByb21pc2U8T3BlcmF0b3JDb21tYW5kUmVzdWx0PiB7XG4gICAgY29uc3QgcHJldmlvdXNWaWV3ID0gY29udGV4dD8ubmF2aWdhdGlvbj8ucHJldmlvdXNWaWV3IHx8ICdkYXNoYm9hcmQnO1xuICAgIFxuICAgIGNvbnN0IHVwZGF0ZWRWaWV3ID0gYXdhaXQgdGhpcy5zdXJmYWNlU2VydmljZS5nZXRWaWV3KHtcbiAgICAgIGFjdG9yOiBjb21tYW5kLmFjdG9yLFxuICAgICAgdmlld0tpbmQ6IHByZXZpb3VzVmlldyxcbiAgICAgIHdvcmtzcGFjZUlkOiBjb21tYW5kLmFjdG9yLndvcmtzcGFjZUlkLFxuICAgIH0pO1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgbWVzc2FnZTogJ05hdmlnYXRlZCBiYWNrJyxcbiAgICAgIHVwZGF0ZWRWaWV3LFxuICAgICAgbmF2aWdhdGlvblN0YXRlOiBjb250ZXh0Py5uYXZpZ2F0aW9uID8ge1xuICAgICAgICAuLi5jb250ZXh0Lm5hdmlnYXRpb24sXG4gICAgICAgIGN1cnJlbnRWaWV3OiBwcmV2aW91c1ZpZXcsXG4gICAgICAgIHByZXZpb3VzVmlldzogY29udGV4dC5uYXZpZ2F0aW9uLmN1cnJlbnRWaWV3LFxuICAgICAgICBsYXN0Q29tbWFuZEF0OiBEYXRlLm5vdygpLFxuICAgICAgfSA6IHVuZGVmaW5lZCxcbiAgICAgIHJlc3BvbmRlZEF0OiBEYXRlLm5vdygpLFxuICAgIH07XG4gIH1cbiAgXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgLy8g6L6F5Yqp5pa55rOVXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgXG4gIHByaXZhdGUgYnVpbGRVbnN1cHBvcnRlZFJlc3VsdChjb21tYW5kOiBPcGVyYXRvckNvbW1hbmQpOiBPcGVyYXRvckNvbW1hbmRSZXN1bHQge1xuICAgIHJldHVybiB7XG4gICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgIG1lc3NhZ2U6IGBVbnN1cHBvcnRlZCBjb21tYW5kIHR5cGU6ICR7Y29tbWFuZC5jb21tYW5kVHlwZX1gLFxuICAgICAgZXJyb3JzOiBbe1xuICAgICAgICBjb2RlOiAnVU5TVVBQT1JURURfQ09NTUFORCcsXG4gICAgICAgIG1lc3NhZ2U6IGBDb21tYW5kICR7Y29tbWFuZC5jb21tYW5kVHlwZX0gaXMgbm90IGltcGxlbWVudGVkYCxcbiAgICAgIH1dLFxuICAgICAgcmVzcG9uZGVkQXQ6IERhdGUubm93KCksXG4gICAgfTtcbiAgfVxuICBcbiAgcHJpdmF0ZSBidWlsZEVycm9yUmVzdWx0KGNvbW1hbmQ6IE9wZXJhdG9yQ29tbWFuZCwgZXJyb3I6IHVua25vd24pOiBPcGVyYXRvckNvbW1hbmRSZXN1bHQge1xuICAgIGNvbnN0IGVycm9yTWVzc2FnZSA9IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICBtZXNzYWdlOiBgQ29tbWFuZCBmYWlsZWQ6ICR7ZXJyb3JNZXNzYWdlfWAsXG4gICAgICBlcnJvcnM6IFt7XG4gICAgICAgIGNvZGU6ICdDT01NQU5EX0VSUk9SJyxcbiAgICAgICAgbWVzc2FnZTogZXJyb3JNZXNzYWdlLFxuICAgICAgICBkZXRhaWxzOiB7XG4gICAgICAgICAgY29tbWFuZFR5cGU6IGNvbW1hbmQuY29tbWFuZFR5cGUsXG4gICAgICAgICAgdGFyZ2V0SWQ6IGNvbW1hbmQudGFyZ2V0SWQsXG4gICAgICAgIH0sXG4gICAgICB9XSxcbiAgICAgIHJlc3BvbmRlZEF0OiBEYXRlLm5vdygpLFxuICAgIH07XG4gIH1cbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5bel5Y6C5Ye95pWwXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVPcGVyYXRvckNvbW1hbmREaXNwYXRjaFYyKFxuICBzdXJmYWNlU2VydmljZTogT3BlcmF0b3JTdXJmYWNlU2VydmljZSxcbiAgZXhlY3V0aW9uQnJpZGdlOiBPcGVyYXRvckV4ZWN1dGlvbkJyaWRnZSxcbiAgc2Vzc2lvblN0b3JlOiBTZXNzaW9uU3RvcmUsXG4gIHdvcmtzcGFjZVN3aXRjaGVyOiBXb3Jrc3BhY2VTd2l0Y2hlcixcbiAgY29uZmlnPzogT3BlcmF0b3JDb21tYW5kRGlzcGF0Y2hWMkNvbmZpZ1xuKTogT3BlcmF0b3JDb21tYW5kRGlzcGF0Y2hWMiB7XG4gIHJldHVybiBuZXcgT3BlcmF0b3JDb21tYW5kRGlzcGF0Y2hWMihcbiAgICBzdXJmYWNlU2VydmljZSxcbiAgICBleGVjdXRpb25CcmlkZ2UsXG4gICAgc2Vzc2lvblN0b3JlLFxuICAgIHdvcmtzcGFjZVN3aXRjaGVyLFxuICAgIGNvbmZpZ1xuICApO1xufVxuIl19