/**
 * Agent Teams / Subagents - 子代理执行器
 * 
 * 最小可运行版本：支持 mock 执行 + 预算跟踪 + Hook 触发
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type {
  SubagentTask,
  SubagentResult,
  TeamContext,
  SubagentStatus,
  BudgetSpec,
} from "./types";
import {
  startTask,
  completeTask,
  failTask,
  timeoutTask,
  budgetExceededTask,
  getTaskDuration,
} from "./state_machine";

// ============================================================================
// Hook 事件类型定义
// ============================================================================

export type HookEventType =
  | "SubagentStart"
  | "SubagentStop"
  | "SubagentFail"
  | "SubagentTimeout"
  | "SubagentHandoff"
  | "SubagentBudgetExceeded";

export interface HookEvent {
  type: HookEventType;
  taskId: string;
  teamId: string;
  timestamp: number;
  [key: string]: unknown;
}

export interface SubagentStartEvent extends HookEvent {
  type: "SubagentStart";
  agent: string;
  goal: string;
  budget: BudgetSpec;
}

export interface SubagentStopEvent extends HookEvent {
  type: "SubagentStop";
  reason: "completed" | "cancelled" | "failed";
  result?: SubagentResult;
}

export interface SubagentFailEvent extends HookEvent {
  type: "SubagentFail";
  error: {
    type: string;
    message: string;
  };
  recoverable: boolean;
}

export interface SubagentTimeoutEvent extends HookEvent {
  type: "SubagentTimeout";
  timeoutMs: number;
  turnsCompleted: number;
}

export interface SubagentHandoffEvent extends HookEvent {
  type: "SubagentHandoff";
  fromTaskId: string;
  toTaskId: string;
  context: Record<string, unknown>;
}

export interface SubagentBudgetExceededEvent extends HookEvent {
  type: "SubagentBudgetExceeded";
  budgetType: "turns" | "tokens" | "timeout";
  limit: number;
  used: number;
}

// ============================================================================
// HookBus 接口（简化版）
// ============================================================================

export interface IHookBus {
  emit(event: HookEvent): Promise<void>;
}

/**
 * 空 HookBus（用于无 Hook 环境）
 */
export class NoOpHookBus implements IHookBus {
  async emit(_event: HookEvent): Promise<void> {
    // 空实现
  }
}

// ============================================================================
// 执行器接口
// ============================================================================

export interface ISubagentRunner {
  run(task: SubagentTask, context: TeamContext): Promise<SubagentResult>;
  stop(taskId: string, reason?: string): Promise<void>;
  getStatus(taskId: string): Promise<SubagentTask>;
}

// ============================================================================
// 执行器实现
// ============================================================================

export class SubagentRunner implements ISubagentRunner {
  private tasks: Map<string, SubagentTask> = new Map();
  private hookBus: IHookBus;
  
  constructor(hookBus?: IHookBus) {
    this.hookBus = hookBus || new NoOpHookBus();
  }
  
  /**
   * 运行子代理任务
   * 
   * @param task - 子任务定义
   * @param context - 团队上下文
   * @returns 执行结果
   */
  async run(task: SubagentTask, context: TeamContext): Promise<SubagentResult> {
    // 注册任务
    this.tasks.set(task.id, task);
    
    const startTime = Date.now();
    
    try {
      // 1. 触发 SubagentStart Hook
      await this.emitStart(task);
      
      // 2. 状态转换：queued → running
      const startResult = startTask(task);
      if (!startResult.success) {
        throw new Error(`Failed to start task: ${startResult.error}`);
      }
      
      // 3. 执行任务（mock 版本）
      const result = await this.executeRole(task, context);
      
      // 4. 检查预算
      const budgetCheck = this.checkBudget(task, result);
      if (!budgetCheck.ok) {
        throw new Error(budgetCheck.error);
      }
      
      // 5. 状态转换：running → done
      completeTask(task);
      
      // 6. 触发 SubagentStop Hook
      await this.emitStop(task, "completed", result);
      
      return result;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // 判断错误类型
      if (errorMessage.includes("timeout")) {
        // 超时
        const timeoutResult = timeoutTask(task, task.budget.timeoutMs, task.currentTurn);
        await this.emitTimeout(task, task.budget.timeoutMs, task.currentTurn);
        return this.createErrorResult(task, timeoutResult, errorMessage, false);
      } else if (errorMessage.includes("budget")) {
        // 预算超限
        const budgetResult = budgetExceededTask(task, "turns", task.budget.maxTurns, task.currentTurn);
        await this.emitBudgetExceeded(task, "turns", task.budget.maxTurns, task.currentTurn);
        return this.createErrorResult(task, budgetResult, errorMessage, false);
      } else {
        // 普通失败
        const failResult = failTask(task, errorMessage, true);
        await this.emitFail(task, errorMessage, true);
        return this.createErrorResult(task, failResult, errorMessage, true);
      }
    }
  }
  
