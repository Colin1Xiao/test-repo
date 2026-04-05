/**
 * Failure Taxonomy - 失败分类法
 * 
 * 职责：
 * 1. 定义统一失败分类
 * 2. 把 task / approval / MCP / skill / agent / runtime 失败映射到标准 category
 * 3. 给 audit 和 health 统一语言
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type { UnifiedFailureCategory, FailureRecord, AuditEvent } from './types';

// ============================================================================
// 失败分类映射
// ============================================================================

/**
 * 错误模式到失败分类的映射
 */
const ERROR_PATTERN_MAP: Array<{
  pattern: RegExp;
  category: UnifiedFailureCategory;
}> = [
  // Timeout
  { pattern: /timeout/i, category: 'timeout' },
  { pattern: /timed out/i, category: 'timeout' },
  { pattern: /deadline exceeded/i, category: 'timeout' },
  
  // Permission
  { pattern: /permission denied/i, category: 'permission' },
  { pattern: /access denied/i, category: 'permission' },
  { pattern: /unauthorized/i, category: 'permission' },
  { pattern: /forbidden/i, category: 'permission' },
  
  // Approval
  { pattern: /approval denied/i, category: 'approval' },
  { pattern: /approval rejected/i, category: 'approval' },
  { pattern: /approval timeout/i, category: 'approval' },
  
  // Resource
  { pattern: /resource unavailable/i, category: 'resource' },
  { pattern: /resource not found/i, category: 'resource' },
  { pattern: /connection refused/i, category: 'resource' },
  { pattern: /network error/i, category: 'resource' },
  
  // Validation
  { pattern: /validation failed/i, category: 'validation' },
  { pattern: /invalid input/i, category: 'validation' },
  { pattern: /schema error/i, category: 'validation' },
  
  // Dependency
  { pattern: /dependency.*not found/i, category: 'dependency' },
  { pattern: /module not found/i, category: 'dependency' },
  { pattern: /import error/i, category: 'dependency' },
  
  // Compatibility
  { pattern: /compatibility/i, category: 'compatibility' },
  { pattern: /version mismatch/i, category: 'compatibility' },
  { pattern: /unsupported/i, category: 'compatibility' },
  
  // Provider
  { pattern: /provider error/i, category: 'provider' },
  { pattern: /upstream error/i, category: 'provider' },
  { pattern: /external service/i, category: 'provider' },
  
  // Internal
  { pattern: /internal error/i, category: 'internal' },
  { pattern: /unexpected error/i, category: 'internal' },
  { pattern: /null pointer/i, category: 'internal' },
  { pattern: /undefined is not/i, category: 'internal' },
  
  // Policy
  { pattern: /policy violation/i, category: 'policy' },
  { pattern: /rule violation/i, category: 'policy' },
  { pattern: /quota exceeded/i, category: 'policy' },
];

// ============================================================================
// 失败分类器
// ============================================================================

export class FailureTaxonomy {
  /**
   * 分类失败
   */
  classifyFailure(eventOrError: any): UnifiedFailureCategory {
    const errorMessage = this.extractErrorMessage(eventOrError);
    
    // 尝试匹配错误模式
    for (const { pattern, category } of ERROR_PATTERN_MAP) {
      if (pattern.test(errorMessage)) {
        return category;
      }
    }
    
    // 默认返回 unknown
    return 'unknown';
  }
  
  /**
   * 规范化失败分类
   */
  normalizeFailureCategory(input: string): UnifiedFailureCategory {
    const normalized = input.toLowerCase().trim();
    
    // 直接映射已知分类
    const knownCategories: UnifiedFailureCategory[] = [
      'timeout',
      'permission',
      'approval',
      'resource',
      'validation',
      'dependency',
      'compatibility',
      'provider',
      'internal',
      'policy',
      'unknown',
    ];
    
    for (const category of knownCategories) {
      if (normalized.includes(category)) {
        return category;
      }
    }
    
    // 尝试模式匹配
    return this.classifyFailure(input);
  }
  
  /**
   * 构建失败记录
   */
  buildFailureRecord(
    event: AuditEvent | any,
    errorMessage: string,
    rootCause?: string
  ): FailureRecord {
    const category = this.classifyFailure(errorMessage);
    
    return {
      id: this.generateFailureId(),
      timestamp: event.timestamp || Date.now(),
      category,
      entityType: event.entityType || 'task',
      entityId: event.entityId || event.taskId || 'unknown',
      taskId: event.taskId,
      agentId: event.agentId,
      serverId: event.serverId,
      skillName: event.skillName,
      errorMessage,
      rootCause,
      recoveryCount: 0,
      metadata: event.metadata,
    };
  }
  
  /**
   * 获取失败分类描述
   */
  getCategoryDescription(category: UnifiedFailureCategory): string {
    const descriptions: Record<UnifiedFailureCategory, string> = {
      timeout: 'Operation exceeded time limit',
      permission: 'Access or permission denied',
      approval: 'Approval rejected or timed out',
      resource: 'Resource unavailable or not found',
      validation: 'Input or schema validation failed',
      dependency: 'Missing or broken dependency',
      compatibility: 'Version or compatibility mismatch',
      provider: 'External provider or upstream error',
      internal: 'Internal system error',
      policy: 'Policy or quota violation',
      unknown: 'Unknown or uncategorized failure',
    };
    
    return descriptions[category];
  }
  
  /**
   * 获取失败分类建议操作
   */
  getSuggestedAction(category: UnifiedFailureCategory): string {
    const actions: Record<UnifiedFailureCategory, string> = {
      timeout: 'Increase timeout or optimize operation',
      permission: 'Check permissions and access controls',
      approval: 'Review approval criteria or escalate',
      resource: 'Check resource availability and connectivity',
      validation: 'Fix input data or schema definition',
      dependency: 'Install or update missing dependencies',
      compatibility: 'Update to compatible versions',
      provider: 'Check provider status and fallback options',
      internal: 'Investigate system logs and restart if needed',
      policy: 'Review policy settings or request quota increase',
      unknown: 'Investigate error details and categorize',
    };
    
    return actions[category];
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 提取错误信息
   */
  private extractErrorMessage(eventOrError: any): string {
    if (typeof eventOrError === 'string') {
      return eventOrError;
    }
    
    if (eventOrError instanceof Error) {
      return eventOrError.message;
    }
    
    if (eventOrError.errorMessage) {
      return eventOrError.errorMessage;
    }
    
    if (eventOrError.error) {
      if (typeof eventOrError.error === 'string') {
        return eventOrError.error;
      }
      if (eventOrError.error.message) {
        return eventOrError.error.message;
      }
    }
    
    if (eventOrError.reason) {
      return eventOrError.reason;
    }
    
    return JSON.stringify(eventOrError);
  }
  
  /**
   * 生成失败 ID
   */
  private generateFailureId(): string {
    return `failure_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建失败分类器
 */
export function createFailureTaxonomy(): FailureTaxonomy {
  return new FailureTaxonomy();
}

/**
 * 快速分类失败
 */
export function classifyFailure(eventOrError: any): UnifiedFailureCategory {
  const taxonomy = new FailureTaxonomy();
  return taxonomy.classifyFailure(eventOrError);
}

/**
 * 快速构建失败记录
 */
export function buildFailureRecord(
  event: any,
  errorMessage: string,
  rootCause?: string
): FailureRecord {
  const taxonomy = new FailureTaxonomy();
  return taxonomy.buildFailureRecord(event, errorMessage, rootCause);
}
