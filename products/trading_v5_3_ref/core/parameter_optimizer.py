#!/usr/bin/env python3
"""
Parameter Optimizer - 参数自适应优化器

核心功能：
1. 根据反馈自动调整参数
2. 离散调整（不是连续变化）
3. 限制调整幅度（防止失控）
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
from pathlib import Path
import json
import copy


class ParameterOptimizer:
    """
    参数自适应优化器
    
    核心原则：
    1. 离散调整 - 不是连续变化
    2. 限制幅度 - 每次调整有上限
    3. 需要足够样本 - 至少20笔交易
    """
    
    def __init__(self, config: Dict[str, Any] = None):
        """
        初始化优化器
        """
        self.config = config or self._default_config()
        self.original_config = copy.deepcopy(self.config)
        
        # 调整限制
        self.min_sample_size = 20        # 最小样本数
        self.max_score_adjustment = 10    # 最大评分阈值调整
        self.max_volume_adjustment = 0.3  # 最大成交量阈值调整
        
        # 调整历史
        self.adjustment_history = []
        
        print("🔧 Parameter Optimizer 初始化完成")
        print(f"   最小样本数: {self.min_sample_size}")
        print(f"   最大评分调整: ±{self.max_score_adjustment}")
        print(f"   最大成交量调整: ±{self.max_volume_adjustment}")
    
    def _default_config(self) -> Dict[str, Any]:
        """默认配置"""
        return {
            "range": {
                "min_score": 80,
                "min_volume": 1.2,
                "take_profit": 0.002,
                "max_hold": 30
            },
            "trend": {
                "min_score": 65,
                "min_volume": 0.6,
                "take_profit": 0.004,
                "max_hold": 90
            },
            "breakout": {
                "min_score": 60,
                "min_volume": 0.5,
                "take_profit": 0.006,
                "max_hold": 120
            }
        }
    
    def adjust(self, stats: Dict[str, Any]) -> Dict[str, Any]:
        """
        根据统计自动调整参数
        
        Args:
            stats: 各Regime的统计 {
                'range': {'avg_signal_quality': 0.5, 'execution_score': 0.8, ...},
                'trend': {...},
                'breakout': {...}
            }
        
        Returns:
            调整后的配置
        """
        adjustments = {}
        
        for regime, regime_stats in stats.items():
            if regime not in self.config:
                continue
            
            sample_count = regime_stats.get('count', 0)
            
            # 样本不足
            if sample_count < self.min_sample_size:
                adjustments[regime] = {
                    'action': 'WAIT',
                    'reason': f"样本不足({sample_count}<{self.min_sample_size})"
                }
                continue
            
            regime_adjustments = []
            current_config = self.config[regime]
            original_config = self.original_config[regime]
            
            # 1. 信号质量调整
            signal_quality = regime_stats.get('avg_signal_quality', 0)
            
            if signal_quality < 0:
                # 信号质量为负 → 提高阈值
                new_score = min(
                    current_config['min_score'] + 5,
                    original_config['min_score'] + self.max_score_adjustment
                )
                if new_score != current_config['min_score']:
                    regime_adjustments.append(f"评分阈值: {current_config['min_score']} → {new_score}")
                    current_config['min_score'] = new_score
            
            elif signal_quality > 0.5:
                # 信号质量高 → 可以降低阈值
                new_score = max(
                    current_config['min_score'] - 2,
                    original_config['min_score'] - self.max_score_adjustment
                )
                if new_score != current_config['min_score']:
                    regime_adjustments.append(f"评分阈值: {current_config['min_score']} → {new_score}")
                    current_config['min_score'] = new_score
            
            # 2. 执行质量调整
            execution_score = regime_stats.get('execution_score', 0) or regime_stats.get('avg_execution_quality', 0)
            
            if execution_score < 0.7:
                # 执行质量差 → 提高成交量要求
                new_volume = min(
                    current_config['min_volume'] + 0.2,
                    original_config['min_volume'] + self.max_volume_adjustment
                )
                if new_volume != current_config['min_volume']:
                    regime_adjustments.append(f"成交量阈值: {current_config['min_volume']} → {new_volume}")
                    current_config['min_volume'] = new_volume
            
            # 记录调整
            if regime_adjustments:
                adjustments[regime] = {
                    'action': 'ADJUSTED',
                    'changes': regime_adjustments
                }
                print(f"\n🔧 {regime.upper()} 参数调整:")
                for change in regime_adjustments:
                    print(f"   {change}")
                
                self.adjustment_history.append({
                    'timestamp': datetime.now().isoformat(),
                    'regime': regime,
                    'changes': regime_adjustments
                })
            else:
                adjustments[regime] = {
                    'action': 'NO_CHANGE',
                    'reason': '表现正常'
                }
        
        return {
            'config': self.config,
            'adjustments': adjustments
        }
    
    def get_config(self, regime: str) -> Dict[str, Any]:
        """获取指定Regime的当前配置"""
        return self.config.get(regime, self._default_config().get(regime, {}))
    
    def reset(self):
        """重置到原始配置"""
        self.config = copy.deepcopy(self.original_config)
        print("⚠️  参数已重置到原始配置")
    
    def get_adjustment_history(self, limit: int = 10) -> List[Dict]:
        """获取调整历史"""
        return self.adjustment_history[-limit:]


# 创建默认实例
_default_optimizer = None

def get_optimizer() -> ParameterOptimizer:
    """获取全局优化器实例"""
    global _default_optimizer
    if _default_optimizer is None:
        _default_optimizer = ParameterOptimizer()
    return _default_optimizer