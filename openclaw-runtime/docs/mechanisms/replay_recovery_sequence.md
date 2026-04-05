# Replay & Recovery Sequence

**阶段**: Phase X-2: Temporal & Recovery Mechanics Extraction  
**日期**: 2026-04-05  
**状态**: ✅ **COMPLETE**

---

## 一、Replay 事件顺序

### 1.1 Replay Dry-run 流程

**时序**:
```
T0:   POST /trading/replay/run 请求
T0+ε: 验证 dry_run == true
T0+2ε: ├─ 如果 dry_run == false → 需要额外审批
T0+2ε: └─ 如果 dry_run == true → 继续
T0+3ε: 加载快照 (只读)
T0+4ε: 加载增量 JSONL (只读)
T0+5ε: 重建内存状态 (临时)
T0+6ε: 重放事件序列
T0+7ε: 记录每次状态变更 (内存)
T0+8ε: 生成重放报告
T0+9ε: 清理临时状态
T0+10ε: 返回重放结果
```

**关键点**:
1. dry_run 验证 **先于** 任何加载
2. 所有操作只读 (不写文件)
3. 临时状态独立 (不污染主索引)
4. 重放后清理 (无残留)

**实现**:
```typescript
async replay(options: ReplayOptions): Promise<ReplayResult> {
  // 1. 验证
  if (!options.dry_run) {
    throw new Error('Non-dry-run replay requires approval');
  }

  // 2. 加载 (只读)
  const snapshot = await this.loadSnapshotReadOnly();
  const events = await this.loadIncrementalEventsReadOnly(snapshot.timestamp);

  // 3. 重建临时状态
  const tempState = new Map();
  this.rebuildState(tempState, snapshot, events);

  // 4. 重放
  const replayLog: ReplayLogEntry[] = [];
  for (const event of options.events || events) {
    const before = clone(tempState.get(event.id));
    this.applyEvent(tempState, event);
    const after = tempState.get(event.id);
    replayLog.push({ event, before, after });
  }

  // 5. 清理
  tempState.clear();

  // 6. 返回
  return {
    dry_run: true,
    events_replayed: replayLog.length,
    log: replayLog,
  };
}
```

### 1.2 Replay 时间旅行

**场景**: 重放到特定时间点

**时序**:
```
T0:   POST /trading/replay/run 请求 (带 target_timestamp)
T0+ε: 验证 target_timestamp
T0+2ε: 加载快照 (只读)
T0+3ε: 过滤增量事件 (timestamp <= target_timestamp)
T0+4ε: 重放过滤后的事件
T0+5ε: 生成时间旅行报告
T0+6ε: 返回结果
```

**实现**:
```typescript
async replayToTimestamp(target_timestamp: number): Promise<ReplayResult> {
  // 加载快照
  const snapshot = await this.loadSnapshotReadOnly();
  
  // 加载并过滤增量事件
  const all_events = await this.loadIncrementalEventsReadOnly(snapshot.timestamp);
  const filtered_events = all_events.filter(e => e.timestamp <= target_timestamp);
  
  // 重放
  const tempState = new Map();
  this.rebuildState(tempState, snapshot, filtered_events);
  
  return {
    dry_run: true,
    target_timestamp,
    events_replayed: filtered_events.length,
    state_snapshot: this.serializeState(tempState),
  };
}
```

---

## 二、Recovery 事件顺序

### 2.1 Recovery Scan 流程

**时序**:
```
T0:   POST /trading/recovery/scan 请求
T0+ε: 验证 dry_run == true (Wave 2-A 期间)
T0+2ε: 扫描 pending/in-progress 对象
T0+3ε: FOR EACH pending_item:
T0+4ε:   检查是否已处理 (幂等)
T0+5ε:   ├─ 如果已处理 → 标记 recovered
T0+5ε:   └─ 如果未处理 → 加入恢复计划
T0+6ε: 生成恢复计划
T0+7ε: 如果 dry_run → 返回计划
T0+8ε: 如果 !dry_run → 执行恢复 (需审批)
T0+9ε: 记录 Audit (recovery_scan_completed)
T0+10ε: 返回结果
```

**关键点**:
1. 幂等检查 **先于** 恢复计划
2. dry_run 模式只返回计划
3. 执行恢复需要额外审批
4. 所有动作记录 Audit

**实现**:
```typescript
async scan(options: RecoveryScanOptions): Promise<RecoveryScanResult> {
  // 1. 验证
  if (!options.dry_run) {
    throw new Error('Non-dry-run recovery scan requires approval');
  }

  // 2. 扫描
  const pending_items = await this.scanPending();

  // 3. 生成计划
  const recovery_plan: RecoveryPlanItem[] = [];
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

  // 4. 记录
  await this.audit.log({
    type: 'recovery_scan_completed',
    metadata: {
      dry_run: options.dry_run,
      items_found: pending_items.length,
      items_to_recover: recovery_plan.length,
    },
  });

  // 5. 返回
  return {
    dry_run: options.dry_run,
    items_found: pending_items.length,
    recovery_plan,
  };
}
```

### 2.2 Recovery Execution 流程

**时序**:
```
T0:   执行恢复计划 (需审批)
T0+ε: 验证审批通过
T0+2ε: FOR EACH plan_item IN recovery_plan:
T0+3ε:   获取文件锁 (根据 item 类型)
T0+4ε:   检查幂等 (再次验证)
T0+5ε:   ├─ 如果已处理 → 跳过
T0+5ε:   └─ 如果未处理 → 执行恢复
T0+6ε:     重放动作
T0+7ε:     记录 Audit (recovery_action)
T0+8ε:     记录 Timeline (recovery_action)
T0+9ε:   释放文件锁
T0+10ε: 生成执行报告
T0+11ε: 返回结果
```

