/**
 * P0 告警闭环：告警输入源对接
 *
 * 从现有监控系统/日志读取告警，送入 Alert Router
 */
export interface RawAlert {
    alert_name: string;
    alert_value?: string;
    resource?: string;
    correlation_id?: string;
    triggered_at?: number;
    metadata?: Record<string, unknown>;
}
export interface IngestedAlert extends RawAlert {
    ingested_at: number;
    routed: boolean;
    incident_id?: string;
    runbook_url?: string;
}
export interface AlertIngestConfig {
    auto_route: boolean;
    auto_create_incident: boolean;
    auto_open_runbook: boolean;
    silence_duplicates: boolean;
    duplicate_window_ms: number;
}
export declare class AlertIngestService {
    private router;
    private actionHandler;
    private timelineStore;
    private incidentRepo;
    private recentAlerts;
    private config;
    /**
     * Ingest a raw alert
     */
    ingest(rawAlert: RawAlert): Promise<IngestedAlert | null>;
    /**
     * Ingest multiple alerts (batch)
     */
    ingestBatch(alerts: RawAlert[]): Promise<IngestedAlert[]>;
    /**
     * Get duplicate key
     */
    private getDuplicateKey;
    /**
     * Update configuration
     */
    updateConfig(config: Partial<AlertIngestConfig>): void;
    /**
     * Get configuration
     */
    getConfig(): AlertIngestConfig;
    /**
     * Clear recent alerts (for testing)
     */
    clearRecentAlerts(): void;
}
export declare function getAlertIngestService(): AlertIngestService;
export declare function resetAlertIngestService(): void;
/**
 * Example: Ingest alert from monitoring system
 *
 * ```typescript
 * const ingestService = getAlertIngestService();
 *
 * // Simulate RedisDisconnected alert
 * const alert = await ingestService.ingest({
 *   alert_name: 'RedisDisconnected',
 *   alert_value: '0',
 *   resource: 'redis:primary',
 *   correlation_id: 'redis-001',
 *   metadata: { instance: 'redis-primary:6379' },
 * });
 *
 * console.log('Ingested:', alert);
 * ```
 */
//# sourceMappingURL=alert_ingest.d.ts.map