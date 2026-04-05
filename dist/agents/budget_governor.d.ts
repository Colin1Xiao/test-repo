/**
 * Budget Governor - 预算管理器
 *
 * 职责：
 * 1. 治理并发数预算
 * 2. 治理 per-team token 预算
 * 3. 治理 per-role token 预算
 * 4. 治理 time budget
 * 5. 治理 retry budget
 * 6. admission gate（预算不足阻止执行）
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
/**
 * 预算类型
 */
export type BudgetType = 'concurrency' | 'team_tokens' | 'role_tokens' | 'time' | 'retry';
/**
 * 预算配置
 */
export interface BudgetConfig {
    maxGlobalConcurrency?: number;
    maxTeamConcurrency?: number;
    teamTokenBudget?: Record<string, number>;
    roleTokenBudget?: Record<string, number>;
    teamTimeBudgetMs?: Record<string, number>;
    maxRetriesPerTask?: number;
    maxRetriesPerTeam?: number;
}
/**
 * 预算使用情况
 */
export interface BudgetUsage {
    used: number;
    total: number;
    remaining: number;
    percentageUsed: number;
    isExceeded: boolean;
}
/**
 * 准入检查输入
 */
export interface AdmissionCheckInput {
    teamId: string;
    role: string;
    estimatedTokens?: number;
    estimatedTimeMs?: number;
}
/**
 * 准入检查结果
 */
export interface AdmissionCheckResult {
    admitted: boolean;
    reason?: string;
    budgetType?: BudgetType;
    suggestedAction?: 'wait' | 'reduce_scope' | 'fail_fast';
}
/**
 * 预算统计
 */
export interface BudgetStats {
    teamBudgets: Record<string, BudgetUsage>;
    roleBudgets: Record<string, BudgetUsage>;
    retryCounts: Record<string, number>;
    exceededCount: number;
    admissionRejections: number;
}
export declare class BudgetGovernor {
    private config;
    private teamTokenUsage;
    private roleTokenUsage;
    private teamTimeUsage;
    private retryCounts;
    private teamRetryCounts;
    private stats;
    constructor(config?: BudgetConfig);
    /**
     * 检查准入
     */
    checkAdmission(input: AdmissionCheckInput): AdmissionCheckResult;
    /**
     * 记录 Token 使用
     */
    recordTokenUsage(teamId: string, role: string, tokens: number): void;
    /**
     * 记录时间使用
     */
    recordTimeUsage(teamId: string, timeMs: number): void;
    /**
     * 记录重试
     */
    recordRetry(taskId: string, teamId: string): boolean;
    /**
     * 获取团队 Token 预算使用
     */
    getTeamTokenUsage(teamId: string): BudgetUsage;
    /**
     * 获取角色 Token 预算使用
     */
    getRoleTokenUsage(role: string): BudgetUsage;
    /**
     * 获取团队时间预算使用
     */
    getTeamTimeUsage(teamId: string): BudgetUsage;
    /**
     * 获取重试使用
     */
    getRetryUsage(taskId: string, teamId: string): {
        taskRetries: number;
        teamRetries: number;
    };
    /**
     * 获取统计
     */
    getStats(): BudgetStats;
    /**
     * 重置团队预算
     */
    resetTeamBudget(teamId: string): void;
    /**
     * 重置所有统计
     */
    resetStats(): void;
    /**
     * 检查团队 Token 预算
     */
    private checkTeamTokenBudget;
    /**
     * 检查角色 Token 预算
     */
    private checkRoleTokenBudget;
    /**
     * 检查团队时间预算
     */
    private checkTeamTimeBudget;
    /**
     * 检查重试预算
     */
    private checkRetryBudget;
    /**
     * 检查团队 Token 超限
     */
    private checkTeamTokenExceeded;
    /**
     * 检查角色 Token 超限
     */
    private checkRoleTokenExceeded;
    /**
     * 检查团队时间超限
     */
    private checkTeamTimeExceeded;
    /**
     * 创建预算使用对象
     */
    private createBudgetUsage;
}
/**
 * 创建预算管理器
 */
export declare function createBudgetGovernor(config?: BudgetConfig): BudgetGovernor;
/**
 * 默认预算配置
 */
export declare const DEFAULT_BUDGET_CONFIG: BudgetConfig;
/**
 * 保守预算配置（适合生产）
 */
export declare const CONSERVATIVE_BUDGET_CONFIG: BudgetConfig;
