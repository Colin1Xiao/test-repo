/**
 * Test Mapper - 测试映射器
 * 
 * 职责：
 * 1. 将源文件映射到相关测试
 * 2. 将符号映射到相关测试
 * 3. 支持强/中/弱映射
 * 4. 返回映射分数和原因
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import * as path from 'path';
import type { TestRef, TestMapping, TestInventory, TestMapperConfig, SymbolDefinition } from './types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 映射结果
 */
interface MappingResult {
  tests: TestRef[];
  strength: 'strong' | 'medium' | 'weak';
  reasons: string[];
}

// ============================================================================
// 测试映射器
// ============================================================================

export class TestMapper {
  private config: Required<TestMapperConfig>;
  private inventory?: TestInventory;
  
  constructor(config: TestMapperConfig = {}) {
    this.config = {
      maxTests: config.maxTests ?? 20,
      minConfidence: config.minConfidence ?? 0.3,
    };
  }
  
  /**
   * 设置测试清单
   */
  setInventory(inventory: TestInventory): void {
    this.inventory = inventory;
  }
  
  /**
   * 映射源文件到测试
   */
  async mapFile(sourceFile: string): Promise<TestMapping> {
    if (!this.inventory) {
      return {
        sourceFile,
        tests: [],
        strength: 'weak',
        reasons: ['No test inventory available'],
      };
    }
    
    const result = this.findRelatedTests(sourceFile);
    
    return {
      sourceFile,
      tests: result.tests.slice(0, this.config.maxTests),
      strength: result.strength,
      reasons: result.reasons,
    };
  }
  
  /**
   * 映射符号到测试
   */
  async mapSymbol(symbol: SymbolDefinition): Promise<TestMapping> {
    if (!this.inventory) {
      return {
        sourceFile: symbol.file,
        tests: [],
        strength: 'weak',
        reasons: ['No test inventory available'],
      };
    }
    
    // 基于文件映射
    const fileMapping = await this.mapFile(symbol.file);
    
    // 基于符号名查找
    const symbolTests = this.findTestsBySymbolName(symbol);
    
    // 合并结果
    const allTests = this.mergeTests([...fileMapping.tests, ...symbolTests]);
    
    return {
      sourceFile: symbol.file,
      tests: allTests.slice(0, this.config.maxTests),
      strength: fileMapping.strength,
      reasons: [...fileMapping.reasons, ...symbolTests.map(t => `Symbol name match: ${t.file}`)],
    };
  }
  
  /**
   * 映射多个文件
   */
  async mapFiles(sourceFiles: string[]): Promise<TestMapping[]> {
    return await Promise.all(sourceFiles.map(f => this.mapFile(f)));
  }
  
