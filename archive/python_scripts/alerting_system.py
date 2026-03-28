#!/usr/bin/env python3
"""
OpenClaw 自动告警系统
Automatic Alerting System
"""

import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Callable
from dataclasses import dataclass
from enum import Enum
import threading


class AlertLevel(Enum):
    """告警级别"""
    WARNING = "warning"
    CRITICAL = "critical"


class AlertStatus(Enum):
    """告警状态"""
    ACTIVE = "active"
    RESOLVED = "resolved"
    ACKNOWLEDGED = "acknowledged"


@dataclass
class Alert:
    """告警记录"""
    alert_id: str
    rule_id: str
    rule_name: str
    level: AlertLevel
    message: str
    details: Dict
    timestamp: str
    status: AlertStatus = AlertStatus.ACTIVE
    resolved_at: Optional[str] = None


class AlertingSystem:
    """告警系统"""
    
    def __init__(self, logger, notifier=None):
        self.logger = logger
        self.notifier = notifier or self._default_notifier
        self.active_alerts: Dict[str, Alert] = {}
        self.alert_history: List[Alert] = []
        self.last_alert_time: Dict[str, str] = {}
        self.running = False
        self.monitor_thread = None
        
        # 告警规则配置
        self.rules = self._load_rules()
    
    def _load_rules(self) -> Dict:
        """加载告警规则"""
        return {
            "ALERT-001": {
                "name": "总成功率低于阈值",
                "condition": lambda stats: stats.get("success_rate", 1.0) < 0.95,
                "level": AlertLevel.CRITICAL,
                "dedup_minutes": 30,
                "message": "成功率低于 95%",
                "suggestion": "检查 provider 状态，查看失败分布"
            },
            "ALERT-002": {
                "name": "Timeout 率突然升高",
                "condition": lambda stats: stats.get("timeout_rate", 0) > 0.10,
                "level": AlertLevel.WARNING,
                "dedup_minutes": 20,
                "message": "Timeout 率超过 10%",
                "suggestion": "检查网络状况，观察是否持续"
            },
            "ALERT-003": {
                "name": "Empty Response 连续出现",
                "condition": lambda stats: stats.get("empty_count", 0) >= 3,
                "level": AlertLevel.WARNING,
                "dedup_minutes": 15,
                "message": "Empty response 连续出现 3 次",
                "suggestion": "检查对应模型 provider 状态"
            },
            "ALERT-004": {
                "name": "Fallback 触发率异常升高",
                "condition": lambda stats: stats.get("fallback_rate", 0) > 0.20,
                "level": AlertLevel.WARNING,
                "dedup_minutes": 30,
                "message": "Fallback 率超过 20%",
                "suggestion": "检查主模型稳定性，考虑降级策略"
            },
            "ALERT-005": {
                "name": "MAIN 汇总耗时明显上升",
                "condition": lambda stats: stats.get("main_avg_duration", 0) > 60000,
                "level": AlertLevel.WARNING,
                "dedup_minutes": 20,
                "message": "MAIN 汇总平均耗时超过 60s",
                "suggestion": "检查限长策略是否生效，输入是否过大"
            },
            "ALERT-006": {
                "name": "混合链路连续失败",
                "condition": lambda stats: stats.get("chain_consecutive_failures", 0) >= 2,
                "level": AlertLevel.CRITICAL,
                "dedup_minutes": 30,
                "message": "混合链路连续失败 2 次",
                "suggestion": "检查链路各步骤，定位失败节点"
            },
            "ALERT-007": {
                "name": "GROK-CODE P95 明显恶化",
                "condition": lambda stats: stats.get("grok_code_p95", 0) > 40000,
                "level": AlertLevel.WARNING,
                "dedup_minutes": 60,
                "message": "GROK-CODE P95 超过 40s",
                "suggestion": "观察趋势，连续 3 天则考虑调 timeout"
            },
            "ALERT-008": {
                "name": "Provider Error 短时间内激增",
                "condition": lambda stats: stats.get("provider_error_count", 0) > 5,
                "level": AlertLevel.CRITICAL,
                "dedup_minutes": 30,
                "message": "Provider error 超过 5 次/小时",
                "suggestion": "立即检查 provider 服务状态"
            }
        }
    
    def _default_notifier(self, alert: Alert):
        """默认通知方式（打印到日志）"""
        emoji = "🔴" if alert.level == AlertLevel.CRITICAL else "🟡"
        print(f"\n{emoji} OpenClaw 告警 [{alert.level.value.upper()}]")
        print(f"规则: {alert.rule_name}")
        print(f"时间: {alert.timestamp}")
        print(f"详情: {alert.message}")
        print(f"建议: {alert.details.get('suggestion', 'N/A')}")
        print(f"当前状态: {'需立即处理' if alert.level == AlertLevel.CRITICAL else '需关注，请观察趋势'}")
    
    def _should_dedup(self, rule_id: str, dedup_minutes: int) -> bool:
        """检查是否需要去重"""
        if rule_id not in self.last_alert_time:
            return False
        
        last_time = datetime.fromisoformat(self.last_alert_time[rule_id])
        now = datetime.now()
        
        return (now - last_time) < timedelta(minutes=dedup_minutes)
    
    def check_and_alert(self, stats: Dict):
        """检查并触发告警"""
        for rule_id, rule in self.rules.items():
            try:
                # 检查条件
                if rule["condition"](stats):
                    # 检查去重
                    if self._should_dedup(rule_id, rule["dedup_minutes"]):
                        continue
                    
                    # 创建告警
                    alert = Alert(
                        alert_id=f"alert_{datetime.now().strftime('%Y%m%d%H%M%S')}_{rule_id}",
                        rule_id=rule_id,
                        rule_name=rule["name"],
                        level=rule["level"],
                        message=rule["message"],
                        details={
                            "suggestion": rule["suggestion"],
                            "stats": stats
                        },
                        timestamp=datetime.now().isoformat()
                    )
                    
                    # 记录告警
                    self.active_alerts[alert.alert_id] = alert
                    self.alert_history.append(alert)
                    self.last_alert_time[rule_id] = alert.timestamp
                    
                    # 发送通知
                    self.notifier(alert)
                    
                    # 记录到日志
                    self._log_alert(alert)
                    
            except Exception as e:
                print(f"检查规则 {rule_id} 时出错: {e}")
    
    def _log_alert(self, alert: Alert):
        """记录告警到日志"""
        log_entry = {
            "type": "alert",
            "alert_id": alert.alert_id,
            "rule_id": alert.rule_id,
            "level": alert.level.value,
            "message": alert.message,
            "timestamp": alert.timestamp
        }
        
        # 写入告警日志文件
        with open("/Users/colin/.openclaw/workspace/logs/alerts.log", "a") as f:
            f.write(json.dumps(log_entry) + "\n")
    
    def resolve_alert(self, alert_id: str):
        """解决告警"""
        if alert_id in self.active_alerts:
            alert = self.active_alerts[alert_id]
            alert.status = AlertStatus.RESOLVED
            alert.resolved_at = datetime.now().isoformat()
            del self.active_alerts[alert_id]
            
            print(f"✅ 告警已解决: {alert.rule_name}")
    
    def get_active_alerts(self) -> List[Alert]:
        """获取活跃告警"""
        return list(self.active_alerts.values())
    
    def get_alert_summary(self) -> Dict:
        """获取告警摘要"""
        warning_count = sum(1 for a in self.active_alerts.values() if a.level == AlertLevel.WARNING)
        critical_count = sum(1 for a in self.active_alerts.values() if a.level == AlertLevel.CRITICAL)
        
        return {
            "total_active": len(self.active_alerts),
            "warning": warning_count,
            "critical": critical_count,
            "total_history": len(self.alert_history)
        }
    
    def start_monitoring(self, interval_seconds: int = 60):
        """启动监控线程"""
        self.running = True
        
        def monitor_loop():
            while self.running:
                try:
                    # 获取当前统计
                    stats = self.logger.get_stats()
                    model_stats = self.logger.get_model_stats()
                    
                    # 合并统计信息
                    combined_stats = {
                        **stats,
                        "grok_code_p95": model_stats.get("xai/grok-code-fast-1", {}).get("p95_duration_ms", 0),
                        "main_avg_duration": model_stats.get("bailian/kimi-k2.5", {}).get("avg_duration_ms", 0)
                    }
                    
                    # 检查告警
                    self.check_and_alert(combined_stats)
                    
                except Exception as e:
                    print(f"监控循环出错: {e}")
                
                time.sleep(interval_seconds)
        
        self.monitor_thread = threading.Thread(target=monitor_loop, daemon=True)
        self.monitor_thread.start()
        print(f"✅ 告警监控已启动，检查间隔: {interval_seconds}s")
    
    def stop_monitoring(self):
        """停止监控"""
        self.running = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=5)
        print("✅ 告警监控已停止")


