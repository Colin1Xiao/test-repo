#!/bin/bash
# OpenClaw 智能恢复控制器 V3.0
# 功能：异常识别 → 策略选择 → 执行 → 学习反馈

set -e

# 文件路径
STATUS_FILE="${HOME}/.openclaw/workspace/openclaw-health-check.json"
STRATEGIES_FILE="${HOME}/.openclaw/workspace/recovery-strategies.json"
HISTORY_FILE="${HOME}/.openclaw/workspace/recovery-history.json"
LOG_FILE="${HOME}/.openclaw/workspace/logs/recovery-controller-v3.log"

# 配置
COOLDOWN=300
MAX_ATTEMPTS=3
VERIFY_TIMEOUT=10

mkdir -p "$(dirname "$LOG_FILE")"

# 日志函数
log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

# JSON 读取
json_get() {
    local file=$1
    local path=$2
    node -e "const data = require('fs').readFileSync('$file', 'utf8'); const json = JSON.parse(data); const val = $path; console.log(val !== undefined && val !== null ? val : '');" 2>/dev/null || echo ""
}

# 识别事件类型
identify_event() {
    local gateway_status=$(json_get "$STATUS_FILE" "json.components.gateway.status")
    local gateway_severity=$(json_get "$STATUS_FILE" "json.components.gateway.severity")
    local telegram_status=$(json_get "$STATUS_FILE" "json.components.telegram.status")
    local memory_status=$(json_get "$STATUS_FILE" "json.components.memorySearch.status")
    
    # 检查端口占用
    local port_conflict=false
    if lsof -i :18789 2>/dev/null | grep -v "openclaw" | grep -q "LISTEN"; then
        port_conflict=true
    fi
    
    # 事件识别逻辑
    if [ "$gateway_status" = "stopped" ] || [ "$gateway_severity" -ge 2 ]; then
        if [ "$port_conflict" = true ]; then
            echo "gateway_port_conflict"
        else
            echo "gateway_stopped"
        fi
        return
    fi
    
    if [ "$telegram_status" = "disconnected" ] || [ "$telegram_status" = "error" ]; then
        echo "telegram_disconnected"
        return
    fi
    
    if [ "$memory_status" = "model_missing" ]; then
        echo "memory_model_missing"
        return
    fi
    
    echo "unknown"
}

# 选择最优策略
select_strategy() {
    local event=$1
    
    log "INFO" "选择策略 for event: $event"
    
    # 获取所有可用策略
    local strategies=$(json_get "$STRATEGIES_FILE" "json.strategies.$event.actions")
    
    if [ -z "$strategies" ] || [ "$strategies" = "undefined" ]; then
        log "WARN" "未找到策略 for $event"
        echo ""
        return
    fi
    
    # 简化版：返回第一个策略
    local best_strategy=$(json_get "$STRATEGIES_FILE" "json.strategies.$event.actions[0].id")
    
    log "INFO" "选择策略: $best_strategy"
    echo "$best_strategy"
}

# 执行策略
execute_strategy() {
    local event=$1
    local strategy_id=$2
    
    log "INFO" "执行策略: $strategy_id"
    
    # 获取策略脚本
    local script=$(json_get "$STRATEGIES_FILE" "json.strategies.$event.actions.find(a => a.id === '$strategy_id').script")
    
    # 执行前时间
    local start_time=$(date +%s)
    
    # 执行脚本
    local result=0
    if [ -f "$script" ]; then
        log "INFO" "执行: $script"
        if bash "$script" >> "$LOG_FILE" 2>&1; then
            log "INFO" "脚本执行完成"
        else
            result=$?
            log "WARN" "脚本返回非零: $result"
        fi
    else
        log "WARN" "脚本不存在: $script"
        result=1
    fi
    
    # 等待验证
    log "INFO" "等待验证 (${VERIFY_TIMEOUT} 秒)..."
    sleep $VERIFY_TIMEOUT
    
    # 刷新健康检查
    bash "${HOME}/.openclaw/workspace/scripts/openclaw-health-check.sh" > /dev/null 2>&1 || true
    
    # 验证结果
    local new_event=$(identify_event)
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    if [ "$new_event" = "unknown" ] || [ "$new_event" != "$event" ]; then
        log "INFO" "✅ 策略执行成功，事件已解决"
        update_history "$event" "$strategy_id" "success" "$duration"
        return 0
    else
        log "ERROR" "❌ 策略执行失败，事件仍存在"
        update_history "$event" "$strategy_id" "failed" "$duration"
        return 1
    fi
}

