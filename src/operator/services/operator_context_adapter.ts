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
import { ControlSurfaceBuilder } from '../ux/control_surface';
import { StatusProjection } from '../ux/status_projection';
import { HumanLoopService } from '../ux/human_loop_service';

// ============================================================================
// 适配器配置
// ============================================================================

export interface OperatorContextAdapterConfig {
  /** 默认 workspace ID */
  defaultWorkspaceId?: string;
  
  /** 是否启用自动刷新 */
  enableAutoRefresh?: boolean;
  
  /** 自动刷新间隔（毫秒） */
  autoRefreshIntervalMs?: number;
}

// ============================================================================
// 适配器接口
// ============================================================================

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

// ============================================================================
// 默认实现
// ============================================================================

export class DefaultOperatorContextAdapter implements OperatorContextAdapter {
  private config: Required<OperatorContextAdapterConfig>;
  private controlSurfaceBuilder: ControlSurfaceBuilder | null = null;
  private statusProjection: StatusProjection | null = null;
  private humanLoopService: HumanLoopService | null = null;
  
  // 缓存
  private controlCache: Map<string, { snapshot: ControlSurfaceSnapshot; cachedAt: number }> = new Map();
  private dashboardCache: Map<string, { snapshot: DashboardSnapshot; cachedAt: number }> = new Map();
  private humanLoopCache: Map<string, { snapshot: HumanLoopSnapshot; cachedAt: number }> = new Map();
  
  constructor(config: OperatorContextAdapterConfig = {}) {
    this.config = {
      defaultWorkspaceId: config.defaultWorkspaceId ?? 'default',
      enableAutoRefresh: config.enableAutoRefresh ?? false,
      autoRefreshIntervalMs: config.autoRefreshIntervalMs ?? 30000,
    };
  }
  
  async getControlSnapshot(workspaceId?: string): Promise<ControlSurfaceSnapshot> {
    const wsId = workspaceId ?? this.config.defaultWorkspaceId;
    
    // 检查缓存
    const cached = this.controlCache.get(wsId);
    if (cached && Date.now() - cached.cachedAt < this.config.autoRefreshIntervalMs) {
      return cached.snapshot;
    }
    
    // 获取真实数据（TODO: 需要接入真实数据源）
    const snapshot = await this.fetchControlSnapshot(wsId);
    
    // 更新缓存
    this.controlCache.set(wsId, {
      snapshot,
      cachedAt: Date.now(),
    });
    
    return snapshot;
  }
  
  async getDashboardSnapshot(workspaceId?: string, mode?: string): Promise<DashboardSnapshot> {
    const wsId = workspaceId ?? this.config.defaultWorkspaceId;
    
    // 检查缓存
    const cached = this.dashboardCache.get(wsId);
    if (cached && Date.now() - cached.cachedAt < this.config.autoRefreshIntervalMs) {
      return cached.snapshot;
    }
    
    // 获取 ControlSnapshot 并投影
    const controlSnapshot = await this.getControlSnapshot(wsId);
    const dashboard = this.projectDashboard(controlSnapshot, mode);
    
    // 更新缓存
    this.dashboardCache.set(wsId, {
      snapshot: dashboard,
      cachedAt: Date.now(),
    });
    
    return dashboard;
  }
  
