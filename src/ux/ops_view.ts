/**
 * Ops View - 运维视图
 * 
 * 职责：
 * 1. 聚合 Sprint 5 的 health / ops summary / audit 数据
 * 2. 输出 health score / degraded servers / blocked skills / replay hotspots / top failures
 * 3. 暴露基础运维动作入口
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type {
  OpsViewModel,
  Severity,
  ServerStatus,
  ControlActionResult,
} from './control_types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 健康指标数据源
 */
export interface HealthMetricsDataSource {
  /** 获取健康快照 */
  getHealthSnapshot(): Promise<any>;
}

/**
 * 运维摘要数据源
 */
export interface OpsSummaryDataSource {
  /** 获取运维摘要 */
  getOpsSummary(): Promise<any>;
}

/**
 * 运维视图构建器配置
 */
export interface OpsViewBuilderConfig {
  /** 最大降级 Server 数 */
  maxDegradedServers?: number;
  
  /** 最大被阻塞 Skill 数 */
  maxBlockedSkills?: number;
  
  /** 最大顶级失败数 */
  maxTopFailures?: number;
  
  /** 最大重放热点数 */
  maxReplayHotspots?: number;
}

// ============================================================================
// 运维视图构建器
// ============================================================================

export class OpsViewBuilder {
  private config: Required<OpsViewBuilderConfig>;
  private healthMetricsDataSource: HealthMetricsDataSource;
  private opsSummaryDataSource: OpsSummaryDataSource;
  
  constructor(
    healthMetricsDataSource: HealthMetricsDataSource,
    opsSummaryDataSource: OpsSummaryDataSource,
    config: OpsViewBuilderConfig = {}
  ) {
    this.config = {
      maxDegradedServers: config.maxDegradedServers ?? 10,
      maxBlockedSkills: config.maxBlockedSkills ?? 20,
      maxTopFailures: config.maxTopFailures ?? 5,
      maxReplayHotspots: config.maxReplayHotspots ?? 5,
    };
    this.healthMetricsDataSource = healthMetricsDataSource;
    this.opsSummaryDataSource = opsSummaryDataSource;
  }
  
  /**
   * 构建运维视图
   */
  async buildOpsView(): Promise<OpsViewModel> {
    // 获取健康快照
    const healthSnapshot = await this.healthMetricsDataSource.getHealthSnapshot();
    
    // 获取运维摘要
    const opsSummary = await this.opsSummaryDataSource.getOpsSummary();
    
    // 构建视图
    return {
      overallStatus: this.determineOverallStatus(healthSnapshot, opsSummary),
      healthScore: healthSnapshot.global?.healthScore || 0,
      degradedServers: this.buildDegradedServers(healthSnapshot.byServer || {}),
      blockedSkills: this.buildBlockedSkills(healthSnapshot.bySkill || {}),
      pendingApprovals: healthSnapshot.global?.pendingApprovals || 0,
      activeIncidents: this.buildActiveIncidents(opsSummary),
      topFailures: this.buildTopFailures(opsSummary.topFailures || []),
      replayHotspots: this.buildReplayHotspots(opsSummary.replayHotspots || []),
    };
  }
  
  /**
   * 列出降级 Server
   */
  async listDegradedServers(): Promise<OpsViewModel['degradedServers']> {
    const view = await this.buildOpsView();
    return view.degradedServers;
  }
  
  /**
   * 列出被阻塞 Skill
   */
  async listBlockedSkills(): Promise<OpsViewModel['blockedSkills']> {
    const view = await this.buildOpsView();
    return view.blockedSkills;
  }
  
  /**
   * 列出顶级事件
   */
  async listTopIncidents(): Promise<OpsViewModel['activeIncidents']> {
    const view = await this.buildOpsView();
    return view.activeIncidents;
  }
  
  /**
   * 确认事件
   */
  async ackIncident(incidentId: string): Promise<ControlActionResult> {
    // 简化实现：实际应该调用事件管理系统
    return {
      success: true,
      actionType: 'ack_incident',
      targetId: incidentId,
      message: `Incident ${incidentId} acknowledged`,
      nextActions: ['request_recovery'],
    };
  }
  
  /**
   * 请求重放
   */
  async requestReplay(taskId: string): Promise<ControlActionResult> {
    // 简化实现：实际应该调用 Recovery 系统
    return {
      success: true,
      actionType: 'request_replay',
      targetId: taskId,
      message: `Replay requested for task ${taskId}`,
      nextActions: [],
    };
  }
  
