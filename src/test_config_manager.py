#!/usr/bin/env python3
"""
ConfigManager 单元测试
"""

import json
import tempfile
import time
from pathlib import Path
import sys

# 添加 src 目录到路径
sys.path.insert(0, str(Path(__file__).parent))

from config_manager import ConfigManager, load_config, save_config, ConfigValidationError


class TestConfigManager:
    """ConfigManager 测试类"""
    
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
    
    def assert_equal(self, actual, expected, message=""):
        """断言相等"""
        if actual == expected:
            self.passed += 1
            return True
        else:
            self.failed += 1
            error = f"{message or '断言失败'}: 期望 {expected}, 得到 {actual}"
            self.errors.append(error)
            print(f"  ✗ {error}")
            return False
    
    def assert_true(self, condition, message=""):
        """断言为真"""
        if condition:
            self.passed += 1
            return True
        else:
            self.failed += 1
            error = message or "断言失败：条件不为真"
            self.errors.append(error)
            print(f"  ✗ {error}")
            return False
    
    def assert_raises(self, exception_type, func, *args, **kwargs):
        """断言抛出异常"""
        try:
            func(*args, **kwargs)
            self.failed += 1
            error = f"期望抛出 {exception_type.__name__}, 但未抛出"
            self.errors.append(error)
            print(f"  ✗ {error}")
            return False
        except exception_type:
            self.passed += 1
            return True
        except Exception as e:
            self.failed += 1
            error = f"期望抛出 {exception_type.__name__}, 但抛出 {type(e).__name__}: {e}"
            self.errors.append(error)
            print(f"  ✗ {error}")
            return False
    
    def test_basic_load(self):
        """测试基础加载"""
        print("\n测试 1: 基础加载")
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump({"key": "value", "nested": {"a": 1}}, f)
            temp_path = f.name
        
        try:
            config = ConfigManager(temp_path)
            self.assert_equal(config.get('key'), 'value', "读取简单键")
            self.assert_equal(config.get('nested.a'), 1, "读取嵌套键")
            self.assert_equal(config.get('nonexistent', 'default'), 'default', "默认值")
        finally:
            Path(temp_path).unlink()
    
    def test_set_and_save(self):
        """测试设置和保存"""
        print("\n测试 2: 设置和保存")
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump({"initial": "value"}, f)
            temp_path = f.name
        
        try:
            config = ConfigManager(temp_path)
            config.set('new_key', 'new_value')
            self.assert_equal(config.get('new_key'), 'new_value', "设置新键")
            
            # 重新加载验证持久化
            config2 = ConfigManager(temp_path)
            self.assert_equal(config2.get('new_key'), 'new_value', "持久化验证")
        finally:
            Path(temp_path).unlink()
    
    def test_nested_set(self):
        """测试嵌套设置"""
        print("\n测试 3: 嵌套设置")
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump({}, f)
            temp_path = f.name
        
        try:
            config = ConfigManager(temp_path)
            config.set('a.b.c', 'deep_value')
            self.assert_equal(config.get('a.b.c'), 'deep_value', "深层嵌套设置")
            self.assert_true(config.has('a.b'), "中间层级存在")
        finally:
            Path(temp_path).unlink()
    
    def test_delete(self):
        """测试删除"""
        print("\n测试 4: 删除配置")
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump({"keep": "this", "delete": "this"}, f)
            temp_path = f.name
        
        try:
            config = ConfigManager(temp_path)
            result = config.delete('delete')
            self.assert_true(result, "删除返回值")
            self.assert_true(not config.has('delete'), "键已删除")
            
            result2 = config.delete('nonexistent')
            self.assert_true(not result2, "删除不存在的键返回 False")
        finally:
            Path(temp_path).unlink()
    
    def test_merge(self):
        """测试合并"""
        print("\n测试 5: 配置合并")
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump({"a": 1, "b": 2}, f)
            temp_path = f.name
        
        try:
            config = ConfigManager(temp_path)
            config.merge({"b": 3, "c": 4})
            
            self.assert_equal(config.get('a'), 1, "保留原值")
            self.assert_equal(config.get('b'), 3, "覆盖旧值")
            self.assert_equal(config.get('c'), 4, "添加新值")
        finally:
            Path(temp_path).unlink()
    
    def test_deep_merge(self):
        """测试深度合并"""
        print("\n测试 6: 深度合并")
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump({
                "database": {
                    "host": "localhost",
                    "port": 5432,
                    "options": {"pool": 10}
                }
            }, f)
            temp_path = f.name
        
        try:
            config = ConfigManager(temp_path)
            config.merge({
                "database": {
                    "port": 3306,
                    "options": {"timeout": 30}
                }
            })
            
            self.assert_equal(config.get('database.host'), 'localhost', "保留未修改字段")
            self.assert_equal(config.get('database.port'), 3306, "覆盖嵌套值")
            self.assert_equal(config.get('database.options.pool'), 10, "保留兄弟字段")
            self.assert_equal(config.get('database.options.timeout'), 30, "添加新字段")
        finally:
            Path(temp_path).unlink()
    
    def test_validation(self):
        """测试配置验证"""
        print("\n测试 7: 配置验证")
        
        schema = {
            "type": "object",
            "properties": {
                "port": {"type": "integer", "minimum": 1, "maximum": 65535}
            },
            "required": ["port"]
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump({"port": 8080}, f)
            temp_path = f.name
        
        try:
            config = ConfigManager(temp_path, schema=schema)
            self.assert_true(config.has('port'), "有效配置加载成功")
            
            # 尝试设置无效值
            self.assert_raises(
                ConfigValidationError,
                config.set,
                'port', -1
            )
        finally:
            Path(temp_path).unlink()
    
    def test_defaults(self):
        """测试默认值"""
        print("\n测试 8: 默认值管理")
        
        defaults = {
            "app": {"name": "DefaultApp", "version": "1.0"},
            "debug": False
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump({"app": {"name": "CustomApp"}}, f)
            temp_path = f.name
        
        try:
            config = ConfigManager(temp_path, defaults=defaults)
            
            self.assert_equal(config.get('app.name'), 'CustomApp', "文件值覆盖默认值")
            self.assert_equal(config.get('app.version'), '1.0', "保留默认值")
            self.assert_equal(config.get('debug'), False, "使用默认值")
        finally:
            Path(temp_path).unlink()
    
    def test_dict_access(self):
        """测试字典式访问"""
        print("\n测试 9: 字典式访问")
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump({"key": "value"}, f)
            temp_path = f.name
        
        try:
            config = ConfigManager(temp_path)
            
            self.assert_equal(config['key'], 'value', "字典读取")
            self.assert_true('key' in config, "in 操作符")
            self.assert_true('nonexistent' not in config, "not in 操作符")
            
            self.assert_raises(KeyError, lambda: config['nonexistent'])
        finally:
            Path(temp_path).unlink()
    
    def test_keys(self):
        """测试获取所有键"""
        print("\n测试 10: 获取所有键")
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump({"a": 1, "b": 2, "c": 3}, f)
            temp_path = f.name
        
        try:
            config = ConfigManager(temp_path)
            keys = config.keys()
            
            self.assert_equal(len(keys), 3, "键数量")
            self.assert_true('a' in keys, "包含键 a")
            self.assert_true('b' in keys, "包含键 b")
            self.assert_true('c' in keys, "包含键 c")
        finally:
            Path(temp_path).unlink()
    
    def test_to_dict(self):
        """测试导出字典"""
        print("\n测试 11: 导出字典")
        
        original = {"a": 1, "b": {"c": 2}}
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(original, f)
            temp_path = f.name
        
        try:
            config = ConfigManager(temp_path)
            exported = config.to_dict()
            
            self.assert_equal(exported, original, "导出内容正确")
            
            # 验证是副本
            exported['a'] = 999
            self.assert_equal(config.get('a'), 1, "导出的是副本")
        finally:
            Path(temp_path).unlink()
    
    def test_backup(self):
        """测试备份功能"""
        print("\n测试 12: 配置备份")
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump({"v": 1}, f)
            temp_path = f.name
        
        try:
            config = ConfigManager(temp_path, backup_on_save=True, max_backups=2)
            
            # 多次修改触发备份
            config.set('v', 2)
            config.set('v', 3)
            config.set('v', 4)
            
            # 查找备份文件（只查找当前文件的备份）
            backup_pattern = f"{Path(temp_path).name}.backup_*"
            backups = list(Path(temp_path).parent.glob(backup_pattern))
            self.assert_true(len(backups) <= 2, f"备份数量不超过限制 (实际:{len(backups)})")
        finally:
            Path(temp_path).unlink()
            # 清理备份
            for backup in Path(temp_path).parent.glob(backup_pattern):
                backup.unlink()
    
    def test_yaml_support(self):
        """测试 YAML 支持"""
        print("\n测试 13: YAML 支持")
        
        try:
            import yaml
        except ImportError:
            print("  ⚠ PyYAML 未安装，跳过")
            self.passed += 1
            return
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
            yaml.dump({"key": "value", "number": 42}, f)
            temp_path = f.name
        
        try:
            config = ConfigManager(temp_path)
            self.assert_equal(config.get('key'), 'value', "YAML 读取")
            self.assert_equal(config.get('number'), 42, "YAML 数字")
            
            config.set('new', 'data')
            config.save()
            
            # 重新加载验证
            config2 = ConfigManager(temp_path)
            self.assert_equal(config2.get('new'), 'data', "YAML 保存")
        finally:
            Path(temp_path).unlink()
    
    def test_create_if_missing(self):
        """测试创建缺失文件"""
        print("\n测试 14: 自动创建文件")
        
        temp_path = Path(tempfile.gettempdir()) / f"test_config_{time.time()}.json"
        
        try:
            defaults = {"created": True, "value": "default"}
            config = ConfigManager(temp_path, defaults=defaults, create_if_missing=True)
            
            self.assert_true(temp_path.exists(), "文件已创建")
            self.assert_equal(config.get('created'), True, "使用默认值")
        finally:
            if temp_path.exists():
                temp_path.unlink()
    
    def test_file_not_found(self):
        """测试文件不存在异常"""
        print("\n测试 15: 文件不存在异常")
        
        temp_path = "/nonexistent/path/config.json"
        
        self.assert_raises(
            FileNotFoundError,
            ConfigManager,
            temp_path
        )
    
    def test_hot_reload(self):
        """测试热重载"""
        print("\n测试 16: 热重载")
        
        reload_count = [0]
        
        def on_reload(config):
            reload_count[0] += 1
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump({"v": 1}, f)
            temp_path = f.name
        
        try:
            config = ConfigManager(
                temp_path,
                auto_reload=True,
                reload_callback=on_reload
            )
            
            # 修改文件
            with open(temp_path, 'w') as f:
                json.dump({"v": 2}, f)
            
            time.sleep(1.5)  # 等待监控触发
            
            self.assert_true(reload_count[0] > 0, f"触发重载 (次数:{reload_count[0]})")
            self.assert_equal(config.get('v'), 2, "配置已更新")
            
            config.stop_watching()
        finally:
            Path(temp_path).unlink()
    
    def test_convenience_functions(self):
        """测试便捷函数"""
        print("\n测试 17: 便捷函数")
        
        temp_path = Path(tempfile.gettempdir()) / f"test_convenience_{time.time()}.json"
        
        try:
            # 测试 save_config
            save_config(temp_path, {"test": "data"})
            self.assert_true(temp_path.exists(), "save_config 创建文件")
            
            # 测试 load_config
            config = load_config(temp_path)
            self.assert_equal(config.get('test'), 'data', "load_config 加载")
        finally:
            if temp_path.exists():
                temp_path.unlink()
    
    def run_all(self):
        """运行所有测试"""
        print("=" * 60)
        print("ConfigManager 单元测试")
        print("=" * 60)
        
        tests = [
            self.test_basic_load,
            self.test_set_and_save,
            self.test_nested_set,
            self.test_delete,
            self.test_merge,
            self.test_deep_merge,
            self.test_validation,
            self.test_defaults,
            self.test_dict_access,
            self.test_keys,
            self.test_to_dict,
            self.test_backup,
            self.test_yaml_support,
            self.test_create_if_missing,
            self.test_file_not_found,
            self.test_hot_reload,
            self.test_convenience_functions,
        ]
        
        for test in tests:
            try:
                test()
            except Exception as e:
                self.failed += 1
                self.errors.append(f"{test.__name__}: {e}")
                print(f"  ✗ 异常：{e}")
        
        print("\n" + "=" * 60)
        print(f"测试结果：{self.passed} 通过，{self.failed} 失败")
        print("=" * 60)
        
        if self.errors:
            print("\n错误详情:")
            for error in self.errors:
                print(f"  - {error}")
        
        return self.failed == 0


if __name__ == '__main__':
    tester = TestConfigManager()
    success = tester.run_all()
    sys.exit(0 if success else 1)
