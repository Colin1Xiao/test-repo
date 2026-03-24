#!/usr/bin/env python3
"""
OpenClaw 多窗口会话管理器
Multi-Window Session Manager

Phase 1: 会话隔离
"""

import json
import uuid
import threading
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict
from enum import Enum
import os


class ChannelType(Enum):
    """通道类型"""
    WEBCHAT = "webchat"
    TELEGRAM = "telegram"
    CLI = "cli"
    SUBAGENT = "subagent"


class WindowType(Enum):
    """窗口类型"""
    INTERACTIVE = "interactive"
    ANALYSIS = "analysis"
    DEBUG = "debug"
    BACKGROUND = "background"


class RoutingProfile(Enum):
    """路由档位"""
    LIGHT = "light"
    STANDARD = "standard"
    HEAVY = "heavy"


class PriorityLevel(Enum):
    """优先级"""
    P0 = "P0"
    P1 = "P1"
    P2 = "P2"
    P3 = "P3"


class SessionStatus(Enum):
    """会话状态"""
    IDLE = "idle"
    RUNNING = "running"
    DEGRADED = "degraded"
    FAILED = "failed"
    BLOCKED = "blocked"


@dataclass
class ResourceBudget:
    """资源预算"""
    max_mixed_chains: int
    max_subagents: int
    max_retries: int
    max_context_size: int


@dataclass
class SessionContext:
    """会话上下文"""
    session_id: str
    channel_type: str
    window_type: str
    parent_agent: str
    routing_profile: str
    priority_level: str
    status: str
    created_at: str
    last_active_at: str
    active_task_count: int = 0
    active_chain_count: int = 0
    resource_budget: Dict = None
    last_route_decision: Dict = None
    last_error: Optional[str] = None
    history: List[Dict] = None
    
    def __post_init__(self):
        if self.resource_budget is None:
            self.resource_budget = self._get_default_budget()
        if self.history is None:
            self.history = []
    
    def _get_default_budget(self) -> Dict:
        """获取默认资源预算"""
        budgets = {
            RoutingProfile.LIGHT.value: {
                "max_mixed_chains": 0,
                "max_subagents": 0,
                "max_retries": 1,
                "max_context_size": 4000
            },
            RoutingProfile.STANDARD.value: {
                "max_mixed_chains": 1,
                "max_subagents": 2,
                "max_retries": 2,
                "max_context_size": 8000
            },
            RoutingProfile.HEAVY.value: {
                "max_mixed_chains": 1,
                "max_subagents": 3,
                "max_retries": 2,
                "max_context_size": 16000
            }
        }
        return budgets.get(self.routing_profile, budgets[RoutingProfile.STANDARD.value])
    
    def to_dict(self) -> Dict:
        return asdict(self)


