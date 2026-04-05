# System Invariants

**阶段**: Phase X-3: Constraints & Evolution Guardrails  
**日期**: 2026-04-05  
**状态**: ✅ **COMPLETE**

---

## 一、不变性定义

**系统不变性**: 在任何操作、任何时序、任何故障场景下必须保持为真的性质。

**违反后果**: 数据不一致、证据链断裂、系统不可恢复。

---

## 二、数据不变性

### I-1: Incident/Timeline/Audit 一致性

**不变性**:
```
FOR EACH incident:
  IF (incident.status != 'open') THEN
    EXISTS timeline_event WHERE:
      type == 'incident_created' AND
      incident_id == incident.id AND
      timestamp <= incident.created_at
  END IF
  
  IF (incident.status CHANGED) THEN
    EXISTS timeline_event WHERE:
      type == 'incident_updated' AND
      incident_id == incident.id AND
      metadata.status_change.from == old_status AND
      metadata.status_change.to == new_status
  END IF
END FOR
```

**违反检测**:
```bash
# 检查 incident 无创建事件
for incident in $(curl -s http://localhost:3000/alerting/incidents | jq -r '.incidents[].id'); do
  events=$(curl -s "http://localhost:3000/alerting/timeline?incident_id=$incident" | jq '.events | length')
  if [ "$events" == "0" ]; then
    echo "INVARIANT VIOLATION: $incident has no timeline events"
  fi
done
```

**违反恢复**:
1. 从 Audit 恢复缺失的 Timeline 事件
2. 人工验证恢复结果
3. 记录不变性违反事件

### I-2: Correlation ID 可追踪性

**不变性**:
```
FOR EACH correlation_id:
  IF (correlation_id EXISTS) THEN
    EXISTS alert_triggered AND
    EXISTS (incident_created OR incident_linked) AND
    ALL events HAVE SAME correlation_id
  END IF
END FOR
```

**违反检测**:
```bash
# 检查 correlation_id 断裂
curl -s "http://localhost:3000/alerting/timeline?correlation_id=$id" | jq '
  if (.events | length) == 0 then
    "INVARIANT VIOLATION: correlation_id $id has no events"
  else
    .
  end
'
```

### I-3: 时间戳单调性

**不变性**:
```
FOR EACH incident:
  incident.created_at <= incident.updated_at
  IF (incident.resolved_at EXISTS) THEN
    incident.updated_at <= incident.resolved_at
  END IF
END FOR

FOR EACH timeline_events WITH SAME incident_id:
  events[0].timestamp <= events[1].timestamp <= ... <= events[n].timestamp
END FOR
```

**违反检测**:
```bash
# 检查时间戳逆序
curl -s "http://localhost:3000/alerting/timeline?incident_id=$id" | jq '
  .events | 
  if (. | length) < 2 then
    "OK (insufficient events)"
  else
    . as $events |
    [range(1; . | length)] | 
    map(select($events[.].timestamp < $events[. - 1].timestamp)) |
    if (. | length) > 0 then
      "INVARIANT VIOLATION: timestamp out of order at indices \(.)"
    else
      "OK"
    end
  end
'
```

---

## 三、写入不变性

### I-4: 写入顺序不变性

**不变性**:
```
incident_created MUST precede incident_linked
incident_updated MUST follow status change
audit_log MUST follow file write (not precede)
timeline_event MUST follow business action (not precede)
```

**形式化**:
```typescript
// Invariant check
function checkWriteOrder(incident: Incident, timeline: TimelineEvent[]): boolean {
  const created_event = timeline.find(e => e.type === 'incident_created');
  if (!created_event) return false;
  
  if (created_event.timestamp > incident.created_at) {
    return false; // Timeline 晚于 Incident 创建
  }
  
  return true;
}
```

### I-5: 锁持有边界

**不变性**:
```
FOR EACH file_write:
  LOCK ACQUIRED BEFORE write
  LOCK RELEASED AFTER write
  LOCK HOLD TIME < 30s
END FOR

FOR EACH lock:
  IF (lock_age > 60s) THEN
    LOCK IS STALE (can be cleaned)
  END IF
END FOR
```

**违反检测**:
```bash
# 检查陈旧锁
find ~/.openclaw/workspace/openclaw-runtime/data/locks/ -name "*.lock" -mmin +1
```

### I-6: 幂等键唯一性

**不变性**:
```
FOR EACH idempotency_key:
  IF (key EXISTS in window) THEN
    RETURN cached_response OR suppressed
  ELSE
    PROCESS AND STORE key
  END IF
END FOR
```

**窗口大小**: 5 分钟 (Alert Dedupe) / 24 小时 (Idempotency Key)

---

## 四、恢复不变性

### I-7: 重启恢复完整性

