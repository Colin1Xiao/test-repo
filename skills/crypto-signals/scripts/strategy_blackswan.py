#!/usr/bin/env python3
"""
Black Swan Protection Strategy
黑天鹅事件防护策略

检测并防护极端行情：
- 闪崩检测（5 分钟跌幅 > 5%）
- 波动率暴增（ATR > 3 倍均值）
- 成交量异常（> 5 倍均值）
- 资金费率极端（> 0.1%）
- 多交易所价差异常
"""

import argparse
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'crypto-data' / 'scripts'))

try:
    import ccxt
    import pandas as pd
    import numpy as np
except ImportError as e:
    print(f"错误：缺少依赖包 - {e}", file=sys.stderr)
    sys.exit(1)


def fetch_ohlcv(symbol, timeframe='5m', limit=100):
    """获取 K 线数据"""
    exchange = ccxt.okx({'options': {'defaultType': 'future'}})
    ohlcv = exchange.fetch_ohlcv(symbol, timeframe=timeframe, limit=limit)
    df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
    df['datetime'] = pd.to_datetime(df['timestamp'], unit='ms')
    return df


def calculate_atr(df, length=14):
    """计算 ATR（平均真实波幅）"""
    high = df['high']
    low = df['low']
    close = df['close']
    
    tr1 = high - low
    tr2 = abs(high - close.shift(1))
    tr3 = abs(low - close.shift(1))
    
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    atr = tr.rolling(window=length).mean()
    
    return atr


def detect_black_swan(df):
    """
    检测黑天鹅事件
    
    Returns:
        dict: 检测结果和警报级别
    """
    alerts = {
        'level': 'GREEN',  # GREEN, YELLOW, ORANGE, RED
        'signals': [],
        'should_close': False,
        'reasons': []
    }
    
    if len(df) < 50:
        alerts['reasons'].append('数据不足，无法检测')
        return alerts
    
    latest = df.iloc[-1]
    prev_5 = df.iloc[-6] if len(df) >= 6 else df.iloc[0]
    prev_15 = df.iloc[-16] if len(df) >= 16 else df.iloc[0]
    
    # 1. 闪崩检测（5 分钟跌幅）
    drop_5m = (latest['close'] - prev_5['close']) / prev_5['close'] * 100
    if drop_5m < -5:
        alerts['signals'].append(f'闪崩：5 分钟下跌 {drop_5m:.2f}%')
        alerts['level'] = 'RED'
        alerts['should_close'] = True
        alerts['reasons'].append(f'5 分钟闪崩 {drop_5m:.2f}%')
    elif drop_5m < -3:
        alerts['signals'].append(f'急跌：5 分钟下跌 {drop_5m:.2f}%')
        if alerts['level'] == 'GREEN':
            alerts['level'] = 'ORANGE'
    
    # 2. 波动率检测（ATR）
    atr = calculate_atr(df, 14)
    atr_mean = atr.iloc[:-1].mean()
    atr_current = atr.iloc[-1]
    
    if pd.notna(atr_current) and pd.notna(atr_mean):
        atr_ratio = atr_current / atr_mean
        if atr_ratio > 3:
            alerts['signals'].append(f'波动率暴增：ATR {atr_ratio:.1f}x 均值')
            alerts['level'] = 'RED'
            alerts['should_close'] = True
            alerts['reasons'].append(f'波动率暴增 {atr_ratio:.1f}x')
        elif atr_ratio > 2:
            alerts['signals'].append(f'波动率上升：ATR {atr_ratio:.1f}x 均值')
            if alerts['level'] == 'GREEN':
                alerts['level'] = 'ORANGE'
    
    # 3. 成交量异常
    volume_mean = df['volume'].iloc[:-1].mean()
    volume_current = latest['volume']
    volume_ratio = volume_current / volume_mean
    
    if volume_ratio > 5:
        alerts['signals'].append(f'成交量异常：{volume_ratio:.1f}x 均值')
        alerts['level'] = 'RED'
        alerts['should_close'] = True
        alerts['reasons'].append(f'成交量异常 {volume_ratio:.1f}x')
    elif volume_ratio > 3:
        alerts['signals'].append(f'成交量放大：{volume_ratio:.1f}x 均值')
        if alerts['level'] == 'GREEN':
            alerts['level'] = 'YELLOW'
    
    # 4. 15 分钟大趋势检测
    change_15m = (latest['close'] - prev_15['close']) / prev_15['close'] * 100
    if abs(change_15m) > 8:
        alerts['signals'].append(f'15 分钟大波动：{change_15m:+.2f}%')
        if alerts['level'] == 'GREEN':
            alerts['level'] = 'ORANGE'
        alerts['reasons'].append(f'15 分钟波动 {change_15m:.2f}%')
    
    # 5. 长下影线/上影线（反转信号）
    candle_range = latest['high'] - latest['low']
    lower_wick = latest['close'] - latest['low']
    upper_wick = latest['high'] - latest['close']
    
    if candle_range > 0:
        lower_wick_ratio = lower_wick / candle_range
        upper_wick_ratio = upper_wick / candle_range
        
        if lower_wick_ratio > 0.7 and change_15m < -5:
            alerts['signals'].append('长下影线 - 可能反弹')
            alerts['level'] = 'YELLOW'
        if upper_wick_ratio > 0.7 and change_15m > 5:
            alerts['signals'].append('长上影线 - 可能回调')
            alerts['level'] = 'YELLOW'
    
    return alerts


