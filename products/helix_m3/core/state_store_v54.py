"""
StateStore V5.4 - 交易数据唯一真相源

核心原则：
1. Single Source of Truth - 所有交易数据必须由此写入
2. 文件锁 - 防止并发写入损坏
3. 缓存层 - 避免频繁文件 I/O
4. 数据完整性 - 5字段必须齐全

数据结构:
{
  "total_events": int,      # 事件数 (entry + exit)
  "total_trades": int,      # 完整交易数 (仅 exit 算 trade)
  "last_event": {...},      # 最近事件
  "last_trade": {...},      # 最近完整交易
  "trades": [...]           # 交易历史 (可选)
}

交易记录字段 (5项必填):
- entry_price: float      # 开仓价格
- exit_price: float       # 平仓价格
- pnl: float             # 盈亏金额
- exit_source: str        # 退出来源 (STOP_LOSS/TAKE_PROFIT/TIME_EXIT/MANUAL)
- position_size: float    # 持仓数量
- stop_ok: bool           # 止损是否成功
- stop_verified: bool     # 止损是否验证
"""

import json
import fcntl
import os
from pathlib import Path
from typing import Optional, Dict, Any, List
from datetime import datetime
from threading import Lock


class TradeStateStore:
    """
    V5.4 交易状态存储 - 唯一真相源
    
    线程安全 + 文件锁 + 缓存
    """
    
    def __init__(self, data_dir: str = "~/.openclaw/workspace/trading_system_v5_3/data"):
        self.data_dir = Path(data_dir).expanduser()
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        self.state_file = self.data_dir / "state_store.json"
        
        # 🔒 内存锁（线程安全）
        self._lock = Lock()
        
        # 📦 缓存
        self._cache: Optional[Dict[str, Any]] = None
        self._cache_dirty = False
        
        # 📊 当前持仓
        self._current_position: Optional[Dict[str, Any]] = None
        
        # 🚀 初始化
        self._init_file()
    
    def _init_file(self):
        """初始化状态文件（如果不存在）"""
        if not self.state_file.exists():
            initial_state = {
                "total_events": 0,
                "total_trades": 0,
                "last_event": None,
                "last_trade": None,
                "trades": [],
                "created_at": datetime.utcnow().isoformat(),
                "version": "v5.4"
            }
            self._write_file(initial_state)
            self._cache = initial_state
    
    def _read_file(self) -> Dict[str, Any]:
        """读取状态文件（带文件锁）"""
        if not self.state_file.exists():
            return {
                "total_events": 0,
                "total_trades": 0,
                "last_event": None,
                "last_trade": None,
                "trades": []
            }
        
        with open(self.state_file, 'r') as f:
            # 🔒 获取共享锁（读锁）
            fcntl.flock(f.fileno(), fcntl.LOCK_SH)
            try:
                content = f.read()
                if content:
                    return json.loads(content)
                return {"total_events": 0, "total_trades": 0, "last_event": None, "last_trade": None, "trades": []}
            finally:
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)
    
    def _write_file(self, data: Dict[str, Any]):
        """写入状态文件（带文件锁）"""
        with open(self.state_file, 'w') as f:
            # 🔒 获取独占锁（写锁）
            fcntl.flock(f.fileno(), fcntl.LOCK_EX)
            try:
                json.dump(data, f, indent=2, default=str)
                f.flush()
                os.fsync(f.fileno())  # 确保写入磁盘
            finally:
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)
    
    def _get_state(self) -> Dict[str, Any]:
        """获取当前状态（优先缓存）"""
        with self._lock:
            if self._cache is not None:
                return self._cache.copy()
            self._cache = self._read_file()
            return self._cache.copy()
    
    def _set_state(self, state: Dict[str, Any]):
        """设置状态（更新缓存+文件）"""
        with self._lock:
            self._cache = state
            self._write_file(state)
    
    def record_event(self, event_type: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        记录事件（entry 或 exit）
        
        Args:
            event_type: "entry" 或 "exit"
            data: 事件数据
        
        Returns:
            更新后的状态
        """
        state = self._get_state()
        
        # 更新事件计数
        state["total_events"] += 1
        
        # 记录事件
        event = {
            "type": event_type,
            "timestamp": datetime.utcnow().isoformat(),
            "data": data
        }
        state["last_event"] = event
        
        # 如果是 exit，更新交易计数和 last_trade
        if event_type == "exit":
            state["total_trades"] += 1
            
            # 构建完整交易记录
            trade = self._build_trade_record(data)
            state["last_trade"] = trade
            
            # 添加到历史（保留最近 100 笔）
            if "trades" not in state:
                state["trades"] = []
            state["trades"].append(trade)
            state["trades"] = state["trades"][-100:]
        
        # 更新持仓状态
        if event_type == "entry":
            self._current_position = data
        elif event_type == "exit":
            self._current_position = None
        
        self._set_state(state)
        return state
    
    def _build_trade_record(self, exit_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        构建完整交易记录（5字段必填）
        
        必填字段:
        - entry_price: 开仓价格
        - exit_price: 平仓价格  
        - pnl: 盈亏金额
        - exit_source: 退出来源
        - position_size: 持仓数量
        """
        # 从 exit_data 提取字段
        trade = {
            "entry_price": exit_data.get("entry_price", 0.0),
            "exit_price": exit_data.get("exit_price", 0.0),
            "pnl": exit_data.get("pnl", 0.0),
            "exit_source": exit_data.get("exit_source", "UNKNOWN"),
            "position_size": exit_data.get("position_size", 0.0),
            "stop_ok": exit_data.get("stop_ok", False),
            "stop_verified": exit_data.get("stop_verified", False),
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # 验证必填字段
        required_fields = ["entry_price", "exit_price", "pnl", "exit_source", "position_size"]
        for field in required_fields:
            if trade[field] == 0.0 and field != "pnl":  # pnl 可以为负
                print(f"⚠️ [StateStore] 警告: {field} 为 0，数据可能不完整")
        
        return trade
    
    def record_trade(self, 
                     entry_price: float,
                     exit_price: float,
                     pnl: float,
                     exit_source: str,
                     position_size: float,
                     stop_ok: bool = False,
                     stop_verified: bool = False) -> Dict[str, Any]:
        """
        记录完整交易（便捷方法）
        
        Args:
            entry_price: 开仓价格
            exit_price: 平仓价格
            pnl: 盈亏金额
            exit_source: 退出来源 (STOP_LOSS/TAKE_PROFIT/TIME_EXIT/MANUAL)
            position_size: 持仓数量
            stop_ok: 止损是否成功
            stop_verified: 止损是否已验证
        
        Returns:
            更新后的状态
        """
        exit_data = {
            "entry_price": entry_price,
            "exit_price": exit_price,
            "pnl": pnl,
            "exit_source": exit_source,
            "position_size": position_size,
            "stop_ok": stop_ok,
            "stop_verified": stop_verified
        }
        return self.record_event("exit", exit_data)
    
    def get_current_position(self) -> Optional[Dict[str, Any]]:
        """获取当前持仓"""
        with self._lock:
            return self._current_position.copy() if self._current_position else None
    
    def get_last_trade(self) -> Optional[Dict[str, Any]]:
        """获取最近完整交易"""
        state = self._get_state()
        return state.get("last_trade")
    
    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        state = self._get_state()
        trades = state.get("trades", [])
        
        if not trades:
            return {
                "total_trades": 0,
                "win_rate": 0.0,
                "avg_pnl": 0.0,
                "total_pnl": 0.0
            }
        
        total_pnl = sum(t.get("pnl", 0) for t in trades)
        win_count = sum(1 for t in trades if t.get("pnl", 0) > 0)
        
        return {
            "total_trades": len(trades),
            "win_rate": win_count / len(trades) if trades else 0.0,
            "avg_pnl": total_pnl / len(trades) if trades else 0.0,
            "total_pnl": total_pnl
        }
    
    def to_dict(self) -> Dict[str, Any]:
        """导出完整状态（用于 API）"""
        return self._get_state()


# ============ 单例实例 ============
# 全局唯一实例
trade_state_store = TradeStateStore()


def get_state_store() -> TradeStateStore:
    """获取 StateStore 实例"""
    return trade_state_store


def record_trade(entry_price: float,
                 exit_price: float,
                 pnl: float,
                 exit_source: str,
                 position_size: float,
                 stop_ok: bool = False,
                 stop_verified: bool = False) -> Dict[str, Any]:
    """
    便捷函数：记录交易
    
    供 safe_execution.py 调用:
    from core.state_store_v54 import record_trade
    """
    return trade_state_store.record_trade(
        entry_price=entry_price,
        exit_price=exit_price,
        pnl=pnl,
        exit_source=exit_source,
        position_size=position_size,
        stop_ok=stop_ok,
        stop_verified=stop_verified
    )


def get_last_trade() -> Optional[Dict[str, Any]]:
    """便捷函数：获取最近交易"""
    return trade_state_store.get_last_trade()


def get_stats() -> Dict[str, Any]:
    """便捷函数：获取统计"""
    return trade_state_store.get_stats()