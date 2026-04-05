/**
 * GitHub Actions Event Handler
 * Phase 2B-2-I - GitHub Actions 事件处理器
 * 
 * 职责：
 * - 接收 GitHubActionsConnector 的事件
 * - 分发到对应的数据源（Approval / Incident）
 * - 支持事件过滤和日志记录
 */

import type { GitHubActionsEvent, WorkflowRunEvent, DeploymentEvent, DeploymentStatusEvent } from './github_actions_types';
import type { GitHubActionsApprovalDataSource } from '../../operator/data/github_actions_approval_data_source';
import type { GitHubActionsIncidentDataSource } from '../../operator/data/github_actions_incident_data_source';
import type { WorkflowEventAdapter } from './workflow_event_adapter';

// ============================================================================
// 配置
// ============================================================================

export interface GitHubActionsEventHandlerConfig {
  /** 是否记录详细日志 */
  verboseLogging?: boolean;
  /** 是否启用自动创建审批 */
  autoCreateApproval?: boolean;
  /** 是否启用自动创建事件 */
  autoCreateIncident?: boolean;
  /** 是否启用自动创建 Attention */
  autoCreateAttention?: boolean;
}

// ============================================================================
// 事件处理结果
// ============================================================================

export interface EventHandlerResult {
  /** 处理的事件总数 */
  totalEvents: number;
  /** 创建的审批数 */
  approvalsCreated: number;
  /** 创建的事件数 */
  incidentsCreated: number;
  /** 忽略的事件数 */
  ignored: number;
  /** 错误列表 */
  errors: Array<{
    eventId: string;
    error: string;
  }>;
}

// ============================================================================
// GitHub Actions Event Handler
// ============================================================================

export class GitHubActionsEventHandler {
  private config: Required<GitHubActionsEventHandlerConfig>;
  private approvalDataSource: GitHubActionsApprovalDataSource;
  private incidentDataSource: GitHubActionsIncidentDataSource;
  private workflowEventAdapter: WorkflowEventAdapter;
  
  constructor(
    approvalDataSource: GitHubActionsApprovalDataSource,
    incidentDataSource: GitHubActionsIncidentDataSource,
    workflowEventAdapter: WorkflowEventAdapter,
    config: GitHubActionsEventHandlerConfig = {}
  ) {
    this.config = {
      verboseLogging: config.verboseLogging ?? false,
      autoCreateApproval: config.autoCreateApproval ?? true,
      autoCreateIncident: config.autoCreateIncident ?? true,
      autoCreateAttention: config.autoCreateAttention ?? true,
    };
    
    this.approvalDataSource = approvalDataSource;
    this.incidentDataSource = incidentDataSource;
    this.workflowEventAdapter = workflowEventAdapter;
  }
  
  /**
   * 处理单个事件
   */
  async handleEvent(event: GitHubActionsEvent): Promise<{
    success: boolean;
    approvalCreated?: boolean;
    incidentCreated?: boolean;
    ignored?: boolean;
    error?: string;
  }> {
    try {
      switch (event.type) {
        case 'deployment':
          return await this.handleDeploymentEvent(event as DeploymentEvent);
        
        case 'workflow_run':
          return await this.handleWorkflowRunEvent(event as WorkflowRunEvent);
        
        case 'deployment_status':
          return await this.handleDeploymentStatusEvent(event as DeploymentStatusEvent);
        
        default:
          return {
            success: false,
            error: `Unknown event type: ${(event as any).type}`,
          };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (this.config.verboseLogging) {
        console.error(`[GitHubActionsEventHandler] Error processing event ${event.type}:`, errorMessage);
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
  
  /**
   * 批量处理事件
   */
  async handleEvents(events: GitHubActionsEvent[]): Promise<EventHandlerResult> {
    const result: EventHandlerResult = {
      totalEvents: events.length,
      approvalsCreated: 0,
      incidentsCreated: 0,
      ignored: 0,
      errors: [],
    };
    
    for (const event of events) {
      const eventResult = await this.handleEvent(event);
      
      if (eventResult.approvalCreated) {
        result.approvalsCreated++;
      }
      
      if (eventResult.incidentCreated) {
        result.incidentsCreated++;
      }
      
      if (eventResult.ignored) {
        result.ignored++;
      }
      
      if (eventResult.error) {
        result.errors.push({
          eventId: `${event.type}_${Date.now()}`,
          error: eventResult.error,
        });
      }
    }
    
    return result;
  }
  
  // ============================================================================
  // 事件处理方法
  // ============================================================================
  
  /**
   * 处理 Deployment 事件
   */
  private async handleDeploymentEvent(event: DeploymentEvent): Promise<{
    success: boolean;
    approvalCreated?: boolean;
    sourceId?: string;
  }> {
    if (!this.config.autoCreateApproval) {
      return { success: true, ignored: true };
    }
    
    // 适配事件
    const adapted = this.workflowEventAdapter.adaptDeploymentEvent(event);
    
    if (!adapted.approval) {
      return { success: true };
    }
    
    // 创建审批
    const result = this.approvalDataSource.addApprovalFromGitHubActions(event);
    
    if (this.config.verboseLogging) {
      console.log(
        `[GitHubActionsEventHandler] Created approval ${result.approvalId} for deployment to ${event.deployment.environment}`
      );
    }
    
    return {
      success: true,
      approvalCreated: true,
      sourceId: result.sourceId,
    };
  }
  
  /**
   * 处理 Workflow Run 事件
   */
  private async handleWorkflowRunEvent(event: WorkflowRunEvent): Promise<{
    success: boolean;
    incidentCreated?: boolean;
    sourceId?: string;
    ignored?: boolean;
  }> {
    if (!this.config.autoCreateIncident) {
      return { success: true, ignored: true };
    }
    
    // 只处理失败的工作流
    if (event.workflow.conclusion !== 'failure') {
      return { success: true };
    }
    
    // 适配事件
    const adapted = this.workflowEventAdapter.adaptWorkflowRunEvent(event);
    
    if (!adapted.incident) {
      return { success: true };
    }
    
    // 创建事件
    const result = this.incidentDataSource.addIncidentFromGitHubActions(event);
    
    if (result.ignored) {
      return {
        success: true,
        ignored: true,
      };
    }
    
    if (this.config.verboseLogging) {
      console.log(
        `[GitHubActionsEventHandler] Created incident ${result.incidentId} for failed workflow ${event.workflow.name}`
      );
    }
    
    return {
      success: true,
      incidentCreated: true,
      sourceId: result.sourceId,
    };
  }
  
  /**
   * 处理 Deployment Status 事件
   */
  private async handleDeploymentStatusEvent(event: DeploymentStatusEvent): Promise<{
    success: boolean;
  }> {
    // 目前只记录日志，不创建审批或事件
    if (this.config.verboseLogging) {
      console.log(
        `[GitHubActionsEventHandler] Received deployment status: ${event.deploymentStatus.state} for deployment ${event.deployment.id}`
      );
    }
    
    return { success: true };
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createGitHubActionsEventHandler(
  approvalDataSource: GitHubActionsApprovalDataSource,
  incidentDataSource: GitHubActionsIncidentDataSource,
  workflowEventAdapter: WorkflowEventAdapter,
  config?: GitHubActionsEventHandlerConfig
): GitHubActionsEventHandler {
  return new GitHubActionsEventHandler(
    approvalDataSource,
    incidentDataSource,
    workflowEventAdapter,
    config
  );
}
