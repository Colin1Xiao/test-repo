/**
 * Timeout Guard - 超时守卫
 * 
 * 职责：
 * 1. 包装模型调用 promise
 * 2. 超时后标记 subagent timeout
 * 3. 触发 HookBus
 * 4. 写 TaskStore
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 超时守卫配置
 */
export interface TimeoutGuardConfig {
  /** 超时时间（毫秒） */
  timeoutMs: number;
  
  /** 超时错误消息 */
  timeoutMessage?: string;
  
  /** 是否在超时时取消底层 promise */
  cancelOnTimeout?: boolean;
}

/**
 * 超时结果
 */
export interface TimeoutResult<T> {
  /** 是否超时 */
  timedOut: boolean;
  
  /** 结果（如果未超时） */
  result?: T;
  
  /** 错误（如果超时或失败） */
  error?: Error;
  
  /** 执行耗时 */
  durationMs: number;
}

// ============================================================================
// 超时守卫
// ============================================================================

export class TimeoutGuard {
  private timeoutMs: number;
  private timeoutMessage: string;
  private cancelOnTimeout: boolean;
  private startTime?: number;
  private timedOut: boolean = false;
  private abortController?: AbortController;
  
  constructor(config: TimeoutGuardConfig | number) {
    if (typeof config === 'number') {
      this.timeoutMs = config;
      this.timeoutMessage = `Timeout after ${config}ms`;
      this.cancelOnTimeout = false;
    } else {
      this.timeoutMs = config.timeoutMs;
      this.timeoutMessage = config.timeoutMessage || `Timeout after ${config.timeoutMs}ms`;
      this.cancelOnTimeout = config.cancelOnTimeout ?? false;
    }
  }
  
  /**
   * 开始计时
   */
  start(): void {
    this.startTime = Date.now();
    this.timedOut = false;
    
    if (this.cancelOnTimeout) {
      this.abortController = new AbortController();
    }
  }
  
  /**
   * 检查是否已超时
   */
  isTimedOut(): boolean {
    if (!this.startTime) return false;
    
    const elapsed = Date.now() - this.startTime;
    return elapsed >= this.timeoutMs;
  }
  
  /**
   * 获取剩余时间（毫秒）
   */
  getRemainingTime(): number {
    if (!this.startTime) return this.timeoutMs;
    
    const elapsed = Date.now() - this.startTime;
    return Math.max(0, this.timeoutMs - elapsed);
  }
  
  /**
   * 获取已用时间（毫秒）
   */
  getElapsedTime(): number {
    if (!this.startTime) return 0;
    return Date.now() - this.startTime;
  }
  
  /**
   * 获取中止信号
   */
  getAbortSignal(): AbortSignal | undefined {
    return this.abortController?.signal;
  }
  
  /**
   * 执行带超时的函数
   */
  async execute<T>(fn: () => Promise<T>): Promise<TimeoutResult<T>> {
    this.start();
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        this.timedOut = true;
        
        if (this.cancelOnTimeout && this.abortController) {
          this.abortController.abort(this.timeoutMessage);
        }
        
        reject(new Error(this.timeoutMessage));
      }, this.timeoutMs);
      
      // 如果提前完成，清除定时器
      timer.unref?.();
    });
    
    try {
      const result = await Promise.race([fn(), timeoutPromise]);
      
      return {
        timedOut: false,
        result,
        durationMs: this.getElapsedTime(),
      };
      
    } catch (error) {
      if (this.timedOut) {
        return {
          timedOut: true,
          error: error instanceof Error ? error : new Error(String(error)),
          durationMs: this.timeoutMs,
        };
      }
      
      throw error;
    }
  }
  
  /**
   * 包装 Promise 带超时
   */
  wrap<T>(promise: Promise<T>): Promise<T> {
    this.start();
    
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          this.timedOut = true;
          reject(new Error(this.timeoutMessage));
        }, this.timeoutMs);
      }),
    ]);
  }
  
  /**
   * 重置守卫
   */
  reset(): void {
    this.startTime = undefined;
    this.timedOut = false;
    this.abortController = undefined;
  }
}

// ============================================================================
// 超时错误
// ============================================================================

/**
 * 超时错误类
 */
export class TimeoutError extends Error {
  timeoutMs: number;
  elapsedMs: number;
  
  constructor(timeoutMs: number, elapsedMs?: number) {
    super(`Timeout after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
    this.elapsedMs = elapsedMs || timeoutMs;
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 执行带超时
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  options?: {
    timeoutMessage?: string;
    cancelOnTimeout?: boolean;
  }
): Promise<T> {
  const guard = new TimeoutGuard({
    timeoutMs,
    timeoutMessage: options?.timeoutMessage,
    cancelOnTimeout: options?.cancelOnTimeout,
  });
  
  const result = await guard.execute(fn);
  
  if (result.timedOut) {
    throw result.error || new TimeoutError(timeoutMs);
  }
  
  return result.result!;
}

/**
 * 包装 Promise 带超时
 */
export async function timeoutPromise<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message?: string
): Promise<T> {
  const guard = new TimeoutGuard({ timeoutMs, timeoutMessage: message });
  return await guard.wrap(promise);
}

/**
 * 延迟执行（可被中止）
 */
export async function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    
    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(signal.reason || new Error('Aborted'));
      });
    }
  });
}
