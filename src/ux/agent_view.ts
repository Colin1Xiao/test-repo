/**
 * Agent View - Agent 视图
 * 
 * 职责：
 * 1. 展示 agent 状态、负载、失败情况
 * 2. 显示哪些 agent 忙、哪些被阻塞、哪些失败率高
 * 3. 为调度与运维提供操作面
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type {
  AgentViewModel,
  AgentView,
  AgentStatus,
  ViewFilter,
  ControlActionResult,
} from './control_types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * Agent 数据源
 */
export interface AgentDataSource {
  /** 获取 Agent 列表 */
  listAgents(): Promise<any[]>;
  
  /** 获取 Agent 详情 */
  getAgent(agentId: string): Promise<any>;
  
  /** 暂停 Agent */
  pauseAgent(agentId: string): Promise<void>;
  
  /** 恢复 Agent */
  resumeAgent(agentId: string): Promise<void>;
  
  /** 检查 Agent */
  inspectAgent(agentId: string): Promise<any>;
}

/**
 * Agent 视图构建器配置
 */
export interface AgentViewBuilderConfig {
  /** 最大忙碌 Agent 数 */
  maxBusyAgents?: number;
  
  /** 最大阻塞 Agent 数 */
  maxBlockedAgents?: number;
  
  /** 失败率阈值 */
  highFailureRateThreshold?: number;
  
  /** 不健康阈值 */
  unhealthyHealthScoreThreshold?: number;
}

// ============================================================================
// Agent 视图构建器
// ============================================================================

export class AgentViewBuilder {
  private config: Required<AgentViewBuilderConfig>;
  private agentDataSource: AgentDataSource;
  
  constructor(
    agentDataSource: AgentDataSource,
    config: AgentViewBuilderConfig = {}
  ) {
    this.config = {
      maxBusyAgents: config.maxBusyAgents ?? 20,
      maxBlockedAgents: config.maxBlockedAgents ?? 20,
      highFailureRateThreshold: config.highFailureRateThreshold ?? 0.3,
      unhealthyHealthScoreThreshold: config.unhealthyHealthScoreThreshold ?? 50,
    };
    this.agentDataSource = agentDataSource;
  }
  
  /**
   * 构建 Agent 视图
   */
  async buildAgentView(filter?: ViewFilter): Promise<AgentView> {
    // 获取 Agent 数据
    const agents = await this.agentDataSource.listAgents();
    
    // 转换为视图模型
    const viewModels = agents.map(agent => this.agentToViewModel(agent));
    
    // 过滤
    const filtered = this.filterAgents(viewModels, filter);
    
    // 分类
    const busyAgents = filtered.filter(a => a.status === 'busy');
    const blockedAgents = filtered.filter(a => a.status === 'blocked');
    const unhealthyAgents = filtered.filter(a => a.status === 'unhealthy');
    const offlineAgents = filtered.filter(a => a.status === 'offline');
    
    // 限制数量
    const limitedBusy = busyAgents.slice(0, this.config.maxBusyAgents);
    const limitedBlocked = blockedAgents.slice(0, this.config.maxBlockedAgents);
    
    // 计算负载摘要
    const loadSummary = this.calculateLoadSummary(viewModels);
    
    return {
      busyAgents: limitedBusy,
      blockedAgents: limitedBlocked,
      unhealthyAgents,
      offlineAgents,
      totalAgents: viewModels.length,
      loadSummary,
    };
  }
  
  /**
   * 列出忙碌 Agent
   */
  async listBusyAgents(filter?: ViewFilter): Promise<AgentViewModel[]> {
    const view = await this.buildAgentView(filter);
    return view.busyAgents;
  }
  
  /**
   * 列出阻塞 Agent
   */
  async listBlockedAgents(filter?: ViewFilter): Promise<AgentViewModel[]> {
    const view = await this.buildAgentView(filter);
    return view.blockedAgents;
  }
  
  /**
   * 列出不健康 Agent
   */
  async listUnhealthyAgents(filter?: ViewFilter): Promise<AgentViewModel[]> {
    const view = await this.buildAgentView(filter);
    return view.unhealthyAgents;
  }
  
