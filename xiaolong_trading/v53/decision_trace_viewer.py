"""
Decision Trace Viewer - 决策追踪与统计面板

功能:
1. 单笔决策查询 - 完整决策路径
2. 批量统计 - 策略优化工具
3. 冲突分析 - 系统健康度

版本: V5.3
作者: 小龙
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from datetime import datetime
from collections import Counter
import json

from decision_hub_v3 import DecisionHubV3, SystemState, DecisionLog, Action


@dataclass
class DecisionStats:
    """决策统计结果"""
    total: int = 0
    executed: int = 0
    reduced: int = 0
    skipped: int = 0
    blocked: int = 0
    stopped: int = 0
    
    top_reasons: List[Dict[str, Any]] = field(default_factory=list)
    conflicts_detected: int = 0
    avg_latency_ms: float = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "total": self.total,
            "executed": self.executed,
            "reduced": self.reduced,
            "skipped": self.skipped,
            "blocked": self.blocked,
            "stopped": self.stopped,
            "top_reasons": self.top_reasons,
            "conflicts_detected": self.conflicts_detected,
            "avg_latency_ms": round(self.avg_latency_ms, 2)
        }


class DecisionTraceStore:
    """决策日志存储"""
    
    def __init__(self, max_size: int = 10000):
        self._logs: Dict[str, DecisionLog] = {}
        self._order: List[str] = []
        self._max_size = max_size
    
    def save(self, log: DecisionLog):
        """保存决策日志"""
        self._logs[log.decision_id] = log
        self._order.append(log.decision_id)
        
        # 限制大小
        if len(self._order) > self._max_size:
            old_id = self._order.pop(0)
            del self._logs[old_id]
    
    def get(self, decision_id: str) -> Optional[DecisionLog]:
        """查询单笔决策"""
        return self._logs.get(decision_id)
    
    def get_recent(self, n: int) -> List[DecisionLog]:
        """获取最近 n 笔决策"""
        recent_ids = self._order[-n:]
        return [self._logs[id] for id in recent_ids]
    
    def get_all(self) -> List[DecisionLog]:
        """获取所有决策"""
        return [self._logs[id] for id in self._order]


class DecisionTraceViewer:
    """
    决策追踪查看器
    
    API:
    - get_trace(decision_id) -> 单笔完整路径
    - get_stats(last=n) -> 批量统计
    - get_conflicts() -> 冲突分析
    """
    
    def __init__(self, hub: DecisionHubV3, store: Optional[DecisionTraceStore] = None):
        self.hub = hub
        self.store = store or DecisionTraceStore()
    
    def decide_and_log(self, state: SystemState) -> DecisionLog:
        """执行决策并记录"""
        log = self.hub.decide(state)
        self.store.save(log)
        return log
    
    def get_trace(self, decision_id: str) -> Optional[Dict[str, Any]]:
        """
        查询单笔决策的完整路径
        
        GET /decision_trace/{decision_id}
        """
        log = self.store.get(decision_id)
        if not log:
            return None
        
        return {
            "decision_id": log.decision_id,
            "timestamp": log.timestamp.isoformat(),
            "version": log.version,
            "trace": [
                {
                    "step": i + 1,
                    "check": step.rule,
                    "result": step.result,
                    "action": step.action
                }
                for i, step in enumerate(log.evaluation_path)
            ],
            "state": log.state_snapshot.to_dict(),
            "final": log.final,
            "conflicts": log.conflict_check,
            "latency_ms": log.audit.get("latency_ms", 0)
        }
    
    def get_stats(self, last: int = 50) -> DecisionStats:
        """
        批量统计 - 策略优化工具
        
        GET /decision_trace/stats?last=50
        """
        logs = self.store.get_recent(last)
        
        if not logs:
            return DecisionStats()
        
        stats = DecisionStats()
        stats.total = len(logs)
        
        # 动作统计
        action_counts = Counter()
        reason_counts = Counter()
        total_conflicts = 0
        total_latency = 0.0
        
        for log in logs:
            action = log.final.get("action", "UNKNOWN")
            action_counts[action] += 1
            
            reason = log.final.get("reason", "UNKNOWN")
            reason_counts[reason] += 1
            
            total_conflicts += log.conflict_check.get("found", 0)
            total_latency += log.audit.get("latency_ms", 0)
        
        # 填充统计
        stats.executed = action_counts.get("EXECUTE", 0)
        stats.reduced = action_counts.get("REDUCE", 0)
        stats.skipped = action_counts.get("SKIP", 0)
        stats.blocked = action_counts.get("BLOCK", 0)
        stats.stopped = action_counts.get("STOP", 0)
        
        # Top reasons
        stats.top_reasons = [
            {"reason": reason, "count": count}
            for reason, count in reason_counts.most_common(10)
        ]
        
        stats.conflicts_detected = total_conflicts
        stats.avg_latency_ms = total_latency / len(logs) if logs else 0
        
        return stats
    
    def get_conflicts(self) -> List[Dict[str, Any]]:
        """
        获取所有冲突记录
        
        GET /decision_trace/conflicts
        """
        logs = self.store.get_all()
        conflicts = []
        
        for log in logs:
            if log.conflict_check.get("found", 0) > 0:
                conflicts.append({
                    "decision_id": log.decision_id,
                    "timestamp": log.timestamp.isoformat(),
                    "state": log.state_snapshot.to_dict(),
                    "conflicts": log.conflict_check.get("conflicts", []),
                    "final_action": log.final.get("action")
                })
        
        return conflicts
    
    def get_summary(self) -> Dict[str, Any]:
        """系统摘要"""
        all_logs = self.store.get_all()
        
        if not all_logs:
            return {
                "status": "NO_DATA",
                "message": "暂无决策记录"
            }
        
        # 时间范围
        timestamps = [log.timestamp for log in all_logs]
        
        return {
            "status": "OK",
            "total_decisions": len(all_logs),
            "time_range": {
                "first": min(timestamps).isoformat(),
                "last": max(timestamps).isoformat()
            },
            "current_stats": self.get_stats(last=min(50, len(all_logs))).to_dict(),
            "conflict_summary": {
                "total_conflicts": len(self.get_conflicts()),
                "last_conflict": self.get_conflicts()[-1] if self.get_conflicts() else None
            }
        }
    
    def print_trace(self, decision_id: str):
        """打印决策路径（可视化）"""
        trace = self.get_trace(decision_id)
        if not trace:
            print(f"决策 {decision_id} 未找到")
            return
        
        print(f"\n{'='*60}")
        print(f"决策追踪: {decision_id[:8]}...")
        print(f"{'='*60}")
        print(f"时间: {trace['timestamp']}")
        print(f"版本: {trace['version']}")
        print(f"\n状态快照:")
        for k, v in trace['state'].items():
            print(f"  {k}: {v}")
        
        print(f"\n评估路径:")
        for step in trace['trace']:
            status = "✓" if step['result'] else "✗"
            action = f" -> {step['action']}" if step['action'] else ""
            print(f"  [{status}] {step['step']}. {step['check']}{action}")
        
        print(f"\n最终决策:")
        print(f"  动作: {trace['final']['action']}")
        print(f"  原因: {trace['final']['reason']}")
        print(f"  强度: {trace['final'].get('multiplier', 1.0)}")
        
        if trace['conflicts']['found'] > 0:
            print(f"\n⚠️  检测到 {trace['conflicts']['found']} 个冲突")
            for c in trace['conflicts']['conflicts']:
                print(f"    - {c['type']} ({c['severity']})")
        
        print(f"\n延迟: {trace['latency_ms']:.2f}ms")
        print(f"{'='*60}\n")
    
    def print_stats(self, last: int = 50):
        """打印统计面板"""
        stats = self.get_stats(last)
        
        print(f"\n{'='*60}")
        print(f"决策统计面板 (最近 {last} 笔)")
        print(f"{'='*60}")
        
        print(f"\n动作分布:")
        print(f"  EXECUTE: {stats.executed} ({stats.executed/stats.total*100:.1f}%)")
        print(f"  REDUCE:  {stats.reduced} ({stats.reduced/stats.total*100:.1f}%)")
        print(f"  SKIP:    {stats.skipped} ({stats.skipped/stats.total*100:.1f}%)")
        print(f"  BLOCK:   {stats.blocked} ({stats.blocked/stats.total*100:.1f}%)")
        print(f"  STOP:    {stats.stopped} ({stats.stopped/stats.total*100:.1f}%)")
        
        print(f"\nTop 原因:")
        for i, r in enumerate(stats.top_reasons[:5], 1):
            print(f"  {i}. {r['reason']}: {r['count']} 次")
        
        print(f"\n系统健康:")
        print(f"  冲突检测: {stats.conflicts_detected} 个")
        print(f"  平均延迟: {stats.avg_latency_ms:.2f}ms")
        
        print(f"{'='*60}\n")


# ============ 演示 ============

if __name__ == "__main__":
    # 初始化
    hub = DecisionHubV3()
    viewer = DecisionTraceViewer(hub)
    
    print("="*60)
    print("Decision Trace Viewer 演示")
    print("="*60)
    
    # 模拟 20 笔决策
    import random
    
    test_states = [
        # 正常
        SystemState("OK", "NORMAL", "STRONG", "NORMAL", "FRESH"),
        # 弱信号
        SystemState("OK", "NORMAL", "WEAK", "NORMAL", "FRESH"),
        # 资金减少
        SystemState("OK", "NORMAL", "STRONG", "REDUCED", "FRESH"),
        # 组合降级
        SystemState("OK", "NORMAL", "WEAK", "REDUCED", "FRESH"),
        # 风险警告
        SystemState("OK", "WARNING", "STRONG", "NORMAL", "FRESH"),
        # 数据过期
        SystemState("OK", "NORMAL", "STRONG", "NORMAL", "STALE"),
        # 完整性失败
        SystemState("FAIL", "NORMAL", "STRONG", "NORMAL", "FRESH"),
        # 风险熔断
        SystemState("OK", "STOP_REQUIRED", "STRONG", "NORMAL", "FRESH"),
        # Edge 死亡
        SystemState("OK", "NORMAL", "DEAD", "NORMAL", "FRESH"),
        # 资金阻断
        SystemState("OK", "NORMAL", "STRONG", "BLOCKED", "FRESH"),
    ]
    
    print("\n生成 20 笔模拟决策...")
    for i in range(20):
        state = random.choice(test_states)
        log = viewer.decide_and_log(state)
    
    # 显示统计
    viewer.print_stats(last=20)
    
    # 显示最近一笔的详细追踪
    recent = viewer.store.get_recent(1)[0]
    viewer.print_trace(recent.decision_id)
    
    # 显示系统摘要
    print("\n系统摘要:")
    summary = viewer.get_summary()
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    
    # 显示冲突分析
    conflicts = viewer.get_conflicts()
    if conflicts:
        print(f"\n⚠️  发现 {len(conflicts)} 个冲突:")
        for c in conflicts:
            print(f"  - {c['decision_id'][:8]}: {c['conflicts']}")
    else:
        print("\n✓ 无冲突")
    
    print("\n" + "="*60)
    print("演示完成")
    print("="*60)