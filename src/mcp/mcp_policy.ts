/**
 * MCP Policy - MCP 权限策略
 * 
 * 职责：
 * 1. 定义 MCP 权限模型
 * 2. server / tool / resource 权限规则
 * 3. 与 PermissionEngine 对接
 * 4. 输出标准化 policy decision
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type {
  McpPolicyRule,
  McpPolicyDecision,
  McpPolicyAction,
  McpPolicyEffect,
  McpPolicyScope,
  McpAccessContext,
} from './types';
import { normalizeServerName, extractServerName } from './mcp_naming';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 策略配置
 */
export interface McpPolicyConfig {
  /** 默认效果 */
  defaultEffect?: McpPolicyEffect;
}

// ============================================================================
// MCP 策略
// ============================================================================

export class McpPolicy {
  private config: Required<McpPolicyConfig>;
  private rules: Map<string, McpPolicyRule> = new Map();
  
  constructor(config: McpPolicyConfig = {}) {
    this.config = {
      defaultEffect: config.defaultEffect ?? 'ask',
    };
  }
  
  /**
   * 添加规则
   */
  addRule(rule: McpPolicyRule): void {
    this.rules.set(rule.id, rule);
  }
  
  /**
   * 移除规则
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }
  
  /**
   * 获取所有规则
   */
  getRules(): McpPolicyRule[] {
    return Array.from(this.rules.values());
  }
  
  /**
   * 评估访问权限
   */
  evaluate(context: McpAccessContext): McpPolicyDecision {
    // 获取所有匹配规则
    const matchedRules = this.findMatchedRules(context);
    
    // 按优先级排序
    matchedRules.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    
    // 取最高优先级规则
    const winner = matchedRules[0];
    
    if (!winner) {
      // 无匹配规则 → 默认效果
      return {
        effect: this.config.defaultEffect,
        scope: context.serverId ? 'server' : 'tool',
        target: context.serverId || context.capabilityName || 'unknown',
        action: context.action,
        reason: 'No matching rule; using default policy',
        requiresApproval: this.config.defaultEffect === 'ask',
      };
    }
    
    // 构建决策
    return {
      effect: winner.effect,
      scope: winner.scope,
      target: winner.target,
      action: this.normalizeAction(context.action, winner.action),
      matchedRuleId: winner.id,
      reason: winner.reason || `Matched rule: ${winner.id}`,
      requiresApproval: winner.effect === 'ask',
    };
  }
  
  /**
   * 检查 Server 访问权限
   */
  checkServerAccess(serverId: string, action: McpPolicyAction = 'server.connect'): McpPolicyDecision {
    return this.evaluate({
      agentId: 'system',
      sessionId: 'system',
      serverId: normalizeServerName(serverId),
      action,
    });
  }
  
  /**
   * 检查 Tool 访问权限
   */
  checkToolAccess(
    qualifiedToolName: string,
    agentId: string,
    sessionId: string
  ): McpPolicyDecision {
    const serverId = extractServerName(qualifiedToolName);
    
    return this.evaluate({
      agentId,
      sessionId,
      serverId: serverId || 'unknown',
      capabilityName: qualifiedToolName,
      action: 'tool.invoke',
    });
  }
  
