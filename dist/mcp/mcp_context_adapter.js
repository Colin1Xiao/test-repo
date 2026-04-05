"use strict";
/**
 * MCP Context Adapter - MCP 上下文适配器
 *
 * 职责：
 * 1. 把 MCP capability / resource 注入成 agent 可消费上下文
 * 2. 统一将 registry + policy + resources 转成 team runtime 侧的上下文对象
 * 3. 按角色裁剪 MCP 可见面
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpContextAdapter = void 0;
exports.createMcpContextAdapter = createMcpContextAdapter;
const agent_mcp_requirements_1 = require("./agent_mcp_requirements");
// ============================================================================
// MCP 上下文适配器
// ============================================================================
class McpContextAdapter {
    constructor(registry, policy) {
        this.registry = registry;
        this.policy = policy;
        this.requirementsResolver = new agent_mcp_requirements_1.AgentMcpRequirementsResolver(registry, policy);
    }
    /**
     * 构建 Agent MCP 上下文
     */
    buildAgentMcpContext(agentSpec, options) {
        const { availableServers, healthStatus, approvalPending } = options;
        // 解析需求
        const resolution = this.requirementsResolver.resolveAgentMcpRequirements(agentSpec, availableServers);
        // 构建可用能力列表
        const availableCapabilities = [];
        const availableResources = [];
        for (const server of availableServers) {
            // 检查健康状态
            const status = healthStatus[server] || 'unknown';
            if (status === 'unavailable') {
                continue;
            }
            // 检查权限
            const decision = this.policy.checkServerAccess(server);
            if (decision.effect === 'deny') {
                continue;
            }
            // 获取 server 的能力
            const serverDescriptor = this.registry.getServer(server);
            if (serverDescriptor) {
                for (const tool of serverDescriptor.tools) {
                    if (tool.enabled) {
                        availableCapabilities.push(tool.qualifiedName);
                    }
                }
                for (const resource of serverDescriptor.resources) {
                    if (resource.enabled) {
                        availableResources.push(resource.qualifiedName);
                    }
                }
            }
        }
        // 构建健康警告
        const healthWarnings = [];
        for (const [server, status] of Object.entries(healthStatus)) {
            if (status === 'degraded') {
                healthWarnings.push(`Server ${server} is degraded`);
            }
            else if (status === 'unavailable') {
                healthWarnings.push(`Server ${server} is unavailable`);
            }
        }
        return {
            availableServers,
            availableCapabilities,
            availableResources,
            requiredMissing: resolution.dependencies
                .filter(d => d.level === 'required' && d.status === 'missing')
                .map(d => d.server),
            optionalMissing: resolution.dependencies
                .filter(d => d.level === 'optional' && d.status === 'missing')
                .map(d => d.server),
            approvalPending: approvalPending,
            healthWarnings,
        };
    }
    /**
     * 注入 MCP 资源到上下文
     */
    injectMcpResources(agentRole, task, context) {
        const injectedContext = {};
        // 按角色裁剪可见面
        switch (agentRole) {
            case 'planner':
                // Planner 需要 overview
                injectedContext.mcpOverview = {
                    availableServers: context.availableServers,
                    requiredMissing: context.requiredMissing,
                    optionalMissing: context.optionalMissing,
                    healthWarnings: context.healthWarnings,
                };
                break;
            case 'repo_reader':
                // Repo Reader 需要资源列表
                injectedContext.mcpResources = {
                    availableResources: context.availableResources,
                    healthWarnings: context.healthWarnings,
                };
                break;
            case 'release_agent':
                // Release Agent 需要完整能力
                injectedContext.mcpCapabilities = {
                    availableServers: context.availableServers,
                    availableCapabilities: context.availableCapabilities,
                    availableResources: context.availableResources,
                    healthWarnings: context.healthWarnings,
                };
                break;
            default:
                // 默认提供基本信息
                injectedContext.mcpBasic = {
                    availableServers: context.availableServers,
                    healthWarnings: context.healthWarnings,
                };
        }
        return injectedContext;
    }
    /**
     * 总结可用能力
     */
    summarizeAvailableCapabilities(context) {
        const lines = [];
        if (context.availableServers.length > 0) {
            lines.push(`**Available MCP Servers:** ${context.availableServers.join(', ')}`);
        }
        if (context.availableCapabilities.length > 0) {
            const toolCount = context.availableCapabilities.length;
            lines.push(`**Available Tools:** ${toolCount} tools registered`);
        }
        if (context.availableResources.length > 0) {
            const resourceCount = context.availableResources.length;
            lines.push(`**Available Resources:** ${resourceCount} resources registered`);
        }
        if (context.requiredMissing.length > 0) {
            lines.push(`**Missing Required Servers:** ${context.requiredMissing.join(', ')}`);
        }
        if (context.optionalMissing.length > 0) {
            lines.push(`**Missing Optional Servers:** ${context.optionalMissing.join(', ')} (features may be limited)`);
        }
        if (context.healthWarnings.length > 0) {
            lines.push(`**Health Warnings:** ${context.healthWarnings.join('; ')}`);
        }
        return lines.join('\n');
    }
    /**
     * 构建缺失依赖报告
     */
    buildMissingDependencyReport(context) {
        const suggestedActions = [];
        if (context.requiredMissing.length > 0) {
            suggestedActions.push(`Ensure required servers are available: ${context.requiredMissing.join(', ')}`);
        }
        if (context.approvalPending.length > 0) {
            suggestedActions.push(`Complete approval for servers: ${context.approvalPending.join(', ')}`);
        }
        if (context.healthWarnings.length > 0) {
            suggestedActions.push('Check server health status and resolve any issues');
        }
        return {
            requiredMissing: context.requiredMissing,
            optionalMissing: context.optionalMissing,
            denied: [], // 简化实现
            pending: context.approvalPending,
            healthWarnings: context.healthWarnings,
            canRun: context.requiredMissing.length === 0,
            suggestedActions,
        };
    }
}
exports.McpContextAdapter = McpContextAdapter;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建上下文适配器
 */
