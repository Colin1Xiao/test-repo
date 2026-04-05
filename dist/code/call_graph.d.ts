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
import type { SymbolDefinition, SymbolIndex } from './types';
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
export declare class CallGraphBuilder {
    private index?;
    private referenceSearch;
    constructor();
    /**
     * 设置索引
     */
    setIndex(index: SymbolIndex): void;
    /**
     * 构建调用图
     */
    build(symbol?: SymbolDefinition): Promise<CallGraphSummary>;
    /**
     * 构建文件依赖关系
     */
    buildFileDependencies(): Promise<FileRelation[]>;
    /**
     * 查找被调用者
     */
    private findCallees;
    /**
     * 提取调用者
     */
    private extractCallers;
    /**
     * 解析导入路径
     */
    private resolveImportPath;
    /**
     * 提取导入的符号
     */
    private extractImportedSymbols;
    /**
     * 读取文件
     */
    private readFile;
}
/**
 * 创建调用图构建器
 */
export declare function createCallGraphBuilder(): CallGraphBuilder;
/**
 * 快速构建调用图
 */
export declare function buildCallGraph(index: SymbolIndex, symbol?: SymbolDefinition): Promise<CallGraphSummary>;
