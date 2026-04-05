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

import * as fs from 'fs/promises';
import * as path from 'path';
import type { CacheItem, IndexCacheConfig } from './types';

// ============================================================================
// 索引缓存
// ============================================================================

export class IndexCache {
  private config: Required<IndexCacheConfig>;
  
  // 内存缓存
  private memoryCache: Map<string, CacheItem<any>> = new Map();
  
  // 文件缓存索引
  private fileCache: Map<string, Set<string>> = new Map(); // file -> cache keys
  
  // 仓库缓存索引
  private repoCache: Map<string, Set<string>> = new Map(); // repo -> cache keys
  
  // 统计
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    invalidations: 0,
  };
  
  constructor(config: IndexCacheConfig = {}) {
    this.config = {
      defaultTtlMs: config.defaultTtlMs ?? 5 * 60 * 1000, // 5 分钟
      maxItems: config.maxItems ?? 1000,
      cacheDir: config.cacheDir ?? path.join(process.cwd(), '.cache', 'code-intel'),
    };
    
    this.initCacheDir();
  }
  
  /**
   * 获取缓存
   */
  get<T>(key: string): T | null {
    const item = this.memoryCache.get(key);
    
    if (!item) {
      this.stats.misses++;
      return null;
    }
    
    // 检查过期
    if (Date.now() > item.expiresAt) {
      this.memoryCache.delete(key);
      this.stats.misses++;
      return null;
    }
    
    // 更新访问统计
    item.accessCount++;
    item.lastAccessAt = Date.now();
    
    this.stats.hits++;
    return item.data as T;
  }
  
  /**
   * 设置缓存
   */
  set<T>(key: string, data: T, options?: { ttlMs?: number; repoRoot?: string; files?: string[] }): void {
    // 检查容量
    if (this.memoryCache.size >= this.config.maxItems) {
      this.evictOldest();
    }
    
    const ttlMs = options?.ttlMs ?? this.config.defaultTtlMs;
    
    const item: CacheItem<T> = {
      data,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
      accessCount: 0,
      lastAccessAt: Date.now(),
    };
    
    this.memoryCache.set(key, item);
    
    // 更新文件索引
    if (options?.files) {
      for (const file of options.files) {
        if (!this.fileCache.has(file)) {
          this.fileCache.set(file, new Set());
        }
        this.fileCache.get(file)!.add(key);
      }
    }
    
    // 更新仓库索引
    if (options?.repoRoot) {
      if (!this.repoCache.has(options.repoRoot)) {
        this.repoCache.set(options.repoRoot, new Set());
      }
      this.repoCache.get(options.repoRoot)!.add(key);
    }
  }
  
  /**
   * 删除缓存
   */
  delete(key: string): void {
    this.memoryCache.delete(key);
    this.stats.invalidations++;
  }
  
  /**
   * 文件变更失效
   */
  invalidateFile(filePath: string): void {
    const keys = this.fileCache.get(filePath);
    if (keys) {
      for (const key of keys) {
        this.memoryCache.delete(key);
      }
      this.fileCache.delete(filePath);
      this.stats.invalidations += keys.size;
    }
  }
  
  /**
   * 仓库失效
   */
  invalidateRepo(repoRoot: string): void {
    const keys = this.repoCache.get(repoRoot);
    if (keys) {
      for (const key of keys) {
        this.memoryCache.delete(key);
      }
      this.repoCache.delete(repoRoot);
      this.stats.invalidations += keys.size;
    }
  }
  
  /**
   * 批量失效
   */
  invalidateFiles(filePaths: string[]): void {
    for (const file of filePaths) {
      this.invalidateFile(file);
    }
  }
  
  /**
   * 获取缓存键
   */
  getKey(type: string, repoRoot: string, ...parts: string[]): string {
    return `${type}:${repoRoot}:${parts.join(':')}`;
  }
  
  /**
   * 获取统计
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
  }
  
  /**
   * 获取缓存大小
   */
  getSize(): number {
    return this.memoryCache.size;
  }
  
  /**
   * 清空缓存
   */
  clear(): void {
    this.memoryCache.clear();
    this.fileCache.clear();
    this.repoCache.clear();
  }
  
  /**
   * 持久化缓存
   */
  async persist(): Promise<void> {
    try {
      await fs.mkdir(this.config.cacheDir, { recursive: true });
      
      const cacheData = {
        items: Array.from(this.memoryCache.entries()),
        fileCache: Array.from(this.fileCache.entries()).map(([k, v]) => [k, Array.from(v)]),
        repoCache: Array.from(this.repoCache.entries()).map(([k, v]) => [k, Array.from(v)]),
      };
      
      await fs.writeFile(
        path.join(this.config.cacheDir, 'cache.json'),
        JSON.stringify(cacheData)
      );
    } catch {
      // 忽略错误
    }
  }
  
  /**
   * 加载持久化缓存
   */
  async load(): Promise<void> {
    try {
      const cachePath = path.join(this.config.cacheDir, 'cache.json');
      const content = await fs.readFile(cachePath, 'utf-8');
      const cacheData = JSON.parse(content);
      
      // 恢复内存缓存
      for (const [key, item] of cacheData.items) {
        // 只加载未过期的
        if (Date.now() <= item.expiresAt) {
          this.memoryCache.set(key, item);
        }
      }
      
      // 恢复文件索引
      for (const [file, keys] of cacheData.fileCache) {
        this.fileCache.set(file, new Set(keys));
      }
      
      // 恢复仓库索引
      for (const [repo, keys] of cacheData.repoCache) {
        this.repoCache.set(repo, new Set(keys));
      }
    } catch {
      // 忽略错误（缓存不存在或损坏）
    }
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 初始化缓存目录
   */
  private async initCacheDir(): Promise<void> {
    try {
      await fs.mkdir(this.config.cacheDir, { recursive: true });
    } catch {
      // 忽略错误
    }
  }
  
  /**
   * 淘汰最老的缓存项
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();
    
    for (const [key, item] of this.memoryCache.entries()) {
      if (item.lastAccessAt < oldestTime) {
        oldestTime = item.lastAccessAt;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
      this.stats.evictions++;
    }
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建索引缓存
 */
export function createIndexCache(config?: IndexCacheConfig): IndexCache {
  return new IndexCache(config);
}

/**
 * 全局缓存实例
 */
let globalCache: IndexCache | null = null;

/**
 * 获取全局缓存
 */
export function getGlobalCache(): IndexCache {
  if (!globalCache) {
    globalCache = new IndexCache();
  }
  return globalCache;
}
