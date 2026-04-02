/**
 * SessionStartHandler - 会话启动处理器
 * 
 * 监听会话启动事件，初始化上下文。
 * 注入默认 agent、memory scope、cwd。
 */

import { HookBus } from '../runtime/hook_bus';
import { AgentRegistry } from '../agents/agent_registry';

/** 配置 */
export interface SessionStartHandlerConfig {
  agents?: AgentRegistry;
  /** 默认代理名称 */
  defaultAgent?: string;
}

/** 会话启动处理器实现 */
export class SessionStartHandler {
  private agents?: AgentRegistry;
  private defaultAgent: string;

  constructor(hookBus: HookBus, config: SessionStartHandlerConfig = {}) {
    this.agents = config.agents;
    this.defaultAgent = config.defaultAgent ?? 'main_assistant';
    
    this.register(hookBus);
  }

  /**
   * 注册钩子处理器
   */
  private register(hookBus: HookBus): void {
    hookBus.on('session.started', async (event) => {
      await this.handleSessionStart(event);
    });
  }

  /**
   * 处理会话启动事件
   */
  private async handleSessionStart(event: any): Promise<void> {
    console.log(`[SessionStart] New session: ${event.sessionId}`);
    
    // 绑定默认代理
    if (this.agents) {
      try {
        this.agents.bindAgent(event.sessionId, this.defaultAgent);
        console.log(
          `[SessionStart] Bound agent "${this.defaultAgent}" to session ${event.sessionId}`,
        );
      } catch (error) {
        console.error(
          `[SessionStart] Failed to bind agent:`, 
          error instanceof Error ? error.message : error,
        );
      }
    }
    
    // 未来可以扩展：
    // - 初始化 memory scope
    // - 设置默认 cwd
    // - 加载会话偏好
  }
}
