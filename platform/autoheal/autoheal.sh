#!/bin/bash
# Auto-Heal 值班助手 v2.0
# 从"体检"升级为"分级响应系统"

# 不使用 set -e，让脚本在检查失败时继续运行
# set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$SCRIPT_DIR/config.json"
LOG_DIR="$SCRIPT_DIR/logs"
ARCHIVE_DIR="$SCRIPT_DIR/archives"
DATA_DIR="$SCRIPT_DIR/data"

# 确保目录存在
mkdir -p "$LOG_DIR" "$ARCHIVE_DIR" "$DATA_DIR"

# 加载配置
if [[ -f "$CONFIG_FILE" ]]; then
    CRITICAL_EXIT=$(grep -o '"exit_code": [0-9]*' "$CONFIG_FILE" | head -1 | grep -o '[0-9]*')
    WARNING_EXIT=$(grep -o '"exit_code": [0-9]*' "$CONFIG_FILE" | sed -n '2p' | grep -o '[0-9]*')
else
    CRITICAL_EXIT=20
    WARNING_EXIT=10
fi

# 时间戳
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE_STR=$(date +%Y-%m-%d)
LOG_FILE="$LOG_DIR/health_$TIMESTAMP.log"
JSON_FILE="$DATA_DIR/health_$DATE_STR.json"

# 初始化结果
FINAL_EXIT=0
CRITICAL_COUNT=0
WARNING_COUNT=0
INFO_COUNT=0
HEALTH_OK_AFTER=false
REPAIR_ACTIONS=()
ALERTS=()
TELEGRAM_LATENCY=0

# 颜色输出
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_section() {
    echo -e "\n=== $1 ===" | tee -a "$LOG_FILE"
}

# ============ 核心检查函数 ============

check_gateway() {
    log_section "检查 Gateway 状态"
    
    # 使用 ps 检查，更可靠
    if ps aux | grep -v grep | grep -q "openclaw-gateway"; then
        log "${GREEN}✅ Gateway 运行正常${NC}"
        return 0
    fi
    
    # 检查 Gateway API
    local gateway_status
    gateway_status=$(openclaw gateway status 2>&1) || true
    
    if echo "$gateway_status" | grep -q "running\|active"; then
        log "${GREEN}✅ Gateway 运行正常${NC}"
        return 0
    else
        ALERTS+=("Gateway 状态异常")
        WARNING_COUNT=$((WARNING_COUNT + 1))
        log "${YELLOW}⚠️ Gateway 状态异常${NC}"
        return 1
    fi
}

check_ocnmps() {
    log_section "检查 OCNMPS 状态"
    
    local ocnmps_status
    ocnmps_status=$(openclaw status 2>&1) || true
    
    if echo "$ocnmps_status" | grep -q "running\|online"; then
        log "${GREEN}✅ OCNMPS 运行正常${NC}"
        return 0
    else
        ALERTS+=("OCNMPS 状态异常")
        WARNING_COUNT=$((WARNING_COUNT + 1))
        log "${YELLOW}⚠️ OCNMPS 状态异常${NC}"
        return 1
    fi
}

check_telegram() {
    log_section "检查 Telegram 通道"
    
    local start_time end_time latency
    start_time=$(date +%s%N)
    
    # 简单的连通性测试
    if curl -s --max-time 5 https://api.telegram.org > /dev/null 2>&1; then
        end_time=$(date +%s%N)
        TELEGRAM_LATENCY=$(( (end_time - start_time) / 1000000 ))
        log "${GREEN}✅ Telegram API 可达 (延迟: ${TELEGRAM_LATENCY}ms)${NC}"
        
        # 检查延迟基线
        if [[ $TELEGRAM_LATENCY -gt 2000 ]]; then
            ALERTS+=("Telegram 延迟过高: ${TELEGRAM_LATENCY}ms")
            WARNING_COUNT=$((WARNING_COUNT + 1))
        fi
        return 0
    else
        TELEGRAM_LATENCY=-1
        ALERTS+=("Telegram API 不可达")
        WARNING_COUNT=$((WARNING_COUNT + 1))
        log "${YELLOW}⚠️ Telegram API 不可达${NC}"
        return 1
    fi
}

