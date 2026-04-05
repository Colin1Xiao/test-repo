# Phase 2B-2-I: GitHub Actions Integration

**目标**: 将 GitHub Actions Connector 正式接入 Operator 主链路，打通 deployment approval 主闭环。

---

## 验收标准（6 条）

1. ✅ `deployment/deployment_status(pending)` 能出现在 `approvals` / `inbox` 中
2. ✅ `workflow_run failed` 能出现在 `incidents` / `inbox` / `attention` 中
3. ✅ `check_run failed` 能出现在 `inbox attention` 中
4. ✅ `approve` 至少一条动作能真实回写 GitHub Deployment
5. ✅ `reject` 至少一条动作能真实回写 GitHub Deployment
6. ✅ 至少一条完整闭环跑通：
   `deployment pending → inbox/approval → approve/reject → GitHub deployment state updated → inbox refreshed`

---

## 架构设计

```
GitHub Webhook
    ↓
GitHubActionsConnector.handleWebhook()
    ↓
GitHubActionsOperatorBridge
    ├── handleDeploymentEvent() → ApprovalDataSource.addApproval()
    ├── handleWorkflowRunEvent() → IncidentDataSource.addIncident()
    └── handleDeploymentStatusEvent() → AttentionInbox
    ↓
InboxService.getInboxSnapshot()
    ├── ApprovalInbox.getInboxItems() → 审批项
    ├── IncidentCenter.getInboxItems() → 事件项
    └── TaskCenter.getInboxItems() → 任务项
    ↓
OperatorSurfaceService.getInboxView()
    ↓
CLI / Telegram / WebChat
```

---

## 集成点

### 1. 数据源层

**ApprovalDataSource**:
- 新增 `addApprovalFromGitHubActions()` 方法
- 支持 `source: 'github_actions'` 元数据
- 存储 `deploymentId`, `environment`, `repository` 等字段

**IncidentDataSource**:
- 新增 `addIncidentFromGitHubActions()` 方法
- 支持 `source: 'github_actions'` 元数据
- 存储 `workflowName`, `runId`, `repository` 等字段

### 2. Inbox 层

**InboxService**:
- 已支持聚合多来源项
- 需确保 `source` 元数据透传到 `InboxItem.metadata`

**ApprovalInbox / IncidentCenter**:
- 已支持从数据源读取
- 需确保 `sourceId` 格式统一：`github:owner/repo/deployments/id`

### 3. Surface 层

**OperatorSurfaceService.getInboxView()**:
- 已支持 `InboxService` 注入
- 已支持构建 `availableActions`（approve/reject）
- 需确保 `sourceId` 能解析回 GitHub deploymentId

### 4. 动作回写层

**DeploymentApprovalBridge**:
- 已实现 `handleApprove()` / `handleReject()`
- 已支持解析 `sourceId` → `deploymentId`
- 已调用 `GitHubConnector.approveDeployment()` / `rejectDeployment()`

---

## 待实现代码

### 1. GitHub Actions 数据源实现

```typescript
// src/operator/data/github_actions_approval_data_source.ts
export class GitHubActionsApprovalDataSource implements ApprovalDataSource {
  private approvals: Map<string, ApprovalViewModel> = new Map();
  
  addApprovalFromGitHubActions(event: DeploymentEvent): void {
    const approvalId = `github_deployment_${event.deployment.id}`;
    const sourceId = `${event.repository.fullName}/deployments/${event.deployment.id}`;
    
    this.approvals.set(approvalId, {
      approvalId,
      scope: `Deploy to ${event.deployment.environment}`,
      reason: `Deployment requested by ${event.deployment.creator.login}`,
      requestingAgent: event.deployment.creator.login,
      metadata: {
        source: 'github_actions',
        sourceId,
        deploymentId: event.deployment.id,
        environment: event.deployment.environment,
        repository: event.repository.fullName,
        ref: event.deployment.ref,
      },
      status: 'pending',
      requestedAt: Date.now(),
      ageMs: 0,
    });
  }
  
  // ... 实现 ApprovalDataSource 接口
}
```

### 2. GitHub Actions 事件流集成

