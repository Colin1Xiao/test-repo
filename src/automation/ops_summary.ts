/**
 * Ops Summary - 运维摘要
 * 
 * 职责：
 * 1. 把 audit + health + failure 结果压成可操作摘要
 * 2. 给运维、开发者、管理者不同摘要视图
 * 3. 产出"当前最该处理什么"的列表
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type {
  OpsSummary,
  HealthSnapshot,
  GlobalHealthMetrics,
  AuditEvent,
  FailureRecord,
  AlertLevel,
} from './types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 运维摘要生成器配置
 */
export interface OpsSummaryGeneratorConfig {
  /** 顶级问题数量限制 */
  topIssuesLimit?: number;
  
  /** 建议操作数量限制 */
  recommendedActionsLimit?: number;
  
  /** 告警阈值配置 */
  alertThresholds?: {
    healthScoreCritical: number;
    healthScoreDegraded: number;
    failureRateHigh: number;
    pendingApprovalsHigh: number;
  };
}

// ============================================================================
// 运维摘要生成器
// ============================================================================

export class OpsSummaryGenerator {
  private config: Required<OpsSummaryGeneratorConfig>;
  
  constructor(config: OpsSummaryGeneratorConfig = {}) {
    this.config = {
      topIssuesLimit: config.topIssuesLimit ?? 5,
      recommendedActionsLimit: config.recommendedActionsLimit ?? 5,
      alertThresholds: {
        healthScoreCritical: config.alertThresholds?.healthScoreCritical ?? 50,
        healthScoreDegraded: config.alertThresholds?.healthScoreDegraded ?? 70,
        failureRateHigh: config.alertThresholds?.failureRateHigh ?? 0.2,
        pendingApprovalsHigh: config.alertThresholds?.pendingApprovalsHigh ?? 10,
      },
    };
  }
  
  /**
   * 构建运维摘要
   */
  buildOpsSummary(
    snapshot: HealthSnapshot,
    auditData?: {
      events: AuditEvent[];
      failures: FailureRecord[];
    }
  ): OpsSummary {
    const now = Date.now();
    const global = snapshot.global;
    
    // 确定总体状态
    const overallStatus = this.determineOverallStatus(global);
    
    // 顶级失败问题
    const topFailures = this.buildTopFailures(auditData?.failures || []);
    
    // 降级 Server
    const degradedServers = this.buildDegradedServers(snapshot.byServer);
    
    // 被阻塞/待审批 Skill
    const blockedOrPendingSkills = this.buildBlockedOrPendingSkills(snapshot.bySkill);
    
    // 审批瓶颈
    const approvalBottlenecks = this.buildApprovalBottlenecks(auditData?.events || []);
    
    // 重放热点
    const replayHotspots = this.buildReplayHotspots(auditData?.events || []);
    
    // 建议操作
    const recommendedActions = this.buildRecommendedActions(global, {
      topFailures,
      degradedServers,
      blockedOrPendingSkills,
      approvalBottlenecks,
      replayHotspots,
    });
    
    return {
      summaryId: `ops_${now}`,
      createdAt: now,
      overallStatus,
      healthScore: global.healthScore,
      topFailures,
      degradedServers,
      blockedOrPendingSkills,
      approvalBottlenecks,
      replayHotspots,
      recommendedActions,
    };
  }
  
  /**
   * 构建每日运维摘要
   */
  buildDailyOpsDigest(
    snapshots: HealthSnapshot[],
    date: string
  ): {
    date: string;
    avgHealthScore: number;
    trend: 'improving' | 'stable' | 'degrading';
    criticalIssues: number;
    summary: string;
  } {
    if (snapshots.length === 0) {
      return {
        date,
        avgHealthScore: 100,
        trend: 'stable',
        criticalIssues: 0,
        summary: 'No data available',
      };
    }
    
    // 计算平均健康评分
    const totalScore = snapshots.reduce((sum, s) => sum + s.global.healthScore, 0);
    const avgHealthScore = Math.round(totalScore / snapshots.length);
    
    // 计算趋势
    const trend = this.calculateTrend(snapshots);
    
    // 统计严重问题
    let criticalIssues = 0;
    
    for (const snapshot of snapshots) {
      if (snapshot.global.healthScore < this.config.alertThresholds.healthScoreCritical) {
        criticalIssues++;
      }
    }
    
    // 生成摘要
    const summary = this.generateDailySummary(avgHealthScore, trend, criticalIssues);
    
    return {
      date,
      avgHealthScore,
      trend,
      criticalIssues,
      summary,
    };
  }
  
