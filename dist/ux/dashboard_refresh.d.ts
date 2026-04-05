/**
 * Dashboard Refresh - 仪表盘刷新
 *
 * 职责：
 * 1. 负责 dashboard 的刷新与陈旧判断
 * 2. refresh snapshot / compare previous snapshot / identify changes / deltas
 * 3. stale dashboard detection / incremental projection trigger
 * 4. 这个模块非常重要，因为它会把 dashboard 从"静态生成"推进到"运行时投影"
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { DashboardSnapshot, RefreshResult, StaleDetection, RefreshPolicy, DashboardChanges } from './dashboard_types';
import type { ControlSurfaceSnapshot } from './control_types';
import { DashboardBuilder } from './dashboard_builder';
export declare class DashboardRefreshManager {
    private policy;
    private dashboardBuilder;
    private currentSnapshot;
    private previousSnapshot;
    private refreshTimer;
    private refreshListeners;
    constructor(policy?: RefreshPolicy, dashboardBuilder?: DashboardBuilder);
    /**
     * 初始化仪表盘
     */
    initialize(controlSnapshot: ControlSurfaceSnapshot): DashboardSnapshot;
    /**
     * 刷新仪表盘
     */
    refresh(controlSnapshot: ControlSurfaceSnapshot, reason?: 'manual' | 'auto' | 'stale' | 'event_triggered'): RefreshResult;
    /**
     * 检测陈旧
     */
    detectStale(): StaleDetection;
    /**
     * 启动自动刷新
     */
    startAutoRefresh(controlSnapshotProvider: () => ControlSurfaceSnapshot): void;
    /**
     * 停止自动刷新
     */
    stopAutoRefresh(): void;
    /**
     * 触发事件刷新
     */
    triggerEventRefresh(eventType: string, controlSnapshotProvider: () => ControlSurfaceSnapshot): void;
    /**
     * 注册刷新监听器
     */
    onRefresh(listener: (result: RefreshResult) => void): void;
    /**
     * 注销刷新监听器
     */
    offRefresh(listener: (result: RefreshResult) => void): void;
    /**
     * 获取当前快照
     */
    getCurrentSnapshot(): DashboardSnapshot | null;
    /**
     * 获取上一个快照
     */
    getPreviousSnapshot(): DashboardSnapshot | null;
    /**
     * 获取新鲜度
     */
    getFreshness(): {
        ageMs: number;
        freshnessMs: number;
        isStale: boolean;
    };
    /**
     * 通知监听器
     */
    private notifyListeners;
}
export declare class ChangeDetector {
    /**
     * 检测仪表盘变化
     */
    detectChanges(oldDashboard: DashboardSnapshot, newDashboard: DashboardSnapshot): DashboardChanges;
    /**
     * 检测关注项变化
     */
    private detectAttentionChanges;
    /**
     * 检测分段变化
     */
    private detectSectionChanges;
    /**
     * 生成变化摘要
     */
    summarizeChanges(changes: DashboardChanges): string;
}
/**
 * 创建仪表盘刷新管理器
 */
export declare function createDashboardRefreshManager(policy?: RefreshPolicy, dashboardBuilder?: DashboardBuilder): DashboardRefreshManager;
/**
 * 快速检测陈旧
 */
export declare function detectStale(dashboard: DashboardSnapshot, maxStaleMs?: number): StaleDetection;
/**
 * 快速检测变化
 */
export declare function detectDashboardChanges(oldDashboard: DashboardSnapshot, newDashboard: DashboardSnapshot): DashboardChanges;
