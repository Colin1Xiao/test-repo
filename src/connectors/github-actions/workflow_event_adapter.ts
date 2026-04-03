/**
 * Workflow Event Adapter
 * Phase 2B-2 - Workflow 事件适配器
 * 
 * 职责：
 * - 将 Workflow Run 事件转换为内部标准事件
 * - workflow_run completed(failure) → Incident
 * - deployment → Approval
 */

import type {
  WorkflowRunEvent,
  DeploymentEvent,
  DeploymentStatusEvent,
  MappedWorkflowIncident,
  MappedDeploymentApproval,
  MappedActionsInboxItem,
} from './github_actions_types';

// ============================================================================
// 配置
// ============================================================================

export interface WorkflowEventAdapterConfig {
  autoCreateIncident?: boolean;
  autoCreateApproval?: boolean;
  autoCreateAttention?: boolean;
  failureSeverity?: 'low' | 'medium' | 'high' | 'critical';
  ignoreWorkflows?: string[];
  requireApprovalForEnvironments?: string[];
}

// ============================================================================
// Workflow Event Adapter
// ============================================================================

export class WorkflowEventAdapter {
  private config: Required<WorkflowEventAdapterConfig>;
  
  constructor(config: WorkflowEventAdapterConfig = {}) {
    this.config = {
      autoCreateIncident: config.autoCreateIncident ?? true,
      autoCreateApproval: config.autoCreateApproval ?? true,
      autoCreateAttention: config.autoCreateAttention ?? true,
      failureSeverity: config.failureSeverity ?? 'high',
      ignoreWorkflows: config.ignoreWorkflows ?? [],
      requireApprovalForEnvironments: config.requireApprovalForEnvironments ?? ['production', 'staging'],
    };
  }
  
  /**
   * 适配 Workflow Run 事件
   */
  adaptWorkflowRunEvent(event: WorkflowRunEvent): {
    incident?: MappedWorkflowIncident;
    inboxItem?: MappedActionsInboxItem;
  } {
    const result: any = {};
    
    // 检查是否忽略该 Workflow
    if (this.config.ignoreWorkflows.includes(event.workflow.name)) {
      return result;
    }
    
    // workflow_run completed(failure) → Incident
    if (event.action === 'completed' && event.workflow.conclusion === 'failure') {
      if (this.config.autoCreateIncident) {
        result.incident = this.mapFailedWorkflowToIncident(event);
      }
      
      if (this.config.autoCreateAttention) {
        result.inboxItem = this.mapFailedWorkflowToInboxItem(event);
      }
    }
    
    return result;
  }
  
  /**
   * 适配 Deployment 事件
   */
  adaptDeploymentEvent(event: DeploymentEvent): {
    approval?: MappedDeploymentApproval;
    inboxItem?: MappedActionsInboxItem;
  } {
    const result: any = {};
    
    // 检查环境是否需要审批
    const needsApproval = this.config.requireApprovalForEnvironments.includes(
      event.deployment.environment
    );
    
    if (needsApproval && this.config.autoCreateApproval) {
      result.approval = this.mapDeploymentToApproval(event);
    }
    
    // 所有 Deployment 都创建 Inbox Item
    result.inboxItem = this.mapDeploymentToInboxItem(event);
    
    return result;
  }
  
  /**
   * 适配 Deployment Status 事件
   */
  adaptDeploymentStatusEvent(event: DeploymentStatusEvent): {
    inboxItem?: MappedActionsInboxItem;
  } {
    const result: any = {};
    
    // deployment_status(failure) → Attention
    if (event.deploymentStatus.state === 'failure' && this.config.autoCreateAttention) {
      result.inboxItem = this.mapFailedDeploymentToInboxItem(event);
    }
    
    return result;
  }
  
  // ============================================================================
  // 映射方法
  // ============================================================================
  
  private mapFailedWorkflowToIncident(event: WorkflowRunEvent): MappedWorkflowIncident {
    return {
      incidentId: `github_actions_workflow_${event.workflow.runId}`,
      type: 'workflow_failure',
      severity: this.config.failureSeverity,
      description: `Workflow ${event.workflow.name} failed on ${event.workflow.headBranch}`,
      metadata: {
        source: 'github_actions',
        workflowName: event.workflow.name,
        runId: event.workflow.runId,
        conclusion: event.workflow.conclusion,
      },
    };
  }
  
  private mapFailedWorkflowToInboxItem(event: WorkflowRunEvent): MappedActionsInboxItem {
    return {
      itemType: 'incident',
      sourceId: `${event.repository.fullName}/actions/runs/${event.workflow.runId}`,
      title: `Workflow Failed: ${event.workflow.name}`,
      summary: `Run #${event.workflow.runNumber} failed on ${event.workflow.headBranch}`,
      severity: this.config.failureSeverity,
      suggestedActions: ['rerun_workflow', 'open'],
      metadata: {
        source: 'github_actions',
        workflowName: event.workflow.name,
        runId: event.workflow.runId,
        branch: event.workflow.headBranch,
      },
    };
  }
  
  private mapDeploymentToApproval(event: DeploymentEvent): MappedDeploymentApproval {
    return {
      approvalId: `github_deployment_${event.deployment.id}`,
      scope: `Deploy to ${event.deployment.environment}`,
      reason: `Deployment requested by ${event.deployment.creator.login}: ${event.deployment.description || ''}`,
      requestingAgent: event.deployment.creator.login,
      metadata: {
        source: 'github_actions',
        sourceType: 'deployment_approval',
        deploymentId: event.deployment.id,
        environment: event.deployment.environment,
        ref: event.deployment.ref,
      },
    };
  }
  
  private mapDeploymentToInboxItem(event: DeploymentEvent): MappedActionsInboxItem {
    return {
      itemType: 'approval',
      sourceId: `${event.repository.fullName}/deployments/${event.deployment.id}`,
      title: `Deployment: ${event.deployment.environment}`,
      summary: `Deploy ${event.deployment.ref} to ${event.deployment.environment}`,
      severity: 'high',
      suggestedActions: ['approve', 'reject'],
      metadata: {
        source: 'github_actions',
        deploymentId: event.deployment.id,
        environment: event.deployment.environment,
        ref: event.deployment.ref,
      },
    };
  }
  
  private mapFailedDeploymentToInboxItem(event: DeploymentStatusEvent): MappedActionsInboxItem {
    return {
      itemType: 'incident',
      sourceId: `${event.repository.fullName}/deployments/${event.deployment.id}`,
      title: `Deployment Failed: ${event.deployment.environment}`,
      summary: `Deployment to ${event.deployment.environment} failed`,
      severity: 'critical',
      suggestedActions: ['open', 'retry'],
      metadata: {
        source: 'github_actions',
        deploymentId: event.deployment.id,
        environment: event.deployment.environment,
        state: event.deploymentStatus.state,
      },
    };
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createWorkflowEventAdapter(config?: WorkflowEventAdapterConfig): WorkflowEventAdapter {
  return new WorkflowEventAdapter(config);
}
