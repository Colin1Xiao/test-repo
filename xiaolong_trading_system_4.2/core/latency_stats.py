#!/usr/bin/env python3
"""
Latency Statistics Collector - 延迟分布统计器

收集执行延迟数据，计算 P50/P90/P99
"""

import json
import time
from datetime import datetime
from typing import List, Dict, Optional
from dataclasses import dataclass
import statistics


@dataclass
class LatencySample:
    """延迟样本"""
    timestamp: str
    symbol: str
    total_ms: float
    price_fetch_ms: float
    order_send_ms: float
    fill_wait_ms: float
    fill_confirm_ms: float
    slippage_pct: float
    
    def to_dict(self) -> Dict:
        return {
            "timestamp": self.timestamp,
            "symbol": self.symbol,
            "total_ms": round(self.total_ms, 1),
            "price_fetch_ms": round(self.price_fetch_ms, 1),
            "order_send_ms": round(self.order_send_ms, 1),
            "fill_wait_ms": round(self.fill_wait_ms, 1),
            "fill_confirm_ms": round(self.fill_confirm_ms, 1),
            "slippage_pct": round(self.slippage_pct, 4)
        }


class LatencyStats:
    """延迟统计器"""
    
    def __init__(self, data_file: str = "logs/latency_samples.json"):
        self.data_file = data_file
        self.samples: List[LatencySample] = []
        self._load()
    
    def _load(self):
        """加载历史数据"""
        try:
            with open(self.data_file, 'r') as f:
                data = json.load(f)
                self.samples = [LatencySample(**s) for s in data.get('samples', [])]
        except (FileNotFoundError, json.JSONDecodeError):
            self.samples = []
    
    def _save(self):
        """保存数据"""
        import os
        os.makedirs(os.path.dirname(self.data_file), exist_ok=True)
        with open(self.data_file, 'w') as f:
            json.dump({
                'samples': [s.to_dict() for s in self.samples],
                'last_updated': datetime.now().isoformat()
            }, f, indent=2)
    
    def add_sample(self, profile: Dict, slippage: float):
        """添加样本"""
        latency = profile.get('latency_ms', {})
        sample = LatencySample(
            timestamp=profile.get('timestamp', datetime.now().isoformat()),
            symbol=profile.get('symbol', 'UNKNOWN'),
            total_ms=latency.get('total', 0),
            price_fetch_ms=latency.get('price_fetch', 0),
            order_send_ms=latency.get('order_send', 0),
            fill_wait_ms=latency.get('fill_wait', 0),
            fill_confirm_ms=latency.get('fill_confirm', 0),
            slippage_pct=slippage
        )
        self.samples.append(sample)
        self._save()
        return sample
    
    def get_stats(self) -> Dict:
        """计算统计指标"""
        if not self.samples:
            return {"error": "no samples"}
        
        totals = [s.total_ms for s in self.samples]
        price_fetches = [s.price_fetch_ms for s in self.samples]
        order_sends = [s.order_send_ms for s in self.samples]
        fill_waits = [s.fill_wait_ms for s in self.samples]
        fill_confirms = [s.fill_confirm_ms for s in self.samples]
        slippages = [abs(s.slippage_pct) for s in self.samples]
        
        def percentiles(data: List[float]) -> Dict:
            sorted_data = sorted(data)
            n = len(sorted_data)
            return {
                "min": round(sorted_data[0], 1),
                "p50": round(sorted_data[int(n * 0.5)], 1),
                "p90": round(sorted_data[int(n * 0.9)], 1) if n >= 10 else round(sorted_data[-1], 1),
                "p99": round(sorted_data[int(n * 0.99)], 1) if n >= 100 else round(sorted_data[-1], 1),
                "max": round(sorted_data[-1], 1),
                "avg": round(statistics.mean(data), 1),
                "std": round(statistics.stdev(data), 1) if n >= 2 else 0
            }
        
        return {
            "sample_count": len(self.samples),
            "total_latency": percentiles(totals),
            "price_fetch": percentiles(price_fetches),
            "order_send": percentiles(order_sends),
            "fill_wait": percentiles(fill_waits),
            "fill_confirm": percentiles(fill_confirms),
            "slippage": percentiles(slippages),
            "assessment": self._assess()
        }
    
    def _assess(self) -> Dict:
        """评估系统状态"""
        if len(self.samples) < 5:
            return {"status": "insufficient_data", "need": 5 - len(self.samples)}
        
        totals = [s.total_ms for s in self.samples]
        p50 = sorted(totals)[int(len(totals) * 0.5)]
        
        # 计算波动性
        avg = statistics.mean(totals)
        std = statistics.stdev(totals) if len(totals) >= 2 else 0
        cv = std / avg if avg > 0 else 0  # 变异系数
        
        if p50 < 800 and cv < 0.3:
            return {"status": "ready", "p50_ms": p50, "cv": round(cv, 2)}
        elif p50 < 1200 and cv < 0.5:
            return {"status": "acceptable", "p50_ms": p50, "cv": round(cv, 2)}
        else:
            return {"status": "needs_optimization", "p50_ms": p50, "cv": round(cv, 2)}
    
    def report(self) -> str:
        """生成报告"""
        stats = self.get_stats()
        if "error" in stats:
            return f"❌ {stats['error']}"
        
        total = stats['total_latency']
        assess = stats['assessment']
        
        report = f"""
📊 Latency Distribution Report
{'='*50}
样本数: {stats['sample_count']}

⏱️ 总延迟 (ms):
   Min:  {total['min']:>6}
   P50:  {total['p50']:>6} {'✅' if total['p50'] < 800 else '⚠️' if total['p50'] < 1200 else '❌'}
   P90:  {total['p90']:>6} {'✅' if total['p90'] < 1200 else '⚠️' if total['p90'] < 1500 else '❌'}
   Max:  {total['max']:>6}
   Avg:  {total['avg']:>6}
   Std:  {total['std']:>6}

📈 阶段分解:
   Price Fetch:  {stats['price_fetch']['avg']:>6}ms (avg)
   Order Send:   {stats['order_send']['avg']:>6}ms (avg)
   Fill Wait:    {stats['fill_wait']['avg']:>6}ms (avg)
   Fill Confirm: {stats['fill_confirm']['avg']:>6}ms (avg)

📊 滑点 (%):
   Avg:  {stats['slippage']['avg']:>6.4f}
   Max:  {stats['slippage']['max']:>6.4f}

🎯 评估: {assess['status'].upper()}
{'='*50}
"""
        return report


# 全局实例
_stats = None

def get_latency_stats() -> LatencyStats:
    global _stats
    if _stats is None:
        _stats = LatencyStats()
    return _stats
