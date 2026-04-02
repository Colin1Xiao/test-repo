/**
 * tool.search - 工具搜索元技能
 * 
 * 从 ToolRegistry + SkillIndex 搜索能力。
 * 返回工具描述、分类、标签、是否需要审批、是否只读。
 */

import { buildSkill } from '../../runtime/build_skill';

/** 搜索结果 */
export type ToolSearchResult = {
  /** 工具名称 */
  name: string;
  /** 描述 */
  description: string;
  /** 分类 */
  category: string;
  /** 标签 */
  tags: string[];
  /** 是否需要审批 */
  requiresApproval: boolean;
  /** 是否只读 */
  readOnly: boolean;
  /** 是否破坏性 */
  destructive: boolean;
  /** 可用的代理 */
  availableForAgent?: string[];
  /** 搜索分数 */
  score: number;
};

/** 输入 */
export type ToolSearchInput = {
  /** 搜索关键词 */
  query: string;
  /** 分类过滤 */
  category?: string;
  /** 标签过滤 */
  tag?: string;
  /** 仅只读工具 */
  readOnlyOnly?: boolean;
  /** 限制数量 */
  limit?: number;
};

/** 输出 */
export type ToolSearchOutput = {
  results: ToolSearchResult[];
  total: number;
  query: string;
};

// 模拟工具注册表（实际应从 ToolRegistry 获取）
const mockTools: Array<ToolSearchResult & { id: string }> = [
  { id: '1', name: 'fs.read', description: 'Read file content', category: 'fs', tags: ['file', 'read'], requiresApproval: false, readOnly: true, destructive: false, score: 0 },
  { id: '2', name: 'fs.write', description: 'Write content to file', category: 'fs', tags: ['file', 'write'], requiresApproval: true, readOnly: false, destructive: true, score: 0 },
  { id: '3', name: 'exec.run', description: 'Execute shell command', category: 'exec', tags: ['shell', 'command'], requiresApproval: true, readOnly: false, destructive: true, score: 0 },
  { id: '4', name: 'grep.search', description: 'Search text in files', category: 'search', tags: ['search', 'grep'], requiresApproval: false, readOnly: true, destructive: false, score: 0 },
  { id: '5', name: 'task.list', description: 'List tasks', category: 'task', tags: ['task', 'list'], requiresApproval: false, readOnly: true, destructive: false, score: 0 },
  { id: '6', name: 'task.output', description: 'Read task output', category: 'task', tags: ['task', 'output'], requiresApproval: false, readOnly: true, destructive: false, score: 0 },
  { id: '7', name: 'todo.write', description: 'Create/update todo list', category: 'meta', tags: ['todo', 'planning'], requiresApproval: false, readOnly: false, destructive: false, score: 0 },
  { id: '8', name: 'todo.read', description: 'Read todo list', category: 'meta', tags: ['todo', 'read'], requiresApproval: false, readOnly: true, destructive: false, score: 0 },
  { id: '9', name: 'todo.update', description: 'Update todo status', category: 'meta', tags: ['todo', 'update'], requiresApproval: false, readOnly: false, destructive: false, score: 0 },
  { id: '10', name: 'tool.search', description: 'Search available tools', category: 'meta', tags: ['search', 'tools'], requiresApproval: false, readOnly: true, destructive: false, score: 0 },
];

export const toolSearchSkill = buildSkill<ToolSearchInput, ToolSearchOutput>({
  name: 'tool.search',
  description: 'Search available tools and skills by keyword, category, or tag',
  category: 'meta',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      category: { type: 'string' },
      tag: { type: 'string' },
      readOnlyOnly: { type: 'boolean' },
      limit: { type: 'number' },
    },
    required: ['query'],
  },
  policy: {
    readOnly: true,
    destructive: false,
    requiresApproval: false,
    timeoutMs: 5000,
  },
  tags: ['search', 'tools', 'discovery', 'meta'],
  searchHint: '搜索可用工具，查找能力',
  async handler(ctx, input): Promise<ToolSearchOutput> {
    const queryLower = input.query.toLowerCase();
    const limit = input.limit ?? 20;
    
    let results = mockTools
      .map(tool => {
        let score = 0;
        
        // 名称匹配（最高权重）
        if (tool.name.toLowerCase().includes(queryLower)) {
          score += 100;
        }
        
        // 描述匹配
        if (tool.description.toLowerCase().includes(queryLower)) {
          score += 50;
        }
        
        // 标签匹配
        if (tool.tags.some(t => t.toLowerCase().includes(queryLower))) {
          score += 30;
        }
        
        // 分类匹配
        if (tool.category.toLowerCase().includes(queryLower)) {
          score += 20;
        }
        
        return { ...tool, score };
      })
      .filter(tool => {
        if (tool.score === 0) return false;
        if (input.category && tool.category !== input.category) return false;
        if (input.tag && !tool.tags.includes(input.tag)) return false;
        if (input.readOnlyOnly && !tool.readOnly) return false;
        return true;
      });
    
    // 按分数排序
    results.sort((a, b) => b.score - a.score);
    
    // 限制数量
    const limited = results.slice(0, limit);
    
    // 移除内部字段
    const output: ToolSearchResult[] = limited.map(({ id, ...rest }) => rest);
    
    return {
      results: output,
      total: output.length,
      query: input.query,
    };
  },
});
