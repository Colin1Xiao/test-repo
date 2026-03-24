#!/usr/bin/env python3
"""
Execution Engine - 异步执行引擎

核心功能：
1. 独立线程执行交易
2. 信号队列隔离
3. 防重复、防过期、防并发
"""

import threading
import time
import asyncio
from queue import Queue, Empty
from typing import Dict, Optional, Callable
from datetime import datetime
from dataclasses import dataclass


@dataclass
class Signal:
    """交易信号"""
    symbol: str
    signal_price: float
    score: int
    regime: str
    volume_ratio: float
    timestamp: float
    margin_usd: float = 3.0  # 默认保证金
    
    def is_stale(self, max_delay_ms: float = 1000.0) -> bool:
        """检查信号是否过期"""
        age_ms = (time.time() - self.timestamp) * 1000
        return age_ms > max_delay_ms
    
    def age_ms(self) -> float:
        """信号年龄（毫秒）"""
        return (time.time() - self.timestamp) * 1000


class ExecutionEngine:
    """
    异步执行引擎
    
    架构：
    ┌─────────────┐
    │ Main Loop   │ → 分析层
    └──────┬──────┘
           ↓
    ┌─────────────┐
    │ Signal Queue│ → 信号队列
    └──────┬──────┘
           ↓
    ┌─────────────┐
    │ Exec Thread │ → 执行层（独立线程）
    └─────────────┘
    """
    
    def __init__(self, executor, max_queue_size: int = 10, position_check_callback=None):
        """
        初始化执行引擎
        
        Args:
            executor: LiveExecutor 实例
            max_queue_size: 最大队列长度
            position_check_callback: 持仓检查回调函数，返回 bool
        """
        self.executor = executor
        self.queue: Queue = Queue(maxsize=max_queue_size)
        self.running = False
        self.thread: Optional[threading.Thread] = None
        self.position_check_callback = position_check_callback
        
        # 执行锁（防并发）
        self.lock = threading.Lock()
        self.executing = False
        
        # 统计
        self.stats = {
            'signals_received': 0,
            'signals_executed': 0,
            'signals_skipped_stale': 0,
            'signals_skipped_busy': 0,
            'signals_skipped_position': 0,
            'errors': 0
        }
        
        # 回调
        self.on_execution: Optional[Callable] = None
    
    def start(self):
        """启动执行引擎"""
        if self.running:
            print("⚠️ Execution Engine 已经运行")
            return
        
        self.running = True
        self.thread = threading.Thread(target=self._run_loop, daemon=True)
        self.thread.start()
        print("✅ Execution Engine 已启动")
    
    def stop(self):
        """停止执行引擎"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=2.0)
        print("🛑 Execution Engine 已停止")
    
    def submit(self, signal: Signal) -> bool:
        """
        提交信号到队列
        
        Args:
            signal: 交易信号
            
        Returns:
            是否成功入队
        """
        self.stats['signals_received'] += 1
        
        # 检查队列积压
        if self.queue.qsize() > 0:
            print(f"⚠️ 队列积压 ({self.queue.qsize()}), 跳过旧信号")
            self.stats['signals_skipped_busy'] += 1
            return False
        
        try:
            self.queue.put(signal, block=False)
            print(f"📥 信号入队: {signal.symbol} @ {signal.signal_price:.2f} (age: {signal.age_ms():.0f}ms)")
            return True
        except Exception as e:
            print(f"❌ 信号入队失败: {e}")
            return False
    
    def _run_loop(self):
        """执行循环（独立线程）"""
        print("🔄 Execution Engine 循环启动")
        
        while self.running:
            try:
                # 非阻塞获取
                try:
                    signal = self.queue.get(timeout=0.1)
                except Empty:
                    continue
                
                # 执行信号
                self._execute_signal(signal)
                
            except Exception as e:
                print(f"❌ Execution Engine 错误: {e}")
                self.stats['errors'] += 1
            
            # 防止 CPU 飙升
            time.sleep(0.001)
        
        print("🔄 Execution Engine 循环结束")
    
    def _execute_signal(self, signal: Signal):
        """执行信号"""
        # 1. 检查信号过期
        if signal.is_stale(max_delay_ms=1000.0):
            print(f"⚠️ SKIP STALE SIGNAL: {signal.symbol} (age: {signal.age_ms():.0f}ms)")
            self.stats['signals_skipped_stale'] += 1
            return
        
        # 2. 检查执行锁（防并发）
        if not self.lock.acquire(blocking=False):
            print(f"⚠️ 执行中，跳过: {signal.symbol}")
            self.stats['signals_skipped_busy'] += 1
            return
        
        try:
            # 3. 检查已有持仓（使用回调或默认方法）
            has_position = False
            if self.position_check_callback:
                has_position = self.position_check_callback(signal.symbol)
            elif hasattr(self.executor, 'has_open_position'):
                has_position = self.executor.has_open_position(signal.symbol)
            
            if has_position:
                print(f"⚠️ 已有持仓，跳过: {signal.symbol}")
                self.stats['signals_skipped_position'] += 1
                return
            
            # 4. 执行交易
            print(f"\n{'='*50}")
            print(f"🚀 EXECUTION ENGINE TRIGGERED")
            print(f"   Symbol: {signal.symbol}")
            print(f"   Price: {signal.signal_price:.2f}")
            print(f"   Score: {signal.score}")
            print(f"   Age: {signal.age_ms():.0f}ms")
            print(f"{'='*50}")
            
            exec_start = time.time()
            
            # 创建新事件循环（线程安全）
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            try:
                result = loop.run_until_complete(
                    self.executor.execute_signal(
                        symbol=signal.symbol,
                        signal_price=signal.signal_price,
                        margin_usd=signal.margin_usd,
                        signal_time=datetime.fromtimestamp(signal.timestamp)
                    )
                )
            finally:
                loop.close()
            
            exec_time = (time.time() - exec_start) * 1000
            
            if result:
                self.stats['signals_executed'] += 1
                print(f"✅ 执行完成: {exec_time:.0f}ms")
                
                # 触发回调
                if self.on_execution:
                    self.on_execution(signal, result, exec_time)
            else:
                print(f"⚠️ 执行返回 None")
                
        except Exception as e:
            print(f"❌ 执行失败: {e}")
            self.stats['errors'] += 1
            
        finally:
            self.lock.release()
    
    def get_stats(self) -> Dict:
        """获取统计信息"""
        return {
            **self.stats,
            'queue_size': self.queue.qsize(),
            'is_running': self.running,
            'is_executing': self.executing
        }
    
    def report(self) -> str:
        """生成报告"""
        stats = self.get_stats()
        total = stats['signals_received']
        executed = stats['signals_executed']
        
        if total == 0:
            return "📊 暂无统计数据"
        
        rate = executed / total * 100 if total > 0 else 0
        
        return f"""
📊 Execution Engine Stats
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  信号接收: {total}
  执行成功: {executed} ({rate:.1f}%)
  过期跳过: {stats['signals_skipped_stale']}
  忙碌跳过: {stats['signals_skipped_busy']}
  持仓跳过: {stats['signals_skipped_position']}
  执行错误: {stats['errors']}
  当前队列: {stats['queue_size']}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""


# 测试代码
if __name__ == "__main__":
    print("🧪 Execution Engine 测试")
    
    # 模拟 executor
    class MockExecutor:
        def has_open_position(self, symbol):
            return False
        
        async def execute_signal(self, **kwargs):
            print(f"📝 执行交易: {kwargs}")
            await asyncio.sleep(0.5)
            return {'status': 'filled'}
    
    engine = ExecutionEngine(MockExecutor())
    engine.start()
    
    # 提交测试信号
    signal = Signal(
        symbol="ETH/USDT:USDT",
        signal_price=2200.0,
        score=50,
        regime="range",
        volume_ratio=1.0,
        timestamp=time.time()
    )
    
    engine.submit(signal)
    
    time.sleep(2)
    
    print(engine.report())
    
    engine.stop()