#!/bin/bash
# OpenClaw 行为护栏系统 V3.9
# 核心目标：允许系统自适应，但限制偏移范围
# 防止"系统行为漂移"导致失控

set -e

GUARD_FILE="${HOME}/.openclaw/workspace/behavior-guard.json"
ARBITER_FILE="${HOME}/.openclaw/workspace/decision-arbiter.json"
LOG_FILE="${HOME}/.openclaw/workspace/logs/behavior-guard.log"

mkdir -p "$(dirname "$LOG_FILE")"

log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $2" | tee -a "$LOG_FILE"
}

# ========== 1. 限制放宽幅度 ==========

check_confidence_boundary() {
    local requested=$1
    
    local min_allowed=$(node -e "console.log(require('fs').readFileSync('$GUARD_FILE', 'utf8') |> JSON.parse |> .boundaries.confidence.minAllowed" 2>/dev/null || echo "0.75")
    
    if [ "$(echo "$requested < $min_allowed" | bc 2>/dev/null || echo "0")" = "1" ]; then
        log "WARN" "BOUNDARY HIT: confidence $requested < min allowed $min_allowed"
        update_boundary_hit "confidence"
        echo "$min_allowed"
    else
        echo "$requested"
    fi
}

# ========== 2. 限制动量频率 ==========

