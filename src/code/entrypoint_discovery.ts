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

import * as fs from 'fs/promises';
import * as path from 'path';
import type { Entrypoint, EntrypointType } from './types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 发现器配置
 */
export interface EntrypointDiscoveryConfig {
  /** 包含子目录 */
  includeSubdirs?: boolean;
  
  /** 最大深度 */
  maxDepth?: number;
}

/**
 * 入口点模式
 */
interface EntrypointPattern {
  /** 文件模式 */
  pattern: string;
  
  /** 入口类型 */
  type: EntrypointType;
  
  /** 置信度 */
  confidence: 'primary' | 'secondary' | 'possible';
  
  /** 描述 */
  description: string;
  
  /** 语言 */
  language?: string;
  
  /** 框架 */
  framework?: string;
}

// ============================================================================
// 入口点模式定义
// ============================================================================

const ENTRYPOINT_PATTERNS: EntrypointPattern[] = [
  // === TypeScript / JavaScript ===
  
  // Main entries
  { pattern: 'src/main.ts', type: 'app', confidence: 'primary', description: 'TypeScript main entry', language: 'TypeScript' },
  { pattern: 'src/main.js', type: 'app', confidence: 'primary', description: 'JavaScript main entry', language: 'JavaScript' },
  { pattern: 'src/main.tsx', type: 'app', confidence: 'primary', description: 'TypeScript React main entry', language: 'TypeScript' },
  { pattern: 'main.ts', type: 'app', confidence: 'secondary', description: 'TypeScript main entry (root)', language: 'TypeScript' },
  { pattern: 'main.js', type: 'app', confidence: 'secondary', description: 'JavaScript main entry (root)', language: 'JavaScript' },
  
  // Index entries
  { pattern: 'src/index.ts', type: 'library', confidence: 'primary', description: 'TypeScript library index', language: 'TypeScript' },
  { pattern: 'src/index.js', type: 'library', confidence: 'primary', description: 'JavaScript library index', language: 'JavaScript' },
  { pattern: 'src/index.tsx', type: 'app', confidence: 'primary', description: 'TypeScript React index', language: 'TypeScript' },
  { pattern: 'index.ts', type: 'library', confidence: 'secondary', description: 'TypeScript index (root)', language: 'TypeScript' },
  { pattern: 'index.js', type: 'library', confidence: 'secondary', description: 'JavaScript index (root)', language: 'JavaScript' },
  
  // App entries
  { pattern: 'src/app.ts', type: 'app', confidence: 'primary', description: 'TypeScript app entry', language: 'TypeScript' },
  { pattern: 'src/app.tsx', type: 'app', confidence: 'primary', description: 'TypeScript React app', language: 'TypeScript' },
  { pattern: 'src/app.js', type: 'app', confidence: 'secondary', description: 'JavaScript app entry', language: 'JavaScript' },
  { pattern: 'app.ts', type: 'app', confidence: 'secondary', description: 'TypeScript app (root)', language: 'TypeScript' },
  { pattern: 'app.js', type: 'app', confidence: 'secondary', description: 'JavaScript app (root)', language: 'JavaScript' },
  
  // Server entries
  { pattern: 'src/server.ts', type: 'server', confidence: 'primary', description: 'TypeScript server entry', language: 'TypeScript' },
  { pattern: 'src/server.js', type: 'server', confidence: 'primary', description: 'JavaScript server entry', language: 'JavaScript' },
  { pattern: 'server.ts', type: 'server', confidence: 'secondary', description: 'TypeScript server (root)', language: 'TypeScript' },
  { pattern: 'server.js', type: 'server', confidence: 'secondary', description: 'JavaScript server (root)', language: 'JavaScript' },
  
  // CLI entries
  { pattern: 'src/cli.ts', type: 'cli', confidence: 'primary', description: 'TypeScript CLI entry', language: 'TypeScript' },
  { pattern: 'src/cli.js', type: 'cli', confidence: 'primary', description: 'JavaScript CLI entry', language: 'JavaScript' },
  { pattern: 'bin/cli.js', type: 'cli', confidence: 'primary', description: 'Node.js CLI binary', language: 'JavaScript' },
  { pattern: 'bin/www', type: 'server', confidence: 'primary', description: 'Node.js www binary', language: 'JavaScript' },
  
  // Next.js pages
  { pattern: 'pages/index.tsx', type: 'page', confidence: 'primary', description: 'Next.js home page', language: 'TypeScript', framework: 'Next.js' },
  { pattern: 'pages/index.js', type: 'page', confidence: 'primary', description: 'Next.js home page', language: 'JavaScript', framework: 'Next.js' },
  { pattern: 'pages/_app.tsx', type: 'config', confidence: 'secondary', description: 'Next.js app wrapper', language: 'TypeScript', framework: 'Next.js' },
  { pattern: 'pages/_app.js', type: 'config', confidence: 'secondary', description: 'Next.js app wrapper', language: 'JavaScript', framework: 'Next.js' },
  { pattern: 'pages/api/[...].ts', type: 'api', confidence: 'primary', description: 'Next.js API route', language: 'TypeScript', framework: 'Next.js' },
  { pattern: 'pages/api/[...].js', type: 'api', confidence: 'primary', description: 'Next.js API route', language: 'JavaScript', framework: 'Next.js' },
  
  // Next.js 13+ app router
  { pattern: 'app/page.tsx', type: 'page', confidence: 'primary', description: 'Next.js 13+ home page', language: 'TypeScript', framework: 'Next.js' },
  { pattern: 'app/page.js', type: 'page', confidence: 'primary', description: 'Next.js 13+ home page', language: 'JavaScript', framework: 'Next.js' },
  { pattern: 'app/layout.tsx', type: 'config', confidence: 'primary', description: 'Next.js 13+ root layout', language: 'TypeScript', framework: 'Next.js' },
  { pattern: 'app/layout.js', type: 'config', confidence: 'primary', description: 'Next.js 13+ root layout', language: 'JavaScript', framework: 'Next.js' },
  
  // Worker entries
  { pattern: 'src/worker.ts', type: 'worker', confidence: 'primary', description: 'TypeScript worker entry', language: 'TypeScript' },
  { pattern: 'src/worker.js', type: 'worker', confidence: 'primary', description: 'JavaScript worker entry', language: 'JavaScript' },
  { pattern: 'worker.ts', type: 'worker', confidence: 'secondary', description: 'TypeScript worker (root)', language: 'TypeScript' },
  
  // === Python ===
  
  // Main entries
  { pattern: 'main.py', type: 'app', confidence: 'primary', description: 'Python main entry', language: 'Python' },
  { pattern: 'src/main.py', type: 'app', confidence: 'primary', description: 'Python main entry (src)', language: 'Python' },
  
  // App entries
  { pattern: 'app.py', type: 'app', confidence: 'primary', description: 'Python app (Flask/FastAPI)', language: 'Python' },
  { pattern: 'src/app.py', type: 'app', confidence: 'primary', description: 'Python app (src)', language: 'Python' },
  
  // Django
  { pattern: 'manage.py', type: 'app', confidence: 'primary', description: 'Django management', language: 'Python', framework: 'Django' },
  { pattern: 'wsgi.py', type: 'server', confidence: 'secondary', description: 'WSGI entry', language: 'Python' },
  { pattern: 'asgi.py', type: 'server', confidence: 'secondary', description: 'ASGI entry', language: 'Python' },
  
  // CLI
  { pattern: 'cli.py', type: 'cli', confidence: 'primary', description: 'Python CLI entry', language: 'Python' },
  { pattern: 'src/cli.py', type: 'cli', confidence: 'primary', description: 'Python CLI entry (src)', language: 'Python' },
  
  // === Rust ===
  
  { pattern: 'src/main.rs', type: 'app', confidence: 'primary', description: 'Rust main entry', language: 'Rust' },
  { pattern: 'src/lib.rs', type: 'library', confidence: 'primary', description: 'Rust library entry', language: 'Rust' },
  { pattern: 'src/bin/[...].rs', type: 'cli', confidence: 'primary', description: 'Rust binary', language: 'Rust' },
  
  // === Go ===
  
  { pattern: 'main.go', type: 'app', confidence: 'primary', description: 'Go main entry', language: 'Go' },
  { pattern: 'cmd/[...]/main.go', type: 'app', confidence: 'primary', description: 'Go cmd entry', language: 'Go' },
  
  // === Java ===
  
  { pattern: 'src/main/java/[...]/Application.java', type: 'app', confidence: 'primary', description: 'Spring Boot application', language: 'Java', framework: 'Spring Boot' },
  { pattern: 'src/main/java/[...]/Main.java', type: 'app', confidence: 'secondary', description: 'Java main class', language: 'Java' },
];

