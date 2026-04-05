"use strict";
/**
 * Code Context Service - 代码上下文服务
 *
 * 统一对外接口，让 Agent Teams 通过统一接口获取代码上下文
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
exports.CodeContextService = void 0;
exports.createCodeContextService = createCodeContextService;
exports.analyzeRepo = analyzeRepo;
exports.buildCodeContext = buildCodeContext;
const project_detector_1 = require("./project_detector");
const module_classifier_1 = require("./module_classifier");
const repo_map_1 = require("./repo_map");
const entrypoint_discovery_1 = require("./entrypoint_discovery");
// ============================================================================
// 代码上下文服务
// ============================================================================
class CodeContextService {
    constructor(config = {}) {
        // 缓存
        this.profileCache = new Map();
        this.mapCache = new Map();
        this.entrypointCache = new Map();
        // 缓存 TTL（毫秒）
        this.cacheTtl = 5 * 60 * 1000; // 5 分钟
        this.detector = (0, project_detector_1.createProjectDetector)(config.detector);
        this.classifier = (0, module_classifier_1.createModuleClassifier)(config.classifier);
        this.repoMapGenerator = (0, repo_map_1.createRepoMapGenerator)(config.repoMap);
        this.entrypointDiscovery = (0, entrypoint_discovery_1.createEntrypointDiscovery)(config.entrypoint);
    }
    /**
     * 分析仓库
     */
    async analyzeRepo(repoRoot) {
        // 检查缓存
        const cached = this.getCached(this.profileCache, repoRoot);
        if (cached)
            return cached;
        // 检测项目
        const profile = await this.detector.detect(repoRoot);
        // 分类模块
        const allPaths = await this.collectAllPaths(repoRoot);
        profile.importantPaths = this.classifier.buildImportantPaths(allPaths, repoRoot);
        // 缓存
        this.setCached(this.profileCache, repoRoot, profile);
        return profile;
    }
    /**
     * 构建仓库画像
     */
    async buildRepoProfile(repoRoot) {
        return await this.analyzeRepo(repoRoot);
    }
    /**
     * 构建仓库地图
     */
    async buildRepoMap(repoRoot) {
        // 检查缓存
        const cached = this.getCached(this.mapCache, repoRoot);
        if (cached)
            return cached;
        // 生成地图
        const repoMap = await this.repoMapGenerator.generate(repoRoot);
        // 缓存
        this.setCached(this.mapCache, repoRoot, repoMap);
        return repoMap;
    }
    /**
     * 发现入口点
     */
    async discoverEntrypoints(repoRoot) {
        // 检查缓存
        const cached = this.getCached(this.entrypointCache, repoRoot);
        if (cached)
            return cached;
        // 发现入口
        const entrypoints = await this.entrypointDiscovery.discover(repoRoot);
        // 缓存
        this.setCached(this.entrypointCache, repoRoot, entrypoints);
        return entrypoints;
    }
    /**
     * 构建代码上下文（给 agent 使用）
     */
    async buildCodeContext(role, task, repoRoot) {
        if (!repoRoot) {
            return {
                taskId: task?.id,
                role,
            };
        }
        // 获取仓库画像和地图
        const [repoProfile, repoMap, entrypoints] = await Promise.all([
            this.analyzeRepo(repoRoot),
            this.buildRepoMap(repoRoot),
            this.discoverEntrypoints(repoRoot),
        ]);
        // 根据角色定制上下文
        const context = {
            taskId: task?.id,
            role,
            repoProfile,
            repoMap,
        };
        // 按角色注入特定信息
        switch (role) {
            case 'planner':
                // Planner 需要 entrypoints 和重要路径
                context.repoProfile.entrypoints = entrypoints;
                break;
            case 'repo_reader':
                // Repo Reader 需要完整的 repo map
                // 已包含
                break;
            case 'code_reviewer':
                // Reviewer 需要关注 tests 和重要文件
                context.repoMap.importantFiles = repoMap.importantFiles.filter(f => f.type === 'test_config' || f.type === 'config');
                break;
            case 'code_fixer':
                // Fixer 需要关注 app 和 lib
                context.repoMap.keyDirectories = repoMap.keyDirectories.filter(d => d.category === 'app' || d.category === 'lib');
                break;
            case 'verify_agent':
                // Verifier 需要关注 tests
                context.repoMap.keyDirectories = repoMap.keyDirectories.filter(d => d.category === 'tests');
                break;
        }
        return context;
    }
    /**
     * 清除缓存
     */
    clearCache(repoRoot) {
        if (repoRoot) {
            this.profileCache.delete(repoRoot);
            this.mapCache.delete(repoRoot);
            this.entrypointCache.delete(repoRoot);
        }
        else {
            this.profileCache.clear();
            this.mapCache.clear();
            this.entrypointCache.clear();
        }
    }
    /**
     * 设置缓存 TTL
     */
    setCacheTtl(ttlMs) {
        this.cacheTtl = ttlMs;
    }
    // ============================================================================
    // 内部方法
    // ============================================================================
    /**
     * 收集所有路径
     */
    async collectAllPaths(repoRoot) {
        const paths = [];
        try {
            const entries = await this.walkDirectory(repoRoot, 2);
            paths.push(...entries);
        }
        catch {
            // 忽略错误
        }
        return paths;
    }
    /**
     * 遍历目录
     */
    async walkDirectory(dir, maxDepth, depth = 0) {
        if (depth >= maxDepth)
            return [];
        const paths = [];
        const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        const pathMod = await Promise.resolve().then(() => __importStar(require('path')));
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = pathMod.join(dir, entry.name);
                const relativePath = pathMod.relative(this.getRepoRoot(dir), fullPath);
                // 排除常见目录
                const excludeDirs = ['node_modules', '__pycache__', '.git', 'dist', 'build'];
                if (entry.isDirectory() && excludeDirs.includes(entry.name))
                    continue;
                paths.push(relativePath);
                if (entry.isDirectory()) {
                    const subPaths = await this.walkDirectory(fullPath, maxDepth, depth + 1);
                    paths.push(...subPaths);
                }
            }
        }
        catch {
            // 忽略错误
        }
        return paths;
    }
    /**
     * 获取仓库根目录（用于 walkDirectory）
     */
    getRepoRoot(dir) {
        // 简单实现：返回第一个参数作为 repoRoot
        // 实际应该存储 repoRoot 作为实例属性
        return dir;
    }
    /**
     * 获取缓存
     */
    getCached(cache, key) {
        const entry = cache.get(key);
        if (!entry)
            return null;
        // 检查是否过期
        if (Date.now() - entry.timestamp > entry.ttl) {
            cache.delete(key);
            return null;
        }
        return entry.data;
    }
    /**
     * 设置缓存
     */
    setCached(cache, key, data) {
        cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl: this.cacheTtl,
        });
    }
}
exports.CodeContextService = CodeContextService;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建代码上下文服务
 */
