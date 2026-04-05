/**
 * Health Metrics - 健康指标计算
 * 
 * 职责：
 * 1. 从 audit / task / health 源计算系统健康指标
 * 2. 产出全局、按 agent、按 server、按 skill 的健康快照
 * 3. 给 ops summary 提供结构化输入
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type {
  HealthSnapshot,
  GlobalHealthMetrics,
  AgentHealthMetrics,
  ServerHealthMetrics,
  SkillHealthMetrics,
  AuditEvent,
  AuditSeverity,
} from './types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 健康计算配置
 */
export interface HealthMetricsConfig {
  /** 时间窗口（毫秒） */
  timeWindowMs?: number;
  
  /** 健康评分权重 */
  healthScoreWeights?: {
    successRate: number;
    pendingApprovals: number;
    degradedServers: number;
    blockedSkills: number;
  };
}

/**
 * 健康计算上下文
 */
export interface HealthCalculationContext {
  /** 审计事件 */
  auditEvents: AuditEvent[];
  
  /** 任务数据（可选） */
  taskData?: Record<string, any>;
  
  /** Server 状态（可选） */
  serverStatus?: Record<string, 'healthy' | 'degraded' | 'unavailable'>;
  
  /** Skill 状态（可选） */
  skillStatus?: Record<string, 'loaded' | 'blocked' | 'pending'>;
  
  /** 待处理审批数（可选） */
  pendingApprovals?: number;
}

// ============================================================================
// 健康指标计算器
// ============================================================================

export class HealthMetricsCalculator {
  private config: Required<HealthMetricsConfig>;
  
  constructor(config: HealthMetricsConfig = {}) {
    this.config = {
      timeWindowMs: config.timeWindowMs ?? 24 * 60 * 60 * 1000, // 24 小时
      healthScoreWeights: {
        successRate: config.healthScoreWeights?.successRate ?? 0.4,
        pendingApprovals: config.healthScoreWeights?.pendingApprovals ?? 0.2,
        degradedServers: config.healthScoreWeights?.degradedServers ?? 0.2,
        blockedSkills: config.healthScoreWeights?.blockedSkills ?? 0.2,
      },
    };
  }
  
  /**
   * 计算健康快照
   */
  computeHealthSnapshot(context: HealthCalculationContext): HealthSnapshot {
    const now = Date.now();
    const startTime = now - this.config.timeWindowMs;
    
    // 过滤时间窗口内的事件
    const events = context.auditEvents.filter(e => e.timestamp >= startTime);
    
    // 计算全局指标
    const global = this.computeGlobalMetrics(events, context);
    
    // 按 Agent 分组计算
    const byAgent = this.computeAgentMetrics(events, context);
    
    // 按 Server 分组计算
    const byServer = this.computeServerMetrics(events, context);
    
    // 按 Skill 分组计算
    const bySkill = this.computeSkillMetrics(events, context);
    
    return {
      snapshotId: `health_${now}`,
      createdAt: now,
      timeRange: {
        startTime,
        endTime: now,
      },
      global,
      byAgent,
      byServer,
      bySkill,
    };
  }
  
  /**
   * 计算 Agent 健康指标
   */
  computeAgentHealth(
    agentId: string,
    context: HealthCalculationContext
  ): AgentHealthMetrics {
    const events = context.auditEvents.filter(e => e.agentId === agentId);
    
    const totalExecutions = events.filter(e =>
      e.eventType === 'task.started' || e.eventType === 'task.completed'
    ).length;
    
    const successfulExecutions = events.filter(e =>
      e.eventType === 'task.completed' && e.severity !== 'error' && e.severity !== 'critical'
    ).length;
    
    const failedEvents = events.filter(e =>
      e.eventType === 'task.failed'
    );
    
    // 计算失败分类分布
    const failureCategoryDistribution: Record<string, number> = {};
    for (const event of failedEvents) {
      const category = event.category || 'unknown';
      failureCategoryDistribution[category] = (failureCategoryDistribution[category] || 0) + 1;
    }
    
    // 计算平均耗时（从元数据中提取）
    let totalLatency = 0;
    let latencyCount = 0;
    
    for (const event of events) {
      if (event.metadata?.durationMs) {
        totalLatency += event.metadata.durationMs;
        latencyCount++;
      }
    }
    
    const executionSuccessRate = totalExecutions > 0
      ? successfulExecutions / totalExecutions
      : 1;
    
    return {
      agentId,
      executionSuccessRate,
      averageLatencyMs: latencyCount > 0 ? totalLatency / latencyCount : 0,
      failureCategoryDistribution,
      totalExecutions,
    };
  }
  
