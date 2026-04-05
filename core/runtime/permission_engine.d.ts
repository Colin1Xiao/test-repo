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
import { PermissionRule, PermissionCheckInput, PermissionDecision } from './permission_types';
/** 权限引擎实现 */
export declare class PermissionEngine {
    private rules;
    private wildcardMatcher;
    constructor(rules?: PermissionRule[]);
    /**
     * 评估权限
     */
    evaluate(input: PermissionCheckInput): PermissionDecision;
    /**
     * 添加规则
     */
    addRule(rule: PermissionRule): void;
    /**
     * 移除规则
     */
    removeRule(rule: PermissionRule): void;
    /**
     * 获取所有规则（用于调试）
     */
    getRules(): PermissionRule[];
    /**
     * 检测 shadowed rules（被覆盖的规则）
     */
    detectShadowedRules(): {
        rule: PermissionRule;
        shadowedBy: PermissionRule;
    }[];
    /**
     * 匹配规则
     */
    private matches;
    /**
     * 匹配危险命令模式
     */
    private matchesDangerousPattern;
    /**
     * 创建决策
     */
    private createDecision;
    /**
     * 生成人类可解释的原因
     */
    private generateExplanation;
}
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
