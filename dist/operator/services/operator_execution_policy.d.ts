/**
 * Operator Execution Policy
 * Phase 2A-1R′B - 执行策略控制
 *
 * 职责：
 * - 按动作类型控制 real / simulated 模式
 * - 提供安全的执行开关
 * - 支持逐步放开真实执行
 */
import type { OperatorActionType } from '../types/surface_types';
export type ExecutionMode = "real" | "simulated" | "unsupported";
export interface ExecutionPolicyConfig {
    /** 默认执行模式 */
    defaultMode?: ExecutionMode;
    /** 按动作类型的执行模式覆盖 */
    perAction?: Partial<Record<OperatorActionType, ExecutionMode>>;
    /** 是否启用真实执行（全局开关） */
    enableRealExecution?: boolean;
}
export interface ExecutionPolicy {
    /**
     * 获取动作的执行模式
     */
    getExecutionMode(actionType: OperatorActionType): ExecutionMode;
    /**
     * 检查动作是否支持真实执行
     */
    isRealExecution(actionType: OperatorActionType): boolean;
    /**
     * 启用全局真实执行
     */
    enableRealExecution(): void;
    /**
     * 禁用全局真实执行
     */
    disableRealExecution(): void;
    /**
     * 设置动作的执行模式
     */
    setExecutionMode(actionType: OperatorActionType, mode: ExecutionMode): void;
    /**
     * 获取当前策略状态
     */
    getPolicyState(): {
        defaultMode: ExecutionMode;
        perAction: Record<OperatorActionType, ExecutionMode>;
        globalEnabled: boolean;
    };
}
export declare class DefaultExecutionPolicy implements ExecutionPolicy {
    private defaultMode;
    private perAction;
    private globalEnabled;
    constructor(config?: ExecutionPolicyConfig);
    getExecutionMode(actionType: OperatorActionType): ExecutionMode;
    isRealExecution(actionType: OperatorActionType): boolean;
    enableRealExecution(): void;
    disableRealExecution(): void;
    setExecutionMode(actionType: OperatorActionType, mode: ExecutionMode): void;
    getPolicyState(): {
        defaultMode: ExecutionMode;
        perAction: Record<OperatorActionType, ExecutionMode>;
        globalEnabled: boolean;
    };
}
/**
 * 安全策略（默认）
 * - 所有动作 simulated
 */
export declare function createSafeExecutionPolicy(): ExecutionPolicy;
/**
 * 测试策略（2A-1R′B 推荐）
 * - retry_task: real
 * - ack_incident: real
 * - approve: real
 * - 其他：simulated
 */
export declare function create2A1RPrimeBExecutionPolicy(): ExecutionPolicy;
/**
 * 生产策略（未来）
 * - 所有控制动作 real
 * - 视图动作 simulated（不需要真实副作用）
 */
export declare function createProductionExecutionPolicy(): ExecutionPolicy;
export declare function createExecutionPolicy(config?: ExecutionPolicyConfig): ExecutionPolicy;
