/**
 * Automation Types - 自动化运行核心类型定义
 *
 * @version v0.1.0
 * @date 2026-04-03
 *
 * Sprint 5A: Hook Automation Runtime
 * Sprint 5B: Automation Loader / Workspace Rules
 * Sprint 5C: Recovery / Replay / Compact Policy
 * Sprint 5D: Audit / Health / Ops View
 */
/**
 * 自动化事件类型
 */
export type AutomationEventType = 'task.created' | 'task.started' | 'task.completed' | 'task.failed' | 'task.timeout' | 'approval.requested' | 'approval.resolved' | 'server.degraded' | 'server.unavailable' | 'budget.exceeded' | 'skill.loaded' | 'skill.blocked';
/**
 * 字段路径
 */
export type FieldPath = 'event.type' | 'event.severity' | 'event.payload.*' | 'task.status' | 'task.risk' | 'task.retryCount' | 'agent.role' | 'agent.id' | 'server.health' | 'server.name' | 'budget.remaining' | 'budget.total' | 'approval.ageMinutes' | 'approval.status';
/**
 * 比较操作符
 */
export type ComparisonOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in' | 'exists' | 'regex' | 'startswith' | 'endswith';
/**
 * 动作类型
 */
export type AutomationActionType = 'notify' | 'retry' | 'escalate' | 'log' | 'cancel' | 'pause' | 'custom';
/**
 * 动作执行状态
 */
export type ActionExecutionStatus = 'success' | 'failure' | 'skipped' | 'pending';
/**
 * 自动化事件
 */
export interface AutomationEvent {
    /** 事件类型 */
    type: AutomationEventType;
    /** 时间戳 */
    timestamp: number;
    /** 严重级别 */
    severity?: 'low' | 'medium' | 'high' | 'critical';
    /** 任务 ID（可选） */
    taskId?: string;
    /** Agent ID（可选） */
    agentId?: string;
    /** Session ID（可选） */
    sessionId?: string;
    /** 事件数据 */
    payload: Record<string, any>;
    /** 来源规则 ID（可选，用于追踪链式触发） */
    sourceRuleId?: string;
}
/**
 * 自动化条件
 */
export interface AutomationCondition {
    /** 条件类型 */
    type: 'field' | 'regex' | 'threshold' | 'custom';
    /** 字段路径 */
    field?: FieldPath | string;
    /** 操作符 */
    operator?: ComparisonOperator;
    /** 比较值 */
    value?: any;
    /** 自定义表达式（用于 custom 类型） */
    expression?: string;
    /** 条件描述（可选） */
    description?: string;
}
/**
 * 条件评估结果
 */
export interface ConditionEvaluationResult {
    /** 是否匹配 */
    matched: boolean;
    /** 条件 ID（如果有） */
    conditionId?: string;
    /** 比较的左值 */
    leftValue?: any;
    /** 比较的右值 */
    rightValue?: any;
    /** 不匹配的原因 */
    reason?: string;
}
/**
 * 自动化动作
 */
export interface AutomationAction {
    /** 动作类型 */
    type: AutomationActionType;
    /** 目标（可选，如通知目标） */
    target?: string;
    /** 动作参数 */
    params?: Record<string, any>;
    /** 动作描述（可选） */
    description?: string;
}
/**
 * 动作执行结果
 */
export interface ActionExecutionResult {
    /** 执行状态 */
    status: ActionExecutionStatus;
    /** 动作类型 */
    actionType: AutomationActionType;
    /** 执行原因/说明 */
    reason?: string;
    /** 执行产物（可选） */
    artifacts?: Record<string, any>;
    /** 副作用（可选） */
    sideEffects?: string[];
    /** 错误信息（如果失败） */
    error?: string;
}
/**
 * 自动化规则
 */
