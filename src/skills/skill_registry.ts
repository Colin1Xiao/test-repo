/**
 * Skill Registry - Skill 注册表
 * 
 * 职责：
 * 1. 注册 skill package
 * 2. 查询 skill
 * 3. 处理同名不同版本
 * 4. 提供启用状态视图
 * 5. 为 resolver 提供基础数据
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type {
  SkillPackageDescriptor,
  SkillRegistryEntry,
  SkillRegistrationResult,
  SkillQueryResult,
  SkillListResult,
  SkillListFilters,
  SkillName,
  SkillVersion,
} from './types';
import { toRegistryEntry, comparePackageVersions } from './skill_package';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 注册表配置
 */
export interface SkillRegistryConfig {
  /** 允许重复注册同名同版本 */
  allowReregistration?: boolean;
  
  /** 默认返回最新版本 */
  defaultToLatest?: boolean;
}

// ============================================================================
// Skill 注册表
// ============================================================================

export class SkillRegistry {
  private config: Required<SkillRegistryConfig>;
  
  // 按名称分组：name → version[] → package
  private byName: Map<SkillName, Map<SkillVersion, SkillPackageDescriptor>> = new Map();
  
  // 按 ID 索引：id → package
  private byId: Map<string, SkillPackageDescriptor> = new Map();
  
  // 注册顺序（用于追踪）
  private registrationOrder: string[] = [];
  
  constructor(config: SkillRegistryConfig = {}) {
    this.config = {
      allowReregistration: config.allowReregistration ?? false,
      defaultToLatest: config.defaultToLatest ?? true,
    };
  }
  
  /**
   * 注册 Skill
   */
  async registerSkill(
    pkg: SkillPackageDescriptor
  ): Promise<SkillRegistrationResult> {
    const { name, version } = pkg.manifest;
    
    // 检查是否已存在
    const existingVersions = this.byName.get(name);
    if (existingVersions && existingVersions.has(version)) {
      if (!this.config.allowReregistration) {
        return {
          success: false,
          packageId: pkg.id,
          skillName: name,
          skillVersion: version,
          error: `Skill ${name}@${version} already registered. Set allowReregistration=true to override.`,
        };
      }
      // 允许重复注册，先注销旧版本
      await this.unregisterSkill(name, version);
    }
    
    // 存储
    if (!existingVersions) {
      this.byName.set(name, new Map());
    }
    this.byName.get(name)!.set(version, pkg);
    this.byId.set(pkg.id, pkg);
    this.registrationOrder.push(pkg.id);
    
    return {
      success: true,
      packageId: pkg.id,
      skillName: name,
      skillVersion: version,
      warnings: [],
    };
  }
  
  /**
   * 注销 Skill
   */
  async unregisterSkill(
    name: SkillName,
    version?: SkillVersion
  ): Promise<boolean> {
    const versions = this.byName.get(name);
    if (!versions) {
      return false;
    }
    
    if (version) {
      // 注销特定版本
      const pkg = versions.get(version);
      if (pkg) {
        versions.delete(version);
        this.byId.delete(pkg.id);
        this.registrationOrder = this.registrationOrder.filter(id => id !== pkg.id);
        
        // 如果该名称没有版本了，删除名称条目
        if (versions.size === 0) {
          this.byName.delete(name);
        }
        
        return true;
      }
      return false;
    } else {
      // 注销所有版本
      for (const [ver, pkg] of versions.entries()) {
        this.byId.delete(pkg.id);
        this.registrationOrder = this.registrationOrder.filter(id => id !== pkg.id);
      }
      this.byName.delete(name);
      return true;
    }
  }
  
  /**
   * 获取 Skill
   */
  getSkill(
    name: SkillName,
    version?: SkillVersion
  ): SkillQueryResult {
    const versions = this.byName.get(name);
    
    if (!versions) {
      return {
        package: null,
        found: false,
        error: `Skill ${name} not found`,
      };
    }
    
    let pkg: SkillPackageDescriptor | undefined;
    
    if (version) {
      // 获取特定版本
      pkg = versions.get(version);
    } else if (this.config.defaultToLatest) {
      // 获取最新版本
      pkg = this.getLatestVersion(name);
    } else {
      return {
        package: null,
        found: false,
        error: `Version not specified for skill ${name}`,
      };
    }
    
    if (!pkg) {
      return {
        package: null,
        found: false,
        error: version 
          ? `Skill ${name}@${version} not found`
          : `No version available for skill ${name}`,
      };
    }
    
    return {
      package: pkg,
      found: true,
    };
  }
  