// ============================================================================
// 入口点发现器
// ============================================================================

export class EntrypointDiscovery {
  private config: Required<EntrypointDiscoveryConfig>;
  
  constructor(config: EntrypointDiscoveryConfig = {}) {
    this.config = {
      includeSubdirs: config.includeSubdirs ?? true,
      maxDepth: config.maxDepth ?? 3,
    };
  }
  
  /**
   * 发现入口点
   */
  async discover(repoRoot: string): Promise<Entrypoint[]> {
    const entrypoints: Entrypoint[] = [];
    
    // 1. 基于模式匹配发现
    const patternMatches = await this.discoverByPatterns(repoRoot);
    entrypoints.push(...patternMatches);
    
    // 2. 基于 package.json bin 发现
    const packageBinEntries = await this.discoverPackageBin(repoRoot);
    entrypoints.push(...packageBinEntries);
    
    // 3. 基于 pyproject.toml 发现
    const pyprojectEntries = await this.discoverPyprojectEntrypoints(repoRoot);
    entrypoints.push(...pyprojectEntries);
    
    // 4. 基于 Cargo.toml 发现
    const cargoEntries = await this.discoverCargoEntrypoints(repoRoot);
    entrypoints.push(...cargoEntries);
    
    // 去重并排序
    const unique = this.deduplicate(entrypoints);
    unique.sort((a, b) => {
      // 按置信度排序
      const confidenceOrder = { primary: 0, secondary: 1, possible: 2 };
      return confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
    });
    
    return unique;
  }
  
