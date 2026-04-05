"use strict";
/**
 * CircleCI Event Adapter
 * Phase 2B-3B - CircleCI 事件适配器
 *
 * 职责：
 * - 将 CircleCI 事件转换为内部标准事件
 * - workflow_failed → Incident
 * - approval_pending → Approval
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircleCIEventAdapter = void 0;
exports.createCircleCIEventAdapter = createCircleCIEventAdapter;
// ============================================================================
// CircleCI Event Adapter
// ============================================================================
class CircleCIEventAdapter {
    constructor(config = {}) {
        this.config = {
            autoCreateIncident: config.autoCreateIncident ?? true,
            autoCreateApproval: config.autoCreateApproval ?? true,
            autoCreateAttention: config.autoCreateAttention ?? true,
            failureSeverity: config.failureSeverity ?? 'high',
            ignoreProjects: config.ignoreProjects ?? [],
            requireApprovalForWorkflows: config.requireApprovalForWorkflows ?? [],
        };
    }
    /**
     * 适配 CircleCI 事件
     */
    adaptEvent(event) {
        const result = {};
        // 检查是否忽略该项目
        if (this.config.ignoreProjects.includes(event.project.slug)) {
            return result;
        }
        // 根据事件类型适配
        switch (event.type) {
            case 'workflow_failed':
            case 'job_failed':
                Object.assign(result, this.adaptFailedEvent(event));
                break;
            case 'approval_pending':
            case 'job_on_hold':
                Object.assign(result, this.adaptApprovalEvent(event));
                break;
            case 'workflow_on_hold':
                Object.assign(result, this.adaptOnHoldEvent(event));
                break;
            default:
                // 其他事件不处理
                break;
        }
        return result;
    }
    // ============================================================================
    // 内部方法
    // ============================================================================
    /**
     * 适配失败事件 → Incident
     */
    adaptFailedEvent(event) {
        const result = {};
        if (this.config.autoCreateIncident) {
            result.incident = this.mapFailedEventToIncident(event);
        }
        if (this.config.autoCreateAttention) {
            result.inboxItem = this.mapFailedEventToInboxItem(event);
        }
        return result;
    }
    /**
     * 适配审批事件 → Approval
     */
    adaptApprovalEvent(event) {
        const result = {};
        if (this.config.autoCreateApproval) {
            result.approval = this.mapApprovalEventToApproval(event);
        }
        // 所有审批事件都创建 Inbox Item
        result.inboxItem = this.mapApprovalEventToInboxItem(event);
        return result;
    }
    /**
     * 适配等待事件 → Attention
     */
    adaptOnHoldEvent(event) {
        const result = {};
        if (this.config.autoCreateAttention) {
            result.inboxItem = this.mapOnHoldEventToInboxItem(event);
        }
        return result;
    }
    // ============================================================================
    // 映射方法
    // ============================================================================
    /**
     * 映射失败事件到 Incident
     */
    mapFailedEventToIncident(event) {
        const sourceId = `circleci_workflow:${event.workflow.id}`;
        return {
            incidentId: `circleci_${event.workflow.id}`,
            type: event.type === 'job_failed' ? 'job_failure' : 'workflow_failure',
            severity: this.config.failureSeverity,
            description: `Workflow ${event.workflow.name} failed for ${event.project.slug}`,
            metadata: {
                source: 'circleci',
                sourceId,
                pipelineId: event.pipeline.id,
                workflowId: event.workflow.id,
                jobId: event.job?.id,
                projectSlug: event.project.slug,
                url: event.pipeline.url,
            },
        };
    }
    /**
     * 映射失败事件到 Inbox Item
     */
    mapFailedEventToInboxItem(event) {
        const sourceId = `circleci_workflow:${event.workflow.id}`;
        return {
            itemType: 'incident',
            sourceId,
            title: `Workflow Failed: ${event.project.slug}`,
            summary: `Workflow ${event.workflow.name} failed`,
            severity: this.config.failureSeverity,
            suggestedActions: ['rerun', 'open', 'ack_incident'],
            metadata: {
                source: 'circleci',
                projectSlug: event.project.slug,
                workflowId: event.workflow.id,
                pipelineId: event.pipeline.id,
                eventType: event.type,
            },
        };
    }
    /**
     * 映射审批事件到 Approval
     */
    mapApprovalEventToApproval(event) {
        const approvalId = event.approval?.id || event.job?.id || 'unknown';
        const sourceId = `circleci_approval:${approvalId}`;
        return {
            approvalId: sourceId,
            scope: event.approval?.name || event.job?.name || `Approve ${event.workflow.name}`,
            reason: `Approval required for ${event.project.slug} workflow ${event.workflow.name}`,
            requestingAgent: event.actor.login || 'circleci',
            metadata: {
                source: 'circleci',
                sourceType: 'approval_job',
                sourceId,
                pipelineId: event.pipeline.id,
                workflowId: event.workflow.id,
                approvalId,
                url: `https://circleci.com/workflow-run/${event.workflow.id}`,
            },
        };
    }
    /**
     * 映射审批事件到 Inbox Item
     */
    mapApprovalEventToInboxItem(event) {
        const approvalId = event.approval?.id || event.job?.id || 'unknown';
        const sourceId = `circleci_approval:${approvalId}`;
        return {
            itemType: 'approval',
            sourceId,
            title: `Approval Required: ${event.project.slug}`,
            summary: event.approval?.name || event.job?.name || `Workflow ${event.workflow.name} requires approval`,
            severity: 'high',
            suggestedActions: ['approve', 'reject'],
            metadata: {
                source: 'circleci',
                projectSlug: event.project.slug,
                workflowId: event.workflow.id,
                approvalId,
            },
        };
    }
    /**
     * 映射等待事件到 Inbox Item
     */
    mapOnHoldEventToInboxItem(event) {
        const sourceId = `circleci_workflow:${event.workflow.id}`;
        return {
            itemType: 'attention',
            sourceId,
            title: `Workflow On Hold: ${event.project.slug}`,
            summary: `Workflow ${event.workflow.name} is on hold`,
            severity: 'medium',
            suggestedActions: ['continue', 'open'],
            metadata: {
                source: 'circleci',
                projectSlug: event.project.slug,
                workflowId: event.workflow.id,
                eventType: 'workflow_on_hold',
            },
        };
    }
}
exports.CircleCIEventAdapter = CircleCIEventAdapter;
// ============================================================================
// 工厂函数
// ============================================================================
function createCircleCIEventAdapter(config) {
    return new CircleCIEventAdapter(config);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2lyY2xlY2lfZXZlbnRfYWRhcHRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jb25uZWN0b3JzL2NpcmNsZWNpL2NpcmNsZWNpX2V2ZW50X2FkYXB0ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7OztHQVFHOzs7QUFxUUgsZ0VBRUM7QUFqUEQsK0VBQStFO0FBQy9FLHlCQUF5QjtBQUN6QiwrRUFBK0U7QUFFL0UsTUFBYSxvQkFBb0I7SUFHL0IsWUFBWSxTQUFxQyxFQUFFO1FBQ2pELElBQUksQ0FBQyxNQUFNLEdBQUc7WUFDWixrQkFBa0IsRUFBRSxNQUFNLENBQUMsa0JBQWtCLElBQUksSUFBSTtZQUNyRCxrQkFBa0IsRUFBRSxNQUFNLENBQUMsa0JBQWtCLElBQUksSUFBSTtZQUNyRCxtQkFBbUIsRUFBRSxNQUFNLENBQUMsbUJBQW1CLElBQUksSUFBSTtZQUN2RCxlQUFlLEVBQUUsTUFBTSxDQUFDLGVBQWUsSUFBSSxNQUFNO1lBQ2pELGNBQWMsRUFBRSxNQUFNLENBQUMsY0FBYyxJQUFJLEVBQUU7WUFDM0MsMkJBQTJCLEVBQUUsTUFBTSxDQUFDLDJCQUEyQixJQUFJLEVBQUU7U0FDdEUsQ0FBQztJQUNKLENBQUM7SUFFRDs7T0FFRztJQUNILFVBQVUsQ0FBQyxLQUFvQjtRQUs3QixNQUFNLE1BQU0sR0FBUSxFQUFFLENBQUM7UUFFdkIsWUFBWTtRQUNaLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztZQUM1RCxPQUFPLE1BQU0sQ0FBQztRQUNoQixDQUFDO1FBRUQsV0FBVztRQUNYLFFBQVEsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ25CLEtBQUssaUJBQWlCLENBQUM7WUFDdkIsS0FBSyxZQUFZO2dCQUNmLE1BQU0sQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLElBQUks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QUFRLENBQUM7WUFDdkMsUUFBUSxFQUFFO2dCQUNSLE1BQU0sRUFBRSxVQUFVO2dCQUNsQixXQUFXLEVBQUUsS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJO2dCQUMvQixVQUFVLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxFQUFFO2dCQUM3QixVQUFVO2FBQ1g7U0FDRixDQUFDO0lBQ0osQ0FBQztJQUVEOztPQUVHO0lBQ0sseUJBQXlCLENBQUMsS0FBb0I7UUFDcEQsTUFBTSxRQUFRLEdBQUcscUJBQXFCLEtBQUssQ0FBQyxRQUFRLENBQUMsRUFBRSxFQUFFLENBQUM7UUFFMUQsT0FBTztZQUNMLFFBQVEsRUFBRSxXQUFXO1lBQ3JCLFFBQVE7WUFDUixLQUFLLEVBQUUscUJBQXFCLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFO1lBQ2hELE9BQU8sRUFBRSxZQUFZLEtBQUssQ0FBQyxRQUFRLENBQUMsSUFBSSxhQUFhO1lBQ3JELFFBQVEsRUFBRSxRQUFRO1lBQ2xCLGdCQUFnQixFQUFFLENBQUMsVUFBVSxFQUFFLE1BQU0sQ0FBQztZQUN0QyxRQUFRLEVBQUU7Z0JBQ1IsTUFBTSxFQUFFLFVBQVU7Z0JBQ2xCLFdBQVcsRUFBRSxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUk7Z0JBQy9CLFVBQVUsRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLEVBQUU7Z0JBQzdCLFNBQVMsRUFBRSxrQkFBa0I7YUFDOUI7U0FDRixDQUFDO0lBQ0osQ0FBQztDQUNGO0FBck9ELG9EQXFPQztBQUVELCtFQUErRTtBQUMvRSxPQUFPO0FBQ1AsK0VBQStFO0FBRS9FLFNBQWdCLDBCQUEwQixDQUFDLE1BQW1DO0lBQzVFLE9BQU8sSUFBSSxvQkFBb0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUMxQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDaXJjbGVDSSBFdmVudCBBZGFwdGVyXG4gKiBQaGFzZSAyQi0zQiAtIENpcmNsZUNJIOS6i+S7tumAgumFjeWZqFxuICogXG4gKiDogYzotKPvvJpcbiAqIC0g5bCGIENpcmNsZUNJIOS6i+S7tui9rOaNouS4uuWGhemDqOagh+WHhuS6i+S7tlxuICogLSB3b3JrZmxvd19mYWlsZWQg4oaSIEluY2lkZW50XG4gKiAtIGFwcHJvdmFsX3BlbmRpbmcg4oaSIEFwcHJvdmFsXG4gKi9cblxuaW1wb3J0IHR5cGUge1xuICBDaXJjbGVDSUV2ZW50LFxuICBNYXBwZWRDaXJjbGVDSUluY2lkZW50LFxuICBNYXBwZWRDaXJjbGVDSUFwcHJvdmFsLFxuICBNYXBwZWRDaXJjbGVDSUluYm94SXRlbSxcbn0gZnJvbSAnLi9jaXJjbGVjaV90eXBlcyc7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOmFjee9rlxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgaW50ZXJmYWNlIENpcmNsZUNJRXZlbnRBZGFwdGVyQ29uZmlnIHtcbiAgYXV0b0NyZWF0ZUluY2lkZW50PzogYm9vbGVhbjtcbiAgYXV0b0NyZWF0ZUFwcHJvdmFsPzogYm9vbGVhbjtcbiAgYXV0b0NyZWF0ZUF0dGVudGlvbj86IGJvb2xlYW47XG4gIGZhaWx1cmVTZXZlcml0eT86ICdsb3cnIHwgJ21lZGl1bScgfCAnaGlnaCcgfCAnY3JpdGljYWwnO1xuICBpZ25vcmVQcm9qZWN0cz86IHN0cmluZ1tdO1xuICByZXF1aXJlQXBwcm92YWxGb3JXb3JrZmxvd3M/OiBzdHJpbmdbXTtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gQ2lyY2xlQ0kgRXZlbnQgQWRhcHRlclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgY2xhc3MgQ2lyY2xlQ0lFdmVudEFkYXB0ZXIge1xuICBwcml2YXRlIGNvbmZpZzogUmVxdWlyZWQ8Q2lyY2xlQ0lFdmVudEFkYXB0ZXJDb25maWc+O1xuXG4gIGNvbnN0cnVjdG9yKGNvbmZpZzogQ2lyY2xlQ0lFdmVudEFkYXB0ZXJDb25maWcgPSB7fSkge1xuICAgIHRoaXMuY29uZmlnID0ge1xuICAgICAgYXV0b0NyZWF0ZUluY2lkZW50OiBjb25maWcuYXV0b0NyZWF0ZUluY2lkZW50ID8/IHRydWUsXG4gICAgICBhdXRvQ3JlYXRlQXBwcm92YWw6IGNvbmZpZy5hdXRvQ3JlYXRlQXBwcm92YWwgPz8gdHJ1ZSxcbiAgICAgIGF1dG9DcmVhdGVBdHRlbnRpb246IGNvbmZpZy5hdXRvQ3JlYXRlQXR0ZW50aW9uID8/IHRydWUsXG4gICAgICBmYWlsdXJlU2V2ZXJpdHk6IGNvbmZpZy5mYWlsdXJlU2V2ZXJpdHkgPz8gJ2hpZ2gnLFxuICAgICAgaWdub3JlUHJvamVjdHM6IGNvbmZpZy5pZ25vcmVQcm9qZWN0cyA/PyBbXSxcbiAgICAgIHJlcXVpcmVBcHByb3ZhbEZvcldvcmtmbG93czogY29uZmlnLnJlcXVpcmVBcHByb3ZhbEZvcldvcmtmbG93cyA/PyBbXSxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOmAgumFjSBDaXJjbGVDSSDkuovku7ZcbiAgICovXG4gIGFkYXB0RXZlbnQoZXZlbnQ6IENpcmNsZUNJRXZlbnQpOiB7XG4gICAgaW5jaWRlbnQ/OiBNYXBwZWRDaXJjbGVDSUluY2lkZW50O1xuICAgIGFwcHJvdmFsPzogTWFwcGVkQ2lyY2xlQ0lBcHByb3ZhbDtcbiAgICBpbmJveEl0ZW0/OiBNYXBwZWRDaXJjbGVDSUluYm94SXRlbTtcbiAgfSB7XG4gICAgY29uc3QgcmVzdWx0OiBhbnkgPSB7fTtcblxuICAgIC8vIOajgOafpeaYr+WQpuW/veeVpeivpemhueebrlxuICAgIGlmICh0aGlzLmNvbmZpZy5pZ25vcmVQcm9qZWN0cy5pbmNsdWRlcyhldmVudC5wcm9qZWN0LnNsdWcpKSB7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIC8vIOagueaNruS6i+S7tuexu+Wei+mAgumFjVxuICAgIHN3aXRjaCAoZXZlbnQudHlwZSkge1xuICAgICAgY2FzZSAnd29ya2Zsb3dfZmFpbGVkJzpcbiAgICAgIGNhc2UgJ2pvYl9mYWlsZWQnOlxuICAgICAgICBPYmplY3QuYXNzaWduKHJlc3VsdCwgdGhpcy5hZGFwdEZhaWxlZEV2ZW50KGV2ZW50KSk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlICdhcHByb3ZhbF9wZW5kaW5nJzpcbiAgICAgIGNhc2UgJ2pvYl9vbl9ob2xkJzpcbiAgICAgICAgT2JqZWN0LmFzc2lnbihyZXN1bHQsIHRoaXMuYWRhcHRBcHByb3ZhbEV2ZW50KGV2ZW50KSk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlICd3b3JrZmxvd19vbl9ob2xkJzpcbiAgICAgICAgT2JqZWN0LmFzc2lnbihyZXN1bHQsIHRoaXMuYWRhcHRPbkhvbGRFdmVudChldmVudCkpO1xuICAgICAgICBicmVhaztcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgLy8g5YW25LuW5LqL5Lu25LiN5aSE55CGXG4gICAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIC8vIOWGhemDqOaWueazlVxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgLyoqXG4gICAqIOmAgumFjeWksei0peS6i+S7tiDihpIgSW5jaWRlbnRcbiAgICovXG4gIHByaXZhdGUgYWRhcHRGYWlsZWRFdmVudChldmVudDogQ2lyY2xlQ0lFdmVudCk6IHtcbiAgICBpbmNpZGVudD86IE1hcHBlZENpcmNsZUNJSW5jaWRlbnQ7XG4gICAgaW5ib3hJdGVtPzogTWFwcGVkQ2lyY2xlQ0lJbmJveEl0ZW07XG4gIH0ge1xuICAgIGNvbnN0IHJlc3VsdDogYW55ID0ge307XG5cbiAgICBpZiAodGhpcy5jb25maWcuYXV0b0NyZWF0ZUluY2lkZW50KSB7XG4gICAgICByZXN1bHQuaW5jaWRlbnQgPSB0aGlzLm1hcEZhaWxlZEV2ZW50VG9JbmNpZGVudChldmVudCk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuY29uZmlnLmF1dG9DcmVhdGVBdHRlbnRpb24pIHtcbiAgICAgIHJlc3VsdC5pbmJveEl0ZW0gPSB0aGlzLm1hcEZhaWxlZEV2ZW50VG9JbmJveEl0ZW0oZXZlbnQpO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICog6YCC6YWN5a6h5om55LqL5Lu2IOKGkiBBcHByb3ZhbFxuICAgKi9cbiAgcHJpdmF0ZSBhZGFwdEFwcHJvdmFsRXZlbnQoZXZlbnQ6IENpcmNsZUNJRXZlbnQpOiB7XG4gICAgYXBwcm92YWw/OiBNYXBwZWRDaXJjbGVDSUFwcHJvdmFsO1xuICAgIGluYm94SXRlbT86IE1hcHBlZENpcmNsZUNJSW5ib3hJdGVtO1xuICB9IHtcbiAgICBjb25zdCByZXN1bHQ6IGFueSA9IHt9O1xuXG4gICAgaWYgKHRoaXMuY29uZmlnLmF1dG9DcmVhdGVBcHByb3ZhbCkge1xuICAgICAgcmVzdWx0LmFwcHJvdmFsID0gdGhpcy5tYXBBcHByb3ZhbEV2ZW50VG9BcHByb3ZhbChldmVudCk7XG4gICAgfVxuXG4gICAgLy8g5omA5pyJ5a6h5om55LqL5Lu26YO95Yib5bu6IEluYm94IEl0ZW1cbiAgICByZXN1bHQuaW5ib3hJdGVtID0gdGhpcy5tYXBBcHByb3ZhbEV2ZW50VG9JbmJveEl0ZW0oZXZlbnQpO1xuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiDpgILphY3nrYnlvoXkuovku7Yg4oaSIEF0dGVudGlvblxuICAgKi9cbiAgcHJpdmF0ZSBhZGFwdE9uSG9sZEV2ZW50KGV2ZW50OiBDaXJjbGVDSUV2ZW50KToge1xuICAgIGluYm94SXRlbT86IE1hcHBlZENpcmNsZUNJSW5ib3hJdGVtO1xuICB9IHtcbiAgICBjb25zdCByZXN1bHQ6IGFueSA9IHt9O1xuXG4gICAgaWYgKHRoaXMuY29uZmlnLmF1dG9DcmVhdGVBdHRlbnRpb24pIHtcbiAgICAgIHJlc3VsdC5pbmJveEl0ZW0gPSB0aGlzLm1hcE9uSG9sZEV2ZW50VG9JbmJveEl0ZW0oZXZlbnQpO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIC8vIOaYoOWwhOaWueazlVxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgLyoqXG4gICAqIOaYoOWwhOWksei0peS6i+S7tuWIsCBJbmNpZGVudFxuICAgKi9cbiAgcHJpdmF0ZSBtYXBGYWlsZWRFdmVudFRvSW5jaWRlbnQoZXZlbnQ6IENpcmNsZUNJRXZlbnQpOiBNYXBwZWRDaXJjbGVDSUluY2lkZW50IHtcbiAgICBjb25zdCBzb3VyY2VJZCA9IGBjaXJjbGVjaV93b3JrZmxvdzoke2V2ZW50LndvcmtmbG93LmlkfWA7XG5cbiAgICByZXR1cm4ge1xuICAgICAgaW5jaWRlbnRJZDogYGNpcmNsZWNpXyR7ZXZlbnQud29ya2Zsb3cuaWR9YCxcbiAgICAgIHR5cGU6IGV2ZW50LnR5cGUgPT09ICdqb2JfZmFpbGVkJyA/ICdqb2JfZmFpbHVyZScgOiAnd29ya2Zsb3dfZmFpbHVyZScsXG4gICAgICBzZXZlcml0eTogdGhpcy5jb25maWcuZmFpbHVyZVNldmVyaXR5LFxuICAgICAgZGVzY3JpcHRpb246IGBXb3JrZmxvdyAke2V2ZW50LndvcmtmbG93Lm5hbWV9IGZhaWxlZCBmb3IgJHtldmVudC5wcm9qZWN0LnNsdWd9YCxcbiAgICAgIG1ldGFkYXRhOiB7XG4gICAgICAgIHNvdXJjZTogJ2NpcmNsZWNpJyxcbiAgICAgICAgc291cmNlSWQsXG4gICAgICAgIHBpcGVsaW5lSWQ6IGV2ZW50LnBpcGVsaW5lLmlkLFxuICAgICAgICB3b3JrZmxvd0lkOiBldmVudC53b3JrZmxvdy5pZCxcbiAgICAgICAgam9iSWQ6IGV2ZW50LmpvYj8uaWQsXG4gICAgICAgIHByb2plY3RTbHVnOiBldmVudC5wcm9qZWN0LnNsdWcsXG4gICAgICAgIHVybDogZXZlbnQucGlwZWxpbmUudXJsLFxuICAgICAgfSxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOaYoOWwhOWksei0peS6i+S7tuWIsCBJbmJveCBJdGVtXG4gICAqL1xuICBwcml2YXRlIG1hcEZhaWxlZEV2ZW50VG9JbmJveEl0ZW0oZXZlbnQ6IENpcmNsZUNJRXZlbnQpOiBNYXBwZWRDaXJjbGVDSUluYm94SXRlbSB7XG4gICAgY29uc3Qgc291cmNlSWQgPSBgY2lyY2xlY2lfd29ya2Zsb3c6JHtldmVudC53b3JrZmxvdy5pZH1gO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGl0ZW1UeXBlOiAnaW5jaWRlbnQnLFxuICAgICAgc291cmNlSWQsXG4gICAgICB0aXRsZTogYFdvcmtmbG93IEZhaWxlZDogJHtldmVudC5wcm9qZWN0LnNsdWd9YCxcbiAgICAgIHN1bW1hcnk6IGBXb3JrZmxvdyAke2V2ZW50LndvcmtmbG93Lm5hbWV9IGZhaWxlZGAsXG4gICAgICBzZXZlcml0eTogdGhpcy5jb25maWcuZmFpbHVyZVNldmVyaXR5LFxuICAgICAgc3VnZ2VzdGVkQWN0aW9uczogWydyZXJ1bicsICdvcGVuJywgJ2Fja19pbmNpZGVudCddLFxuICAgICAgbWV0YWRhdGE6IHtcbiAgICAgICAgc291cmNlOiAnY2lyY2xlY2knLFxuICAgICAgICBwcm9qZWN0U2x1ZzogZXZlbnQucHJvamVjdC5zbHVnLFxuICAgICAgICB3b3JrZmxvd0lkOiBldmVudC53b3JrZmxvdy5pZCxcbiAgICAgICAgcGlwZWxpbmVJZDogZXZlbnQucGlwZWxpbmUuaWQsXG4gICAgICAgIGV2ZW50VHlwZTogZXZlbnQudHlwZSxcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiDmmKDlsITlrqHmibnkuovku7bliLAgQXBwcm92YWxcbiAgICovXG4gIHByaXZhdGUgbWFwQXBwcm92YWxFdmVudFRvQXBwcm92YWwoZXZlbnQ6IENpcmNsZUNJRXZlbnQpOiBNYXBwZWRDaXJjbGVDSUFwcHJvdmFsIHtcbiAgICBjb25zdCBhcHByb3ZhbElkID0gZXZlbnQuYXBwcm92YWw/LmlkIHx8IGV2ZW50LmpvYj8uaWQgfHwgJ3Vua25vd24nO1xuICAgIGNvbnN0IHNvdXJjZUlkID0gYGNpcmNsZWNpX2FwcHJvdmFsOiR7YXBwcm92YWxJZH1gO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGFwcHJvdmFsSWQ6IHNvdXJjZUlkLFxuICAgICAgc2NvcGU6IGV2ZW50LmFwcHJvdmFsPy5uYW1lIHx8IGV2ZW50LmpvYj8ubmFtZSB8fCBgQXBwcm92ZSAke2V2ZW50LndvcmtmbG93Lm5hbWV9YCxcbiAgICAgIHJlYXNvbjogYEFwcHJvdmFsIHJlcXVpcmVkIGZvciAke2V2ZW50LnByb2plY3Quc2x1Z30gd29ya2Zsb3cgJHtldmVudC53b3JrZmxvdy5uYW1lfWAsXG4gICAgICByZXF1ZXN0aW5nQWdlbnQ6IGV2ZW50LmFjdG9yLmxvZ2luIHx8ICdjaXJjbGVjaScsXG4gICAgICBtZXRhZGF0YToge1xuICAgICAgICBzb3VyY2U6ICdjaXJjbGVjaScsXG4gICAgICAgIHNvdXJjZVR5cGU6ICdhcHByb3ZhbF9qb2InLFxuICAgICAgICBzb3VyY2VJZCxcbiAgICAgICAgcGlwZWxpbmVJZDogZXZlbnQucGlwZWxpbmUuaWQsXG4gICAgICAgIHdvcmtmbG93SWQ6IGV2ZW50LndvcmtmbG93LmlkLFxuICAgICAgICBhcHByb3ZhbElkLFxuICAgICAgICB1cmw6IGBodHRwczovL2NpcmNsZWNpLmNvbS93b3JrZmxvdy1ydW4vJHtldmVudC53b3JrZmxvdy5pZH1gLFxuICAgICAgfSxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOaYoOWwhOWuoeaJueS6i+S7tuWIsCBJbmJveCBJdGVtXG4gICAqL1xuICBwcml2YXRlIG1hcEFwcHJvdmFsRXZlbnRUb0luYm94SXRlbShldmVudDogQ2lyY2xlQ0lFdmVudCk6IE1hcHBlZENpcmNsZUNJSW5ib3hJdGVtIHtcbiAgICBjb25zdCBhcHByb3ZhbElkID0gZXZlbnQuYXBwcm92YWw/LmlkIHx8IGV2ZW50LmpvYj8uaWQgfHwgJ3Vua25vd24nO1xuICAgIGNvbnN0IHNvdXJjZUlkID0gYGNpcmNsZWNpX2FwcHJvdmFsOiR7YXBwcm92YWxJZH1gO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGl0ZW1UeXBlOiAnYXBwcm92YWwnLFxuICAgICAgc291cmNlSWQsXG4gICAgICB0aXRsZTogYEFwcHJvdmFsIFJlcXVpcmVkOiAke2V2ZW50LnByb2plY3Quc2x1Z31gLFxuICAgICAgc3VtbWFyeTogZXZlbnQuYXBwcm92YWw/Lm5hbWUgfHwgZXZlbnQuam9iPy5uYW1lIHx8IGBXb3JrZmxvdyAke2V2ZW50LndvcmtmbG93Lm5hbWV9IHJlcXVpcmVzIGFwcHJvdmFsYCxcbiAgICAgIHNldmVyaXR5OiAnaGlnaCcsXG4gICAgICBzdWdnZXN0ZWRBY3Rpb25zOiBbJ2FwcHJvdmUnLCAncmVqZWN0J10sXG4gICAgICBtZXRhZGF0YToge1xuICAgICAgICBzb3VyY2U6ICdjaXJjbGVjaScsXG4gICAgICAgIHByb2plY3RTbHVnOiBldmVudC5wcm9qZWN0LnNsdWcsXG4gICAgICAgIHdvcmtmbG93SWQ6IGV2ZW50LndvcmtmbG93LmlkLFxuICAgICAgICBhcHByb3ZhbElkLFxuICAgICAgfSxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOaYoOWwhOetieW+heS6i+S7tuWIsCBJbmJveCBJdGVtXG4gICAqL1xuICBwcml2YXRlIG1hcE9uSG9sZEV2ZW50VG9JbmJveEl0ZW0oZXZlbnQ6IENpcmNsZUNJRXZlbnQpOiBNYXBwZWRDaXJjbGVDSUluYm94SXRlbSB7XG4gICAgY29uc3Qgc291cmNlSWQgPSBgY2lyY2xlY2lfd29ya2Zsb3c6JHtldmVudC53b3JrZmxvdy5pZH1gO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGl0ZW1UeXBlOiAnYXR0ZW50aW9uJyxcbiAgICAgIHNvdXJjZUlkLFxuICAgICAgdGl0bGU6IGBXb3JrZmxvdyBPbiBIb2xkOiAke2V2ZW50LnByb2plY3Quc2x1Z31gLFxuICAgICAgc3VtbWFyeTogYFdvcmtmbG93ICR7ZXZlbnQud29ya2Zsb3cubmFtZX0gaXMgb24gaG9sZGAsXG4gICAgICBzZXZlcml0eTogJ21lZGl1bScsXG4gICAgICBzdWdnZXN0ZWRBY3Rpb25zOiBbJ2NvbnRpbnVlJywgJ29wZW4nXSxcbiAgICAgIG1ldGFkYXRhOiB7XG4gICAgICAgIHNvdXJjZTogJ2NpcmNsZWNpJyxcbiAgICAgICAgcHJvamVjdFNsdWc6IGV2ZW50LnByb2plY3Quc2x1ZyxcbiAgICAgICAgd29ya2Zsb3dJZDogZXZlbnQud29ya2Zsb3cuaWQsXG4gICAgICAgIGV2ZW50VHlwZTogJ3dvcmtmbG93X29uX2hvbGQnLFxuICAgICAgfSxcbiAgICB9O1xuICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOW3peWOguWHveaVsFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ2lyY2xlQ0lFdmVudEFkYXB0ZXIoY29uZmlnPzogQ2lyY2xlQ0lFdmVudEFkYXB0ZXJDb25maWcpOiBDaXJjbGVDSUV2ZW50QWRhcHRlciB7XG4gIHJldHVybiBuZXcgQ2lyY2xlQ0lFdmVudEFkYXB0ZXIoY29uZmlnKTtcbn1cbiJdfQ==