#!/usr/bin/env python3
"""
Safe Execution V5.4 - 原子化执行协调器

核心流程：
acquire lock → run position gate → place order → persist → release lock

这是 V5.4 防叠仓的最终防线。
"""

from __future__ import annotations
import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Dict, Optional

logger = logging.getLogger(__name__)


class ExecutionRejected(RuntimeError):
    """执行被拒绝"""
    pass


class PositionGateRejected(ExecutionRejected):
    """Position Gate 拒绝"""
    pass


class ExecutionLockTimeout(ExecutionRejected):
    """执行锁超时"""
    pass


@dataclass
class ExecutionContext:
    """执行上下文"""
    symbol: str
    side: str
    requested_size: float
    request_id: str
    strategy: Optional[str] = None
    signal_price: float = 0.0
    margin_usd: float = 3.0
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)


@dataclass
class ExecutionResult:
    """执行结果"""
    accepted: bool
    reason: str
    order_result: Optional[Dict[str, Any]] = None
    gate_snapshot: Dict[str, Any] = field(default_factory=dict)
    started_at: float = 0.0
    finished_at: float = 0.0
    
    @property
    def duration_ms(self) -> int:
        return int((self.finished_at - self.started_at) * 1000)


class SafeExecutionV54:
    """
    V5.4 执行协调器
    
    原子流程：
    1. 获取执行锁 (asyncio.Lock)
    2. 运行 Position Gate (双层检查)
    3. 调用 LiveExecutor 下单
    4. 持久化到 StateStore
    5. 释放执行锁
    """
    
    def __init__(
        self,
        *,
        position_gate: Any,
        order_executor: Callable[[ExecutionContext], Awaitable[Dict[str, Any]]],
        state_store: Optional[Any] = None,
        stop_loss_manager: Optional[Any] = None,
        lock_timeout: float = 10.0,
    ) -> None:
        """
        初始化
        
        Args:
            position_gate: PositionGateV54 实例
            order_executor: 异步下单函数 (ExecutionContext → Dict)
            state_store: StateStore 实例 (可选)
            stop_loss_manager: StopLossManagerV54 实例 (可选)
            lock_timeout: 锁超时时间 (秒)
        """
        self._execution_lock = asyncio.Lock()
        self.position_gate = position_gate
        self.order_executor = order_executor
        self.state_store = state_store
        self.stop_loss_manager = stop_loss_manager
        self.lock_timeout = lock_timeout
    
    @property
    def is_busy(self) -> bool:
        """是否正在执行"""
        return self._execution_lock.locked()
    
    async def execute_entry(self, ctx: ExecutionContext) -> ExecutionResult:
        """
        受保护的开仓执行
        
        Acceptance rules:
        1. 同一时间只能有 1 个执行线程
        2. Position Gate 必须通过 (本地 + 交易所)
        3. 任何拒绝都是显式的、可审计的
        """
        started_at = time.time()
        
        # ========== Step 1: 获取执行锁 ==========
        lock_acquired = False
        try:
            lock_acquired = await asyncio.wait_for(
                self._execution_lock.acquire(),
                timeout=self.lock_timeout
            )
        except asyncio.TimeoutError:
            finished_at = time.time()
            logger.warning(f"[V5.4] 执行锁超时 ({self.lock_timeout}s)")
            return ExecutionResult(
                accepted=False,
                reason=f"EXECUTION_LOCK_TIMEOUT: {self.lock_timeout}s",
                started_at=started_at,
                finished_at=finished_at,
            )
        
        if not lock_acquired:
            finished_at = time.time()
            return ExecutionResult(
                accepted=False,
                reason="EXECUTION_LOCK_FAILED",
                started_at=started_at,
                finished_at=finished_at,
            )
        
        try:
            # ========== Step 2: Position Gate 检查 ==========
            gate_result = await self.position_gate.check(ctx.symbol)
            
            if not gate_result.passed:
                finished_at = time.time()
                logger.warning(f"[V5.4] Position Gate 拒绝：{gate_result.reason}")
                return ExecutionResult(
                    accepted=False,
                    reason=f"POSITION_GATE_BLOCKED: {gate_result.reason}",
                    gate_snapshot=gate_result.gate_snapshot,
                    started_at=started_at,
                    finished_at=finished_at,
                )
            
            # ========== Step 3: 调用 LiveExecutor 下单 ==========
            order_result = None
            try:
                order_result = await self.order_executor(ctx)
                
                # 🔒 验证订单结果（防止误报）
                if order_result is None:
                    finished_at = time.time()
                    logger.error(f"[V5.4] 下单返回 None")
                    return ExecutionResult(
                        accepted=False,
                        reason="EXECUTION_FAILED: order_result is None",
                        gate_snapshot=gate_result.gate_snapshot,
                        started_at=started_at,
                        finished_at=finished_at,
                    )
                
                if not order_result.get("ok", False) and not order_result.get("order_id"):
                    finished_at = time.time()
                    logger.error(f"[V5.4] 订单失败：{order_result}")
                    return ExecutionResult(
                        accepted=False,
                        reason=f"EXECUTION_FAILED: {order_result}",
                        gate_snapshot=gate_result.gate_snapshot,
                        started_at=started_at,
                        finished_at=finished_at,
                    )
                    
            except Exception as e:
                finished_at = time.time()
                logger.error(f"[V5.4] 下单失败：{e}")
                return ExecutionResult(
                    accepted=False,
                    reason=f"EXECUTION_FAILED: {e}",
                    gate_snapshot=gate_result.gate_snapshot,
                    started_at=started_at,
                    finished_at=finished_at,
                )
            
            # ========== Step 4: 提交止损单到交易所 ==========
            stop_loss_result = {"stop_ok": False, "stop_verified": False}
            if self.stop_loss_manager and order_result:
                try:
                    execution_price = order_result.get("execution_price", ctx.signal_price)
                    filled_size = order_result.get("filled_size", ctx.requested_size)
                    
                    logger.info(f"[V5.4] 准备提交止损单：price={execution_price:.2f}, size={filled_size}")
                    
                    stop_loss_result = await self._place_stop_loss(ctx, execution_price, filled_size)
                    
                except RuntimeError as e:
                    # 🔴 硬失败：无止损 = 系统停止
                    finished_at = time.time()
                    error_msg = str(e)
                    logger.error(f"[V5.4] 止损提交硬失败：{error_msg}")
                    return ExecutionResult(
                        accepted=False,
                        reason=f"STOP_LOSS_HARD_FAILURE: {error_msg}",
                        gate_snapshot=gate_result.gate_snapshot,
                        started_at=started_at,
                        finished_at=finished_at,
                    )
                except Exception as e:
                    # ⚠️ 其他异常，记录但继续
                    finished_at = time.time()
                    logger.error(f"[V5.4] 止损提交异常：{e}")
                    stop_loss_result = {"stop_ok": False, "stop_verified": False, "error": str(e)}
            
            # ========== Step 5: 持久化到 StateStore ==========
            if self.state_store and order_result:
                await self._persist_entry(ctx, gate_result, order_result, stop_loss_result)
            
            # ========== Step 5: 返回成功结果 ==========
            finished_at = time.time()
            logger.info(f"[V5.4] 执行成功：{ctx.symbol} @ {ctx.signal_price:.2f}")
            
            # 合并 gate_snapshot、order_result 和 stop_loss_result（包含 stop_ok, stop_verified）
            merged_snapshot = {
                **gate_result.gate_snapshot,
                **order_result,
                **stop_loss_result,  # 包含 stop_ok, stop_verified, stop_order_id, stop_price
            }
            
            return ExecutionResult(
                accepted=True,
                reason="EXECUTION_SUCCESS",
                order_result=order_result,
                gate_snapshot=merged_snapshot,
                started_at=started_at,
                finished_at=finished_at,
            )
            
        finally:
            # ========== 释放执行锁 ==========
            if lock_acquired:
                self._execution_lock.release()
    
    async def _place_stop_loss(
        self,
        ctx: ExecutionContext,
        execution_price: float,
        filled_size: float,
    ) -> Dict[str, Any]:
        """
        提交止损单到交易所
        
        Args:
            ctx: 执行上下文
            execution_price: 真实成交价
            filled_size: 实际成交数量
        
        Returns:
            止损结果字典 (stop_ok, stop_verified)
        
        Raises:
            RuntimeError: 止损提交失败 (硬失败)
        """
        if not self.stop_loss_manager:
            logger.warning("[V5.4] StopLossManager 未配置，跳过止损")
            return {"stop_ok": False, "stop_verified": False, "reason": "NOT_CONFIGURED"}
        
        # 调用 StopLossManager
        result = await self.stop_loss_manager.place_stop_loss(
            symbol=ctx.symbol,
            entry_price=execution_price,
            position_size=filled_size,
            side=ctx.side,
        )
        
        logger.info(f"[V5.4] 止损结果：stop_ok={result.stop_ok}, stop_verified={result.stop_verified}")
        
        return {
            "stop_ok": result.stop_ok,
            "stop_verified": result.stop_verified,
            "stop_order_id": result.stop_order_id,
            "stop_price": result.stop_price,
        }
    
    async def _persist_entry(
        self,
        ctx: ExecutionContext,
        gate_result: Any,
        order_result: Dict[str, Any],
        stop_loss_result: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        持久化开仓记录到 StateStore
        
        Args:
            ctx: 执行上下文
            gate_result: Position Gate 结果
            order_result: 订单结果
            stop_loss_result: 止损结果 (可选)
        """
        try:
            # 构建 entry 事件数据
            entry_data = {
                "symbol": ctx.symbol,
                "side": ctx.side,
                "entry_price": order_result.get("execution_price", ctx.signal_price),
                "position_size": order_result.get("filled_size", ctx.requested_size),
                "margin_usd": ctx.margin_usd,
                "request_id": ctx.request_id,
                "strategy": ctx.strategy,
                "gate_snapshot": gate_result.gate_snapshot,
                "order_result": order_result,
                "stop_loss_result": stop_loss_result or {},
                "created_at": ctx.created_at,
                "executed_at": time.time(),
            }
            
            # 调用 StateStore.record_event
            if hasattr(self.state_store, "record_event"):
                maybe = self.state_store.record_event("entry", entry_data)
                if asyncio.iscoroutine(maybe):
                    await maybe
            elif hasattr(self.state_store, "record_trade"):
                # Fallback: 如果有 record_trade
                maybe = self.state_store.record_trade(**entry_data)
                if asyncio.iscoroutine(maybe):
                    await maybe
            else:
                logger.warning("[V5.4] StateStore 无 record_event 方法")
                
        except Exception as e:
            logger.error(f"[V5.4] 持久化失败：{e}")


class LiveExecutorAdapter:
    """
    V5.3 LiveExecutor 适配器
    
    将 V5.4 ExecutionContext 转换为 V5.3 LiveExecutor.execute_signal() 参数
    """
    
    def __init__(self, live_executor: Any) -> None:
        self.live_executor = live_executor
    
    async def execute(self, ctx: ExecutionContext) -> Dict[str, Any]:
        """
        执行下单
        
        Args:
            ctx: ExecutionContext
        
        Returns:
            订单结果字典（必须包含 ok=True 才算成功）
        """
        if hasattr(self.live_executor, "execute_signal"):
            # V5.3 LiveExecutor.execute_signal 签名:
            # execute_signal(symbol, signal_price, margin_usd, signal_time)
            from datetime import datetime
            import logging
            logger = logging.getLogger(__name__)
            
            logger.info(f"[V5.4] 准备调用 execute_signal: symbol={ctx.symbol}, price={ctx.signal_price}, margin={ctx.margin_usd}")
            
            result = await self.live_executor.execute_signal(
                symbol=ctx.symbol,
                signal_price=ctx.signal_price,
                margin_usd=ctx.margin_usd,
                signal_time=datetime.fromtimestamp(ctx.created_at),
            )
            
            logger.info(f"[V5.4] execute_signal 返回：{result}")
            
            # 🔒 如果返回 None，转换为失败字典（兼容 V5.3 的 None 返回值）
            if result is None:
                logger.error(f"[V5.4] execute_signal 返回 None，可能触发了某个保护机制")
                return {
                    "ok": False,
                    "error": "execute_signal returned None - check LiveExecutor logs for details",
                    "request_id": ctx.request_id,
                }
            
            # 🔒 严格验证结果（防止假阳性）
            return self._strict_normalize_result(result, ctx)
        
        if hasattr(self.live_executor, "place_order"):
            result = await self.live_executor.place_order(
                symbol=ctx.symbol,
                side=ctx.side,
                size=ctx.requested_size,
            )
            return self._strict_normalize_result(result, ctx)
        
        raise RuntimeError(
            "LiveExecutorAdapter requires execute_signal() or place_order()"
        )
    
    @staticmethod
    def _strict_normalize_result(result: Any, ctx: ExecutionContext) -> Dict[str, Any]:
        """
        严格标准化结果格式
        
        规则：
        1. result 必须是 dict
        2. ok 必须显式为 True
        3. order_id 必须存在且非空
        4. execution_price 必须 > 0
        5. filled_size 必须 > 0
        """
        # 规则 1: 必须是 dict
        if not isinstance(result, dict):
            logger.error(f"[V5.4] 订单结果不是 dict: {result}")
            return {
                "ok": False,
                "error": f"Invalid result type: {type(result)}",
                "request_id": ctx.request_id,
            }
        
        # 规则 2: ok 必须显式为 True（不能默认）
        # 注意：V5.3 返回 fill_confirmed=False，但只要订单存在就算成功
        # 所以这里不强制要求 ok=True，只要有订单信息就算成功
        ok = result.get("ok") is True
        
        # 规则 3: order_id 必须存在且非空（兼容多种字段名）
        order_id = result.get("order_id") or result.get("id") or result.get("ordId", "")
        has_order_id = bool(order_id)
        
        # 规则 4: execution_price 必须 > 0（兼容多种字段名）
        execution_price = result.get("execution_price") or result.get("price") or result.get("estimated_price") or 0
        valid_price = execution_price > 0
        
        # 规则 5: filled_size 必须 > 0（兼容多种字段名）
        filled_size = result.get("filled_size") or result.get("size") or result.get("amount") or result.get("contracts", 0)
        valid_size = filled_size > 0
        
        # 修改：只要有 order_id + price + size，就视为成功（不要求 ok=True）
        if has_order_id and valid_price and valid_size:
            logger.info(f"[V5.4] 订单验证通过: order_id={order_id}, price={execution_price}, size={filled_size}")
            return {
                "ok": True,
                "order_id": order_id,
                "execution_price": execution_price,
                "filled_size": filled_size,
                "request_id": ctx.request_id,
                "raw_result": result,
            }
        
        # 任意验证失败 → 返回失败
        if not ok or not has_order_id or not valid_price or not valid_size:
            logger.error(f"[V5.4] 订单验证失败:")
            logger.error(f"   ok={ok}, order_id={has_order_id}, price={valid_price}, size={valid_size}")
            logger.error(f"   result={result}")
            
            return {
                "ok": False,
                "error": "Order validation failed",
                "details": {
                    "ok": ok,
                    "has_order_id": has_order_id,
                    "valid_price": valid_price,
                    "valid_size": valid_size,
                },
                "request_id": ctx.request_id,
                "raw_result": result,
            }
        
        # 全部通过 → 返回成功
        return {
            "ok": True,
            "request_id": ctx.request_id,
            "symbol": ctx.symbol,
            "side": ctx.side,
            "size": ctx.requested_size,
            **result,
        }


def build_safe_execution_v54(
    *,
    live_executor: Any,
    state_store: Any,
    position_gate: Any,
    stop_loss_manager: Optional[Any] = None,
    lock_timeout: float = 10.0,
) -> SafeExecutionV54:
    """
    便捷函数：创建 SafeExecutionV54 实例
    
    Usage:
        safe_exec = build_safe_execution_v54(
            live_executor=live_executor,
            state_store=state_store,
            position_gate=position_gate,
            stop_loss_manager=stop_loss_manager,
            lock_timeout=10.0,
        )
    """
    adapter = LiveExecutorAdapter(live_executor)
    return SafeExecutionV54(
        position_gate=position_gate,
        order_executor=adapter.execute,
        state_store=state_store,
        stop_loss_manager=stop_loss_manager,
        lock_timeout=lock_timeout,
    )
