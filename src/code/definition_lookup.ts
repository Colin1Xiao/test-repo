/**
 * Definition Lookup - 符号定义查找
 * 
 * 职责：
 * 1. 按符号名称查定义
 * 2. 按文件内符号查定义
 * 3. 支持模糊和精确模式
 * 4. 支持按 language / file / module 限定
 * 5. 返回结果带置信度/匹配理由
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type { SymbolDefinition, SymbolMatch, SymbolQuery, SymbolKind } from './types';
import type { SymbolIndex } from './types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 查找配置
 */
export interface DefinitionLookupConfig {
  /** 精确匹配 */
  exactMatch?: boolean;
  
  /** 区分大小写 */
  caseSensitive?: boolean;
  
  /** 最大返回结果数 */
  maxResults?: number;
  
  /** 最小置信度 */
  minConfidence?: number;
}

/**
 * 查找结果
 */
export interface DefinitionLookupResult {
  /** 匹配的定义 */
  definitions: SymbolDefinition[];
  
  /** 匹配分数 */
  matches: SymbolMatch[];
  
  /** 查找耗时 */
  durationMs: number;
}

// ============================================================================
// 定义查找器
// ============================================================================

export class DefinitionLookup {
  private config: Required<DefinitionLookupConfig>;
  private index?: SymbolIndex;
  
  constructor(config: DefinitionLookupConfig = {}) {
    this.config = {
      exactMatch: config.exactMatch ?? false,
      caseSensitive: config.caseSensitive ?? true,
      maxResults: config.maxResults ?? 20,
      minConfidence: config.minConfidence ?? 0.3,
    };
  }
  
  /**
   * 设置索引
   */
  setIndex(index: SymbolIndex): void {
    this.index = index;
  }
  
  /**
   * 查找定义
   */
  async findDefinitions(
    query: string | SymbolQuery,
    repoRoot?: string
  ): Promise<DefinitionLookupResult> {
    const startTime = Date.now();
    
    if (!this.index) {
      return { definitions: [], matches: [], durationMs: 0 };
    }
    
    // 解析查询
    const symbolQuery = this.parseQuery(query);
    
    // 执行查找
    const matches = await this.searchDefinitions(symbolQuery);
    
    // 过滤置信度
    const filtered = matches.filter(m => m.score >= this.config.minConfidence);
    
    // 排序
    filtered.sort((a, b) => b.score - a.score);
    
    // 限制结果数
    const topMatches = filtered.slice(0, this.config.maxResults);
    
    return {
      definitions: topMatches.map(m => m.symbol),
      matches: topMatches,
      durationMs: Date.now() - startTime,
    };
  }
  
  /**
   * 在文件中查找定义
   */
  async findInFile(
    symbolName: string,
    filePath: string
  ): Promise<SymbolDefinition[]> {
    if (!this.index) return [];
    
    const symbols = this.index.byFile.get(filePath);
    if (!symbols) return [];
    
    return symbols.filter(s => 
      this.matchesQuery(s, { name: symbolName, file: filePath })
    );
  }
  
  /**
   * 查找导出符号
   */
  async findExported(query: string): Promise<SymbolDefinition[]> {
    if (!this.index) return [];
    
    const matches: SymbolMatch[] = [];
    
    for (const symbol of this.index.exported) {
      const score = this.calculateScore(symbol, { name: query });
      if (score > 0) {
        matches.push({
          symbol,
          score,
          reasons: this.getMatchReasons(symbol, { name: query }),
        });
      }
    }
    
    matches.sort((a, b) => b.score - a.score);
    
    return matches
      .filter(m => m.score >= this.config.minConfidence)
      .slice(0, this.config.maxResults)
      .map(m => m.symbol);
  }
  
  /**
   * 按类型查找
   */
  async findByKind(kind: SymbolKind): Promise<SymbolDefinition[]> {
    if (!this.index) return [];
    
    return this.index.byKind.get(kind) || [];
  }
  
