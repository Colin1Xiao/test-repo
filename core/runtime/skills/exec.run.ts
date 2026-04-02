/**
 * exec.run - 命令执行技能
 * 
 * 高风险操作，必须走完整链路：
 * - QueryGuard 防并发
 * - PermissionEngine 检查（危险命令检测）
 * - TaskStore 日志
 * - HookBus 事件
 * - 输出落盘
 */

import { buildSkill } from '../build_skill';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const execRunSkill = buildSkill<{ command: string; cwd?: string; timeoutMs?: number }, { stdout: string; stderr: string; code: number }>({
  name: 'exec.run',
  description: 'Execute shell command in workspace',
  category: 'exec',
  inputSchema: {
    type: 'object',
    properties: {
      command: { type: 'string' },
      cwd: { type: 'string' },
      timeoutMs: { type: 'number' },
    },
  },
  policy: {
    readOnly: false,
    destructive: true,
    requiresApproval: true, // 执行命令需要审批
    timeoutMs: 120000, // 2 分钟默认超时
  },
  tags: ['exec', 'shell', 'command', 'bash'],
  searchHint: '执行 shell 命令，运行脚本/工具/构建',
  async handler(ctx, input) {
    // 危险命令检测（PermissionEngine 已做，这里再检查一次）
    const dangerousPatterns = [
      'rm -rf /',
      'rm -rf ~',
      'dd if=',
      'mkfs',
      '> /etc/',
      '> /usr/',
      'curl * | *bash',
      'wget * | *sh',
    ];
    
    for (const pattern of dangerousPatterns) {
      if (new RegExp(pattern.replace(/\*/g, '.*')).test(input.command)) {
        throw new Error(`Blocked: dangerous command pattern "${pattern}"`);
      }
    }
    
    // 确定工作目录
    const cwd = input.cwd 
      ? path.resolve(ctx.workspaceRoot, input.cwd)
      : ctx.workspaceRoot;
    
    // 确保 cwd 在 workspace 内
    if (!cwd.startsWith(ctx.workspaceRoot)) {
      throw new Error(`Working directory must be within workspace: ${cwd}`);
    }
    
    // 超时设置
    const timeout = input.timeoutMs ?? 60000;
    
    // 记录开始执行
    if (ctx.taskId) {
      ctx.tasks.appendOutput(ctx.taskId, `⚙️ Exec: ${input.command}\n`);
      ctx.tasks.appendOutput(ctx.taskId, `📁 CWD: ${cwd}\n`);
      ctx.tasks.appendOutput(ctx.taskId, `⏱️ Timeout: ${timeout}ms\n`);
    }
    
    // 执行命令
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    let code = 0;
    
    try {
      const result = await execAsync(input.command, {
        cwd,
        timeout,
        signal: ctx.signal,
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });
      
      stdout = result.stdout ?? '';
      stderr = result.stderr ?? '';
      code = 0;
    } catch (error: any) {
      stdout = error.stdout ?? '';
      stderr = error.stderr ?? '';
      code = error.code ?? error.status ?? -1;
      
      // 记录错误到任务日志
      if (ctx.taskId) {
        ctx.tasks.appendOutput(ctx.taskId, `❌ Error: ${error.message}\n`);
      }
    }
    
    const duration = Date.now() - startTime;
    
    // 记录输出到任务日志
    if (ctx.taskId) {
      if (stdout) {
        ctx.tasks.appendOutput(ctx.taskId, `📤 STDOUT (${stdout.length} bytes):\n${stdout}\n`);
      }
      if (stderr) {
        ctx.tasks.appendOutput(ctx.taskId, `📤 STDERR (${stderr.length} bytes):\n${stderr}\n`);
      }
      ctx.tasks.appendOutput(ctx.taskId, `✅ Completed in ${duration}ms (code: ${code})\n`);
    }
    
    // 返回结果
    return { stdout, stderr, code };
  },
});

// 需要 path 模块
import * as path from 'path';
