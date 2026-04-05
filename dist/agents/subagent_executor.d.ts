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
import type { SubagentTask, TeamContext, SubagentResult } from './types';
import type { IModelInvoker, ModelInvokeResponse } from './model_invoker';
import type { IUsageMeter } from './usage_meter';
import type { IHookBus } from './subagent_runner';
import { RetryPolicy } from './retry_policy';
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
        artifacts?: Array<{
            type: string;
            description: string;
            content?: string;
        }>;
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
export declare class SubagentExecutor {
    private modelInvoker;
    private usageMeter;
    private promptBuilder;
    private resultNormalizer;
    private hookBus?;
    private retryPolicy;
    private defaultTimeoutMs;
    constructor(config: ExecutorConfig);
    /**
     * 执行子代理任务
     */
    execute(input: ExecuteInput): Promise<ExecuteResult>;
    /**
     * 构建提示词
     */
    private buildPrompt;
    /**
     * 带保护的模型调用（重试 + 超时）
     */
    private invokeWithProtection;
    /**
     * 记录使用情况
     */
    private recordUsage;
    /**
     * 触发完成 Hook
     */
    private emitCompleteHook;
    /**
     * 触发失败 Hook
     */
    private emitFailHook;
    /**
     * 判断错误是否可恢复
     */
    private isRecoverableError;
}
/**
 * 创建子代理执行器
 */
export declare function createSubagentExecutor(config: ExecutorConfig): SubagentExecutor;
/**
 * 快速执行子代理任务
 */
export declare function executeSubagent(task: SubagentTask, teamContext: TeamContext, config: ExecutorConfig): Promise<ExecuteResult>;
