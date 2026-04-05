"use strict";
/**
 * Skill Installer - Skill 安装器
 *
 * 职责：
 * 1. install / uninstall
 * 2. enable/disable 初始状态处理
 * 3. 调用 resolver 生成计划
 * 4. 把结果写入 registry 或 install state
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillInstaller = void 0;
exports.createSkillInstaller = createSkillInstaller;
const skill_package_1 = require("./skill_package");
const skill_source_1 = require("./skill_source");
// ============================================================================
// Skill 安装器
// ============================================================================
class SkillInstaller {
    constructor(registry, resolver, config = {}) {
        this.config = {
            allowBuiltinUninstall: config.allowBuiltinUninstall ?? false,
            allowForceUninstall: config.allowForceUninstall ?? false,
        };
        this.registry = registry;
        this.resolver = resolver;
    }
    /**
     * 安装 Skill
     */
    async installSkill(target, options) {
        const installed = [];
        const skipped = [];
        const failed = [];
        const warnings = [];
        try {
            // 解析目标
            let targets;
            if (typeof target === 'string') {
                // 从来源解析
                const sourceResult = (0, skill_source_1.resolveSource)(target);
                if (!sourceResult.success || !sourceResult.source) {
                    return {
                        success: false,
                        installed,
                        skipped,
                        failed,
                        error: sourceResult.error,
                    };
                }
                // 简化实现：从来源提取名称
                const name = extractSkillNameFromSource(target);
                targets = [{ name }];
            }
            else {
                targets = [target];
            }
            // 解析依赖
            const resolution = await this.resolver.resolveDependencies(targets);
            if (!resolution.success) {
                return {
                    success: false,
                    installed,
                    skipped,
                    failed,
                    error: `Dependency resolution failed: ${resolution.missingDependencies.join(', ')}`,
                    warnings: resolution.conflicts.map(c => c.reason),
                };
            }
            // 计算安装计划
            const plan = {
                toInstall: resolution.resolvedPackages,
                toUpdate: [],
                toSkip: [],
                steps: [],
            };
            // 执行安装
            for (const pkg of plan.toInstall) {
                const result = await this.registry.registerSkill(pkg);
                if (result.success) {
                    installed.push(pkg);
                }
                else {
                    failed.push(pkg.id);
                    warnings.push(result.error);
                }
            }
            // 启用技能
            if (options?.enable !== false) {
                for (const pkg of installed) {
                    // 简化实现：实际应该更新启用状态
                }
            }
            return {
                success: failed.length === 0,
                installed,
                skipped,
                failed,
                warnings,
            };
        }
        catch (error) {
            return {
                success: false,
                installed,
                skipped,
                failed,
                error: `Install failed: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }
    /**
     * 卸载 Skill
     */
    async uninstallSkill(name, version, options) {
        // 检查是否存在
        const queryResult = this.registry.getSkill(name, version);
        if (!queryResult.found || !queryResult.package) {
            return {
                success: false,
                packageId: `${name}@${version || 'latest'}`,
                error: `Skill ${name}@${version || 'latest'} not found`,
            };
        }
        const pkg = queryResult.package;
        // 检查是否是 builtin
        if ((0, skill_package_1.isBuiltinSkill)(pkg) && !this.config.allowBuiltinUninstall) {
            return {
                success: false,
                packageId: pkg.id,
                error: `Cannot uninstall builtin skill: ${name}`,
            };
        }
        // 检查是否被其他 skill 依赖
        if (!options?.force && !this.config.allowForceUninstall) {
            const dependents = this.findDependents(name, version);
            if (dependents.length > 0) {
                return {
                    success: false,
                    packageId: pkg.id,
                    error: `Cannot uninstall ${name}: required by ${dependents.join(', ')}`,
                };
            }
        }
        // 执行卸载
        const result = await this.registry.unregisterSkill(name, version);
        return {
            success: result,
            packageId: pkg.id,
        };
    }
    /**
     * 启用 Skill
     */
    async enableSkill(name, version) {
        const queryResult = this.registry.getSkill(name, version);
        if (!queryResult.found || !queryResult.package) {
            return false;
        }
        // 简化实现：实际应该更新启用状态
        return true;
    }
    /**
     * 禁用 Skill
     */
    async disableSkill(name, version) {
        const queryResult = this.registry.getSkill(name, version);
        if (!queryResult.found || !queryResult.package) {
            return false;
        }
        // builtin skill 只能禁用，不能卸载
        if ((0, skill_package_1.isBuiltinSkill)(queryResult.package)) {
            // 简化实现：实际应该更新启用状态
            return true;
        }
        // 简化实现：实际应该更新启用状态
        return true;
    }
    /**
     * 获取安装状态
     */
    getInstallState(name, version) {
        const queryResult = this.registry.getSkill(name, version);
        if (!queryResult.found || !queryResult.package) {
            return null;
        }
        const pkg = queryResult.package;
        return {
            installed: true,
            enabled: pkg.enabled,
            isBuiltin: (0, skill_package_1.isBuiltinSkill)(pkg),
        };
    }
    // ============================================================================
    // 内部方法
    // ============================================================================
    /**
     * 查找依赖方
     */
    findDependents(name, version) {
        const dependents = [];
        // 简化实现：实际应该查询 registry
        return dependents;
    }
}
exports.SkillInstaller = SkillInstaller;
// ============================================================================
// 工具函数
// ============================================================================
/**
 * 从来源提取 Skill 名称
 */
function extractSkillNameFromSource(source) {
    // builtin:./skills/code-analysis → code-analysis
    if (source.startsWith('./')) {
        const parts = source.split('/');
        return parts[parts.length - 1];
    }
    // builtin:code-analysis → code-analysis
    if (source.includes(':')) {
        return source.split(':')[1];
    }
    // 默认返回最后一段
    return source.split('/').pop() || 'unknown';
}
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建 Skill 安装器
 */
function createSkillInstaller(registry, resolver, config) {
    return new SkillInstaller(registry, resolver, config);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2tpbGxfaW5zdGFsbGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3NraWxscy9za2lsbF9pbnN0YWxsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7OztHQVdHOzs7QUFpVEgsb0RBTUM7QUExU0QsbURBQXlGO0FBQ3pGLGlEQUFvRTtBQWtCcEUsK0VBQStFO0FBQy9FLFlBQVk7QUFDWiwrRUFBK0U7QUFFL0UsTUFBYSxjQUFjO0lBS3pCLFlBQ0UsUUFBdUIsRUFDdkIsUUFBdUIsRUFDdkIsU0FBMEIsRUFBRTtRQUU1QixJQUFJLENBQUMsTUFBTSxHQUFHO1lBQ1oscUJBQXFCLEVBQUUsTUFBTSxDQUFDLHFCQUFxQixJQUFJLEtBQUs7WUFDNUQsbUJBQW1CLEVBQUUsTUFBTSxDQUFDLG1CQUFtQixJQUFJLEtBQUs7U0FDekQsQ0FBQztRQUNGLElBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDO1FBQ3pCLElBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDO0lBQzNCLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxZQUFZLENBQ2hCLE1BQW1ELEVBQ25ELE9BQTZCO1FBRTdCLE1BQU0sU0FBUyxHQUE2QixFQUFFLENBQUM7UUFDL0MsTUFBTSxPQUFPLEdBQWEsRUFBRSxDQUFDO1FBQzdCLE1BQU0sTUFBTSxHQUFhLEVBQUUsQ0FBQztRQUM1QixNQUFNLFFBQVEsR0FBYSxFQUFFLENBQUM7UUFFOUIsSUFBSSxDQUFDO1lBQ0gsT0FBTztZQUNQLElBQUksT0FBa0QsQ0FBQztZQUV2RCxJQUFJLE9BQU8sTUFBTSxLQUFLLFFBQVEsRUFBRSxDQUFDO2dCQUMvQixRQUFRO2dCQUNSLE1BQU0sWUFBWSxHQUFHLElBQUEsNEJBQWEsRUFBQyxNQUFNLENBQUMsQ0FBQztnQkFFM0MsSUFBSSxDQUFDLFlBQVksQ0FBQyxPQUFPLElBQUksQ0FBQyxZQUFZLENBQUMsTUFBTSxFQUFFLENBQUM7b0JB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K0U7QUFDL0UsT0FBTztBQUNQLCtFQUErRTtBQUUvRTs7R0FFRztBQUNILFNBQWdCLG9CQUFvQixDQUNsQyxRQUF1QixFQUN2QixRQUF1QixFQUN2QixNQUF3QjtJQUV4QixPQUFPLElBQUksY0FBYyxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDeEQsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogU2tpbGwgSW5zdGFsbGVyIC0gU2tpbGwg5a6J6KOF5ZmoXG4gKiBcbiAqIOiBjOi0o++8mlxuICogMS4gaW5zdGFsbCAvIHVuaW5zdGFsbFxuICogMi4gZW5hYmxlL2Rpc2FibGUg5Yid5aeL54q25oCB5aSE55CGXG4gKiAzLiDosIPnlKggcmVzb2x2ZXIg55Sf5oiQ6K6h5YiSXG4gKiA0LiDmiornu5PmnpzlhpnlhaUgcmVnaXN0cnkg5oiWIGluc3RhbGwgc3RhdGVcbiAqIFxuICogQHZlcnNpb24gdjAuMS4wXG4gKiBAZGF0ZSAyMDI2LTA0LTAzXG4gKi9cblxuaW1wb3J0IHR5cGUge1xuICBTa2lsbFBhY2thZ2VEZXNjcmlwdG9yLFxuICBTa2lsbE1hbmlmZXN0LFxuICBTa2lsbEluc3RhbGxSZXN1bHQsXG4gIFNraWxsSW5zdGFsbE9wdGlvbnMsXG4gIFNraWxsSW5zdGFsbFBsYW4sXG4gIFNraWxsVW5pbnN0YWxsUmVzdWx0LFxuICBTa2lsbFNvdXJjZVR5cGUsXG59IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgU2tpbGxSZWdpc3RyeSB9IGZyb20gJy4vc2tpbGxfcmVnaXN0cnknO1xuaW1wb3J0IHsgU2tpbGxSZXNvbHZlciB9IGZyb20gJy4vc2tpbGxfcmVzb2x2ZXInO1xuaW1wb3J0IHsgYnVpbGRTa2lsbFBhY2thZ2UsIGlzQnVpbHRpblNraWxsLCB1cGRhdGVQYWNrYWdlU3RhdHVzIH0gZnJvbSAnLi9za2lsbF9wYWNrYWdlJztcbmltcG9ydCB7IHJlc29sdmVTb3VyY2UsIGlzQnVpbHRpblNvdXJjZVBhdGggfSBmcm9tICcuL3NraWxsX3NvdXJjZSc7XG5pbXBvcnQgeyBwYXJzZUFuZFZhbGlkYXRlTWFuaWZlc3QgfSBmcm9tICcuL3NraWxsX21hbmlmZXN0JztcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g57G75Z6L5a6a5LmJXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog5a6J6KOF5Zmo6YWN572uXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSW5zdGFsbGVyQ29uZmlnIHtcbiAgLyoqIOaYr+WQpuWFgeiuuOWNuOi9vSBidWlsdGluIHNraWxsICovXG4gIGFsbG93QnVpbHRpblVuaW5zdGFsbD86IGJvb2xlYW47XG4gIFxuICAvKiog5piv5ZCm5by65Yi25Y246L2977yI5Y2z5L2/6KKr5L6d6LWW77yJICovXG4gIGFsbG93Rm9yY2VVbmluc3RhbGw/OiBib29sZWFuO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBTa2lsbCDlronoo4Xlmahcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGNsYXNzIFNraWxsSW5zdGFsbGVyIHtcbiAgcHJpdmF0ZSBjb25maWc6IFJlcXVpcmVkPEluc3RhbGxlckNvbmZpZz47XG4gIHByaXZhdGUgcmVnaXN0cnk6IFNraWxsUmVnaXN0cnk7XG4gIHByaXZhdGUgcmVzb2x2ZXI6IFNraWxsUmVzb2x2ZXI7XG4gIFxuICBjb25zdHJ1Y3RvcihcbiAgICByZWdpc3RyeTogU2tpbGxSZWdpc3RyeSxcbiAgICByZXNvbHZlcjogU2tpbGxSZXNvbHZlcixcbiAgICBjb25maWc6IEluc3RhbGxlckNvbmZpZyA9IHt9XG4gICkge1xuICAgIHRoaXMuY29uZmlnID0ge1xuICAgICAgYWxsb3dCdWlsdGluVW5pbnN0YWxsOiBjb25maWcuYWxsb3dCdWlsdGluVW5pbnN0YWxsID8/IGZhbHNlLFxuICAgICAgYWxsb3dGb3JjZVVuaW5zdGFsbDogY29uZmlnLmFsbG93Rm9yY2VVbmluc3RhbGwgPz8gZmFsc2UsXG4gICAgfTtcbiAgICB0aGlzLnJlZ2lzdHJ5ID0gcmVnaXN0cnk7XG4gICAgdGhpcy5yZXNvbHZlciA9IHJlc29sdmVyO1xuICB9XG4gIFxuICAvKipcbiAgICog5a6J6KOFIFNraWxsXG4gICAqL1xuICBhc3luYyBpbnN0YWxsU2tpbGwoXG4gICAgdGFyZ2V0OiBzdHJpbmcgfCB7IG5hbWU6IHN0cmluZzsgdmVyc2lvbj86IHN0cmluZyB9LFxuICAgIG9wdGlvbnM/OiBTa2lsbEluc3RhbGxPcHRpb25zXG4gICk6IFByb21pc2U8U2tpbGxJbnN0YWxsUmVzdWx0PiB7XG4gICAgY29uc3QgaW5zdGFsbGVkOiBTa2lsbFBhY2thZ2VEZXNjcmlwdG9yW10gPSBbXTtcbiAgICBjb25zdCBza2lwcGVkOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IGZhaWxlZDogc3RyaW5nW10gPSBbXTtcbiAgICBjb25zdCB3YXJuaW5nczogc3RyaW5nW10gPSBbXTtcbiAgICBcbiAgICB0cnkge1xuICAgICAgLy8g6Kej5p6Q55uu5qCHXG4gICAgICBsZXQgdGFyZ2V0czogQXJyYXk8eyBuYW1lOiBzdHJpbmc7IHZlcnNpb24/OiBzdHJpbmcgfT47XG4gICAgICBcbiAgICAgIGlmICh0eXBlb2YgdGFyZ2V0ID09PSAnc3RyaW5nJykge1xuICAgICAgICAvLyDku47mnaXmupDop6PmnpBcbiAgICAgICAgY29uc3Qgc291cmNlUmVzdWx0ID0gcmVzb2x2ZVNvdXJjZSh0YXJnZXQpO1xuICAgICAgICBcbiAgICAgICAgaWYgKCFzb3VyY2VSZXN1bHQuc3VjY2VzcyB8fCAhc291cmNlUmVzdWx0LnNvdXJjZSkge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgIGluc3RhbGxlZCxcbiAgICAgICAgICAgIHNraXBwZWQsXG4gICAgICAgICAgICBmYWlsZWQsXG4gICAgICAgICAgICBlcnJvcjogc291cmNlUmVzdWx0LmVycm9yLFxuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIOeugOWMluWunueOsO+8muS7juadpea6kOaPkOWPluWQjeensFxuICAgICAgICBjb25zdCBuYW1lID0gZXh0cmFjdFNraWxsTmFtZUZyb21Tb3VyY2UodGFyZ2V0KTtcbiAgICAgICAgdGFyZ2V0cyA9IFt7IG5hbWUgfV07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0YXJnZXRzID0gW3RhcmdldF07XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIOino+aekOS+nei1llxuICAgICAgY29uc3QgcmVzb2x1dGlvbiA9IGF3YWl0IHRoaXMucmVzb2x2ZXIucmVzb2x2ZURlcGVuZGVuY2llcyh0YXJnZXRzKTtcbiAgICAgIFxuICAgICAgaWYgKCFyZXNvbHV0aW9uLnN1Y2Nlc3MpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICBpbnN0YWxsZWQsXG4gICAgICAgICAgc2tpcHBlZCxcbiAgICAgICAgICBmYWlsZWQsXG4gICAgICAgICAgZXJyb3I6IGBEZXBlbmRlbmN5IHJlc29sdXRpb24gZmFpbGVkOiAke3Jlc29sdXRpb24ubWlzc2luZ0RlcGVuZGVuY2llcy5qb2luKCcsICcpfWAsXG4gICAgICAgICAgd2FybmluZ3M6IHJlc29sdXRpb24uY29uZmxpY3RzLm1hcChjID0+IGMucmVhc29uKSxcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8g6K6h566X5a6J6KOF6K6h5YiSXG4gICAgICBjb25zdCBwbGFuOiBTa2lsbEluc3RhbGxQbGFuID0ge1xuICAgICAgICB0b0luc3RhbGw6IHJlc29sdXRpb24ucmVzb2x2ZWRQYWNrYWdlcyxcbiAgICAgICAgdG9VcGRhdGU6IFtdLFxuICAgICAgICB0b1NraXA6IFtdLFxuICAgICAgICBzdGVwczogW10sXG4gICAgICB9O1xuICAgICAgXG4gICAgICAvLyDmiafooYzlronoo4VcbiAgICAgIGZvciAoY29uc3QgcGtnIG9mIHBsYW4udG9JbnN0YWxsKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMucmVnaXN0cnkucmVnaXN0ZXJTa2lsbChwa2cpO1xuICAgICAgICBcbiAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAgICAgaW5zdGFsbGVkLnB1c2gocGtnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBmYWlsZWQucHVzaChwa2cuaWQpO1xuICAgICAgICAgIHdhcm5pbmdzLnB1c2gocmVzdWx0LmVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICAvLyDlkK/nlKjmioDog71cbiAgICAgIGlmIChvcHRpb25zPy5lbmFibGUgIT09IGZhbHNlKSB7XG4gICAgICAgIGZvciAoY29uc3QgcGtnIG9mIGluc3RhbGxlZCkge1xuICAgICAgICAgIC8vIOeugOWMluWunueOsO+8muWunumZheW6lOivpeabtOaWsOWQr+eUqOeKtuaAgVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN1Y2Nlc3M6IGZhaWxlZC5sZW5ndGggPT09IDAsXG4gICAgICAgIGluc3RhbGxlZCxcbiAgICAgICAgc2tpcHBlZCxcbiAgICAgICAgZmFpbGVkLFxuICAgICAgICB3YXJuaW5ncyxcbiAgICAgIH07XG4gICAgICBcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIGluc3RhbGxlZCxcbiAgICAgICAgc2tpcHBlZCxcbiAgICAgICAgZmFpbGVkLFxuICAgICAgICBlcnJvcjogYEluc3RhbGwgZmFpbGVkOiAke2Vycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKX1gLFxuICAgICAgfTtcbiAgICB9XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDljbjovb0gU2tpbGxcbiAgICovXG4gIGFzeW5jIHVuaW5zdGFsbFNraWxsKFxuICAgIG5hbWU6IHN0cmluZyxcbiAgICB2ZXJzaW9uPzogc3RyaW5nLFxuICAgIG9wdGlvbnM/OiB7IGZvcmNlPzogYm9vbGVhbiB9XG4gICk6IFByb21pc2U8U2tpbGxVbmluc3RhbGxSZXN1bHQ+IHtcbiAgICAvLyDmo4Dmn6XmmK/lkKblrZjlnKhcbiAgICBjb25zdCBxdWVyeVJlc3VsdCA9IHRoaXMucmVnaXN0cnkuZ2V0U2tpbGwobmFtZSwgdmVyc2lvbik7XG4gICAgXG4gICAgaWYgKCFxdWVyeVJlc3VsdC5mb3VuZCB8fCAhcXVlcnlSZXN1bHQucGFja2FnZSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIHBhY2thZ2VJZDogYCR7bmFtZX1AJHt2ZXJzaW9uIHx8ICdsYXRlc3QnfWAsXG4gICAgICAgIGVycm9yOiBgU2tpbGwgJHtuYW1lfUAke3ZlcnNpb24gfHwgJ2xhdGVzdCd9IG5vdCBmb3VuZGAsXG4gICAgICB9O1xuICAgIH1cbiAgICBcbiAgICBjb25zdCBwa2cgPSBxdWVyeVJlc3VsdC5wYWNrYWdlO1xuICAgIFxuICAgIC8vIOajgOafpeaYr+WQpuaYryBidWlsdGluXG4gICAgaWYgKGlzQnVpbHRpblNraWxsKHBrZykgJiYgIXRoaXMuY29uZmlnLmFsbG93QnVpbHRpblVuaW5zdGFsbCkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIHBhY2thZ2VJZDogcGtnLmlkLFxuICAgICAgICBlcnJvcjogYENhbm5vdCB1bmluc3RhbGwgYnVpbHRpbiBza2lsbDogJHtuYW1lfWAsXG4gICAgICB9O1xuICAgIH1cbiAgICBcbiAgICAvLyDmo4Dmn6XmmK/lkKbooqvlhbbku5Ygc2tpbGwg5L6d6LWWXG4gICAgaWYgKCFvcHRpb25zPy5mb3JjZSAmJiAhdGhpcy5jb25maWcuYWxsb3dGb3JjZVVuaW5zdGFsbCkge1xuICAgICAgY29uc3QgZGVwZW5kZW50cyA9IHRoaXMuZmluZERlcGVuZGVudHMobmFtZSwgdmVyc2lvbik7XG4gICAgICBcbiAgICAgIGlmIChkZXBlbmRlbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICBwYWNrYWdlSWQ6IHBrZy5pZCxcbiAgICAgICAgICBlcnJvcjogYENhbm5vdCB1bmluc3RhbGwgJHtuYW1lfTogcmVxdWlyZWQgYnkgJHtkZXBlbmRlbnRzLmpvaW4oJywgJyl9YCxcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8g5omn6KGM5Y246L29XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5yZWdpc3RyeS51bnJlZ2lzdGVyU2tpbGwobmFtZSwgdmVyc2lvbik7XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IHJlc3VsdCxcbiAgICAgIHBhY2thZ2VJZDogcGtnLmlkLFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDlkK/nlKggU2tpbGxcbiAgICovXG4gIGFzeW5jIGVuYWJsZVNraWxsKG5hbWU6IHN0cmluZywgdmVyc2lvbj86IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIGNvbnN0IHF1ZXJ5UmVzdWx0ID0gdGhpcy5yZWdpc3RyeS5nZXRTa2lsbChuYW1lLCB2ZXJzaW9uKTtcbiAgICBcbiAgICBpZiAoIXF1ZXJ5UmVzdWx0LmZvdW5kIHx8ICFxdWVyeVJlc3VsdC5wYWNrYWdlKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIFxuICAgIC8vIOeugOWMluWunueOsO+8muWunumZheW6lOivpeabtOaWsOWQr+eUqOeKtuaAgVxuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIFxuICAvKipcbiAgICog56aB55SoIFNraWxsXG4gICAqL1xuICBhc3luYyBkaXNhYmxlU2tpbGwobmFtZTogc3RyaW5nLCB2ZXJzaW9uPzogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgY29uc3QgcXVlcnlSZXN1bHQgPSB0aGlzLnJlZ2lzdHJ5LmdldFNraWxsKG5hbWUsIHZlcnNpb24pO1xuICAgIFxuICAgIGlmICghcXVlcnlSZXN1bHQuZm91bmQgfHwgIXF1ZXJ5UmVzdWx0LnBhY2thZ2UpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgXG4gICAgLy8gYnVpbHRpbiBza2lsbCDlj6rog73npoHnlKjvvIzkuI3og73ljbjovb1cbiAgICBpZiAoaXNCdWlsdGluU2tpbGwocXVlcnlSZXN1bHQucGFja2FnZSkpIHtcbiAgICAgIC8vIOeugOWMluWunueOsO+8muWunumZheW6lOivpeabtOaWsOWQr+eUqOeKtuaAgVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIFxuICAgIC8vIOeugOWMluWunueOsO+8muWunumZheW6lOivpeabtOaWsOWQr+eUqOeKtuaAgVxuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIFxuICAvKipcbiAgICog6I635Y+W5a6J6KOF54q25oCBXG4gICAqL1xuICBnZXRJbnN0YWxsU3RhdGUobmFtZTogc3RyaW5nLCB2ZXJzaW9uPzogc3RyaW5nKToge1xuICAgIGluc3RhbGxlZDogYm9vbGVhbjtcbiAgICBlbmFibGVkOiBib29sZWFuO1xuICAgIGlzQnVpbHRpbjogYm9vbGVhbjtcbiAgfSB8IG51bGwge1xuICAgIGNvbnN0IHF1ZXJ5UmVzdWx0ID0gdGhpcy5yZWdpc3RyeS5nZXRTa2lsbChuYW1lLCB2ZXJzaW9uKTtcbiAgICBcbiAgICBpZiAoIXF1ZXJ5UmVzdWx0LmZvdW5kIHx8ICFxdWVyeVJlc3VsdC5wYWNrYWdlKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgcGtnID0gcXVlcnlSZXN1bHQucGFja2FnZTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgaW5zdGFsbGVkOiB0cnVlLFxuICAgICAgZW5hYmxlZDogcGtnLmVuYWJsZWQsXG4gICAgICBpc0J1aWx0aW46IGlzQnVpbHRpblNraWxsKHBrZyksXG4gICAgfTtcbiAgfVxuICBcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAvLyDlhoXpg6jmlrnms5VcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICBcbiAgLyoqXG4gICAqIOafpeaJvuS+nei1luaWuVxuICAgKi9cbiAgcHJpdmF0ZSBmaW5kRGVwZW5kZW50cyhuYW1lOiBzdHJpbmcsIHZlcnNpb24/OiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gICAgY29uc3QgZGVwZW5kZW50czogc3RyaW5nW10gPSBbXTtcbiAgICBcbiAgICAvLyDnroDljJblrp7njrDvvJrlrp7pmYXlupTor6Xmn6Xor6IgcmVnaXN0cnlcbiAgICByZXR1cm4gZGVwZW5kZW50cztcbiAgfVxufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDlt6Xlhbflh73mlbBcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDku47mnaXmupDmj5Dlj5YgU2tpbGwg5ZCN56ewXG4gKi9cbmZ1bmN0aW9uIGV4dHJhY3RTa2lsbE5hbWVGcm9tU291cmNlKHNvdXJjZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgLy8gYnVpbHRpbjouL3NraWxscy9jb2RlLWFuYWx5c2lzIOKGkiBjb2RlLWFuYWx5c2lzXG4gIGlmIChzb3VyY2Uuc3RhcnRzV2l0aCgnLi8nKSkge1xuICAgIGNvbnN0IHBhcnRzID0gc291cmNlLnNwbGl0KCcvJyk7XG4gICAgcmV0dXJuIHBhcnRzW3BhcnRzLmxlbmd0aCAtIDFdO1xuICB9XG4gIFxuICAvLyBidWlsdGluOmNvZGUtYW5hbHlzaXMg4oaSIGNvZGUtYW5hbHlzaXNcbiAgaWYgKHNvdXJjZS5pbmNsdWRlcygnOicpKSB7XG4gICAgcmV0dXJuIHNvdXJjZS5zcGxpdCgnOicpWzFdO1xuICB9XG4gIFxuICAvLyDpu5jorqTov5Tlm57mnIDlkI7kuIDmrrVcbiAgcmV0dXJuIHNvdXJjZS5zcGxpdCgnLycpLnBvcCgpIHx8ICd1bmtub3duJztcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5L6/5o235Ye95pWwXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog5Yib5bu6IFNraWxsIOWuieijheWZqFxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlU2tpbGxJbnN0YWxsZXIoXG4gIHJlZ2lzdHJ5OiBTa2lsbFJlZ2lzdHJ5LFxuICByZXNvbHZlcjogU2tpbGxSZXNvbHZlcixcbiAgY29uZmlnPzogSW5zdGFsbGVyQ29uZmlnXG4pOiBTa2lsbEluc3RhbGxlciB7XG4gIHJldHVybiBuZXcgU2tpbGxJbnN0YWxsZXIocmVnaXN0cnksIHJlc29sdmVyLCBjb25maWcpO1xufVxuIl19