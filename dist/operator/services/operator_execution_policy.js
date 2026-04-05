"use strict";
/**
 * Operator Execution Policy
 * Phase 2A-1R′B - 执行策略控制
 *
 * 职责：
 * - 按动作类型控制 real / simulated 模式
 * - 提供安全的执行开关
 * - 支持逐步放开真实执行
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultExecutionPolicy = void 0;
exports.createSafeExecutionPolicy = createSafeExecutionPolicy;
exports.create2A1RPrimeBExecutionPolicy = create2A1RPrimeBExecutionPolicy;
exports.createProductionExecutionPolicy = createProductionExecutionPolicy;
exports.createExecutionPolicy = createExecutionPolicy;
// ============================================================================
// 默认实现
// ============================================================================
class DefaultExecutionPolicy {
    constructor(config = {}) {
        this.defaultMode = config.defaultMode ?? 'simulated';
        this.perAction = new Map();
        this.globalEnabled = config.enableRealExecution ?? false;
        // 初始化 per-action 配置
        if (config.perAction) {
            Object.entries(config.perAction).forEach(([actionType, mode]) => {
                this.perAction.set(actionType, mode);
            });
        }
    }
    getExecutionMode(actionType) {
        // 全局禁用 → 强制 simulated
        if (!this.globalEnabled) {
            return 'simulated';
        }
        // 检查 per-action 配置
        const perActionMode = this.perAction.get(actionType);
        if (perActionMode !== undefined) {
            return perActionMode;
        }
        // 返回默认模式
        return this.defaultMode;
    }
    isRealExecution(actionType) {
        return this.getExecutionMode(actionType) === 'real';
    }
    enableRealExecution() {
        this.globalEnabled = true;
    }
    disableRealExecution() {
        this.globalEnabled = false;
    }
    setExecutionMode(actionType, mode) {
        this.perAction.set(actionType, mode);
    }
    getPolicyState() {
        // 构建完整的 per-action 映射
        const allActionTypes = [
            'view_dashboard', 'view_tasks', 'view_approvals', 'view_incidents',
            'view_agents', 'view_inbox', 'view_interventions', 'view_history',
            'open_item', 'switch_workspace', 'approve', 'reject', 'escalate',
            'ack_incident', 'request_recovery', 'request_replay', 'retry_task',
            'cancel_task', 'pause_task', 'resume_task', 'pause_agent',
            'resume_agent', 'inspect_agent', 'confirm_action', 'dismiss_intervention',
            'snooze_intervention', 'go_back', 'refresh',
        ];
        const perAction = {};
        allActionTypes.forEach(actionType => {
            perAction[actionType] = this.getExecutionMode(actionType);
        });
        return {
            defaultMode: this.defaultMode,
            perAction,
            globalEnabled: this.globalEnabled,
        };
    }
}
exports.DefaultExecutionPolicy = DefaultExecutionPolicy;
// ============================================================================
// 预定义策略
// ============================================================================
/**
 * 安全策略（默认）
 * - 所有动作 simulated
 */
function createSafeExecutionPolicy() {
    return new DefaultExecutionPolicy({
        defaultMode: 'simulated',
        enableRealExecution: false,
    });
}
/**
 * 测试策略（2A-1R′B 推荐）
 * - retry_task: real
 * - ack_incident: real
 * - approve: real
 * - 其他：simulated
 */
function create2A1RPrimeBExecutionPolicy() {
    return new DefaultExecutionPolicy({
        defaultMode: 'simulated',
        enableRealExecution: true,
        perAction: {
            retry_task: 'real',
            ack_incident: 'real',
            approve: 'real',
            reject: 'real',
        },
    });
}
/**
 * 生产策略（未来）
 * - 所有控制动作 real
 * - 视图动作 simulated（不需要真实副作用）
 */
