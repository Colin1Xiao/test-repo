#!/bin/bash
# Phase 2B-2-I: GitHub Actions Live Validation (简化版)
# 使用现有仓库 test-repo

set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║  Phase 2B-2-I: GitHub Actions Live Validation          ║"
echo "║  简化版 - 使用现有仓库                                  ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# 加载环境变量
set -a && source ~/.openclaw/workspace/.env.github && set +a

OWNER="Colin1Xiao"
REPO="test-repo"
GH_TOKEN="$GITHUB_TOKEN"

echo "👤 仓库：$OWNER/$REPO"
echo ""

# Step 1: 配置 Webhook
echo "=== Step 1: 配置 Webhook ==="
WEBHOOK_URL="http://localhost:18789/webhooks/github"

# 检查是否已存在 Webhook
EXISTING_WEBHOOK=$(curl -s -H "Authorization: token $GH_TOKEN" \
  "https://api.github.com/repos/$OWNER/$REPO/hooks" | jq -r '.[] | select(.config.url == "'$WEBHOOK_URL'") | .id')

if [ -n "$EXISTING_WEBHOOK" ] && [ "$EXISTING_WEBHOOK" != "null" ]; then
    echo "ℹ️  Webhook 已存在 (ID: $EXISTING_WEBHOOK)"
    echo "更新 Webhook 配置..."
    curl -s -X PATCH -H "Authorization: token $GH_TOKEN" \
      -H "Content-Type: application/json" \
      "https://api.github.com/repos/$OWNER/$REPO/hooks/$EXISTING_WEBHOOK" \
      -d "{
        \"secret\": \"$GITHUB_WEBHOOK_SECRET\",
        \"events\": [\"deployment\", \"workflow_run\"],
        \"active\": true
      }" | jq '.'
else
    echo "创建新 Webhook..."
    curl -s -X POST -H "Authorization: token $GH_TOKEN" \
      -H "Content-Type: application/json" \
      "https://api.github.com/repos/$OWNER/$REPO/hooks" \
      -d "{
        \"config\": {
          \"url\": \"$WEBHOOK_URL\",
          \"content_type\": \"json\",
          \"secret\": \"$GITHUB_WEBHOOK_SECRET\"
        },
        \"events\": [\"deployment\", \"workflow_run\"],
        \"active\": true
      }" | jq '.'
fi
echo ""

# Step 2: 触发 Deployment
echo "=== Step 2: 触发 Deployment ==="
DEPLOYMENT_RESPONSE=$(curl -s -X POST -H "Authorization: token $GH_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.github.com/repos/$OWNER/$REPO/deployments" \
  -d '{
    "ref": "main",
    "environment": "production",
    "task": "deploy",
    "description": "Phase 2B-2-I Live Validation Test"
  }')

DEPLOYMENT_ID=$(echo "$DEPLOYMENT_RESPONSE" | jq -r '.id')

if [ "$DEPLOYMENT_ID" == "null" ] || [ -z "$DEPLOYMENT_ID" ]; then
    echo "❌ Deployment 创建失败"
    echo "$DEPLOYMENT_RESPONSE" | jq '.'
    exit 1
fi

echo "✅ Deployment 创建成功"
echo "Deployment ID: $DEPLOYMENT_ID"
echo ""

# Step 3: 等待 Webhook 处理
echo "=== Step 3: 等待 Webhook 处理 (5 秒) ==="
sleep 5
echo ""

# Step 4: 检查 OpenClaw 审批
echo "=== Step 4: 检查 OpenClaw 审批 ==="
APPROVALS_RESPONSE=$(curl -s http://localhost:18789/operator/approvals)
GITHUB_APPROVAL=$(echo "$APPROVALS_RESPONSE" | jq -r ".[] | select(.metadata.source == \"github_actions\") | select(.metadata.deploymentId == $DEPLOYMENT_ID)" | head -1)

if [ -n "$GITHUB_APPROVAL" ] && [ "$GITHUB_APPROVAL" != "null" ]; then
    echo "✅ 成功：发现 GitHub Actions 审批"
    echo "$GITHUB_APPROVAL" | jq '{approvalId, scope, status, environment: .metadata.environment}'
else
    echo "⚠️  未发现 GitHub Actions 审批"
    echo ""
    echo "所有审批:"
    echo "$APPROVALS_RESPONSE" | jq '.'
fi
echo ""

# Step 5: 检查 Inbox
echo "=== Step 5: 检查 Inbox ==="
INBOX_RESPONSE=$(curl -s http://localhost:18789/operator/inbox)
echo "$INBOX_RESPONSE" | jq '{summary, itemCount: (.items | length)}'
echo ""

# Step 6: 输出 Approve 命令
echo "=== Step 6: 执行 Approve 动作 ==="
echo "运行以下命令执行 Approve:"
echo ""
echo "curl -X POST http://localhost:18789/operator/actions \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"actionType\":\"approve\",\"targetType\":\"approval\",\"targetId\":\"github_deployment_$DEPLOYMENT_ID\"}'"
echo ""

# Step 7: 验证 GitHub Deployment 状态
echo "=== Step 7: 当前 GitHub Deployment 状态 ==="
curl -s -H "Authorization: token $GH_TOKEN" \
  "https://api.github.com/repos/$OWNER/$REPO/deployments/$DEPLOYMENT_ID/statuses" | jq '.' || echo "暂无状态更新"
echo ""

echo "╔════════════════════════════════════════════════════════╗"
echo "║  测试完成                                              ║"
echo "╚════════════════════════════════════════════════════════╝"
