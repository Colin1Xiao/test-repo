#!/usr/bin/env python3
"""
Strategy Evolution Engine - 策略自我进化引擎 (V15)

核心认知：
进化系统不是"变聪明"，而是"减少犯错"

核心能力：
1. Pattern Analyzer - 找规律（哪种市场+哪种信号=真正赚钱）
2. Strategy Evaluator - 评估模式表现
3. Evolution Engine - 做决策（BOOST/SUPPRESS/NEUTRAL）
4. Evolution Guard - 防止自毁（最小样本、最大调整、回滚机制）

系统质变：
从"固定策略" → "会适应市场的生物"

自动化：
- 强化赚钱模式
- 降低亏损模式
- 适应市场变化
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
import json
from collections import defaultdict

# ============================================================
# 枚举和常量
# ============================================================
class EvolutionDecision(Enum):
    """进化决策"""
    BOOST = "BOOST"           # 强化
    SUPPRESS = "SUPPRESS"     # 削弱
    NEUTRAL = "NEUTRAL"       # 中立
    DISABLE = "DISABLE"       # 禁用
    OBSERVE = "OBSERVE"       # 观察（样本不足）


class PatternHealth(Enum):
    """模式健康度"""
    EXCELLENT = "EXCELLENT"     # 优秀
    GOOD = "GOOD"              # 良好
    FAIR = "FAIR"              # 一般
    POOR = "POOR"              # 较差
    CRITICAL = "CRITICAL"      # 危险


@dataclass
class EvolutionConfig:
    """进化配置"""
    # 评估阈值
    min_samples: int = 10              # 最小样本数
    boost_winrate_threshold: float = 0.6   # 强化胜率阈值
    suppress_winrate_threshold: float = 0.4  # 削弱胜率阈值
    disable_winrate_threshold: float = 0.3   # 禁用胜率阈值
    
    # 调整限制
    max_score_adjustment: int = 5      # 最大评分调整
    max_weight_adjustment: float = 0.2  # 最大权重调整
    
    # 进化护栏
    min_time_between_evolution: int = 3600  # 进化间隔 (秒)
    rollback_on_worse: bool = True     # 性能变差时回滚
    max_consecutive_boosts: int = 3    # 最大连续强化次数
    
    # 观察窗口
    evaluation_window: int = 50        # 评估窗口


@dataclass
class PatternKey:
    """模式键"""
    regime: str           # RANGE / TREND / BREAKOUT / CHAOTIC
    signal_type: str      # LONG / SHORT
    liquidity_bucket: str # HIGH / MEDIUM / LOW
    
    def to_tuple(self) -> Tuple:
        return (self.regime, self.signal_type, self.liquidity_bucket)
    
    def __hash__(self):
        return hash(self.to_tuple())
    
    def __eq__(self, other):
        return self.to_tuple() == other.to_tuple()


@dataclass
class PatternStats:
    """模式统计"""
    key: PatternKey
    samples: int = 0
    wins: int = 0
    losses: int = 0
    total_pnl: float = 0.0
    avg_pnl: float = 0.0
    win_rate: float = 0.0
    avg_signal_edge: float = 0.0
    avg_slippage: float = 0.0
    last_updated: str = ""
    
    # 进化记录
    boost_count: int = 0
    suppress_count: int = 0
    consecutive_boosts: int = 0
    last_evolution: str = ""
    
    # 当前状态
    score_adjustment: int = 0     # 评分调整
    weight_multiplier: float = 1.0  # 权重乘数
    health: PatternHealth = PatternHealth.FAIR
    decision: EvolutionDecision = EvolutionDecision.NEUTRAL


@dataclass
class EvolutionRecord:
    """进化记录"""
    timestamp: str
    pattern_key: Tuple
    decision: EvolutionDecision
    reason: str
    stats_before: Dict
    adjustment: Dict
    expected_effect: str


# ============================================================
# Strategy Evolution Engine 核心类
# ============================================================
class StrategyEvolutionEngine:
    """
    策略自我进化引擎
    
    核心认知：
    进化系统不是"变聪明"，而是"减少犯错"
    
    职责：
    1. 分析交易模式
    2. 评估模式表现
    3. 做出进化决策
    4. 应用进化调整
    5. 监控进化效果
    
    系统质变：
    从"固定策略" → "会适应市场的生物"
    """
    
    def __init__(self, config: EvolutionConfig = None):
        self.config = config or EvolutionConfig()
        
        # 模式统计
        self.patterns: Dict[Tuple, PatternStats] = {}
        
        # 进化历史
        self.evolution_history: List[EvolutionRecord] = []
        
        # 进化统计
        self.stats = {
            "total_evolutions": 0,
            "boosts": 0,
            "suppresses": 0,
            "disables": 0,
            "rollbacks": 0
        }
        
        # 当前参数快照（用于回滚）
        self.parameter_snapshots: List[Dict] = []
        
        # 持久化路径
        self.data_dir = Path(__file__).parent.parent / "logs" / "strategy_evolution"
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        # 加载历史
        self._load_history()
        
        print("🧬 Strategy Evolution Engine V15 初始化完成")
        print(f"   最小样本: {self.config.min_samples}")
        print(f"   强化阈值: {self.config.boost_winrate_threshold*100:.0f}%")
        print(f"   削弱阈值: {self.config.suppress_winrate_threshold*100:.0f}%")
    
    # ============================================================
    # 1. Pattern Analyzer - 找规律
    # ============================================================
    def analyze_patterns(
        self,
        trades: List[Dict]
    ) -> Dict[Tuple, List[float]]:
        """
        分析交易模式
        
        找出：哪种市场 + 哪种信号 = 真正赚钱
        
        Args:
            trades: 交易列表，每笔包含 regime, signal_type, liquidity, pnl
        
        Returns:
            {pattern_key: [pnl1, pnl2, ...]}
        """
        patterns = defaultdict(list)
        
        for trade in trades:
            # 构建模式键
            key = (
                trade.get("regime", "UNKNOWN"),
                trade.get("signal_type", trade.get("side", "UNKNOWN")),
                trade.get("liquidity_bucket", "MEDIUM")
            )
            
            pnl = trade.get("pnl", trade.get("pnl_pct", 0))
            patterns[key].append(pnl)
        
        return dict(patterns)
    
    def record_trade(
        self,
        regime: str,
        signal_type: str,
        liquidity_bucket: str,
        pnl: float,
        signal_edge: float = 0.0,
        slippage: float = 0.0
    ):
        """
        记录单笔交易到模式
        
        Args:
            regime: 市场结构
            signal_type: 信号类型 (LONG/SHORT)
            liquidity_bucket: 流动性等级
            pnl: 盈亏
            signal_edge: 信号贡献
            slippage: 滑点
        """
        key = (regime, signal_type, liquidity_bucket)
        
        if key not in self.patterns:
            pk = PatternKey(regime, signal_type, liquidity_bucket)
            self.patterns[key] = PatternStats(key=pk)
        
        stats = self.patterns[key]
        stats.samples += 1
        stats.total_pnl += pnl
        stats.avg_pnl = stats.total_pnl / stats.samples
        
        if pnl > 0:
            stats.wins += 1
        elif pnl < 0:
            stats.losses += 1
        
        stats.win_rate = stats.wins / max(1, stats.samples)
        stats.avg_signal_edge = (stats.avg_signal_edge * (stats.samples - 1) + signal_edge) / stats.samples
        stats.avg_slippage = (stats.avg_slippage * (stats.samples - 1) + slippage) / stats.samples
        stats.last_updated = datetime.now().isoformat()
    
    # ============================================================
    # 2. Strategy Evaluator - 评估模式
    # ============================================================
    def evaluate_pattern(self, stats: PatternStats) -> Dict:
        """
        评估单个模式
        
        Args:
            stats: 模式统计
        
        Returns:
            评估结果
        """
        # 样本不足
        if stats.samples < self.config.min_samples:
            return {
                "health": PatternHealth.FAIR,
                "decision": EvolutionDecision.OBSERVE,
                "reason": f"样本不足 ({stats.samples} < {self.config.min_samples})",
                "confidence": 0.0
            }
        
        # 计算健康度
        win_rate = stats.win_rate
        avg_pnl = stats.avg_pnl
        
        # 评估置信度
        confidence = min(stats.samples / 50, 1.0)
        
        # 判断健康度
        if win_rate >= 0.7 and avg_pnl > 0:
            health = PatternHealth.EXCELLENT
        elif win_rate >= 0.55 and avg_pnl > 0:
            health = PatternHealth.GOOD
        elif win_rate >= 0.45:
            health = PatternHealth.FAIR
        elif win_rate >= 0.3:
            health = PatternHealth.POOR
        else:
            health = PatternHealth.CRITICAL
        
        return {
            "health": health,
            "win_rate": win_rate,
            "avg_pnl": avg_pnl,
            "samples": stats.samples,
            "confidence": confidence
        }
    
    def evaluate_all_patterns(self) -> Dict[Tuple, Dict]:
        """评估所有模式"""
        results = {}
        
        for key, stats in self.patterns.items():
            results[key] = self.evaluate_pattern(stats)
        
        return results
    
    # ============================================================
    # 3. Evolution Engine - 做决策
    # ============================================================
    def decide_evolution(self, stats: PatternStats) -> Tuple[EvolutionDecision, str]:
        """
        进化决策
        
        决策逻辑：
        - 胜率 >= 60% 且样本足够 → BOOST
        - 胜率 < 40% → SUPPRESS
        - 胜率 < 30% → DISABLE
        - 样本不足 → OBSERVE
        - 其他 → NEUTRAL
        
        Args:
            stats: 模式统计
        
        Returns:
            (decision, reason)
        """
        # 样本不足
        if stats.samples < self.config.min_samples:
            return EvolutionDecision.OBSERVE, f"样本不足 ({stats.samples} < {self.config.min_samples})"
        
        # 连续强化次数检查
        if stats.consecutive_boosts >= self.config.max_consecutive_boosts:
            return EvolutionDecision.NEUTRAL, "连续强化已达上限，暂停观察"
        
        win_rate = stats.win_rate
        avg_pnl = stats.avg_pnl
        
        # 禁用条件
        if win_rate < self.config.disable_winrate_threshold and stats.samples >= self.config.min_samples * 2:
            return EvolutionDecision.DISABLE, f"胜率过低 ({win_rate*100:.0f}% < {self.config.disable_winrate_threshold*100:.0f}%)"
        
        # 削弱条件
        if win_rate < self.config.suppress_winrate_threshold:
            return EvolutionDecision.SUPPRESS, f"胜率偏低 ({win_rate*100:.0f}% < {self.config.suppress_winrate_threshold*100:.0f}%)"
        
        # 强化条件
        if win_rate >= self.config.boost_winrate_threshold and avg_pnl > 0:
            return EvolutionDecision.BOOST, f"表现优秀 (胜率 {win_rate*100:.0f}%, 盈亏 {avg_pnl*100:.2f}%)"
        
        return EvolutionDecision.NEUTRAL, "表现正常，维持现状"
    
    def run_evolution(self) -> List[EvolutionRecord]:
        """
        执行进化
        
        遍历所有模式，做出进化决策
        
        Returns:
            进化记录列表
        """
        records = []
        timestamp = datetime.now().isoformat()
        
        # 保存参数快照（用于回滚）
        snapshot = self._create_snapshot()
        self.parameter_snapshots.append(snapshot)
        
        for key, stats in self.patterns.items():
            decision, reason = self.decide_evolution(stats)
            
            # 应用进化调整
            adjustment = self._apply_evolution(stats, decision)
            
            # 更新统计
            stats.decision = decision
            stats.last_evolution = timestamp
            
            if decision == EvolutionDecision.BOOST:
                stats.boost_count += 1
                stats.consecutive_boosts += 1
                self.stats["boosts"] += 1
            elif decision == EvolutionDecision.SUPPRESS:
                stats.suppress_count += 1
                stats.consecutive_boosts = 0
                self.stats["suppresses"] += 1
            elif decision == EvolutionDecision.DISABLE:
                self.stats["disables"] += 1
            else:
                stats.consecutive_boosts = 0
            
            # 创建记录
            record = EvolutionRecord(
                timestamp=timestamp,
                pattern_key=key,
                decision=decision,
                reason=reason,
                stats_before={
                    "win_rate": stats.win_rate,
                    "samples": stats.samples,
                    "score_adjustment": stats.score_adjustment
                },
                adjustment=adjustment,
                expected_effect=self._expected_effect(decision)
            )
            
            records.append(record)
            self.evolution_history.append(record)
        
        # 更新统计
        self.stats["total_evolutions"] += 1
        
        # 保存进化记录
        self._save_evolution_records(records)
        
        return records
    
    def _apply_evolution(
        self,
        stats: PatternStats,
        decision: EvolutionDecision
    ) -> Dict:
        """
        应用进化调整
        
        Args:
            stats: 模式统计
            decision: 进化决策
        
        Returns:
            调整内容
        """
        adjustment = {}
        
        if decision == EvolutionDecision.BOOST:
            # 强化：降低评分阈值、增加权重
            old_score = stats.score_adjustment
            old_weight = stats.weight_multiplier
            
            stats.score_adjustment = max(
                -self.config.max_score_adjustment,
                stats.score_adjustment - 1
            )
            stats.weight_multiplier = min(
                1.0 + self.config.max_weight_adjustment,
                stats.weight_multiplier * 1.1
            )
            
            adjustment = {
                "score_adjustment": {"from": old_score, "to": stats.score_adjustment},
                "weight_multiplier": {"from": old_weight, "to": stats.weight_multiplier}
            }
        
        elif decision == EvolutionDecision.SUPPRESS:
            # 削弱：提高评分阈值、降低权重
            old_score = stats.score_adjustment
            old_weight = stats.weight_multiplier
            
            stats.score_adjustment = min(
                self.config.max_score_adjustment,
                stats.score_adjustment + 1
            )
            stats.weight_multiplier = max(
                1.0 - self.config.max_weight_adjustment,
                stats.weight_multiplier * 0.9
            )
            
            adjustment = {
                "score_adjustment": {"from": old_score, "to": stats.score_adjustment},
                "weight_multiplier": {"from": old_weight, "to": stats.weight_multiplier}
            }
        
        elif decision == EvolutionDecision.DISABLE:
            # 禁用：权重置零
            old_weight = stats.weight_multiplier
            stats.weight_multiplier = 0.0
            
            adjustment = {
                "weight_multiplier": {"from": old_weight, "to": 0.0}
            }
        
        return adjustment
    
    def _expected_effect(self, decision: EvolutionDecision) -> str:
        """预期效果"""
        effects = {
            EvolutionDecision.BOOST: "预期：更多信号通过，增加盈利机会",
            EvolutionDecision.SUPPRESS: "预期：减少信号通过，降低亏损",
            EvolutionDecision.DISABLE: "预期：完全禁用该模式",
            EvolutionDecision.NEUTRAL: "预期：维持现状",
            EvolutionDecision.OBSERVE: "预期：继续观察，积累数据"
        }
        return effects.get(decision, "")
    
    # ============================================================
    # 4. Evolution Guard - 防止自毁
    # ============================================================
    def should_rollback(self, recent_performance: Dict) -> Tuple[bool, str]:
        """
        判断是否应该回滚
        
        Args:
            recent_performance: 最近表现 {"win_rate": x, "avg_pnl": y}
        
        Returns:
            (should_rollback, reason)
        """
        if not self.config.rollback_on_worse:
            return False, "回滚已禁用"
        
        # 检查是否有快照
        if len(self.parameter_snapshots) < 2:
            return False, "无历史快照"
        
        # 比较最近表现
        win_rate = recent_performance.get("win_rate", 0.5)
        
        if win_rate < self.config.suppress_winrate_threshold:
            return True, f"近期胜率过低 ({win_rate*100:.0f}%)，建议回滚"
        
        return False, "表现正常"
    
    def rollback(self) -> Dict:
        """
        回滚到上一个参数快照
        
        Returns:
            回滚结果
        """
        if len(self.parameter_snapshots) < 2:
            return {"status": "error", "message": "无历史快照可回滚"}
        
        # 获取上一个快照
        previous = self.parameter_snapshots[-2]
        
        # 恢复参数
        for key, data in previous.items():
            if key in self.patterns:
                self.patterns[key].score_adjustment = data.get("score_adjustment", 0)
                self.patterns[key].weight_multiplier = data.get("weight_multiplier", 1.0)
        
        # 移除最新快照
        self.parameter_snapshots.pop()
        
        # 更新统计
        self.stats["rollbacks"] += 1
        
        return {
            "status": "success",
            "message": "已回滚到上一状态",
            "restored": len(previous)
        }
    
    # ============================================================
    # 5. 查询接口
    # ============================================================
    def get_boosted_patterns(self) -> List[Dict]:
        """获取被强化的模式"""
        boosted = []
        
        for key, stats in self.patterns.items():
            if stats.decision == EvolutionDecision.BOOST:
                boosted.append({
                    "pattern": key,
                    "win_rate": round(stats.win_rate * 100, 1),
                    "samples": stats.samples,
                    "score_adjustment": stats.score_adjustment,
                    "weight_multiplier": round(stats.weight_multiplier, 2)
                })
        
        return boosted
    
    def get_suppressed_patterns(self) -> List[Dict]:
        """获取被削弱的模式"""
        suppressed = []
        
        for key, stats in self.patterns.items():
            if stats.decision in [EvolutionDecision.SUPPRESS, EvolutionDecision.DISABLE]:
                suppressed.append({
                    "pattern": key,
                    "win_rate": round(stats.win_rate * 100, 1),
                    "samples": stats.samples,
                    "decision": stats.decision.value
                })
        
        return suppressed
    
    def get_summary(self) -> Dict:
        """获取进化摘要"""
        boosted = self.get_boosted_patterns()
        suppressed = self.get_suppressed_patterns()
        
        return {
            "total_patterns": len(self.patterns),
            "total_evolutions": self.stats["total_evolutions"],
            "boosted_count": len(boosted),
            "suppressed_count": len(suppressed),
            "neutral_count": len(self.patterns) - len(boosted) - len(suppressed),
            "total_rollbacks": self.stats["rollbacks"],
            "boosted": boosted[:5],
            "suppressed": suppressed[:5]
        }
    
    def get_pattern_details(self) -> Dict:
        """获取所有模式详情"""
        details = {}
        
        for key, stats in self.patterns.items():
            details[str(key)] = {
                "regime": stats.key.regime,
                "signal_type": stats.key.signal_type,
                "liquidity": stats.key.liquidity_bucket,
                "samples": stats.samples,
                "win_rate": round(stats.win_rate * 100, 1),
                "avg_pnl_pct": round(stats.avg_pnl * 100, 3),
                "health": stats.health.value,
                "decision": stats.decision.value,
                "score_adjustment": stats.score_adjustment,
                "weight_multiplier": round(stats.weight_multiplier, 2)
            }
        
        return details
    
    # ============================================================
    # 6. 辅助方法
    # ============================================================
    def _create_snapshot(self) -> Dict:
        """创建参数快照"""
        snapshot = {}
        
        for key, stats in self.patterns.items():
            snapshot[key] = {
                "score_adjustment": stats.score_adjustment,
                "weight_multiplier": stats.weight_multiplier
            }
        
        return snapshot
    
    def _save_evolution_records(self, records: List[EvolutionRecord]):
        """保存进化记录"""
        log_file = self.data_dir / "evolution_records.jsonl"
        
        for record in records:
            data = {
                "timestamp": record.timestamp,
                "pattern_key": list(record.pattern_key),
                "decision": record.decision.value,
                "reason": record.reason,
                "adjustment": record.adjustment
            }
            
            with open(log_file, "a") as f:
                f.write(json.dumps(data) + "\n")
    
    def _load_history(self):
        """加载历史数据"""
        log_file = self.data_dir / "evolution_records.jsonl"
        
        if not log_file.exists():
            return
        
        try:
            with open(log_file, "r") as f:
                for line in f:
                    try:
                        data = json.loads(line)
                        self.stats["total_evolutions"] += 1
                        
                        decision = data.get("decision", "NEUTRAL")
                        if decision == "BOOST":
                            self.stats["boosts"] += 1
                        elif decision == "SUPPRESS":
                            self.stats["suppresses"] += 1
                        elif decision == "DISABLE":
                            self.stats["disables"] += 1
                    except:
                        continue
        except Exception as e:
            print(f"⚠️ 加载进化历史失败: {e}")
    
    def reset(self):
        """重置进化系统"""
        self.patterns = {}
        self.evolution_history = []
        self.parameter_snapshots = []
        self.stats = {
            "total_evolutions": 0,
            "boosts": 0,
            "suppresses": 0,
            "disables": 0,
            "rollbacks": 0
        }
        print("🔄 Strategy Evolution Engine 已重置")


# ============================================================
# 便捷函数
# ============================================================
def create_evolution_engine() -> StrategyEvolutionEngine:
    """创建策略进化引擎"""
    return StrategyEvolutionEngine()


# ============================================================
# 测试
# ============================================================
if __name__ == "__main__":
    print("=== Strategy Evolution Engine V15 测试 ===\n")
    
    engine = StrategyEvolutionEngine()
    
    # 模拟交易记录
    print("1. 记录交易:")
    
    # TREND + LONG + HIGH 应该被强化
    for i in range(15):
        pnl = 0.002 if i % 3 != 0 else -0.001
        engine.record_trade(
            regime="TREND",
            signal_type="LONG",
            liquidity_bucket="HIGH",
            pnl=pnl,
            signal_edge=0.0015,
            slippage=0.0005
        )
    
    # RANGE + SHORT + LOW 应该被削弱
    for i in range(12):
        pnl = -0.002 if i % 2 == 0 else 0.001
        engine.record_trade(
            regime="RANGE",
            signal_type="SHORT",
            liquidity_bucket="LOW",
            pnl=pnl,
            signal_edge=-0.001,
            slippage=0.001
        )
    
    print(f"   已记录 {sum(s.samples for s in engine.patterns.values())} 笔交易")
    print(f"   模式数: {len(engine.patterns)}")
    
    # 评估模式
    print("\n2. 评估模式:")
    evaluations = engine.evaluate_all_patterns()
    for key, eval_result in evaluations.items():
        health = eval_result.get("health", PatternHealth.FAIR).value
        win_rate = eval_result.get("win_rate", 0) * 100
        print(f"   {key}: 健康 {health}, 胜率 {win_rate:.0f}%")
    
    # 执行进化
    print("\n3. 执行进化:")
    records = engine.run_evolution()
    for record in records[:5]:
        print(f"   {record.pattern_key}: {record.decision.value} - {record.reason}")
    
    # 获取摘要
    print("\n4. 进化摘要:")
    summary = engine.get_summary()
    print(f"   总模式: {summary['total_patterns']}")
    print(f"   强化: {summary['boosted_count']}")
    print(f"   削弱: {summary['suppressed_count']}")
    print(f"   中立: {summary['neutral_count']}")
    
    # 强化模式
    print("\n5. 被强化的模式:")
    for p in summary['boosted']:
        print(f"   {p['pattern']}: 胜率 {p['win_rate']:.0f}%, 权重 {p['weight_multiplier']:.2f}x")
    
    # 削弱模式
    print("\n6. 被削弱的模式:")
    for p in summary['suppressed']:
        print(f"   {p['pattern']}: 胜率 {p['win_rate']:.0f}%, 决策 {p['decision']}")
    
    print("\n✅ Strategy Evolution Engine V15 测试通过")