  /**
   * 基于模式匹配发现
   */
  private async discoverByPatterns(repoRoot: string): Promise<Entrypoint[]> {
    const entrypoints: Entrypoint[] = [];
    
    for (const { pattern, type, confidence, description, language, framework } of ENTRYPOINT_PATTERNS) {
      // 处理通配符模式
      if (pattern.includes('[...]')) {
        // 通配符模式，需要扫描目录
        const matches = await this.discoverWildcardPatterns(repoRoot, pattern);
        for (const match of matches) {
          entrypoints.push({
            path: match,
            type,
            confidence,
            description: description.replace('[...]', path.basename(match)),
            language,
          });
        }
      } else {
        // 精确模式
        const filePath = path.join(repoRoot, pattern);
        try {
          await fs.access(filePath);
          entrypoints.push({
            path: pattern,
            type,
            confidence,
            description,
            language,
            ...(framework ? { description: `${description} (${framework})` } : {}),
          });
        } catch {
          // 文件不存在
        }
      }
    }
    
    return entrypoints;
  }
  
  /**
   * 发现通配符模式匹配
   */
  private async discoverWildcardPatterns(
    repoRoot: string,
    pattern: string
  ): Promise<string[]> {
    const matches: string[] = [];
    const basePattern = pattern.replace(/\[...\]/g, '*');
    
    // 简单实现：扫描常见目录
    const searchDirs = ['src', 'cmd', 'bin', 'app', ''];
    
    for (const dir of searchDirs) {
      const searchPath = dir ? path.join(repoRoot, dir) : repoRoot;
      try {
        const entries = await fs.readdir(searchPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile() && this.matchesPattern(entry.name, basePattern)) {
            const relativePath = dir ? path.join(dir, entry.name) : entry.name;
            matches.push(relativePath);
          }
        }
      } catch {
        // 目录不存在
      }
    }
    
