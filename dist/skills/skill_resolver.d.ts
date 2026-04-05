/**
 * Skill Resolver - Skill 依赖解析器
 *
 * 职责：
 * 1. 解析 skill 依赖图
 * 2. 处理版本约束
 * 3. 检测缺失依赖
 * 4. 检测循环依赖
 * 5. 给 installer 输出安装计划
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { SkillPackageDescriptor, SkillDependencyGraph, SkillConflict, SkillResolutionResult, SkillInstallPlan } from './types';
import { SkillRegistry } from './skill_registry';
/**
 * 解析器配置
 */
export interface ResolverConfig {
    /** 最大解析深度 */
    maxDepth?: number;
    /** 是否允许循环依赖 */
    allowCircular?: boolean;
}
export declare class SkillResolver {
    private config;
    private registry;
    constructor(registry: SkillRegistry, config?: ResolverConfig);
    /**
     * 解析依赖
     */
    resolveDependencies(targets: Array<{
        name: string;
        version?: string;
    }>, options?: {
        depth?: number;
    }): Promise<SkillResolutionResult>;
    /**
     * 构建依赖图
     */
    buildDependencyGraph(packages: SkillPackageDescriptor[]): SkillDependencyGraph;
    /**
     * 检测冲突
     */
    detectConflicts(packages: SkillPackageDescriptor[]): SkillConflict[];
    /**
     * 检测循环依赖
     */
    detectCycles(graph: SkillDependencyGraph): string[][];
    /**
     * 计算安装计划
     */
    computeInstallPlan(targets: Array<{
        name: string;
        version?: string;
    }>): Promise<SkillInstallPlan>;
}
/**
 * 创建依赖解析器
 */
export declare function createSkillResolver(registry: SkillRegistry, config?: ResolverConfig): SkillResolver;
/**
 * 快速解析依赖
 */
export declare function resolveSkillDependencies(registry: SkillRegistry, targets: Array<{
    name: string;
    version?: string;
}>): Promise<SkillResolutionResult>;
