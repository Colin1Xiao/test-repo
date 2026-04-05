# Agent Teams / Subagents 架构设计

**版本**: v0.1.0  
**状态**: Design Draft  
**日期**: 2026-04-03  
**作者**: Colin + 小龙

---

## 一、目标

建立 **Agent Team Runtime**，让 OpenClaw 从"单代理执行器"升级为"可分工协作系统"。

**核心约束**：
1. 所有新能力必须接入统一 runtime（不能做成旁路系统）
2. 子代理必须受 budget / policy / hooks / task graph 约束
3. 先做足够实用，不追求 IDE 级完整性

---

## 二、目录结构

```
src/
  agents/
    # 核心运行时
    team_orchestrator.ts      # 主代理调度器
    subagent_runner.ts        # 子代理执行器
    subagent_context.ts       # 子代理上下文管理
    result_merge.ts           # 结果归并器
    
    # 策略与约束
    delegation_policy.ts      # 任务拆分策略
    team_budget.ts            # 预算与资源控制
    task_graph.ts             # 任务依赖图
    
    # 预定义角色
    roles/
      planner_agent.ts        # 规划代理
      repo_reader.ts          # 代码读取代理
      code_fixer.ts           # 代码修复代理
      code_reviewer.ts        # 代码审查代理
      verify_agent.ts         # 验证代理
      release_agent.ts        # 发布代理
    
    # 类型定义
    types.ts                  # 公共类型定义
    state_machine.ts          # 状态机定义
    
    # Hook 集成
    hooks.ts                  # HookBus 事件注册
```

---

## 三、核心数据结构

### 3.1 SubagentTask

```typescript
type SubagentTask = {
  // 身份
  id: string                    // 子任务 ID (UUID)
  parentTaskId: string          // 父任务 ID
  sessionId: string             // 所属会话 ID
  
  // 任务定义
  agent: string                 // 代理角色 (planner/reviewer/fixer/verifier)
  goal: string                  // 任务目标
  inputs: Record<string, unknown>  // 输入参数
  
  // 约束
  allowedTools: string[]        // 工具白名单
  forbiddenTools?: string[]     // 工具黑名单
  worktree?: string             // 工作树隔离 ID
  
  // 预算
  budget: {
    maxTurns: number            // 最大对话轮次
    maxTokens?: number          // 最大 token 消耗
    timeoutMs: number           // 超时时间
    retryPolicy?: {
      maxRetries: number
      backoffMs: number
    }
  }
  
  // 状态
  status: SubagentStatus
  createdAt: number             // 创建时间戳
  startedAt?: number            // 开始时间戳
  completedAt?: number          // 完成时间戳
  
  // 执行跟踪
  currentTurn: number           // 当前轮次
  tokensUsed?: number           // 已用 token
  lastError?: string            // 最后错误信息
  
  // 依赖
  dependsOn?: string[]          // 依赖的子任务 ID
  blockedBy?: string[]          // 被哪些任务阻塞
}

type SubagentStatus = 
  | "queued"      // 已创建，等待执行
  | "running"     // 执行中
  | "done"        // 成功完成
  | "failed"      // 执行失败
  | "cancelled"   // 被取消
  | "timeout"     // 超时
  | "budget_exceeded"  // 预算超限
```

### 3.2 SubagentResult

```typescript
type SubagentResult = {
  // 身份
  subagentTaskId: string
  parentTaskId: string
  agent: string
  
  // 结果
  summary: string                 // 执行摘要
  confidence?: number             // 置信度 (0-1)
  
  // 产出物
  artifacts?: ArtifactRef[]       // 生成的文件/资源
  patches?: PatchRef[]            // 代码补丁
  findings?: Finding[]            // 发现的问题
  
  // 审计
  turnsUsed: number               // 实际使用轮次
  tokensUsed?: number             // 实际使用 token
  durationMs: number              // 执行耗时
  
  // 错误
  error?: {
    type: string
    message: string
    recoverable: boolean
  }
  
  // 后续建议
  blockers?: string[]             // 阻塞问题
  recommendations?: string[]      // 后续建议
  nextSteps?: string[]            // 推荐下一步
}

type ArtifactRef = {
  type: "file" | "directory" | "url" | "text"
  path?: string
  url?: string
  content?: string
  description: string
}

type PatchRef = {
  fileId: string
  diff: string
  hunks: number
  linesAdded: number
  linesDeleted: number
}

type Finding = {
  type: "issue" | "suggestion" | "risk" | "blocker"
  severity: "low" | "medium" | "high" | "critical"
  location?: {
    file: string
    line?: number
    column?: number
  }
  description: string
  suggestion?: string
}
```