    return matches.slice(0, 5); // 限制返回数量
  }
  
  /**
   * 基于 package.json bin 发现
   */
  private async discoverPackageBin(repoRoot: string): Promise<Entrypoint[]> {
    const entrypoints: Entrypoint[] = [];
    
    try {
      const packageJsonPath = path.join(repoRoot, 'package.json');
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);
      
      // bin 字段可以是字符串或对象
      if (typeof packageJson.bin === 'string') {
        entrypoints.push({
          path: packageJson.bin,
          type: 'cli',
          confidence: 'primary',
          description: `CLI binary: ${path.basename(packageJson.bin)}`,
          language: 'JavaScript',
        });
      } else if (typeof packageJson.bin === 'object') {
        for (const [name, binPath] of Object.entries(packageJson.bin)) {
          entrypoints.push({
            path: binPath as string,
            type: 'cli',
            confidence: 'primary',
            description: `CLI binary: ${name}`,
            language: 'JavaScript',
          });
        }
      }
    } catch {
      // package.json 不存在或解析失败
    }
    
    return entrypoints;
  }
  
  /**
   * 基于 pyproject.toml 发现
   */
  private async discoverPyprojectEntrypoints(repoRoot: string): Promise<Entrypoint[]> {
    const entrypoints: Entrypoint[] = [];
    
    try {
      const pyprojectPath = path.join(repoRoot, 'pyproject.toml');
      const content = await fs.readFile(pyprojectPath, 'utf-8');
      
      // 检测 Poetry scripts
      const scriptsMatch = content.match(/\[tool\.poetry\.scripts\]([\s\S]*?)(?=\[|$)/);
      if (scriptsMatch) {
        const scripts = scriptsMatch[1];
        const scriptLines = scripts.split('\n').filter(line => line.includes('='));
        for (const line of scriptLines) {
          const [name, path] = line.split('=').map(s => s.trim().replace(/["']/g, ''));
          if (path) {
            entrypoints.push({
              path: path.split(':')[0], // 去掉函数名部分
              type: 'cli',
              confidence: 'primary',
              description: `Python CLI: ${name}`,
              language: 'Python',
            });
          }
        }
      }
      
      // 检测 console_scripts
      const consoleScriptsMatch = content.match(/console_scripts\s*=\s*\[([\s\S]*?)\]/);
      if (consoleScriptsMatch) {
        const scripts = consoleScriptsMatch[1];
        const scriptLines = scripts.split(',').map(s => s.trim().replace(/["']/g, ''));
        for (const script of scriptLines) {
          if (script.includes('=')) {
            const [name, path] = script.split('=').map(s => s.trim());
            entrypoints.push({
              path: path.split(':')[0],
              type: 'cli',
              confidence: 'primary',
              description: `Python CLI: ${name}`,
              language: 'Python',
            });
          }
        }
      }
    } catch {
      // pyproject.toml 不存在
    }
    
    return entrypoints;
  }
  
  /**
   * 基于 Cargo.toml 发现
   */
  private async discoverCargoEntrypoints(repoRoot: string): Promise<Entrypoint[]> {
    const entrypoints: Entrypoint[] = [];
    
    try {
      const cargoPath = path.join(repoRoot, 'Cargo.toml');
      const content = await fs.readFile(cargoPath, 'utf-8');
      
      // 检测 [[bin]]
      const binMatches = content.match(/\[\[bin\]\]([\s\S]*?)(?=\[\[|$)/g);
      if (binMatches) {
        for (const match of binMatches) {
          const nameMatch = match.match(/name\s*=\s*["']([^"']+)["']/);
          const pathMatch = match.match(/path\s*=\s*["']([^"']+)["']/);
          
          if (pathMatch) {
            entrypoints.push({
              path: pathMatch[1],
              type: 'cli',
              confidence: 'primary',
              description: `Rust binary: ${nameMatch ? nameMatch[1] : path.basename(pathMatch[1])}`,
              language: 'Rust',
            });
          }
        }
      }
    } catch {
      // Cargo.toml 不存在
    }
    
    return entrypoints;
  }
  
  /**
   * 去重
   */
  private deduplicate(entrypoints: Entrypoint[]): Entrypoint[] {
    const seen = new Set<string>();
    const unique: Entrypoint[] = [];
    
    for (const entrypoint of entrypoints) {
      if (!seen.has(entrypoint.path)) {
        seen.add(entrypoint.path);
        unique.push(entrypoint);
      }
    }
    
    return unique;
  }
  
  /**
   * 检查模式匹配
   */
  private matchesPattern(filename: string, pattern: string): boolean {
    // 简单通配符匹配
    if (pattern === '*') return true;
    if (pattern.startsWith('*')) return filename.endsWith(pattern.slice(1));
    if (pattern.endsWith('*')) return filename.startsWith(pattern.slice(0, -1));
    return filename === pattern;
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建入口点发现器
 */
export function createEntrypointDiscovery(config?: EntrypointDiscoveryConfig): EntrypointDiscovery {
  return new EntrypointDiscovery(config);
}

/**
 * 快速发现入口点
 */
export async function discoverEntrypoints(
  repoRoot: string,
  config?: EntrypointDiscoveryConfig
): Promise<Entrypoint[]> {
  const discovery = new EntrypointDiscovery(config);
  return await discovery.discover(repoRoot);
}
