#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
市场情感分析脚本
使用 FinBERT 等 NLP 模型对采集的数据进行情感分析
"""

import json
import logging
import os
from datetime import datetime
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from pathlib import Path

import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import numpy as np
from tqdm import tqdm

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@dataclass
class SentimentResult:
    """情感分析结果"""
    text: str
    source: str
    timestamp: datetime
    polarity: float  # -1 到 +1
    label: str  # very_positive, positive, neutral, negative, very_negative
    confidence: float
    intensity: float  # 0 到 1
    language: str = "en"


class SentimentAnalyzer:
    """
    情感分析器
    支持多模型、多语言
    """
    
    # 情感标签映射
    LABEL_MAP = {
        0: 'very_negative',
        1: 'negative',
        2: 'neutral',
        3: 'positive',
        4: 'very_positive'
    }
    
    LABEL_TO_POLARITY = {
        'very_negative': -1.0,
        'negative': -0.5,
        'neutral': 0.0,
        'positive': 0.5,
        'very_positive': 1.0
    }
    
    def __init__(
        self,
        model_name: str = "ProsusAI/finbert",
        device: str = None,
        cache_dir: str = None
    ):
        """
        初始化情感分析器
        
        Args:
            model_name: HuggingFace 模型名称
            device: 运行设备 (cuda/cpu)
            cache_dir: 模型缓存目录
        """
        self.device = device or ('cuda' if torch.cuda.is_available() else 'cpu')
        self.cache_dir = cache_dir or os.path.expanduser("~/.cache/sentiment")
        
        logger.info(f"加载情感分析模型：{model_name} (设备：{self.device})")
        
        # 加载模型和分词器
        self.tokenizer = AutoTokenizer.from_pretrained(
            model_name,
            cache_dir=self.cache_dir
        )
        self.model = AutoModelForSequenceClassification.from_pretrained(
            model_name,
            cache_dir=self.cache_dir
        )
        self.model.to(self.device)
        self.model.eval()
        
        logger.info("模型加载完成")
    
    def analyze(self, text: str, source: str = "unknown") -> SentimentResult:
        """
        分析单条文本的情感
        
        Args:
            text: 待分析文本
            source: 数据来源
            
        Returns:
            SentimentResult: 情感分析结果
        """
        # 文本预处理
        text = self._preprocess(text)
        
        # 分词
        inputs = self.tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            max_length=512,
            padding=True
        )
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        
        # 推理
        with torch.no_grad():
            outputs = self.model(**inputs)
            probabilities = torch.softmax(outputs.logits, dim=1)[0]
            prediction = torch.argmax(probabilities).item()
        
        # 解析结果
        label = self.LABEL_MAP.get(prediction, 'neutral')
        polarity = self.LABEL_TO_POLARITY[label]
        confidence = probabilities[prediction].item()
        intensity = abs(polarity)
        
        return SentimentResult(
            text=text[:100],  # 只保存前 100 字符
            source=source,
            timestamp=datetime.now(),
            polarity=polarity,
            label=label,
            confidence=confidence,
            intensity=intensity
        )
    
    def analyze_batch(
        self,
        texts: List[str],
        sources: List[str] = None,
        batch_size: int = 32
    ) -> List[SentimentResult]:
        """
        批量分析文本情感
        
        Args:
            texts: 文本列表
            sources: 来源列表 (可选)
            batch_size: 批次大小
            
        Returns:
            List[SentimentResult]: 情感分析结果列表
        """
        if sources is None:
            sources = ["unknown"] * len(texts)
        
        results = []
        
        for i in tqdm(range(0, len(texts), batch_size), desc="情感分析"):
            batch_texts = texts[i:i + batch_size]
            batch_sources = sources[i:i + batch_size]
            
            # 预处理
            batch_texts = [self._preprocess(t) for t in batch_texts]
            
            # 分词
            inputs = self.tokenizer(
                batch_texts,
                return_tensors="pt",
                truncation=True,
                max_length=512,
                padding=True
            )
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            
            # 推理
            with torch.no_grad():
                outputs = self.model(**inputs)
                probabilities = torch.softmax(outputs.logits, dim=1)
                predictions = torch.argmax(probabilities, dim=1)
            
            # 解析结果
            for j, (pred, prob) in enumerate(zip(predictions, probabilities)):
                pred_idx = pred.item()
                label = self.LABEL_MAP.get(pred_idx, 'neutral')
                polarity = self.LABEL_TO_POLARITY[label]
                confidence = prob[pred_idx].item()
                intensity = abs(polarity)
                
                results.append(SentimentResult(
                    text=batch_texts[j][:100],
                    source=batch_sources[j],
                    timestamp=datetime.now(),
                    polarity=polarity,
                    label=label,
                    confidence=confidence,
                    intensity=intensity
                ))
        
        return results
    
    def _preprocess(self, text: str) -> str:
        """文本预处理"""
        if not text:
            return ""
        
        # 去除 URL
        import re
        text = re.sub(r'http\S+|www\.\S+', '', text)
        
        # 去除@提及
        text = re.sub(r'@\w+', '', text)
        
        # 去除特殊字符
        text = re.sub(r'[^\w\s\u4e00-\u9fff.,!?]', '', text)
        
        # 去除多余空白
        text = ' '.join(text.split())
        
        return text.strip()


class SentimentAggregator:
    """
    情感聚合器
    计算综合情感指标
    """
    
    def __init__(self):
        self.results: List[SentimentResult] = []
    
    def add_result(self, result: SentimentResult):
        """添加分析结果"""
        self.results.append(result)
    
    def add_results(self, results: List[SentimentResult]):
        """批量添加分析结果"""
        self.results.extend(results)
    
    def calculate_metrics(self, time_window: str = '1h') -> Dict:
        """
        计算情感指标
        
        Args:
            time_window: 时间窗口 (1h, 4h, 24h)
            
        Returns:
            Dict: 情感指标
        """
        if not self.results:
            return {}
        
        # 过滤时间窗口
        now = datetime.now()
        window_hours = int(time_window.replace('h', ''))
        cutoff = datetime.now() - __import__('datetime').timedelta(hours=window_hours)
        
        filtered = [r for r in self.results if r.timestamp >= cutoff]
        
        if not filtered:
            return {}
        
        # 计算基础统计
        polarities = [r.polarity for r in filtered]
        intensities = [r.intensity for r in filtered]
        
        # 情感分布
        label_counts = {}
        for r in filtered:
            label_counts[r.label] = label_counts.get(r.label, 0) + 1
        
        total = len(filtered)
        
        # 加权平均 (考虑影响力)
        # 这里简化处理，实际应该根据来源权重
        weighted_polarity = np.mean(polarities)
        
        # 情感分歧度 (标准差)
        sentiment_divergence = np.std(polarities)
        
        # 情感变化率 (需要历史数据，这里简化)
        sentiment_change_rate = 0.0
        
        return {
            'time_window': time_window,
            'sample_size': total,
            'average_polarity': float(weighted_polarity),
            'average_intensity': float(np.mean(intensities)),
            'sentiment_divergence': float(sentiment_divergence),
            'sentiment_change_rate': sentiment_change_rate,
            'label_distribution': label_counts,
            'positive_ratio': (label_counts.get('positive', 0) + label_counts.get('very_positive', 0)) / total,
            'negative_ratio': (label_counts.get('negative', 0) + label_counts.get('very_negative', 0)) / total,
            'neutral_ratio': label_counts.get('neutral', 0) / total
        }
    
    def get_weighted_sentiment(
        self,
        influence_weights: Dict[str, float] = None
    ) -> float:
        """
        计算加权情感得分
        
        Args:
            influence_weights: 不同来源的影响力权重
            
        Returns:
            float: 加权情感得分 (-1 到 +1)
        """
        if influence_weights is None:
            influence_weights = {
                'twitter': 1.0,
                'reddit': 0.7,
                'news': 0.9,
                'telegram': 0.5,
                'default': 0.5
            }
        
        weighted_sum = 0.0
        total_weight = 0.0
        
        for result in self.results:
            weight = influence_weights.get(result.source, influence_weights['default'])
            weighted_sum += result.polarity * weight
            total_weight += weight
        
        return weighted_sum / total_weight if total_weight > 0 else 0.0
    
    def clear(self):
        """清空结果"""
        self.results = []


class SentimentAnalyzerService:
    """
    情感分析服务
    整合采集、分析、存储流程
    """
    
    def __init__(
        self,
        model_name: str = "ProsusAI/finbert",
        data_dir: str = "./collected_data",
        output_dir: str = "./sentiment_results"
    ):
        self.analyzer = SentimentAnalyzer(model_name=model_name)
        self.aggregator = SentimentAggregator()
        self.data_dir = Path(data_dir)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def process_data_file(self, filepath: str) -> List[SentimentResult]:
        """
        处理单个数据文件
        
        Args:
            filepath: 数据文件路径
            
        Returns:
            List[SentimentResult]: 分析结果
        """
        results = []
        
        with open(filepath, 'r', encoding='utf-8') as f:
            for line in f:
                try:
                    data = json.loads(line)
                    
                    # 提取文本内容
                    text = data.get('content', '') or data.get('title', '') or data.get('text', '')
                    source = data.get('source', 'unknown')
                    
                    if text:
                        result = self.analyzer.analyze(text, source)
                        results.append(result)
                        self.aggregator.add_result(result)
                        
                except json.JSONDecodeError:
                    continue
                except Exception as e:
                    logger.error(f"处理数据行错误：{e}")
        
        return results
    
    def process_all_data(self) -> Dict:
        """
        处理所有采集的数据
        
        Returns:
            Dict: 汇总指标
        """
        all_results = []
        
        # 处理所有数据文件
        for filepath in self.data_dir.glob("data_*.jsonl"):
            logger.info(f"处理文件：{filepath}")
            results = self.process_data_file(str(filepath))
            all_results.extend(results)
        
        # 计算指标
        metrics = {
            '1h': self.aggregator.calculate_metrics('1h'),
            '4h': self.aggregator.calculate_metrics('4h'),
            '24h': self.aggregator.calculate_metrics('24h')
        }
        
        # 保存结果
        self._save_results(all_results, metrics)
        
        return metrics
    
    def _save_results(self, results: List[SentimentResult], metrics: Dict):
        """保存分析结果"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # 保存详细结果
        results_file = self.output_dir / f"results_{timestamp}.jsonl"
        with open(results_file, 'w', encoding='utf-8') as f:
            for r in results:
                f.write(json.dumps({
                    'text': r.text,
                    'source': r.source,
                    'timestamp': r.timestamp.isoformat(),
                    'polarity': r.polarity,
                    'label': r.label,
                    'confidence': r.confidence,
                    'intensity': r.intensity
                }, ensure_ascii=False) + '\n')
        
        # 保存汇总指标
        metrics_file = self.output_dir / f"metrics_{timestamp}.json"
        with open(metrics_file, 'w', encoding='utf-8') as f:
            json.dump(metrics, f, indent=2, ensure_ascii=False)
        
        logger.info(f"结果已保存：{results_file}, {metrics_file}")


