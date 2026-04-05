/**
 * Phase 2E-4B: Recovery Coordinator
 *
 * 负责 Recovery Session 的生命周期管理：
 * - startSession: 创建恢复会话
 * - renewSession: 续期会话（防止超时）
 * - claimItem: 声明 Item 所有权
 * - completeItem: 完成 Item 处理
 * - completeSession: 完成会话
 */
import { RedisClient } from '../coordination/redis_client.js';
import { AuditLogFileService } from '../persistence/audit_log_file_service.js';
export interface RecoverySession {
    session_id: string;
    owner_id: string;
    created_at: number;
    expires_at: number;
    status: 'active' | 'completed' | 'expired' | 'abandoned';
    items_total: number;
    items_claimed: number;
    items_completed: number;
    last_heartbeat: number;
}
export interface RecoveryItem {
    item_id: string;
    item_type: 'approval' | 'incident' | 'event' | 'deployment' | 'risk_state';
    correlation_id?: string;
    session_id?: string;
    claimed_at?: number;
    claimed_by?: string;
    status: 'pending' | 'claimed' | 'completed' | 'failed' | 'abandoned';
    retry_count: number;
    max_retries: number;
    created_at: number;
    expires_at?: number;
}
export type SessionStartResult = {
    success: true;
    session: RecoverySession;
} | {
    success: false;
    error: 'SESSION_EXISTS' | 'REDIS_ERROR' | 'INVALID_CONFIG';
    message: string;
};
export type SessionRenewResult = {
    success: true;
    session: RecoverySession;
} | {
    success: false;
    error: 'SESSION_NOT_FOUND' | 'SESSION_EXPIRED' | 'NOT_OWNER' | 'REDIS_ERROR';
    message: string;
};
export type ItemClaimResult = {
    success: true;
    item: RecoveryItem;
} | {
    success: false;
    error: 'ITEM_NOT_FOUND' | 'ITEM_ALREADY_CLAIMED' | 'ITEM_EXPIRED' | 'SESSION_INVALID' | 'REDIS_ERROR';
    message: string;
};
export type ItemCompleteResult = {
    success: true;
    item: RecoveryItem;
} | {
    success: false;
    error: 'ITEM_NOT_FOUND' | 'NOT_CLAIMED' | 'NOT_OWNER' | 'REDIS_ERROR';
    message: string;
};
export type SessionCompleteResult = {
    success: true;
    session: RecoverySession;
    items_remaining: RecoveryItem[];
} | {
    success: false;
    error: 'SESSION_NOT_FOUND' | 'NOT_OWNER' | 'INCOMPLETE_ITEMS' | 'REDIS_ERROR';
    message: string;
};
export interface RecoveryCoordinatorConfig {
    session_ttl_ms: number;
    session_heartbeat_interval_ms: number;
    item_claim_ttl_ms: number;
    item_max_retries: number;
    orphan_detection_interval_ms: number;
}
export declare const DEFAULT_RECOVERY_CONFIG: RecoveryCoordinatorConfig;
export declare class RecoveryCoordinator {
    private readonly redis;
    private readonly audit;
    private readonly config;
    private readonly instance_id;
    private static readonly SESSION_PREFIX;
    private static readonly ITEM_PREFIX;
    private static readonly SESSIONS_SET;
    constructor(redis: RedisClient, audit: AuditLogFileService, config: Partial<RecoveryCoordinatorConfig> | undefined, instance_id: string);
    /**
     * 启动 Recovery Session
     *
     * 原子操作：确保同一时间只有一个活跃 Session（单实例模式）
     * 多实例模式：使用分布式锁确保互斥
     */
    startSession(): Promise<SessionStartResult>;
    /**
     * 续期 Session
     *
     * 必须在过期前调用，否则 Session 会被标记为 expired
     */
    renewSession(session_id: string): Promise<SessionRenewResult>;
    /**
     * 完成 Session
     *
     * 可选：检查是否所有 Item 都已完成
     */
    completeSession(session_id: string, options?: {
        require_all_items_complete: boolean;
    }): Promise<SessionCompleteResult>;
    /**
     * 声明 Item 所有权
     *
     * 使用原子操作确保只有一个 Session 能 claim 同一个 Item
     */
    claimItem(item_id: string, session_id: string): Promise<ItemClaimResult>;
    /**
     * 完成 Item 处理
     */
    completeItem(item_id: string, session_id: string, options?: {
        success: boolean;
        error?: string;
    }): Promise<ItemCompleteResult>;
    private getActiveSession;
    private getSession;
    private getItem;
    private updateSession;
    private updateItem;
    /**
     * 原子 Claim Item（Lua 脚本）
     *
     * 确保在并发情况下只有一个请求能成功 claim
     */
    private atomicClaimItem;
    private getIncompleteItems;
    private generateSessionId;
}
//# sourceMappingURL=recovery_coordinator.d.ts.map