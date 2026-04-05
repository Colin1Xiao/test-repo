/**
 * Task Model - 任务数据模型
 *
 * 把任务提升为一等对象，支持：
 * - 任务 ID 规范（类型前缀）
 * - 状态追踪
 * - 输出日志
 * - 恢复点
 */
/** 任务类型（带前缀 ID） */
export type TaskType = 'exec' | 'agent' | 'workflow' | 'approval' | 'mcp' | 'verify';
/** 任务状态 */
export type TaskStatus = 'created' | 'queued' | 'running' | 'waiting_approval' | 'waiting_input' | 'completed' | 'failed' | 'cancelled';
/** 任务 ID 前缀规范 */
export declare const TASK_PREFIX: Record<TaskType, string>;
/** 运行时任务对象 */
export type RuntimeTask = {
    /** 任务 ID（格式：{prefix}_{timestamp}_{random}） */
    id: string;
    /** 任务类型 */
    type: TaskType;
    /** 任务状态 */
    status: TaskStatus;
    /** 任务描述 */
    description: string;
    /** 所属会话 ID */
    sessionId: string;
    /** 所属代理 ID */
    agentId: string;
    /** 工作区根目录 */
    workspaceRoot: string;
    /** 创建时间戳（毫秒） */
    createdAt: number;
    /** 开始时间戳（毫秒） */
    startedAt?: number;
    /** 结束时间戳（毫秒） */
    endedAt?: number;
    /** 父任务 ID（可选，用于子任务） */
    parentTaskId?: string;
    /** 输出日志路径 */
    outputLogPath?: string;
    /** 输出偏移量（用于增量读取） */
    outputOffset?: number;
    /** 错误信息（失败时） */
    error?: string;
    /** 元数据 */
    metadata?: Record<string, unknown>;
};
/**
 * 生成任务 ID
 *
 * @param type 任务类型
 * @returns 格式化的任务 ID（如：x_1712112000000_abc123）
 */
export declare function generateTaskId(type: TaskType): string;
/**
 * 从 ID 解析任务类型
 *
 * @param taskId 任务 ID
 * @returns 任务类型，null 表示格式错误
 */
export declare function parseTaskType(taskId: string): TaskType | null;
/**
 * 创建新任务
 */
export declare function createTask(type: TaskType, sessionId: string, agentId: string, workspaceRoot: string, description: string, parentTaskId?: string): RuntimeTask;
/**
 * 任务状态机转换规则
 */
export declare const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]>;
/**
 * 验证状态转换是否合法
 */
export declare function isValidTransition(from: TaskStatus, to: TaskStatus): boolean;
