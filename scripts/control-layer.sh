#!/bin/bash
# OpenClaw 迟滞控制器 + 恢复门控
# V3.6 核心模块：让系统"更少动作，但更正确"

set -e

STATUS_FILE="${HOME}/.openclaw/workspace/openclaw-health-check.json"
CONTROL_CONFIG="${HOME}/.openclaw/workspace/control-config.json"
SILENT_FILE="${HOME}/.openclaw/workspace/silent-anomalies.json"
LOG_FILE="${HOME}/.openclaw/workspace/logs/control-layer.log"

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

# ========== 迟滞控制 ==========
# 状态必须稳定 N 秒才确认恢复

check_hysteresis() {
    local current_status=$1
    local previous_status=$2
    local stable_threshold=$(json_get "$CONTROL_CONFIG" "json.hysteresis.stableThresholdSeconds" 2>/dev/null || echo "10")

    # 只在状态从 degraded/critical → healthy 时检查
    if [ "$current_status" = "healthy" ] && [ "$previous_status" != "healthy" ]; then
        log "INFO" "迟滞检查: $previous_status → healthy，需要稳定 ${stable_threshold}s"

        # 等待稳定时间
        local elapsed=0
        while [ $elapsed -lt $stable_threshold ]; do
            sleep 1
            elapsed=$((elapsed + 1))

            # 刷新状态
            bash "${HOME}/.openclaw/workspace/scripts/openclaw-health-check.sh" > /dev/null 2>&1 || true
            local check_status=$(json_get "$STATUS_FILE" "json.overall.status")

            # 如果状态又变了，返回失败
            if [ "$check_status" != "healthy" ]; then
                log "WARN" "迟滞检查失败: 状态在 ${elapsed}s 后变为 $check_status"
                return 1
            fi
        done

        log "INFO" "✅ 迟滞检查通过: 状态稳定 ${stable_threshold}s"
        return 0
    fi

    # 其他情况直接通过
    return 0
}

# ========== 恢复门控 ==========
# 判断"该不该恢复"

check_recovery_gate() {
    local duration=$1  # degraded 持续时间（秒）
    local event_type=$2

    log "INFO" "恢复门控检查: duration=${duration}s, event=$event_type"

    # 规则 1: 最小持续时间
    local min_duration=$(json_get "$CONTROL_CONFIG" "json.recoveryGate.rules.find(r => r.id === 'min_duration').threshold" 2>/dev/null || echo "10")

    if [ "$duration" -lt "$min_duration" ]; then
        log "INFO" "🚫 恢复门控: 持续时间 (${duration}s) < 阈值 (${min_duration}s)，跳过恢复"
        record_action "recovery_skipped" "min_duration" "duration=${duration}s"
        return 1
    fi

    # 规则 2: 自愈模式检查
    local silent_stats=$(json_get "$SILENT_FILE" "json.statistics.degradedNoRecovery" 2>/dev/null || echo "0")
    local min_occurrences=$(json_get "$CONTROL_CONFIG" "json.recoveryGate.rules.find(r => r.id === 'self_healing_pattern').minOccurrences" 2>/dev/null || echo "3")

    if [ "$silent_stats" -ge "$min_occurrences" ]; then
        log "INFO" "⏳ 恢复门控: 历史显示该场景常自恢复 ($silent_stats 次)，延迟恢复"
        record_action "recovery_skipped" "self_healing_pattern" "occurrences=$silent_stats"
        # 延迟但不完全跳过
        sleep 5
    fi

    log "INFO" "✅ 恢复门控通过"
    return 0
}

# ========== 预测执行门控 ==========
# 基于置信度的选择性执行

check_predictive_gate() {
    local confidence=$1

    log "INFO" "预测执行门控: confidence=$confidence"

    local execute_threshold=$(json_get "$CONTROL_CONFIG" "json.predictiveExecution.rules.execute.minConfidence" 2>/dev/null || echo "0.85")
    local record_threshold=$(json_get "$CONTROL_CONFIG" "json.predictiveExecution.rules.record.minConfidence" 2>/dev/null || echo "0.70")

    # 置信度 ≥ 85%: 执行
    if [ "$(echo "$confidence >= $execute_threshold" | bc 2>/dev/null || echo "0")" = "1" ]; then
        log "INFO" "✅ 预测执行: 置信度 $confidence ≥ $execute_threshold，允许执行"
        echo "execute"
        return 0
    fi

    # 置信度 70-85%: 只记录
    if [ "$(echo "$confidence >= $record_threshold" | bc 2>/dev/null || echo "0")" = "1" ]; then
        log "INFO" "📝 预测记录: 置信度 $confidence 在 $record_threshold-$execute_threshold 之间，仅记录"
        record_action "predictive_skipped" "low_confidence" "confidence=$confidence"
        echo "record"
        return 0
    fi

    # 置信度 < 70%: 忽略
    log "INFO" "🚫 预测忽略: 置信度 $confidence < $record_threshold"
    record_action "predictive_skipped" "very_low_confidence" "confidence=$confidence"
    echo "ignore"
    return 0
}

# ========== 全局速率限制 ==========

