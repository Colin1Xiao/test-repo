#!/usr/bin/env python3
"""
Meta Controller - 系统大脑（V10 元控制器）

核心职责：
1. 决定"今天能不能交易"
2. 决定"用什么策略组合"
3. 系统状态管理（NORMAL / CAUTION / DEFENSIVE / SLEEP）

核心思想：
顶级系统不是"会赚钱"，而是"知道什么时候不参与"

架构位置：
Market Data → Structure Engine → AI Risk → Regime Memory → 🧠 Meta Controller → Strategy Manager → Execution
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from datetime import datetime, date
from enum import Enum
import json
from pathlib import Path

# ============================================================
# 状态枚举
# ============================================================
class SystemState(Enum):
    """系统状态"""
    NORMAL = "NORMAL"           # 🟢 正常交易
    CAUTION = "CAUTION"         # 🟡 谨慎模式（仓位×0.5，提高阈值）
    DEFENSIVE = "DEFENSIVE"     # 🟠 防御模式（只允许高质量信号，仓位×0.3）
    SLEEP = "SLEEP"             # 🔴 休眠模式（禁止交易）


class TradingDecision(Enum):
    """交易决策"""
    ALLOW = "ALLOW"             # 允许交易
    REDUCE = "REDUCE"           # 降低仓位
    HIGH_QUALITY_ONLY = "HQ_ONLY"  # 仅高质量信号
    BLOCK = "BLOCK"             # 禁止交易


# ============================================================
# 配置
# ============================================================
@dataclass
class MetaConfig:
    """元控制器配置"""
    # 每日限制
    daily_loss_limit: float = -0.03       # 每日亏损限制 -3%
    daily_trade_limit: int = 20           # 每日交易次数上限
    consecutive_loss_limit: int = 3       # 连续亏损次数限制
    
    # 执行质量阈值
    execution_quality_min: float = 0.6    # 执行质量最低阈值
    slippage_max: float = 0.001           # 最大滑点 0.1%
    
    # 评分阈值
    risk_score_max: float = 0.6           # 风险评分上限
    structure_chaotic_penalty: int = 3    # CHAOTIC 结构惩罚
    
    # 记忆阈值
    win_rate_min: float = 0.4             # 最低胜率
    
    # 恢复条件
    recover_good_trades: int = 3          # 恢复需要的连续好样本
    recover_wait_minutes: int = 30        # 恢复等待时间


@dataclass
class DailyStats:
    """每日统计"""
    date: str = ""
    pnl: float = 0.0
    trade_count: int = 0
    win_count: int = 0
    loss_count: int = 0
    consecutive_losses: int = 0
    consecutive_wins: int = 0
    total_fees: float = 0.0
    max_drawdown: float = 0.0
    state_changes: List[Dict] = field(default_factory=list)


@dataclass
class SystemMemory:
    """系统记忆"""
    recent_trades: List[Dict] = field(default_factory=list)
    recent_states: List[str] = field(default_factory=list)
    state_history: List[Dict] = field(default_factory=list)
    last_state_change: Optional[datetime] = None
    total_days_trading: int = 0
    total_pnl: float = 0.0


# ============================================================
# Meta Controller 核心类
# ============================================================
class MetaController:
    """
    元控制器 - 系统大脑
    
    整合所有子系统：
    - SafetyOrchestrator (安全编排)
    - AIRiskEngine (AI 风险)
    - MarketStructure (市场结构)
    - StructurePredictor (结构预测)
    - EvolutionEngine (进化系统)
    
    输出：
    - 系统状态 (NORMAL / CAUTION / DEFENSIVE / SLEEP)
    - 交易决策 (ALLOW / REDUCE / HQ_ONLY / BLOCK)
    - 仓位乘数 (1.0 / 0.5 / 0.3 / 0.0)
    """
    
    def __init__(self, config: MetaConfig = None):
        self.config = config or MetaConfig()
        self.state = SystemState.NORMAL
        self.daily_stats = DailyStats(date=str(date.today()))
        self.memory = SystemMemory()
        
        # 子系统引用（延迟加载）
        self._safety = None
        self._ai_risk = None
        self._structure = None
        
        # 决策记录
        self.decision_history: List[Dict] = []
        
        # 每日重置检查
        self._last_date = str(date.today())
        
        print("🧠 Meta Controller 初始化完成")
        print(f"   状态: {self.state.value}")
        print(f"   每日亏损限制: {self.config.daily_loss_limit * 100:.1f}%")
        print(f"   连续亏损限制: {self.config.consecutive_loss_limit} 笔")
    
    # ============================================================
    # 核心评估方法
    # ============================================================
    def evaluate(
        self,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        评估系统状态，返回交易决策
        
        Args:
            context: {
                "risk_score": float,           # AI 风险评分 (0-1)
                "structure": str,               # 市场结构 (RANGE/TREND/BREAKOUT/CHAOTIC)
                "memory_stats": dict,           # 历史记忆统计
                "execution_quality": float,     # 执行质量 (0-1)
                "pnl": float,                   # 当前盈亏
                "slippage": float,              # 滑点
                "delay_ms": float,              # 延迟
                "prediction": dict,             # 结构预测
            }
        
        Returns:
            {
                "state": SystemState,
                "decision": TradingDecision,
                "position_multiplier": float,
                "score": int,
                "reasons": List[str],
                "action": str,
            }
        """
        # 每日重置检查
        self._check_daily_reset()
        
        # 提取上下文
        risk_score = context.get("risk_score", 0.0)
        structure = context.get("structure", "RANGE")
        memory_stats = context.get("memory_stats", {})
        execution_quality = context.get("execution_quality", 1.0)
        pnl = context.get("pnl", 0.0)
        slippage = context.get("slippage", 0.0)
        delay_ms = context.get("delay_ms", 0.0)
        
        # 初始化评分
        score = 0
        reasons = []
        
        # ============================================================
        # 1️⃣ 每日限制检查（最高优先级）
        # ============================================================
        
        # 每日亏损限制
        daily_pnl = self.daily_stats.pnl + pnl
        if daily_pnl < self.config.daily_loss_limit:
            return self._build_result(
                SystemState.SLEEP,
                "DAILY_LOSS_LIMIT",
                f"每日亏损 {daily_pnl*100:.2f}% 超过限制 {self.config.daily_loss_limit*100:.1f}%"
            )
        
        # 每日交易次数限制
        if self.daily_stats.trade_count >= self.config.daily_trade_limit:
            return self._build_result(
                SystemState.SLEEP,
                "DAILY_TRADE_LIMIT",
                f"每日交易次数 {self.daily_stats.trade_count} 达到上限 {self.config.daily_trade_limit}"
            )
        
        # ============================================================
        # 2️⃣ 连续亏损检查
        # ============================================================
        
        if self.daily_stats.consecutive_losses >= self.config.consecutive_loss_limit:
            return self._build_result(
                SystemState.DEFENSIVE,
                "CONSECUTIVE_LOSSES",
                f"连续亏损 {self.daily_stats.consecutive_losses} 笔"
            )
        
        # ============================================================
        # 3️⃣ 执行质量检查
        # ============================================================
        
        if execution_quality < self.config.execution_quality_min:
            return self._build_result(
                SystemState.SLEEP,
                "EXECUTION_QUALITY",
                f"执行质量 {execution_quality:.2f} 低于阈值 {self.config.execution_quality_min}"
            )
        
        if slippage > self.config.slippage_max:
            return self._build_result(
                SystemState.SLEEP,
                "SLIPPAGE",
                f"滑点 {slippage*100:.3f}% 超过限制 {self.config.slippage_max*100:.2f}%"
            )
        
        # ============================================================
        # 4️⃣ 市场风险评估
        # ============================================================
        
        if risk_score > self.config.risk_score_max:
            score -= 2
            reasons.append(f"风险评分高: {risk_score:.2f}")
        
        # ============================================================
        # 5️⃣ 市场结构检查
        # ============================================================
        
        if structure == "CHAOTIC":
            score -= self.config.structure_chaotic_penalty
            reasons.append("市场结构混沌")
        elif structure == "BREAKOUT":
            score -= 1
            reasons.append("突破行情（谨慎）")
        elif structure == "TREND":
            score += 1
            reasons.append("趋势行情")
        else:  # RANGE
            reasons.append("震荡行情")
        
        # ============================================================
        # 6️⃣ 历史记忆评估
        # ============================================================
        
        win_rate = memory_stats.get("win_rate", 0.5)
        if win_rate < self.config.win_rate_min:
            score -= 2
            reasons.append(f"历史胜率低: {win_rate*100:.0f}%")
        
        recent_pnl = memory_stats.get("recent_pnl", 0)
        if recent_pnl < 0:
            score -= 1
            reasons.append(f"近期亏损: {recent_pnl*100:.2f}%")
        
        # ============================================================
        # 7️⃣ 状态判定
        # ============================================================
        
        new_state = self._determine_state(score)
        
        # 记录决策
        decision_record = {
            "timestamp": datetime.now().isoformat(),
            "score": score,
            "state": new_state.value,
            "reasons": reasons,
            "context": {
                "risk_score": risk_score,
                "structure": structure,
                "execution_quality": execution_quality,
                "win_rate": win_rate
            }
        }
        self.decision_history.append(decision_record)
        if len(self.decision_history) > 100:
            self.decision_history = self.decision_history[-100:]
        
        return self._build_result(new_state, "SCORE_BASED", reasons)
    
    def _determine_state(self, score: int) -> SystemState:
        """根据评分确定状态"""
        if score >= 0:
            return SystemState.NORMAL
        elif score >= -2:
            return SystemState.CAUTION
        elif score >= -4:
            return SystemState.DEFENSIVE
        else:
            return SystemState.SLEEP
    
    def _build_result(
        self,
        state: SystemState,
        trigger: str,
        reasons
    ) -> Dict[str, Any]:
        """构建返回结果"""
        # 更新状态
        if state != self.state:
            self._record_state_change(state, trigger)
            self.state = state
        
        # 决策和仓位乘数
        if state == SystemState.NORMAL:
            decision = TradingDecision.ALLOW
            multiplier = 1.0
            action = "正常交易"
        elif state == SystemState.CAUTION:
            decision = TradingDecision.REDUCE
            multiplier = 0.5
            action = "仓位减半，提高阈值"
        elif state == SystemState.DEFENSIVE:
            decision = TradingDecision.HIGH_QUALITY_ONLY
            multiplier = 0.3
            action = "仅高质量信号，仓位×0.3"
        else:  # SLEEP
            decision = TradingDecision.BLOCK
            multiplier = 0.0
            action = "禁止交易"
        
        return {
            "state": state.value,
            "decision": decision.value,
            "position_multiplier": multiplier,
            "trigger": trigger,
            "reasons": reasons if isinstance(reasons, list) else [reasons],
            "action": action,
            "timestamp": datetime.now().isoformat()
        }
    
    # ============================================================
    # 交易反馈
    # ============================================================
    def record_trade(
        self,
        pnl: float,
        execution_quality: float,
        slippage: float,
        delay_ms: float
    ):
        """
        记录交易结果
        
        用于更新每日统计和触发状态变化
        """
        self._check_daily_reset()
        
        # 更新统计
        self.daily_stats.trade_count += 1
        self.daily_stats.pnl += pnl
        
        if pnl > 0:
            self.daily_stats.win_count += 1
            self.daily_stats.consecutive_losses = 0
            self.daily_stats.consecutive_wins += 1
        else:
            self.daily_stats.loss_count += 1
            self.daily_stats.consecutive_wins = 0
            self.daily_stats.consecutive_losses += 1
        
        # 记录交易
        trade = {
            "timestamp": datetime.now().isoformat(),
            "pnl": pnl,
            "execution_quality": execution_quality,
            "slippage": slippage,
            "delay_ms": delay_ms,
            "state": self.state.value
        }
        self.memory.recent_trades.append(trade)
        if len(self.memory.recent_trades) > 50:
            self.memory.recent_trades = self.memory.recent_trades[-50:]
        
        # 检查是否需要状态变化
        self._check_state_triggers()
    
    def _check_state_triggers(self):
        """检查状态触发条件"""
        # 连续亏损
        if self.daily_stats.consecutive_losses >= self.config.consecutive_loss_limit:
            if self.state == SystemState.NORMAL:
                self.state = SystemState.DEFENSIVE
                self._record_state_change(SystemState.DEFENSIVE, "CONSECUTIVE_LOSSES")
        
        # 每日亏损限制
        if self.daily_stats.pnl < self.config.daily_loss_limit:
            self.state = SystemState.SLEEP
            self._record_state_change(SystemState.SLEEP, "DAILY_LOSS_LIMIT")
    
    # ============================================================
    # 恢复机制
    # ============================================================
    def try_recover(self) -> bool:
        """
        尝试恢复系统
        
        恢复条件：
        - 连续 N 笔好样本
        - 等待时间足够
        """
        if self.state == SystemState.NORMAL:
            return True
        
        if self.state == SystemState.SLEEP:
            # SLEEP 状态需要更严格的恢复条件
            if self.memory.last_state_change:
                wait_time = (datetime.now() - self.memory.last_state_change).total_seconds() / 60
                if wait_time < self.config.recover_wait_minutes:
                    return False
            
            # 检查连续好样本
            recent = self.memory.recent_trades[-self.config.recover_good_trades:]
            if len(recent) >= self.config.recover_good_trades:
                all_good = all(t.get("pnl", 0) > 0 for t in recent)
                if all_good:
                    self.state = SystemState.NORMAL
                    self._record_state_change(SystemState.NORMAL, "RECOVERED")
                    return True
            return False
        
        # CAUTION / DEFENSIVE 可以更容易恢复
        if self.daily_stats.consecutive_wins >= 2:
            if self.state == SystemState.DEFENSIVE:
                self.state = SystemState.CAUTION
                self._record_state_change(SystemState.CAUTION, "RECOVERED")
            elif self.state == SystemState.CAUTION:
                self.state = SystemState.NORMAL
                self._record_state_change(SystemState.NORMAL, "RECOVERED")
            return True
        
        return False
    
    # ============================================================
    # 每日管理
    # ============================================================
    def _check_daily_reset(self):
        """检查是否需要每日重置"""
        today = str(date.today())
        if today != self._last_date:
            # 保存昨日统计
            self._save_daily_stats()
            
            # 重置
            self.daily_stats = DailyStats(date=today)
            self._last_date = today
            
            # 尝试恢复
            if self.state == SystemState.SLEEP:
                self.state = SystemState.NORMAL
                self._record_state_change(SystemState.NORMAL, "DAILY_RESET")
            
            print(f"📅 新交易日: {today}")
            print(f"   状态重置: {self.state.value}")
    
    def _save_daily_stats(self):
        """保存每日统计"""
        if self.daily_stats.trade_count == 0:
            return
        
        log_dir = Path(__file__).parent.parent / "logs"
        log_dir.mkdir(exist_ok=True)
        log_file = log_dir / "meta_daily_stats.jsonl"
        
        record = {
            "date": self.daily_stats.date,
            "pnl": self.daily_stats.pnl,
            "trade_count": self.daily_stats.trade_count,
            "win_count": self.daily_stats.win_count,
            "loss_count": self.daily_stats.loss_count,
            "win_rate": self.daily_stats.win_count / max(1, self.daily_stats.trade_count),
            "final_state": self.state.value,
            "state_changes": len(self.daily_stats.state_changes)
        }
        
        with open(log_file, "a") as f:
            f.write(json.dumps(record) + "\n")
    
    # ============================================================
    # 状态记录
    # ============================================================
    def _record_state_change(self, new_state: SystemState, reason: str):
        """记录状态变化"""
        record = {
            "timestamp": datetime.now().isoformat(),
            "old_state": self.state.value,
            "new_state": new_state.value,
            "reason": reason
        }
        self.memory.state_history.append(record)
        self.memory.last_state_change = datetime.now()
        self.daily_stats.state_changes.append(record)
        
        if len(self.memory.state_history) > 100:
            self.memory.state_history = self.memory.state_history[-100:]
        
        print(f"🔄 状态变化: {self.state.value} → {new_state.value} ({reason})")
    
    # ============================================================
    # 查询接口
    # ============================================================
    def get_state(self) -> Dict[str, Any]:
        """获取当前状态"""
        return {
            "state": self.state.value,
            "emoji": self._get_state_emoji(),
            "position_multiplier": self._get_position_multiplier(),
            "decision": self._get_decision().value,
            "daily_stats": {
                "pnl": self.daily_stats.pnl,
                "trade_count": self.daily_stats.trade_count,
                "win_count": self.daily_stats.win_count,
                "loss_count": self.daily_stats.loss_count,
                "consecutive_losses": self.daily_stats.consecutive_losses,
                "consecutive_wins": self.daily_stats.consecutive_wins
            },
            "config": {
                "daily_loss_limit": self.config.daily_loss_limit,
                "consecutive_loss_limit": self.config.consecutive_loss_limit,
                "execution_quality_min": self.config.execution_quality_min
            }
        }
    
    def get_meta_status(self) -> Dict[str, Any]:
        """获取元状态（用于 Dashboard）"""
        return {
            "state": self.state.value,
            "emoji": self._get_state_emoji(),
            "action": self._get_action_description(),
            "position_multiplier": self._get_position_multiplier(),
            "reason": self._get_last_reason(),
            "daily_pnl": self.daily_stats.pnl,
            "daily_trades": self.daily_stats.trade_count,
            "consecutive_losses": self.daily_stats.consecutive_losses,
            "win_rate": self.daily_stats.win_count / max(1, self.daily_stats.trade_count),
            "last_update": datetime.now().isoformat()
        }
    
    def _get_state_emoji(self) -> str:
        """获取状态 emoji"""
        return {
            SystemState.NORMAL: "🟢",
            SystemState.CAUTION: "🟡",
            SystemState.DEFENSIVE: "🟠",
            SystemState.SLEEP: "🔴"
        }.get(self.state, "⚪")
    
    def _get_position_multiplier(self) -> float:
        """获取仓位乘数"""
        return {
            SystemState.NORMAL: 1.0,
            SystemState.CAUTION: 0.5,
            SystemState.DEFENSIVE: 0.3,
            SystemState.SLEEP: 0.0
        }.get(self.state, 1.0)
    
    def _get_decision(self) -> TradingDecision:
        """获取交易决策"""
        return {
            SystemState.NORMAL: TradingDecision.ALLOW,
            SystemState.CAUTION: TradingDecision.REDUCE,
            SystemState.DEFENSIVE: TradingDecision.HIGH_QUALITY_ONLY,
            SystemState.SLEEP: TradingDecision.BLOCK
        }.get(self.state, TradingDecision.ALLOW)
    
    def _get_action_description(self) -> str:
        """获取动作描述"""
        return {
            SystemState.NORMAL: "正常交易",
            SystemState.CAUTION: "仓位减半，提高阈值",
            SystemState.DEFENSIVE: "仅高质量信号，仓位×0.3",
            SystemState.SLEEP: "禁止交易"
        }.get(self.state, "未知")
    
    def _get_last_reason(self) -> str:
        """获取最近一次状态变化原因"""
        if self.memory.state_history:
            last = self.memory.state_history[-1]
            return last.get("reason", "-")
        return "-"
    
    def get_decision_history(self, n: int = 10) -> List[Dict]:
        """获取决策历史"""
        return self.decision_history[-n:]
    
    # ============================================================
    # 手动控制
    # ============================================================
    def force_state(self, state: SystemState, reason: str = "MANUAL"):
        """强制设置状态"""
        old_state = self.state
        self.state = state
        self._record_state_change(state, f"MANUAL: {reason}")
        return {
            "old_state": old_state.value,
            "new_state": state.value,
            "reason": reason
        }
    
    def reset(self):
        """重置系统"""
        self.state = SystemState.NORMAL
        self.daily_stats = DailyStats(date=str(date.today()))
        self.memory.state_history = []
        self.decision_history = []
        print("🔄 Meta Controller 已重置")


