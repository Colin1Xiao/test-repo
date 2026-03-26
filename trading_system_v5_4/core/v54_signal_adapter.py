#!/usr/bin/env python3
"""
V5.4.1 信号链 Adapter

功能：将 V5.3 run_v52_live.py 的信号输出适配到 V5.4.1 L1/L2/L3 链

输入 (来自 V5.3):
- symbol
- score (总分)
- volume_ratio
- price_change
- regime
- spread_bps (默认 2.0)

输出 (到 V5.4.1):
- L1: trend_consistency, pullback_breakout, volume_confirm
- L2: spread_bps, volatility, price_age_seconds, price_jump_bps
- L3: signal_score, signal_bucket
"""

import time
from typing import Dict, Any, Optional, Tuple
from pathlib import Path

# 导入 V5.4.1 信号链
from signal_filter_v54 import get_signal_filter
from signal_scorer_v54 import get_signal_scorer


class V54SignalAdapter:
    """
    V5.4.1 信号链适配器
    
    将 V5.3 信号转换为 V5.4.1 格式
    """
    
    def __init__(self, config_path: str = None):
        self.config_path = config_path or '/Users/colin/.openclaw/workspace/trading_system_v5_4/config/signal_config_v54.json'
        
        # 初始化 V5.4.1 组件
        self.signal_filter = get_signal_filter(self.config_path)
        self.signal_scorer = get_signal_scorer(self.config_path)
        
        # 统计
        self.stats = {
            'candidate_signals': 0,
            'l2_rejected': 0,
            'l3_rejected': 0,
            'trades_allowed': 0
        }
        
        # 上次价格用于计算跳变
        self.last_price: Optional[float] = None
        self.last_price_time: Optional[float] = None
    
    def adapt_v53_signal(
        self,
        symbol: str,
        score: float,
        volume_ratio: float,
        price_change: float,
        regime: str,
        current_price: float,
        spread_bps: float = 2.0
    ) -> Tuple[bool, str, Dict[str, Any]]:
        """
        适配 V5.3 信号到 V5.4.1 链
        
        Args:
            symbol: 交易对
            score: V5.3 评分 (0-100)
            volume_ratio: 成交量比率
            price_change: 价格变化 (5 周期)
            regime: 市场状态
            current_price: 当前价格
            spread_bps: 点差 (bps)
        
        Returns:
            (allowed, reason, context)
            allowed=True 才允许执行
        """
        self.stats['candidate_signals'] += 1
        
        # ========== L1: 候选信号转换 ==========
        # 将 V5.3 分数转换为 V5.4.1 因子
        l1_factors = self._v53_to_l1_factors(score, volume_ratio, price_change, regime)
        
        # ========== L2: 硬过滤 ==========
        # 计算 L2 所需参数
        volatility = abs(price_change)  # 简化：用价格变化代表波动率
        price_age_seconds = 1.0  # 假设价格实时更新
        price_jump_bps = self._calculate_price_jump(current_price)
        
        # 执行 L2 检查
        l2_passed, l2_reason, l2_details = self.signal_filter.check(
            symbol=symbol,
            side='buy',  # 简化：假设只做多
            spread_bps=spread_bps,
            volatility=volatility,
            price_age_seconds=price_age_seconds,
            price_jump_bps=price_jump_bps,
            volume_ratio=volume_ratio
        )
        
        if not l2_passed:
            self.stats['l2_rejected'] += 1
            return False, f"L2_HARD_FILTER: {l2_reason}", {
                'l2_passed': False,
                'l2_reason': l2_reason,
                'l2_details': l2_details,
                'l1_factors': l1_factors
            }
        
        # ========== L3: 评分放行 ==========
        # 使用 V5.4.1 评分器重新评分
        l3_result = self.signal_scorer.evaluate(
            trend_consistency=l1_factors['trend_consistency'],
            pullback_breakout=l1_factors['pullback_breakout'],
            volume_confirm=l1_factors['volume_confirm'],
            spread_quality=l1_factors['spread_quality'],
            volatility_range=l1_factors['volatility_range'],
            rl_filter=l1_factors['rl_filter']
        )
        
        # 检查是否允许交易
        if not l3_result['allow_trade']:
            self.stats['l3_rejected'] += 1
            return False, f"L3_SCORE: {l3_result['reason']}", {
                'l2_passed': True,
                'l3_result': l3_result,
                'l1_factors': l1_factors,
                'l2_details': l2_details
            }
        
        # ========== 通过所有检查 ==========
        self.stats['trades_allowed'] += 1
        
        return True, "V5.4.1_SIGNAL_PASS", {
            'l2_passed': True,
            'l3_result': l3_result,
            'l1_factors': l1_factors,
            'l2_details': l2_details,
            'signal_score': l3_result['score'],
            'signal_bucket': l3_result['bucket'],
            'rejection_reason': None
        }
    
    def _v53_to_l1_factors(
        self,
        score: float,
        volume_ratio: float,
        price_change: float,
        regime: str
    ) -> Dict[str, float]:
        """
        将 V5.3 信号转换为 V5.4.1 L1 因子
        
        简化映射：
        - trend_consistency: score / 100 * regime 权重
        - pullback_breakout: 基于 price_change
        - volume_confirm: volume_ratio 归一化
        - spread_quality: 默认 0.8 (假设点差正常)
        - volatility_range: 基于 price_change 是否在合理范围
        - rl_filter: 默认 0.5
        """
        # Regime 权重
        regime_weights = {
            'trend': 1.0,
            'range': 0.7,
            'breakout': 0.9
        }
        regime_weight = regime_weights.get(regime, 0.8)
        
        # 趋势一致性 (V5.3 分数 * regime 权重)
        trend_consistency = min(1.0, (score / 100) * regime_weight)
        
        # 回调突破 (基于价格变化，假设正向变化是突破信号)
        pullback_breakout = min(1.0, max(0.0, 0.5 + price_change * 10))
        
        # 成交量确认 (归一化 volume_ratio)
        volume_confirm = min(1.0, volume_ratio / 2.0)  # 假设 2.0x 是理想值
        
        # 点差质量 (默认 0.8，假设点差正常)
        spread_quality = 0.8
        
        # 波动率范围 (检查 price_change 是否在合理范围)
        vol_abs = abs(price_change)
        if 0.001 <= vol_abs <= 0.02:  # 0.1% - 2%
            volatility_range = 1.0
        elif vol_abs < 0.001:
            volatility_range = 0.3  # 波动率太低
        else:
            volatility_range = 0.5  # 波动率太高
        
        # RL 过滤 (默认 0.5)
        rl_filter = 0.5
        
        return {
            'trend_consistency': trend_consistency,
            'pullback_breakout': pullback_breakout,
            'volume_confirm': volume_confirm,
            'spread_quality': spread_quality,
            'volatility_range': volatility_range,
            'rl_filter': rl_filter
        }
    
    def _calculate_price_jump(self, current_price: float) -> float:
        """计算价格跳变 (bps)"""
        if self.last_price is None:
            self.last_price = current_price
            self.last_price_time = time.time()
            return 0.0
        
        # 计算跳变 (bps)
        jump_bps = abs((current_price - self.last_price) / self.last_price) * 10000
        
        # 更新上次价格
        self.last_price = current_price
        self.last_price_time = time.time()
        
        return jump_bps
    
    def get_stats(self) -> Dict[str, int]:
        """获取统计信息"""
        return self.stats.copy()
    
    def record_exit(self, side: str, pnl: float):
        """记录退出事件 (用于 cooldown)"""
        self.signal_filter.record_exit(side, pnl)


# 全局单例
_adapter_instance = None

def get_v54_adapter(config_path: str = None) -> V54SignalAdapter:
    """获取 V5.4.1 Adapter 单例"""
    global _adapter_instance
    if _adapter_instance is None:
        _adapter_instance = V54SignalAdapter(config_path)
    return _adapter_instance
