#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
自动交易模块
检测交易信号并自动执行交易
"""

import json
import os
import time
from datetime import datetime
from pathlib import Path
import requests
from okx_api_client import OKXClient

class AutoTrader:
    """自动交易器"""
    
    def __init__(self, config_file=None):
        self.workspace = Path(__file__).parent
        
        # 加载配置
        if config_file is None:
            config_file = self.workspace / 'trader_config.json'
        
        self.config_file = config_file
        self.load_config()
        
        # 初始化 OKX 客户端
        self.client = OKXClient()
        
        # 交易记录
        self.trades_file = self.workspace / 'trades_history.json'
        self.trades_history = self.load_trades()
    
    def load_config(self):
        """加载交易配置"""
        if self.config_file.exists():
            with open(self.config_file, 'r', encoding='utf-8') as f:
                self.config = json.load(f)
        else:
            # 默认配置
            self.config = {
                'enabled': True,  # 是否启用自动交易
                'max_position_usd': 100,  # 最大仓位 (USD)
                'leverage': 20,  # 杠杆倍数
                'stop_loss_pct': 0.01,  # 止损 1%
                'take_profit_pct': 0.03,  # 止盈 3%
                'min_signal_confidence': 0.7,  # 最小信号置信度
                'max_trades_per_day': 10,  # 每日最大交易次数
                'symbols': []  # 允许交易的标的
            }
    
    def save_config(self):
        """保存交易配置"""
        with open(self.config_file, 'w', encoding='utf-8') as f:
            json.dump(self.config, f, indent=2, ensure_ascii=False)
    
    def load_trades(self):
        """加载交易历史"""
        if self.trades_file.exists():
            with open(self.trades_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return []
    
    def save_trades(self):
        """保存交易历史"""
        # 只保留最近 100 条
        self.trades_history = self.trades_history[-100:]
        with open(self.trades_file, 'w', encoding='utf-8') as f:
            json.dump(self.trades_history, f, indent=2, ensure_ascii=False)
    
    def check_daily_limit(self):
        """检查每日交易限制"""
        today = datetime.now().strftime('%Y-%m-%d')
        today_trades = [t for t in self.trades_history if t['date'] == today]
        return len(today_trades) < self.config['max_trades_per_day']
    
    def generate_signal(self, symbol, price_data):
        """生成交易信号"""
        # 简单策略：价格突破
        # TODO: 集成更复杂的策略
        
        current_price = price_data.get('current', 0)
        prev_price = price_data.get('prev', 0)
        
        if prev_price == 0:
            return None
        
        change_pct = (current_price - prev_price) / prev_price * 100
        
        # 买入信号：涨幅超过 1% 且置信度高
        if change_pct > 1.0:
            return {
                'action': 'BUY',
                'symbol': symbol,
                'confidence': min(change_pct / 3, 1.0),  # 置信度
                'reason': f'价格上涨 {change_pct:.2f}%'
            }
        
        # 卖出信号：跌幅超过 1%
        if change_pct < -1.0:
            return {
                'action': 'SELL',
                'symbol': symbol,
                'confidence': min(abs(change_pct) / 3, 1.0),
                'reason': f'价格下跌 {change_pct:.2f}%'
            }
        
        return None
    
    def execute_trade(self, signal, price):
        """执行交易"""
        if not self.config['enabled']:
            print(f"⚠️  自动交易未启用")
            return None
        
        # 检查每日限制
        if not self.check_daily_limit():
            print(f"⚠️  已达每日交易限制 ({self.config['max_trades_per_day']}次)")
            return None
        
        # 检查信号置信度
        if signal['confidence'] < self.config['min_signal_confidence']:
            print(f"⚠️  信号置信度不足 ({signal['confidence']:.2f} < {self.config['min_signal_confidence']})")
            return None
        
        # 计算仓位
        position_usd = self.config['max_position_usd']
        leverage = self.config['leverage']
        
        print(f"🚀 执行交易:")
        print(f"   标的：{signal['symbol']}")
        print(f"   方向：{signal['action']}")
        print(f"   价格：${price:.2f}")
        print(f"   仓位：${position_usd} ({leverage}x)")
        print(f"   止损：{self.config['stop_loss_pct']*100:.1f}%")
        print(f"   止盈：{self.config['take_profit_pct']*100:.1f}%")
        
        # TODO: 实际调用 OKX API 下单
        # order = self.client.create_order(...)
        
        # 记录交易
        trade_record = {
            'date': datetime.now().strftime('%Y-%m-%d'),
            'timestamp': datetime.now().isoformat(),
            'symbol': signal['symbol'],
            'action': signal['action'],
            'price': price,
            'position_usd': position_usd,
            'leverage': leverage,
            'stop_loss_pct': self.config['stop_loss_pct'],
            'take_profit_pct': self.config['take_profit_pct'],
            'signal_confidence': signal['confidence'],
            'signal_reason': signal['reason'],
            'status': 'pending'  # pending/filled/cancelled
        }
        
        self.trades_history.append(trade_record)
        self.save_trades()
        
        print(f"✅ 交易已记录")
        
        return trade_record
    
    def monitor_and_trade(self, symbols, prices):
        """监控标的并交易"""
        print()
        print("="*70)
        print("🤖 自动交易检测")
        print("="*70)
        
        if not self.config['enabled']:
            print("⚠️  自动交易未启用")
            return
        
        trades_executed = 0
        
        for symbol in symbols:
            if symbol not in prices:
                continue
            
            price_data = prices[symbol]
            signal = self.generate_signal(symbol, price_data)
            
            if signal:
                print()
                print(f"📊 检测到信号：{signal['symbol']}")
                print(f"   动作：{signal['action']}")
                print(f"   原因：{signal['reason']}")
                print(f"   置信度：{signal['confidence']*100:.1f}%")
                
                # 执行交易
                current_price = price_data.get('current', 0)
                if current_price > 0:
                    result = self.execute_trade(signal, current_price)
                    if result:
                        trades_executed += 1
        
        print()
        print(f"📊 本次检测执行交易：{trades_executed} 笔")
        print("="*70)

# 全局交易器实例
trader = AutoTrader()

if __name__ == '__main__':
    # 测试
    print("🔍 测试自动交易模块...")
    print()
    
    # 显示配置
    print("📋 当前配置:")
    print(f"   启用：{trader.config['enabled']}")
    print(f"   最大仓位：${trader.config['max_position_usd']}")
    print(f"   杠杆：{trader.config['leverage']}x")
    print(f"   止损：{trader.config['stop_loss_pct']*100:.1f}%")
    print(f"   止盈：{trader.config['take_profit_pct']*100:.1f}%")
    print(f"   最小置信度：{trader.config['min_signal_confidence']*100:.0f}%")
    print(f"   每日最大交易：{trader.config['max_trades_per_day']}次")
    print()
    
    # 测试信号生成
    print("📊 测试信号生成:")
    test_prices = {
        'BTC/USDT:USDT-SWAP': {'current': 70000, 'prev': 69000},  # +1.45%
        'ETH/USDT:USDT-SWAP': {'current': 2000, 'prev': 2050},  # -2.44%
    }
    
    for symbol, price_data in test_prices.items():
        signal = trader.generate_signal(symbol, price_data)
        if signal:
            print(f"   ✅ {signal['symbol']}: {signal['action']} ({signal['reason']})")
        else:
            print(f"   ⏸️ {symbol}: 无信号")
    
    print()
    print("✅ 测试完成！")
