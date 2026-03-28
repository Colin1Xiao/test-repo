#!/usr/bin/env python3
"""
OpenClaw 重试策略处理器
Retry Handler with Fine-grained Policies
"""

import time
from typing import Dict, Optional, Tuple, Callable
from dataclasses import dataclass
from enum import Enum


class ErrorType(Enum):
    """错误类型"""
    EMPTY_RESPONSE = "empty_response"
    PROVIDER_SLOW = "provider_slow"
    PROVIDER_ERROR_5XX = "provider_error_5xx"
    PROVIDER_ERROR_4XX = "provider_error_4xx"
    TIMEOUT = "timeout"
    SUBAGENT_FAILED = "subagent_failed"
    UNKNOWN = "unknown"


class RetryPolicy(Enum):
    """重试策略"""
    IMMEDIATE = "immediate"  # 立即重试
    BACKOFF_SHORT = "backoff_short"  # 短退避（2s）
    BACKOFF_LONG = "backoff_long"  # 长退避（5s）
    NO_RETRY = "no_retry"  # 不重试


@dataclass
class RetryConfig:
    """重试配置"""
    error_type: ErrorType
    retryable: bool
    max_retries: int
    policy: RetryPolicy
    fallback_after_retry: bool


class RetryHandler:
    """重试策略处理器"""
    
    def __init__(self):
        # 错误类型到重试配置的映射
        self.retry_policies = {
            ErrorType.EMPTY_RESPONSE: RetryConfig(
                error_type=ErrorType.EMPTY_RESPONSE,
                retryable=True,
                max_retries=1,
                policy=RetryPolicy.IMMEDIATE,
                fallback_after_retry=True
            ),
            ErrorType.PROVIDER_SLOW: RetryConfig(
                error_type=ErrorType.PROVIDER_SLOW,
                retryable=True,
                max_retries=2,
                policy=RetryPolicy.BACKOFF_SHORT,
                fallback_after_retry=True
            ),
            ErrorType.PROVIDER_ERROR_5XX: RetryConfig(
                error_type=ErrorType.PROVIDER_ERROR_5XX,
                retryable=True,
                max_retries=2,
                policy=RetryPolicy.BACKOFF_LONG,
                fallback_after_retry=True
            ),
            ErrorType.PROVIDER_ERROR_4XX: RetryConfig(
                error_type=ErrorType.PROVIDER_ERROR_4XX,
                retryable=False,
                max_retries=0,
                policy=RetryPolicy.NO_RETRY,
                fallback_after_retry=True
            ),
            ErrorType.TIMEOUT: RetryConfig(
                error_type=ErrorType.TIMEOUT,
                retryable=False,
                max_retries=0,
                policy=RetryPolicy.NO_RETRY,
                fallback_after_retry=True
            ),
            ErrorType.SUBAGENT_FAILED: RetryConfig(
                error_type=ErrorType.SUBAGENT_FAILED,
                retryable=True,
                max_retries=1,
                policy=RetryPolicy.IMMEDIATE,
                fallback_after_retry=True
            ),
            ErrorType.UNKNOWN: RetryConfig(
                error_type=ErrorType.UNKNOWN,
                retryable=False,
                max_retries=0,
                policy=RetryPolicy.NO_RETRY,
                fallback_after_retry=True
            )
        }
        
        # 退避时间配置
        self.backoff_delays = {
            RetryPolicy.IMMEDIATE: 0,
            RetryPolicy.BACKOFF_SHORT: 2,
            RetryPolicy.BACKOFF_LONG: 5
        }
        
        # 混合链路重试限制
        self.chain_limits = {
            "max_step_retries": 2,
            "max_chain_retries": 3,
            "main_no_retry": True  # MAIN 汇总不重试
        }
    
    def classify_error(self, error_message: str, status_code: Optional[int] = None) -> ErrorType:
        """
        分类错误类型
        
        输入：
        - error_message: 错误信息
        - status_code: HTTP 状态码（如果有）
        
        输出：
        - ErrorType: 错误类型
        """
        error_lower = error_message.lower()
        
        # 空输出
        if "empty" in error_lower or "blank" in error_lower or len(error_message.strip()) < 10:
            return ErrorType.EMPTY_RESPONSE
        
        # 超时
        if "timeout" in error_lower or "timed out" in error_lower:
            return ErrorType.TIMEOUT
        
        # Provider 错误
        if "provider" in error_lower or "api" in error_lower:
            if status_code:
                if status_code >= 500:
                    return ErrorType.PROVIDER_ERROR_5XX
                elif status_code >= 400:
                    return ErrorType.PROVIDER_ERROR_4XX
            # 慢响应
            if "slow" in error_lower or "latency" in error_lower:
                return ErrorType.PROVIDER_SLOW
            return ErrorType.PROVIDER_ERROR_5XX
        
        # Subagent 失败
        if "subagent" in error_lower:
            return ErrorType.SUBAGENT_FAILED
        
        return ErrorType.UNKNOWN
    
    def get_retry_config(self, error_type: ErrorType) -> RetryConfig:
        """获取重试配置"""
        return self.retry_policies.get(error_type, self.retry_policies[ErrorType.UNKNOWN])
    
    def should_retry(self, error_type: ErrorType, current_retry_count: int,
                    is_main_step: bool = False) -> Tuple[bool, int]:
        """
        判断是否应该重试
        
        输入：
        - error_type: 错误类型
        - current_retry_count: 当前重试次数
        - is_main_step: 是否是 MAIN 汇总步骤
        
        输出：
        - (是否重试, 退避秒数)
        """
        # MAIN 汇总不重试
        if is_main_step and self.chain_limits["main_no_retry"]:
            return False, 0
        
        config = self.get_retry_config(error_type)
        
        # 不可重试
        if not config.retryable:
            return False, 0
        
        # 超过最大重试次数
        if current_retry_count >= config.max_retries:
            return False, 0
        
        # 超过单步限制
        if current_retry_count >= self.chain_limits["max_step_retries"]:
            return False, 0
        
        # 计算退避时间
        delay = self.backoff_delays.get(config.policy, 0)
        
        return True, delay
    
    def execute_with_retry(self, execute_func: Callable, error_type: ErrorType,
                          is_main_step: bool = False) -> Dict:
        """
        执行带重试
        
        输入：
        - execute_func: 执行函数
        - error_type: 错误类型
        - is_main_step: 是否是 MAIN 步骤
        
        输出：
        - 执行结果
        """
        config = self.get_retry_config(error_type)
        retry_count = 0
        
        while True:
            try:
                # 执行
                result = execute_func(retry=retry_count > 0)
                
                # 成功
                if result.get("success"):
                    return {
                        "success": True,
                        "result": result,
                        "retries": retry_count,
                        "error_type": error_type.value
                    }
                
                # 失败，检查是否可重试
                should_retry, delay = self.should_retry(
                    error_type, retry_count, is_main_step
                )
                
                if not should_retry:
                    # 不可重试，返回失败
                    return {
                        "success": False,
                        "result": result,
                        "retries": retry_count,
                        "error_type": error_type.value,
                        "message": "重试次数耗尽或不可重试"
                    }
                
                # 重试
                retry_count += 1
                if delay > 0:
                    time.sleep(delay)
                
            except Exception as e:
                # 执行异常
                should_retry, delay = self.should_retry(
                    error_type, retry_count, is_main_step
                )
                
                if not should_retry:
                    return {
                        "success": False,
                        "error": str(e),
                        "retries": retry_count,
                        "error_type": error_type.value,
                        "message": "执行异常且不可重试"
                    }
                
                retry_count += 1
                if delay > 0:
                    time.sleep(delay)
    
    def get_retry_summary(self) -> Dict:
        """获取重试策略摘要"""
        summary = {}
        
        for error_type, config in self.retry_policies.items():
            summary[error_type.value] = {
                "retryable": config.retryable,
                "max_retries": config.max_retries,
                "policy": config.policy.value,
                "fallback_after": "是" if config.fallback_after_retry else "否"
            }
        
        return summary


