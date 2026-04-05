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

import * as fs from 'fs/promises';
import * as path from 'path';
import type { RepoMap, DirectoryNode, KeyDirectory, LanguageDistribution, ImportantFile, ImportantFileType } from './types';
import { ModuleClassifier, classifyPath } from './module_classifier';

// ============================================================================
// 类型定义
// ============================================================================

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

// ============================================================================
// 重要文件模式
// ============================================================================

const IMPORTANT_FILE_PATTERNS: Array<{
  pattern: string;
  type: ImportantFileType;
  description: string;
}> = [
  // Package manifests
  { pattern: 'package.json', type: 'package_manifest', description: 'Node.js package manifest' },
  { pattern: 'pyproject.toml', type: 'package_manifest', description: 'Python project configuration' },
  { pattern: 'Cargo.toml', type: 'package_manifest', description: 'Rust package manifest' },
  { pattern: 'go.mod', type: 'package_manifest', description: 'Go module definition' },
  { pattern: 'pom.xml', type: 'package_manifest', description: 'Maven project configuration' },
  { pattern: 'build.gradle', type: 'package_manifest', description: 'Gradle build configuration' },
  { pattern: 'Gemfile', type: 'package_manifest', description: 'Ruby dependencies' },
  { pattern: 'composer.json', type: 'package_manifest', description: 'PHP package manifest' },
  
  // Configs
  { pattern: 'tsconfig.json', type: 'config', description: 'TypeScript configuration' },
  { pattern: 'vite.config.ts', type: 'config', description: 'Vite configuration' },
  { pattern: 'vite.config.js', type: 'config', description: 'Vite configuration' },
  { pattern: 'next.config.js', type: 'config', description: 'Next.js configuration' },
  { pattern: 'webpack.config.js', type: 'config', description: 'Webpack configuration' },
  { pattern: 'jest.config.js', type: 'config', description: 'Jest configuration' },
  { pattern: 'eslint.config.*', type: 'config', description: 'ESLint configuration' },
  { pattern: '.eslintrc.*', type: 'config', description: 'ESLint configuration' },
  { pattern: 'prettier.config.*', type: 'config', description: 'Prettier configuration' },
  { pattern: 'babel.config.*', type: 'config', description: 'Babel configuration' },
  
  // Entrypoints
  { pattern: 'main.ts', type: 'entrypoint', description: 'TypeScript entry point' },
  { pattern: 'main.js', type: 'entrypoint', description: 'JavaScript entry point' },
  { pattern: 'main.py', type: 'entrypoint', description: 'Python entry point' },
  { pattern: 'index.ts', type: 'entrypoint', description: 'TypeScript index' },
  { pattern: 'index.js', type: 'entrypoint', description: 'JavaScript index' },
  { pattern: 'app.py', type: 'entrypoint', description: 'Python app entry' },
  { pattern: 'manage.py', type: 'entrypoint', description: 'Django management' },
  
  // Test configs
  { pattern: 'pytest.ini', type: 'test_config', description: 'pytest configuration' },
  { pattern: 'tox.ini', type: 'test_config', description: 'tox configuration' },
  { pattern: 'vitest.config.*', type: 'test_config', description: 'Vitest configuration' },
  
  // Build configs
  { pattern: 'Makefile', type: 'build_config', description: 'Make build configuration' },
  { pattern: 'CMakeLists.txt', type: 'build_config', description: 'CMake configuration' },
  
  // Env
  { pattern: '.env.example', type: 'env_example', description: 'Environment example' },
  { pattern: '.env.template', type: 'env_example', description: 'Environment template' },
  
  // Docs
  { pattern: 'README.md', type: 'readme', description: 'Project readme' },
  { pattern: 'README.rst', type: 'readme', description: 'Project readme' },
  { pattern: 'CHANGELOG.md', type: 'readme', description: 'Changelog' },
  { pattern: 'CONTRIBUTING.md', type: 'readme', description: 'Contributing guide' },
  
  // License
  { pattern: 'LICENSE', type: 'license', description: 'License file' },
  { pattern: 'LICENSE.md', type: 'license', description: 'License file' },
  { pattern: 'LICENSE.txt', type: 'license', description: 'License file' },
  
  // Gitignore
  { pattern: '.gitignore', type: 'gitignore', description: 'Git ignore patterns' },
];

