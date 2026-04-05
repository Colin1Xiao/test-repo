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
import type { McpServerDescriptor, McpToolDescriptor, McpResourceDescriptor, McpPromptDescriptor, McpRegistrationResult, McpRegistryStats } from './types';
/**
 * 注册表配置
 */
export interface McpRegistryConfig {
    /** 允许重复注册 */
    allowReregistration?: boolean;
}
export declare class McpRegistry {
    private config;
    private servers;
    private toolsByName;
    private resourcesByName;
    private promptsByName;
    constructor(config?: McpRegistryConfig);
    /**
     * 注册 Server
     */
    registerServer(descriptor: McpServerDescriptor): Promise<McpRegistrationResult>;
    /**
     * 注册 Tool
     */
    registerTool(serverId: string, toolDescriptor: McpToolDescriptor): Promise<boolean>;
    /**
     * 注册 Resource
     */
    registerResource(serverId: string, resourceDescriptor: McpResourceDescriptor): Promise<boolean>;
    /**
     * 注册 Prompt
     */
    registerPrompt(serverId: string, promptDescriptor: McpPromptDescriptor): Promise<boolean>;
    /**
     * 注销 Server
     */
    unregisterServer(serverId: string): Promise<boolean>;
    /**
     * 获取 Server
     */
    getServer(serverId: string): McpServerDescriptor | null;
    /**
     * 获取 Capability
     */
    getCapability(qualifiedName: string): McpToolDescriptor | McpResourceDescriptor | McpPromptDescriptor | null;
    /**
     * 列出所有 Server
     */
    listServers(): McpServerDescriptor[];
    /**
     * 列出所有 Capability
     */
    listCapabilities(serverId?: string): Array<McpToolDescriptor | McpResourceDescriptor | McpPromptDescriptor>;
    /**
     * 启用/禁用 Server
     */
    setServerEnabled(serverId: string, enabled: boolean): void;
    /**
     * 更新 Server 健康状态
     */
    updateServerHealth(serverId: string, healthStatus: 'healthy' | 'degraded' | 'unhealthy'): void;
    /**
     * 获取统计信息
     */
    getStats(): McpRegistryStats;
}
/**
 * 创建 MCP 注册表
 */
export declare function createMcpRegistry(config?: McpRegistryConfig): McpRegistry;
