/**
 * 业务服务运行面：统一启动入口
 *
 * 整合所有能力到单一可启动服务：
 * - Trading 路由 (approval/incident/replay/recovery/webhook)
 * - Alerting 路由 (ingest/actions)
 * - Observability (health/metrics/config)
 * - Coordination (lock/idempotency)
 * - Timeline / Incident / Audit
 */
import { Application } from 'express';
export interface ServerConfig {
    port: number;
    host: string;
    nodeEnv: string;
    metricsEnabled: boolean;
    metricsPort?: number;
}
export declare function createServer(): Application;
export declare function startServer(): Promise<void>;
//# sourceMappingURL=server.d.ts.map