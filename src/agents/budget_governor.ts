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

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 预算类型
 */
export type BudgetType =
  | 'concurrency'
  | 'team_tokens'
  | 'role_tokens'
  | 'time'
  | 'retry';

/**
 * 预算配置
 */
export interface BudgetConfig {
  // 并发预算
  maxGlobalConcurrency?: number;
  maxTeamConcurrency?: number;
  
  // Token 预算
  teamTokenBudget?: Record<string, number>;
  roleTokenBudget?: Record<string, number>;
  
  // 时间预算
  teamTimeBudgetMs?: Record<string, number>;
  
  // 重试预算
  maxRetriesPerTask?: number;
  maxRetriesPerTeam?: number;
}

/**
 * 预算使用情况
 */
export interface BudgetUsage {
  // 已用
  used: number;
  
  // 总预算
  total: number;
  
  // 剩余
  remaining: number;
  
  // 使用百分比
  percentageUsed: number;
  
  // 是否超限
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
  // 团队预算使用
  teamBudgets: Record<string, BudgetUsage>;
  
  // 角色预算使用
  roleBudgets: Record<string, BudgetUsage>;
  
  // 重试使用
  retryCounts: Record<string, number>;
  
  // 超限次数
  exceededCount: number;
  
  // 准入拒绝次数
  admissionRejections: number;
}

// ============================================================================
// 预算管理器
// ============================================================================

export class BudgetGovernor {
  private config: Required<BudgetConfig>;
  
  // Token 使用跟踪
  private teamTokenUsage: Map<string, number> = new Map();
  private roleTokenUsage: Map<string, number> = new Map();
  
  // 时间使用跟踪
  private teamTimeUsage: Map<string, number> = new Map();
  
  // 重试计数
  private retryCounts: Map<string, number> = new Map();
  private teamRetryCounts: Map<string, number> = new Map();
  
  // 统计
  private stats: BudgetStats = {
    teamBudgets: {},
    roleBudgets: {},
    retryCounts: {},
    exceededCount: 0,
    admissionRejections: 0,
  };
  
  constructor(config: BudgetConfig = {}) {
    this.config = {
      maxGlobalConcurrency: config.maxGlobalConcurrency || 10,
      maxTeamConcurrency: config.maxTeamConcurrency || 3,
      teamTokenBudget: config.teamTokenBudget || {},
      roleTokenBudget: config.roleTokenBudget || {
        planner: 50000,
        repo_reader: 100000,
        code_fixer: 150000,
        code_reviewer: 80000,
        verify_agent: 100000,
        release_agent: 50000,
      },
      teamTimeBudgetMs: config.teamTimeBudgetMs || {},
      maxRetriesPerTask: config.maxRetriesPerTask || 2,
      maxRetriesPerTeam: config.maxRetriesPerTeam || 10,
    };
  }
  
  /**
   * 检查准入
   */
  checkAdmission(input: AdmissionCheckInput): AdmissionCheckResult {
    // Step 1: 检查团队 Token 预算
    const teamTokenCheck = this.checkTeamTokenBudget(input.teamId, input.estimatedTokens);
    if (!teamTokenCheck.admitted) {
      this.stats.admissionRejections++;
      return teamTokenCheck;
    }
    
    // Step 2: 检查角色 Token 预算
    const roleTokenCheck = this.checkRoleTokenBudget(input.role, input.estimatedTokens);
    if (!roleTokenCheck.admitted) {
      this.stats.admissionRejections++;
      return roleTokenCheck;
    }
    
    // Step 3: 检查团队时间预算
    const timeCheck = this.checkTeamTimeBudget(input.teamId, input.estimatedTimeMs);
    if (!timeCheck.admitted) {
      this.stats.admissionRejections++;
      return timeCheck;
    }
    
    // Step 4: 检查重试预算
    const retryCheck = this.checkRetryBudget(input.teamId);
    if (!retryCheck.admitted) {
      this.stats.admissionRejections++;
      return retryCheck;
    }
    
    return { admitted: true };
  }
  
  /**
   * 记录 Token 使用
   */
  recordTokenUsage(teamId: string, role: string, tokens: number): void {
    // 更新团队使用
    const currentTeamUsage = this.teamTokenUsage.get(teamId) || 0;
    this.teamTokenUsage.set(teamId, currentTeamUsage + tokens);
    
    // 更新角色使用
    const currentRoleUsage = this.roleTokenUsage.get(role) || 0;
    this.roleTokenUsage.set(role, currentRoleUsage + tokens);
    
    // 检查是否超限
    this.checkTeamTokenExceeded(teamId);
    this.checkRoleTokenExceeded(role);
  }
  
