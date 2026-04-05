/**
 * Test Discovery - 测试发现器
 * 
 * 职责：
 * 1. 发现 TS/JS 测试文件（*.test.*, *.spec.*）
 * 2. 发现 Python 测试文件（test_*, *_test）
 * 3. 识别测试类型（unit/integration/e2e/smoke）
 * 4. 识别测试框架（Jest/Vitest/pytest 等）
 * 5. 识别相关模块
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { TestRef, TestInventory, TestKind, TestDiscoveryConfig } from './types';

// ============================================================================
// 测试模式定义
// ============================================================================

/**
 * TS/JS 测试模式
 */
const TS_JS_TEST_PATTERNS = [
  { pattern: /\.test\.ts$/, kind: 'unit' as TestKind },
  { pattern: /\.spec\.ts$/, kind: 'unit' as TestKind },
  { pattern: /\.test\.tsx$/, kind: 'unit' as TestKind },
  { pattern: /\.spec\.tsx$/, kind: 'unit' as TestKind },
  { pattern: /\.test\.js$/, kind: 'unit' as TestKind },
  { pattern: /\.spec\.js$/, kind: 'unit' as TestKind },
  { pattern: /\.test\.jsx$/, kind: 'unit' as TestKind },
  { pattern: /\.spec\.jsx$/, kind: 'unit' as TestKind },
];

/**
 * Python 测试模式
 */
const PYTHON_TEST_PATTERNS = [
  { pattern: /^test_.*\.py$/, kind: 'unit' as TestKind },
  { pattern: /^.*_test\.py$/, kind: 'unit' as TestKind },
  { pattern: /^conftest\.py$/, kind: 'unknown' as TestKind },
];

/**
 * 测试目录模式
 */
