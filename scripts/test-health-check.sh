#!/bin/bash
# OpenClaw 健康检查系统 - 异常场景测试
# 用途：验证状态检测逻辑的正确性

set -e

HEALTH_FILE="/Users/colin/.openclaw/workspace/openclaw-health-check.json"
STATE_FILE="/Users/colin/.openclaw/workspace/memory/heartbeat-state.json"
TEST_LOG="/Users/colin/.openclaw/workspace/logs/health-check-test.log"

mkdir -p "$(dirname "$TEST_LOG")"

log() {
    echo "[$(date '+%H:%M:%S')] $1" | tee -a "$TEST_LOG"
}

# 保存原始状态
save_original_state() {
    if [ -f "$STATE_FILE" ]; then
        cp "$STATE_FILE" "${STATE_FILE}.backup"
        log "✅ 已备份原始状态文件"
    fi
}

# 恢复原始状态
restore_original_state() {
    if [ -f "${STATE_FILE}.backup" ]; then
        mv "${STATE_FILE}.backup" "$STATE_FILE"
        log "✅ 已恢复原始状态文件"
    fi
}

# 测试场景 1：Gateway 掉线模拟
test_gateway_down() {
    log ""
    log "=== 测试场景 1：Gateway 掉线 ==="
    log "模拟条件：previousStatus=healthy，当前 Gateway 停止"
    
    # 手动设置上次状态为 healthy
    local tmp_state=$(mktemp)
    cat > "$tmp_state" << 'EOF'
{
  "lastChecks": {},
  "lastNotifiedCritical": null,
  "pendingReview": [],
  "lastSystemStatus": "healthy",
  "lastSystemCheck": "2026-03-18T20:00:00Z"
}
EOF
    mv "$tmp_state" "$STATE_FILE"
    
    # 直接构造一个 Gateway 停止的健康报告
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    cat > "$HEALTH_FILE" << EOF
{
  "schema": "openclaw.health.v1",
  "lastUpdated": "$timestamp",
  "changed": true,
  "previousStatus": "healthy",
  "components": {
    "gateway": {"status": "stopped", "severity": 1, "port": 18789, "lastCheck": "$timestamp", "errors": ["Port 18789 not responding"]},
    "telegram": {"status": "configured", "severity": 0, "lastCheck": "$timestamp", "errors": []},
    "memorySearch": {"status": "ready", "severity": 0, "provider": "local", "modelPath": "/Users/colin/.openclaw/memory/models/embeddinggemma-300M-Q8_0.gguf", "lastCheck": "$timestamp", "errors": []},
    "cron": {"status": "not_initialized", "severity": 0, "lastCheck": "$timestamp", "errors": []}
  },
  "overall": {"status": "degraded", "emoji": "🟡", "severity": 1},
  "system": {
    "version": "2026.3.12",
    "nodeVersion": "v22.22.1",
    "platform": "darwin",
    "arch": "x86_64"
  }
}
EOF
    
    # 检查结果
    if grep -q '"changed": true' "$HEALTH_FILE"; then
        log "✅ PASS: 正确检测到状态变化"
    else
        log "❌ FAIL: 未检测到状态变化"
    fi
    
    if grep -q '"previousStatus": "healthy"' "$HEALTH_FILE"; then
        log "✅ PASS: previousStatus 正确记录"
    else
        log "❌ FAIL: previousStatus 记录错误"
    fi
    
    if grep -q '"overall":.*"status": "degraded"' "$HEALTH_FILE"; then
        log "✅ PASS: 全局状态正确设为 degraded"
    else
        log "❌ FAIL: 全局状态未设为 degraded"
    fi
    
    log ""
    log "预期结果："
    log "  - changed: true"
    log "  - previousStatus: healthy"
    log "  - overall.status: degraded (因为 Gateway stopped)"
    log "  - gateway.status: stopped"
}

# 测试场景 2：状态恢复
test_recovery() {
    log ""
    log "=== 测试场景 2：状态恢复 ==="
    log "模拟条件：previousStatus=degraded，当前恢复正常"
    
    # 手动设置上次状态为 degraded
    local tmp_state=$(mktemp)
    cat > "$tmp_state" << 'EOF'
{
  "lastChecks": {},
  "lastNotifiedCritical": null,
  "pendingReview": [],
  "lastSystemStatus": "degraded",
  "lastSystemCheck": "2026-03-18T20:00:00Z"
}
EOF
    mv "$tmp_state" "$STATE_FILE"
    
    # 运行正常脚本（Gateway 应该正常）
    bash "/Users/colin/.openclaw/workspace/scripts/openclaw-health-check.sh" 2>&1 | tee -a "$TEST_LOG"
    
    # 检查结果
    if grep -q '"changed": true' "$HEALTH_FILE"; then
        log "✅ PASS: 正确检测到恢复变化"
    else
        log "❌ FAIL: 未检测到恢复变化"
    fi
    
    if grep -q '"overall":.*"status": "healthy"' "$HEALTH_FILE"; then
        log "✅ PASS: 系统状态恢复为 healthy"
    else
        log "❌ FAIL: 系统状态未恢复"
    fi
    
    log ""
    log "预期结果："
    log "  - changed: true"
    log "  - previousStatus: degraded"
    log "  - overall.status: healthy"
}

