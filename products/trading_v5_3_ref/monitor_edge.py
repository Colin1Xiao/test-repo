#!/usr/bin/env python3
"""Edge 验证实时监控"""

import json
import os
import sys
from pathlib import Path
from datetime import datetime
import statistics

BASE_DIR = Path(__file__).parent
STATE_FILE = BASE_DIR / 'logs' / 'state_store.json'
EDGE_DATA_FILE = BASE_DIR / 'data' / 'edge_validation_trades.jsonl'

def load_state():
    """加载 StateStore 状态"""
    if not STATE_FILE.exists():
        return None
    
    with open(STATE_FILE, 'r') as f:
        return json.load(f)

def load_trades():
    """加载交易数据"""
    trades = []
    
    # 从 state_store 加载
    state = load_state()
    if state and state.get('events'):
        for event in state.get('events', []):
            if event.get('event') == 'exit' and event.get('entry_price'):
                trades.append(event)
    
    # 从 edge_validation_trades.jsonl 加载
    if EDGE_DATA_FILE.exists():
        with open(EDGE_DATA_FILE, 'r') as f:
            for line in f:
                if line.strip():
                    trades.append(json.loads(line))
    
    return trades

def calculate_metrics(trades):
    """计算 Edge 指标"""
    if not trades:
        return None
    
    wins = [t for t in trades if t.get('pnl', 0) > 0]
    losses = [t for t in trades if t.get('pnl', 0) <= 0]
    
    total_pnl = sum(t.get('pnl', 0) for t in trades)
    total_wins = sum(t.get('pnl', 0) for t in wins) if wins else 0
    total_losses = abs(sum(t.get('pnl', 0) for t in losses)) if losses else 0
    
    profit_factor = total_wins / total_losses if total_losses > 0 else float('inf') if total_wins > 0 else 0
    win_rate = len(wins) / len(trades) * 100 if trades else 0
    
    avg_win = statistics.mean([t.get('pnl', 0) for t in wins]) if wins else 0
    avg_loss = statistics.mean([t.get('pnl', 0) for t in losses]) if losses else 0
    
    expectancy = (win_rate/100 * avg_win) - ((100-win_rate)/100 * abs(avg_loss)) if trades else 0
    
    max_win = max((t.get('pnl', 0) for t in trades), default=0)
    max_loss = min((t.get('pnl', 0) for t in trades), default=0)
    
    # Exit 分布
    exit_dist = {}
    for t in trades:
        src = t.get('exit_source', 'UNKNOWN')
        exit_dist[src] = exit_dist.get(src, 0) + 1
    
    # Capital State 分布
    capital_dist = {}
    for t in trades:
        cs = t.get('capital_state', 'UNKNOWN')
        capital_dist[cs] = capital_dist.get(cs, 0) + 1
    
    return {
        'trade_count': len(trades),
        'win_rate': round(win_rate, 2),
        'avg_win': round(avg_win, 6),
        'avg_loss': round(avg_loss, 6),
        'profit_factor': round(profit_factor, 2) if profit_factor != float('inf') else 'inf',
        'expectancy': round(expectancy, 6),
        'max_win': round(max_win, 6),
        'max_loss': round(max_loss, 6),
        'exit_distribution': exit_dist,
        'capital_state_distribution': capital_dist,
    }

def check_data_quality(trades):
    """检查数据质量（4 项）"""
    if not trades:
        return None
    
    checks = {
        'single_position': True,  # 需要检查是否有叠仓
        'stop_loss_exists': all(t.get('stop_ok', False) for t in trades),
        'stop_verified': all(t.get('stop_verified', False) for t in trades),
        'exit_source_complete': all(t.get('exit_source') for t in trades),
        'capital_state_complete': all(t.get('capital_state') for t in trades),
        'risk_pct_complete': all('risk_pct' in t for t in trades),
    }
    
    return checks

def main():
    trades = load_trades()
    
    print("\n" + "="*60)
    print("📊 Edge 验证实时监控")
    print("="*60)
    print(f"更新时间：{datetime.now().isoformat()}")
    print(f"交易数：{len(trades)}")
    
    if trades:
        metrics = calculate_metrics(trades)
        quality = check_data_quality(trades)
        
        print("\n📈 核心指标:")
        print(f"  trade_count: {metrics['trade_count']}")
        print(f"  win_rate: {metrics['win_rate']}%")
        print(f"  avg_win: ${metrics['avg_win']}")
        print(f"  avg_loss: ${metrics['avg_loss']}")
        print(f"  profit_factor: {metrics['profit_factor']}")
        print(f"  expectancy: {metrics['expectancy']}")
        print(f"  max_win: ${metrics['max_win']}")
        print(f"  max_loss: ${metrics['max_loss']}")
        
        print("\n📊 Exit 分布:")
        for src, cnt in metrics['exit_distribution'].items():
            print(f"  {src}: {cnt}")
        
        print("\n💰 Capital State 分布:")
        for cs, cnt in metrics['capital_state_distribution'].items():
            print(f"  {cs}: {cnt}")
        
        print("\n✅ 数据质量检查:")
        print(f"  止损单存在：{'✅' if quality['stop_loss_exists'] else '❌'}")
        print(f"  止损已验证：{'✅' if quality['stop_verified'] else '❌'}")
        print(f"  exit_source 完整：{'✅' if quality['exit_source_complete'] else '❌'}")
        print(f"  capital_state 完整：{'✅' if quality['capital_state_complete'] else '❌'}")
        print(f"  risk_pct 完整：{'✅' if quality['risk_pct_complete'] else '❌'}")
        
        print("\n" + "="*60)
    else:
        print("\n⏳ 等待第一批交易闭环...")
        print("="*60)

if __name__ == "__main__":
    main()
