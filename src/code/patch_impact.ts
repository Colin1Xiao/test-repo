/**
 * Patch Impact - 补丁影响分析
 * 
 * 职责：
 * 1. 分析变更文件的影响
 * 2. 识别影响的符号
 * 3. 识别影响的入口点
 * 4. 评估风险等级
 * 5. 生成影响证据
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import * as path from 'path';
import type { ImpactReport, ImpactEvidence, RiskLevel, TestRef, Entrypoint, SymbolDefinition } from './types';
import type { TestInventory } from './types';
import type { SymbolIndex } from './types';
import { TestMapper } from './test_mapper';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 影响分析配置
 */
export interface PatchImpactConfig {
  /** 包含符号分析 */
  includeSymbols?: boolean;
  
  /** 包含测试映射 */
  includeTests?: boolean;
  
  /** 高风险目录模式 */
  highRiskPatterns?: string[];
  
  /** 中风险目录模式 */
  mediumRiskPatterns?: string[];
}

// ============================================================================
// 补丁影响分析器
// ============================================================================

export class PatchImpactAnalyzer {
  private config: Required<PatchImpactConfig>;
  private symbolIndex?: SymbolIndex;
  private testInventory?: TestInventory;
  private testMapper: TestMapper;
  
  constructor(config: PatchImpactConfig = {}) {
    this.config = {
      includeSymbols: config.includeSymbols ?? true,
      includeTests: config.includeTests ?? true,
      highRiskPatterns: config.highRiskPatterns ?? [
        '/auth/',
        '/payment/',
        '/db/',
        '/api/',
        '/core/',
        '/shared/',
        '/lib/',
        'entrypoint',
        'main.',
        'app.',
      ],
      mediumRiskPatterns: config.mediumRiskPatterns ?? [
        '/src/',
        '/app/',
        '/services/',
        '/handlers/',
        '/controllers/',
      ],
    };
    
    this.testMapper = new TestMapper();
  }
  
  /**
   * 设置符号索引
   */
  setSymbolIndex(index: SymbolIndex): void {
    this.symbolIndex = index;
    this.testMapper.setInventory(this.testInventory);
  }
  
  /**
   * 设置测试清单
   */
  setTestInventory(inventory: TestInventory): void {
    this.testInventory = inventory;
    this.testMapper.setInventory(inventory);
  }
  
  /**
   * 分析影响
   */
  async analyze(changedFiles: string[]): Promise<ImpactReport> {
    const evidence: ImpactEvidence[] = [];
    const impactedSymbols: SymbolDefinition[] = [];
    const impactedFiles = new Set<string>();
    const affectedEntrypoints: Entrypoint[] = [];
    const relatedTests: TestRef[] = [];
    
    // 1. 文件变更证据
    for (const file of changedFiles) {
      evidence.push({
        type: 'file_change',
        description: `File changed: ${file}`,
        confidence: 1.0,
        source: 'patch',
      });
      
      impactedFiles.add(file);
    }
    
    // 2. 符号影响分析
    if (this.config.includeSymbols && this.symbolIndex) {
      const symbols = await this.findImpactedSymbols(changedFiles);
      impactedSymbols.push(...symbols);
      
      for (const symbol of symbols) {
        evidence.push({
          type: 'symbol_change',
          description: `Symbol affected: ${symbol.name} (${symbol.kind})`,
          confidence: 0.8,
          source: 'symbol_index',
        });
      }
    }
    
    // 3. 入口点影响分析
    const entrypoints = await this.findAffectedEntrypoints(changedFiles);
    affectedEntrypoints.push(...entrypoints);
    
    for (const entrypoint of entrypoints) {
      evidence.push({
        type: 'import_relation',
        description: `Entrypoint affected: ${entrypoint.path} (${entrypoint.type})`,
        confidence: 0.7,
        source: 'entrypoint_analysis',
      });
    }
    
    // 4. 测试映射
    if (this.config.includeTests && this.testInventory) {
      const tests = await this.findRelatedTests(changedFiles);
      relatedTests.push(...tests);
      
      for (const test of tests.slice(0, 5)) {
        evidence.push({
          type: 'test_relation',
          description: `Related test: ${test.file}`,
          confidence: test.confidence,
          source: 'test_mapping',
        });
      }
    }
    
    // 5. 风险评估
    const risk = this.assessRisk(changedFiles, impactedSymbols, entrypoints);
    const riskReasons = this.getRiskReasons(changedFiles, impactedSymbols, entrypoints);
    
    return {
      changedFiles,
      impactedSymbols,
      impactedFiles: Array.from(impactedFiles),
      affectedEntrypoints,
      relatedTests,
      risk,
      riskReasons,
      evidence,
    };
  }
  