check_momentum_frequency() {
    local current_hour=$(date +%Y%m%d%H)
    local current_day=$(date +%Y%m%d)
    
    local max_per_hour=$(node -e "console.log(require('fs').readFileSync('$GUARD_FILE', 'utf8') |> JSON.parse |> .boundaries.momentumFrequency.maxPerHour" 2>/dev/null || echo "2")
    local max_per_day=$(node -e "console.log(require('fs').readFileSync('$GUARD_FILE', 'utf8') |> JSON.parse |> .boundaries.momentumFrequency.maxPerDay" 2>/dev/null || echo "5")
    
    local result=$(node -e "
const fs = require('fs');
const gf = '$GUARD_FILE';
const d = JSON.parse(fs.readFileSync(gf, 'utf8'));
const mf = d.boundaries.momentumFrequency;
const ch = '$current_hour';
const cd = '$current_day';

// 重置计数
if (mf.currentHour.hour !== ch) { mf.currentHour = { hour: ch, count: 0 }; }
if (mf.currentDay.date !== cd) { mf.currentDay = { date: cd, count: 0 }; }

const hourOk = mf.currentHour.count < $max_per_hour;
const dayOk = mf.currentDay.count < $max_per_day;

if (hourOk && dayOk) {
    mf.currentHour.count++;
    mf.currentDay.count++;
    fs.writeFileSync(gf, JSON.stringify(d, null, 2));
    console.log('ALLOW');
} else {
    console.log('DENY');
}
" 2>/dev/null)
    
    if [ "$result" = "DENY" ]; then
        log "WARN" "MOMENTUM FREQUENCY LIMIT HIT"
        update_boundary_hit "momentum_frequency"
        return 1
    fi
    
    return 0
}

# ========== 3. 限制连续放宽 ==========

check_consecutive_relaxation() {
    local current=$(node -e "console.log(require('fs').readFileSync('$GUARD_FILE', 'utf8') |> JSON.parse |> .boundaries.consecutiveRelaxation.current" 2>/dev/null || echo "0")
    local max_allowed=$(node -e "console.log(require('fs').readFileSync('$GUARD_FILE', 'utf8') |> JSON.parse |> .boundaries.consecutiveRelaxation.maxAllowed" 2>/dev/null || echo "3")
    
    if [ "$current" -ge "$max_allowed" ]; then
        log "WARN" "CONSECUTIVE RELAXATION LIMIT HIT: $current >= $max_allowed, forcing reset"
        trigger_reset
        return 1
    fi
    
    # 增加计数
    node -e "
const fs = require('fs');
const gf = '$GUARD_FILE';
const d = JSON.parse(fs.readFileSync(gf, 'utf8'));
d.boundaries.consecutiveRelaxation.current++;
fs.writeFileSync(gf, JSON.stringify(d, null, 2));
" 2>/dev/null
    
    return 0
}

# ========== 4. 计算行为健康度 ==========

calculate_behavior_health() {
    node << 'NODESCRIPT'
const fs = require('fs');
const home = process.env.HOME;
const gf = home + '/.openclaw/workspace/behavior-guard.json';
const af = home + '/.openclaw/workspace/decision-arbiter.json';

const guard = JSON.parse(fs.readFileSync(gf, 'utf8'));
const arbiter = JSON.parse(fs.readFileSync(af, 'utf8'));

const stats = arbiter.statistics || {};
const total = stats.totalDecisions || 0;

let executeRate = 0, skipRate = 0, momentumRate = 0;

if (total > 0) {
    executeRate = Math.round(((stats.executed || 0) / total) * 100);
    skipRate = Math.round(((stats.skipped || 0) / total) * 100);
    
    const momentumStats = arbiter.momentum?.statistics || {};
    momentumRate = Math.round(((momentumStats.relaxationTriggered || 0) / total) * 100);
}

// 更新行为健康度
guard.behaviorHealth = {
    executeRate: executeRate,
    skipRate: skipRate,
    momentumRate: momentumRate,
    status: 'healthy',
    lastCalculated: new Date().toISOString()
};

// 判断状态
if (momentumRate > 30) {
    guard.behaviorHealth.status = 'warning';
} else if (executeRate > 60) {
    guard.behaviorHealth.status = 'aggressive';
} else if (skipRate > 90 && total > 10) {
    guard.behaviorHealth.status = 'stuck';
} else {
    guard.behaviorHealth.status = 'balanced';
}

fs.writeFileSync(gf, JSON.stringify(guard, null, 2));

console.log('Behavior Health:');
console.log('  Execute Rate: ' + executeRate + '%');
console.log('  Skip Rate: ' + skipRate + '%');
console.log('  Momentum Rate: ' + momentumRate + '%');
console.log('  Status: ' + guard.behaviorHealth.status);
NODESCRIPT
}

# ========== 5. 检查是否需要回滚 ==========

check_rollback_needed() {
    node << 'NODESCRIPT'
const fs = require('fs');
const home = process.env.HOME;
const gf = home + '/.openclaw/workspace/behavior-guard.json';
const guard = JSON.parse(fs.readFileSync(gf, 'utf8'));

const bh = guard.behaviorHealth;
const triggers = guard.rollback.triggers;

let needReset = false;
let reason = '';

if (bh.momentumRate > (triggers.momentumRateAbove * 100)) {
    needReset = true;
    reason = 'momentum_rate_too_high';
}

if (bh.executeRate > (triggers.executeRateAbove * 100)) {
    needReset = true;
    reason = 'execute_rate_too_high';
}

const consecutive = guard.boundaries.consecutiveRelaxation.current || 0;
if (consecutive > triggers.consecutiveRelaxationAbove) {
    needReset = true;
    reason = 'consecutive_relaxation_exceeded';
}

if (needReset) {
    console.log('ROLLBACK_NEEDED:' + reason);
} else {
    console.log('OK');
}
NODESCRIPT
}

# ========== 触发重置 ==========

trigger_reset() {
    log "INFO" "=== TRIGGERING BEHAVIOR RESET ==="
    
    node << 'NODESCRIPT'
const fs = require('fs');
const home = process.env.HOME;
const gf = home + '/.openclaw/workspace/behavior-guard.json';
const guard = JSON.parse(fs.readFileSync(gf, 'utf8'));

// 重置所有参数到默认值
guard.boundaries.confidence.current = guard.boundaries.confidence.default;
guard.boundaries.consecutiveRelaxation.current = 0;
guard.boundaries.momentumFrequency.currentHour.count = 0;
guard.boundaries.momentumFrequency.currentDay.count = 0;

// 记录重置历史
guard.rollback.history.push({
    timestamp: new Date().toISOString(),
    reason: 'boundary_exceeded',
    previousState: { ...guard.behaviorHealth }
});

if (guard.rollback.history.length > 20) {
    guard.rollback.history = guard.rollback.history.slice(-20);
}

guard.statistics.totalResets++;
guard.lastUpdated = new Date().toISOString();

fs.writeFileSync(gf, JSON.stringify(guard, null, 2));
console.log('Reset completed');
NODESCRIPT
    
    log "INFO" "Behavior reset completed - all parameters restored to defaults"
}

# ========== 更新边界命中统计 ==========

update_boundary_hit() {
    local boundary_type=$1
    
    node -e "
const fs = require('fs');
const gf = '$GUARD_FILE';
const d = JSON.parse(fs.readFileSync(gf, 'utf8'));
d.statistics.boundaryHits++;
fs.writeFileSync(gf, JSON.stringify(d, null, 2));
" 2>/dev/null
}

# ========== 生成报告 ==========

report() {
    node << 'NODESCRIPT'
const fs = require('fs');
const home = process.env.HOME;
const gf = home + '/.openclaw/workspace/behavior-guard.json';
const guard = JSON.parse(fs.readFileSync(gf, 'utf8'));

console.log('');
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║           OpenClaw Behavior Guard Report V3.9              ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');

// 行为健康度
const bh = guard.behaviorHealth || {};
console.log('## Behavior Health');
console.log('');
console.log('| Metric | Value |');
console.log('|--------|-------|');
console.log('| Execute Rate | ' + (bh.executeRate || 0) + '% |');
console.log('| Skip Rate | ' + (bh.skipRate || 0) + '% |');
console.log('| Momentum Rate | ' + (bh.momentumRate || 0) + '% |');

const statusEmoji = bh.status === 'balanced' ? '🟢' : bh.status === 'warning' ? '🟡' : '🔴';
console.log('| Status | ' + statusEmoji + ' ' + (bh.status || 'unknown') + ' |');
console.log('');

// 边界设置
const bounds = guard.boundaries || {};
console.log('## Behavior Boundaries');
console.log('');
console.log('| Boundary | Current | Min/Max | Status |');
console.log('|----------|---------|---------|--------|');

const conf = bounds.confidence || {};
console.log('| Confidence Threshold | ' + ((conf.current || 0.85) * 100) + '% | min ' + ((conf.minAllowed || 0.75) * 100) + '% | ✅ |');

const mf = bounds.momentumFrequency || {};
const hourCount = mf.currentHour?.count || 0;
const dayCount = mf.currentDay?.count || 0;
console.log('| Momentum This Hour | ' + hourCount + ' | max ' + (mf.maxPerHour || 2) + ' | ' + (hourCount >= (mf.maxPerHour || 2) ? '⚠️ At limit' : '✅') + ' |');
console.log('| Momentum Today | ' + dayCount + ' | max ' + (mf.maxPerDay || 5) + ' | ' + (dayCount >= (mf.maxPerDay || 5) ? '⚠️ At limit' : '✅') + ' |');

const cr = bounds.consecutiveRelaxation || {};
console.log('| Consecutive Relaxation | ' + (cr.current || 0) + ' | max ' + (cr.maxAllowed || 3) + ' | ' + ((cr.current || 0) >= (cr.maxAllowed || 3) ? '⚠️ Will reset' : '✅') + ' |');
console.log('');

// 统计
const stats = guard.statistics || {};
console.log('## Guard Statistics');
console.log('');
console.log('| Metric | Value |');
console.log('|--------|-------|');
console.log('| Total Resets | ' + (stats.totalResets || 0) + ' |');
console.log('| Boundary Hits | ' + (stats.boundaryHits || 0) + ' |');
console.log('');

// 最近重置
const history = (guard.rollback?.history || []).slice(-5);
if (history.length > 0) {
    console.log('## Recent Resets');
    console.log('');
    console.log('| Time | Reason |');
    console.log('|------|--------|');
    for (const h of history.reverse()) {
        const time = new Date(h.timestamp).toLocaleTimeString('zh-CN');
        console.log('| ' + time + ' | ' + h.reason + ' |');
    }
    console.log('');
}

// 建议
console.log('## Assessment');
console.log('');
if (bh.status === 'balanced') {
    console.log('✅ System behavior is within healthy boundaries');
} else if (bh.status === 'aggressive') {
    console.log('⚠️ System is becoming too aggressive - consider tightening constraints');
} else if (bh.status === 'stuck') {
    console.log('⚠️ System appears stuck - consider relaxing constraints');
} else if (bh.status === 'warning') {
    console.log('⚠️ Momentum rate is high - system may be drifting');
}

if ((stats.totalResets || 0) > 0) {
    console.log('');
    console.log('ℹ️  System has auto-reset ' + stats.totalResets + ' time(s) to prevent drift');
}
console.log('');
NODESCRIPT
}

# ========== 主入口 ==========

case "${1:-}" in
    check-confidence)
        check_confidence_boundary "$2"
        ;;
    check-momentum)
        check_momentum_frequency
        ;;
    check-consecutive)
        check_consecutive_relaxation
        ;;
    health)
        calculate_behavior_health
        ;;
    check-rollback)
        check_rollback_needed
        ;;
    reset)
        trigger_reset
        ;;
    report)
        report
        ;;
    *)
        echo "Usage: $0 {check-confidence VALUE|check-momentum|check-consecutive|health|check-rollback|reset|report}"
        echo ""
        echo "V3.9 Behavior Guard Commands:"
        echo "  check-confidence VALUE  - Check if confidence within boundary"
        echo "  check-momentum          - Check momentum frequency limit"
        echo "  check-consecutive       - Check consecutive relaxation limit"
        echo "  health                  - Calculate behavior health"
        echo "  check-rollback          - Check if rollback needed"
        echo "  reset                   - Force reset to defaults"
        echo "  report                  - Generate behavior guard report"
        ;;
esac