export interface AutomationRule {
    /** 规则 ID */
    id: string;
    /** 规则名称 */
    name: string;
    /** 规则描述（可选） */
    description?: string;
    /** 是否启用 */
    enabled: boolean;
    /** 优先级（数字越大优先级越高） */
    priority?: number;
    /** 触发事件列表 */
    events: AutomationEventType[];
    /** 条件列表 */
    conditions: AutomationCondition[];
    /** 动作列表 */
    actions: AutomationAction[];
    /** 匹配后是否停止后续规则（可选） */
    stopOnMatch?: boolean;
    /** 冷却时间（毫秒，可选） */
    cooldownMs?: number;
    /** 最大触发次数（可选） */
    maxTriggerCount?: number;
    /** 元数据（可选） */
    metadata?: Record<string, any>;
}
/**
 * 规则匹配结果
 */
export interface RuleMatchResult {
    /** 规则 */
    rule: AutomationRule;
    /** 是否匹配 */
    matched: boolean;
    /** 条件评估结果 */
    conditionResults: ConditionEvaluationResult[];
    /** 匹配时间 */
    matchedAt: number;
    /** 冷却中 */
    isCooldown?: boolean;
    /** 已达到最大触发次数 */
    isMaxTriggered?: boolean;
}
/**
 * 自动化执行上下文
 */
export interface AutomationExecutionContext {
    /** 当前事件 */
    event: AutomationEvent;
    /** 匹配的规则 */
    matchedRules: RuleMatchResult[];
    /** 已执行的动作用于追踪 */
    executedActions: ActionExecutionResult[];
    /** 执行深度（防止无限递归） */
    chainDepth: number;
    /** 最大执行深度 */
    maxChainDepth: number;
    /** 上下文数据 */
    contextData: Record<string, any>;
}
/**
 * 规则执行结果
 */
export interface RuleExecutionResult {
    /** 规则 ID */
    ruleId: string;
    /** 是否成功执行 */
    success: boolean;
    /** 执行的动作用于结果 */
    actionResults: ActionExecutionResult[];
    /** 执行时间（毫秒） */
    executionTimeMs: number;
    /** 错误信息（如果失败） */
    error?: string;
}
/**
 * 自动化执行摘要
 */
export interface AutomationExecutionSummary {
    /** 事件类型 */
    eventType: AutomationEventType;
    /** 匹配的规则数 */
    matchedRules: number;
    /** 执行的规则数 */
    executedRules: number;
    /** 执行的动作用于数 */
    executedActions: number;
    /** 执行结果 */
    results: RuleExecutionResult[];
    /** 执行时间（毫秒） */
    executionTimeMs: number;
}
/**
 * 自动化配置文档
 */
export interface AutomationConfigDocument {
    /** 配置版本 */
    version: number;
    /** 规则列表 */
    rules: AutomationRule[];
    /** 继承的配置（可选） */
    extends?: string;
    /** 工作区配置（可选） */
    workspace?: {
        /** 工作区根目录 */
        root?: string;
        /** 是否覆盖默认规则 */
        overrideDefaults?: boolean;
    };
    /** 默认配置（可选） */
    defaults?: {
        /** 默认启用 */
        enabled?: boolean;
        /** 默认冷却时间 */
        cooldownMs?: number;
        /** 默认最大触发次数 */
        maxTriggerCount?: number;
    };
}
/**
 * 规则来源
 */
export interface AutomationRuleSource {
    /** 来源类型 */
    type: 'builtin' | 'workspace' | 'remote';
    /** 来源路径/URL */
    path?: string;
    /** 加载时间 */
    loadedAt: number;
    /** 校验错误 */
    errors?: AutomationConfigError[];
    /** 校验警告 */
    warnings?: string[];
}
/**
 * 自动化加载结果
 */
export interface AutomationLoadResult {
    /** 是否成功 */
    success: boolean;
    /** 加载的规则数 */
    loadedRules: number;
    /** 失败的规则数 */
    failedRules: number;
    /** 规则来源 */
    source: AutomationRuleSource;
    /** 错误列表 */
    errors: AutomationConfigError[];
    /** 警告列表 */
    warnings: string[];
}
/**
 * 自动化注册表快照
 */
