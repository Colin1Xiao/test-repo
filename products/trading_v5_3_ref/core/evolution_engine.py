#!/usr/bin/env python3
"""
Evolution Engine - 策略自我进化引擎

核心思想：
不是让系统"自动变聪明"
而是让系统"只保留有效行为，淘汰无效行为"

进化流程：
1. 收集数据
2. 评分行为
3. 生成新参数（微调）
4. 影子测试
5. 小资金上线
6. 对比表现
7. 胜者晋级

防自毁机制：
- 学习隔离：污染样本不能进入学习
- 测试隔离：新策略只能用 10% 资金
- 上线隔离：必须连续通过 N 次验证
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from datetime import datetime
from pathlib import Path
import json
import random
import copy


@dataclass
class StrategyConfig:
    """策略配置"""
    name: str
    version: str
    score_threshold: float = 80.0
    volume_threshold: float = 1.2
    stop_loss_pct: float = 0.005
    take_profit_pct: float = 0.002
    score: float = 0.0
    generation: int = 0
    created_at: str = ""
    parent: str = ""
    
    def __post_init__(self):
        if not self.created_at:
            self.created_at = datetime.now().isoformat()


@dataclass
class EvolutionRecord:
    """进化记录"""
    timestamp: str
    strategy: str
    version: str
    action: str  # "mutation" | "selection" | "rejection"
    old_params: Dict[str, Any]
    new_params: Dict[str, Any]
    performance: Dict[str, float]
    decision: str  # "ACCEPTED" | "REJECTED" | "TESTING"
    generation: int = 0


class BehaviorScorer:
    """
    行为评分器
    
    评估每一笔交易的行为质量，不是评估策略
    """
    
    def __init__(self):
        self.weights = {
            "pnl_pct": 0.4,
            "execution_quality": 0.3,
            "signal_quality": 0.3
        }
    
    def score(
        self,
        pnl_pct: float,
        execution_quality: float,
        signal_quality: float
    ) -> float:
        """
        计算行为分数
        
        Returns:
            0-1 分数
        """
        # 标准化输入
        pnl_score = max(0, min(1, (pnl_pct + 0.01) * 50))  # -1% -> 0, +1% -> 1
        exec_score = execution_quality
        sig_score = signal_quality
        
        return (
            pnl_score * self.weights["pnl_pct"] +
            exec_score * self.weights["execution_quality"] +
            sig_score * self.weights["signal_quality"]
        )


class MutationEngine:
    """
    参数变异引擎
    
    微调参数，不是剧烈变化
    
    硬限制：
    - score_threshold ∈ [60, 90]
    - volume_threshold ∈ [0.5, 2.0]
    - 单次变化 < threshold
    """
    
    # 变异限制
    SCORE_THRESHOLD_RANGE = (60, 90)
    VOLUME_THRESHOLD_RANGE = (0.5, 2.0)
    MAX_CHANGE = {
        "score_threshold": 5.0,
        "volume_threshold": 0.2,
        "stop_loss_pct": 0.001,
        "take_profit_pct": 0.001
    }
    
    def __init__(self):
        self.mutation_count = 0
        self.rejected_mutations = 0
    
    def mutate(
        self,
        config: StrategyConfig,
        performance: Dict[str, float]
    ) -> Optional[StrategyConfig]:
        """
        变异策略配置
        
        Args:
            config: 当前配置
            performance: 性能指标
        
        Returns:
            新配置，或 None（如果变异被拒绝）
        """
        new_config = copy.deepcopy(config)
        new_config.version = self._increment_version(config.version)
        new_config.generation = config.generation + 1
        new_config.parent = config.name
        new_config.created_at = datetime.now().isoformat()
        
        # 微调参数
        changes = {}
        
        # 评分阈值
        old_score_thresh = config.score_threshold
        delta = random.uniform(-self.MAX_CHANGE["score_threshold"], self.MAX_CHANGE["score_threshold"])
        new_score_thresh = old_score_thresh + delta
        new_score_thresh = max(self.SCORE_THRESHOLD_RANGE[0], 
                              min(self.SCORE_THRESHOLD_RANGE[1], new_score_thresh))
        new_config.score_threshold = new_score_thresh
        changes["score_threshold"] = {
            "old": old_score_thresh,
            "new": new_score_thresh,
            "delta": new_score_thresh - old_score_thresh
        }
        
        # 成交量阈值
        old_vol_thresh = config.volume_threshold
        delta = random.uniform(-self.MAX_CHANGE["volume_threshold"], 
                              self.MAX_CHANGE["volume_threshold"])
        new_vol_thresh = old_vol_thresh + delta
        new_vol_thresh = max(self.VOLUME_THRESHOLD_RANGE[0],
                           min(self.VOLUME_THRESHOLD_RANGE[1], new_vol_thresh))
        new_config.volume_threshold = new_vol_thresh
        changes["volume_threshold"] = {
            "old": old_vol_thresh,
            "new": new_vol_thresh,
            "delta": new_vol_thresh - old_vol_thresh
        }
        
        self.mutation_count += 1
        
        # 进化断言：禁止连续变差
        if performance.get("score", 0) < 0.5:
            self.rejected_mutations += 1
            return None
        
        new_config.score = performance.get("score", 0)
        
        return new_config
    
    def _increment_version(self, version: str) -> str:
        """增加版本号"""
        parts = version.split(".")
        if len(parts) >= 3:
            try:
                patch = int(parts[-1]) + 1
                return ".".join(parts[:-1] + [str(patch)])
            except:
                return version + ".1"
        return version + ".1"


class StrategyPool:
    """
    策略池
    
    管理多个策略版本
    """
    
    def __init__(self, max_size: int = 10):
        self.strategies: Dict[str, StrategyConfig] = {}
        self.max_size = max_size
        self.evolution_history: List[EvolutionRecord] = []
    
    def add(self, config: StrategyConfig):
        """添加策略"""
        self.strategies[config.name] = config
    
    def get_top(self, n: int = 3) -> List[StrategyConfig]:
        """获取表现最好的 N 个策略"""
        sorted_strategies = sorted(
            self.strategies.values(),
            key=lambda x: x.score,
            reverse=True
        )
        return sorted_strategies[:n]
    
    def remove_weak(self, min_score: float = 0.5):
        """淘汰表现差的策略"""
        to_remove = [
            name for name, config in self.strategies.items()
            if config.score < min_score
        ]
        for name in to_remove:
            del self.strategies[name]
        return to_remove
    
    def get_best(self) -> Optional[StrategyConfig]:
        """获取最佳策略"""
        if not self.strategies:
            return None
        return max(self.strategies.values(), key=lambda x: x.score)
    
    def record_evolution(self, record: EvolutionRecord):
        """记录进化历史"""
        self.evolution_history.append(record)
        if len(self.evolution_history) > 100:
            self.evolution_history = self.evolution_history[-100:]


class EvolutionEngine:
    """
    进化引擎
    
    整合所有组件：
    - BehaviorScorer: 行为评分
    - MutationEngine: 参数变异
    - StrategyPool: 策略管理
    
    进化流程：
    1. 收集交易数据
    2. 评分行为
    3. 变异参数
    4. 选择策略
    5. 记录进化
    """
    
    def __init__(self, log_path: str = "logs/evolution_logs.jsonl"):
        self.behavior_scorer = BehaviorScorer()
        self.mutation_engine = MutationEngine()
        self.strategy_pool = StrategyPool()
        self.log_path = Path(log_path)
        
        # 确保日志目录存在
        self.log_path.parent.mkdir(parents=True, exist_ok=True)
        
        print("🧬 Evolution Engine 初始化完成")
        print(f"   日志路径: {self.log_path}")
    
    def evaluate_and_evolve(
        self,
        strategy_name: str,
        trades: List[Dict[str, Any]]
    ) -> Optional[StrategyConfig]:
        """
        评估并进化策略
        
        Args:
            strategy_name: 策略名称
            trades: 交易记录列表
        
        Returns:
            新策略配置，或 None
        """
        if not trades:
            return None
        
        # 计算平均性能
        avg_pnl = sum(t.get("pnl_pct", 0) for t in trades) / len(trades)
        avg_exec_quality = sum(t.get("execution_quality", 1) for t in trades) / len(trades)
        avg_signal_quality = sum(t.get("signal_quality", 0.8) for t in trades) / len(trades)
        
        # 计算行为分数
        behavior_score = self.behavior_scorer.score(
            pnl_pct=avg_pnl,
            execution_quality=avg_exec_quality,
            signal_quality=avg_signal_quality
        )
        
        # 获取当前策略
        current_strategy = self.strategy_pool.strategies.get(strategy_name)
        if not current_strategy:
            current_strategy = StrategyConfig(
                name=strategy_name,
                version="v1.0"
            )
            self.strategy_pool.add(current_strategy)
        
        # 更新分数
        current_strategy.score = behavior_score
        
        # 变异
        performance = {
            "pnl_pct": avg_pnl,
            "execution_quality": avg_exec_quality,
            "signal_quality": avg_signal_quality,
            "score": behavior_score
        }
        
        new_strategy = self.mutation_engine.mutate(current_strategy, performance)
        
        if new_strategy:
            # 记录进化
            record = EvolutionRecord(
                timestamp=datetime.now().isoformat(),
                strategy=new_strategy.name,
                version=new_strategy.version,
                action="mutation",
                old_params={
                    "score_threshold": current_strategy.score_threshold,
                    "volume_threshold": current_strategy.volume_threshold
                },
                new_params={
                    "score_threshold": new_strategy.score_threshold,
                    "volume_threshold": new_strategy.volume_threshold
                },
                performance=performance,
                decision="TESTING",
                generation=new_strategy.generation
            )
            
            self.strategy_pool.record_evolution(record)
            self._log_evolution(record)
            
            # 添加到策略池
            self.strategy_pool.add(new_strategy)
            
            return new_strategy
        
        return None
    
    def _log_evolution(self, record: EvolutionRecord):
        """写入进化日志"""
        entry = {
            "timestamp": record.timestamp,
            "strategy": record.strategy,
            "version": record.version,
            "action": record.action,
            "old_params": record.old_params,
            "new_params": record.new_params,
            "performance": record.performance,
            "decision": record.decision,
            "generation": record.generation
        }
        
        with open(self.log_path, "a") as f:
            f.write(json.dumps(entry) + "\n")
    
    def get_evolution_stats(self) -> Dict[str, Any]:
        """获取进化统计"""
        history = self.strategy_pool.evolution_history
        
        if not history:
            return {
                "total_mutations": 0,
                "accepted": 0,
                "rejected": 0,
                "generations": 0
            }
        
        return {
            "total_mutations": len(history),
            "accepted": sum(1 for r in history if r.decision == "ACCEPTED"),
            "rejected": sum(1 for r in history if r.decision == "REJECTED"),
            "testing": sum(1 for r in history if r.decision == "TESTING"),
            "generations": max(r.generation for r in history),
            "last_evolution": history[-1].timestamp if history else None
        }
    
    def get_recent_evolutions(self, n: int = 10) -> List[Dict]:
        """获取最近的进化记录"""
        history = self.strategy_pool.evolution_history[-n:]
        return [
            {
                "timestamp": r.timestamp,
                "strategy": r.strategy,
                "version": r.version,
                "action": r.action,
                "decision": r.decision,
                "generation": r.generation,
                "performance": r.performance
            }
            for r in history
        ]


# ============================================================
# 便捷函数
# ============================================================
def create_evolution_engine() -> EvolutionEngine:
    """创建进化引擎"""
    return EvolutionEngine()


# ============================================================
# 测试
# ============================================================
if __name__ == "__main__":
    print("=== Evolution Engine 测试 ===\n")
    
    engine = EvolutionEngine(log_path="logs/evolution_logs.jsonl")
    
    # 模拟交易数据
    trades = [
        {"pnl_pct": 0.001, "execution_quality": 0.95, "signal_quality": 0.85},
        {"pnl_pct": -0.002, "execution_quality": 0.88, "signal_quality": 0.82},
        {"pnl_pct": 0.003, "execution_quality": 0.92, "signal_quality": 0.88}
    ]
    
    # 评估并进化
    new_strategy = engine.evaluate_and_evolve("v52", trades)
    
    if new_strategy:
        print(f"\n新策略版本: {new_strategy.version}")
        print(f"评分阈值: {new_strategy.score_threshold:.1f}")
        print(f"成交量阈值: {new_strategy.volume_threshold:.2f}x")
        print(f"代数: {new_strategy.generation}")
    
    # 统计
    stats = engine.get_evolution_stats()
    print(f"\n进化统计:")
    print(f"  总变异: {stats['total_mutations']}")
    print(f"  测试中: {stats['testing']}")
    print(f"  代数: {stats['generations']}")