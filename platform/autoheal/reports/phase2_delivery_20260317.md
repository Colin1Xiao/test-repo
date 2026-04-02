# OpenClaw vNext 下一阶段交付报告

**日期**: 2026-03-17
**阶段**: Dashboard + 定时任务 + 基线正式化

---

## 一、新增文件列表

### 1. 配置文件
| 文件 | 作用 |
|------|------|
| `config/baselines.yaml` | 正式基线配置 |
| `config/event_schema.json` | 事件字典 v1.0.0 |
| `config/policies.yaml` | 策略配置 |

### 2. 核心脚本
| 文件 | 作用 |
|------|------|
| `bin/baseline_check.sh` | 基线检查工具 |
| `bin/generate_dashboard_data.sh` | Dashboard 数据生成 |
| `bin/archive_events.sh` | 事件归档脚本 |
| `bin/setup_schedule.sh` | 定时任务配置 |
| `bin/judge_stats.sh` | Judge 统计分析 |
| `bin/fault_injection.sh` | 故障注入验收 |

### 3. Dashboard
| 文件 | 作用 |
|------|------|
| `dashboard/index.html` | 作战室视图 (时间线) |
| `dashboard/data/events_timeline.json` | 事件时间线数据 |
| `dashboard/data/health_latest.json` | 健康数据摘要 |
| `dashboard/data/judge_summary.json` | Judge 统计摘要 |
| `dashboard/data/trends.json` | 趋势数据 |

---

## 二、配置内容

### 1. baselines.yaml 核心内容

```yaml
core:
  critical_count: 0
  warning_count_max: 3
  health_ok_after: true
  final_exit: 0
  gateway_online: true
  ocnmps_online: true
  telegram_reachable: true

performance:
  telegram_latency_ms_max: 2000

judge:
  confidence_threshold: 0.75
  low_confidence_ratio_max: 0.20
  manual_review_ratio_max: 0.30

drift_detection:
  critical:
    - critical_count > 0
    - health_ok_after == false
    - gateway_online == false
  warning:
    - warning_count > 3
    - telegram_latency_ms > 2000
```

### 2. 定时任务配置

**macOS (launchd)**:
- `com.openclaw.autoheal.daily.plist` - 每日 04:00
- `com.openclaw.autoheal.digest.plist` - 每日 04:05
- `com.openclaw.autoheal.weekly.plist` - 每周日 09:00
- `com.openclaw.autoheal.hourly.plist` - 每4小时

**任务执行内容**:
| 时间 | 任务 |
|------|------|
| 每4小时 | 健康检查 + 事件处理 |
| 每日 04:00 | 完整检查 + 状态刷新 + 事件处理 |
| 每日 04:05 | 日报 + Telegram + Dashboard 数据刷新 |
| 每周日 09:00 | 周报 + Judge 统计 + 事件归档 |

---

## 三、测试方法

### 1. Dashboard 时间线测试

```bash
# 生成 Dashboard 数据
./bin/generate_dashboard_data.sh

# 打开 Dashboard
open dashboard/index.html

# 验证数据文件
ls dashboard/data/
# 应包含: events_timeline.json, health_latest.json, judge_summary.json, trends.json
```

### 2. 日报测试

```bash
# 手动生成日报
./autoheal.sh --digest

# 查看
cat data/digest_$(date +%Y-%m-%d).md
```

### 3. 周报测试

```bash
# 手动生成周报
./reporter.sh --generate

# 查看
ls reports/weekly_*.md
```

### 4. 基线检查测试

```bash
# 完整基线检查
./bin/baseline_check.sh check

# 仅显示偏离项
./bin/baseline_check.sh drift

# 输出 JSON
./bin/baseline_check.sh json
```

### 5. 定时任务测试

```bash
# 配置定时任务
./bin/setup_schedule.sh

# 验证 launchd 任务 (macOS)
launchctl list | grep openclaw

# 验证 cron 任务 (Linux)
crontab -l | grep openclaw
```

---

## 四、验证清单

### 时间线验证
- [ ] Dashboard 打开后显示事件时间线
- [ ] 事件按 severity 着色 (红色=critical, 黄色=warning, 绿色=info)
- [ ] Judge 决策摘要正确显示
- [ ] Manual Review 队列正确显示

### 日报验证
- [ ] 04:05 后 data/digest_YYYY-MM-DD.md 存在
- [ ] 包含系统健康、告警、修复动作
- [ ] Dashboard 数据已更新

### 周报验证
- [ ] 周日 09:00 后 reports/weekly_*.md 存在
- [ ] 包含 7 天统计、趋势分析
- [ ] Judge 统计报告已生成

### 基线验证
- [ ] baseline_check.sh check 返回正确状态
- [ ] 偏离项被正确识别
- [ ] 所有报告都基于基线给出结论

---

## 五、使用说明

### 日常使用

```bash
# 查看系统状态
./manage.sh status

# 查看基线状态
./bin/baseline_check.sh check

# 查看事件时间线
./bin/replay.sh today

# 查看 Judge 统计
./bin/judge_stats.sh analyze 7

# 打开 Dashboard
open dashboard/index.html
```

### 故障时使用

```bash
# 执行健康检查
./manage.sh check

# 触发修复
./manage.sh repair gateway_unhealthy

# 查看复盘
./bin/replay.sh latest 20

# 查看 Manual Review 队列
./manage.sh status | grep pending
```

### 报告查看

```bash
# 今日简报
cat data/digest_$(date +%Y-%m-%d).md

# 最近周报
ls -lt reports/weekly_*.md | head -1

# Judge 统计报告
./bin/judge_stats.sh report
```

---

## 六、已知问题

1. Gateway 当前离线，需要手动启动
2. 告警去重冷却时间需要根据实际调整
3. Dashboard 数据需要定期刷新 (已配置定时任务)

---

## 七、下一步建议

1. **启动 Gateway** - 完成基线对齐
2. **配置 Telegram 通知** - 让告警自动发送
3. **观察一周** - 收集实际运行数据
4. **调整基线** - 根据实际情况优化阈值

---

*交付完成时间: 2026-03-17 07:21*