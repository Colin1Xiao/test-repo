/**
 * Resource Reader - 资源读取器
 * 
 * 职责：
 * 1. 统一执行 list / read
 * 2. 把不同 server 的 resource 返回标准化
 * 3. 接入 3B 的 access control / approval
 * 4. 产出可直接给 agent 消费的 ResourceDocument
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type {
  McpResourceRef,
  McpResourceDocument,
  McpResourceTypeDescriptor,
  McpAccessContext,
  ResourceListOptions,
  ResourceListResult,
  ResourceReadOptions,
} from './types';
import { ResourceRegistry } from './resource_registry';
import { McpAccessControl } from './mcp_access_control';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 资源读取器配置
 */
export interface ResourceReaderConfig {
  /** 默认内容格式 */
  defaultFormat?: 'text' | 'markdown' | 'json' | 'html';
}

/**
 * 资源执行器接口
 */
export interface IResourceExecutor {
  /**
   * 列出资源
   */
  listResources(
    serverId: string,
    resourceType: string,
    options?: ResourceListOptions
  ): Promise<ResourceListResult>;
  
  /**
   * 读取资源
   */
  readResource(
    serverId: string,
    resourceType: string,
    resourceId: string,
    options?: ResourceReadOptions
  ): Promise<McpResourceDocument>;
}

// ============================================================================
// 资源读取器
// ============================================================================

export class ResourceReader {
  private config: Required<ResourceReaderConfig>;
  private registry: ResourceRegistry;
  private accessControl: McpAccessControl;
  private executor?: IResourceExecutor;
  
  constructor(
    registry: ResourceRegistry,
    accessControl: McpAccessControl,
    executor?: IResourceExecutor,
    config: ResourceReaderConfig = {}
  ) {
    this.config = {
      defaultFormat: config.defaultFormat ?? 'text',
    };
    this.registry = registry;
    this.accessControl = accessControl;
    this.executor = executor;
  }
  
  /**
   * 设置资源执行器
   */
  setExecutor(executor: IResourceExecutor): void {
    this.executor = executor;
  }
  
  /**
   * 列出资源
   */
  async listResources(
    context: McpAccessContext,
    serverId: string,
    resourceType: string,
    options?: ResourceListOptions
  ): Promise<ResourceListResult> {
    // 检查资源类型是否注册
    const descriptor = this.registry.getResourceType(serverId, resourceType);
    if (!descriptor) {
      throw new Error(`Resource type ${resourceType} not registered for server ${serverId}`);
    }
    
    // 检查是否支持 list 动作
    if (!descriptor.supportedActions.includes('list')) {
      throw new Error(`Resource type ${resourceType} does not support list action`);
    }
    
    // 检查访问权限
    const accessResult = await this.accessControl.checkResourceAccess(
      context,
      descriptor.qualifiedName,
      'read' // list 视为 read 的一种
    );
    
    if (!accessResult.allowed) {
      throw new Error(accessResult.error || 'Access denied');
    }
    
    // 执行 list
    if (!this.executor) {
      throw new Error('Resource executor not set');
    }
    
    return await this.executor.listResources(serverId, resourceType, options);
  }
  
  /**
   * 读取资源
   */
  async readResource(
    context: McpAccessContext,
    serverId: string,
    resourceType: string,
    resourceId: string,
    options?: ResourceReadOptions
  ): Promise<McpResourceDocument> {
    // 检查资源类型是否注册
    const descriptor = this.registry.getResourceType(serverId, resourceType);
    if (!descriptor) {
      throw new Error(`Resource type ${resourceType} not registered for server ${serverId}`);
    }
    
    // 检查是否支持 read 动作
    if (!descriptor.supportedActions.includes('read')) {
      throw new Error(`Resource type ${resourceType} does not support read action`);
    }
    
    // 检查访问权限
    const accessResult = await this.accessControl.checkResourceAccess(
      context,
      descriptor.qualifiedName,
      'read'
    );
    
    if (!accessResult.allowed) {
      throw new Error(accessResult.error || 'Access denied');
    }
    
    // 如果需要审批，等待审批完成
    if (accessResult.requiresApproval && accessResult.approvalRequest) {
      // 简化实现：实际应该等待审批完成
      console.log('Approval required for resource read:', accessResult.approvalRequest);
    }
    
    // 执行 read
    if (!this.executor) {
      throw new Error('Resource executor not set');
    }
    
    const document = await this.executor.readResource(
      serverId,
      resourceType,
      resourceId,
      options
    );
    
    // 标准化文档
    return this.normalizeDocument(document, descriptor);
  }
  
  /**
   * 标准化文档
   */
  private normalizeDocument(
    document: McpResourceDocument,
    descriptor: McpResourceTypeDescriptor
  ): McpResourceDocument {
    return {
      ...document,
      ref: {
        server: descriptor.server,
        resourceType: descriptor.resourceType,
        resourceId: document.ref.resourceId,
        uri: document.ref.uri,
      },
      contentType: document.contentType || 'text',
      fetchedAt: document.fetchedAt || new Date().toISOString(),
      sourceCapability: descriptor.qualifiedName,
    };
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建资源读取器
 */
export function createResourceReader(
  registry: ResourceRegistry,
  accessControl: McpAccessControl,
  executor?: IResourceExecutor,
  config?: ResourceReaderConfig
): ResourceReader {
  return new ResourceReader(registry, accessControl, executor, config);
}
