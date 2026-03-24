#!/usr/bin/env python3
"""
Decision Hub - 唯一决策源（Single Source of Truth）

职责：
1. 统一所有交易决策
2. 整合 Guard + Audit + Control
3. 提供唯一交易入口

使用：
    from core.decision_hub import DecisionHub
    
    hub = DecisionHub()
    
    # 唯一决策入口
    decision = hub.evaluate(signal)
    
    if decision.can_trade:
        execute(decision)
"""

import time
import uuid
import hashlib
from datetime import datetime
from typing import Dict, Optional, List
from dataclasses import dataclass, field
from enum import Enum
import json


class DecisionType(Enum):
    """决策类型"""
    EXECUTE = "✅ EXECUTE"
    SKIP = "⚠️ SKIP"
    REDUCE = "🟡 REDUCE"
    BLOCK = "🚫 BLOCK"
    STOP = "🛑 STOP"


@dataclass
class Decision:
    """
    决策结果（不可伪造）
    
    所有 Execution 必须接收 Decision 对象
    不允许绕过 Decision Hub 直接执行
    """
    decision_type: DecisionType
    can_trade: bool
    position_multiplier: float
    reasons: List[str]
    checks: Dict
    
    # 决策元数据
    timestamp: str
    source: str = "decision_hub"
    
    # 🔒 防绕过机制
    trace_id: str = ""
    decision_hash: str = ""
    authorized: bool = False
    
    def __post_init__(self):
        """自动生成防篡改哈希"""
        if not self.trace_id:
            self.trace_id = f"{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:8]}"
        
        if not self.decision_hash:
            # 生成决策哈希（防篡改）
            data = f"{self.decision_type.value}{self.trace_id}{self.timestamp}"
            self.decision_hash = hashlib.sha256(data.encode()).hexdigest()[:16]
    
    def is_authorized(self) -> bool:
        """检查决策是否来自 Decision Hub"""
        return self.authorized and self.trace_id and self.decision_hash
    
    def verify(self) -> bool:
        """验证决策完整性"""
        expected_hash = hashlib.sha256(
            f"{self.decision_type.value}{self.trace_id}{self.timestamp}".encode()
        ).hexdigest()[:16]
        return self.decision_hash == expected_hash
    
    def __str__(self) -> str:
        lines = [
            "=" * 60,
            "🎯 DECISION HUB - 唯一决策源",
            "=" * 60,
            f"时间: {self.timestamp}",
            "",
            f"裁决: {self.decision_type.value}",
            "",
            "决策:",
            f"  允许交易: {'✅ YES' if self.can_trade else '❌ NO'}",
            f"  仓位倍数: {self.position_multiplier:.1f}x",
            "",
            "检查结果:",
        ]
        
        for check, result in self.checks.items():
            status = "✅" if result else "❌"
            lines.append(f"  {status} {check}")
        
        if self.reasons:
            lines.append("")
            lines.append("原因:")
            for reason in self.reasons:
                lines.append(f"  - {reason}")
        
        lines.append("=" * 60)
        
        return "\n".join(lines)