### 3.3 TeamContext

```typescript
type TeamContext = {
  // 团队身份
  teamId: string
  parentTaskId: string
  sessionId: string
  
  // 团队成员
  agents: SubagentTask[]
  
  // 共享状态
  sharedState: Record<string, unknown>
  
  // 资源
  worktree?: string
  allowedTools: string[]
  
  // 预算
  totalBudget: {
    maxTurns: number
    maxTokens?: number
    timeoutMs: number
  }
  usedBudget: {
    turns: number
    tokens?: number
    elapsedMs: number
  }
  
  // 状态
  status: "active" | "completed" | "failed" | "cancelled"
  createdAt: number
  completedAt?: number
}
```

---

## 四、核心接口

### 4.1 TeamOrchestrator

```typescript
interface ITeamOrchestrator {
  /**
   * 创建子代理团队
   */
  createTeam(params: CreateTeamParams): Promise<TeamContext>
  
  /**
   * 拆分任务给子代理
   */
  delegateTask(params: DelegateTaskParams): Promise<SubagentTask>
  
  /**
   * 等待所有子代理完成
   */
  waitForCompletion(teamId: string, options?: WaitForOptions): Promise<SubagentResult[]>
  
  /**
   * 归并子代理结果
   */
  mergeResults(results: SubagentResult[]): Promise<MergedResult>
  
  /**
   * 取消团队执行
   */
  cancelTeam(teamId: string, reason?: string): Promise<void>
  
  /**
   * 获取团队状态
   */
  getTeamStatus(teamId: string): Promise<TeamContext>
}

type CreateTeamParams = {
  parentTaskId: string
  sessionId: string
  goal: string
  agents: AgentRole[]
  totalBudget: BudgetConfig
  worktree?: string
}

type AgentRole = {
  role: string
  goal: string
  inputs?: Record<string, unknown>
  allowedTools: string[]
  budget: BudgetConfig
  dependsOn?: string[]
}

type DelegateTaskParams = {
  teamId: string
  agent: string
  goal: string
  inputs?: Record<string, unknown>
  allowedTools: string[]
  budget: BudgetConfig
  dependsOn?: string[]
}

type WaitForOptions = {
  timeoutMs?: number
  pollIntervalMs?: number
  stopOnError?: boolean
}

type MergedResult = {
  summary: string
  artifacts: ArtifactRef[]
  patches: PatchRef[]
  findings: Finding[]
  confidence: number
  blockers: string[]
  recommendations: string[]
}
```

### 4.2 SubagentRunner

```typescript
interface ISubagentRunner {
  /**
   * 启动子代理执行
   */
  run(task: SubagentTask): Promise<SubagentResult>
  
  /**
   * 停止子代理
   */
  stop(taskId: string, reason?: string): Promise<void>
  
  /**
   * 获取子代理状态
   */
  getStatus(taskId: string): Promise<SubagentTask>
  
  /**
   * 注入上下文
   */
  injectContext(taskId: string, context: SubagentContext): Promise<void>
}

type SubagentContext = {
  // 任务上下文
  task: SubagentTask
  
  // 共享状态
  sharedState: Record<string, unknown>
  
  // 父任务结果
  parentResults?: SubagentResult[]
  
  // 工具运行时
  toolRuntime: IToolRuntime
  
  // 权限策略
  permissionPolicy: IPermissionPolicy
  
  // Hook 总线
  hookBus: IHookBus
}
```

### 4.3 DelegationPolicy

