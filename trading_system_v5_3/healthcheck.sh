#!/bin/bash
# =============================================================================
# 🐉 小龙交易系统 - 健康检查脚本
# =============================================================================
# 功能：
#   - 检查 /api/health 端点
#   - 判断关键指标（worker_alive, snapshot_age_sec, data_valid, okx_api）
#   - 输出状态（OK/DEGRADED/FAILED）
#   - 写本地告警日志
#   - 可选发送 Telegram 消息
#
# 使用：
#   ./healthcheck.sh [--notify]
#
# 定时任务（crontab）：
#   * * * * * /path/to/healthcheck.sh --notify >> /var/log/trading-healthcheck.log 2>&1
# =============================================================================

set -e

# =============================================================================
# 配置
# =============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HEALTH_URL="http://127.0.0.1:8780/api/health"
HEALTH_TIMEOUT=5
LOG_FILE="${SCRIPT_DIR}/healthcheck.log"
ALERT_LOG="${SCRIPT_DIR}/healthcheck-alerts.log"
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-}"

# 阈值配置
SNAPSHOT_AGE_WARN=15      # 快照年龄 >15s 告警
SNAPSHOT_AGE_CRITICAL=60  # 快照年龄 >60s 严重
EQUITY_ZERO_COUNT=3       # equity=0 持续次数触发告警

# 状态跟踪文件
STATE_FILE="${SCRIPT_DIR}/.healthcheck_state.json"

# 颜色输出（TTY 检测）
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    NC='\033[0m'
else
    RED=''
    GREEN=''
    YELLOW=''
    NC=''
fi

# =============================================================================
# 工具函数
# =============================================================================

log_info() {
    echo -e "$(date '+%Y-%m-%d %H:%M:%S') [INFO] $1" | tee -a "$LOG_FILE"
}

