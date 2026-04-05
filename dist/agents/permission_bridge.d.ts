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
import type { PermissionDecision } from '../../core/runtime/permission_types';
import type { SubagentRole } from './types';
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
export declare class PermissionBridge implements IPermissionBridge {
    private permissionEngine;
    constructor(permissionEngine: PermissionEngine);
    /**
     * 检查子代理权限
     *
     * 流程：
     * 1. 检查角色工具白名单
     * 2. 检查角色工具黑名单
     * 3. 调用 PermissionEngine 进行全局检查
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
/**
 * 创建权限桥接实例
 */
export declare function createPermissionBridge(permissionEngine: PermissionEngine): IPermissionBridge;
/**
 * 快速检查工具访问
 */
export declare function canAccessTool(role: SubagentRole, tool: string): boolean;
/**
 * 角色工具访问矩阵
 *
 * 用于快速查询和验证
 */
export declare const ROLE_TOOL_MATRIX: Record<SubagentRole, {
    allowed: string[];
    forbidden: string[];
    requiresApproval: string[];
}>;
/**
 * 检查工具是否需要审批
 */
export declare function requiresApproval(role: SubagentRole, tool: string): boolean;
