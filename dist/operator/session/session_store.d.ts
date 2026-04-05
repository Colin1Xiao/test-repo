/**
 * Session Store
 * Phase 2A-2A - 会话存储
 *
 * 职责：
 * - 创建 Session
 * - 读取 Session
 * - 更新 Session
 * - 更新 Navigation State
 * - 关闭 Session
 */
import type { OperatorSession, CreateSessionInput, UpdateNavigationInput, SessionStore } from '../types/session_types';
export interface SessionStoreConfig {
    /** Session 过期时间（毫秒，默认 24 小时） */
    sessionTtlMs?: number;
    /** 自动清理过期 Session 间隔（毫秒） */
    cleanupIntervalMs?: number;
}
export declare class InMemorySessionStore implements SessionStore {
    private config;
    private sessions;
    private cleanupTimer?;
    constructor(config?: SessionStoreConfig);
    createSession(input: CreateSessionInput): Promise<OperatorSession>;
    getSession(sessionId: string): Promise<OperatorSession | null>;
    saveSession(session: OperatorSession): Promise<void>;
    updateNavigationState(sessionId: string, navigationState: UpdateNavigationInput): Promise<OperatorSession | null>;
    closeSession(sessionId: string): Promise<void>;
    listActiveSessions(surface?: string): Promise<OperatorSession[]>;
    private generateSessionId;
    private isExpired;
    private startCleanup;
    private cleanup;
    private stopCleanup;
    /**
     * 清除所有 Sessions
     */
    clear(): void;
    /**
     * 获取 Sessions 数量
     */
    size(): number;
    /**
     * 停止自动清理（用于测试）
     */
    stopAutoCleanup(): void;
}
export declare function createSessionStore(config?: SessionStoreConfig): SessionStore;
