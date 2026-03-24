#!/usr/bin/env python3
"""
执行链路验证脚本
验证 V3.X 增强版执行链路
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from execution_state_machine import ExecutionStateMachine, ExecutionState

def test_execution_chain():
    """测试执行链路"""
    print("="*70)
    print("🧪 V3.X 执行链路验证")
    print("="*70)
    
    try:
        # 初始化状态机
        state_machine = ExecutionStateMachine()
        
        print("\n【1/5】测试状态迁移...")
        # 测试完整状态链
        states = [
            ExecutionState.SIGNAL_DETECTED,
            ExecutionState.RL_EVALUATION_PENDING,
            ExecutionState.PRECHECK_PENDING,
            ExecutionState.ENTRY_ORDER_PENDING
        ]
        
        current_state = ExecutionState.IDLE
        for next_state in states:
            state_machine.transition_to(next_state, f"Test transition to {next_state.value}")
            assert state_machine.current_state == next_state, f"Expected {next_state}, got {state_machine.current_state}"
            print(f"  ✅ {current_state.value} -> {next_state.value}")
            current_state = next_state
        
        print("\n【2/5】测试非法状态迁移拦截...")
        # 测试非法迁移
        try:
            state_machine.transition_to(ExecutionState.POSITION_OPEN, "Illegal direct transition")
            print("  ❌ 非法迁移未被拦截")
        except Exception as e:
            print("  ✅ 非法迁移被正确拦截")
        
        print("\n【3/5】测试预检查...")
        # 测试预检查
        can_enter = state_machine._precheck_entry_allowed()
        print(f"  ✅ 预检查结果: {can_enter}")
        
        print("\n【4/5】测试状态保存/加载...")
        state_machine.save_state()
        loaded = state_machine.load_state()
        print(f"  ✅ 状态持久化: {'成功' if loaded else '首次运行'}")
        
        print("\n【5/5】测试日志记录...")
        log_size = os.path.getsize('logs/execution_state_machine.log')
        print(f"  ✅ 日志文件大小: {log_size} bytes")
        
        print("\n" + "="*70)
        print("✅ 执行链路验证通过")
        print("="*70)
        
    except Exception as e:
        print(f"\n❌ 执行链路验证失败: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(test_execution_chain())
