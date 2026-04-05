/**
 * Agent Teams / Subagents - 任务拆分策略
 * 
 * 第一版：基于规则的简单策略
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type {
  TaskDefinition,
  DelegationDecision,
  AgentRoleConfig,
  BudgetSpec,
  BudgetAllocation,
  SubagentRole,
  PermissionValidation,
} from "./types";
import type { IDelegationPolicy } from "./types";
import { AGENT_ROLE_DEFAULTS } from "./types";

// ============================================================================
// 任务分类规则
// ============================================================================

/**
 * 任务复杂度到代理角色的映射
 */
const COMPLEXITY_ROLE_MAP: Record<"low" | "medium" | "high", SubagentRole[]> = {
  low: ["planner"],
  medium: ["planner", "code_fixer", "verify_agent"],
  high: ["planner", "repo_reader", "code_fixer", "code_reviewer", "verify_agent"],
};

/**
 * 高风险任务列表（禁止自动拆分）
 */
const HIGH_RISK_PATTERNS = [
  "delete",
  "drop",
  "remove",
  "destroy",
  "production",
  "deploy",
  "release",
  "migration",
  "schema",
];

/**
 * 需要审批的任务模式
 */
const REQUIRES_APPROVAL_PATTERNS = [
  "git.push",
  "git.commit",
  "deploy",
  "release",
  "production",
];

// ============================================================================
// 策略实现
// ============================================================================

export class DelegationPolicy implements IDelegationPolicy {
  /**
   * 判断任务是否可拆分
   */
  async canDelegate(task: TaskDefinition): Promise<DelegationDecision> {
    const constraints: string[] = [];
    
    // 检查风险模式
    const goalLower = task.goal.toLowerCase();
    const riskPatterns = HIGH_RISK_PATTERNS.filter(pattern =>
      goalLower.includes(pattern)
    );
    
    if (riskPatterns.length > 0) {
      return {
        allowed: false,
        reason: `任务包含高风险操作：${riskPatterns.join(", ")}`,
        riskLevel: "high",
        constraints: ["禁止自动拆分，需要人工审批"],
      };
    }
    
    // 检查是否需要外部操作
    if (task.requiresExternalAction) {
      constraints.push("需要外部系统访问");
    }
    
    // 检查是否需要代码访问
    if (task.requiresCodeAccess) {
      constraints.push("需要代码库访问权限");
    }
    
    // 根据复杂度判断
    const complexity = task.complexity || "medium";
    const riskLevel = complexity === "high" ? "medium" : "low";
    
    return {
      allowed: true,
      riskLevel,
      constraints: constraints.length > 0 ? constraints : undefined,
    };
  }
  
  /**
   * 推荐子代理角色
   */
  async recommendAgents(task: TaskDefinition): Promise<AgentRoleConfig[]> {
    const complexity = task.complexity || "medium";
    const roles = COMPLEXITY_ROLE_MAP[complexity];
    
    return roles.map(role => {
      const defaults = AGENT_ROLE_DEFAULTS[role];
      return {
        role,
        goal: this.generateAgentGoal(role, task.goal),
        allowedTools: [...defaults.allowedTools],
        budget: { ...defaults.defaultBudget },
      };
    });
  }
  
  /**
   * 计算预算分配
   * 
   * 策略：70% 用于子代理，30% 预留
   */
  async calculateBudget(
    parentBudget: BudgetSpec,
    agents: AgentRoleConfig[]
  ): Promise<BudgetAllocation> {
    const childRatio = 0.7;
    const reservedRatio = 0.3;
    
    // 角色权重
    const roleWeights: Record<SubagentRole, number> = {
      planner: 1.0,
      repo_reader: 1.2,
      code_fixer: 1.5,
      code_reviewer: 1.0,
      verify_agent: 1.2,
      release_agent: 0.8,
    };
    
    // 计算总权重
    const totalWeight = agents.reduce(
      (sum, agent) => sum + (roleWeights[agent.role] || 1.0),
      0
    );
    
    // 可分配预算
    const allocatableTurns = Math.floor(parentBudget.maxTurns * childRatio);
    const allocatableTokens = parentBudget.maxTokens
      ? Math.floor(parentBudget.maxTokens * childRatio)
      : undefined;
    const allocatableTimeout = Math.floor(parentBudget.timeoutMs * childRatio);
    
    // 按权重分配
    const perAgent: Record<string, BudgetSpec> = {};
    
    for (const agent of agents) {
      const weight = roleWeights[agent.role] || 1.0;
      const ratio = weight / totalWeight;
      
      perAgent[agent.role] = {
        maxTurns: Math.max(1, Math.floor(allocatableTurns * ratio)),
        maxTokens: allocatableTokens
          ? Math.max(1000, Math.floor(allocatableTokens * ratio))
          : undefined,
        timeoutMs: Math.max(10000, Math.floor(allocatableTimeout * ratio)),
      };
    }
    
    // 预留预算
    const reserved: BudgetSpec = {
      maxTurns: Math.max(1, Math.floor(parentBudget.maxTurns * reservedRatio)),
      maxTokens: parentBudget.maxTokens
        ? Math.max(1000, Math.floor(parentBudget.maxTokens * reservedRatio))
        : undefined,
      timeoutMs: Math.max(10000, Math.floor(parentBudget.timeoutMs * reservedRatio)),
    };
    
    return { perAgent, reserved };
  }
  
  /**
   * 验证工具权限
   */
  async validateToolPermissions(
    agent: SubagentRole,
    tools: string[]
  ): Promise<PermissionValidation> {
    const defaults = AGENT_ROLE_DEFAULTS[agent];
    if (!defaults) {
      return {
        allowed: [],
        denied: tools,
        reason: `未知代理角色：${agent}`,
      };
    }
    
    const allowed: string[] = [];
    const denied: string[] = [];
    
    for (const tool of tools) {
      // 检查是否在白名单
      if (defaults.allowedTools.includes(tool)) {
        // 检查是否在黑名单
        if (defaults.forbiddenTools.includes(tool)) {
          denied.push(tool);
        } else {
          allowed.push(tool);
        }
      } else {
        denied.push(tool);
      }
    }
    
    return {
      allowed,
      denied,
      reason: denied.length > 0
        ? `以下工具不允许：${denied.join(", ")}`
        : undefined,
    };
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 根据角色生成任务目标
   */
  private generateAgentGoal(role: SubagentRole, parentGoal: string): string {
    const goalTemplates: Record<SubagentRole, string> = {
      planner: `规划任务：${parentGoal}`,
      repo_reader: `读取并理解代码库结构，为"${parentGoal}"做准备`,
      code_fixer: `实现代码修复：${parentGoal}`,
      code_reviewer: `审查代码变更，评估风险：${parentGoal}`,
      verify_agent: `验证实现结果：${parentGoal}`,
      release_agent: `部署发布：${parentGoal}`,
    };
    
    return goalTemplates[role] || `${role}: ${parentGoal}`;
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建策略实例
 */
export function createDelegationPolicy(): IDelegationPolicy {
  return new DelegationPolicy();
}

/**
 * 快速检查任务是否可拆分
 */
export async function quickCheckDelegation(
  goal: string,
  complexity?: "low" | "medium" | "high"
): Promise<{ allowed: boolean; reason?: string }> {
  const policy = new DelegationPolicy();
  const decision = await policy.canDelegate({
    id: "temp",
    goal,
    complexity,
  });
  
  return {
    allowed: decision.allowed,
    reason: decision.reason,
  };
}
