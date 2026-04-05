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
import type { SymbolIndex } from './types';
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
export declare class SymbolIndexer {
    private config;
    constructor(config?: SymbolIndexerConfig);
    /**
     * 构建符号索引
     */
    buildIndex(repoRoot: string): Promise<SymbolIndex>;
    /**
     * 扫描文件
     */
    private scanFiles;
    /**
     * 提取符号
     */
    private extractSymbols;
    /**
     * 提取 TypeScript 符号
     */
    private extractTypeScriptSymbols;
    /**
     * 提取 JavaScript 符号
     */
    private extractJavaScriptSymbols;
    /**
     * 提取 Python 符号
     */
    private extractPythonSymbols;
    /**
     * 添加符号到索引
     */
    private addSymbolToIndex;
    /**
     * 计算统计
     */
    private calculateStats;
    /**
     * 创建符号
     */
    private createSymbol;
    /**
     * 提取函数签名
     */
    private extractFunctionSignature;
    /**
     * 提取类签名
     */
    private extractClassSignature;
    /**
     * 提取变量签名
     */
    private extractVariableSignature;
    /**
     * 检查是否支持的语言
     */
    private isSupportedLanguage;
    /**
     * 检查是否应该排除
     */
    private shouldExclude;
    /**
     * 遍历目录
     */
    private walkDirectory;
}
/**
 * 创建符号索引器
 */
export declare function createSymbolIndexer(config?: SymbolIndexerConfig): SymbolIndexer;
/**
 * 快速构建符号索引
 */
export declare function buildSymbolIndex(repoRoot: string): Promise<SymbolIndex>;
