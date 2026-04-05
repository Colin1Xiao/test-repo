"use strict";
/**
 * Skill Capability View - Skill 能力视图
 *
 * 职责：
 * 1. 把已加载 skill 的 capability 汇总成统一视图
 * 2. 给 planner / repo_reader / code_reviewer / release_agent 等角色返回不同粒度的摘要
 * 3. 将 skill 提供的 tools / MCP dependencies / code_intel capabilities / verification abilities 做统一归纳
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillCapabilityView = void 0;
exports.createSkillCapabilityView = createSkillCapabilityView;
exports.buildSkillCapabilityView = buildSkillCapabilityView;
exports.buildAgentCapabilitySummary = buildAgentCapabilitySummary;
// ============================================================================
// Skill 能力视图
// ============================================================================
class SkillCapabilityView {
    constructor(config = {}) {
        this.config = {
            includeToolDetails: config.includeToolDetails ?? false,
            includeMcpDependencies: config.includeMcpDependencies ?? true,
        };
    }
    /**
     * 构建能力视图
     */
    buildCapabilityView(loadedSkills) {
        const capabilityTypes = new Set();
        const providedTools = [];
        const requiredMcpServers = new Set();
        const codeIntelHooks = [];
        const verificationHooks = [];
        const automationHooks = [];
        for (const skill of loadedSkills) {
            // 收集能力类型
            for (const capability of skill.capabilities) {
                capabilityTypes.add(capability);
            }
            // 收集工具
            providedTools.push(...skill.tools);
            // 收集 MCP 依赖
            if (this.config.includeMcpDependencies) {
                requiredMcpServers.add(...skill.mcpServers);
            }
            // 收集代码智能 hooks
            if (skill.capabilities.includes('code_intel')) {
                codeIntelHooks.push(skill.skillName);
            }
            // 收集验证 hooks
            if (skill.capabilities.includes('verification')) {
                verificationHooks.push(skill.skillName);
            }
            // 收集自动化 hooks
            if (skill.capabilities.includes('automation')) {
                automationHooks.push(skill.skillName);
            }
        }
        return {
            capabilityTypes: Array.from(capabilityTypes),
            providedTools,
            requiredMcpServers: Array.from(requiredMcpServers),
            codeIntelHooks,
            verificationHooks,
            automationHooks,
        };
    }
    /**
     * 构建 Agent 能力摘要
     */
    buildAgentCapabilitySummary(agentRole, loadedSkills) {
        const capabilityView = this.buildCapabilityView(loadedSkills);
        // 构建可用能力摘要
        const availableCapabilities = [];
        for (const capabilityType of capabilityView.capabilityTypes) {
            const providedBy = loadedSkills
                .filter(s => s.capabilities.includes(capabilityType))
                .map(s => s.skillName);
            availableCapabilities.push({
                capabilityType,
                providedBy,
            });
        }
        // 计算缺失的能力（根据角色）
        const missingCapabilities = this.findMissingCapabilities(agentRole, capabilityView);
        return {
            agentRole,
            availableCapabilities,
            availableTools: capabilityView.providedTools,
            requiredMcpServers: capabilityView.requiredMcpServers,
            missingCapabilities,
        };
    }
    /**
     * 按能力类型查找 Skills
     */
    findSkillsByCapability(loadedSkills, capabilityType) {
        return loadedSkills.filter(skill => skill.capabilities.includes(capabilityType));
    }
    /**
     * 按工具名称查找 Skills
     */
    findSkillsByTool(loadedSkills, toolName) {
        return loadedSkills.filter(skill => skill.tools.includes(toolName));
    }
    /**
     * 查找需要特定 MCP Server 的 Skills
     */
    findSkillsRequiringMcpServer(loadedSkills, serverName) {
        return loadedSkills.filter(skill => skill.mcpServers.includes(serverName));
    }
    /**
     * 获取能力描述
     */
    getCapabilityDescription(capabilityType) {
        const descriptions = {
            tool_runtime: 'Runtime tool execution capabilities',
            code_intel: 'Code intelligence and analysis capabilities',
            mcp_integration: 'MCP server integration capabilities',
            verification: 'Testing and verification capabilities',
            repo_analysis: 'Repository analysis capabilities',
            review: 'Code review capabilities',
            release: 'Release and deployment capabilities',
            automation: 'Automation capabilities',
        };
        return descriptions[capabilityType] || 'Unknown capability';
    }
    // ============================================================================
    // 内部方法
    // ============================================================================
    /**
     * 查找缺失的能力
     */
    findMissingCapabilities(agentRole, capabilityView) {
        const missing = [];
        // 根据角色定义期望的能力
        const expectedCapabilities = this.getExpectedCapabilitiesForRole(agentRole);
        for (const expected of expectedCapabilities) {
            if (!capabilityView.capabilityTypes.includes(expected)) {
                missing.push(expected);
            }
        }
        return missing;
    }
    /**
     * 获取角色期望的能力
     */
    getExpectedCapabilitiesForRole(agentRole) {
        const roleCapabilities = {
            planner: ['repo_analysis', 'code_intel'],
            repo_reader: ['repo_analysis', 'code_intel'],
            code_reviewer: ['review', 'code_intel'],
            code_fixer: ['code_intel', 'tool_runtime'],
            verify_agent: ['verification', 'tool_runtime'],
            release_agent: ['release', 'automation'],
        };
        return roleCapabilities[agentRole] || [];
    }
}
exports.SkillCapabilityView = SkillCapabilityView;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建能力视图
 */
