#!/usr/bin/env python3
"""
Execution Engine - 生产级执行引擎 V2

核心原则：
1. 一个线程 = 一个 event loop = 永不关闭
2. timeout 后必须 cancel task
3. 所有异步资源绑定到同一个 loop

修复：
- 不再每次创建新 loop
- 不再手动关闭 loop
- timeout 后正确 cancel
"""

import threading
import time
import asyncio
from queue import Queue, Empty
from typing import Dict, Optional, Callable
from datetime import datetime
from dataclasses import dataclass

# V5.4 Safe Execution 集成
# 添加 V5.4 安全链：Lock → Gate → Entry → Stop Loss → Record
# V5.4.1 路径修复
import sys
sys.path.insert(0, '/Users/colin/.openclaw/workspace/trading_system_v5_4/core')

# 直接导入 V5.4 模块 (不使用 core.前缀)
from safe_execution_assembly import (
    get_safe_execution_v54_cached,
    signal_to_execution_context,
)


@dataclass
class Signal:
    """交易信号"""
    symbol: str
    signal_price: float
    score: int
    regime: str
    volume_ratio: float
    timestamp: float
    margin_usd: float = 3.0
    
    def is_stale(self, max_delay_ms: float = 1000.0) -> bool:
        age_ms = (time.time() - self.timestamp) * 1000
        return age_ms > max_delay_ms
    
    def age_ms(self) -> float:
        return (time.time() - self.timestamp) * 1000


