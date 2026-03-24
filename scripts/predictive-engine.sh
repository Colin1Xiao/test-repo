#!/bin/bash
# OpenClaw 预测引擎 V3.5（受控版）
# 核心原则：预测错了也不会造成损害

set -e

# 文件路径
STATUS_FILE="${HOME}/.openclaw/workspace/openclaw-health-check.json"
PREDICTIVE_LOG="${HOME}/.openclaw/workspace/predictive-log.json"
RECOVERY_HISTORY="${HOME}/.openclaw/workspace/recovery-history.json"
RECOVERY_CONTROLLER="${HOME}/.openclaw/workspace/scripts/recovery-controller-v3.sh"
LOG_FILE="${HOME}/.openclaw/workspace/logs/predictive-engine.log"

# 配置（从 predictive-log.json 读取或使用默认值）
WINDOW=3                           # 连续 N 次
DURATION_THRESHOLD=15              # 持续 N 秒
CONFIDENCE_THRESHOLD=0.7           # 置信度阈值
COOLDOWN=600                       # 预测冷却时间（10分钟）
MAX_PREDICTIVE_PER_HOUR=2          # 每小时最大预测次数

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

# 记录状态历史
record_state_history() {
    local current_status=$1
    local timestamp=$(date +%s)

    node << EOF
const fs = require('fs');
const logFile = '$PREDICTIVE_LOG';
const data = JSON.parse(fs.readFileSync(logFile, 'utf8'));

// 添加状态记录
data.stateHistory.push({
    timestamp: $timestamp,
    status: '$current_status'
});

// 只保留最近 10 条
if (data.stateHistory.length > 10) {
    data.stateHistory = data.stateHistory.slice(-10);
}

data.lastUpdated = new Date().toISOString();
fs.writeFileSync(logFile, JSON.stringify(data, null, 2));
EOF
}

# 检查连续 degraded
check_consecutive_degraded() {
    local count=$(json_get "$PREDICTIVE_LOG" "data.stateHistory.slice(-$WINDOW).filter(s => s.status === 'degraded').length" 2>/dev/null || echo "0")

    if [ "$count" -ge "$WINDOW" ]; then
        log "INFO" "检测到连续 $count 次 degraded 状态"
        return 0
    fi
    return 1
}

# 计算预测置信度
calculate_confidence() {
    # 查询历史中 degraded → critical 的转换率
    local degraded_events=$(json_get "$RECOVERY_HISTORY" "data.events.filter(e => e.event.includes('gateway')).length" 2>/dev/null || echo "0")
    local critical_events=$(json_get "$RECOVERY_HISTORY" "data.events.filter(e => e.result === 'failed').length" 2>/dev/null || echo "0")

    # 简化计算：如果有足够历史数据，计算置信度
    if [ "$degraded_events" -ge 3 ]; then
        local confidence=$(echo "scale=2; $critical_events / $degraded_events" | bc 2>/dev/null || echo "0.5")
        echo "$confidence"
    else
        # 历史数据不足，使用保守值
        echo "0.6"
    fi
}

# 检查预测冷却时间
check_predictive_cooldown() {
    local now=$(date +%s)
    local last_prediction=$(json_get "$PREDICTIVE_LOG" "data.statistics.lastPrediction" 2>/dev/null || echo "0")

    if [ -z "$last_prediction" ] || [ "$last_prediction" = "null" ]; then
        return 0
    fi

    local elapsed=$((now - last_prediction))

    if [ "$elapsed" -lt "$COOLDOWN" ]; then
        local remaining=$((COOLDOWN - elapsed))
        log "INFO" "预测冷却中，还需等待 ${remaining} 秒"
        return 1
    fi

    return 0
}

# 检查每小时预测次数限制
check_hourly_limit() {
    local current_hour=$(date +%Y%m%d%H)
    local log_hour=$(json_get "$PREDICTIVE_LOG" "data.hourlyCount.hour" 2>/dev/null || echo "0")
    local count=$(json_get "$PREDICTIVE_LOG" "data.hourlyCount.count" 2>/dev/null || echo "0")

    # 新的一小时，重置计数
    if [ "$current_hour" != "$log_hour" ]; then
        return 0
    fi

    if [ "$count" -ge "$MAX_PREDICTIVE_PER_HOUR" ]; then
        log "WARN" "已达到每小时预测上限 ($MAX_PREDICTIVE_PER_HOUR)"
        return 1
    fi

    return 0
}

# 二次确认（当前仍 degraded）
double_check_status() {
    local current=$(json_get "$STATUS_FILE" "json.overall.status")

    if [ "$current" = "degraded" ]; then
        log "INFO" "二次确认：当前状态仍为 degraded"
        return 0
    else
        log "INFO" "二次确认失败：当前状态已变为 $current，取消预测"
        return 1
    fi
}

