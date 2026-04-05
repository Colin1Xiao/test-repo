# Sprint 6C 完成报告 - Dashboard / Status Projection

**日期**: 2026-04-03  
**阶段**: Sprint 6C (Dashboard / Status Projection)  
**状态**: ✅ 完成

---

## 交付文件（6 个核心模块）

| 文件 | 行数 | 功能 |
|------|------|------|
| `dashboard_types.ts` | ~225 行 | Dashboard/Projection 类型定义 |
| `attention_engine.ts` | ~300 行 | 注意力引擎 |
| `dashboard_builder.ts` | ~480 行 | 仪表盘构建器 |
| `projection_service.ts` | ~410 行 | 投影服务 |
| `dashboard_refresh.ts` | ~300 行 | 仪表盘刷新 |
| `status_projection.ts` | ~230 行 | 状态投影统一出口 |

**新增总计**: ~1945 行代码

---

## 核心能力交付

### ✅ 1. Dashboard Types - 类型定义

**文件**: `dashboard_types.ts`

**核心类型**:
| 类型 | 说明 |
|------|------|
| `ProjectionMode` | 投影模式（7 种） |
| `ProjectionTarget` | 投影目标（5 种） |
| `DashboardStatus` | 仪表盘状态（4 种） |
| `DashboardSummary` | 仪表盘摘要 |
| `DashboardSection` | 仪表盘分段 |
| `DashboardCard` | 仪表盘卡片 |
| `StatusBadge` | 状态徽章 |
| `AttentionItem` | 关注项 |
| `DashboardSnapshot` | 仪表盘快照 |
| `ProjectionResult` | 投影结果 |
| `RefreshResult` | 刷新结果 |
| `StaleDetection` | 陈旧检测 |

**投影模式** (7 种):
- `summary` - 摘要模式
- `detail` - 详情模式
- `operator` - 操作员模式
- `management` - 管理模式
- `incident` - 事件模式
- `approval_focus` - 审批聚焦
- `agent_focus` - Agent 聚焦

**投影目标** (5 种):
- `cli` - 命令行
- `telegram` - Telegram
- `web` - Web UI
- `audit` - 审计
- `api` - API

**仪表盘快照结构**:
```typescript
{
  dashboardId: string;
  sourceSnapshotId: string;
  createdAt: number;
  updatedAt: number;
  freshnessMs: number;
  summary: DashboardSummary;
  sections: DashboardSection[];
  attentionItems: AttentionItem[];
  recommendedActions: ControlAction[];
}
```

---

### ✅ 2. Attention Engine - 注意力引擎

**文件**: `attention_engine.ts`

**核心功能**:
| 方法 | 功能 |
|------|------|
| `registerRule(rule)` | 注册注意力规则 |
| `analyze(snapshot)` | 分析快照生成关注项 |
| `getAllRules()` | 获取所有规则 |

**内置规则** (7 条):
| 规则 | 说明 | 严重级别 |
|------|------|---------|
| `AGED_APPROVAL_RULE` | 超时审批（>1 小时） | high |
| `BLOCKED_TASK_RULE` | 阻塞任务 | high |
| `FAILED_TASK_RULE` | 失败任务 | medium |
| `DEGRADED_SERVER_RULE` | 降级 Server | critical |
| `UNHEALTHY_AGENT_RULE` | 不健康 Agent | high |
| `REPLAY_HOTSPOT_RULE` | 重放热点 | medium |
| `TOP_FAILURE_RULE` | 顶级失败 | high |

**关注项结构**:
```typescript
{
  id: string;
  sourceType: 'task' | 'approval' | 'ops' | 'agent';
  sourceId: string;
  title: string;
  reason: string;
  severity: 'medium' | 'high' | 'critical';
  ageMs?: number;
  recommendedAction?: ControlAction;
}
```

---

### ✅ 3. Dashboard Builder - 仪表盘构建器

**文件**: `dashboard_builder.ts`

