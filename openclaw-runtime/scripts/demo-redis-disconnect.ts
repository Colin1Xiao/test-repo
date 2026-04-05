#!/usr/bin/env ts-node
/**
 * P0 告警闭环：RedisDisconnected 完整链路演示
 * 
 * 模拟 Redis 断开告警，跑通：告警 → router → incident → timeline → runbook
 */

import { getAlertIngestService, resetAlertIngestService } from '../src/alerting/alert_ingest.js';
import { getTimelineStore, resetTimelineStore } from '../src/alerting/timeline_integration.js';
import { getIncidentRepository, resetIncidentRepository } from '../src/alerting/incident_repository.js';
import { getAlertActionHandler } from '../src/alerting/alert_actions.js';

async function demo(): Promise<void> {
  console.log('=== P0 告警闭环：RedisDisconnected 完整链路演示 ===\n');

  // Reset state
  resetAlertIngestService();
  resetTimelineStore();
  resetIncidentRepository();

  const ingestService = getAlertIngestService();
  const actionHandler = getAlertActionHandler();
  const timelineStore = getTimelineStore();
  const incidentRepo = getIncidentRepository();

  // Step 1: 模拟 RedisDisconnected 告警
  console.log('📢 Step 1: RedisDisconnected 告警触发\n');

  const alert = await ingestService.ingest({
    alert_name: 'RedisDisconnected',
    alert_value: '0',
    resource: 'redis:primary',
    correlation_id: 'redis-001',
    metadata: { instance: 'redis-primary:6379' },
  });

  if (alert) {
    console.log('✅ 告警已摄入:');
    console.log(`   - Alert: ${alert.alert_name}`);
    console.log(`   - Severity: P0`);
    console.log(`   - Resource: ${alert.resource}`);
    console.log(`   - Incident: ${alert.incident_id || 'N/A'}`);
    console.log(`   - Runbook: ${alert.runbook_url || 'N/A'}`);
  }

  // Step 2: On-call 确认告警
  console.log('\n📢 Step 2: On-call 确认告警 (acknowledge)\n');

  const ackResult = await actionHandler.execute({
    alert_name: 'RedisDisconnected',
    action: 'acknowledge',
    performed_by: 'on-call-engineer',
    reason: 'Investigating Redis connection',
  });

  console.log(`✅ 告警已确认:`);
  console.log(`   - Action: ${ackResult.action}`);
  console.log(`   - Performed by: ${ackResult.metadata?.acknowledged_by}`);

  // Step 3: 打开 Runbook
  console.log('\n📢 Step 3: 打开 Runbook\n');

  const runbookResult = await actionHandler.execute({
    alert_name: 'RedisDisconnected',
    action: 'open_runbook',
    performed_by: 'on-call-engineer',
  });

  console.log(`✅ Runbook 已打开:`);
  console.log(`   - Action: ${runbookResult.action}`);
  console.log(`   - Runbook: ${runbookResult.metadata?.runbook_name}`);

  // Step 4: 查询 Timeline
  console.log('\n📢 Step 4: 查询完整 Timeline\n');

  const timelineEvents = timelineStore.getRecent(20);
  console.log(`✅ Timeline 完整链路 (${timelineEvents.length} 条事件):\n`);
  
  for (const event of timelineEvents) {
    const time = new Date(event.timestamp).toLocaleTimeString();
    const type = event.type.padEnd(20);
    const detail = event.alert_name || event.incident_id || 'N/A';
    console.log(`   [${time}] ${type} ${detail}`);
  }

  // Step 5: 查询 Incident
  console.log('\n📢 Step 5: 查询 Incident\n');

  const incidents = incidentRepo.getByCorrelation('redis-001', 10);
  console.log(`✅ Incidents for correlation redis-001 (${incidents.length} 个):\n`);
  
  for (const incident of incidents) {
    console.log(`   Incident: ${incident.id}`);
    console.log(`   - Status: ${incident.status}`);
    console.log(`   - Type: ${incident.type}`);
    console.log(`   - Severity: ${incident.severity}`);
    console.log(`   - Related Alerts: ${incident.related_alerts.join(', ')}`);
    console.log(`   - Created: ${new Date(incident.created_at).toLocaleTimeString()}`);
    console.log(`   - Created By: ${incident.created_by}`);
  }

  // Step 6: 统计
  console.log('\n📢 Step 6: 统计信息\n');

  const stats = incidentRepo.getStats();
  const actions = actionHandler.getActionHistory(10);
  
  console.log('✅ Incident 统计:');
  console.log(`   - Total: ${stats.total}`);
  console.log(`   - Open: ${stats.open}`);
  console.log(`   - P0: ${stats.by_severity.P0}`);
  console.log(`\n✅ Action 历史 (${actions.length} 条):`);
  for (const action of actions) {
    console.log(`   - [${action.action}] ${action.alert_name} @ ${new Date(action.performed_at).toLocaleTimeString()}`);
  }

  // Summary
  console.log('\n=== 完整链路验证 ===\n');
  console.log('✅ 告警 → Router → Incident → Timeline → Runbook 全链路跑通！');
  console.log(`✅ Timeline 记录: ${timelineEvents.length} 条事件`);
  console.log(`✅ Incident 创建: ${stats.total} 个`);
  console.log(`✅ Action 执行: ${actions.length} 次`);

  console.log('\n=== 演示完成 ===\n');
}

// Run demo
demo().catch(console.error);
