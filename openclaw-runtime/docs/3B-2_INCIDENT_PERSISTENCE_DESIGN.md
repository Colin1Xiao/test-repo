# 3B-2: Incident Persistence Design

**阶段**: Phase 3B-2: Incident Persistence Hardening  
**日期**: 2026-04-05  
**状态**: In Progress

---

## 一、目标

将 Incident Repository 从 memory-backed 改为 file-backed，满足：

- ✅ 创建后落盘
- ✅ 状态变更后落盘（acknowledge/resolve）
- ✅ 启动时自动恢复
- ✅ 与 timeline/audit 一致
- ✅ 损坏数据防御

---

## 二、存储结构

### 目录结构

```
~/.openclaw/workspace/openclaw-runtime/data/incidents/
├── incidents.jsonl          # 主存储（追加日志）
├── incidents_snapshot.json  # 快照（加速恢复）
├── incidents_lock/          # 文件锁目录
└── incidents_backup/        # 备份目录
```

### 数据格式

**incidents.jsonl** (每行一个 JSON 对象):

```json
{"type":"incident_created","id":"incident-1775335350516-redis_outage","timestamp":1775335350516,"data":{"type":"redis_outage","severity":"P0","status":"open","title":"...","correlation_id":"..."}}
{"type":"incident_updated","id":"incident-1775335350516-redis_outage","timestamp":1775335353844,"data":{"status":"investigating","updated_by":"colin"}}
{"type":"incident_updated","id":"incident-1775335350516-redis_outage","timestamp":1775335353859,"data":{"status":"resolved","updated_by":"colin","resolved_at":1775335353859}}
```

### 快照格式

**incidents_snapshot.json**:

```json
{
  "snapshot_at": 1775335353859,
  "incidents": {
    "incident-1775335350516-redis_outage": {
      "id": "...",
      "type": "redis_outage",
      "severity": "P0",
      "status": "resolved",
      "title": "...",
      "created_at": 1775335350516,
      "created_by": "alert_ingest_service",
      "updated_at": 1775335353859,
      "updated_by": "colin",
      "resolved_at": 1775335353859,
      "resolved_by": "colin",
      "correlation_id": "...",
      "related_alerts": ["RedisDisconnected"]
    }
  }
}
```

---

## 三、API 设计

### IncidentFileRepository

```typescript
interface IncidentFileRepository {
  // 写入
  create(incident: Incident): Promise<void>;
  update(incident_id: string, update: IncidentUpdateRequest): Promise<Incident | undefined>;
  
  // 读取
  getById(incident_id: string): Incident | undefined;
  query(filters: IncidentQuery): Incident[];
  
  // 恢复
  loadFromDisk(): Promise<void>;
  createSnapshot(): Promise<void>;
  
  // 维护
  backup(): Promise<string>;
  repair(): Promise<number>;
}
```

### 并发控制

**文件锁策略**:
- 使用 `proper-lockfile` 或自旋锁
- 写操作加独占锁
- 读操作无锁（读取快照）

**版本控制**:
- 每个 incident 增加 `version` 字段
- 更新时检查版本号（乐观锁）
- 冲突时返回错误，由调用者重试

---

## 四、启动恢复流程

```
服务启动
    ↓
检查 incidents_snapshot.json
    ↓
┌─────────────────────┐
│ 存在且有效？        │
└─────────────────────┘
    │ Yes              │ No
    ↓                  ↓
加载快照          从头回放 jsonl
    ↓                  ↓
回放增量事件 ←────────┘
    ↓
构建内存索引
    ↓
验证一致性（可选）
    ↓
服务就绪
```

---

## 五、损坏数据防御

### 检测策略

1. **JSON 解析失败** → 跳过该行，记录错误
2. **快照校验和失败** → 回退到 jsonl 回放
3. **事件顺序异常** → 记录警告，尝试修复

### 恢复策略

1. **单行损坏** → 跳过，记录到 `incidents_corrupt.log`
2. **快照损坏** → 删除快照，从 jsonl 重建
3. **索引损坏** → 重建索引

### 备份策略

- 每次快照前备份旧快照
- 保留最近 3 个备份
- 定期清理（>7 天）

---

## 六、三写一致性

**目标**: incident 状态变更时，三处同时更新

```
状态变更请求
    ↓
┌─────────────────────────────────┐
│ 1. Repository 更新 (加锁)       │
│ 2. Timeline 写入                │
│ 3. Audit 写入                   │
└─────────────────────────────────┘
    ↓
全部成功 → 返回成功
    ↓
任一失败 → 记录错误，返回失败（不调用者重试）
```

**注意**:
- 不追求分布式事务级别的一致性
- 保证"单服务内"的原子性
- 失败时记录详细错误，便于人工介入

---

## 七、验收标准

| 测试项 | 预期结果 |
|--------|---------|
| incident create 后文件存在 | ✅ incidents.jsonl 新增一行 |
| incident acknowledge 后状态更新 | ✅ jsonl 新增更新事件 |
| incident resolve 后状态更新 | ✅ jsonl 新增更新事件 |
| 服务重启后 incident 恢复 | ✅ 查询结果与重启前一致 |
| timeline 与 incident 一致 | ✅ 状态变更可追踪 |
| audit 与 incident 一致 | ✅ 状态变更可解释 |
| 损坏数据防御 | ✅ 跳过损坏行，服务不崩溃 |

---

## 八、实施顺序

1. [ ] 创建 `incident_file_repository.ts`
2. [ ] 实现 jsonl 追加写入
3. [ ] 实现快照创建/加载
4. [ ] 实现启动恢复
5. [ ] 集成到 HTTP 路由
6. [ ] 添加文件锁
7. [ ] 添加损坏防御
8. [ ] 编写回归测试
9. [ ] 执行重启恢复验证

---

_最后更新：2026-04-05 04:45_
