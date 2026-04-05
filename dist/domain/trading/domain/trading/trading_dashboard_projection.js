"use strict";
/**
 * Trading Dashboard Projection
 * Phase 2D-1B - 交易域仪表盘投影
 *
 * 职责：
 * - 提供 Trading-specific Dashboard
 * - 显示 Release / Incident / Risk 状态
 * - 提供可操作视图
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradingDashboardProjection = void 0;
exports.createTradingDashboardProjection = createTradingDashboardProjection;
const trading_risk_state_service_1 = require("./trading_risk_state_service");
// ============================================================================
// Dashboard Projection
// ============================================================================
class TradingDashboardProjection {
    constructor(config = {}) {
        this.config = {
            refreshIntervalMs: config.refreshIntervalMs || 30000,
            maxItems: config.maxItems || 50,
        };
        this.riskStateService = (0, trading_risk_state_service_1.createTradingRiskStateService)();
    }
    /**
     * 构建增强版 Dashboard
     */
    async buildEnhancedDashboard(releases, alerts, deployments, approvals) {
        const now = Date.now();
        const snapshotId = `trading_dashboard_enhanced_${now}`;
        // 基础统计
        const releases24h = this.filterLast24h(releases, now);
        const alerts24h = this.filterLast24h(alerts, now);
        const deployments24h = this.filterLast24h(deployments, now);
        const releasesStats = {
            pending: releases.filter((r) => r.status === 'pending_approval').length,
            deploying: releases.filter((r) => r.status === 'deploying').length,
            deployed24h: releases24h.filter((r) => r.status === 'deployed').length,
            rolledBack24h: releases24h.filter((r) => r.status === 'rolled_back').length,
        };
        const alertsStats = {
            active: alerts.filter((a) => !a.resolved).length,
            critical: alerts.filter((a) => a.severity === 'critical' && !a.resolved).length,
            acknowledged: alerts.filter((a) => a.acknowledged && !a.resolved).length,
            resolved24h: alerts24h.filter((a) => a.resolved).length,
        };
        const deploymentSuccess = deployments24h.filter((d) => d.status === 'success').length;
        const deploymentTotal = deployments24h.length;
        const deploymentsStats = {
            pending: deployments.filter((d) => d.status === 'pending').length,
            failed24h: deployments24h.filter((d) => d.status === 'failed').length,
            successRate24h: deploymentTotal > 0 ? deploymentSuccess / deploymentTotal : 0,
        };
        // 风险状态
        const riskState = this.riskStateService.getCurrentState();
        const riskExposure = this.riskStateService.calculateExposure();
        const riskGate = this.riskStateService.checkRiskGate('deployment');
        // 计算 Top Blockers
        const topBlockers = [];
        // 未确认的严重告警
        const unackCriticalAlerts = alerts.filter((a) => !a.acknowledged && a.severity === 'critical');
        unackCriticalAlerts.forEach((a) => {
            topBlockers.push({
                type: 'unacknowledged_critical_alert',
                description: a.title || a.description,
                severity: 'critical',
            });
        });
        // 待处理的高风险审批
        const pendingHighRiskApprovals = approvals.filter((a) => a.status === 'pending' && a.metadata?.riskLevel === 'high');
        pendingHighRiskApprovals.forEach((a) => {
            topBlockers.push({
                type: 'pending_high_risk_approval',
                description: a.scope,
                severity: 'high',
            });
        });
        // 风险突破
        const riskReport = this.riskStateService.generateReport();
        if (riskReport.currentLevel === 'critical') {
            topBlockers.push({
                type: 'critical_risk_level',
                description: riskReport.summary,
                severity: 'critical',
            });
        }
        // 限制数量
        const limitedBlockers = topBlockers.slice(0, this.config.maxItems);
        // 最近操作
        const recentActions = [];
        // 从 releases 提取
        releases.slice(-5).forEach((r) => {
            if (r.status === 'deployed' || r.status === 'rolled_back') {
                recentActions.push({
                    action: r.status === 'deployed' ? 'deploy' : 'rollback',
                    target: r.details?.strategyName || 'unknown',
                    timestamp: r.updatedAt,
                    status: r.status,
                });
            }
        });
        // 从 alerts 提取
        alerts.slice(-5).forEach((a) => {
            if (a.acknowledged || a.resolved) {
                recentActions.push({
                    action: a.resolved ? 'resolve' : 'acknowledge',
                    target: a.title || a.type,
                    timestamp: a.resolvedAt || a.acknowledgedAt,
                    status: a.resolved ? 'resolved' : 'acknowledged',
                });
            }
        });
        return {
            snapshotId,
            generatedAt: now,
            releases: releasesStats,
            alerts: alertsStats,
            deployments: deploymentsStats,
            risk: {
                level: riskState.level,
                lastChanged: riskState.lastChanged,
                recentChanges: riskState.recentChanges,
                breaches24h: riskState.breaches24h,
                exposure: riskExposure.totalExposure,
                gateStatus: riskGate.allowed ? 'open' : 'restricted',
            },
            topBlockers: limitedBlockers,
            recentActions: recentActions.slice(0, 10),
        };
    }
    /**
     * 构建 Release Readiness 视图
     */
    async buildReleaseReadinessView(releaseId, release) {
        const now = Date.now();
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
        const activeCriticalAlerts = release.metadata?.activeCriticalAlerts || 0;
        if (activeCriticalAlerts > 0) {
            warnings.push(`${activeCriticalAlerts} critical alerts active`);
            checks.push({ name: 'Active Alerts', passed: true, message: 'Warnings present' });
        }
        else {
            checks.push({ name: 'Active Alerts', passed: true });
        }
        // 风险门控检查
        const riskGate = this.riskStateService.checkRiskGate('release', release.details?.riskLevel);
        const riskGatePassed = riskGate.allowed;
        if (!riskGatePassed) {
            blockers.push(riskGate.reason || 'Risk gate failed');
        }
        // 依赖健康检查
        const dependenciesHealthy = activeCriticalAlerts === 0 && riskGatePassed;
        const ready = blockers.length === 0;
        return {
            releaseId,
            ready,
            checks,
            blockers,
            warnings,
            riskGatePassed,
            dependenciesHealthy,
        };
    }
    /**
     * 构建 Incident 处理视图
     */
    async buildIncidentHandlingView(alerts) {
        const activeIncidents = await this.buildActiveIncidents(alerts);
        const suggestedActions = [];
        activeIncidents.items.forEach((item) => {
            const actions = [];
            // 未确认的事件
            if (!item.acknowledged) {
                actions.push({
                    type: 'acknowledge',
                    label: 'Acknowledge',
                    priority: 'high',
                });
            }
            // 严重事件
            if (item.severity === 'critical' || item.severity === 'high') {
                actions.push({
                    type: 'escalate',
                    label: 'Escalate',
                    priority: 'high',
                });
                actions.push({
                    type: 'request_recovery',
                    label: 'Request Recovery',
                    priority: 'medium',
                });
            }
            // 部署相关
            if (item.type === 'deployment_regression') {
                actions.push({
                    type: 'rollback_hint',
                    label: 'Get Rollback Hint',
                    priority: 'medium',
                });
            }
            suggestedActions.push({
                incidentId: item.id,
                actions,
            });
        });
        return {
            ...activeIncidents,
            suggestedActions,
        };
    }
    // ============================================================================
    // 内部方法
    // ============================================================================
    filterLast24h(items, now) {
        const cutoff = now - 24 * 60 * 60 * 1000;
        return items.filter((item) => {
            const timestamp = item.timestamp || item.createdAt || 0;
            return timestamp >= cutoff;
        });
    }
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
}
exports.TradingDashboardProjection = TradingDashboardProjection;
// ============================================================================
// 工厂函数
// ============================================================================
function createTradingDashboardProjection(config) {
    return new TradingDashboardProjection(config);
}
