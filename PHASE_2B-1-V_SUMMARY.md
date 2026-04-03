# Phase 2B-1-V: GitHub End-to-End Validation ✅

**状态**: 完成  
**版本**: 2B-1-V-rc  
**日期**: 2026-04-04

---

## 概述

Phase 2B-1-V 实现了 GitHub Connector 的端到端验证能力，包括测试配置、验证脚本、Webhook 测试工具。

---

## 新增文件

```
src/connectors/github/
└── github_validation_config.ts    # 6KB - 验证配置 + 测试用例定义

scripts/
├── validate_github_connector.ts   # 8KB - 端到端验证脚本
└── test_github_webhook.ts         # 5KB - Webhook 测试工具
```

---

## GitHubValidationConfig

**职责**: 定义测试仓库配置、Webhook 配置、测试用例

### 配置项

```ts
interface GitHubValidationConfig {
  owner: string;           // 测试仓库 Owner
  repo: string;            // 测试仓库名称
  webhookSecret: string;   // Webhook Secret
  apiToken: string;        // GitHub API Token
  testReviewers: string[]; // 测试 Reviewer 列表
  mode: 'dry-run' | 'live'; // 运行模式
  webhookUrl?: string;     // Webhook URL (ngrok 等)
  createTestPR?: boolean;  // 创建测试 PR
  autoCleanup?: boolean;   // 自动清理测试 PR
}
```

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `GITHUB_TEST_OWNER` | `openclaw` | 测试仓库 Owner |
| `GITHUB_TEST_REPO` | `test-repo` | 测试仓库名称 |
| `GITHUB_WEBHOOK_SECRET` | `test-secret` | Webhook Secret |
| `GITHUB_TOKEN` | - | GitHub API Token |
| `GITHUB_TEST_REVIEWERS` | `colin,tester` | 测试 Reviewer 列表 |
| `GITHUB_VALIDATION_MODE` | `dry-run` | 运行模式 |
| `GITHUB_WEBHOOK_URL` | - | Webhook URL |
| `GITHUB_CREATE_TEST_PR` | `false` | 创建测试 PR |
| `GITHUB_AUTO_CLEANUP` | `false` | 自动清理 |

---

## 预定义测试用例

### 1. PR Opened

```ts
{
  id: 'pr_opened_001',
  name: 'PR Opened - 基本测试',
  type: 'pr_opened',
  expected: {
    taskCreated: true,
    inboxItemCreated: true,
  },
}
```

**验证链路:**
```
GitHub Webhook (PR opened)
    ↓
GitHubConnector.handleWebhook()
    ↓
GitHubOperatorBridge.handlePREvent()
    ↓
TaskDataSource.addTask()
    ↓
验证：taskCreated = true
```

### 2. Review Requested

```ts
{
  id: 'review_requested_001',
  name: 'Review Requested - 基本测试',
  type: 'review_requested',
  expected: {
    approvalCreated: true,
    inboxItemCreated: true,
  },
}
```

**验证链路:**
```
GitHub Webhook (Review requested)
    ↓
GitHubConnector.handleWebhook()
    ↓
GitHubOperatorBridge.handlePREvent()
    ↓
ApprovalDataSource.addApproval()
    ↓
验证：approvalCreated = true
```

### 3. Check Failed

```ts
{
  id: 'check_failed_001',
  name: 'Check Failed - 基本测试',
  type: 'check_failed',
  expected: {
    incidentCreated: true,
    inboxItemCreated: true,
  },
}
```

**验证链路:**
```
GitHub Webhook (Check failed)
    ↓
GitHubConnector.handleWebhook()
    ↓
GitHubOperatorBridge.handleCheckEvent()
    ↓
IncidentDataSource.addIncident()
    ↓
验证：incidentCreated = true
```

### 4. Approve Action

```ts
{
  id: 'approve_001',
  name: 'Approve Action - 回写测试',
  type: 'approve',
  expected: {
    githubWriteback: true,
  },
}
```

### 5. Reject Action

```ts
{
  id: 'reject_001',
  name: 'Reject Action - 回写测试',
  type: 'reject',
  expected: {
    githubWriteback: true,
  },
}
```

---

## 验证脚本

### 使用方法

```bash
# 运行完整验证
ts-node scripts/validate_github_connector.ts

# 查看 JSON 报告
ts-node scripts/validate_github_connector.ts 2>&1 | tail -50
```

### 输出示例

