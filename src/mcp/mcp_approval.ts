/**
 * MCP Approval - MCP 审批流程
 * 
 * 职责：
 * 1. 创建 MCP 审批请求
 * 2. pending server / tool / resource 语义
 * 3. 复用现有 ApprovalBridge / TaskStore / HookBus
 * 4. 审批后回填结果并继续或拒绝执行
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type {
  McpApprovalRequest,
  McpApprovalResult,
  McpPolicyScope,
  McpPolicyAction,
} from './types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 审批处理器接口
 */
export interface IApprovalHandler {
  /**
   * 创建审批请求
   */
  createRequest(request: McpApprovalRequest): Promise<void>;
  
  /**
   * 等待审批结果
   */
  waitForResult(requestId: string, timeoutMs: number): Promise<McpApprovalResult>;
  
  /**
   * 更新审批状态
   */
  updateStatus(requestId: string, status: 'pending' | 'approved' | 'rejected'): Promise<void>;
}

/**
 * 审批配置
 */
export interface McpApprovalConfig {
  /** 默认超时（毫秒） */
  defaultTimeoutMs?: number;
  
  /** 自动清理已完成的审批 */
  autoCleanup?: boolean;
  
  /** 清理间隔（毫秒） */
  cleanupIntervalMs?: number;
}

// ============================================================================
// MCP 审批管理器
// ============================================================================

export class McpApprovalManager {
  private config: Required<McpApprovalConfig>;
  private approvalHandler?: IApprovalHandler;
  
  // 审批请求存储
  private requests: Map<string, McpApprovalRequest> = new Map();
  
  // 审批结果存储
  private results: Map<string, McpApprovalResult> = new Map();
  
  // 等待中的审批
  private waitingCallbacks: Map<string, Array<(result: McpApprovalResult) => void>> = new Map();
  
  constructor(approvalHandler?: IApprovalHandler, config: McpApprovalConfig = {}) {
    this.approvalHandler = approvalHandler;
    this.config = {
      defaultTimeoutMs: config.defaultTimeoutMs ?? 300000, // 5 分钟
      autoCleanup: config.autoCleanup ?? true,
      cleanupIntervalMs: config.cleanupIntervalMs ?? 60000, // 1 分钟
    };
    
    // 启动自动清理
    if (this.config.autoCleanup) {
      this.startCleanup();
    }
  }
  
  /**
   * 创建审批请求
   */
  async createRequest(request: McpApprovalRequest): Promise<void> {
    // 存储请求
    this.requests.set(request.requestId, request);
    
    // 调用外部处理器
    if (this.approvalHandler) {
      await this.approvalHandler.createRequest(request);
    }
    
    // 触发 Hook（简化实现）
    this.emitHook('McpApprovalRequested', request);
  }
  
  /**
   * 等待审批结果
   */
  async waitForApproval(
    requestId: string,
    timeoutMs?: number
  ): Promise<McpApprovalResult> {
    const timeout = timeoutMs ?? this.config.defaultTimeoutMs;
    
    // 检查是否已有结果
    const existingResult = this.results.get(requestId);
    if (existingResult) {
      return existingResult;
    }
    
    // 检查请求是否存在
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`Approval request not found: ${requestId}`);
    }
    
    // 等待结果
    return new Promise((resolve, reject) => {
      const callbacks = this.waitingCallbacks.get(requestId) || [];
      callbacks.push(resolve);
      this.waitingCallbacks.set(requestId, callbacks);
      
      // 设置超时
      setTimeout(() => {
        const result = this.results.get(requestId);
        if (result) {
          resolve(result);
        } else {
          reject(new Error(`Approval timeout after ${timeout}ms`));
        }
      }, timeout);
    });
  }
  
  /**
   * 处理审批结果
   */
  async handleApprovalResult(
    requestId: string,
    result: McpApprovalResult
  ): Promise<void> {
    // 存储结果
    this.results.set(requestId, result);
    
    // 更新请求状态
    const request = this.requests.get(requestId);
    if (request) {
      request.status = result.approved ? 'approved' : 'rejected';
      request.resolvedAt = Date.now();
      request.resolvedBy = result.approvedBy;
      request.resolvedReason = result.reason;
      
      // 调用外部处理器
      if (this.approvalHandler) {
        await this.approvalHandler.updateStatus(
          requestId,
          request.status
        );
      }
      
      // 触发 Hook
      this.emitHook('McpApprovalResolved', { request, result });
      
      // 通知等待者
      const callbacks = this.waitingCallbacks.get(requestId);
      if (callbacks) {
        for (const callback of callbacks) {
          callback(result);
        }
        this.waitingCallbacks.delete(requestId);
      }
    }
  }
  
  /**
   * 获取审批请求
   */
  getRequest(requestId: string): McpApprovalRequest | null {
    return this.requests.get(requestId) || null;
  }
  
  /**
   * 获取待审批列表
   */
  getPendingRequests(): McpApprovalRequest[] {
    return Array.from(this.requests.values())
      .filter(r => r.status === 'pending');
  }
  
  /**
   * 按 Server 获取待审批列表
   */
  getPendingRequestsByServer(serverId: string): McpApprovalRequest[] {
    return this.getPendingRequests()
      .filter(r => r.serverId === serverId);
  }
  
  /**
   * 按 Agent 获取待审批列表
   */
  getPendingRequestsByAgent(agentId: string): McpApprovalRequest[] {
    return this.getPendingRequests()
      .filter(r => r.agentId === agentId);
  }
  
  /**
   * 清理已完成的审批
   */
  cleanupCompletedRequests(maxAgeMs: number = 3600000): number {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [requestId, request] of this.requests.entries()) {
      if (request.status !== 'pending' && request.resolvedAt) {
        const age = now - request.resolvedAt;
        if (age > maxAgeMs) {
          this.requests.delete(requestId);
          this.results.delete(requestId);
          this.waitingCallbacks.delete(requestId);
          cleaned++;
        }
      }
    }
    
    return cleaned;
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 启动自动清理
   */
  private startCleanup(): void {
    setInterval(() => {
      this.cleanupCompletedRequests();
    }, this.config.cleanupIntervalMs);
  }
  
  /**
   * 触发 Hook
   */
  private emitHook(event: string, data: unknown): void {
    // 简化实现：实际应该对接 HookBus
    console.log(`[MCP Hook] ${event}:`, data);
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建审批管理器
 */
export function createMcpApprovalManager(
  approvalHandler?: IApprovalHandler,
  config?: McpApprovalConfig
): McpApprovalManager {
  return new McpApprovalManager(approvalHandler, config);
}

/**
 * 快速创建审批请求并等待结果
 */
export async function requestMcpApproval(
  manager: McpApprovalManager,
  request: McpApprovalRequest,
  timeoutMs?: number
): Promise<McpApprovalResult> {
  await manager.createRequest(request);
  return await manager.waitForApproval(request.requestId, timeoutMs);
}
