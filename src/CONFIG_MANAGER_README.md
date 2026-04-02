# ConfigManager - Python 配置管理器

一个功能完善的 Python 类，用于管理应用程序配置文件。

## 🚀 特性

- ✅ **多格式支持** - JSON 和 YAML 配置文件
- ✅ **配置验证** - 基于 JSON Schema 的自动验证
- ✅ **热重载** - 文件变更自动重新加载
- ✅ **默认值管理** - 优雅的配置默认值
- ✅ **配置继承** - 深度合并多个配置源
- ✅ **备份恢复** - 自动备份，可配置保留数量
- ✅ **类型安全** - 支持点分隔符的嵌套访问
- ✅ **字典式访问** - 支持 `config['key']` 和 `in` 操作符

## 📦 安装依赖

```bash
pip3 install --break-system-packages watchdog pyyaml jsonschema
```

## 🔧 快速开始

### 基础用法

```python
from config_manager import ConfigManager

# 加载配置
config = ConfigManager("config.json")

# 读取配置（支持点分隔符）
db_host = config.get("database.host", "localhost")
db_port = config.get("database.port", 5432)

# 设置配置
config.set("database.host", "192.168.1.100")

# 字典式访问
value = config["database"]["port"]
if "database" in config:
    print("数据库已配置")
```

### 带验证的配置

```python
from config_manager import ConfigManager

schema = {
    "type": "object",
    "properties": {
        "server": {
            "type": "object",
            "properties": {
                "host": {"type": "string"},
                "port": {"type": "integer", "minimum": 1, "maximum": 65535}
            },
            "required": ["host", "port"]
        }
    },
    "required": ["server"]
}

defaults = {
    "server": {
        "host": "localhost",
        "port": 8080
    }
}

# 创建带验证的配置管理器
config = ConfigManager(
    "config.json",
    schema=schema,
    defaults=defaults,
    create_if_missing=True
)

# 无效值会抛出 ConfigValidationError
config.set("server.port", 99999)  # 超出范围，抛出异常
```

### 热重载

```python
from config_manager import ConfigManager

def on_reload(new_config):
    print("配置已更新!")
    print(f"新值：{new_config.get('some_key')}")

# 创建带热重载的配置管理器
config = ConfigManager(
    "config.json",
    auto_reload=True,
    reload_callback=on_reload
)

# 当配置文件被外部修改时，会自动重新加载并调用回调

# 停止监控
config.stop_watching()
```

### 配置备份

```python
from config_manager import ConfigManager

# 创建带备份的配置管理器
config = ConfigManager(
    "config.json",
    backup_on_save=True,
    max_backups=5  # 保留最近 5 个备份
)

# 每次保存都会自动创建备份
config.set("key", "value")

# 备份文件命名：config.json.backup_20260402_143025
```

### 配置合并

```python
from config_manager import ConfigManager

config = ConfigManager("base_config.json")

# 合并其他配置（深度合并）
config.merge({
    "database": {
        "port": 3306,  # 覆盖
        "timeout": 30   # 新增
    },
    "new_feature": "enabled"  # 新增
})
```

### 便捷函数

```python
from config_manager import load_config, save_config

# 快速加载
config = load_config("config.json")

# 快速保存
save_config("config.json", {"key": "value"})

# 保存为 YAML
save_config("config.yaml", {"key": "value"}, format='yaml')
```

## 📖 API 参考

### ConfigManager 类

#### 初始化参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `config_path` | str/Path | 必填 | 配置文件路径 |
| `schema` | Dict | None | JSON Schema 验证规则 |
| `defaults` | Dict | None | 默认配置值 |
| `auto_reload` | bool | False | 自动监听文件变化 |
| `reload_callback` | callable | None | 配置重载回调函数 |
| `create_if_missing` | bool | False | 文件不存在时创建 |
| `backup_on_save` | bool | True | 保存时创建备份 |
| `max_backups` | int | 5 | 最大备份数量 |

#### 主要方法

| 方法 | 说明 |
|------|------|
| `get(key, default)` | 获取配置值，支持点分隔符 |
| `set(key, value, save=True)` | 设置配置值 |
| `has(key)` | 检查配置键是否存在 |
| `delete(key, save=True)` | 删除配置键 |
| `save(path=None)` | 保存配置到文件 |
| `reload()` | 手动重新加载配置 |
| `merge(other_config, save=True)` | 合并其他配置 |
| `keys()` | 获取所有顶层键 |
| `to_dict()` | 返回配置字典副本 |
| `stop_watching()` | 停止文件监控 |

#### 特殊方法

- `__getitem__(key)` - 支持 `config['key']` 访问
- `__contains__(key)` - 支持 `key in config`
- `__repr__()` - 字符串表示

### 异常类

- `ConfigValidationError` - 配置验证失败
- `ConfigFileError` - 配置文件操作错误

## 📝 示例配置文件

### JSON 格式

```json
{
  "app": {
    "name": "小龙交易系统",
    "version": "5.3.0",
    "debug": false
  },
  "database": {
    "host": "localhost",
    "port": 5432,
    "name": "trading_db",
    "pool_size": 10
  },
  "api": {
    "timeout": 30,
    "retry": 3,
    "endpoints": {
      "okx": "https://www.okx.com",
      "binance": "https://www.binance.com"
    }
  }
}
```

### YAML 格式

```yaml
app:
  name: 小龙交易系统
  version: 5.3.0
  debug: false

database:
  host: localhost
  port: 5432
  name: trading_db
  pool_size: 10

api:
  timeout: 30
  retry: 3
  endpoints:
    okx: https://www.okx.com
    binance: https://www.binance.com
```

## 🧪 运行测试

```bash
cd /Users/colin/.openclaw/workspace/src
python3 test_config_manager.py
```

## 🎯 使用场景

1. **应用程序配置** - 管理应用的各种配置项
2. **环境配置** - 区分开发、测试、生产环境
3. **用户设置** - 保存用户偏好和自定义配置
4. **热更新配置** - 无需重启即可更新配置
5. **配置版本控制** - 自动备份，可回滚

## ⚠️ 注意事项

1. **文件监控** - 热重载使用文件监控，使用完毕后调用 `stop_watching()` 释放资源
2. **并发写入** - 不支持多进程并发写入同一配置文件
3. **YAML 依赖** - YAML 支持需要安装 PyYAML
4. **验证依赖** - 配置验证需要安装 jsonschema
5. **备份空间** - 注意 `max_backups` 设置，避免占用过多磁盘空间

## 📄 文件结构

```
src/
├── config_manager.py          # 主模块
├── config_manager_example.py  # 使用示例
├── test_config_manager.py     # 单元测试
└── CONFIG_MANAGER_README.md   # 本文档
```

## 🔄 版本历史

### v1.0.0 (2026-04-02)
- 初始版本
- 支持 JSON/YAML
- 配置验证
- 热重载
- 自动备份
- 深度合并

---

**作者**: 小龙  
**创建日期**: 2026-04-02  
**Python 版本**: 3.14+
