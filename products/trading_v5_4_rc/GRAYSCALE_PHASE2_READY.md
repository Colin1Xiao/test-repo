# V5.4.1 灰度阶段 2 就绪报告

**版本**: v5.4.1-signal  
**日期**: 2026-03-26 21:52  
**状态**: ✅ 就绪

---

## 审核结论

**审核者**: Colin  
**审核时间**: 2026-03-26 21:52

> **V5.4.1 信号层优化可以进入灰度阶段 2，但不能直接放大仓位或扩交易对。**

**前提条件**: ✅ TIME_EXIT 已集成到执行链

---

## 已实现项

| 类别 | 项目 | 状态 | 测试 |
|------|------|------|------|
| **L1 候选信号** | 配置完成 | ✅ | - |
| **L2 硬过滤** | 9 项检查 | ✅ | 5/5 通过 |
| **L3 评分器** | 加权评分 + 分桶 | ✅ | 4/4 通过 |
| **6 字段审计** | StateStore 扩展 | ✅ | 6/6 通过 |
| **TIME_EXIT 集成** | 执行链优化 | ✅ | 5/5 通过 |

---

## 新配置参数

### 入场优化 (L2 硬过滤)

| 参数 | V5.2 | V5.4.1 | 变化 |
|------|------|--------|------|
| entry_threshold | 50 | 68 | +18 |
| spread_hard_gate_bps | 5 | 3.0 | -40% |
| volatility_min | 0.0005 | 0.0008 | +60% |
| volatility_max | 0.02 | 0.008 | -60% |
| min_signal_interval_seconds | 300 | 600 | +100% |
| max_daily_trades | 3 | 2 | -33% |
| cooldown_after_exit_seconds | 无 | 900 | 新增 |
| loss_streak_pause | 无 | 2 笔→1800s | 新增 |

### 退出优化 (TIME_EXIT)

| 参数 | V5.2 | V5.4.1 | 变化 |
|------|------|--------|------|
| max_hold_seconds | 30 | 60 | +100% |
| min_hold_seconds | 无 | 20 | 新增 |
| break_even_guard_seconds | 无 | 15 | 新增 |

### 权重调整

| 因子 | V5.2 | V5.4.1 | 变化 |
|------|------|--------|------|
| trend_consistency | 30% | 22% | -8% |
| spread_quality | 15% | 20% | +5% |
| volume_confirm | 15% | 18% | +3% |
| volatility_range | 10% | 12% | +2% |

---

## 灰度阶段 2 配置

### 边界条件

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 交易对 | ETH/USDT:USDT | 单交易对 |
| 方向 | long | 单方向 (做多) |
| 仓位 | 3 USD × 100x | 最小仓位 |
| 信号流量 | 50% | 灰度阶段 2 |
| 监控 | 人工盯盘 | 逐笔记录 |

### 通过标准

| 指标 | 目标值 | 说明 |
|------|--------|------|
| 连续验证通过 | 50 笔 | 无 P0 问题 |
| win_rate | ≥45% | 当前 33% |
| avg_signal_score | ≥65 | 当前 0.199 |
| avg_spread_bps | ≤2.5 | 收紧点差 |
| TIME_EXIT 比例 | 下降 | 避免过早退出 |

### 停机条件

**立即暂停** (满足任一项):
- stop_verified=False
- 平仓后残留 conditional 单
- StateStore 记录缺字段
- 出现重复开仓
- accepted=True 但交易所侧无真实成交
- 代理/价格源连续异常超过 3 次

**统计暂停** (10-15 笔后评估):
- win_rate < 30%
- avg_signal_score < 60
- avg_spread_bps_at_entry > 3.0
- avg_hold_seconds < 20

### 回滚条件

| 条件 | 动作 |
|------|------|
| P0 问题 | 立即回滚 |
| P1 问题连续 3 次 | 回滚 |
| 止损单提交失败率 > 5% | 回滚 |
| Position Gate 失效 | 立即回滚 |
| 连续 5 笔亏损 | 暂停分析 |

---

## 监控指标

### 结果指标 (50 笔后复盘)

- win_rate
- avg_pnl
- profit_factor
- avg_hold_seconds

### 质量指标 (逐笔记录)

- avg_signal_score
- A/B/C/D bucket 分布
- avg_spread_bps_at_entry
- rejection_reason 分布

### 预期改善

如果优化成功，应出现：
- 交易次数明显下降 (max_daily_trades: 3→2, cooldown 延长)
- avg_signal_score 上升 (entry_threshold: 50→68)
- avg_spread_bps_at_entry 下降 (spread_hard_gate_bps: 5→3)
- pnl 改善或至少亏损收窄

---

## 部署步骤

### Step 1: 更新配置

```bash
# 备份 V5.2 配置
cp trader_config.json trader_config_v52_backup.json

# 应用 V5.4.1 配置
cp config/signal_config_v54.json trader_config.json
```

### Step 2: 启动监控

```bash
# 启动信号层监控
python3 dashboard/signal_audit.py
```

### Step 3: 逐笔记录

在 `DEPLOYMENT_LOG.md` 中记录每笔交易：
- 时间
- symbol
- side
- entry_price
- signal_score
- signal_bucket
- spread_bps
- exit_source
- pnl
- 异常

### Step 4: 50 笔后复盘

分析维度：
- signal_bucket (A/B/C/D)
- spread_bps bucket
- volatility_regime

---

## 下一步决策树

```
50 笔完成
    ↓
复盘分析
    ↓
┌─────────────────────────────────┐
│ win_rate ≥ 45% 且 pnl 改善？     │
└─────────────────────────────────┘
    ↓ 是           ↓ 否
进入阶段 3       调整参数
                ↓
        - entry_threshold 70+
        - spread_hard_gate_bps 2.5
        - 或放宽/收紧 volatility_max
                ↓
        再跑 50 笔验证
```

---

## 禁止事项

❌ 不要现在做：
- 扩到 short 方向
- 扩到多交易对
- 放大仓位 (>3 USD)
- 把 TIME_EXIT 未集成状态当"完成版"

---

## 文件清单

| 文件 | 用途 |
|------|------|
| `config/signal_config_v54.json` | V5.4.1 配置 |
| `core/signal_filter_v54.py` | L2 硬过滤器 |
| `core/signal_scorer_v54.py` | L3 评分器 |
| `core/position_monitor.py` | TIME_EXIT 优化 |
| `test_signal_v54.py` | 信号层测试 |
| `test_time_exit_v54.py` | TIME_EXIT 测试 |
| `DEPLOYMENT_LOG.md` | 灰度观察表 |
| `BACKLOG_V5.4.1.md` | 待办清单 |

---

## 签署

**实现者**: 小龙  
**审核者**: Colin  
**就绪日期**: 2026-03-26 21:52

**状态**: ✅ **灰度阶段 2 就绪**

---

_文档版本：1.0 | 创建日期：2026-03-26_
