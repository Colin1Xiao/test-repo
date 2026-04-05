/**
 * Operator Execution Bridge
 * Phase 2A-1R′ - 真实动作执行桥接
 *
 * 职责：
 * - 承接 OperatorCommandDispatch 的真实动作调用
 * - 向下调用 ControlSurface / ApprovalWorkflow / IncidentWorkflow
 * - 区分 real / simulated 执行模式
 * - 返回 ExecutionResult
 */
import type { ControlSurfaceBuilder } from '../ux/control_surface';
import type { HumanLoopService } from '../ux/human_loop_service';
import type { ControlActionResult } from '../ux/control_types';
import type { ExecutionPolicy } from './operator_execution_policy';
import type { TaskDataSource } from '../data/task_data_source';
import type { ApprovalDataSource } from '../data/approval_data_source';
import type { IncidentDataSource } from '../data/incident_data_source';
import type { AgentDataSource } from '../data/agent_data_source';
export type ExecutionMode = "real" | "simulated" | "unsupported";
export interface ExecutionResult {
    /** 是否成功 */
    success: boolean;
    /** 执行模式 */
    executionMode: ExecutionMode;
    /** 动作类型 */
    actionType: string;
    /** 目标 ID */
    targetId?: string;
    /** 结果消息 */
    message: string;
    /** 错误信息（如果失败） */
    error?: string;
    /** 底层控制动作结果（如果有） */
    controlResult?: ControlActionResult;
    /** 执行时间戳 */
    executedAt: number;
}
export interface OperatorExecutionBridge {
    /**
     * 批准审批
     */
    approveApproval(id: string, actorId?: string): Promise<ExecutionResult>;
    /**
     * 拒绝审批
     */
    rejectApproval(id: string, actorId?: string): Promise<ExecutionResult>;
    /**
     * 确认事件
     */
    ackIncident(id: string, actorId?: string): Promise<ExecutionResult>;
    /**
     * 重试任务
     */
    retryTask(id: string, actorId?: string): Promise<ExecutionResult>;
    /**
     * 暂停 Agent
     */
    pauseAgent(id: string, actorId?: string): Promise<ExecutionResult>;
    /**
     * 恢复 Agent
     */
    resumeAgent(id: string, actorId?: string): Promise<ExecutionResult>;
    /**
     * 检查 Agent
     */
    inspectAgent(id: string, actorId?: string): Promise<ExecutionResult>;
    /**
     * 取消任务
     */
    cancelTask(id: string, actorId?: string): Promise<ExecutionResult>;
    /**
     * 暂停任务
     */
    pauseTask(id: string, actorId?: string): Promise<ExecutionResult>;
    /**
     * 恢复任务
     */
    resumeTask(id: string, actorId?: string): Promise<ExecutionResult>;
    /**
     * 升级审批/事件
     */
    escalate(targetType: string, id: string, actorId?: string): Promise<ExecutionResult>;
    /**
     * 请求恢复
     */
    requestRecovery(id: string, actorId?: string): Promise<ExecutionResult>;
    /**
     * 请求重放
     */
    requestReplay(id: string, actorId?: string): Promise<ExecutionResult>;
}
export interface OperatorExecutionBridgeConfig {
    /** 是否启用真实执行（默认 false = 模拟模式） */
    enableRealExecution?: boolean;
    /** ControlSurfaceBuilder 实例（用于真实执行） */
    controlSurfaceBuilder?: ControlSurfaceBuilder;
    /** HumanLoopService 实例（用于 HITL 动作） */
    humanLoopService?: HumanLoopService;
    /** 执行策略（用于 per-action 控制） */
    executionPolicy?: ExecutionPolicy;
    /** 数据源（用于状态同步） */
    taskDataSource?: TaskDataSource;
    approvalDataSource?: ApprovalDataSource;
    incidentDataSource?: IncidentDataSource;
    agentDataSource?: AgentDataSource;
}
export declare class DefaultOperatorExecutionBridge implements OperatorExecutionBridge {
    private config;
    constructor(config?: OperatorExecutionBridgeConfig);
    approveApproval(id: string, actorId?: string): Promise<ExecutionResult>;
    rejectApproval(id: string, actorId?: string): Promise<ExecutionResult>;
    ackIncident(id: string, actorId?: string): Promise<ExecutionResult>;
    retryTask(id: string, actorId?: string): Promise<ExecutionResult>;
    pauseAgent(id: string, actorId?: string): Promise<ExecutionResult>;
    resumeAgent(id: string, actorId?: string): Promise<ExecutionResult>;
    inspectAgent(id: string, actorId?: string): Promise<ExecutionResult>;
    cancelTask(id: string, actorId?: string): Promise<ExecutionResult>;
    pauseTask(id: string, actorId?: string): Promise<ExecutionResult>;
    resumeTask(id: string, actorId?: string): Promise<ExecutionResult>;
    escalate(targetType: string, id: string, actorId?: string): Promise<ExecutionResult>;
    requestRecovery(id: string, actorId?: string): Promise<ExecutionResult>;
    requestReplay(id: string, actorId?: string): Promise<ExecutionResult>;
    /**
     * 获取动作的执行模式
     */
    private getExecutionMode;
    private buildSimulatedResult;
    /**
     * 启用真实执行
     */
    enableRealExecution(): void;
    /**
     * 禁用真实执行（模拟模式）
     */
    disableRealExecution(): void;
    /**
     * 检查是否启用真实执行
     */
    isRealExecutionEnabled(): boolean;
    /**
     * 设置动作的执行模式
     */
    setExecutionMode(actionType: string, mode: ExecutionMode): void;
    /**
     * 获取执行策略状态
     */
    getExecutionPolicyState(): any;
}
export declare function createOperatorExecutionBridge(config?: OperatorExecutionBridgeConfig, executionPolicy?: ExecutionPolicy): OperatorExecutionBridge;
