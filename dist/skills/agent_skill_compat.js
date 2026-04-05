"use strict";
/**
 * Agent Skill Compatibility - Agent Skill 兼容性
 *
 * 职责：
 * 1. 扩展 AgentSpec 的 skill 依赖表达
 * 2. 解析 requiredSkills / optionalSkills
 * 3. 判断某 agent 与某 skill 是否兼容
 * 4. 结合 4C 的 trust/validation/policy 决策，给出最终"能否加载到该 agent"
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentSkillCompatChecker = void 0;
exports.createAgentSkillCompatChecker = createAgentSkillCompatChecker;
const skill_policy_1 = require("./skill_policy");
// ============================================================================
// Agent Skill 兼容性检查器
// ============================================================================
class AgentSkillCompatChecker {
    constructor(registry, policyEvaluator, validator, config = {}) {
        this.config = {
            runtimeVersion: config.runtimeVersion ?? '2026.4.0',
            availableAgents: config.availableAgents ?? [],
        };
        this.registry = registry;
        this.policyEvaluator = policyEvaluator;
        this.validator = validator;
    }
    /**
     * 解析 Agent Skill 需求
     */
    resolveAgentSkillRequirements(agentSpec) {
        return {
            required: agentSpec.requiredSkills || [],
            optional: agentSpec.optionalSkills || [],
            denied: agentSpec.deniedSkills || [],
        };
    }
    /**
     * 检查 Skill 兼容性
     */
    checkSkillCompatibility(agentSpec, skillPkg) {
        const skillName = skillPkg.manifest.name;
        // 检查是否在拒绝列表中
        if (agentSpec.deniedSkills?.includes(skillName)) {
            return {
                compatible: false,
                reason: `Skill ${skillName} is explicitly denied by agent spec`,
                incompatibilityType: 'denied',
            };
        }
        // 检查兼容性
        const compatibility = skillPkg.manifest.compatibility;
        if (compatibility) {
            // 检查不兼容的 Agent
            if (compatibility.incompatibleAgents) {
                // 简化实现：实际应该检查当前 agent
            }
            // 检查必需的 Agent
            if (compatibility.requiredAgents && compatibility.requiredAgents.length > 0) {
                // 简化实现：实际应该检查当前 agent 是否在必需列表中
            }
        }
        // 检查策略
        const policyDecision = (0, skill_policy_1.evaluateLoadPolicy)(skillPkg, { id: 'current_agent' } // 简化实现
        );
        if (policyDecision.effect === 'deny') {
            return {
                compatible: false,
                reason: policyDecision.reason,
                incompatibilityType: 'policy_block',
            };
        }
        return {
            compatible: true,
        };
    }
    /**
     * 构建 Agent Skill 加载计划
     */
    async buildAgentSkillLoadPlan(agentSpec) {
        const toLoad = [];
        const toSkip = [];
        const toBlock = [];
        const pending = [];
        const missingRequired = [];
        const optionalUnavailable = [];
        const { required, optional, denied } = this.resolveAgentSkillRequirements(agentSpec);
        // 处理 required skills
        for (const req of required) {
            const queryResult = this.registry.getSkill(req.name, req.versionRange);
            if (!queryResult.found || !queryResult.package) {
                missingRequired.push(req.name);
                continue;
            }
            const pkg = queryResult.package;
            const decision = await this.evaluateSkillLoadDecision(pkg, agentSpec);
            switch (decision.effect) {
                case 'load':
                    toLoad.push(decision);
                    break;
                case 'block':
                    toBlock.push(decision);
                    missingRequired.push(req.name);
                    break;
                case 'pending':
                    pending.push(decision);
                    break;
                case 'skip':
                    toSkip.push(decision);
                    missingRequired.push(req.name);
                    break;
            }
        }
        // 处理 optional skills
        for (const opt of optional) {
            const queryResult = this.registry.getSkill(opt.name, opt.versionRange);
            if (!queryResult.found || !queryResult.package) {
                optionalUnavailable.push(opt.name);
                continue;
            }
            const pkg = queryResult.package;
            const decision = await this.evaluateSkillLoadDecision(pkg, agentSpec);
            switch (decision.effect) {
                case 'load':
                    toLoad.push(decision);
                    break;
                case 'block':
                    toBlock.push(decision);
                    break;
                case 'pending':
                    pending.push(decision);
                    break;
                case 'skip':
                    toSkip.push(decision);
                    break;
            }
        }
        return {
            toLoad,
            toSkip,
            toBlock,
            pending,
            missingRequired,
            optionalUnavailable,
        };
    }
    /**
     * 评估 Skill 加载决策
     */
    async evaluateSkillLoadDecision(pkg, agentSpec) {
        const skillName = pkg.manifest.name;
        // 检查是否在拒绝列表中
        if (agentSpec.deniedSkills?.includes(skillName)) {
            return {
                skillName,
                effect: 'block',
                reason: `Skill ${skillName} is denied by agent spec`,
                trustLevel: pkg.manifest.trustLevel,
            };
        }
        // 验证 skill
        const validation = await this.validator.validateSkillPackage(pkg);
        if (!validation.valid) {
            return {
                skillName,
                effect: 'block',
                reason: `Skill validation failed: ${validation.errors.join('; ')}`,
                trustLevel: pkg.manifest.trustLevel,
            };
        }
        // 检查兼容性
        const compat = this.checkSkillCompatibility(agentSpec, pkg);
        if (!compat.compatible) {
            return {
                skillName,
                effect: 'block',
                reason: compat.reason || 'Incompatible',
                trustLevel: pkg.manifest.trustLevel,
                incompatibilityType: compat.incompatibilityType,
            };
        }
        // 评估策略
        const policyDecision = (0, skill_policy_1.evaluateLoadPolicy)(pkg, { id: 'current_agent' });
        switch (policyDecision.effect) {
            case 'allow':
                return {
                    skillName,
                    effect: 'load',
                    reason: policyDecision.reason,
                    trustLevel: pkg.manifest.trustLevel,
                    requiresApproval: false,
                };
            case 'ask':
                return {
                    skillName,
                    effect: 'pending',
                    reason: policyDecision.reason,
                    trustLevel: pkg.manifest.trustLevel,
                    requiresApproval: true,
                };
            case 'deny':
                return {
                    skillName,
                    effect: 'block',
                    reason: policyDecision.reason,
                    trustLevel: pkg.manifest.trustLevel,
                };
            default:
                return {
                    skillName,
                    effect: 'skip',
                    reason: 'Unknown policy decision',
                    trustLevel: pkg.manifest.trustLevel,
                };
        }
    }
}
exports.AgentSkillCompatChecker = AgentSkillCompatChecker;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建兼容性检查器
 */
