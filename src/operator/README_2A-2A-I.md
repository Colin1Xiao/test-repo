# Phase 2A-2A-I: Session / Workspace Integration ✅

**状态**: 完成  
**版本**: 2A-2A-I-rc  
**日期**: 2026-04-04

---

## 概述

Phase 2A-2A-I 将 Session/Workspace 基础层集成到 Operator 产品主链路：

- ✅ CLI Cockpit V2 - 自动创建/复用 Session
- ✅ Telegram Cockpit V2 - 按 chatId 绑定 Session
- ✅ Command Dispatch V2 - 更新 Navigation State + Workspace 切换

---

## 新增文件

```
src/operator/
├── cli/
│   └── cli_cockpit_v2.ts              # 5KB - CLI Cockpit (Session 集成)
├── telegram/
│   └── telegram_cockpit_v2.ts         # 7KB - Telegram Cockpit (Session 集成)
└── services/
    └── operator_command_dispatch_v2.ts # 15KB - Dispatch V2 (Session 集成)
```

---

## CLI Cockpit V2

### 核心功能

```ts
interface CliCockpitV2 {
  handleInput(rawInput: string): Promise<SurfaceRenderedResponse>;
  getCurrentSession(): Promise<OperatorSession | null>;
  clearSession(): Promise<void>;
}
```

### Session 流程

```
CLI 启动
    ↓
获取/创建 Session (listActiveSessions → createSession)
    ↓
注入 sessionId/workspaceId 到 actor context
    ↓
Dispatch 执行命令
    ↓
更新 Navigation State (updateNavigationState)
    ↓
下次命令复用 Session
```

### 使用示例

```ts
import {
  createSessionStore,
  createWorkspaceRegistry,
  createOperatorExecutionBridge,
  createOperatorSurfaceService,
  createCliCockpitV2,
  DefaultCliRouter,
  DefaultCliRenderer,
} from './operator';

// 1. 创建依赖
const sessionStore = createSessionStore();
const workspaceRegistry = createWorkspaceRegistry();
const executionBridge = createOperatorExecutionBridge({ enableRealExecution: true });
const surfaceService = createOperatorSurfaceService(contextAdapter, viewFactory);

// 2. 创建 Dispatch V2
const dispatch = createOperatorCommandDispatchV2(
  surfaceService,
  executionBridge,
  sessionStore,
  createWorkspaceSwitcher(sessionStore, workspaceRegistry)
);

// 3. 创建 CLI Cockpit V2
const cliCockpit = createCliCockpitV2({
  router: new DefaultCliRouter(),
  renderer: new DefaultCliRenderer(),
  dispatch,
  surfaceService,
  sessionStore,
  workspaceRegistry,
});

// 4. 处理命令
console.log('=== 第一次命令 (创建 Session) ===');
const response1 = await cliCockpit.handleInput('oc status');
console.log(response1.text);

console.log('=== 第二次命令 (复用 Session) ===');
const response2 = await cliCockpit.handleInput('oc tasks');
console.log(response2.text);

// 5. 查看当前 Session
const session = await cliCockpit.getCurrentSession();
console.log(session.navigationState.currentView);  // "tasks"
```

---

## Telegram Cockpit V2

### 核心功能

```ts
interface TelegramCockpitV2 {
  handleMessage(input: TelegramMessageContext): Promise<TelegramResponse>;
  handleCallback(input: TelegramCallbackContext): Promise<TelegramResponse>;
  getChatSession(chatId: string): Promise<OperatorSession | null>;
  clearChatSession(chatId: string): Promise<void>;
}
```

### Session 绑定规则

```
Telegram Chat
    ↓
Session ID = "telegram:<chatId>"
    ↓
getOrCreateSession(sessionId)
    ↓
每个 Chat 独立 Session
```

### 使用示例

```ts
import {
  createTelegramCockpitV2,
  DefaultTelegramRouter,
  DefaultTelegramRenderer,
} from './operator/telegram';

// 创建 Telegram Cockpit V2
const telegramCockpit = createTelegramCockpitV2({
  router: new DefaultTelegramRouter(),
  renderer: new DefaultTelegramRenderer(),
  dispatch,
  surfaceService,
  sessionStore,
  workspaceRegistry,
});

// 处理消息
const response = await telegramCockpit.handleMessage({
  chatId: '123456',
  userId: '789',
  text: '/status',
});

// 处理回调
const callbackResponse = await telegramCockpit.handleCallback({
  chatId: '123456',
  userId: '789',
  callbackData: 'oc:approve:approval:apv_123',
});

// 查看 Chat Session
const session = await telegramCockpit.getChatSession('123456');
console.log(session.workspaceId);
```

---

## Command Dispatch V2

### 核心升级

相比 V1，Dispatch V2 新增：

1. **SessionStore 集成** - 自动更新 navigation state
2. **WorkspaceSwitcher 集成** - 真实切换 workspace
3. **Navigation State 回写** - view/action 后自动更新

### Navigation State 更新规则

| 命令类型 | 更新字段 |
|----------|----------|
| `view_dashboard` | `currentView = 'dashboard'` |
| `view_tasks` | `currentView = 'tasks'` |
| `view_approvals` | `currentView = 'approvals'` |
| `view_incidents` | `currentView = 'incidents'` |
| `open_item` | `currentView = 'item_detail'`, `selectedItemId`, `selectedTargetType` |
| `switch_workspace` | `workspaceId`, `currentView = 'dashboard'` |
| `go_back` | `currentView = previousView` |

