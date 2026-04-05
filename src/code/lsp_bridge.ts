/**
 * LSP Bridge - LSP 桥接层
 * 
 * 职责：
 * 1. 判断是否可启用 LSP
 * 2. 路由到对应 LSP client
 * 3. 调用 definition / references / symbols 等方法
 * 4. 包装结果为统一类型
 * 5. 出错时自动降级
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import * as path from 'path';
import type { SymbolDefinition, SymbolReference, LspQueryResult, LspCapability, LspClientConfig } from './types';
import { LspClientPool } from './lsp_client_pool';
import { ParserFallback } from './parser_fallback';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * LSP Bridge 配置
 */
export interface LspBridgeConfig {
  /** 支持的語言 */
  languages?: string[];
  
  /** LSP 超时时间（毫秒） */
  timeoutMs?: number;
  
  /** 自动降级 */
  autoFallback?: boolean;
}

/**
 * 位置信息
 */
interface Position {
  line: number;
  column: number;
}

// ============================================================================
// LSP Bridge
// ============================================================================

export class LspBridge {
  private config: Required<LspBridgeConfig>;
  private clientPool: LspClientPool;
  private parserFallback: ParserFallback;
  
  constructor(config: LspBridgeConfig = {}) {
    this.config = {
      languages: config.languages ?? ['TypeScript', 'JavaScript', 'Python'],
      timeoutMs: config.timeoutMs ?? 10000,
      autoFallback: config.autoFallback ?? true,
    };
    
    this.clientPool = new LspClientPool();
    this.parserFallback = new ParserFallback({ timeoutMs: this.config.timeoutMs });
  }
  
  /**
   * 检查 LSP 是否可用
   */
  async isLspAvailable(repoRoot: string, language: string): Promise<boolean> {
    try {
      const client = await this.clientPool.getOrCreateClient(repoRoot, language);
      return client.isRunning();
    } catch {
      return false;
    }
  }
  
  /**
   * 获取定义
   */
  async getDefinitions(
    filePath: string,
    position: Position,
    repoRoot: string
  ): Promise<LspQueryResult<SymbolDefinition[]>> {
    const startTime = Date.now();
    const language = this.getLanguage(filePath);
    
    try {
      // 尝试 LSP
      const client = await this.clientPool.getOrCreateClient(repoRoot, language);
      const lspResult = await Promise.race([
        client.findDefinition(filePath, position),
        this.timeoutPromise(this.config.timeoutMs),
      ]);
      
      if (lspResult && lspResult.length > 0) {
        return {
          data: this.convertLspDefinitions(lspResult, filePath),
          source: 'lsp',
          confidence: 0.95,
          durationMs: Date.now() - startTime,
        };
      }
    } catch (error) {
      // LSP 失败，继续降级
    }
    
    // 降级到 parser
    if (this.config.autoFallback) {
      const fallbackResult = await this.parserFallback.findDefinition(
        'unknown', // symbol name
        filePath,
        repoRoot
      );
      
      return {
        data: fallbackResult.data ? [fallbackResult.data] : [],
        source: fallbackResult.usedFallback,
        confidence: fallbackResult.usedFallback === 'parser' ? 0.7 : 0.5,
        fallbackReason: fallbackResult.reason,
        durationMs: Date.now() - startTime,
      };
    }
    
    return {
      data: [],
      source: 'lsp',
      confidence: 0,
      fallbackReason: 'LSP unavailable and fallback disabled',
      durationMs: Date.now() - startTime,
    };
  }
  
  /**
   * 获取引用
   */
  async getReferences(
    filePath: string,
    position: Position,
    repoRoot: string,
    symbolName?: string
  ): Promise<LspQueryResult<SymbolReference[]>> {
    const startTime = Date.now();
    const language = this.getLanguage(filePath);
    
    try {
      // 尝试 LSP
      const client = await this.clientPool.getOrCreateClient(repoRoot, language);
      const lspResult = await Promise.race([
        client.findReferences(filePath, position),
        this.timeoutPromise(this.config.timeoutMs),
      ]);
      
      if (lspResult && lspResult.length > 0) {
        return {
          data: this.convertLspReferences(lspResult, filePath),
          source: 'lsp',
          confidence: 0.9,
          durationMs: Date.now() - startTime,
        };
      }
    } catch (error) {
      // LSP 失败，继续降级
    }
    
    // 降级到 parser
    if (this.config.autoFallback && symbolName) {
      const fallbackResult = await this.parserFallback.findReferences(
        { name: symbolName, kind: 'function', file: filePath, line: position.line, language },
        repoRoot
      );
      
      return {
        data: fallbackResult.data || [],
        source: fallbackResult.usedFallback,
        confidence: fallbackResult.usedFallback === 'parser' ? 0.7 : 0.5,
        fallbackReason: fallbackResult.reason,
        durationMs: Date.now() - startTime,
      };
    }
    
    return {
      data: [],
      source: 'lsp',
      confidence: 0,
      fallbackReason: 'LSP unavailable and fallback disabled',
      durationMs: Date.now() - startTime,
    };
  }
  
