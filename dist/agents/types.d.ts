/**
 * Agent Teams / Subagents - 核心类型定义
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
/**
 * 子代理任务状态
 */
export type SubagentStatus = "queued" | "running" | "done" | "failed" | "cancelled" | "timeout" | "budget_exceeded";
/**
 * 团队状态
 */
export type TeamStatus = "active" | "completed" | "failed" | "cancelled";
/**
 * 预定义代理角色
 */
export type SubagentRole = "planner" | "repo_reader" | "code_fixer" | "code_reviewer" | "verify_agent" | "release_agent";
/**
 * 预算配置
 */
export interface BudgetSpec {
    maxTurns: number;
    maxTokens?: number;
    timeoutMs: number;
    retryPolicy?: {
        maxRetries: number;
        backoffMs: number;
    };
}
/**
 * 预算使用情况
 */
export interface BudgetUsage {
    turns: number;
    tokens?: number;
    elapsedMs: number;
}
/**
 * 子代理任务
 */
export interface SubagentTask {
    id: string;
    parentTaskId: string;
    sessionId: string;
    teamId: string;
    agent: SubagentRole;
    goal: string;
    inputs: Record<string, unknown>;
    allowedTools: string[];
    forbiddenTools?: string[];
    worktree?: string;
    budget: BudgetSpec;
    status: SubagentStatus;
    createdAt: number;
    startedAt?: number;
    completedAt?: number;
    currentTurn: number;
    tokensUsed?: number;
    lastError?: string;
    dependsOn?: string[];
}
/**
 * 子代理结果
 */
export interface SubagentResult {
    subagentTaskId: string;
    parentTaskId: string;
    teamId: string;
    agent: SubagentRole;
    summary: string;
    confidence?: number;
    artifacts?: ArtifactRef[];
    patches?: PatchRef[];
    findings?: Finding[];
    turnsUsed: number;
    tokensUsed?: number;
    durationMs: number;
    error?: {
        type: string;
        message: string;
        recoverable: boolean;
    };
    blockers?: string[];
    recommendations?: string[];
    nextSteps?: string[];
}
/**
 * 产出物引用
 */
export interface ArtifactRef {
    type: "file" | "directory" | "url" | "text";
    path?: string;
    url?: string;
    content?: string;
    description: string;
}
/**
 * 代码补丁引用
 */
export interface PatchRef {
    fileId: string;
    diff: string;
    hunks: number;
    linesAdded: number;
    linesDeleted: number;
}
/**
 * 发现的问题
 */
export interface Finding {
    type: "issue" | "suggestion" | "risk" | "blocker";
    severity: "low" | "medium" | "high" | "critical";
    location?: {
        file: string;
        line?: number;
        column?: number;
    };
    description: string;
    suggestion?: string;
}
/**
 * 团队上下文
 */
export interface TeamContext {
    teamId: string;
    parentTaskId: string;
    sessionId: string;
    agents: SubagentTask[];
    sharedState: Record<string, unknown>;
    worktree?: string;
    allowedTools: string[];
    totalBudget: BudgetSpec;
    usedBudget: BudgetUsage;
    status: TeamStatus;
    createdAt: number;
    completedAt?: number;
    results?: SubagentResult[];
}
/**
 * 团队执行记录
 */
export interface TeamRun {
    teamId: string;
    parentTaskId: string;
    sessionId: string;
    status: TeamStatus;
    createdAt: number;
    completedAt?: number;
    agents: SubagentRole[];
    totalBudget: BudgetSpec;
    results: SubagentResult[];
    summary?: string;
}
/**
 * 上下文移交记录
 */
export interface HandoffRecord {
    fromTaskId: string;
    toTaskId: string;
    teamId: string;
    timestamp: number;
    context: Record<string, unknown>;
}
/**
 * 团队编排器接口
 */
export interface ITeamOrchestrator {
    createTeam(params: CreateTeamParams): Promise<TeamContext>;
    delegateTask(params: DelegateTaskParams): Promise<SubagentTask>;
    waitForCompletion(teamId: string, options?: WaitForOptions): Promise<SubagentResult[]>;
    mergeResults(results: SubagentResult[]): Promise<MergedResult>;
    cancelTeam(teamId: string, reason?: string): Promise<void>;
    getTeamStatus(teamId: string): Promise<TeamContext>;
}
/**
 * 子代理执行器接口
 */
export interface ISubagentRunner {
    run(task: SubagentTask, context: TeamContext): Promise<SubagentResult>;
    stop(taskId: string, reason?: string): Promise<void>;
    getStatus(taskId: string): Promise<SubagentTask>;
}
/**
 * 任务拆分策略接口
 */
export interface IDelegationPolicy {
    canDelegate(task: TaskDefinition): Promise<DelegationDecision>;
    recommendAgents(task: TaskDefinition): Promise<AgentRoleConfig[]>;
    calculateBudget(parentBudget: BudgetSpec, agents: AgentRoleConfig[]): Promise<BudgetAllocation>;
    validateToolPermissions(agent: SubagentRole, tools: string[]): Promise<PermissionValidation>;
}
export interface CreateTeamParams {
    parentTaskId: string;
    sessionId: string;
    goal: string;
    agents: AgentRoleConfig[];
    totalBudget: BudgetSpec;
    worktree?: string;
}
export interface AgentRoleConfig {
    role: SubagentRole;
    goal: string;
    inputs?: Record<string, unknown>;
    allowedTools: string[];
    budget: BudgetSpec;
    dependsOn?: string[];
}
export interface DelegateTaskParams {
    teamId: string;
    agent: SubagentRole;
    goal: string;
    inputs?: Record<string, unknown>;
    allowedTools: string[];
    budget: BudgetSpec;
    dependsOn?: string[];
}
export interface TaskDefinition {
    id: string;
    goal: string;
    complexity?: "low" | "medium" | "high";
    riskLevel?: "low" | "medium" | "high";
    requiresCodeAccess?: boolean;
    requiresExternalAction?: boolean;
}
export interface WaitForOptions {
    timeoutMs?: number;
    pollIntervalMs?: number;
    stopOnError?: boolean;
}
export interface DelegationDecision {
    allowed: boolean;
    reason?: string;
    riskLevel: "low" | "medium" | "high";
    constraints?: string[];
}
export interface BudgetAllocation {
    perAgent: Record<string, BudgetSpec>;
    reserved: BudgetSpec;
}
export interface PermissionValidation {
    allowed: string[];
    denied: string[];
    reason?: string;
}
export interface MergedResult {
    summary: string;
    artifacts: ArtifactRef[];
    patches: PatchRef[];
    findings: Finding[];
    confidence: number;
    blockers: string[];
    recommendations: string[];
}
/**
 * 代理角色默认配置
 */
export interface AgentRoleDefaults {
    role: SubagentRole;
    description: string;
    allowedTools: string[];
    forbiddenTools: string[];
    defaultBudget: BudgetSpec;
}
/**
 * 预定义角色默认配置
 */
export declare const AGENT_ROLE_DEFAULTS: Record<SubagentRole, AgentRoleDefaults>;
