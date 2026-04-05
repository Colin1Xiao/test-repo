#!/usr/bin/env python3
"""
Testnet 实时运行 + Gap 分级预警
常驻运行，等待市场机会
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
from live_executor import LiveExecutor


class TestnetLiveWithAlert(EnhancedAnalyzer):
    """
    Testnet 实时运行 + 分级预警
    
    三级预警：
    - 75+: 🟡 接近机会
    - 80+: ⚠️ 高概率触发  
    - 85+: 🔥 信号触发（自动执行）
    """
    
    def __init__(self, api_key=None, api_secret=None, passphrase=None, dry_run=True):
        symbols = ['BTC/USDT:USDT', 'ETH/USDT:USDT']
        super().__init__(symbols=symbols)
        
        self.scoring_engine = ScoringEngineV423()
        self.env_filter = EnvironmentFilterV1()
        
        self.dry_run = dry_run
        self.executor = None
        
        if not dry_run and all([api_key, api_secret, passphrase]):
            self.executor = LiveExecutor(api_key, api_secret, passphrase, testnet=True)
            print("✅ LiveExecutor 已连接 Testnet")
        
        # 预警阈值
        self.alert_levels = {
            75: ("🟡", "接近机会", "市场正在改善，保持关注"),
            80: ("⚠️", "高概率触发", "进入注意状态，准备执行"),
            85: ("🔥", "信号触发", "自动执行交易")
        }
        
        # 统计
        self.stats = {
            'cycles': 0,
            'alerts_75': 0,
            'alerts_80': 0,
            'alerts_85': 0,
            'executed': 0,
            'trades': []
        }
        
        print("=" * 80)
        print("🚀 Testnet 实时运行 + Gap 分级预警")
        print("=" * 80)
        print(f"模式: {'DRY-RUN' if dry_run else 'TESTNET'}")
        print("")
        print("🔔 三级预警系统:")
        print("  🟡 75+ : 接近机会")
        print("  ⚠️  80+ : 高概率触发")
        print("  🔥 85+ : 信号触发（自动执行）")
        print("")
        print("💡 系统常驻运行，等待市场机会...")
        print("=" * 80)
    
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
    
    def _send_alert(self, level: int, symbol: str, score: int, gap: int, message: str):
        """发送预警"""
        emoji, title, desc = self.alert_levels[level]
        
        alert_msg = f"\n{'='*60}\n"
        alert_msg += f"{emoji} {title}\n"
        alert_msg += f"{'='*60}\n"
        alert_msg += f"品种: {symbol}\n"
        alert_msg += f"Score: {score}/100\n"
        alert_msg += f"Gap: {gap}\n"
        alert_msg += f"描述: {desc}\n"
        alert_msg += f"时间: {datetime.now().strftime('%H:%M:%S')}\n"
        alert_msg += f"{'='*60}\n"
        
        print(alert_msg)
        
        # 保存预警记录
        alert_record = {
            'timestamp': datetime.now().isoformat(),
            'level': level,
            'symbol': symbol,
            'score': score,
            'gap': gap,
            'message': message
        }
        
        alert_file = self.data_dir / 'testnet_alerts.jsonl'
        with open(alert_file, 'a') as f:
            f.write(json.dumps(alert_record) + '\n')
    
    async def run_cycle(self):
        """运行一个周期"""
        self.stats['cycles'] += 1
        
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
            gap = 85 - score
            
            # 基础输出
            status = "✅" if score >= 85 else "🟡" if score >= 80 else "⚠️" if score >= 75 else "❌"
            print(f"{status} {symbol} | Score: {score:2d} | Gap: {gap:2d} | Cycle: {self.stats['cycles']}")
            
            # 分级预警
            if score >= 85:
                self.stats['alerts_85'] += 1
                self._send_alert(85, symbol, score, gap, "信号触发，准备执行")
                
                # 执行交易
                await self._execute_trade(symbol, current)
                
            elif score >= 80:
                self.stats['alerts_80'] += 1
                self._send_alert(80, symbol, score, gap, "高概率触发，进入注意状态")
                
            elif score >= 75:
                self.stats['alerts_75'] += 1
                self._send_alert(75, symbol, score, gap, "接近机会，市场正在改善")
    
    async def _execute_trade(self, symbol: str, current):
        """执行交易"""
        hour = self._extract_hour(str(current['timestamp']))
        volume_ratio = self._calc_volume_ratio(current)
        
        # 环境过滤检查
        context = EnvironmentContext(
            symbol=symbol,
            timestamp=str(current['timestamp']),
            hour=hour,
            volume_ratio=volume_ratio,
            consecutive_stop_loss=self.env_filter.consecutive_losses
        )
        
        filter_result = self.env_filter.evaluate(context)
        
        if filter_result.decision != "ALLOW":
            print(f"   🚫 被过滤: {filter_result.reason}")
            return
        
        print(f"   ✅ 环境检查通过，执行交易...")
        
        if self.dry_run:
            # Dry-run: 模拟执行
            print(f"   [DRY-RUN] 模拟成交 @ {current['close']:.2f}")
            
            trade_record = {
                'timestamp': datetime.now().isoformat(),
                'symbol': symbol,
                'price': float(current['close']),
                'mode': 'dry-run',
                'slippage': 0.0
            }
        else:
            # Testnet: 真实执行
            if self.executor:
                result = await self.executor.execute_signal(
                    symbol=symbol,
                    signal_price=float(current['close']),
                    position_size_usd=10,
                    stop_loss_pct=-0.15
                )
                
                if result:
                    trade_record = result
                    print(f"   ✅ 成交: {result.get('execution_price', 'N/A')}")
                else:
                    print(f"   ❌ 执行失败")
                    return
            else:
                print(f"   ❌ Executor未初始化")
                return
        
        self.stats['executed'] += 1
        self.stats['trades'].append(trade_record)
        
        # 保存交易记录
        trade_file = self.data_dir / 'testnet_trades.jsonl'
        with open(trade_file, 'a') as f:
            f.write(json.dumps(trade_record) + '\n')
        
        print(f"   📊 交易 #{self.stats['executed']} 已记录")
    
    def generate_live_report(self) -> str:
        """生成实时报告"""
        lines = []
        lines.append("=" * 80)
        lines.append("📊 Testnet 实时运行报告")
        lines.append("=" * 80)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"运行周期: {self.stats['cycles']}")
        lines.append(f"模式: {'DRY-RUN' if self.dry_run else 'TESTNET'}")
        lines.append("")
        
        lines.append("─" * 80)
        lines.append("🔔 预警统计")
        lines.append("─" * 80)
        lines.append(f"🟡 75+ 接近机会: {self.stats['alerts_75']} 次")
        lines.append(f"⚠️  80+ 高概率触发: {self.stats['alerts_80']} 次")
        lines.append(f"🔥 85+ 信号触发: {self.stats['alerts_85']} 次")
        lines.append(f"✅ 实际执行: {self.stats['executed']} 笔")
        lines.append("")
        
        lines.append("─" * 80)
        lines.append("🎯 关键观察")
        lines.append("─" * 80)
        
        if self.stats['alerts_85'] > 0:
            lines.append(f"🔥 已触发 {self.stats['alerts_85']} 次交易信号")
            if self.stats['executed'] > 0:
                lines.append(f"✅ 成功执行 {self.stats['executed']} 笔")
                lines.append("📊 等待市场反馈...")
            else:
                lines.append("⚠️  信号触发但未执行（检查过滤条件）")
        elif self.stats['alerts_80'] > 0:
            lines.append(f"⚠️  已出现 {self.stats['alerts_80']} 次高概率预警")
            lines.append("🎯 市场接近状态切换，保持关注")
        elif self.stats['alerts_75'] > 0:
            lines.append(f"🟡 已出现 {self.stats['alerts_75']} 次接近机会预警")
            lines.append("⏳ 市场正在改善，继续等待")
        else:
            lines.append("❌ 尚未出现预警信号")
            lines.append("⏳ 市场处于冷静期，系统保持待命")
        
        lines.append("")
        lines.append("=" * 80)
        lines.append("💡 系统状态: 常驻运行，等待市场机会")
        lines.append("=" * 80)
        
        return "\n".join(lines)


async def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Testnet 实时运行 + 分级预警')
    parser.add_argument('--mode', choices=['dry-run', 'testnet'], default='dry-run',
                       help='运行模式')
    parser.add_argument('--api-key', help='OKX API Key')
    parser.add_argument('--api-secret', help='OKX API Secret')
    parser.add_argument('--passphrase', help='OKX Passphrase')
    parser.add_argument('--cycles', type=int, default=100, help='运行周期数（0=无限）')
    parser.add_argument('--interval', type=float, default=2.0, help='周期间隔（秒）')
    
    args = parser.parse_args()
    
    # 创建运行器
    dry_run = args.mode == 'dry-run'
    runner = TestnetLiveWithAlert(
        api_key=args.api_key,
        api_secret=args.api_secret,
        passphrase=args.passphrase,
        dry_run=dry_run
    )
    
    print(f"\n🚀 启动 {'DRY-RUN' if dry_run else 'TESTNET'} 模式...")
    print(f"周期间隔: {args.interval}s")
    if args.cycles == 0:
        print("运行周期: 无限（按Ctrl+C停止）")
    else:
        print(f"运行周期: {args.cycles}")
    print("")
    
    try:
        cycle = 0
        while args.cycles == 0 or cycle < args.cycles:
            cycle += 1
            await runner.run_cycle()
            await asyncio.sleep(args.interval)
            
            # 每10个周期生成报告
            if cycle % 10 == 0:
                report = runner.generate_live_report()
                print("\n" + report)
                
    except KeyboardInterrupt:
        print("\n\n🛑 用户停止")
    
    # 最终报告
    print("\n" + "=" * 80)
    report = runner.generate_live_report()
    print(report)
    
    # 保存报告
    report_file = runner.data_dir / 'testnet_live_report.txt'
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(f"\n✅ 报告已保存: {report_file}")
    
    # 关闭连接
    if runner.executor:
        await runner.executor.close()


if __name__ == "__main__":
    asyncio.run(main())
