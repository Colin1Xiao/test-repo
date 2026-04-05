/**
 * Concurrency Limiter - 并发限制器
 * 
 * 职责：
 * 1. 控制同时运行的 subagent 数量
 * 2. 三层限制：global / per-team / per-role
 * 3. 资源获取/释放
 * 4. 等待队列管理
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 并发限制配置
 */
export interface ConcurrencyConfig {
  /** 全局最大并发数 */
  maxGlobalConcurrency: number;
  
  /** 单团队最大并发数 */
  maxTeamConcurrency?: number;
  
  /** 单角色最大并发数 */
  maxRoleConcurrency?: Record<string, number>;
}

/**
 * 资源许可
 */
export interface ConcurrencyPermit {
  /** 团队 ID */
  teamId: string;
  
  /** 角色 */
  role: string;
  
  /** 获取时间 */
  acquiredAt: number;
  
  /** 释放函数 */
  release: () => void;
}

/**
 * 等待队列项
 */
export interface WaitQueueItem {
  teamId: string;
  role: string;
  priority: number;
  enqueuedAt: number;
  resolve: (permit: ConcurrencyPermit) => void;
  reject: (error: Error) => void;
  timeoutMs?: number;
}

/**
 * 并发统计
 */
export interface ConcurrencyStats {
  // 当前并发
  currentGlobal: number;
  currentByTeam: Record<string, number>;
  currentByRole: Record<string, number>;
  
  // 限制
  maxGlobal: number;
  maxByTeam: Record<string, number>;
  maxByRole: Record<string, number>;
  
  // 队列
  waitingCount: number;
  avgWaitTimeMs: number;
  
  // 历史
  totalAcquired: number;
  totalReleased: number;
  totalRejected: number;
}

// ============================================================================
// 并发限制器
// ============================================================================

export class ConcurrencyLimiter {
  private config: Required<ConcurrencyConfig>;
  
  // 当前并发计数
  private globalCount: number = 0;
  private teamCounts: Map<string, number> = new Map();
  private roleCounts: Map<string, number> = new Map();
  
  // 等待队列
  private waitQueue: WaitQueueItem[] = [];
  
  // 统计
  private stats: ConcurrencyStats = {
    currentGlobal: 0,
    currentByTeam: {},
    currentByRole: {},
    maxGlobal: 0,
    maxByTeam: {},
    maxByRole: {},
    waitingCount: 0,
    avgWaitTimeMs: 0,
    totalAcquired: 0,
    totalReleased: 0,
    totalRejected: 0,
  };
  
  constructor(config: ConcurrencyConfig) {
    this.config = {
      maxGlobalConcurrency: config.maxGlobalConcurrency || 8,
      maxTeamConcurrency: config.maxTeamConcurrency || 3,
      maxRoleConcurrency: config.maxRoleConcurrency || {
        planner: 2,
        repo_reader: 2,
        code_fixer: 2,
        code_reviewer: 1,
        verify_agent: 1,
        release_agent: 1,
      },
    };
  }
  
  /**
   * 获取并发许可
   * 
   * @param teamId - 团队 ID
   * @param role - 角色
   * @param options - 选项
   * @returns 许可（包含释放函数）
   */
  async acquire(
    teamId: string,
    role: string,
    options?: {
      priority?: number;
      timeoutMs?: number;
    }
  ): Promise<ConcurrencyPermit> {
    const priority = options?.priority ?? 0;
    const timeoutMs = options?.timeoutMs;
    
    // 检查是否可立即获取
    if (this.canAcquire(teamId, role)) {
      return this.doAcquire(teamId, role);
    }
    
    // 需要等待
    return new Promise<ConcurrencyPermit>((resolve, reject) => {
      const item: WaitQueueItem = {
        teamId,
        role,
        priority,
        enqueuedAt: Date.now(),
        resolve,
        reject,
        timeoutMs,
      };
      
      // 按优先级排序插入队列
      const insertIndex = this.waitQueue.findIndex(
        i => i.priority < priority
      );
      
      if (insertIndex === -1) {
        this.waitQueue.push(item);
      } else {
        this.waitQueue.splice(insertIndex, 0, item);
      }
      
      // 设置超时
      if (timeoutMs) {
        setTimeout(() => {
          const index = this.waitQueue.indexOf(item);
          if (index !== -1) {
            this.waitQueue.splice(index, 1);
            this.stats.totalRejected++;
            reject(new Error(`Concurrency acquire timeout after ${timeoutMs}ms`));
          }
        }, timeoutMs);
      }
    });
  }
  
  /**
   * 检查是否可获取许可
   */
  canAcquire(teamId: string, role: string): boolean {
    // 检查全局限制
    if (this.globalCount >= this.config.maxGlobalConcurrency) {
      return false;
    }
    
    // 检查团队限制
    const teamLimit = this.config.maxTeamConcurrency || Infinity;
    const teamCount = this.teamCounts.get(teamId) || 0;
    if (teamCount >= teamLimit) {
      return false;
    }
    
    // 检查角色限制
    const roleLimit = this.config.maxRoleConcurrency?.[role] || Infinity;
    const roleCount = this.roleCounts.get(role) || 0;
    if (roleCount >= roleLimit) {
      return false;
    }
    
    return true;
  }
  
