/**
 * Skill Policy - Skill 策略决策
 * 
 * 职责：
 * 1. 根据 trust + validation + source + compatibility 做最终决策
 * 2. 决定 allow / ask / deny
 * 3. 决定能否 install / enable / load
 * 4. 与现有 PermissionEngine / ApprovalBridge 语义对齐
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type {
  SkillPackageDescriptor,
  SkillPolicyAction,
  SkillPolicyEffect,
  SkillPolicyDecision,
  SkillPolicyContext,
  SkillPolicyRule,
  SkillTrustLevel,
  SkillSourceType,
  SkillValidationResult,
} from './types';
import { SkillTrustEvaluator, evaluateSkillTrust } from './skill_trust';
import { SkillValidator } from './skill_validation';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 策略评估器配置
 */
export interface PolicyEvaluatorConfig {
  /** 默认规则 */
  defaultRules?: SkillPolicyRule[];
  
  /** 是否允许覆盖 */
  allowOverride?: boolean;
}

// ============================================================================
// 默认策略规则
// ============================================================================

const DEFAULT_POLICY_RULES: SkillPolicyRule[] = [
  // builtin skill - 允许所有动作
  {
    id: 'builtin-allow',
    name: 'Allow builtin skills',
    trustLevels: ['builtin'],
    actions: ['install', 'enable', 'load'],
    effect: 'allow',
    requiresApproval: false,
    description: 'Builtin skills are always allowed',
    priority: 100,
  },
  
  // verified skill - 允许安装和启用，加载需检查兼容性
  {
    id: 'verified-allow',
    name: 'Allow verified skills',
    trustLevels: ['verified'],
    actions: ['install', 'enable'],
    effect: 'allow',
    requiresApproval: false,
    description: 'Verified skills can be installed and enabled',
    priority: 90,
  },
  
  {
    id: 'verified-load',
    name: 'Load verified skills with compatibility check',
    trustLevels: ['verified'],
    actions: ['load'],
    effect: 'ask',
    requiresApproval: false,
    description: 'Verified skills require compatibility check for loading',
    priority: 90,
  },
  
  // workspace skill - 允许安装和启用
  {
    id: 'workspace-allow',
    name: 'Allow workspace skills',
    trustLevels: ['workspace'],
    actions: ['install', 'enable'],
    effect: 'allow',
    requiresApproval: false,
    description: 'Workspace skills can be installed and enabled',
    priority: 80,
  },
  
  {
    id: 'workspace-load',
    name: 'Load workspace skills with compatibility check',
    trustLevels: ['workspace'],
    actions: ['load'],
    effect: 'allow',
    requiresApproval: false,
    description: 'Workspace skills can be loaded with compatibility check',
    priority: 80,
  },
  
  // external skill - 需要审批
  {
    id: 'external-ask',
    name: 'Require approval for external skills',
    trustLevels: ['external'],
    actions: ['install', 'enable', 'load'],
    effect: 'ask',
    requiresApproval: true,
    description: 'External skills require approval',
    priority: 70,
  },
  
  // untrusted skill - 拒绝
  {
    id: 'untrusted-deny',
    name: 'Deny untrusted skills',
    trustLevels: ['untrusted'],
    actions: ['install', 'enable', 'load'],
    effect: 'deny',
    requiresApproval: true,
    description: 'Untrusted skills are denied by default',
    priority: 60,
  },
];

// ============================================================================
// Skill 策略评估器
// ============================================================================

export class SkillPolicyEvaluator {
  private config: Required<PolicyEvaluatorConfig>;
  private rules: SkillPolicyRule[];
  private trustEvaluator: SkillTrustEvaluator;
  
  constructor(config: PolicyEvaluatorConfig = {}) {
    this.config = {
      defaultRules: config.defaultRules ?? DEFAULT_POLICY_RULES,
      allowOverride: config.allowOverride ?? false,
    };
    this.rules = [...this.config.defaultRules];
    this.trustEvaluator = new SkillTrustEvaluator();
  }
  
  /**
   * 评估安装策略
   */
  evaluateInstallPolicy(
    pkg: SkillPackageDescriptor,
    context?: SkillPolicyContext,
    validation?: SkillValidationResult
  ): SkillPolicyDecision {
    return this.evaluatePolicy('install', pkg, context, validation);
  }
  
  /**
   * 评估启用策略
   */
  evaluateEnablePolicy(
    pkg: SkillPackageDescriptor,
    context?: SkillPolicyContext,
    validation?: SkillValidationResult
  ): SkillPolicyDecision {
    return this.evaluatePolicy('enable', pkg, context, validation);
  }
  
