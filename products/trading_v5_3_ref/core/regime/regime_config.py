#!/usr/bin/env python3
"""
Regime配置
每个市场状态对应的策略参数和评分权重

V2 变更历史:
- RANGE min_volume: 1.2 → 0.8 (2026-03-25: 降低门槛，积累 V3.8 Edge 样本)
- RANGE min_price_change: 0.0015 → 0.001 (同上)
"""

REGIME_CONFIG = {
    "range": {
        "description": "震荡行情 - V2策略：高质量信号+紧止损",
        "emoji": "🟡",
        "min_score": 70,  # V2: 提高门槛 40 → 70
        "min_volume": 0.8,  # V2: 必须放量 1.2 → 0.8 (降低门槛以积累样本)
        "min_price_change": 0.001,  # V2: 新增动量过滤 +0.15% → 0.1% (降低门槛)
        "take_profit": 0.0015,  # V2: 0.2% → 0.15%
        "stop_loss": 0.0005,  # V2: 0.5% → 0.05%
        "max_hold": 45,  # V2: 30s → 45s
        "weights": {
            "trend": 0.15,
            "momentum": 0.15,
            "volume": 0.30,
            "spread": 0.20,
            "volatility": 0.10,
            "rl": 0.10
        }
    },
    
    "trend": {
        "description": "趋势行情 - 降低成交量要求，捕捉方向",
        "emoji": "🔵",
        "min_score": 65,
        "min_volume": 0.6,
        "take_profit": 0.004,
        "stop_loss": 0.008,
        "max_hold": 90,
        "weights": {
            "trend": 0.40,
            "momentum": 0.30,
            "volume": 0.10,
            "spread": 0.10,
            "volatility": 0.05,
            "rl": 0.05
        }
    },
    
    "breakout": {
        "description": "爆发行情 - 最低要求，捕捉极端行情",
        "emoji": "🔴",
        "min_score": 60,
        "min_volume": 0.1,
        "take_profit": 0.006,
        "stop_loss": 0.010,
        "max_hold": 120,
        "weights": {
            "trend": 0.30,
            "momentum": 0.40,
            "volume": 0.15,
            "spread": 0.05,
            "volatility": 0.05,
            "rl": 0.05
        }
    }
}


def get_regime_config(regime_type: str) -> dict:
    """获取指定状态配置"""
    return REGIME_CONFIG.get(regime_type, REGIME_CONFIG["range"])


def get_all_regimes() -> list:
    """获取所有状态类型"""
    return list(REGIME_CONFIG.keys())


def get_regime_weights(regime_type: str) -> dict:
    """获取指定状态的评分权重"""
    config = get_regime_config(regime_type)
    return config.get("weights", REGIME_CONFIG["range"]["weights"])


# 阈值比较表（用于调试和日志）- V2 Updated (2026-03-25: 降低 RANGE 门槛)
THRESHOLD_COMPARISON = """
┌─────────────┬────────┬────────┬────────┐
│   参数      │ RANGE  │ TREND  │BREAKOUT│
├─────────────┼────────┼────────┼────────┤
│ min_score   │   70   │   65   │   60   │
│ min_volume  │  0.8x  │  0.6x  │  0.1x  │
│ price_change│ +0.1%  │   -    │   -    │
│ take_profit │  0.15% │  0.4%  │  0.6%  │
│ stop_loss   │  0.05% │  0.8%  │  1.0%  │
│ max_hold    │  45s   │  90s   │  120s  │
│ trend权重   │  0.15  │  0.40  │  0.30  │
│ volume权重  │  0.30  │  0.10  │  0.15  │
└─────────────┴────────┴────────┴────────┘
V2 RANGE (2026-03-25): min_volume 1.2→0.8x, min_price_change 0.15%→0.1% (积累样本)
"""