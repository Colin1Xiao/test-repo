#!/usr/bin/env python3
"""
Execution Slippage Decomposer - 滑点分解引擎

核心功能：
1. 分解滑点到具体执行阶段
2. 识别滑点来源（entry/exit/latency）
3. 生成优化建议

滑点来源分类：
- Entry Slippage: 进场滑点（信号价 vs 成交价）
- Exit Slippage: 出场滑点（平仓价 vs 目标价）
- Latency Slippage: 延迟滑点（价格变动导致）
"""

import json
from datetime import datetime
from typing import Dict, List, Optional
from dataclasses import dataclass, field
from collections import defaultdict


@dataclass
class SlippageBreakdown:
    """滑点分解"""
    entry_slippage: float = 0.0    # 进场滑点
    exit_slippage: float = 0.0     # 出场滑点
    latency_slippage: float = 0.0  # 延迟滑点
    spread_cost: float = 0.0       # 点差成本
    
    # 占比
    entry_pct: float = 0.0
    exit_pct: float = 0.0
    latency_pct: float = 0.0
    spread_pct: float = 0.0


@dataclass
class TradeSlippageDetail:
    """单笔交易滑点详情"""
    trade_id: str
    symbol: str
    timestamp: str
    
    # 价格
    signal_price: float
    entry_price: float
    exit_price: float = 0.0
    target_price: float = 0.0
    
    # 滑点
    total_slippage: float = 0.0
    entry_slippage: float = 0.0
    exit_slippage: float = 0.0
    
    # 延迟
    latency_ms: float = 0.0
    price_change_during_latency: float = 0.0
    
    # 市场状态
    spread_at_entry: float = 0.0
    volatility: float = 0.0
    regime: str = ""
    
    # 分析结果
    dominant_source: str = ""  # 主要滑点来源


