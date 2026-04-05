# Phase 2B-2-I-H: HTTP Server Integration

**状态**: ✅ 代码完成  
**时间**: 2026-04-04 03:35 (Asia/Shanghai)

---

## 概述

为 Phase 2B-2-I 创建独立的 HTTP 服务器，提供 Webhook 接收和 Operator API 端点。

**目标**: 使 GitHub Actions Connector 可以被真实 Webhook 触发，并通过 HTTP API 查询和操作。

---

## 新增文件

| 文件 | 职责 | 行数 |
|------|------|------|
| `github_actions_http_server.ts` | HTTP 服务器实现 | ~280 行 |
| `start-github-actions-server.sh` | 启动脚本 | ~40 行 |
| `test-github-actions-http.sh` | 测试脚本 | ~80 行 |
| `PHASE_2B-2-I-H_HTTP_SERVER.md` | 本文档 | - |

---

## HTTP 端点

### 1. POST /api/webhooks/github

**职责**: 接收 GitHub Webhook

**请求**:
```http
POST /api/webhooks/github
Content-Type: application/json
X-Hub-Signature-256: sha256=xxx

{
  "deployment": { ... },
  "repository": { ... }
}
```

**响应**:
```json
{
  "success": true,
  "eventsProcessed": 1,
  "approvalsCreated": 1,
  "incidentsCreated": 0
}
```

---

### 2. GET /api/operator/approvals

**职责**: 获取审批列表

**请求**:
```http
GET /api/operator/approvals
```

**响应**:
```json
{
  "approvals": [
    {
      "approvalId": "github_deployment_12345",
      "scope": "Deploy to production",
      "status": "pending",
      "metadata": {
        "source": "github_actions",
        "deploymentId": 12345,
        "environment": "production"
      }
    }
  ],
  "summary": {
    "total": 1,
    "pending": 1,
    "timeout": 0
  }
}
```

---

### 3. GET /api/operator/inbox

**职责**: 获取统一 Inbox

**请求**:
```http
GET /api/operator/inbox
```

**响应**:
```json
{
  "summary": {
    "pendingApprovals": 1,
    "activeIncidents": 0,
    "total": 1
  },
  "items": [
    {
      "id": "github_deployment_12345",
      "type": "approval",
      "scope": "Deploy to production",
      "status": "pending",
      "metadata": { ... }
    }
  ]
}
```

---

### 4. POST /api/operator/actions

**职责**: 执行动作（Approve/Reject）

**请求**:
```http
POST /api/operator/actions
Content-Type: application/json

{
  "actionType": "approve",
  "targetType": "approval",
  "targetId": "github_deployment_12345"
}
```

**响应**:
```json
{
  "success": true,
  "message": "Approved deployment to production"
}
```

---

## 使用方法

### Step 1: 启动服务器

```bash
~/.openclaw/workspace/scripts/start-github-actions-server.sh
```

**输出**:
```
[GitHubActionsHttpServer] Listening on port 3000
[GitHubActionsHttpServer] Base path: /api
[GitHubActionsHttpServer] Endpoints:
  POST /api/webhooks/github
  GET  /api/operator/approvals
  GET  /api/operator/inbox
  POST /api/operator/actions
```

---

### Step 2: 测试端点

```bash
~/.openclaw/workspace/scripts/test-github-actions-http.sh
```

---

### Step 3: 配置 GitHub Webhook

使用 ngrok 暴露本地服务：

```bash
# 安装 ngrok (如未安装)
brew install ngrok

# 启动 ngrok
ngrok http 3000
```

然后在 GitHub 仓库配置 Webhook：
- Payload URL: `https://xxx.ngrok.io/api/webhooks/github`
- Content type: `application/json`
- Secret: `GITHUB_WEBHOOK_SECRET`
- Events: Deployments, Workflow runs

---

### Step 4: 实盘测试

