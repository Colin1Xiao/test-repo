#!/usr/bin/env python3
"""
Dynamic Config Center - 动态配置中心
P3 优先级改进：支持热更新配置
"""

import json
import time
from pathlib import Path
from typing import Dict, Any, Callable
from dataclasses import dataclass


@dataclass
class ConfigChange:
    """配置变更"""
    key: str
    old_value: Any
    new_value: Any
    timestamp: float


class DynamicConfig:
    """动态配置中心"""
    
    def __init__(self, config_path: str):
        self.config_path = Path(config_path)
        self.config: Dict = {}
        self.last_modified = 0
        self.callbacks: Dict[str, list] = {}
        self._load_config()
    
    def _load_config(self):
        """加载配置"""
        if self.config_path.exists():
            with open(self.config_path, 'r') as f:
                self.config = json.load(f)
            self.last_modified = self.config_path.stat().st_mtime
    
    def get(self, key: str, default=None):
        """获取配置"""
        return self.config.get(key, default)
    
    def set(self, key: str, value: Any):
        """设置配置"""
        old = self.config.get(key)
        self.config[key] = value
        
        # 触发回调
        if key in self.callbacks:
            for cb in self.callbacks[key]:
                cb(key, old, value)
    
    def on_change(self, key: str, callback: Callable):
        """注册变更回调"""
        if key not in self.callbacks:
            self.callbacks[key] = []
        self.callbacks[key].append(callback)
    
    def save(self):
        """保存配置"""
        with open(self.config_path, 'w') as f:
            json.dump(self.config, f, indent=2)


if __name__ == "__main__":
    config = DynamicConfig("config.json")
    print("动态配置中心已加载")