```typescript
interface IDelegationPolicy {
  /**
   * 判断任务是否可拆分
   */
  canDelegate(task: TaskDefinition): Promise<DelegationDecision>
  
  /**
   * 推荐子代理角色
   */
  recommendAgents(task: TaskDefinition): Promise<AgentRole[]>
  
  /**
   * 计算预算分配
   */
  calculateBudget(
    parentBudget: BudgetConfig,
    agents: AgentRole[]
  ): Promise<BudgetAllocation>
  
  /**
   * 验证工具权限
   */
  validateToolPermissions(
    agent: string,
    tools: string[]
  ): Promise<PermissionValidation>
}

type DelegationDecision = {
  allowed: boolean
  reason?: string
  riskLevel: "low" | "medium" | "high"
  constraints?: string[]
}

type BudgetAllocation = {
  perAgent: Record<string, BudgetConfig>
  reserved: BudgetConfig  // 预留用于重试/归并
}

type PermissionValidation = {
  allowed: string[]
  denied: string[]
  reason?: string
}
```

### 4.4 ResultMerger

```typescript
interface IResultMerger {
  /**
   * 归并多个子代理结果
   */
  merge(results: SubagentResult[], options?: MergeOptions): Promise<MergedResult>
  
  /**
   * 合并代码补丁
   */
  mergePatches(patches: PatchRef[]): Promise<MergedPatch>
  
  /**
   * 合并发现的问题
   */
  mergeFindings(findings: Finding[]): Promise<MergedFindings>
  
  /**
   * 生成最终摘要
   */
  generateSummary(results: SubagentResult[]): Promise<string>
}

type MergeOptions = {
  // 冲突解决策略
  patchConflictStrategy: "fail" | "prefer-latest" | "manual"
  
  // 置信度计算
  confidenceStrategy: "average" | "weighted" | "min"
  
  // 发现去重
  deduplicateFindings: boolean
}

type MergedPatch = {
  patches: PatchRef[]
  conflicts: PatchConflict[]
  resolved: boolean
}

type PatchConflict = {
  fileId: string
  conflictingPatches: string[]
  resolution?: "auto" | "manual"
  details: string
}

type MergedFindings = {
  findings: Finding[]
  grouped: Record<string, Finding[]>
  summary: string
}
```

---

## 五、状态机

### 5.1 SubagentTask 状态机

```
                    ┌─────────────┐
                    │   queued    │
                    └──────┬──────┘
                           │ start()
                           ▼
                    ┌─────────────┐
              ┌─────│   running   │─────┐
              │     └──────┬──────┘     │
              │            │            │
        retry │      complete()    timeout/budget
              │            │            │
              │            ▼            │
              │     ┌─────────────┐     │
              └────►│    done     │     │
                    └─────────────┘     │
                                        │
                    ┌─────────────┐     │
              ┌─────│   failed    │◄────┘
              │     └─────────────┘
              │            │
        cancel│            │ stop()
              │            ▼
              │     ┌─────────────┐
              └─────│  cancelled  │
                    └─────────────┘
```

### 5.2 TeamContext 状态机

```
                    ┌─────────────┐
                    │   active    │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        allDone()    anyFailed()   cancel()
              │            │            │
              ▼            ▼            ▼
       ┌────────────┐ ┌─────────┐ ┌──────────┐
       │ completed  │ │ failed  │ │cancelled │
       └────────────┘ └─────────┘ └──────────┘
```

### 5.3 状态转换规则

```typescript
const SUBAGENT_STATE_MACHINE = {
  queued: {
    start: "running",
    cancel: "cancelled",
  },
  running: {
    complete: "done",
    fail: "failed",
    timeout: "timeout",
    budget_exceeded: "budget_exceeded",
    cancel: "cancelled",
    retry: "queued",  // 可重试
  },
  done: {
    // 终态，不可转换
  },
  failed: {
    retry: "queued",  // 可重试
  },
  timeout: {
    retry: "queued",  // 可重试
  },
  budget_exceeded: {
    // 终态，不可重试
  },
  cancelled: {
    // 终态，不可转换
  },
}
```

