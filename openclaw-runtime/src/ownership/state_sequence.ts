/**
 * Phase 2E-4B: State Sequence Validator
 * 
 * 负责验证状态迁移的顺序合法性，防止非法状态转换。
 * 
 * 覆盖四条核心流：
 * 1. approvals: pending → approved/rejected → resolved
 * 2. incidents: open → acknowledged → resolving → resolved
 * 3. risk_state: normal → warning → critical → recovery → normal
 * 4. deployments: planned → in_progress → validating → completed/rolled_back
 */

import { AuditLogFileService, getAuditLogFileService } from '../persistence/audit_log_file_service.js';

// ==================== Types ====================

export type StateMachineId = 'approvals' | 'incidents' | 'risk_state' | 'deployments';

export type State = string;

export interface StateTransition {
  from: State;
  to: State;
  allowed: boolean;
  reason?: string;
}

export interface StateMachineDefinition {
  id: StateMachineId;
  initial_state: State;
  terminal_states: State[];
  transitions: Record<State, State[]>;  // from → [allowed to states]
  metadata?: Record<string, unknown>;
}

export type StateTransitionResult = {
  success: true;
  previous_state: State;
  new_state: State;
  transition: StateTransition;
} | {
  success: false;
  error: 'INVALID_TRANSITION' | 'STATE_NOT_FOUND' | 'TERMINAL_STATE' | 'CONCURRENT_MODIFICATION';
  message: string;
  current_state?: State;
  allowed_transitions?: State[];
};

export interface StateObject {
  id: string;
  machine_id: StateMachineId;
  current_state: State;
  version: number;           // 乐观锁版本号
  updated_at: number;        // 最后更新时间 (ms)
  metadata?: Record<string, unknown>;
}

// ==================== State Machine Definitions ====================

/**
 * Approvals 状态机
 * 
 * pending → approved | rejected
 * approved → resolved
 * rejected → resolved | pending (re-submit)
 */
export const APPROVALS_MACHINE: StateMachineDefinition = {
  id: 'approvals',
  initial_state: 'pending',
  terminal_states: ['resolved'],
  transitions: {
    'pending': ['approved', 'rejected'],
    'approved': ['resolved'],
    'rejected': ['resolved', 'pending'],
    'resolved': [],  // terminal
  },
  metadata: {
    description: '审批流程状态机',
    owner: 'recovery-coordinator',
  },
};

/**
 * Incidents 状态机
 * 
 * open → acknowledged → resolving → resolved
 * open → resolved (auto-close)
 * acknowledged → resolved
 * resolving → resolved | open (re-open)
 */
export const INCIDENTS_MACHINE: StateMachineDefinition = {
  id: 'incidents',
  initial_state: 'open',
  terminal_states: ['resolved'],
  transitions: {
    'open': ['acknowledged', 'resolved'],
    'acknowledged': ['resolving', 'resolved'],
    'resolving': ['resolved', 'open'],
    'resolved': [],  // terminal
  },
  metadata: {
    description: '事件管理状态机',
    owner: 'recovery-coordinator',
  },
};

/**
 * Risk State 状态机
 * 
 * normal → warning → critical
 * critical → recovery → normal
 * warning → normal (de-escalation)
 * recovery → normal | warning (setback)
 */
export const RISK_STATE_MACHINE: StateMachineDefinition = {
  id: 'risk_state',
  initial_state: 'normal',
  terminal_states: [],  // 无终端状态，循环
  transitions: {
    'normal': ['warning'],
    'warning': ['critical', 'normal'],
    'critical': ['recovery'],
    'recovery': ['normal', 'warning'],
  },
  metadata: {
    description: '风险状态状态机',
    owner: 'risk-manager',
  },
};

/**
 * Deployments 状态机
 * 
 * planned → in_progress → validating → completed
 * in_progress → rolled_back (failure)
 * validating → completed | rolled_back
 * rolled_back → planned (retry)
 */
