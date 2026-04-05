/**
 * Memory Capture Policy - 记忆捕获策略
 * 
 * 职责：
 * 1. 决定什么内容值得写入长期记忆
 * 2. 控制 capture 时机
 * 3. 生成结构化 memory entry 候选
 * 4. 避免把短期噪声灌进 memory
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type {
  MemoryCaptureDecision,
  MemoryCaptureCandidate,
  MemoryCategory,
  MemoryCaptureConfig,
} from './types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 记忆捕获上下文
 */
export interface MemoryCaptureContext {
  /** 事件类型 */
  eventType?: string;
  
  /** 任务 ID */
  taskId?: string;
  
  /** 审批 ID */
  approvalId?: string;
  
  /** 会话 ID */
  sessionId?: string;
  
  /** 事件结果 */
  eventResult?: 'success' | 'failure' | 'pending';
  
  /** 事件数据 */
  eventData?: Record<string, any>;
  
  /** 内容摘要 */
  contentSummary?: string;
  
  /** 重要性分数（0-1） */
  importanceScore?: number;
  
  /** 是否一次性事件 */
  isOneTimeEvent?: boolean;
  
  /** 元数据 */
  metadata?: Record<string, any>;
}

// ============================================================================
// 记忆捕获策略评估器
// ============================================================================

export class MemoryCapturePolicyEvaluator {
  private config: Required<MemoryCaptureConfig>;
  
  // 低价值模式（用于过滤）
  private lowValuePatterns = [
    /retry/i,
    /transient/i,
    /temporary/i,
    /timeout/i,
    /connection reset/i,
    /network error/i,
  ];
  
  constructor(config: MemoryCaptureConfig = {}) {
    this.config = {
      minValueScore: config.minValueScore ?? 0.6,
      captureTaskSummaries: config.captureTaskSummaries ?? true,
      capturePreferenceChanges: config.capturePreferenceChanges ?? true,
      captureRecoveryPatterns: config.captureRecoveryPatterns ?? true,
      filterLowValue: config.filterLowValue ?? true,
    };
  }
  
  /**
   * 评估是否应该捕获记忆
   */
  evaluateMemoryCapture(context: MemoryCaptureContext): MemoryCaptureDecision {
    // 构建候选记忆
    const candidate = this.buildMemoryCaptureCandidate(context);
    
    // 检查价值分数
    if (candidate.valueScore < this.config.minValueScore) {
      return {
        shouldCapture: false,
        valueScore: candidate.valueScore,
        reason: `Value score (${candidate.valueScore}) below threshold (${this.config.minValueScore})`,
      };
    }
    
    // 过滤低价值信息
    if (this.config.filterLowValue && this.isLowValue(candidate)) {
      return {
        shouldCapture: false,
        valueScore: candidate.valueScore,
        category: candidate.category,
        reason: 'Filtered as low value information',
      };
    }
    
    // 检查是否应该捕获
    const shouldCapture = this.shouldCaptureByCategory(candidate.category, context);
    
    return {
      shouldCapture,
      valueScore: candidate.valueScore,
      category: candidate.category,
      reason: shouldCapture ? 'High value memory candidate' : 'Category not enabled for capture',
      candidate: shouldCapture ? candidate : undefined,
    };
  }
  
  /**
   * 检查是否应该捕获记忆
   */
  shouldCaptureMemory(event: string, context: MemoryCaptureContext): boolean {
    const decision = this.evaluateMemoryCapture(context);
    return decision.shouldCapture;
  }
  
  /**
   * 构建记忆捕获候选
   */
  buildMemoryCaptureCandidate(context: MemoryCaptureContext): MemoryCaptureCandidate {
    // 确定分类
    const category = this.classifyMemory(context);
    
    // 计算价值分数
    const valueScore = this.calculateValueScore(context, category);
    
    // 构建内容
    const content = this.buildMemoryContent(context, category);
    
    // 判断是否高价值
    const isHighValue = valueScore >= 0.8;
    
    // 判断是否一次性信息
    const isOneTimeInfo = context.isOneTimeEvent ?? this.isOneTimeInfo(context);
    
    return {
      content,
      category,
      valueScore,
      sourceEvent: context.eventType,
      relatedTaskId: context.taskId,
      relatedApprovalId: context.approvalId,
      metadata: context.metadata,
      isHighValue,
      isOneTimeInfo,
    };
  }
  
  /**
   * 对记忆候选进行分类
   */
  classifyMemory(context: MemoryCaptureContext): MemoryCategory {
    const eventType = context.eventType || '';
    const eventData = context.eventData || {};
    
    // 任务完成
    if (eventType?.includes('task.completed') && context.eventResult === 'success') {
      return 'task_summary';
    }
    
    // 偏好变化
    if (eventData.preference || eventType?.includes('preference')) {
      return 'preference';
    }
    
    // 约束/规则
    if (eventData.constraint || eventData.rule || eventType?.includes('constraint')) {
      return 'constraint';
    }
    
    // 策略变化
    if (eventData.strategy || eventType?.includes('strategy')) {
      return 'strategy';
    }
    
    // 恢复模式
    if (eventType?.includes('recovery') || eventData.recoveryPattern) {
      return 'recovery_pattern';
    }
    
    // 审批模式
    if (eventType?.includes('approval') || eventData.approvalPattern) {
      return 'approval_pattern';
    }
    
    // 工作区信息
    if (eventData.workspace || eventType?.includes('workspace')) {
      return 'workspace_info';
    }
    
    // 经验教训
    if (eventData.lesson || eventType?.includes('lesson')) {
      return 'lesson_learned';
    }
    
    // 默认分类
    return 'task_summary';
  }
  
