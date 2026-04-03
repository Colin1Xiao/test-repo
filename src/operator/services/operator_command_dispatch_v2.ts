/**
 * Operator Command Dispatch V2
 * Phase 2A-2A-I - 集成 Session/Workspace
 * 
 * 职责：
 * - 继承 DefaultOperatorCommandDispatch
 * - 集成 SessionStore 更新 navigation state
 * - 集成 WorkspaceSwitcher 处理 switch_workspace
 */

import type {
  DispatchContext,
  OperatorCommand,
  OperatorCommandResult,
  OperatorActionResult,
  OperatorCommandError,
} from '../types/surface_types';
import type { OperatorSurfaceService } from './operator_surface_service';
import type { OperatorExecutionBridge } from './operator_execution_bridge';
import type { SessionStore, WorkspaceSwitcher } from '../types/session_types';

// ============================================================================
// 配置
// ============================================================================

export interface OperatorCommandDispatchV2Config {
  /** 是否自动更新 navigation state */
  autoUpdateNavigation?: boolean;
}

// ============================================================================
// V2 实现
// ============================================================================

export class OperatorCommandDispatchV2 {
  private surfaceService: OperatorSurfaceService;
  private executionBridge: OperatorExecutionBridge;
  private sessionStore: SessionStore;
  private workspaceSwitcher: WorkspaceSwitcher;
  private config: Required<OperatorCommandDispatchV2Config>;
  
  constructor(
    surfaceService: OperatorSurfaceService,
    executionBridge: OperatorExecutionBridge,
    sessionStore: SessionStore,
    workspaceSwitcher: WorkspaceSwitcher,
    config: OperatorCommandDispatchV2Config = {}
  ) {
    this.surfaceService = surfaceService;
    this.executionBridge = executionBridge;
    this.sessionStore = sessionStore;
    this.workspaceSwitcher = workspaceSwitcher;
    this.config = {
      autoUpdateNavigation: config.autoUpdateNavigation ?? true,
    };
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
        currentView: viewKind,
        lastCommandAt: Date.now(),
      } : {
        currentView: viewKind,
        lastCommandAt: Date.now(),
      },
      respondedAt: Date.now(),
    };
  }
  
  private async handleOpenItem(
    command: OperatorCommand,
    context?: DispatchContext
  ): Promise<OperatorCommandResult> {
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
    
    const execResult = await this.executionBridge.approveApproval(
      command.targetId,
      command.actor.actorId
    );
    
    const actionResult: OperatorActionResult = {
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
    
    const actionResult: OperatorActionResult = {
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
    
    const actionResult: OperatorActionResult = {
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
    
    const actionResult: OperatorActionResult = {
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
    
    const actionResult: OperatorActionResult = {
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
  
  private async handleSwitchWorkspace(
    command: OperatorCommand,
    context?: DispatchContext
  ): Promise<OperatorCommandResult> {
    if (!command.targetId) {
      return this.buildErrorResult(command, new Error('Missing workspaceId'));
    }
    
    if (!context?.actor?.sessionId) {
      return this.buildErrorResult(command, new Error('Session required for workspace switch'));
    }
    
    // 使用 WorkspaceSwitcher 切换
    const switchResult = await this.workspaceSwitcher.switchWorkspace(
      context.actor.sessionId,
      command.targetId
    );
    
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

export function createOperatorCommandDispatchV2(
  surfaceService: OperatorSurfaceService,
  executionBridge: OperatorExecutionBridge,
  sessionStore: SessionStore,
  workspaceSwitcher: WorkspaceSwitcher,
  config?: OperatorCommandDispatchV2Config
): OperatorCommandDispatchV2 {
  return new OperatorCommandDispatchV2(
    surfaceService,
    executionBridge,
    sessionStore,
    workspaceSwitcher,
    config
  );
}
