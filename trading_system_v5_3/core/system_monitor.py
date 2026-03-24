#!/usr/bin/env python3
"""
System Monitor - 运行状态监控

核心职责：
1. 记录系统状态快照
2. 追踪执行质量趋势
3. 提供可追溯性

你可以回看系统"当时在想什么"
"""

import json
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, asdict
import time


@dataclass
class SystemSnapshot:
    """系统状态快照"""
    timestamp: str
    version: int
    
    # 市场状态
    regime: str
    symbol: str
    score: int
    volume_ratio: float
    
    # 交易状态
    position: str
    last_trade_pnl: float
    holding_time: int
    
    # 执行质量
    avg_slippage: float
    avg_latency: float
    execution_quality: float
    
    # 信号质量
    signal_quality: float
    
    # 风控状态
    guardian_status: str
    guardian_decision: str
    
    # 当前配置
    min_score: int
    min_volume: float
    
    # 统计
    total_trades: int
    win_rate: float
    avg_pnl: float


class SystemMonitor:
    """
    运行状态监控
    
    输出：
    - logs/system_state.jsonl - 状态快照
    - logs/monitor_summary.json - 汇总统计
    """
    
    def __init__(self, log_dir: str = None):
        """
        初始化监控器
        
        Args:
            log_dir: 日志目录
        """
        self.log_dir = Path(log_dir or "logs")
        self.log_dir.mkdir(parents=True, exist_ok=True)
        
        # 日志文件
        self.state_log = self.log_dir / "system_state.jsonl"
        self.summary_file = self.log_dir / "monitor_summary.json"
        
        # 快照计数
        self.snapshot_count = 0
        self.snapshot_history: List[SystemSnapshot] = []
        
        # 警报阈值
        self.alert_thresholds = {
            'execution_quality': 0.7,
            'signal_quality': 0.3,
            'win_rate': 0.4,
            'max_latency': 1.0,
            'max_slippage': 0.0005
        }
        
        print("📊 System Monitor 初始化完成")
        print(f"   状态日志: {self.state_log}")
        print(f"   汇总文件: {self.summary_file}")
    
    def snapshot(self, state: Dict[str, Any]) -> SystemSnapshot:
        """
        记录系统状态快照
        
        Args:
            state: 系统状态字典
        
        Returns:
            SystemSnapshot
        """
        self.snapshot_count += 1
        
        snapshot = SystemSnapshot(
            timestamp=datetime.now().isoformat(),
            version=self.snapshot_count,
            
            regime=state.get('regime', 'unknown'),
            symbol=state.get('symbol', ''),
            score=state.get('score', 0),
            volume_ratio=state.get('volume_ratio', 0),
            
            position=state.get('position', 'none'),
            last_trade_pnl=state.get('last_pnl', 0),
            holding_time=state.get('holding_time', 0),
            
            avg_slippage=state.get('avg_slippage', 0),
            avg_latency=state.get('avg_latency', 0),
            execution_quality=state.get('execution_quality', 0),
            
            signal_quality=state.get('signal_quality', 0),
            
            guardian_status=state.get('guardian_status', 'active'),
            guardian_decision=state.get('guardian_decision', 'continue'),
            
            min_score=state.get('min_score', 80),
            min_volume=state.get('min_volume', 1.2),
            
            total_trades=state.get('total_trades', 0),
            win_rate=state.get('win_rate', 0),
            avg_pnl=state.get('avg_pnl', 0)
        )
        
        # 保存到历史
        self.snapshot_history.append(snapshot)
        
        # 写入日志
        self._append_to_log(snapshot)
        
        # 检查警报
        alerts = self._check_alerts(snapshot)
        if alerts:
            self._log_alerts(alerts)
        
        return snapshot
    
    def _append_to_log(self, snapshot: SystemSnapshot):
        """追加到日志文件"""
        with open(self.state_log, 'a', encoding='utf-8') as f:
            f.write(json.dumps(asdict(snapshot), ensure_ascii=False) + '\n')
    
    def _check_alerts(self, snapshot: SystemSnapshot) -> List[str]:
        """检查警报条件"""
        alerts = []
        
        if snapshot.execution_quality < self.alert_thresholds['execution_quality']:
            alerts.append(f"执行质量过低: {snapshot.execution_quality:.2f}")
        
        if snapshot.signal_quality < self.alert_thresholds['signal_quality']:
            alerts.append(f"信号质量过低: {snapshot.signal_quality:.2f}")
        
        if snapshot.win_rate < self.alert_thresholds['win_rate'] and snapshot.total_trades >= 20:
            alerts.append(f"胜率过低: {snapshot.win_rate*100:.1f}%")
        
        if snapshot.avg_latency > self.alert_thresholds['max_latency']:
            alerts.append(f"延迟过高: {snapshot.avg_latency:.2f}s")
        
        if snapshot.avg_slippage > self.alert_thresholds['max_slippage']:
            alerts.append(f"滑点过高: {snapshot.avg_slippage*100:.3f}%")
        
        if snapshot.guardian_decision == 'stop':
            alerts.append("策略已被守护者停止")
        
        return alerts
    
    def _log_alerts(self, alerts: List[str]):
        """记录警报"""
        alert_file = self.log_dir / "alerts.jsonl"
        with open(alert_file, 'a', encoding='utf-8') as f:
            f.write(json.dumps({
                'timestamp': datetime.now().isoformat(),
                'alerts': alerts
            }, ensure_ascii=False) + '\n')
        
        print(f"\n⚠️  系统警报:")
        for alert in alerts:
            print(f"   - {alert}")
    
    def get_recent_snapshots(self, limit: int = 20) -> List[Dict[str, Any]]:
        """获取最近的快照"""
        recent = self.snapshot_history[-limit:]
        return [asdict(s) for s in recent]
    
    def get_summary(self) -> Dict[str, Any]:
        """获取汇总统计"""
        if not self.snapshot_history:
            return {'status': 'no_data'}
        
        # 计算趋势
        recent = self.snapshot_history[-20:]
        
        avg_exec_quality = sum(s.execution_quality for s in recent) / len(recent)
        avg_signal_quality = sum(s.signal_quality for s in recent) / len(recent)
        avg_win_rate = sum(s.win_rate for s in recent) / len(recent)
        
        # 更新汇总文件
        summary = {
            'timestamp': datetime.now().isoformat(),
            'snapshot_count': self.snapshot_count,
            'recent_stats': {
                'avg_execution_quality': avg_exec_quality,
                'avg_signal_quality': avg_signal_quality,
                'avg_win_rate': avg_win_rate,
                'last_regime': recent[-1].regime if recent else 'unknown',
                'total_trades': recent[-1].total_trades if recent else 0
            },
            'alert_thresholds': self.alert_thresholds
        }
        
        with open(self.summary_file, 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2, ensure_ascii=False)
        
        return summary
    
    def get_regime_distribution(self) -> Dict[str, int]:
        """获取Regime分布"""
        distribution = {}
        for snapshot in self.snapshot_history:
            regime = snapshot.regime
            distribution[regime] = distribution.get(regime, 0) + 1
        return distribution


# 创建默认实例
_default_monitor = None

def get_monitor() -> SystemMonitor:
    """获取全局监控器实例"""
    global _default_monitor
    if _default_monitor is None:
        _default_monitor = SystemMonitor()
    return _default_monitor