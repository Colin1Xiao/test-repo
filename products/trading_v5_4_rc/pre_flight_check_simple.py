#!/usr/bin/env python3
"""
预检脚本 - OKX 实盘验证前置检查 (简化版)
"""

import asyncio
import os
import sys

async def pre_flight_check():
    print("=" * 60)
    print("🚀 OKX 预检 - 开仓前的最后检查")
    print("=" * 60)
    
    # 获取环境变量
    API_KEY = os.environ.get("OKX_API_KEY")
    API_SECRET = os.environ.get("OKX_API_SECRET")
    PASSPHRASE = os.environ.get("OKX_PASSPHRASE")
    USE_TESTNET = os.environ.get("OKX_TESTNET", "false").lower() == "true"
    
    if not all([API_KEY, API_SECRET, PASSPHRASE]):
        print("❌ 缺少 API 凭证")
        return False
    
    print(f"✅ API 凭证完整 (测试网: {USE_TESTNET})")
    
    # 导入 ccxt
    try:
        import ccxt.async_support as ccxt
        print("✅ 导入 ccxt 成功")
    except ImportError as e:
        print(f"❌ 导入 ccxt 失败: {e}")
        return False
    
    # 初始化 OKX
    print("\n🔧 初始化 OKX 客户端...")
    okx = ccxt.okx({
        'apiKey': API_KEY,
        'secret': API_SECRET,
        'password': PASSPHRASE,
        'enableRateLimit': True,
    })
    print("✅ OKX 客户端初始化成功")
    
    # 检查余额
    print("\n💰 检查账户余额...")
    try:
        balance = await okx.fetch_balance()
        usdt = balance.get('USDT', {})
        free = usdt.get('free', 0)
        total = usdt.get('total', 0)
        print(f"✅ 余额: ${total:.2f} (可用: ${free:.2f})")
    except Exception as e:
        print(f"❌ 余额检查失败: {e}")
        await okx.close()
        return False
    
    # 检查产品
    print("\n🔄 检查产品可用性...")
    try:
        markets = await okx.fetch_markets()
        eth_contracts = [m for m in markets if m.get('symbol') == 'ETH/USDT:USDT']
        if eth_contracts:
            print("✅ ETH/USDT:USDT 产品可用")
        else:
            print("❌ ETH/USDT:USDT 产品不可用")
            await okx.close()
            return False
    except Exception as e:
        print(f"❌ 产品检查失败: {e}")
        await okx.close()
        return False
    
    # 检查持仓
    print("\n📊 检查当前持仓...")
    try:
        positions = await okx.fetch_positions(['ETH/USDT:USDT'])
        if positions:
            print(f"⚠️ 当前有 {len(positions)} 个持仓")
        else:
            print("✅ 当前无持仓")
    except Exception as e:
        print(f"⚠️ 持仓检查失败: {e}")
    
    # 检查订单
    print("\n📋 检查未完成订单...")
    try:
        orders = await okx.fetch_open_orders('ETH/USDT:USDT')
        if orders:
            print(f"⚠️ 当前有 {len(orders)} 个未完成订单")
        else:
            print("✅ 当前无未完成订单")
    except Exception as e:
        print(f"⚠️ 订单检查失败: {e}")
    
    await okx.close()
    
    print("\n" + "=" * 60)
    print("✅ 预检完成 - 可以开始实盘验证")
    print("=" * 60)
    return True

if __name__ == "__main__":
    result = asyncio.run(pre_flight_check())
    sys.exit(0 if result else 1)