  /**
   * 过滤低价值记忆
   */
  filterLowValueMemory(candidate: MemoryCaptureCandidate): boolean {
    return !this.isLowValue(candidate);
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 计算价值分数
   */
  private calculateValueScore(
    context: MemoryCaptureContext,
    category: MemoryCategory
  ): number {
    let score = context.importanceScore || 0.5;
    
    // 成功完成的任务加分
    if (context.eventResult === 'success') {
      score += 0.1;
    }
    
    // 特定分类加分
    switch (category) {
      case 'preference':
      case 'constraint':
      case 'strategy':
        // 长期有效的信息加分
        score += 0.2;
        break;
      
      case 'recovery_pattern':
      case 'approval_pattern':
        // 模式信息加分
        score += 0.15;
        break;
      
      case 'lesson_learned':
        // 经验教训加分
        score += 0.15;
        break;
    }
    
    // 失败事件减分（除非是重要教训）
    if (context.eventResult === 'failure' && category !== 'lesson_learned') {
      score -= 0.1;
    }
    
    // 一次性事件减分
    if (context.isOneTimeEvent) {
      score -= 0.2;
    }
    
    // 限制在 0-1 范围
    return Math.max(0, Math.min(1, score));
  }
  
  /**
   * 构建记忆内容
   */
  private buildMemoryContent(
    context: MemoryCaptureContext,
    category: MemoryCategory
  ): string {
    const parts: string[] = [];
    
    // 内容摘要
    if (context.contentSummary) {
      parts.push(context.contentSummary);
    }
    
    // 分类特定内容
    switch (category) {
      case 'task_summary':
        if (context.taskId) {
          parts.push(`Task: ${context.taskId}`);
        }
        if (context.eventResult) {
          parts.push(`Result: ${context.eventResult}`);
        }
        break;
      
      case 'preference':
        if (context.eventData?.preference) {
          parts.push(`Preference: ${JSON.stringify(context.eventData.preference)}`);
        }
        break;
      
      case 'constraint':
        if (context.eventData?.constraint) {
          parts.push(`Constraint: ${JSON.stringify(context.eventData.constraint)}`);
        }
        break;
      
      case 'recovery_pattern':
        if (context.eventData?.recoveryPattern) {
          parts.push(`Recovery Pattern: ${JSON.stringify(context.eventData.recoveryPattern)}`);
        }
        break;
      
      case 'approval_pattern':
        if (context.eventData?.approvalPattern) {
          parts.push(`Approval Pattern: ${JSON.stringify(context.eventData.approvalPattern)}`);
        }
        break;
    }
    
    // 元数据
    if (context.metadata && Object.keys(context.metadata).length > 0) {
      parts.push(`Metadata: ${JSON.stringify(context.metadata)}`);
    }
    
    return parts.join(' | ');
  }
  
  /**
   * 检查是否应该按分类捕获
   */
  private shouldCaptureByCategory(
    category: MemoryCategory,
    context: MemoryCaptureContext
  ): boolean {
    switch (category) {
      case 'task_summary':
        return this.config.captureTaskSummaries;
      
      case 'preference':
        return this.config.capturePreferenceChanges;
      
      case 'recovery_pattern':
        return this.config.captureRecoveryPatterns;
      
      default:
        // 其他分类默认允许
        return true;
    }
  }
  
  /**
   * 检查是否是低价值信息
   */
  private isLowValue(candidate: MemoryCaptureCandidate): boolean {
    // 检查内容是否包含低价值模式
    for (const pattern of this.lowValuePatterns) {
      if (pattern.test(candidate.content)) {
        return true;
      }
    }
    
    // 一次性信息通常是低价值
    if (candidate.isOneTimeInfo && !candidate.isHighValue) {
      return true;
    }
    
    // 价值分数过低
    if (candidate.valueScore < 0.4) {
      return true;
    }
    
    return false;
  }
  
  /**
   * 检查是否是一次性信息
   */
  private isOneTimeInfo(context: MemoryCaptureContext): boolean {
    // 检查事件类型
    const eventType = context.eventType || '';
    
    // 临时错误通常是一次性的
    if (eventType.includes('timeout') ||
        eventType.includes('transient') ||
        eventType.includes('temporary')) {
      return true;
    }
    
    // 检查元数据
    if (context.metadata?.isOneTime) {
      return true;
    }
    
    return context.isOneTimeEvent ?? false;
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建记忆捕获策略评估器
 */
export function createMemoryCapturePolicyEvaluator(
  config?: MemoryCaptureConfig
): MemoryCapturePolicyEvaluator {
  return new MemoryCapturePolicyEvaluator(config);
}

/**
 * 快速评估记忆捕获
 */
export function evaluateMemoryCapture(
  context: MemoryCaptureContext,
  config?: MemoryCaptureConfig
): MemoryCaptureDecision {
  const evaluator = new MemoryCapturePolicyEvaluator(config);
  return evaluator.evaluateMemoryCapture(context);
}

/**
 * 快速检查是否应该捕获记忆
 */
export function shouldCaptureMemory(
  event: string,
  context: MemoryCaptureContext,
  config?: MemoryCaptureConfig
): boolean {
  const evaluator = new MemoryCapturePolicyEvaluator(config);
  return evaluator.shouldCaptureMemory(event, context);
}
