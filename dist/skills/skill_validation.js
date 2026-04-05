"use strict";
/**
 * Skill Validation - Skill 验证
 *
 * 职责：
 * 1. 校验 manifest 完整性
 * 2. 校验 source metadata
 * 3. 校验 checksum / publisher / signature 的预留位
 * 4. 校验 package compatibility
 * 5. 输出结构化 validation result
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillValidator = void 0;
exports.createSkillValidator = createSkillValidator;
exports.validateSkill = validateSkill;
const skill_manifest_1 = require("./skill_manifest");
// ============================================================================
// Skill 验证器
// ============================================================================
class SkillValidator {
    constructor(config = {}) {
        this.config = {
            runtimeVersion: config.runtimeVersion ?? '2026.4.0',
            availableAgents: config.availableAgents ?? [],
            strictMode: config.strictMode ?? false,
        };
    }
    /**
     * 验证 Skill Package
     */
    async validateSkillPackage(pkg) {
        const errors = [];
        const warnings = [];
        const trustSignals = [];
        const compatibilityIssues = [];
        const securityWarnings = [];
        // 1. 验证 manifest
        const manifestValidation = (0, skill_manifest_1.validateManifest)(pkg.manifest);
        if (!manifestValidation.valid) {
            errors.push(...manifestValidation.errors);
        }
        warnings.push(...manifestValidation.warnings);
        // 2. 验证来源
        if (pkg.sourcePath) {
            const sourceValidation = await this.validateSource({
                type: pkg.source,
                location: pkg.sourcePath,
            });
            if (!sourceValidation.valid) {
                errors.push(...sourceValidation.errors);
            }
            trustSignals.push(...sourceValidation.trustSignals);
        }
        // 3. 验证兼容性
        const compatibilityValidation = this.validateCompatibility(pkg);
        compatibilityIssues.push(...compatibilityValidation.issues);
        // 4. 收集安全警告
        securityWarnings.push(...this.collectSecurityWarnings(pkg));
        // 5. 严格模式额外检查
        if (this.config.strictMode) {
            const strictChecks = this.performStrictChecks(pkg);
            errors.push(...strictChecks.errors);
            warnings.push(...strictChecks.warnings);
        }
        return {
            valid: errors.length === 0,
            errors,
            warnings,
            trustSignals,
            compatibilityIssues,
            securityWarnings,
        };
    }
    /**
     * 验证来源
     */
    async validateSource(source) {
        const errors = [];
        const trustSignals = [];
        // 检查来源路径是否存在/可访问
        // 简化实现：实际应该检查文件系统或网络
        // builtin 来源默认可信
        if (source.type === 'builtin') {
            trustSignals.push({
                type: 'builtin',
                value: source.location,
                confidence: 1.0,
            });
        }
        // workspace 来源检查本地路径
        if (source.type === 'workspace') {
            trustSignals.push({
                type: 'workspace_local',
                value: source.location,
                confidence: 0.8,
            });
        }
        // external 来源需要更多验证
        if (source.type === 'external') {
            // 检查是否有校验和
            if (source.checksum) {
                trustSignals.push({
                    type: 'checksum_valid',
                    value: source.checksum,
                    confidence: 0.9,
                });
            }
            else {
                // 没有校验和，警告
                errors.push('External source missing checksum');
            }
            // 检查发布者
            if (source.trustedPublisher) {
                trustSignals.push({
                    type: 'verified_publisher',
                    value: source.trustedPublisher,
                    confidence: 0.85,
                });
            }
        }
        return {
            valid: errors.length === 0,
            errors,
            trustSignals,
        };
    }
    /**
     * 验证兼容性
     */
    validateCompatibility(pkg) {
        const issues = [];
        const compatibility = pkg.manifest.compatibility;
        if (!compatibility) {
            // 没有兼容性声明，警告
            issues.push({
                type: 'version',
                description: 'No compatibility information provided',
                severity: 'low',
                suggestedAction: 'Add compatibility information to manifest',
            });
            return { valid: true, issues };
        }
        // 检查 OpenClaw 版本兼容性
        if (compatibility.minOpenClawVersion) {
            const versionCompare = this.compareVersions(this.config.runtimeVersion, compatibility.minOpenClawVersion);
            if (versionCompare < 0) {
                issues.push({
                    type: 'version',
                    description: `Requires OpenClaw >= ${compatibility.minOpenClawVersion}, current version is ${this.config.runtimeVersion}`,
                    severity: 'high',
                    suggestedAction: 'Upgrade OpenClaw or use a compatible skill version',
                });
            }
        }
        if (compatibility.maxOpenClawVersion) {
            const versionCompare = this.compareVersions(this.config.runtimeVersion, compatibility.maxOpenClawVersion);
            if (versionCompare > 0) {
                issues.push({
                    type: 'version',
                    description: `Requires OpenClaw <= ${compatibility.maxOpenClawVersion}, current version is ${this.config.runtimeVersion}`,
                    severity: 'high',
                    suggestedAction: 'Downgrade OpenClaw or use a compatible skill version',
                });
            }
        }
        // 检查 Agent 兼容性
        if (compatibility.requiredAgents && compatibility.requiredAgents.length > 0) {
            const missingAgents = compatibility.requiredAgents.filter(agent => !this.config.availableAgents.includes(agent));
            if (missingAgents.length > 0) {
                issues.push({
                    type: 'agent',
                    description: `Required agents not available: ${missingAgents.join(', ')}`,
                    severity: 'high',
                    suggestedAction: 'Install required agents or use a different skill',
                });
            }
        }
        // 检查不兼容的 Agent
        if (compatibility.incompatibleAgents) {
            const conflictingAgents = compatibility.incompatibleAgents.filter(agent => this.config.availableAgents.includes(agent));
            if (conflictingAgents.length > 0) {
                issues.push({
                    type: 'agent',
                    description: `Incompatible with available agents: ${conflictingAgents.join(', ')}`,
                    severity: 'medium',
                    suggestedAction: 'Disable conflicting agents',
                });
            }
        }
        return {
            valid: issues.filter(i => i.severity === 'high' || i.severity === 'critical').length === 0,
            issues,
        };
    }
    /**
     * 收集安全警告
     */
    collectSecurityWarnings(pkg) {
        const warnings = [];
        // 检查工具权限
        for (const tool of pkg.manifest.tools) {
            if (tool.riskLevel === 'high') {
                warnings.push({
                    type: 'permission',
                    description: `Tool "${tool.name}" has high risk level`,
                    riskLevel: 'high',
                });
            }
            if (tool.requiresApproval) {
                warnings.push({
                    type: 'permission',
                    description: `Tool "${tool.name}" requires approval`,
                    riskLevel: 'medium',
                });
            }
        }
        // 检查 MCP 依赖
        if (pkg.manifest.mcpServers && pkg.manifest.mcpServers.length > 0) {
            warnings.push({
                type: 'network',
                description: `Skill requires MCP servers: ${pkg.manifest.mcpServers.join(', ')}`,
                riskLevel: 'medium',
            });
        }
        // 检查外部依赖
        for (const dep of pkg.manifest.dependencies) {
            if (dep.name.startsWith('@external/')) {
                warnings.push({
                    type: 'execution',
                    description: `External dependency: ${dep.name}`,
                    riskLevel: 'medium',
                });
            }
        }
        return warnings;
    }
    /**
     * 严格模式检查
     */
    performStrictChecks(pkg) {
        const errors = [];
        const warnings = [];
        // 检查是否有许可证
        if (!pkg.manifest.license) {
            errors.push('Strict mode: Missing license information');
        }
        // 检查是否有作者信息
        if (!pkg.manifest.author) {
            errors.push('Strict mode: Missing author information');
        }
        // 检查是否有描述
        if (!pkg.manifest.description) {
            warnings.push('Strict mode: Missing description');
        }
        // 检查是否有能力声明
        if (pkg.manifest.capabilities.length === 0) {
            warnings.push('Strict mode: No capabilities declared');
        }
        return { errors, warnings };
    }
    /**
     * 构建验证报告
     */
    async buildValidationReport(pkg) {
        const result = await this.validateSkillPackage(pkg);
        return {
            packageId: pkg.id,
            result,
            summary: {
                isValid: result.valid,
                errorCount: result.errors.length,
                warningCount: result.warnings.length,
                compatibilityIssueCount: result.compatibilityIssues.length,
                securityWarningCount: result.securityWarnings.length,
            },
        };
    }
    // ============================================================================
    // 内部方法
    // ============================================================================
    /**
     * 比较版本号
     */
    compareVersions(v1, v2) {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);
        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const p1 = parts1[i] || 0;
            const p2 = parts2[i] || 0;
            if (p1 > p2)
                return 1;
            if (p1 < p2)
                return -1;
        }
        return 0;
    }
}
exports.SkillValidator = SkillValidator;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建 Skill 验证器
 */
