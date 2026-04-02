#!/usr/local/bin/python3.14
"""
OKX 实盘 API 连接测试

验证实盘 API 配置是否正确
"""

import sys
import json
from pathlib import Path
from decimal import Decimal

sys.path.insert(0, str(Path(__file__).parent.parent))

from connectors.okx.trade_client_real import OKXTradeClientReal, OKXConfig, OKXEnv


def test_live_connection():
    """测试实盘连接"""
    print("=" * 60)
    print("🔍 OKX 实盘 API 连接测试")
    print("=" * 60)
    print()
    
    # 加载配置
    config_path = Path(__file__).parent.parent / "tests" / "config" / "okx_live.json"
    
    if not config_path.exists():
        print(f"❌ 配置文件不存在：{config_path}")
        return False
    
    with open(config_path, 'r') as f:
        config_data = json.load(f)
    
    print(f"📄 配置文件：{config_path}")
    print(f"模式：{config_data.get('_mode', 'unknown')}")
    print(f"⚠️  {config_data.get('_risk_warning', '')}")
    print()
    
    # 创建配置
    config = OKXConfig(
        api_key=config_data["api_key"],
        secret_key=config_data["secret_key"],
        passphrase=config_data["passphrase"],
        environment=OKXEnv.LIVE,
    )
    
    # 创建客户端
    client = OKXTradeClientReal(config)
    
    # 测试连接
    print("[1/6] 连接 OKX 实盘...")
    if client.connect():
        print("✅ 连接成功")
    else:
        print("❌ 连接失败")
        return False
    
    # 获取服务器时间
    print("\n[2/6] 获取服务器时间...")
    ts = client.get_server_time()
    if ts:
        print(f"✅ 服务器时间：{ts}")
    else:
        print("❌ 获取失败")
    
    # 获取余额
    print("\n[3/6] 获取余额...")
    balances = client.get_balance()
    if balances:
        print("✅ 余额:")
        for currency, amount in balances.items():
            if amount > 0:
                print(f"   {currency}: {amount}")
    else:
        print("❌ 获取失败")
    
    # 获取仓位
    print("\n[4/6] 获取仓位...")
    positions = client.get_positions()
    print(f"✅ 仓位：{len(positions)} 个")
    for pos in positions[:5]:
        print(f"   - {pos.get('instId')}: {pos.get('pos')} {pos.get('posSide')}")
    
    # 获取行情
    print("\n[5/6] 获取行情...")
    tickers = client.get_tickers("SWAP")
    if tickers:
        print(f"✅ 行情：{len(tickers)} 个交易对")
        eth = next((t for t in tickers if 'ETH' in t.get('instId')), None)
        if eth:
            print(f"   ETH: {eth.get('last')} USDT (24h 涨跌：{eth.get('chg24h')})")
    else:
        print("❌ 获取失败")
    
    # 风险检查
    print("\n[6/6] 风险检查...")
    usdt_balance = balances.get('USDT', Decimal('0'))
    print(f"   USDT 余额：{usdt_balance}")
    
    if usdt_balance < Decimal('10'):
        print("   ⚠️  余额较低，建议充值后再测试")
    elif usdt_balance < Decimal('100'):
        print("   ⚠️  余额适中，请小额测试")
    else:
        print("   ✅ 余额充足")
    
    # 断开连接
    client.disconnect()
    
    print()
    print("=" * 60)
    print("✅ OKX 实盘 API 测试完成！")
    print("=" * 60)
    
    return True


if __name__ == "__main__":
    success = test_live_connection()
    sys.exit(0 if success else 1)
