#!/bin/bash
# Phase 2B-3A: Jenkins Mock Test
# 模拟测试（无需真实 Jenkins 环境）

set -e

echo "=== Phase 2B-3A: Jenkins Mock Test ==="
echo ""

# 检查 HTTP Server
echo "检查 HTTP Server 状态..."
if curl -s http://localhost:3000/api/operator/approvals > /dev/null 2>&1; then
    echo "✅ HTTP Server 运行中"
else
    echo "❌ HTTP Server 未运行"
    exit 1
fi

# 测试 Build Failure
echo ""
echo "测试 1: Build Failure 事件"
curl -s -X POST http://localhost:3000/api/webhooks/jenkins \
  -H "Content-Type: application/json" \
  -d '{"job":{"name":"test","fullName":"test-job","url":"http://test"},"build":{"number":1,"status":"FAILURE"}}' | jq '.incidentsCreated'

# 测试 Input Pending
echo "测试 2: Input Pending 事件"
curl -s -X POST http://localhost:3000/api/webhooks/jenkins \
  -H "Content-Type: application/json" \
  -d '{"job":{"name":"deploy","fullName":"deploy-prod","url":"http://test"},"build":{"number":2,"phase":"PAUSED_PENDING_INPUT"},"input":{"id":"in1","message":"Deploy?","submitter":"admin"}}' | jq '.approvalsCreated'

echo ""
echo "✅ 模拟测试完成"
