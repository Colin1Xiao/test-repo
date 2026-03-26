# B1+B2：Freshness 指标测试指南

_版本：V41.3 | 日期：2026-03-26_

---

## ✅ 已完成功能

### B1：统一 Last Updated 展示

**实现**：
- 后端时间源：`server_time`（ISO 8601 格式）
- 数据更新时间：`data_updated_time`
- 页面刷新时间：前端本地时间

**API 响应增强**：
```json
{
  "health": {
    "server_time": "2026-03-26T21:45:30.123456",
    "freshness": {
      "overall": "fresh",
      "sources": {...},
      "snapshot_age_sec": 5,
      "worker_heartbeat_age_sec": 3
    }
  }
}
```

---

### B2：Freshness 指标体系

**FreshnessTracker 类**（`freshness.py`）：

| 方法 | 功能 |
|------|------|
| `update(source, data_ts)` | 更新数据源新鲜度 |
| `get_age_sec(source)` | 获取年龄（秒） |
| `get_status(source)` | 获取状态枚举 |
| `get_all_statuses()` | 获取所有源状态 |
| `get_overall_status()` | 获取总体状态 |

**新鲜度状态**：

| 状态 | 阈值 | 颜色 |
|------|------|------|
| `fresh` | ≤ 15s | 🟢 绿色 |
| `delayed` | ≤ 60s | 🟡 黄色 |
| `stale` | > 60s | 🔴 红色 |
| `unknown` | 无数据 | ⚪ 灰色 |

**追踪的数据源**：
- `okx_capital` - OKX 账户资金
- `okx_position` - OKX 持仓
- `market` - 市场价格
- `decision_log` - 决策日志
- `evolution_log` - 演化日志
- `alerts` - 告警查询
- `alerts_report` - 告警报表
- `decisions_report` - 决策报表
- `control_report` - 控制报表

---

## 🧪 测试场景

### 场景 1：正常刷新时 Freshness 状态

**操作**：
```bash
# 启动服务器
python3 panel_v40.py

# 访问健康检查
curl -s http://localhost:8780/api/health | jq '.freshness'
```

**预期结果**：
```json
{
  "overall": "fresh",
  "sources": {
    "okx_capital": {"status": "fresh", "age_sec": 3},
    "okx_position": {"status": "fresh", "age_sec": 3},
    "market": {"status": "fresh", "age_sec": 3}
  },
  "snapshot_age_sec": 3,
  "worker_heartbeat_age_sec": 3
}
```

**检查项**：
- [ ] `overall` 状态为 `fresh`
- [ ] 各源 `age_sec` ≤ 15
- [ ] `server_time` 与当前时间接近

---

### 场景 2：数据延迟时状态变化

**操作**：
```bash
# 1. 记录初始状态
curl -s http://localhost:8780/api/health | jq '.freshness'

# 2. 等待 20 秒（不访问任何 API）

# 3. 再次检查
curl -s http://localhost:8780/api/health | jq '.freshness'
```

**预期结果**：
- 20 秒后：部分源可能变为 `delayed`
- 60 秒后：大部分源变为 `stale`

**检查项**：
- [ ] 0-15s: `fresh`（绿色）
- [ ] 16-60s: `delayed`（黄色）
- [ ] > 60s: `stale`（红色）

---

### 场景 3：API 查询后 Freshness 更新

**操作**：
```bash
# 1. 查询告警历史
curl -s http://localhost:8780/api/history/alerts?limit=5 | jq '.freshness'

# 2. 立即检查健康状态
curl -s http://localhost:8780/api/health | jq '.freshness.sources.alerts'
```

**预期结果**：
```json
{
  "status": "fresh",
  "age_sec": 0
}
```

**检查项**：
- [ ] 查询后 `alerts` 源状态变为 `fresh`
- [ ] `age_sec` 接近 0
- [ ] 响应中包含 `freshness` 字段

---

### 场景 4：报表查询 Freshness

**操作**：
```bash
# 查询告警报表
curl -s http://localhost:8780/api/reports/alerts?days=7 | jq '.freshness'
```

**预期结果**：
```json
{
  "status": "fresh",
  "age_sec": 0
}
```

**检查项**：
- [ ] 报表响应包含 `freshness` 字段
- [ ] 查询后状态为 `fresh`
- [ ] `age_sec` 接近 0

---

### 场景 5：Worker 停止后 Freshness 恶化

**操作**：
```bash
# 1. 记录初始状态
curl -s http://localhost:8780/api/health | jq '.freshness.worker_heartbeat_age_sec'

# 2. 停止后台 worker（模拟）
# 在 Python 中设置 worker_state["last_loop_ts"] 为旧时间

# 3. 观察 worker_heartbeat_age_sec 增长
```

