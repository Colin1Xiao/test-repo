#!/usr/bin/env python3
"""
Testnet Phase 1 启动器
Dry-run → Testnet → 验证系统行为
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


class TestnetP1Launcher:
    """
    Testnet Phase 1 启动器
    
    阶段:
    1. Dry-run: 走完整流程，不下单（10-20笔验证）
    2. Testnet: 真实下单，testnet环境（50-100笔验证）
    
    监控指标:
    - 下单成功率 ≥ 99%
    - 成交率 ≈ 100% (MARKET)
    - 滑点 < 0.05%
    - 延迟 < 2s
    - 风控触发正确
    """
    
    def __init__(self, dry_run: bool = True):
        self.dry_run = dry_run
        self.mode = "DRY-RUN" if dry_run else "TESTNET"
        
        # 组件
        self.analyzer = EnhancedAnalyzer(symbols=['BTC/USDT:USDT', 'ETH/USDT:USDT'])
        self.scoring_engine = ScoringEngineV423()
        self.env_filter = EnvironmentFilterV1()
        self.executor = None  # 只在非dry_run时初始化
        
        # 统计
        self.stats = {
            'total_signals': 0,
            'blocked': 0,
            'executed': 0,
            'success': 0,
            'failed': 0,
            'slippage_sum': 0.0,
            'delay_sum': 0.0,
            'orders': []
        }
        
        print("=" * 80)
        print(f"🚀 Testnet Phase 1 - {self.mode} 模式")
        print("=" * 80)
        print("")
        
        if dry_run:
            print("📋 Dry-run 模式:")
            print("  - 走完整流程")
            print("  - 调API但不下单（或模拟）")
            print("  - 验证系统行为")
            print("")
        else:
            print("📋 Testnet 模式:")
            print("  - 真实下单")
            print("  - OKX testnet环境")
            print("  - 验证执行质量")
            print("")
        
        print("🎯 监控指标:")
        print("  - 下单成功率 ≥ 99%")
        print("  - 成交率 ≈ 100%")
        print("  - 滑点 < 0.05%")
        print("  - 延迟 < 2s")
        print("")
    
    async def init_executor(self, api_key: str = None, api_secret: str = None, 
                           passphrase: str = None):
        """初始化执行器（非dry_run时）"""
        if not self.dry_run:
            if not all([api_key, api_secret, passphrase]):
                raise ValueError("Testnet模式需要API配置")
            
            self.executor = LiveExecutor(
                api_key=api_key,
                api_secret=api_secret,
                passphrase=passphrase,
                testnet=True
            )
            print("✅ LiveExecutor 初始化完成 (Testnet)")
        else:
            print("✅ Dry-run模式，跳过Executor初始化")
    
    async def run_cycle(self):
        """运行一个交易周期"""
        for symbol in ['BTC/USDT:USDT', 'ETH/USDT:USDT']:
            # 1. 获取数据
            df = await self.analyzer.fetch_historical_ohlcv(symbol, hours=1)
            if df is None or len(df) < 30:
                continue
            
            current = df.iloc[-1]
            window = df.tail(30)
            
            # 2. V4.2.3评分
            score_breakdown = self.scoring_engine.calculate_score(
                ohlcv_df=window,
                current_price=current['close'],
                spread_bps=2.0,
                rl_decision='ALLOW'
            )
            
            if not score_breakdown.is_qualified:
                continue
            
            self.stats['total_signals'] += 1
            
            # 3. 环境过滤
            hour = self._extract_hour(str(current['timestamp']))
            volume_ratio = self._calc_volume_ratio(window)
            
            context = EnvironmentContext(
                symbol=symbol,
                timestamp=str(current['timestamp']),
                hour=hour,
                volume_ratio=volume_ratio,
                consecutive_stop_loss=self.env_filter.consecutive_losses
            )
            
            filter_result = self.env_filter.evaluate(context)
            
            if filter_result.decision != "ALLOW":
                self.stats['blocked'] += 1
                print(f"🚫 BLOCKED: {symbol} | {filter_result.reason}")
                continue
            
            # 4. 执行交易
            print(f"✅ SIGNAL: {symbol} @ {current['close']:.2f} | Score: {score_breakdown.total_score}")
            
            if self.dry_run:
                # Dry-run: 模拟执行
                await self._dry_run_execute(symbol, current['close'], volume_ratio)
            else:
                # Testnet: 真实执行
                await self._testnet_execute(symbol, current['close'])
    
    async def _dry_run_execute(self, symbol: str, signal_price: float, volume_ratio: float):
        """Dry-run执行（模拟）"""
        print(f"   [DRY-RUN] 模拟执行...")
        
        # 模拟延迟
        import random
        delay = random.uniform(0.5, 1.5)
        await asyncio.sleep(0.1)  # 模拟API调用
        
        # 模拟滑点
        slippage = random.uniform(-0.02, 0.03)
        execution_price = signal_price * (1 + slippage / 100)
        
        # 模拟结果
        success = random.random() > 0.01  # 99%成功率
        
        order = {
            'symbol': symbol,
            'signal_price': signal_price,
            'execution_price': execution_price,
            'slippage': slippage,
            'delay': delay,
            'success': success,
            'timestamp': datetime.now().isoformat()
        }
        
        self.stats['orders'].append(order)
        
        if success:
            self.stats['executed'] += 1
            self.stats['success'] += 1
            self.stats['slippage_sum'] += abs(slippage)
            self.stats['delay_sum'] += delay
            print(f"   ✅ 模拟成功 | 滑点: {slippage:+.4f}% | 延迟: {delay:.2f}s")
        else:
            self.stats['failed'] += 1
            print(f"   ❌ 模拟失败")
    
    async def _testnet_execute(self, symbol: str, signal_price: float):
        """Testnet真实执行"""
        if not self.executor:
            print("   ❌ Executor未初始化")
            return
        
        print(f"   [TESTNET] 真实执行...")
        
        # 真实执行
        result = await self.executor.execute_signal(
            symbol=symbol,
            signal_price=signal_price,
            position_size_usd=10,  # Testnet用小金额
            stop_loss_pct=-0.15
        )
        
        if result:
            self.stats['executed'] += 1
            self.stats['success'] += 1
            self.stats['slippage_sum'] += abs(result['slippage'])
            self.stats['orders'].append(result)
            print(f"   ✅ 执行成功 | 滑点: {result['slippage']:+.4f}%")
        else:
            self.stats['failed'] += 1
            print(f"   ❌ 执行失败")
    
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
    
    def generate_report(self) -> str:
        """生成报告"""
        lines = []
        lines.append("=" * 80)
        lines.append(f"📊 Testnet Phase 1 - {self.mode} 报告")
        lines.append("=" * 80)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        # 基础统计
        lines.append("─" * 80)
        lines.append("📈 基础统计")
        lines.append("─" * 80)
        lines.append(f"总信号: {self.stats['total_signals']}")
        lines.append(f"被过滤: {self.stats['blocked']}")
        lines.append(f"尝试执行: {self.stats['executed']}")
        lines.append(f"成功: {self.stats['success']}")
        lines.append(f"失败: {self.stats['failed']}")
        lines.append("")
        
        # 执行质量
        if self.stats['success'] > 0:
            lines.append("─" * 80)
            lines.append("🎯 执行质量")
            lines.append("─" * 80)
            
            avg_slippage = self.stats['slippage_sum'] / self.stats['success']
            avg_delay = self.stats['delay_sum'] / self.stats['success']
            success_rate = self.stats['success'] / self.stats['executed'] * 100 if self.stats['executed'] > 0 else 0
            
            lines.append(f"成功率: {success_rate:.1f}%")
            lines.append(f"平均滑点: {avg_slippage:.4f}%")
            lines.append(f"平均延迟: {avg_delay:.2f}s")
            lines.append("")
            
            # 指标检查
            lines.append("─" * 80)
            lines.append("✅ 指标检查")
            lines.append("─" * 80)
            
            checks = []
            
            if success_rate >= 99:
                checks.append(("✅", "成功率 ≥ 99%", f"{success_rate:.1f}%"))
            else:
                checks.append(("❌", "成功率 ≥ 99%", f"{success_rate:.1f}%"))
            
            if avg_slippage < 0.05:
                checks.append(("✅", "平均滑点 < 0.05%", f"{avg_slippage:.4f}%"))
            else:
                checks.append(("❌", "平均滑点 < 0.05%", f"{avg_slippage:.4f}%"))
            
            if avg_delay < 2.0:
                checks.append(("✅", "平均延迟 < 2s", f"{avg_delay:.2f}s"))
            else:
                checks.append(("❌", "平均延迟 < 2s", f"{avg_delay:.2f}s"))
            
            for status, check, value in checks:
                lines.append(f"{status} {check:<25} {value}")
            
            lines.append("")
        
        # 结论
        lines.append("=" * 80)
        if self.dry_run:
            lines.append("📝 Dry-run 完成")
            lines.append("下一步: 确认无bug后，切换至 TESTNET 模式")
        else:
            lines.append("📝 Testnet 验证完成")
            if self.stats['success'] >= 20:
                lines.append("✅ 已达到20笔，可以进入下一阶段")
            else:
                lines.append(f"⏳ 当前{self.stats['success']}笔，继续积累至20笔")
        lines.append("=" * 80)
        
        return "\n".join(lines)


async def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Testnet Phase 1 启动器')
    parser.add_argument('--mode', choices=['dry-run', 'testnet'], default='dry-run',
                       help='运行模式: dry-run 或 testnet')
    parser.add_argument('--api-key', help='OKX API Key')
    parser.add_argument('--api-secret', help='OKX API Secret')
    parser.add_argument('--passphrase', help='OKX Passphrase')
    parser.add_argument('--cycles', type=int, default=10, help='运行周期数')
    
    args = parser.parse_args()
    
    # 创建启动器
    launcher = TestnetP1Launcher(dry_run=(args.mode == 'dry-run'))
    
    # 初始化执行器（非dry_run时）
    if args.mode == 'testnet':
        await launcher.init_executor(
            api_key=args.api_key,
            api_secret=args.api_secret,
            passphrase=args.passphrase
        )
    
    # 运行指定周期
    print(f"\n🚀 启动 {args.cycles} 个交易周期...\n")
    
    for i in range(args.cycles):
        print(f"--- 周期 {i+1}/{args.cycles} ---")
        await launcher.run_cycle()
        await asyncio.sleep(1)  # 周期间隔
    
    # 生成报告
    report = launcher.generate_report()
    print("\n" + report)
    
    # 保存报告
    report_file = Path(__file__).parent / 'data' / f'testnet_p1_{args.mode}_report.txt'
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(f"\n✅ 报告已保存: {report_file}")
    
    # 关闭连接
    if launcher.executor:
        await launcher.executor.close()


if __name__ == "__main__":
    asyncio.run(main())
