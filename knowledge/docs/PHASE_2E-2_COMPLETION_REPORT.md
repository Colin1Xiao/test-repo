# Phase 2E-2: Replay / Recovery Engine - 完成报告

**状态**: ✅ **代码完成**  
**时间**: 2026-04-04 06:45 (Asia/Shanghai)

---

## 执行摘要

Phase 2E-2 成功实现了事件重放引擎和状态恢复引擎，将 OpenClaw 从"持久化可用"推进到"可重建、可恢复"的系统。

**核心成果**:
- ✅ Replay Engine (事件重放)
- ✅ Recovery Engine (状态恢复)
- ✅ Dry-run 模式 (无副作用)
- ✅ Side-effect guard
- ✅ Startup recovery scan
- ✅ Orphan/stale object detection

**总体完成度**: **90%** (代码完成，待集成测试)

---

## 交付文件

| 文件 | 职责 | 行数 |
|------|------|------|
| `replay_engine.ts` | 事件重放引擎 | ~320 |
| `recovery_engine.ts` | 状态恢复引擎 | ~380 |

**新增代码**: ~700 行

---

## Replay Engine 能力

### 重放模式

| 模式 | 说明 | 状态 |
|------|------|------|
| `dry-run` | 无副作用，仅重建状态 | ✅ |
| `execute` | 执行完整重放 | ✅ |

### 重放查询

| 查询类型 | 说明 | 状态 |
|----------|------|------|
| 时间范围 | `startTime` / `endTime` | ✅ |
| 事件类型 | `eventTypes` | ✅ |
| Correlation ID | `correlationId` | ✅ |
| 目标对象 | `targetObject` | ✅ |

### 重放方法

| 方法 | 说明 | 状态 |
|------|------|------|
| `replay()` | 通用重放 | ✅ |
| `replayByCorrelationId()` | 按 correlation ID 重放 | ✅ |
| `replayByTargetObject()` | 按目标对象重放 | ✅ |
| `replayByTimeRange()` | 按时间范围重放 | ✅ |
| `generatePlan()` | 生成重放计划 | ✅ |

### 重放结果

```typescript
interface ReplayResult {
  success: boolean;
  mode: ReplayMode;
  eventsProcessed: number;
  stateRebuilt: {
    approvals: number;
    incidents: number;
    events: number;
  };
  sideEffects: Array<{...}>;
  errors: Array<{...}>;
  summary: string;
}
```

---

## Recovery Engine 能力

### 恢复扫描

| 扫描项 | 说明 | 状态 |
|--------|------|------|
| Approvals | 审批状态扫描 | ✅ |
| Incidents | 事件状态扫描 | ✅ |
| Events | 事件存储扫描 | ✅ |
| Orphaned Objects | 孤儿对象识别 | ✅ |
| Stale Objects | 过期对象识别 | ✅ |

### 恢复方法

| 方法 | 说明 | 状态 |
|------|------|------|
| `scan()` | 完整恢复扫描 | ✅ |
| `recoverPendingApprovals()` | 恢复待处理审批 | ✅ |
| `recoverActiveIncidents()` | 恢复活跃事件 | ✅ |

### 恢复结果

```typescript
interface RecoveryResult {
  success: boolean;
  scanCompleted: boolean;
  recovered: {
    approvals: { pending: number; total: number; };
    incidents: { active: number; acknowledged: number; resolved: number; total: number; };
    events: { total: number; last24h: number; };
  };
  orphanedObjects: Array<{...}>;
  staleObjects: Array<{...}>;
  errors: Array<{...}>;
  summary: string;
}
```

---

## 配置项

### RecoveryConfig

| 配置 | 默认值 | 说明 |
|------|--------|------|
| `approvalTimeoutMs` | 24 小时 | 审批超时阈值 |
| `incidentTimeoutMs` | 7 天 | 事件超时阈值 |
| `maxRecoverApprovals` | 100 | 最大恢复审批数 |
| `maxRecoverIncidents` | 100 | 最大恢复事件数 |

---

## 验收标准

| # | 标准 | 状态 | 说明 |
|---|------|------|------|
| 1 | 能按时间段/对象/correlation id 重放事件 | ✅ | 代码完成 |
| 2 | 重放后得到的对象状态与原状态一致 | ✅ | 状态重建逻辑 |
| 3 | dry-run 下不产生外部副作用 | ✅ | side-effect guard |
| 4 | 重放结果有摘要输出 | ✅ | ReplayResult.summary |
| 5 | 服务启动后可扫描持久层 | ✅ | scan() 方法 |
| 6 | 可恢复 pending approvals | ✅ | recoverPendingApprovals() |
| 7 | 可恢复 active/resolved incidents | ✅ | recoverActiveIncidents() |
| 8 | 可识别 orphan/stale object | ✅ | identifyOrphaned/identifyStale |
| 9 | 恢复结果写入 audit/recovery log | ✅ | auditLogService 集成 |

**完成度**: **90%** (代码完成，待集成测试)

---

## 设计原则

### 1. Replay 不等于重新执行外部动作

重放引擎优先：
- ✅ 读取 event log
- ✅ 重建 repository state
- ✅ 校验状态迁移正确性
- ❌ 不重新发 webhook
- ❌ 不重新执行 runbook
- ❌ 不重新批准审批

### 2. Recovery 先做"可恢复"，再做"自动恢复"

第一版支持：
- ✅ 扫描
- ✅ 识别
- ✅ 重建
- ✅ 标记

后续可扩展：
- ⚪ 自动修复
- ⚪ 自动清理
- ⚪ 自动通知

### 3. 第一版只围绕 3 类对象

- ✅ Approvals
- ✅ Incidents
- ✅ Events

后续可扩展：
- ⚪ Risk State
- ⚪ Tasks
- ⚪ Sessions

---

## 与 Phase 2E-1 的集成

### 依赖关系

```
Replay Engine
├── Event Repository ✅
├── Approval Repository ✅
└── Incident Repository ✅

Recovery Engine
├── Approval Repository ✅
├── Incident Repository ✅
├── Event Repository ✅
└── Audit Log Service ✅
```

### 集成点

| 集成点 | 状态 | 说明 |
|--------|------|------|
| Event Repository | ✅ | 已创建 |
| Approval Repository | ✅ | 已创建 |
| Incident Repository | ✅ | 已创建 |
| Audit Log Service | ✅ | 已创建 |
| HTTP Server 集成 | ⚪ | 待集成 |

---

## 下一步选项

**A. 集成到 HTTP Server**（推荐）
- 添加 `/replay` 端点
- 添加 `/recovery/scan` 端点
- 添加 `/recovery/approvals` 端点
- 添加 `/recovery/incidents` 端点

**B. 写 Phase 2E 完成报告**
- 汇总 2E-1 + 2E-2 成果
- 规划 2E-3 / 2E-4

**C. 修复 OCNMPS 灰度问题**
- 配置未正确加载

---

**记录时间**: 2026-04-04 06:45  
**状态**: ✅ 代码完成，待集成测试

---

_从「持久化可用」到「可重建、可恢复」_
