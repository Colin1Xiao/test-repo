/**
 * Automation - 统一导出
 *
 * @version v0.1.0
 * @date 2026-04-03
 *
 * Sprint 5A: Hook Automation Runtime
 * Sprint 5B: Automation Loader / Workspace Rules
 */
export type * from './types';
export { resolveField, evaluateCondition, evaluateConditions, isConditionMatched, areAllConditionsMatched, } from './hook_conditions';
export { ActionExecutor, createActionExecutor, executeAction, executeActions, buildActionContext, } from './hook_actions';
export type { IActionExecutor, ActionHandlerRegistry } from './hook_actions';
export { RuleExecutor, createRuleExecutor, executeRules, } from './hook_rules';
export type { RuleExecutorConfig } from './hook_rules';
export { validateAutomationDocument, normalizeAutomationDocument, validateRuleShape, validateConditionShape, validateActionShape, quickValidateConfig, } from './automation_schema';
export type { SchemaValidationResult } from './automation_schema';
export { AutomationLoader, createAutomationLoader, loadAutomationRules, } from './automation_loader';
export type { AutomationLoaderConfig } from './automation_loader';
export { AutomationRegistry, createAutomationRegistry, } from './automation_registry';
export type { RegistryConfig } from './automation_registry';
export { RecoveryReplayExecutor, createRecoveryReplayExecutor, evaluateRecovery, } from './recovery_replay';
export type { RecoveryStrategyConfig, RecoveryContext, IRecoveryExecutor, } from './recovery_replay';
export { CompactPolicyEvaluator, createCompactPolicyEvaluator, evaluateCompactNeed, shouldCompact, } from './compact_policy';
export type { CompactPolicyConfig, CompactContext } from './compact_policy';
export { MemoryCapturePolicyEvaluator, createMemoryCapturePolicyEvaluator, evaluateMemoryCapture, shouldCaptureMemory, } from './memory_capture_policy';
export type { MemoryCaptureConfig, MemoryCaptureContext } from './memory_capture_policy';
export { FailureTaxonomy, createFailureTaxonomy, classifyFailure, buildFailureRecord, } from './failure_taxonomy';
export { AuditLog, createAuditLog, appendAuditEvent, } from './audit_log';
export type { AuditLogConfig, IAuditLogStore } from './audit_log';
export { HealthMetricsCalculator, createHealthMetricsCalculator, computeHealthSnapshot, } from './health_metrics';
export type { HealthMetricsConfig, HealthCalculationContext } from './health_metrics';
export { OpsSummaryGenerator, createOpsSummaryGenerator, buildOpsSummary, } from './ops_summary';
export type { OpsSummaryGeneratorConfig } from './ops_summary';
