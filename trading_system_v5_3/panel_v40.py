#!/usr/bin/env python3
"""
🐉 小龙交易系统 V4.0 Cockpit 版
兼容目标：保留 panel_v40.py 全部后端逻辑，替换前端为驾驶舱布局

优化：
- 提取公共工具函数减少重复代码
- 统一异常处理和日志记录
- 完整类型注解和文档字符串
- 模板使用 Flask Jinja2 继承减少重复 HTML
- JavaScript 模块化
"""

import json
import logging
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
from flask import Flask, jsonify, render_template, request, send_from_directory
from markupsafe import Markup
from flask_cors import CORS
from threading import Thread
import ccxt
import copy
import os

# =============================================================================
# 日志配置（A2 稳定性增强 - 结构化）
# =============================================================================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('panel_v41.log', encoding='utf-8')
    ]
)
logger = logging.getLogger('panel_v41')
logger_error = logger.error  # UI-3.8 修复：使用 logger.error 方法

# =============================================================================
# UI-3.10A: 性能监控初始化
# =============================================================================
from performance_monitor import get_monitor_db, setup_performance_monitor, API_SLOW_THRESHOLD_MS

# =============================================================================
# UI-3.10D: 告警管理初始化
# =============================================================================
from alert_manager import (
    get_all_rules,
    create_rule,
    update_rule,
    delete_rule,
    get_recent_events,
    evaluate_rules
)

# =============================================================================
# 配置和常量
# =============================================================================
# SQLite 双写开关（默认开启）
SQLITE_DUAL_WRITE_ENABLED = os.environ.get("SQLITE_DUAL_WRITE", "true").lower() == "true"
# 告警冷却时间（秒）
ALERT_COOLDOWN_SEC = 60
# 告警级别优先级
LEVEL_PRIORITY = {
    "CRITICAL": 0,
    "WARN": 1,
    "INFO": 2,
}

# =============================================================================
# 可选模块导入（带优雅降级）
# =============================================================================
# SQLite 存储模块
get_storage = None
SQLiteStorage = None
StorageError = None
make_error_response = None
make_success_response = None
try:
    from storage_sqlite import get_storage, SQLiteStorage
    from storage_exceptions import StorageError, make_error_response, make_success_response
except ImportError as e:
    logger.warning(f"SQLite 存储模块导入失败：{e}")

# 新鲜度追踪模块（B1+B2 观测性增强）
FreshnessTracker = None
FreshnessStatus = None
update_freshness = None
get_overall_freshness_status = None
get_all_freshness_statuses = None
try:
    from freshness import (
        FreshnessTracker,
        FreshnessStatus,
        update_freshness,
        get_freshness_status,
        get_freshness_age,
        get_all_freshness_statuses,
        get_overall_freshness_status,
    )
except ImportError as e:
    logger.warning(f"Freshness 模块导入失败：{e}")
    get_freshness_status = None
    get_freshness_age = None

# API 性能追踪模块（B3 观测性增强）
ApiMetricsTracker = None
get_api_metrics_tracker = None
track_request = None
track_success = None
track_error = None
get_all_metrics = None
try:
    from api_metrics import (
        ApiMetricsTracker,
        get_tracker as get_api_metrics_tracker,
        track_request,
        track_success,
        track_error,
        get_all_metrics,
    )
except ImportError as e:
    logger.warning(f"API Metrics 模块导入失败：{e}")

# =============================================================================
# 全局状态初始化
# =============================================================================
# storage 延迟初始化
storage: Optional[Any] = None

app = Flask(__name__, template_folder='templates')
CORS(app)

DATA_DIR = Path(__file__).parent / 'data'

# UI-3.10A: 初始化性能监控
monitor_db = get_monitor_db(DATA_DIR)
setup_performance_monitor(app, monitor_db)

# 延迟初始化 SQLite storage
if SQLITE_DUAL_WRITE_ENABLED and get_storage is not None:
    try:
        storage = get_storage(DATA_DIR / "panel_v41.db")
    except Exception as e:
        logger.warning(f"SQLite storage 初始化失败：{e}")
        storage = None

V36_STATS = DATA_DIR / 'v36_stats.json'
V38_STATS = DATA_DIR / 'v38_stats.json'
V36_LOG = Path(__file__).parent / 'logs' / 'v36_run.log'
V38_LOG = Path(__file__).parent / 'logs' / 'v38_run.log'
CONTROL_FILE = DATA_DIR / 'control.json'
EVOLUTION_LOG = Path(__file__).parent / 'logs' / 'evolution_logs.jsonl'
SYSTEM_STATE_LOG = Path(__file__).parent / 'logs' / 'system_state.jsonl'

# OKX API 配置
exchange = ccxt.okx({
    'enableRateLimit': True,
    'options': {'defaultType': 'swap'},
    # 代理配置：如果不需要代理，注释掉下面这行
    # 'proxies': {'http': 'http://127.0.0.1:7890', 'https': 'http://127.0.0.1:7890'}
})

# 尝试加载 API 密钥（从 ~/.openclaw/secrets/okx_api.json）
try:
    SECRETS_FILE = Path.home() / '.openclaw' / 'secrets' / 'okx_api.json'
    if SECRETS_FILE.exists():
        secrets = json.load(open(SECRETS_FILE))
        okx_config = secrets.get('okx', {})
        if okx_config.get('enabled') and okx_config.get('api_key'):
            exchange.apiKey = okx_config.get('api_key')
            exchange.secret = okx_config.get('secret_key')
            exchange.password = okx_config.get('passphrase')
            API_CONFIGURED = True
        else:
            API_CONFIGURED = False
    else:
        API_CONFIGURED = False
except Exception as e:
    logger.warning(f"OKX API 配置加载失败：{e}")
    API_CONFIGURED = False

# =============================================================================
# 通用工具函数
# =============================================================================
def read_jsonl_last_lines(file_path: Path, max_lines: int) -> List[Dict[str, Any]]:
    """
    读取 JSONL 文件的最后 N 行，跳过解析错误的行。

    Args:
        file_path: JSONL 文件路径
        max_lines: 需要读取的最大行数

    Returns:
        解析后的对象列表
    """
    result: List[Dict[str, Any]] = []
    if not file_path.exists():
        return result

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()[-max_lines:]

        for line in lines:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                result.append(obj)
            except json.JSONDecodeError:
                continue
    except Exception as e:
        logger.error(f"读取 JSONL 文件失败 {file_path}: {e}")

    return result


def update_source_health(source_name: str, success: bool, error: Exception = None) -> None:
    """
    统一更新数据源健康状态。

    Args:
        source_name: 数据源名称
        success: 是否成功
        error: 异常对象（如果失败）
    """
    now = datetime.now()
    now_ts = now.isoformat()

    if success:
        source_health[source_name].update({
            "last_success_ts": now_ts,
            "last_attempt_ts": now_ts,
            "fail_count": 0,
            "last_error": None,
            "status": "ok"
        })
    else:
        current_fail = source_health[source_name].get("fail_count", 0) + 1
        source_health[source_name].update({
            "last_attempt_ts": now_ts,
            "fail_count": current_fail,
            "last_error": str(error) if error else None,
            "status": "error" if current_fail >= 3 else "warn"
        })


def safe_json_load(file_path: Path, default: Any = None) -> Any:
    """
    安全加载 JSON 文件，出错返回默认值。

    Args:
        file_path: JSON 文件路径
        default: 出错时返回的默认值

    Returns:
        解析后的数据或默认值
    """
    if not file_path.exists():
        return default

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logger.warning(f"加载 JSON 文件失败 {file_path}: {e}")
        return default

control = {
    "mode": "observe_only",
    "enabled": True,
    "can_open": False,
    "can_close": True,
    "circuit_breaker": False,
    "max_daily_loss": 500.0,
    "max_daily_trades": 20,
    "threshold": 4,
    "frozen": False,
    "updated_at": None,
    "updated_by": "system"
}

# =============================================================================
# 统一快照机制（v41 新增）
# =============================================================================
import threading

# 线程锁 - 保护快照原子性
snapshot_lock = threading.Lock()

# 最新快照（只读访问）
latest_snapshot: Dict[str, Any] = {}

# 后台线程状态
worker_state = {
    "last_loop_ts": None,
    "loop_ok": True,
    "fail_count": 0
}

# 数据源健康跟踪
source_health = {
    "okx_capital": {
        "last_success_ts": None,
        "last_attempt_ts": None,
        "fail_count": 0,
        "last_error": None,
        "status": "unknown"
    },
    "okx_position": {
        "last_success_ts": None,
        "last_attempt_ts": None,
        "fail_count": 0,
        "last_error": None,
        "status": "unknown"
    },
    "market": {
        "last_success_ts": None,
        "last_attempt_ts": None,
        "fail_count": 0,
        "last_error": None,
        "status": "unknown"
    },
    "evolution_log": {
        "last_success_ts": None,
        "last_attempt_ts": None,
        "fail_count": 0,
        "last_error": None,
        "status": "unknown"
    },
    "structure_log": {
        "last_success_ts": None,
        "last_attempt_ts": None,
        "fail_count": 0,
        "last_error": None,
        "status": "unknown"
    },
    "decision_log": {
        "last_success_ts": None,
        "last_attempt_ts": None,
        "fail_count": 0,
        "last_error": None,
        "status": "unknown"
    }
}

def publish_snapshot(snapshot: Dict[str, Any]):
    """原子发布新快照"""
    global latest_snapshot
    with snapshot_lock:
        latest_snapshot = snapshot

def get_snapshot() -> Dict[str, Any]:
    """安全读取快照副本"""
    with snapshot_lock:
        return copy.deepcopy(latest_snapshot)

# 资金状态
capital_state = {
    "equity": 0.0,
    "available": 0.0,
    "margin": 0.0,
    "unrealized_pnl": 0.0,
    "realized_pnl": 0.0,
    "currency": "USDT",
    "last_updated": None
}

# 仓位状态
position_state = {
    "symbol": "ETH/USDT:USDT",
    "side": None,
    "size": 0.0,
    "entry_price": 0.0,
    "mark_price": 0.0,
    "unrealized_pnl": 0.0,
    "leverage": 100,
    "liquidation_price": 0.0,
    "last_updated": None
}

# 演化引擎状态
evolution_state = {
    "generation": 1,
    "best_fitness": 0.74,
    "population_size": 10,
    "status": "测试中",
    "latest_params": {"score_threshold": 84.6, "volume_threshold": 1.33},
    "performance": {"pnl_pct": 0.067, "execution_quality": 0.92, "signal_quality": 0.85, "score": 0.74},
    "total_mutations": 5,
    "evolution_speed": 1
}

# 市场结构状态
structure_state = {
    "trend": "中性",
    "volatility": "中等",
    "structure": "盘整",
    "signals": [],
    "score": 50,
    "confidence": 0.5,
    "last_updated": None
}

# 决策追踪状态
decision_state = {
    "total": 0,
    "approved": 0,
    "rejected": 0,
    "approval_rate": 0.0,
    "decisions": [],
    "last_updated": None
}

# =============================================================================
# 告警去重与冷却状态（P1-2 新增）
# =============================================================================

# 冷却状态：同类型告警 60 秒内只发一次
alert_cooldowns: Dict[str, Dict] = {}

# 活跃告警状态：追踪哪些告警当前处于激活状态
active_alerts: Dict[str, Dict] = {}


# -----------------------------------------------------------------------------
# 数据加载函数（保留自 panel_v40.py）
# -----------------------------------------------------------------------------

def load_control() -> None:
    """加载控制配置从文件"""
    global control
    data = safe_json_load(CONTROL_FILE, {})
    if data:
        control.update(data)


def audit_control_change(before: Dict, after: Dict, reason: str = "", operator: str = "local_user") -> None:
    """
    记录控制变更审计日志（v42 新增，v41 双写）

    Args:
        before: 变更前状态
        after: 变更后状态
        reason: 变更原因
        operator: 操作者
    """
    ts = datetime.now().isoformat()

    # 1. JSONL（主记录）
    audit_entry = {
        "ts": ts,
        "action": "control_update",
        "operator": operator,
        "before": before,
        "after": after,
        "reason": reason
    }
    audit_file = DATA_DIR / "control_audit.jsonl"
    try:
        with open(audit_file, 'a', encoding='utf-8') as f:
            f.write(json.dumps(audit_entry) + '\n')
    except Exception as e:
        logger.warning(f"审计日志失败: {e}")

    # 2. SQLite 双写（附加写入，失败不影响主流程）
    if SQLITE_DUAL_WRITE_ENABLED and storage:
        try:
            # 提取 action 类型
            action = "update"
            if after.get("circuit_breaker") and not before.get("circuit_breaker"):
                action = "circuit_breaker_trigger"
            elif not after.get("circuit_breaker") and before.get("circuit_breaker"):
                action = "circuit_breaker_reset"
            elif after.get("frozen") and not before.get("frozen"):
                action = "freeze"
            elif not after.get("frozen") and before.get("frozen"):
                action = "unfreeze"
            elif not after.get("enabled") and before.get("enabled"):
                action = "disable"
            elif after.get("enabled") and not before.get("enabled"):
                action = "enable"

            storage.insert_control_audit(
                ts=ts,
                action=action,
                operator=operator,
                reason=reason,
                before_obj=before,
                after_obj=after,
            )
        except Exception as e:
            logger.warning(f"SQLite 双写失败 insert_control_audit: {e}")


def save_control() -> None:
    """保存控制配置到文件"""
    try:
        with open(CONTROL_FILE, 'w', encoding='utf-8') as f:
            json.dump(control, f)
    except Exception as e:
        logger.warning(f"保存控制配置失败: {e}")


def load_stats() -> Dict[str, Any]:
    """加载统计数据，先尝试 V38 再尝试 V36"""
    data = safe_json_load(V38_STATS)
    if data:
        return data
    data = safe_json_load(V36_STATS)
    if data:
        return data
    return {"total_trades": 0, "wins": 0, "losses": 0, "total_pnl": 0,
            "signals_checked": 0, "signals_passed": 0, "trades": []}

def load_evolution() -> None:
    """从 evolution_logs.jsonl 加载演化引擎数据（UI-3.7 修复：更新 source_health）"""
    global evolution_state
    now = datetime.now()
    try:
        mutations = []
        generations = set()
        best_fitness = 0.0

        lines = read_jsonl_last_lines(EVOLUTION_LOG, 100)
        for obj in lines:
            gen = obj.get('generation', 0)
            generations.add(gen)
            fitness = obj.get('best_fitness', obj.get('performance', {}).get('score', 0))
            if fitness > best_fitness:
                best_fitness = fitness
            mutations.append({
                'timestamp': obj.get('timestamp', ''),
                'generation': gen,
                'action': obj.get('action', 'mutation'),
                'old_params': obj.get('old_params', {}),
                'new_params': obj.get('new_params', {}),
                'fitness_change': obj.get('performance', {}).get('pnl_pct', 0),
                'decision': obj.get('decision', 'TESTING')
            })

        # 更新演化状态
        latest_params = mutations[-1]['new_params'] if mutations else {}
        latest_perf = mutations[-1].get('performance', {}) if mutations else {}

        evolution_state.update({
            "generation": max(generations) if generations else 1,
            "best_fitness": best_fitness,
            "population_size": evolution_state.get('population_size', 10),
            "status": "运行中" if mutations else "等待中",
            "latest_params": latest_params,
            "performance": {
                "pnl_pct": latest_perf.get('pnl_pct', 0),
                "execution_quality": latest_perf.get('execution_quality', 0),
                "signal_quality": latest_perf.get('signal_quality', 0),
                "score": best_fitness
            },
            "total_mutations": len(mutations),
            "evolution_speed": 1.0
        })

        # 更新 source_health 和 freshness
        update_source_health("evolution_log", success=True)
        if FreshnessTracker and update_freshness:
            update_freshness("evolution_log", now)
    except Exception as e:
        # 记录失败
        update_source_health("evolution_log", success=False, error=e)

def load_structure() -> None:
    """从 system_state.jsonl 加载市场结构数据（UI-3.7 修复：更新 source_health）"""
    global structure_state
    now = datetime.now()
    try:
        states = read_jsonl_last_lines(SYSTEM_STATE_LOG, 50)

        if states:
            latest = states[-1]
            # 计算平均分数和趋势
            scores = [s.get('score', 50) for s in states[-10:]]
            avg_score = sum(scores) / len(scores) if scores else 50

            # 判断趋势（比较最近 5 条和之前 5 条）
            if len(states) >= 10:
                recent_avg = sum(s.get('score', 50) for s in states[-5:]) / 5
                old_avg = sum(s.get('score', 50) for s in states[-10:-5]) / 5
                if recent_avg > old_avg + 5:
                    trend = "上涨"
                elif recent_avg < old_avg - 5:
                    trend = "下跌"
                else:
                    trend = "中性"
            else:
                trend = "中性"

            # 判断波动性
            volatility_val = latest.get('volume_ratio', 0.5)
            if volatility_val > 2.0:
                volatility = "高"
            elif volatility_val > 1.0:
                volatility = "中等"
            else:
                volatility = "低"

            structure_state.update({
                "trend": trend,
                "volatility": volatility,
                "structure": latest.get('regime', '盘整').upper(),
                "signals": [],
                "score": int(avg_score),
                "confidence": latest.get('signal_quality', 0.5),
                "last_updated": datetime.now().isoformat()
            })

            # 更新 source_health 和 freshness
            update_source_health("structure_log", success=True)
            if FreshnessTracker and update_freshness:
                update_freshness("structure_log", now)
    except Exception as e:
        # 记录失败
        update_source_health("structure_log", success=False, error=e)

