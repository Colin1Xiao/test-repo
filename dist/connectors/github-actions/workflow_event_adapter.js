"use strict";
/**
 * Workflow Event Adapter
 * Phase 2B-2 - Workflow 事件适配器
 *
 * 职责：
 * - 将 Workflow Run 事件转换为内部标准事件
 * - workflow_run completed(failure) → Incident
 * - deployment → Approval
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowEventAdapter = void 0;
exports.createWorkflowEventAdapter = createWorkflowEventAdapter;
// ============================================================================
// Workflow Event Adapter
// ============================================================================
class WorkflowEventAdapter {
    constructor(config = {}) {
        this.config = {
            autoCreateIncident: config.autoCreateIncident ?? true,
            autoCreateApproval: config.autoCreateApproval ?? true,
            autoCreateAttention: config.autoCreateAttention ?? true,
            failureSeverity: config.failureSeverity ?? 'high',
            ignoreWorkflows: config.ignoreWorkflows ?? [],
            requireApprovalForEnvironments: config.requireApprovalForEnvironments ?? ['production', 'staging'],
        };
    }
    /**
     * 适配 Workflow Run 事件
     */
    adaptWorkflowRunEvent(event) {
        const result = {};
        // 检查是否忽略该 Workflow
        if (this.config.ignoreWorkflows.includes(event.workflow.name)) {
            return result;
        }
        // workflow_run completed(failure) → Incident
        if (event.action === 'completed' && event.workflow.conclusion === 'failure') {
            if (this.config.autoCreateIncident) {
                result.incident = this.mapFailedWorkflowToIncident(event);
            }
            if (this.config.autoCreateAttention) {
                result.inboxItem = this.mapFailedWorkflowToInboxItem(event);
            }
        }
        return result;
    }
    /**
     * 适配 Deployment 事件
     */
    adaptDeploymentEvent(event) {
        const result = {};
        // 检查环境是否需要审批
        const needsApproval = this.config.requireApprovalForEnvironments.includes(event.deployment.environment);
        if (needsApproval && this.config.autoCreateApproval) {
            result.approval = this.mapDeploymentToApproval(event);
        }
        // 所有 Deployment 都创建 Inbox Item
        result.inboxItem = this.mapDeploymentToInboxItem(event);
        return result;
    }
    /**
     * 适配 Deployment Status 事件
     */
    adaptDeploymentStatusEvent(event) {
        const result = {};
        // deployment_status(failure) → Attention
        if (event.deploymentStatus.state === 'failure' && this.config.autoCreateAttention) {
            result.inboxItem = this.mapFailedDeploymentToInboxItem(event);
        }
        return result;
    }
    // ============================================================================
    // 映射方法
    // ============================================================================
    mapFailedWorkflowToIncident(event) {
        return {
            incidentId: `github_actions_workflow_${event.workflow.runId}`,
            type: 'workflow_failure',
            severity: this.config.failureSeverity,
            description: `Workflow ${event.workflow.name} failed on ${event.workflow.headBranch}`,
            metadata: {
                source: 'github_actions',
                workflowName: event.workflow.name,
                runId: event.workflow.runId,
                conclusion: event.workflow.conclusion,
            },
        };
    }
    mapFailedWorkflowToInboxItem(event) {
        return {
            itemType: 'incident',
            sourceId: `${event.repository.fullName}/actions/runs/${event.workflow.runId}`,
            title: `Workflow Failed: ${event.workflow.name}`,
            summary: `Run #${event.workflow.runNumber} failed on ${event.workflow.headBranch}`,
            severity: this.config.failureSeverity,
            suggestedActions: ['rerun_workflow', 'open'],
            metadata: {
                source: 'github_actions',
                workflowName: event.workflow.name,
                runId: event.workflow.runId,
                branch: event.workflow.headBranch,
            },
        };
    }
    mapDeploymentToApproval(event) {
        return {
            approvalId: `github_deployment_${event.deployment.id}`,
            scope: `Deploy to ${event.deployment.environment}`,
            reason: `Deployment requested by ${event.deployment.creator.login}: ${event.deployment.description || ''}`,
            requestingAgent: event.deployment.creator.login,
            metadata: {
                source: 'github_actions',
                sourceType: 'deployment_approval',
                deploymentId: event.deployment.id,
                environment: event.deployment.environment,
                ref: event.deployment.ref,
            },
        };
    }
    mapDeploymentToInboxItem(event) {
        return {
            itemType: 'approval',
            sourceId: `${event.repository.fullName}/deployments/${event.deployment.id}`,
            title: `Deployment: ${event.deployment.environment}`,
            summary: `Deploy ${event.deployment.ref} to ${event.deployment.environment}`,
            severity: 'high',
            suggestedActions: ['approve', 'reject'],
            metadata: {
                source: 'github_actions',
                deploymentId: event.deployment.id,
                environment: event.deployment.environment,
                ref: event.deployment.ref,
            },
        };
    }
    mapFailedDeploymentToInboxItem(event) {
        return {
            itemType: 'incident',
            sourceId: `${event.repository.fullName}/deployments/${event.deployment.id}`,
            title: `Deployment Failed: ${event.deployment.environment}`,
            summary: `Deployment to ${event.deployment.environment} failed`,
            severity: 'critical',
            suggestedActions: ['open', 'retry'],
            metadata: {
                source: 'github_actions',
                deploymentId: event.deployment.id,
                environment: event.deployment.environment,
                state: event.deploymentStatus.state,
            },
        };
    }
}
exports.WorkflowEventAdapter = WorkflowEventAdapter;
// ============================================================================
// 工厂函数
// ============================================================================
function createWorkflowEventAdapter(config) {
    return new WorkflowEventAdapter(config);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2Zsb3dfZXZlbnRfYWRhcHRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jb25uZWN0b3JzL2dpdGh1Yi1hY3Rpb25zL3dvcmtmbG93X2V2ZW50X2FkYXB0ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7OztHQVFHOzs7QUF5TUgsZ0VBRUM7QUFuTEQsK0VBQStFO0FBQy9FLHlCQUF5QjtBQUN6QiwrRUFBK0U7QUFFL0UsTUFBYSxvQkFBb0I7SUFHL0IsWUFBWSxTQUFxQyxFQUFFO1FBQ2pELElBQUksQ0FBQyxNQUFNLEdBQUc7WUFDWixrQkFBa0IsRUFBRSxNQUFNLENBQUMsa0JBQWtCLElBQUksSUFBSTtZQUNyRCxrQkFBa0IsRUFBRSxNQUFNLENBQUMsa0JBQWtCLElBQUksSUFBSTtZQUNyRCxtQkFBbUIsRUFBRSxNQUFNLENBQUMsbUJBQW1CLElBQUksSUFBSTtZQUN2RCxlQUFlLEVBQUUsTUFBTSxDQUFDLGVBQWUsSUFBSSxNQUFNO1lBQ2pELGVBQWUsRUFBRSxNQUFNLENBQUMsZUFBZSxJQUFJLEVBQUU7WUFDN0MsOEJBQThCLEVBQUUsTUFBTSxDQUFDLDhCQUE4QixJQUFJLENBQUMsWUFBWSxFQUFFLFNBQVMsQ0FBQztTQUNuRyxDQUFDO0lBQ0osQ0FBQztJQUVEOztPQUVHO0lBQ0gscUJBQXFCLENBQUMsS0FBdUI7UUFJM0MsTUFBTSxNQUFNLEdBQVEsRUFBRSxDQUFDO1FBRXZCLG1CQUFtQjtRQUNuQixJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDOUQsT0FBTyxNQUFNLENBQUM7UUFDaEIsQ0FBQztRQUVELDZDQUE2QztRQUM3QyxJQUFJLEtBQUssQ0FBQyxNQUFNLEtBQUssV0FBVyxJQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMsVUFBVSxLQUFLLFNBQVMsRUFBRSxD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LE9BQU8sSUFBSSxvQkFBb0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUMxQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBXb3JrZmxvdyBFdmVudCBBZGFwdGVyXG4gKiBQaGFzZSAyQi0yIC0gV29ya2Zsb3cg5LqL5Lu26YCC6YWN5ZmoXG4gKiBcbiAqIOiBjOi0o++8mlxuICogLSDlsIYgV29ya2Zsb3cgUnVuIOS6i+S7tui9rOaNouS4uuWGhemDqOagh+WHhuS6i+S7tlxuICogLSB3b3JrZmxvd19ydW4gY29tcGxldGVkKGZhaWx1cmUpIOKGkiBJbmNpZGVudFxuICogLSBkZXBsb3ltZW50IOKGkiBBcHByb3ZhbFxuICovXG5cbmltcG9ydCB0eXBlIHtcbiAgV29ya2Zsb3dSdW5FdmVudCxcbiAgRGVwbG95bWVudEV2ZW50LFxuICBEZXBsb3ltZW50U3RhdHVzRXZlbnQsXG4gIE1hcHBlZFdvcmtmbG93SW5jaWRlbnQsXG4gIE1hcHBlZERlcGxveW1lbnRBcHByb3ZhbCxcbiAgTWFwcGVkQWN0aW9uc0luYm94SXRlbSxcbn0gZnJvbSAnLi9naXRodWJfYWN0aW9uc190eXBlcyc7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOmFjee9rlxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgaW50ZXJmYWNlIFdvcmtmbG93RXZlbnRBZGFwdGVyQ29uZmlnIHtcbiAgYXV0b0NyZWF0ZUluY2lkZW50PzogYm9vbGVhbjtcbiAgYXV0b0NyZWF0ZUFwcHJvdmFsPzogYm9vbGVhbjtcbiAgYXV0b0NyZWF0ZUF0dGVudGlvbj86IGJvb2xlYW47XG4gIGZhaWx1cmVTZXZlcml0eT86ICdsb3cnIHwgJ21lZGl1bScgfCAnaGlnaCcgfCAnY3JpdGljYWwnO1xuICBpZ25vcmVXb3JrZmxvd3M/OiBzdHJpbmdbXTtcbiAgcmVxdWlyZUFwcHJvdmFsRm9yRW52aXJvbm1lbnRzPzogc3RyaW5nW107XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIFdvcmtmbG93IEV2ZW50IEFkYXB0ZXJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGNsYXNzIFdvcmtmbG93RXZlbnRBZGFwdGVyIHtcbiAgcHJpdmF0ZSBjb25maWc6IFJlcXVpcmVkPFdvcmtmbG93RXZlbnRBZGFwdGVyQ29uZmlnPjtcbiAgXG4gIGNvbnN0cnVjdG9yKGNvbmZpZzogV29ya2Zsb3dFdmVudEFkYXB0ZXJDb25maWcgPSB7fSkge1xuICAgIHRoaXMuY29uZmlnID0ge1xuICAgICAgYXV0b0NyZWF0ZUluY2lkZW50OiBjb25maWcuYXV0b0NyZWF0ZUluY2lkZW50ID8/IHRydWUsXG4gICAgICBhdXRvQ3JlYXRlQXBwcm92YWw6IGNvbmZpZy5hdXRvQ3JlYXRlQXBwcm92YWwgPz8gdHJ1ZSxcbiAgICAgIGF1dG9DcmVhdGVBdHRlbnRpb246IGNvbmZpZy5hdXRvQ3JlYXRlQXR0ZW50aW9uID8/IHRydWUsXG4gICAgICBmYWlsdXJlU2V2ZXJpdHk6IGNvbmZpZy5mYWlsdXJlU2V2ZXJpdHkgPz8gJ2hpZ2gnLFxuICAgICAgaWdub3JlV29ya2Zsb3dzOiBjb25maWcuaWdub3JlV29ya2Zsb3dzID8/IFtdLFxuICAgICAgcmVxdWlyZUFwcHJvdmFsRm9yRW52aXJvbm1lbnRzOiBjb25maWcucmVxdWlyZUFwcHJvdmFsRm9yRW52aXJvbm1lbnRzID8/IFsncHJvZHVjdGlvbicsICdzdGFnaW5nJ10sXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOmAgumFjSBXb3JrZmxvdyBSdW4g5LqL5Lu2XG4gICAqL1xuICBhZGFwdFdvcmtmbG93UnVuRXZlbnQoZXZlbnQ6IFdvcmtmbG93UnVuRXZlbnQpOiB7XG4gICAgaW5jaWRlbnQ/OiBNYXBwZWRXb3JrZmxvd0luY2lkZW50O1xuICAgIGluYm94SXRlbT86IE1hcHBlZEFjdGlvbnNJbmJveEl0ZW07XG4gIH0ge1xuICAgIGNvbnN0IHJlc3VsdDogYW55ID0ge307XG4gICAgXG4gICAgLy8g5qOA5p+l5piv5ZCm5b+955Wl6K+lIFdvcmtmbG93XG4gICAgaWYgKHRoaXMuY29uZmlnLmlnbm9yZVdvcmtmbG93cy5pbmNsdWRlcyhldmVudC53b3JrZmxvdy5uYW1lKSkge1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG4gICAgXG4gICAgLy8gd29ya2Zsb3dfcnVuIGNvbXBsZXRlZChmYWlsdXJlKSDihpIgSW5jaWRlbnRcbiAgICBpZiAoZXZlbnQuYWN0aW9uID09PSAnY29tcGxldGVkJyAmJiBldmVudC53b3JrZmxvdy5jb25jbHVzaW9uID09PSAnZmFpbHVyZScpIHtcbiAgICAgIGlmICh0aGlzLmNvbmZpZy5hdXRvQ3JlYXRlSW5jaWRlbnQpIHtcbiAgICAgICAgcmVzdWx0LmluY2lkZW50ID0gdGhpcy5tYXBGYWlsZWRXb3JrZmxvd1RvSW5jaWRlbnQoZXZlbnQpO1xuICAgICAgfVxuICAgICAgXG4gICAgICBpZiAodGhpcy5jb25maWcuYXV0b0NyZWF0ZUF0dGVudGlvbikge1xuICAgICAgICByZXN1bHQuaW5ib3hJdGVtID0gdGhpcy5tYXBGYWlsZWRXb3JrZmxvd1RvSW5ib3hJdGVtKGV2ZW50KTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOmAgumFjSBEZXBsb3ltZW50IOS6i+S7tlxuICAgKi9cbiAgYWRhcHREZXBsb3ltZW50RXZlbnQoZXZlbnQ6IERlcGxveW1lbnRFdmVudCk6IHtcbiAgICBhcHByb3ZhbD86IE1hcHBlZERlcGxveW1lbnRBcHByb3ZhbDtcbiAgICBpbmJveEl0ZW0/OiBNYXBwZWRBY3Rpb25zSW5ib3hJdGVtO1xuICB9IHtcbiAgICBjb25zdCByZXN1bHQ6IGFueSA9IHt9O1xuICAgIFxuICAgIC8vIOajgOafpeeOr+Wig+aYr+WQpumcgOimgeWuoeaJuVxuICAgIGNvbnN0IG5lZWRzQXBwcm92YWwgPSB0aGlzLmNvbmZpZy5yZXF1aXJlQXBwcm92YWxGb3JFbnZpcm9ubWVudHMuaW5jbHVkZXMoXG4gICAgICBldmVudC5kZXBsb3ltZW50LmVudmlyb25tZW50XG4gICAgKTtcbiAgICBcbiAgICBpZiAobmVlZHNBcHByb3ZhbCAmJiB0aGlzLmNvbmZpZy5hdXRvQ3JlYXRlQXBwcm92YWwpIHtcbiAgICAgIHJlc3VsdC5hcHByb3ZhbCA9IHRoaXMubWFwRGVwbG95bWVudFRvQXBwcm92YWwoZXZlbnQpO1xuICAgIH1cbiAgICBcbiAgICAvLyDmiYDmnIkgRGVwbG95bWVudCDpg73liJvlu7ogSW5ib3ggSXRlbVxuICAgIHJlc3VsdC5pbmJveEl0ZW0gPSB0aGlzLm1hcERlcGxveW1lbnRUb0luYm94SXRlbShldmVudCk7XG4gICAgXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOmAgumFjSBEZXBsb3ltZW50IFN0YXR1cyDkuovku7ZcbiAgICovXG4gIGFkYXB0RGVwbG95bWVudFN0YXR1c0V2ZW50KGV2ZW50OiBEZXBsb3ltZW50U3RhdHVzRXZlbnQpOiB7XG4gICAgaW5ib3hJdGVtPzogTWFwcGVkQWN0aW9uc0luYm94SXRlbTtcbiAgfSB7XG4gICAgY29uc3QgcmVzdWx0OiBhbnkgPSB7fTtcbiAgICBcbiAgICAvLyBkZXBsb3ltZW50X3N0YXR1cyhmYWlsdXJlKSDihpIgQXR0ZW50aW9uXG4gICAgaWYgKGV2ZW50LmRlcGxveW1lbnRTdGF0dXMuc3RhdGUgPT09ICdmYWlsdXJlJyAmJiB0aGlzLmNvbmZpZy5hdXRvQ3JlYXRlQXR0ZW50aW9uKSB7XG4gICAgICByZXN1bHQuaW5ib3hJdGVtID0gdGhpcy5tYXBGYWlsZWREZXBsb3ltZW50VG9JbmJveEl0ZW0oZXZlbnQpO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIFxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIC8vIOaYoOWwhOaWueazlVxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIFxuICBwcml2YXRlIG1hcEZhaWxlZFdvcmtmbG93VG9JbmNpZGVudChldmVudDogV29ya2Zsb3dSdW5FdmVudCk6IE1hcHBlZFdvcmtmbG93SW5jaWRlbnQge1xuICAgIHJldHVybiB7XG4gICAgICBpbmNpZGVudElkOiBgZ2l0aHViX2FjdGlvbnNfd29ya2Zsb3dfJHtldmVudC53b3JrZmxvdy5ydW5JZH1gLFxuICAgICAgdHlwZTogJ3dvcmtmbG93X2ZhaWx1cmUnLFxuICAgICAgc2V2ZXJpdHk6IHRoaXMuY29uZmlnLmZhaWx1cmVTZXZlcml0eSxcbiAgICAgIGRlc2NyaXB0aW9uOiBgV29ya2Zsb3cgJHtldmVudC53b3JrZmxvdy5uYW1lfSBmYWlsZWQgb24gJHtldmVudC53b3JrZmxvdy5oZWFkQnJhbmNofWAsXG4gICAgICBtZXRhZGF0YToge1xuICAgICAgICBzb3VyY2U6ICdnaXRodWJfYWN0aW9ucycsXG4gICAgICAgIHdvcmtmbG93TmFtZTogZXZlbnQud29ya2Zsb3cubmFtZSxcbiAgICAgICAgcnVuSWQ6IGV2ZW50LndvcmtmbG93LnJ1bklkLFxuICAgICAgICBjb25jbHVzaW9uOiBldmVudC53b3JrZmxvdy5jb25jbHVzaW9uLFxuICAgICAgfSxcbiAgICB9O1xuICB9XG4gIFxuICBwcml2YXRlIG1hcEZhaWxlZFdvcmtmbG93VG9JbmJveEl0ZW0oZXZlbnQ6IFdvcmtmbG93UnVuRXZlbnQpOiBNYXBwZWRBY3Rpb25zSW5ib3hJdGVtIHtcbiAgICByZXR1cm4ge1xuICAgICAgaXRlbVR5cGU6ICdpbmNpZGVudCcsXG4gICAgICBzb3VyY2VJZDogYCR7ZXZlbnQucmVwb3NpdG9yeS5mdWxsTmFtZX0vYWN0aW9ucy9ydW5zLyR7ZXZlbnQud29ya2Zsb3cucnVuSWR9YCxcbiAgICAgIHRpdGxlOiBgV29ya2Zsb3cgRmFpbGVkOiAke2V2ZW50LndvcmtmbG93Lm5hbWV9YCxcbiAgICAgIHN1bW1hcnk6IGBSdW4gIyR7ZXZlbnQud29ya2Zsb3cucnVuTnVtYmVyfSBmYWlsZWQgb24gJHtldmVudC53b3JrZmxvdy5oZWFkQnJhbmNofWAsXG4gICAgICBzZXZlcml0eTogdGhpcy5jb25maWcuZmFpbHVyZVNldmVyaXR5LFxuICAgICAgc3VnZ2VzdGVkQWN0aW9uczogWydyZXJ1bl93b3JrZmxvdycsICdvcGVuJ10sXG4gICAgICBtZXRhZGF0YToge1xuICAgICAgICBzb3VyY2U6ICdnaXRodWJfYWN0aW9ucycsXG4gICAgICAgIHdvcmtmbG93TmFtZTogZXZlbnQud29ya2Zsb3cubmFtZSxcbiAgICAgICAgcnVuSWQ6IGV2ZW50LndvcmtmbG93LnJ1bklkLFxuICAgICAgICBicmFuY2g6IGV2ZW50LndvcmtmbG93LmhlYWRCcmFuY2gsXG4gICAgICB9LFxuICAgIH07XG4gIH1cbiAgXG4gIHByaXZhdGUgbWFwRGVwbG95bWVudFRvQXBwcm92YWwoZXZlbnQ6IERlcGxveW1lbnRFdmVudCk6IE1hcHBlZERlcGxveW1lbnRBcHByb3ZhbCB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGFwcHJvdmFsSWQ6IGBnaXRodWJfZGVwbG95bWVudF8ke2V2ZW50LmRlcGxveW1lbnQuaWR9YCxcbiAgICAgIHNjb3BlOiBgRGVwbG95IHRvICR7ZXZlbnQuZGVwbG95bWVudC5lbnZpcm9ubWVudH1gLFxuICAgICAgcmVhc29uOiBgRGVwbG95bWVudCByZXF1ZXN0ZWQgYnkgJHtldmVudC5kZXBsb3ltZW50LmNyZWF0b3IubG9naW59OiAke2V2ZW50LmRlcGxveW1lbnQuZGVzY3JpcHRpb24gfHwgJyd9YCxcbiAgICAgIHJlcXVlc3RpbmdBZ2VudDogZXZlbnQuZGVwbG95bWVudC5jcmVhdG9yLmxvZ2luLFxuICAgICAgbWV0YWRhdGE6IHtcbiAgICAgICAgc291cmNlOiAnZ2l0aHViX2FjdGlvbnMnLFxuICAgICAgICBzb3VyY2VUeXBlOiAnZGVwbG95bWVudF9hcHByb3ZhbCcsXG4gICAgICAgIGRlcGxveW1lbnRJZDogZXZlbnQuZGVwbG95bWVudC5pZCxcbiAgICAgICAgZW52aXJvbm1lbnQ6IGV2ZW50LmRlcGxveW1lbnQuZW52aXJvbm1lbnQsXG4gICAgICAgIHJlZjogZXZlbnQuZGVwbG95bWVudC5yZWYsXG4gICAgICB9LFxuICAgIH07XG4gIH1cbiAgXG4gIHByaXZhdGUgbWFwRGVwbG95bWVudFRvSW5ib3hJdGVtKGV2ZW50OiBEZXBsb3ltZW50RXZlbnQpOiBNYXBwZWRBY3Rpb25zSW5ib3hJdGVtIHtcbiAgICByZXR1cm4ge1xuICAgICAgaXRlbVR5cGU6ICdhcHByb3ZhbCcsXG4gICAgICBzb3VyY2VJZDogYCR7ZXZlbnQucmVwb3NpdG9yeS5mdWxsTmFtZX0vZGVwbG95bWVudHMvJHtldmVudC5kZXBsb3ltZW50LmlkfWAsXG4gICAgICB0aXRsZTogYERlcGxveW1lbnQ6ICR7ZXZlbnQuZGVwbG95bWVudC5lbnZpcm9ubWVudH1gLFxuICAgICAgc3VtbWFyeTogYERlcGxveSAke2V2ZW50LmRlcGxveW1lbnQucmVmfSB0byAke2V2ZW50LmRlcGxveW1lbnQuZW52aXJvbm1lbnR9YCxcbiAgICAgIHNldmVyaXR5OiAnaGlnaCcsXG4gICAgICBzdWdnZXN0ZWRBY3Rpb25zOiBbJ2FwcHJvdmUnLCAncmVqZWN0J10sXG4gICAgICBtZXRhZGF0YToge1xuICAgICAgICBzb3VyY2U6ICdnaXRodWJfYWN0aW9ucycsXG4gICAgICAgIGRlcGxveW1lbnRJZDogZXZlbnQuZGVwbG95bWVudC5pZCxcbiAgICAgICAgZW52aXJvbm1lbnQ6IGV2ZW50LmRlcGxveW1lbnQuZW52aXJvbm1lbnQsXG4gICAgICAgIHJlZjogZXZlbnQuZGVwbG95bWVudC5yZWYsXG4gICAgICB9LFxuICAgIH07XG4gIH1cbiAgXG4gIHByaXZhdGUgbWFwRmFpbGVkRGVwbG95bWVudFRvSW5ib3hJdGVtKGV2ZW50OiBEZXBsb3ltZW50U3RhdHVzRXZlbnQpOiBNYXBwZWRBY3Rpb25zSW5ib3hJdGVtIHtcbiAgICByZXR1cm4ge1xuICAgICAgaXRlbVR5cGU6ICdpbmNpZGVudCcsXG4gICAgICBzb3VyY2VJZDogYCR7ZXZlbnQucmVwb3NpdG9yeS5mdWxsTmFtZX0vZGVwbG95bWVudHMvJHtldmVudC5kZXBsb3ltZW50LmlkfWAsXG4gICAgICB0aXRsZTogYERlcGxveW1lbnQgRmFpbGVkOiAke2V2ZW50LmRlcGxveW1lbnQuZW52aXJvbm1lbnR9YCxcbiAgICAgIHN1bW1hcnk6IGBEZXBsb3ltZW50IHRvICR7ZXZlbnQuZGVwbG95bWVudC5lbnZpcm9ubWVudH0gZmFpbGVkYCxcbiAgICAgIHNldmVyaXR5OiAnY3JpdGljYWwnLFxuICAgICAgc3VnZ2VzdGVkQWN0aW9uczogWydvcGVuJywgJ3JldHJ5J10sXG4gICAgICBtZXRhZGF0YToge1xuICAgICAgICBzb3VyY2U6ICdnaXRodWJfYWN0aW9ucycsXG4gICAgICAgIGRlcGxveW1lbnRJZDogZXZlbnQuZGVwbG95bWVudC5pZCxcbiAgICAgICAgZW52aXJvbm1lbnQ6IGV2ZW50LmRlcGxveW1lbnQuZW52aXJvbm1lbnQsXG4gICAgICAgIHN0YXRlOiBldmVudC5kZXBsb3ltZW50U3RhdHVzLnN0YXRlLFxuICAgICAgfSxcbiAgICB9O1xuICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOW3peWOguWHveaVsFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlV29ya2Zsb3dFdmVudEFkYXB0ZXIoY29uZmlnPzogV29ya2Zsb3dFdmVudEFkYXB0ZXJDb25maWcpOiBXb3JrZmxvd0V2ZW50QWRhcHRlciB7XG4gIHJldHVybiBuZXcgV29ya2Zsb3dFdmVudEFkYXB0ZXIoY29uZmlnKTtcbn1cbiJdfQ==