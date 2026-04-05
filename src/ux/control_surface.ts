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

import type {
  ControlSurfaceSnapshot,
  ControlAction,
  ControlActionResult,
  ControlSurfaceConfig,
  TaskView,
  ApprovalView,
  OpsViewModel,
  AgentView,
} from './control_types';
import { TaskViewBuilder } from './task_view';
import { ApprovalViewBuilder } from './approval_view';
import { OpsViewBuilder } from './ops_view';
import { AgentViewBuilder } from './agent_view';

// ============================================================================
// 控制面构建器
// ============================================================================

export class ControlSurfaceBuilder {
  private config: Required<ControlSurfaceConfig>;
  private taskViewBuilder: TaskViewBuilder;
  private approvalViewBuilder: ApprovalViewBuilder;
  private opsViewBuilder: OpsViewBuilder;
  private agentViewBuilder: AgentViewBuilder;
  
  constructor(
    taskViewBuilder: TaskViewBuilder,
    approvalViewBuilder: ApprovalViewBuilder,
    opsViewBuilder: OpsViewBuilder,
    agentViewBuilder: AgentViewBuilder,
    config: ControlSurfaceConfig = {}
  ) {
    this.config = {
      autoRefreshIntervalMs: config.autoRefreshIntervalMs ?? 30000, // 30 秒
      maxTaskViewCount: config.maxTaskViewCount ?? 50,
      maxApprovalViewCount: config.maxApprovalViewCount ?? 50,
      defaultTimeWindowMs: config.defaultTimeWindowMs ?? 24 * 60 * 60 * 1000, // 24 小时
    };
    this.taskViewBuilder = taskViewBuilder;
    this.approvalViewBuilder = approvalViewBuilder;
    this.opsViewBuilder = opsViewBuilder;
    this.agentViewBuilder = agentViewBuilder;
  }
  
  /**
   * 构建控制面快照
   */
  async buildControlSurfaceSnapshot(): Promise<ControlSurfaceSnapshot> {
    const now = Date.now();
    
    // 并行构建所有视图
    const [taskView, approvalView, opsView, agentView] = await Promise.all([
      this.taskViewBuilder.buildTaskView(),
      this.approvalViewBuilder.buildApprovalView(),
      this.opsViewBuilder.buildOpsView(),
      this.agentViewBuilder.buildAgentView(),
    ]);
    
    // 计算摘要
    const summary = this.calculateSummary(taskView, approvalView, opsView, agentView);
    
    // 获取可用动作
    const availableActions = this.getAvailableActions(taskView, approvalView, opsView, agentView);
    
    return {
      snapshotId: `snapshot_${now}`,
      createdAt: now,
      taskView,
      approvalView,
      opsView,
      agentView,
      availableActions,
      summary,
    };
  }
  
  /**
   * 分发控制动作
   */
  async dispatchControlAction(action: ControlAction): Promise<ControlActionResult> {
    switch (action.type) {
      // Task 动作
      case 'cancel_task':
        return await this.taskViewBuilder.cancelTask(action.targetId);
      
      case 'retry_task':
        return await this.taskViewBuilder.retryTask(action.targetId);
      
      case 'pause_task':
        return await this.taskViewBuilder.pauseTask(action.targetId);
      
      // Approval 动作
      case 'approve':
        return await this.approvalViewBuilder.approve(action.targetId);
      
      case 'reject':
        return await this.approvalViewBuilder.reject(action.targetId);
      
      case 'escalate_approval':
        return await this.approvalViewBuilder.escalate(action.targetId);
      
      // Ops 动作
      case 'ack_incident':
        return await this.opsViewBuilder.ackIncident(action.targetId);
      
      case 'request_replay':
        return await this.opsViewBuilder.requestReplay(action.targetId);
      
      case 'request_recovery':
        return await this.opsViewBuilder.requestRecovery(action.targetId);
      
      // Agent 动作
      case 'pause_agent':
        return await this.agentViewBuilder.pauseAgent(action.targetId);
      
      case 'resume_agent':
        return await this.agentViewBuilder.resumeAgent(action.targetId);
      
      case 'inspect_agent':
        return await this.agentViewBuilder.inspectAgent(action.targetId);
      
      default:
        return {
          success: false,
          actionType: action.type,
          targetId: action.targetId,
          error: `Unknown action type: ${action.type}`,
        };
    }
  }
  
