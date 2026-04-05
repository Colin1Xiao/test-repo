"use strict";
/**
 * Jenkins Build Approval Bridge
 * Phase 2B-3A - Jenkins 构建审批桥接
 *
 * 职责：
 * - 将 Operator Approval 动作回写到 Jenkins
 * - approve → Approve Input Step
 * - reject → Abort Input Step
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.JenkinsBuildApprovalBridge = void 0;
exports.createJenkinsBuildApprovalBridge = createJenkinsBuildApprovalBridge;
// ============================================================================
// Jenkins Build Approval Bridge
// ============================================================================
class JenkinsBuildApprovalBridge {
    constructor(jenkinsConnector, config = {}) {
        this.config = {
            defaultApprovalComment: config.defaultApprovalComment ?? 'Approved via OpenClaw Operator',
            autoApproveJobs: config.autoApproveJobs ?? [],
        };
        this.jenkinsConnector = jenkinsConnector;
    }
    /**
     * 处理 Approve 动作
     */
    async handleApprove(sourceId, actorId) {
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
     * 处理 Reject 动作
     */
    async handleReject(sourceId, actorId, reason) {
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
}
exports.JenkinsBuildApprovalBridge = JenkinsBuildApprovalBridge;
// ============================================================================
// 工厂函数
// ============================================================================
function createJenkinsBuildApprovalBridge(jenkinsConnector, config) {
    return new JenkinsBuildApprovalBridge(jenkinsConnector, config);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiamVua2luc19idWlsZF9hcHByb3ZhbF9icmlkZ2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvY29ubmVjdG9ycy9qZW5raW5zL2plbmtpbnNfYnVpbGRfYXBwcm92YWxfYnJpZGdlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7R0FRRzs7O0FBcUdILDRFQUtDO0FBN0ZELCtFQUErRTtBQUMvRSxnQ0FBZ0M7QUFDaEMsK0VBQStFO0FBRS9FLE1BQWEsMEJBQTBCO0lBSXJDLFlBQ0UsZ0JBQWtDLEVBQ2xDLFNBQTJDLEVBQUU7UUFFN0MsSUFBSSxDQUFDLE1BQU0sR0FBRztZQUNaLHNCQUFzQixFQUFFLE1BQU0sQ0FBQyxzQkFBc0IsSUFBSSxnQ0FBZ0M7WUFDekYsZUFBZSxFQUFFLE1BQU0sQ0FBQyxlQUFlLElBQUksRUFBRTtTQUM5QyxDQUFDO1FBRUYsSUFBSSxDQUFDLGdCQUFnQixHQUFHLGdCQUFnQixDQUFDO0lBQzNDLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxhQUFhLENBQ2pCLFFBQWdCLEVBQ2hCLE9BQWdCO1FBRWhCLG1FQUFtRTtRQUNuRSxNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLGlDQUFpQyxDQUFDLENBQUM7UUFDaEUsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ1gsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLG9GQUFvRixFQUFFLENBQUM7UUFDM0gsQ0FBQztRQUVELE1BQU0sQ0FBQyxFQUFFLE9BQU8sRUFBRSxjQUFjLEVBQUUsT0FBTyxDQUFDLEdBQUcsS0FBSyxDQUFDO1FBQ25ELE1BQU0sV0FBVyxHQUFHLFFBQVEsQ0FBQyxjQUFjLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakQsSUFBSSxDQUFDO1lBQ0gsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsWUFBWSxDQUFDLE9BQU8sRUFBRSxXQUFXLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFFeEUsT0FBTztnQkFDTCxPQUFPLEVBQUUsSUFBSTtnQkFDYixPQUFPLEVBQUUsOEJBQThCLE9BQU8sV0FBVyxXQUFXLEVBQUU7YUFDdkUsQ0FBQztRQUNKLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2YsT0FBTztnQkFDTCxPQUFPLEVBQUUsS0FBSztnQkFDZCxPQUFPLEVBQUUsc0JBQXNCLEtBQUssWUFBWSxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsRUFBRTthQUN4RixDQUFDO1FBQ0osQ0FBQztJQUNILENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxZQUFZLENBQ2hCLFFBQWdCLEVBQ2hCLE9BQWdCLEVBQ2hCLE1BQWU7UUFFZixtRUFBbUU7UUFDbkUsTUFBTSxLQUFLLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDO1FBQ2hFLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNYLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxvRkFBb0YsRUFBRSxDQUFDO1FBQzNILENBQUM7UUFFRCxNQUFNLENBQUMsRUFBRSxPQUFPLEVBQUUsY0FBYyxFQUFFLE9BQU8sQ0FBQyxHQUFHLEtBQUssQ0FBQztRQUNuRCxNQUFNLFdBQVcsR0FBRyxRQUFRLENBQUMsY0FBYyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpELElBQUksQ0FBQztZQUNILE1BQU0sSUFBSSxDQUFDLGdCQUFnQixDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUUsV0FBVyxFQUFFLE9BQU8sRUFBRSxNQUFNLENBQUMsQ0FBQztZQUUvRSxPQUFPO2dCQUNMLE9BQU8sRUFBRSxJQUFJO2dCQUNiLE9BQU8sRUFBRSw4QkFBOEIsT0FBTyxXQUFXLFdBQVcsS0FBSyxNQUFNLElBQUksb0JBQW9CLEVBQUU7YUFDMUcsQ0FBQztRQUNKLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2YsT0FBTztnQkFDTCxPQUFPLEVBQUUsS0FBSztnQkFDZCxPQUFPLEVBQUUscUJBQXFCLEtBQUssWUFBWSxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsRUFBRTthQUN2RixDQUFDO1FBQ0osQ0FBQztJQUNILENBQUM7Q0FDRjtBQTlFRCxnRUE4RUM7QUFFRCwrRUFBK0U7QUFDL0UsT0FBTztBQUNQLCtFQUErRTtBQUUvRSxTQUFnQixnQ0FBZ0MsQ0FDOUMsZ0JBQWtDLEVBQ2xDLE1BQXlDO0lBRXpDLE9BQU8sSUFBSSwwQkFBMEIsQ0FBQyxnQkFBZ0IsRUFBRSxNQUFNLENBQUMsQ0FBQztBQUNsRSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBKZW5raW5zIEJ1aWxkIEFwcHJvdmFsIEJyaWRnZVxuICogUGhhc2UgMkItM0EgLSBKZW5raW5zIOaehOW7uuWuoeaJueahpeaOpVxuICogXG4gKiDogYzotKPvvJpcbiAqIC0g5bCGIE9wZXJhdG9yIEFwcHJvdmFsIOWKqOS9nOWbnuWGmeWIsCBKZW5raW5zXG4gKiAtIGFwcHJvdmUg4oaSIEFwcHJvdmUgSW5wdXQgU3RlcFxuICogLSByZWplY3Qg4oaSIEFib3J0IElucHV0IFN0ZXBcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IEplbmtpbnNDb25uZWN0b3IgfSBmcm9tICcuL2plbmtpbnNfY29ubmVjdG9yJztcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g6YWN572uXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBpbnRlcmZhY2UgSmVua2luc0J1aWxkQXBwcm92YWxCcmlkZ2VDb25maWcge1xuICBkZWZhdWx0QXBwcm92YWxDb21tZW50Pzogc3RyaW5nO1xuICBhdXRvQXBwcm92ZUpvYnM/OiBzdHJpbmdbXTtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gSmVua2lucyBCdWlsZCBBcHByb3ZhbCBCcmlkZ2Vcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGNsYXNzIEplbmtpbnNCdWlsZEFwcHJvdmFsQnJpZGdlIHtcbiAgcHJpdmF0ZSBjb25maWc6IFJlcXVpcmVkPEplbmtpbnNCdWlsZEFwcHJvdmFsQnJpZGdlQ29uZmlnPjtcbiAgcHJpdmF0ZSBqZW5raW5zQ29ubmVjdG9yOiBKZW5raW5zQ29ubmVjdG9yO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIGplbmtpbnNDb25uZWN0b3I6IEplbmtpbnNDb25uZWN0b3IsXG4gICAgY29uZmlnOiBKZW5raW5zQnVpbGRBcHByb3ZhbEJyaWRnZUNvbmZpZyA9IHt9XG4gICkge1xuICAgIHRoaXMuY29uZmlnID0ge1xuICAgICAgZGVmYXVsdEFwcHJvdmFsQ29tbWVudDogY29uZmlnLmRlZmF1bHRBcHByb3ZhbENvbW1lbnQgPz8gJ0FwcHJvdmVkIHZpYSBPcGVuQ2xhdyBPcGVyYXRvcicsXG4gICAgICBhdXRvQXBwcm92ZUpvYnM6IGNvbmZpZy5hdXRvQXBwcm92ZUpvYnMgPz8gW10sXG4gICAgfTtcblxuICAgIHRoaXMuamVua2luc0Nvbm5lY3RvciA9IGplbmtpbnNDb25uZWN0b3I7XG4gIH1cblxuICAvKipcbiAgICog5aSE55CGIEFwcHJvdmUg5Yqo5L2cXG4gICAqL1xuICBhc3luYyBoYW5kbGVBcHByb3ZlKFxuICAgIHNvdXJjZUlkOiBzdHJpbmcsXG4gICAgYWN0b3JJZD86IHN0cmluZ1xuICApOiBQcm9taXNlPHsgc3VjY2VzczogYm9vbGVhbjsgbWVzc2FnZTogc3RyaW5nIH0+IHtcbiAgICAvLyDop6PmnpAgc291cmNlSWQgKOagvOW8j++8mmplbmtpbnNfaW5wdXQ6PGpvYk5hbWU+OjxidWlsZE51bWJlcj46PGlucHV0SWQ+KVxuICAgIGNvbnN0IG1hdGNoID0gc291cmNlSWQubWF0Y2goL15qZW5raW5zX2lucHV0OiguKyk6KFxcZCspOiguKykkLyk7XG4gICAgaWYgKCFtYXRjaCkge1xuICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdJbnZhbGlkIHNvdXJjZUlkIGZvcm1hdC4gRXhwZWN0ZWQ6IGplbmtpbnNfaW5wdXQ6PGpvYk5hbWU+OjxidWlsZE51bWJlcj46PGlucHV0SWQ+JyB9O1xuICAgIH1cblxuICAgIGNvbnN0IFssIGpvYk5hbWUsIGJ1aWxkTnVtYmVyU3RyLCBpbnB1dElkXSA9IG1hdGNoO1xuICAgIGNvbnN0IGJ1aWxkTnVtYmVyID0gcGFyc2VJbnQoYnVpbGROdW1iZXJTdHIsIDEwKTtcblxuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLmplbmtpbnNDb25uZWN0b3IuYXBwcm92ZUlucHV0KGpvYk5hbWUsIGJ1aWxkTnVtYmVyLCBpbnB1dElkKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgbWVzc2FnZTogYEFwcHJvdmVkIEplbmtpbnMgaW5wdXQgZm9yICR7am9iTmFtZX0gYnVpbGQgIyR7YnVpbGROdW1iZXJ9YCxcbiAgICAgIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBtZXNzYWdlOiBgRmFpbGVkIHRvIGFwcHJvdmU6ICR7ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpfWAsXG4gICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDlpITnkIYgUmVqZWN0IOWKqOS9nFxuICAgKi9cbiAgYXN5bmMgaGFuZGxlUmVqZWN0KFxuICAgIHNvdXJjZUlkOiBzdHJpbmcsXG4gICAgYWN0b3JJZD86IHN0cmluZyxcbiAgICByZWFzb24/OiBzdHJpbmdcbiAgKTogUHJvbWlzZTx7IHN1Y2Nlc3M6IGJvb2xlYW47IG1lc3NhZ2U6IHN0cmluZyB9PiB7XG4gICAgLy8g6Kej5p6QIHNvdXJjZUlkICjmoLzlvI/vvJpqZW5raW5zX2lucHV0Ojxqb2JOYW1lPjo8YnVpbGROdW1iZXI+OjxpbnB1dElkPilcbiAgICBjb25zdCBtYXRjaCA9IHNvdXJjZUlkLm1hdGNoKC9eamVua2luc19pbnB1dDooLispOihcXGQrKTooLispJC8pO1xuICAgIGlmICghbWF0Y2gpIHtcbiAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnSW52YWxpZCBzb3VyY2VJZCBmb3JtYXQuIEV4cGVjdGVkOiBqZW5raW5zX2lucHV0Ojxqb2JOYW1lPjo8YnVpbGROdW1iZXI+OjxpbnB1dElkPicgfTtcbiAgICB9XG5cbiAgICBjb25zdCBbLCBqb2JOYW1lLCBidWlsZE51bWJlclN0ciwgaW5wdXRJZF0gPSBtYXRjaDtcbiAgICBjb25zdCBidWlsZE51bWJlciA9IHBhcnNlSW50KGJ1aWxkTnVtYmVyU3RyLCAxMCk7XG5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgdGhpcy5qZW5raW5zQ29ubmVjdG9yLnJlamVjdElucHV0KGpvYk5hbWUsIGJ1aWxkTnVtYmVyLCBpbnB1dElkLCByZWFzb24pO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBtZXNzYWdlOiBgUmVqZWN0ZWQgSmVua2lucyBpbnB1dCBmb3IgJHtqb2JOYW1lfSBidWlsZCAjJHtidWlsZE51bWJlcn06ICR7cmVhc29uID8/ICdObyByZWFzb24gcHJvdmlkZWQnfWAsXG4gICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgbWVzc2FnZTogYEZhaWxlZCB0byByZWplY3Q6ICR7ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpfWAsXG4gICAgICB9O1xuICAgIH1cbiAgfVxufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDlt6XljoLlh73mlbBcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUplbmtpbnNCdWlsZEFwcHJvdmFsQnJpZGdlKFxuICBqZW5raW5zQ29ubmVjdG9yOiBKZW5raW5zQ29ubmVjdG9yLFxuICBjb25maWc/OiBKZW5raW5zQnVpbGRBcHByb3ZhbEJyaWRnZUNvbmZpZ1xuKTogSmVua2luc0J1aWxkQXBwcm92YWxCcmlkZ2Uge1xuICByZXR1cm4gbmV3IEplbmtpbnNCdWlsZEFwcHJvdmFsQnJpZGdlKGplbmtpbnNDb25uZWN0b3IsIGNvbmZpZyk7XG59XG4iXX0=