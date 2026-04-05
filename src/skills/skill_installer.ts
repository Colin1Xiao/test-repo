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

import type {
  SkillPackageDescriptor,
  SkillManifest,
  SkillInstallResult,
  SkillInstallOptions,
  SkillInstallPlan,
  SkillUninstallResult,
  SkillSourceType,
} from './types';
import { SkillRegistry } from './skill_registry';
import { SkillResolver } from './skill_resolver';
import { buildSkillPackage, isBuiltinSkill, updatePackageStatus } from './skill_package';
import { resolveSource, isBuiltinSourcePath } from './skill_source';
import { parseAndValidateManifest } from './skill_manifest';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 安装器配置
 */
export interface InstallerConfig {
  /** 是否允许卸载 builtin skill */
  allowBuiltinUninstall?: boolean;
  
  /** 是否强制卸载（即使被依赖） */
  allowForceUninstall?: boolean;
}

// ============================================================================
// Skill 安装器
// ============================================================================

export class SkillInstaller {
  private config: Required<InstallerConfig>;
  private registry: SkillRegistry;
  private resolver: SkillResolver;
  
  constructor(
    registry: SkillRegistry,
    resolver: SkillResolver,
    config: InstallerConfig = {}
  ) {
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
  async installSkill(
    target: string | { name: string; version?: string },
    options?: SkillInstallOptions
  ): Promise<SkillInstallResult> {
    const installed: SkillPackageDescriptor[] = [];
    const skipped: string[] = [];
    const failed: string[] = [];
    const warnings: string[] = [];
    
    try {
      // 解析目标
      let targets: Array<{ name: string; version?: string }>;
      
      if (typeof target === 'string') {
        // 从来源解析
        const sourceResult = resolveSource(target);
        
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
      } else {
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
      const plan: SkillInstallPlan = {
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
        } else {
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
      
    } catch (error) {
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
  async uninstallSkill(
    name: string,
    version?: string,
    options?: { force?: boolean }
  ): Promise<SkillUninstallResult> {
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
    if (isBuiltinSkill(pkg) && !this.config.allowBuiltinUninstall) {
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
  async enableSkill(name: string, version?: string): Promise<boolean> {
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
  async disableSkill(name: string, version?: string): Promise<boolean> {
    const queryResult = this.registry.getSkill(name, version);
    
    if (!queryResult.found || !queryResult.package) {
      return false;
    }
    
    // builtin skill 只能禁用，不能卸载
    if (isBuiltinSkill(queryResult.package)) {
      // 简化实现：实际应该更新启用状态
      return true;
    }
    
    // 简化实现：实际应该更新启用状态
    return true;
  }
  
  /**
   * 获取安装状态
   */
  getInstallState(name: string, version?: string): {
    installed: boolean;
    enabled: boolean;
    isBuiltin: boolean;
  } | null {
    const queryResult = this.registry.getSkill(name, version);
    
    if (!queryResult.found || !queryResult.package) {
      return null;
    }
    
    const pkg = queryResult.package;
    
    return {
      installed: true,
      enabled: pkg.enabled,
      isBuiltin: isBuiltinSkill(pkg),
    };
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 查找依赖方
   */
  private findDependents(name: string, version?: string): string[] {
    const dependents: string[] = [];
    
    // 简化实现：实际应该查询 registry
    return dependents;
  }
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 从来源提取 Skill 名称
 */
function extractSkillNameFromSource(source: string): string {
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
export function createSkillInstaller(
  registry: SkillRegistry,
  resolver: SkillResolver,
  config?: InstallerConfig
): SkillInstaller {
  return new SkillInstaller(registry, resolver, config);
}
