#!/usr/bin/env python3
"""
Configuration Loader
统一配置加载模块
"""

import json
import sys
from pathlib import Path


def load_config(skill_name='crypto-data'):
    """
    加载配置文件
    
    Args:
        skill_name: 技能名称 (crypto-data, crypto-execute 等)
    
    Returns:
        dict: 配置信息
    
    Raises:
        FileNotFoundError: 配置文件不存在
        json.JSONDecodeError: JSON 格式错误
    """
    # 基础路径
    base_path = Path.home() / '.openclaw' / 'workspace' / 'skills'
    
    # 可能的配置文件路径
    config_paths = [
        base_path / skill_name / 'config.json',
        base_path / 'crypto-common' / 'config.json',
        Path(__file__).parent.parent / skill_name / 'config.json',
    ]
    
    # 查找配置文件
    for path in config_paths:
        if path.exists():
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    return _validate_config(config, skill_name)
            except json.JSONDecodeError as e:
                print(f"错误：配置文件格式错误 ({path}) - {e}", file=sys.stderr)
                raise
            except Exception as e:
                print(f"错误：读取配置文件失败 ({path}) - {e}", file=sys.stderr)
                raise
    
    # 配置文件不存在时返回默认配置
    print(f"警告：未找到配置文件，使用默认配置", file=sys.stderr)
    return _get_default_config(skill_name)


def _validate_config(config, skill_name):
    """验证配置"""
    # 检查必需的 API 密钥（针对需要 API 的技能）
    if skill_name in ['crypto-execute', 'crypto-data']:
        if not config.get('apiKey') and skill_name == 'crypto-execute':
            print("警告：配置文件中缺少 apiKey，交易功能将不可用", file=sys.stderr)
    
    return config


def _get_default_config(skill_name):
    """默认配置"""
    return {
        'exchange': 'okx',
        'testnet': True,
        'timeout': 30000,  # 30 秒超时
        'enableRateLimit': True,
    }


def save_config(config, skill_name='crypto-data'):
    """
    保存配置文件
    
    Args:
        config: 配置字典
        skill_name: 技能名称
    """
    base_path = Path.home() / '.openclaw' / 'workspace' / 'skills'
    config_dir = base_path / skill_name
    
    # 创建目录
    config_dir.mkdir(parents=True, exist_ok=True)
    
    config_path = config_dir / 'config.json'
    
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
    
    print(f"配置已保存到 {config_path}")
    
    # 提醒用户添加到 gitignore
    gitignore_path = config_dir / '.gitignore'
    if not gitignore_path.exists():
        print("\n⚠️  提醒：请确保 config.json 已添加到 .gitignore，避免泄露 API 密钥！")
