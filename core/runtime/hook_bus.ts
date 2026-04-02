/**
 * HookBus - 生命周期事件总线
 * 
 * 把智能行为改成事件驱动。
 * 用途：
 * - 自动审计
 * - 自动通知 Telegram
 * - 自动写简报
 * - 自动做 session compact
 * - 自动更新 memory
 * - 自动触发验证
 */

import { RuntimeEvent, HookHandler, HookConfig } from './hook_types';

/** 内部钩子记录 */
interface HookEntry {
  handler: HookHandler;
  config: HookConfig;
}

/** Hook 总线实现 */
export class HookBus {
  private handlers: Map<string, HookEntry[]> = new Map();

  /**
   * 注册钩子
   * 
   * @param type 事件类型
   * @param handler 处理函数
   * @param config 配置（可选）
   * 
   * @example
   * hookBus.on('tool.after', async (event) => {
   *   console.log(`Tool ${event.tool} completed in ${event.durationMs}ms`);
   * });
   */
  on<T extends RuntimeEvent>(
    type: T['type'],
    handler: HookHandler<T>,
    config: HookConfig = {},
  ): void {
    const entries = this.handlers.get(type) ?? [];
    entries.push({ handler: handler as HookHandler, config });
    
    // 按优先级排序
    entries.sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      return priorityOrder[a.config.priority ?? 'normal'] - 
             priorityOrder[b.config.priority ?? 'normal'];
    });
    
    this.handlers.set(type, entries);
  }

  /**
   * 注销钩子
   */
  off<T extends RuntimeEvent>(
    type: T['type'],
    handler: HookHandler<T>,
  ): void {
    const entries = this.handlers.get(type);
    if (!entries) return;
    
    const index = entries.findIndex(e => e.handler === handler);
    if (index >= 0) {
      entries.splice(index, 1);
    }
  }

  /**
   * 触发事件
   * 
   * @param event 事件对象
   * 
   * @example
   * await hookBus.emit({
   *   type: 'task.created',
   *   taskId: 'x_123456',
   *   taskType: 'exec',
   *   sessionId: 'session_1',
   *   description: 'Run npm install',
   *   timestamp: Date.now(),
   * });
   */
  async emit(event: RuntimeEvent): Promise<void> {
    const entries = this.handlers.get(event.type);
    if (!entries || entries.length === 0) {
      return;
    }

    // 顺序执行所有处理器
    for (const entry of entries) {
      try {
        const result = entry.handler(event);
        
        // 如果是 Promise，等待完成
        if (result instanceof Promise) {
          const timeout = entry.config.timeoutMs ?? 5000;
          await Promise.race([
            result,
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Hook timeout')), timeout)
            ),
          ]);
        }
      } catch (error) {
        // 钩子错误不影响主流程，但记录日志
        console.error(`Hook error for ${event.type}:`, error);
      }
    }
  }

  /**
   * 触发事件（同步版本，不等待异步处理器）
   */
  emitSync(event: RuntimeEvent): void {
    const entries = this.handlers.get(event.type);
    if (!entries || entries.length === 0) {
      return;
    }

    for (const entry of entries) {
      try {
        const result = entry.handler(event);
        // 不等待 Promise
      } catch (error) {
        console.error(`Hook error for ${event.type}:`, error);
      }
    }
  }

  /**
   * 获取已注册的事件类型
   */
  getRegisteredEvents(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * 获取某事件的处理器数量
   */
  getHandlerCount(eventType: string): number {
    return this.handlers.get(eventType)?.length ?? 0;
  }

  /**
   * 清空所有钩子（用于测试）
   */
  clear(): void {
    this.handlers.clear();
  }
}

// ============================================================================
// 使用示例
// ============================================================================

/**
 * 示例：自动审计钩子
 * 
 * const hookBus = new HookBus();
 * 
 * // 工具执行后自动记录审计日志
 * hookBus.on('tool.after', async (event) => {
 *   await fs.appendFile('audit.log', JSON.stringify({
 *     timestamp: event.timestamp,
 *     tool: event.tool,
 *     duration: event.durationMs,
 *     ok: event.ok,
 *   }) + '\n');
 * });
 * 
 * // 审批请求时推送 Telegram
 * hookBus.on('approval.requested', async (event) => {
 *   await telegram.send(`🔐 审批请求：${event.summary}`);
 * });
 * 
 * // 任务完成后自动总结
 * hookBus.on('task.status_changed', async (event) => {
 *   if (event.to === 'completed') {
 *     await generateSummary(event.taskId);
 *   }
 * });
 */
