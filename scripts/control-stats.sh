#!/bin/bash
# OpenClaw 控制层统计报告
# V3.6: 观察"做了什么"和"没做什么"

CONTROL_CONFIG="${HOME}/.openclaw/workspace/control-config.json"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║           OpenClaw 控制层统计报告 V3.6                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

node << 'NODEEOF'
const fs = require('fs');
const path = require('path');

const home = process.env.HOME;
const configFile = path.join(home, '.openclaw/workspace/control-config.json');

let data;
try {
    data = JSON.parse(fs.readFileSync(configFile, 'utf8'));
} catch {
    console.log('⚠️  控制层配置不存在');
    process.exit(0);
}

// ========== 动作统计 ==========
console.log('## 📊 动作统计');
console.log('');
const stats = data.statistics || {};
console.log('| 类型 | 次数 | 说明 |');
console.log('|------|------|------|');
console.log(`| ✅ 恢复执行 | ${stats.recoveryExecuted || 0} | 实际执行的恢复 |`);
console.log(`| ⏭️ 恢复跳过 | ${stats.recoverySkipped || 0} | 被门控阻止的恢复 |`);
console.log(`| 🔮 预测触发 | ${stats.predictiveTriggered || 0} | 实际执行的预测 |`);
console.log(`| 📝 预测跳过 | ${stats.predictiveSkipped || 0} | 被门控阻止的预测 |`);
console.log(`| 🚫 速率限制 | ${stats.rateLimitHits || 0} | 被速率限制阻止 |`);
console.log('');

// ========== 跳过率计算 ==========
const totalRecovery = (stats.recoveryExecuted || 0) + (stats.recoverySkipped || 0);
const totalPredictive = (stats.predictiveTriggered || 0) + (stats.predictiveSkipped || 0);

if (totalRecovery > 0) {
    const skipRate = Math.round(((stats.recoverySkipped || 0) / totalRecovery) * 100);
    console.log('## 🎯 系统克制度');
    console.log('');
    console.log(`| 指标 | 值 | 评价 |`);
    console.log(`|------|-----|------|`);
    console.log(`| 恢复跳过率 | ${skipRate}% | ${skipRate > 30 ? '✅ 克制' : skipRate > 10 ? '⚠️ 适中' : '❌ 激进'} |`);
    
    if (totalPredictive > 0) {
        const predSkipRate = Math.round(((stats.predictiveSkipped || 0) / totalPredictive) * 100);
        console.log(`| 预测跳过率 | ${predSkipRate}% | ${predSkipRate > 50 ? '✅ 克制' : predSkipRate > 20 ? '⚠️ 适中' : '❌ 激进'} |`);
    }
    console.log('');
}

// ========== 速率限制状态 ==========
console.log('## ⏱️ 速率限制');
console.log('');
const rateLimit = data.rateLimit || {};
console.log(`| 指标 | 当前 | 上限 |`);
console.log(`|------|------|------|`);
console.log(`| 小时动作 | ${rateLimit.currentHour?.count || 0} | ${rateLimit.maxActionsPerHour || 5} |`);
console.log(`| 天动作 | ${rateLimit.currentDay?.count || 0} | ${rateLimit.maxActionsPerDay || 20} |`);
console.log('');

// ========== 最近动作日志 ==========
if (data.actionLog && data.actionLog.length > 0) {
    console.log('## 📋 最近动作');
    console.log('');
    console.log('| 时间 | 类型 | 原因 | 详情 |');
    console.log('|------|------|------|------|');
    
    const recent = data.actionLog.slice(-10).reverse();
    for (const action of recent) {
        const time = new Date(action.timestamp).toLocaleTimeString('zh-CN');
        const icon = action.type.includes('executed') || action.type.includes('triggered') ? '✅' : '⏭️';
        console.log(`| ${time} | ${icon} ${action.type} | ${action.reason} | ${action.details || '-'} |`);
    }
    console.log('');
}

// ========== 配置状态 ==========
console.log('## ⚙️ 控制层配置');
console.log('');

const hysteresis = data.hysteresis || {};
const predExec = data.predictiveExecution || {};

console.log('| 模块 | 状态 | 配置 |');
console.log('|------|------|------|');
console.log(`| 迟滞控制 | ${hysteresis.enabled ? '✅' : '❌'} | 稳定阈值: ${hysteresis.stableThresholdSeconds}s |`);
console.log(`| 恢复门控 | ${data.recoveryGate?.enabled ? '✅' : '❌'} | 最小持续: 10s |`);
console.log(`| 预测执行模式 | ${predExec.mode || 'shadow'} | 执行阈值: ${(predExec.rules?.execute?.minConfidence || 0.85) * 100}% |`);
console.log(`| 速率限制 | ✅ | ${rateLimit.maxActionsPerHour}/小时, ${rateLimit.maxActionsPerDay}/天 |`);
console.log('');

// ========== 系统评估 ==========
console.log('## 🧠 系统评估');
console.log('');

const skipRateRecovery = totalRecovery > 0 ? Math.round(((stats.recoverySkipped || 0) / totalRecovery) * 100) : 0;
const rateLimitHit = stats.rateLimitHits || 0;

if (totalRecovery === 0 && totalPredictive === 0) {
    console.log('ℹ️  系统运行正常，尚未触发控制层');
} else if (skipRateRecovery > 30 && rateLimitHit === 0) {
    console.log('✅ 系统表现克制，多数不必要操作被阻止');
} else if (skipRateRecovery < 10) {
    console.log('⚠️  系统较为激进，建议观察是否真的需要这么多操作');
} else if (rateLimitHit > 0) {
    console.log('⚠️  触发速率限制，系统操作频率较高');
} else {
    console.log('✅ 系统表现正常');
}
console.log('');
NODEEOF

echo ""
echo "────────────────────────────────────────────────────────────"