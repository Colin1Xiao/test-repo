/**
 * MCP Context Adapter - MCP 上下文适配器
 *
 * 职责：
 * 1. 把 MCP capability / resource 注入成 agent 可消费上下文
 * 2. 统一将 registry + policy + resources 转成 team runtime 侧的上下文对象
 * 3. 按角色裁剪 MCP 可见面
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { AgentMcpSpec, AgentMcpContext, McpServerHealthStatus } from './types';
import { McpRegistry } from './resource_registry';
import { McpPolicy } from './mcp_policy';
/**
 * 上下文构建选项
 */
export interface ContextBuildOptions {
    /** 可用的 servers */
    availableServers: string[];
    /** 健康状态 */
    healthStatus: Record<string, McpServerHealthStatus>;
    /** 等待审批的 */
    approvalPending: string[];
}
/**
 * 缺失依赖报告
 */
export interface MissingDependencyReport {
    /** 缺失的 required */
    requiredMissing: string[];
    /** 缺失的 optional */
    optionalMissing: string[];
    /** 被拒绝的 */
    denied: string[];
    /** 等待审批的 */
    pending: string[];
    /** 健康警告 */
    healthWarnings: string[];
    /** 是否可运行 */
    canRun: boolean;
    /** 建议操作 */
    suggestedActions: string[];
}
export declare class McpContextAdapter {
    private registry;
    private policy;
    private requirementsResolver;
    constructor(registry: McpRegistry, policy: McpPolicy);
    /**
     * 构建 Agent MCP 上下文
     */
    buildAgentMcpContext(agentSpec: AgentMcpSpec, options: ContextBuildOptions): AgentMcpContext;
    /**
     * 注入 MCP 资源到上下文
     */
    injectMcpResources(agentRole: string, task: any, context: AgentMcpContext): Record<string, unknown>;
    /**
     * 总结可用能力
     */
    summarizeAvailableCapabilities(context: AgentMcpContext): string;
    /**
     * 构建缺失依赖报告
     */
    buildMissingDependencyReport(context: AgentMcpContext): MissingDependencyReport;
}
/**
 * 创建上下文适配器
 */
export declare function createMcpContextAdapter(registry: McpRegistry, policy: McpPolicy): McpContextAdapter;
