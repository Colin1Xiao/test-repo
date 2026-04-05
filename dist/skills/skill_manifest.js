"use strict";
/**
 * Skill Manifest - Skill Manifest 定义与解析
 *
 * 职责：
 * 1. 定义标准 manifest 结构
 * 2. 解析 JSON/YAML manifest
 * 3. 校验必填字段
 * 4. 做默认值填充与规范化
 * 5. 输出标准化 SkillManifest
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseManifest = parseManifest;
exports.validateManifest = validateManifest;
exports.normalizeManifest = normalizeManifest;
exports.getManifestId = getManifestId;
exports.isValidSkillName = isValidSkillName;
exports.isValidSkillVersion = isValidSkillVersion;
exports.isValidTrustLevel = isValidTrustLevel;
exports.parseAndValidateManifest = parseAndValidateManifest;
// ============================================================================
// 常量定义
// ============================================================================
/**
 * 有效的信任级别
 */
const VALID_TRUST_LEVELS = [
    'builtin',
    'verified',
    'workspace',
    'external',
    'untrusted',
];
/**
 * 有效的能力类型
 */
const VALID_CAPABILITY_TYPES = [
    'tool_runtime',
    'code_intel',
    'mcp_integration',
    'verification',
    'repo_analysis',
    'review',
    'release',
    'automation',
];
// ============================================================================
// Manifest 解析
// ============================================================================
/**
 * 解析 Manifest
 */
