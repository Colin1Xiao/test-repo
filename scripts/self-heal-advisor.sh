#!/bin/bash
# OpenClaw 自愈建议系统
# 根据健康状态自动提供修复建议

HEALTH_FILE="/Users/colin/.openclaw/workspace/openclaw-health-check.json"
ADVICE_DB="/Users/colin/.openclaw/workspace/self-heal-db.json"

# 不使用颜色代码，使用 emoji 代替

# 读取 JSON 字段（使用 node）
json_get() {
    local file=$1
    local key=$2
    node -e "const data = require('fs').readFileSync('$file', 'utf8'); const json = JSON.parse(data); console.log(json.$key || '');" 2>/dev/null || echo ""
}

# 读取嵌套字段
json_get_nested() {
    local file=$1
    local path=$2
    node -e "const data = require('fs').readFileSync('$file', 'utf8'); const json = JSON.parse(data); console.log($path || '');" 2>/dev/null || echo ""
}

# 生成自愈建议
generate_advice() {
    local component=$1
    local status=$2
    local severity=$3
    
    echo ""
    echo "💡 建议操作："
    
    case "$component:$status" in
        "gateway:stopped")
            echo "  1. 启动 Gateway: ${GREEN}openclaw gateway start${NC}"
            echo "  2. 检查端口占用: ${GREEN}lsof -i :18789${NC}"
            echo "  3. 强制重启: ${YELLOW}pkill -f 'openclaw gateway' && openclaw gateway start${NC}"
            ;;
        "memorySearch:model_missing")
            echo "  1. 检查模型目录: ${GREEN}ls ~/.openclaw/memory/models/${NC}"
            echo "  2. 从备份恢复（需确认）"
            echo "  3. 重新下载模型（需确认）"
            ;;
        "telegram:not_configured")
            echo "  1. 检查配置: ${GREEN}cat ~/.openclaw/openclaw.json | grep -A5 telegram${NC}"
            echo "  2. 重新配置: ${YELLOW}openclaw configure${NC}"
            ;;
        "cron:not_initialized")
            echo "  1. 初始化目录: ${GREEN}mkdir -p ~/.openclaw/state/cron${NC}"
            echo "  ℹ️  这不是错误，只是没有配置定时任务"
            ;;
        *)
            echo "  1. 查看详细日志"
            echo "  2. 尝试重启相关服务"
            echo "  3. 如果问题持续，检查配置文件"
            ;;
    esac
}

# 生成影响说明
generate_impact() {
    local component=$1
    local status=$2
    
    echo ""
    echo "⚠️  当前限制："
    
    case "$component" in
        "gateway")
            echo "  - Telegram 消息发送可能受限"
            echo "  - Cron 任务执行可能受影响"
            ;;
        "memorySearch")
            echo "  - 记忆搜索功能已禁用"
            echo "  - 跨会话记忆检索失败"
            ;;
        "telegram")
            echo "  - 无法发送/接收 Telegram 消息"
            ;;
        *)
            echo "  - 部分功能可能受限"
            ;;
    esac
}

# 主函数
main() {
    if [ ! -f "$HEALTH_FILE" ]; then
        echo "❌ 健康状态文件不存在: $HEALTH_FILE"
        echo "请先运行: ~/.openclaw/workspace/scripts/openclaw-health-check.sh"
        exit 1
    fi
    
    # 读取整体状态
    local overall_status=$(json_get_nested "$HEALTH_FILE" "json.overall.status")
    local changed=$(json_get_nested "$HEALTH_FILE" "json.changed")
    
    echo "========================================"
    echo "   OpenClaw 自愈建议系统"
    echo "========================================"
    echo ""
    
    # 检查各组件
    local has_issues=false
    
    # Gateway
    local gateway_status=$(json_get_nested "$HEALTH_FILE" "json.components.gateway.status")
    local gateway_severity=$(json_get_nested "$HEALTH_FILE" "json.components.gateway.severity")
    
    if [ "$gateway_status" != "running" ] && [ -n "$gateway_status" ]; then
        has_issues=true
        echo "🟡 Gateway: $gateway_status"
        generate_advice "gateway" "$gateway_status" "$gateway_severity"
        generate_impact "gateway" "$gateway_status"
        echo ""
    fi
    
    # Memory Search
    local memory_status=$(json_get_nested "$HEALTH_FILE" "json.components.memorySearch.status")
    local memory_severity=$(json_get_nested "$HEALTH_FILE" "json.components.memorySearch.severity")
    
    if [ "$memory_status" = "model_missing" ]; then
        has_issues=true
        echo "🔴 Memory Search: $memory_status"
        generate_advice "memorySearch" "$memory_status" "$memory_severity"
        generate_impact "memorySearch" "$memory_status"
        echo ""
    fi
    
    # Telegram
    local telegram_status=$(json_get_nested "$HEALTH_FILE" "json.components.telegram.status")
    
    if [ "$telegram_status" = "not_configured" ]; then
        has_issues=true
        echo "🟡 Telegram: $telegram_status"
        generate_advice "telegram" "$telegram_status" "1"
        generate_impact "telegram" "$telegram_status"
        echo ""
    fi
    
    # Cron
    local cron_status=$(json_get_nested "$HEALTH_FILE" "json.components.cron.status")
    
    if [ "$cron_status" = "not_initialized" ]; then
        echo "🟢 Cron: $cron_status"
        generate_advice "cron" "$cron_status" "0"
        echo ""
    fi
    
    if [ "$has_issues" = false ]; then
        echo "✅ 所有组件运行正常，无需修复操作"
        echo ""
        echo "系统状态: 🟢 healthy"
    else
        echo "========================================"
        echo "⚠️  检测到异常，建议按优先级尝试修复"
        echo "========================================"
    fi
    
    echo ""
    echo "详细状态: $HEALTH_FILE"
}

# 如果直接运行此脚本
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi
