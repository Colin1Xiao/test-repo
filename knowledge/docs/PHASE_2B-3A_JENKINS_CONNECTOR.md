# Phase 2B-3A: Jenkins Connector

**状态**: ✅ **代码完成**  
**时间**: 2026-04-04 04:05 (Asia/Shanghai)

---

## 概述

将 GitHub Actions 已验证模式复制到 Jenkins，实现：

```
Jenkins Build/Pipeline Event → Operator Queue → Human Action → Jenkins API → State Updated
```

---

## 交付文件

| 文件 | 职责 | 行数 |
|------|------|------|
| `jenkins_types.ts` | 类型定义 | ~180 |
| `jenkins_connector.ts` | Jenkins API 客户端 | ~280 |
| `jenkins_event_adapter.ts` | 事件映射适配器 | ~240 |
| `jenkins_operator_bridge.ts` | Operator 桥接 | ~180 |
| `jenkins_build_approval_bridge.ts` | 审批回写桥接 | ~100 |
| `jenkins_integration.ts` | 集成组装 | ~180 |
| `index.ts` | 导出 | ~10 |
| `PHASE_2B-3A_JENKINS_CONNECTOR.md` | 本文档 | - |

**总计**: ~1170 行代码

---

## 核心能力

### 事件映射

| Jenkins 事件 | 映射 | 严重级别 |
|-------------|------|----------|
| `build_failed` | Incident | high |
| `pipeline_failed` | Incident | high |
| `build_unstable` | Attention | medium |
| `input_pending` | Approval | high |

### 动作回写

| 动作 | Jenkins API | 状态 |
|------|-------------|------|
| `approve` | `/input/{id}/proceed` | ✅ |
| `reject` | `/input/{id}/abort` | ✅ |
| `rerun` | `/rebuild` | ✅ |
| `cancel` | `/stop` | ✅ |

---

## 使用方法

### 1. 初始化集成

```typescript
import { initializeJenkinsIntegration } from './connectors/jenkins';

const integration = initializeJenkinsIntegration({
  jenkinsBaseUrl: 'http://jenkins-server:8080',
  jenkinsUsername: 'admin',
  jenkinsToken: 'your_api_token',
  autoApproveJobs: ['deploy-staging'],
  ignoreJobs: ['test-job'],
  verboseLogging: true,
});
```

### 2. 设置 Webhook 处理器

```typescript
import { createJenkinsWebhookHandler } from './connectors/jenkins';

const webhookHandler = createJenkinsWebhookHandler(integration);

// 在 HTTP 服务器中使用
app.post('/webhooks/jenkins', async (req, res) => {
  const result = await webhookHandler(req.body);
  res.json(result);
});
```

### 3. 设置动作处理器

```typescript
import { createJenkinsActionHandler } from './connectors/jenkins';

const actionHandler = createJenkinsActionHandler(integration);

operatorActionHandler.on('approve', async (sourceId, actorId) => {
  if (sourceId.includes('/input/')) {
    return await actionHandler.handleApprove(sourceId, actorId);
  }
});

operatorActionHandler.on('rerun', async (sourceId) => {
  if (sourceId.includes('/builds/')) {
    return await actionHandler.handleRerun(sourceId);
  }
});
```

---

## Jenkins 配置

### 1. 安装插件

**推荐**: [Generic Webhook Trigger Plugin](https://plugins.jenkins.io/generic-webhook-trigger/)

```
Jenkins → Manage Jenkins → Manage Plugins
→ Available → 搜索 "Generic Webhook Trigger" → Install
```

### 2. 配置 Webhook

```
Job Configuration → Build Triggers
→ Generic Webhook Trigger
→ Token: your_secret_token
→ Post content parameter:
    name: $.job.fullName
    buildNumber: $.build.number
    status: $.build.status
```

### 3. 生成 API Token

```
Jenkins → User → Configure
→ API Token → Add new Token
→ 复制 token (用于 API 调用)
```

### 4. Webhook URL

```
http://<your-server>:3000/api/webhooks/jenkins
```

**ngrok 暴露** (开发环境):
```bash
ngrok http 3000
# 使用 https://xxx.ngrok.io/api/webhooks/jenkins
```

---

## 验收标准（6 条）

| # | 标准 | 状态 |
|---|------|------|
| 1 | Jenkins Webhook 可接收 | ✅ 代码完成 |
| 2 | Build Failure → Incident | ✅ 代码完成 |
| 3 | Input Pending → Approval | ✅ 代码完成 |
| 4 | Approve → Jenkins Writeback | ✅ 代码完成 |
| 5 | Inbox 可见 Jenkins 项 | ⚪ 待测试 |
| 6 | 完整闭环 | ⚪ 待测试 |

---

## 测试计划

### 测试 1: Build Failure → Incident

```bash
# 1. 触发失败构建
# (在 Jenkins 中运行会失败的 Job)

# 2. 检查 Incident
curl http://localhost:3000/api/operator/incidents | jq '.'

# 3. 验证包含 Jenkins 来源
jq '.incidents[] | select(.metadata.source == "jenkins")'
```

### 测试 2: Input Pending → Approval

```bash
# 1. 触发有 Input Step 的 Pipeline
# Jenkinsfile:
#   input message: 'Deploy to production?',
#          submitter: 'admin'

# 2. 检查 Approval
curl http://localhost:3000/api/operator/approvals | jq '.'

# 3. 验证包含 Jenkins Input 信息
jq '.approvals[] | select(.metadata.source == "jenkins")'
```

### 测试 3: Approve → Jenkins Continue

```bash
# 1. 执行 Approve
curl -X POST http://localhost:3000/api/operator/actions \
  -H 'Content-Type: application/json' \
  -d '{"actionType":"approve","targetType":"approval","targetId":"jenkins_input_xxx"}'

# 2. 检查 Jenkins Pipeline 状态
curl -u admin:token \
  "http://jenkins-server/job/test-job/123/api/json" | jq '.currentStages[0].state'

# 3. 验证状态为 RUNNING 或 COMPLETED
```

---

## 与 GitHub Actions 对比

| 维度 | GitHub Actions | Jenkins | 适配策略 |
|------|----------------|---------|----------|
| 事件模型 | Webhook (JSON) | Webhook / Polling | 优先 Webhook |
| 审批场景 | Deployment | Input Step | 映射为 Approval |
| 失败场景 | Workflow Run | Build Failed | 映射为 Incident |
| 动作回写 | Deployment Status | Input API | 调用 Jenkins API |
| 认证 | Token | Token / Basic Auth | 支持 Basic Auth |

---

## 下一步

### 立即执行
- [ ] 配置 Jenkins 测试环境
- [ ] 安装 Generic Webhook Trigger 插件
- [ ] 创建测试 Job

### 本周内
- [ ] 实盘验证 Build Failure → Incident
- [ ] 实盘验证 Input Pending → Approval
- [ ] 执行 Approve 验证闭环

### 下周内
- [ ] 2B-3B CircleCI Connector
- [ ] Phase 2B 总结报告

---

**记录时间**: 2026-04-04 04:05  
**状态**: 代码完成，待实盘验证

---

_从 GitHub 到 Jenkins，验证 CI/CD Connector 模式的普适性_
