"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpsSummaryGenerator = void 0;
exports.createOpsSummaryGenerator = createOpsSummaryGenerator;
exports.buildOpsSummary = buildOpsSummary;
// ============================================================================
// 运维摘要生成器
// ============================================================================
class OpsSummaryGenerator {
    constructor(config = {}) {
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
    buildOpsSummary(snapshot, auditData) {
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
    buildDailyOpsDigest(snapshots, date) {
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
    buildTopIssues(snapshot, auditData) {
        const issues = [];
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
    buildAttentionItems(summary) {
        const items = [];
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
    determineOverallStatus(global) {
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
    buildTopFailures(failures) {
        // 按分类分组
        const byCategory = {};
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
    buildDegradedServers(byServer) {
        const degraded = [];
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
    buildBlockedOrPendingSkills(bySkill) {
        const blockedOrPending = [];
        for (const [skillName, metrics] of Object.entries(bySkill)) {
            if (metrics.blockedFrequency > 0) {
                blockedOrPending.push({
                    skillName,
                    status: 'blocked',
                    count: metrics.blockedFrequency,
                });
            }
            else if (metrics.pendingFrequency > 0) {
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
    buildApprovalBottlenecks(events) {
        // 按审批类型分组
        const byType = {};
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
    buildReplayHotspots(events) {
        // 按任务 ID 分组重放事件
        const byTask = {};
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
    buildRecommendedActions(global, issues) {
        const actions = [];
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
    calculateTrend(snapshots) {
        if (snapshots.length < 2) {
            return 'stable';
        }
        // 比较最近两个快照
        const recent = snapshots[snapshots.length - 1];
        const previous = snapshots[snapshots.length - 2];
        const diff = recent.global.healthScore - previous.global.healthScore;
        if (diff >= 5) {
            return 'improving';
        }
        else if (diff <= -5) {
            return 'degrading';
        }
        else {
            return 'stable';
        }
    }
    /**
     * 生成每日摘要
     */
    generateDailySummary(avgHealthScore, trend, criticalIssues) {
        const parts = [];
        // 健康评分描述
        if (avgHealthScore >= 90) {
            parts.push('System health excellent');
        }
        else if (avgHealthScore >= 70) {
            parts.push('System health good');
        }
        else if (avgHealthScore >= 50) {
            parts.push('System health degraded');
        }
        else {
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
    getCategoryImpact(category) {
        const impacts = {
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
exports.OpsSummaryGenerator = OpsSummaryGenerator;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建运维摘要生成器
 */
function createOpsSummaryGenerator(config) {
    return new OpsSummaryGenerator(config);
}
/**
 * 快速构建运维摘要
 */
function buildOpsSummary(snapshot, auditData, config) {
    const generator = new OpsSummaryGenerator(config);
    return generator.buildOpsSummary(snapshot, auditData);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3BzX3N1bW1hcnkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvYXV0b21hdGlvbi9vcHNfc3VtbWFyeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7R0FVRzs7O0FBK2xCSCw4REFFQztBQUtELDBDQU9DO0FBM2tCRCwrRUFBK0U7QUFDL0UsVUFBVTtBQUNWLCtFQUErRTtBQUUvRSxNQUFhLG1CQUFtQjtJQUc5QixZQUFZLFNBQW9DLEVBQUU7UUFDaEQsSUFBSSxDQUFDLE1BQU0sR0FBRztZQUNaLGNBQWMsRUFBRSxNQUFNLENBQUMsY0FBYyxJQUFJLENBQUM7WUFDMUMsdUJBQXVCLEVBQUUsTUFBTSxDQUFDLHVCQUF1QixJQUFJLENBQUM7WUFDNUQsZUFBZSxFQUFFO2dCQUNmLG1CQUFtQixFQUFFLE1BQU0sQ0FBQyxlQUFlLEVBQUUsbUJBQW1CLElBQUksRUFBRTtnQkFDdEUsbUJBQW1CLEVBQUUsTUFBTSxDQUFDLGVBQWUsRUFBRSxtQkFBbUIsSUFBSSxFQUFFO2dCQUN0RSxlQUFlLEVBQUUsTUFBTSxDQUFDLGVBQWUsRUFBRSxlQUFlLElBQUksR0FBRztnQkFDL0Qsb0JBQW9CLEVBQUUsTUFBTSxDQUFDLGVBQWUsRUFBRSxvQkFBb0IsSUFBSSxFQUFFO2FBQ3pFO1NBQ0YsQ0FBQztJQUNKLENBQUM7SUFFRDs7T0FFRztJQUNILGVBQWUsQ0FDYixRQUF3QixFQUN4QixTQUdDO1FBRUQsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBQ3ZCLE1BQU0sTUFBTSxHQUFHLFFBQVEsQ0FBQyxNQUFNLENBQUM7UUFFL0IsU0FBUztRQUNULE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUUxRCxTQUFTO1FBQ1QsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFNBQVMsRUFBRSxRQUFRLElBQUksRUFBRSxDQUFD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SUFDMUIsQ0FBQztJQUVEOztPQUVHO0lBQ0ssaUJBQWlCLENBQUMsUUFBZ0I7UUFDeEMsTUFBTSxPQUFPLEdBQTJCO1lBQ3RDLE9BQU8sRUFBRSxrQ0FBa0M7WUFDM0MsVUFBVSxFQUFFLHVCQUF1QjtZQUNuQyxRQUFRLEVBQUUsK0JBQStCO1lBQ3pDLFFBQVEsRUFBRSxnQ0FBZ0M7WUFDMUMsVUFBVSxFQUFFLHVCQUF1QjtZQUNuQyxVQUFVLEVBQUUsZ0NBQWdDO1lBQzVDLGFBQWEsRUFBRSx5QkFBeUI7WUFDeEMsUUFBUSxFQUFFLDJCQUEyQjtZQUNyQyxRQUFRLEVBQUUsd0JBQXdCO1lBQ2xDLE1BQU0sRUFBRSw0QkFBNEI7WUFDcEMsT0FBTyxFQUFFLHdCQUF3QjtTQUNsQyxDQUFDO1FBRUYsT0FBTyxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksZ0JBQWdCLENBQUM7SUFDL0MsQ0FBQztDQUNGO0FBaGpCRCxrREFnakJDO0FBRUQsK0VBQStFO0FBQy9FLE9BQU87QUFDUCwrRUFBK0U7QUFFL0U7O0dBRUc7QUFDSCxTQUFnQix5QkFBeUIsQ0FBQyxNQUFrQztJQUMxRSxPQUFPLElBQUksbUJBQW1CLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDekMsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBZ0IsZUFBZSxDQUM3QixRQUF3QixFQUN4QixTQUErRCxFQUMvRCxNQUFrQztJQUVsQyxNQUFNLFNBQVMsR0FBRyxJQUFJLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ2xELE9BQU8sU0FBUyxDQUFDLGVBQWUsQ0FBQyxRQUFRLEVBQUUsU0FBUyxDQUFDLENBQUM7QUFDeEQsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogT3BzIFN1bW1hcnkgLSDov5Dnu7TmkZjopoFcbiAqIFxuICog6IGM6LSj77yaXG4gKiAxLiDmioogYXVkaXQgKyBoZWFsdGggKyBmYWlsdXJlIOe7k+aenOWOi+aIkOWPr+aTjeS9nOaRmOimgVxuICogMi4g57uZ6L+Q57u044CB5byA5Y+R6ICF44CB566h55CG6ICF5LiN5ZCM5pGY6KaB6KeG5Zu+XG4gKiAzLiDkuqflh7pcIuW9k+WJjeacgOivpeWkhOeQhuS7gOS5iFwi55qE5YiX6KGoXG4gKiBcbiAqIEB2ZXJzaW9uIHYwLjEuMFxuICogQGRhdGUgMjAyNi0wNC0wM1xuICovXG5cbmltcG9ydCB0eXBlIHtcbiAgT3BzU3VtbWFyeSxcbiAgSGVhbHRoU25hcHNob3QsXG4gIEdsb2JhbEhlYWx0aE1ldHJpY3MsXG4gIEF1ZGl0RXZlbnQsXG4gIEZhaWx1cmVSZWNvcmQsXG4gIEFsZXJ0TGV2ZWwsXG59IGZyb20gJy4vdHlwZXMnO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDnsbvlnovlrprkuYlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDov5Dnu7TmkZjopoHnlJ/miJDlmajphY3nva5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBPcHNTdW1tYXJ5R2VuZXJhdG9yQ29uZmlnIHtcbiAgLyoqIOmhtue6p+mXrumimOaVsOmHj+mZkOWItiAqL1xuICB0b3BJc3N1ZXNMaW1pdD86IG51bWJlcjtcbiAgXG4gIC8qKiDlu7rorq7mk43kvZzmlbDph4/pmZDliLYgKi9cbiAgcmVjb21tZW5kZWRBY3Rpb25zTGltaXQ/OiBudW1iZXI7XG4gIFxuICAvKiog5ZGK6K2m6ZiI5YC86YWN572uICovXG4gIGFsZXJ0VGhyZXNob2xkcz86IHtcbiAgICBoZWFsdGhTY29yZUNyaXRpY2FsOiBudW1iZXI7XG4gICAgaGVhbHRoU2NvcmVEZWdyYWRlZDogbnVtYmVyO1xuICAgIGZhaWx1cmVSYXRlSGlnaDogbnVtYmVyO1xuICAgIHBlbmRpbmdBcHByb3ZhbHNIaWdoOiBudW1iZXI7XG4gIH07XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOi/kOe7tOaRmOimgeeUn+aIkOWZqFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgY2xhc3MgT3BzU3VtbWFyeUdlbmVyYXRvciB7XG4gIHByaXZhdGUgY29uZmlnOiBSZXF1aXJlZDxPcHNTdW1tYXJ5R2VuZXJhdG9yQ29uZmlnPjtcbiAgXG4gIGNvbnN0cnVjdG9yKGNvbmZpZzogT3BzU3VtbWFyeUdlbmVyYXRvckNvbmZpZyA9IHt9KSB7XG4gICAgdGhpcy5jb25maWcgPSB7XG4gICAgICB0b3BJc3N1ZXNMaW1pdDogY29uZmlnLnRvcElzc3Vlc0xpbWl0ID8/IDUsXG4gICAgICByZWNvbW1lbmRlZEFjdGlvbnNMaW1pdDogY29uZmlnLnJlY29tbWVuZGVkQWN0aW9uc0xpbWl0ID8/IDUsXG4gICAgICBhbGVydFRocmVzaG9sZHM6IHtcbiAgICAgICAgaGVhbHRoU2NvcmVDcml0aWNhbDogY29uZmlnLmFsZXJ0VGhyZXNob2xkcz8uaGVhbHRoU2NvcmVDcml0aWNhbCA/PyA1MCxcbiAgICAgICAgaGVhbHRoU2NvcmVEZWdyYWRlZDogY29uZmlnLmFsZXJ0VGhyZXNob2xkcz8uaGVhbHRoU2NvcmVEZWdyYWRlZCA/PyA3MCxcbiAgICAgICAgZmFpbHVyZVJhdGVIaWdoOiBjb25maWcuYWxlcnRUaHJlc2hvbGRzPy5mYWlsdXJlUmF0ZUhpZ2ggPz8gMC4yLFxuICAgICAgICBwZW5kaW5nQXBwcm92YWxzSGlnaDogY29uZmlnLmFsZXJ0VGhyZXNob2xkcz8ucGVuZGluZ0FwcHJvdmFsc0hpZ2ggPz8gMTAsXG4gICAgICB9LFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmnoTlu7rov5Dnu7TmkZjopoFcbiAgICovXG4gIGJ1aWxkT3BzU3VtbWFyeShcbiAgICBzbmFwc2hvdDogSGVhbHRoU25hcHNob3QsXG4gICAgYXVkaXREYXRhPzoge1xuICAgICAgZXZlbnRzOiBBdWRpdEV2ZW50W107XG4gICAgICBmYWlsdXJlczogRmFpbHVyZVJlY29yZFtdO1xuICAgIH1cbiAgKTogT3BzU3VtbWFyeSB7XG4gICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbiAgICBjb25zdCBnbG9iYWwgPSBzbmFwc2hvdC5nbG9iYWw7XG4gICAgXG4gICAgLy8g56Gu5a6a5oC75L2T54q25oCBXG4gICAgY29uc3Qgb3ZlcmFsbFN0YXR1cyA9IHRoaXMuZGV0ZXJtaW5lT3ZlcmFsbFN0YXR1cyhnbG9iYWwpO1xuICAgIFxuICAgIC8vIOmhtue6p+Wksei0pemXrumimFxuICAgIGNvbnN0IHRvcEZhaWx1cmVzID0gdGhpcy5idWlsZFRvcEZhaWx1cmVzKGF1ZGl0RGF0YT8uZmFpbHVyZXMgfHwgW10pO1xuICAgIFxuICAgIC8vIOmZjee6pyBTZXJ2ZXJcbiAgICBjb25zdCBkZWdyYWRlZFNlcnZlcnMgPSB0aGlzLmJ1aWxkRGVncmFkZWRTZXJ2ZXJzKHNuYXBzaG90LmJ5U2VydmVyKTtcbiAgICBcbiAgICAvLyDooqvpmLvloZ4v5b6F5a6h5om5IFNraWxsXG4gICAgY29uc3QgYmxvY2tlZE9yUGVuZGluZ1NraWxscyA9IHRoaXMuYnVpbGRCbG9ja2VkT3JQZW5kaW5nU2tpbGxzKHNuYXBzaG90LmJ5U2tpbGwpO1xuICAgIFxuICAgIC8vIOWuoeaJueeTtumiiFxuICAgIGNvbnN0IGFwcHJvdmFsQm90dGxlbmVja3MgPSB0aGlzLmJ1aWxkQXBwcm92YWxCb3R0bGVuZWNrcyhhdWRpdERhdGE/LmV2ZW50cyB8fCBbXSk7XG4gICAgXG4gICAgLy8g6YeN5pS+54Ot54K5XG4gICAgY29uc3QgcmVwbGF5SG90c3BvdHMgPSB0aGlzLmJ1aWxkUmVwbGF5SG90c3BvdHMoYXVkaXREYXRhPy5ldmVudHMgfHwgW10pO1xuICAgIFxuICAgIC8vIOW7uuiuruaTjeS9nFxuICAgIGNvbnN0IHJlY29tbWVuZGVkQWN0aW9ucyA9IHRoaXMuYnVpbGRSZWNvbW1lbmRlZEFjdGlvbnMoZ2xvYmFsLCB7XG4gICAgICB0b3BGYWlsdXJlcyxcbiAgICAgIGRlZ3JhZGVkU2VydmVycyxcbiAgICAgIGJsb2NrZWRPclBlbmRpbmdTa2lsbHMsXG4gICAgICBhcHByb3ZhbEJvdHRsZW5lY2tzLFxuICAgICAgcmVwbGF5SG90c3BvdHMsXG4gICAgfSk7XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIHN1bW1hcnlJZDogYG9wc18ke25vd31gLFxuICAgICAgY3JlYXRlZEF0OiBub3csXG4gICAgICBvdmVyYWxsU3RhdHVzLFxuICAgICAgaGVhbHRoU2NvcmU6IGdsb2JhbC5oZWFsdGhTY29yZSxcbiAgICAgIHRvcEZhaWx1cmVzLFxuICAgICAgZGVncmFkZWRTZXJ2ZXJzLFxuICAgICAgYmxvY2tlZE9yUGVuZGluZ1NraWxscyxcbiAgICAgIGFwcHJvdmFsQm90dGxlbmVja3MsXG4gICAgICByZXBsYXlIb3RzcG90cyxcbiAgICAgIHJlY29tbWVuZGVkQWN0aW9ucyxcbiAgICB9O1xuICB9XG4gIFxuICAvKipcbiAgICog5p6E5bu65q+P5pel6L+Q57u05pGY6KaBXG4gICAqL1xuICBidWlsZERhaWx5T3BzRGlnZXN0KFxuICAgIHNuYXBzaG90czogSGVhbHRoU25hcHNob3RbXSxcbiAgICBkYXRlOiBzdHJpbmdcbiAgKToge1xuICAgIGRhdGU6IHN0cmluZztcbiAgICBhdmdIZWFsdGhTY29yZTogbnVtYmVyO1xuICAgIHRyZW5kOiAnaW1wcm92aW5nJyB8ICdzdGFibGUnIHwgJ2RlZ3JhZGluZyc7XG4gICAgY3JpdGljYWxJc3N1ZXM6IG51bWJlcjtcbiAgICBzdW1tYXJ5OiBzdHJpbmc7XG4gIH0ge1xuICAgIGlmIChzbmFwc2hvdHMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBkYXRlLFxuICAgICAgICBhdmdIZWFsdGhTY29yZTogMTAwLFxuICAgICAgICB0cmVuZDogJ3N0YWJsZScsXG4gICAgICAgIGNyaXRpY2FsSXNzdWVzOiAwLFxuICAgICAgICBzdW1tYXJ5OiAnTm8gZGF0YSBhdmFpbGFibGUnLFxuICAgICAgfTtcbiAgICB9XG4gICAgXG4gICAgLy8g6K6h566X5bmz5Z2H5YGl5bq36K+E5YiGXG4gICAgY29uc3QgdG90YWxTY29yZSA9IHNuYXBzaG90cy5yZWR1Y2UoKHN1bSwgcykgPT4gc3VtICsgcy5nbG9iYWwuaGVhbHRoU2NvcmUsIDApO1xuICAgIGNvbnN0IGF2Z0hlYWx0aFNjb3JlID0gTWF0aC5yb3VuZCh0b3RhbFNjb3JlIC8gc25hcHNob3RzLmxlbmd0aCk7XG4gICAgXG4gICAgLy8g6K6h566X6LaL5Yq/XG4gICAgY29uc3QgdHJlbmQgPSB0aGlzLmNhbGN1bGF0ZVRyZW5kKHNuYXBzaG90cyk7XG4gICAgXG4gICAgLy8g57uf6K6h5Lil6YeN6Zeu6aKYXG4gICAgbGV0IGNyaXRpY2FsSXNzdWVzID0gMDtcbiAgICBcbiAgICBmb3IgKGNvbnN0IHNuYXBzaG90IG9mIHNuYXBzaG90cykge1xuICAgICAgaWYgKHNuYXBzaG90Lmdsb2JhbC5oZWFsdGhTY29yZSA8IHRoaXMuY29uZmlnLmFsZXJ0VGhyZXNob2xkcy5oZWFsdGhTY29yZUNyaXRpY2FsKSB7XG4gICAgICAgIGNyaXRpY2FsSXNzdWVzKys7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIOeUn+aIkOaRmOimgVxuICAgIGNvbnN0IHN1bW1hcnkgPSB0aGlzLmdlbmVyYXRlRGFpbHlTdW1tYXJ5KGF2Z0hlYWx0aFNjb3JlLCB0cmVuZCwgY3JpdGljYWxJc3N1ZXMpO1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBkYXRlLFxuICAgICAgYXZnSGVhbHRoU2NvcmUsXG4gICAgICB0cmVuZCxcbiAgICAgIGNyaXRpY2FsSXNzdWVzLFxuICAgICAgc3VtbWFyeSxcbiAgICB9O1xuICB9XG4gIFxuICAvKipcbiAgICog5p6E5bu66aG257qn6Zeu6aKY5YiX6KGoXG4gICAqL1xuICBidWlsZFRvcElzc3VlcyhcbiAgICBzbmFwc2hvdDogSGVhbHRoU25hcHNob3QsXG4gICAgYXVkaXREYXRhPzogeyBmYWlsdXJlczogRmFpbHVyZVJlY29yZFtdIH1cbiAgKTogQXJyYXk8e1xuICAgIGlzc3VlOiBzdHJpbmc7XG4gICAgc2V2ZXJpdHk6IEFsZXJ0TGV2ZWw7XG4gICAgaW1wYWN0OiBzdHJpbmc7XG4gICAgY291bnQ6IG51bWJlcjtcbiAgfT4ge1xuICAgIGNvbnN0IGlzc3VlczogQXJyYXk8e1xuICAgICAgaXNzdWU6IHN0cmluZztcbiAgICAgIHNldmVyaXR5OiBBbGVydExldmVsO1xuICAgICAgaW1wYWN0OiBzdHJpbmc7XG4gICAgICBjb3VudDogbnVtYmVyO1xuICAgIH0+ID0gW107XG4gICAgXG4gICAgY29uc3QgZ2xvYmFsID0gc25hcHNob3QuZ2xvYmFsO1xuICAgIFxuICAgIC8vIOmrmOWksei0peeOh1xuICAgIGlmIChnbG9iYWwuZmFpbHVyZVJhdGUgPj0gdGhpcy5jb25maWcuYWxlcnRUaHJlc2hvbGRzLmZhaWx1cmVSYXRlSGlnaCkge1xuICAgICAgaXNzdWVzLnB1c2goe1xuICAgICAgICBpc3N1ZTogJ0hpZ2ggZmFpbHVyZSByYXRlJyxcbiAgICAgICAgc2V2ZXJpdHk6IGdsb2JhbC5mYWlsdXJlUmF0ZSA+PSAwLjUgPyAnY3JpdGljYWwnIDogJ2hpZ2gnLFxuICAgICAgICBpbXBhY3Q6IGAkeyhnbG9iYWwuZmFpbHVyZVJhdGUgKiAxMDApLnRvRml4ZWQoMSl9JSBvZiB0YXNrcyBmYWlsaW5nYCxcbiAgICAgICAgY291bnQ6IGdsb2JhbC5mYWlsZWRUYXNrcyxcbiAgICAgIH0pO1xuICAgIH1cbiAgICBcbiAgICAvLyDkvY7lgaXlurfor4TliIZcbiAgICBpZiAoZ2xvYmFsLmhlYWx0aFNjb3JlIDwgdGhpcy5jb25maWcuYWxlcnRUaHJlc2hvbGRzLmhlYWx0aFNjb3JlRGVncmFkZWQpIHtcbiAgICAgIGlzc3Vlcy5wdXNoKHtcbiAgICAgICAgaXNzdWU6ICdMb3cgaGVhbHRoIHNjb3JlJyxcbiAgICAgICAgc2V2ZXJpdHk6IGdsb2JhbC5oZWFsdGhTY29yZSA8IHRoaXMuY29uZmlnLmFsZXJ0VGhyZXNob2xkcy5oZWFsdGhTY29yZUNyaXRpY2FsID8gJ2NyaXRpY2FsJyA6ICdoaWdoJyxcbiAgICAgICAgaW1wYWN0OiBgSGVhbHRoIHNjb3JlOiAke2dsb2JhbC5oZWFsdGhTY29yZX0vMTAwYCxcbiAgICAgICAgY291bnQ6IDEsXG4gICAgICB9KTtcbiAgICB9XG4gICAgXG4gICAgLy8g6ZmN57qnIFNlcnZlclxuICAgIGlmIChnbG9iYWwuZGVncmFkZWRTZXJ2ZXJzID4gMCkge1xuICAgICAgaXNzdWVzLnB1c2goe1xuICAgICAgICBpc3N1ZTogJ0RlZ3JhZGVkIHNlcnZlcnMnLFxuICAgICAgICBzZXZlcml0eTogZ2xvYmFsLmRlZ3JhZGVkU2VydmVycyA+PSAzID8gJ2NyaXRpY2FsJyA6ICdoaWdoJyxcbiAgICAgICAgaW1wYWN0OiBgJHtnbG9iYWwuZGVncmFkZWRTZXJ2ZXJzfSBzZXJ2ZXIocykgZGVncmFkZWQgb3IgdW5hdmFpbGFibGVgLFxuICAgICAgICBjb3VudDogZ2xvYmFsLmRlZ3JhZGVkU2VydmVycyxcbiAgICAgIH0pO1xuICAgIH1cbiAgICBcbiAgICAvLyDooqvpmLvloZ4gU2tpbGxcbiAgICBpZiAoZ2xvYmFsLmJsb2NrZWRTa2lsbHMgPiAwKSB7XG4gICAgICBpc3N1ZXMucHVzaCh7XG4gICAgICAgIGlzc3VlOiAnQmxvY2tlZCBza2lsbHMnLFxuICAgICAgICBzZXZlcml0eTogZ2xvYmFsLmJsb2NrZWRTa2lsbHMgPj0gNSA/ICdoaWdoJyA6ICdtZWRpdW0nLFxuICAgICAgICBpbXBhY3Q6IGAke2dsb2JhbC5ibG9ja2VkU2tpbGxzfSBza2lsbChzKSBibG9ja2VkYCxcbiAgICAgICAgY291bnQ6IGdsb2JhbC5ibG9ja2VkU2tpbGxzLFxuICAgICAgfSk7XG4gICAgfVxuICAgIFxuICAgIC8vIOWuoeaJueenr+WOi1xuICAgIGlmIChnbG9iYWwucGVuZGluZ0FwcHJvdmFscyA+PSB0aGlzLmNvbmZpZy5hbGVydFRocmVzaG9sZHMucGVuZGluZ0FwcHJvdmFsc0hpZ2gpIHtcbiAgICAgIGlzc3Vlcy5wdXNoKHtcbiAgICAgICAgaXNzdWU6ICdBcHByb3ZhbCBiYWNrbG9nJyxcbiAgICAgICAgc2V2ZXJpdHk6IGdsb2JhbC5wZW5kaW5nQXBwcm92YWxzID49IDUwID8gJ2hpZ2gnIDogJ21lZGl1bScsXG4gICAgICAgIGltcGFjdDogYCR7Z2xvYmFsLnBlbmRpbmdBcHByb3ZhbHN9IGFwcHJvdmFsKHMpIHBlbmRpbmdgLFxuICAgICAgICBjb3VudDogZ2xvYmFsLnBlbmRpbmdBcHByb3ZhbHMsXG4gICAgICB9KTtcbiAgICB9XG4gICAgXG4gICAgLy8g5oyJ5Lil6YeN5oCn5o6S5bqPXG4gICAgY29uc3Qgc2V2ZXJpdHlPcmRlciA9IHsgY3JpdGljYWw6IDAsIGhpZ2g6IDEsIG1lZGl1bTogMiwgbG93OiAzIH07XG4gICAgaXNzdWVzLnNvcnQoKGEsIGIpID0+IHNldmVyaXR5T3JkZXJbYS5zZXZlcml0eV0gLSBzZXZlcml0eU9yZGVyW2Iuc2V2ZXJpdHldKTtcbiAgICBcbiAgICByZXR1cm4gaXNzdWVzLnNsaWNlKDAsIHRoaXMuY29uZmlnLnRvcElzc3Vlc0xpbWl0KTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOaehOW7uuW7uuiuruaTjeS9nOWIl+ihqFxuICAgKi9cbiAgYnVpbGRBdHRlbnRpb25JdGVtcyhcbiAgICBzdW1tYXJ5OiBPcHNTdW1tYXJ5XG4gICk6IEFycmF5PHtcbiAgICBwcmlvcml0eTogQWxlcnRMZXZlbDtcbiAgICBpdGVtOiBzdHJpbmc7XG4gICAgYWN0aW9uOiBzdHJpbmc7XG4gIH0+IHtcbiAgICBjb25zdCBpdGVtczogQXJyYXk8e1xuICAgICAgcHJpb3JpdHk6IEFsZXJ0TGV2ZWw7XG4gICAgICBpdGVtOiBzdHJpbmc7XG4gICAgICBhY3Rpb246IHN0cmluZztcbiAgICB9PiA9IFtdO1xuICAgIFxuICAgIC8vIOmhtue6p+Wksei0pemXrumimFxuICAgIGZvciAoY29uc3QgZmFpbHVyZSBvZiBzdW1tYXJ5LnRvcEZhaWx1cmVzLnNsaWNlKDAsIDMpKSB7XG4gICAgICBpdGVtcy5wdXNoKHtcbiAgICAgICAgcHJpb3JpdHk6IGZhaWx1cmUuc2V2ZXJpdHksXG4gICAgICAgIGl0ZW06IGZhaWx1cmUuaXNzdWUsXG4gICAgICAgIGFjdGlvbjogYEludmVzdGlnYXRlICR7ZmFpbHVyZS5jb3VudH0gJHtmYWlsdXJlLmlzc3VlLnRvTG93ZXJDYXNlKCl9IGV2ZW50c2AsXG4gICAgICB9KTtcbiAgICB9XG4gICAgXG4gICAgLy8g6ZmN57qnIFNlcnZlclxuICAgIGZvciAoY29uc3Qgc2VydmVyIG9mIHN1bW1hcnkuZGVncmFkZWRTZXJ2ZXJzLnNsaWNlKDAsIDIpKSB7XG4gICAgICBpdGVtcy5wdXNoKHtcbiAgICAgICAgcHJpb3JpdHk6IHNlcnZlci5zdGF0dXMgPT09ICd1bmF2YWlsYWJsZScgPyAnY3JpdGljYWwnIDogJ2hpZ2gnLFxuICAgICAgICBpdGVtOiBgU2VydmVyICR7c2VydmVyLnNlcnZlcklkfSAke3NlcnZlci5zdGF0dXN9YCxcbiAgICAgICAgYWN0aW9uOiBgQ2hlY2sgc2VydmVyIGhlYWx0aCBhbmQgcmVzdGFydCBpZiBuZWVkZWRgLFxuICAgICAgfSk7XG4gICAgfVxuICAgIFxuICAgIC8vIOiiq+mYu+WhniBTa2lsbFxuICAgIGZvciAoY29uc3Qgc2tpbGwgb2Ygc3VtbWFyeS5ibG9ja2VkT3JQZW5kaW5nU2tpbGxzLnNsaWNlKDAsIDIpKSB7XG4gICAgICBpdGVtcy5wdXNoKHtcbiAgICAgICAgcHJpb3JpdHk6IHNraWxsLnN0YXR1cyA9PT0gJ2Jsb2NrZWQnID8gJ2hpZ2gnIDogJ21lZGl1bScsXG4gICAgICAgIGl0ZW06IGBTa2lsbCAke3NraWxsLnNraWxsTmFtZX0gJHtza2lsbC5zdGF0dXN9YCxcbiAgICAgICAgYWN0aW9uOiBgUmV2aWV3IHNraWxsIGNvbmZpZ3VyYXRpb24gYW5kIHBlcm1pc3Npb25zYCxcbiAgICAgIH0pO1xuICAgIH1cbiAgICBcbiAgICAvLyDlu7rorq7mk43kvZxcbiAgICBmb3IgKGNvbnN0IGFjdGlvbiBvZiBzdW1tYXJ5LnJlY29tbWVuZGVkQWN0aW9ucy5zbGljZSgwLCAzKSkge1xuICAgICAgaXRlbXMucHVzaCh7XG4gICAgICAgIHByaW9yaXR5OiBhY3Rpb24ucHJpb3JpdHkgPT09ICdoaWdoJyA/ICdoaWdoJyA6ICdtZWRpdW0nLFxuICAgICAgICBpdGVtOiBhY3Rpb24uYWN0aW9uLFxuICAgICAgICBhY3Rpb246IGFjdGlvbi5yZWFzb24sXG4gICAgICB9KTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGl0ZW1zO1xuICB9XG4gIFxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIC8vIOWGhemDqOaWueazlVxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIFxuICAvKipcbiAgICog56Gu5a6a5oC75L2T54q25oCBXG4gICAqL1xuICBwcml2YXRlIGRldGVybWluZU92ZXJhbGxTdGF0dXMoZ2xvYmFsOiBHbG9iYWxIZWFsdGhNZXRyaWNzKTogJ2hlYWx0aHknIHwgJ2RlZ3JhZGVkJyB8ICdjcml0aWNhbCcge1xuICAgIGlmIChnbG9iYWwuaGVhbHRoU2NvcmUgPCB0aGlzLmNvbmZpZy5hbGVydFRocmVzaG9sZHMuaGVhbHRoU2NvcmVDcml0aWNhbCkge1xuICAgICAgcmV0dXJuICdjcml0aWNhbCc7XG4gICAgfVxuICAgIFxuICAgIGlmIChnbG9iYWwuaGVhbHRoU2NvcmUgPCB0aGlzLmNvbmZpZy5hbGVydFRocmVzaG9sZHMuaGVhbHRoU2NvcmVEZWdyYWRlZCkge1xuICAgICAgcmV0dXJuICdkZWdyYWRlZCc7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiAnaGVhbHRoeSc7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmnoTlu7rpobbnuqflpLHotKXpl67pophcbiAgICovXG4gIHByaXZhdGUgYnVpbGRUb3BGYWlsdXJlcyhmYWlsdXJlczogRmFpbHVyZVJlY29yZFtdKTogT3BzU3VtbWFyeVsndG9wRmFpbHVyZXMnXSB7XG4gICAgLy8g5oyJ5YiG57G75YiG57uEXG4gICAgY29uc3QgYnlDYXRlZ29yeTogUmVjb3JkPHN0cmluZywgbnVtYmVyPiA9IHt9O1xuICAgIFxuICAgIGZvciAoY29uc3QgZmFpbHVyZSBvZiBmYWlsdXJlcykge1xuICAgICAgY29uc3QgY2F0ZWdvcnkgPSBmYWlsdXJlLmNhdGVnb3J5IHx8ICd1bmtub3duJztcbiAgICAgIGJ5Q2F0ZWdvcnlbY2F0ZWdvcnldID0gKGJ5Q2F0ZWdvcnlbY2F0ZWdvcnldIHx8IDApICsgMTtcbiAgICB9XG4gICAgXG4gICAgLy8g6L2s5o2i5Li65YiX6KGo5bm25o6S5bqPXG4gICAgY29uc3QgdG9wRmFpbHVyZXMgPSBPYmplY3QuZW50cmllcyhieUNhdGVnb3J5KVxuICAgICAgLm1hcCgoW2NhdGVnb3J5LCBjb3VudF0pID0+ICh7XG4gICAgICAgIGNhdGVnb3J5LFxuICAgICAgICBjb3VudCxcbiAgICAgICAgaW1wYWN0OiB0aGlzLmdldENhdGVnb3J5SW1wYWN0KGNhdGVnb3J5KSxcbiAgICAgIH0pKVxuICAgICAgLnNvcnQoKGEsIGIpID0+IGIuY291bnQgLSBhLmNvdW50KVxuICAgICAgLnNsaWNlKDAsIHRoaXMuY29uZmlnLnRvcElzc3Vlc0xpbWl0KTtcbiAgICBcbiAgICByZXR1cm4gdG9wRmFpbHVyZXM7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmnoTlu7rpmY3nuqcgU2VydmVyIOWIl+ihqFxuICAgKi9cbiAgcHJpdmF0ZSBidWlsZERlZ3JhZGVkU2VydmVycyhcbiAgICBieVNlcnZlcjogUmVjb3JkPHN0cmluZywgU2VydmVySGVhbHRoTWV0cmljcz5cbiAgKTogT3BzU3VtbWFyeVsnZGVncmFkZWRTZXJ2ZXJzJ10ge1xuICAgIGNvbnN0IGRlZ3JhZGVkOiBPcHNTdW1tYXJ5WydkZWdyYWRlZFNlcnZlcnMnXSA9IFtdO1xuICAgIFxuICAgIGZvciAoY29uc3QgW3NlcnZlcklkLCBtZXRyaWNzXSBvZiBPYmplY3QuZW50cmllcyhieVNlcnZlcikpIHtcbiAgICAgIGlmIChtZXRyaWNzLmhlYWx0aFN0YXR1cyAhPT0gJ2hlYWx0aHknKSB7XG4gICAgICAgIGRlZ3JhZGVkLnB1c2goe1xuICAgICAgICAgIHNlcnZlcklkLFxuICAgICAgICAgIHN0YXR1czogbWV0cmljcy5oZWFsdGhTdGF0dXMsXG4gICAgICAgICAgZXJyb3JSYXRlOiBtZXRyaWNzLmVycm9yUmF0ZSxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIOaMiemUmeivr+eOh+aOkuW6j1xuICAgIGRlZ3JhZGVkLnNvcnQoKGEsIGIpID0+IGIuZXJyb3JSYXRlIC0gYS5lcnJvclJhdGUpO1xuICAgIFxuICAgIHJldHVybiBkZWdyYWRlZDtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOaehOW7uuiiq+mYu+Whni/lvoXlrqHmibkgU2tpbGwg5YiX6KGoXG4gICAqL1xuICBwcml2YXRlIGJ1aWxkQmxvY2tlZE9yUGVuZGluZ1NraWxscyhcbiAgICBieVNraWxsOiBSZWNvcmQ8c3RyaW5nLCBTa2lsbEhlYWx0aE1ldHJpY3M+XG4gICk6IE9wc1N1bW1hcnlbJ2Jsb2NrZWRPclBlbmRpbmdTa2lsbHMnXSB7XG4gICAgY29uc3QgYmxvY2tlZE9yUGVuZGluZzogT3BzU3VtbWFyeVsnYmxvY2tlZE9yUGVuZGluZ1NraWxscyddID0gW107XG4gICAgXG4gICAgZm9yIChjb25zdCBbc2tpbGxOYW1lLCBtZXRyaWNzXSBvZiBPYmplY3QuZW50cmllcyhieVNraWxsKSkge1xuICAgICAgaWYgKG1ldHJpY3MuYmxvY2tlZEZyZXF1ZW5jeSA+IDApIHtcbiAgICAgICAgYmxvY2tlZE9yUGVuZGluZy5wdXNoKHtcbiAgICAgICAgICBza2lsbE5hbWUsXG4gICAgICAgICAgc3RhdHVzOiAnYmxvY2tlZCcsXG4gICAgICAgICAgY291bnQ6IG1ldHJpY3MuYmxvY2tlZEZyZXF1ZW5jeSxcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKG1ldHJpY3MucGVuZGluZ0ZyZXF1ZW5jeSA+IDApIHtcbiAgICAgICAgYmxvY2tlZE9yUGVuZGluZy5wdXNoKHtcbiAgICAgICAgICBza2lsbE5hbWUsXG4gICAgICAgICAgc3RhdHVzOiAncGVuZGluZycsXG4gICAgICAgICAgY291bnQ6IG1ldHJpY3MucGVuZGluZ0ZyZXF1ZW5jeSxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIOaMieaVsOmHj+aOkuW6j1xuICAgIGJsb2NrZWRPclBlbmRpbmcuc29ydCgoYSwgYikgPT4gYi5jb3VudCAtIGEuY291bnQpO1xuICAgIFxuICAgIHJldHVybiBibG9ja2VkT3JQZW5kaW5nO1xuICB9XG4gIFxuICAvKipcbiAgICog5p6E5bu65a6h5om555O26aKI5YiX6KGoXG4gICAqL1xuICBwcml2YXRlIGJ1aWxkQXBwcm92YWxCb3R0bGVuZWNrcyhldmVudHM6IEF1ZGl0RXZlbnRbXSk6IE9wc1N1bW1hcnlbJ2FwcHJvdmFsQm90dGxlbmVja3MnXSB7XG4gICAgLy8g5oyJ5a6h5om557G75Z6L5YiG57uEXG4gICAgY29uc3QgYnlUeXBlOiBSZWNvcmQ8c3RyaW5nLCB7IHBlbmRpbmc6IG51bWJlcjsgdG90YWxXYWl0VGltZTogbnVtYmVyIH0+ID0ge307XG4gICAgXG4gICAgZm9yIChjb25zdCBldmVudCBvZiBldmVudHMpIHtcbiAgICAgIGlmIChldmVudC5ldmVudFR5cGUgPT09ICdhcHByb3ZhbC5yZXF1ZXN0ZWQnKSB7XG4gICAgICAgIGNvbnN0IHR5cGUgPSBldmVudC5jYXRlZ29yeSB8fCAnZ2VuZXJhbCc7XG4gICAgICAgIFxuICAgICAgICBpZiAoIWJ5VHlwZVt0eXBlXSkge1xuICAgICAgICAgIGJ5VHlwZVt0eXBlXSA9IHsgcGVuZGluZzogMCwgdG90YWxXYWl0VGltZTogMCB9O1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBieVR5cGVbdHlwZV0ucGVuZGluZysrO1xuICAgICAgICBcbiAgICAgICAgaWYgKGV2ZW50Lm1ldGFkYXRhPy53YWl0VGltZU1zKSB7XG4gICAgICAgICAgYnlUeXBlW3R5cGVdLnRvdGFsV2FpdFRpbWUgKz0gZXZlbnQubWV0YWRhdGEud2FpdFRpbWVNcztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyDovazmjaLkuLrliJfooahcbiAgICBjb25zdCBib3R0bGVuZWNrcyA9IE9iamVjdC5lbnRyaWVzKGJ5VHlwZSlcbiAgICAgIC5tYXAoKFt0eXBlLCBkYXRhXSkgPT4gKHtcbiAgICAgICAgYXBwcm92YWxUeXBlOiB0eXBlLFxuICAgICAgICBwZW5kaW5nQ291bnQ6IGRhdGEucGVuZGluZyxcbiAgICAgICAgYXZnV2FpdFRpbWVNczogZGF0YS5wZW5kaW5nID4gMCA/IGRhdGEudG90YWxXYWl0VGltZSAvIGRhdGEucGVuZGluZyA6IDAsXG4gICAgICB9KSlcbiAgICAgIC5zb3J0KChhLCBiKSA9PiBiLnBlbmRpbmdDb3VudCAtIGEucGVuZGluZ0NvdW50KVxuICAgICAgLnNsaWNlKDAsIDUpO1xuICAgIFxuICAgIHJldHVybiBib3R0bGVuZWNrcztcbiAgfVxuICBcbiAgLyoqXG4gICAqIOaehOW7uumHjeaUvueDreeCueWIl+ihqFxuICAgKi9cbiAgcHJpdmF0ZSBidWlsZFJlcGxheUhvdHNwb3RzKGV2ZW50czogQXVkaXRFdmVudFtdKTogT3BzU3VtbWFyeVsncmVwbGF5SG90c3BvdHMnXSB7XG4gICAgLy8g5oyJ5Lu75YqhIElEIOWIhue7hOmHjeaUvuS6i+S7tlxuICAgIGNvbnN0IGJ5VGFzazogUmVjb3JkPHN0cmluZywgeyBjb3VudDogbnVtYmVyOyByZWFzb25zOiBzdHJpbmdbXSB9PiA9IHt9O1xuICAgIFxuICAgIGZvciAoY29uc3QgZXZlbnQgb2YgZXZlbnRzKSB7XG4gICAgICBpZiAoZXZlbnQuZXZlbnRUeXBlID09PSAndGFzay5yZXBsYXllZCcgJiYgZXZlbnQudGFza0lkKSB7XG4gICAgICAgIGlmICghYnlUYXNrW2V2ZW50LnRhc2tJZF0pIHtcbiAgICAgICAgICBieVRhc2tbZXZlbnQudGFza0lkXSA9IHsgY291bnQ6IDAsIHJlYXNvbnM6IFtdIH07XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGJ5VGFza1tldmVudC50YXNrSWRdLmNvdW50Kys7XG4gICAgICAgIFxuICAgICAgICBpZiAoZXZlbnQucmVhc29uKSB7XG4gICAgICAgICAgYnlUYXNrW2V2ZW50LnRhc2tJZF0ucmVhc29ucy5wdXNoKGV2ZW50LnJlYXNvbik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8g6L2s5o2i5Li65YiX6KGoXG4gICAgY29uc3QgaG90c3BvdHMgPSBPYmplY3QuZW50cmllcyhieVRhc2spXG4gICAgICAubWFwKChbdGFza0lkLCBkYXRhXSkgPT4gKHtcbiAgICAgICAgdGFza0lkLFxuICAgICAgICByZXBsYXlDb3VudDogZGF0YS5jb3VudCxcbiAgICAgICAgcmVhc29uOiBkYXRhLnJlYXNvbnNbMF0gfHwgJ1Vua25vd24nLFxuICAgICAgfSkpXG4gICAgICAuc29ydCgoYSwgYikgPT4gYi5yZXBsYXlDb3VudCAtIGEucmVwbGF5Q291bnQpXG4gICAgICAuc2xpY2UoMCwgNSk7XG4gICAgXG4gICAgcmV0dXJuIGhvdHNwb3RzO1xuICB9XG4gIFxuICAvKipcbiAgICog5p6E5bu65bu66K6u5pON5L2c5YiX6KGoXG4gICAqL1xuICBwcml2YXRlIGJ1aWxkUmVjb21tZW5kZWRBY3Rpb25zKFxuICAgIGdsb2JhbDogR2xvYmFsSGVhbHRoTWV0cmljcyxcbiAgICBpc3N1ZXM6IHtcbiAgICAgIHRvcEZhaWx1cmVzOiBPcHNTdW1tYXJ5Wyd0b3BGYWlsdXJlcyddO1xuICAgICAgZGVncmFkZWRTZXJ2ZXJzOiBPcHNTdW1tYXJ5WydkZWdyYWRlZFNlcnZlcnMnXTtcbiAgICAgIGJsb2NrZWRPclBlbmRpbmdTa2lsbHM6IE9wc1N1bW1hcnlbJ2Jsb2NrZWRPclBlbmRpbmdTa2lsbHMnXTtcbiAgICAgIGFwcHJvdmFsQm90dGxlbmVja3M6IE9wc1N1bW1hcnlbJ2FwcHJvdmFsQm90dGxlbmVja3MnXTtcbiAgICAgIHJlcGxheUhvdHNwb3RzOiBPcHNTdW1tYXJ5WydyZXBsYXlIb3RzcG90cyddO1xuICAgIH1cbiAgKTogT3BzU3VtbWFyeVsncmVjb21tZW5kZWRBY3Rpb25zJ10ge1xuICAgIGNvbnN0IGFjdGlvbnM6IE9wc1N1bW1hcnlbJ3JlY29tbWVuZGVkQWN0aW9ucyddID0gW107XG4gICAgXG4gICAgLy8g6auY5aSx6LSl546HXG4gICAgaWYgKGdsb2JhbC5mYWlsdXJlUmF0ZSA+PSB0aGlzLmNvbmZpZy5hbGVydFRocmVzaG9sZHMuZmFpbHVyZVJhdGVIaWdoKSB7XG4gICAgICBhY3Rpb25zLnB1c2goe1xuICAgICAgICBwcmlvcml0eTogJ2hpZ2gnLFxuICAgICAgICBhY3Rpb246ICdJbnZlc3RpZ2F0ZSBoaWdoIGZhaWx1cmUgcmF0ZScsXG4gICAgICAgIHJlYXNvbjogYCR7KGdsb2JhbC5mYWlsdXJlUmF0ZSAqIDEwMCkudG9GaXhlZCgxKX0lIG9mIHRhc2tzIGFyZSBmYWlsaW5nYCxcbiAgICAgIH0pO1xuICAgIH1cbiAgICBcbiAgICAvLyDpmY3nuqcgU2VydmVyXG4gICAgaWYgKGlzc3Vlcy5kZWdyYWRlZFNlcnZlcnMubGVuZ3RoID4gMCkge1xuICAgICAgYWN0aW9ucy5wdXNoKHtcbiAgICAgICAgcHJpb3JpdHk6ICdoaWdoJyxcbiAgICAgICAgYWN0aW9uOiBgQ2hlY2sgJHtpc3N1ZXMuZGVncmFkZWRTZXJ2ZXJzLmxlbmd0aH0gZGVncmFkZWQgc2VydmVyKHMpYCxcbiAgICAgICAgcmVhc29uOiBpc3N1ZXMuZGVncmFkZWRTZXJ2ZXJzLm1hcChzID0+IHMuc2VydmVySWQpLmpvaW4oJywgJyksXG4gICAgICB9KTtcbiAgICB9XG4gICAgXG4gICAgLy8g6KKr6Zi75aGeIFNraWxsXG4gICAgaWYgKGlzc3Vlcy5ibG9ja2VkT3JQZW5kaW5nU2tpbGxzLmxlbmd0aCA+IDApIHtcbiAgICAgIGFjdGlvbnMucHVzaCh7XG4gICAgICAgIHByaW9yaXR5OiAnbWVkaXVtJyxcbiAgICAgICAgYWN0aW9uOiBgUmV2aWV3ICR7aXNzdWVzLmJsb2NrZWRPclBlbmRpbmdTa2lsbHMubGVuZ3RofSBibG9ja2VkL3BlbmRpbmcgc2tpbGwocylgLFxuICAgICAgICByZWFzb246IGlzc3Vlcy5ibG9ja2VkT3JQZW5kaW5nU2tpbGxzLm1hcChzID0+IHMuc2tpbGxOYW1lKS5qb2luKCcsICcpLFxuICAgICAgfSk7XG4gICAgfVxuICAgIFxuICAgIC8vIOWuoeaJueenr+WOi1xuICAgIGlmIChnbG9iYWwucGVuZGluZ0FwcHJvdmFscyA+PSB0aGlzLmNvbmZpZy5hbGVydFRocmVzaG9sZHMucGVuZGluZ0FwcHJvdmFsc0hpZ2gpIHtcbiAgICAgIGFjdGlvbnMucHVzaCh7XG4gICAgICAgIHByaW9yaXR5OiAnbWVkaXVtJyxcbiAgICAgICAgYWN0aW9uOiAnQ2xlYXIgYXBwcm92YWwgYmFja2xvZycsXG4gICAgICAgIHJlYXNvbjogYCR7Z2xvYmFsLnBlbmRpbmdBcHByb3ZhbHN9IGFwcHJvdmFscyBwZW5kaW5nYCxcbiAgICAgIH0pO1xuICAgIH1cbiAgICBcbiAgICAvLyDph43mlL7ng63ngrlcbiAgICBpZiAoaXNzdWVzLnJlcGxheUhvdHNwb3RzLmxlbmd0aCA+IDApIHtcbiAgICAgIGFjdGlvbnMucHVzaCh7XG4gICAgICAgIHByaW9yaXR5OiAnbG93JyxcbiAgICAgICAgYWN0aW9uOiAnSW52ZXN0aWdhdGUgcmVwbGF5IGhvdHNwb3RzJyxcbiAgICAgICAgcmVhc29uOiBgJHtpc3N1ZXMucmVwbGF5SG90c3BvdHMubGVuZ3RofSB0YXNrKHMpIHdpdGggbXVsdGlwbGUgcmVwbGF5c2AsXG4gICAgICB9KTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGFjdGlvbnMuc2xpY2UoMCwgdGhpcy5jb25maWcucmVjb21tZW5kZWRBY3Rpb25zTGltaXQpO1xuICB9XG4gIFxuICAvKipcbiAgICog6K6h566X6LaL5Yq/XG4gICAqL1xuICBwcml2YXRlIGNhbGN1bGF0ZVRyZW5kKHNuYXBzaG90czogSGVhbHRoU25hcHNob3RbXSk6ICdpbXByb3ZpbmcnIHwgJ3N0YWJsZScgfCAnZGVncmFkaW5nJyB7XG4gICAgaWYgKHNuYXBzaG90cy5sZW5ndGggPCAyKSB7XG4gICAgICByZXR1cm4gJ3N0YWJsZSc7XG4gICAgfVxuICAgIFxuICAgIC8vIOavlOi+g+acgOi/keS4pOS4quW/q+eFp1xuICAgIGNvbnN0IHJlY2VudCA9IHNuYXBzaG90c1tzbmFwc2hvdHMubGVuZ3RoIC0gMV07XG4gICAgY29uc3QgcHJldmlvdXMgPSBzbmFwc2hvdHNbc25hcHNob3RzLmxlbmd0aCAtIDJdO1xuICAgIFxuICAgIGNvbnN0IGRpZmYgPSByZWNlbnQuZ2xvYmFsLmhlYWx0aFNjb3JlIC0gcHJldmlvdXMuZ2xvYmFsLmhlYWx0aFNjb3JlO1xuICAgIFxuICAgIGlmIChkaWZmID49IDUpIHtcbiAgICAgIHJldHVybiAnaW1wcm92aW5nJztcbiAgICB9IGVsc2UgaWYgKGRpZmYgPD0gLTUpIHtcbiAgICAgIHJldHVybiAnZGVncmFkaW5nJztcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuICdzdGFibGUnO1xuICAgIH1cbiAgfVxuICBcbiAgLyoqXG4gICAqIOeUn+aIkOavj+aXpeaRmOimgVxuICAgKi9cbiAgcHJpdmF0ZSBnZW5lcmF0ZURhaWx5U3VtbWFyeShcbiAgICBhdmdIZWFsdGhTY29yZTogbnVtYmVyLFxuICAgIHRyZW5kOiAnaW1wcm92aW5nJyB8ICdzdGFibGUnIHwgJ2RlZ3JhZGluZycsXG4gICAgY3JpdGljYWxJc3N1ZXM6IG51bWJlclxuICApOiBzdHJpbmcge1xuICAgIGNvbnN0IHBhcnRzOiBzdHJpbmdbXSA9IFtdO1xuICAgIFxuICAgIC8vIOWBpeW6t+ivhOWIhuaPj+i/sFxuICAgIGlmIChhdmdIZWFsdGhTY29yZSA+PSA5MCkge1xuICAgICAgcGFydHMucHVzaCgnU3lzdGVtIGhlYWx0aCBleGNlbGxlbnQnKTtcbiAgICB9IGVsc2UgaWYgKGF2Z0hlYWx0aFNjb3JlID49IDcwKSB7XG4gICAgICBwYXJ0cy5wdXNoKCdTeXN0ZW0gaGVhbHRoIGdvb2QnKTtcbiAgICB9IGVsc2UgaWYgKGF2Z0hlYWx0aFNjb3JlID49IDUwKSB7XG4gICAgICBwYXJ0cy5wdXNoKCdTeXN0ZW0gaGVhbHRoIGRlZ3JhZGVkJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHBhcnRzLnB1c2goJ1N5c3RlbSBoZWFsdGggY3JpdGljYWwnKTtcbiAgICB9XG4gICAgXG4gICAgLy8g6LaL5Yq/5o+P6L+wXG4gICAgcGFydHMucHVzaChgdHJlbmQgJHt0cmVuZH1gKTtcbiAgICBcbiAgICAvLyDkuKXph43pl67pophcbiAgICBpZiAoY3JpdGljYWxJc3N1ZXMgPiAwKSB7XG4gICAgICBwYXJ0cy5wdXNoKGAke2NyaXRpY2FsSXNzdWVzfSBjcml0aWNhbCBpc3N1ZShzKSBvY2N1cnJlZGApO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gcGFydHMuam9pbignLCAnKTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOiOt+WPluWIhuexu+W9seWTjeaPj+i/sFxuICAgKi9cbiAgcHJpdmF0ZSBnZXRDYXRlZ29yeUltcGFjdChjYXRlZ29yeTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCBpbXBhY3RzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgICAgdGltZW91dDogJ09wZXJhdGlvbnMgZXhjZWVkaW5nIHRpbWUgbGltaXRzJyxcbiAgICAgIHBlcm1pc3Npb246ICdBY2Nlc3MgY29udHJvbCBpc3N1ZXMnLFxuICAgICAgYXBwcm92YWw6ICdBcHByb3ZhbCB3b3JrZmxvdyBib3R0bGVuZWNrcycsXG4gICAgICByZXNvdXJjZTogJ1Jlc291cmNlIGF2YWlsYWJpbGl0eSBwcm9ibGVtcycsXG4gICAgICB2YWxpZGF0aW9uOiAnRGF0YSBvciBzY2hlbWEgaXNzdWVzJyxcbiAgICAgIGRlcGVuZGVuY3k6ICdNaXNzaW5nIG9yIGJyb2tlbiBkZXBlbmRlbmNpZXMnLFxuICAgICAgY29tcGF0aWJpbGl0eTogJ1ZlcnNpb24gbWlzbWF0Y2ggaXNzdWVzJyxcbiAgICAgIHByb3ZpZGVyOiAnRXh0ZXJuYWwgc2VydmljZSBwcm9ibGVtcycsXG4gICAgICBpbnRlcm5hbDogJ1N5c3RlbSBpbnRlcm5hbCBlcnJvcnMnLFxuICAgICAgcG9saWN5OiAnUG9saWN5IG9yIHF1b3RhIHZpb2xhdGlvbnMnLFxuICAgICAgdW5rbm93bjogJ1VuY2F0ZWdvcml6ZWQgZmFpbHVyZXMnLFxuICAgIH07XG4gICAgXG4gICAgcmV0dXJuIGltcGFjdHNbY2F0ZWdvcnldIHx8ICdVbmtub3duIGltcGFjdCc7XG4gIH1cbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5L6/5o235Ye95pWwXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog5Yib5bu66L+Q57u05pGY6KaB55Sf5oiQ5ZmoXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVPcHNTdW1tYXJ5R2VuZXJhdG9yKGNvbmZpZz86IE9wc1N1bW1hcnlHZW5lcmF0b3JDb25maWcpOiBPcHNTdW1tYXJ5R2VuZXJhdG9yIHtcbiAgcmV0dXJuIG5ldyBPcHNTdW1tYXJ5R2VuZXJhdG9yKGNvbmZpZyk7XG59XG5cbi8qKlxuICog5b+r6YCf5p6E5bu66L+Q57u05pGY6KaBXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBidWlsZE9wc1N1bW1hcnkoXG4gIHNuYXBzaG90OiBIZWFsdGhTbmFwc2hvdCxcbiAgYXVkaXREYXRhPzogeyBldmVudHM6IEF1ZGl0RXZlbnRbXTsgZmFpbHVyZXM6IEZhaWx1cmVSZWNvcmRbXSB9LFxuICBjb25maWc/OiBPcHNTdW1tYXJ5R2VuZXJhdG9yQ29uZmlnXG4pOiBPcHNTdW1tYXJ5IHtcbiAgY29uc3QgZ2VuZXJhdG9yID0gbmV3IE9wc1N1bW1hcnlHZW5lcmF0b3IoY29uZmlnKTtcbiAgcmV0dXJuIGdlbmVyYXRvci5idWlsZE9wc1N1bW1hcnkoc25hcHNob3QsIGF1ZGl0RGF0YSk7XG59XG4iXX0=