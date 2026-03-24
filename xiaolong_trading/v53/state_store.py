"""
StateStore - 事件驱动状态存储（生产可用版）

核心原则：
1. 单例模式 - 避免多实例
2. 线程安全 - 加 Lock
3. 每笔交易触发更新
4. API 只读不计算

⚠️ CRITICAL:
   GO/NO-GO only grants permission.
   NEVER auto-switch execution mode.
   
🔒 GO Stability:
   防止"偶然GO"，需要连续 10 次 GO 才算稳定。

🔀 Hybrid Controller:
   V5.2 执行 + V3 风控裁决
   随时可回退到 V5.2
"""

from threading import Lock
from typing import Optional, Dict, Any
from datetime import datetime


class GoNoGoEngine:
    """GO/NO-GO 判断引擎"""
    
    MIN_SAMPLES = 30
    
    def evaluate(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        """
        评估 GO/NO-GO 状态
        
        参数：
            metrics: {
                'total': int,           # 总样本数
                'diff_rate': float,     # 差异率 (0-1)
                'aggressive': int,      # 激进决策数
                'conservative': int,    # 保守决策数
                'risk_level': str,      # 风险等级
                'circuit': str,         # 熔断状态
                'errors': int           # 执行错误数
            }
        """
        total = metrics.get('total', 0)
        aggressive = metrics.get('aggressive', 0)
        diff_rate = metrics.get('diff_rate', 0)
        risk_level = metrics.get('risk_level', 'LOW')
        circuit = metrics.get('circuit', 'NORMAL')
        errors = metrics.get('errors', 0)
        
        # 1. 样本不足 → PENDING
        if total < self.MIN_SAMPLES:
            return {
                'status': 'pending',
                'can_go': False,
                'reason': f'等待数据积累 ({total}/{self.MIN_SAMPLES} 笔)',
                'metrics': {'total': total, 'required': self.MIN_SAMPLES}
            }
        
        # 2. 激进决策 → NO-GO（唯一硬红线）
        if aggressive > 0:
            return {
                'status': 'no_go',
                'can_go': False,
                'reason': f'检测到 {aggressive} 笔激进决策，禁止上线',
                'metrics': {'aggressive': aggressive}
            }
        
        # 3. 风险等级 HIGH → NO-GO
        if risk_level == 'HIGH':
            return {
                'status': 'no_go',
                'can_go': False,
                'reason': 'AI 风险等级为 HIGH',
                'metrics': {'risk_level': risk_level}
            }
        
        # 4. 熔断触发 → NO-GO
        if circuit == 'TRIGGERED':
            return {
                'status': 'no_go',
                'can_go': False,
                'reason': '熔断已触发',
                'metrics': {'circuit': circuit}
            }
        
        # 5. 执行错误过多 → NO-GO
        if errors > 5:
            return {
                'status': 'no_go',
                'can_go': False,
                'reason': f'执行错误过多 ({errors} 次)',
                'metrics': {'errors': errors}
            }
        
        # 6. 所有检查通过 → GO
        # 注意：diff_rate 高只是 WARN，不影响 GO
        result = {
            'status': 'go',
            'can_go': True,
            'reason': 'Shadow 验证通过，系统可以上线',
            'metrics': {
                'total': total,
                'diff_rate': diff_rate,
                'aggressive': aggressive
            }
        }
        
        # 添加高差异率警告（不影响 GO）
        if diff_rate > 0.3:
            result['has_high_diff'] = True
            result['diff_warning'] = f'决策差异率 {diff_rate*100:.1f}% 较高，新系统正在收权'
        
        return result


class SystemStateStore:
    """
    事件驱动状态存储（线程安全）
    
    使用单例模式，避免多实例问题
    """
    
    def __init__(self):
        self._lock = Lock()
        self._metrics: Dict[str, Any] = {
            'total': 0,
            'same': 0,
            'conservative': 0,
            'aggressive': 0,
            'diff_rate': 0.0,
            'risk_level': 'LOW',
            'circuit': 'NORMAL',
            'errors': 0
        }
        self._go_no_go: Dict[str, Any] = {
            'status': 'pending',
            'can_go': False,
            'reason': '系统初始化中'
        }
        self._recent_decisions: list = []
        self._engine = GoNoGoEngine()
        self._last_update: Optional[datetime] = None
        
        # 🔒 GO Stability 计数器（防止"偶然GO"）
        self._go_streak: int = 0  # 连续 GO 计数
        self._go_stability_required: int = 10  # 需要连续 10 次 GO 才算稳定
        self._stable_go: bool = False  # 是否达到稳定 GO
    
    def on_shadow_trade(self, decision: Dict[str, Any]):
        """
        每笔 Shadow 交易后调用
        
        这是关键：每一笔交易都触发状态更新
        """
        with self._lock:
            # 更新计数
            diff_type = decision.get('diff_type', 'SAME')
            if diff_type == 'SAME':
                self._metrics['same'] += 1
            elif diff_type == 'CONSERVATIVE':
                self._metrics['conservative'] += 1
            elif diff_type == 'AGGRESSIVE':
                self._metrics['aggressive'] += 1
            
            self._metrics['total'] += 1
            
            # 计算差异率
            diff_count = self._metrics['conservative'] + self._metrics['aggressive']
            self._metrics['diff_rate'] = diff_count / self._metrics['total'] if self._metrics['total'] > 0 else 0.0
            
            # 更新最近决策
            self._recent_decisions.insert(0, decision)
            self._recent_decisions = self._recent_decisions[:50]
            
            # 重新计算 GO/NO-GO
            self._go_no_go = self._engine.evaluate(self._metrics)
            
            # 🔒 更新 GO Stability 计数器
            if self._go_no_go['status'] == 'go':
                self._go_streak += 1
                if self._go_streak >= self._go_stability_required:
                    self._stable_go = True
                    print(f"[GO STABILITY] ✅ 达到稳定 ({self._go_streak}/{self._go_stability_required})")
            else:
                # 非 GO 状态重置计数
                if self._go_streak > 0:
                    print(f"[GO STABILITY] ⚠️ 重置 ({self._go_streak} → 0)")
                self._go_streak = 0
                self._stable_go = False
            
            self._last_update = datetime.utcnow()
            
            # 调试输出
            status_extra = f", go_streak={self._go_streak}/{self._go_stability_required}" if self._go_no_go['status'] == 'go' else ""
            print(f"[STATE UPDATE] total={self._metrics['total']}, aggressive={self._metrics['aggressive']}, go_no_go={self._go_no_go['status']}{status_extra}")
    
    def on_risk_update(self, risk: Dict[str, Any]):
        """风控状态更新"""
        with self._lock:
            self._metrics['risk_level'] = risk.get('level', 'LOW')
            self._metrics['circuit'] = risk.get('circuit', 'NORMAL')
            self._go_no_go = self._engine.evaluate(self._metrics)
            self._last_update = datetime.utcnow()
    
    def on_execution_update(self, stats: Dict[str, Any]):
        """执行统计更新"""
        with self._lock:
            self._metrics['errors'] = stats.get('errors', 0)
            self._go_no_go = self._engine.evaluate(self._metrics)
            self._last_update = datetime.utcnow()
    
    def get_go_no_go(self) -> Dict[str, Any]:
        """获取 GO/NO-GO 状态（只读）"""
        with self._lock:
            return self._go_no_go.copy()
    
    def get_metrics(self) -> Dict[str, Any]:
        """获取 Shadow 指标（只读）"""
        with self._lock:
            return self._metrics.copy()
    
    def get_recent_decisions(self, limit: int = 20) -> list:
        """获取最近决策"""
        with self._lock:
            return self._recent_decisions[:limit]
    
    def to_dict(self) -> Dict[str, Any]:
        """完整状态序列化（用于 API）"""
        with self._lock:
            return {
                'timestamp': self._last_update.isoformat() if self._last_update else None,
                'mode': 'shadow',
                'status': self._get_system_status(),
                'shadow': {
                    'total': self._metrics['total'],
                    'same': self._metrics['same'],
                    'conservative': self._metrics['conservative'],
                    'aggressive': self._metrics['aggressive'],
                    'diff_rate': self._metrics['diff_rate'],
                    'diff_rate_pct': f"{self._metrics['diff_rate']*100:.1f}%"
                },
                'go_no_go': {
                    **self._go_no_go.copy(),
                    'stability': {
                        'streak': self._go_streak,
                        'required': self._go_stability_required,
                        'is_stable': self._stable_go,
                        'status': 'READY' if self._stable_go else f'{self._go_streak}/{self._go_stability_required}'
                    }
                },
                'risk': {
                    'level': self._metrics['risk_level'],
                    'circuit': self._metrics['circuit']
                },
                'execution': {
                    'errors': self._metrics['errors']
                },
                'recent_decisions': self._recent_decisions[:20]
            }
    
    def _get_system_status(self) -> str:
        """获取系统整体状态"""
        status = self._go_no_go.get('status', 'pending')
        if status == 'pending':
            return 'initializing'
        elif status == 'no_go':
            return 'block' if self._metrics['aggressive'] > 0 else 'warn'
        else:
            # GO 状态下，检查是否有高差异率警告
            if self._metrics['diff_rate'] > 0.3:
                return 'warn'  # 警告但不影响 GO
            return 'safe'
    
    def update(self, data: Dict[str, Any]):
        """
        兼容方法：通用更新接口
        
        根据数据类型自动路由到正确的更新方法
        """
        update_type = data.get('type', 'unknown')
        
        if update_type == 'shadow_trade':
            self.on_shadow_trade(data.get('data', {}))
        elif update_type == 'risk':
            self.on_risk_update(data.get('data', {}))
        elif update_type == 'execution':
            self.on_execution_update(data.get('data', {}))
        else:
            # 尝试直接更新 metrics
            with self._lock:
                for key, value in data.items():
                    if key in self._metrics:
                        self._metrics[key] = value
                self._go_no_go = self._engine.evaluate(self._metrics)
                self._last_update = datetime.utcnow()


# ============ 单例实例 ============
# 关键：全局唯一，避免多实例问题
state_store = SystemStateStore()


def get_state_store() -> SystemStateStore:
    """获取 StateStore 实例"""
    return state_store