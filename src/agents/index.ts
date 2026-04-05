/**
 * Agent Teams / Subagents - 统一导出
 * 
 * @version v0.1.0
 * @date 2026-04-03
 * 
 * Sprint 1-D: 接入 OpenClaw 主干 runtime
 * Sprint 1-E: 真实模型调用执行层
 * Sprint 1-F: 并发限制与资源治理
 */

// ============================================================================
// 类型导出
// ============================================================================

export type {
  // 核心类型
  SubagentTask,
  SubagentResult,
  TeamContext,
  TeamRun,
  HandoffRecord,
  
  // 枚举类型
  SubagentStatus,
  TeamStatus,
  SubagentRole,
  
  // 预算
  BudgetSpec,
  BudgetUsage,
  
  // 产出物
  ArtifactRef,
  PatchRef,
  Finding,
  
  // 接口
  ITeamOrchestrator,
  ISubagentRunner,
  IDelegationPolicy,
  
  // 参数类型
  CreateTeamParams,
  DelegateTaskParams,
  WaitForOptions,
  TaskDefinition,
  AgentRoleConfig,
  
  // 策略类型
  DelegationDecision,
  BudgetAllocation,
  PermissionValidation,
  
  // 归并结果
  MergedResult,
  
  // 角色配置
  AgentRoleDefaults,
} from "./types";

export {
  AGENT_ROLE_DEFAULTS,
} from "./types";

// ============================================================================
// 状态机导出
// ============================================================================

export type {
  TransitionMeta,
  TransitionResult,
  TeamTransitionResult,
} from "./state_machine";

export {
  // 转换表
  SUBAGENT_STATE_TRANSITIONS,
  TEAM_STATE_TRANSITIONS,
  
  // 守卫函数
  canTransitionSubagent,
  canTransitionTeam,
  getNextStates,
  getNextTeamStates,
  isTerminalState,
  isTerminalTeamState,
  
  // 转换器
  transitionSubagent,
  transitionTeam,
  
  // 便捷方法
  startTask,
  completeTask,
  failTask,
  timeoutTask,
  budgetExceededTask,
  cancelTask,
  retryTask,
  
  completeTeam,
  failTeam,
  cancelTeam,
  
  // 查询工具
  getTaskDuration,
  getTeamDuration,
  isRetryable,
  isRunning,
  isComplete,
  isTeamComplete,
  getActiveTasks,
  getSuccessfulTasks,
  getFailedTasks,
} from "./state_machine";

// ============================================================================
// Subagent Runner 导出
// ============================================================================

export type {
  ISubagentRunner as ISubagentRunnerImpl,
  HookEventType,
  HookEvent,
  SubagentStartEvent,
  SubagentStopEvent,
  SubagentFailEvent,
  SubagentTimeoutEvent,
  SubagentHandoffEvent,
  SubagentBudgetExceededEvent,
  IHookBus,
} from "./subagent_runner";

export {
  SubagentRunner,
  NoOpHookBus,
  createSubagentRunner,
} from "./subagent_runner";

// ============================================================================
// Team Orchestrator 导出
// ============================================================================

export type {
  TeamHookEventType,
  TeamHookEvent,
  TeamCreateEvent,
  TeamCompleteEvent,
  TeamFailEvent,
  TeamCancelEvent,
  TeamMergeEvent,
} from "./team_orchestrator";

export {
  TeamOrchestrator,
  createTeamOrchestrator,
  runTeam,
} from "./team_orchestrator";

// ============================================================================
// Delegation Policy 导出
// ============================================================================

export {
  DelegationPolicy,
  createDelegationPolicy,
  quickCheckDelegation,
} from "./delegation_policy";

// ============================================================================
// HookBus 导出
// ============================================================================

export type {
  AgentTeamHookEvent,
  AgentTeamHookType,
  HookHandler,
  IAgentTeamHookBus,
} from "./hooks";

export {
  AgentTeamHookBus,
  createLoggingHandler,
  createAuditHandler,
  createNotificationHandler,
  createAgentTeamHookBus,
  
  // 查询工具
  isSubagentEvent,
  isTeamEvent,
  isFailureEvent,
  getTeamIdFromEvent,
  getTaskIdFromEvent,
} from "./hooks";

// ============================================================================
// ExecutionContext 集成（Sprint 1-D）
// ============================================================================

export type {
  SubagentExecutionContext,
  DeriveContextConfig,
  ContextConversionResult,
} from './execution_context_adapter';

export {
  ExecutionContextAdapter,
  createExecutionContextAdapter,
  deriveSubagentContext,
} from './execution_context_adapter';

export type {
  SubagentPermissionCheck,
  IPermissionBridge,
} from './permission_bridge';

export {
  PermissionBridge,
  createPermissionBridge,
  canAccessTool,
  ROLE_TOOL_MATRIX,
  requiresApproval,
} from './permission_bridge';

export type {
  SubagentTaskType,
  SubagentTaskInput,
  ITaskStoreBridge,
} from './taskstore_bridge';

export {
  TaskStoreBridge,
  createTaskStoreBridge,
  createSubagentTaskQuick,
} from './taskstore_bridge';

// ============================================================================
// 真实模型调用执行层（Sprint 1-E）
// ============================================================================

export type {
  // Model Invoker
  ModelInvokeRequest,
  ModelInvokeResponse,
  IModelProvider,
  IModelInvoker,
} from './model_invoker';