def load_decisions() -> None:
    """从 decision_log.jsonl 加载决策追踪数据（UI-3.7 修复：更新 source_health）"""
    global decision_state
    now = datetime.now()
    try:
        DECISION_LOG = Path(__file__).parent / 'logs' / 'decision_log.jsonl'
        lines = read_jsonl_last_lines(DECISION_LOG, 200)
        decisions = []

        for obj in lines:
            decisions.append({
                'timestamp': obj.get('timestamp', ''),
                'result': obj.get('decision', obj.get('decision_type', 'UNKNOWN')),
                'reason': str(obj.get('reasons', obj.get('checks', {}))),
                'score': obj.get('score', 0),
                'regime': obj.get('regime', 'unknown'),
                'time': obj.get('timestamp', '').replace('T', ' ').split('.')[0]
            })

        total = len(decisions)
        # 统计 ACCEPT/EXECUTE 为通过，其他为拒绝
        approved = sum(1 for d in decisions if d['result'] in ['ACCEPT', '✅ EXECUTE', 'EXECUTE'])
        rejected = total - approved

        decision_state.update({
            "total": total,
            "approved": approved,
            "rejected": rejected,
            "approval_rate": round(approved / total * 100, 1) if total > 0 else 0,
            "decisions": decisions[-10:],
            "last_updated": datetime.now().isoformat()
        })

        # 更新 source_health 和 freshness
        update_source_health("decision_log", success=True)
        if FreshnessTracker and update_freshness:
            update_freshness("decision_log", now)
    except Exception as e:
        # 记录失败
        update_source_health("decision_log", success=False, error=e)

def fetch_capital() -> None:
    """从 OKX API 获取真实账户余额（v41 增强：记录健康状态）"""
    global capital_state
    now = datetime.now()
    now_ts = now.isoformat()
    try:
        if API_CONFIGURED:
            balance = exchange.fetch_balance()
            usdt = balance.get('USDT', {})
            total = usdt.get('total', 0.0) or 0.0
            free = usdt.get('free', 0.0) or 0.0
            used = usdt.get('used', 0.0) or 0.0
            
            # 从 state_store.json 获取已实现盈亏
            state_store_file = DATA_DIR / 'state_store.json'
            realized_pnl = 0.0
            if state_store_file.exists():
                try:
                    state_data = json.load(open(state_store_file))
                    realized_pnl = state_data.get('total_pnl', 0.0)
                except: pass
            
            capital_state.update({
                "equity": float(total),
                "available": float(free),
                "margin": float(used),
                "unrealized_pnl": float(position_state.get('unrealized_pnl', 0.0)),
                "realized_pnl": float(realized_pnl),
                "currency": "USDT",
                "last_updated": now_ts
            })
            
            # 更新健康状态
            source_health["okx_capital"].update({
                "last_success_ts": now_ts,
                "last_attempt_ts": now_ts,
                "fail_count": 0,
                "last_error": None,
                "status": "ok"
            })
        else:
            # API 未配置时，从 state_store.json 和 live_state.json 读取
            state_store_file = DATA_DIR / 'state_store.json'
            live_state_file = Path(__file__).parent / 'logs' / 'live_state.json'
            
            realized_pnl = 0.0
            equity = 0.0
            available = 0.0
            
            if state_store_file.exists():
                try:
                    state_data = json.load(open(state_store_file))
                    realized_pnl = float(state_data.get('total_pnl', 0.0))
                    capital = state_data.get('capital', {})
                    equity = float(capital.get('equity_usdt', 0.0))
                    available = float(capital.get('usdt_free', 0.0))
                except: pass
            
            if live_state_file.exists():
                try:
                    live_data = json.load(open(live_state_file))
                    balance = live_data.get('balance', {})
                    if not equity:
                        equity = float(balance.get('usdt_total', 0.0))
                    if not available:
                        available = float(balance.get('usdt_free', 0.0))
                except: pass
            
            capital_state.update({
                "equity": equity,
                "available": available,
                "margin": 0.0,
                "unrealized_pnl": float(position_state.get('unrealized_pnl', 0.0)),
                "realized_pnl": realized_pnl,
                "currency": "USDT",
                "last_updated": now_ts
            })
            
            source_health["okx_capital"].update({
                "last_success_ts": now_ts,
                "last_attempt_ts": now_ts,
                "status": "ok"
            })
    except Exception as e:
        source_health["okx_capital"].update({
            "last_attempt_ts": now_ts,
            "fail_count": source_health["okx_capital"].get("fail_count", 0) + 1,
            "last_error": str(e),
            "status": "error" if source_health["okx_capital"].get("fail_count", 0) >= 3 else "warn"
        })

def fetch_position() -> None:
    """从 OKX API 获取真实持仓状态（v41 增强：记录健康状态）"""
    global position_state
    now = datetime.now()
    now_ts = now.isoformat()
    try:
        if API_CONFIGURED:
            positions = exchange.fetch_positions(['ETH/USDT:USDT'])
            has_position = False

            for pos in positions:
                if pos.get('symbol') == 'ETH/USDT:USDT':
                    contracts = pos.get('contracts', 0)
                    if contracts and float(contracts) != 0:
                        has_position = True
                        side = 'LONG' if pos.get('side') == 'long' else 'SHORT' if pos.get('side') == 'short' else None

                        position_state.update({
                            "symbol": pos.get('symbol', 'ETH/USDT:USDT'),
                            "side": side,
                            "size": abs(float(contracts)),
                            "entry_price": float(pos.get('entryPrice', 0)) if pos.get('entryPrice') else 0.0,
                            "mark_price": float(pos.get('markPrice', 0)) if pos.get('markPrice') else 0.0,
                            "unrealized_pnl": float(pos.get('unrealizedPnl', 0)) if pos.get('unrealizedPnl') else 0.0,
                            "leverage": int(pos.get('leverage', 100)) if pos.get('leverage') else 100,
                            "liquidation_price": float(pos.get('liquidationPrice', 0)) if pos.get('liquidationPrice') else 0.0,
                            "last_updated": datetime.now().isoformat()
                        })
                        break

            if not has_position:
                position_state.update({
                    "side": None, "size": 0.0, "entry_price": 0.0,
                    "mark_price": 0.0, "unrealized_pnl": 0.0,
                    "leverage": 100, "liquidation_price": 0.0,
                    "last_updated": datetime.now().isoformat()
                })
        else:
            position_state.update({
                "side": None, "size": 0.0, "entry_price": 0.0,
                "mark_price": 0.0, "unrealized_pnl": 0.0,
                "last_updated": datetime.now().isoformat()
            })

        update_source_health("okx_position", success=True)
    except Exception as e:
        update_source_health("okx_position", success=False, error=e)

def get_market() -> Dict[str, Any]:
    """获取市场行情（v41 增强：记录健康状态）"""
    try:
        t = exchange.fetch_ticker('ETH/USDT:USDT')
        vol = t.get('quoteVolume', 0) or 0

        update_source_health("market", success=True)

        return {
            'price': f"${t['last']:,.2f}",
            'change': round(t.get('percentage',0) or 0, 2),
            'volume': f"${vol/1e6:.1f}M",
            'regime': 'trend' if abs(t.get('percentage',0) or 0) > 1 else 'range'
        }
    except Exception as e:
        update_source_health("market", success=False, error=e)
        return {'price': 'N/A', 'change': 0, 'volume': 'N/A', 'regime': 'error'}

# 后台数据更新线程
def compute_risk_state(control: Dict, stats: Dict, capital: Dict) -> Dict:
    """计算风险状态（v42 新增）"""
    reasons = []
    
    mode = control.get("mode", "observe_only")
    can_open = control.get("can_open", False)
    can_close = control.get("can_close", True)
    circuit_breaker = control.get("circuit_breaker", False)
    
    max_daily_loss = float(control.get("max_daily_loss", 0) or 0)
    max_daily_trades = int(control.get("max_daily_trades", 0) or 0)
    
    # 模拟当日统计（从 stats 或其他源获取真实值）
    current_daily_loss = float(stats.get("daily_pnl", 0) or 0) * -1  # 亏损为正
    daily_trades = int(stats.get("daily_trades", 0) or 0)
    
    equity = float(capital.get("equity", 0) or 0)
    daily_loss_pct = (current_daily_loss / equity * 100) if equity > 0 else 0
    
    # 模式限制
    if mode == "observe_only":
        reasons.append("observe_only_mode")
    
    if not can_open:
        reasons.append("open_disabled")
    
    if not can_close:
        reasons.append("close_disabled")
    
    if circuit_breaker:
        reasons.append("circuit_breaker")
    
    # 日亏损限制
    if max_daily_loss > 0 and current_daily_loss >= max_daily_loss:
        reasons.append("max_daily_loss_reached")
        circuit_breaker = True
    
    # 日交易次数限制
    if max_daily_trades > 0 and daily_trades >= max_daily_trades:
        reasons.append("max_daily_trades_reached")
    
    # 闸门状态
    if circuit_breaker or (not can_open and not can_close):
        gate_status = "blocked"
    elif reasons:
        gate_status = "restricted"
    else:
        gate_status = "open"
    
    return {
        "mode": mode,
        "can_open": can_open,
        "can_close": can_close,
        "circuit_breaker": circuit_breaker,
        "max_daily_loss": max_daily_loss,
        "current_daily_loss": current_daily_loss,
        "daily_loss_pct": round(daily_loss_pct, 2),
        "daily_trades": daily_trades,
        "max_daily_trades": max_daily_trades,
        "gate_status": gate_status,
        "gate_reasons": reasons,
        "last_control_change_ts": control.get("updated_at"),
        "last_control_action": control.get("updated_by")
    }

def build_snapshot() -> Dict[str, Any]:
    """构建统一快照（v41 新增，B1+B2 观测性增强：Freshness 追踪）"""
    now_ts = datetime.now().isoformat()
    now = datetime.now()
    
    # 采集数据
    fetch_capital()
    fetch_position()
    market = get_market()
    
    # B1+B2: 更新 freshness 追踪（OKX 数据）
    if FreshnessTracker:
        update_freshness("okx_capital", now)
        update_freshness("okx_position", now)
        update_freshness("market", now)
    
    # 每 30 秒加载一次日志数据
    if worker_state.get('counter', 0) % 6 == 0:
        load_evolution()
        load_structure()
        load_decisions()
        
        # B1+B2: 更新 freshness 追踪（日志数据）
        if FreshnessTracker:
            update_freshness("decision_log", now)
            update_freshness("evolution_log", now)
    
    # 构建快照
    health = build_health_status()
    risk = compute_risk_state(control, {}, capital_state)
    
    # P1-2 重构：build_alerts 现在接受 raw dict
    raw_for_alerts = {"health": health, "risk": risk}
    alerts, alert_summary = build_alerts(raw_for_alerts)
    
    snapshot = {
        "snapshot_ts": now_ts,
        "as_of": now_ts,
        "symbol": position_state.get("symbol", "ETH/USDT:USDT"),
        "market": market,
        "capital": dict(capital_state),
        "position": dict(position_state),
        "evolution": dict(evolution_state),
        "structure": dict(structure_state),
        "decision": dict(decision_state),
        "control": dict(control),
        "risk": risk,  # v42 新增
        "decision_explain": build_decision_explain(decision_state, structure_state, {}, position_state),  # v43 新增
        "charts": {
            "evolution_history": get_evolution_history(),
            "decision_distribution": get_decision_distribution(),
            "pnl_history": get_pnl_history(),
            "equity_history": get_equity_history(),  # v43 新增
            "drawdown_history": get_drawdown_history(),  # v43 新增
        },
        "health": health,
        "alerts": alerts,  # P1-2 重构
        "alert_summary": alert_summary,  # P1-2 重构
    }
    
    return snapshot

def make_alert(level: str, type_: str, title: str, message: str, source: str = None, context: Dict = None, ts: str = None, dedup_count: int = 1) -> Dict:
    """创建标准化告警（v43 新增，P1-2 增强：添加 dedup_count）"""
    return {
        "ts": ts or datetime.now().isoformat(),
        "level": level,  # INFO/WARN/CRITICAL
        "type": type_,
        "source": source,
        "title": title,
        "message": message,
        "context": context or {},
        "dedup_count": dedup_count  # P1-2 新增：累计次数
    }


def alert_key(issue: Dict) -> str:
    """
    生成告警唯一键（P1-2 新增）
    
    键组成：type|source|title
    不把 message 放入 key，避免 message 轻微变化导致去重失败
    """
    return f"{issue.get('type', '')}|{issue.get('source', '')}|{issue.get('title', '')}"


def should_emit_alert(issue: Dict, now_ts: float) -> Tuple[bool, int]:
    """
    判断是否允许发射告警（P1-2 新增）
    
    返回：(should_emit, merged_count)
    - should_emit: 是否应该发射
    - merged_count: 累计次数
    """
    key = alert_key(issue)
    state = alert_cooldowns.get(key)
    
    if not state:
        # 首次出现，立即发射
        alert_cooldowns[key] = {
            "last_emit_ts": now_ts,
            "count": 1,
            "last_message": issue.get("message", ""),
        }
        return True, 1
    
    elapsed = now_ts - state["last_emit_ts"]
    state["count"] += 1
    state["last_message"] = issue.get("message", "")
    
    if elapsed >= ALERT_COOLDOWN_SEC:
        # 冷却时间已过，可以发射
        state["last_emit_ts"] = now_ts
        return True, state["count"]
    
    # 仍在冷却期内，不发射
    return False, state["count"]


def parse_ts(ts_str: str) -> Optional[float]:
    """解析 ISO 时间戳（P1-2 新增）"""
    if not ts_str:
        return None
    try:
        dt = datetime.fromisoformat(ts_str)
        return dt.timestamp()
    except:
        return None


def alert_sort_key(alert: Dict) -> tuple:
    """
    告警排序键（P1-2 新增）
    
    排序规则：
    1. 级别优先：CRITICAL > WARN > INFO
    2. 时间倒序：新的在前
    """
    return (
        LEVEL_PRIORITY.get(alert.get("level", "INFO"), 9),
        -(parse_ts(alert.get("ts")) or 0),
    )


def update_active_alerts(current_issues: List[Dict], now_ts: float) -> List[Dict]:
    """
    更新活跃告警并生成待发射列表（P1-2 新增）
    
    功能：
    1. 追踪活跃告警状态
    2. 应用冷却/去重逻辑
    3. 检测恢复事件
    
    返回：待发射的告警列表
    """
    emitted = []
    current_keys = set()
    
    # 处理当前存在的问题
    for issue in current_issues:
        key = alert_key(issue)
        current_keys.add(key)
        
        # 更新活跃告警状态
        state = active_alerts.get(key)
        if not state:
            # 新告警
            active_alerts[key] = {
                **issue,
                "first_seen_ts": now_ts,
                "last_seen_ts": now_ts,
                "count": 1,
            }
        else:
            # 已存在，更新
            state["last_seen_ts"] = now_ts
            state["count"] += 1
        
        # 判断是否应该发射
        should_emit, merged_count = should_emit_alert(issue, now_ts)
        if should_emit:
            alert = dict(issue)
            alert["dedup_count"] = merged_count
            if merged_count > 1:
                alert["message"] = f"{issue.get('message', '')} (近阶段累计 {merged_count} 次)"
            emitted.append(alert)
    
    # 检测恢复：之前活跃、现在消失
    previous_keys = list(active_alerts.keys())
    for key in previous_keys:
        if key not in current_keys:
            old = active_alerts.pop(key)
            # 发送恢复事件
            emitted.append({
                "ts": datetime.fromtimestamp(now_ts).isoformat(),
                "level": "INFO",
                "type": f"{old.get('type', 'unknown')}_recovered",
                "source": old.get("source"),
                "title": f"{old.get('title', '告警')}已恢复",
                "message": "状态已恢复正常",
                "context": {
                    "previous_level": old.get("level"),
                    "active_count": old.get("count", 1),
                },
                "dedup_count": 1,
            })
            # 清理冷却状态
            alert_cooldowns.pop(key, None)
    
    return emitted


