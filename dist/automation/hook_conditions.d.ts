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
import type { AutomationCondition, AutomationEvent, ConditionEvaluationResult, AutomationExecutionContext } from './types';
/**
 * 解析字段路径
 */
export declare function resolveField(path: string, event: AutomationEvent, context: AutomationExecutionContext): any;
/**
 * 评估单个条件
 */
export declare function evaluateCondition(condition: AutomationCondition, event: AutomationEvent, context: AutomationExecutionContext): ConditionEvaluationResult;
/**
 * 评估多个条件
 */
export declare function evaluateConditions(conditions: AutomationCondition[], event: AutomationEvent, context: AutomationExecutionContext): {
    allMatched: boolean;
    anyMatched: boolean;
    results: ConditionEvaluationResult[];
};
/**
 * 快速检查条件是否匹配
 */
export declare function isConditionMatched(condition: AutomationCondition, event: AutomationEvent, context: AutomationExecutionContext): boolean;
/**
 * 快速检查所有条件是否匹配
 */
export declare function areAllConditionsMatched(conditions: AutomationCondition[], event: AutomationEvent, context: AutomationExecutionContext): boolean;
