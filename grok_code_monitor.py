#!/usr/bin/env python3
"""
GROK-CODE 专项观察模块
Specialized Monitoring for GROK-CODE Model
"""

import json
import os
from datetime import datetime, timedelta
from typing import Dict, List
from dataclasses import dataclass


@dataclass
class GROKCodeObservation:
    """GROK-CODE 观察记录"""
    date: str
    total_calls: int
    empty_count: int
    timeout_count: int
    p50_duration: float
    p95_duration: float
    p99_duration: float
    max_duration: float
    recommendation: str


class GROKCodeMonitor:
    """GROK-CODE 专项观察器"""
    
    def __init__(self, log_dir: str = "/Users/colin/.openclaw/workspace/logs"):
        self.log_dir = log_dir
        self.observation_file = os.path.join(log_dir, "grok_code_observations.json")
        self.observations: List[GROKCodeObservation] = []
        
        # 决策阈值
        self.thresholds = {
            "p95_warning": 40000,  # 40s 警告
            "p95_critical": 43000,  # 43s 严重
            "empty_rate_warning": 0.05,  # 5% 警告
            "empty_rate_critical": 0.10,  # 10% 严重
            "timeout_rate_warning": 0.05,  # 5% 警告
            "consecutive_days": 3  # 连续 3 天触发才调整
        }
    
    def analyze_daily(self, request_logs: List[Dict]) -> GROKCodeObservation:
        """分析每日 GROK-CODE 表现"""
        today = datetime.now().strftime("%Y-%m-%d")
        
        # 筛选 GROK-CODE 日志
        grok_logs = [
            log for log in request_logs 
            if log.get("selected_model") == "xai/grok-code-fast-1"
        ]
        
        if not grok_logs:
            return GROKCodeObservation(
                date=today,
                total_calls=0,
                empty_count=0,
                timeout_count=0,
                p50_duration=0,
                p95_duration=0,
                p99_duration=0,
                max_duration=0,
                recommendation="无数据"
            )
        
        # 统计数据
        total = len(grok_logs)
        empty_count = sum(1 for log in grok_logs if log.get("final_status") == "empty")
        timeout_count = sum(1 for log in grok_logs if log.get("final_status") == "timeout")
        
        # 耗时分布
        durations = [
            log.get("duration_ms", 0) 
            for log in grok_logs 
            if log.get("duration_ms")
        ]
        
        if durations:
            sorted_durations = sorted(durations)
            p50 = sorted_durations[len(sorted_durations) // 2]
            p95 = sorted_durations[int(len(sorted_durations) * 0.95)]
            p99 = sorted_durations[int(len(sorted_durations) * 0.99)] if len(sorted_durations) >= 100 else p95
            max_dur = max(durations)
        else:
            p50 = p95 = p99 = max_dur = 0
        
        # 生成建议
        recommendation = self._generate_recommendation(
            total, empty_count, timeout_count, p95
        )
        
        observation = GROKCodeObservation(
            date=today,
            total_calls=total,
            empty_count=empty_count,
            timeout_count=timeout_count,
            p50_duration=p50,
            p95_duration=p95,
            p99_duration=p99,
            max_duration=max_dur,
            recommendation=recommendation
        )
        
        self.observations.append(observation)
        self._save_observation(observation)
        
        return observation
    
    def _generate_recommendation(self, total: int, empty: int, timeout: int, p95: float) -> str:
        """生成建议"""
        if total == 0:
            return "无数据"
        
        empty_rate = empty / total
        timeout_rate = timeout / total
        
        issues = []
        
        # 检查 P95
        if p95 > self.thresholds["p95_critical"]:
            issues.append(f"P95 ({p95:.0f}ms) 接近超时阈值，建议调 timeout 至 60s")
        elif p95 > self.thresholds["p95_warning"]:
            issues.append(f"P95 ({p95:.0f}ms) 偏高，继续观察")
        
        # 检查空输出率
        if empty_rate > self.thresholds["empty_rate_critical"]:
            issues.append(f"空输出率 ({empty_rate:.1%}) 过高，建议检查 provider")
        elif empty_rate > self.thresholds["empty_rate_warning"]:
            issues.append(f"空输出率 ({empty_rate:.1%}) 偏高，继续观察")
        
        # 检查超时率
        if timeout_rate > self.thresholds["timeout_rate_warning"]:
            issues.append(f"超时率 ({timeout_rate:.1%}) 偏高")
        
        if issues:
            return "；".join(issues)
        
        return "健康"
    
    def _save_observation(self, obs: GROKCodeObservation):
        """保存观察记录"""
        data = {
            "date": obs.date,
            "total_calls": obs.total_calls,
            "empty_count": obs.empty_count,
            "timeout_count": obs.timeout_count,
            "p50_duration": obs.p50_duration,
            "p95_duration": obs.p95_duration,
            "p99_duration": obs.p99_duration,
            "max_duration": obs.max_duration,
            "recommendation": obs.recommendation
        }
        
        # 追加到文件
        mode = 'a' if os.path.exists(self.observation_file) else 'w'
        with open(self.observation_file, mode, encoding='utf-8') as f:
            f.write(json.dumps(data, ensure_ascii=False) + "\n")
    
    def check_consecutive_issues(self, days: int = 3) -> Dict:
        """检查连续天数的问题"""
        if len(self.observations) < days:
            return {"message": f"数据不足，需要 {days} 天数据"}
        
        recent = self.observations[-days:]
        
        # 检查连续 P95 过高
        high_p95_days = sum(1 for obs in recent if obs.p95_duration > self.thresholds["p95_warning"])
        
        # 检查连续空输出率高
        high_empty_days = sum(
            1 for obs in recent 
            if obs.total_calls > 0 and obs.empty_count / obs.total_calls > self.thresholds["empty_rate_warning"]
        )
        
        result = {
            "consecutive_days": days,
            "high_p95_days": high_p95_days,
            "high_empty_days": high_empty_days,
            "should_adjust_timeout": high_p95_days >= days,
            "should_check_provider": high_empty_days >= days,
            "recommendation": ""
        }
        
        if result["should_adjust_timeout"]:
            result["recommendation"] = "建议将 GROK-CODE timeout 从 45s 调至 60s"
        elif result["should_check_provider"]:
            result["recommendation"] = "建议检查 xAI provider 服务状态"
        else:
            result["recommendation"] = "继续观察，暂不调整"
        
        return result
    
    def generate_weekly_report(self) -> Dict:
        """生成周报告"""
        if len(self.observations) < 7:
            return {"message": "数据不足，需要 7 天数据"}
        
        recent = self.observations[-7:]
        
        total_calls = sum(obs.total_calls for obs in recent)
        total_empty = sum(obs.empty_count for obs in recent)
        total_timeout = sum(obs.timeout_count for obs in recent)
        
        avg_p95 = sum(obs.p95_duration for obs in recent) / len(recent)
        max_p95 = max(obs.p95_duration for obs in recent)
        
        return {
            "week": f"{recent[0].date} ~ {recent[-1].date}",
            "total_calls": total_calls,
            "empty_rate": total_empty / total_calls if total_calls > 0 else 0,
            "timeout_rate": total_timeout / total_calls if total_calls > 0 else 0,
            "avg_p95": avg_p95,
            "max_p95": max_p95,
            "trend": "上升" if recent[-1].p95_duration > recent[0].p95_duration else "下降",
            "recommendation": self._generate_recommendation(
                total_calls, total_empty, total_timeout, avg_p95
            )
        }
    
    def archive_anomaly(self, request_id: str, anomaly_type: str, details: Dict):
        """归档异常样本"""
        archive_file = os.path.join(self.log_dir, "grok_code_anomalies.json")
        
        anomaly = {
            "request_id": request_id,
            "timestamp": datetime.now().isoformat(),
            "type": anomaly_type,
            "details": details
        }
        
        mode = 'a' if os.path.exists(archive_file) else 'w'
        with open(archive_file, mode, encoding='utf-8') as f:
            f.write(json.dumps(anomaly, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    print("GROK-CODE 专项观察模块已加载")
    print("\n决策阈值：")
    print("  P95 警告: 40s")
    print("  P95 严重: 43s")
    print("  空输出率警告: 5%")
    print("  连续天数: 3 天")
    print("\n建议：")
    print("  P95 > 40s 连续 3 天 → 调 timeout 至 60s")
    print("  空输出率 > 5% 连续 3 天 → 检查 provider")