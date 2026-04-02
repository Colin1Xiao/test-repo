#!/usr/bin/env python3
"""
Volume-Price Analysis Module
量价关系分析模块

核心逻辑:
1. 放量上涨 → 强势看涨 (权重 +4)
2. 缩量上涨 → 可能见顶 (权重 -2)
3. 放量下跌 → 强势看跌 (权重 +4)
4. 缩量下跌 → 可能见底 (权重 -2)
5. 量价背离 → 反转信号 (权重 +3)
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


def analyze_volume_price(df):
    """
    量价关系分析
    
    Returns:
        dict: 量价分析结果
    """
    if len(df) < 20:
        return {'signal': 'WAIT', 'reason': '数据不足'}
    
    latest = df.iloc[-1]
    prev = df.iloc[-2]
    prev2 = df.iloc[-3]
    prev3 = df.iloc[-4]
    
    # 计算成交量均线
    volume_ma_20 = df['volume'].rolling(window=20).mean().iloc[-1]
    volume_ma_5 = df['volume'].rolling(window=5).mean().iloc[-1]
    
    # 当前成交量相对变化
    volume_ratio = latest['volume'] / volume_ma_20
    volume_ratio_5 = latest['volume'] / volume_ma_5
    
    # 价格变化
    price_change = (latest['close'] - prev['close']) / prev['close'] * 100
    price_change_3 = (latest['close'] - prev3['close']) / prev3['close'] * 100
    
    # 量价关系判断
    analysis = {
        'volume_status': 'NORMAL',      # 成交量状态
        'price_status': 'NORMAL',       # 价格状态
        'volume_price_signal': 'NEUTRAL',  # 量价信号
        'score': 0,                      # 量价评分 (-5 to +5)
        'signals': [],                   # 信号列表
        'divergence': None              # 背离检测
    }
    
    # === 1. 成交量状态 ===
    if volume_ratio > 2.0:
        analysis['volume_status'] = 'HEAVY'  # 巨量
        analysis['signals'].append(f'巨量 ({volume_ratio:.1f}x)')
    elif volume_ratio > 1.5:
        analysis['volume_status'] = 'HIGH'   # 放量
        analysis['signals'].append(f'放量 ({volume_ratio:.1f}x)')
    elif volume_ratio < 0.5:
        analysis['volume_status'] = 'LIGHT'  # 缩量
        analysis['signals'].append(f'缩量 ({volume_ratio:.1f}x)')
    elif volume_ratio < 0.7:
        analysis['volume_status'] = 'LOW'    # 低量
        analysis['signals'].append(f'低量 ({volume_ratio:.1f}x)')
    else:
        analysis['volume_status'] = 'NORMAL'
        analysis['signals'].append(f'正常量能 ({volume_ratio:.1f}x)')
    
    # === 2. 价格状态 ===
    if price_change > 1.0:
        analysis['price_status'] = 'STRONG_UP'
        analysis['signals'].append(f'大涨 +{price_change:.2f}%')
    elif price_change > 0.3:
        analysis['price_status'] = 'UP'
        analysis['signals'].append(f'上涨 +{price_change:.2f}%')
    elif price_change < -1.0:
        analysis['price_status'] = 'STRONG_DOWN'
        analysis['signals'].append(f'大跌 {price_change:.2f}%')
    elif price_change < -0.3:
        analysis['price_status'] = 'DOWN'
        analysis['signals'].append(f'下跌 {price_change:.2f}%')
    else:
        analysis['price_status'] = 'SIDEWAY'
        analysis['signals'].append(f'震荡 {price_change:+.2f}%')
    
    # === 3. 量价关系评分 ===
    
    # 3.1 放量上涨 → 强势看涨 (+4 分)
    if analysis['volume_status'] in ['HEAVY', 'HIGH'] and analysis['price_status'] in ['UP', 'STRONG_UP']:
        analysis['score'] += 4
        analysis['volume_price_signal'] = 'STRONG_BULL'
        analysis['signals'].append('✅ 放量上涨 - 强势看涨')
    
    # 3.2 缩量上涨 → 可能见顶 (-2 分)
    elif analysis['volume_status'] in ['LIGHT', 'LOW'] and analysis['price_status'] in ['UP', 'STRONG_UP']:
        analysis['score'] -= 2
        analysis['volume_price_signal'] = 'WEAK_BULL'
        analysis['signals'].append('⚠️ 缩量上涨 - 可能见顶')
    
    # 3.3 放量下跌 → 强势看跌 (+4 分做空)
    elif analysis['volume_status'] in ['HEAVY', 'HIGH'] and analysis['price_status'] in ['DOWN', 'STRONG_DOWN']:
        analysis['score'] -= 4
        analysis['volume_price_signal'] = 'STRONG_BEAR'
        analysis['signals'].append('✅ 放量下跌 - 强势看跌')
    
    # 3.4 缩量下跌 → 可能见底 (-2 分做空)
    elif analysis['volume_status'] in ['LIGHT', 'LOW'] and analysis['price_status'] in ['DOWN', 'STRONG_DOWN']:
        analysis['score'] += 2
        analysis['volume_price_signal'] = 'WEAK_BEAR'
        analysis['signals'].append('⚠️ 缩量下跌 - 可能见底')
    
    # 3.5 放量震荡 → 变盘前兆 (+2 分)
    elif analysis['volume_status'] in ['HEAVY', 'HIGH'] and analysis['price_status'] == 'SIDEWAY':
        analysis['score'] += 2
        analysis['volume_price_signal'] = 'BREAKOUT_IMMINENT'
        analysis['signals'].append('🔍 放量震荡 - 变盘前兆')
    
    # 3.6 缩量震荡 → 继续观望 (0 分)
    elif analysis['volume_status'] in ['LIGHT', 'LOW'] and analysis['price_status'] == 'SIDEWAY':
        analysis['score'] = 0
        analysis['volume_price_signal'] = 'WAIT'
        analysis['signals'].append('⏸️ 缩量震荡 - 继续观望')
    
    # === 4. 量价背离检测 ===
    
    # 4.1 顶背离（价格新高，成交量下降）
    if len(df) >= 10:
        recent_high_price = df['high'].iloc[-10:-1].max()
        recent_high_volume = df.loc[df['high'].iloc[-10:-1].idxmax(), 'volume']
        
        if latest['high'] > recent_high_price and latest['volume'] < recent_high_volume * 0.8:
            analysis['divergence'] = 'TOP_DIVERGENCE'
            analysis['score'] -= 3
            analysis['signals'].append('🔴 顶背离 - 价格新高但量能不足')
        
        # 4.2 底背离（价格新低，成交量上升）
        recent_low_price = df['low'].iloc[-10:-1].min()
        recent_low_volume = df.loc[df['low'].iloc[-10:-1].idxmax(), 'volume']
        
        if latest['low'] < recent_low_price and latest['volume'] > recent_low_volume * 1.2:
            analysis['divergence'] = 'BOTTOM_DIVERGENCE'
            analysis['score'] += 3
            analysis['signals'].append('🟢 底背离 - 价格新低但放量')
    
    # === 5. 连续量价分析 ===
    
    # 5.1 连续放量上涨（3 根 K 线）
    if len(df) >= 3:
        consecutive_up = True
        consecutive_volume_up = True
        for i in range(1, 4):
            if df.iloc[-i]['close'] <= df.iloc[-i-1]['close']:
                consecutive_up = False
            if df.iloc[-i]['volume'] <= df['volume'].rolling(20).mean().iloc[-i-1]:
                consecutive_volume_up = False
        
        if consecutive_up and consecutive_volume_up:
            analysis['signals'].append('🚀 连续放量上涨 - 强势延续')
            analysis['score'] += 2
    
    # === 6. 成交量趋势 ===
    if volume_ratio_5 > 1.3:
        analysis['volume_trend'] = 'INCREASING'
        analysis['signals'].append('📈 成交量上升趋势')
    elif volume_ratio_5 < 0.7:
        analysis['volume_trend'] = 'DECREASING'
        analysis['signals'].append('📉 成交量下降趋势')
    else:
        analysis['volume_trend'] = 'STABLE'
    
    return analysis


def get_trading_recommendation(analysis, other_signals_score=0):
    """
    根据量价分析获取交易建议
    
    Args:
        analysis: 量价分析结果
        other_signals_score: 其他指标评分（EMA/RSI/MACD 等）
    
    Returns:
        dict: 交易建议
    """
    recommendation = {
        'action': 'WAIT',
        'confidence': 0.0,
        'suggested_leverage': 0,
        'reason': '',
        'volume_price_weight': 0.6  # 量价权重 60%
    }
    
    # 综合评分（量价 60% + 其他指标 40%）
    total_score = (analysis['score'] * 0.6) + (other_signals_score * 0.4)
    
    # 量价信号强烈时提高权重
    if analysis['volume_price_signal'] in ['STRONG_BULL', 'STRONG_BEAR']:
        recommendation['volume_price_weight'] = 0.7
    elif analysis['divergence']:
        recommendation['volume_price_weight'] = 0.8
    
    # 判断动作
    if total_score >= 3:
        recommendation['action'] = 'STRONG_BUY'
        recommendation['confidence'] = min(abs(total_score) / 5, 0.95)
        recommendation['suggested_leverage'] = 50 if total_score >= 4 else 40
        recommendation['reason'] = f"量价评分：{analysis['score']} + 其他指标：{other_signals_score}"
    
    elif total_score >= 1.5:
        recommendation['action'] = 'BUY'
        recommendation['confidence'] = min(abs(total_score) / 5, 0.75)
        recommendation['suggested_leverage'] = 30
        recommendation['reason'] = f"量价评分：{analysis['score']} + 其他指标：{other_signals_score}"
    
    elif total_score <= -3:
        recommendation['action'] = 'STRONG_SELL'
        recommendation['confidence'] = min(abs(total_score) / 5, 0.95)
        recommendation['suggested_leverage'] = 50 if total_score <= -4 else 40
        recommendation['reason'] = f"量价评分：{analysis['score']} + 其他指标：{other_signals_score}"
    
    elif total_score <= -1.5:
        recommendation['action'] = 'SELL'
        recommendation['confidence'] = min(abs(total_score) / 5, 0.75)
        recommendation['suggested_leverage'] = 30
        recommendation['reason'] = f"量价评分：{analysis['score']} + 其他指标：{other_signals_score}"
    
    else:
        recommendation['action'] = 'WAIT'
        recommendation['confidence'] = 0.5
        recommendation['reason'] = f"信号不明朗 (量价：{analysis['score']}, 其他：{other_signals_score})"
    
    return recommendation


def main():
    parser = argparse.ArgumentParser(description="量价关系分析")
    parser.add_argument("--symbol", default="BTC/USDT", help="交易对")
    parser.add_argument("--timeframe", default="1m", help="时间框架")
    parser.add_argument("--other-score", type=float, default=0, help="其他指标评分")
    parser.add_argument("--json", action="store_true", help="JSON 输出")
    
    args = parser.parse_args()
    
    print(f"📊 量价关系分析 - {args.symbol}")
    print("="*70)
    
    # 获取数据
    try:
        df = fetch_ohlcv(args.symbol, args.timeframe, limit=100)
    except Exception as e:
        print(f"错误：获取数据失败 - {e}")
        print("提示：可能需要代理访问 OKX")
        sys.exit(1)
    
    # 量价分析
    analysis = analyze_volume_price(df)
    
    # 交易建议
    recommendation = get_trading_recommendation(analysis, args.other_score)
    
    # 输出
    if args.json:
        result = {
            'timestamp': datetime.now().isoformat(),
            'symbol': args.symbol,
            'price': df['close'].iloc[-1],
            'analysis': analysis,
            'recommendation': recommendation
        }
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        current_price = df['close'].iloc[-1]
        print(f"\n当前价格：{current_price:.2f}")
        
        # 量价分析
        print(f"\n{'='*70}")
        print(f"📊 量价关系分析")
        print(f"{'='*70}")
        
        # 成交量状态
        volume_emoji = {
            'HEAVY': '🔥', 'HIGH': '📈', 'NORMAL': '➡️',
            'LOW': '📉', 'LIGHT': '💧'
        }.get(analysis['volume_status'], '❓')
        print(f"{volume_emoji} 成交量：{analysis['volume_status']}")
        
        # 价格状态
        price_emoji = {
            'STRONG_UP': '🚀', 'UP': '📈', 'SIDEWAY': '➡️',
            'DOWN': '📉', 'STRONG_DOWN': '💥'
        }.get(analysis['price_status'], '❓')
        print(f"{price_emoji} 价格：{analysis['price_status']}")
        
        # 量价信号
        vp_emoji = {
            'STRONG_BULL': '🟢', 'WEAK_BULL': '🟡', 'NEUTRAL': '⚪',
            'WEAK_BEAR': '🟠', 'STRONG_BEAR': '🔴'
        }.get(analysis['volume_price_signal'], '❓')
        print(f"{vp_emoji} 量价信号：{analysis['volume_price_signal']}")
        
        # 评分
        score_bar = '█' * max(0, analysis['score']) + '░' * max(0, -analysis['score'])
        print(f"\n📊 量价评分：{analysis['score']} [{score_bar}]")
        
        # 信号详情
        print(f"\n🔍 信号详情:")
        for signal in analysis['signals']:
            print(f"   • {signal}")
        
        # 背离检测
        if analysis['divergence']:
            if analysis['divergence'] == 'TOP_DIVERGENCE':
                print(f"\n🔴 顶背离警告：价格新高但量能不足")
            elif analysis['divergence'] == 'BOTTOM_DIVERGENCE':
                print(f"\n🟢 底背离信号：价格新低但放量")
        
        # 交易建议
        print(f"\n{'='*70}")
        print(f"💡 交易建议")
        print(f"{'='*70}")
        
        action_emoji = {
            'STRONG_BUY': '🚀', 'BUY': '📈', 'WAIT': '⏸️',
            'SELL': '📉', 'STRONG_SELL': '💥'
        }.get(recommendation['action'], '❓')
        
        print(f"{action_emoji} 动作：{recommendation['action']}")
        print(f"置信度：{recommendation['confidence']*100:.0f}%")
        print(f"建议杠杆：{recommendation['suggested_leverage']}x")
        print(f"原因：{recommendation['reason']}")
        print(f"量价权重：{recommendation['volume_price_weight']*100:.0f}%")
        
        # 量价关系速查表
        print(f"\n{'='*70}")
        print(f"📚 量价关系速查表")
        print(f"{'='*70}")
        print(f"放量上涨 → 强势看涨 ✅ (+4 分)")
        print(f"缩量上涨 → 可能见顶 ⚠️ (-2 分)")
        print(f"放量下跌 → 强势看跌 ✅ (+4 分做空)")
        print(f"缩量下跌 → 可能见底 ⚠️ (-2 分做空)")
        print(f"放量震荡 → 变盘前兆 🔍 (+2 分)")
        print(f"缩量震荡 → 继续观望 ⏸️ (0 分)")
        print(f"顶背离 → 反转信号 🔴 (-3 分)")
        print(f"底背离 → 反转信号 🟢 (+3 分)")
        
        print(f"\n{'='*70}\n")


if __name__ == "__main__":
    main()
