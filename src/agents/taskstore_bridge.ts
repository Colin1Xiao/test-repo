/**
 * TaskStore Bridge - 任务存储桥接层
 * 
 * 将 Agent Teams 的子任务注册到 OpenClaw TaskStore
 * 实现 parent-child task graph 可追踪、可审计
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type { TaskStore } from '../../core/runtime/task_store';
import type { RuntimeTask, TaskType, TaskStatus } from '../../core/runtime/task_model';
import type { SubagentTask, SubagentResult, TeamContext } from './types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 子任务类型
 */
export type SubagentTaskType = 'subagent' | 'team';

/**
 * 任务创建输入
 */
export interface SubagentTaskInput {
  type: SubagentTaskType;
  sessionId: string;
  agentId: string;
  workspaceRoot: string;
  description: string;
  parentTaskId?: string;
  teamId?: string;
  subagentRole?: string;
}

/**
 * 任务桥接接口
 */
export interface ITaskStoreBridge {
  /**
   * 创建团队任务
   */
  createTeamTask(
    teamId: string,
    parentTaskId: string,
    sessionId: string,
    agentId: string,
    workspaceRoot: string,
    goal: string
  ): Promise<RuntimeTask>;
  
  /**
   * 创建子代理任务
   */
  createSubagentTask(
    task: SubagentTask,
    teamTaskId: string
  ): Promise<RuntimeTask>;
  
  /**
   * 更新子任务状态
   */
  updateSubagentStatus(
    runtimeTaskId: string,
    status: TaskStatus,
    error?: string
  ): Promise<void>;
  
  /**
   * 记录子代理结果
   */
  recordSubagentResult(
    runtimeTaskId: string,
    result: SubagentResult
  ): Promise<void>;
  
  /**
   * 完成团队任务
   */
  completeTeamTask(
    runtimeTaskId: string,
    mergedSummary: string
  ): Promise<void>;
  
  /**
   * 失败团队任务
   */
  failTeamTask(
    runtimeTaskId: string,
    reason: string
  ): Promise<void>;
  
  /**
   * 获取团队的所有子任务
   */
  getTeamSubtasks(teamTaskId: string): Promise<RuntimeTask[]>;
}

// ============================================================================
// 任务桥接实现
// ============================================================================

export class TaskStoreBridge implements ITaskStoreBridge {
  private taskStore: TaskStore;
  
  constructor(taskStore: TaskStore) {
    this.taskStore = taskStore;
  }
  
  /**
   * 创建团队任务
   */
  async createTeamTask(
    teamId: string,
    parentTaskId: string,
    sessionId: string,
    agentId: string,
    workspaceRoot: string,
    goal: string
  ): Promise<RuntimeTask> {
    const task = this.taskStore.create({
      type: 'subagent',
      sessionId,
      agentId,
      workspaceRoot,
      description: `Team: ${goal}`,
      parentTaskId,
      metadata: {
        teamId,
        teamType: 'orchestrator',
        createdAt: Date.now(),
      },
    });
    
    return task;
  }
  
  /**
   * 创建子代理任务
   */
  async createSubagentTask(
    task: SubagentTask,
    teamTaskId: string
  ): Promise<RuntimeTask> {
    const runtimeTask = this.taskStore.create({
      type: 'subagent',
      sessionId: task.sessionId,
      agentId: task.agent,
      workspaceRoot: task.worktree || '/workspace',
      description: `[${task.agent}] ${task.goal}`,
      parentTaskId: teamTaskId,
      metadata: {
        subagentTaskId: task.id,
        teamId: task.teamId,
        role: task.agent,
        budget: task.budget,
        dependsOn: task.dependsOn,
        createdAt: task.createdAt,
      },
    });
    
    return runtimeTask;
  }
  
  /**
   * 更新子任务状态
   */
  async updateSubagentStatus(
    runtimeTaskId: string,
    status: TaskStatus,
    error?: string
  ): Promise<void> {
    const patch: Partial<RuntimeTask> = {
      status,
      ...(error ? { error } : {}),
    };
    
    this.taskStore.update(runtimeTaskId, patch);
  }
  
