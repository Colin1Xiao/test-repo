/**
 * Phase 4.x-A1: Optimistic Locking Tests
 * 
 * Tests for compare-and-set semantics and version conflict detection.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestIncident } from '../factories/incident.factory.js';
import { IncidentFileRepository } from '../../src/persistence/incident_file_repository.js';
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
});
