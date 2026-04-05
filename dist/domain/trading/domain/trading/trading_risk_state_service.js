"use strict";
/**
 * Trading Risk State Service
 * Phase 2D-1B - 交易风险状态服务
 *
 * 职责：
 * - 维护风险状态
 * - 计算风险暴露
 * - 提供风险门控
 * - 生成风险报告
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradingRiskStateService = void 0;
exports.createTradingRiskStateService = createTradingRiskStateService;
// ============================================================================
// Risk State Service
// ============================================================================
class TradingRiskStateService {
    constructor() {
        this.currentLevel = 'low';
        this.levelChanges = [];
        this.breaches = [];
        this.exposures = new Map();
    }
    /**
     * 获取当前风险状态
     */
    getCurrentState() {
        const now = Date.now();
        const breaches24h = this.breaches.filter((b) => now - b.timestamp < 24 * 60 * 60 * 1000);
        return {
            level: this.currentLevel,
            lastChanged: this.levelChanges.length > 0
                ? this.levelChanges[this.levelChanges.length - 1].timestamp
                : now,
            recentChanges: this.levelChanges.slice(-10).map((c) => ({
                timestamp: c.timestamp,
                from: c.from,
                to: c.to,
                reason: c.reason,
                changedBy: c.changedBy,
            })),
            breaches24h: breaches24h.map((b) => ({
                timestamp: b.timestamp,
                metric: b.metric,
                threshold: b.threshold,
                value: b.value,
            })),
        };
    }
    /**
     * 更新风险级别
     */
    updateRiskLevel(newLevel, reason, changedBy) {
        const oldLevel = this.currentLevel;
        if (oldLevel === newLevel) {
            return false;
        }
        this.currentLevel = newLevel;
        this.levelChanges.push({
            timestamp: Date.now(),
            from: oldLevel,
            to: newLevel,
            reason,
            changedBy,
        });
        // 限制历史记录大小
        if (this.levelChanges.length > 100) {
            this.levelChanges = this.levelChanges.slice(-100);
        }
        return true;
    }
    /**
     * 记录风险突破
     */
    recordBreach(metric, threshold, value, severity) {
        const breachId = `breach_${Date.now()}`;
        this.breaches.push({
            id: breachId,
            timestamp: Date.now(),
            metric,
            threshold,
            value,
            severity,
            acknowledged: false,
        });
        // 限制历史记录大小
        if (this.breaches.length > 1000) {
            this.breaches = this.breaches.slice(-1000);
        }
        // 自动升级风险级别
        if (severity === 'critical') {
            this.updateRiskLevel('critical', `Critical breach: ${metric}`, 'system');
        }
        else if (severity === 'high' && this.currentLevel !== 'critical') {
            this.updateRiskLevel('high', `High severity breach: ${metric}`, 'system');
        }
        return breachId;
    }
    /**
     * 确认风险突破
     */
    acknowledgeBreach(breachId, acknowledgedBy) {
        const breach = this.breaches.find((b) => b.id === breachId);
        if (!breach) {
            return false;
        }
        breach.acknowledged = true;
        return true;
    }
    /**
     * 计算风险暴露
     */
    calculateExposure() {
        const totalExposure = Array.from(this.exposures.values()).reduce((sum, val) => sum + val, 0);
        const topRisks = this.breaches
            .filter((b) => !b.acknowledged)
            .slice(-5)
            .map((b) => ({
            type: b.metric,
            severity: b.severity,
            description: `${b.metric} exceeded threshold (${b.value} > ${b.threshold})`,
            mitigation: `Review ${b.metric} configuration`,
        }));
        return {
            totalExposure,
            byStrategy: new Map(),
            byEnvironment: new Map(),
            topRisks,
        };
    }
    /**
     * 设置风险暴露
     */
    setExposure(key, value) {
        this.exposures.set(key, value);
    }
    /**
     * 风险门控检查
     */
    checkRiskGate(action, requiredLevel) {
        const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
        const currentSeverity = severityOrder[this.currentLevel];
        const requiredSeverity = requiredLevel
            ? severityOrder[requiredLevel]
            : 0;
        if (currentSeverity > requiredSeverity) {
            return {
                allowed: false,
                reason: `Risk level ${this.currentLevel} exceeds threshold for ${action}`,
            };
        }
        // 检查未确认的严重突破
        const unacknowledgedCritical = this.breaches.some((b) => !b.acknowledged && b.severity === 'critical');
        if (unacknowledgedCritical) {
            return {
                allowed: false,
                reason: 'Unacknowledged critical breach present',
            };
        }
        return { allowed: true };
    }
    /**
     * 生成风险报告
     */
    generateReport() {
        const now = Date.now();
        const changes24h = this.levelChanges.filter((c) => now - c.timestamp < 24 * 60 * 60 * 1000).length;
        const breaches24h = this.breaches.filter((b) => now - b.timestamp < 24 * 60 * 60 * 1000).length;
        const unacknowledgedBreaches = this.breaches.filter((b) => !b.acknowledged).length;
        const recommendations = [];
        if (this.currentLevel === 'critical') {
            recommendations.push('Immediate attention required: Critical risk level');
        }
        if (unacknowledgedBreaches > 0) {
            recommendations.push(`${unacknowledgedBreaches} unacknowledged breaches require review`);
        }
        if (changes24h > 5) {
            recommendations.push('Frequent risk level changes detected - investigate root cause');
        }
        return {
            summary: `Risk Level: ${this.currentLevel} | Changes: ${changes24h} | Breaches: ${breaches24h}`,
            currentLevel: this.currentLevel,
            changes24h,
            breaches24h,
            unacknowledgedBreaches,
            recommendations,
        };
    }
}
exports.TradingRiskStateService = TradingRiskStateService;
// ============================================================================
// 工厂函数
// ============================================================================
function createTradingRiskStateService() {
    return new TradingRiskStateService();
}