def collect_candidate_issues(raw: Dict) -> List[Dict]:
    """
    收集候选问题（P1-2 新增）
    
    这一步只负责识别问题，不处理去重/冷却。
    返回原始问题列表，由 update_active_alerts 处理发射逻辑。
    """
    issues = []
    now_ts = datetime.now().isoformat()
    
    health = raw.get("health", {})
    risk = raw.get("risk", {})
    
    # Worker 心跳检查
    if not health.get("worker_alive", True):
        issues.append({
            "level": "CRITICAL",
            "type": "worker_timeout",
            "source": "worker",
            "title": "后台线程超时",
            "message": "后台数据更新线程已超过 15 秒未响应",
            "context": {"last_loop_ts": health.get("worker_state", {}).get("last_loop_ts")},
        })
    
    # 快照年龄检查
    snapshot_age = health.get("snapshot_age_sec", 0)
    if snapshot_age > 60:
        issues.append({
            "level": "CRITICAL",
            "type": "snapshot_stale",
            "source": "snapshot",
            "title": "快照数据过期",
            "message": f"快照数据已 {snapshot_age} 秒未更新",
            "context": {"age_sec": snapshot_age},
        })
    elif snapshot_age > 10:
        issues.append({
            "level": "WARN",
            "type": "snapshot_delayed",
            "source": "snapshot",
            "title": "快照数据延迟",
            "message": f"快照数据延迟 {snapshot_age} 秒",
            "context": {"age_sec": snapshot_age},
        })
    
    # 数据源健康检查
    sources = health.get("sources", {})
    for source_name, source_health in sources.items():
        fail_count = source_health.get("fail_count", 0)
        status = source_health.get("status", "unknown")
        
        if fail_count >= 3 or status == "error":
            issues.append({
                "level": "CRITICAL",
                "type": "source_failure",
                "source": source_name,
                "title": f"{source_name} 连续失败",
                "message": f"{source_name} 已连续失败 {fail_count} 次",
                "context": {"fail_count": fail_count, "last_error": source_health.get("last_error")},
            })
        elif fail_count == 1 or status == "warn":
            issues.append({
                "level": "WARN",
                "type": "source_degraded",
                "source": source_name,
                "title": f"{source_name} 降级",
                "message": f"{source_name} 数据源状态异常",
                "context": {"status": status, "fail_count": fail_count},
            })
    
    # 风险状态检查
    if risk.get("circuit_breaker"):
        issues.append({
            "level": "CRITICAL",
            "type": "circuit_breaker",
            "source": "risk",
            "title": "熔断触发",
            "message": "系统熔断已触发，禁止交易",
            "context": {"gate_status": risk.get("gate_status")},
        })
    
    if risk.get("current_daily_loss", 0) >= risk.get("max_daily_loss", 0) and risk.get("max_daily_loss", 0) > 0:
        issues.append({
            "level": "CRITICAL",
            "type": "max_daily_loss",
            "source": "risk",
            "title": "达到日亏损上限",
            "message": f"当前亏损 {risk.get('current_daily_loss')} USDT，已达上限 {risk.get('max_daily_loss')} USDT",
            "context": {"current": risk.get("current_daily_loss"), "max": risk.get("max_daily_loss")},
        })
    
    if risk.get("daily_trades", 0) >= risk.get("max_daily_trades", 0) and risk.get("max_daily_trades", 0) > 0:
        issues.append({
            "level": "WARN",
            "type": "max_daily_trades",
            "source": "risk",
            "title": "达到日交易次数上限",
            "message": f"当前交易 {risk.get('daily_trades')} 次，已达上限 {risk.get('max_daily_trades')} 次",
            "context": {"current": risk.get("daily_trades"), "max": risk.get("max_daily_trades")},
        })
    
    if risk.get("gate_status") == "blocked":
        issues.append({
            "level": "WARN",
            "type": "gate_blocked",
            "source": "risk",
            "title": "闸门完全关闭",
            "message": "风险闸门已完全禁止交易",
            "context": {"reasons": risk.get("gate_reasons", [])},
        })
    
    return issues

def build_decision_explain(decision_state: Dict, structure_state: Dict, risk_state: Dict, position_state: Dict) -> Dict:
    """构建决策解释（v43 新增）"""
    now_ts = datetime.now().isoformat()
    
    # 从最近决策获取信息
    recent_decisions = decision_state.get("decisions", [])
    last_decision = recent_decisions[-1] if recent_decisions else {}
    
    # 提取字段
    last_action = last_decision.get("result", last_decision.get("decision", "hold"))
    confidence = float(last_decision.get("confidence", structure_state.get("confidence", 0.5)))
    signal = last_decision.get("signal", "none")
    structure_bias = structure_state.get("trend", "中性")
    position_state_val = position_state.get("side") or "FLAT"
    
    # 风险检查状态
    gate_status = risk_state.get("gate_status", "open")
    gate_reasons = risk_state.get("gate_reasons", [])
    
    if gate_status == "blocked":
        risk_check = "rejected"
    elif gate_status == "restricted":
        risk_check = "limited"
    else:
        risk_check = "passed"
    
    # 原因列表
    reasons = []
    if last_decision.get("reason"):
        reasons.append(last_decision["reason"])
    reasons.extend(gate_reasons)
    
    # 生成摘要
    if last_action in ["buy", "BUY", "LONG"]:
        if risk_check == "passed":
            summary = "多头信号成立，风控通过，允许执行"
        elif risk_check == "limited":
            summary = "多头信号成立，但存在部分限制"
        else:
            summary = "多头信号成立，但因风控被拒绝"
    elif last_action in ["sell", "SELL", "SHORT"]:
        if risk_check == "passed":
            summary = "空头信号成立，风控通过，允许执行"
        elif risk_check == "limited":
            summary = "空头信号成立，但存在部分限制"
        else:
            summary = "空头信号成立，但因风控被拒绝"
    elif last_action in ["reject_long", "REJECT_LONG"]:
        summary = f"多头信号出现，但因{'、'.join(reasons[:2]) or '风控'}被拒绝"
    elif last_action in ["reject_short", "REJECT_SHORT"]:
        summary = f"空头信号出现，但因{'、'.join(reasons[:2]) or '风控'}被拒绝"
    else:
        summary = "当前无明确入场信号，维持观望"
    
    # 原因中文映射
    reason_labels = {
        "observe_only_mode": "观察模式",
        "open_disabled": "已禁开仓",
        "close_disabled": "已禁平仓",
        "circuit_breaker": "熔断中",
        "max_daily_loss_reached": "达到日亏损上限",
        "max_daily_trades_reached": "达到日交易次数上限",
        "volatility_high": "波动率过高",
        "position_exists": "已有持仓",
        "structure_range": "当前结构震荡",
    }
    
    labeled_reasons = [reason_labels.get(r, r) for r in reasons]
    
    # 构建决策解释结果
    decision_explain = {
        "as_of": now_ts,
        "last_action": last_action,
        "confidence": round(confidence, 2),
        "signal": signal,
        "structure_bias": structure_bias,
        "risk_check": risk_check,
        "position_state": position_state_val,
        "reasons": labeled_reasons,
        "summary": summary
    }
    
    # SQLite 双写：记录决策事件
    if SQLITE_DUAL_WRITE_ENABLED and storage:
        try:
            # 标准化动作映射
            normalized_action = "hold"
            if last_action in ["buy", "BUY", "LONG", "ACCEPT", "EXECUTE"]:
                normalized_action = "buy"
            elif last_action in ["sell", "SELL", "SHORT"]:
                normalized_action = "sell"
            elif last_action in ["reject_long", "REJECT_LONG"]:
                normalized_action = "reject_long"
            elif last_action in ["reject_short", "REJECT_SHORT"]:
                normalized_action = "reject_short"
            
            storage.insert_decision_event(
                ts=now_ts,
                raw_action=last_action,
                normalized_action=normalized_action,
                signal=signal if signal != "none" else None,
                confidence=round(confidence, 2),
                structure_bias=structure_bias,
                risk_check=risk_check,
                position_state=position_state_val,
                reasons=labeled_reasons,
                summary=summary,
            )
        except Exception as e:
            print(f"[SQLite 双写失败] insert_decision_event: {e}")
    
    return decision_explain

def render_freshness_badge(age_sec: int) -> Markup:
    """UI-3.9: 渲染统一的 Freshness Badge（使用 CSS 类，返回 Markup 避免 Jinja2 转义）"""
    if age_sec is None:
        return Markup('<span class="badge freshness-neutral">● 未知</span>')
    elif age_sec <= 30:
        return Markup(f'<span class="badge freshness-fresh">● 数据新鲜 ({age_sec}s)</span>')
    elif age_sec <= 60:
        return Markup(f'<span class="badge freshness-delayed">⚠️ 数据延迟 ({age_sec}s)</span>')
    else:
        return Markup(f'<span class="badge freshness-stale">🔴 数据陈旧 ({age_sec}s)</span>')


def build_health_status() -> Dict[str, Any]:
    """构建健康状态（v41 新增，B1+B2 观测性增强：Freshness 指标）"""
    now = datetime.now()
    
    # 计算快照年龄
    snapshot_age = 0
    if latest_snapshot.get("snapshot_ts"):
        try:
            last_ts = datetime.fromisoformat(latest_snapshot["snapshot_ts"])
            snapshot_age = (now - last_ts).total_seconds()
        except: pass
    
    # 判断总体状态
    overall = "ok"
    for source_name, health in source_health.items():
        if health.get("status") == "error":
            overall = "error"
            break
        elif health.get("status") == "warn":
            overall = "warn"
    
    # 检查 worker 心跳
    worker_alive = True
    if worker_state.get("last_loop_ts"):
        try:
            last_loop = datetime.fromisoformat(worker_state["last_loop_ts"])
            if (now - last_loop).total_seconds() > 15:
                worker_alive = False
                overall = "error"
        except: pass
    
    # B1+B2: Freshness 指标
    freshness_data = {
        "overall": get_overall_freshness_status() if FreshnessStatus else "unknown",
        "sources": get_all_freshness_statuses() if FreshnessStatus else {},
        "snapshot_age_sec": int(snapshot_age),
        "worker_heartbeat_age_sec": 0,
    }
    
    # 计算 worker 心跳年龄
    if worker_state.get("last_loop_ts"):
        try:
            last_loop = datetime.fromisoformat(worker_state["last_loop_ts"])
            freshness_data["worker_heartbeat_age_sec"] = int((now - last_loop).total_seconds())
        except: pass
    
    return {
        "overall": overall,
        "snapshot_age_sec": int(snapshot_age),
        "worker_alive": worker_alive,
        "sources": source_health,
        "freshness": freshness_data,  # B1+B2 新增
        "server_time": now.isoformat(),  # B1 新增
    }

def background_update():
    """每 5 秒更新一次实时数据并发布快照（v41 重构）"""
    import time
    counter = 0
    
    while True:
        loop_ts = datetime.now().isoformat()
        try:
            # 构建并发布新快照
            snapshot = build_snapshot()
            publish_snapshot(snapshot)
            
            worker_state["last_loop_ts"] = loop_ts
            worker_state["loop_ok"] = True
            worker_state["counter"] = counter
            worker_state["fail_count"] = 0
            
            counter += 1
        except Exception as e:
            # 记录失败但不中断线程
            worker_state["loop_ok"] = False
            worker_state["fail_count"] += 1
            worker_state["last_error"] = str(e)
        
        time.sleep(5)

Thread(target=background_update, daemon=True).start()
load_control()

# -----------------------------------------------------------------------------
# Adapter helpers

def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value in (None, "", "--"):
            return default
        return float(value)
    except Exception:
        return default


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        if value in (None, "", "--"):
            return default
        return int(value)
    except Exception:
        return default


def _pct(value: Any, digits: int = 1) -> str:
    return f"{_safe_float(value):.{digits}f}%"


def _money(value: Any, digits: int = 2, currency: str = "USDT") -> str:
    return f"{_safe_float(value):,.{digits}f} {currency}"


def _num(value: Any, digits: int = 2) -> str:
    return f"{_safe_float(value):,.{digits}f}"


def _fmt_side(value: Any) -> str:
    if value is None:
        return "FLAT"
    side = str(value).strip().upper()
    if side in {"LONG", "BUY"}:
        return "LONG"
    if side in {"SHORT", "SELL"}:
        return "SHORT"
    return side or "FLAT"


def _state_badge(kind: str, value: Any) -> str:
    if kind == "side":
        side = _fmt_side(value)
        if side == "LONG":
            return "side-long"
        if side == "SHORT":
            return "side-short"
        return "state-neutral"
    if kind == "pnl":
        num = _safe_float(value)
        if num > 0:
            return "pnl-positive"
        if num < 0:
            return "pnl-negative"
        return "state-neutral"
    if kind == "health":
        return {
            "ok": "state-ok",
            "warn": "state-warn",
            "error": "state-error",
        }.get(str(value), "state-neutral")
    return "state-neutral"


