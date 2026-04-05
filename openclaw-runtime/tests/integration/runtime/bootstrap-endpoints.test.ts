/**
 * Bootstrap Endpoints Test
 * 
 * Verifies:
 * - Health endpoint returns correct structure
 * - Metrics endpoint works
 * - Diagnostics endpoint returns configuration
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { bootstrap } from 'src/bootstrap.js';
import type { Runtime } from 'src/types.js';

describe('Bootstrap Endpoints', () => {
  let runtime: Runtime;
  const testDataDir = `/tmp/runtime-endpoints-test-${Date.now()}`;

  afterEach(async () => {
    if (runtime) {
      await runtime.shutdown();
    }
  });

  it('应该 health 端点返回正确结构', async () => {
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

    const health = await runtime.getHealth();

    expect(health).toBeDefined();
    expect(health.status).toBe('healthy');
    expect(health.timestamp).toBeDefined();
    expect(health.components).toBeDefined();
    expect(health.components.registry).toBeDefined();
    expect(health.components.lease_manager).toBeDefined();
    expect(health.components.item_coordinator).toBeDefined();
    expect(health.components.suppression_manager).toBeDefined();
  });

  it('应该 metrics 端点工作', async () => {
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

    const metrics = await runtime.getMetrics();

    // Metrics endpoint should not throw
    expect(metrics).toBeDefined();
  });

  it('应该 diagnostics 端点返回配置', async () => {
    const customConfig = {
      core: {
        registry: {
          instanceIdFile: `${testDataDir}/instance_id.json`,
          dataDir: `${testDataDir}/registry`,
          heartbeatIntervalMs: 60000,
          autoHeartbeat: false,
        },
        lease: {
          dataDir: `${testDataDir}/leases`,
          defaultTtlMs: 60000,
          maxTtlMs: 600000,
          autoCleanup: false,
        },
        item: {
          dataDir: `${testDataDir}/items`,
          defaultLeaseTtlMs: 60000,
          autoCleanup: false,
        },
        suppression: {
          dataDir: `${testDataDir}/suppression`,
          defaultTtlMs: 120000,
          scopeTtls: { test: 10000 },
          autoCleanup: false,
        },
      },
    };

    runtime = await bootstrap(customConfig);

    const diagnostics = await runtime.getDiagnostics();

    expect(diagnostics).toBeDefined();
    expect(diagnostics.timestamp).toBeDefined();
    expect(diagnostics.version).toBe('0.1.0');
    expect(diagnostics.config).toBeDefined();
    expect(diagnostics.config.core.lease.defaultTtlMs).toBe(60000);
  });
});
