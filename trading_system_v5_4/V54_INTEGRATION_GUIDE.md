# V5.4.1 信号链集成指南

**版本**: v5.4.1-signal  
**日期**: 2026-03-26  
**状态**: ✅ Adapter 测试通过

---

## 集成架构

```
V5.3 run_v52_live.py          V5.4.1 信号链
━━━━━━━━━━━━━━━━━━           ━━━━━━━━━━━━━━
     ↓ 信号生成
     score (0-100)
     volume_ratio
     price_change
     regime
     spread_bps
     ↓
     ┌──────────────────────┐
     │  V54SignalAdapter    │
     │  (信号转换器)         │
     └──────────────────────┘
     ↓ L1/L2/L3 检查
     signal_score
     signal_bucket
     rejection_reason
     ↓
     执行决策 (允许/拒绝)
```

---

## 集成步骤

### Step 1: 导入 Adapter

在 `run_v52_live.py` 顶部添加：

```python
# V5.4.1 信号链 Adapter
from v54_signal_adapter import get_v54_adapter

# 初始化
v54_adapter = get_v54_adapter('/Users/colin/.openclaw/workspace/trading_system_v5_4/config/signal_config_v54.json')
```

### Step 2: 在评分后接入 V5.4.1 链

找到评分代码段（约第 420 行）：

```python
# ========== 4. 评分 ==========
score_result = self.scoring_engine.calculate_score(...)
score = score_result.total_score
volume_ratio = df['volume'].iloc[-1] / df['volume'].rolling(20).mean().iloc[-1]
price_change = (df['close'].iloc[-1] - df['close'].iloc[-5]) / df['close'].iloc[-5]
```

**在 Step 5 执行条件检查前**添加 V5.4.1 检查：

```python
# ========== 5. V5.4.1 信号链检查 ==========
v54_allowed, v54_reason, v54_context = v54_adapter.adapt_v53_signal(
    symbol=symbol,
    score=score,
    volume_ratio=volume_ratio,
    price_change=price_change,
    regime=regime.value,
    current_price=current_price,
    spread_bps=2.0  # 实际应从盘口获取
)

# 记录 V5.4.1 统计
v54_stats = v54_adapter.get_stats()
print(f"\n📊 V5.4.1 统计：候选={v54_stats['candidate_signals']}, "
      f"L2 拒绝={v54_stats['l2_rejected']}, L3 拒绝={v54_stats['l3_rejected']}, "
      f"允许={v54_stats['trades_allowed']}")

# 如果 V5.4.1 拒绝，跳过执行
if not v54_allowed:
    print(f"⚠️ V5.4.1 拒绝：{v54_reason}")
    # 记录拒绝原因
    if 'l2_reason' in v54_context:
        print(f"   L2 原因：{v54_context['l2_reason']}")
    elif 'l3_result' in v54_context:
        print(f"   L3 原因：{v54_context['l3_result']['reason']}")
    return {'action': 'v54_rejected', 'symbol': symbol, 'reason': v54_reason}
```

### Step 3: 记录 7 审计字段

在执行交易时记录审计字段：

```python
# ========== 6. 执行 ==========
if v54_allowed:
    # 从 V5.4.1 context 获取审计字段
    signal_score = v54_context.get('signal_score', score)
    signal_bucket = v54_context.get('signal_bucket', 'B')
    trend_alignment = v54_context['l1_factors']['trend_consistency']
    spread_bps = 2.0  # 实际值
    volatility_regime = 'low_normal' if abs(price_change) < 0.01 else 'high'
    cooldown_reason = 'none'
    
    # 执行交易
    trade = await self._execute_trade(symbol, score, regime)
    
    # 记录审计字段到 StateStore
    if trade and hasattr(self, 'state_store'):
        self.state_store.record_trade(
            entry_price=trade.get('price', 0),
            exit_price=0,  # 开仓时 exit 为 0
            pnl=0,
            exit_source='OPEN',
            position_size=trade.get('size', 0),
            stop_ok=True,
            stop_verified=True,
            signal_score=signal_score,
            signal_type=f"v53_{regime.value}",
            trend_alignment=trend_alignment,
            spread_bps=spread_bps,
            volatility_regime=volatility_regime,
            cooldown_reason=cooldown_reason,
            signal_bucket=signal_bucket
        )
```

### Step 4: 记录退出时更新审计字段

在退出交易时：