const TEST_DIR_PATTERNS = [
  { pattern: /\/tests?\//i, kind: 'unit' as TestKind },
  { pattern: /\/__tests__\//i, kind: 'unit' as TestKind },
  { pattern: /\/__spec__\//i, kind: 'unit' as TestKind },
  { pattern: /\/integration\//i, kind: 'integration' as TestKind },
  { pattern: /\/e2e\//i, kind: 'e2e' as TestKind },
  { pattern: /\/smoke\//i, kind: 'smoke' as TestKind },
];

/**
 * 框架检测模式
 */
const FRAMEWORK_PATTERNS = [
  { pattern: /vitest/i, framework: 'Vitest' },
  { pattern: /jest/i, framework: 'Jest' },
  { pattern: /mocha/i, framework: 'Mocha' },
  { pattern: /ava/i, framework: 'Ava' },
  { pattern: /pytest/i, framework: 'pytest' },
  { pattern: /unittest/i, framework: 'unittest' },
  { pattern: /playwright/i, framework: 'Playwright' },
  { pattern: /cypress/i, framework: 'Cypress' },
];

// ============================================================================
// 测试发现器
// ============================================================================

export class TestDiscovery {
  private config: Required<TestDiscoveryConfig>;
  
  constructor(config: TestDiscoveryConfig = {}) {
    this.config = {
      includeDirs: config.includeDirs ?? [],
      excludeDirs: config.excludeDirs ?? [
        'node_modules',
        '__pycache__',
        '.git',
        'dist',
        'build',
        'coverage',
        '.next',
        'venv',
        '.venv',
      ],
      filePatterns: config.filePatterns ?? [],
    };
  }
  
  /**
   * 发现测试
   */
  async discover(repoRoot: string): Promise<TestInventory> {
    const tests: TestRef[] = [];
    
    // 扫描文件
    await this.scanDirectory(repoRoot, repoRoot, tests);
    
    // 构建清单
    return this.buildInventory(repoRoot, tests);
  }
  
  /**
   * 扫描目录
   */
  private async scanDirectory(
    dir: string,
    repoRoot: string,
    tests: TestRef[]
  ): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(repoRoot, fullPath);
        
        // 检查排除
        if (this.shouldExclude(relativePath)) continue;
        
        if (entry.isDirectory()) {
          // 检查是否是测试目录
          const dirKind = this.getTestDirKind(entry.name, relativePath);
          if (dirKind) {
            await this.scanTestDirectory(fullPath, repoRoot, dirKind, tests);
          } else {
            await this.scanDirectory(fullPath, repoRoot, tests);
          }
        } else if (entry.isFile()) {
          // 检查是否是测试文件
          const testRef = this.getTestFileRef(fullPath, relativePath);
          if (testRef) {
            tests.push(testRef);
          }
        }
      }
    } catch {
      // 忽略错误
    }
  }
  
  /**
   * 扫描测试目录
   */
  private async scanTestDirectory(
    dir: string,
    repoRoot: string,
    kind: TestKind,
    tests: TestRef[]
  ): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(repoRoot, fullPath);
        
        if (this.shouldExclude(relativePath)) continue;
        
        // 检查是否是测试文件
        const ext = path.extname(entry.name).toLowerCase();
        if (['.ts', '.tsx', '.js', '.jsx', '.py'].includes(ext)) {
          const testRef = this.getTestFileRef(fullPath, relativePath, kind);
          if (testRef) {
            tests.push(testRef);
          }
        }
      }
    } catch {
      // 忽略错误
    }
  }
  
  /**
   * 获取测试文件引用
   */
  private getTestFileRef(
    fullPath: string,
    relativePath: string,
    defaultKind?: TestKind
  ): TestRef | null {
    const fileName = path.basename(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    
    // 检测语言
    const language = this.getLanguage(ext);
    if (!language) return null;
    
    // 检测测试模式
    let kind: TestKind | undefined = defaultKind;
    const reasons: string[] = [];
    
    if (!kind) {
      const patterns = language === 'Python' ? PYTHON_TEST_PATTERNS : TS_JS_TEST_PATTERNS;
      for (const { pattern, kind: k } of patterns) {
        if (pattern.test(fileName)) {
          kind = k;
          reasons.push(`File name matches pattern: ${pattern.source}`);
          break;
        }
      }
    }
    
    if (!kind) return null;
    
    // 检测框架
    const framework = this.detectFramework(fullPath, language);
    
    // 检测相关模块
    const relatedModules = this.extractRelatedModules(relativePath, kind);
    
    return {
      file: relativePath,
      framework,
      kind,
      language,
      relatedModules,
      confidence: this.calculateConfidence(reasons, framework),
      reasons: reasons.length > 0 ? reasons : ['Test file pattern match'],
    };
  }
  
  /**
   * 获取测试目录类型
   */
  private getTestDirKind(dirName: string, relativePath: string): TestKind | null {
    for (const { pattern, kind } of TEST_DIR_PATTERNS) {
      if (pattern.test(relativePath) || pattern.test(dirName)) {
        return kind;
      }
    }
    return null;
  }
  
  /**
   * 检测框架
   */
  private detectFramework(fullPath: string, language: string): string | undefined {
    // 根据语言检测框架
    if (language === 'Python') {
      return 'pytest'; // 默认 pytest
    }
    
    // TS/JS 尝试读取 package.json
    if (language === 'TypeScript' || language === 'JavaScript') {
      const packageJsonPath = path.join(path.dirname(fullPath), 'package.json');
      
      // 简单检测：查找常见框架配置文件
      const dir = path.dirname(fullPath);
      if (fs.existsSync(path.join(dir, 'vitest.config.ts'))) return 'Vitest';
      if (fs.existsSync(path.join(dir, 'vitest.config.js'))) return 'Vitest';
      if (fs.existsSync(path.join(dir, 'jest.config.js'))) return 'Jest';
      if (fs.existsSync(path.join(dir, 'jest.config.ts'))) return 'Jest';
    }
    
    return undefined;
  }
  
  /**
   * 提取相关模块
   */
  private extractRelatedModules(relativePath: string, kind: TestKind): string[] {
    const modules: string[] = [];
    
    // 从路径提取模块名
    const dirName = path.dirname(relativePath);
    const parts = dirName.split(path.sep);
    
    // 查找 src/app/lib 等目录
    const srcIndex = parts.findIndex(p => ['src', 'app', 'lib', 'packages'].includes(p));
    if (srcIndex !== -1) {
      const moduleParts = parts.slice(srcIndex + 1);
      if (moduleParts.length > 0) {
        modules.push(moduleParts.join('/'));
      }
    }
    
    return modules;
  }
  
  /**
   * 计算置信度
   */
  private calculateConfidence(reasons: string[], framework?: string): number {
    let confidence = 0.5;
    
    if (reasons.length > 0) confidence += 0.2;
    if (framework) confidence += 0.2;
    
    return Math.min(1.0, confidence);
  }
  
  /**
   * 获取语言
   */
  private getLanguage(ext: string): string | null {
    switch (ext) {
      case '.ts':
      case '.tsx':
        return 'TypeScript';
      case '.js':
      case '.jsx':
        return 'JavaScript';
      case '.py':
        return 'Python';
      default:
        return null;
    }
  }
  
  /**
   * 检查是否应该排除
   */
  private shouldExclude(relativePath: string): boolean {
    for (const dir of this.config.excludeDirs) {
      if (relativePath.includes(dir)) return true;
    }
    return false;
  }
  
  /**
   * 构建测试清单
   */
  private buildInventory(repoRoot: string, tests: TestRef[]): TestInventory {
    const byKind: Record<TestKind, TestRef[]> = {
      unit: [],
      integration: [],
      e2e: [],
      smoke: [],
      unknown: [],
    };
    
    const byFramework: Record<string, TestRef[]> = {};
    const byLanguage: Record<string, TestRef[]> = {};
    
    for (const test of tests) {
      byKind[test.kind].push(test);
      
      if (test.framework) {
        if (!byFramework[test.framework]) byFramework[test.framework] = [];
        byFramework[test.framework].push(test);
      }
      
      if (!byLanguage[test.language]) byLanguage[test.language] = [];
      byLanguage[test.language].push(test);
    }
    
    return {
      repoRoot,
      tests,
      byKind,
      byFramework,
      byLanguage,
      stats: {
        total: tests.length,
        byKind: {
          unit: byKind.unit.length,
          integration: byKind.integration.length,
          e2e: byKind.e2e.length,
          smoke: byKind.smoke.length,
          unknown: byKind.unknown.length,
        },
        byFramework: Object.fromEntries(
          Object.entries(byFramework).map(([k, v]) => [k, v.length])
        ),
      },
      generatedAt: Date.now(),
    };
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建测试发现器
 */
export function createTestDiscovery(config?: TestDiscoveryConfig): TestDiscovery {
  return new TestDiscovery(config);
}

/**
 * 快速发现测试
 */
export async function discoverTests(repoRoot: string): Promise<TestInventory> {
  const discovery = new TestDiscovery();
  return await discovery.discover(repoRoot);
}
