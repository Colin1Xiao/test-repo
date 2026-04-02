#!/usr/bin/env python3
"""
ConfigManager 使用示例

展示如何使用配置管理器处理各种场景
"""

import json
from pathlib import Path
from config_manager import ConfigManager, load_config, save_config


def example_basic_usage():
    """基础使用示例"""
    print("=== 示例 1: 基础使用 ===\n")
    
    # 创建示例配置
    config_data = {
        "app": {
            "name": "小龙交易系统",
            "version": "5.3.0",
            "debug": False
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
    
    # 保存配置
    config_path = Path(__file__).parent / "example_config.json"
    save_config(config_path, config_data)
    print(f"✓ 配置已保存到：{config_path}\n")
    
    # 加载配置
    config = load_config(config_path)
    
    # 读取配置
    print("读取配置:")
    print(f"  应用名称：{config.get('app.name')}")
    print(f"  数据库主机：{config.get('database.host')}")
    print(f"  API 超时：{config.get('api.timeout')} 秒")
    print(f"  OKX 端点：{config.get('api.endpoints.okx')}")
    print()
    
    # 修改配置
    config.set('database.pool_size', 20)
    config.set('app.debug', True)
    print("✓ 配置已更新")
    print(f"  新连接池大小：{config.get('database.pool_size')}")
    print(f"  调试模式：{config.get('app.debug')}\n")
    
    # 检查键是否存在
    print("检查配置键:")
    print(f"  'database.host' 存在：{config.has('database.host')}")
    print(f"  'database.password' 存在：{config.has('database.password')}")
    print()
    
    return config_path


def example_with_validation():
    """带验证的配置示例"""
    print("=== 示例 2: 配置验证 ===\n")
    
    # 定义 JSON Schema
    schema = {
        "type": "object",
        "properties": {
            "server": {
                "type": "object",
                "properties": {
                    "host": {"type": "string", "minLength": 1},
                    "port": {"type": "integer", "minimum": 1, "maximum": 65535},
                    "ssl": {"type": "boolean"}
                },
                "required": ["host", "port"]
            },
            "logging": {
                "type": "object",
                "properties": {
                    "level": {
                        "type": "string",
                        "enum": ["debug", "info", "warning", "error"]
                    },
                    "file": {"type": "string"}
                }
            }
        },
        "required": ["server"]
    }
    
    # 默认配置
    defaults = {
        "server": {
            "host": "localhost",
            "port": 8080,
            "ssl": False
        },
        "logging": {
            "level": "info",
            "file": "app.log"
        }
    }
    
    config_path = Path(__file__).parent / "validated_config.json"
    
    try:
        # 创建带验证的配置管理器
        config = ConfigManager(
            config_path,
            schema=schema,
            defaults=defaults,
            create_if_missing=True
        )
        
        print("✓ 配置验证通过")
        print(f"  服务器：{config.get('server.host')}:{config.get('server.port')}")
        print(f"  日志级别：{config.get('logging.level')}\n")
        
        # 尝试设置无效值（会触发验证异常）
        print("尝试设置无效的端口号...")
        try:
            config.set('server.port', 99999)  # 超出范围
        except Exception as e:
            print(f"✓ 验证捕获错误：{type(e).__name__}\n")
        
    except Exception as e:
        print(f"✗ 错误：{e}\n")
    
    return config_path


def example_with_defaults():
    """默认值管理示例"""
    print("=== 示例 3: 默认值管理 ===\n")
    
    # 定义完整的默认配置
    defaults = {
        "app": {
            "name": "MyApp",
            "version": "1.0.0",
            "debug": False
        },
        "database": {
            "host": "localhost",
            "port": 5432,
            "user": "admin",
            "password": "secret"
        },
        "features": {
            "cache": True,
            "metrics": False,
            "tracing": False
        }
    }
    
    # 创建空配置（将使用默认值）
    config_path = Path(__file__).parent / "default_config.json"
    
    config = ConfigManager(
        config_path,
        defaults=defaults,
        create_if_missing=True
    )
    
    print("✓ 使用默认配置创建")
    print(f"  应用：{config.get('app.name')} v{config.get('app.version')}")
    print(f"  数据库：{config.get('database.user')}@{config.get('database.host')}")
    print(f"  缓存：{'启用' if config.get('features.cache') else '禁用'}")
    print()
    
    # 部分覆盖默认值
    config.set('features.metrics', True)
    config.set('app.debug', True)
    
    print("✓ 部分配置已覆盖")
    print(f"  监控：{'启用' if config.get('features.metrics') else '禁用'}")
    print(f"  调试：{'启用' if config.get('app.debug') else '禁用'}")
    print()
    
    return config_path


def example_yaml_support():
    """YAML 配置示例"""
    print("=== 示例 4: YAML 配置支持 ===\n")
    
    try:
        import yaml
    except ImportError:
        print("⚠ PyYAML 未安装，跳过 YAML 示例\n")
        print("安装命令：pip install pyyaml\n")
        return None
    
    config_data = {
        "application": {
            "name": "小龙系统",
            "environment": "production"
        },
        "services": [
            {"name": "api", "port": 8080},
            {"name": "worker", "port": 8081},
            {"name": "scheduler", "port": 8082}
        ],
        "features": {
            "enabled": ["auth", "cache", "metrics"],
            "disabled": ["debug", "profiling"]
        }
    }
    
    config_path = Path(__file__).parent / "example_config.yaml"
    save_config(config_path, config_data, format='yaml')
    
    print(f"✓ YAML 配置已保存：{config_path}\n")
    
    # 加载 YAML 配置
    config = load_config(config_path)
    
    print("读取 YAML 配置:")
    print(f"  应用：{config.get('application.name')}")
    print(f"  环境：{config.get('application.environment')}")
    print(f"  服务数量：{len(config.get('services', []))}")
    print(f"  启用特性：{config.get('features.enabled')}")
    print()
    
    return config_path


def example_hot_reload():
    """热重载示例"""
    print("=== 示例 5: 配置热重载 ===\n")
    
    reload_count = [0]  # 使用列表以便在闭包中修改
    
    def on_reload(new_config):
        reload_count[0] += 1
        print(f"  [重载 #{reload_count[0]}] 配置已更新")
        print(f"    新值：{new_config.get('counter', 'N/A')}\n")
    
    config_path = Path(__file__).parent / "hot_reload_config.json"
    
    # 创建初始配置
    save_config(config_path, {"counter": 0, "name": "initial"})
    
    # 创建带热重载的配置管理器
    config = ConfigManager(
        config_path,
        auto_reload=True,
        reload_callback=on_reload
    )
    
    print("✓ 热重载监控已启动")
    print(f"  初始值：counter={config.get('counter')}\n")
    
    # 模拟外部修改
    print("模拟外部修改配置文件...")
    import time
    
    # 直接修改文件
    with open(config_path, 'w') as f:
        json.dump({"counter": 1, "name": "updated"}, f)
    
    # 等待文件监控触发
    time.sleep(1.5)
    
    print(f"  当前值：counter={config.get('counter')}")
    print()
    
    # 停止监控
    config.stop_watching()
    print("✓ 热重载监控已停止\n")
    
    return config_path


def example_backup_restore():
    """备份与恢复示例"""
    print("=== 示例 6: 配置备份与恢复 ===\n")
    
    config_path = Path(__file__).parent / "backup_config.json"
    
    # 创建配置
    config = ConfigManager(
        config_path,
        create_if_missing=True,
        backup_on_save=True,
        max_backups=3
    )
    
    # 多次修改触发备份
    for i in range(5):
        config.set('version', f'v{i}.0')
        config.set('data', {'iteration': i})
        print(f"✓ 保存版本 v{i}.0")
    
    print()
    
    # 查找备份文件
    backups = list(config_path.parent.glob("backup_config.json.backup_*"))
    print(f"创建的备份数量：{len(backups)}")
    print(f"最大保留数量：{config.max_backups}")
    
    if backups:
        print("\n最近的备份:")
        for backup in sorted(backups, reverse=True)[:3]:
            mtime = backup.stat().st_mtime
            print(f"  - {backup.name}")
    
    print()
    return config_path


def cleanup_examples():
    """清理示例文件"""
    print("=== 清理示例文件 ===\n")
    
    example_files = [
        "example_config.json",
        "example_config.yaml",
        "validated_config.json",
        "default_config.json",
        "hot_reload_config.json",
        "backup_config.json"
    ]
    
    backup_pattern = "backup_config.json.backup_*"
    
    base_path = Path(__file__).parent
    
    for filename in example_files:
        filepath = base_path / filename
        if filepath.exists():
            filepath.unlink()
            print(f"✓ 删除：{filename}")
    
    # 删除备份文件
    for backup in base_path.glob(backup_pattern):
        backup.unlink()
        print(f"✓ 删除备份：{backup.name}")
    
    print()


def main():
    """运行所有示例"""
    print("=" * 60)
    print("ConfigManager 使用示例")
    print("=" * 60)
    print()
    
    try:
        # 运行示例
        example_basic_usage()
        example_with_validation()
        example_with_defaults()
        example_yaml_support()
        example_hot_reload()
        example_backup_restore()
        
        print("=" * 60)
        print("所有示例运行完成!")
        print("=" * 60)
        print()
        
        # 询问是否清理
        response = input("是否清理示例文件？(y/n): ").strip().lower()
        if response == 'y':
            cleanup_examples()
            print("✓ 清理完成")
        
    except KeyboardInterrupt:
        print("\n\n中断，清理示例文件...")
        cleanup_examples()


if __name__ == '__main__':
    main()
