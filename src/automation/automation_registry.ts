/**
 * Automation Registry - 自动化规则注册表
 * 
 * 职责：
 * 1. 管理当前已加载规则集
 * 2. 保存来源信息
 * 3. 支持按 source / workspace / enabled 查询
 * 4. 支持替换快照而非增量污染
 * 5. 为 5A rule engine 提供当前有效规则
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type {
  AutomationRule,
  AutomationRuleSet,
  AutomationRegistrySnapshot,
  AutomationRuleSource,
} from './types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 注册表配置
 */
export interface RegistryConfig {
  /** 是否允许空规则集 */
  allowEmptyRuleset?: boolean;
  
  /** 保留上一个快照用于回滚 */
  keepPreviousSnapshot?: boolean;
}

/**
 * 规则来源追踪
 */
interface SourceTracking {
  /** 来源信息 */
  source: AutomationRuleSource;
  
  /** 规则 ID 列表 */
  ruleIds: string[];
  
  /** 加载时间 */
  loadedAt: number;
}

// ============================================================================
// 自动化注册表
// ============================================================================

export class AutomationRegistry {
  private config: Required<RegistryConfig>;
  
  // 当前规则集
  private currentRules: Map<string, AutomationRule & { source: string }> = new Map();
  
  // 来源追踪
  private sourceTracking: Map<string, SourceTracking> = new Map();
  
  // 上一个快照（用于回滚）
  private previousSnapshot: AutomationRegistrySnapshot | null = null;
  
  // 当前快照
  private currentSnapshot: AutomationRegistrySnapshot | null = null;
  
  constructor(config: RegistryConfig = {}) {
    this.config = {
      allowEmptyRuleset: config.allowEmptyRuleset ?? false,
      keepPreviousSnapshot: config.keepPreviousSnapshot ?? true,
    };
  }
  
  /**
   * 设置活动规则
   */
  setActiveRules(
    ruleSet: AutomationRuleSet,
    sourceInfo: AutomationRuleSource,
    mergeMode: 'replace' | 'merge' = 'replace'
  ): void {
    // 保存上一个快照
    if (this.config.keepPreviousSnapshot) {
      this.previousSnapshot = this.buildSnapshot();
    }
    
    if (mergeMode === 'replace') {
      // 替换模式：清空现有规则
      this.currentRules.clear();
      this.sourceTracking.clear();
    }
    
    // 添加新规则
    const ruleIds: string[] = [];
    
    for (const rule of ruleSet.rules) {
      const ruleWithSource = {
        ...rule,
        source: sourceInfo.path || sourceInfo.type,
      };
      
      this.currentRules.set(rule.id, ruleWithSource);
      ruleIds.push(rule.id);
    }
    
    // 更新来源追踪
    this.sourceTracking.set(sourceInfo.path || sourceInfo.type, {
      source: sourceInfo,
      ruleIds,
      loadedAt: ruleSet.loadedAt,
    });
    
    // 更新当前快照
    this.currentSnapshot = this.buildSnapshot();
  }
  
  /**
   * 获取活动规则
   */
  getActiveRules(): Array<AutomationRule & { source: string }> {
    return Array.from(this.currentRules.values());
  }
  
  /**
   * 按来源获取规则
   */
  getRulesBySource(sourcePath: string): Array<AutomationRule & { source: string }> {
    const tracking = this.sourceTracking.get(sourcePath);
    
    if (!tracking) {
      return [];
    }
    
    return tracking.ruleIds
      .map(id => this.currentRules.get(id))
      .filter((r): r is NonNullable<typeof r> => r !== undefined);
  }
  
  /**
   * 移除来源的规则
   */
  removeRulesBySource(sourcePath: string): boolean {
    const tracking = this.sourceTracking.get(sourcePath);
    
    if (!tracking) {
      return false;
    }
    
    // 移除规则
    for (const ruleId of tracking.ruleIds) {
      this.currentRules.delete(ruleId);
    }
    
    // 移除来源追踪
    this.sourceTracking.delete(sourcePath);
    
    // 更新快照
    this.currentSnapshot = this.buildSnapshot();
    
    return true;
  }
  
  /**
   * 启用规则
   */
  enableRule(ruleId: string): boolean {
    const rule = this.currentRules.get(ruleId);
    
    if (!rule) {
      return false;
    }
    
    rule.enabled = true;
    this.currentRules.set(ruleId, rule);
    
    // 更新快照
    this.currentSnapshot = this.buildSnapshot();
    
    return true;
  }
  
  /**
   * 禁用规则
   */
  disableRule(ruleId: string): boolean {
    const rule = this.currentRules.get(ruleId);
    
    if (!rule) {
      return false;
    }
    
    rule.enabled = false;
    this.currentRules.set(ruleId, rule);
    
    // 更新快照
    this.currentSnapshot = this.buildSnapshot();
    
    return true;
  }
  
  /**
   * 回滚到上一个快照
   */
  rollbackToPrevious(): boolean {
    if (!this.previousSnapshot || !this.config.keepPreviousSnapshot) {
      return false;
    }
    
    // 保存当前快照为"上一个"
    const tempPrevious = this.currentSnapshot;
    
    // 恢复上一个快照
    this.currentRules.clear();
    this.sourceTracking.clear();
    
    for (const rule of this.previousSnapshot.rules) {
      this.currentRules.set(rule.id, {
        ...rule,
        source: rule.source,
      });
    }
    
    // 重建来源追踪
    // 简化实现：实际应该保存更详细的来源信息
    
    this.currentSnapshot = tempPrevious;
    
    return true;
  }
  
  /**
   * 构建注册表快照
   */
  buildSnapshot(): AutomationRegistrySnapshot {
    const rules = Array.from(this.currentRules.values());
    const enabledRules = rules.filter(r => r.enabled);
    
    // 按来源分组统计
    const bySource: Record<string, number> = {};
    for (const rule of rules) {
      bySource[rule.source] = (bySource[rule.source] || 0) + 1;
    }
    
    const snapshot: AutomationRegistrySnapshot = {
      snapshotId: `snapshot_${Date.now()}`,
      createdAt: Date.now(),
      totalRules: rules.length,
      enabledRules: enabledRules.length,
      bySource,
      rules,
    };
    
    return snapshot;
  }
  
  /**
   * 获取当前快照
   */
  getCurrentSnapshot(): AutomationRegistrySnapshot | null {
    return this.currentSnapshot;
  }
  
  /**
   * 获取上一个快照
   */
  getPreviousSnapshot(): AutomationRegistrySnapshot | null {
    return this.previousSnapshot;
  }
  
  /**
   * 获取注册表统计
   */
  getStats(): {
    totalRules: number;
    enabledRules: number;
    disabledRules: number;
    bySource: Record<string, number>;
  } {
    const rules = Array.from(this.currentRules.values());
    const enabledRules = rules.filter(r => r.enabled);
    
    const bySource: Record<string, number> = {};
    for (const rule of rules) {
      bySource[rule.source] = (bySource[rule.source] || 0) + 1;
    }
    
    return {
      totalRules: rules.length,
      enabledRules: enabledRules.length,
      disabledRules: rules.length - enabledRules.length,
      bySource,
    };
  }
  
  /**
   * 清空注册表
   */
  clear(): void {
    if (this.config.keepPreviousSnapshot) {
      this.previousSnapshot = this.buildSnapshot();
    }
    
    this.currentRules.clear();
    this.sourceTracking.clear();
    this.currentSnapshot = null;
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建自动化注册表
 */
export function createAutomationRegistry(config?: RegistryConfig): AutomationRegistry {
  return new AutomationRegistry(config);
}
