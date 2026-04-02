#!/usr/bin/env node
/**
 * OCNMPS 路由验证脚本
 * 
 * 验证路由系统是否真正工作：
 * 1. 模拟 100 条消息
 * 2. 检查灰度命中率
 * 3. 验证模型切换
 * 4. 输出审计报告
 */

import { createOCNMPSRouter } from './ocnmps_router';

/** 测试用例 */
const testCases = [
  { text: 'Fix the import error in src/index.ts', expectedIntent: 'CODE' },
  { text: '为什么这个函数返回 null？', expectedIntent: 'REASON' },
  { text: 'Explain the architecture of this system in detail with examples and diagrams', expectedIntent: 'LONG' },
  { text: '帮我写一个 Python 脚本', expectedIntent: 'CN' },
  { text: 'What is the weather today?', expectedIntent: 'MAIN' },
];

async function runVerification() {
  console.log('='.repeat(60));
  console.log('🧪 OCNMPS 路由验证');
  console.log('='.repeat(60));
  console.log('');

  const router = createOCNMPSRouter({
    grayRatio: 0.05, // 5% 灰度
  });

  // 1. 模拟 100 条消息
  console.log('📊 模拟 100 条消息路由...');
  const results: any[] = [];
  
  for (let i = 0; i < 100; i++) {
    const testCase = testCases[i % testCases.length];
    const result = await router.route({
      text: `[${i}] ${testCase.text}`,
      sessionId: `test_session_${i % 10}`,
      defaultModel: 'modelstudio/qwen3.5-plus',
    });
    results.push(result);
  }

  // 2. 统计
  const total = results.length;
  const grayHits = results.filter(r => r.grayHit).length;
  const grayHitRate = (grayHits / total * 100).toFixed(2);
  
  const byIntent: Record<string, number> = {};
  const byModel: Record<string, number> = {};
  
  for (const r of results) {
    byIntent[r.intent] = (byIntent[r.intent] ?? 0) + 1;
    byModel[r.finalModel] = (byModel[r.finalModel] ?? 0) + 1;
  }

  // 3. 验证路由幻觉
  console.log('');
  console.log('📋 验证结果');
  console.log('-'.repeat(60));
  
  // 检查 1: 灰度命中率是否在预期范围内
  const expectedGrayRate = 5; // 5%
  const grayRateDiff = Math.abs(parseFloat(grayHitRate) - expectedGrayRate);
  
  if (grayRateDiff < 3) {
    console.log(`✅ 灰度命中率：${grayHitRate}% (预期 ~${expectedGrayRate}%)`);
  } else {
    console.log(`❌ 灰度命中率异常：${grayHitRate}% (预期 ~${expectedGrayRate}%)`);
  }

  // 检查 2: 灰度命中时模型是否切换
  let modelSwitchErrors = 0;
  for (const r of results) {
    if (r.grayHit && r.recommendedModel !== r.finalModel) {
      modelSwitchErrors++;
    }
  }
  
  if (modelSwitchErrors === 0) {
    console.log(`✅ 灰度命中模型切换：${grayHits}/${grayHits} 正确`);
  } else {
    console.log(`❌ 灰度命中模型切换错误：${modelSwitchErrors}/${grayHits}`);
  }

  // 检查 3: 意图识别分布
  console.log('');
  console.log('🧠 意图识别分布:');
  for (const [intent, count] of Object.entries(byIntent)) {
    const pct = (count / total * 100).toFixed(1);
    console.log(`  ${intent}: ${count} (${pct}%)`);
  }

  // 检查 4: 模型调用分布
  console.log('');
  console.log('🤖 模型调用分布:');
  for (const [model, count] of Object.entries(byModel)) {
    const pct = (count / total * 100).toFixed(1);
    console.log(`  ${model}: ${count} (${pct}%)`);
  }

  // 检查 5: 路由验证
  console.log('');
  console.log('✅ 路由验证抽样:');
  const sampleResults = results.slice(0, 5);
  for (const r of sampleResults) {
    const verification = router.verifyRouting({
      intent: r.intent,
      recommendedModel: r.recommendedModel,
      finalModel: r.finalModel,
      grayHit: r.grayHit,
    });
    
    const icon = verification.ok ? '✅' : '❌';
    console.log(`  ${icon} ${r.routingTaskId}: ${verification.summary}`);
  }

  // 4. 审计报告
  console.log('');
  console.log('='.repeat(60));
  console.log('📊 审计报告');
  console.log('='.repeat(60));
  console.log(`总消息数：${total}`);
  console.log(`灰度命中：${grayHits} (${grayHitRate}%)`);
  console.log(`模型切换错误：${modelSwitchErrors}`);
  console.log(`路由幻觉检测：${modelSwitchErrors === 0 ? '✅ 无' : `❌ ${modelSwitchErrors} 例`}`);
  console.log('');

  // 5. 路由历史
  const history = router.getRoutingHistory({ limit: 10 });
  console.log('📜 最近 10 条路由记录:');
  for (const h of history) {
    const grayIcon = h.grayHit ? '🎯' : '⏭️';
    console.log(`  ${grayIcon} ${h.intent} → ${h.finalModel}`);
  }

  // 6. 最终判定
  console.log('');
  console.log('='.repeat(60));
  if (modelSwitchErrors === 0 && grayRateDiff < 3) {
    console.log('✅ 路由系统验证通过 - 无幻觉，灰度正常');
  } else {
    console.log('❌ 路由系统存在问题 - 需要修复');
  }
  console.log('='.repeat(60));
}

// 运行验证
runVerification().catch(console.error);
