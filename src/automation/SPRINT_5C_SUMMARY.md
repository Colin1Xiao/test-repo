# Sprint 5C 完成报告 - Recovery / Replay / Compact Policy

**日期**: 2026-04-03  
**阶段**: Sprint 5C (Recovery / Replay / Compact Policy)  
**状态**: ✅ 完成

---

## 交付文件（4 个核心模块）

| 文件 | 行数 | 功能 |
|------|------|------|
| `types.ts` | ~180 行（扩展） | 恢复/压缩/记忆类型扩展 |
| `recovery_replay.ts` | ~360 行 | 恢复与重放执行器 |
| `compact_policy.ts` | ~280 行 | 紧凑压缩策略 |
| `memory_capture_policy.ts` | ~290 行 | 记忆捕获策略 |

**新增总计**: ~1110 行代码

---

## 核心能力交付

### ✅ 1. Types Extension - 类型扩展

**文件**: `types.ts`（扩展）

**新增类型**:
| 类型 | 说明 |
|------|------|
| `FailureCategory` | 失败分类（8 种） |
| `RecoveryReason` | 恢复原因（8 种） |
| `RecoveryDecision` | 恢复决策 |
| `ReplayRequest` / `ReplayResult` | 重放请求/结果 |
| `RecoveryPlan` | 恢复计划 |
| `CompactTrigger` | 紧凑触发（7 种） |
| `CompactDecision` / `CompactPlan` | 紧凑决策/计划 |
| `MemoryCategory` | 记忆分类（8 种） |
| `MemoryCaptureDecision` / `MemoryCaptureCandidate` | 记忆捕获决策/候选 |

**失败分类** (8 种):
- `timeout` - 超时
- `permission_denied` - 权限拒绝
- `approval_denied` - 审批拒绝
- `approval_pending` - 审批待定
- `resource_unavailable` - 资源不可用
- `validation_failed` - 验证失败
- `internal_error` - 内部错误
- `transient_external_error` - 瞬时外部错误

**恢复决策类型** (5 种):
- `retry` - 重试
- `replay` - 重放
- `resume` - 恢复
- `abort` - 中止
- `escalate` - 升级

**紧凑触发** (7 种):
- `context_too_large` - 上下文过大
- `task_graph_too_deep` - 任务图过深
- `subagent_results_too_many` - 子代理结果过多
- `approval_history_accumulated` - 审批历史堆积
- `session_end` - 会话结束
- `memory_pressure` - 内存压力
- `policy_triggered` - 策略触发

**记忆分类** (8 种):
- `task_summary` - 任务摘要
- `preference` - 偏好
- `constraint` - 约束
- `strategy` - 策略
- `lesson_learned` - 经验教训
- `recovery_pattern` - 恢复模式
- `approval_pattern` - 审批模式
- `workspace_info` - 工作区信息

---

### ✅ 2. Recovery Replay - 恢复与重放

**文件**: `recovery_replay.ts`

**核心功能**:
| 方法 | 功能 |
|------|------|
| `evaluateRecovery(context)` | 评估恢复决策 |
| `replayTask(taskId, scope)` | 重放任务 |
| `resumeTask(taskId)` | 恢复任务 |
| `replayApproval(approvalId)` | 重放审批 |
| `buildRecoveryPlan(failure, context)` | 构建恢复计划 |

**恢复策略** (按失败分类):
| 失败类型 | 恢复决策 | 说明 |
|---------|---------|------|
| `timeout` | `retry` | 退避后重试 |
| `permission_denied` | `escalate` | 升级处理 |
| `approval_denied` | `abort` | 中止任务 |
| `approval_pending` | `resume` | 恢复等待 |
| `resource_unavailable` | `replay` | 资源恢复后重放 |
| `validation_failed` | `abort` | 需要手动修复 |
| `internal/transient_error` | `retry` | 退避后重试 |

**退避策略**:
- 指数退避：`base * multiplier^retryCount`
- 最大退避时间限制
- 可配置退避参数

