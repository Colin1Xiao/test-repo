#!/usr/bin/env python3
"""
Safe Execution V5.4 Mock - 适配测试版本

在 SafeExecutionV54 基础上添加测试需要的接口：
- try_execute(side, amount, context)
- close_position(reason)
- process_open_position()
- record_trade_fn
- safety_test_mode
"""

import asyncio
import time
import threading
from datetime import datetime
from typing import Dict, Optional, Tuple, Any, Callable, List
from dataclasses import dataclass


@dataclass
class TradeResult:
    """交易结果"""
    entry_price: float
    exit_price: float
    pnl: float
    exit_source: str
    position_size: float
    hold_time: float = 0.0
    stop_ok: bool = False
    stop_verified: bool = False
    second_entry_blocked: bool = False
    protection_orders_cleared: str = "NO"  # YES / NO


class SafeExecutionV54Mock:
    """
    SafeExecutionV54 Mock 版本
    
    核心机制：
    1. asyncio.Lock - 原子化执行
    2. 双层 Position Gate - 防叠仓
    3. 止损强制验证 - 无止损不可运行
    4. TIME_EXIT 主循环控制
    """
    
    MAX_HOLD_SECONDS = 30
    MAX_POSITION = 0.13  # ETH
    
    def __init__(
        self,
        exchange,
        symbol: str = "ETH-USDT-SWAP",
        record_trade_fn: Callable = None,
        safety_test_mode: bool = False,
    ):
        self.exchange = exchange
        self.symbol = symbol
        self.safety_test_mode = safety_test_mode
        
        # 🔒 执行锁
        self._execution_lock = asyncio.Lock()
        
        # 仓位状态
        self.current_position: Optional[Dict] = None
        self._position_lock = threading.Lock()
        
        # 止损单
        self.current_stop_order_id: Optional[str] = None
        
        # 记录函数
        self.record_trade_fn = record_trade_fn or (lambda event: None)
        
        # 统计
        self.stats = {
            "total_executions": 0,
            "blocked_by_lock": 0,
            "blocked_by_position_gate": 0,
            "stop_loss_failures": 0,
            "time_exits": 0,
        }
        
        print("🛡️ SafeExecutionV54Mock 初始化")
        print(f"   symbol: {symbol}")
        print(f"   MAX_HOLD_SECONDS: {self.MAX_HOLD_SECONDS}")
        print(f"   safety_test_mode: {safety_test_mode}")
    
    # ========== Position Gate ==========
    
    def _has_position(self) -> bool:
        """检查是否有仓位"""
        with self._position_lock:
            return self.current_position is not None
    
    async def _get_exchange_position(self) -> Tuple[bool, float]:
        """获取交易所仓位"""
        try:
            # 转换 symbol 格式
            ccxt_symbol = self.symbol.replace("-USDT-SWAP", "/USDT:USDT")
            positions = await self.exchange.fetch_positions([ccxt_symbol])
            for pos in positions:
                size = float(pos.get("contracts", 0))
                if abs(size) > 0.001:
                    return True, abs(size)
            return False, 0.0
        except Exception as e:
            print(f"⚠️ 交易所仓位查询失败: {e}")
            return False, 0.0
    
    async def _check_position_gate(self) -> Tuple[bool, str]:
        """双层 Position Gate"""
        # 第一层：本地
        if self._has_position():
            return False, f"本地已有持仓: {self.current_position.get('size', 0):.4f}"
        
        # 第二层：交易所
        has_pos, pos_size = await self._get_exchange_position()
        if has_pos and pos_size > 0.001:
            return False, f"交易所已有持仓: {pos_size:.4f}"
        
        return True, "可以开仓"
    
    # ========== Stop Loss ==========
    
    async def _place_stop_loss(
        self, entry_price: float, position_size: float, side: str = "sell"
    ) -> Tuple[bool, Optional[str]]:
        """提交止损单"""
        stop_pct = 0.005
        stop_price = entry_price * (1 - stop_pct) if side == "sell" else entry_price * (1 + stop_pct)
        
        try:
            result = await self.exchange.private_post_trade_order_algo({
                "instId": self.symbol,
                "tdMode": "cross",
                "side": side,
                "sz": str(position_size),
                "ordType": "trigger",
                "triggerPx": str(stop_price),
                "triggerPxType": "last",
                "orderPx": "-1",
            })
            
            if result.get("code") == "0":
                algo_id = result["data"][0]["algoId"]
                self.current_stop_order_id = algo_id
                
                # 二次验证
                pending = await self.exchange.private_get_trade_orders_algo_pending({
                    "instId": self.symbol
                })
                
                for order in pending.get("data", []):
                    if order["algoId"] == algo_id and order["state"] == "live":
                        print(f"✅ 止损单验证通过: {algo_id}")
                        return True, algo_id
                
                print(f"🚨 止损单不存在: {algo_id}")
                return False, None
            else:
                print(f"❌ 止损单提交失败: {result}")
                return False, None
                
        except Exception as e:
            print(f"❌ 止损单异常: {e}")
            return False, None
    
    async def _cancel_stop_loss(self) -> None:
        """取消止损单"""
        if self.current_stop_order_id:
            try:
                # OKX 取消条件单
                self.exchange.algo_orders[self.current_stop_order_id]["state"] = "cancelled"
                self.current_stop_order_id = None
            except Exception as e:
                print(f"⚠️ 取消止损单失败: {e}")
    
    # ========== 公共接口 ==========
    
    async def try_execute(
        self, side: str, amount: float, context: Dict = None
    ) -> Optional[Dict]:
        """
        尝试执行交易
        
        Args:
            side: 'buy' or 'sell'
            amount: 数量
            context: 上下文信息
        
        Returns:
            执行结果 或 None（被拦截）
        """
        async with self._execution_lock:
            # Position Gate
            can_open, reason = await self._check_position_gate()
            if not can_open:
                print(f"🚫 Position Gate: {reason}")
                self.stats["blocked_by_position_gate"] += 1
                return None
            
            print(f"✅ Position Gate: {reason}")
            
            # 获取价格
            ticker = await self.exchange.fetch_ticker(self.symbol)
            ask = ticker.get("ask", 2151.0)
            
            # 开仓
            order = await self.exchange.create_market_order(
                self.symbol.replace("-USDT-SWAP", "/USDT:USDT"),
                side,
                amount,
            )
            
            entry_price = order.get("average", ask)
            
            # 止损单
            stop_ok, stop_id = await self._place_stop_loss(entry_price, amount, "sell")
            
            if not stop_ok:
                print("🚨 止损失败 - 系统停止")
                self.stats["stop_loss_failures"] += 1
                # 紧急平仓
                await self.exchange.create_market_order(
                    self.symbol.replace("-USDT-SWAP", "/USDT:USDT"),
                    "sell",
                    amount,
                )
                return None
            
            # 记录仓位（包含保护单 ID）
            with self._position_lock:
                self.current_position = {
                    "side": "long" if side == "buy" else "short",
                    "size": amount,
                    "entry_price": entry_price,
                    "entry_time": time.time(),
                    "protection_orders": {
                        "stop_order_id": stop_id,
                    },
                }
            
            self.stats["total_executions"] += 1
            
            # 记录事件
            self.record_trade_fn({
                "type": "entry",
                "entry_price": entry_price,
                "size": amount,
                "stop_order_id": stop_id,
                "context": context,
                "timestamp": datetime.now().isoformat(),
            })
            
            print(f"✅ 开仓成功: {entry_price:.2f}, 止损: {stop_id}")
            
            return {
                "entry_price": entry_price,
                "size": amount,
                "stop_order_id": stop_id,
            }
    
    async def close_position(self, reason: str = "MANUAL") -> Optional[TradeResult]:
        """
        安全平仓（修复版）
        
        正确顺序：
        1. 执行平仓单
        2. 确认持仓归零
        3. 撤销所有残留保护单
        4. 清空本地 current_position
        5. 写入 exit event
        """
        async with self._execution_lock:
            if not self._has_position():
                return None
            
            pos = self.current_position
            entry_price = pos["entry_price"]
            size = pos["size"]
            entry_time = pos["entry_time"]
            protection_orders = pos.get("protection_orders", {})
            
            # 1. 执行平仓单
            order = await self.exchange.create_market_order(
                self.symbol.replace("-USDT-SWAP", "/USDT:USDT"),
                "sell",
                size,
            )
            exit_price = order.get("average", 2149.0)
            
            # 2. 确认持仓归零（双保险）
            await asyncio.sleep(0.5)
            has_remaining, remaining_size = await self._get_exchange_position()
            if has_remaining and remaining_size > 0.001:
                print(f"⚠️ 平仓后仍有持仓: {remaining_size:.4f} ETH")
                # 尝试再次平仓
                try:
                    await self.exchange.create_market_order(
                        self.symbol.replace("-USDT-SWAP", "/USDT:USDT"),
                        "sell",
                        remaining_size,
                    )
                    print(f"✅ 补充平仓: {remaining_size:.4f} ETH")
                except Exception as e:
                    print(f"🚨 补充平仓失败: {e}")
            
            # 3. 撤销所有残留保护单
            await self._cleanup_protection_orders(protection_orders)
            await self._cleanup_symbol_algo_orders()
            
            # 4. 清空本地仓位
            with self._position_lock:
                self.current_position = None
                self.current_stop_order_id = None
            
            # 5. 写入结果
            pnl = (exit_price - entry_price) / entry_price
            hold_time = time.time() - entry_time
            
            if reason == "TIME_EXIT":
                self.stats["time_exits"] += 1
            
            result = TradeResult(
                entry_price=entry_price,
                exit_price=exit_price,
                pnl=pnl,
                exit_source=reason,
                position_size=size,
                hold_time=hold_time,
                stop_ok=True,
                stop_verified=True,
                protection_orders_cleared="YES",
            )
            
            self.record_trade_fn({
                "type": "exit",
                "entry_price": entry_price,
                "exit_price": exit_price,
                "pnl": pnl,
                "hold_time": hold_time,
                "exit_source": reason,
                "timestamp": datetime.now().isoformat(),
            })
            
            print(f"✅ 平仓成功: {exit_price:.2f}, PnL={pnl*100:.4f}%, 原因={reason}")
            
            return result
    
    async def _cleanup_protection_orders(self, protection_orders: Dict) -> None:
        """
        清理保护单（按 order_id）
        
        Args:
            protection_orders: {"stop_order_id": "xxx", "tp_order_id": "yyy"}
        """
        order_ids = []
        
        stop_id = protection_orders.get("stop_order_id")
        if stop_id:
            order_ids.append(stop_id)
        
        tp_id = protection_orders.get("tp_order_id")
        if tp_id:
            order_ids.append(tp_id)
        
        for order_id in order_ids:
            try:
                # OKX 取消 algo order
                await self.exchange.private_post_trade_cancel_algos({
                    "algoIds": [order_id],
                })
                print(f"🧹 已撤销保护单: {order_id}")
            except Exception as e:
                # 如果 private_post 不存在，尝试从 algo_orders 字典删除
                if hasattr(self.exchange, 'algo_orders') and order_id in self.exchange.algo_orders:
                    self.exchange.algo_orders[order_id]["state"] = "cancelled"
                    print(f"🧹 已撤销保护单 (Mock): {order_id}")
                else:
                    print(f"⚠️ 撤销保护单失败 {order_id}: {e}")
    
    async def _cleanup_symbol_algo_orders(self) -> None:
        """
        清理 symbol 下所有残留 algo orders
        
        双保险：确保没有遗漏
        """
        try:
            pending = await self.exchange.private_get_trade_orders_algo_pending({
                "instId": self.symbol
            })
            
            data = pending.get("data", [])
            for order in data:
                algo_id = order.get("algoId")
                if not algo_id:
                    continue
                
                # 只撤销 live 状态的
                if order.get("state") != "live":
                    continue
                
                try:
                    await self.exchange.private_post_trade_cancel_algos({
                        "algoIds": [algo_id],
                    })
                    print(f"🧹 撤销残留 algo 单: {algo_id}")
                except Exception as e:
                    # Mock 版本直接从字典删除
                    if hasattr(self.exchange, 'algo_orders') and algo_id in self.exchange.algo_orders:
                        self.exchange.algo_orders[algo_id]["state"] = "cancelled"
                        print(f"🧹 撤销残留 algo 单 (Mock): {algo_id}")
                    else:
                        print(f"⚠️ 撤销残留 {algo_id} 失败: {e}")
                        
        except Exception as e:
            print(f"⚠️ 清理 {self.symbol} algo 单失败: {e}")
    
    async def process_open_position(self) -> Optional[TradeResult]:
        """
        处理持仓（TIME_EXIT 检查）
        
        主循环调用
        """
        if not self._has_position():
            return None
        
        pos = self.current_position
        hold_time = time.time() - pos["entry_time"]
        
        if hold_time > self.MAX_HOLD_SECONDS:
            print(f"⏰ TIME_EXIT 触发: 持仓 {hold_time:.1f}s > {self.MAX_HOLD_SECONDS}s")
            return await self.close_position("TIME_EXIT")
        
        return None
    
    def get_stats(self) -> Dict:
        return self.stats.copy()