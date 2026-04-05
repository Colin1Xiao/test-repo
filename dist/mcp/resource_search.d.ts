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
import type { McpAccessContext, ResourceSearchOptions, ResourceSearchResult } from './types';
import { ResourceRegistry } from './resource_registry';
import { McpAccessControl } from './mcp_access_control';
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
    searchResources(serverId: string, resourceType: string, query: string, options?: ResourceSearchOptions): Promise<ResourceSearchResult>;
    /**
     * 跨资源类型搜索
     */
    searchAcrossResources(serverId: string, query: string, options?: ResourceSearchOptions): Promise<ResourceSearchResult>;
}
export declare class ResourceSearcher {
    private config;
    private registry;
    private accessControl;
    private executor?;
    constructor(registry: ResourceRegistry, accessControl: McpAccessControl, executor?: IResourceSearchExecutor, config?: ResourceSearcherConfig);
    /**
     * 设置搜索执行器
     */
    setExecutor(executor: IResourceSearchExecutor): void;
    /**
     * 搜索资源
     */
    searchResources(context: McpAccessContext, serverId: string, resourceType: string, query: string, options?: ResourceSearchOptions): Promise<ResourceSearchResult>;
    /**
     * 跨资源类型搜索
     */
    searchAcrossResources(context: McpAccessContext, serverId: string, query: string, options?: ResourceSearchOptions): Promise<ResourceSearchResult>;
    /**
     * 总结搜索命中
     */
    summarizeSearchHits(results: ResourceSearchResult, maxSummaries?: number): string;
}
/**
 * 创建资源搜索器
 */
export declare function createResourceSearcher(registry: ResourceRegistry, accessControl: McpAccessControl, executor?: IResourceSearchExecutor, config?: ResourceSearcherConfig): ResourceSearcher;