export const DEPLOYMENTS_MACHINE: StateMachineDefinition = {
  id: 'deployments',
  initial_state: 'planned',
  terminal_states: ['completed'],  // rolled_back 可以重试，不是 terminal
  transitions: {
    'planned': ['in_progress'],
    'in_progress': ['validating', 'rolled_back'],
    'validating': ['completed', 'rolled_back'],
    'completed': [],  // terminal
    'rolled_back': ['planned'],
  },
  metadata: {
    description: '部署流程状态机',
    owner: 'deployment-manager',
  },
};

// ==================== Registry ====================

export const STATE_MACHINES: Record<StateMachineId, StateMachineDefinition> = {
  'approvals': APPROVALS_MACHINE,
  'incidents': INCIDENTS_MACHINE,
  'risk_state': RISK_STATE_MACHINE,
  'deployments': DEPLOYMENTS_MACHINE,
};

// ==================== State Sequence Validator ====================

export class StateSequenceValidator {
  private readonly audit: AuditLogFileService;
  private readonly machines: Record<StateMachineId, StateMachineDefinition>;

  constructor(
    audit: AuditLogFileService,
    customMachines?: Partial<Record<StateMachineId, StateMachineDefinition>>
  ) {
    this.audit = audit;
    this.machines = { ...STATE_MACHINES, ...customMachines };
  }

  /**
   * 验证状态转换是否合法
   */
  validateTransition(
    machine_id: StateMachineId,
    from_state: State,
    to_state: State
  ): StateTransition {
    const machine = this.machines[machine_id];
    if (!machine) {
      return {
        from: from_state,
        to: to_state,
        allowed: false,
        reason: `Unknown state machine: ${machine_id}`,
      };
    }

    const allowedTransitions = machine.transitions[from_state];
    if (!allowedTransitions) {
      return {
        from: from_state,
        to: to_state,
        allowed: false,
        reason: `Invalid source state: ${from_state}`,
      };
    }

    const isAllowed = allowedTransitions.includes(to_state);
    return {
      from: from_state,
      to: to_state,
      allowed: isAllowed,
      reason: isAllowed
        ? undefined
        : `Transition ${from_state} → ${to_state} not allowed. Allowed: ${allowedTransitions.join(', ')}`,
    };
  }

  /**
   * 检查状态是否为终端状态
   */
  isTerminalState(machine_id: StateMachineId, state: State): boolean {
    const machine = this.machines[machine_id];
    if (!machine) return false;
    return machine.terminal_states.includes(state);
  }

  /**
   * 获取允许的下一个状态列表
   */
  getAllowedTransitions(machine_id: StateMachineId, from_state: State): State[] {
    const machine = this.machines[machine_id];
    if (!machine) return [];
    return machine.transitions[from_state] || [];
  }

