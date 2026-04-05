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

import type {
  SkillManifest,
  SkillCapability,
  SkillTool,
  SkillDependency,
  SkillTrustLevel,
  AgentCompatibility,
} from './types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * Manifest 解析结果
 */
export interface ManifestParseResult {
  /** 是否成功 */
  success: boolean;
  
  /** Manifest（如果解析成功） */
  manifest?: SkillManifest;
  
  /** 错误信息（如果解析失败） */
  error?: string;
  
  /** 警告信息 */
  warnings?: string[];
}

/**
 * Manifest 验证结果
 */
export interface ManifestValidationResult {
  /** 是否有效 */
  valid: boolean;
  
  /** 错误列表 */
  errors: string[];
  
  /** 警告列表 */
  warnings: string[];
}

// ============================================================================
// 常量定义
// ============================================================================

/**
 * 有效的信任级别
 */
const VALID_TRUST_LEVELS: SkillTrustLevel[] = [
  'builtin',
  'verified',
  'workspace',
  'external',
  'untrusted',
];

/**
 * 有效的能力类型
 */
const VALID_CAPABILITY_TYPES: SkillCapabilityType[] = [
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
export function parseManifest(input: string | Record<string, unknown>): ManifestParseResult {
  try {
    let manifest: SkillManifest;
    
    // 如果是字符串，尝试解析 JSON
    if (typeof input === 'string') {
      try {
        manifest = JSON.parse(input) as SkillManifest;
      } catch (error) {
        return {
          success: false,
          error: `Failed to parse manifest JSON: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    } else {
      manifest = input as SkillManifest;
    }
    
    // 规范化 Manifest
    const normalized = normalizeManifest(manifest);
    
    return {
      success: true,
      manifest: normalized,
      warnings: [],
    };
    
  } catch (error) {
    return {
      success: false,
      error: `Manifest parse error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * 验证 Manifest
 */
export function validateManifest(manifest: SkillManifest): ManifestValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // 校验 name
  if (!manifest.name || typeof manifest.name !== 'string') {
    errors.push('Manifest must have a valid "name" field (string)');
  } else if (!isValidSkillName(manifest.name)) {
    errors.push(`Invalid skill name: "${manifest.name}". Must be alphanumeric with hyphens/underscores.`);
  }
  
  // 校验 version
  if (!manifest.version || typeof manifest.version !== 'string') {
    errors.push('Manifest must have a valid "version" field (string)');
  } else if (!isValidSkillVersion(manifest.version)) {
    errors.push(`Invalid skill version: "${manifest.version}". Must be semantic version (e.g., 1.0.0).`);
  }
  
  // 校验 trustLevel
  if (manifest.trustLevel && !VALID_TRUST_LEVELS.includes(manifest.trustLevel)) {
    errors.push(`Invalid trustLevel: "${manifest.trustLevel}". Must be one of: ${VALID_TRUST_LEVELS.join(', ')}`);
  }
  
  // 校验 capabilities
  if (!Array.isArray(manifest.capabilities)) {
    errors.push('Manifest must have a "capabilities" field (array)');
  } else {
    for (let i = 0; i < manifest.capabilities.length; i++) {
      const cap = manifest.capabilities[i];
      if (!cap.name || !cap.description || !cap.type) {
        errors.push(`Capability at index ${i} must have name, description, and type`);
      } else if (!VALID_CAPABILITY_TYPES.includes(cap.type)) {
        errors.push(`Invalid capability type: "${cap.type}". Must be one of: ${VALID_CAPABILITY_TYPES.join(', ')}`);
      }
    }
  }
  
  // 校验 tools
  if (!Array.isArray(manifest.tools)) {
    errors.push('Manifest must have a "tools" field (array)');
  } else {
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
  } else {
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
export function normalizeManifest(manifest: SkillManifest): SkillManifest {
  const normalized: SkillManifest = {
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
function normalizeCapability(capability: SkillCapability): SkillCapability {
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
function normalizeTool(tool: SkillTool): SkillTool {
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
function normalizeDependency(dependency: SkillDependency): SkillDependency {
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
function normalizeCompatibility(compatibility: AgentCompatibility): AgentCompatibility {
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
export function getManifestId(name: string, version: string): string {
  return `${name}@${version}`;
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 检查 Skill 名称是否有效
 */
export function isValidSkillName(name: string): boolean {
  // 允许字母、数字、连字符、下划线
  return /^[a-z0-9_-]+$/i.test(name);
}

/**
 * 检查版本是否有效（简单语义化版本检查）
 */
export function isValidSkillVersion(version: string): boolean {
  // 简单语义化版本检查：major.minor.patch
  return /^\d+\.\d+\.\d+/.test(version);
}

/**
 * 检查信任级别是否有效
 */
export function isValidTrustLevel(level: string): level is SkillTrustLevel {
  return VALID_TRUST_LEVELS.includes(level as SkillTrustLevel);
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 解析并验证 Manifest
 */
export function parseAndValidateManifest(
  input: string | Record<string, unknown>
): ManifestParseResult & { validation?: ManifestValidationResult } {
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
