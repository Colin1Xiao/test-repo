#!/bin/bash
# emit_event.sh - 事件发射器
# 所有组件统一通过此脚本产出结构化事件

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTOHEAL_DIR="$(dirname "$SCRIPT_DIR")"
EVENTS_INBOX="$AUTOHEAL_DIR/events/inbox"

# 生成事件 ID
generate_event_id() {
    echo "evt_$(date +%Y%m%d_%H%M%S)_$(shasum -a 256 <<< "$RANDOM$RANDOM" | cut -c1-6)"
}

# 发射事件
emit() {
    local event_type="$1"
    local source="${2:-unknown}"
    local severity="${3:-info}"
    local component="${4:-system}"
    local status="${5:-success}"
    local summary="$6"
    local details="${7:-{}}"
    local tags="${8:-[]}"
    
    local event_id=$(generate_event_id)
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    
    # 构建事件 JSON
    cat > "$EVENTS_INBOX/${event_id}.json" << EOF
{
  "id": "$event_id",
  "ts": "$timestamp",
  "schema_version": "1.0.0",
  "source": "$source",
  "type": "$event_type",
  "severity": "$severity",
  "component": "$component",
  "status": "$status",
  "summary": "$summary",
  "details": $details,
  "tags": $tags,
  "links": {
    "log": null,
    "snapshot": null
  }
}
EOF
    
    echo "$EVENTS_INBOX/${event_id}.json"
}

# 便捷方法
emit_health_check_started() {
    emit "health.check.started" "auto_heal" "info" "health" "started" "健康检查开始" '{}' '["health", "routine"]'
}

emit_health_check_completed() {
    local exit_code="$1"
    local critical="$2"
    local warning="$3"
    local latency="$4"
    
    local severity="info"
    local status="success"
    [[ $warning -gt 0 ]] && severity="warning" && status="warning"
    [[ $critical -gt 0 ]] && severity="critical" && status="failed"
    
    emit "health.check.completed" "auto_heal" "$severity" "health" "$status" \
        "健康检查完成: exit=$exit_code, critical=$critical, warning=$warning" \
        "{\"exit_code\": $exit_code, \"critical_count\": $critical, \"warning_count\": $warning, \"latency_ms\": $latency}" \
        '["health", "baseline"]'
}

emit_health_check_failed() {
    local reason="$1"
    emit "health.check.failed" "auto_heal" "critical" "health" "failed" \
        "健康检查失败: $reason" \
        "{\"reason\": \"$reason\"}" \
        '["health", "critical"]'
}

emit_critical_detected() {
    local alert="$1"
    local component="$2"
    emit "critical.detected" "auto_heal" "critical" "$component" "detected" \
        "关键异常: $alert" \
        "{\"alert\": \"$alert\"}" \
        '["critical", "alert"]'
}

emit_warning_detected() {
    local alert="$1"
    local component="$2"
    emit "warning.detected" "auto_heal" "warning" "$component" "detected" \
        "警告: $alert" \
        "{\"alert\": \"$alert\"}" \
        '["warning", "alert"]'
}

emit_repair_started() {
    local action="$1"
    emit "repair.started" "auto_heal" "info" "repair" "started" \
        "开始修复: $action" \
        "{\"action\": \"$action\"}" \
        '["repair", "auto"]'
}

emit_repair_applied() {
    local action="$1"
    local success="$2"
    emit "repair.applied" "auto_heal" "info" "repair" "applied" \
        "修复完成: $action (success=$success)" \
        "{\"action\": \"$action\", \"success\": $success}" \
        '["repair", "auto"]'
}

emit_repair_failed() {
    local action="$1"
    local reason="$2"
    emit "repair.failed" "auto_heal" "error" "repair" "failed" \
        "修复失败: $action - $reason" \
        "{\"action\": \"$action\", \"reason\": \"$reason\"}" \
        '["repair", "error"]'
}

emit_snapshot_created() {
    local snapshot_id="$1"
    local reason="$2"
    emit "snapshot.created" "snapshot" "info" "snapshot" "created" \
        "快照创建: $snapshot_id" \
        "{\"snapshot_id\": \"$snapshot_id\", \"reason\": \"$reason\"}" \
        '["snapshot", "archive"]'
}

