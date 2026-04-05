/**
 * Parser Fallback - Parser 降级方案
 * 
 * 职责：
 * 1. 当 LSP 不可用时提供降级方案
 * 2. 支持 parser / static_scan / grep 三层降级
 * 3. 保持返回类型统一
 * 4. 标记结果来源与置信度
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { SymbolDefinition, SymbolReference, FallbackResult, SymbolKind } from './types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * Parser 配置
 */
export interface ParserFallbackConfig {
  /** 包含的语言 */
  languages?: string[];
  
  /** 超时时间（毫秒） */
  timeoutMs?: number;
  
  /** 最大扫描深度 */
  maxDepth?: number;
}

/**
 * 解析结果
 */
interface ParseResult {
  symbols: SymbolDefinition[];
  references: SymbolReference[];
}

// ============================================================================
// Parser 降级器
// ============================================================================

export class ParserFallback {
  private config: Required<ParserFallbackConfig>;
  
  constructor(config: ParserFallbackConfig = {}) {
    this.config = {
      languages: config.languages ?? ['TypeScript', 'JavaScript', 'Python'],
      timeoutMs: config.timeoutMs ?? 5000,
      maxDepth: config.maxDepth ?? 10,
    };
  }
  
  /**
   * 查找定义（降级方案）
   */
  async findDefinition(
    symbolName: string,
    filePath: string,
    repoRoot: string
  ): Promise<FallbackResult<SymbolDefinition>> {
    const startTime = Date.now();
    
    try {
      // Layer 1: Parser（如果有 tree-sitter）
      const parserResult = await this.findDefinitionByParser(symbolName, filePath);
      if (parserResult) {
        return {
          data: parserResult,
          usedFallback: 'parser',
          reason: 'Parser-based definition lookup',
        };
      }
      
      // Layer 2: Static Scan
      const staticResult = await this.findDefinitionByStaticScan(symbolName, repoRoot);
      if (staticResult) {
        return {
          data: staticResult,
          usedFallback: 'static_scan',
          reason: 'Static scan definition lookup',
        };
      }
      
      // Layer 3: Grep
      const grepResult = await this.findDefinitionByGrep(symbolName, repoRoot);
      if (grepResult) {
        return {
          data: grepResult,
          usedFallback: 'grep',
          reason: 'Grep-based definition lookup',
        };
      }
      
      return {
        data: null,
        usedFallback: 'grep',
        reason: 'No definition found in any fallback layer',
      };
      
    } catch (error) {
      return {
        data: null,
        usedFallback: 'grep',
        reason: `Fallback error: ${error instanceof Error ? error.message : String(error)}`,
        originalError: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  /**
   * 查找引用（降级方案）
   */
  async findReferences(
    symbol: SymbolDefinition,
    repoRoot: string
  ): Promise<FallbackResult<SymbolReference[]>> {
    try {
      // Layer 1: Parser
      const parserRefs = await this.findReferencesByParser(symbol, repoRoot);
      if (parserRefs.length > 0) {
        return {
          data: parserRefs,
          usedFallback: 'parser',
          reason: 'Parser-based reference lookup',
        };
      }
      
      // Layer 2: Static Scan
      const staticRefs = await this.findReferencesByStaticScan(symbol, repoRoot);
      if (staticRefs.length > 0) {
        return {
          data: staticRefs,
          usedFallback: 'static_scan',
          reason: 'Static scan reference lookup',
        };
      }
      
      // Layer 3: Grep
      const grepRefs = await this.findReferencesByGrep(symbol, repoRoot);
      return {
        data: grepRefs,
        usedFallback: 'grep',
        reason: 'Grep-based reference lookup',
      };
      
    } catch (error) {
      return {
        data: [],
        usedFallback: 'grep',
        reason: `Fallback error: ${error instanceof Error ? error.message : String(error)}`,
        originalError: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  /**
   * 解析符号（Parser 层）
   */
  async parseSymbols(filePath: string): Promise<ParseResult> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const ext = path.extname(filePath).toLowerCase();
      
      // 简单实现：基于正则的符号提取
      // 实际应该使用 tree-sitter 等 parser
      return this.extractSymbolsByRegex(content, filePath, ext);
      
    } catch (error) {
      return { symbols: [], references: [] };
    }
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * Parser 层查找定义
   */
  private async findDefinitionByParser(
    symbolName: string,
    filePath: string
  ): Promise<SymbolDefinition | null> {
    // 简化实现：使用 static scan 替代真正的 parser
    // 实际应该集成 tree-sitter
    return await this.findDefinitionByStaticScan(symbolName, path.dirname(filePath));
  }
  
  /**
   * Static Scan 查找定义
   */
  private async findDefinitionByStaticScan(
    symbolName: string,
    repoRoot: string
  ): Promise<SymbolDefinition | null> {
    const files = await this.scanFiles(repoRoot);
    
    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // 检测符号定义
        const kind = this.detectSymbolKind(line, symbolName);
        if (kind) {
          return {
            name: symbolName,
            kind,
            file,
            line: i + 1,
            language: this.getLanguage(file),
            exported: this.isExported(line),
            confidence: 0.7,
          };
        }
      }
    }
    
    return null;
  }
  
  /**
   * Grep 查找定义
   */
  private async findDefinitionByGrep(
    symbolName: string,
    repoRoot: string
  ): Promise<SymbolDefinition | null> {
    // 简化实现：使用 fs 遍历替代 grep
    const files = await this.scanFiles(repoRoot);
    
    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        
        // 简单匹配
        const pattern = new RegExp(`\\b${symbolName}\\b`, 'm');
        const match = content.match(pattern);
        
        if (match) {
          const lines = content.split('\n');
          let lineNum = 0;
          let totalChars = 0;
          
          for (let i = 0; i < lines.length; i++) {
            totalChars += lines[i].length + 1;
            if (totalChars >= match.index!) {
              lineNum = i + 1;
              break;
            }
          }
          
          return {
            name: symbolName,
            kind: 'function', // 默认
            file,
            line: lineNum,
            language: this.getLanguage(file),
            confidence: 0.5,
          };
        }
      } catch {
        // 忽略错误
      }
    }
    
    return null;
  }
  
  /**
   * Parser 层查找引用
   */
  private async findReferencesByParser(
    symbol: SymbolDefinition,
    repoRoot: string
  ): Promise<SymbolReference[]> {
    // 简化实现
    return await this.findReferencesByStaticScan(symbol, repoRoot);
  }
  
  /**
   * Static Scan 查找引用
   */
  private async findReferencesByStaticScan(
    symbol: SymbolDefinition,
    repoRoot: string
  ): Promise<SymbolReference[]> {
    const references: SymbolReference[] = [];
    const files = await this.scanFiles(repoRoot);
    
    for (const file of files) {
      if (file === symbol.file) continue;
      
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.includes(symbol.name)) {
          references.push({
            symbol,
            location: {
              file,
              line: i + 1,
            },
            referenceType: 'reference',
            context: this.getContext(lines, i),
          });
        }
      }
    }
    