# ============================================================
# 便捷函数
# ============================================================
def create_meta_controller() -> MetaController:
    """创建元控制器"""
    return MetaController()


# ============================================================
# 测试
# ============================================================
if __name__ == "__main__":
    print("=== Meta Controller 测试 ===\n")
    
    meta = MetaController()
    
    # 测试 1: 正常情况
    print("1. 正常评估:")
    result = meta.evaluate({
        "risk_score": 0.3,
        "structure": "RANGE",
        "memory_stats": {"win_rate": 0.55, "recent_pnl": 0.01},
        "execution_quality": 0.92,
        "pnl": 0.001,
        "slippage": 0.0003,
        "delay_ms": 200
    })
    print(f"   {meta._get_state_emoji()} {result['state']}")
    print(f"   决策: {result['decision']}")
    print(f"   仓位乘数: {result['position_multiplier']}")
    print(f"   原因: {result['reasons']}")
    
    # 测试 2: 高风险
    print("\n2. 高风险环境:")
    result = meta.evaluate({
        "risk_score": 0.7,
        "structure": "CHAOTIC",
        "memory_stats": {"win_rate": 0.35, "recent_pnl": -0.01},
        "execution_quality": 0.85,
        "pnl": 0,
        "slippage": 0.0003,
        "delay_ms": 300
    })
    print(f"   {meta._get_state_emoji()} {result['state']}")
    print(f"   决策: {result['decision']}")
    print(f"   原因: {result['reasons']}")
    
    # 测试 3: 连续亏损
    print("\n3. 连续亏损:")
    meta.record_trade(pnl=-0.01, execution_quality=0.9, slippage=0.0002, delay_ms=200)
    meta.record_trade(pnl=-0.01, execution_quality=0.9, slippage=0.0002, delay_ms=200)
    meta.record_trade(pnl=-0.01, execution_quality=0.9, slippage=0.0002, delay_ms=200)
    print(f"   {meta._get_state_emoji()} {meta.state.value}")
    print(f"   连续亏损: {meta.daily_stats.consecutive_losses}")
    
    # 测试 4: 恢复
    print("\n4. 尝试恢复:")
    meta.record_trade(pnl=0.005, execution_quality=0.95, slippage=0.0001, delay_ms=150)
    meta.record_trade(pnl=0.005, execution_quality=0.95, slippage=0.0001, delay_ms=150)
    recovered = meta.try_recover()
    print(f"   恢复: {'成功' if recovered else '失败'}")
    print(f"   状态: {meta.state.value}")
    
    print("\n=== 系统状态 ===")
    print(json.dumps(meta.get_state(), indent=2, default=str))