  /**
   * 请求恢复
   */
  async requestRecovery(taskId: string): Promise<ControlActionResult> {
    // 简化实现：实际应该调用 Recovery 系统
    return {
      success: true,
      actionType: 'request_recovery',
      targetId: taskId,
      message: `Recovery requested for task ${taskId}`,
      nextActions: [],
    };
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 确定总体状态
   */
  private determineOverallStatus(
    healthSnapshot: any,
    opsSummary: any
  ): 'healthy' | 'degraded' | 'critical' {
    const healthScore = healthSnapshot.global?.healthScore || 100;
    
    if (healthScore < 50) {
      return 'critical';
    }
    
    if (healthScore < 70) {
      return 'degraded';
    }
    
    return 'healthy';
  }
  
  /**
   * 构建降级 Server 列表
   */
  private buildDegradedServers(
    byServer: Record<string, any>
  ): OpsViewModel['degradedServers'] {
    const degraded: OpsViewModel['degradedServers'] = [];
    
    for (const [serverId, metrics] of Object.entries(byServer)) {
      if (metrics.healthStatus !== 'healthy') {
        degraded.push({
          serverId,
          status: metrics.healthStatus as ServerStatus,
          errorRate: metrics.errorRate || 0,
          lastCheck: metrics.lastCheck || Date.now(),
        });
      }
    }
    
    // 按错误率排序
    degraded.sort((a, b) => b.errorRate - a.errorRate);
    
    return degraded.slice(0, this.config.maxDegradedServers);
  }
  
  /**
   * 构建被阻塞 Skill 列表
   */
  private buildBlockedSkills(
    bySkill: Record<string, any>
  ): OpsViewModel['blockedSkills'] {
    const blocked: OpsViewModel['blockedSkills'] = [];
    
    for (const [skillName, metrics] of Object.entries(bySkill)) {
      if (metrics.blockedFrequency > 0 || metrics.pendingFrequency > 0) {
        blocked.push({
          skillName,
          status: metrics.blockedFrequency > 0 ? 'blocked' : 'pending',
          count: metrics.blockedFrequency || metrics.pendingFrequency || 0,
          reason: this.getBlockedReason(metrics),
        });
      }
    }
    
    // 按数量排序
    blocked.sort((a, b) => b.count - a.count);
    
    return blocked.slice(0, this.config.maxBlockedSkills);
  }
  
  /**
   * 获取阻塞原因
   */
  private getBlockedReason(metrics: any): string | undefined {
    if (metrics.compatibilityIssues > 0) {
      return `Compatibility issues: ${metrics.compatibilityIssues}`;
    }
    
    if (metrics.loadSuccessRate < 0.5) {
      return `Low load success rate: ${(metrics.loadSuccessRate * 100).toFixed(1)}%`;
    }
    
    return undefined;
  }
  
  /**
   * 构建活跃事件列表
   */
  private buildActiveIncidents(opsSummary: any): OpsViewModel['activeIncidents'] {
    const incidents: OpsViewModel['activeIncidents'] = [];
    
    // 从顶级失败创建事件
    if (opsSummary.topFailures) {
      for (const failure of opsSummary.topFailures.slice(0, 5)) {
        incidents.push({
          id: `incident_${failure.category}`,
          type: 'failure',
          severity: this.mapFailureSeverity(failure.count),
          description: `${failure.category}: ${failure.count} events`,
          createdAt: Date.now(),
          acknowledged: false,
        });
      }
    }
    
    // 从降级 Server 创建事件
    if (opsSummary.degradedServers) {
      for (const server of opsSummary.degradedServers.slice(0, 3)) {
        incidents.push({
          id: `incident_server_${server.serverId}`,
          type: 'server_degraded',
          severity: server.status === 'unavailable' ? 'critical' : 'high',
          description: `Server ${server.serverId} is ${server.status}`,
          createdAt: Date.now(),
          acknowledged: false,
        });
      }
    }
    
    return incidents;
  }
  
  /**
   * 构建顶级失败列表
   */
  private buildTopFailures(topFailures: any[]): OpsViewModel['topFailures'] {
    return topFailures.slice(0, this.config.maxTopFailures);
  }
  
  /**
   * 构建重放热点列表
   */
  private buildReplayHotspots(replayHotspots: any[]): OpsViewModel['replayHotspots'] {
    return replayHotspots.slice(0, this.config.maxReplayHotspots);
  }
  
  /**
   * 映射失败严重级别
   */
  private mapFailureSeverity(count: number): Severity {
    if (count >= 50) {
      return 'critical';
    }
    
    if (count >= 20) {
      return 'high';
    }
    
    if (count >= 5) {
      return 'medium';
    }
    
    return 'low';
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建运维视图构建器
 */
export function createOpsViewBuilder(
  healthMetricsDataSource: HealthMetricsDataSource,
  opsSummaryDataSource: OpsSummaryDataSource,
  config?: OpsViewBuilderConfig
): OpsViewBuilder {
  return new OpsViewBuilder(healthMetricsDataSource, opsSummaryDataSource, config);
}

/**
 * 快速构建运维视图
 */
export async function buildOpsView(
  healthMetricsDataSource: HealthMetricsDataSource,
  opsSummaryDataSource: OpsSummaryDataSource
): Promise<OpsViewModel> {
  const builder = new OpsViewBuilder(healthMetricsDataSource, opsSummaryDataSource);
  return await builder.buildOpsView();
}
