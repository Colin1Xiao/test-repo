"""
Hybrid Controller - Soft Switch 核心控制器

核心原则：
1. V5.2 = 执行主体
2. V3 = 风控裁决层（过滤 + 减仓）
3. 任何时候都可以一键回退到 V5.2

⚠️ CRITICAL:
   GO/NO-GO only grants permission.
   NEVER auto-switch execution mode.
"""

from typing import Dict, Any, Optional
from enum import Enum
from datetime import datetime
import json


class SystemMode(Enum):
    """系统模式"""
    SHADOW = "shadow"      # V3 只观察，不参与
    HYBRID = "hybrid"      # V3 参与（过滤 + 减仓）
    WEIGHTED = "weighted"  # V3 权重参与
    FULL = "full"          # V3 完全接管
    FALLBACK = "fallback"  # 紧急回退到 V5.2


class V3Action(Enum):
    """V3 决策动作"""
    EXECUTE = "EXECUTE"    # 正常执行
    REDUCE = "REDUCE"      # 减仓执行
    BLOCK = "BLOCK"        # 阻止交易
    SKIP = "SKIP"          # 跳过
    STOP = "STOP"          # 全局停止


class HybridController:
    """
    Hybrid Mode 控制器
    V5.2 执行 + V3 风控裁决
    """
    
    def __init__(self):
        self.mode = SystemMode.SHADOW
        self.v3_weight = 0.0  # 0.0 → 1.0，用于 WEIGHTED 模式
        self.enabled = True   # 全局开关
        self.logs: list = []
        
        # 安全限制
        self.max_reduce_ratio = 0.5  # 最大减仓比例
        self.error_count = 0
        self.max_errors = 3  # 最大错误数，超过后自动 FALLBACK
        
        print("✅ HybridController 初始化完成")
        print(f"   模式: {self.mode.value}")
    
    def set_mode(self, mode: str) -> bool:
        """设置系统模式"""
        try:
            new_mode = SystemMode(mode.lower())
            old_mode = self.mode
            self.mode = new_mode
            print(f"🔄 模式切换: {old_mode.value} → {new_mode.value}")
            return True
        except ValueError:
            print(f"⚠️ 无效模式: {mode}")
            return False
    
    def set_weight(self, weight: float) -> bool:
        """设置 V3 权重 (0.0 → 1.0)"""
        if 0.0 <= weight <= 1.0:
            self.v3_weight = weight
            print(f"📊 V3 权重设置: {weight:.1f}")
            return True
        return False
    
    def fallback(self, reason: str = "手动回退"):
        """紧急回退到 V5.2"""
        self.mode = SystemMode.FALLBACK
        print(f"🚨 紧急回退: {reason}")
        self._log_event("FALLBACK", {"reason": reason})
    
    def process(self, old_decision: Dict[str, Any], v3_decision: Dict[str, Any]) -> Dict[str, Any]:
        """
        处理决策
        
        输入:
            old_decision: V5.2 决策
            v3_decision: V3 决策
        
        输出:
            final_decision: 最终执行决策
        """
        # 1. 检查全局开关
        if not self.enabled:
            return self._fallback_decision(old_decision, "系统禁用")
        
        # 2. FALLBACK 模式：直接使用旧决策
        if self.mode == SystemMode.FALLBACK:
            return self._fallback_decision(old_decision, "回退模式")
        
        # 3. SHADOW 模式：V3 不参与
        if self.mode == SystemMode.SHADOW:
            return {
                **old_decision,
                "source": "V5.2",
                "reason": "SHADOW_MODE",
                "v3_participated": False
            }
        
        # 4. 提取 V3 动作
        v3_action = v3_decision.get("action", "EXECUTE")
        
        # 5. FULL 模式：直接使用 V3 决策
        if self.mode == SystemMode.FULL:
            return {
                **v3_decision,
                "source": "V3",
                "reason": "FULL_MODE",
                "v3_participated": True
            }
        
        # 6. HYBRID 模式：V3 作为风控层
        if self.mode == SystemMode.HYBRID:
            return self._hybrid_process(old_decision, v3_decision, v3_action)
        
        # 7. WEIGHTED 模式：按权重混合
        if self.mode == SystemMode.WEIGHTED:
            return self._weighted_process(old_decision, v3_decision, v3_action)
        
        # 默认：使用旧决策
        return self._fallback_decision(old_decision, "未知模式")
    
    def _hybrid_process(self, old_decision: Dict, v3_decision: Dict, v3_action: str) -> Dict:
        """HYBRID 模式处理：V3 作为风控层"""
        
        # BLOCK：阻止交易
        if v3_action == "BLOCK":
            return {
                "action": "SKIP",
                "size": 0,
                "source": "V3",
                "reason": "V3_BLOCK",
                "v3_participated": True,
                "blocked": True
            }
        
        # STOP：全局停止
        if v3_action == "STOP":
            return {
                "action": "STOP",
                "size": 0,
                "source": "V3",
                "reason": "V3_STOP",
                "v3_participated": True,
                "stop_all": True
            }
        
        # REDUCE：减仓
        if v3_action == "REDUCE":
            original_size = old_decision.get("size", 1.0)
            reduced_size = original_size * self.max_reduce_ratio
            return {
                **old_decision,
                "size": reduced_size,
                "source": "HYBRID",
                "reason": "V3_REDUCE",
                "v3_participated": True,
                "size_reduced": True,
                "original_size": original_size
            }
        
        # SKIP：跳过
        if v3_action == "SKIP":
            return {
                "action": "SKIP",
                "size": 0,
                "source": "V3",
                "reason": "V3_SKIP",
                "v3_participated": True
            }
        
        # EXECUTE：正常执行 V5.2 决策
        return {
            **old_decision,
            "source": "V5.2",
            "reason": "V5.2_EXECUTE",
            "v3_participated": False
        }
    
    def _weighted_process(self, old_decision: Dict, v3_decision: Dict, v3_action: str) -> Dict:
        """WEIGHTED 模式处理：按权重混合"""
        
        # BLOCK / STOP 仍然绝对优先
        if v3_action in ["BLOCK", "STOP"]:
            return self._hybrid_process(old_decision, v3_decision, v3_action)
        
        # 按权重决定是否使用 V3 决策
        import random
        if random.random() < self.v3_weight:
            return {
                **v3_decision,
                "source": "V3",
                "reason": f"V3_WEIGHTED_{self.v3_weight:.1f}",
                "v3_participated": True,
                "weight": self.v3_weight
            }
        
        # 使用 V5.2 决策
        return {
            **old_decision,
            "source": "V5.2",
            "reason": f"V5.2_WEIGHTED_{1-self.v3_weight:.1f}",
            "v3_participated": False,
            "weight": 1 - self.v3_weight
        }
    
    def _fallback_decision(self, old_decision: Dict, reason: str) -> Dict:
        """生成回退决策"""
        return {
            **old_decision,
            "source": "V5.2",
            "reason": f"FALLBACK_{reason}",
            "v3_participated": False,
            "fallback": True
        }
    
    def _log_event(self, event_type: str, data: Dict):
        """记录事件"""
        event = {
            "timestamp": datetime.utcnow().isoformat(),
            "type": event_type,
            "mode": self.mode.value,
            "data": data
        }
        self.logs.append(event)
        if len(self.logs) > 100:
            self.logs = self.logs[-100:]
    
    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        return {
            "mode": self.mode.value,
            "v3_weight": self.v3_weight,
            "enabled": self.enabled,
            "error_count": self.error_count,
            "logs_count": len(self.logs)
        }
    
    def to_dict(self) -> Dict[str, Any]:
        """序列化"""
        return {
            "mode": self.mode.value,
            "v3_weight": self.v3_weight,
            "enabled": self.enabled,
            "max_reduce_ratio": self.max_reduce_ratio,
            "error_count": self.error_count
        }


