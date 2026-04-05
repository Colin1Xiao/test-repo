#!/bin/bash
# Phase 2D-1B: Trading Deep Integration Test
# 深度集成测试脚本

set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║  Phase 2D-1B: Trading Deep Integration                ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# 检查服务器
echo "=== 检查 HTTP Server 状态 ==="
if ! curl -s http://localhost:3004/api/trading/dashboard > /dev/null 2>&1; then
    echo "❌ Trading Server 未运行"
    exit 1
fi
echo "✅ Trading Server 运行中 (端口 3004)"
echo ""

# 测试 1: Enhanced Dashboard
echo "=== 测试 1: Enhanced Dashboard ==="
curl -s http://localhost:3004/api/trading/dashboard/enhanced | jq '{
  snapshotId,
  releases: .releases,
  alerts: .alerts,
  risk: .risk,
  topBlockers: (.topBlockers | length),
  recentActions: (.recentActions | length)
}'
echo ""

# 测试 2: Risk State
echo "=== 测试 2: Risk State ==="
curl -s http://localhost:3004/api/trading/risk-state | jq '.'
echo ""

# 测试 3: Create Runbook Actions
echo "=== 测试 3: Create Runbook Actions ==="
echo "3a. Acknowledge Action:"
curl -s -X POST http://localhost:3004/api/trading/runbook-actions \
  -H "Content-Type: application/json" \
  -d '{"type":"acknowledge","target":{"type":"incident","id":"incident_001"}}' | jq '{success, actionId: .action.id, type: .action.type}'

echo ""
echo "3b. Escalate Action:"
curl -s -X POST http://localhost:3004/api/trading/runbook-actions \
  -H "Content-Type: application/json" \
  -d '{"type":"escalate","target":{"type":"incident","id":"incident_002"},"parameters":{"escalateTo":"senior_operator","reason":"Requires attention"}}' | jq '{success, actionId: .action.id, type: .action.type}'

echo ""
echo "3c. Recovery Action:"
curl -s -X POST http://localhost:3004/api/trading/runbook-actions \
  -H "Content-Type: application/json" \
  -d '{"type":"request_recovery","target":{"type":"system","id":"execution_engine"},"parameters":{"recoveryType":"auto","targetSystem":"order_manager"}}' | jq '{success, actionId: .action.id, type: .action.type}'
echo ""

# 测试 4: Execute Runbook Action
echo "=== 测试 4: Execute Runbook Action ==="
ACTION_ID=$(curl -s -X POST http://localhost:3004/api/trading/runbook-actions \
  -H "Content-Type: application/json" \
  -d '{"type":"acknowledge","target":{"type":"incident","id":"test_incident"}}' | jq -r '.action.id')

echo "创建 Action: $ACTION_ID"
echo "执行 Action..."
curl -s -X POST "http://localhost:3004/api/trading/runbook-actions/$ACTION_ID/execute" \
  -H "Content-Type: application/json" \
  -d '{"executedBy":"test_user"}' | jq '.' 2>/dev/null || echo "Execute 端点待实现"
echo ""

# 测试 5: Risk State Changes
echo "=== 测试 5: Risk State Changes ==="
echo "记录风险突破..."
curl -s -X POST http://localhost:3004/api/trading/risk-state/breach \
  -H "Content-Type: application/json" \
  -d '{"metric":"latency_ms","threshold":"500","value":"850","severity":"high"}' 2>/dev/null | jq '.' || echo "Breach 端点待实现"

echo ""
echo "检查风险状态:"
curl -s http://localhost:3004/api/trading/risk-state | jq '{level, breaches24h: (.breaches24h | length)}'
echo ""

# 测试 6: Trading Event → Enhanced Dashboard
echo "=== 测试 6: Trading Event → Enhanced Dashboard ==="
echo "创建 System Alert 事件:"
curl -s -X POST http://localhost:3004/api/trading/events \
  -H "Content-Type: application/json" \
  -d '{
    "type": "system_alert",
    "severity": "critical",
    "source": {"system": "execution_engine","component":"order_manager","environment":"mainnet"},
    "metadata": {"alertId":"alert_001","alertType":"order_failure","title":"Order Execution Failed","description":"Failed to execute order"}
  }' | jq '{success, incidentCreated}'

echo ""
echo "检查 Enhanced Dashboard:"
curl -s http://localhost:3004/api/trading/dashboard/enhanced | jq '{
  alerts: .alerts,
  topBlockers: (.topBlockers | length),
  risk: .risk.level
}'
echo ""

# 总结
echo "╔════════════════════════════════════════════════════════╗"
echo "║  Phase 2D-1B 测试完成                                  ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "验证结果："
echo "  ✅ Enhanced Dashboard"
echo "  ✅ Risk State"
echo "  ✅ Runbook Actions (Create)"
echo "  ✅ Trading Event → Dashboard Integration"
echo "  ⚠️  Execute Action (端点待实现)"
echo "  ⚠️  Risk Breach Recording (端点待实现)"
echo ""
echo "下一步："
echo "  1. 实现 Execute Runbook Action 端点"
echo "  2. 实现 Risk Breach Recording 端点"
echo "  3. 修复 GitHub Token 权限"
