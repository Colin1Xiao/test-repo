# Phase 2A-2B: Inbox Aggregation Layer ✅

**状态**: 完成  
**版本**: 2A-2B-rc  
**日期**: 2026-04-04

---

## 概述

Phase 2A-2B 实现了 Operator 系统的 Inbox 聚合层，将多来源待处理项统一成一个 operator queue：

- ✅ `ApprovalInbox` - 审批收件箱
- ✅ `IncidentCenter` - 事件中心
- ✅ `TaskCenter` - 任务中心
- ✅ `AttentionInbox` - 关注项收件箱
- ✅ `InboxService` - 统一聚合服务

---

## 新增文件

```
src/operator/types/
└── inbox_types.ts                  # 4KB - Inbox 核心类型

src/operator/inbox/
├── approval_inbox.ts               # 5KB - 审批收件箱
├── incident_center.ts              # 5KB - 事件中心
├── task_center.ts                  # 6KB - 任务中心
├── attention_inbox.ts              # 5KB - 关注项收件箱
├── inbox_service.ts                # 6KB - 统一 Inbox 服务
└── index.ts                        # 2KB - 统一导出
```

---

## InboxItem 结构

```ts
interface InboxItem {
  id: string;                    // 唯一 ID
  itemType: InboxItemType;       // approval/incident/task/intervention/attention
  sourceId: string;              // 源对象 ID
  workspaceId?: string;          // Workspace ID
  title: string;                 // 标题
  summary: string;               // 摘要
  severity: InboxSeverity;       // critical/high/medium/low
  status?: InboxItemStatus;      // pending/active/blocked/failed 等
  owner?: string;                // 所有者
  createdAt: number;             // 创建时间
  updatedAt: number;             // 更新时间
  ageMs?: number;                // 年龄（毫秒）
  suggestedActions?: string[];   // 建议动作
  metadata?: Record<string, unknown>;
}
```

---

## ApprovalInbox

### 聚合内容

| 类型 | 说明 | 严重级别 |
|------|------|----------|
| pending approvals | 待处理审批 | medium/high/critical |
| aged approvals | 老化审批 (>2h) | high |
| timeout approvals | 超时审批 (>6h) | critical |

### 建议动作

- `approve` - 批准
- `reject` - 拒绝
- `escalate` - 升级

### 使用示例

```ts
import { createApprovalInbox } from './operator/inbox';

const approvalInbox = createApprovalInbox(approvalDataSource, {
  timeoutThresholdMs: 6 * 60 * 60 * 1000,  // 6 小时
  agedThresholdMs: 2 * 60 * 60 * 1000,     // 2 小时
  limit: 50,
});

const items = await approvalInbox.getInboxItems('local-default');
console.log(items[0].title);  // "审批：code_execution"
console.log(items[0].severity);  // "critical" (超时)
```

---

## IncidentCenter

### 聚合内容

| 类型 | 说明 | 严重级别 |
|------|------|----------|
| active incidents | 活跃事件 | 按事件 severity |
| unacknowledged | 未确认事件 | high/critical |
| degraded services | 降级服务 | high/critical |

### 建议动作

- `ack_incident` - 确认事件
- `request_recovery` - 请求恢复
- `request_replay` - 请求重放

### 使用示例

```ts
import { createIncidentCenter } from './operator/inbox';

const incidentCenter = createIncidentCenter(incidentDataSource, {
  limit: 50,
});

const items = await incidentCenter.getInboxItems('local-default');
console.log(items[0].title);  // "事件：gateway_timeout"
console.log(items[0].status);  // "active" 或 "acknowledged"
```

---

## TaskCenter

### 聚合内容

| 类型 | 说明 | 严重级别 |
|------|------|----------|
| blocked tasks | 阻塞任务 | 按优先级 |
| failed tasks | 失败任务 | 按优先级 |
| high-priority active | 高优活跃任务 | high/critical |

### 建议动作

- `retry_task` - 重试任务
- `cancel_task` - 取消任务
- `open` - 查看详情

### 使用示例

```ts
import { createTaskCenter } from './operator/inbox';

const taskCenter = createTaskCenter(taskDataSource, {
  limit: 50,
});

const items = await taskCenter.getInboxItems('local-default');
console.log(items[0].title);  // "阻塞任务：task_123"
console.log(items[0].status);  // "blocked" 或 "failed"
```

---

## AttentionInbox

### 聚合内容

| 类型 | 来源 | 说明 |
|------|------|------|
| attention | Dashboard | 关注项 |
| intervention | HumanLoop | 介入项 |

### 使用示例

```ts
import { createAttentionInbox } from './operator/inbox';

const attentionInbox = createAttentionInbox({ limit: 50 });

// 从 Dashboard 获取
const dashboardItems = await attentionInbox.getFromDashboard(dashboard, workspaceId);

// 从 HumanLoop 获取
const interventionItems = await attentionInbox.getFromHumanLoop(humanLoop, workspaceId);

// 合并去重
const allItems = attentionInbox.mergeItems(dashboardItems, interventionItems);
```

---

## InboxService

### 统一聚合

