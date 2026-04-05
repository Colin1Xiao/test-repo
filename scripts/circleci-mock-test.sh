#!/bin/bash
# Phase 2B-3B: CircleCI Mock Test
# CircleCI 模拟测试脚本

set -e

echo "=== Phase 2B-3B: CircleCI Mock Test ==="
echo ""

# 检查 HTTP Server
echo "检查 HTTP Server 状态..."
if ! curl -s http://localhost:3002/api/operator/approvals > /dev/null 2>&1; then
    echo "❌ HTTP Server 未运行 (端口 3002)"
    exit 1
fi
echo "✅ HTTP Server 运行中"

# 测试 Workflow Failure
echo ""
echo "测试 1: Workflow Failure 事件"
curl -s -X POST http://localhost:3002/api/webhooks/circleci \
  -H "Content-Type: application/json" \
  -d '{"pipeline":{"id":"abc123","number":42},"workflow":{"id":"wf-123","name":"build","status":"failed","project_slug":"gh/test-repo","started_at":"2026-04-04T00:00:00Z"},"organization":{"slug":"test-org"},"repository":{"name":"test-repo"},"user":{"login":"colin"}}' | jq '.incidentsCreated'

# 测试 Approval Pending
echo "测试 2: Approval Pending 事件"
curl -s -X POST http://localhost:3002/api/webhooks/circleci \
  -H "Content-Type: application/json" \
  -d '{"pipeline":{"id":"abc123","number":43},"workflow":{"id":"wf-456","name":"deploy","status":"on_hold","project_slug":"gh/test-repo","started_at":"2026-04-04T00:00:00Z"},"job":{"id":"job-789","name":"approve-deploy","type":"approval","status":"on_hold"},"approval":{"id":"approval-999","name":"Deploy to production?","status":"pending"},"organization":{"slug":"test-org"},"repository":{"name":"test-repo"},"user":{"login":"colin"}}' | jq '.approvalsCreated'

echo ""
echo "✅ 模拟测试完成"
