#!/usr/bin/env python3
"""
V4.3 影子模式测试 - 验证Regime驱动策略

目标：
1. 验证Regime检测准确性
2. 对比V4.2 vs V4.3捕捉率
3. 记录信号但不执行交易
"""

import asyncio
import sys
import os
from pathlib import Path
from datetime import datetime
import json

sys.path.insert(0, str(Path(__file__).parent / 'core'))
os.environ['https_proxy'] = 'http://127.0.0.1:7890'

from regime.regime_detector import RegimeDetector
from regime.regime_types import MarketRegime
from strategy.strategy_selector import StrategySelector
from scoring_engine_v43 import ScoringEngineV43
from enhanced_analyzer import EnhancedAnalyzer


class V43ShadowTest:
    """V4.3影子模式测试"""
    
    def __init__(self):
        self.regime_detector = RegimeDetector()
        self.strategy_selector = StrategySelector()
        self.scoring_engine = ScoringEngineV43(default_threshold=70)  # 动态阈值
        self.analyzer = EnhancedAnalyzer(symbols=['BTC/USDT:USDT', 'ETH/USDT:USDT'])
        
        # 统计
        self.stats = {
            'total_cycles': 0,
            'regime_counts': {'range': 0, 'trend': 0, 'breakout': 0},
            'signals_v43': 0,
            'signals_v42': 0,  # 对比：V4.2固定阈值80分
            'signals_by_regime': {'range': 0, 'trend': 0, 'breakout': 0},
            'missed_opportunities': []
        }
        
        print("\n" + "=" * 60)
        print("🧪 V4.3 影子模式测试")
        print("=" * 60)
    
    async def run_cycle(self, symbol: str):
        """运行一个测试周期"""
        self.stats['total_cycles'] += 1
        
        # 获取数据
        df = await self.analyzer.fetch_historical_ohlcv(symbol, hours=1)
        if df is None or len(df) < 60:
            return
        
        current_price = df['close'].iloc[-1]
        
        # ========== V4.3核心流程 ==========
        
        # 1. Regime检测
        regime = self.regime_detector.detect(df)
        self.stats['regime_counts'][regime.value] += 1
        
        # 2. 策略选择
        config = self.strategy_selector.select(regime)
        
        # 3. 评分（动态权重）
        score = self.scoring_engine.calculate_score(
            ohlcv_df=df,
            current_price=current_price,
            spread_bps=2.0,
            rl_decision='ALLOW',
            regime=regime
        )
        
        # 4. 成交量
        volume_ratio = df['volume'].iloc[-1] / df['volume'].rolling(20).mean().iloc[-1]
        
        # 5. 判断
        should_trade, reason = self.strategy_selector.should_trade(
            score.total_score,
            volume_ratio
        )
        
        # ========== V4.2对比（固定阈值80分） ==========
        
        v42_qualified = score.total_score >= 80 and volume_ratio >= 1.2
        
        # ========== 记录 ==========
        
        if should_trade:
            self.stats['signals_v43'] += 1
            self.stats['signals_by_regime'][regime.value] += 1
            
            print(f"\n{regime.emoji()} {symbol} V4.3信号!")
            print(f"   评分: {score.total_score}/100 (阈值{config['min_score']})")
            print(f"   成交量: {volume_ratio:.2f}x (阈值{config['min_volume']})")
        
        if v42_qualified:
            self.stats['signals_v42'] += 1
        
        # 记录错过的机会（V4.3捕获但V4.2错过）
        if should_trade and not v42_qualified:
            self.stats['missed_opportunities'].append({
                'symbol': symbol,
                'regime': regime.value,
                'score': score.total_score,
                'volume_ratio': volume_ratio,
                'timestamp': datetime.now().isoformat()
            })
    
    async def run(self, cycles: int = 100, interval: int = 2):
        """运行测试"""
        print(f"\n开始 {cycles} 个周期测试...")
        print(f"间隔: {interval}秒\n")
        
        for i in range(cycles):
            print(f"\r周期 {i+1}/{cycles} | Regime: {self.regime_detector.current_regime.emoji()} {self.regime_detector.current_regime.value}", end='')
            
            for symbol in ['BTC/USDT:USDT', 'ETH/USDT:USDT']:
                await self.run_cycle(symbol)
            
            await asyncio.sleep(interval)
        
        print("\n\n" + "=" * 60)
        self.print_report()
    
    def print_report(self):
        """打印测试报告"""
        print("📊 V4.3 影子模式测试报告")
        print("=" * 60)
        
        print(f"\n总周期数: {self.stats['total_cycles']}")
        
        print(f"\n📋 Regime分布:")
        for regime, count in self.stats['regime_counts'].items():
            emoji = MarketRegime(regime).emoji()
            pct = count / max(1, self.stats['total_cycles']) * 100
            print(f"   {emoji} {regime}: {count} ({pct:.1f}%)")
        
        print(f"\n📊 信号捕捉对比:")
        print(f"   V4.2 (固定80分): {self.stats['signals_v42']} 个信号")
        print(f"   V4.3 (动态阈值): {self.stats['signals_v43']} 个信号")
        
        improvement = self.stats['signals_v43'] - self.stats['signals_v42']
        print(f"   改进: {'+' if improvement > 0 else ''}{improvement} 个信号")
        
        print(f"\n📋 V4.3信号按Regime分布:")
        for regime, count in self.stats['signals_by_regime'].items():
            emoji = MarketRegime(regime).emoji()
            print(f"   {emoji} {regime}: {count} 个")
        
        print(f"\n🎯 V4.2错过的机会（V4.3捕获）: {len(self.stats['missed_opportunities'])} 个")
        
        if self.stats['missed_opportunities']:
            print("\n   最近5个:")
            for opp in self.stats['missed_opportunities'][-5:]:
                print(f"   - {opp['symbol']} | {opp['regime']} | 评分{opp['score']} | 成交量{opp['volume_ratio']:.2f}x")
        
        print("\n" + "=" * 60)


async def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='V4.3影子模式测试')
    parser.add_argument('--cycles', type=int, default=50, help='测试周期数')
    parser.add_argument('--interval', type=int, default=2, help='周期间隔(秒)')
    
    args = parser.parse_args()
    
    test = V43ShadowTest()
    await test.run(cycles=args.cycles, interval=args.interval)


if __name__ == "__main__":
    asyncio.run(main())