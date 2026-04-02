#!/usr/bin/env python3
"""
Backup Skill - 自动备份技能
支持文件、数据库、配置的定期备份和恢复
"""

import os
import sys
import json
import shutil
import tarfile
import gzip
import hashlib
from datetime import datetime, timedelta
from pathlib import Path

class BackupManager:
    def __init__(self, config_path=None):
        self.config = self._load_config(config_path)
        self.backup_dir = Path(self.config.get('dest', '~/Backups')).expanduser()
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        
    def _load_config(self, config_path):
        """加载配置文件"""
        default_config = {
            'sources': [
                '~/.openclaw/workspace/',
                '~/.openclaw/openclaw.json'
            ],
            'dest': '~/Backups/',
            'retention': 30,
            'compress': True,
            'encrypt': False
        }
        
        if config_path and Path(config_path).exists():
            with open(config_path) as f:
                return {**default_config, **json.load(f)}
        
        # 尝试加载用户配置
        user_config = Path('~/.openclaw/backup/config.json').expanduser()
        if user_config.exists():
            with open(user_config) as f:
                return {**default_config, **json.load(f)}
        
        return default_config
    
    def backup_workspace(self, name='workspace'):
        """备份工作区"""
        source = Path('~/.openclaw/workspace/').expanduser()
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_name = f"{name}_{timestamp}.tar.gz"
        backup_path = self.backup_dir / backup_name
        
        print(f"📁 备份工作区: {source} -> {backup_path}")
        
        with tarfile.open(backup_path, 'w:gz') as tar:
            tar.add(source, arcname='workspace')
        
        print(f"✅ 备份完成: {backup_path}")
        self._cleanup_old_backups(name)
        return backup_path
    
    def backup_database(self, db_path, name=None):
        """备份数据库"""
        db_path = Path(db_path).expanduser()
        if not db_path.exists():
            raise FileNotFoundError(f"数据库不存在: {db_path}")
        
        name = name or db_path.stem
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_name = f"db_{name}_{timestamp}.db.gz"
        backup_path = self.backup_dir / backup_name
        
        print(f"🗄️ 备份数据库: {db_path} -> {backup_path}")
        
        with open(db_path, 'rb') as f_in:
            with gzip.open(backup_path, 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)
        
        print(f"✅ 数据库备份完成: {backup_path}")
        self._cleanup_old_backups(f'db_{name}')
        return backup_path
    
    def backup_config(self):
        """备份配置文件"""
        configs = [
            '~/.openclaw/openclaw.json',
            '~/.openclaw/agents/',
        ]
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_name = f"config_{timestamp}.tar.gz"
        backup_path = self.backup_dir / backup_name
        
        print(f"⚙️ 备份配置...")
        
        with tarfile.open(backup_path, 'w:gz') as tar:
            for config in configs:
                config_path = Path(config).expanduser()
                if config_path.exists():
                    tar.add(config_path, arcname=config_path.name)
        
        print(f"✅ 配置备份完成: {backup_path}")
        self._cleanup_old_backups('config')
        return backup_path
    
    def restore(self, backup_path, dest=None):
        """恢复备份"""
        backup_path = Path(backup_path).expanduser()
        if not backup_path.exists():
            raise FileNotFoundError(f"备份文件不存在: {backup_path}")
        
        dest = Path(dest or '~/.openclaw/workspace_restore').expanduser()
        dest.mkdir(parents=True, exist_ok=True)
        
        print(f"🔄 恢复备份: {backup_path} -> {dest}")
        
        if backup_path.suffix == '.gz' and '.db' in backup_path.name:
            # 数据库恢复
            with gzip.open(backup_path, 'rb') as f_in:
                with open(dest / backup_path.stem, 'wb') as f_out:
                    shutil.copyfileobj(f_in, f_out)
        else:
            # tar.gz 恢复
            with tarfile.open(backup_path, 'r:gz') as tar:
                tar.extractall(dest)
        
        print(f"✅ 恢复完成: {dest}")
        return dest
    
    def _cleanup_old_backups(self, prefix):
        """清理过期备份"""
        retention_days = self.config.get('retention', 30)
        cutoff = datetime.now() - timedelta(days=retention_days)
        
        for backup_file in self.backup_dir.glob(f'{prefix}_*'):
            try:
                # 从文件名解析日期
                date_str = backup_file.stem.split('_')[-2] + '_' + backup_file.stem.split('_')[-1]
                file_date = datetime.strptime(date_str, '%Y%m%d_%H%M%S')
                
                if file_date < cutoff:
                    print(f"🗑️ 删除过期备份: {backup_file}")
                    backup_file.unlink()
            except (ValueError, IndexError):
                continue
    
    def list_backups(self):
        """列出所有备份"""
        print("📋 备份列表:")
        for backup_file in sorted(self.backup_dir.glob('*')):
            if backup_file.is_file():
                size = backup_file.stat().st_size / 1024 / 1024  # MB
                mtime = datetime.fromtimestamp(backup_file.stat().st_mtime)
                print(f"  {backup_file.name:50} {size:8.2f} MB  {mtime:%Y-%m-%d %H:%M:%S}")


def main():
    if len(sys.argv) < 2:
        print("Usage: backup.py <command> [options]")
        print("Commands:")
        print("  workspace          - 备份工作区")
        print("  database <path>    - 备份数据库")
        print("  config             - 备份配置")
        print("  restore <path>     - 恢复备份")
        print("  list               - 列出备份")
        sys.exit(1)
    
    command = sys.argv[1]
    manager = BackupManager()
    
    try:
        if command == 'workspace':
            manager.backup_workspace()
        elif command == 'database':
            if len(sys.argv) < 3:
                print("Error: 请指定数据库路径")
                sys.exit(1)
            manager.backup_database(sys.argv[2])
        elif command == 'config':
            manager.backup_config()
        elif command == 'restore':
            if len(sys.argv) < 3:
                print("Error: 请指定备份文件路径")
                sys.exit(1)
            manager.restore(sys.argv[2])
        elif command == 'list':
            manager.list_backups()
        else:
            print(f"Unknown command: {command}")
            sys.exit(1)
    except Exception as e:
        print(f"❌ 错误: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