check_models() {
    log_section "检查模型可用性"
    
    local models_status
    models_status=$(openclaw models 2>&1) || true
    
    # 检查关键模型
    local required_models=("bailian/kimi-k2.5")
    local unavailable_models=()
    
    for model in "${required_models[@]}"; do
        if ! echo "$models_status" | grep -q "$model"; then
            unavailable_models+=("$model")
        fi
    done
    
    if [[ ${#unavailable_models[@]} -eq 0 ]]; then
        log "${GREEN}✅ 关键模型可用${NC}"
        return 0
    else
        ALERTS+=("模型不可用: ${unavailable_models[*]}")
        WARNING_COUNT=$((WARNING_COUNT + 1))
        log "${YELLOW}⚠️ 模型不可用: ${unavailable_models[*]}${NC}"
        return 1
    fi
}

check_sessions() {
    log_section "检查活跃会话"
    
    local sessions
    sessions=$(openclaw sessions list 2>&1 | wc -l)
    
    log "活跃会话数: $sessions"
    
    if [[ $sessions -gt 5 ]]; then
        ALERTS+=("活跃会话数异常: $sessions")
        INFO_COUNT=$((INFO_COUNT + 1))
    fi
    
    return 0
}

check_disk_space() {
    log_section "检查磁盘空间"
    
    local usage
    usage=$(df -h "$WORKSPACE_DIR" | awk 'NR==2 {print $5}' | sed 's/%//')
    
    log "磁盘使用率: ${usage}%"
    
    if [[ $usage -gt 90 ]]; then
        ALERTS+=("磁盘空间不足: ${usage}%")
        CRITICAL_COUNT=$((CRITICAL_COUNT + 1))
        log "${RED}❌ 磁盘空间严重不足${NC}"
    elif [[ $usage -gt 80 ]]; then
        ALERTS+=("磁盘空间警告: ${usage}%")
        WARNING_COUNT=$((WARNING_COUNT + 1))
        log "${YELLOW}⚠️ 磁盘空间不足${NC}"
    else
        log "${GREEN}✅ 磁盘空间充足${NC}"
    fi
}

# ============ 修复动作 ============

auto_repair() {
    log_section "自动修复"
    
    # 检查是否需要修复
    if [[ $CRITICAL_COUNT -eq 0 && $WARNING_COUNT -eq 0 ]]; then
        log "无需修复"
        return 0
    fi
    
    # 获取维护模式
    local maintenance_mode="normal"
    if [[ -f "$CONFIG_FILE" ]]; then
        maintenance_mode=$(grep -o '"maintenance_mode": "[^"]*"' "$CONFIG_FILE" | cut -d'"' -f4)
    fi
    
    if [[ "$maintenance_mode" == "maintenance" ]]; then
        log "维护模式：跳过自动修复"
        return 0
    fi
    
    # 尝试修复
    log "尝试自动修复..."
    
    # 1. 运行 doctor --repair
    if openclaw doctor --repair --yes 2>&1 | tee -a "$LOG_FILE"; then
        REPAIR_ACTIONS+=("doctor_repair")
        log "${GREEN}✅ Doctor 修复完成${NC}"
    fi
    
    # 2. 重新检查健康状态
    sleep 2
    if openclaw health check 2>&1 | tee -a "$LOG_FILE"; then
        HEALTH_OK_AFTER=true
        log "${GREEN}✅ 健康检查通过${NC}"
    else
        HEALTH_OK_AFTER=false
        log "${YELLOW}⚠️ 健康检查未通过${NC}"
        
        # 3. 如果还是失败，尝试重启 Gateway
        if [[ $CRITICAL_COUNT -gt 0 ]]; then
            log "尝试重启 Gateway..."
            openclaw gateway restart 2>&1 | tee -a "$LOG_FILE" || true
            REPAIR_ACTIONS+=("gateway_restart")
            sleep 3
            
            # 再次检查
            if openclaw health check 2>&1 | tee -a "$LOG_FILE"; then
                HEALTH_OK_AFTER=true
                log "${GREEN}✅ Gateway 重启后健康检查通过${NC}"
            fi
        fi
    fi
}

# ============ 分级响应 ============

determine_exit_code() {
    if [[ $CRITICAL_COUNT -gt 0 ]]; then
        FINAL_EXIT=$CRITICAL_EXIT
    elif [[ $WARNING_COUNT -gt 0 ]]; then
        FINAL_EXIT=$WARNING_EXIT
    else
        FINAL_EXIT=0
    fi
    
    # 如果没有执行修复且检查通过，health_ok_after 应为 true
    if [[ ${#REPAIR_ACTIONS[@]} -eq 0 && $FINAL_EXIT -eq 0 ]]; then
        HEALTH_OK_AFTER=true
    fi
}

archive_logs() {
    if [[ $CRITICAL_COUNT -gt 0 ]]; then
        log_section "打包日志"
        
        local archive_name="critical_$TIMESTAMP"
        local archive_path="$ARCHIVE_DIR/$archive_name"
        
        mkdir -p "$archive_path"
        
        # 复制最近3份日志
        find "$LOG_DIR" -name "*.log" -type f -mtime -1 | sort -r | head -3 | while read -r f; do
            cp "$f" "$archive_path/"
        done
        
        # 复制当前日志
        cp "$LOG_FILE" "$archive_path/"
        
        # 复制状态文件
        openclaw status > "$archive_path/status.txt" 2>&1 || true
        openclaw doctor > "$archive_path/doctor.txt" 2>&1 || true
        openclaw health check > "$archive_path/health.txt" 2>&1 || true
        
        # 创建摘要
        cat > "$archive_path/SUMMARY.txt" << EOF
关键事件摘要
============
时间: $(date)
Critical: $CRITICAL_COUNT
Warning: $WARNING_COUNT
修复动作: ${REPAIR_ACTIONS[*]:-无}
健康恢复: $HEALTH_OK_AFTER

告警列表:
$(printf '%s\n' "${ALERTS[@]}")
EOF
        
        log "${GREEN}✅ 日志已打包: $archive_path${NC}"
    fi
}

# ============ 通知系统 ============

send_notification() {
    local level="$1"
    local message="$2"
    
    # macOS 通知
    if command -v osascript > /dev/null; then
        local title="OpenClaw Auto-Heal"
        local subtitle=""
        local sound="default"
        
        case "$level" in
            "critical")
                subtitle="🔴 关键异常"
                sound="Basso"
                ;;
            "warning")
                subtitle="🟡 需要关注"
                sound="Tink"
                ;;
            *)
                subtitle="✅ 系统正常"
                sound="Glass"
                ;;
        esac
        
        osascript -e "display notification \"$message\" with title \"$title\" subtitle \"$subtitle\" sound name \"$sound\"" 2>/dev/null || true
    fi
    
    # Telegram 通知 (通过 openclaw message)
    if command -v openclaw > /dev/null; then
        local emoji=""
        case "$level" in
            "critical") emoji="🔴" ;;
            "warning") emoji="🟡" ;;
            *) emoji="🟢" ;;
        esac
        
        # 发送到 Telegram (如果配置了)
        openclaw message send --channel telegram --message "$emoji Auto-Heal: $message" 2>/dev/null || true
    fi
}

