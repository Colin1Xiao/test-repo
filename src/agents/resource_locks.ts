/**
 * Resource Locks - 资源锁管理
 * 
 * 职责：
 * 1. exclusive lock（写锁）
 * 2. shared lock（读锁）
 * 3. lease timeout
 * 4. deadlock avoidance（简单顺序规则）
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 锁类型
 */
export type LockType = 'exclusive' | 'shared';

/**
 * 锁状态
 */
export type LockStatus = 'acquired' | 'waiting' | 'released' | 'expired' | 'failed';

/**
 * 资源锁
 */
export interface ResourceLock {
  // 身份
  id: string;
  resourceKey: string;
  lockType: LockType;
  
  // 持有者
  ownerId: string;
  teamId: string;
  
  // 状态
  status: LockStatus;
  
  // 时间
  acquiredAt: number;
  expiresAt: number;
  leasedAt?: number;
  
  // 等待队列
  waitQueue: Array<{
    ownerId: string;
    teamId: string;
    lockType: LockType;
    enqueuedAt: number;
    resolve: (lock: ResourceLock) => void;
    reject: (error: Error) => void;
  }>;
}

/**
 * 锁配置
 */
export interface ResourceLocksConfig {
  /** 默认租约时间（毫秒） */
  defaultLeaseMs?: number;
  
  /** 最大租约时间（毫秒） */
  maxLeaseMs?: number;
  
  /** 锁过期检查间隔（毫秒） */
  expiryCheckIntervalMs?: number;
  
  /** 死锁检测启用 */
  enableDeadlockDetection?: boolean;
}

/**
 * 锁统计
 */
export interface LockStats {
  // 当前锁
  activeLocks: number;
  exclusiveLocks: number;
  sharedLocks: number;
  waitingCount: number;
  
  // 历史
  totalAcquired: number;
  totalReleased: number;
  totalExpired: number;
  totalFailed: number;
  
  // 性能
  avgWaitTimeMs: number;
  avgHoldTimeMs: number;
  
  // 死锁
  deadlockDetected: number;
}

// ============================================================================
// 资源锁管理器
// ============================================================================

export class ResourceLocks {
  private config: Required<ResourceLocksConfig>;
  
  // 锁存储
  private locks: Map<string, ResourceLock> = new Map();
  
  // 等待队列（按资源）
  private waitQueues: Map<string, ResourceLock['waitQueue']> = new Map();
  
  // 持有者跟踪（用于死锁检测）
  private ownerLocks: Map<string, Set<string>> = new Map();
  
  // 统计
  private stats: LockStats = {
    activeLocks: 0,
    exclusiveLocks: 0,
    sharedLocks: 0,
    waitingCount: 0,
    totalAcquired: 0,
    totalReleased: 0,
    totalExpired: 0,
    totalFailed: 0,
    avgWaitTimeMs: 0,
    avgHoldTimeMs: 0,
    deadlockDetected: 0,
  };
  
  // 等待时间记录
  private waitTimes: number[] = [];
  private holdTimes: number[] = [];
  
  // 过期检查定时器
  private expiryTimer?: NodeJS.Timeout;
  
  constructor(config: ResourceLocksConfig = {}) {
    this.config = {
      defaultLeaseMs: config.defaultLeaseMs || 60000, // 1 分钟
      maxLeaseMs: config.maxLeaseMs || 300000, // 5 分钟
      expiryCheckIntervalMs: config.expiryCheckIntervalMs || 5000, // 5 秒
      enableDeadlockDetection: config.enableDeadlockDetection ?? true,
    };
    
    // 启动过期检查
    this.startExpiryCheck();
  }
  
  /**
   * 获取锁
   */
  async acquire(
    resourceKey: string,
    ownerId: string,
    teamId: string,
    lockType: LockType = 'exclusive',
    options?: {
      timeoutMs?: number;
      leaseMs?: number;
    }
  ): Promise<ResourceLock> {
    const leaseMs = Math.min(
      options?.leaseMs || this.config.defaultLeaseMs,
      this.config.maxLeaseMs
    );
    
    // 检查是否可立即获取
    if (this.canAcquire(resourceKey, lockType)) {
      return this.doAcquire(resourceKey, ownerId, teamId, lockType, leaseMs);
    }
    
    // 检查死锁
    if (this.config.enableDeadlockDetection) {
      if (this.wouldCauseDeadlock(ownerId, resourceKey)) {
        this.stats.deadlockDetected++;
        throw new Error(`Deadlock detected: ${ownerId} waiting for ${resourceKey}`);
      }
    }
    
    // 需要等待
    return new Promise<ResourceLock>((resolve, reject) => {
      const waitItem = {
        ownerId,
        teamId,
        lockType,
        enqueuedAt: Date.now(),
        resolve,
        reject,
      };
      
      // 添加到等待队列
      let queue = this.waitQueues.get(resourceKey);
      if (!queue) {
        queue = [];
        this.waitQueues.set(resourceKey, queue);
      }
      queue.push(waitItem);
      
      this.stats.waitingCount++;
      
      // 设置超时
      if (options?.timeoutMs) {
        setTimeout(() => {
          const index = queue?.indexOf(waitItem);
          if (index !== -1) {
            queue?.splice(index, 1);
            this.stats.waitingCount--;
            this.stats.totalFailed++;
            reject(new Error(`Lock acquire timeout after ${options.timeoutMs}ms`));
          }
        }, options.timeoutMs);
      }
    });
  }
  
