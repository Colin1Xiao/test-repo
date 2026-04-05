"use strict";
/**
 * Jenkins Event Adapter
 * Phase 2B-3A - Jenkins 事件适配器
 *
 * 职责：
 * - 将 Jenkins 事件转换为内部标准事件
 * - build_failed → Incident
 * - input_pending → Approval
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.JenkinsEventAdapter = void 0;
exports.createJenkinsEventAdapter = createJenkinsEventAdapter;
// ============================================================================
// Jenkins Event Adapter
// ============================================================================
class JenkinsEventAdapter {
    constructor(config = {}) {
        this.config = {
            autoCreateIncident: config.autoCreateIncident ?? true,
            autoCreateApproval: config.autoCreateApproval ?? true,
            autoCreateAttention: config.autoCreateAttention ?? true,
            failureSeverity: config.failureSeverity ?? 'high',
            ignoreJobs: config.ignoreJobs ?? [],
            requireApprovalForJobs: config.requireApprovalForJobs ?? [],
        };
    }
    /**
     * 适配 Jenkins 事件
     */
    adaptEvent(event) {
        const result = {};
        // 检查是否忽略该 Job
        if (this.config.ignoreJobs.includes(event.job.fullName)) {
            return result;
        }
        // 根据事件类型适配
        switch (event.type) {
            case 'build_failed':
            case 'pipeline_failed':
                Object.assign(result, this.adaptFailedEvent(event));
                break;
            case 'input_pending':
            case 'approval_pending':
                Object.assign(result, this.adaptInputEvent(event));
                break;
            case 'build_unstable':
                Object.assign(result, this.adaptUnstableEvent(event));
                break;
            default:
                // 其他事件不处理
                break;
        }
        return result;
    }
    // ============================================================================
    // 内部方法
    // ============================================================================
    /**
     * 适配失败事件 → Incident
     */
    adaptFailedEvent(event) {
        const result = {};
        if (this.config.autoCreateIncident) {
            result.incident = this.mapFailedEventToIncident(event);
        }
        if (this.config.autoCreateAttention) {
            result.inboxItem = this.mapFailedEventToInboxItem(event);
        }
        return result;
    }
    /**
     * 适配 Input 事件 → Approval
     */
    adaptInputEvent(event) {
        const result = {};
        if (this.config.autoCreateApproval && event.input) {
            result.approval = this.mapInputEventToApproval(event);
        }
        // 所有 Input 事件都创建 Inbox Item
        result.inboxItem = this.mapInputEventToInboxItem(event);
        return result;
    }
    /**
     * 适配不稳定事件 → Attention
     */
    adaptUnstableEvent(event) {
        const result = {};
        if (this.config.autoCreateAttention) {
            result.inboxItem = this.mapUnstableEventToInboxItem(event);
        }
        return result;
    }
    // ============================================================================
    // 映射方法
    // ============================================================================
    /**
     * 映射失败事件到 Incident
     */
    mapFailedEventToIncident(event) {
        const buildNumber = event.build?.number || event.pipeline?.runId || 0;
        const sourceId = `${event.job.fullName}/builds/${buildNumber}`;
        return {
            incidentId: `jenkins_build_${buildNumber}`,
            type: event.type === 'pipeline_failed' ? 'pipeline_failure' : 'build_failure',
            severity: this.config.failureSeverity,
            description: `Build ${buildNumber} failed for ${event.job.fullName}`,
            metadata: {
                source: 'jenkins',
                sourceId,
                jobName: event.job.fullName,
                buildNumber,
                url: event.job.url,
            },
        };
    }
    /**
     * 映射失败事件到 Inbox Item
     */
    mapFailedEventToInboxItem(event) {
        const buildNumber = event.build?.number || event.pipeline?.runId || 0;
        return {
            itemType: 'incident',
            sourceId: `${event.job.fullName}/builds/${buildNumber}`,
            title: `Build Failed: ${event.job.fullName}`,
            summary: `Build #${buildNumber} failed`,
            severity: this.config.failureSeverity,
            suggestedActions: ['rerun', 'open', 'ack_incident'],
            metadata: {
                source: 'jenkins',
                jobName: event.job.fullName,
                buildNumber,
                eventType: event.type,
            },
        };
    }
    /**
     * 映射 Input 事件到 Approval
     */
    mapInputEventToApproval(event) {
        const buildNumber = event.build?.number || 0;
        const inputId = event.input?.id || 'unknown';
        const jobName = event.job.fullName;
        // 统一格式：jenkins_input:<jobName>:<buildNumber>:<inputId>
        const approvalId = `jenkins_input:${jobName}:${buildNumber}:${inputId}`;
        const sourceId = approvalId; // sourceId 与 approvalId 一致
        return {
            approvalId,
            scope: event.input?.message || `Approve ${jobName} build #${buildNumber}`,
            reason: `Input step pending in ${jobName} build #${buildNumber}`,
            requestingAgent: event.input?.submitter || 'jenkins',
            metadata: {
                source: 'jenkins',
                sourceType: 'input_step',
                sourceId,
                jobName,
                buildNumber,
                inputId,
                url: `${event.job.url}${buildNumber}/input`,
            },
        };
    }
    /**
     * 映射 Input 事件到 Inbox Item
     */
    mapInputEventToInboxItem(event) {
        const buildNumber = event.build?.number || 0;
        const inputId = event.input?.id || 'unknown';
        const jobName = event.job.fullName;
        // 统一格式：jenkins_input:<jobName>:<buildNumber>:<inputId>
        const sourceId = `jenkins_input:${jobName}:${buildNumber}:${inputId}`;
        return {
            itemType: 'approval',
            sourceId,
            title: `Input Required: ${jobName}`,
            summary: event.input?.message || `Build #${buildNumber} requires approval`,
            severity: 'high',
            suggestedActions: ['approve', 'reject'],
            metadata: {
                source: 'jenkins',
                jobName,
                buildNumber,
                inputId,
            },
        };
    }
    /**
     * 映射不稳定事件到 Inbox Item
     */
    mapUnstableEventToInboxItem(event) {
        const buildNumber = event.build?.number || 0;
        return {
            itemType: 'attention',
            sourceId: `${event.job.fullName}/builds/${buildNumber}`,
            title: `Build Unstable: ${event.job.fullName}`,
            summary: `Build #${buildNumber} is unstable (tests may have failed)`,
            severity: 'medium',
            suggestedActions: ['open', 'acknowledge'],
            metadata: {
                source: 'jenkins',
                jobName: event.job.fullName,
                buildNumber,
                eventType: 'build_unstable',
            },
        };
    }
}
exports.JenkinsEventAdapter = JenkinsEventAdapter;
// ============================================================================
// 工厂函数
// ============================================================================
function createJenkinsEventAdapter(config) {
    return new JenkinsEventAdapter(config);
}
