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
import type { SymbolDefinition, SymbolReference, SymbolIndex } from './types';
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
export declare class ReferenceSearch {
    private config;
    private index?;
    constructor(config?: ReferenceSearchConfig);
    /**
     * 设置索引
     */
    setIndex(index: SymbolIndex): void;
    /**
     * 查找引用
     */
    findReferences(symbol: SymbolDefinition): Promise<ReferenceSearchResult>;
    /**
     * 查找 import/export 引用
     */
    private findImportReferences;
    /**
     * 查找函数调用引用
     */
    private findCallReferences;
    /**
     * 查找继承/实现引用
     */
    private findInheritanceReferences;
    /**
     * 查找普通引用
     */
    private findGeneralReferences;
    /**
     * 去重引用
     */
    private deduplicateReferences;
    /**
     * 获取上下文
     */
    private getContext;
    /**
     * 读取文件
     */
    private readFile;
    /**
     * 转义正则表达式
     */
    private escapeRegex;
}
/**
 * 创建引用搜索器
 */
export declare function createReferenceSearch(config?: ReferenceSearchConfig): ReferenceSearch;
/**
 * 快速查找引用
 */
export declare function findReferences(index: SymbolIndex, symbol: SymbolDefinition): Promise<ReferenceSearchResult>;
