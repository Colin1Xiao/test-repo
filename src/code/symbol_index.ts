/**
 * Symbol Index - 符号索引
 * 
 * 职责：
 * 1. 扫描 TS/JS + Python 文件
 * 2. 提取函数、类、方法、接口、类型、变量
 * 3. 建立 name -> definitions[] 索引
 * 4. 建立 file -> symbols[] 索引
 * 5. 记录语言、位置、导出性、签名摘要
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { SymbolDefinition, SymbolIndex, SymbolKind, SymbolEvidence } from './types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 索引器配置
 */
export interface SymbolIndexerConfig {
  /** 包含的语言 */
  languages?: string[];
  
  /** 排除的目录 */
  excludeDirs?: string[];
  
  /** 排除的文件 */
  excludeFiles?: string[];
  
  /** 最大深度 */
  maxDepth?: number;
}

/**
 * 符号提取结果
 */
interface ExtractResult {
  symbols: SymbolDefinition[];
  errors: string[];
}

// ============================================================================
// 符号提取器
// ============================================================================

export class SymbolIndexer {
  private config: Required<SymbolIndexerConfig>;
  
  constructor(config: SymbolIndexerConfig = {}) {
    this.config = {
      languages: config.languages ?? ['TypeScript', 'JavaScript', 'Python'],
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
      excludeFiles: config.excludeFiles ?? [
        '*.d.ts',
        '*.min.js',
        '*.bundle.js',
      ],
      maxDepth: config.maxDepth ?? 10,
    };
  }
  
  /**
   * 构建符号索引
   */
  async buildIndex(repoRoot: string): Promise<SymbolIndex> {
    const index: SymbolIndex = {
      repoRoot,
      byName: new Map(),
      byFile: new Map(),
      byKind: new Map(),
      byLanguage: new Map(),
      exported: [],
      indexedAt: Date.now(),
      stats: {
        totalSymbols: 0,
        byKind: {} as any,
        byLanguage: {},
        byFile: {},
      },
    };
    
    // 扫描文件
    const files = await this.scanFiles(repoRoot);
    
    // 提取符号
    for (const file of files) {
      const result = await this.extractSymbols(file, repoRoot);
      
      for (const symbol of result.symbols) {
        this.addSymbolToIndex(index, symbol);
      }
    }
    
    // 计算统计
    this.calculateStats(index);
    
    return index;
  }
  
  /**
   * 扫描文件
   */
  private async scanFiles(repoRoot: string): Promise<string[]> {
    const files: string[] = [];
    
    await this.walkDirectory(repoRoot, async (filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      
      // 检查语言
      if (!this.isSupportedLanguage(ext)) return;
      
      // 检查排除
      if (this.shouldExclude(filePath)) return;
      
      files.push(filePath);
    });
    
    return files;
  }
  