```typescript
// src/connectors/github-actions/github_actions_event_handler.ts
export class GitHubActionsEventHandler {
  constructor(
    private approvalDataSource: GitHubActionsApprovalDataSource,
    private incidentDataSource: GitHubActionsIncidentDataSource,
    private workflowEventAdapter: WorkflowEventAdapter
  ) {}
  
  async handleEvent(event: GitHubActionsEvent): Promise<void> {
    if (event.type === 'deployment') {
      const adapted = this.workflowEventAdapter.adaptDeploymentEvent(event as DeploymentEvent);
      if (adapted.approval) {
        this.approvalDataSource.addApprovalFromGitHubActions(event as DeploymentEvent);
      }
    }
    
    if (event.type === 'workflow_run') {
      const adapted = this.workflowEventAdapter.adaptWorkflowRunEvent(event as WorkflowRunEvent);
      if (adapted.incident) {
        this.incidentDataSource.addIncidentFromGitHubActions(event as WorkflowRunEvent);
      }
    }
  }
}
```

### 3. 主链路组装

```typescript
// src/operator/index.ts 或 main.ts
const githubActionsConnector = createGitHubActionsConnector();
const approvalDataSource = createGitHubActionsApprovalDataSource();
const incidentDataSource = createGitHubActionsIncidentDataSource();
const workflowEventAdapter = createWorkflowEventAdapter();
const deploymentApprovalBridge = createDeploymentApprovalBridge(githubActionsConnector);
const githubActionsEventHandler = new GitHubActionsEventHandler(
  approvalDataSource,
  incidentDataSource,
  workflowEventAdapter
);

// Webhook 处理
githubActionsConnector.handleWebhook = async (payload, signature) => {
  const events = await originalHandleWebhook(payload, signature);
  for (const event of events) {
    await githubActionsEventHandler.handleEvent(event);
  }
  return events;
};

// 动作回写处理
operatorActionHandler.on('approve', async (sourceId, actorId) => {
  if (sourceId.includes('/deployments/')) {
    return await deploymentApprovalBridge.handleApprove(sourceId, undefined, actorId);
  }
});

operatorActionHandler.on('reject', async (sourceId, actorId, reason) => {
  if (sourceId.includes('/deployments/')) {
    return await deploymentApprovalBridge.handleReject(sourceId, undefined, actorId, reason);
  }
});
```

---

## 测试计划

### 测试 1: Deployment → Approval → Inbox

```bash
# 1. 触发 GitHub Deployment Webhook
curl -X POST http://localhost:18789/webhooks/github \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=..." \
  -d '{"deployment": {...}}'

# 2. 检查 ApprovalDataSource
curl http://localhost:18789/operator/approvals

# 3. 检查 Inbox
curl http://localhost:18789/operator/inbox

# 4. 验证输出包含 GitHub Actions 来源项
{
  "items": [
    {
      "itemType": "approval",
      "sourceId": "owner/repo/deployments/123",
      "metadata": {
        "source": "github_actions",
        "deploymentId": 123,
        "environment": "production"
      }
    }
  ]
}
```

### 测试 2: Approve → Writeback → Refresh

```bash
# 1. 触发 approve 动作
curl -X POST http://localhost:18789/operator/actions \
  -H "Content-Type: application/json" \
  -d '{
    "actionType": "approve",
    "targetType": "approval",
    "targetId": "github_deployment_123"
  }'

# 2. 检查 GitHub Deployment 状态
curl https://api.github.com/repos/owner/repo/deployments/123/statuses \
  -H "Authorization: token $GITHUB_TOKEN"

# 3. 验证状态为 "success"
{
  "state": "success",
  "description": "Approved via OpenClaw Operator"
}

# 4. 刷新 Inbox
curl http://localhost:18789/operator/inbox

# 5. 验证审批项状态已更新
{
  "items": [
    {
      "sourceId": "owner/repo/deployments/123",
      "status": "approved"
    }
  ]
}
```

---

## 里程碑

- [ ] **Step 1**: 创建 `GitHubActionsApprovalDataSource` / `GitHubActionsIncidentDataSource`
- [ ] **Step 2**: 创建 `GitHubActionsEventHandler` 连接 Webhook → 数据源
- [ ] **Step 3**: 更新 `OperatorSurfaceService` 注入 GitHub Actions 数据源
- [ ] **Step 4**: 实现动作回写处理器（approve/reject）
- [ ] **Step 5**: 测试 Deployment → Approval → Inbox 链路
- [ ] **Step 6**: 测试 Approve → Writeback → Refresh 闭环
- [ ] **Step 7**: 文档化 + 提交代码

---

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| Webhook 签名验证失败 | 提前配置 `GITHUB_WEBHOOK_SECRET` |
| GitHub API 调用失败 | 添加重试逻辑 + 降级处理 |
| 状态同步延迟 | 添加手动刷新机制 |
| sourceId 解析失败 | 统一格式 + 添加日志 |

---

**预计工作量**: 4-6 小时  
**优先级**: P0（当前主线任务）
