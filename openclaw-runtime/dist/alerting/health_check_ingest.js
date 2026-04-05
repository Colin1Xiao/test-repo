/**
 * P0 告警闭环：健康检查告警输入源
 *
 * 从 openclaw-health-check.json 读取系统健康状态，触发告警
 */
import { readFileSync } from 'fs';
import { getAlertIngestService } from './alert_ingest.js';
// ==================== Health Check Alert Ingest ====================
export class HealthCheckAlertIngest {
    ingestService = getAlertIngestService();
    healthCheckPath;
    lastKnownState = new Map();
    constructor(healthCheckPath = '/Users/colin/.openclaw/workspace/openclaw-health-check.json') {
        this.healthCheckPath = healthCheckPath;
    }
    /**
     * Check health and ingest alerts
     */
    async checkAndIngest() {
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
        }
        catch (error) {
            console.error('Failed to check health:', error);
        }
    }
    /**
     * Check a single component
     */
    async checkComponent(name, component) {
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
    async triggerComponentAlert(name, component) {
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
    mapComponentToAlert(name, severity) {
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
        }
        else {
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
    readHealthCheck() {
        try {
            const content = readFileSync(this.healthCheckPath, 'utf-8');
            return JSON.parse(content);
        }
        catch (error) {
            console.warn(`Failed to read health check: ${error}`);
            return null;
        }
    }
    /**
     * Clear last known state (for testing)
     */
    clearState() {
        this.lastKnownState.clear();
    }
}
// ==================== Singleton ====================
let _ingest = null;
export function getHealthCheckAlertIngest() {
    if (!_ingest) {
        _ingest = new HealthCheckAlertIngest();
    }
    return _ingest;
}
export function resetHealthCheckAlertIngest() {
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
//# sourceMappingURL=health_check_ingest.js.map