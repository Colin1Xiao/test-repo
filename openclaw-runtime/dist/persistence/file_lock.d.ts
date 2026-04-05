/**
 * Phase 3B-3: File Lock
 *
 * 简单的文件锁实现，用于保护并发写入：
 * - 基于文件存在性
 * - 带超时自动释放
 * - 用于单实例内的异步写入串行化
 */
export interface FileLockConfig {
    lockDir: string;
    defaultTimeoutMs: number;
    staleThresholdMs: number;
}
export declare class FileLock {
    private readonly config;
    private readonly heldLocks;
    constructor(config?: Partial<FileLockConfig>);
    initialize(): Promise<void>;
    /**
     * Acquire a lock
     *
     * @param lockName - Lock name (e.g., 'incidents', 'timeline', 'audit')
     * @param timeout_ms - Lock timeout in milliseconds
     * @returns true if lock acquired, false if already held
     */
    acquire(lockName: string, timeout_ms?: number): Promise<boolean>;
    /**
     * Release a lock
     *
     * @param lockName - Lock name
     * @returns true if released, false if not held
     */
    release(lockName: string): Promise<boolean>;
    /**
     * Execute a function while holding a lock
     *
     * @param lockName - Lock name
     * @param fn - Function to execute
     * @param timeout_ms - Lock timeout
     * @returns Function result
     */
    withLock<T>(lockName: string, fn: () => Promise<T>, timeout_ms?: number): Promise<T>;
    /**
     * Check if a lock is currently held
     */
    isLocked(lockName: string): Promise<boolean>;
    /**
     * Get lock statistics
     */
    getStats(): {
        held_locks: number;
        lock_names: string[];
    };
}
export declare function getFileLock(): FileLock;
//# sourceMappingURL=file_lock.d.ts.map