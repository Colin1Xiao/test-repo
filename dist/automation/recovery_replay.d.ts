/**
 * Recovery Replay - 恢复与重放
 *
 * 职责：
 * 1. 根据 failure / interruption / approval 状态决定是否恢复
 * 2. 支持 task replay
 * 3. 支持 approval replay
 * 4. 支持 resume / retry / abort 分流
 * 5. 复用 TaskStore / ApprovalBridge 的现有记录
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { RecoveryDecision, ReplayResult, RecoveryPlan, FailureCategory, ReplayScope } from './types';
/**
 * 恢复评估上下文
 */
export interface RecoveryContext {
    /** 任务 ID */
    taskId?: string;
    /** 审批 ID */
    approvalId?: string;
    /** 失败分类 */
    failureCategory?: FailureCategory;
    /** 错误信息 */
    errorMessage?: string;
    /** 当前重试次数 */
    currentRetryCount?: number;
    /** 最大重试次数 */
    maxRetryCount?: number;
    /** 会话 ID */
    sessionId?: string;
    /** 元数据 */
    metadata?: Record<string, any>;
}
/**
 * 恢复执行器接口
 */
export interface IRecoveryExecutor {
    /**
     * 评估恢复决策
     */
    evaluateRecovery(context: RecoveryContext): Promise<RecoveryDecision>;
    /**
     * 重放任务
     */
    replayTask(taskId: string, scope?: ReplayScope): Promise<ReplayResult>;
    /**
     * 恢复任务
     */
    resumeTask(taskId: string): Promise<ReplayResult>;
    /**
     * 重放审批
     */
    replayApproval(approvalId: string): Promise<ReplayResult>;
    /**
     * 构建恢复计划
     */
    buildRecoveryPlan(failure: FailureCategory, context: RecoveryContext): Promise<RecoveryPlan>;
}
/**
 * 恢复策略配置
 */
export interface RecoveryStrategyConfig {
    /** 默认最大重试次数 */
    defaultMaxRetries?: number;
    /** 默认退避时间（毫秒） */
    defaultBackoffMs?: number;
    /** 退避乘数 */
    backoffMultiplier?: number;
    /** 最大退避时间（毫秒） */
    maxBackoffMs?: number;
    /** 是否启用恢复循环保护 */
    enableLoopGuard?: boolean;
    /** 恢复冷却时间（毫秒） */
    recoveryCooldownMs?: number;
}
export declare class RecoveryReplayExecutor implements IRecoveryExecutor {
    private config;
    private recoveryTracking;
    constructor(config?: RecoveryStrategyConfig);
    /**
     * 评估恢复决策
     */
    evaluateRecovery(context: RecoveryContext): Promise<RecoveryDecision>;
    /**
     * 评估超时恢复
     */
    private evaluateTimeoutRecovery;
    /**
     * 评估权限拒绝恢复
     */
    private evaluatePermissionDeniedRecovery;
    /**
     * 评估审批拒绝恢复
     */
    private evaluateApprovalDeniedRecovery;
    /**
     * 评估审批待定恢复
     */
    private evaluateApprovalPendingRecovery;
    /**
     * 评估资源不可用恢复
     */
    private evaluateResourceUnavailableRecovery;
    /**
     * 评估验证失败恢复
     */
    private evaluateValidationFailedRecovery;
    /**
     * 评估瞬时错误恢复
     */
    private evaluateTransientErrorRecovery;
    /**
     * 计算退避时间
     */
    private calculateBackoff;
    /**
     * 重放任务
     */
    replayTask(taskId: string, scope?: ReplayScope): Promise<ReplayResult>;
    /**
     * 恢复任务
     */
    resumeTask(taskId: string): Promise<ReplayResult>;
    /**
     * 重放审批
     */
    replayApproval(approvalId: string): Promise<ReplayResult>;
    /**
     * 构建恢复计划
     */
    buildRecoveryPlan(failure: FailureCategory, context: RecoveryContext): Promise<RecoveryPlan>;
    /**
     * 更新恢复追踪
     */
    private updateRecoveryTracking;
    /**
     * 清除恢复追踪
     */
    clearRecoveryTracking(taskId?: string): void;
}
/**
 * 创建恢复重放执行器
 */
export declare function createRecoveryReplayExecutor(config?: RecoveryStrategyConfig): RecoveryReplayExecutor;
/**
 * 快速评估恢复决策
 */
export declare function evaluateRecovery(context: RecoveryContext, config?: RecoveryStrategyConfig): Promise<RecoveryDecision>;
