# 3B-2: Incident Persistence Tests

**阶段**: Phase 3B-2: Incident Persistence Hardening  
**日期**: 2026-04-05  
**状态**: ✅ **COMPLETE**

---

## 一、测试概述

**目标**: 验证 Incident 文件持久化功能

**测试范围**:
- ✅ 文件存储结构
- ✅ 创建/更新持久化
- ✅ 重启恢复
- ✅ Timeline 一致性（内存）

---

## 二、测试结果

### 测试 1: Incident 创建持久化

**步骤**:
1. 启动服务
2. POST /alerting/ingest 创建 incident
3. 检查 incidents.jsonl 文件

**结果**:
```json
{"type":"incident_created","id":"incident-1775335592423-redis_outage","timestamp":1775335592423,"data":{...}}
```

**结论**: ✅ **通过** - incident 创建后立即可见

---

### 测试 2: Incident 状态变更持久化

**步骤**:
1. PATCH /alerting/incidents/:id 更新状态 (open → investigating)
2. PATCH /alerting/incidents/:id 更新状态 (investigating → resolved)
3. 检查 incidents.jsonl 文件

**结果**:
```json
{"type":"incident_updated","id":"incident-1775335592423-redis_outage","timestamp":1775335598350,"data":{"status":"investigating","updated_by":"colin"}}
{"type":"incident_updated","id":"incident-1775335592423-redis_outage","timestamp":1775335603580,"data":{"status":"resolved","updated_by":"colin"}}
```

**结论**: ✅ **通过** - 状态变更追加到 jsonl

---

### 测试 3: 重启恢复

**步骤**:
1. 创建 incident 并更新状态到 resolved
2. 重启服务 (pkill + start)
3. GET /alerting/incidents/:id 查询

**日志**:
```
[IncidentFileRepository] Loaded 1 incidents from snapshot
[IncidentFileRepository] Replayed 2 incremental events
[IncidentFileRepository] Initialized with 1 incidents
```

**恢复后状态**:
```json
{
  "id": "incident-1775335592423-redis_outage",
  "status": "resolved",
  "resolved_at": 1775335603580,
  "resolved_by": "colin"
}
```

**结论**: ✅ **通过** - 快照 + 增量回放恢复成功

---

### 测试 4: 快照创建

**步骤**:
1. 检查 incidents_snapshot.json 文件
2. 验证快照内容

**结果**:
```json
{
  "snapshot_at": 1775335592423,
  "incidents": {
    "incident-1775335592423-redis_outage": {...}
  }
}
```

**结论**: ✅ **通过** - 快照正常创建

---

### 测试 5: Timeline 一致性

**步骤**:
1. 查询 incident timeline
2. 对比 incident 状态与 timeline 事件

**结果**: Timeline 为内存存储，重启后不保留

**结论**: ⚠️ **部分通过** - Timeline 未持久化（预期行为）

**备注**: Timeline 持久化为后续任务，当前 incident repository 已独立持久化

---

## 三、验收标准

| 标准 | 状态 |
|------|------|
| incident create 后文件存在 | ✅ |
| incident acknowledge 后文件状态更新 | ✅ |
| incident resolve 后文件状态更新 | ✅ |
| 服务重启后 incident 恢复成功 | ✅ |
| 恢复后 incident 状态正确 | ✅ |
| 快照加速恢复生效 | ✅ |

---

## 四、已知限制

1. **Timeline 未持久化** - 内存存储，重启后丢失
2. **Audit 未持久化** - 内存存储，重启后丢失
3. **无文件锁** - 单实例场景下安全，多实例需加锁
4. **无乐观锁** - 并发更新时最后一个获胜

---

## 五、下一步建议

### 3B-3 候选任务

1. **Timeline 持久化** - 与 incident 同样的文件存储模式
2. **Audit 持久化** - 独立的 audit log 文件
3. **文件锁** - 使用 proper-lockfile 实现并发控制
4. **乐观锁** - 增加 version 字段，防止并发覆盖

### Wave 2 准备

- ✅ Incident 持久化完成
- ⏳ Timeline/Audit 持久化（可选）
- ⏳ 三实例验证（需要文件锁）

---

## 六、文件结构

```
~/.openclaw/workspace/openclaw-runtime/data/incidents/
├── incidents.jsonl          # 主存储（追加日志）
├── incidents_snapshot.json  # 快照（加速恢复）
├── incidents_backup/        # 备份目录
│   └── incidents_snapshot_*.json
└── incidents_lock/          # 锁目录（预留）
```

---

_测试完成时间：2026-04-05 04:50_
