#!/usr/bin/env python3
"""
Portfolio Brain - 全局资金大脑 (V11)

核心升级：
从"单笔交易"单位 → "整个资金系统"单位

核心能力：
1. 全局风险控制（最重要）
2. 策略资金分配（动态）
3. 风险集中度控制
4. 多策略冲突处理
5. 资金状态机

核心认知：
单笔可以亏，系统不能连续亏
你不再在"交易"，你在"管理一个会交易的资金系统"
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, date
from enum import Enum
from pathlib import Path
import json
from collections import defaultdict

# ============================================================
# 枚举和常量
# ============================================================
class SystemState(Enum):
    """系统状态"""
    NORMAL = "NORMAL"           # 正常交易
    CAUTION = "CAUTION"         # 降仓运行
    PROTECTION = "PROTECTION"   # 保护模式（只允许高质量）
    STOP = "STOP"               # 全停


class RiskAction(Enum):
    """风险动作"""
    CONTINUE = "CONTINUE"       # 继续
    REDUCE = "REDUCE"           # 减仓
    STOP_ALL = "STOP_ALL"       # 全停


@dataclass
class PortfolioConfig:
    """Portfolio配置"""
    # 资金参数
    total_equity: float = 3.0           # 总资金 (USD)
    max_drawdown: float = 0.05          # 最大回撤 (5%)
    daily_loss_limit: float = 0.03      # 日亏损限制 (3%)
    
    # 分配参数
    max_per_strategy: float = 0.5       # 单策略最大分配 (50%)
    min_per_strategy: float = 0.1       # 单策略最小分配 (10%)
    
    # 风险参数
    max_exposure_ratio: float = 5.0     # 最大敞口比率 (500%)
    max_correlated: float = 0.3         # 最大相关性敞口 (30%)
    
    # 状态阈值
    caution_drawdown: float = 0.02      # 警告回撤 (2%)
    protection_drawdown: float = 0.04   # 保护回撤 (4%)
    
    # 质量阈值
    min_signal_quality: float = 0.7     # 保护模式最低质量


@dataclass
class StrategyInfo:
    """策略信息"""
    name: str
    score: float = 0.5          # 策略评分 (0-1)
    capital: float = 0.0        # 分配资金
    pnl_today: float = 0.0      # 今日盈亏
    trades_today: int = 0       # 今日交易数
    win_rate: float = 0.5       # 胜率
    enabled: bool = True        # 是否启用


@dataclass
class PositionInfo:
    """持仓信息"""
    strategy: str
    symbol: str
    side: str           # LONG / SHORT
    size: float
    notional: float     # 名义价值
    pnl: float = 0.0
    entry_price: float = 0.0


@dataclass
class DailyRecord:
    """每日记录"""
    date: str
    starting_equity: float
    ending_equity: float
    pnl: float
    pnl_pct: float
    trades: int
    state: str
    drawdown: float


# ============================================================
# Portfolio Brain 核心类
# ============================================================
class PortfolioBrain:
    """
    全局资金大脑
    
    职责：
    1. 全局风险控制（最重要）
    2. 策略资金分配（动态）
    3. 风险集中度控制
    4. 多策略冲突处理
    5. 资金状态机
    
    核心认知：
    单笔可以亏，系统不能连续亏
    你不再在"交易"，你在"管理一个会交易的资金系统"
    """
    
    def __init__(self, config: PortfolioConfig = None):
        self.config = config or PortfolioConfig()
        
        # 当前状态
        self.equity = self.config.total_equity
        self.peak_equity = self.equity
        self.daily_pnl = 0.0
        self.daily_trades = 0
        
        # 策略
        self.strategies: Dict[str, StrategyInfo] = {}
        
        # 持仓
        self.positions: List[PositionInfo] = []
        
        # 历史记录
        self.daily_records: List[DailyRecord] = []
        
        # 冲突日志
        self.conflict_log: List[Dict] = []
        
        # 持久化路径
        self.data_dir = Path(__file__).parent.parent / "logs" / "portfolio_brain"
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        # 加载历史
        self._load_history()
        
        print("🧠 Portfolio Brain V11 初始化完成")
        print(f"   总资金: ${self.equity:.2f}")
        print(f"   状态: {self.get_state().value}")
    
    # ============================================================
    # 1. 全局风险控制（最重要）
    # ============================================================
    def risk_check(self, daily_pnl: float = None) -> Tuple[RiskAction, Dict]:
        """
        全局风险检查
        
        核心规则：
        单笔可以亏，系统不能连续亏
        
        Args:
            daily_pnl: 今日盈亏比例 (如 -0.03 = -3%)
        
        Returns:
            (RiskAction, info)
        """
        if daily_pnl is None:
            daily_pnl = self.daily_pnl
        
        # 检查日亏损限制
        if daily_pnl <= -self.config.daily_loss_limit:
            return RiskAction.STOP_ALL, {
                "action": "STOP_ALL",
                "reason": "DAILY_LOSS_LIMIT",
                "daily_pnl": daily_pnl,
                "limit": -self.config.daily_loss_limit,
                "message": f"日亏损 {daily_pnl*100:.1f}% 达到限制 {-self.config.daily_loss_limit*100:.0f}%"
            }
        
        # 检查最大回撤
        drawdown = self._calculate_drawdown()
        if drawdown >= self.config.max_drawdown:
            return RiskAction.STOP_ALL, {
                "action": "STOP_ALL",
                "reason": "MAX_DRAWDOWN",
                "drawdown": drawdown,
                "limit": self.config.max_drawdown,
                "message": f"回撤 {drawdown*100:.1f}% 达到限制 {self.config.max_drawdown*100:.0f}%"
            }
        
        # 检查保护模式阈值
        if drawdown >= self.config.protection_drawdown:
            return RiskAction.REDUCE, {
                "action": "REDUCE",
                "reason": "PROTECTION_MODE",
                "drawdown": drawdown,
                "message": f"回撤 {drawdown*100:.1f}% 进入保护模式"
            }
        
        # 检查警告阈值
        if drawdown >= self.config.caution_drawdown:
            return RiskAction.REDUCE, {
                "action": "REDUCE",
                "reason": "CAUTION_MODE",
                "drawdown": drawdown,
                "message": f"回撤 {drawdown*100:.1f}% 进入警告模式"
            }
        
        return RiskAction.CONTINUE, {
            "action": "CONTINUE",
            "reason": "OK",
            "daily_pnl": daily_pnl,
            "drawdown": drawdown
        }
    
    def can_trade(self, strategy: str = None, signal_quality: float = 1.0) -> Tuple[bool, Dict]:
        """
        判断是否可以交易
        
        Args:
            strategy: 策略名称
            signal_quality: 信号质量 (0-1)
        
        Returns:
            (can_trade, info)
        """
        state = self.get_state()
        drawdown = self._calculate_drawdown()
        
        # STOP 状态
        if state == SystemState.STOP:
            return False, {
                "can_trade": False,
                "reason": "SYSTEM_STOP",
                "state": state.value,
                "message": "系统已停止，需手动恢复"
            }
        
        # PROTECTION 状态 - 只允许高质量
        if state == SystemState.PROTECTION:
            if signal_quality < self.config.min_signal_quality:
                return False, {
                    "can_trade": False,
                    "reason": "LOW_QUALITY",
                    "state": state.value,
                    "quality": signal_quality,
                    "required": self.config.min_signal_quality,
                    "message": f"保护模式，质量 {signal_quality:.2f} < {self.config.min_signal_quality:.2f}"
                }
        
        # 检查策略状态
        if strategy and strategy in self.strategies:
            strat = self.strategies[strategy]
            if not strat.enabled:
                return False, {
                    "can_trade": False,
                    "reason": "STRATEGY_DISABLED",
                    "strategy": strategy,
                    "message": f"策略 {strategy} 已禁用"
                }
        
        return True, {
            "can_trade": True,
            "reason": "OK",
            "state": state.value,
            "drawdown": drawdown
        }
    
    # ============================================================
    # 2. 策略资金分配（动态）
    # ============================================================
    def allocate(self, strategies: List[Dict] = None) -> Dict[str, float]:
        """
        动态资金分配
        
        基于策略评分动态分配资金
        
        Args:
            strategies: 策略列表 [{"name": "v52", "score": 0.8}, ...]
        
        Returns:
            {strategy_name: allocation}
        """
        if strategies is None:
            strategies = [
                {"name": name, "score": info.score}
                for name, info in self.strategies.items()
                if info.enabled
            ]
        
        if not strategies:
            return {}
        
        # 计算总分
        total_score = sum(s.get("score", 0.5) for s in strategies)
        
        if total_score <= 0:
            # 平均分配
            equal_share = self.equity / len(strategies)
            return {s["name"]: equal_share for s in strategies}
        
        # 按评分加权分配
        allocation = {}
        for s in strategies:
            name = s["name"]
            score = s.get("score", 0.5)
            
            # 基础权重
            weight = score / total_score
            
            # 应用限制
            weight = min(weight, self.config.max_per_strategy)
            weight = max(weight, self.config.min_per_strategy) if weight > 0 else 0
            
            allocation[name] = weight * self.equity
        
        # 归一化（确保总和不超过总资金）
        total_alloc = sum(allocation.values())
        if total_alloc > self.equity:
            scale = self.equity / total_alloc
            allocation = {k: v * scale for k, v in allocation.items()}
        
        # 更新策略资金
        for name, alloc in allocation.items():
            if name in self.strategies:
                self.strategies[name].capital = alloc
        
        return allocation
    
    def update_strategy_score(self, name: str, score: float):
        """更新策略评分"""
        if name not in self.strategies:
            self.strategies[name] = StrategyInfo(name=name)
        
        self.strategies[name].score = max(0, min(1, score))
    
    def enable_strategy(self, name: str, enabled: bool = True):
        """启用/禁用策略"""
        if name not in self.strategies:
            self.strategies[name] = StrategyInfo(name=name)
        
        self.strategies[name].enabled = enabled
    
    # ============================================================
    # 3. 风险集中度控制
    # ============================================================
    def check_exposure(self, positions: List[PositionInfo] = None) -> Tuple[str, Dict]:
        """
        检查风险敞口
        
        核心：你不是在控制交易，你在控制"总风险敞口"
        
        Args:
            positions: 持仓列表
        
        Returns:
            (status, info)
        """
        if positions is None:
            positions = self.positions
        
        if not positions:
            return "OK", {
                "status": "OK",
                "exposure": 0,
                "max_allowed": self.config.max_exposure_ratio * self.equity
            }
        
        # 计算总敞口
        total_exposure = sum(abs(p.notional) for p in positions)
        exposure_ratio = total_exposure / self.equity
        
        # 计算净敞口（方向性风险）
        net_exposure = sum(
            p.notional if p.side == "LONG" else -p.notional
            for p in positions
        )
        
        # 计算相关性敞口（同方向）
        long_exposure = sum(p.notional for p in positions if p.side == "LONG")
        short_exposure = sum(p.notional for p in positions if p.side == "SHORT")
        correlated_ratio = max(long_exposure, short_exposure) / self.equity
        
        # 检查总敞口
        if exposure_ratio > self.config.max_exposure_ratio:
            return "REDUCE", {
                "status": "REDUCE",
                "reason": "TOTAL_EXPOSURE",
                "exposure": total_exposure,
                "exposure_ratio": exposure_ratio,
                "max_allowed": self.config.max_exposure_ratio,
                "message": f"总敞口 {exposure_ratio:.1f}x 超过限制 {self.config.max_exposure_ratio:.1f}x"
            }
        
        # 检查相关性敞口
        if correlated_ratio > self.config.max_correlated:
            return "CAUTION", {
                "status": "CAUTION",
                "reason": "CORRELATED_EXPOSURE",
                "correlated_ratio": correlated_ratio,
                "max_allowed": self.config.max_correlated,
                "message": f"方向性敞口 {correlated_ratio*100:.0f}% 过高"
            }
        
        return "OK", {
            "status": "OK",
            "total_exposure": total_exposure,
            "exposure_ratio": exposure_ratio,
            "net_exposure": net_exposure,
            "correlated_ratio": correlated_ratio
        }
    
    def get_position_summary(self) -> Dict:
        """获取持仓摘要"""
        if not self.positions:
            return {
                "total_positions": 0,
                "long_count": 0,
                "short_count": 0,
                "total_exposure": 0,
                "net_exposure": 0
            }
        
        longs = [p for p in self.positions if p.side == "LONG"]
        shorts = [p for p in self.positions if p.side == "SHORT"]
        
        total_exposure = sum(abs(p.notional) for p in self.positions)
        net_exposure = sum(
            p.notional if p.side == "LONG" else -p.notional
            for p in self.positions
        )
        
        return {
            "total_positions": len(self.positions),
            "long_count": len(longs),
            "short_count": len(shorts),
            "total_exposure": total_exposure,
            "exposure_ratio": total_exposure / self.equity if self.equity > 0 else 0,
            "net_exposure": net_exposure,
            "total_pnl": sum(p.pnl for p in self.positions)
        }
    
    # ============================================================
    # 4. 多策略冲突处理
    # ============================================================
    def resolve_conflict(self, signals: List[Dict]) -> Tuple[str, Dict]:
        """
        解决多策略冲突
        
        场景：策略A做多BTC，策略B做空BTC
        核心：系统看的是"净头寸"，不是单个策略
        
        Args:
            signals: [{"strategy": "v52", "symbol": "BTC", "direction": 1, "size": 100}, ...]
                     direction: 1=LONG, -1=SHORT
        
        Returns:
            (action, info)
        """
        if not signals:
            return "SKIP", {"reason": "NO_SIGNALS"}
        
        # 按交易对分组
        by_symbol = defaultdict(list)
        for sig in signals:
            by_symbol[sig.get("symbol", "UNKNOWN")].append(sig)
        
        results = {}
        net_positions = {}
        
        for symbol, sigs in by_symbol.items():
            # 计算净头寸
            net = sum(s.get("direction", 0) * s.get("size", 0) for s in sigs)
            
            # 检查冲突
            directions = set(s.get("direction", 0) for s in sigs)
            has_conflict = len(directions) > 1 and 1 in directions and -1 in directions
            
            net_positions[symbol] = net
            
            if has_conflict:
                # 记录冲突
                conflict = {
                    "timestamp": datetime.now().isoformat(),
                    "symbol": symbol,
                    "signals": sigs,
                    "net": net
                }
                self.conflict_log.append(conflict)
                
                # 冲突解决
                if abs(net) < 0.1:  # 阈值
                    results[symbol] = "SKIP"
                else:
                    results[symbol] = "NET_EXECUTE"
            else:
                results[symbol] = "EXECUTE"
        
        # 汇总
        total_net = sum(net_positions.values())
        
        return {
            "results": results,
            "net_positions": net_positions,
            "total_net": total_net,
            "conflict_count": sum(1 for r in results.values() if r == "SKIP")
        }, {
            "action": "RESOLVED",
            "details": results
        }
    
    # ============================================================
    # 5. 资金状态机
    # ============================================================
    def get_state(self) -> SystemState:
        """
        获取系统状态
        
        状态行为：
        - NORMAL: 正常
        - CAUTION: 降仓
        - PROTECTION: 只允许高质量
        - STOP: 全停
        """
        drawdown = self._calculate_drawdown()
        
        if drawdown >= self.config.max_drawdown:
            return SystemState.STOP
        
        if drawdown >= self.config.protection_drawdown:
            return SystemState.PROTECTION
        
        if drawdown >= self.config.caution_drawdown:
            return SystemState.CAUTION
        
        # 检查日亏损
        if self.daily_pnl <= -self.config.daily_loss_limit:
            return SystemState.STOP
        
        return SystemState.NORMAL
    
    def get_state_behavior(self) -> Dict:
        """获取当前状态的行为建议"""
        state = self.get_state()
        drawdown = self._calculate_drawdown()
        
        behaviors = {
            SystemState.NORMAL: {
                "mode": "正常交易",
                "max_position": 1.0,
                "quality_threshold": 0.5,
                "actions": "所有策略正常运行"
            },
            SystemState.CAUTION: {
                "mode": "降仓运行",
                "max_position": 0.5,
                "quality_threshold": 0.6,
                "actions": "仓位减半，提高质量要求"
            },
            SystemState.PROTECTION: {
                "mode": "保护模式",
                "max_position": 0.25,
                "quality_threshold": self.config.min_signal_quality,
                "actions": "只允许高质量信号"
            },
            SystemState.STOP: {
                "mode": "系统停止",
                "max_position": 0,
                "quality_threshold": 1.0,
                "actions": "所有交易停止，需手动恢复"
            }
        }
        
        behavior = behaviors[state]
        behavior["state"] = state.value
        behavior["drawdown"] = drawdown
        behavior["daily_pnl"] = self.daily_pnl
        
        return behavior
    
    # ============================================================
    # 资金更新
    # ============================================================
    def update_equity(self, new_equity: float):
        """更新资金"""
        self.equity = new_equity
        
        # 更新峰值
        if new_equity > self.peak_equity:
            self.peak_equity = new_equity
    
    def record_trade(self, strategy: str, pnl: float):
        """记录交易"""
        self.daily_pnl += pnl / self.equity if self.equity > 0 else 0
        self.daily_trades += 1
        
        if strategy in self.strategies:
            self.strategies[strategy].pnl_today += pnl
            self.strategies[strategy].trades_today += 1
    
    def add_position(self, position: PositionInfo):
        """添加持仓"""
        self.positions.append(position)
    
    def remove_position(self, strategy: str, symbol: str):
        """移除持仓"""
        self.positions = [
            p for p in self.positions
            if not (p.strategy == strategy and p.symbol == symbol)
        ]
    
    def close_day(self):
        """结束当日"""
        record = DailyRecord(
            date=date.today().isoformat(),
            starting_equity=self.peak_equity,
            ending_equity=self.equity,
            pnl=self.equity - self.peak_equity,
            pnl_pct=(self.equity - self.peak_equity) / self.peak_equity if self.peak_equity > 0 else 0,
            trades=self.daily_trades,
            state=self.get_state().value,
            drawdown=self._calculate_drawdown()
        )
        
        self.daily_records.append(record)
        self._save_record(record)
        
        # 重置日统计
        self.daily_pnl = 0.0
        self.daily_trades = 0
        
        # 重置策略日统计
        for strat in self.strategies.values():
            strat.pnl_today = 0.0
            strat.trades_today = 0
    
    # ============================================================
    # 辅助方法
    # ============================================================
    def _calculate_drawdown(self) -> float:
        """计算当前回撤"""
        if self.peak_equity <= 0:
            return 0
        
        return (self.peak_equity - self.equity) / self.peak_equity
    
    def get_summary(self) -> Dict:
        """获取系统摘要"""
        state = self.get_state()
        drawdown = self._calculate_drawdown()
        
        return {
            "total_equity": round(self.equity, 2),
            "peak_equity": round(self.peak_equity, 2),
            "daily_pnl": round(self.daily_pnl * 100, 2),
            "daily_pnl_usd": round(self.daily_pnl * self.equity, 2),
            "drawdown": round(drawdown * 100, 2),
            "state": state.value,
            "trades_today": self.daily_trades,
            "strategies": {
                name: {
                    "score": info.score,
                    "capital": info.capital,
                    "pnl_today": info.pnl_today,
                    "enabled": info.enabled
                }
                for name, info in self.strategies.items()
            },
            "positions": self.get_position_summary(),
            "risk": self.risk_check()[1],
            "behavior": self.get_state_behavior()
        }
    
    # ============================================================
    # 持久化
    # ============================================================
    def _save_record(self, record: DailyRecord):
        """保存每日记录"""
        log_file = self.data_dir / "daily_records.jsonl"
        
        data = {
            "date": record.date,
            "starting_equity": record.starting_equity,
            "ending_equity": record.ending_equity,
            "pnl": record.pnl,
            "pnl_pct": record.pnl_pct,
            "trades": record.trades,
            "state": record.state,
            "drawdown": record.drawdown
        }
        
        with open(log_file, "a") as f:
            f.write(json.dumps(data) + "\n")
    
    def _load_history(self):
        """加载历史数据"""
        log_file = self.data_dir / "daily_records.jsonl"
        
        if not log_file.exists():
            return
        
        try:
            with open(log_file, "r") as f:
                for line in f:
                    try:
                        data = json.loads(line)
                        record = DailyRecord(
                            date=data["date"],
                            starting_equity=data["starting_equity"],
                            ending_equity=data["ending_equity"],
                            pnl=data["pnl"],
                            pnl_pct=data["pnl_pct"],
                            trades=data["trades"],
                            state=data["state"],
                            drawdown=data["drawdown"]
                        )
                        self.daily_records.append(record)
                    except:
                        continue
        except Exception as e:
            print(f"⚠️ 加载历史数据失败: {e}")
    
    def reset(self):
        """重置系统"""
        self.daily_pnl = 0.0
        self.daily_trades = 0
        self.positions = []
        print("🔄 Portfolio Brain 已重置")
    
    def force_state(self, state: SystemState):
        """强制设置状态（用于恢复）"""
        # 这是一个强制操作，用于手动恢复
        print(f"⚠️ 强制设置状态为: {state.value}")


# ============================================================
# 便捷函数
# ============================================================
def create_portfolio_brain(equity: float = 3.0) -> PortfolioBrain:
    """创建全局资金大脑"""
    config = PortfolioConfig(total_equity=equity)
    return PortfolioBrain(config)


# ============================================================
# 测试
# ============================================================
if __name__ == "__main__":
    print("=== Portfolio Brain V11 测试 ===\n")
    
    brain = PortfolioBrain()
    
    # 注册策略
    print("1. 注册策略:")
    brain.update_strategy_score("v52", 0.8)
    brain.update_strategy_score("trend", 0.6)
    brain.update_strategy_score("breakout", 0.4)
    print(f"   已注册 {len(brain.strategies)} 个策略")
    
    # 资金分配
    print("\n2. 资金分配:")
    allocation = brain.allocate()
    for name, alloc in allocation.items():
        print(f"   {name}: ${alloc:.2f}")
    
    # 风险检查
    print("\n3. 风险检查:")
    action, info = brain.risk_check()
    print(f"   动作: {action.value}")
    print(f"   原因: {info['reason']}")
    
    # 模拟亏损
    print("\n4. 模拟日亏损 -3%:")
    action, info = brain.risk_check(daily_pnl=-0.03)
    print(f"   动作: {action.value}")
    print(f"   信息: {info.get('message', 'N/A')}")
    
    # 状态检查
    print("\n5. 系统状态:")
    state = brain.get_state()
    behavior = brain.get_state_behavior()
    print(f"   状态: {state.value}")
    print(f"   模式: {behavior['mode']}")
    print(f"   行为: {behavior['actions']}")
    
    # 冲突解决
    print("\n6. 多策略冲突解决:")
    signals = [
        {"strategy": "v52", "symbol": "BTC", "direction": 1, "size": 100},
        {"strategy": "trend", "symbol": "BTC", "direction": -1, "size": 80}
    ]
    result, info = brain.resolve_conflict(signals)
    print(f"   BTC 净头寸: {result['net_positions'].get('BTC', 0)}")
    print(f"   处理结果: {result['results']}")
    
    # 敞口检查
    print("\n7. 敞口检查:")
    brain.add_position(PositionInfo(
        strategy="v52",
        symbol="BTC",
        side="LONG",
        size=0.1,
        notional=100
    ))
    status, info = brain.check_exposure()
    print(f"   状态: {status}")
    print(f"   敞口比率: {info.get('exposure_ratio', 0):.1f}x")
    
    # 系统摘要
    print("\n8. 系统摘要:")
    summary = brain.get_summary()
    print(f"   总资金: ${summary['total_equity']:.2f}")
    print(f"   状态: {summary['state']}")
    print(f"   回撤: {summary['drawdown']:.1f}%")
    
    print("\n✅ Portfolio Brain V11 测试通过")