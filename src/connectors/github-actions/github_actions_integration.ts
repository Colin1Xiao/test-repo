/**
 * GitHub Actions Integration
 * Phase 2B-2-I - GitHub Actions 与 Operator 主链路集成
 * 
 * 职责：
 * - 组装所有 GitHub Actions 相关组件
 * - 提供统一的初始化接口
 * - 导出集成的数据源和处理器
 */

import { GitHubActionsConnectorImpl, createGitHubActionsConnector } from './github_actions_connector';
import { WorkflowEventAdapter, createWorkflowEventAdapter } from './workflow_event_adapter';
import { DeploymentApprovalBridge, createDeploymentApprovalBridge } from './deployment_approval_bridge';
import { GitHubActionsApprovalDataSource, createGitHubActionsApprovalDataSource } from '../../operator/data/github_actions_approval_data_source';
import { GitHubActionsIncidentDataSource, createGitHubActionsIncidentDataSource } from '../../operator/data/github_actions_incident_data_source';
import { GitHubActionsEventHandler, createGitHubActionsEventHandler } from './github_actions_event_handler';
import { GitHubActionsOperatorBridge, createGitHubActionsOperatorBridge } from './github_actions_operator_bridge';

// ============================================================================
// 集成配置
// ============================================================================

export interface GitHubActionsIntegrationConfig {
  /** GitHub API Token */
  githubToken?: string;
  /** Webhook Secret */
  webhookSecret?: string;
  /** 自动批准的环境列表 */
  autoApproveEnvironments?: string[];
  /** 忽略的 Workflow 列表 */
  ignoreWorkflows?: string[];
  /** 需要审批的环境列表 */
  requireApprovalForEnvironments?: string[];
  /** 详细日志 */
  verboseLogging?: boolean;
}

// ============================================================================
// 集成结果
// ============================================================================

export interface GitHubActionsIntegrationResult {
  /** GitHub Actions Connector */
  connector: GitHubActionsConnectorImpl;
  /** 审批数据源 */
  approvalDataSource: GitHubActionsApprovalDataSource;
  /** 事件数据源 */
  incidentDataSource: GitHubActionsIncidentDataSource;
  /** 事件处理器 */
  eventHandler: GitHubActionsEventHandler;
  /** 审批桥接 */
  deploymentApprovalBridge: DeploymentApprovalBridge;
  /** Operator 桥接 */
  operatorBridge: GitHubActionsOperatorBridge;
}

// ============================================================================
// 集成初始化
// ============================================================================

export function initializeGitHubActionsIntegration(
  config: GitHubActionsIntegrationConfig = {}
): GitHubActionsIntegrationResult {
  // 1. 创建数据源
  const approvalDataSource = createGitHubActionsApprovalDataSource({
    autoApproveEnvironments: config.autoApproveEnvironments,
  });
  
  const incidentDataSource = createGitHubActionsIncidentDataSource({
    ignoreWorkflows: config.ignoreWorkflows,
  });
  
  // 2. 创建事件适配器
  const workflowEventAdapter = createWorkflowEventAdapter({
    requireApprovalForEnvironments: config.requireApprovalForEnvironments,
    autoCreateIncident: true,
    autoCreateApproval: true,
    autoCreateAttention: true,
  });
  
  // 3. 创建 Connector
  const connector = createGitHubActionsConnector({
    apiToken: config.githubToken,
    webhookSecret: config.webhookSecret,
  });
  
  // 4. 创建审批桥接
  const deploymentApprovalBridge = createDeploymentApprovalBridge(connector);
  
  // 5. 创建事件处理器
  const eventHandler = createGitHubActionsEventHandler(
    approvalDataSource,
    incidentDataSource,
    workflowEventAdapter,
    {
      verboseLogging: config.verboseLogging,
      autoCreateApproval: true,
      autoCreateIncident: true,
      autoCreateAttention: true,
    }
  );
  
  // 6. 创建 Operator 桥接
  const operatorBridge = createGitHubActionsOperatorBridge(
    incidentDataSource,
    approvalDataSource,
    workflowEventAdapter,
    deploymentApprovalBridge
  );
  
  return {
    connector,
    approvalDataSource,
    incidentDataSource,
    eventHandler,
    deploymentApprovalBridge,
    operatorBridge,
  };
}

// ============================================================================
// Webhook 处理器包装器
// ============================================================================

