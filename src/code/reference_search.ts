/**
 * Reference Search - 符号引用搜索
 * 
 * 职责：
 * 1. 查找符号引用位置
 * 2. 识别 import/export 引用
 * 3. 识别函数调用引用
 * 4. 识别类继承/实现引用
 * 5. 返回引用上下文
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { SymbolDefinition, SymbolReference, ReferenceType, SymbolIndex } from './types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 搜索器配置
 */
export interface ReferenceSearchConfig {
  /** 包含上下文行数 */
  contextLines?: number;
  
  /** 最大返回结果数 */
  maxResults?: number;
  
  /** 排除的目录 */
  excludeDirs?: string[];
}

/**
 * 引用搜索结果
 */
export interface ReferenceSearchResult {
  /** 符号定义 */
  symbol: SymbolDefinition;
  
  /** 引用列表 */
  references: SymbolReference[];
  
  /** 引用总数（可能超过 maxResults） */
  totalReferences: number;
  
  /** 搜索耗时 */
  durationMs: number;
}

// ============================================================================
// 引用搜索器
// ============================================================================

export class ReferenceSearch {
  private config: Required<ReferenceSearchConfig>;
  private index?: SymbolIndex;
  
  constructor(config: ReferenceSearchConfig = {}) {
    this.config = {
      contextLines: config.contextLines ?? 2,
      maxResults: config.maxResults ?? 50,
      excludeDirs: config.excludeDirs ?? [
        'node_modules',
        '__pycache__',
        '.git',
        'dist',
        'build',
      ],
    };
  }
  
  /**
   * 设置索引
   */
  setIndex(index: SymbolIndex): void {
    this.index = index;
  }
  
  /**
   * 查找引用
   */
  async findReferences(symbol: SymbolDefinition): Promise<ReferenceSearchResult> {
    const startTime = Date.now();
    
    if (!this.index) {
      return { symbol, references: [], totalReferences: 0, durationMs: 0 };
    }
    
    const references: SymbolReference[] = [];
    let totalReferences = 0;
    
    // 1. 查找 import/export 引用
    const importRefs = await this.findImportReferences(symbol);
    references.push(...importRefs);
    totalReferences += importRefs.length;
    
    // 2. 查找函数调用引用
    const callRefs = await this.findCallReferences(symbol);
    references.push(...callRefs);
    totalReferences += callRefs.length;
    
    // 3. 查找继承/实现引用
    const inheritRefs = await this.findInheritanceReferences(symbol);
    references.push(...inheritRefs);
    totalReferences += inheritRefs.length;
    
    // 4. 查找普通引用
    const generalRefs = await this.findGeneralReferences(symbol);
    references.push(...generalRefs);
    totalReferences += generalRefs.length;
    
    // 去重
    const unique = this.deduplicateReferences(references);
    
    // 限制结果数
    const limited = unique.slice(0, this.config.maxResults);
    
    return {
      symbol,
      references: limited,
      totalReferences,
      durationMs: Date.now() - startTime,
    };
  }
  
  /**
   * 查找 import/export 引用
   */
  private async findImportReferences(symbol: SymbolDefinition): Promise<SymbolReference[]> {
    const references: SymbolReference[] = [];
    
    // 在索引中查找导入该符号的文件
    for (const [file, symbols] of this.index?.byFile.entries() || []) {
      if (file === symbol.file) continue; // 跳过定义文件
      
      const content = await this.readFile(file);
      if (!content) continue;
      
      const lines = content.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // import { symbol } from ...
        if (line.includes(`import`) && line.includes(symbol.name)) {
          const importMatch = line.match(new RegExp(
            `import\\s+.*?\\b${this.escapeRegex(symbol.name)}\\b.*?from`,
            'i'
          ));
          
          if (importMatch) {
            references.push({
              symbol,
              location: {
                file,
                line: i + 1,
              },
              referenceType: 'import',
              context: this.getContext(lines, i),
            });
          }
        }
        
        // export { symbol }
        if (line.includes(`export`) && line.includes(symbol.name)) {
          const exportMatch = line.match(new RegExp(
            `export\\s+.*?\\b${this.escapeRegex(symbol.name)}\\b`,
            'i'
          ));
          
          if (exportMatch) {
            references.push({
              symbol,
              location: {
                file,
                line: i + 1,
              },
              referenceType: 'export',
              context: this.getContext(lines, i),
            });
          }
        }
      }
    }
    
