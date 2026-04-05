/**
 * Project Detector - 项目类型检测器
 * 
 * 职责：
 * 1. 识别编程语言
 * 2. 识别框架
 * 3. 识别包管理器
 * 4. 识别构建系统
 * 5. 识别测试框架
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { RepoProfile, DetectionEvidence, EvidenceType } from './types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 检测配置
 */
export interface DetectorConfig {
  /** 最小置信度阈值 */
  minConfidence?: number;
  
  /** 是否包含证据 */
  includeEvidence?: boolean;
}

/**
 * 检测结果
 */
export interface DetectionResult {
  /** 语言 */
  languages: Set<string>;
  
  /** 框架 */
  frameworks: Set<string>;
  
  /** 包管理器 */
  packageManagers: Set<string>;
  
  /** 构建系统 */
  buildSystems: Set<string>;
  
  /** 测试框架 */
  testFrameworks: Set<string>;
  
  /** 证据 */
  evidence: DetectionEvidence[];
}

// ============================================================================
// 检测器
// ============================================================================

export class ProjectDetector {
  private config: Required<DetectorConfig>;
  
  constructor(config: DetectorConfig = {}) {
    this.config = {
      minConfidence: config.minConfidence ?? 0.5,
      includeEvidence: config.includeEvidence ?? true,
    };
  }
  
  /**
   * 检测项目
   */
  async detect(repoRoot: string): Promise<RepoProfile> {
    const result: DetectionResult = {
      languages: new Set(),
      frameworks: new Set(),
      packageManagers: new Set(),
      buildSystems: new Set(),
      testFrameworks: new Set(),
      evidence: [],
    };
    
    // 1. 检测 package.json (Node.js/TS/JS)
    await this.detectNodeProject(repoRoot, result);
    
    // 2. 检测 Python 项目
    await this.detectPythonProject(repoRoot, result);
    
    // 3. 检测其他语言项目
    await this.detectOtherProjects(repoRoot, result);
    
    // 4. 构建 RepoProfile
    return this.buildProfile(repoRoot, result);
  }
  
  /**
   * 检测 Node.js 项目
   */
  private async detectNodeProject(
    repoRoot: string,
    result: DetectionResult
  ): Promise<void> {
    const packageJsonPath = path.join(repoRoot, 'package.json');
    
    try {
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);
      
      // 添加语言
      if (packageJson.devDependencies?.typescript || packageJson.dependencies?.typescript) {
        result.languages.add('TypeScript');
        this.addEvidence(result, 'tsconfig', 'package.json', 'TypeScript dependency found', 0.9);
      }
      result.languages.add('JavaScript');
      
      // 添加包管理器
      if (await fs.access(path.join(repoRoot, 'pnpm-lock.yaml')).then(() => true).catch(() => false)) {
        result.packageManagers.add('pnpm');
        this.addEvidence(result, 'package_json', 'pnpm-lock.yaml', 'pnpm lock file found', 1.0);
      } else if (await fs.access(path.join(repoRoot, 'yarn.lock')).then(() => true).catch(() => false)) {
        result.packageManagers.add('yarn');
        this.addEvidence(result, 'package_json', 'yarn.lock', 'yarn lock file found', 1.0);
      } else {
        result.packageManagers.add('npm');
      }
      
      // 检测框架
      this.detectNodeFrameworks(packageJson, repoRoot, result);
      
      // 检测测试框架
      this.detectNodeTestFrameworks(packageJson, repoRoot, result);
      
    } catch (error) {
      // package.json 不存在或解析失败
    }
    
