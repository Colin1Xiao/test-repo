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
import type { McpPolicyRule, McpPolicyDecision, McpPolicyAction, McpPolicyEffect, McpAccessContext } from './types';
/**
 * 策略配置
 */
export interface McpPolicyConfig {
    /** 默认效果 */
    defaultEffect?: McpPolicyEffect;
}
export declare class McpPolicy {
    private config;
    private rules;
    constructor(config?: McpPolicyConfig);
    /**
     * 添加规则
     */
    addRule(rule: McpPolicyRule): void;
    /**
     * 移除规则
     */
    removeRule(ruleId: string): void;
    /**
     * 获取所有规则
     */
    getRules(): McpPolicyRule[];
    /**
     * 评估访问权限
     */
    evaluate(context: McpAccessContext): McpPolicyDecision;
    /**
     * 检查 Server 访问权限
     */
    checkServerAccess(serverId: string, action?: McpPolicyAction): McpPolicyDecision;
    /**
     * 检查 Tool 访问权限
     */
    checkToolAccess(qualifiedToolName: string, agentId: string, sessionId: string): McpPolicyDecision;
    /**
     * 检查 Resource 访问权限
     */
    checkResourceAccess(qualifiedResourceName: string, action: 'read' | 'write' | 'search', agentId: string, sessionId: string): McpPolicyDecision;
    /**
     * 查找匹配规则
     */
    private findMatchedRules;
    /**
     * 检查规则是否匹配
     */
    private ruleMatches;
    /**
     * 检查范围匹配
     */
    private scopeMatches;
    /**
     * 检查目标匹配
     */
    private targetMatches;
    /**
     * 检查动作匹配
     */
    private actionMatches;
    /**
     * 规范化动作
     */
    private normalizeAction;
}
/**
 * 创建宽松策略（默认允许）
 */
export declare function createPermissivePolicy(): McpPolicy;
/**
 * 创建严格策略（默认拒绝）
 */
export declare function createRestrictivePolicy(): McpPolicy;
/**
 * 创建保守策略（默认询问）
 */
export declare function createConservativePolicy(): McpPolicy;
/**
 * 创建默认 MCP 策略（带预定义规则）
 */
export declare function createDefaultMcpPolicy(): McpPolicy;
/**
 * 创建 MCP 策略
 */
export declare function createMcpPolicy(config?: McpPolicyConfig): McpPolicy;
