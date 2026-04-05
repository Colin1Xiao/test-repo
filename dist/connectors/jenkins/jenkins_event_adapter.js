"use strict";
/**
 * Jenkins Event Adapter
 * Phase 2B-3A - Jenkins 事件适配器
 *
 * 职责：
 * - 将 Jenkins 事件转换为内部标准事件
 * - build_failed → Incident
 * - input_pending → Approval
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.JenkinsEventAdapter = void 0;
exports.createJenkinsEventAdapter = createJenkinsEventAdapter;
// ============================================================================
// Jenkins Event Adapter
// ============================================================================
class JenkinsEventAdapter {
    constructor(config = {}) {
        this.config = {
            autoCreateIncident: config.autoCreateIncident ?? true,
            autoCreateApproval: config.autoCreateApproval ?? true,
            autoCreateAttention: config.autoCreateAttention ?? true,
            failureSeverity: config.failureSeverity ?? 'high',
            ignoreJobs: config.ignoreJobs ?? [],
            requireApprovalForJobs: config.requireApprovalForJobs ?? [],
        };
    }
    /**
     * 适配 Jenkins 事件
     */
    adaptEvent(event) {
        const result = {};
        // 检查是否忽略该 Job
        if (this.config.ignoreJobs.includes(event.job.fullName)) {
            return result;
        }
        // 根据事件类型适配
        switch (event.type) {
            case 'build_failed':
            case 'pipeline_failed':
                Object.assign(result, this.adaptFailedEvent(event));
                break;
            case 'input_pending':
            case 'approval_pending':
                Object.assign(result, this.adaptInputEvent(event));
                break;
            case 'build_unstable':
                Object.assign(result, this.adaptUnstableEvent(event));
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
     * 适配 Input 事件 → Approval
     */
    adaptInputEvent(event) {
        const result = {};
        if (this.config.autoCreateApproval && event.input) {
            result.approval = this.mapInputEventToApproval(event);
        }
        // 所有 Input 事件都创建 Inbox Item
        result.inboxItem = this.mapInputEventToInboxItem(event);
        return result;
    }
    /**
     * 适配不稳定事件 → Attention
     */
    adaptUnstableEvent(event) {
        const result = {};
        if (this.config.autoCreateAttention) {
            result.inboxItem = this.mapUnstableEventToInboxItem(event);
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
        const buildNumber = event.build?.number || event.pipeline?.runId || 0;
        const sourceId = `${event.job.fullName}/builds/${buildNumber}`;
        return {
            incidentId: `jenkins_build_${buildNumber}`,
            type: event.type === 'pipeline_failed' ? 'pipeline_failure' : 'build_failure',
            severity: this.config.failureSeverity,
            description: `Build ${buildNumber} failed for ${event.job.fullName}`,
            metadata: {
                source: 'jenkins',
                sourceId,
                jobName: event.job.fullName,
                buildNumber,
                url: event.job.url,
            },
        };
    }
    /**
     * 映射失败事件到 Inbox Item
     */
    mapFailedEventToInboxItem(event) {
        const buildNumber = event.build?.number || event.pipeline?.runId || 0;
        return {
            itemType: 'incident',
            sourceId: `${event.job.fullName}/builds/${buildNumber}`,
            title: `Build Failed: ${event.job.fullName}`,
            summary: `Build #${buildNumber} failed`,
            severity: this.config.failureSeverity,
            suggestedActions: ['rerun', 'open', 'ack_incident'],
            metadata: {
                source: 'jenkins',
                jobName: event.job.fullName,
                buildNumber,
                eventType: event.type,
            },
        };
    }
    /**
     * 映射 Input 事件到 Approval
     */
    mapInputEventToApproval(event) {
        const buildNumber = event.build?.number || 0;
        const inputId = event.input?.id || 'unknown';
        const jobName = event.job.fullName;
        // 统一格式：jenkins_input:<jobName>:<buildNumber>:<inputId>
        const approvalId = `jenkins_input:${jobName}:${buildNumber}:${inputId}`;
        const sourceId = approvalId; // sourceId 与 approvalId 一致
        return {
            approvalId,
            scope: event.input?.message || `Approve ${jobName} build #${buildNumber}`,
            reason: `Input step pending in ${jobName} build #${buildNumber}`,
            requestingAgent: event.input?.submitter || 'jenkins',
            metadata: {
                source: 'jenkins',
                sourceType: 'input_step',
                sourceId,
                jobName,
                buildNumber,
                inputId,
                url: `${event.job.url}${buildNumber}/input`,
            },
        };
    }
    /**
     * 映射 Input 事件到 Inbox Item
     */
    mapInputEventToInboxItem(event) {
        const buildNumber = event.build?.number || 0;
        const inputId = event.input?.id || 'unknown';
        const jobName = event.job.fullName;
        // 统一格式：jenkins_input:<jobName>:<buildNumber>:<inputId>
        const sourceId = `jenkins_input:${jobName}:${buildNumber}:${inputId}`;
        return {
            itemType: 'approval',
            sourceId,
            title: `Input Required: ${jobName}`,
            summary: event.input?.message || `Build #${buildNumber} requires approval`,
            severity: 'high',
            suggestedActions: ['approve', 'reject'],
            metadata: {
                source: 'jenkins',
                jobName,
                buildNumber,
                inputId,
            },
        };
    }
    /**
     * 映射不稳定事件到 Inbox Item
     */
    mapUnstableEventToInboxItem(event) {
        const buildNumber = event.build?.number || 0;
        return {
            itemType: 'attention',
            sourceId: `${event.job.fullName}/builds/${buildNumber}`,
            title: `Build Unstable: ${event.job.fullName}`,
            summary: `Build #${buildNumber} is unstable (tests may have failed)`,
            severity: 'medium',
            suggestedActions: ['open', 'acknowledge'],
            metadata: {
                source: 'jenkins',
                jobName: event.job.fullName,
                buildNumber,
                eventType: 'build_unstable',
            },
        };
    }
}
exports.JenkinsEventAdapter = JenkinsEventAdapter;
// ============================================================================
// 工厂函数
// ============================================================================
function createJenkinsEventAdapter(config) {
    return new JenkinsEventAdapter(config);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiamVua2luc19ldmVudF9hZGFwdGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2Nvbm5lY3RvcnMvamVua2lucy9qZW5raW5zX2V2ZW50X2FkYXB0ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7OztHQVFHOzs7QUEwUUgsOERBRUM7QUF0UEQsK0VBQStFO0FBQy9FLHdCQUF3QjtBQUN4QiwrRUFBK0U7QUFFL0UsTUFBYSxtQkFBbUI7SUFHOUIsWUFBWSxTQUFvQyxFQUFFO1FBQ2hELElBQUksQ0FBQyxNQUFNLEdBQUc7WUFDWixrQkFBa0IsRUFBRSxNQUFNLENBQUMsa0JBQWtCLElBQUksSUFBSTtZQUNyRCxrQkFBa0IsRUFBRSxNQUFNLENBQUMsa0JBQWtCLElBQUksSUFBSTtZQUNyRCxtQkFBbUIsRUFBRSxNQUFNLENBQUMsbUJBQW1CLElBQUksSUFBSTtZQUN2RCxlQUFlLEVBQUUsTUFBTSxDQUFDLGVBQWUsSUFBSSxNQUFNO1lBQ2pELFVBQVUsRUFBRSxNQUFNLENBQUMsVUFBVSxJQUFJLEVBQUU7WUFDbkMsc0JBQXNCLEVBQUUsTUFBTSxDQUFDLHNCQUFzQixJQUFJLEVBQUU7U0FDNUQsQ0FBQztJQUNKLENBQUM7SUFFRDs7T0FFRztJQUNILFVBQVUsQ0FBQyxLQUFtQjtRQUs1QixNQUFNLE1BQU0sR0FBUSxFQUFFLENBQUM7UUFFdkIsY0FBYztRQUNkLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQztZQUN4RCxPQUFPLE1BQU0sQ0FBQztRQUNoQixDQUFDO1FBRUQsV0FBVztRQUNYLFFBQVEsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ25CLEtBQUssY0FBYyxDQUFDO1lBQ3BCLEtBQUssaUJBQWlCO2dCQUNwQixNQUFNLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxJQUFJLENB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RUFBRSxRQUFRLENBQUM7WUFDdkMsUUFBUSxFQUFFO2dCQUNSLE1BQU0sRUFBRSxTQUFTO2dCQUNqQixPQUFPO2dCQUNQLFdBQVc7Z0JBQ1gsT0FBTzthQUNSO1NBQ0YsQ0FBQztJQUNKLENBQUM7SUFFRDs7T0FFRztJQUNLLDJCQUEyQixDQUFDLEtBQW1CO1FBQ3JELE1BQU0sV0FBVyxHQUFHLEtBQUssQ0FBQyxLQUFLLEVBQUUsTUFBTSxJQUFJLENBQUMsQ0FBQztRQUU3QyxPQUFPO1lBQ0wsUUFBUSxFQUFFLFdBQVc7WUFDckIsUUFBUSxFQUFFLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxRQUFRLFdBQVcsV0FBVyxFQUFFO1lBQ3ZELEtBQUssRUFBRSxtQkFBbUIsS0FBSyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUU7WUFDOUMsT0FBTyxFQUFFLFVBQVUsV0FBVyxzQ0FBc0M7WUFDcEUsUUFBUSxFQUFFLFFBQVE7WUFDbEIsZ0JBQWdCLEVBQUUsQ0FBQyxNQUFNLEVBQUUsYUFBYSxDQUFDO1lBQ3pDLFFBQVEsRUFBRTtnQkFDUixNQUFNLEVBQUUsU0FBUztnQkFDakIsT0FBTyxFQUFFLEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBUTtnQkFDM0IsV0FBVztnQkFDWCxTQUFTLEVBQUUsZ0JBQWdCO2FBQzVCO1NBQ0YsQ0FBQztJQUNKLENBQUM7Q0FDRjtBQTFPRCxrREEwT0M7QUFFRCwrRUFBK0U7QUFDL0UsT0FBTztBQUNQLCtFQUErRTtBQUUvRSxTQUFnQix5QkFBeUIsQ0FBQyxNQUFrQztJQUMxRSxPQUFPLElBQUksbUJBQW1CLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDekMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogSmVua2lucyBFdmVudCBBZGFwdGVyXG4gKiBQaGFzZSAyQi0zQSAtIEplbmtpbnMg5LqL5Lu26YCC6YWN5ZmoXG4gKiBcbiAqIOiBjOi0o++8mlxuICogLSDlsIYgSmVua2lucyDkuovku7bovazmjaLkuLrlhoXpg6jmoIflh4bkuovku7ZcbiAqIC0gYnVpbGRfZmFpbGVkIOKGkiBJbmNpZGVudFxuICogLSBpbnB1dF9wZW5kaW5nIOKGkiBBcHByb3ZhbFxuICovXG5cbmltcG9ydCB0eXBlIHtcbiAgSmVua2luc0V2ZW50LFxuICBNYXBwZWRKZW5raW5zSW5jaWRlbnQsXG4gIE1hcHBlZEplbmtpbnNBcHByb3ZhbCxcbiAgTWFwcGVkSmVua2luc0luYm94SXRlbSxcbn0gZnJvbSAnLi9qZW5raW5zX3R5cGVzJztcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g6YWN572uXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBpbnRlcmZhY2UgSmVua2luc0V2ZW50QWRhcHRlckNvbmZpZyB7XG4gIGF1dG9DcmVhdGVJbmNpZGVudD86IGJvb2xlYW47XG4gIGF1dG9DcmVhdGVBcHByb3ZhbD86IGJvb2xlYW47XG4gIGF1dG9DcmVhdGVBdHRlbnRpb24/OiBib29sZWFuO1xuICBmYWlsdXJlU2V2ZXJpdHk/OiAnbG93JyB8ICdtZWRpdW0nIHwgJ2hpZ2gnIHwgJ2NyaXRpY2FsJztcbiAgaWdub3JlSm9icz86IHN0cmluZ1tdO1xuICByZXF1aXJlQXBwcm92YWxGb3JKb2JzPzogc3RyaW5nW107XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIEplbmtpbnMgRXZlbnQgQWRhcHRlclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgY2xhc3MgSmVua2luc0V2ZW50QWRhcHRlciB7XG4gIHByaXZhdGUgY29uZmlnOiBSZXF1aXJlZDxKZW5raW5zRXZlbnRBZGFwdGVyQ29uZmlnPjtcblxuICBjb25zdHJ1Y3Rvcihjb25maWc6IEplbmtpbnNFdmVudEFkYXB0ZXJDb25maWcgPSB7fSkge1xuICAgIHRoaXMuY29uZmlnID0ge1xuICAgICAgYXV0b0NyZWF0ZUluY2lkZW50OiBjb25maWcuYXV0b0NyZWF0ZUluY2lkZW50ID8/IHRydWUsXG4gICAgICBhdXRvQ3JlYXRlQXBwcm92YWw6IGNvbmZpZy5hdXRvQ3JlYXRlQXBwcm92YWwgPz8gdHJ1ZSxcbiAgICAgIGF1dG9DcmVhdGVBdHRlbnRpb246IGNvbmZpZy5hdXRvQ3JlYXRlQXR0ZW50aW9uID8/IHRydWUsXG4gICAgICBmYWlsdXJlU2V2ZXJpdHk6IGNvbmZpZy5mYWlsdXJlU2V2ZXJpdHkgPz8gJ2hpZ2gnLFxuICAgICAgaWdub3JlSm9iczogY29uZmlnLmlnbm9yZUpvYnMgPz8gW10sXG4gICAgICByZXF1aXJlQXBwcm92YWxGb3JKb2JzOiBjb25maWcucmVxdWlyZUFwcHJvdmFsRm9ySm9icyA/PyBbXSxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOmAgumFjSBKZW5raW5zIOS6i+S7tlxuICAgKi9cbiAgYWRhcHRFdmVudChldmVudDogSmVua2luc0V2ZW50KToge1xuICAgIGluY2lkZW50PzogTWFwcGVkSmVua2luc0luY2lkZW50O1xuICAgIGFwcHJvdmFsPzogTWFwcGVkSmVua2luc0FwcHJvdmFsO1xuICAgIGluYm94SXRlbT86IE1hcHBlZEplbmtpbnNJbmJveEl0ZW07XG4gIH0ge1xuICAgIGNvbnN0IHJlc3VsdDogYW55ID0ge307XG5cbiAgICAvLyDmo4Dmn6XmmK/lkKblv73nlaXor6UgSm9iXG4gICAgaWYgKHRoaXMuY29uZmlnLmlnbm9yZUpvYnMuaW5jbHVkZXMoZXZlbnQuam9iLmZ1bGxOYW1lKSkge1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvLyDmoLnmja7kuovku7bnsbvlnovpgILphY1cbiAgICBzd2l0Y2ggKGV2ZW50LnR5cGUpIHtcbiAgICAgIGNhc2UgJ2J1aWxkX2ZhaWxlZCc6XG4gICAgICBjYXNlICdwaXBlbGluZV9mYWlsZWQnOlxuICAgICAgICBPYmplY3QuYXNzaWduKHJlc3VsdCwgdGhpcy5hZGFwdEZhaWxlZEV2ZW50KGV2ZW50KSk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlICdpbnB1dF9wZW5kaW5nJzpcbiAgICAgIGNhc2UgJ2FwcHJvdmFsX3BlbmRpbmcnOlxuICAgICAgICBPYmplY3QuYXNzaWduKHJlc3VsdCwgdGhpcy5hZGFwdElucHV0RXZlbnQoZXZlbnQpKTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgJ2J1aWxkX3Vuc3RhYmxlJzpcbiAgICAgICAgT2JqZWN0LmFzc2lnbihyZXN1bHQsIHRoaXMuYWRhcHRVbnN0YWJsZUV2ZW50KGV2ZW50KSk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICAvLyDlhbbku5bkuovku7bkuI3lpITnkIZcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgLy8g5YaF6YOo5pa55rOVXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAvKipcbiAgICog6YCC6YWN5aSx6LSl5LqL5Lu2IOKGkiBJbmNpZGVudFxuICAgKi9cbiAgcHJpdmF0ZSBhZGFwdEZhaWxlZEV2ZW50KGV2ZW50OiBKZW5raW5zRXZlbnQpOiB7XG4gICAgaW5jaWRlbnQ/OiBNYXBwZWRKZW5raW5zSW5jaWRlbnQ7XG4gICAgaW5ib3hJdGVtPzogTWFwcGVkSmVua2luc0luYm94SXRlbTtcbiAgfSB7XG4gICAgY29uc3QgcmVzdWx0OiBhbnkgPSB7fTtcblxuICAgIGlmICh0aGlzLmNvbmZpZy5hdXRvQ3JlYXRlSW5jaWRlbnQpIHtcbiAgICAgIHJlc3VsdC5pbmNpZGVudCA9IHRoaXMubWFwRmFpbGVkRXZlbnRUb0luY2lkZW50KGV2ZW50KTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5jb25maWcuYXV0b0NyZWF0ZUF0dGVudGlvbikge1xuICAgICAgcmVzdWx0LmluYm94SXRlbSA9IHRoaXMubWFwRmFpbGVkRXZlbnRUb0luYm94SXRlbShldmVudCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiDpgILphY0gSW5wdXQg5LqL5Lu2IOKGkiBBcHByb3ZhbFxuICAgKi9cbiAgcHJpdmF0ZSBhZGFwdElucHV0RXZlbnQoZXZlbnQ6IEplbmtpbnNFdmVudCk6IHtcbiAgICBhcHByb3ZhbD86IE1hcHBlZEplbmtpbnNBcHByb3ZhbDtcbiAgICBpbmJveEl0ZW0/OiBNYXBwZWRKZW5raW5zSW5ib3hJdGVtO1xuICB9IHtcbiAgICBjb25zdCByZXN1bHQ6IGFueSA9IHt9O1xuXG4gICAgaWYgKHRoaXMuY29uZmlnLmF1dG9DcmVhdGVBcHByb3ZhbCAmJiBldmVudC5pbnB1dCkge1xuICAgICAgcmVzdWx0LmFwcHJvdmFsID0gdGhpcy5tYXBJbnB1dEV2ZW50VG9BcHByb3ZhbChldmVudCk7XG4gICAgfVxuXG4gICAgLy8g5omA5pyJIElucHV0IOS6i+S7tumDveWIm+W7uiBJbmJveCBJdGVtXG4gICAgcmVzdWx0LmluYm94SXRlbSA9IHRoaXMubWFwSW5wdXRFdmVudFRvSW5ib3hJdGVtKGV2ZW50KTtcblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICog6YCC6YWN5LiN56iz5a6a5LqL5Lu2IOKGkiBBdHRlbnRpb25cbiAgICovXG4gIHByaXZhdGUgYWRhcHRVbnN0YWJsZUV2ZW50KGV2ZW50OiBKZW5raW5zRXZlbnQpOiB7XG4gICAgaW5ib3hJdGVtPzogTWFwcGVkSmVua2luc0luYm94SXRlbTtcbiAgfSB7XG4gICAgY29uc3QgcmVzdWx0OiBhbnkgPSB7fTtcblxuICAgIGlmICh0aGlzLmNvbmZpZy5hdXRvQ3JlYXRlQXR0ZW50aW9uKSB7XG4gICAgICByZXN1bHQuaW5ib3hJdGVtID0gdGhpcy5tYXBVbnN0YWJsZUV2ZW50VG9JbmJveEl0ZW0oZXZlbnQpO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIC8vIOaYoOWwhOaWueazlVxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgLyoqXG4gICAqIOaYoOWwhOWksei0peS6i+S7tuWIsCBJbmNpZGVudFxuICAgKi9cbiAgcHJpdmF0ZSBtYXBGYWlsZWRFdmVudFRvSW5jaWRlbnQoZXZlbnQ6IEplbmtpbnNFdmVudCk6IE1hcHBlZEplbmtpbnNJbmNpZGVudCB7XG4gICAgY29uc3QgYnVpbGROdW1iZXIgPSBldmVudC5idWlsZD8ubnVtYmVyIHx8IGV2ZW50LnBpcGVsaW5lPy5ydW5JZCB8fCAwO1xuICAgIGNvbnN0IHNvdXJjZUlkID0gYCR7ZXZlbnQuam9iLmZ1bGxOYW1lfS9idWlsZHMvJHtidWlsZE51bWJlcn1gO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGluY2lkZW50SWQ6IGBqZW5raW5zX2J1aWxkXyR7YnVpbGROdW1iZXJ9YCxcbiAgICAgIHR5cGU6IGV2ZW50LnR5cGUgPT09ICdwaXBlbGluZV9mYWlsZWQnID8gJ3BpcGVsaW5lX2ZhaWx1cmUnIDogJ2J1aWxkX2ZhaWx1cmUnLFxuICAgICAgc2V2ZXJpdHk6IHRoaXMuY29uZmlnLmZhaWx1cmVTZXZlcml0eSxcbiAgICAgIGRlc2NyaXB0aW9uOiBgQnVpbGQgJHtidWlsZE51bWJlcn0gZmFpbGVkIGZvciAke2V2ZW50LmpvYi5mdWxsTmFtZX1gLFxuICAgICAgbWV0YWRhdGE6IHtcbiAgICAgICAgc291cmNlOiAnamVua2lucycsXG4gICAgICAgIHNvdXJjZUlkLFxuICAgICAgICBqb2JOYW1lOiBldmVudC5qb2IuZnVsbE5hbWUsXG4gICAgICAgIGJ1aWxkTnVtYmVyLFxuICAgICAgICB1cmw6IGV2ZW50LmpvYi51cmwsXG4gICAgICB9LFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICog5pig5bCE5aSx6LSl5LqL5Lu25YiwIEluYm94IEl0ZW1cbiAgICovXG4gIHByaXZhdGUgbWFwRmFpbGVkRXZlbnRUb0luYm94SXRlbShldmVudDogSmVua2luc0V2ZW50KTogTWFwcGVkSmVua2luc0luYm94SXRlbSB7XG4gICAgY29uc3QgYnVpbGROdW1iZXIgPSBldmVudC5idWlsZD8ubnVtYmVyIHx8IGV2ZW50LnBpcGVsaW5lPy5ydW5JZCB8fCAwO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGl0ZW1UeXBlOiAnaW5jaWRlbnQnLFxuICAgICAgc291cmNlSWQ6IGAke2V2ZW50LmpvYi5mdWxsTmFtZX0vYnVpbGRzLyR7YnVpbGROdW1iZXJ9YCxcbiAgICAgIHRpdGxlOiBgQnVpbGQgRmFpbGVkOiAke2V2ZW50LmpvYi5mdWxsTmFtZX1gLFxuICAgICAgc3VtbWFyeTogYEJ1aWxkICMke2J1aWxkTnVtYmVyfSBmYWlsZWRgLFxuICAgICAgc2V2ZXJpdHk6IHRoaXMuY29uZmlnLmZhaWx1cmVTZXZlcml0eSxcbiAgICAgIHN1Z2dlc3RlZEFjdGlvbnM6IFsncmVydW4nLCAnb3BlbicsICdhY2tfaW5jaWRlbnQnXSxcbiAgICAgIG1ldGFkYXRhOiB7XG4gICAgICAgIHNvdXJjZTogJ2plbmtpbnMnLFxuICAgICAgICBqb2JOYW1lOiBldmVudC5qb2IuZnVsbE5hbWUsXG4gICAgICAgIGJ1aWxkTnVtYmVyLFxuICAgICAgICBldmVudFR5cGU6IGV2ZW50LnR5cGUsXG4gICAgICB9LFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICog5pig5bCEIElucHV0IOS6i+S7tuWIsCBBcHByb3ZhbFxuICAgKi9cbiAgcHJpdmF0ZSBtYXBJbnB1dEV2ZW50VG9BcHByb3ZhbChldmVudDogSmVua2luc0V2ZW50KTogTWFwcGVkSmVua2luc0FwcHJvdmFsIHtcbiAgICBjb25zdCBidWlsZE51bWJlciA9IGV2ZW50LmJ1aWxkPy5udW1iZXIgfHwgMDtcbiAgICBjb25zdCBpbnB1dElkID0gZXZlbnQuaW5wdXQ/LmlkIHx8ICd1bmtub3duJztcbiAgICBjb25zdCBqb2JOYW1lID0gZXZlbnQuam9iLmZ1bGxOYW1lO1xuICAgIC8vIOe7n+S4gOagvOW8j++8mmplbmtpbnNfaW5wdXQ6PGpvYk5hbWU+OjxidWlsZE51bWJlcj46PGlucHV0SWQ+XG4gICAgY29uc3QgYXBwcm92YWxJZCA9IGBqZW5raW5zX2lucHV0OiR7am9iTmFtZX06JHtidWlsZE51bWJlcn06JHtpbnB1dElkfWA7XG4gICAgY29uc3Qgc291cmNlSWQgPSBhcHByb3ZhbElkOyAvLyBzb3VyY2VJZCDkuI4gYXBwcm92YWxJZCDkuIDoh7RcblxuICAgIHJldHVybiB7XG4gICAgICBhcHByb3ZhbElkLFxuICAgICAgc2NvcGU6IGV2ZW50LmlucHV0Py5tZXNzYWdlIHx8IGBBcHByb3ZlICR7am9iTmFtZX0gYnVpbGQgIyR7YnVpbGROdW1iZXJ9YCxcbiAgICAgIHJlYXNvbjogYElucHV0IHN0ZXAgcGVuZGluZyBpbiAke2pvYk5hbWV9IGJ1aWxkICMke2J1aWxkTnVtYmVyfWAsXG4gICAgICByZXF1ZXN0aW5nQWdlbnQ6IGV2ZW50LmlucHV0Py5zdWJtaXR0ZXIgfHwgJ2plbmtpbnMnLFxuICAgICAgbWV0YWRhdGE6IHtcbiAgICAgICAgc291cmNlOiAnamVua2lucycsXG4gICAgICAgIHNvdXJjZVR5cGU6ICdpbnB1dF9zdGVwJyxcbiAgICAgICAgc291cmNlSWQsXG4gICAgICAgIGpvYk5hbWUsXG4gICAgICAgIGJ1aWxkTnVtYmVyLFxuICAgICAgICBpbnB1dElkLFxuICAgICAgICB1cmw6IGAke2V2ZW50LmpvYi51cmx9JHtidWlsZE51bWJlcn0vaW5wdXRgLFxuICAgICAgfSxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOaYoOWwhCBJbnB1dCDkuovku7bliLAgSW5ib3ggSXRlbVxuICAgKi9cbiAgcHJpdmF0ZSBtYXBJbnB1dEV2ZW50VG9JbmJveEl0ZW0oZXZlbnQ6IEplbmtpbnNFdmVudCk6IE1hcHBlZEplbmtpbnNJbmJveEl0ZW0ge1xuICAgIGNvbnN0IGJ1aWxkTnVtYmVyID0gZXZlbnQuYnVpbGQ/Lm51bWJlciB8fCAwO1xuICAgIGNvbnN0IGlucHV0SWQgPSBldmVudC5pbnB1dD8uaWQgfHwgJ3Vua25vd24nO1xuICAgIGNvbnN0IGpvYk5hbWUgPSBldmVudC5qb2IuZnVsbE5hbWU7XG4gICAgLy8g57uf5LiA5qC85byP77yaamVua2luc19pbnB1dDo8am9iTmFtZT46PGJ1aWxkTnVtYmVyPjo8aW5wdXRJZD5cbiAgICBjb25zdCBzb3VyY2VJZCA9IGBqZW5raW5zX2lucHV0OiR7am9iTmFtZX06JHtidWlsZE51bWJlcn06JHtpbnB1dElkfWA7XG5cbiAgICByZXR1cm4ge1xuICAgICAgaXRlbVR5cGU6ICdhcHByb3ZhbCcsXG4gICAgICBzb3VyY2VJZCxcbiAgICAgIHRpdGxlOiBgSW5wdXQgUmVxdWlyZWQ6ICR7am9iTmFtZX1gLFxuICAgICAgc3VtbWFyeTogZXZlbnQuaW5wdXQ/Lm1lc3NhZ2UgfHwgYEJ1aWxkICMke2J1aWxkTnVtYmVyfSByZXF1aXJlcyBhcHByb3ZhbGAsXG4gICAgICBzZXZlcml0eTogJ2hpZ2gnLFxuICAgICAgc3VnZ2VzdGVkQWN0aW9uczogWydhcHByb3ZlJywgJ3JlamVjdCddLFxuICAgICAgbWV0YWRhdGE6IHtcbiAgICAgICAgc291cmNlOiAnamVua2lucycsXG4gICAgICAgIGpvYk5hbWUsXG4gICAgICAgIGJ1aWxkTnVtYmVyLFxuICAgICAgICBpbnB1dElkLFxuICAgICAgfSxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOaYoOWwhOS4jeeos+WumuS6i+S7tuWIsCBJbmJveCBJdGVtXG4gICAqL1xuICBwcml2YXRlIG1hcFVuc3RhYmxlRXZlbnRUb0luYm94SXRlbShldmVudDogSmVua2luc0V2ZW50KTogTWFwcGVkSmVua2luc0luYm94SXRlbSB7XG4gICAgY29uc3QgYnVpbGROdW1iZXIgPSBldmVudC5idWlsZD8ubnVtYmVyIHx8IDA7XG5cbiAgICByZXR1cm4ge1xuICAgICAgaXRlbVR5cGU6ICdhdHRlbnRpb24nLFxuICAgICAgc291cmNlSWQ6IGAke2V2ZW50LmpvYi5mdWxsTmFtZX0vYnVpbGRzLyR7YnVpbGROdW1iZXJ9YCxcbiAgICAgIHRpdGxlOiBgQnVpbGQgVW5zdGFibGU6ICR7ZXZlbnQuam9iLmZ1bGxOYW1lfWAsXG4gICAgICBzdW1tYXJ5OiBgQnVpbGQgIyR7YnVpbGROdW1iZXJ9IGlzIHVuc3RhYmxlICh0ZXN0cyBtYXkgaGF2ZSBmYWlsZWQpYCxcbiAgICAgIHNldmVyaXR5OiAnbWVkaXVtJyxcbiAgICAgIHN1Z2dlc3RlZEFjdGlvbnM6IFsnb3BlbicsICdhY2tub3dsZWRnZSddLFxuICAgICAgbWV0YWRhdGE6IHtcbiAgICAgICAgc291cmNlOiAnamVua2lucycsXG4gICAgICAgIGpvYk5hbWU6IGV2ZW50LmpvYi5mdWxsTmFtZSxcbiAgICAgICAgYnVpbGROdW1iZXIsXG4gICAgICAgIGV2ZW50VHlwZTogJ2J1aWxkX3Vuc3RhYmxlJyxcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDlt6XljoLlh73mlbBcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUplbmtpbnNFdmVudEFkYXB0ZXIoY29uZmlnPzogSmVua2luc0V2ZW50QWRhcHRlckNvbmZpZyk6IEplbmtpbnNFdmVudEFkYXB0ZXIge1xuICByZXR1cm4gbmV3IEplbmtpbnNFdmVudEFkYXB0ZXIoY29uZmlnKTtcbn1cbiJdfQ==