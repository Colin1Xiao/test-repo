# OpenClaw 多窗口监控指标

**版本：** v1.0  
**适用：** Phase 5 - 监控与告警升级  
**时间：** 2026-03-13

---

## 一、新增监控维度

### 1.1 窗口级指标

| 指标 | 说明 | 采集频率 |
|------|------|----------|
| window_request_count | 每窗口请求数 | 实时 |
| window_success_rate | 每窗口成功率 | 1分钟 |
| window_avg_duration | 每窗口平均耗时 | 1分钟 |
| window_mixed_chain_rate | 每窗口混合链路触发率 | 5分钟 |
| window_degradation_count | 每窗口降级次数 | 实时 |
| window_fallback_count | 每窗口 fallback 次数 | 实时 |
| window_queue_wait_time | 每窗口平均等待时间 | 1分钟 |

### 1.2 全局级指标

| 指标 | 说明 | 采集频率 |
|------|------|----------|
| active_windows | 活跃窗口数 | 实时 |
| running_windows | 运行中窗口数 | 实时 |
| blocked_windows | 被阻塞窗口数 | 实时 |
| degraded_windows | 降级窗口数 | 实时 |
| mixed_chain_distribution | 各档位窗口分布 | 5分钟 |
| priority_queue_length | 各优先级队列长度 | 实时 |

### 1.3 资源级指标

| 指标 | 说明 | 采集频率 |
|------|------|----------|
| global_mixed_chain_usage | 全局混合链路使用率 | 实时 |
| global_subagent_usage | 全局子代理使用率 | 实时 |
| model_concurrency_usage | 各模型并发使用率 | 实时 |
| resource_saturation_rate | 资源饱和度 | 1分钟 |

---

## 二、新增告警规则

### 2.1 窗口级告警

| 告警 ID | 告警名称 | 触发条件 | 级别 |
|---------|----------|----------|------|
| MW-001 | 单窗口连续失败 | 某窗口连续失败 3 次 | WARNING |
| MW-002 | 单窗口预算耗尽 | 某窗口预算异常耗尽 | WARNING |
| MW-003 | 单窗口持续占用混合链路 | 某窗口占用混合链路 > 5 分钟 | WARNING |
| MW-004 | 单窗口等待超时 | 某窗口等待时间 > 阈值 | WARNING |

### 2.2 全局级告警

| 告警 ID | 告警名称 | 触发条件 | 级别 |
|---------|----------|----------|------|
| MW-005 | 多窗口同时降级 | > 30% 窗口降级 | CRITICAL |
| MW-006 | MAIN 长时间排队 | MAIN 队列 > 5 | WARNING |
| MW-007 | 全局队列堆积 | 总队列长度 > 20 | WARNING |
| MW-008 | 子代理池接近耗尽 | 子代理使用率 > 80% | WARNING |
| MW-009 | 资源饱和度告警 | 资源饱和度 > 90% | CRITICAL |

---

## 三、监控面板升级

### 3.1 多窗口监控面板

```python
class MultiWindowMetricsDashboard:
    """多窗口监控面板"""
    
    def generate_multi_window_report(self) -> Dict:
        return {
            "timestamp": datetime.now().isoformat(),
            "global_summary": {
                "active_windows": self.get_active_windows(),
                "running_windows": self.get_running_windows(),
                "blocked_windows": self.get_blocked_windows(),
                "degraded_windows": self.get_degraded_windows()
            },
            "window_breakdown": self.get_window_breakdown(),
            "resource_usage": self.get_resource_usage(),
            "queue_status": self.get_queue_status(),
            "top_issues": self.get_top_issues()
        }
```

### 3.2 关键指标可视化

- 活跃窗口数趋势图
- 各档位窗口分布饼图
- 资源使用率热力图
- 队列长度时序图
- 窗口成功率排行榜

---

## 四、日志升级

### 4.1 新增日志字段

```json
{
  "session_id": "web_202603130911_abc123",
  "channel_type": "webchat",
  "window_type": "interactive",
  "routing_profile": "standard",
  "priority_level": "P1",
  "resource_budget_used": 0.5,
  "active_chain_count": 1,
  "degraded_mode": false,
  "fallback_triggered": false,
  "queue_wait_time_ms": 1500,
  "global_resource_check": "passed"
}
```

### 4.2 新增日志类型

- `window_created`: 窗口创建
- `window_routed`: 路由决策
- `window_degraded`: 降级事件
- `window_blocked`: 阻塞事件
- `resource_acquired`: 资源占用
- `resource_released`: 资源释放

---

## 五、实施检查清单

- [ ] 窗口级指标采集
- [ ] 全局级指标采集
- [ ] 资源级指标采集
- [ ] 新增告警规则配置
- [ ] 监控面板升级
- [ ] 日志格式升级
- [ ] 告警通知集成
- [ ] 测试验证

---

## 六、版本历史

| 版本 | 时间 | 变更 |
|------|------|------|
| v1.0 | 2026-03-13 | 初始版本，Phase 5 监控与告警升级 |