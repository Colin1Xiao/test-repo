# Phase 2B-2: GitHub Actions Connector MVP ✅

**状态**: 完成  
**版本**: 2B-2-rc  
**日期**: 2026-04-04

---

## 概述

Phase 2B-2 实现了 GitHub Actions Connector MVP，将 GitHub Actions 事件（Workflow Run / Deployment / Check Run）接入 OpenClaw 的 Task / Approval / Incident / Inbox 链路。

---

## 新增文件

```
src/connectors/github/shared/
├── github_api_client.ts           # 4KB - GitHub API 客户端
└── github_webhook_verifier.ts     # 2KB - Webhook 签名验证

src/connectors/github-actions/
├── github_actions_types.ts        # 6KB - 类型定义
├── github_actions_connector.ts    # 6KB - Connector
├── workflow_event_adapter.ts      # 7KB - 事件适配器
├── deployment_approval_bridge.ts  # 4KB - 部署审批桥接
├── github_actions_operator_bridge.ts # 6KB - 数据面桥接
├── job_status_adapter.ts          # 3KB - Job 状态适配器
└── index.ts                       # 3KB - 统一导出
```

---

## 核心模块

### 1. GitHubApiClient (共享)

**职责**: 统一 GitHub API 调用

**功能:**
- GET / POST / PUT / PATCH / DELETE 请求
- Token 认证
- 超时控制
- 错误处理

**使用示例:**
```ts
const apiClient = new GitHubApiClient({
  token: process.env.GITHUB_TOKEN,
});

await apiClient.post('/repos/owner/repo/actions/runs/123/rerun');
```

---

### 2. GitHubWebhookVerifier (共享)

**职责**: Webhook 签名验证

**功能:**
- HMAC-SHA256 签名验证
- 安全比较（防止时序攻击）
- Payload 解析

**使用示例:**
```ts
const verifier = new GitHubWebhookVerifier({
  secret: process.env.GITHUB_WEBHOOK_SECRET,
});

const isValid = verifier.verify(payload, signature);
const parsed = verifier.parsePayload(payload);
```

---

### 3. GitHubActionsConnector

**职责**: 接收 GitHub Actions Webhook + 调用 API

**支持事件:**
- `workflow_run` - Workflow 运行
- `deployment` - 部署请求
- `deployment_status` - 部署状态
- `check_run` - Check 运行

**支持动作:**
- `rerunWorkflow` - 重跑 Workflow
- `cancelWorkflow` - 取消 Workflow
- `approveDeployment` - 批准部署
- `rejectDeployment` - 拒绝部署

---

### 4. WorkflowEventAdapter

**职责**: 将 GitHub Actions 事件转换为内部标准事件

**MVP 映射规则:**

| GitHub Actions 事件 | 映射到 | 严重级别 |
|---------------------|--------|----------|
| `workflow_run completed` (failure) | Incident + Attention | high |
| `deployment` (production/staging) | Approval | high |
| `deployment` (其他环境) | Inbox Item | medium |
| `deployment_status` (failure) | Attention | critical |
| `check_run completed` (failure) | Attention | medium |

**配置选项:**
```ts
createWorkflowEventAdapter({
  autoCreateIncident: true,
  autoCreateApproval: true,
  autoCreateAttention: true,
  failureSeverity: 'high',
  ignoreWorkflows: ['ci-test', 'lint'],
  requireApprovalForEnvironments: ['production', 'staging'],
});
```

---

### 5. DeploymentApprovalBridge

**职责**: 将 Operator Approval 动作回写到 GitHub Deployment

**支持动作:**
- `approve` → GitHub Deployment 批准
- `reject` → GitHub Deployment 拒绝

**配置选项:**
```ts
createDeploymentApprovalBridge(githubConnector, {
  defaultApprovalComment: 'Approved via OpenClaw Operator',
  autoApproveStaging: false,
});
```

---

### 6. GitHubActionsOperatorBridge

**职责**: 将 GitHub Actions 事件写入 Operator 数据面

**映射逻辑:**
```ts
// workflow_run failed → Incident
async handleWorkflowRunEvent(event): Promise<{ incidentCreated?: boolean }>

// deployment → Approval
async handleDeploymentEvent(event): Promise<{ approvalCreated?: boolean }>

// deployment_status failed → Attention
async handleDeploymentStatusEvent(event): Promise<{ inboxItemCreated?: boolean }>
```

**动作回写:**
```ts
// Approve Deployment
async handleApproveAction(sourceId, actorId): Promise<{ success, message }>

// Reject Deployment
async handleRejectAction(sourceId, actorId, reason): Promise<{ success, message }>
```

---

### 7. JobStatusAdapter (轻量版)

**职责**: 将 failed check/job → Attention

**映射规则:**
- `check_run completed` (failure) → Attention (severity: medium)

---

## 事件映射表

