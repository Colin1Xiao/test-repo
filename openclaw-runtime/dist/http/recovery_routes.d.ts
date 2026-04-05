/**
 * Phase 2E-4B: Recovery HTTP Routes
 *
 * 将 Recovery Coordinator 和 State Sequence Validator 集成到 HTTP Server
 */
import { Router } from 'express';
import { RedisClient } from '../coordination/redis_client.js';
import { AuditLogFileService } from '../persistence/audit_log_file_service.js';
export declare function createRecoveryRoutes(redis: RedisClient, audit: AuditLogFileService, instanceId: string): Router;
//# sourceMappingURL=recovery_routes.d.ts.map