/**
 * TaskStore - 任务存储与管理
 *
 * 提供任务的 CRUD、输出追加、列表查询等能力。
 * 支持持久化（JSON 文件）和内存缓存。
 */
import { RuntimeTask, TaskType, TaskStatus } from './task_model';
/** 任务过滤器 */
export type TaskFilter = Partial<RuntimeTask> & {
    statusIn?: TaskStatus[];
    typeIn?: TaskType[];
    createdAfter?: number;
    createdBefore?: number;
};
/** TaskStore 接口 */
export interface ITaskStore {
    /** 创建任务 */
    create(task: Omit<RuntimeTask, 'id' | 'createdAt' | 'status'> & {
        type: TaskType;
    }): RuntimeTask;
    /** 获取任务 */
    get(taskId: string): RuntimeTask | undefined;
    /** 列出任务 */
    list(filter?: TaskFilter): RuntimeTask[];
    /** 更新任务 */
    update(taskId: string, patch: Partial<RuntimeTask>): void;
    /** 追加输出 */
    appendOutput(taskId: string, chunk: string): void;
    /** 读取输出 */
    getOutput(taskId: string, offset?: number, limit?: number): string;
    /** 取消任务 */
    cancel(taskId: string): Promise<void>;
}
/** 配置 */
export type TaskStoreConfig = {
    /** 持久化文件路径 */
    persistPath?: string;
    /** 内存缓存最大任务数 */
    maxCacheSize?: number;
    /** 自动持久化间隔（毫秒） */
    persistIntervalMs?: number;
};
/** 任务存储实现 */
export declare class TaskStore implements ITaskStore {
    private tasks;
    private outputs;
    private persistPath?;
    private maxCacheSize;
    constructor(config?: TaskStoreConfig);
    /**
     * 创建任务
     */
    create(taskDef: Omit<RuntimeTask, 'id' | 'createdAt' | 'status'> & {
        type: TaskType;
    }): RuntimeTask;
    /**
     * 获取任务
     */
    get(taskId: string): RuntimeTask | undefined;
    /**
     * 列出任务（支持过滤）
     */
    list(filter?: TaskFilter): RuntimeTask[];
    /**
     * 更新任务
     */
    update(taskId: string, patch: Partial<RuntimeTask>): void;
    /**
     * 追加输出
     */
    appendOutput(taskId: string, chunk: string): void;
    /**
     * 读取输出
     */
    getOutput(taskId: string, offset?: number, limit?: number): string;
    /**
     * 取消任务
     */
    cancel(taskId: string): Promise<void>;
    /**
     * 持久化到磁盘
     */
    private persist;
    /**
     * 从磁盘加载
     */
    private loadFromDisk;
    /**
     * 获取统计信息
     */
    getStats(): {
        total: number;
        byStatus: Record<TaskStatus, number>;
        byType: Record<TaskType, number>;
    };
}
