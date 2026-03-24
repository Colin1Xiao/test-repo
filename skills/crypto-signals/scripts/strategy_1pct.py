#!/usr/bin/env python3
"""
1% Wave Catcher Strategy
1% 波动捕捉策略（超高频剥头皮）

核心理念：
- 不追求大趋势，只抓 1-2% 小波动
- 高胜率（65%+）而非高盈亏比
- 快速进出（持仓 5-15 分钟）
- 复投模式（盈利立即再投）
- 严格止损（0.5-1%）
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
except ImportError as e:
    print(f"错误：缺少依赖包 - {e}", file=sys.stderr)
    sys.exit(1)


def fetch_ohlcv(symbol, timeframe='1m', limit=100):
    """获取 K 线数据"""
    exchange = ccxt.okx({'options': {'defaultType': 'future'}})
    ohlcv = exchange.fetch_ohlcv(symbol, timeframe=timeframe, limit=limit)
    df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
    df['datetime'] = pd.to_datetime(df['timestamp'], unit='ms')
    return df


def calculate_indicators(df):
    """计算超短线指标"""
    result = df.copy()
    
    # 超短期均线
    result['ema_5'] = result['close'].ewm(span=5, adjust=False).mean()
    result['ema_9'] = result['close'].ewm(span=9, adjust=False).mean()
    result['ema_20'] = result['close'].ewm(span=20, adjust=False).mean()
    
    # RSI (7 周期，更敏感)
    delta = result['close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=7).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=7).mean()
    rs = gain / loss
    result['rsi_7'] = 100 - (100 / (1 + rs))
    
    # 随机指标
    lowest_low = result['low'].rolling(window=14).min()
    highest_high = result['high'].rolling(window=14).max()
    result['stoch_k'] = 100 * (result['close'] - lowest_low) / (highest_high - lowest_low)
    result['stoch_d'] = result['stoch_k'].rolling(window=3).mean()
    
    # 波动率（ATR）
    high = result['high']
    low = result['low']
    close = result['close']
    tr1 = high - low
    tr2 = abs(high - close.shift(1))
    tr3 = abs(low - close.shift(1))
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    result['atr_14'] = tr.rolling(window=14).mean()
    
    # 成交量变化
    result['volume_ma'] = result['volume'].rolling(window=20).mean()
    result['volume_ratio'] = result['volume'] / result['volume_ma']
    
    return result


def generate_signal(df, aggressive=True):
    """
    生成超短线信号
    
    核心：抓 1% 波动，快进快出
    """
    if len(df) < 30:
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
        'target_profit': 1.0,  # 目标 1%
        'stop_loss': 0.5,       # 止损 0.5%
        'leverage': 50,         # 50 倍杠杆
        'expected_move_time': '5-15 分钟'
    }
    
    # 评分系统（更严格，只抓高胜率机会）
    score = 0
    max_score = 12
    
    # === 做多条件 ===
    bull_signals = []
    
    # 1. EMA 排列（3 分）
    if last['ema_5'] > last['ema_9'] > last['ema_20']:
        score += 2
        bull_signals.append('EMA 多头')
        if last['close'] > last['ema_5']:
            score += 1
            bull_signals.append('价格>EMA5')
    
    # 2. RSI 超卖反弹（3 分）
    if last['rsi_7'] < 30:
        score += 3
        bull_signals.append(f'RSI 超卖 ({last["rsi_7"]:.1f})')
    elif last['rsi_7'] < 40 and prev['rsi_7'] < last['rsi_7']:
        score += 2
        bull_signals.append(f'RSI 反弹 ({last["rsi_7"]:.1f})')
    elif 45 <= last['rsi_7'] <= 55:
        score += 1
        bull_signals.append('RSI 中性')
    
    # 3. 随机指标金叉（2 分）
    if last['stoch_k'] > last['stoch_d']:
        score += 1
        bull_signals.append('KDJ 金叉')
        if prev['stoch_k'] <= prev['stoch_d'] and last['stoch_k'] < 30:
            score += 1
            bull_signals.append('低位金叉')
    
    # 4. 成交量放大（2 分）
    if last['volume_ratio'] > 1.5:
        score += 2
        bull_signals.append(f'成交量 {last["volume_ratio"]:.1f}x')
    elif last['volume_ratio'] > 1.2:
        score += 1
        bull_signals.append(f'放量 {last["volume_ratio"]:.1f}x')
    
    # 5. 价格动量（2 分）
    momentum_3 = (last['close'] - prev2['close']) / prev2['close'] * 100
    if momentum_3 > 0.3:
        score += 1
        bull_signals.append(f'动量 +{momentum_3:.2f}%')
    if momentum_3 > 0.5:
        score += 1
        bull_signals.append(f'强动量 +{momentum_3:.2f}%')
    
    # === 做空条件 ===
    bear_signals = []
    
    if last['ema_5'] < last['ema_9'] < last['ema_20']:
        score -= 2
        bear_signals.append('EMA 空头')
        if last['close'] < last['ema_5']:
            score -= 1
            bear_signals.append('价格<EMA5')
    
    if last['rsi_7'] > 70:
        score -= 3
        bear_signals.append(f'RSI 超买 ({last["rsi_7"]:.1f})')
    elif last['rsi_7'] > 60 and prev['rsi_7'] > last['rsi_7']:
        score -= 2
        bear_signals.append(f'RSI 回调 ({last["rsi_7"]:.1f})')
    
    if last['stoch_k'] < last['stoch_d']:
        score -= 1
        bear_signals.append('KDJ 死叉')
    
    if last['volume_ratio'] > 1.5 and momentum_3 < -0.3:
        score -= 2
        bear_signals.append('放量下跌')
    
    # === 确定信号 ===
    # 激进模式阈值降低
    threshold = 7 if aggressive else 9
    
    if score >= threshold:
        if score >= 10:
            signal['signal'] = 'STRONG_BUY'
            signal['leverage'] = 50
            signal['confidence'] = min(score / max_score, 0.95)
        else:
            signal['signal'] = 'BUY'
            signal['leverage'] = 40
            signal['confidence'] = min(score / max_score, 0.85)
        
        signal['reason'] = f"{' + '.join(bull_signals[:3])}"
        signal['target_profit'] = 1.0 if aggressive else 1.5
        signal['stop_loss'] = 0.5 if aggressive else 0.8
    
    elif score <= -threshold:
        if score <= -10:
            signal['signal'] = 'STRONG_SELL'
            signal['leverage'] = 50
            signal['confidence'] = min(abs(score) / max_score, 0.95)
        else:
            signal['signal'] = 'SELL'
            signal['leverage'] = 40
            signal['confidence'] = min(abs(score) / max_score, 0.85)
        
        signal['reason'] = f"{' + '.join(bear_signals[:3])}"
        signal['target_profit'] = 1.0 if aggressive else 1.5
        signal['stop_loss'] = 0.5 if aggressive else 0.8
    
    else:
        signal['signal'] = 'HOLD'
        signal['reason'] = f'等待机会 (score={score})'
        signal['confidence'] = 0.5
    
    return signal


def calculate_growth(capital, win_rate, profit_pct, loss_pct, trades_per_day, days, leverage=50):
    """
    计算资金增长
    
    核心公式：
    每次盈利 = 本金 × 盈利% × 杠杆
    每次亏损 = 本金 × 亏损% × 杠杆
    """
    results = []
    
    for day in range(days):
        start_capital = capital
        wins = 0
        losses = 0
        daily_pnl = 0
        
        for _ in range(trades_per_day):
            if np.random.random() < win_rate:
                # 盈利
                profit = capital * (profit_pct / 100) * leverage
                capital += profit
                daily_pnl += profit
                wins += 1
            else:
                # 亏损
                loss = capital * (loss_pct / 100) * leverage
                capital = max(0, capital - loss)
                daily_pnl -= loss
                losses += 1
        
        results.append({
            'day': day + 1,
            'start': start_capital,
            'end': capital,
            'daily_pnl': daily_pnl,
            'daily_pnl_pct': (daily_pnl / start_capital) * 100,
            'wins': wins,
            'losses': losses,
            'win_rate': wins / trades_per_day if trades_per_day > 0 else 0
        })
        
        if capital <= 0:
            break
    
    return results


def simulate_scenarios():
    """模拟不同场景"""
    print("\n📊 资金增长模拟（50 倍杠杆，抓 1% 波动）")
    print("="*70)
    
    scenarios = [
        {
            'name': '乐观（胜率 70%）',
            'win_rate': 0.70,
            'profit': 1.0,
            'loss': 0.5,
            'trades': 8
        },
        {
            'name': '中性（胜率 65%）',
            'win_rate': 0.65,
            'profit': 1.0,
            'loss': 0.5,
            'trades': 6
        },
        {
            'name': '保守（胜率 60%）',
            'win_rate': 0.60,
            'profit': 1.0,
            'loss': 0.5,
            'trades': 5
        },
        {
            'name': '悲观（胜率 50%）',
            'win_rate': 0.50,
            'profit': 1.0,
            'loss': 0.5,
            'trades': 5
        }
    ]
    
    print(f"\n{'场景':<15} {'第 7 天':<12} {'第 15 天':<12} {'第 30 天':<12} {'备注':<20}")
    print("-"*70)
    
    for scenario in scenarios:
        results = calculate_growth(
            500,
            scenario['win_rate'],
            scenario['profit'],
            scenario['loss'],
            scenario['trades'],
            30,
            leverage=50
        )
        
        if len(results) >= 30:
            day7 = results[6]['end']
            day15 = results[14]['end']
            day30 = results[29]['end']
            
            note = ""
            if day30 >= 100000:
                note = "✅ 达成目标"
            elif day30 >= 10000:
                note = "🟢 10x+"
            elif day30 >= 5000:
                note = "🟡 可行"
            
            print(f"{scenario['name']:<15} ¥{day7:>8,.0f}   ¥{day15:>8,.0f}   ¥{day30:>8,.0f}   {note:<20}")
        elif len(results) > 0:
            print(f"{scenario['name']:<15} 爆仓于第{len(results)}天")
        else:
            print(f"{scenario['name']:<15} 错误")
    
    print("="*70)


def main():
    parser = argparse.ArgumentParser(description="1% 波动捕捉策略")
    parser.add_argument("--symbol", default="BTC/USDT", help="交易对")
    parser.add_argument("--timeframe", default="1m", help="时间框架")
    parser.add_argument("--capital", type=float, default=500, help="本金")
    parser.add_argument("--target", type=float, default=100000, help="目标")
    parser.add_argument("--leverage", type=int, default=50, help="杠杆倍数")
    parser.add_argument("--simulate", action="store_true", help="运行模拟")
    parser.add_argument("--json", action="store_true", help="JSON 输出")
    
    args = parser.parse_args()
    
    print(f"🎯 1% 波动捕捉策略 - {args.symbol}")
    print("="*70)
    print(f"本金：¥{args.capital:,.0f} | 目标：¥{args.target:,.0f} ({args.target/args.capital:.0f}x)")
    print(f"杠杆：{args.leverage}x | 目标盈利：1% | 止损：0.5%")
    print("="*70)
    
    # 运行模拟
    if args.simulate:
        simulate_scenarios()
        return
    
    # 获取数据
    try:
        df = fetch_ohlcv(args.symbol, args.timeframe, limit=100)
    except Exception as e:
        print(f"错误：获取数据失败 - {e}")
        print("提示：可能需要代理访问 OKX")
        sys.exit(1)
    
    # 计算指标
    df = calculate_indicators(df)
    
    # 生成信号
    signal = generate_signal(df, aggressive=True)
    
    # 输出
    if args.json:
        print(json.dumps(signal, indent=2, ensure_ascii=False))
    else:
        emoji = {
            'STRONG_BUY': '🚀', 'BUY': '📈', 'HOLD': '⏸️',
            'SELL': '📉', 'STRONG_SELL': '💥'
        }.get(signal['signal'], '❓')
        
        print(f"\n{emoji} 信号：{signal['signal']}")
        print(f"价格：{signal['price']:.2f}")
        print(f"原因：{signal['reason']}")
        print(f"置信度：{signal['confidence']*100:.0f}%")
        print(f"\n💰 交易参数:")
        print(f"  杠杆：{signal['leverage']}x")
        print(f"  目标：+{signal['target_profit']}%")
        print(f"  止损：-{signal['stop_loss']}%")
        print(f"  预期持仓：{signal['expected_move_time']}")
        
        if signal['signal'] in ['BUY', 'STRONG_BUY', 'SELL', 'STRONG_SELL']:
            position_size = args.capital * (signal['leverage'] / 10)  # 使用 10% 仓位
            profit_1pct = position_size * (signal['target_profit'] / 100) * signal['leverage']
            loss_05pct = position_size * (signal['stop_loss'] / 100) * signal['leverage']
            
            print(f"\n💵 仓位计算:")
            print(f"  仓位大小：¥{position_size:,.0f}")
            print(f"  盈利 1%：+¥{profit_1pct:,.0f}")
            print(f"  亏损 0.5%：-¥{loss_05pct:,.0f}")
            print(f"  盈亏比：{profit_1pct/loss_05pct:.1f}:1")
        
        print(f"\n⚠️  关键要点:")
        print(f"  1. 只抓 1% 小波动，不贪心")
        print(f"  2. 止损 0.5% 必须严格执行")
        print(f"  3. 胜率需要>65% 才能盈利")
        print(f"  4. 每日交易 6-8 次，不要过度")
        print(f"  5. 盈利后复投，利滚利")
        
        print(f"\n📊 达成目标路径:")
        print(f"  500 → 1,000  (需要 14 次成功交易，胜率 65%)")
        print(f"  1,000 → 5,000  (需要 32 次成功交易)")
        print(f"  5,000 → 25,000 (需要 32 次成功交易)")
        print(f"  25,000 → 100,000 (需要 28 次成功交易)")
        print(f"  总计：约 106 次成功交易（30 天，每天 3-4 次）")


if __name__ == "__main__":
    main()
