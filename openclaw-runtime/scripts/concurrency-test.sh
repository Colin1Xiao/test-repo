#!/bin/bash
# 3B-1A: 并发测试脚本
# 验证协调语义 (锁/幂等/所有权) 在单实例 + Redis 下是否成立

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_URL="${BASE_URL:-http://localhost:18789}"
CONCURRENT_COUNT="${CONCURRENT_COUNT:-3}"

echo "=== 3B-1A 并发测试 ==="
echo ""
echo "配置:"
echo "  BASE_URL: $BASE_URL"
echo "  CONCURRENT_COUNT: $CONCURRENT_COUNT"
echo ""

# ==================== 测试函数 ====================

test_concurrent_resolve() {
    local resource_type=$1
    local resource_id=$2
    local endpoint=$3
    
    echo "测试：$resource_type 并发 resolve (ID: $resource_id)"
    echo "---"
    
    # 并发发送请求
    pids=()
    for i in $(seq 1 $CONCURRENT_COUNT); do
        curl -s -X POST "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d '{"action": "resolve"}' \
            -o "/tmp/concurrency-test-$i.json" \
            -w "/tmp/concurrency-test-$i.http" \
            &
        pids+=($!)
    done
    
    # 等待所有请求完成
    for pid in "${pids[@]}"; do
        wait $pid || true
    done
    
    # 统计结果
    success_count=0
    failure_count=0
    
    for i in $(seq 1 $CONCURRENT_COUNT); do
        http_code=$(cat "/tmp/concurrency-test-$i.http" 2>/dev/null | tail -1)
        if [[ "$http_code" =~ ^2[0-9][0-9]$ ]]; then
            ((success_count++))
        else
            ((failure_count++))
        fi
        rm -f "/tmp/concurrency-test-$i.json" "/tmp/concurrency-test-$i.http"
    done
    
    echo "结果:"
    echo "  成功：$success_count"
    echo "  失败：$failure_count"
    
    # 验证：应该只有 1 个成功
    if [ "$success_count" -eq 1 ] && [ "$failure_count" -eq $((CONCURRENT_COUNT - 1)) ]; then
        echo "  ✅ 通过 (预期：1 成功，$((CONCURRENT_COUNT - 1)) 失败)"
        return 0
    else
        echo "  ❌ 失败 (预期：1 成功，$((CONCURRENT_COUNT - 1)) 失败)"
        return 1
    fi
}

test_concurrent_webhook() {
    local event_id=$1
    
    echo "测试：Webhook 重复 event id 投递 (ID: $event_id)"
    echo "---"
    
    # 并发发送相同 event_id
    pids=()
    for i in $(seq 1 $CONCURRENT_COUNT); do
        curl -s -X POST "$BASE_URL/trading/webhooks/okx/ingest" \
            -H "Content-Type: application/json" \
            -H "X-Event-Id: $event_id" \
            -d '{"event": "test", "data": {}}' \
            -o "/tmp/concurrency-test-wh-$i.json" \
            -w "/tmp/concurrency-test-wh-$i.http" \
            &
        pids+=($!)
    done
    
    # 等待
    for pid in "${pids[@]}"; do
        wait $pid || true
    done
    
    # 统计
    success_count=0
    idempotent_count=0
    
    for i in $(seq 1 $CONCURRENT_COUNT); do
        http_code=$(cat "/tmp/concurrency-test-wh-$i.http" 2>/dev/null | tail -1)
        body=$(cat "/tmp/concurrency-test-wh-$i.json" 2>/dev/null)
        if [[ "$http_code" =~ ^2[0-9][0-9]$ ]]; then
            if echo "$body" | grep -q "idempotent.*true"; then
                ((idempotent_count++))
            else
                ((success_count++))
            fi
        fi
        rm -f "/tmp/concurrency-test-wh-$i.json" "/tmp/concurrency-test-wh-$i.http"
    done
    
    echo "结果:"
    echo "  首次执行：$success_count"
    echo "  幂等命中：$idempotent_count"
    
    # 验证：应该 1 个执行，其余幂等
    if [ "$success_count" -eq 1 ] && [ "$idempotent_count" -eq $((CONCURRENT_COUNT - 1)) ]; then
        echo "  ✅ 通过 (预期：1 执行，$((CONCURRENT_COUNT - 1)) 幂等)"
        return 0
    else
        echo "  ❌ 失败 (预期：1 执行，$((CONCURRENT_COUNT - 1)) 幂等)"
        return 1
    fi
}

# ==================== 执行测试 ====================

passed=0
failed=0

# 测试 1: 三并发 resolve 同一 approval
if test_concurrent_resolve "approval" "test-approval-001" "/trading/approvals/test-approval-001/resolve"; then
    ((passed++))
else
    ((failed++))
fi
echo ""

# 测试 2: 三并发 acknowledge 同一 incident
if test_concurrent_resolve "incident" "test-incident-001" "/trading/incidents/test-incident-001/acknowledge"; then
    ((passed++))
else
    ((failed++))
fi
echo ""

# 测试 3: 三并发 resolve 同一 incident
if test_concurrent_resolve "incident" "test-incident-002" "/trading/incidents/test-incident-002/resolve"; then
    ((passed++))
else
    ((failed++))
fi
echo ""

# 测试 4: 三并发 replay 同一 target
if test_concurrent_resolve "replay" "test-target-001" "/trading/replay/test-target-001/run"; then
    ((passed++))
else
    ((failed++))
fi
echo ""

# 测试 5: 三并发 recovery scan 同一 scope
if test_concurrent_resolve "recovery" "test-scope-001" "/trading/recovery/scan"; then
    ((passed++))
else
    ((failed++))
fi
echo ""

# 测试 6: 三并发重复 webhook event id
if test_concurrent_webhook "test-webhook-event-001"; then
    ((passed++))
else
    ((failed++))
fi
echo ""

# ==================== 总结 ====================

echo "=== 测试总结 ==="
echo "通过：$passed / $((passed + failed))"
echo "失败：$failed / $((passed + failed))"
echo ""

if [ "$failed" -eq 0 ]; then
    echo "✅ 所有测试通过！协调语义验证成立。"
    exit 0
else
    echo "❌ 有 $failed 项测试失败。"
    exit 1
fi
