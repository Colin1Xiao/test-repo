"use strict";
/**
 * CircleCI Operator Bridge
 * Phase 2B-3B - CircleCI → Operator 数据面桥接
 *
 * 职责：
 * - workflow_failed → IncidentDataSource
 * - approval_pending → ApprovalDataSource
 * - 动作后状态同步
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircleCIOperatorBridge = void 0;
exports.createCircleCIOperatorBridge = createCircleCIOperatorBridge;
// ============================================================================
// CircleCI Operator Bridge
// ============================================================================
class CircleCIOperatorBridge {
    constructor(eventAdapter, circleCIConnector, config = {}) {
        this.config = {
            defaultWorkspaceId: config.defaultWorkspaceId ?? 'local-default',
            autoCreateIncident: config.autoCreateIncident ?? true,
            autoCreateApproval: config.autoCreateApproval ?? true,
        };
        this.eventAdapter = eventAdapter;
        this.circleCIConnector = circleCIConnector;
    }
    /**
     * 处理 CircleCI 事件
     */
    async handleCircleCIEvent(event, workspaceId) {
        const result = {};
        // 适配事件
        const adapted = this.eventAdapter.adaptEvent(event);
        // workflow_failed → Incident
        if (adapted.incident && this.config.autoCreateIncident) {
            console.log('[CircleCIOperatorBridge] Creating incident:', adapted.incident);
            result.incidentCreated = true;
        }
        // approval_pending → Approval
        if (adapted.approval && this.config.autoCreateApproval) {
            console.log('[CircleCIOperatorBridge] Creating approval:', adapted.approval);
            result.approvalCreated = true;
        }
        // inboxItem
        if (adapted.inboxItem) {
            result.inboxItemCreated = true;
        }
        return result;
    }
    /**
     * 处理 Approve 动作回写
     */
    async handleApproveAction(sourceId, actorId) {
        // 解析 sourceId (格式：circleci_approval:<approvalId>)
        const match = sourceId.match(/^circleci_approval:(.+)$/);
        if (!match) {
            return { success: false, message: 'Invalid sourceId format' };
        }
        const [, approvalId] = match;
        try {
            await this.circleCIConnector.approveJob(approvalId);
            return {
                success: true,
                message: `Approved CircleCI job ${approvalId}`,
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to approve: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }
    /**
     * 处理 Reject 动作回写
     */
    async handleRejectAction(sourceId, actorId, reason) {
        // 解析 sourceId
        const match = sourceId.match(/^circleci_approval:(.+)$/);
        if (!match) {
            return { success: false, message: 'Invalid sourceId format' };
        }
        const [, approvalId] = match;
        try {
            // CircleCI 没有直接的 reject API，使用 cancel 或标记为失败
            await this.circleCIConnector.continueWorkflow(approvalId);
            return {
                success: true,
                message: `Rejected CircleCI approval ${approvalId}: ${reason ?? 'No reason provided'}`,
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to reject: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }
    /**
     * 处理 Rerun 动作
     */
    async handleRerunAction(sourceId) {
        // 解析 sourceId (格式：circleci_workflow:<workflowId>)
        const match = sourceId.match(/^circleci_workflow:(.+)$/);
        if (!match) {
            return { success: false, message: 'Invalid sourceId format' };
        }
        const [, workflowId] = match;
        try {
            await this.circleCIConnector.rerunWorkflow(workflowId);
            return {
                success: true,
                message: `Rerun CircleCI workflow ${workflowId}`,
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to rerun: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }
}
exports.CircleCIOperatorBridge = CircleCIOperatorBridge;
// ============================================================================
// 工厂函数
// ============================================================================
function createCircleCIOperatorBridge(eventAdapter, circleCIConnector, config) {
    return new CircleCIOperatorBridge(eventAdapter, circleCIConnector, config);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2lyY2xlY2lfb3BlcmF0b3JfYnJpZGdlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2Nvbm5lY3RvcnMvY2lyY2xlY2kvY2lyY2xlY2lfb3BlcmF0b3JfYnJpZGdlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7R0FRRzs7O0FBNEtILG9FQU1DO0FBbEtELCtFQUErRTtBQUMvRSwyQkFBMkI7QUFDM0IsK0VBQStFO0FBRS9FLE1BQWEsc0JBQXNCO0lBS2pDLFlBQ0UsWUFBa0MsRUFDbEMsaUJBQW9DLEVBQ3BDLFNBQXVDLEVBQUU7UUFFekMsSUFBSSxDQUFDLE1BQU0sR0FBRztZQUNaLGtCQUFrQixFQUFFLE1BQU0sQ0FBQyxrQkFBa0IsSUFBSSxlQUFlO1lBQ2hFLGtCQUFrQixFQUFFLE1BQU0sQ0FBQyxrQkFBa0IsSUFBSSxJQUFJO1lBQ3JELGtCQUFrQixFQUFFLE1BQU0sQ0FBQyxrQkFBa0IsSUFBSSxJQUFJO1NBQ3RELENBQUM7UUFFRixJQUFJLENBQUMsWUFBWSxHQUFHLFlBQVksQ0FBQztRQUNqQyxJQUFJLENBQUMsaUJBQWlCLEdBQUcsaUJBQWlCLENBQUM7SUFDN0MsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLG1CQUFtQixDQUN2QixLQUFvQixFQUNwQixXQUFvQjtRQU1wQixNQUFNLE1BQU0sR0FBUSxFQUFFLENBQUM7UUFFdkIsT0FBTztRQUNQLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRXBELDZCQUE2QjtRQUM3QixJQUFJLE9BQU8sQ0FBQyxRQUFRLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1lBQ3ZELE9BQU8sQ0FBQyxHQUFHLENBQUMsNkNBQTZDLEVBQUUsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQzdFLE1BQU0sQ0FBQyxlQUFlLEdBQUcsSUFBSSxDQUFD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RUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLHlCQUF5QixFQUFFLENBQUM7UUFDaEUsQ0FBQztRQUVELE1BQU0sQ0FBQyxFQUFFLFVBQVUsQ0FBQyxHQUFHLEtBQUssQ0FBQztRQUU3QixJQUFJLENBQUM7WUFDSCxNQUFNLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUFDLENBQUM7WUFFdkQsT0FBTztnQkFDTCxPQUFPLEVBQUUsSUFBSTtnQkFDYixPQUFPLEVBQUUsMkJBQTJCLFVBQVUsRUFBRTthQUNqRCxDQUFDO1FBQ0osQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDZixPQUFPO2dCQUNMLE9BQU8sRUFBRSxLQUFLO2dCQUNkLE9BQU8sRUFBRSxvQkFBb0IsS0FBSyxZQUFZLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxFQUFFO2FBQ3RGLENBQUM7UUFDSixDQUFDO0lBQ0gsQ0FBQztDQUNGO0FBbEpELHdEQWtKQztBQUVELCtFQUErRTtBQUMvRSxPQUFPO0FBQ1AsK0VBQStFO0FBRS9FLFNBQWdCLDRCQUE0QixDQUMxQyxZQUFrQyxFQUNsQyxpQkFBb0MsRUFDcEMsTUFBcUM7SUFFckMsT0FBTyxJQUFJLHNCQUFzQixDQUFDLFlBQVksRUFBRSxpQkFBaUIsRUFBRSxNQUFNLENBQUMsQ0FBQztBQUM3RSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDaXJjbGVDSSBPcGVyYXRvciBCcmlkZ2VcbiAqIFBoYXNlIDJCLTNCIC0gQ2lyY2xlQ0kg4oaSIE9wZXJhdG9yIOaVsOaNrumdouahpeaOpVxuICogXG4gKiDogYzotKPvvJpcbiAqIC0gd29ya2Zsb3dfZmFpbGVkIOKGkiBJbmNpZGVudERhdGFTb3VyY2VcbiAqIC0gYXBwcm92YWxfcGVuZGluZyDihpIgQXBwcm92YWxEYXRhU291cmNlXG4gKiAtIOWKqOS9nOWQjueKtuaAgeWQjOatpVxuICovXG5cbmltcG9ydCB0eXBlIHsgQ2lyY2xlQ0lFdmVudCB9IGZyb20gJy4vY2lyY2xlY2lfdHlwZXMnO1xuaW1wb3J0IHR5cGUgeyBDaXJjbGVDSUV2ZW50QWRhcHRlciB9IGZyb20gJy4vY2lyY2xlY2lfZXZlbnRfYWRhcHRlcic7XG5pbXBvcnQgdHlwZSB7IENpcmNsZUNJQ29ubmVjdG9yIH0gZnJvbSAnLi9jaXJjbGVjaV9jb25uZWN0b3InO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDphY3nva5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGludGVyZmFjZSBDaXJjbGVDSU9wZXJhdG9yQnJpZGdlQ29uZmlnIHtcbiAgZGVmYXVsdFdvcmtzcGFjZUlkPzogc3RyaW5nO1xuICBhdXRvQ3JlYXRlSW5jaWRlbnQ/OiBib29sZWFuO1xuICBhdXRvQ3JlYXRlQXBwcm92YWw/OiBib29sZWFuO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBDaXJjbGVDSSBPcGVyYXRvciBCcmlkZ2Vcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGNsYXNzIENpcmNsZUNJT3BlcmF0b3JCcmlkZ2Uge1xuICBwcml2YXRlIGNvbmZpZzogUmVxdWlyZWQ8Q2lyY2xlQ0lPcGVyYXRvckJyaWRnZUNvbmZpZz47XG4gIHByaXZhdGUgZXZlbnRBZGFwdGVyOiBDaXJjbGVDSUV2ZW50QWRhcHRlcjtcbiAgcHJpdmF0ZSBjaXJjbGVDSUNvbm5lY3RvcjogQ2lyY2xlQ0lDb25uZWN0b3I7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgZXZlbnRBZGFwdGVyOiBDaXJjbGVDSUV2ZW50QWRhcHRlcixcbiAgICBjaXJjbGVDSUNvbm5lY3RvcjogQ2lyY2xlQ0lDb25uZWN0b3IsXG4gICAgY29uZmlnOiBDaXJjbGVDSU9wZXJhdG9yQnJpZGdlQ29uZmlnID0ge31cbiAgKSB7XG4gICAgdGhpcy5jb25maWcgPSB7XG4gICAgICBkZWZhdWx0V29ya3NwYWNlSWQ6IGNvbmZpZy5kZWZhdWx0V29ya3NwYWNlSWQgPz8gJ2xvY2FsLWRlZmF1bHQnLFxuICAgICAgYXV0b0NyZWF0ZUluY2lkZW50OiBjb25maWcuYXV0b0NyZWF0ZUluY2lkZW50ID8/IHRydWUsXG4gICAgICBhdXRvQ3JlYXRlQXBwcm92YWw6IGNvbmZpZy5hdXRvQ3JlYXRlQXBwcm92YWwgPz8gdHJ1ZSxcbiAgICB9O1xuXG4gICAgdGhpcy5ldmVudEFkYXB0ZXIgPSBldmVudEFkYXB0ZXI7XG4gICAgdGhpcy5jaXJjbGVDSUNvbm5lY3RvciA9IGNpcmNsZUNJQ29ubmVjdG9yO1xuICB9XG5cbiAgLyoqXG4gICAqIOWkhOeQhiBDaXJjbGVDSSDkuovku7ZcbiAgICovXG4gIGFzeW5jIGhhbmRsZUNpcmNsZUNJRXZlbnQoXG4gICAgZXZlbnQ6IENpcmNsZUNJRXZlbnQsXG4gICAgd29ya3NwYWNlSWQ/OiBzdHJpbmdcbiAgKTogUHJvbWlzZTx7XG4gICAgaW5jaWRlbnRDcmVhdGVkPzogYm9vbGVhbjtcbiAgICBhcHByb3ZhbENyZWF0ZWQ/OiBib29sZWFuO1xuICAgIGluYm94SXRlbUNyZWF0ZWQ/OiBib29sZWFuO1xuICB9PiB7XG4gICAgY29uc3QgcmVzdWx0OiBhbnkgPSB7fTtcblxuICAgIC8vIOmAgumFjeS6i+S7tlxuICAgIGNvbnN0IGFkYXB0ZWQgPSB0aGlzLmV2ZW50QWRhcHRlci5hZGFwdEV2ZW50KGV2ZW50KTtcblxuICAgIC8vIHdvcmtmbG93X2ZhaWxlZCDihpIgSW5jaWRlbnRcbiAgICBpZiAoYWRhcHRlZC5pbmNpZGVudCAmJiB0aGlzLmNvbmZpZy5hdXRvQ3JlYXRlSW5jaWRlbnQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdbQ2lyY2xlQ0lPcGVyYXRvckJyaWRnZV0gQ3JlYXRpbmcgaW5jaWRlbnQ6JywgYWRhcHRlZC5pbmNpZGVudCk7XG4gICAgICByZXN1bHQuaW5jaWRlbnRDcmVhdGVkID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyBhcHByb3ZhbF9wZW5kaW5nIOKGkiBBcHByb3ZhbFxuICAgIGlmIChhZGFwdGVkLmFwcHJvdmFsICYmIHRoaXMuY29uZmlnLmF1dG9DcmVhdGVBcHByb3ZhbCkge1xuICAgICAgY29uc29sZS5sb2coJ1tDaXJjbGVDSU9wZXJhdG9yQnJpZGdlXSBDcmVhdGluZyBhcHByb3ZhbDonLCBhZGFwdGVkLmFwcHJvdmFsKTtcbiAgICAgIHJlc3VsdC5hcHByb3ZhbENyZWF0ZWQgPSB0cnVlO1xuICAgIH1cblxuICAgIC8vIGluYm94SXRlbVxuICAgIGlmIChhZGFwdGVkLmluYm94SXRlbSkge1xuICAgICAgcmVzdWx0LmluYm94SXRlbUNyZWF0ZWQgPSB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICog5aSE55CGIEFwcHJvdmUg5Yqo5L2c5Zue5YaZXG4gICAqL1xuICBhc3luYyBoYW5kbGVBcHByb3ZlQWN0aW9uKFxuICAgIHNvdXJjZUlkOiBzdHJpbmcsXG4gICAgYWN0b3JJZD86IHN0cmluZ1xuICApOiBQcm9taXNlPHsgc3VjY2VzczogYm9vbGVhbjsgbWVzc2FnZTogc3RyaW5nIH0+IHtcbiAgICAvLyDop6PmnpAgc291cmNlSWQgKOagvOW8j++8mmNpcmNsZWNpX2FwcHJvdmFsOjxhcHByb3ZhbElkPilcbiAgICBjb25zdCBtYXRjaCA9IHNvdXJjZUlkLm1hdGNoKC9eY2lyY2xlY2lfYXBwcm92YWw6KC4rKSQvKTtcbiAgICBpZiAoIW1hdGNoKSB7XG4gICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ0ludmFsaWQgc291cmNlSWQgZm9ybWF0JyB9O1xuICAgIH1cblxuICAgIGNvbnN0IFssIGFwcHJvdmFsSWRdID0gbWF0Y2g7XG5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgdGhpcy5jaXJjbGVDSUNvbm5lY3Rvci5hcHByb3ZlSm9iKGFwcHJvdmFsSWQpO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBtZXNzYWdlOiBgQXBwcm92ZWQgQ2lyY2xlQ0kgam9iICR7YXBwcm92YWxJZH1gLFxuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIG1lc3NhZ2U6IGBGYWlsZWQgdG8gYXBwcm92ZTogJHtlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcil9YCxcbiAgICAgIH07XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOWkhOeQhiBSZWplY3Qg5Yqo5L2c5Zue5YaZXG4gICAqL1xuICBhc3luYyBoYW5kbGVSZWplY3RBY3Rpb24oXG4gICAgc291cmNlSWQ6IHN0cmluZyxcbiAgICBhY3RvcklkPzogc3RyaW5nLFxuICAgIHJlYXNvbj86IHN0cmluZ1xuICApOiBQcm9taXNlPHsgc3VjY2VzczogYm9vbGVhbjsgbWVzc2FnZTogc3RyaW5nIH0+IHtcbiAgICAvLyDop6PmnpAgc291cmNlSWRcbiAgICBjb25zdCBtYXRjaCA9IHNvdXJjZUlkLm1hdGNoKC9eY2lyY2xlY2lfYXBwcm92YWw6KC4rKSQvKTtcbiAgICBpZiAoIW1hdGNoKSB7XG4gICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ0ludmFsaWQgc291cmNlSWQgZm9ybWF0JyB9O1xuICAgIH1cblxuICAgIGNvbnN0IFssIGFwcHJvdmFsSWRdID0gbWF0Y2g7XG5cbiAgICB0cnkge1xuICAgICAgLy8gQ2lyY2xlQ0kg5rKh5pyJ55u05o6l55qEIHJlamVjdCBBUEnvvIzkvb/nlKggY2FuY2VsIOaIluagh+iusOS4uuWksei0pVxuICAgICAgYXdhaXQgdGhpcy5jaXJjbGVDSUNvbm5lY3Rvci5jb250aW51ZVdvcmtmbG93KGFwcHJvdmFsSWQpO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBtZXNzYWdlOiBgUmVqZWN0ZWQgQ2lyY2xlQ0kgYXBwcm92YWwgJHthcHByb3ZhbElkfTogJHtyZWFzb24gPz8gJ05vIHJlYXNvbiBwcm92aWRlZCd9YCxcbiAgICAgIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBtZXNzYWdlOiBgRmFpbGVkIHRvIHJlamVjdDogJHtlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcil9YCxcbiAgICAgIH07XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOWkhOeQhiBSZXJ1biDliqjkvZxcbiAgICovXG4gIGFzeW5jIGhhbmRsZVJlcnVuQWN0aW9uKFxuICAgIHNvdXJjZUlkOiBzdHJpbmdcbiAgKTogUHJvbWlzZTx7IHN1Y2Nlc3M6IGJvb2xlYW47IG1lc3NhZ2U6IHN0cmluZyB9PiB7XG4gICAgLy8g6Kej5p6QIHNvdXJjZUlkICjmoLzlvI/vvJpjaXJjbGVjaV93b3JrZmxvdzo8d29ya2Zsb3dJZD4pXG4gICAgY29uc3QgbWF0Y2ggPSBzb3VyY2VJZC5tYXRjaCgvXmNpcmNsZWNpX3dvcmtmbG93OiguKykkLyk7XG4gICAgaWYgKCFtYXRjaCkge1xuICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdJbnZhbGlkIHNvdXJjZUlkIGZvcm1hdCcgfTtcbiAgICB9XG5cbiAgICBjb25zdCBbLCB3b3JrZmxvd0lkXSA9IG1hdGNoO1xuXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMuY2lyY2xlQ0lDb25uZWN0b3IucmVydW5Xb3JrZmxvdyh3b3JrZmxvd0lkKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgbWVzc2FnZTogYFJlcnVuIENpcmNsZUNJIHdvcmtmbG93ICR7d29ya2Zsb3dJZH1gLFxuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIG1lc3NhZ2U6IGBGYWlsZWQgdG8gcmVydW46ICR7ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpfWAsXG4gICAgICB9O1xuICAgIH1cbiAgfVxufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDlt6XljoLlh73mlbBcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNpcmNsZUNJT3BlcmF0b3JCcmlkZ2UoXG4gIGV2ZW50QWRhcHRlcjogQ2lyY2xlQ0lFdmVudEFkYXB0ZXIsXG4gIGNpcmNsZUNJQ29ubmVjdG9yOiBDaXJjbGVDSUNvbm5lY3RvcixcbiAgY29uZmlnPzogQ2lyY2xlQ0lPcGVyYXRvckJyaWRnZUNvbmZpZ1xuKTogQ2lyY2xlQ0lPcGVyYXRvckJyaWRnZSB7XG4gIHJldHVybiBuZXcgQ2lyY2xlQ0lPcGVyYXRvckJyaWRnZShldmVudEFkYXB0ZXIsIGNpcmNsZUNJQ29ubmVjdG9yLCBjb25maWcpO1xufVxuIl19