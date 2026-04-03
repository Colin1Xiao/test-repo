/**
 * GitHub Actions Connector Module
 * Phase 2B-2 - GitHub Actions 连接器
 */

// ============================================================================
// 类型导出
// ============================================================================

export type {
  GitHubActionsEventType,
  WorkflowRunStatus,
  WorkflowRunConclusion,
  DeploymentStatus,
  GitHubActionsEvent,
  WorkflowRunEvent,
  DeploymentEvent,
  DeploymentStatusEvent,
  CheckRunEvent,
  MappedWorkflowTask,
  MappedDeploymentApproval,
  MappedWorkflowIncident,
  MappedActionsInboxItem,
  WorkflowRunWebhookPayload,
  DeploymentWebhookPayload,
  DeploymentStatusWebhookPayload,
} from './github_actions_types';

// ============================================================================
// GitHub Actions Connector
// ============================================================================

export type { GitHubActionsConnector, GitHubActionsConnectorConfig } from './github_actions_connector';
export { GitHubActionsConnectorImpl, createGitHubActionsConnector } from './github_actions_connector';

// ============================================================================
// Workflow Event Adapter
// ============================================================================

export type { WorkflowEventAdapter, WorkflowEventAdapterConfig } from './workflow_event_adapter';
export { createWorkflowEventAdapter } from './workflow_event_adapter';

// ============================================================================
// Deployment Approval Bridge
// ============================================================================

export type { DeploymentApprovalBridge, DeploymentApprovalBridgeConfig } from './deployment_approval_bridge';
export { createDeploymentApprovalBridge } from './deployment_approval_bridge';

// ============================================================================
// Job Status Adapter
// ============================================================================

export type { JobStatusAdapter, JobStatusAdapterConfig } from './job_status_adapter';
export { createJobStatusAdapter } from './job_status_adapter';

// ============================================================================
// GitHub Actions Operator Bridge
// ============================================================================

export type { GitHubActionsOperatorBridge, GitHubActionsOperatorBridgeConfig } from './github_actions_operator_bridge';
export { createGitHubActionsOperatorBridge } from './github_actions_operator_bridge';

// ============================================================================
// Shared (from GitHub Connector)
// ============================================================================

export { GitHubApiClient } from '../github/shared/github_api_client';
export { GitHubWebhookVerifier } from '../github/shared/github_webhook_verifier';
