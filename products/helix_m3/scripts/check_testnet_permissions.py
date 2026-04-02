#!/usr/local/bin/python3.14
"""
OKX Testnet 权限检查

诊断 Testnet API Key 权限问题
"""

import sys
import json
from pathlib import Path
from decimal import Decimal

sys.path.insert(0, str(Path(__file__).parent.parent))

from connectors.okx.trade_client_real import OKXTradeClientReal, OKXConfig, OKXEnv


def check_testnet_permissions():
    """检查 Testnet 权限"""
    print("=" * 60)
    print("🔍 OKX Testnet 权限检查")
    print("=" * 60)
    print()
    
    # 加载配置
    config_path = Path(__file__).parent.parent / "tests" / "config" / "okx_testnet.json"
    
    with open(config_path, 'r') as f:
        config_data = json.load(f)
    
    print(f"📄 配置文件：{config_path}")
    print(f"API Key: {config_data['api_key'][:20]}...")
    print()
    
    # 创建客户端
    config = OKXConfig(
        api_key=config_data["api_key"],
        secret_key=config_data["secret_key"],
        passphrase=config_data["passphrase"],
        environment=OKXEnv.TESTNET,
    )
    
    client = OKXTradeClientReal(config)
    
    # 连接
    print("[1/6] 连接 OKX Testnet...")
    if not client.connect():
        print("❌ 连接失败")
        return False
    print("✅ 连接成功")
    
    # 检查账户配置
    print("\n[2/6] 检查账户配置...")
    response = client._request("GET", "/api/v5/account/config")
    if response.get("code") == "0":
        config_info = response.get("data", [{}])[0]
        print(f"✅ 账户等级：{config_info.get('acctLv')}")
        print(f"   仓位模式：{config_info.get('posMode')}")
        print(f"   借币模式：{config_info.get('autoLoan')}")
    else:
        print(f"❌ 获取失败：{response.get('msg')}")
        return False
    
    # 检查交易权限 - 尝试获取挂单
    print("\n[3/6] 检查交易权限 (获取挂单)...")
    response = client._request(
        "GET",
        "/api/v5/trade/orders-pending",
        params={"instType": "SWAP"}
    )
    if response.get("code") == "0":
        print("✅ 交易权限正常")
        orders = response.get("data", [])
        print(f"   当前挂单：{len(orders)} 个")
    else:
        print(f"❌ 交易权限异常：{response.get('msg')}")
        print(f"   错误码：{response.get('code')}")
    
    # 检查持仓权限
    print("\n[4/6] 检查持仓权限...")
    response = client._request(
        "GET",
        "/api/v5/account/positions",
        params={"instType": "SWAP"}
    )
    if response.get("code") == "0":
        print("✅ 持仓查询权限正常")
        positions = response.get("data", [])
        print(f"   当前持仓：{len(positions)} 个")
    else:
        print(f"❌ 持仓查询权限异常：{response.get('msg')}")
        print(f"   错误码：{response.get('code')}")
    
    # 测试市价单
    print("\n[5/6] 测试市价单 (0.001 ETH)...")
    result = client.place_order(
        symbol="ETH-USDT-SWAP",
        side=1,  # BUY
        order_type=2,  # MARKET
        quantity=Decimal("0.001"),
    )
    if result.get("success"):
        print(f"✅ 市价单成功：{result.get('order_id')}")
        # 立即撤单
        client.cancel_order("ETH-USDT-SWAP", result.get("order_id"))
    else:
        print(f"❌ 市价单失败：{result.get('error')}")
        print(f"   错误码：{result.get('code')}")
    
    # 测试限价单
    print("\n[6/6] 测试限价单 (0.001 ETH @ 2000)...")
    result = client.place_order(
        symbol="ETH-USDT-SWAP",
        side=1,  # BUY
        order_type=1,  # LIMIT
        quantity=Decimal("0.001"),
        price=Decimal("2000"),
    )
    if result.get("success"):
        print(f"✅ 限价单成功：{result.get('order_id')}")
        # 立即撤单
        client.cancel_order("ETH-USDT-SWAP", result.get("order_id"))
    else:
        print(f"❌ 限价单失败：{result.get('error')}")
        print(f"   错误码：{result.get('code')}")
    
    # 断开
    client.disconnect()
    
    print()
    print("=" * 60)
    print("✅ 权限检查完成")
    print("=" * 60)
    
    return True


if __name__ == "__main__":
    success = check_testnet_permissions()
    sys.exit(0 if success else 1)
