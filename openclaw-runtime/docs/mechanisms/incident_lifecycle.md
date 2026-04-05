# Incident Lifecycle

**阶段**: Phase X-1: Source Intelligence Extraction  
**日期**: 2026-04-05  
**状态**: ✅ **COMPLETE**

---

## 一、状态集合

### 1.1 核心状态

| 状态 | 含义 | 终端状态 |
|------|------|---------|
| `open` | 初始状态，告警已创建 | ❌ |
| `investigating` | 已确认，正在调查 | ❌ |
| `resolved` | 已解决，等待关闭 | ✅ |
| `closed` | 已关闭，归档 | ✅ |

### 1.2 状态来源

| 状态 | 触发源 | 执行者 |
|------|--------|--------|
| `open` | Alert Ingest Service | alert_ingest_service |
| `investigating` | PATCH /incidents/:id | 人工/API |
| `resolved` | PATCH /incidents/:id | 人工/API |
| `closed` | 自动 (TBD) / 人工 | system/admin |

---

## 二、合法迁移

### 2.1 状态迁移图

```
open ──────────────────────────────────────┐
  │                                        │
  ▼                                        │
investigating ─────────────────────────────┤
  │                                        │
  ▼                                        │
resolved ─────────────────────────────► closed
  ▲                                        ▲
  │                                        │
  └────────────────────────────────────────┘
         (re-open / retry)
```

### 2.2 合法迁移表

| 从 | 到 | 触发条件 | 验证规则 |
|----|----|---------|---------|
| `open` | `investigating` | 人工确认 | actor 必须存在 |
| `open` | `resolved` | 自动解决 (罕见) | 必须有 explanation |
| `investigating` | `resolved` | 问题解决 | 必须有 resolution |
| `investigating` | `open` | 需要更多信息 | 必须有 reason |
| `resolved` | `closed` | 归档窗口到期 | 自动/人工 |
| `resolved` | `open` | 问题复发 | 必须有 recurrence_reason |

---

## 三、非法迁移

### 3.1 明确禁止的迁移

| 从 | 到 | 原因 | 系统行为 |
|----|----|------|---------|
| `closed` | `open` | 已归档，不应复用 | 拒绝，创建新 incident |
| `closed` | `investigating` | 已归档 | 拒绝 |
| `resolved` | `investigating` | 状态回退 | 拒绝，应使用 re-open |
| `open` | `closed` | 跳过中间状态 | 拒绝 |

### 3.2 并发冲突处理

**场景**: 两个请求同时更新同一 incident

**行为**: Last-write-wins (当前实现)

**风险**: 后写入的覆盖先写入的

**缓解**:
- 短期：Audit 记录所有更新
- 中期：乐观锁 (version 字段)
- 长期：分布式锁 (多实例)

---

## 四、触发条件

### 4.1 Incident 创建

**触发源**: Alert Ingest Service

**条件**:
1. Alert 定义存在 (`ALERT_DEFINITIONS`)
2. Dedupe 检查通过 (相同 correlation_id/resource 5 分钟内无 open incident)
3. `auto_create_incident: true`

**创建动作**:
```typescript
incident = {
  id: `incident-${timestamp}-${type}`,
  type: definition.incident_type,
  severity: definition.severity,
  status: 'open',
  title: `${alert_name} - ${resource || 'Unknown'}`,
  description: `Alert triggered: ${alert_name}`,
  created_at: Date.now(),
  created_by: 'alert_ingest_service',
  correlation_id,
  resource,
  related_alerts: [alert_name],
}
```

### 4.2 Incident 状态变更

**触发源**: PATCH /alerting/incidents/:id

**条件**:
1. Incident 存在
2. 目标状态合法 (符合迁移规则)
3. 非终端状态或允许 re-open

**变更动作**:
```typescript
incident.status = new_status
incident.updated_at = Date.now()
incident.updated_by = performer
if (status === 'resolved') {
  incident.resolved_at = Date.now()
  incident.resolved_by = performer
}
```

### 4.3 Incident 关联 Alert

**触发源**: Alert Ingest (重复告警)

**条件**:
1. 已存在 open incident (相同 type/correlation_id/resource)
2. 新 alert 与 incident 类型匹配

**关联动作**:
```typescript
incident.related_alerts.push(alert_name)
incident.updated_at = Date.now()
timeline.recordIncidentLinked(incident.id, alert_name)
```

