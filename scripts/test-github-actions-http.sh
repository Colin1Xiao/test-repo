#!/bin/bash
# Phase 2B-2-I-H: GitHub Actions HTTP Server 测试脚本

set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║  Phase 2B-2-I-H: HTTP Endpoints Test                  ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

BASE_URL="http://localhost:3000/api"

# Step 1: 测试 GET /operator/approvals
echo "=== Step 1: GET /operator/approvals ==="
curl -s "$BASE_URL/operator/approvals" | jq '.'
echo ""

# Step 2: 测试 GET /operator/inbox
echo "=== Step 2: GET /operator/inbox ==="
curl -s "$BASE_URL/operator/inbox" | jq '.'
echo ""

# Step 3: 测试 POST /operator/approvals (创建测试审批)
echo "=== Step 3: POST /operator/actions (Approve 测试) ==="
echo "注意：需要先有审批项才能测试"
echo ""

# Step 4: 测试 POST /webhooks/github (模拟 GitHub Webhook)
echo "=== Step 4: POST /webhooks/github (模拟 Deployment) ==="
curl -s -X POST "$BASE_URL/webhooks/github" \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=test" \
  -d '{
    "deployment": {
      "id": 99999,
      "environment": "production",
      "ref": "main",
      "task": "deploy",
      "description": "Test deployment",
      "creator": {
        "login": "test-user"
      },
      "created_at": "2026-04-04T00:00:00Z",
      "updated_at": "2026-04-04T00:00:00Z"
    },
    "repository": {
      "owner": {
        "login": "test-org"
      },
      "name": "test-repo",
      "full_name": "test-org/test-repo"
    }
  }' | jq '.'
echo ""

# Step 5: 验证审批已创建
echo "=== Step 5: 验证审批已创建 ==="
curl -s "$BASE_URL/operator/approvals" | jq '.approvals[] | select(.metadata.deploymentId == 99999)'
echo ""

# Step 6: 测试 Approve 动作
echo "=== Step 6: 测试 Approve 动作 ==="
curl -s -X POST "$BASE_URL/operator/actions" \
  -H "Content-Type: application/json" \
  -d '{
    "actionType": "approve",
    "targetType": "approval",
    "targetId": "github_deployment_99999"
  }' | jq '.'
echo ""

echo "╔════════════════════════════════════════════════════════╗"
echo "║  测试完成                                              ║"
echo "╚════════════════════════════════════════════════════════╝"