---

## 六、事件流

### 6.1 HookBus 事件定义

```typescript
// 新增 Hook 事件类型
type HookEventType =
  | "SubagentStart"
  | "SubagentStop"
  | "SubagentFail"
  | "SubagentTimeout"
  | "SubagentHandoff"
  | "SubagentBudgetExceeded"
  | "TeamCreate"
  | "TeamComplete"
  | "TeamFail"
  | "TeamCancel"

// 事件负载
type SubagentStartEvent = {
  type: "SubagentStart"
  taskId: string
  teamId: string
  agent: string
  goal: string
  budget: BudgetConfig
  timestamp: number
}

type SubagentStopEvent = {
  type: "SubagentStop"
  taskId: string
  teamId: string
  reason: "completed" | "cancelled" | "failed"
  result?: SubagentResult
  timestamp: number
}

type SubagentFailEvent = {
  type: "SubagentFail"
  taskId: string
  teamId: string
  error: {
    type: string
    message: string
  }
  recoverable: boolean
  timestamp: number
}

type SubagentTimeoutEvent = {
  type: "SubagentTimeout"
  taskId: string
  teamId: string
  timeoutMs: number
  turnsCompleted: number
  timestamp: number
}

type SubagentHandoffEvent = {
  type: "SubagentHandoff"
  fromTaskId: string
  toTaskId: string
  teamId: string
  context: Record<string, unknown>
  timestamp: number
}

type SubagentBudgetExceededEvent = {
  type: "SubagentBudgetExceeded"
  taskId: string
  teamId: string
  budgetType: "turns" | "tokens" | "timeout"
  limit: number
  used: number
  timestamp: number
}

type TeamCreateEvent = {
  type: "TeamCreate"
  teamId: string
  parentTaskId: string
  agents: string[]
  totalBudget: BudgetConfig
  timestamp: number
}

type TeamCompleteEvent = {
  type: "TeamComplete"
  teamId: string
  results: SubagentResult[]
  mergedResult: MergedResult
  durationMs: number
  timestamp: number
}

type TeamFailEvent = {
  type: "TeamFail"
  teamId: string
  reason: string
  failedTasks: string[]
  timestamp: number
}

type TeamCancelEvent = {
  type: "TeamCancel"
  teamId: string
  reason: string
  cancelledTasks: string[]
  timestamp: number
}
```

### 6.2 典型事件流

#### 场景 1: 成功执行

```
1. TeamCreate
   └─> 创建团队，注册 6.2 典型事件流

#### 场景 1: 成功执行

```
1. TeamCreate
   └─> 创建团队，注册预算跟踪

2. SubagentStart (planner)
   └─> 规划代理启动

3. SubagentStop (planner, completed)
   └─> 规划完成，输出任务分解

4. SubagentStart (fixer)
   └─> 修复代理启动（依赖 planner 结果）

5. SubagentHandoff (planner → fixer)
   └─> 上下文移交

6. SubagentStop (fixer, completed)
   └─> 修复完成，输出补丁

7. SubagentStart (verifier)
   └─> 验证代理启动

8. SubagentStop (verifier, completed)
   └─> 验证通过

9. TeamComplete
   └─> 团队执行完成，归并结果
```

#### 场景 2: 失败与重试

```
1. TeamCreate

2. SubagentStart (fixer)

3. SubagentFail (fixer, recoverable=true)
   └─> Hook 处理器决定重试

4. SubagentStart (fixer, retry=1)

5. SubagentStop (fixer, completed)
   └─> 重试成功

6. TeamComplete
```

#### 场景 3: 预算超限

```
1. TeamCreate

2. SubagentStart (planner)

3. SubagentBudgetExceeded (turns)
   └─> Hook 处理器记录告警

4. SubagentStop (planner, failed)

5. TeamFail
   └─> 团队执行失败
