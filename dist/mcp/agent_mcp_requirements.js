"use strict";
/**
 * Agent MCP Requirements - Agent MCP 需求解析
 *
 * 职责：
 * 1. 扩展 AgentSpec 对 MCP 依赖的表达
 * 2. 校验 required / optional server
 * 3. 解析 agent 的 MCP 权限声明
 * 4. 给 orchestrator / planner 提供"能否运行"的判断依据
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentMcpRequirementsResolver = void 0;
exports.createAgentMcpRequirementsResolver = createAgentMcpRequirementsResolver;
exports.resolveMcpRequirements = resolveMcpRequirements;
n;
blockingReasons: string[];
n;
warnings: string[];
// ============================================================================
// Agent MCP 需求解析器
// ============================================================================
class AgentMcpRequirementsResolver {
    constructor(registry, policy) {
        this.registry = registry;
        this.policy = policy;
    }
    /**
     * 解析 Agent MCP 需求
     */
    resolveAgentMcpRequirements(agentSpec, availableServers) {
        const requirements = [];
        const dependencies = [];
        const blockingReasons = [];
        const warnings = [];
        // 解析 required servers
        for (const server of agentSpec.requiredMcpServers || []) {
            requirements.push({
                server,
                level: 'required',
                capabilities: [],
                resourceTypes: [],
            });
            const status = this.resolveDependencyStatus(server, 'required', availableServers, agentSpec);
            dependencies.push(status);
            if (status.status === 'missing' || status.status === 'unavailable') {
                blockingReasons.push(`Required server ${server} is ${status.status}`);
            }
            else if (status.status === 'denied') {
                blockingReasons.push(`Required server ${server} is denied by policy`);
            }
            else if (status.status === 'pending') {
                blockingReasons.push(`Required server ${server} requires approval`);
            }
            else if (status.status === 'degraded') {
                warnings.push(`Required server ${server} is degraded`);
            }
        }
        // 解析 optional servers
        for (const server of agentSpec.optionalMcpServers || []) {
            requirements.push({
                server,
                level: 'optional',
                capabilities: [],
                resourceTypes: [],
            });
            const status = this.resolveDependencyStatus(server, 'optional', availableServers, agentSpec);
            dependencies.push(status);
            if (status.status === 'missing' || status.status === 'unavailable') {
                warnings.push(`Optional server ${server} is ${status.status} (feature will be limited)`);
            }
            else if (status.status === 'denied') {
                warnings.push(`Optional server ${server} is denied by policy`);
            }
            else if (status.status === 'pending') {
                warnings.push(`Optional server ${server} requires approval`);
            }
        }
        return {
            requirements,
            dependencies,
            canRun: blockingReasons.length === 0,
            blockingReasons,
            warnings,
        };
    }
    /**
     * 检查 required servers
     */
    checkRequiredServers(agentSpec, availableServers) {
        const required = agentSpec.requiredMcpServers || [];
        const present = [];
        const missing = [];
        for (const server of required) {
            if (availableServers.includes(server)) {
                present.push(server);
            }
            else {
                missing.push(server);
            }
        }
        return {
            allPresent: missing.length === 0,
            missing,
            present,
        };
    }
    /**
     * 构建 MCP 能力视图
     */
    buildMcpCapabilityView(agentSpec, availableServers) {
        const availableServersList = [];
        const availableCapabilities = [];
        const availableResources = [];
        const deniedServers = [];
        const pendingServers = [];
        const allServers = [
            ...(agentSpec.requiredMcpServers || []),
            ...(agentSpec.optionalMcpServers || []),
        ];
        for (const server of allServers) {
            // 检查是否可用
            if (!availableServers.includes(server)) {
                continue;
            }
            // 检查权限
            const decision = this.policy.checkServerAccess(server);
            if (decision.effect === 'deny') {
                deniedServers.push(server);
                continue;
            }
            if (decision.effect === 'ask') {
                pendingServers.push(server);
                continue;
            }
            // server 可用
            availableServersList.push(server);
            // 获取 server 的能力
            const serverDescriptor = this.registry.getServer(server);
            if (serverDescriptor) {
                for (const tool of serverDescriptor.tools) {
                    availableCapabilities.push(tool.qualifiedName);
                }
                for (const resource of serverDescriptor.resources) {
                    availableResources.push(resource.qualifiedName);
                }
            }
        }
        return {
            availableServers: availableServersList,
            availableCapabilities,
            availableResources,
            deniedServers,
            pendingServers,
        };
    }
    // ============================================================================
    // 内部方法
    // ============================================================================
    /**
     * 解析依赖状态
     */
    resolveDependencyStatus(server, level, availableServers, agentSpec) {
        // 检查是否在可用列表中
        if (!availableServers.includes(server)) {
            return {
                server,
                level,
                status: 'missing',
                reason: `Server ${server} is not available`,
            };
        }
        // 检查权限
        const decision = this.policy.checkServerAccess(server);
        if (decision.effect === 'deny') {
            return {
                server,
                level,
                status: 'denied',
                reason: decision.reason,
            };
        }
        if (decision.effect === 'ask') {
            return {
                server,
                level,
                status: 'pending',
                reason: decision.reason,
            };
        }
        // 检查 server 健康状态（简化实现）
        const serverDescriptor = this.registry.getServer(server);
        if (serverDescriptor && serverDescriptor.healthStatus === 'unhealthy') {
            return {
                server,
                level,
                status: 'unavailable',
                reason: 'Server is unhealthy',
            };
        }
        if (serverDescriptor && serverDescriptor.healthStatus === 'degraded') {
            return {
                server,
                level,
                status: 'degraded',
                reason: 'Server is degraded',
            };
        }
        return {
            server,
            level,
            status: 'available',
        };
    }
}
exports.AgentMcpRequirementsResolver = AgentMcpRequirementsResolver;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建需求解析器
 */
