#!/usr/bin/env python3
"""
Stop Loss Manager V5.4 - 订单级止损管理

核心原则：
1. 止损单必须提交到交易所（交易所托管）
2. 必须二次验证止损单真正存在
3. 无止损 = 系统停止（硬失败）

这是 V5.4 防爆仓的最后一道防线。
"""

from __future__ import annotations
import logging
import time
from typing import Any, Dict, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class StopLossResult:
    """止损结果"""
    stop_ok: bool              # 止损单提交成功
    stop_verified: bool        # 二次验证通过
    stop_order_id: str         # 止损单 ID
    stop_price: float          # 止损触发价
    reason: str                # 失败原因（如失败）
    
    def __post_init__(self):
        if not self.stop_ok and not self.reason:
            self.reason = "UNKNOWN_ERROR"


class StopLossManagerV54:
    """
    V5.4 订单级止损管理器
    
    核心流程：
    1. 基于真实成交价计算止损价
    2. 提交止损单到交易所 (reduceOnly=True)
    3. 二次验证止损单存在
    4. 无止损 = 硬失败
    
    OKX 止损订单参数：
    - type: "conditional"
    - slTriggerPx: 止损触发价
    - slOrdPx: "-1" (市价止损)
    - reduceOnly: True (防止反向开仓)
    - tdMode: "cross" (全仓)
    """
    
    def __init__(
        self,
        *,
        exchange: Any,
        stop_loss_pct: float = 0.005,  # 0.5%
    ) -> None:
        """
        初始化止损管理器
        
        Args:
            exchange: OKX API 客户端 (支持 create_order/fetch_open_orders)
            stop_loss_pct: 止损百分比 (默认 0.5%)
        """
        self.exchange = exchange
        self.stop_loss_pct = stop_loss_pct
    
    async def place_stop_loss(
        self,
        symbol: str,
        entry_price: float,
        position_size: float,
        side: str,
    ) -> StopLossResult:
        """
        提交止损单到交易所
        
        Args:
            symbol: 交易对 (e.g. "ETH/USDT:USDT")
            entry_price: 真实成交价 (用于计算止损价)
            position_size: 持仓数量
            side: 方向 ("buy" 做多 / "sell" 做空)
        
        Returns:
            StopLossResult (stop_ok=True 且 stop_verified=True 才合格)
        
        Raises:
            RuntimeError: 止损提交失败 (硬失败，系统停止)
        """
        started_at = time.time()
        
        # ========== Step 1: 计算止损价格 ==========
        if side == "buy":
            # 做多：止损价 = 入场价 × (1 - stop_loss_pct)
            stop_price = entry_price * (1 - self.stop_loss_pct)
            stop_side = "sell"
        else:
            # 做空：止损价 = 入场价 × (1 + stop_loss_pct)
            stop_price = entry_price * (1 + self.stop_loss_pct)
            stop_side = "buy"
        
        logger.info(f"[StopLoss] {symbol} 止损计算：entry={entry_price:.2f}, stop={stop_price:.2f} ({self.stop_loss_pct*100}%)")
        
        # ========== Step 2: 提交止损单到交易所 ==========
        stop_order_id = ""
        try:
            # OKX 止损单参数（必须完整）
            order_params = {
                "symbol": symbol,
                "type": "conditional",
                "side": stop_side,
                "size": str(position_size),
                "tdMode": "cross",              # 全仓模式 (必须)
                "reduceOnly": True,             # 防止反向开仓 (必须)
                "slTriggerPx": str(stop_price), # 止损触发价
                "slOrdPx": "-1",                # -1 = 市价止损
            }
            
            logger.info(f"[StopLoss] 提交止损单：{order_params}")
            
            # 调用 OKX API 提交止损单
            order = await self.exchange.create_order(
                symbol=symbol,
                type="conditional",
                side=stop_side,
                amount=position_size,
                params=order_params,
            )
            
            # 验证订单结果
            if order is None:
                elapsed_ms = int((time.time() - started_at) * 1000)
                logger.error(f"[StopLoss] 止损单提交返回 None")
                return StopLossResult(
                    stop_ok=False,
                    stop_verified=False,
                    stop_order_id="",
                    stop_price=stop_price,
                    reason="STOP_LOSS_RETURNED_NONE",
                )
            
            # 提取订单 ID
            stop_order_id = order.get("id", "")
            if not stop_order_id:
                # OKX 可能返回 info 字段
                info = order.get("info", {})
                stop_order_id = info.get("ordId", "")
            
            if not stop_order_id:
                elapsed_ms = int((time.time() - started_at) * 1000)
                logger.error(f"[StopLoss] 止损单无订单 ID: {order}")
                return StopLossResult(
                    stop_ok=False,
                    stop_verified=False,
                    stop_order_id="",
                    stop_price=stop_price,
                    reason="STOP_LOSS_NO_ORDER_ID",
                )
            
            elapsed_ms = int((time.time() - started_at) * 1000)
            logger.info(f"[StopLoss] 止损单提交成功：id={stop_order_id}, elapsed={elapsed_ms}ms")
            
        except Exception as e:
            elapsed_ms = int((time.time() - started_at) * 1000)
            error_msg = str(e)
            logger.error(f"[StopLoss] 止损单提交失败：{error_msg}")
            
            # 🔴 硬失败：无止损 = 系统停止
            raise RuntimeError(f"STOP_LOSS_FAILED - SYSTEM_STOP: {error_msg}")
        
        # ========== Step 3: 二次验证止损单存在 ==========
        stop_verified = await self._verify_stop_loss_exists(symbol, stop_order_id, stop_price)
        
        if not stop_verified:
            logger.error(f"[StopLoss] 二次验证失败：止损单不存在")
            # ⚠️ 注意：这里不抛异常，但返回 stop_verified=False
            # 上层应该检查 stop_verified 并决定是否继续
        else:
            logger.info(f"[StopLoss] 二次验证通过：止损单存在")
        
        elapsed_ms = int((time.time() - started_at) * 1000)
        logger.info(f"[StopLoss] 完成：stop_ok=True, stop_verified={stop_verified}, elapsed={elapsed_ms}ms")
        
        return StopLossResult(
            stop_ok=True,
            stop_verified=stop_verified,
            stop_order_id=stop_order_id,
            stop_price=stop_price,
            reason="",
        )
    
    async def _verify_stop_loss_exists(
        self,
        symbol: str,
        expected_order_id: str,
        expected_stop_price: float,
    ) -> bool:
        """
        二次验证：确认止损单真正存在于交易所
        
        Args:
            symbol: 交易对
            expected_order_id: 预期订单 ID
            expected_stop_price: 预期止损价
        
        Returns:
            True = 止损单存在，False = 未找到
        """
        try:
            # 获取所有未完成订单（包括条件单）
            open_orders = await self.exchange.fetch_open_orders(symbol)
            
            if not open_orders:
                logger.warning(f"[StopLoss] 验证失败：无未完成订单")
                return False
            
            # 查找止损单
            for order in open_orders:
                order_id = order.get("id", "")
                order_type = order.get("type", "")
                order_price = order.get("price", 0) or order.get("stopPrice", 0)
                
                # 匹配订单 ID
                if order_id == expected_order_id:
                    logger.info(f"[StopLoss] 验证通过：找到订单 {order_id}")
                    return True
                
                # 或者匹配止损价（fallback）
                if order_type == "conditional" and abs(order_price - expected_stop_price) < 0.01:
                    logger.info(f"[StopLoss] 验证通过：匹配止损价 {expected_stop_price:.2f}")
                    return True
            
            logger.warning(f"[StopLoss] 验证失败：未找到订单 {expected_order_id}")
            return False
            
        except Exception as e:
            logger.error(f"[StopLoss] 验证异常：{e}")
            return False
    
    async def cancel_stop_loss(
        self,
        symbol: str,
        stop_order_id: str,
    ) -> bool:
        """
        取消止损单
        
        Args:
            symbol: 交易对
            stop_order_id: 止损单 ID
        
        Returns:
            True = 取消成功，False = 失败
        """
        try:
            logger.info(f"[StopLoss] 取消止损单：{symbol} {stop_order_id}")
            
            # OKX 取消条件单
            result = await self.exchange.cancel_order(stop_order_id, symbol)
            
            logger.info(f"[StopLoss] 取消成功：{stop_order_id}")
            return True
            
        except Exception as e:
            logger.error(f"[StopLoss] 取消失败：{e}")
            return False


def build_stop_loss_manager_v54(
    exchange: Any,
    stop_loss_pct: float = 0.005,
) -> StopLossManagerV54:
    """
    构建 StopLossManagerV54 实例
    
    Args:
        exchange: OKX API 客户端
        stop_loss_pct: 止损百分比 (默认 0.5%)
    
    Returns:
        StopLossManagerV54 实例
    """
    return StopLossManagerV54(
        exchange=exchange,
        stop_loss_pct=stop_loss_pct,
    )