```

---

## 七、预定义角色

### 7.1 Planner Agent

```typescript
const PLANNER_AGENT = {
  role: "planner",
  description: "任务规划与分解",
  allowedTools: [
    "fs.read",
    "fs.list",
    "grep.search",
    "shell.run",
  ],
  forbiddenTools: [
    "fs.write",
    "fs.delete",
    "git.commit",
  ],
  defaultBudget: {
    maxTurns: 10,
    maxTokens: 50000,
    timeoutMs: 300000,  // 5 分钟
  },
  outputSchema: {
    taskBreakdown: "array",
    dependencies: "array",
    estimatedEffort: "string",
  },
}
```

### 7.2 Repo Reader

```typescript
const REPO_READER_AGENT = {
  role: "repo_reader",
  description: "代码库读取与理解",
  allowedTools: [
    "fs.read",
    "fs.list",
    "grep.search",
    "repo.map",
  ],
  forbiddenTools: [
    "fs.write",
    "fs.delete",
    "shell.run",
  ],
  defaultBudget: {
    maxTurns: 15,
    maxTokens: 100000,
    timeoutMs: 600000,  // 10 分钟
  },
  outputSchema: {
    repoMap: "object",
    entrypoints: "array",
    keyModules: "array",
  },
}
```

### 7.3 Code Fixer

```typescript
const CODE_FIXER_AGENT = {
  role: "code_fixer",
  description: "代码修复与实现",
  allowedTools: [
    "fs.read",
    "fs.write",
    "fs.delete",
    "grep.search",
    "shell.run",
    "git.diff",
  ],
  forbiddenTools: [
    "git.commit",
    "git.push",
  ],
  defaultBudget: {
    maxTurns: 20,
    maxTokens: 150000,
    timeoutMs: 900000,  // 15 分钟
  },
  outputSchema: {
    patches: "array",
    testResults: "array",
    changesSummary: "string",
  },
}
```

### 7.4 Code Reviewer

```typescript
const CODE_REVIEWER_AGENT = {
  role: "code_reviewer",
  description: "代码审查与风险评估",
  allowedTools: [
    "fs.read",
    "grep.search",
    "git.diff",
  ],
  forbiddenTools: [
    "fs.write",
    "fs.delete",
    "shell.run",
    "git.commit",
  ],
  defaultBudget: {
    maxTurns: 10,
    maxTokens: 80000,
    timeoutMs: 300000,  // 5 分钟
  },
  outputSchema: {
    findings: "array",
    riskLevel: "string",
    recommendations: "array",
  },
}
```

### 7.5 Verify Agent

```typescript
const VERIFY_AGENT = {
  role: "verify_agent",
  description: "测试验证与质量检查",
  allowedTools: [
    "fs.read",
    "fs.list",
    "shell.run",
    "grep.search",
  ],
  forbiddenTools: [
    "fs.write",
    "fs.delete",
    "git.commit",
  ],
  defaultBudget: {
    maxTurns: 15,
    maxTokens: 100000,
    timeoutMs: 600000,  // 10 分钟
  },
  outputSchema: {
    testResults: "array",
    coverage: "number",
    blockers: "array",
  },
}
```

### 7.6 Release Agent

```typescript
const RELEASE_AGENT = {
  role: "release_agent",
  description: "发布与部署",
  allowedTools: [
    "fs.read",
    "fs.write",
    "shell.run",
    "git.commit",
    "git.push",
  ],
  forbiddenTools: [],  // 需要高权限审批
  defaultBudget: {
    maxTurns: 10,
    maxTokens: 50000,
    timeoutMs: 300000,  // 5 分钟
  },
  outputSchema: {
    releaseNotes: "string",
    deployedVersion: "string",
    status: "string",
  },
  requiresApproval: true,  // 必须审批
}
```

---

## 八、预算与资源控制

### 8.1 TeamBudget

```typescript
class TeamBudget {
  private total: BudgetConfig
  private used: { turns: number; tokens: number; elapsedMs: number }
  private allocations: Map<string, BudgetConfig>
  
  constructor(total: BudgetConfig) {
    this.total = total
    this.used = { turns: 0, tokens: 0, elapsedMs: 0 }
    this.allocations = new Map()
  }
  
