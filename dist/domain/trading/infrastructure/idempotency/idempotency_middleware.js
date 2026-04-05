"use strict";
/**
 * Idempotency Middleware
 * Phase 2E-4A - 幂等性 HTTP 中间件
 *
 * 职责：
 * - 为 HTTP 端点提供幂等性保护
 * - 自动处理重复请求
 * - 记录审计日志
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdempotencyMiddleware = void 0;
exports.createIdempotencyMiddleware = createIdempotencyMiddleware;
exports.withIdempotency = withIdempotency;
// ============================================================================
// Idempotency Middleware
// ============================================================================
class IdempotencyMiddleware {
    constructor(config) {
        this.config = config;
    }
    /**
     * 提取幂等键
     */
    extractIdempotencyKey(req, resourceType, resourceId) {
        // 优先从 Idempotency-Key header 获取
        const headerKey = req.headers['idempotency-key'];
        if (headerKey) {
            return this.config.keyGenerator.generate(headerKey);
        }
        // 从请求体提取
        return this.config.keyGenerator.generate(`${resourceType}:${resourceId}`);
    }
    /**
     * 开始幂等检查
     */
    async begin(req, resourceType, resourceId) {
        const idempotencyKey = this.extractIdempotencyKey(req, resourceType, resourceId);
        const ownerId = this.generateOwnerId(req);
        // 检查幂等性
        const beginResult = await this.config.idempotencyManager.begin(idempotencyKey, this.hashRequest(req));
        const context = {
            idempotencyKey,
            ownerId,
        };
        // 审计：幂等命中
        if (!beginResult.accepted && beginResult.existing) {
            await this.audit({
                type: 'idempotency_hit',
                key: idempotencyKey,
                timestamp: Date.now(),
                metadata: {
                    status: beginResult.existing.status,
                    response: beginResult.existing.response,
                },
            });
            return {
                context,
                shouldContinue: false,
                existingResponse: beginResult.existing.response,
            };
        }
        // 审计：幂等创建
        await this.audit({
            type: 'idempotency_created',
            key: idempotencyKey,
            ownerId,
            timestamp: Date.now(),
        });
        // 获取锁（如果配置了）
        if (this.config.lock && this.config.lockGenerator) {
            const lockKey = this.config.lockGenerator.generate(`${resourceType}:${resourceId}`);
            context.lockKey = lockKey;
            const lockResult = await this.config.lock.tryAcquire(lockKey, ownerId, this.config.lockTtlMs);
            if (lockResult.acquired) {
                context.lockAcquired = true;
                await this.audit({
                    type: 'lock_acquired',
                    key: lockKey,
                    ownerId,
                    timestamp: Date.now(),
                    metadata: {
                        expiresAt: lockResult.expiresAt,
                    },
                });
            }
            else {
                await this.audit({
                    type: 'lock_acquire_failed',
                    key: lockKey,
                    ownerId,
                    timestamp: Date.now(),
                    metadata: {
                        currentOwner: lockResult.ownerId,
                        expiresAt: lockResult.expiresAt,
                    },
                });
                return {
                    context,
                    shouldContinue: false,
                    existingResponse: {
                        error: 'Resource is being processed by another request',
                        retryAfter: lockResult.expiresAt ? Math.ceil((lockResult.expiresAt - Date.now()) / 1000) : undefined,
                    },
                };
            }
        }
        return {
            context,
            shouldContinue: true,
        };
    }
    /**
     * 完成幂等记录
     */
    async complete(context, response) {
        await this.config.idempotencyManager.complete(context.idempotencyKey, {
            response,
        });
        // 释放锁
        if (context.lockAcquired && context.lockKey && this.config.lock) {
            await this.config.lock.release(context.lockKey, context.ownerId);
            await this.audit({
                type: 'lock_released',
                key: context.lockKey,
                ownerId: context.ownerId,
                timestamp: Date.now(),
            });
        }
    }
    /**
     * 失败幂等记录
     */
    async fail(context, error) {
        await this.config.idempotencyManager.fail(context.idempotencyKey, {
            message: error.message,
        });
        // 释放锁
        if (context.lockAcquired && context.lockKey && this.config.lock) {
            await this.config.lock.release(context.lockKey, context.ownerId);
            await this.audit({
                type: 'lock_released',
                key: context.lockKey,
                ownerId: context.ownerId,
                timestamp: Date.now(),
            });
        }
    }
    /**
     * 生成 Owner ID
     */
    generateOwnerId(req) {
        // 使用请求的唯一标识
        const forwarded = req.headers['x-forwarded-for'];
        const ip = forwarded ? forwarded.split(',')[0] : req.socket.remoteAddress || 'unknown';
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        return `${ip}:${timestamp}:${random}`;
    }
    /**
     * 哈希请求
     */
    hashRequest(req) {
        // 简单实现，实际应该哈希请求体
        const method = req.method || 'GET';
        const url = req.url || '/';
        const timestamp = Date.now();
        return `${method}:${url}:${timestamp}`;
    }
    /**
     * 审计日志
     */
    async audit(event) {
        if (this.config.auditLog) {
            await this.config.auditLog(event);
        }
    }
}
exports.IdempotencyMiddleware = IdempotencyMiddleware;
// ============================================================================
// Factory Function
// ============================================================================
function createIdempotencyMiddleware(config) {
    return new IdempotencyMiddleware(config);
}
function withIdempotency(handler, middleware, resourceType, resourceIdExtractor) {
    return async (req, res) => {
        try {
            const resourceId = resourceIdExtractor(req);
            const { context, shouldContinue, existingResponse } = await middleware.begin(req, resourceType, resourceId);
            if (!shouldContinue) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(existingResponse));
                return;
            }
            // 执行实际处理
            await handler(req, res);
            // 完成幂等记录（在响应发送后）
            res.on('finish', async () => {
                // 注意：这里无法获取响应体，需要在 handler 中传递
            });
        }
        catch (error) {
            // 失败处理
            console.error('[withIdempotency] Error:', error);
            throw error;
        }
    };
}
