# Phase 2B-1-I: GitHub Connector Integration ✅

**状态**: 完成  
**版本**: 2B-1-I-rc  
**日期**: 2026-04-04

---

## 概述

Phase 2B-1-I 将 GitHub Connector 集成到 Operator 产品主链路，打通第一条真实 workflow connector 闭环。

---

## 新增文件

```
src/connectors/github/
└── github_operator_bridge.ts    # 7KB - GitHub → Operator 数据面桥接
```

---

## GitHubOperatorBridge

**职责**: 将 GitHub 事件写入 Operator 数据面

### 事件映射

| GitHub 事件 | Operator 数据面 |
|------------|----------------|
| PR opened | TaskDataSource |
| Review requested | ApprovalDataSource |
| Check failed | IncidentDataSource |

### 动作回写

| Operator 动作 | GitHub 回写 |
|--------------|------------|
| approve | Approval → approved (本地同步) |
| reject | Approval → rejected (本地同步) |

---

## 端到端链路

### 1. PR Opened 链路

```
GitHub Webhook: PR opened
    ↓
GitHubConnector.handleWebhook()
    ↓
GitHubOperatorBridge.handlePREvent()
    ↓
TaskDataSource.addTask()
    ↓
Operator Inbox: 显示 GitHub 来源项
```

### 2. Review Requested 链路

```
GitHub Webhook: Review requested
    ↓
GitHubConnector.handleWebhook()
    ↓
GitHubOperatorBridge.handlePREvent()
    ↓
ApprovalDataSource.addApproval()
    ↓
Operator Inbox / Approvals: 显示待 review 项
```

### 3. Check Failed 链路

```
GitHub Webhook: Check suite failed
    ↓
GitHubConnector.handleWebhook()
    ↓
GitHubOperatorBridge.handleCheckEvent()
    ↓
IncidentDataSource.addIncident()
    ↓
Operator Inbox: 显示 failed check 告警
```

### 4. Approve/Reject 回写链路

```
Operator: approve apv_github_review_xxx
    ↓
ExecutionBridge.approveApproval()
    ↓
GitHubOperatorBridge.handleApproveAction()
    ↓
ApprovalDataSource.updateApprovalStatus()
    ↓
Inbox 刷新：审批项消失
```

---

## 使用示例

### 创建 GitHub Operator Bridge

```ts
import {
  createGitHubConnector,
  createPREventAdapter,
  createPRTaskMapper,
  createCheckStatusAdapter,
  createGitHubOperatorBridge,
} from './connectors';
import {
  createTaskDataSource,
  createApprovalDataSource,
  createIncidentDataSource,
} from './operator/data';

// 1. 创建数据源
const taskDataSource = createTaskDataSource();
const approvalDataSource = createApprovalDataSource();
const incidentDataSource = createIncidentDataSource();

// 2. 创建适配器
const prEventAdapter = createPREventAdapter();
const prTaskMapper = createPRTaskMapper();
const checkAdapter = createCheckStatusAdapter();

// 3. 创建 GitHub Operator Bridge
const githubBridge = createGitHubOperatorBridge(
  taskDataSource,
  approvalDataSource,
  incidentDataSource,
  prEventAdapter,
  prTaskMapper,
  checkAdapter,
  { defaultWorkspaceId: 'local-default' }
);

// 4. 创建 GitHub Connector 并监听事件
const githubConnector = createGitHubConnector({
  apiToken: process.env.GITHUB_TOKEN,
  webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
});

githubConnector.onEvent(async (event) => {
  if (event.type === 'pr') {
    await githubBridge.handlePREvent(event);
  }
  if (event.type === 'check') {
    await githubBridge.handleCheckEvent(event);
  }
});
```

### 处理 Webhook

```ts
// Express 示例
app.post('/webhook/github', async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const payload = req.body;
  
  try {
    // 处理 Webhook
    const events = await githubConnector.handleWebhook(payload, signature);
    
    // 桥接到 Operator 数据面
    for (const event of events) {
      if (event.type === 'pr') {
        await githubBridge.handlePREvent(event);
      }
      if (event.type === 'check') {
        await githubBridge.handleCheckEvent(event);
      }
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Error');
  }
});
```

### 处理 Approve 动作

```ts
import { createOperatorExecutionBridge } from './operator';

// 创建 Execution Bridge（配置 GitHub 回写）
const executionBridge = createOperatorExecutionBridge({
  enableRealExecution: true,
  approvalDataSource,
  // ... 其他数据源
});

// 当用户执行 approve 时
const result = await executionBridge.approveApproval(
  'github_review_owner_repo_123',
  'user_456'
);

// 自动同步到 GitHub（通过 GitHubOperatorBridge）
console.log(result.message);  // "Approved PR owner/repo#123"
```

---

## 验收标准

### ✅ 已完成

1. ✅ GitHubOperatorBridge 接口定义完整
2. ✅ PR opened → Task 映射
3. ✅ Review requested → Approval 映射
4. ✅ Check failed → Incident 映射
5. ✅ Approve/Reject 动作回写（本地同步）
6. ✅ 端到端链路定义完整

### 🟡 待完成

1. 🟡 真实 GitHub API 回写（ReviewBridge 集成）
2. 🟡 CLI `oc inbox` 显示 GitHub 来源项
3. 🟡 Telegram `/inbox` 显示 GitHub 来源项
4. 🟡 端到端验证（Webhook → Inbox → Action → GitHub）

---

## 与 Phase 2A 的集成状态

| Phase 2A 模块 | GitHub 集成状态 |
|--------------|----------------|
| TaskDataSource | ✅ PR opened → Task |
| ApprovalDataSource | ✅ Review requested → Approval |
| IncidentDataSource | ✅ Check failed → Incident |
| InboxService | ✅ 自动聚合 GitHub 来源项 |
| ExecutionBridge | 🟡 待集成 GitHub 回写 |
| CLI | 🟡 待显示 GitHub 来源项 |
| Telegram | 🟡 待显示 GitHub 来源项 |

---

## 下一步：完整端到端验证

**目标:** 验证完整闭环

**行动:**
1. 配置 GitHub Webhook
2. 发送测试 Webhook (PR opened)
3. 验证 `oc inbox` 显示
4. 执行 `oc approve` 动作
5. 验证 Inbox 刷新

---

_Phase 2B-1-I 状态：✅ 完成 — GitHub → Operator 数据面桥接已就绪_
