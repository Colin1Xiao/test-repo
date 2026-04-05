# Audit & Timeline Consistency Rules

**阶段**: Phase X-3: Constraints & Evolution Guardrails  
**日期**: 2026-04-05  
**状态**: ✅ **COMPLETE**

---

## 一、一致性总则

### 规则 C-0: 三致性原则

```
INCIDENT / TIMELINE / AUDIT CONSISTENCY

FOR EACH business_action:
  IF (action affects Incident) THEN
    Incident 状态变更
    Timeline 记录事件
    Audit 记录动作
  END IF
  
  ALL THREE MUST BE:
  - 时间戳一致 (顺序合理)
  - 对象 ID 一致 (incident_id)
  - 关联 ID 一致 (correlation_id)
END FOR
```

**违反后果**: 证据链断裂、无法追溯

---

## 二、Incident-Timeline 一致性

### 规则 C-1: Incident 创建一致性

```
INCIDENT CREATION CONSISTENCY

FOR EACH incident_created:
  EXISTS timeline_event WHERE:
    type == 'incident_created' AND
    incident_id == incident.id AND
    timestamp <= incident.created_at + 1000ms  // 1 秒容差
  END EXISTS
END FOR
```

**验证脚本**:
```bash
verify_incident_timeline_consistency() {
  incidents=$(curl -s http://localhost:3000/alerting/incidents | jq -r '.incidents[]')
  
  for incident in $incidents; do
    id=$(echo $incident | jq -r '.id')
    created_at=$(echo $incident | jq -r '.created_at')
    
    events=$(curl -s "http://localhost:3000/alerting/timeline?incident_id=$id" | jq '.events[] | select(.type == "incident_created")')
    
    if [ -z "$events" ]; then
      echo "CONSISTENCY VIOLATION: $id has no incident_created event"
    fi
  done
}
```

### 规则 C-2: Incident 状态变更一致性

```
INCIDENT STATUS CHANGE CONSISTENCY

FOR EACH incident.status_change:
  EXISTS timeline_event WHERE:
    type == 'incident_updated' AND
    incident_id == incident.id AND
    metadata.status_change.from == old_status AND
    metadata.status_change.to == new_status AND
    timestamp <= incident.updated_at + 1000ms
  END EXISTS
END FOR
```

### 规则 C-3: Timeline 事件顺序一致性

```
TIMELINE EVENT ORDER CONSISTENCY

FOR EACH incident:
  events = GET timeline_events(incident.id) ORDER BY timestamp
  
  events[0].type MUST BE 'incident_created' OR 'alert_triggered'
  
  FOR i = 1 TO events.length:
    events[i].timestamp >= events[i-1].timestamp
  END FOR
END FOR
```

**违反检测**:
```bash
check_timeline_order() {
  incidents=$(curl -s http://localhost:3000/alerting/incidents | jq -r '.incidents[].id')
  
  for id in $incidents; do
    curl -s "http://localhost:3000/alerting/timeline?incident_id=$id" | jq '
      .events | 
      if (. | length) < 2 then
        "OK"
      else
        . as $events |
        [range(1; . | length)] | 
        map(select($events[.].timestamp < $events[. - 1].timestamp)) |
        if (. | length) > 0 then
          "VIOLATION: order issue at indices \(.)"
        else
          "OK"
        end
      end
    '
  done
}
```

---

## 三、Incident-Audit 一致性

### 规则 C-4: Incident 创建 Audit 一致性

```
INCIDENT CREATION AUDIT CONSISTENCY

FOR EACH incident_created:
  EXISTS audit_event WHERE:
    type == 'incident_created' AND
    object_type == 'incident' AND
    object_id == incident.id AND
    timestamp >= incident.created_at AND
    timestamp <= incident.created_at + 5000ms  // 5 秒容差
  END EXISTS
END FOR
```

### 规则 C-5: 状态变更 Audit 一致性

```
STATUS CHANGE AUDIT CONSISTENCY

FOR EACH incident.status_change:
  EXISTS audit_event WHERE:
    type == 'state_transition' AND
    object_type == 'incident' AND
    object_id == incident.id AND
    metadata.from == old_status AND
    metadata.to == new_status AND
    actor == incident.updated_by
  END EXISTS
END FOR
```

---

## 四、Timeline-Audit 一致性

### 规则 C-6: 事件类型映射一致性

```
EVENT TYPE MAPPING CONSISTENCY

FOR EACH timeline_event:
  IF (event.type IN ['incident_created', 'incident_updated']) THEN
    EXISTS audit_event WHERE:
      object_id == timeline_event.incident_id AND
      timestamp >= timeline_event.timestamp AND
      timestamp <= timeline_event.timestamp + 5000ms
    END EXISTS
  END IF
END FOR
```

**映射表**:
| Timeline Event | Audit Event |
|---------------|-------------|
| `incident_created` | `incident_created` |
| `incident_updated` | `state_transition` |
| `alert_triggered` | (可选) |
| `alert_routed` | (可选) |
| `recovery_action` | `recovery_action` |