# 更新历史记录
update_history() {
    local event=$1
    local strategy=$2
    local result=$3
    local duration=$4
    
    log "INFO" "更新历史: event=$event, strategy=$strategy, result=$result, duration=${duration}s"
    
    # 使用 node 更新 JSON
    node << EOF
const fs = require('fs');
const historyFile = '$HISTORY_FILE';
const data = JSON.parse(fs.readFileSync(historyFile, 'utf8'));

// 添加事件记录
data.events.push({
    timestamp: '$(date -u +"%Y-%m-%dT%H:%M:%SZ")',
    event: '$event',
    strategy: '$strategy',
    result: '$result',
    duration: $duration
});

// 更新统计
const stats = data.statistics['$event'];
stats.totalAttempts = (stats.totalAttempts || 0) + 1;
if ('$result' === 'success') {
    stats.successCount = (stats.successCount || 0) + 1;
} else {
    stats.failureCount = (stats.failureCount || 0) + 1;
}
stats.successRate = Math.round((stats.successCount / stats.totalAttempts) * 100);

// 更新策略统计
if (!stats.strategyStats['$strategy']) {
    stats.strategyStats['$strategy'] = { attempts: 0, success: 0, failed: 0 };
}
stats.strategyStats['$strategy'].attempts++;
if ('$result' === 'success') {
    stats.strategyStats['$strategy'].success++;
} else {
    stats.strategyStats['$strategy'].failed++;
}

// 更新最优策略
let bestStrategy = null;
let bestRate = -1;
for (const [sid, sstats] of Object.entries(stats.strategyStats)) {
    const rate = sstats.success / sstats.attempts;
    if (rate > bestRate && sstats.attempts >= 2) {
        bestRate = rate;
        bestStrategy = sid;
    }
}
stats.bestStrategy = bestStrategy;

data.lastUpdated = '$(date -u +"%Y-%m-%dT%H:%M:%SZ")';
fs.writeFileSync(historyFile, JSON.stringify(data, null, 2));
EOF
}

# 输出统计报告
output_stats() {
    log "INFO" ""
    log "INFO" "========================================"
    log "INFO" "智能恢复统计报告"
    log "INFO" "========================================"
    
    local events="gateway_stopped gateway_port_conflict telegram_disconnected memory_model_missing"
    
    for event in $events; do
        local total=$(json_get "$HISTORY_FILE" "json.statistics.$event.totalAttempts" || echo "0")
        local success=$(json_get "$HISTORY_FILE" "json.statistics.$event.successCount" || echo "0")
        local rate=$(json_get "$HISTORY_FILE" "json.statistics.$event.successRate" || echo "0")
        local best=$(json_get "$HISTORY_FILE" "json.statistics.$event.bestStrategy" || echo "无")
        
        if [ "$total" -gt 0 ]; then
            log "INFO" ""
            log "INFO" "$event:"
            log "INFO" "  - 总尝试: $total"
            log "INFO" "  - 成功: $success"
            log "INFO" "  - 成功率: ${rate}%"
            log "INFO" "  - 最优策略: $best"
        fi
    done
    
    log "INFO" ""
    log "INFO" "详细历史: $HISTORY_FILE"
    log "INFO" "========================================"
}

# 主流程
main() {
    log "INFO" "========================================"
    log "INFO" "智能恢复控制器 V3.0 启动"
    log "INFO" "========================================"
    
    # 1. 识别事件
    local event=$(identify_event)
    log "INFO" "识别事件: $event"
    
    if [ "$event" = "unknown" ]; then
        log "INFO" "无异常事件，跳过恢复"
        exit 0
    fi
    
    # 2. 选择策略
    local strategy=$(select_strategy "$event")
    
    if [ -z "$strategy" ]; then
        log "ERROR" "未找到可用策略"
        exit 1
    fi
    
    # 3. 执行策略
    if execute_strategy "$event" "$strategy"; then
        log "INFO" "✅ 智能恢复成功"
        output_stats
        exit 0
    else
        log "ERROR" "❌ 智能恢复失败"
        output_stats
        exit 1
    fi
}

# 信号处理
cleanup() {
    log "INFO" "接收到中断信号"
    exit 130
}
trap cleanup INT TERM

# 主入口
main "$@"
