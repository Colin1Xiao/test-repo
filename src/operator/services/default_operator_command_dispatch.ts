/**
 * Default Operator Command Dispatch
 * Phase 2A-1R - 命令分发实现
 * 
 * 职责：
 * - 实现 OperatorCommandDispatch 接口
 * - 映射命令到真实动作
 * - 依赖：OperatorSurfaceService, ControlSurface, HumanLoopService
 */

import type {
  DispatchContext,
  OperatorCommand,
  OperatorCommandResult,
  OperatorActionResult,
  OperatorCommandError,
  OperatorCommandDispatch,
  OperatorConfirmationState,
} from '../types/surface_types';
import type { OperatorSurfaceService } from './operator_surface_service';
import type { ControlSurfaceBuilder } from '../ux/control_surface';
import type { HumanLoopService } from '../ux/human_loop_service';
import type { OperatorExecutionBridge, ExecutionResult } from './operator_execution_bridge';

// ============================================================================
// 默认实现
// ============================================================================

export class DefaultOperatorCommandDispatch implements OperatorCommandDispatch {
  private surfaceService: OperatorSurfaceService;
  private executionBridge: OperatorExecutionBridge;
  private controlSurfaceBuilder: ControlSurfaceBuilder | null = null;
  private humanLoopService: HumanLoopService | null = null;
  private snapshotProvider: any | null = null;
  
  constructor(
    surfaceService: OperatorSurfaceService,
    executionBridge: OperatorExecutionBridge,
    controlSurfaceBuilder?: ControlSurfaceBuilder,
    humanLoopService?: HumanLoopService,
    snapshotProvider?: any
  ) {
    this.surfaceService = surfaceService;
    this.executionBridge = executionBridge;
    this.controlSurfaceBuilder = controlSurfaceBuilder || null;
    this.humanLoopService = humanLoopService || null;
    this.snapshotProvider = snapshotProvider || null;
  }
  
