# Incident Sequence

**阶段**: Phase X-2: Temporal & Recovery Mechanics Extraction  
**日期**: 2026-04-05  
**状态**: ✅ **COMPLETE**

---

## 一、事件传播顺序

### 1.1 Alert Ingest 流程

**时序**:
```
T0:   Alert 触发 (外部系统)
T0+ε: Alert 到达 Ingest Handler
T0+2ε: Dedupe 检查 (内存 Map)
T0+3ε: ├─ 如果重复 → 返回 suppressed=true
T0+3ε: └─ 如果不重复 → 继续
T0+4ε: 记录 Timeline (alert_triggered)
T0+5ε: Alert Router 路由
T0+6ε: 记录 Timeline (alert_routed)
T0+7ε: 检查 Incident (相同 correlation_id)
T0+8ε: ├─ 如果存在 open incident → 关联 alert
T0+8ε: │   记录 Timeline (incident_linked)
T0+8ε: └─ 如果不存在 → 创建 Incident
T0+9ε:     写入 Incident 文件 (加锁)
T0+10ε:    记录 Timeline (incident_created)
T0+11ε:    返回 incident_id
```

**关键点**:
1. Dedupe 检查 **先于** 任何写入
2. Timeline 记录 **先于** Incident 创建 (alert_triggered/alert_routed)
3. Incident 检查 **先于** 创建 (防重复)
4. 文件锁保护写入 (单实例)

**时间量级**:
- T0 ~ T0+11ε: <100ms (典型)
- ε: ~1-10ms

### 1.2 状态变更流程

**时序**:
```
T0:   PATCH /incidents/:id 请求
T0+ε: 验证 Incident 存在
T0+2ε: 验证状态迁移合法 (StateSequenceValidator)
T0+3ε: ├─ 如果非法 → 返回 400
T0+3ε: └─ 如果合法 → 继续
T0+4ε: 获取文件锁 (incidents)
T0+5ε: 更新内存索引
T0+6ε: 追加 JSONL (incident_updated)
T0+7ε: 释放文件锁
T0+8ε: 记录 Timeline (incident_updated)
T0+9ε: 返回成功
```

**关键点**:
1. 状态验证 **先于** 锁获取 (避免无效锁持有)
2. 内存索引更新 **先于** 文件写入 (快速失败)
3. Timeline 记录 **后于** 文件写入 (保证持久化)
4. 锁持有时间: T0+4ε ~ T0+7ε (<10ms)

---

## 二、状态迁移与持久化顺序

### 2.1 写入顺序保证

**规则 1: Incident 创建**
```
1. 检查重复 (内存)
2. 创建内存对象
3. 获取文件锁
4. 追加 JSONL (incident_created)
5. 更新内存索引
6. 释放文件锁
7. 记录 Timeline (incident_created)
```

**规则 2: Incident 更新**
```
1. 验证状态迁移 (内存)
2. 获取文件锁
3. 更新内存对象
4. 追加 JSONL (incident_updated)
5. 更新内存索引
6. 释放文件锁
7. 记录 Timeline (incident_updated)
```

**规则 3: Timeline 记录**
```
1. 创建 Timeline 事件对象
2. 获取文件锁 (timeline)
3. 追加 JSONL (timeline.jsonl)
4. 更新内存索引
5. 释放文件锁
```

### 2.2 顺序不变性

**不变性 1: Timeline 不先于 Incident**
- `incident_created` 必须先于 `incident_linked`
- 验证：检查时间戳顺序

**不变性 2: Alert 不先于 Dedupe**
- `alert_triggered` 必须先于 Dedupe 检查
- 验证：检查 suppressed 标志

**不变性 3: 锁持有期间不记录 Timeline**
- 避免 Timeline 写入阻塞锁释放
- 验证：检查锁持有时间

---

## 三、Replay / Recovery / Restart 副作用抑制

### 3.1 Replay 副作用抑制

**场景**: 重放历史事件 (测试/审计)

**抑制规则**:
```
IF (dry_run == true) THEN
  只读内存，不写文件
  不记录 Timeline
  不记录 Audit
  返回模拟结果
END IF
```

**实现**:
```typescript
async replay(options: ReplayOptions): Promise<ReplayResult> {
  if (options.dry_run) {
    // 只读模式
    const state = await this.loadState();
    const result = await this.simulate(state, options);
    return { ...result, dry_run: true };
  }

  // 真实重放 (需要审批)
  // ...
}
```

### 3.2 Recovery 副作用抑制

**场景**: 恢复未完成的动作

**抑制规则**:
```
FOR EACH pending_item IN scan_pending():
  IF (already_processed(pending_item)) THEN
    标记为 recovered，不重放
  ELSE IF (side_effect_safe(pending_item)) THEN
    重放动作
    记录 Audit (recovery_action)
  ELSE
    标记为 failed，人工介入
  END IF
END FOR
```

**安全检查**:
```typescript
async side_effect_safe(item: RecoveryItem): Promise<boolean> {
  // 检查是否已处理 (幂等)
  const processed = await this.checkIfProcessed(item);
  if (processed) return false;

  // 检查副作用类型
  if (item.side_effect_type === 'external_api') {
    // 外部 API 调用需要额外检查
    return await this.checkExternalApiSafe(item);
  }

  return true; // 内部操作，安全
}
```

### 3.3 Restart 副作用抑制

**场景**: 服务重启后恢复

