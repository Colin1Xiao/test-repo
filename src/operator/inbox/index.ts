/**
 * Operator Inbox Module
 * Phase 2A-2B - Inbox 聚合层
 */

// ============================================================================
// 类型导出
// ============================================================================

export type {
  InboxItemType,
  InboxSeverity,
  InboxItemStatus,
  InboxItem,
  InboxSummary,
  InboxSnapshot,
  InboxConfig,
  InboxService,
} from '../types/inbox_types';

// ============================================================================
// Approval Inbox
// ============================================================================

export type { ApprovalInboxConfig } from './approval_inbox';
export { ApprovalInbox, createApprovalInbox } from './approval_inbox';

// ============================================================================
// Incident Center
// ============================================================================

export type { IncidentCenterConfig } from './incident_center';
export { IncidentCenter, createIncidentCenter } from './incident_center';

// ============================================================================
// Task Center
// ============================================================================

export type { TaskCenterConfig } from './task_center';
export { TaskCenter, createTaskCenter } from './task_center';

// ============================================================================
// Attention Inbox
// ============================================================================

export type { AttentionInboxConfig } from './attention_inbox';
export { AttentionInbox, createAttentionInbox } from './attention_inbox';

// ============================================================================
// Inbox Service
// ============================================================================

export type { InboxServiceDependencies } from './inbox_service';
export { InboxService, createInboxService } from './inbox_service';
