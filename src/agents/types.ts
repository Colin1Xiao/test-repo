/**
 * Agent Teams / Subagents - 核心类型定义
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

// ============================================================================
// 状态枚举
// ============================================================================

/**
 * 子代理任务状态
 */
export type SubagentStatus =
  | "queued"      // 已创建，等待执行
  | "running"     // 执行中
  | "done"        // 成功完成
  | "failed"      // 执行失败
  | "cancelled"   // 被取消
  | "timeout"     // 超时
  | "budget_exceeded";  // 预算超限

/**
 * 团队状态
 */
export type TeamStatus =
  | "active"      // 执行中
  | "completed"   // 成功完成
  | "failed"      // 执行失败
  | "cancelled";  // 被取消

/**
 * 预定义代理角色
 */
export type SubagentRole =
  | "planner"       // 任务规划
  | "repo_reader"   // 代码读取
  | "code_fixer"    // 代码修复
  | "code_reviewer" // 代码审查
  | "verify_agent"  // 验证代理
  | "release_agent"; // 发布代理

// ============================================================================
// 预算与资源
// ============================================================================

/**
 * 预算配置
 */
export interface BudgetSpec {
  maxTurns: number;       // 最大对话轮次
  maxTokens?: number;     // 最大 token 消耗
  timeoutMs: number;      // 超时时间 (毫秒)
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

// ============================================================================
// 核心数据结构
// ============================================================================

/**
 * 子代理任务
 */
export interface SubagentTask {
  // 身份
  id: string;                    // 子任务 ID (UUID)
  parentTaskId: string;          // 父任务 ID
  sessionId: string;             // 所属会话 ID
  teamId: string;                // 团队 ID
  
  // 任务定义
  agent: SubagentRole;           // 代理角色
  goal: string;                  // 任务目标
  inputs: Record<string, unknown>;  // 输入参数
  
  // 约束
  allowedTools: string[];        // 工具白名单
  forbiddenTools?: string[];     // 工具黑名单
  worktree?: string;             // 工作树隔离 ID
  
  // 预算
  budget: BudgetSpec;
  
  // 状态
  status: SubagentStatus;
  createdAt: number;             // 创建时间戳 (ms)
  startedAt?: number;            // 开始时间戳 (ms)
  completedAt?: number;          // 完成时间戳 (ms)
  
  // 执行跟踪
  currentTurn: number;           // 当前轮次
  tokensUsed?: number;           // 已用 token
  lastError?: string;            // 最后错误信息
  
  // 依赖
  dependsOn?: string[];          // 依赖的子任务 ID
}

/**
 * 子代理结果
 */
export interface SubagentResult {
  // 身份
  subagentTaskId: string;
  parentTaskId: string;
  teamId: string;
  agent: SubagentRole;
  
  // 结果
  summary: string;                 // 执行摘要
  confidence?: number;             // 置信度 (0-1)
  
  // 产出物
  artifacts?: ArtifactRef[];       // 生成的文件/资源
  patches?: PatchRef[];            // 代码补丁
  findings?: Finding[];            // 发现的问题
  
  // 审计
  turnsUsed: number;               // 实际使用轮次
  tokensUsed?: number;             // 实际使用 token
  durationMs: number;              // 执行耗时
  
  // 错误
  error?: {
    type: string;
    message: string;
    recoverable: boolean;
  };
  
  // 后续建议
  blockers?: string[];             // 阻塞问题
  recommendations?: string[];      // 后续建议
  nextSteps?: string[];            // 推荐下一步
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
  // 身份
  teamId: string;
  parentTaskId: string;
  sessionId: string;
  
  // 团队成员
  agents: SubagentTask[];
  
  // 共享状态
  sharedState: Record<string, unknown>;
  
  // 资源
  worktree?: string;
  allowedTools: string[];
  
  // 预算
  totalBudget: BudgetSpec;
  usedBudget: BudgetUsage;
  
  // 状态
  status: TeamStatus;
  createdAt: number;
  completedAt?: number;
  
  // 结果
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

// ============================================================================
// 接口定义
// ============================================================================

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

// ============================================================================
// 参数类型
// ============================================================================

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

// ============================================================================
// 策略决策类型
// ============================================================================

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

// ============================================================================
// 归并结果
// ============================================================================

export interface MergedResult {
  summary: string;
  artifacts: ArtifactRef[];
  patches: PatchRef[];
  findings: Finding[];
  confidence: number;
  blockers: string[];
  recommendations: string[];
}

// ============================================================================
// 角色默认配置
// ============================================================================

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
export const AGENT_ROLE_DEFAULTS: Record<SubagentRole, AgentRoleDefaults> = {
  planner: {
    role: "planner",
    description: "任务规划与分解",
    allowedTools: ["fs.read", "fs.list", "grep.search", "shell.run"],
    forbiddenTools: ["fs.write", "fs.delete", "git.commit"],
    defaultBudget: {
      maxTurns: 10,
      maxTokens: 50000,
      timeoutMs: 300000,
    },
  },
  repo_reader: {
    role: "repo_reader",
    description: "代码库读取与理解",
    allowedTools: ["fs.read", "fs.list", "grep.search", "repo.map"],
    forbiddenTools: ["fs.write", "fs.delete", "shell.run"],
    defaultBudget: {
      maxTurns: 15,
      maxTokens: 100000,
      timeoutMs: 600000,
    },
  },
  code_fixer: {
    role: "code_fixer",
    description: "代码修复与实现",
    allowedTools: ["fs.read", "fs.write", "fs.delete", "grep.search", "shell.run", "git.diff"],
    forbiddenTools: ["git.commit", "git.push"],
    defaultBudget: {
      maxTurns: 20,
      maxTokens: 150000,
      timeoutMs: 900000,
    },
  },
  code_reviewer: {
    role: "code_reviewer",
    description: "代码审查与风险评估",
    allowedTools: ["fs.read", "grep.search", "git.diff"],
    forbiddenTools: ["fs.write", "fs.delete", "shell.run", "git.commit"],
    defaultBudget: {
      maxTurns: 10,
      maxTokens: 80000,
      timeoutMs: 300000,
    },
  },
  verify_agent: {
    role: "verify_agent",
    description: "测试验证与质量检查",
    allowedTools: ["fs.read", "fs.list", "shell.run", "grep.search"],
    forbiddenTools: ["fs.write", "fs.delete", "git.commit"],
    defaultBudget: {
      maxTurns: 15,
      maxTokens: 100000,
      timeoutMs: 600000,
    },
  },
  release_agent: {
    role: "release_agent",
    description: "发布与部署",
    allowedTools: ["fs.read", "fs.write", "shell.run", "git.commit", "git.push"],
    forbiddenTools: [],
    defaultBudget: {
      maxTurns: 10,
      maxTokens: 50000,
      timeoutMs: 300000,
    },
  },
};