    // 检测 tsconfig.json
    await this.detectTsConfig(repoRoot, result);
  }
  
  /**
   * 检测 Node 框架
   */
  private detectNodeFrameworks(
    packageJson: any,
    repoRoot: string,
    result: DetectionResult
  ): void {
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };
    
    // React
    if (deps.react) {
      result.frameworks.add('React');
      this.addEvidence(result, 'package_json', 'package.json', 'React dependency found', 0.9);
      
      // Next.js
      if (deps.next) {
        result.frameworks.add('Next.js');
        this.addEvidence(result, 'package_json', 'package.json', 'Next.js dependency found', 1.0);
      }
      
      // Vite
      if (deps.vite || devHasVite(packageJson)) {
        result.frameworks.add('Vite');
        this.addEvidence(result, 'package_json', 'package.json', 'Vite dependency found', 0.9);
      }
    }
    
    // Vue
    if (deps.vue || deps['vue-router']) {
      result.frameworks.add('Vue');
      this.addEvidence(result, 'package_json', 'package.json', 'Vue dependency found', 0.9);
    }
    
    // Express
    if (deps.express) {
      result.frameworks.add('Express');
      this.addEvidence(result, 'package_json', 'package.json', 'Express dependency found', 0.9);
    }
    
    // NestJS
    if (deps['@nestjs/core']) {
      result.frameworks.add('NestJS');
      this.addEvidence(result, 'package_json', 'package.json', 'NestJS dependency found', 1.0);
    }
    
    // 检测配置文件
    this.detectNodeConfigFiles(repoRoot, result);
  }
  
  /**
   * 检测 Node 配置文件
   */
  private async detectNodeConfigFiles(repoRoot: string, result: DetectionResult): Promise<void> {
    const configFiles = [
      { file: 'vite.config.ts', framework: 'Vite', evidence: 'vite_config' as EvidenceType },
      { file: 'vite.config.js', framework: 'Vite', evidence: 'vite_config' as EvidenceType },
      { file: 'next.config.js', framework: 'Next.js', evidence: 'next_config' as EvidenceType },
      { file: 'next.config.ts', framework: 'Next.js', evidence: 'next_config' as EvidenceType },
      { file: 'nuxt.config.js', framework: 'Nuxt', evidence: 'file_pattern' as EvidenceType },
      { file: 'svelte.config.js', framework: 'Svelte', evidence: 'file_pattern' as EvidenceType },
      { file: 'astro.config.mjs', framework: 'Astro', evidence: 'file_pattern' as EvidenceType },
      { file: 'remix.config.js', framework: 'Remix', evidence: 'file_pattern' as EvidenceType },
    ];
    
    for (const { file, framework, evidence } of configFiles) {
      const configPath = path.join(repoRoot, file);
      try {
        await fs.access(configPath);
        result.frameworks.add(framework);
        this.addEvidence(result, evidence, file, `${file} found`, 0.95);
      } catch {
        // 文件不存在
      }
    }
  }
  
  /**
   * 检测 Node 测试框架
   */
  private detectNodeTestFrameworks(
    packageJson: any,
    repoRoot: string,
    result: DetectionResult
  ): void {
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };
    
    // Jest
    if (deps.jest || deps['@types/jest']) {
      result.testFrameworks.add('Jest');
      this.addEvidence(result, 'package_json', 'package.json', 'Jest dependency found', 0.9);
    }
    
    // Vitest
    if (deps.vitest) {
      result.testFrameworks.add('Vitest');
      this.addEvidence(result, 'package_json', 'package.json', 'Vitest dependency found', 0.9);
    }
    
    // Mocha
    if (deps.mocha) {
      result.testFrameworks.add('Mocha');
      this.addEvidence(result, 'package_json', 'package.json', 'Mocha dependency found', 0.9);
    }
    
    // Ava
    if (deps.ava) {
      result.testFrameworks.add('Ava');
      this.addEvidence(result, 'package_json', 'package.json', 'Ava dependency found', 0.9);
    }
    
    // 检测配置文件
    this.detectNodeTestConfigFiles(repoRoot, result);
  }
  
  /**
   * 检测 Node 测试配置文件
   */
  private async detectNodeTestConfigFiles(repoRoot: string, result: DetectionResult): Promise<void> {
    const configFiles = [
      { file: 'jest.config.js', framework: 'Jest', evidence: 'file_pattern' as EvidenceType },
      { file: 'jest.config.ts', framework: 'Jest', evidence: 'file_pattern' as EvidenceType },
      { file: 'vitest.config.ts', framework: 'Vitest', evidence: 'file_pattern' as EvidenceType },
      { file: 'vitest.config.js', framework: 'Vitest', evidence: 'file_pattern' as EvidenceType },
      { file: 'mocha.opts', framework: 'Mocha', evidence: 'file_pattern' as EvidenceType },
    ];
    
    for (const { file, framework, evidence } of configFiles) {
      const configPath = path.join(repoRoot, file);
      try {
        await fs.access(configPath);
        result.testFrameworks.add(framework);
        this.addEvidence(result, evidence, file, `${file} found`, 0.95);
      } catch {
        // 文件不存在
      }
    }
  }
  
  /**
   * 检测 tsconfig.json
   */
  private async detectTsConfig(repoRoot: string, result: DetectionResult): Promise<void> {
    const tsConfigPath = path.join(repoRoot, 'tsconfig.json');
    
    try {
      await fs.access(tsConfigPath);
      result.languages.add('TypeScript');
      this.addEvidence(result, 'tsconfig', 'tsconfig.json', 'tsconfig.json found', 1.0);
    } catch {
      // tsconfig.json 不存在
    }
  }
  
  /**
   * 检测 Python 项目
   */
  private async detectPythonProject(
    repoRoot: string,
    result: DetectionResult
  ): Promise<void> {
    // 检测 pyproject.toml
    await this.detectPyproject(repoRoot, result);
    
    // 检测 requirements.txt
    await this.detectRequirements(repoRoot, result);
    
    // 检测 setup.py
    await this.detectSetupPy(repoRoot, result);
    
    // 检测 Django
    await this.detectDjango(repoRoot, result);
    
    // 检测 pytest
    await this.detectPytest(repoRoot, result);
  }
  
  /**
   * 检测 pyproject.toml
   */
  private async detectPyproject(repoRoot: string, result: DetectionResult): Promise<void> {
    const pyprojectPath = path.join(repoRoot, 'pyproject.toml');
    
    try {
      const content = await fs.readFile(pyprojectPath, 'utf-8');
      result.languages.add('Python');
      this.addEvidence(result, 'pyproject', 'pyproject.toml', 'pyproject.toml found', 1.0);
      
      // 检测 Poetry
      if (content.includes('[tool.poetry]')) {
        result.packageManagers.add('poetry');
        this.addEvidence(result, 'poetry_lock', 'pyproject.toml', 'Poetry configuration found', 0.95);
      }
      
      // 检测框架
      if (content.includes('fastapi')) result.frameworks.add('FastAPI');
      if (content.includes('django')) result.frameworks.add('Django');
      if (content.includes('flask')) result.frameworks.add('Flask');
      if (content.includes('pyramid')) result.frameworks.add('Pyramid');
      
      // 检测测试框架
      if (content.includes('pytest')) result.testFrameworks.add('pytest');
      if (content.includes('unittest')) result.testFrameworks.add('unittest');
      
    } catch {
      // pyproject.toml 不存在
    }
  }
  
  /**
   * 检测 requirements.txt
   */
  private async detectRequirements(repoRoot: string, result: DetectionResult): Promise<void> {
    const requirementsPath = path.join(repoRoot, 'requirements.txt');
    
    try {
      await fs.access(requirementsPath);
      result.languages.add('Python');
      result.packageManagers.add('pip');
      this.addEvidence(result, 'requirements', 'requirements.txt', 'requirements.txt found', 0.9);
      
      // 读取内容检测框架
      const content = await fs.readFile(requirementsPath, 'utf-8');
      
      if (content.includes('fastapi')) {
        result.frameworks.add('FastAPI');
        this.addEvidence(result, 'requirements', 'requirements.txt', 'FastAPI found in requirements', 0.9);
      }
      if (content.includes('django')) {
        result.frameworks.add('Django');
        this.addEvidence(result, 'requirements', 'requirements.txt', 'Django found in requirements', 0.9);
      }
      if (content.includes('flask')) {
        result.frameworks.add('Flask');
        this.addEvidence(result, 'requirements', 'requirements.txt', 'Flask found in requirements', 0.9);
      }
      if (content.includes('pytest')) {
        result.testFrameworks.add('pytest');
        this.addEvidence(result, 'requirements', 'requirements.txt', 'pytest found in requirements', 0.9);
      }
      
    } catch {
      // requirements.txt 不存在
    }
  }
  
  /**
   * 检测 setup.py
   */
  private async detectSetupPy(repoRoot: string, result: DetectionResult): Promise<void> {
    const setupPyPath = path.join(repoRoot, 'setup.py');
    
    try {
      await fs.access(setupPyPath);
      result.languages.add('Python');
      this.addEvidence(result, 'setup_py', 'setup.py', 'setup.py found', 0.8);
    } catch {
      // setup.py 不存在
    }
  }
  
  /**
   * 检测 Django
   */
  private async detectDjango(repoRoot: string, result: DetectionResult): Promise<void> {
    const managePyPath = path.join(repoRoot, 'manage.py');
    
    try {
      await fs.access(managePyPath);
      result.frameworks.add('Django');
      this.addEvidence(result, 'manage_py', 'manage.py', 'manage.py found', 1.0);
    } catch {
      // manage.py 不存在
    }
  }
  
  /**
   * 检测 pytest
   */
  private async detectPytest(repoRoot: string, result: DetectionResult): Promise<void> {
    const pytestIniPath = path.join(repoRoot, 'pytest.ini');
    const toxIniPath = path.join(repoRoot, 'tox.ini');
    
    try {
      await fs.access(pytestIniPath);
      result.testFrameworks.add('pytest');
      this.addEvidence(result, 'pytest_ini', 'pytest.ini', 'pytest.ini found', 0.95);
    } catch {
      // pytest.ini 不存在
    }
    
    try {
      await fs.access(toxIniPath);
      result.testFrameworks.add('tox');
      this.addEvidence(result, 'file_pattern', 'tox.ini', 'tox.ini found', 0.8);
    } catch {
      // tox.ini 不存在
    }
  }
  
  /**
   * 检测其他语言项目
   */
  private async detectOtherProjects(
    repoRoot: string,
    result: DetectionResult
  ): Promise<void> {
    // Go
    await this.detectGoProject(repoRoot, result);
    
    // Rust
    await this.detectRustProject(repoRoot, result);
    
    // Java
    await this.detectJavaProject(repoRoot, result);
    
    // Ruby
    await this.detectRubyProject(repoRoot, result);
    
    // PHP
    await this.detectPhpProject(repoRoot, result);
  }
  
  /**
   * 检测 Go 项目
   */
  private async detectGoProject(repoRoot: string, result: DetectionResult): Promise<void> {
    const goModPath = path.join(repoRoot, 'go.mod');
    
    try {
      await fs.access(goModPath);
      result.languages.add('Go');
      this.addEvidence(result, 'go_mod', 'go.mod', 'go.mod found', 1.0);
    } catch {
      // go.mod 不存在
    }
  }
  
  /**
   * 检测 Rust 项目
   */
  private async detectRustProject(repoRoot: string, result: DetectionResult): Promise<void> {
    const cargoTomlPath = path.join(repoRoot, 'Cargo.toml');
    
    try {
      await fs.access(cargoTomlPath);
      result.languages.add('Rust');
      result.buildSystems.add('Cargo');
      this.addEvidence(result, 'cargo_toml', 'Cargo.toml', 'Cargo.toml found', 1.0);
    } catch {
      // Cargo.toml 不存在
    }
  }
  
  /**
   * 检测 Java 项目
   */
  private async detectJavaProject(repoRoot: string, result: DetectionResult): Promise<void> {
    const pomXmlPath = path.join(repoRoot, 'pom.xml');
    const buildGradlePath = path.join(repoRoot, 'build.gradle');
    
    try {
      await fs.access(pomXmlPath);
      result.languages.add('Java');
      result.buildSystems.add('Maven');
      this.addEvidence(result, 'file_pattern', 'pom.xml', 'pom.xml found', 1.0);
    } catch {
      // pom.xml 不存在
    }
    
    try {
      await fs.access(buildGradlePath);
      result.languages.add('Java');
      result.buildSystems.add('Gradle');
      this.addEvidence(result, 'file_pattern', 'build.gradle', 'build.gradle found', 1.0);
    } catch {
      // build.gradle 不存在
    }
  }
  
  /**
   * 检测 Ruby 项目
   */
  private async detectRubyProject(repoRoot: string, result: DetectionResult): Promise<void> {
    const gemfilePath = path.join(repoRoot, 'Gemfile');
    
    try {
      await fs.access(gemfilePath);
      result.languages.add('Ruby');
      result.packageManagers.add('bundler');
      this.addEvidence(result, 'gemfile', 'Gemfile', 'Gemfile found', 1.0);
      
      // 检测 Rails
      const gemfileContent = await fs.readFile(gemfilePath, 'utf-8');
      if (gemfileContent.includes("gem 'rails'")) {
        result.frameworks.add('Rails');
        this.addEvidence(result, 'gemfile', 'Gemfile', 'Rails gem found', 0.9);
      }
    } catch {
      // Gemfile 不存在
    }
  }
  
  /**
   * 检测 PHP 项目
   */
  private async detectPhpProject(repoRoot: string, result: DetectionResult): Promise<void> {
    const composerJsonPath = path.join(repoRoot, 'composer.json');
    
    try {
      await fs.access(composerJsonPath);
      result.languages.add('PHP');
      result.packageManagers.add('composer');
      this.addEvidence(result, 'composer_json', 'composer.json', 'composer.json found', 1.0);
      
      // 检测 Laravel
      const composerJsonContent = await fs.readFile(composerJsonPath, 'utf-8');
      if (composerJsonContent.includes('laravel')) {
        result.frameworks.add('Laravel');
        this.addEvidence(result, 'composer_json', 'composer.json', 'Laravel dependency found', 0.9);
      }
    } catch {
      // composer.json 不存在
    }
  }
  
  /**
   * 添加证据
   */
  private addEvidence(
    result: DetectionResult,
    type: EvidenceType,
    source: string,
    content: string,
    confidence: number
  ): void {
    if (!this.config.includeEvidence) return;
    
    result.evidence.push({
      type,
      source,
      content,
      confidence,
      detectedAt: Date.now(),
    });
  }
  
  /**
   * 构建 RepoProfile
   */
  private buildProfile(repoRoot: string, result: DetectionResult): RepoProfile {
    return {
      repoRoot,
      languages: Array.from(result.languages),
      frameworks: Array.from(result.frameworks),
      packageManagers: Array.from(result.packageManagers),
      buildSystems: Array.from(result.buildSystems),
      testFrameworks: Array.from(result.testFrameworks),
      entrypoints: [], // 由 entrypoint_discovery 填充
      importantPaths: {
        app: [],
        lib: [],
        tests: [],
        infra: [],
        scripts: [],
        docs: [],
        configs: [],
      }, // 由 module_classifier 填充
      evidence: result.evidence,
      detectedAt: Date.now(),
    };
  }
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 检测是否有 Vite dev dependency
 */
function devHasVite(packageJson: any): boolean {
  return packageJson.devDependencies?.vite !== undefined;
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建项目检测器
 */
export function createProjectDetector(config?: DetectorConfig): ProjectDetector {
  return new ProjectDetector(config);
}

/**
 * 快速检测项目
 */
export async function detectProject(
  repoRoot: string,
  config?: DetectorConfig
): Promise<RepoProfile> {
  const detector = new ProjectDetector(config);
  return await detector.detect(repoRoot);
}