```
🔍 开始 GitHub Connector 端到端验证...

【1/5】验证配置...
   ✅ 配置验证通过
   模式：dry-run
   仓库：openclaw/test-repo

【2/5】初始化数据源和连接器...
   ✅ 数据源初始化完成
   ✅ 连接器初始化完成

【3/5】执行测试用例...

   测试：PR Opened - 基本测试
   ✅ pr_opened_001 - Task created successfully (12ms)
   
   测试：Review Requested - 基本测试
   ✅ review_requested_001 - Approval created successfully (8ms)
   
   测试：Check Failed - 基本测试
   ✅ check_failed_001 - Incident created successfully (10ms)
   
   测试：Approve Action - 回写测试
   ✅ approve_001 - Approved PR openclaw/test-repo#1 (5ms)
   
   测试：Reject Action - 回写测试
   ✅ reject_001 - Rejected PR openclaw/test-repo#1 (4ms)

【4/5】验证数据面状态...
   任务：1 个 (活跃 1, 阻塞 0, 失败 0)
   审批：1 个 (待处理 1)
   事件：1 个 (活跃 1)

【5/5】生成验证报告...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
验证完成：5/5 通过
总体状态：✅ 通过
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 退出码

| 退出码 | 含义 |
|--------|------|
| 0 | 全部通过 |
| 1 | 部分通过 |
| 2 | 全部失败 |
| 3 | 验证脚本错误 |

---

## Webhook 测试工具

### 使用方法

```bash
# 发送 PR Opened 事件
ts-node scripts/test_github_webhook.ts pr_opened

# 发送 Review Requested 事件
ts-node scripts/test_github_webhook.ts review_requested

# 发送 Check Failed 事件
ts-node scripts/test_github_webhook.ts check_failed

# 发送所有测试事件
ts-node scripts/test_github_webhook.ts all
```

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `GITHUB_WEBHOOK_URL` | `http://localhost:3000/webhook/github` | Webhook URL |
| `GITHUB_WEBHOOK_SECRET` | `test-secret` | Webhook Secret |

### 输出示例

```
🚀 发送 GitHub 测试 Webhook...

Webhook URL: http://localhost:3000/webhook/github
Webhook Secret: ***

📤 发送 pr_opened...
   ✅ 成功 (200)

📤 发送 review_requested...
   ✅ 成功 (200)

📤 发送 check_failed...
   ✅ 成功 (200)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
测试完成
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 验收标准

### ✅ 已完成

1. ✅ GitHubValidationConfig 配置定义完整
2. ✅ 5 个预定义测试用例
3. ✅ validate_github_connector.ts 验证脚本
4. ✅ test_github_webhook.ts Webhook 测试工具
5. ✅ 配置验证（validateConfig）
6. ✅ 测试报告生成（ValidationReport）

### 🟡 待完成

1. 🟡 真实 GitHub Webhook 接收验证
2. 🟡 Live 模式验证（真实 GitHub API）
3. 🟡 CLI/Telegram 显示验证
4. 🟡 完整端到端闭环验证

---

## 端到端验证流程

### 步骤 1: 配置环境

```bash
# 设置环境变量
export GITHUB_TEST_OWNER=your-owner
export GITHUB_TEST_REPO=your-repo
export GITHUB_WEBHOOK_SECRET=your-secret
export GITHUB_TOKEN=your-token
export GITHUB_VALIDATION_MODE=dry-run  # 或 live
```

### 步骤 2: 启动本地服务器

```bash
# 启动 OpenClaw Gateway
openclaw gateway start

# 或使用 ngrok 暴露本地服务
ngrok http 3000
# 记录 ngrok URL，用于 GitHub Webhook 配置
```

### 步骤 3: 配置 GitHub Webhook

1. 进入测试仓库 Settings → Webhooks
2. 添加 Webhook:
   - Payload URL: `https://<ngrok-url>/webhook/github`
   - Content type: `application/json`
   - Secret: `$GITHUB_WEBHOOK_SECRET`
   - Events: `Pull requests`, `Check suites`

### 步骤 4: 运行验证脚本

```bash
ts-node scripts/validate_github_connector.ts
```

### 步骤 5: 发送测试 Webhook

```bash
ts-node scripts/test_github_webhook.ts all
```

### 步骤 6: 验证结果

```bash
# 查看 CLI inbox
oc inbox

# 查看 Telegram inbox
/inbox
```

---

## 与 Phase 2A 的验证集成

| Phase 2A 模块 | 验证方式 |
|--------------|----------|
| TaskDataSource | `validate_github_connector.ts` 检查 taskCreated |
| ApprovalDataSource | `validate_github_connector.ts` 检查 approvalCreated |
| IncidentDataSource | `validate_github_connector.ts` 检查 incidentCreated |
| InboxService | `oc inbox` / `/inbox` 显示 GitHub 来源项 |
| ExecutionBridge | approve/reject 动作回写验证 |

---

## 下一步

### 选项 1: Live 模式验证

**目标:** 使用真实 GitHub 仓库验证

**行动:**
1. 配置真实 GitHub 仓库
2. 设置 `GITHUB_VALIDATION_MODE=live`
3. 创建真实测试 PR
4. 验证 approve/reject 回写

### 选项 2: CLI/Telegram 显示验证

**目标:** 验证 GitHub 来源项在入口层显示

**行动:**
1. `oc inbox` 显示 GitHub 来源项
2. `/inbox` 显示 GitHub 来源项
3. 验证 metadata.source = 'github'

### 选项 3: 进入 2B-2 CI/CD Connector

**目标:** 复用 GitHub Connector 模式

**行动:**
1. 创建 CI/CD Connector
2. 映射 Build/Deploy 事件 → Task/Incident
3. 验证端到端链路

---

_Phase 2B-1-V 状态：✅ 完成 — GitHub 端到端验证能力已就绪_