emit_alert_sent() {
    local channel="$1"
    local level="$2"
    local message="$3"
    emit "alert.sent" "alert_manager" "info" "notification" "sent" \
        "告警发送: [$level] via $channel" \
        "{\"channel\": \"$channel\", \"level\": \"$level\", \"message\": \"$message\"}" \
        '["alert", "notification"]'
}

emit_baseline_drift() {
    local baseline="$1"
    local current="$2"
    emit "baseline.drift.detected" "auto_heal" "warning" "baseline" "drift" \
        "基线偏移: $baseline (当前: $current)" \
        "{\"baseline\": \"$baseline\", \"current\": \"$current\"}" \
        '["baseline", "drift"]'
}

emit_agent_analysis_started() {
    local agent="$1"
    local incident_id="$2"
    emit "agent.analysis.started" "agents" "info" "agent" "started" \
        "Agent 分析开始: $agent" \
        "{\"agent\": \"$agent\", \"incident_id\": \"$incident_id\"}" \
        '["agent", "analysis"]'
}

emit_agent_analysis_completed() {
    local agent="$1"
    local conclusion="$2"
    emit "agent.analysis.completed" "agents" "info" "agent" "completed" \
        "Agent 分析完成: $agent" \
        "{\"agent\": \"$agent\", \"conclusion\": \"$conclusion\"}" \
        '["agent", "analysis"]'
}

emit_judge_decision() {
    local decision="$1"
    local confidence="$2"
    local reason="$3"
    emit "judge.decision.made" "judge" "info" "decision" "made" \
        "裁决: $decision (置信度: $confidence)" \
        "{\"decision\": \"$decision\", \"confidence\": $confidence, \"reason\": \"$reason\"}" \
        '["judge", "decision"]'
}

emit_report_generated() {
    local report_type="$1"
    local report_path="$2"
    emit "report.$report_type.generated" "reporter" "info" "report" "generated" \
        "报告生成: $report_type" \
        "{\"report_type\": \"$report_type\", \"path\": \"$report_path\"}" \
        '["report", "daily"]'
}

# 主入口
case "${1:-}" in
    emit)
        shift
        emit "$@"
        ;;
    health.check.started)
        emit_health_check_started
        ;;
    health.check.completed)
        shift
        emit_health_check_completed "$@"
        ;;
    health.check.failed)
        shift
        emit_health_check_failed "$@"
        ;;
    critical.detected)
        shift
        emit_critical_detected "$@"
        ;;
    warning.detected)
        shift
        emit_warning_detected "$@"
        ;;
    repair.started)
        shift
        emit_repair_started "$@"
        ;;
    repair.applied)
        shift
        emit_repair_applied "$@"
        ;;
    repair.failed)
        shift
        emit_repair_failed "$@"
        ;;
    snapshot.created)
        shift
        emit_snapshot_created "$@"
        ;;
    alert.sent)
        shift
        emit_alert_sent "$@"
        ;;
    baseline.drift)
        shift
        emit_baseline_drift "$@"
        ;;
    agent.analysis.started)
        shift
        emit_agent_analysis_started "$@"
        ;;
    agent.analysis.completed)
        shift
        emit_agent_analysis_completed "$@"
        ;;
    judge.decision)
        shift
        emit_judge_decision "$@"
        ;;
    report.generated)
        shift
        emit_report_generated "$@"
        ;;
    *)
        echo "事件发射器"
        echo ""
        echo "用法:"
        echo "  $0 <事件类型> [参数...]"
        echo ""
        echo "事件类型:"
        echo "  health.check.started"
        echo "  health.check.completed <exit_code> <critical> <warning> <latency>"
        echo "  health.check.failed <reason>"
        echo "  critical.detected <alert> <component>"
        echo "  warning.detected <alert> <component>"
        echo "  repair.started <action>"
        echo "  repair.applied <action> <success>"
        echo "  repair.failed <action> <reason>"
        echo "  snapshot.created <id> <reason>"
        echo "  alert.sent <channel> <level> <message>"
        echo "  baseline.drift <baseline> <current>"
        echo "  agent.analysis.started <agent> <incident_id>"
        echo "  agent.analysis.completed <agent> <conclusion>"
        echo "  judge.decision <decision> <confidence> <reason>"
        echo "  report.generated <type> <path>"
        ;;
esac