# Sprint 6B 完成报告 - Control Surface / Command Views

**日期**: 2026-04-03  
**阶段**: Sprint 6B (Control Surface / Command Views)  
**状态**: ✅ 完成

---

## 交付文件（6 个核心模块）

| 文件 | 行数 | 功能 |
|------|------|------|
| `control_types.ts` | ~240 行 | 控制面核心类型定义 |
| `task_view.ts` | ~320 行 | 任务视图 |
| `approval_view.ts` | ~280 行 | 审批视图 |
| `ops_view.ts` | ~255 行 | 运维视图 |
| `agent_view.ts` | ~260 行 | Agent 视图 |
| `control_surface.ts` | ~240 行 | 统一控制面 |

**新增总计**: ~1595 行代码

---

## 核心能力交付

### ✅ 1. Control Types - 类型定义

**文件**: `control_types.ts`

**核心类型**:
| 类型 | 说明 |
|------|------|
| `TaskStatus` | 任务状态（7 种） |
| `ApprovalStatus` | 审批状态（6 种） |
| `AgentStatus` | Agent 状态（5 种） |
| `ServerStatus` | Server 状态（3 种） |
| `Priority` | 优先级（4 级） |
| `Severity` | 严重级别（4 级） |
| `TaskViewModel` | 任务视图模型 |
| `ApprovalViewModel` | 审批视图模型 |
| `OpsViewModel` | 运维视图模型 |
| `AgentViewModel` | Agent 视图模型 |
| `ControlAction` | 控制动作 |
| `ControlActionResult` | 控制动作结果 |
| `ControlSurfaceSnapshot` | 控制面快照 |

**任务视图模型字段**:
```typescript
{
  taskId: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  risk: Severity;
  ownerAgent: string;
  createdAt: number;
  updatedAt: number;
  blockedReason?: string;
  nextAction?: string;
  progress?: number;
  retryCount?: number;
  durationMs?: number;
}
```

**控制动作类型** (13 种):
- Task: `cancel_task` / `retry_task` / `pause_task` / `resume_task`
- Approval: `approve` / `reject` / `escalate_approval`
- Ops: `ack_incident` / `request_replay` / `request_recovery`
- Agent: `pause_agent` / `resume_agent` / `inspect_agent`

---

### ✅ 2. Task View - 任务视图

**文件**: `task_view.ts`

**核心功能**:
| 方法 | 功能 |
|------|------|
| `buildTaskView(filter, sort)` | 构建任务视图 |
| `listActiveTasks()` | 列出活跃任务 |
| `listBlockedTasks()` | 列出阻塞任务 |
| `listRecentCompletedTasks()` | 列出最近完成的任务 |
| `buildTaskTimelineSummary(taskId)` | 构建任务时间线摘要 |
| `cancelTask(taskId)` | 取消任务 |
| `retryTask(taskId)` | 重试任务 |
| `pauseTask(taskId)` | 暂停任务 |

**任务分类**:
- `activeTasks` - 运行中/待处理
- `blockedTasks` - 被阻塞
- `recentCompletedTasks` - 最近完成
- `failedTasks` - 失败

**视图特性**:
- 支持过滤（状态/优先级/Agent/关键词）
- 支持排序（创建时间/更新时间/优先级/风险）
- 限制数量（可配置）
- 时间线摘要（24 小时/7 天/成功率）

---

### ✅ 3. Approval View - 审批视图

**文件**: `approval_view.ts`

**核心功能**:
| 方法 | 功能 |
|------|------|
| `buildApprovalView(filter)` | 构建审批视图 |
| `listPendingApprovals()` | 列出待处理审批 |
| `listApprovalBottlenecks()` | 列出审批瓶颈 |
| `summarizeApprovalFlow()` | 总结审批流 |
| `approve(approvalId)` | 批准审批 |
| `reject(approvalId)` | 拒绝审批 |
| `escalate(approvalId)` | 升级审批 |

**审批视图内容**:
- `pendingApprovals` - 待处理审批
- `bottlenecks` - 审批瓶颈（按类型分组）
- `timeoutApprovals` - 超时审批
- `recentDecidedApprovals` - 最近决定的审批
- `flowSummary` - 审批流摘要（批准率/拒绝率/平均决定时间）

**瓶颈分析**:
```typescript
{
  type: string;
  pendingCount: number;
  avgWaitTimeMs: number;
}
```

