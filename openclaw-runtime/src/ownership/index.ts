/**
 * Phase 2E-4B: Ownership & Ordering
 * 
 * 核心模块索引
 */

// Recovery Coordinator - Session 生命周期管理
export {
  RecoveryCoordinator,
  RecoverySession,
  RecoveryItem,
  SessionStartResult,
  SessionRenewResult,
  ItemClaimResult,
  ItemCompleteResult,
  SessionCompleteResult,
  RecoveryCoordinatorConfig,
  DEFAULT_RECOVERY_CONFIG,
} from './recovery_coordinator.js';

// State Sequence Validator - 状态迁移顺序验证
export {
  StateSequenceValidator,
  StateMachineId,
  State,
  StateTransition,
  StateMachineDefinition,
  StateTransitionResult,
  StateObject,
  APPROVALS_MACHINE,
  INCIDENTS_MACHINE,
  RISK_STATE_MACHINE,
  DEPLOYMENTS_MACHINE,
  STATE_MACHINES,
  canTransition,
  getAllowedTransitions,
  getAllStates,
} from './state_sequence.js';
