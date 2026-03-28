# OpenClaw 会话 Schema 定义

**版本：** v1.0  
**适用：** Phase 1 - 会话隔离  
**时间：** 2026-03-13

---

## 一、会话身份模型

### 核心字段

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| session_id | string | 窗口唯一标识 | `web_202603130911_abc123` |
| channel_type | enum | 消息来源类型 | `telegram`, `webchat`, `cli`, `subagent` |
| window_type | enum | 窗口功能类型 | `interactive`, `analysis`, `debug`, `background` |
| parent_agent | string | 所属主代理 | `main` |
| routing_profile | enum | 路由档位 | `light`, `standard`, `heavy` |
| priority_level | enum | 调度优先级 | `P0`, `P1`, `P2`, `P3` |
| status | enum | 当前状态 | `idle`, `running`, `degraded`, `failed`, `blocked` |
| created_at | datetime | 创建时间 | `2026-03-13T09:11:00+08:00` |
| last_active_at | datetime | 最后活跃时间 | `2026-03-13T09:15:00+08:00` |

---

## 二、会话状态机

```
                    ┌──────────┐
                    │   idle   │
                    └────┬─────┘
                         │
                         │ 收到请求
                         ▼
                    ┌──────────┐
                    │ running  │
                    └────┬─────┘
                         │
           ┌─────────────┼─────────────┐
           │             │             │
           ▼             ▼             ▼
      ┌────────┐   ┌──────────┐  ┌──────────┐
      │success │   │ degraded │  │  failed  │
      └────────┘   └────┬─────┘  └──────────┘
                        │
                        │ 恢复
                        ▼
                   ┌──────────┐
                   │   idle   │
                   └──────────┘
```

### 状态说明

| 状态 | 说明 |
|------|------|
| idle | 当前无活跃任务 |
| running | 正在执行任务 |
| degraded | 资源不足或失败后进入降级模式 |
| failed | 当前请求失败，但窗口仍存在 |
| blocked | 因预算、熔断、全局限流被阻塞 |

---

## 三、会话命名规范

### 命名格式

```
agent:{parent_agent}:{channel_type}:{session_id}
```

### 示例

| 来源 | 命名示例 |
|------|----------|
| Webchat | `agent:main:web:202603130911_abc123` |
| Telegram | `agent:main:telegram:5885419859_202603130911` |
| CLI | `agent:main:cli:202603130911_def456` |
| Subagent | `agent:main:subagent:xyz789` |

---

## 四、会话上下文结构

```json
{
  "session_id": "web_202603130911_abc123",
  "channel_type": "webchat",
  "window_type": "interactive",
  "parent_agent": "main",
  "routing_profile": "standard",
  "priority_level": "P1",
  "status": "running",
  "created_at": "2026-03-13T09:11:00+08:00",
  "last_active_at": "2026-03-13T09:15:00+08:00",
  "active_task_count": 1,
  "active_chain_count": 0,
  "resource_budget": {
    "max_mixed_chains": 1,
    "max_subagents": 2,
    "max_retries": 2,
    "max_context_size": 8000
  },
  "last_route_decision": {
    "task_type": "simple_qa",
    "selected_model": "FAST",
    "is_mixed": false
  },
  "last_error": null,
  "history": [
    {
      "timestamp": "2026-03-13T09:11:00+08:00",
      "role": "user",
      "content": "你好"
    },
    {
      "timestamp": "2026-03-13T09:11:05+08:00",
      "role": "assistant",
      "content": "你好！有什么可以帮你的？"
    }
  ]
}
```

---

## 五、路由档位定义

### Light Profile

```json
{
  "name": "light",
  "description": "轻量任务，优先单模型",
  "rules": {
    "max_input_length": 200,
    "allow_mixed_chain": false,
    "default_timeout": 30,
    "priority": "high",
    "fallback_strategy": "direct_main"
  }
}
```

### Standard Profile

```json
{
  "name": "standard",
  "description": "标准任务，有限混合",
  "rules": {
    "max_input_length": 2000,
    "allow_mixed_chain": true,
    "max_chain_steps": 2,
    "default_timeout": 60,
    "priority": "normal",
    "fallback_strategy": "degrade_to_single"
  }
}
```

### Heavy Profile

```json
{
  "name": "heavy",
  "description": "重任务，完整混合",
  "rules": {
    "max_input_length": 10000,
    "allow_mixed_chain": true,
    "max_chain_steps": 3,
    "default_timeout": 120,
    "priority": "low",
    "fallback_strategy": "partial_result"
  }
}
```

---

## 六、优先级定义

| 优先级 | 说明 | 典型场景 |
|--------|------|----------|
| P0 | 系统控制 | 告警处理、运维命令、健康检查 |
| P1 | 当前交互 | 前台用户请求、实时对话 |
| P2 | 复杂任务 | 长文总结、调试修复、多步骤编排 |
| P3 | 后台任务 | 补偿重试、观察采样、延后统计 |

---

## 七、资源预算定义

```json
{
  "max_mixed_chains": {
    "description": "最大混合链路数",
    "light": 0,
    "standard": 1,
    "heavy": 1
  },
  "max_subagents": {
    "description": "最大子代理数",
    "light": 0,
    "standard": 2,
    "heavy": 3
  },
  "max_retries": {
    "description": "最大重试次数",
    "light": 1,
    "standard": 2,
    "heavy": 2
  },
  "max_context_size": {
    "description": "最大上下文长度",
    "light": 4000,
    "standard": 8000,
    "heavy": 16000
  }
}
```

---

## 八、会话生命周期

### 创建

```python
def create_session(channel_type, window_type="interactive"):
    session = {
        "session_id": generate_id(),
        "channel_type": channel_type,
        "window_type": window_type,
        "status": "idle",
        "created_at": now(),
        "last_active_at": now()
    }
    return session
```

### 激活

```python
def activate_session(session_id):
    session = get_session(session_id)
    session.status = "running"
    session.last_active_at = now()
    save_session(session)
```

### 关闭

```python
def close_session(session_id):
    session = get_session(session_id)
    # 清理资源
    cleanup_resources(session_id)
    # 归档历史
    archive_session(session)
    # 删除活跃会话
    delete_active_session(session_id)
```

---

## 九、隔离原则

### 必须隔离

- 对话历史
- 当前任务
- 中间结果
- 会话日志
- 故障状态
- 重试状态

### 全局共享

- alias 映射
- timeout 配置
- 路由规则模板
- fallback 规则
- 告警规则
- 并发限制
- 安全策略

---

## 十、版本历史

| 版本 | 时间 | 变更 |
|------|------|------|
| v1.0 | 2026-03-13 | 初始版本，Phase 1 会话隔离 |