#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🐉 Edge 验证阶段 - 收集真实交易样本

目标: 30 → 50 → 100 笔完整交易
回答核心问题:
- 有无正期望?
- Profit Factor > 1?
- avg_win > avg_loss?
- exit 分布是否健康?

数据收集:
- entry_price, exit_price, pnl, exit_source, position_size
- stop_ok, stop_verified
- margin, equity, capital_state

输出: edge_validation_report.json
"""

import asyncio
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict
import statistics

# 路径设置
BASE_DIR = Path(__file__).parent
sys.path.insert(0, str(BASE_DIR / 'core'))

# 代理设置
os.environ['https_proxy'] = 'http://127.0.0.1:7890'
os.environ['http_proxy'] = 'http://127.0.0.1:7890'

# V5.4 安全层
try:
    from core.safe_execution import SafeExecutionV54 as SafeExecutor, TradeResult
except ImportError:
    from executor.safe_execution import SafeExecutor
    TradeResult = None

# 数据文件
EDGE_DATA_FILE = BASE_DIR / 'data' / 'edge_validation_trades.jsonl'
EDGE_REPORT_FILE = BASE_DIR / 'data' / 'edge_validation_report.json'


@dataclass
class EdgeTrade:
    """Edge 验证交易数据"""
    trade_id: int
    timestamp: str
    symbol: str
    
    # 核心字段
    entry_price: float
    exit_price: float
    pnl: float
    exit_source: str
    position_size: float
    
    # 安全字段
    stop_ok: bool
    stop_verified: bool
    
    # 资金字段
    margin_usdt: float
    equity_usdt: float
    
    # 结果
    is_win: bool
    pnl_pct: float


class EdgeValidator:
    """Edge 验证器"""
    
    def __init__(self, target_trades: int = 30):
        self.target_trades = target_trades
        self.trades: List[EdgeTrade] = []
        self.load_existing_trades()
        
    def load_existing_trades(self):
        """加载已有交易数据"""
        if EDGE_DATA_FILE.exists():
            with open(EDGE_DATA_FILE, 'r') as f:
                for line in f:
                    if line.strip():
                        data = json.loads(line)
                        self.trades.append(EdgeTrade(**data))
            print(f"📊 已加载 {len(self.trades)} 笔交易")
    
    def add_trade(self, result: TradeResult) -> EdgeTrade:
        """添加交易"""
        trade_id = len(self.trades) + 1
        
        trade = EdgeTrade(
            trade_id=trade_id,
            timestamp=datetime.now().isoformat(),
            symbol="ETH/USDT:USDT",
            entry_price=result.entry_price,
            exit_price=result.exit_price,
            pnl=result.pnl,
            exit_source=result.exit_source,
            position_size=result.position_size,
            stop_ok=result.stop_ok,
            stop_verified=result.stop_verified,
            margin_usdt=result.margin_usdt,
            equity_usdt=result.equity_usdt,
            is_win=result.pnl > 0,
            pnl_pct=result.pnl / result.margin_usdt if result.margin_usdt > 0 else 0
        )
        
        self.trades.append(trade)
        self._save_trade(trade)
        return trade
    
    def _save_trade(self, trade: EdgeTrade):
        """保存单笔交易"""
        with open(EDGE_DATA_FILE, 'a') as f:
            f.write(json.dumps(asdict(trade)) + '\n')
    
    def calculate_metrics(self) -> Dict:
        """计算 Edge 指标"""
        if not self.trades:
            return {"error": "No trades"}
        
        wins = [t for t in self.trades if t.is_win]
        losses = [t for t in self.trades if not t.is_win]
        
        total_pnl = sum(t.pnl for t in self.trades)
        total_wins = sum(t.pnl for t in wins) if wins else 0
        total_losses = abs(sum(t.pnl for t in losses)) if losses else 0
        
        # Profit Factor
        profit_factor = total_wins / total_losses if total_losses > 0 else float('inf') if total_wins > 0 else 0
        
        # Win Rate
        win_rate = len(wins) / len(self.trades) * 100
        
        # Avg Win/Loss
        avg_win = statistics.mean([t.pnl for t in wins]) if wins else 0
        avg_loss = statistics.mean([t.pnl for t in losses]) if losses else 0
        
        # Expectancy
        expectancy = (win_rate/100 * avg_win) - ((100-win_rate)/100 * avg_loss)
        
        # Exit Distribution
        exit_dist = {}
        for t in self.trades:
            exit_dist[t.exit_source] = exit_dist.get(t.exit_source, 0) + 1
        
        # Max Win/Loss
        max_win = max((t.pnl for t in self.trades), default=0)
        max_loss = min((t.pnl for t in self.trades), default=0)
        
        return {
            "trade_count": len(self.trades),
            "target_trades": self.target_trades,
            "progress_pct": round(len(self.trades) / self.target_trades * 100, 1),
            
            "win_rate": round(win_rate, 2),
            "total_pnl": round(total_pnl, 4),
            "profit_factor": round(profit_factor, 2),
            "expectancy": round(expectancy, 6),
            
            "avg_win": round(avg_win, 4),
            "avg_loss": round(avg_loss, 4),
            "max_win": round(max_win, 4),
            "max_loss": round(max_loss, 4),
            
            "exit_distribution": exit_dist,
            
            "edge_status": self._determine_edge_status(win_rate, profit_factor, expectancy)
        }
    
    def _determine_edge_status(self, win_rate: float, pf: float, exp: float) -> str:
        """判定 Edge 状态"""
        if len(self.trades) < 10:
            return "INSUFFICIENT_DATA"
        
        if pf >= 1.5 and exp > 0:
            return "STRONG_EDGE ✅"
        elif pf >= 1.0 and exp > 0:
            return "POSITIVE_EDGE ✅"
        elif pf >= 0.8:
            return "WEAK_EDGE ⚠️"
        else:
            return "NO_EDGE ❌"
    
    def generate_report(self) -> Dict:
        """生成报告"""
        metrics = self.calculate_metrics()
        
        report = {
            "generated_at": datetime.now().isoformat(),
            "phase": "EDGE_VALIDATION",
            "metrics": metrics,
            "trades": [asdict(t) for t in self.trades[-10:]]  # 最近 10 笔
        }
        
        # 保存报告
        with open(EDGE_REPORT_FILE, 'w') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        return report
    
    def print_summary(self):
        """打印摘要"""
        metrics = self.calculate_metrics()
        
        print("\n" + "="*50)
        print("📊 EDGE 验证进度")
        print("="*50)
        print(f"交易数: {metrics['trade_count']}/{metrics['target_trades']} ({metrics['progress_pct']}%)")
        print(f"胜率: {metrics['win_rate']}%")
        print(f"Profit Factor: {metrics['profit_factor']}")
        print(f"Expectancy: {metrics['expectancy']}")
        print(f"avg_win/avg_loss: {metrics['avg_win']}/{metrics['avg_loss']}")
        print(f"总盈亏: ${metrics['total_pnl']}")
        print(f"Exit 分布: {metrics['exit_distribution']}")
        print(f"Edge 状态: {metrics['edge_status']}")
        print("="*50 + "\n")


async def main():
    """主函数"""
    print("\n🐉 Edge 验证阶段启动")
    print("="*50)
    
    # 加载已有数据
    validator = EdgeValidator(target_trades=30)
    
    # 检查进度
    if len(validator.trades) >= validator.target_trades:
        print(f"✅ 已达成目标: {validator.target_trades} 笔")
        validator.print_summary()
        return
    
    print(f"📊 当前进度: {len(validator.trades)}/{validator.target_trades}")
    print(f"📌 缺口: {validator.target_trades - len(validator.trades)} 笔")
    
    # 打印当前指标
    if validator.trades:
        validator.print_summary()
    
    # 提示下一步
    print("\n⏳ 启动 Live Mode 收集数据...")
    print("使用: python run_v52_live.py")
    print("\n数据将自动记录到: data/edge_validation_trades.jsonl")


if __name__ == "__main__":
    asyncio.run(main())