```bash
# 触发 Deployment
gh api -X POST /repos/Colin1Xiao/test-repo/deployments \
  -H "Content-Type: application/json" \
  -d '{"ref":"main","environment":"production","task":"deploy"}'

# 检查审批
curl http://localhost:3000/api/operator/approvals | jq '.'

# 执行 Approve
curl -X POST http://localhost:3000/api/operator/actions \
  -H "Content-Type: application/json" \
  -d '{"actionType":"approve","targetType":"approval","targetId":"github_deployment_xxx"}'

# 验证 GitHub 状态
gh api /repos/Colin1Xiao/test-repo/deployments/xxx/statuses | jq '.'
```

---

## 架构

```
GitHub Webhook
    ↓
ngrok (公网 → 本地)
    ↓
POST /api/webhooks/github
    ↓
GitHubActionsHttpServer.handleWebhook()
    ↓
createWebhookHandler(integration)
    ↓
GitHubActionsEventHandler.handleEvents()
    ↓
ApprovalDataSource.addApprovalFromGitHubActions()
    ↓
内存存储 (Map)

HTTP API 查询
    ↓
GET /api/operator/approvals
    ↓
ApprovalDataSource.getApprovalView()
    ↓
JSON 响应

HTTP API 动作
    ↓
POST /api/operator/actions
    ↓
createActionHandler(integration).handleApprove()
    ↓
DeploymentApprovalBridge.handleApprove()
    ↓
GitHub API (回写状态)
```

---

## 配置项

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `PORT` | 3000 | HTTP 服务器端口 |
| `BASE_PATH` | /api | URL 基础路径 |
| `GITHUB_TOKEN` | - | GitHub API Token |
| `GITHUB_WEBHOOK_SECRET` | - | Webhook 签名密钥 |

---

## 与 OpenClaw Gateway 集成（后续）

当前实现是独立服务器。后续可以集成到 OpenClaw Gateway：

### 方案 A: 插件 HTTP 路由

```typescript
// ~/.openclaw/plugins/github-actions/plugin.js
module.exports = {
  id: 'github-actions',
  name: 'GitHub Actions',
  version: '1.0.0',
  
  register(api) {
    // 注册 HTTP 路由
    api.http.post('/webhooks/github', handleWebhook);
    api.http.get('/operator/approvals', handleGetApprovals);
    api.http.get('/operator/inbox', handleGetInbox);
    api.http.post('/operator/actions', handleAction);
  },
};
```

### 方案 B: Gateway 原生路由

修改 OpenClaw Gateway 源码，添加路由处理器。

---

## 验收标准

- [ ] **1. HTTP 服务器可启动**
  - 监听 3000 端口
  - 无启动错误

- [ ] **2. Webhook 端点可接收**
  - POST /api/webhooks/github 返回 200
  - 解析 Deployment 事件
  - 创建审批到数据源

- [ ] **3. Approvals 端点可查询**
  - GET /api/operator/approvals 返回 JSON
  - 包含创建的审批项

- [ ] **4. Inbox 端点可查询**
  - GET /api/operator/inbox 返回 JSON
  - 包含审批和事件

- [ ] **5. Actions 端点可执行**
  - POST /api/operator/actions 执行 approve
  - 返回成功响应

- [ ] **6. 完整闭环可测试**
  - Webhook → Approval → Approve → GitHub Writeback

---

## 下一步

1. **启动服务器测试**
   ```bash
   ~/.openclaw/workspace/scripts/start-github-actions-server.sh
   ```

2. **运行 HTTP 测试**
   ```bash
   ~/.openclaw/workspace/scripts/test-github-actions-http.sh
   ```

3. **配置 ngrok 暴露**
   ```bash
   ngrok http 3000
   ```

4. **配置 GitHub Webhook**
   - 使用 ngrok URL
   - 测试真实 Webhook 投递

5. **执行实盘验证**
   - 触发 Deployment
   - 检查审批创建
   - 执行 Approve
   - 验证 GitHub 回写

---

**记录时间**: 2026-04-04 03:35  
**状态**: 代码完成，待启动测试
