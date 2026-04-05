# Agent Teams / Subagents - MVP 实现

**版本**: v0.1.0  
**日期**: 2026-04-03  
**状态**: ✅ MVP 完成

---

## 已完成文件

### 核心模块（6 个）

| 文件 | 行数 | 功能 |
|------|------|------|
| `types.ts` | ~270 行 | 核心类型定义 + 接口 + 角色默认配置 |
| `state_machine.ts` | ~280 行 | 状态机 + 转换守卫 + 便捷方法 |
| `subagent_runner.ts` | ~330 行 | 子代理执行器 + Hook 触发 |
| `team_orchestrator.ts` | ~380 行 | 团队编排器 + 调度逻辑 |
| `delegation_policy.ts` | ~180 行 | 任务拆分策略 + 预算分配 |
| `hooks.ts` | ~270 行 | HookBus 实现 + 内置处理器 |
| `index.ts` | ~110 行 | 统一导出 |

**总计**: ~1820 行代码

### 测试文件

| 文件 | 功能 |
|------|------|
| `team_orchestrator.test.ts` | 6 个测试用例（创建/调度/归并/取消/端到端） |

---

## 核心能力

### ✅ 已实现

1. **团队创建**
   - 支持多角色配置
   - 支持依赖关系定义
   - 预算分配

2. **任务调度**
   - 依赖感知的执行顺序
   - 串行 / 简单 fan-out 支持
   - 死锁检测

3. **状态管理**
   - 完整状态机（9 个子状态 + 4 个团队状态）
   - 合法转换守卫
   - 终态保护

4. **预算控制**
   - turns / tokens / timeout 跟踪
   - 超限终止
   - 70/30 分配策略

5. **Hook 集成**
   - 10 个事件类型
   - 日志 / 审计 / 通知处理器
   - 异步触发

6. **结果归并**
   - artifacts / patches / findings 合并
   - 置信度计算
   - 摘要生成

---

## 使用示例

### 最小示例

```typescript
import { runTeam } from "./src/agents";

const { context, results, merged } = await runTeam({
  parentTaskId: "task_123",
  sessionId: "session_456",
  goal: "读取代码库并生成报告",
  agents: [
    {
      role: "repo_reader",
      goal: "分析项目结构",
      allowedTools: ["fs.read", "fs.list"],
      budget: { maxTurns: 15, timeoutMs: 120000 },
    },
    {
      role: "code_reviewer",
      goal: "审查代码质量",
      allowedTools: ["fs.read", "git.diff"],
      budget: { maxTurns: 10, timeoutMs: 60000 },
    },
  ],
  totalBudget: {
    maxTurns: 30,
    timeoutMs: 300000,
  },
});

console.log(merged.summary);
```

### 带依赖的示例

```typescript
import { TeamOrchestrator, SubagentRunner, AgentTeamHookBus } from "./src/agents";

const hookBus = new AgentTeamHookBus();
const runner = new SubagentRunner(hookBus);
const orchestrator = new TeamOrchestrator(runner, hookBus);

// 创建团队
const context = await orchestrator.createTeam({
  parentTaskId: "task_123",
  sessionId: "session_456",
  goal: "修复 bug 并验证",
  agents: [
    {
      role: "planner",
      goal: "分析 bug 并制定修复计划",
      allowedTools: ["fs.read", "grep.search"],
      budget: { maxTurns: 10, timeoutMs: 60000 },
    },
    {
      role: "code_fixer",
      goal: "实现修复",
      allowedTools: ["fs.read", "fs.write"],
      budget: { maxTurns: 20, timeoutMs: 120000 },
      dependsOn: ["planner"],  // 依赖 planner 完成
    },
    {
      role: "verify_agent",
      goal: "运行测试验证",
      allowedTools: ["shell.run"],
      budget: { maxTurns: 15, timeoutMs: 90000 },
      dependsOn: ["code_fixer"],  // 依赖 fixer 完成
    },
  ],
  totalBudget: { maxTurns: 50, timeoutMs: 300000 },
});

// 等待完成
const results = await orchestrator.waitForCompletion(context.teamId);

// 归并结果
const merged = await orchestrator.mergeResults(results);

console.log(merged.summary);
```

