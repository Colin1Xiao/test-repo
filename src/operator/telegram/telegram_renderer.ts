/**
 * Telegram Renderer
 * Phase 2A-1 - Telegram 响应渲染层
 * 
 * 职责：
 * - 将 OperatorViewPayload 渲染为 Telegram 响应（文本 + Inline Keyboard）
 * - 将 OperatorCommandResult 渲染为 Telegram 响应
 */

import type {
  OperatorCommandResult,
  OperatorViewPayload,
  OperatorViewAction,
} from "../types/surface_types";

export interface TelegramInlineButton {
  text: string;
  callbackData: string;
}

export interface TelegramResponse {
  text: string;
  buttons?: TelegramInlineButton[][];
}

export interface TelegramRenderer {
  /**
   * 渲染视图为 Telegram 响应
   * @param payload - 视图数据
   * @returns Telegram 响应（文本 + 按钮）
   */
  renderView(payload: OperatorViewPayload): TelegramResponse;

  /**
   * 渲染命令执行结果为 Telegram 响应
   * @param result - 命令执行结果
   * @returns Telegram 响应
   */
  renderResult(result: OperatorCommandResult): TelegramResponse;
}

// ============================================================================
// Callback 数据生成
// ============================================================================

function buildCallbackData(
  actionType: string,
  targetType: string | undefined,
  targetId: string | undefined
): string {
  const tt = targetType || "unknown";
  const tid = targetId || "none";
  return `oc:${actionType}:${tt}:${tid}`;
}

// ============================================================================
// 默认实现
// ============================================================================

export class DefaultTelegramRenderer implements TelegramRenderer {
  renderView(payload: OperatorViewPayload): TelegramResponse {
    const lines: string[] = [];

    // 标题
    lines.push(`*${payload.title}*`);
    if (payload.subtitle) {
      lines.push(`_${payload.subtitle}_`);
    }
    lines.push("");

    // 摘要
    if (payload.summary) {
      lines.push(payload.summary);
      lines.push("");
    }

    // 内容渲染
    const contentLines = this.renderContent(payload.content);
    lines.push(...contentLines);
    lines.push("");

    // 新鲜度
    if (payload.freshnessMs !== undefined) {
      lines.push(`_数据更新：${this.formatFreshness(payload.freshnessMs)}_`);
    }

    // 构建按钮
    const buttons = this.buildButtons(payload.availableActions, payload.workspaceId);

    return {
      text: lines.join("\n"),
      buttons,
    };
  }

  renderResult(result: OperatorCommandResult): TelegramResponse {
    const lines: string[] = [];

    // 执行状态
    if (result.success) {
      lines.push("✅ *执行成功*");
    } else {
      lines.push("❌ *执行失败*");
    }
    lines.push("");

    // 消息
    if (result.message) {
      lines.push(result.message);
      lines.push("");
    }

    // 动作结果
    if (result.actionResult) {
      const ar = result.actionResult;
      lines.push("*执行结果:*");
      lines.push(`动作：\`${ar.actionType}\``);
      if (ar.targetType && ar.targetId) {
        lines.push(`目标：\`${ar.targetType}/${ar.targetId}\``);
      }
      lines.push("");
    }

    // 更新后的视图
    if (result.updatedView) {
      const viewResponse = this.renderView(result.updatedView);
      lines.push(viewResponse.text);

      return {
        text: lines.join("\n"),
        buttons: viewResponse.buttons,
      };
    }

    // 错误信息
    if (result.errors && result.errors.length > 0) {
      lines.push("*错误:*");
      result.errors.forEach((err) => {
        lines.push(`• [${err.code}] ${err.message}`);
      });
    }

    return {
      text: lines.join("\n"),
    };
  }

  // ============================================================================
  // 辅助方法
  // ============================================================================

  private renderContent(content: unknown): string[] {
    const lines: string[] = [];

    if (typeof content === "string") {
      lines.push(content);
    } else if (Array.isArray(content)) {
      content.forEach((item, idx) => {
        if (typeof item === "object" && item !== null) {
          // 检查是否是 InboxItem
          if (this.isInboxItem(item)) {
            lines.push(this.renderInboxItem(item, idx + 1));
          } else {
            lines.push(this.renderObjectItem(item, idx + 1));
          }
        } else {
          lines.push(`${idx + 1}. ${String(item)}`);
        }
      });
    } else if (typeof content === "object" && content !== null) {
      // 检查是否是 Inbox 内容
      if (this.isInboxContent(content)) {
        return this.renderInboxContent(content);
      }
      
      Object.entries(content).forEach(([key, value]) => {
        lines.push(`• *${key}*: ${this.formatValue(value)}`);
      });
    }

    return lines;
  }

