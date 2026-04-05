"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillPolicyEvaluator = void 0;
exports.createSkillPolicyEvaluator = createSkillPolicyEvaluator;
exports.evaluateInstallPolicy = evaluateInstallPolicy;
exports.evaluateEnablePolicy = evaluateEnablePolicy;
exports.evaluateLoadPolicy = evaluateLoadPolicy;
const skill_trust_1 = require("./skill_trust");
// ============================================================================
// 默认策略规则
// ============================================================================
const DEFAULT_POLICY_RULES = [
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
class SkillPolicyEvaluator {
    constructor(config = {}) {
        this.config = {
            defaultRules: config.defaultRules ?? DEFAULT_POLICY_RULES,
            allowOverride: config.allowOverride ?? false,
        };
        this.rules = [...this.config.defaultRules];
        this.trustEvaluator = new skill_trust_1.SkillTrustEvaluator();
    }
    /**
     * 评估安装策略
     */
    evaluateInstallPolicy(pkg, context, validation) {
        return this.evaluatePolicy('install', pkg, context, validation);
    }
    /**
     * 评估启用策略
     */
    evaluateEnablePolicy(pkg, context, validation) {
        return this.evaluatePolicy('enable', pkg, context, validation);
    }
    /**
     * 评估加载策略
     */
    evaluateLoadPolicy(pkg, agentSpec, context, validation) {
        return this.evaluatePolicy('load', pkg, context, validation);
    }
    /**
     * 评估策略
     */
    evaluatePolicy(action, pkg, context, validation) {
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
        const decision = {
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
    findMatchingRule(action, trustLevel, source) {
        // 按优先级排序
        const sortedRules = [...this.rules].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
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
    addRule(rule) {
        this.rules.push(rule);
    }
    /**
     * 移除规则
     */
    removeRule(ruleId) {
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
    getRules() {
        return [...this.rules];
    }
    /**
     * 重置为默认规则
     */
    resetToDefaults() {
        this.rules = [...DEFAULT_POLICY_RULES];
    }
}
exports.SkillPolicyEvaluator = SkillPolicyEvaluator;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建策略评估器
 */
function createSkillPolicyEvaluator(config) {
    return new SkillPolicyEvaluator(config);
}
/**
 * 快速评估安装策略
 */
function evaluateInstallPolicy(pkg, context) {
    const evaluator = new SkillPolicyEvaluator();
    return evaluator.evaluateInstallPolicy(pkg, context);
}
/**
 * 快速评估启用策略
 */
function evaluateEnablePolicy(pkg, context) {
    const evaluator = new SkillPolicyEvaluator();
    return evaluator.evaluateEnablePolicy(pkg, context);
}
/**
 * 快速评估加载策略
 */
function evaluateLoadPolicy(pkg, agentSpec, context) {
    const evaluator = new SkillPolicyEvaluator();
    return evaluator.evaluateLoadPolicy(pkg, agentSpec, context);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2tpbGxfcG9saWN5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3NraWxscy9za2lsbF9wb2xpY3kudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7OztHQVdHOzs7QUEyU0gsZ0VBRUM7QUFLRCxzREFNQztBQUtELG9EQU1DO0FBS0QsZ0RBT0M7QUFsVUQsK0NBQXdFO0FBa0J4RSwrRUFBK0U7QUFDL0UsU0FBUztBQUNULCtFQUErRTtBQUUvRSxNQUFNLG9CQUFvQixHQUFzQjtJQUM5Qyx5QkFBeUI7SUFDekI7UUFDRSxFQUFFLEVBQUUsZUFBZTtRQUNuQixJQUFJLEVBQUUsc0JBQXNCO1FBQzVCLFdBQVcsRUFBRSxDQUFDLFNBQVMsQ0FBQztRQUN4QixPQUFPLEVBQUUsQ0FBQyxTQUFTLEVBQUUsUUFBUSxFQUFFLE1BQU0sQ0FBQztRQUN0QyxNQUFNLEVBQUUsT0FBTztRQUNmLGdCQUFnQixFQUFFLEtBQUs7UUFDdkIsV0FBVyxFQUFFLG1DQUFtQztRQUNoRCxRQUFRLEVBQUUsR0FBRztLQUNkO0lBRUQsb0NBQW9DO0lBQ3BDO1FBQ0UsRUFBRSxFQUFFLGdCQUFnQjtRQUNwQixJQUFJLEVBQUUsdUJBQXVCO1FBQzdCLFdBQVcsRUFBRSxDQUFDLFVBQVUsQ0FBQztRQUN6QixPQUFPLEVBQUUsQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDO1FBQzlCLE1BQU0sRUFBRSxPQUFPO1FBQ2YsZ0JBQWdCLEVBQUUsS0FBSztRQUN2QixXQUFXLEVBQUUsOENBQThDO1FBQzNELFFBQVEsRUFBRSxFQUFFO0tBQ2I7SUFFRDtRQUNFLEVBQUUsRUFBRSxlQUFlO1FBQ25CLElBQUksRUFBRSwrQ0FBK0M7UUFDckQsV0FBVyxFQUFFLENBQUMsVUFBVSxDQUFDO1FBQ3pCLE9BQU8sRUFBRSxDQUFDLE1BQU0sQ0FBQztRQUNqQixNQUFNLEVBQUUsS0FBSztRQUNiLGdCQUFnQixFQUFFLEtBQUs7UUFDdkIsV0FBVyxFQUFFLHlE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Q0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDdEQsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBZ0Isa0JBQWtCLENBQ2hDLEdBQTJCLEVBQzNCLFNBQXlCLEVBQ3pCLE9BQTRCO0lBRTVCLE1BQU0sU0FBUyxHQUFHLElBQUksb0JBQW9CLEVBQUUsQ0FBQztJQUM3QyxPQUFPLFNBQVMsQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLEVBQUUsU0FBUyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQy9ELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFNraWxsIFBvbGljeSAtIFNraWxsIOetlueVpeWGs+etllxuICogXG4gKiDogYzotKPvvJpcbiAqIDEuIOagueaNriB0cnVzdCArIHZhbGlkYXRpb24gKyBzb3VyY2UgKyBjb21wYXRpYmlsaXR5IOWBmuacgOe7iOWGs+etllxuICogMi4g5Yaz5a6aIGFsbG93IC8gYXNrIC8gZGVueVxuICogMy4g5Yaz5a6a6IO95ZCmIGluc3RhbGwgLyBlbmFibGUgLyBsb2FkXG4gKiA0LiDkuI7njrDmnIkgUGVybWlzc2lvbkVuZ2luZSAvIEFwcHJvdmFsQnJpZGdlIOivreS5ieWvuem9kFxuICogXG4gKiBAdmVyc2lvbiB2MC4xLjBcbiAqIEBkYXRlIDIwMjYtMDQtMDNcbiAqL1xuXG5pbXBvcnQgdHlwZSB7XG4gIFNraWxsUGFja2FnZURlc2NyaXB0b3IsXG4gIFNraWxsUG9saWN5QWN0aW9uLFxuICBTa2lsbFBvbGljeUVmZmVjdCxcbiAgU2tpbGxQb2xpY3lEZWNpc2lvbixcbiAgU2tpbGxQb2xpY3lDb250ZXh0LFxuICBTa2lsbFBvbGljeVJ1bGUsXG4gIFNraWxsVHJ1c3RMZXZlbCxcbiAgU2tpbGxTb3VyY2VUeXBlLFxuICBTa2lsbFZhbGlkYXRpb25SZXN1bHQsXG59IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgU2tpbGxUcnVzdEV2YWx1YXRvciwgZXZhbHVhdGVTa2lsbFRydXN0IH0gZnJvbSAnLi9za2lsbF90cnVzdCc7XG5pbXBvcnQgeyBTa2lsbFZhbGlkYXRvciB9IGZyb20gJy4vc2tpbGxfdmFsaWRhdGlvbic7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOexu+Wei+WumuS5iVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIOetlueVpeivhOS8sOWZqOmFjee9rlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFBvbGljeUV2YWx1YXRvckNvbmZpZyB7XG4gIC8qKiDpu5jorqTop4TliJkgKi9cbiAgZGVmYXVsdFJ1bGVzPzogU2tpbGxQb2xpY3lSdWxlW107XG4gIFxuICAvKiog5piv5ZCm5YWB6K646KaG55uWICovXG4gIGFsbG93T3ZlcnJpZGU/OiBib29sZWFuO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDpu5jorqTnrZbnlaXop4TliJlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuY29uc3QgREVGQVVMVF9QT0xJQ1lfUlVMRVM6IFNraWxsUG9saWN5UnVsZVtdID0gW1xuICAvLyBidWlsdGluIHNraWxsIC0g5YWB6K645omA5pyJ5Yqo5L2cXG4gIHtcbiAgICBpZDogJ2J1aWx0aW4tYWxsb3cnLFxuICAgIG5hbWU6ICdBbGxvdyBidWlsdGluIHNraWxscycsXG4gICAgdHJ1c3RMZXZlbHM6IFsnYnVpbHRpbiddLFxuICAgIGFjdGlvbnM6IFsnaW5zdGFsbCcsICdlbmFibGUnLCAnbG9hZCddLFxuICAgIGVmZmVjdDogJ2FsbG93JyxcbiAgICByZXF1aXJlc0FwcHJvdmFsOiBmYWxzZSxcbiAgICBkZXNjcmlwdGlvbjogJ0J1aWx0aW4gc2tpbGxzIGFyZSBhbHdheXMgYWxsb3dlZCcsXG4gICAgcHJpb3JpdHk6IDEwMCxcbiAgfSxcbiAgXG4gIC8vIHZlcmlmaWVkIHNraWxsIC0g5YWB6K645a6J6KOF5ZKM5ZCv55So77yM5Yqg6L296ZyA5qOA5p+l5YW85a655oCnXG4gIHtcbiAgICBpZDogJ3ZlcmlmaWVkLWFsbG93JyxcbiAgICBuYW1lOiAnQWxsb3cgdmVyaWZpZWQgc2tpbGxzJyxcbiAgICB0cnVzdExldmVsczogWyd2ZXJpZmllZCddLFxuICAgIGFjdGlvbnM6IFsnaW5zdGFsbCcsICdlbmFibGUnXSxcbiAgICBlZmZlY3Q6ICdhbGxvdycsXG4gICAgcmVxdWlyZXNBcHByb3ZhbDogZmFsc2UsXG4gICAgZGVzY3JpcHRpb246ICdWZXJpZmllZCBza2lsbHMgY2FuIGJlIGluc3RhbGxlZCBhbmQgZW5hYmxlZCcsXG4gICAgcHJpb3JpdHk6IDkwLFxuICB9LFxuICBcbiAge1xuICAgIGlkOiAndmVyaWZpZWQtbG9hZCcsXG4gICAgbmFtZTogJ0xvYWQgdmVyaWZpZWQgc2tpbGxzIHdpdGggY29tcGF0aWJpbGl0eSBjaGVjaycsXG4gICAgdHJ1c3RMZXZlbHM6IFsndmVyaWZpZWQnXSxcbiAgICBhY3Rpb25zOiBbJ2xvYWQnXSxcbiAgICBlZmZlY3Q6ICdhc2snLFxuICAgIHJlcXVpcmVzQXBwcm92YWw6IGZhbHNlLFxuICAgIGRlc2NyaXB0aW9uOiAnVmVyaWZpZWQgc2tpbGxzIHJlcXVpcmUgY29tcGF0aWJpbGl0eSBjaGVjayBmb3IgbG9hZGluZycsXG4gICAgcHJpb3JpdHk6IDkwLFxuICB9LFxuICBcbiAgLy8gd29ya3NwYWNlIHNraWxsIC0g5YWB6K645a6J6KOF5ZKM5ZCv55SoXG4gIHtcbiAgICBpZDogJ3dvcmtzcGFjZS1hbGxvdycsXG4gICAgbmFtZTogJ0FsbG93IHdvcmtzcGFjZSBza2lsbHMnLFxuICAgIHRydXN0TGV2ZWxzOiBbJ3dvcmtzcGFjZSddLFxuICAgIGFjdGlvbnM6IFsnaW5zdGFsbCcsICdlbmFibGUnXSxcbiAgICBlZmZlY3Q6ICdhbGxvdycsXG4gICAgcmVxdWlyZXNBcHByb3ZhbDogZmFsc2UsXG4gICAgZGVzY3JpcHRpb246ICdXb3Jrc3BhY2Ugc2tpbGxzIGNhbiBiZSBpbnN0YWxsZWQgYW5kIGVuYWJsZWQnLFxuICAgIHByaW9yaXR5OiA4MCxcbiAgfSxcbiAgXG4gIHtcbiAgICBpZDogJ3dvcmtzcGFjZS1sb2FkJyxcbiAgICBuYW1lOiAnTG9hZCB3b3Jrc3BhY2Ugc2tpbGxzIHdpdGggY29tcGF0aWJpbGl0eSBjaGVjaycsXG4gICAgdHJ1c3RMZXZlbHM6IFsnd29ya3NwYWNlJ10sXG4gICAgYWN0aW9uczogWydsb2FkJ10sXG4gICAgZWZmZWN0OiAnYWxsb3cnLFxuICAgIHJlcXVpcmVzQXBwcm92YWw6IGZhbHNlLFxuICAgIGRlc2NyaXB0aW9uOiAnV29ya3NwYWNlIHNraWxscyBjYW4gYmUgbG9hZGVkIHdpdGggY29tcGF0aWJpbGl0eSBjaGVjaycsXG4gICAgcHJpb3JpdHk6IDgwLFxuICB9LFxuICBcbiAgLy8gZXh0ZXJuYWwgc2tpbGwgLSDpnIDopoHlrqHmiblcbiAge1xuICAgIGlkOiAnZXh0ZXJuYWwtYXNrJyxcbiAgICBuYW1lOiAnUmVxdWlyZSBhcHByb3ZhbCBmb3IgZXh0ZXJuYWwgc2tpbGxzJyxcbiAgICB0cnVzdExldmVsczogWydleHRlcm5hbCddLFxuICAgIGFjdGlvbnM6IFsnaW5zdGFsbCcsICdlbmFibGUnLCAnbG9hZCddLFxuICAgIGVmZmVjdDogJ2FzaycsXG4gICAgcmVxdWlyZXNBcHByb3ZhbDogdHJ1ZSxcbiAgICBkZXNjcmlwdGlvbjogJ0V4dGVybmFsIHNraWxscyByZXF1aXJlIGFwcHJvdmFsJyxcbiAgICBwcmlvcml0eTogNzAsXG4gIH0sXG4gIFxuICAvLyB1bnRydXN0ZWQgc2tpbGwgLSDmi5Lnu51cbiAge1xuICAgIGlkOiAndW50cnVzdGVkLWRlbnknLFxuICAgIG5hbWU6ICdEZW55IHVudHJ1c3RlZCBza2lsbHMnLFxuICAgIHRydXN0TGV2ZWxzOiBbJ3VudHJ1c3RlZCddLFxuICAgIGFjdGlvbnM6IFsnaW5zdGFsbCcsICdlbmFibGUnLCAnbG9hZCddLFxuICAgIGVmZmVjdDogJ2RlbnknLFxuICAgIHJlcXVpcmVzQXBwcm92YWw6IHRydWUsXG4gICAgZGVzY3JpcHRpb246ICdVbnRydXN0ZWQgc2tpbGxzIGFyZSBkZW5pZWQgYnkgZGVmYXVsdCcsXG4gICAgcHJpb3JpdHk6IDYwLFxuICB9LFxuXTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gU2tpbGwg562W55Wl6K+E5Lyw5ZmoXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBjbGFzcyBTa2lsbFBvbGljeUV2YWx1YXRvciB7XG4gIHByaXZhdGUgY29uZmlnOiBSZXF1aXJlZDxQb2xpY3lFdmFsdWF0b3JDb25maWc+O1xuICBwcml2YXRlIHJ1bGVzOiBTa2lsbFBvbGljeVJ1bGVbXTtcbiAgcHJpdmF0ZSB0cnVzdEV2YWx1YXRvcjogU2tpbGxUcnVzdEV2YWx1YXRvcjtcbiAgXG4gIGNvbnN0cnVjdG9yKGNvbmZpZzogUG9saWN5RXZhbHVhdG9yQ29uZmlnID0ge30pIHtcbiAgICB0aGlzLmNvbmZpZyA9IHtcbiAgICAgIGRlZmF1bHRSdWxlczogY29uZmlnLmRlZmF1bHRSdWxlcyA/PyBERUZBVUxUX1BPTElDWV9SVUxFUyxcbiAgICAgIGFsbG93T3ZlcnJpZGU6IGNvbmZpZy5hbGxvd092ZXJyaWRlID8/IGZhbHNlLFxuICAgIH07XG4gICAgdGhpcy5ydWxlcyA9IFsuLi50aGlzLmNvbmZpZy5kZWZhdWx0UnVsZXNdO1xuICAgIHRoaXMudHJ1c3RFdmFsdWF0b3IgPSBuZXcgU2tpbGxUcnVzdEV2YWx1YXRvcigpO1xuICB9XG4gIFxuICAvKipcbiAgICog6K+E5Lyw5a6J6KOF562W55WlXG4gICAqL1xuICBldmFsdWF0ZUluc3RhbGxQb2xpY3koXG4gICAgcGtnOiBTa2lsbFBhY2thZ2VEZXNjcmlwdG9yLFxuICAgIGNvbnRleHQ/OiBTa2lsbFBvbGljeUNvbnRleHQsXG4gICAgdmFsaWRhdGlvbj86IFNraWxsVmFsaWRhdGlvblJlc3VsdFxuICApOiBTa2lsbFBvbGljeURlY2lzaW9uIHtcbiAgICByZXR1cm4gdGhpcy5ldmFsdWF0ZVBvbGljeSgnaW5zdGFsbCcsIHBrZywgY29udGV4dCwgdmFsaWRhdGlvbik7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDor4TkvLDlkK/nlKjnrZbnlaVcbiAgICovXG4gIGV2YWx1YXRlRW5hYmxlUG9saWN5KFxuICAgIHBrZzogU2tpbGxQYWNrYWdlRGVzY3JpcHRvcixcbiAgICBjb250ZXh0PzogU2tpbGxQb2xpY3lDb250ZXh0LFxuICAgIHZhbGlkYXRpb24/OiBTa2lsbFZhbGlkYXRpb25SZXN1bHRcbiAgKTogU2tpbGxQb2xpY3lEZWNpc2lvbiB7XG4gICAgcmV0dXJuIHRoaXMuZXZhbHVhdGVQb2xpY3koJ2VuYWJsZScsIHBrZywgY29udGV4dCwgdmFsaWRhdGlvbik7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDor4TkvLDliqDovb3nrZbnlaVcbiAgICovXG4gIGV2YWx1YXRlTG9hZFBvbGljeShcbiAgICBwa2c6IFNraWxsUGFja2FnZURlc2NyaXB0b3IsXG4gICAgYWdlbnRTcGVjOiB7IGlkOiBzdHJpbmcgfSxcbiAgICBjb250ZXh0PzogU2tpbGxQb2xpY3lDb250ZXh0LFxuICAgIHZhbGlkYXRpb24/OiBTa2lsbFZhbGlkYXRpb25SZXN1bHRcbiAgKTogU2tpbGxQb2xpY3lEZWNpc2lvbiB7XG4gICAgcmV0dXJuIHRoaXMuZXZhbHVhdGVQb2xpY3koJ2xvYWQnLCBwa2csIGNvbnRleHQsIHZhbGlkYXRpb24pO1xuICB9XG4gIFxuICAvKipcbiAgICog6K+E5Lyw562W55WlXG4gICAqL1xuICBldmFsdWF0ZVBvbGljeShcbiAgICBhY3Rpb246IFNraWxsUG9saWN5QWN0aW9uLFxuICAgIHBrZzogU2tpbGxQYWNrYWdlRGVzY3JpcHRvcixcbiAgICBjb250ZXh0PzogU2tpbGxQb2xpY3lDb250ZXh0LFxuICAgIHZhbGlkYXRpb24/OiBTa2lsbFZhbGlkYXRpb25SZXN1bHRcbiAgKTogU2tpbGxQb2xpY3lEZWNpc2lvbiB7XG4gICAgLy8g6I635Y+W5L+h5Lu75pGY6KaBXG4gICAgY29uc3QgdHJ1c3RTdW1tYXJ5ID0gdGhpcy50cnVzdEV2YWx1YXRvci5ldmFsdWF0ZVRydXN0KHBrZyk7XG4gICAgXG4gICAgLy8g5qOA5p+l5YW85a655oCnXG4gICAgY29uc3QgY29tcGF0aWJpbGl0eU9rID0gIXZhbGlkYXRpb24gfHwgXG4gICAgICB2YWxpZGF0aW9uLmNvbXBhdGliaWxpdHlJc3N1ZXMuZmlsdGVyKGkgPT4gaS5zZXZlcml0eSA9PT0gJ2hpZ2gnIHx8IGkuc2V2ZXJpdHkgPT09ICdjcml0aWNhbCcpLmxlbmd0aCA9PT0gMDtcbiAgICBcbiAgICAvLyDmn6Xmib7ljLnphY3nmoTop4TliJlcbiAgICBjb25zdCBtYXRjaGVkUnVsZSA9IHRoaXMuZmluZE1hdGNoaW5nUnVsZShhY3Rpb24sIHRydXN0U3VtbWFyeS50cnVzdExldmVsLCBwa2cuc291cmNlKTtcbiAgICBcbiAgICBpZiAoIW1hdGNoZWRSdWxlKSB7XG4gICAgICAvLyDml6DljLnphY3op4TliJnvvIzpu5jorqTmi5Lnu51cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGFjdGlvbixcbiAgICAgICAgZWZmZWN0OiAnZGVueScsXG4gICAgICAgIHJlYXNvbjogJ05vIG1hdGNoaW5nIHBvbGljeSBydWxlIGZvdW5kJyxcbiAgICAgICAgcmVxdWlyZXNBcHByb3ZhbDogZmFsc2UsXG4gICAgICAgIHRydXN0TGV2ZWw6IHRydXN0U3VtbWFyeS50cnVzdExldmVsLFxuICAgICAgICBjb21wYXRpYmlsaXR5T2ssXG4gICAgICB9O1xuICAgIH1cbiAgICBcbiAgICAvLyDmnoTlu7rlhrPnrZZcbiAgICBjb25zdCBkZWNpc2lvbjogU2tpbGxQb2xpY3lEZWNpc2lvbiA9IHtcbiAgICAgIGFjdGlvbixcbiAgICAgIGVmZmVjdDogbWF0Y2hlZFJ1bGUuZWZmZWN0LFxuICAgICAgcmVhc29uOiBtYXRjaGVkUnVsZS5kZXNjcmlwdGlvbiB8fCBgTWF0Y2hlZCBydWxlOiAke21hdGNoZWRSdWxlLm5hbWV9YCxcbiAgICAgIHJlcXVpcmVzQXBwcm92YWw6IG1hdGNoZWRSdWxlLnJlcXVpcmVzQXBwcm92YWwgPz8gZmFsc2UsXG4gICAgICB0cnVzdExldmVsOiB0cnVzdFN1bW1hcnkudHJ1c3RMZXZlbCxcbiAgICAgIGNvbXBhdGliaWxpdHlPayxcbiAgICAgIG1hdGNoZWRSdWxlSWQ6IG1hdGNoZWRSdWxlLmlkLFxuICAgIH07XG4gICAgXG4gICAgLy8g5YW85a655oCn5qOA5p+l5Y+v6IO96KaG55uW5Yaz562WXG4gICAgaWYgKCFjb21wYXRpYmlsaXR5T2sgJiYgYWN0aW9uID09PSAnbG9hZCcpIHtcbiAgICAgIGRlY2lzaW9uLmVmZmVjdCA9ICdkZW55JztcbiAgICAgIGRlY2lzaW9uLnJlYXNvbiA9ICdDb21wYXRpYmlsaXR5IGlzc3VlcyBwcmV2ZW50IGxvYWRpbmcnO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gZGVjaXNpb247XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmn6Xmib7ljLnphY3nmoTop4TliJlcbiAgICovXG4gIHByaXZhdGUgZmluZE1hdGNoaW5nUnVsZShcbiAgICBhY3Rpb246IFNraWxsUG9saWN5QWN0aW9uLFxuICAgIHRydXN0TGV2ZWw6IFNraWxsVHJ1c3RMZXZlbCxcbiAgICBzb3VyY2U6IFNraWxsU291cmNlVHlwZVxuICApOiBTa2lsbFBvbGljeVJ1bGUgfCBudWxsIHtcbiAgICAvLyDmjInkvJjlhYjnuqfmjpLluo9cbiAgICBjb25zdCBzb3J0ZWRSdWxlcyA9IFsuLi50aGlzLnJ1bGVzXS5zb3J0KChhLCBiKSA9PiBcbiAgICAgIChiLnByaW9yaXR5ID8/IDApIC0gKGEucHJpb3JpdHkgPz8gMClcbiAgICApO1xuICAgIFxuICAgIGZvciAoY29uc3QgcnVsZSBvZiBzb3J0ZWRSdWxlcykge1xuICAgICAgLy8g5qOA5p+l5Yqo5L2c5Yy56YWNXG4gICAgICBpZiAocnVsZS5hY3Rpb25zICYmICFydWxlLmFjdGlvbnMuaW5jbHVkZXMoYWN0aW9uKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8g5qOA5p+l5L+h5Lu757qn5Yir5Yy56YWNXG4gICAgICBpZiAocnVsZS50cnVzdExldmVscyAmJiAhcnVsZS50cnVzdExldmVscy5pbmNsdWRlcyh0cnVzdExldmVsKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8g5qOA5p+l5p2l5rqQ5Yy56YWNXG4gICAgICBpZiAocnVsZS5zb3VyY2VUeXBlcyAmJiAhcnVsZS5zb3VyY2VUeXBlcy5pbmNsdWRlcyhzb3VyY2UpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyDmib7liLDljLnphY3op4TliJlcbiAgICAgIHJldHVybiBydWxlO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOa3u+WKoOinhOWImVxuICAgKi9cbiAgYWRkUnVsZShydWxlOiBTa2lsbFBvbGljeVJ1bGUpOiB2b2lkIHtcbiAgICB0aGlzLnJ1bGVzLnB1c2gocnVsZSk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDnp7vpmaTop4TliJlcbiAgICovXG4gIHJlbW92ZVJ1bGUocnVsZUlkOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBjb25zdCBpbmRleCA9IHRoaXMucnVsZXMuZmluZEluZGV4KHIgPT4gci5pZCA9PT0gcnVsZUlkKTtcbiAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICB0aGlzLnJ1bGVzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIFxuICAvKipcbiAgICog6I635Y+W5omA5pyJ6KeE5YiZXG4gICAqL1xuICBnZXRSdWxlcygpOiBTa2lsbFBvbGljeVJ1bGVbXSB7XG4gICAgcmV0dXJuIFsuLi50aGlzLnJ1bGVzXTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOmHjee9ruS4uum7mOiupOinhOWImVxuICAgKi9cbiAgcmVzZXRUb0RlZmF1bHRzKCk6IHZvaWQge1xuICAgIHRoaXMucnVsZXMgPSBbLi4uREVGQVVMVF9QT0xJQ1lfUlVMRVNdO1xuICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOS+v+aNt+WHveaVsFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIOWIm+W7uuetlueVpeivhOS8sOWZqFxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlU2tpbGxQb2xpY3lFdmFsdWF0b3IoY29uZmlnPzogUG9saWN5RXZhbHVhdG9yQ29uZmlnKTogU2tpbGxQb2xpY3lFdmFsdWF0b3Ige1xuICByZXR1cm4gbmV3IFNraWxsUG9saWN5RXZhbHVhdG9yKGNvbmZpZyk7XG59XG5cbi8qKlxuICog5b+r6YCf6K+E5Lyw5a6J6KOF562W55WlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBldmFsdWF0ZUluc3RhbGxQb2xpY3koXG4gIHBrZzogU2tpbGxQYWNrYWdlRGVzY3JpcHRvcixcbiAgY29udGV4dD86IFNraWxsUG9saWN5Q29udGV4dFxuKTogU2tpbGxQb2xpY3lEZWNpc2lvbiB7XG4gIGNvbnN0IGV2YWx1YXRvciA9IG5ldyBTa2lsbFBvbGljeUV2YWx1YXRvcigpO1xuICByZXR1cm4gZXZhbHVhdG9yLmV2YWx1YXRlSW5zdGFsbFBvbGljeShwa2csIGNvbnRleHQpO1xufVxuXG4vKipcbiAqIOW/q+mAn+ivhOS8sOWQr+eUqOetlueVpVxuICovXG5leHBvcnQgZnVuY3Rpb24gZXZhbHVhdGVFbmFibGVQb2xpY3koXG4gIHBrZzogU2tpbGxQYWNrYWdlRGVzY3JpcHRvcixcbiAgY29udGV4dD86IFNraWxsUG9saWN5Q29udGV4dFxuKTogU2tpbGxQb2xpY3lEZWNpc2lvbiB7XG4gIGNvbnN0IGV2YWx1YXRvciA9IG5ldyBTa2lsbFBvbGljeUV2YWx1YXRvcigpO1xuICByZXR1cm4gZXZhbHVhdG9yLmV2YWx1YXRlRW5hYmxlUG9saWN5KHBrZywgY29udGV4dCk7XG59XG5cbi8qKlxuICog5b+r6YCf6K+E5Lyw5Yqg6L29562W55WlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBldmFsdWF0ZUxvYWRQb2xpY3koXG4gIHBrZzogU2tpbGxQYWNrYWdlRGVzY3JpcHRvcixcbiAgYWdlbnRTcGVjOiB7IGlkOiBzdHJpbmcgfSxcbiAgY29udGV4dD86IFNraWxsUG9saWN5Q29udGV4dFxuKTogU2tpbGxQb2xpY3lEZWNpc2lvbiB7XG4gIGNvbnN0IGV2YWx1YXRvciA9IG5ldyBTa2lsbFBvbGljeUV2YWx1YXRvcigpO1xuICByZXR1cm4gZXZhbHVhdG9yLmV2YWx1YXRlTG9hZFBvbGljeShwa2csIGFnZW50U3BlYywgY29udGV4dCk7XG59XG4iXX0=