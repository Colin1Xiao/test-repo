/**
 * Operator Context Adapter
 * Phase 2A-1R - 桥接到 Sprint 6 语义层
 *
 * 职责：
 * - 获取当前 workspace 的 ControlSurfaceSnapshot
 * - 获取 Dashboard Projection
 * - 获取 Human Loop Snapshot
 * - 提供标准读接口给 surface service / dispatch
 */
import type { ControlSurfaceSnapshot } from '../ux/control_types';
import type { DashboardSnapshot } from '../ux/dashboard_types';
import type { HumanLoopSnapshot } from '../ux/hitl_types';
export interface OperatorContextAdapterConfig {
    /** 默认 workspace ID */
    defaultWorkspaceId?: string;
    /** 是否启用自动刷新 */
    enableAutoRefresh?: boolean;
    /** 自动刷新间隔（毫秒） */
    autoRefreshIntervalMs?: number;
}
export interface OperatorContextAdapter {
    /**
     * 获取 ControlSurface 快照
     */
    getControlSnapshot(workspaceId?: string): Promise<ControlSurfaceSnapshot>;
    /**
     * 获取 Dashboard 快照
     */
    getDashboardSnapshot(workspaceId?: string, mode?: string): Promise<DashboardSnapshot>;
    /**
     * 获取 Human Loop 快照
     */
    getHumanLoopSnapshot(workspaceId?: string): Promise<HumanLoopSnapshot>;
    /**
     * 获取完整上下文（一次性获取所有快照）
     */
    getFullContext(workspaceId?: string): Promise<{
        control: ControlSurfaceSnapshot;
        dashboard: DashboardSnapshot;
        humanLoop: HumanLoopSnapshot;
    }>;
}
export declare class DefaultOperatorContextAdapter implements OperatorContextAdapter {
    private config;
    private controlSurfaceBuilder;
    private statusProjection;
    private humanLoopService;
    private controlCache;
    private dashboardCache;
    private humanLoopCache;
    constructor(config?: OperatorContextAdapterConfig);
    getControlSnapshot(workspaceId?: string): Promise<ControlSurfaceSnapshot>;
    getDashboardSnapshot(workspaceId?: string, mode?: string): Promise<DashboardSnapshot>;
    getHumanLoopSnapshot(workspaceId?: string): Promise<HumanLoopSnapshot>;
    getFullContext(workspaceId?: string): Promise<{
        control: ControlSurfaceSnapshot;
        dashboard: DashboardSnapshot;
        humanLoop: HumanLoopSnapshot;
    }>;
    /**
     * 获取 ControlSurface 快照（TODO: 需要接入真实数据源）
     */
    private fetchControlSnapshot;
    /**
     * 投影 Dashboard
     */
    private projectDashboard;
    /**
     * 处理 Human Loop
     */
    private processHumanLoop;
    /**
     * 清除缓存
     */
    clearCache(workspaceId?: string): void;
}
export declare function createOperatorContextAdapter(config?: OperatorContextAdapterConfig): OperatorContextAdapter;
