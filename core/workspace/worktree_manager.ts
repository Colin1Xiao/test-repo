/**
 * WorktreeManager - 隔离工作区管理器
 * 
 * 为高风险任务创建隔离执行目录。
 * 记录 source workspace 与 worktree 关系。
 * 任务结束后保留 diff/summary。
 * 
 * 先实现"隔离执行目录 + 结果可审计"，不追求完整 git worktree 耦合。
 */

import * as fs from 'fs';
import * as path from 'path';

/** Worktree 元数据 */
export interface WorktreeMetadata {
  /** Worktree ID（通常等于 task ID） */
  id: string;
  /** 源工作区路径 */
  sourceWorkspace: string;
  /** Worktree 路径 */
  worktreePath: string;
  /** 创建时间 */
  createdAt: number;
  /** 关联任务 ID */
  taskId?: string;
  /** 关联会话 ID */
  sessionId?: string;
  /** 触发原因 */
  reason: string;
  /** 状态 */
  status: 'active' | 'completed' | 'destroyed';
}

/** Worktree 配置 */
export interface WorktreeManagerConfig {
  /** Worktree 根目录，默认 ~/.openclaw/runtime/worktrees */
  rootDir?: string;
  /** 自动清理过期 worktree */
  autoCleanup?: boolean;
  /** 保留天数 */
  retainDays?: number;
}

/** Worktree 管理器实现 */
export class WorktreeManager {
  private rootDir: string;
  private retainDays: number;
  private worktrees: Map<string, WorktreeMetadata> = new Map();

  constructor(config: WorktreeManagerConfig = {}) {
    this.rootDir = config.rootDir ?? path.join(
      process.env.HOME ?? '~',
      '.openclaw',
      'runtime',
      'worktrees',
    );
    this.retainDays = config.retainDays ?? 7;
    
    // 确保根目录存在
    if (!fs.existsSync(this.rootDir)) {
      fs.mkdirSync(this.rootDir, { recursive: true });
    }
    
    // 加载已有 worktrees
    this.load();
  }

  /**
   * 创建隔离 worktree
   */
  create(options: {
    taskId?: string;
    sessionId?: string;
    sourceWorkspace: string;
    reason: string;
  }): WorktreeMetadata {
    const id = `wt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const worktreePath = path.join(this.rootDir, id, 'workspace');
    
    // 创建目录
    fs.mkdirSync(worktreePath, { recursive: true });
    
    // 如果是 git 仓库，复制 .git 配置（可选）
    const gitDir = path.join(options.sourceWorkspace, '.git');
    if (fs.existsSync(gitDir)) {
      // 简化实现：不复制整个 .git，只记录源
      console.log(`[Worktree] Source is git repo, but not copying .git for isolation`);
    }
    
    const metadata: WorktreeMetadata = {
      id,
      sourceWorkspace: options.sourceWorkspace,
      worktreePath,
      createdAt: Date.now(),
      taskId: options.taskId,
      sessionId: options.sessionId,
      reason: options.reason,
      status: 'active',
    };
    
    this.worktrees.set(id, metadata);
    this.saveMetadata(metadata);
    
    console.log(`[Worktree] Created: ${id} for task ${options.taskId ?? 'unknown'}`);
    
    return metadata;
  }

  /**
   * 获取 worktree
   */
  get(id: string): WorktreeMetadata | undefined {
    return this.worktrees.get(id);
  }

  /**
   * 按任务 ID 获取 worktree
   */
  getByTaskId(taskId: string): WorktreeMetadata | undefined {
    for (const wt of this.worktrees.values()) {
      if (wt.taskId === taskId) {
        return wt;
      }
    }
    return undefined;
  }

  /**
   * 完成 worktree（写入 summary）
   */
  complete(id: string, summary: {
    diff?: string;
    changes?: string[];
    output?: string;
  }): void {
    const metadata = this.worktrees.get(id);
    if (!metadata) {
      throw new Error(`Worktree not found: ${id}`);
    }
    
    // 写入 summary.json
    const summaryPath = path.join(this.rootDir, id, 'summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify({
      ...summary,
      completedAt: Date.now(),
    }, null, 2));
    
    // 更新状态
    metadata.status = 'completed';
    this.worktrees.set(id, metadata);
    this.saveMetadata(metadata);
    
    console.log(`[Worktree] Completed: ${id}`);
  }

  /**
   * 销毁 worktree
   */
  destroy(id: string): void {
    const metadata = this.worktrees.get(id);
    if (!metadata) {
      return;
    }
    
    // 删除目录
    const worktreeDir = path.join(this.rootDir, id);
    if (fs.existsSync(worktreeDir)) {
      fs.rmSync(worktreeDir, { recursive: true, force: true });
    }
    
    // 更新状态
    metadata.status = 'destroyed';
    this.worktrees.set(id, metadata);
    this.saveMetadata(metadata);
    
    console.log(`[Worktree] Destroyed: ${id}`);
  }

  /**
   * 列出活跃 worktrees
   */
  listActive(): WorktreeMetadata[] {
    return Array.from(this.worktrees.values())
      .filter(wt => wt.status === 'active');
  }

  /**
   * 清理过期 worktrees
   */
  cleanupExpired(): number {
    const cutoff = Date.now() - (this.retainDays * 24 * 60 * 60 * 1000);
    let count = 0;
    
    for (const [id, metadata] of this.worktrees.entries()) {
      if (metadata.status === 'completed' && metadata.createdAt < cutoff) {
        this.destroy(id);
        count++;
      }
    }
    
    return count;
  }

  /**
   * 保存元数据
   */
  private saveMetadata(metadata: WorktreeMetadata): void {
    const metaPath = path.join(this.rootDir, metadata.id, 'metadata.json');
    fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
  }

  /**
   * 加载已有 worktrees
   */
  private load(): void {
    if (!fs.existsSync(this.rootDir)) {
      return;
    }
    
    const entries = fs.readdirSync(this.rootDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      
      const metaPath = path.join(this.rootDir, entry.name, 'metadata.json');
      if (fs.existsSync(metaPath)) {
        try {
          const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as WorktreeMetadata;
          this.worktrees.set(metadata.id, metadata);
        } catch (error) {
          console.error(`[Worktree] Failed to load metadata for ${entry.name}:`, error);
        }
      }
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    total: number;
    active: number;
    completed: number;
    destroyed: number;
  } {
    const stats = {
      total: this.worktrees.size,
      active: 0,
      completed: 0,
      destroyed: 0,
    };
    
    this.worktrees.forEach(wt => {
      stats[wt.status]++;
    });
    
    return stats;
  }
}