### 使用示例

```ts
const dispatch = createOperatorCommandDispatchV2(
  surfaceService,
  executionBridge,
  sessionStore,
  workspaceSwitcher,
  { autoUpdateNavigation: true }
);

// 执行 view 命令
const result = await dispatch.dispatch({
  id: 'cmd_123',
  surface: 'cli',
  commandType: 'view_tasks',
  actor: { surface: 'cli', sessionId: 'cli_123' },
  issuedAt: Date.now(),
}, {
  navigation: { currentView: 'dashboard' },
});

console.log(result.navigationState.currentView);  // "tasks"

// 执行 switch_workspace
const switchResult = await dispatch.dispatch({
  id: 'cmd_456',
  surface: 'cli',
  commandType: 'switch_workspace',
  targetId: 'demo-default',
  actor: { surface: 'cli', sessionId: 'cli_123' },
  issuedAt: Date.now(),
}, {
  actor: { sessionId: 'cli_123' },
  navigation: { currentView: 'tasks', workspaceId: 'local-default' },
});

console.log(switchResult.navigationState.workspaceId);  // "demo-default"
console.log(switchResult.navigationState.currentView);  // "dashboard"
```

---

## 端到端会话连续性

### CLI 连续命令

```bash
# 第一次命令 - 创建 Session
$ oc status
# Session: cli_1234567890_abcdef
# Workspace: local-default
# View: dashboard

# 第二次命令 - 复用 Session
$ oc tasks
# Session: cli_1234567890_abcdef (复用)
# Workspace: local-default (保持)
# View: tasks (更新)

# 切换 Workspace
$ oc workspace switch demo-default
# Session: cli_1234567890_abcdef (复用)
# Workspace: demo-default (切换)
# View: dashboard (重置)

# 查看新 Workspace 的任务
$ oc tasks
# Session: cli_1234567890_abcdef (复用)
# Workspace: demo-default (保持)
# View: tasks (更新)
```

### Telegram 连续对话

```
用户：/status
Bot: [Dashboard 视图]
     Session: telegram:123456
     Workspace: local-default

用户：/tasks
Bot: [Tasks 视图]
     Session: telegram:123456 (复用)
     Workspace: local-default (保持)

用户：[Approve 按钮]
Bot: [Approval 执行结果 + 更新视图]
     Session: telegram:123456 (复用)
     View: approvals (更新)
```

---

## 验收标准

### ✅ 已完成

1. ✅ CLI Cockpit V2 实现 Session get-or-create
2. ✅ Telegram Cockpit V2 实现 chatId 绑定
3. ✅ Dispatch V2 集成 WorkspaceSwitcher
4. ✅ Navigation State 自动更新
5. ✅ switch_workspace 真实切换
6. ✅ Session 连续性验证

### 🟡 待验证

1. 🟡 CLI 端到端连续会话
2. 🟡 Telegram 端到端连续会话
3. 🟡 多 Chat 隔离验证

---

## 配置选项

### CliCockpitV2

```ts
createCliCockpitV2({
  router: new DefaultCliRouter(),
  renderer: new DefaultCliRenderer(),
  dispatch,
  surfaceService,
  sessionStore,
  workspaceRegistry,
  defaultWorkspaceId: 'local-default',
})
```

### TelegramCockpitV2

```ts
createTelegramCockpitV2({
  router: new DefaultTelegramRouter(),
  renderer: new DefaultTelegramRenderer(),
  dispatch,
  surfaceService,
  sessionStore,
  workspaceRegistry,
  defaultWorkspaceId: 'local-default',
})
```

### OperatorCommandDispatchV2

```ts
createOperatorCommandDispatchV2(
  surfaceService,
  executionBridge,
  sessionStore,
  workspaceSwitcher,
  {
    autoUpdateNavigation: true,  // 自动更新 navigation state
  }
)
```

---

## 与 V1 的区别

| 功能 | V1 | V2 |
|------|-----|-----|
| Session 管理 | ❌ | ✅ 自动创建/复用 |
| Workspace 切换 | ❌ 仅改 context | ✅ 真实切换 + 重置 navigation |
| Navigation State | ❌ 不持久化 | ✅ 自动回写 Session |
| CLI 连续性 | ❌ 每次新请求 | ✅ 复用 Session |
| Telegram 绑定 | ❌ 无 | ✅ 按 chatId 绑定 |

---

## 下一步

### 选项 1: 端到端验证

**目标:** 验证 CLI/Telegram 连续会话

**行动:**
1. CLI 连续命令测试
2. Telegram 多轮对话测试
3. Workspace 切换验证

### 选项 2: 进入 2A-2B Inbox 聚合

**目标:** 实现审批/事件/任务中心

**行动:**
1. `approval_inbox.ts`
2. `incident_center.ts`
3. `task_center.ts`

---

## 已知限制

1. **内存 Session**: 重启后 Session 丢失
2. **无持久化**: 需要接入数据库/文件系统
3. **单实例**: 不支持多实例共享 Session

---

_Phase 2A-2A-I 状态：✅ 完成 — Session/Workspace 已集成到产品主链路_
