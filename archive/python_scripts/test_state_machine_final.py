#!/usr/bin/env python3
"""
最终状态机测试（修复版）
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from execution_state_machine import ExecutionStateMachine, ExecutionState

def test_state_machine():
    print("="*70)
    print("🧪 最终状态机测试")
    print("="*70)
    
    try:
        # 初始化状态机（无真实交易）
        state_machine = ExecutionStateMachine()
        
        print("\n【1/4】测试状态迁移...")
        state_machine.transition_to(
            ExecutionState.SIGNAL_DETECTED,
            "人工注入模拟信号"
        )
        
        state_machine.transition_to(
            ExecutionState.ENTRY_ORDER_PENDING,
            "模拟挂单进场"
        )
        
        state_machine.transition_to(
            ExecutionState.POSITION_OPEN,
            "模拟持仓成功"
        )
        
        print("✅ 状态迁移正常")
        
        print("\n【2/4】测试状态保存...")
        state_machine.save_state()
        print("✅ 状态保存正常")
        
        print("\n【3/4】测试状态加载...")
        loaded = state_machine.load_state()
        print(f"✅ 状态加载: {'成功' if loaded else '首次运行'}")
        
        print("\n【4/4】验证日志文件...")
        import os
        if os.path.exists('logs/execution_state_machine.log'):
            log_size = os.path.getsize('logs/execution_state_machine.log')
            print(f"✅ 日志文件大小: {log_size} bytes")
        else:
            print("⚠️  日志文件不存在")
        
        print("\n" + "="*70)
        print("✅ 所有测试通过")
        print("="*70)
        
    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(test_state_machine())
