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

import type {
  AgentMcpRequirement,
  AgentMcpSpec,
  McpDependencyStatus,
  McpRequirementLevel,
} from './types';
import { McpRegistry } from './resource_registry';
import { McpPolicy } from './mcp_policy';

// ============================================================================
// 类型定义
// ============================================================================

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
  
  /** 阻塞原因 */
  blockingReasons: string[];
  
  /** 警告信息 */
  warnings: string[];
}

// ============================================================================
// Agent MCP 需求解析器
// ============================================================================

export class AgentMcpRequirementsResolver {
  private registry: McpRegistry;
  private policy: McpPolicy;
  
  constructor(registry: McpRegistry, policy: McpPolicy) {
    this.registry = registry;
    this.policy = policy;
  }
  
  /**
   * 解析 Agent MCP 需求
   */
  resolveAgentMcpRequirements(
    agentSpec: AgentMcpSpec,
    availableServers: string[]
  ): RequirementsResolution {
    const requirements: AgentMcpRequirement[] = [];
    const dependencies: McpDependencyStatus[] = [];
    const blockingReasons: string[] = [];
    const warnings: string[] = [];
    
    // 解析 required servers
    for (const server of agentSpec.requiredMcpServers || []) {
      requirements.push({
        server,
        level: 'required',
        capabilities: [],
        resourceTypes: [],
      });
      
      const status = this.resolveDependencyStatus(
        server,
        'required',
        availableServers,
        agentSpec
      );
      dependencies.push(status);
      
      if (status.status === 'missing' || status.status === 'unavailable') {
        blockingReasons.push(`Required server ${server} is ${status.status}`);
      } else if (status.status === 'denied') {
        blockingReasons.push(`Required server ${server} is denied by policy`);
      } else if (status.status === 'pending') {
        blockingReasons.push(`Required server ${server} requires approval`);
      } else if (status.status === 'degraded') {
        warnings.push(`Required server ${server} is degraded`);
      }
    }
    
    // 解析 optional servers
    for (const server of agentSpec.optionalMcpServers || []) {
      requirements.push({
        server,
        level: 'optional',
        capabilities: [],
        resourceTypes: [],
      });
      
      const status = this.resolveDependencyStatus(
        server,
        'optional',
        availableServers,
        agentSpec
      );
      dependencies.push(status);
      
      if (status.status === 'missing' || status.status === 'unavailable') {
        warnings.push(`Optional server ${server} is ${status.status} (feature will be limited)`);
      } else if (status.status === 'denied') {
        warnings.push(`Optional server ${server} is denied by policy`);
      } else if (status.status === 'pending') {
        warnings.push(`Optional server ${server} requires approval`);
      }
    }
    
    return {
      requirements,
      dependencies,
      canRun: blockingReasons.length === 0,
      blockingReasons,
      warnings,
    };
  }
  
  /**
   * 检查 required servers
   */
  checkRequiredServers(
    agentSpec: AgentMcpSpec,
    availableServers: string[]
  ): {
    allPresent: boolean;
    missing: string[];
    present: string[];
  } {
    const required = agentSpec.requiredMcpServers || [];
    const present: string[] = [];
    const missing: string[] = [];
    
    for (const server of required) {
      if (availableServers.includes(server)) {
        present.push(server);
      } else {
        missing.push(server);
      }
    }
    
    return {
      allPresent: missing.length === 0,
      missing,
      present,
    };
  }
  
  /**
   * 构建 MCP 能力视图
   */
  buildMcpCapabilityView(
    agentSpec: AgentMcpSpec,
    availableServers: string[]
  ): {
    availableServers: string[];
    availableCapabilities: string[];
    availableResources: string[];
    deniedServers: string[];
    pendingServers: string[];
  } {
    const availableServersList: string[] = [];
    const availableCapabilities: string[] = [];
    const availableResources: string[] = [];
    const deniedServers: string[] = [];
    const pendingServers: string[] = [];
    
    const allServers = [
      ...(agentSpec.requiredMcpServers || []),
      ...(agentSpec.optionalMcpServers || []),
    ];
    
    for (const server of allServers) {
      // 检查是否可用
      if (!availableServers.includes(server)) {
        continue;
      }
      
      // 检查权限
      const decision = this.policy.checkServerAccess(server);
      
      if (decision.effect === 'deny') {
        deniedServers.push(server);
        continue;
      }
      
      if (decision.effect === 'ask') {
        pendingServers.push(server);
        continue;
      }
      
      // server 可用
      availableServersList.push(server);
      
      // 获取 server 的能力
      const serverDescriptor = this.registry.getServer(server);
      if (serverDescriptor) {
        for (const tool of serverDescriptor.tools) {
          availableCapabilities.push(tool.qualifiedName);
        }
        for (const resource of serverDescriptor.resources) {
          availableResources.push(resource.qualifiedName);
        }
      }
    }
    
    return {
      availableServers: availableServersList,
      availableCapabilities,
      availableResources,
      deniedServers,
      pendingServers,
    };
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 解析依赖状态
   */
  private resolveDependencyStatus(
    server: string,
    level: McpRequirementLevel,
    availableServers: string[],
    agentSpec: AgentMcpSpec
  ): McpDependencyStatus {
    // 检查是否在可用列表中
    if (!availableServers.includes(server)) {
      return {
        server,
        level,
        status: 'missing',
        reason: `Server ${server} is not available`,
      };
    }
    
    // 检查权限
    const decision = this.policy.checkServerAccess(server);
    
    if (decision.effect === 'deny') {
      return {
        server,
        level,
        status: 'denied',
        reason: decision.reason,
      };
    }
    
    if (decision.effect === 'ask') {
      return {
        server,
        level,
        status: 'pending',
        reason: decision.reason,
      };
    }
    
    // 检查 server 健康状态（简化实现）
    const serverDescriptor = this.registry.getServer(server);
    if (serverDescriptor && serverDescriptor.healthStatus === 'unhealthy') {
      return {
        server,
        level,
        status: 'unavailable',
        reason: 'Server is unhealthy',
      };
    }
    
    if (serverDescriptor && serverDescriptor.healthStatus === 'degraded') {
      return {
        server,
        level,
        status: 'degraded',
        reason: 'Server is degraded',
      };
    }
    
    return {
      server,
      level,
      status: 'available',
    };
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建需求解析器
 */
export function createAgentMcpRequirementsResolver(
  registry: McpRegistry,
  policy: McpPolicy
): AgentMcpRequirementsResolver {
  return new AgentMcpRequirementsResolver(registry, policy);
}

/**
 * 快速解析需求
 */
export function resolveMcpRequirements(
  agentSpec: AgentMcpSpec,
  availableServers: string[],
  registry: McpRegistry,
  policy: McpPolicy
): RequirementsResolution {
  const resolver = new AgentMcpRequirementsResolver(registry, policy);
  return resolver.resolveAgentMcpRequirements(agentSpec, availableServers);
}