# ============ 趋势分析 ============

analyze_trends() {
    log_section "趋势分析 (最近7天)"
    
    local trend_data="$DATA_DIR/trends.json"
    local today=$(date +%Y-%m-%d)
    
    # 读取历史数据
    local history=()
    for i in {0..6}; do
        local date_str=$(date -v-${i}d +%Y-%m-%d 2>/dev/null || date -d "-$i days" +%Y-%m-%d)
        local file="$DATA_DIR/health_$date_str.json"
        if [[ -f "$file" ]]; then
            history+=("$file")
        fi
    done
    
    # 分析趋势
    local warning_trend=0
    local critical_trend=0
    local repair_trend=0
    
    for file in "${history[@]}"; do
        if [[ -f "$file" ]]; then
            local w=$(grep -o '"warning_count":[0-9]*' "$file" | grep -o '[0-9]*')
            local c=$(grep -o '"critical_count":[0-9]*' "$file" | grep -o '[0-9]*')
            local r=$(grep -o '"repair_actions":\[[^]]*\]' "$file" | tr ',' '\n' | wc -l)
            
            warning_trend=$((warning_trend + ${w:-0}))
            critical_trend=$((critical_trend + ${c:-0}))
            repair_trend=$((repair_trend + ${r:-0}))
        fi
    done
    
    log "7天统计 - Warning: $warning_trend, Critical: $critical_trend, Repairs: $repair_trend"
    
    # 检测趋势异常
    if [[ $warning_trend -gt 10 ]]; then
        ALERTS+=("Warning 趋势上升: 7天内 $warning_trend 次")
    fi
    
    if [[ $repair_trend -gt 5 ]]; then
        ALERTS+=("自动修复频繁: 7天内 $repair_trend 次")
    fi
}

