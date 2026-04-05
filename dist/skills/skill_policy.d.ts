/**
 * Skill Policy - Skill 策略决策
 *
 * 职责：
 * 1. 根据 trust + validation + source + compatibility 做最终决策
 * 2. 决定 allow / ask / deny
 * 3. 决定能否 install / enable / load
 * 4. 与现有 PermissionEngine / ApprovalBridge 语义对齐
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { SkillPackageDescriptor, SkillPolicyAction, SkillPolicyDecision, SkillPolicyContext, SkillPolicyRule, SkillValidationResult } from './types';
/**
 * 策略评估器配置
 */
export interface PolicyEvaluatorConfig {
    /** 默认规则 */
    defaultRules?: SkillPolicyRule[];
    /** 是否允许覆盖 */
    allowOverride?: boolean;
}
export declare class SkillPolicyEvaluator {
    private config;
    private rules;
    private trustEvaluator;
    constructor(config?: PolicyEvaluatorConfig);
    /**
     * 评估安装策略
     */
    evaluateInstallPolicy(pkg: SkillPackageDescriptor, context?: SkillPolicyContext, validation?: SkillValidationResult): SkillPolicyDecision;
    /**
     * 评估启用策略
     */
    evaluateEnablePolicy(pkg: SkillPackageDescriptor, context?: SkillPolicyContext, validation?: SkillValidationResult): SkillPolicyDecision;
    /**
     * 评估加载策略
     */
    evaluateLoadPolicy(pkg: SkillPackageDescriptor, agentSpec: {
        id: string;
    }, context?: SkillPolicyContext, validation?: SkillValidationResult): SkillPolicyDecision;
    /**
     * 评估策略
     */
    evaluatePolicy(action: SkillPolicyAction, pkg: SkillPackageDescriptor, context?: SkillPolicyContext, validation?: SkillValidationResult): SkillPolicyDecision;
    /**
     * 查找匹配的规则
     */
    private findMatchingRule;
    /**
     * 添加规则
     */
    addRule(rule: SkillPolicyRule): void;
    /**
     * 移除规则
     */
    removeRule(ruleId: string): boolean;
    /**
     * 获取所有规则
     */
    getRules(): SkillPolicyRule[];
    /**
     * 重置为默认规则
     */
    resetToDefaults(): void;
}
/**
 * 创建策略评估器
 */
export declare function createSkillPolicyEvaluator(config?: PolicyEvaluatorConfig): SkillPolicyEvaluator;
/**
 * 快速评估安装策略
 */
export declare function evaluateInstallPolicy(pkg: SkillPackageDescriptor, context?: SkillPolicyContext): SkillPolicyDecision;
/**
 * 快速评估启用策略
 */
export declare function evaluateEnablePolicy(pkg: SkillPackageDescriptor, context?: SkillPolicyContext): SkillPolicyDecision;
/**
 * 快速评估加载策略
 */
export declare function evaluateLoadPolicy(pkg: SkillPackageDescriptor, agentSpec: {
    id: string;
}, context?: SkillPolicyContext): SkillPolicyDecision;
