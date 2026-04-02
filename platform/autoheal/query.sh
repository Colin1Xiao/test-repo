#!/bin/bash
# 自然语言运维查询接口
# 支持: "检查今天有没有异常" "最近哪个模型最不靠谱" 等

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$SCRIPT_DIR/data"
MEMORY_DIR="$SCRIPT_DIR/ops_memory"

# 解析自然语言查询
parse_query() {
    local query="$1"
    local query_lower=$(echo "$query" | tr '[:upper:]' '[:lower:]')
    
    # 模式匹配
    case "$query_lower" in
        *"今天"*"异常"*|*"今天"*"问题"*)
            echo "check_today"
            ;;
        *"今天"*"健康"*|*"今天"*"状态"*)
            echo "health_today"
            ;;
        *"最近"*"模型"*|*"哪个模型"*)
            echo "model_status"
            ;;
        *"最近"*"告警"*|*"有什么告警"*)
            echo "recent_alerts"
            ;;
        *"这周"*"稳定"*|*"这周"*"健康"*|*"本周"*"情况"*)
            echo "weekly_summary"
            ;;
        *"需要人工"*|*"人工review"*|*"需要检查"*)
            echo "need_review"
            ;;
        *"gateway"*|*"网关"*)
            echo "gateway_status"
            ;;
        *"telegram"*|*"电报"*)
            echo "telegram_status"
            ;;
        *"趋势"*|*"变化"*|*"历史"*)
            echo "trends"
            ;;
        *"怎么修"*|*"如何修复"*|*"解决方案"*|*"上次怎么"*)
            echo "search_repairs"
            ;;
        *"operator"*|*"权限"*|*"probe"*)
            echo "search_known_issues"
            ;;
        *)
            echo "general_search"
            ;;
    esac
}

