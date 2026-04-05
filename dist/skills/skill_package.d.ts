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
import type { SkillPackageDescriptor, SkillManifest, SkillRegistryEntry, SkillSourceType } from './types';
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
/**
 * 构建 Skill Package
 */
export declare function buildSkillPackage(manifest: SkillManifest, sourceInfo: SourceInfo): SkillPackageDescriptor;
/**
 * 获取 Package ID
 */
export declare function getPackageId(pkg: SkillPackageDescriptor): string;
/**
 * 获取 Package Key
 */
export declare function getPackageKey(pkg: SkillPackageDescriptor): string;
/**
 * 检查是否是 builtin skill
 */
export declare function isBuiltinSkill(pkg: SkillPackageDescriptor): boolean;
/**
 * 检查是否是 external skill
 */
export declare function isExternalSkill(pkg: SkillPackageDescriptor): boolean;
/**
 * 检查是否是 workspace skill
 */
export declare function isWorkspaceSkill(pkg: SkillPackageDescriptor): boolean;
/**
 * 转换为 Registry Entry
 */
export declare function toRegistryEntry(pkg: SkillPackageDescriptor): SkillRegistryEntry;
/**
 * 更新 Package 状态
 */
export declare function updatePackageStatus(pkg: SkillPackageDescriptor, enabled: boolean): SkillPackageDescriptor;
/**
 * 更新 Package 安装路径
 */
export declare function updatePackageInstallPath(pkg: SkillPackageDescriptor, installPath: string): SkillPackageDescriptor;
/**
 * 获取 Package 的能力列表
 */
export declare function getPackageCapabilities(pkg: SkillPackageDescriptor): string[];
/**
 * 获取 Package 的工具列表
 */
export declare function getPackageTools(pkg: SkillPackageDescriptor): string[];
/**
 * 获取 Package 的 MCP Server 列表
 */
export declare function getPackageMcpServers(pkg: SkillPackageDescriptor): string[];
/**
 * 获取 Package 的依赖列表
 */
export declare function getPackageDependencies(pkg: SkillPackageDescriptor): string[];
/**
 * 检查 Package 是否有某能力
 */
export declare function hasCapability(pkg: SkillPackageDescriptor, capabilityName: string): boolean;
/**
 * 检查 Package 是否有某工具
 */
export declare function hasTool(pkg: SkillPackageDescriptor, toolName: string): boolean;
/**
 * 检查 Package 是否需要某 MCP Server
 */
export declare function requiresMcpServer(pkg: SkillPackageDescriptor, serverName: string): boolean;
/**
 * 检查 Package 是否依赖某 Skill
 */
export declare function dependsOnSkill(pkg: SkillPackageDescriptor, skillName: string): boolean;
/**
 * 比较两个 Package 的版本
 */
export declare function comparePackageVersions(pkg1: SkillPackageDescriptor, pkg2: SkillPackageDescriptor): number;
/**
 * 检查 Package 是否兼容某 Agent
 */
export declare function isCompatibleWithAgent(pkg: SkillPackageDescriptor, agentId: string): boolean;
/**
 * 创建 Package 快照
 */
export declare function createPackageSnapshot(pkg: SkillPackageDescriptor): SkillPackageDescriptor;
/**
 * 克隆 Package
 */
export declare function clonePackage(pkg: SkillPackageDescriptor): SkillPackageDescriptor;
