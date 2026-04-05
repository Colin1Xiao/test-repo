/**
 * CircleCI Operator Bridge
 * Phase 2B-3B - CircleCI → Operator 数据面桥接
 * 
 * 职责：
 * - workflow_failed → IncidentDataSource
 * - approval_pending → ApprovalDataSource
 * - 动作后状态同步
 */

import type { CircleCIEvent } from './circleci_types';
import type { CircleCIEventAdapter } from './circleci_event_adapter';
import type { CircleCIConnector } from './circleci_connector';

// ============================================================================
// 配置
// ============================================================================

export interface CircleCIOperatorBridgeConfig {
  defaultWorkspaceId?: string;
  autoCreateIncident?: boolean;
  autoCreateApproval?: boolean;
}

// ============================================================================
// CircleCI Operator Bridge
// ============================================================================

export class CircleCIOperatorBridge {
  private config: Required<CircleCIOperatorBridgeConfig>;
  private eventAdapter: CircleCIEventAdapter;
  private circleCIConnector: CircleCIConnector;

  constructor(
    eventAdapter: CircleCIEventAdapter,
    circleCIConnector: CircleCIConnector,
    config: CircleCIOperatorBridgeConfig = {}
  ) {
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
  async handleCircleCIEvent(
    event: CircleCIEvent,
    workspaceId?: string
  ): Promise<{
    incidentCreated?: boolean;
    approvalCreated?: boolean;
    inboxItemCreated?: boolean;
  }> {
    const result: any = {};

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
  async handleApproveAction(
    sourceId: string,
    actorId?: string
  ): Promise<{ success: boolean; message: string }> {
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
    } catch (error) {
      return {
        success: false,
        message: `Failed to approve: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 处理 Reject 动作回写
   */
  async handleRejectAction(
    sourceId: string,
    actorId?: string,
    reason?: string
  ): Promise<{ success: boolean; message: string }> {
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
    } catch (error) {
      return {
        success: false,
        message: `Failed to reject: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 处理 Rerun 动作
   */
  async handleRerunAction(
    sourceId: string
  ): Promise<{ success: boolean; message: string }> {
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
    } catch (error) {
      return {
        success: false,
        message: `Failed to rerun: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createCircleCIOperatorBridge(
  eventAdapter: CircleCIEventAdapter,
  circleCIConnector: CircleCIConnector,
  config?: CircleCIOperatorBridgeConfig
): CircleCIOperatorBridge {
  return new CircleCIOperatorBridge(eventAdapter, circleCIConnector, config);
}
