/**
 * Operator Context Adapter V2
 * Phase 2A-1R′A - 使用真实数据源
 *
 * 职责：
 * - 使用 OperatorSnapshotProvider 获取真实数据
 * - 标注数据来源模式（real / synthesized / mock）
 * - 提供降级策略
 */
import type { ControlSurfaceSnapshot } from '../ux/control_types';
import type { DashboardSnapshot } from '../ux/dashboard_types';
import type { HumanLoopSnapshot } from '../ux/hitl_types';
import type { OperatorSnapshotProvider, DataSourceHealth } from '../data/operator_snapshot_provider';
export type DataSourceMode = "real" | "synthesized" | "mock";
export interface OperatorContextAdapterV2Config {
    /** 默认 workspace ID */
    defaultWorkspaceId?: string;
    /** 是否启用自动刷新 */
    enableAutoRefresh?: boolean;
    /** 自动刷新间隔（毫秒） */
    autoRefreshIntervalMs?: number;
    /** 最大陈旧时间（毫秒） */
    maxStaleMs?: number;
}
export interface OperatorContextAdapterV2 {
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
    /**
     * 获取数据源健康状态
     */
    getDataSourceHealth(): Promise<DataSourceHealth>;
    /**
     * 刷新所有数据
     */
    refresh(): Promise<void>;
}
export declare class DefaultOperatorContextAdapterV2 implements OperatorContextAdapterV2 {
    private config;
    private snapshotProvider;
    private statusProjection;
    private humanLoopService;
    private controlCache;
    private dashboardCache;
    private humanLoopCache;
    constructor(config: OperatorContextAdapterV2Config, snapshotProvider: OperatorSnapshotProvider);
    getControlSnapshot(workspaceId?: string): Promise<ControlSurfaceSnapshot>;
    getDashboardSnapshot(workspaceId?: string, mode?: string): Promise<DashboardSnapshot>;
    getHumanLoopSnapshot(workspaceId?: string): Promise<HumanLoopSnapshot>;
    getFullContext(workspaceId?: string): Promise<{
        control: ControlSurfaceSnapshot;
        dashboard: DashboardSnapshot;
        humanLoop: HumanLoopSnapshot;
    }>;
    getDataSourceHealth(): Promise<DataSourceHealth>;
    refresh(): Promise<void>;
}
export declare function createOperatorContextAdapterV2(config: OperatorContextAdapterV2Config, snapshotProvider: OperatorSnapshotProvider): OperatorContextAdapterV2;
