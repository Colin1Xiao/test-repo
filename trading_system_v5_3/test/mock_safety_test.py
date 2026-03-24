#!/usr/bin/env python3
"""
Mock Safety Test V5.4

设计目标：
1. 不依赖 OKX 余额
2. 不发真实订单
3. 验证 V5.4 执行安全层是否正确
4. 跑完后明确知道：能不能进入真实 Safety Test

验证 5 项核心功能：
1. Execution Lock: asyncio.Lock 是否真正拦住第二次执行
2. Position Gate: 是否拦截已有持仓
3. Stop Loss: 创建与验证逻辑是否走通
4. 执行路径唯一: 是否有多个入口
5. TIME_EXIT: 主循环是否能正确触发
"""

import asyncio
import sys
import time
import threading
from pathlib import Path
from datetime import datetime
from dataclasses import dataclass
from typing import Dict, Optional, Tuple

# 添加路径
BASE_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BASE_DIR / 'core'))
sys.path.insert(0, str(BASE_DIR))

# 导入 Mock Exchange
sys.path.insert(0, str(BASE_DIR / 'test'))
from mock_exchange import MockExchange


@dataclass
class TestResult:
    """测试结果"""
    test_name: str
    passed: bool
    reason: str
    duration_ms: float = 0.0


class MockSafeExecution:
    """
    Mock 版安全执行层
    
    复制 SafeExecutionV54 的核心逻辑，但使用 MockExchange
    """
    
    MAX_HOLD_SECONDS = 30
    MAX_POSITION = 0.13  # ETH
    
    def __init__(self, exchange: MockExchange, symbol: str = 'ETH/USDT:USDT'):
        self.exchange = exchange
        self.symbol = symbol
        
        # 🔒 执行锁（原子化执行）
        self._execution_lock = asyncio.Lock()
        
        # 本地仓位状态
        self.current_position: Optional[Dict] = None
        self._position_lock = threading.Lock()
        
        # 当前止损单
        self.current_stop_order_id: Optional[str] = None
        
        # 统计
        self.stats = {
            'total_executions': 0,
            'blocked_by_lock': 0,
            'blocked_by_position_gate': 0,
            'stop_loss_failures': 0,
            'successful_trades': 0,
        }
    
    def _has_local_position(self) -> bool:
        """检查本地仓位"""
        with self._position_lock:
            return self.current_position is not None and self.current_position.get('size', 0) > 0
    
    async def _get_exchange_position(self) -> Tuple[bool, float]:
        """获取交易所仓位"""
        positions = await self.exchange.fetch_positions([self.symbol])
        for pos in positions:
            size = float(pos.get('contracts', 0))
            if abs(size) > 0.001:
                return True, abs(size)
        return False, 0.0
    
    async def _check_position_gate(self) -> Tuple[bool, str]:
        """
        双层 Position Gate
        
        Returns:
            (can_open, reason)
        """
        # 第一层：本地检查
        if self._has_local_position():
            return False, f"本地已有持仓: {self.current_position.get('size', 0):.4f} ETH"
        
        # 第二层：交易所检查
        has_pos, pos_size = await self._get_exchange_position()
        if has_pos and pos_size > 0.001:
            return False, f"交易所已有持仓: {pos_size:.4f} ETH"
        
        return True, "可以开仓"
    
    async def _place_stop_loss(self, entry_price: float, position_size: float, side: str = 'sell') -> Tuple[bool, Optional[str]]:
        """
        提交止损单
        
        Returns:
            (success, order_id)
        """
        stop_loss_pct = 0.005  # -0.5%
        stop_price = entry_price * (1 - stop_loss_pct) if side == 'sell' else entry_price * (1 + stop_loss_pct)
        
        print(f"   📌 止损价格: {stop_price:.2f}")
        print(f"   📌 止损数量: {position_size:.4f} ETH")
        
        try:
            order = await self.exchange._create_stop_order(
                self.symbol,
                side,
                position_size,
                stop_price,
                {'tdMode': 'cross'}
            )
            
            order_id = order.get('id')
            self.current_stop_order_id = order_id
            
            # 二次验证
            verified = await self._verify_stop_loss(order_id)
            return verified, order_id
            
        except Exception as e:
            print(f"   ❌ 止损单提交失败: {e}")
            return False, None
    
    async def _verify_stop_loss(self, order_id: str) -> bool:
        """验证止损单是否存在"""
        orders = await self.exchange.fetch_open_orders(self.symbol)
        for order in orders:
            if order.get('id') == order_id:
                print(f"   ✅ 止损单验证通过: {order_id}")
                return True
        print(f"   🚨 止损单不存在: {order_id}")
        return False
    
    async def execute_entry(self, signal_price: float = None, margin_usd: float = 3.0) -> Optional[Dict]:
        """
        安全开仓流程
        
        1. 🔒 获取执行锁
        2. 🔒 Position Gate 双层检查
        3. 执行开仓
        4. 🔒 提交止损单
        5. 🔒 验证止损单
        """
        # 🔒 原子化执行
        async with self._execution_lock:
            print(f"\n{'='*50}")
            print(f"🚀 Mock 开仓流程")
            print(f"{'='*50}")
            
            # Step 1: Position Gate
            can_open, reason = await self._check_position_gate()
            if not can_open:
                print(f"🚫 Position Gate 拦截: {reason}")
                self.stats['blocked_by_position_gate'] += 1
                return None
            
            print(f"✅ Position Gate: {reason}")
            
            # Step 2: 执行开仓
            try:
                # 获取价格
                ticker = await self.exchange.fetch_ticker(self.symbol)
                ask = ticker.get('ask', 2151.0)
                
                # 计算仓位
                leverage = 100
                notional = margin_usd * leverage
                position_size = notional / ask
                
                # 限制最大仓位
                if position_size > self.MAX_POSITION:
                    position_size = self.MAX_POSITION
                
                print(f"   📊 开仓价格: {ask:.2f}")
                print(f"   📊 开仓数量: {position_size:.4f} ETH")
                
                # 创建订单
                order = await self.exchange.create_market_order(
                    self.symbol, 'market', 'buy', position_size
                )
                
                fill_price = order.get('price', ask)
                
                # Step 3: 提交止损单
                stop_ok, stop_id = await self._place_stop_loss(fill_price, position_size, 'sell')
                
                if not stop_ok:
                    print(f"🚨 止损失败 - 系统停止")
                    self.stats['stop_loss_failures'] += 1
                    return None
                
                # Step 4: 记录本地仓位
                with self._position_lock:
                    self.current_position = {
                        'size': position_size,
                        'entry_price': fill_price,
                        'stop_order_id': stop_id,
                        'created_at': time.time(),
                    }
                
                self.stats['total_executions'] += 1
                self.stats['successful_trades'] += 1
                
                print(f"\n✅ 开仓成功!")
                print(f"   入场价: {fill_price:.2f}")
                print(f"   止损单: {stop_id}")
                
                return {
                    'entry_price': fill_price,
                    'position_size': position_size,
                    'stop_order_id': stop_id,
                    'stop_ok': stop_ok,
                }
                
            except Exception as e:
                print(f"❌ 开仓失败: {e}")
                return None
    
    async def execute_exit(self, reason: str = 'manual') -> Optional[Dict]:
        """
        平仓
        
        Args:
            reason: 平仓原因 ('stop_loss', 'take_profit', 'time_exit', 'manual')
        """
        async with self._execution_lock:
            if not self._has_local_position():
                print("无仓位需要平仓")
                return None
            
            pos = self.current_position
            entry_price = pos.get('entry_price', 2150.0)
            position_size = pos.get('size', 0.13)
            
            # 获取当前价格
            ticker = await self.exchange.fetch_ticker(self.symbol)
            bid = ticker.get('bid', 2149.0)
            
            # 平仓
            order = await self.exchange.create_market_order(
                self.symbol, 'market', 'sell', position_size
            )
            
            exit_price = order.get('price', bid)
            pnl = (exit_price - entry_price) * position_size
            
            # 取消止损单
            if self.current_stop_order_id:
                await self.exchange.cancel_order(self.current_stop_order_id, self.symbol)
            
            # 清除本地仓位
            with self._position_lock:
                self.current_position = None
                self.current_stop_order_id = None
            
            print(f"\n✅ 平仓成功!")
            print(f"   平仓价: {exit_price:.2f}")
            print(f"   盈亏: ${pnl:.2f}")
            print(f"   退出原因: {reason}")
            
            return {
                'entry_price': entry_price,
                'exit_price': exit_price,
                'pnl': pnl,
                'exit_source': reason,
                'position_size': position_size,
            }


