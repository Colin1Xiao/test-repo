/**
 * Permission Types - 权限类型定义
 *
 * 权限系统从"开关"升级为"规则引擎"：
 * - 多级结果：allow / deny / ask
 * - 多来源合并：system / agent / workspace / local / session / user_approval
 * - 决策原因追踪（人类可解释）
 * - 精确匹配：exact / prefix / wildcard / path / mcp
 */
/** 权限行为 */
export type PermissionBehavior = 'allow' | 'deny' | 'ask';
/** 权限来源（优先级从高到低） */
export type PermissionSource = 'session' | 'user_approval' | 'workspace' | 'agent' | 'local' | 'system';
/** 权限规则 */
export type PermissionRule = {
    /** 规则来源 */
    source: PermissionSource;
    /** 权限行为 */
    behavior: PermissionBehavior;
    /** 工具名称（如 "exec.run", "fs.write"） */
    tool: string;
    /** 匹配模式（可选，用于 exec command 等） */
    pattern?: string;
    /** 优先级（可选，默认按 source） */
    priority?: number;
    /** 原因说明（用于解释） */
    reason?: string;
    /** 工作区路径范围（可选） */
    pathScope?: string;
    /** MCP server 范围（可选） */
    mcpServer?: string;
    /** 过期时间（可选，用于临时批准） */
    expiresAt?: number;
};
/** 权限检查输入 */
export type PermissionCheckInput = {
    /** 工具名称 */
    tool: string;
    /** 动作（可选，如 "read" / "write" / "delete"） */
    action?: string;
    /** 目标（可选，如文件路径、命令） */
    target?: string;
    /** 负载（可选，完整输入参数） */
    payload?: unknown;
    /** 当前工作区路径 */
    cwd?: string;
};
/** 权限决策结果 */
export type PermissionDecision = {
    /** 是否允许 */
    allowed: boolean;
    /** 权限行为 */
    behavior: PermissionBehavior;
    /** 命中的规则（可选） */
    matchedRule?: PermissionRule;
    /** 是否需要审批 */
    requiresApproval: boolean;
    /** 人类可解释的原因 */
    explanation: string;
};
/** 危险命令模式（自动收紧） */
export declare const DANGEROUS_PATTERNS: string[];
/** 权限来源优先级（数字越大优先级越高） */
export declare const SOURCE_PRIORITY: Record<PermissionSource, number>;
/** 默认系统规则（最低优先级） */
export declare const DEFAULT_SYSTEM_RULES: PermissionRule[];
