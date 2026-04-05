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
import type { McpServerDescriptor, McpCapabilityType, McpCapabilitySummary, McpToolDescriptor, McpResourceDescriptor, McpPromptDescriptor } from './types';
import { McpRegistry } from './mcp_registry';
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
export declare class CapabilityIndex {
    private config;
    private registry;
    constructor(registry: McpRegistry, config?: CapabilityIndexConfig);
    /**
     * 按 Server 查询
     */
    findByServer(serverId: string): McpCapabilitySummary[];
    /**
     * 按类型查询
     */
    findByType(type: McpCapabilityType): McpCapabilitySummary[];
    /**
     * 按关键词搜索
     */
    searchCapabilities(query: CapabilitySearchQuery): McpCapabilitySummary[];
    /**
     * 构建能力摘要
     */
    buildSummary(capability: McpToolDescriptor | McpResourceDescriptor | McpPromptDescriptor, server: McpServerDescriptor | null): McpCapabilitySummary;
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
    }>;
    /**
     * 获取 Tool 摘要
     */
    getToolSummary(qualifiedName: string): McpCapabilitySummary | null;
    /**
     * 获取 Resource 摘要
     */
    getResourceSummary(qualifiedName: string): McpCapabilitySummary | null;
    /**
     * 获取 Prompt 摘要
     */
    getPromptSummary(qualifiedName: string): McpCapabilitySummary | null;
    /**
     * 获取 Capability 类型
     */
    private getCapabilityType;
    /**
     * 检查关键词匹配
     */
    private matchesKeyword;
}
/**
 * 创建能力索引
 */
export declare function createCapabilityIndex(registry: McpRegistry, config?: CapabilityIndexConfig): CapabilityIndex;
