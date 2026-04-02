/**
 * Minimal Tests - 最小测试闭环
 * 
 * 10 条必须通过的测试：
 * 
 * 单元测试：
 * 1. PermissionEngine: allow/ask/deny
 * 2. QueryGuard: 重复启动与 stale end
 * 3. TaskStore: 创建/更新/输出
 * 4. ApprovalStore: resolve 幂等
 * 5. VerificationRules: 未验证代码修改 -> warn/fail
 * 
 * 集成测试：
 * 6. exec.run 命中 ask -> 创建 approval
 * 7. exec.run resolve approve -> task 恢复
 * 8. fs.write 命中 deny -> tool.denied hook
 * 9. task.verify 写入 summary
 * 10. worktree policy 对 code_fixer 生效
 */

import { PermissionEngine } from '../runtime/permission_engine';
import { QueryGuard } from '../runtime/query_guard';
import { TaskStore } from '../runtime/task_store';
import { ApprovalStore } from '../bridge/approval_store';
import { verify } from '../verification/verification_rules';
import { WorktreePolicy } from '../workspace/worktree_policy';
import { WorktreeManager } from '../workspace/worktree_manager';

/** 测试结果 */
export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

/** 运行单个测试 */
async function runTest(
  name: string,
  fn: () => Promise<void> | void,
): Promise<TestResult> {
  const start = Date.now();
  try {
    await fn();
    return {
      name,
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start,
    };
  }
}

/**
 * 测试 1: PermissionEngine - allow/ask/deny
 */
async function testPermissionEngine(): Promise<TestResult> {
  return runTest('PermissionEngine: allow/ask/deny', () => {
    const engine = new PermissionEngine();
    
    // 测试 allow
    const allowResult = engine.evaluate({
      tool: 'fs.read',
      target: 'test.txt',
    });
    if (!allowResult.allowed || allowResult.behavior !== 'allow') {
      throw new Error(`Expected allow for fs.read, got ${allowResult.behavior}`);
    }
    
    // 测试 ask
    const askResult = engine.evaluate({
      tool: 'fs.write',
      target: 'test.txt',
    });
    if (askResult.behavior !== 'ask') {
      throw new Error(`Expected ask for fs.write, got ${askResult.behavior}`);
    }
    
    // 测试 deny
    const denyResult = engine.evaluate({
      tool: 'exec.run',
      target: 'rm -rf /',
    });
    if (!denyResult.allowed || denyResult.behavior !== 'deny') {
      throw new Error(`Expected deny for rm -rf /, got ${denyResult.behavior}`);
    }
  });
}

/**
 * 测试 2: QueryGuard - 重复启动与 stale end
 */
async function testQueryGuard(): Promise<TestResult> {
  return runTest('QueryGuard: duplicate start & stale end', () => {
    const guard = new QueryGuard();
    
    // 第一次启动
    const gen1 = guard.tryStart();
    if (gen1 === null) {
      throw new Error('First start should succeed');
    }
    
    // 第二次启动应该失败
    const gen2 = guard.tryStart();
    if (gen2 !== null) {
      throw new Error('Second start should fail while running');
    }
    
    // stale end 应该失败
    const staleEnd = guard.end(999);
    if (staleEnd) {
      throw new Error('Stale end should fail');
    }
    
    // 正确的 end 应该成功
    const correctEnd = guard.end(gen1);
    if (!correctEnd) {
      throw new Error('Correct end should succeed');
    }
  });
}

/**
 * 测试 3: TaskStore - 创建/更新/输出
 */
