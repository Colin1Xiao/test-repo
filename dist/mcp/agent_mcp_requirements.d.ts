/**
 * Agent MCP Requirements - Agent MCP 需求解析
 *
 * 职责：
 * 1. 扩展 AgentSpec 对 MCP 依赖的表达
 * 2. 校验 required / optional server
 * 3. 解析 agent 的 MCP 权限声明
 * 4. 给 orchestrator / planner 提供"能否运行"的判断依据
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { AgentMcpRequirement, AgentMcpSpec, McpDependencyStatus } from './types';
import { McpRegistry } from './resource_registry';
import { McpPolicy } from './mcp_policy';
/**
 * 需求解析结果
 */
export interface RequirementsResolution {
    /** 所有需求 */
    requirements: AgentMcpRequirement[];
    /** 依赖状态 */
    dependencies: McpDependencyStatus[];
    /** 是否可运行 */
    canRun: boolean;
}
export declare class AgentMcpRequirementsResolver {
    private registry;
    private policy;
    constructor(registry: McpRegistry, policy: McpPolicy);
    /**
     * 解析 Agent MCP 需求
     */
    resolveAgentMcpRequirements(agentSpec: AgentMcpSpec, availableServers: string[]): RequirementsResolution;
    /**
     * 检查 required servers
     */
    checkRequiredServers(agentSpec: AgentMcpSpec, availableServers: string[]): {
        allPresent: boolean;
        missing: string[];
        present: string[];
    };
    /**
     * 构建 MCP 能力视图
     */
    buildMcpCapabilityView(agentSpec: AgentMcpSpec, availableServers: string[]): {
        availableServers: string[];
        availableCapabilities: string[];
        availableResources: string[];
        deniedServers: string[];
        pendingServers: string[];
    };
    /**
     * 解析依赖状态
     */
    private resolveDependencyStatus;
}
/**
 * 创建需求解析器
 */
export declare function createAgentMcpRequirementsResolver(registry: McpRegistry, policy: McpPolicy): AgentMcpRequirementsResolver;
/**
 * 快速解析需求
 */
export declare function resolveMcpRequirements(agentSpec: AgentMcpSpec, availableServers: string[], registry: McpRegistry, policy: McpPolicy): RequirementsResolution;
