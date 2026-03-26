# P3-3 报表化查询 - 实施计划

**版本**: v41.7  
**状态**: 📝 **规划中**  
**日期**: 2026-03-26 17:15

---

## 一、报表目标

从"查数据"进入"看结论"：

| 能力 | v41 已有 | P3-3 新增 |
|------|---------|----------|
| 数据查询 | ✅ `/api/history/*` | ✅ `/api/reports/*` |
| 数据展示 | ✅ 列表/简单图表 | ✅ 统计卡片/趋势图 |
| 数据洞察 | ❌ | ✅ 日报/趋势/对比 |

---

## 二、报表指标定义

### A. 告警报表

**目的**: 看系统稳定性

| 指标 | 口径 | 时间范围 |
|------|------|---------|
| 今日告警总数 | `COUNT(*)` | today |
| CRITICAL/WARN/INFO 数 | `GROUP BY level` | today |
| 最近 7 天每日告警数 | `GROUP BY day` | 7 days |
| 告警类型 Top 10 | `GROUP BY type ORDER BY cnt DESC` | 7 days |
| 告警来源 Top 10 | `GROUP BY source ORDER BY cnt DESC` | 7 days |

**SQL 示例**:
```sql
-- 今日统计
SELECT level, COUNT(*) as cnt
FROM alerts
WHERE DATE(ts) = DATE('now')
GROUP BY level;

-- 7 天趋势
SELECT substr(ts, 1, 10) as day, COUNT(*) as cnt
FROM alerts
WHERE ts >= datetime('now', '-7 days')
GROUP BY day
ORDER BY day ASC;

-- 类型 Top 10
SELECT type, COUNT(*) as cnt
FROM alerts
WHERE ts >= datetime('now', '-7 days')
GROUP BY type
ORDER BY cnt DESC
LIMIT 10;
```

---

### B. 决策报表

**目的**: 看策略行为

| 指标 | 口径 | 时间范围 |
|------|------|---------|
| 今日决策总数 | `COUNT(*)` | today |
| 动作分布 | `GROUP BY normalized_action` | today |
| 最近 7 天动作分布 | `GROUP BY normalized_action` | 7 days |
| 拒绝率 | `(reject_long + reject_short) / total` | 7 days |
| 平均 confidence | `AVG(confidence)` | 7 days |

**SQL 示例**:
```sql
-- 今日动作分布
SELECT normalized_action, COUNT(*) as cnt
FROM decision_events
WHERE DATE(ts) = DATE('now')
GROUP BY normalized_action;

-- 拒绝率（7 天）
SELECT 
  SUM(CASE WHEN normalized_action IN ('reject_long', 'reject_short') THEN 1 ELSE 0 END) * 1.0 / COUNT(*) as reject_rate
FROM decision_events
WHERE ts >= datetime('now', '-7 days');

-- 平均 confidence
SELECT AVG(confidence) as avg_confidence
FROM decision_events
WHERE ts >= datetime('now', '-7 days')
AND confidence IS NOT NULL;
```

---

### C. 控制报表

**目的**: 看人工干预和风控动作

| 指标 | 口径 | 时间范围 |
|------|------|---------|
| 今日控制变更数 | `COUNT(*)` | today |
| 最近 7 天每日变更数 | `GROUP BY day` | 7 days |
| 动作分布 | `GROUP BY action` | 7 days |
| 最近一次模式切换 | `ORDER BY ts DESC LIMIT 1` | - |

**SQL 示例**:
```sql
-- 7 天趋势
SELECT substr(ts, 1, 10) as day, COUNT(*) as cnt
FROM control_audit
WHERE ts >= datetime('now', '-7 days')
GROUP BY day
ORDER BY day ASC;

-- 动作分布
SELECT action, COUNT(*) as cnt
FROM control_audit
WHERE ts >= datetime('now', '-7 days')
GROUP BY action
ORDER BY cnt DESC;

-- 最近一次模式切换
SELECT *
FROM control_audit
WHERE action IN ('enable', 'disable', 'freeze', 'unfreeze')
ORDER BY ts DESC
LIMIT 1;
```

---

## 三、API 设计

### 统一返回结构