  /**
   * 记录时间使用
   */
  recordTimeUsage(teamId: string, timeMs: number): void {
    const currentTimeUsage = this.teamTimeUsage.get(teamId) || 0;
    this.teamTimeUsage.set(teamId, currentTimeUsage + timeMs);
    
    // 检查是否超限
    this.checkTeamTimeExceeded(teamId);
  }
  
  /**
   * 记录重试
   */
  recordRetry(taskId: string, teamId: string): boolean {
    // 检查任务重试次数
    const taskRetries = this.retryCounts.get(taskId) || 0;
    if (taskRetries >= this.config.maxRetriesPerTask) {
      return false; // 超过任务重试预算
    }
    
    // 检查团队重试次数
    const teamRetries = this.teamRetryCounts.get(teamId) || 0;
    if (teamRetries >= this.config.maxRetriesPerTeam) {
      return false; // 超过团队重试预算
    }
    
    // 记录重试
    this.retryCounts.set(taskId, taskRetries + 1);
    this.teamRetryCounts.set(teamId, teamRetries + 1);
    
    return true;
  }
  
  /**
   * 获取团队 Token 预算使用
   */
  getTeamTokenUsage(teamId: string): BudgetUsage {
    const used = this.teamTokenUsage.get(teamId) || 0;
    const total = this.config.teamTokenBudget[teamId] || 0;
    
    return this.createBudgetUsage(used, total);
  }
  
  /**
   * 获取角色 Token 预算使用
   */
  getRoleTokenUsage(role: string): BudgetUsage {
    const used = this.roleTokenUsage.get(role) || 0;
    const total = this.config.roleTokenBudget[role] || 0;
    
    return this.createBudgetUsage(used, total);
  }
  
  /**
   * 获取团队时间预算使用
   */
  getTeamTimeUsage(teamId: string): BudgetUsage {
    const used = this.teamTimeUsage.get(teamId) || 0;
    const total = this.config.teamTimeBudgetMs[teamId] || 0;
    
    return this.createBudgetUsage(used, total);
  }
  
  /**
   * 获取重试使用
   */
  getRetryUsage(taskId: string, teamId: string): { taskRetries: number; teamRetries: number } {
    return {
      taskRetries: this.retryCounts.get(taskId) || 0,
      teamRetries: this.teamRetryCounts.get(teamId) || 0,
    };
  }
  
  /**
   * 获取统计
   */
  getStats(): BudgetStats {
    // 更新预算使用统计
    for (const teamId of Object.keys(this.config.teamTokenBudget)) {
      this.stats.teamBudgets[teamId] = this.getTeamTokenUsage(teamId);
    }
    
    for (const role of Object.keys(this.config.roleTokenBudget)) {
      this.stats.roleBudgets[role] = this.getRoleTokenUsage(role);
    }
    
    for (const [taskId, count] of this.retryCounts.entries()) {
      this.stats.retryCounts[taskId] = count;
    }
    
    return { ...this.stats };
  }
  
  /**
   * 重置团队预算
   */
  resetTeamBudget(teamId: string): void {
    this.teamTokenUsage.delete(teamId);
    this.teamTimeUsage.delete(teamId);
    this.teamRetryCounts.delete(teamId);
  }
  
