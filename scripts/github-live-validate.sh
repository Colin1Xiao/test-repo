#!/bin/bash
# Phase 2B-2-I: GitHub Actions Live Validation
# 实盘测试脚本

set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║  Phase 2B-2-I: GitHub Actions Live Validation          ║"
echo "║  小龙智能系统 - 实盘测试                                ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# 检查环境变量
if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ 错误：GITHUB_TOKEN 未设置"
    echo ""
    echo "请先设置环境变量："
    echo "  export GITHUB_TOKEN=ghp_xxx"
    echo ""
    exit 1
fi

if [ -z "$GITHUB_WEBHOOK_SECRET" ]; then
    echo "❌ 错误：GITHUB_WEBHOOK_SECRET 未设置"
    echo ""
    echo "请先设置环境变量："
    echo "  export GITHUB_WEBHOOK_SECRET=your_secret"
    echo ""
    exit 1
fi

echo "✅ 环境变量检查通过"
echo ""

# 获取用户名
USERNAME=$(gh api user | jq -r '.login')
echo "👤 GitHub 用户：$USERNAME"

# 测试仓库名称
TEST_REPO="test-github-actions-$(date +%s)"
echo "📦 测试仓库：$TEST_REPO"
echo ""

# Step 1: 创建测试仓库
echo "=== Step 1: 创建测试仓库 ==="
gh repo create "$TEST_REPO" --private --clone --source=/dev/null 2>/dev/null || {
    echo "⚠️  仓库创建失败（可能已存在），尝试使用现有仓库..."
}
echo ""

# Step 2: 配置 Webhook
echo "=== Step 2: 配置 Webhook ==="
WEBHOOK_URL="http://localhost:18789/webhooks/github"
echo "Webhook URL: $WEBHOOK_URL"

gh api repos/$USERNAME/$TEST_REPO/hooks \
  -X POST \
  -F config[url]="$WEBHOOK_URL" \
  -F config[content_type]="json" \
  -F config[secret]="$GITHUB_WEBHOOK_SECRET" \
  -F events=["deployment","workflow_run"] \
  -F active=true || {
    echo "⚠️  Webhook 创建失败，可能已存在"
}
echo ""

# Step 3: 创建测试文件并提交
echo "=== Step 3: 创建测试文件 ==="
cd "$TEST_REPO" 2>/dev/null || {
    echo "⚠️  仓库目录不存在，跳过本地克隆步骤"
    echo ""
    echo "请手动创建仓库后继续："
    echo "  1. 访问 https://github.com/$USERNAME/$TEST_REPO"
    echo "  2. 创建 README.md"
    echo "  3. 然后手动触发 Deployment（见下方 API 调用）"
    echo ""
    exit 1
}

echo "# Test Repository for GitHub Actions Integration" > README.md
echo "Phase 2B-2-I Live Validation" >> README.md
git add .
git commit -m "Initial commit for 2B-2-I validation" || true
git push -u origin main 2>/dev/null || {
    echo "⚠️  Git push 失败，尝试继续..."
}
cd ..
echo ""

# Step 4: 触发 Deployment
echo "=== Step 4: 触发 Deployment ==="
DEPLOYMENT_RESPONSE=$(gh api repos/$USERNAME/$TEST_REPO/deployments \
  -X POST \
  -F ref="main" \
  -F environment="production" \
  -F task="deploy" \
  -F description="Phase 2B-2-I Live Validation Test")

DEPLOYMENT_ID=$(echo "$DEPLOYMENT_RESPONSE" | jq -r '.id')
echo "Deployment ID: $DEPLOYMENT_ID"
echo ""

# Step 5: 等待 Webhook 处理
echo "=== Step 5: 等待 Webhook 处理 (5 秒) ==="
sleep 5
echo ""

# Step 6: 检查 OpenClaw 审批
echo "=== Step 6: 检查 OpenClaw 审批 ==="
echo "调用：curl http://localhost:18789/operator/approvals"
echo ""

APPROVALS_RESPONSE=$(curl -s http://localhost:18789/operator/approvals)
echo "$APPROVALS_RESPONSE" | jq '.'

# 检查是否包含 GitHub Actions 来源的审批
GITHUB_APPROVAL=$(echo "$APPROVALS_RESPONSE" | jq -r ".[] | select(.metadata.source == \"github_actions\")" | head -1)

if [ -n "$GITHUB_APPROVAL" ]; then
    echo ""
    echo "✅ 成功：发现 GitHub Actions 审批"
    echo "$GITHUB_APPROVAL" | jq '.approvalId, .scope, .status, .metadata.environment'
else
    echo ""
    echo "⚠️  警告：未发现 GitHub Actions 审批"
    echo ""
    echo "可能原因："
    echo "  1. Webhook 未触发（检查 GitHub 仓库 Settings → Webhooks）"
    echo "  2. OpenClaw 未运行（检查 openclaw gateway status）"
    echo "  3. 审批数据源未集成（检查代码集成）"
    echo ""
fi
echo ""

# Step 7: 检查 Inbox
echo "=== Step 7: 检查 Inbox ==="
echo "调用：curl http://localhost:18789/operator/inbox"
echo ""

INBOX_RESPONSE=$(curl -s http://localhost:18789/operator/inbox)
echo "$INBOX_RESPONSE" | jq '.summary, .items[:3]'
echo ""

# Step 8: 测试 Approve 动作（可选）
echo "=== Step 8: 测试 Approve 动作（可选）==="
echo ""
echo "要执行 Approve 动作，请运行："
echo ""
echo "  curl -X POST http://localhost:18789/operator/actions \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"actionType\":\"approve\",\"targetType\":\"approval\",\"targetId\":\"github_deployment_$DEPLOYMENT_ID\"}'"
echo ""
echo "或通过 Telegram Bot 发送 /inbox 然后点击 Approve 按钮"
echo ""

# Step 9: 验证 GitHub Deployment 状态
echo "=== Step 9: 验证 GitHub Deployment 状态 ==="
echo "调用：gh api repos/$USERNAME/$TEST_REPO/deployments/$DEPLOYMENT_ID/statuses"
echo ""

gh api repos/$USERNAME/$TEST_REPO/deployments/$DEPLOYMENT_ID/statuses 2>/dev/null | jq '.' || {
    echo "⚠️  无法获取 Deployment 状态（可能还未创建）"
}
echo ""

# 总结
echo "╔════════════════════════════════════════════════════════╗"
echo "║  测试完成                                              ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "下一步："
echo "  1. 检查上述输出，确认审批已创建"
echo "  2. 执行 Approve 动作（见 Step 8 命令）"
echo "  3. 再次检查 GitHub Deployment 状态是否更新为 success"
echo ""
echo "清理测试仓库："
echo "  gh repo delete $USERNAME/$TEST_REPO --yes"
echo ""
