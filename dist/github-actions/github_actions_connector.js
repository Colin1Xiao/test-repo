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
