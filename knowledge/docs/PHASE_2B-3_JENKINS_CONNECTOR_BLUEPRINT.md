# Phase 2B-3A: Jenkins Connector 蓝图

**状态**: 📋 设计完成，待执行  
**优先级**: P0  
**预计工作量**: 4-6 小时

---

## 目标

复制 GitHub Actions 已验证模式到 Jenkins，实现：

```
Jenkins Build Event → Operator Queue → Human Action → Jenkins API → Build State Updated
```

---

## Jenkins vs GitHub Actions 对比

| 维度 | GitHub Actions | Jenkins | 适配策略 |
|------|----------------|---------|----------|
| 事件模型 | Webhook (JSON) | Webhook / Polling | 优先 Webhook，降级轮询 |
| 审批场景 | Deployment | Input Step / Approval | 映射为 Approval |
| 失败场景 | Workflow Run Failed | Build Failed | 映射为 Incident |
| 动作回写 | Deployment Status | Build Action API | 调用 Jenkins API |
| 认证 | Token | Token / Credentials | 相同模式 |

---

## 核心文件结构

```
src/connectors/jenkins/
├── jenkins_connector.ts           # Jenkins API 客户端
├── jenkins_types.ts               # 类型定义
├── jenkins_webhook_verifier.ts    # Webhook 验证 (可选)
├── jenkins_event_adapter.ts       # 事件映射适配器
├── jenkins_operator_bridge.ts     # Operator 桥接
├── jenkins_build_approval_bridge.ts  # 审批回写桥接
├── jenkins_build_status_adapter.ts   # 构建状态适配器
├── jenkins_integration.ts         # 集成组装
├── jenkins_http_server.ts         # HTTP Server (可复用)
└── index.ts                       # 导出
```

**预计代码量**: ~1500 行

---

## 事件映射表

### 1. Build 事件

| Jenkins 事件 | 类型 | 映射 | 严重级别 |
|-------------|------|------|----------|
| `build_started` | BuildEvent | Task (可选) | low |
| `build_completed` (success) | BuildEvent | - | - |
| `build_completed` (failure) | BuildEvent | Incident | high |
| `build_completed` (unstable) | BuildEvent | Attention | medium |

### 2. Pipeline 事件

| Jenkins 事件 | 类型 | 映射 | 严重级别 |
|-------------|------|------|----------|
| `pipeline_started` | PipelineEvent | Task (可选) | low |
| `pipeline_blocked` | PipelineEvent | Approval | high |
| `input_pending` | PipelineEvent | Approval | high |
| `pipeline_completed` (success) | PipelineEvent | - | - |
| `pipeline_completed` (failure) | PipelineEvent | Incident | high |

### 3. Approval 事件

| Jenkins 事件 | 类型 | 映射 | 动作 |
|-------------|------|------|------|
| `input_step_pending` | InputEvent | Approval | `approve`/`reject` |
| `approval_pending` | ApprovalEvent | Approval | `approve`/`reject` |

---

## 核心接口设计

### JenkinsConnector

```typescript
interface JenkinsConnector {
  // Webhook 处理
  handleWebhook(payload: any, signature?: string): Promise<JenkinsEvent[]>;
  
  // Build 控制
  getBuild(jobName: string, buildNumber: number): Promise<BuildInfo>;
  rerunBuild(jobName: string, buildNumber: number): Promise<void>;
  cancelBuild(jobName: string, buildNumber: number): Promise<void>;
  
  // Approval 控制
  approveInput(jobName: string, buildNumber: number, inputId: string): Promise<void>;
  rejectInput(jobName: string, buildNumber: number, inputId: string, reason?: string): Promise<void>;
  
  // Pipeline 控制
  getPipelineStatus(jobName: string, runId: string): Promise<PipelineStatus>;
}
```

### JenkinsEvent

```typescript
interface JenkinsEvent {
  type: 'build' | 'pipeline' | 'input' | 'approval';
  timestamp: number;
  job: {
    name: string;
    fullName: string;
    url: string;
  };
  build?: {
    number: number;
    status: 'SUCCESS' | 'FAILURE' | 'UNSTABLE' | 'ABORTED';
    duration: number;
  };
  input?: {
    id: string;
    message: string;
    submitter: string;
    parameters: any[];
  };
  sender: {
    userId: string;
    email?: string;
  };
}
```

### MappedJenkinsApproval

```typescript
interface MappedJenkinsApproval {
  approvalId: string;
  scope: string;  // e.g. "Approve deployment to production"
  reason: string;
  requestingAgent: string;
  metadata: {
    source: 'jenkins';
    sourceType: 'input_step' | 'approval';
    jobName: string;
    buildNumber: number;
    inputId: string;
    url: string;
  };
}
```

### MappedJenkinsIncident

```typescript
interface MappedJenkinsIncident {
  incidentId: string;
  type: 'build_failure' | 'pipeline_failure';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  metadata: {
    source: 'jenkins';
    jobName: string;
    buildNumber: number;
    failureReason?: string;
    url: string;
  };
}
```

---

## 验收标准（6 条）

| # | 标准 | 验证方法 |
|---|------|----------|
| 1 | Jenkins Webhook 可接收 | POST `/api/webhooks/jenkins` 返回 200 |
| 2 | Build Failure → Incident | 触发失败构建，检查 `/operator/incidents` |
| 3 | Input Pending → Approval | 触发 Input Step，检查 `/operator/approvals` |
| 4 | Approve → Jenkins Writeback | 执行 approve，检查 Jenkins Input 状态 |
| 5 | Inbox 可见 Jenkins 项 | `/operator/inbox` 包含 Jenkins 来源项 |
| 6 | 完整闭环 | Input → Approval → Approve → Jenkins 继续执行 |

