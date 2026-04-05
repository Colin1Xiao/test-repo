"use strict";
/**
 * Deployment Approval Bridge
 * Phase 2B-2 - 部署审批桥接
 *
 * 职责：
 * - 将 Operator Approval 动作回写到 GitHub Deployment
 * - approve → Approve Deployment
 * - reject → Reject Deployment
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeploymentApprovalBridge = void 0;
exports.createDeploymentApprovalBridge = createDeploymentApprovalBridge;
// ============================================================================
// Deployment Approval Bridge
// ============================================================================
class DeploymentApprovalBridge {
    constructor(githubConnector, config = {}) {
        this.config = {
            defaultApprovalComment: config.defaultApprovalComment ?? 'Approved via OpenClaw Operator',
            autoApproveStaging: config.autoApproveStaging ?? false,
        };
        this.githubConnector = githubConnector;
    }
    /**
     * 处理 Approve 动作
     */
    async handleApprove(sourceId, deploymentId, actorId, environment) {
        // 解析 sourceId (格式：owner/repo/deployments/id)
        const match = sourceId.match(/^(.+)\/(.+)\/deployments\/(\d+)$/);
        if (!match) {
            return { success: false, message: 'Invalid sourceId format' };
        }
        const [, owner, repo] = match;
        try {
            // 调用 GitHub API 批准部署
            await this.githubConnector.approveDeployment(owner, repo, deploymentId, this.config.defaultApprovalComment);
            return {
                success: true,
                message: `Approved deployment to ${environment ?? 'unknown'}`,
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to approve deployment: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }
    /**
     * 处理 Reject 动作
     */
    async handleReject(sourceId, deploymentId, actorId, reason, environment) {
        // 解析 sourceId
        const match = sourceId.match(/^(.+)\/(.+)\/deployments\/(\d+)$/);
        if (!match) {
            return { success: false, message: 'Invalid sourceId format' };
        }
        const [, owner, repo] = match;
        try {
            // 调用 GitHub API 拒绝部署
            await this.githubConnector.rejectDeployment(owner, repo, deploymentId, reason ?? 'Rejected via OpenClaw Operator');
            return {
                success: true,
                message: `Rejected deployment to ${environment ?? 'unknown'}: ${reason ?? 'No reason provided'}`,
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to reject deployment: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }
}
exports.DeploymentApprovalBridge = DeploymentApprovalBridge;
// ============================================================================
// 工厂函数
// ============================================================================
function createDeploymentApprovalBridge(githubConnector, config) {
    return new DeploymentApprovalBridge(githubConnector, config);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVwbG95bWVudF9hcHByb3ZhbF9icmlkZ2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvY29ubmVjdG9ycy9naXRodWItYWN0aW9ucy9kZXBsb3ltZW50X2FwcHJvdmFsX2JyaWRnZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7O0dBUUc7OztBQW1ISCx3RUFLQztBQTNHRCwrRUFBK0U7QUFDL0UsNkJBQTZCO0FBQzdCLCtFQUErRTtBQUUvRSxNQUFhLHdCQUF3QjtJQUluQyxZQUNFLGVBQXVDLEVBQ3ZDLFNBQXlDLEVBQUU7UUFFM0MsSUFBSSxDQUFDLE1BQU0sR0FBRztZQUNaLHNCQUFzQixFQUFFLE1BQU0sQ0FBQyxzQkFBc0IsSUFBSSxnQ0FBZ0M7WUFDekYsa0JBQWtCLEVBQUUsTUFBTSxDQUFDLGtCQUFrQixJQUFJLEtBQUs7U0FDdkQsQ0FBQztRQUVGLElBQUksQ0FBQyxlQUFlLEdBQUcsZUFBZSxDQUFDO0lBQ3pDLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxhQUFhLENBQ2pCLFFBQWdCLEVBQ2hCLFlBQW9CLEVBQ3BCLE9BQWdCLEVBQ2hCLFdBQW9CO1FBRXBCLDZDQUE2QztRQUM3QyxNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLGtDQUFrQyxDQUFDLENBQUM7UUFDakUsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ1gsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLHlCQUF5QixFQUFFLENBQUM7UUFDaEUsQ0FBQztRQUVELE1BQU0sQ0FBQyxFQUFFLEtBQUssRUFBRSxJQUFJLENBQUMsR0FBRyxLQUFLLENBQUM7UUFFOUIsSUFBSSxDQUFDO1lBQ0gscUJBQXFCO1lBQ3JCLE1BQU0sSUFBSSxDQUFDLGVBQWUsQ0FBQyxpQkFBaUIsQ0FDMUMsS0FBSyxFQUNMLElBQUksRUFDSixZQUFZLEVBQ1osSUFBSSxDQUFDLE1BQU0sQ0FBQyxzQkFBc0IsQ0FDbkMsQ0FBQztZQUVGLE9BQU87Z0JBQ0wsT0FBTyxFQUFFLElBQUk7Z0JBQ2IsT0FBTyxFQUFFLDBCQUEwQixXQUFXLElBQUksU0FBUyxFQUFFO2FBQzlELENBQUM7UUFDSixDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNmLE9BQU87Z0JBQ0wsT0FBTyxFQUFFLEtBQUs7Z0JBQ2QsT0FBTyxFQUFFLGlDQUFpQyxLQUFLLFlBQVksS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEVBQUU7YUFDbkcsQ0FBQztRQUNKLENBQUM7SUFDSCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsWUFBWSxDQUNoQixRQUFnQixFQUNoQixZQUFvQixFQUNwQixPQUFnQixFQUNoQixNQUFlLEVBQ2YsV0FBb0I7UUFFcEIsY0FBYztRQUNkLE1BQU0sS0FBSyxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsa0NBQWtDLENBQUMsQ0FBQztRQUNqRSxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDWCxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUseUJBQXlCLEVBQUUsQ0FBQztRQUNoRSxDQUFDO1FBRUQsTUFBTSxDQUFDLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQyxHQUFHLEtBQUssQ0FBQztRQUU5QixJQUFJLENBQUM7WUFDSCxxQkFBcUI7WUFDckIsTUFBTSxJQUFJLENBQUMsZUFBZSxDQUFDLGdCQUFnQixDQUN6QyxLQUFLLEVBQ0wsSUFBSSxFQUNKLFlBQVksRUFDWixNQUFNLElBQUksZ0NBQWdDLENBQzNDLENBQUM7WUFFRixPQUFPO2dCQUNMLE9BQU8sRUFBRSxJQUFJO2dCQUNiLE9BQU8sRUFBRSwwQkFBMEIsV0FBVyxJQUFJLFNBQVMsS0FBSyxNQUFNLElBQUksb0JBQW9CLEVBQUU7YUFDakcsQ0FBQztRQUNKLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2YsT0FBTztnQkFDTCxPQUFPLEVBQUUsS0FBSztnQkFDZCxPQUFPLEVBQUUsZ0NBQWdDLEtBQUssWUFBWSxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsRUFBRTthQUNsRyxDQUFDO1FBQ0osQ0FBQztJQUNILENBQUM7Q0FDRjtBQTVGRCw0REE0RkM7QUFFRCwrRUFBK0U7QUFDL0UsT0FBTztBQUNQLCtFQUErRTtBQUUvRSxTQUFnQiw4QkFBOEIsQ0FDNUMsZUFBdUMsRUFDdkMsTUFBdUM7SUFFdkMsT0FBTyxJQUFJLHdCQUF3QixDQUFDLGVBQWUsRUFBRSxNQUFNLENBQUMsQ0FBQztBQUMvRCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBEZXBsb3ltZW50IEFwcHJvdmFsIEJyaWRnZVxuICogUGhhc2UgMkItMiAtIOmDqOe9suWuoeaJueahpeaOpVxuICogXG4gKiDogYzotKPvvJpcbiAqIC0g5bCGIE9wZXJhdG9yIEFwcHJvdmFsIOWKqOS9nOWbnuWGmeWIsCBHaXRIdWIgRGVwbG95bWVudFxuICogLSBhcHByb3ZlIOKGkiBBcHByb3ZlIERlcGxveW1lbnRcbiAqIC0gcmVqZWN0IOKGkiBSZWplY3QgRGVwbG95bWVudFxuICovXG5cbmltcG9ydCB0eXBlIHsgR2l0SHViQWN0aW9uc0Nvbm5lY3RvciB9IGZyb20gJy4vZ2l0aHViX2FjdGlvbnNfY29ubmVjdG9yJztcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g6YWN572uXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBpbnRlcmZhY2UgRGVwbG95bWVudEFwcHJvdmFsQnJpZGdlQ29uZmlnIHtcbiAgZGVmYXVsdEFwcHJvdmFsQ29tbWVudD86IHN0cmluZztcbiAgYXV0b0FwcHJvdmVTdGFnaW5nPzogYm9vbGVhbjtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gRGVwbG95bWVudCBBcHByb3ZhbCBCcmlkZ2Vcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGNsYXNzIERlcGxveW1lbnRBcHByb3ZhbEJyaWRnZSB7XG4gIHByaXZhdGUgY29uZmlnOiBSZXF1aXJlZDxEZXBsb3ltZW50QXBwcm92YWxCcmlkZ2VDb25maWc+O1xuICBwcml2YXRlIGdpdGh1YkNvbm5lY3RvcjogR2l0SHViQWN0aW9uc0Nvbm5lY3RvcjtcbiAgXG4gIGNvbnN0cnVjdG9yKFxuICAgIGdpdGh1YkNvbm5lY3RvcjogR2l0SHViQWN0aW9uc0Nvbm5lY3RvcixcbiAgICBjb25maWc6IERlcGxveW1lbnRBcHByb3ZhbEJyaWRnZUNvbmZpZyA9IHt9XG4gICkge1xuICAgIHRoaXMuY29uZmlnID0ge1xuICAgICAgZGVmYXVsdEFwcHJvdmFsQ29tbWVudDogY29uZmlnLmRlZmF1bHRBcHByb3ZhbENvbW1lbnQgPz8gJ0FwcHJvdmVkIHZpYSBPcGVuQ2xhdyBPcGVyYXRvcicsXG4gICAgICBhdXRvQXBwcm92ZVN0YWdpbmc6IGNvbmZpZy5hdXRvQXBwcm92ZVN0YWdpbmcgPz8gZmFsc2UsXG4gICAgfTtcbiAgICBcbiAgICB0aGlzLmdpdGh1YkNvbm5lY3RvciA9IGdpdGh1YkNvbm5lY3RvcjtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOWkhOeQhiBBcHByb3ZlIOWKqOS9nFxuICAgKi9cbiAgYXN5bmMgaGFuZGxlQXBwcm92ZShcbiAgICBzb3VyY2VJZDogc3RyaW5nLFxuICAgIGRlcGxveW1lbnRJZDogbnVtYmVyLFxuICAgIGFjdG9ySWQ/OiBzdHJpbmcsXG4gICAgZW52aXJvbm1lbnQ/OiBzdHJpbmdcbiAgKTogUHJvbWlzZTx7IHN1Y2Nlc3M6IGJvb2xlYW47IG1lc3NhZ2U6IHN0cmluZyB9PiB7XG4gICAgLy8g6Kej5p6QIHNvdXJjZUlkICjmoLzlvI/vvJpvd25lci9yZXBvL2RlcGxveW1lbnRzL2lkKVxuICAgIGNvbnN0IG1hdGNoID0gc291cmNlSWQubWF0Y2goL14oLispXFwvKC4rKVxcL2RlcGxveW1lbnRzXFwvKFxcZCspJC8pO1xuICAgIGlmICghbWF0Y2gpIHtcbiAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnSW52YWxpZCBzb3VyY2VJZCBmb3JtYXQnIH07XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IFssIG93bmVyLCByZXBvXSA9IG1hdGNoO1xuICAgIFxuICAgIHRyeSB7XG4gICAgICAvLyDosIPnlKggR2l0SHViIEFQSSDmibnlh4bpg6jnvbJcbiAgICAgIGF3YWl0IHRoaXMuZ2l0aHViQ29ubmVjdG9yLmFwcHJvdmVEZXBsb3ltZW50KFxuICAgICAgICBvd25lcixcbiAgICAgICAgcmVwbyxcbiAgICAgICAgZGVwbG95bWVudElkLFxuICAgICAgICB0aGlzLmNvbmZpZy5kZWZhdWx0QXBwcm92YWxDb21tZW50XG4gICAgICApO1xuICAgICAgXG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBtZXNzYWdlOiBgQXBwcm92ZWQgZGVwbG95bWVudCB0byAke2Vudmlyb25tZW50ID8/ICd1bmtub3duJ31gLFxuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIG1lc3NhZ2U6IGBGYWlsZWQgdG8gYXBwcm92ZSBkZXBsb3ltZW50OiAke2Vycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKX1gLFxuICAgICAgfTtcbiAgICB9XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDlpITnkIYgUmVqZWN0IOWKqOS9nFxuICAgKi9cbiAgYXN5bmMgaGFuZGxlUmVqZWN0KFxuICAgIHNvdXJjZUlkOiBzdHJpbmcsXG4gICAgZGVwbG95bWVudElkOiBudW1iZXIsXG4gICAgYWN0b3JJZD86IHN0cmluZyxcbiAgICByZWFzb24/OiBzdHJpbmcsXG4gICAgZW52aXJvbm1lbnQ/OiBzdHJpbmdcbiAgKTogUHJvbWlzZTx7IHN1Y2Nlc3M6IGJvb2xlYW47IG1lc3NhZ2U6IHN0cmluZyB9PiB7XG4gICAgLy8g6Kej5p6QIHNvdXJjZUlkXG4gICAgY29uc3QgbWF0Y2ggPSBzb3VyY2VJZC5tYXRjaCgvXiguKylcXC8oLispXFwvZGVwbG95bWVudHNcXC8oXFxkKykkLyk7XG4gICAgaWYgKCFtYXRjaCkge1xuICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdJbnZhbGlkIHNvdXJjZUlkIGZvcm1hdCcgfTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgWywgb3duZXIsIHJlcG9dID0gbWF0Y2g7XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIC8vIOiwg+eUqCBHaXRIdWIgQVBJIOaLkue7nemDqOe9slxuICAgICAgYXdhaXQgdGhpcy5naXRodWJDb25uZWN0b3IucmVqZWN0RGVwbG95bWVudChcbiAgICAgICAgb3duZXIsXG4gICAgICAgIHJlcG8sXG4gICAgICAgIGRlcGxveW1lbnRJZCxcbiAgICAgICAgcmVhc29uID8/ICdSZWplY3RlZCB2aWEgT3BlbkNsYXcgT3BlcmF0b3InXG4gICAgICApO1xuICAgICAgXG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBtZXNzYWdlOiBgUmVqZWN0ZWQgZGVwbG95bWVudCB0byAke2Vudmlyb25tZW50ID8/ICd1bmtub3duJ306ICR7cmVhc29uID8/ICdObyByZWFzb24gcHJvdmlkZWQnfWAsXG4gICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgbWVzc2FnZTogYEZhaWxlZCB0byByZWplY3QgZGVwbG95bWVudDogJHtlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcil9YCxcbiAgICAgIH07XG4gICAgfVxuICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOW3peWOguWHveaVsFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRGVwbG95bWVudEFwcHJvdmFsQnJpZGdlKFxuICBnaXRodWJDb25uZWN0b3I6IEdpdEh1YkFjdGlvbnNDb25uZWN0b3IsXG4gIGNvbmZpZz86IERlcGxveW1lbnRBcHByb3ZhbEJyaWRnZUNvbmZpZ1xuKTogRGVwbG95bWVudEFwcHJvdmFsQnJpZGdlIHtcbiAgcmV0dXJuIG5ldyBEZXBsb3ltZW50QXBwcm92YWxCcmlkZ2UoZ2l0aHViQ29ubmVjdG9yLCBjb25maWcpO1xufVxuIl19