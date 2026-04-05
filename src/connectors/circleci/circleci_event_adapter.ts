/**
 * CircleCI Event Adapter
 * Phase 2B-3B - CircleCI 事件适配器
 * 
 * 职责：
 * - 将 CircleCI 事件转换为内部标准事件
 * - workflow_failed → Incident
 * - approval_pending → Approval
 */

import type {
  CircleCIEvent,
  MappedCircleCIIncident,
  MappedCircleCIApproval,
  MappedCircleCIInboxItem,
} from './circleci_types';

// ============================================================================
// 配置
// ============================================================================

export interface CircleCIEventAdapterConfig {
  autoCreateIncident?: boolean;
  autoCreateApproval?: boolean;
  autoCreateAttention?: boolean;
  failureSeverity?: 'low' | 'medium' | 'high' | 'critical';
  ignoreProjects?: string[];
  requireApprovalForWorkflows?: string[];
}

// ============================================================================
// CircleCI Event Adapter
// ============================================================================

export class CircleCIEventAdapter {
  private config: Required<CircleCIEventAdapterConfig>;

  constructor(config: CircleCIEventAdapterConfig = {}) {
    this.config = {
      autoCreateIncident: config.autoCreateIncident ?? true,
      autoCreateApproval: config.autoCreateApproval ?? true,
      autoCreateAttention: config.autoCreateAttention ?? true,
      failureSeverity: config.failureSeverity ?? 'high',
      ignoreProjects: config.ignoreProjects ?? [],
      requireApprovalForWorkflows: config.requireApprovalForWorkflows ?? [],
    };
  }

