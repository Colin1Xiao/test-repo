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

import type {
  DashboardSnapshot,
  RefreshResult,
  StaleDetection,
  RefreshPolicy,
  DashboardChanges,
} from './dashboard_types';
import type { ControlSurfaceSnapshot } from './control_types';
import { DashboardBuilder } from './dashboard_builder';

// ============================================================================
// 仪表盘刷新管理器
// ============================================================================

export class DashboardRefreshManager {
  private policy: Required<RefreshPolicy>;
  private dashboardBuilder: DashboardBuilder;
  
  // 当前快照
  private currentSnapshot: DashboardSnapshot | null = null;
  
  // 上一个快照
  private previousSnapshot: DashboardSnapshot | null = null;
  
  // 刷新定时器
  private refreshTimer: NodeJS.Timeout | null = null;
  
  // 刷新监听器
  private refreshListeners: Array<(result: RefreshResult) => void> = [];
  
  constructor(
    policy?: RefreshPolicy,
    dashboardBuilder?: DashboardBuilder
  ) {
    this.policy = {
      autoRefreshIntervalMs: policy?.autoRefreshIntervalMs ?? 30000, // 30 秒
      maxStaleMs: policy?.maxStaleMs ?? 120000, // 2 分钟
      triggerEvents: policy?.triggerEvents ?? [],
    };
    this.dashboardBuilder = dashboardBuilder || new DashboardBuilder();
  }
  
  /**
   * 初始化仪表盘
   */
  initialize(controlSnapshot: ControlSurfaceSnapshot): DashboardSnapshot {
    const dashboard = this.dashboardBuilder.buildDashboardSnapshot(controlSnapshot);
    this.currentSnapshot = dashboard;
    return dashboard;
  }
  
  /**
   * 刷新仪表盘
   */
  refresh(
    controlSnapshot: ControlSurfaceSnapshot,
    reason: 'manual' | 'auto' | 'stale' | 'event_triggered' = 'manual'
  ): RefreshResult {
    const oldSnapshot = this.currentSnapshot;
    
    if (!oldSnapshot) {
      // 初始化
      const newDashboard = this.initialize(controlSnapshot);
      return {
        refreshed: true,
        reason,
        newSnapshot: newDashboard,
      };
    }
    
    // 构建新快照
    const { dashboard: newDashboard, changes } = this.dashboardBuilder.refreshDashboardSnapshot(
      oldSnapshot,
      controlSnapshot
    );
    
    // 更新快照
    this.previousSnapshot = oldSnapshot;
    this.currentSnapshot = newDashboard;
    
    // 通知监听器
    const result: RefreshResult = {
      refreshed: true,
      reason,
      newSnapshot: newDashboard,
      oldSnapshot: oldSnapshot,
      changes,
    };
    
    this.notifyListeners(result);
    
    return result;
  }
  
  /**
   * 检测陈旧
   */
  detectStale(): StaleDetection {
    if (!this.currentSnapshot) {
      return {
        isStale: true,
        staleMs: Infinity,
        maxStaleMs: this.policy.maxStaleMs,
        suggestedAction: 'refresh',
      };
    }
    
    const now = Date.now();
    const ageMs = now - this.currentSnapshot.updatedAt;
    const isStale = ageMs > this.policy.maxStaleMs;
    
    let suggestedAction: StaleDetection['suggestedAction'] = 'ignore';
    
    if (isStale) {
      suggestedAction = ageMs > this.policy.maxStaleMs * 2 ? 'warn' : 'refresh';
    }
    
    return {
      isStale,
      staleMs: ageMs,
      maxStaleMs: this.policy.maxStaleMs,
      suggestedAction,
    };
  }
  
  /**
   * 启动自动刷新
   */
  startAutoRefresh(
    controlSnapshotProvider: () => ControlSurfaceSnapshot
  ): void {
    this.stopAutoRefresh();
    
    this.refreshTimer = setInterval(() => {
      // 检测陈旧
      const staleDetection = this.detectStale();
      
      if (staleDetection.isStale) {
        // 自动刷新
        const newControlSnapshot = controlSnapshotProvider();
        this.refresh(newControlSnapshot, 'auto');
      }
    }, this.policy.autoRefreshIntervalMs);
  }
  
  /**
   * 停止自动刷新
   */
  stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
  
  /**
   * 触发事件刷新
   */
  triggerEventRefresh(
    eventType: string,
    controlSnapshotProvider: () => ControlSurfaceSnapshot
  ): void {
    if (this.policy.triggerEvents.includes(eventType)) {
      const newControlSnapshot = controlSnapshotProvider();
      this.refresh(newControlSnapshot, 'event_triggered');
    }
  }
  
  /**
   * 注册刷新监听器
   */
  onRefresh(listener: (result: RefreshResult) => void): void {
    this.refreshListeners.push(listener);
  }
  
  /**
   * 注销刷新监听器
   */
  offRefresh(listener: (result: RefreshResult) => void): void {
    const index = this.refreshListeners.indexOf(listener);
    if (index !== -1) {
      this.refreshListeners.splice(index, 1);
    }
  }
  
  /**
   * 获取当前快照
   */
  getCurrentSnapshot(): DashboardSnapshot | null {
    return this.currentSnapshot;
  }
  
  /**
   * 获取上一个快照
   */
  getPreviousSnapshot(): DashboardSnapshot | null {
    return this.previousSnapshot;
  }
  
