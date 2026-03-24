"""
StateStore - 唯一真相源 (Single Source of Truth)

所有交易事件必须通过这里，Dashboard 只能读这里。

核心原则:
1. 所有交易事件 → 必须进入 StateStore
2. Dashboard 只能读 StateStore
3. 禁止任何绕过（JSONL / 临时变量 / 旧日志）
"""
import json
import time
import os
import threading
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime


class StateStore:
    """
    系统状态存储 - 唯一真相源
    
    规则:
    - 所有交易必须通过 record_trade() 写入
    - Dashboard 只能通过 to_dict() 读取
    - 禁止绕过此层直接写文件
    
    特性:
    - 文件锁：防止并发写入损坏
    - 缓存：避免重复读取文件
    - 区分：event（事件）vs trade（交易）
    """
    
    STATE_FILE = Path("logs/state_store.json")
    
    def __init__(self):
        self.STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        
        # 🔒 文件锁（防止并发写入损坏）
        self._file_lock = threading.Lock()
        
        # 📦 缓存（避免重复读取）
        self._cache: Optional[Dict[str, Any]] = None
        self._last_mtime: float = 0
        
        self._load_from_file()
    
    def _load_from_file(self):
        """从文件加载状态"""
        if self.STATE_FILE.exists():
            try:
                with open(self.STATE_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                self.total_events = data.get("total_events", 0)
                self.total_trades = data.get("total_trades", 0)
                self.win_count = data.get("win_count", 0)
                self.loss_count = data.get("loss_count", 0)
                self.total_pnl = data.get("total_pnl", 0.0)
                self.last_event = data.get("last_event")
                self.last_trade = data.get("last_trade")
                self.events = data.get("events", [])
            except Exception as e:
                print(f"⚠️ StateStore 加载失败: {e}")
                self._reset()
        else:
            self._reset()
    
    def _reset(self):
        """重置状态"""
        self.events: List[Dict[str, Any]] = []
        self.last_event: Optional[Dict[str, Any]] = None
        self.last_trade: Optional[Dict[str, Any]] = None
        self.total_events: int = 0  # 总事件数（entry + exit + ...）
        self.total_trades: int = 0  # 完整交易数（仅 exit）
        self.win_count: int = 0
        self.loss_count: int = 0
        self.total_pnl: float = 0.0
    
    def _save_to_file_unlocked(self):
        """内部方法：不加锁的保存（已在外层加锁）"""
        # 计算 capital 摘要
        last_trade = self.last_trade or {}
        capital = {
            "equity_usdt": last_trade.get('equity_usdt', 0.0),
            "margin_usdt": last_trade.get('margin_usdt', 0.0),
            "notional_usdt": last_trade.get('notional_usdt', 0.0),
            "position_size": last_trade.get('position_size', 0.0),
            "leverage": last_trade.get('leverage', 0),
            "capital_state": last_trade.get('capital_state', 'UNKNOWN'),
            "capital_reason": last_trade.get('capital_reason', ''),
            "risk_pct": last_trade.get('risk_pct', 0.0),
        }
        data = {
            "total_events": self.total_events,
            "total_trades": self.total_trades,
            "win_count": self.win_count,
            "loss_count": self.loss_count,
            "total_pnl": self.total_pnl,
            "last_event": self.last_event,
            "last_trade": self.last_trade,
            "events": self.events[-100:],
            "capital": capital,
            "updated_at": datetime.now().isoformat(),
        }
        with open(self.STATE_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def record_trade(self, event: Dict[str, Any]) -> bool:
        """
        唯一入口：所有事件必须走这里
        
        Args:
            event: 事件字典
            
        Returns:
            是否成功写入
        """
        event_type = event.get("event", "")
        
        # 🔥 防作弊断言（exit 必须有核心字段）
        if event_type == "exit":
            assert event.get("entry_price") is not None, "exit 缺少 entry_price"
            assert event.get("exit_price") is not None, "exit 缺少 exit_price"
            assert "pnl" in event, "exit 缺少 pnl"
            assert "exit_source" in event, "exit 缺少 exit_source"
        
        # 添加时间戳
        if "timestamp" not in event:
            event["timestamp"] = datetime.now().isoformat()
        
        # 🔒 加锁更新（防止并发写入）
        with self._file_lock:
            # 更新内存状态
            self.events.append(event)
            self.last_event = event
            self.total_events += 1
            
            # 区分 event 和 trade
            # trade = 完整闭环（只有 exit 才算 trade）
            if event_type == "exit":
                self.total_trades += 1
                pnl = event.get("pnl", 0)
                self.total_pnl += pnl
                if pnl > 0:
                    self.win_count += 1
                else:
                    self.loss_count += 1
                self.last_trade = event
            
            # 持久化到文件
            try:
                self._save_to_file_unlocked()
            except Exception as e:
                print(f"❌ 状态持久化失败: {e}")
                return False
        
        print(f"📝 StateStore: 已记录 {event_type} (events={self.total_events}, trades={self.total_trades})")
        return True
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Dashboard 读取接口

        使用缓存避免重复读取文件
        """
        # 检查文件是否变化
        try:
            mtime = os.path.getmtime(self.STATE_FILE)
            if mtime != self._last_mtime:
                self._load_from_file()
                self._last_mtime = mtime
                self._cache = None  # 清除缓存
        except Exception:
            pass

        # 使用缓存
        if self._cache is None:
            win_rate = self.win_count / self.total_trades if self.total_trades > 0 else 0

            # 计算资金摘要
            last_trade = self.last_trade or {}
            
            capital = {
                "equity_usdt": last_trade.get('equity_usdt', 0.0),
                "margin_usdt": last_trade.get('margin_usdt', 0.0),
                "notional_usdt": last_trade.get('notional_usdt', 0.0),
                "position_size": last_trade.get('position_size', 0.0),
                "leverage": last_trade.get('leverage', 0),
                "capital_state": last_trade.get('capital_state', 'UNKNOWN'),
                "capital_reason": last_trade.get('capital_reason', ''),
                "risk_pct": last_trade.get('risk_pct', 0.0),  # 直接读取，不重复计算
            }

            self._cache = {
                "total_events": self.total_events,
                "total_trades": self.total_trades,
                "win_count": self.win_count,
                "loss_count": self.loss_count,
                "win_rate": win_rate,
                "total_pnl": self.total_pnl,
                "last_event": self.last_event,
                "last_trade": self.last_trade,
                "capital": capital,
                "timestamp": datetime.now().isoformat(),
            }

        return self._cache
    
    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        return self.to_dict()


# 🔥 全局单例
state_store = StateStore()


# 🔥 统一写入函数（所有事件必须走这里）
def record_trade(event: Dict[str, Any]) -> bool:
    """
    统一事件记录入口
    
    这是整个系统唯一的事件数据写入点。
    任何地方都不能绕过这个函数直接写数据。
    """
    return state_store.record_trade(event)