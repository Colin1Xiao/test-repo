/**
 * Agent Teams / Subagents - 任务拆分策略
 *
 * 第一版：基于规则的简单策略
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { TaskDefinition, DelegationDecision, AgentRoleConfig, BudgetSpec, BudgetAllocation, SubagentRole, PermissionValidation } from "./types";
import type { IDelegationPolicy } from "./types";
export declare class DelegationPolicy implements IDelegationPolicy {
    /**
     * 判断任务是否可拆分
     */
    canDelegate(task: TaskDefinition): Promise<DelegationDecision>;
    /**
     * 推荐子代理角色
     */
    recommendAgents(task: TaskDefinition): Promise<AgentRoleConfig[]>;
    /**
     * 计算预算分配
     *
     * 策略：70% 用于子代理，30% 预留
     */
    calculateBudget(parentBudget: BudgetSpec, agents: AgentRoleConfig[]): Promise<BudgetAllocation>;
    /**
     * 验证工具权限
     */
    validateToolPermissions(agent: SubagentRole, tools: string[]): Promise<PermissionValidation>;
    /**
     * 根据角色生成任务目标
     */
    private generateAgentGoal;
}
/**
 * 创建策略实例
 */
export declare function createDelegationPolicy(): IDelegationPolicy;
/**
 * 快速检查任务是否可拆分
 */
export declare function quickCheckDelegation(goal: string, complexity?: "low" | "medium" | "high"): Promise<{
    allowed: boolean;
    reason?: string;
}>;
