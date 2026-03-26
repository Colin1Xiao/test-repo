"""
V5.4.1 信号硬过滤器 (L2 层)

核心原则：
1. 任意一项失败直接拒绝
2. 快速失败，不进入 L3 评分
3. 记录拒绝原因

9 项硬过滤：
1. spread_hard_gate_bps: 3.0
2. volatility_min: 0.0008
3. volatility_max: 0.008
4. price_staleness_seconds: 2.0
5. market_jump_gate_bps: 8
6. min_signal_interval_seconds: 600
7. cooldown_after_exit_seconds: 900
8. max_daily_trades: 2
9. loss_streak_pause: 2 笔→1800s
"""

import json
import time
from pathlib import Path
from typing import Dict, Any, Optional, Tuple
from datetime import datetime, timedelta


class SignalFilterV54:
    """
    V5.4.1 L2 硬过滤器
    
    任意一项失败 → 直接拒绝
    """
    
    def __init__(self, config_path: str = None):
        # 默认配置
        self.config = {
            "spread_hard_gate_bps": 3.0,
            "volatility_min": 0.0008,
            "volatility_max": 0.008,
            "price_staleness_seconds": 2.0,
            "market_jump_gate_bps": 8,
            "min_signal_interval_seconds": 600,
            "cooldown_after_exit_seconds": 900,
            "max_daily_trades": 2,
            "loss_streak_pause": {
                "enabled": True,
                "consecutive_losses": 2,
                "pause_seconds": 1800
            }
        }
        
        # 加载配置文件
        if config_path:
            self._load_config(config_path)
        
        # 状态跟踪
        self.last_signal_time: Optional[float] = None
        self.last_exit_time: Optional[float] = None
        self.last_exit_side: Optional[str] = None
        self.daily_trades: int = 0
        self.consecutive_losses: int = 0
        self.last_loss_time: Optional[float] = None
        
        # 状态文件
        self.state_file = Path("~/.openclaw/workspace/trading_system_v5_4/data/filter_state.json").expanduser()
        self.state_file.parent.mkdir(parents=True, exist_ok=True)
        self._load_state()
    
    def _load_config(self, config_path: str):
        """加载配置文件"""
        try:
            with open(config_path, 'r') as f:
                full_config = json.load(f)
            
            l2_config = full_config.get("signal_v54", {}).get("l2_hard_filters", {})
            self.config.update(l2_config)
        except Exception as e:
            print(f"⚠️ [SignalFilter] 加载配置失败：{e}，使用默认配置")
    
    def _load_state(self):
        """加载状态文件"""
        if self.state_file.exists():
            try:
                with open(self.state_file, 'r') as f:
                    state = json.load(f)
                
                self.last_signal_time = state.get("last_signal_time")
                self.last_exit_time = state.get("last_exit_time")
                self.last_exit_side = state.get("last_exit_side")
                self.daily_trades = state.get("daily_trades", 0)
                self.consecutive_losses = state.get("consecutive_losses", 0)
                self.last_loss_time = state.get("last_loss_time")
                
                # 重置每日计数 (简单实现：重启后重置)
                # TODO: 基于日期的重置逻辑
            except Exception as e:
                print(f"⚠️ [SignalFilter] 加载状态失败：{e}")
    
    def _save_state(self):
        """保存状态文件"""
        state = {
            "last_signal_time": self.last_signal_time,
            "last_exit_time": self.last_exit_time,
            "last_exit_side": self.last_exit_side,
            "daily_trades": self.daily_trades,
            "consecutive_losses": self.consecutive_losses,
            "last_loss_time": self.last_loss_time,
            "last_updated": datetime.utcnow().isoformat()
        }
        
        try:
            with open(self.state_file, 'w') as f:
                json.dump(state, f, indent=2)
        except Exception as e:
            print(f"⚠️ [SignalFilter] 保存状态失败：{e}")
    
    def check(self, 
              symbol: str,
              side: str,
              spread_bps: float,
              volatility: float,
              price_age_seconds: float,
              price_jump_bps: float,
              volume_ratio: float = None) -> Tuple[bool, str, Dict[str, Any]]:
        """
        执行 L2 硬过滤检查
        
        Args:
            symbol: 交易对
            side: 方向 (buy/sell)
            spread_bps: 当前点差 (bps)
            volatility: 当前波动率
            price_age_seconds: 价格年龄 (秒)
            price_jump_bps: 价格跳变 (bps)
            volume_ratio: 成交量比率 (可选)
        
        Returns:
            (passed, reason, details)
            passed=True 才允许进入 L3
        """
        current_time = time.time()
        details = {
            "spread_bps": spread_bps,
            "volatility": volatility,
            "price_age_seconds": price_age_seconds,
            "price_jump_bps": price_jump_bps,
            "volume_ratio": volume_ratio,
            "filters_checked": []
        }
        
        # 1. Spread Gate
        if spread_bps > self.config["spread_hard_gate_bps"]:
            return False, f"SPREAD_TOO_WIDE: {spread_bps:.2f} > {self.config['spread_hard_gate_bps']} bps", details
        details["filters_checked"].append("spread_pass")
        
        # 2. Volatility Range
        if volatility < self.config["volatility_min"]:
            return False, f"VOLATILITY_TOO_LOW: {volatility:.6f} < {self.config['volatility_min']}", details
        if volatility > self.config["volatility_max"]:
            return False, f"VOLATILITY_TOO_HIGH: {volatility:.6f} > {self.config['volatility_max']}", details
        details["filters_checked"].append("volatility_pass")
        
        # 3. Price Staleness Gate
        if price_age_seconds > self.config["price_staleness_seconds"]:
            return False, f"PRICE_STALE: {price_age_seconds:.2f}s > {self.config['price_staleness_seconds']}s", details
        details["filters_checked"].append("staleness_pass")
        
        # 4. Market Jump Gate
        if abs(price_jump_bps) > self.config["market_jump_gate_bps"]:
            return False, f"MARKET_JUMP: {price_jump_bps:.2f} > {self.config['market_jump_gate_bps']} bps", details
        details["filters_checked"].append("jump_pass")
        
        # 5. Signal Interval Cooldown
        if self.last_signal_time:
            time_since_last = current_time - self.last_signal_time
            if time_since_last < self.config["min_signal_interval_seconds"]:
                return False, f"SIGNAL_COOLDOWN: {time_since_last:.0f}s < {self.config['min_signal_interval_seconds']}s", details
        details["filters_checked"].append("interval_pass")
        
        # 6. Cooldown After Exit (同方向)
        if self.last_exit_time and self.last_exit_side == side:
            time_since_exit = current_time - self.last_exit_time
            if time_since_exit < self.config["cooldown_after_exit_seconds"]:
                return False, f"POST_EXIT_COOLDOWN: {time_since_exit:.0f}s < {self.config['cooldown_after_exit_seconds']}s (side={side})", details
        details["filters_checked"].append("exit_cooldown_pass")
        
        # 7. Max Daily Trades
        if self.daily_trades >= self.config["max_daily_trades"]:
            return False, f"DAILY_LIMIT: {self.daily_trades} >= {self.config['max_daily_trades']}", details
        details["filters_checked"].append("daily_limit_pass")
        
        # 8. Loss Streak Pause
        if self.config["loss_streak_pause"]["enabled"]:
            if self.consecutive_losses >= self.config["loss_streak_pause"]["consecutive_losses"]:
                if self.last_loss_time:
                    time_since_loss = current_time - self.last_loss_time
                    if time_since_loss < self.config["loss_streak_pause"]["pause_seconds"]:
                        return False, f"LOSS_STREAK_PAUSE: {self.consecutive_losses} losses, {time_since_loss:.0f}s < {self.config['loss_streak_pause']['pause_seconds']}s", details
        details["filters_checked"].append("loss_streak_pass")
        
        # All checks passed
        return True, "L2_HARD_FILTERS_PASS", details
    
    def record_signal(self, side: str):
        """记录信号时间"""
        self.last_signal_time = time.time()
        self._save_state()
    
    def record_exit(self, side: str, pnl: float):
        """记录退出事件"""
        self.last_exit_time = time.time()
        self.last_exit_side = side
        self.daily_trades += 1
        
        # 更新连续亏损计数
        if pnl < 0:
            self.consecutive_losses += 1
            self.last_loss_time = time.time()
        else:
            self.consecutive_losses = 0
        
        self._save_state()
    
    def reset_daily_trades(self):
        """重置每日交易计数"""
        self.daily_trades = 0
        self._save_state()
    
    def get_state(self) -> Dict[str, Any]:
        """获取当前状态"""
        return {
            "last_signal_time": self.last_signal_time,
            "last_exit_time": self.last_exit_time,
            "last_exit_side": self.last_exit_side,
            "daily_trades": self.daily_trades,
            "consecutive_losses": self.consecutive_losses,
            "last_loss_time": self.last_loss_time
        }


# 全局单例
_filter_instance: Optional[SignalFilterV54] = None

def get_signal_filter(config_path: str = None) -> SignalFilterV54:
    """获取 SignalFilter 单例"""
    global _filter_instance
    if _filter_instance is None:
        _filter_instance = SignalFilterV54(config_path)
    return _filter_instance
