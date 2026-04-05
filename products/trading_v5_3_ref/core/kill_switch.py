#!/usr/bin/env python3
"""
Kill Switch - 系统自杀机制

核心功能：
1. 连续失败自动停止
2. 紧急停止触发
3. 系统状态保存

触发条件：
- 连续失败 > 3 次
- 用户手动触发
- 外部信号
"""

import os
import sys
import json
import time
from datetime import datetime
from typing import Optional
from enum import Enum


class KillReason(Enum):
    """停止原因"""
    CONSECUTIVE_FAILURES = "连续失败"
    MANUAL_TRIGGER = "手动触发"
    CRITICAL_ERROR = "严重错误"
    RISK_LIMIT = "风险限额"
    INTEGRITY_FAILURE = "完整性检查失败"
    MAX_TOTAL_TRADES = "全局交易数上限"


# ============================================================
# 🔒 全局硬锁 - 生命周期交易上限
# ⚠️ 修改此值需谨慎，这是最后一道防线
# ============================================================
MAX_TOTAL_TRADES = 10  # 生命周期最大交易数


class KillSwitch:
    """
    系统自杀开关
    
    当系统出现严重问题时，立即停止运行
    """
    
    def __init__(
        self,
        max_consecutive_failures: int = 3,
        max_daily_loss_pct: float = 5.0,
        state_file: str = "logs/kill_switch_state.json"
    ):
        """
        初始化
        
        Args:
            max_consecutive_failures: 最大连续失败次数
            max_daily_loss_pct: 最大日亏损百分比
            state_file: 状态保存文件
        """
        self.max_failures = max_consecutive_failures
        self.max_loss_pct = max_daily_loss_pct
        self.state_file = state_file
        
        # 计数器
        self.consecutive_failures = 0
        self.total_failures = 0
        self.total_trades = 0
        
        # 状态
        self._killed = False
        self._kill_time: Optional[float] = None
        self._kill_reason: Optional[KillReason] = None
        
        # 统计
        self.stats = {
            'trades': 0,
            'failures': 0,
            'consecutive_failures': 0,
            'kills': 0
        }
    
    def record_trade(self, success: bool, pnl_pct: float = 0.0):
        """
        记录交易结果
        
        Args:
            success: 是否成功
            pnl_pct: 盈亏百分比
        """
        self.stats['trades'] += 1
        
        # 🔒 全局硬锁检查 - 生命周期交易上限
        if self.stats['trades'] >= MAX_TOTAL_TRADES:
            self.trigger(
                KillReason.MAX_TOTAL_TRADES, 
                f"达到全局交易上限: {self.stats['trades']}/{MAX_TOTAL_TRADES}"
            )
        
        if success:
            self.consecutive_failures = 0
        else:
            self.consecutive_failures += 1
            self.stats['failures'] += 1
            self.stats['consecutive_failures'] = self.consecutive_failures
            
            # 检查是否触发 Kill Switch
            if self.consecutive_failures >= self.max_failures:
                self.trigger(KillReason.CONSECUTIVE_FAILURES)
        
        # 检查日亏损
        if pnl_pct < -self.max_loss_pct:
            self.trigger(KillReason.RISK_LIMIT)
    
    def trigger(self, reason: KillReason, message: str = ""):
        """
        触发 Kill Switch
        
        Args:
            reason: 停止原因
            message: 附加信息
        """
        if self._killed:
            return
        
        self._killed = True
        self._kill_time = time.time()
        self._kill_reason = reason
        self.stats['kills'] += 1
        
        # 保存状态
        self._save_state(reason, message)
        
        # 输出
        print("\n" + "=" * 60)
        print("🚨 KILL SWITCH TRIGGERED")
        print("=" * 60)
        print(f"原因: {reason.value}")
        print(f"时间: {datetime.now().isoformat()}")
        print(f"连续失败: {self.consecutive_failures}")
        if message:
            print(f"详情: {message}")
        print("=" * 60)
        
        # 立即停止
        print("\n🛑 系统立即停止")
        sys.stdout.flush()
        
        # 保存最终状态
        self._save_final_state()
        
        # 退出进程
        os._exit(1)
    
    def manual_trigger(self, message: str = "用户手动触发"):
        """手动触发"""
        self.trigger(KillReason.MANUAL_TRIGGER, message)
    
    def is_killed(self) -> bool:
        """是否已停止"""
        return self._killed
    
    def _save_state(self, reason: KillReason, message: str):
        """保存状态"""
        state = {
            'killed': True,
            'kill_time': datetime.now().isoformat(),
            'reason': reason.value,
            'message': message,
            'stats': self.stats
        }
        
        try:
            os.makedirs(os.path.dirname(self.state_file), exist_ok=True)
            with open(self.state_file, 'w') as f:
                json.dump(state, f, indent=2)
        except:
            pass
    
    def _save_final_state(self):
        """保存最终状态"""
        final_state = {
            'timestamp': datetime.now().isoformat(),
            'status': 'KILLED',
            'reason': self._kill_reason.value if self._kill_reason else 'UNKNOWN',
            'stats': self.stats
        }
        
        try:
            with open(self.state_file, 'w') as f:
                json.dump(final_state, f, indent=2)
        except:
            pass
    
    def reset(self):
        """重置（仅用于测试）"""
        self.consecutive_failures = 0
        self._killed = False
        self._kill_time = None
        self._kill_reason = None


# 全局实例
_kill_switch: Optional[KillSwitch] = None


def get_kill_switch() -> KillSwitch:
    """获取全局 Kill Switch"""
    global _kill_switch
    if _kill_switch is None:
        _kill_switch = KillSwitch()
    return _kill_switch


def emergency_stop(message: str = "紧急停止"):
    """紧急停止（全局函数）"""
    switch = get_kill_switch()
    switch.trigger(KillReason.MANUAL_TRIGGER, message)


# 测试
if __name__ == "__main__":
    print("🧪 Kill Switch 测试")
    
    switch = KillSwitch(max_consecutive_failures=3)
    
    # 模拟交易
    results = [False, False, False]
    
    for i, success in enumerate(results):
        print(f"\n交易 {i+1}: {'成功' if success else '失败'}")
        
        if switch.is_killed():
            print("系统已停止")
            break
        
        switch.record_trade(success)
    
    print("\n⚠️ 如果看到这条消息，说明测试失败（应该已停止）")