### 规则 C-7: 时间戳一致性

```
TIMESTAMP CONSISTENCY

FOR EACH correlated_events:
  timeline_event.timestamp <= audit_event.timestamp
  audit_event.timestamp <= timeline_event.timestamp + 5000ms
END FOR
```

**容差说明**:
- Timeline 先于 Audit (业务动作优先)
- 容差 5 秒 (网络/IO 延迟)

---

## 五、Correlation ID 一致性

### 规则 C-8: Correlation ID 串联一致性

```
CORRELATION ID CHAIN CONSISTENCY

FOR EACH correlation_id:
  events = GET all_events(correlation_id)
  
  events MUST INCLUDE:
  - alert_triggered (入口)
  - incident_created OR incident_linked (业务)
  
  events MAY INCLUDE:
  - alert_routed
  - incident_updated
  - recovery_action
  
  ALL events MUST HAVE SAME correlation_id
END FOR
```

**验证脚本**:
```bash
verify_correlation_chain() {
  correlation_id="$1"
  
  events=$(curl -s "http://localhost:3000/alerting/timeline?correlation_id=$correlation_id" | jq '.events')
  
  has_alert=$(echo $events | jq '[.[] | select(.type == "alert_triggered")] | length > 0')
  has_incident=$(echo $events | jq '[.[] | select(.type == "incident_created" or .type == "incident_linked")] | length > 0')
  
  if [ "$has_alert" != "true" ] || [ "$has_incident" != "true" ]; then
    echo "VIOLATION: correlation_id $correlation_id chain incomplete"
  fi
}
```

### 规则 C-9: Correlation ID 唯一性

```
CORRELATION ID UNIQUENESS

FOR EACH correlation_id:
  IF (correlation_id EXISTS) THEN
    ALL events WITH this correlation_id MUST BE:
    - SAME business flow
    - SAME resource (optional)
    - TIME ORDERED
  END IF
END FOR
```

---

## 六、一致性验证频率

### 6.1 实时验证

| 规则 | 验证时机 |
|------|---------|
| C-1: Incident 创建 | 每次创建 |
| C-2: 状态变更 | 每次更新 |
| C-3: Timeline 顺序 | 每次写入 |

### 6.2 定期验证

| 规则 | 频率 | 方式 |
|------|------|------|
| C-4: Incident-Audit | 每小时 | 抽样 |
| C-5: 状态变更 Audit | 每小时 | 抽样 |
| C-6: 事件类型映射 | 每天 | 全量 |
| C-7: 时间戳一致性 | 每天 | 抽样 |
| C-8: Correlation 串联 | 每小时 | 抽样 |
| C-9: Correlation 唯一性 | 每天 | 全量 |

### 6.3 重启后验证

| 规则 | 验证时机 |
|------|---------|
| C-1 ~ C-9 | 每次重启后 |

---

## 七、一致性违反处理

### 7.1 分级

| 级别 | 规则 | 响应时间 |
|------|------|---------|
| P0 | C-1, C-2, C-4, C-5 | 立即 |
| P1 | C-3, C-6, C-8 | 1 小时 |
| P2 | C-7, C-9 | 4 小时 |

### 7.2 恢复策略

**P0 违反**:
```
1. 立即告警
2. 停止相关写入
3. 从备份恢复
4. 人工验证
5. 根因分析
```

**P1 违反**:
```
1. 记录违反详情
2. 1 小时内修复
3. 补充缺失记录
4. 根因分析
```

**P2 违反**:
```
1. 记录违反详情
2. 4 小时内分析
3. 计划修复
4. 预防措施
```

---

## 八、一致性监控仪表板

### 8.1 关键指标

| 指标 | 计算方式 | 告警阈值 |
|------|---------|---------|
| Incident-Timeline 一致率 | (一致数/总数) * 100% | <99% |
| Incident-Audit 一致率 | (一致数/总数) * 100% | <99% |
| Timeline 顺序正确率 | (正确数/总数) * 100% | <99.9% |
| Correlation 完整率 | (完整链/总数) * 100% | <99% |

### 8.2 监控脚本

```bash
#!/bin/bash
# consistency-monitor.sh

# Incident-Timeline 一致率
total=$(curl -s http://localhost:3000/alerting/incidents | jq '.count')
consistent=0

for id in $(curl -s http://localhost:3000/alerting/incidents | jq -r '.incidents[].id'); do
  events=$(curl -s "http://localhost:3000/alerting/timeline?incident_id=$id" | jq '[.[] | select(.type == "incident_created")] | length')
  if [ "$events" -gt 0 ]; then
    ((consistent++))
  fi
done

rate=$(echo "scale=2; $consistent * 100 / $total" | bc)
echo "Incident-Timeline Consistency: $rate%"

if (( $(echo "$rate < 99" | bc -l) )); then
  echo "ALERT: Consistency below threshold"
fi
```

---

_文档版本：1.0  
最后更新：2026-04-05 05:49 CST_