// ============================================================================
// 仓库地图生成器
// ============================================================================

export class RepoMapGenerator {
  private config: Required<RepoMapGeneratorConfig>;
  private classifier: ModuleClassifier;
  
  constructor(config: RepoMapGeneratorConfig = {}) {
    this.config = {
      maxDepth: config.maxDepth ?? 3,
      excludeDirs: config.excludeDirs ?? [
        'node_modules',
        '__pycache__',
        '.git',
        '.svn',
        'vendor',
        'dist',
        'build',
        'coverage',
        '.next',
        '.nuxt',
        '.cache',
        'venv',
        '.venv',
        'env',
        '.env',
      ],
      excludeFiles: config.excludeFiles ?? [
        '*.log',
        '*.lock',
        '*.pyc',
        '*.pyo',
        '*.class',
        '*.o',
        '*.so',
        '*.dll',
        '*.exe',
        '*.bin',
      ],
      includeHidden: config.includeHidden ?? false,
    };
    
    this.classifier = new ModuleClassifier();
  }
  
  /**
   * 生成仓库地图
   */
  async generate(repoRoot: string): Promise<RepoMap> {
    // 扫描目录
    const topLevelDirs = await this.scanTopLevelDirectories(repoRoot);
    
    // 识别关键目录
    const keyDirectories = await this.identifyKeyDirectories(repoRoot, topLevelDirs);
    
    // 统计语言分布
    const languageDistribution = await this.analyzeLanguageDistribution(repoRoot);
    
    // 识别重要文件
    const importantFiles = await this.identifyImportantFiles(repoRoot);
    
    // 发现入口候选
    const entrypointCandidates = await this.discoverEntrypointCandidates(repoRoot);
    
    return {
      repoRoot,
      topLevelDirs,
      keyDirectories,
      languageDistribution,
      importantFiles,
      entrypointCandidates,
      generatedAt: Date.now(),
    };
  }
  
  /**
   * 扫描顶层目录
   */
  private async scanTopLevelDirectories(repoRoot: string): Promise<DirectoryNode[]> {
    const entries = await fs.readdir(repoRoot, { withFileTypes: true });
    const dirs: DirectoryNode[] = [];
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (this.config.excludeDirs.includes(entry.name)) continue;
      if (!this.config.includeHidden && entry.name.startsWith('.')) continue;
      
      const dirPath = path.join(repoRoot, entry.name);
      const classification = this.classifier.classifyDirectory(dirPath, repoRoot);
      
      const node: DirectoryNode = {
        name: entry.name,
        path: entry.name,
        category: classification.category !== 'unknown' ? classification.category : undefined,
        children: [],
        fileCount: 0,
      };
      
      // 统计文件数（第一层）
      try {
        const subEntries = await fs.readdir(dirPath, { withFileTypes: true });
        node.fileCount = subEntries.filter(e => e.isFile()).length;
      } catch {
        // 忽略错误
      }
      
      dirs.push(node);
    }
    
    // 按名称排序
    dirs.sort((a, b) => a.name.localeCompare(b.name));
    