function createSkillValidator(config) {
    return new SkillValidator(config);
}
/**
 * 快速验证 Skill
 */
async function validateSkill(pkg, config) {
    const validator = new SkillValidator(config);
    return await validator.validateSkillPackage(pkg);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2tpbGxfdmFsaWRhdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9za2lsbHMvc2tpbGxfdmFsaWRhdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7OztHQVlHOzs7QUE2WUgsb0RBRUM7QUFLRCxzQ0FNQztBQWhaRCxxREFBb0Q7QUFvQnBELCtFQUErRTtBQUMvRSxZQUFZO0FBQ1osK0VBQStFO0FBRS9FLE1BQWEsY0FBYztJQUd6QixZQUFZLFNBQTBCLEVBQUU7UUFDdEMsSUFBSSxDQUFDLE1BQU0sR0FBRztZQUNaLGNBQWMsRUFBRSxNQUFNLENBQUMsY0FBYyxJQUFJLFVBQVU7WUFDbkQsZUFBZSxFQUFFLE1BQU0sQ0FBQyxlQUFlLElBQUksRUFBRTtZQUM3QyxVQUFVLEVBQUUsTUFBTSxDQUFDLFVBQVUsSUFBSSxLQUFLO1NBQ3ZDLENBQUM7SUFDSixDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsb0JBQW9CLENBQUMsR0FBMkI7UUFDcEQsTUFBTSxNQUFNLEdBQWEsRUFBRSxDQUFDO1FBQzVCLE1BQU0sUUFBUSxHQUFhLEVBQUUsQ0FBQztRQUM5QixNQUFNLFlBQVksR0FBdUIsRUFBRSxDQUFDO1FBQzVDLE1BQU0sbUJBQW1CLEdBQThCLEVBQUUsQ0FBQztRQUMxRCxNQUFNLGdCQUFnQixHQUEyQixFQUFFLENBQUM7UUFFcEQsaUJBQWlCO1FBQ2pCLE1BQU0sa0JBQWtCLEdBQUcsSUFBQSxpQ0FBZ0IsRUFBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7UUFFMUQsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEtBQUssRUFBRSxDQUFDO1lBQzlCLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUM1QyxDQUFDO1FBRUQsUUFBUSxDQUFDLElBQUksQ0FBQyxHQUFHLGtCQUFrQixDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBRTlDLFVBQVU7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QUM7SUFDN0MsT0FBTyxNQUFNLFNBQVMsQ0FBQyxvQkFBb0IsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUNuRCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBTa2lsbCBWYWxpZGF0aW9uIC0gU2tpbGwg6aqM6K+BXG4gKiBcbiAqIOiBjOi0o++8mlxuICogMS4g5qCh6aqMIG1hbmlmZXN0IOWujOaVtOaAp1xuICogMi4g5qCh6aqMIHNvdXJjZSBtZXRhZGF0YVxuICogMy4g5qCh6aqMIGNoZWNrc3VtIC8gcHVibGlzaGVyIC8gc2lnbmF0dXJlIOeahOmihOeVmeS9jVxuICogNC4g5qCh6aqMIHBhY2thZ2UgY29tcGF0aWJpbGl0eVxuICogNS4g6L6T5Ye657uT5p6E5YyWIHZhbGlkYXRpb24gcmVzdWx0XG4gKiBcbiAqIEB2ZXJzaW9uIHYwLjEuMFxuICogQGRhdGUgMjAyNi0wNC0wM1xuICovXG5cbmltcG9ydCB0eXBlIHtcbiAgU2tpbGxQYWNrYWdlRGVzY3JpcHRvcixcbiAgU2tpbGxWYWxpZGF0aW9uUmVzdWx0LFxuICBTa2lsbFRydXN0U2lnbmFsLFxuICBTa2lsbENvbXBhdGliaWxpdHlJc3N1ZSxcbiAgU2tpbGxTZWN1cml0eVdhcm5pbmcsXG4gIFNraWxsU291cmNlRGVzY3JpcHRvcixcbn0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgeyB2YWxpZGF0ZU1hbmlmZXN0IH0gZnJvbSAnLi9za2lsbF9tYW5pZmVzdCc7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOexu+Wei+WumuS5iVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIOmqjOivgeWZqOmFjee9rlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFZhbGlkYXRvckNvbmZpZyB7XG4gIC8qKiDov5DooYzml7bniYjmnKwgKi9cbiAgcnVudGltZVZlcnNpb24/OiBzdHJpbmc7XG4gIFxuICAvKiog5Y+v55So55qEIEFnZW50IOWIl+ihqCAqL1xuICBhdmFpbGFibGVBZ2VudHM/OiBzdHJpbmdbXTtcbiAgXG4gIC8qKiDkuKXmoLzmqKHlvI8gKi9cbiAgc3RyaWN0TW9kZT86IGJvb2xlYW47XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIFNraWxsIOmqjOivgeWZqFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgY2xhc3MgU2tpbGxWYWxpZGF0b3Ige1xuICBwcml2YXRlIGNvbmZpZzogUmVxdWlyZWQ8VmFsaWRhdG9yQ29uZmlnPjtcbiAgXG4gIGNvbnN0cnVjdG9yKGNvbmZpZzogVmFsaWRhdG9yQ29uZmlnID0ge30pIHtcbiAgICB0aGlzLmNvbmZpZyA9IHtcbiAgICAgIHJ1bnRpbWVWZXJzaW9uOiBjb25maWcucnVudGltZVZlcnNpb24gPz8gJzIwMjYuNC4wJyxcbiAgICAgIGF2YWlsYWJsZUFnZW50czogY29uZmlnLmF2YWlsYWJsZUFnZW50cyA/PyBbXSxcbiAgICAgIHN0cmljdE1vZGU6IGNvbmZpZy5zdHJpY3RNb2RlID8/IGZhbHNlLFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDpqozor4EgU2tpbGwgUGFja2FnZVxuICAgKi9cbiAgYXN5bmMgdmFsaWRhdGVTa2lsbFBhY2thZ2UocGtnOiBTa2lsbFBhY2thZ2VEZXNjcmlwdG9yKTogUHJvbWlzZTxTa2lsbFZhbGlkYXRpb25SZXN1bHQ+IHtcbiAgICBjb25zdCBlcnJvcnM6IHN0cmluZ1tdID0gW107XG4gICAgY29uc3Qgd2FybmluZ3M6IHN0cmluZ1tdID0gW107XG4gICAgY29uc3QgdHJ1c3RTaWduYWxzOiBTa2lsbFRydXN0U2lnbmFsW10gPSBbXTtcbiAgICBjb25zdCBjb21wYXRpYmlsaXR5SXNzdWVzOiBTa2lsbENvbXBhdGliaWxpdHlJc3N1ZVtdID0gW107XG4gICAgY29uc3Qgc2VjdXJpdHlXYXJuaW5nczogU2tpbGxTZWN1cml0eVdhcm5pbmdbXSA9IFtdO1xuICAgIFxuICAgIC8vIDEuIOmqjOivgSBtYW5pZmVzdFxuICAgIGNvbnN0IG1hbmlmZXN0VmFsaWRhdGlvbiA9IHZhbGlkYXRlTWFuaWZlc3QocGtnLm1hbmlmZXN0KTtcbiAgICBcbiAgICBpZiAoIW1hbmlmZXN0VmFsaWRhdGlvbi52YWxpZCkge1xuICAgICAgZXJyb3JzLnB1c2goLi4ubWFuaWZlc3RWYWxpZGF0aW9uLmVycm9ycyk7XG4gICAgfVxuICAgIFxuICAgIHdhcm5pbmdzLnB1c2goLi4ubWFuaWZlc3RWYWxpZGF0aW9uLndhcm5pbmdzKTtcbiAgICBcbiAgICAvLyAyLiDpqozor4HmnaXmupBcbiAgICBpZiAocGtnLnNvdXJjZVBhdGgpIHtcbiAgICAgIGNvbnN0IHNvdXJjZVZhbGlkYXRpb24gPSBhd2FpdCB0aGlzLnZhbGlkYXRlU291cmNlKHtcbiAgICAgICAgdHlwZTogcGtnLnNvdXJjZSxcbiAgICAgICAgbG9jYXRpb246IHBrZy5zb3VyY2VQYXRoLFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGlmICghc291cmNlVmFsaWRhdGlvbi52YWxpZCkge1xuICAgICAgICBlcnJvcnMucHVzaCguLi5zb3VyY2VWYWxpZGF0aW9uLmVycm9ycyk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIHRydXN0U2lnbmFscy5wdXNoKC4uLnNvdXJjZVZhbGlkYXRpb24udHJ1c3RTaWduYWxzKTtcbiAgICB9XG4gICAgXG4gICAgLy8gMy4g6aqM6K+B5YW85a655oCnXG4gICAgY29uc3QgY29tcGF0aWJpbGl0eVZhbGlkYXRpb24gPSB0aGlzLnZhbGlkYXRlQ29tcGF0aWJpbGl0eShwa2cpO1xuICAgIGNvbXBhdGliaWxpdHlJc3N1ZXMucHVzaCguLi5jb21wYXRpYmlsaXR5VmFsaWRhdGlvbi5pc3N1ZXMpO1xuICAgIFxuICAgIC8vIDQuIOaUtumbhuWuieWFqOitpuWRilxuICAgIHNlY3VyaXR5V2FybmluZ3MucHVzaCguLi50aGlzLmNvbGxlY3RTZWN1cml0eVdhcm5pbmdzKHBrZykpO1xuICAgIFxuICAgIC8vIDUuIOS4peagvOaooeW8j+mineWkluajgOafpVxuICAgIGlmICh0aGlzLmNvbmZpZy5zdHJpY3RNb2RlKSB7XG4gICAgICBjb25zdCBzdHJpY3RDaGVja3MgPSB0aGlzLnBlcmZvcm1TdHJpY3RDaGVja3MocGtnKTtcbiAgICAgIGVycm9ycy5wdXNoKC4uLnN0cmljdENoZWNrcy5lcnJvcnMpO1xuICAgICAgd2FybmluZ3MucHVzaCguLi5zdHJpY3RDaGVja3Mud2FybmluZ3MpO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgdmFsaWQ6IGVycm9ycy5sZW5ndGggPT09IDAsXG4gICAgICBlcnJvcnMsXG4gICAgICB3YXJuaW5ncyxcbiAgICAgIHRydXN0U2lnbmFscyxcbiAgICAgIGNvbXBhdGliaWxpdHlJc3N1ZXMsXG4gICAgICBzZWN1cml0eVdhcm5pbmdzLFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDpqozor4HmnaXmupBcbiAgICovXG4gIGFzeW5jIHZhbGlkYXRlU291cmNlKHNvdXJjZTogU2tpbGxTb3VyY2VEZXNjcmlwdG9yKTogUHJvbWlzZTx7XG4gICAgdmFsaWQ6IGJvb2xlYW47XG4gICAgZXJyb3JzOiBzdHJpbmdbXTtcbiAgICB0cnVzdFNpZ25hbHM6IFNraWxsVHJ1c3RTaWduYWxbXTtcbiAgfT4ge1xuICAgIGNvbnN0IGVycm9yczogc3RyaW5nW10gPSBbXTtcbiAgICBjb25zdCB0cnVzdFNpZ25hbHM6IFNraWxsVHJ1c3RTaWduYWxbXSA9IFtdO1xuICAgIFxuICAgIC8vIOajgOafpeadpea6kOi3r+W+hOaYr+WQpuWtmOWcqC/lj6/orr/pl65cbiAgICAvLyDnroDljJblrp7njrDvvJrlrp7pmYXlupTor6Xmo4Dmn6Xmlofku7bns7vnu5/miJbnvZHnu5xcbiAgICBcbiAgICAvLyBidWlsdGluIOadpea6kOm7mOiupOWPr+S/oVxuICAgIGlmIChzb3VyY2UudHlwZSA9PT0gJ2J1aWx0aW4nKSB7XG4gICAgICB0cnVzdFNpZ25hbHMucHVzaCh7XG4gICAgICAgIHR5cGU6ICdidWlsdGluJyxcbiAgICAgICAgdmFsdWU6IHNvdXJjZS5sb2NhdGlvbixcbiAgICAgICAgY29uZmlkZW5jZTogMS4wLFxuICAgICAgfSk7XG4gICAgfVxuICAgIFxuICAgIC8vIHdvcmtzcGFjZSDmnaXmupDmo4Dmn6XmnKzlnLDot6/lvoRcbiAgICBpZiAoc291cmNlLnR5cGUgPT09ICd3b3Jrc3BhY2UnKSB7XG4gICAgICB0cnVzdFNpZ25hbHMucHVzaCh7XG4gICAgICAgIHR5cGU6ICd3b3Jrc3BhY2VfbG9jYWwnLFxuICAgICAgICB2YWx1ZTogc291cmNlLmxvY2F0aW9uLFxuICAgICAgICBjb25maWRlbmNlOiAwLjgsXG4gICAgICB9KTtcbiAgICB9XG4gICAgXG4gICAgLy8gZXh0ZXJuYWwg5p2l5rqQ6ZyA6KaB5pu05aSa6aqM6K+BXG4gICAgaWYgKHNvdXJjZS50eXBlID09PSAnZXh0ZXJuYWwnKSB7XG4gICAgICAvLyDmo4Dmn6XmmK/lkKbmnInmoKHpqozlkoxcbiAgICAgIGlmIChzb3VyY2UuY2hlY2tzdW0pIHtcbiAgICAgICAgdHJ1c3RTaWduYWxzLnB1c2goe1xuICAgICAgICAgIHR5cGU6ICdjaGVja3N1bV92YWxpZCcsXG4gICAgICAgICAgdmFsdWU6IHNvdXJjZS5jaGVja3N1bSxcbiAgICAgICAgICBjb25maWRlbmNlOiAwLjksXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8g5rKh5pyJ5qCh6aqM5ZKM77yM6K2m5ZGKXG4gICAgICAgIGVycm9ycy5wdXNoKCdFeHRlcm5hbCBzb3VyY2UgbWlzc2luZyBjaGVja3N1bScpO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyDmo4Dmn6Xlj5HluIPogIVcbiAgICAgIGlmIChzb3VyY2UudHJ1c3RlZFB1Ymxpc2hlcikge1xuICAgICAgICB0cnVzdFNpZ25hbHMucHVzaCh7XG4gICAgICAgICAgdHlwZTogJ3ZlcmlmaWVkX3B1Ymxpc2hlcicsXG4gICAgICAgICAgdmFsdWU6IHNvdXJjZS50cnVzdGVkUHVibGlzaGVyLFxuICAgICAgICAgIGNvbmZpZGVuY2U6IDAuODUsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgdmFsaWQ6IGVycm9ycy5sZW5ndGggPT09IDAsXG4gICAgICBlcnJvcnMsXG4gICAgICB0cnVzdFNpZ25hbHMsXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOmqjOivgeWFvOWuueaAp1xuICAgKi9cbiAgdmFsaWRhdGVDb21wYXRpYmlsaXR5KHBrZzogU2tpbGxQYWNrYWdlRGVzY3JpcHRvcik6IHtcbiAgICB2YWxpZDogYm9vbGVhbjtcbiAgICBpc3N1ZXM6IFNraWxsQ29tcGF0aWJpbGl0eUlzc3VlW107XG4gIH0ge1xuICAgIGNvbnN0IGlzc3VlczogU2tpbGxDb21wYXRpYmlsaXR5SXNzdWVbXSA9IFtdO1xuICAgIGNvbnN0IGNvbXBhdGliaWxpdHkgPSBwa2cubWFuaWZlc3QuY29tcGF0aWJpbGl0eTtcbiAgICBcbiAgICBpZiAoIWNvbXBhdGliaWxpdHkpIHtcbiAgICAgIC8vIOayoeacieWFvOWuueaAp+WjsOaYju+8jOitpuWRilxuICAgICAgaXNzdWVzLnB1c2goe1xuICAgICAgICB0eXBlOiAndmVyc2lvbicsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnTm8gY29tcGF0aWJpbGl0eSBpbmZvcm1hdGlvbiBwcm92aWRlZCcsXG4gICAgICAgIHNldmVyaXR5OiAnbG93JyxcbiAgICAgICAgc3VnZ2VzdGVkQWN0aW9uOiAnQWRkIGNvbXBhdGliaWxpdHkgaW5mb3JtYXRpb24gdG8gbWFuaWZlc3QnLFxuICAgICAgfSk7XG4gICAgICByZXR1cm4geyB2YWxpZDogdHJ1ZSwgaXNzdWVzIH07XG4gICAgfVxuICAgIFxuICAgIC8vIOajgOafpSBPcGVuQ2xhdyDniYjmnKzlhbzlrrnmgKdcbiAgICBpZiAoY29tcGF0aWJpbGl0eS5taW5PcGVuQ2xhd1ZlcnNpb24pIHtcbiAgICAgIGNvbnN0IHZlcnNpb25Db21wYXJlID0gdGhpcy5jb21wYXJlVmVyc2lvbnMoXG4gICAgICAgIHRoaXMuY29uZmlnLnJ1bnRpbWVWZXJzaW9uLFxuICAgICAgICBjb21wYXRpYmlsaXR5Lm1pbk9wZW5DbGF3VmVyc2lvblxuICAgICAgKTtcbiAgICAgIFxuICAgICAgaWYgKHZlcnNpb25Db21wYXJlIDwgMCkge1xuICAgICAgICBpc3N1ZXMucHVzaCh7XG4gICAgICAgICAgdHlwZTogJ3ZlcnNpb24nLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiBgUmVxdWlyZXMgT3BlbkNsYXcgPj0gJHtjb21wYXRpYmlsaXR5Lm1pbk9wZW5DbGF3VmVyc2lvbn0sIGN1cnJlbnQgdmVyc2lvbiBpcyAke3RoaXMuY29uZmlnLnJ1bnRpbWVWZXJzaW9ufWAsXG4gICAgICAgICAgc2V2ZXJpdHk6ICdoaWdoJyxcbiAgICAgICAgICBzdWdnZXN0ZWRBY3Rpb246ICdVcGdyYWRlIE9wZW5DbGF3IG9yIHVzZSBhIGNvbXBhdGlibGUgc2tpbGwgdmVyc2lvbicsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICBpZiAoY29tcGF0aWJpbGl0eS5tYXhPcGVuQ2xhd1ZlcnNpb24pIHtcbiAgICAgIGNvbnN0IHZlcnNpb25Db21wYXJlID0gdGhpcy5jb21wYXJlVmVyc2lvbnMoXG4gICAgICAgIHRoaXMuY29uZmlnLnJ1bnRpbWVWZXJzaW9uLFxuICAgICAgICBjb21wYXRpYmlsaXR5Lm1heE9wZW5DbGF3VmVyc2lvblxuICAgICAgKTtcbiAgICAgIFxuICAgICAgaWYgKHZlcnNpb25Db21wYXJlID4gMCkge1xuICAgICAgICBpc3N1ZXMucHVzaCh7XG4gICAgICAgICAgdHlwZTogJ3ZlcnNpb24nLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiBgUmVxdWlyZXMgT3BlbkNsYXcgPD0gJHtjb21wYXRpYmlsaXR5Lm1heE9wZW5DbGF3VmVyc2lvbn0sIGN1cnJlbnQgdmVyc2lvbiBpcyAke3RoaXMuY29uZmlnLnJ1bnRpbWVWZXJzaW9ufWAsXG4gICAgICAgICAgc2V2ZXJpdHk6ICdoaWdoJyxcbiAgICAgICAgICBzdWdnZXN0ZWRBY3Rpb246ICdEb3duZ3JhZGUgT3BlbkNsYXcgb3IgdXNlIGEgY29tcGF0aWJsZSBza2lsbCB2ZXJzaW9uJyxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIOajgOafpSBBZ2VudCDlhbzlrrnmgKdcbiAgICBpZiAoY29tcGF0aWJpbGl0eS5yZXF1aXJlZEFnZW50cyAmJiBjb21wYXRpYmlsaXR5LnJlcXVpcmVkQWdlbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IG1pc3NpbmdBZ2VudHMgPSBjb21wYXRpYmlsaXR5LnJlcXVpcmVkQWdlbnRzLmZpbHRlcihcbiAgICAgICAgYWdlbnQgPT4gIXRoaXMuY29uZmlnLmF2YWlsYWJsZUFnZW50cy5pbmNsdWRlcyhhZ2VudClcbiAgICAgICk7XG4gICAgICBcbiAgICAgIGlmIChtaXNzaW5nQWdlbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgaXNzdWVzLnB1c2goe1xuICAgICAgICAgIHR5cGU6ICdhZ2VudCcsXG4gICAgICAgICAgZGVzY3JpcHRpb246IGBSZXF1aXJlZCBhZ2VudHMgbm90IGF2YWlsYWJsZTogJHttaXNzaW5nQWdlbnRzLmpvaW4oJywgJyl9YCxcbiAgICAgICAgICBzZXZlcml0eTogJ2hpZ2gnLFxuICAgICAgICAgIHN1Z2dlc3RlZEFjdGlvbjogJ0luc3RhbGwgcmVxdWlyZWQgYWdlbnRzIG9yIHVzZSBhIGRpZmZlcmVudCBza2lsbCcsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyDmo4Dmn6XkuI3lhbzlrrnnmoQgQWdlbnRcbiAgICBpZiAoY29tcGF0aWJpbGl0eS5pbmNvbXBhdGlibGVBZ2VudHMpIHtcbiAgICAgIGNvbnN0IGNvbmZsaWN0aW5nQWdlbnRzID0gY29tcGF0aWJpbGl0eS5pbmNvbXBhdGlibGVBZ2VudHMuZmlsdGVyKFxuICAgICAgICBhZ2VudCA9PiB0aGlzLmNvbmZpZy5hdmFpbGFibGVBZ2VudHMuaW5jbHVkZXMoYWdlbnQpXG4gICAgICApO1xuICAgICAgXG4gICAgICBpZiAoY29uZmxpY3RpbmdBZ2VudHMubGVuZ3RoID4gMCkge1xuICAgICAgICBpc3N1ZXMucHVzaCh7XG4gICAgICAgICAgdHlwZTogJ2FnZW50JyxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogYEluY29tcGF0aWJsZSB3aXRoIGF2YWlsYWJsZSBhZ2VudHM6ICR7Y29uZmxpY3RpbmdBZ2VudHMuam9pbignLCAnKX1gLFxuICAgICAgICAgIHNldmVyaXR5OiAnbWVkaXVtJyxcbiAgICAgICAgICBzdWdnZXN0ZWRBY3Rpb246ICdEaXNhYmxlIGNvbmZsaWN0aW5nIGFnZW50cycsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgdmFsaWQ6IGlzc3Vlcy5maWx0ZXIoaSA9PiBpLnNldmVyaXR5ID09PSAnaGlnaCcgfHwgaS5zZXZlcml0eSA9PT0gJ2NyaXRpY2FsJykubGVuZ3RoID09PSAwLFxuICAgICAgaXNzdWVzLFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmlLbpm4blronlhajorablkYpcbiAgICovXG4gIGNvbGxlY3RTZWN1cml0eVdhcm5pbmdzKHBrZzogU2tpbGxQYWNrYWdlRGVzY3JpcHRvcik6IFNraWxsU2VjdXJpdHlXYXJuaW5nW10ge1xuICAgIGNvbnN0IHdhcm5pbmdzOiBTa2lsbFNlY3VyaXR5V2FybmluZ1tdID0gW107XG4gICAgXG4gICAgLy8g5qOA5p+l5bel5YW35p2D6ZmQXG4gICAgZm9yIChjb25zdCB0b29sIG9mIHBrZy5tYW5pZmVzdC50b29scykge1xuICAgICAgaWYgKHRvb2wucmlza0xldmVsID09PSAnaGlnaCcpIHtcbiAgICAgICAgd2FybmluZ3MucHVzaCh7XG4gICAgICAgICAgdHlwZTogJ3Blcm1pc3Npb24nLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiBgVG9vbCBcIiR7dG9vbC5uYW1lfVwiIGhhcyBoaWdoIHJpc2sgbGV2ZWxgLFxuICAgICAgICAgIHJpc2tMZXZlbDogJ2hpZ2gnLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgaWYgKHRvb2wucmVxdWlyZXNBcHByb3ZhbCkge1xuICAgICAgICB3YXJuaW5ncy5wdXNoKHtcbiAgICAgICAgICB0eXBlOiAncGVybWlzc2lvbicsXG4gICAgICAgICAgZGVzY3JpcHRpb246IGBUb29sIFwiJHt0b29sLm5hbWV9XCIgcmVxdWlyZXMgYXBwcm92YWxgLFxuICAgICAgICAgIHJpc2tMZXZlbDogJ21lZGl1bScsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyDmo4Dmn6UgTUNQIOS+nei1llxuICAgIGlmIChwa2cubWFuaWZlc3QubWNwU2VydmVycyAmJiBwa2cubWFuaWZlc3QubWNwU2VydmVycy5sZW5ndGggPiAwKSB7XG4gICAgICB3YXJuaW5ncy5wdXNoKHtcbiAgICAgICAgdHlwZTogJ25ldHdvcmsnLFxuICAgICAgICBkZXNjcmlwdGlvbjogYFNraWxsIHJlcXVpcmVzIE1DUCBzZXJ2ZXJzOiAke3BrZy5tYW5pZmVzdC5tY3BTZXJ2ZXJzLmpvaW4oJywgJyl9YCxcbiAgICAgICAgcmlza0xldmVsOiAnbWVkaXVtJyxcbiAgICAgIH0pO1xuICAgIH1cbiAgICBcbiAgICAvLyDmo4Dmn6XlpJbpg6jkvp3otZZcbiAgICBmb3IgKGNvbnN0IGRlcCBvZiBwa2cubWFuaWZlc3QuZGVwZW5kZW5jaWVzKSB7XG4gICAgICBpZiAoZGVwLm5hbWUuc3RhcnRzV2l0aCgnQGV4dGVybmFsLycpKSB7XG4gICAgICAgIHdhcm5pbmdzLnB1c2goe1xuICAgICAgICAgIHR5cGU6ICdleGVjdXRpb24nLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiBgRXh0ZXJuYWwgZGVwZW5kZW5jeTogJHtkZXAubmFtZX1gLFxuICAgICAgICAgIHJpc2tMZXZlbDogJ21lZGl1bScsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gd2FybmluZ3M7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDkuKXmoLzmqKHlvI/mo4Dmn6VcbiAgICovXG4gIHBlcmZvcm1TdHJpY3RDaGVja3MocGtnOiBTa2lsbFBhY2thZ2VEZXNjcmlwdG9yKToge1xuICAgIGVycm9yczogc3RyaW5nW107XG4gICAgd2FybmluZ3M6IHN0cmluZ1tdO1xuICB9IHtcbiAgICBjb25zdCBlcnJvcnM6IHN0cmluZ1tdID0gW107XG4gICAgY29uc3Qgd2FybmluZ3M6IHN0cmluZ1tdID0gW107XG4gICAgXG4gICAgLy8g5qOA5p+l5piv5ZCm5pyJ6K645Y+v6K+BXG4gICAgaWYgKCFwa2cubWFuaWZlc3QubGljZW5zZSkge1xuICAgICAgZXJyb3JzLnB1c2goJ1N0cmljdCBtb2RlOiBNaXNzaW5nIGxpY2Vuc2UgaW5mb3JtYXRpb24nKTtcbiAgICB9XG4gICAgXG4gICAgLy8g5qOA5p+l5piv5ZCm5pyJ5L2c6ICF5L+h5oGvXG4gICAgaWYgKCFwa2cubWFuaWZlc3QuYXV0aG9yKSB7XG4gICAgICBlcnJvcnMucHVzaCgnU3RyaWN0IG1vZGU6IE1pc3NpbmcgYXV0aG9yIGluZm9ybWF0aW9uJyk7XG4gICAgfVxuICAgIFxuICAgIC8vIOajgOafpeaYr+WQpuacieaPj+i/sFxuICAgIGlmICghcGtnLm1hbmlmZXN0LmRlc2NyaXB0aW9uKSB7XG4gICAgICB3YXJuaW5ncy5wdXNoKCdTdHJpY3QgbW9kZTogTWlzc2luZyBkZXNjcmlwdGlvbicpO1xuICAgIH1cbiAgICBcbiAgICAvLyDmo4Dmn6XmmK/lkKbmnInog73lipvlo7DmmI5cbiAgICBpZiAocGtnLm1hbmlmZXN0LmNhcGFiaWxpdGllcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHdhcm5pbmdzLnB1c2goJ1N0cmljdCBtb2RlOiBObyBjYXBhYmlsaXRpZXMgZGVjbGFyZWQnKTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHsgZXJyb3JzLCB3YXJuaW5ncyB9O1xuICB9XG4gIFxuICAvKipcbiAgICog5p6E5bu66aqM6K+B5oql5ZGKXG4gICAqL1xuICBhc3luYyBidWlsZFZhbGlkYXRpb25SZXBvcnQocGtnOiBTa2lsbFBhY2thZ2VEZXNjcmlwdG9yKTogUHJvbWlzZTx7XG4gICAgcGFja2FnZUlkOiBzdHJpbmc7XG4gICAgcmVzdWx0OiBTa2lsbFZhbGlkYXRpb25SZXN1bHQ7XG4gICAgc3VtbWFyeToge1xuICAgICAgaXNWYWxpZDogYm9vbGVhbjtcbiAgICAgIGVycm9yQ291bnQ6IG51bWJlcjtcbiAgICAgIHdhcm5pbmdDb3VudDogbnVtYmVyO1xuICAgICAgY29tcGF0aWJpbGl0eUlzc3VlQ291bnQ6IG51bWJlcjtcbiAgICAgIHNlY3VyaXR5V2FybmluZ0NvdW50OiBudW1iZXI7XG4gICAgfTtcbiAgfT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMudmFsaWRhdGVTa2lsbFBhY2thZ2UocGtnKTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgcGFja2FnZUlkOiBwa2cuaWQsXG4gICAgICByZXN1bHQsXG4gICAgICBzdW1tYXJ5OiB7XG4gICAgICAgIGlzVmFsaWQ6IHJlc3VsdC52YWxpZCxcbiAgICAgICAgZXJyb3JDb3VudDogcmVzdWx0LmVycm9ycy5sZW5ndGgsXG4gICAgICAgIHdhcm5pbmdDb3VudDogcmVzdWx0Lndhcm5pbmdzLmxlbmd0aCxcbiAgICAgICAgY29tcGF0aWJpbGl0eUlzc3VlQ291bnQ6IHJlc3VsdC5jb21wYXRpYmlsaXR5SXNzdWVzLmxlbmd0aCxcbiAgICAgICAgc2VjdXJpdHlXYXJuaW5nQ291bnQ6IHJlc3VsdC5zZWN1cml0eVdhcm5pbmdzLmxlbmd0aCxcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxuICBcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAvLyDlhoXpg6jmlrnms5VcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICBcbiAgLyoqXG4gICAqIOavlOi+g+eJiOacrOWPt1xuICAgKi9cbiAgcHJpdmF0ZSBjb21wYXJlVmVyc2lvbnModjE6IHN0cmluZywgdjI6IHN0cmluZyk6IG51bWJlciB7XG4gICAgY29uc3QgcGFydHMxID0gdjEuc3BsaXQoJy4nKS5tYXAoTnVtYmVyKTtcbiAgICBjb25zdCBwYXJ0czIgPSB2Mi5zcGxpdCgnLicpLm1hcChOdW1iZXIpO1xuICAgIFxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgTWF0aC5tYXgocGFydHMxLmxlbmd0aCwgcGFydHMyLmxlbmd0aCk7IGkrKykge1xuICAgICAgY29uc3QgcDEgPSBwYXJ0czFbaV0gfHwgMDtcbiAgICAgIGNvbnN0IHAyID0gcGFydHMyW2ldIHx8IDA7XG4gICAgICBcbiAgICAgIGlmIChwMSA+IHAyKSByZXR1cm4gMTtcbiAgICAgIGlmIChwMSA8IHAyKSByZXR1cm4gLTE7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiAwO1xuICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOS+v+aNt+WHveaVsFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIOWIm+W7uiBTa2lsbCDpqozor4HlmahcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVNraWxsVmFsaWRhdG9yKGNvbmZpZz86IFZhbGlkYXRvckNvbmZpZyk6IFNraWxsVmFsaWRhdG9yIHtcbiAgcmV0dXJuIG5ldyBTa2lsbFZhbGlkYXRvcihjb25maWcpO1xufVxuXG4vKipcbiAqIOW/q+mAn+mqjOivgSBTa2lsbFxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdmFsaWRhdGVTa2lsbChcbiAgcGtnOiBTa2lsbFBhY2thZ2VEZXNjcmlwdG9yLFxuICBjb25maWc/OiBWYWxpZGF0b3JDb25maWdcbik6IFByb21pc2U8U2tpbGxWYWxpZGF0aW9uUmVzdWx0PiB7XG4gIGNvbnN0IHZhbGlkYXRvciA9IG5ldyBTa2lsbFZhbGlkYXRvcihjb25maWcpO1xuICByZXR1cm4gYXdhaXQgdmFsaWRhdG9yLnZhbGlkYXRlU2tpbGxQYWNrYWdlKHBrZyk7XG59XG4iXX0=