  /**
   * 计算 Server 健康指标
   */
  computeServerHealth(
    serverId: string,
    context: HealthCalculationContext
  ): ServerHealthMetrics {
    const events = context.auditEvents.filter(e => e.serverId === serverId);
    
    const totalEvents = events.length;
    const errorEvents = events.filter(e =>
      e.severity === 'error' || e.severity === 'critical'
    ).length;
    
    const degradedEvents = events.filter(e =>
      e.eventType === 'server.degraded' || e.category === 'resource'
    ).length;
    
    const unavailableEvents = events.filter(e =>
      e.eventType === 'server.unavailable'
    ).length;
    
    // 计算审批摩擦（需要审批的比例）
    const approvalEvents = events.filter(e =>
      e.eventType === 'approval.requested'
    ).length;
    
    const approvalFriction = totalEvents > 0 ? approvalEvents / totalEvents : 0;
    
    // 获取当前健康状态
    const healthStatus = context.serverStatus?.[serverId] ||
      (unavailableEvents > 0 ? 'unavailable' :
       degradedEvents > 0 ? 'degraded' : 'healthy');
    
    return {
      serverId,
      healthStatus,
      errorRate: totalEvents > 0 ? errorEvents / totalEvents : 0,
      degradedCount: degradedEvents,
      unavailableCount: unavailableEvents,
      approvalFriction,
    };
  }
  
