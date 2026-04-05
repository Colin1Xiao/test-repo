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

import type {
  SkillPackageDescriptor,
  SkillDependency,
  SkillDependencyGraph,
  SkillDependencyNode,
  SkillConflict,
  SkillResolutionResult,
  SkillInstallPlan,
  SkillInstallStep,
} from './types';
import { SkillRegistry } from './skill_registry';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 解析器配置
 */
export interface ResolverConfig {
  /** 最大解析深度 */
  maxDepth?: number;
  
  /** 是否允许循环依赖 */
  allowCircular?: boolean;
}

// ============================================================================
// 依赖解析器
// ============================================================================

export class SkillResolver {
  private config: Required<ResolverConfig>;
  private registry: SkillRegistry;
  
  constructor(registry: SkillRegistry, config: ResolverConfig = {}) {
    this.config = {
      maxDepth: config.maxDepth ?? 10,
      allowCircular: config.allowCircular ?? false,
    };
    this.registry = registry;
  }
  
  /**
   * 解析依赖
   */
  async resolveDependencies(
    targets: Array<{ name: string; version?: string }>,
    options?: { depth?: number }
  ): Promise<SkillResolutionResult> {
    const resolvedPackages: SkillPackageDescriptor[] = [];
    const missingDependencies: string[] = [];
    const conflicts: SkillConflict[] = [];
    const cycles: string[][] = [];
    
    const visited = new Set<string>();
    const stack = new Set<string>();
    
    // 递归解析
    const resolve = async (name: string, version?: string, depth: number = 0): Promise<void> => {
      if (depth > this.config.maxDepth) {
        return;
      }
      
      const key = `${name}@${version || 'latest'}`;
      
      // 检查循环依赖
      if (stack.has(key)) {
        if (!this.config.allowCircular) {
          // 检测循环
          const cycle = Array.from(stack).concat(key);
          cycles.push(cycle);
        }
        return;
      }
      
      // 检查是否已解析
      if (visited.has(key)) {
        return;
      }
      
      stack.add(key);
      
      // 获取 package
      const queryResult = this.registry.getSkill(name, version);
      
      if (!queryResult.found || !queryResult.package) {
        missingDependencies.push(key);
        stack.delete(key);
        return;
      }
      
      const pkg = queryResult.package;
      resolvedPackages.push(pkg);
      visited.add(key);
      
      // 解析依赖
      for (const dep of pkg.manifest.dependencies) {
        if (dep.required) {
          await resolve(dep.name, dep.version, depth + 1);
        }
      }
      
      stack.delete(key);
    };
    
    // 解析所有目标
    for (const target of targets) {
      await resolve(target.name, target.version);
    }
    
    // 检查冲突
    const byName = new Map<string, SkillPackageDescriptor[]>();
    for (const pkg of resolvedPackages) {
      const existing = byName.get(pkg.manifest.name) || [];
      existing.push(pkg);
      byName.set(pkg.manifest.name, existing);
    }
    
    for (const [name, packages] of byName.entries()) {
      if (packages.length > 1) {
        const versions = packages.map(p => p.manifest.version).join(', ');
        conflicts.push({
          type: 'version',
          skills: packages.map(p => `${p.manifest.name}@${p.manifest.version}`),
          reason: `Multiple versions of ${name}: ${versions}`,
        });
      }
    }
    
    return {
      success: missingDependencies.length === 0 && cycles.length === 0,
      resolvedPackages,
      missingDependencies,
      conflicts,
      cycles,
    };
  }
  
  /**
   * 构建依赖图
   */
  buildDependencyGraph(
    packages: SkillPackageDescriptor[]
  ): SkillDependencyGraph {
    const nodes = new Map<string, SkillDependencyNode>();
    const edges = new Map<string, string[]>();
    
    // 创建节点
    for (const pkg of packages) {
      const key = `${pkg.manifest.name}@${pkg.manifest.version}`;
      nodes.set(key, {
        name: pkg.manifest.name,
        version: pkg.manifest.version,
        dependents: [],
        dependencies: pkg.manifest.dependencies,
      });
      edges.set(key, []);
    }
    
    // 创建边
    for (const pkg of packages) {
      const fromKey = `${pkg.manifest.name}@${pkg.manifest.version}`;
      
      for (const dep of pkg.manifest.dependencies) {
        const toKey = `${dep.name}@${dep.version}`;
        
        if (nodes.has(toKey)) {
          const existing = edges.get(fromKey) || [];
          existing.push(toKey);
          edges.set(fromKey, existing);
          
          // 更新 dependents
          const toNode = nodes.get(toKey);
          if (toNode) {
            toNode.dependents.push(fromKey);
          }
        }
      }
    }
    
    return { nodes, edges };
  }
  