# ============ 基线偏移检测 ============

check_baseline_drift() {
    log_section "基线偏移检测"
    
    local drift_detected=false
    local drift_reasons=()
    
    # 检查 critical_count
    if [[ $CRITICAL_COUNT -gt 0 ]]; then
        drift_detected=true
        drift_reasons+=("critical_count=$CRITICAL_COUNT (基线: 0)")
    fi
    
    # 检查 health_ok_after
    if [[ "$HEALTH_OK_AFTER" == "false" && $CRITICAL_COUNT -gt 0 ]]; then
        drift_detected=true
        drift_reasons+=("health_ok_after=false")
    fi
    
    # 检查 Telegram 延迟
    if [[ $TELEGRAM_LATENCY -gt 2000 ]]; then
        drift_detected=true
        drift_reasons+=("telegram_latency=${TELEGRAM_LATENCY}ms (基线: <2000ms)")
    fi
    
    # 检查修复次数
    if [[ ${#REPAIR_ACTIONS[@]} -gt 0 ]]; then
        drift_detected=true
        drift_reasons+=("repair_actions=${#REPAIR_ACTIONS[@]} (基线: 0)")
    fi
    
    if [[ "$drift_detected" == "true" ]]; then
        log "${YELLOW}⚠️ 基线偏移 detected:${NC}"
        for reason in "${drift_reasons[@]}"; do
            log "  - $reason"
        done
        ALERTS+=("基线偏移: ${drift_reasons[*]}")
    else
        log "${GREEN}✅ 基线正常${NC}"
    fi
}

# ============ 生成每日简报 ============

generate_daily_digest() {
    log_section "生成每日简报"
    
    local digest_file="$DATA_DIR/digest_$DATE_STR.md"
    local health_status="✅ 健康"
    local status_emoji="🟢"
    
    if [[ $CRITICAL_COUNT -gt 0 ]]; then
        health_status="🔴 关键异常"
        status_emoji="🔴"
    elif [[ $WARNING_COUNT -gt 0 ]]; then
        health_status="🟡 需要关注"
        status_emoji="🟡"
    fi
    
    cat > "$digest_file" << EOF
# OpenClaw 每日简报 - $DATE_STR

## 系统健康
- 状态: $health_status
- Critical: $CRITICAL_COUNT
- Warning: $WARNING_COUNT
- Info: $INFO_COUNT

## 组件状态
- Gateway: $(pgrep -f "openclaw-gateway" > /dev/null && echo "✅ 运行中" || echo "❌ 未运行")
- Telegram: $(curl -s --max-time 2 https://api.telegram.org > /dev/null && echo "✅ 正常" || echo "❌ 异常")
- Telegram 延迟: ${TELEGRAM_LATENCY}ms

## 告警列表
$(if [[ ${#ALERTS[@]} -eq 0 ]]; then echo "无"; else printf '- %s\n' "${ALERTS[@]}"; fi)

## 修复动作
$(if [[ ${#REPAIR_ACTIONS[@]} -eq 0 ]]; then echo "无"; else printf '- %s\n' "${REPAIR_ACTIONS[@]}"; fi)

## 健康恢复
- 修复后状态: $HEALTH_OK_AFTER

## 人工 Review 项
$(if [[ $CRITICAL_COUNT -gt 0 ]]; then echo "⚠️ 有 $CRITICAL_COUNT 个关键异常需要人工检查"; else echo "无需人工干预"; fi)

---
生成时间: $(date)
EOF
    
    log "${GREEN}✅ 每日简报已生成: $digest_file${NC}"
    
    # 发送到 Telegram
    if [[ -f "$digest_file" ]]; then
        local summary="$status_emoji OpenClaw 晨报\nGateway: $(pgrep -f "openclaw-gateway" > /dev/null && echo '✅' || echo '❌')\nOCNMPS: $(openclaw status 2>&1 | grep -q running && echo '✅' || echo '❌')\nHealth: $health_status\nWarn: $WARNING_COUNT | Critical: $CRITICAL_COUNT\nTelegram: ${TELEGRAM_LATENCY}ms"
        
        openclaw message send --channel telegram --message "$summary" 2>/dev/null || true
    fi
}

# ============ 保存 JSON 数据 ============

save_json() {
    local gateway_up="false"
    if ps aux | grep -v grep | grep -q "openclaw-gateway"; then
        gateway_up="true"
    fi
    
    cat > "$JSON_FILE" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "date": "$DATE_STR",
  "exit_code": $FINAL_EXIT,
  "critical_count": $CRITICAL_COUNT,
  "warning_count": $WARNING_COUNT,
  "info_count": $INFO_COUNT,
  "health_ok_after": $HEALTH_OK_AFTER,
  "telegram_latency_ms": $TELEGRAM_LATENCY,
  "alerts": [$(printf '"%s",' "${ALERTS[@]}" | sed 's/,$//')],
  "repair_actions": [$(printf '"%s",' "${REPAIR_ACTIONS[@]}" | sed 's/,$//')],
  "gateway_running": $gateway_up,
  "log_file": "$LOG_FILE"
}
EOF
}

# ============ 主程序 ============

main() {
    log_section "Auto-Heal 值班助手 v2.0"
    log "开始检查: $(date)"
    
    # 执行检查
    check_gateway
    check_ocnmps
    check_telegram
    check_models
    check_sessions
    check_disk_space
    
    # 趋势分析
    analyze_trends
    
    # 基线检测
    check_baseline_drift
    
    # 自动修复
    auto_repair
    
    # 确定退出码
    determine_exit_code
    
    # 打包日志 (如果有 critical)
    archive_logs
    
    # 发送通知
    if [[ $FINAL_EXIT -eq 0 ]]; then
        send_notification "info" "系统健康检查完成，一切正常"
    elif [[ $FINAL_EXIT -eq $WARNING_EXIT ]]; then
        send_notification "warning" "发现 $WARNING_COUNT 个警告，请查看日志"
    else
        send_notification "critical" "发现 $CRITICAL_COUNT 个关键异常，已尝试自动修复"
    fi
    
    # 生成每日简报
    generate_daily_digest
    
    # 保存数据
    save_json
    
    # 输出摘要
    log_section "检查完成"
    log "Exit Code: $FINAL_EXIT"
    log "Critical: $CRITICAL_COUNT, Warning: $WARNING_COUNT, Info: $INFO_COUNT"
    log "Health OK After Repair: $HEALTH_OK_AFTER"
    log "Log: $LOG_FILE"
    
    exit $FINAL_EXIT
}

# 处理参数
case "${1:-}" in
    --digest)
        # 只生成简报
        generate_daily_digest
        ;;
    --trends)
        # 只分析趋势
        analyze_trends
        ;;
    --repair)
        # 只执行修复
        auto_repair
        ;;
    --maintenance)
        # 切换维护模式
        if [[ "$2" == "on" ]]; then
            sed -i '' 's/"maintenance_mode": "[^"]*"/"maintenance_mode": "maintenance"/' "$CONFIG_FILE" 2>/dev/null || \
            sed -i 's/"maintenance_mode": "[^"]*"/"maintenance_mode": "maintenance"/' "$CONFIG_FILE"
            log "维护模式已开启"
        elif [[ "$2" == "off" ]]; then
            sed -i '' 's/"maintenance_mode": "[^"]*"/"maintenance_mode": "normal"/' "$CONFIG_FILE" 2>/dev/null || \
            sed -i 's/"maintenance_mode": "[^"]*"/"maintenance_mode": "normal"/' "$CONFIG_FILE"
            log "维护模式已关闭"
        fi
        ;;
    *)
        main
        ;;
esac