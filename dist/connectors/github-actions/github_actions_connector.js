"use strict";
/**
 * GitHub Actions Connector
 * Phase 2B-2 - GitHub Actions 连接器
 *
 * 职责：
 * - 接收 GitHub Actions Webhook
 * - 调用 GitHub Actions API (rerun/cancel/approve deployment)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubActionsConnectorImpl = void 0;
exports.createGitHubActionsConnector = createGitHubActionsConnector;
const github_api_client_1 = require("../github/shared/github_api_client");
const github_webhook_verifier_1 = require("../github/shared/github_webhook_verifier");
// ============================================================================
// 实现
// ============================================================================
class GitHubActionsConnectorImpl {
    constructor(config = {}) {
        this.apiClient = new github_api_client_1.GitHubApiClient({
            token: config.apiToken ?? process.env.GITHUB_TOKEN ?? '',
        });
        this.webhookVerifier = new github_webhook_verifier_1.GitHubWebhookVerifier({
            secret: config.webhookSecret ?? process.env.GITHUB_WEBHOOK_SECRET ?? '',
        });
    }
    async handleWebhook(payload, signature) {
        const events = [];
        const now = Date.now();
        // 解析事件类型
        const eventType = payload.workflow_run ? 'workflow_run'
            : payload.deployment ? 'deployment'
                : payload.deployment_status ? 'deployment_status'
                    : payload.check_run ? 'check_run'
                        : null;
        if (!eventType) {
            return events;
        }
        if (eventType === 'workflow_run') {
            const event = {
                type: 'workflow_run',
                timestamp: now,
                action: payload.workflow_run.status,
                repository: {
                    owner: payload.repository.owner.login,
                    name: payload.repository.name,
                    fullName: payload.repository.full_name,
                },
                workflow: {
                    id: payload.workflow.id,
                    name: payload.workflow.name,
                    runId: payload.workflow_run.id,
                    runNumber: payload.workflow_run.run_number,
                    status: payload.workflow_run.status,
                    conclusion: payload.workflow_run.conclusion,
                    headBranch: payload.workflow_run.head_branch,
                    headSha: payload.workflow_run.head_sha,
                },
                sender: {
                    login: payload.sender.login,
                },
            };
            events.push(event);
        }
        if (eventType === 'deployment') {
            const event = {
                type: 'deployment',
                timestamp: now,
                repository: {
                    owner: payload.repository.owner.login,
                    name: payload.repository.name,
                    fullName: payload.repository.full_name,
                },
                deployment: {
                    id: payload.deployment.id,
                    environment: payload.deployment.environment,
                    ref: payload.deployment.ref,
                    task: payload.deployment.task,
                    creator: {
                        login: payload.deployment.creator.login,
                    },
                    description: payload.deployment.description,
                    createdAt: payload.deployment.created_at,
                    updatedAt: payload.deployment.updated_at,
                },
            };
            events.push(event);
        }
        if (eventType === 'deployment_status') {
            const event = {
                type: 'deployment_status',
                timestamp: now,
                repository: {
                    owner: payload.repository.owner.login,
                    name: payload.repository.name,
                    fullName: payload.repository.full_name,
                },
                deployment: {
                    id: payload.deployment.id,
                    environment: payload.deployment.environment,
                },
                deploymentStatus: {
                    id: payload.deployment_status.id,
                    state: payload.deployment_status.state,
                    description: payload.deployment_status.description,
                    environmentUrl: payload.deployment_status.environment_url,
                },
            };
            events.push(event);
        }
        return events;
    }
    async rerunWorkflow(owner, repo, runId) {
        await this.apiClient.post(`/repos/${owner}/${repo}/actions/runs/${runId}/rerun`);
    }
    async cancelWorkflow(owner, repo, runId) {
        await this.apiClient.post(`/repos/${owner}/${repo}/actions/runs/${runId}/cancel`);
    }
    async approveDeployment(owner, repo, deploymentId, description) {
        // GitHub API: POST /repos/{owner}/{repo}/deployments/{deployment_id}/statuses
        const path = `/repos/${owner}/${repo}/deployments/${deploymentId}/statuses`;
        console.log('[GitHubConnector] Approve Deployment:', { owner, repo, deploymentId, path });
        await this.apiClient.post(path, {
            state: 'success',
            description: description ?? 'Approved via OpenClaw Operator',
        });
    }
    async rejectDeployment(owner, repo, deploymentId, reason) {
        // GitHub API: POST /repos/{owner}/{repo}/deployments/{deployment_id}/statuses
        await this.apiClient.post(`/repos/${owner}/${repo}/deployments/${deploymentId}/statuses`, {
            state: 'failure',
            description: reason ?? 'Rejected via OpenClaw Operator',
        });
    }
}
exports.GitHubActionsConnectorImpl = GitHubActionsConnectorImpl;
// ============================================================================
// 工厂函数
// ============================================================================
function createGitHubActionsConnector(config) {
    return new GitHubActionsConnectorImpl(config);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2l0aHViX2FjdGlvbnNfY29ubmVjdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2Nvbm5lY3RvcnMvZ2l0aHViLWFjdGlvbnMvZ2l0aHViX2FjdGlvbnNfY29ubmVjdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7OztHQU9HOzs7QUE2TEgsb0VBRUM7QUE1TEQsMEVBQXFFO0FBQ3JFLHNGQUFpRjtBQXVCakYsK0VBQStFO0FBQy9FLEtBQUs7QUFDTCwrRUFBK0U7QUFFL0UsTUFBYSwwQkFBMEI7SUFJckMsWUFBWSxTQUF1QyxFQUFFO1FBQ25ELElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxtQ0FBZSxDQUFDO1lBQ25DLEtBQUssRUFBRSxNQUFNLENBQUMsUUFBUSxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsWUFBWSxJQUFJLEVBQUU7U0FDekQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFJLCtDQUFxQixDQUFDO1lBQy9DLE1BQU0sRUFBRSxNQUFNLENBQUMsYUFBYSxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMscUJBQXFCLElBQUksRUFBRTtTQUN4RSxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQsS0FBSyxDQUFDLGFBQWEsQ0FBQyxPQUFZLEVBQUUsU0FBa0I7UUFDbEQsTUFBTSxNQUFNLEdBQXlCLEVBQUUsQ0FBQztRQUN4QyxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7UUFFdkIsU0FBUztRQUNULE1BQU0sU0FBUyxHQUFHLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLGNBQWM7WUFDckQsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLFlBQVk7Z0JBQ25DLENBQUMsQ0FBQyxPQUFPLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLG1CQUFtQjtvQkFDakQsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENB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Q0FBQztRQUM1RSxPQUFPLENBQUMsR0FBRyxDQUFDLHVDQUF1QyxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxZQUFZLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUMxRixNQUFNLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUN2QixJQUFJLEVBQ0o7WUFDRSxLQUFLLEVBQUUsU0FBUztZQUNoQixXQUFXLEVBQUUsV0FBVyxJQUFJLGdDQUFnQztTQUM3RCxDQUNGLENBQUM7SUFDSixDQUFDO0lBRUQsS0FBSyxDQUFDLGdCQUFnQixDQUNwQixLQUFhLEVBQ2IsSUFBWSxFQUNaLFlBQW9CLEVBQ3BCLE1BQWU7UUFFZiw4RUFBOEU7UUFDOUUsTUFBTSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FDdkIsVUFBVSxLQUFLLElBQUksSUFBSSxnQkFBZ0IsWUFBWSxXQUFXLEVBQzlEO1lBQ0UsS0FBSyxFQUFFLFNBQVM7WUFDaEIsV0FBVyxFQUFFLE1BQU0sSUFBSSxnQ0FBZ0M7U0FDeEQsQ0FDRixDQUFDO0lBQ0osQ0FBQztDQUNGO0FBeEpELGdFQXdKQztBQUVELCtFQUErRTtBQUMvRSxPQUFPO0FBQ1AsK0VBQStFO0FBRS9FLFNBQWdCLDRCQUE0QixDQUFDLE1BQXFDO0lBQ2hGLE9BQU8sSUFBSSwwQkFBMEIsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUNoRCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBHaXRIdWIgQWN0aW9ucyBDb25uZWN0b3JcbiAqIFBoYXNlIDJCLTIgLSBHaXRIdWIgQWN0aW9ucyDov57mjqXlmahcbiAqIFxuICog6IGM6LSj77yaXG4gKiAtIOaOpeaUtiBHaXRIdWIgQWN0aW9ucyBXZWJob29rXG4gKiAtIOiwg+eUqCBHaXRIdWIgQWN0aW9ucyBBUEkgKHJlcnVuL2NhbmNlbC9hcHByb3ZlIGRlcGxveW1lbnQpXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBHaXRIdWJBY3Rpb25zRXZlbnQsIFdvcmtmbG93UnVuRXZlbnQsIERlcGxveW1lbnRFdmVudCwgRGVwbG95bWVudFN0YXR1c0V2ZW50IH0gZnJvbSAnLi9naXRodWJfYWN0aW9uc190eXBlcyc7XG5pbXBvcnQgeyBHaXRIdWJBcGlDbGllbnQgfSBmcm9tICcuLi9naXRodWIvc2hhcmVkL2dpdGh1Yl9hcGlfY2xpZW50JztcbmltcG9ydCB7IEdpdEh1YldlYmhvb2tWZXJpZmllciB9IGZyb20gJy4uL2dpdGh1Yi9zaGFyZWQvZ2l0aHViX3dlYmhvb2tfdmVyaWZpZXInO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDphY3nva5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGludGVyZmFjZSBHaXRIdWJBY3Rpb25zQ29ubmVjdG9yQ29uZmlnIHtcbiAgYXBpVG9rZW4/OiBzdHJpbmc7XG4gIHdlYmhvb2tTZWNyZXQ/OiBzdHJpbmc7XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIENvbm5lY3RvciDmjqXlj6Ncbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGludGVyZmFjZSBHaXRIdWJBY3Rpb25zQ29ubmVjdG9yIHtcbiAgaGFuZGxlV2ViaG9vayhwYXlsb2FkOiBhbnksIHNpZ25hdHVyZT86IHN0cmluZyk6IFByb21pc2U8R2l0SHViQWN0aW9uc0V2ZW50W10+O1xuICByZXJ1bldvcmtmbG93KG93bmVyOiBzdHJpbmcsIHJlcG86IHN0cmluZywgcnVuSWQ6IG51bWJlcik6IFByb21pc2U8dm9pZD47XG4gIGNhbmNlbFdvcmtmbG93KG93bmVyOiBzdHJpbmcsIHJlcG86IHN0cmluZywgcnVuSWQ6IG51bWJlcik6IFByb21pc2U8dm9pZD47XG4gIGFwcHJvdmVEZXBsb3ltZW50KG93bmVyOiBzdHJpbmcsIHJlcG86IHN0cmluZywgZGVwbG95bWVudElkOiBudW1iZXIsIGRlc2NyaXB0aW9uPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPjtcbiAgcmVqZWN0RGVwbG95bWVudChvd25lcjogc3RyaW5nLCByZXBvOiBzdHJpbmcsIGRlcGxveW1lbnRJZDogbnVtYmVyLCByZWFzb24/OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+O1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDlrp7njrBcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGNsYXNzIEdpdEh1YkFjdGlvbnNDb25uZWN0b3JJbXBsIGltcGxlbWVudHMgR2l0SHViQWN0aW9uc0Nvbm5lY3RvciB7XG4gIHByaXZhdGUgYXBpQ2xpZW50OiBHaXRIdWJBcGlDbGllbnQ7XG4gIHByaXZhdGUgd2ViaG9va1ZlcmlmaWVyOiBHaXRIdWJXZWJob29rVmVyaWZpZXI7XG4gIFxuICBjb25zdHJ1Y3Rvcihjb25maWc6IEdpdEh1YkFjdGlvbnNDb25uZWN0b3JDb25maWcgPSB7fSkge1xuICAgIHRoaXMuYXBpQ2xpZW50ID0gbmV3IEdpdEh1YkFwaUNsaWVudCh7XG4gICAgICB0b2tlbjogY29uZmlnLmFwaVRva2VuID8/IHByb2Nlc3MuZW52LkdJVEhVQl9UT0tFTiA/PyAnJyxcbiAgICB9KTtcbiAgICBcbiAgICB0aGlzLndlYmhvb2tWZXJpZmllciA9IG5ldyBHaXRIdWJXZWJob29rVmVyaWZpZXIoe1xuICAgICAgc2VjcmV0OiBjb25maWcud2ViaG9va1NlY3JldCA/PyBwcm9jZXNzLmVudi5HSVRIVUJfV0VCSE9PS19TRUNSRVQgPz8gJycsXG4gICAgfSk7XG4gIH1cbiAgXG4gIGFzeW5jIGhhbmRsZVdlYmhvb2socGF5bG9hZDogYW55LCBzaWduYXR1cmU/OiBzdHJpbmcpOiBQcm9taXNlPEdpdEh1YkFjdGlvbnNFdmVudFtdPiB7XG4gICAgY29uc3QgZXZlbnRzOiBHaXRIdWJBY3Rpb25zRXZlbnRbXSA9IFtdO1xuICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4gICAgXG4gICAgLy8g6Kej5p6Q5LqL5Lu257G75Z6LXG4gICAgY29uc3QgZXZlbnRUeXBlID0gcGF5bG9hZC53b3JrZmxvd19ydW4gPyAnd29ya2Zsb3dfcnVuJ1xuICAgICAgOiBwYXlsb2FkLmRlcGxveW1lbnQgPyAnZGVwbG95bWVudCdcbiAgICAgIDogcGF5bG9hZC5kZXBsb3ltZW50X3N0YXR1cyA/ICdkZXBsb3ltZW50X3N0YXR1cydcbiAgICAgIDogcGF5bG9hZC5jaGVja19ydW4gPyAnY2hlY2tfcnVuJ1xuICAgICAgOiBudWxsO1xuICAgIFxuICAgIGlmICghZXZlbnRUeXBlKSB7XG4gICAgICByZXR1cm4gZXZlbnRzO1xuICAgIH1cbiAgICBcbiAgICBpZiAoZXZlbnRUeXBlID09PSAnd29ya2Zsb3dfcnVuJykge1xuICAgICAgY29uc3QgZXZlbnQ6IFdvcmtmbG93UnVuRXZlbnQgPSB7XG4gICAgICAgIHR5cGU6ICd3b3JrZmxvd19ydW4nLFxuICAgICAgICB0aW1lc3RhbXA6IG5vdyxcbiAgICAgICAgYWN0aW9uOiBwYXlsb2FkLndvcmtmbG93X3J1bi5zdGF0dXMgYXMgYW55LFxuICAgICAgICByZXBvc2l0b3J5OiB7XG4gICAgICAgICAgb3duZXI6IHBheWxvYWQucmVwb3NpdG9yeS5vd25lci5sb2dpbixcbiAgICAgICAgICBuYW1lOiBwYXlsb2FkLnJlcG9zaXRvcnkubmFtZSxcbiAgICAgICAgICBmdWxsTmFtZTogcGF5bG9hZC5yZXBvc2l0b3J5LmZ1bGxfbmFtZSxcbiAgICAgICAgfSxcbiAgICAgICAgd29ya2Zsb3c6IHtcbiAgICAgICAgICBpZDogcGF5bG9hZC53b3JrZmxvdy5pZCxcbiAgICAgICAgICBuYW1lOiBwYXlsb2FkLndvcmtmbG93Lm5hbWUsXG4gICAgICAgICAgcnVuSWQ6IHBheWxvYWQud29ya2Zsb3dfcnVuLmlkLFxuICAgICAgICAgIHJ1bk51bWJlcjogcGF5bG9hZC53b3JrZmxvd19ydW4ucnVuX251bWJlcixcbiAgICAgICAgICBzdGF0dXM6IHBheWxvYWQud29ya2Zsb3dfcnVuLnN0YXR1cyBhcyBhbnksXG4gICAgICAgICAgY29uY2x1c2lvbjogcGF5bG9hZC53b3JrZmxvd19ydW4uY29uY2x1c2lvbiBhcyBhbnksXG4gICAgICAgICAgaGVhZEJyYW5jaDogcGF5bG9hZC53b3JrZmxvd19ydW4uaGVhZF9icmFuY2gsXG4gICAgICAgICAgaGVhZFNoYTogcGF5bG9hZC53b3JrZmxvd19ydW4uaGVhZF9zaGEsXG4gICAgICAgIH0sXG4gICAgICAgIHNlbmRlcjoge1xuICAgICAgICAgIGxvZ2luOiBwYXlsb2FkLnNlbmRlci5sb2dpbixcbiAgICAgICAgfSxcbiAgICAgIH07XG4gICAgICBldmVudHMucHVzaChldmVudCk7XG4gICAgfVxuICAgIFxuICAgIGlmIChldmVudFR5cGUgPT09ICdkZXBsb3ltZW50Jykge1xuICAgICAgY29uc3QgZXZlbnQ6IERlcGxveW1lbnRFdmVudCA9IHtcbiAgICAgICAgdHlwZTogJ2RlcGxveW1lbnQnLFxuICAgICAgICB0aW1lc3RhbXA6IG5vdyxcbiAgICAgICAgcmVwb3NpdG9yeToge1xuICAgICAgICAgIG93bmVyOiBwYXlsb2FkLnJlcG9zaXRvcnkub3duZXIubG9naW4sXG4gICAgICAgICAgbmFtZTogcGF5bG9hZC5yZXBvc2l0b3J5Lm5hbWUsXG4gICAgICAgICAgZnVsbE5hbWU6IHBheWxvYWQucmVwb3NpdG9yeS5mdWxsX25hbWUsXG4gICAgICAgIH0sXG4gICAgICAgIGRlcGxveW1lbnQ6IHtcbiAgICAgICAgICBpZDogcGF5bG9hZC5kZXBsb3ltZW50LmlkLFxuICAgICAgICAgIGVudmlyb25tZW50OiBwYXlsb2FkLmRlcGxveW1lbnQuZW52aXJvbm1lbnQsXG4gICAgICAgICAgcmVmOiBwYXlsb2FkLmRlcGxveW1lbnQucmVmLFxuICAgICAgICAgIHRhc2s6IHBheWxvYWQuZGVwbG95bWVudC50YXNrLFxuICAgICAgICAgIGNyZWF0b3I6IHtcbiAgICAgICAgICAgIGxvZ2luOiBwYXlsb2FkLmRlcGxveW1lbnQuY3JlYXRvci5sb2dpbixcbiAgICAgICAgICB9LFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiBwYXlsb2FkLmRlcGxveW1lbnQuZGVzY3JpcHRpb24sXG4gICAgICAgICAgY3JlYXRlZEF0OiBwYXlsb2FkLmRlcGxveW1lbnQuY3JlYXRlZF9hdCxcbiAgICAgICAgICB1cGRhdGVkQXQ6IHBheWxvYWQuZGVwbG95bWVudC51cGRhdGVkX2F0LFxuICAgICAgICB9LFxuICAgICAgfTtcbiAgICAgIGV2ZW50cy5wdXNoKGV2ZW50KTtcbiAgICB9XG4gICAgXG4gICAgaWYgKGV2ZW50VHlwZSA9PT0gJ2RlcGxveW1lbnRfc3RhdHVzJykge1xuICAgICAgY29uc3QgZXZlbnQ6IERlcGxveW1lbnRTdGF0dXNFdmVudCA9IHtcbiAgICAgICAgdHlwZTogJ2RlcGxveW1lbnRfc3RhdHVzJyxcbiAgICAgICAgdGltZXN0YW1wOiBub3csXG4gICAgICAgIHJlcG9zaXRvcnk6IHtcbiAgICAgICAgICBvd25lcjogcGF5bG9hZC5yZXBvc2l0b3J5Lm93bmVyLmxvZ2luLFxuICAgICAgICAgIG5hbWU6IHBheWxvYWQucmVwb3NpdG9yeS5uYW1lLFxuICAgICAgICAgIGZ1bGxOYW1lOiBwYXlsb2FkLnJlcG9zaXRvcnkuZnVsbF9uYW1lLFxuICAgICAgICB9LFxuICAgICAgICBkZXBsb3ltZW50OiB7XG4gICAgICAgICAgaWQ6IHBheWxvYWQuZGVwbG95bWVudC5pZCxcbiAgICAgICAgICBlbnZpcm9ubWVudDogcGF5bG9hZC5kZXBsb3ltZW50LmVudmlyb25tZW50LFxuICAgICAgICB9LFxuICAgICAgICBkZXBsb3ltZW50U3RhdHVzOiB7XG4gICAgICAgICAgaWQ6IHBheWxvYWQuZGVwbG95bWVudF9zdGF0dXMuaWQsXG4gICAgICAgICAgc3RhdGU6IHBheWxvYWQuZGVwbG95bWVudF9zdGF0dXMuc3RhdGUgYXMgYW55LFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiBwYXlsb2FkLmRlcGxveW1lbnRfc3RhdHVzLmRlc2NyaXB0aW9uLFxuICAgICAgICAgIGVudmlyb25tZW50VXJsOiBwYXlsb2FkLmRlcGxveW1lbnRfc3RhdHVzLmVudmlyb25tZW50X3VybCxcbiAgICAgICAgfSxcbiAgICAgIH07XG4gICAgICBldmVudHMucHVzaChldmVudCk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBldmVudHM7XG4gIH1cbiAgXG4gIGFzeW5jIHJlcnVuV29ya2Zsb3cob3duZXI6IHN0cmluZywgcmVwbzogc3RyaW5nLCBydW5JZDogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGhpcy5hcGlDbGllbnQucG9zdChcbiAgICAgIGAvcmVwb3MvJHtvd25lcn0vJHtyZXBvfS9hY3Rpb25zL3J1bnMvJHtydW5JZH0vcmVydW5gXG4gICAgKTtcbiAgfVxuICBcbiAgYXN5bmMgY2FuY2VsV29ya2Zsb3cob3duZXI6IHN0cmluZywgcmVwbzogc3RyaW5nLCBydW5JZDogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGhpcy5hcGlDbGllbnQucG9zdChcbiAgICAgIGAvcmVwb3MvJHtvd25lcn0vJHtyZXBvfS9hY3Rpb25zL3J1bnMvJHtydW5JZH0vY2FuY2VsYFxuICAgICk7XG4gIH1cbiAgXG4gIGFzeW5jIGFwcHJvdmVEZXBsb3ltZW50KFxuICAgIG93bmVyOiBzdHJpbmcsXG4gICAgcmVwbzogc3RyaW5nLFxuICAgIGRlcGxveW1lbnRJZDogbnVtYmVyLFxuICAgIGRlc2NyaXB0aW9uPzogc3RyaW5nXG4gICk6IFByb21pc2U8dm9pZD4ge1xuICAgIC8vIEdpdEh1YiBBUEk6IFBPU1QgL3JlcG9zL3tvd25lcn0ve3JlcG99L2RlcGxveW1lbnRzL3tkZXBsb3ltZW50X2lkfS9zdGF0dXNlc1xuICAgIGNvbnN0IHBhdGggPSBgL3JlcG9zLyR7b3duZXJ9LyR7cmVwb30vZGVwbG95bWVudHMvJHtkZXBsb3ltZW50SWR9L3N0YXR1c2VzYDtcbiAgICBjb25zb2xlLmxvZygnW0dpdEh1YkNvbm5lY3Rvcl0gQXBwcm92ZSBEZXBsb3ltZW50OicsIHsgb3duZXIsIHJlcG8sIGRlcGxveW1lbnRJZCwgcGF0aCB9KTtcbiAgICBhd2FpdCB0aGlzLmFwaUNsaWVudC5wb3N0KFxuICAgICAgcGF0aCxcbiAgICAgIHtcbiAgICAgICAgc3RhdGU6ICdzdWNjZXNzJyxcbiAgICAgICAgZGVzY3JpcHRpb246IGRlc2NyaXB0aW9uID8/ICdBcHByb3ZlZCB2aWEgT3BlbkNsYXcgT3BlcmF0b3InLFxuICAgICAgfVxuICAgICk7XG4gIH1cbiAgXG4gIGFzeW5jIHJlamVjdERlcGxveW1lbnQoXG4gICAgb3duZXI6IHN0cmluZyxcbiAgICByZXBvOiBzdHJpbmcsXG4gICAgZGVwbG95bWVudElkOiBudW1iZXIsXG4gICAgcmVhc29uPzogc3RyaW5nXG4gICk6IFByb21pc2U8dm9pZD4ge1xuICAgIC8vIEdpdEh1YiBBUEk6IFBPU1QgL3JlcG9zL3tvd25lcn0ve3JlcG99L2RlcGxveW1lbnRzL3tkZXBsb3ltZW50X2lkfS9zdGF0dXNlc1xuICAgIGF3YWl0IHRoaXMuYXBpQ2xpZW50LnBvc3QoXG4gICAgICBgL3JlcG9zLyR7b3duZXJ9LyR7cmVwb30vZGVwbG95bWVudHMvJHtkZXBsb3ltZW50SWR9L3N0YXR1c2VzYCxcbiAgICAgIHtcbiAgICAgICAgc3RhdGU6ICdmYWlsdXJlJyxcbiAgICAgICAgZGVzY3JpcHRpb246IHJlYXNvbiA/PyAnUmVqZWN0ZWQgdmlhIE9wZW5DbGF3IE9wZXJhdG9yJyxcbiAgICAgIH1cbiAgICApO1xuICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOW3peWOguWHveaVsFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlR2l0SHViQWN0aW9uc0Nvbm5lY3Rvcihjb25maWc/OiBHaXRIdWJBY3Rpb25zQ29ubmVjdG9yQ29uZmlnKTogR2l0SHViQWN0aW9uc0Nvbm5lY3RvciB7XG4gIHJldHVybiBuZXcgR2l0SHViQWN0aW9uc0Nvbm5lY3RvckltcGwoY29uZmlnKTtcbn1cbiJdfQ==