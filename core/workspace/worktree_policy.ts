/**
 * WorktreePolicy - Worktree 触发策略
 * 
 * 定义哪些任务需要进入隔离 worktree。
 */

import { WorktreeManager } from './worktree_manager';

/** Worktree 触发配置 */
export interface WorktreePolicyConfig {
  worktreeManager?: WorktreeManager;
  /** 自动触发 */
  autoTrigger?: boolean;
}

/** 触发原因 */
export type TriggerReason =
  | 'multi_file_write'        // 多文件写操作
  | 'code_fixer_agent'        // 代码修复类 agent
  | 'high_risk_command'       // 运行可能改写 repo 的命令
  | 'safe_mode_requested'     // 用户明确要求"安全模式"
  | 'untrusted_source';       // 不可信来源

/** Worktree 策略实现 */
export class WorktreePolicy {
  private worktreeManager?: WorktreeManager;
  private autoTrigger: boolean;

  constructor(config: WorktreePolicyConfig = {}) {
    this.worktreeManager = config.worktreeManager;
    this.autoTrigger = config.autoTrigger ?? true;
  }

  /**
   * 检查是否需要创建 worktree
   */
  shouldCreateWorktree(context: {
    agentName?: string;
    taskDescription?: string;
    filesToModify?: string[];
    commandsToRun?: string[];
    safeModeRequested?: boolean;
    trustedSource?: boolean;
  }): { shouldCreate: boolean; reason?: TriggerReason } {
    // 用户明确要求安全模式
    if (context.safeModeRequested) {
      return { shouldCreate: true, reason: 'safe_mode_requested' };
    }
    
    // 不可信来源
    if (context.trustedSource === false) {
      return { shouldCreate: true, reason: 'untrusted_source' };
    }
    
    // 代码修复类 agent
    if (context.agentName === 'code_fixer') {
      return { shouldCreate: true, reason: 'code_fixer_agent' };
    }
    
    // 多文件写操作（3 个文件以上）
    if (context.filesToModify && context.filesToModify.length >= 3) {
      return { shouldCreate: true, reason: 'multi_file_write' };
    }
    
    // 高风险命令
    const highRiskPatterns = [
      'git push',
      'git commit',
      'git rebase',
      'git reset',
      'npm publish',
      'yarn publish',
      'deploy',
      'build',
    ];
    
    if (context.commandsToRun) {
      for (const cmd of context.commandsToRun) {
        for (const pattern of highRiskPatterns) {
          if (cmd.toLowerCase().includes(pattern)) {
            return { shouldCreate: true, reason: 'high_risk_command' };
          }
        }
      }
    }
    
    // 默认不创建
    return { shouldCreate: false };
  }

  /**
   * 创建 worktree（如果需要）
   */
  createIfNeeded(context: {
    taskId?: string;
    sessionId?: string;
    sourceWorkspace: string;
    agentName?: string;
    taskDescription?: string;
    filesToModify?: string[];
    commandsToRun?: string[];
    safeModeRequested?: boolean;
    trustedSource?: boolean;
  }): { worktreePath: string; reason?: TriggerReason } | null {
    if (!this.autoTrigger) {
      return null;
    }
    
    const check = this.shouldCreateWorktree({
      agentName: context.agentName,
      taskDescription: context.taskDescription,
      filesToModify: context.filesToModify,
      commandsToRun: context.commandsToRun,
      safeModeRequested: context.safeModeRequested,
      trustedSource: context.trustedSource,
    });
    
    if (!check.shouldCreate || !this.worktreeManager) {
      return null;
    }
    
    const worktree = this.worktreeManager.create({
      taskId: context.taskId,
      sessionId: context.sessionId,
      sourceWorkspace: context.sourceWorkspace,
      reason: check.reason!,
    });
    
    return {
      worktreePath: worktree.worktreePath,
      reason: check.reason,
    };
  }

  /**
   * 获取 worktree 管理器
   */
  getManager(): WorktreeManager | undefined {
    return this.worktreeManager;
  }
}
