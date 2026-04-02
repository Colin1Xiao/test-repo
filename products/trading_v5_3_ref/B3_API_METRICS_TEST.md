# B3：API 耗时与错误率埋点测试指南

_版本：V41.4 | 日期：2026-03-26_

---

## ✅ 已完成功能

### 核心模块（api_metrics.py）

| 功能 | 实现 | 说明 |
|------|------|------|
| ApiMetricsTracker | 内存埋点器 | 轻量级，单进程 |
| APIEndpointMetrics | 端点指标 | 7 个核心字段 |
| request_count | 总请求数 | 整型 |
| success_count / error_count | 成功/失败计数 | 整型 |
| error_rate | 错误率（0-1） | 浮点 |
| avg_latency_ms | 平均延迟 | 浮点 |
| last_latency_ms | 最近延迟 | 浮点 |
| p95_latency_ms | P95 延迟 | 浮点（可选） |

---

### API �Sampling

**已覆盖端点**：
- ✅ `/api/health`
- ✅ `/api/history/alerts`
- ✅ `/api/reports/alerts`
- 🔲 `/api/history/control`
- 🔲 `/api/history/decisions`
- 🔲 `/api/reports/decisions`
- 🔲 `/api/reports/control`

**指标字段**：
```json
{
  "endpoint": "/api/reports/alerts",
  "request_count": 42,
  "success_count": 40,
  "error_count": 2,
  "error_rate": 0.0476,
  "avg_latency_ms": 38.2,
  "last_latency_ms": 41.7,
  "max_latency_ms": 150.3,
  "p95_latency_ms": 85.1,
  "last_success_time": "2026-03-26T22:15:30.123456",
  "last_error_time": "2026-03-26T22:14:10.987654"
}
```

---

## 🧪 测试场景

### 场景 1：正常请求指标增长

**操作**：
```bash
# 1. 启动服务器
python3 panel_v40.py

# 2. 访问 /api/health 查看初始状态
curl -s http://localhost:8780/api/health | jq '.api_metrics | keys'

# 3. 访问测试端点
curl -s http://localhost:8780/api/reports/alerts?days=7 > /dev/null
curl -s http://localhost:8780/api/reports/alerts?days=7 > /dev/null
curl -s http://localhost:8780/api/reports/alerts?days=7 > /dev/null

# 4. 查看指标
curl -s http://localhost:8780/api/health | jq '.api_metrics["/api/reports/alerts"]'
```

**预期结果**：
```json
{
  "request_count": 3,
  "success_count": 3,
  "error_count": 0,
  "error_rate": 0.0,
  "avg_latency_ms": ~40.0,
  "last_latency_ms": ~40.0
}
```

**检查项**：
- [ ] `request_count` 正确增长
- [ ] `success_count` 等于请求数
- [ ] `avg_latency_ms` 有意义（非零）

---

### 场景 2：手动制造错误后指标更新

**操作**：
```bash
# 1. 访问正常端点
curl -s http://localhost:8780/api/reports/alerts?days=7 > /dev/null

# 2. 人为制造错误（临时重命名表）
sqlite3 data/panel_v41.db "ALTER TABLE alerts RENAME TO alerts_backup;"

# 3. 访问历史端点（应失败）
curl -s http://localhost:8780/api/history/alerts | jq '{ok: .ok, error: .error.code}'

# 4. 恢复表
sqlite3 data/panel_v41.db "ALTER TABLE alerts_backup RENAME TO alerts;"

# 5. 查看指标
curl -s http://localhost:8780/api/health | jq '.api_metrics["/api/history/alerts"]'
```

**预期结果**：
```json
{
  "request_count": 2,
  "success_count": 1,
  "error_count": 1,
  "error_rate": 0.5,
  "last_error_time": "2026-03-26T22:xx:xx"
}
```

**检查项**：
- [ ] `error_count` 增长
- [ ] `error_rate` 更新为 0.5
- [ ] `last_error_time` 正确

---

### 场景 3：不同端点独立指标

**操作**：
```bash
# 1. 访问 /api/reports/alerts 3 次
for i in {1..3}; do curl -s http://localhost:8780/api/reports/alerts?days=7 > /dev/null; done

# 2. 访问 /api/history/alerts 2 次
for i in {1..2}; do curl -s http://localhost:8780/api/history/alerts?limit=5 > /dev/null; done

# 3. 查看两个端点的指标
curl -s http://localhost:8780/api/health | jq '.api_metrics | {alerts: .["/api/reports/alerts"].request_count, history: .["/api/history/alerts"].request_count}'
```

**预期结果**：
```json
{
  "alerts": 3,
  "history": 2
}
```

**检查项**：
- [ ] 各端点独立计数
- [ ] 总请求数正确

---

### 场景 4：平均延迟计算

**操作**：
```bash
# 1. 多次访问（>10 次）
for i in {1..15}; do curl -s http://localhost:8780/api/reports/alerts?days=7 > /dev/null; done

# 2. 查看平均延迟
curl -s http://localhost:8780/api/health | jq '.api_metrics["/api/reports/alerts"] | {avg: .avg_latency_ms, last: .last_latency_ms}'
```