function createCodeContextService(config) {
    return new CodeContextService(config);
}
/**
 * 快速分析仓库
 */
async function analyzeRepo(repoRoot) {
    const service = new CodeContextService();
    return await service.analyzeRepo(repoRoot);
}
/**
 * 快速构建代码上下文
 */
async function buildCodeContext(role, repoRoot) {
    const service = new CodeContextService();
    return await service.buildCodeContext(role, undefined, repoRoot);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29kZV9jb250ZXh0X3NlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvY29kZS9jb2RlX2NvbnRleHRfc2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7R0FPRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBOFRILDREQUVDO0FBS0Qsa0NBR0M7QUFLRCw0Q0FNQztBQS9VRCx5REFBNEU7QUFDNUUsMkRBQStFO0FBQy9FLHlDQUFzRTtBQUN0RSxpRUFBd0Y7QUFnQ3hGLCtFQUErRTtBQUMvRSxVQUFVO0FBQ1YsK0VBQStFO0FBRS9FLE1BQWEsa0JBQWtCO0lBYzdCLFlBQVksU0FBbUMsRUFBRTtRQVJqRCxLQUFLO1FBQ0csaUJBQVksR0FBeUMsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUMvRCxhQUFRLEdBQXFDLElBQUksR0FBRyxFQUFFLENBQUM7UUFDdkQsb0JBQWUsR0FBMEMsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUUzRSxhQUFhO1FBQ0wsYUFBUSxHQUFXLENBQUMsR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDLENBQUMsT0FBTztRQUcvQyxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUEsd0NBQXFCLEVBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ3ZELElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBQSwwQ0FBc0IsRUFBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDNUQsSUFBSSxDQUFDLGdCQUFnQixHQUFHLElBQUEsaUNBQXNCLEVBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQy9ELElBQUksQ0FBQyxtQkFBbUIsR0FBRyxJQUFBLGdEQUF5QixFQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUMxRSxDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsV0FBVyxDQUFDLFFBQWdCO1FBQ2hDLE9BQU87UUFDUCxNQUFNLE1BQU0sR0FB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LFNBQVMsRUFBRSxRQUFRLENBQUMsQ0FBQztBQUNuRSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDb2RlIENvbnRleHQgU2VydmljZSAtIOS7o+eggeS4iuS4i+aWh+acjeWKoVxuICogXG4gKiDnu5/kuIDlr7nlpJbmjqXlj6PvvIzorqkgQWdlbnQgVGVhbXMg6YCa6L+H57uf5LiA5o6l5Y+j6I635Y+W5Luj56CB5LiK5LiL5paHXG4gKiBcbiAqIEB2ZXJzaW9uIHYwLjEuMFxuICogQGRhdGUgMjAyNi0wNC0wM1xuICovXG5cbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgdHlwZSB7IFJlcG9Qcm9maWxlLCBSZXBvTWFwLCBFbnRyeXBvaW50LCBDb2RlQ29udGV4dCwgU3ViYWdlbnRSb2xlIH0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgeyBQcm9qZWN0RGV0ZWN0b3IsIGNyZWF0ZVByb2plY3REZXRlY3RvciB9IGZyb20gJy4vcHJvamVjdF9kZXRlY3Rvcic7XG5pbXBvcnQgeyBNb2R1bGVDbGFzc2lmaWVyLCBjcmVhdGVNb2R1bGVDbGFzc2lmaWVyIH0gZnJvbSAnLi9tb2R1bGVfY2xhc3NpZmllcic7XG5pbXBvcnQgeyBSZXBvTWFwR2VuZXJhdG9yLCBjcmVhdGVSZXBvTWFwR2VuZXJhdG9yIH0gZnJvbSAnLi9yZXBvX21hcCc7XG5pbXBvcnQgeyBFbnRyeXBvaW50RGlzY292ZXJ5LCBjcmVhdGVFbnRyeXBvaW50RGlzY292ZXJ5IH0gZnJvbSAnLi9lbnRyeXBvaW50X2Rpc2NvdmVyeSc7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOexu+Wei+WumuS5iVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIOacjeWKoemFjee9rlxuICovXG5leHBvcnQgaW50ZXJmYWNlIENvZGVDb250ZXh0U2VydmljZUNvbmZpZyB7XG4gIC8qKiDpobnnm67mo4DmtYvlmajphY3nva4gKi9cbiAgZGV0ZWN0b3I/OiBhbnk7XG4gIFxuICAvKiog5YiG57G75Zmo6YWN572uICovXG4gIGNsYXNzaWZpZXI/OiBhbnk7XG4gIFxuICAvKiog5Zyw5Zu+55Sf5oiQ5Zmo6YWN572uICovXG4gIHJlcG9NYXA/OiBhbnk7XG4gIFxuICAvKiog5YWl5Y+j54K55Y+R546w5Zmo6YWN572uICovXG4gIGVudHJ5cG9pbnQ/OiBhbnk7XG59XG5cbi8qKlxuICog57yT5a2Y5p2h55uuXG4gKi9cbmludGVyZmFjZSBDYWNoZUVudHJ5PFQ+IHtcbiAgZGF0YTogVDtcbiAgdGltZXN0YW1wOiBudW1iZXI7XG4gIHR0bDogbnVtYmVyO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDku6PnoIHkuIrkuIvmlofmnI3liqFcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGNsYXNzIENvZGVDb250ZXh0U2VydmljZSB7XG4gIHByaXZhdGUgZGV0ZWN0b3I6IFByb2plY3REZXRlY3RvcjtcbiAgcHJpdmF0ZSBjbGFzc2lmaWVyOiBNb2R1bGVDbGFzc2lmaWVyO1xuICBwcml2YXRlIHJlcG9NYXBHZW5lcmF0b3I6IFJlcG9NYXBHZW5lcmF0b3I7XG4gIHByaXZhdGUgZW50cnlwb2ludERpc2NvdmVyeTogRW50cnlwb2ludERpc2NvdmVyeTtcbiAgXG4gIC8vIOe8k+WtmFxuICBwcml2YXRlIHByb2ZpbGVDYWNoZTogTWFwPHN0cmluZywgQ2FjaGVFbnRyeTxSZXBvUHJvZmlsZT4+ID0gbmV3IE1hcCgpO1xuICBwcml2YXRlIG1hcENhY2hlOiBNYXA8c3RyaW5nLCBDYWNoZUVudHJ5PFJlcG9NYXA+PiA9IG5ldyBNYXAoKTtcbiAgcHJpdmF0ZSBlbnRyeXBvaW50Q2FjaGU6IE1hcDxzdHJpbmcsIENhY2hlRW50cnk8RW50cnlwb2ludFtdPj4gPSBuZXcgTWFwKCk7XG4gIFxuICAvLyDnvJPlrZggVFRM77yI5q+r56eS77yJXG4gIHByaXZhdGUgY2FjaGVUdGw6IG51bWJlciA9IDUgKiA2MCAqIDEwMDA7IC8vIDUg5YiG6ZKfXG4gIFxuICBjb25zdHJ1Y3Rvcihjb25maWc6IENvZGVDb250ZXh0U2VydmljZUNvbmZpZyA9IHt9KSB7XG4gICAgdGhpcy5kZXRlY3RvciA9IGNyZWF0ZVByb2plY3REZXRlY3Rvcihjb25maWcuZGV0ZWN0b3IpO1xuICAgIHRoaXMuY2xhc3NpZmllciA9IGNyZWF0ZU1vZHVsZUNsYXNzaWZpZXIoY29uZmlnLmNsYXNzaWZpZXIpO1xuICAgIHRoaXMucmVwb01hcEdlbmVyYXRvciA9IGNyZWF0ZVJlcG9NYXBHZW5lcmF0b3IoY29uZmlnLnJlcG9NYXApO1xuICAgIHRoaXMuZW50cnlwb2ludERpc2NvdmVyeSA9IGNyZWF0ZUVudHJ5cG9pbnREaXNjb3ZlcnkoY29uZmlnLmVudHJ5cG9pbnQpO1xuICB9XG4gIFxuICAvKipcbiAgICog5YiG5p6Q5LuT5bqTXG4gICAqL1xuICBhc3luYyBhbmFseXplUmVwbyhyZXBvUm9vdDogc3RyaW5nKTogUHJvbWlzZTxSZXBvUHJvZmlsZT4ge1xuICAgIC8vIOajgOafpee8k+WtmFxuICAgIGNvbnN0IGNhY2hlZCA9IHRoaXMuZ2V0Q2FjaGVkKHRoaXMucHJvZmlsZUNhY2hlLCByZXBvUm9vdCk7XG4gICAgaWYgKGNhY2hlZCkgcmV0dXJuIGNhY2hlZDtcbiAgICBcbiAgICAvLyDmo4DmtYvpobnnm65cbiAgICBjb25zdCBwcm9maWxlID0gYXdhaXQgdGhpcy5kZXRlY3Rvci5kZXRlY3QocmVwb1Jvb3QpO1xuICAgIFxuICAgIC8vIOWIhuexu+aooeWdl1xuICAgIGNvbnN0IGFsbFBhdGhzID0gYXdhaXQgdGhpcy5jb2xsZWN0QWxsUGF0aHMocmVwb1Jvb3QpO1xuICAgIHByb2ZpbGUuaW1wb3J0YW50UGF0aHMgPSB0aGlzLmNsYXNzaWZpZXIuYnVpbGRJbXBvcnRhbnRQYXRocyhhbGxQYXRocywgcmVwb1Jvb3QpO1xuICAgIFxuICAgIC8vIOe8k+WtmFxuICAgIHRoaXMuc2V0Q2FjaGVkKHRoaXMucHJvZmlsZUNhY2hlLCByZXBvUm9vdCwgcHJvZmlsZSk7XG4gICAgXG4gICAgcmV0dXJuIHByb2ZpbGU7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmnoTlu7rku5PlupPnlLvlg49cbiAgICovXG4gIGFzeW5jIGJ1aWxkUmVwb1Byb2ZpbGUocmVwb1Jvb3Q6IHN0cmluZyk6IFByb21pc2U8UmVwb1Byb2ZpbGU+IHtcbiAgICByZXR1cm4gYXdhaXQgdGhpcy5hbmFseXplUmVwbyhyZXBvUm9vdCk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmnoTlu7rku5PlupPlnLDlm75cbiAgICovXG4gIGFzeW5jIGJ1aWxkUmVwb01hcChyZXBvUm9vdDogc3RyaW5nKTogUHJvbWlzZTxSZXBvTWFwPiB7XG4gICAgLy8g5qOA5p+l57yT5a2YXG4gICAgY29uc3QgY2FjaGVkID0gdGhpcy5nZXRDYWNoZWQodGhpcy5tYXBDYWNoZSwgcmVwb1Jvb3QpO1xuICAgIGlmIChjYWNoZWQpIHJldHVybiBjYWNoZWQ7XG4gICAgXG4gICAgLy8g55Sf5oiQ5Zyw5Zu+XG4gICAgY29uc3QgcmVwb01hcCA9IGF3YWl0IHRoaXMucmVwb01hcEdlbmVyYXRvci5nZW5lcmF0ZShyZXBvUm9vdCk7XG4gICAgXG4gICAgLy8g57yT5a2YXG4gICAgdGhpcy5zZXRDYWNoZWQodGhpcy5tYXBDYWNoZSwgcmVwb1Jvb3QsIHJlcG9NYXApO1xuICAgIFxuICAgIHJldHVybiByZXBvTWFwO1xuICB9XG4gIFxuICAvKipcbiAgICog5Y+R546w5YWl5Y+j54K5XG4gICAqL1xuICBhc3luYyBkaXNjb3ZlckVudHJ5cG9pbnRzKHJlcG9Sb290OiBzdHJpbmcpOiBQcm9taXNlPEVudHJ5cG9pbnRbXT4ge1xuICAgIC8vIOajgOafpee8k+WtmFxuICAgIGNvbnN0IGNhY2hlZCA9IHRoaXMuZ2V0Q2FjaGVkKHRoaXMuZW50cnlwb2ludENhY2hlLCByZXBvUm9vdCk7XG4gICAgaWYgKGNhY2hlZCkgcmV0dXJuIGNhY2hlZDtcbiAgICBcbiAgICAvLyDlj5HnjrDlhaXlj6NcbiAgICBjb25zdCBlbnRyeXBvaW50cyA9IGF3YWl0IHRoaXMuZW50cnlwb2ludERpc2NvdmVyeS5kaXNjb3ZlcihyZXBvUm9vdCk7XG4gICAgXG4gICAgLy8g57yT5a2YXG4gICAgdGhpcy5zZXRDYWNoZWQodGhpcy5lbnRyeXBvaW50Q2FjaGUsIHJlcG9Sb290LCBlbnRyeXBvaW50cyk7XG4gICAgXG4gICAgcmV0dXJuIGVudHJ5cG9pbnRzO1xuICB9XG4gIFxuICAvKipcbiAgICog5p6E5bu65Luj56CB5LiK5LiL5paH77yI57uZIGFnZW50IOS9v+eUqO+8iVxuICAgKi9cbiAgYXN5bmMgYnVpbGRDb2RlQ29udGV4dChcbiAgICByb2xlOiBTdWJhZ2VudFJvbGUgfCBzdHJpbmcsXG4gICAgdGFzaz86IGFueSxcbiAgICByZXBvUm9vdD86IHN0cmluZ1xuICApOiBQcm9taXNlPENvZGVDb250ZXh0PiB7XG4gICAgaWYgKCFyZXBvUm9vdCkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdGFza0lkOiB0YXNrPy5pZCxcbiAgICAgICAgcm9sZSxcbiAgICAgIH07XG4gICAgfVxuICAgIFxuICAgIC8vIOiOt+WPluS7k+W6k+eUu+WDj+WSjOWcsOWbvlxuICAgIGNvbnN0IFtyZXBvUHJvZmlsZSwgcmVwb01hcCwgZW50cnlwb2ludHNdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgdGhpcy5hbmFseXplUmVwbyhyZXBvUm9vdCksXG4gICAgICB0aGlzLmJ1aWxkUmVwb01hcChyZXBvUm9vdCksXG4gICAgICB0aGlzLmRpc2NvdmVyRW50cnlwb2ludHMocmVwb1Jvb3QpLFxuICAgIF0pO1xuICAgIFxuICAgIC8vIOagueaNruinkuiJsuWumuWItuS4iuS4i+aWh1xuICAgIGNvbnN0IGNvbnRleHQ6IENvZGVDb250ZXh0ID0ge1xuICAgICAgdGFza0lkOiB0YXNrPy5pZCxcbiAgICAgIHJvbGUsXG4gICAgICByZXBvUHJvZmlsZSxcbiAgICAgIHJlcG9NYXAsXG4gICAgfTtcbiAgICBcbiAgICAvLyDmjInop5LoibLms6jlhaXnibnlrprkv6Hmga9cbiAgICBzd2l0Y2ggKHJvbGUpIHtcbiAgICAgIGNhc2UgJ3BsYW5uZXInOlxuICAgICAgICAvLyBQbGFubmVyIOmcgOimgSBlbnRyeXBvaW50cyDlkozph43opoHot6/lvoRcbiAgICAgICAgY29udGV4dC5yZXBvUHJvZmlsZS5lbnRyeXBvaW50cyA9IGVudHJ5cG9pbnRzO1xuICAgICAgICBicmVhaztcbiAgICAgICAgXG4gICAgICBjYXNlICdyZXBvX3JlYWRlcic6XG4gICAgICAgIC8vIFJlcG8gUmVhZGVyIOmcgOimgeWujOaVtOeahCByZXBvIG1hcFxuICAgICAgICAvLyDlt7LljIXlkKtcbiAgICAgICAgYnJlYWs7XG4gICAgICAgIFxuICAgICAgY2FzZSAnY29kZV9yZXZpZXdlcic6XG4gICAgICAgIC8vIFJldmlld2VyIOmcgOimgeWFs+azqCB0ZXN0cyDlkozph43opoHmlofku7ZcbiAgICAgICAgY29udGV4dC5yZXBvTWFwLmltcG9ydGFudEZpbGVzID0gcmVwb01hcC5pbXBvcnRhbnRGaWxlcy5maWx0ZXIoXG4gICAgICAgICAgZiA9PiBmLnR5cGUgPT09ICd0ZXN0X2NvbmZpZycgfHwgZi50eXBlID09PSAnY29uZmlnJ1xuICAgICAgICApO1xuICAgICAgICBicmVhaztcbiAgICAgICAgXG4gICAgICBjYXNlICdjb2RlX2ZpeGVyJzpcbiAgICAgICAgLy8gRml4ZXIg6ZyA6KaB5YWz5rOoIGFwcCDlkowgbGliXG4gICAgICAgIGNvbnRleHQucmVwb01hcC5rZXlEaXJlY3RvcmllcyA9IHJlcG9NYXAua2V5RGlyZWN0b3JpZXMuZmlsdGVyKFxuICAgICAgICAgIGQgPT4gZC5jYXRlZ29yeSA9PT0gJ2FwcCcgfHwgZC5jYXRlZ29yeSA9PT0gJ2xpYidcbiAgICAgICAgKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAgIFxuICAgICAgY2FzZSAndmVyaWZ5X2FnZW50JzpcbiAgICAgICAgLy8gVmVyaWZpZXIg6ZyA6KaB5YWz5rOoIHRlc3RzXG4gICAgICAgIGNvbnRleHQucmVwb01hcC5rZXlEaXJlY3RvcmllcyA9IHJlcG9NYXAua2V5RGlyZWN0b3JpZXMuZmlsdGVyKFxuICAgICAgICAgIGQgPT4gZC5jYXRlZ29yeSA9PT0gJ3Rlc3RzJ1xuICAgICAgICApO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGNvbnRleHQ7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmuIXpmaTnvJPlrZhcbiAgICovXG4gIGNsZWFyQ2FjaGUocmVwb1Jvb3Q/OiBzdHJpbmcpOiB2b2lkIHtcbiAgICBpZiAocmVwb1Jvb3QpIHtcbiAgICAgIHRoaXMucHJvZmlsZUNhY2hlLmRlbGV0ZShyZXBvUm9vdCk7XG4gICAgICB0aGlzLm1hcENhY2hlLmRlbGV0ZShyZXBvUm9vdCk7XG4gICAgICB0aGlzLmVudHJ5cG9pbnRDYWNoZS5kZWxldGUocmVwb1Jvb3QpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnByb2ZpbGVDYWNoZS5jbGVhcigpO1xuICAgICAgdGhpcy5tYXBDYWNoZS5jbGVhcigpO1xuICAgICAgdGhpcy5lbnRyeXBvaW50Q2FjaGUuY2xlYXIoKTtcbiAgICB9XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDorr7nva7nvJPlrZggVFRMXG4gICAqL1xuICBzZXRDYWNoZVR0bCh0dGxNczogbnVtYmVyKTogdm9pZCB7XG4gICAgdGhpcy5jYWNoZVR0bCA9IHR0bE1zO1xuICB9XG4gIFxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIC8vIOWGhemDqOaWueazlVxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIFxuICAvKipcbiAgICog5pS26ZuG5omA5pyJ6Lev5b6EXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGNvbGxlY3RBbGxQYXRocyhyZXBvUm9vdDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuICAgIGNvbnN0IHBhdGhzOiBzdHJpbmdbXSA9IFtdO1xuICAgIFxuICAgIHRyeSB7XG4gICAgICBjb25zdCBlbnRyaWVzID0gYXdhaXQgdGhpcy53YWxrRGlyZWN0b3J5KHJlcG9Sb290LCAyKTtcbiAgICAgIHBhdGhzLnB1c2goLi4uZW50cmllcyk7XG4gICAgfSBjYXRjaCB7XG4gICAgICAvLyDlv73nlaXplJnor69cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHBhdGhzO1xuICB9XG4gIFxuICAvKipcbiAgICog6YGN5Y6G55uu5b2VXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIHdhbGtEaXJlY3RvcnkoXG4gICAgZGlyOiBzdHJpbmcsXG4gICAgbWF4RGVwdGg6IG51bWJlcixcbiAgICBkZXB0aDogbnVtYmVyID0gMFxuICApOiBQcm9taXNlPHN0cmluZ1tdPiB7XG4gICAgaWYgKGRlcHRoID49IG1heERlcHRoKSByZXR1cm4gW107XG4gICAgXG4gICAgY29uc3QgcGF0aHM6IHN0cmluZ1tdID0gW107XG4gICAgY29uc3QgZnMgPSBhd2FpdCBpbXBvcnQoJ2ZzL3Byb21pc2VzJyk7XG4gICAgY29uc3QgcGF0aE1vZCA9IGF3YWl0IGltcG9ydCgncGF0aCcpO1xuICAgIFxuICAgIHRyeSB7XG4gICAgICBjb25zdCBlbnRyaWVzID0gYXdhaXQgZnMucmVhZGRpcihkaXIsIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KTtcbiAgICAgIFxuICAgICAgZm9yIChjb25zdCBlbnRyeSBvZiBlbnRyaWVzKSB7XG4gICAgICAgIGNvbnN0IGZ1bGxQYXRoID0gcGF0aE1vZC5qb2luKGRpciwgZW50cnkubmFtZSk7XG4gICAgICAgIGNvbnN0IHJlbGF0aXZlUGF0aCA9IHBhdGhNb2QucmVsYXRpdmUodGhpcy5nZXRSZXBvUm9vdChkaXIpLCBmdWxsUGF0aCk7XG4gICAgICAgIFxuICAgICAgICAvLyDmjpLpmaTluLjop4Hnm67lvZVcbiAgICAgICAgY29uc3QgZXhjbHVkZURpcnMgPSBbJ25vZGVfbW9kdWxlcycsICdfX3B5Y2FjaGVfXycsICcuZ2l0JywgJ2Rpc3QnLCAnYnVpbGQnXTtcbiAgICAgICAgaWYgKGVudHJ5LmlzRGlyZWN0b3J5KCkgJiYgZXhjbHVkZURpcnMuaW5jbHVkZXMoZW50cnkubmFtZSkpIGNvbnRpbnVlO1xuICAgICAgICBcbiAgICAgICAgcGF0aHMucHVzaChyZWxhdGl2ZVBhdGgpO1xuICAgICAgICBcbiAgICAgICAgaWYgKGVudHJ5LmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgICAgICBjb25zdCBzdWJQYXRocyA9IGF3YWl0IHRoaXMud2Fsa0RpcmVjdG9yeShmdWxsUGF0aCwgbWF4RGVwdGgsIGRlcHRoICsgMSk7XG4gICAgICAgICAgcGF0aHMucHVzaCguLi5zdWJQYXRocyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGNhdGNoIHtcbiAgICAgIC8vIOW/veeVpemUmeivr1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gcGF0aHM7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDojrflj5bku5PlupPmoLnnm67lvZXvvIjnlKjkuo4gd2Fsa0RpcmVjdG9yee+8iVxuICAgKi9cbiAgcHJpdmF0ZSBnZXRSZXBvUm9vdChkaXI6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgLy8g566A5Y2V5a6e546w77ya6L+U5Zue56ys5LiA5Liq5Y+C5pWw5L2c5Li6IHJlcG9Sb290XG4gICAgLy8g5a6e6ZmF5bqU6K+l5a2Y5YKoIHJlcG9Sb290IOS9nOS4uuWunuS+i+WxnuaAp1xuICAgIHJldHVybiBkaXI7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDojrflj5bnvJPlrZhcbiAgICovXG4gIHByaXZhdGUgZ2V0Q2FjaGVkPFQ+KGNhY2hlOiBNYXA8c3RyaW5nLCBDYWNoZUVudHJ5PFQ+Piwga2V5OiBzdHJpbmcpOiBUIHwgbnVsbCB7XG4gICAgY29uc3QgZW50cnkgPSBjYWNoZS5nZXQoa2V5KTtcbiAgICBpZiAoIWVudHJ5KSByZXR1cm4gbnVsbDtcbiAgICBcbiAgICAvLyDmo4Dmn6XmmK/lkKbov4fmnJ9cbiAgICBpZiAoRGF0ZS5ub3coKSAtIGVudHJ5LnRpbWVzdGFtcCA+IGVudHJ5LnR0bCkge1xuICAgICAgY2FjaGUuZGVsZXRlKGtleSk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGVudHJ5LmRhdGE7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDorr7nva7nvJPlrZhcbiAgICovXG4gIHByaXZhdGUgc2V0Q2FjaGVkPFQ+KGNhY2hlOiBNYXA8c3RyaW5nLCBDYWNoZUVudHJ5PFQ+Piwga2V5OiBzdHJpbmcsIGRhdGE6IFQpOiB2b2lkIHtcbiAgICBjYWNoZS5zZXQoa2V5LCB7XG4gICAgICBkYXRhLFxuICAgICAgdGltZXN0YW1wOiBEYXRlLm5vdygpLFxuICAgICAgdHRsOiB0aGlzLmNhY2hlVHRsLFxuICAgIH0pO1xuICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOS+v+aNt+WHveaVsFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIOWIm+W7uuS7o+eggeS4iuS4i+aWh+acjeWKoVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ29kZUNvbnRleHRTZXJ2aWNlKGNvbmZpZz86IENvZGVDb250ZXh0U2VydmljZUNvbmZpZyk6IENvZGVDb250ZXh0U2VydmljZSB7XG4gIHJldHVybiBuZXcgQ29kZUNvbnRleHRTZXJ2aWNlKGNvbmZpZyk7XG59XG5cbi8qKlxuICog5b+r6YCf5YiG5p6Q5LuT5bqTXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBhbmFseXplUmVwbyhyZXBvUm9vdDogc3RyaW5nKTogUHJvbWlzZTxSZXBvUHJvZmlsZT4ge1xuICBjb25zdCBzZXJ2aWNlID0gbmV3IENvZGVDb250ZXh0U2VydmljZSgpO1xuICByZXR1cm4gYXdhaXQgc2VydmljZS5hbmFseXplUmVwbyhyZXBvUm9vdCk7XG59XG5cbi8qKlxuICog5b+r6YCf5p6E5bu65Luj56CB5LiK5LiL5paHXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBidWlsZENvZGVDb250ZXh0KFxuICByb2xlOiBTdWJhZ2VudFJvbGUgfCBzdHJpbmcsXG4gIHJlcG9Sb290OiBzdHJpbmdcbik6IFByb21pc2U8Q29kZUNvbnRleHQ+IHtcbiAgY29uc3Qgc2VydmljZSA9IG5ldyBDb2RlQ29udGV4dFNlcnZpY2UoKTtcbiAgcmV0dXJuIGF3YWl0IHNlcnZpY2UuYnVpbGRDb2RlQ29udGV4dChyb2xlLCB1bmRlZmluZWQsIHJlcG9Sb290KTtcbn1cbiJdfQ==