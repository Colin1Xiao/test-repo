/**
 * MCP Registry - MCP 注册表
 * 
 * 职责：
 * 1. Server 注册/注销
 * 2. Tool/Resource/Prompt 注册
 * 3. 防重名冲突
 * 4. 查询 Server 和 Capability
 * 5. 启用/禁用控制
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type {
  McpServerId,
  McpServerDescriptor,
  McpToolDescriptor,
  McpResourceDescriptor,
  McpPromptDescriptor,
  McpCapabilityRef,
  McpCapabilityType,
  McpRegistrationResult,
  McpRegistryStats,
} from './types';
import {
  buildToolName,
  buildResourceName,
  buildPromptName,
  normalizeServerName,
  checkNameConflict,
} from './mcp_naming';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 注册表配置
 */
export interface McpRegistryConfig {
  /** 允许重复注册 */
  allowReregistration?: boolean;
}

// ============================================================================
// MCP 注册表
// ============================================================================

export class McpRegistry {
  private config: Required<McpRegistryConfig>;
  
  // Server 存储
  private servers: Map<McpServerId, McpServerDescriptor> = new Map();
  
  // Tool 索引
  private toolsByName: Map<string, McpToolDescriptor> = new Map();
  
  // Resource 索引
  private resourcesByName: Map<string, McpResourceDescriptor> = new Map();
  
  // Prompt 索引
  private promptsByName: Map<string, McpPromptDescriptor> = new Map();
  
  constructor(config: McpRegistryConfig = {}) {
    this.config = {
      allowReregistration: config.allowReregistration ?? false,
    };
  }
  
  /**
   * 注册 Server
   */
  async registerServer(
    descriptor: McpServerDescriptor
  ): Promise<McpRegistrationResult> {
    const serverId = normalizeServerName(descriptor.id);
    
    // 检查是否已存在
    const existing = this.servers.get(serverId);
    if (existing && !this.config.allowReregistration) {
      return {
        success: false,
        serverId,
        toolsRegistered: 0,
        resourcesRegistered: 0,
        promptsRegistered: 0,
        error: `Server ${serverId} already registered. Set allowReregistration=true to override.`,
      };
    }
    
    // 验证工具名称
    const toolNames: string[] = [];
    for (const tool of descriptor.tools || []) {
      const qualifiedName = buildToolName(serverId, tool.name);
      checkNameConflict(toolNames, qualifiedName, `Tool ${tool.name}`);
      tool.qualifiedName = qualifiedName;
      toolNames.push(qualifiedName);
    }
    
    // 验证资源名称
    const resourceNames: string[] = [];
    for (const resource of descriptor.resources || []) {
      const qualifiedName = buildResourceName(serverId, resource.resourceType);
      checkNameConflict(resourceNames, qualifiedName, `Resource ${resource.resourceType}`);
      resource.qualifiedName = qualifiedName;
      resourceNames.push(qualifiedName);
    }
    
    // 验证 Prompt 名称
    const promptNames: string[] = [];
    for (const prompt of descriptor.prompts || []) {
      const qualifiedName = buildPromptName(serverId, prompt.name);
      checkNameConflict(promptNames, qualifiedName, `Prompt ${prompt.name}`);
      prompt.qualifiedName = qualifiedName;
      promptNames.push(qualifiedName);
    }
    
    // 构建能力引用
    const capabilities: McpCapabilityRef[] = [
      ...(descriptor.tools || []).map(t => ({
        type: 'tool' as McpCapabilityType,
        qualifiedName: t.qualifiedName,
        description: t.description,
        enabled: t.enabled,
      })),
      ...(descriptor.resources || []).map(r => ({
        type: 'resource' as McpCapabilityType,
        qualifiedName: r.qualifiedName,
        description: r.description,
        enabled: r.enabled,
      })),
      ...(descriptor.prompts || []).map(p => ({
        type: 'prompt' as McpCapabilityType,
        qualifiedName: p.qualifiedName,
        description: p.description,
        enabled: p.enabled,
      })),
    ];
    
    // 创建 Server 描述符
    const serverDescriptor: McpServerDescriptor = {
      ...descriptor,
      id: serverId,
      name: descriptor.name,
      version: descriptor.version,
      capabilities,
      registeredAt: Date.now(),
      healthStatus: descriptor.healthStatus || 'unknown',
    };
    
    // 存储 Server
    this.servers.set(serverId, serverDescriptor);
    
    // 存储 Tool
    for (const tool of serverDescriptor.tools) {
      this.toolsByName.set(tool.qualifiedName, tool);
    }
    
    // 存储 Resource
    for (const resource of serverDescriptor.resources) {
      this.resourcesByName.set(resource.qualifiedName, resource);
    }
    
    // 存储 Prompt
    for (const prompt of serverDescriptor.prompts) {
      this.promptsByName.set(prompt.qualifiedName, prompt);
    }
    
    return {
      success: true,
      serverId,
      toolsRegistered: serverDescriptor.tools.length,
      resourcesRegistered: serverDescriptor.resources.length,
      promptsRegistered: serverDescriptor.prompts.length,
    };
  }
  
