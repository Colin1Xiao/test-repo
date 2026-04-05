#!/usr/bin/env python3
"""
Execution Optimizer - 执行优化引擎 (V13)

核心认知：
策略决定你能赚多少
执行决定你能留下多少

核心能力：
1. 执行模式选择 - MARKET/LIMIT/TWAP/POV/SKIP
2. 智能限价 - 尽量成交 + 控制滑点
3. 拆单执行 - TWAP (时间拆单) / POV (跟随成交量)
4. 执行护栏 - 滑点监控/未成交保护/部分成交处理

解决的问题：
市价单 → 快，但滑点高
限价单 → 便宜，但可能成交不了
目标：在"成交概率"和"滑点成本"之间找到最优解
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Any, Callable
from datetime import datetime
from enum import Enum
from pathlib import Path
import json
import time
import asyncio

# ============================================================
# 枚举和常量
# ============================================================
class ExecutionMode(Enum):
    """执行模式"""
    FULL_MARKET = "FULL_MARKET"   # 全仓市价
    SMART_LIMIT = "SMART_LIMIT"   # 智能限价
    TWAP = "TWAP"                 # 时间拆单
    POV = "POV"                   # 跟随成交量
    ICEBERG = "ICEBERG"           # 冰山订单
    SKIP = "SKIP"                 # 跳过（流动性差）


class ExecutionStatus(Enum):
    """执行状态"""
    PENDING = "PENDING"
    EXECUTING = "EXECUTING"
    FILLED = "FILLED"
    PARTIAL = "PARTIAL"
    CANCELLED = "CANCELLED"
    FAILED = "FAILED"


@dataclass
class ExecutionConfig:
    """执行配置"""
    # 模式选择阈值
    market_threshold: float = 0.85    # 流动性评分 > 此值用市价
    limit_threshold: float = 0.70     # 流动性评分 > 此值用限价
    twap_threshold: float = 0.60      # 流动性评分 > 此值用 TWAP
    
    # 智能限价
    limit_price_offset_bps: float = 2.0  # 限价偏移 (bps)
    
    # TWAP 配置
    twap_chunks: int = 3              # 拆单数量
    twap_interval_sec: float = 1.0    # 拆单间隔 (秒)
    
    # POV 配置
    pov_volume_ratio: float = 0.1     # 跟随成交量比例
    
    # 冰山订单
    iceberg_visible_ratio: float = 0.2  # 可见比例
    
    # 护栏
    max_slippage_bps: float = 5.0     # 最大滑点 (bps)
    unfilled_timeout_sec: float = 2.0  # 未成交超时 (秒)
    partial_fill_threshold: float = 0.8  # 部分成交阈值
    
    # 滑点监控
    slippage_check_enabled: bool = True
    realtime_cancel_enabled: bool = True


@dataclass
class ExecutionPlan:
    """执行计划"""
    mode: ExecutionMode
    symbol: str
    side: str               # BUY / SELL
    total_size: float
    recommended_size: float
    
    # 拆单信息
    chunks: int = 1
    chunk_size: float = 0.0
    interval_sec: float = 0.0
    
    # 限价信息
    limit_price: float = 0.0
    price_offset_bps: float = 0.0
    
    # 流动性信息
    liquidity_score: float = 0.0
    liquidity_type: str = ""
    
    # 决策依据
    reason: str = ""


@dataclass
class ExecutionResult:
    """执行结果"""
    execution_id: str
    timestamp: str
    symbol: str
    side: str
    mode: ExecutionMode
    
    # 执行数据
    requested_size: float
    filled_size: float
    avg_price: float
    expected_price: float
    
    # 成本分析
    slippage: float           # 实际滑点
    slippage_bps: float       # 实际滑点 (bps)
    cost_saved: float         # 相比市价节省
    
    # 执行统计
    fill_rate: float          # 成交率
    latency_ms: float         # 延迟 (毫秒)
    chunks_executed: int      # 已执行拆单数
    
    # 状态
    status: ExecutionStatus
    
    # 详细信息
    details: Dict = field(default_factory=dict)


@dataclass
class OrderTracker:
    """订单追踪"""
    order_id: str
    symbol: str
    side: str
    size: float
    filled: float = 0.0
    avg_price: float = 0.0
    status: ExecutionStatus = ExecutionStatus.PENDING
    created_at: float = 0.0
    updated_at: float = 0.0


# ============================================================
# Execution Optimizer 核心类
# ============================================================
class ExecutionOptimizer:
    """
    执行优化引擎
    
    核心认知：
    策略决定你能赚多少
    执行决定你能留下多少
    
    职责：
    1. 执行模式选择
    2. 智能限价
    3. 拆单执行
    4. 执行护栏
    
    目标：
    在"成交概率"和"滑点成本"之间找到最优解
    """
    
    def __init__(self, config: ExecutionConfig = None):
        self.config = config or ExecutionConfig()
        
        # 订单追踪
        self.order_trackers: Dict[str, OrderTracker] = {}
        
        # 执行历史
        self.execution_history: List[ExecutionResult] = []
        
        # 统计数据
        self.stats = {
            "total_executions": 0,
            "total_filled": 0.0,
            "total_slippage_bps": 0.0,
            "avg_fill_rate": 0.0,
            "avg_slippage_bps": 0.0
        }
        
        # 执行计数器
        self._execution_counter = 0
        
        # 持久化路径
        self.data_dir = Path(__file__).parent.parent / "logs" / "execution_optimizer"
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        print("⚡ Execution Optimizer V13 初始化完成")
        print(f"   市价阈值: {self.config.market_threshold}")
        print(f"   限价阈值: {self.config.limit_threshold}")
        print(f"   最大滑点: {self.config.max_slippage_bps} bps")
    
    # ============================================================
    # 1. 执行模式选择（最关键）
    # ============================================================
    def choose_mode(
        self,
        liquidity_score: float,
        order_size: float,
        urgency: float = 0.5
    ) -> ExecutionMode:
        """
        执行模式选择
        
        核心逻辑：
        流动性好 → 用市价
        流动性一般 → 用限价
        流动性差 → 不交易
        
        Args:
            liquidity_score: 流动性评分 (0-1)
            order_size: 订单大小
            urgency: 紧急程度 (0-1)
        
        Returns:
            ExecutionMode
        """
        # 流动性极好 + 紧急 → 全仓市价
        if liquidity_score >= self.config.market_threshold and urgency > 0.7:
            return ExecutionMode.FULL_MARKET
        
        # 流动性好 → 智能限价
        if liquidity_score >= self.config.limit_threshold:
            return ExecutionMode.SMART_LIMIT
        
        # 流动性一般 → TWAP
        if liquidity_score >= self.config.twap_threshold:
            return ExecutionMode.TWAP
        
        # 流动性差 → 跳过
        return ExecutionMode.SKIP
    
    def create_execution_plan(
        self,
        symbol: str,
        side: str,
        order_size: float,
        liquidity_score: float,
        liquidity_type: str,
        orderbook: Dict = None,
        urgency: float = 0.5
    ) -> ExecutionPlan:
        """
        创建执行计划
        
        Args:
            symbol: 交易对
            side: BUY / SELL
            order_size: 订单大小
            liquidity_score: 流动性评分
            liquidity_type: 流动性类型
            orderbook: 订单簿 (可选)
            urgency: 紧急程度
        
        Returns:
            ExecutionPlan
        """
        # 选择执行模式
        mode = self.choose_mode(liquidity_score, order_size, urgency)
        
        # 流动性差 → 跳过
        if mode == ExecutionMode.SKIP:
            return ExecutionPlan(
                mode=mode,
                symbol=symbol,
                side=side,
                total_size=order_size,
                recommended_size=0,
                liquidity_score=liquidity_score,
                liquidity_type=liquidity_type,
                reason="流动性不足，建议跳过"
            )
        
        # 计算建议大小
        recommended_size = self._calculate_recommended_size(
            order_size, liquidity_score, mode
        )
        
        # 根据模式配置计划
        chunks = 1
        chunk_size = recommended_size
        interval_sec = 0.0
        limit_price = 0.0
        price_offset_bps = 0.0
        reason = ""
        
        if mode == ExecutionMode.FULL_MARKET:
            reason = f"流动性优秀 ({liquidity_score:.2f})，全仓市价执行"
        
        elif mode == ExecutionMode.SMART_LIMIT:
            # 计算智能限价
            if orderbook:
                limit_price, price_offset_bps = self._calculate_smart_limit(
                    orderbook, side
                )
            reason = f"流动性良好 ({liquidity_score:.2f})，智能限价执行"
        
        elif mode == ExecutionMode.TWAP:
            chunks = self.config.twap_chunks
            chunk_size = recommended_size / chunks
            interval_sec = self.config.twap_interval_sec
            reason = f"流动性一般 ({liquidity_score:.2f})，TWAP 分批执行"
        
        elif mode == ExecutionMode.POV:
            chunks = self.config.twap_chunks
            reason = f"跟随成交量执行 ({liquidity_score:.2f})"
        
        return ExecutionPlan(
            mode=mode,
            symbol=symbol,
            side=side,
            total_size=order_size,
            recommended_size=recommended_size,
            chunks=chunks,
            chunk_size=chunk_size,
            interval_sec=interval_sec,
            limit_price=limit_price,
            price_offset_bps=price_offset_bps,
            liquidity_score=liquidity_score,
            liquidity_type=liquidity_type,
            reason=reason
        )
    
    # ============================================================
    # 2. 智能限价（关键）
    # ============================================================
    def _calculate_smart_limit(
        self,
        orderbook: Dict,
        side: str
    ) -> Tuple[float, float]:
        """
        计算智能限价
        
        目的：尽量成交 + 控制滑点
        
        Args:
            orderbook: 订单簿
            side: BUY / SELL
        
        Returns:
            (limit_price, price_offset_bps)
        """
        offset_bps = self.config.limit_price_offset_bps
        offset = offset_bps / 10000
        
        if side == "BUY":
            # 买入：略低于 best ask
            best_ask = orderbook.get("asks", [[0, 0]])[0][0]
            limit_price = best_ask * (1 - offset)
        else:
            # 卖出：略高于 best bid
            best_bid = orderbook.get("bids", [[0, 0]])[0][0]
            limit_price = best_bid * (1 + offset)
        
        return limit_price, offset_bps
    
    def get_limit_price(
        self,
        orderbook: Dict,
        side: str,
        aggressiveness: float = 0.5
    ) -> float:
        """
        获取限价
        
        Args:
            orderbook: 订单簿
            side: BUY / SELL
            aggressiveness: 激进程度 (0-1)
        
        Returns:
            limit_price
        """
        # 激进程度影响偏移
        # 0 = 被动 (偏移大) , 1 = 激进 (偏移小)
        offset_bps = self.config.limit_price_offset_bps * (1 - aggressiveness * 0.5)
        offset = offset_bps / 10000
        
        if side == "BUY":
            best_ask = orderbook.get("asks", [[0, 0]])[0][0]
            return best_ask * (1 - offset)
        else:
            best_bid = orderbook.get("bids", [[0, 0]])[0][0]
            return best_bid * (1 + offset)
    
    # ============================================================
    # 3. 拆单执行（机构级）
    # ============================================================
    def create_twap_schedule(
        self,
        total_size: float,
        chunks: int = None,
        interval_sec: float = None
    ) -> List[Dict]:
        """
        创建 TWAP 拆单计划
        
        Args:
            total_size: 总大小
            chunks: 拆单数量
            interval_sec: 间隔时间
        
        Returns:
            [{"chunk": 1, "size": x, "delay": 0}, ...]
        """
        if chunks is None:
            chunks = self.config.twap_chunks
        if interval_sec is None:
            interval_sec = self.config.twap_interval_sec
        
        chunk_size = total_size / chunks
        
        schedule = []
        for i in range(chunks):
            schedule.append({
                "chunk": i + 1,
                "size": chunk_size,
                "delay": i * interval_sec
            })
        
        return schedule
    
    def create_pov_schedule(
        self,
        market_volume: float,
        ratio: float = None
    ) -> Dict:
        """
        创建 POV (跟随成交量) 拆单计划
        
        Args:
            market_volume: 市场成交量
            ratio: 跟随比例
        
        Returns:
            {"order_size": x, "ratio": r}
        """
        if ratio is None:
            ratio = self.config.pov_volume_ratio
        
        order_size = market_volume * ratio
        
        return {
            "order_size": order_size,
            "ratio": ratio,
            "market_volume": market_volume
        }
    
    def create_iceberg_plan(
        self,
        total_size: float,
        visible_ratio: float = None
    ) -> Dict:
        """
        创建冰山订单计划
        
        Args:
            total_size: 总大小
            visible_ratio: 可见比例
        
        Returns:
            {"visible_size": x, "hidden_size": y}
        """
        if visible_ratio is None:
            visible_ratio = self.config.iceberg_visible_ratio
        
        visible_size = total_size * visible_ratio
        
        return {
            "total_size": total_size,
            "visible_size": visible_size,
            "hidden_size": total_size - visible_size,
            "visible_ratio": visible_ratio
        }
    
    # ============================================================
    # 4. 执行护栏（非常关键）
    # ============================================================
    def check_slippage(
        self,
        expected_price: float,
        actual_price: float,
        side: str
    ) -> Tuple[bool, float]:
        """
        检查滑点
        
        Args:
            expected_price: 预期价格
            actual_price: 实际价格
            side: BUY / SELL
        
        Returns:
            (is_ok, slippage_bps)
        """
        if expected_price == 0:
            return False, 10000
        
        if side == "BUY":
            # 买入：实际价格高于预期是负面
            slippage = (actual_price - expected_price) / expected_price
        else:
            # 卖出：实际价格低于预期是负面
            slippage = (expected_price - actual_price) / expected_price
        
        slippage_bps = abs(slippage) * 10000
        
        is_ok = slippage_bps <= self.config.max_slippage_bps
        
        return is_ok, slippage_bps
    
    def should_cancel_unfilled(
        self,
        order: OrderTracker,
        current_time: float = None
    ) -> bool:
        """
        检查是否应该取消未成交订单
        
        Args:
            order: 订单追踪器
            current_time: 当前时间
        
        Returns:
            should_cancel
        """
        if current_time is None:
            current_time = time.time()
        
        elapsed = current_time - order.created_at
        
        # 超时未成交
        if elapsed > self.config.unfilled_timeout_sec:
            return True
        
        # 成交率过低
        if order.size > 0:
            fill_rate = order.filled / order.size
            if elapsed > self.config.unfilled_timeout_sec * 0.5 and fill_rate < 0.1:
                return True
        
        return False
    
    def handle_partial_fill(
        self,
        order: OrderTracker
    ) -> Tuple[str, float]:
        """
        处理部分成交
        
        Args:
            order: 订单追踪器
        
        Returns:
            (action, remaining_size)
        """
        if order.size == 0:
            return "CANCEL", 0
        
        fill_rate = order.filled / order.size
        remaining = order.size - order.filled
        
        # 成交率 >= 阈值 → 保留
        if fill_rate >= self.config.partial_fill_threshold:
            return "KEEP", remaining
        
        # 成交率 < 阈值 → 取消
        return "CANCEL", remaining
    
    # ============================================================
    # 5. 执行模拟（用于测试）
    # ============================================================
    def simulate_execution(
        self,
        plan: ExecutionPlan,
        orderbook: Dict = None,
        latency_ms: float = 200
    ) -> ExecutionResult:
        """
        模拟执行
        
        Args:
            plan: 执行计划
            orderbook: 订单簿
            latency_ms: 延迟
        
        Returns:
            ExecutionResult
        """
        self._execution_counter += 1
        execution_id = f"EXEC-{self._execution_counter:06d}"
        
        # 模拟成交
        if plan.mode == ExecutionMode.SKIP:
            return ExecutionResult(
                execution_id=execution_id,
                timestamp=datetime.now().isoformat(),
                symbol=plan.symbol,
                side=plan.side,
                mode=plan.mode,
                requested_size=plan.total_size,
                filled_size=0,
                avg_price=0,
                expected_price=0,
                slippage=0,
                slippage_bps=0,
                cost_saved=0,
                fill_rate=0,
                latency_ms=0,
                chunks_executed=0,
                status=ExecutionStatus.CANCELLED
            )
        
        # 模拟价格
        if orderbook:
            if plan.side == "BUY":
                expected_price = orderbook.get("asks", [[100, 0]])[0][0]
            else:
                expected_price = orderbook.get("bids", [[100, 0]])[0][0]
        else:
            expected_price = 50000  # 默认
        
        # 模拟滑点
        if plan.mode == ExecutionMode.FULL_MARKET:
            simulated_slippage_bps = 3.0
        elif plan.mode == ExecutionMode.SMART_LIMIT:
            simulated_slippage_bps = 1.0
        else:
            simulated_slippage_bps = 2.0
        
        # 计算实际价格
        if plan.side == "BUY":
            avg_price = expected_price * (1 + simulated_slippage_bps / 10000)
        else:
            avg_price = expected_price * (1 - simulated_slippage_bps / 10000)
        
        # 模拟成交率
        if plan.mode == ExecutionMode.FULL_MARKET:
            fill_rate = 1.0
        elif plan.mode == ExecutionMode.SMART_LIMIT:
            fill_rate = 0.92
        else:
            fill_rate = 0.95
        
        filled_size = plan.recommended_size * fill_rate
        slippage = simulated_slippage_bps / 10000
        
        # 计算节省
        market_slippage = 5.0  # bps
        cost_saved = (market_slippage - simulated_slippage_bps) / 10000 * filled_size * avg_price
        
        result = ExecutionResult(
            execution_id=execution_id,
            timestamp=datetime.now().isoformat(),
            symbol=plan.symbol,
            side=plan.side,
            mode=plan.mode,
            requested_size=plan.total_size,
            filled_size=filled_size,
            avg_price=avg_price,
            expected_price=expected_price,
            slippage=slippage,
            slippage_bps=simulated_slippage_bps,
            cost_saved=cost_saved,
            fill_rate=fill_rate,
            latency_ms=latency_ms,
            chunks_executed=plan.chunks,
            status=ExecutionStatus.FILLED if fill_rate >= 0.9 else ExecutionStatus.PARTIAL
        )
        
        # 更新统计
        self._update_stats(result)
        
        # 保存历史
        self.execution_history.append(result)
        
        return result
    
    def _calculate_recommended_size(
        self,
        order_size: float,
        liquidity_score: float,
        mode: ExecutionMode
    ) -> float:
        """计算建议下单量"""
        if mode == ExecutionMode.SKIP:
            return 0
        
        # 根据流动性调整
        if liquidity_score >= 0.85:
            return order_size
        elif liquidity_score >= 0.7:
            return order_size * 0.8
        else:
            return order_size * 0.5
    
    def _update_stats(self, result: ExecutionResult):
        """更新统计"""
        self.stats["total_executions"] += 1
        self.stats["total_filled"] += result.filled_size
        self.stats["total_slippage_bps"] += result.slippage_bps
        
        n = self.stats["total_executions"]
        self.stats["avg_fill_rate"] = (
            self.stats["avg_fill_rate"] * (n - 1) + result.fill_rate
        ) / n
        self.stats["avg_slippage_bps"] = (
            self.stats["avg_slippage_bps"] * (n - 1) + result.slippage_bps
        ) / n
    
    # ============================================================
    # 辅助方法
    # ============================================================
    def get_summary(self) -> Dict:
        """获取执行摘要"""
        return {
            "stats": self.stats,
            "recent_executions": [
                {
                    "id": r.execution_id,
                    "symbol": r.symbol,
                    "mode": r.mode.value,
                    "fill_rate": round(r.fill_rate, 2),
                    "slippage_bps": round(r.slippage_bps, 2)
                }
                for r in self.execution_history[-5:]
            ],
            "config": {
                "market_threshold": self.config.market_threshold,
                "limit_threshold": self.config.limit_threshold,
                "max_slippage_bps": self.config.max_slippage_bps
            }
        }
    
    def get_status(self) -> Dict:
        """获取引擎状态"""
        return {
            "total_executions": self.stats["total_executions"],
            "avg_fill_rate": round(self.stats["avg_fill_rate"], 2),
            "avg_slippage_bps": round(self.stats["avg_slippage_bps"], 2),
            "active_orders": len([
                o for o in self.order_trackers.values()
                if o.status == ExecutionStatus.PENDING or o.status == ExecutionStatus.EXECUTING
            ]),
            "config": {
                "market_threshold": self.config.market_threshold,
                "limit_threshold": self.config.limit_threshold,
                "twap_threshold": self.config.twap_threshold,
                "max_slippage_bps": self.config.max_slippage_bps,
                "twap_chunks": self.config.twap_chunks
            }
        }


# ============================================================
# 便捷函数
# ============================================================
def create_execution_optimizer() -> ExecutionOptimizer:
    """创建执行优化器"""
    return ExecutionOptimizer()


# ============================================================
# 测试
# ============================================================
if __name__ == "__main__":
    print("=== Execution Optimizer V13 测试 ===\n")
    
    optimizer = ExecutionOptimizer()
    
    # 测试模式选择
    print("1. 执行模式选择:")
    for score in [0.9, 0.75, 0.65, 0.5]:
        mode = optimizer.choose_mode(score, 1.0)
        print(f"   流动性 {score:.2f} → {mode.value}")
    
    # 创建执行计划
    print("\n2. 创建执行计划:")
    plan = optimizer.create_execution_plan(
        symbol="BTC/USDT",
        side="BUY",
        order_size=1.0,
        liquidity_score=0.75,
        liquidity_type="MEDIUM",
        orderbook={
            "bids": [(50000, 10), (49990, 15)],
            "asks": [(50010, 10), (50020, 15)]
        }
    )
    print(f"   模式: {plan.mode.value}")
    print(f"   建议大小: {plan.recommended_size:.2f} BTC")
    print(f"   原因: {plan.reason}")
    
    # TWAP 拆单
    print("\n3. TWAP 拆单计划:")
    twap = optimizer.create_twap_schedule(3.0, 3, 1.0)
    for chunk in twap:
        print(f"   第{chunk['chunk']}笔: {chunk['size']:.2f} BTC, 延迟 {chunk['delay']:.1f}s")
    
    # 智能限价
    print("\n4. 智能限价:")
    orderbook = {
        "bids": [(50000, 10)],
        "asks": [(50010, 10)]
    }
    limit_price, offset = optimizer._calculate_smart_limit(orderbook, "BUY")
    print(f"   买入限价: ${limit_price:.2f}")
    print(f"   偏移: {offset:.1f} bps")
    
    # 滑点检查
    print("\n5. 滑点检查:")
    is_ok, slippage_bps = optimizer.check_slippage(50000, 50003, "BUY")
    print(f"   预期: $50000, 实际: $50003")
    print(f"   滑点: {slippage_bps:.1f} bps")
    print(f"   状态: {'OK' if is_ok else 'OVER_LIMIT'}")
    
    # 模拟执行
    print("\n6. 模拟执行:")
    result = optimizer.simulate_execution(plan, orderbook)
    print(f"   执行ID: {result.execution_id}")
    print(f"   成交率: {result.fill_rate * 100:.0f}%")
    print(f"   滑点: {result.slippage_bps:.1f} bps")
    print(f"   节省: ${result.cost_saved:.2f}")
    
    # 统计
    print("\n7. 执行统计:")
    stats = optimizer.get_summary()
    print(f"   总执行: {stats['stats']['total_executions']} 次")
    print(f"   平均成交率: {stats['stats']['avg_fill_rate'] * 100:.0f}%")
    print(f"   平均滑点: {stats['stats']['avg_slippage_bps']:.1f} bps")
    
    print("\n✅ Execution Optimizer V13 测试通过")