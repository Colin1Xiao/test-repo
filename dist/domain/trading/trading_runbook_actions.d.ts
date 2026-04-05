/**
 * Trading Runbook Actions
 * Phase 2D-1B - 交易域 Runbook 操作
 *
 * 职责：
 * - 定义交易域 Runbook 操作
 * - 实现 Acknowledge / Escalate / Recovery / Rollback 等操作
 * - 提供操作执行接口
 */
import type { TradingRunbookAction } from './trading_types';
export type RunbookActionType = 'acknowledge' | 'rollback' | 'pause' | 'escalate' | 'replay' | 'recovery' | 'request_recovery' | 'pause_rollout' | 'rollback_hint' | 'release_hold' | 'risk_override';
export interface RunbookActionResult {
    success: boolean;
    actionId: string;
    message: string;
    metadata?: Record<string, any>;
}
export type RunbookAction = {
    type: 'acknowledge';
    target: {
        type: string;
        id: string;
    };
} | {
    type: 'rollback';
    target: {
        type: string;
        id: string;
    };
} | {
    type: 'pause';
    target: {
        type: string;
        id: string;
    };
} | {
    type: 'escalate';
    target: {
        type: string;
        id: string;
    };
    parameters?: {
        escalateTo?: string;
        reason?: string;
    };
} | {
    type: 'replay';
    target: {
        type: string;
        id: string;
    };
} | {
    type: 'recovery';
    target: {
        type: string;
        id: string;
    };
} | {
    type: 'request_recovery';
    target: {
        type: string;
        id: string;
    };
    parameters?: {
        recoveryType?: string;
        targetSystem?: string;
    };
} | {
    type: 'pause_rollout';
    target: {
        type: string;
        id: string;
    };
    parameters?: {
        reason?: string;
    };
} | {
    type: 'rollback_hint';
    target: {
        type: string;
        id: string;
    };
} | {
    type: 'release_hold';
    target: {
        type: string;
        id: string;
    };
} | {
    type: 'risk_override';
    target: {
        type: string;
        id: string;
    };
    parameters?: {
        overrideType?: string;
        justification?: string;
    };
};
export declare class TradingRunbookActions {
    private actions;
    constructor();
    /**
     * 创建 Runbook 操作
     */
    createAction(type: RunbookActionType, target: {
        type: string;
        id: string;
    }, parameters?: Record<string, any>): TradingRunbookAction;
    /**
     * 执行 Runbook 操作
     */
    executeAction(actionId: string, executedBy?: string): Promise<RunbookActionResult>;
    /**
     * 获取操作历史
     */
    getActionHistory(targetId?: string): TradingRunbookAction[];
    /**
     * 执行 Acknowledge
     */
    /**
     * 执行 Acknowledge
     */
    private executeAcknowledge;
    /**
     * 执行 Rollback
     */
    private executeRollback;
    /**
     * 执行 Pause
     */
    private executePause;
    /**
     * 执行 Replay
     */
    private executeReplay;
    /**
     * 执行 Recovery
     */
    private executeRecovery;
    /**
     * 执行 Escalate
     */
    private executeEscalate;
    /**
     * 执行 Request Recovery
     */
    private executeRequestRecovery;
    /**
     * 执行 Pause Rollout
     */
    private executePauseRollout;
    /**
     * 执行 Rollback Hint
     */
    private executeRollbackHint;
    /**
     * 执行 Release Hold
     */
    private executeReleaseHold;
    /**
     * 执行 Risk Override
     */
    private executeRiskOverride;
}
export declare function createTradingRunbookActions(): TradingRunbookActions;
/**
 * 创建 Acknowledge 操作
 */
export declare function createAcknowledgeAction(targetType: string, targetId: string, executedBy?: string): {
    type: RunbookActionType;
    target: {
        type: string;
        id: string;
    };
};
/**
 * 创建 Escalate 操作
 */
export declare function createEscalateAction(targetType: string, targetId: string, escalateTo?: string, reason?: string): {
    type: RunbookActionType;
    target: {
        type: string;
        id: string;
    };
    parameters: Record<string, any>;
};
/**
 * 创建 Recovery 操作
 */
export declare function createRecoveryAction(targetType: string, targetId: string, recoveryType?: string, targetSystem?: string): {
    type: RunbookActionType;
    target: {
        type: string;
        id: string;
    };
    parameters: Record<string, any>;
};