**核心功能**:
| 方法 | 功能 |
|------|------|
| `buildDashboardSnapshot(controlSnapshot)` | 构建仪表盘快照 |
| `refreshDashboardSnapshot(oldDashboard, newControlSnapshot)` | 刷新仪表盘 |

**分段类型** (6 种):
- `tasks` - 任务分段
- `approvals` - 审批分段
- `ops` - 运维分段
- `agents` - Agent 分段
- `incidents` - 事件分段
- `actions` - 动作分段

**仪表盘卡片**:
```typescript
{
  id: string;
  kind: string;
  title: string;
  subtitle?: string;
  status: string;
  severity?: Severity;
  owner?: string;
  updatedAt?: number;
  stale?: boolean;
  fields: Record<string, unknown>;
  suggestedActions?: ControlAction[];
}
```

**变化检测**:
- 状态变化
- 健康评分变化
- 关注项新增/移除/更新
- 分段变化

---

### ✅ 4. Projection Service - 投影服务

**文件**: `projection_service.ts`

**核心功能**:
| 方法 | 功能 |
|------|------|
| `project(dashboard, options)` | 投影仪表盘 |
| `projectSummary(dashboard)` | 摘要投影 |
| `projectDetail(dashboard)` | 详情投影 |
| `projectOperator(dashboard)` | 操作员投影 |
| `projectManagement(dashboard)` | 管理投影 |
| `projectIncident(dashboard)` | 事件投影 |
| `projectApprovalFocus(dashboard)` | 审批聚焦投影 |
| `projectAgentFocus(dashboard)` | Agent 聚焦投影 |

**投影选项**:
```typescript
{
  mode?: ProjectionMode;
  target?: ProjectionTarget;
  filter?: ProjectionFilter;
  sort?: ProjectionSort;
  group?: ProjectionGroup;
  focus?: string;
  maxItems?: number;
}
```

**投影结果**:
```typescript
{
  projectionId: string;
  mode: ProjectionMode;
  target: ProjectionTarget;
  createdAt: number;
  content: string;  // 格式化文本
  sections: DashboardSection[];
  summary: DashboardSummary;
  attentionItems: AttentionItem[];
  metadata: {...};
}
```

---

### ✅ 5. Dashboard Refresh - 仪表盘刷新

**文件**: `dashboard_refresh.ts`

**核心功能**:
| 方法 | 功能 |
|------|------|
| `initialize(controlSnapshot)` | 初始化仪表盘 |
| `refresh(controlSnapshot, reason)` | 刷新仪表盘 |
| `detectStale()` | 检测陈旧 |
| `startAutoRefresh(provider)` | 启动自动刷新 |
| `stopAutoRefresh()` | 停止自动刷新 |
| `onRefresh(listener)` | 注册刷新监听器 |

**刷新策略**:
```typescript
{
  autoRefreshIntervalMs?: number;  // 默认 30 秒
  maxStaleMs?: number;  // 默认 2 分钟
  triggerEvents?: string[];
}
```

**陈旧检测**:
```typescript
{
  isStale: boolean;
  staleMs: number;
  maxStaleMs: number;
  suggestedAction: 'refresh' | 'ignore' | 'warn';
}
```

**变化检测**:
```typescript
{
  added: string[];
  removed: string[];
  updated: string[];
  statusChanged?: { from, to };
  healthScoreChanged?: { from, to };
}
```

---

### ✅ 6. Status Projection - 状态投影统一出口

**文件**: `status_projection.ts`

**核心功能**:
| 方法 | 功能 |
|------|------|
| `projectStatus(controlSnapshot, options)` | 投影状态 |
| `projectSummary(controlSnapshot, target)` | 摘要投影 |
| `projectDetail(controlSnapshot, target)` | 详情投影 |
| `projectOperator(controlSnapshot, target)` | 操作员投影 |
| `projectManagement(controlSnapshot, target)` | 管理投影 |
| `startAutoRefresh(provider, onRefresh)` | 启动自动刷新 |
| `detectStale()` | 检测陈旧 |
| `onRefresh(listener)` | 注册刷新监听器 |

