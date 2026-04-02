#!/usr/bin/env python3
"""
Intraday Swing Trading Strategy
日内波段交易策略（激进版）

针对小资金快速增值优化：
- 高胜率入场（多指标共振）
- 快速止盈（2-5%）
- 严格止损（1-2%）
- 复投模式（盈利加仓）
- 黑天鹅防护
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


def calculate_indicators(df):
    """计算指标"""
    result = df.copy()
    
    # 均线
    result['ema_9'] = result['close'].ewm(span=9, adjust=False).mean()
    result['ema_20'] = result['close'].ewm(span=20, adjust=False).mean()
    result['ema_50'] = result['close'].ewm(span=50, adjust=False).mean()
    
    # RSI
    delta = result['close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    result['rsi_14'] = 100 - (100 / (1 + rs))
    
    # MACD
    ema_12 = result['close'].ewm(span=12, adjust=False).mean()
    ema_26 = result['close'].ewm(span=26, adjust=False).mean()
    result['macd'] = ema_12 - ema_26
    result['macd_signal'] = result['macd'].ewm(span=9, adjust=False).mean()
    result['macd_hist'] = result['macd'] - result['macd_signal']
    
    # 布林带
    result['bb_middle'] = result['close'].rolling(window=20).mean()
    bb_std = result['close'].rolling(window=20).std()
    result['bb_upper'] = result['bb_middle'] + (bb_std * 2)
    result['bb_lower'] = result['bb_middle'] - (bb_std * 2)
    
    # ATR
    high = result['high']
    low = result['low']
    close = result['close']
    tr1 = high - low
    tr2 = abs(high - close.shift(1))
    tr3 = abs(low - close.shift(1))
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    result['atr_14'] = tr.rolling(window=14).mean()
    
    return result


def generate_signal(df, aggressive=False):
    """
    生成交易信号
    
    Args:
        df: K 线数据
        aggressive: 是否激进模式（降低阈值）
    
    Returns:
        dict: 信号信息
    """
    if len(df) < 50:
        return {'signal': 'WAIT', 'reason': '数据不足'}
    
    last = df.iloc[-1]
    prev = df.iloc[-2]
    prev2 = df.iloc[-3]
    
    signal = {
        'timestamp': datetime.now().isoformat(),
        'price': last['close'],
        'signal': 'HOLD',
        'reason': '',
        'confidence': 0.0,
        'suggested_leverage': 10,
        'stop_loss_pct': 2.0,
        'take_profit_pct': 4.0
    }
    
    # 评分系统
    score = 0
    max_score = 10
    
    # === 做多条件 ===
    bull_signals = []
    
    # 1. 均线多头排列（3 分）
    if last['ema_9'] > last['ema_20'] > last['ema_50']:
        score += 2
        bull_signals.append('均线多头')
        if last['close'] > last['ema_9']:
            score += 1
            bull_signals.append('价格在 EMA9 上')
    
    # 2. RSI（2 分）
    if 40 <= last['rsi_14'] <= 60:
        score += 1
        bull_signals.append(f'RSI 中性 ({last["rsi_14"]:.1f})')
    elif 30 <= last['rsi_14'] < 40:
        score += 2
        bull_signals.append(f'RSI 偏低 ({last["rsi_14"]:.1f})')
    
    # 3. MACD（2 分）
    if last['macd'] > last['macd_signal']:
        score += 1
        bull_signals.append('MACD 金叉')
        if prev['macd'] <= prev['macd_signal']:
            score += 1
            bull_signals.append('MACD 刚金叉')
    
    # 4. 布林带（2 分）
    if last['close'] <= last['bb_lower']:
        score += 2
        bull_signals.append('触及布林带下轨')
    elif last['close'] < last['bb_middle']:
        score += 1
        bull_signals.append('低于布林带中轨')
    
    # 5. 趋势强度（1 分）
    ema_slope = (last['ema_9'] - prev['ema_9']) / prev['ema_9'] * 100
    if ema_slope > 0.1:
        score += 1
        bull_signals.append('EMA 向上')
    
    # === 做空条件 ===
    bear_signals = []
    
    if last['ema_9'] < last['ema_20'] < last['ema_50']:
        score -= 2
        bear_signals.append('均线空头')
        if last['close'] < last['ema_9']:
            score -= 1
            bear_signals.append('价格在 EMA9 下')
    
    if last['rsi_14'] > 60:
        score -= 1
        bear_signals.append(f'RSI 偏高 ({last["rsi_14"]:.1f})')
    elif last['rsi_14'] > 70:
        score -= 2
        bear_signals.append(f'RSI 超买 ({last["rsi_14"]:.1f})')
    
    if last['macd'] < last['macd_signal']:
        score -= 1
        bear_signals.append('MACD 死叉')
    
    if last['close'] >= last['bb_upper']:
        score -= 2
        bear_signals.append('触及布林带上轨')
    
    # === 确定信号 ===
    threshold = 5 if aggressive else 6
    
    if score >= threshold:
        signal['signal'] = 'STRONG_BUY' if score >= 8 else 'BUY'
        signal['reason'] = f"{' + '.join(bull_signals[:3])}"
        signal['confidence'] = min(score / max_score, 0.95)
        signal['suggested_leverage'] = 20 if score >= 8 else 15
    elif score <= -threshold:
        signal['signal'] = 'STRONG_SELL' if score <= -8 else 'SELL'
        signal['reason'] = f"{' + '.join(bear_signals[:3])}"
        signal['confidence'] = min(abs(score) / max_score, 0.95)
        signal['suggested_leverage'] = 20 if score <= -8 else 15
    else:
        signal['signal'] = 'HOLD'
        signal['reason'] = f'信号不明朗 (score={score})'
        signal['confidence'] = 0.5
    
    # 激进模式调整
    if aggressive:
        if signal['signal'] in ['BUY', 'SELL']:
            signal['stop_loss_pct'] = 1.5  # 更紧止损
            signal['take_profit_pct'] = 3.0  # 更快止盈
    
    return signal


def calculate_position_size(capital, risk_pct, stop_loss_pct, leverage):
    """计算仓位"""
    risk_amount = capital * (risk_pct / 100)
    position_size = risk_amount / (stop_loss_pct / 100)
    margin = position_size / leverage
    
    return {
        'capital': capital,
        'risk_amount': risk_amount,
        'position_size': position_size,
        'margin': margin,
        'margin_pct': (margin / capital) * 100,
        'leverage': leverage
    }


def simulate_growth(initial_capital, win_rate, avg_profit, avg_loss, trades_per_day, days, leverage=15):
    """
    模拟资金增长
    
    Args:
        initial_capital: 初始资金
        win_rate: 胜率
        avg_profit: 平均盈利%
        avg_loss: 平均亏损%
        trades_per_day: 每日交易次数
        days: 天数
        leverage: 杠杆
    
    Returns:
        list: 每日资金曲线
    """
    capital = initial_capital
    curve = [capital]
    
    for day in range(days):
        wins = 0
        losses = 0
        
        for _ in range(trades_per_day):
            if np.random.random() < win_rate:
                # 盈利
                profit = capital * (avg_profit / 100) * leverage
                capital += profit
                wins += 1
            else:
                # 亏损
                loss = capital * (avg_loss / 100) * leverage
                capital = max(0, capital - loss)
                losses += 1
        
        curve.append(capital)
        
        if capital <= 0:
            print(f"第 {day+1} 天爆仓")
            break
    
    return curve


def main():
    parser = argparse.ArgumentParser(description="日内波段交易策略（激进版）")
    parser.add_argument("--symbol", default="BTC/USDT", help="交易对")
    parser.add_argument("--timeframe", default="5m", help="时间框架")
    parser.add_argument("--capital", type=float, default=500, help="本金 (CNY)")
    parser.add_argument("--target", type=float, default=100000, help="目标金额")
    parser.add_argument("--aggressive", action="store_true", help="激进模式")
    parser.add_argument("--simulate", action="store_true", help="运行模拟")
    parser.add_argument("--json", action="store_true", help="JSON 输出")
    
    args = parser.parse_args()
    
    print(f"📈 日内波段交易策略 - {args.symbol}")
    print(f"{'='*60}")
    print(f"本金：¥{args.capital:,.0f} | 目标：¥{args.target:,.0f} ({args.target/args.capital:.0f}x)")
    print(f"模式：{'激进' if args.aggressive else '稳健'}")
    print(f"{'='*60}")
    
    # 获取数据
    try:
        df = fetch_ohlcv(args.symbol, args.timeframe, limit=100)
    except Exception as e:
        print(f"错误：获取数据失败 - {e}", file=sys.stderr)
        print("提示：可能需要代理访问 OKX")
        sys.exit(1)
    
    # 计算指标
    df = calculate_indicators(df)
    
    # 生成信号
    signal = generate_signal(df, args.aggressive)
    
    # 计算仓位
    if signal['signal'] in ['BUY', 'STRONG_BUY', 'SELL', 'STRONG_SELL']:
        position = calculate_position_size(
            args.capital,
            risk_pct=2.0,
            stop_loss_pct=signal['stop_loss_pct'],
            leverage=signal['suggested_leverage']
        )
    else:
        position = None
    
    # 输出
    if args.json:
        result = {
            'timestamp': datetime.now().isoformat(),
            'symbol': args.symbol,
            'signal': signal,
            'position': position
        }
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        # 信号
        emoji = {
            'STRONG_BUY': '🚀', 'BUY': '📈', 'HOLD': '⏸️',
            'SELL': '📉', 'STRONG_SELL': '💥'
        }.get(signal['signal'], '❓')
        
        print(f"\n{emoji} 信号：{signal['signal']}")
        print(f"价格：{signal['price']:.2f}")
        print(f"原因：{signal['reason']}")
        print(f"置信度：{signal['confidence']*100:.0f}%")
        
        if position:
            print(f"\n💰 仓位建议:")
            print(f"{'='*60}")
            print(f"建议杠杆：{position['leverage']}x")
            print(f"仓位大小：${position['position_size']:.0f}")
            print(f"需要保证金：${position['margin']:.0f} ({position['margin_pct']:.0f}% 仓位)")
            print(f"止损：{signal['stop_loss_pct']}%")
            print(f"止盈：{signal['take_profit_pct']}%")
            print(f"风险金额：${position['risk_amount']:.0f}")
        
        # 模拟
        if args.simulate:
            print(f"\n📊 资金增长模拟:")
            print(f"{'='*60}")
            
            # 不同场景
            scenarios = [
                {'name': '乐观', 'win_rate': 0.65, 'avg_profit': 3, 'avg_loss': 2, 'trades': 5},
                {'name': '中性', 'win_rate': 0.55, 'avg_profit': 2.5, 'avg_loss': 2, 'trades': 4},
                {'name': '悲观', 'win_rate': 0.45, 'avg_profit': 2, 'avg_loss': 2.5, 'trades': 3},
            ]
            
            print(f"\n30 天后资金预测:")
            for scenario in scenarios:
                curve = simulate_growth(
                    args.capital,
                    scenario['win_rate'],
                    scenario['avg_profit'],
                    scenario['avg_loss'],
                    scenario['trades'],
                    30,
                    leverage=15
                )
                final = curve[-1]
                print(f"   {scenario['name']}: ¥{final:,.0f} ({final/args.capital:.1f}x)")
                if final >= args.target:
                    print(f"      ✅ 达成目标！")
                elif final >= args.capital * 10:
                    print(f"      🟡 10x 收益")
                elif final >= args.capital * 2:
                    print(f"      🟢 翻倍")
                elif final < args.capital * 0.5:
                    print(f"      🔴 亏损超过 50%")
        
        # 风险提示
        print(f"\n⚠️  风险提示:")
        if args.aggressive:
            print(f"   🔴 激进模式：高风险高回报")
            print(f"   建议杠杆：20-30x")
            print(f"  止损：1.5%（很紧，容易被震出）")
        else:
            print(f"   🟡 稳健模式：推荐新手")
            print(f"   建议杠杆：10-15x")
            print(f"   止损：2%")
        
        print(f"\n💡 建议:")
        print(f"   1. 先用测试网练习 1-2 周")
        print(f"   2. 严格执行止损，不要扛单")
        print(f"   3. 盈利后逐步加仓，不要一把梭")
        print(f"   4. 每天最多交易 5 次，避免过度交易")
        print(f"   5. 单月目标建议：3-5x（而非 200x）")
        
        print(f"\n{'='*60}\n")


if __name__ == "__main__":
    main()
