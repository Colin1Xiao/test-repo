# OpenClaw Runtime Core

Agent Runtime OS 核心模块 - 阶段 1 骨架

## 已创建文件

| 文件 | 行数 | 状态 |
|------|------|------|
| `build_skill.ts` | ~150 | ✅ 骨架完成 |
| `execution_context.ts` | ~180 | ✅ 骨架完成 |
| `permission_engine.ts` | ~200 | ✅ 骨架完成 |
| `permission_types.ts` | ~120 | ✅ 骨架完成 |
| `query_guard.ts` | ~100 | ✅ 骨架完成 |
| `task_model.ts` | ~130 | ✅ 骨架完成 |
| `task_store.ts` | ~200 | ✅ 骨架完成 |
| `hook_types.ts` | ~120 | ✅ 骨架完成 |
| `hook_bus.ts` | ~150 | ✅ 骨架完成 |
| `index.ts` | ~80 | ✅ 骨架完成 |

**总计**: ~1,430 行 TypeScript 代码

---

## 核心能力

### 1. buildSkill - 统一技能工厂

所有 skill/tool 通过统一工厂定义，确保：
- 统一生命周期
- 统一权限逻辑
- 统一日志和 telemetry
- 统一中断与恢复

```typescript
import { buildSkill } from './build_skill';

export const readFileSkill = buildSkill({
  name: 'fs.read',
  description: 'Read file from workspace',
  category: 'fs',
  inputSchema: z.object({ path: z.string() }),
  policy: {
    readOnly: true,
    requiresApproval: false,
    timeoutMs: 10_000,
  },
  async handler(ctx, input) {
    return await ctx.fs.readFile(input.path);
  },
});
```

### 2. ExecutionContext - 统一执行上下文

工具不是孤立函数，而是在完整运行时上下文里执行。

```typescript
const ctx = createExecutionContext({
  sessionId: 'session_1',
  turnId: 'turn_1',
  agentId: 'main',
  workspaceRoot: '/workspace',
  cwd: '/workspace',
  logger,
  emit: hookBus.emit,
  state,
  permissions: engine,
  tasks: taskStore,
  memory,
  fs,
  exec,
  requestApproval,
  appendSystemNote,
});
```

### 3. PermissionEngine - 权限规则引擎

从"开关"升级为"规则引擎"：
- 多级结果：allow / deny / ask
- 多来源合并：system / agent / workspace / session
- 决策原因解释
- 危险命令检测

```typescript
const engine = new PermissionEngine([
  {
    source: 'workspace',
    behavior: 'allow',
    tool: 'exec.run',
    pattern: 'npm *',
    reason: 'NPM commands allowed',
  },
]);

const decision = engine.evaluate({
  tool: 'exec.run',
  target: 'npm install',
});
// decision.explanation: "Allowed by workspace rule: NPM commands allowed"
```

### 4. QueryGuard - 轮次状态机

防止 session 并发乱套：
- idle → dispatching → running → idle
- 防止 Telegram 多消息并发
- 防止 cancel 后 stale finally 清理

```typescript
const guard = new QueryGuard();

if (!guard.reserve()) {
  return; // 上一轮还在执行
}

const gen = guard.tryStart();
if (gen === null) {
  return; // 已经在运行
}

try {
  await processMessage();
  guard.end(gen);
} catch (e) {
  guard.forceEnd();
  throw e;
}
```

### 5. TaskStore - 任务存储

把任务提升为一等对象：
- 任务 ID 规范（类型前缀）
- 状态追踪
- 输出日志
- 恢复点

```typescript
const taskStore = new TaskStore({ persistPath: './tasks.json' });

const task = taskStore.create({
  type: 'exec',
  sessionId: 'session_1',
  agentId: 'main',
  workspaceRoot: '/workspace',
  description: 'Run npm install',
});

// 更新状态
taskStore.update(task.id, { status: 'running' });

// 追加输出
taskStore.appendOutput(task.id, 'Installing...\n');

// 列出任务
const tasks = taskStore.list({ statusIn: ['running', 'queued'] });
```

### 6. HookBus - 事件总线

把智能行为改成事件驱动：
- before/after tool
- approval requested/resolved
- task created/completed
- session start/end

```typescript
// 工具执行后自动审计
hookBus.on('tool.after', async (event) => {
  await fs.appendFile('audit.log', JSON.stringify(event) + '\n');
});

// 审批请求时推送 Telegram
hookBus.on('approval.requested', async (event) => {
  await telegram.send(`🔐 审批请求：${event.summary}`);
});
```

---

## 下一步：技能迁移

### 首批迁移的技能（6 个）

1. `fs.read` - 文件读取
2. `fs.write` - 文件写入
3. `exec.run` - 命令执行
4. `grep.search` - 搜索
5. `task.list` - 任务列表
6. `task.output` - 任务输出

### 迁移步骤

1. 用 `buildSkill` 重新定义每个技能
2. 注入 `ExecutionContext`
3. 通过 `PermissionEngine` 检查权限
4. 通过 `HookBus` 发送事件
5. 更新 `TaskStore` 状态

---

## 验收标准

- [ ] 所有新技能统一通过 `buildSkill`
- [ ] 所有执行都收到统一上下文
- [ ] 高风险 exec 有明确决策解释
- [ ] session 不并发乱套
- [ ] 任务有 ID / 状态 / 输出日志

---

## 技术栈

- **语言**: TypeScript
- **目标**: ES2020+
- **模块**: ESM
- **依赖**: 无外部依赖（纯 TypeScript）

---

## 文件位置

```
~/.openclaw/workspace/core/runtime/
├── build_skill.ts          # 技能工厂
├── execution_context.ts    # 执行上下文
├── permission_engine.ts    # 权限引擎
├── permission_types.ts     # 权限类型
├── query_guard.ts          # 状态机
├── task_model.ts           # 任务模型
├── task_store.ts           # 任务存储
├── hook_types.ts           # Hook 类型
├── hook_bus.ts             # Hook 总线
├── index.ts                # 导出
└── README.md               # 本文档
```

---

**版本**: 0.1.0  
**日期**: 2026-04-03  
**状态**: 阶段 1 骨架完成
