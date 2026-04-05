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
export declare class DefinitionLookup {
    private config;
    private index?;
    constructor(config?: DefinitionLookupConfig);
    /**
     * 设置索引
     */
    setIndex(index: SymbolIndex): void;
    /**
     * 查找定义
     */
    findDefinitions(query: string | SymbolQuery, repoRoot?: string): Promise<DefinitionLookupResult>;
    /**
     * 在文件中查找定义
     */
    findInFile(symbolName: string, filePath: string): Promise<SymbolDefinition[]>;
    /**
     * 查找导出符号
     */
    findExported(query: string): Promise<SymbolDefinition[]>;
    /**
     * 按类型查找
     */
    findByKind(kind: SymbolKind): Promise<SymbolDefinition[]>;
    /**
     * 按语言查找
     */
    findByLanguage(language: string): Promise<SymbolDefinition[]>;
    /**
     * 解析查询
     */
    private parseQuery;
    /**
     * 搜索定义
     */
    private searchDefinitions;
    /**
     * 检查符号是否匹配查询
     */
    private matchesQuery;
    /**
     * 计算名称匹配分数
     */
    private calculateNameScore;
    /**
     * 计算匹配分数
     */
    private calculateScore;
    /**
     * 获取匹配原因
     */
    private getMatchReasons;
    /**
     * 驼峰匹配
     */
    private matchesCamelCase;
    /**
     * 模糊匹配
     */
    private fuzzyMatch;
}
/**
 * 创建定义查找器
 */
export declare function createDefinitionLookup(config?: DefinitionLookupConfig): DefinitionLookup;
/**
 * 快速查找定义
 */
export declare function findDefinitions(index: SymbolIndex, query: string | SymbolQuery): Promise<DefinitionLookupResult>;
