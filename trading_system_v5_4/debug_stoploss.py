#!/usr/bin/env python3
"""
StopLossManager 快速诊断脚本
"""
import asyncio
import os
import sys

sys.path.insert(0, '/Users/colin/.openclaw/workspace/trading_system_v5_3')
sys.path.insert(0, '/Users/colin/.openclaw/workspace/trading_system_v5_4/core')

os.environ['OKX_API_KEY'] = '8705ea66-bb2a-4eb3-b58a-768346d83657'
os.environ['OKX_API_SECRET'] = '8D2DF7BEA6EA559FE5BD1F36E11C44B1'
os.environ['OKX_PASSPHRASE'] = 'Xzl405026.'

async def debug():
    from core.live_executor import LiveExecutor
    from core.stop_loss_manager_v54 import StopLossManagerV54
    
    # 初始化
    live_executor = LiveExecutor(
        api_key=os.environ['OKX_API_KEY'],
        api_secret=os.environ['OKX_API_SECRET'],
        passphrase=os.environ['OKX_PASSPHRASE'],
        testnet=False,
    )
    
    stop_loss_manager = StopLossManagerV54(
        exchange=live_executor.exchange,
        stop_loss_pct=0.005,
    )
    
    # 测试止损单提交
    print("测试止损单提交...")
    print(f"  Symbol: ETH/USDT:USDT")
    print(f"  Entry Price: 2079.85")
    print(f"  Position Size: 0.14")
    print(f"  Side: buy")
    print(f"  Expected Stop Price: {2079.85 * 0.995:.2f}")
    
    try:
        result = await stop_loss_manager.place_stop_loss(
            symbol='ETH/USDT:USDT',
            entry_price=2079.85,
            position_size=0.14,
            side='buy',
        )
        
        print(f"\n结果:")
        print(f"  stop_ok: {result.stop_ok}")
        print(f"  stop_verified: {result.stop_verified}")
        print(f"  stop_order_id: {result.stop_order_id}")
        print(f"  stop_price: {result.stop_price}")
        print(f"  reason: {result.reason}")
        
    except Exception as e:
        print(f"\n异常: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    asyncio.run(debug())