function parseManifest(input) {
    try {
        let manifest;
        // 如果是字符串，尝试解析 JSON
        if (typeof input === 'string') {
            try {
                manifest = JSON.parse(input);
            }
            catch (error) {
                return {
                    success: false,
                    error: `Failed to parse manifest JSON: ${error instanceof Error ? error.message : String(error)}`,
                };
            }
        }
        else {
            manifest = input;
        }
        // 规范化 Manifest
        const normalized = normalizeManifest(manifest);
        return {
            success: true,
            manifest: normalized,
            warnings: [],
        };
    }
    catch (error) {
        return {
            success: false,
            error: `Manifest parse error: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}
/**
 * 验证 Manifest
 */
function validateManifest(manifest) {
    const errors = [];
    const warnings = [];
    // 校验 name
    if (!manifest.name || typeof manifest.name !== 'string') {
        errors.push('Manifest must have a valid "name" field (string)');
    }
    else if (!isValidSkillName(manifest.name)) {
        errors.push(`Invalid skill name: "${manifest.name}". Must be alphanumeric with hyphens/underscores.`);
    }
    // 校验 version
    if (!manifest.version || typeof manifest.version !== 'string') {
        errors.push('Manifest must have a valid "version" field (string)');
    }
    else if (!isValidSkillVersion(manifest.version)) {
        errors.push(`Invalid skill version: "${manifest.version}". Must be semantic version (e.g., 1.0.0).`);
    }
    // 校验 trustLevel
    if (manifest.trustLevel && !VALID_TRUST_LEVELS.includes(manifest.trustLevel)) {
        errors.push(`Invalid trustLevel: "${manifest.trustLevel}". Must be one of: ${VALID_TRUST_LEVELS.join(', ')}`);
    }
    // 校验 capabilities
    if (!Array.isArray(manifest.capabilities)) {
        errors.push('Manifest must have a "capabilities" field (array)');
    }
    else {
        for (let i = 0; i < manifest.capabilities.length; i++) {
            const cap = manifest.capabilities[i];
            if (!cap.name || !cap.description || !cap.type) {
                errors.push(`Capability at index ${i} must have name, description, and type`);
            }
            else if (!VALID_CAPABILITY_TYPES.includes(cap.type)) {
                errors.push(`Invalid capability type: "${cap.type}". Must be one of: ${VALID_CAPABILITY_TYPES.join(', ')}`);
            }
        }
    }
    // 校验 tools
    if (!Array.isArray(manifest.tools)) {
        errors.push('Manifest must have a "tools" field (array)');
    }
    else {
        for (let i = 0; i < manifest.tools.length; i++) {
            const tool = manifest.tools[i];
            if (!tool.name || !tool.description || !tool.inputSchema) {
                errors.push(`Tool at index ${i} must have name, description, and inputSchema`);
            }
        }
    }
    // 校验 dependencies
    if (!Array.isArray(manifest.dependencies)) {
        errors.push('Manifest must have a "dependencies" field (array)');
    }
    else {
        for (let i = 0; i < manifest.dependencies.length; i++) {
            const dep = manifest.dependencies[i];
            if (!dep.name || !dep.version) {
                errors.push(`Dependency at index ${i} must have name and version`);
            }
        }
    }
    // 校验 compatibility
    if (manifest.compatibility) {
        if (manifest.compatibility.minOpenClawVersion && !isValidSkillVersion(manifest.compatibility.minOpenClawVersion)) {
            warnings.push(`Invalid minOpenClawVersion: "${manifest.compatibility.minOpenClawVersion}"`);
        }
        if (manifest.compatibility.maxOpenClawVersion && !isValidSkillVersion(manifest.compatibility.maxOpenClawVersion)) {
            warnings.push(`Invalid maxOpenClawVersion: "${manifest.compatibility.maxOpenClawVersion}"`);
        }
    }
    // 校验 mcpServers
    if (manifest.mcpServers && !Array.isArray(manifest.mcpServers)) {
        errors.push('mcpServers must be an array');
    }
    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}
/**
 * 规范化 Manifest
 */
function normalizeManifest(manifest) {
    const normalized = {
        ...manifest,
        // 确保数组字段存在
        capabilities: manifest.capabilities || [],
        tools: manifest.tools || [],
        dependencies: manifest.dependencies || [],
        mcpServers: manifest.mcpServers || [],
        // 设置默认信任级别
        trustLevel: manifest.trustLevel || 'workspace',
        // 规范化能力
        capabilities: manifest.capabilities?.map(normalizeCapability) || [],
        // 规范化工具
        tools: manifest.tools?.map(normalizeTool) || [],
        // 规范化依赖
        dependencies: manifest.dependencies?.map(normalizeDependency) || [],
    };
    // 规范化兼容性
    if (manifest.compatibility) {
        normalized.compatibility = normalizeCompatibility(manifest.compatibility);
    }
    return normalized;
}
/**
 * 规范化能力
 */
function normalizeCapability(capability) {
    return {
        name: capability.name.trim(),
        description: capability.description.trim(),
        type: capability.type,
        inputSchema: capability.inputSchema,
        outputSchema: capability.outputSchema,
    };
}
/**
 * 规范化工具
 */
function normalizeTool(tool) {
    return {
        name: tool.name.trim(),
        description: tool.description.trim(),
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
        requiresApproval: tool.requiresApproval ?? false,
        riskLevel: tool.riskLevel || 'medium',
    };
}
/**
 * 规范化依赖
 */
function normalizeDependency(dependency) {
    return {
        name: dependency.name.trim(),
        version: dependency.version.trim(),
        required: dependency.required ?? true,
        alternatives: dependency.alternatives,
    };
}
/**
 * 规范化兼容性
 */
function normalizeCompatibility(compatibility) {
    return {
        ...compatibility,
        requiredAgents: compatibility.requiredAgents || [],
        optionalAgents: compatibility.optionalAgents || [],
        incompatibleAgents: compatibility.incompatibleAgents || [],
    };
}
/**
 * 获取 Manifest ID
 */
function getManifestId(name, version) {
    return `${name}@${version}`;
}
// ============================================================================
// 工具函数
// ============================================================================
/**
 * 检查 Skill 名称是否有效
 */
function isValidSkillName(name) {
    // 允许字母、数字、连字符、下划线
    return /^[a-z0-9_-]+$/i.test(name);
}
/**
 * 检查版本是否有效（简单语义化版本检查）
 */
function isValidSkillVersion(version) {
    // 简单语义化版本检查：major.minor.patch
    return /^\d+\.\d+\.\d+/.test(version);
}
/**
 * 检查信任级别是否有效
 */
function isValidTrustLevel(level) {
    return VALID_TRUST_LEVELS.includes(level);
}
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 解析并验证 Manifest
 */
function parseAndValidateManifest(input) {
    const parseResult = parseManifest(input);
    if (!parseResult.success || !parseResult.manifest) {
        return parseResult;
    }
    const validation = validateManifest(parseResult.manifest);
    if (!validation.valid) {
        return {
            success: false,
            error: `Manifest validation failed: ${validation.errors.join('; ')}`,
            warnings: validation.warnings,
        };
    }
    return {
        ...parseResult,
        validation,
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2tpbGxfbWFuaWZlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvc2tpbGxzL3NraWxsX21hbmlmZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7Ozs7O0dBWUc7O0FBa0ZILHNDQWlDQztBQUtELDRDQWlGQztBQUtELDhDQXdCQztBQXdERCxzQ0FFQztBQVNELDRDQUdDO0FBS0Qsa0RBR0M7QUFLRCw4Q0FFQztBQVNELDREQXVCQztBQTdTRCwrRUFBK0U7QUFDL0UsT0FBTztBQUNQLCtFQUErRTtBQUUvRTs7R0FFRztBQUNILE1BQU0sa0JBQWtCLEdBQXNCO0lBQzVDLFNBQVM7SUFDVCxVQUFVO0lBQ1YsV0FBVztJQUNYLFVBQVU7SUFDVixXQUFXO0NBQ1osQ0FBQztBQUVGOztHQUVHO0FBQ0gsTUFBTSxzQkFBc0IsR0FBMEI7SUFDcEQsY0FBYztJQUNkLFlBQVk7SUFDWixpQkFBaUI7SUFDakIsY0FBYztJQUNkLGVBQWU7SUFDZixRQUFRO0lBQ1IsU0FBUztJQUNULFlBQVk7Q0FDYixDQUFDO0FBRUYsK0VBQStFO0FBQy9FLGNBQWM7QUFDZCwrRUFBK0U7QUFFL0U7O0dBRUc7QUFDSCxTQUFnQixhQUFhLENBQUMsS0FBdUM7SUFDbkUsSUFBSSxDQUFDO1FBQ0gsSUFBSSxRQUF1QixDQUFDO1FBRTVCLG1CQUFtQjtRQUNuQixJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQzlCLElBQUksQ0FBQztnQkFDSCxRQUFRLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQWtCLENBQUM7WUFDaEQsQ0FBQztZQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7Z0JBQ2YsT0FBTztvQkFDTCxPQUFPLEVBQUUsS0FBSztvQkFDZCxLQUFLLEVBQUUsa0NBQWtDLEtBQUssWUFBWSxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsRUFBRTtpQkFDbEcsQ0FBQztZQUNKLENBQUM7UUFDSCxDQUFDO2FBQU0sQ0FBQztZQUNOLFFBQVEsR0FBRyxLQUFzQixDQUFDO1FBQ3BDLENBQUM7UUFFRCxlQUFlO1FBQ2YsTUFBTSxVQUFVLEdBQUcsaUJBQWlCLENBQUMsUUFBUSxDQUFDLENBQUM7UUFFL0MsT0FBTztZQUNMLE9BQU8sRUFBRSxJQUFJO1lBQ2IsUUFBUSxFQUFFLFVBQVU7WUFDcEIsUUFBUSxFQUFFLEVBQUU7U0FDYixDQUFDO0lBRUosQ0FBQztJQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7UUFDZixPQUFPO1lBQ0wsT0FBTyxFQUFFLEtBQUs7WUFDZCxLQUFLLEVBQUUseUJBQXlCLEtBQUssWUFBWSxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsRUFBRTtTQUN6RixDQUFDO0lBQ0osQ0FBQztBQUNILENBQUM7QUFFRDs7R0FFRztBQUNILFNBQWdCLGdCQUFnQixDQUFDLFFBQXVCO0lBQ3RELE1BQU0sTUFBTSxHQUFhLEVBQUUsQ0FBQztJQUM1QixNQUFNLFFBQVEsR0FBYSxFQUFFLENBQUM7SUFFOUIsVUFBVTtJQUNWLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxJQUFJLE9BQU8sUUFBUSxDQUFDLElBQUksS0FBSyxRQUFRLEVBQUUsQ0FBQztRQUN4RCxNQUFNLENBQUMsSUFBSSxDQUFDLGtEQUFrRCxDQUFDLENBQUM7SUFDbEUsQ0FBQztTQUFNLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztRQUM1QyxNQUFNLENBQUMsSUFBSSxDQUFDLHdCQUF3QixRQUFRLENBQUMsSUFBSSxtREFBbUQsQ0FBQyxDQUFDO0lBQ3hHLENBQUM7SUFFRCxhQUFhO0lBQ2IsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLElBQUksT0FBTyxRQUFRLENBQUMsT0FBTyxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBQzlELE1BQU0sQ0FBQyxJQUFJLENBQUMscURBQXFELENBQUMsQ0FBQztJQUNyRSxDQUFDO1NBQU0sSUFBSSxDQUFDLG1CQUFtQixDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1FBQ2xELE1BQU0sQ0FBQyxJQUFJLENBQUMsMkJBQTJCLFFBQVEsQ0FBQyxPQUFPLDRDQUE0QyxDQUFDLENBQUM7SUFDdkcsQ0FBQztJQUVELGdCQUFnQjtJQUNoQixJQUFJLFFBQVEsQ0FBQyxVQUFVLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUM7UUFDN0UsTUFBTSxDQUFDLElBQUksQ0FBQyx3QkFBd0IsUUFBUSxDQUFDLFVBQVUsc0JBQXNCLGtCQUFrQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDaEgsQ0FBQztJQUVELGtCQUFrQjtJQUNsQixJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQztRQUMxQyxNQUFNLENBQUMsSUFBSSxDQUFDLG1EQUFtRCxDQUFDLENBQUM7SUFDbkUsQ0FBQztTQUFNLENBQUM7UUFDTixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsUUFBUSxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUN0RCxNQUFNLEdBQUcsR0FBRyxRQUFRLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3JDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLFdBQVcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDL0MsTUFBTSxDQUFDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyx3Q0FBd0MsQ0FBQyxDQUFDO1lBQ2hGLENBQUM7aUJBQU0sSUFBSSxDQUFDLHNCQUFzQixDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztnQkFDdEQsTUFBTSxDQUFDLElBQUksQ0FBQyw2QkFBNkIsR0FBRyxDQUFDLElBQUksc0JBQXNCLHNCQUFzQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDOUcsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0lBRUQsV0FBVztJQUNYLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO1FBQ25DLE1BQU0sQ0FBQyxJQUFJLENBQUMsNENBQTRDLENBQUMsQ0FBQztJQUM1RCxDQUFDO1NBQU0sQ0FBQztRQUNOLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1lBQy9DLE1BQU0sSUFBSSxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDL0IsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO2dCQUN6RCxNQUFNLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLCtDQUErQyxDQUFDLENBQUM7WUFDakYsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0lBRUQsa0JBQWtCO0lBQ2xCLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDO1FBQzFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsbURBQW1ELENBQUMsQ0FBQztJQUNuRSxDQUFDO1NBQU0sQ0FBQztRQUNOLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxRQUFRLENBQUMsWUFBWSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1lBQ3RELE1BQU0sR0FBRyxHQUFHLFFBQVEsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDckMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQzlCLE1BQU0sQ0FBQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsNkJBQTZCLENBQUMsQ0FBQztZQUNyRSxDQUFDO1FBQ0gsQ0FBQztJQUNILENBQUM7SUFFRCxtQkFBbUI7SUFDbkIsSUFBSSxRQUFRLENBQUMsYUFBYSxFQUFFLENBQUM7UUFDM0IsSUFBSSxRQUFRLENBQUMsYUFBYSxDQUFDLGtCQUFrQixJQUFJLENBQUMsbUJBQW1CLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFLENBQUM7WUFDakgsUUFBUSxDQUFDLElBQUksQ0FBQyxnQ0FBZ0MsUUFBUSxDQUFDLGFBQWEsQ0FBQyxrQkFBa0IsR0FBRyxDQUFDLENBQUM7UUFDOUYsQ0FBQztRQUNELElBQUksUUFBUSxDQUFDLGFBQWEsQ0FBQyxrQkFBa0IsSUFBSSxDQUFDLG1CQUFtQixDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsa0JBQWtCLENBQUMsRUFBRSxDQUFDO1lBQ2pILFFBQVEsQ0FBQyxJQUFJLENBQUMsZ0NBQWdDLFFBQVEsQ0FBQyxhQUFhLENBQUMsa0JBQWtCLEdBQUcsQ0FBQyxDQUFDO1FBQzlGLENBQUM7SUFDSCxDQUFDO0lBRUQsZ0JBQWdCO0lBQ2hCLElBQUksUUFBUSxDQUFDLFVBQVUsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUM7UUFDL0QsTUFBTSxDQUFDLElBQUksQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDO0lBQzdDLENBQUM7SUFFRCxPQUFPO1FBQ0wsS0FBSyxFQUFFLE1BQU0sQ0FBQyxNQUFNLEtBQUssQ0FBQztRQUMxQixNQUFNO1FBQ04sUUFBUTtLQUNULENBQUM7QUFDSixDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFnQixpQkFBaUIsQ0FBQyxRQUF1QjtJQUN2RCxNQUFNLFVBQVUsR0FBa0I7UUFDaEMsR0FBRyxRQUFRO1FBQ1gsV0FBVztRQUNYLFlBQVksRUFBRSxRQUFRLENBQUMsWUFBWSxJQUFJLEVBQUU7UUFDekMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxLQUFLLElBQUksRUFBRTtRQUMzQixZQUFZLEVBQUUsUUFBUSxDQUFDLFlBQVksSUFBSSxFQUFFO1FBQ3pDLFVBQVUsRUFBRSxRQUFRLENBQUMsVUFBVSxJQUFJLEVBQUU7UUFDckMsV0FBVztRQUNYLFVBQVUsRUFBRSxRQUFRLENBQUMsVUFBVSxJQUFJLFdBQVc7UUFDOUMsUUFBUTtRQUNSLFlBQVksRUFBRSxRQUFRLENBQUMsWUFBWSxFQUFFLEdBQUcsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLEVBQUU7UUFDbkUsUUFBUTtRQUNSLEtBQUssRUFBRSxRQUFRLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsSUFBSSxFQUFFO1FBQy9DLFFBQVE7UUFDUixZQUFZLEVBQUUsUUFBUSxDQUFDLFlBQVksRUFBRSxHQUFHLENBQUMsbUJBQW1CLENBQUMsSUFBSSxFQUFFO0tBQ3BFLENBQUM7SUFFRixTQUFTO0lBQ1QsSUFBSSxRQUFRLENBQUMsYUFBYSxFQUFFLENBQUM7UUFDM0IsVUFBVSxDQUFDLGFBQWEsR0FBRyxzQkFBc0IsQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLENBQUM7SUFDNUUsQ0FBQztJQUVELE9BQU8sVUFBVSxDQUFDO0FBQ3BCLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsbUJBQW1CLENBQUMsVUFBMkI7SUFDdEQsT0FBTztRQUNMLElBQUksRUFBRSxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRTtRQUM1QixXQUFXLEVBQUUsVUFBVSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUU7UUFDMUMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxJQUFJO1FBQ3JCLFdBQVcsRUFBRSxVQUFVLENBQUMsV0FBVztRQUNuQyxZQUFZLEVBQUUsVUFBVSxDQUFDLFlBQVk7S0FDdEMsQ0FBQztBQUNKLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsYUFBYSxDQUFDLElBQWU7SUFDcEMsT0FBTztRQUNMLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRTtRQUN0QixXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUU7UUFDcEMsV0FBVyxFQUFFLElBQUksQ0FBQyxXQUFXO1FBQzdCLFlBQVksRUFBRSxJQUFJLENBQUMsWUFBWTtRQUMvQixnQkFBZ0IsRUFBRSxJQUFJLENBQUMsZ0JBQWdCLElBQUksS0FBSztRQUNoRCxTQUFTLEVBQUUsSUFBSSxDQUFDLFNBQVMsSUFBSSxRQUFRO0tBQ3RDLENBQUM7QUFDSixDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLG1CQUFtQixDQUFDLFVBQTJCO0lBQ3RELE9BQU87UUFDTCxJQUFJLEVBQUUsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUU7UUFDNUIsT0FBTyxFQUFFLFVBQVUsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFO1FBQ2xDLFFBQVEsRUFBRSxVQUFVLENBQUMsUUFBUSxJQUFJLElBQUk7UUFDckMsWUFBWSxFQUFFLFVBQVUsQ0FBQyxZQUFZO0tBQ3RDLENBQUM7QUFDSixDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLHNCQUFzQixDQUFDLGFBQWlDO0lBQy9ELE9BQU87UUFDTCxHQUFHLGFBQWE7UUFDaEIsY0FBYyxFQUFFLGFBQWEsQ0FBQyxjQUFjLElBQUksRUFBRTtRQUNsRCxjQUFjLEVBQUUsYUFBYSxDQUFDLGNBQWMsSUFBSSxFQUFFO1FBQ2xELGtCQUFrQixFQUFFLGFBQWEsQ0FBQyxrQkFBa0IsSUFBSSxFQUFFO0tBQzNELENBQUM7QUFDSixDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFnQixhQUFhLENBQUMsSUFBWSxFQUFFLE9BQWU7SUFDekQsT0FBTyxHQUFHLElBQUksSUFBSSxPQUFPLEVBQUUsQ0FBQztBQUM5QixDQUFDO0FBRUQsK0VBQStFO0FBQy9FLE9BQU87QUFDUCwrRUFBK0U7QUFFL0U7O0dBRUc7QUFDSCxTQUFnQixnQkFBZ0IsQ0FBQyxJQUFZO0lBQzNDLGtCQUFrQjtJQUNsQixPQUFPLGdCQUFnQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNyQyxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFnQixtQkFBbUIsQ0FBQyxPQUFlO0lBQ2pELDhCQUE4QjtJQUM5QixPQUFPLGdCQUFnQixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUN4QyxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFnQixpQkFBaUIsQ0FBQyxLQUFhO0lBQzdDLE9BQU8sa0JBQWtCLENBQUMsUUFBUSxDQUFDLEtBQXdCLENBQUMsQ0FBQztBQUMvRCxDQUFDO0FBRUQsK0VBQStFO0FBQy9FLE9BQU87QUFDUCwrRUFBK0U7QUFFL0U7O0dBRUc7QUFDSCxTQUFnQix3QkFBd0IsQ0FDdEMsS0FBdUM7SUFFdkMsTUFBTSxXQUFXLEdBQUcsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBRXpDLElBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQ2xELE9BQU8sV0FBVyxDQUFDO0lBQ3JCLENBQUM7SUFFRCxNQUFNLFVBQVUsR0FBRyxnQkFBZ0IsQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUM7SUFFMUQsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUN0QixPQUFPO1lBQ0wsT0FBTyxFQUFFLEtBQUs7WUFDZCxLQUFLLEVBQUUsK0JBQStCLFVBQVUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ3BFLFFBQVEsRUFBRSxVQUFVLENBQUMsUUFBUTtTQUM5QixDQUFDO0lBQ0osQ0FBQztJQUVELE9BQU87UUFDTCxHQUFHLFdBQVc7UUFDZCxVQUFVO0tBQ1gsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFNraWxsIE1hbmlmZXN0IC0gU2tpbGwgTWFuaWZlc3Qg5a6a5LmJ5LiO6Kej5p6QXG4gKiBcbiAqIOiBjOi0o++8mlxuICogMS4g5a6a5LmJ5qCH5YeGIG1hbmlmZXN0IOe7k+aehFxuICogMi4g6Kej5p6QIEpTT04vWUFNTCBtYW5pZmVzdFxuICogMy4g5qCh6aqM5b+F5aGr5a2X5q61XG4gKiA0LiDlgZrpu5jorqTlgLzloavlhYXkuI7op4TojIPljJZcbiAqIDUuIOi+k+WHuuagh+WHhuWMliBTa2lsbE1hbmlmZXN0XG4gKiBcbiAqIEB2ZXJzaW9uIHYwLjEuMFxuICogQGRhdGUgMjAyNi0wNC0wM1xuICovXG5cbmltcG9ydCB0eXBlIHtcbiAgU2tpbGxNYW5pZmVzdCxcbiAgU2tpbGxDYXBhYmlsaXR5LFxuICBTa2lsbFRvb2wsXG4gIFNraWxsRGVwZW5kZW5jeSxcbiAgU2tpbGxUcnVzdExldmVsLFxuICBBZ2VudENvbXBhdGliaWxpdHksXG59IGZyb20gJy4vdHlwZXMnO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDnsbvlnovlrprkuYlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiBNYW5pZmVzdCDop6PmnpDnu5PmnpxcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBNYW5pZmVzdFBhcnNlUmVzdWx0IHtcbiAgLyoqIOaYr+WQpuaIkOWKnyAqL1xuICBzdWNjZXNzOiBib29sZWFuO1xuICBcbiAgLyoqIE1hbmlmZXN077yI5aaC5p6c6Kej5p6Q5oiQ5Yqf77yJICovXG4gIG1hbmlmZXN0PzogU2tpbGxNYW5pZmVzdDtcbiAgXG4gIC8qKiDplJnor6/kv6Hmga/vvIjlpoLmnpzop6PmnpDlpLHotKXvvIkgKi9cbiAgZXJyb3I/OiBzdHJpbmc7XG4gIFxuICAvKiog6K2m5ZGK5L+h5oGvICovXG4gIHdhcm5pbmdzPzogc3RyaW5nW107XG59XG5cbi8qKlxuICogTWFuaWZlc3Qg6aqM6K+B57uT5p6cXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgTWFuaWZlc3RWYWxpZGF0aW9uUmVzdWx0IHtcbiAgLyoqIOaYr+WQpuacieaViCAqL1xuICB2YWxpZDogYm9vbGVhbjtcbiAgXG4gIC8qKiDplJnor6/liJfooaggKi9cbiAgZXJyb3JzOiBzdHJpbmdbXTtcbiAgXG4gIC8qKiDorablkYrliJfooaggKi9cbiAgd2FybmluZ3M6IHN0cmluZ1tdO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDluLjph4/lrprkuYlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDmnInmlYjnmoTkv6Hku7vnuqfliKtcbiAqL1xuY29uc3QgVkFMSURfVFJVU1RfTEVWRUxTOiBTa2lsbFRydXN0TGV2ZWxbXSA9IFtcbiAgJ2J1aWx0aW4nLFxuICAndmVyaWZpZWQnLFxuICAnd29ya3NwYWNlJyxcbiAgJ2V4dGVybmFsJyxcbiAgJ3VudHJ1c3RlZCcsXG5dO1xuXG4vKipcbiAqIOacieaViOeahOiDveWKm+exu+Wei1xuICovXG5jb25zdCBWQUxJRF9DQVBBQklMSVRZX1RZUEVTOiBTa2lsbENhcGFiaWxpdHlUeXBlW10gPSBbXG4gICd0b29sX3J1bnRpbWUnLFxuICAnY29kZV9pbnRlbCcsXG4gICdtY3BfaW50ZWdyYXRpb24nLFxuICAndmVyaWZpY2F0aW9uJyxcbiAgJ3JlcG9fYW5hbHlzaXMnLFxuICAncmV2aWV3JyxcbiAgJ3JlbGVhc2UnLFxuICAnYXV0b21hdGlvbicsXG5dO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBNYW5pZmVzdCDop6PmnpBcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDop6PmnpAgTWFuaWZlc3RcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlTWFuaWZlc3QoaW5wdXQ6IHN0cmluZyB8IFJlY29yZDxzdHJpbmcsIHVua25vd24+KTogTWFuaWZlc3RQYXJzZVJlc3VsdCB7XG4gIHRyeSB7XG4gICAgbGV0IG1hbmlmZXN0OiBTa2lsbE1hbmlmZXN0O1xuICAgIFxuICAgIC8vIOWmguaenOaYr+Wtl+espuS4su+8jOWwneivleino+aekCBKU09OXG4gICAgaWYgKHR5cGVvZiBpbnB1dCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIG1hbmlmZXN0ID0gSlNPTi5wYXJzZShpbnB1dCkgYXMgU2tpbGxNYW5pZmVzdDtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgZXJyb3I6IGBGYWlsZWQgdG8gcGFyc2UgbWFuaWZlc3QgSlNPTjogJHtlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcil9YCxcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgbWFuaWZlc3QgPSBpbnB1dCBhcyBTa2lsbE1hbmlmZXN0O1xuICAgIH1cbiAgICBcbiAgICAvLyDop4TojIPljJYgTWFuaWZlc3RcbiAgICBjb25zdCBub3JtYWxpemVkID0gbm9ybWFsaXplTWFuaWZlc3QobWFuaWZlc3QpO1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgbWFuaWZlc3Q6IG5vcm1hbGl6ZWQsXG4gICAgICB3YXJuaW5nczogW10sXG4gICAgfTtcbiAgICBcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICBlcnJvcjogYE1hbmlmZXN0IHBhcnNlIGVycm9yOiAke2Vycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKX1gLFxuICAgIH07XG4gIH1cbn1cblxuLyoqXG4gKiDpqozor4EgTWFuaWZlc3RcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHZhbGlkYXRlTWFuaWZlc3QobWFuaWZlc3Q6IFNraWxsTWFuaWZlc3QpOiBNYW5pZmVzdFZhbGlkYXRpb25SZXN1bHQge1xuICBjb25zdCBlcnJvcnM6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IHdhcm5pbmdzOiBzdHJpbmdbXSA9IFtdO1xuICBcbiAgLy8g5qCh6aqMIG5hbWVcbiAgaWYgKCFtYW5pZmVzdC5uYW1lIHx8IHR5cGVvZiBtYW5pZmVzdC5uYW1lICE9PSAnc3RyaW5nJykge1xuICAgIGVycm9ycy5wdXNoKCdNYW5pZmVzdCBtdXN0IGhhdmUgYSB2YWxpZCBcIm5hbWVcIiBmaWVsZCAoc3RyaW5nKScpO1xuICB9IGVsc2UgaWYgKCFpc1ZhbGlkU2tpbGxOYW1lKG1hbmlmZXN0Lm5hbWUpKSB7XG4gICAgZXJyb3JzLnB1c2goYEludmFsaWQgc2tpbGwgbmFtZTogXCIke21hbmlmZXN0Lm5hbWV9XCIuIE11c3QgYmUgYWxwaGFudW1lcmljIHdpdGggaHlwaGVucy91bmRlcnNjb3Jlcy5gKTtcbiAgfVxuICBcbiAgLy8g5qCh6aqMIHZlcnNpb25cbiAgaWYgKCFtYW5pZmVzdC52ZXJzaW9uIHx8IHR5cGVvZiBtYW5pZmVzdC52ZXJzaW9uICE9PSAnc3RyaW5nJykge1xuICAgIGVycm9ycy5wdXNoKCdNYW5pZmVzdCBtdXN0IGhhdmUgYSB2YWxpZCBcInZlcnNpb25cIiBmaWVsZCAoc3RyaW5nKScpO1xuICB9IGVsc2UgaWYgKCFpc1ZhbGlkU2tpbGxWZXJzaW9uKG1hbmlmZXN0LnZlcnNpb24pKSB7XG4gICAgZXJyb3JzLnB1c2goYEludmFsaWQgc2tpbGwgdmVyc2lvbjogXCIke21hbmlmZXN0LnZlcnNpb259XCIuIE11c3QgYmUgc2VtYW50aWMgdmVyc2lvbiAoZS5nLiwgMS4wLjApLmApO1xuICB9XG4gIFxuICAvLyDmoKHpqowgdHJ1c3RMZXZlbFxuICBpZiAobWFuaWZlc3QudHJ1c3RMZXZlbCAmJiAhVkFMSURfVFJVU1RfTEVWRUxTLmluY2x1ZGVzKG1hbmlmZXN0LnRydXN0TGV2ZWwpKSB7XG4gICAgZXJyb3JzLnB1c2goYEludmFsaWQgdHJ1c3RMZXZlbDogXCIke21hbmlmZXN0LnRydXN0TGV2ZWx9XCIuIE11c3QgYmUgb25lIG9mOiAke1ZBTElEX1RSVVNUX0xFVkVMUy5qb2luKCcsICcpfWApO1xuICB9XG4gIFxuICAvLyDmoKHpqowgY2FwYWJpbGl0aWVzXG4gIGlmICghQXJyYXkuaXNBcnJheShtYW5pZmVzdC5jYXBhYmlsaXRpZXMpKSB7XG4gICAgZXJyb3JzLnB1c2goJ01hbmlmZXN0IG11c3QgaGF2ZSBhIFwiY2FwYWJpbGl0aWVzXCIgZmllbGQgKGFycmF5KScpO1xuICB9IGVsc2Uge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWFuaWZlc3QuY2FwYWJpbGl0aWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBjYXAgPSBtYW5pZmVzdC5jYXBhYmlsaXRpZXNbaV07XG4gICAgICBpZiAoIWNhcC5uYW1lIHx8ICFjYXAuZGVzY3JpcHRpb24gfHwgIWNhcC50eXBlKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKGBDYXBhYmlsaXR5IGF0IGluZGV4ICR7aX0gbXVzdCBoYXZlIG5hbWUsIGRlc2NyaXB0aW9uLCBhbmQgdHlwZWApO1xuICAgICAgfSBlbHNlIGlmICghVkFMSURfQ0FQQUJJTElUWV9UWVBFUy5pbmNsdWRlcyhjYXAudHlwZSkpIHtcbiAgICAgICAgZXJyb3JzLnB1c2goYEludmFsaWQgY2FwYWJpbGl0eSB0eXBlOiBcIiR7Y2FwLnR5cGV9XCIuIE11c3QgYmUgb25lIG9mOiAke1ZBTElEX0NBUEFCSUxJVFlfVFlQRVMuam9pbignLCAnKX1gKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgXG4gIC8vIOagoemqjCB0b29sc1xuICBpZiAoIUFycmF5LmlzQXJyYXkobWFuaWZlc3QudG9vbHMpKSB7XG4gICAgZXJyb3JzLnB1c2goJ01hbmlmZXN0IG11c3QgaGF2ZSBhIFwidG9vbHNcIiBmaWVsZCAoYXJyYXkpJyk7XG4gIH0gZWxzZSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtYW5pZmVzdC50b29scy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgdG9vbCA9IG1hbmlmZXN0LnRvb2xzW2ldO1xuICAgICAgaWYgKCF0b29sLm5hbWUgfHwgIXRvb2wuZGVzY3JpcHRpb24gfHwgIXRvb2wuaW5wdXRTY2hlbWEpIHtcbiAgICAgICAgZXJyb3JzLnB1c2goYFRvb2wgYXQgaW5kZXggJHtpfSBtdXN0IGhhdmUgbmFtZSwgZGVzY3JpcHRpb24sIGFuZCBpbnB1dFNjaGVtYWApO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBcbiAgLy8g5qCh6aqMIGRlcGVuZGVuY2llc1xuICBpZiAoIUFycmF5LmlzQXJyYXkobWFuaWZlc3QuZGVwZW5kZW5jaWVzKSkge1xuICAgIGVycm9ycy5wdXNoKCdNYW5pZmVzdCBtdXN0IGhhdmUgYSBcImRlcGVuZGVuY2llc1wiIGZpZWxkIChhcnJheSknKTtcbiAgfSBlbHNlIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1hbmlmZXN0LmRlcGVuZGVuY2llcy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgZGVwID0gbWFuaWZlc3QuZGVwZW5kZW5jaWVzW2ldO1xuICAgICAgaWYgKCFkZXAubmFtZSB8fCAhZGVwLnZlcnNpb24pIHtcbiAgICAgICAgZXJyb3JzLnB1c2goYERlcGVuZGVuY3kgYXQgaW5kZXggJHtpfSBtdXN0IGhhdmUgbmFtZSBhbmQgdmVyc2lvbmApO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBcbiAgLy8g5qCh6aqMIGNvbXBhdGliaWxpdHlcbiAgaWYgKG1hbmlmZXN0LmNvbXBhdGliaWxpdHkpIHtcbiAgICBpZiAobWFuaWZlc3QuY29tcGF0aWJpbGl0eS5taW5PcGVuQ2xhd1ZlcnNpb24gJiYgIWlzVmFsaWRTa2lsbFZlcnNpb24obWFuaWZlc3QuY29tcGF0aWJpbGl0eS5taW5PcGVuQ2xhd1ZlcnNpb24pKSB7XG4gICAgICB3YXJuaW5ncy5wdXNoKGBJbnZhbGlkIG1pbk9wZW5DbGF3VmVyc2lvbjogXCIke21hbmlmZXN0LmNvbXBhdGliaWxpdHkubWluT3BlbkNsYXdWZXJzaW9ufVwiYCk7XG4gICAgfVxuICAgIGlmIChtYW5pZmVzdC5jb21wYXRpYmlsaXR5Lm1heE9wZW5DbGF3VmVyc2lvbiAmJiAhaXNWYWxpZFNraWxsVmVyc2lvbihtYW5pZmVzdC5jb21wYXRpYmlsaXR5Lm1heE9wZW5DbGF3VmVyc2lvbikpIHtcbiAgICAgIHdhcm5pbmdzLnB1c2goYEludmFsaWQgbWF4T3BlbkNsYXdWZXJzaW9uOiBcIiR7bWFuaWZlc3QuY29tcGF0aWJpbGl0eS5tYXhPcGVuQ2xhd1ZlcnNpb259XCJgKTtcbiAgICB9XG4gIH1cbiAgXG4gIC8vIOagoemqjCBtY3BTZXJ2ZXJzXG4gIGlmIChtYW5pZmVzdC5tY3BTZXJ2ZXJzICYmICFBcnJheS5pc0FycmF5KG1hbmlmZXN0Lm1jcFNlcnZlcnMpKSB7XG4gICAgZXJyb3JzLnB1c2goJ21jcFNlcnZlcnMgbXVzdCBiZSBhbiBhcnJheScpO1xuICB9XG4gIFxuICByZXR1cm4ge1xuICAgIHZhbGlkOiBlcnJvcnMubGVuZ3RoID09PSAwLFxuICAgIGVycm9ycyxcbiAgICB3YXJuaW5ncyxcbiAgfTtcbn1cblxuLyoqXG4gKiDop4TojIPljJYgTWFuaWZlc3RcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG5vcm1hbGl6ZU1hbmlmZXN0KG1hbmlmZXN0OiBTa2lsbE1hbmlmZXN0KTogU2tpbGxNYW5pZmVzdCB7XG4gIGNvbnN0IG5vcm1hbGl6ZWQ6IFNraWxsTWFuaWZlc3QgPSB7XG4gICAgLi4ubWFuaWZlc3QsXG4gICAgLy8g56Gu5L+d5pWw57uE5a2X5q615a2Y5ZyoXG4gICAgY2FwYWJpbGl0aWVzOiBtYW5pZmVzdC5jYXBhYmlsaXRpZXMgfHwgW10sXG4gICAgdG9vbHM6IG1hbmlmZXN0LnRvb2xzIHx8IFtdLFxuICAgIGRlcGVuZGVuY2llczogbWFuaWZlc3QuZGVwZW5kZW5jaWVzIHx8IFtdLFxuICAgIG1jcFNlcnZlcnM6IG1hbmlmZXN0Lm1jcFNlcnZlcnMgfHwgW10sXG4gICAgLy8g6K6+572u6buY6K6k5L+h5Lu757qn5YirXG4gICAgdHJ1c3RMZXZlbDogbWFuaWZlc3QudHJ1c3RMZXZlbCB8fCAnd29ya3NwYWNlJyxcbiAgICAvLyDop4TojIPljJbog73liptcbiAgICBjYXBhYmlsaXRpZXM6IG1hbmlmZXN0LmNhcGFiaWxpdGllcz8ubWFwKG5vcm1hbGl6ZUNhcGFiaWxpdHkpIHx8IFtdLFxuICAgIC8vIOinhOiMg+WMluW3peWFt1xuICAgIHRvb2xzOiBtYW5pZmVzdC50b29scz8ubWFwKG5vcm1hbGl6ZVRvb2wpIHx8IFtdLFxuICAgIC8vIOinhOiMg+WMluS+nei1llxuICAgIGRlcGVuZGVuY2llczogbWFuaWZlc3QuZGVwZW5kZW5jaWVzPy5tYXAobm9ybWFsaXplRGVwZW5kZW5jeSkgfHwgW10sXG4gIH07XG4gIFxuICAvLyDop4TojIPljJblhbzlrrnmgKdcbiAgaWYgKG1hbmlmZXN0LmNvbXBhdGliaWxpdHkpIHtcbiAgICBub3JtYWxpemVkLmNvbXBhdGliaWxpdHkgPSBub3JtYWxpemVDb21wYXRpYmlsaXR5KG1hbmlmZXN0LmNvbXBhdGliaWxpdHkpO1xuICB9XG4gIFxuICByZXR1cm4gbm9ybWFsaXplZDtcbn1cblxuLyoqXG4gKiDop4TojIPljJbog73liptcbiAqL1xuZnVuY3Rpb24gbm9ybWFsaXplQ2FwYWJpbGl0eShjYXBhYmlsaXR5OiBTa2lsbENhcGFiaWxpdHkpOiBTa2lsbENhcGFiaWxpdHkge1xuICByZXR1cm4ge1xuICAgIG5hbWU6IGNhcGFiaWxpdHkubmFtZS50cmltKCksXG4gICAgZGVzY3JpcHRpb246IGNhcGFiaWxpdHkuZGVzY3JpcHRpb24udHJpbSgpLFxuICAgIHR5cGU6IGNhcGFiaWxpdHkudHlwZSxcbiAgICBpbnB1dFNjaGVtYTogY2FwYWJpbGl0eS5pbnB1dFNjaGVtYSxcbiAgICBvdXRwdXRTY2hlbWE6IGNhcGFiaWxpdHkub3V0cHV0U2NoZW1hLFxuICB9O1xufVxuXG4vKipcbiAqIOinhOiMg+WMluW3peWFt1xuICovXG5mdW5jdGlvbiBub3JtYWxpemVUb29sKHRvb2w6IFNraWxsVG9vbCk6IFNraWxsVG9vbCB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogdG9vbC5uYW1lLnRyaW0oKSxcbiAgICBkZXNjcmlwdGlvbjogdG9vbC5kZXNjcmlwdGlvbi50cmltKCksXG4gICAgaW5wdXRTY2hlbWE6IHRvb2wuaW5wdXRTY2hlbWEsXG4gICAgb3V0cHV0U2NoZW1hOiB0b29sLm91dHB1dFNjaGVtYSxcbiAgICByZXF1aXJlc0FwcHJvdmFsOiB0b29sLnJlcXVpcmVzQXBwcm92YWwgPz8gZmFsc2UsXG4gICAgcmlza0xldmVsOiB0b29sLnJpc2tMZXZlbCB8fCAnbWVkaXVtJyxcbiAgfTtcbn1cblxuLyoqXG4gKiDop4TojIPljJbkvp3otZZcbiAqL1xuZnVuY3Rpb24gbm9ybWFsaXplRGVwZW5kZW5jeShkZXBlbmRlbmN5OiBTa2lsbERlcGVuZGVuY3kpOiBTa2lsbERlcGVuZGVuY3kge1xuICByZXR1cm4ge1xuICAgIG5hbWU6IGRlcGVuZGVuY3kubmFtZS50cmltKCksXG4gICAgdmVyc2lvbjogZGVwZW5kZW5jeS52ZXJzaW9uLnRyaW0oKSxcbiAgICByZXF1aXJlZDogZGVwZW5kZW5jeS5yZXF1aXJlZCA/PyB0cnVlLFxuICAgIGFsdGVybmF0aXZlczogZGVwZW5kZW5jeS5hbHRlcm5hdGl2ZXMsXG4gIH07XG59XG5cbi8qKlxuICog6KeE6IyD5YyW5YW85a655oCnXG4gKi9cbmZ1bmN0aW9uIG5vcm1hbGl6ZUNvbXBhdGliaWxpdHkoY29tcGF0aWJpbGl0eTogQWdlbnRDb21wYXRpYmlsaXR5KTogQWdlbnRDb21wYXRpYmlsaXR5IHtcbiAgcmV0dXJuIHtcbiAgICAuLi5jb21wYXRpYmlsaXR5LFxuICAgIHJlcXVpcmVkQWdlbnRzOiBjb21wYXRpYmlsaXR5LnJlcXVpcmVkQWdlbnRzIHx8IFtdLFxuICAgIG9wdGlvbmFsQWdlbnRzOiBjb21wYXRpYmlsaXR5Lm9wdGlvbmFsQWdlbnRzIHx8IFtdLFxuICAgIGluY29tcGF0aWJsZUFnZW50czogY29tcGF0aWJpbGl0eS5pbmNvbXBhdGlibGVBZ2VudHMgfHwgW10sXG4gIH07XG59XG5cbi8qKlxuICog6I635Y+WIE1hbmlmZXN0IElEXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRNYW5pZmVzdElkKG5hbWU6IHN0cmluZywgdmVyc2lvbjogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGAke25hbWV9QCR7dmVyc2lvbn1gO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDlt6Xlhbflh73mlbBcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDmo4Dmn6UgU2tpbGwg5ZCN56ew5piv5ZCm5pyJ5pWIXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1ZhbGlkU2tpbGxOYW1lKG5hbWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAvLyDlhYHorrjlrZfmr43jgIHmlbDlrZfjgIHov57lrZfnrKbjgIHkuIvliJLnur9cbiAgcmV0dXJuIC9eW2EtejAtOV8tXSskL2kudGVzdChuYW1lKTtcbn1cblxuLyoqXG4gKiDmo4Dmn6XniYjmnKzmmK/lkKbmnInmlYjvvIjnroDljZXor63kuYnljJbniYjmnKzmo4Dmn6XvvIlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzVmFsaWRTa2lsbFZlcnNpb24odmVyc2lvbjogc3RyaW5nKTogYm9vbGVhbiB7XG4gIC8vIOeugOWNleivreS5ieWMlueJiOacrOajgOafpe+8mm1ham9yLm1pbm9yLnBhdGNoXG4gIHJldHVybiAvXlxcZCtcXC5cXGQrXFwuXFxkKy8udGVzdCh2ZXJzaW9uKTtcbn1cblxuLyoqXG4gKiDmo4Dmn6Xkv6Hku7vnuqfliKvmmK/lkKbmnInmlYhcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzVmFsaWRUcnVzdExldmVsKGxldmVsOiBzdHJpbmcpOiBsZXZlbCBpcyBTa2lsbFRydXN0TGV2ZWwge1xuICByZXR1cm4gVkFMSURfVFJVU1RfTEVWRUxTLmluY2x1ZGVzKGxldmVsIGFzIFNraWxsVHJ1c3RMZXZlbCk7XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOS+v+aNt+WHveaVsFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIOino+aekOW5tumqjOivgSBNYW5pZmVzdFxuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VBbmRWYWxpZGF0ZU1hbmlmZXN0KFxuICBpbnB1dDogc3RyaW5nIHwgUmVjb3JkPHN0cmluZywgdW5rbm93bj5cbik6IE1hbmlmZXN0UGFyc2VSZXN1bHQgJiB7IHZhbGlkYXRpb24/OiBNYW5pZmVzdFZhbGlkYXRpb25SZXN1bHQgfSB7XG4gIGNvbnN0IHBhcnNlUmVzdWx0ID0gcGFyc2VNYW5pZmVzdChpbnB1dCk7XG4gIFxuICBpZiAoIXBhcnNlUmVzdWx0LnN1Y2Nlc3MgfHwgIXBhcnNlUmVzdWx0Lm1hbmlmZXN0KSB7XG4gICAgcmV0dXJuIHBhcnNlUmVzdWx0O1xuICB9XG4gIFxuICBjb25zdCB2YWxpZGF0aW9uID0gdmFsaWRhdGVNYW5pZmVzdChwYXJzZVJlc3VsdC5tYW5pZmVzdCk7XG4gIFxuICBpZiAoIXZhbGlkYXRpb24udmFsaWQpIHtcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICBlcnJvcjogYE1hbmlmZXN0IHZhbGlkYXRpb24gZmFpbGVkOiAke3ZhbGlkYXRpb24uZXJyb3JzLmpvaW4oJzsgJyl9YCxcbiAgICAgIHdhcm5pbmdzOiB2YWxpZGF0aW9uLndhcm5pbmdzLFxuICAgIH07XG4gIH1cbiAgXG4gIHJldHVybiB7XG4gICAgLi4ucGFyc2VSZXN1bHQsXG4gICAgdmFsaWRhdGlvbixcbiAgfTtcbn1cbiJdfQ==