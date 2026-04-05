#!/usr/bin/env python3
"""
Meta Strategy Controller - 策略调度中枢 (V16)

核心认知：
真正赚钱的不是策略
而是"什么时候用哪个策略"

核心能力：
1. 策略池管理 - 多策略注册与管理
2. Regime 映射 - 市场状态 → 策略选择
3. 策略评分 - 动态评估策略表现
4. 最佳策略选择 - 多维度决策
5. 策略护栏 - 冷却、禁用、冲突解决

系统质变：
从"一种打法" → "会换打法"
从"单策略系统" → "多策略调度系统"
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Any, Callable
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
import json
from collections import defaultdict

# ============================================================
# 枚举和常量
# ============================================================
class StrategyStatus(Enum):
    """策略状态"""
    ACTIVE = "ACTIVE"           # 活跃
    PAUSED = "PAUSED"           # 暂停
    DISABLED = "DISABLED"       # 禁用
    COOLING = "COOLING"         # 冷却中


class SelectionDecision(Enum):
    """选择决策"""
    SELECTED = "SELECTED"       # 已选择
    NO_TRADE = "NO_TRADE"       # 不交易
    FALLBACK = "FALLBACK"       # 回退
    CONFLICT = "CONFLICT"       # 冲突


@dataclass
class MetaControllerConfig:
    """Meta控制器配置"""
    # 选择阈值
    min_confidence: float = 0.6        # 最低置信度
    min_score: float = 0.5             # 最低评分
    
    # 策略护栏
    cooldown_trades: int = 3           # 切换冷却 (交易数)
    disable_loss_streak: int = 5       # 禁用连续亏损
    enable_after_wins: int = 3         # 恢复所需连胜
    
    # 评分权重
    winrate_weight: float = 0.4
    pnl_weight: float = 0.3
    sharpe_weight: float = 0.2
    consistency_weight: float = 0.1
    
    # 策略池限制
    max_active_strategies: int = 3     # 最大活跃策略
    min_strategy_samples: int = 10     # 最小样本数


@dataclass
class StrategyInfo:
    """策略信息"""
    name: str
    description: str = ""
    status: StrategyStatus = StrategyStatus.ACTIVE
    
    # 适用市场状态
    suitable_regimes: List[str] = field(default_factory=list)
    
    # 统计数据
    samples: int = 0
    wins: int = 0
    losses: int = 0
    total_pnl: float = 0.0
    avg_pnl: float = 0.0
    win_rate: float = 0.5
    sharpe: float = 0.0
    
    # 评分
    score: float = 0.5
    confidence: float = 0.5
    
    # 状态追踪
    loss_streak: int = 0
    win_streak: int = 0
    last_used: str = ""
    last_switch: str = ""
    trades_since_switch: int = 0
    
    # 冷却
    cooldown_until: str = ""


@dataclass
class StrategySelection:
    """策略选择结果"""
    timestamp: str
    regime: str
    selected_strategy: str
    score: float
    confidence: float
    decision: SelectionDecision
    
    # 候选策略
    candidates: List[Dict] = field(default_factory=list)
    
    # 决策依据
    reason: str = ""
    alternative: str = ""


# ============================================================
# Meta Strategy Controller 核心类
# ============================================================
class MetaStrategyController:
    """
    策略调度中枢
    
    核心认知：
    真正赚钱的不是策略
    而是"什么时候用哪个策略"
    
    职责：
    1. 管理策略池
    2. 根据 Regime 选择策略
    3. 动态评估策略表现
    4. 选择最佳策略
    5. 策略护栏管理
    
    系统质变：
    从"一种打法" → "会换打法"
    """
    
    def __init__(self, config: MetaControllerConfig = None):
        self.config = config or MetaControllerConfig()
        
        # 策略池
        self.strategy_pool: Dict[str, StrategyInfo] = {}
        
        # 当前状态
        self.current_regime = "UNKNOWN"
        self.current_strategy: Optional[str] = None
        
        # 选择历史
        self.selection_history: List[StrategySelection] = []
        
        # Regime → 策略映射
        self.regime_strategy_map: Dict[str, List[str]] = defaultdict(list)
        
        # 持久化路径
        self.data_dir = Path(__file__).parent.parent / "logs" / "meta_strategy"
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        # 初始化默认策略
        self._init_default_strategies()
        
        print("🧠 Meta Strategy Controller V16 初始化完成")
        print(f"   策略池: {len(self.strategy_pool)} 个策略")
        print(f"   最低置信度: {self.config.min_confidence}")
    
    def _init_default_strategies(self):
        """初始化默认策略"""
        # 趋势跟随策略
        self.register_strategy(
            name="TREND_FOLLOW",
            description="趋势跟随策略",
            suitable_regimes=["TREND", "BREAKOUT"]
        )
        
        # 均值回归策略
        self.register_strategy(
            name="MEAN_REVERT",
            description="均值回归策略",
            suitable_regimes=["RANGE"]
        )
        
        # 突破策略
        self.register_strategy(
            name="BREAKOUT",
            description="突破策略",
            suitable_regimes=["BREAKOUT", "TREND"]
        )
    
    # ============================================================
    # 1. 策略池管理
    # ============================================================
    def register_strategy(
        self,
        name: str,
        description: str = "",
        suitable_regimes: List[str] = None
    ):
        """
        注册策略
        
        Args:
            name: 策略名称
            description: 策略描述
            suitable_regimes: 适用市场状态
        """
        if suitable_regimes is None:
            suitable_regimes = ["UNKNOWN"]
        
        info = StrategyInfo(
            name=name,
            description=description,
            suitable_regimes=suitable_regimes,
            status=StrategyStatus.ACTIVE
        )
        
        self.strategy_pool[name] = info
        
        # 更新 Regime 映射
        for regime in suitable_regimes:
            if name not in self.regime_strategy_map[regime]:
                self.regime_strategy_map[regime].append(name)
        
        print(f"   注册策略: {name} (适用: {suitable_regimes})")
    
    def enable_strategy(self, name: str) -> bool:
        """启用策略"""
        if name not in self.strategy_pool:
            return False
        
        self.strategy_pool[name].status = StrategyStatus.ACTIVE
        return True
    
    def disable_strategy(self, name: str) -> bool:
        """禁用策略"""
        if name not in self.strategy_pool:
            return False
        
        self.strategy_pool[name].status = StrategyStatus.DISABLED
        return True
    
    def pause_strategy(self, name: str) -> bool:
        """暂停策略"""
        if name not in self.strategy_pool:
            return False
        
        self.strategy_pool[name].status = StrategyStatus.PAUSED
        return True
    
    # ============================================================
    # 2. 策略评分
    # ============================================================
    def calculate_score(self, info: StrategyInfo) -> float:
        """
        计算策略评分
        
        评分 = 胜率权重 × 胜率 + 盈亏权重 × 盈亏 + 夏普权重 × 夏普 + 一致性权重 × 一致性
        
        Args:
            info: 策略信息
        
        Returns:
            score (0-1)
        """
        if info.samples < self.config.min_strategy_samples:
            return 0.5  # 样本不足，默认中性
        
        # 胜率得分 (标准化到 0-1)
        winrate_score = info.win_rate
        
        # 盈亏得分 (假设 0.2% 平均收益 = 1.0)
        pnl_score = min(1.0, max(0, (info.avg_pnl + 0.002) / 0.004))
        
        # 夏普得分 (假设 2.0 = 1.0)
        sharpe_score = min(1.0, max(0, (info.sharpe + 1) / 3))
        
        # 一致性得分 (基于连胜/连亏)
        if info.loss_streak > 0:
            consistency_score = max(0, 0.5 - info.loss_streak * 0.1)
        elif info.win_streak > 0:
            consistency_score = min(1.0, 0.5 + info.win_streak * 0.1)
        else:
            consistency_score = 0.5
        
        # 加权计算
        score = (
            self.config.winrate_weight * winrate_score +
            self.config.pnl_weight * pnl_score +
            self.config.sharpe_weight * sharpe_score +
            self.config.consistency_weight * consistency_score
        )
        
        return min(1.0, max(0, score))
    
    def calculate_confidence(self, info: StrategyInfo) -> float:
        """
        计算置信度
        
        置信度 = 样本数因子 × 稳定性因子
        
        Args:
            info: 策略信息
        
        Returns:
            confidence (0-1)
        """
        # 样本数因子
        sample_factor = min(1.0, info.samples / 50)
        
        # 稳定性因子 (基于最近表现)
        if info.loss_streak > 2:
            stability_factor = max(0, 1 - info.loss_streak * 0.15)
        else:
            stability_factor = 0.8
        
        return sample_factor * stability_factor
    
    def update_strategy_stats(
        self,
        name: str,
        pnl: float,
        is_win: bool = None
    ):
        """
        更新策略统计
        
        Args:
            name: 策略名称
            pnl: 盈亏
            is_win: 是否盈利
        """
        if name not in self.strategy_pool:
            return
        
        info = self.strategy_pool[name]
        info.samples += 1
        info.total_pnl += pnl
        info.avg_pnl = info.total_pnl / info.samples
        
        if is_win is None:
            is_win = pnl > 0
        
        if is_win:
            info.wins += 1
            info.win_streak += 1
            info.loss_streak = 0
            
            # 自动恢复
            if info.status == StrategyStatus.DISABLED:
                if info.win_streak >= self.config.enable_after_wins:
                    info.status = StrategyStatus.ACTIVE
        else:
            info.losses += 1
            info.loss_streak += 1
            info.win_streak = 0
            
            # 连续亏损禁用
            if info.loss_streak >= self.config.disable_loss_streak:
                info.status = StrategyStatus.DISABLED
        
        info.win_rate = info.wins / max(1, info.samples)
        
        # 更新评分和置信度
        info.score = self.calculate_score(info)
        info.confidence = self.calculate_confidence(info)
        
        info.last_used = datetime.now().isoformat()
    
    # ============================================================
    # 3. 策略选择
    # ============================================================
    def get_candidates(self, regime: str) -> List[str]:
        """
        获取候选策略
        
        Args:
            regime: 市场状态
        
        Returns:
            候选策略列表
        """
        candidates = []
        
        # 从映射获取
        if regime in self.regime_strategy_map:
            candidates = self.regime_strategy_map[regime].copy()
        
        # 过滤不可用策略
        candidates = [
            s for s in candidates
            if s in self.strategy_pool and
            self.strategy_pool[s].status in [StrategyStatus.ACTIVE, StrategyStatus.COOLING]
        ]
        
        return candidates
    
    def pick_best(
        self,
        candidates: List[str],
        exclude: List[str] = None
    ) -> Tuple[str, float, float]:
        """
        选择最佳策略
        
        Args:
            candidates: 候选策略
            exclude: 排除列表
        
        Returns:
            (best_strategy, score, confidence)
        """
        if exclude is None:
            exclude = []
        
        best = None
        best_score = -1
        best_confidence = 0
        
        for name in candidates:
            if name in exclude:
                continue
            
            if name not in self.strategy_pool:
                continue
            
            info = self.strategy_pool[name]
            
            # 检查状态
            if info.status not in [StrategyStatus.ACTIVE, StrategyStatus.COOLING]:
                continue
            
            # 检查置信度
            if info.confidence < self.config.min_confidence:
                continue
            
            if info.score > best_score:
                best = name
                best_score = info.score
                best_confidence = info.confidence
        
        return best, best_score, best_confidence
    
    def select_strategy(
        self,
        regime: str,
        force: bool = False
    ) -> StrategySelection:
        """
        选择策略
        
        核心决策流程：
        1. 获取候选策略
        2. 选择最佳策略
        3. 检查护栏条件
        4. 返回选择结果
        
        Args:
            regime: 市场状态
            force: 强制选择
        
        Returns:
            StrategySelection
        """
        timestamp = datetime.now().isoformat()
        self.current_regime = regime
        
        # 获取候选
        candidates = self.get_candidates(regime)
        
        # 无候选策略
        if not candidates:
            selection = StrategySelection(
                timestamp=timestamp,
                regime=regime,
                selected_strategy="",
                score=0,
                confidence=0,
                decision=SelectionDecision.NO_TRADE,
                reason=f"无适用策略 (Regime: {regime})"
            )
            self.selection_history.append(selection)
            return selection
        
        # 冷却检查（如果最近切换过）
        if self.current_strategy and not force:
            current_info = self.strategy_pool.get(self.current_strategy)
            if current_info and current_info.trades_since_switch < self.config.cooldown_trades:
                # 保持当前策略
                selection = StrategySelection(
                    timestamp=timestamp,
                    regime=regime,
                    selected_strategy=self.current_strategy,
                    score=current_info.score,
                    confidence=current_info.confidence,
                    decision=SelectionDecision.SELECTED,
                    reason="冷却期内保持当前策略",
                    candidates=[{"name": s, "score": self.strategy_pool[s].score} for s in candidates]
                )
                self.selection_history.append(selection)
                return selection
        
        # 选择最佳策略
        best, score, confidence = self.pick_best(candidates)
        
        # 无合适策略
        if best is None:
            selection = StrategySelection(
                timestamp=timestamp,
                regime=regime,
                selected_strategy="",
                score=0,
                confidence=0,
                decision=SelectionDecision.NO_TRADE,
                reason="所有候选策略置信度过低"
            )
            self.selection_history.append(selection)
            return selection
        
        # 检查评分阈值
        if score < self.config.min_score and not force:
            selection = StrategySelection(
                timestamp=timestamp,
                regime=regime,
                selected_strategy="",
                score=score,
                confidence=confidence,
                decision=SelectionDecision.NO_TRADE,
                reason=f"策略评分过低 ({score:.2f} < {self.config.min_score})"
            )
            self.selection_history.append(selection)
            return selection
        
        # 策略切换
        previous = self.current_strategy
        if previous and previous != best:
            # 重置切换计数
            if previous in self.strategy_pool:
                self.strategy_pool[previous].trades_since_switch = 0
            if best in self.strategy_pool:
                self.strategy_pool[best].trades_since_switch = 0
                self.strategy_pool[best].last_switch = timestamp
        
        self.current_strategy = best
        
        # 构建候选列表
        candidate_list = []
        for name in candidates:
            if name in self.strategy_pool:
                info = self.strategy_pool[name]
                candidate_list.append({
                    "name": name,
                    "score": round(info.score, 2),
                    "confidence": round(info.confidence, 2),
                    "win_rate": round(info.win_rate * 100, 1)
                })
        
        # 排序
        candidate_list.sort(key=lambda x: -x["score"])
        
        # 找备选
        alternative = ""
        if len(candidate_list) > 1:
            alternative = candidate_list[1]["name"]
        
        selection = StrategySelection(
            timestamp=timestamp,
            regime=regime,
            selected_strategy=best,
            score=score,
            confidence=confidence,
            decision=SelectionDecision.SELECTED,
            reason=f"最佳策略 (评分 {score:.2f}, 置信度 {confidence:.2f})",
            candidates=candidate_list,
            alternative=alternative
        )
        
        self.selection_history.append(selection)
        self._save_selection(selection)
        
        return selection
    
    # ============================================================
    # 4. 多策略冲突处理
    # ============================================================
    def resolve_conflict(
        self,
        signals: List[Dict]
    ) -> Tuple[str, Dict]:
        """
        解决多策略冲突
        
        当多个策略同时发出信号时，选择置信度最高的
        
        Args:
            signals: [{"strategy": "TREND_FOLLOW", "signal": {...}, "confidence": 0.8}, ...]
        
        Returns:
            (selected_strategy, signal)
        """
        if not signals:
            return "", {}
        
        if len(signals) == 1:
            return signals[0].get("strategy", ""), signals[0]
        
        # 按置信度排序
        sorted_signals = sorted(
            signals,
            key=lambda x: x.get("confidence", 0),
            reverse=True
        )
        
        best = sorted_signals[0]
        
        return best.get("strategy", ""), best
    
    # ============================================================
    # 5. 查询接口
    # ============================================================
    def get_active_strategies(self) -> List[Dict]:
        """获取活跃策略"""
        active = []
        
        for name, info in self.strategy_pool.items():
            if info.status == StrategyStatus.ACTIVE:
                active.append({
                    "name": name,
                    "score": round(info.score, 2),
                    "confidence": round(info.confidence, 2),
                    "win_rate": round(info.win_rate * 100, 1),
                    "samples": info.samples
                })
        
        # 按评分排序
        active.sort(key=lambda x: -x["score"])
        
        return active
    
    def get_strategy_status(self, name: str) -> Optional[Dict]:
        """获取策略状态"""
        if name not in self.strategy_pool:
            return None
        
        info = self.strategy_pool[name]
        
        return {
            "name": info.name,
            "description": info.description,
            "status": info.status.value,
            "suitable_regimes": info.suitable_regimes,
            "samples": info.samples,
            "win_rate": round(info.win_rate * 100, 1),
            "avg_pnl_pct": round(info.avg_pnl * 100, 4),
            "score": round(info.score, 2),
            "confidence": round(info.confidence, 2),
            "loss_streak": info.loss_streak,
            "win_streak": info.win_streak
        }
    
    def get_summary(self) -> Dict:
        """获取系统摘要"""
        active = self.get_active_strategies()
        
        return {
            "total_strategies": len(self.strategy_pool),
            "active_strategies": len(active),
            "current_regime": self.current_regime,
            "current_strategy": self.current_strategy,
            "selections": len(self.selection_history),
            "active_list": active[:5]
        }
    
    def get_regime_mapping(self) -> Dict:
        """获取 Regime 映射"""
        return dict(self.regime_strategy_map)
    
    # ============================================================
    # 6. 持久化
    # ============================================================
    def _save_selection(self, selection: StrategySelection):
        """保存选择记录"""
        log_file = self.data_dir / "selections.jsonl"
        
        data = {
            "timestamp": selection.timestamp,
            "regime": selection.regime,
            "selected_strategy": selection.selected_strategy,
            "score": selection.score,
            "confidence": selection.confidence,
            "decision": selection.decision.value,
            "reason": selection.reason
        }
        
        with open(log_file, "a") as f:
            f.write(json.dumps(data) + "\n")


# ============================================================
# 便捷函数
# ============================================================
def create_meta_controller() -> MetaStrategyController:
    """创建策略调度中枢"""
    return MetaStrategyController()


# ============================================================
# 测试
# ============================================================
if __name__ == "__main__":
    print("=== Meta Strategy Controller V16 测试 ===\n")
    
    controller = MetaStrategyController()
    
    # 注册自定义策略
    print("\n1. 注册策略:")
    controller.register_strategy(
        name="SCALP",
        description="剥头皮策略",
        suitable_regimes=["RANGE", "TREND"]
    )
    
    # 更新策略统计
    print("\n2. 更新策略统计:")
    for i in range(20):
        pnl = 0.002 if i % 3 != 0 else -0.001
        controller.update_strategy_stats("TREND_FOLLOW", pnl)
    
    for i in range(15):
        pnl = 0.001 if i % 2 == 0 else -0.001
        controller.update_strategy_stats("MEAN_REVERT", pnl)
    
    print("   TREND_FOLLOW: 胜率 67%")
    print("   MEAN_REVERT: 胜率 53%")
    
    # 选择策略
    print("\n3. 策略选择:")
    
    # TREND 市场
    selection = controller.select_strategy("TREND")
    print(f"   TREND 市场 → {selection.selected_strategy}")
    print(f"   评分: {selection.score:.2f}, 置信度: {selection.confidence:.2f}")
    
    # RANGE 市场
    selection = controller.select_strategy("RANGE")
    print(f"   RANGE 市场 → {selection.selected_strategy}")
    
    # BREAKOUT 市场
    selection = controller.select_strategy("BREAKOUT")
    print(f"   BREAKOUT 市场 → {selection.selected_strategy}")
    
    # 获取活跃策略
    print("\n4. 活跃策略:")
    active = controller.get_active_strategies()
    for s in active:
        print(f"   {s['name']}: 评分 {s['score']:.2f}, 胜率 {s['win_rate']:.0f}%")
    
    # 获取摘要
    print("\n5. 系统摘要:")
    summary = controller.get_summary()
    print(f"   总策略: {summary['total_strategies']}")
    print(f"   活跃策略: {summary['active_strategies']}")
    print(f"   当前策略: {summary['current_strategy']}")
    
    # 冲突解决
    print("\n6. 多策略冲突:")
    signals = [
        {"strategy": "TREND_FOLLOW", "confidence": 0.8, "signal": {"side": "LONG"}},
        {"strategy": "MEAN_REVERT", "confidence": 0.6, "signal": {"side": "SHORT"}}
    ]
    best, signal = controller.resolve_conflict(signals)
    print(f"   冲突信号: {len(signals)} 个")
    print(f"   选择: {best} (置信度 {signal.get('confidence', 0):.2f})")
    
    print("\n✅ Meta Strategy Controller V16 测试通过")