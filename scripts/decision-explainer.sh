#!/bin/bash
# OpenClaw 决策解释引擎 V4.0
# 核心目标：让系统"解释自己为什么这样做"

set -e

META_FILE="${HOME}/.openclaw/workspace/meta-system.json"
ARBITER_FILE="${HOME}/.openclaw/workspace/decision-arbiter.json"
GUARD_FILE="${HOME}/.openclaw/workspace/behavior-guard.json"
CONTROL_FILE="${HOME}/.openclaw/workspace/control-config.json"
STATUS_FILE="${HOME}/.openclaw/workspace/openclaw-health-check.json"

# ========== 决策追踪 ==========

trace_decision() {
    local event=$1
    
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║           Decision Trace V4.0 - Why This Decision?         ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    
    # 获取当前状态
    local current_status=$(node -e "console.log(require('fs').readFileSync('$STATUS_FILE', 'utf8') |> JSON.parse |> .overall.status" 2>/dev/null || echo "unknown")
    local status_emoji="🟢"
    [ "$current_status" = "degraded" ] && status_emoji="🟡"
    [ "$current_status" = "critical" ] && status_emoji="🔴"
    
    echo "📊 **Current State**"
    echo ""
    echo "  Status: $status_emoji $current_status"
    echo "  Event: $event"
    echo ""
    
    # 获取最近决策
    local last_decision=$(node -e "
const fs = require('fs');
const d = JSON.parse(fs.readFileSync('$ARBITER_FILE', 'utf8'));
const last = d.decisionLog[d.decisionLog.length - 1];
if (last) {
    console.log(JSON.stringify(last));
}
" 2>/dev/null)
    
    if [ -n "$last_decision" ]; then
        echo "🔧 **Module Votes**"
        echo ""
        
        node << NODESCRIPT
const decision = $last_decision;
const votes = decision.votes || {};

console.log("| Module | Vote |");
console.log("|--------|------|");

const predIcon = votes.predictive === 'EXECUTE' ? '✅' : '⏭️';
console.log("| predictive | " + predIcon + " " + (votes.predictive || 'N/A') + " |");

const gateIcon = votes.recoveryGate === 'EXECUTE' ? '✅' : '⏭️';
console.log("| recovery_gate | " + gateIcon + " " + (votes.recoveryGate || 'N/A') + " |");

const rateIcon = votes.rateLimit === 'ALLOW' ? '✅' : '🚫';
console.log("| rate_limit | " + rateIcon + " " + (votes.rateLimit || 'N/A') + " |");

console.log("");
NODESCRIPT
    fi
    
    # 获取动量状态
    local momentum_status=$(node -e "
const fs = require('fs');
const d = JSON.parse(fs.readFileSync('$ARBITER_FILE', 'utf8'));
const m = d.momentum || {};
const ms = m.statistics || {};
console.log('Triggered: ' + (ms.relaxationTriggered || 0) + ', Forced: ' + (ms.forcedExecutions || 0));
" 2>/dev/null || echo "N/A")
    
    echo "🔥 **Momentum Status**"
    echo ""
    echo "  Relaxations: $(echo $momentum_status | cut -d',' -f1)"
    echo "  Forced Executions: $(echo $momentum_status | cut -d',' -f2)"
    echo ""
    
    # 获取护栏状态
    local guard_status=$(node -e "
const fs = require('fs');
const d = JSON.parse(fs.readFileSync('$GUARD_FILE', 'utf8'));
const bh = d.behaviorHealth || {};
console.log(bh.status || 'unknown');
" 2>/dev/null || echo "unknown")
    
    echo "🛡️ **Guard Check**"
    echo ""
    local guard_emoji="🟢"
    [ "$guard_status" = "warning" ] && guard_emoji="🟡"
    [ "$guard_status" = "aggressive" ] && guard_emoji="🔴"
    echo "  Behavior Health: $guard_emoji $guard_status"
    echo ""
    
    # 最终决策
    if [ -n "$last_decision" ]; then
        echo "🎯 **Final Decision**"
        echo ""
        
        node << NODESCRIPT
const decision = $last_decision;
const icon = decision.final === 'EXECUTE' ? '✅' : '⏭️';
console.log("  Result: " + icon + " " + decision.final);
console.log("  Reason: " + decision.reason);
if (decision.momentumTriggered) {
    console.log("  Note: 🔥 Momentum override active");
}
console.log("");
NODESCRIPT
    fi
}

# ========== 置信度分布 ==========

confidence_distribution() {
    node << 'NODESCRIPT'
const fs = require('fs');
const home = process.env.HOME;

const meta = JSON.parse(fs.readFileSync(home + '/.openclaw/workspace/meta-system.json', 'utf8'));
const arbiter = JSON.parse(fs.readFileSync(home + '/.openclaw/workspace/decision-arbiter.json', 'utf8'));

const stats = arbiter.statistics || {};
const total = stats.totalDecisions || 0;
const executed = stats.executed || 0;
const skipped = stats.skipped || 0;

const momentumStats = arbiter.momentum?.statistics || {};
const forced = momentumStats.forcedExecutions || 0;

console.log('');
console.log('## Decision Confidence Distribution');
console.log('');
console.log('| Category | Count | Percentage |');
console.log('|----------|-------|------------|');

if (total > 0) {
    const normalExec = executed - forced;
    const normalPct = Math.round((normalExec / total) * 100);
    const momentumPct = Math.round((forced / total) * 100);
    const rejectedPct = Math.round((skipped / total) * 100);
    
    console.log('| High Confidence Execute | ' + normalExec + ' | ' + normalPct + '% |');
    console.log('| Momentum Execute | ' + forced + ' | ' + momentumPct + '% |');
    console.log('| Rejected | ' + skipped + ' | ' + rejectedPct + '% |');
    console.log('| **Total** | ' + total + ' | 100% |');
} else {
    console.log('| No decisions yet | - | - |');
}
console.log('');
NODESCRIPT
}

# ========== 系统自评估 ==========

self_assessment() {
    node << 'NODESCRIPT'
const fs = require('fs');
const home = process.env.HOME;

const meta = JSON.parse(fs.readFileSync(home + '/.openclaw/workspace/meta-system.json', 'utf8'));
const arbiter = JSON.parse(fs.readFileSync(home + '/.openclaw/workspace/decision-arbiter.json', 'utf8'));
const guard = JSON.parse(fs.readFileSync(home + '/.openclaw/workspace/behavior-guard.json', 'utf8'));

console.log('');
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║           System Self-Assessment V4.0                       ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');

const stats = arbiter.statistics || {};
const bh = guard.behaviorHealth || {};
const total = stats.totalDecisions || 0;

// 系统状态
let systemStatus = 'healthy';
const issues = [];

if (total > 10) {
    if (bh.momentumRate > 30) {
        systemStatus = 'warning';
        issues.push('Momentum rate is high - system may be drifting');
    }
    if (bh.executeRate > 60) {
        systemStatus = 'warning';
        issues.push('Execute rate is high - system may be too aggressive');
    }
    if (bh.skipRate > 90) {
        systemStatus = 'warning';
        issues.push('Skip rate is very high - system may be stuck');
    }
    if ((guard.statistics?.totalResets || 0) > 0) {
        issues.push('System has auto-reset due to boundary violations');
    }
}

const statusEmoji = systemStatus === 'healthy' ? '🟢' : '🟡';
console.log('**System Status**: ' + statusEmoji + ' ' + systemStatus);
console.log('');

// 统计
console.log('**Statistics**:');
console.log('');
console.log('  - Total Decisions: ' + total);
console.log('  - Executed: ' + (stats.executed || 0));
console.log('  - Skipped: ' + (stats.skipped || 0));
console.log('  - Conflict Rate: ' + (stats.conflictRate || 0) + '%');
console.log('  - Behavior Health: ' + (bh.status || 'unknown'));
console.log('');

// 问题
if (issues.length > 0) {
    console.log('**Issues Detected**:');
    console.log('');
    for (const issue of issues) {
        console.log('  ⚠️  ' + issue);
    }
    console.log('');
}

// 建议
console.log('**Recommendations**:');
console.log('');
if (total < 10) {
    console.log('  ℹ️  Not enough data for assessment - run for a few more days');
} else if (systemStatus === 'healthy') {
    console.log('  ✅ System is operating normally');
    console.log('  ✅ No behavioral drift detected');
    console.log('  ✅ Boundaries are respected');
} else {
    console.log('  ⚠️  Review decision logs for patterns');
    console.log('  ⚠️  Consider adjusting parameters');
}
console.log('');
NODESCRIPT
}

# ========== TL;DR 摘要 ==========

summary() {
    node << 'NODESCRIPT'
const fs = require('fs');
const home = process.env.HOME;

const health = JSON.parse(fs.readFileSync(home + '/.openclaw/workspace/openclaw-health-check.json', 'utf8'));
const arbiter = JSON.parse(fs.readFileSync(home + '/.openclaw/workspace/decision-arbiter.json', 'utf8'));
const guard = JSON.parse(fs.readFileSync(home + '/.openclaw/workspace/behavior-guard.json', 'utf8'));

console.log('');
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║           TL;DR - System Status Summary                     ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');

// 状态
const status = health.overall?.status || 'unknown';
const emoji = status === 'healthy' ? '🟢' : status === 'degraded' ? '🟡' : '🔴';
console.log('**Health**: ' + emoji + ' ' + status);

// 行为
const bh = guard.behaviorHealth || {};
const bhEmoji = bh.status === 'balanced' ? '🟢' : bh.status === 'warning' ? '🟡' : '🔴';
console.log('**Behavior**: ' + bhEmoji + ' ' + (bh.status || 'unknown'));

// 决策
const stats = arbiter.statistics || {};
console.log('**Decisions**: ' + (stats.executed || 0) + ' executed, ' + (stats.skipped || 0) + ' skipped');

// 护栏
const resets = guard.statistics?.totalResets || 0;
const hits = guard.statistics?.boundaryHits || 0;
console.log('**Guard**: ' + resets + ' resets, ' + hits + ' boundary hits');

console.log('');

// 一句话总结
if (status === 'healthy' && bh.status === 'balanced' && resets === 0) {
    console.log('✅ System normal, no anomalies, no drift risk');
} else if (resets > 0) {
    console.log('⚠️  System auto-reset to prevent drift');
} else if (bh.status === 'warning') {
    console.log('⚠️  Behavioral warning - monitor closely');
} else if (status !== 'healthy') {
    console.log('⚠️  System in degraded state');
} else {
    console.log('✅ System operating normally');
}

console.log('');
NODESCRIPT
}

# ========== 主入口 ==========

case "${1:-}" in
    trace)
        trace_decision "$2"
        ;;
    confidence)
        confidence_distribution
        ;;
    assess)
        self_assessment
        ;;
    summary)
        summary
        ;;
    all)
        trace_decision "latest"
        confidence_distribution
        self_assessment
        summary
        ;;
    *)
        echo "Usage: $0 {trace EVENT|confidence|assess|summary|all}"
        echo ""
        echo "V4.0 Decision Explainer Commands:"
        echo "  trace EVENT     - Explain why this decision was made"
        echo "  confidence      - Show decision confidence distribution"
        echo "  assess          - System self-assessment"
        echo "  summary         - TL;DR one-line status"
        echo "  all             - Full explanation report"
        ;;
esac