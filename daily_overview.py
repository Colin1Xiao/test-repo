#!/usr/bin/env python3
"""
每日总览自动汇总
从多个数据源采集，生成统一总览
"""

import os
import json
from datetime import datetime
from typing import Dict, Any, List

# ==================== 配置 ====================

DIGEST_DIR = os.path.expanduser("~/.openclaw/workspace/journals/digest")
MEMORY_DIR = os.path.expanduser("~/.openclaw/workspace/memory")
REPORTS_DIR = os.path.expanduser("~/.openclaw/workspace/reports")
OVERVIEW_DIR = os.path.join(REPORTS_DIR, "daily_overview")


class DailyOverview:
    """每日总览生成器 + 分析引擎"""
    
    def __init__(self):
        self.overview_dir = OVERVIEW_DIR
        os.makedirs(self.overview_dir, exist_ok=True)
    
    def analyze_digest(self, digest_data: Dict) -> Dict[str, Any]:
        """
        分析日报数据（核心分析能力）
        
        Returns:
            dict: 分析结果
        """
        analysis = {
            "projects": {},      # 项目分布
            "risks": {           # 风险统计
                "高": 0, "中": 0, "低": 0
            },
            "types": {},         # 任务类型分布
            "priorities": {      # 优先级分布
                "高": 0, "中": 0, "低": 0
            },
            "decisions": [],     # 决策列表
            "health_score": 100, # 健康分数
        }
        
        # 分析完成事项
        for item in digest_data.get("completed", []):
            project = item.get("project") or "其他"
            task_type = item.get("type") or "任务"
            
            if project not in analysis["projects"]:
                analysis["projects"][project] = {"completed": 0, "planned": 0, "risks": 0}
            analysis["projects"][project]["completed"] += 1
            
            if task_type not in analysis["types"]:
                analysis["types"][task_type] = 0
            analysis["types"][task_type] += 1
        
        # 分析计划事项
        for item in digest_data.get("planned", []):
            project = item.get("project") or "其他"
            priority = item.get("priority") or "中"
            
            if project not in analysis["projects"]:
                analysis["projects"][project] = {"completed": 0, "planned": 0, "risks": 0}
            analysis["projects"][project]["planned"] += 1
            
            if priority in analysis["priorities"]:
                analysis["priorities"][priority] += 1
        
        # 分析风险
        for item in digest_data.get("risks", []):
            risk_level = item.get("risk_level") or "中"
            project = item.get("project") or "其他"
            
            if risk_level in analysis["risks"]:
                analysis["risks"][risk_level] += 1
            
            if project not in analysis["projects"]:
                analysis["projects"][project] = {"completed": 0, "planned": 0, "risks": 0}
            analysis["projects"][project]["risks"] += 1
            
            # 高风险扣分
            if risk_level == "高":
                analysis["health_score"] -= 20
            elif risk_level == "中":
                analysis["health_score"] -= 5
        
        # 分析决策
        for item in digest_data.get("decisions", []):
            analysis["decisions"].append({
                "type": item.get("type") or "决策",
                "content": item.get("content"),
            })
        
        # 健康分数不低于0
        analysis["health_score"] = max(0, analysis["health_score"])
        
        return analysis
    
    def detect_anomalies(self, analysis: Dict) -> List[str]:
        """检测异常信号"""
        anomalies = []
        
        # 高风险警告
        if analysis["risks"]["高"] > 0:
            anomalies.append(f"🚨 {analysis['risks']['高']} 个高风险需要立即处理")
        
        # 中风险警告
        if analysis["risks"]["中"] >= 3:
            anomalies.append(f"⚠️ {analysis['risks']['中']} 个中风险需要关注")
        
        # 项目失衡（只有计划没有完成）
        for project, stats in analysis["projects"].items():
            if stats["planned"] > 3 and stats["completed"] == 0:
                anomalies.append(f"📋 {project} 只有计划没有完成")
        
        # 健康分数过低
        if analysis["health_score"] < 70:
            anomalies.append(f"❤️ 项目健康分 {analysis['health_score']} 分，需要关注")
        
        return anomalies
    
    def collect_all_sources(self) -> Dict[str, Any]:
        """采集所有数据源"""
        data = {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "sources": {},
        }
        
        # 1. Daily Digest
        data["sources"]["digest"] = self._collect_digest()
        
        # 2. Memory 摘要
        data["sources"]["memory"] = self._collect_memory()
        
        # 3. OCNMPS 灰度状态
        data["sources"]["ocnmps"] = self._collect_ocnmps()
        
        # 4. 交易系统状态
        data["sources"]["trading"] = self._collect_trading()
        
        # 5. AutoHeal 健康状态
        data["sources"]["autoheal"] = self._collect_autoheal()
        
        return data
    
    def _collect_digest(self) -> Dict[str, Any]:
        """采集 Daily Digest"""
        date = datetime.now().strftime("%Y-%m-%d")
        json_file = os.path.join(DIGEST_DIR, f"digest-{date}.json")
        
        if os.path.exists(json_file):
            with open(json_file, "r") as f:
                return json.load(f)
        
        return {"status": "not_found", "message": "今日尚未填写日报"}
    
    def _collect_memory(self) -> Dict[str, Any]:
        """采集 Memory 摘要"""
        date = datetime.now().strftime("%Y-%m-%d")
        memory_file = os.path.join(MEMORY_DIR, f"{date}.md")
        
        if os.path.exists(memory_file):
            with open(memory_file, "r") as f:
                content = f.read()
                # 提取关键信息
                lines = content.split("\n")
                headings = [l for l in lines if l.startswith("#")]
                return {
                    "status": "found",
                    "file": memory_file,
                    "headings": headings[:5],
                    "line_count": len(lines),
                }
        
        return {"status": "not_found"}
    
    def _collect_ocnmps(self) -> Dict[str, Any]:
        """采集 OCNMPS 灰度状态"""
        stats_file = os.path.expanduser("~/.openclaw/workspace/ocnmps_stats.json")
        
        if os.path.exists(stats_file):
            with open(stats_file, "r") as f:
                stats = json.load(f)
                return {
                    "status": "active",
                    "total_requests": stats.get("total_requests", 0),
                    "bridge_used": stats.get("bridge_used", 0),
                    "avg_score": stats.get("avg_score", 0),
                    "fallback_triggered": stats.get("fallback_triggered", 0),
                }
        
        return {"status": "not_configured"}
    
    def _collect_trading(self) -> Dict[str, Any]:
        """采集交易系统状态"""
        trading_dir = os.path.expanduser("~/.openclaw/workspace/xiaolong_trading_system_4.2")
        
        if os.path.exists(trading_dir):
            # 检查是否有监控进程
            import subprocess
            result = subprocess.run(
                ["pgrep", "-f", "run_v52"],
                capture_output=True,
                text=True
            )
            
            return {
                "status": "monitoring" if result.returncode == 0 else "idle",
                "version": "V5.2",
                "phase": "Phase 1",
            }
        
        return {"status": "not_found"}
    
    def _collect_autoheal(self) -> Dict[str, Any]:
        """采集 AutoHeal 健康状态"""
        health_file = os.path.expanduser(
            f"~/.openclaw/workspace/autoheal/data/health_{datetime.now().strftime('%Y-%m-%d')}.json"
        )
        
        if os.path.exists(health_file):
            with open(health_file, "r") as f:
                data = json.load(f)
                return {
                    "status": "healthy" if data.get("critical_count", 0) == 0 else "warning",
                    "critical_count": data.get("critical_count", 0),
                    "warning_count": data.get("warning_count", 0),
                }
        
        return {"status": "no_data"}
    
    def generate_overview(self) -> str:
        """生成每日总览（含分析 + 决策建议）"""
        data = self.collect_all_sources()
        
        lines = [
            f"# 📊 每日总览 - {data['date']}",
            "",
            "---",
            "",
            "## 1. 今日日报",
            "",
        ]
        
        # Daily Digest
        digest = data["sources"]["digest"]
        analysis = None
        
        if digest.get("status") != "not_found":
            # 分析数据
            analysis = self.analyze_digest(digest)
            
            if digest.get("completed"):
                lines.append("**今日完成:**")
                for item in digest["completed"]:
                    project = item.get("project") or "其他"
                    content = item.get("content")
                    lines.append(f"- ✅ [{project}] {content}")
                lines.append("")
            
            if digest.get("planned"):
                lines.append("**明日计划:**")
                for item in digest["planned"]:
                    project = item.get("project") or "其他"
                    content = item.get("content")
                    lines.append(f"- 📋 [{project}] {content}")
                lines.append("")
            
            if digest.get("risks"):
                lines.append("**风险:**")
                for item in digest["risks"]:
                    level = item.get("risk_level") or "中"
                    content = item.get("content")
                    emoji = "🚨" if level == "高" else "⚠️" if level == "中" else "📝"
                    lines.append(f"- {emoji} [{level}] {content}")
                lines.append("")
        else:
            lines.append(f"⏳ {digest.get('message', '尚未填写')}")
            lines.append("")
        
        # ===== 新增：分析板块 =====
        if analysis:
            lines.append("---")
            lines.append("")
            lines.append("## 2. 项目分析")
            lines.append("")
            
            # 项目分布
            if analysis["projects"]:
                lines.append("| 项目 | 完成 | 计划 | 风险 |")
                lines.append("|------|------|------|------|")
                for project, stats in sorted(analysis["projects"].items()):
                    lines.append(f"| {project} | {stats['completed']} | {stats['planned']} | {stats['risks']} |")
                lines.append("")
            
            # 风险统计
            lines.append("**风险分布:**")
            for level, count in analysis["risks"].items():
                if count > 0:
                    emoji = "🚨" if level == "高" else "⚠️" if level == "中" else "📝"
                    lines.append(f"- {emoji} {level}风险: {count} 个")
            lines.append("")
            
            # 健康分数
            health = analysis["health_score"]
            health_emoji = "🟢" if health >= 80 else "🟡" if health >= 60 else "🔴"
            lines.append(f"**项目健康分:** {health_emoji} {health}/100")
            lines.append("")
            
            # 异常检测
            anomalies = self.detect_anomalies(analysis)
            if anomalies:
                lines.append("**⚠️ 异常信号:**")
                for a in anomalies:
                    lines.append(f"- {a}")
                lines.append("")
        
        # OCNMPS 灰度
        lines.append("---")
        lines.append("")
        lines.append("## 3. OCNMPS 灰度状态")
        lines.append("")
        
        ocnmps = data["sources"]["ocnmps"]
        if ocnmps.get("status") == "active":
            lines.append(f"- **灰度命中**: {ocnmps['bridge_used']}/{ocnmps['total_requests']}")
            lines.append(f"- **平均评分**: {ocnmps['avg_score']}/5")
            lines.append(f"- **回退次数**: {ocnmps['fallback_triggered']}")
        else:
            lines.append("- 状态: 未配置")
        
        # 交易系统
        lines.append("")
        lines.append("---")
        lines.append("")
        lines.append("## 4. 交易系统状态")
        lines.append("")
        
        trading = data["sources"]["trading"]
        if trading.get("version"):
            lines.append(f"- **版本**: {trading['version']}")
            lines.append(f"- **阶段**: {trading['phase']}")
            lines.append(f"- **状态**: {trading['status']}")
        else:
            lines.append("- 状态: 未检测到")
        
        # AutoHeal
        lines.append("")
        lines.append("---")
        lines.append("")
        lines.append("## 5. 系统健康")
        lines.append("")
        
        autoheal = data["sources"]["autoheal"]
        if autoheal.get("status") == "healthy":
            lines.append("- 🟢 系统健康")
        elif autoheal.get("status") == "warning":
            lines.append(f"- 🟡 有警告 (Critical: {autoheal.get('critical_count', 0)}, Warning: {autoheal.get('warning_count', 0)})")
        else:
            lines.append("- 暂无健康数据")
        
        # Memory
        lines.append("")
        lines.append("---")
        lines.append("")
        lines.append("## 6. Memory 日志")
        lines.append("")
        
        memory = data["sources"]["memory"]
        if memory.get("status") == "found":
            lines.append(f"- **文件**: {memory['file']}")
            lines.append(f"- **行数**: {memory['line_count']}")
        else:
            lines.append("- 今日暂无记录")
        
        # ===== 新增：决策建议 =====
        lines.append("")
        lines.append("---")
        lines.append("")
        lines.append("## 7. 🤖 决策建议")
        lines.append("")
        
        # 调用决策引擎
        try:
            import sys
            sys.path.insert(0, os.path.dirname(__file__))
            from decision_engine import DecisionEngine
            
            engine = DecisionEngine()
            suggestions = engine.generate_decision_suggestions()
            
            if suggestions.get("questions"):
                for i, q in enumerate(suggestions["questions"][:3], 1):  # 最多3个
                    severity_emoji = "🚨" if q["severity"] == "高" else "⚠️" if q["severity"] == "中" else "📝"
                    lines.append(f"### {i}. {severity_emoji} [{q['project'] or '整体'}]")
                    lines.append(f"{q['question']}")
                    if q.get("suggestion"):
                        lines.append(f"\n💡 {q['suggestion']}")
                    lines.append("")
            else:
                lines.append("✅ 今日无异常，系统运行正常。")
                lines.append("")
        except Exception as e:
            lines.append(f"⚠️ 决策引擎未就绪: {str(e)}")
            lines.append("")
        
        # 时间戳
        lines.append("---")
        lines.append("")
        lines.append(f"_生成时间: {datetime.now().isoformat()}_")
        
        content = "\n".join(lines)
        
        # 保存
        overview_file = os.path.join(self.overview_dir, f"overview-{data['date']}.md")
        with open(overview_file, "w") as f:
            f.write(content)
        
        return content


# ==================== CLI ====================

if __name__ == "__main__":
    overview = DailyOverview()
    content = overview.generate_overview()
    print(content)