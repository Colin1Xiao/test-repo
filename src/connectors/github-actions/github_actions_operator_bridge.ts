/**
 * GitHub Actions Operator Bridge
 * Phase 2B-2 - GitHub Actions → Operator 数据面桥接
 * 
 * 职责：
 * - workflow_run failed → IncidentDataSource
 * - deployment → ApprovalDataSource
 * - 动作后状态同步回写
 */

import type {
  WorkflowRunEvent,
  DeploymentEvent,
  DeploymentStatusEvent,
} from './github_actions_types';
import type { WorkflowEventAdapter } from './workflow_event_adapter';
import type { DeploymentApprovalBridge } from './deployment_approval_bridge';
import type { IncidentDataSource } from '../../operator/data/incident_data_source';
import type { ApprovalDataSource } from '../../operator/data/approval_data_source';

// ============================================================================
// 配置
// ============================================================================

export interface GitHubActionsOperatorBridgeConfig {
  defaultWorkspaceId?: string;
  autoCreateIncident?: boolean;
  autoCreateApproval?: boolean;
}

// ============================================================================
// GitHub Actions Operator Bridge
// ============================================================================

export class GitHubActionsOperatorBridge {
  private config: Required<GitHubActionsOperatorBridgeConfig>;
  private incidentDataSource: IncidentDataSource;
  private approvalDataSource: ApprovalDataSource;
  private workflowEventAdapter: WorkflowEventAdapter;
  private deploymentApprovalBridge: DeploymentApprovalBridge;
  
  constructor(
    incidentDataSource: IncidentDataSource,
    approvalDataSource: ApprovalDataSource,
    workflowEventAdapter: WorkflowEventAdapter,
    deploymentApprovalBridge: DeploymentApprovalBridge,
    config: GitHubActionsOperatorBridgeConfig = {}
  ) {
    this.config = {
      defaultWorkspaceId: config.defaultWorkspaceId ?? 'local-default',
      autoCreateIncident: config.autoCreateIncident ?? true,
      autoCreateApproval: config.autoCreateApproval ?? true,
    };
    
    this.incidentDataSource = incidentDataSource;
    this.approvalDataSource = approvalDataSource;
    this.workflowEventAdapter = workflowEventAdapter;
    this.deploymentApprovalBridge = deploymentApprovalBridge;
  }
  
  /**
   * 处理 Workflow Run 事件
   */
  async handleWorkflowRunEvent(
    event: WorkflowRunEvent,
    workspaceId?: string
  ): Promise<{
    incidentCreated?: boolean;
    inboxItemCreated?: boolean;
  }> {
    const result: any = {};
    
    // 适配事件
    const adapted = this.workflowEventAdapter.adaptWorkflowRunEvent(event);
    
    // workflow_run failed → Incident
    if (adapted.incident && this.config.autoCreateIncident) {
      this.incidentDataSource.addIncident({
        id: adapted.incident.incidentId,
        type: adapted.incident.type,
        severity: adapted.incident.severity,
        description: adapted.incident.description,
        createdAt: Date.now(),
        acknowledged: false,
        metadata: adapted.incident.metadata,
      });
      result.incidentCreated = true;
    }
    
    return result;
  }
  
  /**
   * 处理 Deployment 事件
   */
  async handleDeploymentEvent(
    event: DeploymentEvent,
    workspaceId?: string
  ): Promise<{
    approvalCreated?: boolean;
    inboxItemCreated?: boolean;
  }> {
    const result: any = {};
    
    // 适配事件
    const adapted = this.workflowEventAdapter.adaptDeploymentEvent(event);
    
    // deployment → Approval
    if (adapted.approval && this.config.autoCreateApproval) {
      this.approvalDataSource.addApproval({
        approvalId: adapted.approval.approvalId,
        scope: adapted.approval.scope,
        requestedAt: Date.now(),
        ageMs: 0,
        status: 'pending',
        reason: adapted.approval.reason,
        requestingAgent: adapted.approval.requestingAgent,
        metadata: adapted.approval.metadata,
      });
      result.approvalCreated = true;
    }
    
    return result;
  }
  
  /**
   * 处理 Deployment Status 事件
   */
  async handleDeploymentStatusEvent(
    event: DeploymentStatusEvent,
    workspaceId?: string
  ): Promise<{
    inboxItemCreated?: boolean;
  }> {
    const result: any = {};
    
    // 适配事件
    const adapted = this.workflowEventAdapter.adaptDeploymentStatusEvent(event);
    
    // deployment_status(failure) → Attention
    if (adapted.inboxItem) {
      // 可以添加到 attention inbox
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
    // 解析 sourceId 获取 deploymentId
    const match = sourceId.match(/deployments\/(\d+)$/);
    if (!match) {
      return { success: false, message: 'Invalid sourceId format' };
    }
    
    const deploymentId = parseInt(match[1], 10);
    
    // 调用 Deployment Approval Bridge
    return await this.deploymentApprovalBridge.handleApprove(
      sourceId,
      deploymentId,
      actorId
    );
  }
  
  /**
   * 处理 Reject 动作回写
   */
  async handleRejectAction(
    sourceId: string,
    actorId?: string,
    reason?: string
  ): Promise<{ success: boolean; message: string }> {
    // 解析 sourceId 获取 deploymentId
    const match = sourceId.match(/deployments\/(\d+)$/);
    if (!match) {
      return { success: false, message: 'Invalid sourceId format' };
    }
    
    const deploymentId = parseInt(match[1], 10);
    
    // 调用 Deployment Approval Bridge
    return await this.deploymentApprovalBridge.handleReject(
      sourceId,
      deploymentId,
      actorId,
      reason
    );
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createGitHubActionsOperatorBridge(
  incidentDataSource: IncidentDataSource,
  approvalDataSource: ApprovalDataSource,
  workflowEventAdapter: WorkflowEventAdapter,
  deploymentApprovalBridge: DeploymentApprovalBridge,
  config?: GitHubActionsOperatorBridgeConfig
): GitHubActionsOperatorBridge {
  return new GitHubActionsOperatorBridge(
    incidentDataSource,
    approvalDataSource,
    workflowEventAdapter,
    deploymentApprovalBridge,
    config
  );
}
