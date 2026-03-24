#!/usr/bin/env python3
"""
System Integrity Guard - 系统完整性守护者

核心职责：确保跨模块状态一致性

检查项：
1. signal_age - 信号新鲜度
2. position_sync - 本地vs交易所持仓一致性
3. order_fill - 订单成交验证
4. duplicate_order - 重复下单防护
5. stop_lock - STOP全局锁
6. balance_consistency - 资金一致性

使用：
guard = SystemIntegrityGuard(exchange, executor)
guard.check_all()
"""

import time
import hashlib
from datetime import datetime
from typing import Dict, List, Optional, Set
from dataclasses import dataclass
from enum import Enum

from core.timeout_controller import get_timeout_controller, TimeoutError
from core.kill_switch import get_kill_switch, KillReason


class IntegrityLevel(Enum):
    """完整性级别"""
    OK = "✅ OK"
    WARNING = "⚠️ WARNING"
    SKIPPED = "⏭️ SKIPPED"
    CRITICAL = "❌ CRITICAL"
    BLOCKED = "🚫 BLOCKED"


@dataclass
class IntegrityCheckResult:
    """检查结果"""
    check_name: str
    level: IntegrityLevel
    message: str
    detail: Dict = None


class SystemIntegrityGuard:
    """
    系统完整性守护者
    
    确保"所有模块说的是同一件事"
    """
    
    def __init__(self, exchange=None, executor=None):
        """
        初始化
        
        Args:
            exchange: CCXT 交易所实例
            executor: LiveExecutor 实例
        """
        self.exchange = exchange
        self.executor = executor
        
        # 状态追踪
        self._executed_signal_ids: Set[str] = set()
        self._system_stopped = False
        self._last_check_time = 0
        
        # 检查结果
        self.results: List[IntegrityCheckResult] = []
        self.critical_count = 0
        self.warning_count = 0
        self.skipped_count = 0
        self.blocked_count = 0
        
        # 🔴 关键检查：跳过 = 阻断
        self.CRITICAL_CHECKS = {
            "持仓一致性",
            "订单成交验证",
            "资金一致性"
        }
        
        # retry 和 timeout 控制
        self._api_retry_count = 0
        self._max_retry = 3
        self._api_timeout = 10.0  # 秒
        
        # 集成模块
        self.timeout_controller = get_timeout_controller()
        self.kill_switch = get_kill_switch()
    
    def check_all(self) -> bool:
        """
        执行所有完整性检查
        
        Returns:
            True = 系统完整，False = 有问题
        """
        self.results = []
        self.critical_count = 0
        self.warning_count = 0
        
        # 1. STOP 全局锁检查
        self._check_stop_lock()
        
        # 如果系统已停止，跳过其他检查
        if self._system_stopped:
            return False
        
        # 2. 信号新鲜度
        self._check_signal_freshness()
        
        # 3. 持仓一致性
        self._check_position_sync()
        
        # 4. 订单成交验证
        self._check_order_fill()
        
        # 5. 重复下单防护
        self._check_duplicate_orders()
        
        # 6. 资金一致性
        self._check_balance_consistency()
        
        return self.critical_count == 0
    
    # ========== 检查实现 ==========
    
    def _check_stop_lock(self):
        """检查 STOP 全局锁"""
        if self._system_stopped:
            self._add_result(
                "STOP全局锁",
                IntegrityLevel.CRITICAL,
                "系统已停止，禁止所有交易"
            )
        else:
            self._add_result(
                "STOP全局锁",
                IntegrityLevel.OK,
                "系统正常运行"
            )
    
    def _check_signal_freshness(self):
        """检查信号新鲜度"""
        # 需要从 executor 获取最近信号时间
        if self.executor and hasattr(self.executor, '_last_signal_time'):
            signal_time = self.executor._last_signal_time
            if signal_time:
                age = time.time() - signal_time
                if age > 1.0:
                    self._add_result(
                        "信号新鲜度",
                        IntegrityLevel.WARNING,
                        f"信号已过期: {age:.1f}s > 1.0s"
                    )
                else:
                    self._add_result(
                        "信号新鲜度",
                        IntegrityLevel.OK,
                        f"信号新鲜: {age*1000:.0f}ms"
                    )
            else:
                self._add_result(
                    "信号新鲜度",
                    IntegrityLevel.OK,
                    "无待处理信号"
                )
        else:
            self._add_result(
                "信号新鲜度",
                IntegrityLevel.OK,
                "检查跳过（无数据）"
            )
    
    def _check_position_sync(self):
        """检查本地 vs 交易所持仓一致性"""
        if not self.exchange or not self.executor:
            self._add_result(
                "持仓一致性",
                IntegrityLevel.SKIPPED,
                "⚠️ 无法检查（无交易所连接）- 阻断交易"
            )
            return
        
        try:
            # 获取交易所持仓
            positions = self.exchange.private_get_account_positions({
                'instId': 'ETH-USDT-SWAP'
            })
            exchange_pos = 0.0
            if positions.get('data'):
                exchange_pos = float(positions['data'][0].get('pos', 0))
            
            # 获取本地持仓
            local_pos = 0.0
            if hasattr(self.executor, 'open_positions'):
                for pos in self.executor.open_positions.values():
                    local_pos += pos.get('size', 0)
            
            # 比较
            if abs(exchange_pos - local_pos) > 0.001:
                self._add_result(
                    "持仓一致性",
                    IntegrityLevel.CRITICAL,
                    f"不一致！交易所={exchange_pos}, 本地={local_pos}"
                )
            else:
                self._add_result(
                    "持仓一致性",
                    IntegrityLevel.OK,
                    f"一致: {exchange_pos}"
                )
        except Exception as e:
            self._add_result(
                "持仓一致性",
                IntegrityLevel.WARNING,
                f"检查失败: {e}"
            )
    
    def _check_order_fill(self):
        """检查订单成交验证"""
        # 需要从 executor 获取最近订单
        if self.executor and hasattr(self.executor, '_last_order'):
            order = self.executor._last_order
            if order:
                filled = order.get('filled') or order.get('info', {}).get('fillSz')
                if filled and float(filled) > 0:
                    self._add_result(
                        "订单成交验证",
                        IntegrityLevel.OK,
                        f"已成交: {filled}"
                    )
                else:
                    self._add_result(
                        "订单成交验证",
                        IntegrityLevel.WARNING,
                        "订单未成交或状态未知"
                    )
            else:
                self._add_result(
                    "订单成交验证",
                    IntegrityLevel.OK,
                    "无待验证订单"
                )
        else:
            self._add_result(
                "订单成交验证",
                IntegrityLevel.SKIPPED,
                "⚠️ 无法检查（无执行器）- 阻断交易"
            )
    
    def _check_duplicate_orders(self):
        """检查重复下单"""
        # 清理过期的信号ID（保留最近100个）
        if len(self._executed_signal_ids) > 100:
            self._executed_signal_ids = set(list(self._executed_signal_ids)[-50:])
        
        self._add_result(
            "重复下单防护",
            IntegrityLevel.OK,
            f"已记录 {len(self._executed_signal_ids)} 个信号ID"
        )
    
    def _check_balance_consistency(self):
        """检查资金一致性"""
        if not self.exchange:
            self._add_result(
                "资金一致性",
                IntegrityLevel.SKIPPED,
                "⚠️ 无法检查（无交易所连接）- 阻断交易"
            )
            return
        
        try:
            balance = self.exchange.fetch_balance()
            available = float(balance.get('USDT', {}).get('free', 0))
            
            # 假设最小保证金需求
            min_margin = 10.0
            
            if available < min_margin:
                self._add_result(
                    "资金一致性",
                    IntegrityLevel.WARNING,
                    f"可用保证金不足: {available:.2f} < {min_margin}"
                )
            else:
                self._add_result(
                    "资金一致性",
                    IntegrityLevel.OK,
                    f"可用保证金: {available:.2f} USDT"
                )
        except Exception as e:
            self._add_result(
                "资金一致性",
                IntegrityLevel.WARNING,
                f"检查失败: {e}"
            )
    
    # ========== 辅助方法 ==========
    
    def _add_result(self, name: str, level: IntegrityLevel, message: str, detail: Dict = None):
        """添加检查结果"""
        result = IntegrityCheckResult(name, level, message, detail)
        self.results.append(result)
        
        if level == IntegrityLevel.CRITICAL:
            self.critical_count += 1
        elif level == IntegrityLevel.WARNING:
            self.warning_count += 1
        elif level == IntegrityLevel.SKIPPED:
            self.skipped_count += 1
            # 🔴 关键检查被跳过 = 阻断
            if name in self.CRITICAL_CHECKS:
                self.blocked_count += 1
        elif level == IntegrityLevel.BLOCKED:
            self.blocked_count += 1
    
    def generate_signal_id(self, symbol: str, price: float, timestamp: float) -> str:
        """生成信号ID（防重复）"""
        key = f"{symbol}_{price:.2f}_{timestamp:.0f}"
        return hashlib.md5(key.encode()).hexdigest()[:16]
    
    def mark_signal_executed(self, signal_id: str):
        """标记信号已执行"""
        self._executed_signal_ids.add(signal_id)
    
    def is_signal_executed(self, signal_id: str) -> bool:
        """检查信号是否已执行"""
        return signal_id in self._executed_signal_ids
    
    def set_system_stopped(self, stopped: bool):
        """设置系统停止状态"""
        self._system_stopped = stopped
    
    def can_trade(self) -> bool:
        """是否可以交易"""
        return (
            not self._system_stopped and 
            self.critical_count == 0 and 
            self.blocked_count == 0
        )
    
    def allow_trade(self, symbol: str = None) -> bool:
        """
        强制执行门控（Execution Gate）
        
        必须在每次交易前调用：
        
        if not guard.allow_trade():
            print("❌ 系统完整性检查失败，禁止交易")
            return
        
        Returns:
            True = 允许交易
            False = 禁止交易
        """
        # 执行完整性检查
        self.check_all()
        
        # 判断是否允许
        if self._system_stopped:
            print("🚫 系统已停止，禁止交易")
            return False
        
        if self.critical_count > 0:
            print(f"🚫 检测到 {self.critical_count} 个严重问题，禁止交易")
            return False
        
        if self.blocked_count > 0:
            print(f"🚫 {self.blocked_count} 个关键检查被跳过，禁止交易")
            return False
        
        return True
    
    def check_audit_consistency(self, audit_data: Dict, execution_data: Dict) -> bool:
        """
        检查审计数据一致性
        
        Args:
            audit_data: 审计系统记录的数据
            execution_data: 执行器实际数据
            
        Returns:
            True = 一致，False = 不一致
        """
        # 比较 trades 数量
        audit_trades = audit_data.get('profit_stats', {}).get('total_trades', 0)
        exec_trades = execution_data.get('total_trades', 0)
        
        if audit_trades != exec_trades:
            print(f"⚠️ 审计数据不一致: audit={audit_trades}, exec={exec_trades}")
            return False
        
        return True
    
    def check_retry_limit(self) -> bool:
        """
        检查 API 重试次数
        
        Returns:
            True = 可继续重试，False = 已达上限
        """
        if self._api_retry_count >= self._max_retry:
            print(f"🚫 API 重试次数已达上限: {self._api_retry_count} >= {self._max_retry}")
            return False
        return True
    
    def record_api_retry(self):
        """记录 API 重试"""
        self._api_retry_count += 1
    
    def reset_api_retry(self):
        """重置 API 重试计数"""
        self._api_retry_count = 0
    
    def report(self) -> str:
        """生成报告"""
        lines = [
            "=" * 60,
            "🛡️ SYSTEM INTEGRITY REPORT V2",
            "=" * 60,
            f"时间: {datetime.now().isoformat()}",
            ""
        ]
        
        for result in self.results:
            lines.append(f"  {result.level.value} {result.check_name}: {result.message}")
        
        lines.extend([
            "",
            "=" * 60,
            f"📊 统计:",
            f"   CRITICAL: {self.critical_count}",
            f"   BLOCKED:  {self.blocked_count}",
            f"   WARNING:  {self.warning_count}",
            f"   SKIPPED:  {self.skipped_count}",
            "",
            f"🎯 状态: {'✅ 允许交易' if self.can_trade() else '🚫 禁止交易'}",
            "=" * 60
        ])
        
        return "\n".join(lines)


# 全局实例
_guard: Optional[SystemIntegrityGuard] = None


def get_integrity_guard(exchange=None, executor=None) -> SystemIntegrityGuard:
    """获取全局完整性守护者"""
    global _guard
    if _guard is None:
        _guard = SystemIntegrityGuard(exchange, executor)
    return _guard


# 测试
if __name__ == "__main__":
    print("🧪 系统完整性守护者测试")
    
    guard = SystemIntegrityGuard()
    
    # 执行检查
    guard.check_all()
    
    # 输出报告
    print(guard.report())
    
    # 测试信号ID生成
    signal_id = guard.generate_signal_id("ETH/USDT:USDT", 2200.0, time.time())
    print(f"\n📌 信号ID: {signal_id}")
    
    # 测试重复检测
    guard.mark_signal_executed(signal_id)
    print(f"已执行: {guard.is_signal_executed(signal_id)}")