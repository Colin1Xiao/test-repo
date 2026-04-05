/**
 * Phase 3B-3: File Lock
 * 
 * 简单的文件锁实现，用于保护并发写入：
 * - 基于文件存在性
 * - 带超时自动释放
 * - 用于单实例内的异步写入串行化
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';

// ==================== Configuration ====================

export interface FileLockConfig {
  lockDir: string;
  defaultTimeoutMs: number;
  staleThresholdMs: number;
}

const DEFAULT_CONFIG: FileLockConfig = {
  lockDir: './data/locks',
  defaultTimeoutMs: 30000, // 30 秒
  staleThresholdMs: 60000, // 60 秒
};

// ==================== File Lock ====================

export class FileLock {
  private readonly config: FileLockConfig;
  private readonly heldLocks: Map<string, { acquired_at: number; timeout_ms: number }> = new Map();

  constructor(config: Partial<FileLockConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async initialize(): Promise<void> {
    await fs.mkdir(join(process.cwd(), this.config.lockDir), { recursive: true });
    console.log(`[FileLock] Initialized with lock directory: ${this.config.lockDir}`);
  }

  /**
   * Acquire a lock
   * 
   * @param lockName - Lock name (e.g., 'incidents', 'timeline', 'audit')
   * @param timeout_ms - Lock timeout in milliseconds
   * @returns true if lock acquired, false if already held
   */
  async acquire(lockName: string, timeout_ms: number = this.config.defaultTimeoutMs): Promise<boolean> {
    const lockPath = join(process.cwd(), this.config.lockDir, `${lockName}.lock`);
    const now = Date.now();

    // Check if we already hold this lock
    const existingLock = this.heldLocks.get(lockName);
    if (existingLock) {
      // Check if our lock is stale
      if (now - existingLock.acquired_at < existingLock.timeout_ms) {
        console.warn(`[FileLock] Lock ${lockName} already held by this instance`);
        return false;
      }
      // Our lock is stale, release it
      await this.release(lockName);
    }

    // Check if lock file exists and is stale
    try {
      const stat = await fs.stat(lockPath);
      const age = now - stat.mtimeMs;

      if (age < this.config.staleThresholdMs) {
        // Lock is held by another process and not stale
        return false;
      }

      // Lock is stale, remove it
      await fs.unlink(lockPath);
      console.warn(`[FileLock] Acquired stale lock: ${lockName} (age: ${age}ms)`);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      // Lock file doesn't exist, we can acquire it
    }

    // Create lock file
    const lockData = {
      acquired_at: now,
      timeout_ms,
      pid: process.pid,
    };
    await fs.writeFile(lockPath, JSON.stringify(lockData), 'utf-8');

    // Track in memory
    this.heldLocks.set(lockName, { acquired_at: now, timeout_ms });

    return true;
  }

  /**
   * Release a lock
   * 
   * @param lockName - Lock name
   * @returns true if released, false if not held
   */
  async release(lockName: string): Promise<boolean> {
    const lockPath = join(process.cwd(), this.config.lockDir, `${lockName}.lock`);

    // Remove from memory
    this.heldLocks.delete(lockName);

    // Remove lock file
    try {
      await fs.unlink(lockPath);
      return true;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Execute a function while holding a lock
   * 
   * @param lockName - Lock name
   * @param fn - Function to execute
   * @param timeout_ms - Lock timeout
   * @returns Function result
   */
  async withLock<T>(lockName: string, fn: () => Promise<T>, timeout_ms: number = this.config.defaultTimeoutMs): Promise<T> {
    const acquired = await this.acquire(lockName, timeout_ms);
    if (!acquired) {
      throw new Error(`Failed to acquire lock: ${lockName}`);
    }

    try {
      return await fn();
    } finally {
      await this.release(lockName);
    }
  }

  /**
   * Check if a lock is currently held
   */
  async isLocked(lockName: string): Promise<boolean> {
    const lockPath = join(process.cwd(), this.config.lockDir, `${lockName}.lock`);

    try {
      const stat = await fs.stat(lockPath);
      const age = Date.now() - stat.mtimeMs;
      return age < this.config.staleThresholdMs;
    } catch {
      return false;
    }
  }

  /**
   * Get lock statistics
   */
  getStats(): { held_locks: number; lock_names: string[] } {
    const now = Date.now();
    const activeLocks: string[] = [];

    for (const [name, lock] of this.heldLocks.entries()) {
      if (now - lock.acquired_at < lock.timeout_ms) {
        activeLocks.push(name);
      }
    }

    return {
      held_locks: activeLocks.length,
      lock_names: activeLocks,
    };
  }
}

// ==================== Singleton ====================

let instance: FileLock | null = null;

export function getFileLock(): FileLock {
  if (!instance) {
    instance = new FileLock();
  }
  return instance;
}