---

### ✅ 4. Ops View - 运维视图

**文件**: `ops_view.ts`

**核心功能**:
| 方法 | 功能 |
|------|------|
| `buildOpsView()` | 构建运维视图 |
| `listDegradedServers()` | 列出降级 Server |
| `listBlockedSkills()` | 列出被阻塞 Skill |
| `listTopIncidents()` | 列出顶级事件 |
| `ackIncident(incidentId)` | 确认事件 |
| `requestReplay(taskId)` | 请求重放 |
| `requestRecovery(taskId)` | 请求恢复 |

**运维视图内容**:
- `overallStatus` - healthy/degraded/critical
- `healthScore` - 健康评分（0-100）
- `degradedServers` - 降级 Server 列表
- `blockedSkills` - 被阻塞 Skill 列表
- `pendingApprovals` - 待处理审批数
- `activeIncidents` - 活跃事件
- `topFailures` - 顶级失败
- `replayHotspots` - 重放热点

**数据来源**:
- HealthMetricsDataSource - 健康快照
- OpsSummaryDataSource - 运维摘要

---

### ✅ 5. Agent View - Agent 视图

**文件**: `agent_view.ts`

**核心功能**:
| 方法 | 功能 |
|------|------|
| `buildAgentView(filter)` | 构建 Agent 视图 |
| `listBusyAgents()` | 列出忙碌 Agent |
| `listBlockedAgents()` | 列出阻塞 Agent |
| `listUnhealthyAgents()` | 列出不健康 Agent |
| `pauseAgent(agentId)` | 暂停 Agent |
| `resumeAgent(agentId)` | 恢复 Agent |
| `inspectAgent(agentId)` | 检查 Agent |

**Agent 状态判定**:
- `offline` - 5 分钟无活动
- `unhealthy` - 健康评分 < 50
- `blocked` - 有阻塞任务
- `busy` - 有活跃任务
- `idle` - 空闲

**健康评分计算**:
```typescript
baseScore = (1 - failureRate) * 100
taskLoadPenalty = min(20, activeTaskCount * 2)
blockedPenalty = blockedTaskCount * 10
healthScore = max(0, baseScore - taskLoadPenalty - blockedPenalty)
```

**负载摘要**:
```typescript
{
  avgActiveTasks: number;
  avgFailureRate: number;
  avgHealthScore: number;
}
```

---

### ✅ 6. Control Surface - 统一控制面

**文件**: `control_surface.ts`

**核心功能**:
| 方法 | 功能 |
|------|------|
| `buildControlSurfaceSnapshot()` | 构建控制面快照 |
| `dispatchControlAction(action)` | 分发控制动作 |
| `refreshSurface()` | 刷新控制面 |
| `getAvailableActions(...)` | 获取可用动作 |

**控制面快照**:
```typescript
{
  snapshotId: string;
  createdAt: number;
  taskView: TaskView;
  approvalView: ApprovalView;
  opsView: OpsViewModel;
  agentView: AgentView;
  availableActions: ControlAction[];
  summary: {
    totalTasks: number;
    pendingApprovals: number;
    healthScore: number;
    activeAgents: number;
    attentionItems: number;
  };
}
```

**可用动作自动生成**:
- 阻塞/失败任务 → retry_task
- 待处理审批 → approve/reject
- 未确认事件 → ack_incident
- 阻塞 Agent → inspect_agent

---

## 验收标准验证

### ✅ 1. Task View 能展示 active / blocked / completed

**验证**:
```typescript
const taskView = await builder.buildTaskView();

expect(taskView.activeTasks).toBeDefined();
expect(taskView.blockedTasks).toBeDefined();
expect(taskView.recentCompletedTasks).toBeDefined();
expect(taskView.failedTasks).toBeDefined();

// 验证任务视图模型字段
const task = taskView.activeTasks[0];
expect(task).toHaveProperty('taskId');
expect(task).toHaveProperty('title');
expect(task).toHaveProperty('status');
expect(task).toHaveProperty('priority');
expect(task).toHaveProperty('ownerAgent');
expect(task).toHaveProperty('nextAction');
```

**状态**: ✅ **通过**

---

### ✅ 2. Approval View 能展示 pending / bottlenecks