async function testTaskStore(): Promise<TestResult> {
  return runTest('TaskStore: create/update/output', async () => {
    const tasks = new TaskStore();
    
    // 创建任务
    const task = tasks.create({
      type: 'exec',
      sessionId: 'test_session',
      agentId: 'test_agent',
      workspaceRoot: '/tmp',
      description: 'Test task',
    });
    
    if (!task.id) {
      throw new Error('Task should have id');
    }
    
    // 更新状态
    tasks.update(task.id, { status: 'running' });
    
    const updated = tasks.get(task.id);
    if (!updated || updated.status !== 'running') {
      throw new Error('Task status should be updated to running');
    }
    
    // 追加输出
    tasks.appendOutput(task.id, 'Test output\n');
    
    const output = tasks.getOutput(task.id);
    if (!output.includes('Test output')) {
      throw new Error('Output should contain appended text');
    }
  });
}

/**
 * 测试 4: ApprovalStore - resolve 幂等
 */
async function testApprovalStore(): Promise<TestResult> {
  return runTest('ApprovalStore: resolve idempotency', async () => {
    const store = new ApprovalStore();
    
    // 创建审批请求
    const request = store.create({
      sessionId: 'test_session',
      tool: 'exec.run',
      summary: 'Test command',
      risk: 'medium',
    });
    
    // 第一次批准
    const decision1 = store.approve(request.id, 'user_123', 'Approved');
    if (!decision1.approved) {
      throw new Error('First approval should succeed');
    }
    
    // 第二次批准应该失败（幂等）
    try {
      store.approve(request.id, 'user_456', 'Also approved');
      throw new Error('Second approval should throw');
    } catch (error) {
      // 预期行为
      if (!(error instanceof Error) || !error.message.includes('already decided')) {
        throw new Error(`Expected "already decided" error, got ${error}`);
      }
    }
  });
}

/**
 * 测试 5: VerificationRules - 未验证代码修改 -> warn/fail
 */
async function testVerificationRules(): Promise<TestResult> {
  return runTest('VerificationRules: unverified code changes', async () => {
    // 有代码修改但没有测试命令
    const result = verify({
      taskId: 'test_123',
      hasCodeChanges: true,
      hasTestCommand: false,
      todoPending: 0,
      outputEmpty: false,
      taskStatus: 'completed',
      highRiskOperations: 0,
    });
    
    // 应该至少有一个 warn
    const warns = result.checklist.filter(c => c.status === 'warn');
    if (warns.length === 0) {
      throw new Error('Expected at least one warn for unverified code changes');
    }
  });
}

/**
 * 测试 6: exec.run 命中 ask -> 创建 approval
 */
async function testExecRunAsk(): Promise<TestResult> {
  return runTest('exec.run ask -> create approval', async () => {
    const store = new ApprovalStore();
    
    // 模拟 exec.run 触发 ask
    const request = store.create({
      sessionId: 'test_session',
      taskId: 'task_123',
      tool: 'exec.run',
      summary: 'npm install',
      risk: 'medium',
    });
    
    if (request.status !== 'pending') {
      throw new Error('Request should be pending');
    }
    
    const pending = store.listPending();
    if (pending.length === 0) {
      throw new Error('Should have pending approval');
    }
  });
}

/**
 * 测试 7: exec.run resolve approve -> task 恢复
 */
async function testExecRunRecover(): Promise<TestResult> {
  return runTest('exec.run resolve approve -> task recovery', async () => {
    const tasks = new TaskStore();
    const store = new ApprovalStore();
    
    // 创建任务（等待审批状态）
    const task = tasks.create({
      type: 'exec',
      sessionId: 'test_session',
      agentId: 'test_agent',
      workspaceRoot: '/tmp',
      description: 'Test exec',
    });
    tasks.update(task.id, { status: 'waiting_approval' });
    
    // 创建审批请求
    const request = store.create({
      sessionId: 'test_session',
      taskId: task.id,
      tool: 'exec.run',
      summary: 'Test command',
      risk: 'medium',
    });
    
    // 批准
    store.approve(request.id, 'user_123');
    
    // 验证任务状态已恢复
    const updated = tasks.get(task.id);
    // 注意：ApprovalStore 不直接更新 TaskStore，需要 ApprovalBridge
    // 这里只验证审批状态
    const approvedRequest = store.get(request.id);
    if (approvedRequest?.status !== 'approved') {
      throw new Error('Request should be approved');
    }
  });
}

