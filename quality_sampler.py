#!/usr/bin/env python3
"""
OpenClaw 结果质量抽样器
Quality Sampler for Multi-Model System
"""

import json
import random
from datetime import datetime
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict
from enum import Enum
import os


class QualityRating(Enum):
    """质量评级"""
    GOOD = "good"  # 好
    ACCEPTABLE = "acceptable"  # 可接受
    NEEDS_IMPROVEMENT = "needs_improvement"  # 需改进


@dataclass
class QualitySample:
    """质量样本"""
    sample_id: str
    timestamp: str
    model: str
    task_type: str
    input_text: str
    output_text: str
    rating: QualityRating
    issues: List[str]
    strengths: List[str]
    reviewer_notes: str


class QualitySampler:
    """质量抽样器"""
    
    def __init__(self, sample_dir: str = "/Users/colin/.openclaw/workspace/quality_samples"):
        self.sample_dir = sample_dir
        self.samples: List[QualitySample] = []
        self.daily_quota = 5  # 每类任务每日抽样数
        
        # 确保目录存在
        os.makedirs(sample_dir, exist_ok=True)
        
        # 质量评估维度
        self.quality_dimensions = {
            "FAST": {
                "dimensions": ["简洁性", "准确性", "完整性"],
                "issues": ["过度简略", "遗漏关键信息", "表达不清"],
                "strengths": ["简洁明了", "快速响应", "直击要点"]
            },
            "LONG": {
                "dimensions": ["结构性", "完整性", "准确性"],
                "issues": ["结构失衡", "遗漏重点", "冗余信息"],
                "strengths": ["结构清晰", "覆盖全面", "逻辑严密"]
            },
            "CODE": {
                "dimensions": ["可用性", "规范性", "完整性"],
                "issues": ["无法直接运行", "缺少注释", "边界处理缺失"],
                "strengths": ["可直接使用", "规范整洁", "考虑周全"]
            },
            "CODE-PLUS": {
                "dimensions": ["重构价值", "可维护性", "设计合理性"],
                "issues": ["重构价值低", "过度设计", "结构混乱"],
                "strengths": ["显著提升", "设计优雅", "易于维护"]
            },
            "GROK-CODE": {
                "dimensions": ["根因准确性", "排查可行性", "修复有效性"],
                "issues": ["根因定位错误", "排查步骤模糊", "修复建议无效"],
                "strengths": ["根因精准", "步骤清晰", "修复有效"]
            },
            "REASON": {
                "dimensions": ["逻辑严密性", "推理一致性", "结论合理性"],
                "issues": ["逻辑跳跃", "推理漂移", "结论牵强"],
                "strengths": ["逻辑严密", "推理清晰", "结论合理"]
            },
            "CN": {
                "dimensions": ["自然度", "专业性", "准确性"],
                "issues": ["过润色失真", "口语化过度", "专业术语错误"],
                "strengths": ["自然流畅", "专业得体", "准确传达"]
            },
            "MAIN": {
                "dimensions": ["压缩适度性", "信息完整性", "表达清晰度"],
                "issues": ["压缩过度", "信息丢失", "表达混乱"],
                "strengths": ["压缩得当", "信息完整", "表达清晰"]
            }
        }
    
    def should_sample(self, model: str, task_type: str) -> bool:
        """判断是否应该抽样"""
        # 获取今日已抽样数
        today_samples = self._count_today_samples(model, task_type)
        return today_samples < self.daily_quota
    
    def _count_today_samples(self, model: str, task_type: str) -> int:
        """统计今日已抽样数"""
        today = datetime.now().strftime("%Y-%m-%d")
        count = 0
        
        for filename in os.listdir(self.sample_dir):
            if filename.startswith(f"{today}_{model}_{task_type}"):
                count += 1
        
        return count
    
    def create_sample(self, model: str, task_type: str, 
                     input_text: str, output_text: str) -> QualitySample:
        """创建质量样本"""
        sample_id = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{model}_{random.randint(1000, 9999)}"
        
        sample = QualitySample(
            sample_id=sample_id,
            timestamp=datetime.now().isoformat(),
            model=model,
            task_type=task_type,
            input_text=input_text[:500],  # 截断输入
            output_text=output_text[:2000],  # 截断输出
            rating=QualityRating.ACCEPTABLE,  # 默认可接受
            issues=[],
            strengths=[],
            reviewer_notes=""
        )
        
        self.samples.append(sample)
        self._save_sample(sample)
        
        return sample
    
    def _save_sample(self, sample: QualitySample):
        """保存样本到文件"""
        date_str = datetime.now().strftime("%Y-%m-%d")
        filename = f"{date_str}_{sample.model}_{sample.task_type}_{sample.sample_id}.json"
        filepath = os.path.join(self.sample_dir, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(asdict(sample), f, indent=2, ensure_ascii=False)
    
    def review_sample(self, sample_id: str, rating: QualityRating,
                     issues: List[str], strengths: List[str], notes: str):
        """审核样本"""
        for sample in self.samples:
            if sample.sample_id == sample_id:
                sample.rating = rating
                sample.issues = issues
                sample.strengths = strengths
                sample.reviewer_notes = notes
                self._save_sample(sample)
                break
    
    def auto_review(self, sample: QualitySample) -> QualitySample:
        """自动审核（基于启发式规则）"""
        model = sample.model
        output = sample.output_text
        
        if model not in self.quality_dimensions:
            return sample
        
        dimensions = self.quality_dimensions[model]
        issues = []
        strengths = []
        
        # 启发式检测
        if model == "FAST":
            if len(output) < 50:
                issues.append("过度简略")
            elif len(output) > 200:
                issues.append("不够简洁")
            else:
                strengths.append("简洁明了")
        
        elif model == "LONG":
            if "###" not in output and "##" not in output:
                issues.append("结构失衡")
            if len(output) < 300:
                issues.append("可能遗漏重点")
            if "总结" in output or "结论" in output:
                strengths.append("结构清晰")
        
        elif model == "CODE":
            if "```" not in output:
                issues.append("代码格式不规范")
            if "def " not in output and "class " not in output:
                issues.append("可能缺少核心代码")
            if "# " in output or '"""' in output:
                strengths.append("有注释")
        
        elif model == "GROK-CODE":
            if "根因" not in output and "原因" not in output:
                issues.append("根因定位可能不准确")
            if "排查" not in output:
                issues.append("缺少排查步骤")
            if "修复" in output or "建议" in output:
                strengths.append("有修复建议")
        
        elif model == "REASON":
            if "因为" not in output and "原因" not in output:
                issues.append("推理链可能不清晰")
            if "所以" in output or "因此" in output:
                strengths.append("推理清晰")
        
        elif model == "CN":
            if "的" in output and output.count("的") > output.count(" ") * 0.3:
                issues.append("可能过润色")
            if "您" in output or "请" in output:
                strengths.append("礼貌得体")
        
        elif model == "MAIN":
            if len(output) < 100:
                issues.append("可能压缩过度")
            if "结论" in output and "理由" in output:
                strengths.append("结构完整")
        
        # 评级
        if len(issues) >= 2:
            sample.rating = QualityRating.NEEDS_IMPROVEMENT
        elif len(issues) == 1:
            sample.rating = QualityRating.ACCEPTABLE
        else:
            sample.rating = QualityRating.GOOD
        
        sample.issues = issues
        sample.strengths = strengths
        sample.reviewer_notes = f"自动审核：基于启发式规则"
        
        self._save_sample(sample)
        return sample
    
    def generate_daily_report(self) -> Dict:
        """生成每日质量报告"""
        today = datetime.now().strftime("%Y-%m-%d")
        today_samples = [s for s in self.samples if s.timestamp.startswith(today)]
        
        if not today_samples:
            return {"message": "今日无样本"}
        
        # 按模型统计
        model_stats = {}
        for sample in today_samples:
            model = sample.model
            if model not in model_stats:
                model_stats[model] = {
                    "count": 0,
                    "good": 0,
                    "acceptable": 0,
                    "needs_improvement": 0
                }
            
            model_stats[model]["count"] += 1
            if sample.rating == QualityRating.GOOD:
                model_stats[model]["good"] += 1
            elif sample.rating == QualityRating.ACCEPTABLE:
                model_stats[model]["acceptable"] += 1
            else:
                model_stats[model]["needs_improvement"] += 1
        
        # 计算质量分
        total = len(today_samples)
        good_count = sum(1 for s in today_samples if s.rating == QualityRating.GOOD)
        acceptable_count = sum(1 for s in today_samples if s.rating == QualityRating.ACCEPTABLE)
        
        quality_score = (good_count * 100 + acceptable_count * 70) / total if total > 0 else 0
        
        return {
            "date": today,
            "total_samples": total,
            "quality_score": quality_score,
            "model_breakdown": model_stats
        }


if __name__ == "__main__":
    print("质量抽样器已加载")