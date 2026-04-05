# Sprint 5 架构设计 - Hook Automation / Recovery / Audit

**版本**: v0.1.0  
**状态**: Design Draft  
**日期**: 2026-04-03  
**作者**: Colin + 小龙

---

## 一、目标与范围

### 1.1 核心目标

把 OpenClaw 从：

> 会跑的系统

升级为：

> 能长期稳定地跑、能被审计、能自动维护秩序的系统

**一句话定义**:

> Sprint 5 让系统具备自维护、自观测、自恢复能力。

### 1.2 核心价值

| 能力 | 获得的系统价值 |
|------|---------------|
| Hook Automation | 事件驱动的自动响应 |
| Recovery / Replay | 故障恢复与重放 |
| Audit / Health | 可观测性与健康度 |

### 1.3 不做的事情（边界）

| 不做 | 原因 |
|------|------|
| 替代现有 HookBus | 是在 HookBus 之上增加自动化层 |
| 独立权限体系 | 服从现有 PermissionEngine |
| 复杂 UI Dashboard | 先做数据层，UI 后续 |

---

## 二、分阶段拆分

### 2.1 阶段划分

```
Sprint 5A: Hook Automation Runtime
    ↓
Sprint 5B: Automation Loader / Workspace Rules
    ↓
Sprint 5C: Recovery / Replay / Compact Policy
    ↓
Sprint 5D: Audit / Health / Ops View
```

### 2.2 Sprint 5A: Hook Automation Runtime

**目标**: 把现有 HookBus 升级成规则驱动自动化系统

**核心模块**:
| 模块 | 职责 |
|------|------|
| `hook_rules.ts` | 规则定义与匹配 |
| `hook_conditions.ts` | 条件表达式 |
| `hook_actions.ts` | 动作执行 |

**第一版输出对象**:
```typescript
type HookRule = {
  id: string;
  name: string;
  events: string[];
  conditions: Condition[];
  actions: Action[];
  enabled: boolean;
  priority?: number;
}

type Condition = {
  type: 'field' | 'regex' | 'threshold' | 'custom';
  field?: string;
  operator?: string;
  value?: any;
  expression?: string;
}

type Action = {
  type: 'notify' | 'retry' | 'escalate' | 'log' | 'custom';
  target?: string;
  params?: Record<string, any>;
}
```

**验收标准**:
- [ ] 事件 → 条件 → 动作链路打通
- [ ] task fail / approval pending / server degraded 等触发自动动作
- [ ] 规则可启用/禁用
- [ ] 规则优先级生效

---

### 2.3 Sprint 5B: Automation Loader / Workspace Rules

**目标**: 让自动化规则可配置

**核心模块**:
| 模块 | 职责 |
|------|------|
| `automation_loader.ts` | 规则加载 |
| `automation_schema.ts` | Schema 定义 |
| `automation_registry.ts` | 规则注册 |

**第一版输出对象**:
```yaml
# hooks.yaml
rules:
  - id: notify-on-task-fail
    name: Notify on Task Failure
    events: ['task.failed']
    conditions:
      - field: 'task.riskLevel'
        operator: 'gte'
        value: 'high'
    actions:
      - type: 'notify'
        target: 'telegram'
        params:
          message: 'Task {{task.id}} failed'

# automation.yaml
workspace:
  enabled: true
  rulesPath: './hooks.yaml'
```

**验收标准**:
- [ ] hooks.yaml 可加载
- [ ] automation.yaml 可配置
- [ ] workspace 级规则生效
- [ ] 规则热加载（可选）

---

### 2.4 Sprint 5C: Recovery / Replay / Compact Policy

**目标**: 把恢复与收敛做成正式系统层

**核心模块**:
| 模块 | 职责 |
|------|------|
| `recovery_replay.ts` | 任务/审批重放 |
| `compact_policy.ts` | Session 压缩策略 |
| `memory_capture_policy.ts` | 记忆捕获策略 |

**第一版输出对象**:
```typescript
type RecoveryStrategy = {
  type: 'retry' | 'rollback' | 'escalate' | 'skip';
  maxRetries?: number;
  backoffMs?: number;
  onFail?: 'abort' | 'continue';
}

type CompactPolicy = {
  maxMessages: number;
  preserveTypes: string[];
  compressAfter: number;
}

type MemoryCapturePolicy = {
  triggerEvents: string[];
  minImportance: number;
  autoSummarize: boolean;
}
```

