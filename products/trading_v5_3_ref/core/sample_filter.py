#!/usr/bin/env python3
"""
Sample Filter - 样本污染过滤器

核心职责：
决定哪些样本可以进入学习
过滤"执行不干净"、"异常"的交易

防止系统"学坏"

⚠️ 单位系统强制规范：
- 所有阈值使用 constants.py 中的常量
- 禁止硬编码
"""

from dataclasses import dataclass
from typing import Dict, Any, List
from enum import Enum
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from constants import (
    PCT, BPS, 
    MIN_EXECUTION_QUALITY,
    MAX_SAMPLE_SLIPPAGE,
    MAX_SAMPLE_LATENCY,
    MIN_FILL_RATIO,
    MAX_PRICE_JUMP,
    assert_unit_valid
)


class RejectionReason(Enum):
    """拒绝原因"""
    EXECUTION_QUALITY = "execution_quality_low"
    SLIPPAGE_HIGH = "slippage_too_high"
    LATENCY_HIGH = "latency_too_high"
    API_ERROR = "api_error"
    PARTIAL_FILL = "partial_fill"
    PRICE_JUMP = "price_jump_detected"


@dataclass
class FilterResult:
    """过滤结果"""
    is_valid: bool
    rejection_reasons: List[str]
    quality_score: float
    
    def __str__(self):
        if self.is_valid:
            return f"✅ 有效样本 (质量={self.quality_score:.2f})"
        else:
            return f"❌ 污染样本: {', '.join(self.rejection_reasons)}"


