#!/usr/bin/env python3
"""
Config Version Manager - 配置版本管理器

核心职责：
1. 每次参数变更自动备份
2. 可随时rollback
3. 版本历史追踪

实盘必须能力：参数调错 → 一键回退
"""

import json
import shutil
import os
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Optional
from dataclasses import dataclass


@dataclass
class ConfigVersion:
    """配置版本"""
    version: int
    timestamp: str
    file_path: str
    reason: str
    changes: List[str]


class ConfigVersionManager:
    """
    配置版本管理器
    
    核心能力：
    1. save_version() - 保存当前配置版本
    2. rollback() - 回滚到指定版本
    3. list_versions() - 列出所有版本
    4. compare_versions() - 对比版本差异
    """
    
    def __init__(self, config_path: str = None):
        """
        初始化版本管理器
        
        Args:
            config_path: 主配置文件路径
        """
        # 路径
        self.config_path = Path(config_path or "config/trader_config.json")
        self.history_dir = self.config_path.parent / "history"
        self.history_dir.mkdir(parents=True, exist_ok=True)
        
        # 版本追踪
        self.current_version = 0
        self.versions: List[ConfigVersion] = []
        
        # 加载现有版本
        self._load_existing_versions()
        
        print("📦 Config Version Manager 初始化完成")
        print(f"   配置文件: {self.config_path}")
        print(f"   历史目录: {self.history_dir}")
        print(f"   现有版本: {len(self.versions)}")
    
    def _load_existing_versions(self):
        """加载现有版本"""
        if not self.history_dir.exists():
            return
        
        for file in sorted(self.history_dir.glob("config_*.json")):
            try:
                # 解析文件名
                name = file.stem  # config_20260318_230000
                parts = name.split('_')
                if len(parts) >= 3:
                    timestamp = f"{parts[1]}_{parts[2]}"
                    
                    # 读取元数据
                    meta_file = file.with_suffix('.meta.json')
                    if meta_file.exists():
                        with open(meta_file, 'r') as f:
                            meta = json.load(f)
                    else:
                        meta = {'reason': 'unknown', 'changes': []}
                    
                    version = ConfigVersion(
                        version=len(self.versions) + 1,
                        timestamp=timestamp,
                        file_path=str(file),
                        reason=meta.get('reason', 'unknown'),
                        changes=meta.get('changes', [])
                    )
                    self.versions.append(version)
            except Exception as e:
                print(f"⚠️  加载版本失败 {file}: {e}")
        
        if self.versions:
            self.current_version = self.versions[-1].version
    
    def save_version(self, reason: str = "manual", changes: List[str] = None) -> str:
        """
        保存当前配置版本
        
        Args:
            reason: 保存原因
            changes: 变更内容列表
        
        Returns:
            备份文件路径
        """
        if not self.config_path.exists():
            print(f"⚠️  配置文件不存在: {self.config_path}")
            return ""
        
        # 生成时间戳
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # 备份文件路径
        backup_path = self.history_dir / f"config_{timestamp}.json"
        
        # 复制配置文件
        shutil.copy(self.config_path, backup_path)
        
        # 保存元数据
        meta = {
            'version': self.current_version + 1,
            'timestamp': timestamp,
            'reason': reason,
            'changes': changes or [],
            'created_at': datetime.now().isoformat()
        }
        
        meta_path = backup_path.with_suffix('.meta.json')
        with open(meta_path, 'w', encoding='utf-8') as f:
            json.dump(meta, f, indent=2, ensure_ascii=False)
        
        # 记录版本
        version = ConfigVersion(
            version=self.current_version + 1,
            timestamp=timestamp,
            file_path=str(backup_path),
            reason=reason,
            changes=changes or []
        )
        self.versions.append(version)
        self.current_version = version.version
        
        print(f"✅ 配置已备份: v{self.current_version}")
        print(f"   文件: {backup_path}")
        print(f"   原因: {reason}")
        
        return str(backup_path)
    
    def rollback(self, version: int = None) -> tuple:
        """
        回滚到指定版本
        
        Args:
            version: 目标版本号（默认回滚到上一版本）
        
        Returns:
            (success: bool, message: str)
        """
        if not self.versions:
            return False, "无历史版本可回滚"
        
        # 确定目标版本
        if version is None:
            target = self.versions[-1]
        else:
            target = next((v for v in self.versions if v.version == version), None)
            if not target:
                return False, f"未找到版本 v{version}"
        
        # 先保存当前状态
        self.save_version(reason="pre_rollback_backup", changes=[f"回滚前备份"])
        
        # 执行回滚
        try:
            shutil.copy(target.file_path, self.config_path)
            
            print(f"\n⏪ 配置已回滚")
            print(f"   目标版本: v{target.version}")
            print(f"   时间: {target.timestamp}")
            print(f"   原因: {target.reason}")
            
            return True, f"已回滚到 v{target.version} ({target.timestamp})"
            
        except Exception as e:
            return False, f"回滚失败: {e}"
    
    def rollback_to_original(self) -> tuple:
        """回滚到原始配置"""
        if not self.versions:
            return False, "无历史版本"
        
        # 第一个版本即为原始配置
        return self.rollback(version=1)
    
    def list_versions(self, limit: int = 10) -> List[Dict[str, Any]]:
        """列出最近的版本"""
        recent = self.versions[-limit:] if len(self.versions) > limit else self.versions
        
        return [
            {
                'version': v.version,
                'timestamp': v.timestamp,
                'reason': v.reason,
                'changes': v.changes,
                'file': v.file_path
            }
            for v in recent
        ]
    
    def compare_versions(self, v1: int, v2: int) -> Dict[str, Any]:
        """对比两个版本的差异"""
        ver1 = next((v for v in self.versions if v.version == v1), None)
        ver2 = next((v for v in self.versions if v.version == v2), None)
        
        if not ver1 or not ver2:
            return {'error': '版本不存在'}
        
        # 读取配置内容
        with open(ver1.file_path, 'r') as f:
            config1 = json.load(f)
        with open(ver2.file_path, 'r') as f:
            config2 = json.load(f)
        
        # 对比差异
        diff = self._diff_configs(config1, config2)
        
        return {
            'v1': v1,
            'v2': v2,
            'differences': diff
        }
    
    def _diff_configs(self, c1: Dict, c2: Dict, path: str = "") -> List[str]:
        """递归对比配置差异"""
        diffs = []
        
        all_keys = set(c1.keys()) | set(c2.keys())
        
        for key in all_keys:
            current_path = f"{path}.{key}" if path else key
            
            if key not in c1:
                diffs.append(f"{current_path}: 新增 → {c2[key]}")
            elif key not in c2:
                diffs.append(f"{current_path}: 删除 (原值: {c1[key]})")
            elif c1[key] != c2[key]:
                if isinstance(c1[key], dict) and isinstance(c2[key], dict):
                    diffs.extend(self._diff_configs(c1[key], c2[key], current_path))
                else:
                    diffs.append(f"{current_path}: {c1[key]} → {c2[key]}")
        
        return diffs
    
    def get_current_version(self) -> int:
        """获取当前版本号"""
        return self.current_version
    
    def get_version_info(self, version: int) -> Optional[Dict[str, Any]]:
        """获取版本信息"""
        v = next((x for x in self.versions if x.version == version), None)
        if v:
            return {
                'version': v.version,
                'timestamp': v.timestamp,
                'reason': v.reason,
                'changes': v.changes
            }
        return None


# 创建默认实例
_default_manager = None

def get_manager() -> ConfigVersionManager:
    """获取全局管理器实例"""
    global _default_manager
    if _default_manager is None:
        _default_manager = ConfigVersionManager()
    return _default_manager