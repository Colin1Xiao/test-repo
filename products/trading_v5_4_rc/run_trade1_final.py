#!/usr/bin/env python3
import asyncio, os, sys, time, json
sys.path.insert(0, '/Users/colin/.openclaw/workspace/trading_system_v5_3')
sys.path.insert(0, '/Users/colin/.openclaw/workspace/trading_system_v5_4/core')

async def trade_1_final():
    results = {'trade': 1, 'checks': {}, 'passed': False}
    print('=' * 80)
    print('📝 第 1 笔：完整验证（最终版）')
    print('=' * 80)
    from core.live_executor import LiveExecutor
    from safe_execution_assembly import get_safe_execution_v54_cached, signal_to_execution_context
    import ccxt.async_support as ccxt
    
    # 实盘配置
    API_KEY = '8705ea66-bb2a-4eb3-b58a-768346d83657'
    API_SECRET = '8D2DF7BEA6EA559FE5BD1F36E11C44B1'
    PASSPHRASE = 'Xzl405026.'
    TESTNET = False
    
    live_executor = LiveExecutor(api_key=API_KEY, api_secret=API_SECRET, passphrase=PASSPHRASE, testnet=TESTNET)
    bid, ask, mid = await live_executor.get_best_price_fast('ETH/USDT:USDT')
    print(f'\n📊 当前价格：ask={ask:.2f}')
    
    safe_exec = get_safe_execution_v54_cached()
    
    class TestSignal:
        symbol = 'ETH/USDT:USDT'
        signal_price = ask
        margin_usd = 3.0
        timestamp = time.time()
        score = 100
        regime = 'RANGE'
        volume_ratio = 1.0
    
    ctx = signal_to_execution_context(TestSignal())
    
    print(f'\n🚀 执行开仓...')
    result = await safe_exec.execute_entry(ctx)
    print(f'   Accepted: {result.accepted}')
    
    order = result.order_result or {}
    gate = result.gate_snapshot or {}
    
    okx = ccxt.okx({
        'apiKey': API_KEY,
        'secret': API_SECRET,
        'password': PASSPHRASE,
        'headers': {'x-simulated-trading': '0'}
    })
    okx.hostname = 'www.okx.com'
    try:
        positions = await okx.fetch_positions(['ETH/USDT:USDT'])
        real = [p for p in positions if float(p.get('contracts', 0)) > 0]
        results['checks']['position_exists'] = len(real) > 0
        
        try:
            stop_orders = await okx.fetch_open_orders('ETH/USDT:USDT', params={'ordType': 'conditional'})
        except:
            stop_orders = []
        results['checks']['stop_order_exists'] = len(stop_orders) > 0
        
        valid_stop = False
        for o in stop_orders:
            info = o.get('info', {})
            sl_trigger = info.get('slTriggerPx')
            state = info.get('state')
            if sl_trigger and float(sl_trigger) > 0 and state == 'live':
                valid_stop = True
        results['checks']['stop_params_correct'] = valid_stop
        
        results['checks']['has_order_id'] = bool(order.get('order_id', ''))
        results['checks']['filled_size_gt_0'] = order.get('filled_size', 0) > 0
        results['checks']['execution_price_gt_0'] = order.get('execution_price', 0) > 0
        results['checks']['stop_ok'] = gate.get('stop_ok', False)
        results['checks']['stop_verified'] = gate.get('stop_verified', False)
        
        print(f'\n📊 结果:')
        print(f'   order_id: {order.get("order_id", "")}')
        print(f'   filled_size: {order.get("filled_size", 0)}')
        print(f'   execution_price: {order.get("execution_price", 0)}')
        print(f'   持仓：{len(real)} 个')
        print(f'   止损单：{len(stop_orders)} 个')
        print(f'   stop_ok: {gate.get("stop_ok", False)}')
        print(f'   stop_verified: {gate.get("stop_verified", False)}')
    finally:
        await okx.close()
    
    print('\n' + '=' * 80)
    all_passed = all(results['checks'].values())
    results['passed'] = all_passed
    for check, passed in results['checks'].items():
        print(f'   {"✅" if passed else "❌"} {check}')
    print(f'\n{"✅ 第 1 笔通过" if all_passed else "❌ 第 1 笔未通过"}')
    print('=' * 80)
    return results

if __name__ == '__main__':
    result = asyncio.run(trade_1_final())
    print(json.dumps(result, indent=2))
