/**
 * Control Types - 控制面核心类型定义
 *
 * @version v0.1.0
 * @date 2026-04-03
 *
 * Sprint 6B: Control Surface / Command Views
 */
/**
 * 任务状态
 */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'blocked' | 'cancelled' | 'paused';
/**
 * 审批状态
 */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'escalated' | 'timeout' | 'cancelled';
/**
 * Agent 状态
 */
export type AgentStatus = 'idle' | 'busy' | 'blocked' | 'unhealthy' | 'offline';
/**
 * Server 状态
 */
export type ServerStatus = 'healthy' | 'degraded' | 'unavailable';
/**
 * 优先级
 */
export type Priority = 'low' | 'medium' | 'high' | 'critical';
/**
 * 严重级别
 */
export type Severity = 'low' | 'medium' | 'high' | 'critical';
/**
 * 视图过滤器
 */
export interface ViewFilter {
    /** 状态过滤 */
    status?: string[];
    /** 优先级过滤 */
    priority?: Priority[];
    /** 时间范围（毫秒时间戳） */
    timeRange?: {
        startTime: number;
        endTime: number;
    };
    /** Agent ID 过滤 */
    agentId?: string;
    /** Server ID 过滤 */
    serverId?: string;
    /** 关键词搜索 */
    keyword?: string;
}
/**
 * 视图排序
 */
export interface ViewSort {
    /** 排序字段 */
    field: string;
    /** 排序方向 */
    direction: 'asc' | 'desc';
}
/**
 * 任务视图模型
 */
export interface TaskViewModel {
    /** 任务 ID */
    taskId: string;
    /** 任务标题/描述 */
    title: string;
    /** 任务状态 */
    status: TaskStatus;
    /** 优先级 */
    priority: Priority;
    /** 风险级别 */
    risk: Severity;
    /** 所有者 Agent */
    ownerAgent: string;
    /** 创建时间 */
    createdAt: number;
    /** 更新时间 */
    updatedAt: number;
    /** 阻塞原因（如果 blocked） */
    blockedReason?: string;
    /** 下一步行动 */
    nextAction?: string;
    /** 进度（0-100） */
    progress?: number;
    /** 重试次数 */
    retryCount?: number;
    /** 耗时（毫秒） */
    durationMs?: number;
}
/**
 * 任务视图
 */
export interface TaskView {
    /** 活跃任务 */
    activeTasks: TaskViewModel[];
    /** 阻塞任务 */
    blockedTasks: TaskViewModel[];
    /** 最近完成的任务 */
    recentCompletedTasks: TaskViewModel[];
    /** 失败的任务 */
    failedTasks: TaskViewModel[];
    /** 总任务数 */
    totalTasks: number;
    /** 时间线摘要 */
    timelineSummary?: {
        last24h: number;
        last7d: number;
        successRate: number;
    };
}
/**
 * 审批视图模型
 */
export interface ApprovalViewModel {
    /** 审批 ID */
    approvalId: string;
    /** 关联任务 ID */
    taskId?: string;
    /** 审批范围/类型 */
    scope: string;
    /** 请求时间 */
    requestedAt: number;
    /** 已等待时长（毫秒） */
    ageMs: number;
    /** 审批状态 */
    status: ApprovalStatus;
    /** 请求原因 */
    reason: string;
    /** 请求 Agent */
    requestingAgent: string;
    /** 审批者（如果已决定） */
    approver?: string;
    /** 决定时间（如果已决定） */
    decidedAt?: number;
}
/**
 * 审批视图
 */
export interface ApprovalView {
    /** 待处理审批 */
    pendingApprovals: ApprovalViewModel[];
    /** 审批瓶颈 */
    bottlenecks: Array<{
        type: string;
        pendingCount: number;
        avgWaitTimeMs: number;
    }>;
    /** 超时审批 */
    timeoutApprovals: ApprovalViewModel[];
    /** 最近决定的审批 */
    recentDecidedApprovals: ApprovalViewModel[];
    /** 总审批数 */
    totalApprovals: number;
    /** 审批流摘要 */
    flowSummary?: {
        approvalRate: number;
        rejectionRate: number;
        avgDecisionTimeMs: number;
    };
}
/**
 * 运维视图模型
 */