  /**
   * 重置所有统计
   */
  resetStats(): void {
    this.teamTokenUsage.clear();
    this.roleTokenUsage.clear();
    this.teamTimeUsage.clear();
    this.retryCounts.clear();
    this.teamRetryCounts.clear();
    
    this.stats = {
      teamBudgets: {},
      roleBudgets: {},
      retryCounts: {},
      exceededCount: 0,
      admissionRejections: 0,
    };
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 检查团队 Token 预算
   */
  private checkTeamTokenBudget(
    teamId: string,
    estimatedTokens?: number
  ): AdmissionCheckResult {
    const total = this.config.teamTokenBudget[teamId];
    
    if (!total) {
      return { admitted: true }; // 无预算限制
    }
    
    const used = this.teamTokenUsage.get(teamId) || 0;
    const remaining = total - used;
    
    if (estimatedTokens && estimatedTokens > remaining) {
      this.stats.exceededCount++;
      return {
        admitted: false,
        reason: `Team ${teamId} token budget exceeded: estimated ${estimatedTokens} > remaining ${remaining}`,
        budgetType: 'team_tokens',
        suggestedAction: 'fail_fast',
      };
    }
    
    return { admitted: true };
  }
  
  /**
   * 检查角色 Token 预算
   */
  private checkRoleTokenBudget(
    role: string,
    estimatedTokens?: number
  ): AdmissionCheckResult {
    const total = this.config.roleTokenBudget[role];
    
    if (!total) {
      return { admitted: true }; // 无预算限制
    }
    
    const used = this.roleTokenUsage.get(role) || 0;
    const remaining = total - used;
    
    if (estimatedTokens && estimatedTokens > remaining) {
      this.stats.exceededCount++;
      return {
        admitted: false,
        reason: `Role ${role} token budget exceeded: estimated ${estimatedTokens} > remaining ${remaining}`,
        budgetType: 'role_tokens',
        suggestedAction: 'reduce_scope',
      };
    }
    
    return { admitted: true };
  }
  
  /**
   * 检查团队时间预算
   */
  private checkTeamTimeBudget(
    teamId: string,
    estimatedTimeMs?: number
  ): AdmissionCheckResult {
    const total = this.config.teamTimeBudgetMs[teamId];
    
    if (!total) {
      return { admitted: true }; // 无预算限制
    }
    
    const used = this.teamTimeUsage.get(teamId) || 0;
    const remaining = total - used;
    
    if (estimatedTimeMs && estimatedTimeMs > remaining) {
      this.stats.exceededCount++;
      return {
        admitted: false,
        reason: `Team ${teamId} time budget exceeded: estimated ${estimatedTimeMs}ms > remaining ${remaining}ms`,
        budgetType: 'time',
        suggestedAction: 'fail_fast',
      };
    }
    
    return { admitted: true };
  }
  
  /**
   * 检查重试预算
   */
  private checkRetryBudget(teamId: string): AdmissionCheckResult {
    const teamRetries = this.teamRetryCounts.get(teamId) || 0;
    
    if (teamRetries >= this.config.maxRetriesPerTeam) {
      this.stats.exceededCount++;
      return {
        admitted: false,
        reason: `Team ${teamId} retry budget exceeded: ${teamRetries} >= ${this.config.maxRetriesPerTeam}`,
        budgetType: 'retry',
        suggestedAction: 'fail_fast',
      };
    }
    
    return { admitted: true };
  }
  
  /**
   * 检查团队 Token 超限
   */
  private checkTeamTokenExceeded(teamId: string): void {
    const usage = this.getTeamTokenUsage(teamId);
    if (usage.isExceeded) {
      this.stats.exceededCount++;
    }
  }
  
  /**
   * 检查角色 Token 超限
   */
  private checkRoleTokenExceeded(role: string): void {
    const usage = this.getRoleTokenUsage(role);
    if (usage.isExceeded) {
      this.stats.exceededCount++;
    }
  }
  
  /**
   * 检查团队时间超限
   */
  private checkTeamTimeExceeded(teamId: string): void {
    const usage = this.getTeamTimeUsage(teamId);
    if (usage.isExceeded) {
      this.stats.exceededCount++;
    }
  }
  
  /**
   * 创建预算使用对象
   */
  private createBudgetUsage(used: number, total: number): BudgetUsage {
    const remaining = Math.max(0, total - used);
    const percentageUsed = total > 0 ? (used / total) * 100 : 0;
    
    return {
      used,
      total,
      remaining,
      percentageUsed,
      isExceeded: used > total,
    };
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建预算管理器
 */
export function createBudgetGovernor(config?: BudgetConfig): BudgetGovernor {
  return new BudgetGovernor(config);
}

/**
 * 默认预算配置
 */
export const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
  maxGlobalConcurrency: 10,
  maxTeamConcurrency: 3,
  teamTokenBudget: {}, // 按团队配置
  roleTokenBudget: {
    planner: 50000,
    repo_reader: 100000,
    code_fixer: 150000,
    code_reviewer: 80000,
    verify_agent: 100000,
    release_agent: 50000,
  },
  teamTimeBudgetMs: {}, // 按团队配置
  maxRetriesPerTask: 2,
  maxRetriesPerTeam: 10,
};

/**
 * 保守预算配置（适合生产）
 */
export const CONSERVATIVE_BUDGET_CONFIG: BudgetConfig = {
  maxGlobalConcurrency: 5,
  maxTeamConcurrency: 2,
  teamTokenBudget: {},
  roleTokenBudget: {
    planner: 30000,
    repo_reader: 50000,
    code_fixer: 80000,
    code_reviewer: 40000,
    verify_agent: 50000,
    release_agent: 30000,
  },
  teamTimeBudgetMs: {},
  maxRetriesPerTask: 1,
  maxRetriesPerTeam: 5,
};
