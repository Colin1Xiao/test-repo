# Sprint 6 架构设计 - Operating UX / Output Styles / Control Surfaces

**版本**: v0.1.0  
**状态**: Design Draft  
**日期**: 2026-04-03  
**作者**: Colin + 小龙

---

## 一、目标与范围

### 1.1 核心目标

把 OpenClaw 从：

> 系统完成

升级为：

> 产品完成

**一句话定义**:

> Sprint 6 让强大的内核变得容易操控、容易读懂、容易运营。

### 1.2 核心价值

| 能力 | 获得的产品价值 |
|------|---------------|
| Output Styles | 不同场景不同输出风格 |
| Control Surfaces | 操控面清晰可见 |
| Status Projection | 状态可投影到不同 UI |
| Human-in-the-loop | 审批/决策/解释对人友好 |

### 1.3 不做的事情（边界）

| 不做 | 原因 |
|------|------|
| 完整 Web UI | 先做数据层/逻辑层，UI 后续 |
| 复杂图形界面 | 先做 CLI/TUI 友好输出 |
| 替代现有输出 | 是增强层，不是替换层 |

---

## 二、分阶段拆分

### 2.1 阶段划分

```
Sprint 6A: Output Styles / Response Modes
    ↓
Sprint 6B: Control Surface / Command Views
    ↓
Sprint 6C: Dashboard / Status Projection
    ↓
Sprint 6D: Human-in-the-loop UX
```

### 2.2 Sprint 6A: Output Styles / Response Modes

**目标**: 把输出风格做成正式层，而不是 prompt 偏好

**核心模块**:
| 模块 | 职责 |
|------|------|
| `output_style.ts` | 输出风格定义 |
| `style_registry.ts` | 风格注册与管理 |
| `response_formatter.ts` | 响应格式化 |

**第一版输出风格**:
| 风格 | 适用场景 | 特点 |
|------|---------|------|
| `minimal` | 远程/低带宽 | 精简、只保留关键信息 |
| `audit` | 审计/合规 | 完整、可追溯、带时间戳 |
| `coding` | 开发场景 | 代码优先、diff 友好 |
| `ops` | 运维场景 | 指标优先、告警突出 |
| `management` | 管理层汇报 | 摘要优先、建议清晰 |
| `zh_pm` | 中文产品经理 | 结构化、中文友好 |

**验收标准**:
- [ ] 风格可注册、可查询
- [ ] 同一内容可按不同风格格式化
- [ ] Telegram/CLI 远程操控体验提升
- [ ] 审批可读性提升

---

### 2.3 Sprint 6B: Control Surface / Command Views

**目标**: 给系统加"操控面"

**核心模块**:
| 模块 | 职责 |
|------|------|
| `control_surface.ts` | 操控面定义 |
| `task_view.ts` | 任务视图 |
| `approval_view.ts` | 审批视图 |
| `ops_view.ts` | 运维视图 |

**第一版视图**:
| 视图 | 展示内容 |
|------|---------|
| `task_view` | active tasks / blocked / completed |
| `approval_view` | pending approvals / bottlenecks |
| `ops_view` | health status / degraded servers / blocked skills |
| `agent_view` | agent status / workload / failures |

**验收标准**:
- [ ] 看当前有哪些 active tasks
- [ ] 看哪些 approvals pending
- [ ] 看哪些 agents blocked
- [ ] 看哪些 servers degraded
- [ ] 看当前自动化规则命中情况

---

### 2.4 Sprint 6C: Dashboard / Status Projection

**目标**: 状态投影层，为 UI 提供数据模型

**核心模块**:
| 模块 | 职责 |
|------|------|
| `status_projection.ts` | 状态投影 |
| `dashboard_model.ts` | 仪表盘数据模型 |
| `timeline_view.ts` | 时间线视图 |

**第一版投影**:
| 投影 | 数据源 | 目标 UI |
|------|--------|--------|
| `health_projection` | Health Metrics | CLI/TUI/Web |
| `task_timeline` | TaskStore / Audit | Timeline UI |
| `approval_flow` | ApprovalBridge | Approval UI |
| `automation_activity` | HookBus / Automation | Automation UI |

**验收标准**:
- [ ] 把 TaskStore / Audit / Health / Ops 数据统一投影成可展示模型
- [ ] 为未来 CLI/TUI/Web UI 留接口
- [ ] 支持增量更新
- [ ] 支持订阅/推送

---

### 2.5 Sprint 6D: Human-in-the-loop UX

**目标**: 把审批、确认、解释做成人真正容易用的系统

**核心模块**:
| 模块 | 职责 |
|------|------|
| `approval_formatter.ts` | 审批格式化 |
| `decision_explainer.ts` | 决策解释 |
| `action_preview.ts` | 动作预览 |