    return references;
  }
  
  /**
   * 查找函数调用引用
   */
  private async findCallReferences(symbol: SymbolDefinition): Promise<SymbolReference[]> {
    const references: SymbolReference[] = [];
    
    if (symbol.kind !== 'function' && symbol.kind !== 'method') {
      return references;
    }
    
    // 扫描所有文件查找函数调用
    for (const [file, symbols] of this.index?.byFile.entries() || []) {
      if (file === symbol.file) continue;
      
      const content = await this.readFile(file);
      if (!content) continue;
      
      const lines = content.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // 函数调用模式：symbolName(
        const callMatch = line.match(new RegExp(
          `\\b${this.escapeRegex(symbol.name)}\\s*\\(`,
        ));
        
        if (callMatch && !line.includes('function') && !line.includes('def')) {
          references.push({
            symbol,
            location: {
              file,
              line: i + 1,
            },
            referenceType: 'call',
            context: this.getContext(lines, i),
          });
        }
      }
    }
    
    return references;
  }
  
  /**
   * 查找继承/实现引用
   */
  private async findInheritanceReferences(symbol: SymbolDefinition): Promise<SymbolReference[]> {
    const references: SymbolReference[] = [];
    
    if (symbol.kind !== 'class' && symbol.kind !== 'interface') {
      return references;
    }
    
    // 扫描所有文件查找继承/实现
    for (const [file, symbols] of this.index?.byFile.entries() || []) {
      if (file === symbol.file) continue;
      
      const content = await this.readFile(file);
      if (!content) continue;
      
      const lines = content.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // extends SymbolName
        const extendsMatch = line.match(new RegExp(
          `extends\\s+${this.escapeRegex(symbol.name)}\\b`,
        ));
        
        if (extendsMatch) {
          references.push({
            symbol,
            location: {
              file,
              line: i + 1,
            },
            referenceType: 'inherit',
            context: this.getContext(lines, i),
          });
        }
        
        // implements SymbolName
        const implementsMatch = line.match(new RegExp(
          `implements\\s+${this.escapeRegex(symbol.name)}\\b`,
        ));
        
        if (implementsMatch) {
          references.push({
            symbol,
            location: {
              file,
              line: i + 1,
            },
            referenceType: 'implement',
            context: this.getContext(lines, i),
          });
        }
      }
    }
    
    return references;
  }
  
  /**
   * 查找普通引用
   */
  private async findGeneralReferences(symbol: SymbolDefinition): Promise<SymbolReference[]> {
    const references: SymbolReference[] = [];
    
    // 在同文件中查找引用
    const fileSymbols = this.index?.byFile.get(symbol.file);
    if (fileSymbols) {
      const content = await this.readFile(symbol.file);
      if (content) {
        const lines = content.split('\n');
        
        for (let i = symbol.line; i < lines.length; i++) {
          const line = lines[i];
          
          // 跳过定义行
          if (i + 1 === symbol.line) continue;
          
          if (line.includes(symbol.name)) {
            references.push({
              symbol,
              location: {
                file: symbol.file,
                line: i + 1,
              },
              referenceType: 'reference',
              context: this.getContext(lines, i),
            });
          }
        }
      }
    }
    
    return references;
  }
  
  /**
   * 去重引用
   */
  private deduplicateReferences(references: SymbolReference[]): SymbolReference[] {
    const seen = new Set<string>();
    const unique: SymbolReference[] = [];
    
    for (const ref of references) {
      const key = `${ref.location.file}:${ref.location.line}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(ref);
      }
    }
    
    return unique;
  }
  
  /**
   * 获取上下文
   */
  private getContext(lines: string[], lineIndex: number): string {
    const start = Math.max(0, lineIndex - this.config.contextLines);
    const end = Math.min(lines.length, lineIndex + this.config.contextLines + 1);
    
    return lines.slice(start, end).join('\n');
  }
  
  /**
   * 读取文件
   */
  private async readFile(filePath: string): Promise<string | null> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch {
      return null;
    }
  }
  
  /**
   * 转义正则表达式
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建引用搜索器
 */
export function createReferenceSearch(config?: ReferenceSearchConfig): ReferenceSearch {
  return new ReferenceSearch(config);
}

/**
 * 快速查找引用
 */
export async function findReferences(
  index: SymbolIndex,
  symbol: SymbolDefinition
): Promise<ReferenceSearchResult> {
  const search = new ReferenceSearch();
  search.setIndex(index);
  return await search.findReferences(symbol);
}
