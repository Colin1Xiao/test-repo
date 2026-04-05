/**
 * Phase 4.x-A1: Optimistic Locking Tests
 * 
 * Tests for compare-and-set semantics and version conflict detection.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestIncident } from '../factories/incident.factory.js';
import { IncidentFileRepository } from '../../src/persistence/incident_file_repository.js';
import { getAuditLogFileService } from '../../src/persistence/audit_log_file_service.js';
import { getTimelineStore, resetTimelineStore } from '../../src/alerting/timeline_integration.js';
import { TEST_DATA_DIR } from '../setup/jest.setup.js';

describe('Phase 4.x-A1: Optimistic Locking', () => {
  let repo: IncidentFileRepository;

  beforeEach(() => {
    repo = new IncidentFileRepository({
      dataDir: TEST_DATA_DIR,
      snapshotIntervalMs: 60000,
      backupCount: 3,
    });
  });

  describe('A1-1: Version Initialization', () => {
    it('应该初始化 version=1 当创建新 Incident', async () => {
      await repo.initialize();
      
      const incident = createTestIncident();
      await repo.create(incident);
      
      const retrieved = await repo.getById(incident.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.version).toBe(1);
    });

    it('应该允许显式设置 version (向后兼容)', async () => {
      await repo.initialize();
      
      const incident = createTestIncident({ version: 5 });
      await repo.create(incident);
      
      const retrieved = await repo.getById(incident.id);
      expect(retrieved!.version).toBe(5);
    });

    it('应该从旧数据加载时默认 version=1', async () => {
      await repo.initialize();
      
      // Simulate old incident without version
      const oldIncident = {
        ...createTestIncident(),
        version: undefined as any, // Simulate old data
      };
      
      // Create with version stripped (simulating old data)
      await repo.create({ ...oldIncident, version: 1 });
      
      const retrieved = await repo.getById(oldIncident.id);
      expect(retrieved!.version).toBe(1);
    });
  });

  describe('A1-2: Compare-And-Set Semantics', () => {
    it('应该在 version 匹配时更新成功', async () => {
      await repo.initialize();
      
      const incident = createTestIncident();
      await repo.create(incident);
      
      const result = await repo.update(incident.id, {
        status: 'investigating',
        updated_by: 'user1',
        version: 1, // Expected version
      });
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.incident.version).toBe(2);
        expect(result.incident.status).toBe('investigating');
      }
    });

    it('应该在 version 不匹配时拒绝更新', async () => {
      await repo.initialize();
      
      const incident = createTestIncident();
      await repo.create(incident);
      
      // First update succeeds
      await repo.update(incident.id, {
        status: 'investigating',
        updated_by: 'user1',
        version: 1,
      });
      
      // Second update with stale version fails
      const result = await repo.update(incident.id, {
        status: 'resolved',
        updated_by: 'user2',
        version: 1, // Stale version
      });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('VERSION_MISMATCH');
        expect(result.current_version).toBe(2);
      }
    });

    it('应该在不提供 version 时允许更新 (向后兼容)', async () => {
      await repo.initialize();
      
      const incident = createTestIncident();
      await repo.create(incident);
      
      // Update without version (backward compatible)
      const result = await repo.update(incident.id, {
        status: 'investigating',
        updated_by: 'user1',
        // No version specified
      });
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.incident.version).toBe(2);
      }
    });

    it('应该在 Incident 不存在时返回 NOT_FOUND', async () => {
      await repo.initialize();
      
      const result = await repo.update('non-existent-id', {
        status: 'resolved',
        updated_by: 'user1',
        version: 1,
      });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('NOT_FOUND');
      }
    });
  });

  describe('A1-3: Version Increment', () => {
    it('应该每次更新递增 version', async () => {
      await repo.initialize();
      
      const incident = createTestIncident();
      await repo.create(incident);
      
      // Update 1
      await repo.update(incident.id, {
        status: 'investigating',
        updated_by: 'user1',
        version: 1,
      });
      
      // Update 2
      await repo.update(incident.id, {
        status: 'resolved',
        updated_by: 'user2',
        version: 2,
      });
      
      const retrieved = await repo.getById(incident.id);
      expect(retrieved!.version).toBe(3);
    });

    it('应该验证 version 单调递增', async () => {
      await repo.initialize();
      
      const incident = createTestIncident();
      await repo.create(incident);
      
      let lastVersion = 1;
      for (let i = 0; i < 5; i++) {
        const result = await repo.update(incident.id, {
          status: 'investigating',
          updated_by: `user${i}`,
          version: lastVersion,
        });
        
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.incident.version).toBe(lastVersion + 1);
          lastVersion = result.incident.version;
        }
      }
      
      const retrieved = await repo.getById(incident.id);
      expect(retrieved!.version).toBe(6);
    });
  });

  describe('A1-4: Concurrent Update Simulation', () => {
    it('应该检测并发更新冲突', async () => {
      await repo.initialize();
      
      const incident = createTestIncident();
      await repo.create(incident);
      
      // Simulate two actors reading the same version
      const actor1Version = 1;
      const actor2Version = 1;
      
      // Actor 1 updates first
      const result1 = await repo.update(incident.id, {
        status: 'investigating',
        updated_by: 'actor1',
        version: actor1Version,
      });
      
      expect(result1.success).toBe(true);
      
      // Actor 2 tries to update with stale version
      const result2 = await repo.update(incident.id, {
        status: 'resolved',
        updated_by: 'actor2',
        version: actor2Version,
      });
      
      expect(result2.success).toBe(false);
      if (!result2.success) {
        expect(result2.error).toBe('VERSION_MISMATCH');
        expect(result2.current_version).toBe(2);
      }
    });

    it('应该允许正确 version 的后续更新', async () => {
      await repo.initialize();
      
      const incident = createTestIncident();
      await repo.create(incident);
      
      // Actor 1 updates
      await repo.update(incident.id, {
        status: 'investigating',
        updated_by: 'actor1',
        version: 1,
      });
      
      // Actor 2 reads new version and updates
      const result2 = await repo.update(incident.id, {
        status: 'resolved',
        updated_by: 'actor2',
        version: 2, // Correct new version
      });
      
      expect(result2.success).toBe(true);
      if (result2.success) {
        expect(result2.incident.status).toBe('resolved');
        expect(result2.incident.version).toBe(3);
      }
    });
  });

  describe('A1-3: Conflict Traceability', () => {
    beforeEach(async () => {
      // Initialize audit and timeline services
      const auditService = getAuditLogFileService();
      await auditService.initialize();
      resetTimelineStore();
    });

    it('应该在 version 冲突时写入 audit 记录', async () => {
      await repo.initialize();
      
      const incident = createTestIncident();
      await repo.create(incident);
      
      // First update succeeds
      await repo.update(incident.id, {
        status: 'investigating',
        updated_by: 'user1',
        version: 1,
      });
      
      // Second update with stale version fails
      const result = await repo.update(incident.id, {
        status: 'resolved',
        updated_by: 'user2',
        version: 1, // Stale version
      });
      
      expect(result.success).toBe(false);
      
      // Verify audit record exists
      const auditService = getAuditLogFileService();
      const auditEvents = await auditService.query({
        object_id: incident.id,
        event_type: 'write_conflict',
      });
      
      expect(auditEvents.length).toBeGreaterThanOrEqual(1);
      const conflictEvent = auditEvents.find(e => e.event_type === 'write_conflict');
      expect(conflictEvent).toBeDefined();
      if (conflictEvent) {
        expect(conflictEvent.metadata?.expected_version).toBe(1);
        expect(conflictEvent.metadata?.actual_version).toBe(2);
        expect(conflictEvent.actor_id).toBe('user2');
      }
    });

    it('应该在 version 冲突时写入 timeline 记录', async () => {
      await repo.initialize();
      
      const incident = createTestIncident();
      await repo.create(incident);
      
      // First update succeeds
      await repo.update(incident.id, {
        status: 'investigating',
        updated_by: 'user1',
        version: 1,
      });
      
      // Second update with stale version fails
      await repo.update(incident.id, {
        status: 'resolved',
        updated_by: 'user2',
        version: 1, // Stale version
      });
      
      // Verify timeline record exists
      const timelineStore = getTimelineStore();
      const timelineEvents = await timelineStore.query({ incident_id: incident.id });
      
      const conflictEvent = timelineEvents.find(e => e.type === 'update_conflict');
      expect(conflictEvent).toBeDefined();
      if (conflictEvent) {
        expect(conflictEvent.metadata?.reason).toBe('VERSION_MISMATCH');
        expect(conflictEvent.metadata?.expected_version).toBe(1);
        expect(conflictEvent.metadata?.actual_version).toBe(2);
        expect(conflictEvent.metadata?.actor).toBe('user2');
      }
    });

    it('应该验证 conflict 记录包含完整字段', async () => {
      await repo.initialize();
      
      const incident = createTestIncident();
      await repo.create(incident);
      
      // Trigger conflict
      await repo.update(incident.id, {
        status: 'investigating',
        updated_by: 'user1',
        version: 1,
      });
      
      await repo.update(incident.id, {
        status: 'resolved',
        updated_by: 'user2',
        version: 1, // Stale
      });
      
      // Verify audit fields
      const auditService = getAuditLogFileService();
      const auditEvents = await auditService.query({ object_id: incident.id });
      const conflictAudit = auditEvents.find(e => e.event_type === 'write_conflict');
      
      expect(conflictAudit).toBeDefined();
      if (conflictAudit) {
        expect(conflictAudit.object_type).toBe('incident');
        expect(conflictAudit.object_id).toBe(incident.id);
        expect(conflictAudit.metadata?.attempted_change).toBeDefined();
        expect(conflictAudit.metadata?.correlation_id).toBeDefined();
      }
      
      // Verify timeline fields
      const timelineStore = getTimelineStore();
      const timelineEvents = await timelineStore.query({ incident_id: incident.id });
      const conflictTimeline = timelineEvents.find(e => e.type === 'update_conflict');
      
      expect(conflictTimeline).toBeDefined();
      if (conflictTimeline) {
        expect(conflictTimeline.incident_id).toBe(incident.id);
        expect(conflictTimeline.correlation_id).toBeDefined();
        expect(conflictTimeline.timestamp).toBeGreaterThan(0);
      }
    });

    it('应该验证 conflict 记录与 incident 关联', async () => {
      await repo.initialize();
      
      const incident = createTestIncident();
      await repo.create(incident);
      
      // Trigger conflict
      await repo.update(incident.id, {
        status: 'investigating',
        updated_by: 'user1',
        version: 1,
      });
      
      await repo.update(incident.id, {
        status: 'resolved',
        updated_by: 'user2',
        version: 1, // Stale
      });
      
      // Verify correlation_id consistency
      const auditService = getAuditLogFileService();
      const auditEvents = await auditService.query({ object_id: incident.id });
      const conflictAudit = auditEvents.find(e => e.event_type === 'write_conflict');
      
      const timelineStore = getTimelineStore();
      const timelineEvents = await timelineStore.query({ incident_id: incident.id });
      const conflictTimeline = timelineEvents.find(e => e.type === 'update_conflict');
      
      // Both should have same correlation_id
      if (conflictAudit && conflictTimeline) {
        expect(conflictTimeline.correlation_id).toBe(conflictAudit.metadata?.correlation_id);
      }
    });
  });
});
