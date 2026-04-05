/**
 * HITL Types - Human-in-the-loop 核心类型定义
 * 
 * @version v0.1.0
 * @date 2026-04-04
 * 
 * Sprint 6D: Human-in-the-loop UX
 */

import type {
  ControlAction,
  Severity,
} from './control_types';
import type {
  AttentionItem,
  DashboardSnapshot,
} from './dashboard_types';

// ============================================================================
// 基础类型
// ============================================================================

/**
 * 介入来源类型
 */
export type InterventionSourceType =
  | 'task'
  | 'approval'
  | 'ops'
  | 'agent'
  | 'incident';

/**
 * 介入严重级别
 */
export type InterventionSeverity =
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

/**
 * 介入状态
 */
export type InterventionStatus =
  | 'open'
  | 'acknowledged'
  | 'in_review'
  | 'resolved'
  | 'dismissed'
  | 'snoozed'
  | 'escalated';

/**
 * 介入类型
 */
export type InterventionType =
  | 'must_confirm'
  | 'should_review'
  | 'can_dismiss'
  | 'can_snooze'
  | 'should_escalate';

/**
 * 风险级别
 */
export type RiskLevel = 'low' | 'medium' | 'high';

/**
 * 确认级别
 */
export type ConfirmationLevel = 'none' | 'standard' | 'strong';

// ============================================================================
// 介入项
// ============================================================================

/**
 * 介入上下文
 */
export interface InterventionContext {
  /** 快照 ID */
  snapshotId: string;
  
  /** 关联任务 ID（可选） */
  relatedTaskId?: string;
  
  /** 关联审批 ID（可选） */
  relatedApprovalId?: string;
  
  /** 关联 Agent ID（可选） */
  relatedAgentId?: string;
  
  /** 关联事件 ID（可选） */
  relatedIncidentId?: string;
  
  /** 证据列表 */
  evidence: string[];
  
  /** 指标（可选） */
  metrics?: Record<string, number>;
  
  /** 最近变化（可选） */
  recentChanges?: string[];
  
  /** 推荐下一步（可选） */
  recommendedNextStep?: string;
}

/**
 * 介入项
 */
export interface InterventionItem {
  /** 介入 ID */
  id: string;
  
  /** 来源类型 */
  sourceType: InterventionSourceType;
  
  /** 来源 ID */
  sourceId: string;
  
  /** 标题 */
  title: string;
  
  /** 摘要 */
  summary: string;
  
  /** 严重级别 */
  severity: InterventionSeverity;
  
  /** 原因 */
  reason: string;
  
  /** 介入类型 */
  interventionType: InterventionType;
  
  /** 状态 */
  status: InterventionStatus;
  
  /** 是否需要人工介入 */
  requiresHuman: boolean;
  
  /** 是否需要确认 */
  requiresConfirmation: boolean;
  
  /** 创建时间 */
  createdAt: number;
  
  /** 更新时间 */
  updatedAt: number;
  
  /** 建议动作列表 */
  suggestedActions: GuidedAction[];
  
  /** 介入上下文 */
  context: InterventionContext;
  
  /**  snooze 到期时间（可选） */
  snoozeUntil?: number;
  
  /** 升级目标（可选） */
  escalateTo?: string;
}

// ============================================================================
// 引导动作
// ============================================================================

/**
 * 引导动作
 */
export interface GuidedAction {
  /** 动作 ID */
  id: string;
  
  /** 动作类型 */
  actionType: string;
  
  /** 动作标签 */
  label: string;
  
  /** 动作描述（可选） */
  description?: string;
  
  /** 是否推荐 */
  recommended: boolean;
  
  /** 是否需要确认 */
  requiresConfirmation: boolean;
  
  /** 风险级别（可选） */
  riskLevel?: RiskLevel;
  
  /** 预期结果（可选） */
  expectedOutcome?: string;
  
  /** 备选动作（可选） */
  fallbackAction?: string;
  
  /** 动作参数（可选） */
  params?: Record<string, unknown>;
}

// ============================================================================
// 动作确认
// ============================================================================

/**
 * 动作确认
 */
export interface ActionConfirmation {
  /** 动作 ID */
  actionId: string;
  
  /** 动作类型 */
  actionType: string;
  
  /** 目标类型 */
  targetType: string;
  
  /** 目标 ID */
  targetId: string;
  
  /** 确认级别 */
  confirmationLevel: ConfirmationLevel;
  
  /** 确认标题 */
  title: string;
  
  /** 确认消息 */
  message: string;
  
  /** 影响摘要（可选） */
  impactSummary?: string;
  
  /** 风险摘要（可选） */
  riskSummary?: string;
  
  /** 回滚提示（可选） */
  rollbackHint?: string;
  
  /** 创建时间 */
  createdAt: number;
  
  /** 状态 */
  status: 'pending' | 'confirmed' | 'rejected' | 'expired';
}

// ============================================================================
// 操作员建议
// ============================================================================

