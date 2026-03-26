# P1-2 告警去重与冷却功能 - 交付报告

**完成时间**: 2026-03-26  
**版本**: V4.0 P1-2  
**状态**: ✅ 测试通过

---

## 一、实现目标

把告警从"会响"变成"**有用**"，解决 3 个问题：

1. ✅ 同一问题反复刷屏
2. ✅ 恢复后没有明确收口
3. ✅ 相同问题频繁出现时，看不出是一次还是十次

---

## 二、核心代码

### 1. `alert_key()` - 统一键生成

```python
def alert_key(issue: Dict) -> str:
    """
    生成告警唯一键
    
    键组成：type|source|title
    不把 message 放入 key，避免 message 轻微变化导致去重失败
    """
    return f"{issue.get('type', '')}|{issue.get('source', '')}|{issue.get('title', '')}"
```

**位置**: `panel_v40.py` 第 757 行

---

### 2. `should_emit_alert()` - 冷却逻辑

```python
def should_emit_alert(issue: Dict, now_ts: float) -> Tuple[bool, int]:
    """
    判断是否允许发射告警
    
    返回：(should_emit, merged_count)
    - should_emit: 是否应该发射
    - merged_count: 累计次数
    """
    key = alert_key(issue)
    state = alert_cooldowns.get(key)
    
    if not state:
        # 首次出现，立即发射
        alert_cooldowns[key] = {
            "last_emit_ts": now_ts,
            "count": 1,
            "last_message": issue.get("message", ""),
        }
        return True, 1
    
    elapsed = now_ts - state["last_emit_ts"]
    state["count"] += 1
    state["last_message"] = issue.get("message", "")
    
    if elapsed >= ALERT_COOLDOWN_SEC:
        # 冷却时间已过，可以发射
        state["last_emit_ts"] = now_ts
        return True, state["count"]
    
    # 仍在冷却期内，不发射
    return False, state["count"]
```

**位置**: `panel_v40.py` 第 772 行  
**冷却时间**: 60 秒（`ALERT_COOLDOWN_SEC = 60`）

---

### 3. `update_active_alerts()` - 活跃告警管理

```python
def update_active_alerts(current_issues: List[Dict], now_ts: float) -> List[Dict]:
    """
    更新活跃告警并生成待发射列表
    
    功能：
    1. 追踪活跃告警状态
    2. 应用冷却/去重逻辑
    3. 检测恢复事件
    """
    emitted = []
    current_keys = set()
    
    # 处理当前存在的问题
    for issue in current_issues:
        key = alert_key(issue)
        current_keys.add(key)
        
        # 更新活跃告警状态
        state = active_alerts.get(key)
        if not state:
            active_alerts[key] = {
                **issue,
                "first_seen_ts": now_ts,
                "last_seen_ts": now_ts,
                "count": 1,
            }
        else:
            state["last_seen_ts"] = now_ts
            state["count"] += 1
        
        # 判断是否应该发射
        should_emit, merged_count = should_emit_alert(issue, now_ts)
        if should_emit:
            alert = dict(issue)
            alert["dedup_count"] = merged_count
            if merged_count > 1:
                alert["message"] = f"{issue.get('message', '')} (近阶段累计 {merged_count} 次)"
            emitted.append(alert)
    
    # 检测恢复：之前活跃、现在消失
    previous_keys = list(active_alerts.keys())
    for key in previous_keys:
        if key not in current_keys:
            old = active_alerts.pop(key)
            emitted.append({
                "ts": datetime.fromtimestamp(now_ts).isoformat(),
                "level": "INFO",
                "type": f"{old.get('type', 'unknown')}_recovered",
                "source": old.get("source"),
                "title": f"{old.get('title', '告警')}已恢复",
                "message": "状态已恢复正常",
                "context": {
                    "previous_level": old.get("level"),
                    "active_count": old.get("count", 1),
                },
                "dedup_count": 1,
            })
            alert_cooldowns.pop(key, None)
    
    return emitted
```

**位置**: `panel_v40.py` 第 807 行

---

### 4. `build_alerts()` - 重构为两步流程

```python
def build_alerts(raw: Dict) -> tuple:
    """
    构建告警列表（P1-2 重构）
    
    新流程：
    1. collect_candidate_issues: 收集候选问题
    2. update_active_alerts: 应用去重/冷却，生成发射列表
    
    返回：(alerts, summary)
    """
    import time
    now_ts = time.time()
    
    # Step 1: 生成候选问题
    issues = collect_candidate_issues(raw)
    
    # Step 2: 经过去重/冷却后变成 alerts
    alerts = update_active_alerts(issues, now_ts)
    
    # 排序
    alerts.sort(key=alert_sort_key)
    
    # 生成摘要
    summary = build_alert_summary(alerts)
    
    return alerts, summary
```

**位置**: `panel_v40.py` 第 1454 行

---

## 三、验收测试结果

### 测试文件
- `test_alert_dedup_p1_2.py` - 单元测试
- `test_alert_scenarios_demo.py` - 场景演示

### 测试结果

```
============================================================
P1-2 告警去重与冷却功能测试
============================================================

=== 测试 1: alert_key 函数 ===
✅ alert_key 测试通过

=== 测试 2: should_emit_alert 冷却逻辑 ===
✅ should_emit_alert 测试通过

=== 测试 3: update_active_alerts 完整流程 ===
✅ update_active_alerts 测试通过

=== 测试 4: collect_candidate_issues 问题收集 ===
✅ collect_candidate_issues 测试通过

=== 测试 5: build_alerts 完整流程 ===
✅ build_alerts 完整流程测试通过

============================================================
✅ 所有测试通过！
============================================================
```

