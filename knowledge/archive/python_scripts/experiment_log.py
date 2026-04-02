#!/usr/bin/env python3
"""
实验日志记录器
每天记录: 系统有效点、问题点、行为改变
"""

import os
import json
from datetime import datetime
from typing import Dict, Any, Optional

EXPERIMENT_LOG = os.path.expanduser("~/.openclaw/workspace/reports/experiment_log.json")


class ExperimentLogger:
    """实验日志记录器"""
    
    def __init__(self):
        self.log_file = EXPERIMENT_LOG
        self._ensure_file()
    
    def _ensure_file(self):
        """确保日志文件存在"""
        if not os.path.exists(self.log_file):
            with open(self.log_file, "w") as f:
                json.dump({"logs": []}, f, ensure_ascii=False, indent=2)
    
    def log(
        self,
        day: int,
        effective_points: str = "",
        problem_points: str = "",
        behavior_changed: bool = None,
        notes: str = "",
    ) -> Dict[str, Any]:
        """
        记录每日实验日志
        
        Args:
            day: 第几天 (1-7)
            effective_points: 系统有效点
            problem_points: 系统问题点
            behavior_changed: 是否影响行为
            notes: 备注
        
        Returns:
            dict: 日志条目
        """
        entry = {
            "day": day,
            "date": datetime.now().strftime("%Y-%m-%d"),
            "timestamp": datetime.now().isoformat(),
            "effective_points": effective_points,
            "problem_points": problem_points,
            "behavior_changed": behavior_changed,
            "notes": notes,
        }
        
        # 读取现有日志
        with open(self.log_file, "r") as f:
            data = json.load(f)
        
        # 检查是否已有该天的记录
        existing = [i for i, log in enumerate(data["logs"]) if log.get("day") == day]
        if existing:
            data["logs"][existing[0]] = entry  # 更新
        else:
            data["logs"].append(entry)  # 新增
        
        # 按天排序
        data["logs"].sort(key=lambda x: x.get("day", 0))
        
        # 保存
        with open(self.log_file, "w") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        return entry
    
    def get_log(self, day: int = None) -> Optional[Dict]:
        """获取指定天的日志"""
        with open(self.log_file, "r") as f:
            data = json.load(f)
        
        if day is None:
            return data
        
        for log in data["logs"]:
            if log.get("day") == day:
                return log
        
        return None
    
    def format_summary(self) -> str:
        """格式化日志摘要"""
        data = self.get_log()
        
        if not data["logs"]:
            return "⏳ 尚无实验日志"
        
        lines = [
            "# 📋 7天实验日志",
            "",
            "| 天数 | 日期 | 有效点 | 问题点 | 行为改变 |",
            "|------|------|--------|--------|----------|",
        ]
        
        for log in data["logs"]:
            effective = log.get("effective_points", "")[:20] or "-"
            problem = log.get("problem_points", "")[:20] or "-"
            changed = "✅" if log.get("behavior_changed") else "❌" if log.get("behavior_changed") is False else "⏳"
            
            lines.append(
                f"| Day {log['day']} | {log['date']} | {effective} | {problem} | {changed} |"
            )
        
        lines.append("")
        lines.append("---")
        lines.append("")
        
        # 统计
        total = len(data["logs"])
        changed_count = sum(1 for log in data["logs"] if log.get("behavior_changed"))
        
        lines.append(f"**记录天数**: {total}/7")
        lines.append(f"**行为改变**: {changed_count}/{total} 天")
        
        return "\n".join(lines)


# ==================== CLI ====================

if __name__ == "__main__":
    import sys
    
    logger = ExperimentLogger()
    
    if len(sys.argv) < 2:
        print("""
实验日志记录器

用法:
  python3 experiment_log.py log <天数> "<有效点>" "<问题点>" <是否改变>
  python3 experiment_log.py show [天数]
  python3 experiment_log.py summary

示例:
  python3 experiment_log.py log 1 "追问让人补了计划" "风险误判" 是
  python3 experiment_log.py show
  python3 experiment_log.py summary
""")
        sys.exit(0)
    
    cmd = sys.argv[1]
    
    if cmd == "log" and len(sys.argv) >= 6:
        day = int(sys.argv[2])
        effective = sys.argv[3]
        problem = sys.argv[4]
        changed = sys.argv[5].lower() in ["是", "yes", "true", "1"]
        notes = sys.argv[6] if len(sys.argv) > 6 else ""
        
        entry = logger.log(day, effective, problem, changed, notes)
        print(f"✅ Day {day} 日志已记录")
        
    elif cmd == "show":
        day = int(sys.argv[2]) if len(sys.argv) > 2 else None
        log = logger.get_log(day)
        
        if log:
            if isinstance(log, dict):
                print(f"Day {log['day']} - {log['date']}")
                print(f"有效点: {log.get('effective_points', '-')}")
                print(f"问题点: {log.get('problem_points', '-')}")
                print(f"行为改变: {'是' if log.get('behavior_changed') else '否'}")
            else:
                for l in log["logs"]:
                    print(f"Day {l['day']}: {l.get('effective_points', '-')[:30]}")
        else:
            print("❌ 未找到日志")
    
    elif cmd == "summary":
        print(logger.format_summary())
    
    else:
        print("❌ 命令无效")