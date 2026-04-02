/**
 * TelegramBridge - Telegram 审批推送
 * 
 * 发送审批请求到 Telegram，处理用户批准/拒绝回调。
 * 最小必要功能：
 * - 发送审批消息（工具名/风险级别/摘要/task id）
 * - 批准/拒绝按钮
 * - 更新审批状态
 */

import { ApprovalRequest } from './approval_store';

/** Telegram 消息接口 */
export interface TelegramMessage {
  chatId: string;
  text: string;
  replyMarkup?: {
    inlineKeyboard: Array<Array<{
      text: string;
      callbackData: string;
    }>>;
  };
}

/** 配置 */
export interface TelegramBridgeConfig {
  /** Bot Token */
  botToken?: string;
  /** 默认聊天 ID */
  defaultChatId?: string;
  /** API 基础 URL */
  apiUrl?: string;
}

/** Telegram 桥接实现 */
export class TelegramBridge {
  private botToken?: string;
  private defaultChatId?: string;
  private apiUrl: string;

  constructor(config: TelegramBridgeConfig = {}) {
    this.botToken = config.botToken;
    this.defaultChatId = config.defaultChatId;
    this.apiUrl = config.apiUrl ?? 'https://api.telegram.org';
  }

  /**
   * 发送审批请求到 Telegram
   * 
   * 格式：
   * 🔐 审批请求
   * 
   * 工具：exec.run
   * 风险：🔴 High
   * 摘要：Run shell command
   * Task: x_123456
   * 
   * [批准] [拒绝]
   */
  async sendApprovalRequest(request: ApprovalRequest): Promise<void> {
    const riskEmoji = {
      low: '🟢',
      medium: '🟡',
      high: '🔴',
    }[request.risk];
    
    const text = [
      `🔐 *审批请求*`,
      '',
      `工具：\`${request.tool}\``,
      `风险：${riskEmoji} ${request.risk.toUpperCase()}`,
      `摘要：${request.summary}`,
      request.taskId ? `Task: \`${request.taskId}\`` : '',
      '',
      `⏰ 超时：${this.formatTimeout(request.expiresAt)}`,
    ].join('\n');
    
    const replyMarkup = {
      inlineKeyboard: [
        [
          {
            text: '✅ 批准',
            callbackData: `approve:${request.id}`,
          },
          {
            text: '❌ 拒绝',
            callbackData: `reject:${request.id}`,
          },
        ],
      ],
    };
    
    await this.sendMessage(text, replyMarkup);
  }

  /**
   * 更新审批状态
   */
  async updateApprovalStatus(
    requestId: string,
    approved: boolean,
    reason?: string,
  ): Promise<void> {
    const statusText = approved ? '✅ 已批准' : '❌ 已拒绝';
    const statusEmoji = approved ? '✅' : '❌';
    
    const text = [
      `${statusEmoji} *审批${statusText}*`,
      '',
      `请求 ID: \`${requestId}\``,
      reason ? `原因：${reason}` : '',
    ].join('\n');
    
    // 编辑原消息（需要 message_id，这里简化为发送新消息）
    await this.sendMessage(text);
  }

  /**
   * 发送普通消息
   */
  async sendMessage(
    text: string,
    replyMarkup?: TelegramMessage['replyMarkup'],
    chatId?: string,
  ): Promise<void> {
    const targetChatId = chatId ?? this.defaultChatId;
    
    if (!targetChatId) {
      console.warn('TelegramBridge: No chat ID configured, skipping message');
      return;
    }
    
    if (!this.botToken) {
      console.warn('TelegramBridge: No bot token configured, skipping message');
      return;
    }
    
    const url = `${this.apiUrl}/bot${this.botToken}/sendMessage`;
    
    const body: any = {
      chat_id: targetChatId,
      text,
      parse_mode: 'Markdown',
    };
    
    if (replyMarkup) {
      body.reply_markup = JSON.stringify(replyMarkup);
    }
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      if (!result.ok) {
        throw new Error(`Telegram error: ${result.description}`);
      }
    } catch (error) {
      console.error('TelegramBridge: Failed to send message:', error);
      // 不抛出异常，避免阻塞主流程
    }
  }

  /**
   * 处理回调（从 webhook 或轮询）
   * 
   * @param callbackData 回调数据（如 "approve:apr_123_abc"）
   * @param fromUser 用户信息
   * @returns 解析结果
   */
  parseCallback(callbackData: string, fromUser?: any): {
    action: 'approve' | 'reject';
    requestId: string;
    userId: string;
  } | null {
    const match = callbackData.match(/^(approve|reject):(.+)$/);
    if (!match) {
      return null;
    }
    
    return {
      action: match[1] as 'approve' | 'reject',
      requestId: match[2],
      userId: fromUser?.id?.toString() ?? 'unknown',
    };
  }

  /**
   * 格式化超时时间
   */
  private formatTimeout(expiresAt?: number): string {
    if (!expiresAt) return '未知';
    
    const ms = expiresAt - Date.now();
    if (ms <= 0) return '已过期';
    
    const minutes = Math.floor(ms / 60000);
    if (minutes < 1) return '< 1 分钟';
    if (minutes < 60) return `${minutes} 分钟`;
    
    const hours = Math.floor(minutes / 60);
    return `${hours} 小时`;
  }

  /**
   * 发送任务状态更新
   */
  async sendTaskStatus(
    taskId: string,
    status: string,
    description?: string,
  ): Promise<void> {
    const statusEmoji: Record<string, string> = {
      created: '🆕',
      queued: '⏳',
      running: '⚙️',
      waiting_approval: '🔐',
      waiting_input: '💬',
      completed: '✅',
      failed: '❌',
      cancelled: '🚫',
    };
    
    const text = [
      `${statusEmoji[status] ?? '📋'} *任务状态更新*`,
      '',
      `Task: \`${taskId}\``,
      `状态：${status}`,
      description ? `描述：${description}` : '',
    ].join('\n');
    
    await this.sendMessage(text);
  }

  /**
   * 发送任务输出（最后 N 行）
   */
  async sendTaskOutput(
    taskId: string,
    output: string,
    lines?: number,
  ): Promise<void> {
    const preview = output.split('\n').slice(-lines ?? 20).join('\n');
    
    const text = [
      `📋 *任务输出*`,
      '',
      `Task: \`${taskId}\``,
      '```',
      preview,
      '```',
    ].join('\n');
    
    // 如果太长，分多条消息
    if (text.length > 4096) {
      await this.sendMessage(text.substring(0, 4000) + '\n\n... (truncated)');
    } else {
      await this.sendMessage(text);
    }
  }
}
