#!/bin/bash
# Judge 决策统计与分析
# 记录每次裁决结果，支持统计分析

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTOHEAL_DIR="$(dirname "$SCRIPT_DIR")"
STATE_DIR="$AUTOHEAL_DIR/state"
STATS_DIR="$AUTOHEAL_DIR/data/judge_stats"

mkdir -p "$STATS_DIR"

# 记录裁决
record_decision() {
    local decision="$1"
    local confidence="$2"
    local reason="$3"
    local agent_votes="$4"
    
    local timestamp=$(date +%Y-%m-%dT%H:%M:%SZ)
    local date_str=$(date +%Y-%m-%d)
    local record_id=$(date +%Y%m%d_%H%M%S)
    
    # 写入当日记录
    local record_file="$STATS_DIR/decisions_$date_str.jsonl"
    
    python3 << EOF
import json
import os

record = {
    "id": "$record_id",
    "ts": "$timestamp",
    "decision": "$decision",
    "confidence": $confidence,
    "reason": "$reason",
    "agent_votes": $agent_votes
}

# 追加写入
with open("$record_file", "a") as f:
    f.write(json.dumps(record) + "\\n")
    
print("记录已保存: $record_id")
EOF
}

# 统计分析
analyze() {
    local days="${1:-7}"
    
    echo "📊 Judge 决策统计 (最近 $days 天)"
    echo "=========================================="
    echo ""
    
    local total=0
    local auto_repair=0
    local manual_review=0
    local alert_only=0
    local low_confidence=0
    
    # 收集数据
    for i in $(seq 0 $((days - 1))); do
        local date=$(date -v-${i}d +%Y-%m-%d 2>/dev/null || date -d "-$i days" +%Y-%m-%d)
        local file="$STATS_DIR/decisions_$date.jsonl"
        
        if [[ -f "$file" ]]; then
            while IFS= read -r line; do
                total=$((total + 1))
                
                local decision=$(echo "$line" | python3 -c "import json,sys; print(json.load(sys.stdin).get('decision',''))" 2>/dev/null)
                local confidence=$(echo "$line" | python3 -c "import json,sys; print(json.load(sys.stdin).get('confidence',0))" 2>/dev/null)
                
                case "$decision" in
                    auto_repair) auto_repair=$((auto_repair + 1)) ;;
                    manual_review) manual_review=$((manual_review + 1)) ;;
                    alert_only) alert_only=$((alert_only + 1)) ;;
                esac
                
                if (( $(echo "$confidence < 0.75" | bc -l) )); then
                    low_confidence=$((low_confidence + 1))
                fi
            done < "$file"
        fi
    done
    
    if [[ $total -eq 0 ]]; then
        echo "暂无裁决记录"
        return
    fi
    
    echo "总计裁决: $total 次"
    echo ""
    
    echo "决策分布:"
    echo "  自动修复:  $auto_repair ($(echo "scale=1; $auto_repair * 100 / $total" | bc)%)"
    echo "  人工审核:  $manual_review ($(echo "scale=1; $manual_review * 100 / $total" | bc)%)"
    echo "  仅告警:    $alert_only ($(echo "scale=1; $alert_only * 100 / $total" | bc)%)"
    echo ""
    
    echo "置信度:"
    echo "  低置信度 (<0.75): $low_confidence 次"
    echo "  平均置信度: $(calculate_avg_confidence $days)"
    echo ""
    
    # Agent 冲突统计
    echo "Agent 分析:"
    analyze_agent_conflicts $days
}

# 计算平均置信度
calculate_avg_confidence() {
    local days="$1"
    local sum=0
    local count=0
    
    for i in $(seq 0 $((days - 1))); do
        local date=$(date -v-${i}d +%Y-%m-%d 2>/dev/null || date -d "-$i days" +%Y-%m-%d)
        local file="$STATS_DIR/decisions_$date.jsonl"
        
        if [[ -f "$file" ]]; then
            while IFS= read -r line; do
                local conf=$(echo "$line" | python3 -c "import json,sys; print(json.load(sys.stdin).get('confidence',0))" 2>/dev/null)
                sum=$(echo "$sum + $conf" | bc)
                count=$((count + 1))
            done < "$file"
        fi
    done
    
    if [[ $count -gt 0 ]]; then
        echo "scale=2; $sum / $count" | bc
    else
        echo "N/A"
    fi
}

# 分析 Agent 冲突
analyze_agent_conflicts() {
    local days="$1"
    
    # 简化版：统计各 Agent 建议
    echo "  (需要更多数据支持详细分析)"
}

# 最近裁决列表
recent() {
    local count="${1:-10}"
    
    echo "📋 最近 $count 次裁决"
    echo "=========================================="
    echo ""
    
    # 从最新的文件开始
    for file in $(ls -t "$STATS_DIR"/decisions_*.jsonl 2>/dev/null | head -3); do
        if [[ -f "$file" ]]; then
            tail -$count "$file" 2>/dev/null | while IFS= read -r line; do
                local ts=$(echo "$line" | python3 -c "import json,sys; print(json.load(sys.stdin).get('ts',''))" 2>/dev/null)
                local decision=$(echo "$line" | python3 -c "import json,sys; print(json.load(sys.stdin).get('decision',''))" 2>/dev/null)
                local confidence=$(echo "$line" | python3 -c "import json,sys; print(json.load(sys.stdin).get('confidence',0))" 2>/dev/null)
                local reason=$(echo "$line" | python3 -c "import json,sys; print(json.load(sys.stdin).get('reason','')[:50])" 2>/dev/null)
                
                local icon=""
                case "$decision" in
                    auto_repair) icon="🔧" ;;
                    manual_review) icon="👤" ;;
                    alert_only) icon="📢" ;;
                    *) icon="❓" ;;
                esac
                
                echo "$icon $ts"
                echo "   决策: $decision (置信度: $confidence)"
                echo "   原因: $reason..."
                echo ""
            done
        fi
    done | head -$((count * 4))
}

# 导出报告
export_report() {
    local output="$AUTOHEAL_DIR/reports/judge_report_$(date +%Y%m%d).md"
    
    {
        echo "# Judge Agent 决策报告"
        echo ""
        echo "**生成时间**: $(date)"
        echo ""
        echo "---"
        echo ""
        
        analyze 7
        echo ""
        echo "---"
        echo ""
        recent 20
        
    } > "$output" 2>&1
    
    echo "报告已导出: $output"
}

# 主入口
case "${1:-}" in
    record)
        shift
        record_decision "$@"
        ;;
    analyze)
        analyze "${2:-7}"
        ;;
    recent)
        recent "${2:-10}"
        ;;
    report)
        export_report
        ;;
    *)
        echo "Judge 决策统计"
        echo ""
        echo "用法:"
        echo "  $0 record <decision> <confidence> <reason> <agent_votes>"
        echo "  $0 analyze [天数]     - 统计分析"
        echo "  $0 recent [数量]      - 最近裁决"
        echo "  $0 report             - 导出报告"
        ;;
esac