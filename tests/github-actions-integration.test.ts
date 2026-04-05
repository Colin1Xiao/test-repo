#!/usr/bin/env ts-node
/**
 * GitHub Actions Integration Test
 * Phase 2B-2-I - 集成测试脚本
 * 
 * 测试场景：
 * 1. Deployment → Approval → Inbox
 * 2. Workflow Run Failed → Incident → Inbox
 * 3. Approve → GitHub Writeback
 * 4. Reject → GitHub Writeback
 */

import { initializeGitHubActionsIntegration, createWebhookHandler, createActionHandler } from '../src/connectors/github-actions/github_actions_integration';
import type { DeploymentWebhookPayload, WorkflowRunWebhookPayload } from '../src/connectors/github-actions/github_actions_types';

// ============================================================================
// 测试配置
// ============================================================================

const TEST_CONFIG = {
  githubToken: process.env.GITHUB_TOKEN || '',
  webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || '',
  autoApproveEnvironments: ['staging'],
  ignoreWorkflows: ['test-workflow'],
  requireApprovalForEnvironments: ['production', 'staging'],
  verboseLogging: true,
};

// ============================================================================
// 测试数据
// ============================================================================

const DEPLOYMENT_PAYLOAD: DeploymentWebhookPayload = {
  deployment: {
    id: 12345,
    environment: 'production',
    ref: 'main',
    task: 'deploy',
    description: 'Deploy latest changes to production',
    creator: {
      login: 'colin',
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  repository: {
    owner: {
      login: 'test-org',
    },
    name: 'test-repo',
    full_name: 'test-org/test-repo',
  },
};

const WORKFLOW_FAILED_PAYLOAD: WorkflowRunWebhookPayload = {
  action: 'completed',
  workflow_run: {
    id: 67890,
    name: 'CI Pipeline',
    run_number: 42,
    status: 'completed',
    conclusion: 'failure',
    head_branch: 'main',
    head_sha: 'abc123',
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
  workflow: {
    id: 111,
    name: 'CI Pipeline',
  },
  repository: {
    owner: {
      login: 'test-org',
    },
    name: 'test-repo',
    full_name: 'test-org/test-repo',
  },
  sender: {
    login: 'colin',
  },
};

// ============================================================================
// 测试函数
// ============================================================================

async function test1_DeploymentToApproval() {
  console.log('\n=== Test 1: Deployment → Approval → Inbox ===\n');
  
  const integration = initializeGitHubActionsIntegration(TEST_CONFIG);
  const webhookHandler = createWebhookHandler(integration);
  
  // 触发 Deployment Webhook
  const result = await webhookHandler(DEPLOYMENT_PAYLOAD);
  
  console.log('Webhook Result:', JSON.stringify(result, null, 2));
  
  // 验证审批已创建
  const approval = await integration.approvalDataSource.getApprovalById('github_deployment_12345');
  
  if (!approval) {
    console.error('❌ FAILED: Approval not created');
    return false;
  }
  
  console.log('Approval Created:', JSON.stringify({
    approvalId: approval.approvalId,
    scope: approval.scope,
    status: approval.status,
    environment: approval.metadata?.environment,
  }, null, 2));
  
  if (approval.status !== 'pending') {
    console.error('❌ FAILED: Approval status should be "pending"');
    return false;
  }
  
  if (approval.metadata?.deploymentId !== 12345) {
    console.error('❌ FAILED: Deployment ID mismatch');
    return false;
  }
  
  console.log('✅ PASSED: Deployment → Approval\n');
  return true;
}

async function test2_WorkflowFailedToIncident() {
  console.log('\n=== Test 2: Workflow Run Failed → Incident → Inbox ===\n');
  
  const integration = initializeGitHubActionsIntegration(TEST_CONFIG);
  const webhookHandler = createWebhookHandler(integration);
  
  // 触发 Workflow Run Failed Webhook
  const result = await webhookHandler(WORKFLOW_FAILED_PAYLOAD);
  
  console.log('Webhook Result:', JSON.stringify(result, null, 2));
  
  // 验证事件已创建
  const incident = await integration.incidentDataSource.getIncidentById('github_workflow_67890');
  
  if (!incident) {
    console.error('❌ FAILED: Incident not created');
    return false;
  }
  
  console.log('Incident Created:', JSON.stringify({
    incidentId: incident.id,
    type: incident.type,
    severity: incident.severity,
    workflowName: incident.metadata?.workflowName,
  }, null, 2));
  
  if (incident.acknowledged) {
    console.error('❌ FAILED: Incident should not be acknowledged yet');
    return false;
  }
  
  console.log('✅ PASSED: Workflow Failed → Incident\n');
  return true;
}

async function test3_AutoApproveStaging() {
  console.log('\n=== Test 3: Auto-Approve Staging Environment ===\n');
  
  const integration = initializeGitHubActionsIntegration({
    ...TEST_CONFIG,
    autoApproveEnvironments: ['staging'],
  });
  const webhookHandler = createWebhookHandler(integration);
  
  // 触发 Staging Deployment Webhook
  const stagingPayload: DeploymentWebhookPayload = {
    ...DEPLOYMENT_PAYLOAD,
    deployment: {
      ...DEPLOYMENT_PAYLOAD.deployment,
      id: 99999,
      environment: 'staging',
    },
  };
  
  const result = await webhookHandler(stagingPayload);
  
  console.log('Webhook Result:', JSON.stringify(result, null, 2));
  
  // 验证审批已自动批准
  const approval = await integration.approvalDataSource.getApprovalById('github_deployment_99999');
  
  if (!approval) {
    console.error('❌ FAILED: Approval not created');
    return false;
  }
  
  console.log('Approval Status:', JSON.stringify({
    approvalId: approval.approvalId,
    status: approval.status,
    approver: approval.approver,
    environment: approval.metadata?.environment,
  }, null, 2));
  
  if (approval.status !== 'approved') {
    console.error('❌ FAILED: Staging deployment should be auto-approved');
    return false;
  }
  
  console.log('✅ PASSED: Auto-Approve Staging\n');
  return true;
}

async function test4_ActionHandler() {
  console.log('\n=== Test 4: Action Handler (Approve/Reject) ===\n');
  
  const integration = initializeGitHubActionsIntegration(TEST_CONFIG);
  const webhookHandler = createWebhookHandler(integration);
  const actionHandler = createActionHandler(integration);
  
  // 先创建审批
  await webhookHandler(DEPLOYMENT_PAYLOAD);
  
  const sourceId = 'test-org/test-repo/deployments/12345';
  
  // 测试 Approve 动作
  console.log('Testing Approve Action...');
  const approveResult = await actionHandler.handleApprove(sourceId, 'test-user');
  
  console.log('Approve Result:', JSON.stringify(approveResult, null, 2));
  
  // 验证审批状态已更新
  const approval = await integration.approvalDataSource.getApprovalById('github_deployment_12345');
  
  if (!approval || approval.status !== 'approved') {
    console.error('❌ FAILED: Approval status should be "approved" after approve action');
    return false;
  }
  
  console.log('✅ PASSED: Approve Action\n');
  return true;
}

// ============================================================================
// 主测试流程
// ============================================================================

async function runTests() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  GitHub Actions Integration Test Suite                 ║');
  console.log('║  Phase 2B-2-I                                          ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  const results = {
    passed: 0,
    failed: 0,
  };
  
  const tests = [
    test1_DeploymentToApproval,
    test2_WorkflowFailedToIncident,
    test3_AutoApproveStaging,
    test4_ActionHandler,
  ];
  
  for (const test of tests) {
    try {
      const passed = await test();
      if (passed) {
        results.passed++;
      } else {
        results.failed++;
      }
    } catch (error) {
      console.error('❌ FAILED: Test threw error:', error instanceof Error ? error.message : String(error));
      results.failed++;
    }
  }
  
  // 总结
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  Test Summary                                          ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  console.log(`Passed: ${results.passed}/${tests.length}`);
  console.log(`Failed: ${results.failed}/${tests.length}\n`);
  
  if (results.failed === 0) {
    console.log('🎉 All tests passed!\n');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed.\n');
    process.exit(1);
  }
}

// 运行测试
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
