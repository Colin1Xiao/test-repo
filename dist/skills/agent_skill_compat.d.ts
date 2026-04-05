/**
 * Agent Skill Compatibility - Agent Skill 兼容性
 *
 * 职责：
 * 1. 扩展 AgentSpec 的 skill 依赖表达
 * 2. 解析 requiredSkills / optionalSkills
 * 3. 判断某 agent 与某 skill 是否兼容
 * 4. 结合 4C 的 trust/validation/policy 决策，给出最终"能否加载到该 agent"
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { AgentSkillRequirement, AgentSkillSpec, AgentSkillLoadPlan, SkillPackageDescriptor } from './types';
import { SkillRegistry } from './skill_registry';
import { SkillPolicyEvaluator } from './skill_policy';
import { SkillValidator } from './skill_validation';
/**
 * 兼容性检查配置
 */
export interface CompatConfig {
    /** 运行时版本 */
    runtimeVersion?: string;
    /** 可用的 Agent 列表 */
    availableAgents?: string[];
}
/**
 * 兼容性检查结果
 */
export interface CompatCheckResult {
    /** 是否兼容 */
    compatible: boolean;
    /** 原因 */
    reason?: string;
    /** 不兼容类型 */
    incompatibilityType?: 'missing' | 'denied' | 'incompatible' | 'policy_block';
}
export declare class AgentSkillCompatChecker {
    private config;
    private registry;
    private policyEvaluator;
    private validator;
    constructor(registry: SkillRegistry, policyEvaluator: SkillPolicyEvaluator, validator: SkillValidator, config?: CompatConfig);
    /**
     * 解析 Agent Skill 需求
     */
    resolveAgentSkillRequirements(agentSpec: AgentSkillSpec): {
        required: AgentSkillRequirement[];
        optional: AgentSkillRequirement[];
        denied: string[];
    };
    /**
     * 检查 Skill 兼容性
     */
    checkSkillCompatibility(agentSpec: AgentSkillSpec, skillPkg: SkillPackageDescriptor): CompatCheckResult;
    /**
     * 构建 Agent Skill 加载计划
     */
    buildAgentSkillLoadPlan(agentSpec: AgentSkillSpec): Promise<AgentSkillLoadPlan>;
    /**
     * 评估 Skill 加载决策
     */
    private evaluateSkillLoadDecision;
}
/**
 * 创建兼容性检查器
 */
export declare function createAgentSkillCompatChecker(registry: SkillRegistry, policyEvaluator: SkillPolicyEvaluator, validator: SkillValidator, config?: CompatConfig): AgentSkillCompatChecker;