export interface AutomationRegistrySnapshot {
    /** 快照 ID */
    snapshotId: string;
    /** 创建时间 */
    createdAt: number;
    /** 规则总数 */
    totalRules: number;
    /** 启用的规则数 */
    enabledRules: number;
    /** 按来源分组 */
    bySource: Record<string, number>;
    /** 规则列表 */
    rules: Array<AutomationRule & {
        source: string;
    }>;
}
/**
 * 自动化配置错误
 */
export interface AutomationConfigError {
    /** 错误类型 */
    type: 'schema' | 'validation' | 'load' | 'parse';
    /** 错误路径 */
    path?: string;
    /** 错误信息 */
    message: string;
    /** 规则 ID（如果相关） */
    ruleId?: string;
}
/**
 * 自动化覆盖模式
 */
export type AutomationOverrideMode = 'append' | 'override' | 'disable';
/**
 * 规则集
 */
export interface AutomationRuleSet {
    /** 规则列表 */
    rules: AutomationRule[];
    /** 来源信息 */
    source: AutomationRuleSource;
    /** 加载时间 */
    loadedAt: number;
}
/**
 * 加载器配置
 */
export interface AutomationLoaderConfig {
    /** 默认规则文件路径 */
    defaultRulesPath?: string;
    /** 工作区规则文件路径 */
    workspaceRulesPath?: string;
    /** 是否启用热加载 */
    enableHotReload?: boolean;
    /** 热加载间隔（毫秒） */
    hotReloadIntervalMs?: number;
    /** 是否严格模式 */
    strictMode?: boolean;
}
/**
 * 失败分类
 */
export type FailureCategory = 'timeout' | 'permission_denied' | 'approval_denied' | 'approval_pending' | 'resource_unavailable' | 'validation_failed' | 'internal_error' | 'transient_external_error';
/**
 * 恢复原因
 */
export type RecoveryReason = 'task_timeout' | 'task_failed' | 'approval_timeout' | 'approval_interrupted' | 'resource_recovered' | 'transient_error' | 'user_requested' | 'policy_triggered';
/**
 * 恢复决策
 */
export interface RecoveryDecision {
    /** 决策类型 */
    type: 'retry' | 'replay' | 'resume' | 'abort' | 'escalate';
    /** 原因 */
    reason: RecoveryReason;
    /** 失败分类 */
    failureCategory?: FailureCategory;
    /** 是否可重试 */
    retryable: boolean;
    /** 最大重试次数 */
    maxReplayCount?: number;
    /** 当前重试次数 */
    currentReplayCount?: number;
    /** 退避时间（毫秒） */
    backoffMs?: number;
    /** 说明 */
    explanation?: string;
}
/**
 * 重放请求
 */
export interface ReplayRequest {
    /** 任务 ID */
    taskId: string;
    /** 审批 ID（可选） */
    approvalId?: string;
    /** 重放类型 */
    replayType: 'task' | 'approval' | 'session';
    /** 重放范围 */
    scope: ReplayScope;
    /** 原因 */
    reason: string;
    /** 元数据 */
    metadata?: Record<string, any>;
}
/**
 * 重放范围
 */
export interface ReplayScope {
    /** 包含子任务 */
    includeSubtasks?: boolean;
    /** 包含审批 */
    includeApprovals?: boolean;
    /** 包含历史记录 */
    includeHistory?: boolean;
    /** 从哪个步骤开始 */
    fromStep?: number;
}
/**
 * 重放结果
 */
export interface ReplayResult {
    /** 是否成功 */
    success: boolean;
    /** 重放的任务 ID */
    replayedTaskId: string;
    /** 重放类型 */
    replayType: 'task' | 'approval' | 'session';
    /** 重放次数 */
    replayCount: number;
    /** 结果数据 */
    result?: any;
    /** 错误信息（如果失败） */
    error?: string;
    /** 重放时间（毫秒） */
    replayTimeMs: number;
}
/**
 * 恢复计划
 */
