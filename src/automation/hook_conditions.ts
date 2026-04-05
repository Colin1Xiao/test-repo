/**
 * Hook Conditions - 条件表达式评估
 * 
 * 职责：
 * 1. 解析 condition
 * 2. 对 event + context 做条件判断
 * 3. 返回结构化结果，而不是布尔黑箱
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type {
  AutomationCondition,
  AutomationEvent,
  ConditionEvaluationResult,
  AutomationExecutionContext,
  ComparisonOperator,
} from './types';

// ============================================================================
// 字段解析
// ============================================================================

/**
 * 解析字段路径
 */
export function resolveField(
  path: string,
  event: AutomationEvent,
  context: AutomationExecutionContext
): any {
  // 支持的路径前缀
  const resolvers: Record<string, () => any> = {
    'event.type': () => event.type,
    'event.severity': () => event.severity,
    'event.timestamp': () => event.timestamp,
    'event.taskId': () => event.taskId,
    'event.agentId': () => event.agentId,
    'event.sessionId': () => event.sessionId,
    'event.sourceRuleId': () => event.sourceRuleId,
    'task.status': () => event.payload.task?.status,
    'task.risk': () => event.payload.task?.risk,
    'task.riskLevel': () => event.payload.task?.riskLevel,
    'task.retryCount': () => event.payload.task?.retryCount,
    'task.description': () => event.payload.task?.description,
    'agent.role': () => event.payload.agent?.role,
    'agent.id': () => event.payload.agent?.id,
    'server.health': () => event.payload.server?.health,
    'server.name': () => event.payload.server?.name,
    'server.status': () => event.payload.server?.status,
    'budget.remaining': () => event.payload.budget?.remaining,
    'budget.total': () => event.payload.budget?.total,
    'budget.used': () => event.payload.budget?.used,
    'approval.ageMinutes': () => event.payload.approval?.ageMinutes,
    'approval.status': () => event.payload.approval?.status,
    'approval.requestedBy': () => event.payload.approval?.requestedBy,
  };
  
  // 检查是否是已知路径
  if (resolvers[path]) {
    return resolvers[path]();
  }
  
  // 检查是否是 event.payload.* 路径
  if (path.startsWith('event.payload.')) {
    const payloadPath = path.slice('event.payload.'.length);
    return getNestedValue(event.payload, payloadPath);
  }
  
  // 检查是否是 context 路径
  if (path.startsWith('context.')) {
    const contextPath = path.slice('context.'.length);
    return getNestedValue(context.contextData, contextPath);
  }
  
  // 未知路径返回 undefined
  return undefined;
}

/**
 * 获取嵌套值
 */
function getNestedValue(obj: any, path: string): any {
  if (!obj || typeof obj !== 'object') {
    return undefined;
  }
  
  const parts = path.split('.');
  let current = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[part];
  }
  
  return current;
}

// ============================================================================
// 条件评估
// ============================================================================

/**
 * 评估单个条件
 */
