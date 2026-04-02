#!/usr/bin/env python3
"""
配置管理器 - ConfigManager

一个功能完善的 Python 类，用于管理应用程序配置文件。
支持 JSON/YAML 格式、配置验证、热重载、默认值管理和配置继承。

作者：小龙
版本：1.0.0
"""

import json
import os
import shutil
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler


class ConfigManager:
    """
    配置文件管理器
    
    功能特性:
    - 支持 JSON 和 YAML 配置文件
    - 自动配置验证
    - 文件变更热重载
    - 默认值管理
    - 配置继承/合并
    - 配置备份与恢复
    - 类型安全访问
    
    使用示例:
    ```python
    # 基础用法
    config = ConfigManager("config.json")
    db_host = config.get("database.host", "localhost")
    
    # 带验证的用法
    schema = {
        "type": "object",
        "properties": {
            "database": {
                "type": "object",
                "properties": {
                    "host": {"type": "string"},
                    "port": {"type": "integer", "minimum": 1, "maximum": 65535}
                },
                "required": ["host", "port"]
            }
        }
    }
    config = ConfigManager("config.json", schema=schema)
    
    # 热重载
    def on_reload(new_config):
        print("配置已更新")
    
    config = ConfigManager("config.json", auto_reload=True, reload_callback=on_reload)
    ```
    """
    
    SUPPORTED_FORMATS = ['.json', '.yaml', '.yml']
    
    def __init__(
        self,
        config_path: Union[str, Path],
        schema: Optional[Dict] = None,
        defaults: Optional[Dict] = None,
        auto_reload: bool = False,
        reload_callback: Optional[callable] = None,
        create_if_missing: bool = False,
        backup_on_save: bool = True,
        max_backups: int = 5
    ):
        """
        初始化配置管理器
        
        Args:
            config_path: 配置文件路径
            schema: JSON Schema 用于验证配置
            defaults: 默认配置值
            auto_reload: 是否自动监听文件变化并重载
            reload_callback: 配置重载时的回调函数
            create_if_missing: 文件不存在时是否创建
            backup_on_save: 保存时是否创建备份
            max_backups: 最大备份数量
        """
        self.config_path = Path(config_path).expanduser().resolve()
        self.schema = schema
        self.defaults = defaults or {}
        self.auto_reload = auto_reload
        self.reload_callback = reload_callback
        self.create_if_missing = create_if_missing
        self.backup_on_save = backup_on_save
        self.max_backups = max_backups
        
        self._config: Dict[str, Any] = {}
        self._last_modified: float = 0
        self._observer: Optional[Observer] = None
        self._file_exists: bool = False
        
        # 初始化
        self._load()
        
        if auto_reload:
            self._start_watching()
    
    def _load(self) -> None:
        """加载配置文件"""
        if not self.config_path.exists():
            if self.create_if_missing:
                self._config = self.defaults.copy()
                self.save()
            else:
                raise FileNotFoundError(f"配置文件不存在：{self.config_path}")
            return
        
        self._file_exists = True
        content = self.config_path.read_text(encoding='utf-8')
        self._last_modified = self.config_path.stat().st_mtime
        
        # 根据文件扩展名解析
        suffix = self.config_path.suffix.lower()
        if suffix == '.json':
            self._config = json.loads(content)
        elif suffix in ['.yaml', '.yml']:
            try:
                import yaml
                self._config = yaml.safe_load(content) or {}
            except ImportError:
                raise ImportError("YAML 支持需要安装 PyYAML: pip install pyyaml")
        else:
            raise ValueError(f"不支持的配置文件格式：{suffix}")
        
        # 合并默认值
        self._config = self._merge_dicts(self.defaults, self._config)
        
        # 验证配置
        if self.schema:
            self._validate()
    
    def _validate(self) -> None:
        """验证配置是否符合 schema"""
        try:
            import jsonschema
        except ImportError:
            raise ImportError("配置验证需要安装 jsonschema: pip install jsonschema")
        
        try:
            jsonschema.validate(instance=self._config, schema=self.schema)
        except jsonschema.ValidationError as e:
            raise ConfigValidationError(f"配置验证失败：{e.message}") from e
    
    def _merge_dicts(self, base: Dict, override: Dict) -> Dict:
        """递归合并两个字典"""
        result = base.copy()
        for key, value in override.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._merge_dicts(result[key], value)
            else:
                result[key] = value
        return result
    
    def _start_watching(self) -> None:
        """启动文件监控"""
        if self._observer:
            return
        
        class ConfigChangeHandler(FileSystemEventHandler):
            def __init__(self, manager):
                self.manager = manager
            
            def on_modified(self, event):
                if Path(event.src_path).resolve() == self.manager.config_path:
                    try:
                        self.manager._load()
                        if self.manager.reload_callback:
                            self.manager.reload_callback(self.manager._config)
                    except Exception as e:
                        print(f"配置重载失败：{e}")
        
        self._observer = Observer()
        self._observer.schedule(
            ConfigChangeHandler(self),
            str(self.config_path.parent),
            recursive=False
        )
        self._observer.start()
    
    def stop_watching(self) -> None:
        """停止文件监控"""
        if self._observer:
            self._observer.stop()
            self._observer.join()
            self._observer = None
    
    def get(self, key: str, default: Any = None) -> Any:
        """
        获取配置值
        
        Args:
            key: 配置键，支持点分隔符 (如 "database.host")
            default: 默认值
        
        Returns:
            配置值或默认值
        """
        keys = key.split('.')
        value = self._config
        
        try:
            for k in keys:
                value = value[k]
            return value
        except (KeyError, TypeError):
            return default
    
    def set(self, key: str, value: Any, save: bool = True) -> None:
        """
        设置配置值
        
        Args:
            key: 配置键，支持点分隔符
            value: 配置值
            save: 是否立即保存到文件
        """
        keys = key.split('.')
        config = self._config
        
        # 导航到父级
        for k in keys[:-1]:
            if k not in config:
                config[k] = {}
            config = config[k]
        
        # 设置值
        config[keys[-1]] = value
        
        # 验证
        if self.schema:
            self._validate()
        
        # 保存
        if save:
            self.save()
    
    def save(self, path: Optional[Union[str, Path]] = None) -> None:
        """
        保存配置到文件
        
        Args:
            path: 可选的保存路径，默认使用初始化路径
        """
        target_path = Path(path).expanduser().resolve() if path else self.config_path
        
        # 备份
        if self.backup_on_save and self._file_exists and target_path.exists():
            self._create_backup(target_path)
        
        # 创建父目录
        target_path.parent.mkdir(parents=True, exist_ok=True)
        
        # 序列化
        suffix = target_path.suffix.lower()
        if suffix == '.json':
            content = json.dumps(self._config, indent=2, ensure_ascii=False)
        elif suffix in ['.yaml', '.yml']:
            try:
                import yaml
                content = yaml.dump(self._config, allow_unicode=True, default_flow_style=False)
            except ImportError:
                raise ImportError("YAML 支持需要安装 PyYAML: pip install pyyaml")
        else:
            raise ValueError(f"不支持的配置文件格式：{suffix}")
        
        # 写入文件
        target_path.write_text(content, encoding='utf-8')
        self._file_exists = True
        self._last_modified = target_path.stat().st_mtime
    
    def _create_backup(self, path: Path) -> None:
        """创建配置备份"""
        if not path.exists():
            return
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
        backup_path = path.parent / f"{path.name}.backup_{timestamp}"
        shutil.copy2(path, backup_path)
        
        # 清理旧备份
        self._cleanup_backups(path)
    
    def _cleanup_backups(self, path: Path) -> None:
        """清理旧备份，保留最近的 max_backups 个"""
        pattern = f"{path.name}.backup_*"
        backups = sorted(path.parent.glob(pattern), key=lambda p: p.stat().st_mtime, reverse=True)
        
        for old_backup in backups[self.max_backups:]:
            old_backup.unlink()
    
    def reload(self) -> None:
        """手动重新加载配置"""
        self._load()
    
    def keys(self) -> List[str]:
        """获取所有顶层配置键"""
        return list(self._config.keys())
    
    def to_dict(self) -> Dict[str, Any]:
        """返回配置字典副本"""
        return self._config.copy()
    
    def has(self, key: str) -> bool:
        """检查配置键是否存在"""
        keys = key.split('.')
        value = self._config
        
        try:
            for k in keys:
                value = value[k]
            return True
        except (KeyError, TypeError):
            return False
    
    def delete(self, key: str, save: bool = True) -> bool:
        """
        删除配置键
        
        Args:
            key: 配置键
            save: 是否立即保存
        
        Returns:
            是否成功删除
        """
        keys = key.split('.')
        config = self._config
        
        # 导航到父级
        for k in keys[:-1]:
            if k not in config:
                return False
            config = config[k]
        
        # 删除键
        if keys[-1] in config:
            del config[keys[-1]]
            if save:
                self.save()
            return True
        return False
    
    def merge(self, other_config: Dict[str, Any], save: bool = True) -> None:
        """
        合并其他配置
        
        Args:
            other_config: 要合并的配置字典
            save: 是否立即保存
        """
        self._config = self._merge_dicts(self._config, other_config)
        
        if self.schema:
            self._validate()
        
        if save:
            self.save()
    
    def __getitem__(self, key: str) -> Any:
        """支持字典式访问 config['database']['host']"""
        value = self.get(key)
        if value is None:
            raise KeyError(f"配置键不存在：{key}")
        return value
    
    def __contains__(self, key: str) -> bool:
        """支持 in 操作符"""
        return self.has(key)
    
    def __repr__(self) -> str:
        return f"ConfigManager(path={self.config_path}, keys={len(self._config)})"
    
    def __del__(self):
        """析构时停止监控"""
        self.stop_watching()


