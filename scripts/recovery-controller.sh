#!/bin/bash
# OpenClaw 自动恢复控制器（安全版）
# 核心原则：受控执行 + 可停止 + 可观测

set -e

# 文件路径
STATUS_FILE="${HOME}/.openclaw/workspace/openclaw-health-check.json"
RECOVERY_LOG="${HOME}/.openclaw/workspace/recovery-log.json"
WRAPPER="${HOME}/.openclaw/workspace/openclaw-start.sh"
RECOVERY_LOG_FILE="${HOME}/.openclaw/workspace/logs/recovery-controller.log"

# 配置参数（可从 RECOVERY_LOG.config 读取）
COOLDOWN=300        # 5分钟冷却
MAX_ATTEMPTS=3      # 最大连续恢复次数
VERIFY_WINDOW=10    # 恢复后验证窗口（秒）
MIN_SEVERITY=2      # 最小触发严重程度（2=critical）

# 确保日志目录存在
mkdir -p "$(dirname "$RECOVERY_LOG_FILE")"

# 日志函数
log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$RECOVERY_LOG_FILE"
}

# 读取 JSON 字段（使用 node）
json_get() {
    local file=$1
    local path=$2
    local result=$(node -e "const data = require('fs').readFileSync('$file', 'utf8'); const json = JSON.parse(data); const val = $path; console.log(val !== undefined && val !== null ? val : '');" 2>/dev/null)
    echo "${result:-0}"
}

