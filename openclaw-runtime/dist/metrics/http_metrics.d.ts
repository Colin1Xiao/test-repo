/**
 * Phase 3A-2: HTTP Metrics Middleware
 *
 * 自动采集 HTTP 请求指标。
 */
import { Request, Response, NextFunction } from 'express';
export declare function httpMetricsMiddleware(): (req: Request, res: Response, next: NextFunction) => void;
export declare function recordIdempotencyCreated(route: string): void;
export declare function recordIdempotencyHit(route: string): void;
export declare function recordIdempotencyInProgress(route: string, delta: number): void;
export declare function recordLockAcquireSuccess(resource: string): void;
export declare function recordLockAcquireFailure(resource: string, reason: string): void;
export declare function recordLockReleaseSuccess(resource: string): void;
export declare function recordLockContention(resource: string): void;
export declare function recordRecoverySessionStarted(): void;
export declare function recordRecoverySessionCompleted(): void;
export declare function recordRecoveryItemClaimSuccess(itemType: string): void;
export declare function recordRecoveryItemClaimFailure(itemType: string, reason: string): void;
export declare function recordStateTransitionAllowed(machine: string, from: string, to: string): void;
export declare function recordStateTransitionRejected(machine: string, from: string, to: string, reason: string): void;
export declare function recordRedisConnected(instance: string): void;
export declare function recordRedisDisconnected(instance: string): void;
export declare function recordAuditWriteSuccess(eventType: string): void;
export declare function recordAuditWriteFailure(eventType: string, reason: string): void;
//# sourceMappingURL=http_metrics.d.ts.map