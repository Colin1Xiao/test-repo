# Phase 2A-1R′A: Real Data Source Binding ✅

**状态**: 完成  
**版本**: 2A-1R′A-rc  
**日期**: 2026-04-04

---

## 概述

Phase 2A-1R′A 实现了真实数据源层，使 Operator 系统能够读取真实数据：

- ✅ 4 个数据源接口（Task / Approval / Incident / Agent）
- ✅ `OperatorSnapshotProvider` - 组装多数据源成 ControlSurfaceSnapshot
- ✅ `OperatorContextAdapterV2` - 使用真实数据源的 Context Adapter
- ✅ 数据来源标注（`real` / `synthesized` / `mock`）
- ✅ 降级策略（真实 → 空视图）

---

## 新增文件

```
src/operator/data/
├── task_data_source.ts              # 5KB  - 任务数据源
├── approval_data_source.ts          # 7KB  - 审批数据源
├── incident_data_source.ts          # 8KB  - 事件数据源
├── agent_data_source.ts             # 7KB  - Agent 数据源
├── operator_snapshot_provider.ts    # 15KB - 快照组装器
└── index.ts                         # 2KB  - 统一导出

src/operator/services/
└── operator_context_adapter_v2.ts   # 7KB  - V2 Context Adapter
```

---

## 数据源层架构

```
┌─────────────────────────────────────────────────────────────┐
│                  OperatorContextAdapterV2                    │
│  - 使用 SnapshotProvider 获取真实数据                         │
│  - 使用 StatusProjection 投影 Dashboard                       │
│  - 使用 HumanLoopService 处理 HITL                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ↓
┌─────────────────────────────────────────────────────────────┐
│              OperatorSnapshotProvider                        │
│  - 并行读取 4 个数据源                                         │
│  - 组装成 ControlSurfaceSnapshot                             │
│  - 缓存管理 + 降级策略                                        │
└──────────────┬──────────────────────────────────────────────┘
               │
       ┌───────┴────────┬──────────┬──────────┐
       ↓                ↓          ↓          ↓
┌─────────────┐ ┌────────────┐ ┌─────────┐ ┌──────────┐
│    Task     │ │ Approval   │ │Incident │ │  Agent   │
│ DataSource  │ │ DataSource │ │DataSource│ │DataSource│
└─────────────┘ └────────────┘ └─────────┘ └──────────┘
```

---

## 数据源接口

### TaskDataSource

```ts
interface TaskDataSource {
  getTaskView(): Promise<TaskView>;
  getActiveTasks(limit?: number): Promise<TaskViewModel[]>;
  getBlockedTasks(limit?: number): Promise<TaskViewModel[]>;
  getFailedTasks(limit?: number): Promise<TaskViewModel[]>;
  getTaskById(taskId: string): Promise<TaskViewModel | null>;
  getTaskSummary(): Promise<{ total, active, blocked, failed, completed }>;
}
```

### ApprovalDataSource

```ts
interface ApprovalDataSource {
  getApprovalView(): Promise<ApprovalView>;
  getPendingApprovals(limit?: number): Promise<ApprovalViewModel[]>;
  getTimeoutApprovals(limit?: number): Promise<ApprovalViewModel[]>;
  getBottlenecks(): Promise<ApprovalView['bottlenecks']>;
  getApprovalById(approvalId: string): Promise<ApprovalViewModel | null>;
  getApprovalSummary(): Promise<{ total, pending, approved, rejected, timeout }>;
}
```

### IncidentDataSource

```ts
interface IncidentDataSource {
  getActiveIncidents(limit?: number): Promise<IncidentItem[]>;
  getUnacknowledgedIncidents(limit?: number): Promise<IncidentItem[]>;
  getIncidentById(incidentId: string): Promise<IncidentItem | null>;
  getDegradedServices(limit?: number): Promise<DegradedService[]>;
  getReplayHotspots(limit?: number): Promise<ReplayHotspot[]>;
  getIncidentSummary(): Promise<{ total, active, acknowledged, unacknowledged, resolved, critical }>;
}
```

### AgentDataSource

