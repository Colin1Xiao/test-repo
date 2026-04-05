/**
 * Subagent Executor - 子代理执行器
 * 
 * 职责：
 * 将 TeamContext + SubagentTask + Role Prompt + ModelInvoker + ResultNormalizer
 * 接成一条真实执行通路
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type { SubagentTask, TeamContext, SubagentResult, SubagentRole } from './types';
import type { IModelInvoker, ModelInvokeRequest, ModelInvokeResponse } from './model_invoker';
import type { IUsageMeter, InvocationRecord } from './usage_meter';
import type { IHookBus } from './subagent_runner';
import { RolePromptBuilder, buildRolePrompt } from './role_prompt_builder';
import { ResultNormalizer, normalizeResult } from './result_normalizer';
import { RetryPolicy, executeWithRetry } from './retry_policy';
import { TimeoutGuard } from './timeout_guard';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 执行器配置
 */
export interface ExecutorConfig {
  modelInvoker: IModelInvoker;
  usageMeter: IUsageMeter;
  hookBus?: IHookBus;
  retryPolicy?: RetryPolicy;
  defaultTimeoutMs?: number;
}

/**
 * 执行输入
 */
export interface ExecuteInput {
  task: SubagentTask;
  teamContext: TeamContext;
  parentContext?: {
    summary?: string;
    artifacts?: Array<{ type: string; description: string; content?: string }>;
  };
  dependencyResults?: SubagentResult[];
}

/**
 * 执行结果
 */
export interface ExecuteResult {
  success: boolean;
  result?: SubagentResult;
  modelResponse?: ModelInvokeResponse;
  error?: {
    type: string;
    message: string;
    recoverable: boolean;
  };
}

// ============================================================================
// 子代理执行器
// ============================================================================

export class SubagentExecutor {
  private modelInvoker: IModelInvoker;
  private usageMeter: IUsageMeter;
  private promptBuilder: RolePromptBuilder;
  private resultNormalizer: ResultNormalizer;
  private hookBus?: IHookBus;
  private retryPolicy: RetryPolicy;
  private defaultTimeoutMs: number;
  
  constructor(config: ExecutorConfig) {
    this.modelInvoker = config.modelInvoker;
    this.usageMeter = config.usageMeter;
    this.promptBuilder = new RolePromptBuilder();
    this.resultNormalizer = new ResultNormalizer();
    this.hookBus = config.hookBus;
    this.retryPolicy = config.retryPolicy || new RetryPolicy({ maxRetries: 2 });
    this.defaultTimeoutMs = config.defaultTimeoutMs || 120000;
  }
  
