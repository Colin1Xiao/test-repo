"""
Trade Integration V5.4 - 交易数据集成层

连接 StateStore V5.4 与面板层
提供统一的交易数据 API
"""

import sys
from pathlib import Path
from typing import Dict, Any, Optional, List
from datetime import datetime

# 导入 V5.4 状态存储
sys.path.insert(0, str(Path(__file__).parent))
from state_store_v54 import TradeStateStore, get_state_store as get_v54_store


class TradeDataAdapter:
    """
    交易数据适配器
    
    为面板层提供统一的交易数据接口
    """
    
    def __init__(self):
        self.store = get_v54_store()
        print("✅ TradeDataAdapter V5.4 初始化完成")
    
    def get_dashboard_data(self) -> Dict[str, Any]:
        """
        获取面板所需完整数据
        
        Returns:
            {
                "summary": {...},      # 汇总统计
                "last_trade": {...},   # 最近交易
                "position": {...},     # 当前持仓
                "history": [...],      # 交易历史
                "safety_status": {...} # 安全状态
            }
        """
        stats = self.store.get_stats()
        last_trade = self.store.get_last_trade()
        current_pos = self.store.get_current_position()
        state = self.store.to_dict()
        
        return {
            "summary": {
                "total_trades": stats.get("total_trades", 0),
                "total_pnl": stats.get("total_pnl", 0.0),
                "win_rate": stats.get("win_rate", 0.0),
                "avg_pnl": stats.get("avg_pnl", 0.0),
                "total_events": state.get("total_events", 0)
            },
            "last_trade": last_trade,
            "position": {
                "has_position": current_pos is not None,
                "details": current_pos
            },
            "history": state.get("trades", [])[-20:],  # 最近 20 笔
            "safety_status": self._get_safety_status(last_trade),
            "timestamp": datetime.utcnow().isoformat()
        }
    
    def _get_safety_status(self, last_trade: Optional[Dict]) -> Dict[str, Any]:
        """
        获取安全状态（基于最近交易）
        
        检查项:
        - stop_ok: 止损是否成功
        - stop_verified: 止损是否验证
        - data_complete: 数据是否完整
        """
        if not last_trade:
            return {
                "status": "NO_DATA",
                "checks": {},
                "safe": False
            }
        
        # 检查数据完整性
        required_fields = ["entry_price", "exit_price", "pnl", "exit_source", "position_size"]
        data_complete = all(
            last_trade.get(field) is not None and last_trade.get(field) != 0
            for field in required_fields
            if field != "pnl"  # pnl 可以为负
        )
        
        # 检查止损状态
        stop_ok = last_trade.get("stop_ok", False)
        stop_verified = last_trade.get("stop_verified", False)
        
        # 确定安全状态
        if not data_complete:
            status = "INCOMPLETE_DATA"
            safe = False
        elif not stop_ok:
            status = "NO_STOP_LOSS"
            safe = False
        elif not stop_verified:
            status = "STOP_NOT_VERIFIED"
            safe = False
        else:
            status = "SAFE"
            safe = True
        
        return {
            "status": status,
            "safe": safe,
            "checks": {
                "data_complete": data_complete,
                "stop_ok": stop_ok,
                "stop_verified": stop_verified
            }
        }
    
    def get_trade_detail(self, trade_index: int = -1) -> Optional[Dict[str, Any]]:
        """
        获取指定交易详情
        
        Args:
            trade_index: 交易索引，-1 表示最近一笔
        
        Returns:
            交易详情或 None
        """
        state = self.store.to_dict()
        trades = state.get("trades", [])
        
        if not trades:
            return None
        
        if trade_index < 0:
            trade_index = len(trades) + trade_index
        
        if 0 <= trade_index < len(trades):
            return trades[trade_index]
        return None
    
    def get_position_summary(self) -> Dict[str, Any]:
        """获取持仓摘要"""
        current_pos = self.store.get_current_position()
        
        if not current_pos:
            return {
                "has_position": False,
                "message": "当前无持仓"
            }
        
        return {
            "has_position": True,
            "entry_price": current_pos.get("entry_price", 0),
            "position_size": current_pos.get("position_size", 0),
            "side": current_pos.get("side", "UNKNOWN"),
            "entry_time": current_pos.get("timestamp")
        }
    
    def validate_trade_data(self, trade_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        验证交易数据完整性
        
        Returns:
            {
                "valid": bool,
                "missing_fields": [...],
                "warnings": [...]
            }
        """
        required_fields = ["entry_price", "exit_price", "pnl", "exit_source", "position_size"]
        missing = []
        warnings = []
        
        for field in required_fields:
            value = trade_data.get(field)
            if value is None or (field != "pnl" and value == 0):
                missing.append(field)
        
        # 额外检查
        if trade_data.get("exit_source") == "UNKNOWN":
            warnings.append("exit_source 为 UNKNOWN，建议明确来源")
        
        if not trade_data.get("stop_ok"):
            warnings.append("止损未标记为成功")
        
        return {
            "valid": len(missing) == 0,
            "missing_fields": missing,
            "warnings": warnings
        }


class TradeDataBridge:
    """
    交易数据桥接器
    
    兼容旧面板 API，同时提供 V5.4 数据
    """
    
    def __init__(self):
        self.adapter = TradeDataAdapter()
        print("✅ TradeDataBridge 初始化完成")
    
    def get_state(self) -> Dict[str, Any]:
        """
        获取状态（兼容旧 API）
        
        同时返回 V5.3 Shadow 数据和 V5.4 交易数据
        """
        # V5.4 交易数据
        trade_data = self.adapter.get_dashboard_data()
        
        # 合并为统一格式
        return {
            "timestamp": trade_data["timestamp"],
            "mode": "live",  # V5.4 是实盘模式
            "status": self._get_system_status(trade_data),
            "trade_summary": trade_data["summary"],
            "last_trade": trade_data["last_trade"],
            "position": trade_data["position"],
            "safety": trade_data["safety_status"],
            "recent_trades": trade_data["history"],
            # 保留 V5.3 兼容字段
            "shadow": None,  # V5.4 不使用 Shadow
            "go_no_go": {
                "status": "go" if trade_data["safety_status"]["safe"] else "no_go",
                "can_go": trade_data["safety_status"]["safe"],
                "reason": trade_data["safety_status"]["status"]
            }
        }
    
    def _get_system_status(self, trade_data: Dict) -> str:
        """获取系统整体状态"""
        safety = trade_data.get("safety_status", {})
        
        if not safety.get("safe"):
            return "warning"
        
        summary = trade_data.get("summary", {})
        if summary.get("total_trades", 0) < 3:
            return "initializing"  # 样本不足
        
        return "safe"
    
    def record_trade(self, 
                     entry_price: float,
                     exit_price: float,
                     pnl: float,
                     exit_source: str,
                     position_size: float,
                     stop_ok: bool = False,
                     stop_verified: bool = False) -> Dict[str, Any]:
        """
        记录交易（便捷方法）
        """
        from state_store_v54 import record_trade as v54_record
        return v54_record(
            entry_price=entry_price,
            exit_price=exit_price,
            pnl=pnl,
            exit_source=exit_source,
            position_size=position_size,
            stop_ok=stop_ok,
            stop_verified=stop_verified
        )


# ============ 单例实例 ============
trade_data_bridge = TradeDataBridge()


def get_trade_bridge() -> TradeDataBridge:
    """获取桥接器实例"""
    return trade_data_bridge


def get_dashboard_data() -> Dict[str, Any]:
    """便捷函数：获取面板数据"""
    return trade_data_bridge.get_state()