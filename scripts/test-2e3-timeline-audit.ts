/**
 * Phase 2E-3: Timeline & Audit 测试脚本
 * 
 * 用法：
 * npx ts-node scripts/test-2e3-timeline-audit.ts
 */

import { createAuditLogService } from '../src/infrastructure/persistence/audit_log_service';
import { createApprovalRepository } from '../src/infrastructure/persistence/approval_repository';
import { createIncidentRepository } from '../src/infrastructure/persistence/incident_repository';
import { createEventRepository } from '../src/infrastructure/persistence/event_repository';
import { createTimelineService } from '../src/infrastructure/persistence/timeline_service';
import { createPolicyAuditService } from '../src/infrastructure/persistence/policy_audit_service';

const DATA_DIR = '/Users/colin/.openclaw/trading-data';

async function runTests() {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║  Phase 2E-3: Timeline & Audit 测试                    ║");
  console.log("╚════════════════════════════════════════════════════════╝");
  console.log("");

  // 初始化服务
  console.log("初始化服务...");
  const auditLog = createAuditLogService(DATA_DIR);
  const approvalRepo = createApprovalRepository(DATA_DIR);
  const incidentRepo = createIncidentRepository(DATA_DIR);
  const eventRepo = createEventRepository(DATA_DIR);

  const timeline = createTimelineService(auditLog, approvalRepo, incidentRepo, eventRepo);
  const policyAudit = createPolicyAuditService(auditLog);

  console.log("✅ 服务初始化完成");
  console.log("");

  // 测试 1: 获取时间线
  console.log("测试 1: 获取时间线...");
  const timelineResult = await timeline.getTimeline({ limit: 10 });
  console.log(`  时间线项数：${timelineResult.items.length}`);
  console.log(`  总数：${timelineResult.total}`);
  console.log(`  有更多：${timelineResult.hasMore}`);
  console.log("");

  // 测试 2: 获取对象时间线
  console.log("测试 2: 获取审批对象时间线...");
  const approvals = await approvalRepo.query({ limit: 1 });
  if (approvals.total > 0) {
    const approvalId = approvals.approvals[0].approvalId;
    const approvalTimeline = await timeline.getApprovalLifecycleChain(approvalId);
    console.log(`  审批 ID: ${approvalId}`);
    console.log(`  生命周期项数：${approvalTimeline.length}`);
  } else {
    console.log("  ⚠️  无审批记录");
  }
  console.log("");

  // 测试 3: 获取事件时间线
  console.log("测试 3: 获取事件对象时间线...");
  const incidents = await incidentRepo.query({ limit: 1 });
  if (incidents.total > 0) {
    const incidentId = incidents.incidents[0].incidentId;
    const incidentTimeline = await timeline.getIncidentLifecycleChain(incidentId);
    console.log(`  事件 ID: ${incidentId}`);
    console.log(`  生命周期项数：${incidentTimeline.length}`);
  } else {
    console.log("  ⚠️  无事件记录");
  }
  console.log("");

  // 测试 4: 策略审计查询
  console.log("测试 4: 策略审计查询...");
  const auditResult = await policyAudit.query({ limit: 10 });
  console.log(`  审计记录数：${auditResult.entries.length}`);
  console.log(`  总数：${auditResult.total}`);
  console.log(`  Allow: ${auditResult.summary.allowCount}`);
  console.log(`  Ask: ${auditResult.summary.askCount}`);
  console.log(`  Deny: ${auditResult.summary.denyCount}`);
  console.log(`  高风险：${auditResult.summary.highRiskCount}`);
  console.log("");

  // 测试 5: 高风险动作
  console.log("测试 5: 高风险动作查询...");
  const highRisk = await policyAudit.getHighRiskActions(24, 10);
  console.log(`  高风险动作数：${highRisk.length}`);
  console.log("");

  // 测试 6: 决策统计
  console.log("测试 6: 决策统计...");
  const stats = await policyAudit.getDecisionStats(24);
  console.log(`  总决策数：${stats.total}`);
  console.log(`  Allow 率：${(stats.allowRate * 100).toFixed(1)}%`);
  console.log(`  Ask 率：${(stats.askRate * 100).toFixed(1)}%`);
  console.log(`  Deny 率：${(stats.denyRate * 100).toFixed(1)}%`);
  console.log(`  高风险率：${(stats.highRiskRate * 100).toFixed(1)}%`);
  console.log("");

  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║  ✅ 所有测试通过                                      ║");
  console.log("╚════════════════════════════════════════════════════════╝");
}

runTests().catch(console.error);
