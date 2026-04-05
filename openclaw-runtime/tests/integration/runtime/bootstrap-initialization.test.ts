/**
 * Bootstrap Initialization Test
 * 
 * Verifies:
 * - Core components initialize in correct order
 * - Default configuration works
 * - Custom configuration overrides work
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { bootstrap } from 'src/bootstrap.js';
import type { Runtime } from 'src/types.js';

describe('Bootstrap Initialization', () => {
  let runtime: Runtime;
  const testDataDir = `/tmp/runtime-test-${Date.now()}`;

  afterEach(async () => {
    if (runtime) {
      await runtime.shutdown();
    }
  });

  it('应该使用默认配置成功初始化', async () => {
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

    expect(runtime).toBeDefined();
    expect(runtime.registry).toBeDefined();
    expect(runtime.leaseManager).toBeDefined();
    expect(runtime.itemCoordinator).toBeDefined();
    expect(runtime.suppressionManager).toBeDefined();
  });

  it('应该 Core 组件按正确顺序初始化', async () => {
    const initOrder: string[] = [];

    // Mock console.log to capture init order
    const originalLog = console.log;
    console.log = (...args) => {
      const msg = args.join(' ');
      if (msg.includes('initialized')) {
        const match = msg.match(/✓ (.+) initialized/);
        if (match) {
          initOrder.push(match[1]);
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

      // Expected order: Registry → Lease Manager → Item Coordinator → Suppression Manager
      expect(initOrder).toEqual([
        'Instance Registry',
        'Lease Manager',
        'Work Item Coordinator',
        'Duplicate Suppression Manager',
      ]);
    } finally {
      console.log = originalLog;
    }
  });

  it('应该配置正确合并到 runtime.config', async () => {
    const customConfig = {
      core: {
        registry: {
          instanceIdFile: `${testDataDir}/instance_id.json`,
          dataDir: `${testDataDir}/registry`,
          heartbeatIntervalMs: 60000, // Custom value
          autoHeartbeat: false,
        },
        lease: {
          dataDir: `${testDataDir}/leases`,
          defaultTtlMs: 60000, // Custom value
          maxTtlMs: 600000,
          autoCleanup: false,
        },
        item: {
          dataDir: `${testDataDir}/items`,
          defaultLeaseTtlMs: 60000, // Custom value
          autoCleanup: false,
        },
        suppression: {
          dataDir: `${testDataDir}/suppression`,
          defaultTtlMs: 120000, // Custom value
          scopeTtls: { test: 10000 }, // Custom value
          autoCleanup: false,
        },
      },
    };

    runtime = await bootstrap(customConfig);

    expect(runtime.config.core.registry.heartbeatIntervalMs).toBe(60000);
    expect(runtime.config.core.lease.defaultTtlMs).toBe(60000);
    expect(runtime.config.core.item.defaultLeaseTtlMs).toBe(60000);
    expect(runtime.config.core.suppression.defaultTtlMs).toBe(120000);
  });
});
