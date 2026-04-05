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
import type { SymbolDefinition, SymbolIndex, SymbolContext, SymbolQuery, SymbolReference } from './types';
import type { DefinitionLookupResult } from './definition_lookup';
import type { ReferenceSearchResult } from './reference_search';
import type { CallGraphSummary } from './call_graph';
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
export declare class SymbolQueryService {
    private config;
    private index?;
    private lookup;
    private referenceSearch;
    private callGraphBuilder;
    constructor(config?: SymbolQueryServiceConfig);
    /**
     * 设置索引
     */
    setIndex(index: SymbolIndex): void;
    /**
     * 查找定义
     */
    findDefinitions(query: string | SymbolQuery): Promise<DefinitionLookupResult>;
    /**
     * 查找引用
     */
    findReferences(symbol: SymbolDefinition): Promise<ReferenceSearchResult>;
    /**
     * 获取相关符号
     */
    getRelatedSymbols(symbol: SymbolDefinition): Promise<SymbolDefinition[]>;
    /**
     * 构建符号上下文（给 agent 使用）
     */
    buildSymbolContext(role: string, task?: any, repoRoot?: string): Promise<SymbolContext>;
    /**
     * 完整查询（定义 + 引用 + 调用图）
     */
    queryFull(symbolName: string): Promise<QueryResult>;
}
/**
 * 创建符号查询服务
 */
export declare function createSymbolQueryService(config?: SymbolQueryServiceConfig): SymbolQueryService;
/**
 * 快速查询
 */
export declare function querySymbol(index: SymbolIndex, symbolName: string): Promise<QueryResult>;
