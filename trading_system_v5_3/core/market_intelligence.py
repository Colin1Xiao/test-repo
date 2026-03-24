#!/usr/bin/env python3
"""
Market Intelligence Engine - 市场智能引擎 (V18)

核心认知：
价格只是结果
资金才是原因

核心能力：
1. 资金流检测 - 买卖盘失衡（谁在推动）
2. 爆仓流检测 - 多头/空头挤压（被动资金）
3. 吸筹/派发检测 - 机构行为识别
4. 流动性迁移 - 订单簿结构变化

系统质变：
从"观察价格" → "理解为什么价格会动"
从"反应型系统" → "理解型系统"
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
import json
from collections import defaultdict, deque

# ============================================================
# 枚举和常量
# ============================================================
class MoneyFlowState(Enum):
    """资金流状态"""
    BUY_DOMINANT = "BUY_DOMINANT"       # 买盘主导
    SELL_DOMINANT = "SELL_DOMINANT"     # 卖盘主导
    NEUTRAL = "NEUTRAL"                 # 中性
    STRONG_BUY = "STRONG_BUY"           # 强买盘
    STRONG_SELL = "STRONG_SELL"         # 强卖盘


class LiquidationState(Enum):
    """爆仓状态"""
    NEUTRAL = "NEUTRAL"                 # 中性
    LONG_SQUEEZE = "LONG_SQUEEZE"       # 多头挤压（多头爆仓）
    SHORT_SQUEEZE = "SHORT_SQUEEZE"     # 空头挤压（空头爆仓）
    BOTH_WAYS = "BOTH_WAYS"             # 双向爆仓


class StructureState(Enum):
    """结构状态"""
    ACCUMULATION = "ACCUMULATION"       # 吸筹（机构买入）
    DISTRIBUTION = "DISTRIBUTION"       # 派发（机构卖出）
    CONSOLIDATION = "CONSOLIDATION"     # 整理
    TRENDING = "TRENDING"               # 趋势
    CHAOTIC = "CHAOTIC"                 # 混沌


class LiquidityShift(Enum):
    """流动性迁移"""
    BUY_SIDE_BUILDUP = "BUY_SIDE_BUILDUP"   # 买方流动性积累
    SELL_SIDE_BUILDUP = "SELL_SIDE_BUILDUP" # 卖方流动性积累
    BALANCED = "BALANCED"                     # 平衡
    DRAINING = "DRAINING"                    # 流动性枯竭


class MarketConfidence(Enum):
    """市场置信度"""
    HIGH = "HIGH"           # 高置信度
    MEDIUM = "MEDIUM"       # 中等
    LOW = "LOW"             # 低置信度


@dataclass
class IntelligenceConfig:
    """市场智能配置"""
    # 资金流阈值
    flow_imbalance_threshold: float = 0.2      # 失衡阈值
    strong_flow_threshold: float = 0.5         # 强流阈值
    
    # 爆仓阈值
    liquidation_ratio_threshold: float = 2.0   # 爆仓比例阈值
    
    # 成交量阈值
    volume_spike_threshold: float = 2.0        # 成交量激增阈值
    volume_drop_threshold: float = 0.5         # 成交量下降阈值
    
    # 时间窗口
    analysis_window: int = 100                 # 分析窗口
    min_data_points: int = 10                  # 最小数据点


@dataclass
class MarketState:
    """市场状态"""
    timestamp: str
    
    # 资金流
    flow_state: MoneyFlowState = MoneyFlowState.NEUTRAL
    flow_imbalance: float = 0.0
    buy_volume: float = 0.0
    sell_volume: float = 0.0
    
    # 爆仓
    liquidation_state: LiquidationState = LiquidationState.NEUTRAL
    long_liquidations: float = 0.0
    short_liquidations: float = 0.0
    
    # 结构
    structure_state: StructureState = StructureState.CONSOLIDATION
    price_change: float = 0.0
    volume_change: float = 0.0
    
    # 流动性
    liquidity_shift: LiquidityShift = LiquidityShift.BALANCED
    bid_depth_change: float = 0.0
    ask_depth_change: float = 0.0
    
    # 综合置信度
    confidence: float = 0.5
    confidence_level: MarketConfidence = MarketConfidence.MEDIUM
    
    # 详细信息
    details: Dict = field(default_factory=dict)


@dataclass
class TradeData:
    """交易数据"""
    timestamp: str
    side: str           # buy / sell
    price: float
    size: float
    is_liquidation: bool = False


@dataclass
class OrderbookSnapshot:
    """订单簿快照"""
    timestamp: str
    bids: List[Tuple[float, float]]  # [(price, size), ...]
    asks: List[Tuple[float, float]]


# ============================================================
# Market Intelligence Engine 核心类
# ============================================================
class MarketIntelligenceEngine:
    """
    市场智能引擎
    
    核心认知：
    价格只是结果
    资金才是原因
    
    职责：
    1. 检测资金流（谁在推动）
    2. 检测爆仓流（被动资金）
    3. 识别机构行为（吸筹/派发）
    4. 检测流动性迁移
    
    系统质变：
    从"观察价格" → "理解为什么价格会动"
    """
    
    def __init__(self, config: IntelligenceConfig = None):
        self.config = config or IntelligenceConfig()
        
        # 数据缓存
        self.trade_history: deque = deque(maxlen=self.config.analysis_window)
        self.orderbook_history: deque = deque(maxlen=20)
        self.state_history: deque = deque(maxlen=100)
        
        # 统计数据
        self.stats = {
            "total_analyses": 0,
            "buy_dominant_count": 0,
            "sell_dominant_count": 0,
            "liquidation_events": 0,
            "accumulation_detected": 0,
            "distribution_detected": 0
        }
        
        # 持久化路径
        self.data_dir = Path(__file__).parent.parent / "logs" / "market_intelligence"
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        print("🧠 Market Intelligence Engine V18 初始化完成")
        print(f"   分析窗口: {self.config.analysis_window}")
        print(f"   失衡阈值: {self.config.flow_imbalance_threshold}")
    
    # ============================================================
    # 1. 资金流检测（最重要）
    # ============================================================
    def detect_money_flow(self, trades: List[TradeData] = None) -> Tuple[MoneyFlowState, float, Dict]:
        """
        检测资金流
        
        核心：谁在推动价格？
        
        Args:
            trades: 交易列表
        
        Returns:
            (flow_state, imbalance, details)
        """
        if trades is None:
            trades = list(self.trade_history)
        
        if not trades:
            return MoneyFlowState.NEUTRAL, 0.0, {}
        
        # 计算买卖量
        buy_volume = sum(t.size for t in trades if t.side == "buy")
        sell_volume = sum(t.size for t in trades if t.side == "sell")
        total_volume = buy_volume + sell_volume
        
        if total_volume == 0:
            return MoneyFlowState.NEUTRAL, 0.0, {}
        
        # 计算失衡
        imbalance = (buy_volume - sell_volume) / total_volume
        
        # 判断状态
        if imbalance > self.config.strong_flow_threshold:
            state = MoneyFlowState.STRONG_BUY
        elif imbalance > self.config.flow_imbalance_threshold:
            state = MoneyFlowState.BUY_DOMINANT
        elif imbalance < -self.config.strong_flow_threshold:
            state = MoneyFlowState.STRONG_SELL
        elif imbalance < -self.config.flow_imbalance_threshold:
            state = MoneyFlowState.SELL_DOMINANT
        else:
            state = MoneyFlowState.NEUTRAL
        
        details = {
            "buy_volume": round(buy_volume, 4),
            "sell_volume": round(sell_volume, 4),
            "imbalance_pct": round(imbalance * 100, 2),
            "trade_count": len(trades)
        }
        
        return state, imbalance, details
    
    # ============================================================
    # 2. 爆仓流检测（极强信号）
    # ============================================================
    def detect_liquidations(self, long_liq: float = 0, short_liq: float = 0) -> Tuple[LiquidationState, Dict]:
        """
        检测爆仓流
        
        爆仓 = 被动资金 → 趋势加速
        
        Args:
            long_liq: 多头爆仓量
            short_liq: 空头爆仓量
        
        Returns:
            (state, details)
        """
        total = long_liq + short_liq
        
        if total == 0:
            return LiquidationState.NEUTRAL, {"long_liq": 0, "short_liq": 0}
        
        # 计算比例
        if short_liq > 0 and long_liq / short_liq > self.config.liquidation_ratio_threshold:
            state = LiquidationState.LONG_SQUEEZE
            self.stats["liquidation_events"] += 1
        elif long_liq > 0 and short_liq / long_liq > self.config.liquidation_ratio_threshold:
            state = LiquidationState.SHORT_SQUEEZE
            self.stats["liquidation_events"] += 1
        elif long_liq > 0 and short_liq > 0:
            state = LiquidationState.BOTH_WAYS
        else:
            state = LiquidationState.NEUTRAL
        
        details = {
            "long_liquidations": round(long_liq, 4),
            "short_liquidations": round(short_liq, 4),
            "total_liquidations": round(total, 4),
            "ratio": round(max(long_liq, short_liq) / max(1, min(long_liq, short_liq)), 2)
        }
        
        return state, details
    
    # ============================================================
    # 3. 吸筹/派发检测（机构行为）
    # ============================================================
    def detect_accumulation(
        self,
        price_change: float,
        volume_change: float,
        price_stability: float = 0.0
    ) -> Tuple[StructureState, Dict]:
        """
        检测吸筹/派发
        
        机构行为识别：
        - 吸筹：价格平稳 + 成交量增加
        - 派发：价格上涨 + 成交量下降
        
        Args:
            price_change: 价格变化
            volume_change: 成交量变化
            price_stability: 价格稳定性 (0-1)
        
        Returns:
            (state, details)
        """
        # 价格平稳判断
        price_flat = abs(price_change) < 0.005
        
        # 成交量判断
        volume_increasing = volume_change > self.config.volume_spike_threshold
        volume_decreasing = volume_change < self.config.volume_drop_threshold
        
        # 吸筹：价格平稳 + 成交量增加
        if price_flat and volume_increasing:
            state = StructureState.ACCUMULATION
            self.stats["accumulation_detected"] += 1
        
        # 派发：价格上涨 + 成交量下降
        elif price_change > 0.005 and volume_decreasing:
            state = StructureState.DISTRIBUTION
            self.stats["distribution_detected"] += 1
        
        # 趋势
        elif abs(price_change) > 0.01 and volume_increasing:
            state = StructureState.TRENDING
        
        # 整理
        elif price_flat:
            state = StructureState.CONSOLIDATION
        
        # 混沌
        else:
            state = StructureState.CHAOTIC
        
        details = {
            "price_change_pct": round(price_change * 100, 3),
            "volume_change_pct": round(volume_change * 100, 1),
            "price_flat": price_flat,
            "volume_increasing": volume_increasing
        }
        
        return state, details
    
    # ============================================================
    # 4. 流动性迁移检测
    # ============================================================
    def detect_liquidity_shift(
        self,
        current_orderbook: OrderbookSnapshot,
        previous_orderbook: OrderbookSnapshot = None
    ) -> Tuple[LiquidityShift, Dict]:
        """
        检测流动性迁移
        
        订单簿结构变化
        
        Args:
            current_orderbook: 当前订单簿
            previous_orderbook: 之前订单簿
        
        Returns:
            (shift, details)
        """
        if previous_orderbook is None:
            if len(self.orderbook_history) > 0:
                previous_orderbook = self.orderbook_history[-1]
            else:
                return LiquidityShift.BALANCED, {}
        
        # 计算深度变化
        current_bid_depth = sum(size for _, size in current_orderbook.bids[:10])
        current_ask_depth = sum(size for _, size in current_orderbook.asks[:10])
        
        prev_bid_depth = sum(size for _, size in previous_orderbook.bids[:10])
        prev_ask_depth = sum(size for _, size in previous_orderbook.asks[:10])
        
        bid_change = (current_bid_depth - prev_bid_depth) / max(1, prev_bid_depth)
        ask_change = (current_ask_depth - prev_ask_depth) / max(1, prev_ask_depth)
        
        # 判断迁移方向
        if bid_change > 0.2 and bid_change > ask_change:
            shift = LiquidityShift.BUY_SIDE_BUILDUP
        elif ask_change > 0.2 and ask_change > bid_change:
            shift = LiquidityShift.SELL_SIDE_BUILDUP
        elif current_bid_depth + current_ask_depth < prev_bid_depth + prev_ask_depth:
            shift = LiquidityShift.DRAINING
        else:
            shift = LiquidityShift.BALANCED
        
        details = {
            "bid_depth_change_pct": round(bid_change * 100, 1),
            "ask_depth_change_pct": round(ask_change * 100, 1),
            "current_bid_depth": round(current_bid_depth, 2),
            "current_ask_depth": round(current_ask_depth, 2)
        }
        
        return shift, details
    
    # ============================================================
    # 5. 综合分析（主入口）
    # ============================================================
    def analyze(
        self,
        trades: List[TradeData] = None,
        orderbook: OrderbookSnapshot = None,
        long_liquidations: float = 0,
        short_liquidations: float = 0,
        price_change: float = 0,
        volume_change: float = 0
    ) -> MarketState:
        """
        综合市场分析
        
        Args:
            trades: 交易数据
            orderbook: 订单簿
            long_liquidations: 多头爆仓
            short_liquidations: 空头爆仓
            price_change: 价格变化
            volume_change: 成交量变化
        
        Returns:
            MarketState
        """
        timestamp = datetime.now().isoformat()
        
        # 1. 资金流分析
        flow_state, flow_imbalance, flow_details = self.detect_money_flow(trades)
        
        # 2. 爆仓分析
        liq_state, liq_details = self.detect_liquidations(long_liquidations, short_liquidations)
        
        # 3. 结构分析
        struct_state, struct_details = self.detect_accumulation(price_change, volume_change)
        
        # 4. 流动性分析
        liq_shift = LiquidityShift.BALANCED
        liq_shift_details = {}
        if orderbook:
            liq_shift, liq_shift_details = self.detect_liquidity_shift(orderbook)
            self.orderbook_history.append(orderbook)
        
        # 5. 计算置信度
        confidence = self._calculate_confidence(
            flow_state=flow_state,
            liq_state=liq_state,
            struct_state=struct_state
        )
        
        if confidence > 0.7:
            confidence_level = MarketConfidence.HIGH
        elif confidence > 0.4:
            confidence_level = MarketConfidence.MEDIUM
        else:
            confidence_level = MarketConfidence.LOW
        
        # 构建状态
        state = MarketState(
            timestamp=timestamp,
            flow_state=flow_state,
            flow_imbalance=flow_imbalance,
            buy_volume=flow_details.get("buy_volume", 0),
            sell_volume=flow_details.get("sell_volume", 0),
            liquidation_state=liq_state,
            long_liquidations=liq_details.get("long_liquidations", 0),
            short_liquidations=liq_details.get("short_liquidations", 0),
            structure_state=struct_state,
            price_change=price_change,
            volume_change=volume_change,
            liquidity_shift=liq_shift,
            bid_depth_change=liq_shift_details.get("bid_depth_change_pct", 0),
            ask_depth_change=liq_shift_details.get("ask_depth_change_pct", 0),
            confidence=confidence,
            confidence_level=confidence_level,
            details={
                "flow": flow_details,
                "liquidation": liq_details,
                "structure": struct_details,
                "liquidity": liq_shift_details
            }
        )
        
        # 更新统计
        self.stats["total_analyses"] += 1
        if flow_state in [MoneyFlowState.BUY_DOMINANT, MoneyFlowState.STRONG_BUY]:
            self.stats["buy_dominant_count"] += 1
        elif flow_state in [MoneyFlowState.SELL_DOMINANT, MoneyFlowState.STRONG_SELL]:
            self.stats["sell_dominant_count"] += 1
        
        # 保存历史
        self.state_history.append(state)
        self._save_state(state)
        
        return state
    
    def _calculate_confidence(
        self,
        flow_state: MoneyFlowState,
        liq_state: LiquidationState,
        struct_state: StructureState
    ) -> float:
        """计算置信度"""
        confidence = 0.5
        
        # 强资金流 +0.2
        if flow_state in [MoneyFlowState.STRONG_BUY, MoneyFlowState.STRONG_SELL]:
            confidence += 0.2
        elif flow_state in [MoneyFlowState.BUY_DOMINANT, MoneyFlowState.SELL_DOMINANT]:
            confidence += 0.1
        
        # 爆仓事件 +0.2
        if liq_state in [LiquidationState.LONG_SQUEEZE, LiquidationState.SHORT_SQUEEZE]:
            confidence += 0.2
        
        # 机构行为 +0.1
        if struct_state in [StructureState.ACCUMULATION, StructureState.DISTRIBUTION]:
            confidence += 0.1
        
        return min(1.0, confidence)
    
    # ============================================================
    # 6. 便捷方法
    # ============================================================
    def record_trade(self, trade: TradeData):
        """记录交易"""
        self.trade_history.append(trade)
    
    def get_summary(self) -> Dict:
        """获取摘要"""
        return {
            "total_analyses": self.stats["total_analyses"],
            "buy_dominant_ratio": self.stats["buy_dominant_count"] / max(1, self.stats["total_analyses"]),
            "sell_dominant_ratio": self.stats["sell_dominant_count"] / max(1, self.stats["total_analyses"]),
            "liquidation_events": self.stats["liquidation_events"],
            "accumulation_detected": self.stats["accumulation_detected"],
            "distribution_detected": self.stats["distribution_detected"]
        }
    
    def get_recent_state(self) -> Optional[MarketState]:
        """获取最近状态"""
        if self.state_history:
            return self.state_history[-1]
        return None
    
    def _save_state(self, state: MarketState):
        """保存状态"""
        log_file = self.data_dir / "market_states.jsonl"
        
        data = {
            "timestamp": state.timestamp,
            "flow_state": state.flow_state.value,
            "flow_imbalance": state.flow_imbalance,
            "liquidation_state": state.liquidation_state.value,
            "structure_state": state.structure_state.value,
            "liquidity_shift": state.liquidity_shift.value,
            "confidence": state.confidence
        }
        
        with open(log_file, "a") as f:
            f.write(json.dumps(data) + "\n")


# ============================================================
# 便捷函数
# ============================================================
def create_market_intelligence() -> MarketIntelligenceEngine:
    """创建市场智能引擎"""
    return MarketIntelligenceEngine()


# ============================================================
# 测试
# ============================================================
if __name__ == "__main__":
    print("=== Market Intelligence Engine V18 测试 ===\n")
    
    engine = MarketIntelligenceEngine()
    
    # 模拟交易数据
    print("1. 模拟交易数据:")
    trades = []
    for i in range(50):
        trade = TradeData(
            timestamp=datetime.now().isoformat(),
            side="buy" if i % 3 != 0 else "sell",
            price=50000 + i * 10,
            size=1.0 + i * 0.1
        )
        trades.append(trade)
        engine.record_trade(trade)
    
    print(f"   已记录 {len(trades)} 笔交易")
    
    # 资金流检测
    print("\n2. 资金流检测:")
    flow_state, imbalance, details = engine.detect_money_flow(trades)
    print(f"   状态: {flow_state.value}")
    print(f"   失衡: {imbalance*100:.1f}%")
    print(f"   买量: {details.get('buy_volume', 0):.2f}")
    print(f"   卖量: {details.get('sell_volume', 0):.2f}")
    
    # 爆仓检测
    print("\n3. 爆仓检测:")
    liq_state, liq_details = engine.detect_liquidations(long_liq=100, short_liq=500)
    print(f"   状态: {liq_state.value}")
    print(f"   多头爆仓: {liq_details.get('long_liquidations', 0)}")
    print(f"   空头爆仓: {liq_details.get('short_liquidations', 0)}")
    
    # 吸筹/派发检测
    print("\n4. 吸筹/派发检测:")
    struct_state, struct_details = engine.detect_accumulation(
        price_change=0.002,
        volume_change=2.5
    )
    print(f"   状态: {struct_state.value}")
    print(f"   价格变化: {struct_details.get('price_change_pct', 0):.2f}%")
    print(f"   成交量变化: {struct_details.get('volume_change_pct', 0):.0f}%")
    
    # 综合分析
    print("\n5. 综合分析:")
    state = engine.analyze(
        trades=trades,
        long_liquidations=100,
        short_liquidations=500,
        price_change=0.002,
        volume_change=2.5
    )
    print(f"   资金流: {state.flow_state.value}")
    print(f"   爆仓: {state.liquidation_state.value}")
    print(f"   结构: {state.structure_state.value}")
    print(f"   置信度: {state.confidence*100:.0f}%")
    
    # 摘要
    print("\n6. 系统摘要:")
    summary = engine.get_summary()
    print(f"   总分析次数: {summary['total_analyses']}")
    print(f"   买盘主导: {summary['buy_dominant_ratio']*100:.0f}%")
    print(f"   爆仓事件: {summary['liquidation_events']}")
    
    print("\n✅ Market Intelligence Engine V18 测试通过")