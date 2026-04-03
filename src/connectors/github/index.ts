/**
 * GitHub Connector Module
 * Phase 2B-1 - GitHub / PR Connector MVP
 */

// ============================================================================
// 类型导出
// ============================================================================

export type {
  GitHubEventType,
  GitHubPRAction,
  GitHubCheckStatus,
  GitHubCheckConclusion,
  GitHubEvent,
  GitHubPREvent,
  GitHubCheckEvent,
  GitHubWebhookPayload,
  MappedTask,
  MappedApproval,
  MappedInboxItem,
} from './github_types';

// ============================================================================
// GitHub Connector
// ============================================================================

export type { GitHubConnector, GitHubConnectorConfig } from './github_connector';
export { InMemoryGitHubConnector, createGitHubConnector } from './github_connector';

// ============================================================================
// PR Event Adapter
// ============================================================================

export type { PREventAdapter, PREventAdapterConfig } from './pr_event_adapter';
export { createPREventAdapter } from './pr_event_adapter';

// ============================================================================
// PR Task Mapper
// ============================================================================

export type { PRTaskMapper, PRTaskMapperConfig } from './pr_task_mapper';
export { createPRTaskMapper } from './pr_task_mapper';

// ============================================================================
// Review Bridge
// ============================================================================

export type { ReviewBridge, ReviewBridgeConfig } from './review_bridge';
export { createReviewBridge } from './review_bridge';

// ============================================================================
// Check Status Adapter
// ============================================================================

export type { CheckStatusAdapter, CheckStatusAdapterConfig } from './check_status_adapter';
export { createCheckStatusAdapter } from './check_status_adapter';

// ============================================================================
// GitHub Operator Bridge
// ============================================================================

export type { GitHubOperatorBridge, GitHubOperatorBridgeConfig } from './github_operator_bridge';
export { createGitHubOperatorBridge } from './github_operator_bridge';

// ============================================================================
// Validation Config
// ============================================================================

export type {
  GitHubValidationConfig,
  GitHubTestCase,
  ValidationReport,
} from './github_validation_config';
export {
  getGitHubValidationConfig,
  GITHUB_TEST_CASES,
  generateTestWebhookPayload,
  validateConfig,
} from './github_validation_config';
