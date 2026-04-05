/**
 * Approval Repository
 * Phase 2E-1 - 审批持久化存储
 *
 * 职责：
 * - 审批数据存储/加载
 * - 审批状态管理
 * - 审批历史查询
 */
export interface ApprovalRecord {
    approvalId: string;
    scope: string;
    reason: string;
    requestingAgent: string;
    status: 'pending' | 'approved' | 'rejected' | 'cancelled';
    metadata: {
        source: string;
        sourceType: string;
        sourceId: string;
        [key: string]: any;
    };
    createdAt: number;
    updatedAt: number;
    decidedAt?: number;
    decidedBy?: string;
    rejectionReason?: string;
}
export interface ApprovalQuery {
    status?: 'pending' | 'approved' | 'rejected' | 'cancelled';
    source?: string;
    requestingAgent?: string;
    limit?: number;
    offset?: number;
}
export declare class ApprovalRepository {
    private repository;
    constructor(dataDir: string);
    /**
     * 创建审批
     */
    create(approval: Omit<ApprovalRecord, 'createdAt' | 'updatedAt'>): Promise<ApprovalRecord>;
    /**
     * 获取审批
     */
    getById(approvalId: string): Promise<ApprovalRecord | null>;
    /**
     * 更新审批状态
     */
    updateStatus(approvalId: string, status: ApprovalRecord['status'], decidedBy?: string, rejectionReason?: string): Promise<ApprovalRecord | null>;
    /**
     * 批准审批
     */
    approve(approvalId: string, decidedBy?: string): Promise<ApprovalRecord | null>;
    /**
     * 拒绝审批
     */
    reject(approvalId: string, decidedBy?: string, reason?: string): Promise<ApprovalRecord | null>;
    /**
     * 取消审批
     */
    cancel(approvalId: string): Promise<ApprovalRecord | null>;
    /**
     * 查询审批
     */
    query(query: ApprovalQuery): Promise<{
        total: number;
        approvals: ApprovalRecord[];
    }>;
    /**
     * 获取待处理审批
     */
    getPending(limit?: number): Promise<ApprovalRecord[]>;
    /**
     * 获取超时审批
     */
    getTimeout(timeoutThresholdMs?: number): Promise<ApprovalRecord[]>;
    /**
     * 获取审批统计
     */
    getStats(): Promise<{
        total: number;
        pending: number;
        approved: number;
        rejected: number;
        cancelled: number;
    }>;
    /**
     * 删除审批
     */
    delete(approvalId: string): Promise<void>;
}
export declare function createApprovalRepository(dataDir: string): ApprovalRepository;
