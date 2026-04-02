/**
 * Default Policies - 默认权限策略
 * 
 * 生产化默认配置：
 * - allow: fs.read, grep.search, task.list, task.output, tool.search, todo.read
 * - ask: fs.write, exec.run, memory.create, memory.update, todo.write
 * - deny: workspace 外写入，rm -rf, git push --force, curl | bash
 */

import { PermissionRule, PermissionSource } from './permission_types';

/**
 * 默认允许规则（只读操作）
 */
export const DEFAULT_ALLOW_RULES: PermissionRule[] = [
  {
    source: 'system',
    behavior: 'allow',
    tool: 'fs.read',
    reason: 'Read operations are safe by default',
  },
  {
    source: 'system',
    behavior: 'allow',
    tool: 'grep.search',
    reason: 'Search operations are safe by default',
  },
  {
    source: 'system',
    behavior: 'allow',
    tool: 'task.list',
    reason: 'List tasks is safe',
  },
  {
    source: 'system',
    behavior: 'allow',
    tool: 'task.output',
    reason: 'Read task output is safe',
  },
  {
    source: 'system',
    behavior: 'allow',
    tool: 'tool.search',
    reason: 'Search tools is safe',
  },
  {
    source: 'system',
    behavior: 'allow',
    tool: 'todo.read',
    reason: 'Read todo list is safe',
  },
];

/**
 * 默认需要审批的规则（写操作/执行）
 */
export const DEFAULT_ASK_RULES: PermissionRule[] = [
  {
    source: 'system',
    behavior: 'ask',
    tool: 'fs.write',
    reason: 'Write operations require approval',
  },
  {
    source: 'system',
    behavior: 'ask',
    tool: 'exec.run',
    reason: 'Command execution requires approval',
  },
  {
    source: 'system',
    behavior: 'ask',
    tool: 'memory.create',
    reason: 'Create memory requires approval',
  },
  {
    source: 'system',
    behavior: 'ask',
    tool: 'memory.update',
    reason: 'Update memory requires approval',
  },
  {
    source: 'system',
    behavior: 'ask',
    tool: 'todo.write',
    reason: 'Write todo requires approval',
  },
];

/**
 * 默认拒绝规则（高风险操作）
 */
export const DEFAULT_DENY_RULES: PermissionRule[] = [
  {
    source: 'system',
    behavior: 'deny',
    tool: 'fs.write',
    pattern: '/etc/*',
    reason: 'Writing to /etc is forbidden',
  },
  {
    source: 'system',
    behavior: 'deny',
    tool: 'fs.write',
    pattern: '/usr/*',
    reason: 'Writing to /usr is forbidden',
  },
  {
    source: 'system',
    behavior: 'deny',
    tool: 'fs.write',
    pattern: '/var/*',
    reason: 'Writing to /var is forbidden',
  },
  {
    source: 'system',
    behavior: 'deny',
    tool: 'fs.write',
    pattern: '/System/*',
    reason: 'Writing to system directories is forbidden',
  },
  {
    source: 'system',
    behavior: 'deny',
    tool: 'exec.run',
    pattern: 'rm -rf /*',
    reason: 'Root directory deletion is forbidden',
  },
  {
    source: 'system',
    behavior: 'deny',
    tool: 'exec.run',
    pattern: 'rm -rf ~/*',
    reason: 'Home directory deletion is forbidden',
  },
  {
    source: 'system',
    behavior: 'deny',
    tool: 'exec.run',
    pattern: 'rm -rf /',
    reason: 'Root deletion is forbidden',
  },
  {
    source: 'system',
    behavior: 'deny',
    tool: 'exec.run',
    pattern: 'git push --force*',
    reason: 'Force push requires explicit approval',
  },
  {
    source: 'system',
    behavior: 'deny',
    tool: 'exec.run',
    pattern: 'curl * | *bash',
    reason: 'Pipe to bash is forbidden',
  },
  {
    source: 'system',
    behavior: 'deny',
    tool: 'exec.run',
    pattern: 'curl * | *sh',
    reason: 'Pipe to sh is forbidden',
  },
  {
    source: 'system',
    behavior: 'deny',
    tool: 'exec.run',
    pattern: 'wget * | *bash',
    reason: 'Pipe to bash is forbidden',
  },
  {
    source: 'system',
    behavior: 'deny',
    tool: 'exec.run',
    pattern: 'wget * | *sh',
    reason: 'Pipe to sh is forbidden',
  },
  {
    source: 'system',
    behavior: 'deny',
    tool: 'exec.run',
    pattern: 'dd if=*',
    reason: 'Direct disk write is forbidden',
  },
  {
    source: 'system',
    behavior: 'deny',
    tool: 'exec.run',
    pattern: 'mkfs*',
    reason: 'Filesystem creation is forbidden',
  },
  {
    source: 'system',
    behavior: 'deny',
    tool: 'exec.run',
    pattern: 'chmod -R *',
    reason: 'Recursive permission change is forbidden',
  },
  {
    source: 'system',
    behavior: 'deny',
    tool: 'exec.run',
    pattern: 'chown -R *',
    reason: 'Recursive ownership change is forbidden',
  },
  {
    source: 'system',
    behavior: 'deny',
    tool: 'exec.run',
    pattern: 'sudo *',
    reason: 'Sudo commands are forbidden',
  },
];

