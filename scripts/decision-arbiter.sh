#!/bin/bash
# OpenClaw 决策仲裁器 V3.8
# 决策一致性 + 动量平衡

set -e

ARBITER_FILE="${HOME}/.openclaw/workspace/decision-arbiter.json"
LOG_FILE="${HOME}/.openclaw/workspace/logs/decision-arbiter.log"

mkdir -p "$(dirname "$LOG_FILE")"

log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $2" | tee -a "$LOG_FILE"
}

# 决策仲裁
arbitrate() {
    local event=$1
    local predictive=$2
    local gate=$3
    local rate=$4

    log "INFO" "=== Decision Arbitration: $event ==="
    log "INFO" "Votes: pred=$predictive, gate=$gate, rate=$rate"

    local final="SKIP"
    local reason=""

    if [ "$rate" = "DENY" ]; then
        final="SKIP"; reason="rate-limit"
    elif [ "$gate" = "SKIP" ]; then
        final="SKIP"; reason="gate-blocked"
    elif [ "$predictive" = "SKIP" ]; then
        final="SKIP"; reason="predictive-skip"
    elif [ "$predictive" = "EXECUTE" ] && [ "$gate" = "EXECUTE" ] && [ "$rate" = "ALLOW" ]; then
        final="EXECUTE"; reason="all-agreed"
    fi

    log "INFO" "Final: $final - $reason"

    # 更新记录
    node -e "
const fs = require('fs');
const f = '$ARBITER_FILE';
const d = JSON.parse(fs.readFileSync(f, 'utf8'));
d.decisionLog.push({timestamp: new Date().toISOString(), event: '$event', final: '$final', reason: '$reason'});
d.statistics.totalDecisions++;
if ('$final' === 'EXECUTE') d.statistics.executed++; else d.statistics.skipped++;
fs.writeFileSync(f, JSON.stringify(d, null, 2));
" 2>/dev/null || true

    echo "$final|$reason"
}

# 生成报告
report() {
    node << 'NODESCRIPT'
const fs = require('fs');
const f = process.env.HOME + '/.openclaw/workspace/decision-arbiter.json';
const d = JSON.parse(fs.readFileSync(f, 'utf8'));
const s = d.statistics || {};

console.log('');
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║           OpenClaw Decision Arbiter V3.8                   ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');
console.log('## Decision Statistics');
console.log('');
console.log('| Metric | Value |');
console.log('|--------|-------|');
console.log('| Total Decisions | ' + (s.totalDecisions || 0) + ' |');
console.log('| Executed | ' + (s.executed || 0) + ' |');
console.log('| Skipped | ' + (s.skipped || 0) + ' |');
console.log('| Conflict Rate | ' + (s.conflictRate || 0) + '% |');
console.log('');

const m = d.momentum || {};
const ms = m.statistics || {};
console.log('## Decision Momentum');
console.log('');
console.log('| Metric | Value |');
console.log('|--------|-------|');
console.log('| Consecutive Rejected | ' + (ms.consecutiveRejectedEvents || 0) + ' |');
console.log('| Relaxation Triggered | ' + (ms.relaxationTriggered || 0) + ' |');
console.log('| Forced Executions | ' + (ms.forcedExecutions || 0) + ' |');
console.log('');

const recent = (d.decisionLog || []).slice(-10);
if (recent.length > 0) {
    console.log('## Recent Decisions');
    console.log('');
    console.log('| Time | Event | Final | Reason |');
    console.log('|------|-------|-------|--------|');
    for (const r of recent.reverse()) {
        const t = new Date(r.timestamp).toLocaleTimeString('zh-CN');
        console.log('| ' + t + ' | ' + r.event + ' | ' + r.final + ' | ' + r.reason + ' |');
    }
    console.log('');
}

if ((ms.consecutiveRejectedEvents || 0) > 3) {
    console.log('WARNING: Multiple events being blocked, system may be over-constrained');
} else if ((s.executed || 0) === 0 && s.totalDecisions > 10) {
    console.log('WARNING: No executions for long time, system may be stuck');
} else {
    console.log('OK: System operating normally');
}
console.log('');
NODESCRIPT
}

case "${1:-}" in
    arbitrate) arbitrate "$2" "$3" "$4" "$5" ;;
    report) report ;;
    *) echo "Usage: $0 {arbitrate EVENT PRED GATE RATE | report}" ;;
esac