**第一版能力**:
| 能力 | 说明 |
|------|------|
| 为什么 ask | 解释为什么需要审批 |
| 拒绝会影响什么 | 拒绝的后果说明 |
| 批准会放开什么范围 | 批准后的权限范围 |
| 当前建议怎么选 | 建议选项与理由 |

**验收标准**:
- [ ] 审批请求可读性提升
- [ ] 决策解释清晰
- [ ] 动作预览准确
- [ ] 用户决策时间缩短

---

## 三、输出风格定义

### 3.1 风格结构

```typescript
type OutputStyle = {
  id: string;
  name: string;
  description: string;
  
  // 内容控制
  includeTimestamp: boolean;
  includeReasoning: boolean;
  includeMetrics: boolean;
  includeRecommendations: boolean;
  
  // 格式控制
  maxSummaryLength: number;
  maxDetailsLength: number;
  codeBlockStyle: 'inline' | 'fenced' | 'diff';
  listStyle: 'bullet' | 'numbered' | 'table';
  
  // 语言控制
  language: 'en' | 'zh';
  tone: 'formal' | 'casual' | 'technical';
  
  // 适用场景
  suitableFor: string[];
}
```

### 3.2 预定义风格

**minimal**:
```yaml
id: minimal
includeTimestamp: false
includeReasoning: false
includeMetrics: false
includeRecommendations: false
maxSummaryLength: 100
codeBlockStyle: inline
listStyle: bullet
language: en
tone: casual
suitableFor: [telegram, sms, low-bandwidth]
```

**audit**:
```yaml
id: audit
includeTimestamp: true
includeReasoning: true
includeMetrics: true
includeRecommendations: true
maxSummaryLength: 500
maxDetailsLength: 5000
codeBlockStyle: fenced
listStyle: table
language: en
tone: formal
suitableFor: [compliance, security, ops]
```

**coding**:
```yaml
id: coding
includeTimestamp: false
includeReasoning: true
includeMetrics: false
includeRecommendations: true
maxSummaryLength: 200
codeBlockStyle: diff
listStyle: bullet
language: en
tone: technical
suitableFor: [development, code-review]
```

**ops**:
```yaml
id: ops
includeTimestamp: true
includeReasoning: false
includeMetrics: true
includeRecommendations: true
maxSummaryLength: 300
codeBlockStyle: fenced
listStyle: table
language: en
tone: technical
suitableFor: [operations, monitoring, incident]
```

**management**:
```yaml
id: management
includeTimestamp: false
includeReasoning: false
includeMetrics: true
includeRecommendations: true
maxSummaryLength: 200
codeBlockStyle: inline
listStyle: bullet
language: en
tone: formal
suitableFor: [management, reporting, stakeholder]
```

**zh_pm**:
```yaml
id: zh_pm
includeTimestamp: false
includeReasoning: true
includeMetrics: true
includeRecommendations: true
maxSummaryLength: 300
codeBlockStyle: fenced
listStyle: numbered
language: zh
tone: casual
suitableFor: [product, chinese-speaking]
```

---

## 四、操控面定义

### 4.1 Control Surface 结构

```typescript
type ControlSurface = {
  id: string;
  name: string;
  description: string;
  
  // 视图列表
  views: ControlView[];
  
  // 操作列表
  actions: ControlAction[];
  
  // 刷新策略
  refreshStrategy: {
    autoRefresh: boolean;
    refreshIntervalMs: number;
    triggerEvents: string[];
  };
}

type ControlView = {
  id: string;
  name: string;
  type: 'list' | 'table' | 'timeline' | 'chart' | 'summary';
  dataSource: string;
  columns?: ViewColumn[];
  filters?: ViewFilter[];
}

type ControlAction = {
  id: string;
  name: string;
  description: string;
  targetEntity: string;
  allowedStates: string[];
  confirmationRequired: boolean;
}
```

### 4.2 预定义操控面

**Task Control Surface**:
```yaml
id: task_control
name: Task Control
description: Manage and monitor tasks

views:
  - id: active_tasks
    name: Active Tasks
    type: table
    dataSource: taskStore.activeTasks
    columns: [id, agent, status, progress, duration]
    filters: [status, agent, timeRange]
    
  - id: blocked_tasks
    name: Blocked Tasks
    type: list
    dataSource: taskStore.blockedTasks
    columns: [id, reason, blockedSince]
    
  - id: task_timeline
    name: Task Timeline
    type: timeline
    dataSource: auditLog.taskEvents

actions:
  - id: cancel_task
    name: Cancel Task
    targetEntity: task
    allowedStates: [pending, running]
    confirmationRequired: true
    
  - id: retry_task
    name: Retry Task
    targetEntity: task
    allowedStates: [failed]
    confirmationRequired: false
```

