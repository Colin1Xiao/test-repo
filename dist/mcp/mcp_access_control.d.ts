/**
 * MCP Access Control - MCP 访问控制
 *
 * 职责：
 * 1. 执行前权限校验
 * 2. 对接 PermissionEngine
 * 3. 对接 AgentSpec / ExecutionContext
 * 4. 将 policy decision 转为可执行结果
 * 5. 对未授权请求阻断或转审批
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { McpAccessContext, McpAccessResult, McpPolicyAction } from './types';
import { McpPolicy } from './mcp_policy';
/**
 * 访问控制配置
 */
export interface AccessControlConfig {
    /** 自动创建审批请求 */
    autoCreateApproval?: boolean;
    /** 审批超时（毫秒） */
    approvalTimeoutMs?: number;
}
export declare class McpAccessControl {
    private config;
    private policy;
    constructor(policy: McpPolicy, config?: AccessControlConfig);
    /**
     * 检查 Server 访问权限
     */
    checkServerAccess(context: McpAccessContext, serverId: string): Promise<McpAccessResult>;
    /**
     * 检查 Tool 访问权限
     */
    checkToolAccess(context: McpAccessContext, qualifiedToolName: string): Promise<McpAccessResult>;
    /**
     * 检查 Resource 访问权限
     */
    checkResourceAccess(context: McpAccessContext, qualifiedResourceName: string, action: 'read' | 'write' | 'search'): Promise<McpAccessResult>;
    /**
     * 执行访问控制
     */
    enforceAccess(result: McpAccessResult): Promise<void>;
    /**
     * 构建访问结果
     */
    private buildAccessResult;
    /**
     * 创建审批请求
     */
    private createApprovalRequest;
    /**
     * 等待审批
     */
    private waitForApproval;
}
/**
 * 创建访问控制器
 */
export declare function createMcpAccessControl(policy: McpPolicy, config?: AccessControlConfig): McpAccessControl;
/**
 * 快速检查访问权限
 */
export declare function checkMcpAccess(policy: McpPolicy, context: McpAccessContext, capabilityName: string, action?: McpPolicyAction): Promise<McpAccessResult>;
