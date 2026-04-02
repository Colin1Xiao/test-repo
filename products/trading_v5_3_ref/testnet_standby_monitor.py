#!/usr/bin/env python3
"""
Testnet 待命监控器
Signal Proximity Monitor - 信号接近度监控
目标：让系统在真实市场"待命"，记录市场状态变化
"""

import asyncio
import sys
from pathlib import Path
from datetime import datetime
import json

sys.path.insert(0, str(Path(__file__).parent / 'core'))

from enhanced_analyzer import EnhancedAnalyzer
from scoring_engine_v423 import ScoringEngineV423
from environment_filter_v1 import EnvironmentFilterV1, EnvironmentContext


class TestnetStandbyMonitor(EnhancedAnalyzer):
    """
    Testnet 待命监控器
    
    功能：
    1. 监控 Score 接近度（gap_to_threshold = 85 - score）
    2. 记录市场状态变化
    3. 当 score >= 85 时触发交易
    4. 持续记录 execution 数据
    
    心态：
    - 不是期待立刻交易
    - 而是等待机会出现时完美执行
    """
    
    def __init__(self):
        symbols = ['BTC/USDT:USDT', 'ETH/USDT:USDT']
        super().__init__(symbols=symbols)
        
        self.scoring_engine = ScoringEngineV423()
        self.env_filter = EnvironmentFilterV1()
        
        self.threshold = 85
        self.proximity_log = []
        self.trade_count = 0
        
        print("=" * 80)
        print("🚀 Testnet 待命监控器")
        print("=" * 80)
        print("📋 模式: 待命监控，等待市场机会")
        print("")
        print("🎯 监控目标:")
        print(f"  - 阈值: {self.threshold}分")
        print("  - Score 50-60: ❌ 无结构")
        print("  - Score 60-70: ⚠️ 弱结构")
        print("  - Score 70-80: 🟡 接近机会")
        print("  - Score 80+: 🔥 即将触发")
        print("")
        print("💡 心态:")
        print("  - 不是期待立刻交易")
        print("  - 而是等待机会出现时完美执行")
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
    
    def _get_proximity_status(self, score: int) -> tuple:
        """
        获取接近度状态
        
        Returns:
            (emoji, status, gap)
        """
        gap = self.threshold - score
        
        if score >= 85:
            return "🔥", "TRIGGERED", gap
        elif score >= 80:
            return "🟡", "APPROACHING", gap
        elif score >= 70:
            return "⚠️", "WEAK_STRUCTURE", gap
        elif score >= 60:
            return "❌", "NO_STRUCTURE", gap
        else:
            return "❌", "NO_STRUCTURE", gap
    
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
            emoji, status, gap = self._get_proximity_status(score)
            
            # 环境参数
            hour = self._extract_hour(str(current['timestamp']))
            volume_ratio = self._calc_volume_ratio(window)
            
            # 记录接近度
            proximity_record = {
                'timestamp': datetime.now().isoformat(),
                'symbol': symbol,
                'price': float(current['close']),
                'score': score,
                'gap_to_threshold': gap,
                'status': status,
                'hour': hour,
                'volume_ratio': volume_ratio,
                'is_qualified': score_breakdown.is_qualified
            }
            
            self.proximity_log.append(proximity_record)
            
            # 输出
            print(f"{emoji} {symbol} | Score: {score:2d}/100 | Gap: {gap:2d} | {status:15s} | Vol: {volume_ratio:.2f}x")
            
            # 如果触发阈值，记录交易机会
            if score >= 85:
                print(f"   🔥🔥🔥 交易信号触发！Score: {score}")
                self.trade_count += 1
                
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
                    print(f"   ✅ 环境检查通过，准备执行交易...")
                    # TODO: 执行交易
                else:
                    print(f"   🚫 被过滤: {filter_result.reason}")
    
    def generate_standby_report(self) -> str:
        """生成待命报告"""
        lines = []
        lines.append("=" * 80)
        lines.append("📊 Testnet 待命监控报告")
        lines.append("=" * 80)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"总监控次数: {len(self.proximity_log)}")
        lines.append(f"交易信号触发: {self.trade_count}")
        lines.append("")
        
        if not self.proximity_log:
            lines.append("暂无监控数据")
            return "\n".join(lines)
        
        # Score分布
        lines.append("─" * 80)
        lines.append("📊 Score接近度分布")
        lines.append("─" * 80)
        
        scores = [r['score'] for r in self.proximity_log]
        
        ranges = [
            (0, 60, "❌ 无结构 (0-60)"),
            (60, 70, "⚠️ 弱结构 (60-70)"),
            (70, 80, "🟡 接近机会 (70-80)"),
            (80, 85, "🔥 即将触发 (80-85)"),
            (85, 100, "🚀 已触发 (85+)")
        ]
        
        for min_s, max_s, label in ranges:
            count = sum(1 for s in scores if min_s <= s < max_s)
            pct = count / len(scores) * 100
            lines.append(f"  {label}: {count:3d} ({pct:5.1f}%)")
        
        lines.append("")
        
        # 最新状态
        lines.append("─" * 80)
        lines.append("📊 最新市场状态")
        lines.append("─" * 80)
        
        latest = self.proximity_log[-2:] if len(self.proximity_log) >= 2 else self.proximity_log
        for record in latest:
            emoji, _, _ = self._get_proximity_status(record['score'])
            lines.append(f"{emoji} {record['symbol']}")
            lines.append(f"   Score: {record['score']}/100 (Gap: {record['gap_to_threshold']})")
            lines.append(f"   状态: {record['status']}")
            lines.append(f"   价格: {record['price']:.2f}")
            lines.append(f"   成交量: {record['volume_ratio']:.2f}x")
            lines.append("")
        
        # 结论
        lines.append("=" * 80)
        lines.append("🎯 待命状态")
        lines.append("=" * 80)
        
        max_score = max(scores) if scores else 0
        
        if max_score >= 85:
            lines.append("🚀 已触发交易信号！")
            lines.append(f"   最高Score: {max_score}")
            lines.append("   系统正在执行...")
        elif max_score >= 80:
            lines.append("🟡 市场接近机会")
            lines.append(f"   最高Score: {max_score} (Gap: {85-max_score})")
            lines.append("   继续监控...")
        elif max_score >= 70:
            lines.append("⚠️ 市场结构较弱")
            lines.append(f"   最高Score: {max_score} (Gap: {85-max_score})")
            lines.append("   等待结构改善...")
        else:
            lines.append("❌ 当前市场无结构")
            lines.append(f"   最高Score: {max_score} (Gap: {85-max_score})")
            lines.append("   系统保持待命...")
        
        lines.append("")
        lines.append("💡 心态提醒:")
        lines.append("   - 不是期待立刻交易")
        lines.append("   - 而是等待机会出现时完美执行")
        lines.append("=" * 80)
        
        return "\n".join(lines)


async def main():
    """主函数"""
    monitor = TestnetStandbyMonitor()
    
    print("🚀 启动待命监控...")
    print("运行30个周期，监控市场状态变化...\n")
    
    for i in range(30):
        print(f"--- 周期 {i+1}/30 ---")
        await monitor.monitor_cycle()
        await asyncio.sleep(0.5)
    
    # 生成报告
    report = monitor.generate_standby_report()
    print("\n" + report)
    
    # 保存报告
    report_file = monitor.data_dir / 'testnet_standby_report.txt'
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(f"\n✅ 报告已保存: {report_file}")
    
    print("\n" + "=" * 80)
    print("🚀 Testnet 待命监控完成")
    print("💡 系统已验证'等待机会'的能力")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(main())
