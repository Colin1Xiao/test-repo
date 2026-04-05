/**
 * ExecutionContext Adapter - 执行上下文适配层
 *
 * 将 OpenClaw 主 ExecutionContext 适配为 Agent Teams 可用格式
 *
 * 核心职责：
 * 1. ExecutionContext → TeamContext 转换
 * 2. ExecutionContext + SubagentRole → SubagentContext 派生
 * 3. SubagentResult → 主任务可归档结果
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { ExecutionContext } from '../../core/runtime/execution_context';
import type { TeamContext, SubagentTask, SubagentResult, BudgetSpec, SubagentRole, MergedResult } from './types';
/**
 * 子代理执行上下文
 *
 * 从父上下文派生，但权限/资源受限
 */
export interface SubagentExecutionContext {
    parentSessionId: string;
    parentTaskId: string;
    subagentTaskId: string;
    teamId: string;
    role: SubagentRole;
    sessionId: string;
    cwd: string;
    workspaceRoot: string;
    allowedTools: string[];
    forbiddenTools: string[];
    maxTurns: number;
    timeoutMs: number;
    abortSignal?: AbortSignal;
    logger: {
        info: (msg: string, meta?: any) => void;
        warn: (msg: string, meta?: any) => void;
        error: (msg: string, meta?: any) => void;
        debug: (msg: string, meta?: any) => void;
    };
}
/**
 * 上下文派生配置
 */
export interface DeriveContextConfig {
    parentContext: ExecutionContext;
    task: SubagentTask;
    teamContext: TeamContext;
    role: SubagentRole;
}
/**
 * 上下文转换结果
 */
export interface ContextConversionResult {
    teamContext: TeamContext;
    subagentContexts: SubagentExecutionContext[];
}
export declare class ExecutionContextAdapter {
    /**
     * 将主 ExecutionContext 转换为 TeamContext
     */
    convertToTeamContext(parentContext: ExecutionContext, teamId: string, parentTaskId: string, totalBudget: BudgetSpec): TeamContext;
    /**
     * 从父上下文派生子代理上下文
     *
     * 关键：权限只能收缩，不能放大
     */
    deriveSubagentContext(config: DeriveContextConfig): SubagentExecutionContext;
    /**
     * 将 SubagentResult 转换为可归档结果
     */
    normalizeSubagentResult(result: SubagentResult, parentTaskId: string): {
        summary: string;
        artifacts: Array<{
            type: string;
            path?: string;
            description: string;
        }>;
        patches?: Array<{
            file: string;
            diff: string;
        }>;
        findings?: Array<{
            type: string;
            severity: string;
            description: string;
        }>;
    };
    /**
     * 归并结果转换为主任务格式
     */
    convertMergedResultToTaskOutput(merged: MergedResult): string;
    /**
     * 裁剪工具访问权限
     *
     * 原则：子代理权限只能 ≤ 父上下文权限
     */
    private restrictToolAccess;
    /**
     * 派生日志器（带前缀）
     */
    private deriveLogger;
}
/**
 * 创建适配器实例
 */
export declare function createExecutionContextAdapter(): ExecutionContextAdapter;
/**
 * 快速派生子代理上下文
 */
export declare function deriveSubagentContext(parentContext: ExecutionContext, task: SubagentTask, teamContext: TeamContext): SubagentExecutionContext;