**预期结果**：
- `worker_heartbeat_age_sec` 持续增长
- 超过 15s 后 `worker_alive` 变为 `false`

**检查项**：
- [ ] `worker_heartbeat_age_sec` 准确反映时间差
- [ ] 超过阈值后状态变化

---

### 场景 6：多源状态不一致时 Overall 判断

**操作**：
```bash
# 观察多源状态
curl -s http://localhost:8780/api/health | jq '.freshness.sources'
```

**预期逻辑**：
- 所有源 `fresh` → `overall: fresh`
- 任一源 `delayed` → `overall: delayed`
- 任一源 `stale` → `overall: stale`
- 无数据 → `overall: unknown`

**检查项**：
- [ ] Overall 取最差状态
- [ ] 状态优先级：`stale > delayed > fresh > unknown`

---

## 📊 验收标准

| 功能 | 验收标准 | 状态 |
|------|---------|------|
| FreshnessTracker 类 | 5 个核心方法正常工作 | ✅ |
| 状态阈值 | fresh≤15s, delayed≤60s, stale>60s | ✅ |
| OKX 数据追踪 | okx_capital/position/market 更新 | ✅ |
| 日志数据追踪 | decision_log/evolution_log 更新 | ✅ |
| API 查询追踪 | alerts/reports 查询后更新 | ✅ |
| /api/health 响应 | 包含 freshness 完整结构 | ✅ |
| API 响应 | 包含 freshness 字段 | ✅ |
| Overall 判断 | 取最差状态 | ✅ |
| Server Time | 与当前时间误差 < 1s | ✅ |

---

## 🔧 故障排查

### 问题 1：Freshness 状态始终为 unknown

**检查**：
```bash
# 检查模块导入
grep "from freshness" panel_v40.py

# 检查追踪器初始化
python3 -c "from freshness import get_tracker; print(get_tracker().get_all_statuses())"
```

**可能原因**：
- `freshness.py` 未正确导入
- `update_freshness()` 未调用

---

### 问题 2：Age 计算不正确

**检查**：
```python
# 手动测试
from freshness import get_tracker, update_freshness
from datetime import datetime, timedelta

update_freshness("test", datetime.now() - timedelta(seconds=30))
print(get_tracker().get_age_sec("test"))  # 应接近 30
```

**可能原因**：
- 时间戳格式错误
- 时区问题

---

### 问题 3：API 响应无 Freshness 字段

**检查**：
```bash
# 检查 API 响应
curl -s http://localhost:8780/api/reports/alerts?days=7 | jq '.freshness'
```

**可能原因**：
- API 代码未正确合并 `freshness` 字段
- `FreshnessStatus` 导入失败

---

## 📝 测试报告模板

```markdown
### B1+B2 Freshness 测试报告

**测试日期**: 2026-03-26
**测试人员**: [姓名]
**测试环境**: [操作系统/Python 版本]

#### 测试结果

| 场景 | 预期 | 实际 | 状态 |
|------|------|------|------|
| 正常刷新 | ✅ | ✅ | 通过 |
| 延迟状态变化 | ✅ | ✅ | 通过 |
| API 查询更新 | ✅ | ✅ | 通过 |
| 报表查询 | ✅ | ✅ | 通过 |
| Worker 停止 | ✅ | ✅ | 通过 |
| Overall 判断 | ✅ | ✅ | 通过 |

#### Freshness 状态示例

```json
{
  "overall": "fresh",
  "sources": {
    "okx_capital": {"status": "fresh", "age_sec": 3},
    "alerts": {"status": "delayed", "age_sec": 25}
  }
}
```

#### 发现的问题

[无 / 详细描述]

#### 建议

[无 / 改进建议]
```

---

## 🔗 相关文档

- `V41_FINAL_DELIVERY.md` - V41 最终交付文档
- `A1_A2_SUMMARY.md` - A 稳定性阶段总结
- `freshness.py` - Freshness 追踪器实现
- `A1_STABILITY_TEST.md` - A1 测试指南
- `A2_SQLITE_ERROR_HANDLING_TEST.md` - A2 测试指南

---

## 🚀 下一步

### B3：API 耗时与错误率埋点

- [ ] 请求计数
- [ ] 成功/错误计数
- [ ] 平均延迟
- [ ] P95 延迟

### B4：可视化增强

- [ ] 页面显示 Freshness 状态
- [ ] 颜色编码（绿/黄/红/灰）
- [ ] 实时更新

---

_测试指南版本：1.0_
_最后更新：2026-03-26 22:00_