  allocate(taskId: string, budget: BudgetConfig): boolean {
    // 检查是否超出总预算
    const remaining = this.getRemaining()
    if (budget.maxTurns > remaining.turns || 
        budget.maxTokens && budget.maxTokens > remaining.tokens) {
      return false
    }
    
    this.allocations.set(taskId, budget)
    return true
  }
  
  consume(taskId: string, turns: number, tokens?: number, elapsedMs?: number): void {
    this.used.turns += turns
    if (tokens) this.used.tokens += tokens
    if (elapsedMs) this.used.elapsedMs += elapsedMs
  }
  
  getRemaining(): { turns: number; tokens: number } {
    return {
      turns: this.total.maxTurns - this.used.turns,
      tokens: (this.total.maxTokens || 0) - this.used.tokens,
    }
  }
  
  isExceeded(): boolean {
    return (
      this.used.turns >= this.total.maxTurns ||
      (this.total.maxTokens && this.used.tokens >= this.total.maxTokens) ||
      this.used.elapsedMs >= this.total.timeoutMs
    )
  }
}
```

### 8.2 预算分配策略

```typescript
// 默认分配策略：父任务预算的 70% 用于子代理，30% 预留
const DEFAULT_BUDGET_ALLOCATION = {
  childAgentsRatio: 0.7,
  reservedRatio: 0.3,
  
  // 按角色权重分配
  roleWeights: {
    planner: 1.0,
    repo_reader: 1.2,
    code_fixer: 1.5,
    code_reviewer: 1.0,
    verify_agent: 1.2,
    release_agent: 0.8,
  },
}
```

---

## 九、Task Graph 依赖管理

### 9.1 数据结构

```typescript
type TaskGraph = {
  nodes: Map<string, SubagentTask>
  edges: Map<string, string[]>  // taskId → dependsOn
  
  addNode(task: SubagentTask): void
  addEdge(from: string, to: string): void  // from depends on to
  getReadyTasks(): SubagentTask[]  // 无依赖或依赖已完成的 task
  getBlockedTasks(taskId: string): string[]  // 阻塞该 task 的任务
  isComplete(): boolean
}
```

### 9.2 调度算法

```typescript
async function scheduleTaskGraph(graph: TaskGraph): Promise<void> {
  const completed = new Set<string>()
  const running = new Map<string, Promise<SubagentResult>>()
  
  while (!graph.isComplete()) {
    // 获取可执行任务
    const readyTasks = graph.getReadyTasks()
      .filter(t => !completed.has(t.id) && !running.has(t.id))
    
    // 并发执行（限制最大并发数）
    const toRun = readyTasks.slice(0, MAX_CONCURRENT_SUBAGENTS)
    
    for (const task of toRun) {
      const promise = runner.run(task)
        .then(result => {
          completed.add(task.id)
          running.delete(task.id)
          return result
        })
        .catch(error => {
          // 失败处理
          completed.add(task.id)
          running.delete(task.id)
          throw error
        })
      
      running.set(task.id, promise)
    }
    
    // 等待至少一个完成
    if (running.size > 0) {
      await Promise.race(running.values())
    } else if (readyTasks.length === 0) {
      // 死锁检测
      throw new Error("Task graph deadlock detected")
    }
  }
}
```

---

## 十、与现有系统集成

### 10.1 ExecutionContext 集成

```typescript
// SubagentRunner 使用统一的 ExecutionContext
class SubagentRunner implements ISubagentRunner {
  constructor(
    private executionContext: ExecutionContext,
    private hookBus: IHookBus,
    private permissionEngine: IPermissionEngine,
  ) {}
  
