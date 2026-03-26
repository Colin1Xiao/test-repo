#!/usr/bin/env python3
"""
预检脚本 - OKX 实盘验证前置检查

运行方式：
python pre_flight_check.py

检查项：
1. API 凭证完整性
2. 账户余额 (只读)
3. 产品可用性 (ETH/USDT:USDT)
4. 当前持仓/订单状态

只有全部通过才允许执行第 1 笔实盘验证。

⚠️  important:
- 所有操作必须人工触发，不得无人值守
- 每笔后必须交易所侧核验
- 任一异常立即停止，不做后序
"""

from __future__ import annotations
import sys
import os
import asyncio
from pathlib import Path

# 添加路径
sys.path.insert(0, str(Path(__file__).parent))


async def pre_flight_check():
    """预检主函数"""
    print("=" * 60)
    print("🚀 OKX 预检 - 开仓前的最后检查")
    print("=" * 60)
    print()
    print("重要提醒:")
    print("  - 所有操作必须人工触发，不得无人值守")
    print("  - 每笔后必须交易所侧核验")
    print("  - 任一异常立即停止，不做后序")
    print()
    
    # ========== Step 1: 检查 API 凭证 ==========
    print("🔐 检查 API 凭证...")
    
    API_KEY = os.environ.get("OKX_API_KEY")
    API_SECRET = os.environ.get("OKX_API_SECRET")
    PASSPHRASE = os.environ.get("OKX_PASSPHRASE")
    USE_TESTNET = os.environ.get("OKX_TESTNET", "false").lower() == "true"
    
    if not all([API_KEY, API_SECRET, PASSPHRASE]):
        print("❌ 缺少 API 凭证")
        print(f"   API_KEY: {'✅' if API_KEY else '❌ (缺少)'}")
        print(f"   API_SECRET: {'✅' if API_SECRET else '❌ (缺少)'}")
        print(f"   PASSPHRASE: {'✅' if PASSPHRASE else '❌ (缺少)'}")
        return False
    
    print(f"✅ API 凭证完整")
    print(f"   Key (前8位): {API_KEY[:8]}...")
    print(f"   测试网: {'✅' if USE_TESTNET else '❌'}")
    
    # ========== Step 2: 导入 ccxt ==========
    try:
        import ccxt.async_support as ccxt
        print("✅ 导入 ccxt.async_support 成功")
    except ImportError as e:
        print(f"❌ 导入 ccxt 失败: {e}")
        print("   请先安装: pip install ccxt")
        return False
    
    # ========== Step 3: 初始化 OKX 客户端 ==========
    print("\n🔧 初始化 OKX 客户端...")
    
    try:
        okx = ccxt.okx({
            'apiKey': API_KEY,
            'secret': API_SECRET,
            'password': PASSPHRASE,
            'enableRateLimit': True,
            'options': {
                'defaultType': 'swap',
            },
        })
        
        # 设置 API URL
        if USE_TESTNET:
            okx.urls['api'] = 'https://testnet.okx.com'
        else:
            okx.urls['api'] = 'https://www.okx.com'
        
        print("✅ OKX 客户端初始化成功")
    except Exception as e:
        print(f"❌ OKX 客户端初始化失败: {e}")
        return False
    
    # ========== Step 4: 检查账户余额 ==========
    print("\n💰 检查账户余额...")
    try:
        balance = await okx.fetch_balance()
        
        # ccxt 返回格式: {'USDT': {'free': x, 'used': y, 'total': z}, ...}
        usdt = balance.get('USDT', {})
        if isinstance(usdt, dict):
            free = usdt.get('free', 0)
            total = usdt.get('total', 0)
        else:
            # 可能是旧格式
            free = balance.get('free', {}).get('USDT', 0)
            total = balance.get('total', {}).get('USDT', 0)
        
        print("✅ 账户余额查询成功")
        print(f"   USDT 总额: ${total:.2f}")
        print(f"   USDT 可用: ${free:.2f}")
        
        if free < 1.0:
            print("⚠️  可用余额较低，请确认资金充足")
        
    except Exception as e:
        error_msg = str(e)
        if "PermissionDenied" in error_msg or "AuthenticationError" in error_msg or "API" in error_msg:
            print(f"❌ 账户余额检查失败 (可能 API 权限不足): {e}")
            print("   可能原因:")
            print("   - API 权限未启用 '读取' 权限")
            print("   - 子账户未授权")
            print("   - 账户模式不支持")
        else:
            print(f"❌ 账户余额检查失败: {e}")
        return False
    
    # ========== Step 5: 检查产品可用性 (ETH/USDT:USDT) ==========
    print("\n🔄 检查产品可用性...")
    try:
        # 获取所有 SWAP 产品
        markets = await okx.fetch_markets()
        
        eth_contracts = [m for m in markets if m.get('symbol') == 'ETH/USDT:USDT']
        
        if not eth_contracts:
            print("❌ ETH/USDT:USDT 产品不可用")
            print(f"   可用品种: {[m.get('symbol') for m in markets[:10]]}")
            return False
        
        contract = eth_contracts[0]
        print("✅ ETH/USDT:USDT 产品可用")
        print(f"   精度: tickSize={contract.get('precision', {}).get('price', 'N/A')}")
        print(f"   最小数量: {contract.get('limits', {}).get('amount', {}).get('min', 'N/A')}")
        
    except Exception as e:
        print(f"❌ 产品可用性检查失败: {e}")
        print("   可能原因:")
        print("   - 账户所属地区限制")
        print("   - API 权限不足")
        return False
    
    # ========== Step 6: 检查当前持仓 ==========
    print("\n📊 检查当前持仓...")
    try:
        positions = await okx.fetch_positions(['ETH/USDT:USDT'])
        
        if not positions:
            print("✅ 当前无持仓 (正常)")
        else:
            for pos in positions:
                symbol = pos.get('symbol', '')
                side = pos.get('side', '')
                contracts = pos.get('contracts', 0)
                entry_price = pos.get('entryPrice', 0)
                
                print(f"⚠️  当前有持仓: {symbol} {side} {contracts} @ {entry_price:.2f}")
        
    except Exception as e:
        print(f"❌ 持仓检查失败: {e}")
        print("   可能原因:")
        print("   - API 权限未启用 '持仓' 权限")
        return False
    
    # ========== Step 7: 检查未完成订单 ==========
    print("\n📋 检查未完成订单...")
    try:
        orders = await okx.fetch_open_orders(symbol='ETH/USDT:USDT')
        
        if not orders:
            print("✅ 当前无未完成订单 (正常)")
        else:
            for order in orders:
                side = order.get('side', '')
                type = order.get('type', '')
                amount = order.get('amount', 0)
                price = order.get('price', 0)
                
                print(f"⚠️  未完成订单: {side} {type} {amount} @ {price}")
        
    except Exception as e:
        print(f"❌ 订单检查失败: {e}")
        print("   可能原因:")
        print("   - API 权限未启用 '订单' 权限")
        return False
    
    # ========== Step 8: 总结 ==========
    print("\n" + "=" * 60)
    print("✅ 预检完成 - 所有检查通过")
    print("=" * 60)
    print()
    print("下一步:")
    print("  1. 手动触发第 1 笔开仓")
    print("  2. 交易所侧核验持仓 + 止损单")
    print("  3. 手动触发第 2 笔 (验证重复保护)")
    print("  4. 手动触发第 3 笔 (验证退出审计)")
    print()
    print("⚠️  重要提醒:")
    print("  - 所有操作必须人工触发，不得无人值守")
    print("  - 每笔后必须交易所侧核验")
    print("  - 任一异常立即停止，不做后序")
    print("=" * 60)
    
    return True


def main():
    """主入口"""
    print()
    
    result = asyncio.run(pre_flight_check())
    
    print()
    if result:
        print("✅ 预检通过，可以开始实盘验证")
        sys.exit(0)
    else:
        print("❌ 预检失败，请检查以上问题后重试")
        sys.exit(1)


if __name__ == "__main__":
    main()
