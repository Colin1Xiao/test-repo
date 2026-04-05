"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.IndexCache = void 0;
exports.createIndexCache = createIndexCache;
exports.getGlobalCache = getGlobalCache;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
// ============================================================================
// 索引缓存
// ============================================================================
class IndexCache {
    constructor(config = {}) {
        // 内存缓存
        this.memoryCache = new Map();
        // 文件缓存索引
        this.fileCache = new Map(); // file -> cache keys
        // 仓库缓存索引
        this.repoCache = new Map(); // repo -> cache keys
        // 统计
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0,
            invalidations: 0,
        };
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
    get(key) {
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
        return item.data;
    }
    /**
     * 设置缓存
     */
    set(key, data, options) {
        // 检查容量
        if (this.memoryCache.size >= this.config.maxItems) {
            this.evictOldest();
        }
        const ttlMs = options?.ttlMs ?? this.config.defaultTtlMs;
        const item = {
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
                this.fileCache.get(file).add(key);
            }
        }
        // 更新仓库索引
        if (options?.repoRoot) {
            if (!this.repoCache.has(options.repoRoot)) {
                this.repoCache.set(options.repoRoot, new Set());
            }
            this.repoCache.get(options.repoRoot).add(key);
        }
    }
    /**
     * 删除缓存
     */
    delete(key) {
        this.memoryCache.delete(key);
        this.stats.invalidations++;
    }
    /**
     * 文件变更失效
     */
    invalidateFile(filePath) {
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
    invalidateRepo(repoRoot) {
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
    invalidateFiles(filePaths) {
        for (const file of filePaths) {
            this.invalidateFile(file);
        }
    }
    /**
     * 获取缓存键
     */
    getKey(type, repoRoot, ...parts) {
        return `${type}:${repoRoot}:${parts.join(':')}`;
    }
    /**
     * 获取统计
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * 获取缓存大小
     */
    getSize() {
        return this.memoryCache.size;
    }
    /**
     * 清空缓存
     */
    clear() {
        this.memoryCache.clear();
        this.fileCache.clear();
        this.repoCache.clear();
    }
    /**
     * 持久化缓存
     */
    async persist() {
        try {
            await fs.mkdir(this.config.cacheDir, { recursive: true });
            const cacheData = {
                items: Array.from(this.memoryCache.entries()),
                fileCache: Array.from(this.fileCache.entries()).map(([k, v]) => [k, Array.from(v)]),
                repoCache: Array.from(this.repoCache.entries()).map(([k, v]) => [k, Array.from(v)]),
            };
            await fs.writeFile(path.join(this.config.cacheDir, 'cache.json'), JSON.stringify(cacheData));
        }
        catch {
            // 忽略错误
        }
    }
    /**
     * 加载持久化缓存
     */
    async load() {
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
        }
        catch {
            // 忽略错误（缓存不存在或损坏）
        }
    }
    // ============================================================================
    // 内部方法
    // ============================================================================
    /**
     * 初始化缓存目录
     */
    async initCacheDir() {
        try {
            await fs.mkdir(this.config.cacheDir, { recursive: true });
        }
        catch {
            // 忽略错误
        }
    }
    /**
     * 淘汰最老的缓存项
     */
    evictOldest() {
        let oldestKey = null;
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
exports.IndexCache = IndexCache;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建索引缓存
 */
function createIndexCache(config) {
    return new IndexCache(config);
}
/**
 * 全局缓存实例
 */
let globalCache = null;
/**
 * 获取全局缓存
 */
function getGlobalCache() {
    if (!globalCache) {
        globalCache = new IndexCache();
    }
    return globalCache;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXhfY2FjaGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvY29kZS9pbmRleF9jYWNoZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7OztHQVlHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFxUkgsNENBRUM7QUFVRCx3Q0FLQztBQXBTRCxnREFBa0M7QUFDbEMsMkNBQTZCO0FBRzdCLCtFQUErRTtBQUMvRSxPQUFPO0FBQ1AsK0VBQStFO0FBRS9FLE1BQWEsVUFBVTtJQW9CckIsWUFBWSxTQUEyQixFQUFFO1FBakJ6QyxPQUFPO1FBQ0MsZ0JBQVcsR0FBZ0MsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUU3RCxTQUFTO1FBQ0QsY0FBUyxHQUE2QixJQUFJLEdBQUcsRUFBRSxDQUFDLENBQUMscUJBQXFCO1FBRTlFLFNBQVM7UUFDRCxjQUFTLEdBQTZCLElBQUksR0FBRyxFQUFFLENBQUMsQ0FBQyxxQkFBcUI7UUFFOUUsS0FBSztRQUNHLFVBQUssR0FBRztZQUNkLElBQUksRUFBRSxDQUFDO1lBQ1AsTUFBTSxFQUFFLENBQUM7WUFDVCxTQUFTLEVBQUUsQ0FBQztZQUNaLGFBQWEsRUFBRSxDQUFDO1NBQ2pCLENBQUM7UUFHQSxJQUFJLENBQUMsTUFBTSxHQUFHO1lBQ1osWUFBWSxFQUFFLE1BQU0sQ0FBQyxZQUFZLElBQUksQ0FBQyxHQUFHLEVBQUUsR0FBRyxJQUFJLEVBQUUsT0FBTztZQUMzRCxRQUFRLEVBQUUsTUFBTSxDQUFDLFFBQVEsSUFBSSxJQUFJO1lBQ2pDLFFBQVEsRUFBRSxNQUFNLENBQUMsUUFBUSxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxFQUFFLFFBQVEsRUFBRSxZQUFZLENBQUM7U0FDOUUsQ0FBQztRQUVGLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztJQUN0QixDQUFDO0lBRUQ7O09BRUc7SUFDSCxHQUFHLENBQUks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RSxDQUFDO1lBQ2QsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDbkMsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLEVBQUUsQ0FBQztRQUN6QixDQUFDO0lBQ0gsQ0FBQztDQUNGO0FBbFFELGdDQWtRQztBQUVELCtFQUErRTtBQUMvRSxPQUFPO0FBQ1AsK0VBQStFO0FBRS9FOztHQUVHO0FBQ0gsU0FBZ0IsZ0JBQWdCLENBQUMsTUFBeUI7SUFDeEQsT0FBTyxJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUNoQyxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxJQUFJLFdBQVcsR0FBc0IsSUFBSSxDQUFDO0FBRTFDOztHQUVHO0FBQ0gsU0FBZ0IsY0FBYztJQUM1QixJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7UUFDakIsV0FBVyxHQUFHLElBQUksVUFBVSxFQUFFLENBQUM7SUFDakMsQ0FBQztJQUNELE9BQU8sV0FBVyxDQUFDO0FBQ3JCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEluZGV4IENhY2hlIC0g57Si5byV57yT5a2YXG4gKiBcbiAqIOiBjOi0o++8mlxuICogMS4gcmVwbyDnuqcgY2FjaGVcbiAqIDIuIGZpbGUg57qnIGNhY2hlXG4gKiAzLiBxdWVyeSBrZXkgY2FjaGVcbiAqIDQuIFRUTCAvIGludmFsaWRhdGlvblxuICogNS4gZmlsZSBjaGFuZ2VkIOWQjuWxgOmDqOWkseaViFxuICogXG4gKiBAdmVyc2lvbiB2MC4xLjBcbiAqIEBkYXRlIDIwMjYtMDQtMDNcbiAqL1xuXG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcy9wcm9taXNlcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHR5cGUgeyBDYWNoZUl0ZW0sIEluZGV4Q2FjaGVDb25maWcgfSBmcm9tICcuL3R5cGVzJztcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g57Si5byV57yT5a2YXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBjbGFzcyBJbmRleENhY2hlIHtcbiAgcHJpdmF0ZSBjb25maWc6IFJlcXVpcmVkPEluZGV4Q2FjaGVDb25maWc+O1xuICBcbiAgLy8g5YaF5a2Y57yT5a2YXG4gIHByaXZhdGUgbWVtb3J5Q2FjaGU6IE1hcDxzdHJpbmcsIENhY2hlSXRlbTxhbnk+PiA9IG5ldyBNYXAoKTtcbiAgXG4gIC8vIOaWh+S7tue8k+WtmOe0ouW8lVxuICBwcml2YXRlIGZpbGVDYWNoZTogTWFwPHN0cmluZywgU2V0PHN0cmluZz4+ID0gbmV3IE1hcCgpOyAvLyBmaWxlIC0+IGNhY2hlIGtleXNcbiAgXG4gIC8vIOS7k+W6k+e8k+WtmOe0ouW8lVxuICBwcml2YXRlIHJlcG9DYWNoZTogTWFwPHN0cmluZywgU2V0PHN0cmluZz4+ID0gbmV3IE1hcCgpOyAvLyByZXBvIC0+IGNhY2hlIGtleXNcbiAgXG4gIC8vIOe7n+iuoVxuICBwcml2YXRlIHN0YXRzID0ge1xuICAgIGhpdHM6IDAsXG4gICAgbWlzc2VzOiAwLFxuICAgIGV2aWN0aW9uczogMCxcbiAgICBpbnZhbGlkYXRpb25zOiAwLFxuICB9O1xuICBcbiAgY29uc3RydWN0b3IoY29uZmlnOiBJbmRleENhY2hlQ29uZmlnID0ge30pIHtcbiAgICB0aGlzLmNvbmZpZyA9IHtcbiAgICAgIGRlZmF1bHRUdGxNczogY29uZmlnLmRlZmF1bHRUdGxNcyA/PyA1ICogNjAgKiAxMDAwLCAvLyA1IOWIhumSn1xuICAgICAgbWF4SXRlbXM6IGNvbmZpZy5tYXhJdGVtcyA/PyAxMDAwLFxuICAgICAgY2FjaGVEaXI6IGNvbmZpZy5jYWNoZURpciA/PyBwYXRoLmpvaW4ocHJvY2Vzcy5jd2QoKSwgJy5jYWNoZScsICdjb2RlLWludGVsJyksXG4gICAgfTtcbiAgICBcbiAgICB0aGlzLmluaXRDYWNoZURpcigpO1xuICB9XG4gIFxuICAvKipcbiAgICog6I635Y+W57yT5a2YXG4gICAqL1xuICBnZXQ8VD4oa2V5OiBzdHJpbmcpOiBUIHwgbnVsbCB7XG4gICAgY29uc3QgaXRlbSA9IHRoaXMubWVtb3J5Q2FjaGUuZ2V0KGtleSk7XG4gICAgXG4gICAgaWYgKCFpdGVtKSB7XG4gICAgICB0aGlzLnN0YXRzLm1pc3NlcysrO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIFxuICAgIC8vIOajgOafpei/h+acn1xuICAgIGlmIChEYXRlLm5vdygpID4gaXRlbS5leHBpcmVzQXQpIHtcbiAgICAgIHRoaXMubWVtb3J5Q2FjaGUuZGVsZXRlKGtleSk7XG4gICAgICB0aGlzLnN0YXRzLm1pc3NlcysrO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIFxuICAgIC8vIOabtOaWsOiuv+mXrue7n+iuoVxuICAgIGl0ZW0uYWNjZXNzQ291bnQrKztcbiAgICBpdGVtLmxhc3RBY2Nlc3NBdCA9IERhdGUubm93KCk7XG4gICAgXG4gICAgdGhpcy5zdGF0cy5oaXRzKys7XG4gICAgcmV0dXJuIGl0ZW0uZGF0YSBhcyBUO1xuICB9XG4gIFxuICAvKipcbiAgICog6K6+572u57yT5a2YXG4gICAqL1xuICBzZXQ8VD4oa2V5OiBzdHJpbmcsIGRhdGE6IFQsIG9wdGlvbnM/OiB7IHR0bE1zPzogbnVtYmVyOyByZXBvUm9vdD86IHN0cmluZzsgZmlsZXM/OiBzdHJpbmdbXSB9KTogdm9pZCB7XG4gICAgLy8g5qOA5p+l5a656YePXG4gICAgaWYgKHRoaXMubWVtb3J5Q2FjaGUuc2l6ZSA+PSB0aGlzLmNvbmZpZy5tYXhJdGVtcykge1xuICAgICAgdGhpcy5ldmljdE9sZGVzdCgpO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCB0dGxNcyA9IG9wdGlvbnM/LnR0bE1zID8/IHRoaXMuY29uZmlnLmRlZmF1bHRUdGxNcztcbiAgICBcbiAgICBjb25zdCBpdGVtOiBDYWNoZUl0ZW08VD4gPSB7XG4gICAgICBkYXRhLFxuICAgICAgY3JlYXRlZEF0OiBEYXRlLm5vdygpLFxuICAgICAgZXhwaXJlc0F0OiBEYXRlLm5vdygpICsgdHRsTXMsXG4gICAgICBhY2Nlc3NDb3VudDogMCxcbiAgICAgIGxhc3RBY2Nlc3NBdDogRGF0ZS5ub3coKSxcbiAgICB9O1xuICAgIFxuICAgIHRoaXMubWVtb3J5Q2FjaGUuc2V0KGtleSwgaXRlbSk7XG4gICAgXG4gICAgLy8g5pu05paw5paH5Lu257Si5byVXG4gICAgaWYgKG9wdGlvbnM/LmZpbGVzKSB7XG4gICAgICBmb3IgKGNvbnN0IGZpbGUgb2Ygb3B0aW9ucy5maWxlcykge1xuICAgICAgICBpZiAoIXRoaXMuZmlsZUNhY2hlLmhhcyhmaWxlKSkge1xuICAgICAgICAgIHRoaXMuZmlsZUNhY2hlLnNldChmaWxlLCBuZXcgU2V0KCkpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZmlsZUNhY2hlLmdldChmaWxlKSEuYWRkKGtleSk7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIOabtOaWsOS7k+W6k+e0ouW8lVxuICAgIGlmIChvcHRpb25zPy5yZXBvUm9vdCkge1xuICAgICAgaWYgKCF0aGlzLnJlcG9DYWNoZS5oYXMob3B0aW9ucy5yZXBvUm9vdCkpIHtcbiAgICAgICAgdGhpcy5yZXBvQ2FjaGUuc2V0KG9wdGlvbnMucmVwb1Jvb3QsIG5ldyBTZXQoKSk7XG4gICAgICB9XG4gICAgICB0aGlzLnJlcG9DYWNoZS5nZXQob3B0aW9ucy5yZXBvUm9vdCkhLmFkZChrZXkpO1xuICAgIH1cbiAgfVxuICBcbiAgLyoqXG4gICAqIOWIoOmZpOe8k+WtmFxuICAgKi9cbiAgZGVsZXRlKGtleTogc3RyaW5nKTogdm9pZCB7XG4gICAgdGhpcy5tZW1vcnlDYWNoZS5kZWxldGUoa2V5KTtcbiAgICB0aGlzLnN0YXRzLmludmFsaWRhdGlvbnMrKztcbiAgfVxuICBcbiAgLyoqXG4gICAqIOaWh+S7tuWPmOabtOWkseaViFxuICAgKi9cbiAgaW52YWxpZGF0ZUZpbGUoZmlsZVBhdGg6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGtleXMgPSB0aGlzLmZpbGVDYWNoZS5nZXQoZmlsZVBhdGgpO1xuICAgIGlmIChrZXlzKSB7XG4gICAgICBmb3IgKGNvbnN0IGtleSBvZiBrZXlzKSB7XG4gICAgICAgIHRoaXMubWVtb3J5Q2FjaGUuZGVsZXRlKGtleSk7XG4gICAgICB9XG4gICAgICB0aGlzLmZpbGVDYWNoZS5kZWxldGUoZmlsZVBhdGgpO1xuICAgICAgdGhpcy5zdGF0cy5pbnZhbGlkYXRpb25zICs9IGtleXMuc2l6ZTtcbiAgICB9XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDku5PlupPlpLHmlYhcbiAgICovXG4gIGludmFsaWRhdGVSZXBvKHJlcG9Sb290OiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBrZXlzID0gdGhpcy5yZXBvQ2FjaGUuZ2V0KHJlcG9Sb290KTtcbiAgICBpZiAoa2V5cykge1xuICAgICAgZm9yIChjb25zdCBrZXkgb2Yga2V5cykge1xuICAgICAgICB0aGlzLm1lbW9yeUNhY2hlLmRlbGV0ZShrZXkpO1xuICAgICAgfVxuICAgICAgdGhpcy5yZXBvQ2FjaGUuZGVsZXRlKHJlcG9Sb290KTtcbiAgICAgIHRoaXMuc3RhdHMuaW52YWxpZGF0aW9ucyArPSBrZXlzLnNpemU7XG4gICAgfVxuICB9XG4gIFxuICAvKipcbiAgICog5om56YeP5aSx5pWIXG4gICAqL1xuICBpbnZhbGlkYXRlRmlsZXMoZmlsZVBhdGhzOiBzdHJpbmdbXSk6IHZvaWQge1xuICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlUGF0aHMpIHtcbiAgICAgIHRoaXMuaW52YWxpZGF0ZUZpbGUoZmlsZSk7XG4gICAgfVxuICB9XG4gIFxuICAvKipcbiAgICog6I635Y+W57yT5a2Y6ZSuXG4gICAqL1xuICBnZXRLZXkodHlwZTogc3RyaW5nLCByZXBvUm9vdDogc3RyaW5nLCAuLi5wYXJ0czogc3RyaW5nW10pOiBzdHJpbmcge1xuICAgIHJldHVybiBgJHt0eXBlfToke3JlcG9Sb290fToke3BhcnRzLmpvaW4oJzonKX1gO1xuICB9XG4gIFxuICAvKipcbiAgICog6I635Y+W57uf6K6hXG4gICAqL1xuICBnZXRTdGF0cygpOiB0eXBlb2YgdGhpcy5zdGF0cyB7XG4gICAgcmV0dXJuIHsgLi4udGhpcy5zdGF0cyB9O1xuICB9XG4gIFxuICAvKipcbiAgICog6I635Y+W57yT5a2Y5aSn5bCPXG4gICAqL1xuICBnZXRTaXplKCk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMubWVtb3J5Q2FjaGUuc2l6ZTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOa4heepuue8k+WtmFxuICAgKi9cbiAgY2xlYXIoKTogdm9pZCB7XG4gICAgdGhpcy5tZW1vcnlDYWNoZS5jbGVhcigpO1xuICAgIHRoaXMuZmlsZUNhY2hlLmNsZWFyKCk7XG4gICAgdGhpcy5yZXBvQ2FjaGUuY2xlYXIoKTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOaMgeS5heWMlue8k+WtmFxuICAgKi9cbiAgYXN5bmMgcGVyc2lzdCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgZnMubWtkaXIodGhpcy5jb25maWcuY2FjaGVEaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBjYWNoZURhdGEgPSB7XG4gICAgICAgIGl0ZW1zOiBBcnJheS5mcm9tKHRoaXMubWVtb3J5Q2FjaGUuZW50cmllcygpKSxcbiAgICAgICAgZmlsZUNhY2hlOiBBcnJheS5mcm9tKHRoaXMuZmlsZUNhY2hlLmVudHJpZXMoKSkubWFwKChbaywgdl0pID0+IFtrLCBBcnJheS5mcm9tKHYpXSksXG4gICAgICAgIHJlcG9DYWNoZTogQXJyYXkuZnJvbSh0aGlzLnJlcG9DYWNoZS5lbnRyaWVzKCkpLm1hcCgoW2ssIHZdKSA9PiBbaywgQXJyYXkuZnJvbSh2KV0pLFxuICAgICAgfTtcbiAgICAgIFxuICAgICAgYXdhaXQgZnMud3JpdGVGaWxlKFxuICAgICAgICBwYXRoLmpvaW4odGhpcy5jb25maWcuY2FjaGVEaXIsICdjYWNoZS5qc29uJyksXG4gICAgICAgIEpTT04uc3RyaW5naWZ5KGNhY2hlRGF0YSlcbiAgICAgICk7XG4gICAgfSBjYXRjaCB7XG4gICAgICAvLyDlv73nlaXplJnor69cbiAgICB9XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDliqDovb3mjIHkuYXljJbnvJPlrZhcbiAgICovXG4gIGFzeW5jIGxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGNhY2hlUGF0aCA9IHBhdGguam9pbih0aGlzLmNvbmZpZy5jYWNoZURpciwgJ2NhY2hlLmpzb24nKTtcbiAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCBmcy5yZWFkRmlsZShjYWNoZVBhdGgsICd1dGYtOCcpO1xuICAgICAgY29uc3QgY2FjaGVEYXRhID0gSlNPTi5wYXJzZShjb250ZW50KTtcbiAgICAgIFxuICAgICAgLy8g5oGi5aSN5YaF5a2Y57yT5a2YXG4gICAgICBmb3IgKGNvbnN0IFtrZXksIGl0ZW1dIG9mIGNhY2hlRGF0YS5pdGVtcykge1xuICAgICAgICAvLyDlj6rliqDovb3mnKrov4fmnJ/nmoRcbiAgICAgICAgaWYgKERhdGUubm93KCkgPD0gaXRlbS5leHBpcmVzQXQpIHtcbiAgICAgICAgICB0aGlzLm1lbW9yeUNhY2hlLnNldChrZXksIGl0ZW0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIOaBouWkjeaWh+S7tue0ouW8lVxuICAgICAgZm9yIChjb25zdCBbZmlsZSwga2V5c10gb2YgY2FjaGVEYXRhLmZpbGVDYWNoZSkge1xuICAgICAgICB0aGlzLmZpbGVDYWNoZS5zZXQoZmlsZSwgbmV3IFNldChrZXlzKSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIOaBouWkjeS7k+W6k+e0ouW8lVxuICAgICAgZm9yIChjb25zdCBbcmVwbywga2V5c10gb2YgY2FjaGVEYXRhLnJlcG9DYWNoZSkge1xuICAgICAgICB0aGlzLnJlcG9DYWNoZS5zZXQocmVwbywgbmV3IFNldChrZXlzKSk7XG4gICAgICB9XG4gICAgfSBjYXRjaCB7XG4gICAgICAvLyDlv73nlaXplJnor6/vvIjnvJPlrZjkuI3lrZjlnKjmiJbmjZ/lnY/vvIlcbiAgICB9XG4gIH1cbiAgXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgLy8g5YaF6YOo5pa55rOVXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgXG4gIC8qKlxuICAgKiDliJ3lp4vljJbnvJPlrZjnm67lvZVcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgaW5pdENhY2hlRGlyKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCBmcy5ta2Rpcih0aGlzLmNvbmZpZy5jYWNoZURpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgfSBjYXRjaCB7XG4gICAgICAvLyDlv73nlaXplJnor69cbiAgICB9XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmt5jmsbDmnIDogIHnmoTnvJPlrZjpoblcbiAgICovXG4gIHByaXZhdGUgZXZpY3RPbGRlc3QoKTogdm9pZCB7XG4gICAgbGV0IG9sZGVzdEtleTogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gICAgbGV0IG9sZGVzdFRpbWUgPSBEYXRlLm5vdygpO1xuICAgIFxuICAgIGZvciAoY29uc3QgW2tleSwgaXRlbV0gb2YgdGhpcy5tZW1vcnlDYWNoZS5lbnRyaWVzKCkpIHtcbiAgICAgIGlmIChpdGVtLmxhc3RBY2Nlc3NBdCA8IG9sZGVzdFRpbWUpIHtcbiAgICAgICAgb2xkZXN0VGltZSA9IGl0ZW0ubGFzdEFjY2Vzc0F0O1xuICAgICAgICBvbGRlc3RLZXkgPSBrZXk7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIGlmIChvbGRlc3RLZXkpIHtcbiAgICAgIHRoaXMubWVtb3J5Q2FjaGUuZGVsZXRlKG9sZGVzdEtleSk7XG4gICAgICB0aGlzLnN0YXRzLmV2aWN0aW9ucysrO1xuICAgIH1cbiAgfVxufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDkvr/mjbflh73mlbBcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDliJvlu7rntKLlvJXnvJPlrZhcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUluZGV4Q2FjaGUoY29uZmlnPzogSW5kZXhDYWNoZUNvbmZpZyk6IEluZGV4Q2FjaGUge1xuICByZXR1cm4gbmV3IEluZGV4Q2FjaGUoY29uZmlnKTtcbn1cblxuLyoqXG4gKiDlhajlsYDnvJPlrZjlrp7kvotcbiAqL1xubGV0IGdsb2JhbENhY2hlOiBJbmRleENhY2hlIHwgbnVsbCA9IG51bGw7XG5cbi8qKlxuICog6I635Y+W5YWo5bGA57yT5a2YXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRHbG9iYWxDYWNoZSgpOiBJbmRleENhY2hlIHtcbiAgaWYgKCFnbG9iYWxDYWNoZSkge1xuICAgIGdsb2JhbENhY2hlID0gbmV3IEluZGV4Q2FjaGUoKTtcbiAgfVxuICByZXR1cm4gZ2xvYmFsQ2FjaGU7XG59XG4iXX0=