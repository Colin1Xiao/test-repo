/**
 * Resource Registry - 资源注册表
 * 
 * 职责：
 * 1. 注册 server 提供的 resource types
 * 2. 描述每类 resource 支持的操作
 * 3. 建立 resource type → server → capability 索引
 * 4. 查询某 server 下有哪些资源语义
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type {
  McpResourceTypeDescriptor,
  McpResourceAction,
} from './types';
import { buildResourceName, normalizeServerName } from './mcp_naming';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 注册表配置
 */
export interface ResourceRegistryConfig {
  /** 允许重复注册 */
  allowReregistration?: boolean;
}

// ============================================================================
// 资源注册表
// ============================================================================

export class ResourceRegistry {
  private config: Required<ResourceRegistryConfig>;
  
  // 资源类型存储：server → resourceType → descriptor
  private resourceTypes: Map<string, Map<string, McpResourceTypeDescriptor>> = new Map();
  
  // 限定名称索引：qualifiedName → descriptor
  private byQualifiedName: Map<string, McpResourceTypeDescriptor> = new Map();
  
  constructor(config: ResourceRegistryConfig = {}) {
    this.config = {
      allowReregistration: config.allowReregistration ?? false,
    };
  }
  
  /**
   * 注册资源类型
   */
  async registerResourceType(
    descriptor: McpResourceTypeDescriptor
  ): Promise<boolean> {
    const serverId = normalizeServerName(descriptor.server);
    const resourceType = descriptor.resourceType.toLowerCase();
    
    // 检查是否已存在
    const serverResources = this.resourceTypes.get(serverId);
    if (serverResources && serverResources.has(resourceType)) {
      if (!this.config.allowReregistration) {
        throw new Error(
          `Resource type ${resourceType} already registered for server ${serverId}. ` +
          'Set allowReregistration=true to override.'
        );
      }
    }
    
    // 构建限定名称
    const qualifiedName = buildResourceName(serverId, resourceType);
    descriptor.qualifiedName = qualifiedName;
    
    // 存储
    if (!serverResources) {
      this.resourceTypes.set(serverId, new Map());
    }
    this.resourceTypes.get(serverId)!.set(resourceType, descriptor);
    this.byQualifiedName.set(qualifiedName, descriptor);
    
    return true;
  }
  
  /**
   * 获取资源类型
   */
  getResourceType(
    serverId: string,
    resourceType: string
  ): McpResourceTypeDescriptor | null {
    const normalizedServerId = normalizeServerName(serverId);
    const normalizedResourceType = resourceType.toLowerCase();
    
    const serverResources = this.resourceTypes.get(normalizedServerId);
    if (!serverResources) {
      return null;
    }
    
    return serverResources.get(normalizedResourceType) || null;
  }
  
  /**
   * 获取资源类型（通过限定名称）
   */
  getResourceTypeByName(qualifiedName: string): McpResourceTypeDescriptor | null {
    return this.byQualifiedName.get(qualifiedName) || null;
  }
  
  /**
   * 列出资源类型
   */
  listResourceTypes(serverId?: string): McpResourceTypeDescriptor[] {
    if (serverId) {
      const normalizedServerId = normalizeServerName(serverId);
      const serverResources = this.resourceTypes.get(normalizedServerId);
      
      if (!serverResources) {
        return [];
      }
      
      return Array.from(serverResources.values());
    }
    
    // 返回所有资源类型
    const all: McpResourceTypeDescriptor[] = [];
    for (const serverResources of this.resourceTypes.values()) {
      all.push(...Array.from(serverResources.values()));
    }
    return all;
  }
  
  /**
   * 检查是否支持某动作
   */
  supportsAction(
    serverId: string,
    resourceType: string,
    action: McpResourceAction
  ): boolean {
    const descriptor = this.getResourceType(serverId, resourceType);
    if (!descriptor) {
      return false;
    }
    
    return descriptor.supportedActions.includes(action);
  }
  
  /**
   * 注销资源类型
   */
  async unregisterResourceType(
    serverId: string,
    resourceType: string
  ): Promise<boolean> {
    const normalizedServerId = normalizeServerName(serverId);
    const normalizedResourceType = resourceType.toLowerCase();
    
    const serverResources = this.resourceTypes.get(normalizedServerId);
    if (!serverResources) {
      return false;
    }
    
    const descriptor = serverResources.get(normalizedResourceType);
    if (descriptor) {
      this.byQualifiedName.delete(descriptor.qualifiedName);
    }
    
    return serverResources.delete(normalizedResourceType);
  }
  
  /**
   * 启用/禁用资源类型
   */
  setResourceTypeEnabled(
    serverId: string,
    resourceType: string,
    enabled: boolean
  ): void {
    const descriptor = this.getResourceType(serverId, resourceType);
    if (descriptor) {
      descriptor.enabled = enabled;
    }
  }
  
  /**
   * 获取统计信息
   */
  getStats(): {
    totalResourceTypes: number;
    byServer: Record<string, number>;
    byAction: Record<McpResourceAction, number>;
  } {
    const byServer: Record<string, number> = {};
    const byAction: Record<McpResourceAction, number> = {
      list: 0,
      read: 0,
      search: 0,
    };
    
    let total = 0;
    
    for (const [serverId, resources] of this.resourceTypes.entries()) {
      byServer[serverId] = resources.size;
      total += resources.size;
      
      for (const descriptor of resources.values()) {
        for (const action of descriptor.supportedActions) {
          byAction[action]++;
        }
      }
    }
    
    return {
      totalResourceTypes: total,
      byServer,
      byAction,
    };
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建资源注册表
 */
export function createResourceRegistry(config?: ResourceRegistryConfig): ResourceRegistry {
  return new ResourceRegistry(config);
}
