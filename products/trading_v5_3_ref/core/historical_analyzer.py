#!/usr/bin/env python3
"""
Historical Data Replay & Analysis - 历史数据回放与分析
分析过往一天数据，对比 V4.1 和 V4.2，包含后验表现分析
"""

import asyncio
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Tuple
import logging

# 添加路径
import sys
sys.path.insert(0, str(Path(__file__).parent))

from scoring_engine import ScoringEngine, ScoreBreakdown

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class HistoricalDataAnalyzer:
    """历史数据分析器"""
    
    def __init__(self):
        """初始化分析器"""
        self.scoring_engine = ScoringEngine()
        self.results = []
        self.data_dir = Path(__file__).parent.parent / 'data'
        self.data_dir.mkdir(exist_ok=True)
        
        self.output_file = self.data_dir / 'historical_analysis.jsonl'
        self.report_file = self.data_dir / 'historical_comparison_report.txt'
        
    async def fetch_historical_ohlcv(self, symbol: str, hours: int = 24) -> pd.DataFrame:
        """获取历史 OHLCV 数据"""
        import ccxt
        
        exchange = ccxt.okx({
            'proxies': {
                'http': 'http://127.0.0.1:7890',
                'https': 'http://127.0.0.1:7890'
            }
        })
        
        # 获取过去N小时的1分钟K线
        since = int((datetime.now() - timedelta(hours=hours)).timestamp() * 1000)
        limit = hours * 60  # 每小时60根1分钟K线
        
        logger.info(f"📊 获取 {symbol} 过去 {hours} 小时数据...")
        
        ohlcv = exchange.fetch_ohlcv(symbol, '1m', since=since, limit=limit)
        
        df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
        df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
        
        logger.info(f"   获取到 {len(df)} 条 K线数据")
        
        return df
    
    def analyze_historical_data(self, df: pd.DataFrame, symbol: str) -> List[Dict]:
        """分析历史数据"""
        results = []
        
        # 滑动窗口评估
        window_size = 50  # 50根K线作为评估窗口
        step = 10  # 每10根K线评估一次
        
        for i in range(window_size, len(df), step):
            window_df = df.iloc[i-window_size:i]
            current_price = df.iloc[i]['close']
            timestamp = df.iloc[i]['timestamp']
            
            # 模拟市场状态
            spread_bps = self._estimate_spread(window_df)
            volume_ratio = self._calc_volume_ratio(window_df)
            volatility = self._calc_volatility(window_df)
            
            # V4.1 规则信号（简化版）
            rule_signal = self._get_v41_signal(window_df)
            
            # V4.2 评分
            breakdown = self.scoring_engine.calculate_score(
                ohlcv_df=window_df,
                current_price=current_price,
                spread_bps=spread_bps,
                rl_decision='ALLOW'  # 默认放行
            )
            
            # 后验：检查未来30秒/60秒价格变化
            if i + 1 < len(df):
                price_30s = df.iloc[min(i+1, len(df)-1)]['close']
                price_60s = df.iloc[min(i+2, len(df)-1)]['close']
                
                change_30s = (price_30s - current_price) / current_price * 100
                change_60s = (price_60s - current_price) / current_price * 100
            else:
                change_30s = 0
                change_60s = 0
            
            # 假突破判断
            is_fake_breakout = self._check_fake_breakout(change_30s, change_60s)
            
            # 短期方向正确性
            is_direction_correct = self._check_direction_correct(
                breakdown.is_qualified,
                change_60s
            )
            
            result = {
                'timestamp': timestamp.isoformat(),
                'symbol': symbol,
                'price': float(current_price),
                'rule_signal': rule_signal,
                'v42_total_score': int(breakdown.total_score),
                'v42_is_qualified': bool(breakdown.is_qualified),
                'v42_score_breakdown': {
                    'trend_consistency': int(breakdown.trend_consistency),
                    'pullback_breakout': int(breakdown.pullback_breakout),
                    'volume_confirm': int(breakdown.volume_confirm),
                    'spread_quality': int(breakdown.spread_quality),
                    'volatility_range': int(breakdown.volatility_range),
                    'rl_filter': int(breakdown.rl_filter)
                },
                'market_state': {
                    'spread_bps': float(spread_bps),
                    'volume_ratio': float(volume_ratio),
                    'volatility': float(volatility)
                },
                'outcome': {
                    'change_30s_pct': float(change_30s),
                    'change_60s_pct': float(change_60s),
                    'is_fake_breakout': bool(is_fake_breakout),
                    'is_direction_correct': bool(is_direction_correct)
                }
            }
            
            results.append(result)
        
        return results
    
    def _estimate_spread(self, df: pd.DataFrame) -> float:
        """估算点差 (bps)"""
        # 基于高低价差估算
        high_low_spread = (df['high'] - df['low']) / df['close'].iloc[-1] * 10000
        return min(high_low_spread.mean() * 0.1, 5.0)  # 估算点差，最大5bps
    
    def _calc_volume_ratio(self, df: pd.DataFrame) -> float:
        """计算成交量比率"""
        current_vol = df['volume'].iloc[-1]
        avg_vol = df['volume'].iloc[:-1].mean()
        return current_vol / avg_vol if avg_vol > 0 else 1.0
    
    def _calc_volatility(self, df: pd.DataFrame) -> float:
        """计算波动率"""
        returns = df['close'].pct_change().dropna()
        return returns.std()
    
    def _get_v41_signal(self, df: pd.DataFrame) -> str:
        """获取 V4.1 规则信号（简化版）"""
        # 简化的 V4.1 规则
        ema_fast = df['close'].ewm(span=9, adjust=False).mean().iloc[-1]
        ema_slow = df['close'].ewm(span=21, adjust=False).mean().iloc[-1]
        
        if ema_fast > ema_slow * 1.001:
            return 'BUY'
        elif ema_fast < ema_slow * 0.999:
            return 'SELL'
        else:
            return 'HOLD'
    
    def _check_fake_breakout(self, change_30s: float, change_60s: float) -> bool:
        """检查是否假突破"""
        # 如果30秒变化 > 0.1% 但60秒变化 < 0.05%，可能是假突破
        if abs(change_30s) > 0.1 and abs(change_60s) < 0.05:
            return True
        return False
    
    def _check_direction_correct(self, is_qualified: bool, change_60s: float) -> bool:
        """检查短期方向是否正确"""
        if not is_qualified:
            return False
        # 如果达标且60秒变化 > 0.05%，方向正确
        return abs(change_60s) > 0.05
    
    def generate_comparison_report(self, results: List[Dict]) -> str:
        """生成完整对比报告"""
        lines = []
        lines.append("=" * 80)
        lines.append("📊 V4.1 vs V4.2 历史数据对比报告 (过去24小时)")
        lines.append("=" * 80)
        lines.append(f"分析时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"样本总数: {len(results)}")
        lines.append("")
        
        # 1. 候选信号频率统计
        lines.append(self._gen_signal_frequency_report(results))
        
        # 2. 与 V4.1 规则信号差异统计
        lines.append(self._gen_v41_comparison_report(results))
        
        # 3. 后验表现分析
        lines.append(self._gen_outcome_report(results))
        
        # 4. 分项得分分布
        lines.append(self._gen_score_breakdown_report(results))
        
        # 5. 结论与建议
        lines.append(self._gen_conclusion_report(results))
        
        lines.append("=" * 80)
        
        return "\n".join(lines)
    
    def _gen_signal_frequency_report(self, results: List[Dict]) -> str:
        """候选信号频率报告"""
        lines = []
        lines.append("─" * 80)
        lines.append("📈 1. 候选信号频率统计")
        lines.append("─" * 80)
        
        total = len(results)
        qualified = sum(1 for r in results if r.get('v42_is_qualified'))
        qualified_rate = (qualified / total * 100) if total > 0 else 0
        
        lines.append(f"总评估次数: {total}")
        lines.append(f"达标信号数: {qualified}")
        lines.append(f"拒绝信号数: {total - qualified}")
        lines.append(f"达标率: {qualified_rate:.1f}%")
        lines.append("")
        
        # 每小时统计
        hourly_stats = {}
        for r in results:
            ts = r.get('timestamp', '')
            if ts:
                try:
                    dt = datetime.fromisoformat(ts)
                    hour_key = dt.strftime('%Y-%m-%d %H:00')
                    
                    if hour_key not in hourly_stats:
                        hourly_stats[hour_key] = {'total': 0, 'qualified': 0}
                    
                    hourly_stats[hour_key]['total'] += 1
                    if r.get('v42_is_qualified'):
                        hourly_stats[hour_key]['qualified'] += 1
                except:
                    pass
        
        lines.append("每小时候选信号数:")
        for hour, stats in sorted(hourly_stats.items())[-10:]:
            lines.append(f"  {hour}: 评估 {stats['total']:>3} 次 | 达标 {stats['qualified']:>3} 次")
        
        lines.append("")
        if qualified_rate > 30:
            lines.append("💡 结论: V4.2 评分标准宽松，候选信号较多，可能适合高频小波段交易")
        elif qualified_rate > 10:
            lines.append("💡 结论: V4.2 评分标准适中，需观察后验表现")
        else:
            lines.append("💡 结论: V4.2 评分标准严格，候选信号稀少，可能过于保守")
        
        return "\n".join(lines)
    
    def _gen_v41_comparison_report(self, results: List[Dict]) -> str:
        """V4.1 规则信号差异报告"""
        lines = []
        lines.append("─" * 80)
        lines.append("🔄 2. 与 V4.1 规则信号差异统计")
        lines.append("─" * 80)
        
        v41_none_v42_qualified = 0
        v41_signal_v42_not_qualified = 0
        both_agree = 0
        
        for r in results:
            rule_signal = r.get('rule_signal', 'HOLD')
            v42_qualified = r.get('v42_is_qualified', False)
            rule_has_signal = rule_signal in ['BUY', 'SELL']
            
            if not rule_has_signal and v42_qualified:
                v41_none_v42_qualified += 1
            elif rule_has_signal and not v42_qualified:
                v41_signal_v42_not_qualified += 1
            elif rule_has_signal and v42_qualified:
                both_agree += 1
        
        lines.append(f"V4.1无信号，但V4.2达标: {v41_none_v42_qualified} 次")
        lines.append(f"V4.1有信号，但V4.2不达标: {v41_signal_v42_not_qualified} 次")
        lines.append(f"两者同时看多/看空: {both_agree} 次")
        lines.append("")
        
        # 关键判断
        if v41_none_v42_qualified > v41_signal_v42_not_qualified * 2:
            lines.append("💡 结论: V4.2 主要在【补机会】，捕获了更多潜在信号")
        elif v41_signal_v42_not_qualified > v41_none_v42_qualified * 2:
            lines.append("💡 结论: V4.2 主要在【过滤噪音】，拒绝了部分V4.1信号")
        else:
            lines.append("💡 结论: V4.1 和 V4.2 信号基本一致")
        
        # 补机会样本详情
        if v41_none_v42_qualified > 0:
            lines.append("")
            lines.append(f"📋 V4.1无信号但V4.2达标样本 ({v41_none_v42_qualified}条):")
            count = 0
            for r in results:
                if r.get('rule_signal') == 'HOLD' and r.get('v42_is_qualified'):
                    if count < 5:
                        lines.append(f"  - {r.get('timestamp')} | 价格: {r.get('price'):.2f} | 评分: {r.get('v42_total_score')}")
                    count += 1
            if count > 5:
                lines.append(f"  ... 还有 {count - 5} 条")
        
        return "\n".join(lines)
    
    def _gen_outcome_report(self, results: List[Dict]) -> str:
        """后验表现报告"""
        lines = []
        lines.append("─" * 80)
        lines.append("🔬 3. 后验表现分析")
        lines.append("─" * 80)
        
        qualified_results = [r for r in results if r.get('v42_is_qualified')]
        
        if not qualified_results:
            lines.append("⚠️  无达标信号，无法分析后验表现")
            return "\n".join(lines)
        
        # 30秒价格变化
        changes_30s = [r['outcome']['change_30s_pct'] for r in qualified_results]
        avg_30s = np.mean(changes_30s)
        std_30s = np.std(changes_30s)
        
        # 60秒价格变化
        changes_60s = [r['outcome']['change_60s_pct'] for r in qualified_results]
        avg_60s = np.mean(changes_60s)
        std_60s = np.std(changes_60s)
        
        # 假突破率
        fake_breakouts = sum(1 for r in qualified_results if r['outcome']['is_fake_breakout'])
        fake_rate = (fake_breakouts / len(qualified_results) * 100) if qualified_results else 0
        
        # 方向正确率
        correct_dirs = sum(1 for r in qualified_results if r['outcome']['is_direction_correct'])
        correct_rate = (correct_dirs / len(qualified_results) * 100) if qualified_results else 0
        
        lines.append(f"达标信号数: {len(qualified_results)}")
        lines.append("")
        lines.append("📊 价格变化统计:")
        lines.append(f"  30秒平均变化: {avg_30s:+.3f}% (σ={std_30s:.3f}%)")
        lines.append(f"  60秒平均变化: {avg_60s:+.3f}% (σ={std_60s:.3f}%)")
        lines.append("")
        lines.append("📊 风险指标:")
        lines.append(f"  假突破率: {fake_rate:.1f}% ({fake_breakouts}/{len(qualified_results)})")
        lines.append(f"  方向正确率: {correct_rate:.1f}% ({correct_dirs}/{len(qualified_results)})")
        lines.append("")
        
        # 分位数分析
        lines.append("📊 分位数分析:")
        lines.append(f"  30秒变化 - 25%: {np.percentile(changes_30s, 25):.3f}%, 50%: {np.percentile(changes_30s, 50):.3f}%, 75%: {np.percentile(changes_30s, 75):.3f}%")
        lines.append(f"  60秒变化 - 25%: {np.percentile(changes_60s, 25):.3f}%, 50%: {np.percentile(changes_60s, 50):.3f}%, 75%: {np.percentile(changes_60s, 75):.3f}%")
        lines.append("")
        
        # 结论
        lines.append("💡 后验分析结论:")
        if avg_60s > 0.05 and correct_rate > 50:
            lines.append("  ✅ V4.2 达标信号有正向预期，方向判断有一定准确度")
        elif avg_60s < -0.05:
            lines.append("  ⚠️  V4.2 达标信号可能方向判断有误，需要调整")
        else:
            lines.append("  ⚠️  V4.2 达标信号无明显优势，样本可能不足或阈值需调整")
        
        if fake_rate > 30:
            lines.append("  ⚠️  假突破率较高，建议增加过滤条件")
        
        return "\n".join(lines)
    
    def _gen_score_breakdown_report(self, results: List[Dict]) -> str:
        """分项得分分布报告"""
        lines = []
        lines.append("─" * 80)
        lines.append("📊 4. 分项得分分布统计")
        lines.append("─" * 80)
        
        factors = ['trend_consistency', 'pullback_breakout', 'volume_confirm', 
                   'spread_quality', 'volatility_range', 'rl_filter']
        
        factor_names = {
            'trend_consistency': '趋势一致性',
            'pullback_breakout': '回撤后突破',
            'volume_confirm': '成交量确认',
            'spread_quality': '点差质量',
            'volatility_range': '波动率适中',
            'rl_filter': 'RL过滤'
        }
        
        max_scores = {
            'trend_consistency': 30,
            'pullback_breakout': 20,
            'volume_confirm': 15,
            'spread_quality': 15,
            'volatility_range': 10,
            'rl_filter': 10
        }
        
        lines.append(f"{'因子':<12} {'权重':<6} {'平均分':<8} {'达标均分':<10} {'零分率':<8}")
        lines.append("-" * 80)
        
        for factor in factors:
            scores = [r['v42_score_breakdown'].get(factor, 0) for r in results]
            qualified_scores = [r['v42_score_breakdown'].get(factor, 0) 
                              for r in results if r.get('v42_is_qualified')]
            
            avg = np.mean(scores) if scores else 0
            avg_q = np.mean(qualified_scores) if qualified_scores else 0
            zero_rate = (sum(1 for s in scores if s == 0) / len(scores) * 100) if scores else 0
            
            lines.append(
                f"{factor_names[factor]:<10} "
                f"{max_scores[factor]:<6} "
                f"{avg:<8.1f} "
                f"{avg_q:<10.1f} "
                f"{zero_rate:<7.1f}%"
            )
        
        return "\n".join(lines)
    
    def _gen_conclusion_report(self, results: List[Dict]) -> str:
        """结论与建议"""
        lines = []
        lines.append("─" * 80)
        lines.append("🎯 5. 结论与建议")
        lines.append("─" * 80)
        
        total = len(results)
        qualified = sum(1 for r in results if r.get('v42_is_qualified'))
        qualified_rate = (qualified / total * 100) if total > 0 else 0
        
        # 后验指标
        qualified_results = [r for r in results if r.get('v42_is_qualified')]
        if qualified_results:
            avg_60s = np.mean([r['outcome']['change_60s_pct'] for r in qualified_results])
            correct_rate = sum(1 for r in qualified_results if r['outcome']['is_direction_correct']) / len(qualified_results) * 100
        else:
            avg_60s = 0
            correct_rate = 0
        
        lines.append("📊 关键指标汇总:")
        lines.append(f"  - 样本量: {total}")
        lines.append(f"  - 达标率: {qualified_rate:.1f}%")
        lines.append(f"  - 60秒平均变化: {avg_60s:+.3f}%")
        lines.append(f"  - 方向正确率: {correct_rate:.1f}%")
        lines.append("")
        
        # 决策建议
        lines.append("💡 决策建议:")
        
        if total < 100:
            lines.append("  ⚠️  样本量不足 (<100)，建议继续观察")
            lines.append("     - 当前样本: {} 条".format(total))
            lines.append("     - 目标样本: 100+ 条")
            lines.append("     - 建议: 继续运行1-2天积累数据")
        else:
            if qualified_rate >= 20 and avg_60s > 0.05 and correct_rate > 50:
                lines.append("  ✅ 表现良好，可以进入 V4.2 出场逻辑实验阶段")
                lines.append("     - 达标率适中 (≥20%)")
                lines.append("     - 后验正向预期 (>0.05%)")
                lines.append("     - 方向判断有效 (>50%)")
            elif qualified_rate < 10:
                lines.append("  ⚠️  达标率过低，建议微调阈值")
                lines.append("     - 考虑降低入场阈值至70分")
                lines.append("     - 检查哪个因子限制信号")
            elif avg_60s < 0:
                lines.append("  ❌ 后验表现不佳，建议重新设计")
                lines.append("     - 60秒平均变化为负")
                lines.append("     - 需要调整评分逻辑")
            else:
                lines.append("  ⏸️  表现一般，继续观察")
                lines.append("     - 未达到明确正向或负向标准")
                lines.append("     - 建议继续积累样本")
        
        lines.append("")
        lines.append("📅 推荐观察周期: 样本量达到 100+ 后再做决策")
        lines.append("🎯 下一步实验: 待样本充足后评估是否进入出场逻辑实验")
        
        return "\n".join(lines)
    
    def save_results(self, results: List[Dict]):
        """保存结果"""
        with open(self.output_file, 'w', encoding='utf-8') as f:
            for r in results:
                f.write(json.dumps(r, ensure_ascii=False) + '\n')
        logger.info(f"✅ 结果已保存: {self.output_file}")
    
    def save_report(self, report: str):
        """保存报告"""
        with open(self.report_file, 'w', encoding='utf-8') as f:
            f.write(report)
        logger.info(f"✅ 报告已保存: {self.report_file}")


async def main():
    """主函数"""
    analyzer = HistoricalDataAnalyzer()
    
    # 获取历史数据
    df = await analyzer.fetch_historical_ohlcv('BTC/USDT:USDT', hours=24)
    
    # 分析数据
    results = analyzer.analyze_historical_data(df, 'BTC/USDT:USDT')
    
    # 保存结果
    analyzer.save_results(results)
    
    # 生成报告
    report = analyzer.generate_comparison_report(results)
    print(report)
    
    # 保存报告
    analyzer.save_report(report)


if __name__ == "__main__":
    asyncio.run(main())