# Telegram 通知器
class TelegramNotifier:
    """Telegram 告警通知器"""
    
    def __init__(self, bot_token: str, chat_id: str):
        self.bot_token = bot_token
        self.chat_id = chat_id
    
    def send_alert(self, alert: Alert):
        """发送告警到 Telegram"""
        emoji = "🔴" if alert.level == AlertLevel.CRITICAL else "🟡"
        
        message = f"""{emoji} OpenClaw 告警 [{alert.level.value.upper()}]

规则: {alert.rule_name}
时间: {alert.timestamp}
详情: {alert.message}
建议: {alert.details.get('suggestion', 'N/A')}

当前状态: {'需立即处理' if alert.level == AlertLevel.CRITICAL else '需关注，请观察趋势'}
"""
        
        # 这里应该调用 Telegram Bot API
        # 简化实现：打印到控制台
        print(f"[Telegram 通知] 发送到 {self.chat_id}")
        print(message)
        
        # 实际实现：
        # import requests
        # url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
        # requests.post(url, json={"chat_id": self.chat_id, "text": message})


if __name__ == "__main__":
    # 测试告警系统
    from observability_logger import logger
    
    # 创建告警系统
    alerting = AlertingSystem(logger)
    
    # 模拟统计数据
    test_stats = {
        "success_rate": 0.93,  # 触发 ALERT-001
        "timeout_rate": 0.12,  # 触发 ALERT-002
        "grok_code_p95": 45000  # 触发 ALERT-007
    }
    
    print("测试告警系统...")
    alerting.check_and_alert(test_stats)
    
    # 查看活跃告警
    summary = alerting.get_alert_summary()
    print(f"\n活跃告警: {summary}")