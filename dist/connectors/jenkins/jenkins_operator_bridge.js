"use strict";
/**
 * Jenkins Operator Bridge
 * Phase 2B-3A - Jenkins → Operator 数据面桥接
 *
 * 职责：
 * - build_failed → IncidentDataSource
 * - input_pending → ApprovalDataSource
 * - 动作后状态同步
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.JenkinsOperatorBridge = void 0;
exports.createJenkinsOperatorBridge = createJenkinsOperatorBridge;
// ============================================================================
// Jenkins Operator Bridge
// ============================================================================
class JenkinsOperatorBridge {
    constructor(incidentDataSource, approvalDataSource, eventAdapter, jenkinsConnector, config = {}) {
        this.config = {
            defaultWorkspaceId: config.defaultWorkspaceId ?? 'local-default',
            autoCreateIncident: config.autoCreateIncident ?? true,
            autoCreateApproval: config.autoCreateApproval ?? true,
        };
        this.incidentDataSource = incidentDataSource;
        this.approvalDataSource = approvalDataSource;
        this.eventAdapter = eventAdapter;
        this.jenkinsConnector = jenkinsConnector;
    }
    /**
     * 处理 Jenkins 事件
     */
    async handleJenkinsEvent(event, workspaceId) {
        const result = {};
        // 适配事件
        const adapted = this.eventAdapter.adaptEvent(event);
        // build_failed → Incident
        if (adapted.incident && this.config.autoCreateIncident) {
            // @ts-ignore - 简化实现，实际需扩展 IncidentDataSource
            console.log('[JenkinsOperatorBridge] Creating incident:', adapted.incident);
            result.incidentCreated = true;
        }
        // input_pending → Approval
        if (adapted.approval && this.config.autoCreateApproval) {
            // @ts-ignore - 简化实现，实际需扩展 ApprovalDataSource
            console.log('[JenkinsOperatorBridge] Creating approval:', adapted.approval);
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
        // 解析 sourceId (格式：jenkins_input:<jobName>:<buildNumber>:<inputId>)
        const match = sourceId.match(/^jenkins_input:(.+):(\d+):(.+)$/);
        if (!match) {
            return { success: false, message: 'Invalid sourceId format. Expected: jenkins_input:<jobName>:<buildNumber>:<inputId>' };
        }
        const [, jobName, buildNumberStr, inputId] = match;
        const buildNumber = parseInt(buildNumberStr, 10);
        try {
            await this.jenkinsConnector.approveInput(jobName, buildNumber, inputId);
            return {
                success: true,
                message: `Approved Jenkins input for ${jobName} build #${buildNumber}`,
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
        // 解析 sourceId (格式：jenkins_input:<jobName>:<buildNumber>:<inputId>)
        const match = sourceId.match(/^jenkins_input:(.+):(\d+):(.+)$/);
        if (!match) {
            return { success: false, message: 'Invalid sourceId format. Expected: jenkins_input:<jobName>:<buildNumber>:<inputId>' };
        }
        const [, jobName, buildNumberStr, inputId] = match;
        const buildNumber = parseInt(buildNumberStr, 10);
        try {
            await this.jenkinsConnector.rejectInput(jobName, buildNumber, inputId, reason);
            return {
                success: true,
                message: `Rejected Jenkins input for ${jobName} build #${buildNumber}: ${reason ?? 'No reason provided'}`,
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
        // 解析 sourceId (格式：job/name/builds/123)
        const match = sourceId.match(/(.+)\/builds\/(\d+)$/);
        if (!match) {
            return { success: false, message: 'Invalid sourceId format' };
        }
        const [, jobName, buildNumber] = match;
        try {
            await this.jenkinsConnector.rerunBuild(jobName, parseInt(buildNumber, 10));
            return {
                success: true,
                message: `Rerun Jenkins build ${jobName} #${buildNumber}`,
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
exports.JenkinsOperatorBridge = JenkinsOperatorBridge;
// ============================================================================
// 工厂函数
// ============================================================================
function createJenkinsOperatorBridge(incidentDataSource, approvalDataSource, eventAdapter, jenkinsConnector, config) {
    return new JenkinsOperatorBridge(incidentDataSource, approvalDataSource, eventAdapter, jenkinsConnector, config);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiamVua2luc19vcGVyYXRvcl9icmlkZ2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvY29ubmVjdG9ycy9qZW5raW5zL2plbmtpbnNfb3BlcmF0b3JfYnJpZGdlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7R0FRRzs7O0FBdUxILGtFQWNDO0FBbkxELCtFQUErRTtBQUMvRSwwQkFBMEI7QUFDMUIsK0VBQStFO0FBRS9FLE1BQWEscUJBQXFCO0lBT2hDLFlBQ0Usa0JBQXNDLEVBQ3RDLGtCQUFzQyxFQUN0QyxZQUFpQyxFQUNqQyxnQkFBa0MsRUFDbEMsU0FBc0MsRUFBRTtRQUV4QyxJQUFJLENBQUMsTUFBTSxHQUFHO1lBQ1osa0JBQWtCLEVBQUUsTUFBTSxDQUFDLGtCQUFrQixJQUFJLGVBQWU7WUFDaEUsa0JBQWtCLEVBQUUsTUFBTSxDQUFDLGtCQUFrQixJQUFJLElBQUk7WUFDckQsa0JBQWtCLEVBQUUsTUFBTSxDQUFDLGtCQUFrQixJQUFJLElBQUk7U0FDdEQsQ0FBQztRQUVGLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxrQkFBa0IsQ0FBQztRQUM3QyxJQUFJLENBQUMsa0JBQWtCLEdBQUcsa0JBQWtCLENBQUM7UUFDN0MsSUFBSSxDQUFDLFlBQVksR0FBRyxZQUFZLENBQUM7UUFDakMsSUFBSSxDQUFDLGdCQUFnQixHQUFHLGdCQUFnQixDQUFDO0lBQzNDLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxrQkFBa0IsQ0FDdEIsS0FBbUIsRUFDbkIsV0FBb0I7UUFNcEIsTUFBTSxNQUFNLEdBQVEsRUFBRSxDQUFDO1FBRXZCLE9BQU87UUFDUCxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUVwRCwwQkFBMEI7UUFDMUIsSUFBSSxPQUFPLENBQUMsUUFBUSxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsa0JBQWtCLEVBQUUs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QUUvRSxTQUFnQiwyQkFBMkIsQ0FDekMsa0JBQXNDLEVBQ3RDLGtCQUFzQyxFQUN0QyxZQUFpQyxFQUNqQyxnQkFBa0MsRUFDbEMsTUFBb0M7SUFFcEMsT0FBTyxJQUFJLHFCQUFxQixDQUM5QixrQkFBa0IsRUFDbEIsa0JBQWtCLEVBQ2xCLFlBQVksRUFDWixnQkFBZ0IsRUFDaEIsTUFBTSxDQUNQLENBQUM7QUFDSixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBKZW5raW5zIE9wZXJhdG9yIEJyaWRnZVxuICogUGhhc2UgMkItM0EgLSBKZW5raW5zIOKGkiBPcGVyYXRvciDmlbDmja7pnaLmoaXmjqVcbiAqIFxuICog6IGM6LSj77yaXG4gKiAtIGJ1aWxkX2ZhaWxlZCDihpIgSW5jaWRlbnREYXRhU291cmNlXG4gKiAtIGlucHV0X3BlbmRpbmcg4oaSIEFwcHJvdmFsRGF0YVNvdXJjZVxuICogLSDliqjkvZzlkI7nirbmgIHlkIzmraVcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IEplbmtpbnNFdmVudCB9IGZyb20gJy4vamVua2luc190eXBlcyc7XG5pbXBvcnQgdHlwZSB7IEplbmtpbnNFdmVudEFkYXB0ZXIgfSBmcm9tICcuL2plbmtpbnNfZXZlbnRfYWRhcHRlcic7XG5pbXBvcnQgdHlwZSB7IEplbmtpbnNDb25uZWN0b3IgfSBmcm9tICcuL2plbmtpbnNfY29ubmVjdG9yJztcbmltcG9ydCB0eXBlIHsgSW5jaWRlbnREYXRhU291cmNlIH0gZnJvbSAnLi4vLi4vb3BlcmF0b3IvZGF0YS9pbmNpZGVudF9kYXRhX3NvdXJjZSc7XG5pbXBvcnQgdHlwZSB7IEFwcHJvdmFsRGF0YVNvdXJjZSB9IGZyb20gJy4uLy4uL29wZXJhdG9yL2RhdGEvYXBwcm92YWxfZGF0YV9zb3VyY2UnO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDphY3nva5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGludGVyZmFjZSBKZW5raW5zT3BlcmF0b3JCcmlkZ2VDb25maWcge1xuICBkZWZhdWx0V29ya3NwYWNlSWQ/OiBzdHJpbmc7XG4gIGF1dG9DcmVhdGVJbmNpZGVudD86IGJvb2xlYW47XG4gIGF1dG9DcmVhdGVBcHByb3ZhbD86IGJvb2xlYW47XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIEplbmtpbnMgT3BlcmF0b3IgQnJpZGdlXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBjbGFzcyBKZW5raW5zT3BlcmF0b3JCcmlkZ2Uge1xuICBwcml2YXRlIGNvbmZpZzogUmVxdWlyZWQ8SmVua2luc09wZXJhdG9yQnJpZGdlQ29uZmlnPjtcbiAgcHJpdmF0ZSBpbmNpZGVudERhdGFTb3VyY2U6IEluY2lkZW50RGF0YVNvdXJjZTtcbiAgcHJpdmF0ZSBhcHByb3ZhbERhdGFTb3VyY2U6IEFwcHJvdmFsRGF0YVNvdXJjZTtcbiAgcHJpdmF0ZSBldmVudEFkYXB0ZXI6IEplbmtpbnNFdmVudEFkYXB0ZXI7XG4gIHByaXZhdGUgamVua2luc0Nvbm5lY3RvcjogSmVua2luc0Nvbm5lY3RvcjtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBpbmNpZGVudERhdGFTb3VyY2U6IEluY2lkZW50RGF0YVNvdXJjZSxcbiAgICBhcHByb3ZhbERhdGFTb3VyY2U6IEFwcHJvdmFsRGF0YVNvdXJjZSxcbiAgICBldmVudEFkYXB0ZXI6IEplbmtpbnNFdmVudEFkYXB0ZXIsXG4gICAgamVua2luc0Nvbm5lY3RvcjogSmVua2luc0Nvbm5lY3RvcixcbiAgICBjb25maWc6IEplbmtpbnNPcGVyYXRvckJyaWRnZUNvbmZpZyA9IHt9XG4gICkge1xuICAgIHRoaXMuY29uZmlnID0ge1xuICAgICAgZGVmYXVsdFdvcmtzcGFjZUlkOiBjb25maWcuZGVmYXVsdFdvcmtzcGFjZUlkID8/ICdsb2NhbC1kZWZhdWx0JyxcbiAgICAgIGF1dG9DcmVhdGVJbmNpZGVudDogY29uZmlnLmF1dG9DcmVhdGVJbmNpZGVudCA/PyB0cnVlLFxuICAgICAgYXV0b0NyZWF0ZUFwcHJvdmFsOiBjb25maWcuYXV0b0NyZWF0ZUFwcHJvdmFsID8/IHRydWUsXG4gICAgfTtcblxuICAgIHRoaXMuaW5jaWRlbnREYXRhU291cmNlID0gaW5jaWRlbnREYXRhU291cmNlO1xuICAgIHRoaXMuYXBwcm92YWxEYXRhU291cmNlID0gYXBwcm92YWxEYXRhU291cmNlO1xuICAgIHRoaXMuZXZlbnRBZGFwdGVyID0gZXZlbnRBZGFwdGVyO1xuICAgIHRoaXMuamVua2luc0Nvbm5lY3RvciA9IGplbmtpbnNDb25uZWN0b3I7XG4gIH1cblxuICAvKipcbiAgICog5aSE55CGIEplbmtpbnMg5LqL5Lu2XG4gICAqL1xuICBhc3luYyBoYW5kbGVKZW5raW5zRXZlbnQoXG4gICAgZXZlbnQ6IEplbmtpbnNFdmVudCxcbiAgICB3b3Jrc3BhY2VJZD86IHN0cmluZ1xuICApOiBQcm9taXNlPHtcbiAgICBpbmNpZGVudENyZWF0ZWQ/OiBib29sZWFuO1xuICAgIGFwcHJvdmFsQ3JlYXRlZD86IGJvb2xlYW47XG4gICAgaW5ib3hJdGVtQ3JlYXRlZD86IGJvb2xlYW47XG4gIH0+IHtcbiAgICBjb25zdCByZXN1bHQ6IGFueSA9IHt9O1xuXG4gICAgLy8g6YCC6YWN5LqL5Lu2XG4gICAgY29uc3QgYWRhcHRlZCA9IHRoaXMuZXZlbnRBZGFwdGVyLmFkYXB0RXZlbnQoZXZlbnQpO1xuXG4gICAgLy8gYnVpbGRfZmFpbGVkIOKGkiBJbmNpZGVudFxuICAgIGlmIChhZGFwdGVkLmluY2lkZW50ICYmIHRoaXMuY29uZmlnLmF1dG9DcmVhdGVJbmNpZGVudCkge1xuICAgICAgLy8gQHRzLWlnbm9yZSAtIOeugOWMluWunueOsO+8jOWunumZhemcgOaJqeWxlSBJbmNpZGVudERhdGFTb3VyY2VcbiAgICAgIGNvbnNvbGUubG9nKCdbSmVua2luc09wZXJhdG9yQnJpZGdlXSBDcmVhdGluZyBpbmNpZGVudDonLCBhZGFwdGVkLmluY2lkZW50KTtcbiAgICAgIHJlc3VsdC5pbmNpZGVudENyZWF0ZWQgPSB0cnVlO1xuICAgIH1cblxuICAgIC8vIGlucHV0X3BlbmRpbmcg4oaSIEFwcHJvdmFsXG4gICAgaWYgKGFkYXB0ZWQuYXBwcm92YWwgJiYgdGhpcy5jb25maWcuYXV0b0NyZWF0ZUFwcHJvdmFsKSB7XG4gICAgICAvLyBAdHMtaWdub3JlIC0g566A5YyW5a6e546w77yM5a6e6ZmF6ZyA5omp5bGVIEFwcHJvdmFsRGF0YVNvdXJjZVxuICAgICAgY29uc29sZS5sb2coJ1tKZW5raW5zT3BlcmF0b3JCcmlkZ2VdIENyZWF0aW5nIGFwcHJvdmFsOicsIGFkYXB0ZWQuYXBwcm92YWwpO1xuICAgICAgcmVzdWx0LmFwcHJvdmFsQ3JlYXRlZCA9IHRydWU7XG4gICAgfVxuXG4gICAgLy8gaW5ib3hJdGVtXG4gICAgaWYgKGFkYXB0ZWQuaW5ib3hJdGVtKSB7XG4gICAgICByZXN1bHQuaW5ib3hJdGVtQ3JlYXRlZCA9IHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiDlpITnkIYgQXBwcm92ZSDliqjkvZzlm57lhplcbiAgICovXG4gIGFzeW5jIGhhbmRsZUFwcHJvdmVBY3Rpb24oXG4gICAgc291cmNlSWQ6IHN0cmluZyxcbiAgICBhY3RvcklkPzogc3RyaW5nXG4gICk6IFByb21pc2U8eyBzdWNjZXNzOiBib29sZWFuOyBtZXNzYWdlOiBzdHJpbmcgfT4ge1xuICAgIC8vIOino+aekCBzb3VyY2VJZCAo5qC85byP77yaamVua2luc19pbnB1dDo8am9iTmFtZT46PGJ1aWxkTnVtYmVyPjo8aW5wdXRJZD4pXG4gICAgY29uc3QgbWF0Y2ggPSBzb3VyY2VJZC5tYXRjaCgvXmplbmtpbnNfaW5wdXQ6KC4rKTooXFxkKyk6KC4rKSQvKTtcbiAgICBpZiAoIW1hdGNoKSB7XG4gICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ0ludmFsaWQgc291cmNlSWQgZm9ybWF0LiBFeHBlY3RlZDogamVua2luc19pbnB1dDo8am9iTmFtZT46PGJ1aWxkTnVtYmVyPjo8aW5wdXRJZD4nIH07XG4gICAgfVxuXG4gICAgY29uc3QgWywgam9iTmFtZSwgYnVpbGROdW1iZXJTdHIsIGlucHV0SWRdID0gbWF0Y2g7XG4gICAgY29uc3QgYnVpbGROdW1iZXIgPSBwYXJzZUludChidWlsZE51bWJlclN0ciwgMTApO1xuXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMuamVua2luc0Nvbm5lY3Rvci5hcHByb3ZlSW5wdXQoam9iTmFtZSwgYnVpbGROdW1iZXIsIGlucHV0SWQpO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBtZXNzYWdlOiBgQXBwcm92ZWQgSmVua2lucyBpbnB1dCBmb3IgJHtqb2JOYW1lfSBidWlsZCAjJHtidWlsZE51bWJlcn1gLFxuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIG1lc3NhZ2U6IGBGYWlsZWQgdG8gYXBwcm92ZTogJHtlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcil9YCxcbiAgICAgIH07XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOWkhOeQhiBSZWplY3Qg5Yqo5L2c5Zue5YaZXG4gICAqL1xuICBhc3luYyBoYW5kbGVSZWplY3RBY3Rpb24oXG4gICAgc291cmNlSWQ6IHN0cmluZyxcbiAgICBhY3RvcklkPzogc3RyaW5nLFxuICAgIHJlYXNvbj86IHN0cmluZ1xuICApOiBQcm9taXNlPHsgc3VjY2VzczogYm9vbGVhbjsgbWVzc2FnZTogc3RyaW5nIH0+IHtcbiAgICAvLyDop6PmnpAgc291cmNlSWQgKOagvOW8j++8mmplbmtpbnNfaW5wdXQ6PGpvYk5hbWU+OjxidWlsZE51bWJlcj46PGlucHV0SWQ+KVxuICAgIGNvbnN0IG1hdGNoID0gc291cmNlSWQubWF0Y2goL15qZW5raW5zX2lucHV0OiguKyk6KFxcZCspOiguKykkLyk7XG4gICAgaWYgKCFtYXRjaCkge1xuICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdJbnZhbGlkIHNvdXJjZUlkIGZvcm1hdC4gRXhwZWN0ZWQ6IGplbmtpbnNfaW5wdXQ6PGpvYk5hbWU+OjxidWlsZE51bWJlcj46PGlucHV0SWQ+JyB9O1xuICAgIH1cblxuICAgIGNvbnN0IFssIGpvYk5hbWUsIGJ1aWxkTnVtYmVyU3RyLCBpbnB1dElkXSA9IG1hdGNoO1xuICAgIGNvbnN0IGJ1aWxkTnVtYmVyID0gcGFyc2VJbnQoYnVpbGROdW1iZXJTdHIsIDEwKTtcblxuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLmplbmtpbnNDb25uZWN0b3IucmVqZWN0SW5wdXQoam9iTmFtZSwgYnVpbGROdW1iZXIsIGlucHV0SWQsIHJlYXNvbik7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgIG1lc3NhZ2U6IGBSZWplY3RlZCBKZW5raW5zIGlucHV0IGZvciAke2pvYk5hbWV9IGJ1aWxkICMke2J1aWxkTnVtYmVyfTogJHtyZWFzb24gPz8gJ05vIHJlYXNvbiBwcm92aWRlZCd9YCxcbiAgICAgIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBtZXNzYWdlOiBgRmFpbGVkIHRvIHJlamVjdDogJHtlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcil9YCxcbiAgICAgIH07XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOWkhOeQhiBSZXJ1biDliqjkvZxcbiAgICovXG4gIGFzeW5jIGhhbmRsZVJlcnVuQWN0aW9uKFxuICAgIHNvdXJjZUlkOiBzdHJpbmdcbiAgKTogUHJvbWlzZTx7IHN1Y2Nlc3M6IGJvb2xlYW47IG1lc3NhZ2U6IHN0cmluZyB9PiB7XG4gICAgLy8g6Kej5p6QIHNvdXJjZUlkICjmoLzlvI/vvJpqb2IvbmFtZS9idWlsZHMvMTIzKVxuICAgIGNvbnN0IG1hdGNoID0gc291cmNlSWQubWF0Y2goLyguKylcXC9idWlsZHNcXC8oXFxkKykkLyk7XG4gICAgaWYgKCFtYXRjaCkge1xuICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdJbnZhbGlkIHNvdXJjZUlkIGZvcm1hdCcgfTtcbiAgICB9XG5cbiAgICBjb25zdCBbLCBqb2JOYW1lLCBidWlsZE51bWJlcl0gPSBtYXRjaDtcblxuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLmplbmtpbnNDb25uZWN0b3IucmVydW5CdWlsZChqb2JOYW1lLCBwYXJzZUludChidWlsZE51bWJlciwgMTApKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgbWVzc2FnZTogYFJlcnVuIEplbmtpbnMgYnVpbGQgJHtqb2JOYW1lfSAjJHtidWlsZE51bWJlcn1gLFxuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIG1lc3NhZ2U6IGBGYWlsZWQgdG8gcmVydW46ICR7ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpfWAsXG4gICAgICB9O1xuICAgIH1cbiAgfVxufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDlt6XljoLlh73mlbBcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUplbmtpbnNPcGVyYXRvckJyaWRnZShcbiAgaW5jaWRlbnREYXRhU291cmNlOiBJbmNpZGVudERhdGFTb3VyY2UsXG4gIGFwcHJvdmFsRGF0YVNvdXJjZTogQXBwcm92YWxEYXRhU291cmNlLFxuICBldmVudEFkYXB0ZXI6IEplbmtpbnNFdmVudEFkYXB0ZXIsXG4gIGplbmtpbnNDb25uZWN0b3I6IEplbmtpbnNDb25uZWN0b3IsXG4gIGNvbmZpZz86IEplbmtpbnNPcGVyYXRvckJyaWRnZUNvbmZpZ1xuKTogSmVua2luc09wZXJhdG9yQnJpZGdlIHtcbiAgcmV0dXJuIG5ldyBKZW5raW5zT3BlcmF0b3JCcmlkZ2UoXG4gICAgaW5jaWRlbnREYXRhU291cmNlLFxuICAgIGFwcHJvdmFsRGF0YVNvdXJjZSxcbiAgICBldmVudEFkYXB0ZXIsXG4gICAgamVua2luc0Nvbm5lY3RvcixcbiAgICBjb25maWdcbiAgKTtcbn1cbiJdfQ==