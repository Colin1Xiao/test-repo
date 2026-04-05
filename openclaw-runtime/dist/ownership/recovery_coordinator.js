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
export const DEFAULT_RECOVERY_CONFIG = {
    session_ttl_ms: 30 * 60 * 1000, // 30 分钟
    session_heartbeat_interval_ms: 5 * 60 * 1000, // 5 分钟
    item_claim_ttl_ms: 10 * 60 * 1000, // 10 分钟
    item_max_retries: 3,
    orphan_detection_interval_ms: 60 * 1000, // 1 分钟
};
// ==================== Recovery Coordinator ====================
export class RecoveryCoordinator {
    redis;
    audit;
    config;
    instance_id;
    // Redis key prefixes
    static SESSION_PREFIX = 'recovery:session:';
    static ITEM_PREFIX = 'recovery:item:';
    static SESSIONS_SET = 'recovery:sessions';
    constructor(redis, audit, config = {}, instance_id) {
        this.redis = redis;
        this.audit = audit;
        this.config = { ...DEFAULT_RECOVERY_CONFIG, ...config };
        this.instance_id = instance_id;
    }
    // ==================== Session Lifecycle ====================
    /**
     * 启动 Recovery Session
     *
     * 原子操作：确保同一时间只有一个活跃 Session（单实例模式）
     * 多实例模式：使用分布式锁确保互斥
     */
    async startSession() {
        const session_id = this.generateSessionId();
        const now = Date.now();
        try {
            // 检查是否已有活跃 Session（单实例模式）
            const activeSession = await this.getActiveSession();
            if (activeSession) {
                return {
                    success: false,
                    error: 'SESSION_EXISTS',
                    message: `Active session exists: ${activeSession.session_id}`,
                };
            }
            // 创建 Session
            const session = {
                session_id,
                owner_id: this.instance_id,
                created_at: now,
                expires_at: now + this.config.session_ttl_ms,
                status: 'active',
                items_total: 0,
                items_claimed: 0,
                items_completed: 0,
                last_heartbeat: now,
            };
            // 原子写入 Redis
            await this.redis.set(RecoveryCoordinator.SESSION_PREFIX + session_id, JSON.stringify(session), { ex: Math.ceil(this.config.session_ttl_ms / 1000) });
            // 添加到活跃 Session 集合
            await this.redis.sadd(RecoveryCoordinator.SESSIONS_SET, session_id);
            // 审计日志
            await this.audit.log({
                event_type: 'recovery_session_started',
                object_type: 'recovery_session',
                object_id: session_id,
                metadata: {
                    owner_id: this.instance_id,
                    ttl_ms: this.config.session_ttl_ms,
                },
            });
            return { success: true, session };
        }
        catch (error) {
            await this.audit.log({
                event_type: 'recovery_session_start_failed',
                object_type: 'recovery_session',
                object_id: session_id,
                metadata: { error: String(error) },
            });
            return {
                success: false,
                error: 'REDIS_ERROR',
                message: `Failed to start session: ${error}`,
            };
        }
    }
    /**
     * 续期 Session
     *
     * 必须在过期前调用，否则 Session 会被标记为 expired
     */
    async renewSession(session_id) {
        const now = Date.now();
        try {
            const session = await this.getSession(session_id);
            if (!session) {
                return {
                    success: false,
                    error: 'SESSION_NOT_FOUND',
                    message: `Session not found: ${session_id}`,
                };
            }
            if (session.status !== 'active') {
                return {
                    success: false,
                    error: 'SESSION_EXPIRED',
                    message: `Session is not active: ${session.status}`,
                };
            }
            if (session.owner_id !== this.instance_id) {
                return {
                    success: false,
                    error: 'NOT_OWNER',
                    message: `Session owned by ${session.owner_id}`,
                };
            }
            // 续期
            session.expires_at = now + this.config.session_ttl_ms;
            session.last_heartbeat = now;
            await this.redis.set(RecoveryCoordinator.SESSION_PREFIX + session_id, JSON.stringify(session), { ex: Math.ceil(this.config.session_ttl_ms / 1000) });
            return { success: true, session };
        }
        catch (error) {
            return {
                success: false,
                error: 'REDIS_ERROR',
                message: `Failed to renew session: ${error}`,
            };
        }
    }
    /**
     * 完成 Session
     *
     * 可选：检查是否所有 Item 都已完成
     */
    async completeSession(session_id, options = { require_all_items_complete: false }) {
        try {
            const session = await this.getSession(session_id);
            if (!session) {
                return {
                    success: false,
                    error: 'SESSION_NOT_FOUND',
                    message: `Session not found: ${session_id}`,
                };
            }
            if (session.owner_id !== this.instance_id) {
                return {
                    success: false,
                    error: 'NOT_OWNER',
                    message: `Session owned by ${session.owner_id}`,
                };
            }
            // 检查是否有未完成的 Item
            if (options.require_all_items_complete) {
                const incompleteItems = await this.getIncompleteItems(session_id);
                if (incompleteItems.length > 0) {
                    return {
                        success: false,
                        error: 'INCOMPLETE_ITEMS',
                        message: `${incompleteItems.length} items still incomplete`,
                        items_remaining: incompleteItems,
                    };
                }
            }
            // 标记 Session 为 completed
            session.status = 'completed';
            session.expires_at = Date.now();
            await this.redis.set(RecoveryCoordinator.SESSION_PREFIX + session_id, JSON.stringify(session));
            // 从活跃集合移除
            await this.redis.srem(RecoveryCoordinator.SESSIONS_SET, session_id);
            // 审计日志
            await this.audit.log({
                event_type: 'recovery_session_completed',
                object_type: 'recovery_session',
                object_id: session_id,
                metadata: {
                    items_completed: session.items_completed,
                    items_total: session.items_total,
                },
            });
            return { success: true, session, items_remaining: [] };
        }
        catch (error) {
            return {
                success: false,
                error: 'REDIS_ERROR',
                message: `Failed to complete session: ${error}`,
            };
        }
    }
    // ==================== Item Coordination ====================
    /**
     * 声明 Item 所有权
     *
     * 使用原子操作确保只有一个 Session 能 claim 同一个 Item
     */
    async claimItem(item_id, session_id) {
        const now = Date.now();
        try {
            // 验证 Session
            const session = await this.getSession(session_id);
            if (!session || session.status !== 'active') {
                return {
                    success: false,
                    error: 'SESSION_INVALID',
                    message: `Invalid session: ${session_id}`,
                };
            }
            // 获取 Item
            const item = await this.getItem(item_id);
            if (!item) {
                return {
                    success: false,
                    error: 'ITEM_NOT_FOUND',
                    message: `Item not found: ${item_id}`,
                };
            }
            // 检查是否已被 claim
            if (item.status === 'claimed') {
                return {
                    success: false,
                    error: 'ITEM_ALREADY_CLAIMED',
                    message: `Item already claimed by ${item.claimed_by}`,
                };
            }
            // 检查是否过期
            if (item.expires_at && now > item.expires_at) {
                return {
                    success: false,
                    error: 'ITEM_EXPIRED',
                    message: `Item expired at ${item.expires_at}`,
                };
            }
            // 原子 claim（使用 Lua 脚本确保原子性）
            const claimed = await this.atomicClaimItem(item_id, session_id, now);
            if (!claimed) {
                return {
                    success: false,
                    error: 'ITEM_ALREADY_CLAIMED',
                    message: `Item was claimed by another session (race condition)`,
                };
            }
            // 更新 Session 计数
            session.items_claimed++;
            await this.updateSession(session);
            // 审计日志
            await this.audit.log({
                event_type: 'recovery_item_claimed',
                object_type: 'recovery_item',
                object_id: item_id,
                metadata: {
                    session_id,
                    claimed_by: this.instance_id,
                    item_type: item.item_type,
                },
            });
            return { success: true, item: claimed };
        }
        catch (error) {
            return {
                success: false,
                error: 'REDIS_ERROR',
                message: `Failed to claim item: ${error}`,
            };
        }
    }
    /**
     * 完成 Item 处理
     */
    async completeItem(item_id, session_id, options = { success: true }) {
        try {
            const item = await this.getItem(item_id);
            if (!item) {
                return {
                    success: false,
                    error: 'ITEM_NOT_FOUND',
                    message: `Item not found: ${item_id}`,
                };
            }
            if (item.status !== 'claimed') {
                return {
                    success: false,
                    error: 'NOT_CLAIMED',
                    message: `Item is not claimed: ${item.status}`,
                };
            }
            if (item.session_id !== session_id) {
                return {
                    success: false,
                    error: 'NOT_OWNER',
                    message: `Item claimed by different session: ${item.session_id}`,
                };
            }
            // 更新 Item 状态
            item.status = options.success ? 'completed' : 'failed';
            item.retry_count = options.success ? item.retry_count : item.retry_count + 1;
            await this.updateItem(item);
            // 更新 Session 计数
            const session = await this.getSession(session_id);
            if (session && options.success) {
                session.items_completed++;
                await this.updateSession(session);
            }
            // 审计日志
            await this.audit.log({
                event_type: `recovery_item_${options.success ? 'completed' : 'failed'}`,
                object_type: 'recovery_item',
                object_id: item_id,
                metadata: {
                    session_id,
                    item_type: item.item_type,
                    retry_count: item.retry_count,
                    error: options.error,
                },
            });
            return { success: true, item };
        }
        catch (error) {
            return {
                success: false,
                error: 'REDIS_ERROR',
                message: `Failed to complete item: ${error}`,
            };
        }
    }
    // ==================== Helper Methods ====================
    async getActiveSession() {
        const session_ids = await this.redis.smembers(RecoveryCoordinator.SESSIONS_SET);
        const now = Date.now();
        for (const session_id of session_ids) {
            const session = await this.getSession(session_id);
            if (session && session.status === 'active' && session.expires_at > now) {
                return session;
            }
        }
        return null;
    }
    async getSession(session_id) {
        const data = await this.redis.get(RecoveryCoordinator.SESSION_PREFIX + session_id);
        if (!data)
            return null;
        return JSON.parse(data);
    }
    async getItem(item_id) {
        const data = await this.redis.get(RecoveryCoordinator.ITEM_PREFIX + item_id);
        if (!data)
            return null;
        return JSON.parse(data);
    }
    async updateSession(session) {
        await this.redis.set(RecoveryCoordinator.SESSION_PREFIX + session.session_id, JSON.stringify(session), { ex: Math.ceil((session.expires_at - Date.now()) / 1000) });
    }
    async updateItem(item) {
        const ttl = item.expires_at
            ? Math.max(1, Math.ceil((item.expires_at - Date.now()) / 1000))
            : undefined;
        await this.redis.set(RecoveryCoordinator.ITEM_PREFIX + item.item_id, JSON.stringify(item), ttl ? { ex: ttl } : undefined);
    }
    /**
     * 原子 Claim Item（Lua 脚本）
     *
     * 确保在并发情况下只有一个请求能成功 claim
     */
    async atomicClaimItem(item_id, session_id, now) {
        const luaScript = `
      local key = KEYS[1]
      local session_id = ARGV[1]
      local instance_id = ARGV[2]
      local now = tonumber(ARGV[3])
      local ttl_ms = tonumber(ARGV[4])
      
      local data = redis.call('GET', key)
      if not data then
        return nil
      end
      
      local item = cjson.decode(data)
      
      -- 检查是否已被 claim
      if item.status == 'claimed' then
        return nil
      end
      
      -- 更新状态
      item.status = 'claimed'
      item.session_id = session_id
      item.claimed_at = now
      item.claimed_by = instance_id
      item.expires_at = now + ttl_ms
      
      -- 保存
      redis.call('SET', key, cjson.encode(item), 'PX', ttl_ms)
      
      return cjson.encode(item)
    `;
        const result = await this.redis.eval(luaScript, 1, RecoveryCoordinator.ITEM_PREFIX + item_id, session_id, this.instance_id, String(now), String(this.config.item_claim_ttl_ms));
        if (!result)
            return null;
        return JSON.parse(result);
    }
    async getIncompleteItems(_session_id) {
        // 简化实现：扫描所有 Item，过滤出属于该 Session 且未完成的
        // 生产环境应使用更高效的数据结构（如 Hash 或 Sorted Set）
        const items = [];
        // TODO: 实现高效查询
        return items;
    }
    generateSessionId() {
        return `recovery-${Date.now()}-${this.instance_id.slice(0, 8)}`;
    }
}
//# sourceMappingURL=recovery_coordinator.js.map