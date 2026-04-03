# Phase 2B-1-L: GitHub Live Validation ✅

**状态**: 完成  
**版本**: 2B-1-L-rc  
**日期**: 2026-04-04

---

## 概述

Phase 2B-1-L 实现了 GitHub Connector 的真实环境验证能力，包括 Live 验证脚本、配置指南、验证报告模板。

---

## 新增文件

```
scripts/
└── github-live-validate.sh          # 5KB - Live 验证脚本

GITHUB_LIVE_VALIDATION_GUIDE.md      # 6KB - 完整配置指南
PHASE_2B-1-L_SUMMARY.md              # 本文档
```

---

## Live 验证脚本

### 使用方法

```bash
# 1. 设置环境变量
export GITHUB_TEST_OWNER=your-owner
export GITHUB_TEST_REPO=your-repo
export GITHUB_TOKEN=your-token
export GITHUB_WEBHOOK_SECRET=your-secret
export GITHUB_WEBHOOK_URL=https://abc123.ngrok.io/webhook/github

# 2. 运行验证脚本
chmod +x scripts/github-live-validate.sh
./scripts/github-live-validate.sh
```

### 验证步骤

```
【1/6】检查环境变量
   ✅ GITHUB_TEST_OWNER
   ✅ GITHUB_TEST_REPO
   ✅ GITHUB_TOKEN
   ✅ GITHUB_WEBHOOK_SECRET

【2/6】验证 GitHub API 连接
   ✅ API 连接正常 (200)

【3/6】检查 Webhook 配置
   ✅ Webhook URL 已配置
   ✅ Webhook 端点可达 (200)

【4/6】创建测试 PR (可选)
   ✅ 测试分支创建成功

【5/6】运行端到端验证脚本
   ✅ 验证脚本执行成功

【6/6】发送测试 Webhook
   ✅ PR Opened (200)
   ✅ Review Requested (200)
   ✅ Check Failed (200)
```

### 退出码

| 退出码 | 含义 |
|--------|------|
| 0 | Live 验证全部通过 |
| 1 | 部分通过 |
| 2 | 全部失败 |
| 3 | 脚本执行错误 |

---

## 配置指南

### 1. GitHub Token 创建

**步骤:**
1. 访问 https://github.com/settings/tokens
2. 生成新 token (classic)
3. 选择权限:
   - `repo` (Full control)
   - `admin:repo_hook` (Manage webhooks)
4. 复制并保存

### 2. Webhook Secret 生成

```bash
# 方法 1: openssl
openssl rand -hex 32

# 方法 2: Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### 3. ngrok 配置

```bash
# 安装
brew install ngrok

# 启动
ngrok http 18789

# 记录 URL
# https://abc123.ngrok.io
```

### 4. GitHub Webhook 配置

**步骤:**
1. 仓库 Settings → Webhooks → Add webhook
2. 配置:
   ```
   Payload URL: https://abc123.ngrok.io/webhook/github
   Content type: application/json
   Secret: <your-secret>
   ```
3. 选择事件:
   - Pull requests
   - Pull request review
   - Check suite

---

## 验证链路

### 链路 A: PR Opened

```
GitHub: 创建 PR
    ↓
Webhook: POST /webhook/github
    ↓
OpenClaw: 接收事件
    ↓
TaskDataSource: 创建 Task
    ↓
验证：oc inbox 显示
```

**验收标准:**
- [ ] PR 创建成功
- [ ] Webhook 发送成功 (200)
- [ ] Task 创建成功
- [ ] `oc inbox` 显示

### 链路 B: Review Requested

```
GitHub: 添加 Reviewer
    ↓
Webhook: POST /webhook/github
    ↓
OpenClaw: 接收事件
    ↓
ApprovalDataSource: 创建 Approval
    ↓
验证：oc approvals 显示
    ↓
用户：oc approve <id>
    ↓
GitHub: Review 状态更新
    ↓
