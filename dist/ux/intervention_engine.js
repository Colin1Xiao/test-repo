"use strict";
/**
 * Intervention Engine - 介入引擎
 *
 * 职责：
 * 1. 从 6C 的 dashboard / attention items 中识别哪些事项需要人介入
 * 2. 输出 must_confirm / should_review / can_dismiss / can_snooze / should_escalate
 * 3. 这里本质上是把 dashboard attention 转成正式的 intervention items
 *
 * @version v0.1.0
 * @date 2026-04-04
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.InterventionEngine = exports.BUILTIN_INTERVENTION_RULES = exports.REPLAY_HOTSPOT_INTERVENTION_RULE = exports.UNHEALTHY_AGENT_INTERVENTION_RULE = exports.DEGRADED_SERVER_INTERVENTION_RULE = exports.BLOCKED_TASK_INTERVENTION_RULE = exports.AGED_APPROVAL_INTERVENTION_RULE = void 0;
exports.createInterventionEngine = createInterventionEngine;
exports.generateInterventions = generateInterventions;
// ============================================================================
// 内置介入规则
// ============================================================================
/**
 * 超时审批介入规则
 */
exports.AGED_APPROVAL_INTERVENTION_RULE = {
    id: 'aged_approval_intervention',
    name: 'Aged Approval Intervention',
    description: 'Approvals pending for more than 1 hour require guided approval',
    match: (item) => {
        return item.sourceType === 'approval' && (item.ageMs || 0) > 60 * 60 * 1000;
    },
    generateIntervention: (item, dashboard) => {
        const now = Date.now();
        const ageMinutes = Math.round((item.ageMs || 0) / 60000);
        return {
            id: `intervention_${item.id}`,
            sourceType: 'approval',
            sourceId: item.sourceId,
            title: `Approval pending for ${ageMinutes} minutes`,
            summary: item.reason,
            severity: ageMinutes > 240 ? 'critical' : 'high',
            reason: `Approval has been pending for ${ageMinutes} minutes`,
            interventionType: 'must_confirm',
            status: 'open',
            requiresHuman: true,
            requiresConfirmation: true,
            createdAt: now,
            updatedAt: now,
            suggestedActions: [
                {
                    id: 'approve',
                    actionType: 'approve',
                    label: 'Approve',
                    description: 'Approve this request',
                    recommended: true,
                    requiresConfirmation: true,
                    riskLevel: 'low',
                    expectedOutcome: 'Request will be approved and execution will continue',
                    params: { approvalId: item.sourceId },
                },
                {
                    id: 'reject',
                    actionType: 'reject',
                    label: 'Reject',
                    description: 'Reject this request',
                    recommended: false,
                    requiresConfirmation: true,
                    riskLevel: 'medium',
                    expectedOutcome: 'Request will be rejected and related tasks may be cancelled',
                    params: { approvalId: item.sourceId },
                },
                {
                    id: 'request_context',
                    actionType: 'request_context',
                    label: 'Request More Context',
                    description: 'Request additional information before deciding',
                    recommended: false,
                    requiresConfirmation: false,
                    riskLevel: 'low',
                    params: { approvalId: item.sourceId },
                },
            ],
            context: {
                snapshotId: dashboard.dashboardId,
                relatedApprovalId: item.sourceId,
                evidence: [item.reason],
                metrics: { ageMinutes },
                recommendedNextStep: 'Review approval details and decide',
            },
        };
    },
};
/**
 * 阻塞任务介入规则
 */
exports.BLOCKED_TASK_INTERVENTION_RULE = {
    id: 'blocked_task_intervention',
    name: 'Blocked Task Intervention',
    description: 'Blocked tasks require operator review',
    match: (item) => {
        return item.sourceType === 'task' && item.reason?.includes('blocked');
    },
    generateIntervention: (item, dashboard) => {
        const now = Date.now();
        return {
            id: `intervention_${item.id}`,
            sourceType: 'task',
            sourceId: item.sourceId,
            title: `Task blocked: ${item.title}`,
            summary: item.reason,
            severity: item.severity === 'critical' ? 'critical' : 'high',
            reason: item.reason,
            interventionType: 'should_review',
            status: 'open',
            requiresHuman: true,
            requiresConfirmation: false,
            createdAt: now,
            updatedAt: now,
            suggestedActions: [
                {
                    id: 'retry',
                    actionType: 'retry_task',
                    label: 'Retry Task',
                    description: 'Retry the blocked task',
                    recommended: true,
                    requiresConfirmation: false,
                    riskLevel: 'low',
                    expectedOutcome: 'Task will be retried and may complete successfully',
                    params: { taskId: item.sourceId },
                },
                {
                    id: 'cancel',
                    actionType: 'cancel_task',
                    label: 'Cancel Task',
                    description: 'Cancel the blocked task',
                    recommended: false,
                    requiresConfirmation: true,
                    riskLevel: 'medium',
                    expectedOutcome: 'Task will be cancelled and related workflows may be affected',
                    params: { taskId: item.sourceId },
                },
                {
                    id: 'inspect',
                    actionType: 'inspect_task',
                    label: 'Inspect Task',
                    description: 'Inspect task details and logs',
                    recommended: false,
                    requiresConfirmation: false,
                    riskLevel: 'low',
                    params: { taskId: item.sourceId },
                },
            ],
            context: {
                snapshotId: dashboard.dashboardId,
                relatedTaskId: item.sourceId,
                evidence: [item.reason],
                recommendedNextStep: 'Review task logs and decide whether to retry or cancel',
            },
        };
    },
};
/**
 * 降级 Server 介入规则
 */
exports.DEGRADED_SERVER_INTERVENTION_RULE = {
    id: 'degraded_server_intervention',
    name: 'Degraded Server Intervention',
    description: 'Degraded or unavailable servers require recovery confirmation',
    match: (item) => {
        return item.sourceType === 'ops' && item.reason?.includes('Server');
    },
    generateIntervention: (item, dashboard) => {
        const now = Date.now();
        return {
            id: `intervention_${item.id}`,
            sourceType: 'ops',
            sourceId: item.sourceId,
            title: item.title,
            summary: item.reason,
            severity: item.severity,
            reason: item.reason,
            interventionType: item.severity === 'critical' ? 'must_confirm' : 'should_review',
            status: 'open',
            requiresHuman: true,
            requiresConfirmation: item.severity === 'critical',
            createdAt: now,
            updatedAt: now,
            suggestedActions: [
                {
                    id: 'request_recovery',
                    actionType: 'request_recovery',
                    label: 'Request Recovery',
                    description: 'Request automatic recovery for this server',
                    recommended: true,
                    requiresConfirmation: true,
                    riskLevel: 'low',
                    expectedOutcome: 'System will attempt to recover the server',
                    params: { targetId: item.sourceId, targetType: 'server' },
                },
                {
                    id: 'acknowledge',
                    actionType: 'ack_incident',
                    label: 'Acknowledge',
                    description: 'Acknowledge this incident',
                    recommended: false,
                    requiresConfirmation: false,
                    riskLevel: 'low',
                    params: { incidentId: `server_${item.sourceId}` },
                },
                {
                    id: 'escalate',
                    actionType: 'escalate',
                    label: 'Escalate',
                    description: 'Escalate to on-call engineer',
                    recommended: false,
                    requiresConfirmation: true,
                    riskLevel: 'medium',
                    params: { targetId: item.sourceId, targetType: 'server' },
                },
            ],
            context: {
                snapshotId: dashboard.dashboardId,
                relatedIncidentId: `server_${item.sourceId}`,
                evidence: [item.reason],
                recommendedNextStep: 'Request recovery or escalate if critical',
            },
        };
    },
};
/**
 * 不健康 Agent 介入规则
 */
