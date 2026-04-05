/**
 * CircleCI Connector
 * Phase 2B-3B - CircleCI API 连接器
 *
 * 职责：
 * - 接收 CircleCI Webhook
 * - 调用 CircleCI API (rerun/approve/continue)
 */
import type { CircleCIEvent, CircleCIPipelineInfo, CircleCIWorkflowInfo, CircleCIJobInfo } from './circleci_types';
export interface CircleCIConnectorConfig {
    apiToken: string;
    webhookSecret?: string;
    baseUrl?: string;
    timeoutMs?: number;
}
export interface CircleCIConnector {
    handleWebhook(payload: any): Promise<CircleCIEvent[]>;
    getPipeline(pipelineId: string): Promise<CircleCIPipelineInfo>;
    getWorkflow(workflowId: string): Promise<CircleCIWorkflowInfo>;
    getJob(jobId: string): Promise<CircleCIJobInfo>;
    rerunWorkflow(workflowId: string): Promise<void>;
    approveJob(jobId: string): Promise<void>;
    continueWorkflow(workflowId: string): Promise<void>;
}
export declare class CircleCIConnectorImpl implements CircleCIConnector {
    private config;
    constructor(config: CircleCIConnectorConfig);
    /**
     * 处理 Webhook
     */
    handleWebhook(payload: any): Promise<CircleCIEvent[]>;
    /**
     * 获取 Pipeline 信息
     */
    getPipeline(pipelineId: string): Promise<CircleCIPipelineInfo>;
    /**
     * 获取 Workflow 信息
     */
    getWorkflow(workflowId: string): Promise<CircleCIWorkflowInfo>;
    /**
     * 获取 Job 信息
     */
    getJob(jobId: string): Promise<CircleCIJobInfo>;
    /**
     * 重新运行 Workflow
     */
    rerunWorkflow(workflowId: string): Promise<void>;
    /**
     * 批准 Job（审批节点）
     */
    approveJob(jobId: string): Promise<void>;
    /**
     * 继续 Workflow（审批后）
     */
    continueWorkflow(workflowId: string): Promise<void>;
    /**
     * 检测事件类型
     */
    private detectEventType;
    /**
     * GET 请求
     */
    private apiGet;
    /**
     * POST 请求
     */
    private apiPost;
    /**
     * 获取认证头
     */
    private getAuthHeaders;
}
export declare function createCircleCIConnector(config: CircleCIConnectorConfig): CircleCIConnector;