    return dirs;
  }
  
  /**
   * 识别关键目录
   */
  private async identifyKeyDirectories(
    repoRoot: string,
    topLevelDirs: DirectoryNode[]
  ): Promise<KeyDirectory[]> {
    const keyDirs: KeyDirectory[] = [];
    
    // 关键目录模式
    const keyDirPatterns: Array<{
      patterns: string[];
      category: string;
      importance: 'critical' | 'important' | 'normal';
      description: string;
    }> = [
      { patterns: ['src', 'app', 'apps'], category: 'app', importance: 'critical', description: 'Main application code' },
      { patterns: ['lib', 'libs', 'packages'], category: 'lib', importance: 'critical', description: 'Library code' },
      { patterns: ['test', 'tests', '__tests__', 'spec'], category: 'tests', importance: 'important', description: 'Test code' },
      { patterns: ['docs', 'doc', 'documentation'], category: 'docs', importance: 'normal', description: 'Documentation' },
      { patterns: ['scripts', 'bin', 'tools'], category: 'scripts', importance: 'normal', description: 'Scripts and tools' },
      { patterns: ['config', 'configs', '.github', '.gitlab'], category: 'infra', importance: 'important', description: 'Configuration and CI/CD' },
      { patterns: ['infra', 'deploy', 'k8s', 'docker'], category: 'infra', importance: 'important', description: 'Infrastructure code' },
    ];
    
    for (const dir of topLevelDirs) {
      for (const { patterns, category, importance, description } of keyDirPatterns) {
        if (patterns.includes(dir.name)) {
          keyDirs.push({
            path: dir.path,
            category: category as any,
            importance,
            description,
          });
          break;
        }
      }
    }
    
    // 按重要性排序
    const importanceOrder = { critical: 0, important: 1, normal: 2 };
    keyDirs.sort((a, b) => importanceOrder[a.importance] - importanceOrder[b.importance]);
    
    return keyDirs;
  }
  
  /**
   * 分析语言分布
   */
  private async analyzeLanguageDistribution(repoRoot: string): Promise<LanguageDistribution> {
    const byExtension: Record<string, number> = {};
    const byLanguage: Record<string, number> = {};
    let totalFiles = 0;
    
    // 语言映射
    const languageMap: Record<string, string> = {
      '.ts': 'TypeScript',
      '.tsx': 'TypeScript',
      '.js': 'JavaScript',
      '.jsx': 'JavaScript',
      '.py': 'Python',
      '.rs': 'Rust',
      '.go': 'Go',
      '.java': 'Java',
      '.rb': 'Ruby',
      '.php': 'PHP',
      '.c': 'C',
      '.cpp': 'C++',
      '.h': 'C/C++',
      '.hpp': 'C++',
      '.cs': 'C#',
      '.swift': 'Swift',
      '.kt': 'Kotlin',
      '.scala': 'Scala',
      '.sh': 'Shell',
      '.bash': 'Shell',
      '.zsh': 'Shell',
      '.md': 'Markdown',
      '.rst': 'reStructuredText',
      '.json': 'JSON',
      '.yaml': 'YAML',
      '.yml': 'YAML',
      '.toml': 'TOML',
      '.xml': 'XML',
      '.html': 'HTML',
      '.css': 'CSS',
      '.scss': 'SCSS',
      '.less': 'Less',
      '.sql': 'SQL',
    };
    
    await this.walkDirectory(repoRoot, async (filePath, stat) => {
      if (!stat.isFile()) return;
      
      const ext = path.extname(filePath).toLowerCase();
      const relativePath = path.relative(repoRoot, filePath);
      
      // 检查是否排除
      if (this.shouldExclude(relativePath)) return;
      
      totalFiles++;
      
      // 统计扩展名
      byExtension[ext] = (byExtension[ext] || 0) + 1;
      
      // 统计语言
      const language = languageMap[ext];
      if (language) {
        byLanguage[language] = (byLanguage[language] || 0) + 1;
      }
    });
    
    return {
      byLanguage,
      byExtension,
      totalFiles,
    };
  }
  
  /**
   * 识别重要文件
   */
  private async identifyImportantFiles(repoRoot: string): Promise<ImportantFile[]> {
    const importantFiles: ImportantFile[] = [];
    
    for (const { pattern, type, description } of IMPORTANT_FILE_PATTERNS) {
      const filePath = path.join(repoRoot, pattern);
      
      try {
        await fs.access(filePath);
        importantFiles.push({
          path: pattern,
          type,
          description,
        });
      } catch {
        // 文件不存在
      }
    }
    
    return importantFiles;
  }
  
  /**
   * 发现入口候选
   */
  private async discoverEntrypointCandidates(repoRoot: string): Promise<any[]> {
    const candidates: any[] = [];
    
    // 入口文件模式
    const entrypointPatterns: Array<{
      pattern: string;
      type: string;
      confidence: 'primary' | 'secondary' | 'possible';
      description: string;
    }> = [
      { pattern: 'src/main.ts', type: 'app', confidence: 'primary', description: 'TypeScript main entry' },
      { pattern: 'src/main.js', type: 'app', confidence: 'primary', description: 'JavaScript main entry' },
      { pattern: 'src/index.ts', type: 'library', confidence: 'primary', description: 'TypeScript index' },
      { pattern: 'src/index.js', type: 'library', confidence: 'primary', description: 'JavaScript index' },
      { pattern: 'src/app.ts', type: 'app', confidence: 'primary', description: 'TypeScript app' },
      { pattern: 'src/app.tsx', type: 'app', confidence: 'primary', description: 'React app' },
      { pattern: 'main.py', type: 'app', confidence: 'primary', description: 'Python main' },
      { pattern: 'app.py', type: 'app', confidence: 'primary', description: 'Python app (Flask/FastAPI)' },
      { pattern: 'manage.py', type: 'app', confidence: 'primary', description: 'Django management' },
      { pattern: 'pages/index.tsx', type: 'page', confidence: 'primary', description: 'Next.js home page' },
      { pattern: 'pages/index.js', type: 'page', confidence: 'primary', description: 'Next.js home page' },
      { pattern: 'app/page.tsx', type: 'page', confidence: 'primary', description: 'Next.js 13+ home page' },
      { pattern: 'app/layout.tsx', type: 'config', confidence: 'secondary', description: 'Next.js 13+ layout' },
    ];
    
    for (const { pattern, type, confidence, description } of entrypointPatterns) {
      const filePath = path.join(repoRoot, pattern);
      
      try {
        await fs.access(filePath);
        candidates.push({
          path: pattern,
          type: type as any,
          confidence,
          description,
        });
      } catch {
        // 文件不存在
      }
    }
    
    return candidates;
  }
  
  /**
   * 遍历目录
   */
  private async walkDirectory(
    dir: string,
    callback: (filePath: string, stat: fs.Stats) => Promise<void>,
    depth: number = 0
  ): Promise<void> {
    if (depth >= this.config.maxDepth) return;
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(path.dirname(dir), fullPath);
        
        // 检查是否排除
        if (this.shouldExclude(relativePath)) continue;
        if (!this.config.includeHidden && entry.name.startsWith('.')) continue;
        
        if (entry.isDirectory()) {
          await this.walkDirectory(fullPath, callback, depth + 1);
        } else if (entry.isFile()) {
          await callback(fullPath, entry as any);
        }
      }
    } catch {
      // 忽略权限错误等
    }
  }
  
  /**
   * 检查是否应该排除
   */
  private shouldExclude(filePath: string): boolean {
    // 检查排除目录
    for (const excludeDir of this.config.excludeDirs) {
      if (filePath.includes(excludeDir)) return true;
    }
    
    // 检查排除文件
    for (const pattern of this.config.excludeFiles) {
      if (pattern.startsWith('*')) {
        if (filePath.endsWith(pattern.slice(1))) return true;
      } else if (filePath.includes(pattern)) {
        return true;
      }
    }
    
    return false;
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建仓库地图生成器
 */
export function createRepoMapGenerator(config?: RepoMapGeneratorConfig): RepoMapGenerator {
  return new RepoMapGenerator(config);
}

/**
 * 快速生成仓库地图
 */
export async function generateRepoMap(
  repoRoot: string,
  config?: RepoMapGeneratorConfig
): Promise<RepoMap> {
  const generator = new RepoMapGenerator(config);
  return await generator.generate(repoRoot);
}
