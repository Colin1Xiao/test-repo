/**
 * Repo Map - 仓库地图生成器
 *
 * 职责：
 * 1. 生成目录拓扑
 * 2. 标记核心模块
 * 3. 按分类归档
 * 4. 语言分布统计
 * 5. 重要配置文件识别
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { RepoMap } from './types';
/**
 * 生成器配置
 */
export interface RepoMapGeneratorConfig {
    /** 最大深度 */
    maxDepth?: number;
    /** 排除的目录 */
    excludeDirs?: string[];
    /** 排除的文件 */
    excludeFiles?: string[];
    /** 包含隐藏文件 */
    includeHidden?: boolean;
}
export declare class RepoMapGenerator {
    private config;
    private classifier;
    constructor(config?: RepoMapGeneratorConfig);
    /**
     * 生成仓库地图
     */
    generate(repoRoot: string): Promise<RepoMap>;
    /**
     * 扫描顶层目录
     */
    private scanTopLevelDirectories;
    /**
     * 识别关键目录
     */
    private identifyKeyDirectories;
    /**
     * 分析语言分布
     */
    private analyzeLanguageDistribution;
    /**
     * 识别重要文件
     */
    private identifyImportantFiles;
    /**
     * 发现入口候选
     */
    private discoverEntrypointCandidates;
    /**
     * 遍历目录
     */
    private walkDirectory;
    /**
     * 检查是否应该排除
     */
    private shouldExclude;
}
/**
 * 创建仓库地图生成器
 */
export declare function createRepoMapGenerator(config?: RepoMapGeneratorConfig): RepoMapGenerator;
/**
 * 快速生成仓库地图
 */
export declare function generateRepoMap(repoRoot: string, config?: RepoMapGeneratorConfig): Promise<RepoMap>;
