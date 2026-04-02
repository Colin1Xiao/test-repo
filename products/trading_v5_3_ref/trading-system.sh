#!/bin/bash
# =============================================================================
# 🐉 小龙交易系统 - 统一进程管理脚本 (macOS/Linux 兼容版)
# =============================================================================
# 功能：
#   - start:   启动服务（带单实例锁 + 端口检查 + 健康验证）
#   - stop:    停止服务（SIGTERM 优先，SIGKILL 兜底）
#   - restart: 重启服务
#   - status:  查看状态（进程 + 端口 + 健康检查）
#   - logs:    查看实时日志
#
# 使用：
#   ./trading-system.sh start|stop|restart|status|logs
#
# macOS 兼容说明：
#   - 无 lsof 时使用 netstat 检测端口
#   - 无 jq 时使用 Python 解析 JSON
# =============================================================================

set -e

# =============================================================================
# 配置
# =============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="${SCRIPT_DIR}/.panel.pid"
LOCK_FILE="${SCRIPT_DIR}/.panel.lock"
PORT=8780
HEALTH_URL="http://127.0.0.1:${PORT}/api/health"
HEALTH_TIMEOUT=5
MAX_STARTUP_WAIT=15
LOG_FILE="${SCRIPT_DIR}/panel_v40.log"

# 颜色输出（TTY 检测）
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    NC='\033[0m'
else
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    NC=''
fi

# =============================================================================
# 工具函数
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查 PID 文件
check_pid_file() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            echo "$pid"
            return 0
        else
            log_warn "PID 文件存在但进程已死 ($pid)，清理中..."
            rm -f "$PID_FILE"
        fi
    fi
    return 1
}

# 检查端口占用（macOS/Linux 兼容）
check_port() {
    local pid=""
    
    # 方案 1: lsof (Linux/macOS)
    if command -v lsof > /dev/null 2>&1; then
        pid=$(lsof -ti :$PORT 2>/dev/null | head -1)
    
    # 方案 2: netstat (macOS)
    elif command -v netstat > /dev/null 2>&1; then
        pid=$(netstat -anv -p tcp 2>/dev/null | grep "\.$PORT " | grep LISTEN | awk '{print $NF}' | head -1)
    
    # 方案 3: ss (Linux)
    elif command -v ss > /dev/null 2>&1; then
        pid=$(ss -tlnp 2>/dev/null | grep ":$PORT " | grep -oP 'pid=\K[0-9]+' | head -1)
    fi
    
    if [ -n "$pid" ] && [ "$pid" != "-" ]; then
        echo "$pid"
        return 0
    fi
    return 1
}

# 检查进程命令行是否匹配
check_process_cmdline() {
    local pid=$1
    if ps -p "$pid" > /dev/null 2>&1; then
        local cmdline=$(ps -p "$pid" -o command= 2>/dev/null)
        if [[ "$cmdline" == *"panel_v4"* ]] || [[ "$cmdline" == *"python"* ]]; then
            return 0
        fi
    fi
    return 1
}

# 健康检查
health_check() {
    local response
    response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout $HEALTH_TIMEOUT "$HEALTH_URL" 2>/dev/null)
    if [ "$response" = "200" ]; then
        return 0
    fi
    return 1
}

# 获取健康状态详情（macOS/Linux 兼容 JSON 解析）
get_health_status() {
    curl -s --connect-timeout $HEALTH_TIMEOUT "$HEALTH_URL" 2>/dev/null || echo "{}"
}

# Python JSON 解析器（jq 不存在时使用）
json_get() {
    local json="$1"
    local key="$2"
    local default="${3:-}"
    
    if command -v jq > /dev/null 2>&1; then
        echo "$json" | jq -r ".$key // \"$default\"" 2>/dev/null || echo "$default"
    else
        python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('$key', '$default'))" <<< "$json" 2>/dev/null || echo "$default"
    fi
}

# 解析嵌套 JSON
json_get_nested() {
    local json="$1"
    local path="$2"  # 如 "dependency.okx_api"
    local default="${3:-}"
    
    if command -v jq > /dev/null 2>&1; then
        echo "$json" | jq -r ".$path // \"$default\"" 2>/dev/null || echo "$default"
    else
        python3 -c "
import sys,json
d=json.load(sys.stdin)
keys='$path'.split('.')
for k in keys:
    if isinstance(d, dict): d=d.get(k)
    else: d=None
print(d if d is not None else '$default')
" <<< "$json" 2>/dev/null || echo "$default"
    fi
}

# =============================================================================
# 启动函数
# =============================================================================

