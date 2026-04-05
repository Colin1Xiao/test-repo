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
import type { SymbolDefinition, SymbolReference, LspQueryResult, LspCapability } from './types';
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
export declare class LspBridge {
    private config;
    private clientPool;
    private parserFallback;
    constructor(config?: LspBridgeConfig);
    /**
     * 检查 LSP 是否可用
     */
    isLspAvailable(repoRoot: string, language: string): Promise<boolean>;
    /**
     * 获取定义
     */
    getDefinitions(filePath: string, position: Position, repoRoot: string): Promise<LspQueryResult<SymbolDefinition[]>>;
    /**
     * 获取引用
     */
    getReferences(filePath: string, position: Position, repoRoot: string, symbolName?: string): Promise<LspQueryResult<SymbolReference[]>>;
    /**
     * 获取文档符号
     */
    getDocumentSymbols(filePath: string, repoRoot: string): Promise<LspQueryResult<SymbolDefinition[]>>;
    /**
     * 获取工作区符号
     */
    getWorkspaceSymbols(query: string, repoRoot: string): Promise<LspQueryResult<SymbolDefinition[]>>;
    /**
     * 检查能力
     */
    hasCapability(repoRoot: string, language: string, capability: LspCapability): boolean;
    /**
     * 停止所有客户端
     */
    stopAll(): Promise<void>;
    /**
     * 转换 LSP 定义为内部类型
     */
    private convertLspDefinitions;
    /**
     * 转换 LSP 引用为内部类型
     */
    private convertLspReferences;
    /**
     * 转换 LSP 符号为内部类型
     */
    private convertLspSymbols;
    /**
     * 映射 LSP 符号类型
     */
    private mapLspSymbolKind;
    /**
     * URI 转路径
     */
    private uriToPath;
    /**
     * 获取语言
     */
    private getLanguage;
    /**
     * 超时 Promise
     */
    private timeoutPromise;
}
/**
 * 创建 LSP Bridge
 */
export declare function createLspBridge(config?: LspBridgeConfig): LspBridge;
export {};