  /**
   * 获取文档符号
   */
  async getDocumentSymbols(
    filePath: string,
    repoRoot: string
  ): Promise<LspQueryResult<SymbolDefinition[]>> {
    const startTime = Date.now();
    const language = this.getLanguage(filePath);
    
    try {
      // 尝试 LSP
      const client = await this.clientPool.getOrCreateClient(repoRoot, language);
      const lspResult = await Promise.race([
        client.getDocumentSymbols(filePath),
        this.timeoutPromise(this.config.timeoutMs),
      ]);
      
      if (lspResult && lspResult.length > 0) {
        return {
          data: this.convertLspSymbols(lspResult, filePath),
          source: 'lsp',
          confidence: 0.9,
          durationMs: Date.now() - startTime,
        };
      }
    } catch (error) {
      // LSP 失败，降级到 parser
    }
    
    // 降级到 parser
    if (this.config.autoFallback) {
      const parseResult = await this.parserFallback.parseSymbols(filePath);
      
      return {
        data: parseResult.symbols,
        source: 'parser',
        confidence: 0.7,
        fallbackReason: 'LSP unavailable, using parser',
        durationMs: Date.now() - startTime,
      };
    }
    
    return {
      data: [],
      source: 'lsp',
      confidence: 0,
      fallbackReason: 'LSP unavailable and fallback disabled',
      durationMs: Date.now() - startTime,
    };
  }
  
  /**
   * 获取工作区符号
   */
  async getWorkspaceSymbols(
    query: string,
    repoRoot: string
  ): Promise<LspQueryResult<SymbolDefinition[]>> {
    const startTime = Date.now();
    
    // 简化实现：LSP 工作区符号查询较复杂，暂时降级
    const fallbackResult = await this.parserFallback.findDefinition(query, '', repoRoot);
    
    return {
      data: fallbackResult.data ? [fallbackResult.data] : [],
      source: 'static_scan',
      confidence: 0.6,
      fallbackReason: 'Workspace symbols via static scan',
      durationMs: Date.now() - startTime,
    };
  }
  
  /**
   * 检查能力
   */
  hasCapability(repoRoot: string, language: string, capability: LspCapability): boolean {
    // 简化实现
    const supportedCapabilities: Record<string, LspCapability[]> = {
      'TypeScript': ['definition', 'references', 'documentSymbols', 'workspaceSymbols'],
      'JavaScript': ['definition', 'references', 'documentSymbols', 'workspaceSymbols'],
      'Python': ['definition', 'references', 'documentSymbols'],
    };
    
    return supportedCapabilities[language]?.includes(capability) ?? false;
  }
  
  /**
   * 停止所有客户端
   */
  async stopAll(): Promise<void> {
    await this.clientPool.stopAll();
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 转换 LSP 定义为内部类型
   */
  private convertLspDefinitions(lspDefs: any[], filePath: string): SymbolDefinition[] {
    return lspDefs.map(def => ({
      name: def.name || 'unknown',
      kind: this.mapLspSymbolKind(def.kind) as any,
      file: def.uri ? this.uriToPath(def.uri) : filePath,
      line: def.range?.start?.line || 0,
      column: def.range?.start?.character || 0,
      language: this.getLanguage(filePath),
      confidence: 0.95,
    }));
  }
  
  /**
   * 转换 LSP 引用为内部类型
   */
  private convertLspReferences(lspRefs: any[], filePath: string): SymbolReference[] {
    return lspRefs.map(ref => ({
      symbol: {
        name: 'unknown',
        kind: 'function',
        file: filePath,
        line: 0,
        language: this.getLanguage(filePath),
      },
      location: {
        file: ref.uri ? this.uriToPath(ref.uri) : filePath,
        line: ref.range?.start?.line || 0,
      },
      referenceType: 'reference',
    }));
  }
  
  /**
   * 转换 LSP 符号为内部类型
   */
  private convertLspSymbols(lspSymbols: any[], filePath: string): SymbolDefinition[] {
    return lspSymbols.map(sym => ({
      name: sym.name || 'unknown',
      kind: this.mapLspSymbolKind(sym.kind) as any,
      file: filePath,
      line: sym.location?.range?.start?.line || 0,
      language: this.getLanguage(filePath),
      confidence: 0.9,
    }));
  }
  
  /**
   * 映射 LSP 符号类型
   */
  private mapLspSymbolKind(kind: number): string {
    const kindMap: Record<number, string> = {
      1: 'file',
      2: 'module',
      3: 'namespace',
      4: 'package',
      5: 'class',
      6: 'method',
      7: 'property',
      8: 'field',
      9: 'constructor',
      10: 'enum',
      11: 'interface',
      12: 'function',
      13: 'variable',
      14: 'constant',
    };
    
    return kindMap[kind] || 'unknown';
  }
  
  /**
   * URI 转路径
   */
  private uriToPath(uri: string): string {
    if (uri.startsWith('file://')) {
      return uri.slice(7);
    }
    return uri;
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
   * 超时 Promise
   */
  private timeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
    });
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建 LSP Bridge
 */
export function createLspBridge(config?: LspBridgeConfig): LspBridge {
  return new LspBridge(config);
}