function createAgentSkillCompatChecker(registry, policyEvaluator, validator, config) {
    return new AgentSkillCompatChecker(registry, policyEvaluator, validator, config);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWdlbnRfc2tpbGxfY29tcGF0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3NraWxscy9hZ2VudF9za2lsbF9jb21wYXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7OztHQVdHOzs7QUEwVEgsc0VBT0M7QUF0VEQsaURBQTBFO0FBZ0MxRSwrRUFBK0U7QUFDL0UscUJBQXFCO0FBQ3JCLCtFQUErRTtBQUUvRSxNQUFhLHVCQUF1QjtJQU1sQyxZQUNFLFFBQXVCLEVBQ3ZCLGVBQXFDLEVBQ3JDLFNBQXlCLEVBQ3pCLFNBQXVCLEVBQUU7UUFFekIsSUFBSSxDQUFDLE1BQU0sR0FBRztZQUNaLGNBQWMsRUFBRSxNQUFNLENBQUMsY0FBYyxJQUFJLFVBQVU7WUFDbkQsZUFBZSxFQUFFLE1BQU0sQ0FBQyxlQUFlLElBQUksRUFBRTtTQUM5QyxDQUFDO1FBQ0YsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7UUFDekIsSUFBSSxDQUFDLGVBQWUsR0FBRyxlQUFlLENBQUM7UUFDdkMsSUFBSSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7SUFDN0IsQ0FBQztJQUVEOztPQUVHO0lBQ0gsNkJBQTZCLENBQzNCLFNBQXlCO1FBTXpCLE9BQU87WUFDTCxRQUFRLEVBQUUsU0FBUyxDQUFDLGNBQWMsSUFBSSxFQUFFO1lBQ3hDLFFBQVEsRUFBRSxTQUFTLENBQUMsY0FBYyxJQUFJLEVBQUU7WUFDeEMsTUFBTSxFQUFFLFNBQVMsQ0FBQyxZQUFZLElBQUksRUFBRTtTQUNyQyxDQUFDO0lBQ0osQ0FBQztJQUVEOztPQUVHO0lBQ0gsdUJBQXVCLENBQ3JCLFNBQXlCLEVBQ3pCLFFBQWdDO1FBRWhDLE1BQU0sU0FBUyxHQUFHLFFBQVEsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDO1FBRXpDLGFBQWE7UUFDYixJQUFJLFNBQVMsQ0FBQyxZQUFZLEVBQUUsUUFBUSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUM7WUFDaEQs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SUFBSSx1QkFBdUIsQ0FBQyxRQUFRLEVBQUUsZUFBZSxFQUFFLFNBQVMsRUFBRSxNQUFNLENBQUMsQ0FBQztBQUNuRixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBBZ2VudCBTa2lsbCBDb21wYXRpYmlsaXR5IC0gQWdlbnQgU2tpbGwg5YW85a655oCnXG4gKiBcbiAqIOiBjOi0o++8mlxuICogMS4g5omp5bGVIEFnZW50U3BlYyDnmoQgc2tpbGwg5L6d6LWW6KGo6L6+XG4gKiAyLiDop6PmnpAgcmVxdWlyZWRTa2lsbHMgLyBvcHRpb25hbFNraWxsc1xuICogMy4g5Yik5pat5p+QIGFnZW50IOS4juafkCBza2lsbCDmmK/lkKblhbzlrrlcbiAqIDQuIOe7k+WQiCA0QyDnmoQgdHJ1c3QvdmFsaWRhdGlvbi9wb2xpY3kg5Yaz562W77yM57uZ5Ye65pyA57uIXCLog73lkKbliqDovb3liLDor6UgYWdlbnRcIlxuICogXG4gKiBAdmVyc2lvbiB2MC4xLjBcbiAqIEBkYXRlIDIwMjYtMDQtMDNcbiAqL1xuXG5pbXBvcnQgdHlwZSB7XG4gIEFnZW50U2tpbGxSZXF1aXJlbWVudCxcbiAgQWdlbnRTa2lsbFNwZWMsXG4gIEFnZW50U2tpbGxMb2FkUGxhbixcbiAgU2tpbGxMb2FkRGVjaXNpb24sXG4gIFNraWxsUGFja2FnZURlc2NyaXB0b3IsXG4gIFNraWxsUG9saWN5RGVjaXNpb24sXG59IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgU2tpbGxSZWdpc3RyeSB9IGZyb20gJy4vc2tpbGxfcmVnaXN0cnknO1xuaW1wb3J0IHsgU2tpbGxQb2xpY3lFdmFsdWF0b3IsIGV2YWx1YXRlTG9hZFBvbGljeSB9IGZyb20gJy4vc2tpbGxfcG9saWN5JztcbmltcG9ydCB7IFNraWxsVmFsaWRhdG9yIH0gZnJvbSAnLi9za2lsbF92YWxpZGF0aW9uJztcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g57G75Z6L5a6a5LmJXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog5YW85a655oCn5qOA5p+l6YWN572uXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQ29tcGF0Q29uZmlnIHtcbiAgLyoqIOi/kOihjOaXtueJiOacrCAqL1xuICBydW50aW1lVmVyc2lvbj86IHN0cmluZztcbiAgXG4gIC8qKiDlj6/nlKjnmoQgQWdlbnQg5YiX6KGoICovXG4gIGF2YWlsYWJsZUFnZW50cz86IHN0cmluZ1tdO1xufVxuXG4vKipcbiAqIOWFvOWuueaAp+ajgOafpee7k+aenFxuICovXG5leHBvcnQgaW50ZXJmYWNlIENvbXBhdENoZWNrUmVzdWx0IHtcbiAgLyoqIOaYr+WQpuWFvOWuuSAqL1xuICBjb21wYXRpYmxlOiBib29sZWFuO1xuICBcbiAgLyoqIOWOn+WboCAqL1xuICByZWFzb24/OiBzdHJpbmc7XG4gIFxuICAvKiog5LiN5YW85a6557G75Z6LICovXG4gIGluY29tcGF0aWJpbGl0eVR5cGU/OiAnbWlzc2luZycgfCAnZGVuaWVkJyB8ICdpbmNvbXBhdGlibGUnIHwgJ3BvbGljeV9ibG9jayc7XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIEFnZW50IFNraWxsIOWFvOWuueaAp+ajgOafpeWZqFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgY2xhc3MgQWdlbnRTa2lsbENvbXBhdENoZWNrZXIge1xuICBwcml2YXRlIGNvbmZpZzogUmVxdWlyZWQ8Q29tcGF0Q29uZmlnPjtcbiAgcHJpdmF0ZSByZWdpc3RyeTogU2tpbGxSZWdpc3RyeTtcbiAgcHJpdmF0ZSBwb2xpY3lFdmFsdWF0b3I6IFNraWxsUG9saWN5RXZhbHVhdG9yO1xuICBwcml2YXRlIHZhbGlkYXRvcjogU2tpbGxWYWxpZGF0b3I7XG4gIFxuICBjb25zdHJ1Y3RvcihcbiAgICByZWdpc3RyeTogU2tpbGxSZWdpc3RyeSxcbiAgICBwb2xpY3lFdmFsdWF0b3I6IFNraWxsUG9saWN5RXZhbHVhdG9yLFxuICAgIHZhbGlkYXRvcjogU2tpbGxWYWxpZGF0b3IsXG4gICAgY29uZmlnOiBDb21wYXRDb25maWcgPSB7fVxuICApIHtcbiAgICB0aGlzLmNvbmZpZyA9IHtcbiAgICAgIHJ1bnRpbWVWZXJzaW9uOiBjb25maWcucnVudGltZVZlcnNpb24gPz8gJzIwMjYuNC4wJyxcbiAgICAgIGF2YWlsYWJsZUFnZW50czogY29uZmlnLmF2YWlsYWJsZUFnZW50cyA/PyBbXSxcbiAgICB9O1xuICAgIHRoaXMucmVnaXN0cnkgPSByZWdpc3RyeTtcbiAgICB0aGlzLnBvbGljeUV2YWx1YXRvciA9IHBvbGljeUV2YWx1YXRvcjtcbiAgICB0aGlzLnZhbGlkYXRvciA9IHZhbGlkYXRvcjtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOino+aekCBBZ2VudCBTa2lsbCDpnIDmsYJcbiAgICovXG4gIHJlc29sdmVBZ2VudFNraWxsUmVxdWlyZW1lbnRzKFxuICAgIGFnZW50U3BlYzogQWdlbnRTa2lsbFNwZWNcbiAgKToge1xuICAgIHJlcXVpcmVkOiBBZ2VudFNraWxsUmVxdWlyZW1lbnRbXTtcbiAgICBvcHRpb25hbDogQWdlbnRTa2lsbFJlcXVpcmVtZW50W107XG4gICAgZGVuaWVkOiBzdHJpbmdbXTtcbiAgfSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHJlcXVpcmVkOiBhZ2VudFNwZWMucmVxdWlyZWRTa2lsbHMgfHwgW10sXG4gICAgICBvcHRpb25hbDogYWdlbnRTcGVjLm9wdGlvbmFsU2tpbGxzIHx8IFtdLFxuICAgICAgZGVuaWVkOiBhZ2VudFNwZWMuZGVuaWVkU2tpbGxzIHx8IFtdLFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmo4Dmn6UgU2tpbGwg5YW85a655oCnXG4gICAqL1xuICBjaGVja1NraWxsQ29tcGF0aWJpbGl0eShcbiAgICBhZ2VudFNwZWM6IEFnZW50U2tpbGxTcGVjLFxuICAgIHNraWxsUGtnOiBTa2lsbFBhY2thZ2VEZXNjcmlwdG9yXG4gICk6IENvbXBhdENoZWNrUmVzdWx0IHtcbiAgICBjb25zdCBza2lsbE5hbWUgPSBza2lsbFBrZy5tYW5pZmVzdC5uYW1lO1xuICAgIFxuICAgIC8vIOajgOafpeaYr+WQpuWcqOaLkue7neWIl+ihqOS4rVxuICAgIGlmIChhZ2VudFNwZWMuZGVuaWVkU2tpbGxzPy5pbmNsdWRlcyhza2lsbE5hbWUpKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBjb21wYXRpYmxlOiBmYWxzZSxcbiAgICAgICAgcmVhc29uOiBgU2tpbGwgJHtza2lsbE5hbWV9IGlzIGV4cGxpY2l0bHkgZGVuaWVkIGJ5IGFnZW50IHNwZWNgLFxuICAgICAgICBpbmNvbXBhdGliaWxpdHlUeXBlOiAnZGVuaWVkJyxcbiAgICAgIH07XG4gICAgfVxuICAgIFxuICAgIC8vIOajgOafpeWFvOWuueaAp1xuICAgIGNvbnN0IGNvbXBhdGliaWxpdHkgPSBza2lsbFBrZy5tYW5pZmVzdC5jb21wYXRpYmlsaXR5O1xuICAgIGlmIChjb21wYXRpYmlsaXR5KSB7XG4gICAgICAvLyDmo4Dmn6XkuI3lhbzlrrnnmoQgQWdlbnRcbiAgICAgIGlmIChjb21wYXRpYmlsaXR5LmluY29tcGF0aWJsZUFnZW50cykge1xuICAgICAgICAvLyDnroDljJblrp7njrDvvJrlrp7pmYXlupTor6Xmo4Dmn6XlvZPliY0gYWdlbnRcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8g5qOA5p+l5b+F6ZyA55qEIEFnZW50XG4gICAgICBpZiAoY29tcGF0aWJpbGl0eS5yZXF1aXJlZEFnZW50cyAmJiBjb21wYXRpYmlsaXR5LnJlcXVpcmVkQWdlbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgLy8g566A5YyW5a6e546w77ya5a6e6ZmF5bqU6K+l5qOA5p+l5b2T5YmNIGFnZW50IOaYr+WQpuWcqOW/hemcgOWIl+ihqOS4rVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyDmo4Dmn6XnrZbnlaVcbiAgICBjb25zdCBwb2xpY3lEZWNpc2lvbiA9IGV2YWx1YXRlTG9hZFBvbGljeShcbiAgICAgIHNraWxsUGtnLFxuICAgICAgeyBpZDogJ2N1cnJlbnRfYWdlbnQnIH0gLy8g566A5YyW5a6e546wXG4gICAgKTtcbiAgICBcbiAgICBpZiAocG9saWN5RGVjaXNpb24uZWZmZWN0ID09PSAnZGVueScpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGNvbXBhdGlibGU6IGZhbHNlLFxuICAgICAgICByZWFzb246IHBvbGljeURlY2lzaW9uLnJlYXNvbixcbiAgICAgICAgaW5jb21wYXRpYmlsaXR5VHlwZTogJ3BvbGljeV9ibG9jaycsXG4gICAgICB9O1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgY29tcGF0aWJsZTogdHJ1ZSxcbiAgICB9O1xuICB9XG4gIFxuICAvKipcbiAgICog5p6E5bu6IEFnZW50IFNraWxsIOWKoOi9veiuoeWIklxuICAgKi9cbiAgYXN5bmMgYnVpbGRBZ2VudFNraWxsTG9hZFBsYW4oXG4gICAgYWdlbnRTcGVjOiBBZ2VudFNraWxsU3BlY1xuICApOiBQcm9taXNlPEFnZW50U2tpbGxMb2FkUGxhbj4ge1xuICAgIGNvbnN0IHRvTG9hZDogU2tpbGxMb2FkRGVjaXNpb25bXSA9IFtdO1xuICAgIGNvbnN0IHRvU2tpcDogU2tpbGxMb2FkRGVjaXNpb25bXSA9IFtdO1xuICAgIGNvbnN0IHRvQmxvY2s6IFNraWxsTG9hZERlY2lzaW9uW10gPSBbXTtcbiAgICBjb25zdCBwZW5kaW5nOiBTa2lsbExvYWREZWNpc2lvbltdID0gW107XG4gICAgY29uc3QgbWlzc2luZ1JlcXVpcmVkOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IG9wdGlvbmFsVW5hdmFpbGFibGU6IHN0cmluZ1tdID0gW107XG4gICAgXG4gICAgY29uc3QgeyByZXF1aXJlZCwgb3B0aW9uYWwsIGRlbmllZCB9ID0gdGhpcy5yZXNvbHZlQWdlbnRTa2lsbFJlcXVpcmVtZW50cyhhZ2VudFNwZWMpO1xuICAgIFxuICAgIC8vIOWkhOeQhiByZXF1aXJlZCBza2lsbHNcbiAgICBmb3IgKGNvbnN0IHJlcSBvZiByZXF1aXJlZCkge1xuICAgICAgY29uc3QgcXVlcnlSZXN1bHQgPSB0aGlzLnJlZ2lzdHJ5LmdldFNraWxsKHJlcS5uYW1lLCByZXEudmVyc2lvblJhbmdlKTtcbiAgICAgIFxuICAgICAgaWYgKCFxdWVyeVJlc3VsdC5mb3VuZCB8fCAhcXVlcnlSZXN1bHQucGFja2FnZSkge1xuICAgICAgICBtaXNzaW5nUmVxdWlyZWQucHVzaChyZXEubmFtZSk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBwa2cgPSBxdWVyeVJlc3VsdC5wYWNrYWdlO1xuICAgICAgY29uc3QgZGVjaXNpb24gPSBhd2FpdCB0aGlzLmV2YWx1YXRlU2tpbGxMb2FkRGVjaXNpb24ocGtnLCBhZ2VudFNwZWMpO1xuICAgICAgXG4gICAgICBzd2l0Y2ggKGRlY2lzaW9uLmVmZmVjdCkge1xuICAgICAgICBjYXNlICdsb2FkJzpcbiAgICAgICAgICB0b0xvYWQucHVzaChkZWNpc2lvbik7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2Jsb2NrJzpcbiAgICAgICAgICB0b0Jsb2NrLnB1c2goZGVjaXNpb24pO1xuICAgICAgICAgIG1pc3NpbmdSZXF1aXJlZC5wdXNoKHJlcS5uYW1lKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAncGVuZGluZyc6XG4gICAgICAgICAgcGVuZGluZy5wdXNoKGRlY2lzaW9uKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnc2tpcCc6XG4gICAgICAgICAgdG9Ta2lwLnB1c2goZGVjaXNpb24pO1xuICAgICAgICAgIG1pc3NpbmdSZXF1aXJlZC5wdXNoKHJlcS5uYW1lKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8g5aSE55CGIG9wdGlvbmFsIHNraWxsc1xuICAgIGZvciAoY29uc3Qgb3B0IG9mIG9wdGlvbmFsKSB7XG4gICAgICBjb25zdCBxdWVyeVJlc3VsdCA9IHRoaXMucmVnaXN0cnkuZ2V0U2tpbGwob3B0Lm5hbWUsIG9wdC52ZXJzaW9uUmFuZ2UpO1xuICAgICAgXG4gICAgICBpZiAoIXF1ZXJ5UmVzdWx0LmZvdW5kIHx8ICFxdWVyeVJlc3VsdC5wYWNrYWdlKSB7XG4gICAgICAgIG9wdGlvbmFsVW5hdmFpbGFibGUucHVzaChvcHQubmFtZSk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBwa2cgPSBxdWVyeVJlc3VsdC5wYWNrYWdlO1xuICAgICAgY29uc3QgZGVjaXNpb24gPSBhd2FpdCB0aGlzLmV2YWx1YXRlU2tpbGxMb2FkRGVjaXNpb24ocGtnLCBhZ2VudFNwZWMpO1xuICAgICAgXG4gICAgICBzd2l0Y2ggKGRlY2lzaW9uLmVmZmVjdCkge1xuICAgICAgICBjYXNlICdsb2FkJzpcbiAgICAgICAgICB0b0xvYWQucHVzaChkZWNpc2lvbik7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2Jsb2NrJzpcbiAgICAgICAgICB0b0Jsb2NrLnB1c2goZGVjaXNpb24pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdwZW5kaW5nJzpcbiAgICAgICAgICBwZW5kaW5nLnB1c2goZGVjaXNpb24pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdza2lwJzpcbiAgICAgICAgICB0b1NraXAucHVzaChkZWNpc2lvbik7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7XG4gICAgICB0b0xvYWQsXG4gICAgICB0b1NraXAsXG4gICAgICB0b0Jsb2NrLFxuICAgICAgcGVuZGluZyxcbiAgICAgIG1pc3NpbmdSZXF1aXJlZCxcbiAgICAgIG9wdGlvbmFsVW5hdmFpbGFibGUsXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOivhOS8sCBTa2lsbCDliqDovb3lhrPnrZZcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgZXZhbHVhdGVTa2lsbExvYWREZWNpc2lvbihcbiAgICBwa2c6IFNraWxsUGFja2FnZURlc2NyaXB0b3IsXG4gICAgYWdlbnRTcGVjOiBBZ2VudFNraWxsU3BlY1xuICApOiBQcm9taXNlPFNraWxsTG9hZERlY2lzaW9uPiB7XG4gICAgY29uc3Qgc2tpbGxOYW1lID0gcGtnLm1hbmlmZXN0Lm5hbWU7XG4gICAgXG4gICAgLy8g5qOA5p+l5piv5ZCm5Zyo5ouS57ud5YiX6KGo5LitXG4gICAgaWYgKGFnZW50U3BlYy5kZW5pZWRTa2lsbHM/LmluY2x1ZGVzKHNraWxsTmFtZSkpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHNraWxsTmFtZSxcbiAgICAgICAgZWZmZWN0OiAnYmxvY2snLFxuICAgICAgICByZWFzb246IGBTa2lsbCAke3NraWxsTmFtZX0gaXMgZGVuaWVkIGJ5IGFnZW50IHNwZWNgLFxuICAgICAgICB0cnVzdExldmVsOiBwa2cubWFuaWZlc3QudHJ1c3RMZXZlbCxcbiAgICAgIH07XG4gICAgfVxuICAgIFxuICAgIC8vIOmqjOivgSBza2lsbFxuICAgIGNvbnN0IHZhbGlkYXRpb24gPSBhd2FpdCB0aGlzLnZhbGlkYXRvci52YWxpZGF0ZVNraWxsUGFja2FnZShwa2cpO1xuICAgIFxuICAgIGlmICghdmFsaWRhdGlvbi52YWxpZCkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc2tpbGxOYW1lLFxuICAgICAgICBlZmZlY3Q6ICdibG9jaycsXG4gICAgICAgIHJlYXNvbjogYFNraWxsIHZhbGlkYXRpb24gZmFpbGVkOiAke3ZhbGlkYXRpb24uZXJyb3JzLmpvaW4oJzsgJyl9YCxcbiAgICAgICAgdHJ1c3RMZXZlbDogcGtnLm1hbmlmZXN0LnRydXN0TGV2ZWwsXG4gICAgICB9O1xuICAgIH1cbiAgICBcbiAgICAvLyDmo4Dmn6XlhbzlrrnmgKdcbiAgICBjb25zdCBjb21wYXQgPSB0aGlzLmNoZWNrU2tpbGxDb21wYXRpYmlsaXR5KGFnZW50U3BlYywgcGtnKTtcbiAgICBcbiAgICBpZiAoIWNvbXBhdC5jb21wYXRpYmxlKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBza2lsbE5hbWUsXG4gICAgICAgIGVmZmVjdDogJ2Jsb2NrJyxcbiAgICAgICAgcmVhc29uOiBjb21wYXQucmVhc29uIHx8ICdJbmNvbXBhdGlibGUnLFxuICAgICAgICB0cnVzdExldmVsOiBwa2cubWFuaWZlc3QudHJ1c3RMZXZlbCxcbiAgICAgICAgaW5jb21wYXRpYmlsaXR5VHlwZTogY29tcGF0LmluY29tcGF0aWJpbGl0eVR5cGUsXG4gICAgICB9O1xuICAgIH1cbiAgICBcbiAgICAvLyDor4TkvLDnrZbnlaVcbiAgICBjb25zdCBwb2xpY3lEZWNpc2lvbjogU2tpbGxQb2xpY3lEZWNpc2lvbiA9IGV2YWx1YXRlTG9hZFBvbGljeShcbiAgICAgIHBrZyxcbiAgICAgIHsgaWQ6ICdjdXJyZW50X2FnZW50JyB9XG4gICAgKTtcbiAgICBcbiAgICBzd2l0Y2ggKHBvbGljeURlY2lzaW9uLmVmZmVjdCkge1xuICAgICAgY2FzZSAnYWxsb3cnOlxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHNraWxsTmFtZSxcbiAgICAgICAgICBlZmZlY3Q6ICdsb2FkJyxcbiAgICAgICAgICByZWFzb246IHBvbGljeURlY2lzaW9uLnJlYXNvbixcbiAgICAgICAgICB0cnVzdExldmVsOiBwa2cubWFuaWZlc3QudHJ1c3RMZXZlbCxcbiAgICAgICAgICByZXF1aXJlc0FwcHJvdmFsOiBmYWxzZSxcbiAgICAgICAgfTtcbiAgICAgIFxuICAgICAgY2FzZSAnYXNrJzpcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBza2lsbE5hbWUsXG4gICAgICAgICAgZWZmZWN0OiAncGVuZGluZycsXG4gICAgICAgICAgcmVhc29uOiBwb2xpY3lEZWNpc2lvbi5yZWFzb24sXG4gICAgICAgICAgdHJ1c3RMZXZlbDogcGtnLm1hbmlmZXN0LnRydXN0TGV2ZWwsXG4gICAgICAgICAgcmVxdWlyZXNBcHByb3ZhbDogdHJ1ZSxcbiAgICAgICAgfTtcbiAgICAgIFxuICAgICAgY2FzZSAnZGVueSc6XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgc2tpbGxOYW1lLFxuICAgICAgICAgIGVmZmVjdDogJ2Jsb2NrJyxcbiAgICAgICAgICByZWFzb246IHBvbGljeURlY2lzaW9uLnJlYXNvbixcbiAgICAgICAgICB0cnVzdExldmVsOiBwa2cubWFuaWZlc3QudHJ1c3RMZXZlbCxcbiAgICAgICAgfTtcbiAgICAgIFxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBza2lsbE5hbWUsXG4gICAgICAgICAgZWZmZWN0OiAnc2tpcCcsXG4gICAgICAgICAgcmVhc29uOiAnVW5rbm93biBwb2xpY3kgZGVjaXNpb24nLFxuICAgICAgICAgIHRydXN0TGV2ZWw6IHBrZy5tYW5pZmVzdC50cnVzdExldmVsLFxuICAgICAgICB9O1xuICAgIH1cbiAgfVxufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDkvr/mjbflh73mlbBcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDliJvlu7rlhbzlrrnmgKfmo4Dmn6XlmahcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUFnZW50U2tpbGxDb21wYXRDaGVja2VyKFxuICByZWdpc3RyeTogU2tpbGxSZWdpc3RyeSxcbiAgcG9saWN5RXZhbHVhdG9yOiBTa2lsbFBvbGljeUV2YWx1YXRvcixcbiAgdmFsaWRhdG9yOiBTa2lsbFZhbGlkYXRvcixcbiAgY29uZmlnPzogQ29tcGF0Q29uZmlnXG4pOiBBZ2VudFNraWxsQ29tcGF0Q2hlY2tlciB7XG4gIHJldHVybiBuZXcgQWdlbnRTa2lsbENvbXBhdENoZWNrZXIocmVnaXN0cnksIHBvbGljeUV2YWx1YXRvciwgdmFsaWRhdG9yLCBjb25maWcpO1xufVxuIl19