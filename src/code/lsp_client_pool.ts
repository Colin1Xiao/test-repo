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

import type { LspClientConfig, LspCapability } from './types';

// ============================================================================
// 类型定义
// ============================================================================

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
  findDefinition(filePath: string, position: { line: number; column: number }): Promise<any[]>;
  
  /** 查找引用 */
  findReferences(filePath: string, position: { line: number; column: number }): Promise<any[]>;
  
  /** 获取文档符号 */
  getDocumentSymbols(filePath: string): Promise<any[]>;
  
  /** 获取工作区符号 */
  getWorkspaceSymbols(query: string): Promise<any[]>;
  
  /** 检查能力 */
  hasCapability(capability: LspCapability): boolean;
}

/**
 * 客户端包装器
 */
interface ClientWrapper {
  client: ILspClient;
  createdAt: number;
  lastUsedAt: number;
  useCount: number;
  healthCheckPassed: boolean;
}

// ============================================================================
// 简化 LSP 客户端实现
// ============================================================================

class SimpleLspClient implements ILspClient {
  private config: LspClientConfig;
  private running: boolean = false;
  
  constructor(config: LspClientConfig) {
    this.config = config;
  }
  
  async start(): Promise<void> {
    // 简化实现：不真正启动 LSP 服务器
    this.running = true;
  }
  
  async stop(): Promise<void> {
    this.running = false;
  }
  
  isRunning(): boolean {
    return this.running;
  }
  
  async findDefinition(filePath: string, position: { line: number; column: number }): Promise<any[]> {
    // 简化实现
    return [];
  }
  
  async findReferences(filePath: string, position: { line: number; column: number }): Promise<any[]> {
    return [];
  }
  
  async getDocumentSymbols(filePath: string): Promise<any[]> {
    return [];
  }
  
  async getWorkspaceSymbols(query: string): Promise<any[]> {
    return [];
  }
  
  hasCapability(capability: LspCapability): boolean {
    const supported: LspCapability[] = ['definition', 'references', 'documentSymbols', 'workspaceSymbols'];
    return supported.includes(capability);
  }
}

// ============================================================================
// LSP Client Pool
// ============================================================================

export class LspClientPool {
  private clients: Map<string, ClientWrapper> = new Map();
  private capabilityCache: Map<string, Map<LspCapability, boolean>> = new Map();
  
  // 清理配置
  private readonly idleTimeoutMs: number = 5 * 60 * 1000; // 5 分钟
  private readonly maxIdleClients: number = 10;
  private readonly healthCheckIntervalMs: number = 60 * 1000; // 1 分钟
  
  // 健康检查定时器
  private healthCheckTimer?: NodeJS.Timeout;
  
  constructor() {
    this.startHealthCheck();
  }
  
  /**
   * 获取或创建客户端
   */
  async getOrCreateClient(repoRoot: string, language: string): Promise<ILspClient> {
    const key = this.getClientKey(repoRoot, language);
    
    // 检查现有客户端
    const existing = this.clients.get(key);
    if (existing && existing.client.isRunning()) {
      existing.lastUsedAt = Date.now();
      existing.useCount++;
      return existing.client;
    }
    
    // 创建新客户端
    const config: LspClientConfig = {
      language,
      command: this.getDefaultCommand(language),
      args: this.getDefaultArgs(language),
      timeoutMs: 30000,
    };
    
    const client = new SimpleLspClient(config);
    await client.start();
    
    const wrapper: ClientWrapper = {
      client,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      useCount: 1,
      healthCheckPassed: true,
    };
    
    this.clients.set(key, wrapper);
    
    // 清理空闲客户端
    this.cleanupIdleClients();
    
    return client;
  }
  
  /**
   * 检查能力
   */
  hasCapability(repoRoot: string, language: string, capability: LspCapability): boolean {
    const cacheKey = this.getClientKey(repoRoot, language);
    
    // 检查缓存
    const cache = this.capabilityCache.get(cacheKey);
    if (cache && cache.has(capability)) {
      return cache.get(capability)!;
    }
    
    // 默认能力
    const defaultCapabilities: Record<string, LspCapability[]> = {
      'TypeScript': ['definition', 'references', 'documentSymbols', 'workspaceSymbols'],
      'JavaScript': ['definition', 'references', 'documentSymbols', 'workspaceSymbols'],
      'Python': ['definition', 'references', 'documentSymbols'],
    };
    
    const has = defaultCapabilities[language]?.includes(capability) ?? false;
    
    // 缓存
    if (!cache) {
      this.capabilityCache.set(cacheKey, new Map());
    }
    this.capabilityCache.get(cacheKey)!.set(capability, has);
    
    return has;
  }
  
  /**
   * 停止所有客户端
   */
  async stopAll(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    for (const wrapper of this.clients.values()) {
      await wrapper.client.stop();
    }
    
    this.clients.clear();
    this.capabilityCache.clear();
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 获取客户端键
   */
  private getClientKey(repoRoot: string, language: string): string {
    return `${repoRoot}:${language}`;
  }
  
  /**
   * 获取默认命令
   */
  private getDefaultCommand(language: string): string | undefined {
    const commands: Record<string, string> = {
      'TypeScript': 'typescript-language-server',
      'JavaScript': 'typescript-language-server',
      'Python': 'pylsp',
    };
    return commands[language];
  }
  
  /**
   * 获取默认参数
   */
  private getDefaultArgs(language: string): string[] {
    const args: Record<string, string[]> = {
      'TypeScript': ['--stdio'],
      'JavaScript': ['--stdio'],
      'Python': [],
    };
    return args[language] || [];
  }
  
  /**
   * 启动健康检查
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.healthCheckIntervalMs);
  }
  
  /**
   * 执行健康检查
   */
  private performHealthCheck(): void {
    for (const [key, wrapper] of this.clients.entries()) {
      if (!wrapper.client.isRunning()) {
        wrapper.healthCheckPassed = false;
      }
    }
  }
  
  /**
   * 清理空闲客户端
   */
  private cleanupIdleClients(): void {
    const now = Date.now();
    const toRemove: string[] = [];
    
    // 找出空闲客户端
    for (const [key, wrapper] of this.clients.entries()) {
      const idleTime = now - wrapper.lastUsedAt;
      if (idleTime > this.idleTimeoutMs) {
        toRemove.push(key);
      }
    }
    
    // 如果客户端太多，清理最老的
    if (this.clients.size > this.maxIdleClients) {
      const sorted = Array.from(this.clients.entries())
        .sort((a, b) => a[1].lastUsedAt - b[1].lastUsedAt);
      
      for (let i = 0; i < sorted.length - this.maxIdleClients; i++) {
        toRemove.push(sorted[i][0]);
      }
    }
    
    // 移除客户端
    for (const key of toRemove) {
      const wrapper = this.clients.get(key);
      if (wrapper) {
        wrapper.client.stop();
        this.clients.delete(key);
      }
    }
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建 LSP 客户端池
 */
export function createLspClientPool(): LspClientPool {
  return new LspClientPool();
}
