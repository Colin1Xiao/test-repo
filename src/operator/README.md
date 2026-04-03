# Operator Module - Phase 2A-1

**状态**: ✅ 核心接口层完成  
**版本**: 2A-1-rc

---

## 概述

Phase 2A-1 实现了 Operator 控制系统的核心接口层，包括：

- **类型定义** - 统一的类型系统
- **服务接口** - Surface Service + Command Dispatch
- **CLI 入口** - 命令行解析 + 渲染
- **Telegram 入口** - 消息/回调解析 + 渲染

---

## 目录结构

```
src/operator/
├── types/
│   └── surface_types.ts          # 核心类型定义
├── services/
│   ├── operator_surface_service.ts    # 视图服务接口
│   └── operator_command_dispatch.ts   # 命令分发接口 + Registry
├── cli/
│   ├── cli_router.ts             # CLI 命令解析
│   ├── cli_renderer.ts           # CLI 响应渲染
│   └── cli_cockpit.ts            # CLI 统一入口
├── telegram/
│   ├── telegram_router.ts        # Telegram 消息/回调解析
│   ├── telegram_renderer.ts      # Telegram 响应渲染
│   └── telegram_cockpit.ts       # Telegram 统一入口
├── index.ts                      # 统一导出
└── README.md                     # 本文档
```

---

## 核心类型

### OperatorSurface
```ts
type OperatorSurface = "cli" | "telegram" | "web";
```

### OperatorViewKind
```ts
type OperatorViewKind =
  | "dashboard"
  | "tasks"
  | "approvals"
  | "incidents"
  | "agents"
  | "inbox"
  | "interventions"
  | "history"
  | "item_detail";
```

### OperatorActionType (2A-1 最小集)
```ts
// 视图 (5)
"view_dashboard" | "view_tasks" | "view_approvals" | "view_incidents" | "view_inbox"

// 动作 (5)
"approve" | "reject" | "ack_incident" | "retry_task" | "pause_agent"

// 辅助 (2)
"switch_workspace" | "refresh"
```

---

## 服务接口

### OperatorSurfaceService

核心读模型服务，负责返回标准化视图：

```ts
interface OperatorSurfaceService {
  getDashboardView(input: GetSurfaceViewInput): Promise<OperatorViewPayload>;
  getTaskView(input: GetSurfaceViewInput): Promise<OperatorViewPayload>;
  getApprovalView(input: GetSurfaceViewInput): Promise<OperatorViewPayload>;
  getIncidentView(input: GetSurfaceViewInput): Promise<OperatorViewPayload>;
  getAgentView(input: GetSurfaceViewInput): Promise<OperatorViewPayload>;
  getInboxView(input: GetSurfaceViewInput): Promise<OperatorViewPayload>;
  getInterventionView(input: GetSurfaceViewInput): Promise<OperatorViewPayload>;
  getHistoryView(input: GetSurfaceViewInput): Promise<OperatorViewPayload>;
  getItemDetailView(input: GetSurfaceViewInput): Promise<OperatorViewPayload>;
  getView(input: GetSurfaceViewInput): Promise<OperatorViewPayload>;
}
```

### OperatorCommandDispatch

命令分发层，负责将命令映射到具体处理器：

```ts
interface OperatorCommandDispatch {
  dispatch(
    command: OperatorCommand,
    context?: DispatchContext
  ): Promise<OperatorCommandResult>;
}
```

---

## CLI 使用

### 命令格式

```bash
oc <command> [target] [id]
```

### 视图命令
```bash
oc status          # 查看 dashboard
oc tasks           # 查看任务
oc approvals       # 查看审批
oc incidents       # 查看事件
oc inbox           # 查看收件箱
```

### 控制命令
```bash
oc approve apv_123           # 批准
oc reject apv_123            # 拒绝
oc ack incident inc_778      # 确认事件
oc retry task task_456       # 重试任务
oc pause agent agent_999     # 暂停 agent
```

### 导航命令
```bash
oc workspace switch prod     # 切换 workspace
oc refresh                   # 刷新当前视图
```

---

## Telegram 使用

### 文本命令
```
/status
/tasks
/approvals
/incidents
/inbox
/approve <id>
/reject <id>
/ack <id>
/retry <taskId>
/workspace <id>
/refresh
```

### Callback 格式
```
oc:<actionType>:<targetType>:<targetId>
```

示例：
```
oc:approve:approval:apv_123
oc:ack_incident:incident:inc_778
oc:retry_task:task:task_456
```

---

## 实现清单

### ✅ 已完成 (2A-1)

| 文件 | 状态 |
|------|------|
| `types/surface_types.ts` | ✅ |
| `services/operator_surface_service.ts` | ✅ |
| `services/operator_command_dispatch.ts` | ✅ |
| `cli/cli_router.ts` | ✅ |
| `cli/cli_renderer.ts` | ✅ |
| `cli/cli_cockpit.ts` | ✅ |
| `telegram/telegram_router.ts` | ✅ |
| `telegram/telegram_renderer.ts` | ✅ |
| `telegram/telegram_cockpit.ts` | ✅ |
| `index.ts` | ✅ |

### 🔜 下一步 (2A-2)

1. 实现 `OperatorSurfaceService` 具体逻辑
   - 集成 `ControlSurface`
   - 集成 `StatusProjection`
   - 集成 `HumanLoopService`

2. 实现 `OperatorCommandDispatch` 具体逻辑
   - View Handler
   - Control Handler
   - HITL Handler
   - Navigation Handler

3. 集成测试
   - CLI 端到端测试
   - Telegram 端到端测试

---

## 设计原则

1. **命令统一** - CLI/Telegram 都走 `OperatorCommandDispatch`
2. **渲染分离** - Dispatch 只返回结构化结果，Renderer 负责投影
3. **固定语法** - 第一版用固定命令语法，后续加智能解析

---

## 依赖关系

```
CLI/Telegram Entry
       ↓
   Router (parse)
       ↓
   Command (standardized)
       ↓
   Dispatch (execute)
       ↓
   Result + UpdatedView
       ↓
   Renderer (format)
       ↓
   Surface Response
```

---

_Phase 2A-1 核心接口层完成，准备进入 2A-2 实现阶段_
