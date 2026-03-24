#!/bin/bash
# OpenClaw 预测统计报告

PREDICTIVE_LOG="${HOME}/.openclaw/workspace/predictive-log.json"

if [ ! -f "$PREDICTIVE_LOG" ]; then
    echo "暂无预测数据"
    exit 0
fi

node << 'EOF'
const fs = require('fs');
const path = require('path');

const logFile = path.join(process.env.HOME, '.openclaw/workspace/predictive-log.json');
const data = JSON.parse(fs.readFileSync(logFile, 'utf8'));

console.log('');
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║           OpenClaw 预测引擎统计报告 V3.5                   ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');

const stats = data.statistics;

if (stats.totalPredictions > 0) {
    console.log('📊 预测统计:');
    console.log(`   总预测次数: ${stats.totalPredictions}`);
    console.log(`   命中（成功避免）: ${stats.truePositives}`);
    console.log(`   误判: ${stats.falsePositives}`);
    console.log(`   准确率: ${stats.accuracy}%`);
    console.log('');

    // 准确率可视化
    const bar = '█'.repeat(Math.floor(stats.accuracy / 10)) + '░'.repeat(10 - Math.floor(stats.accuracy / 10));
    console.log(`   准确率: [${bar}] ${stats.accuracy}%`);
    console.log('');
} else {
    console.log('ℹ️  暂无预测数据');
    console.log('   系统运行正常，尚未触发预测性恢复');
    console.log('');
}

// 最近预测
if (data.predictions.length > 0) {
    console.log('🔮 最近预测:');
    const recent = data.predictions.slice(-5).reverse();
    for (const pred of recent) {
        const time = new Date(pred.timestamp).toLocaleString('zh-CN');
        const icon = pred.result === 'success' ? '✅' : pred.result === 'failed' ? '❌' : '⏳';
        console.log(`   ${icon} [${time}] 置信度: ${(pred.confidence * 100).toFixed(0)}% - ${pred.result || '进行中'}`);
    }
    console.log('');
}

// 状态历史
if (data.stateHistory.length > 0) {
    console.log('📈 最近状态:');
    const recentStates = data.stateHistory.slice(-5).reverse();
    for (const state of recentStates) {
        const time = new Date(state.timestamp * 1000).toLocaleTimeString('zh-CN');
        const icon = state.status === 'healthy' ? '🟢' : state.status === 'degraded' ? '🟡' : '🔴';
        console.log(`   ${icon} [${time}] ${state.status}`);
    }
    console.log('');
}

// 配置
console.log('⚙️  配置:');
console.log(`   连续次数阈值: ${data.config.window}`);
console.log(`   持续时间阈值: ${data.config.durationThresholdSeconds}s`);
console.log(`   置信度阈值: ${(data.config.confidenceThreshold * 100).toFixed(0)}%`);
console.log(`   预测冷却时间: ${data.config.cooldownSeconds}s`);
console.log(`   每小时上限: ${data.config.maxPredictivePerHour}`);
console.log('');

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  预测引擎: ✅ 已启用                                    ║');
console.log('║  最后更新: ' + (data.lastUpdated || 'N/A') + '                           ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');
EOF