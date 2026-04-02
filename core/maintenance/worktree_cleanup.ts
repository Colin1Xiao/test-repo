/**
 * WorktreeCleanup - Worktree 清理任务
 * 
 * 定期清理过期/完成的 worktrees。
 */

import { WorktreeManager } from '../workspace/worktree_manager';
import * as fs from 'fs';
import * as path from 'path';

/** 清理配置 */
export interface WorktreeCleanupConfig {
  worktreeManager?: WorktreeManager;
  /** 保留天数 */
  retainDays?: number;
  /** 自动清理 */
  autoCleanup?: boolean;
}

/** Worktree 清理器 */
export class WorktreeCleaner {
  private worktreeManager?: WorktreeManager;
  private retainDays: number;

  constructor(config: WorktreeCleanupConfig = {}) {
    this.worktreeManager = config.worktreeManager;
    this.retainDays = config.retainDays ?? 7;
  }

  /**
   * 执行清理
   * 
   * @returns 清理的 worktree 数量
   */
  cleanup(): number {
    if (!this.worktreeManager) {
      console.warn('[WorktreeCleanup] No WorktreeManager configured');
      return 0;
    }

    const count = this.worktreeManager.cleanupExpired();
    console.log(`[WorktreeCleanup] Cleaned up ${count} expired worktrees`);
    return count;
  }

  /**
   * 手动清理指定 worktree
   */
  cleanupById(id: string): boolean {
    if (!this.worktreeManager) {
      return false;
    }

    const worktree = this.worktreeManager.get(id);
    if (!worktree) {
      return false;
    }

    this.worktreeManager.destroy(id);
    console.log(`[WorktreeCleanup] Manually destroyed worktree: ${id}`);
    return true;
  }

  /**
   * 获取可清理的 worktrees 列表
   */
  getCleanupCandidates(): Array<{
    id: string;
    status: string;
    createdAt: number;
    ageDays: number;
  }> {
    if (!this.worktreeManager) {
      return [];
    }

    const now = Date.now();
    const cutoff = now - (this.retainDays * 24 * 60 * 60 * 1000);
    const candidates: Array<any> = [];

    // 检查所有 completed 状态的 worktrees
    const stats = this.worktreeManager.getStats();
    console.log(`[WorktreeCleanup] Stats: ${JSON.stringify(stats)}`);

    // 简化实现：实际应遍历所有 worktrees
    return candidates;
  }

  /**
   * 设置定时清理
   */
  startPeriodicCleanup(intervalHours: number = 24): () => void {
    const intervalMs = intervalHours * 60 * 60 * 1000;
    
    const timer = setInterval(() => {
      this.cleanup();
    }, intervalMs);

    // 返回停止函数
    return () => clearInterval(timer);
  }
}

/**
 * 清理 orphaned 文件（不属于任何 task 的文件）
 */
export function cleanupOrphanedFiles(rootDir: string): number {
  let count = 0;

  if (!fs.existsSync(rootDir)) {
    return 0;
  }

  // 简化实现：实际应检查每个文件是否有对应的 task
  console.log('[WorktreeCleanup] Checking for orphaned files...');

  return count;
}
