/**
 * Code Context Service - 代码上下文服务
 *
 * 统一对外接口，让 Agent Teams 通过统一接口获取代码上下文
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { RepoProfile, RepoMap, Entrypoint, CodeContext, SubagentRole } from './types';
/**
 * 服务配置
 */
export interface CodeContextServiceConfig {
    /** 项目检测器配置 */
    detector?: any;
    /** 分类器配置 */
    classifier?: any;
    /** 地图生成器配置 */
    repoMap?: any;
    /** 入口点发现器配置 */
    entrypoint?: any;
}
export declare class CodeContextService {
    private detector;
    private classifier;
    private repoMapGenerator;
    private entrypointDiscovery;
    private profileCache;
    private mapCache;
    private entrypointCache;
    private cacheTtl;
    constructor(config?: CodeContextServiceConfig);
    /**
     * 分析仓库
     */
    analyzeRepo(repoRoot: string): Promise<RepoProfile>;
    /**
     * 构建仓库画像
     */
    buildRepoProfile(repoRoot: string): Promise<RepoProfile>;
    /**
     * 构建仓库地图
     */
    buildRepoMap(repoRoot: string): Promise<RepoMap>;
    /**
     * 发现入口点
     */
    discoverEntrypoints(repoRoot: string): Promise<Entrypoint[]>;
    /**
     * 构建代码上下文（给 agent 使用）
     */
    buildCodeContext(role: SubagentRole | string, task?: any, repoRoot?: string): Promise<CodeContext>;
    /**
     * 清除缓存
     */
    clearCache(repoRoot?: string): void;
    /**
     * 设置缓存 TTL
     */
    setCacheTtl(ttlMs: number): void;
    /**
     * 收集所有路径
     */
    private collectAllPaths;
    /**
     * 遍历目录
     */
    private walkDirectory;
    /**
     * 获取仓库根目录（用于 walkDirectory）
     */
    private getRepoRoot;
    /**
     * 获取缓存
     */
    private getCached;
    /**
     * 设置缓存
     */
    private setCached;
}
/**
 * 创建代码上下文服务
 */
export declare function createCodeContextService(config?: CodeContextServiceConfig): CodeContextService;
/**
 * 快速分析仓库
 */
export declare function analyzeRepo(repoRoot: string): Promise<RepoProfile>;
/**
 * 快速构建代码上下文
 */
export declare function buildCodeContext(role: SubagentRole | string, repoRoot: string): Promise<CodeContext>;
