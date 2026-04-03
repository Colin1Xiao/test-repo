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
import type {
  OperatorSnapshotProvider,
  DataSourceHealth,
} from '../data/operator_snapshot_provider';
import { StatusProjection } from '../ux/status_projection';
import { HumanLoopService } from '../ux/human_loop_service';

// ============================================================================
// 数据来源模式
// ============================================================================

export type DataSourceMode = "real" | "synthesized" | "mock";

// ============================================================================
// 适配器配置
// ============================================================================

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

// ============================================================================
// 适配器接口
// ============================================================================

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

// ============================================================================
// 默认实现
// ============================================================================

export class DefaultOperatorContextAdapterV2 implements OperatorContextAdapterV2 {
  private config: Required<OperatorContextAdapterV2Config>;
  private snapshotProvider: OperatorSnapshotProvider;
  private statusProjection: StatusProjection;
  private humanLoopService: HumanLoopService;
  
  // 缓存
  private controlCache: { snapshot: ControlSurfaceSnapshot | null; cachedAt: number } = { snapshot: null, cachedAt: 0 };
  private dashboardCache: { snapshot: DashboardSnapshot | null; cachedAt: number } = { snapshot: null, cachedAt: 0 };
  private humanLoopCache: { snapshot: HumanLoopSnapshot | null; cachedAt: number } = { snapshot: null, cachedAt: 0 };
  
  constructor(
    config: OperatorContextAdapterV2Config,
    snapshotProvider: OperatorSnapshotProvider
  ) {
    this.config = {
      defaultWorkspaceId: config.defaultWorkspaceId ?? 'default',
      enableAutoRefresh: config.enableAutoRefresh ?? false,
      autoRefreshIntervalMs: config.autoRefreshIntervalMs ?? 30000,
      maxStaleMs: config.maxStaleMs ?? 120000,
    };
    
    this.snapshotProvider = snapshotProvider;
    this.statusProjection = new StatusProjection();
    this.humanLoopService = new HumanLoopService();
  }
  
  async getControlSnapshot(workspaceId?: string): Promise<ControlSurfaceSnapshot> {
    const wsId = workspaceId ?? this.config.defaultWorkspaceId;
    
    // 检查缓存
    if (this.controlCache.snapshot && Date.now() - this.controlCache.cachedAt < this.config.autoRefreshIntervalMs) {
      return this.controlCache.snapshot;
    }
    
    // 从 SnapshotProvider 获取真实数据
    const snapshot = await this.snapshotProvider.getControlSnapshot(wsId);
    
    // 更新缓存
    this.controlCache = {
      snapshot,
      cachedAt: Date.now(),
    };
    
    return snapshot;
  }
  
  async getDashboardSnapshot(workspaceId?: string, mode?: string): Promise<DashboardSnapshot> {
    const wsId = workspaceId ?? this.config.defaultWorkspaceId;
    
    // 检查缓存
    if (this.dashboardCache.snapshot && Date.now() - this.dashboardCache.cachedAt < this.config.autoRefreshIntervalMs) {
      return this.dashboardCache.snapshot;
    }
    
    // 获取 ControlSnapshot 并投影
    const controlSnapshot = await this.getControlSnapshot(wsId);
    
    // 使用 StatusProjection 进行真实投影
    const projectionResult = this.statusProjection.projectSummary(controlSnapshot);
    
    // 转换为 DashboardSnapshot
    const dashboard: DashboardSnapshot = {
      dashboardId: `dashboard_${controlSnapshot.snapshotId}`,
      sourceSnapshotId: controlSnapshot.snapshotId,
      createdAt: controlSnapshot.createdAt,
      updatedAt: Date.now(),
      freshnessMs: Date.now() - controlSnapshot.createdAt,
      summary: projectionResult.dashboard.summary,
      sections: projectionResult.dashboard.sections,
      attentionItems: projectionResult.attentionSummary.topItems,
      recommendedActions: controlSnapshot.availableActions,
    };
    
    // 更新缓存
    this.dashboardCache = {
      snapshot: dashboard,
      cachedAt: Date.now(),
    };
    
    return dashboard;
  }
  
  async getHumanLoopSnapshot(workspaceId?: string): Promise<HumanLoopSnapshot> {
    // 检查缓存
    if (this.humanLoopCache.snapshot && Date.now() - this.humanLoopCache.cachedAt < this.config.autoRefreshIntervalMs) {
      return this.humanLoopCache.snapshot;
    }
    
    // 获取 Dashboard 并处理
    const dashboard = await this.getDashboardSnapshot(workspaceId);
    
    // 使用 HumanLoopService 处理
    const humanLoop = this.humanLoopService.processDashboardSnapshot(dashboard);
    
    // 更新缓存
    this.humanLoopCache = {
      snapshot: humanLoop,
      cachedAt: Date.now(),
    };
    
    return humanLoop;
  }
  
  async getFullContext(workspaceId?: string): Promise<{
    control: ControlSurfaceSnapshot;
    dashboard: DashboardSnapshot;
    humanLoop: HumanLoopSnapshot;
  }> {
    const wsId = workspaceId ?? this.config.defaultWorkspaceId;
    
    const [control, dashboard, humanLoop] = await Promise.all([
      this.getControlSnapshot(wsId),
      this.getDashboardSnapshot(wsId),
      this.getHumanLoopSnapshot(wsId),
    ]);
    
    return { control, dashboard, humanLoop };
  }
  
  async getDataSourceHealth(): Promise<DataSourceHealth> {
    return await this.snapshotProvider.getDataSourceHealth();
  }
  
  async refresh(): Promise<void> {
    // 清除缓存
    this.controlCache = { snapshot: null, cachedAt: 0 };
    this.dashboardCache = { snapshot: null, cachedAt: 0 };
    this.humanLoopCache = { snapshot: null, cachedAt: 0 };
    
    // 刷新 SnapshotProvider
    await this.snapshotProvider.refresh();
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createOperatorContextAdapterV2(
  config: OperatorContextAdapterV2Config,
  snapshotProvider: OperatorSnapshotProvider
): OperatorContextAdapterV2 {
  return new DefaultOperatorContextAdapterV2(config, snapshotProvider);
}
