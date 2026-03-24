#!/bin/bash
# OpenClaw 系统概览 - 完整状态报告
# 整合所有层级的状态

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║              OpenClaw 智能自愈系统概览 V3.9                       ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# 使用 node 生成完整报告
node << 'NODEEOF'
const fs = require('fs');
const path = require('path');

const home = process.env.HOME;

const readJson = (file) => {
    try {
        return JSON.parse(fs.readFileSync(path.join(home, file), 'utf8'));
    } catch {
        return null;
    }
};

const health = readJson('.openclaw/workspace/openclaw-health-check.json');
const control = readJson('.openclaw/workspace/control-config.json');
const arbiter = readJson('.openclaw/workspace/decision-arbiter.json');
const predictive = readJson('.openclaw/workspace/predictive-log.json');
const budget = readJson('.openclaw/workspace/error-budget.json');

// ========== 系统健康 ==========
console.log('## 📊 系统健康');
console.log('');
const status = health?.overall?.status || 'unknown';
const emoji = status === 'healthy' ? '🟢' : status === 'degraded' ? '🟡' : '🔴';
console.log(`当前状态: ${emoji} ${status}`);
console.log('');

// ========== 系统架构 ==========
console.log('## 🏗️ 系统架构');
console.log('');
console.log('| 层级 | 版本 | 状态 | 关键指标 |');
console.log('|------|------|------|----------|');

// 感知层
const healthComponents = health?.components || {};
const gatewayStatus = healthComponents.gateway?.status || 'unknown';
const telegramStatus = healthComponents.telegram?.status || 'unknown';
const memoryStatus = healthComponents.memorySearch?.status || 'unknown';
console.log(`| 感知层 | V1.5 | ✅ | Gateway: ${gatewayStatus}, Telegram: ${telegramStatus} |`);

// 决策层
const predStats = predictive?.statistics || {};
const predMode = control?.predictiveExecution?.mode || 'shadow';
console.log(`| 决策层 | V3.0 | ✅ | 策略数: 4, 学习: ${predStats.totalPredictions || 0} 条 |`);

// 执行层
const controlStats = control?.statistics || {};
console.log(`| 执行层 | V3.5 | ✅ | 执行: ${controlStats.recoveryExecuted || 0}, 跳过: ${controlStats.recoverySkipped || 0} |`);

// 控制层
const hysteresis = control?.hysteresis?.enabled ? '✅' : '❌';
const gate = control?.recoveryGate?.enabled ? '✅' : '❌';
const rateLimit = control?.rateLimit ? '✅' : '❌';
console.log(`| 控制层 | V3.6 | ✅ | 迟滞: ${hysteresis}, 门控: ${gate}, 速率: ${rateLimit} |`);

// 仲裁层
const arbiterStats = arbiter?.statistics || {};
const conflictRate = arbiterStats.conflictRate || 0;
console.log(`| 仲裁层 | V3.7 | ✅ | 决策: ${arbiterStats.totalDecisions || 0}, 冲突率: ${conflictRate}% |`);
console.log('');

// ========== 控制状态 ==========
console.log('## ⚙️ 控制状态');
console.log('');

const rateLimitCurrent = control?.rateLimit?.currentHour?.count || 0;
const rateLimitMax = control?.rateLimit?.maxActionsPerHour || 5;
const dayCount = control?.rateLimit?.currentDay?.count || 0;
const dayMax = control?.rateLimit?.maxActionsPerDay || 20;

console.log('| 约束 | 当前 | 上限 | 状态 |');
console.log('|------|------|------|------|');
console.log(`| 小时动作 | ${rateLimitCurrent} | ${rateLimitMax} | ${rateLimitCurrent >= rateLimitMax ? '⚠️ 达限' : '✅ 正常'} |`);
console.log(`| 日动作 | ${dayCount} | ${dayMax} | ${dayCount >= dayMax ? '⚠️ 达限' : '✅ 正常'} |`);

const budgetCurrent = budget?.current || {};
const budgetDaily = budget?.budget?.daily || {};
console.log(`| Critical | ${budgetCurrent.critical || 0} | ${budgetDaily.critical || 1} | ${budgetCurrent.critical >= budgetDaily.critical ? '⚠️ 达限' : '✅ 正常'} |`);
console.log(`| Degraded | ${budgetCurrent.degraded || 0} | ${budgetDaily.degraded || 5} | ${budgetCurrent.degraded >= budgetDaily.degraded ? '⚠️ 达限' : '✅ 正常'} |`);
console.log('');

// ========== 预测模式 ==========
console.log('## 🔮 预测模式');
console.log('');
console.log(`模式: ${predMode === 'hybrid' ? '🔀 Hybrid (灰度执行)' : '👁️ Shadow (仅记录)'}`);
console.log('');
console.log('| 置信度区间 | 行为 |');
console.log('|------------|------|');
console.log(`| ≥ 85% | ✅ 自动执行 |`);
console.log(`| 70-85% | 📝 仅记录 |`);
console.log(`| < 70% | 🚫 忽略 |`);
console.log('');

// ========== 系统克制度 ==========
console.log('## 🎯 系统克制度');
console.log('');

const totalRecovery = (controlStats.recoveryExecuted || 0) + (controlStats.recoverySkipped || 0);
const totalDecisions = (arbiterStats.executed || 0) + (arbiterStats.skipped || 0);

if (totalRecovery > 0 || totalDecisions > 0) {
    const skipRate = totalRecovery > 0 ? Math.round(((controlStats.recoverySkipped || 0) / totalRecovery) * 100) : 0;
    const decisionSkipRate = totalDecisions > 0 ? Math.round(((arbiterStats.skipped || 0) / totalDecisions) * 100) : 0;
    
    console.log('| 指标 | 跳过率 | 评价 |');
    console.log('|------|--------|------|');
    console.log(`| 恢复跳过率 | ${skipRate}% | ${skipRate > 30 ? '✅ 克制' : skipRate > 10 ? '⚠️ 适中' : '❌ 激进'} |`);
    console.log(`| 决策跳过率 | ${decisionSkipRate}% | ${decisionSkipRate > 30 ? '✅ 克制' : decisionSkipRate > 10 ? '⚠️ 适中' : '❌ 激进'} |`);
    console.log('');
} else {
    console.log('ℹ️  暂无足够数据计算克制度');
    console.log('');
}

// ========== 总结 ==========
console.log('## 📌 总结');
console.log('');

if (status !== 'healthy') {
    console.log(`⚠️  系统当前状态: ${status}`);
} else if (conflictRate > 30) {
    console.log('⚠️  决策冲突率较高，建议检查参数一致性');
} else if (rateLimitCurrent >= rateLimitMax) {
    console.log('⚠️  已达到小时动作上限');
} else {
    console.log('✅ 系统运行正常，控制层有效');
}
console.log('');
NODEEOF

echo ""
echo "────────────────────────────────────────────────────────────────────"
echo "详细报告:"
echo "  - 每日报告: ~/.openclaw/workspace/scripts/daily-report.sh"
echo "  - 控制层:   ~/.openclaw/workspace/scripts/control-stats.sh"
echo "  - 仲裁器:   ~/.openclaw/workspace/scripts/decision-arbiter.sh report"
echo "────────────────────────────────────────────────────────────────────"