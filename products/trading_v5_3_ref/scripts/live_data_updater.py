#!/usr/bin/env python3
"""
实时主网数据更新器
将主网实时数据推送到面板
"""

import ccxt
import json
import time
from pathlib import Path
from datetime import datetime

# 配置
config_path = Path.home() / '.openclaw' / 'secrets' / 'okx_api.json'
with open(config_path, 'r') as f:
    config = json.load(f)['okx']

import os
proxy = os.environ.get('https_proxy') or os.environ.get('HTTPS_PROXY') or 'http://127.0.0.1:7890'

exchange = ccxt.okx({
    'apiKey': config['api_key'],
    'secret': config['secret_key'],
    'password': config['passphrase'],
    'enableRateLimit': True,
    'proxies': {
        'http': proxy,
        'https': proxy,
    },
})

# 输出文件
LIVE_STATE_FILE = Path(__file__).parent.parent / 'logs' / 'live_state.json'
LIVE_STATE_FILE.parent.mkdir(parents=True, exist_ok=True)

def get_live_data():
    """获取实时主网数据"""
    symbol = 'ETH/USDT:USDT'
    
    # 价格
    ticker = exchange.fetch_ticker(symbol)
    
    # 持仓
    positions = exchange.fetch_positions([symbol])
    position = None
    for pos in positions:
        if float(pos.get('contracts', 0)) > 0:
            position = pos
            break
    
    # 余额
    balance = exchange.fetch_balance()
    usdt = balance.get('USDT', {})
    
    # 最近交易
    trades = exchange.fetch_my_trades(symbol, limit=10)
    
    # 计算统计
    total_pnl = 0
    win_count = 0
    loss_count = 0
    
    for t in trades:
        pnl = float(t.get('realizedPnl', 0))
        total_pnl += pnl
        if pnl > 0:
            win_count += 1
        elif pnl < 0:
            loss_count += 1
    
    total_trades = win_count + loss_count
    win_rate = (win_count / total_trades * 100) if total_trades > 0 else 0
    
    # 构建状态
    state = {
        'timestamp': datetime.now().isoformat(),
        'network': 'MAINNET',
        'symbol': symbol,
        'price': ticker['last'],
        'bid': ticker['bid'],
        'ask': ticker['ask'],
        'spread_pct': ((ticker['ask'] - ticker['bid']) / ticker['bid'] * 100) if ticker['bid'] > 0 else 0,
        
        'position': {
            'side': position.get('side') if position else 'none',
            'size': float(position.get('contracts', 0)) if position else 0,
            'entry_price': float(position.get('entryPrice', 0)) if position else 0,
            'unrealized_pnl': float(position.get('unrealizedPnl', 0)) if position else 0,
            'leverage': float(position.get('leverage', 100)) if position else 100,
        } if position else None,
        
        'balance': {
            'usdt_free': usdt.get('free', 0),
            'usdt_used': usdt.get('used', 0),
            'usdt_total': usdt.get('total', 0),
        },
        
        'stats': {
            'total_trades': total_trades,
            'win_count': win_count,
            'loss_count': loss_count,
            'win_rate': win_rate,
            'total_pnl': total_pnl,
        },
        
        'recent_trades': [
            {
                'time': t.get('datetime'),
                'side': t.get('side'),
                'price': t.get('price'),
                'amount': t.get('amount'),
                'pnl': float(t.get('realizedPnl', 0)),
            }
            for t in trades[:5]
        ],
    }
    
    # 计算持仓盈亏百分比
    if position and state['position']['entry_price'] > 0:
        entry = state['position']['entry_price']
        current = state['price']
        state['position']['pnl_pct'] = ((current - entry) / entry * 100)
    
    return state

def main():
    print("🚀 实时主网数据更新器启动")
    print(f"   输出文件: {LIVE_STATE_FILE}")
    print("   按 Ctrl+C 停止")
    print()
    
    while True:
        try:
            state = get_live_data()
            
            # 写入状态
            with open(LIVE_STATE_FILE, 'w') as f:
                json.dump(state, f, indent=2)
            
            # 控制台输出
            pos = state.get('position')
            if pos and pos.get('size', 0) > 0:
                pnl = pos.get('unrealized_pnl', 0)
                pnl_pct = pos.get('pnl_pct', 0)
                print(f"[{state['timestamp'][-12:-4]}] ${state['price']:.2f} | PnL: \${pnl:.4f} ({pnl_pct:+.4f}%)")
            else:
                print(f"[{state['timestamp'][-12:-4]}] ${state['price']:.2f} | 无持仓 | PnL: \${state['stats']['total_pnl']:.4f}")
            
            time.sleep(5)
            
        except KeyboardInterrupt:
            print("\n👋 停止更新器")
            break
        except Exception as e:
            print(f"❌ 错误: {e}")
            time.sleep(10)

if __name__ == '__main__':
    main()