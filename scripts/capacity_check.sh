#!/usr/bin/env bash
# OpenClaw 容量巡检脚本

set -euo pipefail

ALERT_FILE="$HOME/.openclaw/workspace/runtime/health/capacity_alerts.json"
THRESHOLDS=(
    "memory:500:MB"
    "browser:150:MB"
    "agents:150:MB"
    "workspace/knowledge/archive:100:MB"
    ".:2048:MB"
)

alerts=()

log_alert() {
    local path="$1"
    local size="$2"
    local threshold="$3"
    alerts+=("{\"path\":\"$path\",\"size_mb\":$size,\"threshold_mb\":$threshold,\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}")
    echo "⚠️  ALERT: $path = ${size}MB (threshold: ${threshold}MB)"
}

echo "=== OpenClaw Capacity Check ==="
echo "时间: $(date)"
echo

for item in "${THRESHOLDS[@]}"; do
    IFS=':' read -r path threshold unit <<< "$item"
    
    if [ "$path" = "." ]; then
        size=$(du -sm ~/.openclaw 2>/dev/null | cut -f1)
        label=".openclaw/ total"
    else
        size=$(du -sm ~/.openclaw/$path 2>/dev/null | cut -f1)
        label="$path/"
    fi
    
    if [ "$size" -gt "$threshold" ]; then
        log_alert "$label" "$size" "$threshold"
    else
        echo "✅ $label: ${size}MB (ok)"
    fi
done

echo
if [ ${#alerts[@]} -gt 0 ]; then
    echo "{\"alerts\":[$(IFS=,; echo "${alerts[*]}")],\"checked_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > "$ALERT_FILE"
    echo "发现 ${#alerts[@]} 个预警，已记录到 $ALERT_FILE"
    exit 1
else
    echo "{\"alerts\":[],\"checked_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > "$ALERT_FILE"
    echo "✅ 所有指标正常"
    exit 0
fi
