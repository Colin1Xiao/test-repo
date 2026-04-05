/**
 * Jenkins Connector
 * Phase 2B-3A - Jenkins API 连接器
 *
 * 职责：
 * - 接收 Jenkins Webhook
 * - 调用 Jenkins API (rerun/cancel/approve input)
 */
import type { JenkinsEvent, JenkinsBuildInfo, JenkinsJobInfo } from './jenkins_types';
export interface JenkinsConnectorConfig {
    baseUrl: string;
    username?: string;
    token?: string;
    webhookSecret?: string;
    timeoutMs?: number;
}
export interface JenkinsConnector {
    handleWebhook(payload: any): Promise<JenkinsEvent[]>;
    getBuildInfo(jobName: string, buildNumber: number): Promise<JenkinsBuildInfo>;
    getJobInfo(jobName: string): Promise<JenkinsJobInfo>;
    rerunBuild(jobName: string, buildNumber: number): Promise<void>;
    cancelBuild(jobName: string, buildNumber: number): Promise<void>;
    approveInput(jobName: string, buildNumber: number, inputId: string): Promise<void>;
    rejectInput(jobName: string, buildNumber: number, inputId: string, reason?: string): Promise<void>;
}
export declare class JenkinsConnectorImpl implements JenkinsConnector {
    private config;
    constructor(config: JenkinsConnectorConfig);
    /**
     * 处理 Webhook
     */
    handleWebhook(payload: any): Promise<JenkinsEvent[]>;
    /**
     * 获取构建信息
     */
    getBuildInfo(jobName: string, buildNumber: number): Promise<JenkinsBuildInfo>;
    /**
     * 获取 Job 信息
     */
    getJobInfo(jobName: string): Promise<JenkinsJobInfo>;
    /**
     * 重新构建
     */
    rerunBuild(jobName: string, buildNumber: number): Promise<void>;
    /**
     * 取消构建
     */
    cancelBuild(jobName: string, buildNumber: number): Promise<void>;
    /**
     * 批准 Input
     */
    approveInput(jobName: string, buildNumber: number, inputId: string): Promise<void>;
    /**
     * 拒绝 Input
     */
    rejectInput(jobName: string, buildNumber: number, inputId: string, reason?: string): Promise<void>;
    /**
     * 解析 Build 事件
     */
    private parseBuildEvent;
    /**
     * 解析 Pipeline 事件
     */
    private parsePipelineEvent;
    /**
     * 解析 Input 事件
     */
    private parseInputEvent;
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
export declare function createJenkinsConnector(config: JenkinsConnectorConfig): JenkinsConnector;