# 执行预测性恢复
execute_predictive_recovery() {
    local confidence=$1

    log "INFO" "========================================"
    log "INFO" "🔮 预测性恢复触发"
    log "INFO" "========================================"
    log "INFO" "触发原因: 连续 $WINDOW 次 degraded"
    log "INFO" "置信度: ${confidence}"
    log "INFO" "========================================"

    # 记录预测
    record_prediction "triggered" "$confidence"

    # 调用恢复控制器（V3.0）
    if bash "$RECOVERY_CONTROLLER" >> "$LOG_FILE" 2>&1; then
        log "INFO" "✅ 预测性恢复执行成功"
        record_prediction_result "success"
        return 0
    else
        log "ERROR" "❌ 预测性恢复执行失败"
        record_prediction_result "failed"
        return 1
    fi
}

# 记录预测
record_prediction() {
    local status=$1
    local confidence=$2
    local timestamp=$(date +%s)
    local current_hour=$(date +%Y%m%d%H)

    node << EOF
const fs = require('fs');
const logFile = '$PREDICTIVE_LOG';
const data = JSON.parse(fs.readFileSync(logFile, 'utf8'));

// 添加预测记录
data.predictions.push({
    timestamp: new Date().toISOString(),
    status: '$status',
    confidence: $confidence,
    result: null
});

// 更新统计
data.statistics.totalPredictions++;
data.statistics.lastPrediction = $timestamp;

// 更新小时计数
const currentHour = '$current_hour';
if (data.hourlyCount.hour !== currentHour) {
    data.hourlyCount = { hour: currentHour, count: 1 };
} else {
    data.hourlyCount.count++;
}

data.lastUpdated = new Date().toISOString();
fs.writeFileSync(logFile, JSON.stringify(data, null, 2));
EOF
}

# 记录预测结果
record_prediction_result() {
    local result=$1

    node << EOF
const fs = require('fs');
const logFile = '$PREDICTIVE_LOG';
const data = JSON.parse(fs.readFileSync(logFile, 'utf8'));

// 更新最近预测的结果
if (data.predictions.length > 0) {
    data.predictions[data.predictions.length - 1].result = '$result';
}

// 更新统计
if ('$result' === 'success') {
    data.statistics.truePositives++;
} else {
    data.statistics.falsePositives++;
}

// 计算准确率
const total = data.statistics.truePositives + data.statistics.falsePositives;
if (total > 0) {
    data.statistics.accuracy = Math.round((data.statistics.truePositives / total) * 100);
}

data.lastUpdated = new Date().toISOString();
fs.writeFileSync(logFile, JSON.stringify(data, null, 2));
EOF
}

# 输出预测统计
output_predictive_stats() {
    local total=$(json_get "$PREDICTIVE_LOG" "data.statistics.totalPredictions" 2>/dev/null || echo "0")
    local true_pos=$(json_get "$PREDICTIVE_LOG" "data.statistics.truePositives" 2>/dev/null || echo "0")
    local false_pos=$(json_get "$PREDICTIVE_LOG" "data.statistics.falsePositives" 2>/dev/null || echo "0")
    local accuracy=$(json_get "$PREDICTIVE_LOG" "data.statistics.accuracy" 2>/dev/null || echo "0")

    if [ "$total" -gt 0 ]; then
        log "INFO" ""
        log "INFO" "📊 预测统计:"
        log "INFO" "  - 总预测次数: $total"
        log "INFO" "  - 命中（成功避免）: $true_pos"
        log "INFO" "  - 误判: $false_pos"
        log "INFO" "  - 准确率: ${accuracy}%"
    fi
}

# 主流程
main() {
    log "INFO" "========================================"
    log "INFO" "预测引擎 V3.5 启动"
    log "INFO" "========================================"

    # 1. 获取当前状态
    local current_status=$(json_get "$STATUS_FILE" "json.overall.status")
    log "INFO" "当前状态: $current_status"

    # 2. 记录状态历史
    record_state_history "$current_status"

    # 3. 如果状态正常，直接退出
    if [ "$current_status" = "healthy" ]; then
        log "INFO" "状态正常，无需预测"
        exit 0
    fi

    # 4. 检查是否连续 degraded
    if ! check_consecutive_degraded; then
        log "INFO" "未达到连续 degraded 阈值 ($WINDOW 次)"
        exit 0
    fi

    # 5. 计算置信度
    local confidence=$(calculate_confidence)
    log "INFO" "预测置信度: $confidence"

    # 6. 检查置信度阈值
    if [ "$(echo "$confidence < $CONFIDENCE_THRESHOLD" | bc 2>/dev/null || echo "1")" = "1" ]; then
        log "INFO" "置信度 ($confidence) < 阈值 ($CONFIDENCE_THRESHOLD)，跳过预测"
        exit 0
    fi

    # 7. 检查冷却时间
    if ! check_predictive_cooldown; then
        exit 0
    fi

    # 8. 检查每小时限制
    if ! check_hourly_limit; then
        exit 0
    fi

    # 9. 二次确认
    if ! double_check_status; then
        exit 0
    fi

    # 10. 执行预测性恢复
    if execute_predictive_recovery "$confidence"; then
        output_predictive_stats
        exit 0
    else
        output_predictive_stats
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