  /**
   * 获取最新版本
   */
  getLatestVersion(name: SkillName): SkillPackageDescriptor | null {
    const versions = this.byName.get(name);
    if (!versions || versions.size === 0) {
      return null;
    }
    
    let latest: SkillPackageDescriptor | null = null;
    
    for (const pkg of versions.values()) {
      if (!latest || comparePackageVersions(pkg, latest) > 0) {
        latest = pkg;
      }
    }
    
    return latest;
  }
  
  /**
   * 列出所有版本
   */
  listVersions(name: SkillName): SkillVersion[] {
    const versions = this.byName.get(name);
    if (!versions) {
      return [];
    }
    
    return Array.from(versions.keys()).sort((a, b) => 
      compareVersions(a, b)
    );
  }
  
  /**
   * 检查是否有某 Skill
   */
  hasSkill(
    name: SkillName,
    version?: SkillVersion
  ): boolean {
    const versions = this.byName.get(name);
    if (!versions) {
      return false;
    }
    
    if (version) {
      return versions.has(version);
    }
    
    return versions.size > 0;
  }
  
  /**
   * 列出 Skills
   */
  listSkills(filters?: SkillListFilters): SkillListResult {
    let skills: SkillRegistryEntry[] = [];
    
    // 收集所有 skills
    for (const versions of this.byName.values()) {
      for (const pkg of versions.values()) {
        skills.push(toRegistryEntry(pkg));
      }
    }
    
    // 应用过滤
    if (filters) {
      skills = skills.filter(skill => this.matchesFilters(skill, filters));
    }
    
    // 排序（按注册时间倒序）
    skills.sort((a, b) => b.registeredAt - a.registeredAt);
    
    return {
      skills,
      total: skills.length,
      filters,
    };
  }
  
  /**
   * 列出启用的 Skills
   */
  listEnabledSkills(filters?: SkillListFilters): SkillListResult {
    return this.listSkills({ ...filters, enabled: true });
  }
  
  /**
   * 获取启用的 Skill IDs
   */
  getEnabledSkillIds(): string[] {
    const enabled: string[] = [];
    
    for (const versions of this.byName.values()) {
      for (const pkg of versions.values()) {
        if (pkg.enabled) {
          enabled.push(pkg.id);
        }
      }
    }
    
    return enabled;
  }
  
  /**
   * 获取 Skill 统计
   */
  getStats(): {
    totalSkills: number;
    totalVersions: number;
    bySource: Record<string, number>;
    byTrustLevel: Record<string, number>;
    enabledCount: number;
    disabledCount: number;
  } {
    const bySource: Record<string, number> = {};
    const byTrustLevel: Record<string, number> = {};
    let enabledCount = 0;
    let disabledCount = 0;
    let totalVersions = 0;
    
    for (const versions of this.byName.values()) {
      totalVersions += versions.size;
      
      for (const pkg of versions.values()) {
        // 按来源统计
        bySource[pkg.source] = (bySource[pkg.source] || 0) + 1;
        
        // 按信任级别统计
        const trustLevel = pkg.manifest.trustLevel || 'workspace';
        byTrustLevel[trustLevel] = (byTrustLevel[trustLevel] || 0) + 1;
        
        // 按启用状态统计
        if (pkg.enabled) {
          enabledCount++;
        } else {
          disabledCount++;
        }
      }
    }
    
    return {
      totalSkills: this.byName.size,
      totalVersions,
      bySource,
      byTrustLevel,
      enabledCount,
      disabledCount,
    };
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 检查是否匹配过滤条件
   */
  private matchesFilters(
    skill: SkillRegistryEntry,
    filters: SkillListFilters
  ): boolean {
    if (filters.source && skill.source !== filters.source) {
      return false;
    }
    
    if (filters.trustLevel && skill.trustLevel !== filters.trustLevel) {
      return false;
    }
    
    if (filters.enabled !== undefined && skill.enabled !== filters.enabled) {
      return false;
    }
    
    if (filters.keyword) {
      const keyword = filters.keyword.toLowerCase();
      const searchable = `${skill.name} ${skill.description || ''}`.toLowerCase();
      if (!searchable.includes(keyword)) {
        return false;
      }
    }
    
    return true;
  }
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 比较版本号
 */
function compareVersions(v1: string, v2: string): number {
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

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建 Skill 注册表
 */
export function createSkillRegistry(config?: SkillRegistryConfig): SkillRegistry {
  return new SkillRegistry(config);
}