class ChainRetryLimiter:
    """链路重试限制器"""
    
    def __init__(self, max_chain_retries: int = 3):
        self.max_chain_retries = max_chain_retries
        self.chain_retry_counts: Dict[str, int] = {}
    
    def can_retry_chain(self, chain_id: str) -> bool:
        """检查链路是否可重试"""
        current = self.chain_retry_counts.get(chain_id, 0)
        return current < self.max_chain_retries
    
    def increment_chain_retry(self, chain_id: str):
        """增加链路重试计数"""
        if chain_id not in self.chain_retry_counts:
            self.chain_retry_counts[chain_id] = 0
        self.chain_retry_counts[chain_id] += 1
    
    def reset_chain_retry(self, chain_id: str):
        """重置链路重试计数"""
        self.chain_retry_counts[chain_id] = 0


if __name__ == "__main__":
    # 测试重试处理器
    print("测试重试策略处理器...")
    
    handler = RetryHandler()
    
    # 打印重试策略摘要
    print("\n重试策略摘要:")
    summary = handler.get_retry_summary()
    for error_type, config in summary.items():
        print(f"  {error_type}:")
        print(f"    可重试: {config['retryable']}")
        print(f"    最大重试: {config['max_retries']}")
        print(f"    策略: {config['policy']}")
        print(f"    失败后 fallback: {config['fallback_after']}")
    
    # 测试错误分类
    test_errors = [
        ("Empty response", None),
        ("Timeout error", None),
        ("Provider 500 error", 500),
        ("Provider 404 error", 404),
        ("Slow response", None),
        ("Unknown error", None)
    ]
    
    print("\n错误分类测试:")
    for msg, code in test_errors:
        error_type = handler.classify_error(msg, code)
        config = handler.get_retry_config(error_type)
        print(f"  '{msg}' ({code}) -> {error_type.value}, 可重试: {config.retryable}")