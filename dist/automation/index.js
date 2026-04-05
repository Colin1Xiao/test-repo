"use strict";
/**
 * Automation - 统一导出
 *
 * @version v0.1.0
 * @date 2026-04-03
 *
 * Sprint 5A: Hook Automation Runtime
 * Sprint 5B: Automation Loader / Workspace Rules
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildOpsSummary = exports.createOpsSummaryGenerator = exports.OpsSummaryGenerator = exports.computeHealthSnapshot = exports.createHealthMetricsCalculator = exports.HealthMetricsCalculator = exports.appendAuditEvent = exports.createAuditLog = exports.AuditLog = exports.buildFailureRecord = exports.classifyFailure = exports.createFailureTaxonomy = exports.FailureTaxonomy = exports.shouldCaptureMemory = exports.evaluateMemoryCapture = exports.createMemoryCapturePolicyEvaluator = exports.MemoryCapturePolicyEvaluator = exports.shouldCompact = exports.evaluateCompactNeed = exports.createCompactPolicyEvaluator = exports.CompactPolicyEvaluator = exports.evaluateRecovery = exports.createRecoveryReplayExecutor = exports.RecoveryReplayExecutor = exports.createAutomationRegistry = exports.AutomationRegistry = exports.loadAutomationRules = exports.createAutomationLoader = exports.AutomationLoader = exports.quickValidateConfig = exports.validateActionShape = exports.validateConditionShape = exports.validateRuleShape = exports.normalizeAutomationDocument = exports.validateAutomationDocument = exports.executeRules = exports.createRuleExecutor = exports.RuleExecutor = exports.buildActionContext = exports.executeActions = exports.executeAction = exports.createActionExecutor = exports.ActionExecutor = exports.areAllConditionsMatched = exports.isConditionMatched = exports.evaluateConditions = exports.evaluateCondition = exports.resolveField = void 0;
// Hook Conditions
var hook_conditions_1 = require("./hook_conditions");
Object.defineProperty(exports, "resolveField", { enumerable: true, get: function () { return hook_conditions_1.resolveField; } });
Object.defineProperty(exports, "evaluateCondition", { enumerable: true, get: function () { return hook_conditions_1.evaluateCondition; } });
Object.defineProperty(exports, "evaluateConditions", { enumerable: true, get: function () { return hook_conditions_1.evaluateConditions; } });
Object.defineProperty(exports, "isConditionMatched", { enumerable: true, get: function () { return hook_conditions_1.isConditionMatched; } });
Object.defineProperty(exports, "areAllConditionsMatched", { enumerable: true, get: function () { return hook_conditions_1.areAllConditionsMatched; } });
// Hook Actions
var hook_actions_1 = require("./hook_actions");
Object.defineProperty(exports, "ActionExecutor", { enumerable: true, get: function () { return hook_actions_1.ActionExecutor; } });
Object.defineProperty(exports, "createActionExecutor", { enumerable: true, get: function () { return hook_actions_1.createActionExecutor; } });
Object.defineProperty(exports, "executeAction", { enumerable: true, get: function () { return hook_actions_1.executeAction; } });
Object.defineProperty(exports, "executeActions", { enumerable: true, get: function () { return hook_actions_1.executeActions; } });
Object.defineProperty(exports, "buildActionContext", { enumerable: true, get: function () { return hook_actions_1.buildActionContext; } });
// Hook Rules
var hook_rules_1 = require("./hook_rules");
Object.defineProperty(exports, "RuleExecutor", { enumerable: true, get: function () { return hook_rules_1.RuleExecutor; } });
Object.defineProperty(exports, "createRuleExecutor", { enumerable: true, get: function () { return hook_rules_1.createRuleExecutor; } });
Object.defineProperty(exports, "executeRules", { enumerable: true, get: function () { return hook_rules_1.executeRules; } });
// Automation Schema (5B)
var automation_schema_1 = require("./automation_schema");
Object.defineProperty(exports, "validateAutomationDocument", { enumerable: true, get: function () { return automation_schema_1.validateAutomationDocument; } });
Object.defineProperty(exports, "normalizeAutomationDocument", { enumerable: true, get: function () { return automation_schema_1.normalizeAutomationDocument; } });
Object.defineProperty(exports, "validateRuleShape", { enumerable: true, get: function () { return automation_schema_1.validateRuleShape; } });
Object.defineProperty(exports, "validateConditionShape", { enumerable: true, get: function () { return automation_schema_1.validateConditionShape; } });
Object.defineProperty(exports, "validateActionShape", { enumerable: true, get: function () { return automation_schema_1.validateActionShape; } });
Object.defineProperty(exports, "quickValidateConfig", { enumerable: true, get: function () { return automation_schema_1.quickValidateConfig; } });
// Automation Loader (5B)
var automation_loader_1 = require("./automation_loader");
Object.defineProperty(exports, "AutomationLoader", { enumerable: true, get: function () { return automation_loader_1.AutomationLoader; } });
Object.defineProperty(exports, "createAutomationLoader", { enumerable: true, get: function () { return automation_loader_1.createAutomationLoader; } });
Object.defineProperty(exports, "loadAutomationRules", { enumerable: true, get: function () { return automation_loader_1.loadAutomationRules; } });
// Automation Registry (5B)
var automation_registry_1 = require("./automation_registry");
Object.defineProperty(exports, "AutomationRegistry", { enumerable: true, get: function () { return automation_registry_1.AutomationRegistry; } });
Object.defineProperty(exports, "createAutomationRegistry", { enumerable: true, get: function () { return automation_registry_1.createAutomationRegistry; } });
// Recovery Replay (5C)
var recovery_replay_1 = require("./recovery_replay");
Object.defineProperty(exports, "RecoveryReplayExecutor", { enumerable: true, get: function () { return recovery_replay_1.RecoveryReplayExecutor; } });
Object.defineProperty(exports, "createRecoveryReplayExecutor", { enumerable: true, get: function () { return recovery_replay_1.createRecoveryReplayExecutor; } });
Object.defineProperty(exports, "evaluateRecovery", { enumerable: true, get: function () { return recovery_replay_1.evaluateRecovery; } });
// Compact Policy (5C)
var compact_policy_1 = require("./compact_policy");
Object.defineProperty(exports, "CompactPolicyEvaluator", { enumerable: true, get: function () { return compact_policy_1.CompactPolicyEvaluator; } });
Object.defineProperty(exports, "createCompactPolicyEvaluator", { enumerable: true, get: function () { return compact_policy_1.createCompactPolicyEvaluator; } });
Object.defineProperty(exports, "evaluateCompactNeed", { enumerable: true, get: function () { return compact_policy_1.evaluateCompactNeed; } });
Object.defineProperty(exports, "shouldCompact", { enumerable: true, get: function () { return compact_policy_1.shouldCompact; } });
// Memory Capture Policy (5C)
var memory_capture_policy_1 = require("./memory_capture_policy");
Object.defineProperty(exports, "MemoryCapturePolicyEvaluator", { enumerable: true, get: function () { return memory_capture_policy_1.MemoryCapturePolicyEvaluator; } });
Object.defineProperty(exports, "createMemoryCapturePolicyEvaluator", { enumerable: true, get: function () { return memory_capture_policy_1.createMemoryCapturePolicyEvaluator; } });
Object.defineProperty(exports, "evaluateMemoryCapture", { enumerable: true, get: function () { return memory_capture_policy_1.evaluateMemoryCapture; } });
Object.defineProperty(exports, "shouldCaptureMemory", { enumerable: true, get: function () { return memory_capture_policy_1.shouldCaptureMemory; } });
// Failure Taxonomy (5D)
var failure_taxonomy_1 = require("./failure_taxonomy");
Object.defineProperty(exports, "FailureTaxonomy", { enumerable: true, get: function () { return failure_taxonomy_1.FailureTaxonomy; } });
Object.defineProperty(exports, "createFailureTaxonomy", { enumerable: true, get: function () { return failure_taxonomy_1.createFailureTaxonomy; } });
Object.defineProperty(exports, "classifyFailure", { enumerable: true, get: function () { return failure_taxonomy_1.classifyFailure; } });
Object.defineProperty(exports, "buildFailureRecord", { enumerable: true, get: function () { return failure_taxonomy_1.buildFailureRecord; } });
// Audit Log (5D)
var audit_log_1 = require("./audit_log");
Object.defineProperty(exports, "AuditLog", { enumerable: true, get: function () { return audit_log_1.AuditLog; } });
Object.defineProperty(exports, "createAuditLog", { enumerable: true, get: function () { return audit_log_1.createAuditLog; } });
Object.defineProperty(exports, "appendAuditEvent", { enumerable: true, get: function () { return audit_log_1.appendAuditEvent; } });
// Health Metrics (5D)
var health_metrics_1 = require("./health_metrics");
Object.defineProperty(exports, "HealthMetricsCalculator", { enumerable: true, get: function () { return health_metrics_1.HealthMetricsCalculator; } });
Object.defineProperty(exports, "createHealthMetricsCalculator", { enumerable: true, get: function () { return health_metrics_1.createHealthMetricsCalculator; } });
Object.defineProperty(exports, "computeHealthSnapshot", { enumerable: true, get: function () { return health_metrics_1.computeHealthSnapshot; } });
// Ops Summary (5D)
var ops_summary_1 = require("./ops_summary");
Object.defineProperty(exports, "OpsSummaryGenerator", { enumerable: true, get: function () { return ops_summary_1.OpsSummaryGenerator; } });
Object.defineProperty(exports, "createOpsSummaryGenerator", { enumerable: true, get: function () { return ops_summary_1.createOpsSummaryGenerator; } });
Object.defineProperty(exports, "buildOpsSummary", { enumerable: true, get: function () { return ops_summary_1.buildOpsSummary; } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvYXV0b21hdGlvbi9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7O0dBUUc7OztBQUtILGtCQUFrQjtBQUNsQixxREFNMkI7QUFMekIsK0dBQUEsWUFBWSxPQUFBO0FBQ1osb0hBQUEsaUJBQWlCLE9BQUE7QUFDakIscUhBQUEsa0JBQWtCLE9BQUE7QUFDbEIscUhBQUEsa0JBQWtCLE9BQUE7QUFDbEIsMEhBQUEsdUJBQXVCLE9BQUE7QUFHekIsZUFBZTtBQUNmLCtDQU13QjtBQUx0Qiw4R0FBQSxjQUFjLE9BQUE7QUFDZCxvSEFBQSxvQkFBb0IsT0FBQTtBQUNwQiw2R0FBQSxhQUFhLE9BQUE7QUFDYiw4R0FBQSxjQUFjLE9BQUE7QUFDZCxrSEFBQSxrQkFBa0IsT0FBQTtBQUlwQixhQUFhO0FBQ2IsMkNBSXNCO0FBSHBCLDBHQUFBLFlBQVksT0FBQTtBQUNaLGdIQUFBLGtCQUFrQixPQUFBO0FBQ2xCLDBHQUFBLFlBQVksT0FBQTtBQUlkLHlCQUF5QjtBQUN6Qix5REFPNkI7QUFOM0IsK0hBQUEsMEJBQTBCLE9BQUE7QUFDMUIsZ0lBQUEsMkJBQTJCLE9BQUE7QUFDM0Isc0hBQUEsaUJBQWlCLE9BQUE7QUFDakIsMkhBQUEsc0JBQXNCLE9BQUE7QUFDdEIsd0hBQUEsbUJBQW1CLE9BQUE7QUFDbkIsd0hBQUEsbUJBQW1CLE9BQUE7QUFJckIseUJBQXlCO0FBQ3pCLHlEQUk2QjtBQUgzQixxSEFBQSxnQkFBZ0IsT0FBQTtBQUNoQiwySEFBQSxzQkFBc0IsT0FBQTtBQUN0Qix3SEFBQSxtQkFBbUIsT0FBQTtBQUlyQiwyQkFBMkI7QUFDM0IsNkRBRytCO0FBRjdCLHlIQUFBLGtCQUFrQixPQUFBO0FBQ2xCLCtIQUFBLHdCQUF3QixPQUFBO0FBSTFCLHVCQUF1QjtBQUN2QixxREFJMkI7QUFIekIseUhBQUEsc0JBQXNCLE9BQUE7QUFDdEIsK0hBQUEsNEJBQTRCLE9BQUE7QUFDNUIsbUhBQUEsZ0JBQWdCLE9BQUE7QUFRbEIsc0JBQXNCO0FBQ3RCLG1EQUswQjtBQUp4Qix3SEFBQSxzQkFBc0IsT0FBQTtBQUN0Qiw4SEFBQSw0QkFBNEIsT0FBQTtBQUM1QixxSEFBQSxtQkFBbUIsT0FBQTtBQUNuQiwrR0FBQSxhQUFhLE9BQUE7QUFJZiw2QkFBNkI7QUFDN0IsaUVBS2lDO0FBSi9CLHFJQUFBLDRCQUE0QixPQUFBO0FBQzVCLDJJQUFBLGtDQUFrQyxPQUFBO0FBQ2xDLDhIQUFBLHFCQUFxQixPQUFBO0FBQ3JCLDRIQUFBLG1CQUFtQixPQUFBO0FBSXJCLHdCQUF3QjtBQUN4Qix1REFLNEI7QUFKMUIsbUhBQUEsZUFBZSxPQUFBO0FBQ2YseUhBQUEscUJBQXFCLE9BQUE7QUFDckIsbUhBQUEsZUFBZSxPQUFBO0FBQ2Ysc0hBQUEsa0JBQWtCLE9BQUE7QUFHcEIsaUJBQWlCO0FBQ2pCLHlDQUlxQjtBQUhuQixxR0FBQSxRQUFRLE9BQUE7QUFDUiwyR0FBQSxjQUFjLE9BQUE7QUFDZCw2R0FBQSxnQkFBZ0IsT0FBQTtBQUlsQixzQkFBc0I7QUFDdEIsbURBSTBCO0FBSHhCLHlIQUFBLHVCQUF1QixPQUFBO0FBQ3ZCLCtIQUFBLDZCQUE2QixPQUFBO0FBQzdCLHVIQUFBLHFCQUFxQixPQUFBO0FBSXZCLG1CQUFtQjtBQUNuQiw2Q0FJdUI7QUFIckIsa0hBQUEsbUJBQW1CLE9BQUE7QUFDbkIsd0hBQUEseUJBQXlCLE9BQUE7QUFDekIsOEdBQUEsZUFBZSxPQUFBIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBBdXRvbWF0aW9uIC0g57uf5LiA5a+85Ye6XG4gKiBcbiAqIEB2ZXJzaW9uIHYwLjEuMFxuICogQGRhdGUgMjAyNi0wNC0wM1xuICogXG4gKiBTcHJpbnQgNUE6IEhvb2sgQXV0b21hdGlvbiBSdW50aW1lXG4gKiBTcHJpbnQgNUI6IEF1dG9tYXRpb24gTG9hZGVyIC8gV29ya3NwYWNlIFJ1bGVzXG4gKi9cblxuLy8gVHlwZXNcbmV4cG9ydCB0eXBlICogZnJvbSAnLi90eXBlcyc7XG5cbi8vIEhvb2sgQ29uZGl0aW9uc1xuZXhwb3J0IHtcbiAgcmVzb2x2ZUZpZWxkLFxuICBldmFsdWF0ZUNvbmRpdGlvbixcbiAgZXZhbHVhdGVDb25kaXRpb25zLFxuICBpc0NvbmRpdGlvbk1hdGNoZWQsXG4gIGFyZUFsbENvbmRpdGlvbnNNYXRjaGVkLFxufSBmcm9tICcuL2hvb2tfY29uZGl0aW9ucyc7XG5cbi8vIEhvb2sgQWN0aW9uc1xuZXhwb3J0IHtcbiAgQWN0aW9uRXhlY3V0b3IsXG4gIGNyZWF0ZUFjdGlvbkV4ZWN1dG9yLFxuICBleGVjdXRlQWN0aW9uLFxuICBleGVjdXRlQWN0aW9ucyxcbiAgYnVpbGRBY3Rpb25Db250ZXh0LFxufSBmcm9tICcuL2hvb2tfYWN0aW9ucyc7XG5leHBvcnQgdHlwZSB7IElBY3Rpb25FeGVjdXRvciwgQWN0aW9uSGFuZGxlclJlZ2lzdHJ5IH0gZnJvbSAnLi9ob29rX2FjdGlvbnMnO1xuXG4vLyBIb29rIFJ1bGVzXG5leHBvcnQge1xuICBSdWxlRXhlY3V0b3IsXG4gIGNyZWF0ZVJ1bGVFeGVjdXRvcixcbiAgZXhlY3V0ZVJ1bGVzLFxufSBmcm9tICcuL2hvb2tfcnVsZXMnO1xuZXhwb3J0IHR5cGUgeyBSdWxlRXhlY3V0b3JDb25maWcgfSBmcm9tICcuL2hvb2tfcnVsZXMnO1xuXG4vLyBBdXRvbWF0aW9uIFNjaGVtYSAoNUIpXG5leHBvcnQge1xuICB2YWxpZGF0ZUF1dG9tYXRpb25Eb2N1bWVudCxcbiAgbm9ybWFsaXplQXV0b21hdGlvbkRvY3VtZW50LFxuICB2YWxpZGF0ZVJ1bGVTaGFwZSxcbiAgdmFsaWRhdGVDb25kaXRpb25TaGFwZSxcbiAgdmFsaWRhdGVBY3Rpb25TaGFwZSxcbiAgcXVpY2tWYWxpZGF0ZUNvbmZpZyxcbn0gZnJvbSAnLi9hdXRvbWF0aW9uX3NjaGVtYSc7XG5leHBvcnQgdHlwZSB7IFNjaGVtYVZhbGlkYXRpb25SZXN1bHQgfSBmcm9tICcuL2F1dG9tYXRpb25fc2NoZW1hJztcblxuLy8gQXV0b21hdGlvbiBMb2FkZXIgKDVCKVxuZXhwb3J0IHtcbiAgQXV0b21hdGlvbkxvYWRlcixcbiAgY3JlYXRlQXV0b21hdGlvbkxvYWRlcixcbiAgbG9hZEF1dG9tYXRpb25SdWxlcyxcbn0gZnJvbSAnLi9hdXRvbWF0aW9uX2xvYWRlcic7XG5leHBvcnQgdHlwZSB7IEF1dG9tYXRpb25Mb2FkZXJDb25maWcgfSBmcm9tICcuL2F1dG9tYXRpb25fbG9hZGVyJztcblxuLy8gQXV0b21hdGlvbiBSZWdpc3RyeSAoNUIpXG5leHBvcnQge1xuICBBdXRvbWF0aW9uUmVnaXN0cnksXG4gIGNyZWF0ZUF1dG9tYXRpb25SZWdpc3RyeSxcbn0gZnJvbSAnLi9hdXRvbWF0aW9uX3JlZ2lzdHJ5JztcbmV4cG9ydCB0eXBlIHsgUmVnaXN0cnlDb25maWcgfSBmcm9tICcuL2F1dG9tYXRpb25fcmVnaXN0cnknO1xuXG4vLyBSZWNvdmVyeSBSZXBsYXkgKDVDKVxuZXhwb3J0IHtcbiAgUmVjb3ZlcnlSZXBsYXlFeGVjdXRvcixcbiAgY3JlYXRlUmVjb3ZlcnlSZXBsYXlFeGVjdXRvcixcbiAgZXZhbHVhdGVSZWNvdmVyeSxcbn0gZnJvbSAnLi9yZWNvdmVyeV9yZXBsYXknO1xuZXhwb3J0IHR5cGUge1xuICBSZWNvdmVyeVN0cmF0ZWd5Q29uZmlnLFxuICBSZWNvdmVyeUNvbnRleHQsXG4gIElSZWNvdmVyeUV4ZWN1dG9yLFxufSBmcm9tICcuL3JlY292ZXJ5X3JlcGxheSc7XG5cbi8vIENvbXBhY3QgUG9saWN5ICg1QylcbmV4cG9ydCB7XG4gIENvbXBhY3RQb2xpY3lFdmFsdWF0b3IsXG4gIGNyZWF0ZUNvbXBhY3RQb2xpY3lFdmFsdWF0b3IsXG4gIGV2YWx1YXRlQ29tcGFjdE5lZWQsXG4gIHNob3VsZENvbXBhY3QsXG59IGZyb20gJy4vY29tcGFjdF9wb2xpY3knO1xuZXhwb3J0IHR5cGUgeyBDb21wYWN0UG9saWN5Q29uZmlnLCBDb21wYWN0Q29udGV4dCB9IGZyb20gJy4vY29tcGFjdF9wb2xpY3knO1xuXG4vLyBNZW1vcnkgQ2FwdHVyZSBQb2xpY3kgKDVDKVxuZXhwb3J0IHtcbiAgTWVtb3J5Q2FwdHVyZVBvbGljeUV2YWx1YXRvcixcbiAgY3JlYXRlTWVtb3J5Q2FwdHVyZVBvbGljeUV2YWx1YXRvcixcbiAgZXZhbHVhdGVNZW1vcnlDYXB0dXJlLFxuICBzaG91bGRDYXB0dXJlTWVtb3J5LFxufSBmcm9tICcuL21lbW9yeV9jYXB0dXJlX3BvbGljeSc7XG5leHBvcnQgdHlwZSB7IE1lbW9yeUNhcHR1cmVDb25maWcsIE1lbW9yeUNhcHR1cmVDb250ZXh0IH0gZnJvbSAnLi9tZW1vcnlfY2FwdHVyZV9wb2xpY3knO1xuXG4vLyBGYWlsdXJlIFRheG9ub215ICg1RClcbmV4cG9ydCB7XG4gIEZhaWx1cmVUYXhvbm9teSxcbiAgY3JlYXRlRmFpbHVyZVRheG9ub215LFxuICBjbGFzc2lmeUZhaWx1cmUsXG4gIGJ1aWxkRmFpbHVyZVJlY29yZCxcbn0gZnJvbSAnLi9mYWlsdXJlX3RheG9ub215JztcblxuLy8gQXVkaXQgTG9nICg1RClcbmV4cG9ydCB7XG4gIEF1ZGl0TG9nLFxuICBjcmVhdGVBdWRpdExvZyxcbiAgYXBwZW5kQXVkaXRFdmVudCxcbn0gZnJvbSAnLi9hdWRpdF9sb2cnO1xuZXhwb3J0IHR5cGUgeyBBdWRpdExvZ0NvbmZpZywgSUF1ZGl0TG9nU3RvcmUgfSBmcm9tICcuL2F1ZGl0X2xvZyc7XG5cbi8vIEhlYWx0aCBNZXRyaWNzICg1RClcbmV4cG9ydCB7XG4gIEhlYWx0aE1ldHJpY3NDYWxjdWxhdG9yLFxuICBjcmVhdGVIZWFsdGhNZXRyaWNzQ2FsY3VsYXRvcixcbiAgY29tcHV0ZUhlYWx0aFNuYXBzaG90LFxufSBmcm9tICcuL2hlYWx0aF9tZXRyaWNzJztcbmV4cG9ydCB0eXBlIHsgSGVhbHRoTWV0cmljc0NvbmZpZywgSGVhbHRoQ2FsY3VsYXRpb25Db250ZXh0IH0gZnJvbSAnLi9oZWFsdGhfbWV0cmljcyc7XG5cbi8vIE9wcyBTdW1tYXJ5ICg1RClcbmV4cG9ydCB7XG4gIE9wc1N1bW1hcnlHZW5lcmF0b3IsXG4gIGNyZWF0ZU9wc1N1bW1hcnlHZW5lcmF0b3IsXG4gIGJ1aWxkT3BzU3VtbWFyeSxcbn0gZnJvbSAnLi9vcHNfc3VtbWFyeSc7XG5leHBvcnQgdHlwZSB7IE9wc1N1bW1hcnlHZW5lcmF0b3JDb25maWcgfSBmcm9tICcuL29wc19zdW1tYXJ5JztcbiJdfQ==