  /**
   * 获取所有相关测试
   */
  async getAllRelatedTests(sourceFiles: string[]): Promise<TestRef[]> {
    const mappings = await this.mapFiles(sourceFiles);
    const allTests = mappings.flatMap(m => m.tests);
    return this.deduplicateTests(allTests);
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 查找相关测试
   */
  private findRelatedTests(sourceFile: string): MappingResult {
    const tests: TestRef[] = [];
    const reasons: string[] = [];
    let strength: 'strong' | 'medium' | 'weak' = 'weak';
    
    if (!this.inventory) {
      return { tests, strength, reasons };
    }
    
    const sourceBaseName = path.basename(sourceFile, path.extname(sourceFile));
    const sourceDir = path.dirname(sourceFile);
    
    // 强映射：同名测试文件
    const strongTests = this.findByNameMatch(sourceBaseName, sourceDir);
    if (strongTests.length > 0) {
      tests.push(...strongTests);
      reasons.push(`Strong match: same name tests found`);
      strength = 'strong';
    }
    
    // 中映射：同目录测试
    const mediumTests = this.findByDirectory(sourceDir);
    if (mediumTests.length > 0) {
      tests.push(...mediumTests);
      reasons.push(`Medium match: same directory tests found`);
      if (strength !== 'strong') strength = 'medium';
    }
    
    // 中映射：同模块测试
    const moduleTests = this.findByModule(sourceFile);
    if (moduleTests.length > 0) {
      tests.push(...moduleTests);
      reasons.push(`Medium match: same module tests found`);
      if (strength !== 'strong') strength = 'medium';
    }
    
    // 弱映射：所有测试（作为 fallback）
    if (tests.length === 0) {
      const weakTests = this.inventory.tests.slice(0, 5);
      tests.push(...weakTests);
      reasons.push(`Weak match: general tests`);
      strength = 'weak';
    }
    
    return { tests, strength, reasons };
  }
  
  /**
   * 按名称匹配查找测试
   */
  private findByNameMatch(sourceBaseName: string, sourceDir: string): TestRef[] {
    const matches: TestRef[] = [];
    
    if (!this.inventory) return matches;
    
    // 查找 foo.ts -> foo.test.ts / test_foo.py
    for (const test of this.inventory.tests) {
      const testBaseName = path.basename(test.file, path.extname(test.file));
      
      // 去掉 .test / .spec / _test 等后缀
      const cleanName = testBaseName
        .replace(/\.test$/, '')
        .replace(/\.spec$/, '')
        .replace(/^test_/, '')
        .replace(/_test$/, '');
      
      if (cleanName === sourceBaseName) {
        matches.push(test);
      }
    }
    
    return matches;
  }
  
  /**
   * 按目录查找测试
   */
  private findByDirectory(sourceDir: string): TestRef[] {
    const matches: TestRef[] = [];
    
    if (!this.inventory) return matches;
    
    for (const test of this.inventory.tests) {
      const testDir = path.dirname(test.file);
      
      // 同目录或子目录
      if (testDir === sourceDir || testDir.startsWith(sourceDir + '/')) {
        matches.push(test);
      }
    }
    
    return matches;
  }
  
  /**
   * 按模块查找测试
   */
  private findByModule(sourceFile: string): TestRef[] {
    const matches: TestRef[] = [];
    
    if (!this.inventory) return matches;
    
    const sourceModule = this.extractModule(sourceFile);
    
    for (const test of this.inventory.tests) {
      if (test.relatedModules?.includes(sourceModule)) {
        matches.push(test);
      }
    }
    
    return matches;
  }
  
  /**
   * 按符号名查找测试
   */
  private findTestsBySymbolName(symbol: SymbolDefinition): TestRef[] {
    const matches: TestRef[] = [];
    
    if (!this.inventory) return matches;
    
    // 在测试内容中查找符号名（简化实现：基于文件名）
    const symbolBaseName = symbol.name.toLowerCase();
    
    for (const test of this.inventory.tests) {
      const testBaseName = path.basename(test.file).toLowerCase();
      
      if (testBaseName.includes(symbolBaseName)) {
        matches.push(test);
      }
    }
    
    return matches;
  }
  
  /**
   * 提取模块名
   */
  private extractModule(filePath: string): string {
    const parts = filePath.split(path.sep);
    const srcIndex = parts.findIndex(p => ['src', 'app', 'lib', 'packages'].includes(p));
    
    if (srcIndex !== -1 && srcIndex < parts.length - 1) {
      return parts.slice(srcIndex + 1, -1).join('/');
    }
    
    return '';
  }
  
  /**
   * 合并测试
   */
  private mergeTests(tests: TestRef[]): TestRef[] {
    return this.deduplicateTests(tests);
  }
  
  /**
   * 去重测试
   */
  private deduplicateTests(tests: TestRef[]): TestRef[] {
    const seen = new Set<string>();
    const unique: TestRef[] = [];
    
    for (const test of tests) {
      if (!seen.has(test.file)) {
        seen.add(test.file);
        unique.push(test);
      }
    }
    
    return unique;
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建测试映射器
 */
export function createTestMapper(config?: TestMapperConfig): TestMapper {
  return new TestMapper(config);
}

/**
 * 快速映射文件
 */
export async function mapFileToTests(
  inventory: TestInventory,
  sourceFile: string
): Promise<TestMapping> {
  const mapper = new TestMapper();
  mapper.setInventory(inventory);
  return await mapper.mapFile(sourceFile);
}