  /**
   * 按语言查找
   */
  async findByLanguage(language: string): Promise<SymbolDefinition[]> {
    if (!this.index) return [];
    
    return this.index.byLanguage.get(language) || [];
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 解析查询
   */
  private parseQuery(query: string | SymbolQuery): SymbolQuery {
    if (typeof query === 'string') {
      return { name: query };
    }
    return query;
  }
  
  /**
   * 搜索定义
   */
  private async searchDefinitions(query: SymbolQuery): Promise<SymbolMatch[]> {
    const matches: SymbolMatch[] = [];
    
    // 按名称搜索
    if (query.name) {
      if (this.config.exactMatch) {
        // 精确匹配
        const symbols = this.index?.byName.get(query.name);
        if (symbols) {
          for (const symbol of symbols) {
            if (this.matchesQuery(symbol, query)) {
              matches.push({
                symbol,
                score: 1.0,
                reasons: ['Exact name match'],
              });
            }
          }
        }
      } else {
        // 模糊匹配
        for (const [name, symbols] of this.index?.byName.entries() || []) {
          const score = this.calculateNameScore(name, query.name!);
          if (score > 0) {
            for (const symbol of symbols) {
              if (this.matchesQuery(symbol, query)) {
                matches.push({
                  symbol,
                  score: score * 0.9, // 模糊匹配略低分
                  reasons: this.getMatchReasons(symbol, query),
                });
              }
            }
          }
        }
      }
    } else {
      // 无条件搜索，返回所有
      for (const symbols of this.index?.byKind.values() || []) {
        for (const symbol of symbols) {
          if (this.matchesQuery(symbol, query)) {
            matches.push({
              symbol,
              score: 0.5,
              reasons: ['General match'],
            });
          }
        }
      }
    }
    
    return matches;
  }
  
  /**
   * 检查符号是否匹配查询
   */
  private matchesQuery(symbol: SymbolDefinition, query: SymbolQuery): boolean {
    if (query.kind && symbol.kind !== query.kind) return false;
    if (query.language && symbol.language !== query.language) return false;
    if (query.file && !symbol.file.includes(query.file)) return false;
    if (query.exportedOnly && !symbol.exported) return false;
    
    return true;
  }
  
  /**
   * 计算名称匹配分数
   */
  private calculateNameScore(symbolName: string, queryName: string): number {
    // 精确匹配
    if (this.config.caseSensitive) {
      if (symbolName === queryName) return 1.0;
    } else {
      if (symbolName.toLowerCase() === queryName.toLowerCase()) return 1.0;
    }
    
    // 前缀匹配
    const prefixMatch = this.config.caseSensitive
      ? symbolName.startsWith(queryName)
      : symbolName.toLowerCase().startsWith(queryName.toLowerCase());
    if (prefixMatch) return 0.8;
    
    // 包含匹配
    const containsMatch = this.config.caseSensitive
      ? symbolName.includes(queryName)
      : symbolName.toLowerCase().includes(queryName.toLowerCase());
    if (containsMatch) return 0.6;
    
    // 驼峰匹配
    if (this.matchesCamelCase(symbolName, queryName)) return 0.7;
    
    // 模糊匹配
    if (this.fuzzyMatch(symbolName, queryName)) return 0.4;
    
    return 0;
  }
  
  /**
   * 计算匹配分数
   */
  private calculateScore(
    symbol: SymbolDefinition,
    query: SymbolQuery
  ): number {
    let score = 0;
    
    // 名称匹配
    if (query.name) {
      score += this.calculateNameScore(symbol.name, query.name) * 0.6;
    }
    
    // 类型匹配
    if (query.kind && symbol.kind === query.kind) {
      score += 0.2;
    }
    
    // 语言匹配
    if (query.language && symbol.language === query.language) {
      score += 0.1;
    }
    
    // 导出符号加分
    if (symbol.exported) {
      score += 0.1;
    }
    
    return Math.min(1.0, score);
  }
  
  /**
   * 获取匹配原因
   */
  private getMatchReasons(
    symbol: SymbolDefinition,
    query: SymbolQuery
  ): string[] {
    const reasons: string[] = [];
    
    if (query.name) {
      if (symbol.name === query.name) {
        reasons.push('Exact name match');
      } else if (symbol.name.toLowerCase() === query.name.toLowerCase()) {
        reasons.push('Case-insensitive name match');
      } else if (symbol.name.startsWith(query.name)) {
        reasons.push('Prefix match');
      } else if (this.matchesCamelCase(symbol.name, query.name)) {
        reasons.push('CamelCase match');
      }
    }
    
    if (query.kind && symbol.kind === query.kind) {
      reasons.push(`Kind match: ${symbol.kind}`);
    }
    
    if (query.language && symbol.language === query.language) {
      reasons.push(`Language match: ${symbol.language}`);
    }
    
    if (symbol.exported) {
      reasons.push('Exported symbol');
    }
    
    return reasons;
  }
  
  /**
   * 驼峰匹配
   */
  private matchesCamelCase(symbolName: string, queryName: string): boolean {
    // 提取驼峰缩写
    const abbrev = symbolName.replace(/[^A-Z]/g, '').toLowerCase();
    const queryLower = queryName.toLowerCase();
    
    return abbrev.includes(queryLower) || abbrev.startsWith(queryLower);
  }
  
  /**
   * 模糊匹配
   */
  private fuzzyMatch(symbolName: string, queryName: string): boolean {
    let queryIndex = 0;
    
    for (let i = 0; i < symbolName.length && queryIndex < queryName.length; i++) {
      if (symbolName[i].toLowerCase() === queryName[queryIndex].toLowerCase()) {
        queryIndex++;
      }
    }
    
    return queryIndex === queryName.length;
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建定义查找器
 */
export function createDefinitionLookup(config?: DefinitionLookupConfig): DefinitionLookup {
  return new DefinitionLookup(config);
}

/**
 * 快速查找定义
 */
export async function findDefinitions(
  index: SymbolIndex,
  query: string | SymbolQuery
): Promise<DefinitionLookupResult> {
  const lookup = new DefinitionLookup();
  lookup.setIndex(index);
  return await lookup.findDefinitions(query);
}
