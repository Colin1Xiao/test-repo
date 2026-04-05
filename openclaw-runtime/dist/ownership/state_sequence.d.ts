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
import { AuditLogFileService } from '../persistence/audit_log_file_service.js';
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
    transitions: Record<State, State[]>;
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
    version: number;
    updated_at: number;
    metadata?: Record<string, unknown>;
}
/**
 * Approvals 状态机
 *
 * pending → approved | rejected
 * approved → resolved
 * rejected → resolved | pending (re-submit)
 */
export declare const APPROVALS_MACHINE: StateMachineDefinition;
/**
 * Incidents 状态机
 *
 * open → acknowledged → resolving → resolved
 * open → resolved (auto-close)
 * acknowledged → resolved
 * resolving → resolved | open (re-open)
 */
export declare const INCIDENTS_MACHINE: StateMachineDefinition;
/**
 * Risk State 状态机
 *
 * normal → warning → critical
 * critical → recovery → normal
 * warning → normal (de-escalation)
 * recovery → normal | warning (setback)
 */
export declare const RISK_STATE_MACHINE: StateMachineDefinition;
/**
 * Deployments 状态机
 *
 * planned → in_progress → validating → completed
 * in_progress → rolled_back (failure)
 * validating → completed | rolled_back
 * rolled_back → planned (retry)
 */
export declare const DEPLOYMENTS_MACHINE: StateMachineDefinition;
export declare const STATE_MACHINES: Record<StateMachineId, StateMachineDefinition>;
export declare class StateSequenceValidator {
    private readonly audit;
    private readonly machines;
    constructor(audit: AuditLogFileService, customMachines?: Partial<Record<StateMachineId, StateMachineDefinition>>);
    /**
     * 验证状态转换是否合法
     */
    validateTransition(machine_id: StateMachineId, from_state: State, to_state: State): StateTransition;
    /**
     * 检查状态是否为终端状态
     */
    isTerminalState(machine_id: StateMachineId, state: State): boolean;
    /**
     * 获取允许的下一个状态列表
     */
    getAllowedTransitions(machine_id: StateMachineId, from_state: State): State[];
    /**
     * 执行状态转换（带乐观锁）
     *
     * @param stateObject - 当前状态对象（包含 version）
     * @param new_state - 目标状态
     * @param expected_version - 期望的版本号（用于乐观锁）
     */
    transition(stateObject: StateObject, new_state: State, expected_version?: number): Promise<StateTransitionResult>;
    /**
     * 获取状态机的初始状态
     */
    getInitialState(machine_id: StateMachineId): State;
    /**
     * 创建新的状态对象
     */
    createStateObject(id: string, machine_id: StateMachineId, metadata?: Record<string, unknown>): StateObject;
    /**
     * 验证状态对象是否处于合法状态
     */
    validateStateObject(stateObject: StateObject): {
        valid: boolean;
        errors: string[];
    };
}
/**
 * 快速检查状态转换是否合法
 */
export declare function canTransition(machine_id: StateMachineId, from: State, to: State): boolean;
/**
 * 获取所有允许的转换
 */
export declare function getAllowedTransitions(machine_id: StateMachineId, from: State): State[];
/**
 * 获取状态机的所有状态
 */
export declare function getAllStates(machine_id: StateMachineId): State[];
//# sourceMappingURL=state_sequence.d.ts.map