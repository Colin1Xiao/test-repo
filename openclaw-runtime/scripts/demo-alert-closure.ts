#!/usr/bin/env ts-node
/**
 * P0 告警闭环演示脚本
 * 
 * 演示完整链路：告警 → router → incident → timeline → runbook
 */

import { getAlertIngestService, resetAlertIngestService } from '../src/alerting/alert_ingest.js';
import { getTimelineStore, resetTimelineStore } from '../src/alerting/timeline_integration.js';
import { getIncidentRepository, resetIncidentRepository } from '../src/alerting/incident_repository.js';
import { getAlertRouter } from '../src/alerting/alert_router.js';

async function demo(): Promise<void> {
  console.log('=== P0 告警闭环演示 ===\n');

  // Reset state
  resetAlertIngestService();
  resetTimelineStore();
  resetIncidentRepository();

  const ingestService = getAlertIngestService();
  const timelineStore = getTimelineStore();
  const incidentRepo = getIncidentRepository();
  const router = getAlertRouter();

  // Demo 1: RedisDisconnected 告警
  console.log('📢 场景 1: RedisDisconnected 告警触发\n');

  const alert1 = await ingestService.ingest({
    alert_name: 'RedisDisconnected',
    alert_value: '0',
    resource: 'redis:primary',
    correlation_id: 'redis-001',
    metadata: { instance: 'redis-primary:6379' },
  });

  if (alert1) {
    console.log('✅ 告警已摄入:');
    console.log(`   - Alert: ${alert1.alert_name}`);
    console.log(`   - Severity: ${alert1.alert_name === 'RedisDisconnected' ? 'P0' : 'Unknown'}`);
    console.log(`   - Resource: ${alert1.resource}`);
    console.log(`   - Incident: ${alert1.incident_id || 'N/A'}`);
    console.log(`   - Runbook: ${alert1.runbook_url || 'N/A'}`);
  }

  // Demo 2: 关联告警 (LockAcquireFailureSpike)
  console.log('\n📢 场景 2: 关联告警触发 (应自动挂接到同一 incident)\n');

  const alert2 = await ingestService.ingest({
    alert_name: 'LockAcquireFailureSpike',
    alert_value: '15',
    resource: 'redis:primary',
    correlation_id: 'redis-001',
    metadata: { lock_name: 'approval:lock' },
  });

  if (alert2) {
    console.log('✅ 关联告警已摄入:');
    console.log(`   - Alert: ${alert2.alert_name}`);
    console.log(`   - Incident: ${alert2.incident_id || 'N/A'}`);
    console.log(`   - 应与前一个告警共享同一 incident`);
  }

  // Demo 3: 重复告警 (应被抑制)
  console.log('\n📢 场景 3: 重复告警 (应在 5 分钟窗口内被抑制)\n');

  const alert3 = await ingestService.ingest({
    alert_name: 'RedisDisconnected',
    alert_value: '0',
    resource: 'redis:primary',
    correlation_id: 'redis-001',
  });

  if (alert3 === null) {
    console.log('✅ 重复告警已被抑制 (5 分钟窗口内)');
  } else {
    console.log('⚠️  重复告警未被抑制');
  }

  // Demo 4: 查询 Timeline
  console.log('\n📢 场景 4: 查询 Timeline\n');

  const timelineEvents = timelineStore.getByCorrelation('redis-001', 10);
  console.log(`✅ Timeline 事件 (${timelineEvents.length} 条):`);
  for (const event of timelineEvents) {
    console.log(`   - [${event.type}] ${event.alert_name || event.incident_id} @ ${new Date(event.timestamp).toLocaleTimeString()}`);
  }

  // Demo 5: 查询 Incident
  console.log('\n📢 场景 5: 查询 Incident\n');

  const incidents = incidentRepo.getByCorrelation('redis-001', 10);
  console.log(`✅ Incidents (${incidents.length} 个):`);
  for (const incident of incidents) {
    console.log(`   - ${incident.id} (${incident.status})`);
    console.log(`     Type: ${incident.type}`);
    console.log(`     Severity: ${incident.severity}`);
    console.log(`     Related Alerts: ${incident.related_alerts.join(', ')}`);
  }

  // Demo 6: 统计
  console.log('\n📢 场景 6: 统计信息\n');

  const stats = incidentRepo.getStats();
  console.log('✅ Incident 统计:');
  console.log(`   - Total: ${stats.total}`);
  console.log(`   - Open: ${stats.open}`);
  console.log(`   - P0: ${stats.by_severity.P0}`);

  console.log('\n=== 演示完成 ===\n');
}

// Run demo
demo().catch(console.error);
