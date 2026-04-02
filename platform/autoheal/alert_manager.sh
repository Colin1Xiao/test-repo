#!/bin/bash
# 告警管理器 - 去重、聚合、智能通知
# 避免同一问题反复通知

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$SCRIPT_DIR/data"
ALERT_STATE="$DATA_DIR/alert_state.json"

mkdir -p "$DATA_DIR"

# 初始化状态
init_state() {
    if [[ ! -f "$ALERT_STATE" ]]; then
        echo '{"alerts": {}, "lastCleanup": null}' > "$ALERT_STATE"
    fi
}

# 哈希告警内容
hash_alert() {
    local alert="$1"
    echo "$alert" | shasum -a 256 | cut -d' ' -f1
}

# 检查是否应该通知（去重）
should_notify() {
    local alert="$1"
    local level="${2:-warning}"
    local hash=$(hash_alert "$alert")
    
    init_state
    
    local now=$(date +%s)
    
    # 使用 python 解析 JSON 更可靠
    local last_notified=$(python3 -c "
import json
try:
    with open('$ALERT_STATE') as f:
        data = json.load(f)
    alert = data.get('alerts', {}).get('$hash', {})
    print(alert.get('lastNotified', 0))
except:
    print(0)
" 2>/dev/null || echo "0")
    
    if [[ -n "$last_notified" && "$last_notified" != "0" ]]; then
        local age=$((now - last_notified))
        
        # 根据级别决定冷却时间
        local cooldown=3600  # 默认1小时
        case "$level" in
            critical) cooldown=1800 ;;  # Critical: 30分钟
            warning)  cooldown=3600 ;;  # Warning: 1小时
            info)     cooldown=7200 ;;  # Info: 2小时
        esac
        
        if [[ $age -lt $cooldown ]]; then
            echo "skip"
            return
        fi
    fi
    
    echo "notify"
}

# 记录告警
record_alert() {
    local alert="$1"
    local level="${2:-warning}"
    local hash=$(hash_alert "$alert")
    local now=$(date +%s)
    
    init_state
    
    # 更新状态
    local tmp_file=$(mktemp)
    cat "$ALERT_STATE" | python3 -c "
import json, sys
data = json.load(sys.stdin)
alert_key = '$hash'
if 'alerts' not in data:
    data['alerts'] = {}
data['alerts'][alert_key] = {
    'message': '$alert',
    'level': '$level',
    'lastNotified': $now,
    'count': data['alerts'].get(alert_key, {}).get('count', 0) + 1
}
print(json.dumps(data, indent=2))
" > "$tmp_file" 2>/dev/null && mv "$tmp_file" "$ALERT_STATE"
}

# 获取告警频率
get_alert_frequency() {
    local alert="$1"
    local hash=$(hash_alert "$alert")
    
    init_state
    
    local count=$(cat "$ALERT_STATE" | grep -o "\"$hash\":[^}]*" | grep -o '"count":[0-9]*' | grep -o '[0-9]*')
    echo "${count:-0}"
}

# 聚合告警（合并相似告警）
aggregate_alerts() {
    local alerts=("$@")
    local aggregated=()
    local seen_groups=()
    
    for alert in "${alerts[@]}"; do
        # 提取关键词
        local keyword=$(echo "$alert" | grep -oE '(Gateway|OCNMPS|Telegram|模型|磁盘|内存|CPU)' | head -1)
        
        if [[ -z "$keyword" ]]; then
            keyword="其他"
        fi
        
        # 检查是否已聚合
        local found=false
        for i in "${!aggregated[@]}"; do
            if [[ "${aggregated[$i]}" == *"$keyword"* ]]; then
                # 增加计数
                aggregated[$i]="${aggregated[$i]} (+1)"
                found=true
                break
            fi
        done
        
        if [[ "$found" == "false" ]]; then
            aggregated+=("[$keyword] $alert")
        fi
    done
    
    printf '%s\n' "${aggregated[@]}"
}

# 清理过期告警
cleanup_old_alerts() {
    local max_age=86400  # 24小时
    local now=$(date +%s)
    
    init_state
    
    local tmp_file=$(mktemp)
    cat "$ALERT_STATE" | python3 -c "
import json, sys, time
data = json.load(sys.stdin)
now = $now
max_age = $max_age

if 'alerts' in data:
    data['alerts'] = {
        k: v for k, v in data['alerts'].items()
        if now - v.get('lastNotified', 0) < max_age
    }
data['lastCleanup'] = now

print(json.dumps(data, indent=2))
" > "$tmp_file" 2>/dev/null && mv "$tmp_file" "$ALERT_STATE"
    
    echo "已清理过期告警"
}

# 生成告警摘要
generate_summary() {
    init_state
    
    local state=$(cat "$ALERT_STATE")
    local total=$(echo "$state" | grep -o '"count":[0-9]*' | wc -l)
    local critical=$(echo "$state" | grep -o '"level": "critical"' | wc -l)
    local warning=$(echo "$state" | grep -o '"level": "warning"' | wc -l)
    
    echo "📊 告警摘要"
    echo "=============================="
    echo "活跃告警: $total"
    echo "  Critical: $critical"
    echo "  Warning: $warning"
    echo ""
    
    # 显示最近的告警
    echo "最近告警:"
    echo "$state" | grep -o '"message": "[^"]*"' | head -5 | sed 's/"message": "//;s/"$//' | while read -r msg; do
        echo "  - $msg"
    done
}

# 智能通知（带去重）
smart_notify() {
    local alert="$1"
    local level="${2:-warning}"
    
    if [[ $(should_notify "$alert" "$level") == "notify" ]]; then
        # 记录
        record_alert "$alert" "$level"
        
        # 获取频率
        local freq=$(get_alert_frequency "$alert")
        
        # 发送通知
        local message="$alert"
        if [[ $freq -gt 1 ]]; then
            message="$alert (第${freq}次)"
        fi
        
        # macOS 通知
        if command -v osascript > /dev/null; then
            local title="OpenClaw Alert"
            case "$level" in
                critical) title="🔴 OpenClaw Critical" ;;
                warning)  title="🟡 OpenClaw Warning" ;;
            esac
            osascript -e "display notification \"$message\" with title \"$title\"" 2>/dev/null
        fi
        
        echo "NOTIFIED: $message"
    else
        echo "SKIPPED (duplicate): $alert"
    fi
}

# 主入口
case "${1:-}" in
    check)
        should_notify "$2" "${3:-warning}"
        ;;
    record)
        record_alert "$2" "${3:-warning}"
        ;;
    notify)
        smart_notify "$2" "${3:-warning}"
        ;;
    summary)
        generate_summary
        ;;
    cleanup)
        cleanup_old_alerts
        ;;
    aggregate)
        shift
        aggregate_alerts "$@"
        ;;
    *)
        echo "告警管理器"
        echo ""
        echo "用法:"
        echo "  $0 notify <告警> [级别]   - 智能通知（带去重）"
        echo "  $0 check <告警> [级别]    - 检查是否应通知"
        echo "  $0 record <告警> [级别]   - 记录告警"
        echo "  $0 summary                - 告警摘要"
        echo "  $0 cleanup                - 清理过期告警"
        echo "  $0 aggregate <告警...>    - 聚合相似告警"
        ;;
esac