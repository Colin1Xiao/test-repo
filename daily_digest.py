#!/usr/bin/env python3
"""
Daily Digest 统一日报系统
唯一入口 + 自动汇总 + 全链路复用
"""

import os
import json
from datetime import datetime
from typing import Dict, Any, List, Optional

# ==================== 结构化标签 ====================

# 项目字典（统一识别）
PROJECT_ALIASES = {
    "OCNMPS": ["ocnmps", "bridge", "OCN", "多模型", "灰度路由"],
    "灰度系统": ["gray", "canary", "灰度", "灰度发布"],
    "交易系统": ["trading", "xiaolong", "小龙", "V5.2", "V5"],
    "路由系统": ["router", "路由", "routing"],
    "AutoHeal": ["autoheal", "健康检查", "auto-heal"],
    "Daily Digest": ["digest", "日报", "daily"],
    "Memory": ["memory", "记忆", "日志"],
}

# 任务类型
TASK_TYPES = ["功能", "修复", "优化", "重构", "文档", "测试", "部署", "会议"]

# 风险等级
RISK_LEVELS = ["高", "中", "低"]

# 优先级
PRIORITIES = ["高", "中", "低"]

# 决策类型
DECISION_TYPES = ["发布", "暂停", "回退", "批准", "拒绝", "调整"]


def normalize_project(project_str: str) -> str:
    """将项目名标准化"""
    project_lower = project_str.lower().strip()
    
    for canonical, aliases in PROJECT_ALIASES.items():
        if project_lower == canonical.lower():
            return canonical
        for alias in aliases:
            if alias.lower() in project_lower:
                return canonical
    
    return project_str  # 无法识别则原样返回


def parse_structured_item(item: str) -> Dict[str, str]:
    """
    解析结构化条目
    
    格式: [项目: xxx][类型: xxx][状态: xxx] 内容
    或: 简单文本（自动推断项目）
    """
    import re
    
    result = {
        "project": None,
        "type": None,
        "status": None,
        "priority": None,
        "risk_level": None,
        "content": item,
    }
    
    # 尝试解析标签
    project_match = re.search(r'\[项目[：:]\s*([^\]]+)\]', item)
    if project_match:
        result["project"] = normalize_project(project_match.group(1))
    
    type_match = re.search(r'\[类型[：:]\s*([^\]]+)\]', item)
    if type_match:
        result["type"] = type_match.group(1)
    
    status_match = re.search(r'\[状态[：:]\s*([^\]]+)\]', item)
    if status_match:
        result["status"] = status_match.group(1)
    
    priority_match = re.search(r'\[优先级[：:]\s*([^\]]+)\]', item)
    if priority_match:
        result["priority"] = priority_match.group(1)
    
    risk_match = re.search(r'\[等级[：:]\s*([^\]]+)\]', item)
    if risk_match:
        result["risk_level"] = risk_match.group(1)
    
    # 如果没有项目标签，尝试自动推断
    if not result["project"]:
        for canonical, aliases in PROJECT_ALIASES.items():
            for alias in aliases:
                if alias.lower() in item.lower():
                    result["project"] = canonical
                    break
            if result["project"]:
                break
    
    # 提取纯内容（去除标签）
    content = re.sub(r'\[[^\]]+\]', '', item).strip()
    result["content"] = content if content else item
    
    return result


# ==================== 配置 ====================

DIGEST_DIR = os.path.expanduser("~/.openclaw/workspace/journals/digest")
MEMORY_DIR = os.path.expanduser("~/.openclaw/workspace/memory")
REPORTS_DIR = os.path.expanduser("~/.openclaw/workspace/reports")

# ==================== 标准模板 ====================

DAILY_DIGEST_TEMPLATE = """# 📰 每日日报 - {date}

**填报人**: {author}
**关联项目**: {project}

---

## 1. 今日完成

{completed}

---

## 2. 明日计划

{planned}

---

## 3. 风险/阻塞

{risks}

---

## 4. 关键决策

{decisions}

---

## 5. 数据指标（自动采集）

{metrics}

---

_生成时间: {timestamp}_
"""

# ==================== 核心类 ====================

