#!/usr/bin/env python3
"""
交易质量报告生成器
"""
import json
import os
from datetime import datetime
from collections import defaultdict
import ccxt

def generate_report():
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
    
    # 获取最近成交
    orders = exchange.fetch_closed_orders('ETH/USDT:USDT', limit=100)
    
    # 看最近 2 天的交易
    from datetime import datetime, timedelta
    yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
    today = datetime.now().strftime('%Y-%m-%d')
    recent_orders = [o for o in orders if today in o['datetime'] or yesterday in o['datetime']]
    
    # 按时间排序
    recent_orders.sort(key=lambda x: x['datetime'])
    
    # 配对开仓/平仓
    trades = []
    position = 0
    entry_price = 0
    entry_time = None
    
    for o in recent_orders:
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
                # 新开仓
                position = filled
                entry_price = avg_price
                entry_time = dt
            else:
                # 加仓（不常见）
                avg_entry = (entry_price * position + avg_price * filled) / (position + filled)
                entry_price = avg_entry
                position += filled
        elif side == 'sell':
            if position > 0:
                # 平仓
                pnl_pct = (avg_price - entry_price) / entry_price * 100
                pnl_after_fee = pnl_pct - abs(fee) / (entry_price * position) * 100
                
                # 推断退出原因
                if pnl_pct >= 0.2:
                    exit_reason = 'TAKE_PROFIT'
                elif pnl_pct <= -0.5:
                    exit_reason = 'STOP_LOSS'
                elif pnl_pct <= -0.4:
                    exit_reason = 'LIQUIDATION_EXIT'
                else:
                    exit_reason = 'TIME_EXIT'
                
                trades.append({
                    'entry_time': entry_time,
                    'exit_time': dt,
                    'entry_price': entry_price,
                    'exit_price': avg_price,
                    'pnl_pct': pnl_pct,
                    'pnl_after_fee': pnl_after_fee,
                    'exit_reason': exit_reason,
                    'size': filled
                })
                
                position = 0
                entry_price = 0
    
    if len(trades) == 0:
        print("❌ 没有找到完整交易")
        return
    
    # 计算统计
    wins = [t for t in trades if t['pnl_pct'] > 0]
    losses = [t for t in trades if t['pnl_pct'] <= 0]
    
    total_pnl = sum(t['pnl_pct'] for t in trades)
    avg_win = sum(t['pnl_pct'] for t in wins) / len(wins) if wins else 0
    avg_loss = sum(t['pnl_pct'] for t in losses) / len(losses) if losses else 0
    
    win_rate = len(wins) / len(trades) * 100 if trades else 0
    
    # Profit Factor
    total_profit = sum(t['pnl_pct'] for t in wins) if wins else 0
    total_loss = abs(sum(t['pnl_pct'] for t in losses)) if losses else 0.01
    profit_factor = total_profit / total_loss if total_loss > 0 else 0
    
    # Expectancy
    expectancy = (win_rate/100 * avg_win) - ((100-win_rate)/100 * abs(avg_loss)) if trades else 0
    
    # 退出分布
    exit_dist = defaultdict(int)
    for t in trades:
        exit_dist[t['exit_reason']] += 1
    
    # 输出报告
    print("\n" + "="*50)
    print("📊 TRADE QUALITY REPORT")
    print("="*50)
    print(f"\n📅 日期: {today}")
    print(f"📝 完整交易: {len(trades)} 笔")
    
    print(f"\n📈 收益指标:")
    print(f"   胜率: {win_rate:.1f}% ({len(wins)}/{len(trades)})")
    print(f"   Profit Factor: {profit_factor:.2f}")
    print(f"   Expectancy: {expectancy:.4f}%")
    print(f"   总盈亏: {total_pnl:+.2f}%")
    
    print(f"\n📊 单笔统计:")
    print(f"   平均盈利: +{avg_win:.2f}%")
    print(f"   平均亏损: {avg_loss:.2f}%")
    print(f"   最大盈利: +{max(t['pnl_pct'] for t in trades):.2f}%")
    print(f"   最大亏损: {min(t['pnl_pct'] for t in trades):.2f}%")
    
    print(f"\n🚪 退出分布:")
    for reason, count in sorted(exit_dist.items(), key=lambda x: -x[1]):
        pct = count / len(trades) * 100
        emoji = "🚨" if reason == "LIQUIDATION_EXIT" else "✅"
        print(f"   {emoji} {reason}: {count} ({pct:.0f}%)")
    
    # 判断
    print(f"\n{'='*50}")
    print("🎯 VERDICT:")
    
    issues = []
    if profit_factor < 1.2:
        issues.append("Profit Factor < 1.2")
    if expectancy < 0:
        issues.append("Expectancy < 0")
    if exit_dist.get('LIQUIDATION_EXIT', 0) / len(trades) > 0.3:
        issues.append("LIQUIDATION_EXIT > 30%")
    if win_rate < 40:
        issues.append("Win Rate < 40%")
    
    if len(issues) == 0:
        print("🟢 HAS_EDGE - 系统有盈利潜力")
    else:
        print("❌ NO_EDGE - 系统需要优化")
        for issue in issues:
            print(f"   ⚠️ {issue}")
    
    print("="*50)
    
    # 保存报告
    report_data = {
        'date': today,
        'trades': len(trades),
        'win_rate': win_rate,
        'profit_factor': profit_factor,
        'expectancy': expectancy,
        'total_pnl': total_pnl,
        'exit_distribution': dict(exit_dist),
        'trades_detail': trades
    }
    
    report_path = os.path.expanduser('~/.openclaw/workspace/xiaolong_trading_system_4.2/logs/trade_quality_report.json')
    with open(report_path, 'w') as f:
        json.dump(report_data, f, indent=2)
    print(f"\n📄 报告已保存: {report_path}")

if __name__ == "__main__":
    generate_report()
