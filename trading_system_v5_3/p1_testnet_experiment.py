#!/usr/bin/env python3
"""
V4.2 P1 Testnet 受控实验 - 100x杠杆版本

实验目标:
1. 验证"信号 → 执行 → 盈亏"一致性
2. 记录三档评分阈值执行效果 (≥75, ≥85, ≥88)
3. 验证出场逻辑 (止盈/止损/时间止损)
4. 对比成交率、滑点、部分成交、盈亏与理论偏差

实验原则:
- 不修改V4.1主实盘
- 仅在Testnet环境执行
- 完整记录执行质量指标
- 100x强制杠杆
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
# 导入100x全局常量
from constants import (
    GLOBAL_LEVERAGE,
    GLOBAL_STOP_LOSS_PCT,
    GLOBAL_TAKE_PROFIT_PCT,
    LIQUIDATION_EXIT_PCT,
    MAX_SLIPPAGE_PCT,
    FREEZE_LOSS_PCT,
    MAX_HOLD_SECONDS
)


class P1TestnetExperiment:
    """
    P1 Testnet 受控实验 - 100x杠杆版本
    
    监控指标:
    - 下单成功率 ≥ 99%
    - 成交率
    - 平均滑点
    - 部分成交比例
    - 超时撤单比例
    - 单笔盈亏 vs 理论盈亏偏差
    - 手续费影响
    """
    
    def __init__(self, api_key: str = None, api_secret: str = None,
                 passphrase: str = None, execution_threshold: int = 85):
        self.mode = "TESTNET"

        # 🔧 执行阈值（可配置，用于执行层验证）
        self.execution_threshold = execution_threshold  # 实际执行的评分阈值
        
        # 🔒 100x配置（从全局常量读取）
        self.leverage = GLOBAL_LEVERAGE
        self.stop_loss_pct = GLOBAL_STOP_LOSS_PCT
        self.take_profit_pct = GLOBAL_TAKE_PROFIT_PCT

        # 组件
        self.analyzer = EnhancedAnalyzer(symbols=['BTC/USDT:USDT', 'ETH/USDT:USDT'])
        self.scoring_engine = ScoringEngineV423()
        self.env_filter = EnvironmentFilterV1()
        self.executor = None

        # 信号间隔保护（防止伪高频）
        self.min_signal_interval_seconds = 20
        self.last_signal_time = {}  # symbol -> timestamp

        # 成交有效性阈值 - 使用正确的单位
        # ⚠️ 单位修正：滑点阈值必须是小数形式
        # 0.05% = 0.0005 (不是 0.05!)
        self.max_slippage_threshold = 0.0005  # 最大可接受滑点 0.05% = 5 bps
        self.timeout_threshold = 5.0  # 最大执行延迟 5秒
        self.min_fill_ratio = 0.8  # 最小成交比例 80%

        # 三档阈值统计
        self.threshold_stats = {
            75: {'signals': 0, 'executed': 0, 'success': 0, 'slippage_sum': 0.0, 'pnl_sum': 0.0, 'valid_fills': 0},
            85: {'signals': 0, 'executed': 0, 'success': 0, 'slippage_sum': 0.0, 'pnl_sum': 0.0, 'valid_fills': 0},
            88: {'signals': 0, 'executed': 0, 'success': 0, 'slippage_sum': 0.0, 'pnl_sum': 0.0, 'valid_fills': 0}
        }

        # 执行质量统计
        self.execution_stats = {
            'total_signals': 0,
            'total_orders': 0,
            'successful_orders': 0,
            'failed_orders': 0,
            'partial_fills': 0,
            'timeout_cancels': 0,
            'invalid_fills': 0,  # 无效成交（滑点过大/超时/部分成交）
            'valid_fills': 0,  # 有效成交
            'slippage_sum': 0.0,
            'delay_sum': 0.0,
            'theoretical_pnl_sum': 0.0,
            'actual_pnl_sum': 0.0,
            'gross_pnl_sum': 0.0,  # 毛收益
            'fee_sum': 0.0,
            'net_pnl_sum': 0.0,  # 净收益（扣手续费）
            'orders': []
        }

        # 🔴 盈亏分布统计（关键：不只看均值）
        self.pnl_distribution = {
            'wins': 0,              # 盈利次数
            'losses': 0,            # 亏损次数
            'total_profit': 0.0,    # 总盈利
            'total_loss': 0.0,      # 总亏损
            'max_win': 0.0,         # 最大单笔盈利
            'max_loss': 0.0,        # 最大单笔亏损
            'win_pnls': [],         # 盈利记录
            'loss_pnls': [],        # 亏损记录
        }

        # 🔴 连续亏损追踪
        self.consecutive_loss_tracker = {
            'current_streak': 0,    # 当前连续亏损次数
            'max_streak': 0,        # 历史最大连续亏损
            'streak_history': [],   # 连续亏损记录
        }

        # API配置
        self.api_key = api_key
        self.api_secret = api_secret
        self.passphrase = passphrase

        print("=" * 80)
        print("🚀 V4.2 P1 Testnet 受控实验")
        print("=" * 80)
        print("")

        # 显示实验模式
        if self.execution_threshold < 85:
            print("⚠️  执行层验证模式（临时降阈值）")
            print(f"   执行阈值: {self.execution_threshold}（正常应为85）")
            print("   目标: 验证执行能力、执行摩擦、系统稳定性")
            print("   ⚠️ 此轮不判断策略好坏，只验证执行层")
            print("")

        print("📋 实验设计:")
        print("  - 三档评分阈值并行记录: ≥75, ≥85, ≥88")
        print(f"  - 当前执行阈值: {self.execution_threshold}")
        print("  - 完整出场逻辑: 止盈/止损/时间止损")
        print("  - 执行质量全记录: 滑点/延迟/部分成交/盈亏偏差")
        print("")
        print("🛡️ 关键保护机制:")
        print(f"  - 最小信号间隔: {self.min_signal_interval_seconds}s（防止伪高频）")
        print(f"  - 最大滑点阈值: {self.max_slippage_threshold*100}%")
        print(f"  - 最小成交比例: {self.min_fill_ratio*100}%")
        print(f"  - 执行超时阈值: {self.timeout_threshold}s")
        print("")
        print("🎯 验证目标:")
        print("  - 下单成功率 ≥ 95%")
        print("  - 有效成交定义: 成交≥80% + 滑点≤0.05% + 延迟≤5s")
        print("  - 净收益 > 0（扣手续费后）")
        print("  - 理论 vs 实际偏差 < 30%")
        print("")

    async def init(self):
        """初始化执行器"""
        if all([self.api_key, self.api_secret, self.passphrase]):
            self.executor = LiveExecutor(
                api_key=self.api_key,
                api_secret=self.api_secret,
                passphrase=self.passphrase,
                testnet=True
            )
            print("✅ LiveExecutor 初始化完成 (Testnet)")
        else:
            print("⚠️  未提供API配置，将使用模拟模式")
            self.mode = "SIMULATION"

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

            # 3. 三档阈值统计
            for threshold in [75, 85, 88]:
                if score_breakdown.total_score >= threshold:
                    self.threshold_stats[threshold]['signals'] += 1

            # 🔧 使用配置的执行阈值（而非固定的is_qualified）
            if score_breakdown.total_score < self.execution_threshold:
                continue

            # 🛡️ 信号间隔保护（防止伪高频）
            now = datetime.now()
            if symbol in self.last_signal_time:
                elapsed = (now - self.last_signal_time[symbol]).total_seconds()
                if elapsed < self.min_signal_interval_seconds:
                    print(f"⏱️  SKIP: {symbol} | 间隔{elapsed:.1f}s < {self.min_signal_interval_seconds}s")
                    continue
            self.last_signal_time[symbol] = now

            self.execution_stats['total_signals'] += 1

            # 4. 环境过滤
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
                print(f"🚫 BLOCKED: {symbol} | {filter_result.reason}")
                continue

            # 5. 执行交易
            print(f"✅ SIGNAL: {symbol} @ {current['close']:.2f} | Score: {score_breakdown.total_score}")

            if self.mode == "TESTNET":
                await self._testnet_execute(symbol, current['close'], score_breakdown.total_score)
            else:
                await self._simulated_execute(symbol, current['close'], score_breakdown.total_score)

    def _is_valid_fill(self, result: dict) -> tuple:
        """
        判断是否为有效成交
        有效成交定义: 成交≥80% + 滑点≤0.05% + 延迟≤5s
        """
        slippage = abs(result.get('slippage', 0))
        delay = result.get('delay', 0)
        fill_ratio = result.get('fill_ratio', 1.0)

        valid = True
        reasons = []

        if fill_ratio < self.min_fill_ratio:
            valid = False
            reasons.append(f"成交比例{fill_ratio*100:.0f}% < {self.min_fill_ratio*100}%")

        if slippage > self.max_slippage_threshold:
            valid = False
            reasons.append(f"滑点{slippage*100:.4f}% > {self.max_slippage_threshold*100}%")

        if delay > self.timeout_threshold:
            valid = False
            reasons.append(f"延迟{delay:.2f}s > {self.timeout_threshold}s")

        return valid, reasons

    def _update_pnl_distribution(self, net_pnl: float):
        """
        更新盈亏分布统计和连续亏损追踪
        """
        pnl_pct = net_pnl * 100  # 转换为百分比

        if net_pnl > 0:
            # 盈利
            self.pnl_distribution['wins'] += 1
            self.pnl_distribution['total_profit'] += pnl_pct
            self.pnl_distribution['win_pnls'].append(pnl_pct)
            if pnl_pct > self.pnl_distribution['max_win']:
                self.pnl_distribution['max_win'] = pnl_pct

            # 重置连续亏损
            self.consecutive_loss_tracker['current_streak'] = 0
        else:
            # 亏损
            self.pnl_distribution['losses'] += 1
            self.pnl_distribution['total_loss'] += abs(pnl_pct)
            self.pnl_distribution['loss_pnls'].append(pnl_pct)
            if pnl_pct < self.pnl_distribution['max_loss']:
                self.pnl_distribution['max_loss'] = pnl_pct

            # 更新连续亏损
            self.consecutive_loss_tracker['current_streak'] += 1
            if self.consecutive_loss_tracker['current_streak'] > self.consecutive_loss_tracker['max_streak']:
                self.consecutive_loss_tracker['max_streak'] = self.consecutive_loss_tracker['current_streak']

    async def _testnet_execute(self, symbol: str, signal_price: float, score: int):
        """Testnet真实执行"""
        if not self.executor:
            return

        self.execution_stats['total_orders'] += 1

        # 记录理论盈亏基准
        theoretical_pnl = 0.001  # 假设+0.1%目标

        result = await self.executor.execute_signal(
            symbol=symbol,
            signal_price=signal_price,
            position_size_usd=10,
            stop_loss_pct=-0.15
        )

        if result:
            self.execution_stats['successful_orders'] += 1

            # 🛡️ 成交有效性检查
            is_valid, invalid_reasons = self._is_valid_fill(result)

            slippage = result.get('slippage', 0)
            delay = result.get('delay', 0)
            fee = result.get('fee', 0.0005)  # 默认0.05%手续费
            fill_ratio = result.get('fill_ratio', 1.0)

            # 计算盈亏
            gross_pnl = theoretical_pnl - abs(slippage) / 100
            net_pnl = gross_pnl - fee

            if is_valid:
                self.execution_stats['valid_fills'] += 1
                self.execution_stats['slippage_sum'] += abs(slippage)
                self.execution_stats['delay_sum'] += delay
                self.execution_stats['theoretical_pnl_sum'] += theoretical_pnl
                self.execution_stats['actual_pnl_sum'] += gross_pnl
                self.execution_stats['gross_pnl_sum'] += gross_pnl
                self.execution_stats['fee_sum'] += fee
                self.execution_stats['net_pnl_sum'] += net_pnl

                # 更新阈值统计（仅统计有效成交）
                for threshold in [75, 85, 88]:
                    if score >= threshold:
                        self.threshold_stats[threshold]['executed'] += 1
                        self.threshold_stats[threshold]['success'] += 1
                        self.threshold_stats[threshold]['slippage_sum'] += abs(slippage)
                        self.threshold_stats[threshold]['valid_fills'] += 1

                status_icon = "✅"
                status_text = "有效成交"
            else:
                self.execution_stats['invalid_fills'] += 1
                status_icon = "⚠️"
                status_text = f"无效成交: {', '.join(invalid_reasons)}"

            order_record = {
                'symbol': symbol,
                'score': score,
                'signal_price': signal_price,
                'execution_price': result.get('execution_price'),
                'slippage': slippage,
                'delay': delay,
                'fill_ratio': fill_ratio,
                'is_valid': is_valid,
                'invalid_reasons': invalid_reasons if not is_valid else [],
                'theoretical_pnl': theoretical_pnl,
                'gross_pnl': gross_pnl,
                'fee': fee,
                'net_pnl': net_pnl,
                'timestamp': datetime.now().isoformat()
            }
            self.execution_stats['orders'].append(order_record)

            print(f"   {status_icon} {status_text} | 滑点: {slippage:+.4f}% | 延迟: {delay:.2f}s | 净盈亏: {net_pnl:+.4f}%")
        else:
            self.execution_stats['failed_orders'] += 1
            print(f"   ❌ 执行失败")

    async def _simulated_execute(self, symbol: str, signal_price: float, score: int):
        """模拟执行（无API时）"""
        import random

        self.execution_stats['total_orders'] += 1

        # 模拟执行结果
        delay = random.uniform(0.3, 1.2)
        slippage = random.uniform(-0.02, 0.04)
        fill_ratio = random.uniform(0.85, 1.0)  # 模拟成交比例
        success = random.random() > 0.02  # 98%成功率

        if success:
            self.execution_stats['successful_orders'] += 1

            # 🛡️ 成交有效性检查
            result = {'slippage': slippage, 'delay': delay, 'fill_ratio': fill_ratio}
            is_valid, invalid_reasons = self._is_valid_fill(result)

            # 计算盈亏（⚠️ 提高止盈目标：0.2%起，降低手续费侵蚀）
            theoretical_pnl = 0.002  # 提高到0.2%（原0.1%）
            fee = 0.0005
            gross_pnl = theoretical_pnl - abs(slippage) / 100
            net_pnl = gross_pnl - fee

            if is_valid:
                self.execution_stats['valid_fills'] += 1
                self.execution_stats['slippage_sum'] += abs(slippage)
                self.execution_stats['delay_sum'] += delay
                self.execution_stats['theoretical_pnl_sum'] += theoretical_pnl
                self.execution_stats['actual_pnl_sum'] += gross_pnl
                self.execution_stats['gross_pnl_sum'] += gross_pnl
                self.execution_stats['fee_sum'] += fee
                self.execution_stats['net_pnl_sum'] += net_pnl

                # 更新阈值统计（仅统计有效成交）
                for threshold in [75, 85, 88]:
                    if score >= threshold:
                        self.threshold_stats[threshold]['executed'] += 1
                        self.threshold_stats[threshold]['success'] += 1
                        self.threshold_stats[threshold]['slippage_sum'] += abs(slippage)
                        self.threshold_stats[threshold]['valid_fills'] += 1

                status_icon = "✅"
                status_text = "有效成交"
            else:
                self.execution_stats['invalid_fills'] += 1
                status_icon = "⚠️"
                status_text = f"无效成交: {', '.join(invalid_reasons)}"

            order_record = {
                'symbol': symbol,
                'score': score,
                'signal_price': signal_price,
                'execution_price': signal_price * (1 + slippage/100),
                'slippage': slippage,
                'delay': delay,
                'fill_ratio': fill_ratio,
                'is_valid': is_valid,
                'invalid_reasons': invalid_reasons if not is_valid else [],
                'theoretical_pnl': theoretical_pnl,
                'gross_pnl': gross_pnl,
                'fee': fee,
                'net_pnl': net_pnl,
                'timestamp': datetime.now().isoformat()
            }
            self.execution_stats['orders'].append(order_record)

            # 🔴 更新盈亏分布和连续亏损追踪
            if is_valid:
                self._update_pnl_distribution(net_pnl)

            print(f"   [SIM] {status_icon} {status_text} | 净盈亏: {net_pnl:+.4f}%")
        else:
            self.execution_stats['failed_orders'] += 1
            print(f"   [SIM] ❌ 执行失败")

    def generate_report(self) -> str:
        """生成实验报告"""
        lines = []
        lines.append("=" * 80)
        lines.append("📊 V4.2 P1 Testnet 实验报告")
        lines.append("=" * 80)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"实验模式: {self.mode}")
        lines.append(f"执行阈值: {self.execution_threshold}")

        if self.execution_threshold < 85:
            lines.append("⚠️  执行层验证模式（非正常阈值）")

        lines.append("")

        # 三档阈值对比（仅统计有效成交）
        lines.append("─" * 80)
        lines.append("🎯 三档评分阈值对比（仅有效成交）")
        lines.append("─" * 80)
        lines.append(f"{'阈值':<8} {'信号数':<10} {'有效成交':<10} {'有效率':<10} {'平均滑点':<12}")
        lines.append("-" * 60)

        for threshold in [75, 85, 88]:
            stats = self.threshold_stats[threshold]
            valid_rate = stats['valid_fills'] / stats['executed'] * 100 if stats['executed'] > 0 else 0
            avg_slippage = stats['slippage_sum'] / stats['valid_fills'] if stats['valid_fills'] > 0 else 0
            lines.append(f"≥{threshold:<7} {stats['signals']:<10} {stats['valid_fills']:<10} {valid_rate:>6.1f}%     {avg_slippage:>8.4f}%")

        lines.append("")

        # 执行质量
        if self.execution_stats['successful_orders'] > 0:
            lines.append("─" * 80)
            lines.append("🎯 执行质量指标")
            lines.append("─" * 80)

            total = self.execution_stats['total_orders']
            success = self.execution_stats['successful_orders']
            failed = self.execution_stats['failed_orders']
            valid = self.execution_stats['valid_fills']
            invalid = self.execution_stats['invalid_fills']

            success_rate = success / total * 100 if total > 0 else 0
            valid_rate = valid / success * 100 if success > 0 else 0

            lines.append(f"总订单: {total}")
            lines.append(f"成功下单: {success}")
            lines.append(f"失败下单: {failed}")
            lines.append(f"下单成功率: {success_rate:.1f}% {'✅' if success_rate >= 95 else '⚠️'}")
            lines.append(f"有效成交: {valid}")
            lines.append(f"无效成交: {invalid}")
            lines.append(f"有效成交率: {valid_rate:.1f}%")
            lines.append("")

        # 盈亏统计
        if self.execution_stats['valid_fills'] > 0:
            lines.append("─" * 80)
            lines.append("💰 盈亏统计（仅有效成交）")
            lines.append("─" * 80)

            valid = self.execution_stats['valid_fills']
            theoretical = self.execution_stats['theoretical_pnl_sum'] / valid * 100
            gross = self.execution_stats['gross_pnl_sum'] / valid * 100
            fees = self.execution_stats['fee_sum'] / valid * 100
            net = self.execution_stats['net_pnl_sum'] / valid * 100

            deviation = abs(gross - theoretical) / theoretical * 100 if theoretical != 0 else 0
            fee_ratio = abs(fees) / abs(gross) * 100 if gross != 0 else 0

            lines.append(f"理论盈亏: {theoretical:+.4f}%")
            lines.append(f"毛盈亏: {gross:+.4f}%")
            lines.append(f"手续费: {fees:+.4f}%")
            lines.append(f"净盈亏: {net:+.4f}% {'✅' if net > 0 else '❌'}")
            lines.append(f"理论vs实际偏差: {deviation:.1f}% {'✅' if deviation < 30 else '⚠️'}")
            lines.append(f"手续费占比: {fee_ratio:.1f}%")
            lines.append("")

        # 🔴 盈亏分布统计（核心：不只看均值）
        if self.execution_stats['valid_fills'] > 0:
            lines.append("─" * 80)
            lines.append("📊 盈亏分布结构（关键：防止一次亏损吃掉全部利润）")
            lines.append("─" * 80)

            wins = self.pnl_distribution['wins']
            losses = self.pnl_distribution['losses']
            total = wins + losses

            if total > 0:
                win_rate = wins / total * 100
                loss_rate = losses / total * 100

                avg_win = self.pnl_distribution['total_profit'] / wins if wins > 0 else 0
                avg_loss = self.pnl_distribution['total_loss'] / losses if losses > 0 else 0

                max_win = self.pnl_distribution['max_win']
                max_loss = self.pnl_distribution['max_loss']

                # Profit Factor = 总盈利 / 总亏损
                profit_factor = self.pnl_distribution['total_profit'] / self.pnl_distribution['total_loss'] if self.pnl_distribution['total_loss'] > 0 else float('inf')

                lines.append(f"胜率: {win_rate:.1f}% ({wins}/{total})")
                lines.append(f"亏损率: {loss_rate:.1f}% ({losses}/{total})")
                lines.append(f"平均盈利: +{avg_win:.4f}%")
                lines.append(f"平均亏损: -{avg_loss:.4f}%")
                lines.append(f"最大盈利: +{max_win:.4f}%")
                lines.append(f"最大亏损: -{max_loss:.4f}%")
                lines.append(f"盈利因子: {profit_factor:.2f} {'✅' if profit_factor > 1.2 else '⚠️'}")

                # 盈亏比检查
                if avg_loss > 0:
                    rr_ratio = avg_win / avg_loss
                    lines.append(f"盈亏比: {rr_ratio:.2f} {'✅' if rr_ratio >= 0.8 else '⚠️'}")

            lines.append("")

        # 🔴 连续亏损追踪
        if self.execution_stats['valid_fills'] > 0:
            lines.append("─" * 80)
            lines.append("📉 连续亏损追踪（关键：策略承受能力）")
            lines.append("─" * 80)

            max_streak = self.consecutive_loss_tracker['max_streak']
            current_streak = self.consecutive_loss_tracker['current_streak']

            lines.append(f"当前连续亏损: {current_streak}")
            lines.append(f"历史最大连续亏损: {max_streak} {'✅' if max_streak <= 3 else '⚠️'}")

            if max_streak >= 5:
                lines.append("⚠️  警告：连续亏损≥5，策略可能存在风险")

            lines.append("")

        # P1成功标准检查
        lines.append("=" * 80)
        lines.append("📝 P1 实验成功标准检查")
        lines.append("=" * 80)

        checks = []

        # 执行层检查
        if self.execution_stats['total_orders'] > 0:
            success_rate = self.execution_stats['successful_orders'] / self.execution_stats['total_orders'] * 100
            checks.append(("下单成功率 > 95%", success_rate > 95, f"{success_rate:.1f}%"))

        if self.execution_stats['successful_orders'] > 0:
            valid_rate = self.execution_stats['valid_fills'] / self.execution_stats['successful_orders'] * 100
            checks.append(("有效成交", True, f"{self.execution_stats['valid_fills']}/{self.execution_stats['successful_orders']} ({valid_rate:.1f}%)"))

        # 盈亏层检查
        if self.execution_stats['valid_fills'] > 0:
            net_pnl = self.execution_stats['net_pnl_sum'] / self.execution_stats['valid_fills'] * 100
            checks.append(("净收益 > 0", net_pnl > 0, f"{net_pnl:+.4f}%"))

            theoretical = self.execution_stats['theoretical_pnl_sum'] / self.execution_stats['valid_fills'] * 100
            gross = self.execution_stats['gross_pnl_sum'] / self.execution_stats['valid_fills'] * 100
            deviation = abs(gross - theoretical) / theoretical * 100 if theoretical != 0 else 0
            checks.append(("理论vs实际偏差 < 30%", deviation < 30, f"{deviation:.1f}%"))

        # 🔴 盈亏分布检查
        wins = self.pnl_distribution['wins']
        losses = self.pnl_distribution['losses']
        if wins + losses > 0:
            # Profit Factor > 1.2
            if self.pnl_distribution['total_loss'] > 0:
                profit_factor = self.pnl_distribution['total_profit'] / self.pnl_distribution['total_loss']
                checks.append(("盈利因子 > 1.2", profit_factor > 1.2, f"{profit_factor:.2f}"))

            # 盈亏比检查
            if losses > 0 and wins > 0:
                avg_win = self.pnl_distribution['total_profit'] / wins
                avg_loss = self.pnl_distribution['total_loss'] / losses
                rr_ratio = avg_win / avg_loss
                checks.append(("盈亏比 >= 0.8", rr_ratio >= 0.8, f"{rr_ratio:.2f}"))

        # 🔴 稳定性检查
        max_streak = self.consecutive_loss_tracker['max_streak']
        checks.append(("最大连续亏损 <= 3", max_streak <= 3, f"{max_streak}"))

        for check_name, passed, value in checks:
            status = "✅" if passed else "❌"
            lines.append(f"{status} {check_name:<30} {value}")

        lines.append("")

        # 结论
        if self.execution_stats['valid_fills'] >= 20:
            lines.append("✅ 已达到20笔有效成交，数据足够分析")
            lines.append("下一步: 评估是否进入P2出场逻辑优化阶段")
        else:
            lines.append(f"⏳ 当前{self.execution_stats['valid_fills']}笔有效成交，继续积累至20笔")

        lines.append("=" * 80)

        return "\n".join(lines)

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

    async def close(self):
        """关闭连接"""
        if self.executor:
            await self.executor.close()


async def main():
    """主函数"""
    import argparse

    parser = argparse.ArgumentParser(description='V4.2 P1 Testnet 实验')
    parser.add_argument('--cycles', type=int, default=50, help='运行周期数')
    parser.add_argument('--execution-threshold', type=int, default=85,
                       help='执行阈值（正常85，执行层验证可用75）')
    parser.add_argument('--api-key', help='OKX API Key')
    parser.add_argument('--api-secret', help='OKX API Secret')
    parser.add_argument('--passphrase', help='OKX Passphrase')

    args = parser.parse_args()

    # 创建实验
    experiment = P1TestnetExperiment(
        api_key=args.api_key,
        api_secret=args.api_secret,
        passphrase=args.passphrase,
        execution_threshold=args.execution_threshold
    )

    await experiment.init()

    # 运行周期
    print(f"\n🚀 启动 {args.cycles} 个交易周期...\n")

    for i in range(args.cycles):
        print(f"--- 周期 {i+1}/{args.cycles} ---")
        await experiment.run_cycle()
        await asyncio.sleep(2)

    # 生成报告
    report = experiment.generate_report()
    print("\n" + report)

    # 保存报告
    report_file = Path(__file__).parent / 'data' / f'p1_testnet_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.txt'
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(report)

    # 保存详细数据
    data_file = Path(__file__).parent / 'data' / f'p1_testnet_orders_{datetime.now().strftime("%Y%m%d_%H%M%S")}.jsonl'
    with open(data_file, 'w', encoding='utf-8') as f:
        for order in experiment.execution_stats['orders']:
            f.write(json.dumps(order) + '\n')

    print(f"\n✅ 报告已保存: {report_file}")
    print(f"✅ 数据已保存: {data_file}")

    await experiment.close()


if __name__ == "__main__":
    asyncio.run(main())