**验收标准**:
- [ ] task replay 可用
- [ ] approval replay 可用
- [ ] session compact 策略生效
- [ ] 自动 memory capture 工作

---

### 2.5 Sprint 5D: Audit / Health / Ops View

**目标**: 让系统开始具备可运维性

**核心模块**:
| 模块 | 职责 |
|------|------|
| `audit_log.ts` | 审计日志 |
| `health_metrics.ts` | 健康指标 |
| `failure_taxonomy.ts` | 失败分类 |
| `ops_summary.ts` | 运维摘要 |

**第一版输出对象**:
```typescript
type AuditLogEntry = {
  timestamp: number;
  eventType: string;
  sessionId?: string;
  taskId?: string;
  agentId?: string;
  data: Record<string, any>;
  result: 'success' | 'failure' | 'pending';
}

type HealthMetrics = {
  uptime: number;
  totalSessions: number;
  totalTasks: number;
  failureRate: number;
  avgTaskDuration: number;
  topFailures: FailureCount[];
}

type OpsSummary = {
  systemHealth: 'healthy' | 'degraded' | 'critical';
  activeAgents: number;
  pendingApprovals: number;
  recentFailures: number;
  recommendations: string[];
}
```

**验收标准**:
- [ ] 审计日志可查询
- [ ] 健康指标可计算
- [ ] 失败分类可用
- [ ] 运维摘要可生成

---

## 三、规则模型

### 3.1 规则结构

```yaml
rule:
  id: string
  name: string
  description?: string
  enabled: boolean
  priority?: number
  
  # 触发事件
  events:
    - 'task.failed'
    - 'task.completed'
    - 'approval.pending'
    - 'server.degraded'
    - 'budget.exceeded'
  
  # 条件
  conditions:
    - type: 'field'
      field: 'task.riskLevel'
      operator: 'gte'
      value: 'high'
    - type: 'regex'
      field: 'task.description'
      pattern: '/critical|urgent/i'
    - type: 'threshold'
      field: 'task.retryCount'
      operator: 'lt'
      value: 3
  
  # 动作
  actions:
    - type: 'notify'
      target: 'telegram'
      params:
        message: 'Task {{task.id}} failed'
    - type: 'retry'
      params:
        maxRetries: 3
        backoffMs: 1000
    - type: 'escalate'
      target: 'admin'
    - type: 'log'
      params:
        level: 'error'
```

### 3.2 内置事件

| 事件 | 说明 | 数据字段 |
|------|------|---------|
| `task.created` | 任务创建 | task, agent, session |
| `task.started` | 任务开始 | task, agent |
| `task.completed` | 任务完成 | task, result |
| `task.failed` | 任务失败 | task, error |
| `task.timeout` | 任务超时 | task, timeoutMs |
| `approval.requested` | 审批请求 | approval, task |
| `approval.resolved` | 审批解决 | approval, result |
| `server.degraded` | Server 降级 | server, health |
| `server.unavailable` | Server 不可用 | server |
| `budget.exceeded` | 预算超限 | budget, usage |
| `skill.loaded` | Skill 加载 | skill, agent |
| `skill.blocked` | Skill 阻塞 | skill, reason |

### 3.3 内置动作

| 动作 | 说明 | 参数 |
|------|------|------|
| `notify` | 发送通知 | target, message |
| `retry` | 重试任务 | maxRetries, backoffMs |
| `escalate` | 升级处理 | target, reason |
| `log` | 记录日志 | level, message |
| `cancel` | 取消任务 | reason |
| `pause` | 暂停执行 | duration |
| `custom` | 自定义动作 | handler, params |

---

## 四、恢复策略

### 4.1 失败分类

```typescript
type FailureCategory = 
  | 'timeout'
  | 'permission_denied'
  | 'approval_denied'
  | 'resource_unavailable'
  | 'validation_failed'
  | 'internal_error'
  | 'external_error';
```

### 4.2 恢复策略

