#!/bin/bash
# Telegram Bot 命令处理器
# 让 Telegram 成为远程运维入口

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$SCRIPT_DIR/data"
LOG_DIR="$SCRIPT_DIR/logs"

# 获取最新健康数据
get_latest_health() {
    local latest=$(ls -t "$DATA_DIR"/health_*.json 2>/dev/null | head -1)
    if [[ -f "$latest" ]]; then
        cat "$latest"
    else
        echo '{"error": "无健康数据"}'
    fi
}

# /health 命令 - 返回最新健康摘要
cmd_health() {
    local data=$(get_latest_health)
    local critical=$(echo "$data" | grep -o '"critical_count":[0-9]*' | grep -o '[0-9]*')
    local warning=$(echo "$data" | grep -o '"warning_count":[0-9]*' | grep -o '[0-9]*')
    local exit_code=$(echo "$data" | grep -o '"exit_code":[0-9]*' | grep -o '[0-9]*')
    local latency=$(echo "$data" | grep -o '"telegram_latency_ms":[0-9]*' | grep -o '[0-9]*')
    
    local status_emoji="🟢"
    [[ $exit_code -eq 10 ]] && status_emoji="🟡"
    [[ $exit_code -ge 20 ]] && status_emoji="🔴"
    
    echo "$status_emoji <b>系统健康状态</b>

Critical: $critical
Warning: $warning
Exit Code: $exit_code
Telegram 延迟: ${latency}ms

上次检查: $(echo "$data" | grep -o '"timestamp":"[^"]*"' | cut -d'"' -f4)"
}

# /summary 命令 - 今日摘要
cmd_summary() {
    local today=$(date +%Y-%m-%d)
    local digest_file="$DATA_DIR/digest_$today.md"
    
    if [[ -f "$digest_file" ]]; then
        local content=$(cat "$digest_file")
        local critical=$(echo "$content" | grep "Critical:" | grep -o '[0-9]*')
        local warning=$(echo "$content" | grep "Warning:" | grep -o '[0-9]*')
        
        local status_emoji="🟢"
        [[ $warning -gt 0 ]] && status_emoji="🟡"
        [[ $critical -gt 0 ]] && status_emoji="🔴"
        
        echo "$status_emoji <b>今日 Auto-Heal 摘要</b>

📅 $today
🔴 Critical: $critical
🟡 Warning: $warning

$(if [[ $critical -gt 0 ]]; then echo "⚠️ 有需要人工检查的异常"; else echo "✅ 系统运行正常"; fi)"
    else
        echo "📭 今日暂无摘要数据"
    fi
}

# /alerts 命令 - 最近告警
cmd_alerts() {
    local data=$(get_latest_health)
    local alerts=$(echo "$data" | grep -o '"alerts":\[[^]]*\]' | sed 's/"alerts":\[//;s/\]$//;s/"//g;s/,/\n/g')
    
    if [[ -z "$alerts" || "$alerts" == "null" ]]; then
        echo "✅ 当前无活跃告警"
    else
        echo "🚨 <b>最近告警</b>

$alerts"
    fi
}

# /sessions 命令 - 活跃会话
cmd_sessions() {
    local sessions=$(openclaw sessions list 2>/dev/null | wc -l)
    echo "💬 <b>活跃会话</b>

当前活跃会话数: $sessions

$(if [[ $sessions -gt 5 ]]; then echo "⚠️ 会话数偏高"; else echo "✅ 会话数正常"; fi)"
}

# /models 命令 - 模型状态
cmd_models() {
    local models=$(openclaw models 2>/dev/null | head -10)
    
    echo "🤖 <b>模型状态</b>

<pre>$models</pre>

✅ 关键模型 bailian/kimi-k2.5 可用"
}

# /restart_gateway 命令 - 重启 Gateway
cmd_restart_gateway() {
    echo "🔄 正在重启 Gateway..."
    
    if openclaw gateway restart 2>&1; then
        sleep 2
        if openclaw gateway status 2>&1 | grep -q "running"; then
            echo "✅ Gateway 重启成功"
        else
            echo "⚠️ Gateway 重启后状态异常"
        fi
    else
        echo "❌ Gateway 重启失败"
    fi
}

# /repair 命令 - 手动触发修复
cmd_repair() {
    echo "🔧 正在触发自动修复..."
    
    local output=$("$SCRIPT_DIR/autoheal.sh" --repair 2>&1)
    
    if echo "$output" | grep -q "修复完成\|健康检查通过"; then
        echo "✅ 自动修复完成"
    else
        echo "⚠️ 自动修复遇到问题，请查看日志"
    fi
}

# 主处理函数
process_command() {
    local cmd="$1"
    
    case "$cmd" in
        /health)
            cmd_health
            ;;
        /summary)
            cmd_summary
            ;;
        /alerts)
            cmd_alerts
            ;;
        /sessions)
            cmd_sessions
            ;;
        /models)
            cmd_models
            ;;
        /restart_gateway)
            cmd_restart_gateway
            ;;
        /repair)
            cmd_repair
            ;;
        *)
            echo "❓ 未知命令: $cmd

可用命令:
/health - 健康状态
/summary - 今日摘要
/alerts - 最近告警
/sessions - 活跃会话
/models - 模型状态
/restart_gateway - 重启 Gateway
/repair - 触发修复"
            ;;
    esac
}

# 如果直接运行，处理传入的命令
if [[ $# -gt 0 ]]; then
    process_command "$1"
fi