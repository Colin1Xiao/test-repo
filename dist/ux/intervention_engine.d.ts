/**
 * Intervention Engine - 介入引擎
 *
 * 职责：
 * 1. 从 6C 的 dashboard / attention items 中识别哪些事项需要人介入
 * 2. 输出 must_confirm / should_review / can_dismiss / can_snooze / should_escalate
 * 3. 这里本质上是把 dashboard attention 转成正式的 intervention items
 *
 * @version v0.1.0
 * @date 2026-04-04
 */
import type { AttentionItem, DashboardSnapshot } from './dashboard_types';
import type { InterventionItem, InterventionRule, InterventionEngineConfig } from './hitl_types';
/**
 * 超时审批介入规则
 */
export declare const AGED_APPROVAL_INTERVENTION_RULE: InterventionRule;
/**
 * 阻塞任务介入规则
 */
export declare const BLOCKED_TASK_INTERVENTION_RULE: InterventionRule;
/**
 * 降级 Server 介入规则
 */
export declare const DEGRADED_SERVER_INTERVENTION_RULE: InterventionRule;
/**
 * 不健康 Agent 介入规则
 */
export declare const UNHEALTHY_AGENT_INTERVENTION_RULE: InterventionRule;
/**
 * 重放热点介入规则
 */
export declare const REPLAY_HOTSPOT_INTERVENTION_RULE: InterventionRule;
/**
 * 所有内置介入规则
 */
export declare const BUILTIN_INTERVENTION_RULES: InterventionRule[];
export declare class InterventionEngine {
    private config;
    private rules;
    constructor(config?: InterventionEngineConfig);
    /**
     * 注册介入规则
     */
    registerRule(rule: InterventionRule): void;
    /**
     * 注销介入规则
     */
    unregisterRule(ruleId: string): boolean;
    /**
     * 从关注项生成介入项
     */
    generateInterventions(attentionItems: AttentionItem[], dashboard: DashboardSnapshot): InterventionItem[];
    /**
     * 从仪表盘生成介入项
     */
    generateInterventionsFromDashboard(dashboard: DashboardSnapshot): InterventionItem[];
    /**
     * 获取所有规则
     */
    getAllRules(): InterventionRule[];
    /**
     * 获取规则数量
     */
    getRuleCount(): number;
}
/**
 * 创建介入引擎
 */
export declare function createInterventionEngine(config?: InterventionEngineConfig): InterventionEngine;
/**
 * 快速生成介入项
 */
export declare function generateInterventions(attentionItems: AttentionItem[], dashboard: DashboardSnapshot, config?: InterventionEngineConfig): InterventionItem[];