/**
 * 创建 Webhook 处理器
 * 
 * 用法：
 * ```typescript
 * const integration = initializeGitHubActionsIntegration({ githubToken: '...' });
 * const webhookHandler = createWebhookHandler(integration);
 * 
 * // 在 HTTP 服务器中使用
 * app.post('/webhooks/github', async (req, res) => {
 *   const result = await webhookHandler(req.body, req.headers['x-hub-signature-256']);
 *   res.json(result);
 * });
 * ```
 */
export function createWebhookHandler(integration: GitHubActionsIntegrationResult) {
  return async (payload: any, signature?: string): Promise<{
    success: boolean;
    eventsProcessed: number;
    approvalsCreated: number;
    incidentsCreated: number;
    errors?: Array<{ eventId: string; error: string }>;
  }> => {
    try {
      // 1. Connector 处理 Webhook，解析事件
      const events = await integration.connector.handleWebhook(payload, signature);
      
      if (events.length === 0) {
        return {
          success: true,
          eventsProcessed: 0,
          approvalsCreated: 0,
          incidentsCreated: 0,
        };
      }
      
      // 2. Event Handler 处理事件，写入数据源
      const handlerResult = await integration.eventHandler.handleEvents(events);
      
      return {
        success: handlerResult.errors.length === 0,
        eventsProcessed: handlerResult.totalEvents,
        approvalsCreated: handlerResult.approvalsCreated,
        incidentsCreated: handlerResult.incidentsCreated,
        errors: handlerResult.errors.length > 0 ? handlerResult.errors : undefined,
      };
    } catch (error) {
      return {
        success: false,
        eventsProcessed: 0,
        approvalsCreated: 0,
        incidentsCreated: 0,
        errors: [
          {
            eventId: 'webhook_handler',
            error: error instanceof Error ? error.message : String(error),
          },
        ],
      };
    }
  };
}

// ============================================================================
// 动作处理器包装器
// ============================================================================

/**
 * 创建动作处理器
 * 
 * 用法：
 * ```typescript
 * const integration = initializeGitHubActionsIntegration({ githubToken: '...' });
 * const actionHandler = createActionHandler(integration);
 * 
 * // 在 Operator Action Handler 中使用
 * operatorActionHandler.on('approve', async (sourceId, actorId) => {
 *   return await actionHandler.handleApprove(sourceId, actorId);
 * });
 * 
 * operatorActionHandler.on('reject', async (sourceId, actorId, reason) => {
 *   return await actionHandler.handleReject(sourceId, actorId, reason);
 * });
 * ```
 */
export function createActionHandler(integration: GitHubActionsIntegrationResult) {
  return {
    /**
     * 处理 Approve 动作
     */
    async handleApprove(
      sourceId: string,
      actorId?: string
    ): Promise<{ success: boolean; message: string }> {
      // 检查是否是 GitHub Actions 来源
      if (!sourceId.includes('/deployments/')) {
        return {
          success: false,
          message: 'Not a GitHub Actions deployment sourceId',
        };
      }
      
      // 调用 Operator Bridge
      return await integration.operatorBridge.handleApproveAction(sourceId, actorId);
    },
    
    /**
     * 处理 Reject 动作
     */
    async handleReject(
      sourceId: string,
      actorId?: string,
      reason?: string
    ): Promise<{ success: boolean; message: string }> {
      // 检查是否是 GitHub Actions 来源
      if (!sourceId.includes('/deployments/')) {
        return {
          success: false,
          message: 'Not a GitHub Actions deployment sourceId',
        };
      }
      
      // 调用 Operator Bridge
      return await integration.operatorBridge.handleRejectAction(sourceId, actorId, reason);
    },
    
    /**
     * 获取审批状态
     */
    async getApprovalStatus(sourceId: string): Promise<{
      status: 'pending' | 'approved' | 'rejected' | 'cancelled' | null;
      approvalId?: string;
    }> {
      // 解析 approvalId
      const match = sourceId.match(/deployments\/(\d+)$/);
      if (!match) {
        return { status: null };
      }
      
      const deploymentId = parseInt(match[1], 10);
      const approvalId = `github_deployment_${deploymentId}`;
      
      const approval = await integration.approvalDataSource.getApprovalById(approvalId);
      
      return {
        status: approval?.status || null,
        approvalId,
      };
    },
  };
}

// ============================================================================
// 导出
// ============================================================================

export {
  GitHubActionsApprovalDataSource,
  GitHubActionsIncidentDataSource,
  GitHubActionsEventHandler,
  GitHubActionsOperatorBridge,
} from './github_actions_integration';
