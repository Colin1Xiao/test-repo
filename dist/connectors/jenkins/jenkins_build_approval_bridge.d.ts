/**
 * Jenkins Build Approval Bridge
 * Phase 2B-3A - Jenkins 构建审批桥接
 *
 * 职责：
 * - 将 Operator Approval 动作回写到 Jenkins
 * - approve → Approve Input Step
 * - reject → Abort Input Step
 */
import type { JenkinsConnector } from './jenkins_connector';
export interface JenkinsBuildApprovalBridgeConfig {
    defaultApprovalComment?: string;
    autoApproveJobs?: string[];
}
export declare class JenkinsBuildApprovalBridge {
    private config;
    private jenkinsConnector;
    constructor(jenkinsConnector: JenkinsConnector, config?: JenkinsBuildApprovalBridgeConfig);
    /**
     * 处理 Approve 动作
     */
    handleApprove(sourceId: string, actorId?: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * 处理 Reject 动作
     */
    handleReject(sourceId: string, actorId?: string, reason?: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
export declare function createJenkinsBuildApprovalBridge(jenkinsConnector: JenkinsConnector, config?: JenkinsBuildApprovalBridgeConfig): JenkinsBuildApprovalBridge;
