/**
 * Runtime Bootstrap
 * 
 * Initializes and orchestrates all runtime components:
 * - Core components (always enabled)
 * - Module components (conditionally enabled)
 * - Plugin components (conditionally enabled)
 * 
 * Usage:
 * ```typescript
 * const runtime = await bootstrap(config);
 * // ... use runtime ...
 * await runtime.shutdown();
 * ```
 */

import { InstanceRegistry } from 'src/coordination/instance_registry.js';
import { LeaseManager } from 'src/coordination/lease_manager.js';
import { WorkItemCoordinator } from 'src/coordination/work_item_coordinator.js';
import { DuplicateSuppressionManager } from 'src/coordination/duplicate_suppression_manager.js';

import type { RuntimeConfig, Runtime } from 'src/types.js';

// ==================== Default Configuration ====================

const DEFAULT_CONFIG: RuntimeConfig = {
  core: {
    registry: {
      instanceIdFile: './data/instance_id.json',
      dataDir: './data/registry',
      heartbeatIntervalMs: 30000,
      autoHeartbeat: true,
    },
    lease: {
      dataDir: './data/leases',
      defaultTtlMs: 30000,
      maxTtlMs: 300000,
      autoCleanup: true,
    },
    item: {
      dataDir: './data/items',
      defaultLeaseTtlMs: 30000,
      autoCleanup: true,
    },
    suppression: {
      dataDir: './data/suppression',
      defaultTtlMs: 60000,
      scopeTtls: {
        alert_ingest: 60000,
        webhook_ingest: 30000,
        incident_transition: 300000,
        work_item_claim: 30000,
        recovery_scan: 300000,
        replay_run: 60000,
        connector_sync: 300000,
        global: 60000,
        test: 5000,
      },
      autoCleanup: true,
      replaySafeMode: true,
    },
  },
  modules: {},
  plugins: {},
  featureFlags: {
    core: {
      lease: { enabled: true, dynamic: false },
      item: { enabled: true, dynamic: false },
      suppression: { enabled: true, dynamic: false },
    },
    modules: {},
    plugins: {},
  },
};

// ==================== Bootstrap Function ====================

export async function bootstrap(config: Partial<RuntimeConfig> = {}): Promise<Runtime> {
  // Merge with default config
  const fullConfig: RuntimeConfig = {
    core: {
      registry: { ...DEFAULT_CONFIG.core.registry, ...config.core?.registry },
      lease: { ...DEFAULT_CONFIG.core.lease, ...config.core?.lease },
      item: { ...DEFAULT_CONFIG.core.item, ...config.core?.item },
      suppression: { ...DEFAULT_CONFIG.core.suppression, ...config.core?.suppression },
    },
    modules: config.modules || {},
    plugins: config.plugins || {},
    featureFlags: config.featureFlags || DEFAULT_CONFIG.featureFlags,
  };

  console.log('[Bootstrap] Starting runtime initialization...');

  // ==================== Core Components (Always Enabled) ====================

  console.log('[Bootstrap] Initializing core components...');

  // Instance Registry
  const registry = new InstanceRegistry(fullConfig.core.registry);
  await registry.initialize();
  console.log('[Bootstrap] ✓ Instance Registry initialized');

  // Lease Manager
  const leaseManager = new LeaseManager({
    dataDir: fullConfig.core.lease.dataDir,
    registry,
    config: {
      default_ttl_ms: fullConfig.core.lease.defaultTtlMs,
      max_ttl_ms: fullConfig.core.lease.maxTtlMs,
    },
    autoCleanup: fullConfig.core.lease.autoCleanup,
  });
  await leaseManager.initialize();
  console.log('[Bootstrap] ✓ Lease Manager initialized');

  // Work Item Coordinator
  const itemCoordinator = new WorkItemCoordinator({
    dataDir: fullConfig.core.item.dataDir,
    leaseManager,
    registry,
    config: {
      default_lease_ttl_ms: fullConfig.core.item.defaultLeaseTtlMs,
    },
    autoCleanup: fullConfig.core.item.autoCleanup,
  });
  await itemCoordinator.initialize();
  console.log('[Bootstrap] ✓ Work Item Coordinator initialized');

  // Duplicate Suppression Manager
  const suppressionManager = new DuplicateSuppressionManager({
    dataDir: fullConfig.core.suppression.dataDir,
    config: {
      default_ttl_ms: fullConfig.core.suppression.defaultTtlMs,
      scope_ttls: fullConfig.core.suppression.scopeTtls,
    },
    autoCleanup: fullConfig.core.suppression.autoCleanup,
  });
  await suppressionManager.initialize();
  console.log('[Bootstrap] ✓ Duplicate Suppression Manager initialized');

  // ==================== Create Runtime Instance ====================

  const runtime: Runtime = {
    config: fullConfig,
    registry,
    leaseManager,
    itemCoordinator,
    suppressionManager,
    modules: {},
    plugins: {},

    async shutdown() {
      console.log('[Bootstrap] Shutting down runtime...');

      await suppressionManager.shutdown();
      console.log('[Bootstrap] ✓ Duplicate Suppression Manager shut down');

      await itemCoordinator.shutdown();
      console.log('[Bootstrap] ✓ Work Item Coordinator shut down');

      await leaseManager.shutdown();
      console.log('[Bootstrap] ✓ Lease Manager shut down');

      await registry.shutdown();
      console.log('[Bootstrap] ✓ Instance Registry shut down');

      console.log('[Bootstrap] Runtime shut down complete');
    },

    async getHealth() {
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        components: {
          registry: { status: 'healthy' },
          lease_manager: { status: 'healthy' },
          item_coordinator: { status: 'healthy' },
          suppression_manager: { status: 'healthy' },
        },
      };
    },

    async getMetrics() {
      return {};
    },

    async getDiagnostics() {
      return {
        timestamp: new Date().toISOString(),
        version: '0.1.0',
        uptime_ms: Date.now(),
        config: fullConfig,
      };
    },

    async updateFeatureFlag(flagPath: string, enabled: boolean): Promise<boolean> {
      const parts = flagPath.split('.');
      if (parts.length !== 3) {
        throw new Error(`Invalid flag path: ${flagPath}. Expected format: 'type.name.enabled'`);
      }

      const [type, name, field] = parts;
      if (field !== 'enabled') {
        throw new Error(`Invalid flag field: ${field}. Only 'enabled' can be modified.`);
      }

      const flagConfig = fullConfig.featureFlags?.[type as keyof typeof fullConfig.featureFlags]?.[name];
      if (!flagConfig) {
        throw new Error(`Flag not found: ${flagPath}`);
      }

      if (!(flagConfig as any).dynamic) {
        throw new Error(`Flag is not dynamic: ${flagPath}`);
      }

      (flagConfig as any).enabled = enabled;

      console.log(`[Bootstrap] Feature flag updated: ${flagPath} = ${enabled}`);
      return true;
    },
  };

  console.log('[Bootstrap] Runtime initialization complete ✓');
  return runtime;
}
