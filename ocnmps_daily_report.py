#!/usr/bin/env python3
"""
OCNMPS 灰度日报生成器
自动生成每日灰度报告，判断是否建议扩大灰度
"""

import json
import os
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from collections import defaultdict

STATS_FILE = os.path.expanduser("~/.openclaw/workspace/ocnmps_stats.json")
LOG_FILE = os.path.expanduser("~/.openclaw/workspace/ocnmps_routing.log")
REPORT_DIR = os.path.expanduser("~/.openclaw/workspace/reports/ocnmps_daily")


class DailyReportGenerator:
    """灰度日报生成器"""
    
    def __init__(self):
        self.log_file = LOG_FILE
        self.report_dir = REPORT_DIR
        os.makedirs(self.report_dir, exist_ok=True)
    
    def load_logs(self, date: Optional[str] = None) -> List[Dict]:
        """加载日志"""
        if not os.path.exists(self.log_file):
            return []
        
        logs = []
        with open(self.log_file, "r") as f:
            for line in f:
                if line.strip():
                    try:
                        entry = json.loads(line)
                        # 过滤日期
                        if date:
                            entry_date = entry.get("timestamp", "")[:10]
                            if entry_date != date:
                                continue
                        logs.append(entry)
                    except:
                        continue
        
        return logs
    
    def generate_report(self, date: Optional[str] = None) -> Dict[str, Any]:
        """
        生成日报数据
        
        Args:
            date: 日期，默认今天
        """
        if date is None:
            date = datetime.now().strftime("%Y-%m-%d")
        
        logs = self.load_logs(date)
        
        if not logs:
            return {
                "date": date,
                "has_data": False,
                "message": "当日无灰度数据"
            }
        
        # 基础统计
        total = len(logs)
        gray_hits = [l for l in logs if l.get("gray_hit")]
        bridge_used = [l for l in logs if l.get("use_ocnmps")]
        fallbacks = [l for l in logs if l.get("fallback_used")]
        scored = [l for l in logs if l.get("user_score")]
        
        # 按意图统计
        by_intent = defaultdict(lambda: {"count": 0, "scores": [], "latencies": [], "fallbacks": 0})
        for log in logs:
            intent = log.get("intent") or "default"
            by_intent[intent]["count"] += 1
            if log.get("user_score"):
                by_intent[intent]["scores"].append(log["user_score"])
            if log.get("latency_ms"):
                by_intent[intent]["latencies"].append(log["latency_ms"])
            if log.get("fallback_used"):
                by_intent[intent]["fallbacks"] += 1
        
        # 计算平均分
        avg_score = sum(l["user_score"] for l in scored) / len(scored) if scored else 0
        
        # 计算延迟
        latencies = [l["latency_ms"] for l in logs if l.get("latency_ms")]
        avg_latency = sum(latencies) / len(latencies) if latencies else 0
        sorted_latencies = sorted(latencies)
        p50 = sorted_latencies[len(sorted_latencies) // 2] if sorted_latencies else 0
        p95_idx = int(len(sorted_latencies) * 0.95)
        p95 = sorted_latencies[p95_idx] if p95_idx < len(sorted_latencies) else 0
        
        # 异常样本
        low_scored = sorted([l for l in scored if l.get("user_score", 5) <= 3], 
                          key=lambda x: x.get("user_score", 0))[:5]
        slow_tasks = sorted([l for l in logs if l.get("latency_ms")], 
                           key=lambda x: -x["latency_ms"])[:5]
        
        # 最佳样本
        best_tasks = sorted([l for l in scored if l.get("user_score", 0) >= 4],
                           key=lambda x: -x.get("user_score", 0))[:3]
        
        # 判断是否建议提升灰度
        recommendation = self._make_recommendation(
            avg_score=avg_score,
            fallback_rate=len(fallbacks) / len(gray_hits) if gray_hits else 0,
            avg_latency=avg_latency,
            by_intent=by_intent
        )
        
        return {
            "date": date,
            "has_data": True,
            "summary": {
                "total_tasks": total,
                "gray_hits": len(gray_hits),
                "bridge_used": len(bridge_used),
                "fallback_count": len(fallbacks),
                "scored_count": len(scored),
                "avg_score": round(avg_score, 2),
                "avg_latency_ms": round(avg_latency, 2),
                "p50_latency_ms": round(p50, 2),
                "p95_latency_ms": round(p95, 2),
            },
            "by_intent": {
                intent: {
                    "count": data["count"],
                    "avg_score": round(sum(data["scores"]) / len(data["scores"]), 2) if data["scores"] else None,
                    "avg_latency_ms": round(sum(data["latencies"]) / len(data["latencies"]), 2) if data["latencies"] else None,
                    "fallback_count": data["fallbacks"],
                }
                for intent, data in by_intent.items()
            },
            "best_tasks": best_tasks[:3],
            "low_scored_tasks": low_scored[:5],
            "slow_tasks": slow_tasks[:5],
            "recommendation": recommendation,
        }
    
    def _make_recommendation(
        self, 
        avg_score: float, 
        fallback_rate: float,
        avg_latency: float,
        by_intent: dict
    ) -> Dict[str, Any]:
        """判断是否建议提升灰度"""
        reasons = []
        
        # 检查平均分
        if avg_score >= 4.3:
            reasons.append(f"平均评分 {avg_score:.1f}/5 达标 (≥4.3)")
            score_ok = True
        elif avg_score >= 4.0:
            reasons.append(f"平均评分 {avg_score:.1f}/5 可接受")
            score_ok = True
        else:
            reasons.append(f"平均评分 {avg_score:.1f}/5 偏低 (<4.0)")
            score_ok = False
        
        # 检查回退率
        if fallback_rate <= 0.05:
            reasons.append(f"回退率 {fallback_rate*100:.1f}% 正常")
            fallback_ok = True
        elif fallback_rate <= 0.1:
            reasons.append(f"回退率 {fallback_rate*100:.1f}% 可接受")
            fallback_ok = True
        else:
            reasons.append(f"回退率 {fallback_rate*100:.1f}% 偏高 (>10%)")
            fallback_ok = False
        
        # 检查延迟
        if avg_latency <= 50:
            reasons.append(f"平均延迟 {avg_latency:.0f}ms 优秀")
            latency_ok = True
        elif avg_latency <= 100:
            reasons.append(f"平均延迟 {avg_latency:.0f}ms 可接受")
            latency_ok = True
        else:
            reasons.append(f"平均延迟 {avg_latency:.0f}ms 偏高 (>100ms)")
            latency_ok = False
        
        # 检查意图覆盖
        core_intents = {"CODE", "REASON", "LONG", "CN"}
        covered = [i for i in core_intents if i in by_intent and by_intent[i]["count"] > 0]
        if len(covered) >= 3:
            reasons.append(f"意图覆盖 {len(covered)}/4 类型 ({', '.join(covered)})")
            coverage_ok = True
        else:
            reasons.append(f"意图覆盖不足 ({len(covered)}/4)")
            coverage_ok = False
        
        # 综合判断
        all_ok = score_ok and fallback_ok and latency_ok and coverage_ok
        
        if all_ok:
            return {
                "action": "increase",
                "suggestion": "建议提升到 50%",
                "reasons": reasons,
            }
        elif score_ok and fallback_ok:
            return {
                "action": "maintain",
                "suggestion": "维持 30%，继续观察",
                "reasons": reasons,
            }
        else:
            return {
                "action": "decrease",
                "suggestion": "建议回退到 0%，排查问题",
                "reasons": reasons,
            }
    
    def format_summary_report(self, report: Dict) -> str:
        """格式化简报"""
        if not report.get("has_data"):
            return f"OCNMPS 灰度日报 - {report['date']}\n\n当日无灰度数据。"
        
        s = report["summary"]
        r = report["recommendation"]
        
        lines = [
            f"📊 OCNMPS 灰度日报 - {report['date']}",
            "",
            f"今日灰度命中 {s['gray_hits']} 条，总任务 {s['total_tasks']} 条，命中率 {s['gray_hits']/s['total_tasks']*100:.0f}%。",
            f"平均评分 {s['avg_score']}/5，平均延迟 {s['avg_latency_ms']:.0f}ms，回退 {s['fallback_count']} 次。",
            "",
            "按意图表现：",
        ]
        
        for intent, data in report["by_intent"].items():
            score_str = f"{data['avg_score']:.1f}" if data["avg_score"] else "N/A"
            latency_str = f"{data['avg_latency_ms']:.0f}ms" if data["avg_latency_ms"] else "N/A"
            fallback_rate = data["fallback_count"] / data["count"] * 100 if data["count"] > 0 else 0
            lines.append(f"- {intent}: {data['count']}条，评分 {score_str}，延迟 {latency_str}，回退率 {fallback_rate:.0f}%")
        
        lines.append("")
        lines.append(f"📈 {r['suggestion']}")
        lines.append(f"原因：{r['reasons'][0]}")
        
        return "\n".join(lines)
    
    def format_full_report(self, report: Dict) -> str:
        """格式化完整报告"""
        if not report.get("has_data"):
            return f"# OCNMPS 灰度日报 - {report['date']}\n\n当日无灰度数据。"
        
        s = report["summary"]
        r = report["recommendation"]
        
        lines = [
            f"# OCNMPS 灰度日报 - {report['date']}",
            "",
            "## 总览摘要",
            "",
            f"- **灰度状态**: 30%",
            f"- **总体结论**: {r['action']}",
            f"- **今日样本数**: {s['total_tasks']}",
            f"- **平均评分**: {s['avg_score']}/5",
            f"- **平均延迟**: {s['avg_latency_ms']:.0f}ms",
            f"- **回退次数**: {s['fallback_count']}",
            f"- **是否建议扩大灰度**: {'是' if r['action'] == 'increase' else '否'}",
            "",
            "## 核心指标",
            "",
            "| 指标 | 数值 |",
            "|------|------|",
            f"| 灰度命中数 | {s['gray_hits']} |",
            f"| 总任务数 | {s['total_tasks']} |",
            f"| 平均评分 | {s['avg_score']}/5 |",
            f"| 平均延迟 | {s['avg_latency_ms']:.0f}ms |",
            f"| P50 延迟 | {s['p50_latency_ms']:.0f}ms |",
            f"| P95 延迟 | {s['p95_latency_ms']:.0f}ms |",
            f"| 回退次数 | {s['fallback_count']} |",
            "",
            "## 按意图类型统计",
            "",
            "| 意图 | 命中数 | 平均评分 | 平均延迟 | 回退率 |",
            "|------|--------|----------|----------|--------|",
        ]
        
        for intent, data in report["by_intent"].items():
            score_str = f"{data['avg_score']:.1f}" if data["avg_score"] else "N/A"
            latency_str = f"{data['avg_latency_ms']:.0f}ms" if data["avg_latency_ms"] else "N/A"
            fallback_rate = data["fallback_count"] / data["count"] * 100 if data["count"] > 0 else 0
            lines.append(f"| {intent} | {data['count']} | {score_str} | {latency_str} | {fallback_rate:.0f}% |")
        
        # 最佳样本
        if report.get("best_tasks"):
            lines.append("")
            lines.append("## 今日最佳样本")
            lines.append("")
            for i, task in enumerate(report["best_tasks"], 1):
                lines.append(f"### {i}. `{task.get('task_id', 'N/A')}`")
                lines.append(f"- 意图: {task.get('intent', 'N/A')}")
                lines.append(f"- 推荐模型: {task.get('recommended_model', 'N/A')}")
                if task.get("chain"):
                    lines.append(f"- 处理链: {' → '.join(task['chain'])}")
                lines.append(f"- 评分: {task.get('user_score', 'N/A')}/5")
                lines.append(f"- 延迟: {task.get('latency_ms', 0):.0f}ms")
                lines.append("")
        
        # 异常样本
        if report.get("low_scored_tasks"):
            lines.append("## 今日异常样本")
            lines.append("")
            for i, task in enumerate(report["low_scored_tasks"], 1):
                lines.append(f"### {i}. `{task.get('task_id', 'N/A')}` ⚠️")
                lines.append(f"- 意图: {task.get('intent', 'N/A')}")
                lines.append(f"- 推荐模型: {task.get('recommended_model', 'N/A')}")
                lines.append(f"- 评分: {task.get('user_score', 'N/A')}/5")
                lines.append(f"- 问题: 需分析")
                lines.append("")
        
        # 建议
        lines.append("## 灰度建议")
        lines.append("")
        lines.append(f"**{r['suggestion']}**")
        lines.append("")
        lines.append("原因：")
        for reason in r["reasons"]:
            lines.append(f"- {reason}")
        
        return "\n".join(lines)
    
    def save_report(self, report: Dict):
        """保存报告到文件"""
        date = report["date"]
        
        # 保存简报
        summary_file = os.path.join(self.report_dir, f"{date}-summary.md")
        with open(summary_file, "w") as f:
            f.write(self.format_summary_report(report))
        
        # 保存完整报告
        full_file = os.path.join(self.report_dir, f"{date}-full.md")
        with open(full_file, "w") as f:
            f.write(self.format_full_report(report))
        
        return summary_file, full_file


# ==================== CLI ====================

if __name__ == "__main__":
    import sys
    
    generator = DailyReportGenerator()
    
    # 支持指定日期
    date = sys.argv[1] if len(sys.argv) > 1 else None
    
    report = generator.generate_report(date)
    
    # 保存报告
    if report.get("has_data"):
        summary_file, full_file = generator.save_report(report)
        print(f"✅ 报告已保存:")
        print(f"   简报: {summary_file}")
        print(f"   完整: {full_file}")
    
    # 输出简报到控制台
    print("\n" + generator.format_summary_report(report))