function createMcpContextAdapter(registry, policy) {
    return new McpContextAdapter(registry, policy);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwX2NvbnRleHRfYWRhcHRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9tY3AvbWNwX2NvbnRleHRfYWRhcHRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7R0FVRzs7O0FBbVJILDBEQUtDO0FBL1FELHFFQUF3RTtBQThDeEUsK0VBQStFO0FBQy9FLGFBQWE7QUFDYiwrRUFBK0U7QUFFL0UsTUFBYSxpQkFBaUI7SUFLNUIsWUFDRSxRQUFxQixFQUNyQixNQUFpQjtRQUVqQixJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztRQUN6QixJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztRQUNyQixJQUFJLENBQUMsb0JBQW9CLEdBQUcsSUFBSSxxREFBNEIsQ0FBQyxRQUFRLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDakYsQ0FBQztJQUVEOztPQUVHO0lBQ0gsb0JBQW9CLENBQ2xCLFNBQXVCLEVBQ3ZCLE9BQTRCO1FBRTVCLE1BQU0sRUFBRSxnQkFBZ0IsRUFBRSxZQUFZLEVBQUUsZUFBZSxFQUFFLEdBQUcsT0FBTyxDQUFDO1FBRXBFLE9BQU87UUFDUCxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsMkJBQTJCLENBQ3RFLFNBQVMsRUFDVCxnQkFBZ0IsQ0FDakIsQ0FBQztRQUVGLFdBQVc7UUFDWCxNQUFNLHFCQUFxQixHQUFhLEVBQUUsQ0FBQztRQUMzQyxNQUFNLGtCQUFrQixHQUFhLEVBQUUsQ0FBQztRQUV4QyxLQUFLLE1BQU0sTUFBTSxJQUFJLGdCQUFnQixFQUFFLENBQUM7WUFDdEMsU0FBUztZQUNULE1BQU0sTUFBTSxHQUFHLFlBQVksQ0FBQyxNQUFNLENBQUMsSUFBSSxTQUFTLENBQUM7WUFDakQsSUFBSSxNQUFNLEtBQUssYUFBYSxFQUFFLENBQUM7Z0JBQzdCLFNBQVM7WUFDWCxDQUFDO1lBRUQsT0FBTztZQUNQLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsaUJBQWlCLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDdkQsSUFBSSxRQUFRLENBQUMsTUFBTSxLQUFLLE1BQU0sRUFBRSxDQUFDO2dCQUMvQixTQUFTO1lBQ1gsQ0FBQztZQUVELGdCQUFnQjtZQUNoQixNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ3pELElBQUksZ0JBQWdCLEVBQUUsQ0FBQztnQkFDckIsS0FBSyxNQUFNLElBQUksSUFBSSxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUUsQ0FBQztvQkFDMUMsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7d0JBQ2pCLHFCQUFxQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7b0JBQ2pELENBQUM7Z0JBQ0gsQ0FBQztnQkFDRCxLQUFLLE1BQU0sUUFBUSxJQUFJLGdCQUFnQixDQUFDLFNBQVMsRUFBRSxDQUFDO29CQUNsRCxJQUFJLFFBQVEsQ0FBQyxPQUFPLEVBQUUsQ0FBQzt3QkFDckIsa0JBQWtCLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsQ0FBQztvQkFDbEQsQ0FBQztnQkFDSCxDQUFDO1lBQ0gsQ0FBQztRQUNILENBQUM7UUFFRCxTQUFTO1FBQ1QsTUFBTSxjQUFjLEdBQWEsRUFBRSxDQUFDO1FBQ3BDLEtBQUssTUFBTSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUM7WUFDNUQsSUFBSSxNQUFNLEtBQUssVUFBVSxFQUFFLENBQUM7Z0JBQzFCLGNBQWMsQ0FBQyxJQUFJLENBQUMsVUFBVSxNQUFNLGNBQWMsQ0FBQyxDQUFDO1lBQ3RELENBQUM7aUJBQU0sSUFBSSxNQUFNLEtBQUssYUFBYSxFQUFFLENBQUM7Z0JBQ3BDLGNBQWMsQ0FBQyxJQUFJLENBQUMsVUFBVSxNQUFNLGlCQUFpQixDQUFDLENBQUM7WUFDekQsQ0FBQztRQUNILENBQUM7UUFFRCxPQUFPO1lBQ0wsZ0JBQWdCO1lBQ2hCLHFCQUFxQjtZQUNyQixrQkFBa0I7WUFDbEIsZUFBZSxFQUFFLFVBQVUsQ0FBQyxZQUFZO2lCQUNyQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxLQUFLLFVBQVUsSUFBSSxDQUFDLENBQUMsTUFBTSxLQUFLLFNBQVMsQ0FBQztpQkFDN0QsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQztZQUNyQixlQUFlLEVBQUUsVUFBVSxDQUFDLFlBQVk7aUJBQ3JDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLEtBQUssVUFBVSxJQUFJLENBQUMsQ0FBQyxNQUFNLEtBQUssU0FBUyxDQUFDO2lCQUM3RCxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDO1lBQ3JCLGVBQWUsRUFBRSxlQUFlO1lBQ2hDLGNBQWM7U0FDZixDQUFDO0lBQ0osQ0FBQztJQUVEOztPQUVHO0lBQ0gsa0JBQWtCLENBQ2hCLFNBQWlCLEVBQ2pCLElBQVMsRUFDVCxPQUF3QjtRQUV4QixNQUFNLGVBQWUsR0FBNEIsRUFBRSxDQUFDO1FBRXBELFdBQVc7UUFDWCxRQUFRLFNBQVMsRUFBRSxDQUFDO1lBQ2xCLEtBQUssU0FBUztnQkFDWixzQkFBc0I7Z0JBQ3RCLGVBQWUsQ0FBQyxXQUFXLEdBQUc7b0JBQzVCLGdCQUFnQixFQUFFLE9BQU8sQ0FBQyxnQkFBZ0I7b0JBQzFDLGVBQWUsRUFBRSxPQUFPLENBQUMsZUFBZTtvQkFDeEMsZUFBZSxFQUFFLE9BQU8sQ0FBQyxlQUFlO29CQUN4QyxjQUFjLEVBQUUsT0FBTyxDQUFDLGNBQWM7aUJBQ3ZDLENBQUM7Z0JBQ0YsTUFBTTtZQUVSLEtBQUssYUFBYTtnQkFDaEIscUJBQXFCO2dCQUNyQixlQUFlLENBQUMsWUFBWSxHQUFHO29CQUM3QixrQkFBa0IsRUFBRSxPQUFPLENBQUMsa0JBQWtCO29CQUM5QyxjQUFjLEVBQUUsT0FBTyxDQUFDLGNBQWM7aUJBQ3ZDLENBQUM7Z0JBQ0YsTUFBTTtZQUVSLEtBQUssZUFBZTtnQkFDbEIsdUJBQXVCO2dCQUN2QixlQUFlLENBQUMsZUFBZSxHQUFHO29CQUNoQyxnQkFBZ0IsRUFBRSxPQUFPLENBQUMsZ0JBQWdCO29CQUMxQyxxQkFBcUIsRUFBRSxPQUFPLENBQUMscUJBQXFCO29CQUNwRCxrQkFBa0IsRUFBRSxPQUFPLENBQUMsa0JBQWtCO29CQUM5QyxjQUFjLEVBQUUsT0FBTyxDQUFDLGNBQWM7aUJBQ3ZDLENBQUM7Z0JBQ0YsTUFBTTtZQUVSO2dCQUNFLFdBQVc7Z0JBQ1gsZUFBZSxDQUFDLFFBQVEsR0FBRztvQkFDekIsZ0JBQWdCLEVBQUUsT0FBTyxDQUFDLGdCQUFnQjtvQkFDMUMsY0FBYyxFQUFFLE9BQU8sQ0FBQyxjQUFjO2lCQUN2QyxDQUFDO1FBQ04sQ0FBQztRQUVELE9BQU8sZUFBZSxDQUFDO0lBQ3pCLENBQUM7SUFFRDs7T0FFRztJQUNILDhCQUE4QixDQUFDLE9BQXdCO1FBQ3JELE1BQU0sS0FBSyxHQUFhLEVBQUUsQ0FBQztRQUUzQixJQUFJLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDeEMsS0FBSyxDQUFDLElBQUksQ0FBQyw4QkFBOEIsT0FBTyxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDbEYsQ0FBQztRQUVELElBQUksT0FBTyxDQUFDLHFCQUFxQixDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUM3QyxNQUFNLFNBQVMsR0FBRyxPQUFPLENBQUMscUJBQXFCLENBQUMsTUFBTSxDQUFDO1lBQ3ZELEtBQUssQ0FBQyxJQUFJLENBQUMsd0JBQXdCLFNBQVMsbUJBQW1CLENBQUMsQ0FBQztRQUNuRSxDQUFDO1FBRUQsSUFBSSxPQUFPLENBQUMsa0JBQWtCLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQzFDLE1BQU0sYUFBYSxHQUFHLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLENBQUM7WUFDeEQsS0FBSyxDQUFDLElBQUksQ0FBQyw0QkFBNEIsYUFBYSx1QkFBdUIsQ0FBQyxDQUFDO1FBQy9FLENBQUM7UUFFRCxJQUFJLE9BQU8sQ0FBQyxlQUFlLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQ3ZDLEtBQUssQ0FBQyxJQUFJLENBQUMsaUNBQWlDLE9BQU8sQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNwRixDQUFDO1FBRUQsSUFBSSxPQUFPLENBQUMsZUFBZSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUN2QyxLQUFLLENBQUMsSUFBSSxDQUFDLGlDQUFpQyxPQUFPLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsNEJBQTRCLENBQUMsQ0FBQztRQUM5RyxDQUFDO1FBRUQsSUFBSSxPQUFPLENBQUMsY0FBYyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUN0QyxLQUFLLENBQUMsSUFBSSxDQUFDLHdCQUF3QixPQUFPLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDMUUsQ0FBQztRQUVELE9BQU8sS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUMxQixDQUFDO0lBRUQ7O09BRUc7SUFDSCw0QkFBNEIsQ0FBQyxPQUF3QjtRQUNuRCxNQUFNLGdCQUFnQixHQUFhLEVBQUUsQ0FBQztRQUV0QyxJQUFJLE9BQU8sQ0FBQyxlQUFlLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQ3ZDLGdCQUFnQixDQUFDLElBQUksQ0FDbkIsMENBQTBDLE9BQU8sQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQy9FLENBQUM7UUFDSixDQUFDO1FBRUQsSUFBSSxPQUFPLENBQUMsZUFBZSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUN2QyxnQkFBZ0IsQ0FBQyxJQUFJLENBQ25CLGtDQUFrQyxPQUFPLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUN2RSxDQUFDO1FBQ0osQ0FBQztRQUVELElBQUksT0FBTyxDQUFDLGNBQWMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDdEMsZ0JBQWdCLENBQUMsSUFBSSxDQUNuQixtREFBbUQsQ0FDcEQsQ0FBQztRQUNKLENBQUM7UUFFRCxPQUFPO1lBQ0wsZUFBZSxFQUFFLE9BQU8sQ0FBQyxlQUFlO1lBQ3hDLGVBQWUsRUFBRSxPQUFPLENBQUMsZUFBZTtZQUN4QyxNQUFNLEVBQUUsRUFBRSxFQUFFLE9BQU87WUFDbkIsT0FBTyxFQUFFLE9BQU8sQ0FBQyxlQUFlO1lBQ2hDLGNBQWMsRUFBRSxPQUFPLENBQUMsY0FBYztZQUN0QyxNQUFNLEVBQUUsT0FBTyxDQUFDLGVBQWUsQ0FBQyxNQUFNLEtBQUssQ0FBQztZQUM1QyxnQkFBZ0I7U0FDakIsQ0FBQztJQUNKLENBQUM7Q0FDRjtBQS9NRCw4Q0ErTUM7QUFFRCwrRUFBK0U7QUFDL0UsT0FBTztBQUNQLCtFQUErRTtBQUUvRTs7R0FFRztBQUNILFNBQWdCLHVCQUF1QixDQUNyQyxRQUFxQixFQUNyQixNQUFpQjtJQUVqQixPQUFPLElBQUksaUJBQWlCLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQ2pELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIE1DUCBDb250ZXh0IEFkYXB0ZXIgLSBNQ1Ag5LiK5LiL5paH6YCC6YWN5ZmoXG4gKiBcbiAqIOiBjOi0o++8mlxuICogMS4g5oqKIE1DUCBjYXBhYmlsaXR5IC8gcmVzb3VyY2Ug5rOo5YWl5oiQIGFnZW50IOWPr+a2iOi0ueS4iuS4i+aWh1xuICogMi4g57uf5LiA5bCGIHJlZ2lzdHJ5ICsgcG9saWN5ICsgcmVzb3VyY2VzIOi9rOaIkCB0ZWFtIHJ1bnRpbWUg5L6n55qE5LiK5LiL5paH5a+56LGhXG4gKiAzLiDmjInop5LoibLoo4HliaogTUNQIOWPr+ingemdolxuICogXG4gKiBAdmVyc2lvbiB2MC4xLjBcbiAqIEBkYXRlIDIwMjYtMDQtMDNcbiAqL1xuXG5pbXBvcnQgdHlwZSB7XG4gIEFnZW50TWNwU3BlYyxcbiAgQWdlbnRNY3BDb250ZXh0LFxuICBNY3BTZXJ2ZXJIZWFsdGhTdGF0dXMsXG59IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgTWNwUmVnaXN0cnkgfSBmcm9tICcuL3Jlc291cmNlX3JlZ2lzdHJ5JztcbmltcG9ydCB7IE1jcFBvbGljeSB9IGZyb20gJy4vbWNwX3BvbGljeSc7XG5pbXBvcnQgeyBBZ2VudE1jcFJlcXVpcmVtZW50c1Jlc29sdmVyIH0gZnJvbSAnLi9hZ2VudF9tY3BfcmVxdWlyZW1lbnRzJztcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g57G75Z6L5a6a5LmJXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog5LiK5LiL5paH5p6E5bu66YCJ6aG5XG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQ29udGV4dEJ1aWxkT3B0aW9ucyB7XG4gIC8qKiDlj6/nlKjnmoQgc2VydmVycyAqL1xuICBhdmFpbGFibGVTZXJ2ZXJzOiBzdHJpbmdbXTtcbiAgXG4gIC8qKiDlgaXlurfnirbmgIEgKi9cbiAgaGVhbHRoU3RhdHVzOiBSZWNvcmQ8c3RyaW5nLCBNY3BTZXJ2ZXJIZWFsdGhTdGF0dXM+O1xuICBcbiAgLyoqIOetieW+heWuoeaJueeahCAqL1xuICBhcHByb3ZhbFBlbmRpbmc6IHN0cmluZ1tdO1xufVxuXG4vKipcbiAqIOe8uuWkseS+nei1luaKpeWRilxuICovXG5leHBvcnQgaW50ZXJmYWNlIE1pc3NpbmdEZXBlbmRlbmN5UmVwb3J0IHtcbiAgLyoqIOe8uuWkseeahCByZXF1aXJlZCAqL1xuICByZXF1aXJlZE1pc3Npbmc6IHN0cmluZ1tdO1xuICBcbiAgLyoqIOe8uuWkseeahCBvcHRpb25hbCAqL1xuICBvcHRpb25hbE1pc3Npbmc6IHN0cmluZ1tdO1xuICBcbiAgLyoqIOiiq+aLkue7neeahCAqL1xuICBkZW5pZWQ6IHN0cmluZ1tdO1xuICBcbiAgLyoqIOetieW+heWuoeaJueeahCAqL1xuICBwZW5kaW5nOiBzdHJpbmdbXTtcbiAgXG4gIC8qKiDlgaXlurforablkYogKi9cbiAgaGVhbHRoV2FybmluZ3M6IHN0cmluZ1tdO1xuICBcbiAgLyoqIOaYr+WQpuWPr+i/kOihjCAqL1xuICBjYW5SdW46IGJvb2xlYW47XG4gIFxuICAvKiog5bu66K6u5pON5L2cICovXG4gIHN1Z2dlc3RlZEFjdGlvbnM6IHN0cmluZ1tdO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBNQ1Ag5LiK5LiL5paH6YCC6YWN5ZmoXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBjbGFzcyBNY3BDb250ZXh0QWRhcHRlciB7XG4gIHByaXZhdGUgcmVnaXN0cnk6IE1jcFJlZ2lzdHJ5O1xuICBwcml2YXRlIHBvbGljeTogTWNwUG9saWN5O1xuICBwcml2YXRlIHJlcXVpcmVtZW50c1Jlc29sdmVyOiBBZ2VudE1jcFJlcXVpcmVtZW50c1Jlc29sdmVyO1xuICBcbiAgY29uc3RydWN0b3IoXG4gICAgcmVnaXN0cnk6IE1jcFJlZ2lzdHJ5LFxuICAgIHBvbGljeTogTWNwUG9saWN5XG4gICkge1xuICAgIHRoaXMucmVnaXN0cnkgPSByZWdpc3RyeTtcbiAgICB0aGlzLnBvbGljeSA9IHBvbGljeTtcbiAgICB0aGlzLnJlcXVpcmVtZW50c1Jlc29sdmVyID0gbmV3IEFnZW50TWNwUmVxdWlyZW1lbnRzUmVzb2x2ZXIocmVnaXN0cnksIHBvbGljeSk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmnoTlu7ogQWdlbnQgTUNQIOS4iuS4i+aWh1xuICAgKi9cbiAgYnVpbGRBZ2VudE1jcENvbnRleHQoXG4gICAgYWdlbnRTcGVjOiBBZ2VudE1jcFNwZWMsXG4gICAgb3B0aW9uczogQ29udGV4dEJ1aWxkT3B0aW9uc1xuICApOiBBZ2VudE1jcENvbnRleHQge1xuICAgIGNvbnN0IHsgYXZhaWxhYmxlU2VydmVycywgaGVhbHRoU3RhdHVzLCBhcHByb3ZhbFBlbmRpbmcgfSA9IG9wdGlvbnM7XG4gICAgXG4gICAgLy8g6Kej5p6Q6ZyA5rGCXG4gICAgY29uc3QgcmVzb2x1dGlvbiA9IHRoaXMucmVxdWlyZW1lbnRzUmVzb2x2ZXIucmVzb2x2ZUFnZW50TWNwUmVxdWlyZW1lbnRzKFxuICAgICAgYWdlbnRTcGVjLFxuICAgICAgYXZhaWxhYmxlU2VydmVyc1xuICAgICk7XG4gICAgXG4gICAgLy8g5p6E5bu65Y+v55So6IO95Yqb5YiX6KGoXG4gICAgY29uc3QgYXZhaWxhYmxlQ2FwYWJpbGl0aWVzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IGF2YWlsYWJsZVJlc291cmNlczogc3RyaW5nW10gPSBbXTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IHNlcnZlciBvZiBhdmFpbGFibGVTZXJ2ZXJzKSB7XG4gICAgICAvLyDmo4Dmn6XlgaXlurfnirbmgIFcbiAgICAgIGNvbnN0IHN0YXR1cyA9IGhlYWx0aFN0YXR1c1tzZXJ2ZXJdIHx8ICd1bmtub3duJztcbiAgICAgIGlmIChzdGF0dXMgPT09ICd1bmF2YWlsYWJsZScpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIOajgOafpeadg+mZkFxuICAgICAgY29uc3QgZGVjaXNpb24gPSB0aGlzLnBvbGljeS5jaGVja1NlcnZlckFjY2VzcyhzZXJ2ZXIpO1xuICAgICAgaWYgKGRlY2lzaW9uLmVmZmVjdCA9PT0gJ2RlbnknKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyDojrflj5Ygc2VydmVyIOeahOiDveWKm1xuICAgICAgY29uc3Qgc2VydmVyRGVzY3JpcHRvciA9IHRoaXMucmVnaXN0cnkuZ2V0U2VydmVyKHNlcnZlcik7XG4gICAgICBpZiAoc2VydmVyRGVzY3JpcHRvcikge1xuICAgICAgICBmb3IgKGNvbnN0IHRvb2wgb2Ygc2VydmVyRGVzY3JpcHRvci50b29scykge1xuICAgICAgICAgIGlmICh0b29sLmVuYWJsZWQpIHtcbiAgICAgICAgICAgIGF2YWlsYWJsZUNhcGFiaWxpdGllcy5wdXNoKHRvb2wucXVhbGlmaWVkTmFtZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGZvciAoY29uc3QgcmVzb3VyY2Ugb2Ygc2VydmVyRGVzY3JpcHRvci5yZXNvdXJjZXMpIHtcbiAgICAgICAgICBpZiAocmVzb3VyY2UuZW5hYmxlZCkge1xuICAgICAgICAgICAgYXZhaWxhYmxlUmVzb3VyY2VzLnB1c2gocmVzb3VyY2UucXVhbGlmaWVkTmFtZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIOaehOW7uuWBpeW6t+itpuWRilxuICAgIGNvbnN0IGhlYWx0aFdhcm5pbmdzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGZvciAoY29uc3QgW3NlcnZlciwgc3RhdHVzXSBvZiBPYmplY3QuZW50cmllcyhoZWFsdGhTdGF0dXMpKSB7XG4gICAgICBpZiAoc3RhdHVzID09PSAnZGVncmFkZWQnKSB7XG4gICAgICAgIGhlYWx0aFdhcm5pbmdzLnB1c2goYFNlcnZlciAke3NlcnZlcn0gaXMgZGVncmFkZWRgKTtcbiAgICAgIH0gZWxzZSBpZiAoc3RhdHVzID09PSAndW5hdmFpbGFibGUnKSB7XG4gICAgICAgIGhlYWx0aFdhcm5pbmdzLnB1c2goYFNlcnZlciAke3NlcnZlcn0gaXMgdW5hdmFpbGFibGVgKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIGF2YWlsYWJsZVNlcnZlcnMsXG4gICAgICBhdmFpbGFibGVDYXBhYmlsaXRpZXMsXG4gICAgICBhdmFpbGFibGVSZXNvdXJjZXMsXG4gICAgICByZXF1aXJlZE1pc3Npbmc6IHJlc29sdXRpb24uZGVwZW5kZW5jaWVzXG4gICAgICAgIC5maWx0ZXIoZCA9PiBkLmxldmVsID09PSAncmVxdWlyZWQnICYmIGQuc3RhdHVzID09PSAnbWlzc2luZycpXG4gICAgICAgIC5tYXAoZCA9PiBkLnNlcnZlciksXG4gICAgICBvcHRpb25hbE1pc3Npbmc6IHJlc29sdXRpb24uZGVwZW5kZW5jaWVzXG4gICAgICAgIC5maWx0ZXIoZCA9PiBkLmxldmVsID09PSAnb3B0aW9uYWwnICYmIGQuc3RhdHVzID09PSAnbWlzc2luZycpXG4gICAgICAgIC5tYXAoZCA9PiBkLnNlcnZlciksXG4gICAgICBhcHByb3ZhbFBlbmRpbmc6IGFwcHJvdmFsUGVuZGluZyxcbiAgICAgIGhlYWx0aFdhcm5pbmdzLFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDms6jlhaUgTUNQIOi1hOa6kOWIsOS4iuS4i+aWh1xuICAgKi9cbiAgaW5qZWN0TWNwUmVzb3VyY2VzKFxuICAgIGFnZW50Um9sZTogc3RyaW5nLFxuICAgIHRhc2s6IGFueSxcbiAgICBjb250ZXh0OiBBZ2VudE1jcENvbnRleHRcbiAgKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICAgIGNvbnN0IGluamVjdGVkQ29udGV4dDogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7fTtcbiAgICBcbiAgICAvLyDmjInop5LoibLoo4Hliarlj6/op4HpnaJcbiAgICBzd2l0Y2ggKGFnZW50Um9sZSkge1xuICAgICAgY2FzZSAncGxhbm5lcic6XG4gICAgICAgIC8vIFBsYW5uZXIg6ZyA6KaBIG92ZXJ2aWV3XG4gICAgICAgIGluamVjdGVkQ29udGV4dC5tY3BPdmVydmlldyA9IHtcbiAgICAgICAgICBhdmFpbGFibGVTZXJ2ZXJzOiBjb250ZXh0LmF2YWlsYWJsZVNlcnZlcnMsXG4gICAgICAgICAgcmVxdWlyZWRNaXNzaW5nOiBjb250ZXh0LnJlcXVpcmVkTWlzc2luZyxcbiAgICAgICAgICBvcHRpb25hbE1pc3Npbmc6IGNvbnRleHQub3B0aW9uYWxNaXNzaW5nLFxuICAgICAgICAgIGhlYWx0aFdhcm5pbmdzOiBjb250ZXh0LmhlYWx0aFdhcm5pbmdzLFxuICAgICAgICB9O1xuICAgICAgICBicmVhaztcbiAgICAgICAgXG4gICAgICBjYXNlICdyZXBvX3JlYWRlcic6XG4gICAgICAgIC8vIFJlcG8gUmVhZGVyIOmcgOimgei1hOa6kOWIl+ihqFxuICAgICAgICBpbmplY3RlZENvbnRleHQubWNwUmVzb3VyY2VzID0ge1xuICAgICAgICAgIGF2YWlsYWJsZVJlc291cmNlczogY29udGV4dC5hdmFpbGFibGVSZXNvdXJjZXMsXG4gICAgICAgICAgaGVhbHRoV2FybmluZ3M6IGNvbnRleHQuaGVhbHRoV2FybmluZ3MsXG4gICAgICAgIH07XG4gICAgICAgIGJyZWFrO1xuICAgICAgICBcbiAgICAgIGNhc2UgJ3JlbGVhc2VfYWdlbnQnOlxuICAgICAgICAvLyBSZWxlYXNlIEFnZW50IOmcgOimgeWujOaVtOiDveWKm1xuICAgICAgICBpbmplY3RlZENvbnRleHQubWNwQ2FwYWJpbGl0aWVzID0ge1xuICAgICAgICAgIGF2YWlsYWJsZVNlcnZlcnM6IGNvbnRleHQuYXZhaWxhYmxlU2VydmVycyxcbiAgICAgICAgICBhdmFpbGFibGVDYXBhYmlsaXRpZXM6IGNvbnRleHQuYXZhaWxhYmxlQ2FwYWJpbGl0aWVzLFxuICAgICAgICAgIGF2YWlsYWJsZVJlc291cmNlczogY29udGV4dC5hdmFpbGFibGVSZXNvdXJjZXMsXG4gICAgICAgICAgaGVhbHRoV2FybmluZ3M6IGNvbnRleHQuaGVhbHRoV2FybmluZ3MsXG4gICAgICAgIH07XG4gICAgICAgIGJyZWFrO1xuICAgICAgICBcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIC8vIOm7mOiupOaPkOS+m+WfuuacrOS/oeaBr1xuICAgICAgICBpbmplY3RlZENvbnRleHQubWNwQmFzaWMgPSB7XG4gICAgICAgICAgYXZhaWxhYmxlU2VydmVyczogY29udGV4dC5hdmFpbGFibGVTZXJ2ZXJzLFxuICAgICAgICAgIGhlYWx0aFdhcm5pbmdzOiBjb250ZXh0LmhlYWx0aFdhcm5pbmdzLFxuICAgICAgICB9O1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gaW5qZWN0ZWRDb250ZXh0O1xuICB9XG4gIFxuICAvKipcbiAgICog5oC757uT5Y+v55So6IO95YqbXG4gICAqL1xuICBzdW1tYXJpemVBdmFpbGFibGVDYXBhYmlsaXRpZXMoY29udGV4dDogQWdlbnRNY3BDb250ZXh0KTogc3RyaW5nIHtcbiAgICBjb25zdCBsaW5lczogc3RyaW5nW10gPSBbXTtcbiAgICBcbiAgICBpZiAoY29udGV4dC5hdmFpbGFibGVTZXJ2ZXJzLmxlbmd0aCA+IDApIHtcbiAgICAgIGxpbmVzLnB1c2goYCoqQXZhaWxhYmxlIE1DUCBTZXJ2ZXJzOioqICR7Y29udGV4dC5hdmFpbGFibGVTZXJ2ZXJzLmpvaW4oJywgJyl9YCk7XG4gICAgfVxuICAgIFxuICAgIGlmIChjb250ZXh0LmF2YWlsYWJsZUNhcGFiaWxpdGllcy5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zdCB0b29sQ291bnQgPSBjb250ZXh0LmF2YWlsYWJsZUNhcGFiaWxpdGllcy5sZW5ndGg7XG4gICAgICBsaW5lcy5wdXNoKGAqKkF2YWlsYWJsZSBUb29sczoqKiAke3Rvb2xDb3VudH0gdG9vbHMgcmVnaXN0ZXJlZGApO1xuICAgIH1cbiAgICBcbiAgICBpZiAoY29udGV4dC5hdmFpbGFibGVSZXNvdXJjZXMubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgcmVzb3VyY2VDb3VudCA9IGNvbnRleHQuYXZhaWxhYmxlUmVzb3VyY2VzLmxlbmd0aDtcbiAgICAgIGxpbmVzLnB1c2goYCoqQXZhaWxhYmxlIFJlc291cmNlczoqKiAke3Jlc291cmNlQ291bnR9IHJlc291cmNlcyByZWdpc3RlcmVkYCk7XG4gICAgfVxuICAgIFxuICAgIGlmIChjb250ZXh0LnJlcXVpcmVkTWlzc2luZy5sZW5ndGggPiAwKSB7XG4gICAgICBsaW5lcy5wdXNoKGAqKk1pc3NpbmcgUmVxdWlyZWQgU2VydmVyczoqKiAke2NvbnRleHQucmVxdWlyZWRNaXNzaW5nLmpvaW4oJywgJyl9YCk7XG4gICAgfVxuICAgIFxuICAgIGlmIChjb250ZXh0Lm9wdGlvbmFsTWlzc2luZy5sZW5ndGggPiAwKSB7XG4gICAgICBsaW5lcy5wdXNoKGAqKk1pc3NpbmcgT3B0aW9uYWwgU2VydmVyczoqKiAke2NvbnRleHQub3B0aW9uYWxNaXNzaW5nLmpvaW4oJywgJyl9IChmZWF0dXJlcyBtYXkgYmUgbGltaXRlZClgKTtcbiAgICB9XG4gICAgXG4gICAgaWYgKGNvbnRleHQuaGVhbHRoV2FybmluZ3MubGVuZ3RoID4gMCkge1xuICAgICAgbGluZXMucHVzaChgKipIZWFsdGggV2FybmluZ3M6KiogJHtjb250ZXh0LmhlYWx0aFdhcm5pbmdzLmpvaW4oJzsgJyl9YCk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBsaW5lcy5qb2luKCdcXG4nKTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOaehOW7uue8uuWkseS+nei1luaKpeWRilxuICAgKi9cbiAgYnVpbGRNaXNzaW5nRGVwZW5kZW5jeVJlcG9ydChjb250ZXh0OiBBZ2VudE1jcENvbnRleHQpOiBNaXNzaW5nRGVwZW5kZW5jeVJlcG9ydCB7XG4gICAgY29uc3Qgc3VnZ2VzdGVkQWN0aW9uczogc3RyaW5nW10gPSBbXTtcbiAgICBcbiAgICBpZiAoY29udGV4dC5yZXF1aXJlZE1pc3NpbmcubGVuZ3RoID4gMCkge1xuICAgICAgc3VnZ2VzdGVkQWN0aW9ucy5wdXNoKFxuICAgICAgICBgRW5zdXJlIHJlcXVpcmVkIHNlcnZlcnMgYXJlIGF2YWlsYWJsZTogJHtjb250ZXh0LnJlcXVpcmVkTWlzc2luZy5qb2luKCcsICcpfWBcbiAgICAgICk7XG4gICAgfVxuICAgIFxuICAgIGlmIChjb250ZXh0LmFwcHJvdmFsUGVuZGluZy5sZW5ndGggPiAwKSB7XG4gICAgICBzdWdnZXN0ZWRBY3Rpb25zLnB1c2goXG4gICAgICAgIGBDb21wbGV0ZSBhcHByb3ZhbCBmb3Igc2VydmVyczogJHtjb250ZXh0LmFwcHJvdmFsUGVuZGluZy5qb2luKCcsICcpfWBcbiAgICAgICk7XG4gICAgfVxuICAgIFxuICAgIGlmIChjb250ZXh0LmhlYWx0aFdhcm5pbmdzLmxlbmd0aCA+IDApIHtcbiAgICAgIHN1Z2dlc3RlZEFjdGlvbnMucHVzaChcbiAgICAgICAgJ0NoZWNrIHNlcnZlciBoZWFsdGggc3RhdHVzIGFuZCByZXNvbHZlIGFueSBpc3N1ZXMnXG4gICAgICApO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgcmVxdWlyZWRNaXNzaW5nOiBjb250ZXh0LnJlcXVpcmVkTWlzc2luZyxcbiAgICAgIG9wdGlvbmFsTWlzc2luZzogY29udGV4dC5vcHRpb25hbE1pc3NpbmcsXG4gICAgICBkZW5pZWQ6IFtdLCAvLyDnroDljJblrp7njrBcbiAgICAgIHBlbmRpbmc6IGNvbnRleHQuYXBwcm92YWxQZW5kaW5nLFxuICAgICAgaGVhbHRoV2FybmluZ3M6IGNvbnRleHQuaGVhbHRoV2FybmluZ3MsXG4gICAgICBjYW5SdW46IGNvbnRleHQucmVxdWlyZWRNaXNzaW5nLmxlbmd0aCA9PT0gMCxcbiAgICAgIHN1Z2dlc3RlZEFjdGlvbnMsXG4gICAgfTtcbiAgfVxufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDkvr/mjbflh73mlbBcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDliJvlu7rkuIrkuIvmlofpgILphY3lmahcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZU1jcENvbnRleHRBZGFwdGVyKFxuICByZWdpc3RyeTogTWNwUmVnaXN0cnksXG4gIHBvbGljeTogTWNwUG9saWN5XG4pOiBNY3BDb250ZXh0QWRhcHRlciB7XG4gIHJldHVybiBuZXcgTWNwQ29udGV4dEFkYXB0ZXIocmVnaXN0cnksIHBvbGljeSk7XG59XG4iXX0=