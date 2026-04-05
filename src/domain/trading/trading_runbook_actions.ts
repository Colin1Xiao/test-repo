/**
 * Trading Runbook Actions
 * Phase 2D-1B - 交易域 Runbook 操作
 * 
 * 职责：
 * - 定义交易域 Runbook 操作
 * - 实现 Acknowledge / Escalate / Recovery / Rollback 等操作
 * - 提供操作执行接口
 */

import type { TradingRunbookAction, TradingSeverity } from './trading_types';

// ============================================================================
// 类型定义
// ============================================================================

export type RunbookActionType =
  | 'acknowledge'
  | 'rollback'
  | 'pause'
  | 'escalate'
  | 'replay'
  | 'recovery'
  | 'request_recovery'
  | 'pause_rollout'
  | 'rollback_hint'
  | 'release_hold'
  | 'risk_override';

export interface RunbookActionResult {
  success: boolean;
  actionId: string;
  message: string;
  metadata?: Record<string, any>;
}

// 判别联合类型 - 每个 action 只包含其需要的字段
export type RunbookAction =
  | { type: 'acknowledge'; target: { type: string; id: string } }
  | { type: 'rollback'; target: { type: string; id: string } }
  | { type: 'pause'; target: { type: string; id: string } }
  | { type: 'escalate'; target: { type: string; id: string }; parameters?: { escalateTo?: string; reason?: string } }
  | { type: 'replay'; target: { type: string; id: string } }
  | { type: 'recovery'; target: { type: string; id: string } }
  | { type: 'request_recovery'; target: { type: string; id: string }; parameters?: { recoveryType?: string; targetSystem?: string } }
  | { type: 'pause_rollout'; target: { type: string; id: string }; parameters?: { reason?: string } }
  | { type: 'rollback_hint'; target: { type: string; id: string } }
  | { type: 'release_hold'; target: { type: string; id: string } }
  | { type: 'risk_override'; target: { type: string; id: string }; parameters?: { overrideType?: string; justification?: string } };

// ============================================================================
// Runbook Actions Registry
// ============================================================================

export class TradingRunbookActions {
  private actions: Map<string, TradingRunbookAction> = new Map();

  constructor() {}

  /**
   * 创建 Runbook 操作
   */
  createAction(
    type: RunbookActionType,
    target: { type: string; id: string },
    parameters?: Record<string, any>
  ): TradingRunbookAction {
    const actionId = `runbook_${type}_${Date.now()}`;

    const action: TradingRunbookAction = {
      id: actionId,
      type,
      status: 'pending',
      createdAt: Date.now(),
      target,
      parameters,
    };

    this.actions.set(actionId, action);
    return action;
  }

  /**
   * 执行 Runbook 操作
   */
  async executeAction(
    actionId: string,
    executedBy?: string
  ): Promise<RunbookActionResult> {
    const action = this.actions.get(actionId);
    if (!action) {
      return {
        success: false,
        actionId,
        message: 'Action not found',
      };
    }

    // 更新状态
    action.status = 'executing';
    action.executedBy = executedBy;
    action.executedAt = Date.now();

    let result: RunbookActionResult;

    // 使用判别联合进行类型缩窄
    const actionType = action.type as RunbookActionType;
    
    switch (actionType) {
      case 'acknowledge':
        result = await this.executeAcknowledge(action);
        break;
      case 'rollback':
        result = await this.executeRollback(action);
        break;
      case 'pause':
        result = await this.executePause(action);
        break;
      case 'escalate':
        result = await this.executeEscalate(action);
        break;
      case 'replay':
        result = await this.executeReplay(action);
        break;
      case 'recovery':
        result = await this.executeRecovery(action);
        break;
      case 'request_recovery':
        result = await this.executeRequestRecovery(action);
        break;
      case 'pause_rollout':
        result = await this.executePauseRollout(action);
        break;
      case 'rollback_hint':
        result = await this.executeRollbackHint(action);
        break;
      case 'release_hold':
        result = await this.executeReleaseHold(action);
        break;
      case 'risk_override':
        result = await this.executeRiskOverride(action);
        break;
      default:
        // 运行时保护
        result = {
          success: false,
          actionId,
          message: `Unknown action type: ${actionType}`,
        };
    }

    // 更新状态
    action.status = result.success ? 'completed' : 'failed';
    action.result = {
      success: result.success,
      message: result.message,
      metadata: result.metadata,
    };

    return result;
  }

