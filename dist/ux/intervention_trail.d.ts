/**
 * Intervention Trail - 介入追踪
 *
 * 职责：
 * 1. 把人的所有介入动作结构化记录下来
 * 2. 记录谁做的/何时做的/针对哪个对象/为什么触发/做了什么/系统建议是什么/最终结果是什么
 * 3. 这层很关键，因为 6D 如果没有 trail，就不算正式闭环
 *
 * @version v0.1.0
 * @date 2026-04-04
 */
import type { InterventionTrailEntry, InterventionItem, InterventionStatus } from './hitl_types';
/**
 * 介入追踪管理器配置
 */
export interface InterventionTrailConfig {
    /** 最大追踪记录数 */
    maxEntries?: number;
    /** 是否启用持久化 */
    enablePersistence?: boolean;
    /** 持久化路径 */
    persistPath?: string;
}
export declare class InterventionTrailManager {
    private config;
    private entries;
    constructor(config?: InterventionTrailConfig);
    /**
     * 记录介入动作
     */
    recordAction(interventionId: string, actor: string, action: string, result?: InterventionTrailEntry['result'], note?: string): InterventionTrailEntry;
    /**
     * 记录介入状态变化
     */
    recordStatusChange(interventionId: string, actor: string, fromStatus: InterventionStatus, toStatus: InterventionStatus, note?: string): InterventionTrailEntry;
    /**
     * 记录介入创建
     */
    recordCreation(intervention: InterventionItem, actor?: string): InterventionTrailEntry;
    /**
     * 记录介入解决
     */
    recordResolution(interventionId: string, actor: string, result: 'resolved' | 'dismissed' | 'escalated', note?: string): InterventionTrailEntry;
    /**
     * 获取介入的追踪记录
     */
    getTrailForIntervention(interventionId: string): InterventionTrailEntry[];
    /**
     * 获取最近的追踪记录
     */
    getRecentTrail(limit?: number): InterventionTrailEntry[];
    /**
     * 获取指定执行者的追踪记录
     */
    getTrailByActor(actor: string, limit?: number): InterventionTrailEntry[];
    /**
     * 获取指定时间范围的追踪记录
     */
    getTrailByTimeRange(startTime: number, endTime: number): InterventionTrailEntry[];
    /**
     * 获取统计信息
     */
    getStats(): {
        totalEntries: number;
        byActor: Record<string, number>;
        byAction: Record<string, number>;
        byResult: Record<string, number>;
        last24h: number;
    };
    /**
     * 清空追踪记录
     */
    clear(): void;
    /**
     * 加载持久化数据
     */
    private loadFromPersistence;
    /**
     * 保存持久化数据
     */
    private saveToPersistence;
}
/**
 * 创建介入追踪管理器
 */
export declare function createInterventionTrailManager(config?: InterventionTrailConfig): InterventionTrailManager;
/**
 * 快速记录介入动作
 */
export declare function recordInterventionAction(trailManager: InterventionTrailManager, interventionId: string, actor: string, action: string, result?: InterventionTrailEntry['result'], note?: string): InterventionTrailEntry;
