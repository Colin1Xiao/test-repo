#!/usr/bin/env ts-node
/**
 * GitHub Connector 端到端验证脚本
 * Phase 2B-1-V - 验证 GitHub → Operator → GitHub 完整闭环
 * 
 * 使用方法：
 *   ts-node scripts/validate_github_connector.ts
 * 
 * 环境变量：
 *   GITHUB_TEST_OWNER - 测试仓库 Owner
 *   GITHUB_TEST_REPO - 测试仓库名称
 *   GITHUB_WEBHOOK_SECRET - Webhook Secret
 *   GITHUB_TOKEN - GitHub API Token
 *   GITHUB_VALIDATION_MODE - dry-run | live
 */

import {
  getGitHubValidationConfig,
  GITHUB_TEST_CASES,
  generateTestWebhookPayload,
  validateConfig,
  type ValidationReport,
} from '../src/connectors/github/github_validation_config';
import {
  createGitHubConnector,
  createPREventAdapter,
  createPRTaskMapper,
  createCheckStatusAdapter,
  createGitHubOperatorBridge,
  createReviewBridge,
} from '../src/connectors/github';
import {
  createTaskDataSource,
  createApprovalDataSource,
  createIncidentDataSource,
} from '../src/operator/data';

// ============================================================================
// 主验证函数
// ============================================================================

