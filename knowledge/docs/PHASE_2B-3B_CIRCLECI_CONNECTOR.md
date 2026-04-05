# Phase 2B-3B: CircleCI Connector

**状态**: ✅ **代码完成**  
**时间**: 2026-04-04 04:20 (Asia/Shanghai)

---

## 概述

复制 GitHub Actions / Jenkins 已验证模式到 CircleCI，实现：

```
CircleCI Workflow/Job Event → Operator Queue → Human Action → CircleCI API → State Updated
```

---

## 交付文件

| 文件 | 职责 | 行数 |
|------|------|------|
| `circleci_types.ts` | 类型定义 | ~180 |
| `circleci_connector.ts` | CircleCI API 客户端 | ~250 |
| `circleci_event_adapter.ts` | 事件映射适配器 | ~240 |
| `circleci_operator_bridge.ts` | Operator 桥接 | ~160 |
| `circleci_integration.ts` | 集成组装 | ~180 |
| `index.ts` | 导出 | ~10 |
| `PHASE_2B-3B_CIRCLECI_CONNECTOR.md` | 本文档 | - |

**总计**: ~1020 行代码

---

## 核心能力

### 事件映射

| CircleCI 事件 | 映射 | 严重级别 |
|---------------|------|----------|
| `workflow_failed` | Incident | high |
| `job_failed` | Incident | high |
| `workflow_on_hold` | Attention | medium |
| `approval_pending` | Approval | high |

### 动作回写

| 动作 | CircleCI API | 状态 |
|------|-------------|------|
| `approve` | `/job/{id}/approve` | ✅ |
| `reject` | `/workflow/{id}/continue` | ✅ |
| `rerun` | `/workflow/{id}/rerun` | ✅ |

---

## 使用方法

### 1. 初始化集成

```typescript
import { initializeCircleCIIntegration } from './connectors/circleci';

const integration = initializeCircleCIIntegration({
  apiToken: 'your_circleci_token',
  ignoreProjects: ['gh/test-repo'],
  verboseLogging: true,
});
```

### 2. 设置 Webhook 处理器

```typescript
import { createCircleCIWebhookHandler } from './connectors/circleci';

const webhookHandler = createCircleCIWebhookHandler(integration);

app.post('/webhooks/circleci', async (req, res) => {
  const result = await webhookHandler(req.body);
  res.json(result);
});
```

### 3. 设置动作处理器

```typescript
import { createCircleCIActionHandler } from './connectors/circleci';

const actionHandler = createCircleCIActionHandler(integration);

operatorActionHandler.on('approve', async (sourceId, actorId) => {
  if (sourceId.startsWith('circleci_approval:')) {
    return await actionHandler.handleApprove(sourceId, actorId);
  }
});
```

---

## CircleCI 配置

### 1. 生成 API Token

```
CircleCI → User Settings → API Tokens
→ Create Token → 复制 token
```

### 2. 配置 Webhook

**项目设置**:
```
Project Settings → Webhooks
→ Add Webhook
→ URL: https://your-server.com/api/webhooks/circleci
→ 勾选事件：Workflow Completed, Job Completed, Approval Required
```

### 3. Webhook URL

**本地开发**:
```bash
ngrok http 3002
# 使用 https://xxx.ngrok.io/api/webhooks/circleci
```

---

## 验收标准（6 条）

| # | 标准 | 状态 |
|---|------|------|
| 1 | CircleCI Webhook 可接收 | ✅ 代码完成 |
| 2 | Workflow Failure → Incident | ✅ 代码完成 |
| 3 | Approval Pending → Approval | ✅ 代码完成 |
| 4 | Approve → CircleCI Writeback | ✅ 代码完成 |
| 5 | Inbox 可见 CircleCI 项 | ⚪ 待测试 |
| 6 | 完整闭环 | ⚪ 待测试 |

---

## 与 Jenkins/GitHub Actions 对比

| 维度 | GitHub Actions | Jenkins | CircleCI |
|------|----------------|---------|----------|
| 事件模型 | Webhook | Webhook / Polling | Webhook |
| 审批场景 | Deployment | Input Step | Approval Job |
| API 风格 | REST | REST + Classic | REST v2 |
| 认证 | Token | Basic Auth | Token |
| 配置复杂度 | 低 | 中 | 低 |

---

## 下一步

### 立即执行
- [ ] 配置 CircleCI API Token
- [ ] 配置 Webhook
- [ ] 创建测试项目

### 本周内
- [ ] 实盘验证 Workflow Failure → Incident
- [ ] 实盘验证 Approval Pending → Approval
- [ ] 执行 Approve 验证闭环

### 下周内
- [ ] Phase 2B 总结报告
- [ ] Phase 2C 规划

---

**记录时间**: 2026-04-04 04:20  
**状态**: 代码完成，待实盘验证

---

_从 GitHub 到 Jenkins 到 CircleCI，验证 CI/CD Connector 模式的普适性_
