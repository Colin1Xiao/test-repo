/**
 * CLI Cockpit V2
 * Phase 2A-2A-I - 集成 Session/Workspace
 *
 * 职责：
 * - 自动创建/复用 CLI Session
 * - 将 sessionId/workspaceId 注入 actor context
 * - Dispatch 后回写 navigation state
 */
import type { SurfaceRenderedResponse } from '../types/surface_types';
import type { CliRouter } from './cli_router';
import type { CliRenderer } from './cli_renderer';
import type { OperatorCommandDispatch } from '../services/operator_command_dispatch';
import type { OperatorSurfaceService } from '../services/operator_surface_service';
import type { SessionStore, WorkspaceRegistry } from '../types/session_types';
export interface CliCockpitV2Config {
    router: CliRouter;
    renderer: CliRenderer;
    dispatch: OperatorCommandDispatch;
    surfaceService: OperatorSurfaceService;
    sessionStore: SessionStore;
    workspaceRegistry: WorkspaceRegistry;
    defaultWorkspaceId?: string;
}
export interface CliCockpitV2 {
    /**
     * 处理 CLI 输入（带 Session）
     */
    handleInput(rawInput: string): Promise<SurfaceRenderedResponse>;
    /**
     * 获取当前 Session
     */
    getCurrentSession(): Promise<any | null>;
    /**
     * 清除当前 Session
     */
    clearSession(): Promise<void>;
}
export declare class DefaultCliCockpitV2 implements CliCockpitV2 {
    private config;
    private currentSession;
    constructor(config: CliCockpitV2Config);
    handleInput(rawInput: string): Promise<SurfaceRenderedResponse>;
    getCurrentSession(): Promise<any | null>;
    clearSession(): Promise<void>;
    private getOrCreateSession;
}
export declare function createCliCockpitV2(config: CliCockpitV2Config): CliCockpitV2;