```ts
interface AgentDataSource {
  getBusyAgents(limit?: number): Promise<AgentItem[]>;
  getBlockedAgents(limit?: number): Promise<AgentItem[]>;
  getUnhealthyAgents(limit?: number): Promise<AgentItem[]>;
  getOfflineAgents(limit?: number): Promise<AgentItem[]>;
  getAgentById(agentId: string): Promise<AgentItem | null>;
  getAgentSummary(): Promise<{ total, busy, blocked, unhealthy, offline, avgHealthScore }>;
}
```

---

## 数据来源模式

```ts
type DataSourceMode = "real" | "synthesized" | "mock";
```

| 模式 | 说明 | 使用场景 |
|------|------|----------|
| `real` | 从真实数据源读取 | 已实现数据源接口 |
| `synthesized` | 从现有 Sprint 6 服务合成 | 临时降级 |
| `mock` | 返回空视图/模拟数据 | 数据源不可用 |

### 查看数据源健康状态

```ts
const health = await contextAdapter.getDataSourceHealth();

console.log(health);
// {
//   task: 'real',
//   approval: 'real',
//   incident: 'mock',
//   agent: 'real'
// }
```

---

## 使用示例

### 创建数据源

```ts
import {
  createTaskDataSource,
  createApprovalDataSource,
  createIncidentDataSource,
  createAgentDataSource,
  createOperatorSnapshotProvider,
  createOperatorContextAdapterV2,
} from './operator';

// 1. 创建数据源（内存实现用于测试）
const taskDataSource = createTaskDataSource({ defaultLimit: 50 });
const approvalDataSource = createApprovalDataSource({ defaultLimit: 50 });
const incidentDataSource = createIncidentDataSource({ defaultLimit: 50 });
const agentDataSource = createAgentDataSource({ defaultLimit: 50 });

// 2. 添加测试数据
taskDataSource.addTask({
  taskId: 'task_123',
  title: 'Test Task',
  status: 'blocked',
  priority: 'high',
  risk: 'medium',
  ownerAgent: 'agent_456',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  blockedReason: 'Waiting for approval',
});

approvalDataSource.addApproval({
  approvalId: 'apv_789',
  scope: 'code_execution',
  requestedAt: Date.now() - 6 * 60 * 60 * 1000, // 6 小时前
  ageMs: 6 * 60 * 60 * 1000,
  status: 'pending',
  reason: 'Executing code change',
  requestingAgent: 'agent_456',
});

// 3. 创建 Snapshot Provider
const snapshotProvider = createOperatorSnapshotProvider(
  { defaultWorkspaceId: 'default' },
  taskDataSource,
  approvalDataSource,
  incidentDataSource,
  agentDataSource
);

// 4. 创建 Context Adapter V2
const contextAdapter = createOperatorContextAdapterV2(
  { defaultWorkspaceId: 'default' },
  snapshotProvider
);
```

### 读取真实数据

```ts
// 获取 ControlSnapshot
const control = await contextAdapter.getControlSnapshot();
console.log(control.summary);
// {
//   totalTasks: 1,
//   pendingApprovals: 1,
//   healthScore: 100,
//   activeAgents: 0,
//   attentionItems: 2
// }

// 获取数据源健康状态
const health = await contextAdapter.getDataSourceHealth();
console.log(health);
// { task: 'real', approval: 'real', incident: 'mock', agent: 'mock' }

// 刷新数据
await contextAdapter.refresh();
```

### 集成到 Surface Service

```ts
import {
  createOperatorViewFactory,
  createOperatorSurfaceService,
} from './operator';

// 创建 ViewFactory
const viewFactory = createOperatorViewFactory();

// 创建 Surface Service
const surfaceService = createOperatorSurfaceService(
  contextAdapter,
  viewFactory
);

// 读取真实视图
const dashboardView = await surfaceService.getDashboardView({
  actor: { surface: 'cli' },
  viewKind: 'dashboard',
});

console.log(dashboardView.content);
// 真实数据，不再是 mock
```

---

## 降级策略

### 数据源不可用时

```ts
// 不传入数据源
const snapshotProvider = createOperatorSnapshotProvider();

// 返回空视图
const control = await snapshotProvider.getControlSnapshot();
console.log(control.taskView);
// {
//   activeTasks: [],
//   blockedTasks: [],
//   recentCompletedTasks: [],
//   failedTasks: [],
//   totalTasks: 0
// }
```