class ConfigValidationError(Exception):
    """配置验证异常"""
    pass


class ConfigFileError(Exception):
    """配置文件操作异常"""
    pass


# 便捷函数
def load_config(
    path: Union[str, Path],
    schema: Optional[Dict] = None,
    defaults: Optional[Dict] = None
) -> ConfigManager:
    """
    便捷函数：加载配置
    
    Args:
        path: 配置文件路径
        schema: 验证 schema
        defaults: 默认值
    
    Returns:
        ConfigManager 实例
    """
    return ConfigManager(path, schema=schema, defaults=defaults)


def save_config(
    path: Union[str, Path],
    config: Dict[str, Any],
    format: str = 'json'
) -> None:
    """
    便捷函数：保存配置
    
    Args:
        path: 保存路径
        config: 配置字典
        format: 文件格式 (json/yaml)
    """
    path = Path(path).expanduser().resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    
    if format == 'json':
        content = json.dumps(config, indent=2, ensure_ascii=False)
    elif format in ['yaml', 'yml']:
        try:
            import yaml
            content = yaml.dump(config, allow_unicode=True, default_flow_style=False)
        except ImportError:
            raise ImportError("YAML 支持需要安装 PyYAML: pip install pyyaml")
    else:
        raise ValueError(f"不支持的格式：{format}")
    
    path.write_text(content, encoding='utf-8')


