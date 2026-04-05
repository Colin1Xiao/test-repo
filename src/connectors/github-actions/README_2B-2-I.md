# Phase 2B-2-I: GitHub Actions Integration

**状态**: ✅ 完成  
**完成时间**: 2026-04-04  
**验收**: 待测试

---

## 概述

将 GitHub Actions Connector 正式接入 Operator 主链路，打通 deployment approval 主闭环。

**核心能力**:
- ✅ Deployment → Approval → Inbox
- ✅ Workflow Run Failed → Incident → Inbox
- ✅ Approve/Reject → GitHub Writeback
- ✅ 完整闭环验证

---

## 架构

```
GitHub Webhook
    ↓
GitHubActionsConnector.handleWebhook()
    ↓
GitHubActionsEventHandler
    ├── ApprovalDataSource.addApprovalFromGitHubActions()
    └── IncidentDataSource.addIncidentFromGitHubActions()
    ↓
InboxService.getInboxSnapshot()
    ↓
OperatorSurfaceService.getInboxView()
    ↓
CLI / Telegram / WebChat
```

---

## 新增文件

### 数据源层

| 文件 | 职责 |
|------|------|
| `github_actions_approval_data_source.ts` | GitHub Deployment 审批数据源 |
| `github_actions_incident_data_source.ts` | GitHub Workflow 失败事件数据源 |

### 集成层

| 文件 | 职责 |
|------|------|
| `github_actions_event_handler.ts` | 事件处理器（Webhook → 数据源） |
| `github_actions_integration.ts` | 集成组装（统一初始化接口） |

### 测试

| 文件 | 职责 |
|------|------|
| `tests/github-actions-integration.test.ts` | 集成测试套件 |

---

## 使用方法

### 1. 初始化集成

```typescript
import { initializeGitHubActionsIntegration } from './connectors/github-actions/github_actions_integration';

const integration = initializeGitHubActionsIntegration({
  githubToken: process.env.GITHUB_TOKEN,
  webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
  autoApproveEnvironments: ['staging'], // 自动批准的环境
  ignoreWorkflows: ['test-workflow'], // 忽略的 Workflow
  requireApprovalForEnvironments: ['production', 'staging'], // 需要审批的环境
  verboseLogging: true,
});
```

### 2. 设置 Webhook 处理器

```typescript
import { createWebhookHandler } from './connectors/github-actions/github_actions_integration';

const webhookHandler = createWebhookHandler(integration);

// 在 HTTP 服务器中使用
app.post('/webhooks/github', async (req, res) => {
  const result = await webhookHandler(req.body, req.headers['x-hub-signature-256']);
  res.json(result);
});
```

### 3. 设置动作处理器

```typescript
import { createActionHandler } from './connectors/github-actions/github_actions_integration';

const actionHandler = createActionHandler(integration);

// 在 Operator Action Handler 中使用
operatorActionHandler.on('approve', async (sourceId, actorId) => {
  return await actionHandler.handleApprove(sourceId, actorId);
});

operatorActionHandler.on('reject', async (sourceId, actorId, reason) => {
  return await actionHandler.handleReject(sourceId, actorId, reason);
});
```

---

## 数据结构

### Approval 元数据

```typescript
{
  source: 'github_actions',
  sourceId: 'owner/repo/deployments/123',
  deploymentId: 123,
  environment: 'production',
  repository: 'owner/repo',
  ref: 'main',
  task: 'deploy',
  createdAt: '2026-04-04T00:00:00Z',
  updatedAt: '2026-04-04T00:00:00Z',
}
```

### Incident 元数据

```typescript
{
  source: 'github_actions',
  sourceId: 'owner/repo/actions/runs/456',
  workflowName: 'CI Pipeline',
  runId: 456,
  runNumber: 42,
  branch: 'main',
  sha: 'abc123',
  conclusion: 'failure',
  sender: 'colin',
}
```

---

## 测试

### 运行测试套件

```bash
# 设置环境变量
export GITHUB_TOKEN=your_token
export GITHUB_WEBHOOK_SECRET=your_secret

# 运行测试
npx ts-node tests/github-actions-integration.test.ts
```

### 测试用例

1. **Deployment → Approval → Inbox**
   - 触发 Deployment Webhook
   - 验证审批已创建
   - 验证状态为 pending

2. **Workflow Run Failed → Incident → Inbox**
   - 触发 Workflow Run Failed Webhook
   - 验证事件已创建
   - 验证严重级别为 high

3. **Auto-Approve Staging**
   - 触发 Staging Deployment Webhook
   - 验证审批自动批准
   - 验证状态为 approved

4. **Action Handler (Approve/Reject)**
   - 创建审批
   - 执行 Approve 动作
   - 验证状态更新

---

## 验收标准（6 条）

- [ ] **1. deployment/deployment_status(pending) 能出现在 approvals / inbox 中**
  - 测试：触发 Deployment Webhook
  - 验证：`GET /operator/approvals` 返回审批项
  - 验证：`GET /operator/inbox` 返回审批项

- [ ] **2. workflow_run failed 能出现在 incidents / inbox / attention 中**
  - 测试：触发 Workflow Run Failed Webhook
  - 验证：`GET /operator/incidents` 返回事件项
  - 验证：`GET /operator/inbox` 返回事件项

- [ ] **3. check_run failed 能出现在 inbox attention 中**
  - 测试：触发 Check Run Failed Webhook
  - 验证：`GET /operator/inbox` 返回 attention 项
  - 注：当前版本未实现，待后续扩展

