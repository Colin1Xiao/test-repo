#!/usr/bin/env python3
"""第 2 笔：重复保护验证"""
import asyncio, os, sys, time, json
sys.path.insert(0, '/Users/colin/.openclaw/workspace/trading_system_v5_3')
sys.path.insert(0, '/Users/colin/.openclaw/workspace/trading_system_v5_4/core')

async def trade_2_duplicate_protection():
    results = {'trade': 2, 'checks': {}, 'passed': False}
    print('=' * 80)
    print('📝 第 2 笔：重复保护验证')
    print('=' * 80)
    
    from core.live_executor import LiveExecutor
    from core.state_store_v54 import get_state_store
    from core.safe_execution_v54 import build_safe_execution_v54
    from core.safe_execution_assembly import signal_to_execution_context
    from core.position_gate_v54 import build_position_gate_v54
    from core.stop_loss_manager_v54 import build_stop_loss_manager_v54
    import ccxt.async_support as ccxt
    
    API_KEY = '8705ea66-bb2a-4eb3-b58a-768346d83657'
    API_SECRET = '8D2DF7BEA6EA559FE5BD1F36E11C44B1'
    PASSPHRASE = 'Xzl405026.'
    
    # 获取初始状态
    okx = ccxt.okx({'apiKey': API_KEY, 'secret': API_SECRET, 'password': PASSPHRASE, 'headers': {'x-simulated-trading': '0'}})
    okx.hostname = 'www.okx.com'
    
    try:
        positions_before = await okx.fetch_positions(['ETH/USDT:USDT'])
        real_before = [p for p in positions_before if float(p.get('contracts', 0)) > 0]
        initial_position_size = float(real_before[0].get('contracts', 0)) if real_before else 0
        
        stops_before = await okx.fetch_open_orders('ETH/USDT:USDT', params={'ordType': 'conditional'})
        initial_stop_count = len(stops_before)
        
        print(f'\n📊 初始状态:')
        print(f'   持仓数量：{initial_position_size}')
        print(f'   止损单数量：{initial_stop_count}')
        
    finally:
        await okx.close()
    
    # 执行开仓（应该被拒绝）
    print(f'\n🚀 执行重复开仓请求...')
    
    live_executor = LiveExecutor(api_key=API_KEY, api_secret=API_SECRET, passphrase=PASSPHRASE, testnet=False)
    bid, ask, mid = await live_executor.get_best_price_fast('ETH/USDT:USDT')
    print(f'   当前价格：ask={ask:.2f}')
    
    # 重新创建 V5.4 实例（确保使用最新的 StateStore）
    print('\n🔧 重新创建 V5.4 实例...')
    state_store = get_state_store()
    print(f'   StateStore._current_position: {state_store._current_position is not None}')
    
    position_gate = build_position_gate_v54(state_store=state_store, live_executor=live_executor)
    stop_loss_manager = build_stop_loss_manager_v54(exchange=live_executor.exchange, stop_loss_pct=0.005)
    
    safe_exec = build_safe_execution_v54(
        live_executor=live_executor,
        state_store=state_store,
        position_gate=position_gate,
        stop_loss_manager=stop_loss_manager,
        lock_timeout=10.0,
    )
    print('   ✅ V5.4 实例已创建')
    
    class TestSignal:
        symbol = 'ETH/USDT:USDT'
        signal_price = ask
        margin_usd = 3.0
        timestamp = time.time()
        score = 100
        regime = 'RANGE'
        volume_ratio = 1.0
    
    ctx = signal_to_execution_context(TestSignal())
    result = await safe_exec.execute_entry(ctx)
    
    print(f'\n📊 V5.4 返回结果:')
    print(f'   Accepted: {result.accepted}')
    print(f'   Reason: {result.reason}')
    
    # 验证结果
    okx = ccxt.okx({'apiKey': API_KEY, 'secret': API_SECRET, 'password': PASSPHRASE, 'headers': {'x-simulated-trading': '0'}})
    okx.hostname = 'www.okx.com'
    
    try:
        positions_after = await okx.fetch_positions(['ETH/USDT:USDT'])
        real_after = [p for p in positions_after if float(p.get('contracts', 0)) > 0]
        final_position_size = float(real_after[0].get('contracts', 0)) if real_after else 0
        
        stops_after = await okx.fetch_open_orders('ETH/USDT:USDT', params={'ordType': 'conditional'})
        final_stop_count = len(stops_after)
        
        print(f'\n📊 最终状态:')
        print(f'   持仓数量：{final_position_size}')
        print(f'   止损单数量：{final_stop_count}')
        
        # 检查项
        results['checks']['rejected_by_gate'] = not result.accepted and 'POSITION_GATE' in result.reason.upper()
        results['checks']['position_not_increased'] = final_position_size == initial_position_size
        results['checks']['stop_preserved'] = final_stop_count == initial_stop_count
        results['checks']['no_new_entry'] = final_position_size <= initial_position_size
        
        # 验证止损单参数
        stop_valid = False
        for o in stops_after:
            info = o.get('info', {})
            sl_trigger = info.get('slTriggerPx')
            state = info.get('state')
            if sl_trigger and float(sl_trigger) > 0 and state == 'live':
                stop_valid = True
        results['checks']['stop_params_valid'] = stop_valid
        
        print(f'\n📋 验证结果:')
        print(f'   被 Position Gate 拒绝：{results["checks"]["rejected_by_gate"]}')
        print(f'   持仓未增加：{results["checks"]["position_not_increased"]}')
        print(f'   止损单保留：{results["checks"]["stop_preserved"]}')
        print(f'   无新 entry：{results["checks"]["no_new_entry"]}')
        print(f'   止损参数有效：{results["checks"]["stop_params_valid"]}')
        
    finally:
        await okx.close()
    
    print('\n' + '=' * 80)
    all_passed = all(results['checks'].values())
    results['passed'] = all_passed
    
    for check, passed in results['checks'].items():
        print(f'   {"✅" if passed else "❌"} {check}')
    
    print(f'\n{"✅ 第 2 笔通过" if all_passed else "❌ 第 2 笔未通过"}')
    print('=' * 80)
    
    return results

if __name__ == '__main__':
    result = asyncio.run(trade_2_duplicate_protection())
    print(json.dumps(result, indent=2))