exports.UNHEALTHY_AGENT_INTERVENTION_RULE = {
    id: 'unhealthy_agent_intervention',
    name: 'Unhealthy Agent Intervention',
    description: 'Unhealthy or blocked agents require inspection',
    match: (item) => {
        return item.sourceType === 'agent' && (item.severity === 'high' || item.severity === 'critical');
    },
    generateIntervention: (item, dashboard) => {
        const now = Date.now();
        return {
            id: `intervention_${item.id}`,
            sourceType: 'agent',
            sourceId: item.sourceId,
            title: item.title,
            summary: item.reason,
            severity: item.severity,
            reason: item.reason,
            interventionType: 'should_review',
            status: 'open',
            requiresHuman: true,
            requiresConfirmation: false,
            createdAt: now,
            updatedAt: now,
            suggestedActions: [
                {
                    id: 'inspect',
                    actionType: 'inspect_agent',
                    label: 'Inspect Agent',
                    description: 'Inspect agent status and logs',
                    recommended: true,
                    requiresConfirmation: false,
                    riskLevel: 'low',
                    params: { agentId: item.sourceId },
                },
                {
                    id: 'pause',
                    actionType: 'pause_agent',
                    label: 'Pause Agent',
                    description: 'Pause the agent to prevent further issues',
                    recommended: false,
                    requiresConfirmation: true,
                    riskLevel: 'medium',
                    expectedOutcome: 'Agent will be paused and no new tasks will be assigned',
                    params: { agentId: item.sourceId },
                },
                {
                    id: 'resume',
                    actionType: 'resume_agent',
                    label: 'Resume Agent',
                    description: 'Resume the agent if it was paused',
                    recommended: false,
                    requiresConfirmation: false,
                    riskLevel: 'low',
                    params: { agentId: item.sourceId },
                },
            ],
            context: {
                snapshotId: dashboard.dashboardId,
                relatedAgentId: item.sourceId,
                evidence: [item.reason],
                recommendedNextStep: 'Inspect agent and decide whether to pause or resume',
            },
        };
    },
};
/**
 * 重放热点介入规则
 */
exports.REPLAY_HOTSPOT_INTERVENTION_RULE = {
    id: 'replay_hotspot_intervention',
    name: 'Replay Hotspot Intervention',
    description: 'Tasks with multiple replays require operator review',
    match: (item) => {
        return item.sourceType === 'task' && item.reason?.includes('replayed');
    },
    generateIntervention: (item, dashboard) => {
        const now = Date.now();
        return {
            id: `intervention_${item.id}`,
            sourceType: 'task',
            sourceId: item.sourceId,
            title: item.title,
            summary: item.reason,
            severity: 'medium',
            reason: item.reason,
            interventionType: 'can_dismiss',
            status: 'open',
            requiresHuman: true,
            requiresConfirmation: false,
            createdAt: now,
            updatedAt: now,
            suggestedActions: [
                {
                    id: 'request_recovery',
                    actionType: 'request_recovery',
                    label: 'Request Recovery',
                    description: 'Request full recovery for this task',
                    recommended: true,
                    requiresConfirmation: true,
                    riskLevel: 'medium',
                    params: { taskId: item.sourceId },
                },
                {
                    id: 'dismiss',
                    actionType: 'dismiss',
                    label: 'Dismiss',
                    description: 'Dismiss this intervention',
                    recommended: false,
                    requiresConfirmation: false,
                    riskLevel: 'low',
                    params: { interventionId: `intervention_${item.id}` },
                },
            ],
            context: {
                snapshotId: dashboard.dashboardId,
                relatedTaskId: item.sourceId,
                evidence: [item.reason],
                recommendedNextStep: 'Request recovery or dismiss if expected',
            },
        };
    },
};
// ============================================================================
// 所有内置规则
// ============================================================================
/**
 * 所有内置介入规则
 */
exports.BUILTIN_INTERVENTION_RULES = [
    exports.AGED_APPROVAL_INTERVENTION_RULE,
    exports.BLOCKED_TASK_INTERVENTION_RULE,
    exports.DEGRADED_SERVER_INTERVENTION_RULE,
    exports.UNHEALTHY_AGENT_INTERVENTION_RULE,
    exports.REPLAY_HOTSPOT_INTERVENTION_RULE,
];
// ============================================================================
// 介入引擎
// ============================================================================
class InterventionEngine {
    constructor(config = {}) {
        this.rules = new Map();
        this.config = {
            maxOpenInterventions: config.maxOpenInterventions ?? 50,
            autoInterventionThreshold: config.autoInterventionThreshold ?? 0.7,
            defaultSnoozeDurationMs: config.defaultSnoozeDurationMs ?? 60 * 60 * 1000, // 1 小时
        };
        // 注册内置规则
        for (const rule of exports.BUILTIN_INTERVENTION_RULES) {
            this.registerRule(rule);
        }
    }
    /**
     * 注册介入规则
     */
    registerRule(rule) {
        this.rules.set(rule.id, rule);
    }
    /**
     * 注销介入规则
     */
    unregisterRule(ruleId) {
        return this.rules.delete(ruleId);
    }
    /**
     * 从关注项生成介入项
     */
    generateInterventions(attentionItems, dashboard) {
        const interventions = [];
        for (const item of attentionItems) {
            // 尝试匹配规则
            for (const [ruleId, rule] of this.rules.entries()) {
                try {
                    if (rule.match(item, dashboard)) {
                        const intervention = rule.generateIntervention(item, dashboard);
                        interventions.push(intervention);
                        break; // 每个关注项只匹配一条规则
                    }
                }
                catch (error) {
                    console.error(`Rule ${ruleId} error:`, error);
                }
            }
        }
        // 限制数量
        return interventions.slice(0, this.config.maxOpenInterventions);
    }
    /**
     * 从仪表盘生成介入项
     */
    generateInterventionsFromDashboard(dashboard) {
        return this.generateInterventions(dashboard.attentionItems, dashboard);
    }
    /**
     * 获取所有规则
     */
    getAllRules() {
        return Array.from(this.rules.values());
    }
    /**
     * 获取规则数量
     */
    getRuleCount() {
        return this.rules.size;
    }
}
exports.InterventionEngine = InterventionEngine;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建介入引擎
 */
function createInterventionEngine(config) {
    return new InterventionEngine(config);
}
/**
 * 快速生成介入项
 */
