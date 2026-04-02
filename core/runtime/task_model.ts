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
export type TaskType =
  | 'exec'      // x - 执行任务
  | 'agent'     // a - 代理任务
  | 'workflow'  // w - 工作流
  | 'approval'  // p - 审批任务
  | 'mcp'       // m - MCP 任务
  | 'verify';   // v - 验证任务

/** 任务状态 */
export type TaskStatus =
  | 'created'          // 已创建
  | 'queued'           // 排队中
  | 'running'          // 运行中
  | 'waiting_approval' // 等待审批
  | 'waiting_input'    // 等待输入
  | 'completed'        // 已完成
  | 'failed'           // 失败
  | 'cancelled';       // 已取消

/** 任务 ID 前缀规范 */
export const TASK_PREFIX: Record<TaskType, string> = {
  exec: 'x',
  agent: 'a',
  workflow: 'w',
  approval: 'p',
  mcp: 'm',
  verify: 'v',
};

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
export function generateTaskId(type: TaskType): string {
  const prefix = TASK_PREFIX[type];
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * 从 ID 解析任务类型
 * 
 * @param taskId 任务 ID
 * @returns 任务类型，null 表示格式错误
 */
export function parseTaskType(taskId: string): TaskType | null {
  const prefix = taskId.split('_')[0];
  const entry = Object.entries(TASK_PREFIX).find(([_, p]) => p === prefix);
  return entry ? (entry[0] as TaskType) : null;
}

/**
 * 创建新任务
 */
export function createTask(
  type: TaskType,
  sessionId: string,
  agentId: string,
  workspaceRoot: string,
  description: string,
  parentTaskId?: string,
): RuntimeTask {
  return {
    id: generateTaskId(type),
    type,
    status: 'created',
    description,
    sessionId,
    agentId,
    workspaceRoot,
    createdAt: Date.now(),
    parentTaskId,
  };
}

/**
 * 任务状态机转换规则
 */
export const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  created: ['queued', 'running', 'cancelled'],
  queued: ['running', 'cancelled'],
  running: ['completed', 'failed', 'cancelled', 'waiting_approval', 'waiting_input'],
  waiting_approval: ['running', 'cancelled'],
  waiting_input: ['running', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
};

/**
 * 验证状态转换是否合法
 */
export function isValidTransition(from: TaskStatus, to: TaskStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
