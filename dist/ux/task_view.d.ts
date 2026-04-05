/**
 * Task View - 任务视图
 *
 * 职责：
 * 1. 从 TaskStore / AuditLog 生成任务视图
 * 2. 显示 active / blocked / completed / failed
 * 3. 支持过滤、排序、时间线摘要
 * 4. 暴露与 task 相关的基础动作
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { TaskViewModel, TaskView, ViewFilter, ViewSort, ControlActionResult } from './control_types';
/**
 * 任务数据源
 */
export interface TaskDataSource {
    /** 获取任务列表 */
    listTasks(filter?: any): Promise<any[]>;
    /** 获取任务详情 */
    getTask(taskId: string): Promise<any>;
    /** 取消任务 */
    cancelTask(taskId: string, reason?: string): Promise<void>;
    /** 重试任务 */
    retryTask(taskId: string): Promise<void>;
    /** 暂停任务 */
    pauseTask(taskId: string): Promise<void>;
}
/**
 * 审计数据源
 */
export interface AuditDataSource {
    /** 查询审计事件 */
    queryAuditEvents(query: any): Promise<any[]>;
    /** 获取任务审计轨迹 */
    getTaskAuditTrail(taskId: string): Promise<any[]>;
}
/**
 * 任务视图构建器配置
 */
export interface TaskViewBuilderConfig {
    /** 最大活跃任务数 */
    maxActiveTasks?: number;
    /** 最大阻塞任务数 */
    maxBlockedTasks?: number;
    /** 最近完成任务数 */
    recentCompletedCount?: number;
    /** 时间窗口（毫秒） */
    timeWindowMs?: number;
}
export declare class TaskViewBuilder {
    private config;
    private taskDataSource;
    private auditDataSource?;
    constructor(taskDataSource: TaskDataSource, auditDataSource?: AuditDataSource, config?: TaskViewBuilderConfig);
    /**
     * 构建任务视图
     */
    buildTaskView(filter?: ViewFilter, sort?: ViewSort): Promise<TaskView>;
    /**
     * 列出活跃任务
     */
    listActiveTasks(filter?: ViewFilter): Promise<TaskViewModel[]>;
    /**
     * 列出阻塞任务
     */
    listBlockedTasks(filter?: ViewFilter): Promise<TaskViewModel[]>;
    /**
     * 列出最近完成的任务
     */
    listRecentCompletedTasks(filter?: ViewFilter): Promise<TaskViewModel[]>;
    /**
     * 构建任务时间线摘要
     */
    buildTaskTimelineSummary(taskId: string): Promise<{
        events: Array<{
            timestamp: number;
            event: string;
            status?: string;
        }>;
        durationMs?: number;
        retryCount?: number;
    }>;
    /**
     * 取消任务
     */
    cancelTask(taskId: string, reason?: string): Promise<ControlActionResult>;
    /**
     * 重试任务
     */
    retryTask(taskId: string): Promise<ControlActionResult>;
    /**
     * 暂停任务
     */
    pauseTask(taskId: string): Promise<ControlActionResult>;
    /**
     * 任务转换为视图模型
     */
    private taskToViewModel;
    /**
     * 规范化任务状态
     */
    private normalizeTaskStatus;
    /**
     * 确定下一步行动
     */
    private determineNextAction;
    /**
     * 排序任务
     */
    private sortTasks;
    /**
     * 构建时间线摘要
     */
    private buildTimelineSummary;
}
/**
 * 创建任务视图构建器
 */
export declare function createTaskViewBuilder(taskDataSource: TaskDataSource, auditDataSource?: AuditDataSource, config?: TaskViewBuilderConfig): TaskViewBuilder;
/**
 * 快速构建任务视图
 */
export declare function buildTaskView(taskDataSource: TaskDataSource, auditDataSource?: AuditDataSource, filter?: ViewFilter, sort?: ViewSort): Promise<TaskView>;