/**
 * 合并所有默认规则
 */
export function getDefaultPermissionRules(): PermissionRule[] {
  return [
    ...DEFAULT_ALLOW_RULES,
    ...DEFAULT_ASK_RULES,
    ...DEFAULT_DENY_RULES,
  ];
}

/**
 * Agent 级策略配置
 */
export const AGENT_POLICIES: Record<string, {
  allow?: string[];
  deny?: string[];
  requireWorktree?: boolean;
}> = {
  /**
   * code_reviewer - 只读代理
   */
  code_reviewer: {
    allow: [
      'fs.read',
      'grep.search',
      'task.list',
      'task.output',
      'tool.search',
      'todo.read',
      'diff.read',
    ],
    deny: [
      'fs.write',
      'exec.run',
      'memory.update',
      'memory.create',
    ],
  },
  
  /**
   * code_fixer - 代码修复代理
   */
  code_fixer: {
    allow: [
      'fs.read',
      'grep.search',
      'task.list',
      'task.output',
      'todo.write',
      'todo.read',
      'todo.update',
    ],
    // fs.write 和 exec.run 默认 ask（由 DEFAULT_ASK_RULES 控制）
    requireWorktree: true, // 默认需要 worktree 隔离
  },
  
  /**
   * ops_agent - 运维代理
   */
  ops_agent: {
    allow: [
      'fs.read',
      'grep.search',
      'task.list',
      'task.output',
      'tool.search',
    ],
    // exec.run 默认 ask
    // 高风险命令由 DEFAULT_DENY_RULES 控制
  },
  
  /**
   * main_assistant - 主要助手
   */
  main_assistant: {
    allow: [
      'fs.read',
      'grep.search',
      'task.list',
      'task.output',
      'tool.search',
      'todo.read',
    ],
    // fs.write 和 exec.run 默认 ask
  },
  
  /**
   * research_agent - 研究代理
   */
  research_agent: {
    allow: [
      'fs.read',
      'grep.search',
      'task.list',
      'task.output',
      'tool.search',
      'todo.read',
      'todo.write',
    ],
    deny: [
      'exec.run', // 研究代理禁止执行命令
    ],
  },
};

/**
 * 获取 Agent 级策略
 */
export function getAgentPolicy(agentName: string): typeof AGENT_POLICIES[string] {
  return AGENT_POLICIES[agentName] ?? {};
}

/**
 * 检查 Agent 是否允许某工具
 */
export function isAgentToolAllowed(agentName: string, toolName: string): boolean {
  const policy = getAgentPolicy(agentName);
  
  // 检查黑名单
  if (policy.deny?.includes(toolName)) {
    return false;
  }
  
  // 检查白名单（如果有配置）
  if (policy.allow) {
    return policy.allow.includes(toolName);
  }
  
  // 没有配置则使用默认策略
  return true;
}

/**
 * 检查 Agent 是否需要 worktree
 */
export function agentRequiresWorktree(agentName: string): boolean {
  const policy = getAgentPolicy(agentName);
  return policy.requireWorktree ?? false;
}