### 带 Hook 处理器的示例

```typescript
import { AgentTeamHookBus, createLoggingHandler } from "./src/agents";

const hookBus = new AgentTeamHookBus();

// 注册日志处理器
hookBus.on("SubagentStart", createLoggingHandler());
hookBus.on("SubagentStop", createLoggingHandler());
hookBus.on("TeamComplete", createLoggingHandler());

// 注册失败通知处理器
hookBus.on("SubagentFail", async (event) => {
  console.error(`子代理失败：${event.taskId}`, event.error);
});

// 使用 hookBus 创建 runner 和 orchestrator
const runner = new SubagentRunner(hookBus);
const orchestrator = new TeamOrchestrator(runner, hookBus);
```

---

## 预定义角色

| 角色 | 用途 | 默认工具 | 默认预算 |
|------|------|----------|----------|
| `planner` | 任务规划 | fs.read, grep | 10 turns / 5 分钟 |
| `repo_reader` | 代码读取 | fs.read, repo.map | 15 turns / 10 分钟 |
| `code_fixer` | 代码修复 | fs.write, git.diff | 20 turns / 15 分钟 |
| `code_reviewer` | 代码审查 | fs.read, git.diff | 10 turns / 5 分钟 |
| `verify_agent` | 验证测试 | shell.run, grep | 15 turns / 10 分钟 |
| `release_agent` | 发布部署 | git.commit, git.push | 10 turns / 5 分钟 |

---

## Hook 事件

### 子代理事件（6 个）

- `SubagentStart` - 子代理启动
- `SubagentStop` - 子代理停止
- `SubagentFail` - 子代理失败
- `SubagentTimeout` - 子代理超时
- `SubagentBudgetExceeded` - 预算超限
- `SubagentHandoff` - 上下文移交

### 团队事件（5 个）

- `TeamCreate` - 团队创建
- `TeamComplete` - 团队完成
- `TeamFail` - 团队失败
- `TeamCancel` - 团队取消
- `TeamMerge` - 结果归并

---

## 状态机

### 子代理状态

```
queued → running → done
              ├→ failed (可重试 → queued)
              ├→ timeout (可重试 → queued)
              ├→ budget_exceeded (终态)
              └→ cancelled (终态)
```

### 团队状态

```
active → completed
       ├→ failed
       └→ cancelled
```

---

## 下一步（Sprint 1 后续）

### 待完成

- [ ] 真实模型调用（替换 mock 执行）
- [ ] roles/ 目录实现（planner / fixer / verifier）
- [ ] 与 OpenClaw 现有 ExecutionContext 集成
- [ ] 与 TaskStore 集成（持久化）
- [ ] 更复杂的依赖图（DAG 调度）
- [ ] 并发限制配置

### 测试增强

- [ ] state_machine.test.ts
- [ ] subagent_runner.test.ts
- [ ] delegation_policy.test.ts
- [ ] hooks.test.ts

---

## 验收标准（MVP）

- [x] 能创建 SubagentTask
- [x] 能进入状态机
- [x] 能由 orchestrator 调度
- [x] 能由 runner 执行
- [x] 能产出 SubagentResult
- [x] 能触发 hooks
- [x] 能最终汇总回主任务

**状态**: ✅ **MVP 第一条链路已打通**

---

## 文件结构

```
src/agents/
├── types.ts                 # 核心类型定义
├── state_machine.ts         # 状态机
├── subagent_runner.ts       # 执行器
├── team_orchestrator.ts     # 编排器
├── delegation_policy.ts     # 策略
├── hooks.ts                 # HookBus
├── index.ts                 # 统一导出
├── team_orchestrator.test.ts # 测试
└── README.md                # 本文档
```

---

_第一条通路已通，后续扩展只是加法。_
