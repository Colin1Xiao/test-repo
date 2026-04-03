# GitHub Live Validation Guide

**Phase 2B-1-L - 真实 GitHub 环境端到端验证指南**

---

## 概述

本指南指导你完成 GitHub Connector 的真实环境验证，确保第一条 workflow connector 闭环在真实世界中跑通。

---

## 前置条件

### 1. GitHub 仓库

- ✅ 一个测试仓库（建议专用，避免污染正式仓库）
- ✅ 仓库管理员权限（用于配置 Webhook）
- ✅ 至少一个 collaborator（用于测试 review 流程）

### 2. GitHub Token

**创建步骤:**

1. 访问 https://github.com/settings/tokens
2. 点击 "Generate new token (classic)"
3. 选择权限:
   - ✅ `repo` (Full control of private repositories)
   - ✅ `admin:repo_hook` (Manage repository webhooks)
4. 生成并复制 token
5. 设置环境变量:
   ```bash
   export GITHUB_TOKEN=ghp_xxxxxxxxxxxx
   ```

### 3. Webhook Secret

**生成方法:**
```bash
# 使用 openssl 生成随机 secret
openssl rand -hex 32

# 或使用 Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

设置环境变量:
```bash
export GITHUB_WEBHOOK_SECRET=your_secret_here
```

### 4. 本地服务器

**选项 A: 本地直接访问 (仅限局域网测试)**
```bash
# 启动 OpenClaw Gateway
openclaw gateway start

# Webhook URL: http://<your-local-ip>:18789/webhook/github
```

**选项 B: 使用 ngrok (推荐)**
```bash
# 安装 ngrok
brew install ngrok  # macOS
# 或从 https://ngrok.com 下载

# 启动 ngrok
ngrok http 18789

# 记录 ngrok URL，例如：https://abc123.ngrok.io
# Webhook URL: https://abc123.ngrok.io/webhook/github
```

---

## 配置步骤

### Step 1: 设置环境变量

```bash
# 必需环境变量
export GITHUB_TEST_OWNER=your-github-username
export GITHUB_TEST_REPO=test-repo
export GITHUB_TOKEN=ghp_xxxxxxxxxxxx
export GITHUB_WEBHOOK_SECRET=your_secret_here
export GITHUB_WEBHOOK_URL=https://abc123.ngrok.io/webhook/github

# 可选环境变量
export GITHUB_CREATE_TEST_PR=true        # 自动创建测试 PR
export GITHUB_AUTO_CLEANUP=true          # 自动清理测试 PR
export GITHUB_TEST_REVIEWERS=colin,tester  # 测试 reviewer 列表
```

### Step 2: 配置 GitHub Webhook

1. 进入测试仓库: https://github.com/`<owner>`/`<repo>`/settings/hooks

2. 点击 "Add webhook"

3. 填写配置:
   ```
   Payload URL: <GITHUB_WEBHOOK_URL>
   Content type: application/json
   Secret: <GITHUB_WEBHOOK_SECRET>
   ```

4. 选择事件:
   - ✅ Pull requests
   - ✅ Pull request review
   - ✅ Pull request review comment
   - ✅ Check suite
   - ✅ Check run

5. 点击 "Add webhook"

6. 验证 Webhook:
   - 点击刚创建的 Webhook
   - 点击 "Redeliver" 测试
   - 查看响应状态码（应为 200）

### Step 3: 运行 Live 验证脚本

```bash
# 赋予执行权限
chmod +x scripts/github-live-validate.sh

# 运行验证
./scripts/github-live-validate.sh
```

### Step 4: 创建测试 PR

**手动创建:**

1. 在测试仓库创建一个新分支
   ```bash
   git checkout -b test/pr-validation
   ```

2. 添加一个测试文件
   ```bash
   echo "# Test PR" > TEST.md
   git add TEST.md
   git commit -m "Test PR for validation"
   git push origin test/pr-validation
   ```

3. 在 GitHub 上创建 PR
   - Base: `main`
   - Compare: `test/pr-validation`
   - Title: `Test PR for OpenClaw Validation`

**自动创建:**
```bash
export GITHUB_CREATE_TEST_PR=true
./scripts/github-live-validate.sh
```

### Step 5: 请求 Review

1. 打开刚创建的 PR
2. 右侧 "Reviewers" → 选择测试 reviewer
3. 这会触发 `review_requested` 事件

### Step 6: 验证 OpenClaw 接收

**CLI 验证:**
```bash
# 查看 Inbox
oc inbox

# 查看待处理审批
oc approvals