export interface OpsViewModel {
    /** 总体状态 */
    overallStatus: 'healthy' | 'degraded' | 'critical';
    /** 健康评分（0-100） */
    healthScore: number;
    /** 降级 Server */
    degradedServers: Array<{
        serverId: string;
        status: ServerStatus;
        errorRate: number;
        lastCheck: number;
    }>;
    /** 被阻塞 Skill */
    blockedSkills: Array<{
        skillName: string;
        status: 'blocked' | 'pending';
        count: number;
        reason?: string;
    }>;
    /** 待处理审批数 */
    pendingApprovals: number;
    /** 活跃事件 */
    activeIncidents: Array<{
        id: string;
        type: string;
        severity: Severity;
        description: string;
        createdAt: number;
        acknowledged?: boolean;
    }>;
    /** 顶级失败 */
    topFailures: Array<{
        category: string;
        count: number;
        impact: string;
    }>;
    /** 重放热点 */
    replayHotspots: Array<{
        taskId: string;
        replayCount: number;
        reason: string;
    }>;
}
/**
 * Agent 视图模型
 */
export interface AgentViewModel {
    /** Agent ID */
    agentId: string;
    /** Agent 角色 */
    role: string;
    /** Agent 状态 */
    status: AgentStatus;
    /** 活跃任务数 */
    activeTaskCount: number;
    /** 阻塞任务数 */
    blockedTaskCount: number;
    /** 失败率（0-1） */
    failureRate: number;
    /** 最后活动时间 */
    lastSeenAt: number;
    /** 当前任务 ID */
    currentTaskId?: string;
    /** 健康评分（0-100） */
    healthScore?: number;
}
/**
 * Agent 视图
 */
export interface AgentView {
    /** 忙碌 Agent */
    busyAgents: AgentViewModel[];
    /** 阻塞 Agent */
    blockedAgents: AgentViewModel[];
    /** 不健康 Agent */
    unhealthyAgents: AgentViewModel[];
    /** 离线 Agent */
    offlineAgents: AgentViewModel[];
    /** 总 Agent 数 */
    totalAgents: number;
    /** Agent 负载摘要 */
    loadSummary?: {
        avgActiveTasks: number;
        avgFailureRate: number;
        avgHealthScore: number;
    };
}
/**
 * 控制动作类型
 */
export type ControlActionType = 'cancel_task' | 'retry_task' | 'pause_task' | 'resume_task' | 'approve' | 'reject' | 'escalate_approval' | 'ack_incident' | 'request_replay' | 'request_recovery' | 'pause_agent' | 'resume_agent' | 'inspect_agent';
/**
 * 控制动作目标类型
 */
export type ControlActionTargetType = 'task' | 'approval' | 'incident' | 'agent' | 'server' | 'skill';
/**
 * 控制动作
 */
export interface ControlAction {
    /** 动作类型 */
    type: ControlActionType;
    /** 目标类型 */
    targetType: ControlActionTargetType;
    /** 目标 ID */
    targetId: string;
    /** 动作参数 */
    params?: Record<string, any>;
    /** 请求者 */
    requestedBy: string;
    /** 请求时间 */
    requestedAt: number;
}
/**
 * 控制动作结果
 */
export interface ControlActionResult {
    /** 是否成功 */
    success: boolean;
    /** 动作类型 */
    actionType: ControlActionType;
    /** 目标 ID */
    targetId: string;
    /** 结果消息 */
    message?: string;
    /** 错误信息（如果失败） */
    error?: string;
    /** 后续动作建议 */
    nextActions?: ControlActionType[];
}
/**
 * 控制面快照
 */
export interface ControlSurfaceSnapshot {
    /** 快照 ID */
    snapshotId: string;
    /** 创建时间 */
    createdAt: number;
    /** 任务视图 */
    taskView: TaskView;
    /** 审批视图 */
    approvalView: ApprovalView;
    /** 运维视图 */
    opsView: OpsViewModel;
    /** Agent 视图 */
    agentView: AgentView;
    /** 可用动作 */
    availableActions: ControlAction[];
    /** 摘要 */
    summary: {
        /** 总任务数 */
        totalTasks: number;
        /** 待处理审批数 */
        pendingApprovals: number;
        /** 健康评分 */
        healthScore: number;
        /** 活跃 Agent 数 */
        activeAgents: number;
        /** 需要关注的项数 */
        attentionItems: number;
    };
}
/**
 * 控制面配置
 */
export interface ControlSurfaceConfig {
    /** 自动刷新间隔（毫秒） */
    autoRefreshIntervalMs?: number;
    /** 最大任务视图数量 */
    maxTaskViewCount?: number;
    /** 最大审批视图数量 */
    maxApprovalViewCount?: number;
    /** 默认时间窗口（毫秒） */
    defaultTimeWindowMs?: number;
}
