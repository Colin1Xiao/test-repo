"""
V5.3 Server 配置管理
"""
from pathlib import Path
from dataclasses import dataclass
from typing import Optional
import json

# ============================================================
# 路径配置
# ============================================================
BASE_DIR = Path(__file__).parent.parent  # trading_system_v5_3/
LOGS_DIR = BASE_DIR / "logs"
DATA_DIR = BASE_DIR / "data"
CONFIG_DIR = BASE_DIR / "config"

# 确保目录存在
LOGS_DIR.mkdir(exist_ok=True)
DATA_DIR.mkdir(exist_ok=True)
CONFIG_DIR.mkdir(exist_ok=True)


@dataclass
class ServerConfig:
    """服务器配置"""
    host: str = "0.0.0.0"
    port: int = 8765
    debug: bool = False
    cors_origins: list = None
    
    def __post_init__(self):
        if self.cors_origins is None:
            self.cors_origins = ["*"]


@dataclass
class LogConfig:
    """日志配置"""
    system_state_file: Path = None
    output_log: Path = None
    control_state_file: Path = None
    decision_log: Path = None
    evolution_log: Path = None
    profit_audit: Path = None
    alerts_log: Path = None
    
    def __post_init__(self):
        if self.system_state_file is None:
            self.system_state_file = LOGS_DIR / "system_state.jsonl"
        if self.output_log is None:
            self.output_log = LOGS_DIR / "v52_output.log"
        if self.control_state_file is None:
            self.control_state_file = LOGS_DIR / "control_state.json"
        if self.decision_log is None:
            self.decision_log = LOGS_DIR / "decision_log.jsonl"
        if self.evolution_log is None:
            self.evolution_log = LOGS_DIR / "evolution_logs.jsonl"
        if self.profit_audit is None:
            self.profit_audit = LOGS_DIR / "profit_audit.json"
        if self.alerts_log is None:
            self.alerts_log = LOGS_DIR / "alerts.jsonl"


@dataclass
class TradingConfig:
    """交易配置"""
    enabled: bool = True
    mode: str = "shadow"  # shadow / live
    frozen: bool = False
    
    def to_dict(self):
        return {
            "enabled": self.enabled,
            "mode": self.mode,
            "frozen": self.frozen
        }


# ============================================================
# 全局配置实例
# ============================================================
server_config = ServerConfig()
log_config = LogConfig()
trading_config = TradingConfig()


def load_trading_config() -> TradingConfig:
    """加载交易配置"""
    config_file = CONFIG_DIR / "trading.json"
    if config_file.exists():
        try:
            with open(config_file, "r") as f:
                data = json.load(f)
                return TradingConfig(
                    enabled=data.get("enabled", True),
                    mode=data.get("mode", "shadow"),
                    frozen=data.get("frozen", False)
                )
        except Exception:
            pass
    return trading_config


def save_trading_config(config: TradingConfig):
    """保存交易配置"""
    config_file = CONFIG_DIR / "trading.json"
    with open(config_file, "w") as f:
        json.dump(config.to_dict(), f, indent=2)