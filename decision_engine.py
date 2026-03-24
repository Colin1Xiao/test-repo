#!/usr/bin/env python3
"""
决策闭环引擎
异常检测 → 自动追问 → 决策建议
"""

import os
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from collections import defaultdict

# ==================== 配置 ====================

DIGEST_DIR = os.path.expanduser("~/.openclaw/workspace/journals/digest")
DECISION_FILE = os.path.expanduser("~/.openclaw/workspace/reports/decision_suggestions.json")

# ==================== 异常检测规则 ====================

ANOMALY_RULES = {
    "no_progress": {
        "name": "项目停滞",
        "description": "项目连续 N 天无进展",
        "threshold_days": 3,
        "severity": "中",
        "auto_question": True,
    },
    "high_risk_escalation": {
        "name": "风险升级",
        "description": "项目风险等级上升",
        "threshold": "中→高",
        "severity": "高",
        "auto_question": True,
    },
    "risk_persistent": {
        "name": "风险持续",
        "description": "同一风险持续 N 天未解决",
        "threshold_days": 2,
        "severity": "中",
        "auto_question": True,
    },
    "plan_vs_complete_gap": {
        "name": "计划完成失衡",
        "description": "计划数远大于完成数",
        "threshold_ratio": 3.0,  # 计划/完成 > 3
        "severity": "低",
        "auto_question": True,
    },
    "no_planned_items": {
        "name": "无计划",
        "description": "连续 N 天无明日计划",
        "threshold_days": 2,
        "severity": "低",
        "auto_question": False,
    },
}

# ==================== 决策建议模板 ====================

DECISION_TEMPLATES = {
    "灰度系统": {
        "risk_up": "建议：延长观察期或考虑回滚",
        "no_progress": "建议：检查灰度指标是否正常",
    },
    "交易系统": {
        "no_progress": "建议：检查流量入口和信号质量",
        "risk_up": "建议：暂停交易，排查风险源",
    },
    "OCNMPS": {
        "no_progress": "建议：检查是否有阻塞依赖",
        "too_many_tasks": "建议：拆分子任务避免瓶颈",
    },
    "DEFAULT": {
        "no_progress": "建议：确认优先级或重新规划",
        "risk_up": "建议：评估风险影响范围",
    },
}