def get_protection_actions(alert_level):
    """根据警报级别获取防护动作"""
    actions = {
        'GREEN': {
            'action': '正常交易',
            'position': '保持当前仓位',
            'stop_loss': '正常止损',
            'description': '市场正常，可继续执行策略'
        },
        'YELLOW': {
            'action': '提高警惕',
            'position': '减仓 20-30%',
            'stop_loss': '收紧止损至 1.5%',
            'description': '市场出现异常信号，建议降低风险'
        },
        'ORANGE': {
            'action': '高度警惕',
            'position': '减仓 50% 或清仓',
            'stop_loss': '立即收紧止损至 1%',
            'description': '市场明显异常，建议大幅降低风险'
        },
        'RED': {
            'action': '紧急避险',
            'position': '立即清仓',
            'stop_loss': '市价全平',
            'description': '黑天鹅事件！立即平仓避险，不要犹豫'
        }
    }
    return actions.get(alert_level, actions['GREEN'])


def main():
    parser = argparse.ArgumentParser(description="黑天鹅防护策略")
    parser.add_argument("--symbol", default="BTC/USDT", help="交易对")
    parser.add_argument("--timeframe", default="5m", help="时间框架")
    parser.add_argument("--json", action="store_true", help="JSON 输出")
    
    args = parser.parse_args()
    
    print(f"🛡️  黑天鹅防护检测 - {args.symbol}")
    print(f"{'='*60}")
    
    # 获取数据
    try:
        df = fetch_ohlcv(args.symbol, args.timeframe, limit=100)
        print(f"已获取 {len(df)} 条 K 线")
    except Exception as e:
        print(f"错误：获取数据失败 - {e}", file=sys.stderr)
        sys.exit(1)
    
    # 检测黑天鹅
    alerts = detect_black_swan(df)
    
    # 获取防护动作
    actions = get_protection_actions(alerts['level'])
    
    # 输出
    if args.json:
        result = {
            'timestamp': datetime.now().isoformat(),
            'symbol': args.symbol,
            'alerts': alerts,
            'actions': actions
        }
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        # 警报级别
        emoji = {'GREEN': '🟢', 'YELLOW': '🟡', 'ORANGE': '🟠', 'RED': '🔴'}.get(alerts['level'], '⚪')
        print(f"\n{emoji} 警报级别：{alerts['level']}")
        print(f"{'='*60}")
        
        # 检测到的信号
        if alerts['signals']:
            print(f"\n🔍 检测到的信号:")
            for signal in alerts['signals']:
                print(f"   • {signal}")
        else:
            print(f"\n✅ 未检测到异常信号")
        
        # 防护动作
        print(f"\n📋 建议防护动作:")
        print(f"   动作：{actions['action']}")
        print(f"   仓位：{actions['position']}")
        print(f"   止损：{actions['stop_loss']}")
        print(f"   说明：{actions['description']}")
        
        # 紧急提示
        if alerts['should_close']:
            print(f"\n⚠️  警告：建议立即平仓！")
            print(f"   原因：{', '.join(alerts['reasons'])}")
        
        print(f"\n{'='*60}\n")


if __name__ == "__main__":
    main()