```python
# 退出时更新记录
if close_result and hasattr(self, 'state_store'):
    # 获取最后交易的 signal_bucket
    last_trade = self.state_store.get_last_trade()
    signal_bucket = last_trade.get('signal_bucket', 'B') if last_trade else 'B'
    
    self.state_store.record_trade(
        entry_price=position.entry_price,
        exit_price=close_result.get('exit_price', 0),
        pnl=close_result.get('pnl', 0),
        exit_source=exit_reason.value,
        position_size=position.size,
        stop_ok=True,
        stop_verified=True,
        signal_bucket=signal_bucket  # 保持开仓时的 bucket
    )
    
    # 记录退出到 adapter (用于 cooldown)
    v54_adapter.record_exit(position.side, close_result.get('pnl', 0))
```

---

## 测试验证

### 单元测试

```bash
cd ~/.openclaw/workspace/trading_system_v5_4
python3 test_v54_adapter.py
```

**预期输出**:
```
✅ 测试 1: 高质量信号 → 通过 (signal_score=75.1, bucket=B)
✅ 测试 2: 低质量信号 → L3 拒绝
✅ 测试 3: Spread 过宽 → L2 拒绝
✅ 测试 4: 波动率过低 → L2 拒绝
```

### 集成测试

1. **启动 run_v52_live.py** (shadow mode)
2. **观察日志输出**:
   - V5.4.1 统计每 10 秒输出
   - 候选信号数 > 0
   - L2/L3 拒绝有合理原因
3. **检查 StateStore**:
   - 7 审计字段完整
   - signal_bucket 正确记录

---

## 配置参数

### V5.4.1 阈值

| 参数 | 默认值 | 说明 |
|------|--------|------|
| entry_threshold | 68 | L3 放行阈值 |
| spread_hard_gate_bps | 3.0 | L2 点差上限 |
| volatility_min | 0.0008 | L2 最小波动率 |
| volatility_max | 0.008 | L2 最大波动率 |
| min_signal_interval_seconds | 600 | L2 信号间隔 |
| max_daily_trades | 2 | L2 每日交易上限 |

### 调整建议

**如果拒绝率过高** (>90%):
- 检查 spread_bps 是否设置正确
- 检查 volatility 计算是否合理
- 考虑临时调低 entry_threshold 到 65

**如果拒绝率过低** (<10%):
- 检查 L2 硬过滤是否生效
- 确认 signal_config_v54.json 加载成功
- 考虑收紧 spread_hard_gate_bps 到 2.5

---

## 监控指标

### 每 10 秒输出

```
📊 V5.4.1 统计：
   候选信号数：X
   L2 拒绝数：Y
   L3 拒绝数：Z
   允许交易数：W
   
   拒绝率：(Y+Z)/X * 100%
   放行率：W/X * 100%
```

### L2 拒绝原因 Top 3

```
L2 rejection_reason top3:
1. spread_too_wide: N 次
2. volatility_out_of_range: M 次
3. cooldown_active: K 次
```

### L3 分桶分布

```
signal_bucket 分布:
A (≥78): N 笔
B (68-78): M 笔
C (58-68): K 笔 (仅记录)
D (<58): L 笔 (丢弃)
```

---

## 故障排查

### 问题 1: 候选信号数始终为 0

**可能原因**:
- V5.3 评分引擎未产生信号
- Adapter 未正确调用

**检查**:
```python
# 确认 adapter 已初始化
print(f"v54_adapter: {v54_adapter}")

# 确认 adapt_v53_signal 被调用
print(f"调用 adapt_v53_signal: symbol={symbol}, score={score}")
```

### 问题 2: L2 拒绝率 100%

**可能原因**:
- spread_bps 设置过高
- volatility 计算错误
- cooldown 配置过严

**检查**:
```python
# 打印 L2 输入参数
print(f"L2 输入：spread={spread_bps}, vol={volatility}, cooldown={...}")

# 检查 signal_config_v54.json
cat config/signal_config_v54.json | jq '.signal_v54.l2_hard_filters'
```

### 问题 3: 7 审计字段未落盘

**可能原因**:
- StateStore 未使用 V5.4.1 版本
- record_trade 调用参数不正确

**检查**:
```python
# 确认 StateStore 版本
from state_store_v54 import get_state_store
ss = get_state_store()
print(f"StateStore: {ss}")

# 检查 record_trade 签名
import inspect
print(inspect.signature(ss.record_trade))
```

---

## 下一步

1. ✅ Adapter 测试通过
2. ⏳ 集成到 run_v52_live.py
3. ⏳ Shadow mode 验证
4. ⏳ 灰度阶段 2 重启 (真实信号源)

---

_文档版本：1.0 | 创建日期：2026-03-26_
