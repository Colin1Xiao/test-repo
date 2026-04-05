/**
 * Inbox Types
 * Phase 2A-2B - Inbox 聚合层核心类型
 */
/**
 * Inbox 项类型
 */
export type InboxItemType = "approval" | "incident" | "task" | "intervention" | "attention";
/**
 * Inbox 严重级别
 */
export type InboxSeverity = "low" | "medium" | "high" | "critical";
/**
 * Inbox 项状态
 */
export type InboxItemStatus = "pending" | "active" | "blocked" | "failed" | "acknowledged" | "resolved" | "closed";
/**
 * Inbox 项
 */
export interface InboxItem {
    /** 唯一 ID */
    id: string;
    /** 项类型 */
    itemType: InboxItemType;
    /** 源对象 ID */
    sourceId: string;
    /** Workspace ID */
    workspaceId?: string;
    /** 标题 */
    title: string;
    /** 摘要 */
    summary: string;
    /** 严重级别 */
    severity: InboxSeverity;
    /** 状态 */
    status?: InboxItemStatus;
    /** 所有者 */
    owner?: string;
    /** 创建时间 */
    createdAt: number;
    /** 更新时间 */
    updatedAt: number;
    /** 年龄（毫秒） */
    ageMs?: number;
    /** 建议动作 */
    suggestedActions?: string[];
    /** 元数据 */
    metadata?: Record<string, unknown>;
}
/**
 * Inbox 摘要
 */
export interface InboxSummary {
    /** 待处理审批数 */
    pendingApprovals: number;
    /** 开放事件数 */
    openIncidents: number;
    /** 阻塞任务数 */
    blockedTasks: number;
    /** 待处理介入数 */
    pendingInterventions: number;
    /** 紧急项数 (critical) */
    criticalCount: number;
    /** 高优先级项数 (high + critical) */
    highPriorityCount: number;
    /** 总项数 */
    totalCount: number;
}
/**
 * Inbox 快照
 */
export interface InboxSnapshot {
    /** 快照 ID */
    snapshotId: string;
    /** Workspace ID */
    workspaceId?: string;
    /** 生成时间 */
    generatedAt: number;
    /** 项列表 */
    items: InboxItem[];
    /** 摘要 */
    summary: InboxSummary;
    /** 排序方式 */
    sort?: 'severity' | 'age' | 'type' | 'custom';
    /** 过滤器 */
    filter?: {
        types?: InboxItemType[];
        severities?: InboxSeverity[];
        workspaceId?: string;
    };
}
/**
 * Inbox 配置
 */
export interface InboxConfig {
    /** 默认排序方式 */
    defaultSort?: 'severity' | 'age' | 'type' | 'custom';
    /** 默认返回数量限制 */
    defaultLimit?: number;
    /** 严重级别权重 */
    severityWeights?: {
        critical: number;
        high: number;
        medium: number;
        low: number;
    };
    /** 年龄阈值（毫秒） */
    ageThresholds?: {
        agedApprovalMs: number;
        agedIncidentMs: number;
        agedTaskMs: number;
    };
}
/**
 * Inbox Service
 */
export interface InboxService {
    /**
     * 获取 Inbox 快照
     */
    getInboxSnapshot(workspaceId?: string): Promise<InboxSnapshot>;
    /**
     * 获取 Inbox 项
     */
    getInboxItem(itemId: string): Promise<InboxItem | null>;
    /**
     * 获取摘要
     */
    getInboxSummary(workspaceId?: string): Promise<InboxSummary>;
    /**
     * 获取待处理项（按严重级别排序）
     */
    getPendingItems(workspaceId?: string, limit?: number): Promise<InboxItem[]>;
    /**
     * 获取紧急项（critical + high）
     */
    getUrgentItems(workspaceId?: string, limit?: number): Promise<InboxItem[]>;
}
