#!/usr/bin/env python3
"""
Telegram Alert Integration
Telegram 告警集成模块

功能:
- 发送交易信号告警
- 发送黑天鹅警报
- 发送每日总结
- 支持 Markdown 格式
"""

import json
import sys
import requests
from pathlib import Path
from datetime import datetime
from typing import Dict, Optional

class TelegramAlert:
    """Telegram 告警发送器"""
    
    def __init__(self, config_path: str = None):
        self.config = self._load_config(config_path)
        self.enabled = self.config.get('enabled', False)
        self.bot_token = self.config.get('bot_token', '')
        self.chat_id = self.config.get('chat_id', '')
        
        if self.enabled and self.bot_token and self.chat_id:
            print("✅ Telegram 告警已配置")
        else:
            print("⚠️  Telegram 告警未配置或未启用")
    
    def _load_config(self, config_path: str = None) -> Dict:
        """加载配置"""
        if config_path is None:
            config_path = Path(__file__).parent / 'telegram_config.json'
        
        if not Path(config_path).exists():
            return {'enabled': False}
        
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def send_message(self, message: str, parse_mode: str = 'HTML') -> bool:
        """发送消息"""
        if not self.enabled:
            print("⚠️  Telegram 未启用")
            return False
        
        if not self.bot_token or not self.chat_id:
            print("❌ Bot Token 或 Chat ID 未配置")
            return False
        
        url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
        
        data = {
            'chat_id': self.chat_id,
            'text': message,
            'parse_mode': parse_mode
        }
        
        try:
            response = requests.post(url, json=data, timeout=10)
            result = response.json()
            
            if result.get('ok'):
                print(f"✅ Telegram 消息发送成功")
                return True
            else:
                print(f"❌ Telegram 发送失败：{result.get('description')}")
                return False
                
        except Exception as e:
            print(f"❌ Telegram 发送异常：{e}")
            return False
    
    def send_trading_signal(self, signal: Dict) -> bool:
        """发送交易信号"""
        emoji = {
            'STRONG_BUY': '🚀',
            'BUY': '📈',
            'HOLD': '⏸️',
            'SELL': '📉',
            'STRONG_SELL': '💥'
        }.get(signal.get('signal', 'HOLD'), '📢')
        
        message = f"""
{emoji} <b>交易信号告警</b>

<b>币种:</b> {signal.get('symbol', 'N/A')}
<b>信号:</b> {signal.get('signal', 'N/A')}
<b>价格:</b> ${signal.get('price', 0):,.2f}
<b>置信度:</b> {signal.get('confidence', 0)*100:.0f}%
<b>仓位:</b> {signal.get('position_pct', 0)*100:.0f}%
<b>杠杆:</b> {signal.get('leverage', 0)}x
<b>止损:</b> ${signal.get('stop_loss', 0):,.2f}
<b>止盈:</b> ${signal.get('take_profit', 0):,.2f}

<b>原因:</b> {signal.get('reason', 'N/A')}

<b>时间:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""
        return self.send_message(message, parse_mode='HTML')
    
    def send_black_swan_alert(self, alert: Dict) -> bool:
        """发送黑天鹅警报"""
        message = f"""
🚨 <b>黑天鹅警报</b>

<b>级别:</b> {alert.get('level', 'N/A')}
<b>币种:</b> {alert.get('symbol', 'N/A')}
<b>价格:</b> ${alert.get('price', 0):,.2f}
<b>原因:</b> {alert.get('reason', 'N/A')}

<b>建议动作:</b> {alert.get('action', '立即清仓')}

<b>时间:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""
        return self.send_message(message, parse_mode='HTML')
    
    def send_daily_summary(self, summary: Dict) -> bool:
        """发送每日总结"""
        message = f"""
📊 <b>每日交易总结</b>

<b>日期:</b> {summary.get('date', datetime.now().strftime('%Y-%m-%d'))}
<b>交易次数:</b> {summary.get('trade_count', 0)}
<b>盈利交易:</b> {summary.get('winning_trades', 0)}
<b>亏损交易:</b> {summary.get('losing_trades', 0)}
<b>胜率:</b> {summary.get('win_rate', 0)*100:.1f}%

<b>总盈亏:</b> ${summary.get('total_pnl', 0):,.2f}
<b>总收益率:</b> {summary.get('total_return', 0)*100:.2f}%
<b>最大回撤:</b> {summary.get('max_drawdown', 0)*100:.2f}%

<b>当前资金:</b> ${summary.get('current_capital', 0):,.2f}
<b>目标进度:</b> {summary.get('target_progress', 0)*100:.1f}%

<b>时间:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""
        return self.send_message(message, parse_mode='HTML')
    
    def send_price_alert(self, symbol: str, price: float, 
                         change_pct: float, threshold: float) -> bool:
        """发送价格告警"""
        arrow = '📈' if change_pct > 0 else '📉'
        
        message = f"""
{arrow} <b>价格告警</b>

<b>币种:</b> {symbol}
<b>当前价格:</b> ${price:,.2f}
<b>变化:</b> {change_pct:+.2f}%
<b>阈值:</b> {threshold:.1f}%

<b>时间:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""
        return self.send_message(message, parse_mode='HTML')


    def send_system_alert(self, alert: dict) -> bool:
        """发送系统告警（V3 新增）"""
        message = f"🚨 <b>系统告警</b>\n\n"
        message += f"<b>类型:</b> {alert.get('type', 'unknown')}\n"
        message += f"<b>级别:</b> {alert.get('level', 'warning')}\n"
        message += f"<b>时间:</b> {alert.get('timestamp', '')}\n\n"
        message += f"{alert.get('message', '')}\n"
        if 'details' in alert:
            message += f"\n<i>详情: {alert['details']}</i>"
        return self.send_message(message)

# 使用示例
if __name__ == '__main__':
    print("="*70)
    print("📱 Telegram 告警测试")
    print("="*70)
    
    # 创建告警器
    alert = TelegramAlert()
    
    if not alert.enabled:
        print("\n⚠️  Telegram 未配置，请先配置 telegram_config.json")
        print("\n配置步骤:")
        print("1. 联系 @BotFather 创建 Bot")
        print("2. 获取 bot_token")
        print("3. 获取 chat_id")
        print("4. 编辑 telegram_config.json")
    else:
        # 测试消息
        print("\n发送测试消息...")
        alert.send_message("🐉 小龙智能交易系统告警测试")
        
        # 测试交易信号
        print("\n发送交易信号...")
        signal = {
            'symbol': 'BTC/USDT',
            'signal': 'STRONG_BUY',
            'price': 68500,
            'confidence': 0.85,
            'position_pct': 0.8,
            'leverage': 50,
            'stop_loss': 67815,
            'take_profit': 70555,
            'reason': '放量上涨 + EMA 多头 + RSI 超卖'
        }
        alert.send_trading_signal(signal)
    
    print("\n" + "="*70)
