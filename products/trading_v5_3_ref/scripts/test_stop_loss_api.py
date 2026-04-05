#!/usr/bin/env python3
"""
止损接口修复验证测试
连续测试 3 次创建止损单
"""
import sys
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BASE_DIR))

import json
import ccxt

def test_stop_loss_api():
    """测试 OKX 止损接口"""
    
    # 加载配置
    config_path = Path.home() / '.openclaw' / 'secrets' / 'okx_api.json'
    with open(config_path, 'r') as f:
        config = json.load(f)['okx']
    
    import os
    proxy = os.environ.get('https_proxy', 'http://127.0.0.1:7890')
    
    exchange = ccxt.okx({
        'apiKey': config['api_key'],
        'secret': config['secret_key'],
        'password': config['passphrase'],
        'enableRateLimit': True,
        'proxies': {'http': proxy, 'https': proxy},
    })
    
    # 测试参数
    inst_id = 'ETH-USDT-SWAP'
    stop_price = 2100.0  # 测试价格
    amount = 0.01  # 最小数量
    
    results = []
    
    print("=" * 60)
    print("🧪 OKX 止损接口测试 (连续 3 次)")
    print("=" * 60)
    print(f"品种: {inst_id}")
    print(f"数量: {amount}")
    print(f"止损价: ${stop_price}")
    print()
    
    for i in range(1, 4):
        print(f"--- 测试 #{i} ---")
        
        try:
            # 创建止损单
            result = exchange.private_post_trade_order_algo({
                'instId': inst_id,
                'tdMode': 'cross',
                'side': 'sell',
                'posSide': 'net',
                'ordType': 'conditional',
                'sz': str(amount),
                'slTriggerPx': str(stop_price),
                'slOrdPx': '-1',
            })
            
            if result.get('code') == '0' and result.get('data'):
                algo_id = result['data'][0].get('algoId')
                print(f"✅ 止损单创建成功: {algo_id}")
                
                # 立即取消（避免影响真实交易）
                try:
                    cancel_result = exchange.private_post_trade_cancel_algo_order({
                        'instId': inst_id,
                        'algoId': algo_id,
                    })
                    if cancel_result.get('code') == '0':
                        print(f"✅ 已取消止损单: {algo_id}")
                    else:
                        print(f"⚠️ 取消失败: {cancel_result}")
                except Exception as e:
                    print(f"⚠️ 取消异常: {e}")
                
                results.append({'test': i, 'status': 'PASS', 'algo_id': algo_id})
            else:
                print(f"❌ 止损单返回异常: {result}")
                results.append({'test': i, 'status': 'FAIL', 'error': result})
                
        except Exception as e:
            print(f"❌ 止损单创建失败: {e}")
            results.append({'test': i, 'status': 'FAIL', 'error': str(e)})
        
        print()
    
    # 输出结果
    print("=" * 60)
    print("📊 测试结果汇总")
    print("=" * 60)
    
    for r in results:
        status = "✅ PASS" if r['status'] == 'PASS' else "❌ FAIL"
        print(f"Test #{r['test']}: {status}")
    
    print()
    
    pass_count = sum(1 for r in results if r['status'] == 'PASS')
    fail_count = sum(1 for r in results if r['status'] == 'FAIL')
    
    print(f"通过: {pass_count}/3")
    print(f"失败: {fail_count}/3")
    print()
    
    if pass_count == 3:
        print("🟢 FULL PASS → 止损接口稳定，允许继续 Safety Test")
        return True
    else:
        print("🔴 FAIL → 止损接口不稳定，禁止继续")
        return False

if __name__ == '__main__':
    test_stop_loss_api()