  /**
   * 注册 Tool
   */
  async registerTool(
    serverId: string,
    toolDescriptor: McpToolDescriptor
  ): Promise<boolean> {
    const normalizedServerId = normalizeServerName(serverId);
    const server = this.servers.get(normalizedServerId);
    
    if (!server) {
      throw new Error(`Server ${normalizedServerId} not found`);
    }
    
    const qualifiedName = buildToolName(normalizedServerId, toolDescriptor.name);
    
    // 检查重名
    if (this.toolsByName.has(qualifiedName)) {
      throw new Error(`Tool ${qualifiedName} already exists`);
    }
    
    toolDescriptor.qualifiedName = qualifiedName;
    server.tools.push(toolDescriptor);
    server.capabilities.push({
      type: 'tool',
      qualifiedName,
      description: toolDescriptor.description,
      enabled: toolDescriptor.enabled,
    });
    
    this.toolsByName.set(qualifiedName, toolDescriptor);
    
    return true;
  }
  
  /**
   * 注册 Resource
   */
  async registerResource(
    serverId: string,
    resourceDescriptor: McpResourceDescriptor
  ): Promise<boolean> {
    const normalizedServerId = normalizeServerName(serverId);
    const server = this.servers.get(normalizedServerId);
    
    if (!server) {
      throw new Error(`Server ${normalizedServerId} not found`);
    }
    
    const qualifiedName = buildResourceName(normalizedServerId, resourceDescriptor.resourceType);
    
    // 检查重名
    if (this.resourcesByName.has(qualifiedName)) {
      throw new Error(`Resource ${qualifiedName} already exists`);
    }
    
    resourceDescriptor.qualifiedName = qualifiedName;
    server.resources.push(resourceDescriptor);
    server.capabilities.push({
      type: 'resource',
      qualifiedName,
      description: resourceDescriptor.description,
      enabled: resourceDescriptor.enabled,
    });
    
    this.resourcesByName.set(qualifiedName, resourceDescriptor);
    
    return true;
  }
  
  /**
   * 注册 Prompt
   */
  async registerPrompt(
    serverId: string,
    promptDescriptor: McpPromptDescriptor
  ): Promise<boolean> {
    const normalizedServerId = normalizeServerName(serverId);
    const server = this.servers.get(normalizedServerId);
    
    if (!server) {
      throw new Error(`Server ${normalizedServerId} not found`);
    }
    
    const qualifiedName = buildPromptName(normalizedServerId, promptDescriptor.name);
    
    // 检查重名
    if (this.promptsByName.has(qualifiedName)) {
      throw new Error(`Prompt ${qualifiedName} already exists`);
    }
    
    promptDescriptor.qualifiedName = qualifiedName;
    server.prompts.push(promptDescriptor);
    server.capabilities.push({
      type: 'prompt',
      qualifiedName,
      description: promptDescriptor.description,
      enabled: promptDescriptor.enabled,
    });
    
    this.promptsByName.set(qualifiedName, promptDescriptor);
    
    return true;
  }
  
