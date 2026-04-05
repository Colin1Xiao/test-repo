/**
 * P0 告警闭环：健康检查告警输入源
 *
 * 从 openclaw-health-check.json 读取系统健康状态，触发告警
 */
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
export declare class HealthCheckAlertIngest {
    private ingestService;
    private healthCheckPath;
    private lastKnownState;
    constructor(healthCheckPath?: string);
    /**
     * Check health and ingest alerts
     */
    checkAndIngest(): Promise<void>;
    /**
     * Check a single component
     */
    private checkComponent;
    /**
     * Trigger component alert
     */
    private triggerComponentAlert;
    /**
     * Map component to alert name
     */
    private mapComponentToAlert;
    /**
     * Read health check state
     */
    private readHealthCheck;
    /**
     * Clear last known state (for testing)
     */
    clearState(): void;
}
export declare function getHealthCheckAlertIngest(): HealthCheckAlertIngest;
export declare function resetHealthCheckAlertIngest(): void;
/**
 * Example: Check health and ingest alerts
 *
 * ```typescript
 * const healthIngest = getHealthCheckAlertIngest();
 * await healthIngest.checkAndIngest();
 * ```
 */
//# sourceMappingURL=health_check_ingest.d.ts.map