# 查看任务
oc tasks
```

**Telegram 验证:**
```
/inbox
/approvals
/tasks
```

**预期结果:**
- PR opened → Task + Inbox Item
- Review requested → Approval + Inbox Item

### Step 7: 执行 Approve/Reject 动作

**CLI:**
```bash
# 批准 PR
oc approve <approval_id>

# 拒绝 PR
oc reject <approval_id>
```

**Telegram:**
- 打开 `/inbox` 或 `/approvals`
- 点击 "Approve" 或 "Reject" 按钮

### Step 8: 验证 GitHub Review 状态

1. 打开测试 PR
2. 查看右侧 "Review" 状态
3. 应该显示你的 Approve/Request changes

---

## 验证检查清单

### 链路 A: PR Opened

- [ ] GitHub PR 创建成功
- [ ] Webhook 发送成功 (GitHub → 200 响应)
- [ ] OpenClaw 接收事件
- [ ] Task 创建成功
- [ ] `oc inbox` 显示 GitHub 来源项
- [ ] `/inbox` (Telegram) 显示 GitHub 来源项

### 链路 B: Review Requested

- [ ] Reviewer 添加成功
- [ ] Webhook 发送成功
- [ ] OpenClaw 接收事件
- [ ] Approval 创建成功
- [ ] `oc approvals` 显示待处理审批
- [ ] `/approvals` (Telegram) 显示待处理审批
- [ ] 执行 approve/reject 动作
- [ ] GitHub Review 状态更新
- [ ] 本地 Approval 状态同步

### 链路 C: Check Failed

- [ ] CI Check 运行
- [ ] Check 失败
- [ ] Webhook 发送成功
- [ ] OpenClaw 接收事件
- [ ] Incident 创建成功
- [ ] `oc inbox` 显示高优项

---

## 故障排查

### Webhook 不触发

**检查项:**
1. Webhook URL 是否正确
2. Webhook Secret 是否匹配
3. 事件订阅是否勾选
4. ngrok 是否正在运行

**调试命令:**
```bash
# 检查 ngrok 状态
curl http://localhost:4040/api/tunnels

# 查看 Webhook 日志
tail -f ~/.openclaw/runtime/logs/gateway.log | grep webhook
```

### Approval 未创建

**检查项:**
1. `review_requested` 事件是否触发
2. `github_operator_bridge.ts` 日志
3. ApprovalDataSource 状态

**调试命令:**
```bash
# 查看审批数据
cat ~/.openclaw/workspace/data/approvals.jsonl | tail -10
```

### GitHub Review 未更新

**检查项:**
1. GITHUB_TOKEN 权限是否足够
2. ReviewBridge 是否调用
3. API 响应日志

**调试命令:**
```bash
# 手动测试 GitHub API
curl -H "Authorization: token ${GITHUB_TOKEN}" \
  https://api.github.com/repos/${GITHUB_TEST_OWNER}/${GITHUB_TEST_REPO}/pulls/1/reviews
```

---

## 验证报告模板

完成验证后，填写以下报告:

```markdown
# GitHub Live Validation Report

**日期:** 2026-04-04
**验证者:** <你的名字>
**仓库:** <owner>/<repo>

## 配置状态

| 项 | 状态 |
|----|------|
| GitHub Token | ✅ / ❌ |
| Webhook Secret | ✅ / ❌ |
| Webhook URL | ✅ / ❌ |
| Webhook 配置 | ✅ / ❌ |

## 验证结果

| 链路 | 外部输入 | 本地可见 | 动作回写 | 本地刷新 | 结果 |
|------|----------|----------|----------|----------|------|
| PR Opened | ✅ / ❌ | ✅ / ❌ | N/A | N/A | ✅ / ❌ |
| Review Requested | ✅ / ❌ | ✅ / ❌ | ✅ / ❌ | ✅ / ❌ | ✅ / ❌ |
| Check Failed | ✅ / ❌ | ✅ / ❌ | N/A | N/A | ✅ / ❌ |

## 问题记录

<记录遇到的问题和解决方案>

## 结论

<验证是否通过，是否可以进入 2B-2>
```

---

## 下一步

验证通过后，可以:

1. **进入 2B-2: CI/CD Connector**
   - 复用 GitHub Connector 模式
   - 接入 GitHub Actions / Jenkins / CircleCI

2. **优化 GitHub Connector**
   - 增加更多事件类型
   - 改进错误处理
   - 增加批量操作支持

---

_Phase 2B-1-L Live Validation 完成标志：三条链路全部 ✅_