export function evaluateCondition(
  condition: AutomationCondition,
  event: AutomationEvent,
  context: AutomationExecutionContext
): ConditionEvaluationResult {
  try {
    switch (condition.type) {
      case 'field':
        return evaluateFieldCondition(condition, event, context);
      
      case 'regex':
        return evaluateRegexCondition(condition, event, context);
      
      case 'threshold':
        return evaluateThresholdCondition(condition, event, context);
      
      case 'custom':
        return evaluateCustomCondition(condition, event, context);
      
      default:
        return {
          matched: false,
          conditionId: condition.description,
          reason: `Unknown condition type: ${condition.type}`,
        };
    }
  } catch (error) {
    return {
      matched: false,
      conditionId: condition.description,
      leftValue: undefined,
      rightValue: condition.value,
      reason: `Condition evaluation error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * 评估字段条件
 */
function evaluateFieldCondition(
  condition: AutomationCondition,
  event: AutomationEvent,
  context: AutomationExecutionContext
): ConditionEvaluationResult {
  const leftValue = resolveField(condition.field || '', event, context);
  const rightValue = condition.value;
  const operator = condition.operator || 'eq';
  
  const matched = compareValues(leftValue, rightValue, operator);
  
  return {
    matched,
    conditionId: condition.description,
    leftValue,
    rightValue,
    reason: matched
      ? `Condition matched: ${leftValue} ${operator} ${rightValue}`
      : `Condition not matched: ${leftValue} ${operator} ${rightValue}`,
  };
}

/**
 * 评估正则条件
 */
function evaluateRegexCondition(
  condition: AutomationCondition,
  event: AutomationEvent,
  context: AutomationExecutionContext
): ConditionEvaluationResult {
  const leftValue = resolveField(condition.field || '', event, context);
  const pattern = condition.value;
  
  if (typeof leftValue !== 'string') {
    return {
      matched: false,
      conditionId: condition.description,
      leftValue,
      rightValue: pattern,
      reason: `Regex condition requires string value, got ${typeof leftValue}`,
    };
  }
  
  try {
    const regex = new RegExp(pattern);
    const matched = regex.test(leftValue);
    
    return {
      matched,
      conditionId: condition.description,
      leftValue,
      rightValue: pattern,
      reason: matched
        ? `Regex matched: ${leftValue} matches ${pattern}`
        : `Regex not matched: ${leftValue} does not match ${pattern}`,
    };
  } catch (error) {
    return {
      matched: false,
      conditionId: condition.description,
      leftValue,
      rightValue: pattern,
      reason: `Invalid regex pattern: ${pattern}`,
    };
  }
}

/**
 * 评估阈值条件
 */
function evaluateThresholdCondition(
  condition: AutomationCondition,
  event: AutomationEvent,
  context: AutomationExecutionContext
): ConditionEvaluationResult {
  const leftValue = resolveField(condition.field || '', event, context);
  const threshold = condition.value;
  
  if (typeof leftValue !== 'number') {
    return {
      matched: false,
      conditionId: condition.description,
      leftValue,
      rightValue: threshold,
      reason: `Threshold condition requires number value, got ${typeof leftValue}`,
    };
  }
  
  const matched = leftValue >= threshold;
  
  return {
    matched,
    conditionId: condition.description,
    leftValue,
    rightValue: threshold,
    reason: matched
      ? `Threshold exceeded: ${leftValue} >= ${threshold}`
      : `Threshold not exceeded: ${leftValue} < ${threshold}`,
  };
}

/**
 * 评估自定义条件
 */
function evaluateCustomCondition(
  condition: AutomationCondition,
  event: AutomationEvent,
  context: AutomationExecutionContext
): ConditionEvaluationResult {
  const expression = condition.expression;
  
  if (!expression) {
    return {
      matched: false,
      conditionId: condition.description,
      reason: 'Custom condition missing expression',
    };
  }
  
  try {
    // 简化实现：实际应该使用更安全的表达式评估
    // 这里仅做演示
    const evalContext = {
      event,
      context: context.contextData,
      resolveField: (path: string) => resolveField(path, event, context),
    };
    
    // 注意：实际实现中应该使用安全的表达式评估库
    // 而不是直接 eval
    const result = new Function('ctx', `with(ctx) { return ${expression} }`)(evalContext);
    
    return {
      matched: !!result,
      conditionId: condition.description,
      reason: result
        ? `Custom condition evaluated to true`
        : `Custom condition evaluated to false`,
    };
  } catch (error) {
    return {
      matched: false,
      conditionId: condition.description,
      reason: `Custom condition evaluation error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * 比较值
 */
function compareValues(
  left: any,
  right: any,
  operator: ComparisonOperator
): boolean {
  switch (operator) {
    case 'eq':
      return left === right;
    
    case 'ne':
      return left !== right;
    
    case 'gt':
      return left > right;
    
    case 'gte':
      return left >= right;
    
    case 'lt':
      return left < right;
    
    case 'lte':
      return left <= right;
    
    case 'contains':
      if (typeof left === 'string' && typeof right === 'string') {
        return left.includes(right);
      }
      if (Array.isArray(left)) {
        return left.includes(right);
      }
      return false;
    
    case 'in':
      if (Array.isArray(right)) {
        return right.includes(left);
      }
      return false;
    
    case 'exists':
      return left !== null && left !== undefined;
    
    case 'regex':
      if (typeof left === 'string') {
        try {
          return new RegExp(right).test(left);
        } catch {
          return false;
        }
      }
      return false;
    
    case 'startswith':
      if (typeof left === 'string' && typeof right === 'string') {
        return left.startsWith(right);
      }
      return false;
    
    case 'endswith':
      if (typeof left === 'string' && typeof right === 'string') {
        return left.endsWith(right);
      }
      return false;
    
    default:
      return false;
  }
}

// ============================================================================
// 批量条件评估
// ============================================================================

/**
 * 评估多个条件
 */
export function evaluateConditions(
  conditions: AutomationCondition[],
  event: AutomationEvent,
  context: AutomationExecutionContext
): {
  allMatched: boolean;
  anyMatched: boolean;
  results: ConditionEvaluationResult[];
} {
  const results: ConditionEvaluationResult[] = [];
  
  for (const condition of conditions) {
    const result = evaluateCondition(condition, event, context);
    results.push(result);
  }
  
  const allMatched = results.length > 0 && results.every(r => r.matched);
  const anyMatched = results.length > 0 && results.some(r => r.matched);
  
  return {
    allMatched: conditions.length === 0 ? true : allMatched, // 无条件视为匹配
    anyMatched,
    results,
  };
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 快速检查条件是否匹配
 */
export function isConditionMatched(
  condition: AutomationCondition,
  event: AutomationEvent,
  context: AutomationExecutionContext
): boolean {
  const result = evaluateCondition(condition, event, context);
  return result.matched;
}

/**
 * 快速检查所有条件是否匹配
 */
export function areAllConditionsMatched(
  conditions: AutomationCondition[],
  event: AutomationEvent,
  context: AutomationExecutionContext
): boolean {
  const { allMatched } = evaluateConditions(conditions, event, context);
  return allMatched;
}