# ============ 全局实例 ============
hybrid_controller = HybridController()


def get_hybrid_controller() -> HybridController:
    """获取 HybridController 实例"""
    return hybrid_controller


# ============ 使用示例 ============
if __name__ == "__main__":
    print("="*60)
    print("🧪 Hybrid Controller 测试")
    print("="*60)
    
    controller = HybridController()
    
    # 测试 SHADOW 模式
    print("\n📌 SHADOW 模式:")
    controller.set_mode("shadow")
    result = controller.process(
        {"action": "BUY", "size": 1.0, "symbol": "BTC"},
        {"action": "BLOCK", "size": 0, "symbol": "BTC"}
    )
    print(f"  V5.2: BUY, V3: BLOCK → {result['action']} (source: {result['source']})")
    
    # 测试 HYBRID 模式
    print("\n📌 HYBRID 模式:")
    controller.set_mode("hybrid")
    
    result = controller.process(
        {"action": "BUY", "size": 1.0},
        {"action": "BLOCK"}
    )
    print(f"  V5.2: BUY, V3: BLOCK → {result['action']} (reason: {result['reason']})")
    
    result = controller.process(
        {"action": "BUY", "size": 1.0},
        {"action": "REDUCE"}
    )
    print(f"  V5.2: BUY(size=1), V3: REDUCE → {result['action']}(size={result['size']})")
    
    result = controller.process(
        {"action": "BUY", "size": 1.0},
        {"action": "EXECUTE"}
    )
    print(f"  V5.2: BUY, V3: EXECUTE → {result['action']} (source: {result['source']})")
    
    # 测试 FALLBACK
    print("\n📌 FALLBACK 测试:")
    controller.fallback("手动回退测试")
    result = controller.process(
        {"action": "BUY", "size": 1.0},
        {"action": "BLOCK"}
    )
    print(f"  结果: {result['action']} (fallback: {result.get('fallback', False)})")
    
    print("\n" + "="*60)
    print("✅ 测试完成")
    print("="*60)