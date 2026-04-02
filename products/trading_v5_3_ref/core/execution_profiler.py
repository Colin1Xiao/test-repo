#!/usr/bin/env python3
"""
Execution Profiler - 执行延迟分析器

核心功能：
1. 分解延迟到每个阶段
2. 识别瓶颈
3. 生成诊断报告
"""

import time
import json
from dataclasses import dataclass, field
from typing import Dict, Optional
from datetime import datetime


@dataclass
class LatencyProfile:
    """延迟剖析结果"""
    # 各阶段延迟（毫秒）
    signal_to_executor: float = 0.0    # 信号 → executor 入口
    price_fetch: float = 0.0           # 获取价格
    pre_check: float = 0.0             # 前置检查
    order_send: float = 0.0            # 发送订单到交易所
    order_ack: float = 0.0             # 交易所确认
    fill_wait: float = 0.0             # 等待成交
    fill_confirm: float = 0.0          # 成交确认
    
    # 总延迟
    total_latency: float = 0.0
    
    # 元数据
    symbol: str = ""
    timestamp: str = ""
    
    def to_dict(self) -> Dict:
        return {
            "symbol": self.symbol,
            "timestamp": self.timestamp,
            "latency_ms": {
                "signal_to_executor": round(self.signal_to_executor, 1),
                "price_fetch": round(self.price_fetch, 1),
                "pre_check": round(self.pre_check, 1),
                "order_send": round(self.order_send, 1),
                "order_ack": round(self.order_ack, 1),
                "fill_wait": round(self.fill_wait, 1),
                "fill_confirm": round(self.fill_confirm, 1),
                "total": round(self.total_latency, 1)
            }
        }
    
    def __str__(self) -> str:
        return f"""
📊 Execution Latency Profile
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Symbol: {self.symbol}
Time: {self.timestamp}

⏱️ Latency Breakdown:
   Signal → Executor:    {self.signal_to_executor:>6.1f}ms
   Price Fetch:          {self.price_fetch:>6.1f}ms
   Pre-check:            {self.pre_check:>6.1f}ms
   Order Send:           {self.order_send:>6.1f}ms ⚠️
   Order ACK:            {self.order_ack:>6.1f}ms
   Fill Wait:            {self.fill_wait:>6.1f}ms ⚠️
   Fill Confirm:         {self.fill_confirm:>6.1f}ms
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TOTAL:                {self.total_latency:>6.1f}ms {'❌' if self.total_latency > 1000 else '⚠️' if self.total_latency > 300 else '✅'}

🎯 Bottleneck: {self._identify_bottleneck()}
"""
    
    def _identify_bottleneck(self) -> str:
        """识别瓶颈"""
        latencies = {
            "signal_to_executor": self.signal_to_executor,
            "price_fetch": self.price_fetch,
            "pre_check": self.pre_check,
            "order_send": self.order_send,
            "order_ack": self.order_ack,
            "fill_wait": self.fill_wait,
            "fill_confirm": self.fill_confirm
        }
        
        max_stage = max(latencies, key=latencies.get)
        max_latency = latencies[max_stage]
        
        if max_latency > 1000:
            return f"🔴 {max_stage} ({max_latency:.0f}ms)"
        elif max_latency > 500:
            return f"🟡 {max_stage} ({max_latency:.0f}ms)"
        else:
            return "🟢 均衡"


class ExecutionProfiler:
    """
    执行延迟分析器
    """
    
    def __init__(self):
        self.profile = LatencyProfile()
        self.start_time = 0.0
        self.marks: Dict[str, float] = {}
        self.signal_time: float = 0.0
    
    def start(self, symbol: str, signal_time: float = None):
        """开始计时"""
        self.start_time = time.time()
        self.signal_time = signal_time or self.start_time
        self.profile.symbol = symbol
        self.profile.timestamp = datetime.now().isoformat()
        self.marks = {"start": self.start_time}
    
    def mark(self, stage: str):
        """标记阶段"""
        self.marks[stage] = time.time()
    
    def end(self) -> LatencyProfile:
        """结束计时并计算延迟"""
        end_time = time.time()
        
        # 计算各阶段延迟
        stages = [
            ("signal_to_executor", "signal_time", "start"),
            ("price_fetch", "price_fetch_start", "price_fetch_end"),
            ("pre_check", "pre_check_start", "pre_check_end"),
            ("order_send", "order_send_start", "order_send_end"),
            ("order_ack", "order_send_end", "order_ack"),
            ("fill_wait", "fill_wait_start", "fill_wait_end"),
            ("fill_confirm", "fill_confirm_start", "fill_confirm_end"),
        ]
        
        for attr, start_key, end_key in stages:
            if start_key in self.marks and end_key in self.marks:
                setattr(self.profile, attr, (self.marks[end_key] - self.marks[start_key]) * 1000)
        
        # 特殊处理 signal_time
        if self.signal_time and "start" in self.marks:
            self.profile.signal_to_executor = (self.marks["start"] - self.signal_time) * 1000
        
        # 总延迟
        self.profile.total_latency = (end_time - self.start_time) * 1000
        
        return self.profile


# 全局实例
_profiler = None

def get_profiler() -> ExecutionProfiler:
    """获取全局分析器实例"""
    global _profiler
    if _profiler is None:
        _profiler = ExecutionProfiler()
    return _profiler