---

## 四、场景验证

### 场景 1: 同一个问题连续出现 5 次

**操作**: 连续 5 次检测到相同问题，每次间隔 10 秒

**结果**:
- 第 1 次：✅ 发射告警，dedup_count=1
- 第 2-5 次：⏸️ 冷却中，未发射告警

**结论**: 60 秒内只发一条，累计次数增加 ✅

---

### 场景 2: 60 秒后问题仍存在

**操作**: 60 秒后再次检测，问题仍然存在

**结果**:
- 第 6 次：✅ 冷却时间已过，再次发射告警，dedup_count=6

**结论**: 60 秒冷却时间过后，再次发射告警，message 带累计次数 ✅

---

### 场景 3: 问题消失

**操作**: 问题已解决，数据源恢复正常

**结果**:
- 🟢 恢复事件：[INFO] OKX 余额获取失败已恢复
- 消息：状态已恢复正常
- 之前级别：CRITICAL
- 活跃次数：6

**结论**: 发送 INFO 级别恢复事件，清理活跃告警和冷却状态 ✅

---

### 场景 4: 问题消失后又复发

**操作**: 问题再次出现，当成新一轮活跃告警

**结果**:
- ✅ 新一轮告警发射，dedup_count=1 (重新从 1 开始)

**结论**: 复发后当成新一轮，重新计数 ✅

---

## 五、新增状态容器

### 1. 冷却状态

```python
alert_cooldowns: Dict[str, Dict] = {}
```

**键**: `type|source|title`  
**值**:
```python
{
    "last_emit_ts": 1711440000.0,
    "count": 3,
    "last_message": "OKX 余额获取失败"
}
```

---

### 2. 活跃告警状态

```python
active_alerts: Dict[str, Dict] = {}
```

**键**: `type|source|title`  
**值**:
```python
{
    "level": "CRITICAL",
    "type": "source_failure",
    "source": "okx_capital",
    "title": "OKX 余额获取失败",
    "message": "连续 3 次拉取失败",
    "first_seen_ts": 1711440000.0,
    "last_seen_ts": 1711440060.0,
    "count": 4
}
```

---

## 六、告警数据结构增强

### 新增字段

```json
{
    "ts": "2026-03-26T15:30:00",
    "level": "CRITICAL",
    "type": "source_failure",
    "source": "okx_capital",
    "title": "OKX 余额获取失败",
    "message": "连续失败 (近阶段累计 3 次)",
    "context": {"fail_count": 3},
    "dedup_count": 3  // ← P1-2 新增
}
```

### 恢复事件格式

```json
{
    "ts": "2026-03-26T15:32:00",
    "level": "INFO",
    "type": "source_failure_recovered",
    "source": "okx_capital",
    "title": "OKX 余额获取失败已恢复",
    "message": "状态已恢复正常",
    "context": {
        "previous_level": "CRITICAL",
        "active_count": 6
    },
    "dedup_count": 1
}
```

---

## 七、告警摘要增强

### 新增 `alert_summary`

```python
{
    "critical": 2,
    "warn": 3,
    "info": 1,
    "total": 6
}
```

**用途**: 前端可以快速显示各等级告警数量，无需遍历

---

## 八、排序规则

```python
LEVEL_PRIORITY = {
    "CRITICAL": 0,
    "WARN": 1,
    "INFO": 2,
}

def alert_sort_key(alert: Dict) -> tuple:
    return (
        LEVEL_PRIORITY.get(alert.get("level", "INFO"), 9),
        -(parse_ts(alert.get("ts")) or 0),
    )
```

**规则**:
1. 级别优先：CRITICAL > WARN > INFO
2. 时间倒序：新的在前

---

## 九、适用告警类型

### 会做去重/冷却的告警

- ✅ worker_timeout
- ✅ snapshot_stale / snapshot_delayed
- ✅ source_failure / source_degraded
- ✅ circuit_breaker
- ✅ max_daily_loss
- ✅ max_daily_trades
- ✅ gate_blocked

### 不会做告警的（保持静默）

- ❌ hold
- ❌ no signal
- ❌ 普通 reject_score/hold
- ❌ 正常模式下的常规限制说明

---

## 十、文件清单

| 文件 | 功能 | 行数 |
|------|------|------|
| `panel_v40.py` | 主实现文件（已修改） | +200 |
| `test_alert_dedup_p1_2.py` | 单元测试 | 220 |
| `test_alert_scenarios_demo.py` | 场景演示 | 180 |
| `P1_2_DELIVERY.md` | 交付文档（本文件） | - |

---

## 十一、下一步建议

### 已完成
- ✅ 同类型告警 60 秒冷却
- ✅ 相同告警合并计数
- ✅ 恢复事件单独打一条 INFO
- ✅ dedup_count 字段
- ✅ 告警摘要

### 可选增强（未来）
- [ ] 可配置冷却时间（不同类型不同冷却）
- [ ] 告警聚合面板（前端显示累计次数）
- [ ] 告警历史持久化（写入日志文件）
- [ ] 告警升级规则（长时间未恢复 → 提升级别）

---

## 十二、验收结论

**P1-2 告警去重与冷却功能已完成并测试通过。**

核心指标：
- ✅ 同一问题 60 秒内只发 1 条
- ✅ 累计次数正确追踪
- ✅ 恢复事件正确触发
- ✅ 复发后重新计数
- ✅ 告警排序正确
- ✅ 摘要统计准确

**状态**: 🟢 **GO** - 可投入生产使用

---

_小龙交付，2026-03-26_
