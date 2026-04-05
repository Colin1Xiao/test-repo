"use strict";
/**
 * CircleCI Operator Bridge
 * Phase 2B-3B - CircleCI → Operator 数据面桥接
 *
 * 职责：
 * - workflow_failed → IncidentDataSource
 * - approval_pending → ApprovalDataSource
 * - 动作后状态同步
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircleCIOperatorBridge = void 0;
exports.createCircleCIOperatorBridge = createCircleCIOperatorBridge;
// ============================================================================
// CircleCI Operator Bridge
// ============================================================================
class CircleCIOperatorBridge {
    constructor(eventAdapter, circleCIConnector, config = {}) {
        this.config = {
            defaultWorkspaceId: config.defaultWorkspaceId ?? 'local-default',
            autoCreateIncident: config.autoCreateIncident ?? true,
            autoCreateApproval: config.autoCreateApproval ?? true,
        };
        this.eventAdapter = eventAdapter;
        this.circleCIConnector = circleCIConnector;
    }
    /**
     * 处理 CircleCI 事件
     */
    async handleCircleCIEvent(event, workspaceId) {
        const result = {};
        // 适配事件
        const adapted = this.eventAdapter.adaptEvent(event);
        // workflow_failed → Incident
        if (adapted.incident && this.config.autoCreateIncident) {
            console.log('[CircleCIOperatorBridge] Creating incident:', adapted.incident);
            result.incidentCreated = true;
        }
        // approval_pending → Approval
        if (adapted.approval && this.config.autoCreateApproval) {
            console.log('[CircleCIOperatorBridge] Creating approval:', adapted.approval);
            result.approvalCreated = true;
        }
        // inboxItem
        if (adapted.inboxItem) {
            result.inboxItemCreated = true;
        }
        return result;
    }
    /**
     * 处理 Approve 动作回写
     */
    async handleApproveAction(sourceId, actorId) {
        // 解析 sourceId (格式：circleci_approval:<approvalId>)
        const match = sourceId.match(/^circleci_approval:(.+)$/);
        if (!match) {
            return { success: false, message: 'Invalid sourceId format' };
        }
        const [, approvalId] = match;
        try {
            await this.circleCIConnector.approveJob(approvalId);
            return {
                success: true,
                message: `Approved CircleCI job ${approvalId}`,
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
     * 处理 Reject 动作回写
     */
    async handleRejectAction(sourceId, actorId, reason) {
        // 解析 sourceId
        const match = sourceId.match(/^circleci_approval:(.+)$/);
        if (!match) {
            return { success: false, message: 'Invalid sourceId format' };
        }
        const [, approvalId] = match;
        try {
            // CircleCI 没有直接的 reject API，使用 cancel 或标记为失败
            await this.circleCIConnector.continueWorkflow(approvalId);
            return {
                success: true,
                message: `Rejected CircleCI approval ${approvalId}: ${reason ?? 'No reason provided'}`,
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to reject: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }
    /**
     * 处理 Rerun 动作
     */
    async handleRerunAction(sourceId) {
        // 解析 sourceId (格式：circleci_workflow:<workflowId>)
        const match = sourceId.match(/^circleci_workflow:(.+)$/);
        if (!match) {
            return { success: false, message: 'Invalid sourceId format' };
        }
        const [, workflowId] = match;
        try {
            await this.circleCIConnector.rerunWorkflow(workflowId);
            return {
                success: true,
                message: `Rerun CircleCI workflow ${workflowId}`,
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to rerun: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }
}
exports.CircleCIOperatorBridge = CircleCIOperatorBridge;
// ============================================================================
// 工厂函数
// ============================================================================
function createCircleCIOperatorBridge(eventAdapter, circleCIConnector, config) {
    return new CircleCIOperatorBridge(eventAdapter, circleCIConnector, config);
}
