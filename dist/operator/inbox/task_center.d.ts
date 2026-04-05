/**
 * Task Center
 * Phase 2A-2B - 任务中心聚合
 *
 * 职责：
 * - 聚合 blocked tasks
 * - 聚合 failed tasks
 * - 聚合 high-priority active tasks
 * - 输出 InboxItem 列表
 */
import type { InboxItem } from '../types/inbox_types';
import type { TaskDataSource } from '../data/task_data_source';
export interface TaskCenterConfig {
    /** 返回数量限制 */
    limit?: number;
}
export declare class TaskCenter {
    private config;
    private taskDataSource;
    constructor(taskDataSource: TaskDataSource, config?: TaskCenterConfig);
    /**
     * 获取任务 Inbox 项
     */
    getInboxItems(workspaceId?: string): Promise<InboxItem[]>;
    /**
     * 获取摘要
     */
    getSummary(workspaceId?: string): Promise<{
        blockedTasks: number;
        failedTasks: number;
        highPriorityActive: number;
    }>;
    private calculateSeverity;
}
export declare function createTaskCenter(taskDataSource: TaskDataSource, config?: TaskCenterConfig): TaskCenter;
