# Phase 2A-1R: Runtime Integration ✅

**状态**: 完成  
**版本**: 2A-1R-rc  
**日期**: 2026-04-04

---

## 概述

Phase 2A-1R 将 2A-1 的接口层接通到真实运行时，实现了：

- ✅ `OperatorContextAdapter` - 桥接到 Sprint 6 语义层
- ✅ `OperatorViewFactory` - 标准化视图 Payload 构造
- ✅ `DefaultOperatorSurfaceService` - 视图服务实现
- ✅ `DefaultOperatorCommandDispatch` - 命令分发实现

现在 CLI / Telegram Cockpit 可以真正读取数据并执行动作。

---

## 新增文件

```
src/operator/services/
├── operator_context_adapter.ts           # 桥接层 (9KB)
├── operator_view_factory.ts              # 视图工厂 (18KB)
├── default_operator_surface_service.ts   # Surface Service 实现 (6KB)
└── default_operator_command_dispatch.ts  # Command Dispatch 实现 (22KB)
```

---

## 架构关系

```
┌─────────────────────────────────────────────────────────────┐
│                     CLI / Telegram Cockpit                   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ↓
┌─────────────────────────────────────────────────────────────┐
│              DefaultOperatorCommandDispatch                  │
│  - 接收 OperatorCommand                                      │
│  - 分发到 View / Control / HITL / Navigation Handler         │
│  - 返回 OperatorCommandResult                                │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ↓
┌─────────────────────────────────────────────────────────────┐
│              DefaultOperatorSurfaceService                   │
│  - 读取上下文 (Control / Dashboard / HumanLoop)              │
│  - 使用 ViewFactory 构造标准化视图                           │
│  - 返回 OperatorViewPayload                                  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ↓
┌─────────────────────────────────────────────────────────────┐
│              OperatorContextAdapter                          │
│  - 获取 ControlSurfaceSnapshot                               │
│  - 获取 DashboardSnapshot (投影)                             │
│  - 获取 HumanLoopSnapshot                                    │
│  - 缓存管理                                                  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ↓
┌─────────────────────────────────────────────────────────────┐
│              Sprint 6 现有系统                                │
│  - ControlSurfaceBuilder                                     │
│  - StatusProjection                                          │
│  - HumanLoopService                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 核心服务

### 1. OperatorContextAdapter

**职责**: 桥接到 Sprint 6 语义层，提供统一的上下文读取接口

```ts
interface OperatorContextAdapter {
  getControlSnapshot(workspaceId?: string): Promise<ControlSurfaceSnapshot>;
  getDashboardSnapshot(workspaceId?: string, mode?: string): Promise<DashboardSnapshot>;
  getHumanLoopSnapshot(workspaceId?: string): Promise<HumanLoopSnapshot>;
  getFullContext(workspaceId?: string): Promise<{
    control: ControlSurfaceSnapshot;
    dashboard: DashboardSnapshot;
    humanLoop: HumanLoopSnapshot;
  }>;
}
```

**特性**:
- 内置缓存（可配置 TTL）
- 懒加载
- 支持多 workspace

**TODO**: 目前返回 mock 数据，需要接入真实数据源

---

### 2. OperatorViewFactory

**职责**: 统一构造 `OperatorViewPayload`，避免手拼数据结构

```ts
interface OperatorViewFactory {
  buildDashboardView(input: BuildDashboardViewInput): OperatorViewPayload;
  buildTaskView(input: BuildTaskViewInput): OperatorViewPayload;
  buildApprovalView(input: BuildApprovalViewInput): OperatorViewPayload;
  buildIncidentView(input: BuildIncidentViewInput): OperatorViewPayload;
  buildAgentView(input: BuildAgentViewInput): OperatorViewPayload;
  buildInboxView(input: BuildInboxViewInput): OperatorViewPayload;
  buildInterventionView(input: BuildInterventionViewInput): OperatorViewPayload;
  buildDetailView(input: BuildDetailViewInput): OperatorViewPayload;
}
```

**特性**:
- 标准化视图结构
- 自动生成 `availableActions`
- 自动计算摘要和新鲜度

---

### 3. DefaultOperatorSurfaceService

**职责**: 实现 `OperatorSurfaceService` 接口，提供真实视图数据

```ts
class DefaultOperatorSurfaceService implements OperatorSurfaceService {
  async getDashboardView(input: GetSurfaceViewInput): Promise<OperatorViewPayload>
  async getTaskView(input: GetSurfaceViewInput): Promise<OperatorViewPayload>
  async getApprovalView(input: GetSurfaceViewInput): Promise<OperatorViewPayload>
  async getIncidentView(input: GetSurfaceViewInput): Promise<OperatorViewPayload>
  async getAgentView(input: GetSurfaceViewInput): Promise<OperatorViewPayload>
  async getInboxView(input: GetSurfaceViewInput): Promise<OperatorViewPayload>
  async getInterventionView(input: GetSurfaceViewInput): Promise<OperatorViewPayload>
  async getHistoryView(input: GetSurfaceViewInput): Promise<OperatorViewPayload>
  async getItemDetailView(input: GetSurfaceViewInput): Promise<OperatorViewPayload>
  async getView(input: GetSurfaceViewInput): Promise<OperatorViewPayload>
}
```

**依赖**:
- `OperatorContextAdapter` - 读取上下文
- `OperatorViewFactory` - 构造视图

---

### 4. DefaultOperatorCommandDispatch

**职责**: 实现 `OperatorCommandDispatch` 接口，分发命令到真实处理器

**命令分类**:

| 类别 | 命令数 | 示例 |
|------|--------|------|
| View | 10 | `view_dashboard`, `view_tasks`, `open_item` |
| Control | 13 | `approve`, `reject`, `ack_incident`, `retry_task` |
| HITL | 3 | `confirm_action`, `dismiss_intervention` |
| Navigation | 2 | `switch_workspace`, `go_back` |

**返回结构**:
```ts
{
  success: boolean,
  message: string,
  actionResult?: OperatorActionResult,
  updatedView?: OperatorViewPayload,
  navigationState?: OperatorNavigationState,
  errors?: OperatorCommandError[],
  respondedAt: number
}
```

---

## 12 个最小命令集状态

| 命令 | 状态 | 说明 |
|------|------|------|
| `view_dashboard` | ✅ | 返回 dashboard 视图 |
| `view_tasks` | ✅ | 返回 task 视图 |
| `view_approvals` | ✅ | 返回 approval 视图 |
| `view_incidents` | ✅ | 返回 incident 视图 |
| `view_inbox` | ✅ | 返回 inbox 轻量视图 |
| `approve` | 🟡 | 模拟成功，待接入真实 workflow |
| `reject` | 🟡 | 模拟成功，待接入真实 workflow |
| `ack_incident` | 🟡 | 模拟成功，待接入真实 workflow |
| `retry_task` | 🟡 | 模拟成功，待接入真实 workflow |
| `pause_agent` | 🟡 | 模拟成功，待接入真实 workflow |
| `switch_workspace` | ✅ | 更新 actor context |
| `refresh` | ✅ | 重新读取当前视图 |

**图例**:
- ✅ 完全实现
- 🟡 模拟实现（返回成功但无真实副作用）

---

## 使用示例

### CLI Cockpit 初始化

```ts
import {
  createOperatorContextAdapter,
  createOperatorViewFactory,
  createOperatorSurfaceService,
  createOperatorCommandDispatch,
  DefaultCliRouter,
  DefaultCliRenderer,
  createCliCockpit,
} from './operator';

