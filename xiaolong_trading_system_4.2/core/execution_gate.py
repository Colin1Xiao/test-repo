#!/usr/bin/env python3
"""
Execution Gate - 执行门控

强制所有执行必须经过 Decision Hub 授权
不允许绕过 Decision Hub 直接执行
"""

from typing import Optional
from dataclasses import dataclass


class UnauthorizedExecutionError(Exception):
    """未授权执行异常"""
    pass


@dataclass
class ExecutionRequest:
    """
    执行请求（必须包含授权决策）
    
    用法：
    request = ExecutionRequest(decision=hub.evaluate(signal))
    executor.execute(request)
    """
    decision: object  # Decision 对象
    symbol: str = ""
    price: float = 0.0
    size: float = 0.0
    
    def __post_init__(self):
        """验证决策授权"""
        if not self._verify_decision():
            raise UnauthorizedExecutionError(
                "❌ 未授权执行！所有交易必须经过 Decision Hub 授权"
            )
    
    def _verify_decision(self) -> bool:
        """验证决策"""
        # 检查是否是 Decision 类型
        if not hasattr(self.decision, 'trace_id'):
            raise UnauthorizedExecutionError(
                "❌ 无效决策对象！必须使用 DecisionHub.evaluate() 返回的 Decision"
            )
        
        # 检查是否授权
        if not getattr(self.decision, 'authorized', False):
            raise UnauthorizedExecutionError(
                "❌ 决策未授权！必须使用 DecisionHub.evaluate() 返回的 Decision"
            )
        
        # 检查哈希验证
        if not getattr(self.decision, 'verify', lambda: False)():
            raise UnauthorizedExecutionError(
                "❌ 决策验证失败！决策可能被篡改"
            )
        
        # 检查是否允许交易
        if not getattr(self.decision, 'can_trade', False):
            return False  # 不允许交易，但不抛异常
        
        return True
    
    def get_position_multiplier(self) -> float:
        """获取仓位倍数"""
        return getattr(self.decision, 'position_multiplier', 1.0)
    
    def get_trace_id(self) -> str:
        """获取追踪 ID"""
        return getattr(self.decision, 'trace_id', '')


class ExecutionGate:
    """
    执行门控
    
    用法：
    gate = ExecutionGate(executor)
    gate.execute(request)  # 只接受 ExecutionRequest
    """
    
    def __init__(self, executor):
        """
        初始化
        
        Args:
            executor: LiveExecutor 实例
        """
        self.executor = executor
        self.stats = {
            'authorized_executions': 0,
            'blocked_executions': 0,
            'unauthorized_attempts': 0
        }
    
    def execute(self, request: ExecutionRequest) -> Optional[dict]:
        """
        执行交易（必须通过 ExecutionRequest）
        
        Args:
            request: ExecutionRequest（包含授权决策）
            
        Returns:
            执行结果
            
        Raises:
            UnauthorizedExecutionError: 未授权执行
        """
        # 验证请求
        if not isinstance(request, ExecutionRequest):
            self.stats['unauthorized_attempts'] += 1
            raise UnauthorizedExecutionError(
                "❌ 必须使用 ExecutionRequest！不允许直接执行"
            )
        
        # 检查是否允许交易
        if not request.decision.can_trade:
            self.stats['blocked_executions'] += 1
            return None
        
        # 获取仓位倍数
        position_multiplier = request.get_position_multiplier()
        
        # 执行交易
        self.stats['authorized_executions'] += 1
        
        # TODO: 调用实际执行器
        # result = await self.executor.execute_signal(...)
        
        return {
            'status': 'authorized',
            'trace_id': request.get_trace_id(),
            'position_multiplier': position_multiplier
        }
    
    def get_stats(self) -> dict:
        """获取统计"""
        return self.stats.copy()


# 测试
if __name__ == "__main__":
    print("🧪 Execution Gate 测试")
    
    from decision_hub import Decision, DecisionType
    
    # 测试未授权决策
    fake_decision = Decision(
        decision_type=DecisionType.EXECUTE,
        can_trade=True,
        position_multiplier=1.0,
        reasons=["测试"],
        checks={},
        timestamp="2026-03-20T03:00:00"
    )
    
    # 不设置 authorized，应该失败
    try:
        request = ExecutionRequest(decision=fake_decision)
        print("❌ 未授权决策应该被拒绝")
    except UnauthorizedExecutionError as e:
        print(f"✅ 正确拒绝: {e}")
    
    # 测试授权决策
    fake_decision.authorized = True
    try:
        request = ExecutionRequest(decision=fake_decision)
        print(f"✅ 授权决策通过: trace_id={request.get_trace_id()}")
    except UnauthorizedExecutionError as e:
        print(f"❌ 授权决策应该通过: {e}")