check_rate_limit() {
    local now=$(date +%s)
    local current_hour=$(date +%Y%m%d%H)
    local current_day=$(date +%Y%m%d)

    local max_per_hour=$(json_get "$CONTROL_CONFIG" "json.rateLimit.maxActionsPerHour" 2>/dev/null || echo "5")
    local max_per_day=$(json_get "$CONTROL_CONFIG" "json.rateLimit.maxActionsPerDay" 2>/dev/null || echo "20")

    local config_hour=$(json_get "$CONTROL_CONFIG" "json.rateLimit.currentHour.hour" 2>/dev/null || echo "0")
    local config_hour_count=$(json_get "$CONTROL_CONFIG" "json.rateLimit.currentHour.count" 2>/dev/null || echo "0")
    local config_day=$(json_get "$CONTROL_CONFIG" "json.rateLimit.currentDay.date" 2>/dev/null || echo "0")
    local config_day_count=$(json_get "$CONTROL_CONFIG" "json.rateLimit.currentDay.count" 2>/dev/null || echo "0")

    # 重置小时计数
    if [ "$current_hour" != "$config_hour" ]; then
        config_hour_count=0
    fi

    # 重置天计数
    if [ "$current_day" != "$config_day" ]; then
        config_day_count=0
    fi

    # 检查限制
    if [ "$config_hour_count" -ge "$max_per_hour" ]; then
        log "WARN" "🚫 速率限制: 小时动作次数 ($config_hour_count) ≥ 上限 ($max_per_hour)"
        update_rate_limit_stats
        return 1
    fi

    if [ "$config_day_count" -ge "$max_per_day" ]; then
        log "WARN" "🚫 速率限制: 天动作次数 ($config_day_count) ≥ 上限 ($max_per_day)"
        update_rate_limit_stats
        return 1
    fi

    log "INFO" "✅ 速率限制通过: 小时 $config_hour_count/$max_per_hour, 天 $config_day_count/$max_per_day"
    return 0
}

# 更新速率限制计数
update_rate_limit_count() {
    local current_hour=$(date +%Y%m%d%H)
    local current_day=$(date +%Y%m%d)

    node << EOF
const fs = require('fs');
const configFile = '$CONTROL_CONFIG';
const data = JSON.parse(fs.readFileSync(configFile, 'utf8'));

const currentHour = '$current_hour';
const currentDay = '$current_day';

// 更新小时计数
if (data.rateLimit.currentHour.hour !== currentHour) {
    data.rateLimit.currentHour = { hour: currentHour, count: 1 };
} else {
    data.rateLimit.currentHour.count++;
}

// 更新天计数
if (data.rateLimit.currentDay.date !== currentDay) {
    data.rateLimit.currentDay = { date: currentDay, count: 1 };
} else {
    data.rateLimit.currentDay.count++;
}

data.lastUpdated = new Date().toISOString();
fs.writeFileSync(configFile, JSON.stringify(data, null, 2));
EOF
}

# 更新速率限制命中统计
update_rate_limit_stats() {
    node << EOF
const fs = require('fs');
const configFile = '$CONTROL_CONFIG';
const data = JSON.parse(fs.readFileSync(configFile, 'utf8'));

data.statistics.rateLimitHits++;

data.lastUpdated = new Date().toISOString();
fs.writeFileSync(configFile, JSON.stringify(data, null, 2));
EOF
}

# 记录动作
record_action() {
    local action_type=$1
    local reason=$2
    local details=$3

    node << EOF
const fs = require('fs');
const configFile = '$CONTROL_CONFIG';
const data = JSON.parse(fs.readFileSync(configFile, 'utf8'));

// 添加动作日志
data.actionLog.push({
    timestamp: new Date().toISOString(),
    type: '$action_type',
    reason: '$reason',
    details: '$details'
});

// 只保留最近 100 条
if (data.actionLog.length > 100) {
    data.actionLog = data.actionLog.slice(-100);
}

// 更新统计
if ('$action_type' === 'recovery_executed') {
    data.statistics.recoveryExecuted++;
} else if ('$action_type' === 'recovery_skipped') {
    data.statistics.recoverySkipped++;
} else if ('$action_type' === 'predictive_triggered') {
    data.statistics.predictiveTriggered++;
} else if ('$action_type' === 'predictive_skipped') {
    data.statistics.predictiveSkipped++;
}

data.lastUpdated = new Date().toISOString();
fs.writeFileSync(configFile, JSON.stringify(data, null, 2));
EOF
}

# ========== 主入口 ==========

case "${1:-}" in
    hysteresis)
        check_hysteresis "$2" "$3"
        ;;
    recovery-gate)
        check_recovery_gate "$2" "$3"
        ;;
    predictive-gate)
        check_predictive_gate "$2"
        ;;
    rate-limit)
        check_rate_limit
        ;;
    increment-rate)
        update_rate_limit_count
        ;;
    record)
        record_action "$2" "$3" "$4"
        ;;
    *)
        echo "用法: $0 {hysteresis|recovery-gate|predictive-gate|rate-limit|increment-rate|record}"
        echo ""
        echo "V3.6 控制层命令:"
        echo "  hysteresis <current> <previous>    - 迟滞检查"
        echo "  recovery-gate <duration> <event>   - 恢复门控"
        echo "  predictive-gate <confidence>       - 预测执行门控"
        echo "  rate-limit                         - 检查速率限制"
        echo "  increment-rate                     - 增加速率计数"
        echo "  record <type> <reason> <details>   - 记录动作"
        ;;
esac