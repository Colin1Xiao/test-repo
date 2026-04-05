/**
 * Bootstrap Shutdown Test
 * 
 * Verifies:
 * - Components shutdown in reverse order
 * - Graceful shutdown completes without errors
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { bootstrap } from '../../src/bootstrap.js';
import type { Runtime } from '../../src/types.js';

describe('Bootstrap Shutdown', () => {
  let runtime: Runtime;
  const testDataDir = `/tmp/runtime-shutdown-test-${Date.now()}`;

  afterEach(async () => {
    if (runtime) {
      await runtime.shutdown();
    }
  });

  it('应该组件按反向顺序关闭', async () => {
    const shutdownOrder: string[] = [];

    // Mock console.log to capture shutdown order
    const originalLog = console.log;
    console.log = (...args) => {
      const msg = args.join(' ');
      if (msg.includes('shut down')) {
        const match = msg.match(/✓ (.+) shut down/);
        if (match) {
          shutdownOrder.push(match[1]);
        }
      }
      originalLog(...args);
    };

    try {
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

      await runtime.shutdown();
      runtime = null as any;

      // Expected order (reverse of init): Suppression → Item → Lease → Registry
      expect(shutdownOrder).toEqual([
        'Duplicate Suppression Manager',
        'Work Item Coordinator',
        'Lease Manager',
        'Instance Registry',
      ]);
    } finally {
      console.log = originalLog;
    }
  });

  it('应该优雅关闭完成无错误', async () => {
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

    // Shutdown should not throw
    await expect(runtime.shutdown()).resolves.not.toThrow();
    runtime = null as any;
  });

  it('应该多次关闭不报错', async () => {
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

    // First shutdown
    await runtime.shutdown();
    
    // Second shutdown should not throw
    await expect(runtime.shutdown()).resolves.not.toThrow();
    runtime = null as any;
  });
});
