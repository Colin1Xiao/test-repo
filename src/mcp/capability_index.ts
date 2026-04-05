/**
 * Capability Index - MCP 能力索引
 * 
 * 职责：
 * 1. 按 Server 查询
 * 2. 按 Capability Type 查询
 * 3. 按关键词查询
 * 4. 构建能力摘要
 * 5. 为 Agent 提供查询接口
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type {
  McpServerDescriptor,
  McpCapabilityType,
  McpCapabilitySummary,
  McpToolDescriptor,
  McpResourceDescriptor,
  McpPromptDescriptor,
} from './types';
import { McpRegistry } from './mcp_registry';
import { parseQualifiedName, extractServerName } from './mcp_naming';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 索引配置
 */
export interface CapabilityIndexConfig {
  /** 最大返回结果数 */
  maxResults?: number;
}

/**
 * 搜索查询
 */
export interface CapabilitySearchQuery {
  /** Server ID */
  serverId?: string;
  
  /** 能力类型 */
  type?: McpCapabilityType;
  
  /** 关键词 */
  keyword?: string;
  
  /** 是否仅启用 */
  enabledOnly?: boolean;
  
  /** 健康状态过滤 */
  healthStatus?: Array<'healthy' | 'degraded' | 'unhealthy'>;
}

// ============================================================================
// 能力索引
// ============================================================================

export class CapabilityIndex {
  private config: Required<CapabilityIndexConfig>;
  private registry: McpRegistry;
  
  constructor(registry: McpRegistry, config: CapabilityIndexConfig = {}) {
    this.config = {
      maxResults: config.maxResults ?? 50,
    };
    this.registry = registry;
  }
  
  /**
   * 按 Server 查询
   */
  findByServer(serverId: string): McpCapabilitySummary[] {
    const server = this.registry.getServer(serverId);
    if (!server) {
      return [];
    }
    
    const capabilities = this.registry.listCapabilities(serverId);
    return capabilities.map(cap => this.buildSummary(cap, server));
  }
  
  /**
   * 按类型查询
   */
  findByType(type: McpCapabilityType): McpCapabilitySummary[] {
    const allCapabilities = this.registry.listCapabilities();
    const filtered = allCapabilities.filter(cap => this.getCapabilityType(cap) === type);
    
    return filtered.slice(0, this.config.maxResults).map(cap => {
      const serverId = extractServerName(cap.qualifiedName);
      const server = serverId ? this.registry.getServer(serverId) : null;
      return this.buildSummary(cap, server);
    });
  }
  
  /**
   * 按关键词搜索
   */
  searchCapabilities(query: CapabilitySearchQuery): McpCapabilitySummary[] {
    const results: McpCapabilitySummary[] = [];
    
    // 获取所有 Server
    const servers = this.registry.listServers();
    
    for (const server of servers) {
      // Server 过滤
      if (query.serverId && server.id !== query.serverId) {
        continue;
      }
      
      // 健康状态过滤
      if (query.healthStatus && !query.healthStatus.includes(server.healthStatus)) {
        continue;
      }
      
      // 启用的 Server 过滤
      if (query.enabledOnly && !server.enabled) {
        continue;
      }
      
      // 获取 Server 的 Capabilities
      const capabilities = this.registry.listCapabilities(server.id);
      
      for (const cap of capabilities) {
        // 类型过滤
        if (query.type && this.getCapabilityType(cap) !== query.type) {
          continue;
        }
        
        // 启用过滤
        if (query.enabledOnly && !cap.enabled) {
          continue;
        }
        
        // 关键词匹配
        if (query.keyword && !this.matchesKeyword(cap, query.keyword)) {
          continue;
        }
        
        results.push(this.buildSummary(cap, server));
        
        // 限制结果数
        if (results.length >= this.config.maxResults) {
          return results;
        }
      }
    }
    
    return results;
  }
  
