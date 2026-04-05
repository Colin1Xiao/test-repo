/**
 * Compact Policy - 紧凑压缩策略
 *
 * 职责：
 * 1. 判定何时 compact
 * 2. 判定 compact 范围
 * 3. 生成 compact 摘要策略
 * 4. 与 session/task 生命周期事件挂钩
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { CompactDecision, CompactPlan } from './types';
/**
 * 紧凑评估上下文
 */
export interface CompactContext {
    /** 会话 ID */
    sessionId?: string;
    /** 任务 ID */
    taskId?: string;
    /** 消息/事件数量 */
    messageCount?: number;
    /** 任务图深度 */
    taskGraphDepth?: number;
    /** 子代理结果数量 */
    subagentResultCount?: number;
    /** 审批历史数量 */
    approvalHistoryCount?: number;
    /** 上下文大小（字节） */
    contextSizeBytes?: number;
    /** 会话是否结束 */
    sessionEnded?: boolean;
    /** 元数据 */
    metadata?: Record<string, any>;
}
/**
 * 紧凑策略配置
 */
export interface CompactPolicyConfig {
    /** 最大消息数阈值 */
    maxMessageCount?: number;
    /** 最大任务图深度 */
    maxTaskGraphDepth?: number;
    /** 最大子代理结果数 */
    maxSubagentResults?: number;
    /** 最大审批历史数 */
    maxApprovalHistory?: number;
    /** 最大上下文大小（字节） */
    maxContextSizeBytes?: number;
    /** 默认保留消息数 */
    defaultKeepLastN?: number;
    /** 是否生成摘要 */
    generateSummary?: boolean;
    /** 摘要长度限制 */
    summaryLengthLimit?: number;
}
export declare class CompactPolicyEvaluator {
    private config;
    constructor(config?: CompactPolicyConfig);
    /**
     * 评估紧凑需求
     */
    evaluateCompactNeed(context: CompactContext): CompactDecision;
    /**
     * 检查是否应该紧凑
     */
    shouldCompact(event: string, context: CompactContext): boolean;
    /**
     * 构建紧凑计划
     */
    buildCompactPlan(context: CompactContext): CompactPlan;
    /**
     * 生成紧凑摘要
     */
    summarizeForCompact(context: CompactContext): string;
    /**
     * 构建紧凑策略
     */
    private buildCompactStrategy;
    /**
     * 获取触发原因
     */
    private getTriggerReason;
    /**
     * 估算压缩率
     */
    private estimateCompressionRatio;
}
/**
 * 创建紧凑策略评估器
 */
export declare function createCompactPolicyEvaluator(config?: CompactPolicyConfig): CompactPolicyEvaluator;
/**
 * 快速评估紧凑需求
 */
export declare function evaluateCompactNeed(context: CompactContext, config?: CompactPolicyConfig): CompactDecision;
/**
 * 快速检查是否应该紧凑
 */
export declare function shouldCompact(event: string, context: CompactContext, config?: CompactPolicyConfig): boolean;