class DecisionEngine:
    """决策闭环引擎"""
    
    def __init__(self):
        self.digest_dir = DIGEST_DIR
    
    def load_history(self, days: int = 7) -> List[Dict]:
        """加载历史日报数据"""
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
        
        return history
    
    def detect_anomalies(self, history: List[Dict]) -> List[Dict]:
        """
        检测异常
        
        Returns:
            list: 异常列表，每项包含 {type, project, severity, question, suggestion}
        """
        anomalies = []
        
        if not history:
            return anomalies
        
        today = history[0] if history else {}
        today_date = today.get("date", datetime.now().strftime("%Y-%m-%d"))
        
        # ===== 检测1: 项目停滞 =====
        project_last_progress = {}
        for record in reversed(history):  # 从旧到新
            for item in record.get("completed", []):
                project = item.get("project")
                if project:
                    project_last_progress[project] = record["date"]
        
        # 检查每个项目是否停滞
        all_projects = set()
        for record in history:
            for item in record.get("completed", []) + record.get("planned", []):
                if item.get("project"):
                    all_projects.add(item.get("project"))
        
        threshold = ANOMALY_RULES["no_progress"]["threshold_days"]
        for project in all_projects:
            last_progress = project_last_progress.get(project)
            if last_progress:
                last_date = datetime.strptime(last_progress, "%Y-%m-%d")
                days_since = (datetime.strptime(today_date, "%Y-%m-%d") - last_date).days
                
                if days_since >= threshold:
                    anomalies.append({
                        "type": "no_progress",
                        "project": project,
                        "severity": ANOMALY_RULES["no_progress"]["severity"],
                        "days": days_since,
                        "question": f"🤔 项目「{project}」已 {days_since} 天无进展，是否：\n1. 已完成未记录\n2. 被阻塞\n3. 优先级下降",
                        "suggestion": self._get_suggestion(project, "no_progress"),
                    })
            elif project in [item.get("project") for item in today.get("planned", [])]:
                # 在计划中但从未完成过
                anomalies.append({
                    "type": "new_project_no_progress",
                    "project": project,
                    "severity": "低",
                    "question": f"🤔 项目「{project}」在计划中但尚无完成记录，是否需要支持？",
                    "suggestion": "建议：确认资源是否到位",
                })
        
        # ===== 检测2: 风险持续 =====
        risk_history = defaultdict(list)
        for record in history:
            for item in record.get("risks", []):
                risk_key = item.get("content", "")[:30]  # 用前30字作为key
                risk_history[risk_key].append({
                    "date": record["date"],
                    "level": item.get("risk_level", "中"),
                    "project": item.get("project"),
                })
        
        threshold_days = ANOMALY_RULES["risk_persistent"]["threshold_days"]
        for risk_key, occurrences in risk_history.items():
            if len(occurrences) >= threshold_days:
                first_occurrence = occurrences[0]
                anomalies.append({
                    "type": "risk_persistent",
                    "project": first_occurrence.get("project"),
                    "severity": ANOMALY_RULES["risk_persistent"]["severity"],
                    "days": len(occurrences),
                    "question": f"🤔 风险「{risk_key}...」已持续 {len(occurrences)} 天，是否需要升级处理？",
                    "suggestion": "建议：指派专人跟进，设定解决期限",
                })
        
        # ===== 检测3: 计划完成失衡 =====
        if history:
            total_planned = sum(len(r.get("planned", [])) for r in history[:3])  # 最近3天
            total_completed = sum(len(r.get("completed", [])) for r in history[:3])
            
            if total_completed > 0:
                ratio = total_planned / total_completed
                if ratio > ANOMALY_RULES["plan_vs_complete_gap"]["threshold_ratio"]:
                    anomalies.append({
                        "type": "plan_vs_complete_gap",
                        "project": "整体",
                        "severity": ANOMALY_RULES["plan_vs_complete_gap"]["severity"],
                        "ratio": round(ratio, 1),
                        "question": f"🤔 计划/完成比例 {ratio:.1f}:1，是否存在过度承诺或执行阻塞？",
                        "suggestion": "建议：重新评估计划可行性",
                    })
        
        # ===== 检测4: 无计划 =====
        no_plan_days = 0
        for record in history:
            if not record.get("planned"):
                no_plan_days += 1
            else:
                break
        
        if no_plan_days >= ANOMALY_RULES["no_planned_items"]["threshold_days"]:
            anomalies.append({
                "type": "no_planned_items",
                "project": "整体",
                "severity": ANOMALY_RULES["no_planned_items"]["severity"],
                "days": no_plan_days,
                "question": f"🤔 连续 {no_plan_days} 天无明日计划，是否需要提前规划？",
                "suggestion": "建议：花15分钟做下周期规划",
            })
        
        return anomalies
    
    def _get_suggestion(self, project: str, issue_type: str) -> str:
        """获取决策建议"""
        project_templates = DECISION_TEMPLATES.get(project, DECISION_TEMPLATES["DEFAULT"])
        return project_templates.get(issue_type, DECISION_TEMPLATES["DEFAULT"].get(issue_type, "建议：评估并采取行动"))
    
    def generate_decision_suggestions(self) -> Dict[str, Any]:
        """
        生成决策建议
        
        Returns:
            dict: {
                "date": str,
                "anomalies": list,
                "actions": list,  # 建议行动
                "questions": list,  # 自动追问
            }
        """
        history = self.load_history(7)
        anomalies = self.detect_anomalies(history)
        
        # 生成追问列表
        questions = []
        for a in anomalies:
            if a.get("question"):
                questions.append({
                    "project": a.get("project"),
                    "severity": a.get("severity"),
                    "question": a["question"],
                    "suggestion": a.get("suggestion"),
                })
        
        # 生成行动建议
        actions = []
        
        # 按严重程度排序
        severity_order = {"高": 0, "中": 1, "低": 2}
        sorted_anomalies = sorted(anomalies, key=lambda x: severity_order.get(x.get("severity", "低"), 2))
        
        for a in sorted_anomalies[:5]:  # 最多5个行动
            actions.append({
                "priority": a.get("severity"),
                "project": a.get("project"),
                "action": a.get("suggestion"),
                "reason": f"[{a.get('type')}] {a.get('days', '')}",
            })
        
        result = {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "total_anomalies": len(anomalies),
            "anomalies": anomalies,
            "questions": questions,
            "actions": actions,
        }
        
        # 保存
        with open(DECISION_FILE, "w") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        
        return result
    
    def format_questions(self, suggestions: Dict) -> str:
        """格式化追问（可发送给用户）"""
        if not suggestions.get("questions"):
            return "✅ 今日无异常，系统运行正常。"
        
        lines = ["## 🤖 系统追问\n"]
        
        for i, q in enumerate(suggestions["questions"], 1):
            severity_emoji = "🚨" if q["severity"] == "高" else "⚠️" if q["severity"] == "中" else "📝"
            lines.append(f"### {i}. {severity_emoji} [{q['project'] or '整体'}]")
            lines.append(f"{q['question']}")
            if q.get("suggestion"):
                lines.append(f"\n💡 {q['suggestion']}")
            lines.append("")
        
        return "\n".join(lines)


# ==================== CLI ====================

if __name__ == "__main__":
    engine = DecisionEngine()
    suggestions = engine.generate_decision_suggestions()
    
    print(f"📊 决策建议 - {suggestions['date']}")
    print(f"异常数量: {suggestions['total_anomalies']}")
    print()
    
    print(engine.format_questions(suggestions))