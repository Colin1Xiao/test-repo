"""
V5.4 执行核心 - 最小可执行骨架
严格按工程顺序: Execution → Position State → Risk Binding
"""
import time
import ccxt
from typing import Optional, Dict, Any


# ============================================================
# 🔒 Position State (必须最先实现)
# ============================================================

def get_position_size(exchange: ccxt.Exchange, symbol: str) -> float:
    """
    获取当前持仓大小 (兼容 OKX 返回格式)

    OKX 返回字段:
    - contracts (标准)
    - pos (OKX 专用)
    - positionAmt (某些交易所)

    返回绝对值，避免方向混淆
    """
    positions = exchange.fetch_positions([symbol])

    total = 0.0
    for p in positions:
        # 检查是否为目标品种
        if p.get("instId") != symbol and p.get("symbol") != symbol:
            continue

        # 兼容多种字段名
        size = float(
            p.get("contracts") or
            p.get("positionAmt") or
            p.get("pos") or
            0
        )
        total += abs(size)

    return total


def has_open_position(exchange: ccxt.Exchange, symbol: str) -> bool:
    """Position Gate: 检查是否有持仓"""
    return get_position_size(exchange, symbol) > 0


# ============================================================
# 🚀 Entry + Gate + Stop (完整执行)
# ============================================================

def execute_trade(
    exchange: ccxt.Exchange,
    symbol: str,
    side: str,
    amount: float,
    stop_loss_pct: float = 0.005  # -0.5%
) -> Optional[Dict[str, Any]]:
    """
    执行交易 (带 Position Gate + 订单级止损)

    返回: 交易记录 或 None (被 Gate 阻止)
    """
    # 🔒 Position Gate (必须在最前)
    if has_open_position(exchange, symbol):
        print("⛔ Position Gate: 已有持仓，跳过")
        return None

    # 🚀 Entry Order
    try:
        order = exchange.create_market_order(symbol, side, amount)
    except Exception as e:
        print(f"❌ 入场订单失败: {e}")
        return None

    # 获取真实成交价
    entry_price = (
        order.get("average") or
        order.get("price") or
        exchange.fetch_ticker(symbol)["last"]
    )

    # 🔻 Stop Loss Order (交易所托管)
    if side == "buy":
        stop_price = entry_price * (1 - stop_loss_pct)
        stop_side = "sell"
    else:
        stop_price = entry_price * (1 + stop_loss_pct)
        stop_side = "buy"

    stop_ok = False
    try:
        stop_order = exchange.create_order(
            symbol,
            "stop_market",
            stop_side,
            amount,
            None,  # stop_market 不需要价格
            {
                "stopPrice": stop_price,
                "reduceOnly": True  # ⚠️ 关键: 只平仓，不开新仓
            }
        )
        stop_ok = True
        print(f"✅ 止损单已挂: {stop_side} {amount} @ ${stop_price:.2f}")
    except Exception as e:
        print(f"⚠️ 止损挂单失败: {e}")
        # ⚠️ 标记失败，但不阻止交易
        stop_order = None

    # 返回交易记录
    return {
        "entry_price": entry_price,
        "position_size": amount,
        "stop_price": stop_price,
        "stop_ok": stop_ok,
        "stop_order_id": stop_order.get("id") if stop_order else None,
        "entry_time": time.time(),
        "entry_order_id": order.get("id")
    }


# ============================================================
# 🚪 Exit + 审计 (带 Exit Source)
# ============================================================

def close_trade(
    exchange: ccxt.Exchange,
    symbol: str,
    position: Dict[str, Any],
    reason: str  # STOP_LOSS | TAKE_PROFIT | TIME_EXIT | MANUAL
) -> Dict[str, Any]:
    """
    平仓 (带审计记录)

    Args:
        reason: 平仓原因 (必须明确)
            - STOP_LOSS: 止损触发
            - TAKE_PROFIT: 止盈触发
            - TIME_EXIT: 时间退出
            - MANUAL: 手动干预

    Returns:
        完整交易审计记录
    """
    amount = position["position_size"]

    # 平仓
    try:
        order = exchange.create_market_order(symbol, "sell", amount)
    except Exception as e:
        print(f"❌ 平仓失败: {e}")
        return None

    # 获取真实平仓价
    exit_price = (
        order.get("average") or
        order.get("price") or
        exchange.fetch_ticker(symbol)["last"]
    )

    # 计算 PnL
    entry_price = position["entry_price"]
    pnl = (exit_price - entry_price) / entry_price

    # 持仓时长
    hold_time = time.time() - position["entry_time"]

    # ⚠️ 如果有止损单，需要取消
    if position.get("stop_order_id"):
        try:
            exchange.cancel_order(position["stop_order_id"], symbol)
            print(f"✅ 已取消止损单: {position['stop_order_id']}")
        except Exception as e:
            print(f"⚠️ 取消止损单失败: {e}")

    # 返回完整审计记录
    return {
        "entry_price": entry_price,
        "exit_price": exit_price,
        "pnl": pnl,
        "pnl_pct": pnl * 100,
        "exit_source": reason,  # ⚠️ 关键字段
        "position_size": amount,
        "hold_time": hold_time,
        "hold_time_str": f"{hold_time / 60:.1f} min",
        "exit_order_id": order.get("id"),
        "stop_ok": position.get("stop_ok", False)
    }


# ============================================================
# ✅ 硬验收检查
# ============================================================

def validate_trade_record(trade: Dict[str, Any]) -> bool:
    """
    验收交易记录完整性

    必须字段:
    - entry_price ≠ 0
    - exit_price ≠ 0
    - pnl 存在
    - exit_source 存在
    - position_size 存在
    """
    required_fields = [
        "entry_price",
        "exit_price",
        "pnl",
        "exit_source",
        "position_size"
    ]

    for field in required_fields:
        if field not in trade:
            print(f"❌ 验收失败: 缺少字段 {field}")
            return False

        # 检查价格非零
        if field in ["entry_price", "exit_price"]:
            if trade[field] == 0:
                print(f"❌ 验收失败: {field} = 0")
                return False

    # 检查 exit_source 有效
    valid_sources = ["STOP_LOSS", "TAKE_PROFIT", "TIME_EXIT", "MANUAL"]
    if trade["exit_source"] not in valid_sources:
        print(f"⚠️ 警告: exit_source = {trade['exit_source']} (非标准)")

    print("✅ 验收通过")
    return True


# ============================================================
# 📊 使用示例
# ============================================================

if __name__ == "__main__":
    """
    完整执行流程:

    1. 检查 Position Gate
    2. 执行入场 + 挂止损
    3. 等待平仓条件
    4. 执行平仓 + 记录 Exit Source
    5. 验收数据完整性
    """

    # 示例 (需要实际 exchange)
    print("""
执行流程:
---------
# 1. 入场
position = execute_trade(exchange, "ETH/USDT:USDT", "buy", 0.13)
if position is None:
    print("被 Position Gate 阻止")

# 2. 平仓 (根据触发条件)
result = close_trade(exchange, symbol, position, "TAKE_PROFIT")

# 3. 验收
if validate_trade_record(result):
    # 记录到审计日志
    pass
    """)