| 失败类型 | 默认策略 | 可配置选项 |
|---------|---------|-----------|
| timeout | retry | maxRetries, backoffMs |
| permission_denied | escalate | target |
| approval_denied | abort | - |
| resource_unavailable | retry | maxRetries, backoffMs |
| validation_failed | abort | - |
| internal_error | retry | maxRetries |
| external_error | retry | maxRetries, backoffMs |

### 4.3 重放语义

```typescript
type ReplayContext = {
  originalTask: Task;
  originalError?: Error;
  replayCount: number;
  replayedAt: number;
  replayReason: string;
};
```

---

## 五、与现有主干的接法

### 5.1 与 HookBus 集成

```typescript
// HookBus 触发规则评估
hookBus.on('task.failed', async (event) => {
  const rules = automationRegistry.matchRules('task.failed', event);
  
  for (const rule of rules) {
    if (await evaluateConditions(rule.conditions, event)) {
      await executeActions(rule.actions, event);
    }
  }
});
```

### 5.2 与 TaskStore 集成

```typescript
// 任务重放
await taskStore.replayTask(taskId, {
  strategy: 'retry',
  maxRetries: 3,
});

// 审计日志
await taskStore.appendAuditLog({
  eventType: 'task.failed',
  taskId,
  data: { error },
  result: 'failure',
});
```

### 5.3 与 ApprovalBridge 集成

```typescript
// 审批重放
await approvalBridge.replayApproval(approvalId, {
  strategy: 'escalate',
  target: 'admin',
});
```

### 5.4 与 Memory 集成

```typescript
// 记忆捕获
memory.capture({
  triggerEvent: 'task.completed',
  minImportance: 0.7,
  autoSummarize: true,
});
```

---

## 六、目录结构

```
src/automation/
  # 5A: Hook Automation
  hook_rules.ts
  hook_conditions.ts
  hook_actions.ts
  
  # 5B: Automation Loader
  automation_loader.ts
  automation_schema.ts
  automation_registry.ts
  
  # 5C: Recovery
  recovery_replay.ts
  compact_policy.ts
  memory_capture_policy.ts
  
  # 5D: Audit / Health
  audit_log.ts
  health_metrics.ts
  failure_taxonomy.ts
  ops_summary.ts
  
  # Types
  types.ts
  index.ts
  
  # Rules (YAML)
  rules/
    default-hooks.yaml
    workspace-hooks.yaml
```

---

## 七、MVP 验收标准

### 7.1 Sprint 5A MVP

- [ ] 事件 → 条件 → 动作链路打通
- [ ] task fail / approval pending / server degraded 触发自动动作
- [ ] 规则可启用/禁用
- [ ] 规则优先级生效

### 7.2 Sprint 5B MVP

- [ ] hooks.yaml 可加载
- [ ] automation.yaml 可配置
- [ ] workspace 级规则生效

### 7.3 Sprint 5C MVP

- [ ] task replay 可用
- [ ] approval replay 可用
- [ ] session compact 策略生效
- [ ] 自动 memory capture 工作

### 7.4 Sprint 5D MVP

- [ ] 审计日志可查询
- [ ] 健康指标可计算
- [ ] 失败分类可用
- [ ] 运维摘要可生成

---

## 八、依赖关系

### 8.1 内部依赖

| 模块 | 依赖 |
|------|------|
| Hook Rules | HookBus (events) |
| Automation Loader | Hook Rules |
| Recovery Replay | TaskStore, ApprovalBridge |
| Audit Log | HookBus, TaskStore |
| Health Metrics | TaskStore, AuditLog |

### 8.2 外部依赖

| 依赖 | 用途 | 必需 |
|------|------|------|
| `js-yaml` | YAML 解析 | P0 |
| `ajv` | Schema 验证 | P1 |

---

## 九、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 规则循环触发 | 高 | 检测循环 + 最大触发次数 |
| 动作执行失败 | 中 | 动作级错误处理 + 降级 |
| 审计日志过大 | 中 | 日志轮转 + 压缩 |
| 恢复策略冲突 | 中 | 策略优先级 + 冲突检测 |

---

**下一步**: 开始 Sprint 5A 实现

---

_Hook Automation / Recovery / Audit 是让 OpenClaw 从"能跑"到"能长期稳定跑"的关键。_
