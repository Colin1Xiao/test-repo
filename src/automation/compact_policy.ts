/**
 * Compact Policy - 紧凑压缩策略
 * 
 * 职责：
 * 1. 判定何时 compact
 * 2. 判定 compact 范围
 * 3. 生成 compact 摘要策略
 * 4. 与 session/task 生命周期事件挂钩
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type {
  CompactDecision,
  CompactTrigger,
  CompactStrategy,
  CompactPlan,
} from './types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 紧凑评估上下文
 */
export interface CompactContext {
  /** 会话 ID */
  sessionId?: string;
  
  /** 任务 ID */
  taskId?: string;
  
  /** 消息/事件数量 */
  messageCount?: number;
  
  /** 任务图深度 */
  taskGraphDepth?: number;
  
  /** 子代理结果数量 */
  subagentResultCount?: number;
  
  /** 审批历史数量 */
  approvalHistoryCount?: number;
  
  /** 上下文大小（字节） */
  contextSizeBytes?: number;
  
  /** 会话是否结束 */
  sessionEnded?: boolean;
  
  /** 元数据 */
  metadata?: Record<string, any>;
}

/**
 * 紧凑策略配置
 */
export interface CompactPolicyConfig {
  /** 最大消息数阈值 */
  maxMessageCount?: number;
  
  /** 最大任务图深度 */
  maxTaskGraphDepth?: number;
  
  /** 最大子代理结果数 */
  maxSubagentResults?: number;
  
  /** 最大审批历史数 */
  maxApprovalHistory?: number;
  
  /** 最大上下文大小（字节） */
  maxContextSizeBytes?: number;
  
  /** 默认保留消息数 */
  defaultKeepLastN?: number;
  
  /** 是否生成摘要 */
  generateSummary?: boolean;
  
  /** 摘要长度限制 */
  summaryLengthLimit?: number;
}

// ============================================================================
// 紧凑策略评估器
// ============================================================================

export class CompactPolicyEvaluator {
  private config: Required<CompactPolicyConfig>;
  
  constructor(config: CompactPolicyConfig = {}) {
    this.config = {
      maxMessageCount: config.maxMessageCount ?? 100,
      maxTaskGraphDepth: config.maxTaskGraphDepth ?? 10,
      maxSubagentResults: config.maxSubagentResults ?? 20,
      maxApprovalHistory: config.maxApprovalHistory ?? 50,
      maxContextSizeBytes: config.maxContextSizeBytes ?? 1024 * 1024, // 1MB
      defaultKeepLastN: config.defaultKeepLastN ?? 20,
      generateSummary: config.generateSummary ?? true,
      summaryLengthLimit: config.summaryLengthLimit ?? 1000,
    };
  }
  
  /**
   * 评估紧凑需求
   */
  evaluateCompactNeed(context: CompactContext): CompactDecision {
    // 检查各个触发条件
    const triggers: Array<{ trigger: CompactTrigger; priority: number }> = [];
    
    // 检查消息数量
    if ((context.messageCount || 0) > this.config.maxMessageCount) {
      triggers.push({
        trigger: 'context_too_large',
        priority: 8,
      });
    }
    
    // 检查任务图深度
    if ((context.taskGraphDepth || 0) > this.config.maxTaskGraphDepth) {
      triggers.push({
        trigger: 'task_graph_too_deep',
        priority: 7,
      });
    }
    
    // 检查子代理结果数量
    if ((context.subagentResultCount || 0) > this.config.maxSubagentResults) {
      triggers.push({
        trigger: 'subagent_results_too_many',
        priority: 6,
      });
    }
    
    // 检查审批历史数量
    if ((context.approvalHistoryCount || 0) > this.config.maxApprovalHistory) {
      triggers.push({
        trigger: 'approval_history_accumulated',
        priority: 5,
      });
    }
    
    // 检查上下文大小
    if ((context.contextSizeBytes || 0) > this.config.maxContextSizeBytes) {
      triggers.push({
        trigger: 'memory_pressure',
        priority: 9,
      });
    }
    
    // 检查会话结束
    if (context.sessionEnded) {
      triggers.push({
        trigger: 'session_end',
        priority: 10,
      });
    }
    
    // 没有触发条件
    if (triggers.length === 0) {
      return {
        shouldCompact: false,
      };
    }
    
    // 选择最高优先级的触发条件
    triggers.sort((a, b) => b.priority - a.priority);
    const highestTrigger = triggers[0];
    
    // 确定紧凑范围
    let scope: 'session' | 'task' | 'approval' | 'history' = 'history';
    
    if (highestTrigger.trigger === 'session_end') {
      scope = 'session';
    } else if (highestTrigger.trigger === 'task_graph_too_deep') {
      scope = 'task';
    } else if (highestTrigger.trigger === 'approval_history_accumulated') {
      scope = 'approval';
    }
    
    // 构建紧凑策略
    const strategy = this.buildCompactStrategy(scope, context);
    
    return {
      shouldCompact: true,
      trigger: highestTrigger.trigger,
      priority: highestTrigger.priority,
      scope,
      reason: this.getTriggerReason(highestTrigger.trigger, context),
      strategy,
    };
  }
  
  /**
   * 检查是否应该紧凑
   */
  shouldCompact(event: string, context: CompactContext): boolean {
    const decision = this.evaluateCompactNeed(context);
    return decision.shouldCompact;
  }
  