class DailyDigest:
    """统一日报系统"""
    
    def __init__(self):
        self.digest_dir = DIGEST_DIR
        self.memory_dir = MEMORY_DIR
        os.makedirs(self.digest_dir, exist_ok=True)
    
    def create_digest(
        self,
        date: Optional[str] = None,
        author: str = "Colin",
        project: str = "OpenClaw",
        completed: List[str] = None,
        planned: List[str] = None,
        risks: List[str] = None,
        decisions: List[str] = None,
    ) -> Dict[str, Any]:
        """
        创建日报（支持结构化标签）
        
        Args:
            date: 日期，默认今天
            author: 填报人
            project: 关联项目（默认）
            completed: 今日完成列表（支持 [项目:xxx][类型:xxx] 格式）
            planned: 明日计划列表
            risks: 风险/阻塞列表（支持 [等级:高/中/低] 格式）
            decisions: 关键决策列表
        
        Returns:
            dict: 日报数据（结构化）
        """
        if date is None:
            date = datetime.now().strftime("%Y-%m-%d")
        
        # 解析结构化数据
        completed_parsed = [parse_structured_item(item) for item in (completed or [])]
        planned_parsed = [parse_structured_item(item) for item in (planned or [])]
        risks_parsed = [parse_structured_item(item) for item in (risks or [])]
        decisions_parsed = [parse_structured_item(item) for item in (decisions or [])]
        
        # 格式化列表（保留标签，便于阅读）
        completed_str = "\n".join(
            f"- [{p['project'] or project}][{p['type'] or '任务'}] {p['content']}" 
            for p in completed_parsed
        ) or "- 无"
        
        planned_str = "\n".join(
            f"- [{p['project'] or project}][{p['priority'] or '中'}] {p['content']}" 
            for p in planned_parsed
        ) or "- 无"
        
        risks_str = "\n".join(
            f"- [等级:{p['risk_level'] or '中'}][{p['project'] or '通用'}] {p['content']}" 
            for p in risks_parsed
        ) or "- 无"
        
        decisions_str = "\n".join(
            f"- [{p['type'] or '决策'}] {p['content']}" 
            for p in decisions_parsed
        ) or "- 无"
        
        # 自动采集数据指标
        metrics = self._collect_metrics()
        metrics_str = self._format_metrics(metrics)
        
        # 生成内容
        content = DAILY_DIGEST_TEMPLATE.format(
            date=date,
            author=author,
            project=project,
            completed=completed_str,
            planned=planned_str,
            risks=risks_str,
            decisions=decisions_str,
            metrics=metrics_str,
            timestamp=datetime.now().isoformat(),
        )
        
        # 保存日报
        digest_file = os.path.join(self.digest_dir, f"digest-{date}.md")
        with open(digest_file, "w") as f:
            f.write(content)
        
        # 返回结构化数据（便于程序消费）
        digest_data = {
            "date": date,
            "author": author,
            "project": project,
            "completed": completed_parsed,  # 结构化
            "planned": planned_parsed,      # 结构化
            "risks": risks_parsed,          # 结构化
            "decisions": decisions_parsed,  # 结构化
            "metrics": metrics,
            "file": digest_file,
        }
        
        # 保存 JSON 格式
        json_file = os.path.join(self.digest_dir, f"digest-{date}.json")
        with open(json_file, "w") as f:
            json.dump(digest_data, f, ensure_ascii=False, indent=2)
        
        return digest_data
    
    def _collect_metrics(self) -> Dict[str, Any]:
        """自动采集数据指标"""
        metrics = {}
        
        # 1. OCNMPS 灰度状态
        stats_file = os.path.expanduser("~/.openclaw/workspace/ocnmps_stats.json")
        if os.path.exists(stats_file):
            with open(stats_file, "r") as f:
                stats = json.load(f)
                metrics["ocnmps"] = {
                    "total_requests": stats.get("total_requests", 0),
                    "bridge_used": stats.get("bridge_used", 0),
                    "avg_score": stats.get("avg_score", 0),
                }
        
        # 2. Memory 文件数量
        if os.path.exists(self.memory_dir):
            memory_files = [f for f in os.listdir(self.memory_dir) if f.endswith(".md")]
            metrics["memory_files"] = len(memory_files)
        
        # 3. 技能数量
        skills_dir = os.path.expanduser("~/.openclaw/workspace/skills")
        if os.path.exists(skills_dir):
            skills = [d for d in os.listdir(skills_dir) if os.path.isdir(os.path.join(skills_dir, d))]
            metrics["skills_count"] = len(skills)
        
        return metrics
    
    def _format_metrics(self, metrics: Dict) -> str:
        """格式化指标"""
        lines = []
        
        if "ocnmps" in metrics:
            o = metrics["ocnmps"]
            lines.append(f"- OCNMPS: {o['bridge_used']}/{o['total_requests']} 次桥接, 平均评分 {o['avg_score']}/5")
        
        if "memory_files" in metrics:
            lines.append(f"- Memory: {metrics['memory_files']} 个记录文件")
        
        if "skills_count" in metrics:
            lines.append(f"- 技能: {metrics['skills_count']} 个已安装")
        
        return "\n".join(lines) if lines else "- 无"
    
    def get_digest(self, date: str = None) -> Optional[Dict[str, Any]]:
        """获取指定日期的日报"""
        if date is None:
            date = datetime.now().strftime("%Y-%m-%d")
        
        json_file = os.path.join(self.digest_dir, f"digest-{date}.json")
        if os.path.exists(json_file):
            with open(json_file, "r") as f:
                return json.load(f)
        
        return None
    
    def generate_weekly_summary(self, end_date: str = None) -> Dict[str, Any]:
        """
        生成周报汇总（从日报消费）
        
        Args:
            end_date: 周结束日期
        """
        from datetime import timedelta
        
        if end_date is None:
            end_date = datetime.now().strftime("%Y-%m-%d")
        
        end = datetime.strptime(end_date, "%Y-%m-%d")
        
        # 收集一周的日报
        weekly_data = {
            "completed": [],
            "risks": [],
            "decisions": [],
        }
        
        for i in range(7):
            date = (end - timedelta(days=i)).strftime("%Y-%m-%d")
            digest = self.get_digest(date)
            if digest:
                weekly_data["completed"].extend(digest.get("completed", []))
                weekly_data["risks"].extend(digest.get("risks", []))
                weekly_data["decisions"].extend(digest.get("decisions", []))
        
        return weekly_data