class SampleFilter:
    """
    样本污染过滤器
    
    过滤条件（单位已规范）：
    1. 执行质量 < 0.7 → 拒绝
    2. 滑点 > 0.05% (5 bps) → 拒绝
    3. 延迟 > 1.0s → 拒绝
    4. API异常 → 拒绝
    5. 部分成交 (<80%) → 拒绝
    6. 价格跳跃 > 0.05% → 拒绝
    
    只有"干净样本"才进入学习
    """
    
    def __init__(self, config: Dict[str, Any] = None):
        """
        初始化过滤器
        """
        self.config = config or {}
        
        # 过滤阈值 - 使用 constants
        self.min_execution_quality = MIN_EXECUTION_QUALITY
        self.max_slippage = MAX_SAMPLE_SLIPPAGE  # 0.05% = 0.0005
        self.max_latency = MAX_SAMPLE_LATENCY    # 1.0s
        self.max_price_jump = MAX_PRICE_JUMP     # 0.05%
        self.min_fill_ratio = MIN_FILL_RATIO     # 0.8
        
        # 统计
        self.total_samples = 0
        self.valid_samples = 0
        self.rejected_samples = 0
        self.rejection_stats = {reason.value: 0 for reason in RejectionReason}
        
        print("🧹 Sample Filter 初始化完成")
        print(f"   执行质量阈值: ≥{self.min_execution_quality}")
        print(f"   滑点阈值: ≤{self.max_slippage/BPS:.0f} bps ({self.max_slippage/PCT:.2f}%)")
        print(f"   延迟阈值: ≤{self.max_latency}s")
        print(f"   成交比阈值: ≥{self.min_fill_ratio*100:.0f}%")
    
    def is_valid(self, trade: Dict[str, Any]) -> FilterResult:
        """
        判断样本是否有效
        
        Args:
            trade: 交易记录，需包含:
                - slippage: 滑点（小数形式，如 0.005 = 0.5%）
                - delay / latency: 延迟（秒）
                - fill_ratio: 成交比例（小数形式）
                - api_error: API错误标记
                - price_jump: 价格跳跃标记
                - execution_quality_score: 执行质量分数（可选）
        
        Returns:
            FilterResult
        """
        self.total_samples += 1
        
        rejection_reasons = []
        
        # 提取参数
        slippage = abs(trade.get('slippage', 0))
        latency = trade.get('delay', trade.get('latency', 0))
        fill_ratio = trade.get('fill_ratio', 1.0)
        api_error = trade.get('api_error', False)
        price_jump = trade.get('price_jump', 0)
        execution_quality = trade.get('execution_quality_score', 1.0)
        
        # ============================================================
        # 单位断言 - 防止单位混淆
        # ============================================================
        # 如果 slippage > 0.1，说明可能是百分比形式（如 0.5 而非 0.005）
        if slippage > 0.1:
            print(f"⚠️ 警告: slippage={slippage} 过大，可能单位错误（应为小数形式如 0.005）")
            # 自动纠正：假设是百分比形式
            slippage = slippage * PCT
        
        # ============================================================
        # 过滤检查
        # ============================================================
        
        # 1. 滑点检查 - 核心风控
        if slippage > self.max_slippage:
            rejection_reasons.append(
                f"{RejectionReason.SLIPPAGE_HIGH.value}: {slippage/BPS:.1f}bps > {self.max_slippage/BPS:.0f}bps"
            )
            self.rejection_stats[RejectionReason.SLIPPAGE_HIGH.value] += 1
        
        # 2. 延迟检查
        if latency > self.max_latency:
            rejection_reasons.append(
                f"{RejectionReason.LATENCY_HIGH.value}: {latency:.2f}s > {self.max_latency}s"
            )
            self.rejection_stats[RejectionReason.LATENCY_HIGH.value] += 1
        
        # 3. 成交比例检查
        if fill_ratio < self.min_fill_ratio:
            rejection_reasons.append(
                f"{RejectionReason.PARTIAL_FILL.value}: {fill_ratio*100:.0f}% < {self.min_fill_ratio*100:.0f}%"
            )
            self.rejection_stats[RejectionReason.PARTIAL_FILL.value] += 1
        
        # 4. API错误检查
        if api_error:
            rejection_reasons.append(RejectionReason.API_ERROR.value)
            self.rejection_stats[RejectionReason.API_ERROR.value] += 1
        
        # 5. 价格跳跃检查
        if abs(price_jump) > self.max_price_jump:
            rejection_reasons.append(
                f"{RejectionReason.PRICE_JUMP.value}: {price_jump/BPS:.1f}bps > {self.max_price_jump/BPS:.0f}bps"
            )
            self.rejection_stats[RejectionReason.PRICE_JUMP.value] += 1
        
        # 6. 执行质量检查
        if execution_quality < self.min_execution_quality:
            rejection_reasons.append(
                f"{RejectionReason.EXECUTION_QUALITY.value}: {execution_quality:.2f} < {self.min_execution_quality}"
            )
            self.rejection_stats[RejectionReason.EXECUTION_QUALITY.value] += 1
        
        # ============================================================
        # 计算质量分数（0-1）
        # ============================================================
        quality_score = self._calculate_quality_score(
            slippage, latency, fill_ratio, execution_quality
        )
        
        # ============================================================
        # 判定结果
        # ============================================================
        is_valid = len(rejection_reasons) == 0
        
        if is_valid:
            self.valid_samples += 1
        else:
            self.rejected_samples += 1
        
        return FilterResult(
            is_valid=is_valid,
            rejection_reasons=rejection_reasons,
            quality_score=quality_score
        )
    
    def _calculate_quality_score(
        self, 
        slippage: float, 
        latency: float, 
        fill_ratio: float,
        execution_quality: float
    ) -> float:
        """
        计算样本质量分数
        
        分数范围：0-1
        - 滑点惩罚：最高扣 0.5
        - 延迟惩罚：最高扣 0.3
        - 成交比惩罚：最高扣 0.2
        """
        score = 1.0
        
        # 滑点惩罚（相对于阈值）
        # 滑点越大，惩罚越重
        slippage_ratio = slippage / self.max_slippage
        slippage_penalty = min(slippage_ratio, 2.0) * 0.25  # 最高扣 0.5
        score -= slippage_penalty
        
        # 延迟惩罚
        latency_ratio = latency / self.max_latency
        latency_penalty = min(latency_ratio, 2.0) * 0.15  # 最高扣 0.3
        score -= latency_penalty
        
        # 成交比惩罚
        fill_penalty = (1 - fill_ratio) * 1.0  # 未成交部分全部惩罚
        score -= fill_penalty * 0.2  # 最高扣 0.2
        
        # 执行质量加成
        score = score * (0.5 + 0.5 * execution_quality)
        
        return max(0.0, min(1.0, score))
    
    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        return {
            'total_samples': self.total_samples,
            'valid_samples': self.valid_samples,
            'rejected_samples': self.rejected_samples,
            'valid_rate': self.valid_samples / max(self.total_samples, 1),
            'rejection_rate': self.rejected_samples / max(self.total_samples, 1),
            'rejection_breakdown': self.rejection_stats.copy()
        }
    
    def print_stats(self):
        """打印统计信息"""
        stats = self.get_stats()
        print("\n" + "="*50)
        print("📊 Sample Filter 统计")
        print("="*50)
        print(f"总样本数: {stats['total_samples']}")
        print(f"有效样本: {stats['valid_samples']} ({stats['valid_rate']*100:.1f}%)")
        print(f"拒绝样本: {stats['rejected_samples']} ({stats['rejection_rate']*100:.1f}%)")
        print("\n拒绝原因分布:")
        for reason, count in stats['rejection_breakdown'].items():
            if count > 0:
                print(f"  - {reason}: {count}")
        print("="*50)


# ============================================================
# 测试代码
# ============================================================
if __name__ == "__main__":
    filter = SampleFilter()
    
    # 测试样本
    test_samples = [
        {'slippage': 0.0003, 'latency': 0.5, 'fill_ratio': 0.95},  # 优质
        {'slippage': 0.001, 'latency': 0.8, 'fill_ratio': 0.9},    # 滑点超标
        {'slippage': 0.0003, 'latency': 1.5, 'fill_ratio': 0.9},   # 延迟超标
        {'slippage': 0.0003, 'latency': 0.5, 'fill_ratio': 0.7},   # 成交比不足
        {'slippage': 0.05, 'latency': 0.5, 'fill_ratio': 0.95},    # 单位错误（自动纠正后拒绝）
    ]
    
    print("\n测试样本过滤:")
    for i, sample in enumerate(test_samples):
        result = filter.is_valid(sample)
        print(f"\n样本 {i+1}: {result}")
        print(f"  原始: slippage={sample['slippage']}, latency={sample['latency']}, fill={sample['fill_ratio']}")
    
    filter.print_stats()