- [ ] **4. approve 至少一条动作能真实回写 GitHub Deployment**
  - 测试：执行 Approve 动作
  - 验证：GitHub Deployment Status 更新为 success
  - 验证：API 调用 `POST /repos/{owner}/{repo}/deployment_statuses/{id}`

- [ ] **5. reject 至少一条动作能真实回写 GitHub Deployment**
  - 测试：执行 Reject 动作
  - 验证：GitHub Deployment Status 更新为 failure
  - 验证：API 调用 `POST /repos/{owner}/{repo}/deployment_statuses/{id}`

- [ ] **6. 完整闭环跑通**
  - 测试：`deployment pending → inbox/approval → approve/reject → GitHub deployment state updated → inbox refreshed`
  - 验证：全流程无错误
  - 验证：最终状态一致

---

## 与现有代码集成

### 1. 更新 Operator 主链路

```typescript
// src/operator/index.ts 或 main.ts

import { initializeGitHubActionsIntegration } from '../connectors/github-actions/github_actions_integration';

// 初始化集成
const githubIntegration = initializeGitHubActionsIntegration({
  githubToken: process.env.GITHUB_TOKEN,
  webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
});

// 将数据源注入到现有系统
const approvalDataSource = githubIntegration.approvalDataSource;
const incidentDataSource = githubIntegration.incidentDataSource;

// 创建 InboxService
const inboxService = createInboxService({
  approvalInbox: createApprovalInbox(approvalDataSource),
  incidentCenter: createIncidentCenter(incidentDataSource),
  taskCenter: createTaskCenter(), // 现有
  attentionInbox: createAttentionInbox(), // 现有
});

// 创建 OperatorSurfaceService
const operatorSurfaceService = createOperatorSurfaceService(
  contextAdapter,
  viewFactory,
  inboxService // 注入 InboxService
);
```

### 2. 更新 Webhook 路由

```typescript
// src/routes/webhooks.ts

import { createWebhookHandler } from '../connectors/github-actions/github_actions_integration';

const githubWebhookHandler = createWebhookHandler(githubIntegration);

router.post('/github', async (req, res) => {
  const result = await githubWebhookHandler(req.body, req.headers['x-hub-signature-256']);
  res.json(result);
});
```

### 3. 更新 Action Handler

```typescript
// src/operator/handlers/operator_action_handler.ts

import { createActionHandler } from '../../connectors/github-actions/github_actions_integration';

const githubActionHandler = createActionHandler(githubIntegration);

actionHandler.on('approve', async (sourceId, actorId) => {
  // 优先尝试 GitHub Actions 处理器
  if (sourceId.includes('/deployments/')) {
    return await githubActionHandler.handleApprove(sourceId, actorId);
  }
  
  // 降级到通用处理器
  return await genericApproveHandler(sourceId, actorId);
});

actionHandler.on('reject', async (sourceId, actorId, reason) => {
  // 优先尝试 GitHub Actions 处理器
  if (sourceId.includes('/deployments/')) {
    return await githubActionHandler.handleReject(sourceId, actorId, reason);
  }
  
  // 降级到通用处理器
  return await genericRejectHandler(sourceId, actorId, reason);
});
```

---

## 配置项

| 配置 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `githubToken` | string | `process.env.GITHUB_TOKEN` | GitHub API Token |
| `webhookSecret` | string | `process.env.GITHUB_WEBHOOK_SECRET` | Webhook 签名验证密钥 |
| `autoApproveEnvironments` | string[] | `[]` | 自动批准的环境列表 |
| `ignoreWorkflows` | string[] | `[]` | 忽略的 Workflow 列表 |
| `requireApprovalForEnvironments` | string[] | `['production', 'staging']` | 需要审批的环境列表 |
| `verboseLogging` | boolean | `false` | 详细日志 |

---

## 故障排查

### Webhook 签名验证失败

**症状**: `401 Unauthorized` 或 `Invalid signature`

**解决**:
1. 检查 `GITHUB_WEBHOOK_SECRET` 是否与 GitHub 配置一致
2. 检查签名头格式：`X-Hub-Signature-256: sha256=...`
3. 检查 payload 是否被修改（日志记录原始 payload）

### 审批未创建

**症状**: Webhook 返回成功，但审批列表为空

**解决**:
1. 检查 `requireApprovalForEnvironments` 配置
2. 检查 deployment environment 是否匹配
3. 启用 `verboseLogging` 查看详细日志

### 动作回写失败

**症状**: Approve/Reject 动作返回失败

**解决**:
1. 检查 `GITHUB_TOKEN` 权限（需要 `repo:status`）
2. 检查 `sourceId` 格式是否正确
3. 检查 GitHub API 调用日志

---

## 下一步

### 2B-2-I 完成后

- [ ] 执行实盘测试（真实 GitHub Webhook）
- [ ] 验证 Telegram / CLI 可见性
- [ ] 添加刷新机制（状态同步）

### 2B-3: Jenkins / CircleCI 集成

- 复用本集成的模式
- 替换 Connector 实现
- 调整数据映射逻辑

---

## 相关文件

- **设计文档**: `docs/PHASE_2B-2-I_GITHUB_ACTIONS_INTEGRATION.md`
- **测试脚本**: `tests/github-actions-integration.test.ts`
- **类型定义**: `src/connectors/github-actions/github_actions_types.ts`
- **Connector**: `src/connectors/github-actions/github_actions_connector.ts`

---

**记录时间**: 2026-04-04 03:30 (Asia/Shanghai)  
**状态**: 代码完成，待测试验证
