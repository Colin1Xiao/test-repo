"use strict";
/**
 * Recovery Engine
 * Phase 2E-2B - 状态恢复引擎
 *
 * 职责：
 * - 启动时扫描持久层
 * - 恢复 pending approvals
 * - 恢复 active incidents
 * - 识别 orphan/stale 对象
 * - 写入 recovery audit log
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecoveryEngine = void 0;
exports.createRecoveryEngine = createRecoveryEngine;
// ============================================================================
// Recovery Engine
// ============================================================================
class RecoveryEngine {
    constructor(approvalRepository, incidentRepository, eventRepository, auditLogService, config) {
        this.approvalRepository = approvalRepository;
        this.incidentRepository = incidentRepository;
        this.eventRepository = eventRepository;
        this.auditLogService = auditLogService;
        this.config = {
            approvalTimeoutMs: config?.approvalTimeoutMs ?? 24 * 60 * 60 * 1000, // 24 小时
            incidentTimeoutMs: config?.incidentTimeoutMs ?? 7 * 24 * 60 * 60 * 1000, // 7 天
            maxRecoverApprovals: config?.maxRecoverApprovals ?? 100,
            maxRecoverIncidents: config?.maxRecoverIncidents ?? 100,
        };
    }
    /**
     * 执行恢复扫描
     */
    async scan() {
        const result = {
            success: true,
            scanCompleted: false,
            recovered: {
                approvals: { pending: 0, total: 0 },
                incidents: { active: 0, acknowledged: 0, resolved: 0, total: 0 },
                events: { total: 0, last24h: 0 },
            },
            orphanedObjects: [],
            staleObjects: [],
            errors: [],
            summary: '',
        };
        try {
            // 1. 扫描审批
            await this.scanApprovals(result);
            // 2. 扫描事件
            await this.scanIncidents(result);
            // 3. 扫描事件存储
            await this.scanEvents(result);
            // 4. 识别孤儿对象
            await this.identifyOrphanedObjects(result);
            // 5. 识别过期对象
            await this.identifyStaleObjects(result);
            result.scanCompleted = true;
            result.summary = this.generateSummary(result);
            // 记录审计日志
            await this.auditLogService.log('recovery_scan_completed', { userId: 'system', username: 'recovery_engine' }, { type: 'recovery_scan', id: `scan_${Date.now()}` }, {
                approvals: result.recovered.approvals,
                incidents: result.recovered.incidents,
                orphanedCount: result.orphanedObjects.length,
                staleCount: result.staleObjects.length,
            }, { success: result.success });
        }
        catch (error) {
            result.success = false;
            result.errors.push({
                type: 'scan_failed',
                error: error instanceof Error ? error.message : String(error),
            });
            result.summary = `Recovery scan failed: ${error instanceof Error ? error.message : String(error)}`;
        }
        return result;
    }
    /**
     * 恢复待处理审批
     */
    async recoverPendingApprovals() {
        const pendingApprovals = await this.approvalRepository.getPending(this.config.maxRecoverApprovals);
        const now = Date.now();
        let recovered = 0;
        for (const approval of pendingApprovals) {
            // 检查是否超时
            const age = now - approval.createdAt;
            if (age > this.config.approvalTimeoutMs) {
                // 标记为超时
                await this.approvalRepository.updateStatus(approval.approvalId, 'cancelled', 'system', 'Approval timeout');
                await this.auditLogService.log('approval_timeout', { userId: 'system', username: 'recovery_engine' }, { type: 'approval', id: approval.approvalId }, { age, timeoutMs: this.config.approvalTimeoutMs }, { success: true });
            }
            else {
                recovered++;
            }
        }
        return {
            recovered,
            total: pendingApprovals.length,
        };
    }
    /**
     * 恢复活跃事件
     */
    async recoverActiveIncidents() {
        const allIncidents = await this.incidentRepository.query({ limit: this.config.maxRecoverIncidents });
        const recovered = {
            active: 0,
            acknowledged: 0,
            resolved: 0,
        };
        const now = Date.now();
        for (const incident of allIncidents.incidents) {
            // 检查是否超时
            const age = now - incident.createdAt;
            if (incident.status === 'active' || incident.status === 'acknowledged') {
                if (age > this.config.incidentTimeoutMs) {
                    // 标记为超时关闭
                    await this.incidentRepository.updateStatus(incident.incidentId, 'closed', 'system', 'Incident timeout');
                    await this.auditLogService.log('incident_timeout', { userId: 'system', username: 'recovery_engine' }, { type: 'incident', id: incident.incidentId }, { age, timeoutMs: this.config.incidentTimeoutMs }, { success: true });
                }
                else {
                    if (incident.status === 'active')
                        recovered.active++;
                    if (incident.status === 'acknowledged')
                        recovered.acknowledged++;
                }
            }
            if (incident.status === 'resolved') {
                recovered.resolved++;
            }
        }
        return {
            recovered,
            total: allIncidents.total,
        };
    }
    // ============================================================================
    // 内部方法
    // ============================================================================
    /**
     * 扫描审批
     */
    async scanApprovals(result) {
        const stats = await this.approvalRepository.getStats();
        result.recovered.approvals.total = stats.total;
        result.recovered.approvals.pending = stats.pending;
    }
    /**
     * 扫描事件
     */
    async scanIncidents(result) {
        const stats = await this.incidentRepository.getStats();
        result.recovered.incidents.total = stats.total;
        result.recovered.incidents.active = stats.active;
        result.recovered.incidents.acknowledged = stats.acknowledged;
        result.recovered.incidents.resolved = stats.resolved;
    }
    /**
     * 扫描事件存储
     */
    async scanEvents(result) {
        const stats = await this.eventRepository.getStats(24 * 60 * 60 * 1000);
        result.recovered.events.total = stats.total;
        result.recovered.events.last24h = stats.last24h || 0;
    }
    /**
     * 识别孤儿对象
     */
    async identifyOrphanedObjects(result) {
        // 检查没有关联事件的审批
        const approvals = await this.approvalRepository.query({ limit: 1000 });
        for (const approval of approvals.approvals) {
            // 检查是否有 sourceId 关联的事件
            const sourceId = approval.metadata?.sourceId;
            if (!sourceId) {
                result.orphanedObjects.push({
                    type: 'approval',
                    id: approval.approvalId,
                    reason: 'Missing sourceId reference',
                });
            }
        }
        // 检查没有关联事件的 incident
        const incidents = await this.incidentRepository.query({ limit: 1000 });
        for (const incident of incidents.incidents) {
            const sourceId = incident.metadata?.sourceId;
            if (!sourceId) {
                result.orphanedObjects.push({
                    type: 'incident',
                    id: incident.incidentId,
                    reason: 'Missing sourceId reference',
                });
            }
        }
    }
    /**
     * 识别过期对象
     */
    async identifyStaleObjects(result) {
        const now = Date.now();
        // 检查过期的审批
        const pendingApprovals = await this.approvalRepository.getPending(1000);
        for (const approval of pendingApprovals) {
            const age = now - approval.createdAt;
            if (age > this.config.approvalTimeoutMs / 2) { // 超过一半阈值就标记
                result.staleObjects.push({
                    type: 'approval',
                    id: approval.approvalId,
                    age,
                    status: approval.status,
                });
            }
        }
        // 检查过期的事件
        const activeIncidents = await this.incidentRepository.getActive(1000);
        for (const incident of activeIncidents) {
            const age = now - incident.createdAt;
            if (age > this.config.incidentTimeoutMs / 2) {
                result.staleObjects.push({
                    type: 'incident',
                    id: incident.incidentId,
                    age,
                    status: incident.status,
                });
            }
        }
    }
    /**
     * 生成摘要
     */
    generateSummary(result) {
        const parts = [
            `Scan ${result.scanCompleted ? 'completed' : 'failed'}`,
            `Approvals: ${result.recovered.approvals.pending}/${result.recovered.approvals.total} pending`,
            `Incidents: ${result.recovered.incidents.active}/${result.recovered.incidents.total} active`,
            `Events: ${result.recovered.events.last24h}/${result.recovered.events.total} (24h/total)`,
        ];
        if (result.orphanedObjects.length > 0) {
            parts.push(`${result.orphanedObjects.length} orphaned objects`);
        }
        if (result.staleObjects.length > 0) {
            parts.push(`${result.staleObjects.length} stale objects`);
        }
        if (result.errors.length > 0) {
            parts.push(`${result.errors.length} errors`);
        }
        return parts.join(', ');
    }
}
exports.RecoveryEngine = RecoveryEngine;
// ============================================================================
// Factory Function
// ============================================================================
function createRecoveryEngine(approvalRepository, incidentRepository, eventRepository, auditLogService, config) {
    return new RecoveryEngine(approvalRepository, incidentRepository, eventRepository, auditLogService, config);
}
