/**
 * AgentSpec - 代理定义系统
 * 
 * 把代理变成标准对象，不是 prompt 垃圾堆。
 * 不同 agent 有不同技能、权限、上下文。
 */

/** 代理规格 */
export type AgentSpec = {
  /** 代理名称 */
  name: string;
  /** 代理描述 */
  description: string;
  /** 使用场景 */
  whenToUse: string;
  
  /** 允许的工具列表（白名单） */
  tools?: string[];
  /** 禁止的工具列表（黑名单） */
  disallowedTools?: string[];
  /** 技能列表 */
  skills?: string[];
  /** 需要的 MCP 服务器 */
  requiredMcpServers?: string[];
  
  /** 权限模式 */
  permissionMode?: 'allow' | 'ask' | 'deny';
  /** 最大轮次 */
  maxTurns?: number;
  /** 是否后台运行 */
  background?: boolean;
  /** 记忆范围 */
  memoryScope?: 'none' | 'session' | 'project' | 'user';
  /** 隔离模式 */
  isolation?: 'none' | 'sandbox' | 'worktree';
  
  /** 使用的模型 */
  model?: string;
  /** 努力程度 */
  effort?: 'low' | 'medium' | 'high';
  /** 初始提示词 */
  initialPrompt?: string;
};

/** 代理实例（运行时） */
export type AgentInstance = AgentSpec & {
  /** 实例 ID */
  id: string;
  /** 绑定会话 ID */
  sessionId: string;
  /** 创建时间 */
  createdAt: number;
  /** 当前轮次 */
  currentTurn: number;
};

/** 默认代理规格 */
export const DEFAULT_AGENTS: Record<string, AgentSpec> = {
  main_assistant: {
    name: 'main_assistant',
    description: '主要助手，处理通用任务',
    whenToUse: '默认代理，处理日常对话和通用任务',
    tools: ['fs.read', 'fs.write', 'exec.run', 'grep.search', 'task.*'],
    permissionMode: 'ask',
    maxTurns: 20,
    background: false,
    memoryScope: 'session',
    isolation: 'none',
    effort: 'medium',
  },
  
  code_fixer: {
    name: 'code_fixer',
    description: '修复代码并做验证',
    whenToUse: '需要读代码、改代码、跑测试时',
    tools: ['fs.read', 'fs.write', 'exec.run', 'grep.search', 'task.list', 'task.output', 'todo.write'],
    disallowedTools: ['git.push'],
    permissionMode: 'ask',
    maxTurns: 12,
    background: true,
    memoryScope: 'project',
    isolation: 'worktree',
    effort: 'high',
  },
  
  code_reviewer: {
    name: 'code_reviewer',
    description: '审查改动并给出风险与验证建议',
    whenToUse: '需要审查代码改动、评估风险时',
    tools: ['fs.read', 'diff.read', 'grep.search'],
    disallowedTools: ['fs.write', 'exec.run', 'git.push'],
    permissionMode: 'deny',
    maxTurns: 8,
    background: false,
    memoryScope: 'project',
    isolation: 'none',
    effort: 'medium',
  },
  
  ops_agent: {
    name: 'ops_agent',
    description: '运维排障，监控系统状态',
    whenToUse: '系统排障、日志分析、状态检查时',
    tools: ['exec.run', 'fs.read', 'grep.search', 'task.list', 'task.output'],
    disallowedTools: ['fs.write', 'git.push'],
    permissionMode: 'ask',
    maxTurns: 15,
    background: false,
    memoryScope: 'project',
    isolation: 'none',
    effort: 'high',
  },
  
  research_agent: {
    name: 'research_agent',
    description: '信息搜集与研究',
    whenToUse: '需要搜索信息、整理资料时',
    tools: ['grep.search', 'fs.read', 'fs.write', 'task.list', 'task.output'],
    disallowedTools: ['exec.run'],
    permissionMode: 'ask',
    maxTurns: 10,
    background: true,
    memoryScope: 'session',
    isolation: 'none',
    effort: 'medium',
  },
};

/**
 * 验证工具是否在代理允许范围内
 */
export function isToolAllowed(
  agent: AgentSpec,
  toolName: string,
): boolean {
  // 黑名单优先
  if (agent.disallowedTools) {
    for (const pattern of agent.disallowedTools) {
      if (matchesPattern(pattern, toolName)) {
        return false;
      }
    }
  }
  
  // 白名单检查
  if (agent.tools) {
    for (const pattern of agent.tools) {
      if (matchesPattern(pattern, toolName)) {
        return true;
      }
    }
    return false;
  }
  
  // 没有配置则默认允许
  return true;
}

/**
 * 匹配工具模式（支持通配符）
 */
function matchesPattern(pattern: string, toolName: string): boolean {
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1);
    return toolName.startsWith(prefix);
  }
  return pattern === toolName;
}

/**
 * 创建代理实例
 */
export function createAgentInstance(
  spec: AgentSpec,
  sessionId: string,
): AgentInstance {
  return {
    ...spec,
    id: `agent_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    sessionId,
    createdAt: Date.now(),
    currentTurn: 0,
  };
}

/**
 * 获取默认代理
 */
export function getDefaultAgent(name: string): AgentSpec | undefined {
  return DEFAULT_AGENTS[name];
}

/**
 * 列出所有默认代理
 */
export function listDefaultAgents(): AgentSpec[] {
  return Object.values(DEFAULT_AGENTS);
}
