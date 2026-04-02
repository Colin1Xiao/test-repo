/**
 * AgentRegistry - 代理注册表
 * 
 * 管理运行时的代理实例，支持：
 * - 按会话绑定代理
 * - 代理工具门控
 * - 代理切换
 */

import { AgentSpec, AgentInstance, createAgentInstance, isToolAllowed, DEFAULT_AGENTS } from './agent_spec';
import { AgentLoader } from './agent_loader';

/** 代理注册表实现 */
export class AgentRegistry {
  private loader: AgentLoader;
  private instances: Map<string, AgentInstance> = new Map(); // sessionId -> instance
  private sessionAgents: Map<string, string> = new Map(); // sessionId -> agentName

  constructor(loader?: AgentLoader) {
    this.loader = loader ?? new AgentLoader();
  }

  /**
   * 为会话绑定代理
   */
  bindAgent(sessionId: string, agentName: string): AgentInstance {
    const spec = this.loader.get(agentName);
    if (!spec) {
      throw new Error(`Agent not found: ${agentName}`);
    }
    
    const instance = createAgentInstance(spec, sessionId);
    this.instances.set(sessionId, instance);
    this.sessionAgents.set(sessionId, agentName);
    
    return instance;
  }

  /**
   * 获取会话绑定的代理
   */
  getAgent(sessionId: string): AgentInstance | undefined {
    return this.instances.get(sessionId);
  }

  /**
   * 获取代理名称
   */
  getAgentName(sessionId: string): string | undefined {
    return this.sessionAgents.get(sessionId);
  }

  /**
   * 检查工具是否允许（代理门控）
   */
  isToolAllowed(sessionId: string, toolName: string): boolean {
    const instance = this.instances.get(sessionId);
    if (!instance) {
      // 没有绑定代理，默认允许
      return true;
    }
    
    return isToolAllowed(instance, toolName);
  }

  /**
   * 获取工具拒绝原因
   */
  getToolDenialReason(sessionId: string, toolName: string): string | null {
    const instance = this.instances.get(sessionId);
    if (!instance) {
      return null;
    }
    
    // 检查黑名单
    if (instance.disallowedTools) {
      for (const pattern of instance.disallowedTools) {
        if (this.matchesPattern(pattern, toolName)) {
          return `Blocked by agent "${instance.name}": tool "${toolName}" is in disallowedTools`;
        }
      }
    }
    
    // 检查白名单
    if (instance.tools) {
      for (const pattern of instance.tools) {
        if (this.matchesPattern(pattern, toolName)) {
          return null; // 在白名单中
        }
      }
      return `Blocked by agent "${instance.name}": tool "${toolName}" is not in allowedTools`;
    }
    
    return null;
  }

  /**
   * 更新代理轮次
   */
  incrementTurn(sessionId: string): number {
    const instance = this.instances.get(sessionId);
    if (!instance) {
      return 0;
    }
    
    instance.currentTurn++;
    
    // 检查是否超过最大轮次
    if (instance.maxTurns && instance.currentTurn > instance.maxTurns) {
      throw new Error(
        `Agent "${instance.name}" exceeded max turns (${instance.currentTurn}/${instance.maxTurns})`,
      );
    }
    
    return instance.currentTurn;
  }

  /**
   * 获取当前轮次
   */
  getCurrentTurn(sessionId: string): number {
    return this.instances.get(sessionId)?.currentTurn ?? 0;
  }

  /**
   * 列出所有会话绑定
   */
  listBindings(): Array<{
    sessionId: string;
    agentName: string;
    currentTurn: number;
    maxTurns?: number;
  }> {
    const results: Array<any> = [];
    
    this.sessionAgents.forEach((agentName, sessionId) => {
      const instance = this.instances.get(sessionId);
      results.push({
        sessionId,
        agentName,
        currentTurn: instance?.currentTurn ?? 0,
        maxTurns: instance?.maxTurns,
      });
    });
    
    return results;
  }

  /**
   * 解绑代理
   */
  unbindAgent(sessionId: string): void {
    this.instances.delete(sessionId);
    this.sessionAgents.delete(sessionId);
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalAgents: number;
    activeBindings: number;
    byAgent: Record<string, number>;
  } {
    const byAgent: Record<string, number> = {};
    
    this.sessionAgents.forEach(agentName => {
      byAgent[agentName] = (byAgent[agentName] ?? 0) + 1;
    });
    
    return {
      totalAgents: this.loader.list().length,
      activeBindings: this.sessionAgents.size,
      byAgent,
    };
  }

  /**
   * 匹配工具模式
   */
  private matchesPattern(pattern: string, toolName: string): boolean {
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return toolName.startsWith(prefix);
    }
    return pattern === toolName;
  }

  /**
   * 获取所有可用代理名称
   */
  listAvailableAgents(): string[] {
    return this.loader.list().map(a => a.name);
  }
}
