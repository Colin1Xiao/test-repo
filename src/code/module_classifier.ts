/**
 * Module Classifier - 模块分类器
 * 
 * 职责：
 * 1. 按路径/文件名分类目录
 * 2. 识别 app / lib / tests / infra / scripts / docs / config
 * 3. 输出分类置信度
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import * as path from 'path';
import type { ModuleCategory, ModuleClassification, ImportantPaths } from './types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 分类器配置
 */
export interface ClassifierConfig {
  /** 最小置信度阈值 */
  minConfidence?: number;
}

/**
 * 分类规则
 */
interface ClassificationRule {
  /** 分类 */
  category: ModuleCategory;
  
  /** 路径模式 */
  pathPatterns: string[];
  
  /** 文件模式 */
  filePatterns: string[];
  
  /** 置信度 */
  confidence: number;
  
  /** 描述 */
  description: string;
}

// ============================================================================
// 分类规则定义
// ============================================================================

const CLASSIFICATION_RULES: ClassificationRule[] = [
  // App
  {
    category: 'app',
    pathPatterns: ['src', 'app', 'apps', 'packages', 'services', 'functions'],
    filePatterns: ['main.*', 'index.*', 'app.*'],
    confidence: 0.8,
    description: 'Application code',
  },
  
  // Lib
  {
    category: 'lib',
    pathPatterns: ['lib', 'libs', 'packages', 'modules', 'shared', 'common', 'utils', 'core'],
    filePatterns: [],
    confidence: 0.7,
    description: 'Library code',
  },
  
  // Tests
  {
    category: 'tests',
    pathPatterns: ['test', 'tests', '__tests__', 'spec', 'specs', 'testing'],
    filePatterns: ['*.test.*', '*.spec.*', '*.test.*', 'test-*. *'],
    confidence: 0.95,
    description: 'Test code',
  },
  
  // Infra
  {
    category: 'infra',
    pathPatterns: ['infra', 'infrastructure', 'deploy', 'deployment', 'k8s', 'kubernetes', 'docker', '.github', '.gitlab', 'terraform', 'ansible'],
    filePatterns: ['Dockerfile*', 'docker-compose.*', '*.tf', '*.yaml', '*.yml'],
    confidence: 0.85,
    description: 'Infrastructure code',
  },
  
  // Scripts
  {
    category: 'scripts',
    pathPatterns: ['scripts', 'bin', 'tools', 'task', 'tasks'],
    filePatterns: ['*.sh', '*.bash', '*.ps1', '*.bat'],
    confidence: 0.8,
    description: 'Scripts and tools',
  },
  
  // Docs
  {
    category: 'docs',
    pathPatterns: ['doc', 'docs', 'documentation', 'wiki', 'md', 'manual'],
    filePatterns: ['*.md', '*.rst', '*.txt', 'CHANGELOG*', 'HISTORY*'],
    confidence: 0.75,
    description: 'Documentation',
  },
  
  // Config
  {
    category: 'config',
    pathPatterns: ['config', 'configs', 'conf', 'settings', '.config'],
    filePatterns: ['*.config.*', '*.conf', '*.ini', '*.toml', '.env*', 'settings.*'],
    confidence: 0.85,
    description: 'Configuration files',
  },
];

// ============================================================================
// 模块分类器
// ============================================================================

export class ModuleClassifier {
  private config: Required<ClassifierConfig>;
  
  constructor(config: ClassifierConfig = {}) {
    this.config = {
      minConfidence: config.minConfidence ?? 0.5,
    };
  }
  
  /**
   * 分类路径
   */
  classify(filePath: string, repoRoot: string = ''): ModuleClassification {
    const relativePath = path.relative(repoRoot, filePath);
    const normalizedPath = relativePath.replace(/\\/g, '/');
    const fileName = path.basename(filePath);
    const dirName = path.dirname(normalizedPath);
    
    const matches: ModuleClassification[] = [];
    
    // 检查每个规则
    for (const rule of CLASSIFICATION_RULES) {
      const pathMatch = this.checkPathMatch(normalizedPath, dirName, rule);
      const fileMatch = this.checkFileMatch(fileName, rule);
      
      if (pathMatch || fileMatch) {
        matches.push({
          path: filePath,
          category: rule.category,
          confidence: rule.confidence,
          reasons: [
            ...(pathMatch ? [pathMatch] : []),
            ...(fileMatch ? [fileMatch] : []),
          ],
        });
      }
    }
    
    // 返回最高置信度的匹配
    if (matches.length > 0) {
      matches.sort((a, b) => b.confidence - a.confidence);
      return matches[0];
    }
    
    // 无匹配 → unknown
    return {
      path: filePath,
      category: 'unknown',
      confidence: 0,
      reasons: ['No matching classification rule'],
    };
  }
  
