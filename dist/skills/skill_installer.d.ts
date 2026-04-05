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
import type { SkillInstallResult, SkillInstallOptions, SkillUninstallResult } from './types';
import { SkillRegistry } from './skill_registry';
import { SkillResolver } from './skill_resolver';
/**
 * 安装器配置
 */
export interface InstallerConfig {
    /** 是否允许卸载 builtin skill */
    allowBuiltinUninstall?: boolean;
    /** 是否强制卸载（即使被依赖） */
    allowForceUninstall?: boolean;
}
export declare class SkillInstaller {
    private config;
    private registry;
    private resolver;
    constructor(registry: SkillRegistry, resolver: SkillResolver, config?: InstallerConfig);
    /**
     * 安装 Skill
     */
    installSkill(target: string | {
        name: string;
        version?: string;
    }, options?: SkillInstallOptions): Promise<SkillInstallResult>;
    /**
     * 卸载 Skill
     */
    uninstallSkill(name: string, version?: string, options?: {
        force?: boolean;
    }): Promise<SkillUninstallResult>;
    /**
     * 启用 Skill
     */
    enableSkill(name: string, version?: string): Promise<boolean>;
    /**
     * 禁用 Skill
     */
    disableSkill(name: string, version?: string): Promise<boolean>;
    /**
     * 获取安装状态
     */
    getInstallState(name: string, version?: string): {
        installed: boolean;
        enabled: boolean;
        isBuiltin: boolean;
    } | null;
    /**
     * 查找依赖方
     */
    private findDependents;
}
/**
 * 创建 Skill 安装器
 */
export declare function createSkillInstaller(registry: SkillRegistry, resolver: SkillResolver, config?: InstallerConfig): SkillInstaller;