  /**
   * 计算 Skill 健康指标
   */
  computeSkillHealth(
    skillName: string,
    context: HealthCalculationContext
  ): SkillHealthMetrics {
    const events = context.auditEvents.filter(e => e.skillName === skillName);
    
    const loadEvents = events.filter(e =>
      e.eventType === 'skill.loaded'
    );
    
    const blockedEvents = events.filter(e =>
      e.eventType === 'skill.blocked'
    );
    
    const pendingEvents = events.filter(e =>
      e.eventType === 'skill.pending'
    );
    
    const compatibilityEvents = events.filter(e =>
      e.category === 'compatibility'
    );
    
    const loadSuccessRate = loadEvents.length > 0
      ? (loadEvents.length - blockedEvents.length) / loadEvents.length
      : 1;
    
    return {
      skillName,
      loadSuccessRate,
      blockedFrequency: blockedEvents.length,
      pendingFrequency: pendingEvents.length,
      compatibilityIssues: compatibilityEvents.length,
    };
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 计算全局指标
   */
  private computeGlobalMetrics(
    events: AuditEvent[],
    context: HealthCalculationContext
  ): GlobalHealthMetrics {
    // 任务统计
    const taskEvents = events.filter(e =>
      e.entityType === 'task' || e.eventType?.startsWith('task.')
    );
    
    const totalTasks = taskEvents.filter(e =>
      e.eventType === 'task.created' || e.eventType === 'task.started'
    ).length;
    
    const successfulTasks = taskEvents.filter(e =>
      e.eventType === 'task.completed' && e.severity !== 'error' && e.severity !== 'critical'
    ).length;
    
    const failedTasks = taskEvents.filter(e =>
      e.eventType === 'task.failed'
    ).length;
    
    // 成功率/失败率
    const successRate = totalTasks > 0 ? successfulTasks / totalTasks : 1;
    const failureRate = totalTasks > 0 ? failedTasks / totalTasks : 0;
    
    // 待处理审批
    const pendingApprovals = context.pendingApprovals ||
      events.filter(e => e.eventType === 'approval.requested').length -
      events.filter(e => e.eventType === 'approval.resolved' || e.eventType === 'approval.denied').length;
    
    // 重放频率
    const replayEvents = events.filter(e => e.eventType === 'task.replayed');
    const replayFrequency = totalTasks > 0 ? replayEvents.length / totalTasks : 0;
    
    // 降级 Server 数
    const serverIds = new Set(events.filter(e => e.serverId).map(e => e.serverId!));
    let degradedServers = 0;
    
    for (const serverId of serverIds) {
      const serverMetrics = this.computeServerHealth(serverId, context);
      if (serverMetrics.healthStatus !== 'healthy') {
        degradedServers++;
      }
    }
    
    // 被阻塞 Skill 数
    const skillIds = new Set(events.filter(e => e.skillName).map(e => e.skillName!));
    let blockedSkills = 0;
    
    for (const skillName of skillIds) {
      const skillMetrics = this.computeSkillHealth(skillName, context);
      if (skillMetrics.blockedFrequency > 0) {
        blockedSkills++;
      }
    }
    
    // 平均任务耗时
    let totalDuration = 0;
    let durationCount = 0;
    
    for (const event of events) {
      if (event.metadata?.durationMs) {
        totalDuration += event.metadata.durationMs;
        durationCount++;
      }
    }
    
    const avgTaskDurationMs = durationCount > 0 ? totalDuration / durationCount : 0;
    
    // 健康评分（0-100）
    const healthScore = this.calculateHealthScore({
      successRate,
      pendingApprovals,
      degradedServers,
      blockedSkills,
      totalTasks,
    });
    
    return {
      totalTasks,
      successfulTasks,
      failedTasks,
      successRate,
      failureRate,
      pendingApprovals,
      replayFrequency,
      degradedServers,
      blockedSkills,
      avgTaskDurationMs,
      healthScore,
    };
  }
  
  /**
   * 按 Agent 分组计算指标
   */
  private computeAgentMetrics(
    events: AuditEvent[],
    context: HealthCalculationContext
  ): Record<string, AgentHealthMetrics> {
    const agentIds = new Set(events.filter(e => e.agentId).map(e => e.agentId!));
    const metrics: Record<string, AgentHealthMetrics> = {};
    
    for (const agentId of agentIds) {
      metrics[agentId] = this.computeAgentHealth(agentId, context);
    }
    
    return metrics;
  }
  
  /**
   * 按 Server 分组计算指标
   */
  private computeServerMetrics(
    events: AuditEvent[],
    context: HealthCalculationContext
  ): Record<string, ServerHealthMetrics> {
    const serverIds = new Set(events.filter(e => e.serverId).map(e => e.serverId!));
    const metrics: Record<string, ServerHealthMetrics> = {};
    
    for (const serverId of serverIds) {
      metrics[serverId] = this.computeServerHealth(serverId, context);
    }
    
    return metrics;
  }
  
  /**
   * 按 Skill 分组计算指标
   */
  private computeSkillMetrics(
    events: AuditEvent[],
    context: HealthCalculationContext
  ): Record<string, SkillHealthMetrics> {
    const skillNames = new Set(events.filter(e => e.skillName).map(e => e.skillName!));
    const metrics: Record<string, SkillHealthMetrics> = {};
    
    for (const skillName of skillNames) {
      metrics[skillName] = this.computeSkillHealth(skillName, context);
    }
    
    return metrics;
  }
  
  /**
   * 计算健康评分
   */
  private calculateHealthScore(data: {
    successRate: number;
    pendingApprovals: number;
    degradedServers: number;
    blockedSkills: number;
    totalTasks: number;
  }): number {
    const weights = this.config.healthScoreWeights;
    
    // 成功率分数（0-100）
    const successRateScore = data.successRate * 100;
    
    // 待审批分数（越少越好，0-100）
    const pendingScore = Math.max(0, 100 - data.pendingApprovals * 10);
    
    // 降级 Server 分数（越少越好，0-100）
    const degradedScore = Math.max(0, 100 - data.degradedServers * 20);
    
    // 被阻塞 Skill 分数（越少越好，0-100）
    const blockedScore = Math.max(0, 100 - data.blockedSkills * 20);
    
    // 加权平均
    const healthScore =
      successRateScore * weights.successRate +
      pendingScore * weights.pendingApprovals +
      degradedScore * weights.degradedServers +
      blockedScore * weights.blockedSkills;
    
    return Math.round(Math.max(0, Math.min(100, healthScore)));
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建健康指标计算器
 */
export function createHealthMetricsCalculator(config?: HealthMetricsConfig): HealthMetricsCalculator {
  return new HealthMetricsCalculator(config);
}

/**
 * 快速计算健康快照
 */
export function computeHealthSnapshot(
  context: HealthCalculationContext,
  config?: HealthMetricsConfig
): HealthSnapshot {
  const calculator = new HealthMetricsCalculator(config);
  return calculator.computeHealthSnapshot(context);
}
