# Write Ordering Rules

**阶段**: Phase X-3: Constraints & Evolution Guardrails  
**日期**: 2026-04-05  
**状态**: ✅ **COMPLETE**

---

## 一、写入顺序总则

### 规则 W-0: 先验证后写入

```
VALIDATE BEFORE WRITE

所有写入操作必须:
1. 验证输入格式
2. 验证权限/状态
3. 验证不变性

验证失败 → 返回错误，不写入
验证通过 → 继续写入流程
```

---

## 二、Incident 写入顺序

### 规则 W-1: Incident 创建顺序

```
INCIDENT CREATION ORDER

1. Dedupe 检查 (内存)
2. 创建内存对象
3. 获取文件锁 (incidents)
4. 追加 JSONL (incident_created)
5. 更新内存索引
6. 释放文件锁
7. 记录 Timeline (incident_created)
8. 记录 Audit (incident_created)

禁止:
- 跳过 Dedupe 检查
- 无锁写入
- Timeline 先于文件写入
```

**违反后果**: 重复 Incident、数据不一致

### 规则 W-2: Incident 更新顺序

```
INCIDENT UPDATE ORDER

1. 验证状态迁移合法 (内存)
2. 获取文件锁 (incidents)
3. 更新内存对象
4. 追加 JSONL (incident_updated)
5. 更新内存索引
6. 释放文件锁
7. 记录 Timeline (incident_updated)
8. 记录 Audit (state_transition)

禁止:
- 跳过状态验证
- 无锁写入
- Audit 先于文件写入
```

**违反后果**: 非法状态迁移、Audit 不完整

### 规则 W-3: Incident 快照写入顺序

```
INCIDENT SNAPSHOT ORDER

1. 获取文件锁 (incidents)
2. 读取内存索引
3. 写入临时文件 (incidents_snapshot.json.tmp)
4. 验证临时文件 (JSON 有效性)
5. Rename 临时文件 → 正式文件
6. 备份旧快照
7. 清理旧备份 (>3 个)
8. 释放文件锁
9. 更新 lastSnapshotAt

禁止:
- 直接写入正式文件 (无原子性)
- 不验证临时文件
- 不备份旧快照
```

**违反后果**: 快照损坏、数据丢失

---

## 三、Timeline 写入顺序

### 规则 W-4: Timeline 事件写入顺序

```
TIMELINE EVENT ORDER

1. 创建 Timeline 事件对象
2. 验证事件格式
3. 获取文件锁 (timeline)
4. 追加 JSONL (timeline.jsonl)
5. 更新内存索引
6. 释放文件锁

禁止:
- 无锁写入
- 时间戳逆序
- 缺少必填字段
```

**必填字段**: `id`, `type`, `timestamp`

### 规则 W-5: Timeline 与 Incident 顺序

```
TIMELINE vs INCIDENT ORDER

incident_created MUST precede incident_linked
incident_updated MUST follow status change

验证:
- 检查 incident 存在
- 检查时间戳顺序
```

**违反检测**:
```typescript
function validateTimelineOrder(event: TimelineEvent, incident: Incident): boolean {
  if (event.type === 'incident_linked') {
    if (!incident) return false;
    if (event.timestamp < incident.created_at) return false;
  }
  return true;
}
```

---

## 四、Audit 写入顺序

### 规则 W-6: Audit 事件写入顺序

```
AUDIT EVENT ORDER

1. 创建 Audit 事件对象
2. 验证事件格式
3. 获取文件锁 (audit)
4. 追加 JSONL (audit.jsonl)
5. 更新内存索引
6. 释放文件锁

禁止:
- 无锁写入
- Audit 先于业务动作
```

### 规则 W-7: Audit 与业务动作顺序

```
AUDIT vs BUSINESS ACTION ORDER

Audit 必须后于业务动作:
- incident_created → Audit(incident_created)
- incident_updated → Audit(state_transition)
- webhook_received → Audit(webhook_received)

禁止:
- Audit 先于业务动作 (可能丢失)
- 业务动作成功但 Audit 失败 ( silently fail)
```

**违反处理**:
```typescript
try {
  await businessAction();
  await audit.log({ ... });
} catch (audit_error) {
  // Audit 失败必须记录警告
  console.warn('Audit write failed:', audit_error);
  // 但不回滚业务动作
}
```

---

## 五、锁操作顺序

### 规则 W-8: 锁获取顺序

