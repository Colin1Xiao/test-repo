#!/usr/bin/env python3
"""
Testnet 高级监控器
新增：70+频率监控，判断市场状态切换
"""

import asyncio
import sys
from pathlib import Path
from datetime import datetime
from collections import deque
import json

sys.path.insert(0, str(Path(__file__).parent / 'core'))

from enhanced_analyzer import EnhancedAnalyzer
from scoring_engine_v423 import ScoringEngineV423
from environment_filter_v1 import EnvironmentFilterV1, EnvironmentContext


class TestnetAdvancedMonitor(EnhancedAnalyzer):
    """
    Testnet 高级监控器
    
    核心指标：70+频率（最近30次检查中>=70分的比例）
    
    判断逻辑：
    - <5%: ❄️ 冷市场
    - 5-15%: ⚠️ 结构开始
    - 15-30%: 🔥 即将爆发
    - >30%: 🚀 高概率连续信号
    """
    
    def __init__(self):
        symbols = ['BTC/USDT:USDT', 'ETH/USDT:USDT']
        super().__init__(symbols=symbols)
        
        self.scoring_engine = ScoringEngineV423()
        self.env_filter = EnvironmentFilterV1()
        
        self.threshold = 85
        self.high_score_window = 30  # 最近30次检查
        self.score_history = deque(maxlen=self.high_score_window)
        
        self.cycle_count = 0
        self.signal_triggered = 0
        
        print("=" * 80)
        print("🚀 Testnet 高级监控器")
        print("=" * 80)
        print("📋 核心指标: 70+频率（最近30次检查中>=70分的比例）")
        print("")
        print("🎯 市场状态判断:")
        print("  <5%   ❄️  冷市场")
        print("  5-15% ⚠️  结构开始")
        print("  15-30%🔥  即将爆发")
        print("  >30%  🚀 高概率连续信号")
        print("")
    
    def _extract_hour(self, timestamp: str) -> int:
        try:
            if ' ' in timestamp:
                return int(timestamp.split(' ')[1].split(':')[0])
            return 0
        except:
            return 0
    
    def _calc_volume_ratio(self, df) -> float:
        try:
            current_vol = df['volume'].iloc[-1]
            avg_vol = df['volume'].tail(20).mean()
            return float(current_vol / avg_vol) if avg_vol > 0 else 0.0
        except:
            return 0.0
    
    def _get_market_state(self, high_score_freq: float) -> tuple:
        """
        根据70+频率判断市场状态
        
        Returns:
            (emoji, state, description)
        """
        if high_score_freq < 5:
            return "❄️", "COLD", "冷市场"
        elif high_score_freq < 15:
            return "⚠️", "STRUCTURE_FORMING", "结构开始"
        elif high_score_freq < 30:
            return "🔥", "APPROACHING_BURST", "即将爆发"
        else:
            return "🚀", "HIGH_PROBABILITY", "高概率连续信号"
    
    async def monitor_cycle(self):
        """监控一个周期"""
        for symbol in self.symbols:
            df = await self.fetch_historical_ohlcv(symbol, hours=1)
            if df is None or len(df) < 30:
                continue
            
            current = df.iloc[-1]
            window = df.tail(30)
            
            # 评分
            score_breakdown = self.scoring_engine.calculate_score(
                ohlcv_df=window,
                current_price=current['close'],
                spread_bps=2.0,
                rl_decision='ALLOW'
            )
            
            score = score_breakdown.total_score
            self.score_history.append(score)
            self.cycle_count += 1
            
            # 计算70+频率
            if len(self.score_history) > 0:
                high_score_count = sum(1 for s in self.score_history if s >= 70)
                high_score_freq = high_score_count / len(self.score_history) * 100
            else:
                high_score_freq = 0
            
            # 获取市场状态
            emoji, state, desc = self._get_market_state(high_score_freq)
            
            # 环境参数
            hour = self._extract_hour(str(current['timestamp']))
            volume_ratio = self._calc_volume_ratio(window)
            
            # 输出
            gap = self.threshold - score
            status_emoji = "🔥" if score >= 85 else "🟡" if score >= 80 else "⚠️" if score >= 70 else "❌"
            
            print(f"{status_emoji} {symbol} | Score: {score:2d} | Gap: {gap:2d} | "
                  f"70+Freq: {high_score_freq:5.1f}% {emoji} | {desc}")
            
            # 如果触发阈值
            if score >= 85:
                self.signal_triggered += 1
                print(f"   🔥🔥🔥 交易信号触发！#{self.signal_triggered}")
                
                # 环境过滤检查
                context = EnvironmentContext(
                    symbol=symbol,
                    timestamp=str(current['timestamp']),
                    hour=hour,
                    volume_ratio=volume_ratio,
                    consecutive_stop_loss=self.env_filter.consecutive_losses
                )
                
                filter_result = self.env_filter.evaluate(context)
                
                if filter_result.decision == "ALLOW":
                    print(f"   ✅ 环境检查通过，准备执行...")
                else:
                    print(f"   🚫 被过滤: {filter_result.reason}")
    
    def generate_advanced_report(self) -> str:
        """生成高级监控报告"""
        lines = []
        lines.append("=" * 80)
        lines.append("📊 Testnet 高级监控报告")
        lines.append("=" * 80)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"总监控周期: {self.cycle_count}")
        lines.append(f"交易信号触发: {self.signal_triggered}")
        lines.append("")
        
        if not self.score_history:
            lines.append("暂无监控数据")
            return "\n".join(lines)
        
        # 70+频率
        high_score_count = sum(1 for s in self.score_history if s >= 70)
        high_score_freq = high_score_count / len(self.score_history) * 100
        
        emoji, state, desc = self._get_market_state(high_score_freq)
        
        lines.append("─" * 80)
        lines.append("🎯 核心指标: 70+频率")
        lines.append("─" * 80)
        lines.append(f"最近{len(self.score_history)}次检查:")
        lines.append(f"  >=70分次数: {high_score_count}")
        lines.append(f"  70+频率: {high_score_freq:.1f}%")
        lines.append(f"  市场状态: {emoji} {state} ({desc})")
        lines.append("")
        
        # Score分布
        lines.append("─" * 80)
        lines.append("📊 Score分布（最近30次）")
        lines.append("─" * 80)
        
        ranges = [
            (0, 60, "❌ 无结构 (0-60)"),
            (60, 70, "⚠️ 弱结构 (60-70)"),
            (70, 80, "🟡 接近机会 (70-80)"),
            (80, 85, "🔥 即将触发 (80-85)"),
            (85, 100, "🚀 已触发 (85+)")
        ]
        
        for min_s, max_s, label in ranges:
            count = sum(1 for s in self.score_history if min_s <= s < max_s)
            pct = count / len(self.score_history) * 100
            lines.append(f"  {label}: {count:3d} ({pct:5.1f}%)")
        
        lines.append("")
        
        # 最新状态
        lines.append("─" * 80)
        lines.append("📊 最新市场状态")
        lines.append("─" * 80)
        
        latest_scores = list(self.score_history)[-6:] if len(self.score_history) >= 6 else list(self.score_history)
        lines.append(f"最近{len(latest_scores)}次Score: {latest_scores}")
        lines.append("")
        
        # 预判
        lines.append("=" * 80)
        lines.append("🔮 市场状态预判")
        lines.append("=" * 80)
        
        if high_score_freq < 5:
            lines.append("❄️ 冷市场")
            lines.append("  当前无结构，继续等待")
        elif high_score_freq < 15:
            lines.append("⚠️ 结构开始")
            lines.append("  70+开始出现，市场正在形成局部结构")
            lines.append("  继续监控，等待频率上升到15%+")
        elif high_score_freq < 30:
            lines.append("🔥 即将爆发")
            lines.append("  70+频率较高，市场接近状态切换")
            lines.append("  高概率在1-3个周期内出现>=85信号")
        else:
            lines.append("🚀 高概率连续信号")
            lines.append("  70+频率很高，市场处于活跃状态")
            lines.append("  预计会有连续信号出现")
        
        lines.append("")
        lines.append("💡 交易心态:")
        lines.append("  - 不是等'一个信号'，而是等'市场状态切换'")
        lines.append("  - 当前状态切换概率: " + ("低" if high_score_freq < 5 else "中" if high_score_freq < 15 else "高" if high_score_freq < 30 else "很高"))
        lines.append("=" * 80)
        
        return "\n".join(lines)


async def main():
    """主函数"""
    monitor = TestnetAdvancedMonitor()
    
    print("🚀 启动高级监控...")
    print("运行50个周期，监控70+频率变化...\n")
    
    for i in range(50):
        print(f"--- 周期 {i+1}/50 ---")
        await monitor.monitor_cycle()
        await asyncio.sleep(0.5)
    
    # 生成报告
    report = monitor.generate_advanced_report()
    print("\n" + report)
    
    # 保存报告
    report_file = monitor.data_dir / 'testnet_advanced_report.txt'
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(f"\n✅ 报告已保存: {report_file}")


if __name__ == "__main__":
    asyncio.run(main())
