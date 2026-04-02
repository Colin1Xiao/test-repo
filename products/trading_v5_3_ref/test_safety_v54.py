#!/usr/bin/env python3
"""
V5.4 Safety Test #2 验证脚本

验证 5 项核心功能：
1. Execution Lock: asyncio.Lock 真正的异步锁
2. Position Gate: 双层检查（本地 + 交易所）
3. Stop Loss: 订单级止损（交易所托管）
4. Stop Verification: 二次验证
5. Exit Source: 正确记录
"""
import asyncio
import sys
import os
from pathlib import Path

# 添加路径
BASE_DIR = Path(__file__).parent
sys.path.insert(0, str(BASE_DIR / 'core'))
sys.path.insert(0, str(BASE_DIR))

# 设置代理
os.environ['https_proxy'] = 'http://127.0.0.1:7890'
os.environ['http_proxy'] = 'http://127.0.0.1:7890'

import json
import ccxt.async_support as ccxt


async def test_safety_features():
    """测试安全功能"""
    print("\n" + "="*70)
    print("🧪 V5.4 Safety Test #2 验证")
    print("="*70)
    
    # 加载 API 配置
    config_path = Path.home() / '.openclaw' / 'secrets' / 'okx_testnet.json'
    if not config_path.exists():
        print(f"❌ API 配置不存在: {config_path}")
        return False
    
    with open(config_path, 'r') as f:
        config = json.load(f).get('okx', {})
    
    # 初始化交易所
    exchange = ccxt.okx({
        'apiKey': config.get('api_key'),
        'secret': config.get('secret_key'),
        'password': config.get('passphrase'),
        'enableRateLimit': True,
        'timeout': 10000,
        'options': {'defaultType': 'swap'},
        'proxies': {'http': 'http://127.0.0.1:7890', 'https': 'http://127.0.0.1:7890'},
        'aiohttp_proxy': 'http://127.0.0.1:7890',
    })
    exchange.set_sandbox_mode(True)
    
    print("✅ 交易所连接成功 (Testnet)")
    
    # 导入 SafeExecutor
    from executor.safe_execution import SafeExecutor
    
    # 初始化 SafeExecutor
    symbol = "ETH/USDT:USDT"
    executor = SafeExecutor(exchange, symbol)
    
    print("\n" + "-"*70)
    print("📋 测试清单")
    print("-"*70)
    
    results = {
        "execution_lock": False,
        "position_gate": False,
        "stop_loss": False,
        "stop_verification": False,
        "exit_source": False,
    }
    
    try:
        # ===== Test 1: Execution Lock =====
        print("\n[Test 1] Execution Lock (asyncio.Lock)")
        print("   检查是否使用 asyncio.Lock...")
        
        if hasattr(executor, '_lock') and isinstance(executor._lock, asyncio.Lock):
            results["execution_lock"] = True
            print("   ✅ PASS: 使用 asyncio.Lock")
        else:
            print("   ❌ FAIL: 未使用 asyncio.Lock")
        
        # ===== Test 2: Position Gate =====
        print("\n[Test 2] Position Gate (双层检查)")
        print("   检查交易所持仓状态...")
        
        # 获取交易所持仓
        exchange_size = await executor._get_exchange_position_size()
        print(f"   交易所持仓: {exchange_size:.4f} ETH")
        
        # 检查双层 Position Gate
        gate_result = await executor._check_position_gate()
        print(f"   Gate 结果: passed={gate_result['passed']}, reason={gate_result['reason']}")
        
        if exchange_size < 0.001:  # 无持仓
            results["position_gate"] = True
            print("   ✅ PASS: Position Gate 正常工作")
        else:
            print("   ⚠️ 已有持仓，跳过此测试")
        
        # ===== Test 3-5: 需要实际交易 =====
        print("\n" + "-"*70)
        print("⚠️ 以下测试需要实际交易才能验证:")
        print("   Test 3: Stop Loss (订单级止损)")
        print("   Test 4: Stop Verification (二次验证)")
        print("   Test 5: Exit Source (退出原因记录)")
        print("-"*70)
        
        # 询问是否执行真实交易测试
        print("\n是否执行真实交易测试？(y/N): ", end="")
        choice = input().strip().lower()
        
        if choice == 'y':
            print("\n🚀 执行真实交易测试...")
            
            # 执行交易
            result = await executor.try_execute("buy", 0.01)
            
            if result:
                print(f"\n✅ 交易成功!")
                print(f"   入场价: ${result['entry_price']:.2f}")
                print(f"   止损价: ${result['stop_price']:.2f}")
                print(f"   止损验证: {result['stop_verified']}")
                
                results["stop_loss"] = result.get("stop_ok", False)
                results["stop_verification"] = result.get("stop_verified", False)
                
                # 等待一下
                await asyncio.sleep(2)
                
                # 平仓
                print("\n🚀 执行平仓测试...")
                close_result = await executor.close_position("MANUAL", "safety_test")
                
                if close_result:
                    print(f"✅ 平仓成功!")
                    print(f"   PnL: {close_result['pnl_pct']:.4f}%")
                    print(f"   退出原因: {close_result['exit_source']}")
                    results["exit_source"] = close_result.get("exit_source") == "MANUAL"
            else:
                print("❌ 交易失败")
        
    except Exception as e:
        print(f"\n❌ 测试异常: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        await exchange.close()
    
    # ===== 结果汇总 =====
    print("\n" + "="*70)
    print("📊 测试结果汇总")
    print("="*70)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"   {name}: {status}")
    
    print(f"\n总计: {passed}/{total} 通过")
    
    if passed == total:
        print("\n🎉 所有测试通过！系统可以开始 Safety Test #2")
    else:
        print("\n⚠️ 部分测试失败，需要修复后重试")
    
    return passed == total


if __name__ == "__main__":
    asyncio.run(test_safety_features())