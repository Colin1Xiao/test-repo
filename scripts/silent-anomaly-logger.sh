#!/bin/bash
# OpenClaw 静默异常记录器
# 记录：系统异常但未触发恢复的情况

STATUS_FILE="${HOME}/.openclaw/workspace/openclaw-health-check.json"
SILENT_FILE="${HOME}/.openclaw/workspace/silent-anomalies.json"
RECOVERY_LOG="${HOME}/.openclaw/workspace/recovery-log.json"
LOG_FILE="${HOME}/.openclaw/workspace/logs/silent-anomalies.log"

mkdir -p "$(dirname "$LOG_FILE")"

# 读取当前状态
current_status=$(node -e "const data = require('fs').readFileSync('$STATUS_FILE', 'utf8'); const json = JSON.parse(data); console.log(json.overall.status || 'unknown');" 2>/dev/null || echo "unknown")

# 读取上次恢复记录
last_recovery=$(node -e "const data = require('fs').readFileSync('$RECOVERY_LOG', 'utf8'); const json = JSON.parse(data); console.log(json.currentSession?.lastResult || 'none');" 2>/dev/null || echo "none")

# 检测静默异常
timestamp=$(date +%s)
today=$(date +%Y-%m-%d)

# 使用 node 更新静默异常记录
node << EOF
const fs = require('fs');
const silentFile = '$SILENT_FILE';
const data = JSON.parse(fs.readFileSync(silentFile, 'utf8'));

const currentStatus = '$current_status';
const lastRecovery = '$last_recovery';
const timestamp = $timestamp;
const today = '$today';

// 检测逻辑
let anomalyType = null;

// 1. Degraded 但没有触发恢复
if (currentStatus === 'degraded' && lastRecovery !== 'success') {
    anomalyType = 'degradedNoRecovery';
}

// 2. Critical 但自动恢复（这里简化，实际需要更复杂逻辑）
// 暂时跳过

if (anomalyType) {
    // 记录异常
    data.anomalies.push({
        timestamp: new Date().toISOString(),
        type: anomalyType,
        status: currentStatus,
        recoveryTriggered: false
    });
    
    // 更新统计
    data.statistics.totalAnomalies++;
    if (anomalyType === 'degradedNoRecovery') {
        data.statistics.degradedNoRecovery++;
    } else if (anomalyType === 'criticalSelfRecovered') {
        data.statistics.criticalSelfRecovered++;
    } else if (anomalyType === 'transientIssues') {
        data.statistics.transientIssues++;
    }
    
    // 更新每日统计
    if (!data.dailyStats[today]) {
        data.dailyStats[today] = { degradedNoRecovery: 0, criticalSelfRecovered: 0, transientIssues: 0 };
    }
    if (data.dailyStats[today][anomalyType] !== undefined) {
        data.dailyStats[today][anomalyType]++;
    }
    
    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(silentFile, JSON.stringify(data, null, 2));
    
    // 写入日志
    const logLine = '[' + new Date().toISOString() + '] ' + anomalyType + ' (status=' + currentStatus + ', recoveryTriggered=false)\n';
    fs.appendFileSync('$LOG_FILE', logLine);
}
EOF