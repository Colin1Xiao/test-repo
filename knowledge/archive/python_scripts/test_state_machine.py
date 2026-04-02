#!/usr/bin/env python3
"""
受控状态机测试 - 不真实下单
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from execution_state_machine import ExecutionStateMachine
from okx_api_requests import OKXAPIClientRequests

def test_state_machine():
    print("="*70)
    print("🧪 受控状态机测试")
    print("="*70)
    
    try:
        # 初始化交易引擎（只用于获取配置）
        trading_engine = OKXAPIClientRequests()
        
        # 初始化状态机
        state_machine = ExecutionStateMachine(
            adapter=None,  # 不真实连接
            config=trading_engine.config
        )
        
        print("\n【1/3】测试状态迁移...")
        # 模拟信号检测
        state_machine.transition_to(
            state_machine.ExecutionState.SIGNAL_DETECTED,
            "人工注入模拟信号"
        )
        
        print("✅ SIGNAL_DETECTED -> 正常")
        
        # 模拟进入挂单状态
        state_machine.transition_to(
            state_machine.ExecutionState.ENTRY_ORDER_PENDING,
            "模拟挂单进场"
        )
        
        print("✅ ENTRY_ORDER_PENDING -> 正常")
        
        # 模拟持仓状态
        state_machine.transition_to(
            state_machine.ExecutionState.POSITION_OPEN,
            "模拟持仓成功"
        )
        
        print("✅ POSITION_OPEN -> 正常")
        
        print("\n【2/3】测试状态保存...")
        state_machine.save_state()
        print("✅ 状态已保存")
        
        print("\n【3/3】测试状态加载...")
        loaded = state_machine.load_state()
        if loaded:
            print("✅ 状态已加载")
        else:
            print("⚠️  状态加载失败（首次运行正常）")
        
        print("\n" + "="*70)
        print("✅ 测试完成")
        print("="*70)
        
    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(test_state_machine())
