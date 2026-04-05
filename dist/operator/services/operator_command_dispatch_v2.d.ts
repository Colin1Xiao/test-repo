/**
 * Operator Command Dispatch V2
 * Phase 2A-2A-I - 集成 Session/Workspace
 *
 * 职责：
 * - 继承 DefaultOperatorCommandDispatch
 * - 集成 SessionStore 更新 navigation state
 * - 集成 WorkspaceSwitcher 处理 switch_workspace
 */
import type { DispatchContext, OperatorCommand, OperatorCommandResult } from '../types/surface_types';
import type { OperatorSurfaceService } from './operator_surface_service';
import type { OperatorExecutionBridge } from './operator_execution_bridge';
import type { SessionStore, WorkspaceSwitcher } from '../types/session_types';
export interface OperatorCommandDispatchV2Config {
    /** 是否自动更新 navigation state */
    autoUpdateNavigation?: boolean;
}
export declare class OperatorCommandDispatchV2 {
    private surfaceService;
    private executionBridge;
    private sessionStore;
    private workspaceSwitcher;
    private config;
    constructor(surfaceService: OperatorSurfaceService, executionBridge: OperatorExecutionBridge, sessionStore: SessionStore, workspaceSwitcher: WorkspaceSwitcher, config?: OperatorCommandDispatchV2Config);
    dispatch(command: OperatorCommand, context?: DispatchContext): Promise<OperatorCommandResult>;
    private handleView;
    private handleOpenItem;
    private handleRefresh;
    private handleApprove;
    private handleReject;
    private handleAckIncident;
    private handleRetryTask;
    private handlePauseAgent;
    private handleSwitchWorkspace;
    private handleGoBack;
    private buildUnsupportedResult;
    private buildErrorResult;
}
export declare function createOperatorCommandDispatchV2(surfaceService: OperatorSurfaceService, executionBridge: OperatorExecutionBridge, sessionStore: SessionStore, workspaceSwitcher: WorkspaceSwitcher, config?: OperatorCommandDispatchV2Config): OperatorCommandDispatchV2;
