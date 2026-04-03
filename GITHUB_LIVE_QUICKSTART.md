# GitHub Live Validation 快速启动

## 方式 A: 使用配置向导 (推荐)

```bash
# 1. 运行配置向导
./scripts/setup-github-validation.sh

# 2. 按提示输入:
#    - GitHub Token
#    - GitHub Username
#    - 测试仓库名称

# 3. 运行验证
./scripts/github-live-validate.sh
```

---

## 方式 B: 手动配置

### 步骤 1: 创建 GitHub Token

1. 访问 https://github.com/settings/tokens
2. 点击 "Generate new token (classic)"
3. 选择权限:
   - ✅ `repo` (Full control of private repositories)
   - ✅ `admin:repo_hook` (Manage repository webhooks)
4. 生成并复制 token

### 步骤 2: 生成 Webhook Secret

```bash
openssl rand -hex 32
# 复制输出，例如：a1b2c3d4e5f6...
```

### 步骤 3: 启动 ngrok

```bash
ngrok http 18789
# 复制输出的 URL，例如：https://abc123.ngrok.io
```

### 步骤 4: 设置环境变量

```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxx
export GITHUB_WEBHOOK_SECRET=a1b2c3d4e5f6...
export GITHUB_TEST_OWNER=your-username
export GITHUB_TEST_REPO=test-repo
export GITHUB_WEBHOOK_URL=https://abc123.ngrok.io/webhook/github
```

### 步骤 5: 运行验证

```bash
./scripts/github-live-validate.sh
```

---

## 配置 GitHub Webhook

1. 进入仓库 Settings → Webhooks
2. 点击 "Add webhook"
3. 填写:
   ```
   Payload URL: <ngrok-url>/webhook/github
   Content type: application/json
   Secret: <webhook-secret>
   ```
4. 选择事件:
   - ✅ Pull requests
   - ✅ Pull request review
   - ✅ Check suites
5. 点击 "Add webhook"

---

## 验证检查清单

执行前:
- [ ] GitHub Token 已创建
- [ ] Webhook Secret 已生成
- [ ] ngrok 正在运行
- [ ] 环境变量已设置

执行后:
- [ ] `./scripts/github-live-validate.sh` 运行成功
- [ ] Webhook 配置完成
- [ ] 测试 PR 已创建
- [ ] `oc inbox` 显示 GitHub 来源项

---

## 快速命令

```bash
# 运行配置向导
./scripts/setup-github-validation.sh

# 运行验证
./scripts/github-live-validate.sh

# 发送测试 Webhook
ts-node scripts/test_github_webhook.ts all

# 查看 CLI inbox
oc inbox

# 查看 Telegram inbox
/inbox
```

---

## 故障排查

### ngrok 未运行

```bash
ngrok http 18789
```

### 环境变量未设置

```bash
# 从配置文件加载
source ~/.openclaw/workspace/.env.github
```

### Webhook 不触发

```bash
# 查看 ngrok 日志
curl http://localhost:4040/api/requests/http

# 查看 Gateway 日志
tail -f ~/.openclaw/runtime/logs/gateway.log | grep webhook
```

---

**需要帮助？** 运行 `./scripts/setup-github-validation.sh` 自动引导配置。