  /**
   * 执行获取
   */
  private doAcquire(teamId: string, role: string): ConcurrencyPermit {
    // 增加计数
    this.globalCount++;
    this.teamCounts.set(teamId, (this.teamCounts.get(teamId) || 0) + 1);
    this.roleCounts.set(role, (this.roleCounts.get(role) || 0) + 1);
    
    // 更新统计
    this.stats.currentGlobal = this.globalCount;
    this.stats.currentByTeam[teamId] = this.teamCounts.get(teamId) || 0;
    this.stats.currentByRole[role] = this.roleCounts.get(role) || 0;
    this.stats.totalAcquired++;
    
    // 更新最大值
    if (this.globalCount > this.stats.maxGlobal) {
      this.stats.maxGlobal = this.globalCount;
    }
    
    const acquiredAt = Date.now();
    
    // 创建许可
    const permit: ConcurrencyPermit = {
      teamId,
      role,
      acquiredAt,
      release: () => this.release(permit),
    };
    
    return permit;
  }
  
  /**
   * 释放许可
   */
  release(permit: ConcurrencyPermit): void {
    // 减少计数
    this.globalCount = Math.max(0, this.globalCount - 1);
    
    const teamCount = this.teamCounts.get(permit.teamId) || 0;
    this.teamCounts.set(permit.teamId, Math.max(0, teamCount - 1));
    
    const roleCount = this.roleCounts.get(permit.role) || 0;
    this.roleCounts.set(permit.role, Math.max(0, roleCount - 1));
    
    // 更新统计
    this.stats.currentGlobal = this.globalCount;
    this.stats.currentByTeam[permit.teamId] = this.teamCounts.get(permit.teamId) || 0;
    this.stats.currentByRole[permit.role] = this.roleCounts.get(permit.role) || 0;
    this.stats.totalReleased++;
    
    // 尝试满足等待队列
    this.processWaitQueue();
  }
  
  /**
   * 处理等待队列
   */
  private processWaitQueue(): void {
    if (this.waitQueue.length === 0) {
      return;
    }
    
    // 按优先级处理
    const remaining: WaitQueueItem[] = [];
    
    for (const item of this.waitQueue) {
      if (this.canAcquire(item.teamId, item.role)) {
        try {
          const permit = this.doAcquire(item.teamId, item.role);
          
          // 计算等待时间
          const waitTime = Date.now() - item.enqueuedAt;
          this.updateAvgWaitTime(waitTime);
          
          item.resolve(permit);
        } catch (error) {
          item.reject(error as Error);
        }
      } else {
        remaining.push(item);
      }
    }
    
    this.waitQueue = remaining;
    this.stats.waitingCount = this.waitQueue.length;
  }
  
  /**
   * 更新平均等待时间
   */
  private updateAvgWaitTime(waitTime: number): void {
    const total = this.stats.totalAcquired;
    const oldAvg = this.stats.avgWaitTimeMs;
    
    // 移动平均
    this.stats.avgWaitTimeMs = ((oldAvg * (total - 1)) + waitTime) / total;
  }
  
  /**
   * 获取统计信息
   */
  getStats(): ConcurrencyStats {
    return { ...this.stats };
  }
  
  /**
   * 获取当前全局并发数
   */
  getCurrentGlobal(): number {
    return this.globalCount;
  }
  
  /**
   * 获取团队当前并发数
   */
  getCurrentTeamConcurrency(teamId: string): number {
    return this.teamCounts.get(teamId) || 0;
  }
  
  /**
   * 获取角色当前并发数
   */
  getCurrentRoleConcurrency(role: string): number {
    return this.roleCounts.get(role) || 0;
  }
  
  /**
   * 获取等待队列长度
   */
  getWaitQueueLength(): number {
    return this.waitQueue.length;
  }
  
  /**
   * 取消团队的等待项
   */
  cancelTeamWaits(teamId: string): void {
    const toCancel = this.waitQueue.filter(item => item.teamId === teamId);
    this.waitQueue = this.waitQueue.filter(item => item.teamId !== teamId);
    
    for (const item of toCancel) {
      item.reject(new Error(`Team ${teamId} cancelled`));
    }
    
    this.stats.totalRejected += toCancel.length;
  }
  
  /**
   * 重置统计
   */
  resetStats(): void {
    this.stats = {
      currentGlobal: this.globalCount,
      currentByTeam: { ...this.stats.currentByTeam },
      currentByRole: { ...this.stats.currentByRole },
      maxGlobal: 0,
      maxByTeam: {},
      maxByRole: {},
      waitingCount: this.waitQueue.length,
      avgWaitTimeMs: 0,
      totalAcquired: 0,
      totalReleased: 0,
      totalRejected: 0,
    };
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建并发限制器
 */
export function createConcurrencyLimiter(config: ConcurrencyConfig): ConcurrencyLimiter {
  return new ConcurrencyLimiter(config);
}

/**
 * 默认配置（适合中等规模系统）
 */
export const DEFAULT_CONCURRENCY_CONFIG: ConcurrencyConfig = {
  maxGlobalConcurrency: 8,
  maxTeamConcurrency: 3,
  maxRoleConcurrency: {
    planner: 2,
    repo_reader: 2,
    code_fixer: 2,
    code_reviewer: 1,
    verify_agent: 1,
    release_agent: 1,
  },
};

/**
 * 保守配置（适合生产环境）
 */
export const CONSERVATIVE_CONCURRENCY_CONFIG: ConcurrencyConfig = {
  maxGlobalConcurrency: 4,
  maxTeamConcurrency: 2,
  maxRoleConcurrency: {
    planner: 1,
    repo_reader: 1,
    code_fixer: 1,
    code_reviewer: 1,
    verify_agent: 1,
    release_agent: 1,
  },
};

/**
 * 激进配置（适合开发/测试）
 */
export const AGGRESSIVE_CONCURRENCY_CONFIG: ConcurrencyConfig = {
  maxGlobalConcurrency: 16,
  maxTeamConcurrency: 5,
  maxRoleConcurrency: {
    planner: 4,
    repo_reader: 4,
    code_fixer: 4,
    code_reviewer: 2,
    verify_agent: 2,
    release_agent: 2,
  },
};