**验证**:
```typescript
const approvalView = await builder.buildApprovalView();

expect(approvalView.pendingApprovals).toBeDefined();
expect(approvalView.bottlenecks).toBeDefined();
expect(approvalView.timeoutApprovals).toBeDefined();

// 验证瓶颈分析
const bottlenecks = approvalView.bottlenecks;
for (const bottleneck of bottlenecks) {
  expect(bottleneck).toHaveProperty('type');
  expect(bottleneck).toHaveProperty('pendingCount');
  expect(bottleneck).toHaveProperty('avgWaitTimeMs');
}

// 验证审批流摘要
expect(approvalView.flowSummary).toBeDefined();
expect(approvalView.flowSummary?.approvalRate).toBeDefined();
expect(approvalView.flowSummary?.avgDecisionTimeMs).toBeDefined();
```

**状态**: ✅ **通过**

---

### ✅ 3. Ops View 能展示 health / degraded / blocked

**验证**:
```typescript
const opsView = await builder.buildOpsView();

expect(opsView.overallStatus).toBeDefined();
expect(opsView.healthScore).toBeDefined();
expect(opsView.degradedServers).toBeDefined();
expect(opsView.blockedSkills).toBeDefined();

// 验证降级 Server
for (const server of opsView.degradedServers) {
  expect(server).toHaveProperty('serverId');
  expect(server).toHaveProperty('status');
  expect(server).toHaveProperty('errorRate');
}

// 验证被阻塞 Skill
for (const skill of opsView.blockedSkills) {
  expect(skill).toHaveProperty('skillName');
  expect(skill).toHaveProperty('status');
  expect(skill).toHaveProperty('count');
}
```

**状态**: ✅ **通过**

---

### ✅ 4. Agent View 能展示 workload / blocked / failures

**验证**:
```typescript
const agentView = await builder.buildAgentView();

expect(agentView.busyAgents).toBeDefined();
expect(agentView.blockedAgents).toBeDefined();
expect(agentView.unhealthyAgents).toBeDefined();
expect(agentView.offlineAgents).toBeDefined();

// 验证 Agent 视图模型
const agent = agentView.busyAgents[0];
expect(agent).toHaveProperty('agentId');
expect(agent).toHaveProperty('role');
expect(agent).toHaveProperty('status');
expect(agent).toHaveProperty('activeTaskCount');
expect(agent).toHaveProperty('blockedTaskCount');
expect(agent).toHaveProperty('failureRate');
expect(agent).toHaveProperty('healthScore');

// 验证负载摘要
expect(agentView.loadSummary).toBeDefined();
expect(agentView.loadSummary?.avgActiveTasks).toBeDefined();
expect(agentView.loadSummary?.avgFailureRate).toBeDefined();
```

**状态**: ✅ **通过**

---

### ✅ 5. control surface 支持基础控制动作分发

**验证**:
```typescript
const snapshot = await controlSurfaceBuilder.buildControlSurfaceSnapshot();

// 验证快照结构
expect(snapshot).toHaveProperty('snapshotId');
expect(snapshot).toHaveProperty('taskView');
expect(snapshot).toHaveProperty('approvalView');
expect(snapshot).toHaveProperty('opsView');
expect(snapshot).toHaveProperty('agentView');
expect(snapshot).toHaveProperty('availableActions');
expect(snapshot).toHaveProperty('summary');

// 验证可用动作
const actions = snapshot.availableActions;
for (const action of actions) {
  expect(action).toHaveProperty('type');
  expect(action).toHaveProperty('targetType');
  expect(action).toHaveProperty('targetId');
  expect(action).toHaveProperty('requestedBy');
}

// 验证动作分发
const result = await controlSurfaceBuilder.dispatchControlAction({
  type: 'cancel_task',
  targetType: 'task',
  targetId: 'task_123',
  requestedBy: 'test',
  requestedAt: Date.now(),
});

expect(result).toHaveProperty('success');
expect(result).toHaveProperty('actionType');
expect(result).toHaveProperty('targetId');
```

**状态**: ✅ **通过**

---

### ✅ 6. 四类视图都能与 6A 风格格式化层兼容

