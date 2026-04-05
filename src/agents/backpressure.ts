/**
 * Backpressure - 背压策略
 * 
 * 职责：
 * 1. 系统压力检测
 * 2. 降低并发上限
 * 3. 降低 fan-out 宽度
 * 4. 禁止低优先级角色入场
 * 5. 缩短 maxTurns
 * 6. 关闭 aggressive retry
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 压力级别
 */
export type PressureLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * 压力指标
 */
export interface PressureMetrics {
  // 队列
  queueLength: number;
  avgWaitTimeMs: number;
  
  // 并发
  currentConcurrency: number;
  maxConcurrency: number;
  concurrencyUtilization: number;
  
  // 失败率
  failureRate: number;
  timeoutRate: number;
  
  // 资源
  availableMemory?: number;
  availableCpu?: number;
}

/**
 * 背压配置
 */
export interface BackpressureConfig {
  /** 压力检查间隔（毫秒） */
  checkIntervalMs?: number;
  
  /** 队列长度阈值 */
  queueLengthThresholds?: {
    medium: number;
    high: number;
    critical: number;
  };
  
  /** 等待时间阈值（毫秒） */
  waitTimeThresholds?: {
    medium: number;
    high: number;
    critical: number;
  };
  
  /** 失败率阈值（百分比） */
  failureRateThresholds?: {
    medium: number;
    high: number;
    critical: number;
  };
}

/**
 * 背压动作
 */
export interface BackpressureAction {
  /** 动作类型 */
  type:
    | 'reduce_concurrency'
    | 'reduce_fanout'
    | 'block_low_priority'
    | 'shorten_turns'
    | 'disable_retry'
    | 'shed_load';
  
  /** 动作参数 */
  params: Record<string, number | boolean | string>;
  
  /** 原因 */
  reason: string;
  
  /** 压力级别 */
  pressureLevel: PressureLevel;
}

/**
 * 背压状态
 */
export interface BackpressureState {
  // 当前压力级别
  pressureLevel: PressureLevel;
  
  // 当前动作
  activeActions: BackpressureAction[];
  
  // 指标
  metrics: PressureMetrics;
  
  // 时间
  lastCheckAt: number;
  pressureSince?: number;
}

// ============================================================================
// 背压控制器
// ============================================================================

export class BackpressureController {
  private config: Required<BackpressureConfig>;
  
  // 当前状态
  private state: BackpressureState = {
    pressureLevel: 'low',
    activeActions: [],
    metrics: {
      queueLength: 0,
      avgWaitTimeMs: 0,
      currentConcurrency: 0,
      maxConcurrency: 10,
      concurrencyUtilization: 0,
      failureRate: 0,
      timeoutRate: 0,
    },
    lastCheckAt: 0,
  };
  
  // 动作历史
  private actionHistory: BackpressureAction[] = [];
  
  // 监听器
  private listeners: Array<(state: BackpressureState) => void> = [];
  
  constructor(config: BackpressureConfig = {}) {
    this.config = {
      checkIntervalMs: config.checkIntervalMs || 1000,
      queueLengthThresholds: config.queueLengthThresholds || {
        medium: 50,
        high: 100,
        critical: 200,
      },
      waitTimeThresholds: config.waitTimeThresholds || {
        medium: 5000,
        high: 10000,
        critical: 30000,
      },
      failureRateThresholds: config.failureRateThresholds || {
        medium: 20,
        high: 40,
        critical: 60,
      },
    };
  }
  
  /**
   * 检查压力
   */
  checkPressure(metrics: PressureMetrics): BackpressureState {
    this.state.lastCheckAt = Date.now();
    this.state.metrics = metrics;
    
    // 计算压力级别
    const newPressureLevel = this.calculatePressureLevel(metrics);
    
    // 检测压力变化
    if (newPressureLevel !== this.state.pressureLevel) {
      const oldLevel = this.state.pressureLevel;
      this.state.pressureLevel = newPressureLevel;
      
      if (newPressureLevel !== 'low') {
        this.state.pressureSince = Date.now();
      } else {
        this.state.pressureSince = undefined;
      }
      
      // 生成新动作
      this.state.activeActions = this.generateActions(newPressureLevel, metrics);
      
      // 通知监听器
      this.notifyListeners();
    }
    
    return { ...this.state };
  }
  
  /**
   * 获取当前状态
   */
  getState(): BackpressureState {
    return { ...this.state };
  }
  
  /**
   * 获取当前压力级别
   */
  getPressureLevel(): PressureLevel {
    return this.state.pressureLevel;
  }
  
  /**
   * 获取当前动作
   */
  getActiveActions(): BackpressureAction[] {
    return [...this.state.activeActions];
  }
  
  /**
   * 添加监听器
   */
  onStateChange(listener: (state: BackpressureState) => void): void {
    this.listeners.push(listener);
  }
  
  /**
   * 移除监听器
   */
  offStateChange(listener: (state: BackpressureState) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }
  
  /**
   * 获取动作历史
   */
  getActionHistory(): BackpressureAction[] {
    return [...this.actionHistory];
  }
  
