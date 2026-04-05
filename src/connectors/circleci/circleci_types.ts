/**
 * CircleCI Types
 * Phase 2B-3B - CircleCI Connector 类型定义
 */

// ============================================================================
// 基础类型
// ============================================================================

export type CircleCIEventType =
  | 'workflow_started'
  | 'workflow_completed'
  | 'workflow_failed'
  | 'workflow_on_hold'
  | 'job_started'
  | 'job_completed'
  | 'job_failed'
  | 'job_on_hold'
  | 'approval_pending';

export type CircleCIStatus =
  | 'success'
  | 'failed'
  | 'error'
  | 'on_hold'
  | 'canceled'
  | 'unauthorized'
  | 'not_run'
  | 'infrastructure_fail'
  | 'running';

// ============================================================================
// CircleCI 事件
// ============================================================================

export interface CircleCIEvent {
  type: CircleCIEventType;
  timestamp: number;
  pipeline: {
    id: string;
    number: number;
    url: string;
  };
  workflow: {
    id: string;
    name: string;
    status: CircleCIStatus;
    startedAt: string;
    stoppedAt?: string;
  };
  job?: {
    id: string;
    name: string;
    status: CircleCIStatus;
    startedAt: string;
    stoppedAt?: string;
  };
  approval?: {
    id: string;
    name: string;
    status: 'pending' | 'approved' | 'denied';
  };
  project: {
    slug: string;
    organization: string;
    repository: string;
  };
  actor: {
    login: string;
  };
}

// ============================================================================
// 映射到 Operator 的类型
// ============================================================================

/**
 * 映射到 Operator Incident
 */
export interface MappedCircleCIIncident {
  incidentId: string;
  type: 'workflow_failure' | 'job_failure' | 'infrastructure_failure';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  metadata: {
    source: 'circleci';
    pipelineId: string;
    workflowId: string;
    jobId?: string;
    projectSlug: string;
    url: string;
  };
}

/**
 * 映射到 Operator Approval
 */
export interface MappedCircleCIApproval {
  approvalId: string;
  scope: string;
  reason: string;
  requestingAgent: string;
  metadata: {
    source: 'circleci';
    sourceType: 'approval_job';
    pipelineId: string;
    workflowId: string;
    approvalId: string;
    url: string;
  };
}

/**
 * 映射到 Inbox Item
 */
export interface MappedCircleCIInboxItem {
  itemType: 'task' | 'approval' | 'incident' | 'attention';
  sourceId: string;
  title: string;
  summary: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestedActions: string[];
  metadata: Record<string, any>;
}

// ============================================================================
// Webhook Payload 类型
// ============================================================================

/**
 * CircleCI Webhook Payload
 * https://circleci.com/docs/webhooks/
 */
export interface CircleCIWebhookPayload {
  id: string;
  name: string;
  pipeline: {
    id: string;
    number: number;
    created_at: string;
    state: string;
    trigger: {
      type: string;
      received_at: string;
    };
    vcs: {
      origin_repository_url: string;
      target_repository_url: string;
      commit_sha: string;
      branch: string;
      tag: string | null;
    };
  };
  workflow: {
    id: string;
    name: string;
    project_slug: string;
    status: string;
    started_at: string;
    stopped_at: string | null;
  };
  job?: {
    id: string;
    name: string;
    type: 'build' | 'approval';
    status: string;
    started_at: string;
    stopped_at: string | null;
  };
  webhook: {
    id: string;
    name: string;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
    vcs_type: string;
  };
  repository: {
    id: string;
    name: string;
    url: string;
    vcs_type: string;
  };
  user: {
    login: string;
    html_url: string;
    avatar_url: string;
    type: string;
  };
  // 审批相关字段
  approval?: {
    id: string;
    name: string;
    status: 'pending' | 'approved' | 'denied';
  };
}

// ============================================================================
// CircleCI API 响应类型
// ============================================================================

export interface CircleCIPipelineInfo {
  id: string;
  number: number;
  state: string;
  created_at: string;
  updated_at: string;
  errors: any[];
}

export interface CircleCIWorkflowInfo {
  id: string;
  name: string;
  project_slug: string;
  status: string;
  started_at: string;
  stopped_at: string | null;
  pipeline_id: string;
}

export interface CircleCIJobInfo {
  id: string;
  name: string;
  project_slug: string;
  workflow_id: string;
  status: string;
  started_at: string;
  stopped_at: string | null;
  number: number;
}

// ============================================================================
// 配置类型
// ============================================================================

export interface CircleCIConnectorConfig {
  apiToken: string;
  webhookSecret?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface CircleCIEventAdapterConfig {
  autoCreateIncident?: boolean;
  autoCreateApproval?: boolean;
  autoCreateAttention?: boolean;
  failureSeverity?: 'low' | 'medium' | 'high' | 'critical';
  ignoreProjects?: string[];
  requireApprovalForWorkflows?: string[];
}
