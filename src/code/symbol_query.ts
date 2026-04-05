/**
 * Symbol Query - 符号查询统一接口
 * 
 * 职责：
 * 1. 统一封装 definition/references/call_graph 查询
 * 2. 提供 agent 友好的查询接口
 * 3. 构建符号上下文注入给 agent
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type { SymbolDefinition, SymbolIndex, SymbolContext, SymbolQuery, SymbolMatch, SymbolReference } from './types';
import type { DefinitionLookupResult } from './definition_lookup';
import type { ReferenceSearchResult } from './reference_search';
import type { CallGraphSummary } from './call_graph';
import { DefinitionLookup } from './definition_lookup';
import { ReferenceSearch } from './reference_search';
import { CallGraphBuilder } from './call_graph';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 查询服务配置
 */
export interface SymbolQueryServiceConfig {
  /** 最大返回结果数 */
  maxResults?: number;
  
  /** 包含上下文 */
  includeContext?: boolean;
}

/**
 * 查询结果
 */
export interface QueryResult {
  /** 符号定义 */
  definitions: SymbolDefinition[];
  
  /** 引用 */
  references?: SymbolReference[];
  
  /** 调用图 */
  callGraph?: CallGraphSummary;
  
  /** 查询耗时 */
  durationMs: number;
}

// ============================================================================
// 符号查询服务
// ============================================================================

export class SymbolQueryService {
  private config: Required<SymbolQueryServiceConfig>;
  private index?: SymbolIndex;
  private lookup: DefinitionLookup;
  private referenceSearch: ReferenceSearch;
  private callGraphBuilder: CallGraphBuilder;
  
  constructor(config: SymbolQueryServiceConfig = {}) {
    this.config = {
      maxResults: config.maxResults ?? 20,
      includeContext: config.includeContext ?? true,
    };
    
    this.lookup = new DefinitionLookup({ maxResults: this.config.maxResults });
    this.referenceSearch = new ReferenceSearch({ maxResults: this.config.maxResults });
    this.callGraphBuilder = new CallGraphBuilder();
  }
  
  /**
   * 设置索引
   */
  setIndex(index: SymbolIndex): void {
    this.index = index;
    this.lookup.setIndex(index);
    this.referenceSearch.setIndex(index);
    this.callGraphBuilder.setIndex(index);
  }
  
  /**
   * 查找定义
   */
  async findDefinitions(query: string | SymbolQuery): Promise<DefinitionLookupResult> {
    if (!this.index) {
      return { definitions: [], matches: [], durationMs: 0 };
    }
    
    return await this.lookup.findDefinitions(query);
  }
  
  /**
   * 查找引用
   */
  async findReferences(symbol: SymbolDefinition): Promise<ReferenceSearchResult> {
    if (!this.index) {
      return { symbol, references: [], totalReferences: 0, durationMs: 0 };
    }
    
    return await this.referenceSearch.findReferences(symbol);
  }
  
  /**
   * 获取相关符号
   */
  async getRelatedSymbols(symbol: SymbolDefinition): Promise<SymbolDefinition[]> {
    if (!this.index) return [];
    
    const related: SymbolDefinition[] = [];
    
    // 查找引用
    const refs = await this.referenceSearch.findReferences(symbol);
    
    // 从引用中提取相关符号
    for (const ref of refs.references) {
      if (ref.referenceType === 'call' || ref.referenceType === 'import') {
        // 查找调用者
        const fileSymbols = this.index.byFile.get(ref.location.file);
        if (fileSymbols) {
          const caller = fileSymbols.find(s => 
            s.line <= ref.location.line && 
            (s.endLine || s.line + 20) >= ref.location.line
          );
          
          if (caller && caller !== symbol) {
            related.push(caller);
          }
        }
      }
    }
    
    // 查找被调用者
    const callGraph = await this.callGraphBuilder.build(symbol);
    related.push(...callGraph.callees);
    
    // 去重
    const unique = Array.from(new Set(related.map(s => `${s.file}:${s.line}`)))
      .map(key => related.find(s => `${s.file}:${s.line}` === key))
      .filter((s): s is SymbolDefinition => s !== undefined);
    
    return unique.slice(0, this.config.maxResults);
  }
  
  /**
   * 构建符号上下文（给 agent 使用）
   */
  async buildSymbolContext(
    role: string,
    task?: any,
    repoRoot?: string
  ): Promise<SymbolContext> {
    if (!this.index) {
      return { taskId: task?.id, role };
    }
    
    const context: SymbolContext = {
      taskId: task?.id,
      role,
    };
    
    // 根据角色定制上下文
    switch (role) {
      case 'planner':
        // Planner 需要核心模块符号概览
        context.relevantSymbols = this.index.exported.slice(0, 20);
        break;
        
      case 'repo_reader':
        // Repo Reader 需要符号清单
        context.relevantSymbols = Array.from(this.index.byKind.values())
          .flat()
          .slice(0, 50);
        break;
        
      case 'code_reviewer':
        // Reviewer 需要关注导出符号和它们的引用
        context.definitions = this.index.exported.slice(0, 10);
        break;
        
      case 'code_fixer':
        // Fixer 需要精确 definition 和 references
        if (task?.targetSymbol) {
          const definitions = await this.lookup.findDefinitions(task.targetSymbol);
          context.definitions = definitions.definitions;
          
          if (definitions.definitions.length > 0) {
            const refs = await this.referenceSearch.findReferences(definitions.definitions[0]);
            context.references = refs.references;
          }
        }
        break;
        
      case 'verify_agent':
        // Verifier 需要影响分析
        if (task?.changedSymbols) {
          const impacts: SymbolDefinition[] = [];
          
          for (const symbolName of task.changedSymbols) {
            const definitions = await this.lookup.findDefinitions(symbolName);
            for (const def of definitions.definitions) {
              const refs = await this.referenceSearch.findReferences(def);
              impacts.push(...refs.references.map(r => r.symbol));
            }
          }
          
          context.relevantSymbols = impacts.slice(0, 20);
        }
        break;
    }
    
    return context;
  }
  
  /**
   * 完整查询（定义 + 引用 + 调用图）
   */
  async queryFull(symbolName: string): Promise<QueryResult> {
    const startTime = Date.now();
    
    if (!this.index) {
      return { definitions: [], durationMs: 0 };
    }
    
    // 查找定义
    const lookupResult = await this.lookup.findDefinitions(symbolName);
    
    if (lookupResult.definitions.length === 0) {
      return { definitions: [], durationMs: Date.now() - startTime };
    }
    
    const symbol = lookupResult.definitions[0];
    
    // 查找引用
    const refsResult = await this.referenceSearch.findReferences(symbol);
    
    // 构建调用图
    const callGraph = await this.callGraphBuilder.build(symbol);
    
    return {
      definitions: [symbol],
      references: refsResult.references,
      callGraph,
      durationMs: Date.now() - startTime,
    };
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建符号查询服务
 */
export function createSymbolQueryService(config?: SymbolQueryServiceConfig): SymbolQueryService {
  return new SymbolQueryService(config);
}

/**
 * 快速查询
 */
export async function querySymbol(
  index: SymbolIndex,
  symbolName: string
): Promise<QueryResult> {
  const service = new SymbolQueryService();
  service.setIndex(index);
  return await service.queryFull(symbolName);
}