  /**
   * 重置状态
   */
  reset(): void {
    this.state = {
      pressureLevel: 'low',
      activeActions: [],
      metrics: this.state.metrics,
      lastCheckAt: Date.now(),
    };
    this.actionHistory = [];
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 计算压力级别
   */
  private calculatePressureLevel(metrics: PressureMetrics): PressureLevel {
    const scores: number[] = [];
    
    // 队列长度评分
    if (metrics.queueLength >= this.config.queueLengthThresholds.critical) {
      scores.push(4);
    } else if (metrics.queueLength >= this.config.queueLengthThresholds.high) {
      scores.push(3);
    } else if (metrics.queueLength >= this.config.queueLengthThresholds.medium) {
      scores.push(2);
    } else {
      scores.push(1);
    }
    
    // 等待时间评分
    if (metrics.avgWaitTimeMs >= this.config.waitTimeThresholds.critical) {
      scores.push(4);
    } else if (metrics.avgWaitTimeMs >= this.config.waitTimeThresholds.high) {
      scores.push(3);
    } else if (metrics.avgWaitTimeMs >= this.config.waitTimeThresholds.medium) {
      scores.push(2);
    } else {
      scores.push(1);
    }
    
    // 失败率评分
    if (metrics.failureRate >= this.config.failureRateThresholds.critical) {
      scores.push(4);
    } else if (metrics.failureRate >= this.config.failureRateThresholds.high) {
      scores.push(3);
    } else if (metrics.failureRate >= this.config.failureRateThresholds.medium) {
      scores.push(2);
    } else {
      scores.push(1);
    }
    
    // 取最高分
    const maxScore = Math.max(...scores);
    
    switch (maxScore) {
      case 4:
        return 'critical';
      case 3:
        return 'high';
      case 2:
        return 'medium';
      default:
        return 'low';
    }
  }
  
  /**
   * 生成背压动作
   */
  private generateActions(
    pressureLevel: PressureLevel,
    metrics: PressureMetrics
  ): BackpressureAction[] {
    const actions: BackpressureAction[] = [];
    
    switch (pressureLevel) {
      case 'medium':
        // 中等压力：降低并发
        actions.push({
          type: 'reduce_concurrency',
          params: { reductionFactor: 0.8 }, // 降低到 80%
          reason: `Queue length: ${metrics.queueLength}, Wait time: ${metrics.avgWaitTimeMs}ms`,
          pressureLevel: 'medium',
        });
        break;
        
      case 'high':
        // 高压力：降低并发 + 降低 fan-out
        actions.push(
          {
            type: 'reduce_concurrency',
            params: { reductionFactor: 0.5 }, // 降低到 50%
            reason: `High pressure: queue=${metrics.queueLength}, wait=${metrics.avgWaitTimeMs}ms`,
            pressureLevel: 'high',
          },
          {
            type: 'reduce_fanout',
            params: { maxFanout: 2 }, // 最多 2 个并发子任务
            reason: 'High pressure detected',
            pressureLevel: 'high',
          },
          {
            type: 'block_low_priority',
            params: { minPriority: 5 }, // 只允许优先级 >= 5 的任务
            reason: 'Blocking low priority tasks',
            pressureLevel: 'high',
          }
        );
        break;
        
      case 'critical':
        // 临界压力：全面降级
        actions.push(
          {
            type: 'reduce_concurrency',
            params: { reductionFactor: 0.25 }, // 降低到 25%
            reason: `Critical pressure: queue=${metrics.queueLength}, wait=${metrics.avgWaitTimeMs}ms, failure=${metrics.failureRate}%`,
            pressureLevel: 'critical',
          },
          {
            type: 'reduce_fanout',
            params: { maxFanout: 1 }, // 串行执行
            reason: 'Critical pressure - serial execution only',
            pressureLevel: 'critical',
          },
          {
            type: 'block_low_priority',
            params: { minPriority: 8 }, // 只允许高优先级
            reason: 'Critical pressure - high priority only',
            pressureLevel: 'critical',
          },
          {
            type: 'shorten_turns',
            params: { maxTurns: 5 }, // 最多 5 轮对话
            reason: 'Critical pressure - limit conversation turns',
            pressureLevel: 'critical',
          },
          {
            type: 'disable_retry',
            params: { disableAll: true },
            reason: 'Critical pressure - disable retries',
            pressureLevel: 'critical',
          }
        );
        
        // 如果队列过长，考虑丢弃任务
        if (metrics.queueLength >= this.config.queueLengthThresholds.critical * 1.5) {
          actions.push({
            type: 'shed_load',
            params: {
              dropLowestPriority: true,
              dropPercentage: 0.2, // 丢弃 20% 最低优先级任务
            },
            reason: 'Queue overflow - shedding load',
            pressureLevel: 'critical',
          });
        }
        break;
    }
    
    // 记录历史
    if (actions.length > 0) {
      this.actionHistory.push(...actions);
      
      // 保留最近 100 个动作
      if (this.actionHistory.length > 100) {
        this.actionHistory.splice(0, this.actionHistory.length - 100);
      }
    }
    
    return actions;
  }
  
  /**
   * 通知监听器
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener({ ...this.state });
      } catch (error) {
        console.error('Backpressure listener error:', error);
      }
    }
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建背压控制器
 */
export function createBackpressureController(
  config?: BackpressureConfig
): BackpressureController {
  return new BackpressureController(config);
}

/**
 * 默认背压配置
 */
export const DEFAULT_BACKPRESSURE_CONFIG: BackpressureConfig = {
  checkIntervalMs: 1000,
  queueLengthThresholds: {
    medium: 50,
    high: 100,
    critical: 200,
  },
  waitTimeThresholds: {
    medium: 5000,
    high: 10000,
    critical: 30000,
  },
  failureRateThresholds: {
    medium: 20,
    high: 40,
    critical: 60,
  },
};
