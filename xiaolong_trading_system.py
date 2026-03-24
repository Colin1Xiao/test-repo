#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🐉 小龙智能交易系统 V1.0
整合版智能交易系统
- 动态标的管理 (最多 20 个)
- 实时监控 (60 秒)
- 自动交易 (可选)
- 风险控制
- Notion 同步
- Telegram 告警
"""

import os
import sys
import json
import time
from datetime import datetime, timedelta
from pathlib import Path

# 添加路径
sys.path.insert(0, str(Path(__file__).parent))

# 导入模块
from dynamic_symbols_manager_v3 import DynamicSymbolsManager
from okx_api_client import OKXClient
from auto_trader import AutoTrader

# 设置代理
os.environ['https_proxy'] = 'http://127.0.0.1:7890'
os.environ['http_proxy'] = 'http://127.0.0.1:7890'

class XiaolongTradingSystem:
    """小龙智能交易系统"""
    
    def __init__(self, config_file=None):
        self.workspace = Path(__file__).parent
        
        # 加载配置
        if config_file is None:
            config_file = self.workspace / 'xiaolong_config.json'
        
        self.config_file = config_file
        self.config = self.load_config()
        
        # 初始化模块
        print("🔧 初始化系统模块...")
        self.symbols_manager = DynamicSymbolsManager()
        self.okx_client = OKXClient()
        self.trader = AutoTrader(self.config_file)
        
        # 状态
        self.last_symbols_update = None
        self.last_prices = {}
        self.check_count = 0
        self.symbols_update_count = 0
        self.trades_count = 0
        self.start_time = datetime.now()
        
        # 日志文件
        self.log_file = self.workspace / 'xiaolong_system.log'
        
        print("✅ 系统初始化完成")
        print()
    
    def load_config(self):
        """加载系统配置"""
        config_file = Path(__file__).parent / 'xiaolong_config.json'
        
        if config_file.exists():
            with open(config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        else:
            # 默认配置
            return {
                'system_name': '小龙智能交易系统',
                'version': '1.0',
                'monitoring': {
                    'enabled': True,
                    'check_interval': 60,  # 60 秒
                    'max_symbols': 20,  # 最多 20 个标的
                    'update_interval': 3600,  # 1 小时更新标的
                    'price_alert_threshold': 0.1,  # 0.1% 显示
                    'volatility_alert_threshold': 1.0,  # 1% 告警
                },
                'trading': {
                    'enabled': False,  # 默认禁用自动交易
                    'max_position_usd': 50,
                    'leverage': 10,
                    'stop_loss_pct': 0.005,
                    'take_profit_pct': 0.015,
                    'min_signal_confidence': 0.7,
                    'max_trades_per_day': 5,
                },
                'notification': {
                    'telegram_enabled': False,
                    'notion_enabled': False,
                }
            }
    
    def save_config(self):
        """保存系统配置"""
        with open(self.config_file, 'w', encoding='utf-8') as f:
            json.dump(self.config, f, indent=2, ensure_ascii=False)
    
    def log(self, message, level='INFO'):
        """日志记录"""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        emoji = {
            'INFO': 'ℹ️',
            'SUCCESS': '✅',
            'WARNING': '⚠️',
            'ERROR': '❌',
            'TRADE': '💰',
            'ALERT': '🚨'
        }.get(level, 'ℹ️')
        
        log_msg = f"[{timestamp}] {emoji} [{level}] {message}"
        print(log_msg)
        
        # 写入日志文件
        with open(self.log_file, 'a', encoding='utf-8') as f:
            f.write(log_msg + '\n')
    
    def update_symbols(self):
        """更新监控标的"""
        self.log("更新监控标的...", 'INFO')
        symbols = self.symbols_manager.update_symbols()
        self.last_symbols_update = datetime.now()
        self.symbols_update_count += 1
        self.log(f"监控标的更新完成：{len(symbols)}个", 'SUCCESS')
        return symbols
    
    def check_prices(self, symbols):
        """检查价格并检测信号"""
        current_prices = {}
        
        for symbol in symbols:
            try:
                # 转换标的格式 (OKX API 需要 SWAP 后缀)
                if symbol.endswith('-SWAP'):
                    okx_symbol = symbol
                elif '/USDT:USDT' in symbol:
                    okx_symbol = symbol.replace('/USDT:USDT', '-USDT-SWAP')
                else:
                    okx_symbol = symbol + '-SWAP'
                
                result = self.okx_client.fetch_ticker(okx_symbol)
                
                if result['success']:
                    ticker = result['data'][0]
                    price = float(ticker['last'])
                    current_prices[symbol] = price
                    
                    # 计算变化
                    if symbol in self.last_prices:
                        change = (price - self.last_prices[symbol]) / self.last_prices[symbol] * 100
                        
                        # 显示价格
                        if abs(change) >= self.config['monitoring']['price_alert_threshold']:
                            arrow = "📈" if change > 0 else "📉"
                            display_name = symbol.replace('/USDT:USDT', '').replace('-SWAP', '')
                            self.log(f"{display_name}: ${price:,.2f} ({change:+.2f}%)", 'INFO')
                            
                            # 大幅波动告警
                            if abs(change) >= self.config['monitoring']['volatility_alert_threshold']:
                                signal = "BUY" if change > 0 else "SELL"
                                self.log(f"{symbol} 大幅波动！{signal}信号 ({change:+.2f}%)", 'ALERT')
                    else:
                        display_name = symbol.replace('/USDT:USDT', '').replace('-SWAP', '')
                        self.log(f"{display_name}: ${price:,.2f}", 'INFO')
                    
                    self.last_prices[symbol] = price
                else:
                    self.log(f"{symbol}: {result['error']}", 'WARNING')
                    
            except Exception as e:
                self.log(f"{symbol}: {str(e)[:50]}", 'ERROR')
        
        return current_prices
    
    def auto_trade(self, symbols, prices):
        """自动交易"""
        if not self.config['trading']['enabled']:
            return
        
        # 准备价格数据
        price_data = {}
        for symbol in symbols:
            if symbol in self.last_prices and symbol in prices:
                price_data[symbol] = {
                    'current': prices[symbol],
                    'prev': self.last_prices[symbol]
                }
        
        # 检测并执行交易
        if price_data:
            self.trader.monitor_and_trade(symbols, price_data)
            self.trades_count += 1
    
    def show_status(self):
        """显示系统状态"""
        print()
        print("="*70)
        print("📊 小龙智能交易系统 - 运行状态")
        print("="*70)
        print(f"   系统版本：{self.config['version']}")
        print(f"   运行时间：{datetime.now() - self.start_time}")
        print(f"   检查次数：{self.check_count}")
        print(f"   标的更新：{self.symbols_update_count}次")
        print(f"   监控标的：{len(self.last_prices)}个")
        print(f"   交易次数：{self.trades_count}")
        print()
        print(f"   监控：{'✅ 启用' if self.config['monitoring']['enabled'] else '❌ 禁用'}")
        print(f"   交易：{'✅ 启用' if self.config['trading']['enabled'] else '❌ 禁用'}")
        print(f"   Telegram: {'✅ 启用' if self.config['notification']['telegram_enabled'] else '❌ 禁用'}")
        print(f"   Notion: {'✅ 启用' if self.config['notification']['notion_enabled'] else '❌ 禁用'}")
        print("="*70)
        print()
    
    def run(self):
        """运行系统"""
        self.log("="*70, 'INFO')
        self.log("🐉 小龙智能交易系统启动", 'SUCCESS')
        self.log("="*70, 'INFO')
        self.log(f"系统版本：{self.config['version']}", 'INFO')
        self.log(f"监控间隔：{self.config['monitoring']['check_interval']}秒", 'INFO')
        self.log(f"自动交易：{'启用' if self.config['trading']['enabled'] else '禁用'}", 'INFO')
        self.log("="*70, 'INFO')
        print()
        
        # 首次更新标的
        symbols = self.update_symbols()
        print()
        
        # 主循环
        while True:
            try:
                self.check_count += 1
                
                # 检查是否需要更新标的
                if self.last_symbols_update is None or \
                   (datetime.now() - self.last_symbols_update) > timedelta(seconds=self.config['monitoring']['update_interval']):
                    symbols = self.update_symbols()
                    print()
                
                # 检查价格
                prices = self.check_prices(symbols)
                
                # 自动交易
                if self.config['trading']['enabled']:
                    self.auto_trade(symbols, prices)
                
                # 显示状态 (每 10 次)
                if self.check_count % 10 == 0:
                    self.show_status()
                
                # 等待
                time.sleep(self.config['monitoring']['check_interval'])
                
            except KeyboardInterrupt:
                print()
                self.log("⛔ 系统已停止", 'WARNING')
                self.show_status()
                break
            except Exception as e:
                self.log(f"系统错误：{e}", 'ERROR')
                time.sleep(10)

# 主函数
def main():
    """主函数"""
    # 创建系统
    system = XiaolongTradingSystem()
    
    # 显示配置
    print()
    print("="*70)
    print("⚙️ 系统配置")
    print("="*70)
    print(f"   监控间隔：{system.config['monitoring']['check_interval']}秒")
    print(f"   最大标的：{system.config['monitoring']['max_symbols']}个")
    print(f"   自动交易：{system.config['trading']['enabled']}")
    print(f"   最大仓位：${system.config['trading']['max_position_usd']}")
    print(f"   杠杆：{system.config['trading']['leverage']}x")
    print(f"   止损：{system.config['trading']['stop_loss_pct']*100:.2f}%")
    print(f"   止盈：{system.config['trading']['take_profit_pct']*100:.2f}%")
    print("="*70)
    print()
    
    # 运行系统
    system.run()

if __name__ == '__main__':
    main()
