"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecoveryReplayExecutor = void 0;
exports.createRecoveryReplayExecutor = createRecoveryReplayExecutor;
exports.evaluateRecovery = evaluateRecovery;
// ============================================================================
// 恢复与重放执行器
// ============================================================================
class RecoveryReplayExecutor {
    constructor(config = {}) {
        // 恢复追踪（防止恢复风暴）
        this.recoveryTracking = new Map();
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
    async evaluateRecovery(context) {
        const { failureCategory, currentRetryCount = 0, maxRetryCount = this.config.defaultMaxRetries, } = context;
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
    evaluateTimeoutRecovery(context, currentRetryCount) {
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
    evaluatePermissionDeniedRecovery(context) {
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
    evaluateApprovalDeniedRecovery(context) {
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
    evaluateApprovalPendingRecovery(context) {
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
    evaluateResourceUnavailableRecovery(context, currentRetryCount) {
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
    evaluateValidationFailedRecovery(context) {
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
    evaluateTransientErrorRecovery(context, currentRetryCount) {
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
    calculateBackoff(currentRetryCount, baseBackoff) {
        const base = baseBackoff ?? this.config.defaultBackoffMs;
        const backoff = base * Math.pow(this.config.backoffMultiplier, currentRetryCount);
        return Math.min(backoff, this.config.maxBackoffMs);
    }
    /**
     * 重放任务
     */
    async replayTask(taskId, scope) {
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
    async resumeTask(taskId) {
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
    async replayApproval(approvalId) {
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
    async buildRecoveryPlan(failure, context) {
        const decision = await this.evaluateRecovery(context);
        const steps = [];
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
    updateRecoveryTracking(taskId) {
        const existing = this.recoveryTracking.get(taskId);
        this.recoveryTracking.set(taskId, {
            lastRecoveryAt: Date.now(),
            count: (existing?.count || 0) + 1,
        });
    }
    /**
     * 清除恢复追踪
     */
    clearRecoveryTracking(taskId) {
        if (taskId) {
            this.recoveryTracking.delete(taskId);
        }
        else {
            this.recoveryTracking.clear();
        }
    }
}
exports.RecoveryReplayExecutor = RecoveryReplayExecutor;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建恢复重放执行器
 */
function createRecoveryReplayExecutor(config) {
    return new RecoveryReplayExecutor(config);
}
/**
 * 快速评估恢复决策
 */
async function evaluateRecovery(context, config) {
    const executor = new RecoveryReplayExecutor(config);
    return await executor.evaluateRecovery(context);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVjb3ZlcnlfcmVwbGF5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2F1dG9tYXRpb24vcmVjb3ZlcnlfcmVwbGF5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7Ozs7O0dBWUc7OztBQXdlSCxvRUFFQztBQUtELDRDQU1DO0FBL1lELCtFQUErRTtBQUMvRSxXQUFXO0FBQ1gsK0VBQStFO0FBRS9FLE1BQWEsc0JBQXNCO0lBTWpDLFlBQVksU0FBaUMsRUFBRTtRQUgvQyxlQUFlO1FBQ1AscUJBQWdCLEdBQTJELElBQUksR0FBRyxFQUFFLENBQUM7UUFHM0YsSUFBSSxDQUFDLE1BQU0sR0FBRztZQUNaLGlCQUFpQixFQUFFLE1BQU0sQ0FBQyxpQkFBaUIsSUFBSSxDQUFDO1lBQ2hELGdCQUFnQixFQUFFLE1BQU0sQ0FBQyxnQkFBZ0IsSUFBSSxJQUFJO1lBQ2pELGlCQUFpQixFQUFFLE1BQU0sQ0FBQyxpQkFBaUIsSUFBSSxDQUFDO1lBQ2hELFlBQVksRUFBRSxNQUFNLENBQUMsWUFBWSxJQUFJLEtBQUs7WUFDMUMsZUFBZSxFQUFFLE1BQU0sQ0FBQyxlQUFlLElBQUksSUFBSTtZQUMvQyxrQkFBa0IsRUFBRSxNQUFNLENBQUMsa0JBQWtCLElBQUksS0FBSztTQUN2RCxDQUFDO0lBQ0osQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLGdCQUFnQixDQUFDLE9BQXdCO1FBQzdDLE1BQU0sRUFDSixlQUFlLEVBQ2YsaUJBQWlCLEdBQUcsQ0FBQyxFQUNyQixhQUFhLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxpQkFBaUIsR0FDOUMsR0FBRyxPQUFPLENBQUM7UUFFWixlQUFlO1FBQ2YsSUFBSSxpQkFBaUIsSUFBSSxhQUFhLEVBQUUsQ0FBQztZQUN2QyxPQUFPO2dCQUNMLElBQUksRUFBRSxPQUFPO2dCQUNiLE1BQU0sRUFBRSxnQkFBZ0I7Z0JBQ3hCLGVBQWU7Z0JBQ2YsU0FBUyxFQUFFLEtBQUs7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LENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRTtZQUNoQyxjQUFjLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTtZQUMxQixLQUFLLEVBQUUsQ0FBQyxRQUFRLEVBQUUsS0FBSyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUM7U0FDbEMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOztPQUVHO0lBQ0gscUJBQXFCLENBQUMsTUFBZTtRQUNuQyxJQUFJLE1BQU0sRUFBRSxDQUFDO1lBQ1gsSUFBSSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN2QyxDQUFDO2FBQU0sQ0FBQztZQUNOLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNoQyxDQUFDO0lBQ0gsQ0FBQztDQUNGO0FBclhELHdEQXFYQztBQUVELCtFQUErRTtBQUMvRSxPQUFPO0FBQ1AsK0VBQStFO0FBRS9FOztHQUVHO0FBQ0gsU0FBZ0IsNEJBQTRCLENBQUMsTUFBK0I7SUFDMUUsT0FBTyxJQUFJLHNCQUFzQixDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQzVDLENBQUM7QUFFRDs7R0FFRztBQUNJLEtBQUssVUFBVSxnQkFBZ0IsQ0FDcEMsT0FBd0IsRUFDeEIsTUFBK0I7SUFFL0IsTUFBTSxRQUFRLEdBQUcsSUFBSSxzQkFBc0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNwRCxPQUFPLE1BQU0sUUFBUSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQ2xELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFJlY292ZXJ5IFJlcGxheSAtIOaBouWkjeS4jumHjeaUvlxuICogXG4gKiDogYzotKPvvJpcbiAqIDEuIOagueaNriBmYWlsdXJlIC8gaW50ZXJydXB0aW9uIC8gYXBwcm92YWwg54q25oCB5Yaz5a6a5piv5ZCm5oGi5aSNXG4gKiAyLiDmlK/mjIEgdGFzayByZXBsYXlcbiAqIDMuIOaUr+aMgSBhcHByb3ZhbCByZXBsYXlcbiAqIDQuIOaUr+aMgSByZXN1bWUgLyByZXRyeSAvIGFib3J0IOWIhua1gVxuICogNS4g5aSN55SoIFRhc2tTdG9yZSAvIEFwcHJvdmFsQnJpZGdlIOeahOeOsOacieiusOW9lVxuICogXG4gKiBAdmVyc2lvbiB2MC4xLjBcbiAqIEBkYXRlIDIwMjYtMDQtMDNcbiAqL1xuXG5pbXBvcnQgdHlwZSB7XG4gIFJlY292ZXJ5RGVjaXNpb24sXG4gIFJlcGxheVJlcXVlc3QsXG4gIFJlcGxheVJlc3VsdCxcbiAgUmVjb3ZlcnlQbGFuLFxuICBGYWlsdXJlQ2F0ZWdvcnksXG4gIFJlY292ZXJ5UmVhc29uLFxuICBSZXBsYXlTY29wZSxcbn0gZnJvbSAnLi90eXBlcyc7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOexu+Wei+WumuS5iVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIOaBouWkjeivhOS8sOS4iuS4i+aWh1xuICovXG5leHBvcnQgaW50ZXJmYWNlIFJlY292ZXJ5Q29udGV4dCB7XG4gIC8qKiDku7vliqEgSUQgKi9cbiAgdGFza0lkPzogc3RyaW5nO1xuICBcbiAgLyoqIOWuoeaJuSBJRCAqL1xuICBhcHByb3ZhbElkPzogc3RyaW5nO1xuICBcbiAgLyoqIOWksei0peWIhuexuyAqL1xuICBmYWlsdXJlQ2F0ZWdvcnk/OiBGYWlsdXJlQ2F0ZWdvcnk7XG4gIFxuICAvKiog6ZSZ6K+v5L+h5oGvICovXG4gIGVycm9yTWVzc2FnZT86IHN0cmluZztcbiAgXG4gIC8qKiDlvZPliY3ph43or5XmrKHmlbAgKi9cbiAgY3VycmVudFJldHJ5Q291bnQ/OiBudW1iZXI7XG4gIFxuICAvKiog5pyA5aSn6YeN6K+V5qyh5pWwICovXG4gIG1heFJldHJ5Q291bnQ/OiBudW1iZXI7XG4gIFxuICAvKiog5Lya6K+dIElEICovXG4gIHNlc3Npb25JZD86IHN0cmluZztcbiAgXG4gIC8qKiDlhYPmlbDmja4gKi9cbiAgbWV0YWRhdGE/OiBSZWNvcmQ8c3RyaW5nLCBhbnk+O1xufVxuXG4vKipcbiAqIOaBouWkjeaJp+ihjOWZqOaOpeWPo1xuICovXG5leHBvcnQgaW50ZXJmYWNlIElSZWNvdmVyeUV4ZWN1dG9yIHtcbiAgLyoqXG4gICAqIOivhOS8sOaBouWkjeWGs+etllxuICAgKi9cbiAgZXZhbHVhdGVSZWNvdmVyeShjb250ZXh0OiBSZWNvdmVyeUNvbnRleHQpOiBQcm9taXNlPFJlY292ZXJ5RGVjaXNpb24+O1xuICBcbiAgLyoqXG4gICAqIOmHjeaUvuS7u+WKoVxuICAgKi9cbiAgcmVwbGF5VGFzayh0YXNrSWQ6IHN0cmluZywgc2NvcGU/OiBSZXBsYXlTY29wZSk6IFByb21pc2U8UmVwbGF5UmVzdWx0PjtcbiAgXG4gIC8qKlxuICAgKiDmgaLlpI3ku7vliqFcbiAgICovXG4gIHJlc3VtZVRhc2sodGFza0lkOiBzdHJpbmcpOiBQcm9taXNlPFJlcGxheVJlc3VsdD47XG4gIFxuICAvKipcbiAgICog6YeN5pS+5a6h5om5XG4gICAqL1xuICByZXBsYXlBcHByb3ZhbChhcHByb3ZhbElkOiBzdHJpbmcpOiBQcm9taXNlPFJlcGxheVJlc3VsdD47XG4gIFxuICAvKipcbiAgICog5p6E5bu65oGi5aSN6K6h5YiSXG4gICAqL1xuICBidWlsZFJlY292ZXJ5UGxhbihmYWlsdXJlOiBGYWlsdXJlQ2F0ZWdvcnksIGNvbnRleHQ6IFJlY292ZXJ5Q29udGV4dCk6IFByb21pc2U8UmVjb3ZlcnlQbGFuPjtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5oGi5aSN562W55Wl6YWN572uXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog5oGi5aSN562W55Wl6YWN572uXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUmVjb3ZlcnlTdHJhdGVneUNvbmZpZyB7XG4gIC8qKiDpu5jorqTmnIDlpKfph43or5XmrKHmlbAgKi9cbiAgZGVmYXVsdE1heFJldHJpZXM/OiBudW1iZXI7XG4gIFxuICAvKiog6buY6K6k6YCA6YG/5pe26Ze077yI5q+r56eS77yJICovXG4gIGRlZmF1bHRCYWNrb2ZmTXM/OiBudW1iZXI7XG4gIFxuICAvKiog6YCA6YG/5LmY5pWwICovXG4gIGJhY2tvZmZNdWx0aXBsaWVyPzogbnVtYmVyO1xuICBcbiAgLyoqIOacgOWkp+mAgOmBv+aXtumXtO+8iOavq+enku+8iSAqL1xuICBtYXhCYWNrb2ZmTXM/OiBudW1iZXI7XG4gIFxuICAvKiog5piv5ZCm5ZCv55So5oGi5aSN5b6q546v5L+d5oqkICovXG4gIGVuYWJsZUxvb3BHdWFyZD86IGJvb2xlYW47XG4gIFxuICAvKiog5oGi5aSN5Ya35Y205pe26Ze077yI5q+r56eS77yJICovXG4gIHJlY292ZXJ5Q29vbGRvd25Ncz86IG51bWJlcjtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5oGi5aSN5LiO6YeN5pS+5omn6KGM5ZmoXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBjbGFzcyBSZWNvdmVyeVJlcGxheUV4ZWN1dG9yIGltcGxlbWVudHMgSVJlY292ZXJ5RXhlY3V0b3Ige1xuICBwcml2YXRlIGNvbmZpZzogUmVxdWlyZWQ8UmVjb3ZlcnlTdHJhdGVneUNvbmZpZz47XG4gIFxuICAvLyDmgaLlpI3ov73ouKrvvIjpmLLmraLmgaLlpI3po47mmrTvvIlcbiAgcHJpdmF0ZSByZWNvdmVyeVRyYWNraW5nOiBNYXA8c3RyaW5nLCB7IGxhc3RSZWNvdmVyeUF0OiBudW1iZXI7IGNvdW50OiBudW1iZXIgfT4gPSBuZXcgTWFwKCk7XG4gIFxuICBjb25zdHJ1Y3Rvcihjb25maWc6IFJlY292ZXJ5U3RyYXRlZ3lDb25maWcgPSB7fSkge1xuICAgIHRoaXMuY29uZmlnID0ge1xuICAgICAgZGVmYXVsdE1heFJldHJpZXM6IGNvbmZpZy5kZWZhdWx0TWF4UmV0cmllcyA/PyAzLFxuICAgICAgZGVmYXVsdEJhY2tvZmZNczogY29uZmlnLmRlZmF1bHRCYWNrb2ZmTXMgPz8gMTAwMCxcbiAgICAgIGJhY2tvZmZNdWx0aXBsaWVyOiBjb25maWcuYmFja29mZk11bHRpcGxpZXIgPz8gMixcbiAgICAgIG1heEJhY2tvZmZNczogY29uZmlnLm1heEJhY2tvZmZNcyA/PyAzMDAwMCxcbiAgICAgIGVuYWJsZUxvb3BHdWFyZDogY29uZmlnLmVuYWJsZUxvb3BHdWFyZCA/PyB0cnVlLFxuICAgICAgcmVjb3ZlcnlDb29sZG93bk1zOiBjb25maWcucmVjb3ZlcnlDb29sZG93bk1zID8/IDYwMDAwLFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDor4TkvLDmgaLlpI3lhrPnrZZcbiAgICovXG4gIGFzeW5jIGV2YWx1YXRlUmVjb3ZlcnkoY29udGV4dDogUmVjb3ZlcnlDb250ZXh0KTogUHJvbWlzZTxSZWNvdmVyeURlY2lzaW9uPiB7XG4gICAgY29uc3Qge1xuICAgICAgZmFpbHVyZUNhdGVnb3J5LFxuICAgICAgY3VycmVudFJldHJ5Q291bnQgPSAwLFxuICAgICAgbWF4UmV0cnlDb3VudCA9IHRoaXMuY29uZmlnLmRlZmF1bHRNYXhSZXRyaWVzLFxuICAgIH0gPSBjb250ZXh0O1xuICAgIFxuICAgIC8vIOajgOafpeaYr+WQpui2hei/h+acgOWkp+mHjeivleasoeaVsFxuICAgIGlmIChjdXJyZW50UmV0cnlDb3VudCA+PSBtYXhSZXRyeUNvdW50KSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB0eXBlOiAnYWJvcnQnLFxuICAgICAgICByZWFzb246ICd1c2VyX3JlcXVlc3RlZCcsXG4gICAgICAgIGZhaWx1cmVDYXRlZ29yeSxcbiAgICAgICAgcmV0cnlhYmxlOiBmYWxzZSxcbiAgICAgICAgZXhwbGFuYXRpb246IGBNYXggcmV0cnkgY291bnQgcmVhY2hlZCAoJHtjdXJyZW50UmV0cnlDb3VudH0vJHttYXhSZXRyeUNvdW50fSlgLFxuICAgICAgfTtcbiAgICB9XG4gICAgXG4gICAgLy8g5qC55o2u5aSx6LSl5YiG57G75Yaz5a6a5oGi5aSN562W55WlXG4gICAgc3dpdGNoIChmYWlsdXJlQ2F0ZWdvcnkpIHtcbiAgICAgIGNhc2UgJ3RpbWVvdXQnOlxuICAgICAgICByZXR1cm4gdGhpcy5ldmFsdWF0ZVRpbWVvdXRSZWNvdmVyeShjb250ZXh0LCBjdXJyZW50UmV0cnlDb3VudCk7XG4gICAgICBcbiAgICAgIGNhc2UgJ3Blcm1pc3Npb25fZGVuaWVkJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuZXZhbHVhdGVQZXJtaXNzaW9uRGVuaWVkUmVjb3ZlcnkoY29udGV4dCk7XG4gICAgICBcbiAgICAgIGNhc2UgJ2FwcHJvdmFsX2RlbmllZCc6XG4gICAgICAgIHJldHVybiB0aGlzLmV2YWx1YXRlQXBwcm92YWxEZW5pZWRSZWNvdmVyeShjb250ZXh0KTtcbiAgICAgIFxuICAgICAgY2FzZSAnYXBwcm92YWxfcGVuZGluZyc6XG4gICAgICAgIHJldHVybiB0aGlzLmV2YWx1YXRlQXBwcm92YWxQZW5kaW5nUmVjb3ZlcnkoY29udGV4dCk7XG4gICAgICBcbiAgICAgIGNhc2UgJ3Jlc291cmNlX3VuYXZhaWxhYmxlJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuZXZhbHVhdGVSZXNvdXJjZVVuYXZhaWxhYmxlUmVjb3ZlcnkoY29udGV4dCwgY3VycmVudFJldHJ5Q291bnQpO1xuICAgICAgXG4gICAgICBjYXNlICd2YWxpZGF0aW9uX2ZhaWxlZCc6XG4gICAgICAgIHJldHVybiB0aGlzLmV2YWx1YXRlVmFsaWRhdGlvbkZhaWxlZFJlY292ZXJ5KGNvbnRleHQpO1xuICAgICAgXG4gICAgICBjYXNlICdpbnRlcm5hbF9lcnJvcic6XG4gICAgICBjYXNlICd0cmFuc2llbnRfZXh0ZXJuYWxfZXJyb3InOlxuICAgICAgICByZXR1cm4gdGhpcy5ldmFsdWF0ZVRyYW5zaWVudEVycm9yUmVjb3ZlcnkoY29udGV4dCwgY3VycmVudFJldHJ5Q291bnQpO1xuICAgICAgXG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHR5cGU6ICdhYm9ydCcsXG4gICAgICAgICAgcmVhc29uOiAncG9saWN5X3RyaWdnZXJlZCcsXG4gICAgICAgICAgZmFpbHVyZUNhdGVnb3J5LFxuICAgICAgICAgIHJldHJ5YWJsZTogZmFsc2UsXG4gICAgICAgICAgZXhwbGFuYXRpb246IGBVbmtub3duIGZhaWx1cmUgY2F0ZWdvcnk6ICR7ZmFpbHVyZUNhdGVnb3J5fWAsXG4gICAgICAgIH07XG4gICAgfVxuICB9XG4gIFxuICAvKipcbiAgICog6K+E5Lyw6LaF5pe25oGi5aSNXG4gICAqL1xuICBwcml2YXRlIGV2YWx1YXRlVGltZW91dFJlY292ZXJ5KFxuICAgIGNvbnRleHQ6IFJlY292ZXJ5Q29udGV4dCxcbiAgICBjdXJyZW50UmV0cnlDb3VudDogbnVtYmVyXG4gICk6IFJlY292ZXJ5RGVjaXNpb24ge1xuICAgIGNvbnN0IGJhY2tvZmZNcyA9IHRoaXMuY2FsY3VsYXRlQmFja29mZihjdXJyZW50UmV0cnlDb3VudCk7XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIHR5cGU6ICdyZXRyeScsXG4gICAgICByZWFzb246ICd0YXNrX3RpbWVvdXQnLFxuICAgICAgZmFpbHVyZUNhdGVnb3J5OiAndGltZW91dCcsXG4gICAgICByZXRyeWFibGU6IHRydWUsXG4gICAgICBtYXhSZXBsYXlDb3VudDogdGhpcy5jb25maWcuZGVmYXVsdE1heFJldHJpZXMsXG4gICAgICBjdXJyZW50UmVwbGF5Q291bnQ6IGN1cnJlbnRSZXRyeUNvdW50LFxuICAgICAgYmFja29mZk1zLFxuICAgICAgZXhwbGFuYXRpb246IGBUYXNrIHRpbWVvdXQsIHdpbGwgcmV0cnkgYWZ0ZXIgJHtiYWNrb2ZmTXN9bXMgKGF0dGVtcHQgJHtjdXJyZW50UmV0cnlDb3VudCArIDF9KWAsXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOivhOS8sOadg+mZkOaLkue7neaBouWkjVxuICAgKi9cbiAgcHJpdmF0ZSBldmFsdWF0ZVBlcm1pc3Npb25EZW5pZWRSZWNvdmVyeShjb250ZXh0OiBSZWNvdmVyeUNvbnRleHQpOiBSZWNvdmVyeURlY2lzaW9uIHtcbiAgICByZXR1cm4ge1xuICAgICAgdHlwZTogJ2VzY2FsYXRlJyxcbiAgICAgIHJlYXNvbjogJ3Blcm1pc3Npb25fZGVuaWVkJyxcbiAgICAgIGZhaWx1cmVDYXRlZ29yeTogJ3Blcm1pc3Npb25fZGVuaWVkJyxcbiAgICAgIHJldHJ5YWJsZTogZmFsc2UsXG4gICAgICBleHBsYW5hdGlvbjogJ1Blcm1pc3Npb24gZGVuaWVkLCByZXF1aXJlcyBlc2NhbGF0aW9uIG9yIG1hbnVhbCBhcHByb3ZhbCcsXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOivhOS8sOWuoeaJueaLkue7neaBouWkjVxuICAgKi9cbiAgcHJpdmF0ZSBldmFsdWF0ZUFwcHJvdmFsRGVuaWVkUmVjb3ZlcnkoY29udGV4dDogUmVjb3ZlcnlDb250ZXh0KTogUmVjb3ZlcnlEZWNpc2lvbiB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHR5cGU6ICdhYm9ydCcsXG4gICAgICByZWFzb246ICdhcHByb3ZhbF9kZW5pZWQnLFxuICAgICAgZmFpbHVyZUNhdGVnb3J5OiAnYXBwcm92YWxfZGVuaWVkJyxcbiAgICAgIHJldHJ5YWJsZTogZmFsc2UsXG4gICAgICBleHBsYW5hdGlvbjogJ0FwcHJvdmFsIGV4cGxpY2l0bHkgZGVuaWVkLCBhYm9ydGluZyB0YXNrJyxcbiAgICB9O1xuICB9XG4gIFxuICAvKipcbiAgICog6K+E5Lyw5a6h5om55b6F5a6a5oGi5aSNXG4gICAqL1xuICBwcml2YXRlIGV2YWx1YXRlQXBwcm92YWxQZW5kaW5nUmVjb3ZlcnkoY29udGV4dDogUmVjb3ZlcnlDb250ZXh0KTogUmVjb3ZlcnlEZWNpc2lvbiB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHR5cGU6ICdyZXN1bWUnLFxuICAgICAgcmVhc29uOiAnYXBwcm92YWxfcGVuZGluZycsXG4gICAgICBmYWlsdXJlQ2F0ZWdvcnk6ICdhcHByb3ZhbF9wZW5kaW5nJyxcbiAgICAgIHJldHJ5YWJsZTogdHJ1ZSxcbiAgICAgIGV4cGxhbmF0aW9uOiAnQXBwcm92YWwgcGVuZGluZywgcmVzdW1pbmcgd2FpdCBvciByZXBsYXlpbmcgYXBwcm92YWwgcmVxdWVzdCcsXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOivhOS8sOi1hOa6kOS4jeWPr+eUqOaBouWkjVxuICAgKi9cbiAgcHJpdmF0ZSBldmFsdWF0ZVJlc291cmNlVW5hdmFpbGFibGVSZWNvdmVyeShcbiAgICBjb250ZXh0OiBSZWNvdmVyeUNvbnRleHQsXG4gICAgY3VycmVudFJldHJ5Q291bnQ6IG51bWJlclxuICApOiBSZWNvdmVyeURlY2lzaW9uIHtcbiAgICBjb25zdCBiYWNrb2ZmTXMgPSB0aGlzLmNhbGN1bGF0ZUJhY2tvZmYoY3VycmVudFJldHJ5Q291bnQsIDIwMDApO1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICB0eXBlOiAncmVwbGF5JyxcbiAgICAgIHJlYXNvbjogJ3Jlc291cmNlX3JlY292ZXJlZCcsXG4gICAgICBmYWlsdXJlQ2F0ZWdvcnk6ICdyZXNvdXJjZV91bmF2YWlsYWJsZScsXG4gICAgICByZXRyeWFibGU6IHRydWUsXG4gICAgICBtYXhSZXBsYXlDb3VudDogdGhpcy5jb25maWcuZGVmYXVsdE1heFJldHJpZXMsXG4gICAgICBjdXJyZW50UmVwbGF5Q291bnQ6IGN1cnJlbnRSZXRyeUNvdW50LFxuICAgICAgYmFja29mZk1zLFxuICAgICAgZXhwbGFuYXRpb246IGBSZXNvdXJjZSB1bmF2YWlsYWJsZSwgd2lsbCByZXBsYXkgYWZ0ZXIgJHtiYWNrb2ZmTXN9bXMgKGF0dGVtcHQgJHtjdXJyZW50UmV0cnlDb3VudCArIDF9KWAsXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOivhOS8sOmqjOivgeWksei0peaBouWkjVxuICAgKi9cbiAgcHJpdmF0ZSBldmFsdWF0ZVZhbGlkYXRpb25GYWlsZWRSZWNvdmVyeShjb250ZXh0OiBSZWNvdmVyeUNvbnRleHQpOiBSZWNvdmVyeURlY2lzaW9uIHtcbiAgICByZXR1cm4ge1xuICAgICAgdHlwZTogJ2Fib3J0JyxcbiAgICAgIHJlYXNvbjogJ3BvbGljeV90cmlnZ2VyZWQnLFxuICAgICAgZmFpbHVyZUNhdGVnb3J5OiAndmFsaWRhdGlvbl9mYWlsZWQnLFxuICAgICAgcmV0cnlhYmxlOiBmYWxzZSxcbiAgICAgIGV4cGxhbmF0aW9uOiAnVmFsaWRhdGlvbiBmYWlsZWQsIHJlcXVpcmVzIG1hbnVhbCBmaXggYmVmb3JlIHJldHJ5JyxcbiAgICB9O1xuICB9XG4gIFxuICAvKipcbiAgICog6K+E5Lyw556s5pe26ZSZ6K+v5oGi5aSNXG4gICAqL1xuICBwcml2YXRlIGV2YWx1YXRlVHJhbnNpZW50RXJyb3JSZWNvdmVyeShcbiAgICBjb250ZXh0OiBSZWNvdmVyeUNvbnRleHQsXG4gICAgY3VycmVudFJldHJ5Q291bnQ6IG51bWJlclxuICApOiBSZWNvdmVyeURlY2lzaW9uIHtcbiAgICBjb25zdCBiYWNrb2ZmTXMgPSB0aGlzLmNhbGN1bGF0ZUJhY2tvZmYoY3VycmVudFJldHJ5Q291bnQpO1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICB0eXBlOiAncmV0cnknLFxuICAgICAgcmVhc29uOiAndHJhbnNpZW50X2Vycm9yJyxcbiAgICAgIGZhaWx1cmVDYXRlZ29yeTogY29udGV4dC5mYWlsdXJlQ2F0ZWdvcnksXG4gICAgICByZXRyeWFibGU6IHRydWUsXG4gICAgICBtYXhSZXBsYXlDb3VudDogdGhpcy5jb25maWcuZGVmYXVsdE1heFJldHJpZXMsXG4gICAgICBjdXJyZW50UmVwbGF5Q291bnQ6IGN1cnJlbnRSZXRyeUNvdW50LFxuICAgICAgYmFja29mZk1zLFxuICAgICAgZXhwbGFuYXRpb246IGBUcmFuc2llbnQgZXJyb3IsIHdpbGwgcmV0cnkgYWZ0ZXIgJHtiYWNrb2ZmTXN9bXMgKGF0dGVtcHQgJHtjdXJyZW50UmV0cnlDb3VudCArIDF9KWAsXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOiuoeeul+mAgOmBv+aXtumXtFxuICAgKi9cbiAgcHJpdmF0ZSBjYWxjdWxhdGVCYWNrb2ZmKGN1cnJlbnRSZXRyeUNvdW50OiBudW1iZXIsIGJhc2VCYWNrb2ZmPzogbnVtYmVyKTogbnVtYmVyIHtcbiAgICBjb25zdCBiYXNlID0gYmFzZUJhY2tvZmYgPz8gdGhpcy5jb25maWcuZGVmYXVsdEJhY2tvZmZNcztcbiAgICBjb25zdCBiYWNrb2ZmID0gYmFzZSAqIE1hdGgucG93KHRoaXMuY29uZmlnLmJhY2tvZmZNdWx0aXBsaWVyLCBjdXJyZW50UmV0cnlDb3VudCk7XG4gICAgcmV0dXJuIE1hdGgubWluKGJhY2tvZmYsIHRoaXMuY29uZmlnLm1heEJhY2tvZmZNcyk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDph43mlL7ku7vliqFcbiAgICovXG4gIGFzeW5jIHJlcGxheVRhc2sodGFza0lkOiBzdHJpbmcsIHNjb3BlPzogUmVwbGF5U2NvcGUpOiBQcm9taXNlPFJlcGxheVJlc3VsdD4ge1xuICAgIGNvbnN0IHN0YXJ0VGltZSA9IERhdGUubm93KCk7XG4gICAgXG4gICAgLy8g566A5YyW5a6e546w77ya5a6e6ZmF5bqU6K+l6LCD55SoIFRhc2tTdG9yZSDov5vooYzku7vliqHph43mlL5cbiAgICBjb25zb2xlLmxvZyhgW1JFUExBWV0gVGFzazogJHt0YXNrSWR9LCBTY29wZTogJHtKU09OLnN0cmluZ2lmeShzY29wZSl9YCk7XG4gICAgXG4gICAgLy8g5qOA5p+l5oGi5aSN5Ya35Y20XG4gICAgaWYgKHRoaXMuY29uZmlnLmVuYWJsZUxvb3BHdWFyZCkge1xuICAgICAgY29uc3QgdHJhY2tpbmcgPSB0aGlzLnJlY292ZXJ5VHJhY2tpbmcuZ2V0KHRhc2tJZCk7XG4gICAgICBpZiAodHJhY2tpbmcpIHtcbiAgICAgICAgY29uc3QgdGltZVNpbmNlTGFzdFJlY292ZXJ5ID0gRGF0ZS5ub3coKSAtIHRyYWNraW5nLmxhc3RSZWNvdmVyeUF0O1xuICAgICAgICBpZiAodGltZVNpbmNlTGFzdFJlY292ZXJ5IDwgdGhpcy5jb25maWcucmVjb3ZlcnlDb29sZG93bk1zKSB7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgcmVwbGF5ZWRUYXNrSWQ6IHRhc2tJZCxcbiAgICAgICAgICAgIHJlcGxheVR5cGU6ICd0YXNrJyxcbiAgICAgICAgICAgIHJlcGxheUNvdW50OiB0cmFja2luZy5jb3VudCxcbiAgICAgICAgICAgIGVycm9yOiBgUmVjb3ZlcnkgY29vbGRvd24gYWN0aXZlLCAke3RoaXMuY29uZmlnLnJlY292ZXJ5Q29vbGRvd25NcyAtIHRpbWVTaW5jZUxhc3RSZWNvdmVyeX1tcyByZW1haW5pbmdgLFxuICAgICAgICAgICAgcmVwbGF5VGltZU1zOiBEYXRlLm5vdygpIC0gc3RhcnRUaW1lLFxuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8g5pu05paw6L+96LiqXG4gICAgdGhpcy51cGRhdGVSZWNvdmVyeVRyYWNraW5nKHRhc2tJZCk7XG4gICAgXG4gICAgLy8g566A5YyW5a6e546w77ya6L+U5Zue5oiQ5YqfXG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICByZXBsYXllZFRhc2tJZDogdGFza0lkLFxuICAgICAgcmVwbGF5VHlwZTogJ3Rhc2snLFxuICAgICAgcmVwbGF5Q291bnQ6IDEsXG4gICAgICByZXN1bHQ6IHsgc3RhdHVzOiAncmVwbGF5ZWQnIH0sXG4gICAgICByZXBsYXlUaW1lTXM6IERhdGUubm93KCkgLSBzdGFydFRpbWUsXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOaBouWkjeS7u+WKoVxuICAgKi9cbiAgYXN5bmMgcmVzdW1lVGFzayh0YXNrSWQ6IHN0cmluZyk6IFByb21pc2U8UmVwbGF5UmVzdWx0PiB7XG4gICAgY29uc3Qgc3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcbiAgICBcbiAgICAvLyDnroDljJblrp7njrDvvJrlrp7pmYXlupTor6XosIPnlKggVGFza1N0b3JlIOaBouWkjeS7u+WKoVxuICAgIGNvbnNvbGUubG9nKGBbUkVTVU1FXSBUYXNrOiAke3Rhc2tJZH1gKTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHJlcGxheWVkVGFza0lkOiB0YXNrSWQsXG4gICAgICByZXBsYXlUeXBlOiAndGFzaycsXG4gICAgICByZXBsYXlDb3VudDogMCxcbiAgICAgIHJlc3VsdDogeyBzdGF0dXM6ICdyZXN1bWVkJyB9LFxuICAgICAgcmVwbGF5VGltZU1zOiBEYXRlLm5vdygpIC0gc3RhcnRUaW1lLFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDph43mlL7lrqHmiblcbiAgICovXG4gIGFzeW5jIHJlcGxheUFwcHJvdmFsKGFwcHJvdmFsSWQ6IHN0cmluZyk6IFByb21pc2U8UmVwbGF5UmVzdWx0PiB7XG4gICAgY29uc3Qgc3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcbiAgICBcbiAgICAvLyDnroDljJblrp7njrDvvJrlrp7pmYXlupTor6XosIPnlKggQXBwcm92YWxCcmlkZ2Ug6L+b6KGM5a6h5om56YeN5pS+XG4gICAgY29uc29sZS5sb2coYFtSRVBMQVldIEFwcHJvdmFsOiAke2FwcHJvdmFsSWR9YCk7XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICByZXBsYXllZFRhc2tJZDogYXBwcm92YWxJZCxcbiAgICAgIHJlcGxheVR5cGU6ICdhcHByb3ZhbCcsXG4gICAgICByZXBsYXlDb3VudDogMSxcbiAgICAgIHJlc3VsdDogeyBzdGF0dXM6ICdyZXBsYXllZCcgfSxcbiAgICAgIHJlcGxheVRpbWVNczogRGF0ZS5ub3coKSAtIHN0YXJ0VGltZSxcbiAgICB9O1xuICB9XG4gIFxuICAvKipcbiAgICog5p6E5bu65oGi5aSN6K6h5YiSXG4gICAqL1xuICBhc3luYyBidWlsZFJlY292ZXJ5UGxhbihcbiAgICBmYWlsdXJlOiBGYWlsdXJlQ2F0ZWdvcnksXG4gICAgY29udGV4dDogUmVjb3ZlcnlDb250ZXh0XG4gICk6IFByb21pc2U8UmVjb3ZlcnlQbGFuPiB7XG4gICAgY29uc3QgZGVjaXNpb24gPSBhd2FpdCB0aGlzLmV2YWx1YXRlUmVjb3ZlcnkoY29udGV4dCk7XG4gICAgXG4gICAgY29uc3Qgc3RlcHM6IEFycmF5PHsgYWN0aW9uOiBzdHJpbmc7IHBhcmFtcz86IFJlY29yZDxzdHJpbmcsIGFueT4gfT4gPSBbXTtcbiAgICBcbiAgICBzd2l0Y2ggKGRlY2lzaW9uLnR5cGUpIHtcbiAgICAgIGNhc2UgJ3JldHJ5JzpcbiAgICAgICAgc3RlcHMucHVzaCh7XG4gICAgICAgICAgYWN0aW9uOiAnd2FpdCcsXG4gICAgICAgICAgcGFyYW1zOiB7IGR1cmF0aW9uTXM6IGRlY2lzaW9uLmJhY2tvZmZNcyB9LFxuICAgICAgICB9KTtcbiAgICAgICAgc3RlcHMucHVzaCh7XG4gICAgICAgICAgYWN0aW9uOiAncmV0cnlfdGFzaycsXG4gICAgICAgICAgcGFyYW1zOiB7IHRhc2tJZDogY29udGV4dC50YXNrSWQgfSxcbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgXG4gICAgICBjYXNlICdyZXBsYXknOlxuICAgICAgICBzdGVwcy5wdXNoKHtcbiAgICAgICAgICBhY3Rpb246ICd3YWl0JyxcbiAgICAgICAgICBwYXJhbXM6IHsgZHVyYXRpb25NczogZGVjaXNpb24uYmFja29mZk1zIH0sXG4gICAgICAgIH0pO1xuICAgICAgICBzdGVwcy5wdXNoKHtcbiAgICAgICAgICBhY3Rpb246ICdyZXBsYXlfdGFzaycsXG4gICAgICAgICAgcGFyYW1zOiB7IHRhc2tJZDogY29udGV4dC50YXNrSWQsIHNjb3BlOiBkZWNpc2lvbi5yZXRyeWFibGUgfSxcbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgXG4gICAgICBjYXNlICdyZXN1bWUnOlxuICAgICAgICBzdGVwcy5wdXNoKHtcbiAgICAgICAgICBhY3Rpb246ICdyZXN1bWVfdGFzaycsXG4gICAgICAgICAgcGFyYW1zOiB7IHRhc2tJZDogY29udGV4dC50YXNrSWQgfSxcbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgXG4gICAgICBjYXNlICdlc2NhbGF0ZSc6XG4gICAgICAgIHN0ZXBzLnB1c2goe1xuICAgICAgICAgIGFjdGlvbjogJ2VzY2FsYXRlJyxcbiAgICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIHRhc2tJZDogY29udGV4dC50YXNrSWQsXG4gICAgICAgICAgICByZWFzb246IGRlY2lzaW9uLmV4cGxhbmF0aW9uLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcbiAgICAgIFxuICAgICAgY2FzZSAnYWJvcnQnOlxuICAgICAgICBzdGVwcy5wdXNoKHtcbiAgICAgICAgICBhY3Rpb246ICdhYm9ydF90YXNrJyxcbiAgICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIHRhc2tJZDogY29udGV4dC50YXNrSWQsXG4gICAgICAgICAgICByZWFzb246IGRlY2lzaW9uLmV4cGxhbmF0aW9uLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIHRhc2tJZDogY29udGV4dC50YXNrSWQgfHwgJycsXG4gICAgICBkZWNpc2lvbixcbiAgICAgIHN0ZXBzLFxuICAgICAgZXN0aW1hdGVkUmVjb3ZlcnlUaW1lTXM6IHN0ZXBzLnJlZHVjZSgoc3VtLCBzdGVwKSA9PiB7XG4gICAgICAgIGlmIChzdGVwLmFjdGlvbiA9PT0gJ3dhaXQnKSB7XG4gICAgICAgICAgcmV0dXJuIHN1bSArIChzdGVwLnBhcmFtcz8uZHVyYXRpb25NcyB8fCAwKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc3VtICsgMTAwOyAvLyDkvLDorqHmr4/kuKrliqjkvZwgMTAwbXNcbiAgICAgIH0sIDApLFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmm7TmlrDmgaLlpI3ov73ouKpcbiAgICovXG4gIHByaXZhdGUgdXBkYXRlUmVjb3ZlcnlUcmFja2luZyh0YXNrSWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5yZWNvdmVyeVRyYWNraW5nLmdldCh0YXNrSWQpO1xuICAgIFxuICAgIHRoaXMucmVjb3ZlcnlUcmFja2luZy5zZXQodGFza0lkLCB7XG4gICAgICBsYXN0UmVjb3ZlcnlBdDogRGF0ZS5ub3coKSxcbiAgICAgIGNvdW50OiAoZXhpc3Rpbmc/LmNvdW50IHx8IDApICsgMSxcbiAgICB9KTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOa4hemZpOaBouWkjei/vei4qlxuICAgKi9cbiAgY2xlYXJSZWNvdmVyeVRyYWNraW5nKHRhc2tJZD86IHN0cmluZyk6IHZvaWQge1xuICAgIGlmICh0YXNrSWQpIHtcbiAgICAgIHRoaXMucmVjb3ZlcnlUcmFja2luZy5kZWxldGUodGFza0lkKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5yZWNvdmVyeVRyYWNraW5nLmNsZWFyKCk7XG4gICAgfVxuICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOS+v+aNt+WHveaVsFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIOWIm+W7uuaBouWkjemHjeaUvuaJp+ihjOWZqFxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlUmVjb3ZlcnlSZXBsYXlFeGVjdXRvcihjb25maWc/OiBSZWNvdmVyeVN0cmF0ZWd5Q29uZmlnKTogUmVjb3ZlcnlSZXBsYXlFeGVjdXRvciB7XG4gIHJldHVybiBuZXcgUmVjb3ZlcnlSZXBsYXlFeGVjdXRvcihjb25maWcpO1xufVxuXG4vKipcbiAqIOW/q+mAn+ivhOS8sOaBouWkjeWGs+etllxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZXZhbHVhdGVSZWNvdmVyeShcbiAgY29udGV4dDogUmVjb3ZlcnlDb250ZXh0LFxuICBjb25maWc/OiBSZWNvdmVyeVN0cmF0ZWd5Q29uZmlnXG4pOiBQcm9taXNlPFJlY292ZXJ5RGVjaXNpb24+IHtcbiAgY29uc3QgZXhlY3V0b3IgPSBuZXcgUmVjb3ZlcnlSZXBsYXlFeGVjdXRvcihjb25maWcpO1xuICByZXR1cm4gYXdhaXQgZXhlY3V0b3IuZXZhbHVhdGVSZWNvdmVyeShjb250ZXh0KTtcbn1cbiJdfQ==