  /**
   * 停止子代理
   */
  async stop(taskId: string, reason?: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    
    // 触发 Hook
    await this.hookBus.emit({
      type: "SubagentStop",
      taskId,
      teamId: task.teamId,
      timestamp: Date.now(),
      reason: "cancelled",
    });
    
    // 状态转换
    task.status = "cancelled";
    task.completedAt = Date.now();
    task.lastError = reason;
  }
  
  /**
   * 获取任务状态
   */
  async getStatus(taskId: string): Promise<SubagentTask> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    return { ...task };
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 执行角色任务（mock 版本）
   * 
   * 第一版先用简单 mock，后续替换为真实模型调用
   */
  private async executeRole(task: SubagentTask, context: TeamContext): Promise<SubagentResult> {
    const startTime = Date.now();
    
    // Mock 执行：根据角色返回不同结果
    const mockResults: Record<string, Partial<SubagentResult>> = {
      planner: {
        summary: `规划完成：任务 "${task.goal}" 已分解`,
        confidence: 0.9,
        artifacts: [
          {
            type: "text",
            content: "任务分解计划",
            description: "规划输出",
          },
        ],
        nextSteps: ["执行代码修复", "验证结果"],
      },
      repo_reader: {
        summary: `代码库读取完成：已分析项目结构`,
        confidence: 0.85,
        artifacts: [
          {
            type: "text",
            content: "项目结构报告",
            description: "Repo Map",
          },
        ],
      },
      code_fixer: {
        summary: `代码修复完成：已应用补丁`,
        confidence: 0.8,
        patches: [],
        recommendations: ["运行测试验证"],
      },
      code_reviewer: {
        summary: `代码审查完成：发现 3 个问题`,
        confidence: 0.85,
        findings: [
          {
            type: "suggestion",
            severity: "low",
            description: "建议添加类型注解",
          },
        ],
      },
      verify_agent: {
        summary: `验证完成：所有测试通过`,
        confidence: 0.95,
        blockers: [],
      },
      release_agent: {
        summary: `发布完成：版本已部署`,
        confidence: 0.9,
        artifacts: [
          {
            type: "text",
            content: "发布说明",
            description: "Release Notes",
          },
        ],
      },
    };
    
    const mockResult = mockResults[task.agent] || {
      summary: `任务完成：${task.goal}`,
      confidence: 0.7,
    };
    
    // 模拟执行耗时
    await this.sleep(100);
    
    const duration = Date.now() - startTime;
    
    return {
      subagentTaskId: task.id,
      parentTaskId: task.parentTaskId,
      teamId: task.teamId,
      agent: task.agent,
      summary: mockResult.summary || `任务完成：${task.goal}`,
      confidence: mockResult.confidence,
      artifacts: mockResult.artifacts,
      patches: mockResult.patches,
      findings: mockResult.findings,
      turnsUsed: 1,
      tokensUsed: 1000,
      durationMs: duration,
      blockers: mockResult.blockers,
      recommendations: mockResult.recommendations,
      nextSteps: mockResult.nextSteps,
    };
  }
  