function generateInterventions(attentionItems, dashboard, config) {
    const engine = new InterventionEngine(config);
    return engine.generateInterventions(attentionItems, dashboard);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW50ZXJ2ZW50aW9uX2VuZ2luZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91eC9pbnRlcnZlbnRpb25fZW5naW5lLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7OztHQVVHOzs7QUFvZEgsNERBRUM7QUFLRCxzREFPQztBQXBkRCwrRUFBK0U7QUFDL0UsU0FBUztBQUNULCtFQUErRTtBQUUvRTs7R0FFRztBQUNVLFFBQUEsK0JBQStCLEdBQXFCO0lBQy9ELEVBQUUsRUFBRSw0QkFBNEI7SUFDaEMsSUFBSSxFQUFFLDRCQUE0QjtJQUNsQyxXQUFXLEVBQUUsZ0VBQWdFO0lBQzdFLEtBQUssRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFO1FBQ2QsT0FBTyxJQUFJLENBQUMsVUFBVSxLQUFLLFVBQVUsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLElBQUksQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxJQUFJLENBQUM7SUFDOUUsQ0FBQztJQUNELG9CQUFvQixFQUFFLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFBRSxFQUFFO1FBQ3hDLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUN2QixNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssSUFBSSxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQztRQUV6RCxPQUFPO1lBQ0wsRUFBRSxFQUFFLGdCQUFnQixJQUFJLENBQUMsRUFBRSxFQUFFO1lBQzdCLFVBQVUsRUFBRSxVQUFVO1lBQ3RCLFFBQVEsRUFBRSxJQUFJLENBQUMsUUFBUTtZQUN2QixLQUFLLEVBQUUsd0JBQXdCLFVBQVUsVUFBVTtZQUNuRCxPQUFPLEVBQUUsSUFBSSxDQUFDLE1BQU07WUFDcEIsUUFBUSxFQUFFLFVBQVUsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMs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QUMsY0FBYyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQ3pFLENBQUM7SUFFRDs7T0FFRztJQUNILFdBQVc7UUFDVCxPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBQ3pDLENBQUM7SUFFRDs7T0FFRztJQUNILFlBQVk7UUFDVixPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDO0lBQ3pCLENBQUM7Q0FDRjtBQS9FRCxnREErRUM7QUFFRCwrRUFBK0U7QUFDL0UsT0FBTztBQUNQLCtFQUErRTtBQUUvRTs7R0FFRztBQUNILFNBQWdCLHdCQUF3QixDQUFDLE1BQWlDO0lBQ3hFLE9BQU8sSUFBSSxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUN4QyxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFnQixxQkFBcUIsQ0FDbkMsY0FBK0IsRUFDL0IsU0FBNEIsRUFDNUIsTUFBaUM7SUFFakMsTUFBTSxNQUFNLEdBQUcsSUFBSSxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUM5QyxPQUFPLE1BQU0sQ0FBQyxxQkFBcUIsQ0FBQyxjQUFjLEVBQUUsU0FBUyxDQUFDLENBQUM7QUFDakUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogSW50ZXJ2ZW50aW9uIEVuZ2luZSAtIOS7i+WFpeW8leaTjlxuICogXG4gKiDogYzotKPvvJpcbiAqIDEuIOS7jiA2QyDnmoQgZGFzaGJvYXJkIC8gYXR0ZW50aW9uIGl0ZW1zIOS4reivhuWIq+WTquS6m+S6i+mhuemcgOimgeS6uuS7i+WFpVxuICogMi4g6L6T5Ye6IG11c3RfY29uZmlybSAvIHNob3VsZF9yZXZpZXcgLyBjYW5fZGlzbWlzcyAvIGNhbl9zbm9vemUgLyBzaG91bGRfZXNjYWxhdGVcbiAqIDMuIOi/memHjOacrOi0qOS4iuaYr+aKiiBkYXNoYm9hcmQgYXR0ZW50aW9uIOi9rOaIkOato+W8j+eahCBpbnRlcnZlbnRpb24gaXRlbXNcbiAqIFxuICogQHZlcnNpb24gdjAuMS4wXG4gKiBAZGF0ZSAyMDI2LTA0LTA0XG4gKi9cblxuaW1wb3J0IHR5cGUge1xuICBBdHRlbnRpb25JdGVtLFxuICBEYXNoYm9hcmRTbmFwc2hvdCxcbn0gZnJvbSAnLi9kYXNoYm9hcmRfdHlwZXMnO1xuaW1wb3J0IHR5cGUge1xuICBJbnRlcnZlbnRpb25JdGVtLFxuICBJbnRlcnZlbnRpb25SdWxlLFxuICBJbnRlcnZlbnRpb25FbmdpbmVDb25maWcsXG4gIEd1aWRlZEFjdGlvbixcbiAgSW50ZXJ2ZW50aW9uQ29udGV4dCxcbn0gZnJvbSAnLi9oaXRsX3R5cGVzJztcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5YaF572u5LuL5YWl6KeE5YiZXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog6LaF5pe25a6h5om55LuL5YWl6KeE5YiZXG4gKi9cbmV4cG9ydCBjb25zdCBBR0VEX0FQUFJPVkFMX0lOVEVSVkVOVElPTl9SVUxFOiBJbnRlcnZlbnRpb25SdWxlID0ge1xuICBpZDogJ2FnZWRfYXBwcm92YWxfaW50ZXJ2ZW50aW9uJyxcbiAgbmFtZTogJ0FnZWQgQXBwcm92YWwgSW50ZXJ2ZW50aW9uJyxcbiAgZGVzY3JpcHRpb246ICdBcHByb3ZhbHMgcGVuZGluZyBmb3IgbW9yZSB0aGFuIDEgaG91ciByZXF1aXJlIGd1aWRlZCBhcHByb3ZhbCcsXG4gIG1hdGNoOiAoaXRlbSkgPT4ge1xuICAgIHJldHVybiBpdGVtLnNvdXJjZVR5cGUgPT09ICdhcHByb3ZhbCcgJiYgKGl0ZW0uYWdlTXMgfHwgMCkgPiA2MCAqIDYwICogMTAwMDtcbiAgfSxcbiAgZ2VuZXJhdGVJbnRlcnZlbnRpb246IChpdGVtLCBkYXNoYm9hcmQpID0+IHtcbiAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuICAgIGNvbnN0IGFnZU1pbnV0ZXMgPSBNYXRoLnJvdW5kKChpdGVtLmFnZU1zIHx8IDApIC8gNjAwMDApO1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBpZDogYGludGVydmVudGlvbl8ke2l0ZW0uaWR9YCxcbiAgICAgIHNvdXJjZVR5cGU6ICdhcHByb3ZhbCcsXG4gICAgICBzb3VyY2VJZDogaXRlbS5zb3VyY2VJZCxcbiAgICAgIHRpdGxlOiBgQXBwcm92YWwgcGVuZGluZyBmb3IgJHthZ2VNaW51dGVzfSBtaW51dGVzYCxcbiAgICAgIHN1bW1hcnk6IGl0ZW0ucmVhc29uLFxuICAgICAgc2V2ZXJpdHk6IGFnZU1pbnV0ZXMgPiAyNDAgPyAnY3JpdGljYWwnIDogJ2hpZ2gnLFxuICAgICAgcmVhc29uOiBgQXBwcm92YWwgaGFzIGJlZW4gcGVuZGluZyBmb3IgJHthZ2VNaW51dGVzfSBtaW51dGVzYCxcbiAgICAgIGludGVydmVudGlvblR5cGU6ICdtdXN0X2NvbmZpcm0nLFxuICAgICAgc3RhdHVzOiAnb3BlbicsXG4gICAgICByZXF1aXJlc0h1bWFuOiB0cnVlLFxuICAgICAgcmVxdWlyZXNDb25maXJtYXRpb246IHRydWUsXG4gICAgICBjcmVhdGVkQXQ6IG5vdyxcbiAgICAgIHVwZGF0ZWRBdDogbm93LFxuICAgICAgc3VnZ2VzdGVkQWN0aW9uczogW1xuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdhcHByb3ZlJyxcbiAgICAgICAgICBhY3Rpb25UeXBlOiAnYXBwcm92ZScsXG4gICAgICAgICAgbGFiZWw6ICdBcHByb3ZlJyxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogJ0FwcHJvdmUgdGhpcyByZXF1ZXN0JyxcbiAgICAgICAgICByZWNvbW1lbmRlZDogdHJ1ZSxcbiAgICAgICAgICByZXF1aXJlc0NvbmZpcm1hdGlvbjogdHJ1ZSxcbiAgICAgICAgICByaXNrTGV2ZWw6ICdsb3cnLFxuICAgICAgICAgIGV4cGVjdGVkT3V0Y29tZTogJ1JlcXVlc3Qgd2lsbCBiZSBhcHByb3ZlZCBhbmQgZXhlY3V0aW9uIHdpbGwgY29udGludWUnLFxuICAgICAgICAgIHBhcmFtczogeyBhcHByb3ZhbElkOiBpdGVtLnNvdXJjZUlkIH0sXG4gICAgICAgIH0gYXMgR3VpZGVkQWN0aW9uLFxuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdyZWplY3QnLFxuICAgICAgICAgIGFjdGlvblR5cGU6ICdyZWplY3QnLFxuICAgICAgICAgIGxhYmVsOiAnUmVqZWN0JyxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogJ1JlamVjdCB0aGlzIHJlcXVlc3QnLFxuICAgICAgICAgIHJlY29tbWVuZGVkOiBmYWxzZSxcbiAgICAgICAgICByZXF1aXJlc0NvbmZpcm1hdGlvbjogdHJ1ZSxcbiAgICAgICAgICByaXNrTGV2ZWw6ICdtZWRpdW0nLFxuICAgICAgICAgIGV4cGVjdGVkT3V0Y29tZTogJ1JlcXVlc3Qgd2lsbCBiZSByZWplY3RlZCBhbmQgcmVsYXRlZCB0YXNrcyBtYXkgYmUgY2FuY2VsbGVkJyxcbiAgICAgICAgICBwYXJhbXM6IHsgYXBwcm92YWxJZDogaXRlbS5zb3VyY2VJZCB9LFxuICAgICAgICB9IGFzIEd1aWRlZEFjdGlvbixcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAncmVxdWVzdF9jb250ZXh0JyxcbiAgICAgICAgICBhY3Rpb25UeXBlOiAncmVxdWVzdF9jb250ZXh0JyxcbiAgICAgICAgICBsYWJlbDogJ1JlcXVlc3QgTW9yZSBDb250ZXh0JyxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogJ1JlcXVlc3QgYWRkaXRpb25hbCBpbmZvcm1hdGlvbiBiZWZvcmUgZGVjaWRpbmcnLFxuICAgICAgICAgIHJlY29tbWVuZGVkOiBmYWxzZSxcbiAgICAgICAgICByZXF1aXJlc0NvbmZpcm1hdGlvbjogZmFsc2UsXG4gICAgICAgICAgcmlza0xldmVsOiAnbG93JyxcbiAgICAgICAgICBwYXJhbXM6IHsgYXBwcm92YWxJZDogaXRlbS5zb3VyY2VJZCB9LFxuICAgICAgICB9IGFzIEd1aWRlZEFjdGlvbixcbiAgICAgIF0sXG4gICAgICBjb250ZXh0OiB7XG4gICAgICAgIHNuYXBzaG90SWQ6IGRhc2hib2FyZC5kYXNoYm9hcmRJZCxcbiAgICAgICAgcmVsYXRlZEFwcHJvdmFsSWQ6IGl0ZW0uc291cmNlSWQsXG4gICAgICAgIGV2aWRlbmNlOiBbaXRlbS5yZWFzb25dLFxuICAgICAgICBtZXRyaWNzOiB7IGFnZU1pbnV0ZXMgfSxcbiAgICAgICAgcmVjb21tZW5kZWROZXh0U3RlcDogJ1JldmlldyBhcHByb3ZhbCBkZXRhaWxzIGFuZCBkZWNpZGUnLFxuICAgICAgfSBhcyBJbnRlcnZlbnRpb25Db250ZXh0LFxuICAgIH07XG4gIH0sXG59O1xuXG4vKipcbiAqIOmYu+WhnuS7u+WKoeS7i+WFpeinhOWImVxuICovXG5leHBvcnQgY29uc3QgQkxPQ0tFRF9UQVNLX0lOVEVSVkVOVElPTl9SVUxFOiBJbnRlcnZlbnRpb25SdWxlID0ge1xuICBpZDogJ2Jsb2NrZWRfdGFza19pbnRlcnZlbnRpb24nLFxuICBuYW1lOiAnQmxvY2tlZCBUYXNrIEludGVydmVudGlvbicsXG4gIGRlc2NyaXB0aW9uOiAnQmxvY2tlZCB0YXNrcyByZXF1aXJlIG9wZXJhdG9yIHJldmlldycsXG4gIG1hdGNoOiAoaXRlbSkgPT4ge1xuICAgIHJldHVybiBpdGVtLnNvdXJjZVR5cGUgPT09ICd0YXNrJyAmJiBpdGVtLnJlYXNvbj8uaW5jbHVkZXMoJ2Jsb2NrZWQnKTtcbiAgfSxcbiAgZ2VuZXJhdGVJbnRlcnZlbnRpb246IChpdGVtLCBkYXNoYm9hcmQpID0+IHtcbiAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBpZDogYGludGVydmVudGlvbl8ke2l0ZW0uaWR9YCxcbiAgICAgIHNvdXJjZVR5cGU6ICd0YXNrJyxcbiAgICAgIHNvdXJjZUlkOiBpdGVtLnNvdXJjZUlkLFxuICAgICAgdGl0bGU6IGBUYXNrIGJsb2NrZWQ6ICR7aXRlbS50aXRsZX1gLFxuICAgICAgc3VtbWFyeTogaXRlbS5yZWFzb24sXG4gICAgICBzZXZlcml0eTogaXRlbS5zZXZlcml0eSA9PT0gJ2NyaXRpY2FsJyA/ICdjcml0aWNhbCcgOiAnaGlnaCcsXG4gICAgICByZWFzb246IGl0ZW0ucmVhc29uLFxuICAgICAgaW50ZXJ2ZW50aW9uVHlwZTogJ3Nob3VsZF9yZXZpZXcnLFxuICAgICAgc3RhdHVzOiAnb3BlbicsXG4gICAgICByZXF1aXJlc0h1bWFuOiB0cnVlLFxuICAgICAgcmVxdWlyZXNDb25maXJtYXRpb246IGZhbHNlLFxuICAgICAgY3JlYXRlZEF0OiBub3csXG4gICAgICB1cGRhdGVkQXQ6IG5vdyxcbiAgICAgIHN1Z2dlc3RlZEFjdGlvbnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAncmV0cnknLFxuICAgICAgICAgIGFjdGlvblR5cGU6ICdyZXRyeV90YXNrJyxcbiAgICAgICAgICBsYWJlbDogJ1JldHJ5IFRhc2snLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiAnUmV0cnkgdGhlIGJsb2NrZWQgdGFzaycsXG4gICAgICAgICAgcmVjb21tZW5kZWQ6IHRydWUsXG4gICAgICAgICAgcmVxdWlyZXNDb25maXJtYXRpb246IGZhbHNlLFxuICAgICAgICAgIHJpc2tMZXZlbDogJ2xvdycsXG4gICAgICAgICAgZXhwZWN0ZWRPdXRjb21lOiAnVGFzayB3aWxsIGJlIHJldHJpZWQgYW5kIG1heSBjb21wbGV0ZSBzdWNjZXNzZnVsbHknLFxuICAgICAgICAgIHBhcmFtczogeyB0YXNrSWQ6IGl0ZW0uc291cmNlSWQgfSxcbiAgICAgICAgfSBhcyBHdWlkZWRBY3Rpb24sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ2NhbmNlbCcsXG4gICAgICAgICAgYWN0aW9uVHlwZTogJ2NhbmNlbF90YXNrJyxcbiAgICAgICAgICBsYWJlbDogJ0NhbmNlbCBUYXNrJyxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogJ0NhbmNlbCB0aGUgYmxvY2tlZCB0YXNrJyxcbiAgICAgICAgICByZWNvbW1lbmRlZDogZmFsc2UsXG4gICAgICAgICAgcmVxdWlyZXNDb25maXJtYXRpb246IHRydWUsXG4gICAgICAgICAgcmlza0xldmVsOiAnbWVkaXVtJyxcbiAgICAgICAgICBleHBlY3RlZE91dGNvbWU6ICdUYXNrIHdpbGwgYmUgY2FuY2VsbGVkIGFuZCByZWxhdGVkIHdvcmtmbG93cyBtYXkgYmUgYWZmZWN0ZWQnLFxuICAgICAgICAgIHBhcmFtczogeyB0YXNrSWQ6IGl0ZW0uc291cmNlSWQgfSxcbiAgICAgICAgfSBhcyBHdWlkZWRBY3Rpb24sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ2luc3BlY3QnLFxuICAgICAgICAgIGFjdGlvblR5cGU6ICdpbnNwZWN0X3Rhc2snLFxuICAgICAgICAgIGxhYmVsOiAnSW5zcGVjdCBUYXNrJyxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogJ0luc3BlY3QgdGFzayBkZXRhaWxzIGFuZCBsb2dzJyxcbiAgICAgICAgICByZWNvbW1lbmRlZDogZmFsc2UsXG4gICAgICAgICAgcmVxdWlyZXNDb25maXJtYXRpb246IGZhbHNlLFxuICAgICAgICAgIHJpc2tMZXZlbDogJ2xvdycsXG4gICAgICAgICAgcGFyYW1zOiB7IHRhc2tJZDogaXRlbS5zb3VyY2VJZCB9LFxuICAgICAgICB9IGFzIEd1aWRlZEFjdGlvbixcbiAgICAgIF0sXG4gICAgICBjb250ZXh0OiB7XG4gICAgICAgIHNuYXBzaG90SWQ6IGRhc2hib2FyZC5kYXNoYm9hcmRJZCxcbiAgICAgICAgcmVsYXRlZFRhc2tJZDogaXRlbS5zb3VyY2VJZCxcbiAgICAgICAgZXZpZGVuY2U6IFtpdGVtLnJlYXNvbl0sXG4gICAgICAgIHJlY29tbWVuZGVkTmV4dFN0ZXA6ICdSZXZpZXcgdGFzayBsb2dzIGFuZCBkZWNpZGUgd2hldGhlciB0byByZXRyeSBvciBjYW5jZWwnLFxuICAgICAgfSBhcyBJbnRlcnZlbnRpb25Db250ZXh0LFxuICAgIH07XG4gIH0sXG59O1xuXG4vKipcbiAqIOmZjee6pyBTZXJ2ZXIg5LuL5YWl6KeE5YiZXG4gKi9cbmV4cG9ydCBjb25zdCBERUdSQURFRF9TRVJWRVJfSU5URVJWRU5USU9OX1JVTEU6IEludGVydmVudGlvblJ1bGUgPSB7XG4gIGlkOiAnZGVncmFkZWRfc2VydmVyX2ludGVydmVudGlvbicsXG4gIG5hbWU6ICdEZWdyYWRlZCBTZXJ2ZXIgSW50ZXJ2ZW50aW9uJyxcbiAgZGVzY3JpcHRpb246ICdEZWdyYWRlZCBvciB1bmF2YWlsYWJsZSBzZXJ2ZXJzIHJlcXVpcmUgcmVjb3ZlcnkgY29uZmlybWF0aW9uJyxcbiAgbWF0Y2g6IChpdGVtKSA9PiB7XG4gICAgcmV0dXJuIGl0ZW0uc291cmNlVHlwZSA9PT0gJ29wcycgJiYgaXRlbS5yZWFzb24/LmluY2x1ZGVzKCdTZXJ2ZXInKTtcbiAgfSxcbiAgZ2VuZXJhdGVJbnRlcnZlbnRpb246IChpdGVtLCBkYXNoYm9hcmQpID0+IHtcbiAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBpZDogYGludGVydmVudGlvbl8ke2l0ZW0uaWR9YCxcbiAgICAgIHNvdXJjZVR5cGU6ICdvcHMnLFxuICAgICAgc291cmNlSWQ6IGl0ZW0uc291cmNlSWQsXG4gICAgICB0aXRsZTogaXRlbS50aXRsZSxcbiAgICAgIHN1bW1hcnk6IGl0ZW0ucmVhc29uLFxuICAgICAgc2V2ZXJpdHk6IGl0ZW0uc2V2ZXJpdHksXG4gICAgICByZWFzb246IGl0ZW0ucmVhc29uLFxuICAgICAgaW50ZXJ2ZW50aW9uVHlwZTogaXRlbS5zZXZlcml0eSA9PT0gJ2NyaXRpY2FsJyA/ICdtdXN0X2NvbmZpcm0nIDogJ3Nob3VsZF9yZXZpZXcnLFxuICAgICAgc3RhdHVzOiAnb3BlbicsXG4gICAgICByZXF1aXJlc0h1bWFuOiB0cnVlLFxuICAgICAgcmVxdWlyZXNDb25maXJtYXRpb246IGl0ZW0uc2V2ZXJpdHkgPT09ICdjcml0aWNhbCcsXG4gICAgICBjcmVhdGVkQXQ6IG5vdyxcbiAgICAgIHVwZGF0ZWRBdDogbm93LFxuICAgICAgc3VnZ2VzdGVkQWN0aW9uczogW1xuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdyZXF1ZXN0X3JlY292ZXJ5JyxcbiAgICAgICAgICBhY3Rpb25UeXBlOiAncmVxdWVzdF9yZWNvdmVyeScsXG4gICAgICAgICAgbGFiZWw6ICdSZXF1ZXN0IFJlY292ZXJ5JyxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogJ1JlcXVlc3QgYXV0b21hdGljIHJlY292ZXJ5IGZvciB0aGlzIHNlcnZlcicsXG4gICAgICAgICAgcmVjb21tZW5kZWQ6IHRydWUsXG4gICAgICAgICAgcmVxdWlyZXNDb25maXJtYXRpb246IHRydWUsXG4gICAgICAgICAgcmlza0xldmVsOiAnbG93JyxcbiAgICAgICAgICBleHBlY3RlZE91dGNvbWU6ICdTeXN0ZW0gd2lsbCBhdHRlbXB0IHRvIHJlY292ZXIgdGhlIHNlcnZlcicsXG4gICAgICAgICAgcGFyYW1zOiB7IHRhcmdldElkOiBpdGVtLnNvdXJjZUlkLCB0YXJnZXRUeXBlOiAnc2VydmVyJyB9LFxuICAgICAgICB9IGFzIEd1aWRlZEFjdGlvbixcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAnYWNrbm93bGVkZ2UnLFxuICAgICAgICAgIGFjdGlvblR5cGU6ICdhY2tfaW5jaWRlbnQnLFxuICAgICAgICAgIGxhYmVsOiAnQWNrbm93bGVkZ2UnLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQWNrbm93bGVkZ2UgdGhpcyBpbmNpZGVudCcsXG4gICAgICAgICAgcmVjb21tZW5kZWQ6IGZhbHNlLFxuICAgICAgICAgIHJlcXVpcmVzQ29uZmlybWF0aW9uOiBmYWxzZSxcbiAgICAgICAgICByaXNrTGV2ZWw6ICdsb3cnLFxuICAgICAgICAgIHBhcmFtczogeyBpbmNpZGVudElkOiBgc2VydmVyXyR7aXRlbS5zb3VyY2VJZH1gIH0sXG4gICAgICAgIH0gYXMgR3VpZGVkQWN0aW9uLFxuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdlc2NhbGF0ZScsXG4gICAgICAgICAgYWN0aW9uVHlwZTogJ2VzY2FsYXRlJyxcbiAgICAgICAgICBsYWJlbDogJ0VzY2FsYXRlJyxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogJ0VzY2FsYXRlIHRvIG9uLWNhbGwgZW5naW5lZXInLFxuICAgICAgICAgIHJlY29tbWVuZGVkOiBmYWxzZSxcbiAgICAgICAgICByZXF1aXJlc0NvbmZpcm1hdGlvbjogdHJ1ZSxcbiAgICAgICAgICByaXNrTGV2ZWw6ICdtZWRpdW0nLFxuICAgICAgICAgIHBhcmFtczogeyB0YXJnZXRJZDogaXRlbS5zb3VyY2VJZCwgdGFyZ2V0VHlwZTogJ3NlcnZlcicgfSxcbiAgICAgICAgfSBhcyBHdWlkZWRBY3Rpb24sXG4gICAgICBdLFxuICAgICAgY29udGV4dDoge1xuICAgICAgICBzbmFwc2hvdElkOiBkYXNoYm9hcmQuZGFzaGJvYXJkSWQsXG4gICAgICAgIHJlbGF0ZWRJbmNpZGVudElkOiBgc2VydmVyXyR7aXRlbS5zb3VyY2VJZH1gLFxuICAgICAgICBldmlkZW5jZTogW2l0ZW0ucmVhc29uXSxcbiAgICAgICAgcmVjb21tZW5kZWROZXh0U3RlcDogJ1JlcXVlc3QgcmVjb3Zlcnkgb3IgZXNjYWxhdGUgaWYgY3JpdGljYWwnLFxuICAgICAgfSBhcyBJbnRlcnZlbnRpb25Db250ZXh0LFxuICAgIH07XG4gIH0sXG59O1xuXG4vKipcbiAqIOS4jeWBpeW6tyBBZ2VudCDku4vlhaXop4TliJlcbiAqL1xuZXhwb3J0IGNvbnN0IFVOSEVBTFRIWV9BR0VOVF9JTlRFUlZFTlRJT05fUlVMRTogSW50ZXJ2ZW50aW9uUnVsZSA9IHtcbiAgaWQ6ICd1bmhlYWx0aHlfYWdlbnRfaW50ZXJ2ZW50aW9uJyxcbiAgbmFtZTogJ1VuaGVhbHRoeSBBZ2VudCBJbnRlcnZlbnRpb24nLFxuICBkZXNjcmlwdGlvbjogJ1VuaGVhbHRoeSBvciBibG9ja2VkIGFnZW50cyByZXF1aXJlIGluc3BlY3Rpb24nLFxuICBtYXRjaDogKGl0ZW0pID0+IHtcbiAgICByZXR1cm4gaXRlbS5zb3VyY2VUeXBlID09PSAnYWdlbnQnICYmIChpdGVtLnNldmVyaXR5ID09PSAnaGlnaCcgfHwgaXRlbS5zZXZlcml0eSA9PT0gJ2NyaXRpY2FsJyk7XG4gIH0sXG4gIGdlbmVyYXRlSW50ZXJ2ZW50aW9uOiAoaXRlbSwgZGFzaGJvYXJkKSA9PiB7XG4gICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgaWQ6IGBpbnRlcnZlbnRpb25fJHtpdGVtLmlkfWAsXG4gICAgICBzb3VyY2VUeXBlOiAnYWdlbnQnLFxuICAgICAgc291cmNlSWQ6IGl0ZW0uc291cmNlSWQsXG4gICAgICB0aXRsZTogaXRlbS50aXRsZSxcbiAgICAgIHN1bW1hcnk6IGl0ZW0ucmVhc29uLFxuICAgICAgc2V2ZXJpdHk6IGl0ZW0uc2V2ZXJpdHksXG4gICAgICByZWFzb246IGl0ZW0ucmVhc29uLFxuICAgICAgaW50ZXJ2ZW50aW9uVHlwZTogJ3Nob3VsZF9yZXZpZXcnLFxuICAgICAgc3RhdHVzOiAnb3BlbicsXG4gICAgICByZXF1aXJlc0h1bWFuOiB0cnVlLFxuICAgICAgcmVxdWlyZXNDb25maXJtYXRpb246IGZhbHNlLFxuICAgICAgY3JlYXRlZEF0OiBub3csXG4gICAgICB1cGRhdGVkQXQ6IG5vdyxcbiAgICAgIHN1Z2dlc3RlZEFjdGlvbnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAnaW5zcGVjdCcsXG4gICAgICAgICAgYWN0aW9uVHlwZTogJ2luc3BlY3RfYWdlbnQnLFxuICAgICAgICAgIGxhYmVsOiAnSW5zcGVjdCBBZ2VudCcsXG4gICAgICAgICAgZGVzY3JpcHRpb246ICdJbnNwZWN0IGFnZW50IHN0YXR1cyBhbmQgbG9ncycsXG4gICAgICAgICAgcmVjb21tZW5kZWQ6IHRydWUsXG4gICAgICAgICAgcmVxdWlyZXNDb25maXJtYXRpb246IGZhbHNlLFxuICAgICAgICAgIHJpc2tMZXZlbDogJ2xvdycsXG4gICAgICAgICAgcGFyYW1zOiB7IGFnZW50SWQ6IGl0ZW0uc291cmNlSWQgfSxcbiAgICAgICAgfSBhcyBHdWlkZWRBY3Rpb24sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ3BhdXNlJyxcbiAgICAgICAgICBhY3Rpb25UeXBlOiAncGF1c2VfYWdlbnQnLFxuICAgICAgICAgIGxhYmVsOiAnUGF1c2UgQWdlbnQnLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiAnUGF1c2UgdGhlIGFnZW50IHRvIHByZXZlbnQgZnVydGhlciBpc3N1ZXMnLFxuICAgICAgICAgIHJlY29tbWVuZGVkOiBmYWxzZSxcbiAgICAgICAgICByZXF1aXJlc0NvbmZpcm1hdGlvbjogdHJ1ZSxcbiAgICAgICAgICByaXNrTGV2ZWw6ICdtZWRpdW0nLFxuICAgICAgICAgIGV4cGVjdGVkT3V0Y29tZTogJ0FnZW50IHdpbGwgYmUgcGF1c2VkIGFuZCBubyBuZXcgdGFza3Mgd2lsbCBiZSBhc3NpZ25lZCcsXG4gICAgICAgICAgcGFyYW1zOiB7IGFnZW50SWQ6IGl0ZW0uc291cmNlSWQgfSxcbiAgICAgICAgfSBhcyBHdWlkZWRBY3Rpb24sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ3Jlc3VtZScsXG4gICAgICAgICAgYWN0aW9uVHlwZTogJ3Jlc3VtZV9hZ2VudCcsXG4gICAgICAgICAgbGFiZWw6ICdSZXN1bWUgQWdlbnQnLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiAnUmVzdW1lIHRoZSBhZ2VudCBpZiBpdCB3YXMgcGF1c2VkJyxcbiAgICAgICAgICByZWNvbW1lbmRlZDogZmFsc2UsXG4gICAgICAgICAgcmVxdWlyZXNDb25maXJtYXRpb246IGZhbHNlLFxuICAgICAgICAgIHJpc2tMZXZlbDogJ2xvdycsXG4gICAgICAgICAgcGFyYW1zOiB7IGFnZW50SWQ6IGl0ZW0uc291cmNlSWQgfSxcbiAgICAgICAgfSBhcyBHdWlkZWRBY3Rpb24sXG4gICAgICBdLFxuICAgICAgY29udGV4dDoge1xuICAgICAgICBzbmFwc2hvdElkOiBkYXNoYm9hcmQuZGFzaGJvYXJkSWQsXG4gICAgICAgIHJlbGF0ZWRBZ2VudElkOiBpdGVtLnNvdXJjZUlkLFxuICAgICAgICBldmlkZW5jZTogW2l0ZW0ucmVhc29uXSxcbiAgICAgICAgcmVjb21tZW5kZWROZXh0U3RlcDogJ0luc3BlY3QgYWdlbnQgYW5kIGRlY2lkZSB3aGV0aGVyIHRvIHBhdXNlIG9yIHJlc3VtZScsXG4gICAgICB9IGFzIEludGVydmVudGlvbkNvbnRleHQsXG4gICAgfTtcbiAgfSxcbn07XG5cbi8qKlxuICog6YeN5pS+54Ot54K55LuL5YWl6KeE5YiZXG4gKi9cbmV4cG9ydCBjb25zdCBSRVBMQVlfSE9UU1BPVF9JTlRFUlZFTlRJT05fUlVMRTogSW50ZXJ2ZW50aW9uUnVsZSA9IHtcbiAgaWQ6ICdyZXBsYXlfaG90c3BvdF9pbnRlcnZlbnRpb24nLFxuICBuYW1lOiAnUmVwbGF5IEhvdHNwb3QgSW50ZXJ2ZW50aW9uJyxcbiAgZGVzY3JpcHRpb246ICdUYXNrcyB3aXRoIG11bHRpcGxlIHJlcGxheXMgcmVxdWlyZSBvcGVyYXRvciByZXZpZXcnLFxuICBtYXRjaDogKGl0ZW0pID0+IHtcbiAgICByZXR1cm4gaXRlbS5zb3VyY2VUeXBlID09PSAndGFzaycgJiYgaXRlbS5yZWFzb24/LmluY2x1ZGVzKCdyZXBsYXllZCcpO1xuICB9LFxuICBnZW5lcmF0ZUludGVydmVudGlvbjogKGl0ZW0sIGRhc2hib2FyZCkgPT4ge1xuICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIGlkOiBgaW50ZXJ2ZW50aW9uXyR7aXRlbS5pZH1gLFxuICAgICAgc291cmNlVHlwZTogJ3Rhc2snLFxuICAgICAgc291cmNlSWQ6IGl0ZW0uc291cmNlSWQsXG4gICAgICB0aXRsZTogaXRlbS50aXRsZSxcbiAgICAgIHN1bW1hcnk6IGl0ZW0ucmVhc29uLFxuICAgICAgc2V2ZXJpdHk6ICdtZWRpdW0nLFxuICAgICAgcmVhc29uOiBpdGVtLnJlYXNvbixcbiAgICAgIGludGVydmVudGlvblR5cGU6ICdjYW5fZGlzbWlzcycsXG4gICAgICBzdGF0dXM6ICdvcGVuJyxcbiAgICAgIHJlcXVpcmVzSHVtYW46IHRydWUsXG4gICAgICByZXF1aXJlc0NvbmZpcm1hdGlvbjogZmFsc2UsXG4gICAgICBjcmVhdGVkQXQ6IG5vdyxcbiAgICAgIHVwZGF0ZWRBdDogbm93LFxuICAgICAgc3VnZ2VzdGVkQWN0aW9uczogW1xuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdyZXF1ZXN0X3JlY292ZXJ5JyxcbiAgICAgICAgICBhY3Rpb25UeXBlOiAncmVxdWVzdF9yZWNvdmVyeScsXG4gICAgICAgICAgbGFiZWw6ICdSZXF1ZXN0IFJlY292ZXJ5JyxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogJ1JlcXVlc3QgZnVsbCByZWNvdmVyeSBmb3IgdGhpcyB0YXNrJyxcbiAgICAgICAgICByZWNvbW1lbmRlZDogdHJ1ZSxcbiAgICAgICAgICByZXF1aXJlc0NvbmZpcm1hdGlvbjogdHJ1ZSxcbiAgICAgICAgICByaXNrTGV2ZWw6ICdtZWRpdW0nLFxuICAgICAgICAgIHBhcmFtczogeyB0YXNrSWQ6IGl0ZW0uc291cmNlSWQgfSxcbiAgICAgICAgfSBhcyBHdWlkZWRBY3Rpb24sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ2Rpc21pc3MnLFxuICAgICAgICAgIGFjdGlvblR5cGU6ICdkaXNtaXNzJyxcbiAgICAgICAgICBsYWJlbDogJ0Rpc21pc3MnLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiAnRGlzbWlzcyB0aGlzIGludGVydmVudGlvbicsXG4gICAgICAgICAgcmVjb21tZW5kZWQ6IGZhbHNlLFxuICAgICAgICAgIHJlcXVpcmVzQ29uZmlybWF0aW9uOiBmYWxzZSxcbiAgICAgICAgICByaXNrTGV2ZWw6ICdsb3cnLFxuICAgICAgICAgIHBhcmFtczogeyBpbnRlcnZlbnRpb25JZDogYGludGVydmVudGlvbl8ke2l0ZW0uaWR9YCB9LFxuICAgICAgICB9IGFzIEd1aWRlZEFjdGlvbixcbiAgICAgIF0sXG4gICAgICBjb250ZXh0OiB7XG4gICAgICAgIHNuYXBzaG90SWQ6IGRhc2hib2FyZC5kYXNoYm9hcmRJZCxcbiAgICAgICAgcmVsYXRlZFRhc2tJZDogaXRlbS5zb3VyY2VJZCxcbiAgICAgICAgZXZpZGVuY2U6IFtpdGVtLnJlYXNvbl0sXG4gICAgICAgIHJlY29tbWVuZGVkTmV4dFN0ZXA6ICdSZXF1ZXN0IHJlY292ZXJ5IG9yIGRpc21pc3MgaWYgZXhwZWN0ZWQnLFxuICAgICAgfSBhcyBJbnRlcnZlbnRpb25Db250ZXh0LFxuICAgIH07XG4gIH0sXG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDmiYDmnInlhoXnva7op4TliJlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDmiYDmnInlhoXnva7ku4vlhaXop4TliJlcbiAqL1xuZXhwb3J0IGNvbnN0IEJVSUxUSU5fSU5URVJWRU5USU9OX1JVTEVTOiBJbnRlcnZlbnRpb25SdWxlW10gPSBbXG4gIEFHRURfQVBQUk9WQUxfSU5URVJWRU5USU9OX1JVTEUsXG4gIEJMT0NLRURfVEFTS19JTlRFUlZFTlRJT05fUlVMRSxcbiAgREVHUkFERURfU0VSVkVSX0lOVEVSVkVOVElPTl9SVUxFLFxuICBVTkhFQUxUSFlfQUdFTlRfSU5URVJWRU5USU9OX1JVTEUsXG4gIFJFUExBWV9IT1RTUE9UX0lOVEVSVkVOVElPTl9SVUxFLFxuXTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5LuL5YWl5byV5pOOXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBjbGFzcyBJbnRlcnZlbnRpb25FbmdpbmUge1xuICBwcml2YXRlIGNvbmZpZzogUmVxdWlyZWQ8SW50ZXJ2ZW50aW9uRW5naW5lQ29uZmlnPjtcbiAgcHJpdmF0ZSBydWxlczogTWFwPHN0cmluZywgSW50ZXJ2ZW50aW9uUnVsZT4gPSBuZXcgTWFwKCk7XG4gIFxuICBjb25zdHJ1Y3Rvcihjb25maWc6IEludGVydmVudGlvbkVuZ2luZUNvbmZpZyA9IHt9KSB7XG4gICAgdGhpcy5jb25maWcgPSB7XG4gICAgICBtYXhPcGVuSW50ZXJ2ZW50aW9uczogY29uZmlnLm1heE9wZW5JbnRlcnZlbnRpb25zID8/IDUwLFxuICAgICAgYXV0b0ludGVydmVudGlvblRocmVzaG9sZDogY29uZmlnLmF1dG9JbnRlcnZlbnRpb25UaHJlc2hvbGQgPz8gMC43LFxuICAgICAgZGVmYXVsdFNub296ZUR1cmF0aW9uTXM6IGNvbmZpZy5kZWZhdWx0U25vb3plRHVyYXRpb25NcyA/PyA2MCAqIDYwICogMTAwMCwgLy8gMSDlsI/ml7ZcbiAgICB9O1xuICAgIFxuICAgIC8vIOazqOWGjOWGhee9ruinhOWImVxuICAgIGZvciAoY29uc3QgcnVsZSBvZiBCVUlMVElOX0lOVEVSVkVOVElPTl9SVUxFUykge1xuICAgICAgdGhpcy5yZWdpc3RlclJ1bGUocnVsZSk7XG4gICAgfVxuICB9XG4gIFxuICAvKipcbiAgICog5rOo5YaM5LuL5YWl6KeE5YiZXG4gICAqL1xuICByZWdpc3RlclJ1bGUocnVsZTogSW50ZXJ2ZW50aW9uUnVsZSk6IHZvaWQge1xuICAgIHRoaXMucnVsZXMuc2V0KHJ1bGUuaWQsIHJ1bGUpO1xuICB9XG4gIFxuICAvKipcbiAgICog5rOo6ZSA5LuL5YWl6KeE5YiZXG4gICAqL1xuICB1bnJlZ2lzdGVyUnVsZShydWxlSWQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLnJ1bGVzLmRlbGV0ZShydWxlSWQpO1xuICB9XG4gIFxuICAvKipcbiAgICog5LuO5YWz5rOo6aG555Sf5oiQ5LuL5YWl6aG5XG4gICAqL1xuICBnZW5lcmF0ZUludGVydmVudGlvbnMoXG4gICAgYXR0ZW50aW9uSXRlbXM6IEF0dGVudGlvbkl0ZW1bXSxcbiAgICBkYXNoYm9hcmQ6IERhc2hib2FyZFNuYXBzaG90XG4gICk6IEludGVydmVudGlvbkl0ZW1bXSB7XG4gICAgY29uc3QgaW50ZXJ2ZW50aW9uczogSW50ZXJ2ZW50aW9uSXRlbVtdID0gW107XG4gICAgXG4gICAgZm9yIChjb25zdCBpdGVtIG9mIGF0dGVudGlvbkl0ZW1zKSB7XG4gICAgICAvLyDlsJ3or5XljLnphY3op4TliJlcbiAgICAgIGZvciAoY29uc3QgW3J1bGVJZCwgcnVsZV0gb2YgdGhpcy5ydWxlcy5lbnRyaWVzKCkpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBpZiAocnVsZS5tYXRjaChpdGVtLCBkYXNoYm9hcmQpKSB7XG4gICAgICAgICAgICBjb25zdCBpbnRlcnZlbnRpb24gPSBydWxlLmdlbmVyYXRlSW50ZXJ2ZW50aW9uKGl0ZW0sIGRhc2hib2FyZCk7XG4gICAgICAgICAgICBpbnRlcnZlbnRpb25zLnB1c2goaW50ZXJ2ZW50aW9uKTtcbiAgICAgICAgICAgIGJyZWFrOyAvLyDmr4/kuKrlhbPms6jpobnlj6rljLnphY3kuIDmnaHop4TliJlcbiAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcihgUnVsZSAke3J1bGVJZH0gZXJyb3I6YCwgZXJyb3IpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIOmZkOWItuaVsOmHj1xuICAgIHJldHVybiBpbnRlcnZlbnRpb25zLnNsaWNlKDAsIHRoaXMuY29uZmlnLm1heE9wZW5JbnRlcnZlbnRpb25zKTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOS7juS7quihqOebmOeUn+aIkOS7i+WFpemhuVxuICAgKi9cbiAgZ2VuZXJhdGVJbnRlcnZlbnRpb25zRnJvbURhc2hib2FyZChkYXNoYm9hcmQ6IERhc2hib2FyZFNuYXBzaG90KTogSW50ZXJ2ZW50aW9uSXRlbVtdIHtcbiAgICByZXR1cm4gdGhpcy5nZW5lcmF0ZUludGVydmVudGlvbnMoZGFzaGJvYXJkLmF0dGVudGlvbkl0ZW1zLCBkYXNoYm9hcmQpO1xuICB9XG4gIFxuICAvKipcbiAgICog6I635Y+W5omA5pyJ6KeE5YiZXG4gICAqL1xuICBnZXRBbGxSdWxlcygpOiBJbnRlcnZlbnRpb25SdWxlW10ge1xuICAgIHJldHVybiBBcnJheS5mcm9tKHRoaXMucnVsZXMudmFsdWVzKCkpO1xuICB9XG4gIFxuICAvKipcbiAgICog6I635Y+W6KeE5YiZ5pWw6YePXG4gICAqL1xuICBnZXRSdWxlQ291bnQoKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy5ydWxlcy5zaXplO1xuICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOS+v+aNt+WHveaVsFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIOWIm+W7uuS7i+WFpeW8leaTjlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlSW50ZXJ2ZW50aW9uRW5naW5lKGNvbmZpZz86IEludGVydmVudGlvbkVuZ2luZUNvbmZpZyk6IEludGVydmVudGlvbkVuZ2luZSB7XG4gIHJldHVybiBuZXcgSW50ZXJ2ZW50aW9uRW5naW5lKGNvbmZpZyk7XG59XG5cbi8qKlxuICog5b+r6YCf55Sf5oiQ5LuL5YWl6aG5XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZW5lcmF0ZUludGVydmVudGlvbnMoXG4gIGF0dGVudGlvbkl0ZW1zOiBBdHRlbnRpb25JdGVtW10sXG4gIGRhc2hib2FyZDogRGFzaGJvYXJkU25hcHNob3QsXG4gIGNvbmZpZz86IEludGVydmVudGlvbkVuZ2luZUNvbmZpZ1xuKTogSW50ZXJ2ZW50aW9uSXRlbVtdIHtcbiAgY29uc3QgZW5naW5lID0gbmV3IEludGVydmVudGlvbkVuZ2luZShjb25maWcpO1xuICByZXR1cm4gZW5naW5lLmdlbmVyYXRlSW50ZXJ2ZW50aW9ucyhhdHRlbnRpb25JdGVtcywgZGFzaGJvYXJkKTtcbn1cbiJdfQ==