function createAgentMcpRequirementsResolver(registry, policy) {
    return new AgentMcpRequirementsResolver(registry, policy);
}
/**
 * 快速解析需求
 */
function resolveMcpRequirements(agentSpec, availableServers, registry, policy) {
    const resolver = new AgentMcpRequirementsResolver(registry, policy);
    return resolver.resolveAgentMcpRequirements(agentSpec, availableServers);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWdlbnRfbWNwX3JlcXVpcmVtZW50cy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9tY3AvYWdlbnRfbWNwX3JlcXVpcmVtZW50cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7O0dBV0c7OztBQXlTSCxnRkFLQztBQUtELHdEQVFDO0FBL1JhLENBQUMsQ0FBQTtBQUFFLGVBQWUsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDO0FBRTdCLENBQUMsQ0FBQTtBQUFFLFFBQVEsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDO0FBR3BDLCtFQUErRTtBQUMvRSxrQkFBa0I7QUFDbEIsK0VBQStFO0FBRS9FLE1BQWEsNEJBQTRCO0lBSXZDLFlBQVksUUFBcUIsRUFBRSxNQUFpQjtRQUNsRCxJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztRQUN6QixJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztJQUN2QixDQUFDO0lBRUQ7O09BRUc7SUFDSCwyQkFBMkIsQ0FDekIsU0FBdUIsRUFDdkIsZ0JBQTBCO1FBRTFCLE1BQU0sWUFBWSxHQUEwQixFQUFFLENBQUM7UUFDL0MsTUFBTSxZQUFZLEdBQTBCLEVBQUUsQ0FBQztRQUMvQyxNQUFNLGVBQWUsR0FBYSxFQUFFLENBQUM7UUFDckMsTUFBTSxRQUFRLEdBQWEsRUFBRSxDQUFDO1FBRTlCLHNCQUFzQjtRQUN0QixLQUFLLE1BQU0sTUFBTSxJQUFJLFNBQVMsQ0FBQyxrQkFBa0IsSUFBSSxFQUFFLEVBQUUsQ0FBQztZQUN4RCxZQUFZLENBQUMsSUFBSSxDQUFDO2dCQUNoQixNQUFNO2dCQUNOLEtBQUssRUFBRSxVQUFVO2dCQUNqQixZQUFZLEVBQUUsRUFBRTtnQkFDaEIsYUFBYSxFQUFFLEVBQUU7YUFDbEIsQ0FBQyxDQUFDO1lBRUgsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLHVCQUF1QixDQUN6QyxNQUFNLEVBQ04sVUFBVSxFQUNWLGdCQUFnQixFQUNo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dUIsRUFDdkIsZ0JBQTBCLEVBQzFCLFFBQXFCLEVBQ3JCLE1BQWlCO0lBRWpCLE1BQU0sUUFBUSxHQUFHLElBQUksNEJBQTRCLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBQ3BFLE9BQU8sUUFBUSxDQUFDLDJCQUEyQixDQUFDLFNBQVMsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO0FBQzNFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEFnZW50IE1DUCBSZXF1aXJlbWVudHMgLSBBZ2VudCBNQ1Ag6ZyA5rGC6Kej5p6QXG4gKiBcbiAqIOiBjOi0o++8mlxuICogMS4g5omp5bGVIEFnZW50U3BlYyDlr7kgTUNQIOS+nei1lueahOihqOi+vlxuICogMi4g5qCh6aqMIHJlcXVpcmVkIC8gb3B0aW9uYWwgc2VydmVyXG4gKiAzLiDop6PmnpAgYWdlbnQg55qEIE1DUCDmnYPpmZDlo7DmmI5cbiAqIDQuIOe7mSBvcmNoZXN0cmF0b3IgLyBwbGFubmVyIOaPkOS+m1wi6IO95ZCm6L+Q6KGMXCLnmoTliKTmlq3kvp3mja5cbiAqIFxuICogQHZlcnNpb24gdjAuMS4wXG4gKiBAZGF0ZSAyMDI2LTA0LTAzXG4gKi9cblxuaW1wb3J0IHR5cGUge1xuICBBZ2VudE1jcFJlcXVpcmVtZW50LFxuICBBZ2VudE1jcFNwZWMsXG4gIE1jcERlcGVuZGVuY3lTdGF0dXMsXG4gIE1jcFJlcXVpcmVtZW50TGV2ZWwsXG59IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgTWNwUmVnaXN0cnkgfSBmcm9tICcuL3Jlc291cmNlX3JlZ2lzdHJ5JztcbmltcG9ydCB7IE1jcFBvbGljeSB9IGZyb20gJy4vbWNwX3BvbGljeSc7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOexu+Wei+WumuS5iVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIOmcgOaxguino+aekOe7k+aenFxuICovXG5leHBvcnQgaW50ZXJmYWNlIFJlcXVpcmVtZW50c1Jlc29sdXRpb24ge1xuICAvKiog5omA5pyJ6ZyA5rGCICovXG4gIHJlcXVpcmVtZW50czogQWdlbnRNY3BSZXF1aXJlbWVudFtdO1xuICBcbiAgLyoqIOS+nei1lueKtuaAgSAqL1xuICBkZXBlbmRlbmNpZXM6IE1jcERlcGVuZGVuY3lTdGF0dXNbXTtcbiAgXG4gIC8qKiDmmK/lkKblj6/ov5DooYwgKi9cbiAgY2FuUnVuOiBib29sZWFuO1xuICBcbiAgLyoqIOmYu+WhnuWOn+WboCAqL1xcbiAgYmxvY2tpbmdSZWFzb25zOiBzdHJpbmdbXTtcbiAgXG4gIC8qKiDorablkYrkv6Hmga8gKi9cXG4gIHdhcm5pbmdzOiBzdHJpbmdbXTtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gQWdlbnQgTUNQIOmcgOaxguino+aekOWZqFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgY2xhc3MgQWdlbnRNY3BSZXF1aXJlbWVudHNSZXNvbHZlciB7XG4gIHByaXZhdGUgcmVnaXN0cnk6IE1jcFJlZ2lzdHJ5O1xuICBwcml2YXRlIHBvbGljeTogTWNwUG9saWN5O1xuICBcbiAgY29uc3RydWN0b3IocmVnaXN0cnk6IE1jcFJlZ2lzdHJ5LCBwb2xpY3k6IE1jcFBvbGljeSkge1xuICAgIHRoaXMucmVnaXN0cnkgPSByZWdpc3RyeTtcbiAgICB0aGlzLnBvbGljeSA9IHBvbGljeTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOino+aekCBBZ2VudCBNQ1Ag6ZyA5rGCXG4gICAqL1xuICByZXNvbHZlQWdlbnRNY3BSZXF1aXJlbWVudHMoXG4gICAgYWdlbnRTcGVjOiBBZ2VudE1jcFNwZWMsXG4gICAgYXZhaWxhYmxlU2VydmVyczogc3RyaW5nW11cbiAgKTogUmVxdWlyZW1lbnRzUmVzb2x1dGlvbiB7XG4gICAgY29uc3QgcmVxdWlyZW1lbnRzOiBBZ2VudE1jcFJlcXVpcmVtZW50W10gPSBbXTtcbiAgICBjb25zdCBkZXBlbmRlbmNpZXM6IE1jcERlcGVuZGVuY3lTdGF0dXNbXSA9IFtdO1xuICAgIGNvbnN0IGJsb2NraW5nUmVhc29uczogc3RyaW5nW10gPSBbXTtcbiAgICBjb25zdCB3YXJuaW5nczogc3RyaW5nW10gPSBbXTtcbiAgICBcbiAgICAvLyDop6PmnpAgcmVxdWlyZWQgc2VydmVyc1xuICAgIGZvciAoY29uc3Qgc2VydmVyIG9mIGFnZW50U3BlYy5yZXF1aXJlZE1jcFNlcnZlcnMgfHwgW10pIHtcbiAgICAgIHJlcXVpcmVtZW50cy5wdXNoKHtcbiAgICAgICAgc2VydmVyLFxuICAgICAgICBsZXZlbDogJ3JlcXVpcmVkJyxcbiAgICAgICAgY2FwYWJpbGl0aWVzOiBbXSxcbiAgICAgICAgcmVzb3VyY2VUeXBlczogW10sXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgY29uc3Qgc3RhdHVzID0gdGhpcy5yZXNvbHZlRGVwZW5kZW5jeVN0YXR1cyhcbiAgICAgICAgc2VydmVyLFxuICAgICAgICAncmVxdWlyZWQnLFxuICAgICAgICBhdmFpbGFibGVTZXJ2ZXJzLFxuICAgICAgICBhZ2VudFNwZWNcbiAgICAgICk7XG4gICAgICBkZXBlbmRlbmNpZXMucHVzaChzdGF0dXMpO1xuICAgICAgXG4gICAgICBpZiAoc3RhdHVzLnN0YXR1cyA9PT0gJ21pc3NpbmcnIHx8IHN0YXR1cy5zdGF0dXMgPT09ICd1bmF2YWlsYWJsZScpIHtcbiAgICAgICAgYmxvY2tpbmdSZWFzb25zLnB1c2goYFJlcXVpcmVkIHNlcnZlciAke3NlcnZlcn0gaXMgJHtzdGF0dXMuc3RhdHVzfWApO1xuICAgICAgfSBlbHNlIGlmIChzdGF0dXMuc3RhdHVzID09PSAnZGVuaWVkJykge1xuICAgICAgICBibG9ja2luZ1JlYXNvbnMucHVzaChgUmVxdWlyZWQgc2VydmVyICR7c2VydmVyfSBpcyBkZW5pZWQgYnkgcG9saWN5YCk7XG4gICAgICB9IGVsc2UgaWYgKHN0YXR1cy5zdGF0dXMgPT09ICdwZW5kaW5nJykge1xuICAgICAgICBibG9ja2luZ1JlYXNvbnMucHVzaChgUmVxdWlyZWQgc2VydmVyICR7c2VydmVyfSByZXF1aXJlcyBhcHByb3ZhbGApO1xuICAgICAgfSBlbHNlIGlmIChzdGF0dXMuc3RhdHVzID09PSAnZGVncmFkZWQnKSB7XG4gICAgICAgIHdhcm5pbmdzLnB1c2goYFJlcXVpcmVkIHNlcnZlciAke3NlcnZlcn0gaXMgZGVncmFkZWRgKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8g6Kej5p6QIG9wdGlvbmFsIHNlcnZlcnNcbiAgICBmb3IgKGNvbnN0IHNlcnZlciBvZiBhZ2VudFNwZWMub3B0aW9uYWxNY3BTZXJ2ZXJzIHx8IFtdKSB7XG4gICAgICByZXF1aXJlbWVudHMucHVzaCh7XG4gICAgICAgIHNlcnZlcixcbiAgICAgICAgbGV2ZWw6ICdvcHRpb25hbCcsXG4gICAgICAgIGNhcGFiaWxpdGllczogW10sXG4gICAgICAgIHJlc291cmNlVHlwZXM6IFtdLFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHN0YXR1cyA9IHRoaXMucmVzb2x2ZURlcGVuZGVuY3lTdGF0dXMoXG4gICAgICAgIHNlcnZlcixcbiAgICAgICAgJ29wdGlvbmFsJyxcbiAgICAgICAgYXZhaWxhYmxlU2VydmVycyxcbiAgICAgICAgYWdlbnRTcGVjXG4gICAgICApO1xuICAgICAgZGVwZW5kZW5jaWVzLnB1c2goc3RhdHVzKTtcbiAgICAgIFxuICAgICAgaWYgKHN0YXR1cy5zdGF0dXMgPT09ICdtaXNzaW5nJyB8fCBzdGF0dXMuc3RhdHVzID09PSAndW5hdmFpbGFibGUnKSB7XG4gICAgICAgIHdhcm5pbmdzLnB1c2goYE9wdGlvbmFsIHNlcnZlciAke3NlcnZlcn0gaXMgJHtzdGF0dXMuc3RhdHVzfSAoZmVhdHVyZSB3aWxsIGJlIGxpbWl0ZWQpYCk7XG4gICAgICB9IGVsc2UgaWYgKHN0YXR1cy5zdGF0dXMgPT09ICdkZW5pZWQnKSB7XG4gICAgICAgIHdhcm5pbmdzLnB1c2goYE9wdGlvbmFsIHNlcnZlciAke3NlcnZlcn0gaXMgZGVuaWVkIGJ5IHBvbGljeWApO1xuICAgICAgfSBlbHNlIGlmIChzdGF0dXMuc3RhdHVzID09PSAncGVuZGluZycpIHtcbiAgICAgICAgd2FybmluZ3MucHVzaChgT3B0aW9uYWwgc2VydmVyICR7c2VydmVyfSByZXF1aXJlcyBhcHByb3ZhbGApO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgcmVxdWlyZW1lbnRzLFxuICAgICAgZGVwZW5kZW5jaWVzLFxuICAgICAgY2FuUnVuOiBibG9ja2luZ1JlYXNvbnMubGVuZ3RoID09PSAwLFxuICAgICAgYmxvY2tpbmdSZWFzb25zLFxuICAgICAgd2FybmluZ3MsXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOajgOafpSByZXF1aXJlZCBzZXJ2ZXJzXG4gICAqL1xuICBjaGVja1JlcXVpcmVkU2VydmVycyhcbiAgICBhZ2VudFNwZWM6IEFnZW50TWNwU3BlYyxcbiAgICBhdmFpbGFibGVTZXJ2ZXJzOiBzdHJpbmdbXVxuICApOiB7XG4gICAgYWxsUHJlc2VudDogYm9vbGVhbjtcbiAgICBtaXNzaW5nOiBzdHJpbmdbXTtcbiAgICBwcmVzZW50OiBzdHJpbmdbXTtcbiAgfSB7XG4gICAgY29uc3QgcmVxdWlyZWQgPSBhZ2VudFNwZWMucmVxdWlyZWRNY3BTZXJ2ZXJzIHx8IFtdO1xuICAgIGNvbnN0IHByZXNlbnQ6IHN0cmluZ1tdID0gW107XG4gICAgY29uc3QgbWlzc2luZzogc3RyaW5nW10gPSBbXTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IHNlcnZlciBvZiByZXF1aXJlZCkge1xuICAgICAgaWYgKGF2YWlsYWJsZVNlcnZlcnMuaW5jbHVkZXMoc2VydmVyKSkge1xuICAgICAgICBwcmVzZW50LnB1c2goc2VydmVyKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG1pc3NpbmcucHVzaChzZXJ2ZXIpO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgYWxsUHJlc2VudDogbWlzc2luZy5sZW5ndGggPT09IDAsXG4gICAgICBtaXNzaW5nLFxuICAgICAgcHJlc2VudCxcbiAgICB9O1xuICB9XG4gIFxuICAvKipcbiAgICog5p6E5bu6IE1DUCDog73lipvop4blm75cbiAgICovXG4gIGJ1aWxkTWNwQ2FwYWJpbGl0eVZpZXcoXG4gICAgYWdlbnRTcGVjOiBBZ2VudE1jcFNwZWMsXG4gICAgYXZhaWxhYmxlU2VydmVyczogc3RyaW5nW11cbiAgKToge1xuICAgIGF2YWlsYWJsZVNlcnZlcnM6IHN0cmluZ1tdO1xuICAgIGF2YWlsYWJsZUNhcGFiaWxpdGllczogc3RyaW5nW107XG4gICAgYXZhaWxhYmxlUmVzb3VyY2VzOiBzdHJpbmdbXTtcbiAgICBkZW5pZWRTZXJ2ZXJzOiBzdHJpbmdbXTtcbiAgICBwZW5kaW5nU2VydmVyczogc3RyaW5nW107XG4gIH0ge1xuICAgIGNvbnN0IGF2YWlsYWJsZVNlcnZlcnNMaXN0OiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IGF2YWlsYWJsZUNhcGFiaWxpdGllczogc3RyaW5nW10gPSBbXTtcbiAgICBjb25zdCBhdmFpbGFibGVSZXNvdXJjZXM6IHN0cmluZ1tdID0gW107XG4gICAgY29uc3QgZGVuaWVkU2VydmVyczogc3RyaW5nW10gPSBbXTtcbiAgICBjb25zdCBwZW5kaW5nU2VydmVyczogc3RyaW5nW10gPSBbXTtcbiAgICBcbiAgICBjb25zdCBhbGxTZXJ2ZXJzID0gW1xuICAgICAgLi4uKGFnZW50U3BlYy5yZXF1aXJlZE1jcFNlcnZlcnMgfHwgW10pLFxuICAgICAgLi4uKGFnZW50U3BlYy5vcHRpb25hbE1jcFNlcnZlcnMgfHwgW10pLFxuICAgIF07XG4gICAgXG4gICAgZm9yIChjb25zdCBzZXJ2ZXIgb2YgYWxsU2VydmVycykge1xuICAgICAgLy8g5qOA5p+l5piv5ZCm5Y+v55SoXG4gICAgICBpZiAoIWF2YWlsYWJsZVNlcnZlcnMuaW5jbHVkZXMoc2VydmVyKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8g5qOA5p+l5p2D6ZmQXG4gICAgICBjb25zdCBkZWNpc2lvbiA9IHRoaXMucG9saWN5LmNoZWNrU2VydmVyQWNjZXNzKHNlcnZlcik7XG4gICAgICBcbiAgICAgIGlmIChkZWNpc2lvbi5lZmZlY3QgPT09ICdkZW55Jykge1xuICAgICAgICBkZW5pZWRTZXJ2ZXJzLnB1c2goc2VydmVyKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGlmIChkZWNpc2lvbi5lZmZlY3QgPT09ICdhc2snKSB7XG4gICAgICAgIHBlbmRpbmdTZXJ2ZXJzLnB1c2goc2VydmVyKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIHNlcnZlciDlj6/nlKhcbiAgICAgIGF2YWlsYWJsZVNlcnZlcnNMaXN0LnB1c2goc2VydmVyKTtcbiAgICAgIFxuICAgICAgLy8g6I635Y+WIHNlcnZlciDnmoTog73liptcbiAgICAgIGNvbnN0IHNlcnZlckRlc2NyaXB0b3IgPSB0aGlzLnJlZ2lzdHJ5LmdldFNlcnZlcihzZXJ2ZXIpO1xuICAgICAgaWYgKHNlcnZlckRlc2NyaXB0b3IpIHtcbiAgICAgICAgZm9yIChjb25zdCB0b29sIG9mIHNlcnZlckRlc2NyaXB0b3IudG9vbHMpIHtcbiAgICAgICAgICBhdmFpbGFibGVDYXBhYmlsaXRpZXMucHVzaCh0b29sLnF1YWxpZmllZE5hbWUpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoY29uc3QgcmVzb3VyY2Ugb2Ygc2VydmVyRGVzY3JpcHRvci5yZXNvdXJjZXMpIHtcbiAgICAgICAgICBhdmFpbGFibGVSZXNvdXJjZXMucHVzaChyZXNvdXJjZS5xdWFsaWZpZWROYW1lKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgYXZhaWxhYmxlU2VydmVyczogYXZhaWxhYmxlU2VydmVyc0xpc3QsXG4gICAgICBhdmFpbGFibGVDYXBhYmlsaXRpZXMsXG4gICAgICBhdmFpbGFibGVSZXNvdXJjZXMsXG4gICAgICBkZW5pZWRTZXJ2ZXJzLFxuICAgICAgcGVuZGluZ1NlcnZlcnMsXG4gICAgfTtcbiAgfVxuICBcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAvLyDlhoXpg6jmlrnms5VcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICBcbiAgLyoqXG4gICAqIOino+aekOS+nei1lueKtuaAgVxuICAgKi9cbiAgcHJpdmF0ZSByZXNvbHZlRGVwZW5kZW5jeVN0YXR1cyhcbiAgICBzZXJ2ZXI6IHN0cmluZyxcbiAgICBsZXZlbDogTWNwUmVxdWlyZW1lbnRMZXZlbCxcbiAgICBhdmFpbGFibGVTZXJ2ZXJzOiBzdHJpbmdbXSxcbiAgICBhZ2VudFNwZWM6IEFnZW50TWNwU3BlY1xuICApOiBNY3BEZXBlbmRlbmN5U3RhdHVzIHtcbiAgICAvLyDmo4Dmn6XmmK/lkKblnKjlj6/nlKjliJfooajkuK1cbiAgICBpZiAoIWF2YWlsYWJsZVNlcnZlcnMuaW5jbHVkZXMoc2VydmVyKSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc2VydmVyLFxuICAgICAgICBsZXZlbCxcbiAgICAgICAgc3RhdHVzOiAnbWlzc2luZycsXG4gICAgICAgIHJlYXNvbjogYFNlcnZlciAke3NlcnZlcn0gaXMgbm90IGF2YWlsYWJsZWAsXG4gICAgICB9O1xuICAgIH1cbiAgICBcbiAgICAvLyDmo4Dmn6XmnYPpmZBcbiAgICBjb25zdCBkZWNpc2lvbiA9IHRoaXMucG9saWN5LmNoZWNrU2VydmVyQWNjZXNzKHNlcnZlcik7XG4gICAgXG4gICAgaWYgKGRlY2lzaW9uLmVmZmVjdCA9PT0gJ2RlbnknKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzZXJ2ZXIsXG4gICAgICAgIGxldmVsLFxuICAgICAgICBzdGF0dXM6ICdkZW5pZWQnLFxuICAgICAgICByZWFzb246IGRlY2lzaW9uLnJlYXNvbixcbiAgICAgIH07XG4gICAgfVxuICAgIFxuICAgIGlmIChkZWNpc2lvbi5lZmZlY3QgPT09ICdhc2snKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzZXJ2ZXIsXG4gICAgICAgIGxldmVsLFxuICAgICAgICBzdGF0dXM6ICdwZW5kaW5nJyxcbiAgICAgICAgcmVhc29uOiBkZWNpc2lvbi5yZWFzb24sXG4gICAgICB9O1xuICAgIH1cbiAgICBcbiAgICAvLyDmo4Dmn6Ugc2VydmVyIOWBpeW6t+eKtuaAge+8iOeugOWMluWunueOsO+8iVxuICAgIGNvbnN0IHNlcnZlckRlc2NyaXB0b3IgPSB0aGlzLnJlZ2lzdHJ5LmdldFNlcnZlcihzZXJ2ZXIpO1xuICAgIGlmIChzZXJ2ZXJEZXNjcmlwdG9yICYmIHNlcnZlckRlc2NyaXB0b3IuaGVhbHRoU3RhdHVzID09PSAndW5oZWFsdGh5Jykge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc2VydmVyLFxuICAgICAgICBsZXZlbCxcbiAgICAgICAgc3RhdHVzOiAndW5hdmFpbGFibGUnLFxuICAgICAgICByZWFzb246ICdTZXJ2ZXIgaXMgdW5oZWFsdGh5JyxcbiAgICAgIH07XG4gICAgfVxuICAgIFxuICAgIGlmIChzZXJ2ZXJEZXNjcmlwdG9yICYmIHNlcnZlckRlc2NyaXB0b3IuaGVhbHRoU3RhdHVzID09PSAnZGVncmFkZWQnKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzZXJ2ZXIsXG4gICAgICAgIGxldmVsLFxuICAgICAgICBzdGF0dXM6ICdkZWdyYWRlZCcsXG4gICAgICAgIHJlYXNvbjogJ1NlcnZlciBpcyBkZWdyYWRlZCcsXG4gICAgICB9O1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgc2VydmVyLFxuICAgICAgbGV2ZWwsXG4gICAgICBzdGF0dXM6ICdhdmFpbGFibGUnLFxuICAgIH07XG4gIH1cbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5L6/5o235Ye95pWwXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog5Yib5bu66ZyA5rGC6Kej5p6Q5ZmoXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVBZ2VudE1jcFJlcXVpcmVtZW50c1Jlc29sdmVyKFxuICByZWdpc3RyeTogTWNwUmVnaXN0cnksXG4gIHBvbGljeTogTWNwUG9saWN5XG4pOiBBZ2VudE1jcFJlcXVpcmVtZW50c1Jlc29sdmVyIHtcbiAgcmV0dXJuIG5ldyBBZ2VudE1jcFJlcXVpcmVtZW50c1Jlc29sdmVyKHJlZ2lzdHJ5LCBwb2xpY3kpO1xufVxuXG4vKipcbiAqIOW/q+mAn+ino+aekOmcgOaxglxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZU1jcFJlcXVpcmVtZW50cyhcbiAgYWdlbnRTcGVjOiBBZ2VudE1jcFNwZWMsXG4gIGF2YWlsYWJsZVNlcnZlcnM6IHN0cmluZ1tdLFxuICByZWdpc3RyeTogTWNwUmVnaXN0cnksXG4gIHBvbGljeTogTWNwUG9saWN5XG4pOiBSZXF1aXJlbWVudHNSZXNvbHV0aW9uIHtcbiAgY29uc3QgcmVzb2x2ZXIgPSBuZXcgQWdlbnRNY3BSZXF1aXJlbWVudHNSZXNvbHZlcihyZWdpc3RyeSwgcG9saWN5KTtcbiAgcmV0dXJuIHJlc29sdmVyLnJlc29sdmVBZ2VudE1jcFJlcXVpcmVtZW50cyhhZ2VudFNwZWMsIGF2YWlsYWJsZVNlcnZlcnMpO1xufVxuIl19