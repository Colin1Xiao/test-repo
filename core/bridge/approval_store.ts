/**
 * ApprovalStore - 审批请求存储
 * 
 * 管理审批请求的生命周期：
 * - 创建审批请求
 * - 待审批列表
 * - 批准/拒绝回写
 * - 超时失效
 * - task 恢复/终止
 */

import * as fs from 'fs';
import * as path from 'path';

/** 审批请求 */
export interface ApprovalRequest {
  id: string;
  sessionId: string;
  taskId?: string;
  tool: string;
  summary: string;
  risk: 'low' | 'medium' | 'high';
  payload?: Record<string, unknown>;
  createdAt: number;
  expiresAt?: number;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  decidedAt?: number;
  decidedBy?: string;
  reason?: string;
}

/** 审批决策 */
export interface ApprovalDecision {
  requestId: string;
  approved: boolean;
  reason?: string;
  approvedAt: number;
  approvedBy: string;
}

/** 配置 */
export interface ApprovalStoreConfig {
  /** 存储路径，默认 ~/.openclaw/runtime/approvals */
  storePath?: string;
  /** 默认超时时间（毫秒） */
  defaultTimeoutMs?: number;
  /** 自动清理过期请求 */
  autoCleanup?: boolean;
}

/** 审批存储实现 */
export class ApprovalStore {
  private storePath: string;
  private defaultTimeoutMs: number;
  private requests: Map<string, ApprovalRequest> = new Map();

  constructor(config: ApprovalStoreConfig = {}) {
    this.storePath = config.storePath ?? path.join(
      process.env.HOME ?? '~',
      '.openclaw',
      'runtime',
      'approvals',
      'store.json',
    );
    this.defaultTimeoutMs = config.defaultTimeoutMs ?? 300000; // 5 分钟
    
    // 确保目录存在
    const dir = path.dirname(this.storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // 加载持久化数据
    this.load();
    
    // 自动清理过期请求
    if (config.autoCleanup !== false) {
      this.cleanupExpired();
    }
  }

  /**
   * 创建审批请求
   */
  create(request: Omit<ApprovalRequest, 'id' | 'createdAt' | 'status'>): ApprovalRequest {
    const id = `apr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    const fullRequest: ApprovalRequest = {
      ...request,
      id,
      createdAt: Date.now(),
      status: 'pending',
      expiresAt: request.expiresAt ?? Date.now() + this.defaultTimeoutMs,
    };
    
    this.requests.set(id, fullRequest);
    this.persist();
    
    return fullRequest;
  }

  /**
   * 获取审批请求
   */
  get(requestId: string): ApprovalRequest | undefined {
    return this.requests.get(requestId);
  }

  /**
   * 列出待审批请求
   */
  listPending(options?: { sessionId?: string; taskId?: string }): ApprovalRequest[] {
    const results: ApprovalRequest[] = [];
    
    this.requests.forEach(req => {
      if (req.status !== 'pending') return;
      if (req.expiresAt && Date.now() > req.expiresAt) {
        // 已过期
        this.expire(req.id);
        return;
      }
      if (options?.sessionId && req.sessionId !== options.sessionId) return;
      if (options?.taskId && req.taskId !== options.taskId) return;
      
      results.push(req);
    });
    
    return results.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * 批准请求
   */
  approve(requestId: string, approvedBy: string, reason?: string): ApprovalDecision {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`Approval request not found: ${requestId}`);
    }
    
    if (request.status !== 'pending') {
      throw new Error(`Approval request already decided: ${request.status}`);
    }
    
    request.status = 'approved';
    request.decidedAt = Date.now();
    request.decidedBy = approvedBy;
    request.reason = reason;
    
    this.requests.set(requestId, request);
    this.persist();
    
    return {
      requestId,
      approved: true,
      reason,
      approvedAt: request.decidedAt,
      approvedBy,
    };
  }

  /**
   * 拒绝请求
   */
  reject(requestId: string, approvedBy: string, reason?: string): ApprovalDecision {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`Approval request not found: ${requestId}`);
    }
    
    if (request.status !== 'pending') {
      throw new Error(`Approval request already decided: ${request.status}`);
    }
    
    request.status = 'rejected';
    request.decidedAt = Date.now();
    request.decidedBy = approvedBy;
    request.reason = reason;
    
    this.requests.set(requestId, request);
    this.persist();
    
    return {
      requestId,
      approved: false,
      reason,
      approvedAt: request.decidedAt,
      approvedBy,
    };
  }

  /**
   * 过期请求
   */
  expire(requestId: string): void {
    const request = this.requests.get(requestId);
    if (!request) return;
    
    request.status = 'expired';
    this.requests.set(requestId, request);
    this.persist();
  }

  /**
   * 清理过期请求
   */
  cleanupExpired(): number {
    let count = 0;
    const now = Date.now();
    
    this.requests.forEach((req, id) => {
      if (req.status === 'pending' && req.expiresAt && now > req.expiresAt) {
        this.expire(id);
        count++;
      }
    });
    
    return count;
  }

  /**
   * 列出所有请求（支持过滤）
   */
  list(options?: { 
    status?: ApprovalRequest['status'];
    sessionId?: string;
    after?: number;
    before?: number;
  }): ApprovalRequest[] {
    let results = Array.from(this.requests.values());
    
    if (options?.status) {
      results = results.filter(r => r.status === options.status);
    }
    if (options?.sessionId) {
      results = results.filter(r => r.sessionId === options.sessionId);
    }
    if (options?.after) {
      results = results.filter(r => r.createdAt >= options.after!);
    }
    if (options?.before) {
      results = results.filter(r => r.createdAt <= options.before!);
    }
    
    return results.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * 持久化到磁盘
   */
  private persist(): void {
    const data = Array.from(this.requests.values());
    fs.writeFileSync(this.storePath, JSON.stringify(data, null, 2));
  }

  /**
   * 从磁盘加载
   */
  private load(): void {
    if (!fs.existsSync(this.storePath)) {
      return;
    }
    
    try {
      const data = JSON.parse(fs.readFileSync(this.storePath, 'utf-8'));
      data.forEach((req: ApprovalRequest) => {
        this.requests.set(req.id, req);
      });
    } catch (error) {
      console.error('Failed to load approval store:', error);
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    expired: number;
  } {
    const stats = {
      total: this.requests.size,
      pending: 0,
      approved: 0,
      rejected: 0,
      expired: 0,
    };
    
    this.requests.forEach(req => {
      stats[req.status]++;
    });
    
    return stats;
  }

  /**
   * 清空所有请求（用于测试）
   */
  clear(): void {
    this.requests.clear();
    fs.writeFileSync(this.storePath, '[]');
  }
}