def adapt_stats_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize existing panel_v40-style payload into cockpit view model.

    Compatible with keys described by the user:
    - structure_state / structure
    - decision_state / decision
    - evolution_state / evolution
    - capital_state / capital
    - position_state / position
    """
    market = payload.get("market", {}) or {}
    control_data = payload.get("control", {}) or payload.get("control_state", {}) or {}
    structure = payload.get("structure") or payload.get("structure_state") or {}
    decision = payload.get("decision") or payload.get("decision_state") or {}
    evolution = payload.get("evolution") or payload.get("evolution_state") or {}
    capital = payload.get("capital") or payload.get("capital_state") or {}
    position = payload.get("position") or payload.get("position_state") or {}

    total_trades = _safe_int(payload.get("total_trades"))
    wins = _safe_int(payload.get("wins"))
    losses = _safe_int(payload.get("losses"))
    win_rate = (wins / total_trades * 100.0) if total_trades > 0 else 0.0

    realized = _safe_float(capital.get("realized_pnl", payload.get("total_pnl", 0.0)))
    unrealized = _safe_float(capital.get("unrealized_pnl", position.get("unrealized_pnl", 0.0)))
    side = _fmt_side(position.get("side"))

    confidence_raw = structure.get("confidence")
    confidence_pct = _safe_float(confidence_raw) * 100 if _safe_float(confidence_raw) <= 1 else _safe_float(confidence_raw)
    approval_rate = _safe_float(decision.get("approval_rate"))
    best_fitness = _safe_float(evolution.get("best_fitness"))

    risk_state = "warn"
    if _safe_float(control_data.get("frozen", False)):
        risk_state = "error"
    elif _safe_float(structure.get("score", 50)) >= 70 and confidence_pct >= 60:
        risk_state = "ok"

    recent_decisions = decision.get("decisions") or []
    recent_trades = payload.get("trades") or []
    charts = payload.get("charts", {})
    alerts = payload.get("alerts", [])

    return {
        "as_of": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "symbol": position.get("symbol") or "ETH/USDT:USDT",
        "market": {
            "price": market.get("price", "--"),
            "change": market.get("change", 0.0),
            "volume": market.get("volume", "--"),
            "regime": market.get("regime") or structure.get("structure") or "unknown",
        },
        "summary": {
            "bias": structure.get("trend", "中性"),
            "regime": structure.get("structure", "未知"),
            "confidence_pct": confidence_pct,
            "risk_state": risk_state,
            "approval_rate": approval_rate,
            "win_rate": win_rate,
            "best_fitness": best_fitness,
        },
        "position": {
            "side": side,
            "size": _safe_float(position.get("size")),
            "entry_price": _safe_float(position.get("entry_price")),
            "mark_price": _safe_float(position.get("mark_price")),
            "unrealized_pnl": unrealized,
            "leverage": _safe_int(position.get("leverage", 0)),
            "liquidation_price": _safe_float(position.get("liquidation_price")),
        },
        "capital": {
            "equity": _safe_float(capital.get("equity")),
            "available": _safe_float(capital.get("available")),
            "margin": _safe_float(capital.get("margin")),
            "realized_pnl": realized,
            "unrealized_pnl": unrealized,
            "currency": capital.get("currency", "USDT"),
        },
        "control": {
            "enabled": bool(control_data.get("enabled", True)),
            "frozen": bool(control_data.get("frozen", False)),
            "threshold": _safe_int(control_data.get("threshold", 0)),
        },
        "evolution": {
            "generation": _safe_int(evolution.get("generation", 0)),
            "best_fitness": best_fitness,
            "population_size": _safe_int(evolution.get("population_size", 0)),
            "status": evolution.get("status", "--"),
            "total_mutations": _safe_int(evolution.get("total_mutations", 0)),
            "evolution_speed": _safe_float(evolution.get("evolution_speed", 0)),
            "latest_params": evolution.get("latest_params") or {},
            "performance": evolution.get("performance") or {},
        },
        "structure": {
            "trend": structure.get("trend", "中性"),
            "volatility": structure.get("volatility", "中等"),
            "structure": structure.get("structure", "未知"),
            "score": _safe_int(structure.get("score", 0)),
            "confidence_pct": confidence_pct,
            "signals": structure.get("signals") or [],
        },
        "decision": {
            "total": _safe_int(decision.get("total", total_trades)),
            "approved": _safe_int(decision.get("approved", 0)),
            "rejected": _safe_int(decision.get("rejected", 0)),
            "approval_rate": approval_rate,
            "recent_decisions": recent_decisions[:8],
        },
        "recent_trades": recent_trades[:8],
        "charts": charts,
        "alerts": alerts,
        "health": payload.get("health", {}),
        "risk": payload.get("risk", {}),  # v42 新增
        "decision_explain": payload.get("decision_explain", {}),  # v43 新增
        "alerts": payload.get("alerts", []),  # v43 重构
        "alert_summary": payload.get("alert_summary", {}),  # v43 新增
        "raw": payload,
    }



def build_cockpit_payload() -> Dict[str, Any]:
    """聚合所有面板数据"""
    stats = load_stats() or {}
    market = get_market() or {}
    
    # 加载实时数据
    fetch_capital()
    fetch_position()
    
    payload = dict(stats)
    payload["market"] = market
    payload["control"] = dict(control)
    payload["capital"] = dict(capital_state)
    payload["position"] = dict(position_state)
    payload["evolution"] = dict(evolution_state)
    payload["structure"] = dict(structure_state)
    payload["decision"] = dict(decision_state)
    
    # 添加图表数据
    payload["charts"] = {
        "evolution_history": get_evolution_history(),
        "decision_distribution": get_decision_distribution(),
        "pnl_history": get_pnl_history(),
    }
    
    # 添加告警数据
    payload["alerts"] = get_recent_alerts()
    
    return payload

def get_evolution_history() -> List[Dict[str, Any]]:
    """获取演化历史用于图表"""
    history = []
    lines = read_jsonl_last_lines(EVOLUTION_LOG, 50)
    for obj in lines:
        history.append({
            'generation': obj.get('generation', 0),
            'fitness': obj.get('best_fitness', obj.get('performance', {}).get('score', 0)),
            'timestamp': obj.get('timestamp', '')[:16]
        })
    return history


def get_decision_distribution() -> Dict[str, int]:
    """获取决策分布用于图表"""
    accept = 0
    reject = 0
    DECISION_LOG = Path(__file__).parent / 'logs' / 'decision_log.jsonl'
    lines = read_jsonl_last_lines(DECISION_LOG, 200)
    for obj in lines:
        result = obj.get('decision', obj.get('decision_type', ''))
        if result in ['ACCEPT', '✅ EXECUTE', 'EXECUTE']:
            accept += 1
        else:
            reject += 1
    return {'accept': accept, 'reject': reject}


def get_pnl_history() -> List[Dict[str, Any]]:
    """获取盈亏历史用于图表"""
    data = safe_json_load(V38_STATS, {})
    if not data:
        return []

    trades = data.get('trades', [])[-20:]
    history = []
    cumulative = 0.0
    for i, trade in enumerate(trades):
        pnl = float(trade.get('pnl', 0))
        cumulative += pnl
        history.append({
            'index': i + 1,
            'pnl': pnl,
            'cumulative': cumulative,
            'exit_reason': trade.get('exit_reason', 'UNKNOWN')
        })
    return history


def get_equity_history() -> List[Dict[str, Any]]:
    """获取权益历史用于图表（v43 新增）"""
    data = safe_json_load(V38_STATS, {})
    if not data:
        return []

    trades = data.get('trades', [])[-20:]
    history = []
    # 假设初始权益 1000 USDT（或从 live_state 读取）
    live_state_file = Path(__file__).parent / 'logs' / 'live_state.json'
    initial_equity = 1000.0

    live_data = safe_json_load(live_state_file, {})
    if live_data:
        initial_equity = float(live_data.get('balance', {}).get('usdt_total', 1000.0))

    cumulative = 0.0
    for i, trade in enumerate(trades):
        pnl = float(trade.get('pnl', 0))
        cumulative += pnl
        equity = initial_equity + cumulative
        history.append({
            'index': i + 1,
            'equity': round(equity, 2),
            'pnl': round(cumulative, 4)
        })
    return history


def get_drawdown_history() -> List[Dict[str, Any]]:
    """获取回撤历史用于图表（v43 新增）"""
    data = safe_json_load(V38_STATS, {})
    if not data:
        return []

    trades = data.get('trades', [])[-20:]
    history = []

    # 假设初始权益 1000 USDT
    live_state_file = Path(__file__).parent / 'logs' / 'live_state.json'
    initial_equity = 1000.0

    live_data = safe_json_load(live_state_file, {})
    if live_data:
        initial_equity = float(live_data.get('balance', {}).get('usdt_total', 1000.0))

    cumulative = 0.0
    peak = initial_equity
    for i, trade in enumerate(trades):
        pnl = float(trade.get('pnl', 0))
        cumulative += pnl
        equity = initial_equity + cumulative

        # 更新峰值
        if equity > peak:
            peak = equity

        # 计算回撤（负值表示亏损）
        drawdown = ((equity - peak) / peak * 100) if peak > 0 else 0

        history.append({
            'index': i + 1,
            'drawdown': round(drawdown, 2),
            'equity': round(equity, 2)
        })
    return history

def build_alerts(raw: Dict) -> tuple:
    """
    构建告警列表（P1-2 重构）
    
    新流程：
    1. collect_candidate_issues: 收集候选问题
    2. update_active_alerts: 应用去重/冷却，生成发射列表
    
    返回：(alerts, summary)
    """
    import time
    now_ts = time.time()
    
    # Step 1: 生成候选问题
    issues = collect_candidate_issues(raw)
    
    # Step 2: 经过去重/冷却后变成 alerts
    alerts = update_active_alerts(issues, now_ts)
    
    # 排序
    alerts.sort(key=alert_sort_key)
    
    # 生成摘要
    summary = build_alert_summary(alerts)
    
    # SQLite 双写：只写真正发出的告警（去重/冷却后）
    if SQLITE_DUAL_WRITE_ENABLED and storage and alerts:
        try:
            for alert in alerts:
                storage.insert_alert(
                    ts=alert.get("ts", datetime.now().isoformat()),
                    level=alert.get("level", "INFO"),
                    type_=alert.get("type", "unknown"),
                    source=alert.get("source"),
                    title=alert.get("title", ""),
                    message=alert.get("message", ""),
                    dedup_count=alert.get("dedup_count", 1),
                    context=alert.get("context", {}),
                )
        except Exception as e:
            print(f"[SQLite 双写失败] insert_alert: {e}")
    
    return alerts, summary


def build_alert_summary(alerts: List[Dict]) -> Dict:
    """
    构建告警摘要（P1-2 新增）
    
    返回：{critical: N, warn: N, info: N, total: N}
    """
    critical = sum(1 for a in alerts if a.get("level") == "CRITICAL")
    warn = sum(1 for a in alerts if a.get("level") == "WARN")
    info = sum(1 for a in alerts if a.get("level") == "INFO")
    
    return {
        "critical": critical,
        "warn": warn,
        "info": info,
        "total": len(alerts),
    }

def get_recent_alerts() -> list:
    """获取最近告警（v43 重构：使用 build_alerts）"""
    try:
        # 从日志文件读取历史告警
        ALERTS_LOG = Path(__file__).parent / 'logs' / 'alerts.jsonl'
        if ALERTS_LOG.exists():
            lines = open(ALERTS_LOG).readlines()[-10:]
            alerts = []
            for line in lines:
                try:
                    obj = json.loads(line.strip())
                    alerts.append({
                        'timestamp': obj.get('timestamp', '')[:19].replace('T', ' '),
                        'level': obj.get('level', 'INFO'),
                        'message': obj.get('message', str(obj))
                    })
                except: pass
            return alerts
    except: pass
    return []

INDEX_TEMPLATE = r"""
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>🐉 小龙交易驾驶舱</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    :root {
      /* 色彩系统 - 深色克制风格 */
      --bg-0: #0a0f19;        /* 主背景 */
      --bg-1: #121a27;        /* 卡片背景 */
      --bg-2: #182233;        /* 次级容器 */
      --text-1: #f5f7fb;      /* 主文本 */
      --text-2: #b6c1d1;      /* 次级文本 */
      --text-3: #7f8a9e;      /* 灰色文本 */
      
      /* 状态色 - 语义固定 */
      --danger: #ef4444;      /* CRITICAL */
      --danger-light: rgba(239,68,68,0.15);
      --warning: #f59e0b;     /* WARN */
      --warning-light: rgba(245,158,11,0.15);
      --success: #22c55e;     /* SUCCESS */
      --success-light: rgba(34,197,94,0.15);
      --info: #3b82f6;        /* INFO */
      --info-light: rgba(59,130,246,0.15);
      
      /* 边框系统 */
      --border-1: rgba(255,255,255,0.05);  /* 弱边框 */
      --border-2: rgba(255,255,255,0.1);   /* 中边框 */
      
      /* 阴影系统 */
      --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
      --shadow-md: 0 4px 6px rgba(0,0,0,0.4);
      --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.5);
      
      /* 圆角系统 */
      --radius-lg: 20px;      /* 大卡片 */
      --radius-md: 12px;      /* 小卡片/按钮 */
      --radius-sm: 8px;       /* badge */
      --radius-pill: 999px;   /* pill */
      
      /* 间距系统 */
      --space-xs: 8px;
      --space-sm: 12px;
      --space-md: 18px;
      --space-lg: 24px;
      --space-xl: 32px;
      
      /* ===== UI-3 Lite Tokens ===== */
      /* Top Nav */
      --top-nav-height: 60px;
      --top-nav-bg: var(--bg-1);
      --top-nav-border: var(--border-1);
      
      /* Badge */
      --badge-height: 24px;
      --badge-radius: 6px;
      --badge-padding-x: 10px;
      --badge-padding-y: 4px;
      --badge-font-size: 12px;
      --badge-font-weight: 600;
      
      /* UI-3.7: Freshness Badge */
      --freshness-fresh: #22c55e;
      --freshness-delayed: #f59e0b;
      --freshness-stale: #ef4444;
      --freshness-threshold-fresh: 30;
      --freshness-threshold-delayed: 60;
      
      /* Loading / Empty / Error */
      --spinner-size: 40px;
      --spinner-border-width: 3px;
      --empty-min-height: 120px;
      
      /* Chart Header */
      --chart-title-size: 14px;
      --chart-header-padding: 18px;
      
      /* Hover */
      --hover-transition: 0.2s ease;
      --hover-transform: translateY(-2px);
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      background: radial-gradient(circle at top, #142033 0%, var(--bg-0) 45%);
      color: var(--text-1);
      font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
      padding: var(--space-lg);
      min-height: 100vh;
    }
    
    .shell {
      max-width: 1600px;
      margin: 0 auto;
    }
    
    /* ===== 顶部导航栏 (UI-3 Lite) ===== */
    .top-nav {
      background: var(--top-nav-bg);
      border-bottom: 1px solid var(--top-nav-border);
      padding: 0 var(--space-lg);
      height: var(--top-nav-height);
      min-height: 60px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 9999;
      margin-bottom: var(--space-lg);
      visibility: visible;
      opacity: 1;
    }
    
    /* 导航兜底强约束（防止被覆盖） */
    .top-nav-brand, .top-nav-links {
      visibility: visible;
    }

    .top-nav-brand {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
    }

    .top-nav-brand h1 {
      font-size: 1.2rem;
      font-weight: 700;
      color: var(--info);
    }

    .top-nav-brand span {
      font-size: 12px;
      color: var(--text-3);
    }

    .top-nav-links {
      display: flex;
      gap: var(--space-xs);
    }

    .top-nav-link {
      display: flex;
      align-items: center;
      gap: var(--space-xs);
      padding: 8px 16px;
      color: var(--text-2);
      text-decoration: none;
      border-radius: var(--radius-md);
      font-size: 13px;
      font-weight: 600;
      transition: all var(--hover-transition);
      border: 1px solid transparent;
    }

    .top-nav-link:hover {
      background: var(--bg-2);
      color: var(--text-1);
    }

    .top-nav-link.active {
      background: rgba(59, 130, 246, 0.15);
      color: var(--info);
      border-color: var(--info);
    }
    
    /* ===== Header 体系统一 (UI-3.5) ===== */
    .header {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: var(--space-lg);
      margin-bottom: var(--space-xl);
      padding-bottom: var(--space-md);
      border-bottom: 1px solid var(--border-2);
    }
    
    .header-main {
      display: flex;
      flex-direction: column;
      gap: var(--space-xs);
    }
    
    .header-title {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.02em;
      display: flex;
      align-items: center;
      gap: var(--space-sm);
    }
    
    .header-title .icon {
      font-size: 32px;
    }
    
    .header-subtitle {
      color: var(--text-2);
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      flex-wrap: wrap;
    }
    
    /* 状态组（首页专用） */
    .status-group {
      display: flex;
      gap: var(--space-xs);
      margin-left: var(--space-md);
      padding-left: var(--space-md);
      border-left: 1px solid var(--border-1);
    }
    
    .header-controls {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      flex-wrap: wrap;
    }
    
    .chip, .badge {
      padding: 6px 12px;
      border-radius: var(--radius-pill);
      font-size: 12px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: var(--space-xs);
    }
    
    .chip {
      background: var(--bg-2);
      border: 1px solid var(--border-1);
      color: var(--text-2);
    }
    
    .badge {
      border: 1px solid var(--border-1);
      background: var(--bg-2);
      color: var(--text-2);
    }
    
    /* Badge 状态色 - 语义固定 */
    .badge.state-ok, .badge.pnl-positive, .badge.side-long {
      background: var(--success-light);
      color: var(--success);
      border-color: var(--success);
    }
    
    .badge.state-error, .badge.pnl-negative, .badge.side-short {
      background: var(--danger-light);
      color: var(--danger);
      border-color: var(--danger);
    }
    
    .badge.state-warn {
      background: var(--warning-light);
      color: var(--warning);
      border-color: var(--warning);
    }
    
    .badge.state-neutral {
      background: rgba(255,255,255,0.05);
      color: var(--text-2);
      border-color: var(--border-1);
    }
    
    .badge.side-long, .badge.side-short {
      padding: 8px 16px;
      font-size: 13px;
    }

    /* 网格布局 */
    .grid { display: grid; gap: var(--space-lg); }
    .grid.top { grid-template-columns: 1.35fr 1fr 1fr 1fr; }
    .grid.mid { grid-template-columns: 1.3fr 1fr; margin-top: var(--space-md); }
    .grid.low { grid-template-columns: 1fr 1fr 1fr; margin-top: var(--space-md); }
    
    /* 卡片 - 20px 圆角，渐变边框 */
    .card {
      background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
      border: 1px solid var(--border-2);
      border-radius: var(--radius-lg);
      padding: var(--space-lg);
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
    }
    
    .card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, var(--info), rgba(59,130,246,0.3));
    }
    
    .card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
    }
    
    .card h2, .card h3 {
      margin: 0 0 var(--space-md);
      font-size: 15px;
      color: var(--text-2);
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: var(--space-sm);
    }
    
    .card h2 .icon, .card h3 .icon { font-size: 18px; }
    /* 英雄数据区 */
    .hero-symbol { font-size: 24px; font-weight: 800; margin-bottom: var(--space-xs); }
    .hero-price { font-size: 34px; font-weight: 800; letter-spacing: -0.02em; }
    .hero-change { margin-top: var(--space-sm); display: inline-flex; }
    
    /* KPI 网格 */
    .kpis { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: var(--space-xs); }
    
    .kpi {
      padding: var(--space-sm);
      border-radius: var(--radius-md);
      background: rgba(255,255,255,0.03);
      border: 1px solid var(--border-1);
      transition: all 0.2s ease;
    }
    
    .kpi:hover {
      background: rgba(255,255,255,0.05);
      border-color: var(--border-2);
    }
    
    .kpi-label { color: var(--text-3); font-size: 11px; margin-bottom: var(--space-xs); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
    .kpi-value { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
    
    /* 行布局 */
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-sm);
      padding: var(--space-sm) 0;
      border-bottom: 1px solid var(--border-1);
    }
    
    .row:last-child { border-bottom: 0; }
    .row .label { color: var(--text-3); font-size: 13px; }
    .row .value { font-weight: 700; font-size: 14px; }
    
    .sub { color: var(--text-2); font-size: 12px; }

    /* Tab 切换 */
    .tabs {
      display: flex;
      gap: var(--space-sm);
      margin-bottom: var(--space-md);
      flex-wrap: wrap;
    }
    
    .tab-btn {
      border: 1px solid var(--border-1);
      background: rgba(255,255,255,0.03);
      color: var(--text-2);
      padding: 10px 16px;
      border-radius: var(--radius-pill);
      cursor: pointer;
      font-weight: 700;
      font-size: 13px;
      transition: all 0.2s ease;
    }
    
    .tab-btn:hover {
      background: rgba(255,255,255,0.05);
      border-color: var(--border-2);
    }
    
    .tab-btn.active {
      background: linear-gradient(135deg, var(--info), #2563eb);
      color: white;
      border-color: var(--info);
      box-shadow: 0 4px 12px rgba(59,130,246,0.3);
    }
    
    .tab-panel { display: none; }
    .tab-panel.active { display: block; }
    
    /* 表格 */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    
    th, td {
      padding: var(--space-xs) var(--space-sm);
      border-bottom: 1px solid var(--border-1);
      text-align: left;
      vertical-align: top;
    }
    
    th { color: var(--text-3); font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; padding-top: var(--space-md); padding-bottom: var(--space-xs); }
    td { color: var(--text-2); }
    td.num, th.num { text-align: right; }
    .muted { color: var(--text-3); }
    
    /* 空状态 */
    .empty {
      border: 1px dashed var(--border-2);
      border-radius: var(--radius-md);
      padding: var(--space-lg);
      text-align: center;
      color: var(--text-3);
      background: rgba(255,255,255,0.02);
    }
    
    /* 控制区按钮 */
    .controls { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: var(--space-sm); }
    
    .btn {
      border: 0;
      padding: 12px 16px;
      border-radius: var(--radius-md);
      font-weight: 700;
      cursor: pointer;
      color: white;
      transition: all 0.2s ease;
      font-size: 13px;
    }
    
    .btn-primary { background: linear-gradient(135deg, var(--info), #2563eb); }
    .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(59,130,246,0.4); }
    
    .btn-danger { background: linear-gradient(135deg, var(--danger), #dc2626); }
    .btn-danger:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(239,68,68,0.4); }
    
    .btn-warning { background: linear-gradient(135deg, var(--warning), #d97706); color: #1a1a1a; }
    .btn-warning:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(245,158,11,0.4); }
    
    .btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none !important; }
    
    /* ===== 响应式统一 (UI-3.5) ===== */
    @media (max-width: 1280px) {
      .grid.top, .grid.mid, .grid.low { grid-template-columns: 1fr 1fr; }
      
      .header {
        gap: var(--space-md);
      }
      
      .header-controls {
        justify-content: flex-start;
      }
    }
    
    @media (max-width: 768px) {
      .grid.top, .grid.mid, .grid.low { grid-template-columns: 1fr; }
      
      .header {
        grid-template-columns: 1fr;
        gap: var(--space-md);
      }
      
      .header-title {
        font-size: 22px;
      }
      
      .header-title .icon {
        font-size: 26px;
      }
      
      .header-subtitle {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--space-xs);
      }
      
      .status-group {
        margin-left: 0;
        padding-left: 0;
        border-left: none;
        margin-top: var(--space-xs);
      }
      
      .header-controls {
        flex-direction: column;
        align-items: flex-start;
      }
    }
  </style>
</head>
<body>
  <!-- 顶部导航栏 -->
  <nav class="top-nav">
    <div class="top-nav-brand">
      <h1>🐉 小龙交易系统 V5.4</h1>
      <span>专业金融监控终端</span>
    </div>
    <div class="top-nav-links">
      <a href="/" class="top-nav-link active">
        <span>📊</span>
        <span>驾驶舱</span>
      </a>
      <a href="/history" class="top-nav-link">
        <span>📜</span>
        <span>历史分析</span>
      </a>
      <a href="/reports" class="top-nav-link">
        <span>📈</span>
        <span>报表中心</span>
      </a>
    </div>
  </nav>

  <div class="shell">
    <div class="header">
      <div class="header-main">
        <div class="header-title">
          <span class="icon">🐉</span>
          <span>小龙交易驾驶舱</span>
        </div>
        <div class="header-subtitle">
          <span>实时交易监控与决策分析系统</span>
          <span class="status-group">
            <span class="badge {{ 'state-ok' if vm.control.enabled else 'state-error' }}" id="system-enabled">{{ '系统启用' if vm.control.enabled else '系统关闭' }}</span>
            <span class="badge {{ 'state-error' if vm.control.frozen else 'state-ok' }}" id="system-frozen">{{ '冻结' if vm.control.frozen else '运行中' }}</span>
            <span class="badge {{ 'state-ok' if (vm.health or {}).get('overall') == 'ok' else 'state-warn' if (vm.health or {}).get('overall') == 'warn' else 'state-error' }}" id="health-overall">{{ (vm.health or {}).get('overall') | upper }}</span>
          </span>
        </div>
      </div>
      <div class="header-controls">
        <span class="chip">数据：<span id="as-of">{{ vm.as_of }}</span></span>
        <span class="chip">更新：<span id="last-updated">--:--:--</span></span>
        <span class="chip" id="freshness-badge">{{ render_freshness_badge((vm.health or {}).get('snapshot_age_sec', 0)) }}</span>
      </div>
    </div>

    <div class="grid top">
      <section class="card">
        <h2>市场与决策摘要</h2>
        <div class="hero-symbol" id="hero-symbol">{{ vm.symbol }}</div>
        <div class="hero-price" id="hero-price">{{ vm.market.price }}</div>
        <div class="hero-change badge {{ 'pnl-positive' if vm.market.change > 0 else 'pnl-negative' if vm.market.change < 0 else 'state-neutral' }}" id="hero-change">{{ '%.2f'|format(vm.market.change) }}%</div>
        <div class="kpis" style="margin-top:14px;">
          <div class="kpi"><div class="kpi-label">方向偏置</div><div class="kpi-value" id="summary-bias">{{ vm.summary.bias }}</div></div>
          <div class="kpi"><div class="kpi-label">市场状态</div><div class="kpi-value" id="summary-regime">{{ vm.summary.regime }}</div></div>
          <div class="kpi"><div class="kpi-label">置信度</div><div class="kpi-value" id="summary-confidence">{{ '%.1f'|format(vm.summary.confidence_pct) }}%</div></div>
          <div class="kpi"><div class="kpi-label">风险状态</div><div class="kpi-value"><span class="badge {{ 'state-ok' if vm.summary.risk_state == 'ok' else 'state-warn' if vm.summary.risk_state == 'warn' else 'state-error' }}" id="summary-risk">{{ vm.summary.risk_state|upper }}</span></div></div>
        </div>
      </section>

      <section class="card">
        <h2>当前仓位</h2>
        <div class="kpis">
          <div class="kpi"><div class="kpi-label">方向</div><div class="kpi-value"><span id="position-side" class="badge {{ 'side-long' if vm.position.side == 'LONG' else 'side-short' if vm.position.side == 'SHORT' else 'state-neutral' }}">{{ vm.position.side }}</span></div></div>
          <div class="kpi"><div class="kpi-label">仓位</div><div class="kpi-value" id="position-size">{{ '%.4f'|format(vm.position.size) }}</div></div>
          <div class="kpi"><div class="kpi-label">入场价</div><div class="kpi-value" id="position-entry">{{ '%.2f'|format(vm.position.entry_price) }}</div></div>
          <div class="kpi"><div class="kpi-label">标记价</div><div class="kpi-value" id="position-mark">{{ '%.2f'|format(vm.position.mark_price) }}</div></div>
        </div>
        <div class="row"><span class="label">未实现盈亏</span><span class="value"><span id="position-pnl" class="badge {{ 'pnl-positive' if vm.position.unrealized_pnl > 0 else 'pnl-negative' if vm.position.unrealized_pnl < 0 else 'state-neutral' }}">{{ '%.2f'|format(vm.position.unrealized_pnl) }}</span></span></div>
        <div class="row"><span class="label">杠杆</span><span class="value" id="position-leverage">{{ vm.position.leverage }}x</span></div>
        <div class="row"><span class="label">强平价</span><span class="value" id="position-liquidation">{{ '%.2f'|format(vm.position.liquidation_price) }}</span></div>
      </section>

      <section class="card">
        <h2>资金状态</h2>
        <div class="row"><span class="label">权益</span><span class="value" id="capital-equity">{{ '%.2f'|format(vm.capital.equity) }} {{ vm.capital.currency }}</span></div>
        <div class="row"><span class="label">可用</span><span class="value" id="capital-available">{{ '%.2f'|format(vm.capital.available) }} {{ vm.capital.currency }}</span></div>
        <div class="row"><span class="label">保证金</span><span class="value" id="capital-margin">{{ '%.2f'|format(vm.capital.margin) }} {{ vm.capital.currency }}</span></div>
        <div class="row"><span class="label">已实现盈亏</span><span class="value"><span id="capital-realized" class="badge {{ 'pnl-positive' if vm.capital.realized_pnl > 0 else 'pnl-negative' if vm.capital.realized_pnl < 0 else 'state-neutral' }}">{{ '%.2f'|format(vm.capital.realized_pnl) }}</span></span></div>
        <div class="row"><span class="label">未实现盈亏</span><span class="value"><span id="capital-unrealized" class="badge {{ 'pnl-positive' if vm.capital.unrealized_pnl > 0 else 'pnl-negative' if vm.capital.unrealized_pnl < 0 else 'state-neutral' }}">{{ '%.2f'|format(vm.capital.unrealized_pnl) }}</span></span></div>
      </section>

      <section class="card">
        <h2>系统健康</h2>
        <div class="row"><span class="label">自动交易</span><span class="value"><span class="badge {{ 'state-ok' if vm.control.enabled else 'state-error' }}" id="health-enabled">{{ '开启' if vm.control.enabled else '关闭' }}</span></span></div>
        <div class="row"><span class="label">冻结状态</span><span class="value"><span class="badge {{ 'state-error' if vm.control.frozen else 'state-ok' }}" id="health-frozen">{{ '已冻结' if vm.control.frozen else '正常' }}</span></span></div>
        <div class="row"><span class="label">阈值</span><span class="value" id="health-threshold">{{ vm.control.threshold }}</span></div>
        <div class="row"><span class="label">通过率</span><span class="value" id="health-approval">{{ '%.1f'|format(vm.summary.approval_rate) }}%</span></div>
        <div class="row"><span class="label">胜率</span><span class="value" id="health-winrate">{{ '%.1f'|format(vm.summary.win_rate) }}%</span></div>
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08);">
          <div class="row"><span class="label">OKX 余额</span><span class="value"><span class="badge state-ok" id="health-okx-capital">OK</span></span></div>
          <div class="row"><span class="label">OKX 持仓</span><span class="value"><span class="badge state-ok" id="health-okx-position">OK</span></span></div>
          <div class="row"><span class="label">市场行情</span><span class="value"><span class="badge state-ok" id="health-market">OK</span></span></div>
          <div class="row"><span class="label">决策日志</span><span class="value"><span class="badge state-ok" id="health-decision">OK</span></span></div>
        </div>
      </section>
      <!-- 决策解释面板（v43 新增） -->
      <section class="card">
        <h2>决策解释</h2>
        <div class="row"><span class="label">最后动作</span><span class="value" id="decision-action">{{ vm.decision_explain.last_action or 'hold' }}</span></div>
        <div class="row"><span class="label">置信度</span><span class="value" id="decision-confidence">{{ vm.decision_explain.confidence or 0 }}</span></div>
        <div class="row"><span class="label">信号</span><span class="value" id="decision-signal">{{ vm.decision_explain.signal or 'none' }}</span></div>
        <div class="row"><span class="label">结构判断</span><span class="value" id="decision-structure">{{ vm.decision_explain.structure_bias or '中性' }}</span></div>
        <div class="row"><span class="label">风控检查</span><span class="value"><span class="badge {{ 'state-ok' if vm.decision_explain.risk_check == 'passed' else 'state-warn' if vm.decision_explain.risk_check == 'limited' else 'state-error' }}" id="decision-risk">{{ vm.decision_explain.risk_check or 'unknown' }}</span></span></div>
        <div class="row"><span class="label">持仓状态</span><span class="value" id="decision-position">{{ vm.decision_explain.position_state or 'FLAT' }}</span></div>
        <div style="margin-top: 12px;">
          <h4>原因</h4>
          {% if vm.decision_explain.reasons %}
            {% for reason in vm.decision_explain.reasons %}
              <span class="badge state-warn">{{ reason }}</span>
            {% endfor %}
          {% else %}
            <span class="badge state-ok">无特殊原因</span>
          {% endif %}
        </div>
        <div style="margin-top: 12px; padding: 12px; background: rgba(255,255,255,0.03); border-radius: 8px;">
          <div style="color: var(--text-3); font-size: 12px; margin-bottom: 6px;">摘要</div>
          <div style="color: var(--text-1); font-weight: 600;" id="decision-summary">{{ vm.decision_explain.summary or '当前无明确决策' }}</div>
        </div>
      </section>
      <!-- 风险闸门面板（v42 新增） -->
      <section class="card">
        <h2>风险闸门 <span class="badge {{ 'state-ok' if vm.risk.gate_status == 'open' else 'state-warn' if vm.risk.gate_status == 'restricted' else 'state-error' }}" id="risk-gate-status">{{ vm.risk.gate_status | upper }}</span></h2>
        <div class="row"><span class="label">模式</span><span class="value" id="risk-mode">{{ vm.risk.mode }}</span></div>
        <div class="row"><span class="label">开仓</span><span class="value"><span class="badge {{ 'state-ok' if vm.risk.can_open else 'state-error' }}" id="risk-can-open">{{ '允许' if vm.risk.can_open else '禁止' }}</span></span></div>
        <div class="row"><span class="label">平仓</span><span class="value"><span class="badge {{ 'state-ok' if vm.risk.can_close else 'state-error' }}" id="risk-can-close">{{ '允许' if vm.risk.can_close else '禁止' }}</span></span></div>
        <div class="row"><span class="label">熔断</span><span class="value"><span class="badge {{ 'state-error' if vm.risk.circuit_breaker else 'state-ok' }}" id="risk-circuit">{{ '触发' if vm.risk.circuit_breaker else '正常' }}</span></span></div>
        <div class="row"><span class="label">日亏损</span><span class="value" id="risk-daily-loss">{{ vm.risk.current_daily_loss }} / {{ vm.risk.max_daily_loss }} USDT</span></div>
        <div class="row"><span class="label">日交易</span><span class="value" id="risk-daily-trades">{{ vm.risk.daily_trades }} / {{ vm.risk.max_daily_trades }}</span></div>
        <div style="margin-top: 12px;">
          <h4>限制原因</h4>
          {% if vm.risk.gate_reasons %}
            {% for reason in vm.risk.gate_reasons %}
              <span class="badge state-warn">{{ reason }}</span>
            {% endfor %}
          {% else %}
            <span class="badge state-ok">无限制</span>
          {% endif %}
        </div>
        <div class="controls" style="margin-top: 16px;">
          <button class="btn btn-primary" onclick="sendControlAction('open_all')">允许开平仓</button>
          <button class="btn btn-warning" onclick="sendControlAction('close_opening')">仅允许平仓</button>
          <button class="btn btn-danger" onclick="sendControlAction('block_all')">全禁用</button>
          <button class="btn btn-secondary" onclick="sendControlAction('reset_circuit_breaker')">重置熔断</button>
        </div>
      </section>
    </div>

    <div class="card" style="margin-top:16px;">
      <div class="tabs">
        <button class="tab-btn active" data-tab="market">市场与决策</button>
        <button class="tab-btn" data-tab="evolution">演化引擎</button>
        <button class="tab-btn" data-tab="control">系统控制</button>
      </div>

      <div class="tab-panel active" id="tab-market">
        <div class="grid mid">
          <section>
            <h3>Recent Trades</h3>
            <div id="trades-wrap">
              {% if vm.recent_trades %}
              <table>
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>方向</th>
                    <th>操作</th>
                    <th class="num">入场</th>
                    <th class="num">出场</th>
                    <th class="num">仓位</th>
                    <th class="num">盈亏</th>
                    <th>原因</th>
                  </tr>
                </thead>
                <tbody id="trades-body">
                  {% for t in vm.recent_trades %}
                  <tr>
                    <td>{{ t.time or '--' }}</td>
                    <td><span class="badge {{ 'side-long' if (t.side or '')|upper == 'LONG' else 'side-short' if (t.side or '')|upper == 'SHORT' else 'state-neutral' }}">{{ t.side or '--' }}</span></td>
                    <td>{{ t.action or '--' }}</td>
                    <td class="num">{{ '%.2f'|format((t.entry or 0)|float) if t.entry is not none else '--' }}</td>
                    <td class="num">{{ '%.2f'|format((t.exit or 0)|float) if t.exit is not none else '--' }}</td>
                    <td class="num">{{ '%.4f'|format((t.size or 0)|float) }}</td>
                    <td class="num"><span class="badge {{ 'pnl-positive' if (t.pnl or 0)|float > 0 else 'pnl-negative' if (t.pnl or 0)|float < 0 else 'state-neutral' }}">{{ '%.2f'|format((t.pnl or 0)|float) }}</span></td>
                    <td class="muted">{{ t.reason or '--' }}</td>
                  </tr>
                  {% endfor %}
                </tbody>
              </table>
              {% else %}
              <div class="empty">暂无交易记录</div>
              {% endif %}
            </div>
          </section>
          <section>
            <h3>权益曲线</h3>
            <div style="height: 220px; position: relative;">
              <canvas id="equityChart"></canvas>
            </div>
            <h3 style="margin-top: 16px;">回撤曲线</h3>
            <div style="height: 220px; position: relative;">
              <canvas id="drawdownChart"></canvas>
            </div>
            <h3 style="margin-top: 16px;">盈亏走势</h3>
            <div style="height: 200px; position: relative;">
              <canvas id="pnlChart"></canvas>
            </div>
          </section>
          <section>
            <h3>决策与结构</h3>
            <div class="row"><span class="label">趋势</span><span class="value" id="structure-trend">{{ vm.structure.trend }}</span></div>
            <div class="row"><span class="label">波动性</span><span class="value" id="structure-volatility">{{ vm.structure.volatility }}</span></div>
            <div class="row"><span class="label">结构</span><span class="value" id="structure-structure">{{ vm.structure.structure }}</span></div>
            <div class="row"><span class="label">结构评分</span><span class="value" id="structure-score">{{ vm.structure.score }}</span></div>
            <div class="row"><span class="label">置信度</span><span class="value" id="structure-confidence">{{ '%.1f'|format(vm.structure.confidence_pct) }}%</span></div>
            <div class="row"><span class="label">决策数</span><span class="value" id="decision-total">{{ vm.decision.total }}</span></div>
            <div class="row"><span class="label">通过/拒绝</span><span class="value" id="decision-split">{{ vm.decision.approved }} / {{ vm.decision.rejected }}</span></div>
            <div style="margin-top:14px;">
              <h3 style="margin-bottom:10px;">最近决策</h3>
              {% if vm.decision.recent_decisions %}
                {% for d in vm.decision.recent_decisions %}
                <div class="row">
                  <div>
                    <div class="value">{{ d.result or '--' }}</div>
                    <div class="sub">{{ d.reason or '--' }}</div>
                  </div>
                  <div class="muted">{{ d.time or '--' }}</div>
                </div>
                {% endfor %}
              {% else %}
              <div class="empty">暂无决策记录</div>
              {% endif %}
            </div>
          </section>
        </div>
      </div>

      <div class="tab-panel" id="tab-evolution">
        <div class="grid low">
          <section class="card">
            <h3>演化摘要</h3>
            <div class="row"><span class="label">代数</span><span class="value" id="evo-generation">{{ vm.evolution.generation }}</span></div>
            <div class="row"><span class="label">最佳适应度</span><span class="value" id="evo-fitness">{{ '%.3f'|format(vm.evolution.best_fitness) }}</span></div>
            <div class="row"><span class="label">种群规模</span><span class="value" id="evo-population">{{ vm.evolution.population_size }}</span></div>
            <div class="row"><span class="label">状态</span><span class="value" id="evo-status">{{ vm.evolution.status }}</span></div>
            <div class="row"><span class="label">变异次数</span><span class="value" id="evo-mutations">{{ vm.evolution.total_mutations }}</span></div>
            <div class="row"><span class="label">速度</span><span class="value" id="evo-speed">{{ '%.2f'|format(vm.evolution.evolution_speed) }}</span></div>
          </section>
          <section class="card">
            <h3>最新参数</h3>
            {% if vm.evolution.latest_params %}
              {% for k, v in vm.evolution.latest_params.items() %}
              <div class="row"><span class="label">{{ k }}</span><span class="value">{{ v }}</span></div>
              {% endfor %}
            {% else %}
              <div class="empty">暂无参数</div>
            {% endif %}
          </section>
          <section class="card">
            <h3>绩效</h3>
            {% if vm.evolution.performance %}
              {% for k, v in vm.evolution.performance.items() %}
              <div class="row"><span class="label">{{ k }}</span><span class="value">{{ v }}</span></div>
              {% endfor %}
            {% else %}
              <div class="empty">暂无演化绩效</div>
            {% endif %}
          </section>
        </div>
      </div>

      <div class="tab-panel" id="tab-control">
        <div class="grid mid">
          <section>
            <h3>系统控制</h3>
            <div class="controls">
              <button class="btn btn-primary" onclick="sendControl('enable')">启用</button>
              <button class="btn btn-warning" onclick="sendControl('disable')">禁用</button>
              <button class="btn btn-warning" onclick="sendControl('freeze')">冻结</button>
              <button class="btn btn-danger" onclick="sendControl('emergency')">紧急停止</button>
            </div>
          </section>
          <section>
            <h3>控制说明</h3>
            <div class="row"><span class="label">端口</span><span class="value">8780</span></div>
            <div class="row"><span class="label">数据源</span><span class="value">ccxt / 现有后端</span></div>
            <div class="row"><span class="label">兼容性</span><span class="value">structure_state / decision_state / evolution_state</span></div>
            <div class="row"><span class="label">策略</span><span class="value">无真实字段时显示空值，不伪造实时趋势</span></div>
          </section>
        </div>
        <div class="card" style="margin-top: 16px;">
          <h3>最近告警 
            {% if vm.alert_summary %}
              <span class="badge state-error" style="margin-left: 8px;">CRITICAL {{ vm.alert_summary.critical or 0 }}</span>
              <span class="badge state-warn" style="margin-left: 4px;">WARN {{ vm.alert_summary.warn or 0 }}</span>
              <span class="badge state-info" style="margin-left: 4px;">INFO {{ vm.alert_summary.info or 0 }}</span>
            {% endif %}
          </h3>
          {% if vm.alerts %}
            <div style="max-height: 300px; overflow-y: auto;">
              {% for alert in vm.alerts %}
              <div class="row" style="border-left: 3px solid {{ '#ef4444' if alert.level == 'CRITICAL' else '#f59e0b' if alert.level == 'WARN' else '#3b82f6' }}; padding-left: 10px; margin-bottom: 8px;">
                <div>
                  <div style="font-weight: 600; font-size: 13px; margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
                    {{ alert.title or alert.type }}
                    {% if alert.dedup_count and alert.dedup_count > 1 %}
                      <span class="badge state-warn" style="font-size: 11px; padding: 2px 6px;">连续 {{ alert.dedup_count }}</span>
                    {% endif %}
                  </div>
                  <div class="value" style="font-size: 12px;">{{ alert.message[:100] }}{% if alert.message|length > 100 %}...{% endif %}</div>
                  <div class="sub" style="margin-top: 4px;">{{ alert.ts[:19].replace('T', ' ') if alert.ts else '--' }}</div>
                </div>
                <span class="badge {{ 'state-error' if alert.level == 'CRITICAL' else 'state-warn' if alert.level == 'WARN' else 'state-info' }}">{{ alert.level }}</span>
              </div>
              {% endfor %}
            </div>
          {% else %}
            <div class="empty">暂无告警记录</div>
          {% endif %}
        </div>
      </div>
    </div>
  </div>

  <script>
    function setTab(tab) {
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
      });
      document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
      document.getElementById('tab-' + tab).classList.add('active');
    }

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => setTab(btn.dataset.tab));
    });

    async function sendControl(action) {
      try {
        const res = await fetch('/api/control/' + action, { method: 'POST' });
        const data = await res.json();
        alert(data.success ? ('已发送: ' + action) : ('失败: ' + (data.message || 'unknown')));
        refreshStats();
      } catch (err) {
        alert('控制请求失败: ' + err.message);
      }
    }

    function setText(id, value) {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    }

    function setBadge(id, text, cls) {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = text;
      el.className = 'badge ' + cls;
    }

    function badgeForPnl(value) {
      if (value > 0) return 'pnl-positive';
      if (value < 0) return 'pnl-negative';
      return 'state-neutral';
    }

    // =============================================================================
    // A1 稳定性增强：防重入 + 错误处理 + Last Updated
    // =============================================================================
    
    let isRefreshing = false;           // 防重入标志
    let refreshErrorCount = 0;          // 连续错误计数
    let lastSuccessfulUpdate = null;    // 最后成功更新时间
    const MAX_ERROR_COUNT = 5;          // 最大错误计数（超过后显示错误状态）
    const REFRESH_INTERVAL = 5000;      // 刷新间隔（ms）
    
    // 显示/隐藏错误提示
    function showErrorBanner(message) {
      let banner = document.getElementById('refresh-error-banner');
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'refresh-error-banner';
        banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#dc2626;color:white;padding:12px;text-align:center;z-index:9999;font-size:14px;';
        document.body.insertBefore(banner, document.body.firstChild);
      }
      banner.textContent = '🔴 ' + message;
      banner.style.display = 'block';
    }
    
    function hideErrorBanner() {
      const banner = document.getElementById('refresh-error-banner');
      if (banner) banner.style.display = 'none';
    }
    
    // 更新 Last Updated 显示
    function updateLastUpdated() {
      const now = new Date();
      lastSuccessfulUpdate = now;
      const timeStr = now.toLocaleTimeString('zh-CN', { hour12: false });
      setText('last-updated', timeStr);
      
      // 同时更新所有页面的 last-updated 元素
      document.querySelectorAll('.last-updated').forEach(el => {
        el.textContent = '最后更新：' + timeStr;
      });
    }
    
    // 获取刷新状态文本
    function getRefreshStatusText() {
      if (!lastSuccessfulUpdate) return '从未更新';
      const now = new Date();
      const diff = Math.floor((now - lastSuccessfulUpdate) / 1000);
      if (diff < 60) return diff + '秒前';
      if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
      return Math.floor(diff / 3600) + '小时前';
    }
    
    async function refreshStats() {
      // 防重入：如果上次请求未完成，跳过本次
      if (isRefreshing) {
        console.log('[刷新跳过] 上次请求未完成');
        return;
      }
      
      isRefreshing = true;
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 秒超时
        
        const res = await fetch('/api/stats', { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        const vm = data.vm || data;
        if (!vm) throw new Error('No data');

        setText('as-of', vm.as_of || '--');
        setText('hero-symbol', vm.symbol || '--');
        setText('hero-price', vm.market?.price || '--');
        setBadge('hero-change', `${(vm.market?.change || 0).toFixed(2)}%`, (vm.market?.change || 0) > 0 ? 'pnl-positive' : (vm.market?.change || 0) < 0 ? 'pnl-negative' : 'state-neutral');

        setText('summary-bias', vm.summary?.bias || '--');
        setText('summary-regime', vm.summary?.regime || '--');
        setText('summary-confidence', `${(vm.summary?.confidence_pct || 0).toFixed(1)}%`);
        setBadge('summary-risk', (vm.summary?.risk_state || 'neutral').toUpperCase(), vm.summary?.risk_state === 'ok' ? 'state-ok' : vm.summary?.risk_state === 'warn' ? 'state-warn' : 'state-error');

        setBadge('position-side', vm.position?.side || '空仓', vm.position?.side === 'LONG' ? 'side-long' : vm.position?.side === 'SHORT' ? 'side-short' : 'state-neutral');
        setText('position-size', (vm.position?.size || 0).toFixed(4));
        setText('position-entry', (vm.position?.entry_price || 0).toFixed(2));
        setText('position-mark', (vm.position?.mark_price || 0).toFixed(2));
        setBadge('position-pnl', (vm.position?.unrealized_pnl || 0).toFixed(2), badgeForPnl(vm.position?.unrealized_pnl || 0));
        setText('position-leverage', `${vm.position?.leverage || 0}x`);
        setText('position-liquidation', (vm.position?.liquidation_price || 0).toFixed(2));

        setText('capital-equity', `${(vm.capital?.equity || 0).toFixed(2)} ${vm.capital?.currency || 'USDT'}`);
        setText('capital-available', `${(vm.capital?.available || 0).toFixed(2)} ${vm.capital?.currency || 'USDT'}`);
        setText('capital-margin', `${(vm.capital?.margin || 0).toFixed(2)} ${vm.capital?.currency || 'USDT'}`);
        setBadge('capital-realized', (vm.capital?.realized_pnl || 0).toFixed(2), badgeForPnl(vm.capital?.realized_pnl || 0));
        setBadge('capital-unrealized', (vm.capital?.unrealized_pnl || 0).toFixed(2), badgeForPnl(vm.capital?.unrealized_pnl || 0));

        setBadge('system-enabled', vm.control?.enabled ? '系统启用' : '系统关闭', vm.control?.enabled ? 'state-ok' : 'state-error');
        setBadge('system-frozen', vm.control?.frozen ? '已冻结' : '运行中', vm.control?.frozen ? 'state-error' : 'state-ok');
        setBadge('health-enabled', vm.control?.enabled ? '开启' : '关闭', vm.control?.enabled ? 'state-ok' : 'state-error');
        setBadge('health-frozen', vm.control?.frozen ? '已冻结' : '正常', vm.control?.frozen ? 'state-error' : 'state-ok');
        setText('health-threshold', String(vm.control?.threshold ?? '--'));
        setText('health-approval', `${(vm.summary?.approval_rate || 0).toFixed(1)}%`);
        setText('health-winrate', `${(vm.summary?.win_rate || 0).toFixed(1)}%`);

        setText('structure-trend', vm.structure?.trend || '--');
        setText('structure-volatility', vm.structure?.volatility || '--');
        setText('structure-structure', vm.structure?.structure || '--');
        setText('structure-score', String(vm.structure?.score ?? '--'));
        setText('structure-confidence', `${(vm.structure?.confidence_pct || 0).toFixed(1)}%`);
        setText('decision-total', String(vm.decision?.total ?? '--'));
        setText('decision-split', `${vm.decision?.approved ?? '--'} / ${vm.decision?.rejected ?? '--'}`);

        setText('evo-generation', String(vm.evolution?.generation ?? '--'));
        setText('evo-fitness', (vm.evolution?.best_fitness || 0).toFixed(3));
        setText('evo-population', String(vm.evolution?.population_size ?? '--'));
        setText('evo-status', vm.evolution?.status || '--');
        setText('evo-mutations', String(vm.evolution?.total_mutations ?? '--'));
        setText('evo-speed', (vm.evolution?.evolution_speed || 0).toFixed(2));
        
        // 渲染图表
        renderCharts(vm);
        
        // 更新健康状态（v41 新增）
        updateHealthStatus(vm);
        
        // 更新风险状态（v42 新增）
        updateRiskStatus(vm);
        
        // 更新决策解释（v43 新增）
        updateDecisionExplain(vm);
        
        // ✅ 成功：重置错误计数，更新最后成功时间
        refreshErrorCount = 0;
        updateLastUpdated();
        hideErrorBanner();
        
      } catch (err) {
        // ❌ 失败：增加错误计数
        refreshErrorCount++;
        console.error(`[面板刷新失败 #${refreshErrorCount}]`, err.message);
        
        // 错误达到阈值，显示错误提示
        if (refreshErrorCount >= MAX_ERROR_COUNT) {
          showErrorBanner(`数据刷新失败（连续${refreshErrorCount}次）- 最后更新：${getRefreshStatusText()}`);
        } else if (refreshErrorCount === 1) {
          // 第一次失败，静默处理
          console.log('[刷新失败] 等待下次重试...');
        }
        
        // 超时错误，特殊提示
        if (err.name === 'AbortError') {
          console.error('[面板刷新超时] 请求超过 10 秒');
        }
      } finally {
        isRefreshing = false;
      }
    }
    
    // 健康状态更新（v41 新增）
    function updateHealthStatus(vm) {
      const health = vm.health || {};
      const sources = health.sources || {};
      
      // 总体状态
      const overallEl = document.getElementById('health-overall');
      if (overallEl) {
        const status = health.overall || 'unknown';
        overallEl.textContent = status.toUpperCase();
        overallEl.className = 'badge ' + (status === 'ok' ? 'state-ok' : status === 'warn' ? 'state-warn' : 'state-error');
      }
      
      // 快照延迟
      const ageEl = document.getElementById('health-snapshot-age');
      if (ageEl) {
        ageEl.textContent = (health.snapshot_age_sec || 0) + 's';
      }
      
      // 各数据源状态
      updateSourceHealth('health-okx-capital', sources.okx_capital);
      updateSourceHealth('health-okx-position', sources.okx_position);
      updateSourceHealth('health-market', sources.market);
      updateSourceHealth('health-decision', sources.decision_log);
    }
    
    function updateSourceHealth(elementId, source) {
      const el = document.getElementById(elementId);
      if (el && source) {
        const status = source.status || 'unknown';
        const age = source.age_sec || 0;
        el.textContent = status.toUpperCase() + (age > 0 ? ` (${age}s)` : '');
        el.className = 'badge ' + (status === 'ok' ? 'state-ok' : status === 'warn' ? 'state-warn' : 'state-error');
      }
    }
    
    // 风险状态更新（v42 新增）
    function updateRiskStatus(vm) {
      const risk = vm.risk || {};
      
      // 闸门状态
      const gateEl = document.getElementById('risk-gate-status');
      if (gateEl) {
        const status = risk.gate_status || 'open';
        gateEl.textContent = status.toUpperCase();
        gateEl.className = 'badge ' + (status === 'open' ? 'state-ok' : status === 'restricted' ? 'state-warn' : 'state-error');
      }
      
      // 模式
      setText('risk-mode', risk.mode || 'observe_only');
      
      // 开平仓状态
      setBadge('risk-can-open', risk.can_open ? '允许' : '禁止', risk.can_open ? 'state-ok' : 'state-error');
      setBadge('risk-can-close', risk.can_close ? '允许' : '禁止', risk.can_close ? 'state-ok' : 'state-error');
      
      // 熔断
      setBadge('risk-circuit', risk.circuit_breaker ? '触发' : '正常', risk.circuit_breaker ? 'state-error' : 'state-ok');
      
      // 日亏损
      setText('risk-daily-loss', `${risk.current_daily_loss || 0} / ${risk.max_daily_loss || 0} USDT`);
      
      // 日交易
      setText('risk-daily-trades', `${risk.daily_trades || 0} / ${risk.max_daily_trades || 0}`);
      
      // 限制原因
      const reasonsEl = document.querySelector('#risk-gate-panel .badge.state-warn');
      if (reasonsEl) {
        reasonsEl.textContent = (risk.gate_reasons || []).join(', ') || '无限制';
      }
    }
    
    // 决策解释更新（v43 新增）
    function updateDecisionExplain(vm) {
      const de = vm.decision_explain || {};
      
      setText('decision-action', de.last_action || 'hold');
      setText('decision-confidence', de.confidence || 0);
      setText('decision-signal', de.signal || 'none');
      setText('decision-structure', de.structure_bias || '中性');
      setText('decision-position', de.position_state || 'FLAT');
      
      // 风控检查状态
      const riskEl = document.getElementById('decision-risk');
      if (riskEl) {
        const riskCheck = de.risk_check || 'unknown';
        riskEl.textContent = riskCheck.toUpperCase();
        riskEl.className = 'badge ' + (riskCheck === 'passed' ? 'state-ok' : riskCheck === 'limited' ? 'state-warn' : 'state-error');
      }
      
      // 摘要
      setText('decision-summary', de.summary || '当前无明确决策');
    }
    
    // 控制动作（v42 新增）
    async function sendControlAction(action) {
      try {
        const res = await fetch(`/api/control/action/${action}`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          console.log('控制动作成功:', action);
          refreshStats();  // 立即刷新
        } else {
          alert('操作失败: ' + data.error);
        }
      } catch (err) {
        alert('网络错误: ' + err.message);
      }
    }

    // ========================================================================
    // P1-3 图表增量更新
    // ========================================================================
    
    // 图表实例缓存（避免重复创建）
    const charts = {
      equity: null,
      drawdown: null,
      pnl: null,
      decision: null,
      evolution: null
    };
    
    // 通用配置生成器 - 线图
    function createLineChartConfig(title, label, borderColor, backgroundColor) {
      return {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            label: label,
            data: [],
            borderColor: borderColor,
            backgroundColor: backgroundColor,
            fill: true,
            tension: 0.4,
            pointRadius: 3,
            pointHoverRadius: 5
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            duration: 300,
            easing: 'easeOutQuart'
          },
          plugins: {
            legend: { display: false },
            title: {
              display: true,
              text: title,
              color: '#b6c1d1',
              font: { size: 13, weight: 'bold' }
            },
            tooltip: {
              mode: 'index',
              intersect: false,
              backgroundColor: 'rgba(18, 26, 39, 0.95)',
              titleColor: '#f5f7fb',
              bodyColor: '#b6c1d1',
              borderColor: 'rgba(255,255,255,0.1)',
              borderWidth: 1,
              padding: 10,
              displayColors: false,
              callbacks: {
                label: function(context) {
                  return context.dataset.label + ': ' + context.parsed.y.toFixed(2);
                }
              }
            }
          },
          scales: {
            x: {
              ticks: { color: '#7f8a9e', maxTicksLimit: 8 },
              grid: { color: 'rgba(255,255,255,0.05)', display: false }
            },
            y: {
              ticks: { color: '#7f8a9e' },
              grid: { color: 'rgba(255,255,255,0.05)' }
            }
          },
          interaction: {
            mode: 'nearest',
            axis: 'x',
            intersect: false
          }
        }
      };
    }
    
    // 通用配置生成器 - 环形图
    function createDoughnutChartConfig(title) {
      return {
        type: 'doughnut',
        data: {
          labels: ['通过', '拒绝'],
          datasets: [{
            data: [0, 0],
            backgroundColor: ['#22c55e', '#ef4444'],
            borderWidth: 0,
            hoverOffset: 10
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            duration: 400,
            easing: 'easeOutQuart'
          },
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: '#b6c1d1',
                padding: 15,
                font: { size: 12 }
              }
            },
            title: {
              display: true,
              text: title,
              color: '#b6c1d1',
              font: { size: 13, weight: 'bold' }
            },
            tooltip: {
              backgroundColor: 'rgba(18, 26, 39, 0.95)',
              titleColor: '#f5f7fb',
              bodyColor: '#b6c1d1',
              borderColor: 'rgba(255,255,255,0.1)',
              borderWidth: 1,
              padding: 10,
              callbacks: {
                label: function(context) {
                  const total = context.dataset.data.reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? (context.raw / total * 100).toFixed(1) : 0;
                  return context.label + ': ' + context.raw + ' (' + pct + '%)';
                }
              }
            }
          }
        }
      };
    }
    
    // 数据比较函数 - 避免无意义更新
    function sameSeries(a, b) {
      if (!Array.isArray(a) || !Array.isArray(b)) return false;
      if (a.length !== b.length) return false;
      if (a.length === 0) return true;
      const lastA = a[a.length - 1];
      const lastB = b[b.length - 1];
      return lastA.ts === lastB.ts && lastA.value === lastB.value;
    }
    
    // 线图增量更新函数（A1 稳定性增强：图表生命周期管理）
    function updateLineChart(chartRef, canvasId, configBuilder, series, valueExtractor) {
      const ctx = document.getElementById(canvasId);
      if (!ctx) return null;
      
      // 空数据时保留实例，清空数据
      if (!series || series.length === 0) {
        if (chartRef && chartRef.data) {
          chartRef.data.labels = [];
          chartRef.data.datasets[0].data = [];
          chartRef.update('none');
        }
        return chartRef;
      }
      
      const labels = series.map(d => d.index !== undefined ? d.index : d.ts?.slice(11, 19) || '');
      const values = series.map(d => valueExtractor(d));
      
      if (!chartRef) {
        // 首次创建
        const config = configBuilder();
        config.data.labels = labels;
        config.data.datasets[0].data = values;
        return new Chart(ctx.getContext('2d'), config);
      } else {
        // 增量更新：先检查是否需要完全重建（数据维度变化）
        const needsRecreate = chartRef.data.labels.length !== labels.length ||
                              chartRef.data.datasets[0].data.length !== values.length;
        
        if (needsRecreate) {
          // 安全销毁旧实例
          try {
            chartRef.destroy();
          } catch (e) {
            console.warn('[图表销毁失败]', e);
          }
          // 创建新实例
          const config = configBuilder();
          config.data.labels = labels;
          config.data.datasets[0].data = values;
          return new Chart(ctx.getContext('2d'), config);
        } else {
          // 增量更新
          chartRef.data.labels = labels;
          chartRef.data.datasets[0].data = values;
          chartRef.update('none');
          return chartRef;
        }
      }
    }
    
    // 环形图增量更新函数（A1 稳定性增强：图表生命周期管理）
    function updateDoughnutChart(chartRef, canvasId, configBuilder, labels, data) {
      const ctx = document.getElementById(canvasId);
      if (!ctx) return null;
      
      if (!chartRef) {
        // 首次创建
        const config = configBuilder();
        config.data.labels = labels;
        config.data.datasets[0].data = data;
        return new Chart(ctx.getContext('2d'), config);
      } else {
        // 增量更新：检查是否需要重建
        const needsRecreate = chartRef.data.labels.length !== labels.length ||
                              chartRef.data.datasets[0].data.length !== data.length;
        
        if (needsRecreate) {
          // 安全销毁旧实例
          try {
            chartRef.destroy();
          } catch (e) {
            console.warn('[图表销毁失败]', e);
          }
          // 创建新实例
          const config = configBuilder();
          config.data.labels = labels;
          config.data.datasets[0].data = data;
          return new Chart(ctx.getContext('2d'), config);
        } else {
          // 增量更新
          chartRef.data.labels = labels;
          chartRef.data.datasets[0].data = data;
          chartRef.update('none');
          return chartRef;
        }
      }
    }
    
    // 具体图表更新函数
    function updateEquityChart(series) {
      charts.equity = updateLineChart(
        charts.equity,
        'equityChart',
        () => createLineChartConfig('权益曲线', '权益 (USDT)', '#3b82f6', 'rgba(59, 130, 246, 0.1)'),
        series,
        d => d.equity
      );
    }
    
    function updateDrawdownChart(series) {
      charts.drawdown = updateLineChart(
        charts.drawdown,
        'drawdownChart',
        () => createLineChartConfig('回撤曲线', '回撤 (%)', '#ef4444', 'rgba(239, 68, 68, 0.1)'),
        series,
        d => d.drawdown
      );
    }
    
    function updatePnlChart(series) {
      charts.pnl = updateLineChart(
        charts.pnl,
        'pnlChart',
        () => createLineChartConfig('最近交易累计盈亏', '累计盈亏', '#22c55e', 'rgba(34, 197, 94, 0.1)'),
        series,
        d => d.cumulative
      );
    }
    
    function updateDecisionChart(dist) {
      if (!dist) return;
      charts.decision = updateDoughnutChart(
        charts.decision,
        'decisionChart',
        () => createDoughnutChartConfig('决策分布'),
        ['通过', '拒绝'],
        [dist.accept || 0, dist.reject || 0]
      );
    }
    
    function updateEvolutionChart(series) {
      charts.evolution = updateLineChart(
        charts.evolution,
        'evolutionChart',
        () => createLineChartConfig('演化适应度趋势', '适应度', '#3b82f6', 'rgba(59, 130, 246, 0.1)'),
        series,
        d => d.fitness
      );
    }
    
    // 统一渲染入口
    function renderCharts(vm) {
      if (!vm || !vm.charts) return;
      
      // 第一批：高频刷新图表（优先优化）
      updateEquityChart(vm.charts.equity_history || []);
      updateDrawdownChart(vm.charts.drawdown_history || []);
      updatePnlChart(vm.charts.pnl_history || []);
      
      // 第二批：低频刷新图表
      updateDecisionChart(vm.charts.decision_distribution || {});
      updateEvolutionChart(vm.charts.evolution_history || []);
    }

    refreshStats();
    setInterval(refreshStats, 5000);
  </script>
