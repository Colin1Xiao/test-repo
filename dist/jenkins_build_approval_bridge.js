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
