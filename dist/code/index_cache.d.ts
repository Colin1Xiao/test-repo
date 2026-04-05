/**
 * Index Cache - 索引缓存
 *
 * 职责：
 * 1. repo 级 cache
 * 2. file 级 cache
 * 3. query key cache
 * 4. TTL / invalidation
 * 5. file changed 后局部失效
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { IndexCacheConfig } from './types';
export declare class IndexCache {
    private config;
    private memoryCache;
    private fileCache;
    private repoCache;
    private stats;
    constructor(config?: IndexCacheConfig);
    /**
     * 获取缓存
     */
    get<T>(key: string): T | null;
    /**
     * 设置缓存
     */
    set<T>(key: string, data: T, options?: {
        ttlMs?: number;
        repoRoot?: string;
        files?: string[];
    }): void;
    /**
     * 删除缓存
     */
    delete(key: string): void;
    /**
     * 文件变更失效
     */
    invalidateFile(filePath: string): void;
    /**
     * 仓库失效
     */
    invalidateRepo(repoRoot: string): void;
    /**
     * 批量失效
     */
    invalidateFiles(filePaths: string[]): void;
    /**
     * 获取缓存键
     */
    getKey(type: string, repoRoot: string, ...parts: string[]): string;
    /**
     * 获取统计
     */
    getStats(): typeof this.stats;
    /**
     * 获取缓存大小
     */
    getSize(): number;
    /**
     * 清空缓存
     */
    clear(): void;
    /**
     * 持久化缓存
     */
    persist(): Promise<void>;
    /**
     * 加载持久化缓存
     */
    load(): Promise<void>;
    /**
     * 初始化缓存目录
     */
    private initCacheDir;
    /**
     * 淘汰最老的缓存项
     */
    private evictOldest;
}
/**
 * 创建索引缓存
 */
export declare function createIndexCache(config?: IndexCacheConfig): IndexCache;
/**
 * 获取全局缓存
 */
export declare function getGlobalCache(): IndexCache;
