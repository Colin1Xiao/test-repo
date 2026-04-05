"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpRegistry = void 0;
exports.createMcpRegistry = createMcpRegistry;
const mcp_naming_1 = require("./mcp_naming");
// ============================================================================
// MCP 注册表
// ============================================================================
class McpRegistry {
    constructor(config = {}) {
        // Server 存储
        this.servers = new Map();
        // Tool 索引
        this.toolsByName = new Map();
        // Resource 索引
        this.resourcesByName = new Map();
        // Prompt 索引
        this.promptsByName = new Map();
        this.config = {
            allowReregistration: config.allowReregistration ?? false,
        };
    }
    /**
     * 注册 Server
     */
    async registerServer(descriptor) {
        const serverId = (0, mcp_naming_1.normalizeServerName)(descriptor.id);
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
        const toolNames = [];
        for (const tool of descriptor.tools || []) {
            const qualifiedName = (0, mcp_naming_1.buildToolName)(serverId, tool.name);
            (0, mcp_naming_1.checkNameConflict)(toolNames, qualifiedName, `Tool ${tool.name}`);
            tool.qualifiedName = qualifiedName;
            toolNames.push(qualifiedName);
        }
        // 验证资源名称
        const resourceNames = [];
        for (const resource of descriptor.resources || []) {
            const qualifiedName = (0, mcp_naming_1.buildResourceName)(serverId, resource.resourceType);
            (0, mcp_naming_1.checkNameConflict)(resourceNames, qualifiedName, `Resource ${resource.resourceType}`);
            resource.qualifiedName = qualifiedName;
            resourceNames.push(qualifiedName);
        }
        // 验证 Prompt 名称
        const promptNames = [];
        for (const prompt of descriptor.prompts || []) {
            const qualifiedName = (0, mcp_naming_1.buildPromptName)(serverId, prompt.name);
            (0, mcp_naming_1.checkNameConflict)(promptNames, qualifiedName, `Prompt ${prompt.name}`);
            prompt.qualifiedName = qualifiedName;
            promptNames.push(qualifiedName);
        }
        // 构建能力引用
        const capabilities = [
            ...(descriptor.tools || []).map(t => ({
                type: 'tool',
                qualifiedName: t.qualifiedName,
                description: t.description,
                enabled: t.enabled,
            })),
            ...(descriptor.resources || []).map(r => ({
                type: 'resource',
                qualifiedName: r.qualifiedName,
                description: r.description,
                enabled: r.enabled,
            })),
            ...(descriptor.prompts || []).map(p => ({
                type: 'prompt',
                qualifiedName: p.qualifiedName,
                description: p.description,
                enabled: p.enabled,
            })),
        ];
        // 创建 Server 描述符
        const serverDescriptor = {
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
    async registerTool(serverId, toolDescriptor) {
        const normalizedServerId = (0, mcp_naming_1.normalizeServerName)(serverId);
        const server = this.servers.get(normalizedServerId);
        if (!server) {
            throw new Error(`Server ${normalizedServerId} not found`);
        }
        const qualifiedName = (0, mcp_naming_1.buildToolName)(normalizedServerId, toolDescriptor.name);
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
    async registerResource(serverId, resourceDescriptor) {
        const normalizedServerId = (0, mcp_naming_1.normalizeServerName)(serverId);
        const server = this.servers.get(normalizedServerId);
        if (!server) {
            throw new Error(`Server ${normalizedServerId} not found`);
        }
        const qualifiedName = (0, mcp_naming_1.buildResourceName)(normalizedServerId, resourceDescriptor.resourceType);
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
    async registerPrompt(serverId, promptDescriptor) {
        const normalizedServerId = (0, mcp_naming_1.normalizeServerName)(serverId);
        const server = this.servers.get(normalizedServerId);
        if (!server) {
            throw new Error(`Server ${normalizedServerId} not found`);
        }
        const qualifiedName = (0, mcp_naming_1.buildPromptName)(normalizedServerId, promptDescriptor.name);
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
    async unregisterServer(serverId) {
        const normalizedServerId = (0, mcp_naming_1.normalizeServerName)(serverId);
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
    getServer(serverId) {
        const normalizedServerId = (0, mcp_naming_1.normalizeServerName)(serverId);
        return this.servers.get(normalizedServerId) || null;
    }
    /**
     * 获取 Capability
     */
    getCapability(qualifiedName) {
        return (this.toolsByName.get(qualifiedName) ||
            this.resourcesByName.get(qualifiedName) ||
            this.promptsByName.get(qualifiedName) ||
            null);
    }
    /**
     * 列出所有 Server
     */
    listServers() {
        return Array.from(this.servers.values());
    }
    /**
     * 列出所有 Capability
     */
    listCapabilities(serverId) {
        if (serverId) {
            const normalizedServerId = (0, mcp_naming_1.normalizeServerName)(serverId);
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
    setServerEnabled(serverId, enabled) {
        const normalizedServerId = (0, mcp_naming_1.normalizeServerName)(serverId);
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
    updateServerHealth(serverId, healthStatus) {
        const normalizedServerId = (0, mcp_naming_1.normalizeServerName)(serverId);
        const server = this.servers.get(normalizedServerId);
        if (server) {
            server.healthStatus = healthStatus;
            server.lastHealthCheckAt = Date.now();
        }
    }
    /**
     * 获取统计信息
     */
    getStats() {
        const servers = this.listServers();
        const enabledServers = servers.filter(s => s.enabled).length;
        const byServer = {};
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
exports.McpRegistry = McpRegistry;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建 MCP 注册表
 */
function createMcpRegistry(config) {
    return new McpRegistry(config);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwX3JlZ2lzdHJ5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL21jcC9tY3BfcmVnaXN0cnkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7Ozs7R0FZRzs7O0FBa2JILDhDQUVDO0FBdmFELDZDQU1zQjtBQWN0QiwrRUFBK0U7QUFDL0UsVUFBVTtBQUNWLCtFQUErRTtBQUUvRSxNQUFhLFdBQVc7SUFldEIsWUFBWSxTQUE0QixFQUFFO1FBWjFDLFlBQVk7UUFDSixZQUFPLEdBQTBDLElBQUksR0FBRyxFQUFFLENBQUM7UUFFbkUsVUFBVTtRQUNGLGdCQUFXLEdBQW1DLElBQUksR0FBRyxFQUFFLENBQUM7UUFFaEUsY0FBYztRQUNOLG9CQUFlLEdBQXVDLElBQUksR0FBRyxFQUFFLENBQUM7UUFFeEUsWUFBWTtRQUNKLGtCQUFhLEdBQXFDLElBQUksR0FBRyxFQUFFLENBQUM7UUFHbEUsSUFBSSxDQUFDLE1BQU0sR0FBRztZQUNaLG1CQUFtQixFQUFFLE1BQU0sQ0FBQyxtQkFBbUIsSUFBSSxLQUFLO1NBQ3pELENBQUM7SUFDSixDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsY0FBYyxDQUNsQixVQUErQjtRQUUvQixNQUFNLFFBQVEsR0FBRyxJQUFBLGdDQUFtQixFQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUVwRCxVQUFVO1FBQ1YsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDNUMsSUFBSSxRQUFRLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLG1CQUFtQixFQUFFLENBQUM7WUFDakQsT0FBTztnQkFDTCxPQUFPLEVBQUUsS0FBSztnQkFDZCxRQUFRO2dCQUNSLGVBQWUsRUFBRSxDQUFDO2dCQUNsQixtQkFBbUIsRUFBRSxDQUFDO2dCQUN0QixpQkFBaUIsRUFBRSxDQUFDO2dCQUNwQixLQUFLLEVBQUUs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U0FBUyxFQUFFLE1BQU0sQ0FBQyxTQUFTLENBQUMsTUFBTTtnQkFDbEMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTTthQUMvQixDQUFDO1lBQ0YsVUFBVSxJQUFJLE1BQU0sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDO1lBQ2xDLGNBQWMsSUFBSSxNQUFNLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQztZQUMxQyxZQUFZLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUM7UUFDeEMsQ0FBQztRQUVELE9BQU87WUFDTCxZQUFZLEVBQUUsT0FBTyxDQUFDLE1BQU07WUFDNUIsY0FBYztZQUNkLFVBQVU7WUFDVixjQUFjO1lBQ2QsWUFBWTtZQUNaLFFBQVE7WUFDUixNQUFNLEVBQUU7Z0JBQ04sSUFBSSxFQUFFLFVBQVU7Z0JBQ2hCLFFBQVEsRUFBRSxjQUFjO2dCQUN4QixNQUFNLEVBQUUsWUFBWTthQUNyQjtTQUNGLENBQUM7SUFDSixDQUFDO0NBQ0Y7QUFwWUQsa0NBb1lDO0FBRUQsK0VBQStFO0FBQy9FLE9BQU87QUFDUCwrRUFBK0U7QUFFL0U7O0dBRUc7QUFDSCxTQUFnQixpQkFBaUIsQ0FBQyxNQUEwQjtJQUMxRCxPQUFPLElBQUksV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ2pDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIE1DUCBSZWdpc3RyeSAtIE1DUCDms6jlhozooahcbiAqIFxuICog6IGM6LSj77yaXG4gKiAxLiBTZXJ2ZXIg5rOo5YaML+azqOmUgFxuICogMi4gVG9vbC9SZXNvdXJjZS9Qcm9tcHQg5rOo5YaMXG4gKiAzLiDpmLLph43lkI3lhrLnqoFcbiAqIDQuIOafpeivoiBTZXJ2ZXIg5ZKMIENhcGFiaWxpdHlcbiAqIDUuIOWQr+eUqC/npoHnlKjmjqfliLZcbiAqIFxuICogQHZlcnNpb24gdjAuMS4wXG4gKiBAZGF0ZSAyMDI2LTA0LTAzXG4gKi9cblxuaW1wb3J0IHR5cGUge1xuICBNY3BTZXJ2ZXJJZCxcbiAgTWNwU2VydmVyRGVzY3JpcHRvcixcbiAgTWNwVG9vbERlc2NyaXB0b3IsXG4gIE1jcFJlc291cmNlRGVzY3JpcHRvcixcbiAgTWNwUHJvbXB0RGVzY3JpcHRvcixcbiAgTWNwQ2FwYWJpbGl0eVJlZixcbiAgTWNwQ2FwYWJpbGl0eVR5cGUsXG4gIE1jcFJlZ2lzdHJhdGlvblJlc3VsdCxcbiAgTWNwUmVnaXN0cnlTdGF0cyxcbn0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQge1xuICBidWlsZFRvb2xOYW1lLFxuICBidWlsZFJlc291cmNlTmFtZSxcbiAgYnVpbGRQcm9tcHROYW1lLFxuICBub3JtYWxpemVTZXJ2ZXJOYW1lLFxuICBjaGVja05hbWVDb25mbGljdCxcbn0gZnJvbSAnLi9tY3BfbmFtaW5nJztcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g57G75Z6L5a6a5LmJXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog5rOo5YaM6KGo6YWN572uXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgTWNwUmVnaXN0cnlDb25maWcge1xuICAvKiog5YWB6K646YeN5aSN5rOo5YaMICovXG4gIGFsbG93UmVyZWdpc3RyYXRpb24/OiBib29sZWFuO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBNQ1Ag5rOo5YaM6KGoXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBjbGFzcyBNY3BSZWdpc3RyeSB7XG4gIHByaXZhdGUgY29uZmlnOiBSZXF1aXJlZDxNY3BSZWdpc3RyeUNvbmZpZz47XG4gIFxuICAvLyBTZXJ2ZXIg5a2Y5YKoXG4gIHByaXZhdGUgc2VydmVyczogTWFwPE1jcFNlcnZlcklkLCBNY3BTZXJ2ZXJEZXNjcmlwdG9yPiA9IG5ldyBNYXAoKTtcbiAgXG4gIC8vIFRvb2wg57Si5byVXG4gIHByaXZhdGUgdG9vbHNCeU5hbWU6IE1hcDxzdHJpbmcsIE1jcFRvb2xEZXNjcmlwdG9yPiA9IG5ldyBNYXAoKTtcbiAgXG4gIC8vIFJlc291cmNlIOe0ouW8lVxuICBwcml2YXRlIHJlc291cmNlc0J5TmFtZTogTWFwPHN0cmluZywgTWNwUmVzb3VyY2VEZXNjcmlwdG9yPiA9IG5ldyBNYXAoKTtcbiAgXG4gIC8vIFByb21wdCDntKLlvJVcbiAgcHJpdmF0ZSBwcm9tcHRzQnlOYW1lOiBNYXA8c3RyaW5nLCBNY3BQcm9tcHREZXNjcmlwdG9yPiA9IG5ldyBNYXAoKTtcbiAgXG4gIGNvbnN0cnVjdG9yKGNvbmZpZzogTWNwUmVnaXN0cnlDb25maWcgPSB7fSkge1xuICAgIHRoaXMuY29uZmlnID0ge1xuICAgICAgYWxsb3dSZXJlZ2lzdHJhdGlvbjogY29uZmlnLmFsbG93UmVyZWdpc3RyYXRpb24gPz8gZmFsc2UsXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOazqOWGjCBTZXJ2ZXJcbiAgICovXG4gIGFzeW5jIHJlZ2lzdGVyU2VydmVyKFxuICAgIGRlc2NyaXB0b3I6IE1jcFNlcnZlckRlc2NyaXB0b3JcbiAgKTogUHJvbWlzZTxNY3BSZWdpc3RyYXRpb25SZXN1bHQ+IHtcbiAgICBjb25zdCBzZXJ2ZXJJZCA9IG5vcm1hbGl6ZVNlcnZlck5hbWUoZGVzY3JpcHRvci5pZCk7XG4gICAgXG4gICAgLy8g5qOA5p+l5piv5ZCm5bey5a2Y5ZyoXG4gICAgY29uc3QgZXhpc3RpbmcgPSB0aGlzLnNlcnZlcnMuZ2V0KHNlcnZlcklkKTtcbiAgICBpZiAoZXhpc3RpbmcgJiYgIXRoaXMuY29uZmlnLmFsbG93UmVyZWdpc3RyYXRpb24pIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBzZXJ2ZXJJZCxcbiAgICAgICAgdG9vbHNSZWdpc3RlcmVkOiAwLFxuICAgICAgICByZXNvdXJjZXNSZWdpc3RlcmVkOiAwLFxuICAgICAgICBwcm9tcHRzUmVnaXN0ZXJlZDogMCxcbiAgICAgICAgZXJyb3I6IGBTZXJ2ZXIgJHtzZXJ2ZXJJZH0gYWxyZWFkeSByZWdpc3RlcmVkLiBTZXQgYWxsb3dSZXJlZ2lzdHJhdGlvbj10cnVlIHRvIG92ZXJyaWRlLmAsXG4gICAgICB9O1xuICAgIH1cbiAgICBcbiAgICAvLyDpqozor4Hlt6XlhbflkI3np7BcbiAgICBjb25zdCB0b29sTmFtZXM6IHN0cmluZ1tdID0gW107XG4gICAgZm9yIChjb25zdCB0b29sIG9mIGRlc2NyaXB0b3IudG9vbHMgfHwgW10pIHtcbiAgICAgIGNvbnN0IHF1YWxpZmllZE5hbWUgPSBidWlsZFRvb2xOYW1lKHNlcnZlcklkLCB0b29sLm5hbWUpO1xuICAgICAgY2hlY2tOYW1lQ29uZmxpY3QodG9vbE5hbWVzLCBxdWFsaWZpZWROYW1lLCBgVG9vbCAke3Rvb2wubmFtZX1gKTtcbiAgICAgIHRvb2wucXVhbGlmaWVkTmFtZSA9IHF1YWxpZmllZE5hbWU7XG4gICAgICB0b29sTmFtZXMucHVzaChxdWFsaWZpZWROYW1lKTtcbiAgICB9XG4gICAgXG4gICAgLy8g6aqM6K+B6LWE5rqQ5ZCN56ewXG4gICAgY29uc3QgcmVzb3VyY2VOYW1lczogc3RyaW5nW10gPSBbXTtcbiAgICBmb3IgKGNvbnN0IHJlc291cmNlIG9mIGRlc2NyaXB0b3IucmVzb3VyY2VzIHx8IFtdKSB7XG4gICAgICBjb25zdCBxdWFsaWZpZWROYW1lID0gYnVpbGRSZXNvdXJjZU5hbWUoc2VydmVySWQsIHJlc291cmNlLnJlc291cmNlVHlwZSk7XG4gICAgICBjaGVja05hbWVDb25mbGljdChyZXNvdXJjZU5hbWVzLCBxdWFsaWZpZWROYW1lLCBgUmVzb3VyY2UgJHtyZXNvdXJjZS5yZXNvdXJjZVR5cGV9YCk7XG4gICAgICByZXNvdXJjZS5xdWFsaWZpZWROYW1lID0gcXVhbGlmaWVkTmFtZTtcbiAgICAgIHJlc291cmNlTmFtZXMucHVzaChxdWFsaWZpZWROYW1lKTtcbiAgICB9XG4gICAgXG4gICAgLy8g6aqM6K+BIFByb21wdCDlkI3np7BcbiAgICBjb25zdCBwcm9tcHROYW1lczogc3RyaW5nW10gPSBbXTtcbiAgICBmb3IgKGNvbnN0IHByb21wdCBvZiBkZXNjcmlwdG9yLnByb21wdHMgfHwgW10pIHtcbiAgICAgIGNvbnN0IHF1YWxpZmllZE5hbWUgPSBidWlsZFByb21wdE5hbWUoc2VydmVySWQsIHByb21wdC5uYW1lKTtcbiAgICAgIGNoZWNrTmFtZUNvbmZsaWN0KHByb21wdE5hbWVzLCBxdWFsaWZpZWROYW1lLCBgUHJvbXB0ICR7cHJvbXB0Lm5hbWV9YCk7XG4gICAgICBwcm9tcHQucXVhbGlmaWVkTmFtZSA9IHF1YWxpZmllZE5hbWU7XG4gICAgICBwcm9tcHROYW1lcy5wdXNoKHF1YWxpZmllZE5hbWUpO1xuICAgIH1cbiAgICBcbiAgICAvLyDmnoTlu7rog73lipvlvJXnlKhcbiAgICBjb25zdCBjYXBhYmlsaXRpZXM6IE1jcENhcGFiaWxpdHlSZWZbXSA9IFtcbiAgICAgIC4uLihkZXNjcmlwdG9yLnRvb2xzIHx8IFtdKS5tYXAodCA9PiAoe1xuICAgICAgICB0eXBlOiAndG9vbCcgYXMgTWNwQ2FwYWJpbGl0eVR5cGUsXG4gICAgICAgIHF1YWxpZmllZE5hbWU6IHQucXVhbGlmaWVkTmFtZSxcbiAgICAgICAgZGVzY3JpcHRpb246IHQuZGVzY3JpcHRpb24sXG4gICAgICAgIGVuYWJsZWQ6IHQuZW5hYmxlZCxcbiAgICAgIH0pKSxcbiAgICAgIC4uLihkZXNjcmlwdG9yLnJlc291cmNlcyB8fCBbXSkubWFwKHIgPT4gKHtcbiAgICAgICAgdHlwZTogJ3Jlc291cmNlJyBhcyBNY3BDYXBhYmlsaXR5VHlwZSxcbiAgICAgICAgcXVhbGlmaWVkTmFtZTogci5xdWFsaWZpZWROYW1lLFxuICAgICAgICBkZXNjcmlwdGlvbjogci5kZXNjcmlwdGlvbixcbiAgICAgICAgZW5hYmxlZDogci5lbmFibGVkLFxuICAgICAgfSkpLFxuICAgICAgLi4uKGRlc2NyaXB0b3IucHJvbXB0cyB8fCBbXSkubWFwKHAgPT4gKHtcbiAgICAgICAgdHlwZTogJ3Byb21wdCcgYXMgTWNwQ2FwYWJpbGl0eVR5cGUsXG4gICAgICAgIHF1YWxpZmllZE5hbWU6IHAucXVhbGlmaWVkTmFtZSxcbiAgICAgICAgZGVzY3JpcHRpb246IHAuZGVzY3JpcHRpb24sXG4gICAgICAgIGVuYWJsZWQ6IHAuZW5hYmxlZCxcbiAgICAgIH0pKSxcbiAgICBdO1xuICAgIFxuICAgIC8vIOWIm+W7uiBTZXJ2ZXIg5o+P6L+w56ymXG4gICAgY29uc3Qgc2VydmVyRGVzY3JpcHRvcjogTWNwU2VydmVyRGVzY3JpcHRvciA9IHtcbiAgICAgIC4uLmRlc2NyaXB0b3IsXG4gICAgICBpZDogc2VydmVySWQsXG4gICAgICBuYW1lOiBkZXNjcmlwdG9yLm5hbWUsXG4gICAgICB2ZXJzaW9uOiBkZXNjcmlwdG9yLnZlcnNpb24sXG4gICAgICBjYXBhYmlsaXRpZXMsXG4gICAgICByZWdpc3RlcmVkQXQ6IERhdGUubm93KCksXG4gICAgICBoZWFsdGhTdGF0dXM6IGRlc2NyaXB0b3IuaGVhbHRoU3RhdHVzIHx8ICd1bmtub3duJyxcbiAgICB9O1xuICAgIFxuICAgIC8vIOWtmOWCqCBTZXJ2ZXJcbiAgICB0aGlzLnNlcnZlcnMuc2V0KHNlcnZlcklkLCBzZXJ2ZXJEZXNjcmlwdG9yKTtcbiAgICBcbiAgICAvLyDlrZjlgqggVG9vbFxuICAgIGZvciAoY29uc3QgdG9vbCBvZiBzZXJ2ZXJEZXNjcmlwdG9yLnRvb2xzKSB7XG4gICAgICB0aGlzLnRvb2xzQnlOYW1lLnNldCh0b29sLnF1YWxpZmllZE5hbWUsIHRvb2wpO1xuICAgIH1cbiAgICBcbiAgICAvLyDlrZjlgqggUmVzb3VyY2VcbiAgICBmb3IgKGNvbnN0IHJlc291cmNlIG9mIHNlcnZlckRlc2NyaXB0b3IucmVzb3VyY2VzKSB7XG4gICAgICB0aGlzLnJlc291cmNlc0J5TmFtZS5zZXQocmVzb3VyY2UucXVhbGlmaWVkTmFtZSwgcmVzb3VyY2UpO1xuICAgIH1cbiAgICBcbiAgICAvLyDlrZjlgqggUHJvbXB0XG4gICAgZm9yIChjb25zdCBwcm9tcHQgb2Ygc2VydmVyRGVzY3JpcHRvci5wcm9tcHRzKSB7XG4gICAgICB0aGlzLnByb21wdHNCeU5hbWUuc2V0KHByb21wdC5xdWFsaWZpZWROYW1lLCBwcm9tcHQpO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHNlcnZlcklkLFxuICAgICAgdG9vbHNSZWdpc3RlcmVkOiBzZXJ2ZXJEZXNjcmlwdG9yLnRvb2xzLmxlbmd0aCxcbiAgICAgIHJlc291cmNlc1JlZ2lzdGVyZWQ6IHNlcnZlckRlc2NyaXB0b3IucmVzb3VyY2VzLmxlbmd0aCxcbiAgICAgIHByb21wdHNSZWdpc3RlcmVkOiBzZXJ2ZXJEZXNjcmlwdG9yLnByb21wdHMubGVuZ3RoLFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDms6jlhowgVG9vbFxuICAgKi9cbiAgYXN5bmMgcmVnaXN0ZXJUb29sKFxuICAgIHNlcnZlcklkOiBzdHJpbmcsXG4gICAgdG9vbERlc2NyaXB0b3I6IE1jcFRvb2xEZXNjcmlwdG9yXG4gICk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIGNvbnN0IG5vcm1hbGl6ZWRTZXJ2ZXJJZCA9IG5vcm1hbGl6ZVNlcnZlck5hbWUoc2VydmVySWQpO1xuICAgIGNvbnN0IHNlcnZlciA9IHRoaXMuc2VydmVycy5nZXQobm9ybWFsaXplZFNlcnZlcklkKTtcbiAgICBcbiAgICBpZiAoIXNlcnZlcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBTZXJ2ZXIgJHtub3JtYWxpemVkU2VydmVySWR9IG5vdCBmb3VuZGApO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCBxdWFsaWZpZWROYW1lID0gYnVpbGRUb29sTmFtZShub3JtYWxpemVkU2VydmVySWQsIHRvb2xEZXNjcmlwdG9yLm5hbWUpO1xuICAgIFxuICAgIC8vIOajgOafpemHjeWQjVxuICAgIGlmICh0aGlzLnRvb2xzQnlOYW1lLmhhcyhxdWFsaWZpZWROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBUb29sICR7cXVhbGlmaWVkTmFtZX0gYWxyZWFkeSBleGlzdHNgKTtcbiAgICB9XG4gICAgXG4gICAgdG9vbERlc2NyaXB0b3IucXVhbGlmaWVkTmFtZSA9IHF1YWxpZmllZE5hbWU7XG4gICAgc2VydmVyLnRvb2xzLnB1c2godG9vbERlc2NyaXB0b3IpO1xuICAgIHNlcnZlci5jYXBhYmlsaXRpZXMucHVzaCh7XG4gICAgICB0eXBlOiAndG9vbCcsXG4gICAgICBxdWFsaWZpZWROYW1lLFxuICAgICAgZGVzY3JpcHRpb246IHRvb2xEZXNjcmlwdG9yLmRlc2NyaXB0aW9uLFxuICAgICAgZW5hYmxlZDogdG9vbERlc2NyaXB0b3IuZW5hYmxlZCxcbiAgICB9KTtcbiAgICBcbiAgICB0aGlzLnRvb2xzQnlOYW1lLnNldChxdWFsaWZpZWROYW1lLCB0b29sRGVzY3JpcHRvcik7XG4gICAgXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDms6jlhowgUmVzb3VyY2VcbiAgICovXG4gIGFzeW5jIHJlZ2lzdGVyUmVzb3VyY2UoXG4gICAgc2VydmVySWQ6IHN0cmluZyxcbiAgICByZXNvdXJjZURlc2NyaXB0b3I6IE1jcFJlc291cmNlRGVzY3JpcHRvclxuICApOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICBjb25zdCBub3JtYWxpemVkU2VydmVySWQgPSBub3JtYWxpemVTZXJ2ZXJOYW1lKHNlcnZlcklkKTtcbiAgICBjb25zdCBzZXJ2ZXIgPSB0aGlzLnNlcnZlcnMuZ2V0KG5vcm1hbGl6ZWRTZXJ2ZXJJZCk7XG4gICAgXG4gICAgaWYgKCFzZXJ2ZXIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgU2VydmVyICR7bm9ybWFsaXplZFNlcnZlcklkfSBub3QgZm91bmRgKTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgcXVhbGlmaWVkTmFtZSA9IGJ1aWxkUmVzb3VyY2VOYW1lKG5vcm1hbGl6ZWRTZXJ2ZXJJZCwgcmVzb3VyY2VEZXNjcmlwdG9yLnJlc291cmNlVHlwZSk7XG4gICAgXG4gICAgLy8g5qOA5p+l6YeN5ZCNXG4gICAgaWYgKHRoaXMucmVzb3VyY2VzQnlOYW1lLmhhcyhxdWFsaWZpZWROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBSZXNvdXJjZSAke3F1YWxpZmllZE5hbWV9IGFscmVhZHkgZXhpc3RzYCk7XG4gICAgfVxuICAgIFxuICAgIHJlc291cmNlRGVzY3JpcHRvci5xdWFsaWZpZWROYW1lID0gcXVhbGlmaWVkTmFtZTtcbiAgICBzZXJ2ZXIucmVzb3VyY2VzLnB1c2gocmVzb3VyY2VEZXNjcmlwdG9yKTtcbiAgICBzZXJ2ZXIuY2FwYWJpbGl0aWVzLnB1c2goe1xuICAgICAgdHlwZTogJ3Jlc291cmNlJyxcbiAgICAgIHF1YWxpZmllZE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogcmVzb3VyY2VEZXNjcmlwdG9yLmRlc2NyaXB0aW9uLFxuICAgICAgZW5hYmxlZDogcmVzb3VyY2VEZXNjcmlwdG9yLmVuYWJsZWQsXG4gICAgfSk7XG4gICAgXG4gICAgdGhpcy5yZXNvdXJjZXNCeU5hbWUuc2V0KHF1YWxpZmllZE5hbWUsIHJlc291cmNlRGVzY3JpcHRvcik7XG4gICAgXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDms6jlhowgUHJvbXB0XG4gICAqL1xuICBhc3luYyByZWdpc3RlclByb21wdChcbiAgICBzZXJ2ZXJJZDogc3RyaW5nLFxuICAgIHByb21wdERlc2NyaXB0b3I6IE1jcFByb21wdERlc2NyaXB0b3JcbiAgKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgY29uc3Qgbm9ybWFsaXplZFNlcnZlcklkID0gbm9ybWFsaXplU2VydmVyTmFtZShzZXJ2ZXJJZCk7XG4gICAgY29uc3Qgc2VydmVyID0gdGhpcy5zZXJ2ZXJzLmdldChub3JtYWxpemVkU2VydmVySWQpO1xuICAgIFxuICAgIGlmICghc2VydmVyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFNlcnZlciAke25vcm1hbGl6ZWRTZXJ2ZXJJZH0gbm90IGZvdW5kYCk7XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IHF1YWxpZmllZE5hbWUgPSBidWlsZFByb21wdE5hbWUobm9ybWFsaXplZFNlcnZlcklkLCBwcm9tcHREZXNjcmlwdG9yLm5hbWUpO1xuICAgIFxuICAgIC8vIOajgOafpemHjeWQjVxuICAgIGlmICh0aGlzLnByb21wdHNCeU5hbWUuaGFzKHF1YWxpZmllZE5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFByb21wdCAke3F1YWxpZmllZE5hbWV9IGFscmVhZHkgZXhpc3RzYCk7XG4gICAgfVxuICAgIFxuICAgIHByb21wdERlc2NyaXB0b3IucXVhbGlmaWVkTmFtZSA9IHF1YWxpZmllZE5hbWU7XG4gICAgc2VydmVyLnByb21wdHMucHVzaChwcm9tcHREZXNjcmlwdG9yKTtcbiAgICBzZXJ2ZXIuY2FwYWJpbGl0aWVzLnB1c2goe1xuICAgICAgdHlwZTogJ3Byb21wdCcsXG4gICAgICBxdWFsaWZpZWROYW1lLFxuICAgICAgZGVzY3JpcHRpb246IHByb21wdERlc2NyaXB0b3IuZGVzY3JpcHRpb24sXG4gICAgICBlbmFibGVkOiBwcm9tcHREZXNjcmlwdG9yLmVuYWJsZWQsXG4gICAgfSk7XG4gICAgXG4gICAgdGhpcy5wcm9tcHRzQnlOYW1lLnNldChxdWFsaWZpZWROYW1lLCBwcm9tcHREZXNjcmlwdG9yKTtcbiAgICBcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOazqOmUgCBTZXJ2ZXJcbiAgICovXG4gIGFzeW5jIHVucmVnaXN0ZXJTZXJ2ZXIoc2VydmVySWQ6IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIGNvbnN0IG5vcm1hbGl6ZWRTZXJ2ZXJJZCA9IG5vcm1hbGl6ZVNlcnZlck5hbWUoc2VydmVySWQpO1xuICAgIGNvbnN0IHNlcnZlciA9IHRoaXMuc2VydmVycy5nZXQobm9ybWFsaXplZFNlcnZlcklkKTtcbiAgICBcbiAgICBpZiAoIXNlcnZlcikge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBcbiAgICAvLyDliKDpmaTmiYDmnIkgVG9vbFxuICAgIGZvciAoY29uc3QgdG9vbCBvZiBzZXJ2ZXIudG9vbHMpIHtcbiAgICAgIHRoaXMudG9vbHNCeU5hbWUuZGVsZXRlKHRvb2wucXVhbGlmaWVkTmFtZSk7XG4gICAgfVxuICAgIFxuICAgIC8vIOWIoOmZpOaJgOaciSBSZXNvdXJjZVxuICAgIGZvciAoY29uc3QgcmVzb3VyY2Ugb2Ygc2VydmVyLnJlc291cmNlcykge1xuICAgICAgdGhpcy5yZXNvdXJjZXNCeU5hbWUuZGVsZXRlKHJlc291cmNlLnF1YWxpZmllZE5hbWUpO1xuICAgIH1cbiAgICBcbiAgICAvLyDliKDpmaTmiYDmnIkgUHJvbXB0XG4gICAgZm9yIChjb25zdCBwcm9tcHQgb2Ygc2VydmVyLnByb21wdHMpIHtcbiAgICAgIHRoaXMucHJvbXB0c0J5TmFtZS5kZWxldGUocHJvbXB0LnF1YWxpZmllZE5hbWUpO1xuICAgIH1cbiAgICBcbiAgICAvLyDliKDpmaQgU2VydmVyXG4gICAgdGhpcy5zZXJ2ZXJzLmRlbGV0ZShub3JtYWxpemVkU2VydmVySWQpO1xuICAgIFxuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIFxuICAvKipcbiAgICog6I635Y+WIFNlcnZlclxuICAgKi9cbiAgZ2V0U2VydmVyKHNlcnZlcklkOiBzdHJpbmcpOiBNY3BTZXJ2ZXJEZXNjcmlwdG9yIHwgbnVsbCB7XG4gICAgY29uc3Qgbm9ybWFsaXplZFNlcnZlcklkID0gbm9ybWFsaXplU2VydmVyTmFtZShzZXJ2ZXJJZCk7XG4gICAgcmV0dXJuIHRoaXMuc2VydmVycy5nZXQobm9ybWFsaXplZFNlcnZlcklkKSB8fCBudWxsO1xuICB9XG4gIFxuICAvKipcbiAgICog6I635Y+WIENhcGFiaWxpdHlcbiAgICovXG4gIGdldENhcGFiaWxpdHkocXVhbGlmaWVkTmFtZTogc3RyaW5nKTogTWNwVG9vbERlc2NyaXB0b3IgfCBNY3BSZXNvdXJjZURlc2NyaXB0b3IgfCBNY3BQcm9tcHREZXNjcmlwdG9yIHwgbnVsbCB7XG4gICAgcmV0dXJuIChcbiAgICAgIHRoaXMudG9vbHNCeU5hbWUuZ2V0KHF1YWxpZmllZE5hbWUpIHx8XG4gICAgICB0aGlzLnJlc291cmNlc0J5TmFtZS5nZXQocXVhbGlmaWVkTmFtZSkgfHxcbiAgICAgIHRoaXMucHJvbXB0c0J5TmFtZS5nZXQocXVhbGlmaWVkTmFtZSkgfHxcbiAgICAgIG51bGxcbiAgICApO1xuICB9XG4gIFxuICAvKipcbiAgICog5YiX5Ye65omA5pyJIFNlcnZlclxuICAgKi9cbiAgbGlzdFNlcnZlcnMoKTogTWNwU2VydmVyRGVzY3JpcHRvcltdIHtcbiAgICByZXR1cm4gQXJyYXkuZnJvbSh0aGlzLnNlcnZlcnMudmFsdWVzKCkpO1xuICB9XG4gIFxuICAvKipcbiAgICog5YiX5Ye65omA5pyJIENhcGFiaWxpdHlcbiAgICovXG4gIGxpc3RDYXBhYmlsaXRpZXMoc2VydmVySWQ/OiBzdHJpbmcpOiBBcnJheTxNY3BUb29sRGVzY3JpcHRvciB8IE1jcFJlc291cmNlRGVzY3JpcHRvciB8IE1jcFByb21wdERlc2NyaXB0b3I+IHtcbiAgICBpZiAoc2VydmVySWQpIHtcbiAgICAgIGNvbnN0IG5vcm1hbGl6ZWRTZXJ2ZXJJZCA9IG5vcm1hbGl6ZVNlcnZlck5hbWUoc2VydmVySWQpO1xuICAgICAgY29uc3Qgc2VydmVyID0gdGhpcy5zZXJ2ZXJzLmdldChub3JtYWxpemVkU2VydmVySWQpO1xuICAgICAgXG4gICAgICBpZiAoIXNlcnZlcikge1xuICAgICAgICByZXR1cm4gW107XG4gICAgICB9XG4gICAgICBcbiAgICAgIHJldHVybiBbLi4uc2VydmVyLnRvb2xzLCAuLi5zZXJ2ZXIucmVzb3VyY2VzLCAuLi5zZXJ2ZXIucHJvbXB0c107XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBbXG4gICAgICAuLi50aGlzLnRvb2xzQnlOYW1lLnZhbHVlcygpLFxuICAgICAgLi4udGhpcy5yZXNvdXJjZXNCeU5hbWUudmFsdWVzKCksXG4gICAgICAuLi50aGlzLnByb21wdHNCeU5hbWUudmFsdWVzKCksXG4gICAgXTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOWQr+eUqC/npoHnlKggU2VydmVyXG4gICAqL1xuICBzZXRTZXJ2ZXJFbmFibGVkKHNlcnZlcklkOiBzdHJpbmcsIGVuYWJsZWQ6IGJvb2xlYW4pOiB2b2lkIHtcbiAgICBjb25zdCBub3JtYWxpemVkU2VydmVySWQgPSBub3JtYWxpemVTZXJ2ZXJOYW1lKHNlcnZlcklkKTtcbiAgICBjb25zdCBzZXJ2ZXIgPSB0aGlzLnNlcnZlcnMuZ2V0KG5vcm1hbGl6ZWRTZXJ2ZXJJZCk7XG4gICAgXG4gICAgaWYgKHNlcnZlcikge1xuICAgICAgc2VydmVyLmVuYWJsZWQgPSBlbmFibGVkO1xuICAgICAgXG4gICAgICAvLyDlkIzmraXmm7TmlrDmiYDmnIkgQ2FwYWJpbGl0eVxuICAgICAgZm9yIChjb25zdCB0b29sIG9mIHNlcnZlci50b29scykge1xuICAgICAgICB0b29sLmVuYWJsZWQgPSBlbmFibGVkO1xuICAgICAgfVxuICAgICAgZm9yIChjb25zdCByZXNvdXJjZSBvZiBzZXJ2ZXIucmVzb3VyY2VzKSB7XG4gICAgICAgIHJlc291cmNlLmVuYWJsZWQgPSBlbmFibGVkO1xuICAgICAgfVxuICAgICAgZm9yIChjb25zdCBwcm9tcHQgb2Ygc2VydmVyLnByb21wdHMpIHtcbiAgICAgICAgcHJvbXB0LmVuYWJsZWQgPSBlbmFibGVkO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBcbiAgLyoqXG4gICAqIOabtOaWsCBTZXJ2ZXIg5YGl5bq354q25oCBXG4gICAqL1xuICB1cGRhdGVTZXJ2ZXJIZWFsdGgoc2VydmVySWQ6IHN0cmluZywgaGVhbHRoU3RhdHVzOiAnaGVhbHRoeScgfCAnZGVncmFkZWQnIHwgJ3VuaGVhbHRoeScpOiB2b2lkIHtcbiAgICBjb25zdCBub3JtYWxpemVkU2VydmVySWQgPSBub3JtYWxpemVTZXJ2ZXJOYW1lKHNlcnZlcklkKTtcbiAgICBjb25zdCBzZXJ2ZXIgPSB0aGlzLnNlcnZlcnMuZ2V0KG5vcm1hbGl6ZWRTZXJ2ZXJJZCk7XG4gICAgXG4gICAgaWYgKHNlcnZlcikge1xuICAgICAgc2VydmVyLmhlYWx0aFN0YXR1cyA9IGhlYWx0aFN0YXR1cztcbiAgICAgIHNlcnZlci5sYXN0SGVhbHRoQ2hlY2tBdCA9IERhdGUubm93KCk7XG4gICAgfVxuICB9XG4gIFxuICAvKipcbiAgICog6I635Y+W57uf6K6h5L+h5oGvXG4gICAqL1xuICBnZXRTdGF0cygpOiBNY3BSZWdpc3RyeVN0YXRzIHtcbiAgICBjb25zdCBzZXJ2ZXJzID0gdGhpcy5saXN0U2VydmVycygpO1xuICAgIGNvbnN0IGVuYWJsZWRTZXJ2ZXJzID0gc2VydmVycy5maWx0ZXIocyA9PiBzLmVuYWJsZWQpLmxlbmd0aDtcbiAgICBcbiAgICBjb25zdCBieVNlcnZlcjogUmVjb3JkPHN0cmluZywgeyB0b29sczogbnVtYmVyOyByZXNvdXJjZXM6IG51bWJlcjsgcHJvbXB0czogbnVtYmVyIH0+ID0ge307XG4gICAgbGV0IHRvdGFsVG9vbHMgPSAwO1xuICAgIGxldCB0b3RhbFJlc291cmNlcyA9IDA7XG4gICAgbGV0IHRvdGFsUHJvbXB0cyA9IDA7XG4gICAgXG4gICAgZm9yIChjb25zdCBzZXJ2ZXIgb2Ygc2VydmVycykge1xuICAgICAgYnlTZXJ2ZXJbc2VydmVyLmlkXSA9IHtcbiAgICAgICAgdG9vbHM6IHNlcnZlci50b29scy5sZW5ndGgsXG4gICAgICAgIHJlc291cmNlczogc2VydmVyLnJlc291cmNlcy5sZW5ndGgsXG4gICAgICAgIHByb21wdHM6IHNlcnZlci5wcm9tcHRzLmxlbmd0aCxcbiAgICAgIH07XG4gICAgICB0b3RhbFRvb2xzICs9IHNlcnZlci50b29scy5sZW5ndGg7XG4gICAgICB0b3RhbFJlc291cmNlcyArPSBzZXJ2ZXIucmVzb3VyY2VzLmxlbmd0aDtcbiAgICAgIHRvdGFsUHJvbXB0cyArPSBzZXJ2ZXIucHJvbXB0cy5sZW5ndGg7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7XG4gICAgICB0b3RhbFNlcnZlcnM6IHNlcnZlcnMubGVuZ3RoLFxuICAgICAgZW5hYmxlZFNlcnZlcnMsXG4gICAgICB0b3RhbFRvb2xzLFxuICAgICAgdG90YWxSZXNvdXJjZXMsXG4gICAgICB0b3RhbFByb21wdHMsXG4gICAgICBieVNlcnZlcixcbiAgICAgIGJ5VHlwZToge1xuICAgICAgICB0b29sOiB0b3RhbFRvb2xzLFxuICAgICAgICByZXNvdXJjZTogdG90YWxSZXNvdXJjZXMsXG4gICAgICAgIHByb21wdDogdG90YWxQcm9tcHRzLFxuICAgICAgfSxcbiAgICB9O1xuICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOS+v+aNt+WHveaVsFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIOWIm+W7uiBNQ1Ag5rOo5YaM6KGoXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVNY3BSZWdpc3RyeShjb25maWc/OiBNY3BSZWdpc3RyeUNvbmZpZyk6IE1jcFJlZ2lzdHJ5IHtcbiAgcmV0dXJuIG5ldyBNY3BSZWdpc3RyeShjb25maWcpO1xufVxuIl19