#!/usr/bin/env python3
"""
Position Gate V5.4 - 双层持仓门控

核心原则：
1. 本地状态检查 (StateStore)
2. 交易所状态检查 (LiveExecutor)
3. 两者都通过才允许开仓

这是 V5.4 防叠仓的第一道防线。
"""

from __future__ import annotations
import logging
from typing import Any, Dict, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class GateResult:
    """门控检查结果"""
    passed: bool
    reason: str
    local_check: bool = True
    exchange_check: bool = True
    gate_snapshot: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.gate_snapshot is None:
            self.gate_snapshot = {}


class PositionGateV54:
    """
    V5.4 双层持仓门控
    
    检查顺序：
    1. 本地状态 (StateStore._current_position)
    2. 交易所状态 (LiveExecutor.has_open_position)
    
    任一发现持仓 → 拒绝开仓
    """
    
    def __init__(
        self,
        *,
        state_store: Any,
        live_executor: Any,
    ) -> None:
        """
        初始化门控
        
        Args:
            state_store: StateStore 实例 (提供 get_current_position)
            live_executor: LiveExecutor 实例 (提供 has_open_position)
        """
        self.state_store = state_store
        self.live_executor = live_executor
    
    async def check(self, symbol: str) -> GateResult:
        """
        执行双层门控检查
        
        Args:
            symbol: 交易对 (e.g. "ETH/USDT:USDT")
        
        Returns:
            GateResult (passed=True 才允许开仓)
        """
        gate_snapshot = {
            "symbol": symbol,
            "local_position": None,
            "exchange_has_position": False,
            "exchange_position_size": 0.0,
        }
        
        # ========== 第一层：本地状态检查 ==========
        local_passed, local_reason, local_pos = await self._check_local_state(symbol)
        gate_snapshot["local_position"] = local_pos
        gate_snapshot["local_check_passed"] = local_passed
        
        if not local_passed:
            logger.warning(f"[PositionGate] 本地检查失败：{local_reason}")
            return GateResult(
                passed=False,
                reason=local_reason,
                local_check=False,
                exchange_check=True,
                gate_snapshot=gate_snapshot,
            )
        
        # ========== 第二层：交易所状态检查 ==========
        exchange_passed, exchange_reason, exchange_size = await self._check_exchange_state(symbol)
        gate_snapshot["exchange_has_position"] = exchange_size > 0
        gate_snapshot["exchange_position_size"] = exchange_size
        gate_snapshot["exchange_check_passed"] = exchange_passed
        
        if not exchange_passed:
            logger.warning(f"[PositionGate] 交易所检查失败：{exchange_reason}")
            return GateResult(
                passed=False,
                reason=exchange_reason,
                local_check=True,
                exchange_check=False,
                gate_snapshot=gate_snapshot,
            )
        
        # ========== 双层都通过 ==========
        logger.info(f"[PositionGate] 检查通过：{symbol}")
        return GateResult(
            passed=True,
            reason="Position Gate 检查通过 (本地 + 交易所)",
            local_check=True,
            exchange_check=True,
            gate_snapshot=gate_snapshot,
        )
    
    async def _check_local_state(self, symbol: str) -> tuple:
        """
        检查本地状态 (StateStore)
        
        Returns:
            (passed: bool, reason: str, position: Optional[Dict])
        """
        try:
            # 调用 StateStore.get_current_position()
            if hasattr(self.state_store, "get_current_position"):
                position = self.state_store.get_current_position()
            elif hasattr(self.state_store, "_current_position"):
                position = self.state_store._current_position
            else:
                logger.warning("[PositionGate] StateStore 无 get_current_position 或 _current_position")
                return True, "StateStore 接口缺失，跳过本地检查", None
            
            if position is None:
                return True, "本地无持仓", None
            
            # 检查是否是同一个 symbol
            pos_symbol = position.get("symbol", "")
            if pos_symbol == symbol or pos_symbol == symbol.replace("/", "").replace(":", "-"):
                return False, f"本地已有持仓：{position}", position
            
            return True, "本地无该 Symbol 持仓", position
            
        except Exception as e:
            logger.error(f"[PositionGate] 本地检查异常：{e}")
            return True, f"本地检查异常：{e}", None
    
    async def _check_exchange_state(self, symbol: str) -> tuple:
        """
        检查交易所状态 (LiveExecutor)
        
        Returns:
            (passed: bool, reason: str, position_size: float)
        """
        try:
            # 调用 LiveExecutor.has_open_position(symbol)
            if hasattr(self.live_executor, "has_open_position"):
                has_position = self.live_executor.has_open_position(symbol)
                
                if has_position:
                    # 尝试获取持仓大小
                    size = 0.0
                    if hasattr(self.live_executor, "open_positions"):
                        pos = self.live_executor.open_positions.get(symbol, {})
                        size = pos.get("size", 0.0)
                    return False, f"交易所有持仓 (size={size})", size
                
                return True, "交易所无持仓", 0.0
            
            # Fallback: 尝试 get_position_size
            elif hasattr(self.live_executor, "get_position_size"):
                size = await self.live_executor.get_position_size(symbol)
                if size > 0:
                    return False, f"交易所有持仓 (size={size})", size
                return True, "交易所无持仓", 0.0
            
            else:
                logger.warning("[PositionGate] LiveExecutor 无 has_open_position 或 get_position_size")
                return True, "LiveExecutor 接口缺失，跳过交易所检查", 0.0
                
        except Exception as e:
            logger.error(f"[PositionGate] 交易所检查异常：{e}")
            return True, f"交易所检查异常：{e}", 0.0


def build_position_gate_v54(*, state_store: Any, live_executor: Any) -> PositionGateV54:
    """
    便捷函数：创建 PositionGateV54 实例
    
    Usage:
        gate = build_position_gate_v54(
            state_store=state_store,
            live_executor=live_executor,
        )
    """
    return PositionGateV54(
        state_store=state_store,
        live_executor=live_executor,
    )
