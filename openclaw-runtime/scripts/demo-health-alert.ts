#!/usr/bin/env ts-node
/**
 * P0 告警闭环：健康检查告警演示
 * 
 * 从健康检查文件读取告警，跑通完整链路
 */

import { getHealthCheckAlertIngest, resetHealthCheckAlertIngest } from '../src/alerting/health_check_ingest.js';
import { getTimelineStore, resetTimelineStore } from '../src/alerting/timeline_integration.js';
import { getIncidentRepository, resetIncidentRepository } from '../src/alerting/incident_repository.js';
import { resetAlertIngestService } from '../src/alerting/alert_ingest.js';

async function demo(): Promise<void> {
  console.log('=== P0 告警闭环：健康检查告警演示 ===\n');

  // Reset state
  resetHealthCheckAlertIngest();
  resetAlertIngestService();
  resetTimelineStore();
  resetIncidentRepository();

  const healthIngest = getHealthCheckAlertIngest();
  const timelineStore = getTimelineStore();
  const incidentRepo = getIncidentRepository();

  // Demo 1: 读取健康检查并摄入告警
  console.log('📢 场景 1: 读取健康检查并摄入告警\n');

  await healthIngest.checkAndIngest();

  // Demo 2: 查询 Timeline
  console.log('\n📢 场景 2: 查询 Timeline\n');

  const timelineEvents = timelineStore.getRecent(10);
  console.log(`✅ Timeline 事件 (${timelineEvents.length} 条):`);
  for (const event of timelineEvents) {
    console.log(`   - [${event.type}] ${event.alert_name || event.incident_id} @ ${new Date(event.timestamp).toLocaleTimeString()}`);
  }

  // Demo 3: 查询 Incident
  console.log('\n📢 场景 3: 查询 Incident\n');

  const incidents = incidentRepo.getOpen(10);
  console.log(`✅ Open Incidents (${incidents.length} 个):`);
  for (const incident of incidents) {
    console.log(`   - ${incident.id} (${incident.status})`);
    console.log(`     Type: ${incident.type}`);
    console.log(`     Severity: ${incident.severity}`);
    console.log(`     Related Alerts: ${incident.related_alerts.join(', ')}`);
  }

  // Demo 4: 统计
  console.log('\n📢 场景 4: 统计信息\n');

  const stats = incidentRepo.getStats();
  console.log('✅ Incident 统计:');
  console.log(`   - Total: ${stats.total}`);
  console.log(`   - Open: ${stats.open}`);
  console.log(`   - P0: ${stats.by_severity.P0}`);

  console.log('\n=== 演示完成 ===\n');
}

// Run demo
demo().catch(console.error);
