/**
 * UX - 统一导出
 *
 * @version v0.1.0
 * @date 2026-04-03
 *
 * Sprint 6A: Output Styles / Response Modes
 * Sprint 6B: Control Surface / Command Views
 */
export type * from './types';
export type * from './control_types';
export { MINIMAL_STYLE, AUDIT_STYLE, CODING_STYLE, OPS_STYLE, MANAGEMENT_STYLE, ZH_PM_STYLE, BUILTIN_STYLES, BUILTIN_STYLE_MAP, defineStyle, normalizeStyle, validateStyle, getBuiltinStyles, getBuiltinStyleMap, recommendStyleForAudience, recommendStyleForScenario, createStyle, createValidatedStyle, } from './output_style';
export { StyleRegistry, createStyleRegistry, registerStyle, getStyle, } from './style_registry';
export type { StyleRegistryConfig } from './style_registry';
export { ResponseFormatter, createResponseFormatter, formatResponse, } from './response_formatter';
export type { ResponseFormatterConfig } from './response_formatter';
export { TaskViewBuilder, createTaskViewBuilder, buildTaskView, } from './task_view';
export type { TaskDataSource, AuditDataSource, TaskViewBuilderConfig } from './task_view';
export { ApprovalViewBuilder, createApprovalViewBuilder, buildApprovalView, } from './approval_view';
export type { ApprovalDataSource, ApprovalViewBuilderConfig } from './approval_view';
export { OpsViewBuilder, createOpsViewBuilder, buildOpsView, } from './ops_view';
export type { HealthMetricsDataSource, OpsSummaryDataSource, OpsViewBuilderConfig, } from './ops_view';
export { AgentViewBuilder, createAgentViewBuilder, buildAgentView, } from './agent_view';
export type { AgentDataSource, AgentViewBuilderConfig } from './agent_view';
export { ControlSurfaceBuilder, createControlSurfaceBuilder, buildControlSurfaceSnapshot, } from './control_surface';
export type { ControlSurfaceConfig } from './control_surface';
export type * from './dashboard_types';
export { AttentionEngine, createAttentionEngine, analyzeAttention, AGED_APPROVAL_RULE, BLOCKED_TASK_RULE, FAILED_TASK_RULE, DEGRADED_SERVER_RULE, UNHEALTHY_AGENT_RULE, REPLAY_HOTSPOT_RULE, TOP_FAILURE_RULE, BUILTIN_ATTENTION_RULES, } from './attention_engine';
export type { AttentionRule, AttentionAnalysis } from './attention_engine';
export { DashboardBuilder, createDashboardBuilder, buildDashboardSnapshot, } from './dashboard_builder';
export type { DashboardBuilderConfig } from './dashboard_builder';
export { ProjectionService, createProjectionService, projectDashboard, } from './projection_service';
export type { ProjectionServiceConfig } from './projection_service';
export { DashboardRefreshManager, ChangeDetector, createDashboardRefreshManager, detectStale, detectDashboardChanges, } from './dashboard_refresh';
export type { RefreshPolicy, RefreshResult, StaleDetection, DashboardChanges } from './dashboard_refresh';
export { StatusProjection, createStatusProjection, projectStatus, projectStatusSummary, projectOperatorView, } from './status_projection';
export type { StatusProjectionConfig, StatusProjectionResult } from './status_projection';
export type * from './hitl_types';
export { InterventionEngine, createInterventionEngine, generateInterventions, AGED_APPROVAL_INTERVENTION_RULE, BLOCKED_TASK_INTERVENTION_RULE, DEGRADED_SERVER_INTERVENTION_RULE, UNHEALTHY_AGENT_INTERVENTION_RULE, REPLAY_HOTSPOT_INTERVENTION_RULE, BUILTIN_INTERVENTION_RULES, } from './intervention_engine';
export type { InterventionRule, InterventionEngineConfig } from './intervention_engine';
export { SuggestionEngine, createSuggestionEngine, generateSuggestions, refineGuidedActions, } from './suggestion_engine';
export type { SuggestionEngineConfig } from './suggestion_engine';
export { ActionConfirmationManager, createActionConfirmationManager, createConfirmation, getConfirmationLevel, } from './action_confirmation';
export type { ActionConfirmationConfig } from './action_confirmation';
export { ApprovalWorkflowBuilder, createApprovalWorkflowBuilder, buildApprovalWorkflow, } from './approval_workflow';
export type { ApprovalWorkflowState } from './approval_workflow';
export { IncidentWorkflowBuilder, createIncidentWorkflowBuilder, buildIncidentWorkflow, } from './incident_workflow';
export type { IncidentWorkflowState } from './incident_workflow';
export { InterventionTrailManager, createInterventionTrailManager, recordInterventionAction, } from './intervention_trail';
export type { InterventionTrailConfig } from './intervention_trail';
export { HumanLoopService, createHumanLoopService, processDashboardSnapshot, } from './human_loop_service';
export type { HumanLoopServiceConfig } from './human_loop_service';
