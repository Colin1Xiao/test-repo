#!/bin/bash
# OpenClaw 每日运行报告（增强版）
# 新增：趋势对比、Shadow Mode 评估、静默异常

REPORT_DIR="${HOME}/.openclaw/workspace/reports"
mkdir -p "$REPORT_DIR"

TODAY=$(date +%Y-%m-%d)
YESTERDAY=$(date -v-1d +%Y-%m-%d 2>/dev/null || date -d "yesterday" +%Y-%m-%d 2>/dev/null || echo "")

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║           OpenClaw 每日运行报告（增强版）                  ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "**日期**: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# 使用 node 生成报告
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
const recovery = readJson('.openclaw/workspace/recovery-history.json');
const predictive = readJson('.openclaw/workspace/predictive-log.json');
const budget = readJson('.openclaw/workspace/error-budget.json');
const config = readJson('.openclaw/workspace/predictive-config.json');
const silentAnomalies = readJson('.openclaw/workspace/silent-anomalies.json');

// ========== 系统健康 ==========
console.log('## 📊 系统健康');
console.log('');
const currentStatus = health?.overall?.status || 'unknown';
const statusEmoji = currentStatus === 'healthy' ? '🟢' : currentStatus === 'degraded' ? '🟡' : '🔴';
console.log(`| 指标 | 值 |`);
console.log(`|------|-----|`);
console.log(`| 当前状态 | ${statusEmoji} ${currentStatus} |`);
console.log(`| degraded 次数 | ${budget?.current?.degraded || 0} |`);
console.log(`| critical 次数 | ${budget?.current?.critical || 0} |`);
console.log('');

// ========== 恢复系统 ==========
console.log('## 🔧 恢复系统');
console.log('');
const recoveryStats = recovery?.statistics || {};
const gatewayStats = recoveryStats.gateway_stopped || {};
const recoveryCount = gatewayStats.totalAttempts || 0;
const successCount = gatewayStats.successCount || 0;
const failureCount = gatewayStats.failureCount || 0;
const successRate = gatewayStats.successRate || 0;

console.log(`| 指标 | 值 |`);
console.log(`|------|-----|`);
console.log(`| 自动恢复触发 | ${recoveryCount} |`);
console.log(`| 成功次数 | ${successCount} |`);
console.log(`| 失败次数 | ${failureCount} |`);
console.log(`| 成功率 | ${successRate}% |`);
console.log('');

// ========== 预测系统（含 Shadow Mode 评估）==========
console.log('## 🔮 预测系统');
console.log('');
const predStats = predictive?.statistics || {};
const predCount = predStats.totalPredictions || 0;
const truePos = predStats.truePositives || 0;
const falsePos = predStats.falsePositives || 0;
const accuracy = predStats.accuracy || 0;
const shadowMode = config?.features?.predictiveEngine?.shadowMode ? '✅ 启用' : '❌ 禁用';

console.log(`| 指标 | 值 |`);
console.log(`|------|-----|`);
console.log(`| 预测触发 | ${predCount} |`);
console.log(`| 命中（成功避免） | ${truePos} |`);
console.log(`| 误判 | ${falsePos} |`);
console.log(`| 准确率 | ${accuracy}% |`);
console.log(`| Shadow Mode | ${shadowMode} |`);
console.log('');

// Shadow Mode 结论输出
if (config?.features?.predictiveEngine?.shadowMode && predCount > 0) {
    console.log('### 🔮 预测评估');
    console.log('');
    
    const actualShouldTrigger = truePos;  // 实际应该触发的
    const overTrigger = predCount - actualShouldTrigger;  // 过度触发
    
    console.log(`| 指标 | 值 |`);
    console.log(`|------|-----|`);
    console.log(`| 触发次数 | ${predCount} |`);
    console.log(`| 实际应触发 | ${actualShouldTrigger} |`);
    console.log(`| 过度触发 | ${overTrigger} |`);
    console.log(`| 准确率 | ${accuracy}% |`);
    console.log('');
    
    // 结论
    console.log('📌 **结论**:');
    if (accuracy >= 80) {
        console.log('- ✅ 预测模型表现优秀，可考虑开启执行模式');
    } else if (accuracy >= 60) {
        console.log('- ⚠️ 预测模型表现中等，建议继续 Shadow Mode 观察');
        console.log('- 💡 建议: 提高置信度阈值，减少误判');
    } else {
        console.log('- ❌ 预测模型表现较差，不建议开启执行模式');
        console.log('- 💡 建议: 调整参数或增加训练数据');
    }
    console.log('');
}

