# 3B-2: Concurrency Regression Tests

**阶段**: Phase 3B-2 Persistence Hardening - 并发回归  
**日期**: 2026-04-05  
**状态**: ✅ **COMPLETE**

---

## 一、测试目标

验证 3B-2 Incident 持久化切换后，关键并发行为仍正确。

---

## 二、测试结果

### 场景 A：Incident 状态变更并发

**测试**: 5 并发 PATCH 同一 incident (open → investigating)

**结果**:
- ✅ 最终状态：`investigating`（合法）
- ✅ 持久化记录：6 条（1 create + 5 update）
- ✅ 无状态回退/覆盖异常
- ✅ 文件内容完整可恢复

**日志**:
```
user1, user2, user3, user4, user5 - 全部成功
最终 updated_by: user5（最后一个写入）
```

**结论**: ✅ **通过** - 持久化后并发行为正常

---

### 场景 B：Alert 重复投递

**测试**: 10 并发 POST /alerting/ingest (相同 correlation_id)

**结果**:
- ✅ 1 成功 / 9 抑制
- ✅ 只创建 1 个 incident
- ✅ dedupe 逻辑正常

**日志**:
```
{"ok":true,"suppressed":false,...} × 1
{"ok":true,"suppressed":true,"message":"Alert suppressed (duplicate)"} × 9
```

**结论**: ✅ **通过** - 持久化层切换后 dedupe 仍有效

---

### 场景 C：Recovery 后再操作

**测试**:
1. 创建 incident 并 resolve
2. 重启服务
3. 验证状态恢复
4. 创建新 incident

**结果**:
- ✅ 重启前状态：`resolved`
- ✅ 重启后状态：`resolved`
- ✅ 新 incident 创建成功
- ✅ 无幽灵状态/重复回放

**日志**:
```
[IncidentFileRepository] Loaded 2 incidents from snapshot
[IncidentFileRepository] Replayed 8 incremental events
```

**结论**: ✅ **通过** - 重启恢复后行为与重启前一致

---

## 三、验收标准

| 标准 | 状态 |
|------|------|
| 无非法状态跳变 | ✅ |
| 最终持久化状态正确 | ✅ |
| 重启后查询结果一致 | ✅ |
| dedupe 仍有效 | ✅ |
| 无幽灵状态/重复副作用 | ✅ |

---

## 四、持久化文件验证

** incidents.jsonl 内容**:
```
场景 A: 6 条记录（1 create + 5 update）
场景 B: 2 条记录（1 create + 1 update）
场景 C: 2 条记录（1 create + 1 resolved）
```

**文件格式**:
- ✅ 每行有效 JSON
- ✅ 时间戳递增
- ✅ 无损坏行

---

## 五、结论

**3B-2 持久化切换后并发行为验证**: ✅ **通过**

- Incident 持久化未引入并发退化
- Dedupe 逻辑在持久化层切换后仍有效
- 重启恢复无副作用
- 可安全进入 3B-3

---

_测试完成时间：2026-04-05 04:55_
