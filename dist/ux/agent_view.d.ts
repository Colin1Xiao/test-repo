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
import type { AgentViewModel, AgentView, ViewFilter, ControlActionResult } from './control_types';
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
export declare class AgentViewBuilder {
    private config;
    private agentDataSource;
    constructor(agentDataSource: AgentDataSource, config?: AgentViewBuilderConfig);
    /**
     * 构建 Agent 视图
     */
    buildAgentView(filter?: ViewFilter): Promise<AgentView>;
    /**
     * 列出忙碌 Agent
     */
    listBusyAgents(filter?: ViewFilter): Promise<AgentViewModel[]>;
    /**
     * 列出阻塞 Agent
     */
    listBlockedAgents(filter?: ViewFilter): Promise<AgentViewModel[]>;
    /**
     * 列出不健康 Agent
     */
    listUnhealthyAgents(filter?: ViewFilter): Promise<AgentViewModel[]>;
    /**
     * 暂停 Agent
     */
    pauseAgent(agentId: string): Promise<ControlActionResult>;
    /**
     * 恢复 Agent
     */
    resumeAgent(agentId: string): Promise<ControlActionResult>;
    /**
     * 检查 Agent
     */
    inspectAgent(agentId: string): Promise<ControlActionResult>;
    /**
     * Agent 转换为视图模型
     */
    private agentToViewModel;
    /**
     * 确定 Agent 状态
     */
    private determineAgentStatus;
    /**
     * 计算健康评分
     */
    private calculateHealthScore;
    /**
     * 过滤 Agent
     */
    private filterAgents;
    /**
     * 计算负载摘要
     */
    private calculateLoadSummary;
}
/**
 * 创建 Agent 视图构建器
 */
export declare function createAgentViewBuilder(agentDataSource: AgentDataSource, config?: AgentViewBuilderConfig): AgentViewBuilder;
/**
 * 快速构建 Agent 视图
 */
export declare function buildAgentView(agentDataSource: AgentDataSource, filter?: ViewFilter): Promise<AgentView>;
