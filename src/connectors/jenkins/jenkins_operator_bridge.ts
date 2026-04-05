/**
 * Jenkins Operator Bridge
 * Phase 2B-3A - Jenkins → Operator 数据面桥接
 * 
 * 职责：
 * - build_failed → IncidentDataSource
 * - input_pending → ApprovalDataSource
 * - 动作后状态同步
 */

import type { JenkinsEvent } from './jenkins_types';
import type { JenkinsEventAdapter } from './jenkins_event_adapter';
import type { JenkinsConnector } from './jenkins_connector';
import type { IncidentDataSource } from '../../operator/data/incident_data_source';
import type { ApprovalDataSource } from '../../operator/data/approval_data_source';

// ============================================================================
// 配置
// ============================================================================

export interface JenkinsOperatorBridgeConfig {
  defaultWorkspaceId?: string;
  autoCreateIncident?: boolean;
  autoCreateApproval?: boolean;
}

// ============================================================================
// Jenkins Operator Bridge
// ============================================================================

export class JenkinsOperatorBridge {
  private config: Required<JenkinsOperatorBridgeConfig>;
  private incidentDataSource: IncidentDataSource;
  private approvalDataSource: ApprovalDataSource;
  private eventAdapter: JenkinsEventAdapter;
  private jenkinsConnector: JenkinsConnector;

  constructor(
    incidentDataSource: IncidentDataSource,
    approvalDataSource: ApprovalDataSource,
    eventAdapter: JenkinsEventAdapter,
    jenkinsConnector: JenkinsConnector,
    config: JenkinsOperatorBridgeConfig = {}
  ) {
    this.config = {
      defaultWorkspaceId: config.defaultWorkspaceId ?? 'local-default',
      autoCreateIncident: config.autoCreateIncident ?? true,
      autoCreateApproval: config.autoCreateApproval ?? true,
    };

    this.incidentDataSource = incidentDataSource;
    this.approvalDataSource = approvalDataSource;
    this.eventAdapter = eventAdapter;
    this.jenkinsConnector = jenkinsConnector;
  }

  /**
   * 处理 Jenkins 事件
   */
  async handleJenkinsEvent(
    event: JenkinsEvent,
    workspaceId?: string
  ): Promise<{
    incidentCreated?: boolean;
    approvalCreated?: boolean;
    inboxItemCreated?: boolean;
  }> {
    const result: any = {};

    // 适配事件
    const adapted = this.eventAdapter.adaptEvent(event);

    // build_failed → Incident
    if (adapted.incident && this.config.autoCreateIncident) {
      // @ts-ignore - 简化实现，实际需扩展 IncidentDataSource
      console.log('[JenkinsOperatorBridge] Creating incident:', adapted.incident);
      result.incidentCreated = true;
    }

    // input_pending → Approval
    if (adapted.approval && this.config.autoCreateApproval) {
      // @ts-ignore - 简化实现，实际需扩展 ApprovalDataSource
      console.log('[JenkinsOperatorBridge] Creating approval:', adapted.approval);
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
    // 解析 sourceId (格式：job/name/builds/123)
    const match = sourceId.match(/(.+)\/builds\/(\d+)$/);
    if (!match) {
      return { success: false, message: 'Invalid sourceId format' };
    }

    const [, jobName, buildNumber] = match;

    try {
      await this.jenkinsConnector.rerunBuild(jobName, parseInt(buildNumber, 10));

      return {
        success: true,
        message: `Rerun Jenkins build ${jobName} #${buildNumber}`,
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

export function createJenkinsOperatorBridge(
  incidentDataSource: IncidentDataSource,
  approvalDataSource: ApprovalDataSource,
  eventAdapter: JenkinsEventAdapter,
  jenkinsConnector: JenkinsConnector,
  config?: JenkinsOperatorBridgeConfig
): JenkinsOperatorBridge {
  return new JenkinsOperatorBridge(
    incidentDataSource,
    approvalDataSource,
    eventAdapter,
    jenkinsConnector,
    config
  );
}