验证：PR Review 显示 Approve
```

**验收标准:**
- [ ] Reviewer 添加成功
- [ ] Approval 创建成功
- [ ] approve 动作执行成功
- [ ] GitHub Review 更新
- [ ] 本地状态同步

### 链路 C: Check Failed

```
GitHub: CI Check 运行
    ↓
GitHub: Check 失败
    ↓
Webhook: POST /webhook/github
    ↓
OpenClaw: 接收事件
    ↓
IncidentDataSource: 创建 Incident
    ↓
验证：oc inbox 显示高优项
```

**验收标准:**
- [ ] Check 运行成功
- [ ] Check 失败
- [ ] Incident 创建成功
- [ ] `oc inbox` 显示

---

## 验证报告模板

```markdown
# GitHub Live Validation Report

**日期:** 2026-04-04
**验证者:** Colin
**仓库:** openclaw/test-repo

## 配置状态

| 项 | 状态 |
|----|------|
| GitHub Token | ✅ |
| Webhook Secret | ✅ |
| Webhook URL | ✅ |
| Webhook 配置 | ✅ |

## 验证结果

| 链路 | 外部输入 | 本地可见 | 动作回写 | 本地刷新 | 结果 |
|------|----------|----------|----------|----------|------|
| PR Opened | ✅ | ✅ | N/A | N/A | ✅ |
| Review Requested | ✅ | ✅ | ✅ | ✅ | ✅ |
| Check Failed | ✅ | ✅ | N/A | N/A | ✅ |

## 问题记录

无

## 结论

✅ Live 验证通过，可以进入 2B-2
```

---

## 环境变量参考

| 变量 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| `GITHUB_TEST_OWNER` | ✅ | - | 测试仓库 Owner |
| `GITHUB_TEST_REPO` | ✅ | - | 测试仓库名称 |
| `GITHUB_TOKEN` | ✅ | - | GitHub API Token |
| `GITHUB_WEBHOOK_SECRET` | ✅ | - | Webhook Secret |
| `GITHUB_WEBHOOK_URL` | ✅ | - | Webhook URL |
| `GITHUB_CREATE_TEST_PR` | ❌ | `false` | 自动创建测试 PR |
| `GITHUB_AUTO_CLEANUP` | ❌ | `false` | 自动清理测试 PR |
| `GITHUB_TEST_REVIEWERS` | ❌ | `colin,tester` | 测试 Reviewer 列表 |

---

## 故障排查

### Webhook 不触发

**检查:**
```bash
# ngrok 状态
curl http://localhost:4040/api/tunnels

# Webhook 日志
tail -f ~/.openclaw/runtime/logs/gateway.log | grep webhook
```

### Approval 未创建

**检查:**
```bash
# 审批数据
cat ~/.openclaw/workspace/data/approvals.jsonl | tail -10

# 连接器日志
tail -f ~/.openclaw/runtime/logs/connector.log
```

### GitHub Review 未更新

**检查:**
```bash
# GitHub API
curl -H "Authorization: token ${GITHUB_TOKEN}" \
  https://api.github.com/repos/${GITHUB_TEST_OWNER}/${GITHUB_TEST_REPO}/pulls/1/reviews
```

---

## 与 Phase 2A 的验证集成

| Phase 2A 模块 | Live 验证方式 |
|--------------|--------------|
| TaskDataSource | PR opened → Task 创建 |
| ApprovalDataSource | Review requested → Approval 创建 |
| IncidentDataSource | Check failed → Incident 创建 |
| InboxService | `oc inbox` / `/inbox` 显示 |
| ExecutionBridge | approve/reject 回写验证 |

---

## 下一步

### 验证通过后

1. **填写验证报告**
   - 记录配置
   - 记录结果
   - 记录问题

2. **进入 2B-2: CI/CD Connector**
   - 复用 GitHub Connector 模式
   - 接入 CI/CD 系统

### 验证失败时

1. **故障排查**
   - 检查配置
   - 检查日志
   - 重新运行

2. **记录问题**
   - 问题描述
   - 解决方案
   - 更新指南

---

_Phase 2B-1-L 状态：✅ 完成 — Live 验证能力已就绪_
