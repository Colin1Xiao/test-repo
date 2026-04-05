#!/usr/bin/env node
/**
 * Phase 2E-4B: 单元测试运行器
 * 
 * 直接运行测试验证核心逻辑
 */

import { RecoveryCoordinator } from './dist/ownership/recovery_coordinator.js';
import { StateSequenceValidator, canTransition } from './dist/ownership/state_sequence.js';

// ==================== Mock 实现 ====================

class MockRedisClient {
  store = new Map();
  sets = new Map();
  ttls = new Map();

  async get(key) {
    const value = this.store.get(key);
    const ttl = this.ttls.get(key);
    if (ttl && Date.now() > ttl) {
      this.store.delete(key);
      this.ttls.delete(key);
      return null;
    }
    return value || null;
  }

  async set(key, value, options) {
    this.store.set(key, value);
    if (options?.ex) {
      this.ttls.set(key, Date.now() + options.ex * 1000);
    }
  }

  async sadd(key, ...members) {
    let set = this.sets.get(key);
    if (!set) {
      set = new Set();
      this.sets.set(key, set);
    }
    let added = 0;
    for (const member of members) {
      if (!set.has(member)) {
        set.add(member);
        added++;
      }
    }
    return added;
  }

  async srem(key, ...members) {
    const set = this.sets.get(key);
    if (!set) return 0;
    let removed = 0;
    for (const member of members) {
      if (set.has(member)) {
        set.delete(member);
        removed++;
      }
    }
    return removed;
  }

  async smembers(key) {
    const set = this.sets.get(key);
    if (!set) return [];
    return Array.from(set);
  }

  async eval(script, keys, ...args) {
    const key = args[0];
    const data = this.store.get(key);
    if (!data) return null;
    const item = JSON.parse(data);
    if (item.status === 'claimed') return null;
    item.status = 'claimed';
    item.session_id = args[1];
    item.claimed_by = args[2];
    this.store.set(key, JSON.stringify(item));
    return JSON.stringify(item);
  }
}

class MockAuditLogService {
  logs = [];
  async log(entry) {
    this.logs.push(entry);
  }
  getLogs(event_type) {
    if (!event_type) return [...this.logs];
    return this.logs.filter(log => log.event_type === event_type);
  }
}

// ==================== 测试运行器 ====================

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${error.message}`);
    failed++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${error.message}`);
    failed++;
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Assertion failed'}: expected ${expected}, got ${actual}`);
  }
}

function assertTrue(condition, message) {
  if (!condition) {
    throw new Error(message || 'Expected true');
  }
}

// ==================== 测试用例 ====================

console.log('\n=== Recovery Coordinator Tests ===\n');

// Session Lifecycle
await asyncTest('startSession - 第一次创建成功', async () => {
  const redis = new MockRedisClient();
  const audit = new MockAuditLogService();
  const coordinator = new RecoveryCoordinator(redis, audit, {}, 'test-instance-1');
  
  const result = await coordinator.startSession();
  assertTrue(result.success === true, 'Should succeed');
  if (result.success) {
    assertEqual(result.session.status, 'active', 'Status should be active');
    assertEqual(result.session.owner_id, 'test-instance-1', 'Owner should match');
  }
});

await asyncTest('startSession - 已存在 session 时拒绝', async () => {
  const redis = new MockRedisClient();
  const audit = new MockAuditLogService();
  const coordinator = new RecoveryCoordinator(redis, audit, {}, 'test-instance-1');
  
  const result1 = await coordinator.startSession();
  assertTrue(result1.success === true, 'First should succeed');
  
  const result2 = await coordinator.startSession();
  assertTrue(result2.success === false, 'Second should fail');
  if (!result2.success) {
    assertEqual(result2.error, 'SESSION_EXISTS', 'Error should be SESSION_EXISTS');
  }
});

await asyncTest('renewSession - owner 正确时续约成功', async () => {
  const redis = new MockRedisClient();
  const audit = new MockAuditLogService();
  const coordinator = new RecoveryCoordinator(redis, audit, {}, 'test-instance-1');
  
  const startResult = await coordinator.startSession();
  if (startResult.success) {
    const session_id = startResult.session.session_id;
    const oldExpires = startResult.session.expires_at;
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const renewResult = await coordinator.renewSession(session_id);
    assertTrue(renewResult.success === true, 'Renew should succeed');
    if (renewResult.success) {
      assertTrue(renewResult.session.expires_at > oldExpires, 'Expiry should be extended');
    }
  }
});

await asyncTest('claimItem - 第一个 claim 成功', async () => {
  const redis = new MockRedisClient();
  const audit = new MockAuditLogService();
  const coordinator = new RecoveryCoordinator(redis, audit, {}, 'test-instance-1');
  
  const sessionResult = await coordinator.startSession();
  if (sessionResult.success) {
    const session_id = sessionResult.session.session_id;
    const item_id = 'test-item-1';
    
    await redis.set(`recovery:item:${item_id}`, JSON.stringify({
      item_id,
      item_type: 'approval',
      status: 'pending',
      retry_count: 0,
      max_retries: 3,
      created_at: Date.now(),
    }));
    
    const claimResult = await coordinator.claimItem(item_id, session_id);
    assertTrue(claimResult.success === true, 'Claim should succeed');
    if (claimResult.success) {
      assertEqual(claimResult.item.status, 'claimed', 'Status should be claimed');
    }
  }
});

console.log('\n=== State Sequence Validator Tests ===\n');

// Approvals Flow
test('approvals: pending -> approved ✅', () => {
  assertTrue(canTransition('approvals', 'pending', 'approved'), 'Should allow');
});

test('approvals: pending -> rejected ✅', () => {
  assertTrue(canTransition('approvals', 'pending', 'rejected'), 'Should allow');
});

test('approvals: approved -> pending ❌', () => {
  assertTrue(!canTransition('approvals', 'approved', 'pending'), 'Should deny');
});

// Incidents Flow
test('incidents: open -> acknowledged ✅', () => {
  assertTrue(canTransition('incidents', 'open', 'acknowledged'), 'Should allow');
});

test('incidents: acknowledged -> resolved ✅', () => {
  assertTrue(canTransition('incidents', 'acknowledged', 'resolved'), 'Should allow');
});

test('incidents: resolved -> open ❌', () => {
  assertTrue(!canTransition('incidents', 'resolved', 'open'), 'Should deny');
});

// Risk State Flow
test('risk_state: normal -> warning ✅', () => {
  assertTrue(canTransition('risk_state', 'normal', 'warning'), 'Should allow');
});

test('risk_state: warning -> critical ✅', () => {
  assertTrue(canTransition('risk_state', 'warning', 'critical'), 'Should allow');
});

test('risk_state: critical -> warning ❌', () => {
  assertTrue(!canTransition('risk_state', 'critical', 'warning'), 'Should deny');
});

// Deployments Flow
test('deployments: planned -> in_progress ✅', () => {
  assertTrue(canTransition('deployments', 'planned', 'in_progress'), 'Should allow');
});

test('deployments: in_progress -> validating ✅', () => {
  assertTrue(canTransition('deployments', 'in_progress', 'validating'), 'Should allow');
});

test('deployments: completed -> in_progress ❌', () => {
  assertTrue(!canTransition('deployments', 'completed', 'in_progress'), 'Should deny');
});

// ==================== 测试报告 ====================

console.log('\n==============================');
console.log(`Tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log('==============================\n');

if (failed > 0) {
  process.exit(1);
}
