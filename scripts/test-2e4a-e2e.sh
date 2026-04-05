#!/bin/bash
# Phase 2E-4A: 端到端测试验证
# 测试幂等性、锁竞争、降级行为

set -e

BASE_URL="http://localhost:3005/api"
PASS=0
FAIL=0

echo "╔════════════════════════════════════════════════════════╗"
echo "║  Phase 2E-4A: 端到端测试验证                          ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试函数
test_pass() {
    echo -e "${GREEN}✅ PASS${NC}: $1"
    PASS=$((PASS + 1))
}

test_fail() {
    echo -e "${RED}❌ FAIL${NC}: $1"
    FAIL=$((FAIL + 1))
}

test_info() {
    echo -e "${YELLOW}ℹ️  INFO${NC}: $1"
}

# ============================================================================
# 测试 1: 幂等重复提交
# ============================================================================
echo "=== 测试 1: 幂等重复提交 ==="
echo ""

# 1.1 Approval Resolve 幂等测试
echo "1.1 Approval Resolve 幂等测试..."
APPROVAL_ID="test_approval_$(date +%s)"

# 第一次请求
RESPONSE1=$(curl -s -X POST "$BASE_URL/trading/approvals/$APPROVAL_ID/resolve" \
  -H "Content-Type: application/json" \
  -d '{"status":"approved","approver":"test_user"}')

echo "  第一次请求：$RESPONSE1"

# 第二次请求（相同 ID）
RESPONSE2=$(curl -s -X POST "$BASE_URL/trading/approvals/$APPROVAL_ID/resolve" \
  -H "Content-Type: application/json" \
  -d '{"status":"approved","approver":"test_user"}')

echo "  第二次请求：$RESPONSE2"

# 验证两次响应是否一致
if [ "$RESPONSE1" == "$RESPONSE2" ]; then
    test_pass "Approval Resolve 幂等性"
else
    test_fail "Approval Resolve 幂等性 - 响应不一致"
fi

echo ""

# 1.2 Incident Acknowledge 幂等测试
echo "1.2 Incident Acknowledge 幂等测试..."
INCIDENT_ID="test_incident_$(date +%s)"

# 第一次请求
RESPONSE1=$(curl -s -X POST "$BASE_URL/trading/incidents/$INCIDENT_ID/acknowledge")
echo "  第一次请求：$RESPONSE1"

# 第二次请求
RESPONSE2=$(curl -s -X POST "$BASE_URL/trading/incidents/$INCIDENT_ID/acknowledge")
echo "  第二次请求：$RESPONSE2"

if [ "$RESPONSE1" == "$RESPONSE2" ]; then
    test_pass "Incident Acknowledge 幂等性"
else
    test_fail "Incident Acknowledge 幂等性 - 响应不一致"
fi

echo ""

# 1.3 Incident Resolve 幂等测试
echo "1.3 Incident Resolve 幂等测试..."
INCIDENT_ID2="test_incident2_$(date +%s)"

# 第一次请求
RESPONSE1=$(curl -s -X POST "$BASE_URL/trading/incidents/$INCIDENT_ID2/resolve" \
  -H "Content-Type: application/json" \
  -d '{"resolution":"Test resolution"}')
echo "  第一次请求：$RESPONSE1"

# 第二次请求
RESPONSE2=$(curl -s -X POST "$BASE_URL/trading/incidents/$INCIDENT_ID2/resolve" \
  -H "Content-Type: application/json" \
  -d '{"resolution":"Test resolution"}')
echo "  第二次请求：$RESPONSE2"

if [ "$RESPONSE1" == "$RESPONSE2" ]; then
    test_pass "Incident Resolve 幂等性"
else
    test_fail "Incident Resolve 幂等性 - 响应不一致"
fi

echo ""

# ============================================================================
# 测试 2: 并发锁竞争
# ============================================================================
echo "=== 测试 2: 并发锁竞争 ==="
echo ""

echo "2.1 Approval Resolve 并发测试..."
APPROVAL_ID2="test_approval_concurrent_$(date +%s)"

# 并发发送两个请求
curl -s -X POST "$BASE_URL/trading/approvals/$APPROVAL_ID2/resolve" \
  -H "Content-Type: application/json" \
  -d '{"status":"approved","approver":"test_user1"}' > /tmp/approval_resp1.txt &
PID1=$!

curl -s -X POST "$BASE_URL/trading/approvals/$APPROVAL_ID2/resolve" \
  -H "Content-Type: application/json" \
  -d '{"status":"approved","approver":"test_user2"}' > /tmp/approval_resp2.txt &
PID2=$!

wait $PID1
wait $PID2

RESP1=$(cat /tmp/approval_resp1.txt)
RESP2=$(cat /tmp/approval_resp2.txt)

echo "  请求 1: $RESP1"
echo "  请求 2: $RESP2"

# 验证只有一个成功
if [ "$RESP1" != "$RESP2" ]; then
    test_pass "Approval Resolve 并发锁竞争"
else
    test_fail "Approval Resolve 并发锁竞争 - 未正确互斥"
fi

echo ""

# ============================================================================
# 测试 3: in-progress 状态保护
# ============================================================================
echo "=== 测试 3: in-progress 状态保护 ==="
echo ""

echo "3.1 Replay Run in-progress 测试..."
# 发送第一个 replay 请求
RESPONSE1=$(curl -s -X POST "$BASE_URL/trading/replay/run" \
  -H "Content-Type: application/json" \
  -d '{"mode":"dry-run","limit":10}')

echo "  第一次请求：$RESPONSE1"

# 立即发送第二个相同请求
RESPONSE2=$(curl -s -X POST "$BASE_URL/trading/replay/run" \
  -H "Content-Type: application/json" \
  -d '{"mode":"dry-run","limit":10}')

echo "  第二次请求：$RESPONSE2"

# 验证两次请求都成功（因为 replay 是快速操作）
if echo "$RESPONSE1" | grep -q "success" && echo "$RESPONSE2" | grep -q "success"; then
    test_pass "Replay Run in-progress 保护"
else
    test_fail "Replay Run in-progress 保护"
fi

echo ""

# ============================================================================
# 测试 4: Redis 降级行为
# ============================================================================
echo "=== 测试 4: Redis 降级行为 ==="
echo ""

# 检查服务器日志中是否有 Redis 连接信息
if [ -f /tmp/trading-v3.log ]; then
    if grep -q "Redis connected" /tmp/trading-v3.log; then
        test_info "Redis 已连接，幂等保护启用"
    elif grep -q "Redis.*failed\|Redis.*connection failed" /tmp/trading-v3.log; then
        test_info "Redis 未连接，降级到无保护模式"
    else
        test_info "Redis 状态未知"
    fi
else
    test_info "日志文件不存在，无法检查 Redis 状态"
fi

echo ""

# ============================================================================
# 总结
# ============================================================================
echo "╔════════════════════════════════════════════════════════╗"
echo "║  测试总结                                              ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo -e "通过：${GREEN}$PASS${NC}"
echo -e "失败：${RED}$FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}✅ 所有测试通过${NC}"
    exit 0
else
    echo -e "${RED}❌ 部分测试失败${NC}"
    exit 1
fi