function createSkillCapabilityView(config) {
    return new SkillCapabilityView(config);
}
/**
 * 快速构建能力视图
 */
function buildSkillCapabilityView(loadedSkills, config) {
    const view = new SkillCapabilityView(config);
    return view.buildCapabilityView(loadedSkills);
}
/**
 * 快速构建 Agent 能力摘要
 */
function buildAgentCapabilitySummary(agentRole, loadedSkills, config) {
    const view = new SkillCapabilityView(config);
    return view.buildAgentCapabilitySummary(agentRole, loadedSkills);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2tpbGxfY2FwYWJpbGl0eV92aWV3LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3NraWxscy9za2lsbF9jYXBhYmlsaXR5X3ZpZXcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7O0dBVUc7OztBQTRPSCw4REFFQztBQUtELDREQU1DO0FBS0Qsa0VBT0M7QUE3T0QsK0VBQStFO0FBQy9FLGFBQWE7QUFDYiwrRUFBK0U7QUFFL0UsTUFBYSxtQkFBbUI7SUFHOUIsWUFBWSxTQUErQixFQUFFO1FBQzNDLElBQUksQ0FBQyxNQUFNLEdBQUc7WUFDWixrQkFBa0IsRUFBRSxNQUFNLENBQUMsa0JBQWtCLElBQUksS0FBSztZQUN0RCxzQkFBc0IsRUFBRSxNQUFNLENBQUMsc0JBQXNCLElBQUksSUFBSTtTQUM5RCxDQUFDO0lBQ0osQ0FBQztJQUVEOztPQUVHO0lBQ0gsbUJBQW1CLENBQ2pCLFlBQWdDO1FBU2hDLE1BQU0sZUFBZSxHQUFHLElBQUksR0FBRyxFQUF1QixDQUFDO1FBQ3ZELE1BQU0sYUFBYSxHQUFhLEVBQUUsQ0FBQztRQUNuQyxNQUFNLGtCQUFrQixHQUFHLElBQUksR0FBRyxFQUFVLENBQUM7UUFDN0MsTUFBTSxjQUFjLEdBQWEsRUFBRSxDQUFDO1FBQ3BDLE1BQU0saUJBQWlCLEdBQWEsRUFBRSxDQUFDO1FBQ3ZDLE1BQU0sZUFBZSxHQUFhLEVBQUUsQ0FBQztRQUVyQyxLQUFLLE1BQU0sS0FBSyxJQUFJLFlBQVksRUFBRSxDQUFDO1lBQ2pDLFNBQVM7WUFDVCxLQUFLLE1BQU0sVUFBVSxJQUFJLEtBQUssQ0FBQyxZQUFZLEVBQUUsQ0FBQztnQkFDNUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxVQUFpQyxDQUFDLENBQUM7WUFDekQsQ0FBQztZQUVELE9BQU87WUFDUCxhQUFhLENBQUMsSUFBSSxDQUFDLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBRW5DLFlBQVk7WUFDWixJQUFJLElB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QUM7WUFDdkMsVUFBVSxFQUFFLENBQUMsWUFBWSxFQUFFLGNBQWMsQ0FBQztZQUMxQyxZQUFZLEVBQUUsQ0FBQyxjQUFjLEVBQUUsY0FBYyxDQUFDO1lBQzlDLGFBQWEsRUFBRSxDQUFDLFNBQVMsRUFBRSxZQUFZLENBQUM7U0FDekMsQ0FBQztRQUVGLE9BQU8sZ0JBQWdCLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxDQUFDO0lBQzNDLENBQUM7Q0FDRjtBQXZNRCxrREF1TUM7QUFFRCwrRUFBK0U7QUFDL0UsT0FBTztBQUNQLCtFQUErRTtBQUUvRTs7R0FFRztBQUNILFNBQWdCLHlCQUF5QixDQUFDLE1BQTZCO0lBQ3JFLE9BQU8sSUFBSSxtQkFBbUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUN6QyxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFnQix3QkFBd0IsQ0FDdEMsWUFBZ0MsRUFDaEMsTUFBNkI7SUFFN0IsTUFBTSxJQUFJLEdBQUcsSUFBSSxtQkFBbUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUM3QyxPQUFPLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUNoRCxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFnQiwyQkFBMkIsQ0FDekMsU0FBaUIsRUFDakIsWUFBZ0MsRUFDaEMsTUFBNkI7SUFFN0IsTUFBTSxJQUFJLEdBQUcsSUFBSSxtQkFBbUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUM3QyxPQUFPLElBQUksQ0FBQywyQkFBMkIsQ0FBQyxTQUFTLEVBQUUsWUFBWSxDQUFDLENBQUM7QUFDbkUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogU2tpbGwgQ2FwYWJpbGl0eSBWaWV3IC0gU2tpbGwg6IO95Yqb6KeG5Zu+XG4gKiBcbiAqIOiBjOi0o++8mlxuICogMS4g5oqK5bey5Yqg6L29IHNraWxsIOeahCBjYXBhYmlsaXR5IOaxh+aAu+aIkOe7n+S4gOinhuWbvlxuICogMi4g57uZIHBsYW5uZXIgLyByZXBvX3JlYWRlciAvIGNvZGVfcmV2aWV3ZXIgLyByZWxlYXNlX2FnZW50IOetieinkuiJsui/lOWbnuS4jeWQjOeykuW6pueahOaRmOimgVxuICogMy4g5bCGIHNraWxsIOaPkOS+m+eahCB0b29scyAvIE1DUCBkZXBlbmRlbmNpZXMgLyBjb2RlX2ludGVsIGNhcGFiaWxpdGllcyAvIHZlcmlmaWNhdGlvbiBhYmlsaXRpZXMg5YGa57uf5LiA5b2S57qzXG4gKiBcbiAqIEB2ZXJzaW9uIHYwLjEuMFxuICogQGRhdGUgMjAyNi0wNC0wM1xuICovXG5cbmltcG9ydCB0eXBlIHtcbiAgU2tpbGxSdW50aW1lVmlldyxcbiAgU2tpbGxDYXBhYmlsaXR5U3VtbWFyeSxcbiAgU2tpbGxDYXBhYmlsaXR5VHlwZSxcbiAgQWdlbnRDYXBhYmlsaXR5U3VtbWFyeSxcbn0gZnJvbSAnLi90eXBlcyc7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOexu+Wei+WumuS5iVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIOiDveWKm+inhuWbvumFjee9rlxuICovXG5leHBvcnQgaW50ZXJmYWNlIENhcGFiaWxpdHlWaWV3Q29uZmlnIHtcbiAgLyoqIOaYr+WQpuWMheWQq+W3peWFt+ivpuaDhSAqL1xuICBpbmNsdWRlVG9vbERldGFpbHM/OiBib29sZWFuO1xuICBcbiAgLyoqIOaYr+WQpuWMheWQqyBNQ1Ag5L6d6LWWICovXG4gIGluY2x1ZGVNY3BEZXBlbmRlbmNpZXM/OiBib29sZWFuO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBTa2lsbCDog73lipvop4blm75cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGNsYXNzIFNraWxsQ2FwYWJpbGl0eVZpZXcge1xuICBwcml2YXRlIGNvbmZpZzogUmVxdWlyZWQ8Q2FwYWJpbGl0eVZpZXdDb25maWc+O1xuICBcbiAgY29uc3RydWN0b3IoY29uZmlnOiBDYXBhYmlsaXR5Vmlld0NvbmZpZyA9IHt9KSB7XG4gICAgdGhpcy5jb25maWcgPSB7XG4gICAgICBpbmNsdWRlVG9vbERldGFpbHM6IGNvbmZpZy5pbmNsdWRlVG9vbERldGFpbHMgPz8gZmFsc2UsXG4gICAgICBpbmNsdWRlTWNwRGVwZW5kZW5jaWVzOiBjb25maWcuaW5jbHVkZU1jcERlcGVuZGVuY2llcyA/PyB0cnVlLFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmnoTlu7rog73lipvop4blm75cbiAgICovXG4gIGJ1aWxkQ2FwYWJpbGl0eVZpZXcoXG4gICAgbG9hZGVkU2tpbGxzOiBTa2lsbFJ1bnRpbWVWaWV3W11cbiAgKToge1xuICAgIGNhcGFiaWxpdHlUeXBlczogU2tpbGxDYXBhYmlsaXR5VHlwZVtdO1xuICAgIHByb3ZpZGVkVG9vbHM6IHN0cmluZ1tdO1xuICAgIHJlcXVpcmVkTWNwU2VydmVyczogc3RyaW5nW107XG4gICAgY29kZUludGVsSG9va3M6IHN0cmluZ1tdO1xuICAgIHZlcmlmaWNhdGlvbkhvb2tzOiBzdHJpbmdbXTtcbiAgICBhdXRvbWF0aW9uSG9va3M6IHN0cmluZ1tdO1xuICB9IHtcbiAgICBjb25zdCBjYXBhYmlsaXR5VHlwZXMgPSBuZXcgU2V0PFNraWxsQ2FwYWJpbGl0eVR5cGU+KCk7XG4gICAgY29uc3QgcHJvdmlkZWRUb29sczogc3RyaW5nW10gPSBbXTtcbiAgICBjb25zdCByZXF1aXJlZE1jcFNlcnZlcnMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBjb25zdCBjb2RlSW50ZWxIb29rczogc3RyaW5nW10gPSBbXTtcbiAgICBjb25zdCB2ZXJpZmljYXRpb25Ib29rczogc3RyaW5nW10gPSBbXTtcbiAgICBjb25zdCBhdXRvbWF0aW9uSG9va3M6IHN0cmluZ1tdID0gW107XG4gICAgXG4gICAgZm9yIChjb25zdCBza2lsbCBvZiBsb2FkZWRTa2lsbHMpIHtcbiAgICAgIC8vIOaUtumbhuiDveWKm+exu+Wei1xuICAgICAgZm9yIChjb25zdCBjYXBhYmlsaXR5IG9mIHNraWxsLmNhcGFiaWxpdGllcykge1xuICAgICAgICBjYXBhYmlsaXR5VHlwZXMuYWRkKGNhcGFiaWxpdHkgYXMgU2tpbGxDYXBhYmlsaXR5VHlwZSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIOaUtumbhuW3peWFt1xuICAgICAgcHJvdmlkZWRUb29scy5wdXNoKC4uLnNraWxsLnRvb2xzKTtcbiAgICAgIFxuICAgICAgLy8g5pS26ZuGIE1DUCDkvp3otZZcbiAgICAgIGlmICh0aGlzLmNvbmZpZy5pbmNsdWRlTWNwRGVwZW5kZW5jaWVzKSB7XG4gICAgICAgIHJlcXVpcmVkTWNwU2VydmVycy5hZGQoLi4uc2tpbGwubWNwU2VydmVycyk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIOaUtumbhuS7o+eggeaZuuiDvSBob29rc1xuICAgICAgaWYgKHNraWxsLmNhcGFiaWxpdGllcy5pbmNsdWRlcygnY29kZV9pbnRlbCcpKSB7XG4gICAgICAgIGNvZGVJbnRlbEhvb2tzLnB1c2goc2tpbGwuc2tpbGxOYW1lKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8g5pS26ZuG6aqM6K+BIGhvb2tzXG4gICAgICBpZiAoc2tpbGwuY2FwYWJpbGl0aWVzLmluY2x1ZGVzKCd2ZXJpZmljYXRpb24nKSkge1xuICAgICAgICB2ZXJpZmljYXRpb25Ib29rcy5wdXNoKHNraWxsLnNraWxsTmFtZSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIOaUtumbhuiHquWKqOWMliBob29rc1xuICAgICAgaWYgKHNraWxsLmNhcGFiaWxpdGllcy5pbmNsdWRlcygnYXV0b21hdGlvbicpKSB7XG4gICAgICAgIGF1dG9tYXRpb25Ib29rcy5wdXNoKHNraWxsLnNraWxsTmFtZSk7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBjYXBhYmlsaXR5VHlwZXM6IEFycmF5LmZyb20oY2FwYWJpbGl0eVR5cGVzKSxcbiAgICAgIHByb3ZpZGVkVG9vbHMsXG4gICAgICByZXF1aXJlZE1jcFNlcnZlcnM6IEFycmF5LmZyb20ocmVxdWlyZWRNY3BTZXJ2ZXJzKSxcbiAgICAgIGNvZGVJbnRlbEhvb2tzLFxuICAgICAgdmVyaWZpY2F0aW9uSG9va3MsXG4gICAgICBhdXRvbWF0aW9uSG9va3MsXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOaehOW7uiBBZ2VudCDog73lipvmkZjopoFcbiAgICovXG4gIGJ1aWxkQWdlbnRDYXBhYmlsaXR5U3VtbWFyeShcbiAgICBhZ2VudFJvbGU6IHN0cmluZyxcbiAgICBsb2FkZWRTa2lsbHM6IFNraWxsUnVudGltZVZpZXdbXVxuICApOiBBZ2VudENhcGFiaWxpdHlTdW1tYXJ5IHtcbiAgICBjb25zdCBjYXBhYmlsaXR5VmlldyA9IHRoaXMuYnVpbGRDYXBhYmlsaXR5Vmlldyhsb2FkZWRTa2lsbHMpO1xuICAgIFxuICAgIC8vIOaehOW7uuWPr+eUqOiDveWKm+aRmOimgVxuICAgIGNvbnN0IGF2YWlsYWJsZUNhcGFiaWxpdGllczogU2tpbGxDYXBhYmlsaXR5U3VtbWFyeVtdID0gW107XG4gICAgXG4gICAgZm9yIChjb25zdCBjYXBhYmlsaXR5VHlwZSBvZiBjYXBhYmlsaXR5Vmlldy5jYXBhYmlsaXR5VHlwZXMpIHtcbiAgICAgIGNvbnN0IHByb3ZpZGVkQnkgPSBsb2FkZWRTa2lsbHNcbiAgICAgICAgLmZpbHRlcihzID0+IHMuY2FwYWJpbGl0aWVzLmluY2x1ZGVzKGNhcGFiaWxpdHlUeXBlKSlcbiAgICAgICAgLm1hcChzID0+IHMuc2tpbGxOYW1lKTtcbiAgICAgIFxuICAgICAgYXZhaWxhYmxlQ2FwYWJpbGl0aWVzLnB1c2goe1xuICAgICAgICBjYXBhYmlsaXR5VHlwZSxcbiAgICAgICAgcHJvdmlkZWRCeSxcbiAgICAgIH0pO1xuICAgIH1cbiAgICBcbiAgICAvLyDorqHnrpfnvLrlpLHnmoTog73lipvvvIjmoLnmja7op5LoibLvvIlcbiAgICBjb25zdCBtaXNzaW5nQ2FwYWJpbGl0aWVzID0gdGhpcy5maW5kTWlzc2luZ0NhcGFiaWxpdGllcyhhZ2VudFJvbGUsIGNhcGFiaWxpdHlWaWV3KTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgYWdlbnRSb2xlLFxuICAgICAgYXZhaWxhYmxlQ2FwYWJpbGl0aWVzLFxuICAgICAgYXZhaWxhYmxlVG9vbHM6IGNhcGFiaWxpdHlWaWV3LnByb3ZpZGVkVG9vbHMsXG4gICAgICByZXF1aXJlZE1jcFNlcnZlcnM6IGNhcGFiaWxpdHlWaWV3LnJlcXVpcmVkTWNwU2VydmVycyxcbiAgICAgIG1pc3NpbmdDYXBhYmlsaXRpZXMsXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOaMieiDveWKm+exu+Wei+afpeaJviBTa2lsbHNcbiAgICovXG4gIGZpbmRTa2lsbHNCeUNhcGFiaWxpdHkoXG4gICAgbG9hZGVkU2tpbGxzOiBTa2lsbFJ1bnRpbWVWaWV3W10sXG4gICAgY2FwYWJpbGl0eVR5cGU6IFNraWxsQ2FwYWJpbGl0eVR5cGVcbiAgKTogU2tpbGxSdW50aW1lVmlld1tdIHtcbiAgICByZXR1cm4gbG9hZGVkU2tpbGxzLmZpbHRlcihza2lsbCA9PlxuICAgICAgc2tpbGwuY2FwYWJpbGl0aWVzLmluY2x1ZGVzKGNhcGFiaWxpdHlUeXBlKVxuICAgICk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmjInlt6XlhbflkI3np7Dmn6Xmib4gU2tpbGxzXG4gICAqL1xuICBmaW5kU2tpbGxzQnlUb29sKFxuICAgIGxvYWRlZFNraWxsczogU2tpbGxSdW50aW1lVmlld1tdLFxuICAgIHRvb2xOYW1lOiBzdHJpbmdcbiAgKTogU2tpbGxSdW50aW1lVmlld1tdIHtcbiAgICByZXR1cm4gbG9hZGVkU2tpbGxzLmZpbHRlcihza2lsbCA9PlxuICAgICAgc2tpbGwudG9vbHMuaW5jbHVkZXModG9vbE5hbWUpXG4gICAgKTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOafpeaJvumcgOimgeeJueWumiBNQ1AgU2VydmVyIOeahCBTa2lsbHNcbiAgICovXG4gIGZpbmRTa2lsbHNSZXF1aXJpbmdNY3BTZXJ2ZXIoXG4gICAgbG9hZGVkU2tpbGxzOiBTa2lsbFJ1bnRpbWVWaWV3W10sXG4gICAgc2VydmVyTmFtZTogc3RyaW5nXG4gICk6IFNraWxsUnVudGltZVZpZXdbXSB7XG4gICAgcmV0dXJuIGxvYWRlZFNraWxscy5maWx0ZXIoc2tpbGwgPT5cbiAgICAgIHNraWxsLm1jcFNlcnZlcnMuaW5jbHVkZXMoc2VydmVyTmFtZSlcbiAgICApO1xuICB9XG4gIFxuICAvKipcbiAgICog6I635Y+W6IO95Yqb5o+P6L+wXG4gICAqL1xuICBnZXRDYXBhYmlsaXR5RGVzY3JpcHRpb24oY2FwYWJpbGl0eVR5cGU6IFNraWxsQ2FwYWJpbGl0eVR5cGUpOiBzdHJpbmcge1xuICAgIGNvbnN0IGRlc2NyaXB0aW9uczogUmVjb3JkPFNraWxsQ2FwYWJpbGl0eVR5cGUsIHN0cmluZz4gPSB7XG4gICAgICB0b29sX3J1bnRpbWU6ICdSdW50aW1lIHRvb2wgZXhlY3V0aW9uIGNhcGFiaWxpdGllcycsXG4gICAgICBjb2RlX2ludGVsOiAnQ29kZSBpbnRlbGxpZ2VuY2UgYW5kIGFuYWx5c2lzIGNhcGFiaWxpdGllcycsXG4gICAgICBtY3BfaW50ZWdyYXRpb246ICdNQ1Agc2VydmVyIGludGVncmF0aW9uIGNhcGFiaWxpdGllcycsXG4gICAgICB2ZXJpZmljYXRpb246ICdUZXN0aW5nIGFuZCB2ZXJpZmljYXRpb24gY2FwYWJpbGl0aWVzJyxcbiAgICAgIHJlcG9fYW5hbHlzaXM6ICdSZXBvc2l0b3J5IGFuYWx5c2lzIGNhcGFiaWxpdGllcycsXG4gICAgICByZXZpZXc6ICdDb2RlIHJldmlldyBjYXBhYmlsaXRpZXMnLFxuICAgICAgcmVsZWFzZTogJ1JlbGVhc2UgYW5kIGRlcGxveW1lbnQgY2FwYWJpbGl0aWVzJyxcbiAgICAgIGF1dG9tYXRpb246ICdBdXRvbWF0aW9uIGNhcGFiaWxpdGllcycsXG4gICAgfTtcbiAgICBcbiAgICByZXR1cm4gZGVzY3JpcHRpb25zW2NhcGFiaWxpdHlUeXBlXSB8fCAnVW5rbm93biBjYXBhYmlsaXR5JztcbiAgfVxuICBcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAvLyDlhoXpg6jmlrnms5VcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICBcbiAgLyoqXG4gICAqIOafpeaJvue8uuWkseeahOiDveWKm1xuICAgKi9cbiAgcHJpdmF0ZSBmaW5kTWlzc2luZ0NhcGFiaWxpdGllcyhcbiAgICBhZ2VudFJvbGU6IHN0cmluZyxcbiAgICBjYXBhYmlsaXR5VmlldzogUmV0dXJuVHlwZTx0eXBlb2YgU2tpbGxDYXBhYmlsaXR5Vmlldy5wcm90b3R5cGUuYnVpbGRDYXBhYmlsaXR5Vmlldz5cbiAgKTogc3RyaW5nW10ge1xuICAgIGNvbnN0IG1pc3Npbmc6IHN0cmluZ1tdID0gW107XG4gICAgXG4gICAgLy8g5qC55o2u6KeS6Imy5a6a5LmJ5pyf5pyb55qE6IO95YqbXG4gICAgY29uc3QgZXhwZWN0ZWRDYXBhYmlsaXRpZXMgPSB0aGlzLmdldEV4cGVjdGVkQ2FwYWJpbGl0aWVzRm9yUm9sZShhZ2VudFJvbGUpO1xuICAgIFxuICAgIGZvciAoY29uc3QgZXhwZWN0ZWQgb2YgZXhwZWN0ZWRDYXBhYmlsaXRpZXMpIHtcbiAgICAgIGlmICghY2FwYWJpbGl0eVZpZXcuY2FwYWJpbGl0eVR5cGVzLmluY2x1ZGVzKGV4cGVjdGVkKSkge1xuICAgICAgICBtaXNzaW5nLnB1c2goZXhwZWN0ZWQpO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gbWlzc2luZztcbiAgfVxuICBcbiAgLyoqXG4gICAqIOiOt+WPluinkuiJsuacn+acm+eahOiDveWKm1xuICAgKi9cbiAgcHJpdmF0ZSBnZXRFeHBlY3RlZENhcGFiaWxpdGllc0ZvclJvbGUoYWdlbnRSb2xlOiBzdHJpbmcpOiBTa2lsbENhcGFiaWxpdHlUeXBlW10ge1xuICAgIGNvbnN0IHJvbGVDYXBhYmlsaXRpZXM6IFJlY29yZDxzdHJpbmcsIFNraWxsQ2FwYWJpbGl0eVR5cGVbXT4gPSB7XG4gICAgICBwbGFubmVyOiBbJ3JlcG9fYW5hbHlzaXMnLCAnY29kZV9pbnRlbCddLFxuICAgICAgcmVwb19yZWFkZXI6IFsncmVwb19hbmFseXNpcycsICdjb2RlX2ludGVsJ10sXG4gICAgICBjb2RlX3Jldmlld2VyOiBbJ3JldmlldycsICdjb2RlX2ludGVsJ10sXG4gICAgICBjb2RlX2ZpeGVyOiBbJ2NvZGVfaW50ZWwnLCAndG9vbF9ydW50aW1lJ10sXG4gICAgICB2ZXJpZnlfYWdlbnQ6IFsndmVyaWZpY2F0aW9uJywgJ3Rvb2xfcnVudGltZSddLFxuICAgICAgcmVsZWFzZV9hZ2VudDogWydyZWxlYXNlJywgJ2F1dG9tYXRpb24nXSxcbiAgICB9O1xuICAgIFxuICAgIHJldHVybiByb2xlQ2FwYWJpbGl0aWVzW2FnZW50Um9sZV0gfHwgW107XG4gIH1cbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5L6/5o235Ye95pWwXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog5Yib5bu66IO95Yqb6KeG5Zu+XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTa2lsbENhcGFiaWxpdHlWaWV3KGNvbmZpZz86IENhcGFiaWxpdHlWaWV3Q29uZmlnKTogU2tpbGxDYXBhYmlsaXR5VmlldyB7XG4gIHJldHVybiBuZXcgU2tpbGxDYXBhYmlsaXR5Vmlldyhjb25maWcpO1xufVxuXG4vKipcbiAqIOW/q+mAn+aehOW7uuiDveWKm+inhuWbvlxuICovXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRTa2lsbENhcGFiaWxpdHlWaWV3KFxuICBsb2FkZWRTa2lsbHM6IFNraWxsUnVudGltZVZpZXdbXSxcbiAgY29uZmlnPzogQ2FwYWJpbGl0eVZpZXdDb25maWdcbik6IFJldHVyblR5cGU8U2tpbGxDYXBhYmlsaXR5Vmlld1snYnVpbGRDYXBhYmlsaXR5VmlldyddPiB7XG4gIGNvbnN0IHZpZXcgPSBuZXcgU2tpbGxDYXBhYmlsaXR5Vmlldyhjb25maWcpO1xuICByZXR1cm4gdmlldy5idWlsZENhcGFiaWxpdHlWaWV3KGxvYWRlZFNraWxscyk7XG59XG5cbi8qKlxuICog5b+r6YCf5p6E5bu6IEFnZW50IOiDveWKm+aRmOimgVxuICovXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRBZ2VudENhcGFiaWxpdHlTdW1tYXJ5KFxuICBhZ2VudFJvbGU6IHN0cmluZyxcbiAgbG9hZGVkU2tpbGxzOiBTa2lsbFJ1bnRpbWVWaWV3W10sXG4gIGNvbmZpZz86IENhcGFiaWxpdHlWaWV3Q29uZmlnXG4pOiBBZ2VudENhcGFiaWxpdHlTdW1tYXJ5IHtcbiAgY29uc3QgdmlldyA9IG5ldyBTa2lsbENhcGFiaWxpdHlWaWV3KGNvbmZpZyk7XG4gIHJldHVybiB2aWV3LmJ1aWxkQWdlbnRDYXBhYmlsaXR5U3VtbWFyeShhZ2VudFJvbGUsIGxvYWRlZFNraWxscyk7XG59XG4iXX0=