**验证**:
```typescript
// 使用 6A 格式化控制面快照
const content: StructuredResponseContent = {
  summary: `System ${snapshot.summary.healthScore >= 70 ? 'healthy' : 'degraded'}`,
  status: `Health Score: ${snapshot.summary.healthScore}/100`,
  metrics: {
    totalTasks: snapshot.summary.totalTasks,
    pendingApprovals: snapshot.summary.pendingApprovals,
    activeAgents: snapshot.summary.activeAgents,
    attentionItems: snapshot.summary.attentionItems,
  },
  warnings: snapshot.opsView.activeIncidents.map(i => ({
    warning: i.description,
    severity: i.severity,
  })),
  actions: snapshot.availableActions.map(a => ({
    action: `${a.type} ${a.targetId}`,
    priority: 'medium',
  })),
};

// 使用不同风格格式化
const minimalResult = formatter.formatResponse(content, 'minimal');
const auditResult = formatter.formatResponse(content, 'audit');
const opsResult = formatter.formatResponse(content, 'ops');

// 验证输出差异
expect(minimalResult.text.length).toBeLessThan(auditResult.text.length);
expect(opsResult.sections.some(s => s.type === 'metrics')).toBe(true);
```

**状态**: ✅ **通过**

---

## 与现有主干的接法

### 与 TaskStore 集成
```typescript
const taskDataSource: TaskDataSource = {
  async listTasks(filter?: any) {
    return await taskStore.list(filter);
  },
  async getTask(taskId: string) {
    return await taskStore.get(taskId);
  },
  async cancelTask(taskId: string, reason?: string) {
    await taskStore.cancel(taskId, reason);
  },
  async retryTask(taskId: string) {
    await taskStore.retry(taskId);
  },
  async pauseTask(taskId: string) {
    await taskStore.pause(taskId);
  },
};
```

### 与 ApprovalBridge 集成
```typescript
const approvalDataSource: ApprovalDataSource = {
  async listPending() {
    return await approvalBridge.listPending();
  },
  async listHistory(limit?: number) {
    return await approvalBridge.listHistory(limit);
  },
  async approve(approvalId: string, reason?: string) {
    await approvalBridge.approve(approvalId, reason);
  },
  async reject(approvalId: string, reason?: string) {
    await approvalBridge.reject(approvalId, reason);
  },
  async escalate(approvalId: string, reason?: string) {
    await approvalBridge.escalate(approvalId, reason);
  },
};
```

### 与 AuditLog 集成
```typescript
const auditDataSource: AuditDataSource = {
  async queryAuditEvents(query: any) {
    return await auditLog.query(query);
  },
  async getTaskAuditTrail(taskId: string) {
    return await auditLog.getTaskAuditTrail(taskId);
  },
};
```

### 与 HealthMetrics / OpsSummary 集成
```typescript
const healthMetricsDataSource: HealthMetricsDataSource = {
  async getHealthSnapshot() {
    return healthMetricsCalculator.computeHealthSnapshot(context);
  },
};

const opsSummaryDataSource: OpsSummaryDataSource = {
  async getOpsSummary() {
    return opsSummaryGenerator.buildOpsSummary(snapshot, auditData);
  },
};
```

### 与 6A Output Styles 集成
```typescript
// 所有视图数据都可被 6A 格式化
const formatted = formatter.formatResponse({
  summary: snapshot.summary.healthScore >= 70 ? 'System healthy' : 'System degraded',
  status: `Health: ${snapshot.summary.healthScore}/100`,
  metrics: {
    tasks: snapshot.summary.totalTasks,
    approvals: snapshot.summary.pendingApprovals,
    agents: snapshot.summary.activeAgents,
  },
  actions: snapshot.availableActions.map(a => ({
    action: `${a.type} ${a.targetId}`,
  })),
}, 'ops');
```

---

## 结论

**Sprint 6B 验收**: ✅ **通过**

**6 条验收标准全部满足**:
1. ✅ Task View 能展示 active / blocked / completed
2. ✅ Approval View 能展示 pending / bottlenecks
3. ✅ Ops View 能展示 health / degraded / blocked
4. ✅ Agent View 能展示 workload / blocked / failures
5. ✅ control surface 支持基础控制动作分发
6. ✅ 四类视图都能与 6A 风格格式化层兼容

**状态**: Control Surface / Command Views 完成，统一操作视图已稳固

---

**Sprint 6 完成度**: 2/4 (50%)

_Sprint 6B 完成，准备进入 Sprint 6C（Dashboard / Status Projection）_
