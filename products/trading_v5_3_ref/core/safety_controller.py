#!/usr/bin/env python3
"""
Safety Controller - 安全控制器

核心职责：
1. 监控系统状态
2. 检测异常条件
3. 自动回滚到安全配置

系统出问题 → 自动回到"上一个安全状态"
"""

from typing import Dict, Any, Optional, List
from datetime import datetime
from dataclasses import dataclass
from enum import Enum
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from config_version_manager import ConfigVersionManager, get_manager


class SafetyStatus(Enum):
    """安全状态"""
    SAFE = "safe"
    WARNING = "warning"
    DANGER = "danger"
    ROLLED_BACK = "rolled_back"


@dataclass
class SafetyCheckResult:
    """安全检查结果"""
    status: SafetyStatus
    message: str
    rollback_performed: bool
    rollback_version: Optional[int]


class SafetyController:
    """
    安全控制器
    
    自动回滚触发条件：
    1. 执行质量崩了 (< 0.6)
    2. 连续亏损过多 (≥ 5次)
    3. 当日亏损过大 (< -3%)
    4. 胜率过低 (< 35%)
    5. 策略守护者触发STOP
    
    这是系统的"免疫反应"
    """
    
    def __init__(self, config_manager: ConfigVersionManager = None):
        """
        初始化安全控制器
        
        Args:
            config_manager: 配置版本管理器
        """
        self.config_manager = config_manager or get_manager()
        
        # 回滚阈值
        self.execution_quality_threshold = 0.6   # 执行质量底线
        self.consecutive_loss_limit = 5          # 连续亏损限制
        self.daily_loss_limit = -0.03            # 日亏损限制 (-3%)
        self.win_rate_floor = 0.35               # 胜率底线
        self.min_samples_for_judgment = 20       # 判断所需最小样本
        
        # 状态
        self.last_check_time = None
        self.last_status = SafetyStatus.SAFE
        self.rollback_count = 0
        self.check_history: List[Dict[str, Any]] = []
        
        print("🛡️ Safety Controller 初始化完成")
        print(f"   执行质量底线: {self.execution_quality_threshold}")
        print(f"   连续亏损限制: {self.consecutive_loss_limit}")
        print(f"   日亏损限制: {self.daily_loss_limit*100}%")
        print(f"   胜率底线: {self.win_rate_floor*100}%")
    
    def check_and_rollback(self, stats: Dict[str, Any]) -> SafetyCheckResult:
        """
        检查并自动回滚
        
        Args:
            stats: 统计数据，需包含:
                - execution_score: 执行质量分数
                - consecutive_losses: 连续亏损次数
                - daily_pnl: 日盈亏
                - win_rate: 胜率
                - total_trades: 总交易数
                - guardian_decision: 守护者决策
        
        Returns:
            SafetyCheckResult
        """
        self.last_check_time = datetime.now()
        
        # 样本不足
        if stats.get('total_trades', 0) < self.min_samples_for_judgment:
            self.last_status = SafetyStatus.SAFE
            return SafetyCheckResult(
                status=SafetyStatus.SAFE,
                message=f"样本不足({stats.get('total_trades', 0)}<{self.min_samples_for_judgment})",
                rollback_performed=False,
                rollback_version=None
            )
        
        # 检查各项条件
        reasons_to_rollback = []
        
        # 1. 执行质量崩了
        exec_score = stats.get('execution_score', stats.get('avg_execution_quality', 1.0))
        if exec_score < self.execution_quality_threshold:
            reasons_to_rollback.append(
                f"执行质量过低: {exec_score:.2f} < {self.execution_quality_threshold}"
            )
        
        # 2. 连续亏损过多
        consecutive_losses = stats.get('consecutive_losses', 0)
        if consecutive_losses >= self.consecutive_loss_limit:
            reasons_to_rollback.append(
                f"连续亏损过多: {consecutive_losses} ≥ {self.consecutive_loss_limit}"
            )
        
        # 3. 当日亏损过大
        daily_pnl = stats.get('daily_pnl', 0)
        if daily_pnl < self.daily_loss_limit:
            reasons_to_rollback.append(
                f"日亏损过大: {daily_pnl*100:.2f}% < {self.daily_loss_limit*100}%"
            )
        
        # 4. 胜率过低
        win_rate = stats.get('win_rate', 1.0)
        if win_rate < self.win_rate_floor:
            reasons_to_rollback.append(
                f"胜率过低: {win_rate*100:.1f}% < {self.win_rate_floor*100}%"
            )
        
        # 5. 策略守护者触发STOP
        guardian_decision = stats.get('guardian_decision', 'continue')
        if guardian_decision == 'stop':
            reasons_to_rollback.append(
                f"策略守护者已触发STOP: {stats.get('guardian_reason', 'unknown')}"
            )
        
        # 记录检查历史
        check_record = {
            'timestamp': self.last_check_time.isoformat(),
            'stats': stats,
            'reasons': reasons_to_rollback,
            'status': 'danger' if reasons_to_rollback else 'safe'
        }
        self.check_history.append(check_record)
        
        # 决定是否回滚
        if reasons_to_rollback:
            return self._perform_rollback(reasons_to_rollback)
        else:
            self.last_status = SafetyStatus.SAFE
            return SafetyCheckResult(
                status=SafetyStatus.SAFE,
                message="系统状态正常",
                rollback_performed=False,
                rollback_version=None
            )
    
    def _perform_rollback(self, reasons: List[str]) -> SafetyCheckResult:
        """执行自动回滚"""
        print("\n🚨 检测到异常，触发自动回滚:")
        for reason in reasons:
            print(f"   - {reason}")
        
        # 执行回滚
        success, message = self.config_manager.rollback()
        
        if success:
            self.rollback_count += 1
            self.last_status = SafetyStatus.ROLLED_BACK
            
            print(f"\n⏪ 自动回滚成功")
            print(f"   回滚次数: {self.rollback_count}")
            
            return SafetyCheckResult(
                status=SafetyStatus.ROLLED_BACK,
                message=f"自动回滚: {'; '.join(reasons)}",
                rollback_performed=True,
                rollback_version=self.config_manager.current_version
            )
        else:
            self.last_status = SafetyStatus.DANGER
            
            print(f"\n❌ 自动回滚失败: {message}")
            
            return SafetyCheckResult(
                status=SafetyStatus.DANGER,
                message=f"回滚失败: {message}",
                rollback_performed=False,
                rollback_version=None
            )
    
    def force_rollback(self, reason: str = "manual") -> SafetyCheckResult:
        """手动强制回滚"""
        success, message = self.config_manager.rollback()
        
        if success:
            self.rollback_count += 1
            self.last_status = SafetyStatus.ROLLED_BACK
            
            return SafetyCheckResult(
                status=SafetyStatus.ROLLED_BACK,
                message=f"手动回滚: {reason}",
                rollback_performed=True,
                rollback_version=self.config_manager.current_version
            )
        else:
            return SafetyCheckResult(
                status=SafetyStatus.DANGER,
                message=f"回滚失败: {message}",
                rollback_performed=False,
                rollback_version=None
            )
    
    def get_status(self) -> Dict[str, Any]:
        """获取当前状态"""
        return {
            'last_check_time': self.last_check_time.isoformat() if self.last_check_time else None,
            'last_status': self.last_status.value,
            'rollback_count': self.rollback_count,
            'check_count': len(self.check_history),
            'thresholds': {
                'execution_quality': self.execution_quality_threshold,
                'consecutive_loss_limit': self.consecutive_loss_limit,
                'daily_loss_limit': self.daily_loss_limit,
                'win_rate_floor': self.win_rate_floor
            }
        }
    
    def get_recent_checks(self, limit: int = 10) -> List[Dict[str, Any]]:
        """获取最近的检查记录"""
        return self.check_history[-limit:]


# 创建默认实例
_default_controller = None

def get_controller() -> SafetyController:
    """获取全局控制器实例"""
    global _default_controller
    if _default_controller is None:
        _default_controller = SafetyController()
    return _default_controller