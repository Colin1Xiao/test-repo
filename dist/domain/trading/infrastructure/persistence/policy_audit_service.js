"use strict";
/**
 * Policy Audit Service
 * Phase 2E-3 - 策略审计查询服务
 *
 * 职责：
 * - 查询 allow/ask/deny 历史
 * - 查询决策原因
 * - 定位高风险动作的审计链
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolicyAuditService = void 0;
exports.createPolicyAuditService = createPolicyAuditService;
// ============================================================================
// Policy Audit Service
// ============================================================================
class PolicyAuditService {
    constructor(auditLogService) {
        this.auditLogService = auditLogService;
    }
    /**
     * 查询策略审计记录
     */
    async query(query) {
        // 从审计日志获取记录
        const auditLogs = await this.auditLogService.query({
            startTime: query.startTime,
            endTime: query.endTime,
            limit: query.limit || 100,
            offset: query.offset || 0,
        });
        // 转换为策略审计记录
        const entries = auditLogs.entries
            .filter((log) => this.isPolicyRelated(log))
            .map((log) => this.auditLogToPolicyAuditEntry(log));
        // 应用过滤
        let filtered = entries;
        if (query.actorId) {
            filtered = filtered.filter((e) => e.actor.userId === query.actorId);
        }
        if (query.action) {
            filtered = filtered.filter((e) => e.action === query.action);
        }
        if (query.targetType) {
            filtered = filtered.filter((e) => e.target.type === query.targetType);
        }
        if (query.targetId) {
            filtered = filtered.filter((e) => e.target.id === query.targetId);
        }
        if (query.decision) {
            filtered = filtered.filter((e) => e.decision === query.decision);
        }
        if (query.riskLevel) {
            filtered = filtered.filter((e) => e.riskLevel === query.riskLevel);
        }
        // 分页
        const limit = query.limit || 100;
        const offset = query.offset || 0;
        const paginated = filtered.slice(offset, offset + limit);
        // 计算摘要
        const summary = {
            allowCount: filtered.filter((e) => e.decision === 'allow').length,
            askCount: filtered.filter((e) => e.decision === 'ask').length,
            denyCount: filtered.filter((e) => e.decision === 'deny').length,
            highRiskCount: filtered.filter((e) => e.riskLevel === 'high' || e.riskLevel === 'critical').length,
        };
        return {
            entries: paginated,
            total: filtered.length,
            hasMore: offset + limit < filtered.length,
            summary,
        };
    }
    /**
     * 查询高风险动作
     */
    async getHighRiskActions(timeRangeHours = 24, limit = 50) {
        const endTime = Date.now();
        const startTime = endTime - timeRangeHours * 60 * 60 * 1000;
        const result = await this.query({
            startTime,
            endTime,
            riskLevel: 'high',
            limit,
        });
        return result.entries;
    }
    /**
     * 查询某个动作的决策历史
     */
    async getActionDecisionHistory(action, limit = 100) {
        const result = await this.query({
            action,
            limit,
        });
        return result.entries;
    }
    /**
     * 查询用户的决策历史
     */
    async getUserDecisionHistory(userId, timeRangeHours = 24, limit = 100) {
        const endTime = Date.now();
        const startTime = endTime - timeRangeHours * 60 * 60 * 1000;
        const result = await this.query({
            startTime,
            endTime,
            actorId: userId,
            limit,
        });
        return result.entries;
    }
    /**
     * 定位高风险动作的审计链
     */
    async getHighRiskAuditChain(targetId, targetType) {
        const result = await this.query({
            targetId,
            targetType,
            limit: 100,
        });
        // 按时间正序排列，显示完整审计链
        return result.entries.sort((a, b) => a.timestamp - b.timestamp);
    }
    /**
     * 获取决策统计
     */
    async getDecisionStats(timeRangeHours = 24) {
        const endTime = Date.now();
        const startTime = endTime - timeRangeHours * 60 * 60 * 1000;
        const result = await this.query({
            startTime,
            endTime,
            limit: 10000, // 获取足够多的数据进行统计
        });
        const total = result.entries.length;
        const allowRate = total > 0 ? result.summary.allowCount / total : 0;
        const askRate = total > 0 ? result.summary.askCount / total : 0;
        const denyRate = total > 0 ? result.summary.denyCount / total : 0;
        const highRiskRate = total > 0 ? result.summary.highRiskCount / total : 0;
        // 统计 Top Actions
        const actionCounts = new Map();
        for (const entry of result.entries) {
            actionCounts.set(entry.action, (actionCounts.get(entry.action) || 0) + 1);
        }
        const topActions = Array.from(actionCounts.entries())
            .map(([action, count]) => ({ action, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        // 统计 Top Actors
        const actorCounts = new Map();
        for (const entry of result.entries) {
            actorCounts.set(entry.actor.userId, (actorCounts.get(entry.actor.userId) || 0) + 1);
        }
        const topActors = Array.from(actorCounts.entries())
            .map(([actorId, count]) => ({ actorId, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        return {
            total,
            allowRate,
            askRate,
            denyRate,
            highRiskRate,
            topActions,
            topActors,
        };
    }
    // ============================================================================
    // 内部方法
    // ============================================================================
    /**
     * 判断审计日志是否与策略相关
     */
    isPolicyRelated(log) {
        // 所有审计日志都与策略相关，因为每个动作都经过策略检查
        return true;
    }
    /**
     * 审计日志转策略审计记录
     */
    auditLogToPolicyAuditEntry(log) {
        // 根据动作类型推断决策
        let decision = 'unknown';
        if (log.action.includes('_created') || log.action.includes('_approved') || log.action.includes('_completed')) {
            decision = 'allow';
        }
        else if (log.action.includes('_rejected') || log.action.includes('_failed')) {
            decision = 'deny';
        }
        else if (log.action.includes('_pending') || log.action.includes('_waiting')) {
            decision = 'ask';
        }
        // 推断风险级别
        let riskLevel;
        if (log.details?.riskLevel) {
            riskLevel = log.details.riskLevel;
        }
        else if (log.action.includes('recovery') || log.action.includes('replay')) {
            riskLevel = 'medium';
        }
        else if (log.action.includes('approval') && log.action.includes('_rejected')) {
            riskLevel = 'high';
        }
        return {
            id: log.id,
            timestamp: log.timestamp,
            actor: {
                userId: log.actor.userId,
                username: log.actor.username,
            },
            action: log.action,
            target: {
                type: log.target.type,
                id: log.target.id,
            },
            decision,
            reason: log.details?.reason || log.result?.error,
            policy: log.details?.policy,
            metadata: log.details,
            riskLevel,
        };
    }
}
exports.PolicyAuditService = PolicyAuditService;
// ============================================================================
// Factory Function
// ============================================================================
function createPolicyAuditService(auditLogService) {
    return new PolicyAuditService(auditLogService);
}
