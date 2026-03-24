#!/usr/bin/env python3
"""
Telegram 告警机器人
Telegram Alert Bot for OpenClaw
"""

import json
import requests
from datetime import datetime
from typing import Dict, Optional


class TelegramAlertBot:
    """Telegram 告警机器人"""
    
    def __init__(self, bot_token: str, chat_id: str):
        self.bot_token = bot_token
        self.chat_id = chat_id
        self.base_url = f"https://api.telegram.org/bot{bot_token}"
    
    def send_message(self, message: str) -> bool:
        """发送消息到 Telegram"""
        url = f"{self.base_url}/sendMessage"
        
        payload = {
            "chat_id": self.chat_id,
            "text": message,
            "parse_mode": "HTML"
        }
        
        try:
            response = requests.post(url, json=payload, timeout=10)
            result = response.json()
            
            if result.get("ok"):
                print(f"✅ Telegram 消息发送成功")
                return True
            else:
                print(f"❌ Telegram 发送失败: {result.get('description')}")
                return False
                
        except Exception as e:
            print(f"❌ Telegram 请求异常: {e}")
            return False
    
    def send_alert(self, alert_level: str, rule_name: str, 
                   message: str, suggestion: str, stats: Optional[Dict] = None):
        """发送格式化的告警消息"""
        
        emoji = "🔴" if alert_level == "CRITICAL" else "🟡"
        
        # 构建消息
        text = f"""{emoji} <b>OpenClaw 告警 [{alert_level}]</b>

<b>规则:</b> {rule_name}
<b>时间:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
<b>详情:</b> {message}
<b>建议:</b> {suggestion}
"""
        
        # 添加统计信息（如果有）
        if stats:
            text += f"\n<b>统计:</b>\n"
            for key, value in stats.items():
                if isinstance(value, float):
                    text += f"  • {key}: {value:.2%}\n" if value < 1 else f"  • {key}: {value:.2f}\n"
                else:
                    text += f"  • {key}: {value}\n"
        
        text += f"\n<b>当前状态:</b> {'需立即处理' if alert_level == 'CRITICAL' else '需关注，请观察趋势'}"
        
        return self.send_message(text)
    
    def send_daily_report(self, report: Dict):
        """发送每日报告"""
        
        summary = report.get('summary', {})
        
        text = f"""📊 <b>OpenClaw 每日报告</b>

<b>总体统计</b>
  • 总请求: {summary.get('total_requests', 0)}
  • 成功: {summary.get('success', 0)} ({summary.get('success_rate', 0):.1%})
  • 超时: {summary.get('timeout', 0)}
  • 失败: {summary.get('failed', 0)}
  • 平均耗时: {summary.get('avg_duration_ms', 0):.0f}ms

<b>模型性能 Top 3</b>
"""
        
        # 添加最慢模型
        slowest = report.get('model_performance', {}).get('slowest_models', [])
        for i, model in enumerate(slowest[:3], 1):
            text += f"  {i}. {model['model'][:20]}: {model['avg_duration_ms']:.0f}ms\n"
        
        # 添加关键问题
        issues = report.get('top_issues', [])
        if issues:
            text += f"\n<b>⚠️ 关键问题</b>\n"
            for issue in issues[:3]:
                emoji = "🔴" if issue['severity'] == 'high' else "🟡"
                text += f"  {emoji} [{issue['model']}] {issue['issue']}\n"
        else:
            text += f"\n<b>✅ 系统健康</b>\n  未发现关键问题\n"
        
        text += f"\n<i>生成时间: {report.get('generated_at', datetime.now().isoformat())}</i>"
        
        return self.send_message(text)
    
    def test_connection(self) -> bool:
        """测试连接"""
        url = f"{self.base_url}/getMe"
        
        try:
            response = requests.get(url, timeout=10)
            result = response.json()
            
            if result.get("ok"):
                bot_info = result.get("result", {})
                print(f"✅ Telegram Bot 连接成功")
                print(f"   Bot 名称: {bot_info.get('first_name')}")
                print(f"   Bot 用户名: @{bot_info.get('username')}")
                return True
            else:
                print(f"❌ Telegram Bot 连接失败: {result.get('description')}")
                return False
                
        except Exception as e:
            print(f"❌ Telegram 连接异常: {e}")
            return False


# 集成到告警系统
def create_telegram_notifier(bot_token: str, chat_id: str):
    """创建 Telegram 通知器"""
    bot = TelegramAlertBot(bot_token, chat_id)
    
    def notifier(alert):
        """适配 Alert 对象的通知函数"""
        bot.send_alert(
            alert_level=alert.level.value.upper(),
            rule_name=alert.rule_name,
            message=alert.message,
            suggestion=alert.details.get('suggestion', 'N/A'),
            stats=alert.details.get('stats')
        )
    
    return notifier


if __name__ == "__main__":
    # 测试 Telegram Bot
    print("测试 Telegram 告警机器人...")
    
    # 注意：需要替换为实际的 bot_token 和 chat_id
    BOT_TOKEN = "YOUR_BOT_TOKEN_HERE"
    CHAT_ID = "YOUR_CHAT_ID_HERE"
    
    if BOT_TOKEN == "YOUR_BOT_TOKEN_HERE":
        print("⚠️ 请配置 BOT_TOKEN 和 CHAT_ID 后再测试")
        print("获取方式:")
        print("1. 在 Telegram 找 @BotFather 创建 bot，获取 token")
        print("2. 找 @userinfobot 获取自己的 chat_id")
    else:
        bot = TelegramAlertBot(BOT_TOKEN, CHAT_ID)
        
        # 测试连接
        if bot.test_connection():
            # 测试告警
            bot.send_alert(
                alert_level="WARNING",
                rule_name="测试告警",
                message="这是一条测试告警消息",
                suggestion="请忽略此测试消息"
            )