#!/usr/bin/env python3
"""
Timeout Controller - 超时强制控制

核心功能：
1. 所有 API 调用包装超时
2. 超时自动取消
3. 防止线程卡死

使用：
from core.timeout_controller import with_timeout

safe_create_order = with_timeout(exchange.create_order, timeout=2.0)
order = safe_create_order(symbol, type, side, amount)
"""

import signal
import threading
from functools import wraps
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from typing import Callable, Any


class TimeoutError(Exception):
    """超时错误"""
    pass


class TimeoutController:
    """
    超时控制器
    
    使用线程池实现超时控制（线程安全）
    """
    
    def __init__(self, default_timeout: float = 5.0, max_workers: int = 4):
        """
        初始化
        
        Args:
            default_timeout: 默认超时（秒）
            max_workers: 线程池大小
        """
        self.default_timeout = default_timeout
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        
        # 统计
        self.stats = {
            'calls': 0,
            'timeouts': 0,
            'errors': 0
        }
    
    def call_with_timeout(
        self,
        func: Callable,
        timeout: float = None,
        *args,
        **kwargs
    ) -> Any:
        """
        带超时的函数调用
        
        Args:
            func: 要调用的函数
            timeout: 超时时间（秒）
            *args: 位置参数
            **kwargs: 关键字参数
            
        Returns:
            函数返回值
            
        Raises:
            TimeoutError: 超时
        """
        timeout = timeout or self.default_timeout
        self.stats['calls'] += 1
        
        future = self.executor.submit(func, *args, **kwargs)
        
        try:
            return future.result(timeout=timeout)
        except FuturesTimeoutError:
            self.stats['timeouts'] += 1
            future.cancel()
            raise TimeoutError(f"API call timeout after {timeout}s: {func.__name__}")
        except Exception as e:
            self.stats['errors'] += 1
            raise
    
    def wrap(self, func: Callable, timeout: float = None) -> Callable:
        """
        包装函数，添加超时控制
        
        Args:
            func: 要包装的函数
            timeout: 超时时间
            
        Returns:
            包装后的函数
        """
        @wraps(func)
        def wrapper(*args, **kwargs):
            return self.call_with_timeout(func, timeout, *args, **kwargs)
        return wrapper
    
    def get_stats(self) -> dict:
        """获取统计"""
        return self.stats.copy()
    
    def shutdown(self):
        """关闭线程池"""
        self.executor.shutdown(wait=False)


# 全局实例
_controller: TimeoutController = None


def get_timeout_controller() -> TimeoutController:
    """获取全局超时控制器"""
    global _controller
    if _controller is None:
        _controller = TimeoutController()
    return _controller


def with_timeout(timeout: float = 5.0):
    """
    装饰器：为函数添加超时控制
    
    使用：
    @with_timeout(timeout=2.0)
    def my_api_call():
        ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            controller = get_timeout_controller()
            return controller.call_with_timeout(func, timeout, *args, **kwargs)
        return wrapper
    return decorator


# 测试
if __name__ == "__main__":
    import time
    
    print("🧪 超时控制器测试")
    
    controller = TimeoutController(default_timeout=1.0)
    
    # 测试正常调用
    def fast_call():
        time.sleep(0.1)
        return "OK"
    
    result = controller.call_with_timeout(fast_call)
    print(f"✅ 正常调用: {result}")
    
    # 测试超时
    def slow_call():
        time.sleep(3.0)
        return "OK"
    
    try:
        controller.call_with_timeout(slow_call, timeout=0.5)
        print("❌ 应该超时但没有")
    except TimeoutError as e:
        print(f"✅ 超时正确: {e}")
    
    print(f"\n📊 统计: {controller.get_stats()}")