  /**
   * 适配 CircleCI 事件
   */
  adaptEvent(event: CircleCIEvent): {
    incident?: MappedCircleCIIncident;
    approval?: MappedCircleCIApproval;
    inboxItem?: MappedCircleCIInboxItem;
  } {
    const result: any = {};

    // 检查是否忽略该项目
    if (this.config.ignoreProjects.includes(event.project.slug)) {
      return result;
    }

    // 根据事件类型适配
    switch (event.type) {
      case 'workflow_failed':
      case 'job_failed':
        Object.assign(result, this.adaptFailedEvent(event));
        break;

      case 'approval_pending':
      case 'job_on_hold':
        Object.assign(result, this.adaptApprovalEvent(event));
        break;

      case 'workflow_on_hold':
        Object.assign(result, this.adaptOnHoldEvent(event));
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
  private adaptFailedEvent(event: CircleCIEvent): {
    incident?: MappedCircleCIIncident;
    inboxItem?: MappedCircleCIInboxItem;
  } {
    const result: any = {};

    if (this.config.autoCreateIncident) {
      result.incident = this.mapFailedEventToIncident(event);
    }

    if (this.config.autoCreateAttention) {
      result.inboxItem = this.mapFailedEventToInboxItem(event);
    }

    return result;
  }

  /**
   * 适配审批事件 → Approval
   */
  private adaptApprovalEvent(event: CircleCIEvent): {
    approval?: MappedCircleCIApproval;
    inboxItem?: MappedCircleCIInboxItem;
  } {
    const result: any = {};

    if (this.config.autoCreateApproval) {
      result.approval = this.mapApprovalEventToApproval(event);
    }

    // 所有审批事件都创建 Inbox Item
    result.inboxItem = this.mapApprovalEventToInboxItem(event);

    return result;
  }

  /**
   * 适配等待事件 → Attention
   */
  private adaptOnHoldEvent(event: CircleCIEvent): {
    inboxItem?: MappedCircleCIInboxItem;
  } {
    const result: any = {};

    if (this.config.autoCreateAttention) {
      result.inboxItem = this.mapOnHoldEventToInboxItem(event);
    }

    return result;
  }

  // ============================================================================
  // 映射方法
  // ============================================================================

  /**
   * 映射失败事件到 Incident
   */
  private mapFailedEventToIncident(event: CircleCIEvent): MappedCircleCIIncident {
    const sourceId = `circleci_workflow:${event.workflow.id}`;

    return {
      incidentId: `circleci_${event.workflow.id}`,
      type: event.type === 'job_failed' ? 'job_failure' : 'workflow_failure',
      severity: this.config.failureSeverity,
      description: `Workflow ${event.workflow.name} failed for ${event.project.slug}`,
      metadata: {
        source: 'circleci',
        sourceId,
        pipelineId: event.pipeline.id,
        workflowId: event.workflow.id,
        jobId: event.job?.id,
        projectSlug: event.project.slug,
        url: event.pipeline.url,
      },
    };
  }

  /**
   * 映射失败事件到 Inbox Item
   */
  private mapFailedEventToInboxItem(event: CircleCIEvent): MappedCircleCIInboxItem {
    const sourceId = `circleci_workflow:${event.workflow.id}`;

    return {
      itemType: 'incident',
      sourceId,
      title: `Workflow Failed: ${event.project.slug}`,
      summary: `Workflow ${event.workflow.name} failed`,
      severity: this.config.failureSeverity,
      suggestedActions: ['rerun', 'open', 'ack_incident'],
      metadata: {
        source: 'circleci',
        projectSlug: event.project.slug,
        workflowId: event.workflow.id,
        pipelineId: event.pipeline.id,
        eventType: event.type,
      },
    };
  }

  /**
   * 映射审批事件到 Approval
   */
  private mapApprovalEventToApproval(event: CircleCIEvent): MappedCircleCIApproval {
    const approvalId = event.approval?.id || event.job?.id || 'unknown';
    const sourceId = `circleci_approval:${approvalId}`;

    return {
      approvalId: sourceId,
      scope: event.approval?.name || event.job?.name || `Approve ${event.workflow.name}`,
      reason: `Approval required for ${event.project.slug} workflow ${event.workflow.name}`,
      requestingAgent: event.actor.login || 'circleci',
      metadata: {
        source: 'circleci',
        sourceType: 'approval_job',
        sourceId,
        pipelineId: event.pipeline.id,
        workflowId: event.workflow.id,
        approvalId,
        url: `https://circleci.com/workflow-run/${event.workflow.id}`,
      },
    };
  }

  /**
   * 映射审批事件到 Inbox Item
   */
  private mapApprovalEventToInboxItem(event: CircleCIEvent): MappedCircleCIInboxItem {
    const approvalId = event.approval?.id || event.job?.id || 'unknown';
    const sourceId = `circleci_approval:${approvalId}`;

    return {
      itemType: 'approval',
      sourceId,
      title: `Approval Required: ${event.project.slug}`,
      summary: event.approval?.name || event.job?.name || `Workflow ${event.workflow.name} requires approval`,
      severity: 'high',
      suggestedActions: ['approve', 'reject'],
      metadata: {
        source: 'circleci',
        projectSlug: event.project.slug,
        workflowId: event.workflow.id,
        approvalId,
      },
    };
  }

  /**
   * 映射等待事件到 Inbox Item
   */
  private mapOnHoldEventToInboxItem(event: CircleCIEvent): MappedCircleCIInboxItem {
    const sourceId = `circleci_workflow:${event.workflow.id}`;

    return {
      itemType: 'attention',
      sourceId,
      title: `Workflow On Hold: ${event.project.slug}`,
      summary: `Workflow ${event.workflow.name} is on hold`,
      severity: 'medium',
      suggestedActions: ['continue', 'open'],
      metadata: {
        source: 'circleci',
        projectSlug: event.project.slug,
        workflowId: event.workflow.id,
        eventType: 'workflow_on_hold',
      },
    };
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createCircleCIEventAdapter(config?: CircleCIEventAdapterConfig): CircleCIEventAdapter {
  return new CircleCIEventAdapter(config);
}
