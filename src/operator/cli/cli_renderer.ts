/**
 * CLI Renderer
 * Phase 2A-1 - CLI 响应渲染层
 * 
 * 职责：将 OperatorViewPayload 和 OperatorCommandResult 渲染为 CLI 文本响应
 */

import type {
  OperatorCommandResult,
  OperatorViewPayload,
  SurfaceRenderedResponse,
  OperatorViewAction,
} from "../types/surface_types";

export interface CliRenderer {
  /**
   * 渲染视图为 CLI 响应
   * @param payload - 视图数据
   * @param style - 可选的样式配置
   * @returns CLI 渲染响应
   */
  renderView(payload: OperatorViewPayload, style?: string): SurfaceRenderedResponse;

  /**
   * 渲染命令执行结果为 CLI 响应
   * @param result - 命令执行结果
   * @param style - 可选的样式配置
   * @returns CLI 渲染响应
   */
  renderResult(result: OperatorCommandResult, style?: string): SurfaceRenderedResponse;
}

// ============================================================================
// CLI 样式常量
// ============================================================================

const STYLES = {
  header: "bold",
  success: "green",
  error: "red",
  warning: "yellow",
  info: "cyan",
  dim: "gray",
};

// ============================================================================
// 默认实现
// ============================================================================

export class DefaultCliRenderer implements CliRenderer {
  renderView(payload: OperatorViewPayload, style?: string): SurfaceRenderedResponse {
    const lines: string[] = [];

    // 标题
    lines.push(this.formatHeader(payload.title));
    if (payload.subtitle) {
      lines.push(this.formatDim(payload.subtitle));
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

    // 可用操作
    if (payload.availableActions.length > 0) {
      lines.push(this.formatHeader("可用操作:"));
      payload.availableActions.forEach((action) => {
        lines.push(this.renderAction(action));
      });
    }

    // 面包屑导航
    if (payload.breadcrumbs && payload.breadcrumbs.length > 0) {
      lines.push("");
      lines.push(this.formatDim(`路径：${payload.breadcrumbs.join(" > ")}`));
    }

    // 新鲜度
    if (payload.freshnessMs !== undefined) {
      lines.push(this.formatDim(`数据更新：${this.formatFreshness(payload.freshnessMs)}`));
    }

    return {
      text: lines.join("\n"),
      actions: payload.availableActions,
      metadata: {
        viewKind: payload.viewKind,
        generatedAt: payload.generatedAt,
      },
    };
  }

  renderResult(result: OperatorCommandResult, style?: string): SurfaceRenderedResponse {
    const lines: string[] = [];

    // 执行状态
    if (result.success) {
      lines.push(this.formatSuccess("✓ 执行成功"));
    } else {
      lines.push(this.formatError("✗ 执行失败"));
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
      lines.push(this.formatHeader("执行结果:"));
      lines.push(`  动作：${ar.actionType}`);
      if (ar.targetType) {
        lines.push(`  目标：${ar.targetType}${ar.targetId ? ` (${ar.targetId})` : ""}`);
      }
      lines.push("");
    }

    // 更新后的视图
    if (result.updatedView) {
      const viewResponse = this.renderView(result.updatedView, style);
      lines.push(viewResponse.text);
    }

    // 错误信息
    if (result.errors && result.errors.length > 0) {
      lines.push(this.formatHeader("错误:"));
      result.errors.forEach((err) => {
        lines.push(this.formatError(`  [${err.code}] ${err.message}`));
        if (err.details) {
          lines.push(this.formatDim(`    详情：${JSON.stringify(err.details)}`));
        }
      });
    }

    return {
      text: lines.join("\n"),
      metadata: {
        success: result.success,
        respondedAt: result.respondedAt,
      },
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
          lines.push(`  ${idx + 1}. ${String(item)}`);
        }
      });
    } else if (typeof content === "object" && content !== null) {
      // 检查是否是 Inbox 内容
      if (this.isInboxContent(content)) {
        return this.renderInboxContent(content);
      }
      
      Object.entries(content).forEach(([key, value]) => {
        lines.push(`  ${key}: ${this.formatValue(value)}`);
      });
    }

    return lines;
  }

  private renderObjectItem(item: Record<string, unknown>, index: number): string {
    const parts: string[] = [];
    
    // 尝试提取常见字段
    const id = item.id || item.targetId || item.sessionId;
    const name = item.name || item.title || item.label;
    const status = item.status || item.state;

    if (id) parts.push(String(id));
    if (name) parts.push(String(name));
    if (status) parts.push(`[${String(status)}]`);

    return `  ${index}. ${parts.join(" ")}`;
  }

  private renderAction(action: OperatorViewAction): string {
    const styleIndicator = this.getStyleIndicator(action.style);
    const confirmation = action.requiresConfirmation ? " [需确认]" : "";
    return `  ${styleIndicator} ${action.label}${confirmation}`;
  }

  private getStyleIndicator(style?: string): string {
    switch (style) {
      case "primary":
        return "→";
      case "danger":
        return "⚠";
      case "warning":
        return "!";
      default:
        return "•";
    }
  }

  private formatHeader(text: string): string {
    return `【${text}】`;
  }

  private formatSuccess(text: string): string {
    return `✓ ${text}`;
  }

  private formatError(text: string): string {
    return `✗ ${text}`;
  }

  private formatDim(text: string): string {
    return text; // CLI 中暂不处理颜色，由终端自行处理
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
    lines.push(this.formatHeader("摘要"));
    lines.push(`  审批：${summary.pendingApprovals || 0}`);
    lines.push(`  事件：${summary.openIncidents || 0}`);
    lines.push(`  任务：${summary.blockedTasks || 0}`);
    lines.push(`  紧急：${summary.criticalCount || 0}`);
    lines.push("");
    
    // 渲染紧急项
    if (content.urgentItems && content.urgentItems.length > 0) {
      lines.push(this.formatHeader("紧急项"));
      content.urgentItems.forEach((item: any, idx: number) => {
        lines.push(this.renderInboxItem(item, idx + 1));
      });
      lines.push("");
    }
    
    // 渲染所有项
    if (content.items && content.items.length > 0) {
      lines.push(this.formatHeader(`所有项 (${content.items.length})`));
      content.items.forEach((item: any, idx: number) => {
        lines.push(this.renderInboxItem(item, idx + 1));
      });
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
    
    const ageStr = item.ageMs ? this.formatFreshness(item.ageMs) : '';
    const statusStr = item.status ? `[${item.status}]` : '';
    
    return `  ${index}. ${severityIcon} ${typeIcon} ${item.title} ${statusStr}`;
  }
}
