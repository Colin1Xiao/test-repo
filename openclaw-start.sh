#!/bin/bash
# OpenClaw Gateway 启动 Wrapper（生产级）
# 功能：启动前检查 → 启动执行 → 启动验证 → 自动重试 → 结构化输出

set -e

# 配置
MAX_RETRIES=3
RETRY_DELAY=2
VERIFY_TIMEOUT=5
HEALTH_SCRIPT="${HOME}/.openclaw/workspace/scripts/openclaw-health-check.sh"
STATUS_FILE="${HOME}/.openclaw/workspace/openclaw-health-check.json"
LOG_FILE="${HOME}/.openclaw/workspace/logs/openclaw-start.log"

# 确保日志目录存在
mkdir -p "$(dirname "$LOG_FILE")"

# 日志函数
log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $level: $message" | tee -a "$LOG_FILE"
}

# 输出结构化 JSON
output_json() {
    local status=$1
    local message=$2
    local details=$3
    
    cat << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "status": "$status",
  "message": "$message",
  "details": $details
}
EOF
}

# 检查 Gateway 是否已在运行
check_already_running() {
    log "INFO" "检查 Gateway 是否已在运行..."
    
    if nc -z 127.0.0.1 18789 2>/dev/null; then
        log "INFO" "Gateway 已在端口 18789 上运行"
        return 0
    fi
    
    # 额外检查进程
    if pgrep -f "openclaw gateway" > /dev/null 2>&1; then
        log "WARN" "发现 Gateway 进程，但端口未响应"
        return 1
    fi
    
    return 1
}

# 执行启动前检查
pre_check() {
    log "INFO" "========================================"
    log "INFO" "OpenClaw 启动流程开始"
    log "INFO" "========================================"
    log "INFO" ""
    
    # 1. 防止重复启动
    if check_already_running; then
        log "INFO" "Gateway 已在运行，跳过启动"
        output_json "skipped" "Gateway already running" '{"running": true}'
        exit 0
    fi
    
    # 2. 执行健康检查
    log "INFO" "[Pre-check] 执行启动前健康检查..."
    if bash "$HEALTH_SCRIPT" >> "$LOG_FILE" 2>&1; then
        log "INFO" "健康检查完成"
    else
        log "WARN" "健康检查脚本执行失败，继续启动..."
    fi
    
    # 3. 输出当前状态
    if [ -f "$STATUS_FILE" ]; then
        log "INFO" "当前系统状态："
        local overall_status=$(cat "$STATUS_FILE" | grep -o '"status": "[^"]*"' | head -1 | cut -d'"' -f4)
        log "INFO" "  - 整体状态: $overall_status"
    else
        log "WARN" "状态文件不存在，继续启动..."
    fi
    
    log "INFO" ""
}

# 启动 Gateway
do_start() {
    local attempt=$1
    
    log "INFO" "▶️ 尝试启动 Gateway (第 $attempt 次)..."
    
    # 使用子 shell 避免 set -e 中断
    (
        openclaw gateway start >> "$LOG_FILE" 2>&1 &
        echo $!
    )
}

