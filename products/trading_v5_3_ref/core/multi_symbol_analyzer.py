#!/usr/bin/env python3
"""
Multi-Symbol Historical Analyzer - 多品种历史数据分析器
支持多交易品种的历史数据回放与分析，将结果统一纳入样本
"""

import asyncio
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

# 添加路径
import sys
sys.path.insert(0, str(Path(__file__).parent))

from scoring_engine import ScoringEngine, ScoreBreakdown

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MultiSymbolAnalyzer:
    """多品种历史数据分析器"""
    
    def __init__(self, symbols: List[str] = None, config: Dict = None):
        """
        初始化分析器
        
        Args:
            symbols: 交易品种列表，默认使用主流币种
            config: 配置参数
        """
        self.config = config or {}
        self.scoring_engine = ScoringEngine(self.config)
        
        # 默认交易品种列表
        self.symbols = symbols or [
            'BTC/USDT:USDT',
            'ETH/USDT:USDT',
            'SOL/USDT:USDT',
            'XRP/USDT:USDT',
            'DOGE/USDT:USDT',
            'ADA/USDT:USDT',
            'AVAX/USDT:USDT',
            'LINK/USDT:USDT',
        ]
        
        # 数据目录
        self.data_dir = Path(__file__).parent.parent / 'data'
        self.data_dir.mkdir(exist_ok=True)
        
        # 输出文件
        self.output_file = self.data_dir / 'multi_symbol_analysis.jsonl'
        self.report_file = self.data_dir / 'multi_symbol_report.txt'
        
        # 汇总统计
        self.all_results = []
        self.symbol_stats = {}
        
        logger.info(f"✅ 多品种分析器初始化完成，品种数: {len(self.symbols)}")
    
    async def fetch_historical_ohlcv(self, symbol: str, hours: int = 24) -> Optional[pd.DataFrame]:
        """
        获取历史 OHLCV 数据
        
        Args:
            symbol: 交易品种
            hours: 历史小时数
            
        Returns:
            DataFrame 或 None (如果获取失败)
        """
        import ccxt
        
        exchange = ccxt.okx({
            'proxies': {
                'http': 'http://127.0.0.1:7890',
                'https': 'http://127.0.0.1:7890'
            }
        })
        
        try:
            # 获取过去N小时的1分钟K线
            since = int((datetime.now() - timedelta(hours=hours)).timestamp() * 1000)
            limit = hours * 60  # 每小时60根1分钟K线
            
            logger.info(f"📊 获取 {symbol} 过去 {hours} 小时数据...")
            
            ohlcv = exchange.fetch_ohlcv(symbol, '1m', since=since, limit=limit)
            
            df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            
            logger.info(f"   获取到 {len(df)} 条 K线数据")
            
            return df
            
        except Exception as e:
            logger.error(f"❌ 获取 {symbol} 数据失败: {e}")
            return None
    
    def analyze_symbol(self, df: pd.DataFrame, symbol: str) -> List[Dict]:
        """
        分析单个品种的历史数据
        
        Args:
            df: OHLCV 数据
            symbol: 交易品种
            
        Returns:
            分析结果列表
        """
        results = []
        
        # 滑动窗口评估
        window_size = 50  # 50根K线作为评估窗口
        step = 10  # 每10根K线评估一次
        
        for i in range(window_size, len(df), step):
            window_df = df.iloc[i-window_size:i]
            current_price = df.iloc[i]['close']
            timestamp = df.iloc[i]['timestamp']
            
            # 计算市场状态
            spread_bps = self._estimate_spread(window_df)
            volume_ratio = self._calc_volume_ratio(window_df)
            volatility = self._calc_volatility(window_df)
            
            # V4.1 规则信号
            rule_signal = self._get_v41_signal(window_df)
            
            # V4.2 评分
            breakdown = self.scoring_engine.calculate_score(
                ohlcv_df=window_df,
                current_price=current_price,
                spread_bps=spread_bps,
                rl_decision='ALLOW'
            )
            
            # 后验：检查未来价格变化
            future_changes = self._calc_future_changes(df, i, current_price)
            
            # 假突破判断
            is_fake_breakout = self._check_fake_breakout(
                future_changes.get('change_30s_pct', 0),
                future_changes.get('change_60s_pct', 0)
            )
            
            # 短期方向正确性
            is_direction_correct = self._check_direction_correct(
                breakdown.is_qualified,
                future_changes.get('change_60s_pct', 0)
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
                    **future_changes,
                    'is_fake_breakout': bool(is_fake_breakout),
                    'is_direction_correct': bool(is_direction_correct)
                }
            }
            
            results.append(result)
        
        return results
    
    def _calc_future_changes(self, df: pd.DataFrame, current_idx: int, current_price: float) -> Dict:
        """计算未来价格变化"""
        changes = {}
        
        # 30秒变化 (1根K线)
        if current_idx + 1 < len(df):
            price_30s = df.iloc[current_idx + 1]['close']
            changes['change_30s_pct'] = (price_30s - current_price) / current_price * 100
        else:
            changes['change_30s_pct'] = 0
        
        # 60秒变化 (2根K线)
        if current_idx + 2 < len(df):
            price_60s = df.iloc[current_idx + 2]['close']
            changes['change_60s_pct'] = (price_60s - current_price) / current_price * 100
        else:
            changes['change_60s_pct'] = 0
        
        # 120秒变化 (4根K线)
        if current_idx + 4 < len(df):
            price_120s = df.iloc[current_idx + 4]['close']
            changes['change_120s_pct'] = (price_120s - current_price) / current_price * 100
        else:
            changes['change_120s_pct'] = 0
        
        # 300秒变化 (10根K线)
        if current_idx + 10 < len(df):
            price_300s = df.iloc[current_idx + 10]['close']
            changes['change_300s_pct'] = (price_300s - current_price) / current_price * 100
        else:
            changes['change_300s_pct'] = 0
        
        return changes
    
    def _estimate_spread(self, df: pd.DataFrame) -> float:
        """估算点差 (bps)"""
        high_low_spread = (df['high'] - df['low']) / df['close'].iloc[-1] * 10000
        return min(high_low_spread.mean() * 0.1, 5.0)
    
    def _calc_volume_ratio(self, df: pd.DataFrame) -> float:
        """计算成交量比率"""
        current_vol = df['volume'].iloc[-1]
        avg_vol = df['volume'].iloc[:-1].mean()
        return current_vol / avg_vol if avg_vol > 0 else 1.0
    
    def _calc_volatility(self, df: pd.DataFrame) -> float:
        """计算波动率"""
        returns = df['close'].pct_change().dropna()
        return returns.std() if len(returns) > 0 else 0.0
    
    def _get_v41_signal(self, df: pd.DataFrame) -> str:
        """获取 V4.1 规则信号"""
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
        if abs(change_30s) > 0.1 and abs(change_60s) < 0.05:
            return True
        return False
    
    def _check_direction_correct(self, is_qualified: bool, change_60s: float) -> bool:
        """检查短期方向是否正确"""
        if not is_qualified:
            return False
        return abs(change_60s) > 0.05
    
    async def analyze_all_symbols(self, hours: int = 24) -> Dict:
        """
        分析所有品种
        
        Args:
            hours: 历史小时数
            
        Returns:
            统计信息字典
        """
        logger.info(f"🚀 开始分析 {len(self.symbols)} 个品种...")
        
        for symbol in self.symbols:
            logger.info(f"\n{'='*60}")
            logger.info(f"📊 分析品种: {symbol}")
            logger.info(f"{'='*60}")
            
            # 获取数据
            df = await self.fetch_historical_ohlcv(symbol, hours)
            
            if df is None or len(df) < 60:
                logger.warning(f"⚠️  {symbol} 数据不足，跳过")
                continue
            
            # 分析数据
            results = self.analyze_symbol(df, symbol)
            
            if results:
                self.all_results.extend(results)
                self.symbol_stats[symbol] = {
                    'sample_count': len(results),
                    'qualified_count': sum(1 for r in results if r['v42_is_qualified']),
                    'qualified_rate': sum(1 for r in results if r['v42_is_qualified']) / len(results) * 100
                }
                logger.info(f"✅ {symbol} 分析完成: {len(results)} 样本")
            else:
                logger.warning(f"⚠️  {symbol} 无分析结果")
        
        logger.info(f"\n{'='*60}")
        logger.info(f"🎉 全部分析完成，总样本数: {len(self.all_results)}")
        logger.info(f"{'='*60}")
        
        return self.symbol_stats
    
    def generate_multi_symbol_report(self) -> str:
        """生成多品种分析报告"""
        lines = []
        lines.append("=" * 80)
        lines.append("📊 多品种历史数据分析报告")
        lines.append("=" * 80)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"分析品种数: {len(self.symbols)}")
        lines.append(f"总样本数: {len(self.all_results)}")
        lines.append("")
        
        # 1. 各品种统计
        lines.append("─" * 80)
        lines.append("📈 1. 各品种统计")
        lines.append("─" * 80)
        
        for symbol, stats in sorted(self.symbol_stats.items()):
            lines.append(f"\n{symbol}:")
            lines.append(f"  样本数: {stats['sample_count']}")
            lines.append(f"  达标数: {stats['qualified_count']}")
            lines.append(f"  达标率: {stats['qualified_rate']:.1f}%")
        
        lines.append("")
        
        # 2. 总体统计
        lines.append("─" * 80)
        lines.append("📊 2. 总体统计")
        lines.append("─" * 80)
        
        total = len(self.all_results)
        qualified = [r for r in self.all_results if r['v42_is_qualified']]
        qualified_rate = len(qualified) / total * 100 if total > 0 else 0
        
        lines.append(f"总样本数: {total}")
        lines.append(f"达标样本: {len(qualified)} ({qualified_rate:.1f}%)")
        
        if qualified:
            # 后验表现
            changes_30s = [r['outcome']['change_30s_pct'] for r in qualified]
            changes_60s = [r['outcome']['change_60s_pct'] for r in qualified]
            changes_120s = [r['outcome']['change_120s_pct'] for r in qualified]
            changes_300s = [r['outcome']['change_300s_pct'] for r in qualified]
            
            lines.append("")
            lines.append("📊 后验价格变化:")
            lines.append(f"  30秒: {np.mean(changes_30s):+.4f}% (σ={np.std(changes_30s):.4f}%)")
            lines.append(f"  60秒: {np.mean(changes_60s):+.4f}% (σ={np.std(changes_60s):.4f}%)")
            lines.append(f"  120秒: {np.mean(changes_120s):+.4f}% (σ={np.std(changes_120s):.4f}%)")
            lines.append(f"  300秒: {np.mean(changes_300s):+.4f}% (σ={np.std(changes_300s):.4f}%)")
            
            # 方向正确率
            correct = sum(1 for r in qualified if r['outcome']['is_direction_correct'])
            correct_rate = correct / len(qualified) * 100
            lines.append("")
            lines.append(f"📊 方向正确率: {correct_rate:.1f}% ({correct}/{len(qualified)})")
        
        lines.append("")
        
        # 3. 品种对比
        lines.append("─" * 80)
        lines.append("🔄 3. 品种对比分析")
        lines.append("─" * 80)
        
        # 按达标率排序
        sorted_symbols = sorted(
            self.symbol_stats.items(),
            key=lambda x: x[1]['qualified_rate'],
            reverse=True
        )
        
        lines.append("\n达标率排名:")
        for i, (symbol, stats) in enumerate(sorted_symbols[:5], 1):
            lines.append(f"  {i}. {symbol}: {stats['qualified_rate']:.1f}%")
        
        lines.append("")
        
        # 4. 新增机会分析
        lines.append("─" * 80)
        lines.append("🎯 4. 新增机会分析 (V4.1无信号但V4.2达标)")
        lines.append("─" * 80)
        
        new_opportunities = [r for r in self.all_results 
                            if r.get('rule_signal') == 'HOLD' and r.get('v42_is_qualified')]
        
        lines.append(f"新增机会数量: {len(new_opportunities)}")
        
        if new_opportunities:
            changes_60s = [r['outcome']['change_60s_pct'] for r in new_opportunities]
            correct = sum(1 for r in new_opportunities if r['outcome']['is_direction_correct'])
            correct_rate = correct / len(new_opportunities) * 100
            
            lines.append(f"60秒平均变化: {np.mean(changes_60s):+.4f}%")
            lines.append(f"方向正确率: {correct_rate:.1f}%")
            
            lines.append("")
            lines.append("💡 独立边际判断:")
            if np.mean(changes_60s) > 0.03 and correct_rate > 50:
                lines.append("  ✅ 新增机会有独立正向边际")
            elif np.mean(changes_60s) > 0:
                lines.append("  ⚠️  新增机会有微弱正向预期")
            else:
                lines.append("  ❌ 新增机会无独立边际")
        
        lines.append("")
        
        # 5. 结论与建议
        lines.append("─" * 80)
        lines.append("🎯 5. 结论与建议")
        lines.append("─" * 80)
        
        lines.append("📊 核心发现:")
        lines.append(f"  1. 分析品种: {len(self.symbols)} 个")
        lines.append(f"  2. 总样本: {total} 条")
        lines.append(f"  3. 整体达标率: {qualified_rate:.1f}%")
        
        if qualified:
            avg_60s = np.mean([r['outcome']['change_60s_pct'] for r in qualified])
            lines.append(f"  4. 60秒平均变化: {avg_60s:+.4f}%")
        
        lines.append("")
        lines.append("💡 决策建议:")
        
        if total < 200:
            lines.append("  ⚠️  样本量不足，建议继续积累数据")
        elif qualified_rate > 30 and avg_60s > 0.03:
            lines.append("  ✅ 表现良好，可考虑进入实盘测试")
        else:
            lines.append("  ⏸️  继续观察，评估参数调整")
        
        lines.append("")
        lines.append("📅 下一步:")
        lines.append("  1. 继续积累多品种样本")
        lines.append("  2. 分析各品种特性差异")
        lines.append("  3. 优化评分参数")
        
        lines.append("=" * 80)
        
        return "\n".join(lines)
    
    def save_results(self):
        """保存分析结果"""
        # 保存为 JSONL
        with open(self.output_file, 'w', encoding='utf-8') as f:
            for r in self.all_results:
                f.write(json.dumps(r, ensure_ascii=False) + '\n')
        
        logger.info(f"✅ 结果已保存: {self.output_file}")
    
    def save_report(self, report: str):
        """保存报告"""
        with open(self.report_file, 'w', encoding='utf-8') as f:
            f.write(report)
        
        logger.info(f"✅ 报告已保存: {self.report_file}")
    
    def merge_with_existing(self, existing_file: Path = None):
        """
        与现有数据合并
        
        Args:
            existing_file: 现有数据文件路径
        """
        if existing_file is None:
            existing_file = self.data_dir / 'historical_analysis.jsonl'
        
        if not existing_file.exists():
            logger.info("⚠️  无现有数据，使用新数据")
            return
        
        # 读取现有数据
        existing_results = []
        with open(existing_file, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    existing_results.append(json.loads(line))
        
        logger.info(f"📊 现有数据: {len(existing_results)} 条")
        logger.info(f"📊 新数据: {len(self.all_results)} 条")
        
        # 合并 (去重：基于 timestamp + symbol)
        seen = set()
        merged = []
        
        for r in existing_results + self.all_results:
            key = (r.get('timestamp'), r.get('symbol'))
            if key not in seen:
                seen.add(key)
                merged.append(r)
        
        self.all_results = merged
        logger.info(f"✅ 合并后总数据: {len(self.all_results)} 条")


async def main():
    """主函数"""
    # 创建分析器
    analyzer = MultiSymbolAnalyzer()
    
    # 分析所有品种
    await analyzer.analyze_all_symbols(hours=24)
    
    # 与现有数据合并
    analyzer.merge_with_existing()
    
    # 保存结果
    analyzer.save_results()
    
    # 生成报告
    report = analyzer.generate_multi_symbol_report()
    print(report)
    
    # 保存报告
    analyzer.save_report(report)


if __name__ == "__main__":
    asyncio.run(main())