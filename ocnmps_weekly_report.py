#!/usr/bin/env python3
"""
OCNMPS 灰度周报生成器
汇总 7 天日报，判断是否建议扩大灰度
"""

import json
import os
from datetime import datetime, timedelta
from typing import Dict, Any, List
from collections import defaultdict

LOG_FILE = os.path.expanduser("~/.openclaw/workspace/ocnmps_routing.log")
REPORT_DIR = os.path.expanduser("~/.openclaw/workspace/reports/ocnmps_weekly")

# ==================== 硬性刹车条件 ====================

BRAKE_CONDITIONS = {
    "avg_score_threshold": 4.0,        # 平均评分低于此值触发刹车
    "avg_score_consecutive_days": 2,   # 连续N天低于阈值
    "fallback_rate_threshold": 0.10,   # 回退率超过此值触发刹车
    "latency_threshold_ms": 200,       # 平均延迟超过此值触发刹车
    "low_score_burst": 3,              # 单日低分样本(≤2分)超过N条触发警告
}


class WeeklyReportGenerator:
    """灰度周报生成器"""
    
    def __init__(self):
        self.log_file = LOG_FILE
        self.report_dir = REPORT_DIR
        os.makedirs(self.report_dir, exist_ok=True)
    
    def load_logs_for_week(self, end_date: str = None) -> List[Dict]:
        """加载一周日志"""
        if end_date is None:
            end_date = datetime.now().strftime("%Y-%m-%d")
        
        end = datetime.strptime(end_date, "%Y-%m-%d")
        start = end - timedelta(days=6)
        
        if not os.path.exists(self.log_file):
            return []
        
        logs = []
        with open(self.log_file, "r") as f:
            for line in f:
                if line.strip():
                    try:
                        entry = json.loads(line)
                        entry_date = entry.get("timestamp", "")[:10]
                        if entry_date:
                            d = datetime.strptime(entry_date, "%Y-%m-%d")
                            if start <= d <= end:
                                logs.append(entry)
                    except:
                        continue
        
        return logs
    
    def check_brake_conditions(self, daily_stats: List[Dict]) -> Dict[str, Any]:
        """检查刹车条件"""
        brakes_triggered = []
        warnings = []
        
        # 1. 平均评分连续两天低于阈值
        low_score_days = 0
        for day in daily_stats:
            if day.get("avg_score") and day["avg_score"] < BRAKE_CONDITIONS["avg_score_threshold"]:
                low_score_days += 1
            else:
                low_score_days = 0  # 重置计数
            
            if low_score_days >= BRAKE_CONDITIONS["avg_score_consecutive_days"]:
                brakes_triggered.append(
                    f"平均评分连续 {low_score_days} 天低于 {BRAKE_CONDITIONS['avg_score_threshold']}"
                )
                break
        
        # 2. 回退率超过阈值
        for day in daily_stats:
            if day.get("fallback_rate", 0) > BRAKE_CONDITIONS["fallback_rate_threshold"]:
                brakes_triggered.append(
                    f"回退率 {day['fallback_rate']*100:.1f}% 超过阈值 {BRAKE_CONDITIONS['fallback_rate_threshold']*100:.0f}%"
                )
                break
        
        # 3. 延迟超过阈值
        for day in daily_stats:
            if day.get("avg_latency_ms", 0) > BRAKE_CONDITIONS["latency_threshold_ms"]:
                warnings.append(
                    f"延迟 {day['avg_latency_ms']:.0f}ms 超过警告阈值 {BRAKE_CONDITIONS['latency_threshold_ms']}ms"
                )
                break
        
        # 4. 低分样本爆发
        for day in daily_stats:
            if day.get("low_score_count", 0) >= BRAKE_CONDITIONS["low_score_burst"]:
                warnings.append(
                    f"单日低分样本 {day['low_score_count']} 条超过阈值 {BRAKE_CONDITIONS['low_score_burst']}"
                )
                break
        
        return {
            "brakes_triggered": brakes_triggered,
            "warnings": warnings,
            "should_brake": len(brakes_triggered) > 0,
        }
    
    def generate_report(self, end_date: str = None) -> Dict[str, Any]:
        """生成周报"""
        if end_date is None:
            end_date = datetime.now().strftime("%Y-%m-%d")
        
        end = datetime.strptime(end_date, "%Y-%m-%d")
        start = end - timedelta(days=6)
        week_str = f"{start.strftime('%Y-%m-%d')} ~ {end_date}"
        
        logs = self.load_logs_for_week(end_date)
        
        if not logs:
            return {
                "week": week_str,
                "has_data": False,
                "message": "本周无灰度数据"
            }
        
        # 按日期分组
        by_date = defaultdict(list)
        for log in logs:
            date = log.get("timestamp", "")[:10]
            by_date[date].append(log)
        
        # 每日统计
        daily_stats = []
        for date in sorted(by_date.keys()):
            day_logs = by_date[date]
            scored = [l for l in day_logs if l.get("user_score")]
            gray_hits = [l for l in day_logs if l.get("gray_hit")]
            fallbacks = [l for l in day_logs if l.get("fallback_used")]
            latencies = [l["latency_ms"] for l in day_logs if l.get("latency_ms")]
            low_scored = [l for l in scored if l.get("user_score", 5) <= 2]
            
            daily_stats.append({
                "date": date,
                "total": len(day_logs),
                "gray_hits": len(gray_hits),
                "avg_score": sum(l["user_score"] for l in scored) / len(scored) if scored else None,
                "avg_latency_ms": sum(latencies) / len(latencies) if latencies else None,
                "fallback_rate": len(fallbacks) / len(gray_hits) if gray_hits else 0,
                "low_score_count": len(low_scored),
            })
        
        # 整周统计
        total = len(logs)
        gray_hits = [l for l in logs if l.get("gray_hit")]
        bridge_used = [l for l in logs if l.get("use_ocnmps")]
        fallbacks = [l for l in logs if l.get("fallback_used")]
        scored = [l for l in logs if l.get("user_score")]
        latencies = [l["latency_ms"] for l in logs if l.get("latency_ms")]
        
        avg_score = sum(l["user_score"] for l in scored) / len(scored) if scored else 0
        avg_latency = sum(latencies) / len(latencies) if latencies else 0
        
        # 按意图统计
        by_intent = defaultdict(lambda: {"count": 0, "scores": [], "latencies": []})
        for log in logs:
            intent = log.get("intent") or "default"
            by_intent[intent]["count"] += 1
            if log.get("user_score"):
                by_intent[intent]["scores"].append(log["user_score"])
            if log.get("latency_ms"):
                by_intent[intent]["latencies"].append(log["latency_ms"])
        
        # 低分样本
        low_scored = sorted(
            [l for l in scored if l.get("user_score", 5) <= 3],
            key=lambda x: x.get("user_score", 0)
        )[:10]
        
        # 误路由分析
        misrouted = []
        for log in scored:
            if log.get("user_score", 5) <= 2:
                misrouted.append({
                    "task_id": log.get("task_id"),
                    "intent": log.get("intent"),
                    "recommended_model": log.get("recommended_model"),
                    "score": log.get("user_score"),
                    "comment": log.get("user_comment", ""),
                })
        
        # 检查刹车条件
        brake_check = self.check_brake_conditions(daily_stats)
        
        # 判断是否建议扩大灰度
        if brake_check["should_brake"]:
            recommendation = {
                "action": "rollback",
                "suggestion": "建议回退到 0%，排查问题",
                "reasons": brake_check["brakes_triggered"],
            }
        elif avg_score >= 4.3 and len(fallbacks) / max(len(gray_hits), 1) <= 0.05:
            recommendation = {
                "action": "increase",
                "suggestion": "建议提升到 50%",
                "reasons": [
                    f"周平均评分 {avg_score:.1f}/5 达标",
                    f"回退率 {(len(fallbacks)/max(len(gray_hits),1))*100:.1f}% 正常",
                ],
            }
        else:
            recommendation = {
                "action": "maintain",
                "suggestion": "维持 30%，继续观察",
                "reasons": [
                    f"周平均评分 {avg_score:.1f}/5",
                    f"回退率 {(len(fallbacks)/max(len(gray_hits),1))*100:.1f}%",
                ],
            }
        
        return {
            "week": week_str,
            "has_data": True,
            "summary": {
                "total_tasks": total,
                "gray_hits": len(gray_hits),
                "bridge_used": len(bridge_used),
                "fallback_count": len(fallbacks),
                "scored_count": len(scored),
                "avg_score": round(avg_score, 2),
                "avg_latency_ms": round(avg_latency, 2),
            },
            "daily_stats": daily_stats,
            "by_intent": {
                intent: {
                    "count": data["count"],
                    "avg_score": round(sum(data["scores"]) / len(data["scores"]), 2) if data["scores"] else None,
                    "avg_latency_ms": round(sum(data["latencies"]) / len(data["latencies"]), 2) if data["latencies"] else None,
                }
                for intent, data in by_intent.items()
            },
            "low_scored_tasks": low_scored,
            "misrouted_samples": misrouted,
            "brake_check": brake_check,
            "recommendation": recommendation,
        }
    
    def format_report(self, report: Dict) -> str:
        """格式化周报"""
        if not report.get("has_data"):
            return f"# OCNMPS 灰度周报\n\n{report['week']}\n\n本周无灰度数据。"
        
        lines = [
            f"# OCNMPS 灰度周报",
            "",
            f"**周期**: {report['week']}",
            "",
            "---",
            "",
            "## 总览",
            "",
            f"- **总任务数**: {report['summary']['total_tasks']}",
            f"- **灰度命中**: {report['summary']['gray_hits']}",
            f"- **平均评分**: {report['summary']['avg_score']}/5",
            f"- **平均延迟**: {report['summary']['avg_latency_ms']:.0f}ms",
            f"- **回退次数**: {report['summary']['fallback_count']}",
            "",
            "---",
            "",
            "## 评分趋势",
            "",
            "| 日期 | 任务数 | 平均评分 | 延迟 | 回退率 |",
            "|------|--------|----------|------|--------|",
        ]
        
        for day in report["daily_stats"]:
            score_str = f"{day['avg_score']:.1f}" if day.get("avg_score") else "N/A"
            latency_str = f"{day['avg_latency_ms']:.0f}ms" if day.get("avg_latency_ms") else "N/A"
            fallback_str = f"{day['fallback_rate']*100:.1f}%" if day.get("fallback_rate") else "0%"
            lines.append(f"| {day['date']} | {day['total']} | {score_str} | {latency_str} | {fallback_str} |")
        
        lines.append("")
        lines.append("---")
        lines.append("")
        lines.append("## 意图分布")
        lines.append("")
        lines.append("| 意图 | 命中数 | 平均评分 | 平均延迟 |")
        lines.append("|------|--------|----------|----------|")
        
        for intent, data in report["by_intent"].items():
            score_str = f"{data['avg_score']:.1f}" if data.get("avg_score") else "N/A"
            latency_str = f"{data['avg_latency_ms']:.0f}ms" if data.get("avg_latency_ms") else "N/A"
            lines.append(f"| {intent} | {data['count']} | {score_str} | {latency_str} |")
        
        # 刹车检查
        if report.get("brake_check"):
            bc = report["brake_check"]
            if bc.get("warnings"):
                lines.append("")
                lines.append("---")
                lines.append("")
                lines.append("## ⚠️ 警告信号")
                lines.append("")
                for w in bc["warnings"]:
                    lines.append(f"- {w}")
            
            if bc.get("brakes_triggered"):
                lines.append("")
                lines.append("---")
                lines.append("")
                lines.append("## 🛑 刹车条件触发")
                lines.append("")
                for b in bc["brakes_triggered"]:
                    lines.append(f"- **{b}**")
        
        # 误路由样本
        if report.get("misrouted_samples"):
            lines.append("")
            lines.append("---")
            lines.append("")
            lines.append("## 误路由样本")
            lines.append("")
            for sample in report["misrouted_samples"][:5]:
                lines.append(f"- `{sample['task_id']}` | {sample['intent']} → {sample['recommended_model']} | 评分 {sample['score']}/5")
                if sample.get("comment"):
                    lines.append(f"  - {sample['comment']}")
        
        # 建议
        lines.append("")
        lines.append("---")
        lines.append("")
        lines.append("## 灰度建议")
        lines.append("")
        r = report["recommendation"]
        lines.append(f"**{r['suggestion']}**")
        lines.append("")
        lines.append("依据：")
        for reason in r["reasons"]:
            lines.append(f"- {reason}")
        
        return "\n".join(lines)
    
    def save_report(self, report: Dict):
        """保存周报"""
        week_str = report["week"].replace(" ~ ", "_")
        filename = os.path.join(self.report_dir, f"{week_str}.md")
        
        with open(filename, "w") as f:
            f.write(self.format_report(report))
        
        return filename


# ==================== CLI ====================

if __name__ == "__main__":
    import sys
    
    generator = WeeklyReportGenerator()
    
    end_date = sys.argv[1] if len(sys.argv) > 1 else None
    
    report = generator.generate_report(end_date)
    
    if report.get("has_data"):
        filename = generator.save_report(report)
        print(f"✅ 周报已保存: {filename}")
    
    print("\n" + generator.format_report(report))