**抑制规则**:
```
1. 加载快照 (只读)
2. 回放增量 JSONL (只读)
3. 重建内存索引
4. 验证一致性
5. 标记服务就绪
6. 不触发任何新动作
```

**实现**:
```typescript
async initialize(): Promise<void> {
  // 1. 加载快照
  const snapshot = await this.loadSnapshot();
  
  // 2. 回放增量
  const events = await this.loadIncrementalEvents(snapshot.timestamp);
  
  // 3. 重建索引
  this.rebuildIndex(snapshot, events);
  
  // 4. 验证
  await this.validateConsistency();
  
  // 5. 标记就绪
  this.isReady = true;
  
  // 6. 不触发新动作 (仅恢复状态)
  console.log(`Initialized with ${this.incidents.size} incidents`);
}
```

---

## 四、Webhook / Alert / Incident 入口顺序

### 4.1 Webhook 入口

**时序**:
```
T0:   Webhook 到达
T0+ε: 解析 Payload
T0+2ε: 提取 event_id (幂等 key)
T0+3ε: 检查是否已处理 (幂等)
T0+4ε: ├─ 如果已处理 → 返回 ingested=false
T0+4ε: └─ 如果未处理 → 继续
T0+5ε: 获取文件锁 (audit)
T0+6ε: 记录 Audit (webhook_received)
T0+7ε: 释放文件锁
T0+8ε: Webhook Mapping
T0+9ε: 转换为 Alert/Incident
T0+10ε: 调用 Alert Ingest (见 1.1)
```

**关键点**:
1. 幂等检查 **先于** 任何写入
2. Audit 记录 **先于** 业务处理 (追踪入口)
3. Mapping **后于** 幂等检查 (避免无效计算)

### 4.2 Alert 入口

**时序**: 见 1.1 Alert Ingest 流程

### 4.3 Incident 入口

**时序**:
```
T0:   创建 Incident 请求
T0+ε: 验证请求格式
T0+2ε: 验证审批 (如果需要)
T0+3ε: ├─ 如果未审批 → 返回 403
T0+3ε: └─ 如果已审批 → 继续
T0+4ε: 获取文件锁 (incidents)
T0+5ε: 创建 Incident (见 2.1)
T0+6ε: 记录 Audit (incident_created)
T0+7ε: 返回 incident_id
```

---

## 五、Compact / Summarize / Memory Capture 时机

### 5.1 快照 Compact

**时机**: 每 1 分钟 或 每 N 次写入

**触发条件**:
```typescript
async maybeCreateSnapshot(): Promise<void> {
  const now = Date.now();
  if (now - this.lastSnapshotAt > this.config.snapshotIntervalMs) {
    await this.createSnapshot();
  }
}
```

**顺序**:
```
1. 获取文件锁 (incidents)
2. 读取内存索引
3. 写入临时文件 (incidents_snapshot.json.tmp)
4. 验证临时文件
5. Rename 临时文件 → 正式文件
6. 备份旧快照
7. 清理旧备份 (>3 个)
8. 释放文件锁
9. 更新 lastSnapshotAt
```

### 5.2 Timeline Summarize

**时机**: 每 1000 条事件 或 每 10 分钟

**触发条件**:
```typescript
async maybeSummarize(): Promise<void> {
  if (this.events.length > 1000 || 
      Date.now() - this.lastSummarizeAt > 10 * 60 * 1000) {
    await this.summarize();
  }
}
```

**总结内容**:
- 事件总数
- 按类型统计
- 按 incident 统计
- 时间范围

### 5.3 Memory Capture

**时机**: 每次状态变更

**触发条件**:
```typescript
// Incident 更新时
async update(incident_id: string, update: IncidentUpdateRequest): Promise<void> {
  // ... 更新逻辑
  
  // Memory Capture (Audit)
  await this.audit.log({
    type: 'state_transition',
    object_type: 'incident',
    object_id: incident_id,
    metadata: {
      from: previous_status,
      to: update.status,
    },
  });
}
```

---

## 六、已验证时序

| 场景 | 验证状态 | 备注 |
|------|---------|------|
| Alert Ingest | ✅ Wave 2-A | <100ms |
| Incident 创建 | ✅ Wave 2-A | <50ms |
| Incident 更新 | ✅ 3B-1 | <30ms |
| 文件锁获取 | ✅ 3B-3.1 | <10ms |
| 重启恢复 | ✅ Wave 2-A | <5s |
| Replay Dry-run | ✅ Wave 2-A | <100ms |

---

## 七、时序异常处理

### 7.1 超时处理

**规则**:
```
IF (操作耗时 > 阈值) THEN
  记录警告日志
  如果是锁操作 → 强制释放
  如果是写入操作 → 回滚
  如果是读取操作 → 返回缓存
END IF
```

**阈值**:
| 操作 | 阈值 | 动作 |
|------|------|------|
| 锁获取 | 30s | 强制释放 |
| 文件写入 | 10s | 回滚 |
| 文件读取 | 5s | 返回缓存 |
| 重启恢复 | 60s | 告警 |

### 7.2 乱序处理

**规则**:
```
IF (事件时间戳乱序) THEN
  记录警告日志
  如果是 Timeline → 按时间戳排序
  如果是 JSONL → 保留原始顺序
  如果是 Audit → 按时间戳排序
END IF
```

---

_文档版本：1.0  
最后更新：2026-04-05 05:42 CST_