  async getHumanLoopSnapshot(workspaceId?: string): Promise<HumanLoopSnapshot> {
    const wsId = workspaceId ?? this.config.defaultWorkspaceId;
    
    // 检查缓存
    const cached = this.humanLoopCache.get(wsId);
    if (cached && Date.now() - cached.cachedAt < this.config.autoRefreshIntervalMs) {
      return cached.snapshot;
    }
    
    // 获取 Dashboard 并处理
    const dashboard = await this.getDashboardSnapshot(wsId);
    const humanLoop = this.processHumanLoop(dashboard);
    
    // 更新缓存
    this.humanLoopCache.set(wsId, {
      snapshot: humanLoop,
      cachedAt: Date.now(),
    });
    
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
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 获取 ControlSurface 快照（TODO: 需要接入真实数据源）
   */
  private async fetchControlSnapshot(workspaceId: string): Promise<ControlSurfaceSnapshot> {
    // TODO: 这里需要接入真实的数据源
    // 目前返回一个 mock 快照用于测试
    
    const now = Date.now();
    
    return {
      snapshotId: `control_${workspaceId}_${now}`,
      createdAt: now,
      taskView: {
        activeTasks: [],
        blockedTasks: [],
        recentCompletedTasks: [],
        failedTasks: [],
        totalTasks: 0,
      },
      approvalView: {
        pendingApprovals: [],
        bottlenecks: [],
        timeoutApprovals: [],
        recentDecidedApprovals: [],
        totalApprovals: 0,
      },
      opsView: {
        overallStatus: 'healthy',
        healthScore: 100,
        degradedServers: [],
        blockedSkills: [],
        pendingApprovals: 0,
        activeIncidents: [],
        topFailures: [],
        replayHotspots: [],
      },
      agentView: {
        busyAgents: [],
        blockedAgents: [],
        unhealthyAgents: [],
        offlineAgents: [],
        totalAgents: 0,
      },
      availableActions: [],
      summary: {
        totalTasks: 0,
        pendingApprovals: 0,
        healthScore: 100,
        activeAgents: 0,
        attentionItems: 0,
      },
    };
  }
  
  /**
   * 投影 Dashboard
   */
  private projectDashboard(
    controlSnapshot: ControlSurfaceSnapshot,
    mode?: string
  ): DashboardSnapshot {
    // TODO: 使用 StatusProjection 进行真实投影
    // 目前返回一个简化版本
    
    const now = Date.now();
    
    return {
      dashboardId: `dashboard_${controlSnapshot.snapshotId}`,
      sourceSnapshotId: controlSnapshot.snapshotId,
      createdAt: now,
      updatedAt: now,
      freshnessMs: 0,
      summary: {
        overallStatus: controlSnapshot.opsView.overallStatus === 'healthy' ? 'healthy' : 'degraded',
        totalTasks: controlSnapshot.summary.totalTasks,
        blockedTasks: controlSnapshot.taskView.blockedTasks.length,
        pendingApprovals: controlSnapshot.approvalView.pendingApprovals.length,
        activeIncidents: controlSnapshot.opsView.activeIncidents.length,
        degradedAgents: controlSnapshot.agentView.unhealthyAgents.length,
        healthScore: controlSnapshot.summary.healthScore,
        attentionCount: controlSnapshot.summary.attentionItems,
      },
      sections: [],
      attentionItems: [],
      recommendedActions: controlSnapshot.availableActions,
    };
  }
  
  /**
   * 处理 Human Loop
   */
  private processHumanLoop(dashboard: DashboardSnapshot): HumanLoopSnapshot {
    // TODO: 使用 HumanLoopService 进行真实处理
    // 目前返回一个简化版本
    
    const now = Date.now();
    
    return {
      snapshotId: `humanloop_${dashboard.dashboardId}`,
      createdAt: now,
      openInterventions: [],
      queuedConfirmations: [],
      suggestions: [],
      workflows: [],
      trail: [],
      summary: {
        openCount: 0,
        criticalCount: 0,
        pendingConfirmations: 0,
        escalatedCount: 0,
      },
    };
  }
  
  /**
   * 清除缓存
   */
  clearCache(workspaceId?: string): void {
    if (workspaceId) {
      this.controlCache.delete(workspaceId);
      this.dashboardCache.delete(workspaceId);
      this.humanLoopCache.delete(workspaceId);
    } else {
      this.controlCache.clear();
      this.dashboardCache.clear();
      this.humanLoopCache.clear();
    }
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createOperatorContextAdapter(
  config?: OperatorContextAdapterConfig
): OperatorContextAdapter {
  return new DefaultOperatorContextAdapter(config);
}
