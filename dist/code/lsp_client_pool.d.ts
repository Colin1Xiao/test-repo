/**
 * LSP Client Pool - LSP 客户端池管理
 *
 * 职责：
 * 1. repoRoot + language 级别的 client 复用
 * 2. lazy init
 * 3. health check
 * 4. restart on failure
 * 5. idle cleanup
 * 6. capability cache
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { LspCapability } from './types';
/**
 * LSP 客户端接口
 */
export interface ILspClient {
    /** 启动 */
    start(): Promise<void>;
    /** 停止 */
    stop(): Promise<void>;
    /** 是否运行中 */
    isRunning(): boolean;
    /** 查找定义 */
    findDefinition(filePath: string, position: {
        line: number;
        column: number;
    }): Promise<any[]>;
    /** 查找引用 */
    findReferences(filePath: string, position: {
        line: number;
        column: number;
    }): Promise<any[]>;
    /** 获取文档符号 */
    getDocumentSymbols(filePath: string): Promise<any[]>;
    /** 获取工作区符号 */
    getWorkspaceSymbols(query: string): Promise<any[]>;
    /** 检查能力 */
    hasCapability(capability: LspCapability): boolean;
}
export declare class LspClientPool {
    private clients;
    private capabilityCache;
    private readonly idleTimeoutMs;
    private readonly maxIdleClients;
    private readonly healthCheckIntervalMs;
    private healthCheckTimer?;
    constructor();
    /**
     * 获取或创建客户端
     */
    getOrCreateClient(repoRoot: string, language: string): Promise<ILspClient>;
    /**
     * 检查能力
     */
    hasCapability(repoRoot: string, language: string, capability: LspCapability): boolean;
    /**
     * 停止所有客户端
     */
    stopAll(): Promise<void>;
    /**
     * 获取客户端键
     */
    private getClientKey;
    /**
     * 获取默认命令
     */
    private getDefaultCommand;
    /**
     * 获取默认参数
     */
    private getDefaultArgs;
    /**
     * 启动健康检查
     */
    private startHealthCheck;
    /**
     * 执行健康检查
     */
    private performHealthCheck;
    /**
     * 清理空闲客户端
     */
    private cleanupIdleClients;
}
/**
 * 创建 LSP 客户端池
 */
export declare function createLspClientPool(): LspClientPool;
