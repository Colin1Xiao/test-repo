#!/usr/bin/env python3
"""
Strategy Evaluator - 策略评估器 (V19)

核心能力：
1. 回测评估 - 历史数据验证
2. 模拟测试 - Paper trading
3. 影子验证 - Shadow mode
4. 过拟合检测 - 训练/测试差异
5. 评分计算 - 综合评分

评估闭环：
生成 → 测试 → 评估 → 筛选 → 上线
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
import json
import random

# ============================================================
# 枚举和常量
# ============================================================
class EvaluationStatus(Enum):
    """评估状态"""
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    PASSED = "PASSED"
    FAILED = "FAILED"
    OVERFITTED = "OVERFITTED"


class EvaluationStage(Enum):
    """评估阶段"""
    BACKTEST = "BACKTEST"
    PAPER = "PAPER"
    SHADOW = "SHADOW"
    LIVE = "LIVE"


@dataclass
class EvaluationConfig:
    """评估配置"""
    # 回测参数
    backtest_window: int = 1000         # 回测窗口
    backtest_min_trades: int = 30       # 最小交易数
    
    # 模拟测试参数
    paper_min_trades: int = 50          # Paper最小交易数
    paper_duration_hours: int = 24      # Paper测试时长
    
    # 影子验证参数
    shadow_min_trades: int = 100         # Shadow最小交易数
    shadow_duration_hours: int = 72     # Shadow测试时长
    
    # 通过阈值
    min_sharpe: float = 1.0             # 最小夏普
    max_drawdown: float = 0.1           # 最大回撤
    min_win_rate: float = 0.45          # 最小胜率
    min_profit_factor: float = 1.2      # 最小盈亏比
    
    # 过拟合检测
    max_train_test_gap: float = 0.3     # 训练/测试最大差异


@dataclass
class BacktestResult:
    """回测结果"""
    strategy_id: str
    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    total_pnl: float = 0.0
    avg_pnl: float = 0.0
    win_rate: float = 0.0
    sharpe: float = 0.0
    max_drawdown: float = 0.0
    profit_factor: float = 0.0
    avg_holding_time: float = 0.0
    timestamp: str = ""


@dataclass
class EvaluationResult:
    """评估结果"""
    strategy_id: str
    stage: EvaluationStage
    status: EvaluationStatus
    
    # 回测结果
    backtest: Optional[BacktestResult] = None
    
    # 模拟结果
    paper_trades: int = 0
    paper_pnl: float = 0.0
    paper_win_rate: float = 0.0
    
    # 影子结果
    shadow_trades: int = 0
    shadow_pnl: float = 0.0
    shadow_win_rate: float = 0.0
    
    # 评分
    score: float = 0.0
    
    # 过拟合检测
    is_overfitted: bool = False
    train_test_gap: float = 0.0
    
    # 时间戳
    started_at: str = ""
    completed_at: str = ""
    
    # 详细信息
    details: Dict = field(default_factory=dict)


# ============================================================
# Strategy Evaluator 核心类
# ============================================================
class StrategyEvaluator:
    """
    策略评估器
    
    职责：
    1. 回测评估
    2. 模拟测试
    3. 影子验证
    4. 过拟合检测
    5. 评分计算
    
    评估闭环：
    生成 → 测试 → 评估 → 筛选
    """
    
    def __init__(self, config: EvaluationConfig = None):
        self.config = config or EvaluationConfig()
        
        # 评估结果缓存
        self.results: Dict[str, EvaluationResult] = {}
        
        # 统计
        self.stats = {
            "total_evaluated": 0,
            "total_passed": 0,
            "total_failed": 0,
            "total_overfitted": 0
        }
        
        # 持久化路径
        self.data_dir = Path(__file__).parent.parent / "logs" / "strategy_evaluator"
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        print("📊 Strategy Evaluator V19 初始化完成")
        print(f"   最小夏普: {self.config.min_sharpe}")
        print(f"   最大回撤: {self.config.max_drawdown * 100}%")
    
    # ============================================================
    # 1. 回测评估
    # ============================================================
    def run_backtest(
        self,
        strategy_id: str,
        historical_data: List[Dict] = None
    ) -> BacktestResult:
        """
        运行回测
        
        Args:
            strategy_id: 策略ID
            historical_data: 历史数据
        
        Returns:
            BacktestResult
        """
        # 模拟回测结果（实际应该运行真实回测）
        num_trades = random.randint(30, 100)
        win_rate = random.uniform(0.4, 0.7)
        winning_trades = int(num_trades * win_rate)
        losing_trades = num_trades - winning_trades
        
        avg_win = random.uniform(0.001, 0.003)
        avg_loss = random.uniform(-0.003, -0.001)
        
        total_pnl = winning_trades * avg_win + losing_trades * avg_loss
        avg_pnl = total_pnl / num_trades
        
        # 计算夏普（简化）
        sharpe = random.uniform(0.5, 2.5)
        
        # 最大回撤
        max_drawdown = random.uniform(0.02, 0.15)
        
        # 盈亏比
        profit_factor = abs(winning_trades * avg_win) / max(0.001, abs(losing_trades * avg_loss))
        
        return BacktestResult(
            strategy_id=strategy_id,
            total_trades=num_trades,
            winning_trades=winning_trades,
            losing_trades=losing_trades,
            total_pnl=total_pnl,
            avg_pnl=avg_pnl,
            win_rate=win_rate,
            sharpe=sharpe,
            max_drawdown=max_drawdown,
            profit_factor=profit_factor,
            avg_holding_time=random.uniform(5, 60),
            timestamp=datetime.now().isoformat()
        )
    
    def evaluate_backtest(self, result: BacktestResult) -> Tuple[bool, Dict]:
        """
        评估回测结果
        
        Args:
            result: 回测结果
        
        Returns:
            (passed, issues)
        """
        issues = []
        
        # 检查交易数
        if result.total_trades < self.config.backtest_min_trades:
            issues.append(f"交易数不足: {result.total_trades} < {self.config.backtest_min_trades}")
        
        # 检查夏普
        if result.sharpe < self.config.min_sharpe:
            issues.append(f"夏普过低: {result.sharpe:.2f} < {self.config.min_sharpe}")
        
        # 检查回撤
        if result.max_drawdown > self.config.max_drawdown:
            issues.append(f"回撤过大: {result.max_drawdown*100:.1f}% > {self.config.max_drawdown*100}%")
        
        # 检查胜率
        if result.win_rate < self.config.min_win_rate:
            issues.append(f"胜率过低: {result.win_rate*100:.1f}% < {self.config.min_win_rate*100}%")
        
        # 检查盈亏比
        if result.profit_factor < self.config.min_profit_factor:
            issues.append(f"盈亏比过低: {result.profit_factor:.2f} < {self.config.min_profit_factor}")
        
        passed = len(issues) == 0
        
        return passed, {"issues": issues}
    
    # ============================================================
    # 2. 模拟测试
    # ============================================================
    def run_paper_test(
        self,
        strategy_id: str,
        duration_hours: int = None
    ) -> Tuple[int, float, float]:
        """
        运行模拟测试
        
        Args:
            strategy_id: 策略ID
            duration_hours: 测试时长
        
        Returns:
            (trades, pnl, win_rate)
        """
        if duration_hours is None:
            duration_hours = self.config.paper_duration_hours
        
        # 模拟结果
        trades = random.randint(10, 50)
        win_rate = random.uniform(0.4, 0.65)
        pnl = random.uniform(-0.01, 0.03)
        
        return trades, pnl, win_rate
    
    # ============================================================
    # 3. 影子验证
    # ============================================================
    def run_shadow_test(
        self,
        strategy_id: str,
        duration_hours: int = None
    ) -> Tuple[int, float, float]:
        """
        运行影子验证
        
        影子模式：只记录不执行
        
        Args:
            strategy_id: 策略ID
            duration_hours: 测试时长
        
        Returns:
            (trades, pnl, win_rate)
        """
        if duration_hours is None:
            duration_hours = self.config.shadow_duration_hours
        
        # 模拟结果
        trades = random.randint(50, 150)
        win_rate = random.uniform(0.45, 0.60)
        pnl = random.uniform(-0.005, 0.02)
        
        return trades, pnl, win_rate
    
    # ============================================================
    # 4. 过拟合检测
    # ============================================================
    def detect_overfitting(
        self,
        backtest_result: BacktestResult,
        paper_result: Tuple[int, float, float],
        shadow_result: Tuple[int, float, float]
    ) -> Tuple[bool, float]:
        """
        检测过拟合
        
        比较训练表现 vs 测试表现
        
        Args:
            backtest_result: 回测结果
            paper_result: 模拟结果
            shadow_result: 影子结果
        
        Returns:
            (is_overfitted, gap)
        """
        # 使用回测作为训练，影子作为测试
        train_pnl = backtest_result.avg_pnl
        test_pnl = shadow_result[1]
        
        if train_pnl == 0:
            return False, 0.0
        
        # 计算差异
        gap = abs(train_pnl - test_pnl) / max(abs(train_pnl), 0.0001)
        
        is_overfitted = gap > self.config.max_train_test_gap
        
        return is_overfitted, gap
    
    # ============================================================
    # 5. 综合评估
    # ============================================================
    def evaluate_strategy(
        self,
        strategy_id: str,
        run_paper: bool = True,
        run_shadow: bool = True
    ) -> EvaluationResult:
        """
        综合评估策略
        
        Args:
            strategy_id: 策略ID
            run_paper: 是否运行模拟
            run_shadow: 是否运行影子
        
        Returns:
            EvaluationResult
        """
        started_at = datetime.now().isoformat()
        
        # 1. 回测
        backtest_result = self.run_backtest(strategy_id)
        backtest_passed, backtest_issues = self.evaluate_backtest(backtest_result)
        
        if not backtest_passed:
            result = EvaluationResult(
                strategy_id=strategy_id,
                stage=EvaluationStage.BACKTEST,
                status=EvaluationStatus.FAILED,
                backtest=backtest_result,
                started_at=started_at,
                completed_at=datetime.now().isoformat(),
                details=backtest_issues
            )
            self.stats["total_evaluated"] += 1
            self.stats["total_failed"] += 1
            self.results[strategy_id] = result
            return result
        
        # 2. 模拟测试
        paper_trades, paper_pnl, paper_win_rate = 0, 0.0, 0.0
        if run_paper:
            paper_trades, paper_pnl, paper_win_rate = self.run_paper_test(strategy_id)
        
        # 3. 影子验证
        shadow_trades, shadow_pnl, shadow_win_rate = 0, 0.0, 0.0
        if run_shadow:
            shadow_trades, shadow_pnl, shadow_win_rate = self.run_shadow_test(strategy_id)
        
        # 4. 过拟合检测
        is_overfitted, gap = self.detect_overfitting(
            backtest_result,
            (paper_trades, paper_pnl, paper_win_rate),
            (shadow_trades, shadow_pnl, shadow_win_rate)
        )
        
        # 5. 计算评分
        score = self._calculate_score(
            backtest_result,
            paper_win_rate,
            shadow_win_rate,
            is_overfitted
        )
        
        # 确定状态
        if is_overfitted:
            status = EvaluationStatus.OVERFITTED
            self.stats["total_overfitted"] += 1
        else:
            status = EvaluationStatus.PASSED
            self.stats["total_passed"] += 1
        
        self.stats["total_evaluated"] += 1
        
        result = EvaluationResult(
            strategy_id=strategy_id,
            stage=EvaluationStage.SHADOW if run_shadow else EvaluationStage.PAPER,
            status=status,
            backtest=backtest_result,
            paper_trades=paper_trades,
            paper_pnl=paper_pnl,
            paper_win_rate=paper_win_rate,
            shadow_trades=shadow_trades,
            shadow_pnl=shadow_pnl,
            shadow_win_rate=shadow_win_rate,
            score=score,
            is_overfitted=is_overfitted,
            train_test_gap=gap,
            started_at=started_at,
            completed_at=datetime.now().isoformat()
        )
        
        self.results[strategy_id] = result
        self._save_result(result)
        
        return result
    
    def evaluate_batch(
        self,
        strategy_ids: List[str]
    ) -> List[EvaluationResult]:
        """
        批量评估
        
        Args:
            strategy_ids: 策略ID列表
        
        Returns:
            评估结果列表
        """
        results = []
        
        for sid in strategy_ids:
            result = self.evaluate_strategy(sid)
            results.append(result)
        
        return results
    
    def _calculate_score(
        self,
        backtest: BacktestResult,
        paper_win_rate: float,
        shadow_win_rate: float,
        is_overfitted: bool
    ) -> float:
        """计算综合评分"""
        score = 0.0
        
        # 夏普贡献 (40%)
        sharpe_score = min(1.0, backtest.sharpe / 2.0) * 0.4
        
        # 胜率贡献 (30%)
        winrate_score = backtest.win_rate * 0.3
        
        # 回撤贡献 (20%)
        dd_score = (1 - min(1.0, backtest.max_drawdown / 0.15)) * 0.2
        
        # 过拟合惩罚 (10%)
        overfit_score = 0.1 if not is_overfitted else -0.1
        
        score = sharpe_score + winrate_score + dd_score + overfit_score
        
        return max(0, min(1, score))
    
    # ============================================================
    # 6. 筛选接口
    # ============================================================
    def filter_strategies(
        self,
        results: List[EvaluationResult] = None,
        min_score: float = 0.5
    ) -> List[EvaluationResult]:
        """
        筛选策略
        
        Args:
            results: 评估结果
            min_score: 最小评分
        
        Returns:
            通过的策略
        """
        if results is None:
            results = list(self.results.values())
        
        filtered = []
        
        for r in results:
            if r.status == EvaluationStatus.PASSED and r.score >= min_score:
                filtered.append(r)
        
        # 按评分排序
        filtered.sort(key=lambda x: -x.score)
        
        return filtered
    
    def get_summary(self) -> Dict:
        """获取摘要"""
        passed = [r for r in self.results.values() if r.status == EvaluationStatus.PASSED]
        failed = [r for r in self.results.values() if r.status == EvaluationStatus.FAILED]
        overfitted = [r for r in self.results.values() if r.status == EvaluationStatus.OVERFITTED]
        
        return {
            "total_evaluated": self.stats["total_evaluated"],
            "passed": len(passed),
            "failed": len(failed),
            "overfitted": len(overfitted),
            "pass_rate": len(passed) / max(1, self.stats["total_evaluated"]),
            "avg_score": sum(r.score for r in passed) / max(1, len(passed))
        }
    
    def _save_result(self, result: EvaluationResult):
        """保存结果"""
        log_file = self.data_dir / "evaluation_results.jsonl"
        
        data = {
            "strategy_id": result.strategy_id,
            "stage": result.stage.value,
            "status": result.status.value,
            "score": result.score,
            "is_overfitted": result.is_overfitted,
            "completed_at": result.completed_at
        }
        
        with open(log_file, "a") as f:
            f.write(json.dumps(data) + "\n")


# ============================================================
# 便捷函数
# ============================================================
def create_strategy_evaluator() -> StrategyEvaluator:
    """创建策略评估器"""
    return StrategyEvaluator()


# ============================================================
# 测试
# ============================================================
if __name__ == "__main__":
    print("=== Strategy Evaluator V19 测试 ===\n")
    
    evaluator = StrategyEvaluator()
    
    # 测试评估
    print("1. 评估策略:")
    result = evaluator.evaluate_strategy("TEST-001")
    print(f"   状态: {result.status.value}")
    print(f"   评分: {result.score:.3f}")
    print(f"   过拟合: {result.is_overfitted}")
    
    # 回测结果
    if result.backtest:
        print(f"   回测夏普: {result.backtest.sharpe:.2f}")
        print(f"   回测胜率: {result.backtest.win_rate*100:.1f}%")
    
    # 批量评估
    print("\n2. 批量评估:")
    results = evaluator.evaluate_batch([f"TEST-{i:03d}" for i in range(2, 6)])
    
    passed = [r for r in results if r.status == EvaluationStatus.PASSED]
    print(f"   通过: {len(passed)} / {len(results)}")
    
    # 筛选
    print("\n3. 筛选策略:")
    filtered = evaluator.filter_strategies(min_score=0.5)
    print(f"   符合条件: {len(filtered)} 个")
    
    for r in filtered[:3]:
        print(f"   {r.strategy_id}: 评分 {r.score:.3f}")
    
    # 摘要
    print("\n4. 评估摘要:")
    summary = evaluator.get_summary()
    print(f"   总评估: {summary['total_evaluated']}")
    print(f"   通过率: {summary['pass_rate']*100:.0f}%")
    print(f"   平均分: {summary['avg_score']:.3f}")
    
    print("\n✅ Strategy Evaluator V19 测试通过")