---

## 实现顺序

### Step 1: 基础框架 (1 小时)

- [ ] 创建 `jenkins_types.ts`
- [ ] 创建 `jenkins_connector.ts` (API 客户端)
- [ ] 创建 `jenkins_webhook_verifier.ts` (可选)

### Step 2: 事件映射 (1.5 小时)

- [ ] 创建 `jenkins_event_adapter.ts`
- [ ] 实现 Build Event → Incident 映射
- [ ] 实现 Input Event → Approval 映射

### Step 3: 数据源集成 (1 小时)

- [ ] 创建 `jenkins_approval_data_source.ts`
- [ ] 创建 `jenkins_incident_data_source.ts`
- [ ] 创建 `jenkins_event_handler.ts`

### Step 4: 动作回写 (1 小时)

- [ ] 创建 `jenkins_build_approval_bridge.ts`
- [ ] 实现 `approveInput()` API 调用
- [ ] 实现 `rejectInput()` API 调用

### Step 5: HTTP 暴露 (0.5 小时)

- [ ] 创建 `jenkins_integration.ts`
- [ ] 创建 `jenkins_http_server.ts` (或复用)
- [ ] 注册 Webhook 路由

### Step 6: 实盘验证 (1 小时)

- [ ] 配置 Jenkins Webhook
- [ ] 触发失败构建测试
- [ ] 触发 Input Step 测试
- [ ] 执行 Approve 验证闭环

---

## Jenkins 配置要求

### 1. Webhook 插件

**推荐**: [Generic Webhook Trigger Plugin](https://plugins.jenkins.io/generic-webhook-trigger/)

**安装**:
```
Jenkins → Manage Jenkins → Manage Plugins
→ Available → 搜索 "Generic Webhook Trigger" → Install
```

**配置**:
```
Job Configuration → Build Triggers
→ Generic Webhook Trigger
→ Token: your_secret_token
→ Post content parameter: (JSON path to extract fields)
```

### 2. 认证 Token

**生成**:
```
Jenkins → User → Configure
→ API Token → Add new Token
→ 复制 token (用于 API 调用)
```

### 3. Webhook URL

```
http://<your-server>:3000/api/webhooks/jenkins
```

**ngrok 暴露** (开发环境):
```bash
ngrok http 3000
# 使用 https://xxx.ngrok.io/api/webhooks/jenkins
```

---

## API 端点参考

### Jenkins REST API

| 端点 | 方法 | 用途 |
|------|------|------|
| `/job/{jobName}/{buildNumber}/api/json` | GET | 获取构建信息 |
| `/job/{jobName}/{buildNumber}/input/{inputId}/proceed` | POST | 批准 Input |
| `/job/{jobName}/{buildNumber}/input/{inputId}/abort` | POST | 拒绝 Input |
| `/job/{jobName}/{buildNumber}/rebuild` | POST | 重新构建 |
| `/job/{jobName}/{buildNumber}/stop` | POST | 停止构建 |

### 认证头

```http
Authorization: Basic <base64(username:token)>
```

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
# (Jenkinsfile: input message: 'Deploy to production?')

# 2. 检查 Approval
curl http://localhost:3000/api/operator/approvals | jq '.'

# 3. 验证包含 Input 信息
jq '.approvals[] | select(.metadata.source == "jenkins")'
```

### 测试 3: Approve → Jenkins Continue

```bash
# 1. 执行 Approve
curl -X POST http://localhost:3000/api/operator/actions \
  -H "Content-Type: application/json" \
  -d '{"actionType":"approve","targetType":"approval","targetId":"jenkins_input_xxx"}'

# 2. 检查 Jenkins Pipeline 状态
curl -u user:token \
  "http://jenkins-server/job/test-job/123/api/json" | jq '.currentStages[0].state'

# 3. 验证状态为 RUNNING 或 COMPLETED
```

---

## 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| Jenkins Webhook 配置复杂 | 中 | 中 | 提供详细配置文档 |
| Input Step API 不统一 | 中 | 高 | 优先测试 Generic Webhook |
| 认证失败 | 低 | 高 | 提前验证 Token 有效性 |
| 网络不可达 | 中 | 中 | 使用 ngrok 暴露 |

---

## 与 2B-2 代码复用

### 可复用组件

| 组件 | 复用方式 |
|------|----------|
| `github_actions_approval_data_source.ts` | 复制后修改 metadata |
| `github_actions_incident_data_source.ts` | 复制后修改 metadata |
| `github_actions_event_handler.ts` | 复制后修改事件类型 |
| `github_actions_http_server.ts` | 直接复用或添加 Jenkins 路由 |
| `workflow_event_adapter.ts` | 参考设计模式 |

### 需新开发组件

| 组件 | 原因 |
|------|------|
| `jenkins_connector.ts` | Jenkins API 不同 |
| `jenkins_event_adapter.ts` | 事件模型不同 |
| `jenkins_build_approval_bridge.ts` | 审批回写 API 不同 |

---

## 下一步

### 立即执行
1. [ ] 确认 Jenkins 环境可用
2. [ ] 安装 Generic Webhook Trigger 插件
3. [ ] 生成 API Token
4. [ ] 创建测试 Job

### 本周内
1. [ ] 完成 2B-3A Jenkins Connector 代码
2. [ ] 配置 Webhook
3. [ ] 实盘验证闭环

### 下周内
1. [ ] 2B-3B CircleCI Connector
2. [ ] Phase 2B 总结报告

---

**记录时间**: 2026-04-04 03:50 (Asia/Shanghai)  
**状态**: 蓝图完成，待执行

---

_从 GitHub 到 Jenkins，验证 CI/CD Connector 模式的普适性_
