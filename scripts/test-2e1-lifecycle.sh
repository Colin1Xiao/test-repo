#!/bin/bash
# Phase 2E-1: Lifecycle 闭环测试

set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║  Phase 2E-1: Lifecycle 闭环测试                       ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

BASE_URL="http://localhost:3004/api"

# ============================================================================
# 测试 1: Approval 闭环
# ============================================================================
echo "=== 测试 1: Approval 闭环 ==="

echo "1a. 创建审批..."
APPROVAL_RESPONSE=$(curl -s -X POST "$BASE_URL/trading/events" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "release_requested",
    "severity": "high",
    "source": {"system": "trading", "component": "release_manager", "environment": "mainnet"},
    "actor": {"userId": "colin", "username": "colin"},
    "metadata": {
      "releaseId": "release_001",
      "strategyName": "momentum_v3",
      "version": "3.0.0",
      "description": "Added risk management layer",
      "riskLevel": "high"
    }
  }')

echo "$APPROVAL_RESPONSE" | jq '{success, approvalCreated}'
APPROVAL_ID=$(echo "$APPROVAL_RESPONSE" | jq -r '.approvalId // empty')

if [ -n "$APPROVAL_ID" ]; then
    echo ""
    echo "1b. 查询待处理审批..."
    curl -s "$BASE_URL/trading/approvals" | jq '.approvals[] | select(.approvalId == "'$APPROVAL_ID'") | {approvalId, status, scope}'
    
    echo ""
    echo "1c. 批准审批..."
    curl -s -X POST "$BASE_URL/trading/approvals/$APPROVAL_ID/approve" \
      -H "Content-Type: application/json" \
      -d '{"approver": "test_user"}' | jq '.'
    
    echo ""
    echo "1d. 再次查询审批状态..."
    curl -s "$BASE_URL/trading/approvals" | jq '.approvals[] | select(.approvalId == "'$APPROVAL_ID'") | {approvalId, status, decidedAt}'
    
    echo ""
    echo "1e. 重复批准（测试幂等性）..."
    curl -s -X POST "$BASE_URL/trading/approvals/$APPROVAL_ID/approve" \
      -H "Content-Type: application/json" \
      -d '{"approver": "another_user"}' | jq '.'
else
    echo "⚠️  审批未创建，跳过后续测试"
fi

echo ""

# ============================================================================
# 测试 2: Incident 闭环
# ============================================================================
echo "=== 测试 2: Incident 闭环 ==="

echo "2a. 创建事件..."
INCIDENT_RESPONSE=$(curl -s -X POST "$BASE_URL/trading/events" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "system_alert",
    "severity": "critical",
    "source": {"system": "monitoring", "component": "prometheus", "environment": "mainnet"},
    "actor": {"userId": "system", "username": "prometheus"},
    "metadata": {
      "alertId": "incident_001",
      "alertType": "latency_spike",
      "title": "High Latency Detected",
      "description": "Latency exceeded 500ms threshold",
      "metric": "latency_ms",
      "threshold": "500",
      "currentValue": "850"
    }
  }')

echo "$INCIDENT_RESPONSE" | jq '{success, incidentCreated}'
INCIDENT_ID=$(echo "$INCIDENT_RESPONSE" | jq -r '.incidentId // empty')

if [ -n "$INCIDENT_ID" ]; then
    echo ""
    echo "2b. 查询事件..."
    curl -s "$BASE_URL/trading/incidents" | jq '.incidents[] | select(.incidentId == "'$INCIDENT_ID'") | {incidentId, status, type}'
    
    echo ""
    echo "2c. 确认事件..."
    curl -s -X POST "$BASE_URL/trading/incidents/$INCIDENT_ID/acknowledge" | jq '.'
    
    echo ""
    echo "2d. 解决事件..."
    curl -s -X POST "$BASE_URL/trading/incidents/$INCIDENT_ID/resolve" \
      -H "Content-Type: application/json" \
      -d '{"resolution": "Fixed by scaling infrastructure"}' | jq '.'
    
    echo ""
    echo "2e. 查询事件最终状态..."
    curl -s "$BASE_URL/trading/incidents" | jq '.incidents[] | select(.incidentId == "'$INCIDENT_ID'") | {incidentId, status, resolvedAt}'
else
    echo "⚠️  事件未创建，跳过后续测试"
fi

echo ""

# ============================================================================
# 测试 3: Event 闭环
# ============================================================================
echo "=== 测试 3: Event 闭环 ==="

echo "3a. 查询事件列表..."
curl -s "$BASE_URL/trading/events" | jq '{count, events: [.events[] | {type, severity, source: .source.system}]}'

echo ""
echo "3b. 查询事件统计..."
curl -s "$BASE_URL/trading/events/stats" | jq '.'

echo ""

# ============================================================================
# 测试 4: Audit 对账
# ============================================================================
echo "=== 测试 4: Audit 对账 ==="

echo "4a. 检查审计日志目录..."
ls -la ~/.openclaw/trading-data/audit-logs/ | head -10

echo ""
echo "4b. 读取最新审计日志..."
ls -t ~/.openclaw/trading-data/audit-logs/*.log.json 2>/dev/null | head -3 | while read file; do
    echo "文件：$file"
    cat "$file" | jq '{action, actor, target, result}'
    echo ""
done

echo ""

# ============================================================================
# 总结
# ============================================================================
echo "╔════════════════════════════════════════════════════════╗"
echo "║  测试完成                                              ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "检查持久化目录:"
echo "  Approvals: $(ls ~/.openclaw/trading-data/approvals/*.approval.json 2>/dev/null | wc -l) 个文件"
echo "  Incidents: $(ls ~/.openclaw/trading-data/incidents/*.incident.json 2>/dev/null | wc -l) 个文件"
echo "  Events:    $(ls ~/.openclaw/trading-data/events/*.event.json 2>/dev/null | wc -l) 个文件"
echo "  Audit:     $(ls ~/.openclaw/trading-data/audit-logs/*.log.json 2>/dev/null | wc -l) 个文件"