class ExecutionEngine:
    """
    生产级执行引擎 V2
    
    核心架构：
    - 单一 event loop（初始化时创建，永不关闭）
    - 独立执行线程
    - 正确的 timeout 处理（cancel task）
    """
    
    def __init__(self, executor, max_queue_size: int = 10):
        self.executor = executor
        self.queue: Queue = Queue(maxsize=max_queue_size)
        self.running = False
        self.thread: Optional[threading.Thread] = None
        
        # 🔥 核心：固定 event loop（一个线程一个 loop，永不关闭）
        self.loop: Optional[asyncio.AbstractEventLoop] = None
        
        # 执行锁
        self.lock = threading.Lock()
        
        # 统计
        self.stats = {
            'signals_received': 0,
            'signals_executed': 0,
            'signals_skipped_stale': 0,
            'signals_skipped_busy': 0,
            'signals_skipped_position': 0,
            'errors': 0,
            'timeouts': 0
        }
        
        # 回调
        self.on_execution: Optional[Callable] = None
    
    def start(self):
        """启动执行引擎"""
        if self.running:
            print("⚠️ Execution Engine 已经运行")
            return
        
        # 🔥 初始化时创建 event loop（只创建一次）
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)
        print("✅ Event Loop 创建完成")
        
        self.running = True
        self.thread = threading.Thread(target=self._run_loop, daemon=True)
        self.thread.start()
        print("✅ Execution Engine V2 已启动")
    
    def stop(self):
        """停止执行引擎"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=2.0)
        # 注意：不关闭 loop，让它随线程结束自然清理
        print("🛑 Execution Engine 已停止")
    
    def submit(self, signal: Signal) -> bool:
        """提交信号到队列"""
        self.stats['signals_received'] += 1
        
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
                try:
                    signal = self.queue.get(timeout=0.1)
                except Empty:
                    continue
                
                self._execute_signal(signal)
                
            except Exception as e:
                print(f"❌ Execution Engine 错误: {e}")
                self.stats['errors'] += 1
            
            time.sleep(0.001)
        
        print("🔄 Execution Engine 循环结束")
    
    def _execute_signal(self, signal: Signal):
        """执行信号（生产级版本）"""
        # 1. 检查信号过期
        if signal.is_stale(max_delay_ms=1000.0):
            print(f"⚠️ SKIP STALE: {signal.symbol} (age: {signal.age_ms():.0f}ms)")
            self.stats['signals_skipped_stale'] += 1
            return
        
        # 2. 检查执行锁
        if not self.lock.acquire(blocking=False):
            print(f"⚠️ 执行中，跳过: {signal.symbol}")
            self.stats['signals_skipped_busy'] += 1
            return
        
        try:
            # 3. 检查已有持仓
            if self.executor.has_open_position(signal.symbol):
                print(f"⚠️ 已有持仓，跳过: {signal.symbol}")
                self.stats['signals_skipped_position'] += 1
                return
            
            # 4. 执行交易
            print(f"\n{'='*50}")
            print(f"🚀 EXECUTION ENGINE V2 TRIGGERED")
            print(f"   Symbol: {signal.symbol}")
            print(f"   Price: {signal.signal_price:.2f}")
            print(f"   Score: {signal.score}")
            print(f"   Age: {signal.age_ms():.0f}ms")
            print(f"{'='*50}")
            
            exec_start = time.time()
            result = None
            task = None
            
            try:
                # 🔥 V5.4 Safe Execution 集成
                async def execute_async():
                    # Step 1: Signal → ExecutionContext 映射
                    ctx = signal_to_execution_context(signal)
                    if ctx is None:
                        print(f"❌ Signal 转 ExecutionContext 失败")
                        return None
                    
                    # Step 2: 调用 SafeExecutionV54 (包含 Lock + Gate + Stop)
                    safe_exec = get_safe_execution_v54_cached()
                    if safe_exec is None:
                        print(f"❌ SafeExecutionV54 未装配")
                        return None
                    
                    # Step 3: 执行并返回结果
                    result = await safe_exec.execute_entry(ctx)
                    
                    # 封装符合旧接口的返回格式
                    if result.accepted:
                        return {
                            "ok": True,
                            "execution_price": result.order_result.get("execution_price", 0),
                            "filled_size": result.order_result.get("filled_size", 0),
                            "order_id": result.order_result.get("order_id", ""),
                            "stop_ok": result.gate_snapshot.get("stop_ok", False),
                            "stop_verified": result.gate_snapshot.get("stop_verified", False),
                            "v54_enabled": True,
                        }
                    else:
                        print(f"⚠️ SafeExecutionV54 拒绝：{result.reason}")
                        return None
                
                # 创建 task
                task = self.loop.create_task(execute_async())
                
                # 🔥 正确的 timeout 处理
                try:
                    result = self.loop.run_until_complete(
                        asyncio.wait_for(task, timeout=15.0)  # 增加到 15 秒
                    )
                    print("🚀 STEP FINAL: 执行完成")
                    
                except asyncio.TimeoutError:
                    print(f"🔥 EXECUTION TIMEOUT: {signal.symbol} 超过15秒")
                    self.stats['timeouts'] += 1
                    
                    # 🔥 关键：timeout 后必须 cancel task
                    if task and not task.done():
                        task.cancel()
                        print(f"📤 已取消超时任务")
                        
                        # 等待 task 完成 cancel
                        try:
                            self.loop.run_until_complete(asyncio.sleep(0.1))
                        except:
                            pass
                    
                except Exception as e:
                    print(f"❌ 执行错误: {e}")
                    if task and not task.done():
                        task.cancel()
                        
            except Exception as e:
                print(f"❌ 异步执行错误: {e}")
                import traceback
                traceback.print_exc()
            
            exec_time = (time.time() - exec_start) * 1000
            
            if result:
                self.stats['signals_executed'] += 1
                print(f"✅ 执行完成: {exec_time:.0f}ms")
                
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
        return {
            **self.stats,
            'queue_size': self.queue.qsize(),
            'is_running': self.running,
            'loop_created': self.loop is not None
        }
    
    def report(self) -> str:
        stats = self.get_stats()
        total = stats['signals_received']
        executed = stats['signals_executed']
        
        if total == 0:
            return "📊 暂无统计数据"
        
        rate = executed / total * 100 if total > 0 else 0
        
        return f"""
📊 Execution Engine V2 Stats
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  信号接收: {total}
  执行成功: {executed} ({rate:.1f}%)
  超时: {stats['timeouts']}
  过期跳过: {stats['signals_skipped_stale']}
  忙碌跳过: {stats['signals_skipped_busy']}
  持仓跳过: {stats['signals_skipped_position']}
  执行错误: {stats['errors']}
  当前队列: {stats['queue_size']}
  Loop状态: {'✅ 已创建' if stats['loop_created'] else '❌ 未创建'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""


if __name__ == "__main__":
    print("🧪 Execution Engine V2 测试")
    
    class MockExecutor:
        def has_open_position(self, symbol):
            return False
        
        async def execute_signal(self, **kwargs):
            print(f"📝 执行交易: {kwargs}")
            await asyncio.sleep(0.5)
            return {'status': 'filled'}
    
    engine = ExecutionEngine(MockExecutor())
    engine.start()
    
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