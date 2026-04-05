"use strict";
/**
 * CircleCI Connector
 * Phase 2B-3B - CircleCI API 连接器
 *
 * 职责：
 * - 接收 CircleCI Webhook
 * - 调用 CircleCI API (rerun/approve/continue)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircleCIConnectorImpl = void 0;
exports.createCircleCIConnector = createCircleCIConnector;
// ============================================================================
// 实现
// ============================================================================
class CircleCIConnectorImpl {
    constructor(config) {
        this.config = {
            apiToken: config.apiToken,
            webhookSecret: config.webhookSecret || '',
            baseUrl: config.baseUrl || 'https://circleci.com/api/v2',
            timeoutMs: config.timeoutMs || 10000,
        };
    }
    /**
     * 处理 Webhook
     */
    async handleWebhook(payload) {
        const events = [];
        const now = Date.now();
        // 检测事件类型
        const eventType = this.detectEventType(payload);
        if (!eventType) {
            return events;
        }
        const event = {
            type: eventType,
            timestamp: now,
            pipeline: {
                id: payload.pipeline.id,
                number: payload.pipeline.number,
                url: `https://circleci.com/workflow-run/${payload.pipeline.id}`,
            },
            workflow: {
                id: payload.workflow.id,
                name: payload.workflow.name,
                status: payload.workflow.status,
                startedAt: payload.workflow.started_at,
                stoppedAt: payload.workflow.stopped_at || undefined,
            },
            project: {
                slug: payload.workflow.project_slug,
                organization: payload.organization.slug,
                repository: payload.repository.name,
            },
            actor: {
                login: payload.user?.login || 'unknown',
            },
        };
        // 添加 Job 信息（如果有）
        if (payload.job) {
            event.job = {
                id: payload.job.id,
                name: payload.job.name,
                status: payload.job.status,
                startedAt: payload.job.started_at,
                stoppedAt: payload.job.stopped_at || undefined,
            };
        }
        // 添加审批信息（如果有）
        if (payload.approval) {
            event.approval = {
                id: payload.approval.id,
                name: payload.approval.name,
                status: payload.approval.status,
            };
        }
        events.push(event);
        return events;
    }
    /**
     * 获取 Pipeline 信息
     */
    async getPipeline(pipelineId) {
        return await this.apiGet(`/pipeline/${pipelineId}`);
    }
    /**
     * 获取 Workflow 信息
     */
    async getWorkflow(workflowId) {
        return await this.apiGet(`/workflow/${workflowId}`);
    }
    /**
     * 获取 Job 信息
     */
    async getJob(jobId) {
        return await this.apiGet(`/job/${jobId}`);
    }
    /**
     * 重新运行 Workflow
     */
    async rerunWorkflow(workflowId) {
        await this.apiPost(`/workflow/${workflowId}/rerun`);
    }
    /**
     * 批准 Job（审批节点）
     */
    async approveJob(jobId) {
        await this.apiPost(`/job/${jobId}/approve`);
    }
    /**
     * 继续 Workflow（审批后）
     */
    async continueWorkflow(workflowId) {
        await this.apiPost(`/workflow/${workflowId}/continue`);
    }
    // ============================================================================
    // 内部方法
    // ============================================================================
    /**
     * 检测事件类型
     */
    detectEventType(payload) {
        const workflowStatus = payload.workflow?.status;
        const jobStatus = payload.job?.status;
        const jobType = payload.job?.type;
        const approvalStatus = payload.approval?.status;
        // 审批相关
        if (jobType === 'approval' && approvalStatus === 'pending') {
            return 'approval_pending';
        }
        if (jobType === 'approval' && jobStatus === 'on_hold') {
            return 'job_on_hold';
        }
        // Workflow 相关
        if (workflowStatus === 'failed') {
            return 'workflow_failed';
        }
        if (workflowStatus === 'success') {
            return 'workflow_completed';
        }
        if (workflowStatus === 'on_hold') {
            return 'workflow_on_hold';
        }
        if (workflowStatus === 'running') {
            return 'workflow_started';
        }
        // Job 相关
        if (jobStatus === 'failed') {
            return 'job_failed';
        }
        if (jobStatus === 'success') {
            return 'job_completed';
        }
        if (jobStatus === 'on_hold') {
            return 'job_on_hold';
        }
        if (jobStatus === 'running') {
            return 'job_started';
        }
        return null;
    }
    /**
     * GET 请求
     */
    async apiGet(path) {
        const url = `${this.config.baseUrl}${path}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: this.getAuthHeaders(),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                const error = await response.text();
                throw new Error(`CircleCI API Error: ${response.status} ${error}`);
            }
            return await response.json();
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error('CircleCI API Request Timeout');
            }
            throw error;
        }
    }
    /**
     * POST 请求
     */
    async apiPost(path, data) {
        const url = `${this.config.baseUrl}${path}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    ...this.getAuthHeaders(),
                    'Content-Type': 'application/json',
                },
                body: data ? JSON.stringify(data) : undefined,
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                const error = await response.text();
                throw new Error(`CircleCI API Error: ${response.status} ${error}`);
            }
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error('CircleCI API Request Timeout');
            }
            throw error;
        }
    }
    /**
     * 获取认证头
     */
    getAuthHeaders() {
        return {
            'Accept': 'application/json',
            'Circle-Token': this.config.apiToken,
        };
    }
}
exports.CircleCIConnectorImpl = CircleCIConnectorImpl;
// ============================================================================
// 工厂函数
// ============================================================================
function createCircleCIConnector(config) {
    return new CircleCIConnectorImpl(config);
}