```ts
import {
  createApprovalInbox,
  createIncidentCenter,
  createTaskCenter,
  createAttentionInbox,
  createInboxService,
} from './operator/inbox';

// 创建各聚合器
const approvalInbox = createApprovalInbox(approvalDataSource);
const incidentCenter = createIncidentCenter(incidentDataSource);
const taskCenter = createTaskCenter(taskDataSource);
const attentionInbox = createAttentionInbox();

// 创建统一 Inbox 服务
const inboxService = createInboxService({
  approvalInbox,
  incidentCenter,
  taskCenter,
  attentionInbox,
}, {
  defaultSort: 'severity',
  defaultLimit: 50,
});

// 获取 Inbox 快照
const snapshot = await inboxService.getInboxSnapshot('local-default');

console.log(snapshot.summary);
// {
//   pendingApprovals: 5,
//   openIncidents: 3,
//   blockedTasks: 2,
//   pendingInterventions: 0,
//   criticalCount: 2,
//   highPriorityCount: 4,
//   totalCount: 10
// }

console.log(snapshot.items[0].title);  // 最紧急的项
```

### 获取紧急项

```ts
const urgentItems = await inboxService.getUrgentItems('local-default', 10);
// 只返回 critical + high 严重级别的项
```

---

## 严重级别计算

### Approvals

| 条件 | 严重级别 |
|------|----------|
| age > 6h (timeout) | critical |
| age > 2h (aged) | high |
| normal | medium |

### Incidents

| 条件 | 严重级别 |
|------|----------|
| incident.severity = critical | critical |
| incident.severity = high | high |
| incident.severity = medium | medium |
| service.status = unavailable | critical |
| service.status = degraded | high |

### Tasks

| 条件 | 严重级别 |
|------|----------|
| priority = critical | critical |
| priority = high | high |
| priority = medium | medium |
| priority = low | low |

---

## 排序规则

```ts
items.sort((a, b) => {
  // 1. 按严重级别排序
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
  if (severityDiff !== 0) return severityDiff;
  
  // 2. 按年龄排序（越老越前）
  return (b.ageMs || 0) - (a.ageMs || 0);
});
```

---

## 集成到 SurfaceService

```ts
// operator_surface_service.ts
import { InboxService } from './inbox/inbox_service';

export class DefaultOperatorSurfaceService implements OperatorSurfaceService {
  private inboxService: InboxService;
  
  constructor(
    // ... 其他依赖
    inboxService: InboxService
  ) {
    this.inboxService = inboxService;
  }
  
  async getInboxView(input: GetSurfaceViewInput): Promise<OperatorViewPayload> {
    const snapshot = await this.inboxService.getInboxSnapshot(input.workspaceId);
    
    // 转换为 OperatorViewPayload
    return this.viewFactory.buildInboxView({
      inboxSnapshot: snapshot,
      mode: input.mode,
      surface: input.actor.surface,
    });
  }
}
```

---

## 验收标准

### ✅ 已完成

1. ✅ `InboxItem` 类型定义完整
2. ✅ `ApprovalInbox` 聚合 pending/aged/timeout approvals
3. ✅ `IncidentCenter` 聚合 active incidents / degraded services
4. ✅ `TaskCenter` 聚合 blocked/failed/high-priority tasks
5. ✅ `AttentionInbox` 聚合 dashboard attention / interventions
6. ✅ `InboxService` 统一聚合 + 排序 + 摘要

### 🟡 待完成

1. 🟡 集成到 `OperatorSurfaceService.getInboxView()`
2. 🟡 CLI `/inbox` 命令
3. 🟡 Telegram `/inbox` 命令

---

## 配置选项

### InboxConfig

```ts
createInboxService({
  approvalInbox,
  incidentCenter,
  taskCenter,
  attentionInbox,
}, {
  defaultSort: 'severity',       // severity/age/type/custom
  defaultLimit: 50,
  severityWeights: {
    critical: 100,
    high: 50,
    medium: 20,
    low: 10,
  },
  ageThresholds: {
    agedApprovalMs: 2 * 60 * 60 * 1000,
    agedIncidentMs: 30 * 60 * 1000,
    agedTaskMs: 60 * 60 * 1000,
  },
})
```

---

## Phase 2 完整进度

```
Phase 2A-1     类型层            ✅ 完成
    ↓
Phase 2A-1R    运行时集成         ✅ 完成
    ↓
Phase 2A-1R′   执行桥接           ✅ 完成
    ↓
Phase 2A-1R′A  真实数据源         ✅ 完成
    ↓
Phase 2A-1R′B  真实执行           ✅ 完成
    ↓
Phase 2A-2A    Session/Workspace  ✅ 完成
    ↓
Phase 2A-2A-I  集成               ✅ 完成
    ↓
Phase 2A-2B    Inbox 聚合         ✅ 完成
    ↓
Phase 2A-2B-I  Inbox 集成         🔜 下一步
```

---

## 下一步：2A-2B-I

**目标:** 将 Inbox 集成到产品主链路

**行动:**
1. `OperatorSurfaceService.getInboxView()` 使用 InboxService
2. CLI `oc inbox` 命令显示真实聚合结果
3. Telegram `/inbox` 命令显示真实聚合结果
4. 验证 `/inbox` 前后对比 approve/ack/retry 动作

---

_Phase 2A-2B 状态：✅ 完成 — Inbox 聚合层已就绪_
