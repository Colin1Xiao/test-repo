/**
 * ApprovalNotifyHandler - 审批通知处理器
 * 
 * 监听审批事件，推送 Telegram 通知。
 * 自动更新审批状态。
 */

import { HookBus } from '../runtime/hook_bus';
import { TelegramBridge } from '../bridge/telegram_bridge';
import { ApprovalBridge } from '../bridge/approval_bridge';

/** 配置 */
export interface ApprovalNotifyHandlerConfig {
  telegram?: TelegramBridge;
  approvalBridge?: ApprovalBridge;
  /** 是否通知 resolved 事件 */
  notifyResolved?: boolean;
}

/** 审批通知处理器实现 */
export class ApprovalNotifyHandler {
  private telegram?: TelegramBridge;
  private approvalBridge?: ApprovalBridge;
  private notifyResolved: boolean;

  constructor(hookBus: HookBus, config: ApprovalNotifyHandlerConfig = {}) {
    this.telegram = config.telegram;
    this.approvalBridge = config.approvalBridge;
    this.notifyResolved = config.notifyResolved ?? true;
    
    this.register(hookBus);
  }

  /**
   * 注册钩子处理器
   */
  private register(hookBus: HookBus): void {
    // approval.requested - 审批请求
    hookBus.on('approval.requested', async (event) => {
      // ApprovalBridge 已经处理了推送，这里可以发送额外通知
      console.log(`[ApprovalNotify] Request: ${event.requestId} for ${event.tool}`);
    });

    // approval.resolved - 审批解决
    if (this.notifyResolved) {
      hookBus.on('approval.resolved', async (event) => {
        await this.handleResolved(event);
      });
    }
  }

  /**
   * 处理审批解决事件
   */
  private async handleResolved(event: any): Promise<void> {
    const statusEmoji = event.approved ? '✅' : '❌';
    const statusText = event.approved ? '已批准' : '已拒绝';
    
    console.log(
      `[ApprovalNotify] Resolved: ${event.requestId} - ${statusText} by ${event.approvedBy}`,
    );
    
    // 如果配置了 Telegram，发送通知
    if (this.telegram) {
      await this.telegram.sendMessage(
        `${statusEmoji} *审批${statusText}*\n\n` +
        `请求 ID: \`${event.requestId}\`\n` +
        `工具：待获取\n` +
        `决策者：${event.approvedBy}\n` +
        (event.reason ? `原因：${event.reason}` : ''),
      );
    }
  }
}
