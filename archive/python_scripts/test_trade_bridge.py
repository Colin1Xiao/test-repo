#!/usr/bin/env python3
"""测试交易执行桥"""

import sys
from pathlib import Path

def test_bridge():
    print("="*70)
    print("🧪 测试交易执行桥")
    print("="*70)
    
    try:
        from okx_api_integration_v2 import OKXAPIClient
        from trade_executor_bridge import TradeExecutorBridge
        
        print("\n【1/3】初始化交易引擎...")
        engine = OKXAPIClient()
        print("   ✅ 引擎初始化成功")
        
        print("\n【2/3】初始化执行桥...")
        bridge = TradeExecutorBridge(trading_engine=engine)
        print("   ✅ 执行桥初始化成功")
        
        print("\n【3/3】账户预检查...")
        account = engine.preflight_account_check("BTC/USDT:USDT")
        print(f"   可用余额: {account['available_usdt']:.2f} USDT")
        print(f"   当前持仓: {len(account['positions'])} 个")
        print(f"   可交易: {'是' if account['can_trade'] else '否'}")
        
        print("\n" + "="*70)
        print("✅ 测试通过")
        print("="*70)
        
    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(test_bridge())
