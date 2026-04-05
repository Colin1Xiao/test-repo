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

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 单次调用记录
 */
export interface InvocationRecord {
  // 身份
  timestamp: number;
  subagentTaskId: string;
  teamId: string;
  role: string;
  
  // 使用情况
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  
  // 性能
  latencyMs: number;
  
  // 结果
  success: boolean;
  finishReason?: string;
  
  // 重试
  retryCount: number;
  isRetry: boolean;
}

/**
 * 角色使用统计
 */
export interface RoleUsageStats {
  role: string;
  
  // 调用次数
  totalInvocations: number;
  successfulInvocations: number;
  failedInvocations: number;
  
  // Token 使用
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  avgTokensPerInvocation: number;
  
  // 性能
  totalLatencyMs: number;
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  
  // 重试
  totalRetries: number;
  retryRate: number;
  
  // 预算
  budgetUsed: number;
  budgetRemaining?: number;
}

/**
 * 团队使用统计
 */
export interface TeamUsageStats {
  teamId: string;
  
  // 总体统计
  totalInvocations: number;
  totalTokens: number;
  totalCost?: number;
  
  // 按角色分组
  byRole: Record<string, RoleUsageStats>;
  
  // 时间范围
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

// ============================================================================
// 使用计量器接口
// ============================================================================

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

// ============================================================================
// 使用计量器实现
// ============================================================================

export class UsageMeter implements IUsageMeter {
  private invocations: Map<string, InvocationRecord[]> = new Map(); // teamId -> records
  private roleStats: Map<string, Map<string, RoleUsageStats>> = new Map(); // teamId -> role -> stats
  
  /**
   * 记录调用
   */
  recordInvocation(record: InvocationRecord): void {
    // 添加到调用记录
    let teamRecords = this.invocations.get(record.teamId);
    if (!teamRecords) {
      teamRecords = [];
      this.invocations.set(record.teamId, teamRecords);
    }
    teamRecords.push(record);
    
    // 更新角色统计
    this.updateRoleStats(record);
  }
  
  /**
   * 获取团队统计
   */
  getTeamStats(teamId: string): TeamUsageStats | null {
    const records = this.invocations.get(teamId);
    if (!records || records.length === 0) {
      return null;
    }
    
    const byRole: Record<string, RoleUsageStats> = {};
    const roleStatsMap = this.roleStats.get(teamId);
    
    if (roleStatsMap) {
      for (const [role, stats] of roleStatsMap.entries()) {
        byRole[role] = stats;
      }
    }
    
    const totalTokens = records.reduce((sum, r) => sum + r.totalTokens, 0);
    const startTime = Math.min(...records.map(r => r.timestamp));
    const endTime = Math.max(...records.map(r => r.timestamp));
    
    return {
      teamId,
      totalInvocations: records.length,
      totalTokens,
      byRole,
      startTime,
      endTime,
    };
  }
  
  /**
   * 获取角色统计
   */
  getRoleStats(teamId: string, role: string): RoleUsageStats | null {
    const teamRoleStats = this.roleStats.get(teamId);
    if (!teamRoleStats) {
      return null;
    }
    return teamRoleStats.get(role) || null;
  }
  
  /**
   * 检查预算
   */
  checkBudget(teamId: string, maxTokens: number): BudgetTracker {
    const stats = this.getTeamStats(teamId);
    const usedTokens = stats?.totalTokens || 0;
    
    return {
      maxTokens,
      usedTokens,
      remainingTokens: Math.max(0, maxTokens - usedTokens),
      percentageUsed: (usedTokens / maxTokens) * 100,
      isExceeded: usedTokens > maxTokens,
    };
  }
  
  /**
   * 重置统计
   */
  reset(teamId: string): void {
    this.invocations.delete(teamId);
    this.roleStats.delete(teamId);
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 更新角色统计
   */
  private updateRoleStats(record: InvocationRecord): void {
    // 初始化团队角色统计
    if (!this.roleStats.has(record.teamId)) {
      this.roleStats.set(record.teamId, new Map());
    }
    
    const teamRoleStats = this.roleStats.get(record.teamId)!;
    
    // 初始化角色统计
    if (!teamRoleStats.has(record.role)) {
      teamRoleStats.set(record.role, this.createInitialRoleStats(record.role));
    }
    
    const stats = teamRoleStats.get(record.role)!;
    
    // 更新统计
    stats.totalInvocations++;
    if (record.success) {
      stats.successfulInvocations++;
    } else {
      stats.failedInvocations++;
    }
    
    stats.totalInputTokens += record.inputTokens;
    stats.totalOutputTokens += record.outputTokens;
    stats.totalTokens += record.totalTokens;
    stats.avgTokensPerInvocation = stats.totalTokens / stats.totalInvocations;
    
    stats.totalLatencyMs += record.latencyMs;
    stats.avgLatencyMs = stats.totalLatencyMs / stats.totalInvocations;
    stats.minLatencyMs = Math.min(stats.minLatencyMs, record.latencyMs);
    stats.maxLatencyMs = Math.max(stats.maxLatencyMs, record.latencyMs);
    
    stats.totalRetries += record.retryCount;
    if (record.isRetry) {
      stats.retryRate = (stats.totalRetries / stats.totalInvocations) * 100;
    }
  }
  
  /**
   * 创建初始角色统计
   */
  private createInitialRoleStats(role: string): RoleUsageStats {
    return {
      role,
      totalInvocations: 0,
      successfulInvocations: 0,
      failedInvocations: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      avgTokensPerInvocation: 0,
      totalLatencyMs: 0,
      avgLatencyMs: 0,
      minLatencyMs: Infinity,
      maxLatencyMs: 0,
      totalRetries: 0,
      retryRate: 0,
      budgetUsed: 0,
    };
  }
}

// ============================================================================
// Token 估算工具
// ============================================================================

/**
 * Token 估算器（简化版）
 * 
 * 注意：这是近似估算，实际 token 数取决于具体模型的 tokenizer
 */
export class TokenEstimator {
  /**
   * 估算文本的 token 数
   * 
   * 简化规则：
   * - 英文：每 4 个字符约 1 个 token
   * - 中文：每 1.5 个字符约 1 个 token
   */
  estimateTokens(text: string): number {
    if (!text) return 0;
    
    // 检测主要语言
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
    
    if (chineseChars > englishChars) {
      // 中文为主
      return Math.ceil(text.length / 1.5);
    } else {
      // 英文为主
      return Math.ceil(text.length / 4);
    }
  }
  
  /**
   * 估算消息的 token 数
   */
  estimateMessageTokens(messages: Array<{ role: string; content: string }>): number {
    let total = 0;
    
    for (const msg of messages) {
      // 角色 token（固定开销）
      total += this.estimateTokens(msg.role);
      total += 4; // 特殊 token 开销
      
      // 内容 token
      total += this.estimateTokens(msg.content);
    }
    
    return total;
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建使用计量器
 */
export function createUsageMeter(): IUsageMeter {
  return new UsageMeter();
}

/**
 * 创建 Token 估算器
 */
export function createTokenEstimator(): TokenEstimator {
  return new TokenEstimator();
}

/**
 * 快速估算 token
 */
export function estimateTokens(text: string): number {
  const estimator = new TokenEstimator();
  return estimator.estimateTokens(text);
}