export interface RecoveryPlan {
    /** 任务 ID */
    taskId: string;
    /** 决策 */
    decision: RecoveryDecision;
    /** 步骤 */
    steps: Array<{
        action: string;
        params?: Record<string, any>;
    }>;
    /** 预计恢复时间（毫秒） */
    estimatedRecoveryTimeMs?: number;
}
/**
 * 紧凑触发类型
 */
export type CompactTrigger = 'context_too_large' | 'task_graph_too_deep' | 'subagent_results_too_many' | 'approval_history_accumulated' | 'session_end' | 'memory_pressure' | 'policy_triggered';
/**
 * 紧凑决策
 */
export interface CompactDecision {
    /** 是否应该紧凑 */
    shouldCompact: boolean;
    /** 触发类型 */
    trigger?: CompactTrigger;
    /** 优先级（1-10） */
    priority?: number;
    /** 紧凑范围 */
    scope?: 'session' | 'task' | 'approval' | 'history';
    /** 原因 */
    reason?: string;
    /** 紧凑策略 */
    strategy?: CompactStrategy;
}
/**
 * 紧凑策略
 */
export interface CompactStrategy {
    /** 保留最近 N 条消息 */
    keepLastN?: number;
    /** 保留关键事件 */
    preserveKeyEvents?: boolean;
    /** 生成摘要 */
    generateSummary?: boolean;
    /** 摘要长度限制 */
    summaryLengthLimit?: number;
    /** 压缩附件 */
    compressAttachments?: boolean;
}
/**
 * 紧凑计划
 */
export interface CompactPlan {
    /** 紧凑范围 */
    scope: 'session' | 'task' | 'approval' | 'history';
    /** 触发类型 */
    trigger: CompactTrigger;
    /** 策略 */
    strategy: CompactStrategy;
    /** 预计压缩率 */
    estimatedCompressionRatio?: number;
    /** 预计节省空间（字节） */
    estimatedSpaceSaved?: number;
}
/**
 * 记忆捕获决策
 */
export interface MemoryCaptureDecision {
    /** 是否应该捕获 */
    shouldCapture: boolean;
    /** 记忆价值分数（0-1） */
    valueScore?: number;
    /** 记忆分类 */
    category?: MemoryCategory;
    /** 原因 */
    reason?: string;
    /** 候选记忆内容 */
    candidate?: MemoryCaptureCandidate;
}
/**
 * 记忆分类
 */
export type MemoryCategory = 'task_summary' | 'preference' | 'constraint' | 'strategy' | 'lesson_learned' | 'recovery_pattern' | 'approval_pattern' | 'workspace_info';
/**
 * 记忆捕获候选
 */
export interface MemoryCaptureCandidate {
    /** 内容 */
    content: string;
    /** 分类 */
    category: MemoryCategory;
    /** 价值分数（0-1） */
    valueScore: number;
    /** 来源事件类型 */
    sourceEvent?: string;
    /** 相关任务 ID */
    relatedTaskId?: string;
    /** 相关审批 ID */
    relatedApprovalId?: string;
    /** 元数据 */
    metadata?: Record<string, any>;
    /** 是否高价值 */
    isHighValue: boolean;
    /** 是否一次性信息 */
    isOneTimeInfo: boolean;
}
/**
 * 记忆捕获配置
 */
export interface MemoryCaptureConfig {
    /** 最小价值分数阈值 */
    minValueScore?: number;
    /** 是否捕获任务摘要 */
    captureTaskSummaries?: boolean;
    /** 是否捕获偏好变化 */
    capturePreferenceChanges?: boolean;
    /** 是否捕获恢复模式 */
    captureRecoveryPatterns?: boolean;
    /** 是否过滤低价值信息 */
    filterLowValue?: boolean;
}
/**
 * 审计事件类型
 */
