/**
 * OCNMPS 入口集成 - 统一路由接入点
 * 
 * 将 OCNMPS 路由接入统一主链：
 * 用户消息 → QueryGuard → OCNMPS 路由 → 模型调用 → 审计追踪
 */

import { OCNMPSRouter, createOCNMPSRouter } from './ocnmps_router';
import { createEntranceConnector } from '../integration/entrance_connector';
import { HookBus } from '../runtime/hook_bus';

/** OCNMPS 集成配置 */
export interface OCNMPSIntegrationConfig {
  /** 灰度比例 */
  grayRatio?: number;
  /** 模型映射 */
  modelMapping?: Record<string, string>;
  /** 是否启用 */
  enabled?: boolean;
}

/** OCNMPS 集成器 */
export class OCNMPSIntegrator {
  private router: OCNMPSRouter;
  private connector: any; // EntranceConnector
  private hookBus: HookBus;
  private enabled: boolean;

  constructor(config: OCNMPSIntegrationConfig = {}) {
    this.router = createOCNMPSRouter({
      grayRatio: config.grayRatio,
      modelMapping: config.modelMapping,
    });
    this.connector = createEntranceConnector();
    this.hookBus = new HookBus();
    this.enabled = config.enabled ?? true;
  }

  /**
   * 处理用户消息（带路由）
   */
  async handleMessage(options: {
    text: string;
    sessionId: string;
    defaultModel: string;
  }): Promise<{
    success: boolean;
    model: string;
    intent: string;
    output?: string;
    error?: string;
  }> {
    if (!this.enabled) {
      // 降级：直接处理，不路由
      return this.connector.handleUserMessage({
        sessionId: options.sessionId,
        turnId: `turn_${Date.now()}`,
        message: options.text,
      });
    }

    // 1. OCNMPS 路由决策
    const decision = await this.router.route({
      text: options.text,
      sessionId: options.sessionId,
      defaultModel: options.defaultModel,
    });

    // 2. 发送路由事件 hook
    await this.hookBus.emit({
      type: 'tool.before',
      sessionId: options.sessionId,
      taskId: decision.routingTaskId,
      tool: 'ocnmps.route',
      input: {
        text: options.text,
        intent: decision.intent,
        model: decision.finalModel,
      },
      timestamp: Date.now(),
    });

    try {
      // 3. 设置模型 override（通过 session 状态）
      // 注意：实际实现需要调用 session 状态管理
      console.log(`[OCNMPS] Model override: ${decision.finalModel} (intent: ${decision.intent})`);

      // 4. 处理消息
      const result = await this.connector.handleUserMessage({
        sessionId: options.sessionId,
        turnId: `turn_${Date.now()}`,
        message: options.text,
      });

      // 5. 发送完成 hook
      await this.hookBus.emit({
        type: 'tool.after',
        sessionId: options.sessionId,
        taskId: decision.routingTaskId,
        tool: 'ocnmps.route',
        input: {
          text: options.text,
          intent: decision.intent,
          model: decision.finalModel,
        },
        output: result,
        ok: result.success,
        durationMs: Date.now() - decision.timestamp,
        timestamp: Date.now(),
      });

      return {
        success: result.success,
        model: decision.finalModel,
        intent: decision.intent,
        output: result.output,
        error: result.error,
      };
    } catch (error) {
      // 6. 发送错误 hook
      await this.hookBus.emit({
        type: 'tool.denied',
        sessionId: options.sessionId,
        taskId: decision.routingTaskId,
        tool: 'ocnmps.route',
        reason: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      });

      return {
        success: false,
        model: decision.finalModel,
        intent: decision.intent,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 获取路由统计
   */
  getStats() {
    return this.router.getStats();
  }

  /**
   * 获取路由历史
   */
  getHistory(options?: { limit?: number; grayHitOnly?: boolean }) {
    return this.router.getRoutingHistory(options);
  }

  /**
   * 启用/禁用路由
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * 更新灰度比例
   */
  setGrayRatio(ratio: number): void {
    this.router = createOCNMPSRouter({
      grayRatio: ratio,
    });
  }
}

/**
 * 创建 OCNMPS 集成器（快速初始化）
 */
export function createOCNMPSIntegrator(config?: OCNMPSIntegrationConfig): OCNMPSIntegrator {
  return new OCNMPSIntegrator(config);
}
