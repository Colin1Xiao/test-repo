/**
 * Code Context Service - 代码上下文服务
 * 
 * 统一对外接口，让 Agent Teams 通过统一接口获取代码上下文
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import * as path from 'path';
import type { RepoProfile, RepoMap, Entrypoint, CodeContext, SubagentRole } from './types';
import { ProjectDetector, createProjectDetector } from './project_detector';
import { ModuleClassifier, createModuleClassifier } from './module_classifier';
import { RepoMapGenerator, createRepoMapGenerator } from './repo_map';
import { EntrypointDiscovery, createEntrypointDiscovery } from './entrypoint_discovery';

// ============================================================================
// 类型定义
// ============================================================================

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

/**
 * 缓存条目
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// ============================================================================
// 代码上下文服务
// ============================================================================

export class CodeContextService {
  private detector: ProjectDetector;
  private classifier: ModuleClassifier;
  private repoMapGenerator: RepoMapGenerator;
  private entrypointDiscovery: EntrypointDiscovery;
  
  // 缓存
  private profileCache: Map<string, CacheEntry<RepoProfile>> = new Map();
  private mapCache: Map<string, CacheEntry<RepoMap>> = new Map();
  private entrypointCache: Map<string, CacheEntry<Entrypoint[]>> = new Map();
  
  // 缓存 TTL（毫秒）
  private cacheTtl: number = 5 * 60 * 1000; // 5 分钟
  
  constructor(config: CodeContextServiceConfig = {}) {
    this.detector = createProjectDetector(config.detector);
    this.classifier = createModuleClassifier(config.classifier);
    this.repoMapGenerator = createRepoMapGenerator(config.repoMap);
    this.entrypointDiscovery = createEntrypointDiscovery(config.entrypoint);
  }
  
  /**
   * 分析仓库
   */
  async analyzeRepo(repoRoot: string): Promise<RepoProfile> {
    // 检查缓存
    const cached = this.getCached(this.profileCache, repoRoot);
    if (cached) return cached;
    
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
  async buildRepoProfile(repoRoot: string): Promise<RepoProfile> {
    return await this.analyzeRepo(repoRoot);
  }
  
  /**
   * 构建仓库地图
   */
  async buildRepoMap(repoRoot: string): Promise<RepoMap> {
    // 检查缓存
    const cached = this.getCached(this.mapCache, repoRoot);
    if (cached) return cached;
    
    // 生成地图
    const repoMap = await this.repoMapGenerator.generate(repoRoot);
    
    // 缓存
    this.setCached(this.mapCache, repoRoot, repoMap);
    
    return repoMap;
  }
  
  /**
   * 发现入口点
   */
  async discoverEntrypoints(repoRoot: string): Promise<Entrypoint[]> {
    // 检查缓存
    const cached = this.getCached(this.entrypointCache, repoRoot);
    if (cached) return cached;
    
    // 发现入口
    const entrypoints = await this.entrypointDiscovery.discover(repoRoot);
    
    // 缓存
    this.setCached(this.entrypointCache, repoRoot, entrypoints);
    
    return entrypoints;
  }
  
  /**
   * 构建代码上下文（给 agent 使用）
   */
  async buildCodeContext(
    role: SubagentRole | string,
    task?: any,
    repoRoot?: string
  ): Promise<CodeContext> {
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
    const context: CodeContext = {
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
        context.repoMap.importantFiles = repoMap.importantFiles.filter(
          f => f.type === 'test_config' || f.type === 'config'
        );
        break;
        
      case 'code_fixer':
        // Fixer 需要关注 app 和 lib
        context.repoMap.keyDirectories = repoMap.keyDirectories.filter(
          d => d.category === 'app' || d.category === 'lib'
        );
        break;
        
      case 'verify_agent':
        // Verifier 需要关注 tests
        context.repoMap.keyDirectories = repoMap.keyDirectories.filter(
          d => d.category === 'tests'
        );
        break;
    }
    
    return context;
  }
  
  /**
   * 清除缓存
   */
  clearCache(repoRoot?: string): void {
    if (repoRoot) {
      this.profileCache.delete(repoRoot);
      this.mapCache.delete(repoRoot);
      this.entrypointCache.delete(repoRoot);
    } else {
      this.profileCache.clear();
      this.mapCache.clear();
      this.entrypointCache.clear();
    }
  }
  
  /**
   * 设置缓存 TTL
   */
  setCacheTtl(ttlMs: number): void {
    this.cacheTtl = ttlMs;
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 收集所有路径
   */
  private async collectAllPaths(repoRoot: string): Promise<string[]> {
    const paths: string[] = [];
    
    try {
      const entries = await this.walkDirectory(repoRoot, 2);
      paths.push(...entries);
    } catch {
      // 忽略错误
    }
    
    return paths;
  }
  
  /**
   * 遍历目录
   */
  private async walkDirectory(
    dir: string,
    maxDepth: number,
    depth: number = 0
  ): Promise<string[]> {
    if (depth >= maxDepth) return [];
    
    const paths: string[] = [];
    const fs = await import('fs/promises');
    const pathMod = await import('path');
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = pathMod.join(dir, entry.name);
        const relativePath = pathMod.relative(this.getRepoRoot(dir), fullPath);
        
        // 排除常见目录
        const excludeDirs = ['node_modules', '__pycache__', '.git', 'dist', 'build'];
        if (entry.isDirectory() && excludeDirs.includes(entry.name)) continue;
        
        paths.push(relativePath);
        
        if (entry.isDirectory()) {
          const subPaths = await this.walkDirectory(fullPath, maxDepth, depth + 1);
          paths.push(...subPaths);
        }
      }
    } catch {
      // 忽略错误
    }
    
    return paths;
  }
  
  /**
   * 获取仓库根目录（用于 walkDirectory）
   */
  private getRepoRoot(dir: string): string {
    // 简单实现：返回第一个参数作为 repoRoot
    // 实际应该存储 repoRoot 作为实例属性
    return dir;
  }
  
  /**
   * 获取缓存
   */
  private getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
    const entry = cache.get(key);
    if (!entry) return null;
    
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
  private setCached<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T): void {
    cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: this.cacheTtl,
    });
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建代码上下文服务
 */
export function createCodeContextService(config?: CodeContextServiceConfig): CodeContextService {
  return new CodeContextService(config);
}

/**
 * 快速分析仓库
 */
export async function analyzeRepo(repoRoot: string): Promise<RepoProfile> {
  const service = new CodeContextService();
  return await service.analyzeRepo(repoRoot);
}

/**
 * 快速构建代码上下文
 */
export async function buildCodeContext(
  role: SubagentRole | string,
  repoRoot: string
): Promise<CodeContext> {
  const service = new CodeContextService();
  return await service.buildCodeContext(role, undefined, repoRoot);
}