/**
 * 操作员建议
 */
export interface OperatorSuggestion {
  /** 建议 ID */
  id: string;
  
  /** 关联介入 ID */
  interventionId: string;
  
  /** 建议摘要 */
  summary: string;
  
  /** 理由 */
  rationale: string;
  
  /** 推荐动作 ID（可选） */
  recommendedActionId?: string;
  
  /** 备选方案（可选） */
  alternatives?: string[];
  
  /** 创建时间 */
  createdAt: number;
}

// ============================================================================
// 工作流相关类型
// ============================================================================

/**
 * 工作流步骤
 */
export interface WorkflowStep {
  /** 步骤 ID */
  id: string;
  
  /** 步骤名称 */
  name: string;
  
  /** 步骤描述 */
  description: string;
  
  /** 是否完成 */
  completed: boolean;
  
  /** 完成时间（可选） */
  completedAt?: number;
  
  /** 步骤结果（可选） */
  result?: string;
}

/**
 * 工作流状态
 */
export interface WorkflowState {
  /** 工作流 ID */
  id: string;
  
  /** 工作流类型 */
  type: 'approval' | 'incident' | 'recovery' | 'escalation';
  
  /** 当前步骤 ID */
  currentStepId: string;
  
  /** 所有步骤 */
  steps: WorkflowStep[];
  
  /** 状态 */
  status: 'active' | 'completed' | 'cancelled' | 'blocked';
  
  /** 创建时间 */
  createdAt: number;
  
  /** 更新时间 */
  updatedAt: number;
}

// ============================================================================
// 介入追踪
// ============================================================================

/**
 * 介入追踪条目
 */
export interface InterventionTrailEntry {
  /** 追踪 ID */
  id: string;
  
  /** 介入 ID */
  interventionId: string;
  
  /** 执行者 */
  actor: string;
  
  /** 动作 */
  action: string;
  
  /** 时间戳 */
  timestamp: number;
  
  /** 备注（可选） */
  note?: string;
  
  /** 结果 */
  result?: 'accepted' | 'rejected' | 'dismissed' | 'resolved' | 'escalated';
}

// ============================================================================
// 人机协同快照
// ============================================================================

/**
 * 人机协同快照
 */
export interface HumanLoopSnapshot {
  /** 快照 ID */
  snapshotId: string;
  
  /** 创建时间 */
  createdAt: number;
  
  /** 开放介入项 */
  openInterventions: InterventionItem[];
  
  /** 待确认动作 */
  queuedConfirmations: ActionConfirmation[];
  
  /** 建议列表 */
  suggestions: OperatorSuggestion[];
  
  /** 工作流状态 */
  workflows: WorkflowState[];
  
  /** 追踪记录 */
  trail: InterventionTrailEntry[];
  
  /** 摘要 */
  summary: {
    /** 开放介入数 */
    openCount: number;
    
    /** 严重介入数 */
    criticalCount: number;
    
    /** 待确认动作数 */
    pendingConfirmations: number;
    
    /** 升级介入数 */
    escalatedCount: number;
  };
}

// ============================================================================
// 介入引擎配置
// ============================================================================

/**
 * 介入规则
 */
export interface InterventionRule {
  /** 规则 ID */
  id: string;
  
  /** 规则名称 */
  name: string;
  
  /** 规则描述 */
  description: string;
  
  /** 匹配条件 */
  match: (item: AttentionItem, dashboard: DashboardSnapshot) => boolean;
  
  /** 生成介入项 */
  generateIntervention: (
    item: AttentionItem,
    dashboard: DashboardSnapshot
  ) => InterventionItem;
}

/**
 * 介入引擎配置
 */
export interface InterventionEngineConfig {
  /** 最大开放介入数 */
  maxOpenInterventions?: number;
  
  /** 自动介入阈值 */
  autoInterventionThreshold?: number;
  
  /** snooze 默认时长（毫秒） */
  defaultSnoozeDurationMs?: number;
}

// ============================================================================
// 建议引擎配置
// ============================================================================

/**
 * 建议引擎配置
 */
export interface SuggestionEngineConfig {
  /** 最大建议数 */
  maxSuggestions?: number;
  
  /** 最小置信度 */
  minConfidence?: number;
}

// ============================================================================
// 动作确认配置
// ============================================================================

/**
 * 动作确认配置
 */
export interface ActionConfirmationConfig {
  /** 无需确认的动作类型 */
  noConfirmationRequired?: string[];
  
  /** 需要强确认的动作类型 */
  strongConfirmationRequired?: string[];
}

// ============================================================================
// 人机协同服务配置
// ============================================================================

/**
 * 人机协同服务配置
 */
export interface HumanLoopServiceConfig {
  /** 自动刷新间隔（毫秒） */
  autoRefreshIntervalMs?: number;
  
  /** 最大追踪记录数 */
  maxTrailEntries?: number;
  
  /** 介入超时（毫秒） */
  interventionTimeoutMs?: number;
}
