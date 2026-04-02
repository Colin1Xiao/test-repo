/**
 * ApprovalBridge - 审批桥接
 * 
 * 把 PermissionEngine 的 "ask" 结果接成真实异步审批闭环：
 * - 创建审批请求
 * - 推送到 Telegram
 * - 等待用户决策
 * - 回写决策到 runtime
 * - 恢复/终止 task
 */

import { ApprovalStore, ApprovalRequest, ApprovalDecision } from './approval_store';
import { TelegramBridge } from './telegram_bridge';
import { HookBus } from '../runtime/hook_bus';
import { TaskStore } from '../runtime/task_store';

/** 配置 */
export interface ApprovalBridgeConfig {
  store?: ApprovalStore;
  telegram?: TelegramBridge;
  hooks?: HookBus;
  tasks?: TaskStore;
  pollIntervalMs?: number;
}

/** 审批桥接实现 */
export class ApprovalBridge {
  private store: ApprovalStore;
  private telegram?: TelegramBridge;
  private hooks?: HookBus;
  private tasks?: TaskStore;
  private pollIntervalMs: number;
  private pendingCallbacks: Map<string, (decision: ApprovalDecision) => void> = new Map();

  constructor(config: ApprovalBridgeConfig = {}) {
    this.store = config.store ?? new ApprovalStore();
    this.telegram = config.telegram;
    this.hooks = config.hooks;
    this.tasks = config.tasks;
    this.pollIntervalMs = config.pollIntervalMs ?? 5000;
  }

  /**
   * 创建审批请求并推送到 Telegram
   * 
   * @returns 审批请求 ID
   */
  async request(request: {
    sessionId: string;
    taskId?: string;
    tool: string;
    summary: string;
    risk: 'low' | 'medium' | 'high';
    payload?: Record<string, unknown>;
  }): Promise<string> {
    // 1. 创建审批请求
    const approvalRequest = this.store.create({
      sessionId: request.sessionId,
      taskId: request.taskId,
      tool: request.tool,
      summary: request.summary,
      risk: request.risk,
      payload: request.payload,
    });
    
    // 2. 发送 hook
    if (this.hooks) {
      await this.hooks.emit({
        type: 'approval.requested',
        requestId: approvalRequest.id,
        sessionId: request.sessionId,
        taskId: request.taskId,
        tool: request.tool,
        summary: request.summary,
        risk: request.risk,
        timestamp: Date.now(),
      });
    }
    
    // 3. 推送到 Telegram
    if (this.telegram) {
      await this.telegram.sendApprovalRequest(approvalRequest);
    }
    
    // 4. 更新 task 状态为 waiting_approval
    if (request.taskId && this.tasks) {
      this.tasks.update(request.taskId, { status: 'waiting_approval' });
    }
    
    return approvalRequest.id;
  }

  /**
   * 等待审批决策（Promise 方式）
   * 
   * @param requestId 审批请求 ID
   * @param timeoutMs 超时时间
   * @returns 审批决策
   */
  async waitForDecision(requestId: string, timeoutMs?: number): Promise<ApprovalDecision> {
    const request = this.store.get(requestId);
    if (!request) {
      throw new Error(`Approval request not found: ${requestId}`);
    }
    
    // 如果已经有决策，直接返回
    if (request.status !== 'pending') {
      return {
        requestId,
        approved: request.status === 'approved',
        reason: request.reason,
        approvedAt: request.decidedAt ?? 0,
        approvedBy: request.decidedBy ?? 'system',
      };
    }
    
    // 等待决策
    return new Promise((resolve, reject) => {
      const timeout = timeoutMs ?? (request.expiresAt! - Date.now());
      
      // 设置超时
      const timer = setTimeout(() => {
        this.pendingCallbacks.delete(requestId);
        reject(new Error('Approval timeout'));
      }, timeout);
      
      // 注册回调
      this.pendingCallbacks.set(requestId, (decision) => {
        clearTimeout(timer);
        this.pendingCallbacks.delete(requestId);
        resolve(decision);
      });
    });
  }

  /**
   * 处理审批决策（从 Telegram 回调）
   * 
   * @param requestId 审批请求 ID
   * @param approved 是否批准
   * @param approvedBy 决策者
   * @param reason 原因
   */
  async resolve(requestId: string, approved: boolean, approvedBy: string, reason?: string): Promise<ApprovalDecision> {
    const request = this.store.get(requestId);
    if (!request) {
      throw new Error(`Approval request not found: ${requestId}`);
    }
    
    // 1. 更新审批状态
    const decision = approved
      ? this.store.approve(requestId, approvedBy, reason)
      : this.store.reject(requestId, approvedBy, reason);
    
    // 2. 发送 hook
    if (this.hooks) {
      await this.hooks.emit({
        type: 'approval.resolved',
        requestId,
        sessionId: request.sessionId,
        taskId: request.taskId,
        approved,
        reason,
        approvedBy,
        timestamp: Date.now(),
      });
    }
    
    // 3. 更新 task 状态
    if (request.taskId && this.tasks) {
      if (approved) {
        this.tasks.update(request.taskId, { status: 'running' });
      } else {
        this.tasks.update(request.taskId, { 
          status: 'cancelled',
          error: `Approval rejected: ${reason ?? 'No reason provided'}`,
        });
      }
    }
    
    // 4. 通知等待的回调
    const callback = this.pendingCallbacks.get(requestId);
    if (callback) {
      callback(decision);
    }
    
    // 5. 更新 Telegram 消息
    if (this.telegram) {
      await this.telegram.updateApprovalStatus(requestId, approved, reason);
    }
    
    return decision;
  }

  /**
   * 获取待审批列表
   */
  getPending(sessionId?: string): ApprovalRequest[] {
    return this.store.listPending(sessionId ? { sessionId } : undefined);
  }

  /**
   * 获取审批请求详情
   */
  get(requestId: string): ApprovalRequest | undefined {
    return this.store.get(requestId);
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return this.store.getStats();
  }

  /**
   * 清理过期请求
   */
  cleanupExpired(): number {
    return this.store.cleanupExpired();
  }
}
