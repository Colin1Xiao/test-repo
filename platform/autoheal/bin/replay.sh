#!/bin/bash
# replay.sh - 事件复盘工具
# 按时间线重建事件全过程

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTOHEAL_DIR="$(dirname "$SCRIPT_DIR")"
EVENTS_PROCESSED="$AUTOHEAL_DIR/events/processed"
EVENTS_ARCHIVE="$AUTOHEAL_DIR/events/archive"
STATE_DIR="$AUTOHEAL_DIR/state"
SNAPSHOTS_DIR="$AUTOHEAL_DIR/snapshots"
AGENTS_DIR="$AUTOHEAL_DIR/agents"
LOGS_DIR="$AUTOHEAL_DIR/logs"

# 按日期复盘
replay_by_date() {
    local date="$1"
    local date_pattern="${date//-/}"
    
    echo "📊 事件复盘: $date"
    echo "=========================================="
    echo ""
    
    # 收集该日期的所有事件
    local events=()
    
    # 从已处理目录
    for f in "$EVENTS_PROCESSED"/*.json; do
        if [[ -f "$f" ]]; then
            local event_date=$(cat "$f" | python3 -c "import json,sys; print(json.load(sys.stdin)['ts'][:10])" 2>/dev/null)
            if [[ "$event_date" == "$date" ]]; then
                events+=("$f")
            fi
        fi
    done
    
    # 从归档目录
    for f in "$EVENTS_ARCHIVE"/*.json; do
        if [[ -f "$f" ]]; then
            local event_date=$(cat "$f" | python3 -c "import json,sys; print(json.load(sys.stdin)['ts'][:10])" 2>/dev/null)
            if [[ "$event_date" == "$date" ]]; then
                events+=("$f")
            fi
        fi
    done
    
    if [[ ${#events[@]} -eq 0 ]]; then
        echo "📭 该日期无事件记录"
        return
    fi
    
    # 按时间排序
    IFS=$'\n' sorted=($(sort -t'"' -k4 <<< "${events[*]}"))
    unset IFS
    
    # 输出时间线
    echo "时间线 (${#sorted[@]} 个事件):"
    echo ""
    
    local critical_count=0
    local warning_count=0
    local repair_count=0
    
    for event_file in "${sorted[@]}"; do
        local event=$(cat "$event_file" 2>/dev/null)
        local ts=$(echo "$event" | python3 -c "import json,sys; print(json.load(sys.stdin)['ts'])" 2>/dev/null)
        local type=$(echo "$event" | python3 -c "import json,sys; print(json.load(sys.stdin)['type'])" 2>/dev/null)
        local severity=$(echo "$event" | python3 -c "import json,sys; print(json.load(sys.stdin)['severity'])" 2>/dev/null)
        local summary=$(echo "$event" | python3 -c "import json,sys; print(json.load(sys.stdin)['summary'])" 2>/dev/null)
        
        # 统计
        [[ "$severity" == "critical" ]] && critical_count=$((critical_count + 1))
        [[ "$severity" == "warning" ]] && warning_count=$((warning_count + 1))
        [[ "$type" == repair.* ]] && repair_count=$((repair_count + 1))
        
        # 着色
        local color=""
        case "$severity" in
            critical) color="🔴" ;;
            warning)  color="🟡" ;;
            info)     color="🟢" ;;
            *)        color="⚪" ;;
        esac
        
        echo "$color $ts"
        echo "   类型: $type"
        echo "   摘要: $summary"
        echo ""
    done
    
    # 统计摘要
    echo "=========================================="
    echo "统计:"
    echo "  Critical: $critical_count"
    echo "  Warning: $warning_count"
    echo "  修复次数: $repair_count"
    echo ""
    
    # 关联的快照
    local snapshots=$(ls "$SNAPSHOTS_DIR"/snapshot_${date_pattern}*.tar.gz 2>/dev/null | wc -l | tr -d ' ')
    if [[ $snapshots -gt 0 ]]; then
        echo "📸 快照: $snapshots 个"
    fi
    
    # 关联的 Agent 报告
    local agent_reports=$(ls "$AGENTS_DIR"/*_${date_pattern}*.md 2>/dev/null | wc -l | tr -d ' ')
    if [[ $agent_reports -gt 0 ]]; then
        echo "🤖 Agent 报告: $agent_reports 个"
    fi
}

# 按事件 ID 复盘
replay_by_event() {
    local event_id="$1"
    
    echo "📊 事件详情: $event_id"
    echo "=========================================="
    echo ""
    
    # 查找事件文件
    local event_file=""
    for dir in "$EVENTS_PROCESSED" "$EVENTS_ARCHIVE"; do
        if [[ -f "$dir/${event_id}.json" ]]; then
            event_file="$dir/${event_id}.json"
            break
        fi
    done
    
    if [[ -z "$event_file" ]]; then
        # 尝试模糊匹配
        event_file=$(ls "$EVENTS_PROCESSED"/${event_id}*.json 2>/dev/null | head -1)
        [[ -z "$event_file" ]] && event_file=$(ls "$EVENTS_ARCHIVE"/${event_id}*.json 2>/dev/null | head -1)
    fi
    
    if [[ -z "$event_file" ]]; then
        echo "❌ 事件不存在: $event_id"
        return 1
    fi
    
    # 显示事件详情
    cat "$event_file" | python3 -m json.tool 2>/dev/null || cat "$event_file"
    echo ""
    
    # 查找关联事件
    local event=$(cat "$event_file")
    local event_type=$(echo "$event" | python3 -c "import json,sys; print(json.load(sys.stdin)['type'])" 2>/dev/null)
    local ts=$(echo "$event" | python3 -c "import json,sys; print(json.load(sys.stdin)['ts'])" 2>/dev/null)
    
    echo "关联信息:"
    echo "──────────────────────────────────────────"
    
    # 如果是 critical 事件，查找后续处理
    if [[ "$event_type" == "critical.detected" ]]; then
        echo ""
        echo "后续处理事件:"
        
        for f in "$EVENTS_PROCESSED"/*.json "$EVENTS_ARCHIVE"/*.json; do
            if [[ -f "$f" ]]; then
                local f_ts=$(cat "$f" | python3 -c "import json,sys; print(json.load(sys.stdin)['ts'])" 2>/dev/null)
                if [[ "$f_ts" > "$ts" ]]; then
                    local f_type=$(cat "$f" | python3 -c "import json,sys; print(json.load(sys.stdin)['type'])" 2>/dev/null)
                    if [[ "$f_type" == repair.* || "$f_type" == judge.* || "$f_type" == snapshot.* ]]; then
                        local f_summary=$(cat "$f" | python3 -c "import json,sys; print(json.load(sys.stdin)['summary'])" 2>/dev/null)
                        echo "  $f_ts: $f_type - $f_summary"
                    fi
                fi
            fi
        done 2>/dev/null | head -10
    fi
}

# 最近事件复盘
replay_latest() {
    local count="${1:-10}"
    
    echo "📊 最近 $count 个事件"
    echo "=========================================="
    echo ""
    
    local events=()
    
    # 收集最近事件
    for dir in "$EVENTS_PROCESSED" "$EVENTS_ARCHIVE"; do
        for f in "$dir"/*.json; do
            if [[ -f "$f" ]]; then
                events+=("$f")
            fi
        done
    done
    
    # 按时间排序，取最新的
    IFS=$'\n' sorted=($(for f in "${events[@]}"; do
        ts=$(cat "$f" | python3 -c "import json,sys; print(json.load(sys.stdin)['ts'])" 2>/dev/null)
        echo "$ts $f"
    done | sort -r | head -n $count))
    unset IFS
    
    for line in "${sorted[@]}"; do
        local event_file=$(echo "$line" | cut -d' ' -f2-)
        if [[ -f "$event_file" ]]; then
            local event=$(cat "$event_file")
            local ts=$(echo "$event" | python3 -c "import json,sys; print(json.load(sys.stdin)['ts'])" 2>/dev/null)
            local type=$(echo "$event" | python3 -c "import json,sys; print(json.load(sys.stdin)['type'])" 2>/dev/null)
            local severity=$(echo "$event" | python3 -c "import json,sys; print(json.load(sys.stdin)['severity'])" 2>/dev/null)
            local summary=$(echo "$event" | python3 -c "import json,sys; print(json.load(sys.stdin)['summary'])" 2>/dev/null)
            
            local color=""
            case "$severity" in
                critical) color="🔴" ;;
                warning)  color="🟡" ;;
                *)        color="🟢" ;;
            esac
            
            echo "$color $ts"
            echo "   $type: $summary"
            echo ""
        fi
    done
}

# 生成复盘报告
generate_report() {
    local date="$1"
    local report_file="$AUTOHEAL_DIR/reports/replay_${date}.md"
    
    mkdir -p "$(dirname "$report_file")"
    
    echo "生成复盘报告: $report_file"
    
    {
        echo "# 事件复盘报告"
        echo ""
        echo "**日期**: $date"
        echo "**生成时间**: $(date)"
        echo ""
        echo "---"
        echo ""
        
        # 运行复盘并捕获输出
        replay_by_date "$date"
        
    } > "$report_file" 2>&1
    
    echo "✅ 报告已生成"
}

# 主入口
case "${1:-}" in
    date)
        replay_by_date "$2"
        ;;
    event)
        replay_by_event "$2"
        ;;
    latest)
        replay_latest "${2:-10}"
        ;;
    report)
        generate_report "$2"
        ;;
    today)
        replay_by_date "$(date +%Y-%m-%d)"
        ;;
    yesterday)
        replay_by_date "$(date -v-1d +%Y-%m-%d 2>/dev/null || date -d 'yesterday' +%Y-%m-%d)"
        ;;
    *)
        echo "事件复盘工具"
        echo ""
        echo "用法:"
        echo "  $0 date <日期>       - 按日期复盘 (YYYY-MM-DD)"
        echo "  $0 event <事件ID>    - 按事件ID复盘"
        echo "  $0 latest [数量]     - 最近N个事件"
        echo "  $0 today             - 今日复盘"
        echo "  $0 yesterday         - 昨日复盘"
        echo "  $0 report <日期>     - 生成复盘报告"
        echo ""
        echo "示例:"
        echo "  $0 date 2026-03-17"
        echo "  $0 event evt_20260317_040001"
        echo "  $0 latest 20"
        ;;
esac