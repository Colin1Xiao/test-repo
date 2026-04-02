/**
 * grep.search - 搜索技能
 * 
 * 只读操作，不需要审批。
 * 支持正则/文本搜索，返回匹配行。
 */

import { buildSkill } from '../build_skill';
import * as fs from 'fs';
import * as path from 'path';

export interface GrepSearchInput {
  /** 搜索模式（文本或正则） */
  pattern: string;
  /** 搜索路径（相对 workspace） */
  path?: string;
  /** 是否正则表达式 */
  isRegex?: boolean;
  /** 是否忽略大小写 */
  ignoreCase?: boolean;
  /** 文件扩展名过滤 */
  filePattern?: string;
  /** 最大结果行数 */
  maxLines?: number;
  /** 排除目录 */
  exclude?: string[];
}

export interface GrepSearchResult {
  file: string;
  line: number;
  content: string;
  match?: string;
}

export const grepSearchSkill = buildSkill<GrepSearchInput, GrepSearchResult[]>({
  name: 'grep.search',
  description: 'Search text or regex pattern in files',
  category: 'search',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: { type: 'string' },
      path: { type: 'string' },
      isRegex: { type: 'boolean' },
      ignoreCase: { type: 'boolean' },
      filePattern: { type: 'string' },
      maxLines: { type: 'number' },
      exclude: { type: 'array' },
    },
  },
  policy: {
    readOnly: true,
    destructive: false,
    requiresApproval: false,
    timeoutMs: 30000,
  },
  tags: ['search', 'grep', 'regex', 'find'],
  searchHint: '搜索文件内容，查找代码/文本/日志',
  async handler(ctx, input) {
    const searchPath = input.path 
      ? path.resolve(ctx.workspaceRoot, input.path)
      : ctx.workspaceRoot;
    
    // 确保搜索路径在 workspace 内
    if (!searchPath.startsWith(ctx.workspaceRoot)) {
      throw new Error(`Search path must be within workspace: ${input.path}`);
    }
    
    const results: GrepSearchResult[] = [];
    const maxLines = input.maxLines ?? 100;
    const regex = input.isRegex
      ? new RegExp(input.pattern, input.ignoreCase ? 'i' : '')
      : new RegExp(escapeRegex(input.pattern), input.ignoreCase ? 'i' : '');
    
    // 递归搜索目录
    function searchDir(dir: string): void {
      if (results.length >= maxLines) return;
      
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      
      for (const entry of entries) {
        if (results.length >= maxLines) return;
        
        // 排除目录
        if (input.exclude?.some(ex => entry.name.includes(ex))) {
          continue;
        }
        
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // 跳过 node_modules, .git, .venv 等
          if (['node_modules', '.git', '.venv', '__pycache__', 'dist', 'build'].includes(entry.name)) {
            continue;
          }
          searchDir(fullPath);
        } else if (entry.isFile()) {
          // 文件扩展名过滤
          if (input.filePattern && !new RegExp(input.filePattern).test(entry.name)) {
            continue;
          }
          
          // 读取文件并搜索
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const lines = content.split('\n');
            
            for (let i = 0; i < lines.length; i++) {
              if (results.length >= maxLines) break;
              
              const line = lines[i];
              const match = line.match(regex);
              
              if (match) {
                results.push({
                  file: path.relative(ctx.workspaceRoot, fullPath),
                  line: i + 1,
                  content: line.trim(),
                  match: match[0],
                });
              }
            }
          } catch {
            // 跳过无法读取的文件（二进制等）
          }
        }
      }
    }
    
    searchDir(searchPath);
    
    // 记录到任务日志
    if (ctx.taskId) {
      ctx.tasks.appendOutput(
        ctx.taskId, 
        `🔍 Search: "${input.pattern}" → ${results.length} results\n`
      );
    }
    
    return results;
  },
});

/** 转义正则特殊字符 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