  /**
   * 提取符号
   */
  private async extractSymbols(filePath: string, repoRoot: string): Promise<ExtractResult> {
    const ext = path.extname(filePath).toLowerCase();
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      switch (ext) {
        case '.ts':
        case '.tsx':
          return this.extractTypeScriptSymbols(filePath, content, repoRoot);
        case '.js':
        case '.jsx':
          return this.extractJavaScriptSymbols(filePath, content, repoRoot);
        case '.py':
          return this.extractPythonSymbols(filePath, content, repoRoot);
        default:
          return { symbols: [], errors: [] };
      }
    } catch (error) {
      return {
        symbols: [],
        errors: [`Failed to read ${filePath}: ${error}`],
      };
    }
  }
  
  /**
   * 提取 TypeScript 符号
   */
  private extractTypeScriptSymbols(
    filePath: string,
    content: string,
    repoRoot: string
  ): ExtractResult {
    const symbols: SymbolDefinition[] = [];
    const errors: string[] = [];
    
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      
      // 函数声明
      const funcMatch = line.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/);
      if (funcMatch) {
        symbols.push(this.createSymbol({
          name: funcMatch[1],
          kind: 'function',
          file: filePath,
          line: lineNum,
          language: 'TypeScript',
          exported: line.includes('export'),
          signature: this.extractFunctionSignature(line),
          evidence: { type: 'static_scan', content: line.trim(), detectedAt: Date.now() },
        }));
      }
      
      // 类声明
      const classMatch = line.match(/^(?:export\s+)?class\s+(\w+)/);
      if (classMatch) {
        symbols.push(this.createSymbol({
          name: classMatch[1],
          kind: 'class',
          file: filePath,
          line: lineNum,
          language: 'TypeScript',
          exported: line.includes('export'),
          signature: this.extractClassSignature(line),
          evidence: { type: 'static_scan', content: line.trim(), detectedAt: Date.now() },
        }));
      }
      
      // 接口声明
      const interfaceMatch = line.match(/^(?:export\s+)?interface\s+(\w+)/);
      if (interfaceMatch) {
        symbols.push(this.createSymbol({
          name: interfaceMatch[1],
          kind: 'interface',
          file: filePath,
          line: lineNum,
          language: 'TypeScript',
          exported: line.includes('export'),
          evidence: { type: 'static_scan', content: line.trim(), detectedAt: Date.now() },
        }));
      }
      
      // 类型声明
      const typeMatch = line.match(/^(?:export\s+)?type\s+(\w+)/);
      if (typeMatch) {
        symbols.push(this.createSymbol({
          name: typeMatch[1],
          kind: 'type',
          file: filePath,
          line: lineNum,
          language: 'TypeScript',
          exported: line.includes('export'),
          evidence: { type: 'static_scan', content: line.trim(), detectedAt: Date.now() },
        }));
      }
      
      // 常量/变量声明
      const varMatch = line.match(/^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*[:=]/);
      if (varMatch) {
        symbols.push(this.createSymbol({
          name: varMatch[1],
          kind: 'variable',
          file: filePath,
          line: lineNum,
          language: 'TypeScript',
          exported: line.includes('export'),
          signature: this.extractVariableSignature(line),
          evidence: { type: 'static_scan', content: line.trim(), detectedAt: Date.now() },
        }));
      }
      
      // 类方法
      const methodMatch = line.match(/^\s+(?:async\s+)?(\w+)\s*\([^)]*\)\s*[:{]/);
      if (methodMatch && !line.trim().startsWith('function')) {
        symbols.push(this.createSymbol({
          name: methodMatch[1],
          kind: 'method',
          file: filePath,
          line: lineNum,
          language: 'TypeScript',
          scope: 'class',
          evidence: { type: 'static_scan', content: line.trim(), detectedAt: Date.now() },
        }));
      }
    }
    
    return { symbols, errors };
  }
  
  /**
   * 提取 JavaScript 符号
   */
  private extractJavaScriptSymbols(
    filePath: string,
    content: string,
    repoRoot: string
  ): ExtractResult {
    // JavaScript 提取逻辑与 TypeScript 类似，但更简单
    return this.extractTypeScriptSymbols(filePath, content, repoRoot);
  }
  
  /**
   * 提取 Python 符号
   */
  private extractPythonSymbols(
    filePath: string,
    content: string,
    repoRoot: string
  ): ExtractResult {
    const symbols: SymbolDefinition[] = [];
    const errors: string[] = [];
    
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const trimmedLine = line.trim();
      
      // 跳过注释和空行
      if (trimmedLine.startsWith('#') || !trimmedLine) continue;
      
      // 函数定义
      const funcMatch = trimmedLine.match(/^def\s+(\w+)\s*\(/);
      if (funcMatch) {
        symbols.push(this.createSymbol({
          name: funcMatch[1],
          kind: 'function',
          file: filePath,
          line: lineNum,
          language: 'Python',
          exported: !funcMatch[1].startsWith('_'),
          signature: this.extractFunctionSignature(trimmedLine),
          evidence: { type: 'static_scan', content: trimmedLine, detectedAt: Date.now() },
        }));
      }
      
      // 类定义
      const classMatch = trimmedLine.match(/^class\s+(\w+)/);
      if (classMatch) {
        symbols.push(this.createSymbol({
          name: classMatch[1],
          kind: 'class',
          file: filePath,
          line: lineNum,
          language: 'Python',
          exported: !classMatch[1].startsWith('_'),
          signature: this.extractClassSignature(trimmedLine),
          evidence: { type: 'static_scan', content: trimmedLine, detectedAt: Date.now() },
        }));
      }
      
      // 模块级变量
      const varMatch = trimmedLine.match(/^(\w+)\s*=/);
      if (varMatch && !trimmedLine.startsWith(' ') && !trimmedLine.startsWith('\t')) {
        symbols.push(this.createSymbol({
          name: varMatch[1],
          kind: 'variable',
          file: filePath,
          line: lineNum,
          language: 'Python',
          exported: !varMatch[1].startsWith('_'),
          evidence: { type: 'static_scan', content: trimmedLine, detectedAt: Date.now() },
        }));
      }
      
      // 导入
      const importMatch = trimmedLine.match(/^(?:from\s+\S+\s+)?import\s+(.+)/);
      if (importMatch) {
        const imports = importMatch[1].split(',').map(s => s.trim());
        for (const imp of imports) {
          const nameMatch = imp.match(/(\w+)(?:\s+as\s+\w+)?/);
          if (nameMatch) {
            symbols.push(this.createSymbol({
              name: nameMatch[1],
              kind: 'module',
              file: filePath,
              line: lineNum,
              language: 'Python',
              evidence: { type: 'import', content: trimmedLine, detectedAt: Date.now() },
            }));
          }
        }
      }
    }
    
    return { symbols, errors };
  }
  
  /**
   * 添加符号到索引
   */
  private addSymbolToIndex(index: SymbolIndex, symbol: SymbolDefinition): void {
    // byName
    if (!index.byName.has(symbol.name)) {
      index.byName.set(symbol.name, []);
    }
    index.byName.get(symbol.name)!.push(symbol);
    
    // byFile
    if (!index.byFile.has(symbol.file)) {
      index.byFile.set(symbol.file, []);
    }
    index.byFile.get(symbol.file)!.push(symbol);
    
    // byKind
    if (!index.byKind.has(symbol.kind)) {
      index.byKind.set(symbol.kind, []);
    }
    index.byKind.get(symbol.kind)!.push(symbol);
    
    // byLanguage
    if (!index.byLanguage.has(symbol.language)) {
      index.byLanguage.set(symbol.language, []);
    }
    index.byLanguage.get(symbol.language)!.push(symbol);
    
    // exported
    if (symbol.exported) {
      index.exported.push(symbol);
    }
  }
  
  /**
   * 计算统计
   */
  private calculateStats(index: SymbolIndex): void {
    index.stats.totalSymbols = index.exported.length + 
      Array.from(index.byKind.values()).reduce((sum, arr) => sum + arr.length, 0) - index.exported.length;
    
    for (const [kind, symbols] of index.byKind.entries()) {
      index.stats.byKind[kind] = symbols.length;
    }
    
    for (const [language, symbols] of index.byLanguage.entries()) {
      index.stats.byLanguage[language] = symbols.length;
    }
    
    for (const [file, symbols] of index.byFile.entries()) {
      index.stats.byFile[file] = symbols.length;
    }
  }
  
  /**
   * 创建符号
   */
  private createSymbol(symbol: Partial<SymbolDefinition>): SymbolDefinition {
    return {
      name: '',
      kind: 'function',
      file: '',
      line: 0,
      language: 'unknown',
      ...symbol,
    };
  }
  
  /**
   * 提取函数签名
   */
  private extractFunctionSignature(line: string): string {
    const match = line.match(/(?:function|def)\s+\w+\s*\([^)]*\)/);
    return match ? match[0] : line.slice(0, 100);
  }
  
  /**
   * 提取类签名
   */
  private extractClassSignature(line: string): string {
    const match = line.match(/class\s+\w+(?:\s+extends\s+\w+)?/);
    return match ? match[0] : line.slice(0, 100);
  }
  
  /**
   * 提取变量签名
   */
  private extractVariableSignature(line: string): string {
    const match = line.match(/(?:const|let|var)\s+\w+\s*[:=]/);
    return match ? match[0] : line.slice(0, 50);
  }
  
  /**
   * 检查是否支持的语言
   */
  private isSupportedLanguage(ext: string): boolean {
    const supported = ['.ts', '.tsx', '.js', '.jsx', '.py'];
    return supported.includes(ext);
  }
  
  /**
   * 检查是否应该排除
   */
  private shouldExclude(filePath: string): boolean {
    // 检查排除目录
    for (const dir of this.config.excludeDirs) {
      if (filePath.includes(dir)) return true;
    }
    
    // 检查排除文件
    for (const pattern of this.config.excludeFiles) {
      if (pattern.startsWith('*')) {
        if (filePath.endsWith(pattern.slice(1))) return true;
      }
    }
    
    return false;
  }
  
  /**
   * 遍历目录
   */
  private async walkDirectory(
    dir: string,
    callback: (filePath: string) => Promise<void>,
    depth: number = 0
  ): Promise<void> {
    if (depth >= this.config.maxDepth) return;
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (this.shouldExclude(fullPath)) continue;
        
        if (entry.isFile()) {
          await callback(fullPath);
        } else if (entry.isDirectory()) {
          await this.walkDirectory(fullPath, callback, depth + 1);
        }
      }
    } catch {
      // 忽略错误
    }
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建符号索引器
 */
export function createSymbolIndexer(config?: SymbolIndexerConfig): SymbolIndexer {
  return new SymbolIndexer(config);
}

/**
 * 快速构建符号索引
 */
export async function buildSymbolIndex(repoRoot: string): Promise<SymbolIndex> {
  const indexer = new SymbolIndexer();
  return await indexer.buildIndex(repoRoot);
}
