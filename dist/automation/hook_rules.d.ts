/**
 * Hook Rules - 规则调度层
 *
 * 职责：
 * 1. 注册规则
 * 2. 根据 event 选规则
 * 3. 按 priority 排序
 * 4. 判定 enabled / cooldown / stopOnMatch
 * 5. 调用 conditions + actions 执行完整链路
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { AutomationRule, AutomationEvent, RuleMatchResult, AutomationExecutionContext, AutomationExecutionSummary } from './types';
/**
 * 规则执行器配置
 */
export interface RuleExecutorConfig {
    /** 最大执行深度 */
    maxChainDepth?: number;
    /** 默认冷却时间（毫秒） */
    defaultCooldownMs?: number;
}
/**
 * 规则触发追踪
 */
interface RuleTriggerTracking {
    /** 最后触发时间 */
    lastTriggeredAt: number;
    /** 触发次数 */
    triggerCount: number;
}
export declare class RuleExecutor {
    private config;
    private rules;
    private triggerTracking;
    private actionExecutor;
    constructor(config?: RuleExecutorConfig);
    /**
     * 注册规则
     */
    registerRule(rule: AutomationRule): void;
    /**
     * 注销规则
     */
    unregisterRule(ruleId: string): boolean;
    /**
     * 启用规则
     */
    enableRule(ruleId: string): boolean;
    /**
     * 禁用规则
     */
    disableRule(ruleId: string): boolean;
    /**
     * 获取规则
     */
    getRule(ruleId: string): AutomationRule | null;
    /**
     * 获取所有规则
     */
    getAllRules(): AutomationRule[];
    /**
     * 匹配规则
     */
    matchRules(event: AutomationEvent, context?: Partial<AutomationExecutionContext>): RuleMatchResult[];
    /**
     * 执行匹配的规则
     */
    executeMatchingRules(event: AutomationEvent, context?: Partial<AutomationExecutionContext>): Promise<AutomationExecutionSummary>;
    /**
     * 重置规则触发追踪
     */
    resetRuleTracking(ruleId: string): void;
    /**
     * 获取规则触发统计
     */
    getRuleTracking(ruleId: string): RuleTriggerTracking | null;
    /**
     * 获取所有规则统计
     */
    getAllTracking(): Record<string, RuleTriggerTracking>;
}
/**
 * 创建规则执行器
 */
export declare function createRuleExecutor(config?: RuleExecutorConfig): RuleExecutor;
/**
 * 快速执行规则
 */
export declare function executeRules(event: AutomationEvent, rules: AutomationRule[], config?: RuleExecutorConfig): Promise<AutomationExecutionSummary>;
export {};