  private renderObjectItem(item: Record<string, unknown>, index: number): string {
    const parts: string[] = [];
    
    const id = item.id || item.targetId || item.sessionId;
    const name = item.name || item.title || item.label;
    const status = item.status || item.state;

    if (id) parts.push(`\`${String(id)}\``);
    if (name) parts.push(String(name));
    if (status) parts.push(`[${String(status)}]`);

    return `${index}. ${parts.join(" ")}`;
  }

  private buildButtons(
    actions: OperatorViewAction[],
    workspaceId?: string
  ): TelegramInlineButton[][] {
    // Telegram inline keyboard 每行最多放几个按钮
    const MAX_PER_ROW = 2;
    const rows: TelegramInlineButton[][] = [];

    // 过滤出需要显示为按钮的动作
    const buttonActions = actions.filter(
      (a) => a.actionType !== "view_dashboard" // 视图切换动作不显示为按钮
    );

    for (let i = 0; i < buttonActions.length; i += MAX_PER_ROW) {
      const row: TelegramInlineButton[] = [];
      const slice = buttonActions.slice(i, i + MAX_PER_ROW);
      
      slice.forEach((action) => {
        const targetType = action.targetType || this.inferTargetType(action.actionType);
        const targetId = action.targetId || "";
        
        row.push({
          text: action.label,
          callbackData: buildCallbackData(action.actionType, targetType, targetId),
        });
      });

      if (row.length > 0) {
        rows.push(row);
      }
    }

    return rows;
  }

  private inferTargetType(actionType: string): string {
    const mapping: Record<string, string> = {
      approve: "approval",
      reject: "approval",
      escalate: "approval",
      ack_incident: "incident",
      request_recovery: "incident",
      request_replay: "incident",
      retry_task: "task",
      cancel_task: "task",
      pause_task: "task",
      resume_task: "task",
      pause_agent: "agent",
      resume_agent: "agent",
      inspect_agent: "agent",
      dismiss_intervention: "intervention",
      snooze_intervention: "intervention",
    };
    return mapping[actionType] || "unknown";
  }

  private formatValue(value: unknown): string {
    if (typeof value === "boolean") {
      return value ? "是" : "否";
    }
    if (typeof value === "number") {
      return String(value);
    }
    if (Array.isArray(value)) {
      return value.join(", ");
    }
    if (typeof value === "object" && value !== null) {
      return JSON.stringify(value);
    }
    return String(value);
  }

  private formatFreshness(ms: number): string {
    if (ms < 1000) {
      return "刚刚";
    }
    if (ms < 60000) {
      return `${Math.floor(ms / 1000)}秒前`;
    }
    if (ms < 3600000) {
      return `${Math.floor(ms / 60000)}分钟前`;
    }
    return `${Math.floor(ms / 3600000)}小时前`;
  }
  
  // ============================================================================
  // Inbox 渲染辅助方法
  // ============================================================================
  
  private isInboxItem(item: any): boolean {
    return item.itemType && item.severity && item.sourceId;
  }
  
  private isInboxContent(content: any): boolean {
    return content.summary && content.items && Array.isArray(content.items);
  }
  
  private renderInboxContent(content: any): string[] {
    const lines: string[] = [];
    
    // 渲染摘要
    const summary = content.summary;
    lines.push("*📥 收件箱摘要*");
    lines.push(`审批：${summary.pendingApprovals || 0}`);
    lines.push(`事件：${summary.openIncidents || 0}`);
    lines.push(`任务：${summary.blockedTasks || 0}`);
    lines.push(`紧急：${summary.criticalCount || 0}`);
    lines.push("");
    
    // 渲染紧急项（只限前 5 项）
    const urgentItems = content.urgentItems || content.items?.filter((i: any) => 
      i.severity === 'critical' || i.severity === 'high'
    ) || [];
    
    if (urgentItems.length > 0) {
      lines.push("*🔴 紧急项*");
      urgentItems.slice(0, 5).forEach((item: any, idx: number) => {
        lines.push(this.renderInboxItem(item, idx + 1));
      });
      lines.push("");
    }
    
    return lines;
  }
  
  private renderInboxItem(item: any, index: number): string {
    const severityIcon = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢',
    }[item.severity] || '⚪';
    
    const typeIcon = {
      approval: '📋',
      incident: '🚨',
      task: '📝',
      intervention: '⚠️',
      attention: '👀',
    }[item.itemType] || '📌';
    
    const statusStr = item.status ? ` [${item.status}]` : '';
    const ageStr = item.ageMs ? ` (${this.formatFreshness(item.ageMs)})` : '';
    
    return `${index}. ${severityIcon} ${typeIcon} *${item.title}*${statusStr}${ageStr}`;
  }
}
