"use strict";
/**
 * Skill Runtime Adapter - Skill 运行时适配器
 *
 * 职责：
 * 1. 把 registry + installer + trust/policy 的结果，转成 runtime 可加载对象
 * 2. 决定哪些 skill 在当前 ExecutionContext / AgentContext 下应被加载
 * 3. 为 agent 构造最小 skill context
 * 4. 把 skill capability 接到 Tool Runtime / MCP / Code Intelligence
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillRuntimeAdapter = void 0;
exports.createSkillRuntimeAdapter = createSkillRuntimeAdapter;
// ============================================================================
// Skill 运行时适配器
// ============================================================================
class SkillRuntimeAdapter {
    constructor(registry, compatChecker, config = {}) {
        this.config = {
            runtimeVersion: config.runtimeVersion ?? '2026.4.0',
            availableAgents: config.availableAgents ?? [],
        };
        this.registry = registry;
        this.compatChecker = compatChecker;
    }
    /**
     * 准备 Skill 运行时
     */
    async prepareSkillRuntime(agentSpec) {
        // 构建加载计划
        const loadPlan = await this.compatChecker.buildAgentSkillLoadPlan(agentSpec);
        const loadedSkills = [];
        const blockedSkills = [];
        const pendingSkills = [];
        // 处理要加载的 skills
        for (const decision of loadPlan.toLoad) {
            const pkg = this.registry.getSkill(decision.skillName);
            if (pkg.found && pkg.package) {
                loadedSkills.push(this.buildRuntimeView(pkg.package));
            }
        }
        // 处理被阻塞的 skills
        for (const decision of loadPlan.toBlock) {
            blockedSkills.push(decision.skillName);
        }
        // 处理等待审批的 skills
        for (const decision of loadPlan.pending) {
            pendingSkills.push(decision.skillName);
        }
        return {
            loadedSkills,
            blockedSkills,
            pendingSkills,
            missingRequiredSkills: loadPlan.missingRequired,
            optionalUnavailableSkills: loadPlan.optionalUnavailable,
        };
    }
    /**
     * 为 Agent 加载 Skills
     */
    async loadSkillsForAgent(agentSpec) {
        const runtimeState = await this.prepareSkillRuntime(agentSpec);
        // 构建能力摘要
        const capabilitySummary = this.buildCapabilitySummary(runtimeState.loadedSkills);
        return {
            loadedSkills: runtimeState.loadedSkills.map(s => s.skillId),
            blockedSkills: runtimeState.blockedSkills,
            pendingSkills: runtimeState.pendingSkills,
            missingRequiredSkills: runtimeState.missingRequiredSkills,
            optionalUnavailableSkills: runtimeState.optionalUnavailableSkills,
            capabilitySummary,
        };
    }
    /**
     * 构建 Skill Context
     */
    buildSkillContext(agentRole, task, loadedSkills) {
        const context = {};
        // 按角色裁剪可见面
        switch (agentRole) {
            case 'planner':
                context.skillOverview = {
                    loadedSkills: loadedSkills.map(s => ({
                        name: s.skillName,
                        capabilities: s.capabilities,
                    })),
                    mcpServers: [...new Set(loadedSkills.flatMap(s => s.mcpServers))],
                };
                break;
            case 'code_reviewer':
                context.codeIntelSkills = loadedSkills.filter(s => s.capabilities.includes('code_intel'));
                break;
            case 'verify_agent':
                context.verificationSkills = loadedSkills.filter(s => s.capabilities.includes('verification'));
                break;
            default:
                context.skills = loadedSkills;
        }
        return context;
    }
    /**
     * 解析被阻塞的 Skills
     */
    resolveBlockedSkills(agentSpec) {
        return this.compatChecker.buildAgentSkillLoadPlan(agentSpec).then(plan => {
            const reasons = {};
            for (const decision of plan.toBlock) {
                reasons[decision.skillName] = decision.reason;
            }
            return {
                blocked: plan.toBlock.map(d => d.skillName),
                reasons,
            };
        });
    }
    // ============================================================================
    // 内部方法
    // ============================================================================
    /**
     * 构建运行时视图
     */
    buildRuntimeView(pkg) {
        return {
            skillId: pkg.id,
            skillName: pkg.manifest.name,
            version: pkg.manifest.version,
            capabilities: pkg.manifest.capabilities.map(c => c.type),
            tools: pkg.manifest.tools.map(t => t.name),
            mcpServers: pkg.manifest.mcpServers || [],
            enabled: pkg.enabled,
            trustLevel: pkg.manifest.trustLevel || 'workspace',
        };
    }
    /**
     * 构建能力摘要
     */
    buildCapabilitySummary(loadedSkills) {
        const summary = {};
        for (const skill of loadedSkills) {
            for (const capability of skill.capabilities) {
                if (!summary[capability]) {
                    summary[capability] = [];
                }
                summary[capability].push(skill.skillName);
            }
        }
        return summary;
    }
}
exports.SkillRuntimeAdapter = SkillRuntimeAdapter;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建运行时适配器
 */