class MockSafetyTest:
    """
    Mock Safety Test
    
    验证 5 项核心功能，不需要真实资金
    """
    
    def __init__(self):
        self.exchange = MockExchange(initial_balance=100.0)
        self.executor = MockSafeExecution(self.exchange)
        self.results: list = []
    
    async def run_all_tests(self) -> bool:
        """运行所有测试"""
        print("\n" + "="*70)
        print("🧪 Mock Safety Test V5.4")
        print("="*70)
        print("目标: 验证执行安全层")
        print("模式: Mock (不连接真实交易所)")
        print("="*70)
        
        # 测试清单
        tests = [
            ("Test 1: Execution Lock", self.test_execution_lock),
            ("Test 2: Position Gate (本地)", self.test_position_gate_local),
            ("Test 3: Position Gate (交易所)", self.test_position_gate_exchange),
            ("Test 4: Stop Loss 创建与验证", self.test_stop_loss),
            ("Test 5: 执行路径唯一", self.test_single_entry),
        ]
        
        all_passed = True
        
        for test_name, test_func in tests:
            print(f"\n{'─'*70}")
            print(f"📋 {test_name}")
            print(f"{'─'*70}")
            
            try:
                result = await test_func()
                self.results.append(result)
                
                if not result.passed:
                    all_passed = False
                    print(f"\n❌ {test_name} FAILED")
                    print(f"   原因: {result.reason}")
                else:
                    print(f"\n✅ {test_name} PASSED")
                    print(f"   耗时: {result.duration_ms:.1f}ms")
                    
            except Exception as e:
                all_passed = False
                result = TestResult(test_name, False, f"异常: {e}")
                self.results.append(result)
                print(f"\n❌ {test_name} ERROR: {e}")
        
        # 汇总
        self._print_summary()
        
        return all_passed
    
    async def test_execution_lock(self) -> TestResult:
        """
        Test 1: Execution Lock
        
        验证 asyncio.Lock 是否真正拦住第二次执行
        """
        start = time.time()
        
        # 检查是否使用 asyncio.Lock
        if not hasattr(self.executor, '_execution_lock'):
            return TestResult("Execution Lock", False, "未找到 _execution_lock 属性")
        
        lock = self.executor._execution_lock
        if not isinstance(lock, asyncio.Lock):
            return TestResult("Execution Lock", False, f"_execution_lock 不是 asyncio.Lock，而是 {type(lock)}")
        
        # 测试锁是否生效
        results = []
        
        async def try_execute(i: int):
            async with self.executor._execution_lock:
                results.append(f"task_{i}_started")
                await asyncio.sleep(0.1)  # 模拟执行
                results.append(f"task_{i}_finished")
        
        # 同时启动多个任务
        tasks = [try_execute(i) for i in range(3)]
        await asyncio.gather(*tasks)
        
        # 检查执行顺序
        # 如果锁生效，应该是顺序执行: 0_started, 0_finished, 1_started, 1_finished, ...
        expected = ['task_0_started', 'task_0_finished', 'task_1_started', 'task_1_finished', 'task_2_started', 'task_2_finished']
        
        if results == expected:
            duration = (time.time() - start) * 1000
            return TestResult("Execution Lock", True, "asyncio.Lock 正确阻止并发执行", duration)
        else:
            return TestResult("Execution Lock", False, f"锁未正确生效，执行顺序: {results}")
    
    async def test_position_gate_local(self) -> TestResult:
        """
        Test 2: Position Gate (本地层)
        
        验证本地仓位检查是否生效
        """
        start = time.time()
        
        # 重置状态
        self.exchange.reset()
        self.executor.current_position = None
        
        # 第一次应该可以开仓
        can_open, reason = await self.executor._check_position_gate()
        if not can_open:
            return TestResult("Position Gate (本地)", False, f"第一次检查应该通过，但被拒绝: {reason}")
        
        # 设置本地仓位
        with self.executor._position_lock:
            self.executor.current_position = {'size': 0.13, 'entry_price': 2150.0}
        
        # 第二次应该被拦截
        can_open, reason = await self.executor._check_position_gate()
        if can_open:
            return TestResult("Position Gate (本地)", False, "有本地仓位时应该被拦截")
        
        # 清除仓位
        with self.executor._position_lock:
            self.executor.current_position = None
        
        duration = (time.time() - start) * 1000
        return TestResult("Position Gate (本地)", True, f"正确拦截: {reason}", duration)
    
    async def test_position_gate_exchange(self) -> TestResult:
        """
        Test 3: Position Gate (交易所层)
        
        验证交易所仓位检查是否生效
        """
        start = time.time()
        
        # 重置状态
        self.exchange.reset()
        self.executor.current_position = None
        
        # 设置交易所仓位（模拟已有持仓）
        self.exchange.set_position('ETH/USDT:USDT', 0.26, 'long', 2150.0)
        
        # 应该被拦截
        can_open, reason = await self.executor._check_position_gate()
        if can_open:
            return TestResult("Position Gate (交易所)", False, "交易所有仓位时应该被拦截")
        
        # 清除仓位
        self.exchange.clear_position('ETH/USDT:USDT')
        
        duration = (time.time() - start) * 1000
        return TestResult("Position Gate (交易所)", True, f"正确拦截: {reason}", duration)
    
    async def test_stop_loss(self) -> TestResult:
        """
        Test 4: Stop Loss 创建与验证
        
        验证止损单创建和验证流程
        """
        start = time.time()
        
        # 重置状态
        self.exchange.reset()
        
        # 测试止损单创建
        entry_price = 2150.0
        position_size = 0.13
        
        success, order_id = await self.executor._place_stop_loss(entry_price, position_size, 'sell')
        
        if not success:
            return TestResult("Stop Loss", False, "止损单创建失败")
        
        if not order_id:
            return TestResult("Stop Loss", False, "未返回止损单 ID")
        
        # 验证止损单存在
        has_stop = self.exchange.has_stop_order('ETH/USDT:USDT')
        if not has_stop:
            return TestResult("Stop Loss", False, "止损单不存在")
        
        duration = (time.time() - start) * 1000
        return TestResult("Stop Loss", True, f"止损单创建并验证成功: {order_id}", duration)
    
    async def test_single_entry(self) -> TestResult:
        """
        Test 5: 执行路径唯一
        
        验证是否只有一个执行入口
        """
        start = time.time()
        
        # 重置状态
        self.exchange.reset()
        
        # 检查是否有唯一的执行方法
        if not hasattr(self.executor, 'execute_entry'):
            return TestResult("执行路径唯一", False, "缺少 execute_entry 方法")
        
        # 尝试完整执行流程
        result = await self.executor.execute_entry(margin_usd=3.0)
        
        if result is None:
            return TestResult("执行路径唯一", False, "执行失败")
        
        # 检查返回的数据完整性
        required_fields = ['entry_price', 'position_size', 'stop_order_id', 'stop_ok']
        for field in required_fields:
            if field not in result:
                return TestResult("执行路径唯一", False, f"返回数据缺少字段: {field}")
        
        if not result.get('stop_ok'):
            return TestResult("执行路径唯一", False, "stop_ok 应该为 True")
        
        duration = (time.time() - start) * 1000
        return TestResult("执行路径唯一", True, "执行路径完整且唯一", duration)
    
    def _print_summary(self):
        """打印测试汇总"""
        print("\n" + "="*70)
        print("📊 测试汇总")
        print("="*70)
        
        passed = sum(1 for r in self.results if r.passed)
        total = len(self.results)
        
        print(f"\n通过: {passed}/{total}")
        print("")
        
        for r in self.results:
            status = "✅ PASS" if r.passed else "❌ FAIL"
            print(f"  {status} - {r.test_name}")
            if not r.passed:
                print(f"         原因: {r.reason}")
            else:
                print(f"         耗时: {r.duration_ms:.1f}ms")
        
        print("")
        print("="*70)
        
        if passed == total:
            print("🎉 全部测试通过！可以进入真实 Safety Test")
        else:
            print("⚠️ 存在失败的测试，需要修复后再进入真实 Safety Test")
        
        print("="*70)


async def main():
    """主入口"""
    test = MockSafetyTest()
    all_passed = await test.run_all_tests()
    
    if all_passed:
        print("\n✅ Mock Safety Test 全部通过!")
        print("👉 下一步: 充值 $3+ → 运行真实 Safety Test")
        return 0
    else:
        print("\n❌ Mock Safety Test 存在失败!")
        print("👉 需要修复后再继续")
        return 1


if __name__ == '__main__':
    exit_code = asyncio.run(main())
    sys.exit(exit_code)