# 测试代码
if __name__ == '__main__':
    import tempfile
    
    print("=== ConfigManager 测试 ===\n")
    
    # 创建临时配置文件
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump({
            "database": {
                "host": "localhost",
                "port": 5432
            },
            "features": {
                "cache": True,
                "logging": True
            }
        }, f)
        temp_path = f.name
    
    try:
        # 测试基础功能
        print("1. 基础加载测试")
        config = ConfigManager(temp_path)
        print(f"   数据库主机：{config.get('database.host')}")
        print(f"   数据库端口：{config.get('database.port')}")
        print(f"   缓存启用：{config.get('features.cache')}")
        print()
        
        # 测试默认值
        print("2. 默认值测试")
        print(f"   不存在的键：{config.get('nonexistent', 'default_value')}")
        print()
        
        # 测试设置值
        print("3. 设置值测试")
        config.set('database.host', '192.168.1.100')
        print(f"   新主机：{config.get('database.host')}")
        print()
        
        # 测试字典式访问
        print("4. 字典式访问测试")
        print(f"   config['database']['port'] = {config['database']['port']}")
        print()
        
        # 测试合并
        print("5. 配置合并测试")
        config.merge({"new_feature": "enabled"})
        print(f"   新特性：{config.get('new_feature')}")
        print()
        
        # 测试删除
        print("6. 删除配置测试")
        config.delete('features.logging')
        print(f"   logging 已删除：{not config.has('features.logging')}")
        print()
        
        print("✓ 所有测试通过")
        
    finally:
        # 清理临时文件
        Path(temp_path).unlink()