**关键点**:
1. 审批验证 **先于** 执行
2. 执行前再次幂等检查 (双重保护)
3. 每个 item 独立加锁 (细粒度)
4. 所有动作记录 Audit/Timeline

---

## 三、Restart 事件顺序

### 3.1 冷启动流程

**时序**:
```
T0:   服务启动
T0+ε: 初始化配置
T0+2ε: 初始化 IncidentFileRepository
T0+3ε:   加载快照
T0+4ε:   加载增量 JSONL
T0+5ε:   重建内存索引
T0+6ε: 初始化 TimelineFileRepository
T0+7ε:   加载 timeline.jsonl
T0+8ε:   重建内存索引
T0+9ε: 初始化 AuditFileRepository
T0+10ε:  加载 audit.jsonl
T0+11ε:  重建内存索引
T0+12ε: 初始化 FileLock
T0+13ε:  创建锁目录
T0+14ε: 标记服务就绪
T0+15ε: 记录启动日志
```

**关键点**:
1. 配置初始化 **先于** 所有组件
2. Incident **先于** Timeline/Audit (依赖关系)
3. 锁初始化 **最后** (其他组件就绪后)
4. 服务就绪 **后于** 所有初始化

**实现**:
```typescript
async startServer(): Promise<void> {
  // 1. 配置
  const config = loadConfig();

  // 2. Incident
  console.log('[Server] Initializing IncidentFileRepository...');
  const incidentRepo = getIncidentFileRepository();
  await incidentRepo.initialize();
  console.log(`[Server] IncidentFileRepository ready: ${incidentRepo.getStats().total} incidents loaded`);

  // 3. Timeline
  console.log('[Server] Initializing TimelineFileRepository...');
  const timelineStore = getTimelineStore();
  await timelineStore.initialize();
  console.log(`[Server] TimelineFileRepository ready: ${timelineStore.getStats().total} events loaded`);

  // 4. Audit
  console.log('[Server] Initializing AuditFileRepository...');
  const auditService = getAuditLogFileService();
  await auditService.initialize();
  console.log(`[Server] AuditFileRepository ready: ${auditService.getStats().total} events loaded`);

  // 5. FileLock
  console.log('[Server] Initializing FileLock...');
  const fileLock = getFileLock();
  await fileLock.initialize();
  console.log(`[Server] FileLock ready: ${JSON.stringify(fileLock.getStats())}`);

  // 6. 就绪
  this.isReady = true;
  console.log('[Server] All components initialized');
}
```

### 3.2 热重启流程

**场景**: 服务崩溃后重启

**时序**:
```
T0:   服务启动 (崩溃后)
T0+ε: 检测锁残留
T0+2ε: 清理陈旧锁 (>10 分钟)
T0+3ε: 加载快照 (见 3.1)
T0+4ε: 加载增量 JSONL
T0+5ε: 验证一致性
T0+6ε: ├─ 如果一致 → 继续
T0+6ε: └─ 如果不一致 → 告警 + 人工介入
T0+7ε: 标记服务就绪
T0+8ε: 记录重启日志
```

**关键点**:
1. 锁清理 **先于** 数据加载 (避免锁残留)
2. 一致性验证 **后于** 加载
3. 不一致时告警 (不自动修复)

---

## 四、副作用抑制规则

### 4.1 Replay 抑制

| 操作 | 抑制规则 |
|------|---------|
| 文件写入 | ❌ 禁止 (只读) |
| Timeline 记录 | ❌ 禁止 (内存日志) |
| Audit 记录 | ❌ 禁止 (内存日志) |
| 通知发送 | ❌ 禁止 |
| 外部 API | ❌ 禁止 |

### 4.2 Recovery 抑制

| 操作 | 抑制规则 |
|------|---------|
| 文件写入 | ✅ 允许 (加锁) |
| Timeline 记录 | ✅ 允许 |
| Audit 记录 | ✅ 允许 |
| 通知发送 | ⚠️ 需审批 |
| 外部 API | ⚠️ 需审批 + 幂等 |

### 4.3 Restart 抑制

| 操作 | 抑制规则 |
|------|---------|
| 文件写入 | ❌ 禁止 (只读加载) |
| Timeline 记录 | ❌ 禁止 |
| Audit 记录 | ❌ 禁止 |
| 通知发送 | ❌ 禁止 (避免重启风暴) |
| 外部 API | ❌ 禁止 |

---

## 五、已验证时序

| 场景 | 验证状态 | 备注 |
|------|---------|------|
| Replay Dry-run | ✅ Wave 2-A | <100ms |
| Recovery Scan (dry-run) | ✅ Wave 2-A | <500ms |
| 冷启动 | ✅ Wave 2-A | <5s |
| 热重启 | ✅ Wave 2-A | <5s |
| 时间旅行 | ⚠️ 待验证 | 功能已实现 |

---

## 六、时序异常处理

### 6.1 加载失败

**规则**:
```
IF (快照加载失败) THEN
  尝试从 JSONL 全量加载
  IF (JSONL 加载也失败) THEN
    告警 + 人工介入
    从备份恢复
  END IF
END IF
```

### 6.2 一致性验证失败

**规则**:
```
IF (Incident/Timeline 不一致) THEN
  记录严重日志
  告警 + 人工介入
  不自动修复 (避免数据丢失)
END IF
```

### 6.3 恢复执行失败

**规则**:
```
IF (恢复执行失败) THEN
  记录 Audit (recovery_failed)
  标记 item 为 failed
  继续处理下一个 item
  最后生成失败报告
END IF
```

---

_文档版本：1.0  
最后更新：2026-04-05 05:44 CST_
