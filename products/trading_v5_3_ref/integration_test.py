#!/usr/bin/env python3
"""
V5.4 集成测试 - 最小执行链集成验证

目标：验证10笔真实交易
- entry 存在 100%
- exit 存在 ≥ 80%
- pnl ≠ 0 ≥ 70%
- execution_failures < 20%
"""

import time
import json
import ccxt
from pathlib import Path
from datetime import datetime

# 配置
BASE_DIR = Path(__file__).parent
SYMBOL = "ETH/USDT:USDT"
AMOUNT = 0.01
NUM_TRADES = 10

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

# 导入最小执行链
from core.minimal_executor import execute_signal, close_trade, calculate_pnl

# ================================
# 🔥 防污染护栏
# ================================

def is_real_trade(trade):
    """验证交易真实性"""
    return (
        trade is not None
        and trade.get("entry_price") is not None
        and trade.get("order_id") is not None
    )

# ================================
# 📊 真实统计
# ================================

stats = {
    "real_trades": 0,
    "fake_trades": 0,
    "execution_failures": 0
}

trade_log = []

# ================================
# ⏱ 运行测试
# ================================

def run_integration_test(exchange, symbol=SYMBOL, num_trades=NUM_TRADES):
    print(f"\n{'='*60}")
    print(f"🚀 V5.4 集成测试 - 最小执行链验证")
    print(f"{'='*60}")
    print(f"   币对: {symbol}")
    print(f"   数量: {AMOUNT}")
    print(f"   笔数: {num_trades}")
    print(f"{'='*60}\n")
    
    for i in range(num_trades):
        print(f"\n{'='*40}")
        print(f"🚀 TRADE {i+1}/{num_trades}")
        print(f"{'='*40}")
        
        # 开仓
        trade = execute_signal(
            exchange,
            symbol=symbol,
            side="buy",
            amount=AMOUNT
        )
        
        # 分类统计
        if trade is None:
            stats["execution_failures"] += 1
            print("❌ 执行失败")
            continue
        
        if not is_real_trade(trade):
            stats["fake_trades"] += 1
            print("⚠️ 假交易，不记录")
            continue
        
        # 真实交易
        stats["real_trades"] += 1
        trade_log.append(trade)
        print(f"📊 REAL TRADE RECORDED: entry={trade['entry_price']}")
        
        # 等待后平仓
        time.sleep(2)
        
        # 平仓
        if close_trade(exchange, trade):
            print(f"📊 REAL TRADE CLOSED: pnl={trade['pnl']:.4f}%")
        else:
            print("⚠️ 平仓失败")
            trade["exit_price"] = trade["entry_price"]
            trade["pnl"] = 0.0
        
        time.sleep(1)
    
    # 汇总
    print(f"\n{'='*60}")
    print(f"📊 集成测试结果")
    print(f"{'='*60}")
    print(f"总尝试: {num_trades}")
    print(f"真实交易: {stats['real_trades']}")
    print(f"假交易: {stats['fake_trades']}")
    print(f"执行失败: {stats['execution_failures']}")
    print(f"")
    
    # 详细交易记录
    for i, t in enumerate(trade_log):
        entry = t.get('entry_price', 'N/A')
        exit_ = t.get('exit_price', 'N/A')
        pnl = t.get('pnl', 0)
        print(f"Trade {i+1}: entry={entry} exit={exit_} pnl={pnl:.4f}%")
    
    print(f"")
    
    # 验收标准
    total = num_trades
    real_rate = stats['real_trades'] / total * 100
    exit_rate = sum(1 for t in trade_log if t.get('exit_price')) / max(len(trade_log), 1) * 100
    pnl_rate = sum(1 for t in trade_log if t.get('pnl', 0) != 0) / max(len(trade_log), 1) * 100
    fail_rate = stats['execution_failures'] / total * 100
    
    print(f"{'='*60}")
    print(f"📋 验收标准")
    print(f"{'='*60}")
    print(f"entry 存在: {real_rate:.0f}% (目标 100%)")
    print(f"exit 存在: {exit_rate:.0f}% (目标 ≥80%)")
    print(f"pnl ≠ 0: {pnl_rate:.0f}% (目标 ≥70%)")
    print(f"execution_failures: {fail_rate:.0f}% (目标 <20%)")
    print(f"{'='*60}")
    
    # 判定
    if real_rate >= 100 and exit_rate >= 80 and pnl_rate >= 70 and fail_rate < 20:
        print("")
        print("✅ 集成测试通过！最小执行链已验证。")
        print("🎯 系统已真正接入市场，进入策略验证阶段。")
        return True
    else:
        print("")
        print("❌ 集成测试未通过，需要检查。")
        return False


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
    run_integration_test(exchange, SYMBOL, NUM_TRADES)


if __name__ == "__main__":
    main()