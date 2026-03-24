#!/usr/bin/env python3
"""
评分诊断脚本 - 找出拖累项
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent / 'core'))

import pandas as pd
import numpy as np
from datetime import datetime

def diagnose_scoring():
    """诊断评分引擎"""
    
    print("=" * 60)
    print("🔍 评分诊断工具")
    print("=" * 60)
    
    # 模拟最近市场数据
    from scoring_engine_v43 import ScoringEngineV43
    from regime.regime_types import MarketRegime
    
    engine = ScoringEngineV43(default_threshold=75)
    
    # 模拟不同市场情况
    scenarios = [
        {
            "name": "低成交量 + 趋势不对齐",
            "trend": 0.3,  # 趋势不对齐
            "momentum": 0.6,
            "volume": 0.33,  # 低成交量
            "spread": 0.8,
            "volatility": 0.5,
            "rl": 1.0
        },
        {
            "name": "高成交量 + 趋势对齐",
            "trend": 0.8,  # 趋势对齐
            "momentum": 0.7,
            "volume": 0.9,  # 高成交量
            "spread": 0.9,
            "volatility": 0.6,
            "rl": 1.0
        },
        {
            "name": "完美市场",
            "trend": 1.0,
            "momentum": 1.0,
            "volume": 1.0,
            "spread": 1.0,
            "volatility": 1.0,
            "rl": 1.0
        }
    ]
    
    regimes = ["range", "trend", "breakout"]
    
    from regime.regime_config import get_regime_weights
    
    for regime in regimes:
        weights = get_regime_weights(regime)
        print(f"\n{'='*60}")
        print(f"📊 {regime.upper()} 模式")
        print(f"{'='*60}")
        
        print("\n权重分布:")
        for key, weight in weights.items():
            bar = "█" * int(weight * 20)
            print(f"  {key:12s}: {weight:.2f} {bar}")
        
        print("\n场景分析:")
        for scenario in scenarios:
            score = (
                scenario['trend'] * weights.get('trend', 0) * 100 +
                scenario['momentum'] * weights.get('momentum', 0) * 100 +
                scenario['volume'] * weights.get('volume', 0) * 100 +
                scenario['spread'] * weights.get('spread', 0) * 100 +
                scenario['volatility'] * weights.get('volatility', 0) * 100 +
                scenario['rl'] * weights.get('rl', 0) * 100
            )
            
            print(f"\n  场景: {scenario['name']}")
            print(f"  总分: {score:.1f}")
            
            # 找拖累项
            contributions = {
                'trend': scenario['trend'] * weights.get('trend', 0) * 100,
                'momentum': scenario['momentum'] * weights.get('momentum', 0) * 100,
                'volume': scenario['volume'] * weights.get('volume', 0) * 100,
                'spread': scenario['spread'] * weights.get('spread', 0) * 100,
                'volatility': scenario['volatility'] * weights.get('volatility', 0) * 100,
                'rl': scenario['rl'] * weights.get('rl', 0) * 100
            }
            
            # 按贡献排序
            sorted_contrib = sorted(contributions.items(), key=lambda x: x[1])
            
            print("  贡献分解:")
            for item, contrib in sorted_contrib:
                pct = contrib / score * 100 if score > 0 else 0
                print(f"    {item:12s}: {contrib:5.1f}pts ({pct:5.1f}%)")
    
    print("\n" + "=" * 60)
    print("🔍 诊断结论")
    print("=" * 60)
    
    print("""
【核心问题】

1. RANGE 模式 volume 权重 30%，但成交量经常不足
2. trend_score 计算: 趋势不对齐时只有 0.3 分
3. 最高评分 70 说明: 某些维度永远达不到满分

【修复方案】

方案 A: 动态阈值 (推荐)
  - RANGE: 50-60 分即可
  - TREND: 65 分
  - BREAKOUT: 60 分

方案 B: 权重调整
  - RANGE 模式降低 volume 权重
  - 提高 momentum/trend 权重

方案 C: 评分函数优化
  - 趋势不对齐时也给基础分
  - 低成交量时给 0.5 基础分
""")

if __name__ == "__main__":
    diagnose_scoring()