/**
 * Hook Rules - 规则调度层
 * 
 * 职责：
 * 1. 注册规则
 * 2. 根据 event 选规则
 * 3. 按 priority 排序
 * 4. 判定 enabled / cooldown / stopOnMatch
 * 5. 调用 conditions + actions 执行完整链路
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type {
  AutomationRule,
  AutomationEvent,
  RuleMatchResult,
  RuleExecutionResult,
  AutomationExecutionContext,
  AutomationExecutionSummary,
  ActionExecutionResult,
} from './types';
import { evaluateConditions } from './hook_conditions';
import { ActionExecutor, executeActions, buildActionContext } from './hook_actions';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 规则执行器配置
 */
export interface RuleExecutorConfig {
  /** 最大执行深度 */
  maxChainDepth?: number;
  
  /** 默认冷却时间（毫秒） */
  defaultCooldownMs?: number;
}

/**
 * 规则触发追踪
 */
interface RuleTriggerTracking {
  /** 最后触发时间 */
  lastTriggeredAt: number;
  
  /** 触发次数 */
  triggerCount: number;
}

// ============================================================================
// 规则执行器
// ============================================================================

export class RuleExecutor {
  private config: Required<RuleExecutorConfig>;
  private rules: Map<string, AutomationRule> = new Map();
  private triggerTracking: Map<string, RuleTriggerTracking> = new Map();
  private actionExecutor: ActionExecutor;
  
  constructor(config: RuleExecutorConfig = {}) {
    this.config = {
      maxChainDepth: config.maxChainDepth ?? 5,
      defaultCooldownMs: config.defaultCooldownMs ?? 60000, // 默认 1 分钟
    };
    this.actionExecutor = new ActionExecutor();
  }
  
  /**
   * 注册规则
   */
  registerRule(rule: AutomationRule): void {
    this.rules.set(rule.id, rule);
    this.triggerTracking.set(rule.id, {
      lastTriggeredAt: 0,
      triggerCount: 0,
    });
  }
  
  /**
   * 注销规则
   */
  unregisterRule(ruleId: string): boolean {
    const deleted = this.rules.delete(ruleId);
    this.triggerTracking.delete(ruleId);
    return deleted;
  }
  
