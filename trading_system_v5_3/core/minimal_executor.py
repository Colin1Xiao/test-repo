#!/usr/bin/env python3
"""
Minimal Executor - 最小正确执行链

核心原则：
- 不等待 fill
- 不依赖 orderbook
- 不返回 None（除非真的失败）
- 新执行链是唯一真相源
"""

import time
from typing import Dict, Any, Optional


def execute_signal(exchange, symbol: str, side: str, amount: float) -> Optional[Dict]:
    """
    最小正确执行链：
    - 不等待 fill
    - 只要下单成功就返回 trade
    """
    try:
        # 1️⃣ 获取价格（降级安全）
        try:
            ticker = exchange.fetch_ticker(symbol)
            price = ticker["last"]
            print(f"📊 获取价格: {price}")
        except Exception as e:
            print(f"⚠️ ticker失败: {e}，使用默认价格")
            price = None
        
        # 2️⃣ 下单（核心）
        print(f"🚀 下单: {symbol} {side} {amount}")
        order = exchange.create_order(
            symbol=symbol,
            type="market",
            side=side,
            amount=amount
        )
        
        # 3️⃣ 立即构建 trade（🔥关键）
        trade = {
            "order_id": order.get("id"),
            "symbol": symbol,
            "side": side,
            "amount": amount,
            "entry_price": order.get("average") or price,
            "timestamp": time.time(),
            "status": "submitted"
        }
        print(f"✅ ORDER SUBMITTED: {trade}")
        return trade
        
    except Exception as e:
        print(f"❌ EXECUTION FAILED: {e}")
        return None


def get_real_fill_price(exchange, symbol: str, order_id: str) -> Optional[float]:
    """
    获取真实成交均价 - 使用 fetch_my_trades
    
    OKX 机制：
    - fetch_order → 订单状态（不含成交均价）
    - fetch_my_trades → 成交记录（真实价格）
    
    一个订单可能多次成交（partial fills），需要加权平均
    """
    try:
        print(f"🔍 查询成交记录: {order_id}")
        trades = exchange.fetch_my_trades(symbol)
        
        # 找到对应订单的所有成交
        fills = [
            t for t in trades
            if t.get("order") == order_id or t.get("orderId") == order_id or str(t.get("order")) == str(order_id)
        ]
        
        print(f"📊 找到 {len(fills)} 条成交记录")
        
        if not fills:
            return None
        
        # 加权平均
        total_cost = sum(t["price"] * t["amount"] for t in fills)
        total_amount = sum(t["amount"] for t in fills)
        
        if total_amount == 0:
            return None
        
        avg_price = total_cost / total_amount
        print(f"📊 成交均价: {avg_price} (总成本={total_cost}, 总数量={total_amount})")
        
        return avg_price
        
    except Exception as e:
        print(f"⚠️ fetch_my_trades 失败: {e}")
        return None


def close_trade(exchange, trade: Dict) -> bool:
    """
    最小退出逻辑 - 真实成交价版本 V2
    
    关键改进：
    - 使用 fetch_my_trades 获取真实成交价
    - 不再依赖 ticker 作为主要来源
    """
    try:
        side = "sell" if trade["side"] == "buy" else "buy"
        print(f"🔁 平仓: {trade['symbol']} {side} {trade['amount']}")
        
        # 下单
        order = exchange.create_order(
            symbol=trade["symbol"],
            type="market",
            side=side,
            amount=trade["amount"]
        )
        
        order_id = order.get("id")
        print(f"📋 平仓订单ID: {order_id}")
        
        # 🔥 关键：使用 fetch_my_trades 获取真实成交价
        exit_price = None
        
        # 方法1：fetch_my_trades（正确做法）
        if order_id:
            exit_price = get_real_fill_price(exchange, trade["symbol"], order_id)
        
        # 方法2：从订单返回中获取（备选）
        if not exit_price:
            exit_price = (
                order.get("average") or 
                order.get("price") or 
                order.get("info", {}).get("avgPx") or
                order.get("info", {}).get("fillPx")
            )
        
        # 方法3：最后降级到 ticker
        if not exit_price:
            try:
                ticker = exchange.fetch_ticker(trade["symbol"])
                exit_price = ticker.get("last")
                print(f"⚠️ 降级使用 ticker 价格: {exit_price}")
            except:
                print(f"❌ 无法获取退出价格")
                return False
        
        trade["exit_price"] = exit_price
        trade["pnl"] = calculate_pnl(trade)
        trade["exit_source"] = "trades" if exit_price else "ticker"
        print(f"🔁 CLOSED: entry={trade['entry_price']} exit={exit_price} pnl={trade['pnl']:.4f}% (source={trade.get('exit_source', 'unknown')})")
        return True
        
    except Exception as e:
        print(f"❌ CLOSE FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


def calculate_pnl(trade: Dict) -> float:
    """
    PnL 计算（必须真实）
    """
    entry = trade.get("entry_price")
    exit_ = trade.get("exit_price")
    
    if not entry or not exit_:
        return 0.0
    
    if trade["side"] == "buy":
        return (exit_ - entry) / entry * 100
    else:
        return (entry - exit_) / entry * 100


def record_trade(trade: Dict, trade_log: list) -> bool:
    """
    Trade Recorder（防假数据）
    """
    if trade is None:
        print("❌ 无效 trade，不记录")
        return False
    
    if not trade.get("entry_price"):
        print("❌ 没有价格，不记录")
        return False
    
    trade_log.append(trade)
    print(f"📊 TRADE RECORDED: entry={trade['entry_price']}")
    return True