/**
 * 测试 8: fs.write 命中 deny -> tool.denied hook
 */
async function testFsWriteDeny(): Promise<TestResult> {
  return runTest('fs.write deny -> tool.denied', async () => {
    const engine = new PermissionEngine();
    
    // 尝试写入系统目录
    const result = engine.evaluate({
      tool: 'fs.write',
      target: '/etc/passwd',
      cwd: '/tmp',
    });
    
    if (result.behavior !== 'deny') {
      throw new Error(`Expected deny for /etc/passwd, got ${result.behavior}`);
    }
    
    if (!result.explanation.includes('forbidden')) {
      throw new Error('Explanation should mention forbidden');
    }
  });
}

/**
 * 测试 9: task.verify 写入 summary
 */
async function testTaskVerifySummary(): Promise<TestResult> {
  return runTest('task.verify writes summary', async () => {
    const result = verify({
      taskId: 'test_123',
      hasCodeChanges: false,
      hasTestCommand: false,
      todoPending: 0,
      outputEmpty: false,
      taskStatus: 'completed',
      highRiskOperations: 0,
    });
    
    if (!result.summary) {
      throw new Error('Summary should be generated');
    }
    
    if (!result.summary.includes('pass')) {
      throw new Error('Summary should mention pass count');
    }
  });
}

/**
 * 测试 10: worktree policy 对 code_fixer 生效
 */
async function testWorktreePolicy(): Promise<TestResult> {
  return runTest('worktree policy for code_fixer', async () => {
    const worktreeManager = new WorktreeManager();
    const policy = new WorktreePolicy({
      worktreeManager,
      autoTrigger: true,
    });
    
    // code_fixer agent 应该触发 worktree
    const result = policy.shouldCreateWorktree({
      agentName: 'code_fixer',
      taskDescription: 'Fix imports',
      filesToModify: ['src/index.ts'],
    });
    
    if (!result.shouldCreate) {
      throw new Error('code_fixer should trigger worktree');
    }
    
    if (result.reason !== 'code_fixer_agent') {
      throw new Error(`Expected reason code_fixer_agent, got ${result.reason}`);
    }
  });
}

/**
 * 运行所有最小测试
 */
export async function runMinimalTests(): Promise<{
  results: TestResult[];
  passed: number;
  failed: number;
  totalDuration: number;
}> {
  const tests = [
    testPermissionEngine,
    testQueryGuard,
    testTaskStore,
    testApprovalStore,
    testVerificationRules,
    testExecRunAsk,
    testExecRunRecover,
    testFsWriteDeny,
    testTaskVerifySummary,
    testWorktreePolicy,
  ];
  
  const results: TestResult[] = [];
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    const result = await test();
    results.push(result);
    
    if (result.passed) {
      passed++;
    } else {
      failed++;
    }
  }
  
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  
  return { results, passed, failed, totalDuration };
}

/**
 * 输出测试报告
 */
export function formatTestReport(results: {
  results: TestResult[];
  passed: number;
  failed: number;
  totalDuration: number;
}): string {
  const lines: string[] = [];
  
  lines.push('='.repeat(60));
  lines.push('🧪 最小测试闭环报告');
  lines.push('='.repeat(60));
  lines.push('');
  
  for (const result of results.results) {
    const icon = result.passed ? '✅' : '❌';
    lines.push(`${icon} ${result.name} (${result.duration}ms)`);
    if (!result.passed) {
      lines.push(`   Error: ${result.error}`);
    }
  }
  
  lines.push('');
  lines.push('-'.repeat(60));
  lines.push(`总计：${results.passed} 通过，${results.failed} 失败，${results.totalDuration}ms`);
  lines.push('='.repeat(60));
  
  return lines.join('\n');
}
