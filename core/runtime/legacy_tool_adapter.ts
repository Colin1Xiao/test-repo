/**
 * Legacy Tool Adapter - 旧工具适配器
 * 
 * 把旧工具包装成新 skill，入口接到新 runtime。
 * 不要求一次性重写全部内部实现，先接管生命周期。
 * 
 * 用途：
 * - 旧工具继续跑内部逻辑
 * - 新 runtime 接管权限/任务/hooks
 * - 逐步迁移，避免大停工
 */

import { buildSkill, Skill, ExecutionContext } from './build_skill';
import { PermissionEngine } from './permission_engine';
import { TaskStore } from './task_store';
import { HookBus } from './hook_bus';

/** 旧工具处理器签名 */
export type LegacyToolHandler<TInput = any, TOutput = any> = (
  input: TInput,
  options?: LegacyToolOptions,
) => Promise<TOutput>;

/** 旧工具选项 */
export interface LegacyToolOptions {
  sessionId?: string;
  workspaceRoot?: string;
  cwd?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

/** 旧工具配置 */
export interface LegacyToolConfig<TInput = any, TOutput = any> {
  /** 工具名称 */
  name: string;
  /** 工具描述 */
  description: string;
  /** 工具分类 */
  category: 'fs' | 'exec' | 'search' | 'task' | 'memory' | 'mcp' | 'other';
  /** 旧处理器 */
  handler: LegacyToolHandler<TInput, TOutput>;
  /** 是否只读 */
  readOnly?: boolean;
  /** 是否破坏性 */
  destructive?: boolean;
  /** 需要审批 */
  requiresApproval?: boolean;
  /** 输入验证函数 */
  validateInput?: (input: TInput) => boolean;
  /** 输入错误提示 */
  inputErrorMessage?: string;
}

/**
 * 将旧工具适配为新 skill
 * 
 * @param config 旧工具配置
 * @returns 新 skill 对象
 * 
 * @example
 * const legacyReadFile = adaptLegacyTool({
 *   name: 'fs.read',
 *   description: 'Read file from workspace',
 *   category: 'fs',
 *   readOnly: true,
 *   async handler(input: { path: string }) {
 *     // 旧实现
 *     return fs.readFileSync(input.path, 'utf-8');
 *   },
 * });
 * 
 * registry.register(legacyReadFile);
 */
export function adaptLegacyTool<TInput = any, TOutput = any>(
  config: LegacyToolConfig<TInput, TOutput>,
): Skill<TInput, TOutput> {
  return buildSkill({
    name: config.name,
    description: config.description,
    category: config.category,
    inputSchema: {}, // 旧工具可能没有 schema
    policy: {
      readOnly: config.readOnly ?? false,
      destructive: config.destructive ?? false,
      requiresApproval: config.requiresApproval ?? false,
      timeoutMs: 60000,
    },
    async handler(ctx: ExecutionContext, input: TInput): Promise<TOutput> {
      // 1. 输入验证
      if (config.validateInput && !config.validateInput(input)) {
        throw new Error(config.inputErrorMessage ?? 'Invalid input');
      }
      
      // 2. 检查中止
      if (ctx.signal.aborted) {
        throw new Error(`Execution aborted: ${ctx.signal.reason}`);
      }
      
      // 3. 调用旧处理器，传入适配选项
      const options: LegacyToolOptions = {
        sessionId: ctx.sessionId,
        workspaceRoot: ctx.workspaceRoot,
        cwd: ctx.cwd,
        timeoutMs: ctx.abortController.signal.aborted ? 0 : 60000,
        signal: ctx.signal,
      };
      
      try {
        const result = await config.handler(input, options);
        return result;
      } catch (error) {
        // 包装错误信息
        if (error instanceof Error) {
          error.message = `[${config.name}] ${error.message}`;
        }
        throw error;
      }
    },
  });
}

/**
 * 批量适配旧工具
 */
export function adaptLegacyTools(
  tools: Array<LegacyToolConfig>,
): Skill[] {
  return tools.map(adaptLegacyTool);
}

// ============================================================================
// 预置适配器：常见旧工具类型
// ============================================================================

/**
 * 文件系统工具适配器
 */
export function adaptFsTool<TInput = any, TOutput = any>(
  config: Omit<LegacyToolConfig<TInput, TOutput>, 'category' | 'readOnly' | 'destructive'>,
): Skill<TInput, TOutput> {
  return adaptLegacyTool({
    ...config,
    category: 'fs',
    readOnly: !config.name.includes('write') && !config.name.includes('delete'),
    destructive: config.name.includes('delete') || config.name.includes('remove'),
  });
}

/**
 * 执行工具适配器
 */
export function adaptExecTool<TInput = any, TOutput = any>(
  config: Omit<LegacyToolConfig<TInput, TOutput>, 'category' | 'requiresApproval'>,
): Skill<TInput, TOutput> {
  return adaptLegacyTool({
    ...config,
    category: 'exec',
    requiresApproval: true, // exec 默认需要审批
  });
}

/**
 * 搜索工具适配器
 */
export function adaptSearchTool<TInput = any, TOutput = any>(
  config: Omit<LegacyToolConfig<TInput, TOutput>, 'category' | 'readOnly'>,
): Skill<TInput, TOutput> {
  return adaptLegacyTool({
    ...config,
    category: 'search',
    readOnly: true,
  });
}

/**
 * 任务工具适配器
 */
export function adaptTaskTool<TInput = any, TOutput = any>(
  config: Omit<LegacyToolConfig<TInput, TOutput>, 'category' | 'readOnly'>,
): Skill<TInput, TOutput> {
  return adaptLegacyTool({
    ...config,
    category: 'task',
    readOnly: true,
  });
}

// ============================================================================
// 使用示例：迁移现有工具
// ============================================================================

/**
 * 示例：迁移旧的 fs.read 实现
 * 
 * // 假设这是旧代码
 * async function oldFsReadFile(input: { path: string }, options?: LegacyToolOptions) {
 *   const fullPath = path.join(options?.workspaceRoot ?? '', input.path);
 *   return fs.readFileSync(fullPath, 'utf-8');
 * }
 * 
 * // 适配为新 skill
 * const fsReadSkill = adaptFsTool({
 *   name: 'fs.read',
 *   description: 'Read file content',
 *   handler: oldFsReadFile,
 *   validateInput: (input) => {
 *     return typeof input.path === 'string' && input.path.length > 0;
 *   },
 *   inputErrorMessage: 'Invalid path: must be a non-empty string',
 * });
 * 
 * registry.register(fsReadSkill);
 */

/**
 * 示例：迁移旧的 exec.run 实现
 * 
 * // 假设这是旧代码
 * async function oldExecRun(input: { command: string }, options?: LegacyToolOptions) {
 *   const { exec } = require('child_process');
 *   return new Promise((resolve, reject) => {
 *     exec(input.command, {
 *       cwd: options?.cwd,
 *       timeout: options?.timeoutMs,
 *       signal: options?.signal,
 *     }, (error, stdout, stderr) => {
 *       if (error) reject(error);
 *       else resolve({ stdout, stderr, code: 0 });
 *     });
 *   });
 * }
 * 
 * // 适配为新 skill
 * const execRunSkill = adaptExecTool({
 *   name: 'exec.run',
 *   description: 'Execute shell command',
 *   handler: oldExecRun,
 * });
 * 
 * registry.register(execRunSkill);
 */
