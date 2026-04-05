/**
 * Jenkins Integration
 * Phase 2B-3A - Jenkins 与 Operator 主链路集成
 *
 * 职责：
 * - 组装所有 Jenkins 相关组件
 * - 提供统一的初始化接口
 */
import type { JenkinsConnector } from './jenkins_connector';
import type { JenkinsEventAdapter } from './jenkins_event_adapter';
import type { JenkinsOperatorBridge } from './jenkins_operator_bridge';
import type { JenkinsBuildApprovalBridge } from './jenkins_build_approval_bridge';
export interface JenkinsIntegrationConfig {
    jenkinsBaseUrl: string;
    jenkinsUsername?: string;
    jenkinsToken?: string;
    webhookSecret?: string;
    autoApproveJobs?: string[];
    ignoreJobs?: string[];
    requireApprovalForJobs?: string[];
    verboseLogging?: boolean;
}
export interface JenkinsIntegrationResult {
    connector: JenkinsConnector;
    eventAdapter: JenkinsEventAdapter;
    operatorBridge: JenkinsOperatorBridge;
    approvalBridge: JenkinsBuildApprovalBridge;
}
export declare function initializeJenkinsIntegration(config: JenkinsIntegrationConfig): JenkinsIntegrationResult;
export declare function createJenkinsWebhookHandler(integration: JenkinsIntegrationResult): (payload: any) => Promise<{
    success: boolean;
    eventsProcessed: number;
    incidentsCreated: number;
    approvalsCreated: number;
    errors?: Array<{
        eventId: string;
        error: string;
    }>;
}>;
export declare function createJenkinsActionHandler(integration: JenkinsIntegrationResult): {
    handleApprove(sourceId: string, actorId?: string): Promise<{
        success: boolean;
        message: string;
    }>;
    handleReject(sourceId: string, actorId?: string, reason?: string): Promise<{
        success: boolean;
        message: string;
    }>;
    handleRerun(sourceId: string): Promise<{
        success: boolean;
        message: string;
    }>;
};
