#!/usr/bin/env python3
"""
最小正确执行链测试

目标：保证每一笔 trade 都是真实、可计算 PnL 的
不做：异步、复杂风控、fill 等待、优化
"""

import time
import json
import ccxt  # 使用同步版本
from pathlib import Path
from datetime import datetime

# 配置
BASE_DIR = Path(__file__).parent
SYMBOL = "ETH/USDT:USDT"
AMOUNT = 0.01  # 最小测试量

# 加载 API 配置
def load_api_config():
    config_path = Path.home() / '.openclaw' / 'secrets' / 'okx_testnet.json'
    if config_path.exists():
        with open(config_path, 'r') as f:
            config = json.load(f)
            okx = config.get('okx', {})
            return {
                'apiKey': okx.get('api_key'),
                'secret': okx.get('secret_key'),
                'password': okx.get('passphrase'),
            }
    return None

# ================================
# 🔥 最小执行链核心函数
# ================================

def execute_signal(exchange, symbol, side, amount):
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


# ================================
# 🧾 Trade Recorder（防假数据）
# ================================

trade_log = []

def record_trade(trade):
    if trade is None:
        print("❌ 无效 trade，不记录")
        return False
    
    if not trade.get("entry_price"):
        print("❌ 没有价格，不记录")
        return False
    
    trade_log.append(trade)
    print(f"📊 TRADE RECORDED: entry={trade['entry_price']}")
    return True


# ================================
# 🚪 最小退出逻辑
# ================================

def close_trade(exchange, trade):
    try:
        side = "sell" if trade["side"] == "buy" else "buy"
        print(f"🔁 平仓: {trade['symbol']} {side} {trade['amount']}")
        
        order = exchange.create_order(
            symbol=trade["symbol"],
            type="market",
            side=side,
            amount=trade["amount"]
        )
        
        print(f"📋 平仓订单: {order}")
        
        # 🔥 修复：获取成交均价，多个来源
        exit_price = (
            order.get("average") or 
            order.get("price") or 
            order.get("info", {}).get("avgPx") or
            order.get("info", {}).get("fillPx")
        )
        
        if not exit_price:
            # Fallback: 获取当前价格
            try:
                ticker = exchange.fetch_ticker(trade["symbol"])
                exit_price = ticker.get("last")
                print(f"⚠️ 使用 ticker 价格: {exit_price}")
            except:
                print(f"❌ 无法获取退出价格")
                return False
        
        trade["exit_price"] = exit_price
        trade["pnl"] = calculate_pnl(trade)
        print(f"🔁 CLOSED: entry={trade['entry_price']} exit={exit_price} pnl={trade['pnl']:.4f}%")
        return True
        
    except Exception as e:
        print(f"❌ CLOSE FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


# ================================
# 📊 PnL 计算（必须真实）
# ================================

def calculate_pnl(trade):
    entry = trade["entry_price"]
    exit_ = trade["exit_price"]
    
    if not entry or not exit_:
        return 0.0
    
    if trade["side"] == "buy":
        return (exit_ - entry) / entry * 100
    else:
        return (entry - exit_) / entry * 100


# ================================
# ⏱ 最小运行循环
# ================================

def run_test(exchange, symbol=SYMBOL, num_trades=5):
    print(f"\n{'='*50}")
    print(f"🚀 开始最小执行链测试")
    print(f"   币对: {symbol}")
    print(f"   数量: {AMOUNT}")
    print(f"   笔数: {num_trades}")
    print(f"{'='*50}\n")
    
    for i in range(num_trades):
        print(f"\n{'='*30}")
        print(f"🚀 TRADE {i+1}/{num_trades}")
        print(f"{'='*30}")
        
        # 开仓
        trade = execute_signal(
            exchange,
            symbol=symbol,
            side="buy",
            amount=AMOUNT
        )
        
        # 记录
        if record_trade(trade):
            time.sleep(2)  # 等一会再平仓
            
            # 平仓
            close_trade(exchange, trade)
        
        time.sleep(1)
    
    # 汇总
    print(f"\n{'='*50}")
    print(f"📊 测试结果汇总")
    print(f"{'='*50}")
    print(f"总交易数: {len(trade_log)}")
    
    for i, t in enumerate(trade_log):
        pnl = t.get('pnl', 0)
        entry = t.get('entry_price', 'N/A')
        exit_ = t.get('exit_price', 'N/A')
        print(f"Trade {i+1}: entry={entry} exit={exit_} pnl={pnl:.4f}%")
    
    # 成功判断
    valid_trades = [t for t in trade_log if t.get('pnl', 0) != 0]
    print(f"\n有效交易: {len(valid_trades)}/{len(trade_log)}")
    
    if len(valid_trades) == len(trade_log):
        print("✅ 最小执行链验证通过！")
    else:
        print("❌ 存在无效交易，需要检查")


# ================================
# 主函数
# ================================

def main():
    # 加载配置
    config = load_api_config()
    if not config or not config.get('apiKey'):
        print("❌ API 配置缺失")
        return
    
    # 创建交易所实例（同步）
    exchange = ccxt.okx({
        'apiKey': config['apiKey'],
        'secret': config['secret'],
        'password': config['password'],
        'enableRateLimit': True,
        'options': {
            'defaultType': 'swap',
        }
    })
    
    # 设置测试网
    exchange.set_sandbox_mode(True)
    print("✅ 连接 OKX Testnet")
    
    # 运行测试
    run_test(exchange, SYMBOL, num_trades=5)
    
    # 关闭（同步版本不需要 close）
    # exchange.close()


if __name__ == "__main__":
    main()