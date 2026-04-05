"use strict";
/**
 * Operator Execution Bridge
 * Phase 2A-1R′ - 真实动作执行桥接
 *
 * 职责：
 * - 承接 OperatorCommandDispatch 的真实动作调用
 * - 向下调用 ControlSurface / ApprovalWorkflow / IncidentWorkflow
 * - 区分 real / simulated 执行模式
 * - 返回 ExecutionResult
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultOperatorExecutionBridge = void 0;
exports.createOperatorExecutionBridge = createOperatorExecutionBridge;
// ============================================================================
// 默认实现
// ============================================================================
class DefaultOperatorExecutionBridge {
    constructor(config = {}) {
        this.config = {
            enableRealExecution: config.enableRealExecution ?? false,
            controlSurfaceBuilder: config.controlSurfaceBuilder ?? null,
            humanLoopService: config.humanLoopService ?? null,
            executionPolicy: config.executionPolicy ?? null,
            taskDataSource: config.taskDataSource ?? null,
            approvalDataSource: config.approvalDataSource ?? null,
            incidentDataSource: config.incidentDataSource ?? null,
            agentDataSource: config.agentDataSource ?? null,
        };
    }
    async approveApproval(id, actorId) {
        // 检查执行策略
        const mode = this.getExecutionMode('approve');
        if (mode === 'real' && this.config.controlSurfaceBuilder) {
            try {
                const result = await this.config.controlSurfaceBuilder.dispatchControlAction({
                    type: 'approve',
                    targetType: 'approval',
                    targetId: id,
                    requestedBy: actorId || 'operator',
                    requestedAt: Date.now(),
                });
                // 同步状态到数据源
                if (result.success && this.config.approvalDataSource) {
                    this.config.approvalDataSource.updateApprovalStatus(id, 'approved', actorId);
                }
                return {
                    success: result.success,
                    executionMode: 'real',
                    actionType: 'approve',
                    targetId: id,
                    message: result.message || `Approval ${id} approved`,
                    error: result.error,
                    controlResult: result,
                    executedAt: Date.now(),
                };
            }
            catch (error) {
                return {
                    success: false,
                    executionMode: 'real',
                    actionType: 'approve',
                    targetId: id,
                    message: `Failed to approve ${id}`,
                    error: error instanceof Error ? error.message : String(error),
                    executedAt: Date.now(),
                };
            }
        }
        // 模拟执行路径
        return this.buildSimulatedResult('approve', id, `Approval ${id} approved`);
    }
    async rejectApproval(id, actorId) {
        const mode = this.getExecutionMode('reject');
        if (mode === 'real' && this.config.controlSurfaceBuilder) {
            try {
                const result = await this.config.controlSurfaceBuilder.dispatchControlAction({
                    type: 'reject',
                    targetType: 'approval',
                    targetId: id,
                    requestedBy: actorId || 'operator',
                    requestedAt: Date.now(),
                });
                if (result.success && this.config.approvalDataSource) {
                    this.config.approvalDataSource.updateApprovalStatus(id, 'rejected', actorId);
                }
                return {
                    success: result.success,
                    executionMode: 'real',
                    actionType: 'reject',
                    targetId: id,
                    message: result.message || `Approval ${id} rejected`,
                    error: result.error,
                    controlResult: result,
                    executedAt: Date.now(),
                };
            }
            catch (error) {
                return {
                    success: false,
                    executionMode: 'real',
                    actionType: 'reject',
                    targetId: id,
                    message: `Failed to reject ${id}`,
                    error: error instanceof Error ? error.message : String(error),
                    executedAt: Date.now(),
                };
            }
        }
        return this.buildSimulatedResult('reject', id, `Approval ${id} rejected`);
    }
    async ackIncident(id, actorId) {
        const mode = this.getExecutionMode('ack_incident');
        if (mode === 'real' && this.config.controlSurfaceBuilder) {
            try {
                const result = await this.config.controlSurfaceBuilder.dispatchControlAction({
                    type: 'ack_incident',
                    targetType: 'incident',
                    targetId: id,
                    requestedBy: actorId || 'operator',
                    requestedAt: Date.now(),
                });
                if (result.success && this.config.incidentDataSource) {
                    this.config.incidentDataSource.acknowledgeIncident(id, actorId);
                }
                return {
                    success: result.success,
                    executionMode: 'real',
                    actionType: 'ack_incident',
                    targetId: id,
                    message: result.message || `Incident ${id} acknowledged`,
                    error: result.error,
                    controlResult: result,
                    executedAt: Date.now(),
                };
            }
            catch (error) {
                return {
                    success: false,
                    executionMode: 'real',
                    actionType: 'ack_incident',
                    targetId: id,
                    message: `Failed to acknowledge ${id}`,
                    error: error instanceof Error ? error.message : String(error),
                    executedAt: Date.now(),
                };
            }
        }
        return this.buildSimulatedResult('ack_incident', id, `Incident ${id} acknowledged`);
    }
    async retryTask(id, actorId) {
        const mode = this.getExecutionMode('retry_task');
        if (mode === 'real' && this.config.controlSurfaceBuilder) {
            try {
                const result = await this.config.controlSurfaceBuilder.dispatchControlAction({
                    type: 'retry_task',
                    targetType: 'task',
                    targetId: id,
                    requestedBy: actorId || 'operator',
                    requestedAt: Date.now(),
                });
                if (result.success && this.config.taskDataSource) {
                    this.config.taskDataSource.updateTaskStatus(id, 'running');
                }
                return {
                    success: result.success,
                    executionMode: 'real',
                    actionType: 'retry_task',
                    targetId: id,
                    message: result.message || `Task ${id} retry initiated`,
                    error: result.error,
                    controlResult: result,
                    executedAt: Date.now(),
                };
            }
            catch (error) {
                return {
                    success: false,
                    executionMode: 'real',
                    actionType: 'retry_task',
                    targetId: id,
                    message: `Failed to retry ${id}`,
                    error: error instanceof Error ? error.message : String(error),
                    executedAt: Date.now(),
                };
            }
        }
        return this.buildSimulatedResult('retry_task', id, `Task ${id} retry initiated`);
    }
    async pauseAgent(id, actorId) {
        const mode = this.getExecutionMode('pause_agent');
        if (mode === 'real' && this.config.controlSurfaceBuilder) {
            try {
                const result = await this.config.controlSurfaceBuilder.dispatchControlAction({
                    type: 'pause_agent',
                    targetType: 'agent',
                    targetId: id,
                    requestedBy: actorId || 'operator',
                    requestedAt: Date.now(),
                });
                if (result.success && this.config.agentDataSource) {
                    this.config.agentDataSource.updateAgentStatus(id, 'paused');
                }
                return {
                    success: result.success,
                    executionMode: 'real',
                    actionType: 'pause_agent',
                    targetId: id,
                    message: result.message || `Agent ${id} paused`,
                    error: result.error,
                    controlResult: result,
                    executedAt: Date.now(),
                };
            }
            catch (error) {
                return {
                    success: false,
                    executionMode: 'real',
                    actionType: 'pause_agent',
                    targetId: id,
                    message: `Failed to pause ${id}`,
                    error: error instanceof Error ? error.message : String(error),
                    executedAt: Date.now(),
                };
            }
        }
        return this.buildSimulatedResult('pause_agent', id, `Agent ${id} paused`);
    }
    async resumeAgent(id, actorId) {
        if (this.config.enableRealExecution && this.config.controlSurfaceBuilder) {
            try {
                const result = await this.config.controlSurfaceBuilder.dispatchControlAction({
                    type: 'resume_agent',
                    targetType: 'agent',
                    targetId: id,
                    requestedBy: actorId || 'operator',
                    requestedAt: Date.now(),
                });
                return {
                    success: result.success,
                    executionMode: 'real',
                    actionType: 'resume_agent',
                    targetId: id,
                    message: result.message || `Agent ${id} resumed`,
                    error: result.error,
                    controlResult: result,
                    executedAt: Date.now(),
                };
            }
            catch (error) {
                return {
                    success: false,
                    executionMode: 'real',
                    actionType: 'resume_agent',
                    targetId: id,
                    message: `Failed to resume ${id}`,
                    error: error instanceof Error ? error.message : String(error),
                    executedAt: Date.now(),
                };
            }
        }
        return this.buildSimulatedResult('resume_agent', id, `Agent ${id} resumed`);
    }
    async inspectAgent(id, actorId) {
        if (this.config.enableRealExecution && this.config.controlSurfaceBuilder) {
            try {
                const result = await this.config.controlSurfaceBuilder.dispatchControlAction({
                    type: 'inspect_agent',
                    targetType: 'agent',
                    targetId: id,
                    requestedBy: actorId || 'operator',
                    requestedAt: Date.now(),
                });
                return {
                    success: result.success,
                    executionMode: 'real',
                    actionType: 'inspect_agent',
                    targetId: id,
                    message: result.message || `Agent ${id} inspection opened`,
                    error: result.error,
                    controlResult: result,
                    executedAt: Date.now(),
                };
            }
            catch (error) {
                return {
                    success: false,
                    executionMode: 'real',
                    actionType: 'inspect_agent',
                    targetId: id,
                    message: `Failed to inspect ${id}`,
                    error: error instanceof Error ? error.message : String(error),
                    executedAt: Date.now(),
                };
            }
        }
        return this.buildSimulatedResult('inspect_agent', id, `Agent ${id} inspection opened`);
    }
    async cancelTask(id, actorId) {
        if (this.config.enableRealExecution && this.config.controlSurfaceBuilder) {
            try {
                const result = await this.config.controlSurfaceBuilder.dispatchControlAction({
                    type: 'cancel_task',
                    targetType: 'task',
                    targetId: id,
                    requestedBy: actorId || 'operator',
                    requestedAt: Date.now(),
                });
                return {
                    success: result.success,
                    executionMode: 'real',
                    actionType: 'cancel_task',
                    targetId: id,
                    message: result.message || `Task ${id} cancelled`,
                    error: result.error,
                    controlResult: result,
                    executedAt: Date.now(),
                };
            }
            catch (error) {
                return {
                    success: false,
                    executionMode: 'real',
                    actionType: 'cancel_task',
                    targetId: id,
                    message: `Failed to cancel ${id}`,
                    error: error instanceof Error ? error.message : String(error),
                    executedAt: Date.now(),
                };
            }
        }
        return this.buildSimulatedResult('cancel_task', id, `Task ${id} cancelled`);
    }
    async pauseTask(id, actorId) {
        if (this.config.enableRealExecution && this.config.controlSurfaceBuilder) {
            try {
                const result = await this.config.controlSurfaceBuilder.dispatchControlAction({
                    type: 'pause_task',
                    targetType: 'task',
                    targetId: id,
                    requestedBy: actorId || 'operator',
                    requestedAt: Date.now(),
                });
                return {
                    success: result.success,
                    executionMode: 'real',
                    actionType: 'pause_task',
                    targetId: id,
                    message: result.message || `Task ${id} paused`,
                    error: result.error,
                    controlResult: result,
                    executedAt: Date.now(),
                };
            }
            catch (error) {
                return {
                    success: false,
                    executionMode: 'real',
                    actionType: 'pause_task',
                    targetId: id,
                    message: `Failed to pause ${id}`,
                    error: error instanceof Error ? error.message : String(error),
                    executedAt: Date.now(),
                };
            }
        }
        return this.buildSimulatedResult('pause_task', id, `Task ${id} paused`);
    }
    async resumeTask(id, actorId) {
        if (this.config.enableRealExecution && this.config.controlSurfaceBuilder) {
            try {
                const result = await this.config.controlSurfaceBuilder.dispatchControlAction({
                    type: 'resume_task',
                    targetType: 'task',
                    targetId: id,
                    requestedBy: actorId || 'operator',
                    requestedAt: Date.now(),
                });
                return {
                    success: result.success,
                    executionMode: 'real',
                    actionType: 'resume_task',
                    targetId: id,
                    message: result.message || `Task ${id} resumed`,
                    error: result.error,
                    controlResult: result,
                    executedAt: Date.now(),
                };
            }
            catch (error) {
                return {
                    success: false,
                    executionMode: 'real',
                    actionType: 'resume_task',
                    targetId: id,
                    message: `Failed to resume ${id}`,
                    error: error instanceof Error ? error.message : String(error),
                    executedAt: Date.now(),
                };
            }
        }
        return this.buildSimulatedResult('resume_task', id, `Task ${id} resumed`);
    }
    async escalate(targetType, id, actorId) {
        if (this.config.enableRealExecution && this.config.controlSurfaceBuilder) {
            try {
                const result = await this.config.controlSurfaceBuilder.dispatchControlAction({
                    type: 'escalate_approval',
                    targetType: targetType,
                    targetId: id,
                    requestedBy: actorId || 'operator',
                    requestedAt: Date.now(),
                });
                return {
                    success: result.success,
                    executionMode: 'real',
                    actionType: 'escalate',
                    targetId: id,
                    message: result.message || `${targetType} ${id} escalated`,
                    error: result.error,
                    controlResult: result,
                    executedAt: Date.now(),
                };
            }
            catch (error) {
                return {
                    success: false,
                    executionMode: 'real',
                    actionType: 'escalate',
                    targetId: id,
                    message: `Failed to escalate ${id}`,
                    error: error instanceof Error ? error.message : String(error),
                    executedAt: Date.now(),
                };
            }
        }
        return this.buildSimulatedResult('escalate', id, `${targetType} ${id} escalated`);
    }
    async requestRecovery(id, actorId) {
        return this.buildSimulatedResult('request_recovery', id, `Recovery requested for ${id}`);
    }
    async requestReplay(id, actorId) {
        return this.buildSimulatedResult('request_replay', id, `Replay requested for ${id}`);
    }
    // ============================================================================
    // 辅助方法
    // ============================================================================
    /**
     * 获取动作的执行模式
     */
    getExecutionMode(actionType) {
        // 优先使用 execution policy
        if (this.config.executionPolicy) {
            return this.config.executionPolicy.getExecutionMode(actionType);
        }
        // 回退到全局开关
        return this.config.enableRealExecution ? 'real' : 'simulated';
    }
    buildSimulatedResult(actionType, targetId, message) {
        return {
            success: true,
            executionMode: 'simulated',
            actionType,
            targetId,
            message,
            executedAt: Date.now(),
        };
    }
    /**
     * 启用真实执行
     */
    enableRealExecution() {
        this.config.enableRealExecution = true;
        this.config.executionPolicy?.enableRealExecution();
    }
    /**
     * 禁用真实执行（模拟模式）
     */
    disableRealExecution() {
        this.config.enableRealExecution = false;
        this.config.executionPolicy?.disableRealExecution();
    }
    /**
     * 检查是否启用真实执行
     */
    isRealExecutionEnabled() {
        return this.config.enableRealExecution;
    }
    /**
     * 设置动作的执行模式
     */
    setExecutionMode(actionType, mode) {
        if (this.config.executionPolicy) {
            this.config.executionPolicy.setExecutionMode(actionType, mode);
        }
    }
    /**
     * 获取执行策略状态
     */
    getExecutionPolicyState() {
        return this.config.executionPolicy?.getPolicyState() || {
            defaultMode: this.config.enableRealExecution ? 'real' : 'simulated',
            globalEnabled: this.config.enableRealExecution,
        };
    }
}
exports.DefaultOperatorExecutionBridge = DefaultOperatorExecutionBridge;
// ============================================================================
// 工厂函数
// ============================================================================
const operator_execution_policy_1 = require("./operator_execution_policy");
function createOperatorExecutionBridge(config, executionPolicy) {
    return new DefaultOperatorExecutionBridge({
        ...config,
        executionPolicy: executionPolicy ?? (0, operator_execution_policy_1.createExecutionPolicy)(config),
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3BlcmF0b3JfZXhlY3V0aW9uX2JyaWRnZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9vcGVyYXRvci9zZXJ2aWNlcy9vcGVyYXRvcl9leGVjdXRpb25fYnJpZGdlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7O0dBU0c7OztBQTJxQkgsc0VBUUM7QUF6aUJELCtFQUErRTtBQUMvRSxPQUFPO0FBQ1AsK0VBQStFO0FBRS9FLE1BQWEsOEJBQThCO0lBR3pDLFlBQVksU0FBd0MsRUFBRTtRQUNwRCxJQUFJLENBQUMsTUFBTSxHQUFHO1lBQ1osbUJBQW1CLEVBQUUsTUFBTSxDQUFDLG1CQUFtQixJQUFJLEtBQUs7WUFDeEQscUJBQXFCLEVBQUUsTUFBTSxDQUFDLHFCQUFxQixJQUFJLElBQUk7WUFDM0QsZ0JBQWdCLEVBQUUsTUFBTSxDQUFDLGdCQUFnQixJQUFJLElBQUk7WUFDakQsZUFBZSxFQUFFLE1BQU0sQ0FBQyxlQUFlLElBQUksSUFBSTtZQUMvQyxjQUFjLEVBQUUsTUFBTSxDQUFDLGNBQWMsSUFBSSxJQUFJO1lBQzdDLGtCQUFrQixFQUFFLE1BQU0sQ0FBQyxrQkFBa0IsSUFBSSxJQUFJO1lBQ3JELGtCQUFrQixFQUFFLE1BQU0sQ0FBQyxrQkFBa0IsSUFBSSxJQUFJO1lBQ3JELGVBQWUsRUFBRSxNQUFNLENBQUMsZUFBZSxJQUFJLElBQUk7U0FDTCxDQUFDO0lBQy9DLENBQUM7SUFFRCxLQUFLLENBQUMsZUFBZSxDQUFDLEVBQVUsRUFBRSxPQUFnQjtRQUNoRCxTQUFTO1FBQ1QsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBRTlDLElBQUksSUFBSSxLQUFLLE1BQU0sSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLHFCQUFxQixFQUFFLENBQUM7WUFDekQsSUFBSSxDQUFDO2dCQUNILE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBSSxDQUFDLE1B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SSxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsZ0JBQWdCLENBQUMsVUFBaUIsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUN4RSxDQUFDO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0gsdUJBQXVCO1FBQ3JCLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxlQUFlLEVBQUUsY0FBYyxFQUFFLElBQUk7WUFDdEQsV0FBVyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsV0FBVztZQUNuRSxhQUFhLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxtQkFBbUI7U0FDL0MsQ0FBQztJQUNKLENBQUM7Q0FDRjtBQXJoQkQsd0VBcWhCQztBQUVELCtFQUErRTtBQUMvRSxPQUFPO0FBQ1AsK0VBQStFO0FBRS9FLDJFQUEwRjtBQUUxRixTQUFnQiw2QkFBNkIsQ0FDM0MsTUFBc0MsRUFDdEMsZUFBaUM7SUFFakMsT0FBTyxJQUFJLDhCQUE4QixDQUFDO1FBQ3hDLEdBQUcsTUFBTTtRQUNULGVBQWUsRUFBRSxlQUFlLElBQUksSUFBQSxpREFBcUIsRUFBQyxNQUFNLENBQUM7S0FDbEUsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogT3BlcmF0b3IgRXhlY3V0aW9uIEJyaWRnZVxuICogUGhhc2UgMkEtMVLigLIgLSDnnJ/lrp7liqjkvZzmiafooYzmoaXmjqVcbiAqIFxuICog6IGM6LSj77yaXG4gKiAtIOaJv+aOpSBPcGVyYXRvckNvbW1hbmREaXNwYXRjaCDnmoTnnJ/lrp7liqjkvZzosIPnlKhcbiAqIC0g5ZCR5LiL6LCD55SoIENvbnRyb2xTdXJmYWNlIC8gQXBwcm92YWxXb3JrZmxvdyAvIEluY2lkZW50V29ya2Zsb3dcbiAqIC0g5Yy65YiGIHJlYWwgLyBzaW11bGF0ZWQg5omn6KGM5qih5byPXG4gKiAtIOi/lOWbniBFeGVjdXRpb25SZXN1bHRcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IENvbnRyb2xTdXJmYWNlQnVpbGRlciB9IGZyb20gJy4uL3V4L2NvbnRyb2xfc3VyZmFjZSc7XG5pbXBvcnQgdHlwZSB7IEh1bWFuTG9vcFNlcnZpY2UgfSBmcm9tICcuLi91eC9odW1hbl9sb29wX3NlcnZpY2UnO1xuaW1wb3J0IHR5cGUgeyBDb250cm9sQWN0aW9uUmVzdWx0IH0gZnJvbSAnLi4vdXgvY29udHJvbF90eXBlcyc7XG5pbXBvcnQgdHlwZSB7IEV4ZWN1dGlvblBvbGljeSB9IGZyb20gJy4vb3BlcmF0b3JfZXhlY3V0aW9uX3BvbGljeSc7XG5pbXBvcnQgdHlwZSB7IFRhc2tEYXRhU291cmNlIH0gZnJvbSAnLi4vZGF0YS90YXNrX2RhdGFfc291cmNlJztcbmltcG9ydCB0eXBlIHsgQXBwcm92YWxEYXRhU291cmNlIH0gZnJvbSAnLi4vZGF0YS9hcHByb3ZhbF9kYXRhX3NvdXJjZSc7XG5pbXBvcnQgdHlwZSB7IEluY2lkZW50RGF0YVNvdXJjZSB9IGZyb20gJy4uL2RhdGEvaW5jaWRlbnRfZGF0YV9zb3VyY2UnO1xuaW1wb3J0IHR5cGUgeyBBZ2VudERhdGFTb3VyY2UgfSBmcm9tICcuLi9kYXRhL2FnZW50X2RhdGFfc291cmNlJztcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5omn6KGM57uT5p6c57G75Z6LXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCB0eXBlIEV4ZWN1dGlvbk1vZGUgPSBcInJlYWxcIiB8IFwic2ltdWxhdGVkXCIgfCBcInVuc3VwcG9ydGVkXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRXhlY3V0aW9uUmVzdWx0IHtcbiAgLyoqIOaYr+WQpuaIkOWKnyAqL1xuICBzdWNjZXNzOiBib29sZWFuO1xuICBcbiAgLyoqIOaJp+ihjOaooeW8jyAqL1xuICBleGVjdXRpb25Nb2RlOiBFeGVjdXRpb25Nb2RlO1xuICBcbiAgLyoqIOWKqOS9nOexu+WeiyAqL1xuICBhY3Rpb25UeXBlOiBzdHJpbmc7XG4gIFxuICAvKiog55uu5qCHIElEICovXG4gIHRhcmdldElkPzogc3RyaW5nO1xuICBcbiAgLyoqIOe7k+aenOa2iOaBryAqL1xuICBtZXNzYWdlOiBzdHJpbmc7XG4gIFxuICAvKiog6ZSZ6K+v5L+h5oGv77yI5aaC5p6c5aSx6LSl77yJICovXG4gIGVycm9yPzogc3RyaW5nO1xuICBcbiAgLyoqIOW6leWxguaOp+WItuWKqOS9nOe7k+aenO+8iOWmguaenOacie+8iSAqL1xuICBjb250cm9sUmVzdWx0PzogQ29udHJvbEFjdGlvblJlc3VsdDtcbiAgXG4gIC8qKiDmiafooYzml7bpl7TmiLMgKi9cbiAgZXhlY3V0ZWRBdDogbnVtYmVyO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBFeGVjdXRpb24gQnJpZGdlIOaOpeWPo1xuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgaW50ZXJmYWNlIE9wZXJhdG9yRXhlY3V0aW9uQnJpZGdlIHtcbiAgLyoqXG4gICAqIOaJueWHhuWuoeaJuVxuICAgKi9cbiAgYXBwcm92ZUFwcHJvdmFsKGlkOiBzdHJpbmcsIGFjdG9ySWQ/OiBzdHJpbmcpOiBQcm9taXNlPEV4ZWN1dGlvblJlc3VsdD47XG4gIFxuICAvKipcbiAgICog5ouS57ud5a6h5om5XG4gICAqL1xuICByZWplY3RBcHByb3ZhbChpZDogc3RyaW5nLCBhY3RvcklkPzogc3RyaW5nKTogUHJvbWlzZTxFeGVjdXRpb25SZXN1bHQ+O1xuICBcbiAgLyoqXG4gICAqIOehruiupOS6i+S7tlxuICAgKi9cbiAgYWNrSW5jaWRlbnQoaWQ6IHN0cmluZywgYWN0b3JJZD86IHN0cmluZyk6IFByb21pc2U8RXhlY3V0aW9uUmVzdWx0PjtcbiAgXG4gIC8qKlxuICAgKiDph43or5Xku7vliqFcbiAgICovXG4gIHJldHJ5VGFzayhpZDogc3RyaW5nLCBhY3RvcklkPzogc3RyaW5nKTogUHJvbWlzZTxFeGVjdXRpb25SZXN1bHQ+O1xuICBcbiAgLyoqXG4gICAqIOaaguWBnCBBZ2VudFxuICAgKi9cbiAgcGF1c2VBZ2VudChpZDogc3RyaW5nLCBhY3RvcklkPzogc3RyaW5nKTogUHJvbWlzZTxFeGVjdXRpb25SZXN1bHQ+O1xuICBcbiAgLyoqXG4gICAqIOaBouWkjSBBZ2VudFxuICAgKi9cbiAgcmVzdW1lQWdlbnQoaWQ6IHN0cmluZywgYWN0b3JJZD86IHN0cmluZyk6IFByb21pc2U8RXhlY3V0aW9uUmVzdWx0PjtcbiAgXG4gIC8qKlxuICAgKiDmo4Dmn6UgQWdlbnRcbiAgICovXG4gIGluc3BlY3RBZ2VudChpZDogc3RyaW5nLCBhY3RvcklkPzogc3RyaW5nKTogUHJvbWlzZTxFeGVjdXRpb25SZXN1bHQ+O1xuICBcbiAgLyoqXG4gICAqIOWPlua2iOS7u+WKoVxuICAgKi9cbiAgY2FuY2VsVGFzayhpZDogc3RyaW5nLCBhY3RvcklkPzogc3RyaW5nKTogUHJvbWlzZTxFeGVjdXRpb25SZXN1bHQ+O1xuICBcbiAgLyoqXG4gICAqIOaaguWBnOS7u+WKoVxuICAgKi9cbiAgcGF1c2VUYXNrKGlkOiBzdHJpbmcsIGFjdG9ySWQ/OiBzdHJpbmcpOiBQcm9taXNlPEV4ZWN1dGlvblJlc3VsdD47XG4gIFxuICAvKipcbiAgICog5oGi5aSN5Lu75YqhXG4gICAqL1xuICByZXN1bWVUYXNrKGlkOiBzdHJpbmcsIGFjdG9ySWQ/OiBzdHJpbmcpOiBQcm9taXNlPEV4ZWN1dGlvblJlc3VsdD47XG4gIFxuICAvKipcbiAgICog5Y2H57qn5a6h5om5L+S6i+S7tlxuICAgKi9cbiAgZXNjYWxhdGUodGFyZ2V0VHlwZTogc3RyaW5nLCBpZDogc3RyaW5nLCBhY3RvcklkPzogc3RyaW5nKTogUHJvbWlzZTxFeGVjdXRpb25SZXN1bHQ+O1xuICBcbiAgLyoqXG4gICAqIOivt+axguaBouWkjVxuICAgKi9cbiAgcmVxdWVzdFJlY292ZXJ5KGlkOiBzdHJpbmcsIGFjdG9ySWQ/OiBzdHJpbmcpOiBQcm9taXNlPEV4ZWN1dGlvblJlc3VsdD47XG4gIFxuICAvKipcbiAgICog6K+35rGC6YeN5pS+XG4gICAqL1xuICByZXF1ZXN0UmVwbGF5KGlkOiBzdHJpbmcsIGFjdG9ySWQ/OiBzdHJpbmcpOiBQcm9taXNlPEV4ZWN1dGlvblJlc3VsdD47XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOmFjee9rlxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgaW50ZXJmYWNlIE9wZXJhdG9yRXhlY3V0aW9uQnJpZGdlQ29uZmlnIHtcbiAgLyoqIOaYr+WQpuWQr+eUqOecn+WunuaJp+ihjO+8iOm7mOiupCBmYWxzZSA9IOaooeaLn+aooeW8j++8iSAqL1xuICBlbmFibGVSZWFsRXhlY3V0aW9uPzogYm9vbGVhbjtcbiAgXG4gIC8qKiBDb250cm9sU3VyZmFjZUJ1aWxkZXIg5a6e5L6L77yI55So5LqO55yf5a6e5omn6KGM77yJICovXG4gIGNvbnRyb2xTdXJmYWNlQnVpbGRlcj86IENvbnRyb2xTdXJmYWNlQnVpbGRlcjtcbiAgXG4gIC8qKiBIdW1hbkxvb3BTZXJ2aWNlIOWunuS+i++8iOeUqOS6jiBISVRMIOWKqOS9nO+8iSAqL1xuICBodW1hbkxvb3BTZXJ2aWNlPzogSHVtYW5Mb29wU2VydmljZTtcbiAgXG4gIC8qKiDmiafooYznrZbnlaXvvIjnlKjkuo4gcGVyLWFjdGlvbiDmjqfliLbvvIkgKi9cbiAgZXhlY3V0aW9uUG9saWN5PzogRXhlY3V0aW9uUG9saWN5O1xuICBcbiAgLyoqIOaVsOaNrua6kO+8iOeUqOS6jueKtuaAgeWQjOatpe+8iSAqL1xuICB0YXNrRGF0YVNvdXJjZT86IFRhc2tEYXRhU291cmNlO1xuICBhcHByb3ZhbERhdGFTb3VyY2U/OiBBcHByb3ZhbERhdGFTb3VyY2U7XG4gIGluY2lkZW50RGF0YVNvdXJjZT86IEluY2lkZW50RGF0YVNvdXJjZTtcbiAgYWdlbnREYXRhU291cmNlPzogQWdlbnREYXRhU291cmNlO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDpu5jorqTlrp7njrBcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGNsYXNzIERlZmF1bHRPcGVyYXRvckV4ZWN1dGlvbkJyaWRnZSBpbXBsZW1lbnRzIE9wZXJhdG9yRXhlY3V0aW9uQnJpZGdlIHtcbiAgcHJpdmF0ZSBjb25maWc6IFJlcXVpcmVkPE9wZXJhdG9yRXhlY3V0aW9uQnJpZGdlQ29uZmlnPjtcbiAgXG4gIGNvbnN0cnVjdG9yKGNvbmZpZzogT3BlcmF0b3JFeGVjdXRpb25CcmlkZ2VDb25maWcgPSB7fSkge1xuICAgIHRoaXMuY29uZmlnID0ge1xuICAgICAgZW5hYmxlUmVhbEV4ZWN1dGlvbjogY29uZmlnLmVuYWJsZVJlYWxFeGVjdXRpb24gPz8gZmFsc2UsXG4gICAgICBjb250cm9sU3VyZmFjZUJ1aWxkZXI6IGNvbmZpZy5jb250cm9sU3VyZmFjZUJ1aWxkZXIgPz8gbnVsbCxcbiAgICAgIGh1bWFuTG9vcFNlcnZpY2U6IGNvbmZpZy5odW1hbkxvb3BTZXJ2aWNlID8/IG51bGwsXG4gICAgICBleGVjdXRpb25Qb2xpY3k6IGNvbmZpZy5leGVjdXRpb25Qb2xpY3kgPz8gbnVsbCxcbiAgICAgIHRhc2tEYXRhU291cmNlOiBjb25maWcudGFza0RhdGFTb3VyY2UgPz8gbnVsbCxcbiAgICAgIGFwcHJvdmFsRGF0YVNvdXJjZTogY29uZmlnLmFwcHJvdmFsRGF0YVNvdXJjZSA/PyBudWxsLFxuICAgICAgaW5jaWRlbnREYXRhU291cmNlOiBjb25maWcuaW5jaWRlbnREYXRhU291cmNlID8/IG51bGwsXG4gICAgICBhZ2VudERhdGFTb3VyY2U6IGNvbmZpZy5hZ2VudERhdGFTb3VyY2UgPz8gbnVsbCxcbiAgICB9IGFzIFJlcXVpcmVkPE9wZXJhdG9yRXhlY3V0aW9uQnJpZGdlQ29uZmlnPjtcbiAgfVxuICBcbiAgYXN5bmMgYXBwcm92ZUFwcHJvdmFsKGlkOiBzdHJpbmcsIGFjdG9ySWQ/OiBzdHJpbmcpOiBQcm9taXNlPEV4ZWN1dGlvblJlc3VsdD4ge1xuICAgIC8vIOajgOafpeaJp+ihjOetlueVpVxuICAgIGNvbnN0IG1vZGUgPSB0aGlzLmdldEV4ZWN1dGlvbk1vZGUoJ2FwcHJvdmUnKTtcbiAgICBcbiAgICBpZiAobW9kZSA9PT0gJ3JlYWwnICYmIHRoaXMuY29uZmlnLmNvbnRyb2xTdXJmYWNlQnVpbGRlcikge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5jb25maWcuY29udHJvbFN1cmZhY2VCdWlsZGVyLmRpc3BhdGNoQ29udHJvbEFjdGlvbih7XG4gICAgICAgICAgdHlwZTogJ2FwcHJvdmUnLFxuICAgICAgICAgIHRhcmdldFR5cGU6ICdhcHByb3ZhbCcsXG4gICAgICAgICAgdGFyZ2V0SWQ6IGlkLFxuICAgICAgICAgIHJlcXVlc3RlZEJ5OiBhY3RvcklkIHx8ICdvcGVyYXRvcicsXG4gICAgICAgICAgcmVxdWVzdGVkQXQ6IERhdGUubm93KCksXG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgLy8g5ZCM5q2l54q25oCB5Yiw5pWw5o2u5rqQXG4gICAgICAgIGlmIChyZXN1bHQuc3VjY2VzcyAmJiB0aGlzLmNvbmZpZy5hcHByb3ZhbERhdGFTb3VyY2UpIHtcbiAgICAgICAgICB0aGlzLmNvbmZpZy5hcHByb3ZhbERhdGFTb3VyY2UudXBkYXRlQXBwcm92YWxTdGF0dXMoaWQsICdhcHByb3ZlZCcsIGFjdG9ySWQpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHN1Y2Nlc3M6IHJlc3VsdC5zdWNjZXNzLFxuICAgICAgICAgIGV4ZWN1dGlvbk1vZGU6ICdyZWFsJyxcbiAgICAgICAgICBhY3Rpb25UeXBlOiAnYXBwcm92ZScsXG4gICAgICAgICAgdGFyZ2V0SWQ6IGlkLFxuICAgICAgICAgIG1lc3NhZ2U6IHJlc3VsdC5tZXNzYWdlIHx8IGBBcHByb3ZhbCAke2lkfSBhcHByb3ZlZGAsXG4gICAgICAgICAgZXJyb3I6IHJlc3VsdC5lcnJvcixcbiAgICAgICAgICBjb250cm9sUmVzdWx0OiByZXN1bHQsXG4gICAgICAgICAgZXhlY3V0ZWRBdDogRGF0ZS5ub3coKSxcbiAgICAgICAgfTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgZXhlY3V0aW9uTW9kZTogJ3JlYWwnLFxuICAgICAgICAgIGFjdGlvblR5cGU6ICdhcHByb3ZlJyxcbiAgICAgICAgICB0YXJnZXRJZDogaWQsXG4gICAgICAgICAgbWVzc2FnZTogYEZhaWxlZCB0byBhcHByb3ZlICR7aWR9YCxcbiAgICAgICAgICBlcnJvcjogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpLFxuICAgICAgICAgIGV4ZWN1dGVkQXQ6IERhdGUubm93KCksXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIOaooeaLn+aJp+ihjOi3r+W+hFxuICAgIHJldHVybiB0aGlzLmJ1aWxkU2ltdWxhdGVkUmVzdWx0KCdhcHByb3ZlJywgaWQsIGBBcHByb3ZhbCAke2lkfSBhcHByb3ZlZGApO1xuICB9XG4gIFxuICBhc3luYyByZWplY3RBcHByb3ZhbChpZDogc3RyaW5nLCBhY3RvcklkPzogc3RyaW5nKTogUHJvbWlzZTxFeGVjdXRpb25SZXN1bHQ+IHtcbiAgICBjb25zdCBtb2RlID0gdGhpcy5nZXRFeGVjdXRpb25Nb2RlKCdyZWplY3QnKTtcbiAgICBcbiAgICBpZiAobW9kZSA9PT0gJ3JlYWwnICYmIHRoaXMuY29uZmlnLmNvbnRyb2xTdXJmYWNlQnVpbGRlcikge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5jb25maWcuY29udHJvbFN1cmZhY2VCdWlsZGVyLmRpc3BhdGNoQ29udHJvbEFjdGlvbih7XG4gICAgICAgICAgdHlwZTogJ3JlamVjdCcsXG4gICAgICAgICAgdGFyZ2V0VHlwZTogJ2FwcHJvdmFsJyxcbiAgICAgICAgICB0YXJnZXRJZDogaWQsXG4gICAgICAgICAgcmVxdWVzdGVkQnk6IGFjdG9ySWQgfHwgJ29wZXJhdG9yJyxcbiAgICAgICAgICByZXF1ZXN0ZWRBdDogRGF0ZS5ub3coKSxcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MgJiYgdGhpcy5jb25maWcuYXBwcm92YWxEYXRhU291cmNlKSB7XG4gICAgICAgICAgdGhpcy5jb25maWcuYXBwcm92YWxEYXRhU291cmNlLnVwZGF0ZUFwcHJvdmFsU3RhdHVzKGlkLCAncmVqZWN0ZWQnLCBhY3RvcklkKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBzdWNjZXNzOiByZXN1bHQuc3VjY2VzcyxcbiAgICAgICAgICBleGVjdXRpb25Nb2RlOiAncmVhbCcsXG4gICAgICAgICAgYWN0aW9uVHlwZTogJ3JlamVjdCcsXG4gICAgICAgICAgdGFyZ2V0SWQ6IGlkLFxuICAgICAgICAgIG1lc3NhZ2U6IHJlc3VsdC5tZXNzYWdlIHx8IGBBcHByb3ZhbCAke2lkfSByZWplY3RlZGAsXG4gICAgICAgICAgZXJyb3I6IHJlc3VsdC5lcnJvcixcbiAgICAgICAgICBjb250cm9sUmVzdWx0OiByZXN1bHQsXG4gICAgICAgICAgZXhlY3V0ZWRBdDogRGF0ZS5ub3coKSxcbiAgICAgICAgfTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgZXhlY3V0aW9uTW9kZTogJ3JlYWwnLFxuICAgICAgICAgIGFjdGlvblR5cGU6ICdyZWplY3QnLFxuICAgICAgICAgIHRhcmdldElkOiBpZCxcbiAgICAgICAgICBtZXNzYWdlOiBgRmFpbGVkIHRvIHJlamVjdCAke2lkfWAsXG4gICAgICAgICAgZXJyb3I6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKSxcbiAgICAgICAgICBleGVjdXRlZEF0OiBEYXRlLm5vdygpLFxuICAgICAgICB9O1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gdGhpcy5idWlsZFNpbXVsYXRlZFJlc3VsdCgncmVqZWN0JywgaWQsIGBBcHByb3ZhbCAke2lkfSByZWplY3RlZGApO1xuICB9XG4gIFxuICBhc3luYyBhY2tJbmNpZGVudChpZDogc3RyaW5nLCBhY3RvcklkPzogc3RyaW5nKTogUHJvbWlzZTxFeGVjdXRpb25SZXN1bHQ+IHtcbiAgICBjb25zdCBtb2RlID0gdGhpcy5nZXRFeGVjdXRpb25Nb2RlKCdhY2tfaW5jaWRlbnQnKTtcbiAgICBcbiAgICBpZiAobW9kZSA9PT0gJ3JlYWwnICYmIHRoaXMuY29uZmlnLmNvbnRyb2xTdXJmYWNlQnVpbGRlcikge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5jb25maWcuY29udHJvbFN1cmZhY2VCdWlsZGVyLmRpc3BhdGNoQ29udHJvbEFjdGlvbih7XG4gICAgICAgICAgdHlwZTogJ2Fja19pbmNpZGVudCcsXG4gICAgICAgICAgdGFyZ2V0VHlwZTogJ2luY2lkZW50JyxcbiAgICAgICAgICB0YXJnZXRJZDogaWQsXG4gICAgICAgICAgcmVxdWVzdGVkQnk6IGFjdG9ySWQgfHwgJ29wZXJhdG9yJyxcbiAgICAgICAgICByZXF1ZXN0ZWRBdDogRGF0ZS5ub3coKSxcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MgJiYgdGhpcy5jb25maWcuaW5jaWRlbnREYXRhU291cmNlKSB7XG4gICAgICAgICAgdGhpcy5jb25maWcuaW5jaWRlbnREYXRhU291cmNlLmFja25vd2xlZGdlSW5jaWRlbnQoaWQsIGFjdG9ySWQpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHN1Y2Nlc3M6IHJlc3VsdC5zdWNjZXNzLFxuICAgICAgICAgIGV4ZWN1dGlvbk1vZGU6ICdyZWFsJyxcbiAgICAgICAgICBhY3Rpb25UeXBlOiAnYWNrX2luY2lkZW50JyxcbiAgICAgICAgICB0YXJnZXRJZDogaWQsXG4gICAgICAgICAgbWVzc2FnZTogcmVzdWx0Lm1lc3NhZ2UgfHwgYEluY2lkZW50ICR7aWR9IGFja25vd2xlZGdlZGAsXG4gICAgICAgICAgZXJyb3I6IHJlc3VsdC5lcnJvcixcbiAgICAgICAgICBjb250cm9sUmVzdWx0OiByZXN1bHQsXG4gICAgICAgICAgZXhlY3V0ZWRBdDogRGF0ZS5ub3coKSxcbiAgICAgICAgfTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgZXhlY3V0aW9uTW9kZTogJ3JlYWwnLFxuICAgICAgICAgIGFjdGlvblR5cGU6ICdhY2tfaW5jaWRlbnQnLFxuICAgICAgICAgIHRhcmdldElkOiBpZCxcbiAgICAgICAgICBtZXNzYWdlOiBgRmFpbGVkIHRvIGFja25vd2xlZGdlICR7aWR9YCxcbiAgICAgICAgICBlcnJvcjogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpLFxuICAgICAgICAgIGV4ZWN1dGVkQXQ6IERhdGUubm93KCksXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB0aGlzLmJ1aWxkU2ltdWxhdGVkUmVzdWx0KCdhY2tfaW5jaWRlbnQnLCBpZCwgYEluY2lkZW50ICR7aWR9IGFja25vd2xlZGdlZGApO1xuICB9XG4gIFxuICBhc3luYyByZXRyeVRhc2soaWQ6IHN0cmluZywgYWN0b3JJZD86IHN0cmluZyk6IFByb21pc2U8RXhlY3V0aW9uUmVzdWx0PiB7XG4gICAgY29uc3QgbW9kZSA9IHRoaXMuZ2V0RXhlY3V0aW9uTW9kZSgncmV0cnlfdGFzaycpO1xuICAgIFxuICAgIGlmIChtb2RlID09PSAncmVhbCcgJiYgdGhpcy5jb25maWcuY29udHJvbFN1cmZhY2VCdWlsZGVyKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmNvbmZpZy5jb250cm9sU3VyZmFjZUJ1aWxkZXIuZGlzcGF0Y2hDb250cm9sQWN0aW9uKHtcbiAgICAgICAgICB0eXBlOiAncmV0cnlfdGFzaycsXG4gICAgICAgICAgdGFyZ2V0VHlwZTogJ3Rhc2snLFxuICAgICAgICAgIHRhcmdldElkOiBpZCxcbiAgICAgICAgICByZXF1ZXN0ZWRCeTogYWN0b3JJZCB8fCAnb3BlcmF0b3InLFxuICAgICAgICAgIHJlcXVlc3RlZEF0OiBEYXRlLm5vdygpLFxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIGlmIChyZXN1bHQuc3VjY2VzcyAmJiB0aGlzLmNvbmZpZy50YXNrRGF0YVNvdXJjZSkge1xuICAgICAgICAgIHRoaXMuY29uZmlnLnRhc2tEYXRhU291cmNlLnVwZGF0ZVRhc2tTdGF0dXMoaWQsICdydW5uaW5nJyk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgc3VjY2VzczogcmVzdWx0LnN1Y2Nlc3MsXG4gICAgICAgICAgZXhlY3V0aW9uTW9kZTogJ3JlYWwnLFxuICAgICAgICAgIGFjdGlvblR5cGU6ICdyZXRyeV90YXNrJyxcbiAgICAgICAgICB0YXJnZXRJZDogaWQsXG4gICAgICAgICAgbWVzc2FnZTogcmVzdWx0Lm1lc3NhZ2UgfHwgYFRhc2sgJHtpZH0gcmV0cnkgaW5pdGlhdGVkYCxcbiAgICAgICAgICBlcnJvcjogcmVzdWx0LmVycm9yLFxuICAgICAgICAgIGNvbnRyb2xSZXN1bHQ6IHJlc3VsdCxcbiAgICAgICAgICBleGVjdXRlZEF0OiBEYXRlLm5vdygpLFxuICAgICAgICB9O1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICBleGVjdXRpb25Nb2RlOiAncmVhbCcsXG4gICAgICAgICAgYWN0aW9uVHlwZTogJ3JldHJ5X3Rhc2snLFxuICAgICAgICAgIHRhcmdldElkOiBpZCxcbiAgICAgICAgICBtZXNzYWdlOiBgRmFpbGVkIHRvIHJldHJ5ICR7aWR9YCxcbiAgICAgICAgICBlcnJvcjogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpLFxuICAgICAgICAgIGV4ZWN1dGVkQXQ6IERhdGUubm93KCksXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB0aGlzLmJ1aWxkU2ltdWxhdGVkUmVzdWx0KCdyZXRyeV90YXNrJywgaWQsIGBUYXNrICR7aWR9IHJldHJ5IGluaXRpYXRlZGApO1xuICB9XG4gIFxuICBhc3luYyBwYXVzZUFnZW50KGlkOiBzdHJpbmcsIGFjdG9ySWQ/OiBzdHJpbmcpOiBQcm9taXNlPEV4ZWN1dGlvblJlc3VsdD4ge1xuICAgIGNvbnN0IG1vZGUgPSB0aGlzLmdldEV4ZWN1dGlvbk1vZGUoJ3BhdXNlX2FnZW50Jyk7XG4gICAgXG4gICAgaWYgKG1vZGUgPT09ICdyZWFsJyAmJiB0aGlzLmNvbmZpZy5jb250cm9sU3VyZmFjZUJ1aWxkZXIpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuY29uZmlnLmNvbnRyb2xTdXJmYWNlQnVpbGRlci5kaXNwYXRjaENvbnRyb2xBY3Rpb24oe1xuICAgICAgICAgIHR5cGU6ICdwYXVzZV9hZ2VudCcsXG4gICAgICAgICAgdGFyZ2V0VHlwZTogJ2FnZW50JyxcbiAgICAgICAgICB0YXJnZXRJZDogaWQsXG4gICAgICAgICAgcmVxdWVzdGVkQnk6IGFjdG9ySWQgfHwgJ29wZXJhdG9yJyxcbiAgICAgICAgICByZXF1ZXN0ZWRBdDogRGF0ZS5ub3coKSxcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MgJiYgdGhpcy5jb25maWcuYWdlbnREYXRhU291cmNlKSB7XG4gICAgICAgICAgdGhpcy5jb25maWcuYWdlbnREYXRhU291cmNlLnVwZGF0ZUFnZW50U3RhdHVzKGlkLCAncGF1c2VkJyk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgc3VjY2VzczogcmVzdWx0LnN1Y2Nlc3MsXG4gICAgICAgICAgZXhlY3V0aW9uTW9kZTogJ3JlYWwnLFxuICAgICAgICAgIGFjdGlvblR5cGU6ICdwYXVzZV9hZ2VudCcsXG4gICAgICAgICAgdGFyZ2V0SWQ6IGlkLFxuICAgICAgICAgIG1lc3NhZ2U6IHJlc3VsdC5tZXNzYWdlIHx8IGBBZ2VudCAke2lkfSBwYXVzZWRgLFxuICAgICAgICAgIGVycm9yOiByZXN1bHQuZXJyb3IsXG4gICAgICAgICAgY29udHJvbFJlc3VsdDogcmVzdWx0LFxuICAgICAgICAgIGV4ZWN1dGVkQXQ6IERhdGUubm93KCksXG4gICAgICAgIH07XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgIGV4ZWN1dGlvbk1vZGU6ICdyZWFsJyxcbiAgICAgICAgICBhY3Rpb25UeXBlOiAncGF1c2VfYWdlbnQnLFxuICAgICAgICAgIHRhcmdldElkOiBpZCxcbiAgICAgICAgICBtZXNzYWdlOiBgRmFpbGVkIHRvIHBhdXNlICR7aWR9YCxcbiAgICAgICAgICBlcnJvcjogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpLFxuICAgICAgICAgIGV4ZWN1dGVkQXQ6IERhdGUubm93KCksXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB0aGlzLmJ1aWxkU2ltdWxhdGVkUmVzdWx0KCdwYXVzZV9hZ2VudCcsIGlkLCBgQWdlbnQgJHtpZH0gcGF1c2VkYCk7XG4gIH1cbiAgXG4gIGFzeW5jIHJlc3VtZUFnZW50KGlkOiBzdHJpbmcsIGFjdG9ySWQ/OiBzdHJpbmcpOiBQcm9taXNlPEV4ZWN1dGlvblJlc3VsdD4ge1xuICAgIGlmICh0aGlzLmNvbmZpZy5lbmFibGVSZWFsRXhlY3V0aW9uICYmIHRoaXMuY29uZmlnLmNvbnRyb2xTdXJmYWNlQnVpbGRlcikge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5jb25maWcuY29udHJvbFN1cmZhY2VCdWlsZGVyLmRpc3BhdGNoQ29udHJvbEFjdGlvbih7XG4gICAgICAgICAgdHlwZTogJ3Jlc3VtZV9hZ2VudCcsXG4gICAgICAgICAgdGFyZ2V0VHlwZTogJ2FnZW50JyxcbiAgICAgICAgICB0YXJnZXRJZDogaWQsXG4gICAgICAgICAgcmVxdWVzdGVkQnk6IGFjdG9ySWQgfHwgJ29wZXJhdG9yJyxcbiAgICAgICAgICByZXF1ZXN0ZWRBdDogRGF0ZS5ub3coKSxcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHN1Y2Nlc3M6IHJlc3VsdC5zdWNjZXNzLFxuICAgICAgICAgIGV4ZWN1dGlvbk1vZGU6ICdyZWFsJyxcbiAgICAgICAgICBhY3Rpb25UeXBlOiAncmVzdW1lX2FnZW50JyxcbiAgICAgICAgICB0YXJnZXRJZDogaWQsXG4gICAgICAgICAgbWVzc2FnZTogcmVzdWx0Lm1lc3NhZ2UgfHwgYEFnZW50ICR7aWR9IHJlc3VtZWRgLFxuICAgICAgICAgIGVycm9yOiByZXN1bHQuZXJyb3IsXG4gICAgICAgICAgY29udHJvbFJlc3VsdDogcmVzdWx0LFxuICAgICAgICAgIGV4ZWN1dGVkQXQ6IERhdGUubm93KCksXG4gICAgICAgIH07XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgIGV4ZWN1dGlvbk1vZGU6ICdyZWFsJyxcbiAgICAgICAgICBhY3Rpb25UeXBlOiAncmVzdW1lX2FnZW50JyxcbiAgICAgICAgICB0YXJnZXRJZDogaWQsXG4gICAgICAgICAgbWVzc2FnZTogYEZhaWxlZCB0byByZXN1bWUgJHtpZH1gLFxuICAgICAgICAgIGVycm9yOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvciksXG4gICAgICAgICAgZXhlY3V0ZWRBdDogRGF0ZS5ub3coKSxcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHRoaXMuYnVpbGRTaW11bGF0ZWRSZXN1bHQoJ3Jlc3VtZV9hZ2VudCcsIGlkLCBgQWdlbnQgJHtpZH0gcmVzdW1lZGApO1xuICB9XG4gIFxuICBhc3luYyBpbnNwZWN0QWdlbnQoaWQ6IHN0cmluZywgYWN0b3JJZD86IHN0cmluZyk6IFByb21pc2U8RXhlY3V0aW9uUmVzdWx0PiB7XG4gICAgaWYgKHRoaXMuY29uZmlnLmVuYWJsZVJlYWxFeGVjdXRpb24gJiYgdGhpcy5jb25maWcuY29udHJvbFN1cmZhY2VCdWlsZGVyKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmNvbmZpZy5jb250cm9sU3VyZmFjZUJ1aWxkZXIuZGlzcGF0Y2hDb250cm9sQWN0aW9uKHtcbiAgICAgICAgICB0eXBlOiAnaW5zcGVjdF9hZ2VudCcsXG4gICAgICAgICAgdGFyZ2V0VHlwZTogJ2FnZW50JyxcbiAgICAgICAgICB0YXJnZXRJZDogaWQsXG4gICAgICAgICAgcmVxdWVzdGVkQnk6IGFjdG9ySWQgfHwgJ29wZXJhdG9yJyxcbiAgICAgICAgICByZXF1ZXN0ZWRBdDogRGF0ZS5ub3coKSxcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHN1Y2Nlc3M6IHJlc3VsdC5zdWNjZXNzLFxuICAgICAgICAgIGV4ZWN1dGlvbk1vZGU6ICdyZWFsJyxcbiAgICAgICAgICBhY3Rpb25UeXBlOiAnaW5zcGVjdF9hZ2VudCcsXG4gICAgICAgICAgdGFyZ2V0SWQ6IGlkLFxuICAgICAgICAgIG1lc3NhZ2U6IHJlc3VsdC5tZXNzYWdlIHx8IGBBZ2VudCAke2lkfSBpbnNwZWN0aW9uIG9wZW5lZGAsXG4gICAgICAgICAgZXJyb3I6IHJlc3VsdC5lcnJvcixcbiAgICAgICAgICBjb250cm9sUmVzdWx0OiByZXN1bHQsXG4gICAgICAgICAgZXhlY3V0ZWRBdDogRGF0ZS5ub3coKSxcbiAgICAgICAgfTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgZXhlY3V0aW9uTW9kZTogJ3JlYWwnLFxuICAgICAgICAgIGFjdGlvblR5cGU6ICdpbnNwZWN0X2FnZW50JyxcbiAgICAgICAgICB0YXJnZXRJZDogaWQsXG4gICAgICAgICAgbWVzc2FnZTogYEZhaWxlZCB0byBpbnNwZWN0ICR7aWR9YCxcbiAgICAgICAgICBlcnJvcjogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpLFxuICAgICAgICAgIGV4ZWN1dGVkQXQ6IERhdGUubm93KCksXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB0aGlzLmJ1aWxkU2ltdWxhdGVkUmVzdWx0KCdpbnNwZWN0X2FnZW50JywgaWQsIGBBZ2VudCAke2lkfSBpbnNwZWN0aW9uIG9wZW5lZGApO1xuICB9XG4gIFxuICBhc3luYyBjYW5jZWxUYXNrKGlkOiBzdHJpbmcsIGFjdG9ySWQ/OiBzdHJpbmcpOiBQcm9taXNlPEV4ZWN1dGlvblJlc3VsdD4ge1xuICAgIGlmICh0aGlzLmNvbmZpZy5lbmFibGVSZWFsRXhlY3V0aW9uICYmIHRoaXMuY29uZmlnLmNvbnRyb2xTdXJmYWNlQnVpbGRlcikge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5jb25maWcuY29udHJvbFN1cmZhY2VCdWlsZGVyLmRpc3BhdGNoQ29udHJvbEFjdGlvbih7XG4gICAgICAgICAgdHlwZTogJ2NhbmNlbF90YXNrJyxcbiAgICAgICAgICB0YXJnZXRUeXBlOiAndGFzaycsXG4gICAgICAgICAgdGFyZ2V0SWQ6IGlkLFxuICAgICAgICAgIHJlcXVlc3RlZEJ5OiBhY3RvcklkIHx8ICdvcGVyYXRvcicsXG4gICAgICAgICAgcmVxdWVzdGVkQXQ6IERhdGUubm93KCksXG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBzdWNjZXNzOiByZXN1bHQuc3VjY2VzcyxcbiAgICAgICAgICBleGVjdXRpb25Nb2RlOiAncmVhbCcsXG4gICAgICAgICAgYWN0aW9uVHlwZTogJ2NhbmNlbF90YXNrJyxcbiAgICAgICAgICB0YXJnZXRJZDogaWQsXG4gICAgICAgICAgbWVzc2FnZTogcmVzdWx0Lm1lc3NhZ2UgfHwgYFRhc2sgJHtpZH0gY2FuY2VsbGVkYCxcbiAgICAgICAgICBlcnJvcjogcmVzdWx0LmVycm9yLFxuICAgICAgICAgIGNvbnRyb2xSZXN1bHQ6IHJlc3VsdCxcbiAgICAgICAgICBleGVjdXRlZEF0OiBEYXRlLm5vdygpLFxuICAgICAgICB9O1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICBleGVjdXRpb25Nb2RlOiAncmVhbCcsXG4gICAgICAgICAgYWN0aW9uVHlwZTogJ2NhbmNlbF90YXNrJyxcbiAgICAgICAgICB0YXJnZXRJZDogaWQsXG4gICAgICAgICAgbWVzc2FnZTogYEZhaWxlZCB0byBjYW5jZWwgJHtpZH1gLFxuICAgICAgICAgIGVycm9yOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvciksXG4gICAgICAgICAgZXhlY3V0ZWRBdDogRGF0ZS5ub3coKSxcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHRoaXMuYnVpbGRTaW11bGF0ZWRSZXN1bHQoJ2NhbmNlbF90YXNrJywgaWQsIGBUYXNrICR7aWR9IGNhbmNlbGxlZGApO1xuICB9XG4gIFxuICBhc3luYyBwYXVzZVRhc2soaWQ6IHN0cmluZywgYWN0b3JJZD86IHN0cmluZyk6IFByb21pc2U8RXhlY3V0aW9uUmVzdWx0PiB7XG4gICAgaWYgKHRoaXMuY29uZmlnLmVuYWJsZVJlYWxFeGVjdXRpb24gJiYgdGhpcy5jb25maWcuY29udHJvbFN1cmZhY2VCdWlsZGVyKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmNvbmZpZy5jb250cm9sU3VyZmFjZUJ1aWxkZXIuZGlzcGF0Y2hDb250cm9sQWN0aW9uKHtcbiAgICAgICAgICB0eXBlOiAncGF1c2VfdGFzaycsXG4gICAgICAgICAgdGFyZ2V0VHlwZTogJ3Rhc2snLFxuICAgICAgICAgIHRhcmdldElkOiBpZCxcbiAgICAgICAgICByZXF1ZXN0ZWRCeTogYWN0b3JJZCB8fCAnb3BlcmF0b3InLFxuICAgICAgICAgIHJlcXVlc3RlZEF0OiBEYXRlLm5vdygpLFxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgc3VjY2VzczogcmVzdWx0LnN1Y2Nlc3MsXG4gICAgICAgICAgZXhlY3V0aW9uTW9kZTogJ3JlYWwnLFxuICAgICAgICAgIGFjdGlvblR5cGU6ICdwYXVzZV90YXNrJyxcbiAgICAgICAgICB0YXJnZXRJZDogaWQsXG4gICAgICAgICAgbWVzc2FnZTogcmVzdWx0Lm1lc3NhZ2UgfHwgYFRhc2sgJHtpZH0gcGF1c2VkYCxcbiAgICAgICAgICBlcnJvcjogcmVzdWx0LmVycm9yLFxuICAgICAgICAgIGNvbnRyb2xSZXN1bHQ6IHJlc3VsdCxcbiAgICAgICAgICBleGVjdXRlZEF0OiBEYXRlLm5vdygpLFxuICAgICAgICB9O1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICBleGVjdXRpb25Nb2RlOiAncmVhbCcsXG4gICAgICAgICAgYWN0aW9uVHlwZTogJ3BhdXNlX3Rhc2snLFxuICAgICAgICAgIHRhcmdldElkOiBpZCxcbiAgICAgICAgICBtZXNzYWdlOiBgRmFpbGVkIHRvIHBhdXNlICR7aWR9YCxcbiAgICAgICAgICBlcnJvcjogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpLFxuICAgICAgICAgIGV4ZWN1dGVkQXQ6IERhdGUubm93KCksXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB0aGlzLmJ1aWxkU2ltdWxhdGVkUmVzdWx0KCdwYXVzZV90YXNrJywgaWQsIGBUYXNrICR7aWR9IHBhdXNlZGApO1xuICB9XG4gIFxuICBhc3luYyByZXN1bWVUYXNrKGlkOiBzdHJpbmcsIGFjdG9ySWQ/OiBzdHJpbmcpOiBQcm9taXNlPEV4ZWN1dGlvblJlc3VsdD4ge1xuICAgIGlmICh0aGlzLmNvbmZpZy5lbmFibGVSZWFsRXhlY3V0aW9uICYmIHRoaXMuY29uZmlnLmNvbnRyb2xTdXJmYWNlQnVpbGRlcikge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5jb25maWcuY29udHJvbFN1cmZhY2VCdWlsZGVyLmRpc3BhdGNoQ29udHJvbEFjdGlvbih7XG4gICAgICAgICAgdHlwZTogJ3Jlc3VtZV90YXNrJyxcbiAgICAgICAgICB0YXJnZXRUeXBlOiAndGFzaycsXG4gICAgICAgICAgdGFyZ2V0SWQ6IGlkLFxuICAgICAgICAgIHJlcXVlc3RlZEJ5OiBhY3RvcklkIHx8ICdvcGVyYXRvcicsXG4gICAgICAgICAgcmVxdWVzdGVkQXQ6IERhdGUubm93KCksXG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBzdWNjZXNzOiByZXN1bHQuc3VjY2VzcyxcbiAgICAgICAgICBleGVjdXRpb25Nb2RlOiAncmVhbCcsXG4gICAgICAgICAgYWN0aW9uVHlwZTogJ3Jlc3VtZV90YXNrJyxcbiAgICAgICAgICB0YXJnZXRJZDogaWQsXG4gICAgICAgICAgbWVzc2FnZTogcmVzdWx0Lm1lc3NhZ2UgfHwgYFRhc2sgJHtpZH0gcmVzdW1lZGAsXG4gICAgICAgICAgZXJyb3I6IHJlc3VsdC5lcnJvcixcbiAgICAgICAgICBjb250cm9sUmVzdWx0OiByZXN1bHQsXG4gICAgICAgICAgZXhlY3V0ZWRBdDogRGF0ZS5ub3coKSxcbiAgICAgICAgfTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgZXhlY3V0aW9uTW9kZTogJ3JlYWwnLFxuICAgICAgICAgIGFjdGlvblR5cGU6ICdyZXN1bWVfdGFzaycsXG4gICAgICAgICAgdGFyZ2V0SWQ6IGlkLFxuICAgICAgICAgIG1lc3NhZ2U6IGBGYWlsZWQgdG8gcmVzdW1lICR7aWR9YCxcbiAgICAgICAgICBlcnJvcjogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpLFxuICAgICAgICAgIGV4ZWN1dGVkQXQ6IERhdGUubm93KCksXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB0aGlzLmJ1aWxkU2ltdWxhdGVkUmVzdWx0KCdyZXN1bWVfdGFzaycsIGlkLCBgVGFzayAke2lkfSByZXN1bWVkYCk7XG4gIH1cbiAgXG4gIGFzeW5jIGVzY2FsYXRlKHRhcmdldFR5cGU6IHN0cmluZywgaWQ6IHN0cmluZywgYWN0b3JJZD86IHN0cmluZyk6IFByb21pc2U8RXhlY3V0aW9uUmVzdWx0PiB7XG4gICAgaWYgKHRoaXMuY29uZmlnLmVuYWJsZVJlYWxFeGVjdXRpb24gJiYgdGhpcy5jb25maWcuY29udHJvbFN1cmZhY2VCdWlsZGVyKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmNvbmZpZy5jb250cm9sU3VyZmFjZUJ1aWxkZXIuZGlzcGF0Y2hDb250cm9sQWN0aW9uKHtcbiAgICAgICAgICB0eXBlOiAnZXNjYWxhdGVfYXBwcm92YWwnLFxuICAgICAgICAgIHRhcmdldFR5cGU6IHRhcmdldFR5cGUgYXMgYW55LFxuICAgICAgICAgIHRhcmdldElkOiBpZCxcbiAgICAgICAgICByZXF1ZXN0ZWRCeTogYWN0b3JJZCB8fCAnb3BlcmF0b3InLFxuICAgICAgICAgIHJlcXVlc3RlZEF0OiBEYXRlLm5vdygpLFxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgc3VjY2VzczogcmVzdWx0LnN1Y2Nlc3MsXG4gICAgICAgICAgZXhlY3V0aW9uTW9kZTogJ3JlYWwnLFxuICAgICAgICAgIGFjdGlvblR5cGU6ICdlc2NhbGF0ZScsXG4gICAgICAgICAgdGFyZ2V0SWQ6IGlkLFxuICAgICAgICAgIG1lc3NhZ2U6IHJlc3VsdC5tZXNzYWdlIHx8IGAke3RhcmdldFR5cGV9ICR7aWR9IGVzY2FsYXRlZGAsXG4gICAgICAgICAgZXJyb3I6IHJlc3VsdC5lcnJvcixcbiAgICAgICAgICBjb250cm9sUmVzdWx0OiByZXN1bHQsXG4gICAgICAgICAgZXhlY3V0ZWRBdDogRGF0ZS5ub3coKSxcbiAgICAgICAgfTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgZXhlY3V0aW9uTW9kZTogJ3JlYWwnLFxuICAgICAgICAgIGFjdGlvblR5cGU6ICdlc2NhbGF0ZScsXG4gICAgICAgICAgdGFyZ2V0SWQ6IGlkLFxuICAgICAgICAgIG1lc3NhZ2U6IGBGYWlsZWQgdG8gZXNjYWxhdGUgJHtpZH1gLFxuICAgICAgICAgIGVycm9yOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvciksXG4gICAgICAgICAgZXhlY3V0ZWRBdDogRGF0ZS5ub3coKSxcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHRoaXMuYnVpbGRTaW11bGF0ZWRSZXN1bHQoJ2VzY2FsYXRlJywgaWQsIGAke3RhcmdldFR5cGV9ICR7aWR9IGVzY2FsYXRlZGApO1xuICB9XG4gIFxuICBhc3luYyByZXF1ZXN0UmVjb3ZlcnkoaWQ6IHN0cmluZywgYWN0b3JJZD86IHN0cmluZyk6IFByb21pc2U8RXhlY3V0aW9uUmVzdWx0PiB7XG4gICAgcmV0dXJuIHRoaXMuYnVpbGRTaW11bGF0ZWRSZXN1bHQoJ3JlcXVlc3RfcmVjb3ZlcnknLCBpZCwgYFJlY292ZXJ5IHJlcXVlc3RlZCBmb3IgJHtpZH1gKTtcbiAgfVxuICBcbiAgYXN5bmMgcmVxdWVzdFJlcGxheShpZDogc3RyaW5nLCBhY3RvcklkPzogc3RyaW5nKTogUHJvbWlzZTxFeGVjdXRpb25SZXN1bHQ+IHtcbiAgICByZXR1cm4gdGhpcy5idWlsZFNpbXVsYXRlZFJlc3VsdCgncmVxdWVzdF9yZXBsYXknLCBpZCwgYFJlcGxheSByZXF1ZXN0ZWQgZm9yICR7aWR9YCk7XG4gIH1cbiAgXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgLy8g6L6F5Yqp5pa55rOVXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgXG4gIC8qKlxuICAgKiDojrflj5bliqjkvZznmoTmiafooYzmqKHlvI9cbiAgICovXG4gIHByaXZhdGUgZ2V0RXhlY3V0aW9uTW9kZShhY3Rpb25UeXBlOiBzdHJpbmcpOiBFeGVjdXRpb25Nb2RlIHtcbiAgICAvLyDkvJjlhYjkvb/nlKggZXhlY3V0aW9uIHBvbGljeVxuICAgIGlmICh0aGlzLmNvbmZpZy5leGVjdXRpb25Qb2xpY3kpIHtcbiAgICAgIHJldHVybiB0aGlzLmNvbmZpZy5leGVjdXRpb25Qb2xpY3kuZ2V0RXhlY3V0aW9uTW9kZShhY3Rpb25UeXBlIGFzIGFueSk7XG4gICAgfVxuICAgIFxuICAgIC8vIOWbnumAgOWIsOWFqOWxgOW8gOWFs1xuICAgIHJldHVybiB0aGlzLmNvbmZpZy5lbmFibGVSZWFsRXhlY3V0aW9uID8gJ3JlYWwnIDogJ3NpbXVsYXRlZCc7XG4gIH1cbiAgXG4gIHByaXZhdGUgYnVpbGRTaW11bGF0ZWRSZXN1bHQoYWN0aW9uVHlwZTogc3RyaW5nLCB0YXJnZXRJZDogc3RyaW5nLCBtZXNzYWdlOiBzdHJpbmcpOiBFeGVjdXRpb25SZXN1bHQge1xuICAgIHJldHVybiB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgZXhlY3V0aW9uTW9kZTogJ3NpbXVsYXRlZCcsXG4gICAgICBhY3Rpb25UeXBlLFxuICAgICAgdGFyZ2V0SWQsXG4gICAgICBtZXNzYWdlLFxuICAgICAgZXhlY3V0ZWRBdDogRGF0ZS5ub3coKSxcbiAgICB9O1xuICB9XG4gIFxuICAvKipcbiAgICog5ZCv55So55yf5a6e5omn6KGMXG4gICAqL1xuICBlbmFibGVSZWFsRXhlY3V0aW9uKCk6IHZvaWQge1xuICAgIHRoaXMuY29uZmlnLmVuYWJsZVJlYWxFeGVjdXRpb24gPSB0cnVlO1xuICAgIHRoaXMuY29uZmlnLmV4ZWN1dGlvblBvbGljeT8uZW5hYmxlUmVhbEV4ZWN1dGlvbigpO1xuICB9XG4gIFxuICAvKipcbiAgICog56aB55So55yf5a6e5omn6KGM77yI5qih5ouf5qih5byP77yJXG4gICAqL1xuICBkaXNhYmxlUmVhbEV4ZWN1dGlvbigpOiB2b2lkIHtcbiAgICB0aGlzLmNvbmZpZy5lbmFibGVSZWFsRXhlY3V0aW9uID0gZmFsc2U7XG4gICAgdGhpcy5jb25maWcuZXhlY3V0aW9uUG9saWN5Py5kaXNhYmxlUmVhbEV4ZWN1dGlvbigpO1xuICB9XG4gIFxuICAvKipcbiAgICog5qOA5p+l5piv5ZCm5ZCv55So55yf5a6e5omn6KGMXG4gICAqL1xuICBpc1JlYWxFeGVjdXRpb25FbmFibGVkKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLmNvbmZpZy5lbmFibGVSZWFsRXhlY3V0aW9uO1xuICB9XG4gIFxuICAvKipcbiAgICog6K6+572u5Yqo5L2c55qE5omn6KGM5qih5byPXG4gICAqL1xuICBzZXRFeGVjdXRpb25Nb2RlKGFjdGlvblR5cGU6IHN0cmluZywgbW9kZTogRXhlY3V0aW9uTW9kZSk6IHZvaWQge1xuICAgIGlmICh0aGlzLmNvbmZpZy5leGVjdXRpb25Qb2xpY3kpIHtcbiAgICAgIHRoaXMuY29uZmlnLmV4ZWN1dGlvblBvbGljeS5zZXRFeGVjdXRpb25Nb2RlKGFjdGlvblR5cGUgYXMgYW55LCBtb2RlKTtcbiAgICB9XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDojrflj5bmiafooYznrZbnlaXnirbmgIFcbiAgICovXG4gIGdldEV4ZWN1dGlvblBvbGljeVN0YXRlKCk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMuY29uZmlnLmV4ZWN1dGlvblBvbGljeT8uZ2V0UG9saWN5U3RhdGUoKSB8fCB7XG4gICAgICBkZWZhdWx0TW9kZTogdGhpcy5jb25maWcuZW5hYmxlUmVhbEV4ZWN1dGlvbiA/ICdyZWFsJyA6ICdzaW11bGF0ZWQnLFxuICAgICAgZ2xvYmFsRW5hYmxlZDogdGhpcy5jb25maWcuZW5hYmxlUmVhbEV4ZWN1dGlvbixcbiAgICB9O1xuICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOW3peWOguWHveaVsFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5pbXBvcnQgeyBjcmVhdGVFeGVjdXRpb25Qb2xpY3ksIHR5cGUgRXhlY3V0aW9uUG9saWN5IH0gZnJvbSAnLi9vcGVyYXRvcl9leGVjdXRpb25fcG9saWN5JztcblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZU9wZXJhdG9yRXhlY3V0aW9uQnJpZGdlKFxuICBjb25maWc/OiBPcGVyYXRvckV4ZWN1dGlvbkJyaWRnZUNvbmZpZyxcbiAgZXhlY3V0aW9uUG9saWN5PzogRXhlY3V0aW9uUG9saWN5XG4pOiBPcGVyYXRvckV4ZWN1dGlvbkJyaWRnZSB7XG4gIHJldHVybiBuZXcgRGVmYXVsdE9wZXJhdG9yRXhlY3V0aW9uQnJpZGdlKHtcbiAgICAuLi5jb25maWcsXG4gICAgZXhlY3V0aW9uUG9saWN5OiBleGVjdXRpb25Qb2xpY3kgPz8gY3JlYXRlRXhlY3V0aW9uUG9saWN5KGNvbmZpZyksXG4gIH0pO1xufVxuIl19