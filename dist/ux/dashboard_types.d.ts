/**
 * Dashboard Types - Dashboard / Projection 核心类型定义
 *
 * @version v0.1.0
 * @date 2026-04-03
 *
 * Sprint 6C: Dashboard / Status Projection
 */
import type { ControlSurfaceSnapshot, ControlAction, Severity } from './control_types';
/**
 * 投影模式
 */
export type ProjectionMode = 'summary' | 'detail' | 'operator' | 'management' | 'incident' | 'approval_focus' | 'agent_focus';
/**
 * 投影目标
 */
export type ProjectionTarget = 'cli' | 'telegram' | 'web' | 'audit' | 'api';
/**
 * 仪表盘状态
 */
export type DashboardStatus = 'healthy' | 'degraded' | 'blocked' | 'critical';
/**
 * 刷新策略
 */
export interface RefreshPolicy {
    /** 自动刷新间隔（毫秒） */
    autoRefreshIntervalMs?: number;
    /** 最大陈旧时间（毫秒） */
    maxStaleMs?: number;
    /** 触发刷新的事件 */
    triggerEvents?: string[];
}
/**
 * 仪表盘摘要
 */
export interface DashboardSummary {
    /** 总体状态 */
    overallStatus: DashboardStatus;
    /** 总任务数 */
    totalTasks: number;
    /** 阻塞任务数 */
    blockedTasks: number;
    /** 待处理审批数 */
    pendingApprovals: number;
    /** 活跃事件数 */
    activeIncidents: number;
    /** 降级 Agent 数 */
    degradedAgents: number;
    /** 健康评分 */
    healthScore: number;
    /** 需要关注的项数 */
    attentionCount: number;
}
/**
 * 状态徽章
 */
export interface StatusBadge {
    /** 徽章类型 */
    type: 'status' | 'severity' | 'priority' | 'age' | 'custom';
    /** 徽章值 */
    value: string;
    /** 徽章颜色/样式 */
    style?: 'success' | 'warning' | 'error' | 'info';
}
/**
 * 仪表盘卡片
 */
export interface DashboardCard {
    /** 卡片 ID */
    id: string;
    /** 卡片类型 */
    kind: string;
    /** 卡片标题 */
    title: string;
    /** 副标题（可选） */
    subtitle?: string;
    /** 状态 */
    status: string;
    /** 严重级别（可选） */
    severity?: Severity;
    /** 所有者（可选） */
    owner?: string;
    /** 更新时间（可选） */
    updatedAt?: number;
    /** 是否陈旧 */
    stale?: boolean;
    /** 字段数据 */
    fields: Record<string, unknown>;
    /** 建议动作（可选） */
    suggestedActions?: ControlAction[];
}
/**
 * 仪表盘分段
 */
export interface DashboardSection {
    /** 分段 ID */
    id: string;
    /** 分段类型 */
    type: 'tasks' | 'approvals' | 'ops' | 'agents' | 'incidents' | 'actions';
    /** 分段标题 */
    title: string;
    /** 优先级（数字越小优先级越高） */
    priority: number;
    /** 是否折叠 */
    collapsed: boolean;
    /** 状态徽章 */
    badges: StatusBadge[];
    /** 卡片列表 */
    cards: DashboardCard[];
}
/**
 * 关注项
 */
export interface AttentionItem {
    /** 关注项 ID */
    id: string;
    /** 来源类型 */
    sourceType: 'task' | 'approval' | 'ops' | 'agent';
    /** 来源 ID */
    sourceId: string;
    /** 标题 */
    title: string;
    /** 原因 */
    reason: string;
    /** 严重级别 */
    severity: 'medium' | 'high' | 'critical';
    /** 年龄（毫秒） */
    ageMs?: number;
    /** 建议动作（可选） */
    recommendedAction?: ControlAction;
}
/**
 * 仪表盘快照
 */
export interface DashboardSnapshot {
    /** 仪表盘 ID */
    dashboardId: string;
    /** 源快照 ID */
    sourceSnapshotId: string;
    /** 创建时间 */
    createdAt: number;
    /** 更新时间 */
    updatedAt: number;
    /** 新鲜度（毫秒） */
    freshnessMs: number;
    /** 摘要 */
    summary: DashboardSummary;
    /** 分段列表 */
    sections: DashboardSection[];
    /** 关注项列表 */
    attentionItems: AttentionItem[];
    /** 建议动作列表 */
    recommendedActions: ControlAction[];
}
/**
 * 投影过滤器
 */
export interface ProjectionFilter {
    /** 状态过滤 */
    status?: string[];
    /** 严重级别过滤 */
    severity?: Severity[];
    /** 类型过滤 */
    type?: string[];
    /** 所有者过滤 */
    owner?: string;
    /** 关键词搜索 */
    keyword?: string;
    /** 只显示关注项 */
    attentionOnly?: boolean;
}
/**
 * 投影排序
 */
