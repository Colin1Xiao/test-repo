/**
 * Status Projection - 状态投影统一出口
 *
 * 职责：
 * 1. 统一出口
 * 2. 输入：control surface snapshot + projection options + filter / sort / focus
 * 3. 输出：dashboard projection result + formatted sections + attention summary + recommended actions
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { ControlSurfaceSnapshot, ControlAction } from './control_types';
import type { DashboardSnapshot, ProjectionResult, ProjectionOptions, ProjectionMode, ProjectionTarget, RefreshResult, AttentionItem } from './dashboard_types';
/**
 * 状态投影器配置
 */
export interface StatusProjectionConfig {
    /** 自动刷新间隔（毫秒） */
    autoRefreshIntervalMs?: number;
    /** 最大陈旧时间（毫秒） */
    maxStaleMs?: number;
    /** 默认投影模式 */
    defaultMode?: ProjectionMode;
    /** 默认投影目标 */
    defaultTarget?: ProjectionTarget;
}
/**
 * 状态投影结果
 */
export interface StatusProjectionResult {
    /** 仪表盘快照 */
    dashboard: DashboardSnapshot;
    /** 投影结果 */
    projection: ProjectionResult;
    /** 关注项摘要 */
    attentionSummary: {
        total: number;
        critical: number;
        high: number;
        medium: number;
        topItems: AttentionItem[];
    };
    /** 建议动作 */
    recommendedActions: ControlAction[];
    /** 新鲜度 */
    freshness: {
        ageMs: number;
        isStale: boolean;
        staleMs: number;
    };
    /** 变化（如果有） */
    changes?: any;
}
export declare class StatusProjection {
    private config;
    private dashboardBuilder;
    private projectionService;
    private refreshManager;
    private attentionEngine;
    constructor(config?: StatusProjectionConfig);
    /**
     * 投影状态
     */
    projectStatus(controlSnapshot: ControlSurfaceSnapshot, options?: ProjectionOptions): StatusProjectionResult;
    /**
     * 投影为摘要模式
     */
    projectSummary(controlSnapshot: ControlSurfaceSnapshot, target?: ProjectionTarget): StatusProjectionResult;
    /**
     * 投影为详情模式
     */
    projectDetail(controlSnapshot: ControlSurfaceSnapshot, target?: ProjectionTarget): StatusProjectionResult;
    /**
     * 投影为操作员模式
     */
    projectOperator(controlSnapshot: ControlSurfaceSnapshot, target?: ProjectionTarget): StatusProjectionResult;
    /**
     * 投影为管理模式
     */
    projectManagement(controlSnapshot: ControlSurfaceSnapshot, target?: ProjectionTarget): StatusProjectionResult;
    /**
     * 启动自动刷新
     */
    startAutoRefresh(controlSnapshotProvider: () => ControlSurfaceSnapshot, onRefresh?: (result: RefreshResult) => void): void;
    /**
     * 停止自动刷新
     */
    stopAutoRefresh(): void;
    /**
     * 检测陈旧
     */
    detectStale(): {
        isStale: boolean;
        staleMs: number;
        maxStaleMs: number;
        suggestedAction: 'refresh' | 'ignore' | 'warn';
    };
    /**
     * 获取当前仪表盘
     */
    getCurrentDashboard(): DashboardSnapshot | null;
    /**
     * 注册刷新监听器
     */
    onRefresh(listener: (result: RefreshResult) => void): void;
    /**
     * 构建关注项摘要
     */
    private buildAttentionSummary;
}
/**
 * 创建状态投影器
 */
export declare function createStatusProjection(config?: StatusProjectionConfig): StatusProjection;
/**
 * 快速投影状态
 */
export declare function projectStatus(controlSnapshot: ControlSurfaceSnapshot, options?: ProjectionOptions, config?: StatusProjectionConfig): StatusProjectionResult;
/**
 * 快速投影摘要
 */
export declare function projectStatusSummary(controlSnapshot: ControlSurfaceSnapshot, target?: ProjectionTarget): StatusProjectionResult;
/**
 * 快速投影操作员视图
 */
export declare function projectOperatorView(controlSnapshot: ControlSurfaceSnapshot, target?: ProjectionTarget): StatusProjectionResult;
