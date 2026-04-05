/**
 * Memory Capture Policy - 记忆捕获策略
 *
 * 职责：
 * 1. 决定什么内容值得写入长期记忆
 * 2. 控制 capture 时机
 * 3. 生成结构化 memory entry 候选
 * 4. 避免把短期噪声灌进 memory
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { MemoryCaptureDecision, MemoryCaptureCandidate, MemoryCategory, MemoryCaptureConfig } from './types';
/**
 * 记忆捕获上下文
 */
export interface MemoryCaptureContext {
    /** 事件类型 */
    eventType?: string;
    /** 任务 ID */
    taskId?: string;
    /** 审批 ID */
    approvalId?: string;
    /** 会话 ID */
    sessionId?: string;
    /** 事件结果 */
    eventResult?: 'success' | 'failure' | 'pending';
    /** 事件数据 */
    eventData?: Record<string, any>;
    /** 内容摘要 */
    contentSummary?: string;
    /** 重要性分数（0-1） */
    importanceScore?: number;
    /** 是否一次性事件 */
    isOneTimeEvent?: boolean;
    /** 元数据 */
    metadata?: Record<string, any>;
}
export declare class MemoryCapturePolicyEvaluator {
    private config;
    private lowValuePatterns;
    constructor(config?: MemoryCaptureConfig);
    /**
     * 评估是否应该捕获记忆
     */
    evaluateMemoryCapture(context: MemoryCaptureContext): MemoryCaptureDecision;
    /**
     * 检查是否应该捕获记忆
     */
    shouldCaptureMemory(event: string, context: MemoryCaptureContext): boolean;
    /**
     * 构建记忆捕获候选
     */
    buildMemoryCaptureCandidate(context: MemoryCaptureContext): MemoryCaptureCandidate;
    /**
     * 对记忆候选进行分类
     */
    classifyMemory(context: MemoryCaptureContext): MemoryCategory;
    /**
     * 过滤低价值记忆
     */
    filterLowValueMemory(candidate: MemoryCaptureCandidate): boolean;
    /**
     * 计算价值分数
     */
    private calculateValueScore;
    /**
     * 构建记忆内容
     */
    private buildMemoryContent;
    /**
     * 检查是否应该按分类捕获
     */
    private shouldCaptureByCategory;
    /**
     * 检查是否是低价值信息
     */
    private isLowValue;
    /**
     * 检查是否是一次性信息
     */
    private isOneTimeInfo;
}
/**
 * 创建记忆捕获策略评估器
 */
export declare function createMemoryCapturePolicyEvaluator(config?: MemoryCaptureConfig): MemoryCapturePolicyEvaluator;
/**
 * 快速评估记忆捕获
 */
export declare function evaluateMemoryCapture(context: MemoryCaptureContext, config?: MemoryCaptureConfig): MemoryCaptureDecision;
/**
 * 快速检查是否应该捕获记忆
 */
export declare function shouldCaptureMemory(event: string, context: MemoryCaptureContext, config?: MemoryCaptureConfig): boolean;
