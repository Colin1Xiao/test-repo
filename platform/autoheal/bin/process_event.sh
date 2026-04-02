#!/bin/bash
# process_event.sh - 事件处理器
# 消费事件、分发到对应处理器、记录状态

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTOHEAL_DIR="$(dirname "$SCRIPT_DIR")"
EVENTS_INBOX="$AUTOHEAL_DIR/events/inbox"
EVENTS_PROCESSED="$AUTOHEAL_DIR/events/processed"
EVENTS_FAILED="$AUTOHEAL_DIR/events/failed"
EVENTS_ARCHIVE="$AUTOHEAL_DIR/events/archive"
STATE_DIR="$AUTOHEAL_DIR/state"
CONFIG_DIR="$AUTOHEAL_DIR/config"

mkdir -p "$EVENTS_PROCESSED" "$EVENTS_FAILED" "$EVENTS_ARCHIVE" "$STATE_DIR"

# 处理单个事件
process_event() {
    local event_file="$1"
    
    if [[ ! -f "$event_file" ]]; then
        echo "错误: 事件文件不存在"
        return 1
    fi
    
    local event=$(cat "$event_file")
    local event_id=$(echo "$event" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id','unknown'))" 2>/dev/null)
    local event_type=$(echo "$event" | python3 -c "import json,sys; print(json.load(sys.stdin).get('type','unknown'))" 2>/dev/null)
    local severity=$(echo "$event" | python3 -c "import json,sys; print(json.load(sys.stdin).get('severity','info'))" 2>/dev/null)
    local component=$(echo "$event" | python3 -c "import json,sys; print(json.load(sys.stdin).get('component','system'))" 2>/dev/null)
    
    echo "处理事件: $event_id ($event_type)"
    
    # 根据事件类型分发
    case "$event_type" in
        health.check.completed)
            handle_health_check_completed "$event"
            ;;
        health.check.failed)
            handle_health_check_failed "$event"
            ;;
        critical.detected)
            handle_critical_detected "$event"
            ;;
        warning.detected)
            handle_warning_detected "$event"
            ;;
        baseline.drift.detected)
            handle_baseline_drift "$event"
            ;;
        repair.*)
            handle_repair_event "$event"
            ;;
        agent.analysis.completed)
            handle_agent_analysis "$event"
            ;;
        judge.decision.made)
            handle_judge_decision "$event"
            ;;
        *)
            echo "  事件类型 $event_type 无需特殊处理"
            ;;
    esac
    
    # 移动到已处理目录
    mv "$event_file" "$EVENTS_PROCESSED/" 2>/dev/null || true
    
    # 更新状态
    update_state "$event"
}

# 处理健康检查完成
handle_health_check_completed() {
    local event="$1"
    local critical=$(echo "$event" | python3 -c "import json,sys; d=json.load(sys.stdin)['details']; print(d.get('critical_count',0))" 2>/dev/null)
    local warning=$(echo "$event" | python3 -c "import json,sys; d=json.load(sys.stdin)['details']; print(d.get('warning_count',0))" 2>/dev/null)
    
    echo "  健康检查完成: critical=$critical, warning=$warning"
    
    # 如果有 critical，触发快照
    if [[ "$critical" -gt 0 ]]; then
        echo "  触发快照创建..."
        "$SCRIPT_DIR/../snapshot.sh" create "critical_detected" 2>/dev/null || true
    fi
    
    # 更新最新状态
    cp "$EVENTS_INBOX"/$(echo "$event" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])").json 2>/dev/null \
        "$STATE_DIR/latest_health.json" || true
}

# 处理健康检查失败
handle_health_check_failed() {
    local event="$1"
    echo "  健康检查失败，触发修复流程..."
    
    # 检查策略是否允许自动修复
    if check_policy "healing" "auto_repair" "enabled" 2>/dev/null; then
        echo "  策略允许自动修复"
        # 触发 Agent 协作
        "$AUTOHEAL_DIR/bin/agents.sh" coordinate service-down 2>/dev/null || true
    else
        echo "  策略禁止自动修复，仅记录"
    fi
}

# 处理 critical 事件
handle_critical_detected() {
    local event="$1"
    local alert=$(echo "$event" | python3 -c "import json,sys; print(json.load(sys.stdin)['details'].get('alert',''))" 2>/dev/null)
    
    echo "  关键异常: $alert"
    
    # 创建快照
    "$SCRIPT_DIR/../snapshot.sh" create "critical_$alert" 2>/dev/null || true
    
    # 发送通知
    "$AUTOHEAL_DIR/bin/alert_manager.sh" notify "$alert" critical 2>/dev/null || true
    
    # 触发 Judge Agent
    echo "  触发 Judge Agent 裁决..."
    "$AUTOHEAL_DIR/bin/judge_agent.sh" evaluate "$event" 2>/dev/null || true
}

# 处理 warning 事件
handle_warning_detected() {
    local event="$1"
    local alert=$(echo "$event" | python3 -c "import json,sys; print(json.load(sys.stdin)['details'].get('alert',''))" 2>/dev/null)
    
    echo "  警告: $alert"
    
    # 发送通知（带去重）
    "$AUTOHEAL_DIR/bin/alert_manager.sh" notify "$alert" warning 2>/dev/null || true
}

