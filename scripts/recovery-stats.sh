#!/bin/bash
# OpenClaw 智能恢复统计报告

HISTORY_FILE="${HOME}/.openclaw/workspace/recovery-history.json"

if [ ! -f "$HISTORY_FILE" ]; then
    echo "暂无恢复历史数据"
    exit 0
fi

# 使用 node 生成美观的报告
node << 'EOF'
const fs = require('fs');
const path = require('path');

const historyFile = path.join(process.env.HOME, '.openclaw/workspace/recovery-history.json');
const data = JSON.parse(fs.readFileSync(historyFile, 'utf8'));

console.log('');
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║           OpenClaw 智能恢复系统统计报告 V3.0               ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');

const events = ['gateway_stopped', 'gateway_port_conflict', 'telegram_disconnected', 'memory_model_missing'];
const eventNames = {
    'gateway_stopped': 'Gateway 停止',
    'gateway_port_conflict': 'Gateway 端口冲突',
    'telegram_disconnected': 'Telegram 断开',
    'memory_model_missing': 'Memory 模型缺失'
};

let hasData = false;

for (const event of events) {
    const stats = data.statistics[event];
    if (stats.totalAttempts > 0) {
        hasData = true;
        console.log(`📊 ${eventNames[event]}`);
        console.log(`   总尝试: ${stats.totalAttempts} 次`);
        console.log(`   成功: ${stats.successCount} 次`);
        console.log(`   失败: ${stats.failureCount} 次`);
        console.log(`   成功率: ${stats.successRate}%`);
        console.log(`   最优策略: ${stats.bestStrategy || '待定'}`);
        
        // 策略详情
        if (Object.keys(stats.strategyStats).length > 0) {
            console.log('   策略表现:');
            for (const [sid, sstats] of Object.entries(stats.strategyStats)) {
                const rate = Math.round((sstats.success / sstats.attempts) * 100);
                const bar = '█'.repeat(Math.floor(rate / 10)) + '░'.repeat(10 - Math.floor(rate / 10));
                console.log(`     - ${sid}: ${bar} ${rate}% (${sstats.success}/${sstats.attempts})`);
            }
        }
        console.log('');
    }
}

if (!hasData) {
    console.log('ℹ️  暂无恢复历史数据');
    console.log('   系统运行正常，尚未触发自动恢复');
    console.log('');
}

// 最近事件
if (data.events.length > 0) {
    console.log('📋 最近恢复事件:');
    const recent = data.events.slice(-5).reverse();
    for (const evt of recent) {
        const time = new Date(evt.timestamp).toLocaleString('zh-CN');
        const icon = evt.result === 'success' ? '✅' : '❌';
        console.log(`   ${icon} [${time}] ${eventNames[evt.event] || evt.event} - ${evt.strategy} (${evt.duration}s)`);
    }
    console.log('');
}

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  学习系统: ' + (data.learning.enabled ? '✅ 已启用' : '❌ 已禁用') + '                                    ║');
console.log('║  最后更新: ' + (data.lastUpdated || 'N/A') + '                           ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');
EOF
