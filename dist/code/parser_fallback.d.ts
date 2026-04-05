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
import type { SymbolDefinition, SymbolReference, FallbackResult } from './types';
/**
 * Parser 配置
 */
export interface ParserFallbackConfig {
    /** 包含的语言 */
    languages?: string[];
    /** 超时时间（毫秒） */
    timeoutMs?: number;
}
/**
 * 解析结果
 */
interface ParseResult {
    symbols: SymbolDefinition[];
    references: SymbolReference[];
}
export declare class ParserFallback {
    private config;
    constructor(config?: ParserFallbackConfig);
    /**
     * 查找定义（降级方案）
     */
    findDefinition(symbolName: string, filePath: string, repoRoot: string): Promise<FallbackResult<SymbolDefinition>>;
    /**
     * 查找引用（降级方案）
     */
    findReferences(symbol: SymbolDefinition, repoRoot: string): Promise<FallbackResult<SymbolReference[]>>;
    /**
     * 解析符号（Parser 层）
     */
    parseSymbols(filePath: string): Promise<ParseResult>;
    /**
     * Parser 层查找定义
     */
    private findDefinitionByParser;
    /**
     * Static Scan 查找定义
     */
    private findDefinitionByStaticScan;
    /**
     * Grep 查找定义
     */
    private findDefinitionByGrep;
    /**
     * Parser 层查找引用
     */
    private findReferencesByParser;
    /**
     * Static Scan 查找引用
     */
    private findReferencesByStaticScan;
    /**
     * Grep 查找引用
     */
    private findReferencesByGrep;
    /**
     * 扫描文件
     */
    private scanFiles;
    /**
     * 检测符号类型
     */
    private detectSymbolKind;
    /**
     * 检查是否导出
     */
    private isExported;
    /**
     * 获取语言
     */
    private getLanguage;
    /**
     * 获取上下文
     */
    private getContext;
}
/**
 * 创建 Parser 降级器
 */
export declare function createParserFallback(config?: ParserFallbackConfig): ParserFallback;
export {};