async function runValidation(): Promise<ValidationReport> {
  console.log('🔍 开始 GitHub Connector 端到端验证...\n');
  
  const config = getGitHubValidationConfig();
  const testResults: ValidationReport['testResults'] = [];
  
  // 1. 验证配置
  console.log('【1/5】验证配置...');
  const configValidation = validateConfig(config);
  
  if (!configValidation.valid) {
    console.error('❌ 配置验证失败:');
    configValidation.errors.forEach(err => console.error(`   - ${err}`));
    return {
      timestamp: Date.now(),
      testResults: [],
      overall: 'failed',
      details: { configErrors: configValidation.errors },
    };
  }
  
  console.log(`   ✅ 配置验证通过`);
  console.log(`   模式：${config.mode}`);
  console.log(`   仓库：${config.owner}/${config.repo}`);
  if (configValidation.warnings.length > 0) {
    console.log(`   ⚠️  警告：${configValidation.warnings.join(', ')}`);
  }
  console.log();
  
  // 2. 创建数据源和连接器
  console.log('【2/5】初始化数据源和连接器...');
  
  const taskDataSource = createTaskDataSource();
  const approvalDataSource = createApprovalDataSource();
  const incidentDataSource = createIncidentDataSource();
  
  const prEventAdapter = createPREventAdapter();
  const prTaskMapper = createPRTaskMapper();
  const checkAdapter = createCheckStatusAdapter();
  
  const githubConnector = createGitHubConnector({
    apiToken: config.apiToken,
    webhookSecret: config.webhookSecret,
  });
  
  const githubBridge = createGitHubOperatorBridge(
    taskDataSource,
    approvalDataSource,
    incidentDataSource,
    prEventAdapter,
    prTaskMapper,
    checkAdapter,
    { defaultWorkspaceId: 'local-default' }
  );
  
  const reviewBridge = createReviewBridge(githubConnector);
  
  console.log('   ✅ 数据源初始化完成');
  console.log('   ✅ 连接器初始化完成');
  console.log();
  
  // 3. 执行测试用例
  console.log('【3/5】执行测试用例...\n');
  
  for (const testCase of GITHUB_TEST_CASES) {
    const startTime = Date.now();
    console.log(`   测试：${testCase.name}`);
    
    try {
      let passed = false;
      let message = '';
      
      if (testCase.type === 'pr_opened') {
        const payload = generateTestWebhookPayload(testCase, config);
        const events = await githubConnector.handleWebhook(payload);
        
        if (events.length > 0) {
          for (const event of events) {
            if (event.type === 'pr') {
              const result = await githubBridge.handlePREvent(event as any);
              passed = (result.taskCreated === testCase.expected.taskCreated);
              message = result.taskCreated ? 'Task created successfully' : 'Task creation failed';
            }
          }
        }
      }
      
      if (testCase.type === 'review_requested') {
        const payload = generateTestWebhookPayload(testCase, config);
        const events = await githubConnector.handleWebhook(payload);
        
        if (events.length > 0) {
          for (const event of events) {
            if (event.type === 'pr') {
              const result = await githubBridge.handlePREvent(event as any);
              passed = (result.approvalCreated === testCase.expected.approvalCreated);
              message = result.approvalCreated ? 'Approval created successfully' : 'Approval creation failed';
            }
          }
        }
      }
      
      if (testCase.type === 'check_failed') {
        const payload = generateTestWebhookPayload(testCase, config);
        const events = await githubConnector.handleWebhook(payload);
        
        if (events.length > 0) {
          for (const event of events) {
            if (event.type === 'check') {
              const result = await githubBridge.handleCheckEvent(event as any);
              passed = (result.incidentCreated === testCase.expected.incidentCreated);
              message = result.incidentCreated ? 'Incident created successfully' : 'Incident creation failed';
            }
          }
        }
      }
      
      if (testCase.type === 'approve') {
        // 模拟 approve 动作
        const result = await githubBridge.handleApproveAction(
          `${config.owner}/${config.repo}#1`,
          'test-user'
        );
        passed = result.success;
        message = result.message;
      }
      
      if (testCase.type === 'reject') {
        // 模拟 reject 动作
        const result = await githubBridge.handleRejectAction(
          `${config.owner}/${config.repo}#1`,
          'test-user',
          'Needs improvements'
        );
        passed = result.success;
        message = result.message;
      }
      
      const duration = Date.now() - startTime;
      
      testResults.push({
        testCaseId: testCase.id,
        passed,
        message,
        duration,
      });
      
      console.log(`   ${passed ? '✅' : '❌'} ${testCase.id} - ${message} (${duration}ms)`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      testResults.push({
        testCaseId: testCase.id,
        passed: false,
        message: error instanceof Error ? error.message : String(error),
        duration,
      });
      console.log(`   ❌ ${testCase.id} - ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  console.log();
  
  // 4. 验证数据面状态
  console.log('【4/5】验证数据面状态...');
  
  const taskSummary = await taskDataSource.getTaskSummary();
  const approvalSummary = await approvalDataSource.getApprovalSummary();
  const incidentSummary = await incidentDataSource.getIncidentSummary();
  
  console.log(`   任务：${taskSummary.total} 个 (活跃 ${taskSummary.active}, 阻塞 ${taskSummary.blocked}, 失败 ${taskSummary.failed})`);
  console.log(`   审批：${approvalSummary.total} 个 (待处理 ${approvalSummary.pending})`);
  console.log(`   事件：${incidentSummary.total} 个 (活跃 ${incidentSummary.active})`);
  console.log();
  
  // 5. 生成报告
  console.log('【5/5】生成验证报告...');
  
  const passedCount = testResults.filter(r => r.passed).length;
  const totalCount = testResults.length;
  
  const overall: ValidationReport['overall'] =
    passedCount === totalCount ? 'passed' :
    passedCount > 0 ? 'partial' :
    'failed';
  
  const report: ValidationReport = {
    timestamp: Date.now(),
    testResults,
    overall,
    details: {
      config: {
        owner: config.owner,
        repo: config.repo,
        mode: config.mode,
      },
      dataState: {
        tasks: taskSummary,
        approvals: approvalSummary,
        incidents: incidentSummary,
      },
    },
  };
  
  console.log();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`验证完成：${passedCount}/${totalCount} 通过`);
  console.log(`总体状态：${overall === 'passed' ? '✅ 通过' : overall === 'partial' ? '🟡 部分通过' : '❌ 失败'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  return report;
}

// ============================================================================
// 主入口
// ============================================================================

async function main(): Promise<void> {
  try {
    const report = await runValidation();
    
    // 输出 JSON 报告
    console.log('\n📄 JSON 报告:');
    console.log(JSON.stringify(report, null, 2));
    
    // 根据结果退出
    if (report.overall === 'passed') {
      process.exit(0);
    } else if (report.overall === 'partial') {
      process.exit(1);
    } else {
      process.exit(2);
    }
  } catch (error) {
    console.error('❌ 验证失败:', error instanceof Error ? error.message : String(error));
    process.exit(3);
  }
}

// 运行
main();
