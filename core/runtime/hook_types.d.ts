/**
 * Hook Types - 生命周期事件类型定义
 *
 * Hook 总线把智能行为改成事件驱动。
 * 第一批落地的事件：
 * - before/after tool
 * - approval requested/resolved
 * - task created/completed
 * - session start/end
 * - memory written
 * - file changed
 */
/** 运行时事件联合类型 */
export type RuntimeEvent = SessionStartedEvent | SessionEndedEvent | ToolBeforeEvent | ToolAfterEvent | ToolDeniedEvent | ApprovalRequestedEvent | ApprovalResolvedEvent | TaskCreatedEvent | TaskStatusChangedEvent | MemoryWrittenEvent | WorkspaceChangedEvent | FileChangedEvent;
/** 会话开始 */
export interface SessionStartedEvent {
    type: 'session.started';
    sessionId: string;
    agentId: string;
    timestamp: number;
}
/** 会话结束 */
export interface SessionEndedEvent {
    type: 'session.ended';
    sessionId: string;
    reason?: 'completed' | 'error' | 'timeout' | 'cancelled';
    timestamp: number;
}
/** 工具执行前 */
export interface ToolBeforeEvent {
    type: 'tool.before';
    sessionId: string;
    taskId?: string;
    tool: string;
    input: unknown;
    timestamp: number;
}
/** 工具执行后 */
export interface ToolAfterEvent {
    type: 'tool.after';
    sessionId: string;
    taskId?: string;
    tool: string;
    input: unknown;
    output: unknown;
    ok: boolean;
    durationMs: number;
    timestamp: number;
}
/** 工具被拒绝 */
export interface ToolDeniedEvent {
    type: 'tool.denied';
    sessionId: string;
    taskId?: string;
    tool: string;
    reason: string;
    timestamp: number;
}
/** 审批请求 */
export interface ApprovalRequestedEvent {
    type: 'approval.requested';
    requestId: string;
    sessionId: string;
    taskId?: string;
    tool: string;
    summary: string;
    risk: 'low' | 'medium' | 'high';
    timestamp: number;
}
/** 审批解决 */
export interface ApprovalResolvedEvent {
    type: 'approval.resolved';
    requestId: string;
    sessionId: string;
    taskId?: string;
    approved: boolean;
    reason?: string;
    approvedBy: string;
    timestamp: number;
}
/** 任务创建 */
export interface TaskCreatedEvent {
    type: 'task.created';
    taskId: string;
    taskType: string;
    sessionId: string;
    description: string;
    timestamp: number;
}
/** 任务状态变化 */
export interface TaskStatusChangedEvent {
    type: 'task.status_changed';
    taskId: string;
    sessionId: string;
    from: string;
    to: string;
    timestamp: number;
}
/** 记忆写入 */
export interface MemoryWrittenEvent {
    type: 'memory.written';
    sessionId: string;
    scope: string;
    path: string;
    summary: string;
    timestamp: number;
}
/** 工作区变化 */
export interface WorkspaceChangedEvent {
    type: 'workspace.changed';
    sessionId: string;
    cwd: string;
    timestamp: number;
}
/** 文件变化 */
export interface FileChangedEvent {
    type: 'file.changed';
    sessionId: string;
    path: string;
    action: 'created' | 'modified' | 'deleted';
    timestamp: number;
}
/** Hook 处理器类型 */
export type HookHandler<T extends RuntimeEvent = RuntimeEvent> = (event: T) => Promise<void> | void;
/** Hook 优先级 */
export type HookPriority = 'low' | 'normal' | 'high';
/** Hook 注册配置 */
export interface HookConfig {
    /** 优先级 */
    priority?: HookPriority;
    /** 是否异步 */
    async?: boolean;
    /** 超时时间（毫秒） */
    timeoutMs?: number;
}
