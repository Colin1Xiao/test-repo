# Claude Code 架构分析报告

> 分析范围：`/Users/colin/Downloads/claude-code-main-extracted/claude-code-main/src`  
> 分析目标：提取可用于升级 OpenClaw 的关键设计模式

---

## 目录

1. [工具系统架构](#1-工具系统架构)
2. [会话/任务管理](#2-会话任务管理)
3. [权限系统](#3-权限系统)
4. [插件系统](#4-插件系统)
5. [Hooks 系统](#5-hooks 系统)
6. [MCP 集成](#6-mcp 集成)
7. [记忆系统](#7-记忆系统)
8. [状态管理](#8-状态管理)
9. [服务层架构](#9-服务层架构)
10. [工具执行引擎](#10-工具执行引擎)
11. [最值得借鉴的设计](#11-最值得借鉴的设计)
12. [OpenClaw 升级建议](#12-openclaw-升级建议)

---

## 1. 工具系统架构

### 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         tools.ts                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  getAllBaseTools() → Tool[]                               │  │
│  │  getTools(permissionContext) → Tools                      │  │
│  │  assembleToolPool(permissionContext, mcpTools) → Tools    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Tool.ts                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Tool<Input, Output, Progress>                            │  │
│  │  ├── call(args, context, canUseTool, onProgress)          │  │
│  │  ├── description(input, options)                          │  │
│  │  ├── checkPermissions(input, context)                     │  │
│  │  ├── validateInput(input, context)                        │  │
│  │  ├── renderToolUseMessage(input, options)                 │  │
│  │  ├── renderToolResultMessage(content, options)            │  │
│  │  ├── isConcurrencySafe(input)                             │  │
│  │  ├── isReadOnly(input)                                    │  │
│  │  ├── isDestructive(input)                                 │  │
│  │  └── buildTool(def) → Tool (带默认值的工厂函数)            │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      tools/*.ts (45+ 工具)                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐ │
│  │ BashTool    │ │ FileRead    │ │ FileEdit    │ │ GrepTool  │ │
│  │ 160KB       │ │ Tool        │ │ Tool        │ │           │ │
│  │             │ │             │ │             │ │           │ │
│  │ - prompt.ts │ │ - prompt.ts │ │ - types.ts  │ │ - prompt  │ │
│  │ - UI.tsx    │ │ - UI.tsx    │ │ - utils.ts  │ │           │ │
│  │ - security  │ │             │ │             │ │           │ │
│  │ - perms     │ │             │ │             │ │           │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 关键文件

| 文件 | 大小 | 职责 |
|------|------|------|
| `src/Tool.ts` | 29KB | 工具类型定义、`buildTool` 工厂、工具上下文 |
| `src/tools.ts` | 17KB | 工具注册表、工具池组装、权限过滤 |
| `src/tools/BashTool/BashTool.tsx` | 160KB | Bash 工具完整实现 |
| `src/tools/FileEditTool/FileEditTool.ts` | 20KB | 文件编辑工具 |
| `src/services/tools/toolExecution.ts` | 60KB | 工具执行引擎 |

### 核心模式

#### 1.1 工具定义接口 (`Tool<T>`)

```typescript
export type Tool<Input, Output, Progress> = {
  // 核心执行
  call(args, context, canUseTool, onProgress): Promise<ToolResult<Output>>
  
  // 权限与安全
  checkPermissions(input, context): Promise<PermissionResult>
  validateInput(input, context): Promise<ValidationResult>
  isConcurrencySafe(input): boolean
  isReadOnly(input): boolean
  isDestructive(input): boolean
  
  // UI 渲染
  renderToolUseMessage(input, options): ReactNode
  renderToolResultMessage(content, options): ReactNode
  renderToolUseProgressMessage(progress, options): ReactNode
  
  // 元数据
  description(input, options): Promise<string>
  userFacingName(input): string
  getActivityDescription(input): string | null
  
  // 可选扩展
  interruptBehavior?(): 'cancel' | 'block'
  isSearchOrReadCommand?(input): { isSearch, isRead, isList }
  getPath?(input): string
  preparePermissionMatcher?(input): (pattern) => boolean
}
```

#### 1.2 `buildTool` 工厂模式

```typescript
const TOOL_DEFAULTS = {
  isEnabled: () => true,
  isConcurrencySafe: () => false,
  isReadOnly: () => false,
  isDestructive: () => false,
  checkPermissions: (input) => Promise.resolve({ behavior: 'allow', updatedInput: input }),
  toAutoClassifierInput: () => '',
  userFacingName: () => '',
}

export function buildTool<D extends AnyToolDef>(def: D): BuiltTool<D> {
  return {
    ...TOOL_DEFAULTS,
    userFacingName: () => def.name,
    ...def,
  } as BuiltTool<D>
}
```

**优势：**
- 所有工具共享默认实现，减少样板代码
- 类型安全：`BuiltTool<D>` 保留输入定义的精确类型
- 集中管理默认行为，易于全局修改

#### 1.3 工具上下文 (`ToolUseContext`)

```typescript
export type ToolUseContext = {
  options: {
    commands: Command[]
    tools: Tools
    mcpClients: MCPServerConnection[]
    debug: boolean
    verbose: boolean
  }
  abortController: AbortController
  getAppState(): AppState
  setAppState(f: (prev: AppState) => AppState): void
  setAppStateForTasks?: (f: (prev: AppState) => AppState) => void  // 跨任务共享
  setToolJSX?: (args) => void
  addNotification?: (notif: Notification) => void
  readFileState: FileStateCache
  // ... 30+ 个可选回调
}
```

#### 1.4 工具池组装

```typescript
export function assembleToolPool(
  permissionContext: ToolPermissionContext,
  mcpTools: Tools,
): Tools {
  const builtInTools = getTools(permissionContext)
  const allowedMcpTools = filterToolsByDenyRules(mcpTools, permissionContext)
  
  // 按名称排序保证 prompt 缓存稳定性
  const byName = (a, b) => a.name.localeCompare(b.name)
  return uniqBy(
    [...builtInTools].sort(byName).concat(allowedMcpTools.sort(byName)),
    'name',
  )
}
```

---

## 2. 会话/任务管理

### 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        tasks.ts                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  getAllTasks() → Task[]                                   │  │
│  │  getTaskByType(type) → Task                               │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Task.ts                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  TaskType: 'local_bash' | 'local_agent' | 'remote_agent'  │  │
│  │           | 'in_process_teammate' | 'local_workflow'      │  │
│  │                                                           │  │
│  │  TaskStatus: 'pending' | 'running' | 'completed'          │  │
│  │              | 'failed' | 'killed'                        │  │
│  │                                                           │  │
│  │  Task = {                                                 │  │
│  │    name: string                                           │  │
│  │    type: TaskType                                         │  │
│  │    kill(taskId, setAppState): Promise<void>               │  │
│  │  }                                                        │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    tasks/*.ts (6 种任务类型)                      │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────────────┐ │
│  │ LocalShellTask│ │ LocalAgentTask│ │ RemoteAgentTask       │ │
│  │               │ │               │ │                       │ │
│  │ - spawn       │ │ - create      │ │ - connect             │ │
│  │ - kill        │ │ - subagent    │ │ - stream              │ │
│  │ - output      │ │ - context     │ │ - cleanup             │ │
│  └───────────────┘ └───────────────┘ └───────────────────────┘ │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────────────┐ │
│  │DreamTask      │ │LocalWorkflow  │ │ MonitorMcpTask        │ │
│  │               │ │               │ │                       │ │
│  │ - background  │ │ - script      │ │ - monitoring          │ │
│  │ - async       │ │ - bundled     │ │ - alerts              │ │
│  └───────────────┘ └───────────────┘ └───────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 关键文件

| 文件 | 大小 | 职责 |
|------|------|------|
| `src/Task.ts` | 3KB | 任务类型定义、状态机、ID 生成 |
| `src/tasks.ts` | 1KB | 任务注册表 |
| `src/tasks/LocalShellTask/` | - | 本地 Shell 任务实现 |
| `src/tasks/LocalAgentTask/` | - | 本地子代理任务 |
| `src/tasks/LocalMainSessionTask.ts` | 15KB | 主会话任务逻辑 |

### 核心模式

#### 2.1 任务状态机

```typescript
export type TaskStatus =
  | 'pending'      // 已创建，未开始
  | 'running'      // 执行中
  | 'completed'    // 成功完成
  | 'failed'       // 执行失败
  | 'killed'       // 被用户终止

export function isTerminalTaskStatus(status: TaskStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'killed'
}
```

#### 2.2 任务 ID 生成

```typescript
const TASK_ID_PREFIXES: Record<TaskType, string> = {
  local_bash: 'b',
  local_agent: 'a',
  remote_agent: 'r',
  in_process_teammate: 't',
  local_workflow: 'w',
  monitor_mcp: 'm',
  dream: 'd',
}

export function generateTaskId(type: TaskType): string {
  const prefix = getTaskIdPrefix(type)
  const bytes = randomBytes(8)
  let id = prefix
  for (let i = 0; i < 8; i++) {
    id += TASK_ID_ALPHABET[bytes[i]! % TASK_ID_ALPHABET.length]
  }
  return id  // 例如：a1x9k2m4p
}
```

#### 2.3 任务上下文

```typescript
export type TaskContext = {
  abortController: AbortController
  getAppState: () => AppState
  setAppState: SetAppState
}

export type TaskStateBase = {
  id: string
  type: TaskType
  status: TaskStatus
  description: string
  toolUseId?: string
  startTime: number
  endTime?: number
  totalPausedMs?: number
  outputFile: string
  outputOffset: number
  notified: boolean
}
```

---

## 3. 权限系统

### 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                   types/permissions.ts                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  PermissionMode: 'default' | 'bypassPermissions'          │  │
│  │                  | 'acceptEdits' | 'plan' | 'dontAsk'     │  │
│  │                                                           │  │
│  │  PermissionBehavior: 'allow' | 'deny' | 'ask'             │  │
│  │                                                           │  │
│  │  PermissionRule = {                                       │  │
│  │    source: PermissionRuleSource                           │  │
│  │    ruleBehavior: PermissionBehavior                       │  │
│  │    ruleValue: { toolName, ruleContent? }                  │  │
│  │  }                                                        │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              utils/permissions/permissions.ts                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  checkPermission(tool, input, context)                    │  │
│  │  getDenyRuleForTool(permissionContext, tool)              │  │
│  │  getAllowRuleForTool(permissionContext, tool)             │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              utils/permissions/permissionRuleParser.ts           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  parsePermissionRule(ruleString) → PermissionRule         │  │
│  │  matchRule(rule, toolInput) → boolean                     │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 关键文件

| 文件 | 大小 | 职责 |
|------|------|------|
| `src/types/permissions.ts` | 12KB | 权限类型定义（纯类型，无运行时依赖） |
| `src/utils/permissions/permissions.ts` | - | 权限检查核心逻辑 |
| `src/utils/permissions/permissionRuleParser.ts` | - | 规则解析 |
| `src/utils/permissions/permissionsLoader.ts` | - | 权限配置加载 |
| `src/hooks/toolPermission/permissionLogging.ts` | - | 权限决策日志 |

### 核心模式

#### 3.1 权限模式

```typescript
export const PERMISSION_MODES = [
  'acceptEdits',        // 只接受编辑操作
  'bypassPermissions',  // 跳过权限检查
  'default',            // 默认模式
  'dontAsk',            // 不询问（自动拒绝危险操作）
  'plan',               // 计划模式
  'auto',               // 自动模式（使用分类器）
] as const
```

#### 3.2 权限规则来源

```typescript
export type PermissionRuleSource =
  | 'userSettings'      // 用户全局设置
  | 'projectSettings'   // 项目级设置
  | 'localSettings'     // 本地设置
  | 'flagSettings'      // 功能标志
  | 'policySettings'    // 策略设置
  | 'cliArg'            // CLI 参数
  | 'command'           // 命令
  | 'session'           // 会话级（临时）
```

#### 3.3 权限决策结果

```typescript
export type PermissionResult<Input> =
  | PermissionAllowDecision<Input>   // { behavior: 'allow', updatedInput? }
  | PermissionAskDecision<Input>     // { behavior: 'ask', message, suggestions? }
  | PermissionDenyDecision           // { behavior: 'deny', message, decisionReason }
  | {
      behavior: 'passthrough'
      message: string
      pendingClassifierCheck?: PendingClassifierCheck
    }
```

#### 3.4 权限决策原因

```typescript
export type PermissionDecisionReason =
  | { type: 'rule'; rule: PermissionRule }
  | { type: 'mode'; mode: PermissionMode }
  | { type: 'hook'; hookName: string; reason?: string }
  | { type: 'classifier'; classifier: string; reason: string }
  | { type: 'workingDir'; reason: string }
  | { type: 'safetyCheck'; reason: string; classifierApprovable: boolean }
  | { type: 'other'; reason: string }
```

#### 3.5 权限上下文

```typescript
export type ToolPermissionContext = {
  readonly mode: PermissionMode
  readonly additionalWorkingDirectories: ReadonlyMap<string, AdditionalWorkingDirectory>
  readonly alwaysAllowRules: ToolPermissionRulesBySource
  readonly alwaysDenyRules: ToolPermissionRulesBySource
  readonly alwaysAskRules: ToolPermissionRulesBySource
  readonly isBypassPermissionsModeAvailable: boolean
  readonly shouldAvoidPermissionPrompts?: boolean
  readonly awaitAutomatedChecksBeforeDialog?: boolean
}
```

---

## 4. 插件系统

### 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                   plugins/builtinPlugins.ts                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  BUILTIN_PLUGINS: Map<string, BuiltinPluginDefinition>    │  │
│  │                                                           │  │
│  │  registerBuiltinPlugin(definition)                        │  │
│  │  getBuiltinPlugins() → { enabled, disabled }              │  │
│  │  getBuiltinPluginSkillCommands() → Command[]              │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    services/plugins/                             │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  LoadedPlugin = {                                         │  │
│  │    name: string                                           │  │
│  │    manifest: { name, description, version }               │  │
│  │    path: string                                           │  │
│  │    source: string  // "{name}@builtin" or "{name}@{mp}"   │  │
│  │    enabled: boolean                                       │  │
│  │    hooksConfig?: HooksConfig                              │  │
│  │    mcpServers?: MCPServerConfig[]                         │  │
│  │  }                                                        │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 关键文件

| 文件 | 大小 | 职责 |
|------|------|------|
| `src/plugins/builtinPlugins.ts` | 5KB | 内置插件注册表 |
| `src/services/plugins/` | - | 插件服务 |
| `src/types/plugin.ts` | - | 插件类型定义 |

### 核心模式

#### 4.1 插件定义

```typescript
export type BuiltinPluginDefinition = {
  name: string
  description: string
  version: string
  defaultEnabled?: boolean
  isAvailable?: () => boolean
  skills?: BundledSkillDefinition[]
  hooks?: HooksConfig
  mcpServers?: MCPServerConfig[]
}
```

#### 4.2 插件 ID 格式

```typescript
// 内置插件：{name}@builtin
// 市场插件：{name}@{marketplace}

export function isBuiltinPluginId(pluginId: string): boolean {
  return pluginId.endsWith(`@builtin`)
}
```

#### 4.3 插件加载

```typescript
export function getBuiltinPlugins(): {
  enabled: LoadedPlugin[]
  disabled: LoadedPlugin[]
} {
  const settings = getSettings_DEPRECATED()
  
  for (const [name, definition] of BUILTIN_PLUGINS) {
    const pluginId = `${name}@builtin`
    const userSetting = settings?.enabledPlugins?.[pluginId]
    const isEnabled = userSetting !== undefined
      ? userSetting === true
      : (definition.defaultEnabled ?? true)
    
    // ... 构建 LoadedPlugin 对象
  }
}
```

---

## 5. Hooks 系统

### 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                       hooks/ (87 个 hooks)                       │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ useAppState()   │  │ useCanUseTool() │  │ useMergedTools()│ │
│  │ 状态订阅        │  │ 工具权限检查    │  │ 工具合并        │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ useReplBridge() │  │ useInboxPoller()│  │ useTaskListWatcher││
│  │ REPL 桥接       │  │ 收件箱轮询      │  │ 任务列表监听    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ toolPermission/ │  │ notifs/         │  │ useVoice.ts     │ │
│  │ 权限相关        │  │ 通知相关        │  │ 语音集成        │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 关键文件

| 文件 | 大小 | 职责 |
|------|------|------|
| `src/hooks/useAppState.tsx` | 8KB | 状态订阅 hook |
| `src/hooks/useCanUseTool.tsx` | 40KB | 工具权限检查 |
| `src/hooks/useReplBridge.tsx` | 115KB | REPL 桥接逻辑 |
| `src/hooks/useInboxPoller.ts` | 34KB | 收件箱轮询 |
| `src/hooks/useMergedTools.ts` | 1.6KB | 工具合并 |

### 核心模式

#### 5.1 状态订阅 Hook

```typescript
export function useAppState<T>(selector: (state: AppState) => T): T {
  const store = useAppStore()
  
  const get = () => {
    const state = store.getState()
    const selected = selector(state)
    return selected
  }
  
  return useSyncExternalStore(store.subscribe, get, get)
}

// 使用示例
const verbose = useAppState(s => s.verbose)
const model = useAppState(s => s.mainLoopModel)
```

#### 5.2 工具权限检查 Hook

```typescript
export function useCanUseTool(): CanUseToolFn {
  const { toolPermissionContext, alwaysAllowHooks } = useAppState(
    s => ({
      toolPermissionContext: s.toolPermissionContext,
      alwaysAllowHooks: s.alwaysAllowHooks,
    })
  )
  
  return useCallback(async (tool, input) => {
    // 1. 检查 always allow hooks
    for (const hook of alwaysAllowHooks) {
      if (await hook.canAutoApprove(tool, input)) {
        return { allowed: true, reason: 'hook' }
      }
    }
    
    // 2. 检查权限上下文
    const result = await checkPermission(tool, input, toolPermissionContext)
    
    return {
      allowed: result.behavior !== 'deny',
      reason: result.behavior,
      message: result.message,
    }
  }, [toolPermissionContext, alwaysAllowHooks])
}
```

#### 5.3 工具合并 Hook

```typescript
export function useMergedTools(): Tools {
  const permissionContext = useAppState(s => s.toolPermissionContext)
  const mcpTools = useAppState(s => s.mcp.tools)
  
  return useMemo(() => {
    return assembleToolPool(permissionContext, mcpTools)
  }, [permissionContext, mcpTools])
}
```

---

## 6. MCP 集成

### 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                    services/mcp/                                 │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  MCPConnectionManager                                     │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │  - connect(serverConfig) → MCPServerConnection      │  │ │
│  │  │  - disconnect(serverName)                           │  │ │
│  │  │  - listTools(serverName) → Tool[]                   │  │ │
│  │  │  - callTool(serverName, toolName, args) → Result    │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────────────┐ │
│  │ client.ts     │ │ auth.ts       │ │ config.ts             │ │
│  │ 88KB          │ │ 88KB          │ │ 51KB                  │ │
│  │ MCP 客户端    │ │ OAuth 认证    │ │ 服务器配置            │ │
│  └───────────────┘ └───────────────┘ └───────────────────────┘ │
│                                                                  │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────────────┐ │
│  │ types.ts      │ │ utils.ts      │ │ normalization.ts      │ │
│  │ 类型定义      │ │ 工具函数      │ │ 名称规范化            │ │
│  └───────────────┘ └───────────────┘ └───────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 关键文件

| 文件 | 大小 | 职责 |
|------|------|------|
| `src/services/mcp/client.ts` | 88KB | MCP 客户端实现 |
| `src/services/mcp/auth.ts` | 88KB | OAuth 认证流程 |
| `src/services/mcp/config.ts` | 51KB | 服务器配置管理 |
| `src/services/mcp/MCPConnectionManager.tsx` | 8KB | 连接管理器 |
| `src/services/mcp/types.ts` | 7KB | 类型定义 |

### 核心模式

#### 6.1 MCP 服务器连接

```typescript
export type MCPServerConnection = {
  name: string
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
  transport: 'stdio' | 'sse' | 'http' | 'ws' | 'sdk'
  tools: Tool[]
  resources: ServerResource[]
  error?: string
}
```

#### 6.2 MCP 工具命名

```typescript
// MCP 工具命名格式：mcp__{server}__{tool}
// 例如：mcp__slack__send_message

export function normalizeNameForMCP(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '_')
}

export function mcpInfoFromString(toolName: string): {
  serverName: string
  toolName: string
} | null {
  if (!toolName.startsWith('mcp__')) return null
  const parts = toolName.split('__')
  return { serverName: parts[1], toolName: parts[2] }
}
```

#### 6.3 MCP 工具调用

```typescript
export async function callMcpTool(
  client: MCPServerConnection,
  toolName: string,
  args: Record<string, unknown>,
  signal: AbortSignal,
): Promise<ToolResult<unknown>> {
  const mcpTool = client.tools.find(t => t.name === toolName)
  if (!mcpTool) {
    throw new Error(`MCP tool ${toolName} not found`)
  }
  
  const result = await client.transport.callTool({
    name: toolName,
    arguments: args,
  }, { signal })
  
  return {
    data: result.content,
    mcpMeta: result._meta,
  }
}
```

---

## 7. 记忆系统

### 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        memdir/                                   │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  memdir.ts                                                │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │  buildMemoryLines(displayName, memoryDir, options)  │  │ │
│  │  │  loadMemoryPrompt(memoryDir, options) → string      │  │ │
│  │  │  ensureMemoryDirExists(memoryDir)                   │  │ │
│  │  │  truncateEntrypointContent(raw) → EntrypointTrunc.  │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────────────┐ │
│  │ memoryTypes.ts│ │ paths.ts      │ │ findRelevantMemories  │ │
│  │ 22KB          │ │ 10KB          │ │ 5KB                   │ │
│  │ 记忆类型定义  │ │ 路径管理      │ │ 记忆检索              │ │
│  └───────────────┘ └───────────────┘ └───────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 关键文件

| 文件 | 大小 | 职责 |
|------|------|------|
| `src/memdir/memdir.ts` | 21KB | 记忆目录管理 |
| `src/memdir/memoryTypes.ts` | 22KB | 记忆类型定义 |
| `src/memdir/paths.ts` | 10KB | 记忆路径管理 |
| `src/memdir/findRelevantMemories.ts` | 5KB | 记忆检索 |

### 核心模式

#### 7.1 记忆入口点

```typescript
export const ENTRYPOINT_NAME = 'MEMORY.md'
export const MAX_ENTRYPOINT_LINES = 200
export const MAX_ENTRYPOINT_BYTES = 25_000

export function truncateEntrypointContent(raw: string): EntrypointTruncation {
  const trimmed = raw.trim()
  const contentLines = trimmed.split('\n')
  
  const wasLineTruncated = contentLines.length > MAX_ENTRYPOINT_LINES
  const wasByteTruncated = trimmed.length > MAX_ENTRYPOINT_BYTES
  
  // 先按行截断，再按字节截断（在最后一个换行处）
  let truncated = wasLineTruncated
    ? contentLines.slice(0, MAX_ENTRYPOINT_LINES).join('\n')
    : trimmed
  
  if (truncated.length > MAX_ENTRYPOINT_BYTES) {
    const cutAt = truncated.lastIndexOf('\n', MAX_ENTRYPOINT_BYTES)
    truncated = truncated.slice(0, cutAt > 0 ? cutAt : MAX_ENTRYPOINT_BYTES)
  }
  
  return {
    content: truncated + (wasLineTruncated || wasByteTruncated ? '\n\n> WARNING: ...' : ''),
    lineCount: contentLines.length,
    byteCount: trimmed.length,
    wasLineTruncated,
    wasByteTruncated,
  }
}
```

#### 7.2 记忆类型

```typescript
// 四种记忆类型
export const MEMORY_TYPES = [
  'user',       // 用户偏好、习惯
  'feedback',   // 用户反馈、纠正
  'project',    // 项目特定知识
  'reference',  // 参考资料
] as const
```

#### 7.3 记忆目录结构

```
~/.claude/projects/{project-slug}/memory/
├── MEMORY.md          # 入口点，包含索引和 behavioral instructions
├── user/              # 用户记忆
│   ├── preferences.md
│   └── habits.md
├── feedback/          # 反馈记忆
│   └── corrections.md
├── project/           # 项目记忆
│   └── architecture.md
└── reference/         # 参考资料
    └── api-notes.md
```

#### 7.4 记忆检索

```typescript
export async function findRelevantMemories(
  memoryDir: string,
  query: string,
  options: { limit?: number } = {},
): Promise<MemoryResult[]> {
  // 1. 读取 MEMORY.md 获取索引
  // 2. 使用 GrepTool 搜索相关文件
  // 3. 读取相关内容
  // 4. 按相关性排序返回
}
```

---

## 8. 状态管理

### 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         state/                                   │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  store.ts                                                 │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │  createStore<T>(initialState, onChange?) → Store<T> │  │ │
│  │  │                                                     │  │ │
│  │  │  Store<T> = {                                       │  │ │
│  │  │    getState: () => T                                │  │ │
│  │  │    setState: (updater: (prev: T) => T) => void      │  │ │
│  │  │    subscribe: (listener) => () => void              │  │ │
│  │  │  }                                                  │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  AppStateStore.ts (21KB)                                  │ │
│  │  AppState.tsx (23KB)                                      │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │  AppState = {                                       │  │ │
│  │  │    messages: Message[]                              │  │ │
│  │  │    tasks: Map<string, TaskState>                    │  │ │
│  │  │    tools: Tools                                     │  │ │
│  │  │    toolPermissionContext: ToolPermissionContext     │  │ │
│  │  │    mcp: { servers, tools, resources }               │  │ │
│  │  │    settings: Settings                               │  │ │
│  │  │    // ... 100+ 字段                                 │  │ │
│  │  │  }                                                  │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  AppStateProvider (React Context)                         │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │  useAppState(selector) → T                          │  │ │
│  │  │  useSetAppState() → setState                        │  │ │
│  │  │  useAppStateStore() → Store                         │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 关键文件

| 文件 | 大小 | 职责 |
|------|------|------|
| `src/state/store.ts` | 836B | 通用 Store 实现 |
| `src/state/AppStateStore.ts` | 21KB | AppState 存储逻辑 |
| `src/state/AppState.tsx` | 23KB | React Provider 和 Hooks |
| `src/state/selectors.ts` | 2KB | 状态选择器 |

### 核心模式

#### 8.1 通用 Store

```typescript
type Listener = () => void
type OnChange<T> = (args: { newState: T; oldState: T }) => void

export type Store<T> = {
  getState: () => T
  setState: (updater: (prev: T) => T) => void
  subscribe: (listener: Listener) => () => void
}

export function createStore<T>(
  initialState: T,
  onChange?: OnChange<T>,
): Store<T> {
  let state = initialState
  const listeners = new Set<Listener>()
  
  return {
    getState: () => state,
    
    setState: (updater: (prev: T) => T) => {
      const prev = state
      const next = updater(prev)
      if (Object.is(next, prev)) return
      state = next
      onChange?.({ newState: next, oldState: prev })
      for (const listener of listeners) listener()
    },
    
    subscribe: (listener: Listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
```

#### 8.2 React 集成

```typescript
// useAppState - 订阅状态切片
export function useAppState<T>(selector: (state: AppState) => T): T {
  const store = useAppStore()
  
  const get = () => selector(store.getState())
  return useSyncExternalStore(store.subscribe, get, get)
}

// useSetAppState - 获取 setState，不订阅
export function useSetAppState(): (
  updater: (prev: AppState) => AppState,
) => void {
  return useAppStore().setState
}

// useAppStateStore - 获取完整 store
export function useAppStateStore(): AppStateStore {
  return useAppStore()
}
```

#### 8.3 AppState 结构（部分）

```typescript
export type AppState = {
  // 消息
  messages: Message[]
  messageIndex: Map<string, number>
  
  // 任务
  tasks: Map<string, TaskState>
  activeTaskId?: string
  
  // 工具
  tools: Tools
  mcp: {
    servers: MCPServerConnection[]
    tools: Tool[]
    resources: ServerResource[]
  }
  
  // 权限
  toolPermissionContext: ToolPermissionContext
  alwaysAllowHooks: AlwaysAllowHook[]
  
  // 设置
  settings: Settings
  remoteSettings: RemoteSettings | null
  
  // UI
  verbose: boolean
  theme: ThemeName
  terminalSize: { columns: number; rows: number }
  
  // ... 100+ 字段
}
```

---

## 9. 服务层架构

### 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                       services/ (38 个子目录)                     │
│                                                                  │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────────────┐ │
│  │ analytics/    │ │ api/          │ │ compact/              │ │
│  │ 11 目录       │ │ 22 目录       │ │ 13 目录               │ │
│  │ 分析跟踪      │ │ API 客户端    │ │ 上下文压缩            │ │
│  └───────────────┘ └───────────────┘ └───────────────────────┘ │
│                                                                  │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────────────┐ │
│  │ mcp/          │ │ lsp/          │ │ tools/                │ │
│  │ 25 文件       │ │ 7 目录        │ │ 6 文件                │ │
│  │ MCP 集成      │ │ LSP 服务      │ │ 工具执行              │ │
│  └───────────────┘ └───────────────┘ └───────────────────────┘ │
│                                                                  │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────────────┐ │
│  │ oauth/        │ │ plugins/      │ │ teamMemorySync/       │ │
│  │ 7 目录        │ │ 5 目录        │ │ 7 目录                │ │
│  │ OAuth 流程    │ │ 插件管理      │ │ 团队记忆同步          │ │
│  └───────────────┘ └───────────────┘ └───────────────────────┘ │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 独立服务文件                                              │ │
│  │ - claudeAiLimits.ts (16KB)    - vcr.ts (12KB)             │ │
│  │ - diagnosticTracking.ts       - voice.ts (17KB)           │ │
│  │ - tokenEstimation.ts (16KB)   - notifier.ts (4KB)         │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 关键文件

| 文件/目录 | 大小 | 职责 |
|-----------|------|------|
| `src/services/tools/` | - | 工具执行服务 |
| `src/services/mcp/` | 25 文件 | MCP 集成 |
| `src/services/analytics/` | 11 目录 | 分析跟踪 |
| `src/services/api/` | 22 目录 | API 客户端 |
| `src/services/compact/` | 13 目录 | 上下文压缩 |

### 核心模式

#### 9.1 服务组织原则

1. **按功能域分组** - 每个服务目录代表一个功能域
2. **独立测试** - 服务可独立于 UI 测试
3. **依赖注入** - 服务通过上下文传递，不直接 import
4. **单一职责** - 每个服务文件聚焦单一职责

#### 9.2 工具执行服务

```typescript
// src/services/tools/toolExecution.ts
export async function executeTool(
  tool: Tool,
  input: unknown,
  context: ToolUseContext,
  canUseTool: CanUseToolFn,
  onProgress?: ToolCallProgress,
): Promise<ToolResult<unknown>> {
  // 1. 验证输入
  const validation = await tool.validateInput?.(input, context)
  if (validation?.result === false) {
    throw new Error(validation.message)
  }
  
  // 2. 检查权限
  const permission = await tool.checkPermissions(input, context)
  if (permission.behavior === 'deny') {
    throw new PermissionDeniedError(permission.message)
  }
  
  // 3. 执行工具
  const result = await tool.call(input, context, canUseTool, onProgress)
  
  // 4. 运行后置 hooks
  await runPostToolUseHooks(tool, input, result)
  
  return result
}
```

---

## 10. 工具执行引擎

### 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│              services/tools/toolExecution.ts (60KB)              │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  executeToolWithTracking(tool, input, context)            │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │  1. 开始 Telemetry Span                              │  │ │
│  │  │  2. 运行 PreToolUse Hooks                            │  │ │
│  │  │  3. 检查权限                                         │  │ │
│  │  │  4. 执行工具 call()                                  │  │ │
│  │  │  5. 运行 PostToolUse Hooks                           │  │ │
│  │  │  6. 记录分析事件                                     │  │ │
│  │  │  7. 结束 Telemetry Span                              │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              services/tools/toolHooks.ts (22KB)                  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  runPreToolUseHooks(tool, input, context)                 │ │
│  │  runPostToolUseHooks(tool, input, result, context)        │ │
│  │  runPostToolUseFailureHooks(tool, input, error, context)  │ │
│  │  resolveHookPermissionDecision(hookResult, context)       │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 关键文件

| 文件 | 大小 | 职责 |
|------|------|------|
| `src/services/tools/toolExecution.ts` | 60KB | 工具执行引擎 |
| `src/services/tools/toolHooks.ts` | 22KB | 工具 Hooks |
| `src/services/tools/toolOrchestration.ts` | 5KB | 工具编排 |
| `src/services/tools/StreamingToolExecutor.ts` | 17KB | 流式执行器 |

### 核心模式

#### 10.1 执行流程

```typescript
export async function executeToolWithTracking(
  tool: Tool,
  input: unknown,
  context: ToolUseContext,
  canUseTool: CanUseToolFn,
): Promise<ToolResult<unknown>> {
  const startTime = Date.now()
  const span = startToolExecutionSpan(tool.name, input)
  
  try {
    // 1. 运行前置 hooks
    const hookStartTime = Date.now()
    const hookResult = await runPreToolUseHooks(tool, input, context)
    const hookDuration = Date.now() - hookStartTime
    
    if (hookDuration > SLOW_PHASE_LOG_THRESHOLD_MS) {
      logForDebugging(`Slow hooks: ${hookDuration}ms`)
    }
    
    // 2. 解析 hook 决策
    const permission = await resolveHookPermissionDecision(hookResult, context)
    
    if (permission.behavior === 'deny') {
      await executePermissionDeniedHooks(tool, input, context)
      throw new PermissionDeniedError(permission.message)
    }
    
    // 3. 执行工具
    const result = await tool.call(input, context, canUseTool)
    
    // 4. 运行后置 hooks
    await runPostToolUseHooks(tool, input, result, context)
    
    // 5. 记录分析
    logEvent('tool_call', {
      tool_name: tool.name,
      duration_ms: Date.now() - startTime,
      // ...
    })
    
    return result
  } catch (error) {
    await runPostToolUseFailureHooks(tool, input, error, context)
    throw error
  } finally {
    endToolExecutionSpan(span, error)
  }
}
```

#### 10.2 Hook 时机

```typescript
// 前置 Hooks
- PreToolUse: 工具调用前，可修改输入或阻止执行
- PreToolUsePermission: 权限检查前，可自动批准

// 后置 Hooks
- PostToolUse: 工具成功后，可修改结果或触发副作用
- PostToolUseFailure: 工具失败后，可记录或恢复

// 权限相关
- PermissionDenied: 权限被拒绝后，可记录或通知
```

#### 10.3 流式执行

```typescript
export class StreamingToolExecutor {
  async *execute(
    tool: Tool,
    input: unknown,
    context: ToolUseContext,
  ): AsyncGenerator<ToolProgress | ToolResult> {
    const stream = new Stream<ToolProgress | ToolResult>()
    
    tool.call(input, context, canUseTool, (progress) => {
      stream.push({ type: 'progress', data: progress })
    }).then(result => {
      stream.push({ type: 'result', data: result })
      stream.end()
    }).catch(error => {
      stream.error(error)
    })
    
    for await (const chunk of stream) {
      yield chunk
    }
  }
}
```

---

## 11. 最值得借鉴的设计

### 11.1 `buildTool` 工厂模式 ⭐⭐⭐⭐⭐

**价值：** 极大减少工具实现的样板代码

```typescript
// Claude Code
export const BashTool = buildTool({
  name: 'Bash',
  description: (input) => `Run bash command: ${input.command}`,
  inputSchema: z.object({ command: z.string() }),
  
  async call(args, context, canUseTool, onProgress) {
    // 只实现核心逻辑，其他方法使用默认值
    const result = await exec(args.command)
    return { data: result }
  },
  
  // 只覆盖需要自定义的方法
  isReadOnly: () => false,
  isDestructive: (input) => isDestructiveCommand(input.command),
})
```

**OpenClaw 对比：** 当前每个 skill 需要手动实现所有方法

**升级建议：** 引入 `buildSkill` 工厂，提供合理默认值

---

### 11.2 权限规则系统 ⭐⭐⭐⭐⭐

**价值：** 灵活、可扩展的权限控制

```typescript
// 规则来源分级
PermissionRuleSource =
  | 'userSettings'      // ~/.config/claude/settings.json
  | 'projectSettings'   // .claude/settings.json
  | 'localSettings'     // 项目本地
  | 'cliArg'            // --allow Bash(rm *)
  | 'session'           // 会话级临时授权

// 规则行为
PermissionBehavior = 'allow' | 'deny' | 'ask'

// 规则值（支持通配符）
PermissionRuleValue = {
  toolName: 'Bash',
  ruleContent?: 'git *'  // 支持通配符匹配
}
```

**OpenClaw 对比：** 当前权限系统较简单，缺少规则来源分级

**升级建议：** 
1. 引入规则来源优先级
2. 支持通配符规则匹配
3. 添加会话级临时授权

---

### 11.3 工具上下文注入 ⭐⭐⭐⭐

**价值：** 工具可访问完整运行时上下文

```typescript
export type ToolUseContext = {
  // 状态访问
  getAppState(): AppState
  setAppState(f: (prev: AppState) => AppState): void
  setAppStateForTasks?: (f: (prev: AppState) => AppState) => void  // 跨任务共享
  
  // UI 交互
  setToolJSX?: (args) => void
  addNotification?: (notif: Notification) => void
  appendSystemMessage?: (msg: SystemMessage) => void
  
  // 工具/命令
  options: {
    commands: Command[]
    tools: Tools
    mcpClients: MCPServerConnection[]
  }
  
  // 控制
  abortController: AbortController
  readFileState: FileStateCache
  
  // 30+ 个可选回调...
}
```

**OpenClaw 对比：** Skill 上下文较简单

**升级建议：** 扩展 SkillContext，支持更多运行时能力

---

### 11.4 任务状态机 ⭐⭐⭐⭐

**价值：** 清晰的任务生命周期管理

```typescript
TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'killed'

TaskStateBase = {
  id: string           // 带类型前缀：a1x9k2m4p
  type: TaskType       // local_bash, local_agent, ...
  status: TaskStatus
  description: string
  startTime: number
  endTime?: number
  totalPausedMs?: number
  outputFile: string   // 流式输出文件路径
  outputOffset: number // 已读取偏移量
  notified: boolean    // 是否已通知用户
}
```

**OpenClaw 对比：** ClawFlow 有任务概念，但状态管理不够清晰

**升级建议：** 
1. 明确定义任务状态机
2. 添加任务 ID 前缀标识类型
3. 支持流式输出和偏移量跟踪

---

### 11.5 MCP 工具命名规范 ⭐⭐⭐

**价值：** 避免命名冲突，清晰标识来源

```typescript
// 命名格式：mcp__{server}__{tool}
// 示例：mcp__slack__send_message, mcp__github__create_issue

export function normalizeNameForMCP(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '_')
}

// 工具信息提取
export function mcpInfoFromString(toolName: string): {
  serverName: string
  toolName: string
} | null {
  if (!toolName.startsWith('mcp__')) return null
  const parts = toolName.split('__')
  return { serverName: parts[1], toolName: parts[2] }
}
```

**OpenClaw 对比：** 当前 skill 命名无统一规范

**升级建议：** 为外部集成的工具添加命名空间前缀

---

## 12. OpenClaw 升级建议

### 12.1 短期（1-2 周）

#### 1. 引入 `buildSkill` 工厂

```typescript
// ~/.openclaw/workspace/skills/core/ SkillBuilder.ts

const SKILL_DEFAULTS = {
  isEnabled: () => true,
  isConcurrencySafe: () => false,
  isReadOnly: () => false,
  isDestructive: () => false,
  checkPermissions: (input) => ({ behavior: 'allow', updatedInput: input }),
  userFacingName: () => '',
}

export function buildSkill<D extends SkillDef>(def: D): BuiltSkill<D> {
  return {
    ...SKILL_DEFAULTS,
    userFacingName: () => def.name,
    ...def,
  } as BuiltSkill<D>
}
```

#### 2. 扩展权限规则系统

```typescript
// ~/.openclaw/workspace/skills/core/permissions.ts

export type PermissionRuleSource =
  | 'userSettings'
  | 'projectSettings'
  | 'workspaceSettings'
  | 'cliArg'
  | 'session'

export type PermissionRule = {
  source: PermissionRuleSource
  ruleBehavior: 'allow' | 'deny' | 'ask'
  ruleValue: { skillName: string; pattern?: string }
}
```

#### 3. 统一工具命名规范

```typescript
// 外部集成工具添加前缀
// mcp__{server}__{tool}
// webhook__{service}__{action}
// api__{provider}__{operation}
```

### 12.2 中期（1-2 月）

#### 1. 重构状态管理

```typescript
// 引入统一 Store 模式
export type Store<T> = {
  getState: () => T
  setState: (updater: (prev: T) => T) => void
  subscribe: (listener: () => void) => () => void
}

// AppState 包含所有运行时状态
export type AppState = {
  skills: Skill[]
  tasks: Map<string, TaskState>
  permissions: PermissionContext
  settings: Settings
  // ...
}
```

#### 2. 任务系统升级

```typescript
// 明确定义任务状态机
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'killed'

export type Task = {
  name: string
  type: TaskType
  kill(taskId: string, setAppState: SetAppState): Promise<void>
}

// 任务 ID 带类型前缀
export function generateTaskId(type: TaskType): string {
  const prefix = TASK_ID_PREFIXES[type]  // 'b', 'a', 'r', ...
  return prefix + randomString(8)
}
```

#### 3. 工具执行引擎

```typescript
// 统一执行流程：hooks → permission → execute → hooks → telemetry
export async function executeSkillWithTracking(
  skill: Skill,
  input: unknown,
  context: SkillContext,
): Promise<SkillResult> {
  // 1. PreSkill hooks
  // 2. Permission check
  // 3. Execute skill
  // 4. PostSkill hooks
  // 5. Analytics
}
```

### 12.3 长期（3-6 月）

#### 1. MCP 协议支持

```typescript
// 支持标准 MCP 服务器
export type MCPServerConnection = {
  name: string
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
  transport: 'stdio' | 'sse' | 'http' | 'ws'
  tools: Skill[]
  resources: Resource[]
}
```

#### 2. 记忆系统升级

```typescript
// 结构化记忆目录
~/.openclaw/workspace/memory/
├── MEMORY.md          # 入口点
├── user/              # 用户偏好
├── feedback/          # 纠正反馈
├── projects/          # 项目知识
└── reference/         # 参考资料
```

#### 3. 插件系统

```typescript
// 支持可启用/禁用的插件
export type Plugin = {
  name: string
  manifest: { name, description, version }
  skills: SkillDefinition[]
  hooks: HookConfig[]
  enabled: boolean
}
```

---

## 附录：关键代码位置速查

| 功能 | Claude Code 路径 | OpenClaw 对应路径 |
|------|-----------------|------------------|
| 工具定义 | `src/Tool.ts` | `skills/*/SKILL.md` |
| 工具注册 | `src/tools.ts` | `skills/` 目录扫描 |
| 权限系统 | `src/types/permissions.ts` | `skills/core/permissions.ts` (新建) |
| 状态管理 | `src/state/` | `gateway/state/` (待重构) |
| 任务管理 | `src/tasks/` | `skills/clawflow/` |
| MCP 集成 | `src/services/mcp/` | 待实现 |
| 记忆系统 | `src/memdir/` | `memory/` 目录 |
| Hooks | `src/hooks/` | `skills/*/hooks/` |
| 插件系统 | `src/plugins/` | `skills/` 目录 |

---

*报告生成时间：2026-04-02*  
*分析版本：1.0*
