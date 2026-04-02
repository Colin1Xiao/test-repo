#!/usr/bin/env python3
"""
Parameter Guard - 参数守护者

核心职责：
1. 限制每次参数变化幅度
2. 强制绝对底线（防止自杀）
3. 记录所有变更审计日志

防止系统"慢慢变成垃圾策略"
"""

from dataclasses import dataclass
from typing import Dict, Any, Optional, List
from datetime import datetime
import copy
import json
from pathlib import Path


@dataclass
class ParameterChange:
    """参数变更记录"""
    regime: str
    parameter: str
    old_value: float
    new_value: float
    change: float
    is_valid: bool
    reason: str


class ParameterGuard:
    """
    参数守护者
    
    反失控机制：
    1. 单次变化限制 - 防止突变
    2. 绝对底线 - 防止自杀
    3. 审计日志 - 可追溯
    """
    
    def __init__(self, config: Dict[str, Any] = None):
        """
        初始化守护者
        """
        # 当前配置快照
        self.current_config = config or {}
        self.original_config = copy.deepcopy(config) if config else {}
        
        # 变化限制
        self.max_score_change = 5          # 单次评分阈值最大变化
        self.max_volume_change = 0.2       # 单次成交量阈值最大变化
        
        # 绝对底线（防止自杀）
        self.min_score_floor = 60          # 评分阈值最低值
        self.max_score_ceiling = 90        # 评分阈值最高值
        self.min_volume_floor = 0.5        # 成交量阈值最低值
        self.max_volume_ceiling = 2.0      # 成交量阈值最高值
        
        # 审计日志
        self.audit_log: List[Dict[str, Any]] = []
        self.rejected_changes: List[Dict[str, Any]] = []
        
        # 配置版本
        self.config_version = 1
        self.config_history = []
        
        print("🛡️ Parameter Guard 初始化完成")
        print(f"   单次变化限制: 评分±{self.max_score_change}, 成交量±{self.max_volume_change}")
        print(f"   绝对底线: 评分≥{self.min_score_floor}, 成交量≥{self.min_volume_floor}")
    
    def validate(
        self, 
        old_config: Dict[str, Any], 
        new_config: Dict[str, Any]
    ) -> tuple:
        """
        验证配置变更是否安全
        
        Args:
            old_config: 当前配置
            new_config: 提议的新配置
        
        Returns:
            (is_valid: bool, changes: List[ParameterChange])
        """
        all_changes = []
        all_valid = True
        
        for regime in old_config:
            if regime not in new_config:
                continue
            
            old = old_config[regime]
            new = new_config[regime]
            
            # 检查评分阈值
            if 'min_score' in old and 'min_score' in new:
                change = ParameterChange(
                    regime=regime,
                    parameter='min_score',
                    old_value=old['min_score'],
                    new_value=new['min_score'],
                    change=new['min_score'] - old['min_score'],
                    is_valid=True,
                    reason=''
                )
                
                # 检查变化幅度
                if abs(change.change) > self.max_score_change:
                    change.is_valid = False
                    change.reason = f"变化幅度{abs(change.change)}>{self.max_score_change}"
                    all_valid = False
                
                # 检查底线
                if new['min_score'] < self.min_score_floor:
                    change.is_valid = False
                    change.reason = f"低于底线{self.min_score_floor}"
                    all_valid = False
                
                # 检查天花板
                if new['min_score'] > self.max_score_ceiling:
                    change.is_valid = False
                    change.reason = f"高于天花板{self.max_score_ceiling}"
                    all_valid = False
                
                all_changes.append(change)
            
            # 检查成交量阈值
            if 'min_volume' in old and 'min_volume' in new:
                change = ParameterChange(
                    regime=regime,
                    parameter='min_volume',
                    old_value=old['min_volume'],
                    new_value=new['min_volume'],
                    change=new['min_volume'] - old['min_volume'],
                    is_valid=True,
                    reason=''
                )
                
                # 检查变化幅度
                if abs(change.change) > self.max_volume_change:
                    change.is_valid = False
                    change.reason = f"变化幅度{abs(change.change):.2f}>{self.max_volume_change}"
                    all_valid = False
                
                # 检查底线
                if new['min_volume'] < self.min_volume_floor:
                    change.is_valid = False
                    change.reason = f"低于底线{self.min_volume_floor}"
                    all_valid = False
                
                # 检查天花板
                if new['min_volume'] > self.max_volume_ceiling:
                    change.is_valid = False
                    change.reason = f"高于天花板{self.max_volume_ceiling}"
                    all_valid = False
                
                all_changes.append(change)
        
        return all_valid, all_changes
    
    def apply(
        self, 
        new_config: Dict[str, Any], 
        reason: str = "optimizer_adjustment"
    ) -> tuple:
        """
        应用新配置（经过验证）
        
        Args:
            new_config: 新配置
            reason: 变更原因
        
        Returns:
            (success: bool, message: str)
        """
        # 验证
        is_valid, changes = self.validate(self.current_config, new_config)
        
        if not is_valid:
            # 记录拒绝的变更
            rejected = {
                'timestamp': datetime.now().isoformat(),
                'reason': reason,
                'changes': [
                    {
                        'regime': c.regime,
                        'parameter': c.parameter,
                        'attempted_value': c.new_value,
                        'rejection_reason': c.reason
                    }
                    for c in changes if not c.is_valid
                ]
            }
            self.rejected_changes.append(rejected)
            
            # 汇总拒绝原因
            reasons = [c.reason for c in changes if not c.is_valid]
            return False, f"变更被拒绝: {'; '.join(reasons)}"
        
        # 保存历史版本
        self.config_history.append({
            'version': self.config_version,
            'timestamp': datetime.now().isoformat(),
            'config': copy.deepcopy(self.current_config),
            'reason': reason
        })
        
        # 应用新配置
        self.current_config = copy.deepcopy(new_config)
        self.config_version += 1
        
        # 记录审计日志
        audit_entry = {
            'timestamp': datetime.now().isoformat(),
            'version': self.config_version,
            'reason': reason,
            'changes': [
                {
                    'regime': c.regime,
                    'parameter': c.parameter,
                    'old': c.old_value,
                    'new': c.new_value,
                    'change': c.change
                }
                for c in changes
            ]
        }
        self.audit_log.append(audit_entry)
        
        # 打印变更
        print(f"\n✅ 参数变更已应用 (v{self.config_version})")
        for c in changes:
            print(f"   {c.regime}.{c.parameter}: {c.old_value} → {c.new_value}")
        
        return True, f"配置已更新到版本 {self.config_version}"
    
    def rollback(self, version: int = None) -> tuple:
        """
        回滚到指定版本
        
        Args:
            version: 目标版本号（默认回滚到上一版本）
        
        Returns:
            (success: bool, message: str)
        """
        if not self.config_history:
            return False, "无历史版本可回滚"
        
        if version is None:
            # 回滚到上一版本
            target = self.config_history[-1]
        else:
            # 查找指定版本
            target = next(
                (h for h in self.config_history if h['version'] == version),
                None
            )
            if not target:
                return False, f"未找到版本 {version}"
        
        # 保存当前版本到历史
        self.config_history.append({
            'version': self.config_version,
            'timestamp': datetime.now().isoformat(),
            'config': copy.deepcopy(self.current_config),
            'reason': 'pre_rollback_backup'
        })
        
        # 回滚
        self.current_config = copy.deepcopy(target['config'])
        self.config_version += 1
        
        print(f"\n⏪ 已回滚到版本 {target['version']}")
        
        return True, f"已回滚到版本 {target['version']}"
    
    def reset_to_original(self) -> tuple:
        """重置到原始配置"""
        if not self.original_config:
            return False, "无原始配置"
        
        # 保存当前版本
        self.config_history.append({
            'version': self.config_version,
            'timestamp': datetime.now().isoformat(),
            'config': copy.deepcopy(self.current_config),
            'reason': 'pre_reset_backup'
        })
        
        self.current_config = copy.deepcopy(self.original_config)
        self.config_version += 1
        
        print("\n🔄 已重置到原始配置")
        
        return True, "已重置到原始配置"
    
    def get_config(self, regime: str = None) -> Dict[str, Any]:
        """获取当前配置"""
        if regime:
            return self.current_config.get(regime, {})
        return self.current_config
    
    def get_audit_summary(self) -> str:
        """获取审计摘要"""
        lines = [
            f"📋 参数变更审计摘要",
            f"─" * 40,
            f"当前版本: v{self.config_version}",
            f"历史版本: {len(self.config_history)}",
            f"拒绝变更: {len(self.rejected_changes)}",
            f""
        ]
        
        if self.audit_log:
            lines.append("最近变更:")
            for entry in self.audit_log[-3:]:
                lines.append(f"  v{entry['version']}: {entry['reason']}")
        
        return "\n".join(lines)


# 创建默认实例
_default_guard = None

def get_guard() -> ParameterGuard:
    """获取全局守护者实例"""
    global _default_guard
    if _default_guard is None:
        _default_guard = ParameterGuard()
    return _default_guard