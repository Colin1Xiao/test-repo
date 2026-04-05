/**
 * Agent Teams / Subagents - 团队编排器
 * 
 * 核心调度器：创建团队、调度子代理、归并结果
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type {
  SubagentTask,
  SubagentResult,
  TeamContext,
  TeamStatus,
  BudgetSpec,
  MergedResult,
  ArtifactRef,
  PatchRef,
  Finding,
} from "./types";
import type {
  ITeamOrchestrator,
  CreateTeamParams,
  DelegateTaskParams,
  WaitForOptions,
  AgentRoleConfig,
} from "./types";
import type { ISubagentRunner } from "./subagent_runner";
import {
  completeTeam,
  failTeam,
  cancelTeam,
  getTeamDuration,
  isTeamComplete,
} from "./state_machine";
import { SubagentRunner, IHookBus, NoOpHookBus } from "./subagent_runner";

// ============================================================================
// 团队事件类型（HookBus 集成）
// ============================================================================

export type TeamHookEventType =
  | "TeamCreate"
  | "TeamComplete"
  | "TeamFail"
  | "TeamCancel"
  | "TeamMerge";

export interface TeamHookEvent {
  type: TeamHookEventType;
  teamId: string;
  timestamp: number;
  [key: string]: unknown;
}

export interface TeamCreateEvent extends TeamHookEvent {
  type: "TeamCreate";
  parentTaskId: string;
  agents: string[];
  totalBudget: BudgetSpec;
}

export interface TeamCompleteEvent extends TeamHookEvent {
  type: "TeamComplete";
  results: SubagentResult[];
  mergedResult: MergedResult;
  durationMs: number;
}

export interface TeamFailEvent extends TeamHookEvent {
  type: "TeamFail";
  reason: string;
  failedTasks: string[];
}

export interface TeamCancelEvent extends TeamHookEvent {
  type: "TeamCancel";
  reason: string;
  cancelledTasks: string[];
}

export interface TeamMergeEvent extends TeamHookEvent {
  type: "TeamMerge";
  resultsCount: number;
  mergedSummary: string;
}

// ============================================================================
// 团队编排器实现
// ============================================================================

export class TeamOrchestrator implements ITeamOrchestrator {
  private teams: Map<string, TeamContext> = new Map();
  private runner: ISubagentRunner;
  private hookBus: IHookBus;
  
  constructor(runner?: ISubagentRunner, hookBus?: IHookBus) {
    this.runner = runner || new SubagentRunner();
    this.hookBus = hookBus || new NoOpHookBus();
  }
  
  /**
   * 创建子代理团队
   */
  async createTeam(params: CreateTeamParams): Promise<TeamContext> {
    const teamId = this.generateId("team");
    const timestamp = Date.now();
    
    // 创建团队上下文
    const context: TeamContext = {
      teamId,
      parentTaskId: params.parentTaskId,
      sessionId: params.sessionId,
      agents: [],
      sharedState: {},
      worktree: params.worktree,
      allowedTools: [],
      totalBudget: params.totalBudget,
      usedBudget: { turns: 0, tokens: 0, elapsedMs: 0 },
      status: "active",
      createdAt: timestamp,
    };
    
    // 创建子代理任务
    for (const agentConfig of params.agents) {
      const task: SubagentTask = {
        id: this.generateId("task"),
        parentTaskId: params.parentTaskId,
        sessionId: params.sessionId,
        teamId,
        agent: agentConfig.role,
        goal: agentConfig.goal,
        inputs: agentConfig.inputs || {},
        allowedTools: agentConfig.allowedTools,
        forbiddenTools: [],
        worktree: params.worktree,
        budget: agentConfig.budget,
        status: "queued",
        createdAt: timestamp,
        currentTurn: 0,
        dependsOn: agentConfig.dependsOn,
      };
      context.agents.push(task);
    }
    
    // 注册团队
    this.teams.set(teamId, context);
    
    // 触发 TeamCreate Hook
    await this.hookBus.emit({
      type: "TeamCreate",
      teamId,
      parentTaskId: params.parentTaskId,
      agents: params.agents.map(a => a.role),
      totalBudget: params.totalBudget,
      timestamp,
    } as TeamCreateEvent);
    
    return context;
  }
  
  /**
   * 动态添加子任务到团队
   */
  async delegateTask(params: DelegateTaskParams): Promise<SubagentTask> {
    const context = this.teams.get(params.teamId);
    if (!context) {
      throw new Error(`Team not found: ${params.teamId}`);
    }
    
    if (context.status !== "active") {
      throw new Error(`Team is not active: ${context.status}`);
    }
    
    const timestamp = Date.now();
    
    const task: SubagentTask = {
      id: this.generateId("task"),
      parentTaskId: context.parentTaskId,
      sessionId: context.sessionId,
      teamId: params.teamId,
      agent: params.agent,
      goal: params.goal,
      inputs: params.inputs || {},
      allowedTools: params.allowedTools,
      forbiddenTools: [],
      worktree: context.worktree,
      budget: params.budget,
      status: "queued",
      createdAt: timestamp,
      currentTurn: 0,
      dependsOn: params.dependsOn,
    };
    
    context.agents.push(task);
    
    return task;
  }
  
  /**
   * 等待团队所有子代理完成
   * 
   * 支持：
   * - 串行执行（有依赖）
   * - 简单 fan-out（无依赖）
   * - 失败处理
   */
  async waitForCompletion(
    teamId: string,
    options?: WaitForOptions
  ): Promise<SubagentResult[]> {
    const context = this.teams.get(teamId);
    if (!context) {
      throw new Error(`Team not found: ${teamId}`);
    }
    
    const timeoutMs = options?.timeoutMs || 300000;  // 默认 5 分钟
    const stopOnError = options?.stopOnError ?? false;
    
    const startTime = Date.now();
    const results: SubagentResult[] = [];
    const failedTasks: string[] = [];
    
    // 按依赖关系排序执行
    const executed = new Set<string>();
    const executing = new Map<string, Promise<SubagentResult>>();
    
    while (executed.size < context.agents.length) {
      // 检查超时
      if (Date.now() - startTime > timeoutMs) {
        await this.emitTeamFail(teamId, "Timeout", failedTasks);
        failTeam(context, "Timeout");
        throw new Error(`Team execution timeout after ${timeoutMs}ms`);
      }
      
      // 获取可执行任务（依赖已满足）
      const readyTasks = context.agents.filter(task =>
        task.status === "queued" &&
        !executed.has(task.id) &&
        !executing.has(task.id) &&
        this.areDependenciesSatisfied(task, executed)
      );
      
      // 启动可执行任务
      for (const task of readyTasks) {
        const promise = this.executeTask(task, context)
          .then(result => {
            executed.add(task.id);
            executing.delete(task.id);
            results.push(result);
            return result;
          })
          .catch(error => {
            executed.add(task.id);
            executing.delete(task.id);
            failedTasks.push(task.id);
            
            if (stopOnError) {
              throw error;
            }
            
            return null;
          });
        
        executing.set(task.id, promise);
      }
      
      // 等待至少一个完成
      if (executing.size > 0) {
        await Promise.race(executing.values());
      } else if (readyTasks.length === 0 && executed.size < context.agents.length) {
        // 死锁检测
        const remaining = context.agents.filter(t => !executed.has(t.id));
        if (remaining.length > 0) {
          const error = `Deadlock detected: ${remaining.length} tasks blocked`;
          await this.emitTeamFail(teamId, error, remaining.map(t => t.id));
          failTeam(context, error);
          throw new Error(error);
        }
      }
    }
    
    // 检查是否有失败
    if (failedTasks.length > 0 && stopOnError) {
      await this.emitTeamFail(teamId, `${failedTasks.length} tasks failed`, failedTasks);
      failTeam(context, `${failedTasks.length} tasks failed`);
      throw new Error(`Team execution failed: ${failedTasks.length} tasks`);
    }
    
    return results;
  }
  
  /**
   * 归并多个子代理结果
   */
  async mergeResults(results: SubagentResult[]): Promise<MergedResult> {
    // 合并且件
    const allArtifacts: ArtifactRef[] = [];
    const allPatches: PatchRef[] = [];
    const allFindings: Finding[] = [];
    const allBlockers: string[] = [];
    const allRecommendations: string[] = [];
    
    let totalConfidence = 0;
    let validResults = 0;
    
    for (const result of results) {
      if (result.artifacts) allArtifacts.push(...result.artifacts);
      if (result.patches) allPatches.push(...result.patches);
      if (result.findings) allFindings.push(...result.findings);
      if (result.blockers) allBlockers.push(...result.blockers);
      if (result.recommendations) allRecommendations.push(...result.recommendations);
      
      if (result.confidence !== undefined) {
        totalConfidence += result.confidence;
        validResults++;
      }
    }
    
    // 生成摘要
    const summary = this.generateSummary(results);
    
    // 计算平均置信度
    const confidence = validResults > 0 ? totalConfidence / validResults : 0;
    
    const mergedResult: MergedResult = {
      summary,
      artifacts: allArtifacts,
      patches: allPatches,
      findings: allFindings,
      confidence,
      blockers: allBlockers,
      recommendations: allRecommendations,
    };
    
    // 触发 TeamMerge Hook
    await this.hookBus.emit({
      type: "TeamMerge",
      teamId: results[0]?.teamId || "unknown",
      timestamp: Date.now(),
      resultsCount: results.length,
      mergedSummary: summary,
    } as TeamMergeEvent);
    
    return mergedResult;
  }
  
  /**
   * 取消团队执行
   */
  async cancelTeam(teamId: string, reason?: string): Promise<void> {
    const context = this.teams.get(teamId);
    if (!context) {
      throw new Error(`Team not found: ${teamId}`);
    }
    
    const cancelledTasks: string[] = [];
    
    // 取消所有活跃任务
    for (const task of context.agents) {
      if (task.status === "queued" || task.status === "running") {
        task.status = "cancelled";
        task.completedAt = Date.now();
        task.lastError = reason;
        cancelledTasks.push(task.id);
      }
    }
    
    // 更新团队状态
    cancelTeam(context, reason);
    
    // 触发 TeamCancel Hook
    await this.hookBus.emit({
      type: "TeamCancel",
      teamId,
      timestamp: Date.now(),
      reason: reason || "User cancelled",
      cancelledTasks,
    } as TeamCancelEvent);
  }
  
  /**
   * 获取团队状态
   */
  async getTeamStatus(teamId: string): Promise<TeamContext> {
    const context = this.teams.get(teamId);
    if (!context) {
      throw new Error(`Team not found: ${teamId}`);
    }
    return { ...context };
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 执行单个任务
   */
  private async executeTask(
    task: SubagentTask,
    context: TeamContext
  ): Promise<SubagentResult> {
    // 更新共享状态
    context.sharedState.currentTask = task.id;
    
    // 执行
    const result = await this.runner.run(task, context);
    
    // 更新预算使用
    context.usedBudget.turns += result.turnsUsed;
    if (result.tokensUsed) {
      context.usedBudget.tokens += result.tokensUsed;
    }
    context.usedBudget.elapsedMs += result.durationMs;
    
    // 将结果添加到共享状态（供后续任务使用）
    context.sharedState[`result_${task.agent}`] = result;
    
    return result;
  }
  
  /**
   * 检查依赖是否已满足
   */
  private areDependenciesSatisfied(
    task: SubagentTask,
    executed: Set<string>
  ): boolean {
    if (!task.dependsOn || task.dependsOn.length === 0) {
      return true;
    }
    
    return task.dependsOn.every(depId => executed.has(depId));
  }
  
  /**
   * 生成团队执行摘要
   */
  private generateSummary(results: SubagentResult[]): string {
    if (results.length === 0) {
      return "无执行结果";
    }
    
    const summaries = results.map(r => `- [${r.agent}]: ${r.summary}`);
    return `团队执行完成 (${results.length} 个子任务):\n${summaries.join("\n")}`;
  }
  
  /**
   * 生成唯一 ID
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
  
  /**
   * 触发 TeamFail Hook
   */
  private async emitTeamFail(
    teamId: string,
    reason: string,
    failedTasks: string[]
  ): Promise<void> {
    await this.hookBus.emit({
      type: "TeamFail",
      teamId,
      timestamp: Date.now(),
      reason,
      failedTasks,
    } as TeamFailEvent);
  }
  
  /**
   * 触发 TeamComplete Hook
   */
  private async emitTeamComplete(
    teamId: string,
    results: SubagentResult[],
    mergedResult: MergedResult
  ): Promise<void> {
    const context = this.teams.get(teamId);
    const duration = context ? getTeamDuration(context) || 0 : 0;
    
    await this.hookBus.emit({
      type: "TeamComplete",
      teamId,
      timestamp: Date.now(),
      results,
      mergedResult,
      durationMs: duration,
    } as TeamCompleteEvent);
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建 TeamOrchestrator 实例
 */
export function createTeamOrchestrator(
  runner?: ISubagentRunner,
  hookBus?: IHookBus
): ITeamOrchestrator {
  return new TeamOrchestrator(runner, hookBus);
}

// ============================================================================
// 便捷函数：端到端执行
// ============================================================================

/**
 * 创建并执行团队（便捷函数）
 */
export async function runTeam(
  params: CreateTeamParams,
  runner?: ISubagentRunner,
  hookBus?: IHookBus
): Promise<{
  context: TeamContext;
  results: SubagentResult[];
  merged: MergedResult;
}> {
  const orchestrator = createTeamOrchestrator(runner, hookBus);
  
  // 创建团队
  const context = await orchestrator.createTeam(params);
  
  // 等待完成
  const results = await orchestrator.waitForCompletion(context.teamId);
  
  // 归并结果
  const merged = await orchestrator.mergeResults(results);
  
  // 更新团队状态
  const finalContext = await orchestrator.getTeamStatus(context.teamId);
  completeTeam(finalContext);
  
  // 触发完成 Hook
  await hookBus?.emit({
    type: "TeamComplete",
    teamId: context.teamId,
    timestamp: Date.now(),
    results,
    mergedResult: merged,
    durationMs: getTeamDuration(finalContext) || 0,
  } as TeamCompleteEvent);
  
  return { context: finalContext, results, merged };
}