  /**
   * 评估加载策略
   */
  evaluateLoadPolicy(
    pkg: SkillPackageDescriptor,
    agentSpec: { id: string },
    context?: SkillPolicyContext,
    validation?: SkillValidationResult
  ): SkillPolicyDecision {
    return this.evaluatePolicy('load', pkg, context, validation);
  }
  
  /**
   * 评估策略
   */
  evaluatePolicy(
    action: SkillPolicyAction,
    pkg: SkillPackageDescriptor,
    context?: SkillPolicyContext,
    validation?: SkillValidationResult
  ): SkillPolicyDecision {
    // 获取信任摘要
    const trustSummary = this.trustEvaluator.evaluateTrust(pkg);
    
    // 检查兼容性
    const compatibilityOk = !validation || 
      validation.compatibilityIssues.filter(i => i.severity === 'high' || i.severity === 'critical').length === 0;
    
    // 查找匹配的规则
    const matchedRule = this.findMatchingRule(action, trustSummary.trustLevel, pkg.source);
    
    if (!matchedRule) {
      // 无匹配规则，默认拒绝
      return {
        action,
        effect: 'deny',
        reason: 'No matching policy rule found',
        requiresApproval: false,
        trustLevel: trustSummary.trustLevel,
        compatibilityOk,
      };
    }
    
    // 构建决策
    const decision: SkillPolicyDecision = {
      action,
      effect: matchedRule.effect,
      reason: matchedRule.description || `Matched rule: ${matchedRule.name}`,
      requiresApproval: matchedRule.requiresApproval ?? false,
      trustLevel: trustSummary.trustLevel,
      compatibilityOk,
      matchedRuleId: matchedRule.id,
    };
    
    // 兼容性检查可能覆盖决策
    if (!compatibilityOk && action === 'load') {
      decision.effect = 'deny';
      decision.reason = 'Compatibility issues prevent loading';
    }
    
    return decision;
  }
  
  /**
   * 查找匹配的规则
   */
  private findMatchingRule(
    action: SkillPolicyAction,
    trustLevel: SkillTrustLevel,
    source: SkillSourceType
  ): SkillPolicyRule | null {
    // 按优先级排序
    const sortedRules = [...this.rules].sort((a, b) => 
      (b.priority ?? 0) - (a.priority ?? 0)
    );
    
    for (const rule of sortedRules) {
      // 检查动作匹配
      if (rule.actions && !rule.actions.includes(action)) {
        continue;
      }
      
      // 检查信任级别匹配
      if (rule.trustLevels && !rule.trustLevels.includes(trustLevel)) {
        continue;
      }
      
      // 检查来源匹配
      if (rule.sourceTypes && !rule.sourceTypes.includes(source)) {
        continue;
      }
      
      // 找到匹配规则
      return rule;
    }
    
    return null;
  }
  
  /**
   * 添加规则
   */
  addRule(rule: SkillPolicyRule): void {
    this.rules.push(rule);
  }
  
  /**
   * 移除规则
   */
  removeRule(ruleId: string): boolean {
    const index = this.rules.findIndex(r => r.id === ruleId);
    if (index !== -1) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }
  
  /**
   * 获取所有规则
   */
  getRules(): SkillPolicyRule[] {
    return [...this.rules];
  }
  
  /**
   * 重置为默认规则
   */
  resetToDefaults(): void {
    this.rules = [...DEFAULT_POLICY_RULES];
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建策略评估器
 */
export function createSkillPolicyEvaluator(config?: PolicyEvaluatorConfig): SkillPolicyEvaluator {
  return new SkillPolicyEvaluator(config);
}

/**
 * 快速评估安装策略
 */
export function evaluateInstallPolicy(
  pkg: SkillPackageDescriptor,
  context?: SkillPolicyContext
): SkillPolicyDecision {
  const evaluator = new SkillPolicyEvaluator();
  return evaluator.evaluateInstallPolicy(pkg, context);
}

/**
 * 快速评估启用策略
 */
export function evaluateEnablePolicy(
  pkg: SkillPackageDescriptor,
  context?: SkillPolicyContext
): SkillPolicyDecision {
  const evaluator = new SkillPolicyEvaluator();
  return evaluator.evaluateEnablePolicy(pkg, context);
}

/**
 * 快速评估加载策略
 */
export function evaluateLoadPolicy(
  pkg: SkillPackageDescriptor,
  agentSpec: { id: string },
  context?: SkillPolicyContext
): SkillPolicyDecision {
  const evaluator = new SkillPolicyEvaluator();
  return evaluator.evaluateLoadPolicy(pkg, agentSpec, context);
}
