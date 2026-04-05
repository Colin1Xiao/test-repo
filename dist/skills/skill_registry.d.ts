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
import type { SkillPackageDescriptor, SkillRegistrationResult, SkillQueryResult, SkillListResult, SkillListFilters, SkillName, SkillVersion } from './types';
/**
 * 注册表配置
 */
export interface SkillRegistryConfig {
    /** 允许重复注册同名同版本 */
    allowReregistration?: boolean;
    /** 默认返回最新版本 */
    defaultToLatest?: boolean;
}
export declare class SkillRegistry {
    private config;
    private byName;
    private byId;
    private registrationOrder;
    constructor(config?: SkillRegistryConfig);
    /**
     * 注册 Skill
     */
    registerSkill(pkg: SkillPackageDescriptor): Promise<SkillRegistrationResult>;
    /**
     * 注销 Skill
     */
    unregisterSkill(name: SkillName, version?: SkillVersion): Promise<boolean>;
    /**
     * 获取 Skill
     */
    getSkill(name: SkillName, version?: SkillVersion): SkillQueryResult;
    /**
     * 获取最新版本
     */
    getLatestVersion(name: SkillName): SkillPackageDescriptor | null;
    /**
     * 列出所有版本
     */
    listVersions(name: SkillName): SkillVersion[];
    /**
     * 检查是否有某 Skill
     */
    hasSkill(name: SkillName, version?: SkillVersion): boolean;
    /**
     * 列出 Skills
     */
    listSkills(filters?: SkillListFilters): SkillListResult;
    /**
     * 列出启用的 Skills
     */
    listEnabledSkills(filters?: SkillListFilters): SkillListResult;
    /**
     * 获取启用的 Skill IDs
     */
    getEnabledSkillIds(): string[];
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
    };
    /**
     * 检查是否匹配过滤条件
     */
    private matchesFilters;
}
/**
 * 创建 Skill 注册表
 */
export declare function createSkillRegistry(config?: SkillRegistryConfig): SkillRegistry;