// ========== 错误预算 ==========
console.log('## ⚠️ 错误预算');
console.log('');
const budgetDaily = budget?.budget?.daily || {};
const budgetCurrent = budget?.current || {};

console.log('| 指标 | 今日 | 预算 | 状态 |');
console.log('|------|------|------|------|');

const criticalToday = budgetCurrent.critical || 0;
const criticalBudget = budgetDaily.critical || 0;
const criticalStatus = criticalToday >= criticalBudget ? '❌ 超支' : '✅ 正常';
console.log(`| Critical | ${criticalToday} | ${criticalBudget} | ${criticalStatus} |`);

const degradedToday = budgetCurrent.degraded || 0;
const degradedBudget = budgetDaily.degraded || 0;
const degradedStatus = degradedToday >= degradedBudget ? '⚠️ 接近上限' : '✅ 正常';
console.log(`| Degraded | ${degradedToday} | ${degradedBudget} | ${degradedStatus} |`);

const falsePredToday = budgetCurrent.falsePredictions || 0;
const falsePredBudget = budgetDaily.falsePredictions || 0;
const falsePredStatus = falsePredToday >= falsePredBudget ? '⚠️ 接近上限' : '✅ 正常';
console.log(`| 误预测 | ${falsePredToday} | ${falsePredBudget} | ${falsePredStatus} |`);
console.log('');

// ========== 静默异常 ==========
console.log('## 📒 静默异常');
console.log('');
const silentStats = silentAnomalies?.statistics || {};
console.log(`| 类型 | 次数 | 说明 |`);
console.log(`|------|------|------|`);
console.log(`| Degraded 未触发恢复 | ${silentStats.degradedNoRecovery || 0} | 系统自恢复，无需干预 |`);
console.log(`| Critical 自恢复 | ${silentStats.criticalSelfRecovered || 0} | 短暂异常后自动恢复 |`);
console.log(`| 瞬态问题 | ${silentStats.transientIssues || 0} | 快速恢复，无需干预 |`);
console.log('');

// ========== 建议 ==========
console.log('## 💡 建议');
console.log('');
let hasRecommendations = false;
if (predCount > 0 && accuracy < 60) {
    console.log('- ⚠️ 预测准确率较低，建议继续 Shadow Mode 观察');
    hasRecommendations = true;
}
if (recoveryCount > 5 && successRate < 80) {
    console.log('- ⚠️ 恢复成功率较低，建议检查策略配置');
    hasRecommendations = true;
}
if (criticalToday > 0) {
    console.log('- 🔴 出现 Critical 事件，需要关注');
    hasRecommendations = true;
}
const silentTotal = (silentStats.degradedNoRecovery || 0) + (silentStats.criticalSelfRecovered || 0);
if (silentTotal > 3) {
    console.log('- ℹ️ 系统自恢复能力良好，多数异常无需干预');
    hasRecommendations = true;
}
if (!hasRecommendations) {
    console.log('- ✅ 系统运行正常，无需特殊关注');
}
console.log('');

// ========== Shadow Mode 说明 ==========
if (config?.features?.predictiveEngine?.shadowMode) {
    console.log('---');
    console.log('ℹ️  **Shadow Mode 已启用**: 预测系统只记录不执行，用于验证准确性');
    console.log('');
}
NODEEOF

echo ""
echo "────────────────────────────────────────────────────────────"
echo "📄 详细报告目录: $REPORT_DIR"
echo "────────────────────────────────────────────────────────────"