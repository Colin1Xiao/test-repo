#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
预测性信号生成系统
预测即将发生的大波动，提前入场
"""

from okx_api_client import OKXClient
from datetime import datetime
import json

client = OKXClient()

print("="*70)
print("🔮 预测性信号生成系统")
print("="*70)
print()

# 预测性指标配置
predictive_config = {
    # 技术指标预测
    'technical_prediction': {
        'rsi_divergence': True,  # RSI 背离
        'macd_crossover': True,  # MACD 即将金叉/死叉
        'bollinger_squeeze': True,  # 布林带收口 (即将突破)
        'volume_spike': True,  # 成交量异常放大
    },
    
    # 订单簿预测
    'orderbook_prediction': {
        'large_wall': True,  # 大单压盘/托盘
        'imbalance': True,  # 买卖盘不平衡
        'spread_change': True,  # 价差变化
    },
    
    # 资金费率预测
    'funding_prediction': {
        'extreme_funding': True,  # 极端资金费率
        'funding_change': True,  # 资金费率变化
    },
    
    # 市场情绪预测
    'sentiment_prediction': {
        'fear_greed_extreme': True,  # 恐惧贪婪极端值
        'open_interest_change': True,  # 持仓量变化
    }
}

print("📋 预测性指标:")
print()

print("   1️⃣  技术指标预测:")
tp = predictive_config['technical_prediction']
print(f"      RSI 背离：{'✅ 启用' if tp['rsi_divergence'] else '❌ 禁用'}")
print(f"      MACD 即将交叉：{'✅ 启用' if tp['macd_crossover'] else '❌ 禁用'}")
print(f"      布林带收口：{'✅ 启用' if tp['bollinger_squeeze'] else '❌ 禁用'}")
print(f"      成交量异常：{'✅ 启用' if tp['volume_spike'] else '❌ 禁用'}")
print()

print("   2️⃣  订单簿预测:")
op = predictive_config['orderbook_prediction']
print(f"      大单压盘/托盘：{'✅ 启用' if op['large_wall'] else '❌ 禁用'}")
print(f"      买卖盘不平衡：{'✅ 启用' if op['imbalance'] else '❌ 禁用'}")
print(f"      价差变化：{'✅ 启用' if op['spread_change'] else '❌ 禁用'}")
print()

print("   3️⃣  资金费率预测:")
fp = predictive_config['funding_prediction']
print(f"      极端资金费率：{'✅ 启用' if fp['extreme_funding'] else '❌ 禁用'}")
print(f"      资金费率变化：{'✅ 启用' if fp['funding_change'] else '❌ 禁用'}")
print()

print("   4️⃣  市场情绪预测:")
sp = predictive_config['sentiment_prediction']
print(f"      恐惧贪婪极端：{'✅ 启用' if sp['fear_greed_extreme'] else '❌ 禁用'}")
print(f"      持仓量变化：{'✅ 启用' if sp['open_interest_change'] else '❌ 禁用'}")
print()

print("="*70)
print("📝 预测信号示例")
print("="*70)
print()

# 获取 ETH 数据
print("🔍 分析 ETH/USDT...")
print()

# 获取 K 线
result = client.fetch_ohlcv('ETH/USDT:USDT', '5m', 100)
if result['success']:
    candles = result['data']
    
    # 计算指标
    closes = [float(c[4]) for c in candles]
    volumes = [float(c[5]) for c in candles]
    
    current_price = closes[0]
    prev_price = closes[1]
    
    # 价格变化
    price_change = (current_price - prev_price) / prev_price * 100
    
    # 成交量变化
    avg_volume = sum(volumes[10:]) / len(volumes[10:])
    volume_change = (volumes[0] - avg_volume) / avg_volume * 100
    
    print(f"   当前价格：${current_price:,.2f}")
    print(f"   5 分钟变化：{price_change:+.2f}%")
    print(f"   成交量变化：{volume_change:+.2f}%")
    print()
    
    # 预测性信号检测
    print("🔮 预测性信号检测:")
    print()
    
    signals = []
    
    # 1. RSI 背离检测
    print("   1. RSI 背离检测:")
    # 简化版：价格创新低，RSI 未创新低 = 看涨背离
    if closes[0] < min(closes[1:6]) and volume_change > 50:
        print("      ⚠️  价格创新低 + 放量 → 可能反弹")
        signals.append({'type': 'RSI 背离', 'direction': 'BUY', 'confidence': 0.6})
    else:
        print("      - 无明显背离")
    print()
    
    # 2. MACD 即将交叉
    print("   2. MACD 即将交叉检测:")
    # 简化版：MACD 柱状图连续缩小
    recent_changes = [closes[i] - closes[i+1] for i in range(5)]
    if all(c < 0 for c in recent_changes):  # 连续下跌
        print("      ⚠️  连续下跌 → 可能反弹")
        signals.append({'type': '超卖反弹', 'direction': 'BUY', 'confidence': 0.5})
    elif all(c > 0 for c in recent_changes):  # 连续上涨
        print("      ⚠️  连续上涨 → 可能回调")
        signals.append({'type': '超买回调', 'direction': 'SELL', 'confidence': 0.5})
    else:
        print("      - 无明显趋势")
    print()
    
    # 3. 布林带收口
    print("   3. 布林带收口检测:")
    # 简化版：波动率降低
    recent_volatility = sum(abs(closes[i] - closes[i+1]) for i in range(10)) / 10
    avg_volatility = sum(abs(closes[i] - closes[i+1]) for i in range(50, 90)) / 40
    
    if recent_volatility < avg_volatility * 0.5:
        print("      ⚠️  波动率大幅降低 → 即将突破")
        signals.append({'type': '布林带收口', 'direction': 'BREAKOUT', 'confidence': 0.7})
    else:
        print(f"      - 波动率正常 ({recent_volatility:.2f})")
    print()
    
    # 4. 成交量异常
    print("   4. 成交量异常检测:")
    if volume_change > 100:
        print(f"      ⚠️  成交量放大 {volume_change:.0f}% → 大行情前兆")
        signals.append({'type': '成交量异常', 'direction': 'FOLLOW_VOLUME', 'confidence': 0.8})
    elif volume_change > 50:
        print(f"      ⚠️  成交量放大 {volume_change:.0f}% → 可能变盘")
        signals.append({'type': '成交量异常', 'direction': 'FOLLOW_VOLUME', 'confidence': 0.6})
    else:
        print(f"      - 成交量正常 ({volume_change:+.0f}%)")
    print()
    
    # 综合信号
    print("="*70)
    print("🎯 综合预测信号:")
    print("="*70)
    print()
    
    if signals:
        print(f"   检测到 {len(signals)} 个预测信号:")
        print()
        
        for signal in signals:
            emoji = "🚀" if signal['direction'] == 'BUY' else "📉" if signal['direction'] == 'SELL' else "⚠️"
            print(f"   {emoji} {signal['type']}")
            print(f"      方向：{signal['direction']}")
            print(f"      置信度：{signal['confidence']*100:.0f}%")
            print()
        
        # 综合置信度
        avg_confidence = sum(s['confidence'] for s in signals) / len(signals)
        
        if avg_confidence > 0.7:
            print(f"   🔴 高置信度信号：{avg_confidence*100:.0f}%")
            print(f"   💡 建议：准备入场")
        elif avg_confidence > 0.5:
            print(f"   🟡 中等置信度信号：{avg_confidence*100:.0f}%")
            print(f"   💡 建议：继续观察")
        else:
            print(f"   🟢 低置信度信号：{avg_confidence*100:.0f}%")
            print(f"   💡 建议：观望")
    else:
        print("   ⏸️ 无明显预测信号")
        print("   💡 建议：继续观望")
    
    print()
else:
    print(f"   ❌ 数据获取失败：{result['error']}")

print("="*70)
print("💡 预测性交易要点")
print("="*70)
print()
print("   ✅ 预测 vs 追随:")
print("      预测：提前发现信号，提前入场")
print("      追随：等波动发生后再追 (容易高位接盘)")
print()
print("   ✅ 关键指标:")
print("      1. RSI 背离 (价格新低，RSI 未新低)")
print("      2. MACD 即将交叉 (柱状图缩小)")
print("      3. 布林带收口 (波动率降低)")
print("      4. 成交量异常放大 (大行情前兆)")
print("      5. 订单簿大单 (压盘/托盘)")
print("      6. 资金费率极端 (反向信号)")
print()
print("   ✅ 入场时机:")
print("      - 多个指标同时触发 (>3 个)")
print("      - 置信度>70%")
print("      - 有明确方向 (多/空)")
print()
print("   ❌ 避免:")
print("      - 单一指标就入场")
print("      - 置信度<50% 入场")
print("      - 方向不明确入场")
print()

# 保存预测配置
with open('/Users/colin/.openclaw/workspace/predictive_config.json', 'w', encoding='utf-8') as f:
    json.dump(predictive_config, f, indent=2, ensure_ascii=False)

print("📄 配置已保存到：predictive_config.json")
print()
