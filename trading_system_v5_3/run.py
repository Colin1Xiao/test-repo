#!/usr/bin/env python3
"""
Trading System V5.3 - 统一入口

唯一执行路径：
Signal → Decision Hub → Execution Gate → Execution Engine

安全机制：
1. 运行锁（防止多实例）
2. 系统指纹（检测代码变动）
3. 版本验证（版本锁）
"""

import sys
import os
import hashlib
import time

# 添加路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def system_fingerprint():
    """
    系统指纹 - 检测代码变动
    
    Returns:
        系统唯一指纹（MD5）
    """
    files = []
    
    for root, _, filenames in os.walk("core"):
        for f in filenames:
            if f.endswith(".py"):
                path = os.path.join(root, f)
                try:
                    with open(path, "rb") as fp:
                        files.append(hashlib.md5(fp.read()).hexdigest())
                except:
                    pass
    
    return hashlib.md5("".join(files).encode()).hexdigest()[:16]


def check_run_lock():
    """
    运行锁 - 防止多实例
    
    Returns:
        True = 可以运行，False = 已有实例
    """
    lock_file = "/tmp/trading_system_v5_3.lock"
    
    if os.path.exists(lock_file):
        # 检查是否是僵尸锁（超过 1 小时）
        lock_age = time.time() - os.path.getmtime(lock_file)
        if lock_age > 3600:
            print("⚠️ 发现僵尸锁，清理中...")
            os.remove(lock_file)
            return True
        return False
    
    # 创建锁
    with open(lock_file, "w") as f:
        f.write(str(os.getpid()))
    
    return True


def release_run_lock():
    """释放运行锁"""
    lock_file = "/tmp/trading_system_v5_3.lock"
    if os.path.exists(lock_file):
        os.remove(lock_file)


def verify_version():
    """验证版本"""
    try:
        with open('VERSION') as f:
            version = f.read().strip().split('\n')[0]
        if version != 'V5.3':
            print(f"❌ 版本不匹配: {version}")
            return False
        return True
    except:
        print("❌ VERSION 文件缺失")
        return False


def main():
    """
    主入口函数
    
    决策流程:
    1. 获取信号 (Strategy)
    2. Decision Hub 评估
    3. Execution Gate 验证
    4. Execution Engine 执行
    """
    print("=" * 60)
    print("🚀 Trading System V5.3 启动")
    print("=" * 60)
    
    # 1. 版本验证
    if not verify_version():
        sys.exit(1)
    
    # 2. 运行锁检查
    if not check_run_lock():
        print("❌ 系统已在运行")
        print("   如需强制启动，请删除: /tmp/trading_system_v5_3.lock")
        sys.exit(1)
    
    # 3. 系统指纹
    fingerprint = system_fingerprint()
    print(f"🧬 System Fingerprint: {fingerprint}")
    print(f"   提示: 代码变动会导致指纹变化")
    
    # 4. 记录启动信息
    print(f"   PID: {os.getpid()}")
    print(f"   Time: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    try:
        from core.decision_hub import get_decision_hub
        from core.execution_gate import ExecutionGate, ExecutionRequest
        
        # 初始化
        hub = get_decision_hub()
        
        print("\n✅ 系统初始化完成")
        print("   Decision Hub: V2")
        print("   状态: 等待信号")
        
        # TODO: 接入实际信号源和执行循环
        # 这里需要集成 run_v52_live.py 的主循环
        
    except KeyboardInterrupt:
        print("\n\n👋 系统停止")
    except Exception as e:
        print(f"\n❌ 系统错误: {e}")
    finally:
        # 释放运行锁
        release_run_lock()
        print("🔓 运行锁已释放")


if __name__ == "__main__":
    main()
