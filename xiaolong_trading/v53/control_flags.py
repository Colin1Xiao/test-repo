"""
Control Flags - 全局控制标志

⚠️ CRITICAL:
   GO/NO-GO only grants permission.
   NEVER auto-switch execution mode.

这是系统的"中央控制台"，所有执行都必须经过这里。
"""

from typing import Optional
from enum import Enum


class SystemMode(Enum):
    """系统模式"""
    SHADOW = "shadow"        # V3 只观察
    HYBRID = "hybrid"        # V3 过滤 + 减仓
    WEIGHTED = "weighted"    # V3 权重参与
    FULL = "full"            # V3 完全接管
    FALLBACK = "fallback"    # 紧急回退


class ControlFlags:
    """全局控制标志"""
    
    def __init__(self):
        self.SYSTEM_MODE = SystemMode.HYBRID
        self.V3_WEIGHT = 0.0
        self.ENABLE_V3 = True
        self.FORCE_FALLBACK = False
        self.CURRENT_PHASE = "STEP_0_HYBRID"
        self.PHASE_HISTORY = []
        self.MAX_DRAWDOWN = 0.1
        self.MAX_ERRORS = 3
        self.BASELINE_PF = None
        self.BASELINE_SLIPPAGE = None
        
        print(f"✅ ControlFlags 初始化: {self.SYSTEM_MODE.value}, 权重={self.V3_WEIGHT}")
    
    def set_mode(self, mode: str) -> bool:
        try:
            new_mode = SystemMode(mode.lower())
            old_mode = self.SYSTEM_MODE
            self.SYSTEM_MODE = new_mode
            print(f"🔄 模式切换: {old_mode.value} → {new_mode.value}")
            return True
        except ValueError:
            return False
    
    def set_weight(self, weight: float) -> bool:
        if 0.0 <= weight <= 1.0:
            self.V3_WEIGHT = weight
            if weight <= 0.3:
                self.CURRENT_PHASE = f"STEP_1_WEIGHTED_{weight:.1f}"
            elif weight <= 0.6:
                self.CURRENT_PHASE = f"STEP_2_WEIGHTED_{weight:.1f}"
            elif weight <= 0.9:
                self.CURRENT_PHASE = f"STEP_3_WEIGHTED_{weight:.1f}"
            else:
                self.CURRENT_PHASE = "STEP_4_FULL_READY"
            print(f"📊 V3 权重: {weight:.1f}, 阶段: {self.CURRENT_PHASE}")
            return True
        return False
    
    def fallback(self, reason: str = "手动触发"):
        self.FORCE_FALLBACK = True
        self.SYSTEM_MODE = SystemMode.FALLBACK
        print(f"🚨 紧急回退: {reason}")
    
    def safety_check(self, metrics: dict) -> Optional[str]:
        if metrics.get("error_count", 0) >= self.MAX_ERRORS:
            return f"错误数超限"
        if metrics.get("drawdown", 0) >= self.MAX_DRAWDOWN:
            return f"回撤超限"
        if metrics.get("aggressive", 0) > 0:
            return f"激进决策"
        return None
    
    def get_recommendation(self, metrics: dict) -> str:
        safety_issue = self.safety_check(metrics)
        if safety_issue:
            return f"ROLLBACK: {safety_issue}"
        
        if self.CURRENT_PHASE == "STEP_0_HYBRID":
            if metrics.get("go_stability", 0) >= 10:
                return "ADVANCE: 可进入 STEP_1 (V3_WEIGHT=0.2)"
            return "CONTINUE: 等待 GO Stability ≥ 10"
        
        return "CONTINUE"
    
    def to_dict(self) -> dict:
        return {
            "mode": self.SYSTEM_MODE.value,
            "v3_weight": self.V3_WEIGHT,
            "phase": self.CURRENT_PHASE,
            "enabled": self.ENABLE_V3,
            "force_fallback": self.FORCE_FALLBACK
        }


# 全局实例
control_flags = ControlFlags()


def get_control_flags() -> ControlFlags:
    """获取 ControlFlags 实例"""
    return control_flags


def weighted_decision(old: dict, v3: dict) -> dict:
    """权重决策"""
    import random
    
    v3_action = v3.get("action", "EXECUTE")
    
    # BLOCK / STOP 绝对优先
    if v3_action in ["BLOCK", "STOP"]:
        return {**v3, "source": "V3", "reason": f"V3_{v3_action}", "v3_participated": True}
    
    # 按权重选择
    if random.random() < control_flags.V3_WEIGHT:
        return {**v3, "source": "V3", "reason": f"V3_W{control_flags.V3_WEIGHT:.1f}", "v3_participated": True}
    
    return {**old, "source": "V5.2", "reason": f"V5.2_W{1-control_flags.V3_WEIGHT:.1f}", "v3_participated": False}


if __name__ == "__main__":
    print("🧪 Control Flags 测试")
    flags = ControlFlags()
    
    # 测试阶段推进
    flags.set_weight(0.2)
    print(f"阶段: {flags.CURRENT_PHASE}")
    
    flags.set_weight(0.5)
    print(f"阶段: {flags.CURRENT_PHASE}")
    
    flags.set_weight(0.8)
    print(f"阶段: {flags.CURRENT_PHASE}")
    
    flags.set_weight(1.0)
    print(f"阶段: {flags.CURRENT_PHASE}")