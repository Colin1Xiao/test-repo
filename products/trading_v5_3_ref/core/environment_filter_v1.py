#!/usr/bin/env python3
"""
Environment Filter V1 - 环境识别器
基于统计验证的规则系统，不做预测，只做开关

核心目标：判断现在"适不适合策略出手"
输出：ALLOW / BLOCK / BLOCK_30MIN / BLOCK_120MIN
"""

from dataclasses import dataclass
from typing import Literal, Dict, List
from datetime import datetime
import json
from pathlib import Path


@dataclass
class EnvironmentContext:
    """环境上下文"""
    symbol: str
    timestamp: str
    hour: int
    volume_ratio: float
    consecutive_stop_loss: int = 0
    last_5_trades_winrate: float = 1.0
    last_5_trades_avg_pnl: float = 0.0


@dataclass
class FilterResult:
    """过滤结果"""
    decision: Literal["ALLOW", "BLOCK", "BLOCK_30MIN", "BLOCK_120MIN"]
    reason: str
    rule_triggered: str


class EnvironmentFilterV1:
    """
    环境识别器 V1
    
    基于V4.2.3统计验证的规则：
    1. ETH下午硬过滤 (12-18) - 统计确认负期望
    2. 低成交量过滤 (<1.05x) - 统计确认负收益
    3. 连续止损熔断 (3次/5次)
    4. 短期失效检测 (最近5笔胜率0)
    """
    
    def __init__(self, config: Dict = None):
        self.config = config or {}
        
        # 规则阈值
        self.eth_afternoon_block = True  # ETH下午禁用
        self.volume_threshold = 1.05     # 成交量阈值
        self.stop_loss_cooldown_3 = 3    # 3次止损熔断
        self.stop_loss_cooldown_5 = 5    # 5次止损熔断
        self.recent_trades_window = 5    # 最近5笔检测
        
        # 状态追踪
        self.recent_trades: List[Dict] = []  # 最近交易记录
        self.consecutive_losses = 0          # 连续亏损计数
        self.global_block_until = None       # 全局熔断时间
        
        # 加载历史状态
        self._load_state()
        
        print("🛡️ 环境识别器 V1 初始化完成")
        print("📋 激活规则:")
        print("  1. ETH下午硬过滤 (12-18)")
        print("  2. 低成交量过滤 (<1.05x)")
        print("  3. 连续止损熔断 (3次→30min, 5次→120min)")
        print("  4. 短期失效检测 (最近5笔胜率0)")
    
    def _load_state(self):
        """加载状态"""
        state_file = Path(__file__).parent.parent / 'data' / 'env_filter_state.json'
        if state_file.exists():
            try:
                with open(state_file, 'r') as f:
                    state = json.load(f)
                    self.recent_trades = state.get('recent_trades', [])
                    self.consecutive_losses = state.get('consecutive_losses', 0)
                    
                    # 加载全局熔断时间
                    block_until_str = state.get('global_block_until')
                    if block_until_str:
                        from datetime import datetime
                        self.global_block_until = datetime.fromisoformat(block_until_str)
            except:
                pass
    
    def _save_state(self):
        """保存状态"""
        state_file = Path(__file__).parent.parent / 'data' / 'env_filter_state.json'
        state = {
            'recent_trades': self.recent_trades[-20:],  # 保留最近20笔
            'consecutive_losses': self.consecutive_losses,
            'global_block_until': self.global_block_until.isoformat() if self.global_block_until else None,
            'last_update': datetime.now().isoformat()
        }
        with open(state_file, 'w') as f:
            json.dump(state, f)
    
    def evaluate(self, context: EnvironmentContext) -> FilterResult:
        """
        评估当前环境是否允许交易
        
        规则优先级（从高到低）：
        1. 全局熔断检查
        2. ETH下午过滤
        3. 成交量过滤
        4. 连续止损熔断 (5次优先于3次)
        5. 短期失效检测
        """
        
        # 规则0: 全局熔断检查
        if self.global_block_until:
            from datetime import datetime
            now = datetime.now()
            if now < self.global_block_until:
                remaining = (self.global_block_until - now).total_seconds() / 60
                return FilterResult(
                    decision="BLOCK",
                    reason=f"全局熔断中，剩余{remaining:.0f}分钟",
                    rule_triggered="GLOBAL_COOLDOWN"
                )
            else:
                self.global_block_until = None
        
        # 规则1: ETH下午硬过滤（仅低成交量时）
        if self.eth_afternoon_block and 'ETH' in context.symbol:
            if 12 <= context.hour < 18 and context.volume_ratio < 0.95:
                return FilterResult(
                    decision="BLOCK",
                    reason=f"ETH下午+低量禁用 (hour={context.hour}, vol={context.volume_ratio:.2f}x)",
                    rule_triggered="ETH_AFTERNOON_LOWVOL_BLOCK"
                )
        
        # 规则2: 低成交量过滤（仅ETH）
        if 'ETH' in context.symbol and context.volume_ratio < self.volume_threshold:
            return FilterResult(
                decision="BLOCK",
                reason=f"ETH成交量过低 ({context.volume_ratio:.2f}x < {self.volume_threshold}x)",
                rule_triggered="ETH_LOW_VOLUME_BLOCK"
            )
        
        # 规则3: 连续止损熔断 (5次优先)
        if context.consecutive_stop_loss >= self.stop_loss_cooldown_5:
            from datetime import datetime, timedelta
            self.global_block_until = datetime.now() + timedelta(minutes=120)
            return FilterResult(
                decision="BLOCK_120MIN",
                reason=f"连续{context.consecutive_stop_loss}次止损，熔断120分钟",
                rule_triggered="STOP_LOSS_COOLDOWN_5"
            )
        
        if context.consecutive_stop_loss >= self.stop_loss_cooldown_3:
            from datetime import datetime, timedelta
            self.global_block_until = datetime.now() + timedelta(minutes=30)
            return FilterResult(
                decision="BLOCK_30MIN",
                reason=f"连续{context.consecutive_stop_loss}次止损，熔断30分钟",
                rule_triggered="STOP_LOSS_COOLDOWN_3"
            )
        
        # 规则4: 短期失效检测（质量导向）
        if len(self.recent_trades) >= 5:
            recent_5 = self.recent_trades[-5:]
            avg_pnl = sum(t['pnl_pct'] for t in recent_5) / 5
            
            if avg_pnl < -0.05:  # 最近5笔平均亏损超过0.05%
                from datetime import datetime, timedelta
                self.global_block_until = datetime.now() + timedelta(minutes=30)
                return FilterResult(
                    decision="BLOCK_30MIN",
                    reason=f"最近5笔平均亏损{avg_pnl:.4f}%，策略可能失效",
                    rule_triggered="SHORT_TERM_FAILURE_QUALITY"
                )
        
        # 所有规则通过
        return FilterResult(
            decision="ALLOW",
            reason="环境检查通过",
            rule_triggered="NONE"
        )
    
    def record_trade(self, symbol: str, pnl_pct: float, timestamp: str):
        """记录交易结果，更新状态"""
        trade = {
            'symbol': symbol,
            'pnl_pct': pnl_pct,
            'timestamp': timestamp,
            'is_win': pnl_pct > 0
        }
        
        self.recent_trades.append(trade)
        
        # 更新连续亏损计数
        if pnl_pct < 0:
            self.consecutive_losses += 1
        else:
            self.consecutive_losses = 0
        
        # 保留最近20笔
        if len(self.recent_trades) > 20:
            self.recent_trades = self.recent_trades[-20:]
        
        # 保存状态
        self._save_state()
    
    def get_recent_stats(self) -> Dict:
        """获取最近交易统计"""
        if not self.recent_trades:
            return {
                'total_trades': 0,
                'win_rate': 0,
                'avg_pnl': 0,
                'consecutive_losses': self.consecutive_losses
            }
        
        recent = self.recent_trades[-5:]  # 最近5笔
        wins = sum(1 for t in recent if t['is_win'])
        
        return {
            'total_trades': len(self.recent_trades),
            'recent_5_winrate': wins / len(recent) if recent else 0,
            'recent_5_avg_pnl': sum(t['pnl_pct'] for t in recent) / len(recent) if recent else 0,
            'consecutive_losses': self.consecutive_losses
        }
    
    def reset_cooldown(self):
        """重置熔断状态"""
        self.consecutive_losses = 0
        self._save_state()
        print("🔄 熔断状态已重置")