  /**
   * 暂停 Agent
   */
  async pauseAgent(agentId: string): Promise<ControlActionResult> {
    try {
      await this.agentDataSource.pauseAgent(agentId);
      
      return {
        success: true,
        actionType: 'pause_agent',
        targetId: agentId,
        message: `Agent ${agentId} paused`,
        nextActions: ['resume_agent', 'inspect_agent'],
      };
    } catch (error) {
      return {
        success: false,
        actionType: 'pause_agent',
        targetId: agentId,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  /**
   * 恢复 Agent
   */
  async resumeAgent(agentId: string): Promise<ControlActionResult> {
    try {
      await this.agentDataSource.resumeAgent(agentId);
      
      return {
        success: true,
        actionType: 'resume_agent',
        targetId: agentId,
        message: `Agent ${agentId} resumed`,
        nextActions: ['pause_agent', 'inspect_agent'],
      };
    } catch (error) {
      return {
        success: false,
        actionType: 'resume_agent',
        targetId: agentId,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  /**
   * 检查 Agent
   */
  async inspectAgent(agentId: string): Promise<ControlActionResult> {
    try {
      const details = await this.agentDataSource.inspectAgent(agentId);
      
      return {
        success: true,
        actionType: 'inspect_agent',
        targetId: agentId,
        message: `Agent ${agentId} inspected`,
        nextActions: ['pause_agent', 'resume_agent'],
      };
    } catch (error) {
      return {
        success: false,
        actionType: 'inspect_agent',
        targetId: agentId,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * Agent 转换为视图模型
   */
  private agentToViewModel(agent: any): AgentViewModel {
    const status = this.determineAgentStatus(agent);
    const healthScore = this.calculateHealthScore(agent);
    
    return {
      agentId: agent.id,
      role: agent.role || 'unknown',
      status,
      activeTaskCount: agent.activeTaskCount || 0,
      blockedTaskCount: agent.blockedTaskCount || 0,
      failureRate: agent.failureRate || 0,
      lastSeenAt: agent.lastSeenAt || agent.lastActivityAt || Date.now(),
      currentTaskId: agent.currentTaskId,
      healthScore,
    };
  }
  
  /**
   * 确定 Agent 状态
   */
  private determineAgentStatus(agent: any): AgentStatus {
    // 检查是否离线
    const lastSeenAgo = Date.now() - (agent.lastSeenAt || 0);
    if (lastSeenAgo > 5 * 60 * 1000) { // 5 分钟无活动
      return 'offline';
    }
    
    // 检查是否不健康
    const healthScore = this.calculateHealthScore(agent);
    if (healthScore < this.config.unhealthyHealthScoreThreshold) {
      return 'unhealthy';
    }
    
    // 检查是否阻塞
    if (agent.blockedTaskCount > 0 || agent.status === 'blocked') {
      return 'blocked';
    }
    
    // 检查是否忙碌
    if (agent.activeTaskCount > 0 || agent.status === 'busy') {
      return 'busy';
    }
    
    return 'idle';
  }
  
  /**
   * 计算健康评分
   */
  private calculateHealthScore(agent: any): number {
    // 基于失败率计算
    const failureRate = agent.failureRate || 0;
    
    // 失败率越低，健康评分越高
    const baseScore = (1 - failureRate) * 100;
    
    // 考虑任务负载
    const taskLoadPenalty = Math.min(20, (agent.activeTaskCount || 0) * 2);
    
    // 考虑阻塞任务
    const blockedPenalty = (agent.blockedTaskCount || 0) * 10;
    
    const score = Math.max(0, baseScore - taskLoadPenalty - blockedPenalty);
    
    return Math.round(score);
  }
  
  /**
   * 过滤 Agent
   */
  private filterAgents(
    agents: AgentViewModel[],
    filter?: ViewFilter
  ): AgentViewModel[] {
    if (!filter) {
      return agents;
    }
    
    let filtered = [...agents];
    
    // 状态过滤
    if (filter.status && filter.status.length > 0) {
      filtered = filtered.filter(a => filter.status!.includes(a.status));
    }
    
    // Agent ID 过滤
    if (filter.agentId) {
      filtered = filtered.filter(a => a.agentId === filter.agentId);
    }
    
    // 关键词过滤（角色）
    if (filter.keyword) {
      const keyword = filter.keyword.toLowerCase();
      filtered = filtered.filter(a => a.role.toLowerCase().includes(keyword));
    }
    
    return filtered;
  }
  
  /**
   * 计算负载摘要
   */
  private calculateLoadSummary(agents: AgentViewModel[]): AgentView['loadSummary'] {
    if (agents.length === 0) {
      return undefined;
    }
    
    const totalActiveTasks = agents.reduce((sum, a) => sum + a.activeTaskCount, 0);
    const totalFailureRate = agents.reduce((sum, a) => sum + a.failureRate, 0);
    const totalHealthScore = agents.reduce((sum, a) => sum + (a.healthScore || 0), 0);
    
    return {
      avgActiveTasks: Math.round((totalActiveTasks / agents.length) * 100) / 100,
      avgFailureRate: Math.round((totalFailureRate / agents.length) * 1000) / 1000,
      avgHealthScore: Math.round(totalHealthScore / agents.length),
    };
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建 Agent 视图构建器
 */
export function createAgentViewBuilder(
  agentDataSource: AgentDataSource,
  config?: AgentViewBuilderConfig
): AgentViewBuilder {
  return new AgentViewBuilder(agentDataSource, config);
}

/**
 * 快速构建 Agent 视图
 */
export async function buildAgentView(
  agentDataSource: AgentDataSource,
  filter?: ViewFilter
): Promise<AgentView> {
  const builder = new AgentViewBuilder(agentDataSource);
  return await builder.buildAgentView(filter);
}