---

## 五、并发/重复操作行为

### 5.1 重复 Alert Ingest

**场景**: 相同 correlation_id 的 alert 短时间多次投递

**行为**:
1. Dedupe 检查 (5 分钟窗口)
2. 如存在 open incident → 关联 alert，不创建新 incident
3. Timeline 记录 `incident_linked`，不记录 `incident_created`

**验证**: Wave 2-A T+0h 基线测试通过 (10 并发，1 成功/9 抑制)

### 5.2 并发状态更新

**场景**: 多个请求同时 PATCH 同一 incident

**当前行为**:
- 文件锁保护写入 (单实例安全)
- Last-write-wins (内存索引)
- 所有更新追加到 JSONL

**风险**:
- 后写入的覆盖先写入的 `updated_by`/`updated_at`
- Audit 记录完整，但 incident 状态只保留最后一个

**缓解**:
- Audit 日志记录所有更新
- Timeline 记录所有状态变更
- 中期引入乐观锁

### 5.3 重复 Resolve

**场景**: 同一 incident 多次 resolve 请求

**行为**:
- 第一次：`resolved` → 成功
- 后续：`resolved` → `resolved` (状态不变，但记录更新)

**验证**: 需要补充测试用例

---

## 六、恢复/Replay 状态规则

### 6.1 重启恢复

**恢复源**: `incidents_snapshot.json` + `incidents.jsonl` 增量回放

**规则**:
1. 加载快照 (最近一次)
2. 回放增量事件 (快照后的所有事件)
3. 重建内存索引
4. 验证状态一致性

**验证**: Wave 2-A T+24h 重启验证

### 6.2 Replay 场景

**适用**: 测试/审计/故障恢复

**规则**:
1. Dry-run 模式 (无副作用)
2. 重放事件到内存 (不写文件)
3. 输出状态序列

**保护**:
- `dry_run: true` 强制
- 不创建/更新 incident 文件
- 不写入 timeline/audit

### 6.3 Recovery 场景

**适用**: 恢复未完成的动作 (如 pending approvals)

**规则**:
1. 扫描 incident (status=open/investigating)
2. 检查关联的 pending actions
3. 执行恢复动作 (需人工确认)

**保护**:
- Recovery Coordinator 所有权保护
- 文件锁防止并发恢复
- Audit 记录所有恢复动作

---

## 七、实现映射

### 7.1 核心文件

| 文件 | 职责 |
|------|------|
| `incident_repository.ts` | Incident 存储 (内存 + 索引) |
| `incident_file_repository.ts` | 文件持久化 (JSONL + 快照) |
| `alert_ingest.ts` | Incident 创建/关联 |
| `alerting_routes.ts` | HTTP 端点 (PATCH /incidents/:id) |

### 7.2 关键函数

| 函数 | 功能 |
|------|------|
| `IncidentFileRepository.create()` | 创建 incident (加锁) |
| `IncidentFileRepository.update()` | 更新 incident (加锁) |
| `AlertIngestService.ingest()` | Alert 摄入 + Incident 创建/关联 |
| `TimelineStore.recordIncidentCreated()` | Timeline 记录 |
| `TimelineStore.recordIncidentLinked()` | Timeline 记录 |

### 7.3 已验证行为

| 测试 | 结果 |
|------|------|
| Incident 创建持久化 | ✅ 通过 |
| 状态变更持久化 | ✅ 通过 |
| 重启恢复 | ✅ 通过 |
| 并发状态更新 (5 并发) | ✅ 通过 |
| Dedupe (10 并发) | ✅ 1 成功/9 抑制 |

---

## 八、待改进项

### 8.1 短期 (Wave 2 后)

- [ ] 乐观锁 (version 字段)
- [ ] 状态变更 Audit 完整记录
- [ ] 自动关闭逻辑 (resolved → closed)

### 8.2 中期 (Phase 4.x)

- [ ] 多实例分布式锁
- [ ] 状态变更审批流
- [ ] SLA 追踪 (MTTR/MTBF)

### 8.3 长期 (平台化)

- [ ] 可配置状态机 (非硬编码)
- [ ] 多租户支持
- [ ] 跨 incident 关联/依赖

---

_文档版本：1.0  
最后更新：2026-04-05 05:35 CST_