  /**
   * 执行子代理任务
   */
  async execute(input: ExecuteInput): Promise<ExecuteResult> {
    const startTime = Date.now();
    let retryCount = 0;
    
    try {
      // Step 1: 构建提示词
      const { systemPrompt, userPrompt } = this.buildPrompt(input);
      
      // Step 2: 准备模型调用请求
      const request: ModelInvokeRequest = {
        role: input.task.agent,
        subagentTaskId: input.task.id,
        teamId: input.task.teamId,
        systemPrompt,
        userPrompt,
        tools: input.task.allowedTools,
        budget: {
          maxTokens: input.task.budget.maxTokens,
          timeoutMs: input.task.budget.timeoutMs || this.defaultTimeoutMs,
          maxTurns: input.task.budget.maxTurns,
        },
        metadata: {
          parentTaskId: input.task.parentTaskId,
          sessionId: input.task.sessionId,
        },
      };
      
      // Step 3: 执行模型调用（带重试和超时）
      const response = await this.invokeWithProtection(request, input.task);
      
      // Step 4: 标准化结果
      const latencyMs = Date.now() - startTime;
      
      const result = this.resultNormalizer.normalize({
        subagentTaskId: input.task.id,
        parentTaskId: input.task.parentTaskId,
        teamId: input.task.teamId,
        role: input.task.agent,
        rawContent: response.content,
        usage: response.usage,
        latencyMs,
        turnsUsed: 1,
        finishReason: response.finishReason,
        error: response.error,
      });
      
      // Step 5: 记录使用情况
      this.recordUsage(input.task, result, latencyMs, retryCount);
      
      // Step 6: 触发 Hook
      await this.emitCompleteHook(input.task, result);
      
      return {
        success: !response.error,
        result,
        modelResponse: response,
      };
      
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      
      // 记录失败
      this.recordUsage(input.task, null, latencyMs, retryCount, error);
      
      // 触发失败 Hook
      await this.emitFailHook(input.task, error);
      
      return {
        success: false,
        error: {
          type: error instanceof Error ? error.name : 'ExecutionError',
          message: error instanceof Error ? error.message : String(error),
          recoverable: this.isRecoverableError(error),
        },
      };
    }
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 构建提示词
   */
  private buildPrompt(input: ExecuteInput): { systemPrompt: string; userPrompt: string } {
    return buildRolePrompt({
      role: input.task.agent,
      goal: input.task.goal,
      inputs: input.task.inputs,
      allowedTools: input.task.allowedTools,
      forbiddenTools: input.task.forbiddenTools || [],
      budget: input.task.budget,
      parentContext: input.parentContext,
      dependencyResults: input.dependencyResults?.map(r => ({
        role: r.agent,
        summary: r.summary,
        artifacts: r.artifacts,
      })),
      outputFormat: 'markdown',
    });
  }
  
  /**
   * 带保护的模型调用（重试 + 超时）
   */
  private async invokeWithProtection(
    request: ModelInvokeRequest,
    task: SubagentTask
  ): Promise<ModelInvokeResponse> {
    const timeoutMs = request.budget.timeoutMs || this.defaultTimeoutMs;
    
    // 创建超时守卫
    const timeoutGuard = new TimeoutGuard(timeoutMs);
    
    // 执行带重试的调用
    return await executeWithRetry(
      async () => {
        // 检查超时
        if (timeoutGuard.isTimedOut()) {
          throw new Error(`Timeout after ${timeoutMs}ms`);
        }
        
        // 调用模型
        return await this.modelInvoker.invoke(request);
      },
      this.retryPolicy,
      { timeoutMs }
    );
  }
  
  /**
   * 记录使用情况
   */
  private recordUsage(
    task: SubagentTask,
    result: SubagentResult | null,
    latencyMs: number,
    retryCount: number,
    error?: any
  ): void {
    const record: InvocationRecord = {
      timestamp: Date.now(),
      subagentTaskId: task.id,
      teamId: task.teamId,
      role: task.agent,
      
      inputTokens: result?.tokensUsed || 0,
      outputTokens: result?.tokensUsed || 0,
      totalTokens: result?.tokensUsed || 0,
      
      latencyMs,
      
      success: !!result && !error,
      finishReason: error ? 'error' : 'stop',
      
      retryCount,
      isRetry: retryCount > 0,
    };
    
    this.usageMeter.recordInvocation(record);
  }
  
  /**
   * 触发完成 Hook
   */
  private async emitCompleteHook(task: SubagentTask, result: SubagentResult): Promise<void> {
    if (!this.hookBus) return;
    
    await this.hookBus.emit({
      type: 'SubagentStop',
      taskId: task.id,
      teamId: task.teamId,
      timestamp: Date.now(),
      reason: 'completed',
      result,
    });
  }
  
  /**
   * 触发失败 Hook
   */
  private async emitFailHook(task: SubagentTask, error: any): Promise<void> {
    if (!this.hookBus) return;
    
    await this.hookBus.emit({
      type: 'SubagentFail',
      taskId: task.id,
      teamId: task.teamId,
      timestamp: Date.now(),
      error: {
        type: error instanceof Error ? error.name : 'UnknownError',
        message: error instanceof Error ? error.message : String(error),
      },
      recoverable: this.isRecoverableError(error),
    });
  }
  
  /**
   * 判断错误是否可恢复
   */
  private isRecoverableError(error: any): boolean {
    if (!error) return false;
    
    const message = (error.message || '').toLowerCase();
    
    // 可恢复的错误
    const recoverablePatterns = [
      'timeout',
      'rate limit',
      'connection',
      'network',
      'transient',
    ];
    
    return recoverablePatterns.some(pattern => message.includes(pattern));
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建子代理执行器
 */
export function createSubagentExecutor(config: ExecutorConfig): SubagentExecutor {
  return new SubagentExecutor(config);
}

/**
 * 快速执行子代理任务
 */
export async function executeSubagent(
  task: SubagentTask,
  teamContext: TeamContext,
  config: ExecutorConfig
): Promise<ExecuteResult> {
  const executor = new SubagentExecutor(config);
  return await executor.execute({ task, teamContext });
}
