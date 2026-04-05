#!/bin/bash
# Phase 2E-2: Replay & Recovery 测试

set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║  Phase 2E-2: Replay & Recovery 测试                   ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# 使用 Node.js 直接测试
node << 'NODEJS'
const path = require('path');
const { createEventRepository } = require('/Users/colin/.openclaw/workspace/dist/infrastructure/persistence/event_repository.js');
const { createApprovalRepository } = require('/Users/colin/.openclaw/workspace/dist/infrastructure/persistence/approval_repository.js');
const { createIncidentRepository } = require('/Users/colin/.openclaw/workspace/dist/infrastructure/persistence/incident_repository.js');
const { createAuditLogService } = require('/Users/colin/.openclaw/workspace/dist/infrastructure/persistence/audit_log_service.js');
const { createReplayEngine } = require('/Users/colin/.openclaw/workspace/dist/infrastructure/persistence/replay_engine.js');
const { createRecoveryEngine } = require('/Users/colin/.openclaw/workspace/dist/infrastructure/persistence/recovery_engine.js');

const DATA_DIR = '/Users/colin/.openclaw/trading-data';

async function runTests() {
  console.log("初始化 Repositories...");
  const eventRepo = createEventRepository(DATA_DIR);
  const approvalRepo = createApprovalRepository(DATA_DIR);
  const incidentRepo = createIncidentRepository(DATA_DIR);
  const auditLog = createAuditLogService(DATA_DIR);
  
  console.log("创建 Replay Engine...");
  const replayEngine = createReplayEngine(eventRepo, approvalRepo, incidentRepo);
  
  console.log("创建 Recovery Engine...");
  const recoveryEngine = createRecoveryEngine(approvalRepo, incidentRepo, eventRepo, auditLog);
  
  console.log("");
  console.log("测试 1: 生成重放计划...");
  const plan = await replayEngine.generatePlan({ limit: 100 });
  console.log("  估计事件数:", plan.estimatedEvents);
  console.log("  事件类型:", Object.fromEntries(plan.eventTypes));
  
  console.log("");
  console.log("测试 2: Dry-run 重放...");
  const replayResult = await replayEngine.replay({ mode: 'dry-run', limit: 100 });
  console.log("  成功:", replayResult.success);
  console.log("  处理事件:", replayResult.eventsProcessed);
  console.log("  摘要:", replayResult.summary);
  
  console.log("");
  console.log("测试 3: Recovery 扫描...");
  const recoveryResult = await recoveryEngine.scan();
  console.log("  扫描完成:", recoveryResult.scanCompleted);
  console.log("  审批:", recoveryResult.recovered.approvals);
  console.log("  事件:", recoveryResult.recovered.incidents);
  console.log("  孤儿对象:", recoveryResult.orphanedObjects.length);
  console.log("  过期对象:", recoveryResult.staleObjects.length);
  console.log("  摘要:", recoveryResult.summary);
  
  console.log("");
  console.log("✅ 所有测试通过");
}

runTests().catch(console.error);
NODEJS

echo ""
echo "测试完成"