export type AuditEventType = 'task.created' | 'task.started' | 'task.completed' | 'task.failed' | 'task.replayed' | 'task.cancelled' | 'approval.requested' | 'approval.resolved' | 'approval.denied' | 'approval.timeout' | 'mcp.accessed' | 'mcp.approved' | 'mcp.denied' | 'skill.loaded' | 'skill.blocked' | 'skill.pending' | 'automation.loaded' | 'automation.reloaded' | 'automation.failed' | 'recovery.triggered' | 'recovery.completed' | 'recovery.failed' | 'compact.triggered' | 'compact.completed' | 'memory.captured';
/**
 * 实体类型
 */
export type AuditEntityType = 'task' | 'approval' | 'agent' | 'server' | 'skill' | 'automation_rule' | 'session';
/**
 * 严重级别
 */
export type AuditSeverity = 'debug' | 'info' | 'warning' | 'error' | 'critical';
/**
 * 告警级别
 */
export type AlertLevel = 'low' | 'medium' | 'high' | 'critical';
/**
 * 审计事件
 */
export interface AuditEvent {
    /** 事件 ID */
    id: string;
    /** 时间戳 */
    timestamp: number;
    /** 事件类型 */
    eventType: AuditEventType;
    /** 实体类型 */
    entityType: AuditEntityType;
    /** 实体 ID */
    entityId: string;
    /** 任务 ID（可选） */
    taskId?: string;
    /** Agent ID（可选） */
    agentId?: string;
    /** Server ID（可选） */
    serverId?: string;
    /** Skill 名称（可选） */
    skillName?: string;
    /** 严重级别 */
    severity: AuditSeverity;
    /** 失败分类（可选） */
    category?: string;
    /** 原因/说明 */
    reason?: string;
    /** 元数据 */
    metadata?: Record<string, any>;
}
/**
 * 审计查询
 */
export interface AuditQuery {
    /** 开始时间 */
    startTime?: number;
    /** 结束时间 */
    endTime?: number;
    /** 事件类型过滤 */
    eventType?: AuditEventType;
    /** 实体类型过滤 */
    entityType?: AuditEntityType;
    /** 实体 ID 过滤 */
    entityId?: string;
    /** 任务 ID 过滤 */
    taskId?: string;
    /** Agent ID 过滤 */
    agentId?: string;
    /** Server ID 过滤 */
    serverId?: string;
    /** Skill 名称过滤 */
    skillName?: string;
    /** 严重级别过滤 */
    severity?: AuditSeverity;
    /** 分类过滤 */
    category?: string;
    /** 最大返回数量 */
    limit?: number;
}
/**
 * 失败分类（统一）
 */
export type UnifiedFailureCategory = 'timeout' | 'permission' | 'approval' | 'resource' | 'validation' | 'dependency' | 'compatibility' | 'provider' | 'internal' | 'policy' | 'unknown';
/**
 * 失败记录
 */
export interface FailureRecord {
    /** 失败 ID */
    id: string;
    /** 时间戳 */
    timestamp: number;
    /** 失败分类 */
    category: UnifiedFailureCategory;
    /** 实体类型 */
    entityType: AuditEntityType;
    /** 实体 ID */
    entityId: string;
    /** 任务 ID（可选） */
    taskId?: string;
    /** Agent ID（可选） */
    agentId?: string;
    /** Server ID（可选） */
    serverId?: string;
    /** Skill 名称（可选） */
    skillName?: string;
    /** 错误信息 */
    errorMessage: string;
    /** 根本原因（可选） */
    rootCause?: string;
    /** 恢复次数 */
    recoveryCount?: number;
    /** 元数据 */
    metadata?: Record<string, any>;
}
/**
 * 健康快照
 */
export interface HealthSnapshot {
    /** 快照 ID */
    snapshotId: string;
    /** 创建时间 */
    createdAt: number;
    /** 时间范围 */
    timeRange: {
        startTime: number;
        endTime: number;
    };
    /** 全局指标 */
    global: GlobalHealthMetrics;
    /** 按 Agent 分组 */
    byAgent: Record<string, AgentHealthMetrics>;
    /** 按 Server 分组 */
    byServer: Record<string, ServerHealthMetrics>;
    /** 按 Skill 分组 */
    bySkill: Record<string, SkillHealthMetrics>;
}
/**
 * 全局健康指标
 */
