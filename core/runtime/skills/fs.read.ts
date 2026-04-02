/**
 * fs.read - 文件读取技能
 * 
 * 使用 buildSkill 定义，走完整 runtime 链路：
 * - PermissionEngine 检查
 * - ExecutionContext 注入
 * - HookBus 事件
 * - TaskStore 日志
 */

import { buildSkill } from '../build_skill';
import * as fs from 'fs';
import * as path from 'path';

export const fsReadSkill = buildSkill<{ path: string }, string>({
  name: 'fs.read',
  description: 'Read file content from workspace',
  category: 'fs',
  inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
  policy: {
    readOnly: true,
    destructive: false,
    requiresApproval: false,
    timeoutMs: 10000,
  },
  tags: ['file', 'read', 'fs'],
  searchHint: '读取文件内容，查看代码/配置/日志',
  async handler(ctx, input) {
    // 安全检查：限制在 workspace 内
    const fullPath = path.resolve(ctx.workspaceRoot, input.path);
    if (!fullPath.startsWith(ctx.workspaceRoot)) {
      throw new Error(`Path traversal detected: ${input.path}`);
    }
    
    // 检查文件存在
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${input.path}`);
    }
    
    // 检查是否文件（不是目录）
    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) {
      throw new Error(`Not a file: ${input.path}`);
    }
    
    // 检查文件大小（限制 10MB）
    if (stat.size > 10 * 1024 * 1024) {
      throw new Error(`File too large: ${stat.size} bytes (max 10MB)`);
    }
    
    // 读取文件
    const content = fs.readFileSync(fullPath, 'utf-8');
    
    // 记录到任务日志
    if (ctx.taskId) {
      ctx.tasks.appendOutput(ctx.taskId, `📄 Read: ${input.path} (${stat.size} bytes)\n`);
    }
    
    return content;
  },
});