**恢复循环保护**:
- `maxReplayCount` - 最大重试次数
- `recoveryCooldownMs` - 恢复冷却时间
- 追踪恢复历史防止风暴

**恢复计划**:
```typescript
{
  taskId: string;
  decision: RecoveryDecision;
  steps: [{ action, params }];
  estimatedRecoveryTimeMs: number;
}
```

---

### ✅ 3. Compact Policy - 紧凑压缩策略

**文件**: `compact_policy.ts`

**核心功能**:
| 方法 | 功能 |
|------|------|
| `evaluateCompactNeed(context)` | 评估紧凑需求 |
| `shouldCompact(event, context)` | 检查是否应该紧凑 |
| `buildCompactPlan(context)` | 构建紧凑计划 |
| `summarizeForCompact(context)` | 生成紧凑摘要 |

**紧凑触发条件** (7 种):
| 触发条件 | 阈值 | 优先级 |
|---------|------|--------|
| `session_end` | 会话结束 | 10 |
| `memory_pressure` | 上下文 > 1MB | 9 |
| `context_too_large` | 消息 > 100 | 8 |
| `task_graph_too_deep` | 深度 > 10 | 7 |
| `subagent_results_too_many` | 结果 > 20 | 6 |
| `approval_history_accumulated` | 历史 > 50 | 5 |
| `policy_triggered` | 策略触发 | - |

**紧凑策略**:
```typescript
{
  keepLastN?: number;        // 保留最近 N 条
  preserveKeyEvents?: boolean; // 保留关键事件
  generateSummary?: boolean;   // 生成摘要
  summaryLengthLimit?: number; // 摘要长度限制
  compressAttachments?: boolean; // 压缩附件
}
```

**紧凑范围** (4 种):
- `session` - 会话级压缩
- `task` - 任务级压缩
- `approval` - 审批级压缩
- `history` - 历史级压缩

**紧凑计划**:
```typescript
{
  scope: CompactScope;
  trigger: CompactTrigger;
  strategy: CompactStrategy;
  estimatedCompressionRatio: number;
  estimatedSpaceSaved: number;
}
```

---

### ✅ 4. Memory Capture Policy - 记忆捕获策略

**文件**: `memory_capture_policy.ts`

**核心功能**:
| 方法 | 功能 |
|------|------|
| `evaluateMemoryCapture(context)` | 评估记忆捕获 |
| `shouldCaptureMemory(event, context)` | 检查是否应该捕获 |
| `buildMemoryCaptureCandidate(context)` | 构建记忆候选 |
| `filterLowValueMemory(candidate)` | 过滤低价值记忆 |

**记忆分类** (8 种):
- `task_summary` - 任务摘要（成功完成的任务）
- `preference` - 偏好变化
- `constraint` - 约束/规则
- `strategy` - 策略变化
- `lesson_learned` - 经验教训
- `recovery_pattern` - 恢复模式
- `approval_pattern` - 审批模式
- `workspace_info` - 工作区信息

**价值评分** (0-1):
- 基础分：`importanceScore` 或 0.5
- 成功完成任务：+0.1
- 长期有效信息（偏好/约束/策略）：+0.2
- 模式信息（恢复/审批）：+0.15
- 经验教训：+0.15
- 失败事件（非教训）：-0.1
- 一次性事件：-0.2

**低价值过滤模式**:
- retry / transient / temporary
- timeout / connection reset
- network error

**记忆捕获候选**:
```typescript
{
  content: string;
  category: MemoryCategory;
  valueScore: number;  // 0-1
  sourceEvent?: string;
  relatedTaskId?: string;
  relatedApprovalId?: string;
  metadata?: Record<string, any>;
  isHighValue: boolean;  // >= 0.8
  isOneTimeInfo: boolean;
}
```

---

## 验收标准验证

### ✅ 1. task replay / resume / abort 能被区分并执行

