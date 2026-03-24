# 小龙自动交易系统 V3/V3.1

**当前版本**: V3/V3.1  
**更新时间**: 2026-03-14 00:22  
**状态**: 模拟盘连续验证阶段  

---

## 快速开始

### 启动系统（当前版本）
```bash
python3 auto_monitor_v3.py
```

### 查看日志
```bash
tail -f monitor_live.log
```

### 紧急停止
```bash
./emergency_stop.sh
```

---

## 核心文件（最新唯一版本）

### 监控系统
- **auto_monitor_v3.py** (21KB) - ✅ 当前主版本

### API集成
- **okx_api_integration_v2.py** (18KB) - ✅ 当前主版本

### 执行层（V3.1）
- **execution_state_machine.py** (25KB) - 执行状态机

### 策略模块
- **integrated_signal.py** - 多因子信号融合
- **pyramid_strategy.py** - 金字塔滚仓
- **strategy_1pct.py** - 1%波动捕捉
- **strategy_blackswan.py** - 黑天鹅防护

### 风控管理
- **stoploss_manager.py** - 5种止损管理
- **risk_manager.py** - 风险管理器

### 告警系统
- **telegram_alert.py** - Telegram告警

---

## 关键文档

| 文档 | 用途 |
|-----|------|
| CURRENT_VERSION.md | 版本说明 |
| COMPLETE_PROJECT_REPORT.md | 完整项目报告 |
| V3_V3_1_STATUS_CONFIRMED.md | 状态确认 |
| V3_22CHECKS_COMPLETE.md | 22项检查报告 |
| FAULT_DRILL_RECORD.md | 故障演练记录表 |
| DAILY_REVIEW_TEMPLATE.md | 每日复盘表 |
| simulation_run_log.md | 模拟盘运行记录 |

---

## 系统状态

```
✅ 22项检查全部通过
✅ V3.1执行层改造完成
✅ 模拟盘已启动
🔄 24小时首轮观察进行中
```

---

## 下一步

1. 完成24小时首轮观察
2. 执行故障演练（6个场景）
3. 3-7天连续验证
4. 评估小资金灰度

---

*确保任何窗口读取的都是最新唯一版本*