  async run(task: SubagentTask): Promise<SubagentResult> {
    // 创建子执行上下文
    const childContext = this.executionContext.createChild({
      taskId: task.id,
      allowedTools: task.allowedTools,
      forbiddenTools: task.forbiddenTools,
      worktree: task.worktree,
      budget: task.budget,
    })
    
    // 注入 HookBus
    childContext.setHookBus(this.hookBus)
    
    // 执行
    return await this.executeWithTracking(task, childContext)
  }
}
```

### 10.2 HookBus 集成

```typescript
// 在 TeamOrchestrator 中注册 Hook 处理器
class TeamOrchestrator implements ITeamOrchestrator {
  constructor(private hookBus: IHookBus) {
    // 注册事件处理器
    this.hookBus.on("SubagentBudgetExceeded", this.handleBudgetExceeded.bind(this))
    this.hookBus.on("SubagentFail", this.handleSubagentFail.bind(this))
    this.hookBus.on("TeamFail", this.handleTeamFail.bind(this))
  }
  
  private async handleBudgetExceeded(event: SubagentBudgetExceededEvent): Promise<void> {
    // 记录日志
    logger.warn(`Budget exceeded: ${event.taskId} (${event.budgetType})`)
    
    // 可选：发送通知
    await this.notifyUser(`子代理 ${event.taskId} 预算超限`)
  }
  
  private async handleSubagentFail(event: SubagentFailEvent): Promise<void> {
    // 判断是否重试
    if (event.recoverable) {
      // 触发重试逻辑
      await this.retrySubagent(event.taskId)
    }
  }
}
```

### 10.3 TaskStore 集成

```typescript
// 子任务持久化
class TaskStore {
  async saveSubagentTask(task: SubagentTask): Promise<void> {
    await this.db.subagentTasks.insert({
      ...task,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }
  
  async updateSubagentStatus(
    taskId: string,
    status: SubagentStatus,
    error?: string
  ): Promise<void> {
    await this.db.subagentTasks.update(taskId, {
      status,
      lastError: error,
      updatedAt: new Date(),
      ...(status === "running" ? { startedAt: new Date() } : {}),
      ...(status === "done" || status === "failed" || status === "cancelled"
        ? { completedAt: new Date() }
        : {}),
    })
  }
  
  async getSubagentResult(taskId: string): Promise<SubagentResult | null> {
    return await this.db.subagentResults.findOne({ taskId })
  }
}
```

---

## 十一、第一版范围（MVP）

### 11.1 必须实现

- [x] `SubagentTask` / `SubagentResult` 类型定义
- [x] `TeamOrchestrator` 基础接口
- [x] `SubagentRunner` 最小实现
- [x] `DelegationPolicy` 基础规则
- [x] HookBus 6 个事件注册
- [x] 3 个预定义角色 (planner / fixer / verifier)
- [x] 预算跟踪 (turns 级别)
- [x] Task Graph 依赖管理（基础版）

### 11.2 第一版不做

- [ ] 复杂预算分配（tokens 精确跟踪）
- [ ] LSP 集成
- [ ] 自由对话式多代理群聊
- [ ] 高级冲突解决
- [ ] 可视化调试工具
- [ ] 性能优化（并发限制/缓存）

### 11.3 验收标准

1. **端到端验证**：主代理创建团队 → 3 个子代理顺序执行 → 结果归并
2. **Hook 事件**：6 个事件全部可触发、可捕获、可审计
3. **预算约束**：子代理超时/超限可正确终止
4. **依赖管理**：dependsOn 正确阻塞执行
5. **结果归并**：patches/findings/summary 正确合并

---

## 十二、后续扩展

### 12.1 Phase 2（Sprint 2-3）

- Code Intelligence Layer 集成
- MCP Server 接入
- LSP Bridge
- 更精细的预算控制

### 12.2 Phase 3（Sprint 4-5）

- Skill Package 系统
- Hook Automation Rules
- Output Styles
- 可视化 Dashboard

---

## 十三、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 子代理并发失控 | 资源耗尽 | 严格并发限制 + 预算跟踪 |
| 依赖死锁 | 任务卡死 | 死锁检测 + 超时终止 |
| 结果冲突 | 补丁合并失败 | 冲突检测 + 手动解决 |
| 上下文爆炸 | token 超限 | 上下文压缩 + 分页传递 |
| 权限逃逸 | 安全风险 | 严格工具白名单 + 审批 |

---

**下一步**: 开始实现 `src/agents/` 目录结构和核心模块。