  /**
   * 刷新控制面
   */
  async refreshSurface(): Promise<ControlSurfaceSnapshot> {
    return await this.buildControlSurfaceSnapshot();
  }
  
  /**
   * 获取可用动作
   */
  getAvailableActions(
    taskView: TaskView,
    approvalView: ApprovalView,
    opsView: OpsViewModel,
    agentView: AgentView
  ): ControlAction[] {
    const actions: ControlAction[] = [];
    const now = Date.now();
    
    // Task 相关动作
    for (const task of taskView.blockedTasks.slice(0, 3)) {
      actions.push({
        type: 'retry_task',
        targetType: 'task',
        targetId: task.taskId,
        requestedBy: 'system',
        requestedAt: now,
      });
    }
    
    for (const task of taskView.failedTasks.slice(0, 3)) {
      actions.push({
        type: 'retry_task',
        targetType: 'task',
        targetId: task.taskId,
        requestedBy: 'system',
        requestedAt: now,
      });
    }
    
    // Approval 相关动作
    for (const approval of approvalView.pendingApprovals.slice(0, 3)) {
      actions.push({
        type: 'approve',
        targetType: 'approval',
        targetId: approval.approvalId,
        requestedBy: 'system',
        requestedAt: now,
      });
      
      actions.push({
        type: 'reject',
        targetType: 'approval',
        targetId: approval.approvalId,
        requestedBy: 'system',
        requestedAt: now,
      });
    }
    
    // Ops 相关动作
    for (const incident of opsView.activeIncidents.slice(0, 3)) {
      if (!incident.acknowledged) {
        actions.push({
          type: 'ack_incident',
          targetType: 'incident',
          targetId: incident.id,
          requestedBy: 'system',
          requestedAt: now,
        });
      }
    }
    
    // Agent 相关动作
    for (const agent of agentView.blockedAgents.slice(0, 2)) {
      actions.push({
        type: 'inspect_agent',
        targetType: 'agent',
        targetId: agent.agentId,
        requestedBy: 'system',
        requestedAt: now,
      });
    }
    
    return actions;
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 计算摘要
   */
  private calculateSummary(
    taskView: TaskView,
    approvalView: ApprovalView,
    opsView: OpsViewModel,
    agentView: AgentView
  ): ControlSurfaceSnapshot['summary'] {
    // 计算需要关注的项数
    let attentionItems = 0;
    
    // 阻塞任务
    attentionItems += taskView.blockedTasks.length;
    
    // 失败任务
    attentionItems += taskView.failedTasks.length;
    
    // 待处理审批
    attentionItems += approvalView.pendingApprovals.length;
    
    // 超时审批
    attentionItems += approvalView.timeoutApprovals.length;
    
    // 降级 Server
    attentionItems += opsView.degradedServers.length;
    
    // 被阻塞 Skill
    attentionItems += opsView.blockedSkills.length;
    
    // 不健康 Agent
    attentionItems += agentView.unhealthyAgents.length;
    
    // 阻塞 Agent
    attentionItems += agentView.blockedAgents.length;
    
    return {
      totalTasks: taskView.totalTasks,
      pendingApprovals: approvalView.totalApprovals,
      healthScore: opsView.healthScore,
      activeAgents: agentView.totalAgents - agentView.offlineAgents.length,
      attentionItems,
    };
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建控制面构建器
 */
export function createControlSurfaceBuilder(
  taskViewBuilder: TaskViewBuilder,
  approvalViewBuilder: ApprovalViewBuilder,
  opsViewBuilder: OpsViewBuilder,
  agentViewBuilder: AgentViewBuilder,
  config?: ControlSurfaceConfig
): ControlSurfaceBuilder {
  return new ControlSurfaceBuilder(
    taskViewBuilder,
    approvalViewBuilder,
    opsViewBuilder,
    agentViewBuilder,
    config
  );
}

/**
 * 快速构建控制面快照
 */
export async function buildControlSurfaceSnapshot(
  taskViewBuilder: TaskViewBuilder,
  approvalViewBuilder: ApprovalViewBuilder,
  opsViewBuilder: OpsViewBuilder,
  agentViewBuilder: AgentViewBuilder
): Promise<ControlSurfaceSnapshot> {
  const builder = new ControlSurfaceBuilder(
    taskViewBuilder,
    approvalViewBuilder,
    opsViewBuilder,
    agentViewBuilder
  );
  return await builder.buildControlSurfaceSnapshot();
}