# 处理基线偏移
handle_baseline_drift() {
    local event="$1"
    local baseline=$(echo "$event" | python3 -c "import json,sys; print(json.load(sys.stdin)['details'].get('baseline',''))" 2>/dev/null)
    
    echo "  基线偏移: $baseline"
    
    # 记录到待处理
    echo "$baseline" >> "$STATE_DIR/pending_review.txt" 2>/dev/null || true
}

# 处理修复事件
handle_repair_event() {
    local event="$1"
    echo "  修复事件，记录到历史..."
    
    # 追加到修复历史
    echo "$event" >> "$EVENTS_ARCHIVE/repair_history.jsonl" 2>/dev/null || true
}

# 处理 Agent 分析完成
handle_agent_analysis() {
    local event="$1"
    local agent=$(echo "$event" | python3 -c "import json,sys; print(json.load(sys.stdin)['details'].get('agent',''))" 2>/dev/null)
    local conclusion=$(echo "$event" | python3 -c "import json,sys; print(json.load(sys.stdin)['details'].get('conclusion',''))" 2>/dev/null)
    
    echo "  Agent $agent 分析完成: $conclusion"
}

# 处理 Judge 决策
handle_judge_decision() {
    local event="$1"
    local decision=$(echo "$event" | python3 -c "import json,sys; print(json.load(sys.stdin)['details'].get('decision',''))" 2>/dev/null)
    local confidence=$(echo "$event" | python3 -c "import json,sys; print(json.load(sys.stdin)['details'].get('confidence',0))" 2>/dev/null)
    
    echo "  Judge 裁决: $decision (置信度: $confidence)"
    
    case "$decision" in
        auto_repair)
            echo "  执行自动修复..."
            ;;
        manual_review)
            echo "  需要人工审核"
            echo "$(date): $decision" >> "$STATE_DIR/manual_review.txt" 2>/dev/null || true
            ;;
        alert_only)
            echo "  仅告警"
            ;;
    esac
}

# 检查策略
check_policy() {
    local category="$1"
    local key="$2"
    local expected="$3"
    
    local policy_file="$CONFIG_DIR/policies.yaml"
    
    if [[ ! -f "$policy_file" ]]; then
        # 默认允许
        return 0
    fi
    
    # 简单的 YAML 解析
    local value=$(grep -A 10 "^$category:" "$policy_file" | grep "$key" | head -1 | grep -oE '(true|false|enabled|disabled)' | head -1)
    
    [[ "$value" == "$expected" || "$value" == "true" ]]
}

# 更新状态
update_state() {
    local event="$1"
    local event_type=$(echo "$event" | python3 -c "import json,sys; print(json.load(sys.stdin)['type'])" 2>/dev/null)
    local timestamp=$(echo "$event" | python3 -c "import json,sys; print(json.load(sys.stdin)['ts'])" 2>/dev/null)
    
    # 更新状态文件
    python3 << EOF 2>/dev/null
import json
import os

state_file = "$STATE_DIR/latest_status.json"
event = $event

# 读取或初始化状态
if os.path.exists(state_file):
    with open(state_file) as f:
        state = json.load(f)
else:
    state = {"events": [], "last_update": None}

# 添加事件摘要
state["events"].append({
    "id": event.get("id"),
    "type": event.get("type"),
    "ts": event.get("ts"),
    "severity": event.get("severity"),
    "summary": event.get("summary")
})

# 只保留最近 100 条
state["events"] = state["events"][-100:]
state["last_update"] = event.get("ts")

with open(state_file, 'w') as f:
    json.dump(state, f, indent=2)
EOF
}

# 处理所有待处理事件
process_all() {
    local count=0
    
    for event_file in "$EVENTS_INBOX"/*.json; do
        if [[ -f "$event_file" ]]; then
            process_event "$event_file"
            count=$((count + 1))
        fi
    done
    
    echo ""
    echo "处理完成: $count 个事件"
}

# 主入口
case "${1:-}" in
    process)
        if [[ -n "$2" ]]; then
            process_event "$2"
        else
            process_all
        fi
        ;;
    all)
        process_all
        ;;
    status)
        local inbox_count=$(ls "$EVENTS_INBOX"/*.json 2>/dev/null | wc -l | tr -d ' ')
        local processed_count=$(ls "$EVENTS_PROCESSED"/*.json 2>/dev/null | wc -l | tr -d ' ')
        local failed_count=$(ls "$EVENTS_FAILED"/*.json 2>/dev/null | wc -l | tr -d ' ')
        
        echo "事件状态:"
        echo "  待处理: $inbox_count"
        echo "  已处理: $processed_count"
        echo "  失败:   $failed_count"
        ;;
    watch)
        echo "监听事件..."
        while true; do
            for event_file in "$EVENTS_INBOX"/*.json; do
                if [[ -f "$event_file" ]]; then
                    process_event "$event_file"
                fi
            done
            sleep 5
        done
        ;;
    *)
        echo "事件处理器"
        echo ""
        echo "用法:"
        echo "  $0 process [事件文件]  - 处理单个或所有事件"
        echo "  $0 all                 - 处理所有待处理事件"
        echo "  $0 status              - 查看事件状态"
        echo "  $0 watch               - 持续监听并处理事件"
        ;;
esac