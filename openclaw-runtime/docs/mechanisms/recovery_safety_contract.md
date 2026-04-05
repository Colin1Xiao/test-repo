# Recovery Safety Contract

**阶段**: Phase X-3: Constraints & Evolution Guardrails  
**日期**: 2026-04-05  
**状态**: ✅ **COMPLETE**

---

## 一、恢复安全总则

### 契约 R-0: 恢复三原则

```
RECOVERY THREE PRINCIPLES

1. 幂等性 (Idempotency)
   恢复操作必须幂等
   重复恢复不产生重复副作用

2. 安全性 (Safety)
   恢复不破坏现有状态
   恢复不引入新错误

3. 可追溯性 (Traceability)
   所有恢复动作必须记录 Audit
   恢复失败必须可诊断
```

---

## 二、Replay 安全契约

### 契约 R-1: Replay Dry-run 安全

```
REPLAY DRY-RUN SAFETY

MUST:
- 只读模式 (不写文件)
- 内存操作 (不持久化)
- 记录日志 (用于审计)

MUST NOT:
- 写入文件 (incidents/timeline/audit)
- 触发通知 (邮件/消息)
- 调用外部 API

GUARANTEE:
Replay dry-run 零副作用
```

**实现约束**:
```typescript
async replay(options: ReplayOptions): Promise<ReplayResult> {
  // 强制 dry-run 验证
  if (!options.dry_run) {
    throw new Error('Non-dry-run replay requires approval');
  }

  // 只读加载
  const snapshot = await this.loadSnapshotReadOnly();
  const events = await this.loadIncrementalEventsReadOnly();

  // 内存重放
  const tempState = new Map();
  const replayLog = await this.replayInMemory(tempState, events);

  // 清理 (无残留)
  tempState.clear();

  return { dry_run: true, log: replayLog };
}
```

### 契约 R-2: Replay 时间旅行安全

```
REPLAY TIME-TRAVEL SAFETY

MUST:
- 只读模式
- 指定目标时间戳
- 过滤事件 (timestamp <= target)

MUST NOT:
- 修改历史状态
- 影响当前状态

GUARANTEE:
时间旅行仅用于审计/调试
```

### 契约 R-3: Replay 审批要求

```
REPLAY APPROVAL REQUIREMENT

IF (dry_run == false) THEN
  REQUIREMENTS:
  - 人工审批
  - 影响评估
  - 回滚计划
  - Audit 记录
END IF
```

---

## 三、Recovery 安全契约

### 契约 R-4: Recovery Scan 安全

```
RECOVERY SCAN SAFETY

MUST (dry_run):
- 只读扫描
- 生成恢复计划
- 评估副作用

MUST (!dry_run):
- 人工审批
- 逐项恢复
- 记录 Audit

GUARANTEE:
Scan 不改变状态 (dry_run)
```

**实现约束**:
```typescript
async scan(options: RecoveryScanOptions): Promise<RecoveryScanResult> {
  // 强制 dry_run 验证 (Wave 2-A 期间)
  if (!options.dry_run) {
    throw new Error('Non-dry-run recovery scan requires approval');
  }

  // 只读扫描
  const pending_items = await this.scanPendingReadOnly();

  // 生成计划
  const recovery_plan = [];
  for (const item of pending_items) {
    const processed = await this.checkIfProcessed(item);
    if (processed) {
      await this.markAsRecovered(item);
    } else {
      recovery_plan.push({
        item,
        action: 'replay',
        side_effects: await this.estimateSideEffects(item),
      });
    }
  }

  // 记录 Audit
  await this.audit.log({
    type: 'recovery_scan_completed',
    metadata: { dry_run: options.dry_run },
  });

  return { dry_run: options.dry_run, recovery_plan };
}
```

### 契约 R-5: Recovery 幂等

```
RECOVERY IDEMPOTENCY

FOR EACH recovery_item:
  IF (item.processed) THEN
    SKIP (不重放)
    MARK as recovered
  ELSE
    PROCESS
    MARK as processed
  END IF
END FOR

GUARANTEE:
重复恢复不产生重复副作用
```

### 契约 R-6: Recovery 副作用抑制

```
RECOVERY SIDE-EFFECT SUPPRESSION

ALLOWED:
- 内部状态恢复
- 文件写入 (加锁)
- Timeline/Audit 记录

REQUIRES APPROVAL:
- 通知发送
- 外部 API 调用

PROHIBITED:
- 未经审批的外部动作
- 批量自动触发
```