  /**
   * 构建顶级问题列表
   */
  buildTopIssues(
    snapshot: HealthSnapshot,
    auditData?: { failures: FailureRecord[] }
  ): Array<{
    issue: string;
    severity: AlertLevel;
    impact: string;
    count: number;
  }> {
    const issues: Array<{
      issue: string;
      severity: AlertLevel;
      impact: string;
      count: number;
    }> = [];
    
    const global = snapshot.global;
    
    // 高失败率
    if (global.failureRate >= this.config.alertThresholds.failureRateHigh) {
      issues.push({
        issue: 'High failure rate',
        severity: global.failureRate >= 0.5 ? 'critical' : 'high',
        impact: `${(global.failureRate * 100).toFixed(1)}% of tasks failing`,
        count: global.failedTasks,
      });
    }
    
    // 低健康评分
    if (global.healthScore < this.config.alertThresholds.healthScoreDegraded) {
      issues.push({
        issue: 'Low health score',
        severity: global.healthScore < this.config.alertThresholds.healthScoreCritical ? 'critical' : 'high',
        impact: `Health score: ${global.healthScore}/100`,
        count: 1,
      });
    }
    
    // 降级 Server
    if (global.degradedServers > 0) {
      issues.push({
        issue: 'Degraded servers',
        severity: global.degradedServers >= 3 ? 'critical' : 'high',
        impact: `${global.degradedServers} server(s) degraded or unavailable`,
        count: global.degradedServers,
      });
    }
    
    // 被阻塞 Skill
    if (global.blockedSkills > 0) {
      issues.push({
        issue: 'Blocked skills',
        severity: global.blockedSkills >= 5 ? 'high' : 'medium',
        impact: `${global.blockedSkills} skill(s) blocked`,
        count: global.blockedSkills,
      });
    }
    
    // 审批积压
    if (global.pendingApprovals >= this.config.alertThresholds.pendingApprovalsHigh) {
      issues.push({
        issue: 'Approval backlog',
        severity: global.pendingApprovals >= 50 ? 'high' : 'medium',
        impact: `${global.pendingApprovals} approval(s) pending`,
        count: global.pendingApprovals,
      });
    }
    
    // 按严重性排序
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
    
    return issues.slice(0, this.config.topIssuesLimit);
  }
  