  /**
   * 查找影响的符号
   */
  private async findImpactedSymbols(changedFiles: string[]): Promise<SymbolDefinition[]> {
    const symbols: SymbolDefinition[] = [];
    
    if (!this.symbolIndex) return symbols;
    
    for (const file of changedFiles) {
      const fileSymbols = this.symbolIndex.byFile.get(file);
      if (fileSymbols) {
        symbols.push(...fileSymbols);
      }
      
      // 查找引用该文件的其他符号
      for (const [name, defs] of this.symbolIndex.byName.entries()) {
        for (const def of defs) {
          if (def.file !== file) {
            // 简化：假设所有导出符号都可能被引用
            if (def.exported) {
              symbols.push(def);
            }
          }
        }
      }
    }
    
    return symbols;
  }
  
  /**
   * 查找影响的入口点
   */
  private async findAffectedEntrypoints(changedFiles: string[]): Promise<Entrypoint[]> {
    const affected: Entrypoint[] = [];
    
    // 简化实现：检查变更文件是否是入口点或在入口点附近
    for (const file of changedFiles) {
      // 检查是否是入口点文件
      const entrypointPatterns = ['main.', 'index.', 'app.', 'pages/', 'api/'];
      
      for (const pattern of entrypointPatterns) {
        if (file.includes(pattern)) {
          affected.push({
            path: file,
            type: 'app',
            confidence: 'primary',
            description: `Affected entrypoint: ${file}`,
          });
        }
      }
    }
    
    return affected;
  }
  
  /**
   * 查找相关测试
   */
  private async findRelatedTests(changedFiles: string[]): Promise<TestRef[]> {
    if (!this.testInventory) return [];
    
    return await this.testMapper.getAllRelatedTests(changedFiles);
  }
  
  /**
   * 评估风险
   */
  private assessRisk(
    changedFiles: string[],
    symbols: SymbolDefinition[],
    entrypoints: Entrypoint[]
  ): RiskLevel {
    // 高风险：入口点变更
    if (entrypoints.length > 0) {
      return 'high';
    }
    
    // 高风险：核心目录变更
    for (const file of changedFiles) {
      for (const pattern of this.config.highRiskPatterns) {
        if (file.includes(pattern)) {
          return 'high';
        }
      }
    }
    
    // 高风险：导出符号变更
    const exportedSymbols = symbols.filter(s => s.exported);
    if (exportedSymbols.length > 3) {
      return 'high';
    }
    
    // 中风险：业务逻辑目录
    for (const file of changedFiles) {
      for (const pattern of this.config.mediumRiskPatterns) {
        if (file.includes(pattern)) {
          return 'medium';
        }
      }
    }
    
    // 低风险：文档/配置/测试
    const docPatterns = ['.md', '.rst', 'README', 'CHANGELOG', 'docs/', 'config/'];
    for (const file of changedFiles) {
      for (const pattern of docPatterns) {
        if (file.includes(pattern)) {
          return 'low';
        }
      }
    }
    
    // 默认中风险
    return 'medium';
  }
  
  /**
   * 获取风险原因
   */
  private getRiskReasons(
    changedFiles: string[],
    symbols: SymbolDefinition[],
    entrypoints: Entrypoint[]
  ): string[] {
    const reasons: string[] = [];
    
    if (entrypoints.length > 0) {
      reasons.push(`Entrypoint affected: ${entrypoints[0].path}`);
    }
    
    for (const file of changedFiles) {
      for (const pattern of this.config.highRiskPatterns) {
        if (file.includes(pattern)) {
          reasons.push(`High-risk directory: ${pattern}`);
        }
      }
    }
    
    const exportedSymbols = symbols.filter(s => s.exported);
    if (exportedSymbols.length > 0) {
      reasons.push(`${exportedSymbols.length} exported symbols affected`);
    }
    
    if (reasons.length === 0) {
      reasons.push('Standard business logic changes');
    }
    
    return reasons;
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建补丁影响分析器
 */
export function createPatchImpactAnalyzer(config?: PatchImpactConfig): PatchImpactAnalyzer {
  return new PatchImpactAnalyzer(config);
}

/**
 * 快速分析影响
 */
export async function analyzePatchImpact(
  changedFiles: string[],
  symbolIndex?: SymbolIndex,
  testInventory?: TestInventory
): Promise<ImpactReport> {
  const analyzer = new PatchImpactAnalyzer();
  if (symbolIndex) analyzer.setSymbolIndex(symbolIndex);
  if (testInventory) analyzer.setTestInventory(testInventory);
  return await analyzer.analyze(changedFiles);
}
