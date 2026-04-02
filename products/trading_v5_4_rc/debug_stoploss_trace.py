#!/usr/bin/env python3
"""
StopLossManager 调试脚本 - 添加详细日志
"""
import asyncio
import os
import sys
import logging

# 配置详细日志
logging.basicConfig(
    level=logging.DEBUG,
    format='[%(levelname)s] %(name)s: %(message)s'
)

sys.path.insert(0, '/Users/colin/.openclaw/workspace/trading_system_v5_3')
sys.path.insert(0, '/Users/colin/.openclaw/workspace/trading_system_v5_4/core')

os.environ['OKX_API_KEY'] = '8705ea66-bb2a-4eb3-b58a-768346d83657'
os.environ['OKX_API_SECRET'] = '8D2DF7BEA6EA559FE5BD1F36E11C44B1'
os.environ['OKX_PASSPHRASE'] = 'Xzl405026.'

async def debug():
    from core.live_executor import LiveExecutor
    from core.stop_loss_manager_v54 import StopLossManagerV54
    import ccxt.async_support as ccxt
    
    print('=' * 80)
    print('🔍 StopLossManager 调试 - 详细日志')
    print('=' * 80)
    
    # 1. 初始化
    print('\n1. 初始化...')
    live_executor = LiveExecutor(
        api_key=os.environ['OKX_API_KEY'],
        api_secret=os.environ['OKX_API_SECRET'],
        passphrase=os.environ['OKX_PASSPHRASE'],
        testnet=False,
    )
    
    # 2. 获取当前价格
    print('\n2. 获取当前价格...')
    ticker = await live_executor.exchange.fetch_ticker('ETH/USDT:USDT')
    current_price = ticker['last']
    print(f'   当前价格：${current_price:.2f}')
    
    # 3. 创建 StopLossManager
    print('\n3. 创建 StopLossManager...')
    stop_loss_manager = StopLossManagerV54(
        exchange=live_executor.exchange,
        stop_loss_pct=0.005,
    )
    
    # 4. 测试止损单提交
    print('\n4. 测试止损单提交...')
    print(f'   Symbol: ETH/USDT:USDT')
    print(f'   Entry Price: $2071.24')
    print(f'   Position Size: 0.1448')
    print(f'   Side: buy')
    
    # 计算预期止损价
    entry_price = 2071.24
    stop_loss_pct = 0.005
    expected_stop = entry_price * (1 - stop_loss_pct)
    adjusted_stop = current_price * (1 - 0.003) if expected_stop >= current_price else expected_stop
    
    print(f'   原止损价：${expected_stop:.2f}')
    print(f'   当前价格：${current_price:.2f}')
    print(f'   调整后止损价：${adjusted_stop:.2f}')
    
    try:
        result = await stop_loss_manager.place_stop_loss(
            symbol='ETH/USDT:USDT',
            entry_price=entry_price,
            position_size=0.1448,
            side='buy',
        )
        
        print(f'\n5. 结果:')
        print(f'   stop_ok: {result.stop_ok}')
        print(f'   stop_verified: {result.stop_verified}')
        print(f'   stop_order_id: {result.stop_order_id}')
        print(f'   stop_price: {result.stop_price}')
        print(f'   reason: {result.reason}')
        
        # 6. 验证止损单
        print('\n6. 验证止损单...')
        orders = await live_executor.exchange.fetch_open_orders('ETH/USDT:USDT')
        stop_orders = [o for o in orders if o.get('type') == 'conditional' or o.get('triggerPrice')]
        print(f'   找到止损单：{len(stop_orders)} 个')
        for o in stop_orders:
            print(f'      - {o.get("side")} trigger=${o.get("triggerPrice", 0):.2f} id={o.get("id")}')
        
    except Exception as e:
        print(f'\n❌ 异常: {e}')
        import traceback
        traceback.print_exc()
    
    finally:
        await live_executor.close()
    
    print('\n' + '=' * 80)

if __name__ == '__main__':
    asyncio.run(debug())
