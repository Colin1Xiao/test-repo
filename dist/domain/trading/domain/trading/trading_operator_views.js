"use strict";
/**
 * Trading Operator Views
 * Phase 2C-1 - 交易域 Operator 视图
 *
 * 职责：
 * - 提供 Trading Dashboard Snapshot
 * - 提供 Release Readiness 检查
 * - 提供 Active Incidents 视图
 * - 提供 Pending Approvals 视图
 * - 提供 Risk State 视图
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradingOperatorViews = void 0;
exports.createTradingOperatorViews = createTradingOperatorViews;
// ============================================================================
// Trading Operator Views
// ============================================================================
class TradingOperatorViews {
    constructor(config = {}) {
        this.config = {
            defaultEnvironment: config.defaultEnvironment || 'mainnet',
            dashboardRefreshIntervalMs: config.dashboardRefreshIntervalMs || 30000,
        };
    }
    /**
     * 构建 Trading Dashboard Snapshot
     */
    async buildDashboardSnapshot(releases, alerts, deployments, riskChanges) {
        const now = Date.now();
        const snapshotId = `trading_dashboard_${now}`;
        // 计算 Release 统计
        const releases24h = this.filterLast24h(releases, now);
        const releasesStats = {
            pending: releases.filter((r) => r.status === 'pending_approval').length,
            deploying: releases.filter((r) => r.status === 'deploying').length,
            deployed24h: releases24h.filter((r) => r.status === 'deployed').length,
            rolledBack24h: releases24h.filter((r) => r.status === 'rolled_back').length,
        };
        // 计算 Alert 统计
        const alerts24h = this.filterLast24h(alerts, now);
        const alertsStats = {
            active: alerts.filter((a) => !a.resolved).length,
            critical: alerts.filter((a) => a.severity === 'critical' && !a.resolved).length,
            acknowledged: alerts.filter((a) => a.acknowledged && !a.resolved).length,
            resolved24h: alerts24h.filter((a) => a.resolved).length,
        };
        // 计算 Deployment 统计
        const deployments24h = this.filterLast24h(deployments, now);
        const deploymentSuccess = deployments24h.filter((d) => d.status === 'success').length;
        const deploymentTotal = deployments24h.length;
        const deploymentsStats = {
            pending: deployments.filter((d) => d.status === 'pending').length,
            failed24h: deployments24h.filter((d) => d.status === 'failed').length,
            successRate24h: deploymentTotal > 0 ? deploymentSuccess / deploymentTotal : 0,
        };
        // 计算 Risk 统计
        const riskChanges24h = this.filterLast24h(riskChanges, now);
        const currentRiskLevel = this.getCurrentRiskLevel(riskChanges);
        const riskStats = {
            currentLevel: currentRiskLevel,
            recentChanges: riskChanges24h.length,
            breaches24h: riskChanges24h.filter((r) => r.type === 'breach').length,
        };
        return {
            snapshotId,
            generatedAt: now,
            releases: releasesStats,
            alerts: alertsStats,
            deployments: deploymentsStats,
            risk: riskStats,
        };
    }
    /**
     * 构建 Release Readiness 检查
     */
    async buildReleaseReadiness(releaseId, release) {
        const checks = [];
        const blockers = [];
        const warnings = [];
        // 检查 1: 审批状态
        if (release.status !== 'approved') {
            blockers.push('Release not approved');
            checks.push({ name: 'Approval', passed: false, message: 'Pending approval' });
        }
        else {
            checks.push({ name: 'Approval', passed: true });
        }
        // 检查 2: 风险级别
        if (release.details?.riskLevel === 'critical') {
            warnings.push('Critical risk level');
            checks.push({ name: 'Risk Level', passed: true, message: 'Critical - requires extra review' });
        }
        else {
            checks.push({ name: 'Risk Level', passed: true });
        }
        // 检查 3: 回滚计划
        if (!release.details?.rollbackPlan) {
            blockers.push('Missing rollback plan');
            checks.push({ name: 'Rollback Plan', passed: false });
        }
        else {
            checks.push({ name: 'Rollback Plan', passed: true });
        }
        // 检查 4: 测试通过
        if (release.metadata?.testsPassed === false) {
            blockers.push('Tests not passed');
            checks.push({ name: 'Tests', passed: false });
        }
        else {
            checks.push({ name: 'Tests', passed: true });
        }
        // 检查 5: 无活跃严重告警
        if (release.metadata?.activeCriticalAlerts > 0) {
            warnings.push(`${release.metadata.activeCriticalAlerts} critical alerts active`);
            checks.push({ name: 'Active Alerts', passed: true, message: 'Warnings present' });
        }
        else {
            checks.push({ name: 'Active Alerts', passed: true });
        }
        const ready = blockers.length === 0;
        return {
            releaseId,
            ready,
            checks,
            blockers,
            warnings,
        };
    }
    /**
     * 构建 Active Incidents 视图
     */
    async buildActiveIncidents(alerts) {
        const activeAlerts = alerts.filter((a) => !a.resolved);
        const criticalAlerts = activeAlerts.filter((a) => a.severity === 'critical');
        const items = activeAlerts.map((alert) => ({
            id: alert.id,
            type: alert.type,
            severity: alert.severity,
            title: alert.title || alert.description,
            age: Date.now() - alert.createdAt,
            acknowledged: alert.acknowledged,
        }));
        return {
            total: activeAlerts.length,
            critical: criticalAlerts.length,
            items: items.sort((a, b) => {
                const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
                return severityOrder[a.severity] - severityOrder[b.severity];
            }),
        };
    }
    /**
     * 构建 Pending Approvals 视图
     */
    async buildPendingApprovals(approvals) {
        const pendingApprovals = approvals.filter((a) => a.status === 'pending');
        const items = pendingApprovals.map((approval) => ({
            id: approval.approvalId,
            type: approval.metadata?.sourceType || 'unknown',
            scope: approval.scope,
            riskLevel: approval.metadata?.riskLevel,
            age: Date.now() - approval.requestedAt,
            requestedBy: approval.requestingAgent,
        }));
        return {
            total: pendingApprovals.length,
            items: items.sort((a, b) => {
                const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
                return severityOrder[a.riskLevel] - severityOrder[b.riskLevel];
            }),
        };
    }
    /**
     * 构建 Risk State 视图
     */
    async buildRiskState(riskChanges) {
        const now = Date.now();
        const currentRiskLevel = this.getCurrentRiskLevel(riskChanges);
        const recentChanges = riskChanges.slice(-10).map((change) => ({
            timestamp: change.timestamp || change.createdAt,
            from: change.fromLevel || 'unknown',
            to: change.toLevel || change.level,
            reason: change.reason || '',
            changedBy: change.changedBy || 'system',
        }));
        const breaches24h = riskChanges
            .filter((r) => r.type === 'breach' && now - (r.timestamp || r.createdAt) < 24 * 60 * 60 * 1000)
            .map((breach) => ({
            timestamp: breach.timestamp || breach.createdAt,
            metric: breach.metric,
            threshold: breach.threshold,
            value: breach.value,
        }));
        const lastChanged = riskChanges.length > 0
            ? (riskChanges[riskChanges.length - 1].timestamp || riskChanges[riskChanges.length - 1].createdAt)
            : now;
        return {
            level: currentRiskLevel,
            lastChanged,
            recentChanges,
            breaches24h,
        };
    }
    // ============================================================================
    // 内部方法
    // ============================================================================
    /**
     * 过滤最近 24 小时的数据
     */
    filterLast24h(items, now) {
        const cutoff = now - 24 * 60 * 60 * 1000;
        return items.filter((item) => {
            const timestamp = item.timestamp || item.createdAt || 0;
            return timestamp >= cutoff;
        });
    }
    /**
     * 获取当前风险级别
     */
    getCurrentRiskLevel(riskChanges) {
        if (riskChanges.length === 0) {
            return 'low';
        }
        const lastChange = riskChanges[riskChanges.length - 1];
        return (lastChange.toLevel || lastChange.level || 'low');
    }
}
exports.TradingOperatorViews = TradingOperatorViews;
// ============================================================================
// 工厂函数
// ============================================================================
function createTradingOperatorViews(config) {
    return new TradingOperatorViews(config);
}