do_start() {
    log_info "启动小龙交易系统..."
    
    # 1. 检查是否已经在运行（PID 文件）
    local existing_pid
    if existing_pid=$(check_pid_file); then
        log_warn "服务已在运行 (PID: $existing_pid)"
        log_info "使用 './trading-system.sh status' 查看详情"
        return 1
    fi
    
    # 2. 检查端口占用（可能是旧进程残留）
    local port_pid
    if port_pid=$(check_port); then
        log_warn "端口 $PORT 被占用 (PID: $port_pid)"
        
        # 检查是否是自己的进程
        if check_process_cmdline "$port_pid"; then
            log_warn "占用进程可能是旧的服务实例"
            log_info "尝试停止旧进程..."
            do_stop_quiet
            sleep 2
            
            # 再次检查
            if check_port > /dev/null 2>&1; then
                log_error "端口仍被占用，请手动处理"
                return 1
            fi
            log_success "端口已释放"
        else
            log_error "端口被其他进程占用，无法启动"
            log_info "检查占用进程：ps -p $port_pid -o command="
            return 1
        fi
    fi
    
    # 3. 获取单实例锁（兼容 macOS/Linux）
    if [ -f "$LOCK_FILE" ]; then
        local lock_pid=$(cat "$LOCK_FILE" 2>/dev/null)
        if [ -n "$lock_pid" ] && ps -p "$lock_pid" > /dev/null 2>&1; then
            log_error "单实例锁已存在 (PID: $lock_pid)，可能有其他实例正在运行"
            return 1
        else
            log_warn "清理残留锁文件..."
            rm -f "$LOCK_FILE"
        fi
    fi
    echo "$$" > "$LOCK_FILE"
    
    # 4. 启动服务
    log_info "启动服务进程..."
    cd "$SCRIPT_DIR"
    nohup python3 panel_v40.py > /dev/null 2>&1 &
    local new_pid=$!
    echo "$new_pid" > "$PID_FILE"
    log_success "服务进程已启动 (PID: $new_pid)"
    
    # 5. 等待启动并验证健康
    log_info "等待服务启动 (最多 ${MAX_STARTUP_WAIT}s)..."
    local waited=0
    while [ $waited -lt $MAX_STARTUP_WAIT ]; do
        sleep 1
        waited=$((waited + 1))
        
        if health_check; then
            log_success "服务健康检查通过 (${waited}s)"
            
            # 输出健康状态摘要
            local health_data
            health_data=$(get_health_status)
            local status
            status=$(json_get "$health_data" "status" "unknown")
            
            if [ "$status" = "ok" ]; then
                log_success "服务就绪：status=ok"
            else
                log_warn "服务运行但状态异常：status=$status"
            fi
            
            return 0
        fi
    done
    
    log_error "服务启动超时 (${MAX_STARTUP_WAIT}s)"
    log_info "查看日志：tail -100 $LOG_FILE"
    return 1
}

# =============================================================================
# 停止函数
# =============================================================================

do_stop() {
    log_info "停止小龙交易系统..."
    
    local pid
    if ! pid=$(check_pid_file); then
        # 尝试从端口找进程
        if pid=$(check_port); then
            log_warn "PID 文件不存在，但从端口找到进程 (PID: $pid)"
        else
            log_warn "服务未运行"
            rm -f "$PID_FILE" "$LOCK_FILE"
            return 0
        fi
    fi
    
    log_info "发送 SIGTERM 到进程 $pid..."
    kill "$pid" 2>/dev/null || true
    
    # 等待进程退出（最多 5 秒）
    log_info "等待进程退出..."
    for i in {1..5}; do
        if ! ps -p "$pid" > /dev/null 2>&1; then
            log_success "进程已正常退出 (${i}s)"
            rm -f "$PID_FILE" "$LOCK_FILE"
            return 0
        fi
        sleep 1
    done
    
    # 强制终止
    log_warn "进程未响应 SIGTERM，发送 SIGKILL..."
    kill -9 "$pid" 2>/dev/null || true
    sleep 1
    
    if ps -p "$pid" > /dev/null 2>&1; then
        log_error "进程仍存活，请手动处理：kill -9 $pid"
        return 1
    fi
    
    log_success "进程已强制终止"
    rm -f "$PID_FILE" "$LOCK_FILE"
    return 0
}

# 安静版本（用于 restart）
do_stop_quiet() {
    local pid
    if pid=$(check_pid_file); then
        kill "$pid" 2>/dev/null || true
        for i in {1..3}; do
            if ! ps -p "$pid" > /dev/null 2>&1; then
                break
            fi
            sleep 1
        done
        if ps -p "$pid" > /dev/null 2>&1; then
            kill -9 "$pid" 2>/dev/null || true
        fi
        rm -f "$PID_FILE" "$LOCK_FILE"
    fi
}

# =============================================================================
# 重启函数
# =============================================================================

do_restart() {
    log_info "重启小龙交易系统..."
    do_stop_quiet
    sleep 2
    do_start
}

# =============================================================================
# 状态函数
# =============================================================================