  /**
   * 执行状态转换（带乐观锁）
   * 
   * @param stateObject - 当前状态对象（包含 version）
   * @param new_state - 目标状态
   * @param expected_version - 期望的版本号（用于乐观锁）
   */
  async transition(
    stateObject: StateObject,
    new_state: State,
    expected_version?: number
  ): Promise<StateTransitionResult> {
    const machine = this.machines[stateObject.machine_id];
    if (!machine) {
      return {
        success: false,
        error: 'STATE_NOT_FOUND',
        message: `Unknown state machine: ${stateObject.machine_id}`,
      };
    }

    // 检查版本号（乐观锁）
    if (expected_version !== undefined && stateObject.version !== expected_version) {
      return {
        success: false,
        error: 'CONCURRENT_MODIFICATION',
        message: `Version mismatch: expected ${expected_version}, got ${stateObject.version}`,
        current_state: stateObject.current_state,
      };
    }

    // 检查是否为终端状态
    if (machine.terminal_states.includes(stateObject.current_state)) {
      return {
        success: false,
        error: 'TERMINAL_STATE',
        message: `Cannot transition from terminal state: ${stateObject.current_state}`,
        current_state: stateObject.current_state,
      };
    }

    // 验证转换
    const transition = this.validateTransition(
      stateObject.machine_id,
      stateObject.current_state,
      new_state
    );

    if (!transition.allowed) {
      const allowedTransitions = this.getAllowedTransitions(
        stateObject.machine_id,
        stateObject.current_state
      );
      
      await this.audit.log({
        event_type: 'state_transition_rejected',
        object_type: 'state_object',
        object_id: stateObject.id,
        metadata: {
          machine_id: stateObject.machine_id,
          from: stateObject.current_state,
          to: new_state,
          reason: transition.reason,
        },
      });

      return {
        success: false,
        error: 'INVALID_TRANSITION',
        message: transition.reason || 'Invalid transition',
        current_state: stateObject.current_state,
        allowed_transitions: allowedTransitions,
      };
    }

    // 执行转换
    const previous_state = stateObject.current_state;
    stateObject.current_state = new_state;
    stateObject.version++;
    stateObject.updated_at = Date.now();

    await this.audit.log({
      event_type: 'state_transition_completed',
      object_type: 'state_object',
      object_id: stateObject.id,
      metadata: {
        machine_id: stateObject.machine_id,
        from: previous_state,
        to: new_state,
        version: stateObject.version,
      },
    });

    return {
      success: true,
      previous_state,
      new_state,
      transition,
    };
  }

  /**
   * 获取状态机的初始状态
   */
  getInitialState(machine_id: StateMachineId): State {
    const machine = this.machines[machine_id];
    if (!machine) {
      throw new Error(`Unknown state machine: ${machine_id}`);
    }
    return machine.initial_state;
  }

  /**
   * 创建新的状态对象
   */
  createStateObject(
    id: string,
    machine_id: StateMachineId,
    metadata?: Record<string, unknown>
  ): StateObject {
    const machine = this.machines[machine_id];
    if (!machine) {
      throw new Error(`Unknown state machine: ${machine_id}`);
    }

    return {
      id,
      machine_id,
      current_state: machine.initial_state,
      version: 1,
      updated_at: Date.now(),
      metadata,
    };
  }

  /**
   * 验证状态对象是否处于合法状态
   */
  validateStateObject(stateObject: StateObject): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const machine = this.machines[stateObject.machine_id];

    if (!machine) {
      errors.push(`Unknown state machine: ${stateObject.machine_id}`);
      return { valid: false, errors };
    }

    // 检查状态是否在状态机中定义
    const allStates = new Set([
      ...Object.keys(machine.transitions),
      ...machine.terminal_states,
    ]);

    if (!allStates.has(stateObject.current_state)) {
      errors.push(`Invalid state: ${stateObject.current_state}`);
    }

    // 检查版本号
    if (stateObject.version < 1) {
      errors.push(`Invalid version: ${stateObject.version}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// ==================== Convenience Functions ====================

/**
 * 快速检查状态转换是否合法
 */
export function canTransition(
  machine_id: StateMachineId,
  from: State,
  to: State
): boolean {
  const machine = STATE_MACHINES[machine_id];
  if (!machine) return false;
  
  const allowed = machine.transitions[from];
  if (!allowed) return false;
  
  return allowed.includes(to);
}

/**
 * 获取所有允许的转换
 */
export function getAllowedTransitions(
  machine_id: StateMachineId,
  from: State
): State[] {
  const machine = STATE_MACHINES[machine_id];
  if (!machine) return [];
  return machine.transitions[from] || [];
}

/**
 * 获取状态机的所有状态
 */
export function getAllStates(machine_id: StateMachineId): State[] {
  const machine = STATE_MACHINES[machine_id];
  if (!machine) return [];
  
  const states = new Set<State>([
    ...Object.keys(machine.transitions),
    ...machine.terminal_states,
  ]);
  
  return Array.from(states);
}