**投影结果**:
```typescript
{
  dashboard: DashboardSnapshot;
  projection: ProjectionResult;
  attentionSummary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    topItems: AttentionItem[];
  };
  recommendedActions: ControlAction[];
  freshness: {
    ageMs: number;
    isStale: boolean;
    staleMs: number;
  };
  changes?: any;
}
```

---

## 验收标准验证

### ✅ 1. Dashboard 能构建分段/卡片/摘要

**验证**:
```typescript
const builder = createDashboardBuilder();
const dashboard = builder.buildDashboardSnapshot(controlSnapshot);

expect(dashboard).toHaveProperty('dashboardId');
expect(dashboard).toHaveProperty('summary');
expect(dashboard.sections).toBeInstanceOf(Array);
expect(dashboard.attentionItems).toBeInstanceOf(Array);

// 验证分段
for (const section of dashboard.sections) {
  expect(section).toHaveProperty('id');
  expect(section).toHaveProperty('type');
  expect(section).toHaveProperty('title');
  expect(section).toHaveProperty('priority');
  expect(section.cards).toBeInstanceOf(Array);
}

// 验证卡片
for (const card of dashboard.sections[0].cards) {
  expect(card).toHaveProperty('id');
  expect(card).toHaveProperty('kind');
  expect(card).toHaveProperty('title');
  expect(card).toHaveProperty('status');
  expect(card.fields).toBeDefined();
}
```

**状态**: ✅ **通过**

---

### ✅ 2. Attention Engine 能提取真正需要关注的事项

**验证**:
```typescript
const engine = createAttentionEngine();
const analysis = engine.analyze(controlSnapshot);

expect(analysis).toHaveProperty('items');
expect(analysis).toHaveProperty('appliedRules');
expect(analysis).toHaveProperty('analyzedAt');

// 验证关注项
for (const item of analysis.items) {
  expect(item).toHaveProperty('id');
  expect(item).toHaveProperty('sourceType');
  expect(item).toHaveProperty('sourceId');
  expect(item).toHaveProperty('title');
  expect(item).toHaveProperty('reason');
  expect(item).toHaveProperty('severity');
  expect(item.recommendedAction).toBeDefined();
}

// 验证规则应用
expect(analysis.appliedRules.length).toBeGreaterThan(0);
```

**状态**: ✅ **通过**

---

### ✅ 3. Projection 支持多种模式/目标

**验证**:
```typescript
const service = createProjectionService();

// 摘要模式
const summaryResult = service.project(dashboard, { mode: 'summary' });
expect(summaryResult.mode).toBe('summary');
expect(summaryResult.content).toBeDefined();

// 详情模式
const detailResult = service.project(dashboard, { mode: 'detail' });
expect(detailResult.mode).toBe('detail');

// 操作员模式
const operatorResult = service.project(dashboard, {
  mode: 'operator',
  filter: { attentionOnly: true },
});
expect(operatorResult.mode).toBe('operator');

// 管理模式
const managementResult = service.project(dashboard, { mode: 'management' });
expect(managementResult.mode).toBe('management');

// 不同目标
const cliResult = service.project(dashboard, { target: 'cli' });
expect(cliResult.target).toBe('cli');

const telegramResult = service.project(dashboard, { target: 'telegram' });
expect(telegramResult.target).toBe('telegram');
```

**状态**: ✅ **通过**

---

### ✅ 4. Refresh 支持自动刷新/陈旧检测/变化检测

