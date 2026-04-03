# Phase 2A-2A: Session / Workspace Foundation ✅

**状态**: 完成  
**版本**: 2A-2A-rc  
**日期**: 2026-04-04

---

## 概述

Phase 2A-2A 实现了 Operator 系统的会话与 Workspace 基础层：

- ✅ `OperatorSession` - 保存用户会话状态
- ✅ `SessionStore` - 会话生命周期管理
- ✅ `WorkspaceRegistry` - Workspace 注册与查询
- ✅ `WorkspaceSwitcher` - Workspace 切换

---

## 新增文件

```
src/operator/types/
└── session_types.ts              # 5KB - 会话与 Workspace 核心类型

src/operator/session/
├── session_store.ts              # 6KB - 会话存储 (内存实现)
├── workspace_registry.ts         # 4KB - Workspace 注册表 (内存实现)
├── workspace_switcher.ts         # 4KB - Workspace 切换器
└── index.ts                      # 2KB - 统一导出
```

---

## OperatorSession

### 核心结构

```ts
interface OperatorSession {
  sessionId: string;           // 会话 ID
  actorId?: string;            // 用户/机器人 ID
  surface: "cli" | "telegram" | "web";
  workspaceId?: string;        // 当前 Workspace
  status: "active" | "idle" | "closed";
  navigationState: {
    currentView: string;       // 当前视图
    selectedItemId?: string;   // 选中项 ID
    selectedTargetType?: string;
    previousView?: string;
    mode?: string;
    filter?: Record<string, unknown>;
    sort?: string;
    page?: number;
    pageSize?: number;
    lastCommandAt?: number;    // 最后命令时间
  };
  createdAt: number;
  updatedAt: number;
}
```

### Session 状态流转

```
创建 (createSession)
    ↓
活跃 (active) ←─── 更新 (updateNavigationState)
    ↓
关闭 (closeSession)
    ↓
删除 (过期自动清理)
```

---

## SessionStore

### 接口

```ts
interface SessionStore {
  createSession(input: CreateSessionInput): Promise<OperatorSession>;
  getSession(sessionId: string): Promise<OperatorSession | null>;
  saveSession(session: OperatorSession): Promise<void>;
  updateNavigationState(
    sessionId: string,
    navigationState: OperatorNavigationState
  ): Promise<OperatorSession | null>;
  closeSession(sessionId: string): Promise<void>;
  listActiveSessions(surface?: string): Promise<OperatorSession[]>;
}
```

### 内存实现特性

- **自动过期**: 24 小时 TTL
- **自动清理**: 每小时间隔清理过期 Session
- **Surface 过滤**: 按 `cli` / `telegram` / `web` 列出

### 使用示例

```ts
import { createSessionStore } from './operator';

const sessionStore = createSessionStore({
  sessionTtlMs: 24 * 60 * 60 * 1000,  // 24 小时
  cleanupIntervalMs: 60 * 60 * 1000,  // 1 小时
});

// 创建 Session
const session = await sessionStore.createSession({
  actorId: 'user_123',
  surface: 'cli',
  workspaceId: 'local-default',
});

console.log(session.sessionId);  // "cli_1234567890_abcdef"

// 更新 Navigation State
await sessionStore.updateNavigationState(session.sessionId, {
  currentView: 'tasks',
  selectedItemId: 'task_789',
});

// 获取 Session
const updated = await sessionStore.getSession(session.sessionId);
console.log(updated.navigationState.currentView);  // "tasks"

// 列出活跃 Sessions
const activeSessions = await sessionStore.listActiveSessions('cli');
console.log(activeSessions.length);
```

---

## WorkspaceRegistry

### 接口

```ts
interface WorkspaceRegistry {
  registerWorkspace(workspace: WorkspaceDescriptor): Promise<void>;
  getWorkspace(workspaceId: string): Promise<WorkspaceDescriptor | null>;
  listWorkspaces(): Promise<WorkspaceDescriptor[]>;
  getDefaultWorkspace(): Promise<WorkspaceDescriptor | null>;
}
```

### 默认 Workspaces

| ID | 名称 | 环境 | 默认 |
|----|------|------|------|
| `local-default` | 本地默认 | local | ✅ |
| `demo-default` | 演示环境 | demo | |
| `production` | 生产环境 | production | |

### 使用示例

```ts
import { createWorkspaceRegistry } from './operator';

const registry = createWorkspaceRegistry({
  defaultWorkspaceId: 'local-default',
});

// 获取默认 Workspace
const defaultWs = await registry.getDefaultWorkspace();
console.log(defaultWs.name);  // "本地默认"

// 列出所有 Workspaces
const workspaces = await registry.listWorkspaces();
console.log(workspaces.map(w => w.name));
// ["本地默认", "演示环境", "生产环境"]

// 注册新 Workspace
await registry.registerWorkspace({
  workspaceId: 'staging-eu',
  name: '欧洲预发布环境',
  environment: 'staging',
  metadata: {
    region: 'eu-west-1',
  },
});
```

---

## WorkspaceSwitcher

### 接口

```ts
interface WorkspaceSwitcher {
  switchWorkspace(
    sessionId: string,
    workspaceId: string
  ): Promise<WorkspaceSwitchResult>;
}
```

### 切换规则

切换 Workspace 时自动：

