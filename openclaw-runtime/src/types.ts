/**
 * Runtime Types
 * 
 * Type definitions for runtime configuration and interfaces.
 */

// ==================== Configuration Types ====================

export interface CoreConfig {
  registry: {
    instanceIdFile: string;
    dataDir: string;
    heartbeatIntervalMs: number;
    autoHeartbeat: boolean;
  };
  lease: {
    dataDir: string;
    defaultTtlMs: number;
    maxTtlMs: number;
    autoCleanup?: boolean;
  };
  item: {
    dataDir: string;
    defaultLeaseTtlMs: number;
    autoCleanup?: boolean;
  };
  suppression: {
    dataDir: string;
    defaultTtlMs: number;
    scopeTtls: Record<string, number>;
    autoCleanup?: boolean;
    replaySafeMode?: boolean;
  };
}

export interface ModulesConfig {
  stale_cleanup?: {
    enabled: boolean;
    cleanupIntervalMs: number;
    staleThresholdMs: number;
  };
  snapshot?: {
    enabled: boolean;
    snapshotIntervalMs: number;
    maxSnapshots: number;
  };
  health_monitor?: {
    enabled: boolean;
    checkIntervalMs: number;
    reportIntervalMs: number;
  };
  metrics?: {
    enabled: boolean;
    collectIntervalMs: number;
    retentionHours: number;
  };
}

export interface PluginsConfig {
  [name: string]: {
    enabled: boolean;
    endpoint?: string;
    timeout_ms?: number;
    retry_count?: number;
    [key: string]: any;
  };
}

export interface FeatureFlagsConfig {
  core?: {
    registry?: { enabled: boolean; dynamic: boolean };
    lease?: { enabled: boolean; dynamic: boolean };
    item?: { enabled: boolean; dynamic: boolean };
    suppression?: { enabled: boolean; dynamic: boolean };
    [name: string]: { enabled: boolean; dynamic: boolean } | undefined;
  };
  modules?: {
    stale_cleanup?: { enabled: boolean; dynamic: boolean };
    snapshot?: { enabled: boolean; dynamic: boolean };
    health_monitor?: { enabled: boolean; dynamic: boolean };
    metrics?: { enabled: boolean; dynamic: boolean };
    [name: string]: { enabled: boolean; dynamic: boolean } | undefined;
  };
  plugins?: {
    [name: string]: {
      enabled: boolean;
      dynamic: boolean;
    };
  };
}

export interface RuntimeConfig {
  core: CoreConfig;
  modules: ModulesConfig;
  plugins: PluginsConfig;
  featureFlags?: FeatureFlagsConfig;
}

// ==================== Runtime Interface ====================

export interface Runtime {
  config: RuntimeConfig;
  registry: any;
  leaseManager: any;
  itemCoordinator: any;
  suppressionManager: any;
  modules: Record<string, any>;
  plugins: Record<string, any>;

  shutdown(): Promise<void>;
  getHealth(): Promise<any>;
  getMetrics(): Promise<any>;
  getDiagnostics(): Promise<any>;
  updateFeatureFlag(flagPath: string, enabled: boolean): Promise<boolean>;
}

// ==================== Health Types ====================

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  components: Record<string, ComponentHealth>;
  resources?: ResourceUsage;
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'disabled';
  latency_ms?: number;
  last_check?: string;
  error?: string;
}

export interface ResourceUsage {
  memory_heap_used_mb: number;
  memory_heap_total_mb: number;
  file_handle_count?: number;
  disk_used_gb?: number;
}

// ==================== Metrics Types ====================

export interface Metrics {
  timestamp: string;
  counters: Record<string, number>;
  gauges: Record<string, number>;
  histograms: Record<string, HistogramData>;
}

export interface HistogramData {
  buckets: Array<{ le: number; count: number }>;
  sum: number;
  count: number;
}

// ==================== Diagnostics Types ====================

export interface Diagnostics {
  timestamp: string;
  version: string;
  uptime_ms: number;
  git_commit?: string;
  build_time?: string;
  config: RuntimeConfig;
  coordination?: CoordinationDiagnostics;
  performance?: PerformanceDiagnostics;
  resources?: ResourceUsage;
  recent_events?: DiagnosticEvent[];
}

export interface CoordinationDiagnostics {
  active_leases: number;
  active_items: number;
  stale_leases: number;
  suppression_records: number;
}

export interface PerformanceDiagnostics {
  acquire_latency_p50_ms: number;
  acquire_latency_p99_ms: number;
  claim_latency_p50_ms: number;
  claim_latency_p99_ms: number;
  suppression_latency_p50_ms: number;
  suppression_latency_p99_ms: number;
}

export interface DiagnosticEvent {
  timestamp: string;
  type: string;
  message: string;
  severity: 'info' | 'warn' | 'error' | 'critical';
}

// ==================== Feature Flag Types ====================

export interface FeatureFlagUpdate {
  flagPath: string;
  oldValue: boolean;
  newValue: boolean;
  timestamp: string;
  updatedBy?: string;
}

// ==================== Plugin Types ====================

export interface Plugin {
  name: string;
  version: string;
  initialize(config: any): Promise<void>;
  shutdown(): Promise<void>;
  health?(): Promise<PluginHealth>;
  [key: string]: any;
}

export interface PluginHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  details?: Record<string, any>;
}

// ==================== Event Types ====================

export type RuntimeEvent =
  | { type: 'runtime_started'; timestamp: string }
  | { type: 'runtime_stopped'; timestamp: string }
  | { type: 'component_initialized'; component: string; timestamp: string }
  | { type: 'component_shutdown'; component: string; timestamp: string }
  | { type: 'component_error'; component: string; error: string; timestamp: string }
  | { type: 'feature_flag_updated'; flagPath: string; enabled: boolean; timestamp: string }
  | { type: 'plugin_loaded'; plugin: string; timestamp: string }
  | { type: 'plugin_failed'; plugin: string; error: string; timestamp: string };

// ==================== Error Types ====================

export class RuntimeError extends Error {
  constructor(
    message: string,
    public code: string,
    public component?: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'RuntimeError';
  }
}

export class BootstrapError extends RuntimeError {
  constructor(message: string, component?: string, cause?: Error) {
    super(message, 'BOOTSTRAP_ERROR', component, cause);
    this.name = 'BootstrapError';
  }
}

export class ComponentInitializationError extends RuntimeError {
  constructor(component: string, message: string, cause?: Error) {
    super(message, 'COMPONENT_INIT_ERROR', component, cause);
    this.name = 'ComponentInitializationError';
  }
}

export class PluginLoadError extends RuntimeError {
  constructor(plugin: string, message: string, cause?: Error) {
    super(message, 'PLUGIN_LOAD_ERROR', plugin, cause);
    this.name = 'PluginLoadError';
  }
}

export class FeatureFlagError extends RuntimeError {
  constructor(message: string, public flagPath?: string) {
    super(message, 'FEATURE_FLAG_ERROR');
    this.name = 'FeatureFlagError';
  }
}