# 更新恢复日志
update_recovery_log() {
    local result=$1
    local attempts=$2
    local now=$(date +%s)
    
    # 读取现有统计
    local total_attempts=$(json_get "$RECOVERY_LOG" "json.stats.totalAttempts" || echo "0")
    local successful=$(json_get "$RECOVERY_LOG" "json.stats.successfulRecoveries" || echo "0")
    local failed=$(json_get "$RECOVERY_LOG" "json.stats.failedRecoveries" || echo "0")
    
    # 更新统计
    total_attempts=$((total_attempts + 1))
    if [ "$result" = "success" ]; then
        successful=$((successful + 1))
    else
        failed=$((failed + 1))
    fi
    
    # 构建历史记录
    local history_entry="{\"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\", \"result\": \"$result\", \"attempts\": $attempts}"
    
    # 更新日志文件
    cat > "$RECOVERY_LOG" << EOF
{
  "schema": "openclaw.recovery.v1",
  "version": "1.0.0",
  "lastUpdated": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "currentSession": {
    "attempts": $attempts,
    "lastAttempt": $now,
    "lastResult": "$result",
    "consecutiveFailures": $([ "$result" = "failed" ] && echo "$attempts" || echo "0")
  },
  "config": {
    "cooldownSeconds": $COOLDOWN,
    "maxAttempts": $MAX_ATTEMPTS,
    "verifyWindowSeconds": $VERIFY_WINDOW,
    "targetComponents": ["gateway"],
    "minSeverity": $MIN_SEVERITY
  },
  "stats": {
    "totalAttempts": $total_attempts,
    "successfulRecoveries": $successful,
    "failedRecoveries": $failed,
    "lastSuccess": $([ "$result" = "success" ] && echo "\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"" || echo "$(json_get "$RECOVERY_LOG" "json.stats.lastSuccess" || echo "null")"),
    "lastFailure": $([ "$result" = "failed" ] && echo "\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"" || echo "$(json_get "$RECOVERY_LOG" "json.stats.lastFailure" || echo "null")")
  }
}
EOF
}

# 检查恢复条件
check_recovery_conditions() {
    log "INFO" "========================================"
    log "INFO" "自动恢复控制器启动"
    log "INFO" "========================================"
    
    # 1. 检查状态文件是否存在
    if [ ! -f "$STATUS_FILE" ]; then
        log "WARN" "状态文件不存在，跳过恢复检查"
        return 1
    fi
    
    # 2. 读取当前状态
    local overall_severity=$(json_get "$STATUS_FILE" "json.overall.severity" || echo "0")
    local gateway_status=$(json_get "$STATUS_FILE" "json.components.gateway.status" || echo "unknown")
    local gateway_severity=$(json_get "$STATUS_FILE" "json.components.gateway.severity" || echo "0")
    
    log "INFO" "当前状态: overall_severity=$overall_severity, gateway_status=$gateway_status, gateway_severity=$gateway_severity"
    
    # 3. 严格触发条件检查
    # 条件1：整体严重度 >= MIN_SEVERITY
    if [ "$overall_severity" -lt "$MIN_SEVERITY" ]; then
        log "INFO" "整体严重度 ($overall_severity) < 阈值 ($MIN_SEVERITY)，跳过恢复"
        return 1
    fi
    
    # 条件2：Gateway 状态为 stopped 或 critical
    if [ "$gateway_status" != "stopped" ] && [ "$gateway_severity" -lt 2 ]; then
        log "INFO" "Gateway 状态 ($gateway_status) 不满足恢复条件，跳过"
        return 1
    fi
    
    log "INFO" "✅ 触发条件满足，进入恢复流程"
    return 0
}

# 检查冷却时间
check_cooldown() {
    local now=$(date +%s)
    local last_attempt=$(json_get "$RECOVERY_LOG" "json.currentSession.lastAttempt" || echo "0")
    
    if [ "$last_attempt" -eq 0 ]; then
        log "INFO" "首次恢复，无冷却限制"
        return 0
    fi
    
    local elapsed=$((now - last_attempt))
    local remaining=$((COOLDOWN - elapsed))
    
    if [ "$elapsed" -lt "$COOLDOWN" ]; then
        log "INFO" "⏳ 冷却中，还需等待 ${remaining} 秒"
        return 1
    fi
    
    log "INFO" "✅ 冷却时间已过"
    return 0
}

# 检查最大尝试次数
check_max_attempts() {
    local attempts=$(json_get "$RECOVERY_LOG" "json.currentSession.attempts" || echo "0")
    
    if [ "$attempts" -ge "$MAX_ATTEMPTS" ]; then
        log "ERROR" "❌ 已达到最大恢复次数 ($MAX_ATTEMPTS)，停止自动恢复"
        log "ERROR" "需要人工干预"
        return 1
    fi
    
    log "INFO" "当前尝试次数: $attempts / $MAX_ATTEMPTS"
    return 0
}

# 执行恢复
execute_recovery() {
    local attempts=$(json_get "$RECOVERY_LOG" "json.currentSession.attempts" || echo "0")
    attempts=$((attempts + 1))
    
    log "INFO" ""
    log "INFO" "🚑 开始第 $attempts 次自动恢复..."
    log "INFO" "执行: $WRAPPER"
    
    # 执行 wrapper
    local result=0
    if bash "$WRAPPER" >> "$RECOVERY_LOG_FILE" 2>&1; then
        log "INFO" "✅ Wrapper 执行完成"
    else
        result=$?
        log "WARN" "⚠️ Wrapper 返回非零退出码: $result"
    fi
    
    # 等待验证窗口
    log "INFO" "⏳ 等待验证窗口 (${VERIFY_WINDOW} 秒)..."
    sleep $VERIFY_WINDOW
    
    # 刷新健康检查
    bash "${HOME}/.openclaw/workspace/scripts/openclaw-health-check.sh" > /dev/null 2>&1 || true
    
    # 验证恢复结果
    local new_gateway_status=$(json_get "$STATUS_FILE" "json.components.gateway.status" || echo "unknown")
    
    if [ "$new_gateway_status" = "running" ]; then
        log "INFO" "✅ 恢复验证通过，Gateway 已正常运行"
        update_recovery_log "success" "$attempts"
        return 0
    else
        log "ERROR" "❌ 恢复验证失败，Gateway 状态: $new_gateway_status"
        update_recovery_log "failed" "$attempts"
        return 1
    fi
}

# 输出恢复报告
output_report() {
    local status=$1
    local message=$2
    
    cat << EOF

【自动恢复报告】

状态: $status
时间: $(date '+%Y-%m-%d %H:%M:%S')
消息: $message

详细日志: $RECOVERY_LOG_FILE
恢复记录: $RECOVERY_LOG

EOF
}

# 主流程
main() {
    # 检查恢复条件
    if ! check_recovery_conditions; then
        exit 0
    fi
    
    # 检查冷却时间
    if ! check_cooldown; then
        output_report "SKIPPED" "冷却中，跳过恢复"
        exit 0
    fi
    
    # 检查最大尝试次数
    if ! check_max_attempts; then
        output_report "BLOCKED" "已达到最大恢复次数，需要人工干预"
        exit 1
    fi
    
    # 执行恢复
    if execute_recovery; then
        output_report "SUCCESS" "Gateway 自动恢复成功"
        exit 0
    else
        output_report "FAILED" "Gateway 自动恢复失败，将在下次心跳时重试"
        exit 1
    fi
}

# 信号处理
cleanup() {
    log "INFO" "接收到中断信号，恢复流程终止"
    exit 130
}
trap cleanup INT TERM

# 主入口
main "$@"