# 执行查询
execute_query() {
    local query_type="$1"
    local original_query="$2"
    local today=$(date +%Y-%m-%d)
    
    case "$query_type" in
        check_today)
            echo "📅 今日系统检查"
            echo "=============================="
            
            local file="$DATA_DIR/health_$today.json"
            if [[ -f "$file" ]]; then
                local critical=$(grep -o '"critical_count":[0-9]*' "$file" | grep -o '[0-9]*')
                local warning=$(grep -o '"warning_count":[0-9]*' "$file" | grep -o '[0-9]*')
                local alerts=$(grep -o '"alerts":\[[^]]*\]' "$file" | sed 's/"alerts":\[//;s/\]$//;s/"//g')
                
                if [[ $critical -gt 0 ]]; then
                    echo "🔴 发现 $critical 个关键异常！"
                    echo ""
                    echo "告警:"
                    echo "$alerts" | tr ',' '\n'
                elif [[ $warning -gt 0 ]]; then
                    echo "🟡 发现 $warning 个警告"
                    echo ""
                    echo "告警:"
                    echo "$alerts" | tr ',' '\n'
                else
                    echo "✅ 今日无异常"
                fi
            else
                echo "📭 今日暂无检查数据"
            fi
            ;;
            
        health_today)
            echo "📅 今日健康报告"
            echo "=============================="
            
            local file="$DATA_DIR/health_$today.json"
            if [[ -f "$file" ]]; then
                cat "$file" | python3 -m json.tool 2>/dev/null || cat "$file"
            else
                # 实时检查
                "$SCRIPT_DIR/autoheal.sh" 2>/dev/null || echo "检查失败"
            fi
            ;;
            
        model_status)
            echo "🤖 模型状态分析"
            echo "=============================="
            
            # 检查最近7天的模型相关告警
            local model_issues=()
            for i in {0..6}; do
                local date=$(date -v-${i}d +%Y-%m-%d 2>/dev/null || date -d "-$i days" +%Y-%m-%d)
                local file="$DATA_DIR/health_$date.json"
                
                if [[ -f "$file" ]]; then
                    local alerts=$(grep -o '"alerts":\[[^]]*\]' "$file" | grep -i "模型")
                    if [[ -n "$alerts" ]]; then
                        model_issues+=("$date: $alerts")
                    fi
                fi
            done
            
            if [[ ${#model_issues[@]} -gt 0 ]]; then
                echo "发现模型相关问题:"
                printf '%s\n' "${model_issues[@]}"
            else
                echo "✅ 最近7天模型状态稳定"
            fi
            
            echo ""
            echo "当前模型:"
            openclaw models 2>/dev/null | head -10
            ;;
            
        recent_alerts)
            echo "🚨 最近告警"
            echo "=============================="
            
            local latest=$(ls -t "$DATA_DIR"/health_*.json 2>/dev/null | head -1)
            if [[ -f "$latest" ]]; then
                local alerts=$(grep -o '"alerts":\[[^]]*\]' "$latest" | sed 's/"alerts":\[//;s/\]$//;s/"//g')
                
                if [[ -n "$alerts" && "$alerts" != "null" ]]; then
                    echo "$alerts" | tr ',' '\n' | while read -r alert; do
                        echo "  - $alert"
                    done
                else
                    echo "✅ 无活跃告警"
                fi
            else
                echo "📭 暂无数据"
            fi
            ;;
            
        weekly_summary)
            echo "📊 本周系统概况"
            echo "=============================="
            
            "$SCRIPT_DIR/reporter.sh" --generate 2>/dev/null || echo "周报生成失败"
            
            local report=$(ls -t "$SCRIPT_DIR/reports"/weekly_*.md 2>/dev/null | head -1)
            if [[ -f "$report" ]]; then
                head -30 "$report"
            fi
            ;;
            
        need_review)
            echo "📋 需要人工检查的项目"
            echo "=============================="
            
            local found=false
            
            # 检查今天的数据
            local file="$DATA_DIR/health_$today.json"
            if [[ -f "$file" ]]; then
                local critical=$(grep -o '"critical_count":[0-9]*' "$file" | grep -o '[0-9]*')
                local health_ok=$(grep -o '"health_ok_after": [a-z]*' "$file" | grep -o '[a-z]*')
                
                if [[ $critical -gt 0 ]]; then
                    echo "🔴 关键异常: $critical 个"
                    found=true
                fi
                
                if [[ "$health_ok" == "false" ]]; then
                    echo "⚠️ 自动修复未完全解决问题"
                    found=true
                fi
            fi
            
            # 检查快照目录
            local snapshots=$(ls "$SCRIPT_DIR/snapshots"/snapshot_*.tar.gz 2>/dev/null | wc -l)
            if [[ $snapshots -gt 0 ]]; then
                echo "📸 有 $snapshots 个快照待查看"
                found=true
            fi
            
            if [[ "$found" == "false" ]]; then
                echo "✅ 当前无需人工干预"
            fi
            ;;
            
        gateway_status)
            echo "🚪 Gateway 状态"
            echo "=============================="
            openclaw gateway status 2>&1
            ;;
            
        telegram_status)
            echo "📨 Telegram 状态"
            echo "=============================="
            
            local start=$(date +%s%N)
            curl -s --max-time 5 https://api.telegram.org > /dev/null 2>&1
            local end=$(date +%s%N)
            local latency=$(( (end - start) / 1000000 ))
            
            if [[ $latency -gt 0 ]]; then
                echo "✅ Telegram API 可达"
                echo "延迟: ${latency}ms"
                
                if [[ $latency -gt 2000 ]]; then
                    echo "⚠️ 延迟较高"
                fi
            else
                echo "❌ Telegram API 不可达"
            fi
            ;;
            
        trends)
            echo "📈 系统趋势"
            echo "=============================="
            
            if [[ -f "$DATA_DIR/trends.json" ]]; then
                cat "$DATA_DIR/trends.json" | python3 -m json.tool 2>/dev/null || cat "$DATA_DIR/trends.json"
            else
                echo "暂无趋势数据"
            fi
            ;;
            
        search_repairs)
            echo "🔧 搜索修复方案"
            echo "=============================="
            
            local keyword=$(echo "$original_query" | grep -oE '(gateway|telegram|model|模型|权限|权限|disk|磁盘)' | head -1)
            
            if [[ -n "$keyword" ]]; then
                "$SCRIPT_DIR/ops_memory.sh" search "$keyword"
            else
                "$SCRIPT_DIR/ops_memory.sh" list repairs
            fi
            ;;
            
        search_known_issues)
            echo "🔍 已知问题"
            echo "=============================="
            
            local keyword=$(echo "$original_query" | grep -oE '(operator|probe|权限|permission)' | head -1)
            
            if [[ -n "$keyword" ]]; then
                "$SCRIPT_DIR/ops_memory.sh" search "$keyword"
            else
                "$SCRIPT_DIR/ops_memory.sh" list known_issues
            fi
            ;;
            
        general_search)
            echo "🔍 搜索: $original_query"
            echo "=============================="
            
            # 搜索健康数据
            grep -r -l "$original_query" "$DATA_DIR" 2>/dev/null | head -3
            
            # 搜索记忆库
            echo ""
            "$SCRIPT_DIR/ops_memory.sh" search "$original_query" 2>/dev/null
            ;;
    esac
}

# 自然语言交互
nl_query() {
    local query="$1"
    local query_type=$(parse_query "$query")
    
    echo "🐉 OpenClaw 自然语言查询"
    echo ""
    execute_query "$query_type" "$query"
}

# 主入口
case "${1:-}" in
    ask)
        shift
        nl_query "$*"
        ;;
    parse)
        parse_query "$2"
        ;;
    *)
        if [[ -n "$1" ]]; then
            nl_query "$*"
        else
            echo "自然语言运维查询"
            echo ""
            echo "用法:"
            echo "  $0 ask <自然语言问题>"
            echo ""
            echo "支持的问题类型:"
            echo "  - 今天有没有异常"
            echo "  - 最近哪个模型最不靠谱"
            echo "  - 有什么告警"
            echo "  - 这周系统稳不稳定"
            echo "  - 需要人工检查什么"
            echo "  - Gateway 状态"
            echo "  - Telegram 延迟"
            echo "  - 系统趋势"
            echo "  - 怎么修 gateway"
            echo "  - operator.read 是什么情况"
            echo ""
            echo "示例:"
            echo "  $0 ask 检查今天有没有异常"
            echo "  $0 ask 最近哪个模型最不靠谱"
        fi
        ;;
esac