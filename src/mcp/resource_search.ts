/**
 * Resource Search - 资源搜索器
 * 
 * 职责：
 * 1. 对指定 server/resourceType 做查询
 * 2. 做跨资源类型搜索的最小封装
 * 3. 统一返回搜索命中结果
 * 4. 接入权限判断与审批
 * 5. 产出可供 planner/repo_reader/release 等角色消费的资源摘要
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type {
  McpResourceRef,
  McpResourceSearchHit,
  McpResourceTypeDescriptor,
  McpAccessContext,
  ResourceSearchOptions,
  ResourceSearchResult,
} from './types';
import { ResourceRegistry } from './resource_registry';
import { McpAccessControl } from './mcp_access_control';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 资源搜索器配置
 */
export interface ResourceSearcherConfig {
  /** 默认最大结果数 */
  defaultMaxResults?: number;
  
  /** 默认最小分数 */
  defaultMinScore?: number;
}

/**
 * 资源搜索执行器接口
 */
export interface IResourceSearchExecutor {
  /**
   * 搜索资源
   */
  searchResources(
    serverId: string,
    resourceType: string,
    query: string,
    options?: ResourceSearchOptions
  ): Promise<ResourceSearchResult>;
  
  /**
   * 跨资源类型搜索
   */
  searchAcrossResources(
    serverId: string,
    query: string,
    options?: ResourceSearchOptions
  ): Promise<ResourceSearchResult>;
}

// ============================================================================
// 资源搜索器
// ============================================================================

export class ResourceSearcher {
  private config: Required<ResourceSearcherConfig>;
  private registry: ResourceRegistry;
  private accessControl: McpAccessControl;
  private executor?: IResourceSearchExecutor;
  
  constructor(
    registry: ResourceRegistry,
    accessControl: McpAccessControl,
    executor?: IResourceSearchExecutor,
    config: ResourceSearcherConfig = {}
  ) {
    this.config = {
      defaultMaxResults: config.defaultMaxResults ?? 20,
      defaultMinScore: config.defaultMinScore ?? 0.5,
    };
    this.registry = registry;
    this.accessControl = accessControl;
    this.executor = executor;
  }
  
  /**
   * 设置搜索执行器
   */
  setExecutor(executor: IResourceSearchExecutor): void {
    this.executor = executor;
  }
  
  /**
   * 搜索资源
   */
  async searchResources(
    context: McpAccessContext,
    serverId: string,
    resourceType: string,
    query: string,
    options?: ResourceSearchOptions
  ): Promise<ResourceSearchResult> {
    // 检查资源类型是否注册
    const descriptor = this.registry.getResourceType(serverId, resourceType);
    if (!descriptor) {
      throw new Error(`Resource type ${resourceType} not registered for server ${serverId}`);
    }
    
    // 检查是否支持 search 动作
    if (!descriptor.supportedActions.includes('search')) {
      throw new Error(`Resource type ${resourceType} does not support search action`);
    }
    
    // 检查访问权限
    const accessResult = await this.accessControl.checkResourceAccess(
      context,
      descriptor.qualifiedName,
      'search'
    );
    
    if (!accessResult.allowed) {
      throw new Error(accessResult.error || 'Access denied');
    }
    
    // 如果需要审批，等待审批完成
    if (accessResult.requiresApproval && accessResult.approvalRequest) {
      // 简化实现：实际应该等待审批完成
      console.log('Approval required for resource search:', accessResult.approvalRequest);
    }
    
    // 执行搜索
    if (!this.executor) {
      throw new Error('Resource search executor not set');
    }
    
    const mergedOptions: ResourceSearchOptions = {
      maxResults: options?.maxResults ?? this.config.defaultMaxResults,
      minScore: options?.minScore ?? this.config.defaultMinScore,
      filters: options?.filters,
    };
    
    return await this.executor.searchResources(
      serverId,
      resourceType,
      query,
      mergedOptions
    );
  }
  
  /**
   * 跨资源类型搜索
   */
  async searchAcrossResources(
    context: McpAccessContext,
    serverId: string,
    query: string,
    options?: ResourceSearchOptions
  ): Promise<ResourceSearchResult> {
    // 获取 server 下所有支持 search 的资源类型
    const resourceTypes = this.registry.listResourceTypes(serverId);
    const searchableTypes = resourceTypes.filter(rt =>
      rt.supportedActions.includes('search') && rt.enabled
    );
    
    if (searchableTypes.length === 0) {
      return {
        hits: [],
        totalHits: 0,
        searchDurationMs: 0,
      };
    }
    
    // 执行跨资源类型搜索
    if (!this.executor) {
      throw new Error('Resource search executor not set');
    }
    
    const mergedOptions: ResourceSearchOptions = {
      maxResults: options?.maxResults ?? this.config.defaultMaxResults,
      minScore: options?.minScore ?? this.config.defaultMinScore,
      filters: options?.filters,
    };
    
    // 检查权限后执行搜索
    const result = await this.executor.searchAcrossResources(
      serverId,
      query,
      mergedOptions
    );
    
    // 过滤无权限的结果
    const authorizedHits: McpResourceSearchHit[] = [];
    
    for (const hit of result.hits) {
      const descriptor = this.registry.getResourceType(serverId, hit.ref.resourceType);
      if (!descriptor) {
        continue;
      }
      
      // 检查 search 权限
      const accessResult = await this.accessControl.checkResourceAccess(
        context,
        descriptor.qualifiedName,
        'search'
      );
      
      if (accessResult.allowed) {
        authorizedHits.push(hit);
      }
    }
    
    return {
      hits: authorizedHits,
      totalHits: authorizedHits.length,
      searchDurationMs: result.searchDurationMs,
    };
  }
  
  /**
   * 总结搜索命中
   */
  summarizeSearchHits(results: ResourceSearchResult, maxSummaries: number = 5): string {
    if (results.hits.length === 0) {
      return 'No resources found.';
    }
    
    const summaries: string[] = [];
    
    for (let i = 0; i < Math.min(results.hits.length, maxSummaries); i++) {
      const hit = results.hits[i];
      
      let summary = `[${hit.ref.server}/${hit.ref.resourceType}]`;
      
      if (hit.title) {
        summary += ` ${hit.title}`;
      } else {
        summary += ` ${hit.ref.resourceId}`;
      }
      
      if (hit.snippet) {
        summary += ` - ${hit.snippet}`;
      }
      
      summaries.push(summary);
    }
    
    if (results.hits.length > maxSummaries) {
      summaries.push(`... and ${results.hits.length - maxSummaries} more results.`);
    }
    
    return summaries.join('\n');
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建资源搜索器
 */
export function createResourceSearcher(
  registry: ResourceRegistry,
  accessControl: McpAccessControl,
  executor?: IResourceSearchExecutor,
  config?: ResourceSearcherConfig
): ResourceSearcher {
  return new ResourceSearcher(registry, accessControl, executor, config);
}