  /**
   * 检查 Resource 访问权限
   */
  checkResourceAccess(
    qualifiedResourceName: string,
    action: 'read' | 'write' | 'search',
    agentId: string,
    sessionId: string
  ): McpPolicyDecision {
    const serverId = extractServerName(qualifiedResourceName);
    
    const policyAction: McpPolicyAction = `resource.${action}`;
    
    return this.evaluate({
      agentId,
      sessionId,
      serverId: serverId || 'unknown',
      capabilityName: qualifiedResourceName,
      action: policyAction,
    });
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 查找匹配规则
   */
  private findMatchedRules(context: McpAccessContext): McpPolicyRule[] {
    const matched: McpPolicyRule[] = [];
    
    for (const rule of this.rules.values()) {
      if (this.ruleMatches(rule, context)) {
        matched.push(rule);
      }
    }
    
    return matched;
  }
  
  /**
   * 检查规则是否匹配
   */
  private ruleMatches(rule: McpPolicyRule, context: McpAccessContext): boolean {
    // 检查范围匹配
    if (!this.scopeMatches(rule.scope, context)) {
      return false;
    }
    
    // 检查目标匹配
    if (!this.targetMatches(rule.target, context)) {
      return false;
    }
    
    // 检查动作匹配
    if (!this.actionMatches(rule.action, context.action)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * 检查范围匹配
   */
  private scopeMatches(scope: McpPolicyScope, context: McpAccessContext): boolean {
    switch (scope) {
      case 'server':
        return true; // Server 规则适用于所有该 Server 的请求
      case 'tool':
        return context.action === 'tool.invoke';
      case 'resource':
        return ['resource.read', 'resource.write', 'resource.search'].includes(context.action);
      default:
        return false;
    }
  }
  
  /**
   * 检查目标匹配
   */
  private targetMatches(target: string, context: McpAccessContext): boolean {
    const normalizedTarget = normalizeServerName(target);
    
    // 精确匹配
    if (normalizedTarget === normalizeServerName(context.serverId)) {
      return true;
    }
    
    // 通配符匹配
    if (target.includes('*')) {
      const pattern = new RegExp('^' + target.replace(/\*/g, '.*') + '$');
      return pattern.test(context.serverId);
    }
    
    // Capability 匹配
    if (context.capabilityName) {
      if (target === context.capabilityName) {
        return true;
      }
      
      // 限定名称匹配
      if (context.capabilityName.startsWith(target + '__')) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * 检查动作匹配
   */
  private actionMatches(
    ruleAction: McpPolicyAction | McpPolicyAction[],
    contextAction: McpPolicyAction
  ): boolean {
    if (Array.isArray(ruleAction)) {
      return ruleAction.includes(contextAction);
    }
    
    // 精确匹配
    if (ruleAction === contextAction) {
      return true;
    }
    
    // server.connect 匹配所有动作
    if (ruleAction === 'server.connect') {
      return true;
    }
    
    // resource.* 匹配所有 resource 动作
    if (ruleAction.startsWith('resource.') && contextAction.startsWith('resource.')) {
      if (ruleAction === 'resource.*') {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * 规范化动作
   */
  private normalizeAction(
    contextAction: McpPolicyAction,
    ruleAction: McpPolicyAction | McpPolicyAction[]
  ): McpPolicyAction {
    if (Array.isArray(ruleAction)) {
      return contextAction;
    }
    return ruleAction;
  }
}

// ============================================================================
// 预定义策略
// ============================================================================

/**
 * 创建宽松策略（默认允许）
 */
export function createPermissivePolicy(): McpPolicy {
  const policy = new McpPolicy({ defaultEffect: 'allow' });
  return policy;
}

/**
 * 创建严格策略（默认拒绝）
 */
export function createRestrictivePolicy(): McpPolicy {
  const policy = new McpPolicy({ defaultEffect: 'deny' });
  return policy;
}

/**
 * 创建保守策略（默认询问）
 */
export function createConservativePolicy(): McpPolicy {
  const policy = new McpPolicy({ defaultEffect: 'ask' });
  return policy;
}

/**
 * 创建默认 MCP 策略（带预定义规则）
 */
export function createDefaultMcpPolicy(): McpPolicy {
  const policy = new McpPolicy({ defaultEffect: 'ask' });
  
  // 添加默认规则
  policy.addRule({
    id: 'default-server-connect',
    scope: 'server',
    target: '*',
    action: 'server.connect',
    effect: 'ask',
    reason: 'New server connection requires approval',
    priority: 1,
    createdAt: Date.now(),
  });
  
  policy.addRule({
    id: 'default-tool-invoke',
    scope: 'tool',
    target: '*',
    action: 'tool.invoke',
    effect: 'allow',
    reason: 'Tool invocation allowed by default',
    priority: 0,
    createdAt: Date.now(),
  });
  
  policy.addRule({
    id: 'default-resource-read',
    scope: 'resource',
    target: '*',
    action: 'resource.read',
    effect: 'allow',
    reason: 'Resource read allowed by default',
    priority: 0,
    createdAt: Date.now(),
  });
  
  policy.addRule({
    id: 'default-resource-write',
    scope: 'resource',
    target: '*',
    action: 'resource.write',
    effect: 'ask',
    reason: 'Resource write requires approval',
    priority: 0,
    createdAt: Date.now(),
  });
  
  return policy;
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建 MCP 策略
 */
export function createMcpPolicy(config?: McpPolicyConfig): McpPolicy {
  return new McpPolicy(config);
}