class DecisionHub:
    """
    决策中枢
    
    统一决策链：
    Signal → Integrity → Risk → Audit → Capital → Decision
    """
    
    def __init__(self, log_file: str = "logs/decision_log.jsonl"):
        """
        初始化
        
        Args:
            log_file: 决策日志文件（不可篡改）
        """
        # 子系统
        self.integrity_guard = None
        self.risk_checks = None
        self.audit = None
        self.capital_controller = None
        
        # 统计
        self.stats = {
            'total_decisions': 0,
            'executes': 0,
            'skips': 0,
            'blocks': 0,
            'stops': 0
        }
        
        # 上次决策
        self.last_decision: Optional[Decision] = None
        
        # 📝 决策日志（不可篡改）
        self.log_file = log_file
        self._ensure_log_file()
    
    def _ensure_log_file(self):
        """确保日志文件存在"""
        import os
        os.makedirs(os.path.dirname(self.log_file), exist_ok=True)
        if not os.path.exists(self.log_file):
            with open(self.log_file, 'w') as f:
                f.write("")
    
    def attach(self, integrity_guard=None, risk_checks=None, audit=None, capital_controller=None):
        """
        附加子系统
        
        Args:
            integrity_guard: SystemIntegrityGuard
            risk_checks: 风控检查器
            audit: ProfitAuditor
            capital_controller: CapitalController
        """
        self.integrity_guard = integrity_guard
        self.risk_checks = risk_checks
        self.audit = audit
        self.capital_controller = capital_controller
    
    def evaluate(
        self,
        signal: Optional[Dict] = None,
        symbol: str = None,
        price: float = None,
        score: int = 0,
        regime: str = "RANGE"
    ) -> Decision:
        """
        评估并做出决策
        
        这是唯一决策入口
        
        Args:
            signal: 信号数据
            symbol: 交易对
            price: 价格
            score: 评分
            regime: 市场状态
            
        Returns:
            Decision
        """
        self.stats['total_decisions'] += 1
        checks = {}
        reasons = []
        
        # 1. Integrity Check（最高优先级）
        if self.integrity_guard:
            integrity_ok = self.integrity_guard.can_trade()
            checks['integrity'] = integrity_ok
            
            if not integrity_ok:
                self.stats['stops'] += 1
                decision = Decision(
                    decision_type=DecisionType.STOP,
                    can_trade=False,
                    position_multiplier=0,
                    reasons=["Integrity Guard 阻断"],
                    checks=checks,
                    timestamp=datetime.now().isoformat()
                )
                self.last_decision = decision
                return decision
        else:
            checks['integrity'] = True
        
        # 2. Kill Switch Check
        if self.capital_controller and hasattr(self.capital_controller, 'kill_switch'):
            if self.capital_controller.kill_switch.is_killed():
                checks['kill_switch'] = False
                self.stats['stops'] += 1
                decision = Decision(
                    decision_type=DecisionType.STOP,
                    can_trade=False,
                    position_multiplier=0,
                    reasons=["Kill Switch 已触发"],
                    checks=checks,
                    timestamp=datetime.now().isoformat()
                )
                self.last_decision = decision
                return decision
        
        checks['kill_switch'] = True
        
        # 3. Risk Checks
        risk_ok = True
        
        # 延迟检查
        if signal and 'latency_ms' in signal:
            latency_ok = signal['latency_ms'] < 1500
            checks['latency'] = latency_ok
            if not latency_ok:
                risk_ok = False
                reasons.append(f"延迟过高: {signal['latency_ms']:.0f}ms")
        
        # Regime 检查
        regime_ok = regime.upper() in ['RANGE', 'TREND']
        checks['regime'] = regime_ok
        if not regime_ok:
            risk_ok = False
            reasons.append(f"Regime 禁止: {regime}")
        
        if not risk_ok:
            self.stats['blocks'] += 1
            decision = Decision(
                decision_type=DecisionType.BLOCK,
                can_trade=False,
                position_multiplier=0,
                reasons=reasons,
                checks=checks,
                timestamp=datetime.now().isoformat()
            )
            self.last_decision = decision
            return decision
        
        # 4. Audit Check
        if self.audit:
            report = self.audit.generate_report()
            expectancy = report.profit_stats.expectancy
            expectancy_ok = expectancy > 0
            checks['expectancy'] = expectancy_ok
            
            if not expectancy_ok:
                reasons.append(f"期望值为负: {expectancy:.4f}")
        
        # 5. Capital Control Decision
        position_multiplier = 1.0
        
        if self.capital_controller:
            # 获取资金控制器状态
            if self.capital_controller.should_reduce():
                position_multiplier = 0.5
                reasons.append("资金控制器建议减仓")
            
            if self.capital_controller.should_stop():
                self.stats['stops'] += 1
                decision = Decision(
                    decision_type=DecisionType.STOP,
                    can_trade=False,
                    position_multiplier=0,
                    reasons=["资金控制器停止"],
                    checks=checks,
                    timestamp=datetime.now().isoformat()
                )
                self.last_decision = decision
                return decision
        
        # 6. 最终决策
        if position_multiplier < 1.0:
            decision_type = DecisionType.REDUCE
        elif checks.get('expectancy', True):
            decision_type = DecisionType.EXECUTE
        else:
            decision_type = DecisionType.SKIP
        
        if decision_type == DecisionType.EXECUTE:
            self.stats['executes'] += 1
        elif decision_type == DecisionType.SKIP:
            self.stats['skips'] += 1
        elif decision_type == DecisionType.REDUCE:
            self.stats['executes'] += 1
        
        decision = Decision(
            decision_type=decision_type,
            can_trade=decision_type in [DecisionType.EXECUTE, DecisionType.REDUCE],
            position_multiplier=position_multiplier,
            reasons=reasons if reasons else ["所有检查通过"],
            checks=checks,
            timestamp=datetime.now().isoformat()
        )
        
        # 🔒 授权决策
        decision.authorized = True
        
        # 📝 记录决策日志
        self._log_decision(decision, symbol, price, score, regime)
        
        self.last_decision = decision
        return decision
    
    def get_position_size(self, base_position: float = 3.0) -> float:
        """
        获取最终仓位大小
        
        Args:
            base_position: 基础仓位
            
        Returns:
            实际仓位
        """
        if self.last_decision:
            return base_position * self.last_decision.position_multiplier
        return base_position
    
    def _log_decision(self, decision: Decision, symbol: str, price: float, score: int, regime: str):
        """
        记录决策日志（不可篡改）
        
        每个决策一行 JSON
        """
        import os
        
        log_entry = {
            'trace_id': decision.trace_id,
            'timestamp': decision.timestamp,
            'decision_type': decision.decision_type.value,
            'can_trade': decision.can_trade,
            'position_multiplier': decision.position_multiplier,
            'reasons': decision.reasons,
            'checks': decision.checks,
            'decision_hash': decision.decision_hash,
            'context': {
                'symbol': symbol,
                'price': price,
                'score': score,
                'regime': regime
            }
        }
        
        # 追加写入日志
        with open(self.log_file, 'a') as f:
            f.write(json.dumps(log_entry) + '\n')
    
    def verify_decision(self, decision: Decision) -> bool:
        """
        验证决策是否来自 Decision Hub
        
        Args:
            decision: 要验证的决策
            
        Returns:
            True = 授权决策，False = 伪造决策
        """
        if not isinstance(decision, Decision):
            return False
        
        if not decision.is_authorized():
            return False
        
        if not decision.verify():
            return False
        
        return True
    
    def get_decision_history(self, limit: int = 10) -> List[Dict]:
        """
        获取决策历史
        
        Args:
            limit: 最大数量
            
        Returns:
            决策列表
        """
        decisions = []
        try:
            with open(self.log_file, 'r') as f:
                lines = f.readlines()[-limit:]
                for line in reversed(lines):
                    if line.strip():
                        decisions.append(json.loads(line))
        except:
            pass
        
        return decisions

    def get_stats(self) -> Dict:
        """获取统计"""
        return self.stats.copy()
    
    def report(self) -> str:
        """生成报告"""
        if self.last_decision:
            return str(self.last_decision)
        return "暂无决策记录"


# 全局实例
_hub: Optional[DecisionHub] = None


def get_decision_hub() -> DecisionHub:
    """获取全局决策中枢"""
    global _hub
    if _hub is None:
        _hub = DecisionHub()
    return _hub


# 测试
if __name__ == "__main__":
    print("🧪 决策中枢测试")
    
    hub = DecisionHub()
    
    # 测试正常信号
    decision = hub.evaluate(
        signal={'latency_ms': 1000},
        symbol="ETH/USDT:USDT",
        price=2200,
        score=80,
        regime="RANGE"
    )
    
    print(decision)
    
    print(f"\n📊 统计: {hub.get_stats()}")