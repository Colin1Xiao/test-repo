"""
尾部捕获策略专项分析
分析非TIME_EXIT交易的表现（真正赚钱的那5%）
"""
import json
import os
from datetime import datetime, timedelta
from collections import defaultdict
import ccxt

def analyze_tail_strategy():
    # 加载配置
    with open(os.path.expanduser('~/.openclaw/secrets/okx_testnet.json')) as f:
        config = json.load(f)['okx']
    
    exchange = ccxt.okx({
        'apiKey': config['api_key'],
        'secret': config['secret_key'],
        'password': config['passphrase'],
        'enableRateLimit': True,
        'options': {'defaultType': 'swap'},
        'proxies': {'http': 'http://127.0.0.1:7890', 'https': 'http://127.0.0.1:7890'}
    })
    exchange.set_sandbox_mode(True)
    
    orders = exchange.fetch_closed_orders('ETH/USDT:USDT', limit=100)
    
    # 最近2天
    today = datetime.now().strftime('%Y-%m-%d')
    yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
    recent = [o for o in orders if today in o['datetime'] or yesterday in o['datetime']]
    recent.sort(key=lambda x: x['datetime'])
    
    # 配对交易
    trades = []
    position = 0
    entry_price = 0
    entry_time = None
    hold_times = []
    
    for o in recent:
        filled = float(o.get('filled', 0))
        avg_price = float(o.get('average', 0))
        side = o['side']
        dt = o['datetime']
        fee_raw = o.get('fee', 0)
        if isinstance(fee_raw, dict):
            fee = float(fee_raw.get('cost', 0) or 0)
        else:
            fee = float(fee_raw or 0)
        
        if side == 'buy':
            if position == 0:
                position = filled
                entry_price = avg_price
                entry_time = dt
            else:
                avg_entry = (entry_price * position + avg_price * filled) / (position + filled)
                entry_price = avg_entry
                position += filled
        elif side == 'sell':
            if position > 0:
                pnl_pct = (avg_price - entry_price) / entry_price * 100
                
                # 计算持仓时间
                try:
                    from datetime import datetime as dt2
                    t1 = dt2.fromisoformat(entry_time.replace('Z', '+00:00'))
                    t2 = dt2.fromisoformat(dt.replace('Z', '+00:00'))
                    hold_time = (t2 - t1).total_seconds()
                    hold_times.append(hold_time)
                except:
                    hold_time = 0
                
                # 推断退出类型
                if pnl_pct >= 0.2:
                    exit_type = 'TAKE_PROFIT'
                elif pnl_pct <= -0.5:
                    exit_type = 'STOP_LOSS'
                elif pnl_pct <= -0.4:
                    exit_type = 'LIQUIDATION_EXIT'
                elif hold_time >= 25:
                    exit_type = 'TIME_EXIT'
                else:
                    exit_type = 'MANUAL_EXIT'
                
                trades.append({
                    'entry_time': entry_time,
                    'exit_time': dt,
                    'entry_price': entry_price,
                    'exit_price': avg_price,
                    'pnl_pct': pnl_pct,
                    'exit_type': exit_type,
                    'hold_time': hold_time
                })
                
                position = 0
                entry_price = 0
    
    if not trades:
        print("❌ 没有找到完整交易")
        return
    
    # 分类分析
    time_exits = [t for t in trades if t['exit_type'] == 'TIME_EXIT']
    profit_exits = [t for t in trades if t['exit_type'] != 'TIME_EXIT']
    
    print("\n" + "="*60)
    print("📊 尾部捕获策略专项分析")
    print("="*60)
    
    print(f"\n📅 分析期间: {yesterday} ~ {today}")
    print(f"📝 总交易: {len(trades)} 笔")
    
    print("\n" + "-"*60)
    print("🎯 核心发现：尾部交易 vs 时间退出")
    print("-"*60)
    
    print(f"\n📌 TIME_EXIT (时间退出): {len(time_exits)} 笔 ({len(time_exits)/len(trades)*100:.1f}%)")
    if time_exits:
        avg_pnl = sum(t['pnl_pct'] for t in time_exits) / len(time_exits)
        total_pnl = sum(t['pnl_pct'] for t in time_exits)
        print(f"   平均盈亏: {avg_pnl:+.4f}%")
        print(f"   总盈亏: {total_pnl:+.4f}%")
    
    print(f"\n📌 非TIME_EXIT (主动退出): {len(profit_exits)} 笔 ({len(profit_exits)/len(trades)*100:.1f}%)")
    if profit_exits:
        avg_pnl = sum(t['pnl_pct'] for t in profit_exits) / len(profit_exits)
        total_pnl = sum(t['pnl_pct'] for t in profit_exits)
        wins = [t for t in profit_exits if t['pnl_pct'] > 0]
        print(f"   平均盈亏: {avg_pnl:+.4f}%")
        print(f"   总盈亏: {total_pnl:+.4f}%")
        print(f"   胜率: {len(wins)}/{len(profit_exits)} ({len(wins)/len(profit_exits)*100:.1f}%)")
        print(f"   盈利贡献: {total_pnl / sum(t['pnl_pct'] for t in trades) * 100:.1f}%")
    
    print("\n" + "-"*60)
    print("⏱️ 持仓时间分析")
    print("-"*60)
    
    if hold_times:
        avg_hold = sum(hold_times) / len(hold_times)
        print(f"   平均持仓: {avg_hold:.1f} 秒")
        print(f"   最短: {min(hold_times):.1f} 秒")
        print(f"   最长: {max(hold_times):.1f} 秒")
    
    print("\n" + "-"*60)
    print("🎯 Edge 来源")
    print("-"*60)
    
    time_pnl = sum(t['pnl_pct'] for t in time_exits) if time_exits else 0
    profit_pnl = sum(t['pnl_pct'] for t in profit_exits) if profit_exits else 0
    
    print(f"   TIME_EXIT 贡献: {time_pnl:+.4f}% ({time_pnl/(time_pnl+profit_pnl)*100 if time_pnl+profit_pnl else 0:.1f}%)")
    print(f"   主动退出贡献: {profit_pnl:+.4f}% ({profit_pnl/(time_pnl+profit_pnl)*100 if time_pnl+profit_pnl else 0:.1f}%)")
    
    print("\n" + "="*60)
    print("💡 结论")
    print("="*60)
    
    if profit_exits and profit_pnl > abs(time_pnl):
        print("✅ Edge 主要来自主动退出（尾部捕获）")
        print("   → 需要优化：让更多交易走到主动退出")
    elif time_exits:
        print("⚠️ Edge 主要来自时间退出（偶然行情）")
        print("   → 需要优化：改进退出逻辑")
    
    print()

if __name__ == "__main__":
    analyze_tail_strategy()
