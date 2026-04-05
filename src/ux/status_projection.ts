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

import type {
  ControlSurfaceSnapshot,
  ControlAction,
} from './control_types';
import type {
  DashboardSnapshot,
  ProjectionResult,
  ProjectionOptions,
  ProjectionMode,
  ProjectionTarget,
  ProjectionFilter,
  ProjectionSort,
  ProjectionGroup,
  RefreshResult,
  AttentionItem,
} from './dashboard_types';
import { DashboardBuilder, buildDashboardSnapshot } from './dashboard_builder';
import { ProjectionService, projectDashboard } from './projection_service';
import {
  DashboardRefreshManager,
  createDashboardRefreshManager,
  detectStale,
} from './dashboard_refresh';
import { AttentionEngine, analyzeAttention } from './attention_engine';

// ============================================================================
// 类型定义
// ============================================================================

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

// ============================================================================
// 状态投影器
// ============================================================================

export class StatusProjection {
  private config: Required<StatusProjectionConfig>;
  private dashboardBuilder: DashboardBuilder;
  private projectionService: ProjectionService;
  private refreshManager: DashboardRefreshManager;
  private attentionEngine: AttentionEngine;
  
  constructor(config: StatusProjectionConfig = {}) {
    this.config = {
      autoRefreshIntervalMs: config.autoRefreshIntervalMs ?? 30000,
      maxStaleMs: config.maxStaleMs ?? 120000,
      defaultMode: config.defaultMode ?? 'summary',
      defaultTarget: config.defaultTarget ?? 'api',
    };
    
    this.dashboardBuilder = new DashboardBuilder();
    this.projectionService = new ProjectionService();
    this.attentionEngine = new AttentionEngine();
    
    this.refreshManager = createDashboardRefreshManager(
      {
        autoRefreshIntervalMs: this.config.autoRefreshIntervalMs,
        maxStaleMs: this.config.maxStaleMs,
      },
      this.dashboardBuilder
    );
  }
  
  /**
   * 投影状态
   */
  projectStatus(
    controlSnapshot: ControlSurfaceSnapshot,
    options?: ProjectionOptions
  ): StatusProjectionResult {
    // 构建仪表盘
    const dashboard = this.dashboardBuilder.buildDashboardSnapshot(controlSnapshot);
    
    // 刷新管理器
    const refreshResult = this.refreshManager.refresh(controlSnapshot);
    
    // 投影
    const projectionOptions: ProjectionOptions = {
      mode: options?.mode || this.config.defaultMode,
      target: options?.target || this.config.defaultTarget,
      filter: options?.filter,
      sort: options?.sort,
      group: options?.group,
      focus: options?.focus,
      maxItems: options?.maxItems,
    };
    
    const projection = this.projectionService.project(dashboard, projectionOptions);
    
    // 关注项摘要
    const attentionSummary = this.buildAttentionSummary(dashboard.attentionItems);
    
    // 新鲜度
    const freshness = this.refreshManager.getFreshness();
    
    return {
      dashboard,
      projection,
      attentionSummary,
      recommendedActions: dashboard.recommendedActions,
      freshness: {
        ageMs: freshness.ageMs,
        isStale: freshness.isStale,
        staleMs: freshness.freshnessMs,
      },
      changes: refreshResult.changes,
    };
  }
  
  /**
   * 投影为摘要模式
   */
  projectSummary(
    controlSnapshot: ControlSurfaceSnapshot,
    target?: ProjectionTarget
  ): StatusProjectionResult {
    return this.projectStatus(controlSnapshot, {
      mode: 'summary',
      target: target || this.config.defaultTarget,
      maxItems: 10,
    });
  }
  
  /**
   * 投影为详情模式
   */
  projectDetail(
    controlSnapshot: ControlSurfaceSnapshot,
    target?: ProjectionTarget
  ): StatusProjectionResult {
    return this.projectStatus(controlSnapshot, {
      mode: 'detail',
      target: target || this.config.defaultTarget,
      maxItems: 100,
    });
  }
  
  /**
   * 投影为操作员模式
   */
  projectOperator(
    controlSnapshot: ControlSurfaceSnapshot,
    target?: ProjectionTarget
  ): StatusProjectionResult {
    return this.projectStatus(controlSnapshot, {
      mode: 'operator',
      target: target || this.config.defaultTarget,
      filter: { attentionOnly: true },
      maxItems: 50,
    });
  }
  
  /**
   * 投影为管理模式
   */
  projectManagement(
    controlSnapshot: ControlSurfaceSnapshot,
    target?: ProjectionTarget
  ): StatusProjectionResult {
    return this.projectStatus(controlSnapshot, {
      mode: 'management',
      target: target || this.config.defaultTarget,
      maxItems: 20,
    });
  }
  
  /**
   * 启动自动刷新
   */
  startAutoRefresh(
    controlSnapshotProvider: () => ControlSurfaceSnapshot,
    onRefresh?: (result: RefreshResult) => void
  ): void {
    this.refreshManager.startAutoRefresh(controlSnapshotProvider);
    
    if (onRefresh) {
      this.refreshManager.onRefresh(onRefresh);
    }
  }
  
  /**
   * 停止自动刷新
   */
  stopAutoRefresh(): void {
    this.refreshManager.stopAutoRefresh();
  }
  
  /**
   * 检测陈旧
   */
  detectStale(): {
    isStale: boolean;
    staleMs: number;
    maxStaleMs: number;
    suggestedAction: 'refresh' | 'ignore' | 'warn';
  } {
    return this.refreshManager.detectStale();
  }
  
  /**
   * 获取当前仪表盘
   */
  getCurrentDashboard(): DashboardSnapshot | null {
    return this.refreshManager.getCurrentSnapshot();
  }
  
  /**
   * 注册刷新监听器
   */
  onRefresh(listener: (result: RefreshResult) => void): void {
    this.refreshManager.onRefresh(listener);
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 构建关注项摘要
   */
  private buildAttentionSummary(attentionItems: AttentionItem[]): StatusProjectionResult['attentionSummary'] {
    const critical = attentionItems.filter(i => i.severity === 'critical').length;
    const high = attentionItems.filter(i => i.severity === 'high').length;
    const medium = attentionItems.filter(i => i.severity === 'medium').length;
    
    return {
      total: attentionItems.length,
      critical,
      high,
      medium,
      topItems: attentionItems.slice(0, 10),
    };
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建状态投影器
 */
export function createStatusProjection(config?: StatusProjectionConfig): StatusProjection {
  return new StatusProjection(config);
}

/**
 * 快速投影状态
 */
export function projectStatus(
  controlSnapshot: ControlSurfaceSnapshot,
  options?: ProjectionOptions,
  config?: StatusProjectionConfig
): StatusProjectionResult {
  const projection = new StatusProjection(config);
  return projection.projectStatus(controlSnapshot, options);
}

/**
 * 快速投影摘要
 */
export function projectStatusSummary(
  controlSnapshot: ControlSurfaceSnapshot,
  target?: ProjectionTarget
): StatusProjectionResult {
  const projection = new StatusProjection();
  return projection.projectSummary(controlSnapshot, target);
}

/**
 * 快速投影操作员视图
 */
export function projectOperatorView(
  controlSnapshot: ControlSurfaceSnapshot,
  target?: ProjectionTarget
): StatusProjectionResult {
  const projection = new StatusProjection();
  return projection.projectOperator(controlSnapshot, target);
}