**Approval Control Surface**:
```yaml
id: approval_control
name: Approval Control
description: Manage approvals and decisions

views:
  - id: pending_approvals
    name: Pending Approvals
    type: table
    dataSource: approvalBridge.pending
    columns: [id, type, requester, requestedAt, age]
    filters: [type, age, requester]
    
  - id: approval_bottlenecks
    name: Approval Bottlenecks
    type: chart
    dataSource: auditLog.approvalEvents
    
actions:
  - id: approve
    name: Approve
    targetEntity: approval
    allowedStates: [pending]
    confirmationRequired: false
    
  - id: reject
    name: Reject
    targetEntity: approval
    allowedStates: [pending]
    confirmationRequired: true
```

**Ops Control Surface**:
```yaml
id: ops_control
name: Ops Control
description: Operations monitoring and control

views:
  - id: health_status
    name: Health Status
    type: summary
    dataSource: healthMetrics.global
    
  - id: degraded_servers
    name: Degraded Servers
    type: table
    dataSource: healthMetrics.byServer
    columns: [serverId, status, errorRate, lastCheck]
    
  - id: blocked_skills
    name: Blocked Skills
    type: list
    dataSource: healthMetrics.bySkill
    
  - id: automation_activity
    name: Automation Activity
    type: timeline
    dataSource: hookBus.events

actions:
  - id: restart_server
    name: Restart Server
    targetEntity: server
    allowedStates: [degraded, unavailable]
    confirmationRequired: true
    
  - id: reload_automation
    name: Reload Automation Rules
    targetEntity: automation
    confirmationRequired: false
```

---

## 五、状态投影定义

### 5.1 Projection 结构

```typescript
type StatusProjection = {
  id: string;
  name: string;
  description: string;
  
  // 数据源
  dataSources: string[];
  
  // 投影类型
  projectionType: 'snapshot' | 'timeline' | 'aggregate';
  
  // 更新策略
  updateStrategy: {
    mode: 'push' | 'pull' | 'hybrid';
    intervalMs?: number;
    triggerEvents?: string[];
  };
  
  // 输出格式
  outputFormat: 'json' | 'protobuf' | 'graphql';
}
```

### 5.2 预定义投影

**Health Projection**:
```yaml
id: health_projection
name: Health Status Projection
description: Project system health to UI layers

dataSources:
  - healthMetrics.global
  - healthMetrics.byAgent
  - healthMetrics.byServer
  - healthMetrics.bySkill

projectionType: snapshot

updateStrategy:
  mode: hybrid
  intervalMs: 30000
  triggerEvents:
    - server.degraded
    - server.unavailable
    - skill.blocked

outputFormat: json
```

**Task Timeline Projection**:
```yaml
id: task_timeline_projection
name: Task Timeline Projection
description: Project task events to timeline UI

dataSources:
  - taskStore.events
  - auditLog.taskEvents

projectionType: timeline

updateStrategy:
  mode: push
  triggerEvents:
    - task.created
    - task.started
    - task.completed
    - task.failed

outputFormat: json
```

**Approval Flow Projection**:
```yaml
id: approval_flow_projection
name: Approval Flow Projection
description: Project approval workflow to UI

dataSources:
  - approvalBridge.pending
  - approvalBridge.history
  - auditLog.approvalEvents

projectionType: timeline

updateStrategy:
  mode: push
  triggerEvents:
    - approval.requested
    - approval.resolved
    - approval.timeout

outputFormat: json
```

---

## 六、Human-in-the-loop UX

### 6.1 Approval Formatter

```typescript
type ApprovalFormat = {
  // 基本信息
  requestId: string;
  requestType: string;
  requester: string;
  requestedAt: string;
  
  // 请求内容
  what: string;
  why: string;
  scope: string;
  
  // 决策选项
  options: Array<{
    action: 'approve' | 'reject' | 'modify';
    label: string;
    description: string;
    consequences: string[];
  }>;
  
  // 上下文信息
  context: {
    relatedTask?: string;
    relatedAgent?: string;
    relatedServer?: string;
    history?: string[];
  };
}
```

### 6.2 Decision Explainer

```typescript
type DecisionExplanation = {
  // 决策内容
  decision: string;
  
  // 决策原因
  reasons: string[];
  
  // 影响范围
  impact: {
    whatChanges: string[];
    whatStaysSame: string[];
    risks: string[];
    benefits: string[];
  };
  
  // 替代方案
  alternatives: Array<{
    option: string;
    pros: string[];
    cons: string[];
  }>;
  
  // 后续步骤
  nextSteps: string[];
}
```

### 6.3 Action Preview