# ==================== 便捷函数 ====================

def create_daily_digest(
    completed: List[str] = None,
    planned: List[str] = None,
    risks: List[str] = None,
    decisions: List[str] = None,
    project: str = "OpenClaw",
) -> Dict[str, Any]:
    """
    快速创建日报
    
    Usage:
        create_daily_digest(
            completed=["完成 OCNMPS v2", "修复路由bug"],
            planned=["灰度观察", "交易系统监控"],
            risks=["某意图误路由"],
            decisions=["维持30%灰度"],
        )
    """
    digest = DailyDigest()
    return digest.create_digest(
        completed=completed,
        planned=planned,
        risks=risks,
        decisions=decisions,
        project=project,
    )


# ==================== CLI ====================

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("""
Daily Digest - 统一日报系统

用法:
  python3 daily_digest.py create                    # 交互式创建
  python3 daily_digest.py quick "完成A" "计划B"     # 快速创建
  python3 daily_digest.py show [日期]               # 查看日报
  python3 daily_digest.py weekly                    # 生成周报汇总
""")
        sys.exit(0)
    
    cmd = sys.argv[1]
    digest = DailyDigest()
    
    if cmd == "create":
        # 交互式创建
        print("📝 创建日报\n")
        
        completed = input("今日完成（逗号分隔）: ").strip()
        completed = [x.strip() for x in completed.split(",") if x.strip()]
        
        planned = input("明日计划（逗号分隔）: ").strip()
        planned = [x.strip() for x in planned.split(",") if x.strip()]
        
        risks = input("风险/阻塞（逗号分隔，可空）: ").strip()
        risks = [x.strip() for x in risks.split(",") if x.strip()]
        
        decisions = input("关键决策（逗号分隔，可空）: ").strip()
        decisions = [x.strip() for x in decisions.split(",") if x.strip()]
        
        result = digest.create_digest(
            completed=completed,
            planned=planned,
            risks=risks,
            decisions=decisions,
        )
        
        print(f"\n✅ 日报已保存: {result['file']}")
    
    elif cmd == "quick" and len(sys.argv) >= 3:
        # 快速创建
        completed = sys.argv[2:3] if len(sys.argv) > 2 else []
        planned = sys.argv[3:4] if len(sys.argv) > 3 else []
        
        result = digest.create_digest(
            completed=completed,
            planned=planned,
        )
        
        print(f"✅ 日报已保存: {result['file']}")
    
    elif cmd == "show":
        date = sys.argv[2] if len(sys.argv) > 2 else None
        result = digest.get_digest(date)
        
        if result:
            print(f"📰 日报 - {result['date']}")
            print(f"完成: {result['completed']}")
            print(f"计划: {result['planned']}")
            print(f"风险: {result['risks']}")
        else:
            print("❌ 未找到日报")
    
    elif cmd == "weekly":
        result = digest.generate_weekly_summary()
        
        print("📊 周报汇总")
        print(f"完成事项: {len(result['completed'])} 项")
        print(f"风险: {len(result['risks'])} 项")
        print(f"决策: {len(result['decisions'])} 项")