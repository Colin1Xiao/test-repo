/**
 * Intervention Trail - 介入追踪
 * 
 * 职责：
 * 1. 把人的所有介入动作结构化记录下来
 * 2. 记录谁做的/何时做的/针对哪个对象/为什么触发/做了什么/系统建议是什么/最终结果是什么
 * 3. 这层很关键，因为 6D 如果没有 trail，就不算正式闭环
 * 
 * @version v0.1.0
 * @date 2026-04-04
 */

import type {
  InterventionTrailEntry,
  InterventionItem,
  InterventionStatus,
} from './hitl_types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 介入追踪管理器配置
 */
export interface InterventionTrailConfig {
  /** 最大追踪记录数 */
  maxEntries?: number;
  
  /** 是否启用持久化 */
  enablePersistence?: boolean;
  
  /** 持久化路径 */
  persistPath?: string;
}

// ============================================================================
// 介入追踪管理器
// ============================================================================

export class InterventionTrailManager {
  private config: Required<InterventionTrailConfig>;
  private entries: InterventionTrailEntry[] = [];
  
  constructor(config: InterventionTrailConfig = {}) {
    this.config = {
      maxEntries: config.maxEntries ?? 1000,
      enablePersistence: config.enablePersistence ?? false,
      persistPath: config.persistPath ?? './intervention_trail.json',
    };
    
    // 加载持久化数据
    if (this.config.enablePersistence) {
      this.loadFromPersistence();
    }
  }
  
  /**
   * 记录介入动作
   */
  recordAction(
    interventionId: string,
    actor: string,
    action: string,
    result?: InterventionTrailEntry['result'],
    note?: string
  ): InterventionTrailEntry {
    const now = Date.now();
    
    const entry: InterventionTrailEntry = {
      id: `trail_${now}_${Math.random().toString(36).slice(2, 8)}`,
      interventionId,
      actor,
      action,
      timestamp: now,
      note,
      result,
    };
    
    this.entries.push(entry);
    
    // 限制记录数
    if (this.entries.length > this.config.maxEntries) {
      this.entries = this.entries.slice(-this.config.maxEntries);
    }
    
    // 持久化
    if (this.config.enablePersistence) {
      this.saveToPersistence();
    }
    
    return entry;
  }
  
  /**
   * 记录介入状态变化
   */
  recordStatusChange(
    interventionId: string,
    actor: string,
    fromStatus: InterventionStatus,
    toStatus: InterventionStatus,
    note?: string
  ): InterventionTrailEntry {
    return this.recordAction(
      interventionId,
      actor,
      `status_change: ${fromStatus} → ${toStatus}`,
      undefined,
      note
    );
  }
  
  /**
   * 记录介入创建
   */
  recordCreation(
    intervention: InterventionItem,
    actor: string = 'system'
  ): InterventionTrailEntry {
    return this.recordAction(
      intervention.id,
      actor,
      'intervention_created',
      undefined,
      `Created ${intervention.interventionType} intervention for ${intervention.sourceType}:${intervention.sourceId}`
    );
  }
  
  /**
   * 记录介入解决
   */
  recordResolution(
    interventionId: string,
    actor: string,
    result: 'resolved' | 'dismissed' | 'escalated',
    note?: string
  ): InterventionTrailEntry {
    return this.recordAction(
      interventionId,
      actor,
      'intervention_resolved',
      result,
      note
    );
  }
  
  /**
   * 获取介入的追踪记录
   */
  getTrailForIntervention(interventionId: string): InterventionTrailEntry[] {
    return this.entries
      .filter(e => e.interventionId === interventionId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }
  
  /**
   * 获取最近的追踪记录
   */
  getRecentTrail(limit?: number): InterventionTrailEntry[] {
    const entries = [...this.entries].sort((a, b) => b.timestamp - a.timestamp);
    return entries.slice(0, limit || 50);
  }
  
  /**
   * 获取指定执行者的追踪记录
   */
  getTrailByActor(actor: string, limit?: number): InterventionTrailEntry[] {
    const entries = this.entries
      .filter(e => e.actor === actor)
      .sort((a, b) => b.timestamp - a.timestamp);
    return entries.slice(0, limit || 50);
  }
  
  /**
   * 获取指定时间范围的追踪记录
   */
  getTrailByTimeRange(startTime: number, endTime: number): InterventionTrailEntry[] {
    return this.entries
      .filter(e => e.timestamp >= startTime && e.timestamp <= endTime)
      .sort((a, b) => b.timestamp - a.timestamp);
  }
  
  /**
   * 获取统计信息
   */
  getStats(): {
    totalEntries: number;
    byActor: Record<string, number>;
    byAction: Record<string, number>;
    byResult: Record<string, number>;
    last24h: number;
  } {
    const now = Date.now();
    const last24hStart = now - 24 * 60 * 60 * 1000;
    
    const byActor: Record<string, number> = {};
    const byAction: Record<string, number> = {};
    const byResult: Record<string, number> = {};
    let last24h = 0;
    
    for (const entry of this.entries) {
      byActor[entry.actor] = (byActor[entry.actor] || 0) + 1;
      byAction[entry.action] = (byAction[entry.action] || 0) + 1;
      
      if (entry.result) {
        byResult[entry.result] = (byResult[entry.result] || 0) + 1;
      }
      
      if (entry.timestamp >= last24hStart) {
        last24h++;
      }
    }
    
    return {
      totalEntries: this.entries.length,
      byActor,
      byAction,
      byResult,
      last24h,
    };
  }
  
  /**
   * 清空追踪记录
   */
  clear(): void {
    this.entries = [];
    
    if (this.config.enablePersistence) {
      this.saveToPersistence();
    }
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 加载持久化数据
   */
  private loadFromPersistence(): void {
    // 简化实现：实际应该从文件加载
    try {
      // const fs = require('fs');
      // const data = fs.readFileSync(this.config.persistPath, 'utf-8');
      // this.entries = JSON.parse(data);
    } catch (error) {
      // 文件不存在或解析失败，忽略
    }
  }
  
  /**
   * 保存持久化数据
   */
  private saveToPersistence(): void {
    // 简化实现：实际应该保存到文件
    try {
      // const fs = require('fs');
      // const data = JSON.stringify(this.entries, null, 2);
      // fs.writeFileSync(this.config.persistPath, data);
    } catch (error) {
      // 保存失败，忽略
    }
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建介入追踪管理器
 */
export function createInterventionTrailManager(config?: InterventionTrailConfig): InterventionTrailManager {
  return new InterventionTrailManager(config);
}

/**
 * 快速记录介入动作
 */
export function recordInterventionAction(
  trailManager: InterventionTrailManager,
  interventionId: string,
  actor: string,
  action: string,
  result?: InterventionTrailEntry['result'],
  note?: string
): InterventionTrailEntry {
  return trailManager.recordAction(interventionId, actor, action, result, note);
}
