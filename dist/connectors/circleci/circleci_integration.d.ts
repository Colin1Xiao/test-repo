/**
 * CircleCI Integration
 * Phase 2B-3B - CircleCI 与 Operator 主链路集成
 *
 * 职责：
 * - 组装所有 CircleCI 相关组件
 * - 提供统一的初始化接口
 */
import type { CircleCIConnector } from './circleci_connector';
import type { CircleCIEventAdapter } from './circleci_event_adapter';
import type { CircleCIOperatorBridge } from './circleci_operator_bridge';
export interface CircleCIIntegrationConfig {
    apiToken: string;
    webhookSecret?: string;
    baseUrl?: string;
    ignoreProjects?: string[];
    requireApprovalForWorkflows?: string[];
    verboseLogging?: boolean;
}
export interface CircleCIIntegrationResult {
    connector: CircleCIConnector;
    eventAdapter: CircleCIEventAdapter;
    operatorBridge: CircleCIOperatorBridge;
}
export declare function initializeCircleCIIntegration(config: CircleCIIntegrationConfig): CircleCIIntegrationResult;
export declare function createCircleCIWebhookHandler(integration: CircleCIIntegrationResult): (payload: any) => Promise<{
    success: boolean;
    eventsProcessed: number;
    incidentsCreated: number;
    approvalsCreated: number;
    errors?: Array<{
        eventId: string;
        error: string;
    }>;
}>;
export declare function createCircleCIActionHandler(integration: CircleCIIntegrationResult): {
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
