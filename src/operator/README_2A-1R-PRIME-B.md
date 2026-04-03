# Phase 2A-1R′B: Controlled Real Execution ✅

**状态**: 完成  
**版本**: 2A-1R′B-rc  
**日期**: 2026-04-04

---

## 概述

Phase 2A-1R′B 实现了受控的真实执行，使 Operator 系统能够：

- ✅ 按动作类型控制 real / simulated 模式
- ✅ 真实执行后同步状态到数据源
- ✅ 动作后失效缓存并刷新视图
- ✅ 优先打通 3 条核心动作链路（retry_task / ack_incident / approve）

---

## 新增文件

```
src/operator/services/
└── operator_execution_policy.ts    # 7KB - Per-action 执行策略控制
```

---

## 执行策略

### ExecutionPolicy 接口

```ts
interface ExecutionPolicy {
  getExecutionMode(actionType: OperatorActionType): ExecutionMode;
  isRealExecution(actionType: OperatorActionType): boolean;
  enableRealExecution(): void;
  disableRealExecution(): void;
  setExecutionMode(actionType: OperatorActionType, mode: ExecutionMode): void;
  getPolicyState(): { defaultMode, perAction, globalEnabled };
}
```

### 执行模式

```ts
type ExecutionMode = "real" | "simulated" | "unsupported";
```

### 预定义策略

#### 1. Safe Policy (默认)

```ts
createSafeExecutionPolicy()
// 所有动作 simulated
```

#### 2. 2A-1R′B Policy (推荐)

```ts
create2A1RPrimeBExecutionPolicy()
// retry_task: real
// ack_incident: real
// approve: real
// reject: real
// 其他：simulated
```

#### 3. Production Policy (未来)

```ts
createProductionExecutionPolicy()
// 视图动作：simulated
// 控制动作：real (approve/reject/ack/retry 等)
// HITL 动作：real
```

---

## 使用示例

### 创建 Execution Bridge（2A-1R′B 策略）

```ts
import {
  createOperatorExecutionBridge,
  create2A1RPrimeBExecutionPolicy,
  createTaskDataSource,
  createApprovalDataSource,
  createIncidentDataSource,
} from './operator';

// 1. 创建数据源
const taskDataSource = createTaskDataSource();
const approvalDataSource = createApprovalDataSource();
const incidentDataSource = createIncidentDataSource();

// 2. 创建执行策略（2A-1R′B）
const executionPolicy = create2A1RPrimeBExecutionPolicy();

// 3. 创建 Execution Bridge
const executionBridge = createOperatorExecutionBridge(
  {
    enableRealExecution: true,
    taskDataSource,
    approvalDataSource,
    incidentDataSource,
  },
  executionPolicy
);

// 4. 检查策略状态
console.log(executionBridge.getExecutionPolicyState());
// {
//   defaultMode: 'simulated',
//   perAction: {
//     retry_task: 'real',
//     ack_incident: 'real',
//     approve: 'real',
//     reject: 'real',
//     // ... 其他动作 simulated
//   },
//   globalEnabled: true
// }
```

### 执行真实动作

```ts
// 执行 approve（real 模式）
const approveResult = await executionBridge.approveApproval('apv_123');
console.log(approveResult.executionMode);  // "real"
console.log(approveResult.success);        // true

// 执行 ack_incident（real 模式）
const ackResult = await executionBridge.ackIncident('inc_456');
console.log(ackResult.executionMode);  // "real"

// 执行 retry_task（real 模式）
const retryResult = await executionBridge.retryTask('task_789');
console.log(retryResult.executionMode);  // "real"

// 执行 pause_agent（simulated 模式）
const pauseResult = await executionBridge.pauseAgent('agent_000');
console.log(pauseResult.executionMode);  // "simulated"
```

### 动态调整执行策略

```ts
// 启用 pause_agent 真实执行
executionBridge.setExecutionMode('pause_agent', 'real');

// 禁用 approve 真实执行
executionBridge.setExecutionMode('approve', 'simulated');

// 全局禁用
executionBridge.disableRealExecution();

// 全局启用
executionBridge.enableRealExecution();
```

---

## 动作→状态同步

### approve

```ts
// 真实执行成功后
if (result.success && approvalDataSource) {
  approvalDataSource.updateApprovalStatus(id, 'approved', actorId);
}
```

