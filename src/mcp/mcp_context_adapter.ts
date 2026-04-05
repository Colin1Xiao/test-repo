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

import type {
  AgentMcpSpec,
  AgentMcpContext,
  McpServerHealthStatus,
} from './types';
import { McpRegistry } from './resource_registry';
import { McpPolicy } from './mcp_policy';
import { AgentMcpRequirementsResolver } from './agent_mcp_requirements';

// ============================================================================
// 类型定义
// ============================================================================

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

// ============================================================================
// MCP 上下文适配器
// ============================================================================

export class McpContextAdapter {
  private registry: McpRegistry;
  private policy: McpPolicy;
  private requirementsResolver: AgentMcpRequirementsResolver;
  
  constructor(
    registry: McpRegistry,
    policy: McpPolicy
  ) {
    this.registry = registry;
    this.policy = policy;
    this.requirementsResolver = new AgentMcpRequirementsResolver(registry, policy);
  }
  
  /**
   * 构建 Agent MCP 上下文
   */
  buildAgentMcpContext(
    agentSpec: AgentMcpSpec,
    options: ContextBuildOptions
  ): AgentMcpContext {
    const { availableServers, healthStatus, approvalPending } = options;
    
    // 解析需求
    const resolution = this.requirementsResolver.resolveAgentMcpRequirements(
      agentSpec,
      availableServers
    );
    
    // 构建可用能力列表
    const availableCapabilities: string[] = [];
    const availableResources: string[] = [];
    
    for (const server of availableServers) {
      // 检查健康状态
      const status = healthStatus[server] || 'unknown';
      if (status === 'unavailable') {
        continue;
      }
      
      // 检查权限
      const decision = this.policy.checkServerAccess(server);
      if (decision.effect === 'deny') {
        continue;
      }
      
      // 获取 server 的能力
      const serverDescriptor = this.registry.getServer(server);
      if (serverDescriptor) {
        for (const tool of serverDescriptor.tools) {
          if (tool.enabled) {
            availableCapabilities.push(tool.qualifiedName);
          }
        }
        for (const resource of serverDescriptor.resources) {
          if (resource.enabled) {
            availableResources.push(resource.qualifiedName);
          }
        }
      }
    }
    
    // 构建健康警告
    const healthWarnings: string[] = [];
    for (const [server, status] of Object.entries(healthStatus)) {
      if (status === 'degraded') {
        healthWarnings.push(`Server ${server} is degraded`);
      } else if (status === 'unavailable') {
        healthWarnings.push(`Server ${server} is unavailable`);
      }
    }
    
    return {
      availableServers,
      availableCapabilities,
      availableResources,
      requiredMissing: resolution.dependencies
        .filter(d => d.level === 'required' && d.status === 'missing')
        .map(d => d.server),
      optionalMissing: resolution.dependencies
        .filter(d => d.level === 'optional' && d.status === 'missing')
        .map(d => d.server),
      approvalPending: approvalPending,
      healthWarnings,
    };
  }
  
  /**
   * 注入 MCP 资源到上下文
   */
  injectMcpResources(
    agentRole: string,
    task: any,
    context: AgentMcpContext
  ): Record<string, unknown> {
    const injectedContext: Record<string, unknown> = {};
    
    // 按角色裁剪可见面
    switch (agentRole) {
      case 'planner':
        // Planner 需要 overview
        injectedContext.mcpOverview = {
          availableServers: context.availableServers,
          requiredMissing: context.requiredMissing,
          optionalMissing: context.optionalMissing,
          healthWarnings: context.healthWarnings,
        };
        break;
        
      case 'repo_reader':
        // Repo Reader 需要资源列表
        injectedContext.mcpResources = {
          availableResources: context.availableResources,
          healthWarnings: context.healthWarnings,
        };
        break;
        
      case 'release_agent':
        // Release Agent 需要完整能力
        injectedContext.mcpCapabilities = {
          availableServers: context.availableServers,
          availableCapabilities: context.availableCapabilities,
          availableResources: context.availableResources,
          healthWarnings: context.healthWarnings,
        };
        break;
        
      default:
        // 默认提供基本信息
        injectedContext.mcpBasic = {
          availableServers: context.availableServers,
          healthWarnings: context.healthWarnings,
        };
    }
    
    return injectedContext;
  }
  
  /**
   * 总结可用能力
   */
  summarizeAvailableCapabilities(context: AgentMcpContext): string {
    const lines: string[] = [];
    
    if (context.availableServers.length > 0) {
      lines.push(`**Available MCP Servers:** ${context.availableServers.join(', ')}`);
    }
    
    if (context.availableCapabilities.length > 0) {
      const toolCount = context.availableCapabilities.length;
      lines.push(`**Available Tools:** ${toolCount} tools registered`);
    }
    
    if (context.availableResources.length > 0) {
      const resourceCount = context.availableResources.length;
      lines.push(`**Available Resources:** ${resourceCount} resources registered`);
    }
    
    if (context.requiredMissing.length > 0) {
      lines.push(`**Missing Required Servers:** ${context.requiredMissing.join(', ')}`);
    }
    
    if (context.optionalMissing.length > 0) {
      lines.push(`**Missing Optional Servers:** ${context.optionalMissing.join(', ')} (features may be limited)`);
    }
    
    if (context.healthWarnings.length > 0) {
      lines.push(`**Health Warnings:** ${context.healthWarnings.join('; ')}`);
    }
    
    return lines.join('\n');
  }
  
  /**
   * 构建缺失依赖报告
   */
  buildMissingDependencyReport(context: AgentMcpContext): MissingDependencyReport {
    const suggestedActions: string[] = [];
    
    if (context.requiredMissing.length > 0) {
      suggestedActions.push(
        `Ensure required servers are available: ${context.requiredMissing.join(', ')}`
      );
    }
    
    if (context.approvalPending.length > 0) {
      suggestedActions.push(
        `Complete approval for servers: ${context.approvalPending.join(', ')}`
      );
    }
    
    if (context.healthWarnings.length > 0) {
      suggestedActions.push(
        'Check server health status and resolve any issues'
      );
    }
    
    return {
      requiredMissing: context.requiredMissing,
      optionalMissing: context.optionalMissing,
      denied: [], // 简化实现
      pending: context.approvalPending,
      healthWarnings: context.healthWarnings,
      canRun: context.requiredMissing.length === 0,
      suggestedActions,
    };
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建上下文适配器
 */
export function createMcpContextAdapter(
  registry: McpRegistry,
  policy: McpPolicy
): McpContextAdapter {
  return new McpContextAdapter(registry, policy);
}