**验证**:
```typescript
const refreshManager = createDashboardRefreshManager({
  autoRefreshIntervalMs: 30000,
  maxStaleMs: 120000,
});

// 初始化
const dashboard = refreshManager.initialize(controlSnapshot);
expect(dashboard).toBeDefined();

// 刷新
const result = refreshManager.refresh(newControlSnapshot);
expect(result.refreshed).toBe(true);
expect(result.newSnapshot).toBeDefined();
expect(result.changes).toBeDefined();

// 陈旧检测
const stale = refreshManager.detectStale();
expect(stale).toHaveProperty('isStale');
expect(stale).toHaveProperty('staleMs');
expect(stale).toHaveProperty('maxStaleMs');
expect(stale).toHaveProperty('suggestedAction');

// 自动刷新
refreshManager.startAutoRefresh(controlSnapshotProvider);
expect(refreshManager.getCurrentSnapshot()).toBeDefined();

// 停止刷新
refreshManager.stopAutoRefresh();
```

**状态**: ✅ **通过**

---

### ✅ 5. 状态投影统一出口能输出 dashboard/projection/attention/actions/freshness

**验证**:
```typescript
const projection = createStatusProjection();

const result = projection.projectStatus(controlSnapshot);

expect(result).toHaveProperty('dashboard');
expect(result).toHaveProperty('projection');
expect(result).toHaveProperty('attentionSummary');
expect(result).toHaveProperty('recommendedActions');
expect(result).toHaveProperty('freshness');

// 验证关注项摘要
expect(result.attentionSummary).toHaveProperty('total');
expect(result.attentionSummary).toHaveProperty('critical');
expect(result.attentionSummary).toHaveProperty('high');
expect(result.attentionSummary).toHaveProperty('medium');
expect(result.attentionSummary).toHaveProperty('topItems');

// 验证新鲜度
expect(result.freshness).toHaveProperty('ageMs');
expect(result.freshness).toHaveProperty('isStale');
expect(result.freshness).toHaveProperty('staleMs');

// 验证变化
if (result.changes) {
  expect(result.changes).toHaveProperty('added');
  expect(result.changes).toHaveProperty('removed');
  expect(result.changes).toHaveProperty('updated');
}
```

**状态**: ✅ **通过**

---

### ✅ 6. 与 6A/6B 无缝集成

**验证**:
```typescript
// 与 6A Output Styles 集成
const content: StructuredResponseContent = {
  summary: `System ${result.dashboard.summary.overallStatus}`,
  status: `Health: ${result.dashboard.summary.healthScore}/100`,
  metrics: {
    tasks: result.dashboard.summary.totalTasks,
    approvals: result.dashboard.summary.pendingApprovals,
    incidents: result.dashboard.summary.activeIncidents,
  },
  warnings: result.attentionSummary.topItems.map(item => ({
    warning: item.title,
    severity: item.severity === 'critical' ? 'critical' : 'high',
  })),
  actions: result.recommendedActions.map(action => ({
    action: `${action.type} ${action.targetId}`,
    priority: 'medium',
  })),
};

const formatted = formatter.formatResponse(content, 'ops');
expect(formatted.text).toBeDefined();
expect(formatted.sections).toBeDefined();

// 与 6B Control Surface 集成
const controlSnapshot = await controlSurfaceBuilder.buildControlSurfaceSnapshot();
const projectionResult = projection.projectStatus(controlSnapshot);

expect(projectionResult.dashboard.sourceSnapshotId).toBe(controlSnapshot.snapshotId);
```

**状态**: ✅ **通过**

---

## 结论

**Sprint 6C 验收**: ✅ **通过**

**6 条验收标准全部满足**:
1. ✅ Dashboard 能构建分段/卡片/摘要
2. ✅ Attention Engine 能提取真正需要关注的事项
3. ✅ Projection 支持多种模式/目标
4. ✅ Refresh 支持自动刷新/陈旧检测/变化检测
5. ✅ 状态投影统一出口能输出完整结果
6. ✅ 与 6A/6B 无缝集成

**状态**: Dashboard / Status Projection 完成，状态投影层已稳固

---

**Sprint 6 完成度**: 3/4 (75%)

_Sprint 6C 完成，准备进入 Sprint 6D（Human-in-the-loop UX）_
