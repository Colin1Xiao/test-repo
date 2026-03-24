#!/usr/bin/env python3
"""
Shadow Mode Evaluator - 影子模式评估器 (V4.2)
接收 V4.1 数据流，输出评分结果，不参与真实交易
"""

import json
import pandas as pd
from datetime import datetime
from pathlib import Path
from typing import Dict, Any
import logging

from scoring_engine import ScoringEngine, ScoreBreakdown

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ShadowModeEvaluator:
    """影子模式评估器"""
    
    def __init__(self, config: Dict = None):
        """初始化影子模式评估器"""
        self.config = config or {}
        
        # 创建评分引擎
        self.scoring_engine = ScoringEngine(config)
        
        # 数据记录文件
        self.data_dir = Path(__file__).parent.parent / 'data'
        self.data_dir.mkdir(exist_ok=True)
        
        self.signals_file = self.data_dir / 'shadow_signals.jsonl'
        
        # 统计数据
        self.stats = {
            'total_evaluations': 0,
            'qualified_signals': 0,
            'rejected_signals': 0,
            'avg_score': 0.0,
            'score_distribution': {}
        }
        
        logger.info("✅ 影子模式评估器初始化完成")
        logger.info(f"   数据文件: {self.signals_file}")
    
    def evaluate(self,
                 symbol: str,
                 ohlcv_df: pd.DataFrame,
                 rule_signal: str,
                 current_price: float = None,
                 spread_bps: float = None,
                 volume_ratio: float = None,
                 volatility: float = None,
                 rl_decision: str = None) -> Dict[str, Any]:
        """
        评估市场数据并输出评分
        
        Args:
            symbol: 交易对
            ohlcv_df: OHLCV数据
            rule_signal: V4.1 原规则信号
            current_price: 当前价格
            spread_bps: 点差 (bps)
            volume_ratio: 成交量比率
            volatility: 波动率
            rl_decision: RL决策
            
        Returns:
            评估结果字典
        """
        # 计算评分
        breakdown = self.scoring_engine.calculate_score(
            ohlcv_df=ohlcv_df,
            current_price=current_price,
            spread_bps=spread_bps,
            rl_decision=rl_decision
        )
        
        # 获取当前价格
        if current_price is None:
            current_price = ohlcv_df['close'].iloc[-1]
        
        # 构建评估记录
        record = {
            'timestamp': datetime.now().isoformat(),
            'symbol': symbol,
            'rule_signal': rule_signal,
            'v42_total_score': breakdown.total_score,
            'v42_score_breakdown': {
                'trend_consistency': breakdown.trend_consistency,
                'pullback_breakout': breakdown.pullback_breakout,
                'volume_confirm': breakdown.volume_confirm,
                'spread_quality': breakdown.spread_quality,
                'volatility_range': breakdown.volatility_range,
                'rl_filter': breakdown.rl_filter
            },
            'v42_is_qualified': breakdown.is_qualified,
            'rl_opinion': rl_decision,
            'market_state': {
                'price': current_price,
                'spread_bps': spread_bps,
                'volatility': volatility,
                'volume_ratio': volume_ratio
            }
        }
        
        # 记录到文件
        self._record_signal(record)
        
        # 更新统计
        self._update_stats(breakdown)
        
        # 输出评估结果
        logger.info(
            f"📊 影子评估: {symbol} | "
            f"规则信号: {rule_signal} | "
            f"V4.2评分: {breakdown.total_score}/100 | "
            f"{'✅ 达标' if breakdown.is_qualified else '❌ 未达标'}"
        )
        
        return record
    
    def _record_signal(self, record: Dict[str, Any]):
        """记录候选信号到文件"""
        try:
            with open(self.signals_file, 'a', encoding='utf-8') as f:
                f.write(json.dumps(record, ensure_ascii=False) + '\n')
        except Exception as e:
            logger.error(f"记录候选信号失败: {e}")
    
    def _update_stats(self, breakdown: ScoreBreakdown):
        """更新统计数据"""
        self.stats['total_evaluations'] += 1
        
        if breakdown.is_qualified:
            self.stats['qualified_signals'] += 1
        else:
            self.stats['rejected_signals'] += 1
        
        # 更新平均分
        n = self.stats['total_evaluations']
        old_avg = self.stats['avg_score']
        self.stats['avg_score'] = old_avg + (breakdown.total_score - old_avg) / n
        
        # 更新分数分布
        score_range = breakdown.total_score // 10 * 10
        range_key = f"{score_range}-{score_range+9}"
        self.stats['score_distribution'][range_key] = \
            self.stats['score_distribution'].get(range_key, 0) + 1
    
    def get_stats_report(self) -> str:
        """生成统计报告"""
        report = []
        report.append("=" * 60)
        report.append("📊 影子模式统计报告")
        report.append("=" * 60)
        report.append(f"总评估次数: {self.stats['total_evaluations']}")
        report.append(f"达标信号数: {self.stats['qualified_signals']}")
        report.append(f"拒绝信号数: {self.stats['rejected_signals']}")
        report.append(f"平均评分: {self.stats['avg_score']:.1f}/100")
        report.append("")
        report.append("分数分布:")
        for range_key in sorted(self.stats['score_distribution'].keys()):
            count = self.stats['score_distribution'][range_key]
            report.append(f"  {range_key}: {'█' * (count // 10 or 1)} ({count})")
        report.append("=" * 60)
        
        return "\n".join(report)
    
    def export_stats(self, output_file: str = None):
        """导出统计数据"""
        if output_file is None:
            output_file = self.data_dir / 'shadow_stats.json'
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(self.stats, f, indent=2, ensure_ascii=False)
        
        logger.info(f"✅ 统计数据已导出: {output_file}")


# 测试代码
if __name__ == "__main__":
    import numpy as np
    
    # 创建测试数据
    np.random.seed(42)
    n = 100
    
    prices = 74000 + np.cumsum(np.random.randn(n) * 50)
    
    df = pd.DataFrame({
        'timestamp': pd.date_range('2026-03-17', periods=n, freq='1min'),
        'open': prices + np.random.randn(n) * 10,
        'high': prices + np.abs(np.random.randn(n) * 20),
        'low': prices - np.abs(np.random.randn(n) * 20),
        'close': prices + np.random.randn(n) * 10,
        'volume': np.random.randint(100, 1000, n)
    })
    
    # 创建影子模式评估器
    evaluator = ShadowModeEvaluator()
    
    # 模拟多次评估
    test_cases = [
        {'symbol': 'BTC/USDT:USDT', 'rule_signal': 'HOLD', 'spread_bps': 3.5, 'volume_ratio': 1.8, 'volatility': 0.01, 'rl_decision': 'ALLOW'},
        {'symbol': 'BTC/USDT:USDT', 'rule_signal': 'BUY', 'spread_bps': 2.0, 'volume_ratio': 2.5, 'volatility': 0.008, 'rl_decision': 'ALLOW'},
        {'symbol': 'BTC/USDT:USDT', 'rule_signal': 'SELL', 'spread_bps': 8.0, 'volume_ratio': 0.8, 'volatility': 0.03, 'rl_decision': 'REJECT'},
    ]
    
    for case in test_cases:
        result = evaluator.evaluate(
            ohlcv_df=df,
            **case
        )
        print()
    
    # 输出统计报告
    print(evaluator.get_stats_report())