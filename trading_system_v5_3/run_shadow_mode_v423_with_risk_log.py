#!/usr/bin/env python3
"""
V4.2.3 影子模式 + 风控验证日志
新增：止损触发记录、连续止损检测、ETH时段分析
"""

import asyncio
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List
import pandas as pd
import numpy as np
import json

sys.path.insert(0, str(Path(__file__).parent / 'core'))

from enhanced_analyzer import EnhancedAnalyzer
from scoring_engine_v423 import ScoringEngineV423


class ShadowModeV423RiskLog(EnhancedAnalyzer):
    """
    V4.2.3 影子模式 + 风控验证
    新增风控日志：止损触发、连续止损、ETH时段分析
    """
    
    def __init__(self):
        symbols = ['BTC/USDT:USDT', 'ETH/USDT:USDT']
        super().__init__(symbols=symbols)
        self.scoring_engine = ScoringEngineV423()
        
        # 风控配置
        self.stop_loss_pct = -0.15  # 硬止损 -0.15%
        self.cooldown_after_consecutive = 3  # 连续3次止损触发冷却
        
        # 加载已有样本
        self._load_existing_samples()
        
        # 风控日志
        self.risk_log = {
            'stop_loss_triggers': [],  # 止损触发记录
            'consecutive_losses': [],  # 连续亏损序列
            'eth_afternoon_samples': [],  # ETH下午样本
            'daily_stats': {}  # 每日统计
        }
        
        self._load_risk_log()
        
        print("=" * 80)
        print("🚀 V4.2.3 影子模式 + 风控验证")
        print("=" * 80)
        print("⚠️  重要提示：此版本仅在V4.2影子实验线运行")
        print("🚫 不接入V4.1执行层，不做真实下单")
        print("")
        print("📋 V4.2.3 风控配置:")
        print(f"  硬止损: {self.stop_loss_pct}%")
        print(f"  连续止损熔断: {self.cooldown_after_consecutive}次")
        print("")
        print(f"📊 当前V4.2.3样本: {len(self.all_results)} 条")
        print(f"🎯 目标样本: 80+ 条 (上线前验证)")
        print("")
    
    def _load_existing_samples(self):
        """加载已有V4.2.3样本"""
        shadow_file = self.data_dir / 'shadow_v423_samples.jsonl'
        if shadow_file.exists():
            with open(shadow_file, 'r') as f:
                for line in f:
                    try:
                        sample = json.loads(line.strip())
                        self.all_results.append(sample)
                    except:
                        pass
            print(f"✅ 已加载已有V4.2.3样本: {len(self.all_results)} 条")
    
    def _load_risk_log(self):
        """加载风控日志"""
        risk_log_file = self.data_dir / 'shadow_v423_risk_log.json'
        if risk_log_file.exists():
            with open(risk_log_file, 'r') as f:
                self.risk_log = json.load(f)
            print(f"✅ 已加载风控日志:")
            print(f"   止损触发: {len(self.risk_log.get('stop_loss_triggers', []))} 次")
            print(f"   连续亏损序列: {len(self.risk_log.get('consecutive_losses', []))} 个")
    
    def _save_risk_log(self):
        """保存风控日志"""
        risk_log_file = self.data_dir / 'shadow_v423_risk_log.json'
        with open(risk_log_file, 'w') as f:
            json.dump(self.risk_log, f, indent=2)
        print(f"\n💾 风控日志已保存: {risk_log_file}")
    
    def _check_stop_loss(self, sample: Dict) -> Dict:
        """检查是否触发止损"""
        original_return = sample['outcome']['change_60s_pct']
        
        if original_return < self.stop_loss_pct:
            # 触发止损
            stop_loss_record = {
                'timestamp': sample['timestamp'],
                'symbol': sample['symbol'],
                'original_return': original_return,
                'stopped_return': self.stop_loss_pct,
                'score': sample['v423_total_score'],
                'volume_ratio': sample['market_state']['volume_ratio'],
                'hour': self._extract_hour(sample['timestamp'])
            }
            self.risk_log['stop_loss_triggers'].append(stop_loss_record)
            
            return {
                'triggered': True,
                'original': original_return,
                'stopped': self.stop_loss_pct,
                'saved': self.stop_loss_pct - original_return
            }
        
        return {'triggered': False, 'original': original_return}
    
    def _extract_hour(self, timestamp: str) -> int:
        """提取小时"""
        try:
            if ' ' in timestamp:
                return int(timestamp.split(' ')[1].split(':')[0])
            return 0
        except:
            return 0
    
    def _detect_consecutive_losses(self):
        """检测连续亏损序列"""
        if len(self.all_results) < 3:
            return
        
        # 按时间排序
        sorted_samples = sorted(self.all_results, key=lambda x: x['timestamp'])
        
        # 检查止损触发
        current_streak = 0
        streak_start = None
        
        for sample in sorted_samples:
            original_return = sample['outcome']['change_60s_pct']
            
            if original_return < self.stop_loss_pct:
                # 触发止损
                if current_streak == 0:
                    streak_start = sample['timestamp']
                current_streak += 1
            else:
                # 未触发止损
                if current_streak >= self.cooldown_after_consecutive:
                    # 记录连续亏损序列
                    self.risk_log['consecutive_losses'].append({
                        'start': streak_start,
                        'end': sample['timestamp'],
                        'count': current_streak,
                        'samples': [s['timestamp'] for s in sorted_samples if streak_start <= s['timestamp'] <= sample['timestamp']]
                    })
                current_streak = 0
                streak_start = None
    
    def _track_eth_afternoon(self, sample: Dict):
        """追踪ETH下午样本"""
        if 'ETH' not in sample['symbol']:
            return
        
        hour = self._extract_hour(sample['timestamp'])
        if 12 <= hour < 18:
            self.risk_log['eth_afternoon_samples'].append({
                'timestamp': sample['timestamp'],
                'return_60s': sample['outcome']['change_60s_pct'],
                'score': sample['v423_total_score'],
                'volume_ratio': sample['market_state']['volume_ratio']
            })
    
    async def collect_samples(self, hours: int = 24):
        """收集新样本"""
        for symbol in self.symbols:
            print(f"\n{'='*60}")
            print(f"📊 V4.2.3+风控 收集 {symbol} 样本...")
            print(f"{'='*60}")
            
            df = await self.fetch_historical_ohlcv(symbol, hours)
            if df is None or len(df) < 30:
                continue
            
            new_samples = []
            
            for i in range(30, len(df) - 3):
                window = df.iloc[i-30:i]
                current = df.iloc[i]
                future_30s = df.iloc[i+1] if i+1 < len(df) else None
                future_60s = df.iloc[i+2] if i+2 < len(df) else None
                future_120s = df.iloc[i+3] if i+3 < len(df) else None
                
                # 使用V4.2.3评分引擎
                score_breakdown = self.scoring_engine.calculate_score(
                    ohlcv_df=window,
                    current_price=current['close'],
                    spread_bps=2.0,
                    rl_decision='ALLOW'
                )
                
                if not score_breakdown.is_qualified:
                    continue
                
                outcome = self._calc_outcome(current, future_30s, future_60s, future_120s)
                
                sample = {
                    'symbol': symbol,
                    'timestamp': str(current['timestamp']),
                    'price': float(current['close']),
                    'v423_score_breakdown': {
                        'trend_consistency': score_breakdown.trend_consistency,
                        'pullback_breakout': score_breakdown.pullback_breakout,
                        'volume_confirm': score_breakdown.volume_confirm,
                        'spread_quality': score_breakdown.spread_quality,
                        'volatility_range': score_breakdown.volatility_range,
                        'rl_filter': score_breakdown.rl_filter,
                    },
                    'v423_total_score': score_breakdown.total_score,
                    'v423_filter_reason': score_breakdown.filter_reason,
                    'market_state': {
                        'volume_ratio': self._calc_volume_ratio(window),
                    },
                    'outcome': outcome
                }
                
                # 风控检查
                stop_loss_check = self._check_stop_loss(sample)
                sample['risk_check'] = stop_loss_check
                
                # 追踪ETH下午
                self._track_eth_afternoon(sample)
                
                new_samples.append(sample)
            
            print(f"✅ {symbol} 新增 {len(new_samples)} 条V4.2.3达标样本")
            self.all_results.extend(new_samples)
        
        # 检测连续亏损
        self._detect_consecutive_losses()
    
    def _calc_volume_ratio(self, df: pd.DataFrame) -> float:
        try:
            current_vol = df['volume'].iloc[-1]
            avg_vol = df['volume'].tail(20).mean()
            return float(current_vol / avg_vol) if avg_vol > 0 else 0.0
        except:
            return 0.0
    
    def _calc_outcome(self, current, future_30s, future_60s, future_120s):
        current_price = float(current['close'])
        outcome = {}
        
        if future_30s is not None:
            outcome['change_30s_pct'] = float((future_30s['close'] - current_price) / current_price * 100)
        else:
            outcome['change_30s_pct'] = 0.0
        
        if future_60s is not None:
            outcome['change_60s_pct'] = float((future_60s['close'] - current_price) / current_price * 100)
        else:
            outcome['change_60s_pct'] = 0.0
        
        if future_120s is not None:
            outcome['change_120s_pct'] = float((future_120s['close'] - current_price) / current_price * 100)
        else:
            outcome['change_120s_pct'] = 0.0
        
        outcome['is_direction_correct'] = abs(outcome['change_60s_pct']) > 0.05
        
        return outcome
    
    def save_samples(self):
        """保存样本"""
        shadow_file = self.data_dir / 'shadow_v423_samples.jsonl'
        with open(shadow_file, 'w') as f:
            for sample in self.all_results:
                f.write(json.dumps(sample) + '\n')
        print(f"\n💾 V4.2.3样本已保存: {shadow_file}")
    
    def generate_risk_report(self) -> str:
        """生成风控验证报告"""
        lines = []
        lines.append("=" * 80)
        lines.append("🛡️ V4.2.3 风控验证报告")
        lines.append("⚠️  上线前验证阶段 (Pre-Production Validation)")
        lines.append("=" * 80)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"V4.2.3总样本数: {len(self.all_results)}")
        lines.append(f"硬止损档位: {self.stop_loss_pct}%")
        lines.append("")
        
        # 1. 止损触发统计
        lines.append("─" * 80)
        lines.append("🛡️ 止损触发统计")
        lines.append("─" * 80)
        
        stop_triggers = self.risk_log.get('stop_loss_triggers', [])
        if stop_triggers:
            trigger_rate = len(stop_triggers) / len(self.all_results) * 100 if self.all_results else 0
            lines.append(f"止损触发次数: {len(stop_triggers)}")
            lines.append(f"止损触发率: {trigger_rate:.1f}%")
            lines.append(f"目标范围: 15%-30%")
            
            if 15 <= trigger_rate <= 30:
                lines.append(f"✅ 触发率在目标范围内")
            elif trigger_rate < 15:
                lines.append(f"⚠️  触发率偏低，止损可能过宽")
            else:
                lines.append(f"⚠️  触发率偏高，策略质量可能不足")
            
            # 按品种统计
            btc_triggers = [t for t in stop_triggers if 'BTC' in t['symbol']]
            eth_triggers = [t for t in stop_triggers if 'ETH' in t['symbol']]
            
            lines.append(f"\n按品种:")
            lines.append(f"  BTC: {len(btc_triggers)} 次")
            lines.append(f"  ETH: {len(eth_triggers)} 次")
            
            # 按时段统计
            afternoon_triggers = [t for t in stop_triggers if 12 <= t['hour'] < 18]
            lines.append(f"\n下午(12-18)触发: {len(afternoon_triggers)} 次 ({len(afternoon_triggers)/len(stop_triggers)*100:.1f}%)")
        else:
            lines.append("暂无止损触发记录")
        
        lines.append("")
        
        # 2. 连续亏损检测
        lines.append("─" * 80)
        lines.append("🔥 连续亏损熔断检测")
        lines.append("─" * 80)
        
        consecutive = self.risk_log.get('consecutive_losses', [])
        if consecutive:
            lines.append(f"检测到连续亏损序列: {len(consecutive)} 个")
            lines.append(f"熔断阈值: {self.cooldown_after_consecutive}次")
            
            for i, seq in enumerate(consecutive[-3:], 1):  # 显示最近3个
                lines.append(f"\n序列 {i}:")
                lines.append(f"  时间: {seq['start']} → {seq['end']}")
                lines.append(f"  连续次数: {seq['count']}")
                lines.append(f"  ⚠️  未来需要冷却机制")
        else:
            lines.append(f"✅ 未检测到连续{self.cooldown_after_consecutive}次止损序列")
        
        lines.append("")
        
        # 3. ETH下午时段分析
        lines.append("─" * 80)
        lines.append("🪙 ETH下午(12-18)时段风险分析")
        lines.append("─" * 80)
        
        eth_afternoon = self.risk_log.get('eth_afternoon_samples', [])
        if eth_afternoon:
            returns = [s['return_60s'] for s in eth_afternoon]
            avg_return = np.mean(returns)
            
            lines.append(f"ETH下午样本数: {len(eth_afternoon)}")
            lines.append(f"平均收益: {avg_return:+.4f}%")
            
            losses = [r for r in returns if r < self.stop_loss_pct]
            if losses:
                lines.append(f"触发止损: {len(losses)} 次 ({len(losses)/len(returns)*100:.1f}%)")
                lines.append(f"⚠️  ETH下午时段风险较高")
            else:
                lines.append(f"✅ 未触发止损")
            
            # 按成交量分析
            low_vol = [s for s in eth_afternoon if s['volume_ratio'] < 1.05]
            if low_vol:
                low_vol_returns = [s['return_60s'] for s in low_vol]
                lines.append(f"\n低成交量(<1.05x)样本: {len(low_vol)}")
                lines.append(f"平均收益: {np.mean(low_vol_returns):+.4f}%")
                lines.append(f"⚠️  ETH低成交量时段需谨慎")
        else:
            lines.append("暂无ETH下午样本")
        
        lines.append("")
        
        # 4. 止损效果验证
        lines.append("─" * 80)
        lines.append("📊 止损效果验证")
        lines.append("─" * 80)
        
        if self.all_results:
            original_returns = [s['outcome']['change_60s_pct'] for s in self.all_results]
            
            # 模拟止损后的收益
            stopped_returns = []
            for ret in original_returns:
                if ret < self.stop_loss_pct:
                    stopped_returns.append(self.stop_loss_pct)
                else:
                    stopped_returns.append(ret)
            
            original_returns = np.array(original_returns)
            stopped_returns = np.array(stopped_returns)
            
            # 原始统计
            orig_profits = original_returns[original_returns > 0]
            orig_losses = original_returns[original_returns < 0]
            orig_win_rate = len(orig_profits) / len(original_returns) * 100
            orig_pl_ratio = np.mean(orig_profits) / abs(np.mean(orig_losses)) if len(orig_losses) > 0 else 0
            
            # 止损后统计
            stop_profits = stopped_returns[stopped_returns > 0]
            stop_losses = stopped_returns[stopped_returns < 0]
            stop_win_rate = len(stop_profits) / len(stopped_returns) * 100
            stop_pl_ratio = np.mean(stop_profits) / abs(np.mean(stop_losses)) if len(stop_losses) > 0 else 0
            
            lines.append(f"{'指标':<20} {'原始':<15} {'止损后':<15} {'变化':<15}")
            lines.append("-" * 80)
            lines.append(f"{'均值':<20} {np.mean(original_returns):>+.4f}%{'':<8} {np.mean(stopped_returns):>+.4f}%{'':<8} {np.mean(stopped_returns)-np.mean(original_returns):>+.4f}%")
            lines.append(f"{'中位数':<20} {np.median(original_returns):>+.4f}%{'':<8} {np.median(stopped_returns):>+.4f}%{'':<8} -")
            lines.append(f"{'标准差':<20} {np.std(original_returns):>.4f}%{'':<8} {np.std(stopped_returns):>.4f}%{'':<8} {np.std(stopped_returns)-np.std(original_returns):>.4f}%")
            lines.append(f"{'最小值':<20} {np.min(original_returns):>+.4f}%{'':<8} {np.min(stopped_returns):>+.4f}%{'':<8} ✅ 锁定")
            lines.append(f"{'胜率':<20} {orig_win_rate:>.1f}%{'':<10} {stop_win_rate:>.1f}%{'':<10} -")
            lines.append(f"{'盈亏比':<20} {orig_pl_ratio:>.2f}{'':<12} {stop_pl_ratio:>.2f}{'':<12} {'✅ 提升' if stop_pl_ratio > orig_pl_ratio else ''}")
            
            if stop_pl_ratio >= 1.0:
                lines.append(f"\n🎉 盈亏比突破1.0！策略进入稳定正期望区间")
        
        lines.append("")
        
        # 5. 阶段判断
        lines.append("=" * 80)
        lines.append("🎯 阶段判断")
        lines.append("=" * 80)
        
        if len(self.all_results) < 50:
            lines.append(f"⏳ 样本积累中: {len(self.all_results)}/50")
            lines.append("  建议: 继续运行影子模式")
        elif len(self.all_results) < 80:
            lines.append(f"⏳ 接近安全线: {len(self.all_results)}/80")
            lines.append("  建议: 再积累一些样本后做全面分析")
        else:
            lines.append(f"✅ 样本充足: {len(self.all_results)} 条")
            lines.append("  建议: 可以评估是否进入上线准备阶段")
        
        lines.append("")
        lines.append("📋 风控验证状态:")
        
        # 检查关键指标
        if stop_triggers:
            trigger_rate = len(stop_triggers) / len(self.all_results) * 100
            if 15 <= trigger_rate <= 30:
                lines.append("  ✅ 止损触发率在目标范围内(15%-30%)")
            else:
                lines.append(f"  ⏸️ 止损触发率{trigger_rate:.1f}%，需继续观察")
        
        if not consecutive:
            lines.append("  ✅ 未检测到连续止损序列")
        else:
            lines.append(f"  ⚠️ 检测到{len(consecutive)}个连续止损序列，需关注")
        
        if eth_afternoon:
            returns = [s['return_60s'] for s in eth_afternoon]
            if np.mean(returns) < 0:
                lines.append("  ⚠️ ETH下午时段平均收益为负，建议限时段或降仓")
            else:
                lines.append("  ✅ ETH下午时段平均收益为正")
        
        lines.append("")
        lines.append("=" * 80)
        lines.append("⚠️  当前阶段: 上线前验证 (Pre-Production Validation)")
        lines.append("🚫 不接入执行层")
        lines.append("🎯 目标: 确认策略'不会在某一天把钱全吐回去'")
        lines.append("=" * 80)
        
        return "\n".join(lines)


async def main():
    """主函数"""
    shadow = ShadowModeV423RiskLog()
    
    # 收集新样本
    await shadow.collect_samples(hours=24)
    
    # 保存
    shadow.save_samples()
    shadow._save_risk_log()
    
    # 生成报告
    report = shadow.generate_risk_report()
    print(report)
    
    # 保存报告
    report_file = shadow.data_dir / 'shadow_v423_risk_report.txt'
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(f"\n✅ 风控验证报告已保存: {report_file}")
    
    # 样本量检查
    if len(shadow.all_results) >= 80:
        print("\n🎉 V4.2.3样本量已达 80+，可以评估上线准备！")
    elif len(shadow.all_results) >= 50:
        print(f"\n⏳ V4.2.3当前样本: {len(shadow.all_results)}/80，建议继续运行")
    else:
        print(f"\n⏳ V4.2.3当前样本: {len(shadow.all_results)}/50，继续积累中")
    
    print("\n" + "=" * 80)
    print("⚠️  重要提醒：V4.2.3仅在影子实验线运行")
    print("🚫 不接入V4.1执行层")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(main())
