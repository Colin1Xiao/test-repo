"use strict";
/**
 * Timeline Service
 * Phase 2E-3 - 操作员时间线服务
 *
 * 职责：
 * - 聚合审批/事件/Replay/Recovery 等动作
 * - 提供统一时间线查询
 * - 支持按对象/关联 ID/操作者过滤
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimelineService = void 0;
exports.createTimelineService = createTimelineService;
// ============================================================================
// Timeline Service
// ============================================================================
class TimelineService {
    constructor(auditLogService, approvalRepository, incidentRepository, eventRepository) {
        this.auditLogService = auditLogService;
        this.approvalRepository = approvalRepository;
        this.incidentRepository = incidentRepository;
        this.eventRepository = eventRepository;
    }
    /**
     * 获取时间线
     */
    async getTimeline(query) {
        // 从审计日志获取基础时间线
        const auditLogs = await this.auditLogService.query({
            startTime: query.startTime,
            endTime: query.endTime,
            limit: query.limit || 100,
            offset: query.offset || 0,
        });
        // 转换为时间线项
        const items = auditLogs.entries.map((log) => this.auditLogToTimelineItem(log));
        // 应用过滤
        let filtered = items;
        if (query.itemTypes && query.itemTypes.length > 0) {
            filtered = filtered.filter((item) => query.itemTypes.includes(item.type));
        }
        if (query.actorId) {
            filtered = filtered.filter((item) => item.actor.userId === query.actorId);
        }
        if (query.targetType) {
            filtered = filtered.filter((item) => item.target.type === query.targetType);
        }
        if (query.targetId) {
            filtered = filtered.filter((item) => item.target.id === query.targetId);
        }
        if (query.correlationId) {
            filtered = filtered.filter((item) => item.correlationId === query.correlationId);
        }
        if (query.success !== undefined) {
            filtered = filtered.filter((item) => item.result.success === query.success);
        }
        // 排序
        const sortOrder = query.sortOrder || 'desc';
        filtered.sort((a, b) => sortOrder === 'desc' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp);
        // 分页
        const limit = query.limit || 100;
        const offset = query.offset || 0;
        const paginated = filtered.slice(offset, offset + limit);
        return {
            items: paginated,
            total: filtered.length,
            hasMore: offset + limit < filtered.length,
        };
    }
    /**
     * 获取对象的时间线
     */
    async getObjectTimeline(objectType, objectId, limit = 100) {
        const result = await this.getTimeline({
            targetType: objectType,
            targetId: objectId,
            limit,
            sortOrder: 'desc',
        });
        return result.items;
    }
    /**
     * 获取关联对象的时间线
     */
    async getRelatedTimeline(correlationId, limit = 100) {
        const result = await this.getTimeline({
            correlationId,
            limit,
            sortOrder: 'asc', // 关联对象按时间正序显示
        });
        return result.items;
    }
    /**
     * 获取审批生命周期链
     */
    async getApprovalLifecycleChain(approvalId) {
        const items = await this.getObjectTimeline('approval', approvalId, 100);
        // 按时间正序排列，显示完整生命周期
        items.sort((a, b) => a.timestamp - b.timestamp);
        return items;
    }
    /**
     * 获取事件生命周期链
     */
    async getIncidentLifecycleChain(incidentId) {
        const items = await this.getObjectTimeline('incident', incidentId, 100);
        // 按时间正序排列，显示完整生命周期
        items.sort((a, b) => a.timestamp - b.timestamp);
        return items;
    }
    // ============================================================================
    // 内部方法
    // ============================================================================
    /**
     * 审计日志转时间线项
     */
    auditLogToTimelineItem(log) {
        return {
            id: log.id,
            type: log.action,
            timestamp: log.timestamp,
            actor: {
                userId: log.actor.userId,
                username: log.actor.username,
            },
            target: {
                type: log.target.type,
                id: log.target.id,
            },
            result: {
                success: log.result.success,
                error: log.result.error,
            },
            details: log.details,
            correlationId: log.metadata?.correlationId,
            relatedObjects: log.metadata?.relatedObjects,
        };
    }
}
exports.TimelineService = TimelineService;
// ============================================================================
// Factory Function
// ============================================================================
function createTimelineService(auditLogService, approvalRepository, incidentRepository, eventRepository) {
    return new TimelineService(auditLogService, approvalRepository, incidentRepository, eventRepository);
}