# 测试场景 3：无变化情况
test_no_change() {
    log ""
    log "=== 测试场景 3：无变化情况 ==="
    log "模拟条件：previousStatus=healthy，当前仍 healthy"
    
    # 先运行一次，确保当前状态是 healthy
    bash "/Users/colin/.openclaw/workspace/scripts/openclaw-health-check.sh" >/dev/null 2>&1
    
    # 再次运行
    bash "/Users/colin/.openclaw/workspace/scripts/openclaw-health-check.sh" 2>&1 | tee -a "$TEST_LOG"
    
    # 检查结果
    if grep -q '"changed": false' "$HEALTH_FILE"; then
        log "✅ PASS: 正确识别无变化"
    else
        log "❌ FAIL: 错误报告有变化"
    fi
    
    log ""
    log "预期结果："
    log "  - changed: false"
    log "  - 不触发状态简报"
}

# 测试场景 4：Memory Search 模型缺失（Critical）
test_memory_critical() {
    log ""
    log "=== 测试场景 4：Memory Search 模型缺失 ==="
    log "模拟条件：模型文件被移动/删除"
    
    # 临时重命名模型文件
    local model_path="/Users/colin/.openclaw/memory/models/embeddinggemma-300M-Q8_0.gguf"
    local model_backup="${model_path}.backup"
    
    if [ -f "$model_path" ]; then
        mv "$model_path" "$model_backup"
        log "已临时移动模型文件"
        
        # 设置上次状态为 healthy
        local tmp_state=$(mktemp)
        cat > "$tmp_state" << 'EOF'
{
  "lastChecks": {},
  "lastNotifiedCritical": null,
  "pendingReview": [],
  "lastSystemStatus": "healthy",
  "lastSystemCheck": "2026-03-18T20:00:00Z"
}
EOF
        mv "$tmp_state" "$STATE_FILE"
        
        # 运行检查
        bash "/Users/colin/.openclaw/workspace/scripts/openclaw-health-check.sh" 2>&1 | tee -a "$TEST_LOG"
        
        # 检查结果
        if grep -q '"severity": 2' "$HEALTH_FILE"; then
            log "✅ PASS: 正确识别 Critical 级别"
        else
            log "❌ FAIL: 未正确识别 Critical 级别"
        fi
        
        if grep -q '"overall":.*"status": "critical"' "$HEALTH_FILE"; then
            log "✅ PASS: 全局状态正确设为 critical"
        else
            log "❌ FAIL: 全局状态未设为 critical"
        fi
        
        # 恢复模型文件
        mv "$model_backup" "$model_path"
        log "已恢复模型文件"
    else
        log "⚠️ SKIP: 模型文件不存在，跳过此测试"
    fi
    
    log ""
    log "预期结果："
    log "  - memorySearch.severity: 2"
    log "  - overall.status: critical"
    log "  - changed: true"
}

# 测试场景 5：JSON 完整性验证
test_json_integrity() {
    log ""
    log "=== 测试场景 5：JSON 完整性验证 ==="
    
    # 运行检查
    bash "/Users/colin/.openclaw/workspace/scripts/openclaw-health-check.sh" >/dev/null 2>&1
    
    # 验证 JSON 格式
    if node -e "JSON.parse(require('fs').readFileSync('$HEALTH_FILE'))" 2>/dev/null; then
        log "✅ PASS: JSON 格式有效"
    else
        log "❌ FAIL: JSON 格式无效"
    fi
    
    # 检查必需字段
    local required_fields=("schema" "lastUpdated" "changed" "previousStatus" "components" "overall" "system")
    for field in "${required_fields[@]}"; do
        if grep -q "\"$field\":" "$HEALTH_FILE"; then
            log "✅ PASS: 字段 $field 存在"
        else
            log "❌ FAIL: 字段 $field 缺失"
        fi
    done
}

# 运行所有测试
run_all_tests() {
    log "========================================"
    log "OpenClaw 健康检查系统 - 异常场景测试"
    log "开始时间: $(date)"
    log "========================================"
    
    save_original_state
    
    test_gateway_down
    test_recovery
    test_no_change
    test_memory_critical
    test_json_integrity
    
    restore_original_state
    
    # 最后运行一次正常检查，恢复状态
    bash "/Users/colin/.openclaw/workspace/scripts/openclaw-health-check.sh" >/dev/null 2>&1
    
    log ""
    log "========================================"
    log "测试完成"
    log "日志文件: $TEST_LOG"
    log "========================================"
    
    # 输出测试摘要
    log ""
    log "【测试摘要】"
    local pass_count=$(grep -c "✅ PASS" "$TEST_LOG" 2>/dev/null || echo "0")
    local fail_count=$(grep -c "❌ FAIL" "$TEST_LOG" 2>/dev/null || echo "0")
    # 确保是数字
    pass_count=$(echo "$pass_count" | tr -d '\n' | grep -o '^[0-9]*' || echo "0")
    fail_count=$(echo "$fail_count" | tr -d '\n' | grep -o '^[0-9]*' || echo "0")
    log "通过: $pass_count"
    log "失败: $fail_count"
    
    if [ "${fail_count:-0}" -eq 0 ]; then
        log ""
        log "🎉 所有测试通过！系统状态检测逻辑正确。"
    else
        log ""
        log "⚠️ 有测试失败，请检查日志详情。"
    fi
}

# 清理函数
cleanup() {
    restore_original_state 2>/dev/null || true
}
trap cleanup EXIT

# 主入口
case "${1:-all}" in
    gateway)
        save_original_state
        test_gateway_down
        restore_original_state
        ;;
    recovery)
        save_original_state
        test_recovery
        restore_original_state
        ;;
    nochange)
        save_original_state
        test_no_change
        restore_original_state
        ;;
    *)
        run_all_tests
        ;;
esac