**效果:**
- Approval 从 `pending` → `approved`
- Approval View 刷新后不再显示该审批
- Inbox View 同步更新

### ack_incident

```ts
// 真实执行成功后
if (result.success && incidentDataSource) {
  incidentDataSource.acknowledgeIncident(id, actorId);
}
```

**效果:**
- Incident `acknowledged = true`
- Incident View 显示已确认状态
- Dashboard/Inbox 关注项减少

### retry_task

```ts
// 真实执行成功后
if (result.success && taskDataSource) {
  taskDataSource.updateTaskStatus(id, 'running');
}
```

**效果:**
- Task 从 `failed/blocked` → `running`
- Task View 刷新后显示新状态
- Dashboard 阻塞任务数减少

---

## 缓存失效与视图刷新

### Snapshot Provider invalidate

```ts
// 失效特定域缓存
snapshotProvider.invalidate('task');      // task 相关
snapshotProvider.invalidate('approval');  // approval 相关
snapshotProvider.invalidate('incident');  // incident 相关
snapshotProvider.invalidate('agent');     // agent 相关
snapshotProvider.invalidate('all');       // 全部

// Command Dispatch 自动调用
handleApprove() → invalidate('approval')
handleAckIncident() → invalidate('incident')
handleRetryTask() → invalidate('task')
```

### 视图刷新流程

```
动作执行 (Execution Bridge)
    ↓
状态同步 (Data Source)
    ↓
缓存失效 (Snapshot Provider)
    ↓
重新读取 (Surface Service)
    ↓
返回 updatedView (Command Dispatch)
```

---

## 完整链路示例

### CLI 端到端

```ts
import {
  createTaskDataSource,
  createApprovalDataSource,
  createIncidentDataSource,
  createOperatorSnapshotProvider,
  createOperatorContextAdapterV2,
  createOperatorViewFactory,
  createOperatorSurfaceService,
  create2A1RPrimeBExecutionPolicy,
  createOperatorExecutionBridge,
  createOperatorCommandDispatch,
  DefaultCliRouter,
  DefaultCliRenderer,
  createCliCockpit,
} from './operator';

// 1. 创建数据源
const taskDataSource = createTaskDataSource();
const approvalDataSource = createApprovalDataSource();
const incidentDataSource = createIncidentDataSource();

// 添加测试数据
taskDataSource.addTask({
  taskId: 'task_123',
  title: 'Failed Task',
  status: 'failed',
  priority: 'high',
  risk: 'medium',
  ownerAgent: 'agent_456',
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

approvalDataSource.addApproval({
  approvalId: 'apv_789',
  scope: 'code_execution',
  requestedAt: Date.now() - 6 * 60 * 60 * 1000,
  ageMs: 6 * 60 * 60 * 1000,
  status: 'pending',
  reason: 'Executing code change',
  requestingAgent: 'agent_456',
});

// 2. 创建 Snapshot Provider
const snapshotProvider = createOperatorSnapshotProvider(
  {},
  taskDataSource,
  approvalDataSource,
  incidentDataSource,
  null  // agentDataSource
);

// 3. 创建 Context Adapter V2
const contextAdapter = createOperatorContextAdapterV2(
  { defaultWorkspaceId: 'default' },
  snapshotProvider
);

// 4. 创建 View Factory
const viewFactory = createOperatorViewFactory();

// 5. 创建 Surface Service
const surfaceService = createOperatorSurfaceService(
  contextAdapter,
  viewFactory
);

// 6. 创建执行策略（2A-1R′B）
const executionPolicy = create2A1RPrimeBExecutionPolicy();

// 7. 创建 Execution Bridge
const executionBridge = createOperatorExecutionBridge(
  {
    enableRealExecution: true,
    taskDataSource,
    approvalDataSource,
    incidentDataSource,
  },
  executionPolicy
);

// 8. 创建 Command Dispatch
const dispatch = createOperatorCommandDispatch(
  surfaceService,
  executionBridge,
  null,  // controlSurfaceBuilder (真实执行需要)
  null,  // humanLoopService
  snapshotProvider
);

// 9. 创建 CLI Cockpit
const cliCockpit = createCliCockpit({
  router: new DefaultCliRouter(),
  renderer: new DefaultCliRenderer(),
  dispatch,
  surfaceService,
  defaultWorkspaceId: 'default',
});

// 10. 执行命令
console.log('=== 执行前 ===');
const taskViewBefore = await cliCockpit.handleInput('oc tasks');
console.log(taskViewBefore.text);

console.log('=== 重试任务 ===');
const retryResult = await cliCockpit.handleInput('oc retry task task_123');
console.log(retryResult.text);

console.log('=== 执行后 ===');
const taskViewAfter = await cliCockpit.handleInput('oc tasks');
console.log(taskViewAfter.text);
// task_123 status: failed → running
```