  /**
   * 构建能力摘要
   */
  buildSummary(
    capability: McpToolDescriptor | McpResourceDescriptor | McpPromptDescriptor,
    server: McpServerDescriptor | null
  ): McpCapabilitySummary {
    return {
      serverId: server?.id || extractServerName(capability.qualifiedName) || 'unknown',
      serverName: server?.name || 'unknown',
      type: this.getCapabilityType(capability),
      qualifiedName: capability.qualifiedName,
      description: capability.description,
      enabled: capability.enabled,
      healthStatus: server?.healthStatus || 'unknown',
    };
  }
  
  /**
   * 获取 Server 摘要列表
   */
  listServerSummaries(): Array<{
    id: string;
    name: string;
    version: string;
    description: string;
    enabled: boolean;
    healthStatus: string;
    toolCount: number;
    resourceCount: number;
    promptCount: number;
  }> {
    const servers = this.registry.listServers();
    
    return servers.map(server => ({
      id: server.id,
      name: server.name,
      version: server.version,
      description: server.description,
      enabled: server.enabled,
      healthStatus: server.healthStatus,
      toolCount: server.tools.length,
      resourceCount: server.resources.length,
      promptCount: server.prompts.length,
    }));
  }
  
  /**
   * 获取 Tool 摘要
   */
  getToolSummary(qualifiedName: string): McpCapabilitySummary | null {
    const capability = this.registry.getCapability(qualifiedName);
    if (!capability || this.getCapabilityType(capability) !== 'tool') {
      return null;
    }
    
    const serverId = extractServerName(qualifiedName);
    const server = serverId ? this.registry.getServer(serverId) : null;
    
    return this.buildSummary(capability, server);
  }
  
  /**
   * 获取 Resource 摘要
   */
  getResourceSummary(qualifiedName: string): McpCapabilitySummary | null {
    const capability = this.registry.getCapability(qualifiedName);
    if (!capability || this.getCapabilityType(capability) !== 'resource') {
      return null;
    }
    
    const serverId = extractServerName(qualifiedName);
    const server = serverId ? this.registry.getServer(serverId) : null;
    
    return this.buildSummary(capability, server);
  }
  
  /**
   * 获取 Prompt 摘要
   */
  getPromptSummary(qualifiedName: string): McpCapabilitySummary | null {
    const capability = this.registry.getCapability(qualifiedName);
    if (!capability || this.getCapabilityType(capability) !== 'prompt') {
      return null;
    }
    
    const serverId = extractServerName(qualifiedName);
    const server = serverId ? this.registry.getServer(serverId) : null;
    
    return this.buildSummary(capability, server);
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 获取 Capability 类型
   */
  private getCapabilityType(
    cap: McpToolDescriptor | McpResourceDescriptor | McpPromptDescriptor
  ): McpCapabilityType {
    if ('inputSchema' in cap) {
      return 'tool';
    }
    if ('resourceType' in cap) {
      return 'resource';
    }
    return 'prompt';
  }
  
  /**
   * 检查关键词匹配
   */
  private matchesKeyword(
    capability: McpToolDescriptor | McpResourceDescriptor | McpPromptDescriptor,
    keyword: string
  ): boolean {
    const keywordLower = keyword.toLowerCase();
    
    // 匹配名称
    if (capability.qualifiedName.toLowerCase().includes(keywordLower)) {
      return true;
    }
    
    // 匹配描述
    if (capability.description.toLowerCase().includes(keywordLower)) {
      return true;
    }
    
    // 匹配 Tool 的 inputSchema
    if ('inputSchema' in capability) {
      const schemaStr = JSON.stringify(capability.inputSchema).toLowerCase();
      if (schemaStr.includes(keywordLower)) {
        return true;
      }
    }
    
    // 匹配 Resource 的 resourceType
    if ('resourceType' in capability) {
      if (capability.resourceType.toLowerCase().includes(keywordLower)) {
        return true;
      }
    }
    
    return false;
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建能力索引
 */
export function createCapabilityIndex(
  registry: McpRegistry,
  config?: CapabilityIndexConfig
): CapabilityIndex {
  return new CapabilityIndex(registry, config);
}