export interface ProjectionSort {
    /** 排序字段 */
    field: string;
    /** 排序方向 */
    direction: 'asc' | 'desc';
}
/**
 * 投影分组
 */
export interface ProjectionGroup {
    /** 分组字段 */
    field: string;
    /** 分组标题 */
    groupTitle?: string;
}
/**
 * 投影选项
 */
export interface ProjectionOptions {
    /** 投影模式 */
    mode?: ProjectionMode;
    /** 投影目标 */
    target?: ProjectionTarget;
    /** 过滤器 */
    filter?: ProjectionFilter;
    /** 排序 */
    sort?: ProjectionSort;
    /** 分组 */
    group?: ProjectionGroup;
    /** 焦点（关注特定 ID） */
    focus?: string;
    /** 最大项数 */
    maxItems?: number;
}
/**
 * 投影结果
 */
export interface ProjectionResult {
    /** 投影 ID */
    projectionId: string;
    /** 投影模式 */
    mode: ProjectionMode;
    /** 投影目标 */
    target: ProjectionTarget;
    /** 创建时间 */
    createdAt: number;
    /** 投影内容 */
    content: string;
    /** 投影分段 */
    sections: DashboardSection[];
    /** 投影摘要 */
    summary: DashboardSummary;
    /** 关注项 */
    attentionItems: AttentionItem[];
    /** 元数据 */
    metadata: {
        /** 源仪表盘 ID */
        sourceDashboardId: string;
        /** 应用过滤器 */
        appliedFilter?: ProjectionFilter;
        /** 应用排序 */
        appliedSort?: ProjectionSort;
        /** 项数 */
        itemCount: number;
    };
}
/**
 * 刷新结果
 */
export interface RefreshResult {
    /** 是否刷新 */
    refreshed: boolean;
    /** 刷新原因 */
    reason?: 'manual' | 'auto' | 'stale' | 'event_triggered';
    /** 新快照 */
    newSnapshot?: DashboardSnapshot;
    /** 旧快照 */
    oldSnapshot?: DashboardSnapshot;
    /** 变化项 */
    changes?: DashboardChanges;
}
/**
 * 仪表盘变化
 */
export interface DashboardChanges {
    /** 新增项 */
    added: string[];
    /** 移除项 */
    removed: string[];
    /** 更新项 */
    updated: string[];
    /** 状态变化 */
    statusChanged?: {
        from: DashboardStatus;
        to: DashboardStatus;
    };
    /** 健康评分变化 */
    healthScoreChanged?: {
        from: number;
        to: number;
    };
}
/**
 * 陈旧检测
 */
export interface StaleDetection {
    /** 是否陈旧 */
    isStale: boolean;
    /** 陈旧时间（毫秒） */
    staleMs: number;
    /** 最大允许陈旧时间（毫秒） */
    maxStaleMs: number;
    /** 建议操作 */
    suggestedAction: 'refresh' | 'ignore' | 'warn';
}
/**
 * 注意力规则
 */
export interface AttentionRule {
    /** 规则 ID */
    id: string;
    /** 规则名称 */
    name: string;
    /** 规则描述 */
    description: string;
    /** 严重级别 */
    severity: 'medium' | 'high' | 'critical';
    /** 匹配条件 */
    match: (snapshot: ControlSurfaceSnapshot) => boolean;
    /** 生成关注项 */
    generateItem: (snapshot: ControlSurfaceSnapshot) => AttentionItem[];
}
/**
 * 注意力分析结果
 */
export interface AttentionAnalysis {
    /** 关注项列表 */
    items: AttentionItem[];
    /** 应用的规则 */
    appliedRules: string[];
    /** 分析时间 */
    analyzedAt: number;
}
/**
 * 仪表盘构建器配置
 */
export interface DashboardBuilderConfig {
    /** 最大分段数 */
    maxSections?: number;
    /** 每段最大卡片数 */
    maxCardsPerSection?: number;
    /** 最大关注项数 */
    maxAttentionItems?: number;
    /** 最大建议动作数 */
    maxRecommendedActions?: number;
    /** 默认新鲜度阈值（毫秒） */
    defaultFreshnessThresholdMs?: number;
}
/**
 * 投影服务配置
 */
export interface ProjectionServiceConfig {
    /** 默认投影模式 */
    defaultMode?: ProjectionMode;
    /** 默认投影目标 */
    defaultTarget?: ProjectionTarget;
    /** 投影缓存 TTL（毫秒） */
    projectionCacheTtlMs?: number;
    /** 是否启用增量投影 */
    enableIncrementalProjection?: boolean;
}
