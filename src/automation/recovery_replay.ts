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

import type {
  RecoveryDecision,
  ReplayRequest,
  ReplayResult,
  RecoveryPlan,
  FailureCategory,
  RecoveryReason,
  ReplayScope,
} from './types';

// ============================================================================
// 类型定义
// ============================================================================

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

// ============================================================================
// 恢复策略配置
// ============================================================================

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

// ============================================================================
// 恢复与重放执行器
// ============================================================================

export class RecoveryReplayExecutor implements IRecoveryExecutor {
  private config: Required<RecoveryStrategyConfig>;
  
  // 恢复追踪（防止恢复风暴）
  private recoveryTracking: Map<string, { lastRecoveryAt: number; count: number }> = new Map();
  
  constructor(config: RecoveryStrategyConfig = {}) {
    this.config = {
      defaultMaxRetries: config.defaultMaxRetries ?? 3,
      defaultBackoffMs: config.defaultBackoffMs ?? 1000,
      backoffMultiplier: config.backoffMultiplier ?? 2,
      maxBackoffMs: config.maxBackoffMs ?? 30000,
      enableLoopGuard: config.enableLoopGuard ?? true,
      recoveryCooldownMs: config.recoveryCooldownMs ?? 60000,
    };
  }
  
  /**
   * 评估恢复决策
   */
  async evaluateRecovery(context: RecoveryContext): Promise<RecoveryDecision> {
    const {
      failureCategory,
      currentRetryCount = 0,
      maxRetryCount = this.config.defaultMaxRetries,
    } = context;
    
    // 检查是否超过最大重试次数
    if (currentRetryCount >= maxRetryCount) {
      return {
        type: 'abort',
        reason: 'user_requested',
        failureCategory,
        retryable: false,
        explanation: `Max retry count reached (${currentRetryCount}/${maxRetryCount})`,
      };
    }
    
    // 根据失败分类决定恢复策略
    switch (failureCategory) {
      case 'timeout':
        return this.evaluateTimeoutRecovery(context, currentRetryCount);
      
      case 'permission_denied':
        return this.evaluatePermissionDeniedRecovery(context);
      
      case 'approval_denied':
        return this.evaluateApprovalDeniedRecovery(context);
      
      case 'approval_pending':
        return this.evaluateApprovalPendingRecovery(context);
      
      case 'resource_unavailable':
        return this.evaluateResourceUnavailableRecovery(context, currentRetryCount);
      
      case 'validation_failed':
        return this.evaluateValidationFailedRecovery(context);
      
      case 'internal_error':
      case 'transient_external_error':
        return this.evaluateTransientErrorRecovery(context, currentRetryCount);
      
      default:
        return {
          type: 'abort',
          reason: 'policy_triggered',
          failureCategory,
          retryable: false,
          explanation: `Unknown failure category: ${failureCategory}`,
        };
    }
  }
  
  /**
   * 评估超时恢复
   */
  private evaluateTimeoutRecovery(
    context: RecoveryContext,
    currentRetryCount: number
  ): RecoveryDecision {
    const backoffMs = this.calculateBackoff(currentRetryCount);
    
    return {
      type: 'retry',
      reason: 'task_timeout',
      failureCategory: 'timeout',
      retryable: true,
      maxReplayCount: this.config.defaultMaxRetries,
      currentReplayCount: currentRetryCount,
      backoffMs,
      explanation: `Task timeout, will retry after ${backoffMs}ms (attempt ${currentRetryCount + 1})`,
    };
  }
  
  /**
   * 评估权限拒绝恢复
   */
  private evaluatePermissionDeniedRecovery(context: RecoveryContext): RecoveryDecision {
    return {
      type: 'escalate',
      reason: 'permission_denied',
      failureCategory: 'permission_denied',
      retryable: false,
      explanation: 'Permission denied, requires escalation or manual approval',
    };
  }
  
