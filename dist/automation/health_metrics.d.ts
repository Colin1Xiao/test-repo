/**
 * Health Metrics - 健康指标计算
 *
 * 职责：
 * 1. 从 audit / task / health 源计算系统健康指标
 * 2. 产出全局、按 agent、按 server、按 skill 的健康快照
 * 3. 给 ops summary 提供结构化输入
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { HealthSnapshot, AgentHealthMetrics, ServerHealthMetrics, SkillHealthMetrics, AuditEvent } from './types';
/**
 * 健康计算配置
 */
export interface HealthMetricsConfig {
    /** 时间窗口（毫秒） */
    timeWindowMs?: number;
    /** 健康评分权重 */
    healthScoreWeights?: {
        successRate: number;
        pendingApprovals: number;
        degradedServers: number;
        blockedSkills: number;
    };
}
/**
 * 健康计算上下文
 */
export interface HealthCalculationContext {
    /** 审计事件 */
    auditEvents: AuditEvent[];
    /** 任务数据（可选） */
    taskData?: Record<string, any>;
    /** Server 状态（可选） */
    serverStatus?: Record<string, 'healthy' | 'degraded' | 'unavailable'>;
    /** Skill 状态（可选） */
    skillStatus?: Record<string, 'loaded' | 'blocked' | 'pending'>;
    /** 待处理审批数（可选） */
    pendingApprovals?: number;
}
export declare class HealthMetricsCalculator {
    private config;
    constructor(config?: HealthMetricsConfig);
    /**
     * 计算健康快照
     */
    computeHealthSnapshot(context: HealthCalculationContext): HealthSnapshot;
    /**
     * 计算 Agent 健康指标
     */
    computeAgentHealth(agentId: string, context: HealthCalculationContext): AgentHealthMetrics;
    /**
     * 计算 Server 健康指标
     */
    computeServerHealth(serverId: string, context: HealthCalculationContext): ServerHealthMetrics;
    /**
     * 计算 Skill 健康指标
     */
    computeSkillHealth(skillName: string, context: HealthCalculationContext): SkillHealthMetrics;
    /**
     * 计算全局指标
     */
    private computeGlobalMetrics;
    /**
     * 按 Agent 分组计算指标
     */
    private computeAgentMetrics;
    /**
     * 按 Server 分组计算指标
     */
    private computeServerMetrics;
    /**
     * 按 Skill 分组计算指标
     */
    private computeSkillMetrics;
    /**
     * 计算健康评分
     */
    private calculateHealthScore;
}
/**
 * 创建健康指标计算器
 */
export declare function createHealthMetricsCalculator(config?: HealthMetricsConfig): HealthMetricsCalculator;
/**
 * 快速计算健康快照
 */
export declare function computeHealthSnapshot(context: HealthCalculationContext, config?: HealthMetricsConfig): HealthSnapshot;