  /**
   * 批量分类
   */
  classifyMany(paths: string[], repoRoot: string = ''): ModuleClassification[] {
    return paths.map(p => this.classify(p, repoRoot));
  }
  
  /**
   * 分类目录
   */
  classifyDirectory(dirPath: string, repoRoot: string = ''): ModuleClassification {
    const dirName = path.basename(dirPath);
    const relativePath = path.relative(repoRoot, dirPath).replace(/\\/g, '/');
    
    // 检查路径模式
    for (const rule of CLASSIFICATION_RULES) {
      for (const pattern of rule.pathPatterns) {
        if (this.matchesPattern(dirName, pattern) || relativePath.includes(`/${pattern}/`)) {
          return {
            path: dirPath,
            category: rule.category,
            confidence: rule.confidence,
            reasons: [`Directory name matches pattern: ${pattern}`],
          };
        }
      }
    }
    
    return {
      path: dirPath,
      category: 'unknown',
      confidence: 0,
      reasons: ['No matching directory pattern'],
    };
  }
  
  /**
   * 构建重要路径分类
   */
  buildImportantPaths(
    paths: string[],
    repoRoot: string
  ): ImportantPaths {
    const result: ImportantPaths = {
      app: [],
      lib: [],
      tests: [],
      infra: [],
      scripts: [],
      docs: [],
      configs: [],
    };
    
    for (const p of paths) {
      const classification = this.classify(p, repoRoot);
      
      switch (classification.category) {
        case 'app':
          result.app.push(p);
          break;
        case 'lib':
          result.lib.push(p);
          break;
        case 'tests':
          result.tests.push(p);
          break;
        case 'infra':
          result.infra.push(p);
          break;
        case 'scripts':
          result.scripts.push(p);
          break;
        case 'docs':
          result.docs.push(p);
          break;
        case 'config':
          result.configs.push(p);
          break;
      }
    }
    
    return result;
  }
  
  /**
   * 获取分类描述
   */
  getCategoryDescription(category: ModuleCategory): string {
    const rule = CLASSIFICATION_RULES.find(r => r.category === category);
    return rule?.description || 'Unknown category';
  }
  
  /**
   * 获取所有分类
   */
  getAllCategories(): ModuleCategory[] {
    return CLASSIFICATION_RULES.map(r => r.category);
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 检查路径匹配
   */
  private checkPathMatch(
    normalizedPath: string,
    dirName: string,
    rule: ClassificationRule
  ): string | null {
    for (const pattern of rule.pathPatterns) {
      if (this.matchesPattern(dirName, pattern) || normalizedPath.includes(`/${pattern}/`)) {
        return `Path matches pattern: ${pattern}`;
      }
    }
    return null;
  }
  
  /**
   * 检查文件匹配
   */
  private checkFileMatch(
    fileName: string,
    rule: ClassificationRule
  ): string | null {
    for (const pattern of rule.filePatterns) {
      if (this.matchesPattern(fileName, pattern)) {
        return `File matches pattern: ${pattern}`;
      }
    }
    return null;
  }
  
  /**
   * 检查模式匹配
   */
  private matchesPattern(name: string, pattern: string): boolean {
    // 精确匹配
    if (name === pattern) return true;
    
    // 通配符匹配 (*.xxx)
    if (pattern.startsWith('*')) {
      const extension = pattern.slice(1);
      return name.endsWith(extension);
    }
    
    // 前缀匹配 (test-*)
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return name.startsWith(prefix);
    }
    
    // 包含匹配
    if (name.toLowerCase().includes(pattern.toLowerCase())) {
      return true;
    }
    
    return false;
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建模块分类器
 */
export function createModuleClassifier(config?: ClassifierConfig): ModuleClassifier {
  return new ModuleClassifier(config);
}

/**
 * 快速分类路径
 */
export function classifyPath(filePath: string, repoRoot?: string): ModuleClassification {
  const classifier = new ModuleClassifier();
  return classifier.classify(filePath, repoRoot);
}

/**
 * 获取分类描述
 */
export function getCategoryDescription(category: ModuleCategory): string {
  const classifier = new ModuleClassifier();
  return classifier.getCategoryDescription(category);
}
