#!/bin/bash
# Phase 2C-1-I: Trading Live Validation
# 交易工程运维实盘测试脚本

set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║  Phase 2C-1-I: Trading Live Validation                ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# 检查 HTTP Server
echo "=== 检查 HTTP Server 状态 ==="
if ! curl -s http://localhost:3000/api/operator/approvals > /dev/null 2>&1; then
    echo "❌ GitHub Actions Server 未运行 (端口 3000)"
    exit 1
fi
echo "✅ GitHub Actions Server 运行中"
echo ""

# 测试 1: 创建 Release Request 事件
echo "=== 测试 1: Release Request → Approval ==="
curl -s -X POST http://localhost:3000/api/webhooks/github \
  -H "Content-Type: application/json" \
  -d '{
    "deployment": {
      "id": 999999,
      "environment": "production",
      "ref": "main",
      "task": "deploy",
      "description": "Trading Strategy Release: momentum_v2",
      "creator": {"login": "colin"},
      "created_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
      "updated_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    },
    "repository": {
      "owner": {"login": "Colin1Xiao"},
      "name": "trading-system",
      "full_name": "Colin1Xiao/trading-system"
    }
  }' | jq '{success, approvalsCreated}'

echo ""
echo "验证 Approval 创建:"
curl -s http://localhost:3000/api/operator/approvals | jq '.approvals[] | select(.metadata.environment == "production") | {approvalId, scope, status}' || echo "暂无 Approval"
echo ""

# 测试 2: 模拟 System Alert 事件
echo "=== 测试 2: System Alert → Incident ==="
# 这里需要扩展 webhook 支持 trading alert
# 暂时使用 GitHub Actions webhook 模拟
curl -s -X POST http://localhost:3000/api/webhooks/github \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_run": {
      "id": 888888,
      "name": "trading-system-health",
      "run_number": 42,
      "status": "completed",
      "conclusion": "failure",
      "head_branch": "main",
      "head_sha": "abc123"
    },
    "workflow": {
      "id": 111,
      "name": "trading-system-health"
    },
    "repository": {
      "owner": {"login": "Colin1Xiao"},
      "name": "trading-system",
      "full_name": "Colin1Xiao/trading-system"
    },
    "sender": {"login": "system"}
  }' | jq '{success, incidentsCreated}'

echo ""
echo "验证 Incident 创建:"
curl -s http://localhost:3000/api/operator/incidents 2>/dev/null | jq '.incidents[] | select(.metadata.source == "github_actions") | {incidentId, type, severity}' || echo "Incident 端点未实现"
echo ""

# 测试 3: 执行 Approve 动作
echo "=== 测试 3: Approve 动作 ==="
APPROVAL_ID=$(curl -s http://localhost:3000/api/operator/approvals | jq -r '.approvals[] | select(.metadata.environment == "production") | .approvalId' | head -1)

if [ -n "$APPROVAL_ID" ] && [ "$APPROVAL_ID" != "null" ]; then
    echo "找到 Approval: $APPROVAL_ID"
    echo ""
    echo "执行 Approve:"
    curl -s -X POST http://localhost:3000/api/operator/actions \
      -H "Content-Type: application/json" \
      -d "{
        \"actionType\": \"approve\",
        \"targetType\": \"approval\",
        \"targetId\": \"$APPROVAL_ID\"
      }" | jq '.'
else
    echo "⚠️  未找到 Production Approval，跳过 Approve 测试"
fi
echo ""

# 总结
echo "╔════════════════════════════════════════════════════════╗"
echo "║  测试完成                                              ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "下一步："
echo "  1. 集成 Trading Ops Pack"
echo "  2. 配置真实交易系统 Webhook"
echo "  3. 验证完整 trading 闭环"