  /**
   * 获取操作历史
   */
  getActionHistory(targetId?: string): TradingRunbookAction[] {
    const allActions = Array.from(this.actions.values());
    if (!targetId) {
      return allActions.sort((a, b) => b.createdAt - a.createdAt);
    }
    return allActions
      .filter((a) => a.target.id === targetId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  // ============================================================================
  // 操作执行方法
  // ============================================================================

  /**
   * 执行 Acknowledge
   */
  /**
   * 执行 Acknowledge
   */
  private async executeAcknowledge(
    action: TradingRunbookAction
  ): Promise<RunbookActionResult> {
    return {
      success: true,
      actionId: action.id,
      message: `Acknowledged ${action.target.type} ${action.target.id}`,
      metadata: {
        acknowledgedAt: Date.now(),
        acknowledgedBy: action.executedBy,
      },
    };
  }

  /**
   * 执行 Rollback
   */
  private async executeRollback(
    action: TradingRunbookAction
  ): Promise<RunbookActionResult> {
    return {
      success: true,
      actionId: action.id,
      message: `Rolled back ${action.target.type} ${action.target.id}`,
      metadata: { rolledBackAt: Date.now() },
    };
  }

  /**
   * 执行 Pause
   */
  private async executePause(
    action: TradingRunbookAction
  ): Promise<RunbookActionResult> {
    return {
      success: true,
      actionId: action.id,
      message: `Paused ${action.target.type} ${action.target.id}`,
      metadata: { pausedAt: Date.now() },
    };
  }

  /**
   * 执行 Replay
   */
  private async executeReplay(
    action: TradingRunbookAction
  ): Promise<RunbookActionResult> {
    return {
      success: true,
      actionId: action.id,
      message: `Replayed ${action.target.type} ${action.target.id}`,
      metadata: { replayedAt: Date.now() },
    };
  }

  /**
   * 执行 Recovery
   */
  private async executeRecovery(
    action: TradingRunbookAction
  ): Promise<RunbookActionResult> {
    return {
      success: true,
      actionId: action.id,
      message: `Recovered ${action.target.type} ${action.target.id}`,
      metadata: { recoveredAt: Date.now() },
    };
  }

  /**
   * 执行 Escalate
   */
  private async executeEscalate(
    action: TradingRunbookAction
  ): Promise<RunbookActionResult> {
    const escalateTo = action.parameters?.escalateTo || 'senior_operator';
    const reason = action.parameters?.reason || 'Requires senior attention';

    return {
      success: true,
      actionId: action.id,
      message: `Escalated ${action.target.type} ${action.target.id} to ${escalateTo}`,
      metadata: {
        escalatedTo: escalateTo,
        reason,
        escalatedAt: Date.now(),
      },
    };
  }

  /**
   * 执行 Request Recovery
   */
  private async executeRequestRecovery(
    action: TradingRunbookAction
  ): Promise<RunbookActionResult> {
    const recoveryType = action.parameters?.recoveryType || 'auto';
    const targetSystem = action.parameters?.targetSystem || 'unknown';

    return {
      success: true,
      actionId: action.id,
      message: `Requested ${recoveryType} recovery for ${targetSystem}`,
      metadata: {
        recoveryType,
        targetSystem,
        requestedAt: Date.now(),
        estimatedRecoveryTime: '5-10 minutes',
      },
    };
  }

  /**
   * 执行 Pause Rollout
   */
  private async executePauseRollout(
    action: TradingRunbookAction
  ): Promise<RunbookActionResult> {
    const releaseId = action.target.id;
    const reason = action.parameters?.reason || 'Safety pause';

    return {
      success: true,
      actionId: action.id,
      message: `Paused rollout for release ${releaseId}`,
      metadata: {
        releaseId,
        reason,
        pausedAt: Date.now(),
        canResume: true,
      },
    };
  }

  /**
   * 执行 Rollback Hint
   */
  private async executeRollbackHint(
    action: TradingRunbookAction
  ): Promise<RunbookActionResult> {
    const releaseId = action.target.id;

    // 生成回滚建议
    const rollbackSteps = [
      'Stop current deployment',
      'Revert to previous version',
      'Verify system health',
      'Notify stakeholders',
    ];

    return {
      success: true,
      actionId: action.id,
      message: `Generated rollback hint for release ${releaseId}`,
      metadata: {
        releaseId,
        steps: rollbackSteps,
        estimatedTime: '10-15 minutes',
        riskLevel: 'medium' as TradingSeverity,
      },
    };
  }

  /**
   * 执行 Release Hold
   */
  private async executeReleaseHold(
    action: TradingRunbookAction
  ): Promise<RunbookActionResult> {
    const releaseId = action.target.id;
    const holdReason = action.parameters?.holdReason || 'Risk review';

    return {
      success: true,
      actionId: action.id,
      message: `Placed hold on release ${releaseId}`,
      metadata: {
        releaseId,
        holdReason,
        holdUntil: action.parameters?.holdUntil,
        requiresApproval: true,
      },
    };
  }

  /**
   * 执行 Risk Override
   */
  private async executeRiskOverride(
    action: TradingRunbookAction
  ): Promise<RunbookActionResult> {
    const overrideType = action.parameters?.overrideType || 'temporary';
    const justification = action.parameters?.justification || 'Emergency deployment';

    return {
      success: true,
      actionId: action.id,
      message: `Applied ${overrideType} risk override`,
      metadata: {
        overrideType,
        justification,
        appliedAt: Date.now(),
        expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
        requiresPostActionReview: true,
      },
    };
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createTradingRunbookActions(): TradingRunbookActions {
  return new TradingRunbookActions();
}

// ============================================================================
// 便利函数
// ============================================================================

/**
 * 创建 Acknowledge 操作
 */
export function createAcknowledgeAction(
  targetType: string,
  targetId: string,
  executedBy?: string
): { type: RunbookActionType; target: { type: string; id: string } } {
  return {
    type: 'acknowledge',
    target: { type: targetType, id: targetId },
  };
}

/**
 * 创建 Escalate 操作
 */
export function createEscalateAction(
  targetType: string,
  targetId: string,
  escalateTo?: string,
  reason?: string
): { type: RunbookActionType; target: { type: string; id: string }; parameters: Record<string, any> } {
  return {
    type: 'escalate',
    target: { type: targetType, id: targetId },
    parameters: { escalateTo, reason },
  };
}

/**
 * 创建 Recovery 操作
 */
export function createRecoveryAction(
  targetType: string,
  targetId: string,
  recoveryType?: string,
  targetSystem?: string
): { type: RunbookActionType; target: { type: string; id: string }; parameters: Record<string, any> } {
  return {
    type: 'request_recovery',
    target: { type: targetType, id: targetId },
    parameters: { recoveryType, targetSystem },
  };
}