**验证**:
```typescript
const executor = createRecoveryReplayExecutor();

// timeout → retry
const timeoutDecision = await executor.evaluateRecovery({
  failureCategory: 'timeout',
  currentRetryCount: 0,
});
expect(timeoutDecision.type).toBe('retry');
expect(timeoutDecision.retryable).toBe(true);

// approval_denied → abort
const deniedDecision = await executor.evaluateRecovery({
  failureCategory: 'approval_denied',
});
expect(deniedDecision.type).toBe('abort');
expect(deniedDecision.retryable).toBe(false);

// approval_pending → resume
const pendingDecision = await executor.evaluateRecovery({
  failureCategory: 'approval_pending',
});
expect(pendingDecision.type).toBe('resume');
```

**状态**: ✅ **通过**

---

### ✅ 2. approval replay 能复用现有审批主干

**验证**:
```typescript
// 重放审批
const result = await executor.replayApproval('approval_123');

expect(result.success).toBe(true);
expect(result.replayType).toBe('approval');
expect(result.replayedTaskId).toBe('approval_123');
```

**状态**: ✅ **通过**

---

### ✅ 3. compact 策略能根据上下文做结构化决策

**验证**:
```typescript
const evaluator = createCompactPolicyEvaluator();

// 消息过多触发紧凑
const decision = evaluator.evaluateCompactNeed({
  messageCount: 150,  // 超过 100 阈值
});

expect(decision.shouldCompact).toBe(true);
expect(decision.trigger).toBe('context_too_large');
expect(decision.priority).toBe(8);
expect(decision.scope).toBe('history');
expect(decision.strategy).toBeDefined();
expect(decision.strategy?.keepLastN).toBeDefined();
```

**状态**: ✅ **通过**

---

### ✅ 4. memory capture 策略能区分高价值与低价值信息

**验证**:
```typescript
const evaluator = createMemoryCapturePolicyEvaluator();

// 高价值：成功的任务摘要
const highValueDecision = evaluator.evaluateMemoryCapture({
  eventType: 'task.completed',
  eventResult: 'success',
  importanceScore: 0.9,
  contentSummary: 'Important task completed successfully',
});

expect(highValueDecision.shouldCapture).toBe(true);
expect(highValueDecision.valueScore).toBeGreaterThan(0.7);
expect(highValueDecision.candidate?.isHighValue).toBe(true);

// 低价值：瞬时错误
const lowValueDecision = evaluator.evaluateMemoryCapture({
  eventType: 'task.timeout',
  eventResult: 'failure',
  isOneTimeEvent: true,
  contentSummary: 'Temporary timeout error',
});

expect(lowValueDecision.shouldCapture).toBe(false);
expect(lowValueDecision.valueScore).toBeLessThan(0.6);
```

**状态**: ✅ **通过**

---

### ✅ 5. recovery 有上限、冷却或等价防风暴机制

**验证**:
```typescript
const executor = createRecoveryReplayExecutor({
  defaultMaxRetries: 3,
  recoveryCooldownMs: 60000,
});

// 超过最大重试次数
const maxRetryDecision = await executor.evaluateRecovery({
  failureCategory: 'timeout',
  currentRetryCount: 3,
  maxRetryCount: 3,
});

expect(maxRetryDecision.type).toBe('abort');
expect(maxRetryDecision.retryable).toBe(false);

// 冷却时间内
await executor.replayTask('task_123');
const cooldownResult = await executor.replayTask('task_123');

expect(cooldownResult.success).toBe(false);
expect(cooldownResult.error).toContain('cooldown');
```

**状态**: ✅ **通过**

---

### ✅ 6. 所有 recovery / compact / capture 决策可解释、可追踪、可审计

**验证**:
```typescript
// 恢复决策可解释
const recoveryDecision = await executor.evaluateRecovery({
  failureCategory: 'timeout',
  currentRetryCount: 1,
});

expect(recoveryDecision.explanation).toBeDefined();
expect(recoveryDecision.reason).toBeDefined();
expect(recoveryDecision.failureCategory).toBeDefined();

// 紧凑决策可解释
const compactDecision = evaluator.evaluateCompactNeed({
  messageCount: 150,
});

expect(compactDecision.reason).toBeDefined();
expect(compactDecision.trigger).toBeDefined();

// 记忆捕获决策可解释
const memoryDecision = memoryEvaluator.evaluateMemoryCapture({
  eventType: 'task.completed',
  eventResult: 'success',
});

expect(memoryDecision.reason).toBeDefined();
expect(memoryDecision.valueScore).toBeDefined();
expect(memoryDecision.category).toBeDefined();
```

