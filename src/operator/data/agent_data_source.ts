/**
 * Agent Data Source
 * Phase 2A-1R′A - 真实 Agent 数据源
 * 
 * 职责：
 * - 提供 Agent 数据读取接口
 * - 支持 busy / blocked / unhealthy / offline agents 查询
 * - 支持按 ID 查询单个 Agent
 */

import type { AgentStatus } from '../ux/control_types';

// ============================================================================
// 类型定义
// ============================================================================

export interface AgentItem {
  /** Agent ID */
  agentId: string;
  
  /** Agent 角色 */
  role: string;
  
  /** Agent 状态 */
  status: AgentStatus;
  
  /** 活跃任务数 */
  activeTaskCount: number;
  
  /** 阻塞任务数 */
  blockedTaskCount: number;
  
  /** 失败率（0-1） */
  failureRate: number;
  
  /** 最后活动时间 */
  lastSeenAt: number;
  
  /** 当前任务 ID */
  currentTaskId?: string;
  
  /** 健康评分（0-100） */
  healthScore?: number;
  
  /** Agent 名称 */
  name?: string;
  
  /** 创建时间 */
  createdAt?: number;
}

// ============================================================================
// 数据源接口
// ============================================================================

export interface AgentDataSource {
  /**
   * 获取忙碌 Agent 列表
   */
  getBusyAgents(limit?: number): Promise<AgentItem[]>;
  
  /**
   * 获取阻塞 Agent 列表
   */
  getBlockedAgents(limit?: number): Promise<AgentItem[]>;
  
  /**
   * 获取不健康 Agent 列表
   */
  getUnhealthyAgents(limit?: number): Promise<AgentItem[]>;
  
  /**
   * 获取离线 Agent 列表
   */
  getOfflineAgents(limit?: number): Promise<AgentItem[]>;
  
  /**
   * 按 ID 获取 Agent
   */
  getAgentById(agentId: string): Promise<AgentItem | null>;
  
  /**
   * 获取 Agent 统计
   */
  getAgentSummary(): Promise<{
    total: number;
    busy: number;
    blocked: number;
    unhealthy: number;
    offline: number;
    avgHealthScore: number;
  }>;
}

// ============================================================================
// 配置
// ============================================================================

export interface AgentDataSourceConfig {
  /** 默认返回数量限制 */
  defaultLimit?: number;
  
  /** 健康评分阈值（低于此值为不健康） */
  unhealthyThreshold?: number;
  
  /** 离线阈值（毫秒，超过此时间未活动视为离线） */
  offlineThresholdMs?: number;
  
  /** 数据刷新间隔（毫秒） */
  refreshIntervalMs?: number;
}

// ============================================================================
// 内存实现（用于测试/降级）
// ============================================================================

export class InMemoryAgentDataSource implements AgentDataSource {
  private config: Required<AgentDataSourceConfig>;
  private agents: Map<string, AgentItem> = new Map();
  
  constructor(config: AgentDataSourceConfig = {}) {
    this.config = {
      defaultLimit: config.defaultLimit ?? 50,
      unhealthyThreshold: config.unhealthyThreshold ?? 60,
      offlineThresholdMs: config.offlineThresholdMs ?? 5 * 60 * 60 * 1000, // 5 小时
      refreshIntervalMs: config.refreshIntervalMs ?? 30000,
    };
  }
  
  async getBusyAgents(limit?: number): Promise<AgentItem[]> {
    const allAgents = Array.from(this.agents.values());
    return allAgents
      .filter(a => a.status === 'busy' || (a.status === 'idle' && a.activeTaskCount > 0))
      .sort((a, b) => b.activeTaskCount - a.activeTaskCount)
      .slice(0, limit ?? this.config.defaultLimit);
  }
  
  async getBlockedAgents(limit?: number): Promise<AgentItem[]> {
    const allAgents = Array.from(this.agents.values());
    return allAgents
      .filter(a => a.status === 'blocked' || a.blockedTaskCount > 0)
      .sort((a, b) => b.blockedTaskCount - a.blockedTaskCount)
      .slice(0, limit ?? this.config.defaultLimit);
  }
  
  async getUnhealthyAgents(limit?: number): Promise<AgentItem[]> {
    const allAgents = Array.from(this.agents.values());
    return allAgents
      .filter(a => {
        const healthScore = a.healthScore ?? 100;
        return healthScore < this.config.unhealthyThreshold || a.status === 'unhealthy';
      })
      .sort((a, b) => (a.healthScore ?? 100) - (b.healthScore ?? 100))
      .slice(0, limit ?? this.config.defaultLimit);
  }
  
  async getOfflineAgents(limit?: number): Promise<AgentItem[]> {
    const allAgents = Array.from(this.agents.values());
    const now = Date.now();
    
    return allAgents
      .filter(a => now - a.lastSeenAt > this.config.offlineThresholdMs || a.status === 'offline')
      .sort((a, b) => a.lastSeenAt - b.lastSeenAt)
      .slice(0, limit ?? this.config.defaultLimit);
  }
  
  async getAgentById(agentId: string): Promise<AgentItem | null> {
    return this.agents.get(agentId) || null;
  }
  
  async getAgentSummary(): Promise<{
    total: number;
    busy: number;
    blocked: number;
    unhealthy: number;
    offline: number;
    avgHealthScore: number;
  }> {
    const allAgents = Array.from(this.agents.values());
    const now = Date.now();
    
    const busy = allAgents.filter(a => a.status === 'busy' || a.activeTaskCount > 0).length;
    const blocked = allAgents.filter(a => a.status === 'blocked' || a.blockedTaskCount > 0).length;
    const unhealthy = allAgents.filter(a => (a.healthScore ?? 100) < this.config.unhealthyThreshold || a.status === 'unhealthy').length;
    const offline = allAgents.filter(a => now - a.lastSeenAt > this.config.offlineThresholdMs || a.status === 'offline').length;
    
    const avgHealthScore = allAgents.length > 0
      ? allAgents.reduce((sum, a) => sum + (a.healthScore ?? 100), 0) / allAgents.length
      : 100;
    
    return {
      total: this.agents.size,
      busy,
      blocked,
      unhealthy,
      offline,
      avgHealthScore,
    };
  }
  
  // ============================================================================
  // 测试辅助方法
  // ============================================================================
  
  /**
   * 添加测试 Agent
   */
  addAgent(agent: AgentItem): void {
    this.agents.set(agent.agentId, agent);
  }
  
  /**
   * 更新 Agent 状态
   */
  updateAgentStatus(agentId: string, status: AgentStatus): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;
    
    agent.status = status;
    agent.lastSeenAt = Date.now();
    this.agents.set(agentId, agent);
    return true;
  }
  
  /**
   * 更新 Agent 健康评分
   */
  updateAgentHealth(agentId: string, healthScore: number): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;
    
    agent.healthScore = healthScore;
    agent.lastSeenAt = Date.now();
    this.agents.set(agentId, agent);
    return true;
  }
  
  /**
   * 清除所有 Agent
   */
  clear(): void {
    this.agents.clear();
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createAgentDataSource(
  config?: AgentDataSourceConfig
): AgentDataSource {
  return new InMemoryAgentDataSource(config);
}
