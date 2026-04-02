#!/usr/bin/env python3
"""
7天验证指标追踪器
追踪: 结构化采用率、追问响应率、行为改变率、重复填写减少率
"""

import os
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List
from collections import defaultdict

DIGEST_DIR = os.path.expanduser("~/.openclaw/workspace/journals/digest")
DECISION_FILE = os.path.expanduser("~/.openclaw/workspace/reports/decision_suggestions.json")
VALIDATION_FILE = os.path.expanduser("~/.openclaw/workspace/reports/validation_metrics.json")


class ValidationTracker:
    """验证指标追踪器"""
    
    def __init__(self):
        self.digest_dir = DIGEST_DIR
        self.validation_file = VALIDATION_FILE
    
    def calculate_metrics(self, days: int = 7) -> Dict[str, Any]:
        """
        计算所有验证指标
        
        Returns:
            dict: 指标数据
        """
        metrics = {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "period_days": days,
            "daily_metrics": {},
            "summary": {},
        }
        
        # 收集历史数据
        history = self._load_history(days)
        
        if not history:
            metrics["error"] = "无历史数据"
            return metrics
        
        # ===== 指标1: 结构化采用率 =====
        structured_rates = []
        for record in history:
            rate = self._calc_structured_rate(record)
            date = record.get("date", "unknown")
            metrics["daily_metrics"][date] = {"structured_rate": rate}
            structured_rates.append(rate)
        
        metrics["summary"]["structured_adoption"] = {
            "avg": round(sum(structured_rates) / len(structured_rates), 2) if structured_rates else 0,
            "trend": structured_rates,
            "target_day1_2": "≥50%",
            "target_day5_7": "≥80%",
            "status": self._evaluate_structured(structured_rates),
        }
        
        # ===== 指标2: 追问响应率 =====
        # 检查: 被追问的问题是否在后续被处理
        response_rate = self._calc_response_rate(history)
        metrics["summary"]["question_response"] = {
            "rate": response_rate["rate"],
            "total_questions": response_rate["total"],
            "responded": response_rate["responded"],
            "target": "≥70%",
            "status": "达标" if response_rate["rate"] >= 0.7 else "未达标",
        }
        
        # ===== 指标3: 行为改变率 =====
        behavior_change = self._calc_behavior_change(history)
        metrics["summary"]["behavior_change"] = {
            "rate": behavior_change["rate"],
            "total_issues": behavior_change["total"],
            "changed": behavior_change["changed"],
            "target": "≥40%",
            "status": "达标" if behavior_change["rate"] >= 0.4 else "未达标",
        }
        
        # ===== 指标4: 重复填写减少率 =====
        # 检查: 是否还在维护其他日报系统
        # 这里用 Memory 文件和 Digest 文件的对比作为代理指标
        duplicate_rate = self._calc_duplicate_rate()
        metrics["summary"]["duplicate_reduction"] = {
            "rate": duplicate_rate,
            "target": "接近0%",
            "status": "需人工确认",
            "note": "检查是否还在手动维护 Memory 或其他日报",
        }
        
        # ===== 综合评估 =====
        metrics["summary"]["overall"] = self._overall_assessment(metrics["summary"])
        
        # 保存
        with open(self.validation_file, "w") as f:
            json.dump(metrics, f, ensure_ascii=False, indent=2)
        
        return metrics
    
    def _load_history(self, days: int) -> List[Dict]:
        """加载历史日报"""
        history = []
        today = datetime.now()
        
        for i in range(days):
            date = (today - timedelta(days=i)).strftime("%Y-%m-%d")
            json_file = os.path.join(self.digest_dir, f"digest-{date}.json")
            
            if os.path.exists(json_file):
                with open(json_file, "r") as f:
                    data = json.load(f)
                    data["date"] = date
                    history.append(data)
        
        return list(reversed(history))  # 从旧到新
    
    def _calc_structured_rate(self, record: Dict) -> float:
        """计算结构化采用率"""
        total = 0
        structured = 0
        
        for field in ["completed", "planned", "risks"]:
            items = record.get(field, [])
            for item in items:
                total += 1
                # 检查是否有结构化字段
                if isinstance(item, dict):
                    if item.get("project") or item.get("type") or item.get("risk_level"):
                        structured += 1
        
        return round(structured / total, 2) if total > 0 else 0
    
    def _calc_response_rate(self, history: List[Dict]) -> Dict:
        """计算追问响应率"""
        # 简化实现: 检查风险是否在后续被解决
        total_questions = 0
        responded = 0
        
        # 收集所有风险
        all_risks = []
        for record in history:
            for risk in record.get("risks", []):
                all_risks.append({
                    "date": record["date"],
                    "content": risk.get("content", "")[:30],
                    "project": risk.get("project"),
                })
        
        total_questions = len(all_risks)
        
        # 检查风险是否在后续消失或有进展
        for i, risk in enumerate(all_risks):
            # 在后续记录中检查
            for record in history:
                if record["date"] <= risk["date"]:
                    continue
                
                # 检查是否被解决（风险消失或项目有进展）
                for item in record.get("completed", []):
                    if item.get("project") == risk.get("project"):
                        responded += 1
                        break
        
        return {
            "rate": round(responded / total_questions, 2) if total_questions > 0 else 0,
            "total": total_questions,
            "responded": responded,
        }
    
    def _calc_behavior_change(self, history: List[Dict]) -> Dict:
        """计算行为改变率"""
        # 检查: 被追问的问题是否在第二天发生变化
        total_issues = 0
        changed = 0
        
        for i, record in enumerate(history[:-1]):  # 不包括最后一天
            next_record = history[i + 1]
            
            # 检查今日计划是否在明日完成
            for planned in record.get("planned", []):
                total_issues += 1
                project = planned.get("project")
                
                # 在下一天的完成中检查
                for completed in next_record.get("completed", []):
                    if completed.get("project") == project:
                        changed += 1
                        break
        
        return {
            "rate": round(changed / total_issues, 2) if total_issues > 0 else 0,
            "total": total_issues,
            "changed": changed,
        }
    
    def _calc_duplicate_rate(self) -> float:
        """计算重复填写率（代理指标）"""
        # 检查 Memory 文件是否还在被手动维护
        memory_dir = os.path.expanduser("~/.openclaw/workspace/memory")
        
        if not os.path.exists(memory_dir):
            return 0
        
        # 检查最近3天的 Memory 文件大小
        recent_memory_size = 0
        recent_digest_size = 0
        
        today = datetime.now()
        for i in range(3):
            date = (today - timedelta(days=i)).strftime("%Y-%m-%d")
            
            memory_file = os.path.join(memory_dir, f"{date}.md")
            if os.path.exists(memory_file):
                recent_memory_size += os.path.getsize(memory_file)
            
            digest_file = os.path.join(self.digest_dir, f"digest-{date}.md")
            if os.path.exists(digest_file):
                recent_digest_size += os.path.getsize(digest_file)
        
        # 如果 Memory 比 Digest 大很多，说明还在重复填写
        if recent_digest_size == 0:
            return 1.0
        
        ratio = recent_memory_size / recent_digest_size
        # ratio > 2 说明重复填写严重
        return min(1.0, max(0, (ratio - 1) / 2))
    
    def _evaluate_structured(self, rates: List[float]) -> str:
        """评估结构化采用率"""
        if not rates:
            return "无数据"
        
        if len(rates) >= 5:
            recent_avg = sum(rates[-3:]) / 3
            if recent_avg >= 0.8:
                return "✅ 达标"
            elif recent_avg >= 0.5:
                return "⚠️ 需提升"
            else:
                return "❌ 未达标"
        else:
            # 数据不足
            current = rates[-1] if rates else 0
            if current >= 0.5:
                return "⏳ 观察中"
            else:
                return "⚠️ 需提升"
    
    def _overall_assessment(self, summary: Dict) -> Dict:
        """综合评估"""
        scores = []
        
        # 结构化采用率
        if summary.get("structured_adoption", {}).get("status") == "✅ 达标":
            scores.append(1)
        elif "⚠️" in summary.get("structured_adoption", {}).get("status", ""):
            scores.append(0.5)
        
        # 追问响应率
        if summary.get("question_response", {}).get("rate", 0) >= 0.7:
            scores.append(1)
        elif summary.get("question_response", {}).get("rate", 0) >= 0.5:
            scores.append(0.5)
        
        # 行为改变率
        if summary.get("behavior_change", {}).get("rate", 0) >= 0.4:
            scores.append(1)
        elif summary.get("behavior_change", {}).get("rate", 0) >= 0.2:
            scores.append(0.5)
        
        avg_score = sum(scores) / len(scores) if scores else 0
        
        if avg_score >= 0.8:
            return {
                "status": "🟢 跑通",
                "action": "进入 L6 自适应升级",
            }
        elif avg_score >= 0.5:
            return {
                "status": "🟡 能用但别扭",
                "action": "做 UX/交互优化",
            }
        else:
            return {
                "status": "🔴 需调整",
                "action": "降维重做",
            }
    
    def format_report(self, metrics: Dict) -> str:
        """格式化报告"""
        if metrics.get("error"):
            return f"❌ {metrics['error']}"
        
        lines = [
            f"# 📊 7天验证指标 - {metrics['date']}",
            "",
            "---",
            "",
        ]
        
        summary = metrics.get("summary", {})
        
        # 指标1
        s1 = summary.get("structured_adoption", {})
        lines.append("## 1️⃣ 结构化采用率")
        lines.append("")
        lines.append(f"- **当前**: {s1.get('avg', 0)*100:.0f}%")
        lines.append(f"- **目标**: {s1.get('target_day5_7')}")
        lines.append(f"- **状态**: {s1.get('status')}")
        lines.append("")
        
        # 指标2
        s2 = summary.get("question_response", {})
        lines.append("## 2️⃣ 追问响应率")
        lines.append("")
        lines.append(f"- **当前**: {s2.get('rate', 0)*100:.0f}% ({s2.get('responded')}/{s2.get('total')})")
        lines.append(f"- **目标**: {s2.get('target')}")
        lines.append(f"- **状态**: {s2.get('status')}")
        lines.append("")
        
        # 指标3
        s3 = summary.get("behavior_change", {})
        lines.append("## 3️⃣ 行为改变率")
        lines.append("")
        lines.append(f"- **当前**: {s3.get('rate', 0)*100:.0f}% ({s3.get('changed')}/{s3.get('total')})")
        lines.append(f"- **目标**: {s3.get('target')}")
        lines.append(f"- **状态**: {s3.get('status')}")
        lines.append("")
        
        # 指标4
        s4 = summary.get("duplicate_reduction", {})
        lines.append("## 4️⃣ 重复填写减少率")
        lines.append("")
        lines.append(f"- **状态**: {s4.get('status')}")
        lines.append(f"- **备注**: {s4.get('note')}")
        lines.append("")
        
        # 综合评估
        overall = summary.get("overall", {})
        lines.append("---")
        lines.append("")
        lines.append("## 🎯 综合评估")
        lines.append("")
        lines.append(f"**状态**: {overall.get('status')}")
        lines.append(f"**下一步**: {overall.get('action')}")
        
        return "\n".join(lines)


# ==================== CLI ====================

if __name__ == "__main__":
    tracker = ValidationTracker()
    metrics = tracker.calculate_metrics(7)
    
    print(tracker.format_report(metrics))