/**
 * Approval View - 审批视图
 *
 * 职责：
 * 1. 从 ApprovalBridge / AuditLog 生成审批视图
 * 2. 显示 pending approvals、超时审批、瓶颈审批
 * 3. 暴露 approve / reject / escalate 等控制动作
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { ApprovalViewModel, ApprovalView, ViewFilter, ControlActionResult } from './control_types';
/**
 * 审批数据源
 */
export interface ApprovalDataSource {
    /** 获取待处理审批 */
    listPending(): Promise<any[]>;
    /** 获取审批历史 */
    listHistory(limit?: number): Promise<any[]>;
    /** 批准审批 */
    approve(approvalId: string, reason?: string): Promise<void>;
    /** 拒绝审批 */
    reject(approvalId: string, reason?: string): Promise<void>;
    /** 升级审批 */
    escalate(approvalId: string, reason?: string): Promise<void>;
}
/**
 * 审批视图构建器配置
 */
export interface ApprovalViewBuilderConfig {
    /** 最大待处理审批数 */
    maxPendingApprovals?: number;
    /** 超时阈值（毫秒） */
    timeoutThresholdMs?: number;
    /** 最近决定审批数 */
    recentDecidedCount?: number;
}
export declare class ApprovalViewBuilder {
    private config;
    private approvalDataSource;
    constructor(approvalDataSource: ApprovalDataSource, config?: ApprovalViewBuilderConfig);
    /**
     * 构建审批视图
     */
    buildApprovalView(filter?: ViewFilter): Promise<ApprovalView>;
    /**
     * 列出待处理审批
     */
    listPendingApprovals(filter?: ViewFilter): Promise<ApprovalViewModel[]>;
    /**
     * 列出审批瓶颈
     */
    listApprovalBottlenecks(): Promise<ApprovalView['bottlenecks']>;
    /**
     * 总结审批流
     */
    summarizeApprovalFlow(): Promise<ApprovalView['flowSummary']>;
    /**
     * 批准审批
     */
    approve(approvalId: string, reason?: string): Promise<ControlActionResult>;
    /**
     * 拒绝审批
     */
    reject(approvalId: string, reason?: string): Promise<ControlActionResult>;
    /**
     * 升级审批
     */
    escalate(approvalId: string, reason?: string): Promise<ControlActionResult>;
    /**
     * 审批转换为视图模型
     */
    private approvalToViewModel;
    /**
     * 规范化审批状态
     */
    private normalizeApprovalStatus;
    /**
     * 过滤审批
     */
    private filterApprovals;
    /**
     * 分析审批瓶颈
     */
    private analyzeBottlenecks;
    /**
     * 计算审批流摘要
     */
    private calculateFlowSummary;
}
/**
 * 创建审批视图构建器
 */
export declare function createApprovalViewBuilder(approvalDataSource: ApprovalDataSource, config?: ApprovalViewBuilderConfig): ApprovalViewBuilder;
/**
 * 快速构建审批视图
 */
export declare function buildApprovalView(approvalDataSource: ApprovalDataSource, filter?: ViewFilter): Promise<ApprovalView>;
