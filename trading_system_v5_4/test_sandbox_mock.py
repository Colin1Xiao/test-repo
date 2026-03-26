#!/usr/bin/env python3
"""
V5.4 Sandbox Safety Test - 交易所语义级 Mock 版

模拟完整的 OKX 交易所语义：
- 下单成功并返回 order_id / avgPx / fillSz
- 创建 conditional 止损并返回止损单 ID
- fetch_open_orders 能查到 slTriggerPx
- 平仓后自动清理持仓与止损
- 退出来源写入 exit_source / trigger_module

运行方式：
python test_sandbox_mock.py
"""

import sys
import os
import asyncio
import time
import uuid
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

# 添加路径
sys.path.insert(0, str(Path(__file__).parent.parent / "trading_system_v5_3"))
sys.path.insert(0, str(Path(__file__).parent / "core"))


# ============ 交易所语义级 Mock ============
class SemanticMockExchange:
    """
    交易所语义级 Mock
    
    模拟真实的 OKX 交易所行为：
    - 订单簿有深度
    - 下单成功返回 order_id
    - 止损单可查询
    - 持仓状态正确
    """
    
    def __init__(self):
        # 订单簿（模拟真实深度）
        self.orderbook = {
            "ETH/USDT:USDT": {
                "bids": [[2120.0, 10.0], [2119.5, 20.0], [2119.0, 30.0]],
                "asks": [[2120.5, 10.0], [2121.0, 20.0], [2121.5, 30.0]],
            }
        }
        
        # 订单存储
        self.orders: Dict[str, Dict[str, Any]] = {}
        self.stop_orders: Dict[str, Dict[str, Any]] = {}
        
        # 持仓
        self.positions: Dict[str, Dict[str, Any]] = {}
        
        # 账户余额
        self.balance = {
            "usdt_free": 1000.0,
            "usdt_used": 0.0,
            "usdt_total": 1000.0,
        }
        
        # 订单计数器
        self.order_counter = 0
        self.stop_order_counter = 0
        
        print("🎭 交易所语义级 Mock 已初始化")
        print(f"   订单簿深度：买{len(self.orderbook['ETH/USDT:USDT']['bids'])}档 / 卖{len(self.orderbook['ETH/USDT:USDT']['asks'])}档")
    
    def fetch_order_book(self, symbol: str) -> Dict[str, Any]:
        """获取订单簿"""
        if symbol not in self.orderbook:
            return {"bids": [], "asks": []}
        
        return {
            "bids": self.orderbook[symbol]["bids"],
            "asks": self.orderbook[symbol]["asks"],
            "timestamp": int(time.time() * 1000),
        }
    
    async def create_order(self, symbol: str, type: str, side: str, amount: float, 
                          params: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        创建订单（模拟真实 OKX 返回）
        
        Returns:
            OKX 格式的订单响应
        """
        self.order_counter += 1
        order_id = f"mock-order-{self.order_counter}"
        ts = int(time.time() * 1000)
        
        # 获取当前价格
        ob = self.fetch_order_book(symbol)
        price = ob["asks"][0][0] if side == "buy" else ob["bids"][0][0]
        
        if type == "market":
            # 市价单 - 立即成交
            order = {
                "id": order_id,
                "symbol": symbol,
                "type": "market",
                "side": side,
                "amount": amount,
                "filled": amount,
                "average": price,
                "status": "closed",
                "timestamp": ts,
                "info": {
                    "ordId": order_id,
                    "sCode": "0",
                    "sMsg": "",
                    "clOrdId": "",
                    "tag": "",
                    "ts": str(ts),
                }
            }
            
            # 记录持仓
            notional = amount * price
            margin = notional / params.get("lever", 100)
            
            self.positions[symbol] = {
                "symbol": symbol,
                "side": side,
                "size": amount,
                "entry_price": price,
                "margin": margin,
                "leverage": params.get("lever", 100),
                "timestamp": ts,
            }
            
            # 更新余额
            self.balance["usdt_used"] += margin
            self.balance["usdt_free"] -= margin
            
            print(f"✅ 订单成交：{symbol} {side} {amount} @ {price:.2f}")
            print(f"   order_id: {order_id}")
            print(f"   保证金：{margin:.2f} USDT")
            
        elif type == "conditional":
            # 条件单（止损）
            self.stop_order_counter += 1
            stop_id = f"mock-stop-{self.stop_order_counter}"
            
            stop_order = {
                "id": stop_id,
                "symbol": symbol,
                "type": "conditional",
                "side": side,
                "amount": amount,
                "params": {
                    "slTriggerPx": params.get("slTriggerPx", 0),
                    "reduceOnly": params.get("reduceOnly", False),
                    "tdMode": params.get("tdMode", "cross"),
                },
                "status": "live",
                "timestamp": ts,
                "info": {
                    "ordId": stop_id,
                    "sCode": "0",
                    "sMsg": "",
                    "clOrdId": "",
                    "tag": "",
                    "ts": str(ts),
                }
            }
            
            self.stop_orders[stop_id] = stop_order
            
            print(f"✅ 止损单已创建：{symbol} {side}")
            print(f"   stop_id: {stop_id}")
            print(f"   slTriggerPx: {params.get('slTriggerPx', 0):.2f}")
            
            return stop_order
        
        self.orders[order_id] = order
        return order
    
    async def fetch_open_orders(self, symbol: str = None) -> List[Dict[str, Any]]:
        """获取未平仓订单（含止损单）"""
        all_orders = []
        
        # 普通订单
        for order in self.orders.values():
            if order["status"] == "open":
                if symbol is None or order["symbol"] == symbol:
                    all_orders.append(order)
        
        # 止损单
        for stop_order in self.stop_orders.values():
            if stop_order["status"] == "live":
                if symbol is None or stop_order["symbol"] == symbol:
                    all_orders.append(stop_order)
        
        print(f"📋 未平仓订单：{len(all_orders)}")
        return all_orders
    
    async def close_position(self, symbol: str) -> Dict[str, Any]:
        """平仓"""
        if symbol not in self.positions:
            return {"error": "No position"}
        
        position = self.positions[symbol]
        ob = self.fetch_order_book(symbol)
        
        # 平仓价格（反向）
        exit_price = ob["bids"][0][0] if position["side"] == "buy" else ob["asks"][0][0]
        
        # 计算盈亏
        if position["side"] == "buy":
            pnl = (exit_price - position["entry_price"]) / position["entry_price"]
        else:
            pnl = (position["entry_price"] - exit_price) / position["entry_price"]
        
        pnl_usdt = pnl * position["margin"] * position["leverage"]
        
        # 清理持仓
        margin = position["margin"]
        del self.positions[symbol]
        
        # 更新余额
        self.balance["usdt_used"] -= margin
        self.balance["usdt_free"] += margin + pnl_usdt
        
        # 清理止损单
        stops_to_remove = [
            sid for sid, order in self.stop_orders.items()
            if order["symbol"] == symbol
        ]
        for sid in stops_to_remove:
            del self.stop_orders[sid]
        
        print(f"✅ 持仓已平：{symbol}")
        print(f"   平仓价：{exit_price:.2f}")
        print(f"   盈亏：{pnl*100:.4f}% ({pnl_usdt:.4f} USDT)")
        
        return {
            "symbol": symbol,
            "exit_price": exit_price,
            "pnl": pnl,
            "pnl_usdt": pnl_usdt,
        }
    
    def has_open_position(self, symbol: str) -> bool:
        """检查是否有持仓"""
        return symbol in self.positions
    
    def get_position(self, symbol: str) -> Optional[Dict[str, Any]]:
        """获取持仓"""
        return self.positions.get(symbol)


class MockLiveExecutor:
    """
    Mock LiveExecutor - 交易所语义级
    
    完全模拟真实 LiveExecutor 的行为
    """
    
    def __init__(self):
        self.exchange = SemanticMockExchange()
        self.open_positions: Dict[str, Dict[str, Any]] = {}
    
    def has_open_position(self, symbol: str) -> bool:
        """检查是否有持仓"""
        return self.exchange.has_open_position(symbol)
    
    async def get_best_price(self, symbol: str) -> tuple:
        """获取最佳价格"""
        ob = self.exchange.fetch_order_book(symbol)
        bid = ob["bids"][0][0] if ob["bids"] else 0
        ask = ob["asks"][0][0] if ob["asks"] else 0
        mid = (bid + ask) / 2 if bid and ask else 0
        return bid, ask, mid
    
    async def execute_signal(self, symbol: str, signal_price: float,
                           margin_usd: float, signal_time=None) -> Optional[Dict[str, Any]]:
        """
        执行交易信号（完整模拟真实流程）
        
        Returns:
            交易记录字典，失败返回 None
        """
        try:
            # 1. 获取价格
            bid, ask, mid = await self.get_best_price(symbol)
            
            if mid <= 0:
                print(f"❌ {symbol} 无法获取价格")
                return None
            
            # 2. 计算下单量
            leverage = 100
            notional = margin_usd * leverage
            amount = notional / ask
            
            # 3. 下市价单
            order = await self.exchange.create_order(
                symbol=symbol,
                type="market",
                side="buy",
                amount=amount,
                params={"lever": leverage, "tdMode": "cross"},
            )
            
            if order.get("info", {}).get("sCode") != "0":
                print(f"❌ 下单失败：{order.get('info', {})}")
                return None
            
            # 4. 创建止损单（关键！）
            entry_price = order["average"]
            stop_price = entry_price * 0.995  # -0.5%
            
            stop_order = await self.exchange.create_order(
                symbol=symbol,
                type="conditional",
                side="sell",
                amount=amount,
                params={
                    "slTriggerPx": stop_price,
                    "reduceOnly": True,
                    "tdMode": "cross",
                },
            )
            
            # 5. 验证止损单
            open_orders = await self.exchange.fetch_open_orders(symbol)
            stop_orders = [o for o in open_orders if o.get("type") == "conditional"]
            
            stop_verified = len(stop_orders) > 0
            
            # 6. 返回结果
            return {
                "ok": True,
                "symbol": symbol,
                "execution_price": entry_price,
                "filled_size": amount,
                "order_id": order["id"],
                "stop_ok": True,
                "stop_verified": stop_verified,
                "stop_order_id": stop_order.get("id") if stop_verified else None,
                "stop_trigger_price": stop_price,
            }
            
        except Exception as e:
            print(f"❌ 执行失败：{e}")
            import traceback
            traceback.print_exc()
            return None
    
    async def close_position(self, symbol: str, exit_reason: str = "MANUAL") -> Optional[float]:
        """平仓"""
        result = await self.exchange.close_position(symbol)
        return result.get("pnl", 0) if result else None
    
    async def fetch_open_orders(self, symbol: str) -> List[Dict[str, Any]]:
        """获取未平仓订单"""
        return await self.exchange.fetch_open_orders(symbol)


# ============ V5.4 集成测试 ============
async def test_phase_a_single_entry():
    """
    Phase A: 单笔开仓 + 止损验证
    """
    print("\n" + "=" * 60)
    print("🧪 Phase A: 单笔开仓 + 止损验证")
    print("=" * 60)
    
    from core.safe_execution_assembly import signal_to_execution_context
    from core.position_gate_v54 import build_position_gate_v54
    from core.safe_execution_v54 import build_safe_execution_v54, ExecutionContext
    from core.state_store_v54 import TradeStateStore
    
    # 初始化组件
    state_store = TradeStateStore(data_dir="/tmp/v54_test")
    live_executor = MockLiveExecutor()
    
    position_gate = build_position_gate_v54(
        state_store=state_store,
        live_executor=live_executor,
    )
    
    safe_exec = build_safe_execution_v54(
        live_executor=live_executor,
        state_store=state_store,
        position_gate=position_gate,
        lock_timeout=2.0,
    )
    
    # 创建 ExecutionContext
    ctx = ExecutionContext(
        symbol="ETH/USDT:USDT",
        side="buy",
        requested_size=0.13,
        request_id="test-a-1",
        strategy="mock_test",
        signal_price=2120.0,
        margin_usd=3.0,
    )
    
    # 执行
    result = await safe_exec.execute_entry(ctx)
    
    print(f"\n📊 执行结果:")
    print(f"   accepted: {result.accepted}")
    print(f"   reason: {result.reason}")
    
    if not result.accepted:
        print(f"\n❌ Phase A 失败：{result.reason}")
        return False
    
    # 验收检查
    order = result.order_result or {}
    
    checks = {
        "执行成功": result.accepted,
        "order_id 存在": bool(order.get("order_id")),
        "execution_price > 0": order.get("execution_price", 0) > 0,
        "filled_size > 0": order.get("filled_size", 0) > 0,
        "stop_ok": order.get("stop_ok", False),
        "stop_verified": order.get("stop_verified", False),
        "stop_order_id 存在": bool(order.get("stop_order_id")),
    }
    
    print(f"\n📋 验收检查:")
    for name, passed in checks.items():
        status = "✅" if passed else "❌"
        print(f"   {status} {name}: {passed}")
    
    # 验证止损单
    open_orders = await live_executor.fetch_open_orders("ETH/USDT:USDT")
    stop_orders = [o for o in open_orders if o.get("type") == "conditional"]
    
    print(f"\n📋 止损单验证:")
    print(f"   未平仓订单：{len(open_orders)}")
    print(f"   止损单：{len(stop_orders)}")
    
    if stop_orders:
        stop = stop_orders[0]
        print(f"   stop_id: {stop['id']}")
        print(f"   slTriggerPx: {stop['params'].get('slTriggerPx', 0):.2f}")
        print(f"   reduceOnly: {stop['params'].get('reduceOnly', False)}")
    
    checks["止损单存在"] = len(stop_orders) > 0
    checks["slTriggerPx 正确"] = stop_orders[0]["params"].get("slTriggerPx", 0) > 0 if stop_orders else False
    
    all_passed = all(checks.values())
    
    if all_passed:
        print("\n✅ Phase A: 通过")
    else:
        print("\n❌ Phase A: 失败")
    
    return all_passed


async def test_phase_b_duplicate():
    """
    Phase B: 重复信号保护
    """
    print("\n" + "=" * 60)
    print("🧪 Phase B: 重复信号保护")
    print("=" * 60)
    
    from core.safe_execution_assembly import signal_to_execution_context
    from core.position_gate_v54 import build_position_gate_v54
    from core.safe_execution_v54 import build_safe_execution_v54, ExecutionContext
    from core.state_store_v54 import TradeStateStore
    import asyncio
    
    # 初始化组件
    state_store = TradeStateStore(data_dir="/tmp/v54_test_b")
    live_executor = MockLiveExecutor()
    
    position_gate = build_position_gate_v54(
        state_store=state_store,
        live_executor=live_executor,
    )
    
    safe_exec = build_safe_execution_v54(
        live_executor=live_executor,
        state_store=state_store,
        position_gate=position_gate,
        lock_timeout=2.0,
    )
    
    # 创建两个相同信号
    ctx1 = ExecutionContext(
        symbol="ETH/USDT:USDT",
        side="buy",
        requested_size=0.13,
        request_id="test-b-1",
        strategy="mock_test",
        signal_price=2120.0,
        margin_usd=3.0,
    )
    
    ctx2 = ExecutionContext(
        symbol="ETH/USDT:USDT",
        side="buy",
        requested_size=0.13,
        request_id="test-b-2",
        strategy="mock_test",
        signal_price=2120.0,
        margin_usd=3.0,
    )
    
    async def attempt(ctx):
        result = await safe_exec.execute_entry(ctx)
        return result
    
    # 并发执行
    results = await asyncio.gather(attempt(ctx1), attempt(ctx2))
    
    success_count = sum(1 for r in results if r.accepted)
    blocked_count = sum(1 for r in results if not r.accepted)
    
    print(f"\n📊 执行结果:")
    print(f"   成功：{success_count}")
    print(f"   被挡：{blocked_count}")
    
    checks = {
        "只成功 1 笔": success_count == 1,
        "挡住 1 笔": blocked_count == 1,
        "不叠仓": success_count <= 1,
    }
    
    all_passed = all(checks.values())
    
    print(f"\n📊 Phase B 验收:")
    for name, passed in checks.items():
        status = "✅" if passed else "❌"
        print(f"   {status} {name}: {passed}")
    
    if all_passed:
        print("\n✅ Phase B: 通过")
    else:
        print("\n❌ Phase B: 失败")
    
    return all_passed


async def test_phase_c_exit_source():
    """
    Phase C: Exit Source 记录
    """
    print("\n" + "=" * 60)
    print("🧪 Phase C: Exit Source 记录")
    print("=" * 60)
    
    from core.state_store_v54 import TradeStateStore
    
    state_store = TradeStateStore(data_dir="/tmp/v54_test_c")
    
    # 模拟记录退出
    exit_data = {
        "entry_price": 2120.0,
        "exit_price": 2125.0,
        "pnl": 0.00236,
        "exit_source": "TIME_EXIT",
        "position_size": 0.13,
        "stop_ok": True,
        "stop_verified": True,
        "trigger_module": "position_manager",
        "data": {  # StateStore 会把详细数据放在 data 字段
            "trigger_module": "position_manager",
        }
    }
    
    state_store.record_event("exit", exit_data)
    
    # 读取验证
    last_trade = state_store.get_last_trade()
    
    print(f"\n📋 最后交易记录:")
    if last_trade:
        for key, value in last_trade.items():
            print(f"   {key}: {value}")
    else:
        print("   ❌ 无交易记录")
    
    checks = {
        "exit_source 正确": last_trade.get("exit_source") == "TIME_EXIT" if last_trade else False,
        "position_size 正确": last_trade.get("position_size") == 0.13 if last_trade else False,
        "stop_verified 正确": last_trade.get("stop_verified") == True if last_trade else False,
    }
    
    all_passed = all(checks.values())
    
    print(f"\n📊 Phase C 验收:")
    for name, passed in checks.items():
        status = "✅" if passed else "❌"
        print(f"   {status} {name}: {passed}")
    
    if all_passed:
        print("\n✅ Phase C: 通过")
    else:
        print("\n❌ Phase C: 失败")
    
    return all_passed


# ============ Main ============
async def main():
    """运行所有测试"""
    print("=" * 60)
    print("🧪 V5.4 Sandbox Safety Test - 交易所语义级 Mock")
    print("=" * 60)
    
    results = {
        "Phase A (单笔开仓 + 止损)": await test_phase_a_single_entry(),
        "Phase B (重复保护)": await test_phase_b_duplicate(),
        "Phase C (Exit Source)": await test_phase_c_exit_source(),
    }
    
    print("\n" + "=" * 60)
    print("📊 测试汇总")
    print("=" * 60)
    
    for name, passed in results.items():
        status = "✅" if passed else "❌"
        print(f"   {status} {name}: {'通过' if passed else '失败'}")
    
    all_passed = all(results.values())
    
    print("\n" + "=" * 60)
    if all_passed:
        print("🎉 所有测试通过！")
        print("\n✅ V5.4 安全链验证完成:")
        print("   1. Execution Lock ✅")
        print("   2. Position Gate ✅")
        print("   3. Entry Execution ✅")
        print("   4. Stop Loss Verified ✅")
        print("   5. Exit Source Record ✅")
        print("\n🔜 V5.4 已准备好进入生产验证")
    else:
        print("❌ 部分测试失败，请检查")
    print("=" * 60)
    
    return all_passed


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
