#!/usr/bin/env python3
"""
V4.2.3 Phase 1 微资金实盘验证
专业级上线配置，带完整观测体系
"""

import asyncio
import sys
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import pandas as pd
import numpy as np
import json

sys.path.insert(0, str(Path(__file__).parent / 'core'))

from enhanced_analyzer import EnhancedAnalyzer
from scoring_engine_v423 import ScoringEngineV423
from environment_filter_v1 import EnvironmentFilterV1, EnvironmentContext


class LiveTradingV423P1(EnhancedAnalyzer):
    """
    V4.2.3 Phase 1 微资金实盘
    
    配置:
    - 单笔仓位: 0.5%
    - 最大并发: 1
    - 日止损: -1%
    - 硬止损: -0.15%
    """
    
    def __init__(self):
        symbols = ['BTC/USDT:USDT', 'ETH/USDT:USDT']
        super().__init__(symbols=symbols)
        
        # 核心组件
        self.scoring_engine = ScoringEngineV423()
        self.env_filter = EnvironmentFilterV1()
        
        # Phase 1 配置
        self.position_size_pct = 0.5  # 单笔仓位 0.5%
        self.max_concurrent = 1       # 最大并发 1
        self.daily_stop_loss = -1.0   # 日止损 -1%
        self.stop_loss_pct = -0.15    # 硬止损 -0.15%
        self.slippage_threshold = 0.05  # 滑点阈值 0.05%
        
        # 状态追踪
        self.daily_pnl = 0.0
        self.trade_count = 0
        self.daily_stop_triggered = False
        
        # 交易日志
        self.trade_log: List[Dict] = []
        self.blocked_log: List[Dict] = []
        
        # 加载历史
        self._load_trade_history()
        
        print("=" * 80)
        print("🚀 V4.2.3 Phase 1 微资金实盘验证")
        print("=" * 80)
        print("⚠️  专业级上线配置")
        print("")
        print("📋 核心配置:")
        print(f"  单笔仓位: {self.position_size_pct}%")
        print(f"  最大并发: {self.max_concurrent}")
        print(f"  日止损: {self.daily_stop_loss}%")
        print(f"  硬止损: {self.stop_loss_pct}%")
        print(f"  滑点阈值: {self.slippage_threshold}%")
        print("")
        print("🛡️ 环境过滤:")
        print("  - ETH下午(12-18)禁用")
        print("  - 低成交量(<1.05x)禁用")
        print("  - 连续3次止损→30min熔断")
        print("  - 连续5次止损→120min熔断")
        print("  - 最近5笔平均亏损>0.05%→30min熔断")
        print("")
    
    def _load_trade_history(self):
        """加载历史交易记录"""
        log_file = self.data_dir / 'live_trading_p1_log.jsonl'
        if log_file.exists():
            with open(log_file, 'r') as f:
                for line in f:
                    try:
                        trade = json.loads(line.strip())
                        self.trade_log.append(trade)
                    except:
                        pass
            print(f"📊 已加载历史交易: {len(self.trade_log)} 笔")
            
            # 计算今日盈亏
            today = datetime.now().strftime('%Y-%m-%d')
            today_trades = [t for t in self.trade_log if t.get('date') == today]
            self.daily_pnl = sum(t.get('pnl_pct', 0) for t in today_trades)
            self.trade_count = len(today_trades)
            
            print(f"📈 今日交易: {self.trade_count} 笔, 盈亏: {self.daily_pnl:+.4f}%")
    
    def _save_trade(self, trade: Dict):
        """保存交易记录"""
        log_file = self.data_dir / 'live_trading_p1_log.jsonl'
        with open(log_file, 'a') as f:
            f.write(json.dumps(trade) + '\n')
    
    def _check_daily_stop(self) -> bool:
        """检查日止损"""
        if self.daily_pnl < self.daily_stop_loss:
            if not self.daily_stop_triggered:
                self.daily_stop_triggered = True
                print(f"🛑 日止损触发: {self.daily_pnl:+.4f}% < {self.daily_stop_loss}%")
                print("   今日停止交易")
            return True
        return False
    
    def _extract_hour(self, timestamp: str) -> int:
        """提取小时"""
        try:
            if ' ' in timestamp:
                return int(timestamp.split(' ')[1].split(':')[0])
            return 0
        except:
            return 0
    
    async def scan_and_trade(self):
        """扫描并执行交易"""
        # 检查日止损
        if self._check_daily_stop():
            return
        
        for symbol in self.symbols:
            # 获取最新数据
            df = await self.fetch_historical_ohlcv(symbol, hours=1)
            if df is None or len(df) < 30:
                continue
            
            current = df.iloc[-1]
            window = df.tail(30)
            
            # V4.2.3评分
            score_breakdown = self.scoring_engine.calculate_score(
                ohlcv_df=window,
                current_price=current['close'],
                spread_bps=2.0,
                rl_decision='ALLOW'
            )
            
            if not score_breakdown.is_qualified:
                continue
            
            # 环境过滤检查
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
                # 记录被过滤
                blocked_record = {
                    'date': datetime.now().strftime('%Y-%m-%d'),
                    'timestamp': str(current['timestamp']),
                    'symbol': symbol,
                    'price': float(current['close']),
                    'score': score_breakdown.total_score,
                    'volume_ratio': volume_ratio,
                    'filter_decision': filter_result.decision,
                    'filter_reason': filter_result.reason,
                    'filter_rule': filter_result.rule_triggered
                }
                self.blocked_log.append(blocked_record)
                print(f"🚫 BLOCKED: {symbol} | {filter_result.reason}")
                continue
            
            # 模拟执行（Phase 1用模拟数据验证流程）
            # TODO: 接入真实交易所执行
            print(f"✅ SIGNAL: {symbol} @ {current['close']:.2f} | Score: {score_breakdown.total_score}")
            print(f"   环境检查通过，准备执行...")
            
            # 记录交易（模拟）
            trade_record = {
                'date': datetime.now().strftime('%Y-%m-%d'),
                'timestamp': str(current['timestamp']),
                'symbol': symbol,
                'signal_price': float(current['close']),
                'execution_price': float(current['close']),  # TODO: 真实成交价格
                'slippage': 0.0,  # TODO: 真实滑点
                'position_size_pct': self.position_size_pct,
                'score': score_breakdown.total_score,
                'volume_ratio': volume_ratio,
                'env_filter_passed': True
            }
            
            # TODO: 等待60秒后记录结果
            # 这里用模拟数据
            trade_record['pnl_pct'] = 0.0  # TODO: 真实盈亏
            trade_record['exit_price'] = float(current['close'])
            
            self.trade_log.append(trade_record)
            self._save_trade(trade_record)
            
            # 更新状态
            self.daily_pnl += trade_record['pnl_pct']
            self.trade_count += 1
            
            # 记录到环境过滤器
            self.env_filter.record_trade(
                symbol=symbol,
                pnl_pct=trade_record['pnl_pct'],
                timestamp=str(current['timestamp'])
            )
            
            print(f"   交易记录: #{self.trade_count}, 今日盈亏: {self.daily_pnl:+.4f}%")
    
    def _calc_volume_ratio(self, df: pd.DataFrame) -> float:
        try:
            current_vol = df['volume'].iloc[-1]
            avg_vol = df['volume'].tail(20).mean()
            return float(current_vol / avg_vol) if avg_vol > 0 else 0.0
        except:
            return 0.0
    
    def generate_p1_report(self) -> str:
        """生成Phase 1报告"""
        lines = []
        lines.append("=" * 80)
        lines.append("📊 V4.2.3 Phase 1 实盘验证报告")
        lines.append("=" * 80)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"总交易笔数: {len(self.trade_log)}")
        lines.append("")
        
        if not self.trade_log:
            lines.append("暂无交易记录")
            return "\n".join(lines)
        
        # 基础统计
        returns = [t['pnl_pct'] for t in self.trade_log]
        returns = np.array(returns)
        
        lines.append("─" * 80)
        lines.append("📈 基础统计")
        lines.append("─" * 80)
        lines.append(f"{'指标':<25} {'数值':<20}")
        lines.append("-" * 80)
        lines.append(f"{'总交易笔数':<25} {len(returns):<20}")
        lines.append(f"{'均值':<25} {np.mean(returns):>+.4f}%")
        lines.append(f"{'中位数':<25} {np.median(returns):>+.4f}%")
        lines.append(f"{'标准差':<25} {np.std(returns):>.4f}%")
        lines.append(f"{'最小值':<25} {np.min(returns):>+.4f}%")
        lines.append(f"{'最大值':<25} {np.max(returns):>+.4f}%")
        
        # 盈亏比
        profits = returns[returns > 0]
        losses = returns[returns < 0]
        if len(profits) > 0 and len(losses) > 0:
            pl_ratio = np.mean(profits) / abs(np.mean(losses))
            win_rate = len(profits) / len(returns) * 100
            lines.append(f"{'胜率':<25} {win_rate:>.1f}%")
            lines.append(f"{'盈亏比':<25} {pl_ratio:>.2f}")
        
        lines.append("")
        
        # Phase 1 通过标准检查
        lines.append("=" * 80)
        lines.append("🎯 Phase 1 通过标准检查")
        lines.append("=" * 80)
        
        checks = []
        
        # 1. 实盘均值 >= +0.03%
        mean_val = np.mean(returns)
        if mean_val >= 0.03:
            checks.append(("✅", "实盘均值 >= +0.03%", f"{mean_val:+.4f}%"))
        else:
            checks.append(("❌", "实盘均值 >= +0.03%", f"{mean_val:+.4f}%"))
        
        # 2. 盈亏比 >= 1.5
        if len(profits) > 0 and len(losses) > 0:
            if pl_ratio >= 1.5:
                checks.append(("✅", "盈亏比 >= 1.5", f"{pl_ratio:.2f}"))
            else:
                checks.append(("❌", "盈亏比 >= 1.5", f"{pl_ratio:.2f}"))
        
        # 3. 最大连亏 <= 4
        max_consecutive = 0
        current = 0
        for r in returns:
            if r < 0:
                current += 1
                max_consecutive = max(max_consecutive, current)
            else:
                current = 0
        
        if max_consecutive <= 4:
            checks.append(("✅", "最大连亏 <= 4", f"{max_consecutive}"))
        else:
            checks.append(("❌", "最大连亏 <= 4", f"{max_consecutive}"))
        
        # 4. 样本量 >= 100
        if len(returns) >= 100:
            checks.append(("✅", "样本量 >= 100", f"{len(returns)}"))
        else:
            checks.append(("⏳", "样本量 >= 100", f"{len(returns)}/100"))
        
        for status, check, value in checks:
            lines.append(f"{status} {check:<30} {value}")
        
        lines.append("")
        
        # 结论
        passed = sum(1 for s, _, _ in checks if s == "✅")
        total = len(checks)
        
        lines.append("=" * 80)
        if passed == total:
            lines.append("🎉 Phase 1 全部通过！可以进入 Phase 2（放大）")
        elif passed >= total - 1 and len(returns) < 100:
            lines.append(f"⏳ Phase 1 进行中: {passed}/{total} 通过，继续积累样本")
        else:
            lines.append(f"⚠️  Phase 1 需优化: {passed}/{total} 通过")
        lines.append("=" * 80)
        
        return "\n".join(lines)


async def main():
    """主函数"""
    trader = LiveTradingV423P1()
    
    # 生成当前报告
    report = trader.generate_p1_report()
    print(report)
    
    # 保存报告
    report_file = trader.data_dir / 'live_trading_p1_report.txt'
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(f"\n✅ Phase 1 报告已保存: {report_file}")
    
    print("\n" + "=" * 80)
    print("🚀 V4.2.3 Phase 1 微资金实盘验证")
    print("⚠️  当前为模拟模式，需接入真实交易所执行")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(main())
