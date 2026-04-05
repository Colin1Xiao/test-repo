/**
 * Server Health - Server 健康检查
 *
 * 职责：
 * 1. 跟踪 server health
 * 2. 标记 available / degraded / unavailable
 * 3. 给 orchestrator / planner / release_agent 提供 admission 信息
 * 4. 与并发治理、backpressure、熔断衔接
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { McpServerHealthStatus, McpServerHealthReport, McpHealthSnapshot } from './types';
/**
 * 健康检查配置
 */
export interface ServerHealthConfig {
    /** 健康检查间隔（毫秒） */
    checkIntervalMs?: number;
    /** 降级阈值（错误率） */
    degradedThreshold?: number;
    /** 不可用阈值（错误率） */
    unavailableThreshold?: number;
    /** 健康窗口大小 */
    healthWindowSize?: number;
}
export declare class ServerHealthManager {
    private config;
    private healthRecords;
    private currentStatus;
    private lastReports;
    constructor(config?: ServerHealthConfig);
    /**
     * 报告 Server 健康状态
     */
    reportServerHealth(serverId: string, status: McpServerHealthStatus, details?: {
        lastCheckAt?: number;
        error?: string;
        responseTimeMs?: number;
        successRate?: number;
    }): void;
    /**
     * 记录健康检查
     */
    recordHealthCheck(serverId: string, success: boolean, responseTimeMs?: number, error?: string): void;
    /**
     * 获取 Server 健康状态
     */
    getServerHealth(serverId: string): McpServerHealthReport | null;
    /**
     * 检查 Server 是否可用
     */
    isServerUsable(serverId: string, requirementLevel?: 'required' | 'optional'): boolean;
    /**
     * 构建健康摘要
     */
    buildHealthSummary(serverIds: string[]): McpHealthSnapshot;
    /**
     * 获取所有 Server 状态
     */
    getAllServerStatus(): Record<string, McpServerHealthStatus>;
    /**
     * 清除 Server 健康记录
     */
    clearServerHealth(serverId: string): void;
    /**
     * 更新 Server 状态
     */
    private updateServerStatus;
}
/**
 * 创建 Server 健康管理器
 */
export declare function createServerHealthManager(config?: ServerHealthConfig): ServerHealthManager;