**不变性**:
```
AFTER restart:
  incidents.count == snapshot.incidents + incremental_events.count
  timeline.count == loaded_timeline_events.count
  NO GHOST states (states not in JSONL)
  NO MISSING states (JSONL events not in memory)
END AFTER
```

**验证脚本**:
```bash
# 重启前记录
BEFORE_RESTART_INCIDENTS=$(curl -s http://localhost:3000/alerting/incidents | jq '.count')
BEFORE_RESTART_TIMELINE=$(curl -s "http://localhost:3000/alerting/timeline?limit=1000" | jq '.count')

# 重启
pkill -f "node dist/server.js"
sleep 2
cd ~/.openclaw/workspace/openclaw-runtime && HOST=0.0.0.0 /usr/local/bin/node dist/server.js > /tmp/server.log 2>&1 &
sleep 3

# 重启后验证
AFTER_RESTART_INCIDENTS=$(curl -s http://localhost:3000/alerting/incidents | jq '.count')
AFTER_RESTART_TIMELINE=$(curl -s "http://localhost:3000/alerting/timeline?limit=1000" | jq '.count')

if [ "$BEFORE_RESTART_INCIDENTS" != "$AFTER_RESTART_INCIDENTS" ]; then
  echo "INVARIANT VIOLATION: incident count mismatch"
fi
```

### I-8: Replay 无副作用

**不变性**:
```
IF (dry_run == true) THEN
  NO file writes
  NO timeline records
  NO audit records
  NO external notifications
  NO external API calls
END IF
```

**验证**: 检查文件时间戳在 Replay 前后不变

### I-9: Recovery 幂等

**不变性**:
```
FOR EACH recovery_item:
  IF (item.processed) THEN
    SKIP (do not replay)
  ELSE
    PROCESS AND MARK as processed
  END IF
END FOR
```

---

## 五、状态不变性

### I-10: 状态迁移合法性

**不变性**:
```
FOR EACH state_transition:
  transition MUST BE IN allowed_transitions
  IF (transition TO terminal_state) THEN
    NO FURTHER transitions ALLOWED (except re-open)
  END IF
END FOR
```

**允许迁移表**:
| 从 | 到 | 允许 |
|----|----|------|
| `open` | `investigating` | ✅ |
| `open` | `resolved` | ✅ (罕见) |
| `investigating` | `resolved` | ✅ |
| `investigating` | `open` | ✅ (re-open) |
| `resolved` | `closed` | ✅ |
| `resolved` | `open` | ✅ (recurrence) |
| `closed` | `*` | ❌ (terminal) |

### I-11: 终端状态保护

**不变性**:
```
IF (object.status IN terminal_states) THEN
  NO state_change ALLOWED (except explicit re-open)
  re-open REQUIRES approval
END IF
```

**终端状态**: `closed` (Incident), `resolved` (Approval)

### I-12: 并发状态更新 Last-Write-Wins

**不变性**:
```
FOR EACH concurrent_updates TO SAME object:
  LAST write WINS (by timestamp)
  ALL writes RECORDED in audit
  NO write LOST (audit complete)
END FOR
```

**缓解**: 中期引入乐观锁

---

## 六、不变性验证矩阵

| 不变性 | 自动验证 | 手动验证 | 频率 |
|--------|---------|---------|------|
| I-1: Incident/Timeline 一致 | ✅ | ⚠️ 抽样 | 每小时 |
| I-2: Correlation ID 可追踪 | ✅ | ⚠️ 抽样 | 每小时 |
| I-3: 时间戳单调性 | ✅ | ❌ | 每次写入 |
| I-4: 写入顺序 | ⚠️ 日志 | ✅ 抽样 | 每天 |
| I-5: 锁持有边界 | ✅ | ❌ | 实时 |
| I-6: 幂等键唯一性 | ✅ | ❌ | 每次请求 |
| I-7: 重启恢复完整性 | ❌ | ✅ | 每次重启 |
| I-8: Replay 无副作用 | ✅ | ❌ | 每次 Replay |
| I-9: Recovery 幂等 | ✅ | ❌ | 每次 Recovery |
| I-10: 状态迁移合法 | ✅ | ❌ | 每次迁移 |
| I-11: 终端状态保护 | ✅ | ❌ | 每次迁移 |
| I-12: 并发 Last-Write-Wins | ⚠️ Audit | ✅ 抽样 | 每天 |

---

## 七、不变性违反处理

### 7.1 分级

| 级别 | 不变性 | 响应时间 |
|------|--------|---------|
| P0 | I-1, I-2, I-7 | 立即 |
| P1 | I-3, I-4, I-10, I-11 | 1 小时 |
| P2 | I-5, I-6, I-8, I-9, I-12 | 4 小时 |

### 7.2 处理流程

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
    ↓
根因分析
    ↓
修复 + 预防
```

---

_文档版本：1.0  
最后更新：2026-04-05 05:47 CST_
