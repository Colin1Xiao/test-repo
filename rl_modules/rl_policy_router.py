#!/usr/bin/env python3
"""
RL Policy Router - 强化学习策略路由器
负责管理不同策略版本的路由
"""

import json
from pathlib import Path
from typing import Dict, Any

class RLPolicyRouter:
    """RL 策略路由器"""
    
    def __init__(self, registry_path: str = "rl_modules/rl_model_registry.json"):
        self.registry_path = Path(registry_path)
        self.registry = self._load_registry()
        
    def _load_registry(self) -> Dict[str, Any]:
        """加载模型注册表"""
        if self.registry_path.exists():
            with open(self.registry_path, 'r') as f:
                return json.load(f)
        else:
            # 默认注册表
            return {
                "active_policy_version": "baseline_rule_v3x",
                "candidate_policy_version": "rl_policy_2026_03_17_a",
                "policy_status": "shadow",
                "models": {
                    "baseline_rule_v3x": {
                        "type": "rule_based",
                        "status": "active",
                        "created_at": "2026-03-17T02:02:00"
                    },
                    "rl_policy_2026_03_17_a": {
                        "type": "reinforcement_learning", 
                        "status": "shadow",
                        "created_at": "2026-03-17T02:02:00",
                        "training_enabled": False,
                        "inference_enabled": False,
                        "shadow_mode_enabled": True
                    }
                }
            }
    
    def get_active_policy(self) -> str:
        """获取当前激活的策略"""
        return self.registry.get("active_policy_version", "baseline_rule_v3x")
    
    def get_candidate_policy(self) -> str:
        """获取候选策略"""
        return self.registry.get("candidate_policy_version", "rl_policy_2026_03_17_a")
    
    def get_policy_status(self) -> str:
        """获取策略状态"""
        return self.registry.get("policy_status", "shadow")
    
    def is_rl_enabled(self) -> bool:
        """检查 RL 是否启用"""
        active_policy = self.get_active_policy()
        if active_policy.startswith("rl_policy_"):
            model_info = self.registry["models"].get(active_policy, {})
            return model_info.get("inference_enabled", False)
        return False
    
    def is_shadow_mode_enabled(self) -> bool:
        """检查影子模式是否启用"""
        candidate_policy = self.get_candidate_policy()
        if candidate_policy.startswith("rl_policy_"):
            model_info = self.registry["models"].get(candidate_policy, {})
            return model_info.get("shadow_mode_enabled", True)
        return False
