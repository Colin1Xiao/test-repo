#!/usr/bin/env python3
"""
Strategy Generator - 策略生成器 (V19)

核心认知：
真正强的系统不是"有好策略"
而是"能不断产生好策略"

核心能力：
1. 组件组合 - 从已有组件组合新策略
2. 参数搜索 - 智能参数探索
3. 策略编码 - 可序列化的策略表示
4. 批量生成 - 生成候选策略池

系统质变：
从"人设计策略" → "系统自动生成策略"
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime
from enum import Enum
from pathlib import Path
import json
import random
from itertools import product

# ============================================================
# 枚举和常量
# ============================================================
class EntryType(Enum):
    """入场类型"""
    BREAKOUT = "BREAKOUT"       # 突破
    PULLBACK = "PULLBACK"       # 回调
    MOMENTUM = "MOMENTUM"       # 动量
    REVERSAL = "REVERSAL"       # 反转
    SCALP = "SCALP"             # 剥头皮


class ExitType(Enum):
    """出场类型"""
    FIXED_TP = "FIXED_TP"       # 固定止盈
    TRAILING = "TRAILING"       # 移动止损
    TIME_BASED = "TIME_BASED"   # 时间出场
    SIGNAL_BASED = "SIGNAL"     # 信号出场


class FilterType(Enum):
    """过滤类型"""
    LIQUIDITY = "LIQUIDITY"     # 流动性过滤
    FLOW = "FLOW"               # 资金流过滤
    REGIME = "REGIME"           # 市场结构过滤
    VOLATILITY = "VOLATILITY"   # 波动率过滤
    TREND = "TREND"             # 趋势过滤


class StrategyStatus(Enum):
    """策略状态"""
    GENERATED = "GENERATED"     # 已生成
    BACKTESTING = "BACKTESTING" # 回测中
    PAPER = "PAPER"             # 模拟测试
    SHADOW = "SHADOW"           # 影子验证
    ACTIVE = "ACTIVE"           # 活跃
    DISABLED = "DISABLED"       # 禁用
    REJECTED = "REJECTED"       # 拒绝


@dataclass
class StrategyConfig:
    """策略配置"""
    # 身份
    strategy_id: str
    generation: int = 1
    parent_id: str = ""
    
    # 适用环境
    regime: str = "TREND"           # TREND / RANGE / BREAKOUT
    
    # 入场
    entry_type: EntryType = EntryType.BREAKOUT
    entry_params: Dict = field(default_factory=dict)
    
    # 出场
    exit_type: ExitType = ExitType.FIXED_TP
    exit_params: Dict = field(default_factory=dict)
    
    # 过滤器
    filters: List[FilterType] = field(default_factory=list)
    filter_params: Dict = field(default_factory=dict)
    
    # 评分
    score: float = 0.0
    sharpe: float = 0.0
    win_rate: float = 0.0
    max_drawdown: float = 0.0
    total_pnl: float = 0.0
    
    # 状态
    status: StrategyStatus = StrategyStatus.GENERATED
    
    # 验证数据
    backtest_samples: int = 0
    paper_trades: int = 0
    shadow_trades: int = 0
    live_trades: int = 0
    
    # 时间戳
    created_at: str = ""
    updated_at: str = ""


@dataclass
class GeneratorConfig:
    """生成器配置"""
    # 生成参数
    batch_size: int = 50            # 批量生成数
    max_strategies: int = 100       # 最大策略数
    
    # 参数范围
    tp_range: Tuple[float, float] = (0.001, 0.005)   # 止盈范围
    sl_range: Tuple[float, float] = (0.002, 0.01)    # 止损范围
    holding_range: Tuple[int, int] = (1, 60)         # 持仓时间（分钟）
    
    # 突变参数
    mutation_rate: float = 0.1      # 突变率
    crossover_rate: float = 0.3     # 交叉率
    
    # 评估阈值
    min_sharpe: float = 1.0         # 最小夏普
    max_drawdown: float = 0.1       # 最大回撤
    min_win_rate: float = 0.45      # 最小胜率


# ============================================================
# Strategy Generator 核心类
# ============================================================
class StrategyGenerator:
    """
    策略生成器
    
    核心认知：
    不是写策略，是"组合策略空间"
    
    职责：
    1. 从组件组合新策略
    2. 智能参数搜索
    3. 批量生成候选
    4. 进化变异
    
    系统质变：
    从"人设计策略" → "系统自动生成策略"
    """
    
    def __init__(self, config: GeneratorConfig = None):
        self.config = config or GeneratorConfig()
        
        # 策略池
        self.strategies: Dict[str, StrategyConfig] = {}
        
        # 组件库
        self.regimes = ["TREND", "RANGE", "BREAKOUT", "CHAOTIC"]
        self.entry_types = list(EntryType)
        self.exit_types = list(ExitType)
        self.filter_types = list(FilterType)
        
        # 统计
        self.stats = {
            "total_generated": 0,
            "total_rejected": 0,
            "total_accepted": 0,
            "generations": 0
        }
        
        # 持久化路径
        self.data_dir = Path(__file__).parent.parent / "logs" / "strategy_generator"
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        # 加载历史
        self._load_strategies()
        
        print("🧬 Strategy Generator V19 初始化完成")
        print(f"   批量大小: {self.config.batch_size}")
        print(f"   最大策略: {self.config.max_strategies}")
    
    # ============================================================
    # 1. 策略生成
    # ============================================================
    def generate_single(self, generation: int = 1) -> StrategyConfig:
        """
        生成单个策略
        
        从组件库随机组合
        
        Args:
            generation: 代数
        
        Returns:
            StrategyConfig
        """
        strategy_id = f"STRAT-{self.stats['total_generated']:06d}"
        
        # 随机选择组件
        regime = random.choice(self.regimes)
        entry_type = random.choice(self.entry_types)
        exit_type = random.choice(self.exit_types)
        
        # 随机选择过滤器（1-3个）
        num_filters = random.randint(1, 3)
        filters = random.sample(self.filter_types, num_filters)
        
        # 生成入场参数
        entry_params = self._generate_entry_params(entry_type)
        
        # 生成出场参数
        exit_params = self._generate_exit_params(exit_type)
        
        # 生成过滤参数
        filter_params = self._generate_filter_params(filters)
        
        now = datetime.now().isoformat()
        
        strategy = StrategyConfig(
            strategy_id=strategy_id,
            generation=generation,
            regime=regime,
            entry_type=entry_type,
            entry_params=entry_params,
            exit_type=exit_type,
            exit_params=exit_params,
            filters=filters,
            filter_params=filter_params,
            created_at=now,
            updated_at=now
        )
        
        self.stats["total_generated"] += 1
        
        return strategy
    
    def generate_batch(self, n: int = None) -> List[StrategyConfig]:
        """
        批量生成策略
        
        Args:
            n: 生成数量
        
        Returns:
            策略列表
        """
        if n is None:
            n = self.config.batch_size
        
        generation = self.stats["generations"] + 1
        
        strategies = []
        for _ in range(n):
            strategy = self.generate_single(generation)
            strategies.append(strategy)
        
        self.stats["generations"] += 1
        
        print(f"   生成 {len(strategies)} 个策略 (代数: {generation})")
        
        return strategies
    
    def _generate_entry_params(self, entry_type: EntryType) -> Dict:
        """生成入场参数"""
        if entry_type == EntryType.BREAKOUT:
            return {
                "lookback": random.randint(10, 50),
                "threshold": random.uniform(0.001, 0.005)
            }
        elif entry_type == EntryType.PULLBACK:
            return {
                "pullback_pct": random.uniform(0.3, 0.7),
                "min_trend": random.uniform(0.005, 0.02)
            }
        elif entry_type == EntryType.MOMENTUM:
            return {
                "rsi_period": random.randint(10, 20),
                "rsi_threshold": random.uniform(60, 80)
            }
        elif entry_type == EntryType.REVERSAL:
            return {
                "divergence_window": random.randint(5, 20),
                "min_divergence": random.uniform(0.001, 0.005)
            }
        else:  # SCALP
            return {
                "spread_threshold": random.uniform(0.0001, 0.001),
                "volume_min": random.uniform(100, 500)
            }
    
    def _generate_exit_params(self, exit_type: ExitType) -> Dict:
        """生成出场参数"""
        tp = random.uniform(*self.config.tp_range)
        sl = random.uniform(*self.config.sl_range)
        
        if exit_type == ExitType.FIXED_TP:
            return {
                "take_profit": tp,
                "stop_loss": sl
            }
        elif exit_type == ExitType.TRAILING:
            return {
                "initial_sl": sl,
                "trail_pct": random.uniform(0.3, 0.7),
                "activate_at": random.uniform(0.5 * tp, tp)
            }
        elif exit_type == ExitType.TIME_BASED:
            return {
                "max_holding": random.randint(*self.config.holding_range),
                "stop_loss": sl
            }
        else:  # SIGNAL_BASED
            return {
                "stop_loss": sl,
                "signal_window": random.randint(3, 10)
            }
    
    def _generate_filter_params(self, filters: List[FilterType]) -> Dict:
        """生成过滤参数"""
        params = {}
        
        for f in filters:
            if f == FilterType.LIQUIDITY:
                params["min_depth"] = random.uniform(5, 20)
            elif f == FilterType.FLOW:
                params["min_imbalance"] = random.uniform(0.1, 0.3)
            elif f == FilterType.REGIME:
                params["required_regime"] = random.choice(self.regimes)
            elif f == FilterType.VOLATILITY:
                params["max_volatility"] = random.uniform(0.01, 0.05)
            elif f == FilterType.TREND:
                params["min_trend_strength"] = random.uniform(0.3, 0.7)
        
        return params
    
    # ============================================================
    # 2. 进化操作
    # ============================================================
    def mutate(self, strategy: StrategyConfig) -> StrategyConfig:
        """
        变异策略
        
        Args:
            strategy: 原策略
        
        Returns:
            变异后的策略
        """
        new_id = f"STRAT-{self.stats['total_generated']:06d}"
        self.stats["total_generated"] += 1
        
        # 复制参数
        new_entry_params = strategy.entry_params.copy()
        new_exit_params = strategy.exit_params.copy()
        new_filter_params = strategy.filter_params.copy()
        
        # 随机变异某个参数
        if random.random() < self.config.mutation_rate:
            # 变异入场参数
            param = random.choice(list(new_entry_params.keys()))
            if isinstance(new_entry_params[param], float):
                new_entry_params[param] *= random.uniform(0.8, 1.2)
            elif isinstance(new_entry_params[param], int):
                new_entry_params[param] = int(new_entry_params[param] * random.uniform(0.8, 1.2))
        
        if random.random() < self.config.mutation_rate:
            # 变异出场参数
            param = random.choice(list(new_exit_params.keys()))
            if isinstance(new_exit_params[param], float):
                new_exit_params[param] *= random.uniform(0.8, 1.2)
        
        now = datetime.now().isoformat()
        
        return StrategyConfig(
            strategy_id=new_id,
            generation=strategy.generation + 1,
            parent_id=strategy.strategy_id,
            regime=strategy.regime,
            entry_type=strategy.entry_type,
            entry_params=new_entry_params,
            exit_type=strategy.exit_type,
            exit_params=new_exit_params,
            filters=strategy.filters,
            filter_params=new_filter_params,
            created_at=now,
            updated_at=now
        )
    
    def crossover(self, s1: StrategyConfig, s2: StrategyConfig) -> StrategyConfig:
        """
        交叉两个策略
        
        Args:
            s1: 策略1
            s2: 策略2
        
        Returns:
            新策略
        """
        new_id = f"STRAT-{self.stats['total_generated']:06d}"
        self.stats["total_generated"] += 1
        
        # 随机选择组件
        regime = random.choice([s1.regime, s2.regime])
        entry_type = random.choice([s1.entry_type, s2.entry_type])
        exit_type = random.choice([s1.exit_type, s2.exit_type])
        
        # 合并过滤器
        all_filters = list(set(s1.filters + s2.filters))
        filters = random.sample(all_filters, min(3, len(all_filters)))
        
        # 合并参数
        entry_params = {}
        for key in set(s1.entry_params.keys()) | set(s2.entry_params.keys()):
            entry_params[key] = random.choice([
                s1.entry_params.get(key, 0),
                s2.entry_params.get(key, 0)
            ])
        
        exit_params = {}
        for key in set(s1.exit_params.keys()) | set(s2.exit_params.keys()):
            exit_params[key] = random.choice([
                s1.exit_params.get(key, 0),
                s2.exit_params.get(key, 0)
            ])
        
        now = datetime.now().isoformat()
        
        return StrategyConfig(
            strategy_id=new_id,
            generation=max(s1.generation, s2.generation) + 1,
            parent_id=f"{s1.strategy_id}+{s2.strategy_id}",
            regime=regime,
            entry_type=entry_type,
            entry_params=entry_params,
            exit_type=exit_type,
            exit_params=exit_params,
            filters=filters,
            created_at=now,
            updated_at=now
        )
    
    # ============================================================
    # 3. 策略管理
    # ============================================================
    def add_strategy(self, strategy: StrategyConfig):
        """添加策略"""
        self.strategies[strategy.strategy_id] = strategy
        self._save_strategy(strategy)
    
    def update_strategy(self, strategy_id: str, **kwargs):
        """更新策略"""
        if strategy_id not in self.strategies:
            return
        
        strategy = self.strategies[strategy_id]
        
        for key, value in kwargs.items():
            if hasattr(strategy, key):
                setattr(strategy, key, value)
        
        strategy.updated_at = datetime.now().isoformat()
    
    def remove_strategy(self, strategy_id: str):
        """移除策略"""
        if strategy_id in self.strategies:
            del self.strategies[strategy_id]
    
    def get_top_strategies(self, n: int = 10) -> List[StrategyConfig]:
        """获取最优策略"""
        sorted_strategies = sorted(
            self.strategies.values(),
            key=lambda x: x.score,
            reverse=True
        )
        return sorted_strategies[:n]
    
    def get_active_strategies(self) -> List[StrategyConfig]:
        """获取活跃策略"""
        return [
            s for s in self.strategies.values()
            if s.status == StrategyStatus.ACTIVE
        ]
    
    def get_testing_strategies(self) -> List[StrategyConfig]:
        """获取测试中的策略"""
        return [
            s for s in self.strategies.values()
            if s.status in [StrategyStatus.BACKTESTING, StrategyStatus.PAPER, StrategyStatus.SHADOW]
        ]
    
    # ============================================================
    # 4. 查询接口
    # ============================================================
    def get_summary(self) -> Dict:
        """获取摘要"""
        active = len(self.get_active_strategies())
        testing = len(self.get_testing_strategies())
        
        top = self.get_top_strategies(1)
        top_strategy = None
        if top:
            t = top[0]
            top_strategy = {
                "id": t.strategy_id,
                "type": f"{t.regime}_{t.entry_type.value}",
                "sharpe": round(t.sharpe, 2),
                "win_rate": round(t.win_rate * 100, 1),
                "pnl": round(t.total_pnl * 100, 2)
            }
        
        return {
            "total_generated": self.stats["total_generated"],
            "total_rejected": self.stats["total_rejected"],
            "total_accepted": self.stats["total_accepted"],
            "generations": self.stats["generations"],
            "active_strategies": active,
            "testing_strategies": testing,
            "total_in_pool": len(self.strategies),
            "top_strategy": top_strategy
        }
    
    def get_strategy_details(self, strategy_id: str) -> Optional[Dict]:
        """获取策略详情"""
        if strategy_id not in self.strategies:
            return None
        
        s = self.strategies[strategy_id]
        
        return {
            "strategy_id": s.strategy_id,
            "generation": s.generation,
            "parent_id": s.parent_id,
            "regime": s.regime,
            "entry_type": s.entry_type.value,
            "exit_type": s.exit_type.value,
            "filters": [f.value for f in s.filters],
            "entry_params": s.entry_params,
            "exit_params": s.exit_params,
            "score": round(s.score, 3),
            "sharpe": round(s.sharpe, 2),
            "win_rate": round(s.win_rate * 100, 1),
            "max_drawdown": round(s.max_drawdown * 100, 2),
            "status": s.status.value,
            "created_at": s.created_at
        }
    
    # ============================================================
    # 5. 持久化
    # ============================================================
    def _save_strategy(self, strategy: StrategyConfig):
        """保存策略"""
        log_file = self.data_dir / "strategies.jsonl"
        
        data = {
            "strategy_id": strategy.strategy_id,
            "generation": strategy.generation,
            "regime": strategy.regime,
            "entry_type": strategy.entry_type.value,
            "exit_type": strategy.exit_type.value,
            "filters": [f.value for f in strategy.filters],
            "score": strategy.score,
            "sharpe": strategy.sharpe,
            "win_rate": strategy.win_rate,
            "status": strategy.status.value,
            "created_at": strategy.created_at
        }
        
        with open(log_file, "a") as f:
            f.write(json.dumps(data) + "\n")
    
    def _load_strategies(self):
        """加载策略"""
        log_file = self.data_dir / "strategies.jsonl"
        
        if not log_file.exists():
            return
        
        try:
            with open(log_file, "r") as f:
                for line in f:
                    try:
                        data = json.loads(line)
                        self.stats["total_generated"] += 1
                    except:
                        continue
        except Exception as e:
            print(f"⚠️ 加载策略历史失败: {e}")


# ============================================================
# 便捷函数
# ============================================================
def create_strategy_generator() -> StrategyGenerator:
    """创建策略生成器"""
    return StrategyGenerator()


# ============================================================
# 测试
# ============================================================
if __name__ == "__main__":
    print("=== Strategy Generator V19 测试 ===\n")
    
    generator = StrategyGenerator()
    
    # 生成策略
    print("1. 批量生成策略:")
    strategies = generator.generate_batch(10)
    print(f"   生成 {len(strategies)} 个策略")
    
    for s in strategies[:3]:
        print(f"   {s.strategy_id}: {s.regime} + {s.entry_type.value}")
    
    # 添加策略
    print("\n2. 添加策略:")
    for s in strategies:
        generator.add_strategy(s)
    
    print(f"   策略池: {len(generator.strategies)} 个")
    
    # 变异
    print("\n3. 策略变异:")
    original = strategies[0]
    mutated = generator.mutate(original)
    print(f"   原策略: {original.strategy_id}")
    print(f"   变异: {mutated.strategy_id}")
    print(f"   父ID: {mutated.parent_id}")
    
    # 交叉
    print("\n4. 策略交叉:")
    s1, s2 = strategies[0], strategies[1]
    crossed = generator.crossover(s1, s2)
    print(f"   父策略: {s1.strategy_id} + {s2.strategy_id}")
    print(f"   子策略: {crossed.strategy_id}")
    
    # 摘要
    print("\n5. 系统摘要:")
    summary = generator.get_summary()
    print(f"   总生成: {summary['total_generated']}")
    print(f"   策略池: {summary['total_in_pool']}")
    print(f"   代数: {summary['generations']}")
    
    print("\n✅ Strategy Generator V19 测试通过")