  /**
   * 记录子代理结果
   */
  async recordSubagentResult(
    runtimeTaskId: string,
    result: SubagentResult
  ): Promise<void> {
    const task = this.taskStore.get(runtimeTaskId);
    if (!task) {
      throw new Error(`Task not found: ${runtimeTaskId}`);
    }
    
    // 更新 metadata
    this.taskStore.update(runtimeTaskId, {
      metadata: {
        ...task.metadata,
        result: {
          summary: result.summary,
          confidence: result.confidence,
          turnsUsed: result.turnsUsed,
          tokensUsed: result.tokensUsed,
          durationMs: result.durationMs,
          artifacts: result.artifacts,
          patches: result.patches,
          findings: result.findings,
        },
      },
    });
    
    // 追加输出
    const output = this.formatResultOutput(result);
    this.taskStore.appendOutput(runtimeTaskId, output);
  }
  
  /**
   * 完成团队任务
   */
  async completeTeamTask(
    runtimeTaskId: string,
    mergedSummary: string
  ): Promise<void> {
    const task = this.taskStore.get(runtimeTaskId);
    if (!task) {
      throw new Error(`Task not found: ${runtimeTaskId}`);
    }
    
    this.taskStore.update(runtimeTaskId, {
      status: 'completed',
      metadata: {
        ...task.metadata,
        completedAt: Date.now(),
        mergedSummary,
      },
    });
    
    this.taskStore.appendOutput(runtimeTaskId, `\n## Team Completed\n\n${mergedSummary}`);
  }
  
  /**
   * 失败团队任务
   */
  async failTeamTask(
    runtimeTaskId: string,
    reason: string
  ): Promise<void> {
    const task = this.taskStore.get(runtimeTaskId);
    if (!task) {
      throw new Error(`Task not found: ${runtimeTaskId}`);
    }
    
    this.taskStore.update(runtimeTaskId, {
      status: 'failed',
      error: reason,
      metadata: {
        ...task.metadata,
        failedAt: Date.now(),
        failReason: reason,
      },
    });
    
    this.taskStore.appendOutput(runtimeTaskId, `\n## Team Failed\n\n${reason}`);
  }
  
  /**
   * 获取团队的所有子任务
   */
  async getTeamSubtasks(teamTaskId: string): Promise<RuntimeTask[]> {
    const subtasks = this.taskStore.list({
      parentTaskId: teamTaskId,
    });
    
    return subtasks;
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 格式化结果为输出文本
   */
  private formatResultOutput(result: SubagentResult): string {
    const lines: string[] = [];
    
    lines.push(`\n## Subagent Result: ${result.agent}\n`);
    lines.push(`**Summary**: ${result.summary}\n`);
    
    if (result.confidence) {
      lines.push(`**Confidence**: ${(result.confidence * 100).toFixed(0)}%\n`);
    }
    
    lines.push(`**Turns Used**: ${result.turnsUsed}\n`);
    lines.push(`**Duration**: ${result.durationMs}ms\n`);
    
    if (result.artifacts && result.artifacts.length > 0) {
      lines.push('\n**Artifacts**:\n');
      for (const artifact of result.artifacts) {
        lines.push(`- [${artifact.type}] ${artifact.description}`);
      }
    }
    
    if (result.patches && result.patches.length > 0) {
      lines.push('\n**Patches**:\n');
      for (const patch of result.patches) {
        lines.push(`- \`${patch.fileId}\`: +${patch.linesAdded} -${patch.linesDeleted}`);
      }
    }
    
    if (result.findings && result.findings.length > 0) {
      lines.push('\n**Findings**:\n');
      for (const finding of result.findings) {
        lines.push(`- [${finding.severity}] ${finding.description}`);
      }
    }
    
    if (result.error) {
      lines.push(`\n**Error**: ${result.error.message}\n`);
    }
    
    return lines.join('\n');
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建任务桥接实例
 */
export function createTaskStoreBridge(taskStore: TaskStore): ITaskStoreBridge {
  return new TaskStoreBridge(taskStore);
}

/**
 * 快速创建子任务（简化版）
 */
export async function createSubagentTaskQuick(
  taskStore: TaskStore,
  task: SubagentTask,
  teamTaskId: string
): Promise<RuntimeTask> {
  const bridge = new TaskStoreBridge(taskStore);
  return await bridge.createSubagentTask(task, teamTaskId);
}