  /**
   * 构建建议操作列表
   */
  buildAttentionItems(
    summary: OpsSummary
  ): Array<{
    priority: AlertLevel;
    item: string;
    action: string;
  }> {
    const items: Array<{
      priority: AlertLevel;
      item: string;
      action: string;
    }> = [];
    
    // 顶级失败问题
    for (const failure of summary.topFailures.slice(0, 3)) {
      items.push({
        priority: failure.severity,
        item: failure.issue,
        action: `Investigate ${failure.count} ${failure.issue.toLowerCase()} events`,
      });
    }
    
    // 降级 Server
    for (const server of summary.degradedServers.slice(0, 2)) {
      items.push({
        priority: server.status === 'unavailable' ? 'critical' : 'high',
        item: `Server ${server.serverId} ${server.status}`,
        action: `Check server health and restart if needed`,
      });
    }
    
    // 被阻塞 Skill
    for (const skill of summary.blockedOrPendingSkills.slice(0, 2)) {
      items.push({
        priority: skill.status === 'blocked' ? 'high' : 'medium',
        item: `Skill ${skill.skillName} ${skill.status}`,
        action: `Review skill configuration and permissions`,
      });
    }
    
    // 建议操作
    for (const action of summary.recommendedActions.slice(0, 3)) {
      items.push({
        priority: action.priority === 'high' ? 'high' : 'medium',
        item: action.action,
        action: action.reason,
      });
    }
    
    return items;
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 确定总体状态
   */
  private determineOverallStatus(global: GlobalHealthMetrics): 'healthy' | 'degraded' | 'critical' {
    if (global.healthScore < this.config.alertThresholds.healthScoreCritical) {
      return 'critical';
    }
    
    if (global.healthScore < this.config.alertThresholds.healthScoreDegraded) {
      return 'degraded';
    }
    
    return 'healthy';
  }
  
  /**
   * 构建顶级失败问题
   */
  private buildTopFailures(failures: FailureRecord[]): OpsSummary['topFailures'] {
    // 按分类分组
    const byCategory: Record<string, number> = {};
    
    for (const failure of failures) {
      const category = failure.category || 'unknown';
      byCategory[category] = (byCategory[category] || 0) + 1;
    }
    
    // 转换为列表并排序
    const topFailures = Object.entries(byCategory)
      .map(([category, count]) => ({
        category,
        count,
        impact: this.getCategoryImpact(category),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, this.config.topIssuesLimit);
    
    return topFailures;
  }
  
  /**
   * 构建降级 Server 列表
   */
  private buildDegradedServers(
    byServer: Record<string, ServerHealthMetrics>
  ): OpsSummary['degradedServers'] {
    const degraded: OpsSummary['degradedServers'] = [];
    
    for (const [serverId, metrics] of Object.entries(byServer)) {
      if (metrics.healthStatus !== 'healthy') {
        degraded.push({
          serverId,
          status: metrics.healthStatus,
          errorRate: metrics.errorRate,
        });
      }
    }
    
    // 按错误率排序
    degraded.sort((a, b) => b.errorRate - a.errorRate);
    
    return degraded;
  }
  
  /**
   * 构建被阻塞/待审批 Skill 列表
   */
  private buildBlockedOrPendingSkills(
    bySkill: Record<string, SkillHealthMetrics>
  ): OpsSummary['blockedOrPendingSkills'] {
    const blockedOrPending: OpsSummary['blockedOrPendingSkills'] = [];
    
    for (const [skillName, metrics] of Object.entries(bySkill)) {
      if (metrics.blockedFrequency > 0) {
        blockedOrPending.push({
          skillName,
          status: 'blocked',
          count: metrics.blockedFrequency,
        });
      } else if (metrics.pendingFrequency > 0) {
        blockedOrPending.push({
          skillName,
          status: 'pending',
          count: metrics.pendingFrequency,
        });
      }
    }
    
    // 按数量排序
    blockedOrPending.sort((a, b) => b.count - a.count);
    
    return blockedOrPending;
  }
  
  /**
   * 构建审批瓶颈列表
   */
  private buildApprovalBottlenecks(events: AuditEvent[]): OpsSummary['approvalBottlenecks'] {
    // 按审批类型分组
    const byType: Record<string, { pending: number; totalWaitTime: number }> = {};
    
    for (const event of events) {
      if (event.eventType === 'approval.requested') {
        const type = event.category || 'general';
        
        if (!byType[type]) {
          byType[type] = { pending: 0, totalWaitTime: 0 };
        }
        
        byType[type].pending++;
        
        if (event.metadata?.waitTimeMs) {
          byType[type].totalWaitTime += event.metadata.waitTimeMs;
        }
      }
    }
    
    // 转换为列表
    const bottlenecks = Object.entries(byType)
      .map(([type, data]) => ({
        approvalType: type,
        pendingCount: data.pending,
        avgWaitTimeMs: data.pending > 0 ? data.totalWaitTime / data.pending : 0,
      }))
      .sort((a, b) => b.pendingCount - a.pendingCount)
      .slice(0, 5);
    
    return bottlenecks;
  }
  
  /**
   * 构建重放热点列表
   */
  private buildReplayHotspots(events: AuditEvent[]): OpsSummary['replayHotspots'] {
    // 按任务 ID 分组重放事件
    const byTask: Record<string, { count: number; reasons: string[] }> = {};
    
    for (const event of events) {
      if (event.eventType === 'task.replayed' && event.taskId) {
        if (!byTask[event.taskId]) {
          byTask[event.taskId] = { count: 0, reasons: [] };
        }
        
        byTask[event.taskId].count++;
        
        if (event.reason) {
          byTask[event.taskId].reasons.push(event.reason);
        }
      }
    }
    
    // 转换为列表
    const hotspots = Object.entries(byTask)
      .map(([taskId, data]) => ({
        taskId,
        replayCount: data.count,
        reason: data.reasons[0] || 'Unknown',
      }))
      .sort((a, b) => b.replayCount - a.replayCount)
      .slice(0, 5);
    
    return hotspots;
  }
  
  /**
   * 构建建议操作列表
   */
  private buildRecommendedActions(
    global: GlobalHealthMetrics,
    issues: {
      topFailures: OpsSummary['topFailures'];
      degradedServers: OpsSummary['degradedServers'];
      blockedOrPendingSkills: OpsSummary['blockedOrPendingSkills'];
      approvalBottlenecks: OpsSummary['approvalBottlenecks'];
      replayHotspots: OpsSummary['replayHotspots'];
    }
  ): OpsSummary['recommendedActions'] {
    const actions: OpsSummary['recommendedActions'] = [];
    
    // 高失败率
    if (global.failureRate >= this.config.alertThresholds.failureRateHigh) {
      actions.push({
        priority: 'high',
        action: 'Investigate high failure rate',
        reason: `${(global.failureRate * 100).toFixed(1)}% of tasks are failing`,
      });
    }
    
    // 降级 Server
    if (issues.degradedServers.length > 0) {
      actions.push({
        priority: 'high',
        action: `Check ${issues.degradedServers.length} degraded server(s)`,
        reason: issues.degradedServers.map(s => s.serverId).join(', '),
      });
    }
    
    // 被阻塞 Skill
    if (issues.blockedOrPendingSkills.length > 0) {
      actions.push({
        priority: 'medium',
        action: `Review ${issues.blockedOrPendingSkills.length} blocked/pending skill(s)`,
        reason: issues.blockedOrPendingSkills.map(s => s.skillName).join(', '),
      });
    }
    
    // 审批积压
    if (global.pendingApprovals >= this.config.alertThresholds.pendingApprovalsHigh) {
      actions.push({
        priority: 'medium',
        action: 'Clear approval backlog',
        reason: `${global.pendingApprovals} approvals pending`,
      });
    }
    
    // 重放热点
    if (issues.replayHotspots.length > 0) {
      actions.push({
        priority: 'low',
        action: 'Investigate replay hotspots',
        reason: `${issues.replayHotspots.length} task(s) with multiple replays`,
      });
    }
    
    return actions.slice(0, this.config.recommendedActionsLimit);
  }
  
  /**
   * 计算趋势
   */
  private calculateTrend(snapshots: HealthSnapshot[]): 'improving' | 'stable' | 'degrading' {
    if (snapshots.length < 2) {
      return 'stable';
    }
    
    // 比较最近两个快照
    const recent = snapshots[snapshots.length - 1];
    const previous = snapshots[snapshots.length - 2];
    
    const diff = recent.global.healthScore - previous.global.healthScore;
    
    if (diff >= 5) {
      return 'improving';
    } else if (diff <= -5) {
      return 'degrading';
    } else {
      return 'stable';
    }
  }
  
  /**
   * 生成每日摘要
   */
  private generateDailySummary(
    avgHealthScore: number,
    trend: 'improving' | 'stable' | 'degrading',
    criticalIssues: number
  ): string {
    const parts: string[] = [];
    
    // 健康评分描述
    if (avgHealthScore >= 90) {
      parts.push('System health excellent');
    } else if (avgHealthScore >= 70) {
      parts.push('System health good');
    } else if (avgHealthScore >= 50) {
      parts.push('System health degraded');
    } else {
      parts.push('System health critical');
    }
    
    // 趋势描述
    parts.push(`trend ${trend}`);
    
    // 严重问题
    if (criticalIssues > 0) {
      parts.push(`${criticalIssues} critical issue(s) occurred`);
    }
    
    return parts.join(', ');
  }
  
  /**
   * 获取分类影响描述
   */
  private getCategoryImpact(category: string): string {
    const impacts: Record<string, string> = {
      timeout: 'Operations exceeding time limits',
      permission: 'Access control issues',
      approval: 'Approval workflow bottlenecks',
      resource: 'Resource availability problems',
      validation: 'Data or schema issues',
      dependency: 'Missing or broken dependencies',
      compatibility: 'Version mismatch issues',
      provider: 'External service problems',
      internal: 'System internal errors',
      policy: 'Policy or quota violations',
      unknown: 'Uncategorized failures',
    };
    
    return impacts[category] || 'Unknown impact';
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建运维摘要生成器
 */
export function createOpsSummaryGenerator(config?: OpsSummaryGeneratorConfig): OpsSummaryGenerator {
  return new OpsSummaryGenerator(config);
}

/**
 * 快速构建运维摘要
 */
export function buildOpsSummary(
  snapshot: HealthSnapshot,
  auditData?: { events: AuditEvent[]; failures: FailureRecord[] },
  config?: OpsSummaryGeneratorConfig
): OpsSummary {
  const generator = new OpsSummaryGenerator(config);
  return generator.buildOpsSummary(snapshot, auditData);
}