</body>
</html>
"""


# =============================================================================
# UI-3.9 PWA 路由
# =============================================================================

@app.route("/manifest.json")
def manifest() -> Any:
    """PWA Manifest 文件"""
    return send_from_directory(Path(__file__).parent, 'manifest.json', mimetype='application/json')

@app.route("/static/<path:filename>")
def static_files(filename: str) -> Any:
    """静态文件服务（Service Worker / 图标等）"""
    return send_from_directory(Path(__file__).parent / 'static', filename)

@app.route("/static/icons/<path:filename>")
def static_icons(filename: str) -> Any:
    """图标文件服务"""
    return send_from_directory(Path(__file__).parent / 'static' / 'icons', filename)

# =============================================================================
# UI-3.10A: 性能监控 API
# =============================================================================

@app.route("/api/monitor/frontend-error", methods=['POST'])
def api_frontend_error() -> Any:
    """
    前端错误上报接口
    
    请求体:
    {
        "errors": [
            {
                "page": "/history",
                "message": "TypeError: Cannot read property...",
                "source": "/static/app.js",
                "lineno": 123,
                "colno": 45,
                "stack": "...",
                "user_agent": "Mozilla/5.0..."
            }
        ]
    }
    """
    try:
        data = request.get_json()
        errors = data.get('errors', []) if data else []
        
        logged_count = 0
        for error in errors:
            monitor_db.log_frontend_error(
                page=error.get('page', request.headers.get('Referer', '')),
                message=error.get('message', 'Unknown error'),
                source=error.get('source'),
                lineno=error.get('lineno'),
                colno=error.get('colno'),
                stack=error.get('stack'),
                user_agent=error.get('user_agent')
            )
            logged_count += 1
        
        logger.info(f"收到 {logged_count} 个前端错误")
        return jsonify({"ok": True, "logged": logged_count})
    
    except Exception as e:
        logger_error(f"前端错误上报失败：{e}")
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/monitor/performance")
def api_monitor_performance() -> Any:
    """
    获取性能统计数据
    
    参数:
    - hours: 统计时长（默认 24 小时）
    - slow_only: 是否只返回慢请求（默认 false）
    - limit: 返回数量（默认 100）
    """
    try:
        hours = int(request.args.get('hours', 24))
        slow_only = request.args.get('slow_only', 'false').lower() == 'true'
        limit = int(request.args.get('limit', 100))
        
        # 性能统计
        perf_stats = monitor_db.get_performance_stats(hours)
        
        # 错误统计
        error_stats = monitor_db.get_error_stats(hours)
        
        # 最近慢请求
        slow_requests = monitor_db.get_recent_performance(limit=limit, slow_only=True)
        
        # 最近错误
        recent_errors = monitor_db.get_recent_errors(limit=limit)
        
        return jsonify({
            "ok": True,
            "data": {
                "performance": {
                    "stats": perf_stats,
                    "slow_requests": slow_requests,
                    "threshold_ms": API_SLOW_THRESHOLD_MS,
                },
                "errors": {
                    "stats": error_stats,
                    "recent": recent_errors,
                },
                "period_hours": hours,
            }
        })
    
    except Exception as e:
        logger_error(f"性能监控数据查询失败：{e}")
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/monitor/errors")
def api_monitor_errors() -> Any:
    """
    获取前端错误列表
    
    参数:
    - hours: 查询时长（默认 24 小时）
    - unprocessed_only: 是否只返回未处理（默认 false）
    - limit: 返回数量（默认 100）
    """
    try:
        hours = int(request.args.get('hours', 24))
        unprocessed_only = request.args.get('unprocessed_only', 'false').lower() == 'true'
        limit = int(request.args.get('limit', 100))
        
        errors = monitor_db.get_recent_errors(limit=limit, unprocessed_only=unprocessed_only)
        stats = monitor_db.get_error_stats(hours)
        
        return jsonify({
            "ok": True,
            "data": {
                "errors": errors,
                "stats": stats,
                "period_hours": hours,
            }
        })
    
    except Exception as e:
        logger_error(f"错误列表查询失败：{e}")
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/monitor/db-queries")
def api_monitor_db_queries() -> Any:
    """
    获取数据库查询性能数据
    
    参数:
    - slow_only: 是否只返回慢查询（默认 false）
    - limit: 返回数量（默认 20）
    """
    try:
        slow_only = request.args.get('slow_only', 'false').lower() == 'true'
        limit = int(request.args.get('limit', 20))
        
        conn = monitor_db._get_connection()
        try:
            query = "SELECT * FROM db_query_logs WHERE 1=1"
            params = []
            
            if slow_only:
                query += " AND is_slow = 1"
            
            query += " ORDER BY created_at DESC LIMIT ?"
            params.append(limit)
            
            cursor = conn.execute(query, params)
            rows = cursor.fetchall()
            slow_queries = [dict(row) for row in rows]
            
            # 获取统计
            cursor = conn.execute("""
                SELECT 
                    COUNT(*) as total_queries,
                    AVG(duration_ms) as avg_duration,
                    MAX(duration_ms) as max_duration,
                    SUM(CASE WHEN is_slow = 1 THEN 1 ELSE 0 END) as slow_queries
                FROM db_query_logs
            """)
            row = cursor.fetchone()
            stats = dict(row) if row else {}
            
            conn.close()
            
            return jsonify({
                "ok": True,
                "data": {
                    "slow_queries": slow_queries,
                    "stats": stats,
                }
            })
        finally:
            conn.close()
    
    except Exception as e:
        logger_error(f"数据库查询数据查询失败：{e}")
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/monitor/trends")
def api_monitor_trends() -> Any:
    """
    获取性能趋势数据（UI-3.10C 新增）
    
    参数:
    - hours: 统计时长（目前固定 24）
    """
    try:
        hours = int(request.args.get('hours', 24))
        
        conn = monitor_db._get_connection()
        try:
            # 计算时间窗口起点
            from datetime import datetime, timedelta
            cutoff = datetime.utcnow() - timedelta(hours=hours)
            
            # 按 1 小时 bucket 聚合
            query = """
                SELECT 
                    strftime('%Y-%m-%d %H:00:00', created_at) as bucket_hour,
                    COUNT(*) as request_count,
                    AVG(duration_ms) as avg_duration_ms,
                    SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as error_count
                FROM performance_logs
                WHERE created_at >= ?
                GROUP BY bucket_hour
                ORDER BY bucket_hour ASC
            """
            cursor = conn.execute(query, [cutoff.isoformat()])
            rows = cursor.fetchall()
            
            # 转换为前端需要的格式
            buckets = []
            for row in rows:
                buckets.append({
                    "ts": row[0] + ":00Z",  # ISO 8601 format
                    "request_count": row[1],
                    "avg_duration_ms": round(row[2], 1),
                    "error_count": row[3]
                })
            
            return jsonify({
                "ok": True,
                "data": {
                    "hours": hours,
                    "buckets": buckets
                }
            })
        finally:
            conn.close()
    
    except Exception as e:
        logger_error(f"趋势数据查询失败：{e}")
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/monitor/percentiles")
def api_monitor_percentiles() -> Any:
    """
    获取响应时间百分位数据（UI-3.10C 新增）
    
    固定统计最近 24 小时
    """
    try:
        hours = 24
        
        conn = monitor_db._get_connection()
        try:
            # 计算时间窗口
            from datetime import datetime, timedelta, timezone
            cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
            
            # 获取所有非慢请求的持续时间
            query = """
                SELECT duration_ms FROM performance_logs
                WHERE created_at >= ?
                ORDER BY duration_ms ASC
            """
            cursor = conn.execute(query, [cutoff.isoformat()])
            durations = [row[0] for row in cursor.fetchall() if row[0] is not None]
            
            count = len(durations)
            
            if count == 0:
                return jsonify({
                    "ok": True,
                    "data": {
                        "window_hours": hours,
                        "count": 0,
                        "p50_ms": None,
                        "p90_ms": None,
                        "p99_ms": None
                    }
                })
            
            # 计算百分位
            durations.sort()
            p50 = durations[int(count * 0.50)]
            p90 = durations[int(count * 0.90)]
            p99 = durations[int(count * 0.99)]
            
            return jsonify({
                "ok": True,
                "data": {
                    "window_hours": hours,
                    "count": count,
                    "p50_ms": round(p50, 1),
                    "p90_ms": round(p90, 1),
                    "p99_ms": round(p99, 1)
                }
            })
        finally:
            conn.close()
    
    except Exception as e:
        logger_error(f"百分位数据查询失败：{e}")
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/monitor/top-endpoints")
def api_monitor_top_endpoints() -> Any:
    """
    获取最慢端点排行（UI-3.10C 新增）
    
    参数:
    - limit: 返回数量（默认 10）
    
    按 avg_duration_ms desc 排序
    """
    try:
        limit = int(request.args.get('limit', 10))
        
        conn = monitor_db._get_connection()
        try:
            query = """
                SELECT 
                    endpoint,
                    COUNT(*) as count,
                    AVG(duration_ms) as avg_duration_ms,
                    MAX(duration_ms) as max_duration_ms,
                    SUM(CASE WHEN is_slow = 1 THEN 1 ELSE 0 END) as slow_count
                FROM performance_logs
                GROUP BY endpoint
                ORDER BY avg_duration_ms DESC
                LIMIT ?
            """
            cursor = conn.execute(query, [limit])
            rows = cursor.fetchall()
            
            items = []
            for row in rows:
                items.append({
                    "endpoint": row[0],
                    "count": row[1],
                    "avg_duration_ms": round(row[2], 1),
                    "max_duration_ms": round(row[3], 1),
                    "slow_count": row[4]
                })
            
            return jsonify({
                "ok": True,
                "data": {
                    "limit": limit,
                    "items": items
                }
            })
        finally:
            conn.close()
    
    except Exception as e:
        logger_error(f"Top endpoints 查询失败：{e}")
        return jsonify({"ok": False, "error": str(e)}), 500


# =============================================================================
# UI-3.10D: 告警管理 API
# =============================================================================

@app.route("/api/monitor/alerts/rules", methods=['GET', 'POST'])
def api_alert_rules() -> Any:
    """
    告警规则管理
    
    GET: 获取所有规则
    POST: 创建新规则
    """
    if request.method == 'POST':
        try:
            data = request.get_json()
            rule_id = create_rule(
                name=data.get('name'),
                metric_type=data.get('metric_type'),
                window_minutes=data.get('window_minutes', 5),
                threshold=data.get('threshold'),
                operator=data.get('operator', '>='),
                severity=data.get('severity', 'WARN')
            )
            return jsonify({"ok": True, "data": {"rule_id": rule_id}})
        except Exception as e:
            logger_error(f"创建规则失败：{e}")
            return jsonify({"ok": False, "error": str(e)}), 400
    else:
        try:
            rules = get_all_rules()
            return jsonify({"ok": True, "data": {"rules": rules}})
        except Exception as e:
            logger_error(f"获取规则失败：{e}")
            return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/monitor/alerts/rules/<int:rule_id>", methods=['PUT', 'DELETE'])
def api_alert_rule(rule_id: int) -> Any:
    """
    单个规则管理
    
    PUT: 更新规则
    DELETE: 删除规则
    """
    if request.method == 'PUT':
        try:
            data = request.get_json()
            success = update_rule(rule_id, **data)
            return jsonify({"ok": success})
        except Exception as e:
            logger_error(f"更新规则失败：{e}")
            return jsonify({"ok": False, "error": str(e)}), 400
    else:  # DELETE
        try:
            success = delete_rule(rule_id)
            return jsonify({"ok": success})
        except Exception as e:
            logger_error(f"删除规则失败：{e}")
            return jsonify({"ok": False, "error": str(e)}), 400


@app.route("/api/monitor/alerts/events")
def api_alert_events() -> Any:
    """
    获取最近告警事件
    
    参数:
    - limit: 返回数量（默认 50）
    """
    try:
        limit = int(request.args.get('limit', 50))
        events = get_recent_events(limit)
        return jsonify({"ok": True, "data": {"events": events}})
    except Exception as e:
        logger_error(f"获取告警事件失败：{e}")
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/monitor/alerts/evaluate", methods=['POST'])
def api_alert_evaluate() -> Any:
    """
    手动触发规则评估
    """
    try:
        triggered = evaluate_rules()
        return jsonify({
            "ok": True,
            "data": {
                "triggered_count": len(triggered),
                "alerts": triggered
            }
        })
    except Exception as e:
        logger_error(f"规则评估失败：{e}")
        return jsonify({"ok": False, "error": str(e)}), 500


# =============================================================================
# 主页面路由
# =============================================================================

@app.route("/")
def index() -> str:
    """渲染首页（UI-3.7: 使用文件模板，统一 stale/delayed 状态）"""
    raw = get_snapshot()
    if not raw:
        raw = {"snapshot_ts": datetime.now().isoformat()}
    vm = adapt_stats_payload(raw)
    # UI-3.7: 统一三页 stale/delayed 状态
    freshness_data = {
        "overall": get_overall_freshness_status() if FreshnessStatus else "unknown",
        "sources": get_all_freshness_statuses() if FreshnessStatus else {},
    }
    # 添加 worker heartbeat age
    try:
        state = load_state()
        last_loop = state.get('last_worker_loop')
        if last_loop:
            now = datetime.utcnow()
            if isinstance(last_loop, str):
                last_loop = datetime.fromisoformat(last_loop.replace('Z', '+00:00'))
            freshness_data["worker_heartbeat_age_sec"] = int((now - last_loop).total_seconds())
    except:
        pass
    return render_template("index.html", vm=vm, freshness=freshness_data, render_freshness_badge=render_freshness_badge)


@app.route("/api/stats")
def api_stats():
    """返回快照数据（v41 重构：只读快照，不触发采集）"""
    raw = get_snapshot()
    if not raw:
        # 首次请求，返回空快照
        raw = {"snapshot_ts": datetime.now().isoformat(), "health": build_health_status()}
    return jsonify({"vm": adapt_stats_payload(raw), "raw": raw})


@app.route("/api/health")
def api_health():
    """系统健康状态（v41 新增，B3 观测性增强：API 性能指标）"""
    start_time = time.time()
    endpoint = "/api/health"
    
    try:
        snap = get_snapshot()
        health = snap.get("health", {})
        
        # B1+B2: 确保 health 包含 freshness 和 server_time
        base_health = build_health_status()
        for key in base_health:
            if key not in health:
                health[key] = base_health[key]
        
        # SQLite 健康状态（A2 增强）
        sqlite_status = {
            "enabled": SQLITE_DUAL_WRITE_ENABLED,
            "initialized": storage is not None,
            "status": "unknown",
            "tables_count": 0,
            "db_path": None,
            "last_error": None,
            "error_code": None,
        }
        
        # 尝试验证数据库连接
        if storage:
            try:
                with storage.connect() as conn:
                    cur = conn.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table'")
                    row_count = cur.fetchone()[0]
                    sqlite_status["tables_count"] = row_count
                    sqlite_status["db_path"] = str(storage.db_path)
                    sqlite_status["status"] = "ok" if row_count > 0 else "warn"
                    sqlite_status["last_error"] = None
            except StorageError as e:
                logger_error.error(f"[健康检查] SQLite StorageError: {e.error_code} - {e.message}")
                sqlite_status["status"] = "error"
                sqlite_status["last_error"] = e.message
                sqlite_status["error_code"] = e.error_code
            except Exception as e:
                logger_error.error(f"[健康检查] SQLite 异常：{type(e).__name__} - {e}")
                sqlite_status["status"] = "error"
                sqlite_status["last_error"] = str(e)
                sqlite_status["error_code"] = "unknown_error"
        else:
            sqlite_status["status"] = "not_initialized"
        
        health["sqlite"] = sqlite_status
        
        # B3: API 性能指标
        if ApiMetricsTracker:
            health["api_metrics"] = get_all_metrics()
        
        return jsonify(health)
    
    finally:
        # 记录性能指标
        if ApiMetricsTracker:
            latency_ms = (time.time() - start_time) * 1000
            track_success(endpoint, latency_ms)


# =============================================================================
# P2-3 只读分析 API
# =============================================================================

# UI-3.6: 统一 days 参数解析 helper
def parse_days_arg(request_obj, default=30, allowed=(7, 30, 90)):
    """解析 days 参数（UI-3.6 新增）"""
    raw = request_obj.args.get("days", default)
    try:
        val = int(raw)
    except (TypeError, ValueError):
        return default
    return val if val in allowed else default


@app.route("/api/history/alerts")
def api_history_alerts():
    """
    历史告警查询（P2-3 新增，B1+B2+B3 观测性增强：Freshness + API 性能）
    
    参数:
    - limit: 返回条数（默认 50）
    - level: 告警级别过滤（CRITICAL/WARN/INFO）
    - type: 告警类型过滤
    """
    endpoint = "/api/history/alerts"
    start_time = time.time()
    now = datetime.now()
    
    try:
        limit = int(request.args.get("limit", 50))
        level = request.args.get("level")
        alert_type = request.args.get("type")
        days = parse_days_arg(request)
        
        if not storage:
            return jsonify(make_error_response("storage_not_initialized", "SQLite 存储未初始化", 503))
        
        items = storage.list_alerts(limit=limit, level=level, alert_type=alert_type, days=days)
        summary = storage.get_alert_summary(days=days)
        
        # B1+B2: 更新 freshness
        if FreshnessTracker:
            update_freshness("alerts", now)
        
        return jsonify(make_success_response({
            "items": items,
            "summary": summary,
            "count": len(items),
            "freshness": {
                "status": get_freshness_status("alerts") if FreshnessStatus else "unknown",
                "age_sec": get_freshness_age("alerts") if FreshnessTracker else None,
            },
        }))
    
    finally:
        # B3: 记录性能指标
        if ApiMetricsTracker:
            latency_ms = (time.time() - start_time) * 1000
            track_request(endpoint, latency_ms)


@app.route("/api/history/control")
def api_history_control():
    """
    历史控制变更查询（P2-3 新增，A2 稳定性增强）
    
    参数:
    - limit: 返回条数（默认 50）
    - action: 动作类型过滤
    - days: 时间范围（7/30/90，默认30）
    """
    start_time = time.time()
    endpoint = "/api/history/control"
    try:
        limit = int(request.args.get("limit", 50))
        action = request.args.get("action")
        days = parse_days_arg(request)
        
        if not storage:
            return jsonify(make_error_response("storage_not_initialized", "SQLite 存储未初始化", 503))
        
        items = storage.list_control_audits(limit=limit, action=action, days=days)
        
        return jsonify(make_success_response({
            "items": items,
            "count": len(items),
        }))
    
    except StorageError as e:
        logger_error.error(f"[API 错误] /api/history/control: {e.error_code} - {e.message}")
        return jsonify(e.to_dict()), 500
    
    except Exception as e:
        logger_error.error(f"[API 未知错误] /api/history/control: {type(e).__name__} - {e}")
        return jsonify(make_error_response("unknown_error", str(e), 500)), 500
    
    finally:
        # B3: 记录性能指标
        if ApiMetricsTracker:
            latency_ms = (time.time() - start_time) * 1000
            track_request(endpoint, latency_ms)


@app.route("/history")
def page_history():
    """历史分析页面（UI-3.7: 使用文件模板，统一 stale/delayed 状态）"""
    # UI-3.7: 统一三页 stale/delayed 状态
    freshness_data = {
        "overall": get_overall_freshness_status() if FreshnessStatus else "unknown",
        "sources": get_all_freshness_statuses() if FreshnessStatus else {},
    }
    return render_template("history.html", freshness=freshness_data, render_freshness_badge=render_freshness_badge)


@app.route("/reports")
def page_reports():
    """报表中心页面（UI-3.7: 使用文件模板，统一 stale/delayed 状态）"""
    # UI-3.7: 统一三页 stale/delayed 状态
    freshness_data = {
        "overall": get_overall_freshness_status() if FreshnessStatus else "unknown",
        "sources": get_all_freshness_statuses() if FreshnessStatus else {},
    }
    return render_template("reports.html", freshness=freshness_data, render_freshness_badge=render_freshness_badge)


@app.route("/monitor")
def page_monitor() -> str:
    """UI-3.10B: 监控报表页面（轻量监控仪表板）"""
    return render_template("monitor.html")


@app.route("/api/history/decisions")
def api_history_decisions():
    """
    历史决策事件查询（P2-3 新增，A2 稳定性增强）
    
    参数:
    - limit: 返回条数（默认 50）
    - action: 动作类型过滤（buy/sell/hold/reject_long/reject_short）
    """
    start_time = time.time()
    endpoint = "/api/history/decisions"
    try:
        limit = int(request.args.get("limit", 50))
        action = request.args.get("action")
        days = parse_days_arg(request)
        
        if not storage:
            return jsonify(make_error_response("storage_not_initialized", "SQLite 存储未初始化", 503))
        
        items = storage.list_decision_events(limit=limit, normalized_action=action, days=days)
        summary = storage.get_decision_action_summary(days=days)
        
        return jsonify(make_success_response({
            "items": items,
            "summary": summary,
            "count": len(items),
        }))
    
    except StorageError as e:
        logger_error.error(f"[API 错误] /api/history/decisions: {e.error_code} - {e.message}")
        return jsonify(e.to_dict()), 500
    
    except Exception as e:
        logger_error.error(f"[API 未知错误] /api/history/decisions: {type(e).__name__} - {e}")
        return jsonify(make_error_response("unknown_error", str(e), 500)), 500
    
    finally:
        # B3: 记录性能指标
        if ApiMetricsTracker:
            latency_ms = (time.time() - start_time) * 1000
            track_request(endpoint, latency_ms)


# =============================================================================
# P3-3 报表 API
# =============================================================================

@app.route("/api/reports/alerts")
def api_reports_alerts():
    """
    告警报表 API（P3-3 新增，B1+B2 观测性增强：Freshness 追踪）
    
    参数:
    - days: 时间范围（1/7/30），默认 7
    """
    endpoint = "/api/reports/alerts"
    start_time = time.time()
    now = datetime.now()
    
    try:
        days = int(request.args.get("days", 7))
        if days not in [1, 7, 30]:
            return jsonify(make_error_response("invalid_parameter", "days 参数必须是 1/7/30", 400))
        
        if not storage:
            return jsonify(make_error_response("storage_not_initialized", "SQLite 存储未初始化", 503))
        
        from reports_service import build_alert_report
        report = build_alert_report(storage, days=days)
        
        # B1+B2: 更新 freshness
        if FreshnessTracker:
            update_freshness("alerts_report", now)
        
        return jsonify(make_success_response({
            **report,
            "freshness": {
                "status": get_freshness_status("alerts_report") if FreshnessStatus else "unknown",
                "age_sec": get_freshness_age("alerts_report") if FreshnessTracker else None,
            },
        }))
    
    except StorageError as e:
        logger_error.error(f"[API 错误] /api/reports/alerts: {e.error_code} - {e.message}")
        return jsonify(e.to_dict()), 500
    
    except Exception as e:
        logger_error.error(f"[API 未知错误] /api/reports/alerts: {type(e).__name__} - {e}")
        return jsonify(make_error_response("unknown_error", str(e), 500)), 500


    finally:
        # B3: 记录性能指标
        if ApiMetricsTracker:
            latency_ms = (time.time() - start_time) * 1000
            track_request(endpoint, latency_ms)

@app.route("/api/reports/decisions")
def api_reports_decisions():
    """
    决策报表 API（P3-3 新增，B1+B2 观测性增强：Freshness 追踪）
    
    参数:
    - days: 时间范围（1/7/30），默认 7
    """
    endpoint = "/api/reports/decisions"
    start_time = time.time()
    now = datetime.now()
    
    try:
        days = int(request.args.get("days", 7))
        if days not in [1, 7, 30]:
            return jsonify(make_error_response("invalid_parameter", "days 参数必须是 1/7/30", 400))
        
        if not storage:
            return jsonify(make_error_response("storage_not_initialized", "SQLite 存储未初始化", 503))
        
        from reports_service import build_decision_report
        report = build_decision_report(storage, days=days)
        
        # B1+B2: 更新 freshness
        if FreshnessTracker:
            update_freshness("decisions_report", now)
        
        return jsonify(make_success_response({
            **report,
            "freshness": {
                "status": get_freshness_status("decisions_report") if FreshnessStatus else "unknown",
                "age_sec": get_freshness_age("decisions_report") if FreshnessTracker else None,
            },
        }))
    
    except StorageError as e:
        logger_error.error(f"[API 错误] /api/reports/decisions: {e.error_code} - {e.message}")
        return jsonify(e.to_dict()), 500
    
    except Exception as e:
        logger_error.error(f"[API 未知错误] /api/reports/decisions: {type(e).__name__} - {e}")
        return jsonify(make_error_response("unknown_error", str(e), 500)), 500
    
    finally:
        # B3: 记录性能指标
        if ApiMetricsTracker:
            latency_ms = (time.time() - start_time) * 1000
            track_request(endpoint, latency_ms)


@app.route("/api/reports/control")
def api_reports_control():
    """
    控制变更报表 API（P3-3 新增，B3 观测性增强：API 性能埋点）
    
    参数:
    - days: 时间范围（1/7/30），默认 7
    """
    endpoint = "/api/reports/control"
    start_time = time.time()
    now = datetime.now()
    
    try:
        days = int(request.args.get("days", 7))
        if days not in [1, 7, 30]:
            return jsonify(make_error_response("invalid_parameter", "days 参数必须是 1/7/30", 400))
        
        if not storage:
            return jsonify(make_error_response("storage_not_initialized", "SQLite 存储未初始化", 503))
        
        from reports_service import build_control_report
        report = build_control_report(storage, days=days)
        
        # B1+B2: 更新 freshness
        if FreshnessTracker:
            update_freshness("control_report", now)
        
        return jsonify(make_success_response({
            **report,
            "freshness": {
                "status": get_freshness_status("control_report") if FreshnessStatus else "unknown",
                "age_sec": get_freshness_age("control_report") if FreshnessTracker else None,
            },
        }))
    
    except StorageError as e:
        logger_error.error(f"[API 错误] /api/reports/control: {e.error_code} - {e.message}")
        return jsonify(e.to_dict()), 500
    
    except Exception as e:
        logger_error.error(f"[API 未知错误] /api/reports/control: {type(e).__name__} - {e}")
        return jsonify(make_error_response("unknown_error", str(e), 500)), 500
    
    finally:
        # B3: 记录性能指标
        if ApiMetricsTracker:
            latency_ms = (time.time() - start_time) * 1000
            track_request(endpoint, latency_ms)


@app.route("/api/control/update", methods=["POST"])
def api_control_update():
    """更新控制状态（v42 新增）"""
    try:
        data = request.json or {}
        
        # 输入校验
        allowed_modes = ["observe_only", "paper", "live"]
        mode = data.get("mode", control.get("mode"))
        if mode not in allowed_modes:
            return jsonify({"success": False, "error": f"无效模式: {mode}"}), 400
        
        # 记录变更前状态
        before = dict(control)
        
        # 更新字段
        control.update({
            "mode": mode,
            "enabled": data.get("enabled", control.get("enabled", True)),
            "can_open": data.get("can_open", control.get("can_open", False)),
            "can_close": data.get("can_close", control.get("can_close", True)),
            "circuit_breaker": data.get("circuit_breaker", control.get("circuit_breaker", False)),
            "max_daily_loss": data.get("max_daily_loss", control.get("max_daily_loss", 500.0)),
            "max_daily_trades": data.get("max_daily_trades", control.get("max_daily_trades", 20)),
            "updated_at": datetime.now().isoformat(),
            "updated_by": data.get("operator", "local_user")
        })
        
        # 审计日志
        reason = data.get("reason", "")
        audit_control_change(before, control, reason, data.get("operator", "local_user"))
        
        # 保存
        save_control()
        
        return jsonify({"success": True, "control": control})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/control/action/<name>", methods=["POST"])
def api_control_action(name):
    """快捷控制动作（v42 新增）"""
    try:
        before = dict(control)
        
        if name == "open_all":
            control.update({
                "mode": "live",
                "can_open": True,
                "can_close": True,
                "circuit_breaker": False
            })
            reason = "允许开平仓"
        elif name == "close_opening":
            control.update({
                "can_open": False,
                "can_close": True
            })
            reason = "仅允许平仓"
        elif name == "block_all":
            control.update({
                "can_open": False,
                "can_close": False
            })
            reason = "全禁用"
        elif name == "reset_circuit_breaker":
            control.update({
                "circuit_breaker": False
            })
            reason = "重置熔断"
        else:
            return jsonify({"success": False, "error": f"未知动作: {name}"}), 400
        
        control["updated_at"] = datetime.now().isoformat()
        control["updated_by"] = "local_user"
        
        audit_control_change(before, control, reason, "local_user")
        save_control()
        
        return jsonify({"success": True, "control": control})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/capital")
def api_capital():
    return jsonify(dict(capital_state))


@app.route("/api/position")
def api_position():
    return jsonify(dict(position_state))


@app.route("/api/evolution")
def api_evolution():
    return jsonify(dict(evolution_state))


@app.route("/api/system-state")
def api_system_state():
    return jsonify(
        {
            "control": dict(control),
            "structure": dict(structure_state),
            "decision": dict(decision_state),
            "capital": dict(capital_state),
            "position": dict(position_state),
        }
    )


@app.route("/api/control/<action>", methods=["POST"])
def api_control(action: str):
    message = "ok"
    if action == "enable":
        control["enabled"] = True
        control["frozen"] = False
    elif action == "disable":
        control["enabled"] = False
    elif action == "freeze":
        control["frozen"] = True
    elif action == "unfreeze":
        control["frozen"] = False
    elif action == "emergency":
        control["enabled"] = False
        control["frozen"] = True
    else:
        return jsonify({"success": False, "message": f"unsupported action: {action}"}), 400
    control["last_update"] = datetime.now().isoformat()
    save_control()
    return jsonify({"success": True, "action": action, "message": message, "control": control})


if __name__ == "__main__":
    print("panel_v40 cockpit running at http://localhost:8780")
    app.run(host="0.0.0.0", port=8780, debug=False)
