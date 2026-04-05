/**
 * Attention Engine - 注意力引擎
 *
 * 职责：
 * 1. 从 task / approval / ops / agent 四类 view 中提取真正需要人关注的事项
 * 2. 输出 aged approvals / blocked tasks / failing agents / degraded servers / replay hotspots / active incidents
 * 3. 这个模块会决定 dashboard 是"有洞察"还是"只是列表"
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { ControlSurfaceSnapshot, AttentionRule, AttentionAnalysis } from './control_types';
/**
 * 超时审批规则
 */
export declare const AGED_APPROVAL_RULE: AttentionRule;
/**
 * 阻塞任务规则
 */
export declare const BLOCKED_TASK_RULE: AttentionRule;
/**
 * 失败任务规则
 */
export declare const FAILED_TASK_RULE: AttentionRule;
/**
 * 降级 Server 规则
 */
export declare const DEGRADED_SERVER_RULE: AttentionRule;
/**
 * 不健康 Agent 规则
 */
export declare const UNHEALTHY_AGENT_RULE: AttentionRule;
/**
 * 重放热点规则
 */
export declare const REPLAY_HOTSPOT_RULE: AttentionRule;
/**
 * 顶级失败规则
 */
export declare const TOP_FAILURE_RULE: AttentionRule;
/**
 * 所有内置注意力规则
 */
export declare const BUILTIN_ATTENTION_RULES: AttentionRule[];
export declare class AttentionEngine {
    private rules;
    constructor();
    /**
     * 注册注意力规则
     */
    registerRule(rule: AttentionRule): void;
    /**
     * 注销注意力规则
     */
    unregisterRule(ruleId: string): boolean;
    /**
     * 分析快照生成关注项
     */
    analyze(snapshot: ControlSurfaceSnapshot): AttentionAnalysis;
    /**
     * 获取所有规则
     */
    getAllRules(): AttentionRule[];
    /**
     * 获取规则数量
     */
    getRuleCount(): number;
}
/**
 * 创建注意力引擎
 */
export declare function createAttentionEngine(): AttentionEngine;
/**
 * 快速分析快照
 */
export declare function analyzeAttention(snapshot: ControlSurfaceSnapshot): AttentionAnalysis;