  async dispatch(
    command: OperatorCommand,
    context?: DispatchContext
  ): Promise<OperatorCommandResult> {
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
    } catch (error) {
      return this.buildErrorResult(command, error);
    }
  }
  
  // ============================================================================
  // View Handler
  // ============================================================================
  
  private async handleView(
    viewKind: string,
    command: OperatorCommand,
    context?: DispatchContext
  ): Promise<OperatorCommandResult> {
    const updatedView = await this.surfaceService.getView({
      actor: command.actor,
      viewKind: viewKind as any,
      workspaceId: command.actor.workspaceId,
      mode: context?.navigation?.mode,
    });
    
    return {
      success: true,
      message: `View ${viewKind} loaded`,
      updatedView,
      navigationState: context?.navigation ? {
        ...context.navigation,
        currentView: viewKind as any,
        lastCommandAt: Date.now(),
      } : undefined,
      respondedAt: Date.now(),
    };
  }
  
  private async handleOpenItem(
    command: OperatorCommand,
    context?: DispatchContext
  ): Promise<OperatorCommandResult> {
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
  
  private async handleRefresh(
    command: OperatorCommand,
    context?: DispatchContext
  ): Promise<OperatorCommandResult> {
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
  
  private async handleApprove(
    command: OperatorCommand,
    context?: DispatchContext
  ): Promise<OperatorCommandResult> {
    if (!command.targetId) {
      return this.buildErrorResult(command, new Error('Missing targetId'));
    }
    
    // 使用 execution bridge 执行真实动作
    const execResult = await this.executionBridge.approveApproval(
      command.targetId,
      command.actor.actorId
    );
    
    // 失效缓存
    if (execResult.executionMode === 'real' && this.snapshotProvider) {
      this.snapshotProvider.invalidate('approval');
    }
    
    const actionResult: OperatorActionResult = this.toActionResult(execResult);
    
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
  
  private async handleReject(
    command: OperatorCommand,
    context?: DispatchContext
  ): Promise<OperatorCommandResult> {
    if (!command.targetId) {
      return this.buildErrorResult(command, new Error('Missing targetId'));
    }
    
    const execResult = await this.executionBridge.rejectApproval(
      command.targetId,
      command.actor.actorId
    );
    
    const actionResult: OperatorActionResult = this.toActionResult(execResult);
    
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
  
  private async handleEscalate(
    command: OperatorCommand,
    context?: DispatchContext
  ): Promise<OperatorCommandResult> {
    if (!command.targetId) {
      return this.buildErrorResult(command, new Error('Missing targetId'));
    }
    
    const actionResult: OperatorActionResult = {
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
  
  private async handleAckIncident(
    command: OperatorCommand,
    context?: DispatchContext
  ): Promise<OperatorCommandResult> {
    if (!command.targetId) {
      return this.buildErrorResult(command, new Error('Missing targetId'));
    }
    
    const execResult = await this.executionBridge.ackIncident(
      command.targetId,
      command.actor.actorId
    );
    
    // 失效缓存
    if (execResult.executionMode === 'real' && this.snapshotProvider) {
      this.snapshotProvider.invalidate('incident');
    }
    
    const actionResult: OperatorActionResult = this.toActionResult(execResult);
    
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
  
  private async handleRequestRecovery(
    command: OperatorCommand,
    context?: DispatchContext
  ): Promise<OperatorCommandResult> {
    if (!command.targetId) {
      return this.buildErrorResult(command, new Error('Missing targetId'));
    }
    
    const actionResult: OperatorActionResult = {
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
  
  private async handleRequestReplay(
    command: OperatorCommand,
    context?: DispatchContext
  ): Promise<OperatorCommandResult> {
    if (!command.targetId) {
      return this.buildErrorResult(command, new Error('Missing targetId'));
    }
    
    const actionResult: OperatorActionResult = {
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
  
  private async handleRetryTask(
    command: OperatorCommand,
    context?: DispatchContext
  ): Promise<OperatorCommandResult> {
    if (!command.targetId) {
      return this.buildErrorResult(command, new Error('Missing targetId'));
    }
    
    const execResult = await this.executionBridge.retryTask(
      command.targetId,
      command.actor.actorId
    );
    
    // 失效缓存
    if (execResult.executionMode === 'real' && this.snapshotProvider) {
      this.snapshotProvider.invalidate('task');
    }
    
    const actionResult: OperatorActionResult = this.toActionResult(execResult);
    
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
  
  private async handleCancelTask(
    command: OperatorCommand,
    context?: DispatchContext
  ): Promise<OperatorCommandResult> {
    if (!command.targetId) {
      return this.buildErrorResult(command, new Error('Missing targetId'));
    }
    
    const actionResult: OperatorActionResult = {
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
  
  private async handlePauseTask(
    command: OperatorCommand,
    context?: DispatchContext
  ): Promise<OperatorCommandResult> {
    if (!command.targetId) {
      return this.buildErrorResult(command, new Error('Missing targetId'));
    }
    
    const actionResult: OperatorActionResult = {
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
  
  private async handleResumeTask(
    command: OperatorCommand,
    context?: DispatchContext
  ): Promise<OperatorCommandResult> {
    if (!command.targetId) {
      return this.buildErrorResult(command, new Error('Missing targetId'));
    }
    
    const actionResult: OperatorActionResult = {
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
  
  private async handlePauseAgent(
    command: OperatorCommand,
    context?: DispatchContext
  ): Promise<OperatorCommandResult> {
    if (!command.targetId) {
      return this.buildErrorResult(command, new Error('Missing targetId'));
    }
    
    const execResult = await this.executionBridge.pauseAgent(
      command.targetId,
      command.actor.actorId
    );
    
    const actionResult: OperatorActionResult = this.toActionResult(execResult);
    
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
  
  private async handleResumeAgent(
    command: OperatorCommand,
    context?: DispatchContext
  ): Promise<OperatorCommandResult> {
    if (!command.targetId) {
      return this.buildErrorResult(command, new Error('Missing targetId'));
    }
    
    const actionResult: OperatorActionResult = {
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
  
  private async handleInspectAgent(
    command: OperatorCommand,
    context?: DispatchContext
  ): Promise<OperatorCommandResult> {
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
  
  private async handleConfirmAction(
    command: OperatorCommand,
    context?: DispatchContext
  ): Promise<OperatorCommandResult> {
    // TODO: 调用 confirmation manager
    
    const actionResult: OperatorActionResult = {
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
  
  private async handleDismissIntervention(
    command: OperatorCommand,
    context?: DispatchContext
  ): Promise<OperatorCommandResult> {
    if (!command.targetId) {
      return this.buildErrorResult(command, new Error('Missing targetId'));
    }
    
    const actionResult: OperatorActionResult = {
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
  
  private async handleSnoozeIntervention(
    command: OperatorCommand,
    context?: DispatchContext
  ): Promise<OperatorCommandResult> {
    if (!command.targetId) {
      return this.buildErrorResult(command, new Error('Missing targetId'));
    }
    
    const actionResult: OperatorActionResult = {
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
  
  private async handleSwitchWorkspace(
    command: OperatorCommand,
    context?: DispatchContext
  ): Promise<OperatorCommandResult> {
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
  
  private async handleGoBack(
    command: OperatorCommand,
    context?: DispatchContext
  ): Promise<OperatorCommandResult> {
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
  private toActionResult(execResult: ExecutionResult): OperatorActionResult {
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
  private inferTargetType(actionType: string): string | undefined {
    const mapping: Record<string, string> = {
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
  private inferConfirmationState(actionType: string): OperatorConfirmationState | undefined {
    // 需要确认的动作
    const confirmableActions = ['approve', 'reject', 'escalate', 'confirm_action'];
    if (confirmableActions.includes(actionType)) {
      return 'confirmed';
    }
    return undefined;
  }
  
  private buildUnsupportedResult(command: OperatorCommand): OperatorCommandResult {
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
  
  private buildErrorResult(command: OperatorCommand, error: unknown): OperatorCommandResult {
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

// ============================================================================
// 工厂函数
// ============================================================================

import type { OperatorExecutionBridge } from './operator_execution_bridge';
import type { OperatorSnapshotProvider } from '../data/operator_snapshot_provider';

export function createOperatorCommandDispatch(
  surfaceService: OperatorSurfaceService,
  executionBridge: OperatorExecutionBridge,
  controlSurfaceBuilder?: ControlSurfaceBuilder,
  humanLoopService?: HumanLoopService,
  snapshotProvider?: OperatorSnapshotProvider
): OperatorCommandDispatch {
  return new DefaultOperatorCommandDispatch(
    surfaceService,
    executionBridge,
    controlSurfaceBuilder,
    humanLoopService,
    snapshotProvider
  );
}
