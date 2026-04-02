/**
 * PermissionEngine - 权限规则引擎
 * 
 * 核心能力：
 * - 多来源规则合并
 * - 优先级排序
 * - 决策原因解释
 * - 危险命令检测
 * - shadowed rules 检测
 */

import {
  PermissionRule,
  PermissionCheckInput,
  PermissionDecision,
  PermissionBehavior,
  DANGEROUS_PATTERNS,
  SOURCE_PRIORITY,
  DEFAULT_SYSTEM_RULES,
} from './permission_types';

/** 匹配器接口 */
interface PatternMatcher {
  matches(pattern: string, target: string): boolean;
}

/** 简单通配符匹配器（支持 * 和 **） */
class WildcardMatcher implements PatternMatcher {
  matches(pattern: string, target: string): boolean {
    // 转义特殊字符
    const escaped = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    
    const regex = new RegExp(`^${escaped}$`);
    return regex.test(target);
  }
}

/** 前缀匹配器 */
class PrefixMatcher implements PatternMatcher {
  matches(pattern: string, target: string): boolean {
    return target.startsWith(pattern);
  }
}

/** 精确匹配器 */
class ExactMatcher implements PatternMatcher {
  matches(pattern: string, target: string): boolean {
    return pattern === target;
  }
}

/** 权限引擎实现 */
export class PermissionEngine {
  private rules: PermissionRule[];
  private wildcardMatcher: WildcardMatcher = new WildcardMatcher();

  constructor(rules: PermissionRule[] = []) {
    // 合并默认规则 + 自定义规则
    this.rules = [...DEFAULT_SYSTEM_RULES, ...rules];
  }

  /**
   * 评估权限
   */
  evaluate(input: PermissionCheckInput): PermissionDecision {
    // 1. 检查危险命令
    if (input.tool === 'exec.run' && input.target) {
      for (const pattern of DANGEROUS_PATTERNS) {
        if (this.matchesDangerousPattern(pattern, input.target)) {
          return {
            allowed: false,
            behavior: 'deny',
            requiresApproval: false,
            explanation: `Blocked: matches dangerous pattern "${pattern}"`,
          };
        }
      }
    }

    // 2. 查找所有匹配规则
    const matches = this.rules.filter(rule => this.matches(rule, input));

    // 3. 按优先级排序
    matches.sort((a, b) => {
      const priorityA = a.priority ?? SOURCE_PRIORITY[a.source];
      const priorityB = b.priority ?? SOURCE_PRIORITY[b.source];
      return priorityB - priorityA;
    });

    // 4. 取最高优先级规则
    const winner = matches[0];

    if (!winner) {
      // 无匹配规则 → 默认需要审批
      return {
        allowed: false,
        behavior: 'ask',
        requiresApproval: true,
        explanation: 'No matching rule; approval required by default',
      };
    }

    // 5. 生成决策
    return this.createDecision(winner);
  }

  /**
   * 添加规则
   */
  addRule(rule: PermissionRule): void {
    this.rules.push(rule);
  }

  /**
   * 移除规则
   */
  removeRule(rule: PermissionRule): void {
    const index = this.rules.indexOf(rule);
    if (index >= 0) {
      this.rules.splice(index, 1);
    }
  }

  /**
   * 获取所有规则（用于调试）
   */
  getRules(): PermissionRule[] {
    return [...this.rules];
  }

  /**
   * 检测 shadowed rules（被覆盖的规则）
   */
  detectShadowedRules(): { rule: PermissionRule; shadowedBy: PermissionRule }[] {
    const shadowed: { rule: PermissionRule; shadowedBy: PermissionRule }[] = [];

    for (let i = 0; i < this.rules.length; i++) {
      for (let j = i + 1; j < this.rules.length; j++) {
        const a = this.rules[i];
        const b = this.rules[j];

        // 如果两条规则针对同一工具，且优先级不同
        if (a.tool === b.tool && a.source !== b.source) {
          const priorityA = a.priority ?? SOURCE_PRIORITY[a.source];
          const priorityB = b.priority ?? SOURCE_PRIORITY[b.source];

          // 低优先级的规则可能被高优先级覆盖
          if (priorityA < priorityB && a.pattern === b.pattern) {
            shadowed.push({ rule: a, shadowedBy: b });
          }
        }
      }
    }

    return shadowed;
  }

  /**
   * 匹配规则
   */
  private matches(rule: PermissionRule, input: PermissionCheckInput): boolean {
    // 工具名称必须匹配
    if (rule.tool !== input.tool) {
      // 支持 mcp__* 通配符
      if (rule.tool.endsWith('*')) {
        if (!this.wildcardMatcher.matches(rule.tool, input.tool)) {
          return false;
        }
      } else {
        return false;
      }
    }

    // 模式匹配（用于 exec command）
    if (rule.pattern && input.target) {
      if (!this.wildcardMatcher.matches(rule.pattern, input.target)) {
        return false;
      }
    }

    // 工作区路径范围
    if (rule.pathScope && input.cwd) {
      if (!input.cwd.startsWith(rule.pathScope)) {
        return false;
      }
    }

    // MCP server 范围
    if (rule.mcpServer && input.payload) {
      const payload = input.payload as any;
      if (payload.mcpServer !== rule.mcpServer) {
        return false;
      }
    }

    // 过期检查
    if (rule.expiresAt && Date.now() > rule.expiresAt) {
      return false;
    }

    return true;
  }

  /**
   * 匹配危险命令模式
   */
  private matchesDangerousPattern(pattern: string, command: string): boolean {
    // 简化实现：支持 * 通配符
    const regex = new RegExp(
      pattern.replace(/\*/g, '.*').replace(/ /g, '\\s+'),
      'i'
    );
    return regex.test(command);
  }

  /**
   * 创建决策
   */
  private createDecision(rule: PermissionRule): PermissionDecision {
    const explanation = this.generateExplanation(rule);

    return {
      allowed: rule.behavior === 'allow',
      behavior: rule.behavior,
      matchedRule: rule,
      requiresApproval: rule.behavior === 'ask',
      explanation,
    };
  }

  /**
   * 生成人类可解释的原因
   */
  private generateExplanation(rule: PermissionRule): string {
    const parts: string[] = [];

    // 行为说明
    switch (rule.behavior) {
      case 'allow':
        parts.push('Allowed');
        break;
      case 'deny':
        parts.push('Denied');
        break;
      case 'ask':
        parts.push('Approval required');
        break;
    }

    // 来源说明
    parts.push(`by ${rule.source} rule`);

    // 原因说明
    if (rule.reason) {
      parts.push(`: ${rule.reason}`);
    }

    return parts.join(' ');
  }
}

// ============================================================================
// 使用示例
// ============================================================================

/**
 * 创建权限引擎并添加自定义规则：
 * 
 * const engine = new PermissionEngine([
 *   {
 *     source: 'workspace',
 *     behavior: 'allow',
 *     tool: 'exec.run',
 *     pattern: 'npm *',
 *     reason: 'NPM commands are allowed in this workspace',
 *   },
 *   {
 *     source: 'workspace',
 *     behavior: 'deny',
 *     tool: 'exec.run',
 *     pattern: 'git push *',
 *     reason: 'Git push requires explicit approval',
 *   },
 * ]);
 * 
 * // 检查权限
 * const decision = engine.evaluate({
 *   tool: 'exec.run',
 *   target: 'npm install',
 * });
 * 
 * console.log(decision.explanation);
 * // 输出：Allowed by workspace rule: NPM commands are allowed in this workspace
 */