# 便捷函数
def create_filter() -> EnvironmentFilterV1:
    """创建环境识别器实例"""
    return EnvironmentFilterV1()


def quick_check(symbol: str, hour: int, volume_ratio: float, 
                consecutive_losses: int = 0) -> FilterResult:
    """快速检查"""
    filter_v1 = EnvironmentFilterV1()
    context = EnvironmentContext(
        symbol=symbol,
        timestamp=datetime.now().isoformat(),
        hour=hour,
        volume_ratio=volume_ratio,
        consecutive_stop_loss=consecutive_losses
    )
    return filter_v1.evaluate(context)


if __name__ == "__main__":
    # 测试
    filter_v1 = EnvironmentFilterV1()
    
    print("\n" + "="*60)
    print("🧪 环境识别器 V1 测试")
    print("="*60)
    
    test_cases = [
        ("ETH/USDT", 14, 1.2, 0, "ETH下午"),
        ("BTC/USDT", 10, 0.9, 0, "低成交量"),
        ("ETH/USDT", 10, 1.2, 4, "连续4次止损"),
        ("BTC/USDT", 10, 1.2, 0, "正常情况"),
    ]
    
    for symbol, hour, vol, losses, desc in test_cases:
        context = EnvironmentContext(
            symbol=symbol,
            timestamp=datetime.now().isoformat(),
            hour=hour,
            volume_ratio=vol,
            consecutive_stop_loss=losses
        )
        result = filter_v1.evaluate(context)
        status = "✅" if result.decision == "ALLOW" else "🚫"
        print(f"\n{status} {desc}:")
        print(f"   决策: {result.decision}")
        print(f"   原因: {result.reason}")
        print(f"   触发规则: {result.rule_triggered}")
    
    print("\n" + "="*60)
