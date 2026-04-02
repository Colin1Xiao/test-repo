/**
 * Telegram Callback - Telegram 回调处理器
 * 
 * 处理审批回调：
 * - /approve <requestId>
 * - /reject <requestId>
 * - inline button callback
 * 
 * 必须做：
 * - 来源校验
 * - 过期校验
 * - 幂等处理
 */

import { ApprovalBridge } from '../bridge/approval_bridge';
import { ApprovalStore } from '../bridge/approval_store';

/** 配置 */
export interface TelegramCallbackConfig {
  approvalBridge: ApprovalBridge;
  approvalStore: ApprovalStore;
  /** 允许的用户 ID 列表 */
  allowedUsers?: string[];
  /** 允许的命令前缀 */
  commandPrefix?: string;
}

/** 回调结果 */
export interface CallbackResult {
  success: boolean;
  message: string;
  requestId?: string;
  approved?: boolean;
}

/** Telegram 回调处理器 */
export class TelegramCallbackHandler {
  private approvalBridge: ApprovalBridge;
  private approvalStore: ApprovalStore;
  private allowedUsers: string[];
  private commandPrefix: string;

  constructor(config: TelegramCallbackConfig) {
    this.approvalBridge = config.approvalBridge;
    this.approvalStore = config.approvalStore;
    this.allowedUsers = config.allowedUsers ?? [];
    this.commandPrefix = config.commandPrefix ?? '/';
  }

  /**
   * 处理命令消息
   * 
   * 支持：
   * - /approve <requestId>
   * - /reject <requestId>
   * - /approve <requestId> <reason>
   * - /reject <requestId> <reason>
   */
  async handleCommand(
    command: string,
    args: string[],
    fromUser: { id: string; username?: string },
  ): Promise<CallbackResult> {
    // 1. 来源校验
    if (this.allowedUsers.length > 0 && !this.allowedUsers.includes(fromUser.id)) {
      return {
        success: false,
        message: `❌ 未授权：用户 ${fromUser.username ?? fromUser.id} 无权限执行审批`,
      };
    }

    // 2. 解析请求 ID
    const requestId = args[0];
    if (!requestId) {
      return {
        success: false,
        message: `❌ 格式错误：请使用 ${this.commandPrefix}${command} <requestId> [原因]`,
      };
    }

    // 3. 检查请求是否存在
    const request = this.approvalStore.get(requestId);
    if (!request) {
      return {
        success: false,
        message: `❌ 请求不存在：${requestId}`,
      };
    }

    // 4. 过期校验
    if (request.expiresAt && Date.now() > request.expiresAt) {
      // 自动标记为过期
      this.approvalStore.expire(requestId);
      return {
        success: false,
        message: `⏰ 请求已过期：${requestId}\n\n工具：${request.tool}\n摘要：${request.summary}`,
        requestId,
      };
    }

    // 5. 幂等检查（已处理的请求）
    if (request.status !== 'pending') {
      return {
        success: false,
        message: `ℹ️ 请求已处理：${request.status}\n\n工具：${request.tool}\n决策者：${request.decidedBy}`,
        requestId,
        approved: request.status === 'approved',
      };
    }

    // 6. 执行审批
    const reason = args.slice(1).join(' ') || undefined;
    const approved = command.toLowerCase() === 'approve';

    try {
      const decision = await this.approvalBridge.resolve(
        requestId,
        approved,
        fromUser.id,
        reason,
      );

      return {
        success: true,
        message: `✅ 已${approved ? '批准' : '拒绝'}\n\n请求 ID: ${requestId}\n工具：${request.tool}\n决策者：${fromUser.username ?? fromUser.id}${reason ? `\n原因：${reason}` : ''}`,
        requestId,
        approved,
      };
    } catch (error) {
      return {
        success: false,
        message: `❌ 处理失败：${error instanceof Error ? error.message : String(error)}`,
        requestId,
      };
    }
  }

  /**
   * 处理 inline button callback
   * 
   * callbackData 格式：
   * - approve:<requestId>
   * - reject:<requestId>
   */
  async handleCallback(
    callbackData: string,
    fromUser: { id: string; username?: string },
  ): Promise<CallbackResult> {
    // 解析 callback data
    const match = callbackData.match(/^(approve|reject):(.+)$/);
    if (!match) {
      return {
        success: false,
        message: `❌ 无效的回调数据：${callbackData}`,
      };
    }

    const action = match[1].toLowerCase();
    const requestId = match[2];

    // 委托给命令处理器
    return this.handleCommand(action, [requestId], fromUser);
  }

  /**
   * 获取待审批列表（用于 /pending 命令）
   */
  getPending(sessionId?: string): Array<{
    id: string;
    tool: string;
    summary: string;
    risk: string;
    createdAt: string;
    expiresAt?: string;
  }> {
    const pending = this.approvalStore.listPending(sessionId ? { sessionId } : undefined);
    
    return pending.map(p => ({
      id: p.id,
      tool: p.tool,
      summary: p.summary,
      risk: p.risk,
      createdAt: new Date(p.createdAt).toISOString(),
      expiresAt: p.expiresAt ? new Date(p.expiresAt).toISOString() : undefined,
    }));
  }

  /**
   * 添加授权用户
   */
  allowUser(userId: string): void {
    if (!this.allowedUsers.includes(userId)) {
      this.allowedUsers.push(userId);
    }
  }

  /**
   * 移除授权用户
   */
  denyUser(userId: string): void {
    const idx = this.allowedUsers.indexOf(userId);
    if (idx >= 0) {
      this.allowedUsers.splice(idx, 1);
    }
  }
}

/**
 * 创建回调处理器（快速初始化）
 */
export function createTelegramCallbackHandler(options?: {
  allowedUsers?: string[];
}): TelegramCallbackHandler {
  const approvalStore = new ApprovalStore();
  const approvalBridge = new ApprovalBridge({ store: approvalStore });
  
  return new TelegramCallbackHandler({
    approvalBridge,
    approvalStore,
    allowedUsers: options?.allowedUsers,
  });
}
