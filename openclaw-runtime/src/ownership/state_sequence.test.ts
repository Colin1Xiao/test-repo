/**
 * Phase 2E-4B: State Sequence Validator 单元测试
 * 
 * 测试覆盖：
 * A. 四条流的状态迁移合法性
 * B. 终端状态保护
 * C. 乐观锁并发控制
 * D. 非法跃迁拒绝
 */

import { describe, it, beforeEach, expect } from '@jest/globals';
import assert from 'assert';
import { 
  StateSequenceValidator,
  StateObject,
  APPROVALS_MACHINE,
  INCIDENTS_MACHINE,
  RISK_STATE_MACHINE,
  DEPLOYMENTS_MACHINE,
  canTransition,
  getAllowedTransitions,
  getAllStates,
} from './state_sequence';

// ==================== Mock Audit Log ====================

class MockAuditLogService {
  logs: Array<{
    event_type: string;
    object_type: string;
    object_id: string;
    metadata?: Record<string, unknown>;
  }> = [];

  async log(entry: {
    event_type: string;
    object_type: string;
    object_id: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    this.logs.push(entry);
  }

  clear(): void {
    this.logs = [];
  }

  getLogs(event_type?: string): Array<typeof this.logs[0]> {
    if (!event_type) return [...this.logs];
    return this.logs.filter(log => log.event_type === event_type);
  }
}

// ==================== Test Helpers ====================

function createValidator() {
  const audit = new MockAuditLogService();
  const validator = new StateSequenceValidator(audit as any);
  return { validator, audit };
}

function createStateObject(
  machine_id: 'approvals' | 'incidents' | 'risk_state' | 'deployments',
  initial_state?: string
): StateObject {
  const { validator } = createValidator();
  return validator.createStateObject(`test-${machine_id}-${Date.now()}`, machine_id);
}

// ==================== Tests ====================

describe('StateSequenceValidator', () => {
  describe('Approvals Flow', () => {
    it('pending -> approved ✅', async () => {
      const { validator } = createValidator();
      const stateObject = validator.createStateObject('approval-1', 'approvals');
      
      assert.strictEqual(stateObject.current_state, 'pending');
      
      const result = await validator.transition(stateObject, 'approved');
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.new_state, 'approved');
      }
    });

    it('pending -> rejected ✅', async () => {
      const { validator } = createValidator();
      const stateObject = validator.createStateObject('approval-2', 'approvals');
      
      const result = await validator.transition(stateObject, 'rejected');
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.new_state, 'rejected');
      }
    });

