#!/usr/bin/env python3
"""
Signal Quality Evaluator - 信号质量评估器

后验评估：这个信号是否值得做
不是看赚没赚，而是看信号质量
"""

from dataclasses import dataclass
from typing import Dict, Any, Optional
from datetime import datetime


@dataclass
class SignalQualityReport:
    """信号质量报告"""
    total_score: float
    pnl_score: float
    direction_score: float
    drawdown_penalty: float
    time_score: float
    
    is_high_quality: bool
    recommendation: str  # VALID / MARGINAL / INVALID
    
    def __str__(self):
        status = "✅ 高质量" if self.is_high_quality else "⚠️ 边缘" if self.total_score > 0 else "❌ 低质量"
        return f"信号质量: {self.total_score:.2f} {status}"


class SignalQualityEvaluator:
    """
    信号质量评估器
    
    核心逻辑：
    1. 后验表现 (40%) - 盈亏是结果，但不是唯一标准
    2. 方向正确性 (30%) - 判断方向是否正确
    3. 回撤惩罚 (20%) - 最大浮亏是否可接受
    4. 时间稳定性 (10%) - 持仓时间是否合理
    """
    
    def __init__(self, config: Dict[str, Any] = None):
        """
        初始化评估器
        
        Args:
            config: 配置参数
        """
        self.config = config or {}
        
        # 权重
        self.weights = {
            'pnl': 0.40,
            'direction': 0.30,
            'drawdown': 0.20,
            'time': 0.10
        }
        
        # 阈值
        self.high_quality_threshold = 0.5
        self.marginal_threshold = 0.0
        
        # 统计
        self.evaluation_history = []
        
        print("📊 Signal Quality Evaluator 初始化完成")
        print(f"   高质量阈值: {self.high_quality_threshold}")
        print(f"   权重: PnL={self.weights['pnl']}, 方向={self.weights['direction']}, 回撤={self.weights['drawdown']}, 时间={self.weights['time']}")
    
    def evaluate(self, trade: Dict[str, Any]) -> SignalQualityReport:
        """
        评估信号质量
        
        Args:
            trade: 交易记录，需包含:
                - net_pnl: 净盈亏 (小数, 如0.01 = 1%)
                - max_drawdown: 最大浮亏 (小数, 如-0.005 = -0.5%)
                - holding_time: 持仓时间 (秒)
                - entry_price: 入场价
                - exit_price: 出场价
        
        Returns:
            SignalQualityReport
        """
        # 1. 盈亏分数 (-1 到 1)
        net_pnl = trade.get('net_pnl', 0)
        pnl_score = min(max(net_pnl * 100, -1), 1)  # 放大100倍后限制范围
        
        # 2. 方向分数 (-1 或 1)
        direction_score = 1 if net_pnl > 0 else -1
        
        # 3. 回撤惩罚 (负值，越小越惩罚)
        max_drawdown = trade.get('max_drawdown', 0)
        drawdown_penalty = -abs(max_drawdown) * 2  # 放大2倍惩罚
        
        # 4. 时间分数
        holding_time = trade.get('holding_time', 0)
        # 理想持仓时间：10-60秒
        if 10 <= holding_time <= 60:
            time_score = 1.0
        elif holding_time < 10:
            time_score = 0.5  # 太短可能运气
        else:
            time_score = -0.5  # 太长有风险
        
        # 加权总分
        total_score = (
            pnl_score * self.weights['pnl'] +
            direction_score * self.weights['direction'] +
            drawdown_penalty * self.weights['drawdown'] +
            time_score * self.weights['time']
        )
        
        # 判断质量
        if total_score >= self.high_quality_threshold:
            is_high_quality = True
            recommendation = "VALID"
        elif total_score >= self.marginal_threshold:
            is_high_quality = False
            recommendation = "MARGINAL"
        else:
            is_high_quality = False
            recommendation = "INVALID"
        
        report = SignalQualityReport(
            total_score=total_score,
            pnl_score=pnl_score,
            direction_score=direction_score,
            drawdown_penalty=drawdown_penalty,
            time_score=time_score,
            is_high_quality=is_high_quality,
            recommendation=recommendation
        )
        
        # 记录历史
        self.evaluation_history.append({
            'timestamp': datetime.now().isoformat(),
            'total_score': total_score,
            'recommendation': recommendation,
            'trade': trade
        })
        
        return report
    
    def get_stats(self, last_n: int = 20) -> Dict[str, Any]:
        """获取最近N笔交易的统计"""
        if not self.evaluation_history:
            return {}
        
        recent = self.evaluation_history[-last_n:]
        
        scores = [e['total_score'] for e in recent]
        valid_count = sum(1 for e in recent if e['recommendation'] == 'VALID')
        marginal_count = sum(1 for e in recent if e['recommendation'] == 'MARGINAL')
        
        return {
            'count': len(recent),
            'avg_score': sum(scores) / len(scores) if scores else 0,
            'valid_rate': valid_count / len(recent) if recent else 0,
            'marginal_rate': marginal_count / len(recent) if recent else 0,
            'high_quality_rate': sum(1 for s in scores if s >= self.high_quality_threshold) / len(scores) if scores else 0
        }


# 创建默认实例
_default_evaluator = None

def get_evaluator() -> SignalQualityEvaluator:
    """获取全局评估器实例"""
    global _default_evaluator
    if _default_evaluator is None:
        _default_evaluator = SignalQualityEvaluator()
    return _default_evaluator