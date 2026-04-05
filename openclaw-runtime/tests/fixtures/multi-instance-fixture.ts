/**
 * Phase 4.x-B1: Multi-Instance Test Fixture
 * 
 * 提供共享存储的多实例测试环境：
 * - 2-4 个实例共享同一套持久化文件
 * - 独立注入不同 instance_id/session_id
 * - 统一的临时共享目录 / snapshot / log 视图
 */

import { InstanceRegistry } from 'src/coordination/instance_registry.js';
import { LeaseManager } from 'src/coordination/lease_manager.js';
import { WorkItemCoordinator } from 'src/coordination/work_item_coordinator.js';
import { DuplicateSuppressionManager } from 'src/coordination/duplicate_suppression_manager.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';

export interface MultiInstanceFixture {
  dataDir: string;
  sharedDataDir: string;
  instances: TestInstance[];
  // Shared components for direct access
  sharedRegistry: InstanceRegistry;
  sharedLeaseManager: LeaseManager;
}

export interface TestInstance {
  id: number;
  instanceId: string;
  sessionId: string;
  // Reference to shared components
  registry: InstanceRegistry;
  leaseManager: LeaseManager;
  // Per-instance components (with injected identity)
  itemCoordinator: WorkItemCoordinator;
  suppressionManager: DuplicateSuppressionManager;
}

export interface MultiInstanceConfig {
  instanceCount: number;
  sharedLeaseTtlMs?: number;
  sharedItemLeaseTtlMs?: number;
  sharedSuppressionTtlMs?: number;
}

/**
 * 创建共享存储的多实例测试环境
 */
export async function createMultiInstanceFixture(
  config: MultiInstanceConfig = { instanceCount: 3 }
): Promise<MultiInstanceFixture> {
  const testId = randomUUID();
  const baseDir = join(tmpdir(), `test-b1-${testId}`);
  const sharedDataDir = join(baseDir, 'shared');

  // Create shared data directory
  await fs.mkdir(sharedDataDir, { recursive: true });

  // Create instance identity files
  const identities: Array<{ instanceId: string; sessionId: string; identityFile: string }> = [];
  for (let i = 1; i <= config.instanceCount; i++) {
    const instanceId = `instance-${testId}-${i}`;
    const sessionId = `session-${testId}-${i}-${randomUUID().slice(0, 8)}`;

    // Create instance-specific directory
    const instanceDir = join(baseDir, `instance${i}`);
    await fs.mkdir(instanceDir, { recursive: true });

    // Create instance identity file
    const identityFile = join(instanceDir, 'instance_id.json');
    await fs.writeFile(
      identityFile,
      JSON.stringify({
        instance_id: instanceId,
        session_id: sessionId,
        instance_name: `test-instance-${i}`,
        node_info: {
          hostname: 'localhost',
          pid: process.pid,
          started_at: Date.now(),
        },
        last_heartbeat: Date.now(),
        status: 'active',
      }),
      'utf-8'
    );
    identities.push({ instanceId, sessionId, identityFile });
  }

  // Setup SINGLE shared Instance Registry (using first identity file for initialization)
  const sharedRegistry = new InstanceRegistry({
    dataDir: sharedDataDir,
    instanceIdFile: identities[0].identityFile,
    autoHeartbeat: false,
  });
  await sharedRegistry.initialize();

  // Setup SINGLE shared Lease Manager
  const sharedLeaseManager = new LeaseManager({
    dataDir: sharedDataDir,
    registry: sharedRegistry,
    config: {
      default_ttl_ms: config.sharedLeaseTtlMs ?? 10000,
    },
    autoCleanup: false,
  });
  await sharedLeaseManager.initialize();

  const instances: TestInstance[] = [];

  // Create per-instance components with shared registry/lease manager
  for (let i = 0; i < config.instanceCount; i++) {
    const { instanceId, sessionId, identityFile } = identities[i];

    // Setup Work Item Coordinator (with shared data directory, unique identity)
    const itemCoordinator = new WorkItemCoordinator({
      dataDir: sharedDataDir,
      leaseManager: sharedLeaseManager,
      registry: sharedRegistry,
      config: {
        default_lease_ttl_ms: config.sharedItemLeaseTtlMs ?? 10000,
      },
      autoCleanup: false,
    });
    await itemCoordinator.initialize();

    // Setup Suppression Manager (with shared data directory)
    const suppressionManager = new DuplicateSuppressionManager({
      dataDir: sharedDataDir,
      config: {
        default_ttl_ms: config.sharedSuppressionTtlMs ?? 10000,
        scope_ttls: { test: 5000 },
      },
      autoCleanup: false,
    });
    await suppressionManager.initialize();

    instances.push({
      id: i + 1,
      instanceId,
      sessionId,
      registry: sharedRegistry,
      leaseManager: sharedLeaseManager,
      itemCoordinator,
      suppressionManager,
    });
  }

  return {
    dataDir: baseDir,
    sharedDataDir,
    instances,
    sharedRegistry,
    sharedLeaseManager,
  };
}

/**
 * 清理多实例测试环境
 */
export async function cleanupMultiInstanceFixture(fixture: MultiInstanceFixture): Promise<void> {
  // Shutdown per-instance components
  for (const instance of fixture.instances) {
    await instance.suppressionManager.shutdown();
    await instance.itemCoordinator.shutdown();
  }
  
  // Shutdown shared components once
  await fixture.sharedLeaseManager.shutdown();
  await fixture.sharedRegistry.shutdown();

  // Clean up data directory
  try {
    await fs.rm(fixture.dataDir, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
}

/**
 * 等待所有实例的异步操作完成
 */
export async function waitForAllInstances<T>(
  fixture: MultiInstanceFixture,
  operation: (instance: TestInstance) => Promise<T>
): Promise<T[]> {
  return Promise.all(fixture.instances.map(instance => operation(instance)));
}

/**
 * 并发执行操作（模拟真实并发场景）
 */
export async function concurrentExecute<T>(
  fixture: MultiInstanceFixture,
  operation: (instance: TestInstance) => Promise<T>,
  delayMs: number = 0
): Promise<T[]> {
  if (delayMs === 0) {
    return Promise.all(fixture.instances.map(instance => operation(instance)));
  }

  // Staggered execution for controlled concurrency
  return Promise.all(
    fixture.instances.map((instance, index) => {
      return new Promise<T>((resolve) => {
        setTimeout(async () => {
          try {
            const result = await operation(instance);
            resolve(result);
          } catch (error) {
            resolve(error as T);
          }
        }, index * delayMs);
      });
    })
  );
}
