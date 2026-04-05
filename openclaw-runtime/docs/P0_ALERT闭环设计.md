# P0: 告警闭环与自动处置入口

_告警 → 判断 → runbook → incident → timeline 串联_

---

## 设计目标

把以下组件串成闭环：
- 告警 (Alert)
- 判断 (Router)
- Runbook
- Incident
- Timeline
- Audit

**一句话**: 一条 P0 告警出现后，能在一个操作面里完成：
- 看告警
- 看关联指标
- 看 runbook
- 建/挂 incident
- 写入 timeline/audit

---

## 架构

```
告警触发
    ↓
Alert Router (路由与映射)
    ↓
┌─────────────────────────────────────────┐
│ Alert Action API                        │
│ - acknowledge                           │
│ - silence                               │
│ - escalate                              │
│ - link_incident                         │
│ - open_runbook                          │
└─────────────────────────────────────────┘
    ↓
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  Incident    │   │  Runbook     │   │  Timeline    │
│  (incident)  │   │  (runbook)   │   │  (timeline)  │
└──────────────┘   └──────────────┘   └──────────────┘
    ↓                    ↓                    ↓
└──────────── Audit Log (审计日志) ────────────┘
```

---

## 核心模块

### 1. Alert Router

**文件**: `src/alerting/alert_router.ts`

**功能**:
- 告警定义 (ALERT_DEFINITIONS)
- 告警 → Runbook 映射
- 告警 → Incident Type 映射
- 告警 → 风险等级 (P0/P1/P2/P3)
- 关联指标 (related_metrics)
- 关联告警 (related_alerts)
- 建议动作 (suggested_actions)

**告警定义示例**:
```typescript
'RedisDisconnected': {
  name: 'RedisDisconnected',
  severity: 'P0',
  condition: 'redis_connected == 0 for 1m',
  runbook: 'RUNBOOK_REDIS_OUTAGE.md',
  incident_type: 'redis_outage',
  escalation_policy: 'immediate',
  tags: { category: 'infrastructure', component: 'redis' },
}
```

**已定义告警 (8 条 P0)**:
| 告警 | Runbook | Incident Type |
|------|---------|---------------|
| RedisDisconnected | RUNBOOK_REDIS_OUTAGE.md | redis_outage |
| LockAcquireFailureSpike | RUNBOOK_LOCK_LEAK.md | lock_contention |
| RecoverySessionStuck | RUNBOOK_RECOVERY_STUCK.md | recovery_stuck |
| ReplayFailureSpike | RUNBOOK_REPLAY_MISFIRE.md | replay_failure |
| IdempotencyHitAnomaly | RUNBOOK_WEBHOOK_STORM.md | webhook_storm |
| WebhookIngestErrorSpike | RUNBOOK_WEBHOOK_STORM.md | webhook_failure |
| AuditWriteFailure | TBD | audit_failure |
| StateTransitionRejectSpike | TBD | state_machine_anomaly |

---

### 2. Alert Action API

**文件**: `src/alerting/alert_actions.ts`

**功能**:
- `acknowledge(alert)` — 确认告警
- `silence(alert, duration)` — 静音告警
- `escalate(alert)` — 升级告警
- `link_incident(alert, incident)` — 关联 incident
- `open_runbook(alert)` — 打开 runbook

**动作记录**:
- 所有动作写入 action_history
- 所有动作写入 audit log
- 支持查询历史

---

### 3. Incident Link

**功能**:
- 告警自动关联到 incident
- 同一 correlation_id 自动挂接
- 防止重复建 incident
- Incident 状态管理 (open/investigating/resolved/closed)

**Incident 结构**:
```typescript
interface IncidentLink {
  incident_id: string;
  incident_type: string;
  created_at: number;
  created_by: string;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  correlation_id?: string;
  related_alerts: string[];
}
```

---

### 4. Runbook Session

**功能**:
- 打开 runbook 时创建 session
- 记录 runbook 中的动作
- 记录止血/恢复/回滚动作
- Session 状态管理 (in_progress/completed/abandoned)

**Runbook Session 结构**:
```typescript
interface RunbookSession {
  runbook_name: string;
  opened_at: number;
  opened_by: string;
  actions_taken: RunbookAction[];
  status: 'in_progress' | 'completed' | 'abandoned';
}
```

---

### 5. Timeline 聚合

**功能**:
- 告警事件进入 timeline
- 可按 alert/incident/correlation_id 查询
- 支持时间范围查询
- 支持标签过滤

**Timeline Entry 结构**:
```typescript
interface TimelineEntry {
  id: string;
  type: 'alert' | 'incident' | 'action' | 'recovery';
  timestamp: number;
  correlation_id?: string;
  metadata: Record<string, unknown>;
}
```

---

## 使用流程

### 场景 1: P0 告警出现

```
1. 告警触发 (RedisDisconnected)
   ↓
2. Alert Router 路由
   - severity: P0
   - runbook: RUNBOOK_REDIS_OUTAGE.md
   - incident_type: redis_outage
   - suggested_actions: [acknowledge, escalate, open_runbook, link_incident]
   ↓
3. On-call 收到通知
   ↓
4. On-call 执行动作
   - acknowledge (确认)
   - open_runbook (打开 RUNBOOK_REDIS_OUTAGE.md)
   - link_incident (创建/关联 incident)
   ↓
5. 所有动作写入 audit log
   ↓
6. Timeline 可见完整链路
```

---

### 场景 2: 关联告警自动挂接

```
1. RedisDisconnected 触发
   - 创建 incident-001
   ↓
2. LockAcquireFailureSpike 触发 (关联告警)
   - 自动挂接到 incident-001
   - 不创建新 incident
   ↓
3. RecoverySessionStuck 触发 (关联告警)
   - 自动挂接到 incident-001
   ↓
4. 一个 incident 包含所有相关告警
```

---

## 验收标准

一条 P0 告警出现后，能在一个操作面里完成：

- [ ] 看告警 (alert_name, severity, triggered_at, value)
- [ ] 看关联指标 (related_metrics)
- [ ] 看关联告警 (related_alerts)
- [ ] 看 runbook (runbook_url)
- [ ] 建/挂 incident (link_incident)
- [ ] 写入 timeline/audit (action_history)

---

## 下一步

### 已完成
- [x] Alert Router (`src/alerting/alert_router.ts`)
- [x] Alert Action API (`src/alerting/alert_actions.ts`)

### 待完成
- [ ] Timeline 聚合 (与 persistence 集成)
- [ ] Incident 持久化 (与 repository 集成)
- [ ] Runbook Session 持久化
- [ ] UI 操作面 (可选)
- [ ] 与现有告警系统集成

---

_最后更新：2026-04-05 03:45_
_版本：1.0_
_状态：设计完成，代码已创建_
