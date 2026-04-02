/**
 * OpenClaw Runtime Core
 * 
 * Agent Runtime OS 核心模块
 * 
 * @module @openclaw/runtime
 * @version 0.1.0
 * @build 2026-04-03
 */

// ============================================================================
// 技能工厂
// ============================================================================
export {
  buildSkill,
  type Skill,
  type SkillDef,
  type SkillCategory,
  type SkillPolicy,
  type ExecutionContext,
} from './build_skill';

// ============================================================================
// 工具注册表
// ============================================================================
export {
  ToolRegistry,
  type ToolRegistryConfig,
  type SearchMatch,
  ApprovalRequiredError,
} from './tool_registry';

// ============================================================================
// 执行上下文
// ============================================================================
export {
  ExecutionContextImpl,
  createExecutionContext,
  type Logger,
  type ApprovalRequest,
  type ApprovalDecision,
  type RuntimeStateFacade,
  type MemoryFacade,
  type WorkspaceFS,
  type ExecFacade,
  type UIBridge,
  type MCPRegistry,
} from './execution_context';

// ============================================================================
// 权限引擎
// ============================================================================
export {
  PermissionEngine,
} from './permission_engine';

export {
  type PermissionRule,
  type PermissionCheckInput,
  type PermissionDecision,
  type PermissionBehavior,
  type PermissionSource,
  DANGEROUS_PATTERNS,
  DEFAULT_SYSTEM_RULES,
  SOURCE_PRIORITY,
} from './permission_types';

// ============================================================================
// 状态机
// ============================================================================
export {
  QueryGuard,
  type QueryState,
} from './query_guard';

// ============================================================================
// 任务系统
// ============================================================================
export {
  TaskStore,
  type ITaskStore,
  type TaskStoreConfig,
  type TaskFilter,
} from './task_store';

export {
  RuntimeTask,
  TaskType,
  TaskStatus,
  TASK_PREFIX,
  generateTaskId,
  parseTaskType,
  createTask,
  isValidTransition,
  VALID_TRANSITIONS,
} from './task_model';

// ============================================================================
// Hook 总线
// ============================================================================
export {
  HookBus,
} from './hook_bus';

export {
  type RuntimeEvent,
  type HookHandler,
  type HookConfig,
  type HookPriority,
} from './hook_types';

// ============================================================================
// 任务输出存储
// ============================================================================
export {
  TaskOutputStore,
  type TaskOutputStoreConfig,
} from './task_output_store';

// ============================================================================
// 旧工具适配器
// ============================================================================
export {
  adaptLegacyTool,
  adaptLegacyTools,
  adaptFsTool,
  adaptExecTool,
  adaptSearchTool,
  adaptTaskTool,
  type LegacyToolHandler,
  type LegacyToolConfig,
  type LegacyToolOptions,
} from './legacy_tool_adapter';

// ============================================================================
// 核心技能集合
// ============================================================================
export {
  registerCoreSkills,
  fsReadSkill,
  fsWriteSkill,
  execRunSkill,
  grepSearchSkill,
  taskListSkill,
  taskOutputSkill,
} from './skills';

// ============================================================================
// 版本信息
// ============================================================================
export const RUNTIME_VERSION = '0.1.0';
export const RUNTIME_BUILD_DATE = '2026-04-03';

// ============================================================================
// 快速创建 Runtime 实例
// ============================================================================
import { ToolRegistry } from './tool_registry';
import { PermissionEngine } from './permission_engine';
import { TaskStore } from './task_store';
import { HookBus } from './hook_bus';
import { QueryGuard } from './query_guard';
import { TaskOutputStore } from './task_output_store';

export interface RuntimeInstance {
  registry: ToolRegistry;
  permissions: PermissionEngine;
  tasks: TaskStore;
  hooks: HookBus;
  guard: QueryGuard;
  outputStore: TaskOutputStore;
}

/**
 * 创建 Runtime 实例（快速初始化）
 */
export function createRuntime(options?: {
  taskPersistPath?: string;
  outputStoreRoot?: string;
}): RuntimeInstance {
  const permissions = new PermissionEngine();
  const tasks = new TaskStore({ persistPath: options?.taskPersistPath });
  const hooks = new HookBus();
  const guard = new QueryGuard();
  const registry = new ToolRegistry({ permissions, tasks, hooks, guard });
  const outputStore = new TaskOutputStore({ rootDir: options?.outputStoreRoot });
  
  // 注册核心技能
  registerCoreSkills(registry);
  
  return { registry, permissions, tasks, hooks, guard, outputStore };
}