do_status() {
    echo "========================================"
    echo "🐉 小龙交易系统状态"
    echo "========================================"
    
    # 1. 进程状态
    local pid
    if pid=$(check_pid_file); then
        echo -e "进程状态：${GREEN}运行中${NC} (PID: $pid)"
        
        # 进程详情
        local uptime=$(ps -p "$pid" -o etime= 2>/dev/null | xargs)
        local cpu=$(ps -p "$pid" -o %cpu= 2>/dev/null | xargs)
        local mem=$(ps -p "$pid" -o %mem= 2>/dev/null | xargs)
        echo "  运行时长：$uptime"
        echo "  CPU: ${cpu}% | 内存：${mem}%"
    else
        echo -e "进程状态：${RED}未运行${NC}"
    fi
    
    # 2. 端口状态
    if check_port > /dev/null 2>&1; then
        local port_pid=$(check_port)
        echo -e "端口 $PORT: ${GREEN}监听中${NC} (PID: $port_pid)"
    else
        echo -e "端口 $PORT: ${YELLOW}未监听${NC}"
    fi
    
    # 3. 健康状态
    echo ""
    echo "健康检查:"
    if health_check; then
        local health_data
        health_data=$(get_health_status)
        
        # 使用 Python 统一解析（避免 jq 依赖）
        local status=$(python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','?'))" <<< "$health_data" 2>/dev/null || echo "?")
        local worker=$(python3 -c "import sys,json; d=json.load(sys.stdin); print('✅' if d.get('worker_alive') else '❌')" <<< "$health_data" 2>/dev/null || echo "?")
        local snapshot_age=$(python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"{d.get('snapshot_age_sec',0):.1f}s\")" <<< "$health_data" 2>/dev/null || echo "?")
        local equity=$(python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"{d.get('equity',0):.2f}\")" <<< "$health_data" 2>/dev/null || echo "?")
        local data_valid=$(python3 -c "import sys,json; d=json.load(sys.stdin); print('✅' if d.get('data_valid') else '❌')" <<< "$health_data" 2>/dev/null || echo "?")
        local okx_status=$(python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('dependency',{}).get('okx_api','?'))" <<< "$health_data" 2>/dev/null || echo "?")
        local file_status=$(python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('dependency',{}).get('file_fallback','?'))" <<< "$health_data" 2>/dev/null || echo "?")
        local last_error=$(python3 -c "import sys,json; d=json.load(sys.stdin); e=d.get('last_error'); print(e if e else '无')" <<< "$health_data" 2>/dev/null || echo "?")
        
        case "$status" in
            ok)
                echo -e "  状态：${GREEN}● 正常${NC}"
                ;;
            degraded)
                echo -e "  状态：${YELLOW}● 降级${NC}"
                ;;
            failed)
                echo -e "  状态：${RED}● 异常${NC}"
                ;;
            *)
                echo -e "  状态：${YELLOW}● 未知 ($status)${NC}"
                ;;
        esac
        
        echo "  Worker: $worker"
        echo "  快照新鲜度：$snapshot_age"
        echo "  账户权益：$equity USDT"
        echo "  数据有效：$data_valid"
        echo "  OKX API: $okx_status"
        echo "  文件回退：$file_status"
        
        if [ "$last_error" != "无" ] && [ -n "$last_error" ]; then
            echo -e "  最后错误：${RED}$last_error${NC}"
        fi
    else
        echo -e "  ${RED}无法连接 (服务未启动或健康端点异常)${NC}"
    fi
    
    # 4. 日志尾行
    echo ""
    echo "最近日志:"
    if [ -f "$LOG_FILE" ]; then
        tail -5 "$LOG_FILE" | sed 's/^/  /'
    else
        echo "  日志文件不存在"
    fi
    
    echo "========================================"
}

# =============================================================================
# 日志函数
# =============================================================================

do_logs() {
    if [ -f "$LOG_FILE" ]; then
        tail -f "$LOG_FILE"
    else
        log_error "日志文件不存在：$LOG_FILE"
        exit 1
    fi
}

# =============================================================================
# 主入口
# =============================================================================

case "${1:-}" in
    start)
        do_start
        ;;
    stop)
        do_stop
        ;;
    restart)
        do_restart
        ;;
    status)
        do_status
        ;;
    logs)
        do_logs
        ;;
    *)
        echo "🐉 小龙交易系统 - 统一进程管理 (macOS/Linux)"
        echo ""
        echo "用法：$0 {start|stop|restart|status|logs}"
        echo ""
        echo "命令说明:"
        echo "  start   - 启动服务（带单实例锁 + 端口检查 + 健康验证）"
        echo "  stop    - 停止服务（SIGTERM 优先，SIGKILL 兜底）"
        echo "  restart - 重启服务"
        echo "  status  - 查看状态（进程 + 端口 + 健康检查）"
        echo "  logs    - 查看实时日志"
        echo ""
        echo "macOS 兼容:"
        echo "  - 无 lsof 时使用 netstat 检测端口"
        echo "  - 无 jq 时使用 Python 解析 JSON"
        echo ""
        echo "示例:"
        echo "  $0 start    # 启动服务"
        echo "  $0 status   # 查看状态"
        echo "  $0 logs     # 跟踪日志"
        exit 1
        ;;
esac
