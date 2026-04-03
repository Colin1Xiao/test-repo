/**
 * Operator Snapshot Provider
 * Phase 2A-1R′A - 真实快照提供者
 * 
 * 职责：
 * - 组装多个 Data Source 成 ControlSurfaceSnapshot
 * - 提供真实数据源 + 降级数据源 + Mock 数据源的三层读取
 * - 标注数据来源模式（real / synthesized / mock）
 */

import type {
  ControlSurfaceSnapshot,
  TaskView,
  ApprovalView,
  OpsViewModel,
  AgentView,
  ControlAction,
} from '../ux/control_types';
import type { TaskDataSource } from './task_data_source';
import type { ApprovalDataSource } from './approval_data_source';
import type { IncidentDataSource, DegradedService, ReplayHotspot } from './incident_data_source';
import type { AgentDataSource } from './agent_data_source';

// ============================================================================
// 数据来源模式
// ============================================================================

export type DataSourceMode = "real" | "synthesized" | "mock";

export interface DataSourceHealth {
  task: DataSourceMode;
  approval: DataSourceMode;
  incident: DataSourceMode;
  agent: DataSourceMode;
}

// ============================================================================
// Snapshot Provider 接口
// ============================================================================

export interface OperatorSnapshotProvider {
  /**
   * 获取 ControlSurface 快照
   */
  getControlSnapshot(workspaceId?: string): Promise<ControlSurfaceSnapshot>;
  
  /**
   * 获取数据源健康状态
   */
  getDataSourceHealth(): Promise<DataSourceHealth>;
  
  /**
   * 刷新所有数据源
   */
  refresh(): Promise<void>;
  
  /**
   * 按域失效缓存
   */
  invalidate(domain?: 'task' | 'approval' | 'incident' | 'agent' | 'all'): void;
}

// ============================================================================
// 配置
// ============================================================================

export interface OperatorSnapshotProviderConfig {
  /** 默认 workspace ID */
  defaultWorkspaceId?: string;
  
  /** 数据刷新间隔（毫秒） */
  refreshIntervalMs?: number;
  
  /** 是否启用自动刷新 */
  enableAutoRefresh?: boolean;
}

// ============================================================================
// 默认实现
// ============================================================================

export class DefaultOperatorSnapshotProvider implements OperatorSnapshotProvider {
  private config: Required<OperatorSnapshotProviderConfig>;
  private taskDataSource: TaskDataSource | null = null;
  private approvalDataSource: ApprovalDataSource | null = null;
  private incidentDataSource: IncidentDataSource | null = null;
  private agentDataSource: AgentDataSource | null = null;
  
  // 缓存
  private snapshotCache: {
    snapshot: ControlSurfaceSnapshot | null;
    cachedAt: number;
    health: DataSourceHealth;
  } = {
    snapshot: null,
    cachedAt: 0,
    health: { task: 'mock', approval: 'mock', incident: 'mock', agent: 'mock' },
  };
  
  constructor(
    config: OperatorSnapshotProviderConfig = {},
    taskDataSource?: TaskDataSource,
    approvalDataSource?: ApprovalDataSource,
    incidentDataSource?: IncidentDataSource,
    agentDataSource?: AgentDataSource
  ) {
    this.config = {
      defaultWorkspaceId: config.defaultWorkspaceId ?? 'default',
      refreshIntervalMs: config.refreshIntervalMs ?? 30000,
      enableAutoRefresh: config.enableAutoRefresh ?? false,
    };
    
    this.taskDataSource = taskDataSource ?? null;
    this.approvalDataSource = approvalDataSource ?? null;
    this.incidentDataSource = incidentDataSource ?? null;
    this.agentDataSource = agentDataSource ?? null;
  }
  
  async getControlSnapshot(workspaceId?: string): Promise<ControlSurfaceSnapshot> {
    const wsId = workspaceId ?? this.config.defaultWorkspaceId;
    
    // 检查缓存
    const cached = this.snapshotCache.snapshot;
    if (cached && Date.now() - this.snapshotCache.cachedAt < this.config.refreshIntervalMs) {
      return cached;
    }
    
    // 构建新快照
    const snapshot = await this.buildSnapshot(wsId);
    
    // 更新缓存
    this.snapshotCache = {
      snapshot,
      cachedAt: Date.now(),
      health: await this.getDataSourceHealth(),
    };
    
    return snapshot;
  }
  
  async getDataSourceHealth(): Promise<DataSourceHealth> {
    return {
      task: this.taskDataSource ? 'real' : 'mock',
      approval: this.approvalDataSource ? 'real' : 'mock',
      incident: this.incidentDataSource ? 'real' : 'mock',
      agent: this.agentDataSource ? 'real' : 'mock',
    };
  }
  
  async refresh(): Promise<void> {
    // 清除缓存
    this.invalidate('all');
  }
  