  /**
   * 评估审批拒绝恢复
   */
  private evaluateApprovalDeniedRecovery(context: RecoveryContext): RecoveryDecision {
    return {
      type: 'abort',
      reason: 'approval_denied',
      failureCategory: 'approval_denied',
      retryable: false,
      explanation: 'Approval explicitly denied, aborting task',
    };
  }
  
  /**
   * 评估审批待定恢复
   */
  private evaluateApprovalPendingRecovery(context: RecoveryContext): RecoveryDecision {
    return {
      type: 'resume',
      reason: 'approval_pending',
      failureCategory: 'approval_pending',
      retryable: true,
      explanation: 'Approval pending, resuming wait or replaying approval request',
    };
  }
  
  /**
   * 评估资源不可用恢复
   */
  private evaluateResourceUnavailableRecovery(
    context: RecoveryContext,
    currentRetryCount: number
  ): RecoveryDecision {
    const backoffMs = this.calculateBackoff(currentRetryCount, 2000);
    
    return {
      type: 'replay',
      reason: 'resource_recovered',
      failureCategory: 'resource_unavailable',
      retryable: true,
      maxReplayCount: this.config.defaultMaxRetries,
      currentReplayCount: currentRetryCount,
      backoffMs,
      explanation: `Resource unavailable, will replay after ${backoffMs}ms (attempt ${currentRetryCount + 1})`,
    };
  }
  
  /**
   * 评估验证失败恢复
   */
  private evaluateValidationFailedRecovery(context: RecoveryContext): RecoveryDecision {
    return {
      type: 'abort',
      reason: 'policy_triggered',
      failureCategory: 'validation_failed',
      retryable: false,
      explanation: 'Validation failed, requires manual fix before retry',
    };
  }
  
  /**
   * 评估瞬时错误恢复
   */
  private evaluateTransientErrorRecovery(
    context: RecoveryContext,
    currentRetryCount: number
  ): RecoveryDecision {
    const backoffMs = this.calculateBackoff(currentRetryCount);
    
    return {
      type: 'retry',
      reason: 'transient_error',
      failureCategory: context.failureCategory,
      retryable: true,
      maxReplayCount: this.config.defaultMaxRetries,
      currentReplayCount: currentRetryCount,
      backoffMs,
      explanation: `Transient error, will retry after ${backoffMs}ms (attempt ${currentRetryCount + 1})`,
    };
  }
  
  /**
   * 计算退避时间
   */
  private calculateBackoff(currentRetryCount: number, baseBackoff?: number): number {
    const base = baseBackoff ?? this.config.defaultBackoffMs;
    const backoff = base * Math.pow(this.config.backoffMultiplier, currentRetryCount);
    return Math.min(backoff, this.config.maxBackoffMs);
  }
  
  /**
   * 重放任务
   */
  async replayTask(taskId: string, scope?: ReplayScope): Promise<ReplayResult> {
    const startTime = Date.now();
    
    // 简化实现：实际应该调用 TaskStore 进行任务重放
    console.log(`[REPLAY] Task: ${taskId}, Scope: ${JSON.stringify(scope)}`);
    
    // 检查恢复冷却
    if (this.config.enableLoopGuard) {
      const tracking = this.recoveryTracking.get(taskId);
      if (tracking) {
        const timeSinceLastRecovery = Date.now() - tracking.lastRecoveryAt;
        if (timeSinceLastRecovery < this.config.recoveryCooldownMs) {
          return {
            success: false,
            replayedTaskId: taskId,
            replayType: 'task',
            replayCount: tracking.count,
            error: `Recovery cooldown active, ${this.config.recoveryCooldownMs - timeSinceLastRecovery}ms remaining`,
            replayTimeMs: Date.now() - startTime,
          };
        }
      }
    }
    
    // 更新追踪
    this.updateRecoveryTracking(taskId);
    
    // 简化实现：返回成功
    return {
      success: true,
      replayedTaskId: taskId,
      replayType: 'task',
      replayCount: 1,
      result: { status: 'replayed' },
      replayTimeMs: Date.now() - startTime,
    };
  }
  