### Workflow Run

| 事件 | Action | 映射到 | 严重级别 | 建议动作 |
|------|--------|--------|----------|----------|
| `workflow_run` | `completed` (failure) | Incident + Attention | high | rerun / open |
| `workflow_run` | `completed` (success) | - | - | - |
| `workflow_run` | `in_progress` | - | - | - |

### Deployment

| 事件 | 环境 | 映射到 | 严重级别 | 建议动作 |
|------|------|--------|----------|----------|
| `deployment` | production | Approval | high | approve / reject |
| `deployment` | staging | Approval | high | approve / reject |
| `deployment` | dev | Inbox Item | medium | view |

### Deployment Status

| 事件 | State | 映射到 | 严重级别 | 建议动作 |
|------|-------|--------|----------|----------|
| `deployment_status` | `failure` | Attention | critical | open / retry |
| `deployment_status` | `success` | - | - | - |

### Check Run

| 事件 | Action | 映射到 | 严重级别 | 建议动作 |
|------|--------|--------|----------|----------|
| `check_run` | `completed` (failure) | Attention | medium | rerun / view |

---

## 使用示例

### 创建 GitHub Actions Connector

```ts
import {
  createGitHubActionsConnector,
  createWorkflowEventAdapter,
  createDeploymentApprovalBridge,
  createGitHubActionsOperatorBridge,
  createJobStatusAdapter,
} from './connectors/github-actions';
import {
  createIncidentDataSource,
  createApprovalDataSource,
} from './operator/data';

// 1. 创建数据源
const incidentDataSource = createIncidentDataSource();
const approvalDataSource = createApprovalDataSource();

// 2. 创建 Connector
const githubActionsConnector = createGitHubActionsConnector({
  apiToken: process.env.GITHUB_TOKEN,
  webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
});

// 3. 创建事件适配器
const workflowEventAdapter = createWorkflowEventAdapter({
  autoCreateIncident: true,
  autoCreateApproval: true,
  requireApprovalForEnvironments: ['production', 'staging'],
});

// 4. 创建审批桥接
const deploymentApprovalBridge = createDeploymentApprovalBridge(
  githubActionsConnector,
  { defaultApprovalComment: 'Approved via OpenClaw' }
);

// 5. 创建 Operator Bridge
const githubActionsBridge = createGitHubActionsOperatorBridge(
  incidentDataSource,
  approvalDataSource,
  workflowEventAdapter,
  deploymentApprovalBridge,
  { defaultWorkspaceId: 'local-default' }
);

// 6. 监听 Webhook 事件
githubActionsConnector.handleWebhook(payload).then(async (events) => {
  for (const event of events) {
    if (event.type === 'workflow_run') {
      await githubActionsBridge.handleWorkflowRunEvent(event);
    }
    if (event.type === 'deployment') {
      await githubActionsBridge.handleDeploymentEvent(event);
    }
  }
});
```

### 处理 Approve 动作

```ts
// 用户执行 approve
const result = await githubActionsBridge.handleApproveAction(
  'owner/repo/deployments/123',
  'user_456'
);

console.log(result.message);  // "Approved deployment to production"
```

---

## 验收标准

### ✅ 已完成

1. ✅ GitHubActionsConnector 接口定义完整
2. ✅ WorkflowEventAdapter 事件映射
3. ✅ DeploymentApprovalBridge 回写逻辑
4. ✅ GitHubActionsOperatorBridge 数据面桥接
5. ✅ 共享层 (GitHubApiClient / GitHubWebhookVerifier)

### 🟡 待完成

1. 🟡 集成到 OperatorSurfaceService
2. 🟡 CLI `oc inbox` 显示 GitHub Actions 来源项
3. 🟡 Telegram `/inbox` 显示 GitHub Actions 来源项
4. 🟡 端到端验证

---

## 与 Phase 2A/2B-1 的集成

| Phase 2A/2B-1 模块 | 2B-2 集成方式 |
|-------------------|--------------|
| IncidentDataSource | workflow_run failed → Incident |
| ApprovalDataSource | deployment → Approval |
| InboxService | 自动聚合 GitHub Actions 来源项 |
| ExecutionBridge | approve/reject 回写 |
| CLI | `oc inbox` 显示 |
| Telegram | `/inbox` 显示 |

---

## 下一步：2B-2-I

**目标:** 将 GitHub Actions Connector 集成到产品主链路

**行动:**
1. `OperatorSurfaceService.getInboxView()` 使用 GitHub Actions 数据
2. CLI `oc inbox` 显示 GitHub Actions 来源项
3. Telegram `/inbox` 显示 GitHub Actions 来源项
4. 端到端验证：Webhook → Inbox → Approve → GitHub Deployment

---

_Phase 2B-2 状态：✅ 完成 (MVP) — GitHub Actions Connector 已就绪_
