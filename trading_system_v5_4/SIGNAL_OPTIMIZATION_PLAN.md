# V5.4 信号层优化实现计划

**版本**: v5.4.1-signal  
**创建日期**: 2026-03-26  
**状态**: 待实现

---

## 问题诊断

从 V5.4.0 实盘数据看：

| 指标 | 值 | 问题 |
|------|-----|------|
| avg_signal_quality | 0.199 | 信号质量差 |
| avg_execution_quality | 1.0 | 执行质量优秀 |
| win_rate | 33.3% (1/3) | 胜率偏低 |
| exit_source | 100% TIME_EXIT | 退出过早 |
| pnl | -$0.00106 | 微负 |

**根因**: 入场门太宽、市场质量门太弱、退出太快

---

## 优化目标

从 **"满足基本条件就进"** 升级为 **"只有候选信号 + 市场环境合格 + 评分足够高才进"**

---

## L1/L2/L3 分层架构

### L1: 候选信号层

**职责**: 生成候选，不直接触发交易

**触发条件** (至少满足 2 项):
- trend_consistency >= 0.60
- pullback_breakout >= 0.55
- volume_confirm >= 0.55

**输出字段**:
- signal_type
- side
- candidate_score_raw
- trend_alignment
- volume_ratio
- breakout_strength

---

### L2: 硬过滤层

**职责**: 任意一项失败直接拒绝

| 过滤项 | 参数 | 说明 |
|--------|------|------|
| spread_hard_gate_bps | 3.0 | 点差上限从 5bps 降至 3bps |
| volatility_min | 0.0008 | 最低波动率从 0.0005 提升 |
| volatility_max | 0.008 | 最高波动率从 0.02 降至 0.008 |
| price_staleness_seconds | 2.0 | 价格更新超过 2 秒拒绝 |
| market_jump_gate_bps | 8 | 短时跳变超过 8bps 拒绝 |
| min_signal_interval_seconds | 600 | 信号间隔从 300s 增至 600s |
| cooldown_after_exit_seconds | 900 | 退出后 15 分钟同方向冷却 |
| max_daily_trades | 2 | 每日交易从 3 笔降至 2 笔 |
| loss_streak_pause | 2 笔亏 30 分钟 | 连续亏损保护 |

**新增机制**:
1. 同方向 cooldown (900s)
2. 连续亏损暂停 (2 笔 → 1800s)
3. 价格跳变保护 (8bps)
4. 订单簿深度检查 (1.5x)

---

### L3: 评分放行层

**职责**: 最终决策

**阈值**:
- score >= 78: A 档 - 高置信度交易
- 68 <= score < 78: B 档 - 正常交易
- 58 <= score < 68: C 档 - 仅记录不交易
- score < 58: D 档 - 直接丢弃

**权重调整**:

| 因子 | V5.2 | V5.4.1 | 变化 |
|------|------|--------|------|
| trend_consistency | 30 | 22 | -8 |
| pullback_breakout | 20 | 18 | -2 |
| volume_confirm | 15 | 18 | +3 |
| spread_quality | 15 | 20 | +5 |
| volatility_range | 10 | 12 | +2 |
| rl_filter | 10 | 10 | 0 |

**调整逻辑**:
- 降低 trend_consistency 独裁权重
- 提高 spread_quality (micro 模式点差最吃 edge)
- 提高 volume_confirm (让入场更像"有推动的突破")

---

## 退出链优化

**问题**: 100% TIME_EXIT，退出过早

**新参数**:
- min_hold_seconds: 20 (前 20 秒不允许普通 TIME_EXIT)
- time_exit_seconds: 45 (从默认值调整)
- break_even_guard_seconds: 15 (15 秒内浮亏轻微不砍)

**逻辑**:
```
0-15s:  浮亏轻微 → 不砍
15-20s: 观察期
20-45s: 允许 TIME_EXIT
45-60s: 强制 TIME_EXIT
```

---

## 审计字段 (6+4)

### 必记 6 字段

| 字段 | 含义 | 例子 |
|------|------|------|
| signal_score | 最终放行分数 | 72.4 |
| signal_type | 信号类型 | trend_pullback_breakout_long |
| trend_alignment | 趋势一致性分 | 0.81 |
| spread_bps | 入场时点差 | 1.8 |
| volatility_regime | 波动分桶 | low_normal/high |
| cooldown_reason | 冷却原因 | post_exit_cooldown/loss_streak_pause/none |

### 推荐 4 字段

| 字段 | 含义 |
|------|------|
| volume_ratio | 成交量比率 |
| market_quality_pass | 市场质量通过标记 |
| price_staleness_ms | 价格延迟毫秒 |
| signal_bucket | 信号分桶 (A/B/C/D) |

---

## 实现步骤

### Step 1: 配置文件 (✅ 已完成)

- [x] `config/signal_config_v54.json`

### Step 2: L2 硬过滤实现

**文件**: `core/signal_filter_v54.py`

**功能**:
- Spread Gate
- Staleness Gate
- Jump Gate
- Cooldown 管理
- Loss Streak 跟踪

### Step 3: L3 评分器实现

**文件**: `core/signal_scorer_v54.py`

**功能**:
- 加权评分计算
- 分桶逻辑
- 放行决策

### Step 4: StateStore 扩展

**文件**: `core/state_store_v54.py`

**功能**:
- 新增 10 个审计字段
- record_trade() 扩展参数

### Step 5: 信号链集成

**文件**: `core/signal_pipeline_v54.py`

**功能**:
- L1 → L2 → L3 流水线
- 日志记录
- 监控指标

### Step 6: 监控面板扩展

**文件**: `dashboard/signal_audit.py`

**功能**:
- 信号质量分析
- 分桶统计
- 冷却事件追踪

---

## 验收标准

### 功能验收

- [ ] L2 硬过滤拒绝率 > 40% (当前 0%)
- [ ] avg_signal_score >= 65 (当前 avg_signal_quality=0.199)
- [ ] cooldown 机制正常工作
- [ ] loss_streak_pause 触发正常
- [ ] 10 个审计字段完整记录

### 性能验收

- [ ] 信号处理延迟 < 100ms
- [ ] 文件锁性能无退化
- [ ] 并发信号正确处理

### 实盘验收 (灰度阶段 2)

- [ ] 连续 50 笔验证通过
- [ ] win_rate >= 45% (当前 33%)
- [ ] avg_pnl > 0 (当前 -$0.00106)
- [ ] TIME_EXIT 比例下降 (当前 100%)

---

## 回滚方案

**条件**:
- 连续 5 笔亏损
- 信号拒绝率 > 90% (过严)
- 系统异常

**步骤**:
1. 切换回 V5.2 配置
2. 恢复原阈值
3. 保留审计字段 (向后兼容)

---

## 时间估算

| 步骤 | 工作量 | 优先级 |
|------|--------|--------|
| Step 1 配置 | ✅ 完成 | P0 |
| Step 2 L2 过滤 | 4h | P0 |
| Step 3 L3 评分 | 3h | P0 |
| Step 4 StateStore | 2h | P0 |
| Step 5 集成 | 3h | P0 |
| Step 6 监控 | 2h | P1 |
| 测试验证 | 4h | P0 |
| **总计** | **18h** | |

---

## 下一步

1. ✅ 配置文件完成
2. ⏳ 实现 L2 硬过滤
3. ⏳ 实现 L3 评分器
4. ⏳ 扩展 StateStore
5. ⏳ 集成测试
6. ⏳ 灰度验证

---

_文档版本：1.0 | 创建日期：2026-03-26_
