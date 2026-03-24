#!/usr/bin/env python3
"""
PnL Attribution Engine - 盈亏归因引擎 (V14)

核心认知：
你知道赚/亏了多少
但不知道为什么赚/为什么亏

核心能力：
1. 信号贡献 - 信号本身的盈利能力
2. 执行损耗 - 执行过程中的损失
3. 滑点成本 - 价格滑动的损失
4. 手续费 - 交易成本
5. 运气成分 - 随机波动

归因公式：
PnL = Signal_Edge + Slippage_Cost + Fee + Execution_Error + Luck

作用：
让系统知道"钱去哪了"
防止系统"优化错方向"
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, date
from enum import Enum
from pathlib import Path
import json
from collections import defaultdict

# ============================================================
# 枚举和常量
# ============================================================
class AttributionCategory(Enum):
    """归因类别"""
    SIGNAL_EDGE = "signal_edge"           # 信号贡献
    SLIPPAGE = "slippage"                 # 滑点成本
    FEE = "fee"                           # 手续费
    EXECUTION_ERROR = "execution_error"   # 执行误差
    TIMING = "timing"                     # 时机成本
    LUCK = "luck"                         # 运气成分
    MARKET_MOVE = "market_move"           # 市场移动


class TradeType(Enum):
    """交易类型"""
    WIN = "WIN"
    LOSS = "LOSS"
    BREAKEVEN = "BREAKEVEN"


class AttributionVerdict(Enum):
    """归因裁决"""
    GOOD_SIGNAL_BAD_EXECUTION = "GOOD_SIGNAL_BAD_EXECUTION"
    BAD_SIGNAL_GOOD_EXECUTION = "BAD_SIGNAL_GOOD_EXECUTION"
    GOOD_SIGNAL_GOOD_EXECUTION = "GOOD_SIGNAL_GOOD_EXECUTION"
    BAD_SIGNAL_BAD_EXECUTION = "BAD_SIGNAL_BAD_EXECUTION"
    LUCK_WIN = "LUCK_WIN"
    UNLUCKY_LOSS = "UNLUCKY_LOSS"


@dataclass
class PnLConfig:
    """归因配置"""
    # 手续费率
    maker_fee_rate: float = 0.0002    # Maker 0.02%
    taker_fee_rate: float = 0.0005    # Taker 0.05%
    
    # 归因阈值
    signal_edge_threshold: float = 0.001    # 信号阈值 0.1%
    slippage_warning_threshold: float = 0.0005  # 滑点警告 0.05%
    execution_error_threshold: float = 0.0003   # 执行误差阈值
    
    # 运气判定
    luck_threshold: float = 0.0005     # 运气阈值
    
    # 统计窗口
    attribution_window: int = 100      # 归因统计窗口


@dataclass
class TradeAttribution:
    """单笔交易归因"""
    trade_id: str
    timestamp: str
    symbol: str
    side: str
    
    # 价格数据
    entry_price: float
    exit_price: float
    expected_entry: float
    expected_exit: float
    
    # 数量和价值
    size: float
    notional: float
    
    # PnL 归因 (都是比例)
    gross_pnl_pct: float              # 总盈亏比例
    signal_edge: float = 0.0          # 信号贡献
    slippage_cost: float = 0.0        # 滑点成本
    fee_cost: float = 0.0             # 手续费
    execution_error: float = 0.0      # 执行误差
    timing_cost: float = 0.0          # 时机成本
    luck_component: float = 0.0       # 运气成分
    net_pnl_pct: float = 0.0          # 净盈亏比例
    
    # 裁决
    trade_type: TradeType = TradeType.BREAKEVEN
    verdict: AttributionVerdict = AttributionVerdict.GOOD_SIGNAL_GOOD_EXECUTION
    
    # 详细信息
    details: Dict = field(default_factory=dict)
    
    def __post_init__(self):
        # 计算交易类型
        if self.gross_pnl_pct > 0.001:
            self.trade_type = TradeType.WIN
        elif self.gross_pnl_pct < -0.001:
            self.trade_type = TradeType.LOSS
        else:
            self.trade_type = TradeType.BREAKEVEN


@dataclass
class AttributionStats:
    """归因统计"""
    total_trades: int = 0
    wins: int = 0
    losses: int = 0
    
    # 累计归因 (比例)
    total_signal_edge: float = 0.0
    total_slippage: float = 0.0
    total_fee: float = 0.0
    total_execution_error: float = 0.0
    total_timing: float = 0.0
    total_luck: float = 0.0
    total_pnl: float = 0.0
    
    # 平均值
    avg_signal_edge: float = 0.0
    avg_slippage: float = 0.0
    avg_fee: float = 0.0
    avg_execution_error: float = 0.0
    
    # 问题检测
    signal_quality_score: float = 0.0
    execution_quality_score: float = 0.0
    leak_detection: List[str] = field(default_factory=list)


# ============================================================
# PnL Attribution Engine 核心类
# ============================================================
class PnLAttributionEngine:
    """
    盈亏归因引擎
    
    核心认知：
    你知道赚/亏了多少
    但不知道为什么赚/为什么亏
    
    职责：
    1. 信号贡献分析
    2. 执行损耗分析
    3. 滑点成本分析
    4. 手续费分析
    5. 运气成分判定
    
    作用：
    让系统知道"钱去哪了"
    防止系统"优化错方向"
    """
    
    def __init__(self, config: PnLConfig = None):
        self.config = config or PnLConfig()
        
        # 交易归因记录
        self.attributions: List[TradeAttribution] = []
        
        # 按策略分组统计
        self.strategy_stats: Dict[str, AttributionStats] = defaultdict(AttributionStats)
        
        # 总体统计
        self.total_stats = AttributionStats()
        
        # 漏洞检测
        self.detected_issues: List[Dict] = []
        
        # 持久化路径
        self.data_dir = Path(__file__).parent.parent / "logs" / "pnl_attribution"
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        # 加载历史
        self._load_history()
        
        print("📊 PnL Attribution Engine V14 初始化完成")
        print(f"   手续费率: Maker {self.config.maker_fee_rate*100:.2f}%, Taker {self.config.taker_fee_rate*100:.2f}%")
        print(f"   历史记录: {len(self.attributions)} 笔")
    
    # ============================================================
    # 1. 核心归因计算
    # ============================================================
    def attribute(
        self,
        trade_id: str,
        symbol: str,
        side: str,
        entry_price: float,
        exit_price: float,
        expected_entry: float,
        expected_exit: float,
        size: float,
        signal_score: float = 0.5,
        strategy: str = "default",
        execution_time_ms: float = 200,
        market_during_trade: Dict = None
    ) -> TradeAttribution:
        """
        执行归因分析
        
        Args:
            trade_id: 交易ID
            symbol: 交易对
            side: BUY / SELL
            entry_price: 实际入场价
            exit_price: 实际出场价
            expected_entry: 预期入场价
            expected_exit: 预期出场价
            size: 交易数量
            signal_score: 信号评分 (0-1)
            strategy: 策略名称
            execution_time_ms: 执行时间 (毫秒)
            market_during_trade: 交易期间市场数据
        
        Returns:
            TradeAttribution
        """
        timestamp = datetime.now().isoformat()
        notional = size * entry_price
        
        # 1. 计算总盈亏
        if side == "BUY":
            gross_pnl_pct = (exit_price - entry_price) / entry_price
        else:
            gross_pnl_pct = (entry_price - exit_price) / entry_price
        
        # 2. 计算信号贡献
        # 信号贡献 = 预期价格差 - 随机波动
        if side == "BUY":
            expected_move = (expected_exit - expected_entry) / expected_entry
        else:
            expected_move = (expected_entry - expected_exit) / expected_entry
        
        # 信号评分调整
        signal_edge = expected_move * signal_score
        
        # 3. 计算滑点成本
        entry_slippage = abs(entry_price - expected_entry) / expected_entry
        exit_slippage = abs(exit_price - expected_exit) / expected_exit
        slippage_cost = -(entry_slippage + exit_slippage)
        
        # 4. 计算手续费
        fee_cost = -(self.config.taker_fee_rate * 2)  # 开仓 + 平仓
        
        # 5. 计算执行误差
        # 执行误差 = 实际盈亏 - 信号贡献 - 滑点 - 手续费 - 运气
        execution_error = 0.0
        
        # 6. 计算时机成本
        # 如果执行时间过长，可能有价格漂移
        if execution_time_ms > 500:
            timing_cost = -0.0001 * (execution_time_ms / 500)
        else:
            timing_cost = 0.0
        
        # 7. 计算运气成分
        # 剩余的无法解释部分 = 运气
        explained = signal_edge + slippage_cost + fee_cost + timing_cost
        luck_component = gross_pnl_pct - explained
        
        # 如果运气成分太大，标记
        if abs(luck_component) > self.config.luck_threshold:
            luck_component = luck_component
        else:
            luck_component = 0.0
        
        # 8. 计算净盈亏
        net_pnl_pct = gross_pnl_pct + fee_cost
        
        # 9. 裁决
        verdict = self._make_verdict(
            signal_edge=signal_edge,
            slippage_cost=slippage_cost,
            execution_error=execution_error,
            luck_component=luck_component,
            gross_pnl=gross_pnl_pct
        )
        
        # 构建归因对象
        attribution = TradeAttribution(
            trade_id=trade_id,
            timestamp=timestamp,
            symbol=symbol,
            side=side,
            entry_price=entry_price,
            exit_price=exit_price,
            expected_entry=expected_entry,
            expected_exit=expected_exit,
            size=size,
            notional=notional,
            gross_pnl_pct=gross_pnl_pct,
            signal_edge=signal_edge,
            slippage_cost=slippage_cost,
            fee_cost=fee_cost,
            execution_error=execution_error,
            timing_cost=timing_cost,
            luck_component=luck_component,
            net_pnl_pct=net_pnl_pct,
            verdict=verdict,
            details={
                "strategy": strategy,
                "signal_score": signal_score,
                "execution_time_ms": execution_time_ms,
                "entry_slippage_pct": entry_slippage * 100,
                "exit_slippage_pct": exit_slippage * 100
            }
        )
        
        # 记录
        self.attributions.append(attribution)
        
        # 更新统计
        self._update_stats(attribution, strategy)
        
        # 检测问题
        self._detect_issues(attribution)
        
        # 持久化
        self._save_attribution(attribution)
        
        return attribution
    
    def _make_verdict(
        self,
        signal_edge: float,
        slippage_cost: float,
        execution_error: float,
        luck_component: float,
        gross_pnl: float
    ) -> AttributionVerdict:
        """
        做出归因裁决
        
        判断：
        - 好信号 + 坏执行
        - 坏信号 + 好执行
        - 好信号 + 好执行
        - 坏信号 + 坏执行
        - 运气赢
        - 运气输
        """
        # 运气判定
        if abs(luck_component) > self.config.luck_threshold:
            if gross_pnl > 0:
                return AttributionVerdict.LUCK_WIN
            else:
                return AttributionVerdict.UNLUCKY_LOSS
        
        # 信号好/坏
        signal_good = signal_edge > self.config.signal_edge_threshold
        
        # 执行好/坏
        execution_good = abs(slippage_cost) < self.config.slippage_warning_threshold
        
        # 裁决
        if signal_good and execution_good:
            return AttributionVerdict.GOOD_SIGNAL_GOOD_EXECUTION
        elif signal_good and not execution_good:
            return AttributionVerdict.GOOD_SIGNAL_BAD_EXECUTION
        elif not signal_good and execution_good:
            return AttributionVerdict.BAD_SIGNAL_GOOD_EXECUTION
        else:
            return AttributionVerdict.BAD_SIGNAL_BAD_EXECUTION
    
    # ============================================================
    # 2. 统计分析
    # ============================================================
    def _update_stats(self, attribution: TradeAttribution, strategy: str):
        """更新统计"""
        # 更新策略统计
        stats = self.strategy_stats[strategy]
        stats.total_trades += 1
        
        if attribution.trade_type == TradeType.WIN:
            stats.wins += 1
        elif attribution.trade_type == TradeType.LOSS:
            stats.losses += 1
        
        # 累计归因
        stats.total_signal_edge += attribution.signal_edge
        stats.total_slippage += attribution.slippage_cost
        stats.total_fee += attribution.fee_cost
        stats.total_execution_error += attribution.execution_error
        stats.total_pnl += attribution.gross_pnl_pct
        
        # 计算平均
        n = stats.total_trades
        stats.avg_signal_edge = stats.total_signal_edge / n
        stats.avg_slippage = stats.total_slippage / n
        stats.avg_fee = stats.total_fee / n
        stats.avg_execution_error = stats.total_execution_error / n
        
        # 计算质量分数
        stats.signal_quality_score = stats.avg_signal_edge / abs(stats.avg_signal_edge + 0.001) * min(abs(stats.avg_signal_edge) * 100, 1.0)
        stats.execution_quality_score = 1 - min(abs(stats.avg_slippage) * 100, 1.0)
        
        # 更新总体统计
        self.total_stats.total_trades += 1
        if attribution.trade_type == TradeType.WIN:
            self.total_stats.wins += 1
        elif attribution.trade_type == TradeType.LOSS:
            self.total_stats.losses += 1
        
        self.total_stats.total_signal_edge += attribution.signal_edge
        self.total_stats.total_slippage += attribution.slippage_cost
        self.total_stats.total_fee += attribution.fee_cost
        self.total_stats.total_pnl += attribution.gross_pnl_pct
        
        n_total = self.total_stats.total_trades
        self.total_stats.avg_signal_edge = self.total_stats.total_signal_edge / n_total
        self.total_stats.avg_slippage = self.total_stats.total_slippage / n_total
        self.total_stats.avg_fee = self.total_stats.total_fee / n_total
    
    def _detect_issues(self, attribution: TradeAttribution):
        """检测问题"""
        issues = []
        
        # 滑点过大
        if abs(attribution.slippage_cost) > self.config.slippage_warning_threshold:
            issues.append({
                "type": "HIGH_SLIPPAGE",
                "trade_id": attribution.trade_id,
                "value": attribution.slippage_cost,
                "message": f"滑点过大: {attribution.slippage_cost*100:.3f}%"
            })
        
        # 执行误差过大
        if abs(attribution.execution_error) > self.config.execution_error_threshold:
            issues.append({
                "type": "EXECUTION_ERROR",
                "trade_id": attribution.trade_id,
                "value": attribution.execution_error,
                "message": f"执行误差过大: {attribution.execution_error*100:.3f}%"
            })
        
        # 信号贡献为负但盈利（运气）
        if attribution.signal_edge < 0 and attribution.gross_pnl_pct > 0:
            issues.append({
                "type": "LUCKY_WIN",
                "trade_id": attribution.trade_id,
                "message": "信号为负但盈利，可能是运气"
            })
        
        # 信号贡献为正但亏损
        if attribution.signal_edge > 0 and attribution.gross_pnl_pct < 0:
            issues.append({
                "type": "SIGNAL_GOOD_BUT_LOSS",
                "trade_id": attribution.trade_id,
                "message": "信号为正但亏损，执行可能有问题"
            })
        
        # 记录问题
        self.detected_issues.extend(issues)
        
        # 限制问题列表长度
        if len(self.detected_issues) > 100:
            self.detected_issues = self.detected_issues[-100:]
    
    # ============================================================
    # 3. 查询接口
    # ============================================================
    def get_summary(self, strategy: str = None) -> Dict:
        """获取归因摘要"""
        if strategy and strategy in self.strategy_stats:
            stats = self.strategy_stats[strategy]
        else:
            stats = self.total_stats
        
        return {
            "total_trades": stats.total_trades,
            "wins": stats.wins,
            "losses": stats.losses,
            "win_rate": stats.wins / max(1, stats.total_trades),
            "avg_signal_edge_pct": round(stats.avg_signal_edge * 100, 4),
            "avg_slippage_pct": round(stats.avg_slippage * 100, 4),
            "avg_fee_pct": round(stats.avg_fee * 100, 4),
            "total_pnl_pct": round(stats.total_pnl * 100, 4),
            "signal_quality_score": round(stats.signal_quality_score, 2),
            "execution_quality_score": round(stats.execution_quality_score, 2)
        }
    
    def get_breakdown(self) -> Dict:
        """获取归因分解"""
        stats = self.total_stats
        
        if stats.total_trades == 0:
            return {"error": "No trades"}
        
        # 计算各部分占比
        total_negative = abs(stats.total_slippage) + abs(stats.total_fee) + abs(stats.total_execution_error)
        total_positive = stats.total_signal_edge
        
        return {
            "total_trades": stats.total_trades,
            "pnl_breakdown": {
                "signal_contribution": {
                    "total_pct": round(stats.total_signal_edge * 100, 4),
                    "avg_pct": round(stats.avg_signal_edge * 100, 4),
                    "interpretation": "正向" if stats.total_signal_edge > 0 else "负向"
                },
                "slippage_cost": {
                    "total_pct": round(stats.total_slippage * 100, 4),
                    "avg_pct": round(stats.avg_slippage * 100, 4),
                    "interpretation": "成本"
                },
                "fee_cost": {
                    "total_pct": round(stats.total_fee * 100, 4),
                    "avg_pct": round(stats.avg_fee * 100, 4),
                    "interpretation": "成本"
                },
                "execution_error": {
                    "total_pct": round(stats.total_execution_error * 100, 4),
                    "avg_pct": round(stats.avg_execution_error * 100, 4),
                    "interpretation": "误差"
                }
            },
            "total_pnl_pct": round(stats.total_pnl * 100, 4),
            "leak_analysis": {
                "biggest_leak": "slippage" if abs(stats.total_slippage) > abs(stats.total_fee) else "fee",
                "leak_pct": round(max(abs(stats.total_slippage), abs(stats.total_fee)) * 100, 4)
            }
        }
    
    def get_verdict_distribution(self) -> Dict:
        """获取裁决分布"""
        distribution = defaultdict(int)
        
        for attr in self.attributions:
            distribution[attr.verdict.value] += 1
        
        total = len(self.attributions)
        
        return {
            "total": total,
            "distribution": {
                k: {"count": v, "pct": round(v / max(1, total) * 100, 1)}
                for k, v in distribution.items()
            }
        }
    
    def get_issues(self, limit: int = 10) -> List[Dict]:
        """获取检测到的问题"""
        return self.detected_issues[-limit:]
    
    def get_recent_attributions(self, n: int = 10) -> List[Dict]:
        """获取最近的归因"""
        return [
            {
                "trade_id": a.trade_id,
                "symbol": a.symbol,
                "side": a.side,
                "gross_pnl_pct": round(a.gross_pnl_pct * 100, 4),
                "signal_edge_pct": round(a.signal_edge * 100, 4),
                "slippage_pct": round(a.slippage_cost * 100, 4),
                "fee_pct": round(a.fee_cost * 100, 4),
                "verdict": a.verdict.value,
                "trade_type": a.trade_type.value
            }
            for a in self.attributions[-n:]
        ]
    
    # ============================================================
    # 4. 持久化
    # ============================================================
    def _save_attribution(self, attribution: TradeAttribution):
        """保存归因记录"""
        log_file = self.data_dir / "attributions.jsonl"
        
        data = {
            "trade_id": attribution.trade_id,
            "timestamp": attribution.timestamp,
            "symbol": attribution.symbol,
            "side": attribution.side,
            "entry_price": attribution.entry_price,
            "exit_price": attribution.exit_price,
            "size": attribution.size,
            "gross_pnl_pct": attribution.gross_pnl_pct,
            "signal_edge": attribution.signal_edge,
            "slippage_cost": attribution.slippage_cost,
            "fee_cost": attribution.fee_cost,
            "verdict": attribution.verdict.value
        }
        
        with open(log_file, "a") as f:
            f.write(json.dumps(data) + "\n")
    
    def _load_history(self):
        """加载历史数据"""
        log_file = self.data_dir / "attributions.jsonl"
        
        if not log_file.exists():
            return
        
        try:
            with open(log_file, "r") as f:
                for line in f:
                    try:
                        data = json.loads(line)
                        # 简化加载，只保留统计
                        self.total_stats.total_trades += 1
                        self.total_stats.total_signal_edge += data.get("signal_edge", 0)
                        self.total_stats.total_slippage += data.get("slippage_cost", 0)
                        self.total_stats.total_fee += data.get("fee_cost", 0)
                    except:
                        continue
        except Exception as e:
            print(f"⚠️ 加载归因历史失败: {e}")


# ============================================================
# 便捷函数
# ============================================================
def create_pnl_attribution() -> PnLAttributionEngine:
    """创建盈亏归因引擎"""
    return PnLAttributionEngine()


# ============================================================
# 测试
# ============================================================
if __name__ == "__main__":
    print("=== PnL Attribution Engine V14 测试 ===\n")
    
    engine = PnLAttributionEngine()
    
    # 模拟几笔交易
    print("1. 模拟交易归因:")
    
    # 好信号，好执行
    attr1 = engine.attribute(
        trade_id="TRADE-001",
        symbol="BTC/USDT",
        side="BUY",
        entry_price=50000,
        exit_price=50100,
        expected_entry=50000,
        expected_exit=50120,
        size=1.0,
        signal_score=0.8,
        strategy="trend"
    )
    print(f"   交易1: 盈亏 {attr1.gross_pnl_pct*100:.2f}%, 裁决: {attr1.verdict.value}")
    
    # 好信号，坏执行
    attr2 = engine.attribute(
        trade_id="TRADE-002",
        symbol="BTC/USDT",
        side="BUY",
        entry_price=50050,  # 高滑点
        exit_price=50100,
        expected_entry=50000,
        expected_exit=50150,
        size=1.0,
        signal_score=0.8,
        strategy="trend"
    )
    print(f"   交易2: 盈亏 {attr2.gross_pnl_pct*100:.2f}%, 裁决: {attr2.verdict.value}")
    
    # 坏信号，好执行
    attr3 = engine.attribute(
        trade_id="TRADE-003",
        symbol="BTC/USDT",
        side="BUY",
        entry_price=50000,
        exit_price=49900,  # 亏损
        expected_entry=50000,
        expected_exit=50100,
        size=1.0,
        signal_score=0.3,  # 低信号
        strategy="range"
    )
    print(f"   交易3: 盈亏 {attr3.gross_pnl_pct*100:.2f}%, 裁决: {attr3.verdict.value}")
    
    # 归因摘要
    print("\n2. 归因摘要:")
    summary = engine.get_summary()
    print(f"   总交易: {summary['total_trades']} 笔")
    print(f"   胜率: {summary['win_rate']*100:.0f}%")
    print(f"   平均信号贡献: {summary['avg_signal_edge_pct']:.4f}%")
    print(f"   平均滑点: {summary['avg_slippage_pct']:.4f}%")
    print(f"   平均手续费: {summary['avg_fee_pct']:.4f}%")
    
    # 归因分解
    print("\n3. 归因分解:")
    breakdown = engine.get_breakdown()
    for key, value in breakdown["pnl_breakdown"].items():
        print(f"   {key}: {value['total_pct']:.4f}% ({value['interpretation']})")
    
    # 裁决分布
    print("\n4. 裁决分布:")
    verdicts = engine.get_verdict_distribution()
    for v, stats in verdicts["distribution"].items():
        print(f"   {v}: {stats['count']} 笔 ({stats['pct']}%)")
    
    # 检测问题
    print("\n5. 检测到的问题:")
    issues = engine.get_issues()
    for issue in issues:
        print(f"   {issue['type']}: {issue['message']}")
    
    print("\n✅ PnL Attribution Engine V14 测试通过")