  /**
   * 启用规则
   */
  enableRule(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = true;
      return true;
    }
    return false;
  }
  
  /**
   * 禁用规则
   */
  disableRule(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = false;
      return true;
    }
    return false;
  }
  
  /**
   * 获取规则
   */
  getRule(ruleId: string): AutomationRule | null {
    return this.rules.get(ruleId) || null;
  }
  
  /**
   * 获取所有规则
   */
  getAllRules(): AutomationRule[] {
    return Array.from(this.rules.values());
  }
  
  /**
   * 匹配规则
   */
  matchRules(
    event: AutomationEvent,
    context?: Partial<AutomationExecutionContext>
  ): RuleMatchResult[] {
    const matchedResults: RuleMatchResult[] = [];
    const now = Date.now();
    
    // 构建上下文
    const execContext: AutomationExecutionContext = {
      event,
      matchedRules: [],
      executedActions: [],
      chainDepth: context?.chainDepth || 0,
      maxChainDepth: this.config.maxChainDepth,
      contextData: context?.contextData || {},
    };
    
    // 获取所有启用的规则
    const enabledRules = Array.from(this.rules.values()).filter(rule => rule.enabled);
    
    // 按优先级排序（从高到低）
    enabledRules.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    
    for (const rule of enabledRules) {
      // 检查事件类型是否匹配
      if (!rule.events.includes(event.type)) {
        continue;
      }
      
      // 检查冷却时间
      const tracking = this.triggerTracking.get(rule.id);
      if (tracking) {
        const cooldownMs = rule.cooldownMs ?? this.config.defaultCooldownMs;
        const timeSinceLastTrigger = now - tracking.lastTriggeredAt;
        
        if (timeSinceLastTrigger < cooldownMs) {
          matchedResults.push({
            rule,
            matched: false,
            conditionResults: [],
            matchedAt: now,
            isCooldown: true,
          });
          continue;
        }
        
        // 检查最大触发次数
        if (rule.maxTriggerCount && tracking.triggerCount >= rule.maxTriggerCount) {
          matchedResults.push({
            rule,
            matched: false,
            conditionResults: [],
            matchedAt: now,
            isMaxTriggered: true,
          });
          continue;
        }
      }
      
      // 评估条件
      const { allMatched, results: conditionResults } = evaluateConditions(
        rule.conditions,
        event,
        execContext
      );
      
      matchedResults.push({
        rule,
        matched: allMatched,
        conditionResults,
        matchedAt: now,
      });
    }
    
    return matchedResults;
  }
  
  /**
   * 执行匹配的规则
   */
  async executeMatchingRules(
    event: AutomationEvent,
    context?: Partial<AutomationExecutionContext>
  ): Promise<AutomationExecutionSummary> {
    const startTime = Date.now();
    const matchedResults = this.matchRules(event, context);
    
    const executedResults: RuleExecutionResult[] = [];
    let executedActionsCount = 0;
    
    // 构建上下文
    const execContext: AutomationExecutionContext = {
      event,
      matchedRules: matchedResults.filter(r => r.matched),
      executedActions: [],
      chainDepth: context?.chainDepth || 0,
      maxChainDepth: this.config.maxChainDepth,
      contextData: context?.contextData || {},
    };
    
    // 检查执行深度
    if (execContext.chainDepth >= execContext.maxChainDepth) {
      return {
        eventType: event.type,
        matchedRules: matchedResults.filter(r => r.matched).length,
        executedRules: 0,
        executedActions: 0,
        results: [],
        executionTimeMs: Date.now() - startTime,
      };
    }
    
    // 执行匹配的规则
    for (const matchResult of matchedResults) {
      if (!matchResult.matched) {
        continue;
      }
      
      const rule = matchResult.rule;
      const ruleStartTime = Date.now();
      
      try {
        // 执行动作
        const actionResults = await executeActions(
          rule.actions,
          event,
          execContext,
          this.actionExecutor
        );
        
        // 更新追踪
        const tracking = this.triggerTracking.get(rule.id);
        if (tracking) {
          tracking.lastTriggeredAt = Date.now();
          tracking.triggerCount++;
        }
        
        // 记录执行结果
        executedResults.push({
          ruleId: rule.id,
          success: actionResults.every(r => r.status === 'success'),
          actionResults,
          executionTimeMs: Date.now() - ruleStartTime,
        });
        
        executedActionsCount += actionResults.length;
        
        // 更新上下文
        execContext.executedActions.push(...actionResults);
        
        // 检查 stopOnMatch
        if (rule.stopOnMatch) {
          break;
        }
        
      } catch (error) {
        executedResults.push({
          ruleId: rule.id,
          success: false,
          actionResults: [],
          executionTimeMs: Date.now() - ruleStartTime,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    
    return {
      eventType: event.type,
      matchedRules: matchedResults.filter(r => r.matched).length,
      executedRules: executedResults.length,
      executedActions: executedActionsCount,
      results: executedResults,
      executionTimeMs: Date.now() - startTime,
    };
  }
  
  /**
   * 重置规则触发追踪
   */
  resetRuleTracking(ruleId: string): void {
    const tracking = this.triggerTracking.get(ruleId);
    if (tracking) {
      tracking.lastTriggeredAt = 0;
      tracking.triggerCount = 0;
    }
  }
  
  /**
   * 获取规则触发统计
   */
  getRuleTracking(ruleId: string): RuleTriggerTracking | null {
    return this.triggerTracking.get(ruleId) || null;
  }
  
  /**
   * 获取所有规则统计
   */
  getAllTracking(): Record<string, RuleTriggerTracking> {
    const result: Record<string, RuleTriggerTracking> = {};
    for (const [ruleId, tracking] of this.triggerTracking.entries()) {
      result[ruleId] = { ...tracking };
    }
    return result;
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建规则执行器
 */
export function createRuleExecutor(config?: RuleExecutorConfig): RuleExecutor {
  return new RuleExecutor(config);
}

/**
 * 快速执行规则
 */
export async function executeRules(
  event: AutomationEvent,
  rules: AutomationRule[],
  config?: RuleExecutorConfig
): Promise<AutomationExecutionSummary> {
  const executor = new RuleExecutor(config);
  
  // 注册所有规则
  for (const rule of rules) {
    executor.registerRule(rule);
  }
  
  return await executor.executeMatchingRules(event);
}