  /**
   * 检测冲突
   */
  detectConflicts(packages: SkillPackageDescriptor[]): SkillConflict[] {
    const conflicts: SkillConflict[] = [];
    
    // 按名称分组
    const byName = new Map<string, SkillPackageDescriptor[]>();
    for (const pkg of packages) {
      const existing = byName.get(pkg.manifest.name) || [];
      existing.push(pkg);
      byName.set(pkg.manifest.name, existing);
    }
    
    // 检查版本冲突
    for (const [name, pkgs] of byName.entries()) {
      if (pkgs.length > 1) {
        const versions = pkgs.map(p => p.manifest.version).join(', ');
        conflicts.push({
          type: 'version',
          skills: pkgs.map(p => `${p.manifest.name}@${p.manifest.version}`),
          reason: `Multiple versions of ${name}: ${versions}`,
        });
      }
    }
    
    return conflicts;
  }
  
  /**
   * 检测循环依赖
   */
  detectCycles(graph: SkillDependencyGraph): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const stack = new Set<string>();
    const path: string[] = [];
    
    const dfs = (node: string): void => {
      if (stack.has(node)) {
        // 找到循环
        const cycleStart = path.indexOf(node);
        const cycle = path.slice(cycleStart).concat(node);
        cycles.push(cycle);
        return;
      }
      
      if (visited.has(node)) {
        return;
      }
      
      visited.add(node);
      stack.add(node);
      path.push(node);
      
      const edges = graph.edges.get(node) || [];
      for (const neighbor of edges) {
        dfs(neighbor);
      }
      
      path.pop();
      stack.delete(node);
    };
    
    for (const node of graph.nodes.keys()) {
      dfs(node);
    }
    
    return cycles;
  }
  
  /**
   * 计算安装计划
   */
  async computeInstallPlan(
    targets: Array<{ name: string; version?: string }>
  ): Promise<SkillInstallPlan> {
    const toInstall: SkillPackageDescriptor[] = [];
    const toUpdate: SkillPackageDescriptor[] = [];
    const toSkip: string[] = [];
    const steps: SkillInstallStep[] = [];
    
    // Step 1: 解析依赖
    steps.push({
      name: 'resolve_dependencies',
      description: 'Resolving dependencies',
      completed: false,
    });
    
    const resolution = await this.resolveDependencies(targets);
    steps[0].completed = true;
    steps[0].success = resolution.success;
    
    if (!resolution.success) {
      return { toInstall, toUpdate, toSkip, steps };
    }
    
    // Step 2: 检查已安装的
    steps.push({
      name: 'check_installed',
      description: 'Checking already installed skills',
      completed: false,
    });
    
    for (const pkg of resolution.resolvedPackages) {
      const existing = this.registry.getSkill(pkg.manifest.name, pkg.manifest.version);
      
      if (existing.found && existing.package) {
        // 已安装，跳过
        toSkip.push(pkg.id);
      } else {
        // 需要安装
        toInstall.push(pkg);
      }
    }
    
    steps[1].completed = true;
    steps[1].success = true;
    
    return { toInstall, toUpdate, toSkip, steps };
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建依赖解析器
 */
export function createSkillResolver(
  registry: SkillRegistry,
  config?: ResolverConfig
): SkillResolver {
  return new SkillResolver(registry, config);
}

/**
 * 快速解析依赖
 */
export async function resolveSkillDependencies(
  registry: SkillRegistry,
  targets: Array<{ name: string; version?: string }>
): Promise<SkillResolutionResult> {
  const resolver = new SkillResolver(registry);
  return await resolver.resolveDependencies(targets);
}
