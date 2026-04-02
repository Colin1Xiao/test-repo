"""
V5.4.1 信号评分器 (L3 层)

核心原则：
1. 加权评分
2. 分桶决策 (A/B/C/D)
3. 只有 A/B 档允许交易

权重配置：
- trend_consistency: 22
- pullback_breakout: 18
- volume_confirm: 18
- spread_quality: 20
- volatility_range: 12
- rl_filter: 10

阈值：
- entry_threshold: 68
- high_confidence_threshold: 78
- record_only_threshold: 58
"""

import json
from pathlib import Path
from typing import Dict, Any, Optional, Tuple
from datetime import datetime


class SignalScorerV54:
    """
    V5.4.1 L3 评分器
    
    输入：候选信号因子
    输出：评分 + 分桶 + 决策
    """
    
    def __init__(self, config_path: str = None):
        # 默认权重
        self.weights = {
            "trend_consistency": 22,
            "pullback_breakout": 18,
            "volume_confirm": 18,
            "spread_quality": 20,
            "volatility_range": 12,
            "rl_filter": 10
        }
        
        # 阈值
        self.thresholds = {
            "entry_threshold": 68,
            "high_confidence_threshold": 78,
            "record_only_threshold": 58
        }
        
        # 加载配置文件
        if config_path:
            self._load_config(config_path)
        
        # 总分 (用于归一化)
        self.total_weight = sum(self.weights.values())  # 100
    
    def _load_config(self, config_path: str):
        """加载配置文件"""
        try:
            with open(config_path, 'r') as f:
                full_config = json.load(f)
            
            l3_config = full_config.get("signal_v54", {}).get("l3_scoring", {})
            
            if "weights" in l3_config:
                self.weights.update(l3_config["weights"])
            if "thresholds" in l3_config:
                self.thresholds.update(l3_config["thresholds"])
        except Exception as e:
            print(f"⚠️ [SignalScorer] 加载配置失败：{e}，使用默认配置")
    
    def score(self, 
              trend_consistency: float,
              pullback_breakout: float,
              volume_confirm: float,
              spread_quality: float,
              volatility_range: float,
              rl_filter: float) -> Tuple[float, Dict[str, Any]]:
        """
        计算加权评分
        
        Args:
            trend_consistency: 趋势一致性 (0-1)
            pullback_breakout: 回调突破 (0-1)
            volume_confirm: 成交量确认 (0-1)
            spread_quality: 点差质量 (0-1, 1=最优)
            volatility_range: 波动率适中 (0-1)
            rl_filter: RL 过滤 (0-1)
        
        Returns:
            (total_score, details)
            total_score: 0-100
        """
        details = {
            "components": {
                "trend_consistency": trend_consistency * self.weights["trend_consistency"],
                "pullback_breakout": pullback_breakout * self.weights["pullback_breakout"],
                "volume_confirm": volume_confirm * self.weights["volume_confirm"],
                "spread_quality": spread_quality * self.weights["spread_quality"],
                "volatility_range": volatility_range * self.weights["volatility_range"],
                "rl_filter": rl_filter * self.weights["rl_filter"]
            },
            "weights": self.weights.copy()
        }
        
        total_score = sum(details["components"].values())
        details["total_score"] = total_score
        details["max_score"] = self.total_weight
        
        return total_score, details
    
    def decide(self, score: float) -> Tuple[str, str, str]:
        """
        根据评分做决策
        
        Args:
            score: 评分 (0-100)
        
        Returns:
            (bucket, action, reason)
            bucket: A/B/C/D
            action: high_confidence_trade / normal_trade / record_only / discard
            reason: 决策原因
        """
        if score >= self.thresholds["high_confidence_threshold"]:
            return "A", "high_confidence_trade", f"高置信度信号 (score={score:.1f} >= {self.thresholds['high_confidence_threshold']})"
        elif score >= self.thresholds["entry_threshold"]:
            return "B", "normal_trade", f"正常交易信号 (score={score:.1f} >= {self.thresholds['entry_threshold']})"
        elif score >= self.thresholds["record_only_threshold"]:
            return "C", "record_only", f"仅记录不交易 (score={score:.1f} < {self.thresholds['entry_threshold']})"
        else:
            return "D", "discard", f"丢弃信号 (score={score:.1f} < {self.thresholds['record_only_threshold']})"
    
    def evaluate(self,
                 trend_consistency: float,
                 pullback_breakout: float,
                 volume_confirm: float,
                 spread_quality: float,
                 volatility_range: float,
                 rl_filter: float) -> Dict[str, Any]:
        """
        完整评估流程：评分 + 决策
        
        Args:
            各因子分数 (0-1)
        
        Returns:
            完整评估结果
        """
        # 计算评分
        total_score, score_details = self.score(
            trend_consistency,
            pullback_breakout,
            volume_confirm,
            spread_quality,
            volatility_range,
            rl_filter
        )
        
        # 决策
        bucket, action, reason = self.decide(total_score)
        
        return {
            "score": total_score,
            "bucket": bucket,
            "action": action,
            "reason": reason,
            "components": score_details["components"],
            "allow_trade": bucket in ["A", "B"],
            "timestamp": datetime.utcnow().isoformat()
        }


# 全局单例
_scorer_instance: Optional[SignalScorerV54] = None

def get_signal_scorer(config_path: str = None) -> SignalScorerV54:
    """获取 SignalScorer 单例"""
    global _scorer_instance
    if _scorer_instance is None:
        _scorer_instance = SignalScorerV54(config_path)
    return _scorer_instance