  /**
   * 检查预算
   */
  private checkBudget(task: SubagentTask, result: SubagentResult): { ok: boolean; error?: string } {
    // 检查轮次
    if (result.turnsUsed > task.budget.maxTurns) {
      return {
        ok: false,
        error: `Budget exceeded: turns (${result.turnsUsed}/${task.budget.maxTurns})`,
      };
    }
    
    // 检查 token
    if (task.budget.maxTokens && result.tokensUsed && result.tokensUsed > task.budget.maxTokens) {
      return {
        ok: false,
        error: `Budget exceeded: tokens (${result.tokensUsed}/${task.budget.maxTokens})`,
      };
    }
    
    // 检查超时
    if (result.durationMs > task.budget.timeoutMs) {
      return {
        ok: false,
        error: `Budget exceeded: timeout (${result.durationMs}ms/${task.budget.timeoutMs}ms)`,
      };
    }
    
    return { ok: true };
  }
  
  /**
   * 创建错误结果
   */
  private createErrorResult(
    task: SubagentTask,
    transitionResult: { success: boolean; error?: string },
    errorMessage: string,
    recoverable: boolean
  ): SubagentResult {
    const duration = getTaskDuration(task) || 0;
    
    return {
      subagentTaskId: task.id,
      parentTaskId: task.parentTaskId,
      teamId: task.teamId,
      agent: task.agent,
      summary: `任务失败：${errorMessage}`,
      confidence: 0,
      turnsUsed: task.currentTurn,
      tokensUsed: task.tokensUsed || 0,
      durationMs: duration,
      error: {
        type: transitionResult.error || "UnknownError",
        message: errorMessage,
        recoverable,
      },
    };
  }
  
  // ============================================================================
  // Hook 发射器
  // ============================================================================
  
  private async emitStart(task: SubagentTask): Promise<void> {
    const event: SubagentStartEvent = {
      type: "SubagentStart",
      taskId: task.id,
      teamId: task.teamId,
      timestamp: Date.now(),
      agent: task.agent,
      goal: task.goal,
      budget: task.budget,
    };
    await this.hookBus.emit(event);
  }
  
  private async emitStop(
    task: SubagentTask,
    reason: "completed" | "cancelled" | "failed",
    result?: SubagentResult
  ): Promise<void> {
    const event: SubagentStopEvent = {
      type: "SubagentStop",
      taskId: task.id,
      teamId: task.teamId,
      timestamp: Date.now(),
      reason,
      result,
    };
    await this.hookBus.emit(event);
  }
  
  private async emitFail(
    task: SubagentTask,
    message: string,
    recoverable: boolean
  ): Promise<void> {
    const event: SubagentFailEvent = {
      type: "SubagentFail",
      taskId: task.id,
      teamId: task.teamId,
      timestamp: Date.now(),
      error: {
        type: "ExecutionError",
        message,
      },
      recoverable,
    };
    await this.hookBus.emit(event);
  }
  
  private async emitTimeout(
    task: SubagentTask,
    timeoutMs: number,
    turnsCompleted: number
  ): Promise<void> {
    const event: SubagentTimeoutEvent = {
      type: "SubagentTimeout",
      taskId: task.id,
      teamId: task.teamId,
      timestamp: Date.now(),
      timeoutMs,
      turnsCompleted,
    };
    await this.hookBus.emit(event);
  }
  
  private async emitBudgetExceeded(
    task: SubagentTask,
    budgetType: "turns" | "tokens" | "timeout",
    limit: number,
    used: number
  ): Promise<void> {
    const event: SubagentBudgetExceededEvent = {
      type: "SubagentBudgetExceeded",
      taskId: task.id,
      teamId: task.teamId,
      timestamp: Date.now(),
      budgetType,
      limit,
      used,
    };
    await this.hookBus.emit(event);
  }
  
  /**
   * 工具方法：休眠
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建 SubagentRunner 实例
 */
export function createSubagentRunner(hookBus?: IHookBus): ISubagentRunner {
  return new SubagentRunner(hookBus);
}
