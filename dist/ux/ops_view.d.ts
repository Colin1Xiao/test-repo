/**
 * Ops View - 运维视图
 *
 * 职责：
 * 1. 聚合 Sprint 5 的 health / ops summary / audit 数据
 * 2. 输出 health score / degraded servers / blocked skills / replay hotspots / top failures
 * 3. 暴露基础运维动作入口
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { OpsViewModel, ControlActionResult } from './control_types';
/**
 * 健康指标数据源
 */
export interface HealthMetricsDataSource {
    /** 获取健康快照 */
    getHealthSnapshot(): Promise<any>;
}
/**
 * 运维摘要数据源
 */
export interface OpsSummaryDataSource {
    /** 获取运维摘要 */
    getOpsSummary(): Promise<any>;
}
/**
 * 运维视图构建器配置
 */
export interface OpsViewBuilderConfig {
    /** 最大降级 Server 数 */
    maxDegradedServers?: number;
    /** 最大被阻塞 Skill 数 */
    maxBlockedSkills?: number;
    /** 最大顶级失败数 */
    maxTopFailures?: number;
    /** 最大重放热点数 */
    maxReplayHotspots?: number;
}
export declare class OpsViewBuilder {
    private config;
    private healthMetricsDataSource;
    private opsSummaryDataSource;
    constructor(healthMetricsDataSource: HealthMetricsDataSource, opsSummaryDataSource: OpsSummaryDataSource, config?: OpsViewBuilderConfig);
    /**
     * 构建运维视图
     */
    buildOpsView(): Promise<OpsViewModel>;
    /**
     * 列出降级 Server
     */
    listDegradedServers(): Promise<OpsViewModel['degradedServers']>;
    /**
     * 列出被阻塞 Skill
     */
    listBlockedSkills(): Promise<OpsViewModel['blockedSkills']>;
    /**
     * 列出顶级事件
     */
    listTopIncidents(): Promise<OpsViewModel['activeIncidents']>;
    /**
     * 确认事件
     */
    ackIncident(incidentId: string): Promise<ControlActionResult>;
    /**
     * 请求重放
     */
    requestReplay(taskId: string): Promise<ControlActionResult>;
    /**
     * 请求恢复
     */
    requestRecovery(taskId: string): Promise<ControlActionResult>;
    /**
     * 确定总体状态
     */
    private determineOverallStatus;
    /**
     * 构建降级 Server 列表
     */
    private buildDegradedServers;
    /**
     * 构建被阻塞 Skill 列表
     */
    private buildBlockedSkills;
    /**
     * 获取阻塞原因
     */
    private getBlockedReason;
    /**
     * 构建活跃事件列表
     */
    private buildActiveIncidents;
    /**
     * 构建顶级失败列表
     */
    private buildTopFailures;
    /**
     * 构建重放热点列表
     */
    private buildReplayHotspots;
    /**
     * 映射失败严重级别
     */
    private mapFailureSeverity;
}
/**
 * 创建运维视图构建器
 */
export declare function createOpsViewBuilder(healthMetricsDataSource: HealthMetricsDataSource, opsSummaryDataSource: OpsSummaryDataSource, config?: OpsViewBuilderConfig): OpsViewBuilder;
/**
 * 快速构建运维视图
 */
export declare function buildOpsView(healthMetricsDataSource: HealthMetricsDataSource, opsSummaryDataSource: OpsSummaryDataSource): Promise<OpsViewModel>;
