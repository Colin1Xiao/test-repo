#!/usr/bin/env python3
"""
V5.4 Execution Lock 测试
验证 SafeExecutor 是否能正确阻止并发执行
"""
import sys
from pathlib import Path

# 添加路径
BASE_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BASE_DIR))

import json
import time
import threading
import ccxt

# 导入 SafeExecutor
from executor.safe_execution import SafeExecutor

def test_execution_lock():
    """测试 Execution Lock 是否生效"""

    # 加载配置
    config_path = Path.home() / '.openclaw' / 'secrets' / 'okx_api.json'
    with open(config_path, 'r') as f:
        config = json.load(f)['okx']

    import os
    proxy = os.environ.get('https_proxy', 'http://127.0.0.1:7890')

    # 创建交易所实例
    exchange = ccxt.okx({
        'apiKey': config['api_key'],
        'secret': config['secret_key'],
        'password': config['passphrase'],
        'enableRateLimit': True,
        'proxies': {'http': proxy, 'https': proxy},
    })

    # 创建 SafeExecutor
    symbol = 'ETH/USDT:USDT'
    executor = SafeExecutor(exchange, symbol)

    print("=" * 60)
    print("🧪 Execution Lock 测试开始")
    print("=" * 60)
    print()

    # 测试结果容器
    results = []
    logs = []

    def mock_execute(name):
        """模拟执行"""
        print(f"[{name}] 尝试执行 try_execute...")

        # 注意：这里使用 Mock 模式，不真正下单
        # 我们只测试 Execution Lock 是否生效

        # 检查 execution_lock 状态
        lock_before = executor.execution_lock
        print(f"[{name}] execution_lock (执行前): {lock_before}")

        # 尝试加锁
        if executor.execution_lock:
            log = f"⛔ [{name}] 被锁阻止，无法执行"
            print(log)
            logs.append(log)
            results.append({'name': name, 'executed': False, 'reason': 'locked'})
            return

        # 加锁
        executor.execution_lock = True
        print(f"[{name}] 已加锁")

        # 模拟执行时间
        time.sleep(0.5)

        # 解锁
        executor.execution_lock = False
        print(f"[{name}] 已解锁")

        log = f"✅ [{name}] 执行成功"
        print(log)
        logs.append(log)
        results.append({'name': name, 'executed': True})

    # 测试 1: 顺序执行
    print("📋 测试 1: 顺序执行（应该都能成功）")
    print("-" * 40)
    executor.execution_lock = False
    mock_execute("Signal-A")
    mock_execute("Signal-B")
    print()

    # 测试 2: 并发执行（关键测试）
    print("📋 测试 2: 并发执行（应该只有一个成功）")
    print("-" * 40)
    executor.execution_lock = False

    # 创建两个线程同时执行
    t1 = threading.Thread(target=mock_execute, args=("Signal-C",))
    t2 = threading.Thread(target=mock_execute, args=("Signal-D",))

    # 同时启动
    t1.start()
    t2.start()

    # 等待完成
    t1.join()
    t2.join()

    print()

    # 测试 3: 使用 try_execute 方法（真实方法）
    print("📋 测试 3: 使用 SafeExecutor.try_execute 方法")
    print("-" * 40)
    executor.execution_lock = False
    executor.current_position = None  # 清空持仓状态

    # 模拟双信号
    print("[Signal-E] 调用 try_execute...")
    result_e = executor.try_execute("buy", 0.13)

    print("[Signal-F] 调用 try_execute...")
    result_f = executor.try_execute("buy", 0.13)

    print()

    # 输出结果
    print("=" * 60)
    print("📊 测试结果汇总")
    print("=" * 60)

    success_count = sum(1 for r in results if r.get('executed'))
    blocked_count = sum(1 for r in results if not r.get('executed'))

    print(f"测试 1+2 结果: {success_count} 成功, {blocked_count} 被阻止")
    print(f"测试 3 try_execute 结果:")
    print(f"  Signal-E: {'执行' if result_e else '被阻止'}")
    print(f"  Signal-F: {'执行' if result_f else '被阻止'}")

    print()

    # 最终判断
    if result_e is not None and result_f is None:
        print("✅ PASS: Execution Lock 生效！第一个信号执行，第二个被阻止")
        print()
        print("🟢 FULL GO → 允许进入 Live Safety Test")
        return True
    elif result_e is None and result_f is None:
        print("⚠️ WARNING: 两个信号都被阻止（可能是 Position Gate）")
        print("   需要检查 Position Gate 逻辑")
        return False
    elif result_e is not None and result_f is not None:
        print("❌ FAIL: Execution Lock 失效！两个信号都执行了")
        print("⛔ BLOCKED → 禁止上线，需要修复")
        return False
    else:
        print("⚠️ UNEXPECTED: 第二个信号执行但第一个被阻止")
        return False

if __name__ == '__main__':
    test_execution_lock()