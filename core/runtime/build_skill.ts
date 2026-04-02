/**
 * buildSkill - 统一技能工厂
 * 
 * 所有 skill/tool 都通过此工厂定义，确保：
 * - 统一生命周期
 * - 统一权限逻辑
 * - 统一流式 UI
 * - 统一日志和 telemetry
 * - 统一中断与恢复
 * - 统一搜索、发现、调度
 */

export type SkillCategory =
  | 'fs'
  | 'exec'
  | 'search'
  | 'task'
  | 'memory'
  | 'agent'
  | 'workflow'
  | 'meta'
  | 'mcp';

export type SkillPolicy = {
  /** 只读操作，不修改任何状态 */
  readOnly?: boolean;
  /** 破坏性操作（删除/覆盖等） */
  destructive?: boolean;
  /** 需要用户审批 */
  requiresApproval?: boolean;
  /** 支持流式输出 */
  supportsStreaming?: boolean;
  /** 并发安全 */
  concurrencySafe?: boolean;
  /** 超时时间（毫秒） */
  timeoutMs?: number;
};

export type SkillDef<TInput = any, TOutput = any> = {
  /** 技能名称，如 "fs.read" */
  name: string;
  /** 技能描述 */
  description: string;
  /** 技能分类 */
  category: SkillCategory;
  /** 输入 Schema (zod 或其他) */
  inputSchema: unknown;
  /** 输出 Schema (可选) */
  outputSchema?: unknown;
  /** 标签，用于搜索 */
  tags?: string[];
  /** 搜索提示 */
  searchHint?: string;
  /** 策略配置 */
  policy?: SkillPolicy;
  /** 执行函数 */
  handler: (ctx: ExecutionContext, input: TInput) => Promise<TOutput>;
};

export type Skill<TInput = any, TOutput = any> = SkillDef<TInput, TOutput> & {
  kind: 'skill';
};

/**
 * 统一技能工厂
 * 
 * @example
 * export const readFileSkill = buildSkill({
 *   name: 'fs.read',
 *   description: 'Read file from workspace',
 *   category: 'fs',
 *   inputSchema: z.object({ path: z.string() }),
 *   policy: {
 *     readOnly: true,
 *     destructive: false,
 *     requiresApproval: false,
 *     timeoutMs: 10_000,
 *   },
 *   async handler(ctx, input) {
 *     return await ctx.fs.readFile(input.path);
 *   },
 * });
 */
export function buildSkill<TInput, TOutput>(
  def: SkillDef<TInput, TOutput>,
): Skill<TInput, TOutput> {
  return {
    kind: 'skill' as const,
    tags: def.tags ?? [],
    policy: {
      readOnly: false,
      destructive: false,
      requiresApproval: false,
      supportsStreaming: false,
      concurrencySafe: true,
      timeoutMs: 30000,
      ...def.policy,
    },
    ...def,
  };
}

// ============================================================================
// ExecutionContext 类型定义（完整定义在 execution_context.ts）
// ============================================================================

export type ExecutionContext = {
  sessionId: string;
  turnId: string;
  taskId?: string;
  agentId: string;
  workspaceRoot: string;
  cwd: string;
  abortController: AbortController;
  signal: AbortSignal;
  logger: Logger;
  emit: (event: RuntimeEvent) => void;
  state: RuntimeStateFacade;
  permissions: PermissionEngine;
  tasks: TaskStore;
  memory: MemoryFacade;
  fs: WorkspaceFS;
  exec: ExecFacade;
  ui?: UIBridge;
  mcp?: MCPRegistry;
  requestApproval: (req: ApprovalRequest) => Promise<ApprovalDecision>;
  appendSystemNote: (note: string) => void;
};

// ============================================================================
// 依赖类型（完整定义在各自模块）
// ============================================================================

export type Logger = {
  debug: (msg: string, meta?: any) => void;
  info: (msg: string, meta?: any) => void;
  warn: (msg: string, meta?: any) => void;
  error: (msg: string, meta?: any) => void;
};

export type RuntimeEvent = any; // 完整定义在 hook_types.ts

export type RuntimeStateFacade = any; // 完整定义在 runtime_state.ts

export type PermissionEngine = any; // 完整定义在 permission_engine.ts

export type TaskStore = any; // 完整定义在 task_store.ts

export type MemoryFacade = any; // 完整定义在 memory_types.ts

export type WorkspaceFS = any; // 完整定义在 workspace_fs.ts

export type ExecFacade = any;

export type UIBridge = any; // 完整定义在 telegram_bridge.ts

export type MCPRegistry = any; // 完整定义在 mcp_registry.ts

export type ApprovalRequest = {
  id: string;
  sessionId: string;
  taskId?: string;
  tool: string;
  summary: string;
  risk: 'low' | 'medium' | 'high';
  payload?: Record<string, unknown>;
  expiresAt?: number;
};

export type ApprovalDecision = {
  requestId: string;
  approved: boolean;
  reason?: string;
  approvedAt: number;
  approvedBy: string;
};
