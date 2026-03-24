#!/usr/bin/env python3
"""
Regime配置
每个市场状态对应的策略参数和评分权重
"""

REGIME_CONFIG = {
    "range": {
        "description": "震荡行情 - 高质量要求，短持仓",
        "emoji": "🟡",
        "min_score": 40,
        "min_volume": 0.1,
        "take_profit": 0.002,
        "stop_loss": 0.005,
        "max_hold": 30,
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


# 阈值比较表（用于调试和日志）
THRESHOLD_COMPARISON = """
┌─────────────┬────────┬────────┬────────┐
│   参数      │ RANGE  │ TREND  │BREAKOUT│
├─────────────┼────────┼────────┼────────┤
│ min_score   │   80   │   65   │   60   │
│ min_volume  │  1.2x  │  0.6x  │  0.5x  │
│ take_profit │  0.2%  │  0.4%  │  0.6%  │
│ max_hold    │  30s   │  90s   │  120s  │
│ trend权重   │  0.15  │  0.40  │  0.30  │
│ volume权重  │  0.30  │  0.10  │  0.15  │
└─────────────┴────────┴────────┴────────┘
"""