  /**
   * 注销 Server
   */
  async unregisterServer(serverId: string): Promise<boolean> {
    const normalizedServerId = normalizeServerName(serverId);
    const server = this.servers.get(normalizedServerId);
    
    if (!server) {
      return false;
    }
    
    // 删除所有 Tool
    for (const tool of server.tools) {
      this.toolsByName.delete(tool.qualifiedName);
    }
    
    // 删除所有 Resource
    for (const resource of server.resources) {
      this.resourcesByName.delete(resource.qualifiedName);
    }
    
    // 删除所有 Prompt
    for (const prompt of server.prompts) {
      this.promptsByName.delete(prompt.qualifiedName);
    }
    
    // 删除 Server
    this.servers.delete(normalizedServerId);
    
    return true;
  }
  
  /**
   * 获取 Server
   */
  getServer(serverId: string): McpServerDescriptor | null {
    const normalizedServerId = normalizeServerName(serverId);
    return this.servers.get(normalizedServerId) || null;
  }
  
  /**
   * 获取 Capability
   */
  getCapability(qualifiedName: string): McpToolDescriptor | McpResourceDescriptor | McpPromptDescriptor | null {
    return (
      this.toolsByName.get(qualifiedName) ||
      this.resourcesByName.get(qualifiedName) ||
      this.promptsByName.get(qualifiedName) ||
      null
    );
  }
  
  /**
   * 列出所有 Server
   */
  listServers(): McpServerDescriptor[] {
    return Array.from(this.servers.values());
  }
  
  /**
   * 列出所有 Capability
   */
  listCapabilities(serverId?: string): Array<McpToolDescriptor | McpResourceDescriptor | McpPromptDescriptor> {
    if (serverId) {
      const normalizedServerId = normalizeServerName(serverId);
      const server = this.servers.get(normalizedServerId);
      
      if (!server) {
        return [];
      }
      
      return [...server.tools, ...server.resources, ...server.prompts];
    }
    
    return [
      ...this.toolsByName.values(),
      ...this.resourcesByName.values(),
      ...this.promptsByName.values(),
    ];
  }
  
  /**
   * 启用/禁用 Server
   */
  setServerEnabled(serverId: string, enabled: boolean): void {
    const normalizedServerId = normalizeServerName(serverId);
    const server = this.servers.get(normalizedServerId);
    
    if (server) {
      server.enabled = enabled;
      
      // 同步更新所有 Capability
      for (const tool of server.tools) {
        tool.enabled = enabled;
      }
      for (const resource of server.resources) {
        resource.enabled = enabled;
      }
      for (const prompt of server.prompts) {
        prompt.enabled = enabled;
      }
    }
  }
  
  /**
   * 更新 Server 健康状态
   */
  updateServerHealth(serverId: string, healthStatus: 'healthy' | 'degraded' | 'unhealthy'): void {
    const normalizedServerId = normalizeServerName(serverId);
    const server = this.servers.get(normalizedServerId);
    
    if (server) {
      server.healthStatus = healthStatus;
      server.lastHealthCheckAt = Date.now();
    }
  }
  
  /**
   * 获取统计信息
   */
  getStats(): McpRegistryStats {
    const servers = this.listServers();
    const enabledServers = servers.filter(s => s.enabled).length;
    
    const byServer: Record<string, { tools: number; resources: number; prompts: number }> = {};
    let totalTools = 0;
    let totalResources = 0;
    let totalPrompts = 0;
    
    for (const server of servers) {
      byServer[server.id] = {
        tools: server.tools.length,
        resources: server.resources.length,
        prompts: server.prompts.length,
      };
      totalTools += server.tools.length;
      totalResources += server.resources.length;
      totalPrompts += server.prompts.length;
    }
    
    return {
      totalServers: servers.length,
      enabledServers,
      totalTools,
      totalResources,
      totalPrompts,
      byServer,
      byType: {
        tool: totalTools,
        resource: totalResources,
        prompt: totalPrompts,
      },
    };
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建 MCP 注册表
 */
export function createMcpRegistry(config?: McpRegistryConfig): McpRegistry {
  return new McpRegistry(config);
}