1. 校验 Session 存在
2. 校验 Workspace 存在
3. 更新 `session.workspaceId`
4. 重置 Navigation State（如果配置）
5. 保存 Session

### Navigation State 重置

```ts
// 重置前
{
  currentView: 'tasks',
  selectedItemId: 'task_789',
  selectedTargetType: 'task',
  filter: { status: 'blocked' },
  sort: 'priority',
  page: 2,
}

// 重置后
{
  currentView: 'dashboard',
  lastCommandAt: 1234567890,
  // 其他字段清空
}
```

### 使用示例

```ts
import {
  createSessionStore,
  createWorkspaceRegistry,
  createWorkspaceSwitcher,
} from './operator';

// 创建依赖
const sessionStore = createSessionStore();
const workspaceRegistry = createWorkspaceRegistry();
const switcher = createWorkspaceSwitcher(
  sessionStore,
  workspaceRegistry,
  { resetNavigationOnSwitch: true }
);

// 创建 Session
const session = await sessionStore.createSession({
  surface: 'cli',
  workspaceId: 'local-default',
});

// 切换到演示环境
const result = await switcher.switchWorkspace(
  session.sessionId,
  'demo-default'
);

console.log(result.changed);              // true
console.log(result.previousWorkspaceId);  // "local-default"
console.log(result.currentWorkspaceId);   // "demo-default"
console.log(result.session.navigationState.currentView);  // "dashboard"
```

---

## 集成点

### CLI Cockpit 集成

```ts
// cli_cockpit.ts
import { createSessionStore } from './operator/session';

const sessionStore = createSessionStore();

async function handleInput(rawInput: string, surface: 'cli') {
  // 1. 获取/创建 Session
  let session = await sessionStore.listActiveSessions('cli')
    .then(sessions => sessions[0]);
  
  if (!session) {
    session = await sessionStore.createSession({
      surface: 'cli',
      workspaceId: 'local-default',
    });
  }
  
  // 2. 执行命令
  const result = await dispatch.dispatch(command, {
    actor: { surface, workspaceId: session.workspaceId },
    navigation: session.navigationState,
  });
  
  // 3. 更新 Navigation State
  if (result.updatedView) {
    await sessionStore.updateNavigationState(session.sessionId, {
      currentView: result.updatedView.viewKind,
    });
  }
  
  return result;
}
```

### Telegram Cockpit 集成

```ts
// telegram_cockpit.ts
async function handleMessage(input: TelegramMessageContext) {
  // 1. 按 chatId 获取/创建 Session
  const sessionId = `telegram:${input.chatId}`;
  let session = await sessionStore.getSession(sessionId);
  
  if (!session) {
    session = await sessionStore.createSession({
      sessionId,
      surface: 'telegram',
      actorId: input.userId,
    });
  }
  
  // 2. 执行命令...
}
```

### Command Dispatch 集成

```ts
// default_operator_command_dispatch.ts
async function handleApprove(command, context) {
  const execResult = await executionBridge.approveApproval(id);
  
  // 更新 Session Navigation State
  if (context?.sessionId) {
    await sessionStore.updateNavigationState(context.sessionId, {
      currentView: 'approvals',
      lastCommandAt: Date.now(),
    });
  }
  
  return { success: true, updatedView };
}
```

---

## 验收标准

### ✅ 已完成

1. ✅ `OperatorSession` 类型定义完整
2. ✅ `SessionStore` 接口 + 内存实现
3. ✅ `WorkspaceRegistry` 接口 + 内存实现
4. ✅ `WorkspaceSwitcher` 接口 + 实现
5. ✅ 自动过期清理机制
6. ✅ 3 个默认 Workspaces

### 🟡 待完成

1. 🟡 CLI Cockpit 集成
2. 🟡 Telegram Cockpit 集成
3. 🟡 Command Dispatch 集成
4. 🟡 持久化存储（可选）

---

## 配置选项

### SessionStore

```ts
createSessionStore({
  sessionTtlMs: 24 * 60 * 60 * 1000,     // Session 过期时间
  cleanupIntervalMs: 60 * 60 * 1000,     // 清理间隔
})
```

### WorkspaceRegistry

```ts
createWorkspaceRegistry({
  defaultWorkspaceId: 'local-default',   // 默认 Workspace ID
})
```

### WorkspaceSwitcher

```ts
createWorkspaceSwitcher(
  sessionStore,
  workspaceRegistry,
  {
    resetNavigationOnSwitch: true,       // 切换时重置 Navigation
  }
)
```

---

## 下一步：2A-2B

2A-2A 完成后，可以进入 **2A-2B: Inbox 聚合层**：

- `approval_inbox.ts` - 审批收件箱
- `incident_center.ts` - 事件中心
- `task_center.ts` - 任务中心
- `attention_inbox.ts` - 关注项收件箱
- `inbox_service.ts` - 统一收件箱服务

或者先完成 **2A-2A 集成**：
- CLI Cockpit Session 绑定
- Telegram Cockpit Session 绑定
- Command Dispatch Navigation 更新

---

## 已知限制

1. **内存存储**: Session 和 Workspace 都是内存实现，重启后丢失
2. **无持久化**: 需要接入数据库/文件系统
3. **单实例**: 不支持多实例共享 Session

---

_Phase 2A-2A 状态：✅ 完成 — Session/Workspace 基础层已就绪_
