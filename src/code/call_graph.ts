/**
 * Call Graph - 调用关系图
 * 
 * 职责：
 * 1. 构建文件级依赖边
 * 2. 构建符号级直接调用边
 * 3. 构建 import 边
 * 4. 构建继承边
 * 5. 输出轻量级调用图
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type { SymbolDefinition, SymbolRelation, RelationType, SymbolIndex, SymbolReference } from './types';
import { ReferenceSearch } from './reference_search';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 文件关系
 */
export interface FileRelation {
  /** 源文件 */
  from: string;
  
  /** 目标文件 */
  to: string;
  
  /** 关系类型 */
  relation: 'imports' | 'depends_on';
  
  /** 导入的符号 */
  symbols?: string[];
}

/**
 * 调用图摘要
 */
export interface CallGraphSummary {
  /** 调用者 */
  callers: SymbolDefinition[];
  
  /** 被调用者 */
  callees: SymbolDefinition[];
  
  /** 文件依赖 */
  fileDependencies: FileRelation[];
  
  /** 调用深度 */
  depth: number;
}

// ============================================================================
// 调用图构建器
// ============================================================================

export class CallGraphBuilder {
  private index?: SymbolIndex;
  private referenceSearch: ReferenceSearch;
  
  constructor() {
    this.referenceSearch = new ReferenceSearch();
  }
  
  /**
   * 设置索引
   */
  setIndex(index: SymbolIndex): void {
    this.index = index;
    this.referenceSearch.setIndex(index);
  }
  
  /**
   * 构建调用图
   */
  async build(symbol?: SymbolDefinition): Promise<CallGraphSummary> {
    if (!this.index) {
      return {
        callers: [],
        callees: [],
        fileDependencies: [],
        depth: 0,
      };
    }
    
    // 构建文件依赖
    const fileDeps = await this.buildFileDependencies();
    
    if (!symbol) {
      return {
        callers: [],
        callees: [],
        fileDependencies: fileDeps,
        depth: 0,
      };
    }
    
    // 查找引用（调用者）
    const refs = await this.referenceSearch.findReferences(symbol);
    const callers = this.extractCallers(refs.references);
    
    // 查找被调用者（函数体内的调用）
    const callees = await this.findCallees(symbol);
    
    return {
      callers,
      callees,
      fileDependencies: fileDeps,
      depth: 1, // 第一版只做直接调用
    };
  }
  
  /**
   * 构建文件依赖关系
   */
  async buildFileDependencies(): Promise<FileRelation[]> {
    const relations: FileRelation[] = [];
    
    if (!this.index) return relations;
    
    // 按文件分组符号
    const fileSymbols = new Map<string, SymbolDefinition[]>();
    for (const [file, symbols] of this.index.byFile.entries()) {
      fileSymbols.set(file, symbols);
    }
    
    // 查找 import 关系
    for (const [file, symbols] of fileSymbols.entries()) {
      const content = await this.readFile(file);
      if (!content) continue;
      
      const lines = content.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // import ... from '...'
        const importMatch = line.match(/import\s+.*?\s+from\s+['"](.+?)['"]/);
        if (importMatch) {
          const importPath = importMatch[1];
          const resolvedPath = this.resolveImportPath(file, importPath);
          
          if (resolvedPath) {
            const importedSymbols = this.extractImportedSymbols(line);
            
            relations.push({
              from: file,
              to: resolvedPath,
              relation: 'imports',
              symbols: importedSymbols,
            });
          }
        }
      }
    }
    
    return relations;
  }
  
  /**
   * 查找被调用者
   */
  private async findCallees(symbol: SymbolDefinition): Promise<SymbolDefinition[]> {
    const callees: SymbolDefinition[] = [];
    
    // 读取符号定义的文件内容
    const content = await this.readFile(symbol.file);
    if (!content) return callees;
    
    const lines = content.split('\n');
    
    // 获取符号体范围
    const startLine = symbol.line - 1;
    const endLine = symbol.endLine || startLine + 20; // 默认 20 行
    
    for (let i = startLine; i < Math.min(endLine, lines.length); i++) {
      const line = lines[i];
      
      // 查找函数调用
      const callMatches = line.matchAll(/\b(\w+)\s*\(/g);
      
      for (const match of callMatches) {
        const calledName = match[1];
        
        // 跳过关键字
        if (['if', 'for', 'while', 'switch', 'return', 'function', 'def', 'class'].includes(calledName)) {
          continue;
        }
        
        // 在索引中查找
        const definitions = this.index?.byName.get(calledName);
        if (definitions) {
          callees.push(...definitions);
        }
      }
    }
    
    // 去重
    const unique = Array.from(new Set(callees.map(s => `${s.file}:${s.line}`)))
      .map(key => callees.find(s => `${s.file}:${s.line}` === key))
      .filter((s): s is SymbolDefinition => s !== undefined);
    
    return unique;
  }
  
  /**
   * 提取调用者
   */
  private extractCallers(references: SymbolReference[]): SymbolDefinition[] {
    const callers: SymbolDefinition[] = [];
    
    for (const ref of references) {
      if (ref.referenceType === 'call' || ref.referenceType === 'import') {
        // 在引用位置查找调用者符号
        const fileSymbols = this.index?.byFile.get(ref.location.file);
        if (fileSymbols) {
          // 查找包含引用位置的符号
          const caller = fileSymbols.find(s => 
            s.line <= ref.location.line && 
            (s.endLine || s.line + 20) >= ref.location.line
          );
          
          if (caller && caller !== ref.symbol) {
            callers.push(caller);
          }
        }
      }
    }
    
    return callers;
  }
  
  /**
   * 解析导入路径
   */
  private resolveImportPath(fromFile: string, importPath: string): string | null {
    // 相对路径
    if (importPath.startsWith('.')) {
      const fromDir = importPath.dirname(fromFile);
      const resolved = importPath.join(fromDir, importPath);
      return resolved;
    }
    
    // 绝对路径（包名）- 简化处理
    // 实际应该查找 node_modules 或 site-packages
    return null;
  }
  
  /**
   * 提取导入的符号
   */
  private extractImportedSymbols(importLine: string): string[] {
    const symbols: string[] = [];
    
    // import { a, b, c } from ...
    const namedMatch = importLine.match(/import\s+{([^}]+)}\s+from/);
    if (namedMatch) {
      symbols.push(...namedMatch[1].split(',').map(s => s.trim()));
    }
    
    // import a from ...
    const defaultMatch = importLine.match(/import\s+(\w+)\s+from/);
    if (defaultMatch) {
      symbols.push(defaultMatch[1]);
    }
    
    return symbols;
  }
  
  /**
   * 读取文件
   */
  private async readFile(filePath: string): Promise<string | null> {
    try {
      const fs = await import('fs/promises');
      return await fs.readFile(filePath, 'utf-8');
    } catch {
      return null;
    }
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建调用图构建器
 */
export function createCallGraphBuilder(): CallGraphBuilder {
  return new CallGraphBuilder();
}

/**
 * 快速构建调用图
 */
export async function buildCallGraph(
  index: SymbolIndex,
  symbol?: SymbolDefinition
): Promise<CallGraphSummary> {
  const builder = new CallGraphBuilder();
  builder.setIndex(index);
  return await builder.build(symbol);
}