export interface GlobalHealthMetrics {
    /** 总任务数 */
    totalTasks: number;
    /** 成功任务数 */
    successfulTasks: number;
    /** 失败任务数 */
    failedTasks: number;
    /** 成功率 */
    successRate: number;
    /** 失败率 */
    failureRate: number;
    /** 待处理审批数 */
    pendingApprovals: number;
    /** 重放频率 */
    replayFrequency: number;
    /** 降级 Server 数 */
    degradedServers: number;
    /** 被阻塞 Skill 数 */
    blockedSkills: number;
    /** 平均任务耗时（毫秒） */
    avgTaskDurationMs: number;
    /** 健康评分（0-100） */
    healthScore: number;
}
/**
 * Agent 健康指标
 */
export interface AgentHealthMetrics {
    /** Agent ID */
    agentId: string;
    /** 执行成功率 */
    executionSuccessRate: number;
    /** 平均耗时（毫秒） */
    averageLatencyMs: number;
    /** 失败分类分布 */
    failureCategoryDistribution: Record<string, number>;
    /** 总执行次数 */
    totalExecutions: number;
}
/**
 * Server 健康指标
 */
export interface ServerHealthMetrics {
    /** Server ID */
    serverId: string;
    /** 健康状态 */
    healthStatus: 'healthy' | 'degraded' | 'unavailable';
    /** 错误率 */
    errorRate: number;
    /** 降级次数 */
    degradedCount: number;
    /** 不可用次数 */
    unavailableCount: number;
    /** 审批摩擦（需要审批的比例） */
    approvalFriction: number;
}
/**
 * Skill 健康指标
 */
export interface SkillHealthMetrics {
    /** Skill 名称 */
    skillName: string;
    /** 加载成功率 */
    loadSuccessRate: number;
    /** 被阻塞频率 */
    blockedFrequency: number;
    /** 待审批频率 */
    pendingFrequency: number;
    /** 兼容性问题数 */
    compatibilityIssues: number;
}
/**
 * 运维摘要
 */
export interface OpsSummary {
    /** 摘要 ID */
    summaryId: string;
    /** 创建时间 */
    createdAt: number;
    /** 总体状态 */
    overallStatus: 'healthy' | 'degraded' | 'critical';
    /** 健康评分 */
    healthScore: number;
    /** 顶级失败问题 */
    topFailures: Array<{
        category: string;
        count: number;
        impact: string;
    }>;
    /** 降级 Server */
    degradedServers: Array<{
        serverId: string;
        status: 'degraded' | 'unavailable';
        errorRate: number;
    }>;
    /** 被阻塞/待审批 Skill */
    blockedOrPendingSkills: Array<{
        skillName: string;
        status: 'blocked' | 'pending';
        count: number;
    }>;
    /** 审批瓶颈 */
    approvalBottlenecks: Array<{
        approvalType: string;
        pendingCount: number;
        avgWaitTimeMs: number;
    }>;
    /** 重放热点 */
    replayHotspots: Array<{
        taskId: string;
        replayCount: number;
        reason: string;
    }>;
    /** 建议操作 */
    recommendedActions: Array<{
        priority: 'high' | 'medium' | 'low';
        action: string;
        reason: string;
    }>;
}
/**
 * 运维摘要配置
 */
export interface OpsSummaryConfig {
    /** 顶级问题数量限制 */
    topIssuesLimit?: number;
    /** 建议操作数量限制 */
    recommendedActionsLimit?: number;
    /** 健康评分权重配置 */
    healthScoreWeights?: {
        successRate: number;
        pendingApprovals: number;
        degradedServers: number;
        blockedSkills: number;
    };
}