def main():
    """主函数示例"""
    print("=" * 60)
    print("市场情感分析器")
    print("=" * 60)
    
    # 检查 CUDA
    if torch.cuda.is_available():
        print(f"✓ GPU 可用：{torch.cuda.get_device_name(0)}")
    else:
        print("✗ 使用 CPU 运行 (速度较慢)")
    
    # 初始化分析器
    analyzer = SentimentAnalyzer(model_name="ProsusAI/finbert")
    
    # 测试分析
    test_texts = [
        "Bitcoin is breaking out to new highs! This is incredible!",
        "Crypto market is crashing, everything is going down.",
        "Bitcoin price is moving sideways, no clear direction.",
        "Ethereum upgrade is a game changer for the industry.",
        "Regulatory concerns are weighing on the market sentiment."
    ]
    
    print("\n测试情感分析:")
    print("-" * 60)
    
    for text in test_texts:
        result = analyzer.analyze(text)
        print(f"文本：{text[:50]}...")
        print(f"情感：{result.label} (极性：{result.polarity}, 置信度：{result.confidence:.2f})")
        print()
    
    print("=" * 60)
    print("情感分析模块已就绪")
    print("使用方法:")
    print("  1. 安装依赖：pip install torch transformers tqdm")
    print("  2. 运行分析：python sentiment_analyzer.py")
    print("=" * 60)


if __name__ == "__main__":
    main()
