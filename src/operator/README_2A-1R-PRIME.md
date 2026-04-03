# Phase 2A-1R′: Real Data / Real Action Binding

**状态**: 🟡 部分完成  
**版本**: 2A-1R′-rc  
**日期**: 2026-04-04

---

## 概述

Phase 2A-1R′ 将 2A-1R 的模拟执行升级为真实执行桥接，实现了：

- ✅ `OperatorExecutionBridge` - 真实动作执行桥接
- ✅ 执行模式区分 (`real` / `simulated`)
- ✅ 5 个核心动作接通 bridge (`approve` / `reject` / `ack_incident` / `retry_task` / `pause_agent`)
- 🟡 ControlSurfaceBuilder 待接入真实实例
- 🟡 真实数据源待接入

---

## 新增文件

```
src/operator/services/
└── operator_execution_bridge.ts    # 18KB - 真实动作执行桥接
```

---

## Execution Bridge 核心功能

### 执行模式

```ts
type ExecutionMode = "real" | "simulated" | "unsupported";
```

- **real**: 调用真实 ControlSurfaceBuilder.dispatchControlAction()
- **simulated**: 返回模拟成功结果（默认模式）
- **unsupported**: 功能不支持

### 支持的 13 个动作

| 动作 | 方法 | 状态 |
|------|------|------|
| 批准审批 | `approveApproval(id)` | ✅ Bridge 完成 |
| 拒绝审批 | `rejectApproval(id)` | ✅ Bridge 完成 |
| 确认事件 | `ackIncident(id)` | ✅ Bridge 完成 |
| 重试任务 | `retryTask(id)` | ✅ Bridge 完成 |
| 暂停 Agent | `pauseAgent(id)` | ✅ Bridge 完成 |
| 恢复 Agent | `resumeAgent(id)` | ✅ Bridge 完成 |
| 检查 Agent | `inspectAgent(id)` | ✅ Bridge 完成 |
| 取消任务 | `cancelTask(id)` | ✅ Bridge 完成 |
| 暂停任务 | `pauseTask(id)` | ✅ Bridge 完成 |
| 恢复任务 | `resumeTask(id)` | ✅ Bridge 完成 |
| 升级 | `escalate(type, id)` | ✅ Bridge 完成 |
| 请求恢复 | `requestRecovery(id)` | 🟡 模拟 |
| 请求重放 | `requestReplay(id)` | 🟡 模拟 |

### ExecutionResult 结构

```ts
interface ExecutionResult {
  success: boolean;
  executionMode: ExecutionMode;  // 关键：显式区分真实/模拟
  actionType: string;
  targetId?: string;
  message: string;
  error?: string;
  controlResult?: ControlActionResult;  // 底层控制动作结果
  executedAt: number;
}
```

---

## 使用示例

### 初始化（模拟模式 - 默认）

```ts
import { createOperatorExecutionBridge } from './operator/services/operator_execution_bridge';

// 默认模拟模式
const bridge = createOperatorExecutionBridge();

// 执行动作（模拟）
const result = await bridge.approveApproval('apv_123');
console.log(result.executionMode);  // "simulated"
console.log(result.success);        // true
```

### 初始化（真实模式）

```ts
import { createControlSurfaceBuilder } from '../ux/control_surface';
import { createOperatorExecutionBridge } from './operator/services/operator_execution_bridge';

// 1. 创建 ControlSurfaceBuilder（需要真实数据源）
const controlSurface = createControlSurfaceBuilder(
  taskViewBuilder,
  approvalViewBuilder,
  opsViewBuilder,
  agentViewBuilder
);

// 2. 创建 Execution Bridge（真实模式）
const bridge = createOperatorExecutionBridge({
  enableRealExecution: true,
  controlSurfaceBuilder: controlSurface,
});

// 3. 执行动作（真实）
const result = await bridge.approveApproval('apv_123');
console.log(result.executionMode);  // "real"
console.log(result.controlResult);  // 底层控制动作结果
```

### 动态切换模式

```ts
const bridge = createOperatorExecutionBridge();

// 检查当前模式
console.log(bridge.isRealExecutionEnabled());  // false

// 启用真实执行
bridge.enableRealExecution();

// 执行动作（真实）
await bridge.approveApproval('apv_123');

// 禁用真实执行（回到模拟）
bridge.disableRealExecution();
```

---

## 集成到 Command Dispatch

### 更新后的初始化流程

```ts
import {
  createOperatorContextAdapter,
  createOperatorViewFactory,
  createOperatorSurfaceService,
  createOperatorExecutionBridge,
  createOperatorCommandDispatch,
} from './operator';

// 1. 创建上下文适配器
const contextAdapter = createOperatorContextAdapter();

// 2. 创建视图工厂
const viewFactory = createOperatorViewFactory();

// 3. 创建 Surface Service
const surfaceService = createOperatorSurfaceService(
  contextAdapter,
  viewFactory
);

// 4. 创建 Execution Bridge
const executionBridge = createOperatorExecutionBridge({
  enableRealExecution: false,  // 默认模拟
  controlSurfaceBuilder: null,  // TODO: 接入真实实例
});

// 5. 创建 Command Dispatch（使用 bridge）
const dispatch = createOperatorCommandDispatch(
  surfaceService,
  executionBridge,  // 新增参数
  controlSurfaceBuilder,
  humanLoopService
);
```

### 动作结果中的 executionMode