export type {
  // Role Prompt Builder
  PromptBuildInput,
  PromptBuildResult,
} from './role_prompt_builder';

export type {
  // Usage Meter
  InvocationRecord,
  RoleUsageStats,
  TeamUsageStats,
  BudgetTracker,
  IUsageMeter,
} from './usage_meter';

export type {
  // Result Normalizer
  NormalizationInput,
  ParsedResult,
} from './result_normalizer';

export type {
  // Subagent Executor
  ExecutorConfig,
  ExecuteInput,
  ExecuteResult,
} from './subagent_executor';

export type {
  // Retry Policy
  RetryPolicyConfig,
  RetryContext,
  RetryableErrorType,
} from './retry_policy';

export type {
  // Timeout Guard
  TimeoutGuardConfig,
  TimeoutResult,
} from './timeout_guard';

export {
  // Model Invoker
  ModelInvoker,
  OpenClawModelProvider,
  createModelInvoker,
  invokeModel,
  isRetryableError,
} from './model_invoker';

export {
  // Role Prompt Builder
  RolePromptBuilder,
  createRolePromptBuilder,
  buildRolePrompt,
  getRoleSystemPrompt,
} from './role_prompt_builder';

export {
  // Usage Meter
  UsageMeter,
  TokenEstimator,
  createUsageMeter,
  createTokenEstimator,
  estimateTokens,
} from './usage_meter';

export {
  // Result Normalizer
  ResultNormalizer,
  createResultNormalizer,
  normalizeResult,
} from './result_normalizer';

export {
  // Subagent Executor
  SubagentExecutor,
  createSubagentExecutor,
  executeSubagent,
} from './subagent_executor';

export {
  // Retry Policy
  RetryPolicy,
  createRetryPolicy,
  executeWithRetry,
  DEFAULT_RETRY_POLICY,
  AGGRESSIVE_RETRY_POLICY,
  CONSERVATIVE_RETRY_POLICY,
} from './retry_policy';

export {
  // Timeout Guard
  TimeoutGuard,
  TimeoutError,
  withTimeout,
  timeoutPromise,
  delay,
} from './timeout_guard';

// ============================================================================
// 并发限制与资源治理（Sprint 1-F）
// ============================================================================

export type {
  // Concurrency Limiter
  ConcurrencyConfig,
  ConcurrencyPermit,
  WaitQueueItem,
  ConcurrencyStats,
} from './concurrency_limiter';

export type {
  // Execution Queue
  QueueTaskStatus,
  QueueTask,
  ExecutionQueueConfig,
  QueueStats,
  DequeueOptions,
} from './execution_queue';

export type {
  // Scheduler
  SchedulerConfig,
  ScheduleDecision,
  SchedulerStats,
} from './scheduler';

export type {
  // Budget Governor
  BudgetType,
  BudgetConfig,
  BudgetUsage,
  AdmissionCheckInput,
  AdmissionCheckResult,
  BudgetStats,
} from './budget_governor';

export type {
  // Resource Locks
  LockType,
  LockStatus,
  ResourceLock,
  ResourceLocksConfig,
  LockStats,
} from './resource_locks';

export type {
  // Circuit Breaker
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerStats,
} from './circuit_breaker';

export type {
  // Backpressure
  PressureLevel,
  PressureMetrics,
  BackpressureConfig,
  BackpressureAction,
  BackpressureState,
} from './backpressure';

export type {
  // Governance Policy
  RoleWeightConfig,
  GovernancePolicyConfig,
  GovernancePolicy,
} from './governance_policy';

export {
  // Concurrency Limiter
  ConcurrencyLimiter,
  createConcurrencyLimiter,
  DEFAULT_CONCURRENCY_CONFIG,
  CONSERVATIVE_CONCURRENCY_CONFIG,
  AGGRESSIVE_CONCURRENCY_CONFIG,
} from './concurrency_limiter';

export {
  // Execution Queue
  ExecutionQueue,
  createExecutionQueue,
} from './execution_queue';

export {
  // Scheduler
  Scheduler,
  createScheduler,
} from './scheduler';

export {
  // Budget Governor
  BudgetGovernor,
  createBudgetGovernor,
  DEFAULT_BUDGET_CONFIG,
  CONSERVATIVE_BUDGET_CONFIG,
} from './budget_governor';

export {
  // Resource Locks
  ResourceLocks,
  createResourceLocks,
  ResourceKeyBuilder,
} from './resource_locks';

export {
  // Circuit Breaker
  CircuitBreaker,
  CircuitBreakerManager,
  createCircuitBreaker,
  createCircuitBreakerManager,
} from './circuit_breaker';

export {
  // Backpressure
  BackpressureController,
  createBackpressureController,
  DEFAULT_BACKPRESSURE_CONFIG,
} from './backpressure';

export {
  // Governance Policy
  GovernancePolicyManager,
  createGovernancePolicyManager,
  getDevelopmentPolicy,
  getStagingPolicy,
  getProductionPolicy,
} from './governance_policy';

// ============================================================================
// 预定义角色（未来扩展）
// ============================================================================

// 未来可在 roles/ 目录下实现真实角色
// export { plannerAgent } from "./roles/planner_agent";
// export { codeFixerAgent } from "./roles/code_fixer";
// export { verifyAgent } from "./roles/verify_agent";
