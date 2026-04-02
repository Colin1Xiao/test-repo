#!/bin/bash
# OpenClaw Gateway 健康检查脚本
# 生成真实系统状态，供 AI 层读取
# 包含状态变化检测和全局健康度计算

set -e

HEALTH_FILE="/Users/colin/.openclaw/workspace/openclaw-health-check.json"
STATE_FILE="/Users/colin/.openclaw/workspace/memory/heartbeat-state.json"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# 状态等级：0=🟢OK, 1=🟡Warning, 2=🔴Critical
SEVERITY_OK=0
SEVERITY_WARNING=1
SEVERITY_CRITICAL=2

# 检查 Gateway 是否运行
check_gateway() {
    local port=18789
    local status="unknown"
    local severity=$SEVERITY_OK
    local errors="[]"

    if nc -z 127.0.0.1 $port 2>/dev/null; then
        status="running"
    else
        status="stopped"
        severity=$SEVERITY_WARNING
        errors='["Port 18789 not responding"]'
    fi

    echo "{\"status\": \"$status\", \"severity\": $severity, \"port\": $port, \"lastCheck\": \"$TIMESTAMP\", \"errors\": $errors}"
}

# 检查 Telegram 配置
check_telegram() {
    local status="unknown"
    local severity=$SEVERITY_OK
    local errors="[]"

    # 检查配置文件是否存在
    if [ -f "/Users/colin/.openclaw/openclaw.json" ]; then
        status="configured"
    else
        status="not_configured"
        severity=$SEVERITY_WARNING
        errors='["Config file not found"]'
    fi

    echo "{\"status\": \"$status\", \"severity\": $severity, \"lastCheck\": \"$TIMESTAMP\", \"errors\": $errors}"
}

# 检查 Memory Search
check_memory_search() {
    local status="unknown"
    local severity=$SEVERITY_OK
    local errors="[]"
    local model_path="/Users/colin/.openclaw/memory/models/embeddinggemma-300M-Q8_0.gguf"

    if [ -f "$model_path" ]; then
        status="ready"
    else
        status="model_missing"
        severity=$SEVERITY_CRITICAL
        errors="[\"Model not found: $model_path\"]"
    fi

    echo "{\"status\": \"$status\", \"severity\": $severity, \"provider\": \"local\", \"modelPath\": \"$model_path\", \"lastCheck\": \"$TIMESTAMP\", \"errors\": $errors}"
}

# 检查 Cron 任务
check_cron() {
    local status="unknown"
    local severity=$SEVERITY_OK
    local errors="[]"

    # 检查 cron 存储目录
    if [ -d "/Users/colin/.openclaw/state/cron" ]; then
        local job_count=$(ls -1 /Users/colin/.openclaw/state/cron/*.json 2>/dev/null | wc -l)
        if [ "$job_count" -gt 0 ]; then
            status="active"
        else
            status="empty"
            severity=$SEVERITY_OK  # Empty is not a problem
        fi
    else
        status="not_initialized"
        severity=$SEVERITY_OK  # Not initialized is OK for new systems
    fi

    echo "{\"status\": \"$status\", \"severity\": $severity, \"lastCheck\": \"$TIMESTAMP\", \"errors\": $errors}"
}

# 计算全局健康度
calculate_overall_health() {
    local gateway_severity=$1
    local telegram_severity=$2
    local memory_severity=$3
    local cron_severity=$4

    local max_severity=$SEVERITY_OK
    for sev in $gateway_severity $telegram_severity $memory_severity $cron_severity; do
        if [ "$sev" -gt "$max_severity" ]; then
            max_severity=$sev
        fi
    done

    local health_status="healthy"
    local health_emoji="🟢"
    case $max_severity in
        $SEVERITY_WARNING)
            health_status="degraded"
            health_emoji="🟡"
            ;;
        $SEVERITY_CRITICAL)
            health_status="critical"
            health_emoji="🔴"
            ;;
    esac

    echo "{\"status\": \"$health_status\", \"emoji\": \"$health_emoji\", \"severity\": $max_severity}"
}

# 检测状态变化
detect_changes() {
    local current_health=$1
    local prev_health=$2

    if [ "$current_health" != "$prev_health" ]; then
        echo "true"
    else
        echo "false"
    fi
}

# 主逻辑
main() {
    # 执行各项检查
    local gateway_json=$(check_gateway)
    local telegram_json=$(check_telegram)
    local memory_json=$(check_memory_search)
    local cron_json=$(check_cron)

    # 提取 severity 值
    local gateway_severity=$(echo "$gateway_json" | grep -o '"severity": [0-9]*' | cut -d' ' -f2)
    local telegram_severity=$(echo "$telegram_json" | grep -o '"severity": [0-9]*' | cut -d' ' -f2)
    local memory_severity=$(echo "$memory_json" | grep -o '"severity": [0-9]*' | cut -d' ' -f2)
    local cron_severity=$(echo "$cron_json" | grep -o '"severity": [0-9]*' | cut -d' ' -f2)

    # 计算全局健康度
    local overall_json=$(calculate_overall_health $gateway_severity $telegram_severity $memory_severity $cron_severity)

    # 读取上次状态（如果存在）
    local prev_status="unknown"
    local changed="false"
    if [ -f "$STATE_FILE" ]; then
        prev_status=$(cat "$STATE_FILE" | grep -o '"lastSystemStatus": "[^"]*"' | cut -d'"' -f4 || echo "unknown")
    fi

    # 检测变化
    local current_status=$(echo "$overall_json" | grep -o '"status": "[^"]*"' | head -1 | cut -d'"' -f4)
    changed=$(detect_changes "$current_status" "$prev_status")

    # 生成完整健康报告
    cat > "$HEALTH_FILE" << EOF
{
  "schema": "openclaw.health.v1",
  "lastUpdated": "$TIMESTAMP",
  "changed": $changed,
  "previousStatus": "$prev_status",
  "components": {
    "gateway": $gateway_json,
    "telegram": $telegram_json,
    "memorySearch": $memory_json,
    "cron": $cron_json
  },
  "overall": $overall_json,
  "system": {
    "version": "$(openclaw --version 2>/dev/null | grep -oE '2026\.[0-9]+\.[0-9]+' || echo 'unknown')",
    "nodeVersion": "$(node -v 2>/dev/null || echo 'unknown')",
    "platform": "$(uname -s | tr '[:upper:]' '[:lower:]')",
    "arch": "$(uname -m)"
  }
}
EOF

    # 更新状态文件中的 lastSystemStatus
    if [ -f "$STATE_FILE" ]; then
        # 使用临时文件更新 JSON
        local tmp_file=$(mktemp)
        cat "$STATE_FILE" | sed "s/\"lastSystemStatus\": \"[^\"]*\"/\"lastSystemStatus\": \"$current_status\"/" > "$tmp_file" || true
        if [ -s "$tmp_file" ]; then
            mv "$tmp_file" "$STATE_FILE"
        else
            rm -f "$tmp_file"
        fi
    fi

    echo "✅ Health check completed: $HEALTH_FILE"
    if [ "$changed" = "true" ]; then
        echo "⚠️  Status changed: $prev_status → $current_status"
    fi
}

main "$@"