```
LOCK ACQUIRE ORDER

1. 检查锁是否存在
2. 如果存在，检查是否陈旧 (>60s)
3. 如果陈旧，清理锁
4. 如果未陈旧，等待/失败
5. 创建新锁文件
6. 记录锁获取到 Audit

禁止:
- 不检查陈旧锁
- 无限期等待
```

### 规则 W-9: 锁释放顺序

```
LOCK RELEASE ORDER

1. 验证锁存在
2. 验证锁所有者 (可选)
3. 删除锁文件
4. 记录锁释放到 Audit

禁止:
- 不验证直接删除
- 释放非己方锁
```

### 规则 W-10: 锁持有期间操作顺序

```
DURING LOCK HOLD

1. 获取锁
2. 执行写入操作
3. 验证写入成功
4. 释放锁
5. 记录 Timeline/Audit

禁止:
- 锁持有期间记录 Timeline (可能阻塞)
- 锁持有期间调用外部 API (超时风险)
- 锁持有时间 > 30s
```

---

## 六、重启恢复写入顺序

### 规则 W-11: 重启恢复顺序

```
RESTART RECOVERY ORDER

1. 清理陈旧锁 (先于数据加载)
2. 加载快照 (只读)
3. 加载增量 JSONL (只读)
4. 重建内存索引
5. 验证一致性
6. 标记服务就绪
7. 不触发任何写入

禁止:
- 恢复期间写入
- 跳过一致性验证
- 自动触发通知 (避免风暴)
```

### 规则 W-12: 恢复后首次写入顺序

```
FIRST WRITE AFTER RECOVERY

1. 服务就绪
2. 等待外部请求/定时任务
3. 正常写入流程

禁止:
- 自动触发批量写入
- 恢复积压事件
```

---

## 七、并发写入顺序

### 规则 W-13: 并发写入冲突处理

```
CONCURRENT WRITE HANDLING

FOR EACH concurrent_writes TO SAME object:
  1. 文件锁保护 (单实例)
  2. Last-write-wins (内存索引)
  3. ALL writes 追加到 JSONL
  4. ALL writes 记录到 Audit

禁止:
- 无锁并发写入
- 覆盖式写入 (非追加)
```

### 规则 W-14: 跨对象并发写入

```
CROSS-OBJECT CONCURRENT WRITE

FOR EACH concurrent_writes TO DIFFERENT objects:
  1. 独立锁 (每对象)
  2. 独立写入
  3. 独立记录 Audit

允许:
- 并发执行
- 无序完成
```

---

## 八、写入顺序验证矩阵

| 规则 | 自动验证 | 手动验证 | 频率 |
|------|---------|---------|------|
| W-0: 先验证后写入 | ✅ | ❌ | 每次写入 |
| W-1: Incident 创建 | ✅ | ❌ | 每次创建 |
| W-2: Incident 更新 | ✅ | ❌ | 每次更新 |
| W-3: 快照写入 | ✅ | ❌ | 每次快照 |
| W-4: Timeline 事件 | ✅ | ❌ | 每次写入 |
| W-5: Timeline vs Incident | ⚠️ 日志 | ✅ 抽样 | 每天 |
| W-6: Audit 事件 | ✅ | ❌ | 每次写入 |
| W-7: Audit vs 业务 | ⚠️ 日志 | ✅ 抽样 | 每天 |
| W-8: 锁获取 | ✅ | ❌ | 每次获取 |
| W-9: 锁释放 | ✅ | ❌ | 每次释放 |
| W-10: 锁持有期间 | ⚠️ 日志 | ✅ 抽样 | 每天 |
| W-11: 重启恢复 | ❌ | ✅ | 每次重启 |
| W-12: 恢复后首次写入 | ❌ | ✅ | 每次重启 |
| W-13: 并发写入 | ⚠️ Audit | ✅ 抽样 | 每天 |
| W-14: 跨对象并发 | ✅ | ❌ | 每次写入 |

---

## 九、违反处理

### 9.1 分级

| 级别 | 规则 | 响应时间 |
|------|------|---------|
| P0 | W-1, W-2, W-5, W-7, W-11 | 立即 |
| P1 | W-3, W-4, W-6, W-13 | 1 小时 |
| P2 | W-8, W-9, W-10, W-12, W-14 | 4 小时 |

### 9.2 处理流程

```
检测到违反
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
```

---

_文档版本：1.0  
最后更新：2026-04-05 05:48 CST_