```typescript
type ActionPreview = {
  // 动作信息
  action: string;
  target: string;
  
  // 执行前状态
  beforeState: Record<string, any>;
  
  // 执行后状态（预计）
  afterState: Record<string, any>;
  
  // 影响评估
  impactAssessment: {
    affectedEntities: string[];
    riskLevel: 'low' | 'medium' | 'high';
    rollbackAvailable: boolean;
  };
  
  // 确认提示
  confirmationPrompt: string;
}
```

---

## 七、与现有主干的接法

### 7.1 与 TaskStore 集成

```typescript
// Task View 数据源
const taskView = {
  activeTasks: await taskStore.list({ status: ['pending', 'running'] }),
  blockedTasks: await taskStore.list({ status: ['blocked'] }),
  taskEvents: await auditLog.query({ entityType: 'task' }),
};
```

### 7.2 与 Audit Log 集成

```typescript
// Audit 数据用于所有视图
const auditData = {
  taskEvents: await auditLog.query({ entityType: 'task' }),
  approvalEvents: await auditLog.query({ entityType: 'approval' }),
  automationEvents: await auditLog.query({ eventType: 'automation.*' }),
};
```

### 7.3 与 Health Metrics 集成

```typescript
// Health Projection 数据源
const healthProjection = {
  global: healthMetrics.computeGlobalMetrics(),
  byAgent: healthMetrics.computeAgentMetrics(),
  byServer: healthMetrics.computeServerMetrics(),
  bySkill: healthMetrics.computeSkillMetrics(),
};
```

### 7.4 与 ApprovalBridge 集成

```typescript
// Approval View 数据源
const approvalView = {
  pending: await approvalBridge.listPending(),
  history: await approvalBridge.listHistory(),
  bottlenecks: await approvalBridge.analyzeBottlenecks(),
};
```

---

## 八、目录结构

```
src/ux/
  # 6A: Output Styles
  output_style.ts
  style_registry.ts
  response_formatter.ts
  
  # 6B: Control Surfaces
  control_surface.ts
  task_view.ts
  approval_view.ts
  ops_view.ts
  agent_view.ts
  
  # 6C: Dashboard / Projection
  status_projection.ts
  dashboard_model.ts
  timeline_view.ts
  
  # 6D: Human-in-the-loop
  approval_formatter.ts
  decision_explainer.ts
  action_preview.ts
  
  # Types
  types.ts
  index.ts
  
  # Styles (预定义风格配置)
  styles/
    minimal.yaml
    audit.yaml
    coding.yaml
    ops.yaml
    management.yaml
    zh_pm.yaml
```

---

## 九、MVP 验收标准

### 9.1 Sprint 6A MVP

- [ ] 风格可注册、可查询
- [ ] 同一内容可按不同风格格式化
- [ ] 至少 6 种预定义风格可用
- [ ] Telegram/CLI 远程操控体验提升

### 9.2 Sprint 6B MVP

- [ ] Task View 显示 active/blocked/completed
- [ ] Approval View 显示 pending/bottlenecks
- [ ] Ops View 显示 health/degraded/blocked
- [ ] 操控面支持基本操作（cancel/retry/approve/reject）

### 9.3 Sprint 6C MVP

- [ ] Health Projection 可订阅/推送
- [ ] Task Timeline Projection 支持时间线展示
- [ ] Approval Flow Projection 支持工作流展示
- [ ] 支持增量更新

### 9.4 Sprint 6D MVP

- [ ] 审批请求格式化可读
- [ ] 决策解释清晰（为什么 ask/拒绝影响/批准范围）
- [ ] 动作预览准确
- [ ] 用户决策时间缩短

---

## 十、依赖关系

### 10.1 内部依赖

| 模块 | 依赖 |
|------|------|
| Output Styles | - |
| Control Surfaces | TaskStore, ApprovalBridge, HealthMetrics |
| Status Projection | AuditLog, HealthMetrics, TaskStore |
| Human-in-the-loop | ApprovalBridge, AuditLog |

### 10.2 外部依赖

| 依赖 | 用途 | 必需 |
|------|------|------|
| `yaml` | 风格配置解析 | P0 |
| `chalk` / `cli-color` | CLI 输出增强 | P1 |
| `ink` / `blessed` | TUI 支持（可选） | P2 |

---

## 十一、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 风格太多难维护 | 中 | 预定义风格限制在 6-8 种 |
| 操控面与内核脱节 | 高 | 操控面直接读取 TaskStore/Audit，不复制状态 |
| 投影更新延迟 | 中 | 支持 push/pull/hybrid 三种模式 |
| 审批解释太复杂 | 中 | 提供简化/详细两种模式 |

---

**下一步**: 开始 Sprint 6A 实现

---

_Sprint 6 是让 OpenClaw 从"系统完成"走向"产品完成"的关键一步。_
