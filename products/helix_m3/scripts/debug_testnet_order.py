#!/usr/local/bin/python3.14
"""
OKX Testnet 下单调试

诊断 Testnet 下单失败原因
"""

import sys
import json
from pathlib import Path
from decimal import Decimal

sys.path.insert(0, str(Path(__file__).parent.parent))

from connectors.okx.trade_client_real import OKXTradeClientReal, OKXConfig, OKXEnv
from schemas.enums import Side, OrderType


def debug_testnet_order():
    """调试 Testnet 下单"""
    print("=" * 60)
    print("🔍 OKX Testnet 下单调试")
    print("=" * 60)
    print()
    
    # 加载配置
    config_path = Path(__file__).parent.parent / "tests" / "config" / "okx_testnet.json"
    
    with open(config_path, 'r') as f:
        config_data = json.load(f)
    
    # 创建客户端
    config = OKXConfig(
        api_key=config_data["api_key"],
        secret_key=config_data["secret_key"],
        passphrase=config_data["passphrase"],
        environment=OKXEnv.TESTNET,
    )
    
    client = OKXTradeClientReal(config)
    
    # 连接
    print("[1] 连接 OKX Testnet...")
    if not client.connect():
        print("❌ 连接失败")
        return
    
    print("✅ 连接成功")
    
    # 获取当前仓位模式
    print("\n[2] 获取账户配置...")
    response = client._request("GET", "/api/v5/account/config")
    if response.get("code") == "0":
        config_info = response.get("data", [{}])[0]
        print(f"账户等级：{config_info.get('acctLv')}")
        print(f"仓位模式：{config_info.get('posMode')}")
        print(f"借币模式：{config_info.get('autoLoan')}")
    else:
        print(f"❌ 获取失败：{response.get('msg')}")
    
    # 获取持仓模式
    print("\n[3] 获取持仓模式...")
    response = client._request("GET", "/api/v5/account/positions", params={"instType": "SWAP"})
    if response.get("code") == "0":
        print(f"✅ 当前持仓：{len(response.get('data', []))} 个")
    else:
        print(f"⚠️  持仓查询失败：{response.get('msg')}")
    
    # 测试下单 - 市价单
    print("\n[4] 测试市价单...")
    result = client.place_order(
        symbol="ETH-USDT-SWAP",
        side=Side.BUY,
        order_type=OrderType.MARKET,
        quantity=Decimal("0.01"),
    )
    print(f"市价单结果：{result}")
    
    # 测试下单 - 限价单
    print("\n[5] 测试限价单...")
    result = client.place_order(
        symbol="ETH-USDT-SWAP",
        side=Side.BUY,
        order_type=OrderType.LIMIT,
        quantity=Decimal("0.01"),
        price=Decimal("2000"),
    )
    print(f"限价单结果：{result}")
    
    # 获取当前委托
    print("\n[6] 获取当前委托...")
    response = client._request(
        "GET",
        "/api/v5/trade/orders-pending",
        params={"instType": "SWAP"}
    )
    if response.get("code") == "0":
        orders = response.get("data", [])
        print(f"当前委托：{len(orders)} 个")
        for order in orders[:5]:
            print(f"  - {order.get('instId')}: {order.get('px')} {order.get('sz')}")
    else:
        print(f"⚠️  查询失败：{response.get('msg')}")
    
    # 断开
    client.disconnect()
    
    print()
    print("=" * 60)
    print("✅ 调试完成")
    print("=" * 60)


if __name__ == "__main__":
    debug_testnet_order()
