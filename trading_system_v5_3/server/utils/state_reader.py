"""
状态读取工具
"""
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Optional

# 导入配置时需要处理循环导入
try:
    from ..config import log_config
except ImportError:
    from config import log_config


def read_last_state() -> Optional[Dict[str, Any]]:
    """读取最后一条状态"""
    try:
        log_file = log_config.system_state_file
        if not log_file.exists():
            return None
        with open(log_file, "r") as f:
            lines = f.readlines()
            if not lines:
                return None
            return json.loads(lines[-1])
    except Exception as e:
        return {"error": str(e)}


def read_recent_states(n: int = 100) -> List[Dict[str, Any]]:
    """读取最近 N 条状态"""
    try:
        log_file = log_config.system_state_file
        if not log_file.exists():
            return []
        with open(log_file, "r") as f:
            lines = f.readlines()
            return [json.loads(line) for line in lines[-n:]]
    except Exception:
        return []


def read_control_state() -> Dict[str, Any]:
    """读取控制状态"""
    try:
        control_file = log_config.control_state_file
        if not control_file.exists():
            return {"enabled": True, "mode": "shadow", "frozen": False}
        with open(control_file, "r") as f:
            return json.load(f)
    except Exception:
        return {"enabled": True, "mode": "shadow", "frozen": False}


def write_control_state(state: Dict[str, Any]) -> bool:
    """写入控制状态"""
    try:
        control_file = log_config.control_state_file
        state["last_update"] = datetime.now().isoformat()
        with open(control_file, "w") as f:
            json.dump(state, f, indent=2)
        return True
    except Exception:
        return False


def read_decisions(limit: int = 50) -> List[Dict[str, Any]]:
    """读取决策记录"""
    try:
        decision_file = log_config.decision_log
        if not decision_file.exists():
            return []
        with open(decision_file, "r") as f:
            lines = f.readlines()
            return [json.loads(line) for line in lines[-limit:]]
    except Exception:
        return []


def calculate_funnel() -> Dict[str, Any]:
    """计算信号漏斗 - 只统计今天的数据"""
    states = read_recent_states(200)
    if not states:
        return {"error": "no_data"}
    
    # 只统计今天的数据
    today = datetime.now().strftime("%Y-%m-%d")
    today_states = [s for s in states if s.get('timestamp', '').startswith(today)]
    
    if not today_states:
        return {"error": "no_data_today"}
    
    total = len(today_states)
    
    # 各层级统计
    score_pass = sum(1 for s in today_states if s.get('score', 0) >= 80)
    volume_pass = sum(1 for s in today_states if s.get('volume_ratio', 0) >= 1.2)
    both_pass = sum(1 for s in today_states if s.get('score', 0) >= 80 and s.get('volume_ratio', 0) >= 1.2)
    
    # 获取最后的交易数
    traded = today_states[-1].get('total_trades', 0) if today_states else 0
    
    return {
        "total_signals": total,
        "score_pass": score_pass,
        "volume_pass": volume_pass,
        "both_pass": both_pass,
        "trades_executed": traded,
        "conversion_rate": round(both_pass / total * 100, 1) if total > 0 else 0
    }


def calculate_stats() -> Dict[str, Any]:
    """计算统计信息 - 优先使用实时主网数据"""
    # 尝试读取实时主网数据
    try:
        live_state_file = Path(__file__).parent.parent.parent / "logs" / "live_state.json"
        if live_state_file.exists():
            with open(live_state_file, "r") as f:
                live_state = json.load(f)
            
            # 如果有实时数据，返回它
            if live_state.get('network') == 'MAINNET':
                pos = live_state.get('position')
                stats = live_state.get('stats', {})
                
                return {
                    "network": "MAINNET",
                    "total_trades": stats.get('total_trades', 0),
                    "total_pnl": stats.get('total_pnl', 0),
                    "win_rate": stats.get('win_rate', 0),
                    "avg_score": 0,
                    "position": {
                        "side": pos.get('side') if pos else 'none',
                        "size": pos.get('size', 0) if pos else 0,
                        "pnl": pos.get('unrealized_pnl', 0) if pos else 0,
                        "pnl_pct": pos.get('pnl_pct', 0) if pos else 0,
                    } if pos else None,
                    "price": live_state.get('price', 0),
                    "balance": live_state.get('balance', {}),
                    "timestamp": live_state.get('timestamp', ''),
                }
    except Exception:
        pass
    
    # 回退到历史数据
    states = read_recent_states(100)
    if not states:
        return {"error": "no_data"}
    
    # 只统计今天的数据
    today = datetime.now().strftime("%Y-%m-%d")
    today_states = [s for s in states if s.get('timestamp', '').startswith(today)]
    
    if not today_states:
        # 如果没有今天的数据，返回最后一条状态
        last = states[-1] if states else {}
        return {
            "total_trades": last.get('total_trades', 0),
            "total_pnl": last.get('avg_pnl', 0),
            "avg_score": last.get('score', 0),
            "win_rate": last.get('win_rate', 0) * 100,
            "wins": 0,
            "losses": 0,
            "sample_count": 1
        }
    
    # 基础统计
    total_trades = today_states[-1].get('total_trades', 0) if today_states else 0
    total_pnl = sum(s.get('avg_pnl', 0) for s in today_states)
    avg_score = sum(s.get('score', 0) for s in today_states) / len(today_states)
    
    # 胜率
    wins = sum(1 for s in today_states if s.get('last_trade_pnl', 0) > 0)
    losses = sum(1 for s in today_states if s.get('last_trade_pnl', 0) < 0)
    win_rate = wins / (wins + losses) * 100 if (wins + losses) > 0 else 50
    
    return {
        "total_trades": total_trades,
        "total_pnl": round(total_pnl, 2),
        "avg_score": round(avg_score, 1),
        "win_rate": round(win_rate, 1),
        "wins": wins,
        "losses": losses,
        "sample_count": len(today_states)
    }


def read_evolution_log(limit: int = 50) -> List[Dict[str, Any]]:
    """读取演化日志"""
    try:
        log_file = log_config.evolution_log
        if not log_file.exists():
            return []
        with open(log_file, "r") as f:
            lines = f.readlines()
            return [json.loads(line) for line in lines[-limit:]]
    except Exception:
        return []


def read_profit_audit() -> Dict[str, Any]:
    """读取收益审计"""
    try:
        audit_file = log_config.profit_audit
        if not audit_file.exists():
            return {"error": "no_data"}
        with open(audit_file, "r") as f:
            return json.load(f)
    except Exception:
        return {"error": "read_failed"}


def read_recent_alerts(limit: int = 20) -> List[Dict[str, Any]]:
    """读取最近告警"""
    try:
        alerts_file = log_config.alerts_log
        if not alerts_file.exists():
            return []
        with open(alerts_file, "r") as f:
            lines = f.readlines()
            return [json.loads(line) for line in lines[-limit:]]
    except Exception:
        return []


def get_system_overview() -> Dict[str, Any]:
    """获取系统概览"""
    state = read_last_state()
    stats = calculate_stats()
    audit = read_profit_audit()
    
    return {
        "state": state,
        "stats": stats,
        "audit": audit.get("profit_stats", {}),
        "slippage": audit.get("slippage_stats", {}),
        "verdict": audit.get("verdict", "N/A"),
        "timestamp": datetime.now().isoformat()
    }