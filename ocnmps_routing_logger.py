#!/usr/bin/env python3
"""
OCNMPS 路由日志记录器
记录灰度期间的完整路由决策
"""

import json
import os
import uuid
from datetime import datetime
from typing import Dict, Any, Optional

LOG_FILE = os.path.expanduser("~/.openclaw/workspace/ocnmps_routing.log")
STATS_FILE = os.path.expanduser("~/.openclaw/workspace/ocnmps_stats.json")


class RoutingLogger:
    """路由日志记录器"""
    
    def __init__(self):
        self.log_file = LOG_FILE
        self.stats_file = STATS_FILE
        self._ensure_files()
    
    def _ensure_files(self):
        """确保日志文件存在"""
        os.makedirs(os.path.dirname(self.log_file), exist_ok=True)
        
        if not os.path.exists(self.stats_file):
            self._init_stats()
    
    def _init_stats(self):
        """初始化统计文件"""
        stats = {
            "total_requests": 0,
            "bridge_used": 0,
            "fallback_triggered": 0,
            "by_intent": {
                "CODE": {"count": 0, "total_score": 0},
                "REASON": {"count": 0, "total_score": 0},
                "LONG": {"count": 0, "total_score": 0},
                "CN": {"count": 0, "total_score": 0},
                "default": {"count": 0, "total_score": 0},
            },
            "by_model": {},
            "avg_latency_ms": 0,
            "start_date": datetime.now().isoformat(),
        }
        with open(self.stats_file, "w") as f:
            json.dump(stats, f, ensure_ascii=False, indent=2)
    
    def log_routing(
        self,
        task_preview: str,
        intent: Optional[str],
        use_ocnmps: bool,
        recommended_model: str,
        chain: Optional[list],
        gray_hit: bool,
        fallback_used: bool,
        latency_ms: float = 0,
        user_score: Optional[int] = None,
    ) -> str:
        """
        记录一次路由决策
        
        Returns:
            str: task_id
        """
        task_id = str(uuid.uuid4())[:8]
        
        entry = {
            "task_id": task_id,
            "timestamp": datetime.now().isoformat(),
            "task_preview": task_preview[:100] + "..." if len(task_preview) > 100 else task_preview,
            "intent": intent,
            "use_ocnmps": use_ocnmps,
            "recommended_model": recommended_model,
            "chain": chain,
            "gray_hit": gray_hit,
            "fallback_used": fallback_used,
            "latency_ms": round(latency_ms, 2),
            "user_score": user_score,
        }
        
        # 追加日志
        with open(self.log_file, "a") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        
        # 更新统计
        self._update_stats(entry)
        
        return task_id
    
    def _update_stats(self, entry: Dict[str, Any]):
        """更新统计"""
        try:
            with open(self.stats_file, "r") as f:
                stats = json.load(f)
        except:
            stats = {"total_requests": 0, "bridge_used": 0, "fallback_triggered": 0, 
                     "by_intent": {}, "by_model": {}, "avg_latency_ms": 0}
        
        stats["total_requests"] += 1
        
        if entry["use_ocnmps"]:
            stats["bridge_used"] += 1
        
        if entry["fallback_used"]:
            stats["fallback_triggered"] += 1
        
        # 按意图统计
        intent = entry["intent"] or "default"
        if intent not in stats["by_intent"]:
            stats["by_intent"][intent] = {"count": 0, "total_score": 0}
        stats["by_intent"][intent]["count"] += 1
        if entry["user_score"]:
            stats["by_intent"][intent]["total_score"] += entry["user_score"]
        
        # 按模型统计
        model = entry["recommended_model"]
        if model not in stats["by_model"]:
            stats["by_model"][model] = {"count": 0}
        stats["by_model"][model]["count"] += 1
        
        # 平均延迟
        current_avg = stats.get("avg_latency_ms", 0)
        total = stats["total_requests"]
        stats["avg_latency_ms"] = round(
            (current_avg * (total - 1) + entry["latency_ms"]) / total, 2
        )
        
        with open(self.stats_file, "w") as f:
            json.dump(stats, f, ensure_ascii=False, indent=2)
    
    def update_user_score(self, task_id: str, score: int, comment: str = ""):
        """更新用户评分"""
        # 读取日志文件，找到对应记录
        entries = []
        with open(self.log_file, "r") as f:
            for line in f:
                if line.strip():
                    entry = json.loads(line)
                    if entry.get("task_id") == task_id:
                        entry["user_score"] = score
                        entry["user_comment"] = comment
                    entries.append(entry)
        
        # 重写日志
        with open(self.log_file, "w") as f:
            for entry in entries:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        
        # 更新统计中的平均分
        self._recalculate_scores()
    
    def _recalculate_scores(self):
        """重新计算平均分"""
        with open(self.log_file, "r") as f:
            entries = [json.loads(line) for line in f if line.strip()]
        
        stats = json.load(open(self.stats_file, "r"))
        
        for intent in stats["by_intent"]:
            scored = [e for e in entries 
                     if e.get("intent") == intent and e.get("user_score")]
            if scored:
                stats["by_intent"][intent]["total_score"] = sum(e["user_score"] for e in scored)
        
        with open(self.stats_file, "w") as f:
            json.dump(stats, f, ensure_ascii=False, indent=2)
    
    def get_stats(self) -> Dict[str, Any]:
        """获取当前统计"""
        with open(self.stats_file, "r") as f:
            return json.load(f)
    
    def get_recent_logs(self, limit: int = 20) -> list:
        """获取最近日志"""
        with open(self.log_file, "r") as f:
            lines = f.readlines()[-limit:]
        return [json.loads(line) for line in lines if line.strip()]


# 全局实例
_logger = None

def get_logger() -> RoutingLogger:
    """获取全局日志实例"""
    global _logger
    if _logger is None:
        _logger = RoutingLogger()
    return _logger