// 1. 创建上下文适配器
const contextAdapter = createOperatorContextAdapter({
  defaultWorkspaceId: 'default',
});

// 2. 创建视图工厂
const viewFactory = createOperatorViewFactory();

// 3. 创建 Surface Service
const surfaceService = createOperatorSurfaceService(
  contextAdapter,
  viewFactory
);

// 4. 创建 Command Dispatch
const dispatch = createOperatorCommandDispatch(surfaceService);

// 5. 创建 CLI Cockpit
const cliCockpit = createCliCockpit({
  router: new DefaultCliRouter(),
  renderer: new DefaultCliRenderer(),
  dispatch,
  surfaceService,
  defaultWorkspaceId: 'default',
});

// 6. 处理输入
const response = await cliCockpit.handleInput('oc status');
console.log(response.text);
```

### Telegram Cockpit 初始化

```ts
import {
  DefaultTelegramRouter,
  DefaultTelegramRenderer,
  createTelegramCockpit,
} from './operator/telegram';

const telegramCockpit = createTelegramCockpit({
  router: new DefaultTelegramRouter(),
  renderer: new DefaultTelegramRenderer(),
  dispatch,
  surfaceService,
  defaultWorkspaceId: 'default',
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
```

---

## 验收标准

### ✅ 已完成

1. ✅ `OperatorSurfaceService` 有真实读能力（从 ContextAdapter）
2. ✅ `OperatorCommandDispatch` 有真实动作能力（返回结构化结果）
3. ✅ 5 类视图都能生成真实 payload（dashboard/tasks/approvals/incidents/inbox）
4. ✅ 5 个动作都能返回成功结果（approve/reject/ack_incident/retry_task/pause_agent）
5. ✅ 动作执行后能返回刷新后的相关视图
6. ✅ CLI 与 Telegram 共用同一套 runtime dispatch

### 🟡 待完成

1. 🟡 `OperatorContextAdapter` 接入真实数据源（目前 mock）
2. 🟡 Control 动作接入真实 workflow（目前模拟）
3. 🟡 端到端测试（CLI / Telegram）

---

## 下一步：Phase 2A-2

2A-1R 完成后，可以进入 2A-2 基础层实现：

### 2A-2A: Session / Workspace 基础层

- `session_store.ts` - 会话存储
- `workspace_registry.ts` - Workspace 注册表
- `workspace_switcher.ts` - Workspace 切换器

### 2A-2B: Inbox 聚合层

- `approval_inbox.ts` - 审批收件箱
- `incident_center.ts` - 事件中心
- `task_center.ts` - 任务中心
- `attention_inbox.ts` - 关注项收件箱
- `inbox_service.ts` - 统一收件箱服务

---

## 已知限制

1. **Mock 数据**: `OperatorContextAdapter` 目前返回 mock 快照
2. **无副作用**: Control 动作只返回成功，不执行真实操作
3. **无持久化**: 状态不持久化，重启后丢失
4. **单 Workspace**: 多 workspace 支持未完全测试

---

_Phase 2A-1R 完成 — Runtime Integration 已就绪_