  invalidate(domain: 'task' | 'approval' | 'incident' | 'agent' | 'all' = 'all'): void {
    // 清除缓存
    this.snapshotCache = {
      snapshot: null,
      cachedAt: 0,
      health: { task: 'mock', approval: 'mock', incident: 'mock', agent: 'mock' },
    };
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  private async buildSnapshot(workspaceId: string): Promise<ControlSurfaceSnapshot> {
    const now = Date.now();
    
    // 并行读取所有数据源
    const [taskView, approvalView, agentSummary, activeIncidents, degradedServices, replayHotspots] = await Promise.all([
      this.readTaskView(),
      this.readApprovalView(),
      this.readAgentSummary(),
      this.readActiveIncidents(),
      this.readDegradedServices(),
      this.readReplayHotspots(),
    ]);
    
    // 构建 OpsView
    const opsView: OpsViewModel = this.buildOpsView(activeIncidents, degradedServices, replayHotspots, approvalView);
    
    // 构建 AgentView
    const agentView = await this.readAgentView(agentSummary);
    
    // 计算摘要
    const summary = this.buildSummary(taskView, approvalView, opsView, agentView);
    
    // 获取可用动作
    const availableActions = this.buildAvailableActions(taskView, approvalView, opsView, agentView);
    
    return {
      snapshotId: `control_${workspaceId}_${now}`,
      createdAt: now,
      taskView,
      approvalView,
      opsView,
      agentView,
      availableActions,
      summary,
    };
  }
  
  private async readTaskView(): Promise<TaskView> {
    if (this.taskDataSource) {
      try {
        return await this.taskDataSource.getTaskView();
      } catch (error) {
        console.error('[OperatorSnapshotProvider] Failed to read task view:', error);
      }
    }
    
    // 降级：返回空视图
    return this.createEmptyTaskView();
  }
  
  private async readApprovalView(): Promise<ApprovalView> {
    if (this.approvalDataSource) {
      try {
        return await this.approvalDataSource.getApprovalView();
      } catch (error) {
        console.error('[OperatorSnapshotProvider] Failed to read approval view:', error);
      }
    }
    
    // 降级：返回空视图
    return this.createEmptyApprovalView();
  }
  
  private async readAgentSummary(): Promise<{
    total: number;
    busy: number;
    blocked: number;
    unhealthy: number;
    offline: number;
    avgHealthScore: number;
  }> {
    if (this.agentDataSource) {
      try {
        return await this.agentDataSource.getAgentSummary();
      } catch (error) {
        console.error('[OperatorSnapshotProvider] Failed to read agent summary:', error);
      }
    }
    
    // 降级：返回空统计
    return { total: 0, busy: 0, blocked: 0, unhealthy: 0, offline: 0, avgHealthScore: 100 };
  }
  
  private async readActiveIncidents(): Promise<Array<{
    id: string;
    type: string;
    severity: string;
    description: string;
    createdAt: number;
    acknowledged?: boolean;
  }>> {
    if (this.incidentDataSource) {
      try {
        const incidents = await this.incidentDataSource.getActiveIncidents(10);
        return incidents.map(i => ({
          id: i.id,
          type: i.type,
          severity: i.severity,
          description: i.description,
          createdAt: i.createdAt,
          acknowledged: i.acknowledged,
        }));
      } catch (error) {
        console.error('[OperatorSnapshotProvider] Failed to read incidents:', error);
      }
    }
    
    // 降级：返回空列表
    return [];
  }
  
  private async readDegradedServices(): Promise<DegradedService[]> {
    if (this.incidentDataSource) {
      try {
        return await this.incidentDataSource.getDegradedServices(5);
      } catch (error) {
        console.error('[OperatorSnapshotProvider] Failed to read degraded services:', error);
      }
    }
    
    return [];
  }
  
  private async readReplayHotspots(): Promise<ReplayHotspot[]> {
    if (this.incidentDataSource) {
      try {
        return await this.incidentDataSource.getReplayHotspots(5);
      } catch (error) {
        console.error('[OperatorSnapshotProvider] Failed to read replay hotspots:', error);
      }
    }
    
    return [];
  }
  
  private async readAgentView(agentSummary: any): Promise<AgentView> {
    if (this.agentDataSource) {
      try {
        const [busyAgents, blockedAgents, unhealthyAgents, offlineAgents] = await Promise.all([
          this.agentDataSource.getBusyAgents(10),
          this.agentDataSource.getBlockedAgents(10),
          this.agentDataSource.getUnhealthyAgents(10),
          this.agentDataSource.getOfflineAgents(10),
        ]);
        
        return {
          busyAgents,
          blockedAgents,
          unhealthyAgents,
          offlineAgents,
          totalAgents: agentSummary.total,
          loadSummary: {
            avgActiveTasks: busyAgents.reduce((sum, a) => sum + a.activeTaskCount, 0) / Math.max(1, busyAgents.length),
            avgFailureRate: busyAgents.reduce((sum, a) => sum + a.failureRate, 0) / Math.max(1, busyAgents.length),
            avgHealthScore: agentSummary.avgHealthScore,
          },
        };
      } catch (error) {
        console.error('[OperatorSnapshotProvider] Failed to read agent view:', error);
      }
    }
    
    // 降级：返回空视图
    return {
      busyAgents: [],
      blockedAgents: [],
      unhealthyAgents: [],
      offlineAgents: [],
      totalAgents: agentSummary.total,
    };
  }
  
  private buildOpsView(
    activeIncidents: any[],
    degradedServices: DegradedService[],
    replayHotspots: ReplayHotspot[],
    approvalView: ApprovalView
  ): OpsViewModel {
    // 计算健康评分
    const healthScore = this.calculateHealthScore(activeIncidents, degradedServices);
    
    // 确定总体状态
    let overallStatus: OpsViewModel['overallStatus'] = 'healthy';
    if (activeIncidents.some(i => i.severity === 'critical') || degradedServices.length > 2) {
      overallStatus = 'critical';
    } else if (activeIncidents.length > 0 || degradedServices.length > 0) {
      overallStatus = 'degraded';
    }
    
    return {
      overallStatus,
      healthScore,
      degradedServers: degradedServices,
      blockedSkills: [],
      pendingApprovals: approvalView.pendingApprovals.length,
      activeIncidents,
      topFailures: [],
      replayHotspots,
    };
  }
  
  private buildSummary(
    taskView: TaskView,
    approvalView: ApprovalView,
    opsView: OpsViewModel,
    agentView: AgentView
  ): ControlSurfaceSnapshot['summary'] {
    const attentionItems =
      taskView.blockedTasks.length +
      taskView.failedTasks.length +
      approvalView.pendingApprovals.length +
      approvalView.timeoutApprovals.length +
      opsView.degradedServers.length +
      opsView.activeIncidents.length +
      agentView.unhealthyAgents.length +
      agentView.blockedAgents.length;
    
    return {
      totalTasks: taskView.totalTasks,
      pendingApprovals: approvalView.pendingApprovals.length,
      healthScore: opsView.healthScore,
      activeAgents: agentView.totalAgents - agentView.offlineAgents.length,
      attentionItems,
    };
  }
  
  private buildAvailableActions(
    taskView: TaskView,
    approvalView: ApprovalView,
    opsView: OpsViewModel,
    agentView: AgentView
  ): ControlAction[] {
    const actions: ControlAction[] = [];
    const now = Date.now();
    
    // 为失败任务添加重试动作
    for (const task of taskView.failedTasks.slice(0, 3)) {
      actions.push({
        type: 'retry_task',
        targetType: 'task',
        targetId: task.taskId,
        requestedBy: 'system',
        requestedAt: now,
      });
    }
    
    // 为待处理审批添加批准动作
    for (const approval of approvalView.pendingApprovals.slice(0, 3)) {
      actions.push({
        type: 'approve',
        targetType: 'approval',
        targetId: approval.approvalId,
        requestedBy: 'system',
        requestedAt: now,
      });
    }
    
    // 为未确认事件添加确认动作
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
    
    return actions;
  }
  
  private calculateHealthScore(incidents: any[], degradedServices: DegradedService[]): number {
    let score = 100;
    
    // 事件扣分
    for (const incident of incidents) {
      if (incident.severity === 'critical') score -= 20;
      else if (incident.severity === 'high') score -= 10;
      else if (incident.severity === 'medium') score -= 5;
    }
    
    // 降级服务扣分
    for (const service of degradedServices) {
      if (service.status === 'unavailable') score -= 15;
      else if (service.status === 'degraded') score -= 5;
    }
    
    return Math.max(0, Math.min(100, score));
  }
  
  private createEmptyTaskView(): TaskView {
    return {
      activeTasks: [],
      blockedTasks: [],
      recentCompletedTasks: [],
      failedTasks: [],
      totalTasks: 0,
    };
  }
  
  private createEmptyApprovalView(): ApprovalView {
    return {
      pendingApprovals: [],
      bottlenecks: [],
      timeoutApprovals: [],
      recentDecidedApprovals: [],
      totalApprovals: 0,
    };
  }
  
  // ============================================================================
  // 设置方法
  // ============================================================================
  
  setTaskDataSource(dataSource: TaskDataSource): void {
    this.taskDataSource = dataSource;
  }
  
  setApprovalDataSource(dataSource: ApprovalDataSource): void {
    this.approvalDataSource = dataSource;
  }
  
  setIncidentDataSource(dataSource: IncidentDataSource): void {
    this.incidentDataSource = dataSource;
  }
  
  setAgentDataSource(dataSource: AgentDataSource): void {
    this.agentDataSource = dataSource;
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createOperatorSnapshotProvider(
  config?: OperatorSnapshotProviderConfig,
  taskDataSource?: TaskDataSource,
  approvalDataSource?: ApprovalDataSource,
  incidentDataSource?: IncidentDataSource,
  agentDataSource?: AgentDataSource
): OperatorSnapshotProvider {
  return new DefaultOperatorSnapshotProvider(
    config,
    taskDataSource,
    approvalDataSource,
    incidentDataSource,
    agentDataSource
  );
}
