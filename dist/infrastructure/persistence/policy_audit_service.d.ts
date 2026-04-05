/**
 * Policy Audit Service
 * Phase 2E-3 - 策略审计查询服务
 *
 * 职责：
 * - 查询 allow/ask/deny 历史
 * - 查询决策原因
 * - 定位高风险动作的审计链
 */
import { createAuditLogService } from './audit_log_service';
export type PolicyDecision = 'allow' | 'ask' | 'deny' | 'unknown';
export interface PolicyAuditEntry {
    id: string;
    timestamp: number;
    actor: {
        userId: string;
        username: string;
    };
    action: string;
    target: {
        type: string;
        id: string;
    };
    decision: PolicyDecision;
    reason?: string;
    policy?: {
        id: string;
        name: string;
        rule: string;
    };
    metadata: Record<string, any>;
    riskLevel?: 'low' | 'medium' | 'high' | 'critical';
}
export interface PolicyAuditQuery {
    startTime?: number;
    endTime?: number;
    actorId?: string;
    action?: string;
    targetType?: string;
    targetId?: string;
    decision?: PolicyDecision;
    riskLevel?: 'low' | 'medium' | 'high' | 'critical';
    limit?: number;
    offset?: number;
}
export interface PolicyAuditResult {
    entries: PolicyAuditEntry[];
    total: number;
    hasMore: boolean;
    summary: {
        allowCount: number;
        askCount: number;
        denyCount: number;
        highRiskCount: number;
    };
}
export declare class PolicyAuditService {
    private auditLogService;
    constructor(auditLogService: ReturnType<typeof createAuditLogService>);
    /**
     * 查询策略审计记录
     */
    query(query: PolicyAuditQuery): Promise<PolicyAuditResult>;
    /**
     * 查询高风险动作
     */
    getHighRiskActions(timeRangeHours?: number, limit?: number): Promise<PolicyAuditEntry[]>;
    /**
     * 查询某个动作的决策历史
     */
    getActionDecisionHistory(action: string, limit?: number): Promise<PolicyAuditEntry[]>;
    /**
     * 查询用户的决策历史
     */
    getUserDecisionHistory(userId: string, timeRangeHours?: number, limit?: number): Promise<PolicyAuditEntry[]>;
    /**
     * 定位高风险动作的审计链
     */
    getHighRiskAuditChain(targetId: string, targetType: string): Promise<PolicyAuditEntry[]>;
    /**
     * 获取决策统计
     */
    getDecisionStats(timeRangeHours?: number): Promise<{
        total: number;
        allowRate: number;
        askRate: number;
        denyRate: number;
        highRiskRate: number;
        topActions: Array<{
            action: string;
            count: number;
        }>;
        topActors: Array<{
            actorId: string;
            count: number;
        }>;
    }>;
    /**
     * 判断审计日志是否与策略相关
     */
    private isPolicyRelated;
    /**
     * 审计日志转策略审计记录
     */
    private auditLogToPolicyAuditEntry;
}
export declare function createPolicyAuditService(auditLogService: ReturnType<typeof createAuditLogService>): PolicyAuditService;
