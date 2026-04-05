"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionEngine = void 0;
const permission_types_1 = require("./permission_types");
/** 简单通配符匹配器（支持 * 和 **） */
class WildcardMatcher {
    matches(pattern, target) {
        // 转义特殊字符
        const escaped = pattern
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*');
        const regex = new RegExp(`^${escaped}$`);
        return regex.test(target);
    }
}
/** 前缀匹配器 */
class PrefixMatcher {
    matches(pattern, target) {
        return target.startsWith(pattern);
    }
}
/** 精确匹配器 */
class ExactMatcher {
    matches(pattern, target) {
        return pattern === target;
    }
}
/** 权限引擎实现 */
class PermissionEngine {
    constructor(rules = []) {
        this.wildcardMatcher = new WildcardMatcher();
        // 合并默认规则 + 自定义规则
        this.rules = [...permission_types_1.DEFAULT_SYSTEM_RULES, ...rules];
    }
    /**
     * 评估权限
     */
    evaluate(input) {
        // 1. 检查危险命令
        if (input.tool === 'exec.run' && input.target) {
            for (const pattern of permission_types_1.DANGEROUS_PATTERNS) {
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
            const priorityA = a.priority ?? permission_types_1.SOURCE_PRIORITY[a.source];
            const priorityB = b.priority ?? permission_types_1.SOURCE_PRIORITY[b.source];
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
    addRule(rule) {
        this.rules.push(rule);
    }
    /**
     * 移除规则
     */
    removeRule(rule) {
        const index = this.rules.indexOf(rule);
        if (index >= 0) {
            this.rules.splice(index, 1);
        }
    }
    /**
     * 获取所有规则（用于调试）
     */
    getRules() {
        return [...this.rules];
    }
    /**
     * 检测 shadowed rules（被覆盖的规则）
     */
    detectShadowedRules() {
        const shadowed = [];
        for (let i = 0; i < this.rules.length; i++) {
            for (let j = i + 1; j < this.rules.length; j++) {
                const a = this.rules[i];
                const b = this.rules[j];
                // 如果两条规则针对同一工具，且优先级不同
                if (a.tool === b.tool && a.source !== b.source) {
                    const priorityA = a.priority ?? permission_types_1.SOURCE_PRIORITY[a.source];
                    const priorityB = b.priority ?? permission_types_1.SOURCE_PRIORITY[b.source];
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
    matches(rule, input) {
        // 工具名称必须匹配
        if (rule.tool !== input.tool) {
            // 支持 mcp__* 通配符
            if (rule.tool.endsWith('*')) {
                if (!this.wildcardMatcher.matches(rule.tool, input.tool)) {
                    return false;
                }
            }
            else {
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
            const payload = input.payload;
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
    matchesDangerousPattern(pattern, command) {
        // 简化实现：支持 * 通配符
        const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/ /g, '\\s+'), 'i');
        return regex.test(command);
    }
    /**
     * 创建决策
     */
    createDecision(rule) {
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
    generateExplanation(rule) {
        const parts = [];
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
exports.PermissionEngine = PermissionEngine;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGVybWlzc2lvbl9lbmdpbmUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJwZXJtaXNzaW9uX2VuZ2luZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7OztHQVNHOzs7QUFFSCx5REFRNEI7QUFPNUIsMEJBQTBCO0FBQzFCLE1BQU0sZUFBZTtJQUNuQixPQUFPLENBQUMsT0FBZSxFQUFFLE1BQWM7UUFDckMsU0FBUztRQUNULE1BQU0sT0FBTyxHQUFHLE9BQU87YUFDcEIsT0FBTyxDQUFDLG9CQUFvQixFQUFFLE1BQU0sQ0FBQzthQUNyQyxPQUFPLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBRXhCLE1BQU0sS0FBSyxHQUFHLElBQUksTUFBTSxDQUFDLElBQUksT0FBTyxHQUFHLENBQUMsQ0FBQztRQUN6QyxPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDNUIsQ0FBQztDQUNGO0FBRUQsWUFBWTtBQUNaLE1BQU0sYUFBYTtJQUNqQixPQUFPLENBQUMsT0FBZSxFQUFFLE1BQWM7UUFDckMsT0FBTyxNQUFNLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ3BDLENBQUM7Q0FDRjtBQUVELFlBQVk7QUFDWixNQUFNLFlBQVk7SUFDaEIsT0FBTyxDQUFDLE9BQWUsRUFBRSxNQUFjO1FBQ3JDLE9BQU8sT0FBTyxLQUFLLE1BQU0sQ0FBQztJQUM1QixDQUFDO0NBQ0Y7QUFFRCxhQUFhO0FBQ2IsTUFBYSxnQkFBZ0I7SUFJM0IsWUFBWSxRQUEwQixFQUFFO1FBRmhDLG9CQUFlLEdBQW9CLElBQUksZUFBZSxFQUFFLENBQUM7UUFHL0QsaUJBQWlCO1FBQ2pCLElBQUksQ0FBQyxLQUFLLEdBQUcsQ0FBQyxHQUFHLHVDQUFvQixFQUFFLEdBQUcsS0FBSyxDQUFDLENBQUM7SUFDbkQsQ0FBQztJQUVEOztPQUVHO0lBQ0gsUUFBUSxDQUFDLEtBQTJCO1FBQ2xDLFlBQVk7UUFDWixJQUFJ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TUQsNENBK01DO0FBRUQsK0VBQStFO0FBQy9FLE9BQU87QUFDUCwrRUFBK0U7QUFFL0U7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0E0QkciLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFBlcm1pc3Npb25FbmdpbmUgLSDmnYPpmZDop4TliJnlvJXmk45cbiAqIFxuICog5qC45b+D6IO95Yqb77yaXG4gKiAtIOWkmuadpea6kOinhOWImeWQiOW5tlxuICogLSDkvJjlhYjnuqfmjpLluo9cbiAqIC0g5Yaz562W5Y6f5Zug6Kej6YeKXG4gKiAtIOWNsemZqeWRveS7pOajgOa1i1xuICogLSBzaGFkb3dlZCBydWxlcyDmo4DmtYtcbiAqL1xuXG5pbXBvcnQge1xuICBQZXJtaXNzaW9uUnVsZSxcbiAgUGVybWlzc2lvbkNoZWNrSW5wdXQsXG4gIFBlcm1pc3Npb25EZWNpc2lvbixcbiAgUGVybWlzc2lvbkJlaGF2aW9yLFxuICBEQU5HRVJPVVNfUEFUVEVSTlMsXG4gIFNPVVJDRV9QUklPUklUWSxcbiAgREVGQVVMVF9TWVNURU1fUlVMRVMsXG59IGZyb20gJy4vcGVybWlzc2lvbl90eXBlcyc7XG5cbi8qKiDljLnphY3lmajmjqXlj6MgKi9cbmludGVyZmFjZSBQYXR0ZXJuTWF0Y2hlciB7XG4gIG1hdGNoZXMocGF0dGVybjogc3RyaW5nLCB0YXJnZXQ6IHN0cmluZyk6IGJvb2xlYW47XG59XG5cbi8qKiDnroDljZXpgJrphY3nrKbljLnphY3lmajvvIjmlK/mjIEgKiDlkowgKirvvIkgKi9cbmNsYXNzIFdpbGRjYXJkTWF0Y2hlciBpbXBsZW1lbnRzIFBhdHRlcm5NYXRjaGVyIHtcbiAgbWF0Y2hlcyhwYXR0ZXJuOiBzdHJpbmcsIHRhcmdldDogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgLy8g6L2s5LmJ54m55q6K5a2X56ymXG4gICAgY29uc3QgZXNjYXBlZCA9IHBhdHRlcm5cbiAgICAgIC5yZXBsYWNlKC9bLis/XiR7fSgpfFtcXF1cXFxcXS9nLCAnXFxcXCQmJylcbiAgICAgIC5yZXBsYWNlKC9cXCovZywgJy4qJyk7XG4gICAgXG4gICAgY29uc3QgcmVnZXggPSBuZXcgUmVnRXhwKGBeJHtlc2NhcGVkfSRgKTtcbiAgICByZXR1cm4gcmVnZXgudGVzdCh0YXJnZXQpO1xuICB9XG59XG5cbi8qKiDliY3nvIDljLnphY3lmaggKi9cbmNsYXNzIFByZWZpeE1hdGNoZXIgaW1wbGVtZW50cyBQYXR0ZXJuTWF0Y2hlciB7XG4gIG1hdGNoZXMocGF0dGVybjogc3RyaW5nLCB0YXJnZXQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0YXJnZXQuc3RhcnRzV2l0aChwYXR0ZXJuKTtcbiAgfVxufVxuXG4vKiog57K+56Gu5Yy56YWN5ZmoICovXG5jbGFzcyBFeGFjdE1hdGNoZXIgaW1wbGVtZW50cyBQYXR0ZXJuTWF0Y2hlciB7XG4gIG1hdGNoZXMocGF0dGVybjogc3RyaW5nLCB0YXJnZXQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBwYXR0ZXJuID09PSB0YXJnZXQ7XG4gIH1cbn1cblxuLyoqIOadg+mZkOW8leaTjuWunueOsCAqL1xuZXhwb3J0IGNsYXNzIFBlcm1pc3Npb25FbmdpbmUge1xuICBwcml2YXRlIHJ1bGVzOiBQZXJtaXNzaW9uUnVsZVtdO1xuICBwcml2YXRlIHdpbGRjYXJkTWF0Y2hlcjogV2lsZGNhcmRNYXRjaGVyID0gbmV3IFdpbGRjYXJkTWF0Y2hlcigpO1xuXG4gIGNvbnN0cnVjdG9yKHJ1bGVzOiBQZXJtaXNzaW9uUnVsZVtdID0gW10pIHtcbiAgICAvLyDlkIjlubbpu5jorqTop4TliJkgKyDoh6rlrprkuYnop4TliJlcbiAgICB0aGlzLnJ1bGVzID0gWy4uLkRFRkFVTFRfU1lTVEVNX1JVTEVTLCAuLi5ydWxlc107XG4gIH1cblxuICAvKipcbiAgICog6K+E5Lyw5p2D6ZmQXG4gICAqL1xuICBldmFsdWF0ZShpbnB1dDogUGVybWlzc2lvbkNoZWNrSW5wdXQpOiBQZXJtaXNzaW9uRGVjaXNpb24ge1xuICAgIC8vIDEuIOajgOafpeWNsemZqeWRveS7pFxuICAgIGlmIChpbnB1dC50b29sID09PSAnZXhlYy5ydW4nICYmIGlucHV0LnRhcmdldCkge1xuICAgICAgZm9yIChjb25zdCBwYXR0ZXJuIG9mIERBTkdFUk9VU19QQVRURVJOUykge1xuICAgICAgICBpZiAodGhpcy5tYXRjaGVzRGFuZ2Vyb3VzUGF0dGVybihwYXR0ZXJuLCBpbnB1dC50YXJnZXQpKSB7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGFsbG93ZWQ6IGZhbHNlLFxuICAgICAgICAgICAgYmVoYXZpb3I6ICdkZW55JyxcbiAgICAgICAgICAgIHJlcXVpcmVzQXBwcm92YWw6IGZhbHNlLFxuICAgICAgICAgICAgZXhwbGFuYXRpb246IGBCbG9ja2VkOiBtYXRjaGVzIGRhbmdlcm91cyBwYXR0ZXJuIFwiJHtwYXR0ZXJufVwiYCxcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gMi4g5p+l5om+5omA5pyJ5Yy56YWN6KeE5YiZXG4gICAgY29uc3QgbWF0Y2hlcyA9IHRoaXMucnVsZXMuZmlsdGVyKHJ1bGUgPT4gdGhpcy5tYXRjaGVzKHJ1bGUsIGlucHV0KSk7XG5cbiAgICAvLyAzLiDmjInkvJjlhYjnuqfmjpLluo9cbiAgICBtYXRjaGVzLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgIGNvbnN0IHByaW9yaXR5QSA9IGEucHJpb3JpdHkgPz8gU09VUkNFX1BSSU9SSVRZW2Euc291cmNlXTtcbiAgICAgIGNvbnN0IHByaW9yaXR5QiA9IGIucHJpb3JpdHkgPz8gU09VUkNFX1BSSU9SSVRZW2Iuc291cmNlXTtcbiAgICAgIHJldHVybiBwcmlvcml0eUIgLSBwcmlvcml0eUE7XG4gICAgfSk7XG5cbiAgICAvLyA0LiDlj5bmnIDpq5jkvJjlhYjnuqfop4TliJlcbiAgICBjb25zdCB3aW5uZXIgPSBtYXRjaGVzWzBdO1xuXG4gICAgaWYgKCF3aW5uZXIpIHtcbiAgICAgIC8vIOaXoOWMuemFjeinhOWImSDihpIg6buY6K6k6ZyA6KaB5a6h5om5XG4gICAgICByZXR1cm4ge1xuICAgICAgICBhbGxvd2VkOiBmYWxzZSxcbiAgICAgICAgYmVoYXZpb3I6ICdhc2snLFxuICAgICAgICByZXF1aXJlc0FwcHJvdmFsOiB0cnVlLFxuICAgICAgICBleHBsYW5hdGlvbjogJ05vIG1hdGNoaW5nIHJ1bGU7IGFwcHJvdmFsIHJlcXVpcmVkIGJ5IGRlZmF1bHQnLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyA1LiDnlJ/miJDlhrPnrZZcbiAgICByZXR1cm4gdGhpcy5jcmVhdGVEZWNpc2lvbih3aW5uZXIpO1xuICB9XG5cbiAgLyoqXG4gICAqIOa3u+WKoOinhOWImVxuICAgKi9cbiAgYWRkUnVsZShydWxlOiBQZXJtaXNzaW9uUnVsZSk6IHZvaWQge1xuICAgIHRoaXMucnVsZXMucHVzaChydWxlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDnp7vpmaTop4TliJlcbiAgICovXG4gIHJlbW92ZVJ1bGUocnVsZTogUGVybWlzc2lvblJ1bGUpOiB2b2lkIHtcbiAgICBjb25zdCBpbmRleCA9IHRoaXMucnVsZXMuaW5kZXhPZihydWxlKTtcbiAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgdGhpcy5ydWxlcy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDojrflj5bmiYDmnInop4TliJnvvIjnlKjkuo7osIPor5XvvIlcbiAgICovXG4gIGdldFJ1bGVzKCk6IFBlcm1pc3Npb25SdWxlW10ge1xuICAgIHJldHVybiBbLi4udGhpcy5ydWxlc107XG4gIH1cblxuICAvKipcbiAgICog5qOA5rWLIHNoYWRvd2VkIHJ1bGVz77yI6KKr6KaG55uW55qE6KeE5YiZ77yJXG4gICAqL1xuICBkZXRlY3RTaGFkb3dlZFJ1bGVzKCk6IHsgcnVsZTogUGVybWlzc2lvblJ1bGU7IHNoYWRvd2VkQnk6IFBlcm1pc3Npb25SdWxlIH1bXSB7XG4gICAgY29uc3Qgc2hhZG93ZWQ6IHsgcnVsZTogUGVybWlzc2lvblJ1bGU7IHNoYWRvd2VkQnk6IFBlcm1pc3Npb25SdWxlIH1bXSA9IFtdO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnJ1bGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBmb3IgKGxldCBqID0gaSArIDE7IGogPCB0aGlzLnJ1bGVzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgIGNvbnN0IGEgPSB0aGlzLnJ1bGVzW2ldO1xuICAgICAgICBjb25zdCBiID0gdGhpcy5ydWxlc1tqXTtcblxuICAgICAgICAvLyDlpoLmnpzkuKTmnaHop4TliJnpkojlr7nlkIzkuIDlt6XlhbfvvIzkuJTkvJjlhYjnuqfkuI3lkIxcbiAgICAgICAgaWYgKGEudG9vbCA9PT0gYi50b29sICYmIGEuc291cmNlICE9PSBiLnNvdXJjZSkge1xuICAgICAgICAgIGNvbnN0IHByaW9yaXR5QSA9IGEucHJpb3JpdHkgPz8gU09VUkNFX1BSSU9SSVRZW2Euc291cmNlXTtcbiAgICAgICAgICBjb25zdCBwcmlvcml0eUIgPSBiLnByaW9yaXR5ID8/IFNPVVJDRV9QUklPUklUWVtiLnNvdXJjZV07XG5cbiAgICAgICAgICAvLyDkvY7kvJjlhYjnuqfnmoTop4TliJnlj6/og73ooqvpq5jkvJjlhYjnuqfopobnm5ZcbiAgICAgICAgICBpZiAocHJpb3JpdHlBIDwgcHJpb3JpdHlCICYmIGEucGF0dGVybiA9PT0gYi5wYXR0ZXJuKSB7XG4gICAgICAgICAgICBzaGFkb3dlZC5wdXNoKHsgcnVsZTogYSwgc2hhZG93ZWRCeTogYiB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gc2hhZG93ZWQ7XG4gIH1cblxuICAvKipcbiAgICog5Yy56YWN6KeE5YiZXG4gICAqL1xuICBwcml2YXRlIG1hdGNoZXMocnVsZTogUGVybWlzc2lvblJ1bGUsIGlucHV0OiBQZXJtaXNzaW9uQ2hlY2tJbnB1dCk6IGJvb2xlYW4ge1xuICAgIC8vIOW3peWFt+WQjeensOW/hemhu+WMuemFjVxuICAgIGlmIChydWxlLnRvb2wgIT09IGlucHV0LnRvb2wpIHtcbiAgICAgIC8vIOaUr+aMgSBtY3BfXyog6YCa6YWN56ymXG4gICAgICBpZiAocnVsZS50b29sLmVuZHNXaXRoKCcqJykpIHtcbiAgICAgICAgaWYgKCF0aGlzLndpbGRjYXJkTWF0Y2hlci5tYXRjaGVzKHJ1bGUudG9vbCwgaW5wdXQudG9vbCkpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyDmqKHlvI/ljLnphY3vvIjnlKjkuo4gZXhlYyBjb21tYW5k77yJXG4gICAgaWYgKHJ1bGUucGF0dGVybiAmJiBpbnB1dC50YXJnZXQpIHtcbiAgICAgIGlmICghdGhpcy53aWxkY2FyZE1hdGNoZXIubWF0Y2hlcyhydWxlLnBhdHRlcm4sIGlucHV0LnRhcmdldCkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIOW3peS9nOWMuui3r+W+hOiMg+WbtFxuICAgIGlmIChydWxlLnBhdGhTY29wZSAmJiBpbnB1dC5jd2QpIHtcbiAgICAgIGlmICghaW5wdXQuY3dkLnN0YXJ0c1dpdGgocnVsZS5wYXRoU2NvcGUpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBNQ1Agc2VydmVyIOiMg+WbtFxuICAgIGlmIChydWxlLm1jcFNlcnZlciAmJiBpbnB1dC5wYXlsb2FkKSB7XG4gICAgICBjb25zdCBwYXlsb2FkID0gaW5wdXQucGF5bG9hZCBhcyBhbnk7XG4gICAgICBpZiAocGF5bG9hZC5tY3BTZXJ2ZXIgIT09IHJ1bGUubWNwU2VydmVyKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyDov4fmnJ/mo4Dmn6VcbiAgICBpZiAocnVsZS5leHBpcmVzQXQgJiYgRGF0ZS5ub3coKSA+IHJ1bGUuZXhwaXJlc0F0KSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvKipcbiAgICog5Yy56YWN5Y2x6Zmp5ZG95Luk5qih5byPXG4gICAqL1xuICBwcml2YXRlIG1hdGNoZXNEYW5nZXJvdXNQYXR0ZXJuKHBhdHRlcm46IHN0cmluZywgY29tbWFuZDogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgLy8g566A5YyW5a6e546w77ya5pSv5oyBICog6YCa6YWN56ymXG4gICAgY29uc3QgcmVnZXggPSBuZXcgUmVnRXhwKFxuICAgICAgcGF0dGVybi5yZXBsYWNlKC9cXCovZywgJy4qJykucmVwbGFjZSgvIC9nLCAnXFxcXHMrJyksXG4gICAgICAnaSdcbiAgICApO1xuICAgIHJldHVybiByZWdleC50ZXN0KGNvbW1hbmQpO1xuICB9XG5cbiAgLyoqXG4gICAqIOWIm+W7uuWGs+etllxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVEZWNpc2lvbihydWxlOiBQZXJtaXNzaW9uUnVsZSk6IFBlcm1pc3Npb25EZWNpc2lvbiB7XG4gICAgY29uc3QgZXhwbGFuYXRpb24gPSB0aGlzLmdlbmVyYXRlRXhwbGFuYXRpb24ocnVsZSk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgYWxsb3dlZDogcnVsZS5iZWhhdmlvciA9PT0gJ2FsbG93JyxcbiAgICAgIGJlaGF2aW9yOiBydWxlLmJlaGF2aW9yLFxuICAgICAgbWF0Y2hlZFJ1bGU6IHJ1bGUsXG4gICAgICByZXF1aXJlc0FwcHJvdmFsOiBydWxlLmJlaGF2aW9yID09PSAnYXNrJyxcbiAgICAgIGV4cGxhbmF0aW9uLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICog55Sf5oiQ5Lq657G75Y+v6Kej6YeK55qE5Y6f5ZugXG4gICAqL1xuICBwcml2YXRlIGdlbmVyYXRlRXhwbGFuYXRpb24ocnVsZTogUGVybWlzc2lvblJ1bGUpOiBzdHJpbmcge1xuICAgIGNvbnN0IHBhcnRzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgLy8g6KGM5Li66K+05piOXG4gICAgc3dpdGNoIChydWxlLmJlaGF2aW9yKSB7XG4gICAgICBjYXNlICdhbGxvdyc6XG4gICAgICAgIHBhcnRzLnB1c2goJ0FsbG93ZWQnKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdkZW55JzpcbiAgICAgICAgcGFydHMucHVzaCgnRGVuaWVkJyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnYXNrJzpcbiAgICAgICAgcGFydHMucHVzaCgnQXBwcm92YWwgcmVxdWlyZWQnKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgLy8g5p2l5rqQ6K+05piOXG4gICAgcGFydHMucHVzaChgYnkgJHtydWxlLnNvdXJjZX0gcnVsZWApO1xuXG4gICAgLy8g5Y6f5Zug6K+05piOXG4gICAgaWYgKHJ1bGUucmVhc29uKSB7XG4gICAgICBwYXJ0cy5wdXNoKGA6ICR7cnVsZS5yZWFzb259YCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHBhcnRzLmpvaW4oJyAnKTtcbiAgfVxufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDkvb/nlKjnpLrkvotcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDliJvlu7rmnYPpmZDlvJXmk47lubbmt7vliqDoh6rlrprkuYnop4TliJnvvJpcbiAqIFxuICogY29uc3QgZW5naW5lID0gbmV3IFBlcm1pc3Npb25FbmdpbmUoW1xuICogICB7XG4gKiAgICAgc291cmNlOiAnd29ya3NwYWNlJyxcbiAqICAgICBiZWhhdmlvcjogJ2FsbG93JyxcbiAqICAgICB0b29sOiAnZXhlYy5ydW4nLFxuICogICAgIHBhdHRlcm46ICducG0gKicsXG4gKiAgICAgcmVhc29uOiAnTlBNIGNvbW1hbmRzIGFyZSBhbGxvd2VkIGluIHRoaXMgd29ya3NwYWNlJyxcbiAqICAgfSxcbiAqICAge1xuICogICAgIHNvdXJjZTogJ3dvcmtzcGFjZScsXG4gKiAgICAgYmVoYXZpb3I6ICdkZW55JyxcbiAqICAgICB0b29sOiAnZXhlYy5ydW4nLFxuICogICAgIHBhdHRlcm46ICdnaXQgcHVzaCAqJyxcbiAqICAgICByZWFzb246ICdHaXQgcHVzaCByZXF1aXJlcyBleHBsaWNpdCBhcHByb3ZhbCcsXG4gKiAgIH0sXG4gKiBdKTtcbiAqIFxuICogLy8g5qOA5p+l5p2D6ZmQXG4gKiBjb25zdCBkZWNpc2lvbiA9IGVuZ2luZS5ldmFsdWF0ZSh7XG4gKiAgIHRvb2w6ICdleGVjLnJ1bicsXG4gKiAgIHRhcmdldDogJ25wbSBpbnN0YWxsJyxcbiAqIH0pO1xuICogXG4gKiBjb25zb2xlLmxvZyhkZWNpc2lvbi5leHBsYW5hdGlvbik7XG4gKiAvLyDovpPlh7rvvJpBbGxvd2VkIGJ5IHdvcmtzcGFjZSBydWxlOiBOUE0gY29tbWFuZHMgYXJlIGFsbG93ZWQgaW4gdGhpcyB3b3Jrc3BhY2VcbiAqL1xuIl19