  /**
   * 构建紧凑计划
   */
  buildCompactPlan(context: CompactContext): CompactPlan {
    const decision = this.evaluateCompactNeed(context);
    
    if (!decision.shouldCompact || !decision.strategy) {
      throw new Error('Compact not needed');
    }
    
    // 估算压缩率
    const estimatedCompressionRatio = this.estimateCompressionRatio(context, decision.strategy);
    
    // 估算节省空间
    const estimatedSpaceSaved = context.contextSizeBytes
      ? Math.floor(context.contextSizeBytes * (1 - estimatedCompressionRatio))
      : undefined;
    
    return {
      scope: decision.scope || 'history',
      trigger: decision.trigger || 'policy_triggered',
      strategy: decision.strategy,
      estimatedCompressionRatio,
      estimatedSpaceSaved,
    };
  }
  
  /**
   * 生成紧凑摘要
   */
  summarizeForCompact(context: CompactContext): string {
    const summaries: string[] = [];
    
    // 任务摘要
    if (context.taskId) {
      summaries.push(`Task: ${context.taskId}`);
    }
    
    // 会话摘要
    if (context.sessionId) {
      summaries.push(`Session: ${context.sessionId}`);
    }
    
    // 统计摘要
    const stats: string[] = [];
    if (context.messageCount) {
      stats.push(`${context.messageCount} messages`);
    }
    if (context.taskGraphDepth) {
      stats.push(`task depth: ${context.taskGraphDepth}`);
    }
    if (context.subagentResultCount) {
      stats.push(`${context.subagentResultCount} subagent results`);
    }
    if (context.approvalHistoryCount) {
      stats.push(`${context.approvalHistoryCount} approvals`);
    }
    
    if (stats.length > 0) {
      summaries.push(`Stats: ${stats.join(', ')}`);
    }
    
    return summaries.join(' | ');
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 构建紧凑策略
   */
  private buildCompactStrategy(
    scope: 'session' | 'task' | 'approval' | 'history',
    context: CompactContext
  ): CompactStrategy {
    const strategy: CompactStrategy = {
      keepLastN: this.config.defaultKeepLastN,
      generateSummary: this.config.generateSummary,
      summaryLengthLimit: this.config.summaryLengthLimit,
    };
    
    // 根据范围调整策略
    switch (scope) {
      case 'session':
        // 会话结束：保留更多关键信息
        strategy.keepLastN = 30;
        strategy.preserveKeyEvents = true;
        strategy.compressAttachments = true;
        break;
      
      case 'task':
        // 任务压缩：保留任务链
        strategy.keepLastN = 15;
        strategy.preserveKeyEvents = true;
        break;
      
      case 'approval':
        // 审批压缩：保留审批决策
        strategy.keepLastN = 10;
        strategy.preserveKeyEvents = true;
        break;
      
      case 'history':
        // 历史压缩：标准策略
        break;
    }
    
    // 根据上下文大小调整
    if ((context.contextSizeBytes || 0) > this.config.maxContextSizeBytes * 0.8) {
      strategy.keepLastN = Math.floor((strategy.keepLastN || 20) * 0.5);
    }
    
    return strategy;
  }
  
  /**
   * 获取触发原因
   */
  private getTriggerReason(
    trigger: CompactTrigger,
    context: CompactContext
  ): string {
    switch (trigger) {
      case 'context_too_large':
        return `Message count (${context.messageCount}) exceeds limit (${this.config.maxMessageCount})`;
      
      case 'task_graph_too_deep':
        return `Task graph depth (${context.taskGraphDepth}) exceeds limit (${this.config.maxTaskGraphDepth})`;
      
      case 'subagent_results_too_many':
        return `Subagent results (${context.subagentResultCount}) exceeds limit (${this.config.maxSubagentResults})`;
      
      case 'approval_history_accumulated':
        return `Approval history (${context.approvalHistoryCount}) exceeds limit (${this.config.maxApprovalHistory})`;
      
      case 'memory_pressure':
        return `Context size (${context.contextSizeBytes} bytes) exceeds limit (${this.config.maxContextSizeBytes} bytes)`;
      
      case 'session_end':
        return 'Session ended, compacting history';
      
      case 'policy_triggered':
        return 'Policy triggered compact';
      
      default:
        return 'Unknown trigger';
    }
  }
  
  /**
   * 估算压缩率
   */
  private estimateCompressionRatio(
    context: CompactContext,
    strategy: CompactStrategy
  ): number {
    // 简化估算：基于 keepLastN 和是否生成摘要
    const keepRatio = (strategy.keepLastN || 20) / (context.messageCount || 20);
    const summaryRatio = strategy.generateSummary ? 0.1 : 0;
    
    return Math.min(keepRatio + summaryRatio, 0.9);
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建紧凑策略评估器
 */
export function createCompactPolicyEvaluator(config?: CompactPolicyConfig): CompactPolicyEvaluator {
  return new CompactPolicyEvaluator(config);
}

/**
 * 快速评估紧凑需求
 */
export function evaluateCompactNeed(
  context: CompactContext,
  config?: CompactPolicyConfig
): CompactDecision {
  const evaluator = new CompactPolicyEvaluator(config);
  return evaluator.evaluateCompactNeed(context);
}

/**
 * 快速检查是否应该紧凑
 */
export function shouldCompact(
  event: string,
  context: CompactContext,
  config?: CompactPolicyConfig
): boolean {
  const evaluator = new CompactPolicyEvaluator(config);
  return evaluator.shouldCompact(event, context);
}
