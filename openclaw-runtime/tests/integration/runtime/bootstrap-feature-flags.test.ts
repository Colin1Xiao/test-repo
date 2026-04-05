/**
 * Bootstrap Feature Flags Test
 * 
 * Verifies:
 * - Feature flags can be updated dynamically
 * - Non-dynamic flags cannot be updated
 * - Invalid flag paths are rejected
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { bootstrap } from 'src/bootstrap.js';
import type { Runtime } from 'src/types.js';

describe('Bootstrap Feature Flags', () => {
  let runtime: Runtime;
  const testDataDir = `/tmp/runtime-flags-test-${Date.now()}`;

  afterEach(async () => {
    if (runtime) {
      await runtime.shutdown();
    }
  });

  it('应该动态 feature flag 可以更新', async () => {
    runtime = await bootstrap({
      core: {
        registry: {
          instanceIdFile: `${testDataDir}/instance_id.json`,
          dataDir: `${testDataDir}/registry`,
          heartbeatIntervalMs: 30000,
          autoHeartbeat: false,
        },
        lease: {
          dataDir: `${testDataDir}/leases`,
          defaultTtlMs: 30000,
          maxTtlMs: 300000,
          autoCleanup: false,
        },
        item: {
          dataDir: `${testDataDir}/items`,
          defaultLeaseTtlMs: 30000,
          autoCleanup: false,
        },
        suppression: {
          dataDir: `${testDataDir}/suppression`,
          defaultTtlMs: 60000,
          scopeTtls: { test: 5000 },
          autoCleanup: false,
        },
      },
      featureFlags: {
        modules: {
          stale_cleanup: { enabled: false, dynamic: true },
        },
      },
    });

    // Update dynamic flag
    const result = await runtime.updateFeatureFlag('modules.stale_cleanup.enabled', true);

    expect(result).toBe(true);
  });

  it('应该非动态 feature flag 不能更新', async () => {
    runtime = await bootstrap({
      core: {
        registry: {
          instanceIdFile: `${testDataDir}/instance_id.json`,
          dataDir: `${testDataDir}/registry`,
          heartbeatIntervalMs: 30000,
          autoHeartbeat: false,
        },
        lease: {
          dataDir: `${testDataDir}/leases`,
          defaultTtlMs: 30000,
          maxTtlMs: 300000,
          autoCleanup: false,
        },
        item: {
          dataDir: `${testDataDir}/items`,
          defaultLeaseTtlMs: 30000,
          autoCleanup: false,
        },
        suppression: {
          dataDir: `${testDataDir}/suppression`,
          defaultTtlMs: 60000,
          scopeTtls: { test: 5000 },
          autoCleanup: false,
        },
      },
      featureFlags: {
        core: {
          lease: { enabled: true, dynamic: false }, // Non-dynamic
        },
      },
    });

    // Try to update non-dynamic flag
    await expect(runtime.updateFeatureFlag('core.lease.enabled', false))
      .rejects.toThrow('Flag is not dynamic');
  });

  it('应该无效 flag path 被拒绝', async () => {
    runtime = await bootstrap({
      core: {
        registry: {
          instanceIdFile: `${testDataDir}/instance_id.json`,
          dataDir: `${testDataDir}/registry`,
          heartbeatIntervalMs: 30000,
          autoHeartbeat: false,
        },
        lease: {
          dataDir: `${testDataDir}/leases`,
          defaultTtlMs: 30000,
          maxTtlMs: 300000,
          autoCleanup: false,
        },
        item: {
          dataDir: `${testDataDir}/items`,
          defaultLeaseTtlMs: 30000,
          autoCleanup: false,
        },
        suppression: {
          dataDir: `${testDataDir}/suppression`,
          defaultTtlMs: 60000,
          scopeTtls: { test: 5000 },
          autoCleanup: false,
        },
      },
    });

    // Invalid path format
    await expect(runtime.updateFeatureFlag('invalid_path', true))
      .rejects.toThrow('Invalid flag path');

    // Invalid field
    await expect(runtime.updateFeatureFlag('core.lease.dynamic', false))
      .rejects.toThrow('Invalid flag field');
  });

  it('应该不存在的 flag 被拒绝', async () => {
    runtime = await bootstrap({
      core: {
        registry: {
          instanceIdFile: `${testDataDir}/instance_id.json`,
          dataDir: `${testDataDir}/registry`,
          heartbeatIntervalMs: 30000,
          autoHeartbeat: false,
        },
        lease: {
          dataDir: `${testDataDir}/leases`,
          defaultTtlMs: 30000,
          maxTtlMs: 300000,
          autoCleanup: false,
        },
        item: {
          dataDir: `${testDataDir}/items`,
          defaultLeaseTtlMs: 30000,
          autoCleanup: false,
        },
        suppression: {
          dataDir: `${testDataDir}/suppression`,
          defaultTtlMs: 60000,
          scopeTtls: { test: 5000 },
          autoCleanup: false,
        },
      },
    });

    // Non-existent flag
    await expect(runtime.updateFeatureFlag('modules.non_existent.enabled', true))
      .rejects.toThrow('Flag not found');
  });
});