class MultiWindowSessionManager:
    """多窗口会话管理器"""
    
    def __init__(self, storage_dir: str = "/Users/colin/.openclaw/workspace/sessions"):
        self.storage_dir = storage_dir
        self.active_sessions: Dict[str, SessionContext] = {}
        self.session_locks: Dict[str, threading.Lock] = {}
        self.global_lock = threading.Lock()
        
        # 确保存储目录存在
        os.makedirs(storage_dir, exist_ok=True)
        
        # 会话统计
        self.stats = {
            "total_created": 0,
            "total_active": 0,
            "total_closed": 0
        }
    
    def generate_session_id(self, channel_type: str) -> str:
        """生成会话 ID"""
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        random_suffix = uuid.uuid4().hex[:8]
        return f"{channel_type}_{timestamp}_{random_suffix}"
    
    def create_session(self, 
                      channel_type: str,
                      window_type: str = WindowType.INTERACTIVE.value,
                      routing_profile: str = RoutingProfile.STANDARD.value,
                      priority_level: str = PriorityLevel.P1.value) -> SessionContext:
        """
        创建新会话
        
        输入：
        - channel_type: 通道类型
        - window_type: 窗口类型
        - routing_profile: 路由档位
        - priority_level: 优先级
        
        输出：
        - SessionContext: 会话上下文
        """
        session_id = self.generate_session_id(channel_type)
        
        now = datetime.now().isoformat()
        
        session = SessionContext(
            session_id=session_id,
            channel_type=channel_type,
            window_type=window_type,
            parent_agent="main",
            routing_profile=routing_profile,
            priority_level=priority_level,
            status=SessionStatus.IDLE.value,
            created_at=now,
            last_active_at=now
        )
        
        with self.global_lock:
            self.active_sessions[session_id] = session
            self.session_locks[session_id] = threading.Lock()
            self.stats["total_created"] += 1
            self.stats["total_active"] += 1
        
        # 持久化
        self._save_session(session)
        
        print(f"✅ 会话已创建: {session_id} [{channel_type}] [{routing_profile}]")
        
        return session
    
    def get_session(self, session_id: str) -> Optional[SessionContext]:
        """获取会话"""
        return self.active_sessions.get(session_id)
    
    def update_session(self, session_id: str, updates: Dict):
        """更新会话"""
        session = self.active_sessions.get(session_id)
        if not session:
            return False
        
        lock = self.session_locks.get(session_id)
        if not lock:
            return False
        
        with lock:
            for key, value in updates.items():
                if hasattr(session, key):
                    setattr(session, key, value)
            
            session.last_active_at = datetime.now().isoformat()
            
            # 持久化
            self._save_session(session)
        
        return True
    
    def activate_session(self, session_id: str) -> bool:
        """激活会话（开始任务）"""
        return self.update_session(session_id, {
            "status": SessionStatus.RUNNING.value,
            "active_task_count": 1
        })
    
    def complete_session(self, session_id: str, success: bool = True):
        """完成任务"""
        status = SessionStatus.IDLE.value if success else SessionStatus.FAILED.value
        return self.update_session(session_id, {
            "status": status,
            "active_task_count": 0,
            "active_chain_count": 0
        })
    
    def degrade_session(self, session_id: str, reason: str):
        """降级会话"""
        self.update_session(session_id, {
            "status": SessionStatus.DEGRADED.value,
            "last_error": reason
        })
    
    def block_session(self, session_id: str, reason: str):
        """阻塞会话"""
        self.update_session(session_id, {
            "status": SessionStatus.BLOCKED.value,
            "last_error": reason
        })
    
    def add_message(self, session_id: str, role: str, content: str):
        """添加消息到历史"""
        session = self.active_sessions.get(session_id)
        if not session:
            return False
        
        message = {
            "timestamp": datetime.now().isoformat(),
            "role": role,
            "content": content[:1000]  # 截断存储
        }
        
        lock = self.session_locks.get(session_id)
        if lock:
            with lock:
                session.history.append(message)
                # 限制历史长度
                if len(session.history) > 100:
                    session.history = session.history[-100:]
                self._save_session(session)
        
        return True
    
    def close_session(self, session_id: str):
        """关闭会话"""
        session = self.active_sessions.get(session_id)
        if not session:
            return False
        
        # 归档会话
        self._archive_session(session)
        
        with self.global_lock:
            if session_id in self.active_sessions:
                del self.active_sessions[session_id]
            if session_id in self.session_locks:
                del self.session_locks[session_id]
            self.stats["total_active"] -= 1
            self.stats["total_closed"] += 1
        
        print(f"✅ 会话已关闭: {session_id}")
        return True
    
    def _save_session(self, session: SessionContext):
        """保存会话到文件"""
        filepath = os.path.join(self.storage_dir, f"{session.session_id}.json")
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(session.to_dict(), f, indent=2, ensure_ascii=False)
    
    def _archive_session(self, session: SessionContext):
        """归档会话"""
        archive_dir = os.path.join(self.storage_dir, "archive")
        os.makedirs(archive_dir, exist_ok=True)
        
        filepath = os.path.join(archive_dir, f"{session.session_id}_{datetime.now().strftime('%Y%m%d')}.json")
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(session.to_dict(), f, indent=2, ensure_ascii=False)
    
    def get_active_sessions(self) -> List[SessionContext]:
        """获取所有活跃会话"""
        return list(self.active_sessions.values())
    
    def get_session_stats(self) -> Dict:
        """获取会话统计"""
        return {
            **self.stats,
            "current_active": len(self.active_sessions),
            "by_channel": self._count_by_channel(),
            "by_status": self._count_by_status()
        }
    
    def _count_by_channel(self) -> Dict:
        """按通道统计"""
        counts = {}
        for session in self.active_sessions.values():
            channel = session.channel_type
            counts[channel] = counts.get(channel, 0) + 1
        return counts
    
    def _count_by_status(self) -> Dict:
        """按状态统计"""
        counts = {}
        for session in self.active_sessions.values():
            status = session.status
            counts[status] = counts.get(status, 0) + 1
        return counts
    
    def cleanup_expired_sessions(self, max_idle_minutes: int = 30):
        """清理过期会话"""
        now = datetime.now()
        expired = []
        
        for session_id, session in self.active_sessions.items():
            last_active = datetime.fromisoformat(session.last_active_at)
            if (now - last_active) > timedelta(minutes=max_idle_minutes):
                if session.status == SessionStatus.IDLE.value:
                    expired.append(session_id)
        
        for session_id in expired:
            self.close_session(session_id)
        
        if expired:
            print(f"🧹 清理 {len(expired)} 个过期会话")
        
        return len(expired)


if __name__ == "__main__":
    # 测试多窗口会话管理器
    print("测试多窗口会话管理器...")
    
    manager = MultiWindowSessionManager()
    
    # 创建测试会话
    sessions = [
        manager.create_session("webchat", "interactive", "standard", "P1"),
        manager.create_session("telegram", "interactive", "light", "P1"),
        manager.create_session("cli", "analysis", "heavy", "P2"),
    ]
    
    print(f"\n活跃会话数: {len(manager.get_active_sessions())}")
    
    # 激活会话
    for session in sessions:
        manager.activate_session(session.session_id)
    
    # 添加消息
    for session in sessions:
        manager.add_message(session.session_id, "user", "测试消息")
        manager.add_message(session.session_id, "assistant", "回复消息")
    
    # 查看统计
    stats = manager.get_session_stats()
    print(f"\n会话统计: {json.dumps(stats, indent=2)}")
    
    # 完成会话
    for session in sessions:
        manager.complete_session(session.session_id)
    
    # 关闭会话
    for session in sessions:
        manager.close_session(session.session_id)
    
    print(f"\n最终活跃会话数: {len(manager.get_active_sessions())}")