```ts
const result = await dispatch.dispatch({
  id: 'cmd_123',
  surface: 'cli',
  commandType: 'approve',
  targetType: 'approval',
  targetId: 'apv_123',
  actor: { surface: 'cli' },
  issuedAt: Date.now(),
});

console.log(result.actionResult.data.executionMode);  // "simulated" 或 "real"
```

---

## 验收标准

### ✅ 已完成

1. ✅ `OperatorExecutionBridge` 接口定义完整（13 个动作方法）
2. ✅ `ExecutionResult` 显式区分 `real` / `simulated` 模式
3. ✅ 默认模拟模式（安全降级）
4. ✅ 5 个核心动作接通 bridge（approve/reject/ack_incident/retry_task/pause_agent）
5. ✅ `DefaultOperatorCommandDispatch` 使用 bridge 执行动作
6. ✅ `toActionResult()` 转换方法包含 `executionMode` 元数据

### 🟡 待完成

1. 🟡 接入真实 `ControlSurfaceBuilder` 实例
2. 🟡 配置 `enableRealExecution = true`
3. 🟡 验证端到端真实动作链路
4. 🟡 `OperatorContextAdapter` 接入真实数据源

---

## 真实执行依赖

要启用真实执行，需要以下依赖：

### 1. ControlSurfaceBuilder 实例

```ts
import {
  createTaskViewBuilder,
  createApprovalViewBuilder,
  createOpsViewBuilder,
  createAgentViewBuilder,
  createControlSurfaceBuilder,
} from './ux';

// 需要真实数据源
const taskViewBuilder = createTaskViewBuilder(taskDataSource);
const approvalViewBuilder = createApprovalViewBuilder(approvalDataSource);
const opsViewBuilder = createOpsViewBuilder(healthMetricsDataSource);
const agentViewBuilder = createAgentViewBuilder(agentDataSource);

const controlSurface = createControlSurfaceBuilder(
  taskViewBuilder,
  approvalViewBuilder,
  opsViewBuilder,
  agentViewBuilder
);
```

### 2. 数据源配置

需要实现以下数据源接口：

- `TaskDataSource` - 任务数据
- `ApprovalDataSource` - 审批数据
- `HealthMetricsDataSource` - 健康指标
- `AgentDataSource` - Agent 数据

### 3. 启用真实执行

```ts
const bridge = createOperatorExecutionBridge({
  enableRealExecution: true,  // 启用真实执行
  controlSurfaceBuilder: controlSurface,
});
```

---

## 安全降级策略

### 默认模拟模式

```ts
// 默认配置
const bridge = createOperatorExecutionBridge();
// enableRealExecution = false
// controlSurfaceBuilder = null

// 所有动作返回模拟成功
const result = await bridge.approveApproval('apv_123');
// result.executionMode = "simulated"
// result.success = true
```

### 部分真实模式

```ts
// 只启用部分动作的真实执行
const bridge = createOperatorExecutionBridge({
  enableRealExecution: true,
  controlSurfaceBuilder: controlSurface,
});

// approve/reject/ack 等支持的动作 → real
// requestRecovery/requestReplay 等不支持的动作 → simulated
```

---

## 与 2A-1R 的关系

```
Phase 2A-1   → 接口层完成（类型 + 接口定义）
    ↓
Phase 2A-1R  → Runtime Integration（Surface Service + Dispatch 实现）
    ↓
Phase 2A-1R′ → Real Action Binding（Execution Bridge + 真实执行）
    ↓
Phase 2A-2A  → Session / Workspace 基础层（待开始）
```

2A-1R′ 是 2A-1R 的增强版，核心改进：

| 维度 | 2A-1R | 2A-1R′ |
|------|-------|--------|
| 动作执行 | 模拟成功 | 可切换真实执行 |
| 结果标注 | 无 | `executionMode` 显式区分 |
| 桥接层 | 无 | `OperatorExecutionBridge` |
| 安全降级 | 无 | 默认模拟模式 |

---

## 下一步

### 立即行动

1. **接入真实 ControlSurfaceBuilder**
   - 创建真实数据源（TaskDataSource / ApprovalDataSource 等）
   - 初始化 ControlSurfaceBuilder
   - 配置到 ExecutionBridge

2. **验证端到端链路**
   - CLI: `oc approve apv_123` → 真实执行
   - Telegram: `/approve apv_123` → 真实执行
   - 验证动作结果中的 `executionMode = "real"`

3. **接入真实数据源**
   - 更新 `OperatorContextAdapter.fetchControlSnapshot()`
   - 从真实系统读取 ControlSurfaceSnapshot
   - 验证视图数据真实性

### 完成后进入 2A-2A

当满足以下条件时，可以安心进入 2A-2A：

- ✅ 至少 3 个视图读取真实数据
- ✅ 至少 2 个动作真实执行
- ✅ `refresh` 刷新真实状态
- ✅ 入口层能看到真实变化

---

## 已知限制

1. **默认模拟模式**: 需要显式配置 `enableRealExecution = true`
2. **数据源待实现**: ControlSurfaceBuilder 需要真实数据源
3. **部分动作未实现**: `requestRecovery` / `requestReplay` 仍为模拟
4. **无持久化**: 动作执行后状态不持久化

---

_Phase 2A-1R′ 状态：🟡 部分完成 — Execution Bridge 已就绪，待接入真实数据源_
