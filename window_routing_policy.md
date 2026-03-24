# OpenClaw 窗口路由策略

**版本：** v1.0  
**适用：** Phase 2 - 窗口内独立路由  
**时间：** 2026-03-13

---

## 一、设计目标

每个窗口独立完成任务分类和路由决策，不受其他窗口影响。

---

## 二、路由决策流程

```
接收请求
    ↓
Step 1: 任务分类
    ↓
Step 2: 档位约束检查
    ↓
Step 3: 全局资源检查
    ↓
Step 4: 执行路由
```

---

## 三、Step 1: 任务分类

### 分类维度

| 维度 | 说明 | 判断标准 |
|------|------|----------|
| 输入长度 | 文本长度 | < 50, 50-500, 500-5000, > 5000 |
| 任务类型 | 功能分类 | 问答/总结/代码/调试/推理/润色 |
| 复杂度 | 处理难度 | 简单/中等/复杂 |
|  urgency | 紧急程度 | 实时/普通/后台 |

### 任务类型映射

| 任务特征 | 任务类型 | 默认模型 |
|----------|----------|----------|
| 纯事实问答 | simple_qa | FAST |
| 需要解释的概念 | explanation | FAST/MAIN |
| 长文档总结 | long_summary | LONG |
| 多文档整合 | multi_doc | LONG |
| 单函数代码 | single_code | CODE |
| 多文件重构 | refactor | CODE-PLUS |
| 报错分析 | debug | GROK-CODE |
| 方案比较 | reasoning | REASON |
| 中文润色 | polish | CN |
| 混合需求 | mixed | 链路 |

---

## 四、Step 2: 档位约束检查

### Light Profile 约束

```yaml
允许:
  - 单模型任务
  - 输入长度 < 200
  - 简单问答
  - 快速响应

禁止:
  - 混合链路
  - 长文本处理
  - 复杂推理
  - 多步骤编排

降级策略:
  - 长输入 → 强制摘要
  - 复杂任务 → 简化处理
  - 混合需求 → 单模型兜底
```

### Standard Profile 约束

```yaml
允许:
  - 单模型任务
  - 有限混合链路（最多 2 步）
  - 输入长度 < 2000
  - 一般分析任务

禁止:
  - 3 步以上混合链路
  - 超长文本（> 5000）
  - 重度编排

降级策略:
  - 超长输入 → 先摘要
  - 3 步链路 → 压缩为 2 步
  - 资源不足 → 单模型
```

### Heavy Profile 约束

```yaml
允许:
  - 完整混合链路（最多 3 步）
  - 输入长度 < 10000
  - 复杂分析任务
  - 多步骤编排

限制:
  - 全局混合链路并发检查
  - 高成本模型限流
  - 预算检查

降级策略:
  - 资源不足 → 压缩链路
  - 模型不可用 → 替代方案
  - 超时 → 部分结果
```

---

## 五、Step 3: 全局资源检查

### 检查项

| 检查项 | 限制 | 超限处理 |
|--------|------|----------|
| 全局混合链路数 | max 3 | 排队或降级 |
| 全局子代理数 | max 5 | 排队或拒绝 |
| 目标模型并发 | 模型相关 | 排队或 fallback |
| 当前窗口预算 | 档位相关 | 降级或拒绝 |
| 优先级队列 | P0-P3 | 高优先级抢占 |

### 模型并发限制

| 模型 | 最大并发 | 超限处理 |
|------|----------|----------|
| MAIN | 2 | 排队 |
| LONG | 2 | 排队 |
| CODE-PLUS | 1 | 排队 |
| GROK-CODE | 2 | 排队 |
| REASON | 2 | 排队 |
| 其他 | 3 | 排队 |

---

## 六、Step 4: 执行路由

### 单模型路由

```python
if task_type == "simple_qa":
    return RouteDecision(model="FAST", is_mixed=False)
elif task_type == "long_summary":
    return RouteDecision(model="LONG", is_mixed=False)
elif task_type == "single_code":
    return RouteDecision(model="CODE", is_mixed=False)
```

### 混合链路路由

```python
if task_type == "debug_and_fix":
    if profile.allow_mixed_chain:
        return RouteDecision(
            chain=["GROK-CODE", "CODE", "MAIN"],
            is_mixed=True
        )
    else:
        # 降级
        return RouteDecision(model="CODE", is_mixed=False)
```

---

## 七、路由决策结果

```json
{
  "session_id": "web_202603130911_abc123",
  "decision": {
    "task_type": "debug_and_fix",
    "routing_profile": "standard",
    "selected_model": null,
    "chain": ["GROK-CODE", "CODE", "MAIN"],
    "is_mixed": true,
    "estimated_cost": "high",
    "timeout_seconds": 195,
    "fallback_strategy": "degrade_to_code_main"
  },
  "constraints": {
    "profile_allowed": true,
    "global_resources_ok": true,
    "budget_sufficient": true
  },
  "timestamp": "2026-03-13T09:19:00+08:00"
}
```

---

## 八、降级策略矩阵

| 原需求 | Light 降级 | Standard 降级 | Heavy 降级 |
|--------|-----------|--------------|-----------|
| GROK→CODE→MAIN | CODE→MAIN | CODE→MAIN | 部分结果 |
| LONG→REASON→MAIN | LONG→MAIN | LONG→MAIN | 部分结果 |
| REASON→CN→MAIN | REASON | REASON→MAIN | 部分结果 |
| 长文本 > 5000 | 拒绝/摘要 | 先摘要 | 分段处理 |
| 复杂推理 | 简化回答 | 单模型推理 | 压缩步骤 |

---

## 九、窗口独立路由示例

### 场景：3 个窗口同时请求

**窗口 A (Light):** "什么是 Docker?"
- 分类: simple_qa
- 档位: Light
- 决策: FAST 单模型
- 结果: 立即响应

**窗口 B (Standard):** "分析这个报错并修复"
- 分类: debug_and_fix
- 档位: Standard
- 决策: GROK-CODE → CODE → MAIN
- 结果: 混合链路

**窗口 C (Heavy):** "基于这份 8000 字文档做架构决策"
- 分类: architecture_decision
- 档位: Heavy
- 决策: LONG → REASON → MAIN
- 结果: 混合链路（需预算检查）

---

## 十、与全局控制的交互

```
窗口内路由决策
    ↓
提交执行请求
    ↓
全局并发控制检查
    ↓
┌─────────────────┐
│ 资源充足?        │
└────────┬────────┘
    是 ↓ │ ↓ 否
  执行   │  排队/降级
    ↓    │
  完成   │
```

---

## 十一、实现要点

### 窗口级路由器

```python
class WindowRouter:
    def __init__(self, session: SessionContext):
        self.session = session
        self.profile = session.routing_profile
    
    def route(self, input_text: str) -> RouteDecision:
        # Step 1: 任务分类
        task_type = self.classify_task(input_text)
        
        # Step 2: 档位约束
        if not self.check_profile_constraint(task_type):
            return self.degrade_route(task_type)
        
        # Step 3: 全局资源（外部检查）
        # 返回决策，等待全局检查
        
        return self.make_decision(task_type)
```

### 与全局控制器的接口

```python
class GlobalController:
    def check_and_execute(self, session_id: str, decision: RouteDecision):
        # 检查全局资源
        if not self.check_resources(decision):
            return self.queue_or_degrade(session_id, decision)
        
        # 执行
        return self.execute(decision)
```

---

## 十二、版本历史

| 版本 | 时间 | 变更 |
|------|------|------|
| v1.0 | 2026-03-13 | 初始版本，Phase 2 窗口内独立路由 |