### 部分数据源可用

```ts
// 只传入部分数据源
const snapshotProvider = createOperatorSnapshotProvider(
  {},
  taskDataSource,      // ✅ 真实
  approvalDataSource,  // ✅ 真实
  // incidentDataSource 缺失 → mock
  // agentDataSource 缺失 → mock
);

const health = await snapshotProvider.getDataSourceHealth();
console.log(health);
// { task: 'real', approval: 'real', incident: 'mock', agent: 'mock' }
```

---

## 验收标准

### ✅ 已完成

1. ✅ 4 个数据源接口定义完整
2. ✅ 内存实现用于测试/降级
3. ✅ `OperatorSnapshotProvider` 组装多数据源
4. ✅ `OperatorContextAdapterV2` 使用真实数据
5. ✅ 数据来源标注（`getDataSourceHealth()`）
6. ✅ 降级策略（真实 → 空视图）

### 🟡 待完成

1. 🟡 接入真实数据源实现（非内存）
2. 🟡 验证端到端真实数据链路
3. 🟡 集成测试（CLI / Telegram）

---

## 真实数据源接入

### 接入现有系统

如果你的系统已有数据存储，可以实现真实的数据源：

```ts
import type { TaskDataSource, TaskViewModel, TaskView } from './operator';

class DatabaseTaskDataSource implements TaskDataSource {
  constructor(private db: Database) {}
  
  async getTaskView(): Promise<TaskView> {
    const tasks = await this.db.tasks.findAll();
    
    // 转换为 TaskViewModel
    const activeTasks = tasks
      .filter(t => t.status === 'running' || t.status === 'pending')
      .map(t => this.toViewModel(t));
    
    // ...
    
    return {
      activeTasks,
      blockedTasks: /* ... */,
      recentCompletedTasks: /* ... */,
      failedTasks: /* ... */,
      totalTasks: tasks.length,
    };
  }
  
  private toViewModel(task: Task): TaskViewModel {
    return {
      taskId: task.id,
      title: task.title,
      status: task.status,
      // ...
    };
  }
  
  // ...其他方法
}
```

### 接入 OKX 交易系统

```ts
import type { AgentDataSource, AgentItem } from './operator';

class TradingAgentDataSource implements AgentDataSource {
  constructor(private tradingSystem: TradingSystem) {}
  
  async getAgentById(agentId: string): Promise<AgentItem | null> {
    const agent = await this.tradingSystem.getAgent(agentId);
    
    if (!agent) return null;
    
    return {
      agentId: agent.id,
      role: agent.role,
      status: agent.status,
      activeTaskCount: agent.activeTasks.length,
      blockedTaskCount: agent.blockedTasks.length,
      failureRate: agent.failureRate,
      lastSeenAt: agent.lastActivity,
      healthScore: agent.healthScore,
    };
  }
  
  // ...其他方法
}
```

---

## 下一步：2A-1R′B

数据源层完成后，可以进入 **2A-1R′B: Controlled Real Execution**：

1. 启用 `enableRealExecution = true`
2. 验证真实动作执行
3. 验证动作后状态刷新

### 首批真实动作建议

| 动作 | 风险 | 验证难度 | 推荐顺序 |
|------|------|----------|----------|
| `retry_task` | 低 | 容易 | 1 |
| `ack_incident` | 低 | 容易 | 2 |
| `approve` | 中 | 中等 | 3 |
| `pause_agent` | 中 | 中等 | 4 |

---

## 与 2A-1R′ 的关系

```
Phase 2A-1R′ (Execution Bridge)
    ↓
Phase 2A-1R′A (Real Data Source) ✅ 完成
    ↓
Phase 2A-1R′B (Controlled Real Execution) 🔜 下一步
```

2A-1R′A 为 2A-1R′B 提供：
- 真实数据读取能力
- 数据来源可观测性
- 状态变化可见性

---

## 已知限制

1. **内存实现**: 当前数据源是内存实现，重启后数据丢失
2. **无持久化**: 需要接入真实数据库/存储系统
3. **无实时更新**: 需要轮询或 WebSocket 推送

---

_Phase 2A-1R′A 状态：✅ 完成 — 真实数据源层已就绪，准备进入 2A-1R′B_
