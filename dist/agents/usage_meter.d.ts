/**
 * Usage Meter - 使用计量器
 *
 * 职责：
 * 1. 记录 input/output/total tokens
 * 2. 记录 latency
 * 3. 记录 retry/timeout count
 * 4. per-role usage 统计
 * 5. 预算消耗跟踪
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
/**
 * 单次调用记录
 */
export interface InvocationRecord {
    timestamp: number;
    subagentTaskId: string;
    teamId: string;
    role: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    latencyMs: number;
    success: boolean;
    finishReason?: string;
    retryCount: number;
    isRetry: boolean;
}
/**
 * 角色使用统计
 */
export interface RoleUsageStats {
    role: string;
    totalInvocations: number;
    successfulInvocations: number;
    failedInvocations: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    avgTokensPerInvocation: number;
    totalLatencyMs: number;
    avgLatencyMs: number;
    minLatencyMs: number;
    maxLatencyMs: number;
    totalRetries: number;
    retryRate: number;
    budgetUsed: number;
    budgetRemaining?: number;
}
/**
 * 团队使用统计
 */
export interface TeamUsageStats {
    teamId: string;
    totalInvocations: number;
    totalTokens: number;
    totalCost?: number;
    byRole: Record<string, RoleUsageStats>;
    startTime: number;
    endTime?: number;
}
/**
 * 预算跟踪
 */
export interface BudgetTracker {
    maxTokens: number;
    usedTokens: number;
    remainingTokens: number;
    percentageUsed: number;
    isExceeded: boolean;
}
export interface IUsageMeter {
    /**
     * 记录调用
     */
    recordInvocation(record: InvocationRecord): void;
    /**
     * 获取团队统计
     */
    getTeamStats(teamId: string): TeamUsageStats | null;
    /**
     * 获取角色统计
     */
    getRoleStats(teamId: string, role: string): RoleUsageStats | null;
    /**
     * 检查预算
     */
    checkBudget(teamId: string, maxTokens: number): BudgetTracker;
    /**
     * 重置统计
     */
    reset(teamId: string): void;
}
export declare class UsageMeter implements IUsageMeter {
    private invocations;
    private roleStats;
    /**
     * 记录调用
     */
    recordInvocation(record: InvocationRecord): void;
    /**
     * 获取团队统计
     */
    getTeamStats(teamId: string): TeamUsageStats | null;
    /**
     * 获取角色统计
     */
    getRoleStats(teamId: string, role: string): RoleUsageStats | null;
    /**
     * 检查预算
     */
    checkBudget(teamId: string, maxTokens: number): BudgetTracker;
    /**
     * 重置统计
     */
    reset(teamId: string): void;
    /**
     * 更新角色统计
     */
    private updateRoleStats;
    /**
     * 创建初始角色统计
     */
    private createInitialRoleStats;
}
/**
 * Token 估算器（简化版）
 *
 * 注意：这是近似估算，实际 token 数取决于具体模型的 tokenizer
 */
export declare class TokenEstimator {
    /**
     * 估算文本的 token 数
     *
     * 简化规则：
     * - 英文：每 4 个字符约 1 个 token
     * - 中文：每 1.5 个字符约 1 个 token
     */
    estimateTokens(text: string): number;
    /**
     * 估算消息的 token 数
     */
    estimateMessageTokens(messages: Array<{
        role: string;
        content: string;
    }>): number;
}
/**
 * 创建使用计量器
 */
export declare function createUsageMeter(): IUsageMeter;
/**
 * 创建 Token 估算器
 */
export declare function createTokenEstimator(): TokenEstimator;
/**
 * 快速估算 token
 */
export declare function estimateTokens(text: string): number;