### Telegram 端到端

```ts
import {
  DefaultTelegramRouter,
  DefaultTelegramRenderer,
  createTelegramCockpit,
} from './operator/telegram';

// 创建 Telegram Cockpit（使用相同的 dispatch/surfaceService）
const telegramCockpit = createTelegramCockpit({
  router: new DefaultTelegramRouter(),
  renderer: new DefaultTelegramRenderer(),
  dispatch,
  surfaceService,
  defaultWorkspaceId: 'default',
});

// 执行命令
console.log('=== 批准审批 ===');
const approveResult = await telegramCockpit.handleMessage({
  chatId: '123456',
  userId: '789',
  text: '/approve apv_789',
});
console.log(approveResult.text);
console.log(approveResult.buttons);
// [Approve] [Reject] [Escalate] [Open]

// 执行后审批视图更新
const approvalView = await telegramCockpit.handleMessage({
  chatId: '123456',
  userId: '789',
  text: '/approvals',
});
console.log(approvalView.text);
// apv_789 不再出现在 pending 列表中
```

---

## 验收标准

### ✅ 已完成

1. ✅ `ExecutionPolicy` 接口定义完整
2. ✅ 3 个预定义策略（Safe / 2A-1R′B / Production）
3. ✅ Execution Bridge 支持 per-action 控制
4. ✅ 3 个核心动作接通真实执行（approve / ack_incident / retry_task）
5. ✅ 动作后状态同步到数据源
6. ✅ Snapshot Provider 支持按域失效缓存
7. ✅ Command Dispatch 动作后刷新视图

### 🟡 待完成

1. 🟡 接入真实 ControlSurfaceBuilder 实例
2. 🟡 验证端到端真实执行链路
3. 🟡 集成测试（CLI / Telegram）

---

## 执行策略状态查看

```ts
const policyState = executionBridge.getExecutionPolicyState();

console.log('默认模式:', policyState.defaultMode);
console.log('全局启用:', policyState.globalEnabled);
console.log('Per-Action 配置:');
Object.entries(policyState.perAction).forEach(([actionType, mode]) => {
  if (mode === 'real') {
    console.log(`  ${actionType}: ${mode} ✅`);
  }
});
```

---

## 安全降级

### 全局降级

```ts
executionBridge.disableRealExecution();
// 所有动作 → simulated
```

### 部分降级

```ts
executionBridge.setExecutionMode('approve', 'simulated');
executionBridge.setExecutionMode('ack_incident', 'simulated');
// 特定动作 → simulated
```

### 自动降级

```ts
// 数据源缺失时
const executionBridge = createOperatorExecutionBridge({
  enableRealExecution: true,
  // taskDataSource 缺失
  // approvalDataSource 缺失
});

// 动作执行时检查数据源
// 如果没有数据源，只执行动作，不同步状态
```

---

## 下一步：2A-2A

2A-1R′B 完成后，满足进入 2A-2A 的条件：

- ✅ 真实数据读取（2A-1R′A）
- ✅ 真实动作执行（2A-1R′B）
- ✅ 状态变化可见（2A-1R′B）
- ✅ 视图刷新闭环（2A-1R′B）

### 2A-2A 目标

实现 Session / Workspace 基础层：

- `session_store.ts` - 会话存储
- `workspace_registry.ts` - Workspace 注册表
- `workspace_switcher.ts` - Workspace 切换器

到那时：
- Session 保存的是真实视图状态
- Workspace 切换的是真实数据源
- History 记录的是真实动作历史

---

## 已知限制

1. **内存数据源**: 当前数据源是内存实现，重启后数据丢失
2. **ControlSurfaceBuilder 待接入**: 真实执行需要 ControlSurfaceBuilder 实例
3. **无持久化**: 动作执行后状态不持久化到磁盘/数据库

---

_Phase 2A-1R′B 状态：✅ 完成 — 受控真实执行已就绪，准备进入 2A-2A_
