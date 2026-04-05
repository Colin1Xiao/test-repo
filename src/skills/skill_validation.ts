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

import type {
  SkillPackageDescriptor,
  SkillValidationResult,
  SkillTrustSignal,
  SkillCompatibilityIssue,
  SkillSecurityWarning,
  SkillSourceDescriptor,
} from './types';
import { validateManifest } from './skill_manifest';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 验证器配置
 */
export interface ValidatorConfig {
  /** 运行时版本 */
  runtimeVersion?: string;
  
  /** 可用的 Agent 列表 */
  availableAgents?: string[];
  
  /** 严格模式 */
  strictMode?: boolean;
}

// ============================================================================
// Skill 验证器
// ============================================================================

export class SkillValidator {
  private config: Required<ValidatorConfig>;
  
  constructor(config: ValidatorConfig = {}) {
    this.config = {
      runtimeVersion: config.runtimeVersion ?? '2026.4.0',
      availableAgents: config.availableAgents ?? [],
      strictMode: config.strictMode ?? false,
    };
  }
  
  /**
   * 验证 Skill Package
   */
  async validateSkillPackage(pkg: SkillPackageDescriptor): Promise<SkillValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const trustSignals: SkillTrustSignal[] = [];
    const compatibilityIssues: SkillCompatibilityIssue[] = [];
    const securityWarnings: SkillSecurityWarning[] = [];
    
    // 1. 验证 manifest
    const manifestValidation = validateManifest(pkg.manifest);
    
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
  async validateSource(source: SkillSourceDescriptor): Promise<{
    valid: boolean;
    errors: string[];
    trustSignals: SkillTrustSignal[];
  }> {
    const errors: string[] = [];
    const trustSignals: SkillTrustSignal[] = [];
    
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
      } else {
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
  validateCompatibility(pkg: SkillPackageDescriptor): {
    valid: boolean;
    issues: SkillCompatibilityIssue[];
  } {
    const issues: SkillCompatibilityIssue[] = [];
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
      const versionCompare = this.compareVersions(
        this.config.runtimeVersion,
        compatibility.minOpenClawVersion
      );
      
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
      const versionCompare = this.compareVersions(
        this.config.runtimeVersion,
        compatibility.maxOpenClawVersion
      );
      
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
      const missingAgents = compatibility.requiredAgents.filter(
        agent => !this.config.availableAgents.includes(agent)
      );
      
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
      const conflictingAgents = compatibility.incompatibleAgents.filter(
        agent => this.config.availableAgents.includes(agent)
      );
      
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
  collectSecurityWarnings(pkg: SkillPackageDescriptor): SkillSecurityWarning[] {
    const warnings: SkillSecurityWarning[] = [];
    
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
  performStrictChecks(pkg: SkillPackageDescriptor): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
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
  async buildValidationReport(pkg: SkillPackageDescriptor): Promise<{
    packageId: string;
    result: SkillValidationResult;
    summary: {
      isValid: boolean;
      errorCount: number;
      warningCount: number;
      compatibilityIssueCount: number;
      securityWarningCount: number;
    };
  }> {
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
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    
    return 0;
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建 Skill 验证器
 */
export function createSkillValidator(config?: ValidatorConfig): SkillValidator {
  return new SkillValidator(config);
}

/**
 * 快速验证 Skill
 */
export async function validateSkill(
  pkg: SkillPackageDescriptor,
  config?: ValidatorConfig
): Promise<SkillValidationResult> {
  const validator = new SkillValidator(config);
  return await validator.validateSkillPackage(pkg);
}
