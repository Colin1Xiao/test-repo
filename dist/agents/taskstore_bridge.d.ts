/**
 * TaskStore Bridge - 任务存储桥接层
 *
 * 将 Agent Teams 的子任务注册到 OpenClaw TaskStore
 * 实现 parent-child task graph 可追踪、可审计
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { TaskStore } from '../../core/runtime/task_store';
import type { RuntimeTask, TaskStatus } from '../../core/runtime/task_model';
import type { SubagentTask, SubagentResult } from './types';
/**
 * 子任务类型
 */
export type SubagentTaskType = 'subagent' | 'team';
/**
 * 任务创建输入
 */
export interface SubagentTaskInput {
    type: SubagentTaskType;
    sessionId: string;
    agentId: string;
    workspaceRoot: string;
    description: string;
    parentTaskId?: string;
    teamId?: string;
    subagentRole?: string;
}
/**
 * 任务桥接接口
 */
export interface ITaskStoreBridge {
    /**
     * 创建团队任务
     */
    createTeamTask(teamId: string, parentTaskId: string, sessionId: string, agentId: string, workspaceRoot: string, goal: string): Promise<RuntimeTask>;
    /**
     * 创建子代理任务
     */
    createSubagentTask(task: SubagentTask, teamTaskId: string): Promise<RuntimeTask>;
    /**
     * 更新子任务状态
     */
    updateSubagentStatus(runtimeTaskId: string, status: TaskStatus, error?: string): Promise<void>;
    /**
     * 记录子代理结果
     */
    recordSubagentResult(runtimeTaskId: string, result: SubagentResult): Promise<void>;
    /**
     * 完成团队任务
     */
    completeTeamTask(runtimeTaskId: string, mergedSummary: string): Promise<void>;
    /**
     * 失败团队任务
     */
    failTeamTask(runtimeTaskId: string, reason: string): Promise<void>;
    /**
     * 获取团队的所有子任务
     */
    getTeamSubtasks(teamTaskId: string): Promise<RuntimeTask[]>;
}
export declare class TaskStoreBridge implements ITaskStoreBridge {
    private taskStore;
    constructor(taskStore: TaskStore);
    /**
     * 创建团队任务
     */
    createTeamTask(teamId: string, parentTaskId: string, sessionId: string, agentId: string, workspaceRoot: string, goal: string): Promise<RuntimeTask>;
    /**
     * 创建子代理任务
     */
    createSubagentTask(task: SubagentTask, teamTaskId: string): Promise<RuntimeTask>;
    /**
     * 更新子任务状态
     */
    updateSubagentStatus(runtimeTaskId: string, status: TaskStatus, error?: string): Promise<void>;
    /**
     * 记录子代理结果
     */
    recordSubagentResult(runtimeTaskId: string, result: SubagentResult): Promise<void>;
    /**
     * 完成团队任务
     */
    completeTeamTask(runtimeTaskId: string, mergedSummary: string): Promise<void>;
    /**
     * 失败团队任务
     */
    failTeamTask(runtimeTaskId: string, reason: string): Promise<void>;
    /**
     * 获取团队的所有子任务
     */
    getTeamSubtasks(teamTaskId: string): Promise<RuntimeTask[]>;
    /**
     * 格式化结果为输出文本
     */
    private formatResultOutput;
}
/**
 * 创建任务桥接实例
 */
export declare function createTaskStoreBridge(taskStore: TaskStore): ITaskStoreBridge;
/**
 * 快速创建子任务（简化版）
 */
export declare function createSubagentTaskQuick(taskStore: TaskStore, task: SubagentTask, teamTaskId: string): Promise<RuntimeTask>;