function createSkillRuntimeAdapter(registry, compatChecker, config) {
    return new SkillRuntimeAdapter(registry, compatChecker, config);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2tpbGxfcnVudGltZV9hZGFwdGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3NraWxscy9za2lsbF9ydW50aW1lX2FkYXB0ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7OztHQVdHOzs7QUFxUEgsOERBTUM7QUF6TUQsK0VBQStFO0FBQy9FLGVBQWU7QUFDZiwrRUFBK0U7QUFFL0UsTUFBYSxtQkFBbUI7SUFLOUIsWUFDRSxRQUF1QixFQUN2QixhQUFzQyxFQUN0QyxTQUErQixFQUFFO1FBRWpDLElBQUksQ0FBQyxNQUFNLEdBQUc7WUFDWixjQUFjLEVBQUUsTUFBTSxDQUFDLGNBQWMsSUFBSSxVQUFVO1lBQ25ELGVBQWUsRUFBRSxNQUFNLENBQUMsZUFBZSxJQUFJLEVBQUU7U0FDOUMsQ0FBQztRQUNGLElBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDO1FBQ3pCLElBQUksQ0FBQyxhQUFhLEdBQUcsYUFBYSxDQUFDO0lBQ3JDLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxtQkFBbUIsQ0FDdkIsU0FBeUI7UUFFekIsU0FBUztRQUNULE1BQU0sUUFBUSxHQUFHLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyx1QkFBdUIsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUU3RSxNQUFNLFlBQVksR0FBdUIsRUFBRSxDQUFDO1FBQzVDLE1BQU0sYUFBYSxHQUFhLEVBQUUsQ0FBQztRQUNuQyxNQUFNLGFBQWEsR0FBYSxFQUFFLENBQUM7UUFFbkMsZ0JBQWdCO1FBQ2hCLEtBQUssTUFBTSxRQUFRLElBQUksUUFBUSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ3ZDLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUN2RCxJQUFJLEdBQUcsQ0FBQyxLQUFLLElBQUksR0FBRyxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUM3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O0lBRUQ7O09BRUc7SUFDSyxzQkFBc0IsQ0FDNUIsWUFBZ0M7UUFFaEMsTUFBTSxPQUFPLEdBQTZCLEVBQUUsQ0FBQztRQUU3QyxLQUFLLE1BQU0sS0FBSyxJQUFJLFlBQVksRUFBRSxDQUFDO1lBQ2pDLEtBQUssTUFBTSxVQUFVLElBQUksS0FBSyxDQUFDLFlBQVksRUFBRSxDQUFDO2dCQUM1QyxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUM7b0JBQ3pCLE9BQU8sQ0FBQyxVQUFVLENBQUMsR0FBRyxFQUFFLENBQUM7Z0JBQzNCLENBQUM7Z0JBQ0QsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDNUMsQ0FBQztRQUNILENBQUM7UUFFRCxPQUFPLE9BQU8sQ0FBQztJQUNqQixDQUFDO0NBQ0Y7QUF0TEQsa0RBc0xDO0FBRUQsK0VBQStFO0FBQy9FLE9BQU87QUFDUCwrRUFBK0U7QUFFL0U7O0dBRUc7QUFDSCxTQUFnQix5QkFBeUIsQ0FDdkMsUUFBdUIsRUFDdkIsYUFBc0MsRUFDdEMsTUFBNkI7SUFFN0IsT0FBTyxJQUFJLG1CQUFtQixDQUFDLFFBQVEsRUFBRSxhQUFhLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDbEUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogU2tpbGwgUnVudGltZSBBZGFwdGVyIC0gU2tpbGwg6L+Q6KGM5pe26YCC6YWN5ZmoXG4gKiBcbiAqIOiBjOi0o++8mlxuICogMS4g5oqKIHJlZ2lzdHJ5ICsgaW5zdGFsbGVyICsgdHJ1c3QvcG9saWN5IOeahOe7k+aenO+8jOi9rOaIkCBydW50aW1lIOWPr+WKoOi9veWvueixoVxuICogMi4g5Yaz5a6a5ZOq5LqbIHNraWxsIOWcqOW9k+WJjSBFeGVjdXRpb25Db250ZXh0IC8gQWdlbnRDb250ZXh0IOS4i+W6lOiiq+WKoOi9vVxuICogMy4g5Li6IGFnZW50IOaehOmAoOacgOWwjyBza2lsbCBjb250ZXh0XG4gKiA0LiDmioogc2tpbGwgY2FwYWJpbGl0eSDmjqXliLAgVG9vbCBSdW50aW1lIC8gTUNQIC8gQ29kZSBJbnRlbGxpZ2VuY2VcbiAqIFxuICogQHZlcnNpb24gdjAuMS4wXG4gKiBAZGF0ZSAyMDI2LTA0LTAzXG4gKi9cblxuaW1wb3J0IHR5cGUge1xuICBBZ2VudFNraWxsU3BlYyxcbiAgQWdlbnRTa2lsbENvbnRleHQsXG4gIEFnZW50U2tpbGxMb2FkUGxhbixcbiAgU2tpbGxQYWNrYWdlRGVzY3JpcHRvcixcbiAgU2tpbGxSdW50aW1lVmlldyxcbiAgU2tpbGxDYXBhYmlsaXR5VHlwZSxcbn0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgeyBTa2lsbFJlZ2lzdHJ5IH0gZnJvbSAnLi9za2lsbF9yZWdpc3RyeSc7XG5pbXBvcnQgeyBBZ2VudFNraWxsQ29tcGF0Q2hlY2tlciB9IGZyb20gJy4vYWdlbnRfc2tpbGxfY29tcGF0JztcbmltcG9ydCB7IFNraWxsUG9saWN5RXZhbHVhdG9yIH0gZnJvbSAnLi9za2lsbF9wb2xpY3knO1xuaW1wb3J0IHsgU2tpbGxWYWxpZGF0b3IgfSBmcm9tICcuL3NraWxsX3ZhbGlkYXRpb24nO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDnsbvlnovlrprkuYlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDov5DooYzml7bpgILphY3lmajphY3nva5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBSdW50aW1lQWRhcHRlckNvbmZpZyB7XG4gIC8qKiDov5DooYzml7bniYjmnKwgKi9cbiAgcnVudGltZVZlcnNpb24/OiBzdHJpbmc7XG4gIFxuICAvKiog5Y+v55So55qEIEFnZW50IOWIl+ihqCAqL1xuICBhdmFpbGFibGVBZ2VudHM/OiBzdHJpbmdbXTtcbn1cblxuLyoqXG4gKiDmioDog73ov5DooYzml7bnirbmgIFcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBTa2lsbFJ1bnRpbWVTdGF0ZSB7XG4gIC8qKiDlt7LliqDovb3nmoQgc2tpbGxzICovXG4gIGxvYWRlZFNraWxsczogU2tpbGxSdW50aW1lVmlld1tdO1xuICBcbiAgLyoqIOiiq+mYu+WhnueahCBza2lsbHMgKi9cbiAgYmxvY2tlZFNraWxsczogc3RyaW5nW107XG4gIFxuICAvKiog562J5b6F5a6h5om555qEIHNraWxscyAqL1xuICBwZW5kaW5nU2tpbGxzOiBzdHJpbmdbXTtcbiAgXG4gIC8qKiDnvLrlpLHnmoQgcmVxdWlyZWQgc2tpbGxzICovXG4gIG1pc3NpbmdSZXF1aXJlZFNraWxsczogc3RyaW5nW107XG4gIFxuICAvKiog5LiN5Y+v55So55qEIG9wdGlvbmFsIHNraWxscyAqL1xuICBvcHRpb25hbFVuYXZhaWxhYmxlU2tpbGxzOiBzdHJpbmdbXTtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gU2tpbGwg6L+Q6KGM5pe26YCC6YWN5ZmoXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBjbGFzcyBTa2lsbFJ1bnRpbWVBZGFwdGVyIHtcbiAgcHJpdmF0ZSBjb25maWc6IFJlcXVpcmVkPFJ1bnRpbWVBZGFwdGVyQ29uZmlnPjtcbiAgcHJpdmF0ZSByZWdpc3RyeTogU2tpbGxSZWdpc3RyeTtcbiAgcHJpdmF0ZSBjb21wYXRDaGVja2VyOiBBZ2VudFNraWxsQ29tcGF0Q2hlY2tlcjtcbiAgXG4gIGNvbnN0cnVjdG9yKFxuICAgIHJlZ2lzdHJ5OiBTa2lsbFJlZ2lzdHJ5LFxuICAgIGNvbXBhdENoZWNrZXI6IEFnZW50U2tpbGxDb21wYXRDaGVja2VyLFxuICAgIGNvbmZpZzogUnVudGltZUFkYXB0ZXJDb25maWcgPSB7fVxuICApIHtcbiAgICB0aGlzLmNvbmZpZyA9IHtcbiAgICAgIHJ1bnRpbWVWZXJzaW9uOiBjb25maWcucnVudGltZVZlcnNpb24gPz8gJzIwMjYuNC4wJyxcbiAgICAgIGF2YWlsYWJsZUFnZW50czogY29uZmlnLmF2YWlsYWJsZUFnZW50cyA/PyBbXSxcbiAgICB9O1xuICAgIHRoaXMucmVnaXN0cnkgPSByZWdpc3RyeTtcbiAgICB0aGlzLmNvbXBhdENoZWNrZXIgPSBjb21wYXRDaGVja2VyO1xuICB9XG4gIFxuICAvKipcbiAgICog5YeG5aSHIFNraWxsIOi/kOihjOaXtlxuICAgKi9cbiAgYXN5bmMgcHJlcGFyZVNraWxsUnVudGltZShcbiAgICBhZ2VudFNwZWM6IEFnZW50U2tpbGxTcGVjXG4gICk6IFByb21pc2U8U2tpbGxSdW50aW1lU3RhdGU+IHtcbiAgICAvLyDmnoTlu7rliqDovb3orqHliJJcbiAgICBjb25zdCBsb2FkUGxhbiA9IGF3YWl0IHRoaXMuY29tcGF0Q2hlY2tlci5idWlsZEFnZW50U2tpbGxMb2FkUGxhbihhZ2VudFNwZWMpO1xuICAgIFxuICAgIGNvbnN0IGxvYWRlZFNraWxsczogU2tpbGxSdW50aW1lVmlld1tdID0gW107XG4gICAgY29uc3QgYmxvY2tlZFNraWxsczogc3RyaW5nW10gPSBbXTtcbiAgICBjb25zdCBwZW5kaW5nU2tpbGxzOiBzdHJpbmdbXSA9IFtdO1xuICAgIFxuICAgIC8vIOWkhOeQhuimgeWKoOi9veeahCBza2lsbHNcbiAgICBmb3IgKGNvbnN0IGRlY2lzaW9uIG9mIGxvYWRQbGFuLnRvTG9hZCkge1xuICAgICAgY29uc3QgcGtnID0gdGhpcy5yZWdpc3RyeS5nZXRTa2lsbChkZWNpc2lvbi5za2lsbE5hbWUpO1xuICAgICAgaWYgKHBrZy5mb3VuZCAmJiBwa2cucGFja2FnZSkge1xuICAgICAgICBsb2FkZWRTa2lsbHMucHVzaCh0aGlzLmJ1aWxkUnVudGltZVZpZXcocGtnLnBhY2thZ2UpKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8g5aSE55CG6KKr6Zi75aGe55qEIHNraWxsc1xuICAgIGZvciAoY29uc3QgZGVjaXNpb24gb2YgbG9hZFBsYW4udG9CbG9jaykge1xuICAgICAgYmxvY2tlZFNraWxscy5wdXNoKGRlY2lzaW9uLnNraWxsTmFtZSk7XG4gICAgfVxuICAgIFxuICAgIC8vIOWkhOeQhuetieW+heWuoeaJueeahCBza2lsbHNcbiAgICBmb3IgKGNvbnN0IGRlY2lzaW9uIG9mIGxvYWRQbGFuLnBlbmRpbmcpIHtcbiAgICAgIHBlbmRpbmdTa2lsbHMucHVzaChkZWNpc2lvbi5za2lsbE5hbWUpO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgbG9hZGVkU2tpbGxzLFxuICAgICAgYmxvY2tlZFNraWxscyxcbiAgICAgIHBlbmRpbmdTa2lsbHMsXG4gICAgICBtaXNzaW5nUmVxdWlyZWRTa2lsbHM6IGxvYWRQbGFuLm1pc3NpbmdSZXF1aXJlZCxcbiAgICAgIG9wdGlvbmFsVW5hdmFpbGFibGVTa2lsbHM6IGxvYWRQbGFuLm9wdGlvbmFsVW5hdmFpbGFibGUsXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOS4uiBBZ2VudCDliqDovb0gU2tpbGxzXG4gICAqL1xuICBhc3luYyBsb2FkU2tpbGxzRm9yQWdlbnQoXG4gICAgYWdlbnRTcGVjOiBBZ2VudFNraWxsU3BlY1xuICApOiBQcm9taXNlPEFnZW50U2tpbGxDb250ZXh0PiB7XG4gICAgY29uc3QgcnVudGltZVN0YXRlID0gYXdhaXQgdGhpcy5wcmVwYXJlU2tpbGxSdW50aW1lKGFnZW50U3BlYyk7XG4gICAgXG4gICAgLy8g5p6E5bu66IO95Yqb5pGY6KaBXG4gICAgY29uc3QgY2FwYWJpbGl0eVN1bW1hcnkgPSB0aGlzLmJ1aWxkQ2FwYWJpbGl0eVN1bW1hcnkocnVudGltZVN0YXRlLmxvYWRlZFNraWxscyk7XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIGxvYWRlZFNraWxsczogcnVudGltZVN0YXRlLmxvYWRlZFNraWxscy5tYXAocyA9PiBzLnNraWxsSWQpLFxuICAgICAgYmxvY2tlZFNraWxsczogcnVudGltZVN0YXRlLmJsb2NrZWRTa2lsbHMsXG4gICAgICBwZW5kaW5nU2tpbGxzOiBydW50aW1lU3RhdGUucGVuZGluZ1NraWxscyxcbiAgICAgIG1pc3NpbmdSZXF1aXJlZFNraWxsczogcnVudGltZVN0YXRlLm1pc3NpbmdSZXF1aXJlZFNraWxscyxcbiAgICAgIG9wdGlvbmFsVW5hdmFpbGFibGVTa2lsbHM6IHJ1bnRpbWVTdGF0ZS5vcHRpb25hbFVuYXZhaWxhYmxlU2tpbGxzLFxuICAgICAgY2FwYWJpbGl0eVN1bW1hcnksXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOaehOW7uiBTa2lsbCBDb250ZXh0XG4gICAqL1xuICBidWlsZFNraWxsQ29udGV4dChcbiAgICBhZ2VudFJvbGU6IHN0cmluZyxcbiAgICB0YXNrOiBhbnksXG4gICAgbG9hZGVkU2tpbGxzOiBTa2lsbFJ1bnRpbWVWaWV3W11cbiAgKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICAgIGNvbnN0IGNvbnRleHQ6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge307XG4gICAgXG4gICAgLy8g5oyJ6KeS6Imy6KOB5Ymq5Y+v6KeB6Z2iXG4gICAgc3dpdGNoIChhZ2VudFJvbGUpIHtcbiAgICAgIGNhc2UgJ3BsYW5uZXInOlxuICAgICAgICBjb250ZXh0LnNraWxsT3ZlcnZpZXcgPSB7XG4gICAgICAgICAgbG9hZGVkU2tpbGxzOiBsb2FkZWRTa2lsbHMubWFwKHMgPT4gKHtcbiAgICAgICAgICAgIG5hbWU6IHMuc2tpbGxOYW1lLFxuICAgICAgICAgICAgY2FwYWJpbGl0aWVzOiBzLmNhcGFiaWxpdGllcyxcbiAgICAgICAgICB9KSksXG4gICAgICAgICAgbWNwU2VydmVyczogWy4uLm5ldyBTZXQobG9hZGVkU2tpbGxzLmZsYXRNYXAocyA9PiBzLm1jcFNlcnZlcnMpKV0sXG4gICAgICAgIH07XG4gICAgICAgIGJyZWFrO1xuICAgICAgXG4gICAgICBjYXNlICdjb2RlX3Jldmlld2VyJzpcbiAgICAgICAgY29udGV4dC5jb2RlSW50ZWxTa2lsbHMgPSBsb2FkZWRTa2lsbHMuZmlsdGVyKHMgPT5cbiAgICAgICAgICBzLmNhcGFiaWxpdGllcy5pbmNsdWRlcygnY29kZV9pbnRlbCcpXG4gICAgICAgICk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgXG4gICAgICBjYXNlICd2ZXJpZnlfYWdlbnQnOlxuICAgICAgICBjb250ZXh0LnZlcmlmaWNhdGlvblNraWxscyA9IGxvYWRlZFNraWxscy5maWx0ZXIocyA9PlxuICAgICAgICAgIHMuY2FwYWJpbGl0aWVzLmluY2x1ZGVzKCd2ZXJpZmljYXRpb24nKVxuICAgICAgICApO1xuICAgICAgICBicmVhaztcbiAgICAgIFxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgY29udGV4dC5za2lsbHMgPSBsb2FkZWRTa2lsbHM7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBjb250ZXh0O1xuICB9XG4gIFxuICAvKipcbiAgICog6Kej5p6Q6KKr6Zi75aGe55qEIFNraWxsc1xuICAgKi9cbiAgcmVzb2x2ZUJsb2NrZWRTa2lsbHMoXG4gICAgYWdlbnRTcGVjOiBBZ2VudFNraWxsU3BlY1xuICApOiBQcm9taXNlPHtcbiAgICBibG9ja2VkOiBzdHJpbmdbXTtcbiAgICByZWFzb25zOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuICB9PiB7XG4gICAgcmV0dXJuIHRoaXMuY29tcGF0Q2hlY2tlci5idWlsZEFnZW50U2tpbGxMb2FkUGxhbihhZ2VudFNwZWMpLnRoZW4ocGxhbiA9PiB7XG4gICAgICBjb25zdCByZWFzb25zOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgZGVjaXNpb24gb2YgcGxhbi50b0Jsb2NrKSB7XG4gICAgICAgIHJlYXNvbnNbZGVjaXNpb24uc2tpbGxOYW1lXSA9IGRlY2lzaW9uLnJlYXNvbjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgYmxvY2tlZDogcGxhbi50b0Jsb2NrLm1hcChkID0+IGQuc2tpbGxOYW1lKSxcbiAgICAgICAgcmVhc29ucyxcbiAgICAgIH07XG4gICAgfSk7XG4gIH1cbiAgXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgLy8g5YaF6YOo5pa55rOVXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgXG4gIC8qKlxuICAgKiDmnoTlu7rov5DooYzml7bop4blm75cbiAgICovXG4gIHByaXZhdGUgYnVpbGRSdW50aW1lVmlldyhwa2c6IFNraWxsUGFja2FnZURlc2NyaXB0b3IpOiBTa2lsbFJ1bnRpbWVWaWV3IHtcbiAgICByZXR1cm4ge1xuICAgICAgc2tpbGxJZDogcGtnLmlkLFxuICAgICAgc2tpbGxOYW1lOiBwa2cubWFuaWZlc3QubmFtZSxcbiAgICAgIHZlcnNpb246IHBrZy5tYW5pZmVzdC52ZXJzaW9uLFxuICAgICAgY2FwYWJpbGl0aWVzOiBwa2cubWFuaWZlc3QuY2FwYWJpbGl0aWVzLm1hcChjID0+IGMudHlwZSksXG4gICAgICB0b29sczogcGtnLm1hbmlmZXN0LnRvb2xzLm1hcCh0ID0+IHQubmFtZSksXG4gICAgICBtY3BTZXJ2ZXJzOiBwa2cubWFuaWZlc3QubWNwU2VydmVycyB8fCBbXSxcbiAgICAgIGVuYWJsZWQ6IHBrZy5lbmFibGVkLFxuICAgICAgdHJ1c3RMZXZlbDogcGtnLm1hbmlmZXN0LnRydXN0TGV2ZWwgfHwgJ3dvcmtzcGFjZScsXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOaehOW7uuiDveWKm+aRmOimgVxuICAgKi9cbiAgcHJpdmF0ZSBidWlsZENhcGFiaWxpdHlTdW1tYXJ5KFxuICAgIGxvYWRlZFNraWxsczogU2tpbGxSdW50aW1lVmlld1tdXG4gICk6IFJlY29yZDxzdHJpbmcsIHN0cmluZ1tdPiB7XG4gICAgY29uc3Qgc3VtbWFyeTogUmVjb3JkPHN0cmluZywgc3RyaW5nW10+ID0ge307XG4gICAgXG4gICAgZm9yIChjb25zdCBza2lsbCBvZiBsb2FkZWRTa2lsbHMpIHtcbiAgICAgIGZvciAoY29uc3QgY2FwYWJpbGl0eSBvZiBza2lsbC5jYXBhYmlsaXRpZXMpIHtcbiAgICAgICAgaWYgKCFzdW1tYXJ5W2NhcGFiaWxpdHldKSB7XG4gICAgICAgICAgc3VtbWFyeVtjYXBhYmlsaXR5XSA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIHN1bW1hcnlbY2FwYWJpbGl0eV0ucHVzaChza2lsbC5za2lsbE5hbWUpO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gc3VtbWFyeTtcbiAgfVxufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDkvr/mjbflh73mlbBcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDliJvlu7rov5DooYzml7bpgILphY3lmahcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVNraWxsUnVudGltZUFkYXB0ZXIoXG4gIHJlZ2lzdHJ5OiBTa2lsbFJlZ2lzdHJ5LFxuICBjb21wYXRDaGVja2VyOiBBZ2VudFNraWxsQ29tcGF0Q2hlY2tlcixcbiAgY29uZmlnPzogUnVudGltZUFkYXB0ZXJDb25maWdcbik6IFNraWxsUnVudGltZUFkYXB0ZXIge1xuICByZXR1cm4gbmV3IFNraWxsUnVudGltZUFkYXB0ZXIocmVnaXN0cnksIGNvbXBhdENoZWNrZXIsIGNvbmZpZyk7XG59XG4iXX0=