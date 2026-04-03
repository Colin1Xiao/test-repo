/**
 * Operator Data Layer
 * Phase 2A-1R′A - 真实数据源层
 */

// ============================================================================
// Task Data Source
// ============================================================================

export type { TaskDataSource } from './task_data_source';
export type { TaskDataSourceConfig } from './task_data_source';
export { InMemoryTaskDataSource, createTaskDataSource } from './task_data_source';

// ============================================================================
// Approval Data Source
// ============================================================================

export type { ApprovalDataSource } from './approval_data_source';
export type { ApprovalDataSourceConfig } from './approval_data_source';
export { InMemoryApprovalDataSource, createApprovalDataSource } from './approval_data_source';

// ============================================================================
// Incident Data Source
// ============================================================================

export type {
  IncidentDataSource,
  IncidentItem,
  DegradedService,
  ReplayHotspot,
} from './incident_data_source';
export type { IncidentDataSourceConfig } from './incident_data_source';
export { InMemoryIncidentDataSource, createIncidentDataSource } from './incident_data_source';

// ============================================================================
// Agent Data Source
// ============================================================================

export type { AgentDataSource, AgentItem } from './agent_data_source';
export type { AgentDataSourceConfig } from './agent_data_source';
export { InMemoryAgentDataSource, createAgentDataSource } from './agent_data_source';

// ============================================================================
// Operator Snapshot Provider
// ============================================================================

export type {
  OperatorSnapshotProvider,
  DataSourceMode,
  DataSourceHealth,
  OperatorSnapshotProviderConfig,
} from './operator_snapshot_provider';
export { DefaultOperatorSnapshotProvider, createOperatorSnapshotProvider } from './operator_snapshot_provider';
