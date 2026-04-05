/**
 * Permission Bridge - 权限桥接层
 * 
 * 将 Agent Teams 的权限请求桥接到 OpenClaw PermissionEngine
 * 
 * 核心原则：
 * 1. 子代理权限只能 ≤ 父上下文权限
 * 2. 不允许子代理绕过审批
 * 3. 所有权限检查可审计
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type { PermissionEngine } from '../../core/runtime/permission_engine';
import type { PermissionCheckInput, PermissionDecision } from '../../core/runtime/permission_types';
import type { SubagentExecutionContext } from './execution_context_adapter';
import type { SubagentRole } from './types';
import { AGENT_ROLE_DEFAULTS } from './types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 权限检查输入（子代理简化版）
 */
export interface SubagentPermissionCheck {
  subagentTaskId: string;
  teamId: string;
  role: SubagentRole;
  tool: string;
  target?: string;
  riskLevel?: 'low' | 'medium' | 'high';
}

/**
 * 权限桥接接口
 */
export interface IPermissionBridge {
  /**
   * 检查子代理权限
   */
  checkPermission(check: SubagentPermissionCheck): Promise<PermissionDecision>;
  
  /**
   * 验证工具是否在白名单
   */
  validateToolAccess(role: SubagentRole, tool: string): boolean;
  
  /**
   * 获取角色允许的工具列表
   */
  getAllowedTools(role: SubagentRole): string[];
  
  /**
   * 获取角色禁止的工具列表
   */
  getForbiddenTools(role: SubagentRole): string[];
}

// ============================================================================
// 权限桥接实现
// ============================================================================

export class PermissionBridge implements IPermissionBridge {
  private permissionEngine: PermissionEngine;
  
  constructor(permissionEngine: PermissionEngine) {
    this.permissionEngine = permissionEngine;
  }
  
  /**
   * 检查子代理权限
   * 
   * 流程：
   * 1. 检查角色工具白名单
   * 2. 检查角色工具黑名单
   * 3. 调用 PermissionEngine 进行全局检查
   */
  async checkPermission(check: SubagentPermissionCheck): Promise<PermissionDecision> {
    // Step 1: 检查角色白名单
    const roleDefaults = AGENT_ROLE_DEFAULTS[check.role];
    if (!roleDefaults) {
      return {
        allowed: false,
        behavior: 'deny',
        requiresApproval: false,
        explanation: `Unknown agent role: ${check.role}`,
      };
    }
    
    // 检查是否在角色白名单
    if (!roleDefaults.allowedTools.includes(check.tool)) {
      return {
        allowed: false,
        behavior: 'deny',
        requiresApproval: false,
        explanation: `Tool "${check.tool}" not allowed for role "${check.role}"`,
      };
    }
    
    // 检查是否在角色黑名单
    if (roleDefaults.forbiddenTools.includes(check.tool)) {
      return {
        allowed: false,
        behavior: 'deny',
        requiresApproval: false,
        explanation: `Tool "${check.tool}" forbidden for role "${check.role}"`,
      };
    }
    
    // Step 2: 调用 PermissionEngine 进行全局检查
    const permissionInput: PermissionCheckInput = {
      tool: check.tool,
      target: check.target,
      sessionId: check.teamId, // 使用 teamId 作为 session 标识
      riskLevel: check.riskLevel || 'medium',
    };
    
    const decision = this.permissionEngine.evaluate(permissionInput);
    
    // Step 3: 子代理权限只能更严格
    // 如果 PermissionEngine 允许，但角色禁止 → 拒绝
    // 如果 PermissionEngine 需要审批 → 需要审批（不能绕过）
    
    return decision;
  }
  
  /**
   * 验证工具是否在白名单
   */
  validateToolAccess(role: SubagentRole, tool: string): boolean {
    const roleDefaults = AGENT_ROLE_DEFAULTS[role];
    if (!roleDefaults) {
      return false;
    }
    
    return (
      roleDefaults.allowedTools.includes(tool) &&
      !roleDefaults.forbiddenTools.includes(tool)
    );
  }
  
  /**
   * 获取角色允许的工具列表
   */
  getAllowedTools(role: SubagentRole): string[] {
    const roleDefaults = AGENT_ROLE_DEFAULTS[role];
    if (!roleDefaults) {
      return [];
    }
    return [...roleDefaults.allowedTools];
  }
  
  /**
   * 获取角色禁止的工具列表
   */
  getForbiddenTools(role: SubagentRole): string[] {
    const roleDefaults = AGENT_ROLE_DEFAULTS[role];
    if (!roleDefaults) {
      return [];
    }
    return [...roleDefaults.forbiddenTools];
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建权限桥接实例
 */
export function createPermissionBridge(
  permissionEngine: PermissionEngine
): IPermissionBridge {
  return new PermissionBridge(permissionEngine);
}

/**
 * 快速检查工具访问
 */
export function canAccessTool(
  role: SubagentRole,
  tool: string
): boolean {
  const bridge = new PermissionBridge({
    evaluate: () => ({
      allowed: true,
      behavior: 'allow',
      requiresApproval: false,
      explanation: 'Mock',
    }),
  } as any);
  
  return bridge.validateToolAccess(role, tool);
}

// ============================================================================
// 角色工具矩阵（快速参考）
// ============================================================================

/**
 * 角色工具访问矩阵
 * 
 * 用于快速查询和验证
 */
export const ROLE_TOOL_MATRIX: Record<SubagentRole, {
  allowed: string[];
  forbidden: string[];
  requiresApproval: string[];
}> = {
  planner: {
    allowed: ['fs.read', 'fs.list', 'grep.search', 'shell.run'],
    forbidden: ['fs.write', 'fs.delete', 'git.commit', 'git.push'],
    requiresApproval: [],
  },
  repo_reader: {
    allowed: ['fs.read', 'fs.list', 'grep.search', 'repo.map'],
    forbidden: ['fs.write', 'fs.delete', 'shell.run', 'git.commit'],
    requiresApproval: [],
  },
  code_fixer: {
    allowed: ['fs.read', 'fs.write', 'fs.delete', 'grep.search', 'shell.run', 'git.diff'],
    forbidden: ['git.commit', 'git.push'],
    requiresApproval: [],
  },
  code_reviewer: {
    allowed: ['fs.read', 'grep.search', 'git.diff'],
    forbidden: ['fs.write', 'fs.delete', 'shell.run', 'git.commit'],
    requiresApproval: [],
  },
  verify_agent: {
    allowed: ['fs.read', 'fs.list', 'shell.run', 'grep.search'],
    forbidden: ['fs.write', 'fs.delete', 'git.commit'],
    requiresApproval: [],
  },
  release_agent: {
    allowed: ['fs.read', 'fs.write', 'shell.run', 'git.commit', 'git.push'],
    forbidden: [],
    requiresApproval: ['git.push', 'git.commit'],
  },
};

/**
 * 检查工具是否需要审批
 */
export function requiresApproval(role: SubagentRole, tool: string): boolean {
  const matrix = ROLE_TOOL_MATRIX[role];
  if (!matrix) {
    return false;
  }
  return matrix.requiresApproval.includes(tool);
}
