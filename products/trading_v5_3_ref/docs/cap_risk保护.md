# Capital Risk 保护专题

## 问题发现

### 小资金被 Clamp 放大风险

在低权益阶段，**最小保证金规则会导致实际风险比例被非线性放大**：

#### 案例分析

```
参数配置：
- base_risk_fraction = 2%
- min_margin_usdt = 1.0
- max_margin_usdt = 5.0
- leverage = 100

场景 1：正常资金（equity = 120 USDT）
├─ 理论 margin = 120 × 2% = 2.4 USDT
├─ Clamp 后 margin = 2.4 USDT（未触及下限）
└─ 实际 risk_pct = 2.4 / 120 = 2% ✅

场景 2：小资金（equity = 1.35 USDT）
├─ 理论 margin = 1.35 × 2% = 0.027 USDT
├─ Clamp 后 margin = 1.0 USDT（触及 min_margin）
└─ 实际 risk_pct = 1.0 / 1.35 = 74% ❌ 意外放大！
```

### 风险语义变化

- **理论风险**：2%（由 base_risk_fraction 决定）
- **实际风险**：74%（由 min_margin clamp 导致）
- **风险放大倍数**：37x

这不是 bug，但如果不堵上， small capital 会不成比例地冒险。

---

## 解决方案

### Risk Pct 上限保护（3%）

在 `CapitalControllerV2.calculate()` 末尾添加：

```python
# 6. Risk Pct 上限保护（防止小资金被 clamp 放大风险）
if margin > 0 and equity_usdt > 0:
    actual_risk_pct = margin / equity_usdt
    if actual_risk_pct > 0.03:  # 3% 上限
        return self._blocked_decision(
            equity_usdt=equity_usdt,
            entry_price=entry_price,
            drawdown=drawdown,
            edge_state=edge_state,
            risk_state=risk_state,
            reason="RISK_PCT_TOO_HIGH",
        )
```

### 验证结果

#### 小资金被阻止

```
Equity: 1.35 USDT
Margin: 0.0 USDT (被阻止)
Risk Pct: 0.00%
CanTrade: False
Reason: RISK_PCT_TOO_HIGH
```

#### 正常资金正常交易

```
Equity: 50.0 USDT
Margin: 1.0 USDT
Risk Pct: 2.00%
CanTrade: True
Reason: BASE
```

---

## 实施细节

### 文件修改

**`core/capital_controller_v2.py`**

插入点：上下限保护之后，计算仓位之前

```python
# 6. Risk Pct 上限保护（防止小资金被 clamp 放大风险）
if margin > 0 and equity_usdt > 0:
    actual_risk_pct = margin / equity_usdt
    if actual_risk_pct > 0.03:  # 3% 上限
        return self._blocked_decision(
            equity_usdt=equity_usdt,
            entry_price=entry_price,
            drawdown=drawdown,
            edge_state=edge_state,
            risk_state=risk_state,
            reason="RISK_PCT_TOO_HIGH",
        )
```

---

## 防御策略

### 多层保护

| 层级 | 保护机制 | 触发条件 |
|------|---------|---------|
| Layer 1 | Base Risk Fraction | 每笔默认 2% |
| Layer 2 | Drawdown Penalty | 回撤 ≥5% → 降 50% |
| Layer 3 | Edge/Risk Linkage | EDGE_WEAK/RISK_WARNING → 降 50% |
| Layer 4 | Clamp Bounds | [1.0, 5.0] USDT |
| Layer 5 | **Risk Pct Cap** | **>3% → BLOCK** ✅ |

### 建议阈值

- **3%**：正值（避免 clamp 放大风险）
- **5%**：保守（更严格）
- **2%**：目标（避免直接 block 正常交易）

###threshold 应该是 3% 还是 2%？

- **3%**：允许小资金"勉强交易"（margin/expected_margin）
- **2%**：严格执行 base_risk_fraction（更严格）

当前选择 **3%**，因为：
1. 允许小资金积累（1-2 USDT）
2. 防止极端风险放大（74% → 3%）
3. 有其他层保护（drawdown/edge/risk）

---

## 监控 & 观察

### 关键指标

```json
{
  "capital_risk_monitor": {
    "equity_usdt_threshold": {
      "warn": 2.5,
      "block": 1.0
    },
    "risk_pct_threshold": {
      "target": 0.02,
      "warn": 0.025,
      "block": 0.03
    }
  }
}
```

### 监控日志

当 `RISK_PCT_TOO_HIGH` 触发时，记录：

```
[⚠️ Capital Risk Alert]
Equity: 1.35 USDT
Target Margin: 0.027 USDT
Actual Margin: 1.0 USDT (clamped)
Risk Pct: 74% > 3% BLOCKED
Reason: RISK_PCT_TOO_HIGH
Action: 建议等待资金积累到 >= 2.5 USDT
```

---

## 总结

### 问题

- 小资金下，`min_margin_usdt` clamp 导致 risk_pct 非线性放大
- 理论 2% → 实际 74%

### 解决

- 添加 Risk Pct 上限保护（3%）
- 超阈值时 `BLOCKED`

### 验证

- ✅ 小资金（1.35 USDT）→ BLOCK
- ✅ 正常资金（50 USDT）→ 2% 正常交易

### 后续

- 等待 Equity ≥ 2.5 USDT 再允许交易
- 或提高 base_risk_fraction（不推荐）

---

**记录时间**: 2026-03-24  
**版本**: V5.4  
**风险等级**: ⚠️ 中等（小资金累积阶段）
