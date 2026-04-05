# Phase 2B-2-I Quick Start

**5 分钟快速测试 GitHub Actions Integration**

---

## 前置条件

- ✅ Node.js 已安装
- ✅ GitHub 账号
- ✅ OpenClaw 运行中

---

## Step 1: 配置环境变量（1 分钟）

```bash
# 编辑 ~/.zshrc 或 ~/.bashrc
export GITHUB_TOKEN=ghp_xxx  # 你的 GitHub Personal Access Token
export GITHUB_WEBHOOK_SECRET=your_secret  # 自定义密钥

# 使配置生效
source ~/.zshrc  # 或 source ~/.bashrc
```

**创建 GitHub Token**:
1. 访问 https://github.com/settings/tokens
2. 点击 "Generate new token (classic)"
3. 勾选权限：`repo` (完整仓库权限)
4. 生成并复制 token

---

## Step 2: 创建测试仓库（1 分钟）

```bash
# 使用 GitHub CLI（推荐）
gh repo create test-github-actions --private --clone

# 或手动创建：
# 1. 访问 https://github.com/new
# 2. 创建私有仓库 test-github-actions
# 3. git clone 到本地
```

---

## Step 3: 配置 Webhook（1 分钟）

```bash
# 使用 GitHub CLI
gh api repos/YOUR_USERNAME/test-github-actions/hooks \
  -X POST \
  -F config[url]="http://localhost:18789/webhooks/github" \
  -F config[content_type]="application/json" \
  -F config[secret]="$GITHUB_WEBHOOK_SECRET" \
  -F events=["deployment","workflow_run"] \
  -F active=true
```

**或手动配置**:
1. 访问仓库 Settings → Webhooks
2. 点击 "Add webhook"
3. Payload URL: `http://localhost:18789/webhooks/github`
4. Content type: `application/json`
5. Secret: `GITHUB_WEBHOOK_SECRET`
6. Events: 选择 "Let me select individual events"
   - ✅ Deployments
   - ✅ Workflow runs
7. 保存

---

## Step 4: 触发测试 Deployment（1 分钟）

```bash
cd test-github-actions

# 创建测试文件
echo "# Test Deployment" > README.md
git add .
git commit -m "Initial commit"
git push

# 触发 Deployment
gh api repos/YOUR_USERNAME/test-github-actions/deployments \
  -X POST \
  -F ref="main" \
  -F environment="production" \
  -F task="deploy" \
  -F description="Test deployment from CLI"
```

---

## Step 5: 验证审批创建（1 分钟）

### 方法 1: 检查日志

```bash
# 查看 OpenClaw 日志
tail -f /tmp/openclaw/openclaw-*.log | grep "Created approval"
```

### 方法 2: 调用 API

```bash
curl http://localhost:18789/operator/approvals | jq '.[] | select(.metadata.source == "github_actions")'
```

**预期输出**:
```json
{
  "approvalId": "github_deployment_12345",
  "scope": "Deploy to production",
  "status": "pending",
  "metadata": {
    "source": "github_actions",
    "deploymentId": 12345,
    "environment": "production",
    "repository": "YOUR_USERNAME/test-github-actions"
  }
}
```

### 方法 3: 使用 CLI

```bash
# 查看待处理审批
oc inbox

# 或查看审批列表
oc approvals
```

---

## Step 6: 执行 Approve 动作

### 方法 1: CLI

```bash
# 批准部署
oc approve github_deployment_12345
```

### 方法 2: Telegram

发送 `/inbox` 到 Telegram Bot，点击 Approve 按钮。

### 方法 3: API

```bash
curl -X POST http://localhost:18789/operator/actions \
  -H "Content-Type: application/json" \
  -d '{
    "actionType": "approve",
    "targetType": "approval",
    "targetId": "github_deployment_12345"
  }'
```

---

## Step 7: 验证 GitHub 状态更新

```bash
# 检查 Deployment Status
gh api repos/YOUR_USERNAME/test-github-actions/deployments/12345/statuses
```

**预期输出**:
```json
{
  "state": "success",
  "description": "Approved via OpenClaw Operator",
  "creator": {
    "login": "YOUR_USERNAME"
  }
}
```

---

## 故障排查

### Webhook 未触发

**检查**:
```bash
# 1. 检查 Webhook 配置
gh api repos/YOUR_USERNAME/test-github-actions/hooks

# 2. 检查 OpenClaw 日志
tail -100 /tmp/openclaw/openclaw-*.log

# 3. 检查 GitHub Webhook 投递记录
# 访问仓库 Settings → Webhooks → 最近投递
```

### 审批未创建

**检查**:
```bash
# 1. 检查环境变量
echo $GITHUB_TOKEN
echo $GITHUB_WEBHOOK_SECRET

# 2. 检查 Connector 初始化
# 查看代码中是否正确传入配置

# 3. 检查事件处理器日志
tail -f /tmp/openclaw/openclaw-*.log | grep "GitHubActionsEventHandler"
```

### Approve 动作失败

**检查**:
```bash
# 1. 检查 Token 权限
gh api user

# 2. 检查 sourceId 格式
# 应该是：owner/repo/deployments/id

# 3. 检查 GitHub API 调用日志
tail -f /tmp/openclaw/openclaw-*.log | grep "approveDeployment"
```

---

## 清理测试

```bash
# 删除测试仓库
gh repo delete YOUR_USERNAME/test-github-actions --yes

# 或删除 Webhook
gh api repos/YOUR_USERNAME/test-github-actions/hooks/HOOK_ID -X DELETE
```

---

## 下一步

✅ 快速测试完成 → 进入完整验收测试

**完整验收测试**:
1. 测试 Workflow Failed → Incident
2. 测试 Auto-Approve Staging
3. 测试 Reject 动作
4. 测试完整闭环

参考：`docs/PHASE_2B-2-I_COMPLETION_REPORT.md`

---

**预计时间**: 5-10 分钟  
**难度**: ⭐⭐☆☆☆
