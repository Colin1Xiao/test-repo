/**
 * Circuit Breaker - 熔断器
 * 
 * 职责：
 * 1. closed（正常）
 * 2. open（熔断）
 * 3. half-open（半开）
 * 4. provider 报错率高时短路
 * 5. 某类角色异常率过高时暂停调度
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 熔断器状态
 */
export type CircuitState = 'closed' | 'open' | 'half_open';

/**
 * 熔断器配置
 */
export interface CircuitBreakerConfig {
  /** 失败率阈值（百分比） */
  failureThreshold?: number;
  
  /** 超时阈值（百分比） */
  timeoutThreshold?: number;
  
  /** 最小调用次数（达到后才开始计算失败率） */
  minCalls?: number;
  
  /** 熔断持续时间（毫秒） */
  openDurationMs?: number;
  
  /** 半开状态最大调用次数 */
  halfOpenMaxCalls?: number;
  
  /** 半开状态成功次数阈值（达到后关闭熔断） */
  halfOpenSuccessThreshold?: number;
}

/**
 * 熔断器统计
 */
export interface CircuitBreakerStats {
  // 状态
  state: CircuitState;
  
  // 调用
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  timedOutCalls: number;
  
  // 百分比
  failureRate: number;
  timeoutRate: number;
  
  // 时间
  lastFailureAt?: number;
  lastSuccessAt?: number;
  openedAt?: number;
  halfOpenedAt?: number;
  
  // 熔断
  totalOpens: number;
  totalCloses: number;
  totalHalfOpens: number;
}

// ============================================================================
// 熔断器
// ============================================================================

export class CircuitBreaker {
  private config: Required<CircuitBreakerConfig>;
  
  // 状态
  private state: CircuitState = 'closed';
  
  // 调用记录
  private calls: Array<{
    timestamp: number;
    success: boolean;
    timeout: boolean;
  }> = [];
  
  // 半开状态跟踪
  private halfOpenCalls: number = 0;
  private halfOpenSuccesses: number = 0;
  
  // 统计
  private stats: CircuitBreakerStats = {
    state: 'closed',
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    timedOutCalls: 0,
    failureRate: 0,
    timeoutRate: 0,
    totalOpens: 0,
    totalCloses: 0,
    totalHalfOpens: 0,
  };
  
  constructor(config: CircuitBreakerConfig = {}) {
    this.config = {
      failureThreshold: config.failureThreshold || 50,
      timeoutThreshold: config.timeoutThreshold || 30,
      minCalls: config.minCalls || 10,
      openDurationMs: config.openDurationMs || 30000, // 30 秒
      halfOpenMaxCalls: config.halfOpenMaxCalls || 5,
      halfOpenSuccessThreshold: config.halfOpenSuccessThreshold || 3,
    };
  }
  
  /**
   * 执行受保护的函数
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // 检查是否允许调用
    this.checkState();
    
    const startTime = Date.now();
    
    try {
      const result = await fn();
      this.recordSuccess();
      return result;
      
    } catch (error) {
      const isTimeout = (error as Error).message.includes('timeout');
      this.recordFailure(isTimeout);
      throw error;
    }
  }
  
  /**
   * 记录成功
   */
  recordSuccess(): void {
    const now = Date.now();
    
    this.calls.push({
      timestamp: now,
      success: true,
      timeout: false,
    });
    
    this.stats.totalCalls++;
    this.stats.successfulCalls++;
    this.stats.lastSuccessAt = now;
    
    // 半开状态处理
    if (this.state === 'half_open') {
      this.halfOpenCalls++;
      this.halfOpenSuccesses++;
      
      if (this.halfOpenSuccesses >= this.config.halfOpenSuccessThreshold) {
        this.close();
      } else if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
        this.close();
      }
    }
    
