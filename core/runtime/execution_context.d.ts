/**
 * ExecutionContext - 统一执行上下文
 *
 * 工具不是孤立函数，而是在完整运行时上下文里执行。
 * 每个 skill 通过 ctx 获得：
 * - 可取消（abort signal）
 * - 可审批（requestApproval）
 * - 可发事件（emit）
 * - 可写 memory
 * - 可登记任务
 * - 可限制文件系统
 * - 可限制 exec
 * - 可桥接 Telegram/远程 UI
 */
import { PermissionEngine } from './permission_engine';
import { TaskStore } from './task_store';
import { RuntimeEvent } from './hook_types';
/** 日志接口 */
export interface Logger {
    debug(msg: string, meta?: any): void;
    info(msg: string, meta?: any): void;
    warn(msg: string, meta?: any): void;
    error(msg: string, meta?: any): void;
}
/** 审批请求 */
export interface ApprovalRequest {
    id: string;
    sessionId: string;
    taskId?: string;
    tool: string;
    summary: string;
    risk: 'low' | 'medium' | 'high';
    payload?: Record<string, unknown>;
    expiresAt?: number;
}
/** 审批决策 */
export interface ApprovalDecision {
    requestId: string;
    approved: boolean;
    reason?: string;
    approvedAt: number;
    approvedBy: string;
}
/** 运行时状态 Facade（简化） */
export interface RuntimeStateFacade {
    get(key: string): any;
    set(key: string, value: any): void;
    delete(key: string): void;
}
/** 内存 Facade（简化） */
export interface MemoryFacade {
    read(scope: string, query: string): Promise<any[]>;
    write(scope: string, entry: any): Promise<void>;
}
/** 文件系统 Facade（简化） */
export interface WorkspaceFS {
    readFile(path: string): Promise<string>;
    writeFile(path: string, content: string): Promise<void>;
    exists(path: string): Promise<boolean>;
    listDir(path: string): Promise<string[]>;
}
/** 执行 Facade（简化） */
export interface ExecFacade {
    run(command: string, options?: any): Promise<{
        stdout: string;
        stderr: string;
        code: number;
    }>;
}
/** UI 桥接（简化） */
export interface UIBridge {
    send(message: string): Promise<void>;
    updateProgress(taskId: string, progress: number): Promise<void>;
}
/** MCP 注册表（简化） */
export interface MCPRegistry {
    getServer(name: string): any;
    listServers(): string[];
}
/** 执行上下文接口 */
export interface ExecutionContext {
    /** 会话 ID */
    sessionId: string;
    /** 轮次 ID */
    turnId: string;
    /** 任务 ID（可选） */
    taskId?: string;
    /** 代理 ID */
    agentId: string;
    /** 工作区根目录 */
    workspaceRoot: string;
    /** 当前工作目录 */
    cwd: string;
    /** 中止控制器 */
    abortController: AbortController;
    /** 中止信号 */
    signal: AbortSignal;
    /** 日志器 */
    logger: Logger;
    /** 发送事件 */
    emit: (event: RuntimeEvent) => void;
    /** 运行时状态 */
    state: RuntimeStateFacade;
    /** 权限引擎 */
    permissions: PermissionEngine;
    /** 任务存储 */
    tasks: TaskStore;
    /** 内存 Facade */
    memory: MemoryFacade;
    /** 文件系统 Facade */
    fs: WorkspaceFS;
    /** 执行 Facade */
    exec: ExecFacade;
    /** UI 桥接（可选） */
    ui?: UIBridge;
    /** MCP 注册表（可选） */
    mcp?: MCPRegistry;
    /** 请求审批 */
    requestApproval: (req: ApprovalRequest) => Promise<ApprovalDecision>;
    /** 添加系统备注 */
    appendSystemNote: (note: string) => void;
}
/** 执行上下文实现 */
export declare class ExecutionContextImpl implements ExecutionContext {
    sessionId: string;
    turnId: string;
    taskId?: string;
    agentId: string;
    workspaceRoot: string;
    cwd: string;
    abortController: AbortController;
    signal: AbortSignal;
    logger: Logger;
    emit: (event: RuntimeEvent) => void;
    state: RuntimeStateFacade;
    permissions: PermissionEngine;
    tasks: TaskStore;
    memory: MemoryFacade;
    fs: WorkspaceFS;
    exec: ExecFacade;
    ui?: UIBridge;
    mcp?: MCPRegistry;
    requestApproval: (req: ApprovalRequest) => Promise<ApprovalDecision>;
    appendSystemNote: (note: string) => void;
    constructor(config: {
        sessionId: string;
        turnId: string;
        taskId?: string;
        agentId: string;
        workspaceRoot: string;
        cwd: string;
        logger: Logger;
        emit: (event: RuntimeEvent) => void;
        state: RuntimeStateFacade;
        permissions: PermissionEngine;
        tasks: TaskStore;
        memory: MemoryFacade;
        fs: WorkspaceFS;
        exec: ExecFacade;
        ui?: UIBridge;
        mcp?: MCPRegistry;
        requestApproval: (req: ApprovalRequest) => Promise<ApprovalDecision>;
        appendSystemNote: (note: string) => void;
    });
    /**
     * 中止执行
     */
    abort(reason?: string): void;
    /**
     * 检查是否已中止
     */
    isAborted(): boolean;
    /**
     * 检查中止（抛出异常）
     */
    checkAborted(): void;
}
/**
 * 创建执行上下文
 */
export declare function createExecutionContext(config: ConstructorParameters<typeof ExecutionContextImpl>[0]): ExecutionContext;
