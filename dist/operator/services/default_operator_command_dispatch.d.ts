/**
 * Default Operator Command Dispatch
 * Phase 2A-1R - 命令分发实现
 *
 * 职责：
 * - 实现 OperatorCommandDispatch 接口
 * - 映射命令到真实动作
 * - 依赖：OperatorSurfaceService, ControlSurface, HumanLoopService
 */
import type { DispatchContext, OperatorCommand, OperatorCommandResult, OperatorCommandDispatch } from '../types/surface_types';
import type { OperatorSurfaceService } from './operator_surface_service';
import type { ControlSurfaceBuilder } from '../ux/control_surface';
import type { HumanLoopService } from '../ux/human_loop_service';
import type { OperatorExecutionBridge } from './operator_execution_bridge';
export declare class DefaultOperatorCommandDispatch implements OperatorCommandDispatch {
    private surfaceService;
    private executionBridge;
    private controlSurfaceBuilder;
    private humanLoopService;
    private snapshotProvider;
    constructor(surfaceService: OperatorSurfaceService, executionBridge: OperatorExecutionBridge, controlSurfaceBuilder?: ControlSurfaceBuilder, humanLoopService?: HumanLoopService, snapshotProvider?: any);
    dispatch(command: OperatorCommand, context?: DispatchContext): Promise<OperatorCommandResult>;
    private handleView;
    private handleOpenItem;
    private handleRefresh;
    private handleApprove;
    private handleReject;
    private handleEscalate;
    private handleAckIncident;
    private handleRequestRecovery;
    private handleRequestReplay;
    private handleRetryTask;
    private handleCancelTask;
    private handlePauseTask;
    private handleResumeTask;
    private handlePauseAgent;
    private handleResumeAgent;
    private handleInspectAgent;
    private handleConfirmAction;
    private handleDismissIntervention;
    private handleSnoozeIntervention;
    private handleSwitchWorkspace;
    private handleGoBack;
    /**
     * 将 ExecutionResult 转换为 OperatorActionResult
     */
    private toActionResult;
    /**
     * 根据动作类型推断目标类型
     */
    private inferTargetType;
    /**
     * 根据动作类型推断确认状态
     */
    private inferConfirmationState;
    private buildUnsupportedResult;
    private buildErrorResult;
}
import type { OperatorSnapshotProvider } from '../data/operator_snapshot_provider';
export declare function createOperatorCommandDispatch(surfaceService: OperatorSurfaceService, executionBridge: OperatorExecutionBridge, controlSurfaceBuilder?: ControlSurfaceBuilder, humanLoopService?: HumanLoopService, snapshotProvider?: OperatorSnapshotProvider): OperatorCommandDispatch;
