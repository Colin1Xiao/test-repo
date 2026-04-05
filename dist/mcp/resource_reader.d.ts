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
import type { McpResourceDocument, McpAccessContext, ResourceListOptions, ResourceListResult, ResourceReadOptions } from './types';
import { ResourceRegistry } from './resource_registry';
import { McpAccessControl } from './mcp_access_control';
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
    listResources(serverId: string, resourceType: string, options?: ResourceListOptions): Promise<ResourceListResult>;
    /**
     * 读取资源
     */
    readResource(serverId: string, resourceType: string, resourceId: string, options?: ResourceReadOptions): Promise<McpResourceDocument>;
}
export declare class ResourceReader {
    private config;
    private registry;
    private accessControl;
    private executor?;
    constructor(registry: ResourceRegistry, accessControl: McpAccessControl, executor?: IResourceExecutor, config?: ResourceReaderConfig);
    /**
     * 设置资源执行器
     */
    setExecutor(executor: IResourceExecutor): void;
    /**
     * 列出资源
     */
    listResources(context: McpAccessContext, serverId: string, resourceType: string, options?: ResourceListOptions): Promise<ResourceListResult>;
    /**
     * 读取资源
     */
    readResource(context: McpAccessContext, serverId: string, resourceType: string, resourceId: string, options?: ResourceReadOptions): Promise<McpResourceDocument>;
    /**
     * 标准化文档
     */
    private normalizeDocument;
}
/**
 * 创建资源读取器
 */
export declare function createResourceReader(registry: ResourceRegistry, accessControl: McpAccessControl, executor?: IResourceExecutor, config?: ResourceReaderConfig): ResourceReader;
