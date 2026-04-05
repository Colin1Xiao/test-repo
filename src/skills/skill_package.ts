/**
 * Skill Package - Skill Package 描述符
 * 
 * 职责：
 * 1. 从 manifest 构建 package 对象
 * 2. 附加 source、entry、install 状态等运行时元数据
 * 3. 计算 package id / key
 * 4. 形成 registry 可存储的统一对象
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type {
  SkillPackageDescriptor,
  SkillManifest,
  SkillRegistryEntry,
  SkillSourceType,
} from './types';
import { getManifestId } from './skill_manifest';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 来源信息
 */
export interface SourceInfo {
  /** 来源类型 */
  type: SkillSourceType;
  
  /** 来源路径/URL */
  path?: string;
  
  /** 安装路径 */
  installPath?: string;
}

// ============================================================================
// Package 构建
// ============================================================================

/**
 * 构建 Skill Package
 */
export function buildSkillPackage(
  manifest: SkillManifest,
  sourceInfo: SourceInfo
): SkillPackageDescriptor {
  const id = getManifestId(manifest.name, manifest.version);
  const key = `${manifest.name}@${manifest.version}`;
  const now = Date.now();
  
  return {
    id,
    key,
    manifest,
    source: sourceInfo.type,
    sourcePath: sourceInfo.path,
    installPath: sourceInfo.installPath,
    enabled: true, // 默认启用
    installedAt: now,
    updatedAt: now,
    metadata: {
      capabilityCount: manifest.capabilities.length,
      toolCount: manifest.tools.length,
      dependencyCount: manifest.dependencies.length,
    },
  };
}

/**
 * 获取 Package ID
 */
export function getPackageId(pkg: SkillPackageDescriptor): string {
  return pkg.id;
}

/**
 * 获取 Package Key
 */
export function getPackageKey(pkg: SkillPackageDescriptor): string {
  return pkg.key;
}

/**
 * 检查是否是 builtin skill
 */
export function isBuiltinSkill(pkg: SkillPackageDescriptor): boolean {
  return pkg.source === 'builtin';
}

/**
 * 检查是否是 external skill
 */
export function isExternalSkill(pkg: SkillPackageDescriptor): boolean {
  return pkg.source === 'external';
}

/**
 * 检查是否是 workspace skill
 */
export function isWorkspaceSkill(pkg: SkillPackageDescriptor): boolean {
  return pkg.source === 'workspace';
}

/**
 * 转换为 Registry Entry
 */
export function toRegistryEntry(pkg: SkillPackageDescriptor): SkillRegistryEntry {
  return {
    id: pkg.id,
    name: pkg.manifest.name,
    version: pkg.manifest.version,
    description: pkg.manifest.description,
    trustLevel: pkg.manifest.trustLevel || 'workspace',
    source: pkg.source,
    enabled: pkg.enabled,
    capabilityCount: pkg.manifest.capabilities.length,
    toolCount: pkg.manifest.tools.length,
    dependencyCount: pkg.manifest.dependencies.length,
    registeredAt: pkg.installedAt || Date.now(),
  };
}

/**
 * 更新 Package 状态
 */
export function updatePackageStatus(
  pkg: SkillPackageDescriptor,
  enabled: boolean
): SkillPackageDescriptor {
  return {
    ...pkg,
    enabled,
    updatedAt: Date.now(),
  };
}

/**
 * 更新 Package 安装路径
 */
export function updatePackageInstallPath(
  pkg: SkillPackageDescriptor,
  installPath: string
): SkillPackageDescriptor {
  return {
    ...pkg,
    installPath,
    updatedAt: Date.now(),
  };
}

// ============================================================================
// Package 查询
// ============================================================================

/**
 * 获取 Package 的能力列表
 */
export function getPackageCapabilities(pkg: SkillPackageDescriptor): string[] {
  return pkg.manifest.capabilities.map(cap => cap.name);
}

/**
 * 获取 Package 的工具列表
 */
export function getPackageTools(pkg: SkillPackageDescriptor): string[] {
  return pkg.manifest.tools.map(tool => tool.name);
}

/**
 * 获取 Package 的 MCP Server 列表
 */
export function getPackageMcpServers(pkg: SkillPackageDescriptor): string[] {
  return pkg.manifest.mcpServers || [];
}

/**
 * 获取 Package 的依赖列表
 */
export function getPackageDependencies(pkg: SkillPackageDescriptor): string[] {
  return pkg.manifest.dependencies.map(dep => dep.name);
}

/**
 * 检查 Package 是否有某能力
 */
export function hasCapability(pkg: SkillPackageDescriptor, capabilityName: string): boolean {
  return pkg.manifest.capabilities.some(cap => cap.name === capabilityName);
}

/**
 * 检查 Package 是否有某工具
 */
export function hasTool(pkg: SkillPackageDescriptor, toolName: string): boolean {
  return pkg.manifest.tools.some(tool => tool.name === toolName);
}

/**
 * 检查 Package 是否需要某 MCP Server
 */
export function requiresMcpServer(pkg: SkillPackageDescriptor, serverName: string): boolean {
  return (pkg.manifest.mcpServers || []).includes(serverName);
}

/**
 * 检查 Package 是否依赖某 Skill
 */
export function dependsOnSkill(pkg: SkillPackageDescriptor, skillName: string): boolean {
  return pkg.manifest.dependencies.some(dep => dep.name === skillName);
}

// ============================================================================
// Package 比较
// ============================================================================

/**
 * 比较两个 Package 的版本
 */
export function comparePackageVersions(
  pkg1: SkillPackageDescriptor,
  pkg2: SkillPackageDescriptor
): number {
  return compareVersions(pkg1.manifest.version, pkg2.manifest.version);
}

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

/**
 * 检查 Package 是否兼容某 Agent
 */
export function isCompatibleWithAgent(
  pkg: SkillPackageDescriptor,
  agentId: string
): boolean {
  const compatibility = pkg.manifest.compatibility;
  
  if (!compatibility) {
    return true; // 无兼容性声明，默认兼容
  }
  
  // 检查不兼容列表
  if (compatibility.incompatibleAgents?.includes(agentId)) {
    return false;
  }
  
  // 检查必需列表（如果有声明）
  if (compatibility.requiredAgents && compatibility.requiredAgents.length > 0) {
    return compatibility.requiredAgents.includes(agentId);
  }
  
  // 检查可选列表
  if (compatibility.optionalAgents) {
    return compatibility.optionalAgents.includes(agentId);
  }
  
  return true;
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建 Package 快照
 */
export function createPackageSnapshot(pkg: SkillPackageDescriptor): SkillPackageDescriptor {
  return JSON.parse(JSON.stringify(pkg));
}

/**
 * 克隆 Package
 */
export function clonePackage(pkg: SkillPackageDescriptor): SkillPackageDescriptor {
  return createPackageSnapshot(pkg);
}