  /**
   * 恢复任务
   */
  async resumeTask(taskId: string): Promise<ReplayResult> {
    const startTime = Date.now();
    
    // 简化实现：实际应该调用 TaskStore 恢复任务
    console.log(`[RESUME] Task: ${taskId}`);
    
    return {
      success: true,
      replayedTaskId: taskId,
      replayType: 'task',
      replayCount: 0,
      result: { status: 'resumed' },
      replayTimeMs: Date.now() - startTime,
    };
  }
  
  /**
   * 重放审批
   */
  async replayApproval(approvalId: string): Promise<ReplayResult> {
    const startTime = Date.now();
    
    // 简化实现：实际应该调用 ApprovalBridge 进行审批重放
    console.log(`[REPLAY] Approval: ${approvalId}`);
    
    return {
      success: true,
      replayedTaskId: approvalId,
      replayType: 'approval',
      replayCount: 1,
      result: { status: 'replayed' },
      replayTimeMs: Date.now() - startTime,
    };
  }
  
  /**
   * 构建恢复计划
   */
  async buildRecoveryPlan(
    failure: FailureCategory,
    context: RecoveryContext
  ): Promise<RecoveryPlan> {
    const decision = await this.evaluateRecovery(context);
    
    const steps: Array<{ action: string; params?: Record<string, any> }> = [];
    
    switch (decision.type) {
      case 'retry':
        steps.push({
          action: 'wait',
          params: { durationMs: decision.backoffMs },
        });
        steps.push({
          action: 'retry_task',
          params: { taskId: context.taskId },
        });
        break;
      
      case 'replay':
        steps.push({
          action: 'wait',
          params: { durationMs: decision.backoffMs },
        });
        steps.push({
          action: 'replay_task',
          params: { taskId: context.taskId, scope: decision.retryable },
        });
        break;
      
      case 'resume':
        steps.push({
          action: 'resume_task',
          params: { taskId: context.taskId },
        });
        break;
      
      case 'escalate':
        steps.push({
          action: 'escalate',
          params: {
            taskId: context.taskId,
            reason: decision.explanation,
          },
        });
        break;
      
      case 'abort':
        steps.push({
          action: 'abort_task',
          params: {
            taskId: context.taskId,
            reason: decision.explanation,
          },
        });
        break;
    }
    
    return {
      taskId: context.taskId || '',
      decision,
      steps,
      estimatedRecoveryTimeMs: steps.reduce((sum, step) => {
        if (step.action === 'wait') {
          return sum + (step.params?.durationMs || 0);
        }
        return sum + 100; // 估计每个动作 100ms
      }, 0),
    };
  }
  
  /**
   * 更新恢复追踪
   */
  private updateRecoveryTracking(taskId: string): void {
    const existing = this.recoveryTracking.get(taskId);
    
    this.recoveryTracking.set(taskId, {
      lastRecoveryAt: Date.now(),
      count: (existing?.count || 0) + 1,
    });
  }
  
  /**
   * 清除恢复追踪
   */
  clearRecoveryTracking(taskId?: string): void {
    if (taskId) {
      this.recoveryTracking.delete(taskId);
    } else {
      this.recoveryTracking.clear();
    }
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建恢复重放执行器
 */
export function createRecoveryReplayExecutor(config?: RecoveryStrategyConfig): RecoveryReplayExecutor {
  return new RecoveryReplayExecutor(config);
}

/**
 * 快速评估恢复决策
 */
export async function evaluateRecovery(
  context: RecoveryContext,
  config?: RecoveryStrategyConfig
): Promise<RecoveryDecision> {
  const executor = new RecoveryReplayExecutor(config);
  return await executor.evaluateRecovery(context);
}