  /**
   * 释放锁
   */
  async release(lockId: string): Promise<boolean> {
    const lock = this.locks.get(lockId);
    if (!lock) {
      return false;
    }
    
    // 计算持有时间
    const holdTime = Date.now() - lock.acquiredAt;
    this.recordHoldTime(holdTime);
    
    // 移除锁
    this.locks.delete(lockId);
    
    // 更新持有者跟踪
    const ownerLockSet = this.ownerLocks.get(lock.ownerId);
    if (ownerLockSet) {
      ownerLockSet.delete(lockId);
      if (ownerLockSet.size === 0) {
        this.ownerLocks.delete(lock.ownerId);
      }
    }
    
    // 更新统计
    this.stats.totalReleased++;
    this.updateActiveLocks();
    
    // 处理等待队列
    await this.processWaitQueue(lock.resourceKey);
    
    return true;
  }
  
  /**
   * 续租锁
   */
  async renew(lockId: string, additionalMs?: number): Promise<boolean> {
    const lock = this.locks.get(lockId);
    if (!lock) {
      return false;
    }
    
    const additional = additionalMs || this.config.defaultLeaseMs;
    const newExpiresAt = lock.expiresAt + additional;
    const maxExpiresAt = Date.now() + this.config.maxLeaseMs;
    
    lock.expiresAt = Math.min(newExpiresAt, maxExpiresAt);
    
    return true;
  }
  
  /**
   * 获取锁
   */
  getLock(lockId: string): ResourceLock | undefined {
    return this.locks.get(lockId);
  }
  
  /**
   * 获取资源的锁
   */
  getResourceLock(resourceKey: string): ResourceLock | undefined {
    return this.locks.get(resourceKey);
  }
  
  /**
   * 获取持有者的所有锁
   */
  getOwnerLocks(ownerId: string): ResourceLock[] {
    const lockIds = this.ownerLocks.get(ownerId);
    if (!lockIds) return [];
    
    return Array.from(lockIds)
      .map(id => this.locks.get(id))
      .filter((l): l is ResourceLock => l !== undefined);
  }
  
  /**
   * 获取统计
   */
  getStats(): LockStats {
    return { ...this.stats };
  }
  
