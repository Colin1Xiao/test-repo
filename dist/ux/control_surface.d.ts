/**
 * Control Surface - 统一控制面
 *
 * 职责：
 * 1. 统一聚合 task / approval / ops / agent 四类视图
 * 2. 输出单个 ControlSurfaceSnapshot
 * 3. 提供统一动作分发入口
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { ControlSurfaceSnapshot, ControlAction, ControlActionResult, ControlSurfaceConfig, TaskView, ApprovalView, OpsViewModel, AgentView } from './control_types';
import { TaskViewBuilder } from './task_view';
import { ApprovalViewBuilder } from './approval_view';
import { OpsViewBuilder } from './ops_view';
import { AgentViewBuilder } from './agent_view';
export declare class ControlSurfaceBuilder {
    private config;
    private taskViewBuilder;
    private approvalViewBuilder;
    private opsViewBuilder;
    private agentViewBuilder;
    constructor(taskViewBuilder: TaskViewBuilder, approvalViewBuilder: ApprovalViewBuilder, opsViewBuilder: OpsViewBuilder, agentViewBuilder: AgentViewBuilder, config?: ControlSurfaceConfig);
    /**
     * 构建控制面快照
     */
    buildControlSurfaceSnapshot(): Promise<ControlSurfaceSnapshot>;
    /**
     * 分发控制动作
     */
    dispatchControlAction(action: ControlAction): Promise<ControlActionResult>;
    /**
     * 刷新控制面
     */
    refreshSurface(): Promise<ControlSurfaceSnapshot>;
    /**
     * 获取可用动作
     */
    getAvailableActions(taskView: TaskView, approvalView: ApprovalView, opsView: OpsViewModel, agentView: AgentView): ControlAction[];
    /**
     * 计算摘要
     */
    private calculateSummary;
}
/**
 * 创建控制面构建器
 */
export declare function createControlSurfaceBuilder(taskViewBuilder: TaskViewBuilder, approvalViewBuilder: ApprovalViewBuilder, opsViewBuilder: OpsViewBuilder, agentViewBuilder: AgentViewBuilder, config?: ControlSurfaceConfig): ControlSurfaceBuilder;
/**
 * 快速构建控制面快照
 */
export declare function buildControlSurfaceSnapshot(taskViewBuilder: TaskViewBuilder, approvalViewBuilder: ApprovalViewBuilder, opsViewBuilder: OpsViewBuilder, agentViewBuilder: AgentViewBuilder): Promise<ControlSurfaceSnapshot>;
