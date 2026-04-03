# Phase 2B-1: GitHub / PR Connector MVP ✅

**状态**: 完成  
**版本**: 2B-1-rc  
**日期**: 2026-04-04

---

## 概述

Phase 2B-1 实现了 GitHub / PR Connector MVP，将 GitHub PR 事件接入 OpenClaw 的 Task / Approval / Inbox / Dashboard / HITL 链路。

---

## 新增文件

```
src/connectors/
├── index.ts                          # 统一导出
├── github/
│   ├── index.ts                      # GitHub 模块导出
│   ├── github_types.ts               # 类型定义 (4KB)
│   ├── github_connector.ts           # GitHub 连接器 (7KB)
│   ├── pr_event_adapter.ts           # PR 事件适配器 (6KB)
│   ├── pr_task_mapper.ts             # PR 任务映射器 (4KB)
│   ├── review_bridge.ts              # Review 桥接 (4KB)
│   └── check_status_adapter.ts       # Check 状态适配器 (4KB)
└── policy/
    └── connector_policy.ts           # 连接器策略 (5KB)
```

---

## 核心模块

### 1. GitHubConnector

**职责**: 接收 GitHub Webhook 事件 / 轮询 GitHub API

**支持事件**:
- PR opened / reopened / synchronize
- Review requested
- Check suite / Check run

**MVP 功能**:
- ✅ Webhook 事件处理
- ✅ 签名验证（可配置）
- ✅ 事件监听器
- 🟡 API 轮询（预留接口）

---

### 2. PREventAdapter

**职责**: 将 GitHub PR 事件转换为内部标准事件

**映射规则**:

| GitHub 事件 | 映射到 |
|------------|--------|
| PR opened | Task + Inbox Item |
| Review requested | Approval |
| PR reopened | Inbox Item |
| Check failed | Attention / Incident |

**配置选项**:
```ts
createPREventAdapter({
  autoCreateTask: true,        // 自动创建 Task
  autoCreateApproval: true,    // 自动创建 Approval
  autoCreateAttention: true,   // 自动创建 Attention
  defaultPriority: 'medium',
})
```

---

### 3. PRTaskMapper

**职责**: 将 PR 映射到 Operator Task

**优先级规则**:
- 根据 Label 调整优先级（`critical` → critical, `bug` → high）
- 默认优先级：medium

**状态映射**:
- PR opened → task (active)
- PR closed/merged → task (completed)
- Check failed → task (blocked)

---

### 4. ReviewBridge

**职责**: 将 Operator 动作回写到 GitHub PR Review

**支持动作**:
- `approve` → APPROVE review
- `reject` → REQUEST_CHANGES review
- `merge` → merge PR

**配置选项**:
```ts
createReviewBridge(githubConnector, {
  defaultReviewBody: 'Approved via OpenClaw Operator',
  defaultMergeMethod: 'squash',
  requireApprovalBeforeMerge: true,
})
```

---

### 5. CheckStatusAdapter

**职责**: 将 GitHub Check 状态映射到 Operator 语义

**状态映射**:

| Check 状态 | Operator 语义 |
|------------|--------------|
| completed + success | success |
| completed + failure | failure → incident |
| in_progress | running |
| queued | queued |

**配置选项**:
```ts
createCheckStatusAdapter({
  autoCreateAttention: true,
  failedCheckSeverity: 'high',
  ignoreCheckPatterns: ['^dependabot/'],
})
```

---

### 6. ConnectorPolicy

**职责**: 定义连接器信任级别和动作范围

**信任级别**:
- `full` - 完全信任，可执行所有动作
- `limited` - 有限信任，只读 + 部分写动作
- `readonly` - 只读
- `untrusted` - 不信任，需要人工确认

**预定义策略**:
- `GITHUB_CONNECTOR_POLICY` - GitHub 默认策略
- `CICD_CONNECTOR_POLICY` - CI/CD 预留策略
- `ALERT_CONNECTOR_POLICY` - Alert 预留策略

---

## 事件映射表

### PR Opened

```
GitHub: PR opened
    ↓
PREventAdapter
    ↓
MappedTask: github_pr_owner_repo_123
MappedInboxItem: PR #123: title
    ↓
Operator:
- Task created
- Inbox item added
- Dashboard updated
```

### Review Requested

```
GitHub: Review requested
    ↓
PREventAdapter
    ↓
MappedApproval: github_review_owner_repo_123
    ↓
Operator:
- Approval created
- Inbox item added (severity: medium)
- Available actions: approve / reject / escalate
```

### Check Failed