function createProductionExecutionPolicy() {
    return new DefaultExecutionPolicy({
        defaultMode: 'simulated',
        enableRealExecution: true,
        perAction: {
            // 视图动作 - simulated
            view_dashboard: 'simulated',
            view_tasks: 'simulated',
            view_approvals: 'simulated',
            view_incidents: 'simulated',
            view_agents: 'simulated',
            view_inbox: 'simulated',
            view_interventions: 'simulated',
            view_history: 'simulated',
            open_item: 'simulated',
            refresh: 'simulated',
            go_back: 'simulated',
            switch_workspace: 'simulated',
            // 控制动作 - real
            approve: 'real',
            reject: 'real',
            escalate: 'real',
            ack_incident: 'real',
            request_recovery: 'real',
            request_replay: 'real',
            retry_task: 'real',
            cancel_task: 'real',
            pause_task: 'real',
            resume_task: 'real',
            pause_agent: 'real',
            resume_agent: 'real',
            inspect_agent: 'simulated',
            // HITL 动作 - real
            confirm_action: 'real',
            dismiss_intervention: 'real',
            snooze_intervention: 'real',
        },
    });
}
// ============================================================================
// 工厂函数
// ============================================================================
function createExecutionPolicy(config) {
    return new DefaultExecutionPolicy(config);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3BlcmF0b3JfZXhlY3V0aW9uX3BvbGljeS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9vcGVyYXRvci9zZXJ2aWNlcy9vcGVyYXRvcl9leGVjdXRpb25fcG9saWN5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7R0FRRzs7O0FBNEpILDhEQUtDO0FBU0QsMEVBV0M7QUFPRCwwRUF3Q0M7QUFNRCxzREFFQztBQTNLRCwrRUFBK0U7QUFDL0UsT0FBTztBQUNQLCtFQUErRTtBQUUvRSxNQUFhLHNCQUFzQjtJQUtqQyxZQUFZLFNBQWdDLEVBQUU7UUFDNUMsSUFBSSxDQUFDLFdBQVcsR0FBRyxNQUFNLENBQUMsV0FBVyxJQUFJLFdBQVcsQ0FBQztRQUNyRCxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksR0FBRyxFQUFFLENBQUM7UUFDM0IsSUFBSSxDQUFDLGFBQWEsR0FBRyxNQUFNLENBQUMsbUJBQW1CLElBQUksS0FBSyxDQUFDO1FBRXpELG9CQUFvQjtRQUNwQixJQUFJLE1BQU0sQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUNyQixNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsRUFBRSxFQUFFO2dCQUM5RCxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxVQUFnQyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQzdELENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztJQUNILENBQUM7SUFFRCxnQkFBZ0IsQ0FBQyxVQUE4QjtRQUM3QyxzQkFBc0I7UUFDdEIsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztZQUN4QixPQUFPLFdBQVcsQ0FBQztRQUNyQixDQUFDO1FBRUQsbUJBQW1CO1FBQ25CLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3JELElBQUksYUFBYSxLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQ2hDLE9BQU8sYUFBYSxDQUFDO1FBQ3ZCLENBQUM7UUFFRCxTQUFTO1FBQ1QsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDO0lBQzFCLENBQUM7SUFFRCxlQUFlLENBQUMsVUFBOEI7UUFDNUMsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxDQUFDLEtBQUssTUFBTSxDQUFDO0lBQ3RELENBQUM7SUFFRCxtQkFBbUI7UUFDakIsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUM7SUFDNUIsQ0FBQztJQUVELG9CQUFvQjtRQUNsQixJQUFJLENBQUMsYUFBYSxHQUFHLEtBQUssQ0FBQztJQUM3QixDQUFDO0lBRUQsZ0JBQWdCLENBQUMsVUFBOEIsRUFBRSxJQUFtQjtRQUNsRSxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDdkMsQ0FBQztJQUVELGNBQWM7UUFLWixzQkFBc0I7UUFDdEIsTUFBTSxjQUFjLEdBQXlCO1lBQzNDLGdCQUFnQixFQUFFLFlBQVksRUFBRSxnQkFBZ0IsRUFBRSxnQkFBZ0I7WUFDbEUsYUFBYSxFQUFFLFlBQVksRUFBRSxvQkFBb0IsRUFBRSxjQUFjO1lBQ2pFLFdBQVcsRUFBRSxrQkFBa0IsRUFBRSxTQUFTLEVBQUUsUUFBUSxFQUFFLFVBQVU7WUFDaEUsY0FBYyxFQUFFLGtCQUFrQixFQUFFLGdCQUFnQixFQUFFLFlBQVk7WUFDbEUsYUFBYSxFQUFFLFlBQVksRUFBRSxhQUFhLEVBQUUsYUFBYTtZQUN6RCxjQUFjLEVBQUUsZUFBZSxFQUFFLGdCQUFnQixFQUFFLHNCQUFzQjtZQUN6RSxxQkFBcUIsRUFBRSxTQUFTLEVBQUUsU0FBUztTQUM1QyxDQUFDO1FBRUYsTUFBTSxTQUFTLEdBQThDLEVBQVMsQ0FBQztRQUN2RSxjQUFjLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxFQUFFO1lBQ2xDLFNBQVMsQ0FBQyxVQUFVLENBQUMsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDNUQsQ0FBQyxDQUFDLENBQUM7UUFFSCxPQUFPO1lBQ0wsV0FBVyxFQUFFLElBQUksQ0FBQyxXQUFXO1lBQzdCLFNBQVM7WUFDVCxhQUFhLEVBQUUsSUFBSSxDQUFDLGFBQWE7U0FDbEMsQ0FBQztJQUNKLENBQUM7Q0FDRjtBQTdFRCx3REE2RUM7QUFFRCwrRUFBK0U7QUFDL0UsUUFBUTtBQUNSLCtFQUErRTtBQUUvRTs7O0dBR0c7QUFDSCxTQUFnQix5QkFBeUI7SUFDdkMsT0FBTyxJQUFJLHNCQUFzQixDQUFDO1FBQ2hDLFdBQVcsRUFBRSxXQUFXO1FBQ3hCLG1CQUFtQixFQUFFLEtBQUs7S0FDM0IsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUVEOzs7Ozs7R0FNRztBQUNILFNBQWdCLCtCQUErQjtJQUM3QyxPQUFPLElBQUksc0JBQXNCLENBQUM7UUFDaEMsV0FBVyxFQUFFLFdBQVc7UUFDeEIsbUJBQW1CLEVBQUUsSUFBSTtRQUN6QixTQUFTLEVBQUU7WUFDVCxVQUFVLEVBQUUsTUFBTTtZQUNsQixZQUFZLEVBQUUsTUFBTTtZQUNwQixPQUFPLEVBQUUsTUFBTTtZQUNmLE1BQU0sRUFBRSxNQUFNO1NBQ2Y7S0FDRixDQUFDLENBQUM7QUFDTCxDQUFDO0FBRUQ7Ozs7R0FJRztBQUNILFNBQWdCLCtCQUErQjtJQUM3QyxPQUFPLElBQUksc0JBQXNCLENBQUM7UUFDaEMsV0FBVyxFQUFFLFdBQVc7UUFDeEIsbUJBQW1CLEVBQUUsSUFBSTtRQUN6QixTQUFTLEVBQUU7WUFDVCxtQkFBbUI7WUFDbkIsY0FBYyxFQUFFLFdBQVc7WUFDM0IsVUFBVSxFQUFFLFdBQVc7WUFDdkIsY0FBYyxFQUFFLFdBQVc7WUFDM0IsY0FBYyxFQUFFLFdBQVc7WUFDM0IsV0FBVyxFQUFFLFdBQVc7WUFDeEIsVUFBVSxFQUFFLFdBQVc7WUFDdkIsa0JBQWtCLEVBQUUsV0FBVztZQUMvQixZQUFZLEVBQUUsV0FBVztZQUN6QixTQUFTLEVBQUUsV0FBVztZQUN0QixPQUFPLEVBQUUsV0FBVztZQUNwQixPQUFPLEVBQUUsV0FBVztZQUNwQixnQkFBZ0IsRUFBRSxXQUFXO1lBRTdCLGNBQWM7WUFDZCxPQUFPLEVBQUUsTUFBTTtZQUNmLE1BQU0sRUFBRSxNQUFNO1lBQ2QsUUFBUSxFQUFFLE1BQU07WUFDaEIsWUFBWSxFQUFFLE1BQU07WUFDcEIsZ0JBQWdCLEVBQUUsTUFBTTtZQUN4QixjQUFjLEVBQUUsTUFBTTtZQUN0QixVQUFVLEVBQUUsTUFBTTtZQUNsQixXQUFXLEVBQUUsTUFBTTtZQUNuQixVQUFVLEVBQUUsTUFBTTtZQUNsQixXQUFXLEVBQUUsTUFBTTtZQUNuQixXQUFXLEVBQUUsTUFBTTtZQUNuQixZQUFZLEVBQUUsTUFBTTtZQUNwQixhQUFhLEVBQUUsV0FBVztZQUUxQixpQkFBaUI7WUFDakIsY0FBYyxFQUFFLE1BQU07WUFDdEIsb0JBQW9CLEVBQUUsTUFBTTtZQUM1QixtQkFBbUIsRUFBRSxNQUFNO1NBQzVCO0tBQ0YsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUVELCtFQUErRTtBQUMvRSxPQUFPO0FBQ1AsK0VBQStFO0FBRS9FLFNBQWdCLHFCQUFxQixDQUFDLE1BQThCO0lBQ2xFLE9BQU8sSUFBSSxzQkFBc0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUM1QyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBPcGVyYXRvciBFeGVjdXRpb24gUG9saWN5XG4gKiBQaGFzZSAyQS0xUuKAskIgLSDmiafooYznrZbnlaXmjqfliLZcbiAqIFxuICog6IGM6LSj77yaXG4gKiAtIOaMieWKqOS9nOexu+Wei+aOp+WItiByZWFsIC8gc2ltdWxhdGVkIOaooeW8j1xuICogLSDmj5DkvpvlronlhajnmoTmiafooYzlvIDlhbNcbiAqIC0g5pSv5oyB6YCQ5q2l5pS+5byA55yf5a6e5omn6KGMXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBPcGVyYXRvckFjdGlvblR5cGUgfSBmcm9tICcuLi90eXBlcy9zdXJmYWNlX3R5cGVzJztcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5omn6KGM5qih5byPXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCB0eXBlIEV4ZWN1dGlvbk1vZGUgPSBcInJlYWxcIiB8IFwic2ltdWxhdGVkXCIgfCBcInVuc3VwcG9ydGVkXCI7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOaJp+ihjOetlueVpemFjee9rlxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgaW50ZXJmYWNlIEV4ZWN1dGlvblBvbGljeUNvbmZpZyB7XG4gIC8qKiDpu5jorqTmiafooYzmqKHlvI8gKi9cbiAgZGVmYXVsdE1vZGU/OiBFeGVjdXRpb25Nb2RlO1xuICBcbiAgLyoqIOaMieWKqOS9nOexu+Wei+eahOaJp+ihjOaooeW8j+imhuebliAqL1xuICBwZXJBY3Rpb24/OiBQYXJ0aWFsPFJlY29yZDxPcGVyYXRvckFjdGlvblR5cGUsIEV4ZWN1dGlvbk1vZGU+PjtcbiAgXG4gIC8qKiDmmK/lkKblkK/nlKjnnJ/lrp7miafooYzvvIjlhajlsYDlvIDlhbPvvIkgKi9cbiAgZW5hYmxlUmVhbEV4ZWN1dGlvbj86IGJvb2xlYW47XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOaJp+ihjOetlueVpeaOpeWPo1xuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgaW50ZXJmYWNlIEV4ZWN1dGlvblBvbGljeSB7XG4gIC8qKlxuICAgKiDojrflj5bliqjkvZznmoTmiafooYzmqKHlvI9cbiAgICovXG4gIGdldEV4ZWN1dGlvbk1vZGUoYWN0aW9uVHlwZTogT3BlcmF0b3JBY3Rpb25UeXBlKTogRXhlY3V0aW9uTW9kZTtcbiAgXG4gIC8qKlxuICAgKiDmo4Dmn6XliqjkvZzmmK/lkKbmlK/mjIHnnJ/lrp7miafooYxcbiAgICovXG4gIGlzUmVhbEV4ZWN1dGlvbihhY3Rpb25UeXBlOiBPcGVyYXRvckFjdGlvblR5cGUpOiBib29sZWFuO1xuICBcbiAgLyoqXG4gICAqIOWQr+eUqOWFqOWxgOecn+WunuaJp+ihjFxuICAgKi9cbiAgZW5hYmxlUmVhbEV4ZWN1dGlvbigpOiB2b2lkO1xuICBcbiAgLyoqXG4gICAqIOemgeeUqOWFqOWxgOecn+WunuaJp+ihjFxuICAgKi9cbiAgZGlzYWJsZVJlYWxFeGVjdXRpb24oKTogdm9pZDtcbiAgXG4gIC8qKlxuICAgKiDorr7nva7liqjkvZznmoTmiafooYzmqKHlvI9cbiAgICovXG4gIHNldEV4ZWN1dGlvbk1vZGUoYWN0aW9uVHlwZTogT3BlcmF0b3JBY3Rpb25UeXBlLCBtb2RlOiBFeGVjdXRpb25Nb2RlKTogdm9pZDtcbiAgXG4gIC8qKlxuICAgKiDojrflj5blvZPliY3nrZbnlaXnirbmgIFcbiAgICovXG4gIGdldFBvbGljeVN0YXRlKCk6IHtcbiAgICBkZWZhdWx0TW9kZTogRXhlY3V0aW9uTW9kZTtcbiAgICBwZXJBY3Rpb246IFJlY29yZDxPcGVyYXRvckFjdGlvblR5cGUsIEV4ZWN1dGlvbk1vZGU+O1xuICAgIGdsb2JhbEVuYWJsZWQ6IGJvb2xlYW47XG4gIH07XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOm7mOiupOWunueOsFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgY2xhc3MgRGVmYXVsdEV4ZWN1dGlvblBvbGljeSBpbXBsZW1lbnRzIEV4ZWN1dGlvblBvbGljeSB7XG4gIHByaXZhdGUgZGVmYXVsdE1vZGU6IEV4ZWN1dGlvbk1vZGU7XG4gIHByaXZhdGUgcGVyQWN0aW9uOiBNYXA8T3BlcmF0b3JBY3Rpb25UeXBlLCBFeGVjdXRpb25Nb2RlPjtcbiAgcHJpdmF0ZSBnbG9iYWxFbmFibGVkOiBib29sZWFuO1xuICBcbiAgY29uc3RydWN0b3IoY29uZmlnOiBFeGVjdXRpb25Qb2xpY3lDb25maWcgPSB7fSkge1xuICAgIHRoaXMuZGVmYXVsdE1vZGUgPSBjb25maWcuZGVmYXVsdE1vZGUgPz8gJ3NpbXVsYXRlZCc7XG4gICAgdGhpcy5wZXJBY3Rpb24gPSBuZXcgTWFwKCk7XG4gICAgdGhpcy5nbG9iYWxFbmFibGVkID0gY29uZmlnLmVuYWJsZVJlYWxFeGVjdXRpb24gPz8gZmFsc2U7XG4gICAgXG4gICAgLy8g5Yid5aeL5YyWIHBlci1hY3Rpb24g6YWN572uXG4gICAgaWYgKGNvbmZpZy5wZXJBY3Rpb24pIHtcbiAgICAgIE9iamVjdC5lbnRyaWVzKGNvbmZpZy5wZXJBY3Rpb24pLmZvckVhY2goKFthY3Rpb25UeXBlLCBtb2RlXSkgPT4ge1xuICAgICAgICB0aGlzLnBlckFjdGlvbi5zZXQoYWN0aW9uVHlwZSBhcyBPcGVyYXRvckFjdGlvblR5cGUsIG1vZGUpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIFxuICBnZXRFeGVjdXRpb25Nb2RlKGFjdGlvblR5cGU6IE9wZXJhdG9yQWN0aW9uVHlwZSk6IEV4ZWN1dGlvbk1vZGUge1xuICAgIC8vIOWFqOWxgOemgeeUqCDihpIg5by65Yi2IHNpbXVsYXRlZFxuICAgIGlmICghdGhpcy5nbG9iYWxFbmFibGVkKSB7XG4gICAgICByZXR1cm4gJ3NpbXVsYXRlZCc7XG4gICAgfVxuICAgIFxuICAgIC8vIOajgOafpSBwZXItYWN0aW9uIOmFjee9rlxuICAgIGNvbnN0IHBlckFjdGlvbk1vZGUgPSB0aGlzLnBlckFjdGlvbi5nZXQoYWN0aW9uVHlwZSk7XG4gICAgaWYgKHBlckFjdGlvbk1vZGUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHBlckFjdGlvbk1vZGU7XG4gICAgfVxuICAgIFxuICAgIC8vIOi/lOWbnum7mOiupOaooeW8j1xuICAgIHJldHVybiB0aGlzLmRlZmF1bHRNb2RlO1xuICB9XG4gIFxuICBpc1JlYWxFeGVjdXRpb24oYWN0aW9uVHlwZTogT3BlcmF0b3JBY3Rpb25UeXBlKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0RXhlY3V0aW9uTW9kZShhY3Rpb25UeXBlKSA9PT0gJ3JlYWwnO1xuICB9XG4gIFxuICBlbmFibGVSZWFsRXhlY3V0aW9uKCk6IHZvaWQge1xuICAgIHRoaXMuZ2xvYmFsRW5hYmxlZCA9IHRydWU7XG4gIH1cbiAgXG4gIGRpc2FibGVSZWFsRXhlY3V0aW9uKCk6IHZvaWQge1xuICAgIHRoaXMuZ2xvYmFsRW5hYmxlZCA9IGZhbHNlO1xuICB9XG4gIFxuICBzZXRFeGVjdXRpb25Nb2RlKGFjdGlvblR5cGU6IE9wZXJhdG9yQWN0aW9uVHlwZSwgbW9kZTogRXhlY3V0aW9uTW9kZSk6IHZvaWQge1xuICAgIHRoaXMucGVyQWN0aW9uLnNldChhY3Rpb25UeXBlLCBtb2RlKTtcbiAgfVxuICBcbiAgZ2V0UG9saWN5U3RhdGUoKToge1xuICAgIGRlZmF1bHRNb2RlOiBFeGVjdXRpb25Nb2RlO1xuICAgIHBlckFjdGlvbjogUmVjb3JkPE9wZXJhdG9yQWN0aW9uVHlwZSwgRXhlY3V0aW9uTW9kZT47XG4gICAgZ2xvYmFsRW5hYmxlZDogYm9vbGVhbjtcbiAgfSB7XG4gICAgLy8g5p6E5bu65a6M5pW055qEIHBlci1hY3Rpb24g5pig5bCEXG4gICAgY29uc3QgYWxsQWN0aW9uVHlwZXM6IE9wZXJhdG9yQWN0aW9uVHlwZVtdID0gW1xuICAgICAgJ3ZpZXdfZGFzaGJvYXJkJywgJ3ZpZXdfdGFza3MnLCAndmlld19hcHByb3ZhbHMnLCAndmlld19pbmNpZGVudHMnLFxuICAgICAgJ3ZpZXdfYWdlbnRzJywgJ3ZpZXdfaW5ib3gnLCAndmlld19pbnRlcnZlbnRpb25zJywgJ3ZpZXdfaGlzdG9yeScsXG4gICAgICAnb3Blbl9pdGVtJywgJ3N3aXRjaF93b3Jrc3BhY2UnLCAnYXBwcm92ZScsICdyZWplY3QnLCAnZXNjYWxhdGUnLFxuICAgICAgJ2Fja19pbmNpZGVudCcsICdyZXF1ZXN0X3JlY292ZXJ5JywgJ3JlcXVlc3RfcmVwbGF5JywgJ3JldHJ5X3Rhc2snLFxuICAgICAgJ2NhbmNlbF90YXNrJywgJ3BhdXNlX3Rhc2snLCAncmVzdW1lX3Rhc2snLCAncGF1c2VfYWdlbnQnLFxuICAgICAgJ3Jlc3VtZV9hZ2VudCcsICdpbnNwZWN0X2FnZW50JywgJ2NvbmZpcm1fYWN0aW9uJywgJ2Rpc21pc3NfaW50ZXJ2ZW50aW9uJyxcbiAgICAgICdzbm9vemVfaW50ZXJ2ZW50aW9uJywgJ2dvX2JhY2snLCAncmVmcmVzaCcsXG4gICAgXTtcbiAgICBcbiAgICBjb25zdCBwZXJBY3Rpb246IFJlY29yZDxPcGVyYXRvckFjdGlvblR5cGUsIEV4ZWN1dGlvbk1vZGU+ID0ge30gYXMgYW55O1xuICAgIGFsbEFjdGlvblR5cGVzLmZvckVhY2goYWN0aW9uVHlwZSA9PiB7XG4gICAgICBwZXJBY3Rpb25bYWN0aW9uVHlwZV0gPSB0aGlzLmdldEV4ZWN1dGlvbk1vZGUoYWN0aW9uVHlwZSk7XG4gICAgfSk7XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIGRlZmF1bHRNb2RlOiB0aGlzLmRlZmF1bHRNb2RlLFxuICAgICAgcGVyQWN0aW9uLFxuICAgICAgZ2xvYmFsRW5hYmxlZDogdGhpcy5nbG9iYWxFbmFibGVkLFxuICAgIH07XG4gIH1cbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g6aKE5a6a5LmJ562W55WlXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog5a6J5YWo562W55Wl77yI6buY6K6k77yJXG4gKiAtIOaJgOacieWKqOS9nCBzaW11bGF0ZWRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVNhZmVFeGVjdXRpb25Qb2xpY3koKTogRXhlY3V0aW9uUG9saWN5IHtcbiAgcmV0dXJuIG5ldyBEZWZhdWx0RXhlY3V0aW9uUG9saWN5KHtcbiAgICBkZWZhdWx0TW9kZTogJ3NpbXVsYXRlZCcsXG4gICAgZW5hYmxlUmVhbEV4ZWN1dGlvbjogZmFsc2UsXG4gIH0pO1xufVxuXG4vKipcbiAqIOa1i+ivleetlueVpe+8iDJBLTFS4oCyQiDmjqjojZDvvIlcbiAqIC0gcmV0cnlfdGFzazogcmVhbFxuICogLSBhY2tfaW5jaWRlbnQ6IHJlYWxcbiAqIC0gYXBwcm92ZTogcmVhbFxuICogLSDlhbbku5bvvJpzaW11bGF0ZWRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZTJBMVJQcmltZUJFeGVjdXRpb25Qb2xpY3koKTogRXhlY3V0aW9uUG9saWN5IHtcbiAgcmV0dXJuIG5ldyBEZWZhdWx0RXhlY3V0aW9uUG9saWN5KHtcbiAgICBkZWZhdWx0TW9kZTogJ3NpbXVsYXRlZCcsXG4gICAgZW5hYmxlUmVhbEV4ZWN1dGlvbjogdHJ1ZSxcbiAgICBwZXJBY3Rpb246IHtcbiAgICAgIHJldHJ5X3Rhc2s6ICdyZWFsJyxcbiAgICAgIGFja19pbmNpZGVudDogJ3JlYWwnLFxuICAgICAgYXBwcm92ZTogJ3JlYWwnLFxuICAgICAgcmVqZWN0OiAncmVhbCcsXG4gICAgfSxcbiAgfSk7XG59XG5cbi8qKlxuICog55Sf5Lqn562W55Wl77yI5pyq5p2l77yJXG4gKiAtIOaJgOacieaOp+WItuWKqOS9nCByZWFsXG4gKiAtIOinhuWbvuWKqOS9nCBzaW11bGF0ZWTvvIjkuI3pnIDopoHnnJ/lrp7lia/kvZznlKjvvIlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVByb2R1Y3Rpb25FeGVjdXRpb25Qb2xpY3koKTogRXhlY3V0aW9uUG9saWN5IHtcbiAgcmV0dXJuIG5ldyBEZWZhdWx0RXhlY3V0aW9uUG9saWN5KHtcbiAgICBkZWZhdWx0TW9kZTogJ3NpbXVsYXRlZCcsXG4gICAgZW5hYmxlUmVhbEV4ZWN1dGlvbjogdHJ1ZSxcbiAgICBwZXJBY3Rpb246IHtcbiAgICAgIC8vIOinhuWbvuWKqOS9nCAtIHNpbXVsYXRlZFxuICAgICAgdmlld19kYXNoYm9hcmQ6ICdzaW11bGF0ZWQnLFxuICAgICAgdmlld190YXNrczogJ3NpbXVsYXRlZCcsXG4gICAgICB2aWV3X2FwcHJvdmFsczogJ3NpbXVsYXRlZCcsXG4gICAgICB2aWV3X2luY2lkZW50czogJ3NpbXVsYXRlZCcsXG4gICAgICB2aWV3X2FnZW50czogJ3NpbXVsYXRlZCcsXG4gICAgICB2aWV3X2luYm94OiAnc2ltdWxhdGVkJyxcbiAgICAgIHZpZXdfaW50ZXJ2ZW50aW9uczogJ3NpbXVsYXRlZCcsXG4gICAgICB2aWV3X2hpc3Rvcnk6ICdzaW11bGF0ZWQnLFxuICAgICAgb3Blbl9pdGVtOiAnc2ltdWxhdGVkJyxcbiAgICAgIHJlZnJlc2g6ICdzaW11bGF0ZWQnLFxuICAgICAgZ29fYmFjazogJ3NpbXVsYXRlZCcsXG4gICAgICBzd2l0Y2hfd29ya3NwYWNlOiAnc2ltdWxhdGVkJyxcbiAgICAgIFxuICAgICAgLy8g5o6n5Yi25Yqo5L2cIC0gcmVhbFxuICAgICAgYXBwcm92ZTogJ3JlYWwnLFxuICAgICAgcmVqZWN0OiAncmVhbCcsXG4gICAgICBlc2NhbGF0ZTogJ3JlYWwnLFxuICAgICAgYWNrX2luY2lkZW50OiAncmVhbCcsXG4gICAgICByZXF1ZXN0X3JlY292ZXJ5OiAncmVhbCcsXG4gICAgICByZXF1ZXN0X3JlcGxheTogJ3JlYWwnLFxuICAgICAgcmV0cnlfdGFzazogJ3JlYWwnLFxuICAgICAgY2FuY2VsX3Rhc2s6ICdyZWFsJyxcbiAgICAgIHBhdXNlX3Rhc2s6ICdyZWFsJyxcbiAgICAgIHJlc3VtZV90YXNrOiAncmVhbCcsXG4gICAgICBwYXVzZV9hZ2VudDogJ3JlYWwnLFxuICAgICAgcmVzdW1lX2FnZW50OiAncmVhbCcsXG4gICAgICBpbnNwZWN0X2FnZW50OiAnc2ltdWxhdGVkJyxcbiAgICAgIFxuICAgICAgLy8gSElUTCDliqjkvZwgLSByZWFsXG4gICAgICBjb25maXJtX2FjdGlvbjogJ3JlYWwnLFxuICAgICAgZGlzbWlzc19pbnRlcnZlbnRpb246ICdyZWFsJyxcbiAgICAgIHNub296ZV9pbnRlcnZlbnRpb246ICdyZWFsJyxcbiAgICB9LFxuICB9KTtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5bel5Y6C5Ye95pWwXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVFeGVjdXRpb25Qb2xpY3koY29uZmlnPzogRXhlY3V0aW9uUG9saWN5Q29uZmlnKTogRXhlY3V0aW9uUG9saWN5IHtcbiAgcmV0dXJuIG5ldyBEZWZhdWx0RXhlY3V0aW9uUG9saWN5KGNvbmZpZyk7XG59XG4iXX0=