  /**
   * 停止过期检查
   */
  stop(): void {
    if (this.expiryTimer) {
      clearInterval(this.expiryTimer);
      this.expiryTimer = undefined;
    }
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 检查是否可获取锁
   */
  private canAcquire(resourceKey: string, lockType: LockType): boolean {
    const existingLock = this.locks.get(resourceKey);
    
    if (!existingLock) {
      return true; // 无锁
    }
    
    if (existingLock.status !== 'acquired') {
      return true; // 锁已释放
    }
    
    if (existingLock.expiresAt < Date.now()) {
      return true; // 锁已过期
    }
    
    // 排他锁：不允许任何其他锁
    if (lockType === 'exclusive' || existingLock.lockType === 'exclusive') {
      return false;
    }
    
    // 共享锁：可以共存
    return true;
  }
  
  /**
   * 执行获取锁
   */
  private doAcquire(
    resourceKey: string,
    ownerId: string,
    teamId: string,
    lockType: LockType,
    leaseMs: number
  ): ResourceLock {
    const now = Date.now();
    
    // 创建锁
    const lock: ResourceLock = {
      id: `${resourceKey}:${ownerId}:${now}`,
      resourceKey,
      lockType,
      ownerId,
      teamId,
      status: 'acquired',
      acquiredAt: now,
      expiresAt: now + leaseMs,
      leasedAt: now,
      waitQueue: [],
    };
    
    // 存储锁
    this.locks.set(resourceKey, lock);
    
    // 更新持有者跟踪
    let ownerLockSet = this.ownerLocks.get(ownerId);
    if (!ownerLockSet) {
      ownerLockSet = new Set();
      this.ownerLocks.set(ownerId, ownerLockSet);
    }
    ownerLockSet.add(lock.id);
    
    // 更新统计
    this.stats.totalAcquired++;
    this.updateActiveLocks();
    
    return lock;
  }
  
  /**
   * 处理等待队列
   */
  private async processWaitQueue(resourceKey: string): Promise<void> {
    const queue = this.waitQueues.get(resourceKey);
    if (!queue || queue.length === 0) {
      return;
    }
    
    // 检查是否可获取
    if (!this.canAcquire(resourceKey, 'exclusive')) {
      // 检查是否有共享锁可以获取
      const firstSharedIndex = queue.findIndex(item => item.lockType === 'shared');
      if (firstSharedIndex === -1) {
        return;
      }
      
      // 只有共享锁可以批量获取
      const sharedItems = queue.filter(item => item.lockType === 'shared');
      if (sharedItems.length === 0) {
        return;
      }
    }
    
    // 处理队列
    const remaining = [];
    
    for (const item of queue) {
      if (this.canAcquire(resourceKey, item.lockType)) {
        try {
          const lock = this.doAcquire(
            resourceKey,
            item.ownerId,
            item.teamId,
            item.lockType,
            this.config.defaultLeaseMs
          );
          
          // 计算等待时间
          const waitTime = Date.now() - item.enqueuedAt;
          this.recordWaitTime(waitTime);
          
          item.resolve(lock);
        } catch (error) {
          item.reject(error as Error);
        }
      } else {
        remaining.push(item);
      }
    }
    
    this.waitQueues.set(resourceKey, remaining);
    this.stats.waitingCount = this.getTotalWaitingCount();
  }
  
  /**
   * 检查是否会导致死锁
   */
  private wouldCauseDeadlock(ownerId: string, resourceKey: string): boolean {
    // 简单死锁检测：
    // 如果持有者已经在等待其他资源，而那些资源的持有者又在等待这个持有者的资源
    // 则可能死锁
    
    const ownerLocks = this.getOwnerLocks(ownerId);
    if (ownerLocks.length === 0) {
      return false;
    }
    
    // 获取当前资源的等待队列
    const queue = this.waitQueues.get(resourceKey);
    if (!queue || queue.length === 0) {
      return false;
    }
    
    // 检查等待队列中的持有者是否也在等待当前持有者的资源
    for (const item of queue) {
      const itemLocks = this.getOwnerLocks(item.ownerId);
      
      for (const itemLock of itemLocks) {
        const itemLockQueue = this.waitQueues.get(itemLock.resourceKey);
        if (itemLockQueue) {
          for (const waitItem of itemLockQueue) {
            if (waitItem.ownerId === ownerId) {
              return true; // 检测到循环等待
            }
          }
        }
      }
    }
    
    return false;
  }
  
  /**
   * 启动过期检查
   */
  private startExpiryCheck(): void {
    this.expiryTimer = setInterval(() => {
      const now = Date.now();
      
      for (const [resourceKey, lock] of this.locks.entries()) {
        if (lock.status === 'acquired' && lock.expiresAt < now) {
          // 锁过期
          lock.status = 'expired';
          this.stats.totalExpired++;
          
          // 释放锁
          this.locks.delete(resourceKey);
          this.updateActiveLocks();
          
          // 处理等待队列
          this.processWaitQueue(resourceKey);
        }
      }
    }, this.config.expiryCheckIntervalMs);
  }
  
  /**
   * 更新活跃锁统计
   */
  private updateActiveLocks(): void {
    let active = 0;
    let exclusive = 0;
    let shared = 0;
    
    for (const lock of this.locks.values()) {
      if (lock.status === 'acquired') {
        active++;
        if (lock.lockType === 'exclusive') {
          exclusive++;
        } else {
          shared++;
        }
      }
    }
    
    this.stats.activeLocks = active;
    this.stats.exclusiveLocks = exclusive;
    this.stats.sharedLocks = shared;
  }
  
  /**
   * 获取总等待数
   */
  private getTotalWaitingCount(): number {
    let total = 0;
    for (const queue of this.waitQueues.values()) {
      total += queue.length;
    }
    return total;
  }
  
  /**
   * 记录等待时间
   */
  private recordWaitTime(waitTime: number): void {
    this.waitTimes.push(waitTime);
    
    if (this.waitTimes.length > 1000) {
      this.waitTimes.shift();
    }
    
    this.stats.avgWaitTimeMs = this.calculateAverage(this.waitTimes);
  }
  
  /**
   * 记录持有时间
   */
  private recordHoldTime(holdTime: number): void {
    this.holdTimes.push(holdTime);
    
    if (this.holdTimes.length > 1000) {
      this.holdTimes.shift();
    }
    
    this.stats.avgHoldTimeMs = this.calculateAverage(this.holdTimes);
  }
  
  /**
   * 计算平均值
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建资源锁管理器
 */
export function createResourceLocks(config?: ResourceLocksConfig): ResourceLocks {
  return new ResourceLocks(config);
}

/**
 * 资源键生成器
 */
export class ResourceKeyBuilder {
  /**
   * 生成 worktree 锁键
   */
  static worktree(path: string): string {
    return `worktree:${path}`;
  }
  
  /**
   * 生成 repo 锁键
   */
  static repo(path: string): string {
    return `repo:${path}`;
  }
  
  /**
   * 生成 artifact 锁键
   */
  static artifact(namespace: string, id: string): string {
    return `artifact:${namespace}:${id}`;
  }
  
  /**
   * 生成 patch 锁键
   */
  static patch(fileId: string): string {
    return `patch:${fileId}`;
  }
}
