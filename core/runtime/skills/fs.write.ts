/**
 * fs.write - 文件写入技能
 * 
 * 破坏性操作，默认需要审批。
 * 走完整 runtime 链路。
 */

import { buildSkill } from '../build_skill';
import * as fs from 'fs';
import * as path from 'path';

export const fsWriteSkill = buildSkill<{ path: string; content: string; append?: boolean }, void>({
  name: 'fs.write',
  description: 'Write content to file in workspace',
  category: 'fs',
  inputSchema: { 
    type: 'object', 
    properties: { 
      path: { type: 'string' },
      content: { type: 'string' },
      append: { type: 'boolean' },
    } 
  },
  policy: {
    readOnly: false,
    destructive: true,
    requiresApproval: true, // 写操作需要审批
    timeoutMs: 30000,
  },
  tags: ['file', 'write', 'fs'],
  searchHint: '写入文件内容，创建/修改代码/配置',
  async handler(ctx, input) {
    // 安全检查：限制在 workspace 内
    const fullPath = path.resolve(ctx.workspaceRoot, input.path);
    if (!fullPath.startsWith(ctx.workspaceRoot)) {
      throw new Error(`Path traversal detected: ${input.path}`);
    }
    
    // 禁止写入系统目录
    const systemPaths = ['/etc/', '/usr/', '/var/', '/System/', '/Applications/'];
    for (const sysPath of systemPaths) {
      if (fullPath.startsWith(sysPath)) {
        throw new Error(`Forbidden: cannot write to system path ${sysPath}`);
      }
    }
    
    // 确保目录存在
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // 写入文件
    if (input.append) {
      fs.appendFileSync(fullPath, input.content);
    } else {
      fs.writeFileSync(fullPath, input.content, 'utf-8');
    }
    
    // 记录到任务日志
    if (ctx.taskId) {
      ctx.tasks.appendOutput(
        ctx.taskId, 
        `✏️ Write: ${input.path} (${input.content.length} bytes, ${input.append ? 'append' : 'overwrite'})\n`
      );
    }
    
    // 发送文件变更事件
    ctx.emit({
      type: 'file.changed',
      sessionId: ctx.sessionId,
      path: input.path,
      action: 'modified',
      timestamp: Date.now(),
    });
  },
});