# 验证启动结果
verify_start() {
    log "INFO" "⏳ 验证启动状态 (最多等待 ${VERIFY_TIMEOUT} 秒)..."
    
    local verified=false
    local elapsed=0
    
    while [ $elapsed -lt $VERIFY_TIMEOUT ]; do
        # 刷新健康检查
        bash "$HEALTH_SCRIPT" > /dev/null 2>&1 || true
        
        # 检查状态文件
        if [ -f "$STATUS_FILE" ]; then
            local gateway_status=$(cat "$STATUS_FILE" | grep -o '"gateway":{[^}]*}' | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
            
            if [ "$gateway_status" = "running" ]; then
                log "INFO" "✅ Gateway 启动成功验证通过"
                verified=true
                break
            fi
        fi
        
        # 直接检查端口
        if nc -z 127.0.0.1 18789 2>/dev/null; then
            log "INFO" "✅ 端口 18789 已响应"
            verified=true
            break
        fi
        
        sleep 1
        elapsed=$((elapsed + 1))
        log "INFO" "  等待验证... ($elapsed/${VERIFY_TIMEOUT})"
    done
    
    if [ "$verified" = true ]; then
        return 0
    else
        return 1
    fi
}

# 获取诊断信息
get_diagnostics() {
    local diagnostics="{"
    
    # 端口占用检查
    local port_usage=$(lsof -i :18789 2>/dev/null | tail -n +2 | head -5 | awk '{print $1","$2}' | tr '\n' ';' || echo "none")
    diagnostics="\"port_18789_usage\": \"$port_usage\","
    
    # 进程检查
    local processes=$(pgrep -f "openclaw gateway" | tr '\n' ',' || echo "none")
    diagnostics="${diagnostics} \"gateway_processes\": \"$processes\","
    
    # 配置文件检查
    if [ -f "${HOME}/.openclaw/openclaw.json" ]; then
        diagnostics="${diagnostics} \"config_exists\": true,"
    else
        diagnostics="${diagnostics} \"config_exists\": false,"
    fi
    
    # 最后日志
    local last_log=$(tail -n 5 "$LOG_FILE" 2>/dev/null | sed 's/"/\\"/g' | tr '\n' ' ' | head -c 500 || echo "none")
    diagnostics="${diagnostics} \"last_log\": \"$last_log\""
    
    diagnostics="$diagnostics}"
    echo "$diagnostics"
}

# 主启动流程
main() {
    # 启动前检查
    pre_check
    
    # 启动 + 重试
    local attempt=1
    local success=false
    local pid=""
    
    while [ $attempt -le $MAX_RETRIES ]; do
        # 启动 Gateway
        log "INFO" "启动 Gateway..."
        
        # 尝试启动
        if openclaw gateway start >> "$LOG_FILE" 2>&1; then
            log "INFO" "Gateway 启动命令已执行"
        else
            log "WARN" "启动命令返回非零退出码"
        fi
        
        # 等待一小会儿让进程启动
        sleep 1
        
        # 验证启动
        if verify_start; then
            success=true
            break
        fi
        
        # 检查是否需要重试
        if [ $attempt -lt $MAX_RETRIES ]; then
            log "WARN" "启动验证失败，准备第 $((attempt + 1)) 次重试..."
            log "INFO" "等待 ${RETRY_DELAY} 秒后重试..."
            sleep $RETRY_DELAY
        fi
        
        attempt=$((attempt + 1))
    done
    
    # 最终结果
    log "INFO" ""
    log "INFO" "========================================"
    
    if [ "$success" = true ]; then
        log "INFO" "🎉 OpenClaw Gateway 启动成功"
        log "INFO" "========================================"
        log "INFO" ""
        log "INFO" "服务状态："
        
        # 输出最终状态
        if [ -f "$STATUS_FILE" ]; then
            local overall_status=$(cat "$STATUS_FILE" | grep -o '"status": "[^"]*"' | head -1 | cut -d'"' -f4)
            local overall_emoji=$(cat "$STATUS_FILE" | grep -o '"emoji": "[^"]*"' | head -1 | cut -d'"' -f4)
            log "INFO" "  - 系统健康度: $overall_emoji $overall_status"
        fi
        
        log "INFO" "  - 端口: 127.0.0.1:18789"
        log "INFO" "  - 日志: $LOG_FILE"
        log "INFO" ""
        
        # 输出结构化成功信息
        output_json "success" "Gateway started successfully" '{"port": 18789, "retries": '"$attempt"'}'
        exit 0
        
    else
        log "ERROR" "❌ OpenClaw Gateway 启动失败"
        log "ERROR" "========================================"
        log "ERROR" ""
        log "ERROR" "已重试 $MAX_RETRIES 次，启动仍然失败"
        log "ERROR" ""
        
        # 获取诊断信息
        log "INFO" "📋 诊断信息："
        local diagnostics=$(get_diagnostics)
        
        # 输出端口占用
        local port_usage=$(echo "$diagnostics" | grep -o '"port_18789_usage": "[^"]*"' | cut -d'"' -f4)
        if [ "$port_usage" != "none" ] && [ -n "$port_usage" ]; then
            log "ERROR" "  - 端口 18789 被占用: $port_usage"
        else
            log "INFO" "  - 端口 18789 未被占用"
        fi
        
        # 输出进程信息
        local processes=$(echo "$diagnostics" | grep -o '"gateway_processes": "[^"]*"' | cut -d'"' -f4)
        if [ "$processes" != "none" ] && [ -n "$processes" ]; then
            log "WARN" "  - 发现 Gateway 进程: $processes"
        else
            log "INFO" "  - 未发现 Gateway 进程"
        fi
        
        # 输出配置检查
        local config_exists=$(echo "$diagnostics" | grep -o '"config_exists": [a-z]*' | cut -d' ' -f2)
        if [ "$config_exists" = "true" ]; then
            log "INFO" "  - 配置文件存在"
        else
            log "ERROR" "  - 配置文件不存在"
        fi
        
        log "ERROR" ""
        log "INFO" "🛠 建议修复操作："
        log "INFO" "  1. 检查端口占用: lsof -i :18789"
        log "INFO" "  2. 查看 Gateway 日志: openclaw gateway logs --tail 50"
        log "INFO" "  3. 手动启动调试: openclaw gateway start --verbose"
        log "INFO" "  4. 重置配置: openclaw configure"
        log "INFO" ""
        log "INFO" "运行自愈诊断: ~/.openclaw/workspace/scripts/self-heal-advisor.sh"
        log "INFO" ""
        
        # 输出结构化失败信息
        output_json "failed" "Gateway failed to start after $MAX_RETRIES attempts" "$diagnostics"
        exit 1
    fi
}

# 信号处理
cleanup() {
    log "INFO" "接收到中断信号，清理中..."
    exit 130
}
trap cleanup INT TERM

# 主入口
main "$@"
