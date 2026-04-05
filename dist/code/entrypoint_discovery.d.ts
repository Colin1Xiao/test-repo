/**
 * Entrypoint Discovery - 入口点发现器
 *
 * 职责：
 * 1. 发现应用入口
 * 2. 发现 CLI 入口
 * 3. 发现服务器入口
 * 4. 发现 Worker 入口
 * 5. 发现页面入口（Next.js 等）
 * 6. 置信度分级（primary/secondary/possible）
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { Entrypoint } from './types';
/**
 * 发现器配置
 */
export interface EntrypointDiscoveryConfig {
    /** 包含子目录 */
    includeSubdirs?: boolean;
    /** 最大深度 */
    maxDepth?: number;
}
export declare class EntrypointDiscovery {
    private config;
    constructor(config?: EntrypointDiscoveryConfig);
    /**
     * 发现入口点
     */
    discover(repoRoot: string): Promise<Entrypoint[]>;
    /**
     * 基于模式匹配发现
     */
    private discoverByPatterns;
    /**
     * 发现通配符模式匹配
     */
    private discoverWildcardPatterns;
    /**
     * 基于 package.json bin 发现
     */
    private discoverPackageBin;
    /**
     * 基于 pyproject.toml 发现
     */
    private discoverPyprojectEntrypoints;
    /**
     * 基于 Cargo.toml 发现
     */
    private discoverCargoEntrypoints;
    /**
     * 去重
     */
    private deduplicate;
    /**
     * 检查模式匹配
     */
    private matchesPattern;
}
/**
 * 创建入口点发现器
 */
export declare function createEntrypointDiscovery(config?: EntrypointDiscoveryConfig): EntrypointDiscovery;
/**
 * 快速发现入口点
 */
export declare function discoverEntrypoints(repoRoot: string, config?: EntrypointDiscoveryConfig): Promise<Entrypoint[]>;
