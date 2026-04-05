/**
 * MCP Approval - MCP 审批流程
 *
 * 职责：
 * 1. 创建 MCP 审批请求
 * 2. pending server / tool / resource 语义
 * 3. 复用现有 ApprovalBridge / TaskStore / HookBus
 * 4. 审批后回填结果并继续或拒绝执行
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { McpApprovalRequest, McpApprovalResult } from './types';
/**
 * 审批处理器接口
 */
export interface IApprovalHandler {
    /**
     * 创建审批请求
     */
    createRequest(request: McpApprovalRequest): Promise<void>;
    /**
     * 等待审批结果
     */
    waitForResult(requestId: string, timeoutMs: number): Promise<McpApprovalResult>;
    /**
     * 更新审批状态
     */
    updateStatus(requestId: string, status: 'pending' | 'approved' | 'rejected'): Promise<void>;
}
/**
 * 审批配置
 */
export interface McpApprovalConfig {
    /** 默认超时（毫秒） */
    defaultTimeoutMs?: number;
    /** 自动清理已完成的审批 */
    autoCleanup?: boolean;
    /** 清理间隔（毫秒） */
    cleanupIntervalMs?: number;
}
export declare class McpApprovalManager {
    private config;
    private approvalHandler?;
    private requests;
    private results;
    private waitingCallbacks;
    constructor(approvalHandler?: IApprovalHandler, config?: McpApprovalConfig);
    /**
     * 创建审批请求
     */
    createRequest(request: McpApprovalRequest): Promise<void>;
    /**
     * 等待审批结果
     */
    waitForApproval(requestId: string, timeoutMs?: number): Promise<McpApprovalResult>;
    /**
     * 处理审批结果
     */
    handleApprovalResult(requestId: string, result: McpApprovalResult): Promise<void>;
    /**
     * 获取审批请求
     */
    getRequest(requestId: string): McpApprovalRequest | null;
    /**
     * 获取待审批列表
     */
    getPendingRequests(): McpApprovalRequest[];
    /**
     * 按 Server 获取待审批列表
     */
    getPendingRequestsByServer(serverId: string): McpApprovalRequest[];
    /**
     * 按 Agent 获取待审批列表
     */
    getPendingRequestsByAgent(agentId: string): McpApprovalRequest[];
    /**
     * 清理已完成的审批
     */
    cleanupCompletedRequests(maxAgeMs?: number): number;
    /**
     * 启动自动清理
     */
    private startCleanup;
    /**
     * 触发 Hook
     */
    private emitHook;
}
/**
 * 创建审批管理器
 */
export declare function createMcpApprovalManager(approvalHandler?: IApprovalHandler, config?: McpApprovalConfig): McpApprovalManager;
/**
 * 快速创建审批请求并等待结果
 */
export declare function requestMcpApproval(manager: McpApprovalManager, request: McpApprovalRequest, timeoutMs?: number): Promise<McpApprovalResult>;
