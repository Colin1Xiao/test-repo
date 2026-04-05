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
import type { McpResourceTypeDescriptor, McpResourceAction } from './types';
/**
 * 注册表配置
 */
export interface ResourceRegistryConfig {
    /** 允许重复注册 */
    allowReregistration?: boolean;
}
export declare class ResourceRegistry {
    private config;
    private resourceTypes;
    private byQualifiedName;
    constructor(config?: ResourceRegistryConfig);
    /**
     * 注册资源类型
     */
    registerResourceType(descriptor: McpResourceTypeDescriptor): Promise<boolean>;
    /**
     * 获取资源类型
     */
    getResourceType(serverId: string, resourceType: string): McpResourceTypeDescriptor | null;
    /**
     * 获取资源类型（通过限定名称）
     */
    getResourceTypeByName(qualifiedName: string): McpResourceTypeDescriptor | null;
    /**
     * 列出资源类型
     */
    listResourceTypes(serverId?: string): McpResourceTypeDescriptor[];
    /**
     * 检查是否支持某动作
     */
    supportsAction(serverId: string, resourceType: string, action: McpResourceAction): boolean;
    /**
     * 注销资源类型
     */
    unregisterResourceType(serverId: string, resourceType: string): Promise<boolean>;
    /**
     * 启用/禁用资源类型
     */
    setResourceTypeEnabled(serverId: string, resourceType: string, enabled: boolean): void;
    /**
     * 获取统计信息
     */
    getStats(): {
        totalResourceTypes: number;
        byServer: Record<string, number>;
        byAction: Record<McpResourceAction, number>;
    };
}
/**
 * 创建资源注册表
 */
export declare function createResourceRegistry(config?: ResourceRegistryConfig): ResourceRegistry;