```
GitHub: Check suite failed
    ↓
CheckStatusAdapter
    ↓
MappedInboxItem: Check Failed: repo/branch
    ↓
Operator:
- Incident created (severity: high)
- Inbox item added
- Available actions: open / request_replay
```

---

## 使用示例

### 创建 GitHub Connector

```ts
import {
  createGitHubConnector,
  createPREventAdapter,
  createPRTaskMapper,
  createReviewBridge,
  createCheckStatusAdapter,
  createConnectorPolicyManager,
} from './connectors';

// 1. 创建 GitHub Connector
const githubConnector = createGitHubConnector({
  apiToken: process.env.GITHUB_TOKEN,
  webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
  enablePolling: true,
  pollingIntervalMs: 60000,
  repositories: ['owner/repo1', 'owner/repo2'],
});

// 2. 创建事件适配器
const prEventAdapter = createPREventAdapter({
  autoCreateTask: true,
  autoCreateApproval: true,
  autoCreateAttention: true,
});

// 3. 创建任务映射器
const prTaskMapper = createPRTaskMapper({
  defaultPriority: 'medium',
  priorityByLabel: {
    'critical': 'critical',
    'bug': 'high',
  },
});

// 4. 创建 Review Bridge
const reviewBridge = createReviewBridge(githubConnector, {
  defaultReviewBody: 'Approved via OpenClaw',
  defaultMergeMethod: 'squash',
});

// 5. 创建 Check 状态适配器
const checkAdapter = createCheckStatusAdapter({
  autoCreateAttention: true,
  failedCheckSeverity: 'high',
});

// 6. 创建策略管理器
const policyManager = createConnectorPolicyManager();
```

### 处理 Webhook 事件

```ts
// 监听 GitHub 事件
githubConnector.onEvent(async (event) => {
  if (event.type === 'pr') {
    const { task, approval, inboxItem } = prEventAdapter.adaptPREvent(event);
    
    if (task) {
      // 创建 Task
      await taskDataSource.addTask(task);
    }
    
    if (approval) {
      // 创建 Approval
      await approvalDataSource.addApproval(approval);
    }
    
    if (inboxItem) {
      // 添加到 Inbox
      // ...
    }
  }
  
  if (event.type === 'check') {
    const { inboxItem, status } = checkAdapter.adaptCheckEvent(event);
    
    if (inboxItem) {
      // 添加到 Inbox (failed check)
      // ...
    }
  }
});

// 处理 Webhook
app.post('/webhook/github', async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const payload = req.body;
  
  const events = await githubConnector.handleWebhook(payload, signature);
  
  res.status(200).send('OK');
});
```

### 执行 PR Review 动作

```ts
// Approve PR
const result = await reviewBridge.handleApprove(
  'owner',
  'repo',
  123,
  'user_456'
);

console.log(result.message);  // "Approved PR owner/repo#123"

// Reject PR
const rejectResult = await reviewBridge.handleReject(
  'owner',
  'repo',
  123,
  'user_456',
  'Needs more tests'
);

// Merge PR
const mergeResult = await reviewBridge.handleMerge(
  'owner',
  'repo',
  123,
  'user_456'
);
```

---

## 验收标准

### ✅ 已完成

1. ✅ GitHubConnector 接口定义完整
2. ✅ Webhook 事件处理
3. ✅ PR Event Adapter 映射逻辑
4. ✅ PR Task Mapper 优先级规则
5. ✅ Review Bridge 回写逻辑
6. ✅ Check Status Adapter 状态映射
7. ✅ Connector Policy 策略定义

### 🟡 待完成

1. 🟡 GitHub API 轮询实现
2. 🟡 集成到 OperatorSurfaceService
3. 🟡 CLI `oc github prs` 命令
4. 🟡 Telegram `/github` 命令
5. 🟡 端到端验证（Webhook → Inbox → Action → GitHub）

---

## 下一步：2B-1-I

**目标:** 将 GitHub Connector 集成到产品主链路

**行动:**
1. 集成到 `OperatorSurfaceService` - 显示 GitHub 来源的 inbox items
2. CLI `oc github prs` - 查看待处理 PR
3. Telegram `/github` - GitHub 通知
4. 端到端验证：Webhook → Inbox → Approve → GitHub Review

---

## 与 Phase 2A 的集成点

### Task 集成
- PR opened → Task created
- Task metadata.source = 'github'

### Approval 集成
- Review requested → Approval created
- Approval metadata.source = 'github'

### Inbox 集成
- PR/Check 事件 → InboxItem created
- InboxItem severity 根据事件类型计算

### Dashboard 集成
- GitHub 来源项计入摘要
- PR/Check 状态显示

---

_Phase 2B-1 状态：✅ 完成 — GitHub / PR Connector MVP 已就绪_
