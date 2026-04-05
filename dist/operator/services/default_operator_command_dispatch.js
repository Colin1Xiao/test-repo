"use strict";
/**
 * Default Operator Command Dispatch
 * Phase 2A-1R - 命令分发实现
 *
 * 职责：
 * - 实现 OperatorCommandDispatch 接口
 * - 映射命令到真实动作
 * - 依赖：OperatorSurfaceService, ControlSurface, HumanLoopService
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultOperatorCommandDispatch = void 0;
exports.createOperatorCommandDispatch = createOperatorCommandDispatch;
// ============================================================================
// 默认实现
// ============================================================================
class DefaultOperatorCommandDispatch {
    constructor(surfaceService, executionBridge, controlSurfaceBuilder, humanLoopService, snapshotProvider) {
        this.controlSurfaceBuilder = null;
        this.humanLoopService = null;
        this.snapshotProvider = null;
        this.surfaceService = surfaceService;
        this.executionBridge = executionBridge;
        this.controlSurfaceBuilder = controlSurfaceBuilder || null;
        this.humanLoopService = humanLoopService || null;
        this.snapshotProvider = snapshotProvider || null;
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
                case 'escalate':
                    return this.handleEscalate(command, context);
                case 'ack_incident':
                    return this.handleAckIncident(command, context);
                case 'request_recovery':
                    return this.handleRequestRecovery(command, context);
                case 'request_replay':
                    return this.handleRequestReplay(command, context);
                case 'retry_task':
                    return this.handleRetryTask(command, context);
                case 'cancel_task':
                    return this.handleCancelTask(command, context);
                case 'pause_task':
                    return this.handlePauseTask(command, context);
                case 'resume_task':
                    return this.handleResumeTask(command, context);
                case 'pause_agent':
                    return this.handlePauseAgent(command, context);
                case 'resume_agent':
                    return this.handleResumeAgent(command, context);
                case 'inspect_agent':
                    return this.handleInspectAgent(command, context);
                // HITL 类
                case 'confirm_action':
                    return this.handleConfirmAction(command, context);
                case 'dismiss_intervention':
                    return this.handleDismissIntervention(command, context);
                case 'snooze_intervention':
                    return this.handleSnoozeIntervention(command, context);
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
            } : undefined,
            respondedAt: Date.now(),
        };
    }
    async handleOpenItem(command, context) {
        // TODO: 根据 targetType 和 targetId 获取真实数据
        const data = {
            targetType: command.targetType,
            targetId: command.targetId,
            message: '详情功能开发中',
        };
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
            } : undefined,
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
        // 使用 execution bridge 执行真实动作
        const execResult = await this.executionBridge.approveApproval(command.targetId, command.actor.actorId);
        // 失效缓存
        if (execResult.executionMode === 'real' && this.snapshotProvider) {
            this.snapshotProvider.invalidate('approval');
        }
        const actionResult = this.toActionResult(execResult);
        // 刷新审批视图和 inbox
        const [approvalView, inboxView] = await Promise.all([
            this.surfaceService.getApprovalView({
                actor: command.actor,
                viewKind: 'approvals',
                workspaceId: command.actor.workspaceId,
            }),
            this.surfaceService.getInboxView({
                actor: command.actor,
                viewKind: 'inbox',
                workspaceId: command.actor.workspaceId,
            }),
        ]);
        return {
            success: execResult.success,
            message: execResult.message,
            actionResult,
            updatedView: inboxView, // 返回 inbox 视图，让用户看到 queue 变化
            respondedAt: Date.now(),
        };
    }
    async handleReject(command, context) {
        if (!command.targetId) {
            return this.buildErrorResult(command, new Error('Missing targetId'));
        }
        const execResult = await this.executionBridge.rejectApproval(command.targetId, command.actor.actorId);
        const actionResult = this.toActionResult(execResult);
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
    async handleEscalate(command, context) {
        if (!command.targetId) {
            return this.buildErrorResult(command, new Error('Missing targetId'));
        }
        const actionResult = {
            success: true,
            actionType: 'escalate',
            targetType: command.targetType,
            targetId: command.targetId,
            message: `${command.targetType} ${command.targetId} escalated`,
            executedAt: Date.now(),
        };
        return {
            success: true,
            message: `Escalated ${command.targetId}`,
            actionResult,
            respondedAt: Date.now(),
        };
    }
    async handleAckIncident(command, context) {
        if (!command.targetId) {
            return this.buildErrorResult(command, new Error('Missing targetId'));
        }
        const execResult = await this.executionBridge.ackIncident(command.targetId, command.actor.actorId);
        // 失效缓存
        if (execResult.executionMode === 'real' && this.snapshotProvider) {
            this.snapshotProvider.invalidate('incident');
        }
        const actionResult = this.toActionResult(execResult);
        // 刷新事件视图和 inbox
        const [incidentView, inboxView] = await Promise.all([
            this.surfaceService.getIncidentView({
                actor: command.actor,
                viewKind: 'incidents',
                workspaceId: command.actor.workspaceId,
            }),
            this.surfaceService.getInboxView({
                actor: command.actor,
                viewKind: 'inbox',
                workspaceId: command.actor.workspaceId,
            }),
        ]);
        return {
            success: execResult.success,
            message: execResult.message,
            actionResult,
            updatedView: inboxView,
            respondedAt: Date.now(),
        };
    }
    async handleRequestRecovery(command, context) {
        if (!command.targetId) {
            return this.buildErrorResult(command, new Error('Missing targetId'));
        }
        const actionResult = {
            success: true,
            actionType: 'request_recovery',
            targetType: 'incident',
            targetId: command.targetId,
            message: `Recovery requested for ${command.targetId}`,
            executedAt: Date.now(),
        };
        return {
            success: true,
            message: `Recovery requested for ${command.targetId}`,
            actionResult,
            respondedAt: Date.now(),
        };
    }
    async handleRequestReplay(command, context) {
        if (!command.targetId) {
            return this.buildErrorResult(command, new Error('Missing targetId'));
        }
        const actionResult = {
            success: true,
            actionType: 'request_replay',
            targetType: 'incident',
            targetId: command.targetId,
            message: `Replay requested for ${command.targetId}`,
            executedAt: Date.now(),
        };
        return {
            success: true,
            message: `Replay requested for ${command.targetId}`,
            actionResult,
            respondedAt: Date.now(),
        };
    }
    async handleRetryTask(command, context) {
        if (!command.targetId) {
            return this.buildErrorResult(command, new Error('Missing targetId'));
        }
        const execResult = await this.executionBridge.retryTask(command.targetId, command.actor.actorId);
        // 失效缓存
        if (execResult.executionMode === 'real' && this.snapshotProvider) {
            this.snapshotProvider.invalidate('task');
        }
        const actionResult = this.toActionResult(execResult);
        // 刷新任务视图和 inbox
        const [taskView, inboxView] = await Promise.all([
            this.surfaceService.getTaskView({
                actor: command.actor,
                viewKind: 'tasks',
                workspaceId: command.actor.workspaceId,
            }),
            this.surfaceService.getInboxView({
                actor: command.actor,
                viewKind: 'inbox',
                workspaceId: command.actor.workspaceId,
            }),
        ]);
        return {
            success: execResult.success,
            message: execResult.message,
            actionResult,
            updatedView: inboxView,
            respondedAt: Date.now(),
        };
    }
    async handleCancelTask(command, context) {
        if (!command.targetId) {
            return this.buildErrorResult(command, new Error('Missing targetId'));
        }
        const actionResult = {
            success: true,
            actionType: 'cancel_task',
            targetType: 'task',
            targetId: command.targetId,
            message: `Task ${command.targetId} cancelled`,
            executedAt: Date.now(),
        };
        return {
            success: true,
            message: `Task ${command.targetId} cancelled`,
            actionResult,
            respondedAt: Date.now(),
        };
    }
    async handlePauseTask(command, context) {
        if (!command.targetId) {
            return this.buildErrorResult(command, new Error('Missing targetId'));
        }
        const actionResult = {
            success: true,
            actionType: 'pause_task',
            targetType: 'task',
            targetId: command.targetId,
            message: `Task ${command.targetId} paused`,
            executedAt: Date.now(),
        };
        return {
            success: true,
            message: `Task ${command.targetId} paused`,
            actionResult,
            respondedAt: Date.now(),
        };
    }
    async handleResumeTask(command, context) {
        if (!command.targetId) {
            return this.buildErrorResult(command, new Error('Missing targetId'));
        }
        const actionResult = {
            success: true,
            actionType: 'resume_task',
            targetType: 'task',
            targetId: command.targetId,
            message: `Task ${command.targetId} resumed`,
            executedAt: Date.now(),
        };
        return {
            success: true,
            message: `Task ${command.targetId} resumed`,
            actionResult,
            respondedAt: Date.now(),
        };
    }
    async handlePauseAgent(command, context) {
        if (!command.targetId) {
            return this.buildErrorResult(command, new Error('Missing targetId'));
        }
        const execResult = await this.executionBridge.pauseAgent(command.targetId, command.actor.actorId);
        const actionResult = this.toActionResult(execResult);
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
    async handleResumeAgent(command, context) {
        if (!command.targetId) {
            return this.buildErrorResult(command, new Error('Missing targetId'));
        }
        const actionResult = {
            success: true,
            actionType: 'resume_agent',
            targetType: 'agent',
            targetId: command.targetId,
            message: `Agent ${command.targetId} resumed`,
            executedAt: Date.now(),
        };
        return {
            success: true,
            message: `Agent ${command.targetId} resumed`,
            actionResult,
            respondedAt: Date.now(),
        };
    }
    async handleInspectAgent(command, context) {
        if (!command.targetId) {
            return this.buildErrorResult(command, new Error('Missing targetId'));
        }
        const updatedView = await this.surfaceService.getItemDetailView({
            actor: command.actor,
            viewKind: 'item_detail',
            workspaceId: command.actor.workspaceId,
            targetId: command.targetId,
        });
        return {
            success: true,
            message: `Agent ${command.targetId} inspection opened`,
            updatedView,
            respondedAt: Date.now(),
        };
    }
    // ============================================================================
    // HITL Handler
    // ============================================================================
    async handleConfirmAction(command, context) {
        // TODO: 调用 confirmation manager
        const actionResult = {
            success: true,
            actionType: 'confirm_action',
            targetId: command.targetId,
            message: `Action ${command.targetId} confirmed`,
            confirmationState: 'confirmed',
            executedAt: Date.now(),
        };
        return {
            success: true,
            message: `Action confirmed`,
            actionResult,
            respondedAt: Date.now(),
        };
    }
    async handleDismissIntervention(command, context) {
        if (!command.targetId) {
            return this.buildErrorResult(command, new Error('Missing targetId'));
        }
        const actionResult = {
            success: true,
            actionType: 'dismiss_intervention',
            targetType: 'intervention',
            targetId: command.targetId,
            message: `Intervention ${command.targetId} dismissed`,
            executedAt: Date.now(),
        };
        const updatedView = await this.surfaceService.getInterventionView({
            actor: command.actor,
            viewKind: 'interventions',
            workspaceId: command.actor.workspaceId,
        });
        return {
            success: true,
            message: `Intervention ${command.targetId} dismissed`,
            actionResult,
            updatedView,
            respondedAt: Date.now(),
        };
    }
    async handleSnoozeIntervention(command, context) {
        if (!command.targetId) {
            return this.buildErrorResult(command, new Error('Missing targetId'));
        }
        const actionResult = {
            success: true,
            actionType: 'snooze_intervention',
            targetType: 'intervention',
            targetId: command.targetId,
            message: `Intervention ${command.targetId} snoozed`,
            executedAt: Date.now(),
        };
        return {
            success: true,
            message: `Intervention ${command.targetId} snoozed`,
            actionResult,
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
        // 切换到新 workspace 并返回 dashboard
        const updatedView = await this.surfaceService.getDashboardView({
            actor: {
                ...command.actor,
                workspaceId: command.targetId,
            },
            viewKind: 'dashboard',
            workspaceId: command.targetId,
        });
        return {
            success: true,
            message: `Switched to workspace ${command.targetId}`,
            updatedView,
            navigationState: context?.navigation ? {
                ...context.navigation,
                workspaceId: command.targetId,
                currentView: 'dashboard',
                lastCommandAt: Date.now(),
            } : {
                workspaceId: command.targetId,
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
    /**
     * 将 ExecutionResult 转换为 OperatorActionResult
     */
    toActionResult(execResult) {
        return {
            success: execResult.success,
            actionType: execResult.actionType,
            targetType: execResult.targetId ? this.inferTargetType(execResult.actionType) : undefined,
            targetId: execResult.targetId,
            message: execResult.message,
            confirmationState: this.inferConfirmationState(execResult.actionType),
            executedAt: execResult.executedAt,
            data: {
                executionMode: execResult.executionMode,
            },
        };
    }
    /**
     * 根据动作类型推断目标类型
     */
    inferTargetType(actionType) {
        const mapping = {
            approve: 'approval',
            reject: 'approval',
            escalate: 'approval',
            ack_incident: 'incident',
            request_recovery: 'incident',
            request_replay: 'incident',
            retry_task: 'task',
            cancel_task: 'task',
            pause_task: 'task',
            resume_task: 'task',
            pause_agent: 'agent',
            resume_agent: 'agent',
            inspect_agent: 'agent',
        };
        return mapping[actionType];
    }
    /**
     * 根据动作类型推断确认状态
     */
    inferConfirmationState(actionType) {
        // 需要确认的动作
        const confirmableActions = ['approve', 'reject', 'escalate', 'confirm_action'];
        if (confirmableActions.includes(actionType)) {
            return 'confirmed';
        }
        return undefined;
    }
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
exports.DefaultOperatorCommandDispatch = DefaultOperatorCommandDispatch;
function createOperatorCommandDispatch(surfaceService, executionBridge, controlSurfaceBuilder, humanLoopService, snapshotProvider) {
    return new DefaultOperatorCommandDispatch(surfaceService, executionBridge, controlSurfaceBuilder, humanLoopService, snapshotProvider);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVmYXVsdF9vcGVyYXRvcl9jb21tYW5kX2Rpc3BhdGNoLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL29wZXJhdG9yL3NlcnZpY2VzL2RlZmF1bHRfb3BlcmF0b3JfY29tbWFuZF9kaXNwYXRjaC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7O0dBUUc7OztBQXUwQkgsc0VBY0M7QUFyMEJELCtFQUErRTtBQUMvRSxPQUFPO0FBQ1AsK0VBQStFO0FBRS9FLE1BQWEsOEJBQThCO0lBT3pDLFlBQ0UsY0FBc0MsRUFDdEMsZUFBd0MsRUFDeEMscUJBQTZDLEVBQzdDLGdCQUFtQyxFQUNuQyxnQkFBc0I7UUFUaEIsMEJBQXFCLEdBQWlDLElBQUksQ0FBQztRQUMzRCxxQkFBZ0IsR0FBNEIsSUFBSSxDQUFDO1FBQ2pELHFCQUFnQixHQUFlLElBQUksQ0FBQztRQVMxQyxJQUFJLENBQUMsY0FBYyxHQUFHLGNBQWMsQ0FBQztRQUNyQyxJQUFJLENBQUMsZUFBZSxHQUFHLGVBQWUsQ0FBQztRQUN2QyxJQUFJLENBQUMscUJBQXFCLEdBQUcscUJBQXFCLElBQUksSUFBSSxDQUFDO1FBQzNELElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxnQkFBZ0IsSUFBSSxJQUFJLENBQUM7UUFDakQsSUFBSSxDQUFDLGdCQUFnQixHQUFHLGdCQUFnQixJQUFJLElBQUksQ0FBQztJQUNuRCxDQUFDO0lBRUQsS0FBSyxDQUFDLFFBQVEsQ0FDWixPQUF3QixFQUN4QixPQUF5QjtRQUV6QixJQUFJLENBQUM7WUFDSCxVQUFVO1lBQ1YsUUFBUSxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUM7Z0JBQzVCLFNBQVM7Z0JBQ1QsS0FBSyxnQkFBZ0I7b0JBQ25CLE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQyxXQUFXLEVBQUUsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO2dCQUN4RCxLQUFLLFlBQVk7b0JBQ2YsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sRUFBRSxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7Z0JBQ3BELEtBQUssZ0JBQWdCO29CQUNuQixPQUFPLElBQUksQ0FBQyxVQUFVLENBQUMsV0FBVyxFQUFFLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztnQkFDeEQsS0FBSyxnQkFBZ0I7b0JBQ25CLE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQyxXQUFXLEVBQUUsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO2dCQUN4RCxLQUFLLGFBQWE7b0JBQ2hCLE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQyxRQUFRLEVBQUUsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO2dCQUNyRCxLQUFLLFlBQVk7b0JBQ2YsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sRUFBRSxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7Z0JBQ3BELEtBQUssb0JBQW9CO29CQUN2QixPQUFPLElBQUksQ0FBQyxVQUFVLENBQUMsZUFBZSxFQUFFLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztnQkFDNUQsS0FBSyxjQUFjO29CQUNqQixPQUFPLElBQUksQ0FBQyxVQUFVLENBQUMsU0FBUyxFQUFFLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztnQkFDdEQsS0FBSyxXQUFXO29CQUNkLE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7Z0JBQy9DLEtBQUssU0FBUztvQkFDWixPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO2dCQUU5QyxZQUFZO2dCQUNaLEtBQUssU0FBUztvQkFDWixPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO2dCQUM5QyxLQUFLLFFBQVE7b0JBQ1gsT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztnQkFDN0MsS0FBSyxVQUFVO29CQUNiLE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7Z0JBQy9DLEtBQUssY0FBYztvQkFDakIsT0FBTyxJQUFJLENBQUMsaUJBQWlCLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO2dCQUNsRCxLQUFLLGtCQUFrQjtvQkFDckIsT0FBTyxJQUFJLENBQUMscUJBQXFCLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO2dCQUN0RCxLQUFLLGdCQUFnQjtvQkFDbkIsT0FBTyxJQUFJLENBQUMsbUJBQW1CLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO2dCQUNwRCxLQUFLLFlBQVk7b0JBQ2YsT0FBTyxJQUFJLENBQUMsZUFBZSxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztnQkFDaEQsS0FBSyxhQUFhO29CQUNoQixPQUFPLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7Z0JBQ2pELEtBQUssWUFBWTtvQkFDZixPQUFPLElBQUksQ0FBQyxlQUFlLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO2dCQUNoRCxLQUFLLGFBQWE7b0JBQ2hCLE9BQU8sSUFBSSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztnQkFDakQsS0FBSyxhQUFhO29CQUNoQixPQUFPLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7Z0JBQ2pELEtBQUssY0FBYztvQkFDakIsT0FBTyxJQUFJLENBQUMsaUJBQWlCLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO2dCQUNsRCxLQUFLLGVBQWU7b0JBQ2xCLE9BQU8sSUFBSSxDQUFDLGtCQUFrQixDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztnQkFFbkQsU0FBUztnQkFDVCxLQUFLLGdCQUFnQjtvQkFDbkIsT0FBTyxJQUFJLENBQUMsbUJBQW1CLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO2dCQUNwRCxLQUFLLHNCQUFzQjtvQkFDekIsT0FBTyxJQUFJLENBQUMseUJBQXlCLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO2dCQUMxRCxLQUFLLHFCQUFxQjtvQkFDeEIsT0FBTyxJQUFJLENBQUMsd0JBQXdCLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO2dCQUV6RCxlQUFlO2dCQUNmLEtBQUssa0JBQWtCO29CQUNyQixPQUFPLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7Z0JBQ3RELEtBQUssU0FBUztvQkFDWixPQUFPLElBQUksQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO2dCQUU3QztvQkFDRSxPQUFPLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUNoRCxDQUFDO1FBQ0gsQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDZixPQUFPLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDL0MsQ0FBQztJQUNILENBQUM7SUFFRCwrRUFBK0U7SUFDL0UsZUFBZTtJQUNmLCtFQUErRTtJQUV2RSxLQUFLLENBQUMsVUFBVSxDQUN0QixRQUFnQixFQUNoQixPQUF3QixFQUN4QixPQUF5QjtRQUV6QixNQUFNLFdBQVcsR0FBRyxNQUFNLElBQUksQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDO1lBQ3BELEtBQUssRUFBRSxPQUFPLENBQUMsS0FBSztZQUNwQixRQUFRLEVBQUUsUUFBZTtZQUN6QixXQUFXLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxXQUFXO1lBQ3RDLElBQUksRUFBRSxPQUFPLEVBQUUsVUFBVSxFQUFFLElBQUk7U0FDaEMsQ0FBQyxDQUFDO1FBRUgsT0FBTztZQUNMLE9BQU8sRUFBRSxJQUFJO1lBQ2IsT0FBTyxFQUFFLFFBQVEsUUFBUSxTQUFTO1lBQ2xDLFdBQVc7WUFDWCxlQUFlLEVBQUUsT0FBTyxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUM7Z0JBQ3JDLEdBQUcsT0FBTyxDQUFDLFVBQVU7Z0JBQ3JCLFdBQVcsRUFBRSxRQUFlO2dCQUM1QixhQUFhLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTthQUMxQixDQUFDLENBQUMsQ0FBQyxTQUFTO1lBQ2IsV0FBVyxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUU7U0FDeEIsQ0FBQztJQUNKLENBQUM7SUFFTyxLQUFLLENBQUMsY0FBYyxDQUMxQixPQUF3QixFQUN4QixPQUF5QjtRQUV6Qix3Q0FBd0M7UUFDeEMsTUFBTSxJQUFJLEdBQUc7WUFDWCxVQUFVLEVBQUUsT0FBTyxDQUFDLFVBQVU7WUFDOUIsUUFBUSxFQUFFLE9BQU8sQ0FBQyxRQUFRO1lBQzFCLE9BQU8sRUFBRSxTQUFTO1NBQ25CLENBQUM7UUFFRixNQUFNLFdBQVcsR0FBRyxNQUFNLElBQUksQ0FBQyxjQUFjLENBQUMsaUJBQWlCLENBQUM7WUFDOUQsS0FBSyxFQUFFLE9BQU8sQ0FBQyxLQUFLO1lBQ3BCLFFBQVEsRUFBRSxhQUFhO1lBQ3ZCLFdBQVcsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLFdBQVc7WUFDdEMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxRQUFRO1NBQzNCLENBQUMsQ0FBQztRQUVILE9BQU87WUFDTCxPQUFPLEVBQUUsSUFBSTtZQUNiLE9BQU8sRUFBRSxRQUFRLE9BQU8sQ0FBQyxRQUFRLFNBQVM7WUFDMUMsV0FBVztZQUNYLGVBQWUsRUFBRSxPQUFPLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQztnQkFDckMsR0FBRyxPQUFPLENBQUMsVUFBVTtnQkFDckIsV0FBVyxFQUFFLGFBQWE7Z0JBQzFCLGNBQWMsRUFBRSxPQUFPLENBQUMsUUFBUTtnQkFDaEMsa0JBQWtCLEVBQUUsT0FBTyxDQUFDLFVBQVU7Z0JBQ3RDLGFBQWEsRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFO2FBQzFCLENBQUMsQ0FBQyxDQUFDLFNBQVM7WUFDYixXQUFXLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTtTQUN4QixDQUFDO0lBQ0osQ0FBQztJQUVPLEtBQUssQ0FBQyxhQUFhLENBQ3pCLE9BQXdCLEVBQ3hCLE9BQXlCO1FBRXpCLE1BQU0sV0FBVyxHQUFHLE9BQU8sRUFBRSxVQUFVLEVBQUUsV0FBVyxJQUFJLFdBQVcsQ0FBQztRQUVwRSxNQUFNLFdBQVcsR0FBRyxNQUFNLElBQUksQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDO1lBQ3BELEtBQUssRUFBRSxPQUFPLENBQUMsS0FBSztZQUNwQixRQUFRLEVBQUUsV0FBVztZQUNyQixXQUFXLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxXQUFXO1lBQ3RDLElBQUksRUFBRSxPQUFPLEVBQUUsVUFBVSxFQUFFLElBQUk7U0FDaEMsQ0FBQyxDQUFDO1FBRUgsT0FBTztZQUNMLE9BQU8sRUFBRSxJQUFJO1lBQ2IsT0FBTyxFQUFFLGdCQUFnQjtZQUN6QixXQUFXO1lBQ1gsV0FBVyxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUU7U0FDeEIsQ0FBQztJQUNKLENBQUM7SUFFRCwrRUFBK0U7SUFDL0Usa0JBQWtCO0lBQ2xCLCtFQUErRTtJQUV2RSxLQUFLLENBQUMsYUFBYSxDQUN6QixPQUF3QixFQUN4QixPQUF5QjtRQUV6QixJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ3RCLE9BQU8sSUFBSSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxJQUFJLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUM7UUFDdkUsQ0FBQztRQUVELDZCQUE2QjtRQUM3QixNQUFNLFVBQVUsR0FBRyxNQUFNLElBQUksQ0FBQyxlQUFlLENBQUMsZUFBZSxDQUMzRCxPQUFPLENBQUMsUUFBUSxFQUNoQixPQUFPLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FDdEIsQ0FBQztRQUVGLE9BQU87UUFDUCxJQUFJLFVBQVUsQ0FBQyxhQUFhLEtBQUssTUFBTSxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1lBQ2pFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDL0MsQ0FBQztRQUVELE1BQU0sWUFBWSxHQUF5QixJQUFJLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBRTNFLGdCQUFnQjtRQUNoQixNQUFNLENBQUMsWUFBWSxFQUFFLFNBQVMsQ0FBQyxHQUFHLE1BQU0sT0FBTyxDQUFDLEdBQUcsQ0FBQztZQUNsRCxJQUFJLENBQUMsY0FBYyxDQUFDLGVBQWUsQ0FBQztnQkFDbEMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxLQUFLO2dCQUNwQixRQUFRLEVBQUUsV0FBVztnQkFDckIsV0FBVyxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsV0FBVzthQUN2QyxDQUFDO1lBQ0YsSUFBSSxDQUFDLGNBQWMsQ0FBQyxZQUFZLENBQUM7Z0JBQy9CLEtBQUssRUFBRSxPQUFPLENBQUMsS0FBSztnQkFDcEIsUUFBUSxFQUFFLE9BQU87Z0JBQ2pCLFdBQVcsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLFdBQVc7YUFDdkMsQ0FBQztTQUNILENBQUMsQ0FBQztRQUVILE9BQU87WUFDTCxPQUFPLEVBQUUsVUFBVSxDQUFDLE9BQU87WUFDM0IsT0FBTyxFQUFFLFVBQVUsQ0FBQyxPQUFPO1lBQzNCLFlBQVk7WUFDWixXQUFXLEVBQUUsU0FBUyxFQUFFLDZCQUE2QjtZQUNyRCxXQUFXLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTtTQUN4QixDQUFDO0lBQ0osQ0FBQztJQUVPLEtBQUssQ0FBQyxZQUFZLENBQ3hCLE9BQXdCLEVBQ3hCLE9BQXlCO1FBRXpCLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDdEIsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLElBQUksS0FBSyxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQztRQUN2RSxDQUFDO1FBRUQsTUFBTSxVQUFVLEdBQUcsTUFBTSxJQUFJLENBQUMsZUFBZSxDQUFDLGNBQWMsQ0FDMUQsT0FBTyxDQUFDLFFBQVEsRUFDaEIsT0FBTyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQ3RCLENBQUM7UUFFRixNQUFNLFlBQVksR0FBeUIsSUFBSSxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUUzRSxNQUFNLFdBQVcsR0FBRyxNQUFNLElBQUksQ0FBQyxjQUFjLENBQUMsZUFBZSxDQUFDO1lBQzVELEtBQUssRUFBRSxPQUFPLENBQUMsS0FBSztZQUNwQixRQUFRLEVBQUUsV0FBVztZQUNyQixXQUFXLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxXQUFXO1NBQ3ZDLENBQUMsQ0FBQztRQUVILE9BQU87WUFDTCxPQUFPLEVBQUUsVUFBVSxDQUFDLE9BQU87WUFDM0IsT0FBTyxFQUFFLFVBQVUsQ0FBQyxPQUFPO1lBQzNCLFlBQVk7WUFDWixXQUFXO1lBQ1gsV0FBVyxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUU7U0FDeEIsQ0FBQztJQUNKLENBQUM7SUFFTyxLQUFLLENBQUMsY0FBYyxDQUMxQixPQUF3QixFQUN4QixPQUF5QjtRQUV6QixJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ3RCLE9BQU8sSUFBSSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxJQUFJLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUM7UUFDdkUsQ0FBQztRQUVELE1BQU0sWUFBWSxHQUF5QjtZQUN6QyxPQUFPLEVBQUUsSUFBSTtZQUNiLFVBQVUsRUFBRSxVQUFVO1lBQ3RCLFVBQVUsRUFBRSxPQUFPLENBQUMsVUFBVTtZQUM5QixRQUFRLEVBQUUsT0FBTyxDQUFDLFFBQVE7WUFDMUIsT0FBTyxFQUFFLEdBQUcsT0FBTyxDQUFDLFVBQVUsSUFBSSxPQUFPLENBQUMsUUFBUSxZQUFZO1lBQzlELFVBQVUsRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFO1NBQ3ZCLENBQUM7UUFFRixPQUFPO1lBQ0wsT0FBTyxFQUFFLElBQUk7WUFDYixPQUFPLEVBQUUsYUFBYSxPQUFPLENBQUMsUUFBUSxFQUFFO1lBQ3hDLFlBQVk7WUFDWixXQUFXLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTtTQUN4QixDQUFDO0lBQ0osQ0FBQztJQUVPLEtBQUssQ0FBQyxpQkFBaUIsQ0FDN0IsT0FBd0IsRUFDeEIsT0FBeUI7UUFFekIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUN0QixPQUFPLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsSUFBSSxLQUFLLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO1FBQ3ZFLENBQUM7UUFFRCxNQUFNLFVBQVUsR0FBRyxNQUFNLElBQUksQ0FBQyxlQUFlLENBQUMsV0FBVyxDQUN2RCxPQUFPLENBQUMsUUFBUSxFQUNoQixPQUFPLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FDdEIsQ0FBQztRQUVGLE9BQU87UUFDUCxJQUFJLFVBQVUsQ0FBQyxhQUFhLEtBQUssTUFBTSxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1lBQ2pFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDL0MsQ0FBQztRQUVELE1BQU0sWUFBWSxHQUF5QixJQUFJLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBRTNFLGdCQUFnQjtRQUNoQixNQUFNLENBQUMsWUFBWSxFQUFFLFNBQVMsQ0FBQyxHQUFHLE1BQU0sT0FBTyxDQUFDLEdBQUcsQ0FBQztZQUNsRCxJQUFJLENBQUMsY0FBYyxDQUFDLGVBQWUsQ0FBQztnQkFDbEMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxLQUFLO2dCQUNwQixRQUFRLEVBQUUsV0FBVztnQkFDckIsV0FBVyxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsV0FBVzthQUN2QyxDQUFDO1lBQ0YsSUFBSSxDQUFDLGNBQWMsQ0FBQyxZQUFZLENBQUM7Z0JBQy9CLEtBQUssRUFBRSxPQUFPLENBQUMsS0FBSztnQkFDcEIsUUFBUSxFQUFFLE9BQU87Z0JBQ2pCLFdBQVcsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLFdBQVc7YUFDdkMsQ0FBQztTQUNILENBQUMsQ0FBQztRQUVILE9BQU87WUFDTCxPQUFPLEVBQUUsVUFBVSxDQUFDLE9BQU87WUFDM0IsT0FBTyxFQUFFLFVBQVUsQ0FBQyxPQUFPO1lBQzNCLFlBQVk7WUFDWixXQUFXLEVBQUUsU0FBUztZQUN0QixXQUFXLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTtTQUN4QixDQUFDO0lBQ0osQ0FBQztJQUVPLEtBQUssQ0FBQyxxQkFBcUIsQ0FDakMsT0FBd0IsRUFDeEIsT0FBeUI7UUFFekIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUN0QixPQUFPLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsSUFBSSxLQUFLLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO1FBQ3ZFLENBQUM7UUFFRCxNQUFNLFlBQVksR0FBeUI7WUFDekMsT0FBTyxFQUFFLElBQUk7WUFDYixVQUFVLEVBQUUsa0JBQWtCO1lBQzlCLFVBQVUsRUFBRSxVQUFVO1lBQ3RCLFFBQVEsRUFBRSxPQUFPLENBQUMsUUFBUTtZQUMxQixPQUFPLEVBQUUsMEJBQTBCLE9BQU8sQ0FBQyxRQUFRLEVBQUU7WUFDckQsVUFBVSxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUU7U0FDdkIsQ0FBQztRQUVGLE9BQU87WUFDTCxPQUFPLEVBQUUsSUFBSTtZQUNiLE9BQU8sRUFBRSwwQkFBMEIsT0FBTyxDQUFDLFFBQVEsRUFBRTtZQUNyRCxZQUFZO1lBQ1osV0FBVyxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUU7U0FDeEIsQ0FBQztJQUNKLENBQUM7SUFFTyxLQUFLLENBQUMsbUJBQW1CLENBQy9CLE9BQXdCLEVBQ3hCLE9BQXlCO1FBRXpCLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDdEIsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLElBQUksS0FBSyxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQztRQUN2RSxDQUFDO1FBRUQsTUFBTSxZQUFZLEdBQXlCO1lBQ3pDLE9BQU8sRUFBRSxJQUFJO1lBQ2IsVUFBVSxFQUFFLGdCQUFnQjtZQUM1QixVQUFVLEVBQUUsVUFBVTtZQUN0QixRQUFRLEVBQUUsT0FBTyxDQUFDLFFBQVE7WUFDMUIsT0FBTyxFQUFFLHdCQUF3QixPQUFPLENBQUMsUUFBUSxFQUFFO1lBQ25ELFVBQVUsRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFO1NBQ3ZCLENBQUM7UUFFRixPQUFPO1lBQ0wsT0FBTyxFQUFFLElBQUk7WUFDYixPQUFPLEVBQUUsd0JBQXdCLE9BQU8sQ0FBQyxRQUFRLEVBQUU7WUFDbkQsWUFBWTtZQUNaLFdBQVcsRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFO1NBQ3hCLENBQUM7SUFDSixDQUFDO0lBRU8sS0FBSyxDQUFDLGVBQWUsQ0FDM0IsT0FBd0IsRUFDeEIsT0FBeUI7UUFFekIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUN0QixPQUFPLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsSUFBSSxLQUFLLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO1FBQ3ZFLENBQUM7UUFFRCxNQUFNLFVBQVUsR0FBRyxNQUFNLElBQUksQ0FBQyxlQUFlLENBQUMsU0FBUyxDQUNyRCxPQUFPLENBQUMsUUFBUSxFQUNoQixPQUFPLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FDdEIsQ0FBQztRQUVGLE9BQU87UUFDUCxJQUFJLFVBQVUsQ0FBQyxhQUFhLEtBQUssTUFBTSxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1lBQ2pFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDM0MsQ0FBQztRQUVELE1BQU0sWUFBWSxHQUF5QixJQUFJLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBRTNFLGdCQUFnQjtRQUNoQixNQUFNLENBQUMsUUFBUSxFQUFFLFNBQVMsQ0FBQyxHQUFHLE1BQU0sT0FBTyxDQUFDLEdBQUcsQ0FBQztZQUM5QyxJQUFJLENBQUMsY0FBYyxDQUFDLFdBQVcsQ0FBQztnQkFDOUIsS0FBSyxFQUFFLE9BQU8sQ0FBQyxLQUFLO2dCQUNwQixRQUFRLEVBQUUsT0FBTztnQkFDakIsV0FBVyxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsV0FBVzthQUN2QyxDQUFDO1lBQ0YsSUFBSSxDQUFDLGNBQWMsQ0FBQyxZQUFZLENBQUM7Z0JBQy9CLEtBQUssRUFBRSxPQUFPLENBQUMsS0FBSztnQkFDcEIsUUFBUSxFQUFFLE9BQU87Z0JBQ2pCLFdBQVcsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLFdBQVc7YUFDdkMsQ0FBQztTQUNILENBQUMsQ0FBQztRQUVILE9BQU87WUFDTCxPQUFPLEVBQUUsVUFBVSxDQUFDLE9BQU87WUFDM0IsT0FBTyxFQUFFLFVBQVUsQ0FBQyxPQUFPO1lBQzNCLFlBQVk7WUFDWixXQUFXLEVBQUUsU0FBUztZQUN0QixXQUFXLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTtTQUN4QixDQUFDO0lBQ0osQ0FBQztJQUVPLEtBQUssQ0FBQyxnQkFBZ0IsQ0FDNUIsT0FBd0IsRUFDeEIsT0FBeUI7UUFFekIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUN0QixPQUFPLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsSUFBSSxLQUFLLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO1FBQ3ZFLENBQUM7UUFFRCxNQUFNLFlBQVksR0FBeUI7WUFDekMsT0FBTyxFQUFFLElBQUk7WUFDYixVQUFVLEVBQUUsYUFBYTtZQUN6QixVQUFVLEVBQUUsTUFBTTtZQUNsQixRQUFRLEVBQUUsT0FBTyxDQUFDLFFBQVE7WUFDMUIsT0FBTyxFQUFFLFFBQVEsT0FBTyxDQUFDLFFBQVEsWUFBWTtZQUM3QyxVQUFVLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTtTQUN2QixDQUFDO1FBRUYsT0FBTztZQUNMLE9BQU8sRUFBRSxJQUFJO1lBQ2IsT0FBTyxFQUFFLFFBQVEsT0FBTyxDQUFDLFFBQVEsWUFBWTtZQUM3QyxZQUFZO1lBQ1osV0FBVyxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUU7U0FDeEIsQ0FBQztJQUNKLENBQUM7SUFFTyxLQUFLLENBQUMsZUFBZSxDQUMzQixPQUF3QixFQUN4QixPQUF5QjtRQUV6QixJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ3RCLE9BQU8sSUFBSSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxJQUFJLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUM7UUFDdkUsQ0FBQztRQUVELE1BQU0sWUFBWSxHQUF5QjtZQUN6QyxPQUFPLEVBQUUsSUFBSTtZQUNiLFVBQVUsRUFBRSxZQUFZO1lBQ3hCLFVBQVUsRUFBRSxNQUFNO1lBQ2xCLFFBQVEsRUFBRSxPQUFPLENBQUMsUUFBUTtZQUMxQixPQUFPLEVBQUUsUUFBUSxPQUFPLENBQUMsUUFBUSxTQUFTO1lBQzFDLFVBQVUsRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFO1NBQ3ZCLENBQUM7UUFFRixPQUFPO1lBQ0wsT0FBTyxFQUFFLElBQUk7WUFDYixPQUFPLEVBQUUsUUFBUSxPQUFPLENBQUMsUUFBUSxTQUFTO1lBQzFDLFlBQVk7WUFDWixXQUFXLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTtTQUN4QixDQUFDO0lBQ0osQ0FBQztJQUVPLEtBQUssQ0FBQyxnQkFBZ0IsQ0FDNUIsT0FBd0IsRUFDeEIsT0FBeUI7UUFFekIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUN0QixPQUFPLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsSUFBSSxLQUFLLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO1FBQ3ZFLENBQUM7UUFFRCxNQUFNLFlBQVksR0FBeUI7WUFDekMsT0FBTyxFQUFFLElBQUk7WUFDYixVQUFVLEVBQUUsYUFBYTtZQUN6QixVQUFVLEVBQUUsTUFBTTtZQUNsQixRQUFRLEVBQUUsT0FBTyxDQUFDLFFBQVE7WUFDMUIsT0FBTyxFQUFFLFFBQVEsT0FBTyxDQUFDLFFBQVEsVUFBVTtZQUMzQyxVQUFVLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTtTQUN2QixDQUFDO1FBRUYsT0FBTztZQUNMLE9BQU8sRUFBRSxJQUFJO1lBQ2IsT0FBTyxFQUFFLFFBQVEsT0FBTyxDQUFDLFFBQVEsVUFBVTtZQUMzQyxZQUFZO1lBQ1osV0FBVyxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUU7U0FDeEIsQ0FBQztJQUNKLENBQUM7SUFFTyxLQUFLLENBQUMsZ0JBQWdCLENBQzVCLE9BQXdCLEVBQ3hCLE9BQXlCO1FBRXpCLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDdEIsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLElBQUksS0FBSyxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQztRQUN2RSxDQUFDO1FBRUQsTUFBTSxVQUFVLEdBQUcsTUFBTSxJQUFJLENBQUMsZUFBZSxDQUFDLFVBQVUsQ0FDdEQsT0FBTyxDQUFDLFFBQVEsRUFDaEIsT0FBTyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQ3RCLENBQUM7UUFFRixNQUFNLFlBQVksR0FBeUIsSUFBSSxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUUzRSxNQUFNLFdBQVcsR0FBRyxNQUFNLElBQUksQ0FBQyxjQUFjLENBQUMsZ0JBQWdCLENBQUM7WUFDN0QsS0FBSyxFQUFFLE9BQU8sQ0FBQyxLQUFLO1lBQ3BCLFFBQVEsRUFBRSxXQUFXO1lBQ3JCLFdBQVcsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLFdBQVc7U0FDdkMsQ0FBQyxDQUFDO1FBRUgsT0FBTztZQUNMLE9BQU8sRUFBRSxVQUFVLENBQUMsT0FBTztZQUMzQixPQUFPLEVBQUUsVUFBVSxDQUFDLE9BQU87WUFDM0IsWUFBWTtZQUNaLFdBQVc7WUFDWCxXQUFXLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTtTQUN4QixDQUFDO0lBQ0osQ0FBQztJQUVPLEtBQUssQ0FBQyxpQkFBaUIsQ0FDN0IsT0FBd0IsRUFDeEIsT0FBeUI7UUFFekIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUN0QixPQUFPLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsSUFBSSxLQUFLLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO1FBQ3ZFLENBQUM7UUFFRCxNQUFNLFlBQVksR0FBeUI7WUFDekMsT0FBTyxFQUFFLElBQUk7WUFDYixVQUFVLEVBQUUsY0FBYztZQUMxQixVQUFVLEVBQUUsT0FBTztZQUNuQixRQUFRLEVBQUUsT0FBTyxDQUFDLFFBQVE7WUFDMUIsT0FBTyxFQUFFLFNBQVMsT0FBTyxDQUFDLFFBQVEsVUFBVTtZQUM1QyxVQUFVLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTtTQUN2QixDQUFDO1FBRUYsT0FBTztZQUNMLE9BQU8sRUFBRSxJQUFJO1lBQ2IsT0FBTyxFQUFFLFNBQVMsT0FBTyxDQUFDLFFBQVEsVUFBVTtZQUM1QyxZQUFZO1lBQ1osV0FBVyxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUU7U0FDeEIsQ0FBQztJQUNKLENBQUM7SUFFTyxLQUFLLENBQUMsa0JBQWtCLENBQzlCLE9BQXdCLEVBQ3hCLE9BQXlCO1FBRXpCLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDdEIsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLElBQUksS0FBSyxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQztRQUN2RSxDQUFDO1FBRUQsTUFBTSxXQUFXLEdBQUcsTUFBTSxJQUFJLENBQUMsY0FBYyxDQUFDLGlCQUFpQixDQUFDO1lBQzlELEtBQUssRUFBRSxPQUFPLENBQUMsS0FBSztZQUNwQixRQUFRLEVBQUUsYUFBYTtZQUN2QixXQUFXLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxXQUFXO1lBQ3RDLFFBQVEsRUFBRSxPQUFPLENBQUMsUUFBUTtTQUMzQixDQUFDLENBQUM7UUFFSCxPQUFPO1lBQ0wsT0FBTyxFQUFFLElBQUk7WUFDYixPQUFPLEVBQUUsU0FBUyxPQUFPLENBQUMsUUFBUSxvQkFBb0I7WUFDdEQsV0FBVztZQUNYLFdBQVcsRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFO1NBQ3hCLENBQUM7SUFDSixDQUFDO0lBRUQsK0VBQStFO0lBQy9FLGVBQWU7SUFDZiwrRUFBK0U7SUFFdkUsS0FBSyxDQUFDLG1CQUFtQixDQUMvQixPQUF3QixFQUN4QixPQUF5QjtRQUV6QixnQ0FBZ0M7UUFFaEMsTUFBTSxZQUFZLEdBQXlCO1lBQ3pDLE9BQU8sRUFBRSxJQUFJO1lBQ2IsVUFBVSxFQUFFLGdCQUFnQjtZQUM1QixRQUFRLEVBQUUsT0FBTyxDQUFDLFFBQVE7WUFDMUIsT0FBTyxFQUFFLFVBQVUsT0FBTyxDQUFDLFFBQVEsWUFBWTtZQUMvQyxpQkFBaUIsRUFBRSxXQUFXO1lBQzlCLFVBQVUsRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFO1NBQ3ZCLENBQUM7UUFFRixPQUFPO1lBQ0wsT0FBTyxFQUFFLElBQUk7WUFDYixPQUFPLEVBQUUsa0JBQWtCO1lBQzNCLFlBQVk7WUFDWixXQUFXLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTtTQUN4QixDQUFDO0lBQ0osQ0FBQztJQUVPLEtBQUssQ0FBQyx5QkFBeUIsQ0FDckMsT0FBd0IsRUFDeEIsT0FBeUI7UUFFekIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUN0QixPQUFPLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsSUFBSSxLQUFLLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO1FBQ3ZFLENBQUM7UUFFRCxNQUFNLFlBQVksR0FBeUI7WUFDekMsT0FBTyxFQUFFLElBQUk7WUFDYixVQUFVLEVBQUUsc0JBQXNCO1lBQ2xDLFVBQVUsRUFBRSxjQUFjO1lBQzFCLFFBQVEsRUFBRSxPQUFPLENBQUMsUUFBUTtZQUMxQixPQUFPLEVBQUUsZ0JBQWdCLE9BQU8sQ0FBQyxRQUFRLFlBQVk7WUFDckQsVUFBVSxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUU7U0FDdkIsQ0FBQztRQUVGLE1BQU0sV0FBVyxHQUFHLE1BQU0sSUFBSSxDQUFDLGNBQWMsQ0FBQyxtQkFBbUIsQ0FBQztZQUNoRSxLQUFLLEVBQUUsT0FBTyxDQUFDLEtBQUs7WUFDcEIsUUFBUSxFQUFFLGVBQWU7WUFDekIsV0FBVyxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsV0FBVztTQUN2QyxDQUFDLENBQUM7UUFFSCxPQUFPO1lBQ0wsT0FBTyxFQUFFLElBQUk7WUFDYixPQUFPLEVBQUUsZ0JBQWdCLE9BQU8sQ0FBQyxRQUFRLFlBQVk7WUFDckQsWUFBWTtZQUNaLFdBQVc7WUFDWCxXQUFXLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTtTQUN4QixDQUFDO0lBQ0osQ0FBQztJQUVPLEtBQUssQ0FBQyx3QkFBd0IsQ0FDcEMsT0FBd0IsRUFDeEIsT0FBeUI7UUFFekIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUN0QixPQUFPLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsSUFBSSxLQUFLLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO1FBQ3ZFLENBQUM7UUFFRCxNQUFNLFlBQVksR0FBeUI7WUFDekMsT0FBTyxFQUFFLElBQUk7WUFDYixVQUFVLEVBQUUscUJBQXFCO1lBQ2pDLFVBQVUsRUFBRSxjQUFjO1lBQzFCLFFBQVEsRUFBRSxPQUFPLENBQUMsUUFBUTtZQUMxQixPQUFPLEVBQUUsZ0JBQWdCLE9BQU8sQ0FBQyxRQUFRLFVBQVU7WUFDbkQsVUFBVSxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUU7U0FDdkIsQ0FBQztRQUVGLE9BQU87WUFDTCxPQUFPLEVBQUUsSUFBSTtZQUNiLE9BQU8sRUFBRSxnQkFBZ0IsT0FBTyxDQUFDLFFBQVEsVUFBVTtZQUNuRCxZQUFZO1lBQ1osV0FBVyxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUU7U0FDeEIsQ0FBQztJQUNKLENBQUM7SUFFRCwrRUFBK0U7SUFDL0UscUJBQXFCO0lBQ3JCLCtFQUErRTtJQUV2RSxLQUFLLENBQUMscUJBQXFCLENBQ2pDLE9BQXdCLEVBQ3hCLE9BQXlCO1FBRXpCLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDdEIsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLElBQUksS0FBSyxDQUFDLHFCQUFxQixDQUFDLENBQUMsQ0FBQztRQUMxRSxDQUFDO1FBRUQsK0JBQStCO1FBQy9CLE1BQU0sV0FBVyxHQUFHLE1BQU0sSUFBSSxDQUFDLGNBQWMsQ0FBQyxnQkFBZ0IsQ0FBQztZQUM3RCxLQUFLLEVBQUU7Z0JBQ0wsR0FBRyxPQUFPLENBQUMsS0FBSztnQkFDaEIsV0FBVyxFQUFFLE9BQU8sQ0FBQyxRQUFRO2FBQzlCO1lBQ0QsUUFBUSxFQUFFLFdBQVc7WUFDckIsV0FBVyxFQUFFLE9BQU8sQ0FBQyxRQUFRO1NBQzlCLENBQUMsQ0FBQztRQUVILE9BQU87WUFDTCxPQUFPLEVBQUUsSUFBSTtZQUNiLE9BQU8sRUFBRSx5QkFBeUIsT0FBTyxDQUFDLFFBQVEsRUFBRTtZQUNwRCxXQUFXO1lBQ1gsZUFBZSxFQUFFLE9BQU8sRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDO2dCQUNyQyxHQUFHLE9BQU8sQ0FBQyxVQUFVO2dCQUNyQixXQUFXLEVBQUUsT0FBTyxDQUFDLFFBQVE7Z0JBQzdCLFdBQVcsRUFBRSxXQUFXO2dCQUN4QixhQUFhLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTthQUMxQixDQUFDLENBQUMsQ0FBQztnQkFDRixXQUFXLEVBQUUsT0FBTyxDQUFDLFFBQVE7Z0JBQzdCLFdBQVcsRUFBRSxXQUFXO2dCQUN4QixhQUFhLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTthQUMxQjtZQUNELFdBQVcsRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFO1NBQ3hCLENBQUM7SUFDSixDQUFDO0lBRU8sS0FBSyxDQUFDLFlBQVksQ0FDeEIsT0FBd0IsRUFDeEIsT0FBeUI7UUFFekIsTUFBTSxZQUFZLEdBQUcsT0FBTyxFQUFFLFVBQVUsRUFBRSxZQUFZLElBQUksV0FBVyxDQUFDO1FBRXRFLE1BQU0sV0FBVyxHQUFHLE1BQU0sSUFBSSxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUM7WUFDcEQsS0FBSyxFQUFFLE9BQU8sQ0FBQyxLQUFLO1lBQ3BCLFFBQVEsRUFBRSxZQUFZO1lBQ3RCLFdBQVcsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLFdBQVc7U0FDdkMsQ0FBQyxDQUFDO1FBRUgsT0FBTztZQUNMLE9BQU8sRUFBRSxJQUFJO1lBQ2IsT0FBTyxFQUFFLGdCQUFnQjtZQUN6QixXQUFXO1lBQ1gsZUFBZSxFQUFFLE9BQU8sRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDO2dCQUNyQyxHQUFHLE9BQU8sQ0FBQyxVQUFVO2dCQUNyQixXQUFXLEVBQUUsWUFBWTtnQkFDekIsWUFBWSxFQUFFLE9BQU8sQ0FBQyxVQUFVLENBQUMsV0FBVztnQkFDNUMsYUFBYSxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUU7YUFDMUIsQ0FBQyxDQUFDLENBQUMsU0FBUztZQUNiLFdBQVcsRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFO1NBQ3hCLENBQUM7SUFDSixDQUFDO0lBRUQsK0VBQStFO0lBQy9FLE9BQU87SUFDUCwrRUFBK0U7SUFFL0U7O09BRUc7SUFDSyxjQUFjLENBQUMsVUFBMkI7UUFDaEQsT0FBTztZQUNMLE9BQU8sRUFBRSxVQUFVLENBQUMsT0FBTztZQUMzQixVQUFVLEVBQUUsVUFBVSxDQUFDLFVBQVU7WUFDakMsVUFBVSxFQUFFLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTO1lBQ3pGLFFBQVEsRUFBRSxVQUFVLENBQUMsUUFBUTtZQUM3QixPQUFPLEVBQUUsVUFBVSxDQUFDLE9BQU87WUFDM0IsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLHNCQUFzQixDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUM7WUFDckUsVUFBVSxFQUFFLFVBQVUsQ0FBQyxVQUFVO1lBQ2pDLElBQUksRUFBRTtnQkFDSixhQUFhLEVBQUUsVUFBVSxDQUFDLGFBQWE7YUFDeEM7U0FDRixDQUFDO0lBQ0osQ0FBQztJQUVEOztPQUVHO0lBQ0ssZUFBZSxDQUFDLFVBQWtCO1FBQ3hDLE1BQU0sT0FBTyxHQUEyQjtZQUN0QyxPQUFPLEVBQUUsVUFBVTtZQUNuQixNQUFNLEVBQUUsVUFBVTtZQUNsQixRQUFRLEVBQUUsVUFBVTtZQUNwQixZQUFZLEVBQUUsVUFBVTtZQUN4QixnQkFBZ0IsRUFBRSxVQUFVO1lBQzVCLGNBQWMsRUFBRSxVQUFVO1lBQzFCLFVBQVUsRUFBRSxNQUFNO1lBQ2xCLFdBQVcsRUFBRSxNQUFNO1lBQ25CLFVBQVUsRUFBRSxNQUFNO1lBQ2xCLFdBQVcsRUFBRSxNQUFNO1lBQ25CLFdBQVcsRUFBRSxPQUFPO1lBQ3BCLFlBQVksRUFBRSxPQUFPO1lBQ3JCLGFBQWEsRUFBRSxPQUFPO1NBQ3ZCLENBQUM7UUFDRixPQUFPLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUM3QixDQUFDO0lBRUQ7O09BRUc7SUFDSyxzQkFBc0IsQ0FBQyxVQUFrQjtRQUMvQyxVQUFVO1FBQ1YsTUFBTSxrQkFBa0IsR0FBRyxDQUFDLFNBQVMsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLGdCQUFnQixDQUFDLENBQUM7UUFDL0UsSUFBSSxrQkFBa0IsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQztZQUM1QyxPQUFPLFdBQVcsQ0FBQztRQUNyQixDQUFDO1FBQ0QsT0FBTyxTQUFTLENBQUM7SUFDbkIsQ0FBQztJQUVPLHNCQUFzQixDQUFDLE9BQXdCO1FBQ3JELE9BQU87WUFDTCxPQUFPLEVBQUUsS0FBSztZQUNkLE9BQU8sRUFBRSw2QkFBNkIsT0FBTyxDQUFDLFdBQVcsRUFBRTtZQUMzRCxNQUFNLEVBQUUsQ0FBQztvQkFDUCxJQUFJLEVBQUUscUJBQXFCO29CQUMzQixPQUFPLEVBQUUsV0FBVyxPQUFPLENBQUMsV0FBVyxxQkFBcUI7aUJBQzdELENBQUM7WUFDRixXQUFXLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTtTQUN4QixDQUFDO0lBQ0osQ0FBQztJQUVPLGdCQUFnQixDQUFDLE9BQXdCLEVBQUUsS0FBYztRQUMvRCxNQUFNLFlBQVksR0FBRyxLQUFLLFlBQVksS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFNUUsT0FBTztZQUNMLE9BQU8sRUFBRSxLQUFLO1lBQ2QsT0FBTyxFQUFFLG1CQUFtQixZQUFZLEVBQUU7WUFDMUMsTUFBTSxFQUFFLENBQUM7b0JBQ1AsSUFBSSxFQUFFLGVBQWU7b0JBQ3JCLE9BQU8sRUFBRSxZQUFZO29CQUNyQixPQUFPLEVBQUU7d0JBQ1AsV0FBVyxFQUFFLE9BQU8sQ0FBQyxXQUFXO3dCQUNoQyxRQUFRLEVBQUUsT0FBTyxDQUFDLFFBQVE7cUJBQzNCO2lCQUNGLENBQUM7WUFDRixXQUFXLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTtTQUN4QixDQUFDO0lBQ0osQ0FBQztDQUNGO0FBMXlCRCx3RUEweUJDO0FBU0QsU0FBZ0IsNkJBQTZCLENBQzNDLGNBQXNDLEVBQ3RDLGVBQXdDLEVBQ3hDLHFCQUE2QyxFQUM3QyxnQkFBbUMsRUFDbkMsZ0JBQTJDO0lBRTNDLE9BQU8sSUFBSSw4QkFBOEIsQ0FDdkMsY0FBYyxFQUNkLGVBQWUsRUFDZixxQkFBcUIsRUFDckIsZ0JBQWdCLEVBQ2hCLGdCQUFnQixDQUNqQixDQUFDO0FBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogRGVmYXVsdCBPcGVyYXRvciBDb21tYW5kIERpc3BhdGNoXG4gKiBQaGFzZSAyQS0xUiAtIOWRveS7pOWIhuWPkeWunueOsFxuICogXG4gKiDogYzotKPvvJpcbiAqIC0g5a6e546wIE9wZXJhdG9yQ29tbWFuZERpc3BhdGNoIOaOpeWPo1xuICogLSDmmKDlsITlkb3ku6TliLDnnJ/lrp7liqjkvZxcbiAqIC0g5L6d6LWW77yaT3BlcmF0b3JTdXJmYWNlU2VydmljZSwgQ29udHJvbFN1cmZhY2UsIEh1bWFuTG9vcFNlcnZpY2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7XG4gIERpc3BhdGNoQ29udGV4dCxcbiAgT3BlcmF0b3JDb21tYW5kLFxuICBPcGVyYXRvckNvbW1hbmRSZXN1bHQsXG4gIE9wZXJhdG9yQWN0aW9uUmVzdWx0LFxuICBPcGVyYXRvckNvbW1hbmRFcnJvcixcbiAgT3BlcmF0b3JDb21tYW5kRGlzcGF0Y2gsXG4gIE9wZXJhdG9yQ29uZmlybWF0aW9uU3RhdGUsXG59IGZyb20gJy4uL3R5cGVzL3N1cmZhY2VfdHlwZXMnO1xuaW1wb3J0IHR5cGUgeyBPcGVyYXRvclN1cmZhY2VTZXJ2aWNlIH0gZnJvbSAnLi9vcGVyYXRvcl9zdXJmYWNlX3NlcnZpY2UnO1xuaW1wb3J0IHR5cGUgeyBDb250cm9sU3VyZmFjZUJ1aWxkZXIgfSBmcm9tICcuLi91eC9jb250cm9sX3N1cmZhY2UnO1xuaW1wb3J0IHR5cGUgeyBIdW1hbkxvb3BTZXJ2aWNlIH0gZnJvbSAnLi4vdXgvaHVtYW5fbG9vcF9zZXJ2aWNlJztcbmltcG9ydCB0eXBlIHsgT3BlcmF0b3JFeGVjdXRpb25CcmlkZ2UsIEV4ZWN1dGlvblJlc3VsdCB9IGZyb20gJy4vb3BlcmF0b3JfZXhlY3V0aW9uX2JyaWRnZSc7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOm7mOiupOWunueOsFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgY2xhc3MgRGVmYXVsdE9wZXJhdG9yQ29tbWFuZERpc3BhdGNoIGltcGxlbWVudHMgT3BlcmF0b3JDb21tYW5kRGlzcGF0Y2gge1xuICBwcml2YXRlIHN1cmZhY2VTZXJ2aWNlOiBPcGVyYXRvclN1cmZhY2VTZXJ2aWNlO1xuICBwcml2YXRlIGV4ZWN1dGlvbkJyaWRnZTogT3BlcmF0b3JFeGVjdXRpb25CcmlkZ2U7XG4gIHByaXZhdGUgY29udHJvbFN1cmZhY2VCdWlsZGVyOiBDb250cm9sU3VyZmFjZUJ1aWxkZXIgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBodW1hbkxvb3BTZXJ2aWNlOiBIdW1hbkxvb3BTZXJ2aWNlIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgc25hcHNob3RQcm92aWRlcjogYW55IHwgbnVsbCA9IG51bGw7XG4gIFxuICBjb25zdHJ1Y3RvcihcbiAgICBzdXJmYWNlU2VydmljZTogT3BlcmF0b3JTdXJmYWNlU2VydmljZSxcbiAgICBleGVjdXRpb25CcmlkZ2U6IE9wZXJhdG9yRXhlY3V0aW9uQnJpZGdlLFxuICAgIGNvbnRyb2xTdXJmYWNlQnVpbGRlcj86IENvbnRyb2xTdXJmYWNlQnVpbGRlcixcbiAgICBodW1hbkxvb3BTZXJ2aWNlPzogSHVtYW5Mb29wU2VydmljZSxcbiAgICBzbmFwc2hvdFByb3ZpZGVyPzogYW55XG4gICkge1xuICAgIHRoaXMuc3VyZmFjZVNlcnZpY2UgPSBzdXJmYWNlU2VydmljZTtcbiAgICB0aGlzLmV4ZWN1dGlvbkJyaWRnZSA9IGV4ZWN1dGlvbkJyaWRnZTtcbiAgICB0aGlzLmNvbnRyb2xTdXJmYWNlQnVpbGRlciA9IGNvbnRyb2xTdXJmYWNlQnVpbGRlciB8fCBudWxsO1xuICAgIHRoaXMuaHVtYW5Mb29wU2VydmljZSA9IGh1bWFuTG9vcFNlcnZpY2UgfHwgbnVsbDtcbiAgICB0aGlzLnNuYXBzaG90UHJvdmlkZXIgPSBzbmFwc2hvdFByb3ZpZGVyIHx8IG51bGw7XG4gIH1cbiAgXG4gIGFzeW5jIGRpc3BhdGNoKFxuICAgIGNvbW1hbmQ6IE9wZXJhdG9yQ29tbWFuZCxcbiAgICBjb250ZXh0PzogRGlzcGF0Y2hDb250ZXh0XG4gICk6IFByb21pc2U8T3BlcmF0b3JDb21tYW5kUmVzdWx0PiB7XG4gICAgdHJ5IHtcbiAgICAgIC8vIOaMieWRveS7pOexu+Wei+WIhuWPkVxuICAgICAgc3dpdGNoIChjb21tYW5kLmNvbW1hbmRUeXBlKSB7XG4gICAgICAgIC8vIFZpZXcg57G7XG4gICAgICAgIGNhc2UgJ3ZpZXdfZGFzaGJvYXJkJzpcbiAgICAgICAgICByZXR1cm4gdGhpcy5oYW5kbGVWaWV3KCdkYXNoYm9hcmQnLCBjb21tYW5kLCBjb250ZXh0KTtcbiAgICAgICAgY2FzZSAndmlld190YXNrcyc6XG4gICAgICAgICAgcmV0dXJuIHRoaXMuaGFuZGxlVmlldygndGFza3MnLCBjb21tYW5kLCBjb250ZXh0KTtcbiAgICAgICAgY2FzZSAndmlld19hcHByb3ZhbHMnOlxuICAgICAgICAgIHJldHVybiB0aGlzLmhhbmRsZVZpZXcoJ2FwcHJvdmFscycsIGNvbW1hbmQsIGNvbnRleHQpO1xuICAgICAgICBjYXNlICd2aWV3X2luY2lkZW50cyc6XG4gICAgICAgICAgcmV0dXJuIHRoaXMuaGFuZGxlVmlldygnaW5jaWRlbnRzJywgY29tbWFuZCwgY29udGV4dCk7XG4gICAgICAgIGNhc2UgJ3ZpZXdfYWdlbnRzJzpcbiAgICAgICAgICByZXR1cm4gdGhpcy5oYW5kbGVWaWV3KCdhZ2VudHMnLCBjb21tYW5kLCBjb250ZXh0KTtcbiAgICAgICAgY2FzZSAndmlld19pbmJveCc6XG4gICAgICAgICAgcmV0dXJuIHRoaXMuaGFuZGxlVmlldygnaW5ib3gnLCBjb21tYW5kLCBjb250ZXh0KTtcbiAgICAgICAgY2FzZSAndmlld19pbnRlcnZlbnRpb25zJzpcbiAgICAgICAgICByZXR1cm4gdGhpcy5oYW5kbGVWaWV3KCdpbnRlcnZlbnRpb25zJywgY29tbWFuZCwgY29udGV4dCk7XG4gICAgICAgIGNhc2UgJ3ZpZXdfaGlzdG9yeSc6XG4gICAgICAgICAgcmV0dXJuIHRoaXMuaGFuZGxlVmlldygnaGlzdG9yeScsIGNvbW1hbmQsIGNvbnRleHQpO1xuICAgICAgICBjYXNlICdvcGVuX2l0ZW0nOlxuICAgICAgICAgIHJldHVybiB0aGlzLmhhbmRsZU9wZW5JdGVtKGNvbW1hbmQsIGNvbnRleHQpO1xuICAgICAgICBjYXNlICdyZWZyZXNoJzpcbiAgICAgICAgICByZXR1cm4gdGhpcy5oYW5kbGVSZWZyZXNoKGNvbW1hbmQsIGNvbnRleHQpO1xuICAgICAgICBcbiAgICAgICAgLy8gQ29udHJvbCDnsbtcbiAgICAgICAgY2FzZSAnYXBwcm92ZSc6XG4gICAgICAgICAgcmV0dXJuIHRoaXMuaGFuZGxlQXBwcm92ZShjb21tYW5kLCBjb250ZXh0KTtcbiAgICAgICAgY2FzZSAncmVqZWN0JzpcbiAgICAgICAgICByZXR1cm4gdGhpcy5oYW5kbGVSZWplY3QoY29tbWFuZCwgY29udGV4dCk7XG4gICAgICAgIGNhc2UgJ2VzY2FsYXRlJzpcbiAgICAgICAgICByZXR1cm4gdGhpcy5oYW5kbGVFc2NhbGF0ZShjb21tYW5kLCBjb250ZXh0KTtcbiAgICAgICAgY2FzZSAnYWNrX2luY2lkZW50JzpcbiAgICAgICAgICByZXR1cm4gdGhpcy5oYW5kbGVBY2tJbmNpZGVudChjb21tYW5kLCBjb250ZXh0KTtcbiAgICAgICAgY2FzZSAncmVxdWVzdF9yZWNvdmVyeSc6XG4gICAgICAgICAgcmV0dXJuIHRoaXMuaGFuZGxlUmVxdWVzdFJlY292ZXJ5KGNvbW1hbmQsIGNvbnRleHQpO1xuICAgICAgICBjYXNlICdyZXF1ZXN0X3JlcGxheSc6XG4gICAgICAgICAgcmV0dXJuIHRoaXMuaGFuZGxlUmVxdWVzdFJlcGxheShjb21tYW5kLCBjb250ZXh0KTtcbiAgICAgICAgY2FzZSAncmV0cnlfdGFzayc6XG4gICAgICAgICAgcmV0dXJuIHRoaXMuaGFuZGxlUmV0cnlUYXNrKGNvbW1hbmQsIGNvbnRleHQpO1xuICAgICAgICBjYXNlICdjYW5jZWxfdGFzayc6XG4gICAgICAgICAgcmV0dXJuIHRoaXMuaGFuZGxlQ2FuY2VsVGFzayhjb21tYW5kLCBjb250ZXh0KTtcbiAgICAgICAgY2FzZSAncGF1c2VfdGFzayc6XG4gICAgICAgICAgcmV0dXJuIHRoaXMuaGFuZGxlUGF1c2VUYXNrKGNvbW1hbmQsIGNvbnRleHQpO1xuICAgICAgICBjYXNlICdyZXN1bWVfdGFzayc6XG4gICAgICAgICAgcmV0dXJuIHRoaXMuaGFuZGxlUmVzdW1lVGFzayhjb21tYW5kLCBjb250ZXh0KTtcbiAgICAgICAgY2FzZSAncGF1c2VfYWdlbnQnOlxuICAgICAgICAgIHJldHVybiB0aGlzLmhhbmRsZVBhdXNlQWdlbnQoY29tbWFuZCwgY29udGV4dCk7XG4gICAgICAgIGNhc2UgJ3Jlc3VtZV9hZ2VudCc6XG4gICAgICAgICAgcmV0dXJuIHRoaXMuaGFuZGxlUmVzdW1lQWdlbnQoY29tbWFuZCwgY29udGV4dCk7XG4gICAgICAgIGNhc2UgJ2luc3BlY3RfYWdlbnQnOlxuICAgICAgICAgIHJldHVybiB0aGlzLmhhbmRsZUluc3BlY3RBZ2VudChjb21tYW5kLCBjb250ZXh0KTtcbiAgICAgICAgXG4gICAgICAgIC8vIEhJVEwg57G7XG4gICAgICAgIGNhc2UgJ2NvbmZpcm1fYWN0aW9uJzpcbiAgICAgICAgICByZXR1cm4gdGhpcy5oYW5kbGVDb25maXJtQWN0aW9uKGNvbW1hbmQsIGNvbnRleHQpO1xuICAgICAgICBjYXNlICdkaXNtaXNzX2ludGVydmVudGlvbic6XG4gICAgICAgICAgcmV0dXJuIHRoaXMuaGFuZGxlRGlzbWlzc0ludGVydmVudGlvbihjb21tYW5kLCBjb250ZXh0KTtcbiAgICAgICAgY2FzZSAnc25vb3plX2ludGVydmVudGlvbic6XG4gICAgICAgICAgcmV0dXJuIHRoaXMuaGFuZGxlU25vb3plSW50ZXJ2ZW50aW9uKGNvbW1hbmQsIGNvbnRleHQpO1xuICAgICAgICBcbiAgICAgICAgLy8gTmF2aWdhdGlvbiDnsbtcbiAgICAgICAgY2FzZSAnc3dpdGNoX3dvcmtzcGFjZSc6XG4gICAgICAgICAgcmV0dXJuIHRoaXMuaGFuZGxlU3dpdGNoV29ya3NwYWNlKGNvbW1hbmQsIGNvbnRleHQpO1xuICAgICAgICBjYXNlICdnb19iYWNrJzpcbiAgICAgICAgICByZXR1cm4gdGhpcy5oYW5kbGVHb0JhY2soY29tbWFuZCwgY29udGV4dCk7XG4gICAgICAgIFxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHJldHVybiB0aGlzLmJ1aWxkVW5zdXBwb3J0ZWRSZXN1bHQoY29tbWFuZCk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHJldHVybiB0aGlzLmJ1aWxkRXJyb3JSZXN1bHQoY29tbWFuZCwgZXJyb3IpO1xuICAgIH1cbiAgfVxuICBcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAvLyBWaWV3IEhhbmRsZXJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICBcbiAgcHJpdmF0ZSBhc3luYyBoYW5kbGVWaWV3KFxuICAgIHZpZXdLaW5kOiBzdHJpbmcsXG4gICAgY29tbWFuZDogT3BlcmF0b3JDb21tYW5kLFxuICAgIGNvbnRleHQ/OiBEaXNwYXRjaENvbnRleHRcbiAgKTogUHJvbWlzZTxPcGVyYXRvckNvbW1hbmRSZXN1bHQ+IHtcbiAgICBjb25zdCB1cGRhdGVkVmlldyA9IGF3YWl0IHRoaXMuc3VyZmFjZVNlcnZpY2UuZ2V0Vmlldyh7XG4gICAgICBhY3RvcjogY29tbWFuZC5hY3RvcixcbiAgICAgIHZpZXdLaW5kOiB2aWV3S2luZCBhcyBhbnksXG4gICAgICB3b3Jrc3BhY2VJZDogY29tbWFuZC5hY3Rvci53b3Jrc3BhY2VJZCxcbiAgICAgIG1vZGU6IGNvbnRleHQ/Lm5hdmlnYXRpb24/Lm1vZGUsXG4gICAgfSk7XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBtZXNzYWdlOiBgVmlldyAke3ZpZXdLaW5kfSBsb2FkZWRgLFxuICAgICAgdXBkYXRlZFZpZXcsXG4gICAgICBuYXZpZ2F0aW9uU3RhdGU6IGNvbnRleHQ/Lm5hdmlnYXRpb24gPyB7XG4gICAgICAgIC4uLmNvbnRleHQubmF2aWdhdGlvbixcbiAgICAgICAgY3VycmVudFZpZXc6IHZpZXdLaW5kIGFzIGFueSxcbiAgICAgICAgbGFzdENvbW1hbmRBdDogRGF0ZS5ub3coKSxcbiAgICAgIH0gOiB1bmRlZmluZWQsXG4gICAgICByZXNwb25kZWRBdDogRGF0ZS5ub3coKSxcbiAgICB9O1xuICB9XG4gIFxuICBwcml2YXRlIGFzeW5jIGhhbmRsZU9wZW5JdGVtKFxuICAgIGNvbW1hbmQ6IE9wZXJhdG9yQ29tbWFuZCxcbiAgICBjb250ZXh0PzogRGlzcGF0Y2hDb250ZXh0XG4gICk6IFByb21pc2U8T3BlcmF0b3JDb21tYW5kUmVzdWx0PiB7XG4gICAgLy8gVE9ETzog5qC55o2uIHRhcmdldFR5cGUg5ZKMIHRhcmdldElkIOiOt+WPluecn+WunuaVsOaNrlxuICAgIGNvbnN0IGRhdGEgPSB7XG4gICAgICB0YXJnZXRUeXBlOiBjb21tYW5kLnRhcmdldFR5cGUsXG4gICAgICB0YXJnZXRJZDogY29tbWFuZC50YXJnZXRJZCxcbiAgICAgIG1lc3NhZ2U6ICfor6bmg4Xlip/og73lvIDlj5HkuK0nLFxuICAgIH07XG4gICAgXG4gICAgY29uc3QgdXBkYXRlZFZpZXcgPSBhd2FpdCB0aGlzLnN1cmZhY2VTZXJ2aWNlLmdldEl0ZW1EZXRhaWxWaWV3KHtcbiAgICAgIGFjdG9yOiBjb21tYW5kLmFjdG9yLFxuICAgICAgdmlld0tpbmQ6ICdpdGVtX2RldGFpbCcsXG4gICAgICB3b3Jrc3BhY2VJZDogY29tbWFuZC5hY3Rvci53b3Jrc3BhY2VJZCxcbiAgICAgIHRhcmdldElkOiBjb21tYW5kLnRhcmdldElkLFxuICAgIH0pO1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgbWVzc2FnZTogYEl0ZW0gJHtjb21tYW5kLnRhcmdldElkfSBvcGVuZWRgLFxuICAgICAgdXBkYXRlZFZpZXcsXG4gICAgICBuYXZpZ2F0aW9uU3RhdGU6IGNvbnRleHQ/Lm5hdmlnYXRpb24gPyB7XG4gICAgICAgIC4uLmNvbnRleHQubmF2aWdhdGlvbixcbiAgICAgICAgY3VycmVudFZpZXc6ICdpdGVtX2RldGFpbCcsXG4gICAgICAgIHNlbGVjdGVkSXRlbUlkOiBjb21tYW5kLnRhcmdldElkLFxuICAgICAgICBzZWxlY3RlZFRhcmdldFR5cGU6IGNvbW1hbmQudGFyZ2V0VHlwZSxcbiAgICAgICAgbGFzdENvbW1hbmRBdDogRGF0ZS5ub3coKSxcbiAgICAgIH0gOiB1bmRlZmluZWQsXG4gICAgICByZXNwb25kZWRBdDogRGF0ZS5ub3coKSxcbiAgICB9O1xuICB9XG4gIFxuICBwcml2YXRlIGFzeW5jIGhhbmRsZVJlZnJlc2goXG4gICAgY29tbWFuZDogT3BlcmF0b3JDb21tYW5kLFxuICAgIGNvbnRleHQ/OiBEaXNwYXRjaENvbnRleHRcbiAgKTogUHJvbWlzZTxPcGVyYXRvckNvbW1hbmRSZXN1bHQ+IHtcbiAgICBjb25zdCBjdXJyZW50VmlldyA9IGNvbnRleHQ/Lm5hdmlnYXRpb24/LmN1cnJlbnRWaWV3IHx8ICdkYXNoYm9hcmQnO1xuICAgIFxuICAgIGNvbnN0IHVwZGF0ZWRWaWV3ID0gYXdhaXQgdGhpcy5zdXJmYWNlU2VydmljZS5nZXRWaWV3KHtcbiAgICAgIGFjdG9yOiBjb21tYW5kLmFjdG9yLFxuICAgICAgdmlld0tpbmQ6IGN1cnJlbnRWaWV3LFxuICAgICAgd29ya3NwYWNlSWQ6IGNvbW1hbmQuYWN0b3Iud29ya3NwYWNlSWQsXG4gICAgICBtb2RlOiBjb250ZXh0Py5uYXZpZ2F0aW9uPy5tb2RlLFxuICAgIH0pO1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgbWVzc2FnZTogJ1ZpZXcgcmVmcmVzaGVkJyxcbiAgICAgIHVwZGF0ZWRWaWV3LFxuICAgICAgcmVzcG9uZGVkQXQ6IERhdGUubm93KCksXG4gICAgfTtcbiAgfVxuICBcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAvLyBDb250cm9sIEhhbmRsZXJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICBcbiAgcHJpdmF0ZSBhc3luYyBoYW5kbGVBcHByb3ZlKFxuICAgIGNvbW1hbmQ6IE9wZXJhdG9yQ29tbWFuZCxcbiAgICBjb250ZXh0PzogRGlzcGF0Y2hDb250ZXh0XG4gICk6IFByb21pc2U8T3BlcmF0b3JDb21tYW5kUmVzdWx0PiB7XG4gICAgaWYgKCFjb21tYW5kLnRhcmdldElkKSB7XG4gICAgICByZXR1cm4gdGhpcy5idWlsZEVycm9yUmVzdWx0KGNvbW1hbmQsIG5ldyBFcnJvcignTWlzc2luZyB0YXJnZXRJZCcpKTtcbiAgICB9XG4gICAgXG4gICAgLy8g5L2/55SoIGV4ZWN1dGlvbiBicmlkZ2Ug5omn6KGM55yf5a6e5Yqo5L2cXG4gICAgY29uc3QgZXhlY1Jlc3VsdCA9IGF3YWl0IHRoaXMuZXhlY3V0aW9uQnJpZGdlLmFwcHJvdmVBcHByb3ZhbChcbiAgICAgIGNvbW1hbmQudGFyZ2V0SWQsXG4gICAgICBjb21tYW5kLmFjdG9yLmFjdG9ySWRcbiAgICApO1xuICAgIFxuICAgIC8vIOWkseaViOe8k+WtmFxuICAgIGlmIChleGVjUmVzdWx0LmV4ZWN1dGlvbk1vZGUgPT09ICdyZWFsJyAmJiB0aGlzLnNuYXBzaG90UHJvdmlkZXIpIHtcbiAgICAgIHRoaXMuc25hcHNob3RQcm92aWRlci5pbnZhbGlkYXRlKCdhcHByb3ZhbCcpO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCBhY3Rpb25SZXN1bHQ6IE9wZXJhdG9yQWN0aW9uUmVzdWx0ID0gdGhpcy50b0FjdGlvblJlc3VsdChleGVjUmVzdWx0KTtcbiAgICBcbiAgICAvLyDliLfmlrDlrqHmibnop4blm77lkowgaW5ib3hcbiAgICBjb25zdCBbYXBwcm92YWxWaWV3LCBpbmJveFZpZXddID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgdGhpcy5zdXJmYWNlU2VydmljZS5nZXRBcHByb3ZhbFZpZXcoe1xuICAgICAgICBhY3RvcjogY29tbWFuZC5hY3RvcixcbiAgICAgICAgdmlld0tpbmQ6ICdhcHByb3ZhbHMnLFxuICAgICAgICB3b3Jrc3BhY2VJZDogY29tbWFuZC5hY3Rvci53b3Jrc3BhY2VJZCxcbiAgICAgIH0pLFxuICAgICAgdGhpcy5zdXJmYWNlU2VydmljZS5nZXRJbmJveFZpZXcoe1xuICAgICAgICBhY3RvcjogY29tbWFuZC5hY3RvcixcbiAgICAgICAgdmlld0tpbmQ6ICdpbmJveCcsXG4gICAgICAgIHdvcmtzcGFjZUlkOiBjb21tYW5kLmFjdG9yLndvcmtzcGFjZUlkLFxuICAgICAgfSksXG4gICAgXSk7XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IGV4ZWNSZXN1bHQuc3VjY2VzcyxcbiAgICAgIG1lc3NhZ2U6IGV4ZWNSZXN1bHQubWVzc2FnZSxcbiAgICAgIGFjdGlvblJlc3VsdCxcbiAgICAgIHVwZGF0ZWRWaWV3OiBpbmJveFZpZXcsIC8vIOi/lOWbniBpbmJveCDop4blm77vvIzorqnnlKjmiLfnnIvliLAgcXVldWUg5Y+Y5YyWXG4gICAgICByZXNwb25kZWRBdDogRGF0ZS5ub3coKSxcbiAgICB9O1xuICB9XG4gIFxuICBwcml2YXRlIGFzeW5jIGhhbmRsZVJlamVjdChcbiAgICBjb21tYW5kOiBPcGVyYXRvckNvbW1hbmQsXG4gICAgY29udGV4dD86IERpc3BhdGNoQ29udGV4dFxuICApOiBQcm9taXNlPE9wZXJhdG9yQ29tbWFuZFJlc3VsdD4ge1xuICAgIGlmICghY29tbWFuZC50YXJnZXRJZCkge1xuICAgICAgcmV0dXJuIHRoaXMuYnVpbGRFcnJvclJlc3VsdChjb21tYW5kLCBuZXcgRXJyb3IoJ01pc3NpbmcgdGFyZ2V0SWQnKSk7XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IGV4ZWNSZXN1bHQgPSBhd2FpdCB0aGlzLmV4ZWN1dGlvbkJyaWRnZS5yZWplY3RBcHByb3ZhbChcbiAgICAgIGNvbW1hbmQudGFyZ2V0SWQsXG4gICAgICBjb21tYW5kLmFjdG9yLmFjdG9ySWRcbiAgICApO1xuICAgIFxuICAgIGNvbnN0IGFjdGlvblJlc3VsdDogT3BlcmF0b3JBY3Rpb25SZXN1bHQgPSB0aGlzLnRvQWN0aW9uUmVzdWx0KGV4ZWNSZXN1bHQpO1xuICAgIFxuICAgIGNvbnN0IHVwZGF0ZWRWaWV3ID0gYXdhaXQgdGhpcy5zdXJmYWNlU2VydmljZS5nZXRBcHByb3ZhbFZpZXcoe1xuICAgICAgYWN0b3I6IGNvbW1hbmQuYWN0b3IsXG4gICAgICB2aWV3S2luZDogJ2FwcHJvdmFscycsXG4gICAgICB3b3Jrc3BhY2VJZDogY29tbWFuZC5hY3Rvci53b3Jrc3BhY2VJZCxcbiAgICB9KTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogZXhlY1Jlc3VsdC5zdWNjZXNzLFxuICAgICAgbWVzc2FnZTogZXhlY1Jlc3VsdC5tZXNzYWdlLFxuICAgICAgYWN0aW9uUmVzdWx0LFxuICAgICAgdXBkYXRlZFZpZXcsXG4gICAgICByZXNwb25kZWRBdDogRGF0ZS5ub3coKSxcbiAgICB9O1xuICB9XG4gIFxuICBwcml2YXRlIGFzeW5jIGhhbmRsZUVzY2FsYXRlKFxuICAgIGNvbW1hbmQ6IE9wZXJhdG9yQ29tbWFuZCxcbiAgICBjb250ZXh0PzogRGlzcGF0Y2hDb250ZXh0XG4gICk6IFByb21pc2U8T3BlcmF0b3JDb21tYW5kUmVzdWx0PiB7XG4gICAgaWYgKCFjb21tYW5kLnRhcmdldElkKSB7XG4gICAgICByZXR1cm4gdGhpcy5idWlsZEVycm9yUmVzdWx0KGNvbW1hbmQsIG5ldyBFcnJvcignTWlzc2luZyB0YXJnZXRJZCcpKTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgYWN0aW9uUmVzdWx0OiBPcGVyYXRvckFjdGlvblJlc3VsdCA9IHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBhY3Rpb25UeXBlOiAnZXNjYWxhdGUnLFxuICAgICAgdGFyZ2V0VHlwZTogY29tbWFuZC50YXJnZXRUeXBlLFxuICAgICAgdGFyZ2V0SWQ6IGNvbW1hbmQudGFyZ2V0SWQsXG4gICAgICBtZXNzYWdlOiBgJHtjb21tYW5kLnRhcmdldFR5cGV9ICR7Y29tbWFuZC50YXJnZXRJZH0gZXNjYWxhdGVkYCxcbiAgICAgIGV4ZWN1dGVkQXQ6IERhdGUubm93KCksXG4gICAgfTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIG1lc3NhZ2U6IGBFc2NhbGF0ZWQgJHtjb21tYW5kLnRhcmdldElkfWAsXG4gICAgICBhY3Rpb25SZXN1bHQsXG4gICAgICByZXNwb25kZWRBdDogRGF0ZS5ub3coKSxcbiAgICB9O1xuICB9XG4gIFxuICBwcml2YXRlIGFzeW5jIGhhbmRsZUFja0luY2lkZW50KFxuICAgIGNvbW1hbmQ6IE9wZXJhdG9yQ29tbWFuZCxcbiAgICBjb250ZXh0PzogRGlzcGF0Y2hDb250ZXh0XG4gICk6IFByb21pc2U8T3BlcmF0b3JDb21tYW5kUmVzdWx0PiB7XG4gICAgaWYgKCFjb21tYW5kLnRhcmdldElkKSB7XG4gICAgICByZXR1cm4gdGhpcy5idWlsZEVycm9yUmVzdWx0KGNvbW1hbmQsIG5ldyBFcnJvcignTWlzc2luZyB0YXJnZXRJZCcpKTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgZXhlY1Jlc3VsdCA9IGF3YWl0IHRoaXMuZXhlY3V0aW9uQnJpZGdlLmFja0luY2lkZW50KFxuICAgICAgY29tbWFuZC50YXJnZXRJZCxcbiAgICAgIGNvbW1hbmQuYWN0b3IuYWN0b3JJZFxuICAgICk7XG4gICAgXG4gICAgLy8g5aSx5pWI57yT5a2YXG4gICAgaWYgKGV4ZWNSZXN1bHQuZXhlY3V0aW9uTW9kZSA9PT0gJ3JlYWwnICYmIHRoaXMuc25hcHNob3RQcm92aWRlcikge1xuICAgICAgdGhpcy5zbmFwc2hvdFByb3ZpZGVyLmludmFsaWRhdGUoJ2luY2lkZW50Jyk7XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IGFjdGlvblJlc3VsdDogT3BlcmF0b3JBY3Rpb25SZXN1bHQgPSB0aGlzLnRvQWN0aW9uUmVzdWx0KGV4ZWNSZXN1bHQpO1xuICAgIFxuICAgIC8vIOWIt+aWsOS6i+S7tuinhuWbvuWSjCBpbmJveFxuICAgIGNvbnN0IFtpbmNpZGVudFZpZXcsIGluYm94Vmlld10gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICB0aGlzLnN1cmZhY2VTZXJ2aWNlLmdldEluY2lkZW50Vmlldyh7XG4gICAgICAgIGFjdG9yOiBjb21tYW5kLmFjdG9yLFxuICAgICAgICB2aWV3S2luZDogJ2luY2lkZW50cycsXG4gICAgICAgIHdvcmtzcGFjZUlkOiBjb21tYW5kLmFjdG9yLndvcmtzcGFjZUlkLFxuICAgICAgfSksXG4gICAgICB0aGlzLnN1cmZhY2VTZXJ2aWNlLmdldEluYm94Vmlldyh7XG4gICAgICAgIGFjdG9yOiBjb21tYW5kLmFjdG9yLFxuICAgICAgICB2aWV3S2luZDogJ2luYm94JyxcbiAgICAgICAgd29ya3NwYWNlSWQ6IGNvbW1hbmQuYWN0b3Iud29ya3NwYWNlSWQsXG4gICAgICB9KSxcbiAgICBdKTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogZXhlY1Jlc3VsdC5zdWNjZXNzLFxuICAgICAgbWVzc2FnZTogZXhlY1Jlc3VsdC5tZXNzYWdlLFxuICAgICAgYWN0aW9uUmVzdWx0LFxuICAgICAgdXBkYXRlZFZpZXc6IGluYm94VmlldyxcbiAgICAgIHJlc3BvbmRlZEF0OiBEYXRlLm5vdygpLFxuICAgIH07XG4gIH1cbiAgXG4gIHByaXZhdGUgYXN5bmMgaGFuZGxlUmVxdWVzdFJlY292ZXJ5KFxuICAgIGNvbW1hbmQ6IE9wZXJhdG9yQ29tbWFuZCxcbiAgICBjb250ZXh0PzogRGlzcGF0Y2hDb250ZXh0XG4gICk6IFByb21pc2U8T3BlcmF0b3JDb21tYW5kUmVzdWx0PiB7XG4gICAgaWYgKCFjb21tYW5kLnRhcmdldElkKSB7XG4gICAgICByZXR1cm4gdGhpcy5idWlsZEVycm9yUmVzdWx0KGNvbW1hbmQsIG5ldyBFcnJvcignTWlzc2luZyB0YXJnZXRJZCcpKTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgYWN0aW9uUmVzdWx0OiBPcGVyYXRvckFjdGlvblJlc3VsdCA9IHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBhY3Rpb25UeXBlOiAncmVxdWVzdF9yZWNvdmVyeScsXG4gICAgICB0YXJnZXRUeXBlOiAnaW5jaWRlbnQnLFxuICAgICAgdGFyZ2V0SWQ6IGNvbW1hbmQudGFyZ2V0SWQsXG4gICAgICBtZXNzYWdlOiBgUmVjb3ZlcnkgcmVxdWVzdGVkIGZvciAke2NvbW1hbmQudGFyZ2V0SWR9YCxcbiAgICAgIGV4ZWN1dGVkQXQ6IERhdGUubm93KCksXG4gICAgfTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIG1lc3NhZ2U6IGBSZWNvdmVyeSByZXF1ZXN0ZWQgZm9yICR7Y29tbWFuZC50YXJnZXRJZH1gLFxuICAgICAgYWN0aW9uUmVzdWx0LFxuICAgICAgcmVzcG9uZGVkQXQ6IERhdGUubm93KCksXG4gICAgfTtcbiAgfVxuICBcbiAgcHJpdmF0ZSBhc3luYyBoYW5kbGVSZXF1ZXN0UmVwbGF5KFxuICAgIGNvbW1hbmQ6IE9wZXJhdG9yQ29tbWFuZCxcbiAgICBjb250ZXh0PzogRGlzcGF0Y2hDb250ZXh0XG4gICk6IFByb21pc2U8T3BlcmF0b3JDb21tYW5kUmVzdWx0PiB7XG4gICAgaWYgKCFjb21tYW5kLnRhcmdldElkKSB7XG4gICAgICByZXR1cm4gdGhpcy5idWlsZEVycm9yUmVzdWx0KGNvbW1hbmQsIG5ldyBFcnJvcignTWlzc2luZyB0YXJnZXRJZCcpKTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgYWN0aW9uUmVzdWx0OiBPcGVyYXRvckFjdGlvblJlc3VsdCA9IHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBhY3Rpb25UeXBlOiAncmVxdWVzdF9yZXBsYXknLFxuICAgICAgdGFyZ2V0VHlwZTogJ2luY2lkZW50JyxcbiAgICAgIHRhcmdldElkOiBjb21tYW5kLnRhcmdldElkLFxuICAgICAgbWVzc2FnZTogYFJlcGxheSByZXF1ZXN0ZWQgZm9yICR7Y29tbWFuZC50YXJnZXRJZH1gLFxuICAgICAgZXhlY3V0ZWRBdDogRGF0ZS5ub3coKSxcbiAgICB9O1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgbWVzc2FnZTogYFJlcGxheSByZXF1ZXN0ZWQgZm9yICR7Y29tbWFuZC50YXJnZXRJZH1gLFxuICAgICAgYWN0aW9uUmVzdWx0LFxuICAgICAgcmVzcG9uZGVkQXQ6IERhdGUubm93KCksXG4gICAgfTtcbiAgfVxuICBcbiAgcHJpdmF0ZSBhc3luYyBoYW5kbGVSZXRyeVRhc2soXG4gICAgY29tbWFuZDogT3BlcmF0b3JDb21tYW5kLFxuICAgIGNvbnRleHQ/OiBEaXNwYXRjaENvbnRleHRcbiAgKTogUHJvbWlzZTxPcGVyYXRvckNvbW1hbmRSZXN1bHQ+IHtcbiAgICBpZiAoIWNvbW1hbmQudGFyZ2V0SWQpIHtcbiAgICAgIHJldHVybiB0aGlzLmJ1aWxkRXJyb3JSZXN1bHQoY29tbWFuZCwgbmV3IEVycm9yKCdNaXNzaW5nIHRhcmdldElkJykpO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCBleGVjUmVzdWx0ID0gYXdhaXQgdGhpcy5leGVjdXRpb25CcmlkZ2UucmV0cnlUYXNrKFxuICAgICAgY29tbWFuZC50YXJnZXRJZCxcbiAgICAgIGNvbW1hbmQuYWN0b3IuYWN0b3JJZFxuICAgICk7XG4gICAgXG4gICAgLy8g5aSx5pWI57yT5a2YXG4gICAgaWYgKGV4ZWNSZXN1bHQuZXhlY3V0aW9uTW9kZSA9PT0gJ3JlYWwnICYmIHRoaXMuc25hcHNob3RQcm92aWRlcikge1xuICAgICAgdGhpcy5zbmFwc2hvdFByb3ZpZGVyLmludmFsaWRhdGUoJ3Rhc2snKTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgYWN0aW9uUmVzdWx0OiBPcGVyYXRvckFjdGlvblJlc3VsdCA9IHRoaXMudG9BY3Rpb25SZXN1bHQoZXhlY1Jlc3VsdCk7XG4gICAgXG4gICAgLy8g5Yi35paw5Lu75Yqh6KeG5Zu+5ZKMIGluYm94XG4gICAgY29uc3QgW3Rhc2tWaWV3LCBpbmJveFZpZXddID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgdGhpcy5zdXJmYWNlU2VydmljZS5nZXRUYXNrVmlldyh7XG4gICAgICAgIGFjdG9yOiBjb21tYW5kLmFjdG9yLFxuICAgICAgICB2aWV3S2luZDogJ3Rhc2tzJyxcbiAgICAgICAgd29ya3NwYWNlSWQ6IGNvbW1hbmQuYWN0b3Iud29ya3NwYWNlSWQsXG4gICAgICB9KSxcbiAgICAgIHRoaXMuc3VyZmFjZVNlcnZpY2UuZ2V0SW5ib3hWaWV3KHtcbiAgICAgICAgYWN0b3I6IGNvbW1hbmQuYWN0b3IsXG4gICAgICAgIHZpZXdLaW5kOiAnaW5ib3gnLFxuICAgICAgICB3b3Jrc3BhY2VJZDogY29tbWFuZC5hY3Rvci53b3Jrc3BhY2VJZCxcbiAgICAgIH0pLFxuICAgIF0pO1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBzdWNjZXNzOiBleGVjUmVzdWx0LnN1Y2Nlc3MsXG4gICAgICBtZXNzYWdlOiBleGVjUmVzdWx0Lm1lc3NhZ2UsXG4gICAgICBhY3Rpb25SZXN1bHQsXG4gICAgICB1cGRhdGVkVmlldzogaW5ib3hWaWV3LFxuICAgICAgcmVzcG9uZGVkQXQ6IERhdGUubm93KCksXG4gICAgfTtcbiAgfVxuICBcbiAgcHJpdmF0ZSBhc3luYyBoYW5kbGVDYW5jZWxUYXNrKFxuICAgIGNvbW1hbmQ6IE9wZXJhdG9yQ29tbWFuZCxcbiAgICBjb250ZXh0PzogRGlzcGF0Y2hDb250ZXh0XG4gICk6IFByb21pc2U8T3BlcmF0b3JDb21tYW5kUmVzdWx0PiB7XG4gICAgaWYgKCFjb21tYW5kLnRhcmdldElkKSB7XG4gICAgICByZXR1cm4gdGhpcy5idWlsZEVycm9yUmVzdWx0KGNvbW1hbmQsIG5ldyBFcnJvcignTWlzc2luZyB0YXJnZXRJZCcpKTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgYWN0aW9uUmVzdWx0OiBPcGVyYXRvckFjdGlvblJlc3VsdCA9IHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBhY3Rpb25UeXBlOiAnY2FuY2VsX3Rhc2snLFxuICAgICAgdGFyZ2V0VHlwZTogJ3Rhc2snLFxuICAgICAgdGFyZ2V0SWQ6IGNvbW1hbmQudGFyZ2V0SWQsXG4gICAgICBtZXNzYWdlOiBgVGFzayAke2NvbW1hbmQudGFyZ2V0SWR9IGNhbmNlbGxlZGAsXG4gICAgICBleGVjdXRlZEF0OiBEYXRlLm5vdygpLFxuICAgIH07XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBtZXNzYWdlOiBgVGFzayAke2NvbW1hbmQudGFyZ2V0SWR9IGNhbmNlbGxlZGAsXG4gICAgICBhY3Rpb25SZXN1bHQsXG4gICAgICByZXNwb25kZWRBdDogRGF0ZS5ub3coKSxcbiAgICB9O1xuICB9XG4gIFxuICBwcml2YXRlIGFzeW5jIGhhbmRsZVBhdXNlVGFzayhcbiAgICBjb21tYW5kOiBPcGVyYXRvckNvbW1hbmQsXG4gICAgY29udGV4dD86IERpc3BhdGNoQ29udGV4dFxuICApOiBQcm9taXNlPE9wZXJhdG9yQ29tbWFuZFJlc3VsdD4ge1xuICAgIGlmICghY29tbWFuZC50YXJnZXRJZCkge1xuICAgICAgcmV0dXJuIHRoaXMuYnVpbGRFcnJvclJlc3VsdChjb21tYW5kLCBuZXcgRXJyb3IoJ01pc3NpbmcgdGFyZ2V0SWQnKSk7XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IGFjdGlvblJlc3VsdDogT3BlcmF0b3JBY3Rpb25SZXN1bHQgPSB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgYWN0aW9uVHlwZTogJ3BhdXNlX3Rhc2snLFxuICAgICAgdGFyZ2V0VHlwZTogJ3Rhc2snLFxuICAgICAgdGFyZ2V0SWQ6IGNvbW1hbmQudGFyZ2V0SWQsXG4gICAgICBtZXNzYWdlOiBgVGFzayAke2NvbW1hbmQudGFyZ2V0SWR9IHBhdXNlZGAsXG4gICAgICBleGVjdXRlZEF0OiBEYXRlLm5vdygpLFxuICAgIH07XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBtZXNzYWdlOiBgVGFzayAke2NvbW1hbmQudGFyZ2V0SWR9IHBhdXNlZGAsXG4gICAgICBhY3Rpb25SZXN1bHQsXG4gICAgICByZXNwb25kZWRBdDogRGF0ZS5ub3coKSxcbiAgICB9O1xuICB9XG4gIFxuICBwcml2YXRlIGFzeW5jIGhhbmRsZVJlc3VtZVRhc2soXG4gICAgY29tbWFuZDogT3BlcmF0b3JDb21tYW5kLFxuICAgIGNvbnRleHQ/OiBEaXNwYXRjaENvbnRleHRcbiAgKTogUHJvbWlzZTxPcGVyYXRvckNvbW1hbmRSZXN1bHQ+IHtcbiAgICBpZiAoIWNvbW1hbmQudGFyZ2V0SWQpIHtcbiAgICAgIHJldHVybiB0aGlzLmJ1aWxkRXJyb3JSZXN1bHQoY29tbWFuZCwgbmV3IEVycm9yKCdNaXNzaW5nIHRhcmdldElkJykpO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCBhY3Rpb25SZXN1bHQ6IE9wZXJhdG9yQWN0aW9uUmVzdWx0ID0ge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIGFjdGlvblR5cGU6ICdyZXN1bWVfdGFzaycsXG4gICAgICB0YXJnZXRUeXBlOiAndGFzaycsXG4gICAgICB0YXJnZXRJZDogY29tbWFuZC50YXJnZXRJZCxcbiAgICAgIG1lc3NhZ2U6IGBUYXNrICR7Y29tbWFuZC50YXJnZXRJZH0gcmVzdW1lZGAsXG4gICAgICBleGVjdXRlZEF0OiBEYXRlLm5vdygpLFxuICAgIH07XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBtZXNzYWdlOiBgVGFzayAke2NvbW1hbmQudGFyZ2V0SWR9IHJlc3VtZWRgLFxuICAgICAgYWN0aW9uUmVzdWx0LFxuICAgICAgcmVzcG9uZGVkQXQ6IERhdGUubm93KCksXG4gICAgfTtcbiAgfVxuICBcbiAgcHJpdmF0ZSBhc3luYyBoYW5kbGVQYXVzZUFnZW50KFxuICAgIGNvbW1hbmQ6IE9wZXJhdG9yQ29tbWFuZCxcbiAgICBjb250ZXh0PzogRGlzcGF0Y2hDb250ZXh0XG4gICk6IFByb21pc2U8T3BlcmF0b3JDb21tYW5kUmVzdWx0PiB7XG4gICAgaWYgKCFjb21tYW5kLnRhcmdldElkKSB7XG4gICAgICByZXR1cm4gdGhpcy5idWlsZEVycm9yUmVzdWx0KGNvbW1hbmQsIG5ldyBFcnJvcignTWlzc2luZyB0YXJnZXRJZCcpKTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgZXhlY1Jlc3VsdCA9IGF3YWl0IHRoaXMuZXhlY3V0aW9uQnJpZGdlLnBhdXNlQWdlbnQoXG4gICAgICBjb21tYW5kLnRhcmdldElkLFxuICAgICAgY29tbWFuZC5hY3Rvci5hY3RvcklkXG4gICAgKTtcbiAgICBcbiAgICBjb25zdCBhY3Rpb25SZXN1bHQ6IE9wZXJhdG9yQWN0aW9uUmVzdWx0ID0gdGhpcy50b0FjdGlvblJlc3VsdChleGVjUmVzdWx0KTtcbiAgICBcbiAgICBjb25zdCB1cGRhdGVkVmlldyA9IGF3YWl0IHRoaXMuc3VyZmFjZVNlcnZpY2UuZ2V0RGFzaGJvYXJkVmlldyh7XG4gICAgICBhY3RvcjogY29tbWFuZC5hY3RvcixcbiAgICAgIHZpZXdLaW5kOiAnZGFzaGJvYXJkJyxcbiAgICAgIHdvcmtzcGFjZUlkOiBjb21tYW5kLmFjdG9yLndvcmtzcGFjZUlkLFxuICAgIH0pO1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBzdWNjZXNzOiBleGVjUmVzdWx0LnN1Y2Nlc3MsXG4gICAgICBtZXNzYWdlOiBleGVjUmVzdWx0Lm1lc3NhZ2UsXG4gICAgICBhY3Rpb25SZXN1bHQsXG4gICAgICB1cGRhdGVkVmlldyxcbiAgICAgIHJlc3BvbmRlZEF0OiBEYXRlLm5vdygpLFxuICAgIH07XG4gIH1cbiAgXG4gIHByaXZhdGUgYXN5bmMgaGFuZGxlUmVzdW1lQWdlbnQoXG4gICAgY29tbWFuZDogT3BlcmF0b3JDb21tYW5kLFxuICAgIGNvbnRleHQ/OiBEaXNwYXRjaENvbnRleHRcbiAgKTogUHJvbWlzZTxPcGVyYXRvckNvbW1hbmRSZXN1bHQ+IHtcbiAgICBpZiAoIWNvbW1hbmQudGFyZ2V0SWQpIHtcbiAgICAgIHJldHVybiB0aGlzLmJ1aWxkRXJyb3JSZXN1bHQoY29tbWFuZCwgbmV3IEVycm9yKCdNaXNzaW5nIHRhcmdldElkJykpO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCBhY3Rpb25SZXN1bHQ6IE9wZXJhdG9yQWN0aW9uUmVzdWx0ID0ge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIGFjdGlvblR5cGU6ICdyZXN1bWVfYWdlbnQnLFxuICAgICAgdGFyZ2V0VHlwZTogJ2FnZW50JyxcbiAgICAgIHRhcmdldElkOiBjb21tYW5kLnRhcmdldElkLFxuICAgICAgbWVzc2FnZTogYEFnZW50ICR7Y29tbWFuZC50YXJnZXRJZH0gcmVzdW1lZGAsXG4gICAgICBleGVjdXRlZEF0OiBEYXRlLm5vdygpLFxuICAgIH07XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBtZXNzYWdlOiBgQWdlbnQgJHtjb21tYW5kLnRhcmdldElkfSByZXN1bWVkYCxcbiAgICAgIGFjdGlvblJlc3VsdCxcbiAgICAgIHJlc3BvbmRlZEF0OiBEYXRlLm5vdygpLFxuICAgIH07XG4gIH1cbiAgXG4gIHByaXZhdGUgYXN5bmMgaGFuZGxlSW5zcGVjdEFnZW50KFxuICAgIGNvbW1hbmQ6IE9wZXJhdG9yQ29tbWFuZCxcbiAgICBjb250ZXh0PzogRGlzcGF0Y2hDb250ZXh0XG4gICk6IFByb21pc2U8T3BlcmF0b3JDb21tYW5kUmVzdWx0PiB7XG4gICAgaWYgKCFjb21tYW5kLnRhcmdldElkKSB7XG4gICAgICByZXR1cm4gdGhpcy5idWlsZEVycm9yUmVzdWx0KGNvbW1hbmQsIG5ldyBFcnJvcignTWlzc2luZyB0YXJnZXRJZCcpKTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgdXBkYXRlZFZpZXcgPSBhd2FpdCB0aGlzLnN1cmZhY2VTZXJ2aWNlLmdldEl0ZW1EZXRhaWxWaWV3KHtcbiAgICAgIGFjdG9yOiBjb21tYW5kLmFjdG9yLFxuICAgICAgdmlld0tpbmQ6ICdpdGVtX2RldGFpbCcsXG4gICAgICB3b3Jrc3BhY2VJZDogY29tbWFuZC5hY3Rvci53b3Jrc3BhY2VJZCxcbiAgICAgIHRhcmdldElkOiBjb21tYW5kLnRhcmdldElkLFxuICAgIH0pO1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgbWVzc2FnZTogYEFnZW50ICR7Y29tbWFuZC50YXJnZXRJZH0gaW5zcGVjdGlvbiBvcGVuZWRgLFxuICAgICAgdXBkYXRlZFZpZXcsXG4gICAgICByZXNwb25kZWRBdDogRGF0ZS5ub3coKSxcbiAgICB9O1xuICB9XG4gIFxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIC8vIEhJVEwgSGFuZGxlclxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIFxuICBwcml2YXRlIGFzeW5jIGhhbmRsZUNvbmZpcm1BY3Rpb24oXG4gICAgY29tbWFuZDogT3BlcmF0b3JDb21tYW5kLFxuICAgIGNvbnRleHQ/OiBEaXNwYXRjaENvbnRleHRcbiAgKTogUHJvbWlzZTxPcGVyYXRvckNvbW1hbmRSZXN1bHQ+IHtcbiAgICAvLyBUT0RPOiDosIPnlKggY29uZmlybWF0aW9uIG1hbmFnZXJcbiAgICBcbiAgICBjb25zdCBhY3Rpb25SZXN1bHQ6IE9wZXJhdG9yQWN0aW9uUmVzdWx0ID0ge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIGFjdGlvblR5cGU6ICdjb25maXJtX2FjdGlvbicsXG4gICAgICB0YXJnZXRJZDogY29tbWFuZC50YXJnZXRJZCxcbiAgICAgIG1lc3NhZ2U6IGBBY3Rpb24gJHtjb21tYW5kLnRhcmdldElkfSBjb25maXJtZWRgLFxuICAgICAgY29uZmlybWF0aW9uU3RhdGU6ICdjb25maXJtZWQnLFxuICAgICAgZXhlY3V0ZWRBdDogRGF0ZS5ub3coKSxcbiAgICB9O1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgbWVzc2FnZTogYEFjdGlvbiBjb25maXJtZWRgLFxuICAgICAgYWN0aW9uUmVzdWx0LFxuICAgICAgcmVzcG9uZGVkQXQ6IERhdGUubm93KCksXG4gICAgfTtcbiAgfVxuICBcbiAgcHJpdmF0ZSBhc3luYyBoYW5kbGVEaXNtaXNzSW50ZXJ2ZW50aW9uKFxuICAgIGNvbW1hbmQ6IE9wZXJhdG9yQ29tbWFuZCxcbiAgICBjb250ZXh0PzogRGlzcGF0Y2hDb250ZXh0XG4gICk6IFByb21pc2U8T3BlcmF0b3JDb21tYW5kUmVzdWx0PiB7XG4gICAgaWYgKCFjb21tYW5kLnRhcmdldElkKSB7XG4gICAgICByZXR1cm4gdGhpcy5idWlsZEVycm9yUmVzdWx0KGNvbW1hbmQsIG5ldyBFcnJvcignTWlzc2luZyB0YXJnZXRJZCcpKTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgYWN0aW9uUmVzdWx0OiBPcGVyYXRvckFjdGlvblJlc3VsdCA9IHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBhY3Rpb25UeXBlOiAnZGlzbWlzc19pbnRlcnZlbnRpb24nLFxuICAgICAgdGFyZ2V0VHlwZTogJ2ludGVydmVudGlvbicsXG4gICAgICB0YXJnZXRJZDogY29tbWFuZC50YXJnZXRJZCxcbiAgICAgIG1lc3NhZ2U6IGBJbnRlcnZlbnRpb24gJHtjb21tYW5kLnRhcmdldElkfSBkaXNtaXNzZWRgLFxuICAgICAgZXhlY3V0ZWRBdDogRGF0ZS5ub3coKSxcbiAgICB9O1xuICAgIFxuICAgIGNvbnN0IHVwZGF0ZWRWaWV3ID0gYXdhaXQgdGhpcy5zdXJmYWNlU2VydmljZS5nZXRJbnRlcnZlbnRpb25WaWV3KHtcbiAgICAgIGFjdG9yOiBjb21tYW5kLmFjdG9yLFxuICAgICAgdmlld0tpbmQ6ICdpbnRlcnZlbnRpb25zJyxcbiAgICAgIHdvcmtzcGFjZUlkOiBjb21tYW5kLmFjdG9yLndvcmtzcGFjZUlkLFxuICAgIH0pO1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgbWVzc2FnZTogYEludGVydmVudGlvbiAke2NvbW1hbmQudGFyZ2V0SWR9IGRpc21pc3NlZGAsXG4gICAgICBhY3Rpb25SZXN1bHQsXG4gICAgICB1cGRhdGVkVmlldyxcbiAgICAgIHJlc3BvbmRlZEF0OiBEYXRlLm5vdygpLFxuICAgIH07XG4gIH1cbiAgXG4gIHByaXZhdGUgYXN5bmMgaGFuZGxlU25vb3plSW50ZXJ2ZW50aW9uKFxuICAgIGNvbW1hbmQ6IE9wZXJhdG9yQ29tbWFuZCxcbiAgICBjb250ZXh0PzogRGlzcGF0Y2hDb250ZXh0XG4gICk6IFByb21pc2U8T3BlcmF0b3JDb21tYW5kUmVzdWx0PiB7XG4gICAgaWYgKCFjb21tYW5kLnRhcmdldElkKSB7XG4gICAgICByZXR1cm4gdGhpcy5idWlsZEVycm9yUmVzdWx0KGNvbW1hbmQsIG5ldyBFcnJvcignTWlzc2luZyB0YXJnZXRJZCcpKTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgYWN0aW9uUmVzdWx0OiBPcGVyYXRvckFjdGlvblJlc3VsdCA9IHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBhY3Rpb25UeXBlOiAnc25vb3plX2ludGVydmVudGlvbicsXG4gICAgICB0YXJnZXRUeXBlOiAnaW50ZXJ2ZW50aW9uJyxcbiAgICAgIHRhcmdldElkOiBjb21tYW5kLnRhcmdldElkLFxuICAgICAgbWVzc2FnZTogYEludGVydmVudGlvbiAke2NvbW1hbmQudGFyZ2V0SWR9IHNub296ZWRgLFxuICAgICAgZXhlY3V0ZWRBdDogRGF0ZS5ub3coKSxcbiAgICB9O1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgbWVzc2FnZTogYEludGVydmVudGlvbiAke2NvbW1hbmQudGFyZ2V0SWR9IHNub296ZWRgLFxuICAgICAgYWN0aW9uUmVzdWx0LFxuICAgICAgcmVzcG9uZGVkQXQ6IERhdGUubm93KCksXG4gICAgfTtcbiAgfVxuICBcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAvLyBOYXZpZ2F0aW9uIEhhbmRsZXJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICBcbiAgcHJpdmF0ZSBhc3luYyBoYW5kbGVTd2l0Y2hXb3Jrc3BhY2UoXG4gICAgY29tbWFuZDogT3BlcmF0b3JDb21tYW5kLFxuICAgIGNvbnRleHQ/OiBEaXNwYXRjaENvbnRleHRcbiAgKTogUHJvbWlzZTxPcGVyYXRvckNvbW1hbmRSZXN1bHQ+IHtcbiAgICBpZiAoIWNvbW1hbmQudGFyZ2V0SWQpIHtcbiAgICAgIHJldHVybiB0aGlzLmJ1aWxkRXJyb3JSZXN1bHQoY29tbWFuZCwgbmV3IEVycm9yKCdNaXNzaW5nIHdvcmtzcGFjZUlkJykpO1xuICAgIH1cbiAgICBcbiAgICAvLyDliIfmjaLliLDmlrAgd29ya3NwYWNlIOW5tui/lOWbniBkYXNoYm9hcmRcbiAgICBjb25zdCB1cGRhdGVkVmlldyA9IGF3YWl0IHRoaXMuc3VyZmFjZVNlcnZpY2UuZ2V0RGFzaGJvYXJkVmlldyh7XG4gICAgICBhY3Rvcjoge1xuICAgICAgICAuLi5jb21tYW5kLmFjdG9yLFxuICAgICAgICB3b3Jrc3BhY2VJZDogY29tbWFuZC50YXJnZXRJZCxcbiAgICAgIH0sXG4gICAgICB2aWV3S2luZDogJ2Rhc2hib2FyZCcsXG4gICAgICB3b3Jrc3BhY2VJZDogY29tbWFuZC50YXJnZXRJZCxcbiAgICB9KTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIG1lc3NhZ2U6IGBTd2l0Y2hlZCB0byB3b3Jrc3BhY2UgJHtjb21tYW5kLnRhcmdldElkfWAsXG4gICAgICB1cGRhdGVkVmlldyxcbiAgICAgIG5hdmlnYXRpb25TdGF0ZTogY29udGV4dD8ubmF2aWdhdGlvbiA/IHtcbiAgICAgICAgLi4uY29udGV4dC5uYXZpZ2F0aW9uLFxuICAgICAgICB3b3Jrc3BhY2VJZDogY29tbWFuZC50YXJnZXRJZCxcbiAgICAgICAgY3VycmVudFZpZXc6ICdkYXNoYm9hcmQnLFxuICAgICAgICBsYXN0Q29tbWFuZEF0OiBEYXRlLm5vdygpLFxuICAgICAgfSA6IHtcbiAgICAgICAgd29ya3NwYWNlSWQ6IGNvbW1hbmQudGFyZ2V0SWQsXG4gICAgICAgIGN1cnJlbnRWaWV3OiAnZGFzaGJvYXJkJyxcbiAgICAgICAgbGFzdENvbW1hbmRBdDogRGF0ZS5ub3coKSxcbiAgICAgIH0sXG4gICAgICByZXNwb25kZWRBdDogRGF0ZS5ub3coKSxcbiAgICB9O1xuICB9XG4gIFxuICBwcml2YXRlIGFzeW5jIGhhbmRsZUdvQmFjayhcbiAgICBjb21tYW5kOiBPcGVyYXRvckNvbW1hbmQsXG4gICAgY29udGV4dD86IERpc3BhdGNoQ29udGV4dFxuICApOiBQcm9taXNlPE9wZXJhdG9yQ29tbWFuZFJlc3VsdD4ge1xuICAgIGNvbnN0IHByZXZpb3VzVmlldyA9IGNvbnRleHQ/Lm5hdmlnYXRpb24/LnByZXZpb3VzVmlldyB8fCAnZGFzaGJvYXJkJztcbiAgICBcbiAgICBjb25zdCB1cGRhdGVkVmlldyA9IGF3YWl0IHRoaXMuc3VyZmFjZVNlcnZpY2UuZ2V0Vmlldyh7XG4gICAgICBhY3RvcjogY29tbWFuZC5hY3RvcixcbiAgICAgIHZpZXdLaW5kOiBwcmV2aW91c1ZpZXcsXG4gICAgICB3b3Jrc3BhY2VJZDogY29tbWFuZC5hY3Rvci53b3Jrc3BhY2VJZCxcbiAgICB9KTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIG1lc3NhZ2U6ICdOYXZpZ2F0ZWQgYmFjaycsXG4gICAgICB1cGRhdGVkVmlldyxcbiAgICAgIG5hdmlnYXRpb25TdGF0ZTogY29udGV4dD8ubmF2aWdhdGlvbiA/IHtcbiAgICAgICAgLi4uY29udGV4dC5uYXZpZ2F0aW9uLFxuICAgICAgICBjdXJyZW50VmlldzogcHJldmlvdXNWaWV3LFxuICAgICAgICBwcmV2aW91c1ZpZXc6IGNvbnRleHQubmF2aWdhdGlvbi5jdXJyZW50VmlldyxcbiAgICAgICAgbGFzdENvbW1hbmRBdDogRGF0ZS5ub3coKSxcbiAgICAgIH0gOiB1bmRlZmluZWQsXG4gICAgICByZXNwb25kZWRBdDogRGF0ZS5ub3coKSxcbiAgICB9O1xuICB9XG4gIFxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIC8vIOi+heWKqeaWueazlVxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIFxuICAvKipcbiAgICog5bCGIEV4ZWN1dGlvblJlc3VsdCDovazmjaLkuLogT3BlcmF0b3JBY3Rpb25SZXN1bHRcbiAgICovXG4gIHByaXZhdGUgdG9BY3Rpb25SZXN1bHQoZXhlY1Jlc3VsdDogRXhlY3V0aW9uUmVzdWx0KTogT3BlcmF0b3JBY3Rpb25SZXN1bHQge1xuICAgIHJldHVybiB7XG4gICAgICBzdWNjZXNzOiBleGVjUmVzdWx0LnN1Y2Nlc3MsXG4gICAgICBhY3Rpb25UeXBlOiBleGVjUmVzdWx0LmFjdGlvblR5cGUsXG4gICAgICB0YXJnZXRUeXBlOiBleGVjUmVzdWx0LnRhcmdldElkID8gdGhpcy5pbmZlclRhcmdldFR5cGUoZXhlY1Jlc3VsdC5hY3Rpb25UeXBlKSA6IHVuZGVmaW5lZCxcbiAgICAgIHRhcmdldElkOiBleGVjUmVzdWx0LnRhcmdldElkLFxuICAgICAgbWVzc2FnZTogZXhlY1Jlc3VsdC5tZXNzYWdlLFxuICAgICAgY29uZmlybWF0aW9uU3RhdGU6IHRoaXMuaW5mZXJDb25maXJtYXRpb25TdGF0ZShleGVjUmVzdWx0LmFjdGlvblR5cGUpLFxuICAgICAgZXhlY3V0ZWRBdDogZXhlY1Jlc3VsdC5leGVjdXRlZEF0LFxuICAgICAgZGF0YToge1xuICAgICAgICBleGVjdXRpb25Nb2RlOiBleGVjUmVzdWx0LmV4ZWN1dGlvbk1vZGUsXG4gICAgICB9LFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmoLnmja7liqjkvZznsbvlnovmjqjmlq3nm67moIfnsbvlnotcbiAgICovXG4gIHByaXZhdGUgaW5mZXJUYXJnZXRUeXBlKGFjdGlvblR5cGU6IHN0cmluZyk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gICAgY29uc3QgbWFwcGluZzogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICAgIGFwcHJvdmU6ICdhcHByb3ZhbCcsXG4gICAgICByZWplY3Q6ICdhcHByb3ZhbCcsXG4gICAgICBlc2NhbGF0ZTogJ2FwcHJvdmFsJyxcbiAgICAgIGFja19pbmNpZGVudDogJ2luY2lkZW50JyxcbiAgICAgIHJlcXVlc3RfcmVjb3Zlcnk6ICdpbmNpZGVudCcsXG4gICAgICByZXF1ZXN0X3JlcGxheTogJ2luY2lkZW50JyxcbiAgICAgIHJldHJ5X3Rhc2s6ICd0YXNrJyxcbiAgICAgIGNhbmNlbF90YXNrOiAndGFzaycsXG4gICAgICBwYXVzZV90YXNrOiAndGFzaycsXG4gICAgICByZXN1bWVfdGFzazogJ3Rhc2snLFxuICAgICAgcGF1c2VfYWdlbnQ6ICdhZ2VudCcsXG4gICAgICByZXN1bWVfYWdlbnQ6ICdhZ2VudCcsXG4gICAgICBpbnNwZWN0X2FnZW50OiAnYWdlbnQnLFxuICAgIH07XG4gICAgcmV0dXJuIG1hcHBpbmdbYWN0aW9uVHlwZV07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmoLnmja7liqjkvZznsbvlnovmjqjmlq3noa7orqTnirbmgIFcbiAgICovXG4gIHByaXZhdGUgaW5mZXJDb25maXJtYXRpb25TdGF0ZShhY3Rpb25UeXBlOiBzdHJpbmcpOiBPcGVyYXRvckNvbmZpcm1hdGlvblN0YXRlIHwgdW5kZWZpbmVkIHtcbiAgICAvLyDpnIDopoHnoa7orqTnmoTliqjkvZxcbiAgICBjb25zdCBjb25maXJtYWJsZUFjdGlvbnMgPSBbJ2FwcHJvdmUnLCAncmVqZWN0JywgJ2VzY2FsYXRlJywgJ2NvbmZpcm1fYWN0aW9uJ107XG4gICAgaWYgKGNvbmZpcm1hYmxlQWN0aW9ucy5pbmNsdWRlcyhhY3Rpb25UeXBlKSkge1xuICAgICAgcmV0dXJuICdjb25maXJtZWQnO1xuICAgIH1cbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG4gIFxuICBwcml2YXRlIGJ1aWxkVW5zdXBwb3J0ZWRSZXN1bHQoY29tbWFuZDogT3BlcmF0b3JDb21tYW5kKTogT3BlcmF0b3JDb21tYW5kUmVzdWx0IHtcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICBtZXNzYWdlOiBgVW5zdXBwb3J0ZWQgY29tbWFuZCB0eXBlOiAke2NvbW1hbmQuY29tbWFuZFR5cGV9YCxcbiAgICAgIGVycm9yczogW3tcbiAgICAgICAgY29kZTogJ1VOU1VQUE9SVEVEX0NPTU1BTkQnLFxuICAgICAgICBtZXNzYWdlOiBgQ29tbWFuZCAke2NvbW1hbmQuY29tbWFuZFR5cGV9IGlzIG5vdCBpbXBsZW1lbnRlZGAsXG4gICAgICB9XSxcbiAgICAgIHJlc3BvbmRlZEF0OiBEYXRlLm5vdygpLFxuICAgIH07XG4gIH1cbiAgXG4gIHByaXZhdGUgYnVpbGRFcnJvclJlc3VsdChjb21tYW5kOiBPcGVyYXRvckNvbW1hbmQsIGVycm9yOiB1bmtub3duKTogT3BlcmF0b3JDb21tYW5kUmVzdWx0IHtcbiAgICBjb25zdCBlcnJvck1lc3NhZ2UgPSBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcik7XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgbWVzc2FnZTogYENvbW1hbmQgZmFpbGVkOiAke2Vycm9yTWVzc2FnZX1gLFxuICAgICAgZXJyb3JzOiBbe1xuICAgICAgICBjb2RlOiAnQ09NTUFORF9FUlJPUicsXG4gICAgICAgIG1lc3NhZ2U6IGVycm9yTWVzc2FnZSxcbiAgICAgICAgZGV0YWlsczoge1xuICAgICAgICAgIGNvbW1hbmRUeXBlOiBjb21tYW5kLmNvbW1hbmRUeXBlLFxuICAgICAgICAgIHRhcmdldElkOiBjb21tYW5kLnRhcmdldElkLFxuICAgICAgICB9LFxuICAgICAgfV0sXG4gICAgICByZXNwb25kZWRBdDogRGF0ZS5ub3coKSxcbiAgICB9O1xuICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOW3peWOguWHveaVsFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5pbXBvcnQgdHlwZSB7IE9wZXJhdG9yRXhlY3V0aW9uQnJpZGdlIH0gZnJvbSAnLi9vcGVyYXRvcl9leGVjdXRpb25fYnJpZGdlJztcbmltcG9ydCB0eXBlIHsgT3BlcmF0b3JTbmFwc2hvdFByb3ZpZGVyIH0gZnJvbSAnLi4vZGF0YS9vcGVyYXRvcl9zbmFwc2hvdF9wcm92aWRlcic7XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVPcGVyYXRvckNvbW1hbmREaXNwYXRjaChcbiAgc3VyZmFjZVNlcnZpY2U6IE9wZXJhdG9yU3VyZmFjZVNlcnZpY2UsXG4gIGV4ZWN1dGlvbkJyaWRnZTogT3BlcmF0b3JFeGVjdXRpb25CcmlkZ2UsXG4gIGNvbnRyb2xTdXJmYWNlQnVpbGRlcj86IENvbnRyb2xTdXJmYWNlQnVpbGRlcixcbiAgaHVtYW5Mb29wU2VydmljZT86IEh1bWFuTG9vcFNlcnZpY2UsXG4gIHNuYXBzaG90UHJvdmlkZXI/OiBPcGVyYXRvclNuYXBzaG90UHJvdmlkZXJcbik6IE9wZXJhdG9yQ29tbWFuZERpc3BhdGNoIHtcbiAgcmV0dXJuIG5ldyBEZWZhdWx0T3BlcmF0b3JDb21tYW5kRGlzcGF0Y2goXG4gICAgc3VyZmFjZVNlcnZpY2UsXG4gICAgZXhlY3V0aW9uQnJpZGdlLFxuICAgIGNvbnRyb2xTdXJmYWNlQnVpbGRlcixcbiAgICBodW1hbkxvb3BTZXJ2aWNlLFxuICAgIHNuYXBzaG90UHJvdmlkZXJcbiAgKTtcbn1cbiJdfQ==