  /**
   * 获取新鲜度
   */
  getFreshness(): {
    ageMs: number;
    freshnessMs: number;
    isStale: boolean;
  } {
    if (!this.currentSnapshot) {
      return {
        ageMs: Infinity,
        freshnessMs: Infinity,
        isStale: true,
      };
    }
    
    const now = Date.now();
    const ageMs = now - this.currentSnapshot.createdAt;
    const freshnessMs = this.currentSnapshot.freshnessMs;
    const staleDetection = this.detectStale();
    
    return {
      ageMs,
      freshnessMs,
      isStale: staleDetection.isStale,
    };
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 通知监听器
   */
  private notifyListeners(result: RefreshResult): void {
    for (const listener of this.refreshListeners) {
      try {
        listener(result);
      } catch (error) {
        console.error('Refresh listener error:', error);
      }
    }
  }
}

// ============================================================================
// 变化检测工具
// ============================================================================

export class ChangeDetector {
  /**
   * 检测仪表盘变化
   */
  detectChanges(
    oldDashboard: DashboardSnapshot,
    newDashboard: DashboardSnapshot
  ): DashboardChanges {
    const changes: DashboardChanges = {
      added: [],
      removed: [],
      updated: [],
    };
    
    // 检测状态变化
    if (oldDashboard.summary.overallStatus !== newDashboard.summary.overallStatus) {
      changes.statusChanged = {
        from: oldDashboard.summary.overallStatus,
        to: newDashboard.summary.overallStatus,
      };
    }
    
    // 检测健康评分变化
    if (oldDashboard.summary.healthScore !== newDashboard.summary.healthScore) {
      changes.healthScoreChanged = {
        from: oldDashboard.summary.healthScore,
        to: newDashboard.summary.healthScore,
      };
    }
    
    // 检测关注项变化
    this.detectAttentionChanges(oldDashboard.attentionItems, newDashboard.attentionItems, changes);
    
    // 检测分段变化
    this.detectSectionChanges(oldDashboard.sections, newDashboard.sections, changes);
    
    return changes;
  }
  
  /**
   * 检测关注项变化
   */
  private detectAttentionChanges(
    oldItems: any[],
    newItems: any[],
    changes: DashboardChanges
  ): void {
    const oldIds = new Set(oldItems.map(i => i.id));
    const newIds = new Set(newItems.map(i => i.id));
    
    // 新增
    for (const item of newItems) {
      if (!oldIds.has(item.id)) {
        changes.added.push(item.id);
      }
    }
    
    // 移除
    for (const item of oldItems) {
      if (!newIds.has(item.id)) {
        changes.removed.push(item.id);
      }
    }
  }
  
  /**
   * 检测分段变化
   */
  private detectSectionChanges(
    oldSections: any[],
    newSections: any[],
    changes: DashboardChanges
  ): void {
    const oldSectionIds = new Set(oldSections.map(s => s.id));
    const newSectionIds = new Set(newSections.map(s => s.id));
    
    // 检测卡片变化
    for (const newSection of newSections) {
      const oldSection = oldSections.find(s => s.id === newSection.id);
      
      if (!oldSection) {
        changes.added.push(`section_${newSection.id}`);
        continue;
      }
      
      // 检测卡片变化
      const oldCardIds = new Set(oldSection.cards.map(c => c.id));
      const newCardIds = new Set(newSection.cards.map(c => c.id));
      
      for (const card of newSection.cards) {
        if (!oldCardIds.has(card.id)) {
          changes.updated.push(`card_${card.id}`);
        }
      }
    }
    
    // 检测移除的分段
    for (const oldSection of oldSections) {
      if (!newSectionIds.has(oldSection.id)) {
        changes.removed.push(`section_${oldSection.id}`);
      }
    }
  }
  
  /**
   * 生成变化摘要
   */
  summarizeChanges(changes: DashboardChanges): string {
    const parts: string[] = [];
    
    if (changes.statusChanged) {
      parts.push(
        `Status changed: ${changes.statusChanged.from} → ${changes.statusChanged.to}`
      );
    }
    
    if (changes.healthScoreChanged) {
      const delta = changes.healthScoreChanged.to - changes.healthScoreChanged.from;
      parts.push(
        `Health score: ${changes.healthScoreChanged.from} → ${changes.healthScoreChanged.to} (${delta >= 0 ? '+' : ''}${delta})`
      );
    }
    
    if (changes.added.length > 0) {
      parts.push(`${changes.added.length} new items`);
    }
    
    if (changes.removed.length > 0) {
      parts.push(`${changes.removed.length} items resolved`);
    }
    
    if (changes.updated.length > 0) {
      parts.push(`${changes.updated.length} items updated`);
    }
    
    return parts.join('; ') || 'No significant changes';
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建仪表盘刷新管理器
 */
export function createDashboardRefreshManager(
  policy?: RefreshPolicy,
  dashboardBuilder?: DashboardBuilder
): DashboardRefreshManager {
  return new DashboardRefreshManager(policy, dashboardBuilder);
}

/**
 * 快速检测陈旧
 */
export function detectStale(
  dashboard: DashboardSnapshot,
  maxStaleMs?: number
): StaleDetection {
  const now = Date.now();
  const ageMs = now - dashboard.updatedAt;
  const maxStale = maxStaleMs ?? 120000;
  
  return {
    isStale: ageMs > maxStale,
    staleMs: ageMs,
    maxStaleMs: maxStale,
    suggestedAction: ageMs > maxStale ? 'refresh' : 'ignore',
  };
}

/**
 * 快速检测变化
 */
export function detectDashboardChanges(
  oldDashboard: DashboardSnapshot,
  newDashboard: DashboardSnapshot
): DashboardChanges {
  const detector = new ChangeDetector();
  return detector.detectChanges(oldDashboard, newDashboard);
}
