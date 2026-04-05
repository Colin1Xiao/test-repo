/**
 * P0 告警闭环：健康检查告警输入源
 * 
 * 从 openclaw-health-check.json 读取系统健康状态，触发告警
 */

import { readFileSync } from 'fs';
import { getAlertIngestService } from './alert_ingest.js';

// ==================== Types ====================

export interface HealthCheckState {
  schema: string;
  lastUpdated: string;
  changed: boolean;
  previousStatus?: string;
  components: {
    gateway?: {
      status: string;
      severity: number;
      port?: number;
      errors?: string[];
    };
    telegram?: {
      status: string;
      severity: number;
      errors?: string[];
    };
    memorySearch?: {
      status: string;
      severity: number;
      provider?: string;
      errors?: string[];
    };
    cron?: {
      status: string;
      severity: number;
      errors?: string[];
    };
  };
  overall: {
    status: string;
    emoji: string;
    severity: number;
  };
  system: {
    version: string;
    nodeVersion: string;
    platform: string;
    arch: string;
  };
}

// ==================== Health Check Alert Ingest ====================

export class HealthCheckAlertIngest {
  private ingestService = getAlertIngestService();
  private healthCheckPath: string;
  private lastKnownState: Map<string, string> = new Map();

  constructor(healthCheckPath: string = '/Users/colin/.openclaw/workspace/openclaw-health-check.json') {
    this.healthCheckPath = healthCheckPath;
  }

  /**
   * Check health and ingest alerts
   */
  async checkAndIngest(): Promise<void> {
    try {
      const state = this.readHealthCheck();
      if (!state) {
        return;
      }

      // Check each component
      await this.checkComponent('gateway', state.components.gateway);
      await this.checkComponent('telegram', state.components.telegram);
      await this.checkComponent('memorySearch', state.components.memorySearch);
      await this.checkComponent('cron', state.components.cron);

      // Check overall status
      if (state.overall.severity > 0) {
        console.log(`⚠️  Overall system status: ${state.overall.emoji} ${state.overall.status}`);
      }
    } catch (error) {
      console.error('Failed to check health:', error);
    }
  }

  /**
   * Check a single component
   */
  private async checkComponent(name: string, component?: { status: string; severity: number; errors?: string[] }): Promise<void> {
    if (!component) {
      return;
    }

    const previousStatus = this.lastKnownState.get(name);
    const currentStatus = component.status;

    // Detect status change
    if (previousStatus && previousStatus !== currentStatus) {
      console.log(`📢 Component ${name} status changed: ${previousStatus} → ${currentStatus}`);

      // Trigger alert based on severity
      if (component.severity > 0) {
        await this.triggerComponentAlert(name, component);
      }
    }

    // Update last known state
    this.lastKnownState.set(name, currentStatus);
  }

  /**
   * Trigger component alert
   */
  private async triggerComponentAlert(name: string, component: { status: string; severity: number; errors?: string[] }): Promise<void> {
    const alertName = this.mapComponentToAlert(name, component.severity);
    const resource = `component:${name}`;
    const correlation_id = `health-${name}-${Date.now()}`;

    console.log(`🚨 Triggering alert: ${alertName} for ${name} (severity: ${component.severity})`);

    await this.ingestService.ingest({
      alert_name: alertName,
      alert_value: component.status,
      resource,
      correlation_id,
      metadata: {
        component: name,
        status: component.status,
        severity: component.severity,
        errors: component.errors,
      },
    });
  }

  /**
   * Map component to alert name
   */
  private mapComponentToAlert(name: string, severity: number): string {
    // Map to P0 alerts based on component and severity
    if (severity >= 2) {
      // Critical
      switch (name) {
        case 'gateway':
          return 'RedisDisconnected'; // Gateway depends on Redis
        case 'telegram':
          return 'WebhookIngestErrorSpike'; // Communication failure
        default:
          return 'AuditWriteFailure';
      }
    } else {
      // Warning
      switch (name) {
        case 'gateway':
          return 'LockAcquireFailureSpike';
        default:
          return 'StateTransitionRejectSpike';
      }
    }
  }

  /**
   * Read health check state
   */
  private readHealthCheck(): HealthCheckState | null {
    try {
      const content = readFileSync(this.healthCheckPath, 'utf-8');
      return JSON.parse(content) as HealthCheckState;
    } catch (error) {
      console.warn(`Failed to read health check: ${error}`);
      return null;
    }
  }

  /**
   * Clear last known state (for testing)
   */
  clearState(): void {
    this.lastKnownState.clear();
  }
}

// ==================== Singleton ====================

let _ingest: HealthCheckAlertIngest | null = null;

export function getHealthCheckAlertIngest(): HealthCheckAlertIngest {
  if (!_ingest) {
    _ingest = new HealthCheckAlertIngest();
  }
  return _ingest;
}

export function resetHealthCheckAlertIngest(): void {
  _ingest = null;
}

// ==================== Example Usage ====================

/**
 * Example: Check health and ingest alerts
 * 
 * ```typescript
 * const healthIngest = getHealthCheckAlertIngest();
 * await healthIngest.checkAndIngest();
 * ```
 */