    return references.slice(0, 50);
  }
  
  /**
   * Grep 查找引用
   */
  private async findReferencesByGrep(
    symbol: SymbolDefinition,
    repoRoot: string
  ): Promise<SymbolReference[]> {
    // 简化实现：使用 fs 遍历
    const references: SymbolReference[] = [];
    const files = await this.scanFiles(repoRoot);
    
    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(symbol.name)) {
            references.push({
              symbol,
              location: {
                file,
                line: i + 1,
              },
              referenceType: 'reference',
              context: this.getContext(lines, i),
            });
          }
        }
      } catch {
        // 忽略错误
      }
    }
    
    return references.slice(0, 50);
  }
  
  /**
   * 扫描文件
   */
  private async scanFiles(repoRoot: string): Promise<string[]> {
    const files: string[] = [];
    
    const walk = async (dir: string, depth: number = 0) => {
      if (depth >= this.config.maxDepth) return;
      
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          // 排除目录
          if (entry.isDirectory()) {
            if (['node_modules', '__pycache__', '.git', 'dist', 'build'].includes(entry.name)) {
              continue;
            }
            await walk(fullPath, depth + 1);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (['.ts', '.tsx', '.js', '.jsx', '.py'].includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch {
        // 忽略错误
      }
    };
    
    await walk(repoRoot);
    return files;
  }
  
  /**
   * 检测符号类型
   */
  private detectSymbolKind(line: string, symbolName: string): SymbolKind | null {
    const trimmed = line.trim();
    
    // 函数
    if (trimmed.match(new RegExp(`(function|def)\\s+${symbolName}\\s*\\(`))) {
      return 'function';
    }
    
    // 类
    if (trimmed.match(new RegExp(`class\\s+${symbolName}`))) {
      return 'class';
    }
    
    // 变量
    if (trimmed.match(new RegExp(`(const|let|var)\\s+${symbolName}\\s*[:=]`))) {
      return 'variable';
    }
    
    return null;
  }
  
  /**
   * 检查是否导出
   */
  private isExported(line: string): boolean {
    return line.includes('export') || line.startsWith('def ') || line.startsWith('class ');
  }
  
  /**
   * 获取语言
   */
  private getLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
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
        return 'unknown';
    }
  }
  
  /**
   * 获取上下文
   */
  private getContext(lines: string[], lineIndex: number, contextLines: number = 2): string {
    const start = Math.max(0, lineIndex - contextLines);
    const end = Math.min(lines.length, lineIndex + contextLines + 1);
    return lines.slice(start, end).join('\n');
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建 Parser 降级器
 */
export function createParserFallback(config?: ParserFallbackConfig): ParserFallback {
  return new ParserFallback(config);
}
