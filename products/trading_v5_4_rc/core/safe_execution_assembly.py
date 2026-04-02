#!/usr/bin/env python3
"""
Safe Execution V5.4 集成装配层

初始化并组装所有 V5.4 组件，提供统一的入口函数。

Usage:
    from core.safe_execution_assembly import get_safe_execution_v54
    safe_exec = get_safe_execution_v54()
    result = await safe_exec.execute_entry(ctx)
"""

from __future__ import annotations
import sys
import os
from pathlib import Path
from typing import Optional

# 添加路径（支持相对和绝对导入）
sys.path.insert(0, str(Path(__file__).parent.parent))


def get_safe_execution_v54() -> Optional[object]:
    """
    获取已装配的 SafeExecutionV54 实例
    
    如果组件缺失，返回 None 并打印提示
    
    Returns:
        SafeExecutionV54 实例或 None
    """
    try:
        # ———— Step 1: 导入必要模块 ————
        from core.live_executor import LiveExecutor
        from core.state_store_v54 import TradeStateStore, get_state_store
        from core.safe_execution_v54 import (
            SafeExecutionV54,
            ExecutionContext,
            ExecutionRejected,
            PositionGateRejected,
            ExecutionLockTimeout,
            build_safe_execution_v54,
        )
        from core.position_gate_v54 import (
            PositionGateV54,
            GateResult,
            build_position_gate_v54,
        )
        from core.stop_loss_manager_v54 import (
            StopLossManagerV54,
            build_stop_loss_manager_v54,
        )
        
        # ———— Step 2: 初始化 V5.3 组件（已有） ————
        # 尝试从环境变量或配置文件读取 OKX 配置
        import os
        OKX_API_KEY = os.environ.get("OKX_API_KEY", "test_api_key")
        OKX_API_SECRET = os.environ.get("OKX_API_SECRET", "test_api_secret")
        OKX_PASSPHRASE = os.environ.get("OKX_PASSPHRASE", "test_passphrase")
        TESTNET = os.environ.get("OKX_TESTNET", "true").lower() == "true"
        STOP_LOSS_PCT = float(os.environ.get("STOP_LOSS_PCT", "0.005"))  # 0.5%
        
        print("🔧 初始化 V5.3 LiveExecutor...")
        print(f"   API Key: {OKX_API_KEY[:8]}...")
        print(f"   Testnet: {TESTNET}")
        live_executor = LiveExecutor(
            api_key=OKX_API_KEY,
            api_secret=OKX_API_SECRET,
            passphrase=OKX_PASSPHRASE,
            testnet=TESTNET,
        )
        
        # ———— Step 3: 初始化 V5.4 组件 ————
        print("🔧 初始化 V5.4 StateStore...")
        state_store = get_state_store()
        
        print("🔧 初始化 V5.4 StopLossManager...")
        stop_loss_manager = build_stop_loss_manager_v54(
            exchange=live_executor.exchange,
            stop_loss_pct=STOP_LOSS_PCT,
        )
        
        print("🔧 初始化 V5.4 PositionGate...")
        position_gate = build_position_gate_v54(
            state_store=state_store,
            live_executor=live_executor,
        )
        
        # ———— Step 4: 构建 SafeExecutionV54 ————
        print("🔧 构建 SafeExecutionV54...")
        safe_execution = build_safe_execution_v54(
            live_executor=live_executor,
            state_store=state_store,
            position_gate=position_gate,
            stop_loss_manager=stop_loss_manager,
            lock_timeout=10.0,
        )
        
        # ———— Step 5: 打印状态 ————
        print("\n" + "=" * 60)
        print("✅ V5.4 Safe Execution 装配完成")
        print("=" * 60)
        print("📋 组件列表:")
        print("  ✅ LiveExecutor (OKX API)")
        print("  ✅ StateStore (V5.4)")
        print("  ✅ StopLossManager (V5.4)")
        print("  ✅ PositionGate (V5.4)")
        print("  ✅ SafeExecutionV54 (V5.4)")
        print()
        print("🎯 保护链:")
        print("  1. Execution Lock (单线程)")
        print("  2. Position Gate (双层检查)")
        print("  3. Stop Loss Manager (订单级止损)")
        print("  4. Stop Verification (二次验证)")
        print("  5. StateStore Record (审计)")
        print("=" * 60)
        
        return safe_execution
        
    except ImportError as e:
        print(f"\n❌ V5.4 组件缺失: {e}")
        print("   请确保 V5.4 文件已创建:")
        print("   - core/position_gate_v54.py")
        print("   - core/safe_execution_v54.py")
        print("   - core/stop_loss_manager_v54.py")
        print("   - core/state_store_v54.py")
        return None
    except Exception as e:
        print(f"\n❌ V5.4 装配失败: {e}")
        import traceback
        traceback.print_exc()
        return None


# ———— 单例缓存 ————
_safe_execution_v54_instance = None


def get_safe_execution_v54_cached() -> Optional[object]:
    """
    获取缓存的 SafeExecutionV54 实例（单例）
    
    Returns:
        SafeExecutionV54 实例或 None
    """
    global _safe_execution_v54_instance
    if _safe_execution_v54_instance is None:
        _safe_execution_v54_instance = get_safe_execution_v54()
    return _safe_execution_v54_instance


def signal_to_execution_context(signal: object) -> object:
    """
    将 V5.3 Signal 映射到 V5.4 ExecutionContext
    
    Args:
        signal: V5.3 Signal 实例
    
    Returns:
        ExecutionContext 实例
    """
    try:
        from core.safe_execution_v54 import ExecutionContext
        return ExecutionContext(
            symbol=signal.symbol,
            side="buy",  # 简化版，实际根据 signal.direction 映射
            requested_size=0.13,  # 默认值，可配置
            request_id=f"sig-{int(signal.timestamp * 1000)}",
            strategy="v35",
            signal_price=signal.signal_price,
            margin_usd=signal.margin_usd,
            metadata={
                "score": signal.score,
                "regime": signal.regime,
                "volume_ratio": signal.volume_ratio,
            },
        )
    except Exception as e:
        print(f"❌ Signal 转 ExecutionContext 失败: {e}")
        return None
