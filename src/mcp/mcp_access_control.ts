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

import type {
  McpAccessContext,
  McpAccessResult,
  McpPolicyDecision,
  McpApprovalRequest,
  McpPolicyAction,
} from './types';
import { McpPolicy } from './mcp_policy';
import { normalizeServerName, extractServerName } from './mcp_naming';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 访问控制配置
 */
export interface AccessControlConfig {
  /** 自动创建审批请求 */
  autoCreateApproval?: boolean;
  
  /** 审批超时（毫秒） */
  approvalTimeoutMs?: number;
}

// ============================================================================
// MCP 访问控制器
// ============================================================================

export class McpAccessControl {
  private config: Required<AccessControlConfig>;
  private policy: McpPolicy;
  
  constructor(policy: McpPolicy, config: AccessControlConfig = {}) {
    this.config = {
      autoCreateApproval: config.autoCreateApproval ?? true,
      approvalTimeoutMs: config.approvalTimeoutMs ?? 300000, // 5 分钟
    };
    this.policy = policy;
  }
  
  /**
   * 检查 Server 访问权限
   */
  async checkServerAccess(
    context: McpAccessContext,
    serverId: string
  ): Promise<McpAccessResult> {
    const normalizedServerId = normalizeServerName(serverId);
    
    const decision = this.policy.checkServerAccess(
      normalizedServerId,
      'server.connect'
    );
    
    return this.buildAccessResult(context, decision);
  }
  
  /**
   * 检查 Tool 访问权限
   */
  async checkToolAccess(
    context: McpAccessContext,
    qualifiedToolName: string
  ): Promise<McpAccessResult> {
    const decision = this.policy.checkToolAccess(
      qualifiedToolName,
      context.agentId,
      context.sessionId
    );
    
    return this.buildAccessResult(context, decision);
  }
  
  /**
   * 检查 Resource 访问权限
   */
  async checkResourceAccess(
    context: McpAccessContext,
    qualifiedResourceName: string,
    action: 'read' | 'write' | 'search'
  ): Promise<McpAccessResult> {
    const decision = this.policy.checkResourceAccess(
      qualifiedResourceName,
      action,
      context.agentId,
      context.sessionId
    );
    
    return this.buildAccessResult(context, decision);
  }
  
  /**
   * 执行访问控制
   */
  async enforceAccess(result: McpAccessResult): Promise<void> {
    if (!result.allowed) {
      throw new Error(
        result.error || `Access denied: ${result.decision.reason}`
      );
    }
    
    if (result.requiresApproval && result.approvalRequest) {
      // 等待审批
      await this.waitForApproval(result.approvalRequest);
    }
  }
  
  /**
   * 构建访问结果
   */
  private buildAccessResult(
    context: McpAccessContext,
    decision: McpPolicyDecision
  ): McpAccessResult {
    const allowed = decision.effect === 'allow';
    const requiresApproval = decision.requiresApproval;
    
    let approvalRequest: McpApprovalRequest | undefined;
    
    if (requiresApproval && this.config.autoCreateApproval) {
      approvalRequest = this.createApprovalRequest(context, decision);
    }
    
    let error: string | undefined;
    
    if (!allowed && !requiresApproval) {
      error = `Access denied: ${decision.reason}`;
    }
    
    return {
      allowed,
      requiresApproval,
      decision,
      approvalRequest,
      error,
    };
  }
  
  /**
   * 创建审批请求
   */
  private createApprovalRequest(
    context: McpAccessContext,
    decision: McpPolicyDecision
  ): McpApprovalRequest {
    const requestId = `mcp_approval_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    return {
      requestId,
      agentId: context.agentId,
      taskId: context.taskId,
      sessionId: context.sessionId,
      serverId: context.serverId,
      capabilityName: context.capabilityName,
      action: context.action,
      reason: decision.reason,
      suggestedPolicyScope: decision.scope,
      createdAt: Date.now(),
      status: 'pending',
    };
  }
  
  /**
   * 等待审批
   */
  private async waitForApproval(request: McpApprovalRequest): Promise<void> {
    // 简化实现：实际应该对接 ApprovalBridge
    // 这里只是模拟等待
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Approval timeout after ${this.config.approvalTimeoutMs}ms`));
      }, this.config.approvalTimeoutMs);
      
      // 实际应该轮询或等待 Hook 通知
      // 这里简化处理，直接 resolve
      // 实际实现应该：
      // 1. 将审批请求发送到 ApprovalBridge
      // 2. 等待用户审批
      // 3. 审批通过后 resolve
      // 4. 审批拒绝或超时 reject
      
      // 模拟：直接通过（用于测试）
      clearTimeout(timeout);
      resolve();
    });
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建访问控制器
 */
export function createMcpAccessControl(
  policy: McpPolicy,
  config?: AccessControlConfig
): McpAccessControl {
  return new McpAccessControl(policy, config);
}

/**
 * 快速检查访问权限
 */
export async function checkMcpAccess(
  policy: McpPolicy,
  context: McpAccessContext,
  capabilityName: string,
  action?: McpPolicyAction
): Promise<McpAccessResult> {
  const accessControl = new McpAccessControl(policy);
  
  const serverId = extractServerName(capabilityName);
  
  if (action) {
    // Resource 访问
    const resourceAction = action.replace('resource.', '') as 'read' | 'write' | 'search';
    return await accessControl.checkResourceAccess(
      context,
      capabilityName,
      resourceAction
    );
  } else if (capabilityName.includes('__')) {
    // Tool 访问
    return await accessControl.checkToolAccess(context, capabilityName);
  } else {
    // Server 访问
    return await accessControl.checkServerAccess(context, serverId || capabilityName);
  }
}