    this.pruneOldCalls();
    this.updateRates();
  }
  
  /**
   * 记录失败
   */
  recordFailure(isTimeout: boolean = false): void {
    const now = Date.now();
    
    this.calls.push({
      timestamp: now,
      success: false,
      timeout: isTimeout,
    });
    
    this.stats.totalCalls++;
    this.stats.failedCalls++;
    this.stats.lastFailureAt = now;
    
    if (isTimeout) {
      this.stats.timedOutCalls++;
    }
    
    // 半开状态处理
    if (this.state === 'half_open') {
      this.halfOpenCalls++;
      this.open(); // 立即打开
    }
    
    this.pruneOldCalls();
    this.updateRates();
    
    // 检查是否需要打开
    this.checkState();
  }
  
  /**
   * 获取当前状态
   */
  getState(): CircuitState {
    return this.state;
  }
  
  /**
   * 获取统计
   */
  getStats(): CircuitBreakerStats {
    return { ...this.stats, state: this.state };
  }
  
  /**
   * 手动打开熔断
   */
  open(): void {
    if (this.state !== 'open') {
      this.state = 'open';
      this.stats.openedAt = Date.now();
      this.stats.totalOpens++;
      this.stats.state = 'open';
    }
  }
  
  /**
   * 手动关闭熔断
   */
  close(): void {
    if (this.state !== 'closed') {
      this.state = 'closed';
      this.stats.totalCloses++;
      this.stats.state = 'closed';
      this.halfOpenCalls = 0;
      this.halfOpenSuccesses = 0;
    }
  }
  
  /**
   * 重置熔断器
   */
  reset(): void {
    this.state = 'closed';
    this.calls = [];
    this.halfOpenCalls = 0;
    this.halfOpenSuccesses = 0;
    
    this.stats = {
      state: 'closed',
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      timedOutCalls: 0,
      failureRate: 0,
      timeoutRate: 0,
      totalOpens: this.stats.totalOpens,
      totalCloses: this.stats.totalCloses,
      totalHalfOpens: this.stats.totalHalfOpens,
    };
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 检查状态
   */
  private checkState(): void {
    if (this.state === 'open') {
      const openedAt = this.stats.openedAt || 0;
      const elapsed = Date.now() - openedAt;
      
      if (elapsed >= this.config.openDurationMs) {
        this.halfOpen();
      } else {
        throw new Error(
          `Circuit breaker is open. Will retry in ${this.config.openDurationMs - elapsed}ms`
        );
      }
    }
  }
  
  /**
   * 切换到半开状态
   */
  private halfOpen(): void {
    this.state = 'half_open';
    this.stats.halfOpenedAt = Date.now();
    this.stats.totalHalfOpens++;
    this.stats.state = 'half_open';
    this.halfOpenCalls = 0;
    this.halfOpenSuccesses = 0;
  }
  
  /**
   * 修剪旧的调用记录
   */
  private pruneOldCalls(): void {
    const now = Date.now();
    const windowMs = 60000; // 1 分钟窗口
    
    this.calls = this.calls.filter(call => now - call.timestamp < windowMs);
  }
  
  /**
   * 更新失败率
   */
  private updateRates(): void {
    if (this.calls.length < this.config.minCalls) {
      return;
    }
    
    const failures = this.calls.filter(c => !c.success).length;
    const timeouts = this.calls.filter(c => c.timeout).length;
    
    this.stats.failureRate = (failures / this.calls.length) * 100;
    this.stats.timeoutRate = (timeouts / this.calls.length) * 100;
    
    // 检查是否需要打开
    if (this.state === 'closed') {
      if (this.stats.failureRate >= this.config.failureThreshold) {
        this.open();
      } else if (this.stats.timeoutRate >= this.config.timeoutThreshold) {
        this.open();
      }
    }
  }
}

// ============================================================================
// 熔断器管理器（多熔断器）
// ============================================================================

export class CircuitBreakerManager {
  private breakers: Map<string, CircuitBreaker> = new Map();
  
  /**
   * 获取或创建熔断器
   */
  getOrCreate(key: string, config?: CircuitBreakerConfig): CircuitBreaker {
    let breaker = this.breakers.get(key);
    
    if (!breaker) {
      breaker = new CircuitBreaker(config);
      this.breakers.set(key, breaker);
    }
    
    return breaker;
  }
  
  /**
   * 获取所有熔断器状态
   */
  getAllStates(): Record<string, CircuitState> {
    const states: Record<string, CircuitState> = {};
    
    for (const [key, breaker] of this.breakers.entries()) {
      states[key] = breaker.getState();
    }
    
    return states;
  }
  
  /**
   * 获取所有统计
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    
    for (const [key, breaker] of this.breakers.entries()) {
      stats[key] = breaker.getStats();
    }
    
    return stats;
  }
  
  /**
   * 重置所有熔断器
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
  
  /**
   * 移除熔断器
   */
  remove(key: string): void {
    this.breakers.delete(key);
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建熔断器
 */
export function createCircuitBreaker(config?: CircuitBreakerConfig): CircuitBreaker {
  return new CircuitBreaker(config);
}

/**
 * 创建熔断器管理器
 */
export function createCircuitBreakerManager(): CircuitBreakerManager {
  return new CircuitBreakerManager();
}