    it('approved -> resolved ✅', async () => {
      const { validator } = createValidator();
      const stateObject = validator.createStateObject('approval-3', 'approvals');
      
      await validator.transition(stateObject, 'approved');
      const result = await validator.transition(stateObject, 'resolved');
      
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.new_state, 'resolved');
      }
    });

    it('approved -> pending ❌', async () => {
      const { validator } = createValidator();
      const stateObject = validator.createStateObject('approval-4', 'approvals');
      
      await validator.transition(stateObject, 'approved');
      const result = await validator.transition(stateObject, 'pending');
      
      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.strictEqual(result.error, 'INVALID_TRANSITION');
      }
    });

    it('rejected -> approved ❌', async () => {
      const { validator } = createValidator();
      const stateObject = validator.createStateObject('approval-5', 'approvals');
      
      await validator.transition(stateObject, 'rejected');
      const result = await validator.transition(stateObject, 'approved');
      
      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.strictEqual(result.error, 'INVALID_TRANSITION');
      }
    });

    it('rejected -> pending ✅ (re-submit)', async () => {
      const { validator } = createValidator();
      const stateObject = validator.createStateObject('approval-6', 'approvals');
      
      await validator.transition(stateObject, 'rejected');
      const result = await validator.transition(stateObject, 'pending');
      
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.new_state, 'pending');
      }
    });
  });

  describe('Incidents Flow', () => {
    it('open -> acknowledged ✅', async () => {
      const { validator } = createValidator();
      const stateObject = validator.createStateObject('incident-1', 'incidents');
      
      const result = await validator.transition(stateObject, 'acknowledged');
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.new_state, 'acknowledged');
      }
    });

    it('acknowledged -> resolving ✅', async () => {
      const { validator } = createValidator();
      const stateObject = validator.createStateObject('incident-2', 'incidents');
      
      await validator.transition(stateObject, 'acknowledged');
      const result = await validator.transition(stateObject, 'resolving');
      
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.new_state, 'resolving');
      }
    });

    it('resolving -> resolved ✅', async () => {
      const { validator } = createValidator();
      const stateObject = validator.createStateObject('incident-3', 'incidents');
      
      await validator.transition(stateObject, 'acknowledged');
      await validator.transition(stateObject, 'resolving');
      const result = await validator.transition(stateObject, 'resolved');
      
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.new_state, 'resolved');
      }
    });

    it('open -> resolved ✅ (auto-close)', async () => {
      const { validator } = createValidator();
      const stateObject = validator.createStateObject('incident-4', 'incidents');
      
      const result = await validator.transition(stateObject, 'resolved');
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.new_state, 'resolved');
      }
    });

    it('resolved -> open ❌', async () => {
      const { validator } = createValidator();
      const stateObject = validator.createStateObject('incident-5', 'incidents');
      
      await validator.transition(stateObject, 'resolved');
      const result = await validator.transition(stateObject, 'open');
      
      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.strictEqual(result.error, 'TERMINAL_STATE');
      }
    });

    it('resolving -> open ✅ (re-open)', async () => {
      const { validator } = createValidator();
      const stateObject = validator.createStateObject('incident-6', 'incidents');
      
      await validator.transition(stateObject, 'acknowledged');
      await validator.transition(stateObject, 'resolving');
      const result = await validator.transition(stateObject, 'open');
      
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.new_state, 'open');
      }
    });
  });

  describe('Risk State Flow', () => {
    it('normal -> warning ✅', async () => {
      const { validator } = createValidator();
      const stateObject = validator.createStateObject('risk-1', 'risk_state');
      
      const result = await validator.transition(stateObject, 'warning');
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.new_state, 'warning');
      }
    });

    it('warning -> critical ✅', async () => {
      const { validator } = createValidator();
      const stateObject = validator.createStateObject('risk-2', 'risk_state');
      
      await validator.transition(stateObject, 'warning');
      const result = await validator.transition(stateObject, 'critical');
      
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.new_state, 'critical');
      }
    });

    it('critical -> recovery ✅', async () => {
      const { validator } = createValidator();
      const stateObject = validator.createStateObject('risk-3', 'risk_state');
      
      await validator.transition(stateObject, 'warning');
      await validator.transition(stateObject, 'critical');
      const result = await validator.transition(stateObject, 'recovery');
      
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.new_state, 'recovery');
      }
    });

    it('recovery -> normal ✅', async () => {
      const { validator } = createValidator();
      const stateObject = validator.createStateObject('risk-4', 'risk_state');
      
      await validator.transition(stateObject, 'warning');
      await validator.transition(stateObject, 'critical');
      await validator.transition(stateObject, 'recovery');
      const result = await validator.transition(stateObject, 'normal');
      
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.new_state, 'normal');
      }
    });

    it('warning -> normal ✅ (de-escalation)', async () => {
      const { validator } = createValidator();
      const stateObject = validator.createStateObject('risk-5', 'risk_state');
      
      await validator.transition(stateObject, 'warning');
      const result = await validator.transition(stateObject, 'normal');
      
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.new_state, 'normal');
      }
    });

    it('critical -> warning ❌ (must go through recovery)', async () => {
      const { validator } = createValidator();
      const stateObject = validator.createStateObject('risk-6', 'risk_state');
      
      await validator.transition(stateObject, 'warning');
      await validator.transition(stateObject, 'critical');
      const result = await validator.transition(stateObject, 'warning');
      
      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.strictEqual(result.error, 'INVALID_TRANSITION');
      }
    });
  });

  describe('Deployments Flow', () => {
    it('planned -> in_progress ✅', async () => {
      const { validator } = createValidator();
      const stateObject = validator.createStateObject('deployment-1', 'deployments');
      
      const result = await validator.transition(stateObject, 'in_progress');
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.new_state, 'in_progress');
      }
    });

    it('in_progress -> validating ✅', async () => {
      const { validator } = createValidator();
      const stateObject = validator.createStateObject('deployment-2', 'deployments');
      
      await validator.transition(stateObject, 'in_progress');
      const result = await validator.transition(stateObject, 'validating');
      
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.new_state, 'validating');
      }
    });

    it('validating -> completed ✅', async () => {
      const { validator } = createValidator();
      const stateObject = validator.createStateObject('deployment-3', 'deployments');
      
      await validator.transition(stateObject, 'in_progress');
      await validator.transition(stateObject, 'validating');
      const result = await validator.transition(stateObject, 'completed');
      
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.new_state, 'completed');
      }
    });

    it('in_progress -> rolled_back ✅ (failure)', async () => {
      const { validator } = createValidator();
      const stateObject = validator.createStateObject('deployment-4', 'deployments');
      
      await validator.transition(stateObject, 'in_progress');
      const result = await validator.transition(stateObject, 'rolled_back');
      
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.new_state, 'rolled_back');
      }
    });

    it('validating -> rolled_back ✅', async () => {
      const { validator } = createValidator();
      const stateObject = validator.createStateObject('deployment-5', 'deployments');
      
      await validator.transition(stateObject, 'in_progress');
      await validator.transition(stateObject, 'validating');
      const result = await validator.transition(stateObject, 'rolled_back');
      
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.new_state, 'rolled_back');
      }
    });

    it('completed -> in_progress ❌', async () => {
      const { validator } = createValidator();
      const stateObject = validator.createStateObject('deployment-6', 'deployments');
      
      await validator.transition(stateObject, 'in_progress');
      await validator.transition(stateObject, 'validating');
      await validator.transition(stateObject, 'completed');
      const result = await validator.transition(stateObject, 'in_progress');
      
      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.strictEqual(result.error, 'TERMINAL_STATE');
      }
    });

    it('rolled_back -> planned ✅ (retry)', async () => {
      const { validator } = createValidator();
      const stateObject = validator.createStateObject('deployment-7', 'deployments');
      
      await validator.transition(stateObject, 'in_progress');
      await validator.transition(stateObject, 'rolled_back');
      const result = await validator.transition(stateObject, 'planned');
      
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.new_state, 'planned');
      }
    });
  });

  describe('Optimistic Locking', () => {
    it('版本号匹配时转换成功', async () => {
      const { validator } = createValidator();
      const stateObject = validator.createStateObject('approval-lock-1', 'approvals');
      
      const result = await validator.transition(stateObject, 'approved', 1);
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.new_state, 'approved');
        assert.strictEqual(stateObject.version, 2);
      }
    });

    it('版本号不匹配时失败', async () => {
      const { validator } = createValidator();
      const stateObject = validator.createStateObject('approval-lock-2', 'approvals');
      
      const result = await validator.transition(stateObject, 'approved', 999);
      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.strictEqual(result.error, 'CONCURRENT_MODIFICATION');
      }
    });
  });

  describe('Helper Functions', () => {
    describe('canTransition', () => {
      it('合法转换返回 true', () => {
        assert.strictEqual(canTransition('approvals', 'pending', 'approved'), true);
        assert.strictEqual(canTransition('incidents', 'open', 'acknowledged'), true);
        assert.strictEqual(canTransition('risk_state', 'normal', 'warning'), true);
        assert.strictEqual(canTransition('deployments', 'planned', 'in_progress'), true);
      });

      it('非法转换返回 false', () => {
        assert.strictEqual(canTransition('approvals', 'approved', 'pending'), false);
        assert.strictEqual(canTransition('incidents', 'resolved', 'open'), false);
        assert.strictEqual(canTransition('risk_state', 'critical', 'warning'), false);
        assert.strictEqual(canTransition('deployments', 'completed', 'in_progress'), false);
      });
    });

    describe('getAllowedTransitions', () => {
      it('返回允许的下一个状态列表', () => {
        const approvals = getAllowedTransitions('approvals', 'pending');
        assert.deepStrictEqual(approvals, ['approved', 'rejected']);

        const incidents = getAllowedTransitions('incidents', 'open');
        assert.deepStrictEqual(incidents, ['acknowledged', 'resolved']);

        const risk = getAllowedTransitions('risk_state', 'warning');
        assert.deepStrictEqual(risk, ['critical', 'normal']);

        const deployments = getAllowedTransitions('deployments', 'in_progress');
        assert.deepStrictEqual(deployments, ['validating', 'rolled_back']);
      });
    });

    describe('getAllStates', () => {
      it('返回状态机的所有状态', () => {
        const approvalStates = getAllStates('approvals');
        assert.ok(approvalStates.includes('pending'));
        assert.ok(approvalStates.includes('approved'));
        assert.ok(approvalStates.includes('rejected'));
        assert.ok(approvalStates.includes('resolved'));

        const riskStates = getAllStates('risk_state');
        assert.ok(riskStates.includes('normal'));
        assert.ok(riskStates.includes('warning'));
        assert.ok(riskStates.includes('critical'));
        assert.ok(riskStates.includes('recovery'));
      });
    });
  });

  describe('Audit Log', () => {
    it('状态转换被记录到审计日志', async () => {
      const { validator, audit } = createValidator();
      const stateObject = validator.createStateObject('approval-audit-1', 'approvals');
      
      await validator.transition(stateObject, 'approved');
      
      const transitionLogs = audit.getLogs('state_transition_completed');
      assert.strictEqual(transitionLogs.length, 1);
      assert.strictEqual(transitionLogs[0].metadata?.from, 'pending');
      assert.strictEqual(transitionLogs[0].metadata?.to, 'approved');
    });

    it('非法转换被拒绝并记录', async () => {
      const { validator, audit } = createValidator();
      const stateObject = validator.createStateObject('approval-audit-2', 'approvals');
      
      await validator.transition(stateObject, 'approved');
      await validator.transition(stateObject, 'pending'); // 非法
      
      const rejectedLogs = audit.getLogs('state_transition_rejected');
      assert.strictEqual(rejectedLogs.length, 1);
    });
  });
});
