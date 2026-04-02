#!/usr/bin/env python3
"""
Crypto Strategy Backtester
加密货币策略回测框架
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'crypto-data' / 'scripts'))

try:
    import ccxt
    import pandas as pd
    import numpy as np
    import talib
except ImportError as e:
    print(f"错误：缺少依赖包 - {e}", file=sys.stderr)
    sys.exit(1)


def fetch_data(symbol, timeframe='5m', limit=1000):
    """获取历史数据"""
    exchange = ccxt.okx({'options': {'defaultType': 'future'}})
    ohlcv = exchange.fetch_ohlcv(symbol, timeframe=timeframe, limit=limit)
    df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
    df['datetime'] = pd.to_datetime(df['timestamp'], unit='ms')
    return df


def calculate_indicators(df):
    """计算指标"""
    result = df.copy()
    result['ema_9'] = talib.EMA(result['close'], timeperiod=9)
    result['ema_20'] = talib.EMA(result['close'], timeperiod=20)
    result['ema_50'] = talib.EMA(result['close'], timeperiod=50)
    result['rsi_14'] = talib.RSI(result['close'], timeperiod=14)
    result['MACD_12_26_9'], result['MACDs_12_26_9'], result['MACDh_12_26_9'] = talib.MACD(
        result['close'], fastperiod=12, slowperiod=26, signalperiod=9
    )
    result['BB_upper'], result['BB_middle'], result['BB_lower'] = talib.BBANDS(
        result['close'], timeperiod=20, nbdevup=2, nbdevdn=2, matype=0
    )
    return result


def backtest_strategy(df, strategy='combo', initial_balance=10000, leverage=10):
    """
    回测策略

    Args:
        df: 历史数据
        strategy: 策略名称
        initial_balance: 初始资金
        leverage: 杠杆

    Returns:
        dict: 回测结果
    """
    balance = initial_balance
    position = None  # {'side': 'long/short', 'entry_price': float, 'size': float}
    trades = []

    for i in range(50, len(df)):  # 跳过前 50 条（指标计算需要）
        row = df.iloc[i]
        prev = df.iloc[i-1]

        # 无仓位时寻找开仓信号
        if position is None:
            signal = None

            if strategy == 'combo':
                # 多指标组合
                score = 0
                if row['rsi_14'] < 40: score += 1
                if row['MACD_12_26_9'] > row['MACDs_12_26_9']: score += 1
                if row['close'] > row['ema_9'] > row['ema_20']: score += 1

                if score >= 2:
                    signal = 'long'
                elif score <= -2:
                    signal = 'short'

            elif strategy == 'ma_cross':
                if prev['ema_9'] <= prev['ema_20'] and row['ema_9'] > row['ema_20']:
                    signal = 'long'
                elif prev['ema_9'] >= prev['ema_20'] and row['ema_9'] < row['ema_20']:
                    signal = 'short'

            elif strategy == 'rsi':
                if row['rsi_14'] < 30:
                    signal = 'long'
                elif row['rsi_14'] > 70:
                    signal = 'short'

            # 开仓
            if signal:
                risk_pct = 0.02  # 2% 风险
                stop_loss_pct = 0.015  # 1.5% 止损
                risk_amount = balance * risk_pct
                position_size = risk_amount / stop_loss_pct

                position = {
                    'side': signal,
                    'entry_price': row['close'],
                    'size': position_size,
                    'entry_time': row['datetime'],
                    'stop_loss': row['close'] * (1 - 0.015) if signal == 'long' else row['close'] * (1 + 0.015)
                }

        # 有仓位时检查平仓条件
        else:
            pnl_pct = 0

            if position['side'] == 'long':
                pnl_pct = (row['close'] - position['entry_price']) / position['entry_price']
                # 止损或止盈
                if row['close'] <= position['stop_loss'] or pnl_pct >= 0.03:
                    # 平仓
                    pnl = position['size'] * pnl_pct * leverage
                    balance += pnl
                    trades.append({
                        'entry_time': position['entry_time'],
                        'exit_time': row['datetime'],
                        'side': position['side'],
                        'entry_price': position['entry_price'],
                        'exit_price': row['close'],
                        'pnl': pnl,
                        'pnl_pct': pnl_pct * 100,
                        'balance': balance
                    })
                    position = None

            else:  # short
                pnl_pct = (position['entry_price'] - row['close']) / position['entry_price']
                if row['close'] >= position['stop_loss'] or pnl_pct >= 0.03:
                    pnl = position['size'] * pnl_pct * leverage
                    balance += pnl
                    trades.append({
                        'entry_time': position['entry_time'],
                        'exit_time': row['datetime'],
                        'side': position['side'],
                        'entry_price': position['entry_price'],
                        'exit_price': row['close'],
                        'pnl': pnl,
                        'pnl_pct': pnl_pct * 100,
                        'balance': balance
                    })
                    position = None

    # 计算统计
    total_trades = len(trades)
    winning_trades = sum(1 for t in trades if t['pnl'] > 0)
    win_rate = winning_trades / total_trades if total_trades > 0 else 0
    total_pnl = balance - initial_balance
    total_pnl_pct = (total_pnl / initial_balance) * 100

    # 最大回撤
    peak = initial_balance
    max_drawdown = 0
    for t in trades:
        if t['balance'] > peak:
            peak = t['balance']
        drawdown = (peak - t['balance']) / peak
        if drawdown > max_drawdown:
            max_drawdown = drawdown

    return {
        'strategy': strategy,
        'symbol': df.iloc[0].get('symbol', 'UNKNOWN'),
        'timeframe': df.iloc[0].get('timeframe', 'UNKNOWN'),
        'initial_balance': initial_balance,
        'final_balance': balance,
        'total_pnl': total_pnl,
        'total_pnl_pct': total_pnl_pct,
        'total_trades': total_trades,
        'winning_trades': winning_trades,
        'win_rate': win_rate,
        'max_drawdown': max_drawdown * 100,
        'leverage': leverage,
        'trades': trades[-10:]  # 最后 10 笔交易
    }


def main():
    parser = argparse.ArgumentParser(description="策略回测")
    parser.add_argument("--symbol", default="BTC/USDT", help="交易对")
    parser.add_argument("--timeframe", default="5m", choices=['1m', '5m', '15m', '1h'], help="时间框架")
    parser.add_argument("--limit", type=int, default=1000, help="K 线数量")
    parser.add_argument("--strategy", default="combo", choices=['combo', 'ma_cross', 'rsi'], help="策略")
    parser.add_argument("--balance", type=float, default=10000, help="初始资金 (USDT)")
    parser.add_argument("--leverage", type=int, default=10, help="杠杆倍数")
    parser.add_argument("--output", "-o", help="输出文件")
    parser.add_argument("--json", action="store_true", help="JSON 输出")
    parser.add_argument("--input", "-i", help="本地 CSV 文件（可选，替代网络获取）")
    
    args = parser.parse_args()

    print(f"📊 开始回测 {args.symbol} {args.timeframe}")
    print(f"策略：{args.strategy} | 初始资金：{args.balance} USDT | 杠杆：{args.leverage}x")
    print(f"{'='*60}")
    
    # 获取数据
    if args.input:
        print(f"加载本地数据：{args.input}")
        df = pd.read_csv(args.input)
        df['datetime'] = pd.to_datetime(df['timestamp'], unit='ms')
    else:
        print("获取历史数据...")
        df = fetch_data(args.symbol, args.timeframe, args.limit)
    print(f"共 {len(df)} 条 K 线")

    # 计算指标
    print("计算技术指标...")
    df = calculate_indicators(df)

    # 回测
    print(f"运行回测...")
    result = backtest_strategy(df, args.strategy, args.balance, args.leverage)

    # 输出
    if args.json:
        # 转换 numpy/pandas 类型为 Python 原生类型
        def convert_to_native(obj):
            if isinstance(obj, dict):
                return {k: convert_to_native(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [convert_to_native(item) for item in obj]
            elif isinstance(obj, (np.integer, np.int64)):
                return int(obj)
            elif isinstance(obj, (np.floating, np.float64)):
                return float(obj)
            elif isinstance(obj, pd.Timestamp):
                return obj.isoformat()
            elif pd.isna(obj):
                return None
            else:
                return obj
        
        result_native = convert_to_native(result)
        print(json.dumps(result_native, indent=2))
    else:
        print(f"\n{'='*60}")
        print(f"📈 回测结果")
        print(f"{'='*60}")
        print(f"策略：       {result['strategy']}")
        print(f"交易对：     {result['symbol']}")
        print(f"初始资金：   {result['initial_balance']:,.2f} USDT")
        print(f"最终资金：   {result['final_balance']:,.2f} USDT")
        print(f"总盈亏：     {result['total_pnl']:,.2f} USDT ({result['total_pnl_pct']:+.2f}%)")
        print(f"{'='*60}")
        print(f"总交易数：   {result['total_trades']}")
        print(f"胜率：       {result['win_rate']*100:.1f}%")
        print(f"最大回撤：   {result['max_drawdown']:.2f}%")
        print(f"{'='*60}")

        if result['trades']:
            print(f"\n最近交易:")
            for t in result['trades'][-5:]:
                pnl_emoji = "✅" if t['pnl'] > 0 else "❌"
                print(f"  {pnl_emoji} {t['side']}: {t['entry_price']:.2f} → {t['exit_price']:.2f} ({t['pnl']:+.2f} USDT)")

        print(f"\n{'='*60}\n")

    # 保存
    if args.output:
        pd.DataFrame(result['trades']).to_csv(args.output, index=False)
        print(f"已保存到 {args.output}")


if __name__ == "__main__":
    main()