---

## 四、Restart 安全契约

### 契约 R-7: 重启只读加载

```
RESTART READ-ONLY LOAD

MUST:
- 快照只读加载
- JSONL 只读加载
- 内存索引重建

MUST NOT:
- 写入文件
- 修改状态
- 触发通知

GUARANTEE:
重启加载零副作用
```

### 契约 R-8: 重启一致性验证

```
RESTART CONSISTENCY VALIDATION

MUST:
- 验证 Incident 数量
- 验证 Timeline 数量
- 验证时间戳顺序
- 验证 Correlation ID 完整

IF (验证失败) THEN:
- 告警
- 人工介入
- 不自动修复
END IF
```

**验证脚本**:
```bash
verify_restart_consistency() {
  # Incident 数量
  incidents_before="$1"
  incidents_after=$(curl -s http://localhost:3000/alerting/incidents | jq '.count')
  
  if [ "$incidents_before" != "$incidents_after" ]; then
    echo "CONSISTENCY VIOLATION: incident count mismatch"
    return 1
  fi
  
  # Timeline 数量
  timeline_before="$2"
  timeline_after=$(curl -s "http://localhost:3000/alerting/timeline?limit=1000" | jq '.count')
  
  if [ "$timeline_before" != "$timeline_after" ]; then
    echo "CONSISTENCY VIOLATION: timeline count mismatch"
    return 1
  fi
  
  echo "Consistency verified"
  return 0
}
```

### 契约 R-9: 重启后静默期

```
RESTART SILENT PERIOD

AFTER restart:
- 等待外部请求
- 不自动触发通知
- 不自动恢复积压
- 静默期：5 分钟

PURPOSE:
避免重启风暴
```

---

## 五、恢复安全验证矩阵

| 契约 | 自动验证 | 手动验证 | 频率 |
|------|---------|---------|------|
| R-0: 恢复三原则 | ❌ | ✅ | 设计审查 |
| R-1: Replay Dry-run | ✅ | ❌ | 每次 Replay |
| R-2: 时间旅行 | ✅ | ❌ | 每次使用 |
| R-3: Replay 审批 | ✅ | ❌ | 每次请求 |
| R-4: Recovery Scan | ✅ | ❌ | 每次 Scan |
| R-5: Recovery 幂等 | ✅ | ❌ | 每次恢复 |
| R-6: 副作用抑制 | ⚠️ Audit | ✅ 抽样 | 每天 |
| R-7: 重启只读 | ❌ | ✅ | 每次重启 |
| R-8: 一致性验证 | ❌ | ✅ | 每次重启 |
| R-9: 静默期 | ❌ | ✅ | 每次重启 |

---

## 六、违反处理

### 6.1 分级

| 级别 | 契约 | 响应时间 |
|------|------|---------|
| P0 | R-1, R-5, R-7, R-8 | 立即 |
| P1 | R-3, R-4, R-6 | 1 小时 |
| P2 | R-2, R-9 | 4 小时 |

### 6.2 处理流程

```
检测到违反
    ↓
停止恢复操作
    ↓
记录违反详情
    ↓
分级 (P0/P1/P2)
    ↓
┌─────────────────────┐
│ P0? │ P1? │ P2? │
└─────────────────────┘
    ↓     ↓     ↓
  立即   1h   4h
  回滚   修复   观察
    ↓
根因分析
    ↓
修复 + 预防
```

---

## 七、恢复安全审计

### 7.1 审计日志要求

```
RECOVERY AUDIT REQUIREMENTS

MUST RECORD:
- recovery_scan_started
- recovery_scan_completed
- recovery_item_processed
- recovery_item_skipped (已处理)
- recovery_item_failed
- recovery_action (具体动作)

MUST INCLUDE:
- item_id
- item_type
- action
- result
- timestamp
- actor (system/user)
```

### 7.2 审计查询

```bash
# 查询恢复历史
curl -s "http://localhost:3000/alerting/timeline?event_type=recovery_action" | jq '
  .events | group_by(.item_type) | 
  map({
    type: .[0].item_type,
    count: length,
    last: (.[0].timestamp | todate)
  })
'
```

---

_文档版本：1.0  
最后更新：2026-04-05 05:50 CST_