**状态**: ✅ **通过**

---

## 与现有主干的接法

### 与 TaskStore 集成
```typescript
// 恢复/重放通过 TaskStore 执行
class TaskStoreRecoveryExecutor extends RecoveryReplayExecutor {
  async replayTask(taskId: string, scope?: ReplayScope): Promise<ReplayResult> {
    // 从 TaskStore 获取任务历史
    const taskHistory = await taskStore.getTaskHistory(taskId);
    
    // 根据 scope 决定重放范围
    if (scope?.includeSubtasks) {
      const subtasks = await taskStore.getSubtasks(taskId);
      // ...
    }
    
    // 执行重放
    return await super.replayTask(taskId, scope);
  }
}
```

### 与 ApprovalBridge 集成
```typescript
// 审批重放通过 ApprovalBridge 执行
class ApprovalBridgeRecoveryExecutor extends RecoveryReplayExecutor {
  async replayApproval(approvalId: string): Promise<ReplayResult> {
    // 通过 ApprovalBridge 重放审批
    await approvalBridge.replayApproval(approvalId);
    
    return {
      success: true,
      replayedTaskId: approvalId,
      replayType: 'approval',
      replayCount: 1,
      replayTimeMs: Date.now() - startTime,
    };
  }
}
```

### 与 HookBus / Automation 集成
```typescript
// 触发自动化事件
hookBus.emit({
  type: 'TaskReplayRequested',
  timestamp: Date.now(),
  payload: {
    taskId,
    replayType: 'task',
    reason: decision.reason,
  },
});

hookBus.emit({
  type: 'SessionCompactTriggered',
  timestamp: Date.now(),
  payload: {
    sessionId,
    trigger: decision.trigger,
    estimatedCompressionRatio: plan.estimatedCompressionRatio,
  },
});

hookBus.emit({
  type: 'MemoryCaptureTriggered',
  timestamp: Date.now(),
  payload: {
    category: candidate.category,
    valueScore: candidate.valueScore,
    isHighValue: candidate.isHighValue,
  },
});
```

### 与 Memory 集成
```typescript
// 记忆捕获候选传递给 Memory 层
const candidate = memoryEvaluator.buildMemoryCaptureCandidate(context);

if (candidate.valueScore >= config.minValueScore) {
  await memoryStore.capture({
    content: candidate.content,
    category: candidate.category,
    metadata: {
      sourceEvent: candidate.sourceEvent,
      relatedTaskId: candidate.relatedTaskId,
      valueScore: candidate.valueScore,
    },
  });
}
```

---

## 下一步：Sprint 5D

**目标**: Audit / Health / Ops View

**交付物**:
1. `audit_log.ts` - 审计日志
2. `health_metrics.ts` - 健康指标
3. `failure_taxonomy.ts` - 失败分类
4. `ops_summary.ts` - 运维摘要

**前提条件**: ✅ 已完成
- ✅ 类型定义
- ✅ 恢复/重放执行器
- ✅ 紧凑策略
- ✅ 记忆捕获策略

---

## 结论

**Sprint 5C 验收**: ✅ **通过**

**6 条验收标准全部满足**:
1. ✅ task replay / resume / abort 能被区分并执行
2. ✅ approval replay 能复用现有审批主干
3. ✅ compact 策略能根据上下文做结构化决策
4. ✅ memory capture 策略能区分高价值与低价值信息
5. ✅ recovery 有上限、冷却或等价防风暴机制
6. ✅ 所有 recovery / compact / capture 决策可解释、可追踪、可审计

**状态**: Recovery / Replay / Compact Policy 完成，系统长跑能力已稳固

---

**Sprint 5 完成度**: 3/4 (75%)

_Sprint 5C 完成，准备进入 Sprint 5D（Audit / Health / Ops View）_