log_warn() {
    echo -e "$(date '+%Y-%m-%d %H:%M:%S') ${YELLOW}[WARN]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "$(date '+%Y-%m-%d %H:%M:%S') ${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

log_alert() {
    local level="$1"
    local message="$2"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [$level] $message" >> "$ALERT_LOG"
}

# 发送 Telegram 消息
send_telegram() {
    local message="$1"
    if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d "chat_id=${TELEGRAM_CHAT_ID}" \
            -d "text=${message}" \
            -d "parse_mode=Markdown" > /dev/null
    fi
}

# Python JSON 解析（兼容无 jq）
json_get() {
    local json="$1"
    local key="$2"
    local default="${3:-}"
    python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('$key', '$default'))" <<< "$json" 2>/dev/null || echo "$default"
}

json_get_nested() {
    local json="$1"
    local path="$2"  # 如 "dependency.okx_api"
    local default="${3:-}"
    python3 -c "
import sys,json
d=json.load(sys.stdin)
keys='$path'.split('.')
for k in keys:
    if isinstance(d, dict): d=d.get(k)
    else: d=None
print(d if d is not None else '$default')
" <<< "$json" 2>/dev/null || echo "$default"
}

# 读取状态跟踪文件
load_state() {
    if [ -f "$STATE_FILE" ]; then
        cat "$STATE_FILE"
    else
        echo '{"equity_zero_count":0,"last_alert":""}'
    fi
}

# 保存状态跟踪文件
save_state() {
    local equity_zero_count="$1"
    local last_alert="$2"
    echo "{\"equity_zero_count\":$equity_zero_count,\"last_alert\":\"$last_alert\"}" > "$STATE_FILE"
}

# =============================================================================
# 健康检查
# =============================================================================

check_health() {
    local notify="${1:-false}"
    
    log_info "执行健康检查..."
    
    # 1. 获取健康状态
    local health_data
    health_data=$(curl -s --connect-timeout $HEALTH_TIMEOUT "$HEALTH_URL" 2>/dev/null)
    
    if [ -z "$health_data" ] || [ "$health_data" = "{}" ]; then
        log_error "无法连接健康端点：$HEALTH_URL"
        log_alert "FAILED" "无法连接健康端点"
        [ "$notify" = "true" ] && send_telegram "🔴 **交易系统故障**

状态：FAILED
原因：无法连接健康端点
时间：$(date '+%Y-%m-%d %H:%M:%S')
位置：$SCRIPT_DIR"
        return 2
    fi
    
    # 2. 解析关键字段
    local status=$(json_get "$health_data" "status" "unknown")
    local worker_alive=$(json_get "$health_data" "worker_alive" "false")
    local snapshot_age=$(json_get "$health_data" "snapshot_age_sec" "999")
    local data_valid=$(json_get "$health_data" "data_valid" "false")
    local equity=$(json_get "$health_data" "equity" "0")
    local okx_api=$(json_get_nested "$health_data" "dependency.okx_api" "unknown")
    local file_fallback=$(json_get_nested "$health_data" "dependency.file_fallback" "unknown")
    local fail_count=$(json_get "$health_data" "fail_count" "0")
    local last_error=$(json_get "$health_data" "last_error" "")
    
    # 3. 加载状态跟踪
    local state=$(load_state)
    local equity_zero_count=$(json_get "$state" "equity_zero_count" "0")
    
    # 4. 判断总体状态
    local overall_status="OK"
    local alerts=""
    
    # Critical 条件
    if [ "$worker_alive" = "false" ]; then
        overall_status="FAILED"
        alerts="${alerts}Worker 未运行; "
    fi
    
    if [ "$snapshot_age" -gt "$SNAPSHOT_AGE_CRITICAL" ] 2>/dev/null; then
        overall_status="FAILED"
        alerts="${alerts}快照陈旧 (${snapshot_age}s); "
    fi
    
    # Warning 条件
    if [ "$overall_status" != "FAILED" ]; then
        if [ "$snapshot_age" -gt "$SNAPSHOT_AGE_WARN" ] 2>/dev/null; then
            overall_status="DEGRADED"
            alerts="${alerts}快照延迟 (${snapshot_age}s); "
        fi
        
        if [ "$data_valid" = "false" ]; then
            # equity=0 持续计数
            equity_zero_count=$((equity_zero_count + 1))
            if [ "$equity_zero_count" -ge "$EQUITY_ZERO_COUNT" ]; then
                overall_status="DEGRADED"
                alerts="${alerts}账户权益为 0 (持续${equity_zero_count}次); "
            fi
        else
            equity_zero_count=0
        fi
        
        if [ "$okx_api" = "failed" ]; then
            overall_status="DEGRADED"
            alerts="${alerts}OKX API 异常; "
        fi
    fi
    
    # 5. 输出结果
    case "$overall_status" in
        OK)
            log_info "✅ 状态：OK | Worker: $worker_alive | 快照：${snapshot_age}s | 权益：$equity USDT"
            ;;
        DEGRADED)
            log_warn "⚠️  状态：DEGRADED | 告警：$alerts"
            log_alert "DEGRADED" "$alerts"
            ;;
        FAILED)
            log_error "🔴 状态：FAILED | 告警：$alerts"
            log_alert "FAILED" "$alerts"
            ;;
    esac
    
    # 6. 发送通知（如需要）
    if [ "$notify" = "true" ] && [ "$overall_status" != "OK" ]; then
        local emoji="⚠️"
        [ "$overall_status" = "FAILED" ] && emoji="🔴"
        
        send_telegram "${emoji} **交易系统告警**

状态：$overall_status
告警：$alerts
Worker: $worker_alive
快照：${snapshot_age}s
权益：$equity USDT
OKX: $okx_api
时间：$(date '+%Y-%m-%d %H:%M:%S')"
    fi
    
    # 7. 保存状态
    save_state "$equity_zero_count" "$overall_status"
    
    # 8. 返回状态码
    case "$overall_status" in
        OK) return 0 ;;
        DEGRADED) return 1 ;;
        FAILED) return 2 ;;
    esac
}

# =============================================================================
# 主入口
# =============================================================================

case "${1:-}" in
    --notify|-n)
        check_health "true"
        ;;
    --help|-h)
        echo "🐉 小龙交易系统 - 健康检查"
        echo ""
        echo "用法：$0 [--notify]"
        echo ""
        echo "选项:"
        echo "  --notify, -n  发送 Telegram 通知（如状态异常）"
        echo "  --help, -h    显示帮助"
        echo ""
        echo "示例:"
        echo "  $0              # 仅检查，不通知"
        echo "  $0 --notify     # 检查并发送通知"
        echo ""
        echo "crontab 配置:"
        echo "  * * * * * /path/to/healthcheck.sh --notify >> /var/log/trading-healthcheck.log 2>&1"
        ;;
    *)
        check_health "false"
        ;;
esac
