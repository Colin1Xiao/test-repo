"use strict";
/**
 * Action Confirmation - 动作确认层
 *
 * 职责：
 * 1. 统一动作确认层
 * 2. 定义哪些动作无需确认/需一次确认/需强确认
 * 3. 确认文案所需字段/风险说明/影响范围/rollback hint
 *
 * @version v0.1.0
 * @date 2026-04-04
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionConfirmationManager = void 0;
exports.createActionConfirmationManager = createActionConfirmationManager;
exports.createConfirmation = createConfirmation;
exports.getConfirmationLevel = getConfirmationLevel;
// ============================================================================
// 动作确认规则
// ============================================================================
/**
 * 无需确认的动作类型
 */
const NO_CONFIRMATION_ACTIONS = [
    'ack_incident',
    'inspect_agent',
    'inspect_task',
    'request_context',
    'dismiss',
];
/**
 * 需要强确认的动作类型
 */
const STRONG_CONFIRMATION_ACTIONS = [
    'cancel_task',
    'reject',
    'escalate',
    'pause_agent',
    'request_recovery',
];
// ============================================================================
// 动作确认管理器
// ============================================================================
class ActionConfirmationManager {
    constructor(config = {}) {
        this.config = {
            noConfirmationRequired: config.noConfirmationRequired ?? NO_CONFIRMATION_ACTIONS,
            strongConfirmationRequired: config.strongConfirmationRequired ?? STRONG_CONFIRMATION_ACTIONS,
        };
    }
    /**
     * 获取动作确认级别
     */
    getConfirmationLevel(actionType) {
        if (this.config.noConfirmationRequired.includes(actionType)) {
            return 'none';
        }
        if (this.config.strongConfirmationRequired.includes(actionType)) {
            return 'strong';
        }
        return 'standard';
    }
    /**
     * 创建动作确认
     */
    createConfirmation(action, targetId, targetType) {
        const confirmationLevel = this.getConfirmationLevel(action.actionType);
        if (confirmationLevel === 'none') {
            return null;
        }
        const now = Date.now();
        return {
            actionId: action.id,
            actionType: action.actionType,
            targetType,
            targetId,
            confirmationLevel,
            title: this.generateConfirmationTitle(action),
            message: this.generateConfirmationMessage(action),
            impactSummary: action.expectedOutcome,
            riskSummary: this.generateRiskSummary(action),
            rollbackHint: this.generateRollbackHint(action),
            createdAt: now,
            status: 'pending',
        };
    }
    /**
     * 确认动作
     */
    confirmConfirmation(confirmationId) {
        // 简化实现：实际应该从存储中获取
        return null;
    }
    /**
     * 拒绝动作
     */
    rejectConfirmation(confirmationId) {
        // 简化实现：实际应该从存储中获取
        return null;
    }
    /**
     * 过期动作
     */
    expireConfirmation(confirmationId) {
        // 简化实现：实际应该从存储中获取
        return null;
    }
    // ============================================================================
    // 内部方法
    // ============================================================================
    /**
     * 生成确认标题
     */
    generateConfirmationTitle(action) {
        const titleMap = {
            approve: 'Confirm Approval',
            reject: 'Confirm Rejection',
            retry_task: 'Confirm Task Retry',
            cancel_task: 'Confirm Task Cancellation',
            request_recovery: 'Confirm Recovery Request',
            pause_agent: 'Confirm Agent Pause',
            resume_agent: 'Confirm Agent Resume',
            escalate: 'Confirm Escalation',
            dismiss: 'Confirm Dismissal',
            snooze: 'Confirm Snooze',
        };
        return titleMap[action.actionType] || `Confirm ${action.label}`;
    }
    /**
     * 生成确认消息
     */
    generateConfirmationMessage(action) {
        const messageMap = {
            approve: 'You are about to approve this request. This action will allow the request to proceed.',
            reject: 'You are about to reject this request. This action may cancel related tasks.',
            retry_task: 'You are about to retry this task. The task will be re-executed from the beginning.',
            cancel_task: 'You are about to cancel this task. This action cannot be undone and may affect related workflows.',
            request_recovery: 'You are about to request recovery. The system will attempt to recover the target automatically.',
            pause_agent: 'You are about to pause this agent. No new tasks will be assigned until the agent is resumed.',
            resume_agent: 'You are about to resume this agent. The agent will be able to accept new tasks.',
            escalate: 'You are about to escalate this issue. It will be assigned to on-call engineer or manager.',
            dismiss: 'You are about to dismiss this intervention. It will be removed from your queue.',
            snooze: 'You are about to snooze this intervention. It will reappear after the snooze period.',
        };
        return messageMap[action.actionType] || action.description || 'Please confirm this action.';
    }
    /**
     * 生成风险摘要
     */
    generateRiskSummary(action) {
        const riskMap = {
            approve: 'Low risk: Request will proceed as expected.',
            reject: 'Medium risk: Related tasks may be cancelled.',
            retry_task: 'Low risk: Task may fail again if underlying issue persists.',
            cancel_task: 'High risk: This action cannot be undone and may affect dependent workflows.',
            request_recovery: 'Low risk: Recovery attempt may fail if issue is not recoverable.',
            pause_agent: 'Medium risk: Agent will not process new tasks until resumed.',
            resume_agent: 'Low risk: Agent may encounter same issues if not resolved.',
            escalate: 'Medium risk: Issue will be assigned to higher level support.',
            dismiss: 'Low risk: Intervention will be removed but underlying issue may persist.',
            snooze: 'Low risk: Issue will reappear after snooze period.',
        };
        return riskMap[action.actionType] || `Risk level: ${action.riskLevel || 'unknown'}`;
    }
    /**
     * 生成回滚提示
     */
    generateRollbackHint(action) {
        const rollbackMap = {
            approve: 'Cannot undo approval. Contact support if reversal is needed.',
            reject: 'Cannot undo rejection. A new request may need to be submitted.',
            retry_task: 'No rollback needed. Task can be cancelled if retry fails.',
            cancel_task: 'Cannot undo cancellation. Task must be recreated if needed.',
            request_recovery: 'No rollback needed. Recovery can be stopped if issues arise.',
            pause_agent: 'Resume the agent to undo this action.',
            resume_agent: 'Pause the agent to undo this action.',
            escalate: 'Cannot undo escalation. Contact the assignee if change is needed.',
            dismiss: 'Intervention can be recreated if issue persists.',
            snooze: 'Intervention can be manually resumed before snooze expires.',
        };
        return rollbackMap[action.actionType] || 'No rollback information available.';
    }
}
exports.ActionConfirmationManager = ActionConfirmationManager;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建动作确认管理器
 */
function createActionConfirmationManager(config) {
    return new ActionConfirmationManager(config);
}
/**
 * 快速创建动作确认
 */
function createConfirmation(action, targetId, targetType, config) {
    const manager = new ActionConfirmationManager(config);
    return manager.createConfirmation(action, targetId, targetType);
}
/**
 * 快速获取确认级别
 */
function getConfirmationLevel(actionType, config) {
    const manager = new ActionConfirmationManager(config);
    return manager.getConfirmationLevel(actionType);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWN0aW9uX2NvbmZpcm1hdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91eC9hY3Rpb25fY29uZmlybWF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7OztHQVVHOzs7QUFxTkgsMEVBRUM7QUFLRCxnREFRQztBQUtELG9EQU1DO0FBck9ELCtFQUErRTtBQUMvRSxTQUFTO0FBQ1QsK0VBQStFO0FBRS9FOztHQUVHO0FBQ0gsTUFBTSx1QkFBdUIsR0FBYTtJQUN4QyxjQUFjO0lBQ2QsZUFBZTtJQUNmLGNBQWM7SUFDZCxpQkFBaUI7SUFDakIsU0FBUztDQUNWLENBQUM7QUFFRjs7R0FFRztBQUNILE1BQU0sMkJBQTJCLEdBQWE7SUFDNUMsYUFBYTtJQUNiLFFBQVE7SUFDUixVQUFVO0lBQ1YsYUFBYTtJQUNiLGtCQUFrQjtDQUNuQixDQUFDO0FBRUYsK0VBQStFO0FBQy9FLFVBQVU7QUFDViwrRUFBK0U7QUFFL0UsTUFBYSx5QkFBeUI7SUFHcEMsWUFBWSxTQUFtQyxFQUFFO1FBQy9DLElBQUksQ0FBQyxNQUFNLEdBQUc7WUFDWixzQkFBc0IsRUFBRSxNQUFNLENBQUMsc0JBQXNCLElBQUksdUJBQXVCO1lBQ2hGLDBCQUEwQixFQUFFLE1BQU0sQ0FBQywwQkFBMEIsSUFBSSwyQkFBMkI7U0FDN0YsQ0FBQztJQUNKLENBQUM7SUFFRDs7T0FFRztJQUNILG9CQUFvQixDQUFDLFVBQWtCO1FBQ3JDLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxzQkFBc0IsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQztZQUM1RCxPQUFPLE1BQU0sQ0FBQztRQUNoQixDQUFDO1FBRUQsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLDBCQUEwQixDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDO1lBQ2hFLE9BQU8sUUFBUSxDQUFDO1FBQ2xCLENBQUM7UUFFRCxPQUFPLFVBQVUsQ0FBQztJ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QUF5QixDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ3RELE9BQU8sT0FBTyxDQUFDLGtCQUFrQixDQUFDLE1BQU0sRUFBRSxRQUFRLEVBQUUsVUFBVSxDQUFDLENBQUM7QUFDbEUsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBZ0Isb0JBQW9CLENBQ2xDLFVBQWtCLEVBQ2xCLE1BQWlDO0lBRWpDLE1BQU0sT0FBTyxHQUFHLElBQUkseUJBQXlCLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDdEQsT0FBTyxPQUFPLENBQUMsb0JBQW9CLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDbEQsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQWN0aW9uIENvbmZpcm1hdGlvbiAtIOWKqOS9nOehruiupOWxglxuICogXG4gKiDogYzotKPvvJpcbiAqIDEuIOe7n+S4gOWKqOS9nOehruiupOWxglxuICogMi4g5a6a5LmJ5ZOq5Lqb5Yqo5L2c5peg6ZyA56Gu6K6kL+mcgOS4gOasoeehruiupC/pnIDlvLrnoa7orqRcbiAqIDMuIOehruiupOaWh+ahiOaJgOmcgOWtl+autS/po47pmanor7TmmI4v5b2x5ZON6IyD5Zu0L3JvbGxiYWNrIGhpbnRcbiAqIFxuICogQHZlcnNpb24gdjAuMS4wXG4gKiBAZGF0ZSAyMDI2LTA0LTA0XG4gKi9cblxuaW1wb3J0IHR5cGUge1xuICBHdWlkZWRBY3Rpb24sXG4gIEFjdGlvbkNvbmZpcm1hdGlvbixcbiAgQ29uZmlybWF0aW9uTGV2ZWwsXG4gIFJpc2tMZXZlbCxcbiAgQWN0aW9uQ29uZmlybWF0aW9uQ29uZmlnLFxufSBmcm9tICcuL2hpdGxfdHlwZXMnO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDliqjkvZznoa7orqTop4TliJlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDml6DpnIDnoa7orqTnmoTliqjkvZznsbvlnotcbiAqL1xuY29uc3QgTk9fQ09ORklSTUFUSU9OX0FDVElPTlM6IHN0cmluZ1tdID0gW1xuICAnYWNrX2luY2lkZW50JyxcbiAgJ2luc3BlY3RfYWdlbnQnLFxuICAnaW5zcGVjdF90YXNrJyxcbiAgJ3JlcXVlc3RfY29udGV4dCcsXG4gICdkaXNtaXNzJyxcbl07XG5cbi8qKlxuICog6ZyA6KaB5by656Gu6K6k55qE5Yqo5L2c57G75Z6LXG4gKi9cbmNvbnN0IFNUUk9OR19DT05GSVJNQVRJT05fQUNUSU9OUzogc3RyaW5nW10gPSBbXG4gICdjYW5jZWxfdGFzaycsXG4gICdyZWplY3QnLFxuICAnZXNjYWxhdGUnLFxuICAncGF1c2VfYWdlbnQnLFxuICAncmVxdWVzdF9yZWNvdmVyeScsXG5dO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDliqjkvZznoa7orqTnrqHnkIblmahcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGNsYXNzIEFjdGlvbkNvbmZpcm1hdGlvbk1hbmFnZXIge1xuICBwcml2YXRlIGNvbmZpZzogUmVxdWlyZWQ8QWN0aW9uQ29uZmlybWF0aW9uQ29uZmlnPjtcbiAgXG4gIGNvbnN0cnVjdG9yKGNvbmZpZzogQWN0aW9uQ29uZmlybWF0aW9uQ29uZmlnID0ge30pIHtcbiAgICB0aGlzLmNvbmZpZyA9IHtcbiAgICAgIG5vQ29uZmlybWF0aW9uUmVxdWlyZWQ6IGNvbmZpZy5ub0NvbmZpcm1hdGlvblJlcXVpcmVkID8/IE5PX0NPTkZJUk1BVElPTl9BQ1RJT05TLFxuICAgICAgc3Ryb25nQ29uZmlybWF0aW9uUmVxdWlyZWQ6IGNvbmZpZy5zdHJvbmdDb25maXJtYXRpb25SZXF1aXJlZCA/PyBTVFJPTkdfQ09ORklSTUFUSU9OX0FDVElPTlMsXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOiOt+WPluWKqOS9nOehruiupOe6p+WIq1xuICAgKi9cbiAgZ2V0Q29uZmlybWF0aW9uTGV2ZWwoYWN0aW9uVHlwZTogc3RyaW5nKTogQ29uZmlybWF0aW9uTGV2ZWwge1xuICAgIGlmICh0aGlzLmNvbmZpZy5ub0NvbmZpcm1hdGlvblJlcXVpcmVkLmluY2x1ZGVzKGFjdGlvblR5cGUpKSB7XG4gICAgICByZXR1cm4gJ25vbmUnO1xuICAgIH1cbiAgICBcbiAgICBpZiAodGhpcy5jb25maWcuc3Ryb25nQ29uZmlybWF0aW9uUmVxdWlyZWQuaW5jbHVkZXMoYWN0aW9uVHlwZSkpIHtcbiAgICAgIHJldHVybiAnc3Ryb25nJztcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuICdzdGFuZGFyZCc7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDliJvlu7rliqjkvZznoa7orqRcbiAgICovXG4gIGNyZWF0ZUNvbmZpcm1hdGlvbihcbiAgICBhY3Rpb246IEd1aWRlZEFjdGlvbixcbiAgICB0YXJnZXRJZDogc3RyaW5nLFxuICAgIHRhcmdldFR5cGU6IHN0cmluZ1xuICApOiBBY3Rpb25Db25maXJtYXRpb24gfCBudWxsIHtcbiAgICBjb25zdCBjb25maXJtYXRpb25MZXZlbCA9IHRoaXMuZ2V0Q29uZmlybWF0aW9uTGV2ZWwoYWN0aW9uLmFjdGlvblR5cGUpO1xuICAgIFxuICAgIGlmIChjb25maXJtYXRpb25MZXZlbCA9PT0gJ25vbmUnKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgXG4gICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgYWN0aW9uSWQ6IGFjdGlvbi5pZCxcbiAgICAgIGFjdGlvblR5cGU6IGFjdGlvbi5hY3Rpb25UeXBlLFxuICAgICAgdGFyZ2V0VHlwZSxcbiAgICAgIHRhcmdldElkLFxuICAgICAgY29uZmlybWF0aW9uTGV2ZWwsXG4gICAgICB0aXRsZTogdGhpcy5nZW5lcmF0ZUNvbmZpcm1hdGlvblRpdGxlKGFjdGlvbiksXG4gICAgICBtZXNzYWdlOiB0aGlzLmdlbmVyYXRlQ29uZmlybWF0aW9uTWVzc2FnZShhY3Rpb24pLFxuICAgICAgaW1wYWN0U3VtbWFyeTogYWN0aW9uLmV4cGVjdGVkT3V0Y29tZSxcbiAgICAgIHJpc2tTdW1tYXJ5OiB0aGlzLmdlbmVyYXRlUmlza1N1bW1hcnkoYWN0aW9uKSxcbiAgICAgIHJvbGxiYWNrSGludDogdGhpcy5nZW5lcmF0ZVJvbGxiYWNrSGludChhY3Rpb24pLFxuICAgICAgY3JlYXRlZEF0OiBub3csXG4gICAgICBzdGF0dXM6ICdwZW5kaW5nJyxcbiAgICB9O1xuICB9XG4gIFxuICAvKipcbiAgICog56Gu6K6k5Yqo5L2cXG4gICAqL1xuICBjb25maXJtQ29uZmlybWF0aW9uKGNvbmZpcm1hdGlvbklkOiBzdHJpbmcpOiBBY3Rpb25Db25maXJtYXRpb24gfCBudWxsIHtcbiAgICAvLyDnroDljJblrp7njrDvvJrlrp7pmYXlupTor6Xku47lrZjlgqjkuK3ojrflj5ZcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOaLkue7neWKqOS9nFxuICAgKi9cbiAgcmVqZWN0Q29uZmlybWF0aW9uKGNvbmZpcm1hdGlvbklkOiBzdHJpbmcpOiBBY3Rpb25Db25maXJtYXRpb24gfCBudWxsIHtcbiAgICAvLyDnroDljJblrp7njrDvvJrlrp7pmYXlupTor6Xku47lrZjlgqjkuK3ojrflj5ZcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOi/h+acn+WKqOS9nFxuICAgKi9cbiAgZXhwaXJlQ29uZmlybWF0aW9uKGNvbmZpcm1hdGlvbklkOiBzdHJpbmcpOiBBY3Rpb25Db25maXJtYXRpb24gfCBudWxsIHtcbiAgICAvLyDnroDljJblrp7njrDvvJrlrp7pmYXlupTor6Xku47lrZjlgqjkuK3ojrflj5ZcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAvLyDlhoXpg6jmlrnms5VcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICBcbiAgLyoqXG4gICAqIOeUn+aIkOehruiupOagh+mimFxuICAgKi9cbiAgcHJpdmF0ZSBnZW5lcmF0ZUNvbmZpcm1hdGlvblRpdGxlKGFjdGlvbjogR3VpZGVkQWN0aW9uKTogc3RyaW5nIHtcbiAgICBjb25zdCB0aXRsZU1hcDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICAgIGFwcHJvdmU6ICdDb25maXJtIEFwcHJvdmFsJyxcbiAgICAgIHJlamVjdDogJ0NvbmZpcm0gUmVqZWN0aW9uJyxcbiAgICAgIHJldHJ5X3Rhc2s6ICdDb25maXJtIFRhc2sgUmV0cnknLFxuICAgICAgY2FuY2VsX3Rhc2s6ICdDb25maXJtIFRhc2sgQ2FuY2VsbGF0aW9uJyxcbiAgICAgIHJlcXVlc3RfcmVjb3Zlcnk6ICdDb25maXJtIFJlY292ZXJ5IFJlcXVlc3QnLFxuICAgICAgcGF1c2VfYWdlbnQ6ICdDb25maXJtIEFnZW50IFBhdXNlJyxcbiAgICAgIHJlc3VtZV9hZ2VudDogJ0NvbmZpcm0gQWdlbnQgUmVzdW1lJyxcbiAgICAgIGVzY2FsYXRlOiAnQ29uZmlybSBFc2NhbGF0aW9uJyxcbiAgICAgIGRpc21pc3M6ICdDb25maXJtIERpc21pc3NhbCcsXG4gICAgICBzbm9vemU6ICdDb25maXJtIFNub296ZScsXG4gICAgfTtcbiAgICBcbiAgICByZXR1cm4gdGl0bGVNYXBbYWN0aW9uLmFjdGlvblR5cGVdIHx8IGBDb25maXJtICR7YWN0aW9uLmxhYmVsfWA7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDnlJ/miJDnoa7orqTmtojmga9cbiAgICovXG4gIHByaXZhdGUgZ2VuZXJhdGVDb25maXJtYXRpb25NZXNzYWdlKGFjdGlvbjogR3VpZGVkQWN0aW9uKTogc3RyaW5nIHtcbiAgICBjb25zdCBtZXNzYWdlTWFwOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgICAgYXBwcm92ZTogJ1lvdSBhcmUgYWJvdXQgdG8gYXBwcm92ZSB0aGlzIHJlcXVlc3QuIFRoaXMgYWN0aW9uIHdpbGwgYWxsb3cgdGhlIHJlcXVlc3QgdG8gcHJvY2VlZC4nLFxuICAgICAgcmVqZWN0OiAnWW91IGFyZSBhYm91dCB0byByZWplY3QgdGhpcyByZXF1ZXN0LiBUaGlzIGFjdGlvbiBtYXkgY2FuY2VsIHJlbGF0ZWQgdGFza3MuJyxcbiAgICAgIHJldHJ5X3Rhc2s6ICdZb3UgYXJlIGFib3V0IHRvIHJldHJ5IHRoaXMgdGFzay4gVGhlIHRhc2sgd2lsbCBiZSByZS1leGVjdXRlZCBmcm9tIHRoZSBiZWdpbm5pbmcuJyxcbiAgICAgIGNhbmNlbF90YXNrOiAnWW91IGFyZSBhYm91dCB0byBjYW5jZWwgdGhpcyB0YXNrLiBUaGlzIGFjdGlvbiBjYW5ub3QgYmUgdW5kb25lIGFuZCBtYXkgYWZmZWN0IHJlbGF0ZWQgd29ya2Zsb3dzLicsXG4gICAgICByZXF1ZXN0X3JlY292ZXJ5OiAnWW91IGFyZSBhYm91dCB0byByZXF1ZXN0IHJlY292ZXJ5LiBUaGUgc3lzdGVtIHdpbGwgYXR0ZW1wdCB0byByZWNvdmVyIHRoZSB0YXJnZXQgYXV0b21hdGljYWxseS4nLFxuICAgICAgcGF1c2VfYWdlbnQ6ICdZb3UgYXJlIGFib3V0IHRvIHBhdXNlIHRoaXMgYWdlbnQuIE5vIG5ldyB0YXNrcyB3aWxsIGJlIGFzc2lnbmVkIHVudGlsIHRoZSBhZ2VudCBpcyByZXN1bWVkLicsXG4gICAgICByZXN1bWVfYWdlbnQ6ICdZb3UgYXJlIGFib3V0IHRvIHJlc3VtZSB0aGlzIGFnZW50LiBUaGUgYWdlbnQgd2lsbCBiZSBhYmxlIHRvIGFjY2VwdCBuZXcgdGFza3MuJyxcbiAgICAgIGVzY2FsYXRlOiAnWW91IGFyZSBhYm91dCB0byBlc2NhbGF0ZSB0aGlzIGlzc3VlLiBJdCB3aWxsIGJlIGFzc2lnbmVkIHRvIG9uLWNhbGwgZW5naW5lZXIgb3IgbWFuYWdlci4nLFxuICAgICAgZGlzbWlzczogJ1lvdSBhcmUgYWJvdXQgdG8gZGlzbWlzcyB0aGlzIGludGVydmVudGlvbi4gSXQgd2lsbCBiZSByZW1vdmVkIGZyb20geW91ciBxdWV1ZS4nLFxuICAgICAgc25vb3plOiAnWW91IGFyZSBhYm91dCB0byBzbm9vemUgdGhpcyBpbnRlcnZlbnRpb24uIEl0IHdpbGwgcmVhcHBlYXIgYWZ0ZXIgdGhlIHNub296ZSBwZXJpb2QuJyxcbiAgICB9O1xuICAgIFxuICAgIHJldHVybiBtZXNzYWdlTWFwW2FjdGlvbi5hY3Rpb25UeXBlXSB8fCBhY3Rpb24uZGVzY3JpcHRpb24gfHwgJ1BsZWFzZSBjb25maXJtIHRoaXMgYWN0aW9uLic7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDnlJ/miJDpo47pmanmkZjopoFcbiAgICovXG4gIHByaXZhdGUgZ2VuZXJhdGVSaXNrU3VtbWFyeShhY3Rpb246IEd1aWRlZEFjdGlvbik6IHN0cmluZyB7XG4gICAgY29uc3Qgcmlza01hcDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICAgIGFwcHJvdmU6ICdMb3cgcmlzazogUmVxdWVzdCB3aWxsIHByb2NlZWQgYXMgZXhwZWN0ZWQuJyxcbiAgICAgIHJlamVjdDogJ01lZGl1bSByaXNrOiBSZWxhdGVkIHRhc2tzIG1heSBiZSBjYW5jZWxsZWQuJyxcbiAgICAgIHJldHJ5X3Rhc2s6ICdMb3cgcmlzazogVGFzayBtYXkgZmFpbCBhZ2FpbiBpZiB1bmRlcmx5aW5nIGlzc3VlIHBlcnNpc3RzLicsXG4gICAgICBjYW5jZWxfdGFzazogJ0hpZ2ggcmlzazogVGhpcyBhY3Rpb24gY2Fubm90IGJlIHVuZG9uZSBhbmQgbWF5IGFmZmVjdCBkZXBlbmRlbnQgd29ya2Zsb3dzLicsXG4gICAgICByZXF1ZXN0X3JlY292ZXJ5OiAnTG93IHJpc2s6IFJlY292ZXJ5IGF0dGVtcHQgbWF5IGZhaWwgaWYgaXNzdWUgaXMgbm90IHJlY292ZXJhYmxlLicsXG4gICAgICBwYXVzZV9hZ2VudDogJ01lZGl1bSByaXNrOiBBZ2VudCB3aWxsIG5vdCBwcm9jZXNzIG5ldyB0YXNrcyB1bnRpbCByZXN1bWVkLicsXG4gICAgICByZXN1bWVfYWdlbnQ6ICdMb3cgcmlzazogQWdlbnQgbWF5IGVuY291bnRlciBzYW1lIGlzc3VlcyBpZiBub3QgcmVzb2x2ZWQuJyxcbiAgICAgIGVzY2FsYXRlOiAnTWVkaXVtIHJpc2s6IElzc3VlIHdpbGwgYmUgYXNzaWduZWQgdG8gaGlnaGVyIGxldmVsIHN1cHBvcnQuJyxcbiAgICAgIGRpc21pc3M6ICdMb3cgcmlzazogSW50ZXJ2ZW50aW9uIHdpbGwgYmUgcmVtb3ZlZCBidXQgdW5kZXJseWluZyBpc3N1ZSBtYXkgcGVyc2lzdC4nLFxuICAgICAgc25vb3plOiAnTG93IHJpc2s6IElzc3VlIHdpbGwgcmVhcHBlYXIgYWZ0ZXIgc25vb3plIHBlcmlvZC4nLFxuICAgIH07XG4gICAgXG4gICAgcmV0dXJuIHJpc2tNYXBbYWN0aW9uLmFjdGlvblR5cGVdIHx8IGBSaXNrIGxldmVsOiAke2FjdGlvbi5yaXNrTGV2ZWwgfHwgJ3Vua25vd24nfWA7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDnlJ/miJDlm57mu5rmj5DnpLpcbiAgICovXG4gIHByaXZhdGUgZ2VuZXJhdGVSb2xsYmFja0hpbnQoYWN0aW9uOiBHdWlkZWRBY3Rpb24pOiBzdHJpbmcge1xuICAgIGNvbnN0IHJvbGxiYWNrTWFwOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgICAgYXBwcm92ZTogJ0Nhbm5vdCB1bmRvIGFwcHJvdmFsLiBDb250YWN0IHN1cHBvcnQgaWYgcmV2ZXJzYWwgaXMgbmVlZGVkLicsXG4gICAgICByZWplY3Q6ICdDYW5ub3QgdW5kbyByZWplY3Rpb24uIEEgbmV3IHJlcXVlc3QgbWF5IG5lZWQgdG8gYmUgc3VibWl0dGVkLicsXG4gICAgICByZXRyeV90YXNrOiAnTm8gcm9sbGJhY2sgbmVlZGVkLiBUYXNrIGNhbiBiZSBjYW5jZWxsZWQgaWYgcmV0cnkgZmFpbHMuJyxcbiAgICAgIGNhbmNlbF90YXNrOiAnQ2Fubm90IHVuZG8gY2FuY2VsbGF0aW9uLiBUYXNrIG11c3QgYmUgcmVjcmVhdGVkIGlmIG5lZWRlZC4nLFxuICAgICAgcmVxdWVzdF9yZWNvdmVyeTogJ05vIHJvbGxiYWNrIG5lZWRlZC4gUmVjb3ZlcnkgY2FuIGJlIHN0b3BwZWQgaWYgaXNzdWVzIGFyaXNlLicsXG4gICAgICBwYXVzZV9hZ2VudDogJ1Jlc3VtZSB0aGUgYWdlbnQgdG8gdW5kbyB0aGlzIGFjdGlvbi4nLFxuICAgICAgcmVzdW1lX2FnZW50OiAnUGF1c2UgdGhlIGFnZW50IHRvIHVuZG8gdGhpcyBhY3Rpb24uJyxcbiAgICAgIGVzY2FsYXRlOiAnQ2Fubm90IHVuZG8gZXNjYWxhdGlvbi4gQ29udGFjdCB0aGUgYXNzaWduZWUgaWYgY2hhbmdlIGlzIG5lZWRlZC4nLFxuICAgICAgZGlzbWlzczogJ0ludGVydmVudGlvbiBjYW4gYmUgcmVjcmVhdGVkIGlmIGlzc3VlIHBlcnNpc3RzLicsXG4gICAgICBzbm9vemU6ICdJbnRlcnZlbnRpb24gY2FuIGJlIG1hbnVhbGx5IHJlc3VtZWQgYmVmb3JlIHNub296ZSBleHBpcmVzLicsXG4gICAgfTtcbiAgICBcbiAgICByZXR1cm4gcm9sbGJhY2tNYXBbYWN0aW9uLmFjdGlvblR5cGVdIHx8ICdObyByb2xsYmFjayBpbmZvcm1hdGlvbiBhdmFpbGFibGUuJztcbiAgfVxufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDkvr/mjbflh73mlbBcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDliJvlu7rliqjkvZznoa7orqTnrqHnkIblmahcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUFjdGlvbkNvbmZpcm1hdGlvbk1hbmFnZXIoY29uZmlnPzogQWN0aW9uQ29uZmlybWF0aW9uQ29uZmlnKTogQWN0aW9uQ29uZmlybWF0aW9uTWFuYWdlciB7XG4gIHJldHVybiBuZXcgQWN0aW9uQ29uZmlybWF0aW9uTWFuYWdlcihjb25maWcpO1xufVxuXG4vKipcbiAqIOW/q+mAn+WIm+W7uuWKqOS9nOehruiupFxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ29uZmlybWF0aW9uKFxuICBhY3Rpb246IEd1aWRlZEFjdGlvbixcbiAgdGFyZ2V0SWQ6IHN0cmluZyxcbiAgdGFyZ2V0VHlwZTogc3RyaW5nLFxuICBjb25maWc/OiBBY3Rpb25Db25maXJtYXRpb25Db25maWdcbik6IEFjdGlvbkNvbmZpcm1hdGlvbiB8IG51bGwge1xuICBjb25zdCBtYW5hZ2VyID0gbmV3IEFjdGlvbkNvbmZpcm1hdGlvbk1hbmFnZXIoY29uZmlnKTtcbiAgcmV0dXJuIG1hbmFnZXIuY3JlYXRlQ29uZmlybWF0aW9uKGFjdGlvbiwgdGFyZ2V0SWQsIHRhcmdldFR5cGUpO1xufVxuXG4vKipcbiAqIOW/q+mAn+iOt+WPluehruiupOe6p+WIq1xuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0Q29uZmlybWF0aW9uTGV2ZWwoXG4gIGFjdGlvblR5cGU6IHN0cmluZyxcbiAgY29uZmlnPzogQWN0aW9uQ29uZmlybWF0aW9uQ29uZmlnXG4pOiBDb25maXJtYXRpb25MZXZlbCB7XG4gIGNvbnN0IG1hbmFnZXIgPSBuZXcgQWN0aW9uQ29uZmlybWF0aW9uTWFuYWdlcihjb25maWcpO1xuICByZXR1cm4gbWFuYWdlci5nZXRDb25maXJtYXRpb25MZXZlbChhY3Rpb25UeXBlKTtcbn1cbiJdfQ==