**预期结果**：
- `avg_latency_ms` 应与多次请求的平均值接近
- `last_latency_ms` 应接近最后一次请求时间

**检查项**：
- [ ] 平均延迟计算正确
- [ ] 无异常波动

---

### 场景 5：P95 延迟（如实现）

**操作**：
```bash
# 多次请求后查看 P95
curl -s http://localhost:8780/api/health | jq '.api_metrics["/api/reports/alerts"].p95_latency_ms'
```

**预期结果**：
- 存在时，P95 应 > avg_latency_ms

---

### 场景 6：重启后指标重置

**操作**：
```bash
# 1. 访问端点
curl -s http://localhost:8780/api/reports/alerts?days=7 > /dev/null
curl -s http://localhost:8780/api/reports/alerts?days=7 > /dev/null

# 2. 查看指标
curl -s http://localhost:8780/api/health | jq '.api_metrics["/api/reports/alerts"].request_count'
# 预期: 2

# 3. 重启服务器
kill $(cat server.pid)
python3 panel_v40.py > /dev/null 2>&1 &
sleep 3

# 4. 再次查看指标
curl -s http://localhost:8780/api/health | jq '.api_metrics["/api/reports/alerts"].request_count'
# 预期: 0
```

**检查项**：
- [ ] 重启后指标清零

---

## 📊 验收标准

| 功能 | 验收标准 | 状态 |
|------|---------|------|
| 请求计数 | request_count 正确增长 | ✅ |
| 成功/错误计数 | success_count + error_count = request_count | ✅ |
| 错误率计算 | error_rate = error_count / request_count | ✅ |
| 平均延迟 | avg_latency_ms 可计算 | ✅ |
| 最近延迟 | last_latency_ms 记录最近一次 | ✅ |
| 最后成功/失败时间 | last_success_time / last_error_time 存在 | ✅ |
| /api/health 暴露指标 | api_metrics 字段可访问 | ✅ |
| 覆盖端点 | /api/health + /api/history/* + /api/reports/* | 🔲 |

---

## 🔧 故障排查

### 问题 1：api_metrics 字段为空

**检查**：
```bash
# 检查模块导入
grep "from api_metrics" panel_v40.py

# 测试模块
python3 -c "from api_metrics import get_all_metrics; print(get_all_metrics())"
```

**可能原因**：
- `api_metrics.py` 未正确导入
- `ApiMetricsTracker` 未初始化

---

### 问题 2：指标始终为 0

**检查**：
```bash
# 访问端点后查看日志
tail -50 panel_v41.log | grep track
```

**可能原因**：
- `track_request()` 未被调用
- 模块导入失败但无日志

---

### 问题 3：last_error_time 未更新

**检查**：
```bash
# 产生错误后立即查看
curl -s http://localhost:8780/api/health | jq '.api_metrics'
```

**可能原因**：
- finally 块未执行
- 异常被提前返回

---

## 📝 测试报告模板

```markdown
### B3 APIMetrics 测试报告

**测试日期**: 2026-03-26
**测试人员**: [姓名]
**测试环境**: [操作系统/Python 版本]

#### 测试结果

| 场景 | 预期 | 实际 | 状态 |
|------|------|------|------|
| 正常请求计数 | ✅ | ✅ | 通过 |
| 错误后指标更新 | ✅ | ✅ | 通过 |
| 多端点独立 | ✅ | ✅ | 通过 |
| 平均延迟计算 | ✅ | ✅ | 通过 |
| P95 延迟 | ✅ | ✅ | 通过 |
| 重启后重置 | ✅ | ✅ | 通过 |

#### 指标示例

```json
{
  "/api/reports/alerts": {
    "request_count": 42,
    "success_count": 40,
    "error_count": 2,
    "error_rate": 0.0476,
    "avg_latency_ms": 38.2,
    "last_latency_ms": 41.7
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
- `B1_B2_SUMMARY.md` - B1+B2 阶段总结
- `api_metrics.py` - 性能追踪器实现
- `B1_B2_FRESHNESS_TEST.md` - B1+B2 测试指南

---

## 🚀 下一步

### B4：可视化增强（可选）

- [ ] 页面显示 API 性能卡片
- [ ] 指标图表展示（latency trend）
- [ ] 错误率趋势图

### Phase R1：C 运营化

- [ ] 报表导出（CSV/PDF）
- [ ] 日报摘要

---

## 🚀 联合回归建议

**A+B 联合回归测试场景**：

| 组合 | 测试点 |
|------|--------|
| A1 + B3 | 自动刷新时 latency 稳定 |
| A2 + B3 | 错误后 error_count 增长 |
| B1 + B3 | server_time 与 latency 关联 |
| B2 + B3 | fresh 指标 + low latency |

---

_测试指南版本：1.0_
_最后更新：2026-03-26 22:30_