class SlippageDecomposer:
    """
    滑点分解引擎
    
    使用方式：
    decomposer = SlippageDecomposer()
    decomposer.record_trade(trade_detail)
    report = decomposer.analyze()
    """
    
    def __init__(self):
        self.trades: List[TradeSlippageDetail] = []
        self._breakdown: Optional[SlippageBreakdown] = None
    
    def record_trade(self, trade: Dict):
        """
        记录交易
        
        Args:
            trade: 交易数据
        """
        detail = TradeSlippageDetail(
            trade_id=trade.get('trade_id', str(len(self.trades))),
            symbol=trade.get('symbol', ''),
            timestamp=trade.get('timestamp', ''),
            signal_price=trade.get('signal_price', 0),
            entry_price=trade.get('execution_price', 0),
            exit_price=trade.get('exit_price', 0),
            target_price=trade.get('target_price', 0),
            total_slippage=trade.get('slippage_pct', 0),
            latency_ms=trade.get('latency_ms', 0),
            spread_at_entry=trade.get('spread_pct', 0),
            regime=trade.get('regime', '')
        )
        
        # 计算进场滑点
        if detail.signal_price > 0 and detail.entry_price > 0:
            detail.entry_slippage = abs(
                detail.entry_price - detail.signal_price
            ) / detail.signal_price * 100
        
        # 计算出场滑点
        if detail.target_price > 0 and detail.exit_price > 0:
            detail.exit_slippage = abs(
                detail.exit_price - detail.target_price
            ) / detail.target_price * 100
        
        # 估算延迟滑点
        # 假设价格变动率 = latency * volatility
        if detail.latency_ms > 0:
            # 粗略估算：每秒价格变动约 volatility%
            detail.price_change_during_latency = (
                detail.latency_ms / 1000 * detail.volatility
            ) if detail.volatility > 0 else 0
        
        # 判断主要来源
        if detail.entry_slippage > detail.exit_slippage:
            detail.dominant_source = "ENTRY"
        elif detail.exit_slippage > detail.entry_slippage:
            detail.dominant_source = "EXIT"
        else:
            detail.dominant_source = "UNKNOWN"
        
        self.trades.append(detail)
        self._breakdown = None  # 清除缓存
    
    def analyze(self) -> SlippageBreakdown:
        """分析滑点分布"""
        if not self.trades:
            return SlippageBreakdown()
        
        # 汇总
        total_entry = sum(t.entry_slippage for t in self.trades)
        total_exit = sum(t.exit_slippage for t in self.trades)
        total_spread = sum(t.spread_at_entry for t in self.trades)
        
        # 估算延迟滑点
        avg_latency = sum(t.latency_ms for t in self.trades) / len(self.trades)
        total_slippage = sum(t.total_slippage for t in self.trades)
        
        # 延迟滑点 = 总滑点 - 进场滑点 - 出场滑点 - 点差
        latency_estimate = max(0, total_slippage - total_entry - total_exit)
        
        # 计算占比
        total = total_entry + total_exit + latency_estimate + total_spread
        if total > 0:
            entry_pct = total_entry / total * 100
            exit_pct = total_exit / total * 100
            latency_pct = latency_estimate / total * 100
            spread_pct = total_spread / total * 100
        else:
            entry_pct = exit_pct = latency_pct = spread_pct = 0
        
        self._breakdown = SlippageBreakdown(
            entry_slippage=total_entry,
            exit_slippage=total_exit,
            latency_slippage=latency_estimate,
            spread_cost=total_spread,
            entry_pct=entry_pct,
            exit_pct=exit_pct,
            latency_pct=latency_pct,
            spread_pct=spread_pct
        )
        
        return self._breakdown
    
    def get_dominant_source(self) -> str:
        """获取主要滑点来源"""
        if not self.trades:
            return "NO_DATA"
        
        # 统计各来源出现次数
        sources = defaultdict(int)
        for t in self.trades:
            sources[t.dominant_source] += 1
        
        # 返回最常见的
        return max(sources, key=sources.get)
    
    def get_recommendations(self) -> List[str]:
        """获取优化建议"""
        if not self._breakdown:
            self.analyze()
        
        recommendations = []
        
        if self._breakdown.entry_pct > 50:
            recommendations.append(
                f"🔴 进场滑点占比 {self._breakdown.entry_pct:.0f}%"
            )
            recommendations.append("   → 建议：优化进场执行（减少延迟或改进价格获取）")
        
        if self._breakdown.exit_pct > 30:
            recommendations.append(
                f"🟡 出场滑点占比 {self._breakdown.exit_pct:.0f}%"
            )
            recommendations.append("   → 建议：优化止盈止损执行")
        
        if self._breakdown.latency_pct > 30:
            recommendations.append(
                f"🟡 延迟滑点占比 {self._breakdown.latency_pct:.0f}%"
            )
            recommendations.append("   → 建议：降低延迟（WebSocket/VPS）")
        
        if self._breakdown.spread_pct > 20:
            recommendations.append(
                f"🟡 点差成本占比 {self._breakdown.spread_pct:.0f}%"
            )
            recommendations.append("   → 建议：优化进场时机（避开高波动）")
        
        if not recommendations:
            recommendations.append("✅ 滑点分布均衡")
        
        return recommendations
    
    def report(self) -> str:
        """生成报告"""
        breakdown = self.analyze()
        dominant = self.get_dominant_source()
        recommendations = self.get_recommendations()
        
        report = f"""
📊 Slippage Decomposition Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
交易数: {len(self.trades)}

💰 滑点分布:
   进场滑点: {breakdown.entry_pct:.1f}% ({breakdown.entry_slippage:.4f}%)
   出场滑点: {breakdown.exit_pct:.1f}% ({breakdown.exit_slippage:.4f}%)
   延迟滑点: {breakdown.latency_pct:.1f}% ({breakdown.latency_slippage:.4f}%)
   点差成本: {breakdown.spread_pct:.1f}% ({breakdown.spread_cost:.4f}%)

🎯 主要来源: {dominant}

💡 优化建议:
"""
        for rec in recommendations:
            report += f"{rec}\n"
        
        report += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        return report


# 全局实例
_decomposer: Optional[SlippageDecomposer] = None


def get_slippage_decomposer() -> SlippageDecomposer:
    """获取全局滑点分解器"""
    global _decomposer
    if _decomposer is None:
        _decomposer = SlippageDecomposer()
    return _decomposer


# 测试
if __name__ == "__main__":
    print("🧪 滑点分解引擎测试")
    
    decomposer = SlippageDecomposer()
    
    # 模拟交易
    import random
    for i in range(10):
        trade = {
            'trade_id': str(i),
            'symbol': 'ETH/USDT:USDT',
            'timestamp': datetime.now().isoformat(),
            'signal_price': 2200,
            'execution_price': 2200 + random.uniform(-2, 5),
            'slippage_pct': random.uniform(0.01, 0.15),
            'latency_ms': random.uniform(800, 1500),
            'spread_pct': random.uniform(0.01, 0.05),
            'regime': 'RANGE'
        }
        decomposer.record_trade(trade)
    
    print(decomposer.report())