```json
{
  "range": {
    "days": 7,
    "start": "2026-03-20",
    "end": "2026-03-26"
  },
  "summary": {
    "total": 100,
    "critical": 5,
    "warn": 90,
    "info": 5
  },
  "series": {
    "daily_counts": [
      {"day": "2026-03-20", "value": 12},
      {"day": "2026-03-21", "value": 15}
    ]
  },
  "top": {
    "types": [
      {"type": "source_failure", "count": 30},
      {"type": "worker_timeout", "count": 20}
    ]
  }
}
```

### API 清单

| API | 参数 | 返回 |
|-----|------|------|
| `/api/reports/alerts` | `days=1\|7\|30` | 告警统计/趋势/Top |
| `/api/reports/decisions` | `days=1\|7\|30` | 决策统计/动作分布/拒绝率 |
| `/api/reports/control` | `days=1\|7\|30` | 控制统计/趋势/动作分布 |

---

## 四、实施顺序

### Day 1: SQLite 聚合查询层

- [ ] `get_alert_summary(days)`
- [ ] `get_alert_daily_counts(days)`
- [ ] `get_alert_level_daily_counts(days)`
- [ ] `get_alert_type_top(days, limit)`
- [ ] `get_alert_source_top(days, limit)`
- [ ] `get_decision_summary(days)`
- [ ] `get_decision_action_distribution(days)`
- [ ] `get_decision_reject_rate(days)`
- [ ] `get_decision_avg_confidence(days)`
- [ ] `get_control_summary(days)`
- [ ] `get_control_daily_counts(days)`
- [ ] `get_control_action_distribution(days)`

### Day 2: API 层

- [ ] `/api/reports/alerts`
- [ ] `/api/reports/decisions`
- [ ] `/api/reports/control`
- [ ] 参数校验（days=1/7/30）
- [ ] 空数据处理

### Day 3: 页面层

- [ ] `/reports` 页面框架
- [ ] 3 组统计卡片
- [ ] 4 张图表
- [ ] 时间范围切换（1/7/30 天）
- [ ] 自动刷新（30 秒）

### Day 4: 验收与修正

- [ ] 对比 SQL 与 API 返回
- [ ] 抽样验证数据一致性
- [ ] 性能测试
- [ ] 空数据/边界测试

---

## 五、文件清单

### 新增

| 文件 | 功能 |
|------|------|
| `reports_service.py` | 报表服务层 |
| `reports_page.html` | 报表页面 |
| `P3_3_REPORTS_PLAN.md` | 本计划文档 |

### 修改

| 文件 | 修改内容 |
|------|---------|
| `storage_sqlite.py` | +12 个聚合查询方法 |
| `panel_v40.py` | +3 个 API 路由 +1 个页面路由 |

---

## 六、验收标准

### 查询层 ✅

- [ ] 所有聚合查询在 1/7/30 天范围内正常
- [ ] 无 SQL 错误
- [ ] 空数据返回稳定

### API 层 ✅

- [ ] 3 个接口结构统一
- [ ] 参数非法时有明确报错
- [ ] 响应时间 <200ms

### 页面层 ✅

- [ ] `/reports` 可正常打开
- [ ] 卡片数值和图表一致
- [ ] 切换 1/7/30 天正确刷新
- [ ] 无明显闪烁

### 业务层 ✅

- [ ] 告警趋势合理
- [ ] 决策分布和历史页一致
- [ ] 控制变更数和审计一致

---

## 七、风险与注意事项

### 1. 时间字段统一

所有按天聚合统一用：
```sql
substr(ts, 1, 10) as day
```

### 2. 历史 alerts 的 legacy 问题

旧格式 alerts 展开成多条，报表中的"告警总数"是**标准化后事件数**，不是原始 JSONL 行数。

### 3. 空数据处理

无数据时返回空结构，不让前端报错：
```json
{
  "summary": {"total": 0, ...},
  "series": {"daily_counts": []},
  "top": {"types": []}
}
```

### 4. 拒绝率口径

```
拒绝率 = (reject_long + reject_short) / 全部决策动作
```

不是只拿 signal 事件算。

---

**下一步**: 开始实现 `storage_sqlite.py` 聚合查询方法

---

_小龙规划，2026-03-26 17:15_
