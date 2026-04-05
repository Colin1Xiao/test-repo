#!/usr/bin/env python3
"""
Liquidity Engine - 流动性感知系统 (V12)

核心认知：
价格 ≠ 你能成交的价格
市场不是不给你机会，是不给你"安全成交"的机会

核心能力：
1. 深度分析 - 前N档挂单 = 市场真实承接能力
2. 冲击成本 - 计算滑点
3. 流动性评分 - spread, depth, slippage
4. 流动性类型 - THICK/MEDIUM/THIN/FAKE
5. 假流动性检测 - 挂单多但撤单快

机构级护栏：
1. 冲击上限：slippage < 5bps
2. 吃单比例：order_size < depth * 20%
3. 假流动性检测：depth_high but fill_rate_low

决策优先级：
流动性 > 风控 > 策略
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime
from enum import Enum
from pathlib import Path
import json
from collections import deque

# ============================================================
# 枚举和常量
# ============================================================
class LiquidityType(Enum):
    """流动性类型"""
    THICK = "THICK"           # 厚流动性 - 深度高，可重仓
    MEDIUM = "MEDIUM"         # 中等流动性 - 可成交，小仓
    THIN = "THIN"             # 薄流动性 - 深度低，禁止
    FAKE = "FAKE"             # 假流动性 - 挂单多但撤单快，绝对禁止


class LiquidityAction(Enum):
    """流动性决策"""
    FULL_SIZE = "FULL_SIZE"       # 全仓执行
    REDUCED_SIZE = "REDUCED_SIZE" # 减半执行
    NO_TRADE = "NO_TRADE"         # 禁止交易
    REJECT = "REJECT"             # 拒绝（假流动性）


@dataclass
class LiquidityConfig:
    """流动性配置"""
    # 深度参数
    depth_levels: int = 10            # 分析深度档位
    
    # 评分阈值
    spread_threshold: float = 0.0005  # 点差阈值 (5bps)
    depth_threshold: float = 5.0      # 深度阈值 (BTC)
    slippage_threshold: float = 0.0005  # 滑点阈值 (5bps)
    
    # 评分权重
    spread_weight: float = 0.3
    depth_weight: float = 0.3
    slippage_weight: float = 0.4
    
    # 机构级护栏
    max_slippage_bps: float = 5.0     # 最大滑点 (bps)
    max_consumption_ratio: float = 0.2  # 最大吃单比例 (20%)
    min_liquidity_score: float = 0.5  # 最低流动性评分
    
    # 假流动性检测
    fake_liquidity_threshold: float = 0.5  # 成交率阈值
    depth_history_size: int = 20      # 深度历史窗口


@dataclass
class OrderbookSnapshot:
    """订单簿快照"""
    timestamp: str
    symbol: str
    bids: List[Tuple[float, float]]  # [(price, size), ...]
    asks: List[Tuple[float, float]]
    spread: float = 0.0
    mid_price: float = 0.0
    
    def __post_init__(self):
        if self.bids and self.asks:
            self.spread = (self.asks[0][0] - self.bids[0][0]) / self.bids[0][0]
            self.mid_price = (self.bids[0][0] + self.asks[0][0]) / 2


@dataclass
class LiquidityAnalysis:
    """流动性分析结果"""
    timestamp: str
    symbol: str
    
    # 深度数据
    bid_depth: float          # 买单深度
    ask_depth: float          # 卖单深度
    total_depth: float        # 总深度
    
    # 点差
    spread: float             # 点差 (比例)
    spread_bps: float         # 点差 (bps)
    
    # 滑点预估
    estimated_slippage: float  # 预估滑点
    estimated_slippage_bps: float  # 预估滑点 (bps)
    
    # 评分
    liquidity_score: float    # 流动性评分 (0-1)
    liquidity_type: LiquidityType
    
    # 决策
    action: LiquidityAction
    max_position: float       # 最大建议仓位
    recommended_size: float   # 建议下单量
    
    # 风险
    is_fake_liquidity: bool = False
    warnings: List[str] = field(default_factory=list)


@dataclass
class DepthHistory:
    """深度历史记录"""
    timestamps: deque = field(default_factory=lambda: deque(maxlen=20))
    depths: deque = field(default_factory=lambda: deque(maxlen=20))
    fill_rates: deque = field(default_factory=lambda: deque(maxlen=20))


# ============================================================
# Liquidity Engine 核心类
# ============================================================
class LiquidityEngine:
    """
    流动性感知系统
    
    核心认知：
    价格 ≠ 你能成交的价格
    市场不是不给你机会，是不给你"安全成交"的机会
    
    职责：
    1. 深度分析
    2. 冲击成本计算
    3. 流动性评分
    4. 假流动性检测
    5. 交易决策
    
    决策优先级：
    流动性 > 风控 > 策略
    """
    
    def __init__(self, config: LiquidityConfig = None):
        self.config = config or LiquidityConfig()
        
        # 历史数据
        self.depth_history: Dict[str, DepthHistory] = {}
        
        # 分析缓存
        self.last_analysis: Dict[str, LiquidityAnalysis] = {}
        
        # 假流动性标记
        self.fake_liquidity_symbols: set = set()
        
        # 持久化路径
        self.data_dir = Path(__file__).parent.parent / "logs" / "liquidity_engine"
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        print("🌊 Liquidity Engine V12 初始化完成")
        print(f"   深度档位: {self.config.depth_levels}")
        print(f"   最大滑点: {self.config.max_slippage_bps} bps")
        print(f"   最大吃单比例: {self.config.max_consumption_ratio * 100}%")
    
    # ============================================================
    # 1. 深度分析（最基础）
    # ============================================================
    def get_depth(
        self,
        orderbook: OrderbookSnapshot,
        levels: int = None
    ) -> Tuple[float, float, float]:
        """
        深度分析
        
        前N档挂单 = 市场真实承接能力
        
        Args:
            orderbook: 订单簿快照
            levels: 分析档位
        
        Returns:
            (bid_depth, ask_depth, total_depth)
        """
        if levels is None:
            levels = self.config.depth_levels
        
        # 计算买单深度
        bid_depth = sum(
            size for _, size in orderbook.bids[:levels]
        ) if orderbook.bids else 0
        
        # 计算卖单深度
        ask_depth = sum(
            size for _, size in orderbook.asks[:levels]
        ) if orderbook.asks else 0
        
        total_depth = bid_depth + ask_depth
        
        return bid_depth, ask_depth, total_depth
    
    def get_depth_distribution(
        self,
        orderbook: OrderbookSnapshot,
        levels: int = None
    ) -> Dict:
        """获取深度分布"""
        if levels is None:
            levels = self.config.depth_levels
        
        bid_levels = []
        ask_levels = []
        
        for i, (price, size) in enumerate(orderbook.bids[:levels]):
            bid_levels.append({
                "level": i + 1,
                "price": price,
                "size": size,
                "cumulative": sum(s for _, s in orderbook.bids[:i+1])
            })
        
        for i, (price, size) in enumerate(orderbook.asks[:levels]):
            ask_levels.append({
                "level": i + 1,
                "price": price,
                "size": size,
                "cumulative": sum(s for _, s in orderbook.asks[:i+1])
            })
        
        return {
            "bid_levels": bid_levels,
            "ask_levels": ask_levels
        }
    
    # ============================================================
    # 2. 冲击成本（核心指标）
    # ============================================================
    def estimate_impact(
        self,
        orderbook: OrderbookSnapshot,
        order_size: float,
        side: str = "BUY"
    ) -> Tuple[float, float, float]:
        """
        估算冲击成本
        
        Args:
            orderbook: 订单簿快照
            order_size: 订单大小 (BTC)
            side: BUY / SELL
        
        Returns:
            (avg_price, slippage, slippage_bps)
        """
        if side == "BUY":
            # 买入吃 ask
            levels = orderbook.asks
            best_price = orderbook.asks[0][0] if orderbook.asks else 0
        else:
            # 卖出吃 bid
            levels = orderbook.bids
            best_price = orderbook.bids[0][0] if orderbook.bids else 0
        
        if not levels or best_price == 0:
            return 0, 1.0, 10000  # 无数据，返回极大滑点
        
        remaining = order_size
        total_cost = 0
        levels_consumed = 0
        
        for price, size in levels:
            take = min(size, remaining)
            total_cost += take * price
            remaining -= take
            levels_consumed += 1
            
            if remaining <= 0:
                break
        
        # 无法完全成交
        if remaining > 0:
            # 估算剩余部分的极端价格
            extreme_price = levels[-1][0] if levels else best_price
            total_cost += remaining * extreme_price * (1.01 if side == "BUY" else 0.99)
        
        avg_price = total_cost / order_size
        slippage = abs(avg_price - best_price) / best_price
        slippage_bps = slippage * 10000
        
        return avg_price, slippage, slippage_bps
    
    def estimate_fill_price(
        self,
        orderbook: OrderbookSnapshot,
        order_size: float,
        side: str = "BUY"
    ) -> Dict:
        """
        估算成交价格详情
        
        Returns:
            {
                "best_price": 最佳价,
                "avg_price": 平均价,
                "worst_price": 最差价,
                "slippage": 滑点,
                "levels_consumed": 消耗档位数,
                "can_fill": 是否能成交
            }
        """
        if side == "BUY":
            levels = orderbook.asks
            best_price = orderbook.asks[0][0] if orderbook.asks else 0
        else:
            levels = orderbook.bids
            best_price = orderbook.bids[0][0] if orderbook.bids else 0
        
        if not levels:
            return {
                "best_price": 0,
                "avg_price": 0,
                "worst_price": 0,
                "slippage": 1.0,
                "levels_consumed": 0,
                "can_fill": False
            }
        
        remaining = order_size
        total_cost = 0
        worst_price = best_price
        levels_consumed = 0
        
        for price, size in levels:
            take = min(size, remaining)
            total_cost += take * price
            remaining -= take
            worst_price = price
            levels_consumed += 1
            
            if remaining <= 0:
                break
        
        avg_price = total_cost / order_size if order_size > 0 else 0
        slippage = abs(avg_price - best_price) / best_price if best_price > 0 else 1.0
        
        return {
            "best_price": best_price,
            "avg_price": avg_price,
            "worst_price": worst_price,
            "slippage": slippage,
            "slippage_bps": slippage * 10000,
            "levels_consumed": levels_consumed,
            "can_fill": remaining <= 0
        }
    
    # ============================================================
    # 3. 流动性评分（关键）
    # ============================================================
    def calculate_liquidity_score(
        self,
        spread: float,
        depth: float,
        slippage: float
    ) -> float:
        """
        计算流动性评分
        
        Args:
            spread: 点差 (比例)
            depth: 总深度
            slippage: 预估滑点
        
        Returns:
            liquidity_score (0-1)
        """
        score = 1.0
        
        # 点差惩罚
        if spread > self.config.spread_threshold:
            spread_penalty = min(spread / self.config.spread_threshold - 1, 1.0)
            score -= spread_penalty * self.config.spread_weight
        
        # 深度惩罚
        if depth < self.config.depth_threshold:
            depth_penalty = 1 - depth / self.config.depth_threshold
            score -= depth_penalty * self.config.depth_weight
        
        # 滑点惩罚
        if slippage > self.config.slippage_threshold:
            slippage_penalty = min(slippage / self.config.slippage_threshold - 1, 1.0)
            score -= slippage_penalty * self.config.slippage_weight
        
        return max(0, min(1, score))
    
    def classify_liquidity(
        self,
        liquidity_score: float,
        is_fake: bool = False
    ) -> LiquidityType:
        """
        分类流动性类型
        
        类型特征行为：
        - THICK: 深度高，可重仓
        - MEDIUM: 可成交，小仓
        - THIN: 深度低，禁止
        - FAKE: 挂单多但撤单快，绝对禁止
        """
        if is_fake:
            return LiquidityType.FAKE
        
        if liquidity_score >= 0.8:
            return LiquidityType.THICK
        elif liquidity_score >= 0.5:
            return LiquidityType.MEDIUM
        else:
            return LiquidityType.THIN
    
    # ============================================================
    # 4. 假流动性检测（高级）
    # ============================================================
    def detect_fake_liquidity(
        self,
        symbol: str,
        current_depth: float,
        fill_rate: float = None
    ) -> bool:
        """
        检测假流动性
        
        挂单多 ≠ 能成交
        
        Args:
            symbol: 交易对
            current_depth: 当前深度
            fill_rate: 成交率 (成交深度 / 挂单深度)
        
        Returns:
            is_fake: 是否为假流动性
        """
        # 初始化历史
        if symbol not in self.depth_history:
            self.depth_history[symbol] = DepthHistory()
        
        history = self.depth_history[symbol]
        
        # 记录当前深度
        history.timestamps.append(datetime.now().isoformat())
        history.depths.append(current_depth)
        
        if fill_rate is not None:
            history.fill_rates.append(fill_rate)
        
        # 需要足够历史数据
        if len(history.fill_rates) < 5:
            return False
        
        # 检测模式：深度高但成交率低
        avg_depth = sum(history.depths) / len(history.depths)
        avg_fill_rate = sum(history.fill_rates) / len(history.fill_rates)
        
        if avg_depth > self.config.depth_threshold * 2 and avg_fill_rate < self.config.fake_liquidity_threshold:
            self.fake_liquidity_symbols.add(symbol)
            return True
        
        # 移除标记（如果恢复正常）
        if avg_fill_rate >= self.config.fake_liquidity_threshold:
            self.fake_liquidity_symbols.discard(symbol)
        
        return False
    
    def get_fake_liquidity_warning(self, symbol: str) -> Optional[str]:
        """获取假流动性警告"""
        if symbol in self.fake_liquidity_symbols:
            return f"⚠️ {symbol} 检测到假流动性：挂单多但成交率低"
        return None
    
    # ============================================================
    # 5. 完整分析（主入口）
    # ============================================================
    def analyze(
        self,
        orderbook: OrderbookSnapshot,
        order_size: float = 0.1,
        side: str = "BUY"
    ) -> LiquidityAnalysis:
        """
        完整流动性分析
        
        Args:
            orderbook: 订单簿快照
            order_size: 订单大小
            side: BUY / SELL
        
        Returns:
            LiquidityAnalysis
        """
        symbol = orderbook.symbol
        timestamp = datetime.now().isoformat()
        
        # 1. 深度分析
        bid_depth, ask_depth, total_depth = self.get_depth(orderbook)
        
        # 2. 点差
        spread = orderbook.spread
        spread_bps = spread * 10000
        
        # 3. 滑点预估
        _, slippage, slippage_bps = self.estimate_impact(orderbook, order_size, side)
        
        # 4. 流动性评分
        liquidity_score = self.calculate_liquidity_score(spread, total_depth, slippage)
        
        # 5. 假流动性检测
        is_fake = self.detect_fake_liquidity(symbol, total_depth)
        
        # 6. 流动性类型
        liquidity_type = self.classify_liquidity(liquidity_score, is_fake)
        
        # 7. 决策
        action, max_position, recommended_size, warnings = self._make_decision(
            liquidity_score=liquidity_score,
            liquidity_type=liquidity_type,
            slippage_bps=slippage_bps,
            order_size=order_size,
            total_depth=total_depth
        )
        
        # 构建结果
        analysis = LiquidityAnalysis(
            timestamp=timestamp,
            symbol=symbol,
            bid_depth=bid_depth,
            ask_depth=ask_depth,
            total_depth=total_depth,
            spread=spread,
            spread_bps=spread_bps,
            estimated_slippage=slippage,
            estimated_slippage_bps=slippage_bps,
            liquidity_score=liquidity_score,
            liquidity_type=liquidity_type,
            action=action,
            max_position=max_position,
            recommended_size=recommended_size,
            is_fake_liquidity=is_fake,
            warnings=warnings
        )
        
        # 缓存
        self.last_analysis[symbol] = analysis
        
        return analysis
    
    def _make_decision(
        self,
        liquidity_score: float,
        liquidity_type: LiquidityType,
        slippage_bps: float,
        order_size: float,
        total_depth: float
    ) -> Tuple[LiquidityAction, float, float, List[str]]:
        """
        流动性决策
        
        决策优先级：流动性 > 风控 > 策略
        
        Returns:
            (action, max_position, recommended_size, warnings)
        """
        warnings = []
        
        # 假流动性 → 绝对禁止
        if liquidity_type == LiquidityType.FAKE:
            warnings.append("🚨 假流动性检测：挂单多但成交率低，绝对禁止")
            return LiquidityAction.REJECT, 0, 0, warnings
        
        # 滑点过大 → 禁止
        if slippage_bps > self.config.max_slippage_bps:
            warnings.append(f"⚠️ 滑点过大: {slippage_bps:.1f} bps > {self.config.max_slippage_bps} bps")
            return LiquidityAction.NO_TRADE, 0, 0, warnings
        
        # 吃单比例过大 → 禁止
        consumption_ratio = order_size / total_depth if total_depth > 0 else 1
        if consumption_ratio > self.config.max_consumption_ratio:
            warnings.append(f"⚠️ 吃单比例过大: {consumption_ratio*100:.1f}% > {self.config.max_consumption_ratio*100}%")
            return LiquidityAction.NO_TRADE, 0, 0, warnings
        
        # 流动性评分过低 → 禁止
        if liquidity_score < self.config.min_liquidity_score:
            warnings.append(f"⚠️ 流动性评分过低: {liquidity_score:.2f} < {self.config.min_liquidity_score}")
            return LiquidityAction.NO_TRADE, 0, 0, warnings
        
        # 薄流动性 → 禁止
        if liquidity_type == LiquidityType.THIN:
            warnings.append("⚠️ 薄流动性：深度不足，禁止交易")
            return LiquidityAction.NO_TRADE, 0, 0, warnings
        
        # 中等流动性 → 减仓
        if liquidity_type == LiquidityType.MEDIUM:
            warnings.append("🟡 中等流动性：建议减半执行")
            recommended_size = order_size * 0.5
            max_position = total_depth * self.config.max_consumption_ratio * 0.5
            return LiquidityAction.REDUCED_SIZE, max_position, recommended_size, warnings
        
        # 厚流动性 → 正常执行
        max_position = total_depth * self.config.max_consumption_ratio
        return LiquidityAction.FULL_SIZE, max_position, order_size, warnings
    
    # ============================================================
    # 6. 交易前检查（关键）
    # ============================================================
    def pre_trade_check(
        self,
        symbol: str,
        order_size: float,
        side: str = "BUY",
        orderbook: OrderbookSnapshot = None
    ) -> Tuple[bool, Dict]:
        """
        交易前流动性检查
        
        流动性 > 风控 > 策略
        
        Args:
            symbol: 交易对
            order_size: 订单大小
            side: BUY / SELL
            orderbook: 订单簿（可选，使用缓存）
        
        Returns:
            (can_trade, info)
        """
        # 使用缓存的分析
        if orderbook is None:
            if symbol in self.last_analysis:
                analysis = self.last_analysis[symbol]
            else:
                return False, {
                    "can_trade": False,
                    "reason": "NO_DATA",
                    "message": "无订单簿数据"
                }
        else:
            analysis = self.analyze(orderbook, order_size, side)
        
        # 假流动性 → 绝对禁止
        if analysis.is_fake_liquidity:
            return False, {
                "can_trade": False,
                "reason": "FAKE_LIQUIDITY",
                "message": "检测到假流动性，绝对禁止",
                "analysis": analysis.__dict__
            }
        
        # 根据决策返回
        if analysis.action == LiquidityAction.REJECT:
            return False, {
                "can_trade": False,
                "reason": "REJECTED",
                "message": "流动性被拒绝",
                "warnings": analysis.warnings
            }
        
        if analysis.action == LiquidityAction.NO_TRADE:
            return False, {
                "can_trade": False,
                "reason": "NO_TRADE",
                "message": "流动性不足，禁止交易",
                "warnings": analysis.warnings,
                "liquidity_score": analysis.liquidity_score
            }
        
        if analysis.action == LiquidityAction.REDUCED_SIZE:
            return True, {
                "can_trade": True,
                "reason": "REDUCED_SIZE",
                "message": "中等流动性，建议减半执行",
                "recommended_size": analysis.recommended_size,
                "max_position": analysis.max_position,
                "warnings": analysis.warnings
            }
        
        # FULL_SIZE
        return True, {
            "can_trade": True,
            "reason": "OK",
            "message": "流动性充足，正常执行",
            "recommended_size": analysis.recommended_size,
            "max_position": analysis.max_position,
            "liquidity_score": analysis.liquidity_score,
            "liquidity_type": analysis.liquidity_type.value
        }
    
    # ============================================================
    # 辅助方法
    # ============================================================
    def get_summary(self, symbol: str = None) -> Dict:
        """获取流动性摘要"""
        if symbol and symbol in self.last_analysis:
            analysis = self.last_analysis[symbol]
            return {
                "symbol": analysis.symbol,
                "spread_bps": round(analysis.spread_bps, 2),
                "total_depth": round(analysis.total_depth, 2),
                "liquidity_score": round(analysis.liquidity_score, 2),
                "liquidity_type": analysis.liquidity_type.value,
                "action": analysis.action.value,
                "is_fake_liquidity": analysis.is_fake_liquidity,
                "warnings": analysis.warnings
            }
        
        # 返回所有
        return {
            symbol: {
                "liquidity_score": round(a.liquidity_score, 2),
                "liquidity_type": a.liquidity_type.value,
                "spread_bps": round(a.spread_bps, 2),
                "total_depth": round(a.total_depth, 2)
            }
            for symbol, a in self.last_analysis.items()
        }
    
    def get_status(self) -> Dict:
        """获取引擎状态"""
        return {
            "config": {
                "depth_levels": self.config.depth_levels,
                "max_slippage_bps": self.config.max_slippage_bps,
                "max_consumption_ratio": self.config.max_consumption_ratio,
                "min_liquidity_score": self.config.min_liquidity_score
            },
            "symbols_tracked": len(self.last_analysis),
            "fake_liquidity_symbols": list(self.fake_liquidity_symbols),
            "last_update": max(
                (a.timestamp for a in self.last_analysis.values()),
                default=None
            )
        }


# ============================================================
# 便捷函数
# ============================================================
def create_liquidity_engine() -> LiquidityEngine:
    """创建流动性引擎"""
    return LiquidityEngine()


# ============================================================
# 测试
# ============================================================
if __name__ == "__main__":
    print("=== Liquidity Engine V12 测试 ===\n")
    
    engine = LiquidityEngine()
    
    # 创建测试订单簿
    print("1. 创建测试订单簿:")
    orderbook = OrderbookSnapshot(
        timestamp=datetime.now().isoformat(),
        symbol="BTC/USDT",
        bids=[
            (50000, 2.5),
            (49990, 3.0),
            (49980, 4.0),
            (49970, 5.0),
            (49960, 6.0)
        ],
        asks=[
            (50010, 2.0),
            (50020, 3.5),
            (50030, 4.5),
            (50040, 5.5),
            (50050, 7.0)
        ]
    )
    print(f"   交易对: {orderbook.symbol}")
    print(f"   最佳买价: {orderbook.bids[0][0]}")
    print(f"   最佳卖价: {orderbook.asks[0][0]}")
    print(f"   点差: {orderbook.spread * 10000:.2f} bps")
    
    # 深度分析
    print("\n2. 深度分析:")
    bid_depth, ask_depth, total_depth = engine.get_depth(orderbook)
    print(f"   买单深度: {bid_depth:.2f} BTC")
    print(f"   卖单深度: {ask_depth:.2f} BTC")
    print(f"   总深度: {total_depth:.2f} BTC")
    
    # 冲击成本
    print("\n3. 冲击成本分析 (买入 0.5 BTC):")
    avg_price, slippage, slippage_bps = engine.estimate_impact(orderbook, 0.5, "BUY")
    print(f"   平均价格: ${avg_price:.2f}")
    print(f"   滑点: {slippage * 100:.4f}% ({slippage_bps:.2f} bps)")
    
    # 完整分析
    print("\n4. 完整流动性分析:")
    analysis = engine.analyze(orderbook, 0.5, "BUY")
    print(f"   流动性评分: {analysis.liquidity_score:.2f}")
    print(f"   流动性类型: {analysis.liquidity_type.value}")
    print(f"   决策: {analysis.action.value}")
    print(f"   建议仓位: {analysis.recommended_size:.2f} BTC")
    print(f"   最大仓位: {analysis.max_position:.2f} BTC")
    
    # 交易前检查
    print("\n5. 交易前检查:")
    can_trade, info = engine.pre_trade_check("BTC/USDT", 0.5, "BUY", orderbook)
    print(f"   可交易: {'✅' if can_trade else '❌'}")
    print(f"   原因: {info['reason']}")
    print(f"   消息: {info['message']}")
    
    # 测试极限情况
    print("\n6. 极限情况测试 (买入 10 BTC，超过深度):")
    analysis_large = engine.analyze(orderbook, 10, "BUY")
    print(f"   流动性评分: {analysis_large.liquidity_score:.2f}")
    print(f"   决策: {analysis_large.action.value}")
    print(f"   警告: {analysis_large.warnings}")
    
    # 引擎状态
    print("\n7. 引擎状态:")
    status = engine.get_status()
    print(f"   跟踪交易对: {status['symbols_tracked']} 个")
    print(f"   假流动性标记: {status['fake_liquidity_symbols']}")
    
    print("\n✅ Liquidity Engine V12 测试通过")