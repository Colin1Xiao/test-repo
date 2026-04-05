"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResourceKeyBuilder = exports.ResourceLocks = void 0;
exports.createResourceLocks = createResourceLocks;
// ============================================================================
// 资源锁管理器
// ============================================================================
class ResourceLocks {
    constructor(config = {}) {
        // 锁存储
        this.locks = new Map();
        // 等待队列（按资源）
        this.waitQueues = new Map();
        // 持有者跟踪（用于死锁检测）
        this.ownerLocks = new Map();
        // 统计
        this.stats = {
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
        this.waitTimes = [];
        this.holdTimes = [];
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
    async acquire(resourceKey, ownerId, teamId, lockType = 'exclusive', options) {
        const leaseMs = Math.min(options?.leaseMs || this.config.defaultLeaseMs, this.config.maxLeaseMs);
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
        return new Promise((resolve, reject) => {
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
    async release(lockId) {
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
    async renew(lockId, additionalMs) {
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
    getLock(lockId) {
        return this.locks.get(lockId);
    }
    /**
     * 获取资源的锁
     */
    getResourceLock(resourceKey) {
        return this.locks.get(resourceKey);
    }
    /**
     * 获取持有者的所有锁
     */
    getOwnerLocks(ownerId) {
        const lockIds = this.ownerLocks.get(ownerId);
        if (!lockIds)
            return [];
        return Array.from(lockIds)
            .map(id => this.locks.get(id))
            .filter((l) => l !== undefined);
    }
    /**
     * 获取统计
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * 停止过期检查
     */
    stop() {
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
    canAcquire(resourceKey, lockType) {
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
    doAcquire(resourceKey, ownerId, teamId, lockType, leaseMs) {
        const now = Date.now();
        // 创建锁
        const lock = {
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
    async processWaitQueue(resourceKey) {
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
                    const lock = this.doAcquire(resourceKey, item.ownerId, item.teamId, item.lockType, this.config.defaultLeaseMs);
                    // 计算等待时间
                    const waitTime = Date.now() - item.enqueuedAt;
                    this.recordWaitTime(waitTime);
                    item.resolve(lock);
                }
                catch (error) {
                    item.reject(error);
                }
            }
            else {
                remaining.push(item);
            }
        }
        this.waitQueues.set(resourceKey, remaining);
        this.stats.waitingCount = this.getTotalWaitingCount();
    }
    /**
     * 检查是否会导致死锁
     */
    wouldCauseDeadlock(ownerId, resourceKey) {
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
    startExpiryCheck() {
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
    updateActiveLocks() {
        let active = 0;
        let exclusive = 0;
        let shared = 0;
        for (const lock of this.locks.values()) {
            if (lock.status === 'acquired') {
                active++;
                if (lock.lockType === 'exclusive') {
                    exclusive++;
                }
                else {
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
    getTotalWaitingCount() {
        let total = 0;
        for (const queue of this.waitQueues.values()) {
            total += queue.length;
        }
        return total;
    }
    /**
     * 记录等待时间
     */
    recordWaitTime(waitTime) {
        this.waitTimes.push(waitTime);
        if (this.waitTimes.length > 1000) {
            this.waitTimes.shift();
        }
        this.stats.avgWaitTimeMs = this.calculateAverage(this.waitTimes);
    }
    /**
     * 记录持有时间
     */
    recordHoldTime(holdTime) {
        this.holdTimes.push(holdTime);
        if (this.holdTimes.length > 1000) {
            this.holdTimes.shift();
        }
        this.stats.avgHoldTimeMs = this.calculateAverage(this.holdTimes);
    }
    /**
     * 计算平均值
     */
    calculateAverage(values) {
        if (values.length === 0)
            return 0;
        return values.reduce((a, b) => a + b, 0) / values.length;
    }
}
exports.ResourceLocks = ResourceLocks;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建资源锁管理器
 */
function createResourceLocks(config) {
    return new ResourceLocks(config);
}
/**
 * 资源键生成器
 */
class ResourceKeyBuilder {
    /**
     * 生成 worktree 锁键
     */
    static worktree(path) {
        return `worktree:${path}`;
    }
    /**
     * 生成 repo 锁键
     */
    static repo(path) {
        return `repo:${path}`;
    }
    /**
     * 生成 artifact 锁键
     */
    static artifact(namespace, id) {
        return `artifact:${namespace}:${id}`;
    }
    /**
     * 生成 patch 锁键
     */
    static patch(fileId) {
        return `patch:${fileId}`;
    }
}
exports.ResourceKeyBuilder = ResourceKeyBuilder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb3VyY2VfbG9ja3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvYWdlbnRzL3Jlc291cmNlX2xvY2tzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7Ozs7R0FXRzs7O0FBMmpCSCxrREFFQztBQXBlRCwrRUFBK0U7QUFDL0UsU0FBUztBQUNULCtFQUErRTtBQUUvRSxNQUFhLGFBQWE7SUFrQ3hCLFlBQVksU0FBOEIsRUFBRTtRQS9CNUMsTUFBTTtRQUNFLFVBQUssR0FBOEIsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUVyRCxZQUFZO1FBQ0osZUFBVSxHQUEyQyxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBRXZFLGdCQUFnQjtRQUNSLGVBQVUsR0FBNkIsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUV6RCxLQUFLO1FBQ0csVUFBSyxHQUFjO1lBQ3pCLFdBQVcsRUFBRSxDQUFDO1lBQ2QsY0FBYyxFQUFFLENBQUM7WUFDakIsV0FBVyxFQUFFLENBQUM7WUFDZCxZQUFZLEVBQUUsQ0FBQztZQUNmLGFBQWEsRUFBRSxDQUFDO1lBQ2hCLGFBQWEsRUFBRSxDQUFDO1lBQ2hCLFlBQVksRUFBRSxDQUFDO1lBQ2YsV0FBVyxFQUFFLENBQUM7WUFDZCxhQUFhLEVBQUUsQ0FBQztZQUNoQixhQUFhLEVBQUUsQ0FBQztZQUNoQixnQkFBZ0IsRUFBRSxDQUFDO1NBQ3BCLENBQUM7UUFFRixTQUFTO1FBQ0QsY0FBUyxHQUFhLEVBQUUsQ0FBQztRQUN6QixjQUFTLEdBQWEsRUFBRSxDQUFDO1FBTS9CLElBQUksQ0FBQyxNQUFNLEdBQUc7WUFDWixjQUFjLEVBQUUsTUFBTSxDQUFDLGNBQWMsSUFBSSxLQUFLLEVBQUUsT0FBTztZQUN2RCxVQUFVLEVBQUUsTUFBTSxDQUFDLFVBQVUsSUFBSSxNQUFNLEVBQUUsT0FBTztZQUNoRCxxQkFBcUIsRUFBRSxNQUFNLENBQUMscUJBQXFCLElBQUksSUFBSSxFQUFFLE1BQU07WUFDbkUsdUJB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QUFFLEVBQUUsQ0FBQztJQUN2QyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQWM7UUFDekIsT0FBTyxTQUFTLE1BQU0sRUFBRSxDQUFDO0lBQzNCLENBQUM7Q0FDRjtBQTVCRCxnREE0QkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFJlc291cmNlIExvY2tzIC0g6LWE5rqQ6ZSB566h55CGXG4gKiBcbiAqIOiBjOi0o++8mlxuICogMS4gZXhjbHVzaXZlIGxvY2vvvIjlhpnplIHvvIlcbiAqIDIuIHNoYXJlZCBsb2Nr77yI6K+76ZSB77yJXG4gKiAzLiBsZWFzZSB0aW1lb3V0XG4gKiA0LiBkZWFkbG9jayBhdm9pZGFuY2XvvIjnroDljZXpobrluo/op4TliJnvvIlcbiAqIFxuICogQHZlcnNpb24gdjAuMS4wXG4gKiBAZGF0ZSAyMDI2LTA0LTAzXG4gKi9cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g57G75Z6L5a6a5LmJXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog6ZSB57G75Z6LXG4gKi9cbmV4cG9ydCB0eXBlIExvY2tUeXBlID0gJ2V4Y2x1c2l2ZScgfCAnc2hhcmVkJztcblxuLyoqXG4gKiDplIHnirbmgIFcbiAqL1xuZXhwb3J0IHR5cGUgTG9ja1N0YXR1cyA9ICdhY3F1aXJlZCcgfCAnd2FpdGluZycgfCAncmVsZWFzZWQnIHwgJ2V4cGlyZWQnIHwgJ2ZhaWxlZCc7XG5cbi8qKlxuICog6LWE5rqQ6ZSBXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUmVzb3VyY2VMb2NrIHtcbiAgLy8g6Lqr5Lu9XG4gIGlkOiBzdHJpbmc7XG4gIHJlc291cmNlS2V5OiBzdHJpbmc7XG4gIGxvY2tUeXBlOiBMb2NrVHlwZTtcbiAgXG4gIC8vIOaMgeacieiAhVxuICBvd25lcklkOiBzdHJpbmc7XG4gIHRlYW1JZDogc3RyaW5nO1xuICBcbiAgLy8g54q25oCBXG4gIHN0YXR1czogTG9ja1N0YXR1cztcbiAgXG4gIC8vIOaXtumXtFxuICBhY3F1aXJlZEF0OiBudW1iZXI7XG4gIGV4cGlyZXNBdDogbnVtYmVyO1xuICBsZWFzZWRBdD86IG51bWJlcjtcbiAgXG4gIC8vIOetieW+hemYn+WIl1xuICB3YWl0UXVldWU6IEFycmF5PHtcbiAgICBvd25lcklkOiBzdHJpbmc7XG4gICAgdGVhbUlkOiBzdHJpbmc7XG4gICAgbG9ja1R5cGU6IExvY2tUeXBlO1xuICAgIGVucXVldWVkQXQ6IG51bWJlcjtcbiAgICByZXNvbHZlOiAobG9jazogUmVzb3VyY2VMb2NrKSA9PiB2b2lkO1xuICAgIHJlamVjdDogKGVycm9yOiBFcnJvcikgPT4gdm9pZDtcbiAgfT47XG59XG5cbi8qKlxuICog6ZSB6YWN572uXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUmVzb3VyY2VMb2Nrc0NvbmZpZyB7XG4gIC8qKiDpu5jorqTnp5/nuqbml7bpl7TvvIjmr6vnp5LvvIkgKi9cbiAgZGVmYXVsdExlYXNlTXM/OiBudW1iZXI7XG4gIFxuICAvKiog5pyA5aSn56ef57qm5pe26Ze077yI5q+r56eS77yJICovXG4gIG1heExlYXNlTXM/OiBudW1iZXI7XG4gIFxuICAvKiog6ZSB6L+H5pyf5qOA5p+l6Ze06ZqU77yI5q+r56eS77yJICovXG4gIGV4cGlyeUNoZWNrSW50ZXJ2YWxNcz86IG51bWJlcjtcbiAgXG4gIC8qKiDmrbvplIHmo4DmtYvlkK/nlKggKi9cbiAgZW5hYmxlRGVhZGxvY2tEZXRlY3Rpb24/OiBib29sZWFuO1xufVxuXG4vKipcbiAqIOmUgee7n+iuoVxuICovXG5leHBvcnQgaW50ZXJmYWNlIExvY2tTdGF0cyB7XG4gIC8vIOW9k+WJjemUgVxuICBhY3RpdmVMb2NrczogbnVtYmVyO1xuICBleGNsdXNpdmVMb2NrczogbnVtYmVyO1xuICBzaGFyZWRMb2NrczogbnVtYmVyO1xuICB3YWl0aW5nQ291bnQ6IG51bWJlcjtcbiAgXG4gIC8vIOWOhuWPslxuICB0b3RhbEFjcXVpcmVkOiBudW1iZXI7XG4gIHRvdGFsUmVsZWFzZWQ6IG51bWJlcjtcbiAgdG90YWxFeHBpcmVkOiBudW1iZXI7XG4gIHRvdGFsRmFpbGVkOiBudW1iZXI7XG4gIFxuICAvLyDmgKfog71cbiAgYXZnV2FpdFRpbWVNczogbnVtYmVyO1xuICBhdmdIb2xkVGltZU1zOiBudW1iZXI7XG4gIFxuICAvLyDmrbvplIFcbiAgZGVhZGxvY2tEZXRlY3RlZDogbnVtYmVyO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDotYTmupDplIHnrqHnkIblmahcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGNsYXNzIFJlc291cmNlTG9ja3Mge1xuICBwcml2YXRlIGNvbmZpZzogUmVxdWlyZWQ8UmVzb3VyY2VMb2Nrc0NvbmZpZz47XG4gIFxuICAvLyDplIHlrZjlgqhcbiAgcHJpdmF0ZSBsb2NrczogTWFwPHN0cmluZywgUmVzb3VyY2VMb2NrPiA9IG5ldyBNYXAoKTtcbiAgXG4gIC8vIOetieW+hemYn+WIl++8iOaMiei1hOa6kO+8iVxuICBwcml2YXRlIHdhaXRRdWV1ZXM6IE1hcDxzdHJpbmcsIFJlc291cmNlTG9ja1snd2FpdFF1ZXVlJ10+ID0gbmV3IE1hcCgpO1xuICBcbiAgLy8g5oyB5pyJ6ICF6Lef6Liq77yI55So5LqO5q276ZSB5qOA5rWL77yJXG4gIHByaXZhdGUgb3duZXJMb2NrczogTWFwPHN0cmluZywgU2V0PHN0cmluZz4+ID0gbmV3IE1hcCgpO1xuICBcbiAgLy8g57uf6K6hXG4gIHByaXZhdGUgc3RhdHM6IExvY2tTdGF0cyA9IHtcbiAgICBhY3RpdmVMb2NrczogMCxcbiAgICBleGNsdXNpdmVMb2NrczogMCxcbiAgICBzaGFyZWRMb2NrczogMCxcbiAgICB3YWl0aW5nQ291bnQ6IDAsXG4gICAgdG90YWxBY3F1aXJlZDogMCxcbiAgICB0b3RhbFJlbGVhc2VkOiAwLFxuICAgIHRvdGFsRXhwaXJlZDogMCxcbiAgICB0b3RhbEZhaWxlZDogMCxcbiAgICBhdmdXYWl0VGltZU1zOiAwLFxuICAgIGF2Z0hvbGRUaW1lTXM6IDAsXG4gICAgZGVhZGxvY2tEZXRlY3RlZDogMCxcbiAgfTtcbiAgXG4gIC8vIOetieW+heaXtumXtOiusOW9lVxuICBwcml2YXRlIHdhaXRUaW1lczogbnVtYmVyW10gPSBbXTtcbiAgcHJpdmF0ZSBob2xkVGltZXM6IG51bWJlcltdID0gW107XG4gIFxuICAvLyDov4fmnJ/mo4Dmn6Xlrprml7blmahcbiAgcHJpdmF0ZSBleHBpcnlUaW1lcj86IE5vZGVKUy5UaW1lb3V0O1xuICBcbiAgY29uc3RydWN0b3IoY29uZmlnOiBSZXNvdXJjZUxvY2tzQ29uZmlnID0ge30pIHtcbiAgICB0aGlzLmNvbmZpZyA9IHtcbiAgICAgIGRlZmF1bHRMZWFzZU1zOiBjb25maWcuZGVmYXVsdExlYXNlTXMgfHwgNjAwMDAsIC8vIDEg5YiG6ZKfXG4gICAgICBtYXhMZWFzZU1zOiBjb25maWcubWF4TGVhc2VNcyB8fCAzMDAwMDAsIC8vIDUg5YiG6ZKfXG4gICAgICBleHBpcnlDaGVja0ludGVydmFsTXM6IGNvbmZpZy5leHBpcnlDaGVja0ludGVydmFsTXMgfHwgNTAwMCwgLy8gNSDnp5JcbiAgICAgIGVuYWJsZURlYWRsb2NrRGV0ZWN0aW9uOiBjb25maWcuZW5hYmxlRGVhZGxvY2tEZXRlY3Rpb24gPz8gdHJ1ZSxcbiAgICB9O1xuICAgIFxuICAgIC8vIOWQr+WKqOi/h+acn+ajgOafpVxuICAgIHRoaXMuc3RhcnRFeHBpcnlDaGVjaygpO1xuICB9XG4gIFxuICAvKipcbiAgICog6I635Y+W6ZSBXG4gICAqL1xuICBhc3luYyBhY3F1aXJlKFxuICAgIHJlc291cmNlS2V5OiBzdHJpbmcsXG4gICAgb3duZXJJZDogc3RyaW5nLFxuICAgIHRlYW1JZDogc3RyaW5nLFxuICAgIGxvY2tUeXBlOiBMb2NrVHlwZSA9ICdleGNsdXNpdmUnLFxuICAgIG9wdGlvbnM/OiB7XG4gICAgICB0aW1lb3V0TXM/OiBudW1iZXI7XG4gICAgICBsZWFzZU1zPzogbnVtYmVyO1xuICAgIH1cbiAgKTogUHJvbWlzZTxSZXNvdXJjZUxvY2s+IHtcbiAgICBjb25zdCBsZWFzZU1zID0gTWF0aC5taW4oXG4gICAgICBvcHRpb25zPy5sZWFzZU1zIHx8IHRoaXMuY29uZmlnLmRlZmF1bHRMZWFzZU1zLFxuICAgICAgdGhpcy5jb25maWcubWF4TGVhc2VNc1xuICAgICk7XG4gICAgXG4gICAgLy8g5qOA5p+l5piv5ZCm5Y+v56uL5Y2z6I635Y+WXG4gICAgaWYgKHRoaXMuY2FuQWNxdWlyZShyZXNvdXJjZUtleSwgbG9ja1R5cGUpKSB7XG4gICAgICByZXR1cm4gdGhpcy5kb0FjcXVpcmUocmVzb3VyY2VLZXksIG93bmVySWQsIHRlYW1JZCwgbG9ja1R5cGUsIGxlYXNlTXMpO1xuICAgIH1cbiAgICBcbiAgICAvLyDmo4Dmn6XmrbvplIFcbiAgICBpZiAodGhpcy5jb25maWcuZW5hYmxlRGVhZGxvY2tEZXRlY3Rpb24pIHtcbiAgICAgIGlmICh0aGlzLndvdWxkQ2F1c2VEZWFkbG9jayhvd25lcklkLCByZXNvdXJjZUtleSkpIHtcbiAgICAgICAgdGhpcy5zdGF0cy5kZWFkbG9ja0RldGVjdGVkKys7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgRGVhZGxvY2sgZGV0ZWN0ZWQ6ICR7b3duZXJJZH0gd2FpdGluZyBmb3IgJHtyZXNvdXJjZUtleX1gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8g6ZyA6KaB562J5b6FXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPFJlc291cmNlTG9jaz4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgY29uc3Qgd2FpdEl0ZW0gPSB7XG4gICAgICAgIG93bmVySWQsXG4gICAgICAgIHRlYW1JZCxcbiAgICAgICAgbG9ja1R5cGUsXG4gICAgICAgIGVucXVldWVkQXQ6IERhdGUubm93KCksXG4gICAgICAgIHJlc29sdmUsXG4gICAgICAgIHJlamVjdCxcbiAgICAgIH07XG4gICAgICBcbiAgICAgIC8vIOa3u+WKoOWIsOetieW+hemYn+WIl1xuICAgICAgbGV0IHF1ZXVlID0gdGhpcy53YWl0UXVldWVzLmdldChyZXNvdXJjZUtleSk7XG4gICAgICBpZiAoIXF1ZXVlKSB7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHRoaXMud2FpdFF1ZXVlcy5zZXQocmVzb3VyY2VLZXksIHF1ZXVlKTtcbiAgICAgIH1cbiAgICAgIHF1ZXVlLnB1c2god2FpdEl0ZW0pO1xuICAgICAgXG4gICAgICB0aGlzLnN0YXRzLndhaXRpbmdDb3VudCsrO1xuICAgICAgXG4gICAgICAvLyDorr7nva7otoXml7ZcbiAgICAgIGlmIChvcHRpb25zPy50aW1lb3V0TXMpIHtcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgY29uc3QgaW5kZXggPSBxdWV1ZT8uaW5kZXhPZih3YWl0SXRlbSk7XG4gICAgICAgICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgICAgICAgcXVldWU/LnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgICB0aGlzLnN0YXRzLndhaXRpbmdDb3VudC0tO1xuICAgICAgICAgICAgdGhpcy5zdGF0cy50b3RhbEZhaWxlZCsrO1xuICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihgTG9jayBhY3F1aXJlIHRpbWVvdXQgYWZ0ZXIgJHtvcHRpb25zLnRpbWVvdXRNc31tc2ApKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sIG9wdGlvbnMudGltZW91dE1zKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOmHiuaUvumUgVxuICAgKi9cbiAgYXN5bmMgcmVsZWFzZShsb2NrSWQ6IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIGNvbnN0IGxvY2sgPSB0aGlzLmxvY2tzLmdldChsb2NrSWQpO1xuICAgIGlmICghbG9jaykge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBcbiAgICAvLyDorqHnrpfmjIHmnInml7bpl7RcbiAgICBjb25zdCBob2xkVGltZSA9IERhdGUubm93KCkgLSBsb2NrLmFjcXVpcmVkQXQ7XG4gICAgdGhpcy5yZWNvcmRIb2xkVGltZShob2xkVGltZSk7XG4gICAgXG4gICAgLy8g56e76Zmk6ZSBXG4gICAgdGhpcy5sb2Nrcy5kZWxldGUobG9ja0lkKTtcbiAgICBcbiAgICAvLyDmm7TmlrDmjIHmnInogIXot5/ouKpcbiAgICBjb25zdCBvd25lckxvY2tTZXQgPSB0aGlzLm93bmVyTG9ja3MuZ2V0KGxvY2sub3duZXJJZCk7XG4gICAgaWYgKG93bmVyTG9ja1NldCkge1xuICAgICAgb3duZXJMb2NrU2V0LmRlbGV0ZShsb2NrSWQpO1xuICAgICAgaWYgKG93bmVyTG9ja1NldC5zaXplID09PSAwKSB7XG4gICAgICAgIHRoaXMub3duZXJMb2Nrcy5kZWxldGUobG9jay5vd25lcklkKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8g5pu05paw57uf6K6hXG4gICAgdGhpcy5zdGF0cy50b3RhbFJlbGVhc2VkKys7XG4gICAgdGhpcy51cGRhdGVBY3RpdmVMb2NrcygpO1xuICAgIFxuICAgIC8vIOWkhOeQhuetieW+hemYn+WIl1xuICAgIGF3YWl0IHRoaXMucHJvY2Vzc1dhaXRRdWV1ZShsb2NrLnJlc291cmNlS2V5KTtcbiAgICBcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOe7reenn+mUgVxuICAgKi9cbiAgYXN5bmMgcmVuZXcobG9ja0lkOiBzdHJpbmcsIGFkZGl0aW9uYWxNcz86IG51bWJlcik6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIGNvbnN0IGxvY2sgPSB0aGlzLmxvY2tzLmdldChsb2NrSWQpO1xuICAgIGlmICghbG9jaykge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCBhZGRpdGlvbmFsID0gYWRkaXRpb25hbE1zIHx8IHRoaXMuY29uZmlnLmRlZmF1bHRMZWFzZU1zO1xuICAgIGNvbnN0IG5ld0V4cGlyZXNBdCA9IGxvY2suZXhwaXJlc0F0ICsgYWRkaXRpb25hbDtcbiAgICBjb25zdCBtYXhFeHBpcmVzQXQgPSBEYXRlLm5vdygpICsgdGhpcy5jb25maWcubWF4TGVhc2VNcztcbiAgICBcbiAgICBsb2NrLmV4cGlyZXNBdCA9IE1hdGgubWluKG5ld0V4cGlyZXNBdCwgbWF4RXhwaXJlc0F0KTtcbiAgICBcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOiOt+WPlumUgVxuICAgKi9cbiAgZ2V0TG9jayhsb2NrSWQ6IHN0cmluZyk6IFJlc291cmNlTG9jayB8IHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMubG9ja3MuZ2V0KGxvY2tJZCk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDojrflj5botYTmupDnmoTplIFcbiAgICovXG4gIGdldFJlc291cmNlTG9jayhyZXNvdXJjZUtleTogc3RyaW5nKTogUmVzb3VyY2VMb2NrIHwgdW5kZWZpbmVkIHtcbiAgICByZXR1cm4gdGhpcy5sb2Nrcy5nZXQocmVzb3VyY2VLZXkpO1xuICB9XG4gIFxuICAvKipcbiAgICog6I635Y+W5oyB5pyJ6ICF55qE5omA5pyJ6ZSBXG4gICAqL1xuICBnZXRPd25lckxvY2tzKG93bmVySWQ6IHN0cmluZyk6IFJlc291cmNlTG9ja1tdIHtcbiAgICBjb25zdCBsb2NrSWRzID0gdGhpcy5vd25lckxvY2tzLmdldChvd25lcklkKTtcbiAgICBpZiAoIWxvY2tJZHMpIHJldHVybiBbXTtcbiAgICBcbiAgICByZXR1cm4gQXJyYXkuZnJvbShsb2NrSWRzKVxuICAgICAgLm1hcChpZCA9PiB0aGlzLmxvY2tzLmdldChpZCkpXG4gICAgICAuZmlsdGVyKChsKTogbCBpcyBSZXNvdXJjZUxvY2sgPT4gbCAhPT0gdW5kZWZpbmVkKTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOiOt+WPlue7n+iuoVxuICAgKi9cbiAgZ2V0U3RhdHMoKTogTG9ja1N0YXRzIHtcbiAgICByZXR1cm4geyAuLi50aGlzLnN0YXRzIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDlgZzmraLov4fmnJ/mo4Dmn6VcbiAgICovXG4gIHN0b3AoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuZXhwaXJ5VGltZXIpIHtcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5leHBpcnlUaW1lcik7XG4gICAgICB0aGlzLmV4cGlyeVRpbWVyID0gdW5kZWZpbmVkO1xuICAgIH1cbiAgfVxuICBcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAvLyDlhoXpg6jmlrnms5VcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICBcbiAgLyoqXG4gICAqIOajgOafpeaYr+WQpuWPr+iOt+WPlumUgVxuICAgKi9cbiAgcHJpdmF0ZSBjYW5BY3F1aXJlKHJlc291cmNlS2V5OiBzdHJpbmcsIGxvY2tUeXBlOiBMb2NrVHlwZSk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IGV4aXN0aW5nTG9jayA9IHRoaXMubG9ja3MuZ2V0KHJlc291cmNlS2V5KTtcbiAgICBcbiAgICBpZiAoIWV4aXN0aW5nTG9jaykge1xuICAgICAgcmV0dXJuIHRydWU7IC8vIOaXoOmUgVxuICAgIH1cbiAgICBcbiAgICBpZiAoZXhpc3RpbmdMb2NrLnN0YXR1cyAhPT0gJ2FjcXVpcmVkJykge1xuICAgICAgcmV0dXJuIHRydWU7IC8vIOmUgeW3sumHiuaUvlxuICAgIH1cbiAgICBcbiAgICBpZiAoZXhpc3RpbmdMb2NrLmV4cGlyZXNBdCA8IERhdGUubm93KCkpIHtcbiAgICAgIHJldHVybiB0cnVlOyAvLyDplIHlt7Lov4fmnJ9cbiAgICB9XG4gICAgXG4gICAgLy8g5o6S5LuW6ZSB77ya5LiN5YWB6K645Lu75L2V5YW25LuW6ZSBXG4gICAgaWYgKGxvY2tUeXBlID09PSAnZXhjbHVzaXZlJyB8fCBleGlzdGluZ0xvY2subG9ja1R5cGUgPT09ICdleGNsdXNpdmUnKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIFxuICAgIC8vIOWFseS6q+mUge+8muWPr+S7peWFseWtmFxuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIFxuICAvKipcbiAgICog5omn6KGM6I635Y+W6ZSBXG4gICAqL1xuICBwcml2YXRlIGRvQWNxdWlyZShcbiAgICByZXNvdXJjZUtleTogc3RyaW5nLFxuICAgIG93bmVySWQ6IHN0cmluZyxcbiAgICB0ZWFtSWQ6IHN0cmluZyxcbiAgICBsb2NrVHlwZTogTG9ja1R5cGUsXG4gICAgbGVhc2VNczogbnVtYmVyXG4gICk6IFJlc291cmNlTG9jayB7XG4gICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbiAgICBcbiAgICAvLyDliJvlu7rplIFcbiAgICBjb25zdCBsb2NrOiBSZXNvdXJjZUxvY2sgPSB7XG4gICAgICBpZDogYCR7cmVzb3VyY2VLZXl9OiR7b3duZXJJZH06JHtub3d9YCxcbiAgICAgIHJlc291cmNlS2V5LFxuICAgICAgbG9ja1R5cGUsXG4gICAgICBvd25lcklkLFxuICAgICAgdGVhbUlkLFxuICAgICAgc3RhdHVzOiAnYWNxdWlyZWQnLFxuICAgICAgYWNxdWlyZWRBdDogbm93LFxuICAgICAgZXhwaXJlc0F0OiBub3cgKyBsZWFzZU1zLFxuICAgICAgbGVhc2VkQXQ6IG5vdyxcbiAgICAgIHdhaXRRdWV1ZTogW10sXG4gICAgfTtcbiAgICBcbiAgICAvLyDlrZjlgqjplIFcbiAgICB0aGlzLmxvY2tzLnNldChyZXNvdXJjZUtleSwgbG9jayk7XG4gICAgXG4gICAgLy8g5pu05paw5oyB5pyJ6ICF6Lef6LiqXG4gICAgbGV0IG93bmVyTG9ja1NldCA9IHRoaXMub3duZXJMb2Nrcy5nZXQob3duZXJJZCk7XG4gICAgaWYgKCFvd25lckxvY2tTZXQpIHtcbiAgICAgIG93bmVyTG9ja1NldCA9IG5ldyBTZXQoKTtcbiAgICAgIHRoaXMub3duZXJMb2Nrcy5zZXQob3duZXJJZCwgb3duZXJMb2NrU2V0KTtcbiAgICB9XG4gICAgb3duZXJMb2NrU2V0LmFkZChsb2NrLmlkKTtcbiAgICBcbiAgICAvLyDmm7TmlrDnu5/orqFcbiAgICB0aGlzLnN0YXRzLnRvdGFsQWNxdWlyZWQrKztcbiAgICB0aGlzLnVwZGF0ZUFjdGl2ZUxvY2tzKCk7XG4gICAgXG4gICAgcmV0dXJuIGxvY2s7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDlpITnkIbnrYnlvoXpmJ/liJdcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgcHJvY2Vzc1dhaXRRdWV1ZShyZXNvdXJjZUtleTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgcXVldWUgPSB0aGlzLndhaXRRdWV1ZXMuZ2V0KHJlc291cmNlS2V5KTtcbiAgICBpZiAoIXF1ZXVlIHx8IHF1ZXVlLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBcbiAgICAvLyDmo4Dmn6XmmK/lkKblj6/ojrflj5ZcbiAgICBpZiAoIXRoaXMuY2FuQWNxdWlyZShyZXNvdXJjZUtleSwgJ2V4Y2x1c2l2ZScpKSB7XG4gICAgICAvLyDmo4Dmn6XmmK/lkKbmnInlhbHkuqvplIHlj6/ku6Xojrflj5ZcbiAgICAgIGNvbnN0IGZpcnN0U2hhcmVkSW5kZXggPSBxdWV1ZS5maW5kSW5kZXgoaXRlbSA9PiBpdGVtLmxvY2tUeXBlID09PSAnc2hhcmVkJyk7XG4gICAgICBpZiAoZmlyc3RTaGFyZWRJbmRleCA9PT0gLTEpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyDlj6rmnInlhbHkuqvplIHlj6/ku6Xmibnph4/ojrflj5ZcbiAgICAgIGNvbnN0IHNoYXJlZEl0ZW1zID0gcXVldWUuZmlsdGVyKGl0ZW0gPT4gaXRlbS5sb2NrVHlwZSA9PT0gJ3NoYXJlZCcpO1xuICAgICAgaWYgKHNoYXJlZEl0ZW1zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIOWkhOeQhumYn+WIl1xuICAgIGNvbnN0IHJlbWFpbmluZyA9IFtdO1xuICAgIFxuICAgIGZvciAoY29uc3QgaXRlbSBvZiBxdWV1ZSkge1xuICAgICAgaWYgKHRoaXMuY2FuQWNxdWlyZShyZXNvdXJjZUtleSwgaXRlbS5sb2NrVHlwZSkpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCBsb2NrID0gdGhpcy5kb0FjcXVpcmUoXG4gICAgICAgICAgICByZXNvdXJjZUtleSxcbiAgICAgICAgICAgIGl0ZW0ub3duZXJJZCxcbiAgICAgICAgICAgIGl0ZW0udGVhbUlkLFxuICAgICAgICAgICAgaXRlbS5sb2NrVHlwZSxcbiAgICAgICAgICAgIHRoaXMuY29uZmlnLmRlZmF1bHRMZWFzZU1zXG4gICAgICAgICAgKTtcbiAgICAgICAgICBcbiAgICAgICAgICAvLyDorqHnrpfnrYnlvoXml7bpl7RcbiAgICAgICAgICBjb25zdCB3YWl0VGltZSA9IERhdGUubm93KCkgLSBpdGVtLmVucXVldWVkQXQ7XG4gICAgICAgICAgdGhpcy5yZWNvcmRXYWl0VGltZSh3YWl0VGltZSk7XG4gICAgICAgICAgXG4gICAgICAgICAgaXRlbS5yZXNvbHZlKGxvY2spO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIGl0ZW0ucmVqZWN0KGVycm9yIGFzIEVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVtYWluaW5nLnB1c2goaXRlbSk7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHRoaXMud2FpdFF1ZXVlcy5zZXQocmVzb3VyY2VLZXksIHJlbWFpbmluZyk7XG4gICAgdGhpcy5zdGF0cy53YWl0aW5nQ291bnQgPSB0aGlzLmdldFRvdGFsV2FpdGluZ0NvdW50KCk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmo4Dmn6XmmK/lkKbkvJrlr7zoh7TmrbvplIFcbiAgICovXG4gIHByaXZhdGUgd291bGRDYXVzZURlYWRsb2NrKG93bmVySWQ6IHN0cmluZywgcmVzb3VyY2VLZXk6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIC8vIOeugOWNleatu+mUgeajgOa1i++8mlxuICAgIC8vIOWmguaenOaMgeacieiAheW3sue7j+WcqOetieW+heWFtuS7lui1hOa6kO+8jOiAjOmCo+S6m+i1hOa6kOeahOaMgeacieiAheWPiOWcqOetieW+hei/meS4quaMgeacieiAheeahOi1hOa6kFxuICAgIC8vIOWImeWPr+iDveatu+mUgVxuICAgIFxuICAgIGNvbnN0IG93bmVyTG9ja3MgPSB0aGlzLmdldE93bmVyTG9ja3Mob3duZXJJZCk7XG4gICAgaWYgKG93bmVyTG9ja3MubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIFxuICAgIC8vIOiOt+WPluW9k+WJjei1hOa6kOeahOetieW+hemYn+WIl1xuICAgIGNvbnN0IHF1ZXVlID0gdGhpcy53YWl0UXVldWVzLmdldChyZXNvdXJjZUtleSk7XG4gICAgaWYgKCFxdWV1ZSB8fCBxdWV1ZS5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgXG4gICAgLy8g5qOA5p+l562J5b6F6Zif5YiX5Lit55qE5oyB5pyJ6ICF5piv5ZCm5Lmf5Zyo562J5b6F5b2T5YmN5oyB5pyJ6ICF55qE6LWE5rqQXG4gICAgZm9yIChjb25zdCBpdGVtIG9mIHF1ZXVlKSB7XG4gICAgICBjb25zdCBpdGVtTG9ja3MgPSB0aGlzLmdldE93bmVyTG9ja3MoaXRlbS5vd25lcklkKTtcbiAgICAgIFxuICAgICAgZm9yIChjb25zdCBpdGVtTG9jayBvZiBpdGVtTG9ja3MpIHtcbiAgICAgICAgY29uc3QgaXRlbUxvY2tRdWV1ZSA9IHRoaXMud2FpdFF1ZXVlcy5nZXQoaXRlbUxvY2sucmVzb3VyY2VLZXkpO1xuICAgICAgICBpZiAoaXRlbUxvY2tRdWV1ZSkge1xuICAgICAgICAgIGZvciAoY29uc3Qgd2FpdEl0ZW0gb2YgaXRlbUxvY2tRdWV1ZSkge1xuICAgICAgICAgICAgaWYgKHdhaXRJdGVtLm93bmVySWQgPT09IG93bmVySWQpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHRydWU7IC8vIOajgOa1i+WIsOW+queOr+etieW+hVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDlkK/liqjov4fmnJ/mo4Dmn6VcbiAgICovXG4gIHByaXZhdGUgc3RhcnRFeHBpcnlDaGVjaygpOiB2b2lkIHtcbiAgICB0aGlzLmV4cGlyeVRpbWVyID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbiAgICAgIFxuICAgICAgZm9yIChjb25zdCBbcmVzb3VyY2VLZXksIGxvY2tdIG9mIHRoaXMubG9ja3MuZW50cmllcygpKSB7XG4gICAgICAgIGlmIChsb2NrLnN0YXR1cyA9PT0gJ2FjcXVpcmVkJyAmJiBsb2NrLmV4cGlyZXNBdCA8IG5vdykge1xuICAgICAgICAgIC8vIOmUgei/h+acn1xuICAgICAgICAgIGxvY2suc3RhdHVzID0gJ2V4cGlyZWQnO1xuICAgICAgICAgIHRoaXMuc3RhdHMudG90YWxFeHBpcmVkKys7XG4gICAgICAgICAgXG4gICAgICAgICAgLy8g6YeK5pS+6ZSBXG4gICAgICAgICAgdGhpcy5sb2Nrcy5kZWxldGUocmVzb3VyY2VLZXkpO1xuICAgICAgICAgIHRoaXMudXBkYXRlQWN0aXZlTG9ja3MoKTtcbiAgICAgICAgICBcbiAgICAgICAgICAvLyDlpITnkIbnrYnlvoXpmJ/liJdcbiAgICAgICAgICB0aGlzLnByb2Nlc3NXYWl0UXVldWUocmVzb3VyY2VLZXkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSwgdGhpcy5jb25maWcuZXhwaXJ5Q2hlY2tJbnRlcnZhbE1zKTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOabtOaWsOa0u+i3g+mUgee7n+iuoVxuICAgKi9cbiAgcHJpdmF0ZSB1cGRhdGVBY3RpdmVMb2NrcygpOiB2b2lkIHtcbiAgICBsZXQgYWN0aXZlID0gMDtcbiAgICBsZXQgZXhjbHVzaXZlID0gMDtcbiAgICBsZXQgc2hhcmVkID0gMDtcbiAgICBcbiAgICBmb3IgKGNvbnN0IGxvY2sgb2YgdGhpcy5sb2Nrcy52YWx1ZXMoKSkge1xuICAgICAgaWYgKGxvY2suc3RhdHVzID09PSAnYWNxdWlyZWQnKSB7XG4gICAgICAgIGFjdGl2ZSsrO1xuICAgICAgICBpZiAobG9jay5sb2NrVHlwZSA9PT0gJ2V4Y2x1c2l2ZScpIHtcbiAgICAgICAgICBleGNsdXNpdmUrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzaGFyZWQrKztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICB0aGlzLnN0YXRzLmFjdGl2ZUxvY2tzID0gYWN0aXZlO1xuICAgIHRoaXMuc3RhdHMuZXhjbHVzaXZlTG9ja3MgPSBleGNsdXNpdmU7XG4gICAgdGhpcy5zdGF0cy5zaGFyZWRMb2NrcyA9IHNoYXJlZDtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOiOt+WPluaAu+etieW+heaVsFxuICAgKi9cbiAgcHJpdmF0ZSBnZXRUb3RhbFdhaXRpbmdDb3VudCgpOiBudW1iZXIge1xuICAgIGxldCB0b3RhbCA9IDA7XG4gICAgZm9yIChjb25zdCBxdWV1ZSBvZiB0aGlzLndhaXRRdWV1ZXMudmFsdWVzKCkpIHtcbiAgICAgIHRvdGFsICs9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgcmV0dXJuIHRvdGFsO1xuICB9XG4gIFxuICAvKipcbiAgICog6K6w5b2V562J5b6F5pe26Ze0XG4gICAqL1xuICBwcml2YXRlIHJlY29yZFdhaXRUaW1lKHdhaXRUaW1lOiBudW1iZXIpOiB2b2lkIHtcbiAgICB0aGlzLndhaXRUaW1lcy5wdXNoKHdhaXRUaW1lKTtcbiAgICBcbiAgICBpZiAodGhpcy53YWl0VGltZXMubGVuZ3RoID4gMTAwMCkge1xuICAgICAgdGhpcy53YWl0VGltZXMuc2hpZnQoKTtcbiAgICB9XG4gICAgXG4gICAgdGhpcy5zdGF0cy5hdmdXYWl0VGltZU1zID0gdGhpcy5jYWxjdWxhdGVBdmVyYWdlKHRoaXMud2FpdFRpbWVzKTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOiusOW9leaMgeacieaXtumXtFxuICAgKi9cbiAgcHJpdmF0ZSByZWNvcmRIb2xkVGltZShob2xkVGltZTogbnVtYmVyKTogdm9pZCB7XG4gICAgdGhpcy5ob2xkVGltZXMucHVzaChob2xkVGltZSk7XG4gICAgXG4gICAgaWYgKHRoaXMuaG9sZFRpbWVzLmxlbmd0aCA+IDEwMDApIHtcbiAgICAgIHRoaXMuaG9sZFRpbWVzLnNoaWZ0KCk7XG4gICAgfVxuICAgIFxuICAgIHRoaXMuc3RhdHMuYXZnSG9sZFRpbWVNcyA9IHRoaXMuY2FsY3VsYXRlQXZlcmFnZSh0aGlzLmhvbGRUaW1lcyk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDorqHnrpflubPlnYflgLxcbiAgICovXG4gIHByaXZhdGUgY2FsY3VsYXRlQXZlcmFnZSh2YWx1ZXM6IG51bWJlcltdKTogbnVtYmVyIHtcbiAgICBpZiAodmFsdWVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIDA7XG4gICAgcmV0dXJuIHZhbHVlcy5yZWR1Y2UoKGEsIGIpID0+IGEgKyBiLCAwKSAvIHZhbHVlcy5sZW5ndGg7XG4gIH1cbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5L6/5o235Ye95pWwXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog5Yib5bu66LWE5rqQ6ZSB566h55CG5ZmoXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVSZXNvdXJjZUxvY2tzKGNvbmZpZz86IFJlc291cmNlTG9ja3NDb25maWcpOiBSZXNvdXJjZUxvY2tzIHtcbiAgcmV0dXJuIG5ldyBSZXNvdXJjZUxvY2tzKGNvbmZpZyk7XG59XG5cbi8qKlxuICog6LWE5rqQ6ZSu55Sf5oiQ5ZmoXG4gKi9cbmV4cG9ydCBjbGFzcyBSZXNvdXJjZUtleUJ1aWxkZXIge1xuICAvKipcbiAgICog55Sf5oiQIHdvcmt0cmVlIOmUgemUrlxuICAgKi9cbiAgc3RhdGljIHdvcmt0cmVlKHBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGB3b3JrdHJlZToke3BhdGh9YDtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOeUn+aIkCByZXBvIOmUgemUrlxuICAgKi9cbiAgc3RhdGljIHJlcG8ocGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gYHJlcG86JHtwYXRofWA7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDnlJ/miJAgYXJ0aWZhY3Qg6ZSB6ZSuXG4gICAqL1xuICBzdGF0aWMgYXJ0aWZhY3QobmFtZXNwYWNlOiBzdHJpbmcsIGlkOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiBgYXJ0aWZhY3Q6JHtuYW1lc3BhY2V9OiR7aWR9YDtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOeUn+aIkCBwYXRjaCDplIHplK5cbiAgICovXG4gIHN0YXRpYyBwYXRjaChmaWxlSWQ6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGBwYXRjaDoke2ZpbGVJZH1gO1xuICB9XG59XG4iXX0=