#!/usr/bin/env python3
"""
Feedback Engine - 反馈引擎

整合：
1. Signal Quality → 信号是否值得做
2. Execution Quality → 执行是否干净
3. Strategy Guardian → 策略还能不能继续

形成完整闭环：Signal → Execution → Audit → Feedback
"""

import json
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

# 导入评估器
import sys
sys.path.insert(0, str(Path(__file__).parent))

from signal_quality import SignalQualityEvaluator, get_evaluator as get_signal_evaluator
from execution_quality import ExecutionQualityEvaluator, get_evaluator as get_execution_evaluator
from strategy_guardian import StrategyGuardian, get_guardian, StrategyDecision


@dataclass
class TradeAudit:
    """交易审计记录"""
    trade_id: str
    timestamp: str
    
    # 基础信息
    symbol: str
    regime: str
    score: int
    
    # 交易结果
    net_pnl: float
    max_drawdown: float
    holding_time: int
    
    # 质量评分
    signal_quality: float
    execution_quality: float
    
    # 有效性
    is_valid_sample: bool  # 是否计入有效样本
    
    # 问题
    issues: List[str]


class FeedbackEngine:
    """
    反馈引擎
    
    核心职责：
    1. 处理每一笔交易
    2. 计算信号质量 + 执行质量
    3. 判断是否为有效样本
    4. 触发策略守护者检查
    """
    
    def __init__(self, data_dir: str = None):
        """
        初始化反馈引擎
        
        Args:
            data_dir: 数据存储目录
        """
        self.signal_evaluator = get_signal_evaluator()
        self.execution_evaluator = get_execution_evaluator()
        self.guardian = get_guardian()
        
        # 数据目录
        self.data_dir = Path(data_dir or Path(__file__).parent.parent / 'data' / 'feedback')
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        # 交易记录
        self.trades: List[Dict[str, Any]] = []
        
        # 有效样本（高质量信号 + 干净执行）
        self.valid_samples: List[Dict[str, Any]] = []
        
        print("🔄 Feedback Engine 初始化完成")
        print(f"   数据目录: {self.data_dir}")
    
    def process_trade(self, trade: Dict[str, Any]) -> TradeAudit:
        """
        处理一笔交易
        
        Args:
            trade: 交易记录
        
        Returns:
            TradeAudit
        """
        trade_id = trade.get('trade_id', datetime.now().strftime('%Y%m%d%H%M%S'))
        timestamp = trade.get('timestamp', datetime.now().isoformat())
        
        # 1. 评估信号质量
        signal_report = self.signal_evaluator.evaluate(trade)
        signal_quality = signal_report.total_score
        
        # 2. 评估执行质量
        execution_report = self.execution_evaluator.evaluate(trade)
        execution_quality = execution_report.score
        
        # 3. 判断是否为有效样本
        # 有效样本 = 高质量信号 + 干净执行
        is_valid_sample = (
            signal_report.is_high_quality and 
            execution_report.is_clean
        )
        
        # 4. 收集问题
        issues = []
        if signal_report.recommendation != "VALID":
            issues.append(f"信号质量: {signal_report.recommendation}")
        issues.extend(execution_report.issues)
        
        # 5. 创建审计记录
        audit = TradeAudit(
            trade_id=trade_id,
            timestamp=timestamp,
            symbol=trade.get('symbol', 'UNKNOWN'),
            regime=trade.get('regime', 'unknown'),
            score=trade.get('score', 0),
            net_pnl=trade.get('net_pnl', 0),
            max_drawdown=trade.get('max_drawdown', 0),
            holding_time=trade.get('holding_time', 0),
            signal_quality=signal_quality,
            execution_quality=execution_quality,
            is_valid_sample=is_valid_sample,
            issues=issues
        )
        
        # 6. 记录
        trade_record = {
            **trade,
            'trade_id': trade_id,
            'signal_quality': signal_quality,
            'execution_quality': execution_quality,
            'is_valid_sample': is_valid_sample,
            'issues': issues
        }
        
        self.trades.append(trade_record)
        
        if is_valid_sample:
            self.valid_samples.append(trade_record)
        
        # 7. 打印
        status = "✅ 有效样本" if is_valid_sample else "⚠️ 污染样本"
        print(f"\n📝 交易审计: {trade.get('symbol', 'UNKNOWN')}")
        print(f"   信号质量: {signal_quality:.2f} ({signal_report.recommendation})")
        print(f"   执行质量: {execution_quality:.2f} ({'干净' if execution_report.is_clean else '有问题'})")
        print(f"   {status}")
        
        return audit
    
    def check_guardian(self) -> Dict[str, Any]:
        """
        触发守护者检查
        
        Returns:
            守护者报告
        """
        if not self.trades:
            return {'decision': 'NO_DATA', 'reason': '暂无交易数据'}
        
        report = self.guardian.check(self.trades)
        
        print(f"\n{report}")
        
        if report.decision == StrategyDecision.STOP:
            print("\n🛑 策略已被守护者停止!")
            print(f"   原因: {report.reason}")
            print(f"   胜率: {report.win_rate*100:.1f}%")
            print(f"   平均盈亏: {report.avg_pnl*100:.3f}%")
        
        return {
            'decision': report.decision.value,
            'reason': report.reason,
            'win_rate': report.win_rate,
            'avg_pnl': report.avg_pnl,
            'signal_quality_avg': report.signal_quality_avg,
            'execution_quality_avg': report.execution_quality_avg,
            'total_trades': report.total_trades
        }
    
    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        if not self.trades:
            return {'total_trades': 0}
        
        pnls = [t['net_pnl'] for t in self.trades]
        
        return {
            'total_trades': len(self.trades),
            'valid_samples': len(self.valid_samples),
            'valid_rate': len(self.valid_samples) / len(self.trades) if self.trades else 0,
            'win_rate': sum(1 for p in pnls if p > 0) / len(pnls) if pnls else 0,
            'avg_pnl': sum(pnls) / len(pnls) if pnls else 0,
            'avg_signal_quality': sum(t['signal_quality'] for t in self.trades) / len(self.trades),
            'avg_execution_quality': sum(t['execution_quality'] for t in self.trades) / len(self.trades),
            'guardian_status': self.guardian.get_status()
        }
    
    def save(self):
        """保存数据"""
        # 保存交易记录
        trades_file = self.data_dir / f'trades_{datetime.now().strftime("%Y%m%d")}.jsonl'
        with open(trades_file, 'a', encoding='utf-8') as f:
            for trade in self.trades[-20:]:  # 保存最近20笔
                f.write(json.dumps(trade, ensure_ascii=False) + '\n')
        
        # 保存统计
        stats_file = self.data_dir / f'stats_{datetime.now().strftime("%Y%m%d")}.json'
        with open(stats_file, 'w', encoding='utf-8') as f:
            json.dump(self.get_stats(), f, ensure_ascii=False, indent=2)
        
        print(f"✅ 数据已保存: {trades_file}")
    
    def load(self, date: str = None):
        """加载历史数据"""
        date = date or datetime.now().strftime('%Y%m%d')
        trades_file = self.data_dir / f'trades_{date}.jsonl'
        
        if not trades_file.exists():
            print(f"⚠️  未找到数据文件: {trades_file}")
            return
        
        with open(trades_file, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    self.trades.append(json.loads(line))
        
        # 重新计算有效样本
        self.valid_samples = [t for t in self.trades if t.get('is_valid_sample', False)]
        
        print(f"✅ 已加载 {len(self.trades)} 笔交易记录")


# 创建默认实例
_default_engine = None

def get_engine() -> FeedbackEngine:
    """获取全局引擎实例"""
    global _default_engine
    if _default_engine is None:
        _default_engine = FeedbackEngine()
    return _default_engine