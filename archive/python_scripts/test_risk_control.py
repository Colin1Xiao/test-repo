#!/usr/bin/env python3
"""
测试风控功能
"""

import json
import tempfile
from datetime import datetime, timedelta
from okx_api_integration_v2 import OKXAPIClientV2


def test_weekly_monthly_limits():
    """测试周限额和月限额功能"""
    print("🧪 测试周限额和月限额功能")
    print("-" * 50)
    
    # 创建临时配置文件
    temp_config = {
        "okx": {
            "api_key": "test_key",
            "secret_key": "test_secret",
            "passphrase": "test_pass",
            "testnet": True,
            "permissions": ["read", "trade"],
            "max_position": 0.2,
            "max_leverage": 5,
            "stop_loss": 0.02,
            "daily_limit": 500,
            "weekly_limit": 2000,
            "monthly_limit": 8000,
            "max_drawdown": 0.1
        }
    }
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump(temp_config, f)
        config_path = f.name
    
    # 创建客户端
    client = OKXAPIClientV2(config_path)
    
    # 模拟历史交易数据
    today = datetime.now()
    last_week = today - timedelta(days=7)
    last_month = today - timedelta(days=30)
    
    # 添加一些历史交易来测试限额
    client.weekly_trades = [
        {'date': last_week.date().isoformat(), 'symbol': 'BTC/USDT', 'side': 'buy', 'amount': 400},
        {'date': (last_week + timedelta(days=1)).date().isoformat(), 'symbol': 'ETH/USDT', 'side': 'buy', 'amount': 500},
        {'date': (last_week + timedelta(days=2)).date().isoformat(), 'symbol': 'BTC/USDT', 'side': 'sell', 'amount': 300}
    ]
    
    client.monthly_trades = [
        {'date': last_month.date().isoformat(), 'symbol': 'BTC/USDT', 'side': 'buy', 'amount': 1000},
        {'date': (last_month + timedelta(days=5)).date().isoformat(), 'symbol': 'ETH/USDT', 'side': 'buy', 'amount': 1500},
        {'date': (last_month + timedelta(days=10)).date().isoformat(), 'symbol': 'BTC/USDT', 'side': 'sell', 'amount': 800}
    ]
    
    # 测试周限额检查
    print(f"当前周交易总额: ${client._get_weekly_volume():.2f}")
    print(f"周限额: ${client.weekly_limit}")
    print(f"周限额检查结果: {client._check_weekly_limit(600)} (尝试交易600美元)")
    
    # 测试月限额检查
    print(f"当前月交易总额: ${client._get_monthly_volume():.2f}")
    print(f"月限额: ${client.monthly_limit}")
    print(f"月限额检查结果: {client._check_monthly_limit(2000)} (尝试交易2000美元)")
    
    print()


def test_drawdown_protection():
    """测试回撤保护功能"""
    print("🧪 测试回撤保护功能")
    print("-" * 50)
    
    # 创建临时配置文件
    temp_config = {
        "okx": {
            "api_key": "test_key",
            "secret_key": "test_secret",
            "passphrase": "test_pass",
            "testnet": True,
            "permissions": ["read", "trade"],
            "max_position": 0.2,
            "max_leverage": 5,
            "stop_loss": 0.02,
            "daily_limit": 500,
            "weekly_limit": 2000,
            "monthly_limit": 8000,
            "max_drawdown": 0.1
        }
    }
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump(temp_config, f)
        config_path = f.name
    
    # 创建客户端
    client = OKXAPIClientV2(config_path)
    
    # 设置初始账户价值和当前亏损
    client.initial_account_value = 10000  # 初始10000美元
    client.current_pnl = -1500  # 当前亏损1500美元
    
    print(f"初始账户价值: ${client.initial_account_value}")
    print(f"当前盈亏: ${client.current_pnl}")
    print(f"回撤率: {(abs(client.current_pnl) / client.initial_account_value)*100:.2f}%")
    print(f"最大允许回撤: {client.max_drawdown*100:.2f}%")
    print(f"回撤保护检查结果: {client._check_drawdown_limit()} (应为False，因为回撤超过10%)")
    
    # 测试未触发回撤保护的情况
    client.current_pnl = -500  # 当前亏损500美元
    print(f"\n修改后盈亏: ${client.current_pnl}")
    print(f"回撤率: {(abs(client.current_pnl) / client.initial_account_value)*100:.2f}%")
    print(f"回撤保护检查结果: {client._check_drawdown_limit()} (应为True，因为回撤未超过10%)")
    
    print()


def test_cool_down_period():
    """测试冷却期功能"""
    print("🧪 测试冷却期功能")
    print("-" * 50)
    
    # 创建临时配置文件
    temp_config = {
        "okx": {
            "api_key": "test_key",
            "secret_key": "test_secret",
            "passphrase": "test_pass",
            "testnet": True,
            "permissions": ["read", "trade"],
            "max_position": 0.2,
            "max_leverage": 5,
            "stop_loss": 0.02,
            "daily_limit": 500,
            "weekly_limit": 2000,
            "monthly_limit": 8000,
            "max_drawdown": 0.1
        }
    }
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump(temp_config, f)
        config_path = f.name
    
    # 创建客户端
    client = OKXAPIClientV2(config_path)
    
    # 模拟触发了冷却期
    client.cool_down_until = datetime.now() + timedelta(hours=23)  # 23小时后解除
    print(f"冷却期至: {client.cool_down_until}")
    print(f"当前时间: {datetime.now()}")
    print(f"交易许可检查: {client._check_trade_permission()} (应为False)")
    
    # 模拟冷却期已过
    client.cool_down_until = datetime.now() - timedelta(minutes=1)  # 1分钟前已结束
    print(f"\n冷却期至: {client.cool_down_until}")
    print(f"当前时间: {datetime.now()}")
    print(f"交易许可检查: {client._check_trade_permission()} (应为True)")
    
    print()


if __name__ == "__main__":
    print("🧪 开始测试风控功能")
    print("=" * 70)
    
    test_weekly_monthly_limits()
    test_drawdown_protection()
    test_cool_down_period()
    
    print("✅ 所有测试完成！")